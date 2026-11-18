import { ensureContractEnv, getTestRedis, flushSessionRedis, disconnectTestRedis } from './contract-helper';
import { RedisTableRepository } from '../../src/infrastructure/redis/RedisTableRepository';
import { RedisTableSessionRepository } from '../../src/infrastructure/redis/RedisTableSessionRepository';
import { RedisReservationRepository } from '../../src/infrastructure/redis/RedisReservationRepository';
import { DeleteTablesBatchUseCaseImpl } from '../../src/application/TableUseCases';
import { CreateReservationUseCaseImpl } from '../../src/application/ReservationUseCases';
import { isReservationActive } from '../../src/domain/reservationRules';

describe('Baja de mesa atómica frente a reservas (Redis real)', () => {
  const tenantId = 'tenant-delete-atomic';
  const future = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  let redis: any;
  let tableRepo: RedisTableRepository;
  let reservationRepo: RedisReservationRepository;
  let deleteBatch: DeleteTablesBatchUseCaseImpl;
  let createReservation: CreateReservationUseCaseImpl;

  const makeTable = (tableId: string) =>
    tableRepo.save(tenantId, { tableId, tenantId, label: tableId, status: 'active', qrKey: `qr-${tableId}`, createdAt: new Date().toISOString() });

  async function assertInvariant(tableId: string) {
    const table = await tableRepo.findById(tenantId, tableId);
    const raw = await redis.get(`table:${tenantId}:${tableId}`);
    const deleted = !table || JSON.parse(raw).status === 'deleted';
    const reservations = await reservationRepo.listByTable(tenantId, tableId);
    const active = reservations.filter((r) => isReservationActive(r, Date.now()));
    return { deleted, active: active.length };
  }

  beforeAll(async () => {
    await ensureContractEnv();
    redis = getTestRedis();
    tableRepo = new RedisTableRepository(redis);
    reservationRepo = new RedisReservationRepository(redis);
    const sessionRepo = new RedisTableSessionRepository(redis);
    deleteBatch = new DeleteTablesBatchUseCaseImpl(tableRepo, reservationRepo, sessionRepo);
    createReservation = new CreateReservationUseCaseImpl(reservationRepo, tableRepo);
  });

  afterAll(async () => {
    await disconnectTestRedis();
  });

  beforeEach(async () => {
    await flushSessionRedis();
  });

  it('una reserva que entra entre la comprobación y el borrado impide la baja (interleaving determinista)', async () => {
    await makeTable('t-det');
    const realList = reservationRepo.listByTable.bind(reservationRepo);
    let injected = false;
    jest.spyOn(reservationRepo, 'listByTable').mockImplementation(async (tenant, tableId) => {
      const seen = await realList(tenant, tableId);
      if (!injected) {
        injected = true;
        await createReservation.execute({ tenantId, tableId, customerName: 'Ana', phone: '300', partySize: 2, reservedFor: future() });
      }
      return seen;
    });

    await expect(deleteBatch.execute({ tenantId, body: { tableIds: ['t-det'] } })).rejects.toMatchObject({
      code: 'TABLES_NOT_DELETABLE',
      details: { failed: [{ tableId: 't-det', code: 'TABLE_HAS_RESERVATIONS' }] },
    });
    const state = await assertInvariant('t-det');
    expect(state).toEqual({ deleted: false, active: 1 });
    jest.restoreAllMocks();
  });

  it('crear una reserva sobre una mesa ya dada de baja falla y no deja nada guardado', async () => {
    await makeTable('t-gone');
    await deleteBatch.execute({ tenantId, body: { tableIds: ['t-gone'] } });
    const staleTable = { tableId: 't-gone', tenantId, label: 't-gone', status: 'active', createdAt: new Date().toISOString() };
    const alwaysFound = { findById: async () => staleTable } as unknown as RedisTableRepository;
    const racing = new CreateReservationUseCaseImpl(reservationRepo, alwaysFound);
    await expect(
      racing.execute({ tenantId, tableId: 't-gone', customerName: 'Luis', phone: '301', partySize: 2, reservedFor: future() }),
    ).rejects.toMatchObject({ code: 'TABLE_NOT_FOUND' });
    expect(await reservationRepo.listByTable(tenantId, 't-gone')).toEqual([]);
  });

  it('baja y reserva simultáneas en bucle nunca dejan mesa borrada con reserva activa', async () => {
    const violations: string[] = [];
    for (let i = 0; i < 60; i += 1) {
      const tableId = `t-loop-${i}`;
      await makeTable(tableId);
      const results = await Promise.allSettled([
        deleteBatch.execute({ tenantId, body: { tableIds: [tableId] } }),
        createReservation.execute({ tenantId, tableId, customerName: 'Eva', phone: '302', partySize: 2, reservedFor: future() }),
      ]);
      results.forEach((r) => {
        if (r.status === 'rejected') expect(['TABLES_NOT_DELETABLE', 'TABLE_NOT_FOUND']).toContain((r.reason as { code?: string }).code);
      });
      const state = await assertInvariant(tableId);
      if (state.deleted && state.active > 0) violations.push(tableId);
    }
    expect(violations).toEqual([]);
  });

  it('la regla de reserva activa del Lua coincide con la de TypeScript (estados y formatos de fecha)', async () => {
    const hour = 60 * 60 * 1000;
    const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
    const cases: Array<{ status: string; reservedFor: string }> = [
      { status: 'active', reservedFor: iso(3 * hour) },
      { status: 'active', reservedFor: iso(-hour) },
      { status: 'active', reservedFor: iso(-3 * hour) },
      { status: 'confirmed', reservedFor: iso(5 * hour) },
      { status: 'cancelled', reservedFor: iso(5 * hour) },
      { status: 'seated', reservedFor: iso(5 * hour) },
      { status: 'CANCELLED', reservedFor: iso(5 * hour) },
      { status: 'active', reservedFor: 'fecha-rara' },
      { status: 'active', reservedFor: '2020-01-01' },
      { status: 'active', reservedFor: '2099-01-01' },
      { status: 'active', reservedFor: '2099-01-01T10:00:00+02:00' },
      { status: 'active', reservedFor: '2020-01-01T10:00:00-05:00' },
      { status: 'active', reservedFor: '2020-01-01T10:00:00Z' },
    ];
    for (const [index, item] of cases.entries()) {
      const tableId = `t-parity-${index}`;
      await makeTable(tableId);
      const id = `res-parity-${index}`;
      await redis.hset(`reservation:${id}`, { id, tenantId, tableId, status: item.status, reservedFor: item.reservedFor });
      await redis.sadd(`table:${tableId}:reservations`, id);
      const blocks = isReservationActive({ status: item.status, reservedFor: item.reservedFor }, Date.now());
      const outcome = await tableRepo.softDeleteMany(tenantId, [{ tableId, deletedAt: new Date().toISOString(), newQrKey: 'k' }]);
      expect({ case: item, blocked: outcome.failed.length === 1 && outcome.failed[0].code === 'TABLE_HAS_RESERVATIONS' }).toEqual({ case: item, blocked: blocks });
    }
  });

  it('DELETE /tables/:id responde 409 TABLE_HAS_RESERVATIONS si la reserva entra tras la pre-comprobación', async () => {
    const request = (await import('supertest')).default;
    const { createSessionApp } = await import('../../src/app');
    await makeTable('t-route');
    const sessionRepo = new RedisTableSessionRepository(redis);
    const lateReservations = Object.create(reservationRepo) as RedisReservationRepository;
    lateReservations.listByTable = async () => [];
    const app = createSessionApp({ redis, tableRepo, sessionRepo, reservationRepo: lateReservations });
    await createReservation.execute({ tenantId, tableId: 't-route', customerName: 'Rosa', phone: '303', partySize: 2, reservedFor: future() });

    const res = await request(app).delete('/tables/t-route').set({ 'x-tenant-id': tenantId, 'x-user-role': 'admin' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TABLE_HAS_RESERVATIONS');
    expect((await assertInvariant('t-route')).deleted).toBe(false);
  });
});
