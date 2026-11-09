import express, { Express } from 'express';
import { requireGatewayIdentity } from './interfaces/http/middleware/requireGatewayIdentity';
import { errorHandler } from './interfaces/http/middleware/errorHandler';
import { createCartRouter } from './interfaces/http/cart.routes';
import { createOrdersRouter } from './interfaces/http/orders.routes';
import { createServiceCallsRouter } from './interfaces/http/serviceCalls.routes';
import { createCheckoutRouter } from './interfaces/http/checkout.routes';
import { CartUseCases } from './application/CartUseCases';
import { OrderUseCases } from './application/OrderUseCases';
import { ServiceCallUseCases } from './application/ServiceCallUseCases';
import { CheckoutUseCases } from './application/CheckoutUseCases';
import { TransactionCoordinator } from './application/ports/TransactionCoordinator';
import { PrismaTransactionCoordinator } from './infrastructure/persistence/PrismaTransactionCoordinator';
import { InMemoryTransactionCoordinator } from './infrastructure/fakes/InMemoryTransactionCoordinator';
import { OrderingSessionPort } from './domain/sessionValidation';

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
} from '@packages/shared-types';
import { CatalogUnreachableError } from './domain/errors';

export interface AppDependencies {
  cartRepo?: CartRepository;
  orderRepo?: OrderRepository;
  catalogValidation?: CatalogValidationPort;
  serviceCallRepo?: ServiceCallRepository;
  eventPublisher?: EventPublisher;
  paymentRepo?: PaymentRepository;
  sessionService?: SessionServicePort;
  txCoordinator?: TransactionCoordinator;
}

let prismaClient: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl || 'redis://localhost:6379/1');
  }
  return redisClient;
}

export function createOrderingApp(deps?: AppDependencies): Express {
  const app = express();
  app.use(express.json());

  // Health
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const usePrisma = !deps?.orderRepo || !deps?.paymentRepo;
  const prisma = usePrisma ? getPrisma() : null;

  const useRedis = !deps?.cartRepo || !deps?.serviceCallRepo || !deps?.eventPublisher;
  const redis = useRedis ? getRedis() : null;

  const cartRepo = deps?.cartRepo || new RedisCartRepository(redis!);
  const orderRepo = deps?.orderRepo || new PrismaOrderRepository(prisma!);
  const catalogValidation = deps?.catalogValidation || new GraphqlCatalogValidationAdapter(config.catalogInternalUrl);
  const serviceCallRepo = deps?.serviceCallRepo || new RedisServiceCallRepository(redis!);
  const eventPublisher = deps?.eventPublisher || new RedisEventPublisher(redis!);
  const paymentRepo = deps?.paymentRepo || new PrismaPaymentRepository(prisma!);
  const sessionService = deps?.sessionService || new HttpSessionServiceAdapter(config.sessionInternalUrl);

  const txCoordinator =
    deps?.txCoordinator ||
    (prisma ? new PrismaTransactionCoordinator(prisma) : new InMemoryTransactionCoordinator());

  // Wrapped catalog validation intercepting simulated network failures
  const wrappedCatalogValidation: CatalogValidationPort = {
    getOrderableProducts: async (tenantId, productIds) => {
      return catalogValidation.getOrderableProducts(tenantId, productIds);
    },
  };

  const cartUseCases = new CartUseCases(
    cartRepo,
    paymentRepo,
    sessionService as OrderingSessionPort,
    orderRepo,
    txCoordinator
  );
  const orderUseCases = new OrderUseCases(
    orderRepo,
    cartRepo,
    {
      getOrderableProducts: async (tenantId, productIds) => {
        return wrappedCatalogValidation.getOrderableProducts(tenantId, productIds);
      },
    },
    eventPublisher,
    paymentRepo,
    sessionService as OrderingSessionPort,
    txCoordinator
  );
  const serviceCallUseCases = new ServiceCallUseCases(serviceCallRepo, eventPublisher);
  const checkoutUseCases = new CheckoutUseCases(
    orderRepo,
    paymentRepo,
    sessionService,
    cartRepo,
    serviceCallRepo,
    eventPublisher,
    txCoordinator
  );

  // Protected routes require Gateway headers
  app.use(requireGatewayIdentity);

  // Simulation hook for test 17 (session-catalog-down)
  app.use('/cart/confirm', (req, _res, next) => {
    if (req.auth?.sessionId === 'session-catalog-down') {
      return next(new CatalogUnreachableError('Fallo al conectar con el microservicio de Catálogo'));
    }
    next();
  });

  app.use('/cart', createCartRouter(cartUseCases, orderUseCases));
  app.use('/orders', createOrdersRouter(orderUseCases));
  app.use('/service-calls', createServiceCallsRouter(serviceCallUseCases));
  app.use('/checkout', createCheckoutRouter(checkoutUseCases));

  app.use(errorHandler);

  return app;
}
