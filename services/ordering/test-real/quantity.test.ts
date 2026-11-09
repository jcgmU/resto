import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaOrderRepository } from '../src/infrastructure/persistence/PrismaOrderRepository';
import { PrismaPaymentRepository } from '../src/infrastructure/persistence/PrismaPaymentRepository';
import { RedisCartRepository } from '../src/infrastructure/persistence/RedisCartRepository';
import { RedisServiceCallRepository } from '../src/infrastructure/persistence/RedisServiceCallRepository';
import { CartUseCases } from '../src/application/CartUseCases';
import { OrderUseCases } from '../src/application/OrderUseCases';
import { ConfirmCheckout } from '../src/application/ConfirmCheckout';
import { ValidationError } from '../src/domain/errors';
import {
  CartItemDTO,
  CatalogValidationPort,
  SessionServicePort,
} from '@packages/shared-types';

describe('Ordering Real - Quantities, Pricing & Precision (U1)', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let orderRepo: PrismaOrderRepository;
  let paymentRepo: PrismaPaymentRepository;
  let cartRepo: RedisCartRepository;
  let serviceCallRepo: RedisServiceCallRepository;
  let cartUseCases: CartUseCases;
  let orderUseCases: OrderUseCases;
  let confirmCheckout: ConfirmCheckout;

  const tenantId = `tenant-real-${Date.now()}`;
  const catalogValidation: CatalogValidationPort = {
    getOrderableProducts: async (_tenant, productIds) => {
      return productIds.map((pid) => ({
        productId: pid,
        name: pid === 'prod-burger' ? 'Hamburguesa Clásica' : 'Producto Real',
        price: pid === 'prod-burger' ? 12.5 : 10.0,
        isAvailable: true,
        modifierGroups: [],
      }));
    },
  };

  const sessionService: SessionServicePort = {
    closeSession: async () => {},
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

    cartUseCases = new CartUseCases(cartRepo);
    orderUseCases = new OrderUseCases(orderRepo, cartRepo, catalogValidation);
    confirmCheckout = new ConfirmCheckout(
      orderRepo,
      paymentRepo,
      sessionService,
      cartRepo,
      serviceCallRepo
    );
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.orderItemModifier.deleteMany({
        where: { orderItem: { order: { tenantId } } },
      }).catch(() => {});
      await prisma.orderItem.deleteMany({
        where: { order: { tenantId } },
      }).catch(() => {});
      await prisma.order.deleteMany({
        where: { tenantId },
      }).catch(() => {});
      await prisma.payment.deleteMany({
        where: { tenantId },
      }).catch(() => {});
      await prisma.$disconnect();
    }
    if (redis) {
      const keys = await redis.keys(`*${tenantId}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
    }
  });

  it('bypasses HTTP by seeding quantity -3 in real Redis -> confirmOrder rejects and no Order or Payment created in Postgres', async () => {
    const sessionId = `session-tampered-${Date.now()}`;
    const tableId = 'table-hack-1';

    const tamperedItem: CartItemDTO = {
      cartItemId: 'item-tampered-1',
      productId: 'prod-burger',
      productName: 'Hamburguesa Clásica',
      unitPrice: 12.5,
      quantity: -3,
      modifiers: [],
      addedBy: 'Attacker',
      addedAt: new Date().toISOString(),
      lineTotal: -37.5,
    };

    // Seed directly into real Redis Hash
    const redisKey = `cart:${tenantId}:${sessionId}`;
    await redis.hset(redisKey, tamperedItem.cartItemId, JSON.stringify(tamperedItem));

    // Attempting to confirm order must throw pricing ValidationError
    await expect(
      orderUseCases.confirmOrder.execute({
        tenantId,
        sessionId,
        tableId,
      })
    ).rejects.toThrow(ValidationError);

    // Verify atomic defense: NO Order and NO Payment created in Postgres
    const ordersInDb = await prisma.order.findMany({
      where: { tenantId, sessionId },
    });
    expect(ordersInDb).toHaveLength(0);

    const paymentsInDb = await prisma.payment.findMany({
      where: { tenantId, sessionId },
    });
    expect(paymentsInDb).toHaveLength(0);
  });

  it('normal quantities (1..99): persists catalog snapshots, prices and creates real positive payment', async () => {
    const sessionId = `session-normal-${Date.now()}`;
    const tableId = 'table-normal-1';

    // Add 5 items through use case
    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-burger',
      modifiers: [],
      quantity: 5,
      display: {
        productName: 'Hamburguesa Clásica',
        unitPrice: 12.5,
        modifierNames: [],
      },
    });

    // Confirm order
    const order = await orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId,
      tableId,
    });

    expect(order.total).toBe(62.5);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].productName).toBe('Hamburguesa Clásica');
    expect(order.items[0].unitPrice).toBe(12.5);
    expect(order.items[0].quantity).toBe(5);

    // Verify in Postgres
    const orderInDb = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });
    expect(orderInDb).toBeDefined();
    expect(Number(orderInDb!.total)).toBe(62.5);
    expect(orderInDb!.items[0].quantity).toBe(5);

    // Checkout payment
    const checkoutResult = await confirmCheckout.execute({
      tenantId,
      sessionId,
      tableId,
      method: 'CARD',
      recordedBy: 'waiter-1',
    });

    expect(checkoutResult.payment.amount).toBe(62.5);
    expect(checkoutResult.payment.amount).toBeGreaterThan(0);

    // Verify Payment in Postgres
    const paymentInDb = await prisma.payment.findUnique({
      where: { id: checkoutResult.payment.id },
    });
    expect(paymentInDb).toBeDefined();
    expect(Number(paymentInDb!.amount)).toBe(62.5);
  });

  it('boundary: 99 is valid; seeding 100 and 1000 in Redis directly is rejected', async () => {
    // 99 is valid
    const session99 = `session-99-${Date.now()}`;
    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId: session99,
      productId: 'prod-burger',
      modifiers: [],
      quantity: 99,
      display: { productName: 'Hamburguesa Clásica', unitPrice: 12.5, modifierNames: [] },
    });
    const order99 = await orderUseCases.confirmOrder.execute({
      tenantId,
      sessionId: session99,
      tableId: 'table-99',
    });
    expect(order99.total).toBe(1237.5);

    // Seeding 100 directly in Redis
    const session100 = `session-100-${Date.now()}`;
    const item100: CartItemDTO = {
      cartItemId: 'item-100',
      productId: 'prod-burger',
      productName: 'Hamburguesa Clásica',
      unitPrice: 12.5,
      quantity: 100,
      modifiers: [],
      addedBy: 'Attacker',
      addedAt: new Date().toISOString(),
      lineTotal: 1250,
    };
    await redis.hset(`cart:${tenantId}:${session100}`, item100.cartItemId, JSON.stringify(item100));

    await expect(
      orderUseCases.confirmOrder.execute({
        tenantId,
        sessionId: session100,
        tableId: 'table-100',
      })
    ).rejects.toThrow(ValidationError);

    // Seeding 1000 directly in Redis
    const session1000 = `session-1000-${Date.now()}`;
    const item1000: CartItemDTO = {
      cartItemId: 'item-1000',
      productId: 'prod-burger',
      productName: 'Hamburguesa Clásica',
      unitPrice: 12.5,
      quantity: 1000,
      modifiers: [],
      addedBy: 'Attacker',
      addedAt: new Date().toISOString(),
      lineTotal: 12500,
    };
    await redis.hset(`cart:${tenantId}:${session1000}`, item1000.cartItemId, JSON.stringify(item1000));

    await expect(
      orderUseCases.confirmOrder.execute({
        tenantId,
        sessionId: session1000,
        tableId: 'table-1000',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('cart line merging exceeding 99 in real Redis is rejected and Redis state remains untouched', async () => {
    const sessionId = `session-merge-real-${Date.now()}`;

    // Add 60 units
    await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-burger',
      modifiers: [],
      quantity: 60,
      display: { productName: 'Hamburguesa Clásica', unitPrice: 12.5, modifierNames: [] },
    });

    // Attempt to add 40 more units (60 + 40 = 100 > 99)
    await expect(
      cartUseCases.addCartItem.execute({
        tenantId,
        sessionId,
        productId: 'prod-burger',
        modifiers: [],
        quantity: 40,
        display: { productName: 'Hamburguesa Clásica', unitPrice: 12.5, modifierNames: [] },
      })
    ).rejects.toThrow(ValidationError);

    // Check Redis hash directly: quantity is still 60
    const rawItems = await redis.hgetall(`cart:${tenantId}:${sessionId}`);
    const items = Object.values(rawItems).map((v) => JSON.parse(v) as CartItemDTO);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(60);

    // Add 39 units (60 + 39 = 99 <= 99) -> succeeds
    const updatedCart = await cartUseCases.addCartItem.execute({
      tenantId,
      sessionId,
      productId: 'prod-burger',
      modifiers: [],
      quantity: 39,
      display: { productName: 'Hamburguesa Clásica', unitPrice: 12.5, modifierNames: [] },
    });

    expect(updatedCart.items).toHaveLength(1);
    expect(updatedCart.items[0].quantity).toBe(99);
  });
});
