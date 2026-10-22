import express, { Express } from 'express';
import { requireGatewayIdentity } from './interfaces/http/middleware/requireGatewayIdentity';
import { internalAuthMiddleware } from './interfaces/http/internalAuth.middleware';
import { errorHandler } from './interfaces/http/middleware/errorHandler';
import { createCartRouter } from './interfaces/http/cart.routes';
import { createOrdersRouter } from './interfaces/http/orders.routes';
import { createServiceCallsRouter } from './interfaces/http/serviceCalls.routes';
import { createCheckoutRouter } from './interfaces/http/checkout.routes';
import { CartUseCases } from './application/CartUseCases';
import { OrderUseCases } from './application/OrderUseCases';
import { ServiceCallUseCases } from './application/ServiceCallUseCases';
import { CheckoutUseCases } from './application/CheckoutUseCases';

import { HttpSessionServiceAdapter } from './infrastructure/session/HttpSessionServiceAdapter';
import { PrismaOrderRepository } from './infrastructure/persistence/PrismaOrderRepository';
import { PrismaPaymentRepository } from './infrastructure/persistence/PrismaPaymentRepository';
import { RedisCartRepository } from './infrastructure/persistence/RedisCartRepository';
import { RedisServiceCallRepository } from './infrastructure/persistence/RedisServiceCallRepository';
import { GraphqlCatalogValidationAdapter } from './infrastructure/catalog/GraphqlCatalogValidationAdapter';
import { RedisEventPublisher } from './infrastructure/events/RedisEventPublisher';
import { config } from './config';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import {
  CartRepository,
  CatalogValidationPort,
  EventPublisher,
  OrderRepository,
  PaymentRepository,
  ServiceCallRepository,
  SessionServicePort,
  IdentitySettingsPort,
} from '@packages/shared-types';
import { MocaInvoiceProvider } from './infrastructure/invoice/MocaInvoiceProvider';
import { InvoiceProvider } from '@packages/shared-types';
import { HttpIdentitySettingsAdapter } from './infrastructure/identity/HttpIdentitySettingsAdapter';

export interface AppDependencies {
  cartRepo?: CartRepository;
  orderRepo?: OrderRepository;
  catalogValidation?: CatalogValidationPort;
  serviceCallRepo?: ServiceCallRepository;
  eventPublisher?: EventPublisher;
  paymentRepo?: PaymentRepository;
  sessionService?: SessionServicePort;
  identitySettings?: IdentitySettingsPort;
  invoiceProvider?: InvoiceProvider;
  prisma?: PrismaClient;
  redis?: Redis;
}

let prismaClient: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

let redisClient: Redis | null = null;
export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl || 'redis://localhost:6379/1', {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 50, 500);
      },
    });
  }
  return redisClient;
}

export async function closeDefaultAppConnections(): Promise<void> {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
  if (prismaClient) {
    await prismaClient.$disconnect().catch(() => {});
    prismaClient = null;
  }
}

export function createOrderingApp(deps?: AppDependencies): Express {
  const app = express();
  app.use(express.json());

  const usePrisma = !deps?.orderRepo || !deps?.paymentRepo;
  const prisma = deps?.prisma || (usePrisma ? getPrisma() : null);

  const useRedis = !deps?.cartRepo || !deps?.serviceCallRepo || !deps?.eventPublisher;
  const redis = deps?.redis || (useRedis ? getRedis() : null);

  // Health
  app.get('/health', async (_req, res) => {
    let postgresStatus = 'down';
    let redisStatus = 'down';

    try {
      if (prisma) {
        await prisma.$queryRaw`SELECT 1`;
      }
      postgresStatus = 'up';
    } catch {
      postgresStatus = 'down';
    }

    try {
      if (redis) {
        await redis.ping();
      }
      redisStatus = 'up';
    } catch {
      redisStatus = 'down';
    }

    if (postgresStatus === 'up' && redisStatus === 'up') {
      res.status(200).json({ status: 'ok', postgres: 'up', redis: 'up' });
    } else {
      res.status(503).json({ status: 'error', postgres: postgresStatus, redis: redisStatus });
    }
  });

  app.use(internalAuthMiddleware);

  const cartRepo = deps?.cartRepo || new RedisCartRepository(redis!);
  const orderRepo = deps?.orderRepo || new PrismaOrderRepository(prisma!);
  const catalogValidation = deps?.catalogValidation || new GraphqlCatalogValidationAdapter(config.catalogInternalUrl);
  const serviceCallRepo = deps?.serviceCallRepo || new RedisServiceCallRepository(redis!);
  const eventPublisher = deps?.eventPublisher || new RedisEventPublisher(redis!);
  const paymentRepo = deps?.paymentRepo || new PrismaPaymentRepository(prisma!);
  const sessionService = deps?.sessionService || new HttpSessionServiceAdapter(config.sessionInternalUrl);
  const identitySettings =
    deps?.identitySettings || new HttpIdentitySettingsAdapter(config.identityInternalUrl);

  const cartUseCases = new CartUseCases(
    cartRepo,
    sessionService,
    catalogValidation,
    identitySettings
  );
  const orderUseCases = new OrderUseCases(
    orderRepo,
    cartRepo,
    catalogValidation,
    eventPublisher,
    sessionService,
    identitySettings
  );
  const serviceCallUseCases = new ServiceCallUseCases(
    serviceCallRepo,
    eventPublisher,
    sessionService
  );
  const invoiceProvider = deps?.invoiceProvider || new MocaInvoiceProvider();
  const checkoutUseCases = new CheckoutUseCases(
    orderRepo,
    paymentRepo,
    sessionService,
    cartRepo,
    serviceCallRepo,
    eventPublisher,
    invoiceProvider
  );

  // Protected routes require Gateway headers
  app.use(requireGatewayIdentity);

  app.use('/cart', createCartRouter(cartUseCases, orderUseCases));
  app.use('/orders', createOrdersRouter(orderUseCases));
  app.use('/service-calls', createServiceCallsRouter(serviceCallUseCases));
  app.use('/checkout', createCheckoutRouter(checkoutUseCases));

  app.use(errorHandler);

  return app;
}
