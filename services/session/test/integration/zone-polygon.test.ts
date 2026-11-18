import request from 'supertest';
import { createSessionApp } from '../../src/app';
import { InMemoryTableRepository, InMemoryTableSessionRepository, InMemoryZoneRepository } from '../../src/infrastructure/fakes/InMemorySessionAdapters';

const polygon = [[0.04, 0.04], [3.04, 0.04], [3.04, 3.04], [0.04, 3.04]];
const rounded = [[0, 0], [3, 0], [3, 3], [0, 3]];

describe('polígonos de zonas', () => {
  const headers = { 'x-tenant-id': 'tenant-polygon', 'x-user-role': 'admin' };
  let app: ReturnType<typeof createSessionApp>;

  beforeEach(() => {
    app = createSessionApp({ tableRepo: new InMemoryTableRepository(), sessionRepo: new InMemoryTableSessionRepository(), zoneRepo: new InMemoryZoneRepository() });
  });

  it('guarda y actualiza coordenadas ajustadas a la cuadrícula, y null elimina el polígono', async () => {
    const created = await request(app).post('/zones').set(headers).send({ name: 'Salón', polygon });
    expect(created.status).toBe(201);
    expect(created.body.polygon).toEqual(rounded);
    const updated = await request(app).patch(`/zones/${created.body.id}`).set(headers).send({ polygon: [[4, 0], [7, 0], [7, 3], [4, 3]] });
    expect(updated.status).toBe(200);
    expect(updated.body.polygon).toEqual([[4, 0], [7, 0], [7, 3], [4, 3]]);
    const removed = await request(app).patch(`/zones/${created.body.id}`).set(headers).send({ polygon: null });
    expect(removed.status).toBe(200);
    expect(removed.body.polygon).toBeUndefined();
    const listed = await request(app).get('/zones').set(headers);
    expect(listed.body[0].polygon).toBeUndefined();
  });

  it('rechaza polígonos inválidos con el código de geometría en 422', async () => {
    const cases = [
      { polygon: [[0, 0], [1, 1]], code: 'SPACE_INVALID_POLYGON' },
      { polygon: [[0, 0], [4, 4], [0, 4], [3, 0]], code: 'SPACE_SELF_INTERSECTS' },
      { polygon: [[0, 0], [1, 0], [1, 1], [0, 1]], code: 'SPACE_TOO_SMALL' },
      { polygon: [[0, 0], [20, 0], [20, 3], [0, 3]], code: 'SPACE_OUT_OF_BOUNDS' },
    ];
    for (const candidate of cases) {
      const response = await request(app).post('/zones').set(headers).send({ name: candidate.code, polygon: candidate.polygon });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe(candidate.code);
      expect(response.body.error.details.code).toBe(candidate.code);
    }
  });

  it('acepta un polígono dibujado de 1,2 × 3 m sin regla de lado mínimo', async () => {
    const response = await request(app).post('/zones').set(headers).send({ name: 'Pasillo', polygon: [[0, 0], [1.2, 0], [1.2, 3], [0, 3]] });
    expect(response.status).toBe(201);
    expect(response.body.polygon).toHaveLength(4);
  });

  it('rechaza solapes del mismo tenant, permite otra zona antigua y aísla tenants', async () => {
    expect((await request(app).post('/zones').set(headers).send({ name: 'Anterior' })).status).toBe(201);
    expect((await request(app).post('/zones').set(headers).send({ name: 'Primera', polygon: rounded })).status).toBe(201);
    const overlap = await request(app).post('/zones').set(headers).send({ name: 'Solapada', polygon: [[1, 1], [4, 1], [4, 4], [1, 4]] });
    expect(overlap.status).toBe(422);
    expect(overlap.body.error.code).toBe('SPACE_OVERLAP');
    const other = await request(app).post('/zones').set({ ...headers, 'x-tenant-id': 'otro-tenant' }).send({ name: 'Otro', polygon: rounded });
    expect(other.status).toBe(201);
  });
});
