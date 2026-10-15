import { createOrderingApp } from '../../src/app';
import {
  InMemoryCartRepository,
  InMemoryOrderRepository,
  InMemoryCatalogValidationAdapter,
  InMemoryEventPublisher,
  InMemoryServiceCallRepository,
  InMemoryPaymentRepository,
  InMemorySessionServiceAdapter,
} from '../../src/infrastructure/fakes/InMemoryOrderingAdapters';
import { HttpSessionServiceAdapter } from '../../src/infrastructure/session/HttpSessionServiceAdapter';
import { config } from '../../src/config';

export const sharedCartRepo = new InMemoryCartRepository();
export const sharedOrderRepo = new InMemoryOrderRepository();
export const sharedCatalogValidation = new InMemoryCatalogValidationAdapter();
export const sharedServiceCallRepo = new InMemoryServiceCallRepository();
export const sharedEventPublisher = new InMemoryEventPublisher();
export const sharedPaymentRepo = new InMemoryPaymentRepository();
export const sharedSessionService = new InMemorySessionServiceAdapter({
  autoCreateActive: true,
  httpDelegate: new HttpSessionServiceAdapter(config.sessionInternalUrl),
});

export function createSeededOrderingTestApp() {

  sharedCatalogValidation.products = [
    {
      productId: 'prod-1',
      name: 'Tacos',
      price: 10,
      isAvailable: true,
      modifierGroups: [
        {
          groupId: 'g1',
          name: 'Salsa',
          minSelections: 0,
          maxSelections: 1,
          isRequired: false,
          options: [{ optionId: 'o1', name: 'Verde', priceDelta: 0 }],
        },
      ],
    },
  ];

  sharedOrderRepo.orders.push({
    id: 'order-other-session',
    tenantId: 'tenant-1',
    sessionId: 'session-other',
    tableId: 'table-other',
    status: 'PLACED',
    total: 50,
    items: [],
    createdAt: new Date().toISOString(),
  });

  sharedOrderRepo.orders.push({
    id: 'ord-realtime-test',
    tenantId: 't-1',
    sessionId: 's-1',
    tableId: 'tb-1',
    status: 'PLACED',
    total: 20,
    items: [],
    createdAt: new Date().toISOString(),
  });

  sharedOrderRepo.orders.push({
    id: 'ord-test',
    tenantId: 't-1',
    sessionId: 's-1',
    tableId: 'tb-1',
    status: 'PLACED',
    total: 20,
    items: [],
    createdAt: new Date().toISOString(),
  });

  sharedServiceCallRepo.calls.push({
    callId: 'call-to-resolve',
    tenantId: 't-1',
    sessionId: 's-1',
    tableId: 'tb-1',
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  sharedOrderRepo.orders.push({
    id: 'ord-checkout-test',
    tenantId: 't-1',
    sessionId: 'session-checkout-test',
    tableId: 'T-1',
    status: 'READY',
    total: 50,
    items: [],
    createdAt: new Date().toISOString(),
  });

  sharedOrderRepo.orders.push({
    id: 'ord-double-test',
    tenantId: 't-1',
    sessionId: 'session-double',
    tableId: 'T-2',
    status: 'READY',
    total: 60,
    items: [],
    createdAt: new Date().toISOString(),
  });

  sharedOrderRepo.orders.push({
    id: 'ord-guest-test',
    tenantId: 't-1',
    sessionId: 'session-guest',
    tableId: 'T-3',
    status: 'READY',
    total: 40,
    items: [],
    createdAt: new Date().toISOString(),
  });

  sharedOrderRepo.orders.push({
    id: 'ord-fail-test',
    tenantId: 't-1',
    sessionId: 'session-fail',
    tableId: 'T-4',
    status: 'READY',
    total: 40,
    items: [],
    createdAt: new Date().toISOString(),
  });

  sharedOrderRepo.orders.push({
    id: 'ord-smoke-e2e',
    tenantId: 't-smoke-e2e',
    sessionId: 's-smoke-e2e',
    tableId: 'M-1',
    status: 'READY',
    total: 35,
    items: [],
    createdAt: new Date().toISOString(),
  });

  return createOrderingApp({
    cartRepo: sharedCartRepo,
    orderRepo: sharedOrderRepo,
    catalogValidation: sharedCatalogValidation,
    serviceCallRepo: sharedServiceCallRepo,
    eventPublisher: sharedEventPublisher,
    paymentRepo: sharedPaymentRepo,
    sessionService: sharedSessionService,
  });
}
