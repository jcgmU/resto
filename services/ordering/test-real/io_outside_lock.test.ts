import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaOrderRepository } from '../src/infrastructure/persistence/PrismaOrderRepository';
import { PrismaPaymentRepository } from '../src/infrastructure/persistence/PrismaPaymentRepository';
import { RedisCartRepository } from '../src/infrastructure/persistence/RedisCartRepository';
import { RedisServiceCallRepository } from '../src/infrastructure/persistence/RedisServiceCallRepository';
import { OrderUseCases } from '../src/application/OrderUseCases';
import { ConfirmCheckout } from '../src/application/ConfirmCheckout';
import { PrismaTransactionCoordinator } from '../src/infrastructure/persistence/PrismaTransactionCoordinator';
import { SessionNotActiveError } from '../src/domain/errors';
import { CatalogValidationPort, SessionServicePort } from '@packages/shared-types';

describe('Ordering Real - I/O Outside Advisory Lock (X3)', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let orderRepo: PrismaOrderRepository;
  let paymentRepo: PrismaPaymentRepository;
  let cartRepo: RedisCartRepository;
  let serviceCallRepo: RedisServiceCallRepository;
  let txCoordinator: PrismaTransactionCoordinator;

  const tenantId = `tenant-io-lock-${Date.now()}`;

  const sessionService: SessionServicePort & {
    getSession?: (t: string, s: string) => Promise<any>;
  } = {
    closeSession: async () => {},
    getSession: async (t, s) => ({
      sessionId: s,
      tenantId: t,
      tableId: 'table-io-1',
      status: 'active',
    }),
  };

  beforeAll(async () => {
    const dbUrl = process.env.ORDERING_DATABASE_URL;
    if (!dbUrl) {
      throw new Error(
        'Missing required env ORDERING_DATABASE_URL for test:real (refusing to fall back to dev database)'
      );
    }
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        'Missing required env REDIS_URL for test:real (refusing to fall back to dev Redis)'
      );
    }
    prisma = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });
    await prisma.$connect();

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    orderRepo = new PrismaOrderRepository(prisma);
    paymentRepo = new PrismaPaymentRepository(prisma);
    cartRepo = new RedisCartRepository(redis);
    serviceCallRepo = new RedisServiceCallRepository(redis);
    txCoordinator = new PrismaTransactionCoordinator(prisma);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.orderItemModifier
        .deleteMany({
          where: { orderItem: { order: { tenantId } } },
        })
        .catch(() => {});
      await prisma.orderItem
        .deleteMany({
          where: { order: { tenantId } },
        })
        .catch(() => {});
      await prisma.order
        .deleteMany({
          where: { tenantId },
        })
        .catch(() => {});
      await prisma.payment
        .deleteMany({
          where: { tenantId },
        })
        .catch(() => {});
      await prisma.$disconnect();
    }
    if (redis) {
      const keys = await redis.keys(`resto:${tenantId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
    }
  });

  it('does NOT hold advisory lock during external catalog HTTP I/O, allowing concurrent session operations', async () => {
    const sessionId = `s-io-catalog-${Date.now()}`;
    const tableId = 'table-io-1';

    // 1. Sembrar un item en Redis
    await cartRepo.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-io-1',
        productId: 'prod-io-1',
        productName: 'Producto Lento',
        unitPrice: 20.0,
        modifiers: [],
        quantity: 1,
        lineTotal: 20.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    // 2. Mock de catalogValidation con barrera determinista
    let catalogResolve!: () => void;
    const releaseCatalog = new Promise<void>((resolve) => {
      catalogResolve = resolve;
    });

    let catalogEnteredResolve!: () => void;
    const catalogEntered = new Promise<void>((resolve) => {
      catalogEnteredResolve = resolve;
    });

    const slowCatalogValidation: CatalogValidationPort = {
      getOrderableProducts: async (_tenant, productIds) => {
        catalogEnteredResolve();
        // Queda esperando hasta que el test compruebe los locks y libere
        await releaseCatalog;
        return productIds.map((pid) => ({
          productId: pid,
          name: 'Producto Lento Confirmado',
          price: 20.0,
          isAvailable: true,
          modifierGroups: [],
        }));
      },
    };

    const orderUseCases = new OrderUseCases(
      orderRepo,
      cartRepo,
      slowCatalogValidation,
      undefined,
      paymentRepo,
      sessionService,
      txCoordinator
    );

    // 3. Iniciar confirmOrder en background
    const confirmPromise = orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    try {
      // 4. Esperar a que la ejecución esté bloqueada DENTRO de catalogValidation.getOrderableProducts
      await catalogEntered;

      // 5. AFIRMACIÓN 1: En Postgres, pg_locks NO debe contener ningún advisory lock para esta sesión
      const locks = await prisma.$queryRaw<Array<{ cnt: number }>>`
        SELECT count(*)::int AS cnt
        FROM pg_locks
        WHERE locktype = 'advisory'
          AND classid = hashtext(${tenantId})
          AND objid = hashtext(${sessionId})
          AND granted = true
      `;
      expect(locks[0].cnt).toBe(0);

      // 6. AFIRMACIÓN 2: Otra transacción puede adquirir el advisory lock de esa misma sesión de inmediato
      const lockAcquired = await prisma.$transaction(async (tx) => {
        const res = await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtext(${tenantId}), hashtext(${sessionId})) AS locked
        `;
        return res[0]?.locked;
      });
      expect(lockAcquired).toBe(true);
    } finally {
      // 7. Liberar catalog para que la confirmación continúe
      catalogResolve();
    }

    // 8. Confirmar que la orden se creó exitosamente
    const confirmedOrder = await confirmPromise;
    expect(confirmedOrder.id).toBeDefined();
    expect(confirmedOrder.total).toBe(20.0);

    // 9. Verificar que el carrito en Redis se limpió tras el commit
    const cartAfter = await cartRepo.get(tenantId, sessionId, 7200);
    expect(cartAfter.items).toHaveLength(0);
  });

  it('preserves U4 race guarantee: checkout during slow catalog causes confirmOrder to reject with SessionNotActiveError upon entering lock', async () => {
    const sessionId = `s-io-checkout-race-${Date.now()}`;
    const tableId = 'table-io-1';

    // 1. Sembrar item en carrito
    await cartRepo.upsertItem(
      tenantId,
      sessionId,
      {
        cartItemId: 'ci-io-race',
        productId: 'prod-io-race',
        productName: 'Producto Carrera Cobro',
        unitPrice: 25.0,
        modifiers: [],
        quantity: 1,
        lineTotal: 25.0,
        addedAt: new Date().toISOString(),
      },
      7200
    );

    // 2. Mock de catalog con barrera determinista
    let catalogResolve!: () => void;
    const releaseCatalog = new Promise<void>((resolve) => {
      catalogResolve = resolve;
    });

    let catalogEnteredResolve!: () => void;
    const catalogEntered = new Promise<void>((resolve) => {
      catalogEnteredResolve = resolve;
    });

    const slowCatalogValidation: CatalogValidationPort = {
      getOrderableProducts: async (_tenant, productIds) => {
        catalogEnteredResolve();
        await releaseCatalog;
        return productIds.map((pid) => ({
          productId: pid,
          name: 'Producto Carrera Cobro',
          price: 25.0,
          isAvailable: true,
          modifierGroups: [],
        }));
      },
    };

    const orderUseCases = new OrderUseCases(
      orderRepo,
      cartRepo,
      slowCatalogValidation,
      undefined,
      paymentRepo,
      sessionService,
      txCoordinator
    );

    // 3. Iniciar confirmOrder
    const confirmPromise = orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    try {
      // 4. Esperar a que confirmOrder esté en catalogValidation
      await catalogEntered;

      // 5. Mientras catalog responde, un staff registra el pago de la sesión en Postgres
      await paymentRepo.save(tenantId, {
        id: `pay-race-${Date.now()}`,
        tenantId,
        sessionId,
        tableId,
        amount: 25.0,
        method: 'CASH',
        ordersCount: 0,
        recordedBy: 'staff-fast',
        createdAt: new Date().toISOString(),
      });
    } finally {
      // 6. Liberar catalog: confirmOrder sale de catalogValidation e intenta adquirir el lock de Postgres
      catalogResolve();
    }

    // 7. Al entrar a la transacción/lock en Postgres, debe detectar el pago y lanzar SessionNotActiveError
    await expect(confirmPromise).rejects.toThrow(SessionNotActiveError);

    // 8. Garantía U4: NINGUNA orden huérfana post-pago fue creada en Postgres
    const ordersInDb = await orderRepo.listBySession(tenantId, sessionId);
    expect(ordersInDb).toHaveLength(0);
  });
});
