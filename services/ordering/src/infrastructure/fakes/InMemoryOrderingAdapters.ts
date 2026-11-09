import {
  CartDTO,
  CartItemDTO,
  CartRepository,
  CatalogValidationPort,
  CheckoutCompletedEvent,
  EventPublisher,
  OrderDTO,
  OrderEvent,
  OrderRepository,
  OrderStatus,
  PaymentDTO,
  PaymentRepository,
  ServiceCallDTO,
  ServiceCallEvent,
  ServiceCallRepository,
  ServiceCallStatus,
  SessionServicePort,
  ValidatedProduct,
} from '@packages/shared-types';
import {
  CartReservation,
  CartReservationPort,
  OrderReservationFencePort,
  ReservationFenceStatus,
} from '../../application/ports/CartReservationPort';
import { canMergeCartLines } from '../../domain/merge';
import { CartBusyError, ValidationError } from '../../domain/errors';

export class InMemoryCartRepository implements CartRepository, CartReservationPort {
  public carts = new Map<string, CartItemDTO[]>();
  public reservations = new Map<string, CartReservation>();
  public leases = new Map<string, number>();

  private getCartKey(tenantId: string, sessionId: string): string {
    return `${tenantId}:${sessionId}`;
  }

  private getLeaseKey(tenantId: string, sessionId: string, operationId: string): string {
    return `${tenantId}:${sessionId}:${operationId}`;
  }

  private calculateTotal(items: CartItemDTO[]): number {
    const totalCents = items.reduce((sum, item) => {
      const deltas = (item.modifiers || []).reduce(
        (dSum, m) => dSum + Math.round((m.priceDelta || 0) * 100),
        0
      );
      const unitCents = Math.round(item.unitPrice * 100);
      return sum + (unitCents + deltas) * item.quantity;
    }, 0);
    return totalCents / 100;
  }

  async get(tenantId: string, sessionId: string, _ttlSeconds: number): Promise<CartDTO> {
    const key = this.getCartKey(tenantId, sessionId);
    const items = this.carts.get(key) || [];
    return {
      tenantId,
      sessionId,
      items: JSON.parse(JSON.stringify(items)),
      total: this.calculateTotal(items),
    };
  }

  async upsertItem(
    tenantId: string,
    sessionId: string,
    item: CartItemDTO,
    _ttlSeconds: number
  ): Promise<CartDTO> {
    const key = this.getCartKey(tenantId, sessionId);
    const items = this.carts.get(key) || [];
    const index = items.findIndex((i) => i.cartItemId === item.cartItemId);
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
    this.carts.set(key, items);
    return this.get(tenantId, sessionId, _ttlSeconds);
  }

  async addItemAtomic(
    tenantId: string,
    sessionId: string,
    _canonicalKey: string,
    item: CartItemDTO,
    inputQuantity: number,
    maxQuantity: number,
    ttlSeconds: number
  ): Promise<{ cart: CartDTO; mergedQuantity: number }> {
    const key = this.getCartKey(tenantId, sessionId);
    const items = this.carts.get(key) || [];

    const existing = items.find((line) =>
      canMergeCartLines(
        line.productId,
        line.modifiers.map((m) => ({ groupId: m.groupId, optionId: m.optionId })),
        item.productId,
        item.modifiers.map((m) => ({ groupId: m.groupId, optionId: m.optionId }))
      )
    );

    if (existing) {
      const newQty = existing.quantity + inputQuantity;
      if (newQty > maxQuantity) {
        throw new ValidationError(
          `La cantidad acumulada (${newQty}) supera el límite máximo permitido de ${maxQuantity} unidades`
        );
      }
      existing.quantity = newQty;
      const deltas = (existing.modifiers || []).reduce((sum, m) => sum + (m.priceDelta || 0), 0);
      existing.lineTotal = (existing.unitPrice + deltas) * newQty;
      this.carts.set(key, items);
      const cart = await this.get(tenantId, sessionId, ttlSeconds);
      return { cart, mergedQuantity: newQty };
    }

    if (inputQuantity > maxQuantity) {
      throw new ValidationError(
        `La cantidad acumulada (${inputQuantity}) supera el límite máximo permitido de ${maxQuantity} unidades`
      );
    }

    items.push(item);
    this.carts.set(key, items);
    const cart = await this.get(tenantId, sessionId, ttlSeconds);
    return { cart, mergedQuantity: inputQuantity };
  }

  async reserveCart(
    tenantId: string,
    sessionId: string,
    operationId: string,
    orderId: string,
    _ttlSeconds: number
  ): Promise<{
    status: 'RESERVED' | 'EXISTING_RESERVATION' | 'EMPTY';
    reservation?: CartReservation;
  }> {
    const key = this.getCartKey(tenantId, sessionId);
    if (this.reservations.has(key)) {
      return { status: 'EXISTING_RESERVATION' };
    }

    const items = this.carts.get(key) || [];
    if (items.length === 0) {
      return { status: 'EMPTY' };
    }

    const reservation: CartReservation = {
      operationId,
      orderId,
      tenantId,
      sessionId,
      items: JSON.parse(JSON.stringify(items)),
      createdAt: new Date().toISOString(),
    };

    this.reservations.set(key, reservation);
    this.carts.delete(key);
    this.leases.set(this.getLeaseKey(tenantId, sessionId, operationId), Date.now() + 30000);

    return { status: 'RESERVED', reservation };
  }

  async isReservationLeaseActive(
    tenantId: string,
    sessionId: string,
    operationId: string
  ): Promise<boolean> {
    const expiresAt = this.leases.get(this.getLeaseKey(tenantId, sessionId, operationId));
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.leases.delete(this.getLeaseKey(tenantId, sessionId, operationId));
      return false;
    }
    return true;
  }

  async refreshReservationLease(
    tenantId: string,
    sessionId: string,
    operationId: string
  ): Promise<boolean> {
    const key = this.getLeaseKey(tenantId, sessionId, operationId);
    const expiresAt = this.leases.get(key);
    if (!expiresAt || Date.now() > expiresAt) {
      this.leases.delete(key);
      return false;
    }
    this.leases.set(key, Date.now() + 30000);
    return true;
  }

  async releaseReservationLease(
    tenantId: string,
    sessionId: string,
    operationId: string
  ): Promise<void> {
    this.leases.delete(this.getLeaseKey(tenantId, sessionId, operationId));
  }

  async findReservation(tenantId: string, sessionId: string): Promise<CartReservation | null> {
    const key = this.getCartKey(tenantId, sessionId);
    const res = this.reservations.get(key);
    return res ? JSON.parse(JSON.stringify(res)) : null;
  }

  async ackReservation(tenantId: string, sessionId: string, operationId?: string): Promise<void> {
    const key = this.getCartKey(tenantId, sessionId);
    const current = this.reservations.get(key);
    if (!current) return;
    if (!operationId || current.operationId === operationId) {
      this.reservations.delete(key);
      if (current.operationId) {
        this.leases.delete(this.getLeaseKey(tenantId, sessionId, current.operationId));
      }
      if (operationId) {
        this.leases.delete(this.getLeaseKey(tenantId, sessionId, operationId));
      }
    }
  }

  async restoreReservation(
    tenantId: string,
    sessionId: string,
    operationId: string,
    _ttlSeconds: number,
    options?: { requireExpiredLease?: boolean }
  ): Promise<{
    status: 'RESTORED' | 'NOT_FOUND' | 'CONFLICT' | 'ACTIVE';
    maxExceededQty?: number;
  }> {
    if (options?.requireExpiredLease) {
      const active = await this.isReservationLeaseActive(tenantId, sessionId, operationId);
      if (active) {
        return { status: 'ACTIVE' };
      }
    }

    const key = this.getCartKey(tenantId, sessionId);
    const res = this.reservations.get(key);
    if (!res || (operationId && res.operationId !== operationId)) {
      return { status: 'NOT_FOUND' };
    }

    const liveItems = this.carts.get(key) || [];

    // Pass 1: conflict check
    for (const rItem of res.items) {
      const match = liveItems.find(
        (l) =>
          l.cartItemId === rItem.cartItemId ||
          canMergeCartLines(
            l.productId,
            l.modifiers.map((m) => ({ groupId: m.groupId, optionId: m.optionId })),
            rItem.productId,
            rItem.modifiers.map((m) => ({ groupId: m.groupId, optionId: m.optionId }))
          )
      );
      if (match) {
        const sum = match.quantity + rItem.quantity;
        if (sum > 99) {
          return { status: 'CONFLICT', maxExceededQty: sum };
        }
      }
    }

    // Pass 2: merge or insert
    for (const rItem of res.items) {
      const match = liveItems.find(
        (l) =>
          l.cartItemId === rItem.cartItemId ||
          canMergeCartLines(
            l.productId,
            l.modifiers.map((m) => ({ groupId: m.groupId, optionId: m.optionId })),
            rItem.productId,
            rItem.modifiers.map((m) => ({ groupId: m.groupId, optionId: m.optionId }))
          )
      );
      if (match) {
        match.quantity += rItem.quantity;
        const deltas = (match.modifiers || []).reduce((sum, m) => sum + (m.priceDelta || 0), 0);
        match.lineTotal = (match.unitPrice + deltas) * match.quantity;
      } else {
        liveItems.push(JSON.parse(JSON.stringify(rItem)));
      }
    }

    this.carts.set(key, liveItems);
    this.reservations.delete(key);
    this.leases.delete(this.getLeaseKey(tenantId, sessionId, operationId));

    return { status: 'RESTORED' };
  }

  async setQuantity(
    tenantId: string,
    sessionId: string,
    cartItemId: string,
    quantity: number,
    _ttlSeconds: number
  ): Promise<CartDTO> {
    const key = this.getCartKey(tenantId, sessionId);
    const res = this.reservations.get(key);
    if (res && res.items.some((i) => i.cartItemId === cartItemId)) {
      throw new CartBusyError();
    }

    const items = this.carts.get(key) || [];
    const item = items.find((i) => i.cartItemId === cartItemId);
    if (item) {
      if (quantity <= 0) {
        return this.removeItem(tenantId, sessionId, cartItemId, _ttlSeconds);
      }
      item.quantity = quantity;
      const deltas = (item.modifiers || []).reduce((sum, m) => sum + (m.priceDelta || 0), 0);
      item.lineTotal = (item.unitPrice + deltas) * quantity;
    }
    return this.get(tenantId, sessionId, _ttlSeconds);
  }

  async removeItem(
    tenantId: string,
    sessionId: string,
    cartItemId: string,
    _ttlSeconds: number
  ): Promise<CartDTO> {
    const key = this.getCartKey(tenantId, sessionId);
    const res = this.reservations.get(key);
    if (res && res.items.some((i) => i.cartItemId === cartItemId)) {
      throw new CartBusyError();
    }

    const items = this.carts.get(key) || [];
    const filtered = items.filter((i) => i.cartItemId !== cartItemId);
    this.carts.set(key, filtered);
    return this.get(tenantId, sessionId, _ttlSeconds);
  }

  async clear(tenantId: string, sessionId: string): Promise<void> {
    const key = this.getCartKey(tenantId, sessionId);
    this.carts.delete(key);
  }

  async clearAll(tenantId: string, sessionId: string): Promise<void> {
    const key = this.getCartKey(tenantId, sessionId);
    this.carts.delete(key);
    this.reservations.delete(key);
    const prefix = `${tenantId}:${sessionId}:`;
    for (const leaseKey of this.leases.keys()) {
      if (leaseKey.startsWith(prefix)) {
        this.leases.delete(leaseKey);
      }
    }
  }

  public outbox = new Map<string, { status: 'PENDING' | 'PUBLISHED'; payload: any; createdAt: string; updatedAt: string }>();
  public completedCheckouts = new Set<string>();
  public consumedEvents = new Set<string>();

  async ensureCheckoutOutboxPending(
    tenantId: string,
    sessionId: string,
    payload: any
  ): Promise<{ status: 'PENDING' | 'PUBLISHED'; payload: any }> {
    const key = `${tenantId}:${sessionId}`;
    const existing = this.outbox.get(key);
    if (existing) {
      return { status: existing.status, payload: existing.payload };
    }
    const now = new Date().toISOString();
    const doc = {
      status: 'PENDING' as const,
      payload,
      createdAt: now,
      updatedAt: now,
    };
    this.outbox.set(key, doc);
    return { status: 'PENDING', payload };
  }

  async isCheckoutEventPublished(tenantId: string, sessionId: string): Promise<boolean> {
    const key = `${tenantId}:${sessionId}`;
    const existing = this.outbox.get(key);
    if (existing) {
      return existing.status === 'PUBLISHED';
    }
    return this.completedCheckouts.has(key);
  }

  async markCheckoutCompleted(tenantId: string, sessionId: string): Promise<boolean> {
    const key = `${tenantId}:${sessionId}`;
    const now = new Date().toISOString();
    const existing = this.outbox.get(key);
    this.outbox.set(key, {
      status: 'PUBLISHED',
      payload: existing?.payload || {},
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    if (this.completedCheckouts.has(key)) {
      return false;
    }
    this.completedCheckouts.add(key);
    return true;
  }

  async consumeCheckoutEventOnce(eventId: string): Promise<boolean> {
    if (this.consumedEvents.has(eventId)) {
      return false;
    }
    this.consumedEvents.add(eventId);
    return true;
  }
}

export class InMemoryOrderRepository implements OrderRepository, OrderReservationFencePort {
  public orders: OrderDTO[] = [];
  public reservationFences = new Map<
    string,
    { status: ReservationFenceStatus; tenantId: string; sessionId: string; orderId: string }
  >();

  async claimReservationFence(
    tenantId: string,
    sessionId: string,
    operationId: string,
    orderId: string,
    _tx?: any
  ): Promise<ReservationFenceStatus> {
    const existing = this.reservationFences.get(operationId);
    if (!existing) {
      this.reservationFences.set(operationId, {
        status: 'COMMITTED',
        tenantId,
        sessionId,
        orderId,
      });
      return 'COMMITTED';
    }
    return existing.status;
  }

  async abortReservationFence(
    tenantId: string,
    sessionId: string,
    operationId: string,
    orderId: string,
    _tx?: any
  ): Promise<ReservationFenceStatus> {
    const existingOrder = await this.findById(tenantId, orderId);
    if (existingOrder) {
      return 'COMMITTED';
    }
    const existingFence = this.reservationFences.get(operationId);
    if (!existingFence) {
      this.reservationFences.set(operationId, {
        status: 'ABORTED',
        tenantId,
        sessionId,
        orderId,
      });
      return 'ABORTED';
    }
    return existingFence.status;
  }

  async save(tenantId: string, order: OrderDTO): Promise<OrderDTO> {
    const copy: OrderDTO = JSON.parse(JSON.stringify(order));
    copy.tenantId = tenantId;
    this.orders.push(copy);
    return JSON.parse(JSON.stringify(copy));
  }

  async findById(tenantId: string, id: string): Promise<OrderDTO | null> {
    const found = this.orders.find((o) => o.tenantId === tenantId && o.id === id);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: OrderStatus; tableId?: string }
  ): Promise<OrderDTO[]> {
    let result = this.orders.filter((o) => o.tenantId === tenantId);
    if (filter?.status) {
      result = result.filter((o) => o.status === filter.status);
    }
    if (filter?.tableId) {
      result = result.filter((o) => o.tableId === filter.tableId);
    }
    return JSON.parse(JSON.stringify(result));
  }

  async listBySession(tenantId: string, sessionId: string): Promise<OrderDTO[]> {
    const result = this.orders.filter(
      (o) => o.tenantId === tenantId && o.sessionId === sessionId
    );
    return JSON.parse(JSON.stringify(result));
  }

  async cancel(tenantId: string, id: string, cancelledAt: Date): Promise<OrderDTO> {
    const order = this.orders.find((o) => o.tenantId === tenantId && o.id === id);
    if (!order) {
      throw new Error(`Order ${id} not found`);
    }
    order.status = 'CANCELLED';
    order.cancelledAt = cancelledAt.toISOString();
    return JSON.parse(JSON.stringify(order));
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: OrderStatus,
    _updatedAt: Date
  ): Promise<OrderDTO> {
    const order = this.orders.find((o) => o.tenantId === tenantId && o.id === id);
    if (!order) {
      throw new Error(`Order ${id} not found`);
    }
    order.status = status;
    return JSON.parse(JSON.stringify(order));
  }
}

export class InMemoryEventPublisher implements EventPublisher {
  public orderEvents: { tenantId: string; event: OrderEvent }[] = [];
  public serviceCallEvents: { tenantId: string; event: ServiceCallEvent }[] = [];
  public checkoutCompletedEvents: { tenantId: string; event: CheckoutCompletedEvent }[] = [];

  async publishOrderEvent(tenantId: string, event: OrderEvent): Promise<void> {
    this.orderEvents.push({ tenantId, event });
  }

  async publishServiceCallEvent(tenantId: string, event: ServiceCallEvent): Promise<void> {
    this.serviceCallEvents.push({ tenantId, event });
  }

  async publishCheckoutCompleted(tenantId: string, event: CheckoutCompletedEvent): Promise<void> {
    this.checkoutCompletedEvents.push({ tenantId, event });
  }

  clear(): void {
    this.orderEvents = [];
    this.serviceCallEvents = [];
    this.checkoutCompletedEvents = [];
  }
}

export class InMemoryServiceCallRepository implements ServiceCallRepository {
  public calls: ServiceCallDTO[] = [];

  async save(tenantId: string, call: ServiceCallDTO, _ttlSeconds: number): Promise<ServiceCallDTO> {
    const copy = JSON.parse(JSON.stringify(call));
    copy.tenantId = tenantId;
    const idx = this.calls.findIndex((c) => c.tenantId === tenantId && c.callId === call.callId);
    if (idx >= 0) {
      this.calls[idx] = copy;
    } else {
      this.calls.push(copy);
    }
    return JSON.parse(JSON.stringify(copy));
  }

  async findById(tenantId: string, callId: string): Promise<ServiceCallDTO | null> {
    const found = this.calls.find((c) => c.tenantId === tenantId && c.callId === callId);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async listByTenant(
    tenantId: string,
    filter?: { status?: ServiceCallStatus }
  ): Promise<ServiceCallDTO[]> {
    let result = this.calls.filter((c) => c.tenantId === tenantId);
    if (filter?.status) {
      result = result.filter((c) => c.status === filter.status);
    }
    return JSON.parse(JSON.stringify(result));
  }

  async resolve(tenantId: string, callId: string, resolvedAt: Date): Promise<ServiceCallDTO> {
    const call = this.calls.find((c) => c.tenantId === tenantId && c.callId === callId);
    if (!call) {
      throw new Error(`ServiceCall ${callId} not found`);
    }
    call.status = 'resolved';
    call.resolvedAt = resolvedAt.toISOString();
    return JSON.parse(JSON.stringify(call));
  }
}

export class InMemoryCatalogValidationAdapter implements CatalogValidationPort {
  public products: ValidatedProduct[] = [];

  async getOrderableProducts(_tenantId: string, productIds: string[]): Promise<ValidatedProduct[]> {
    return this.products.filter((p) => productIds.includes(p.productId));
  }
}

export class InMemoryPaymentRepository implements PaymentRepository {
  public payments: PaymentDTO[] = [];

  async save(tenantId: string, payment: PaymentDTO): Promise<PaymentDTO> {
    const existing = this.payments.find(
      (p) => p.tenantId === tenantId && p.sessionId === payment.sessionId
    );
    if (existing) {
      const err: any = new Error('Unique constraint violation: tenantId and sessionId');
      err.code = 'P2002';
      throw err;
    }
    const copy: PaymentDTO = { ...payment, tenantId };
    this.payments.push(copy);
    return JSON.parse(JSON.stringify(copy));
  }

  async findBySession(tenantId: string, sessionId: string): Promise<PaymentDTO | null> {
    const found = this.payments.find(
      (p) => p.tenantId === tenantId && p.sessionId === sessionId
    );
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }
}

export class InMemorySessionServiceAdapter implements SessionServicePort {
  public closedSessions: { tenantId: string; sessionId: string; requester: { userId: string; role: string } }[] = [];
  public sessions = new Map<string, { sessionId: string; tenantId: string; tableId?: string; status: 'active' | 'closed' }>();
  public shouldFail = false;

  async getSession(tenantId: string, sessionId: string) {
    const isClosed = this.closedSessions.some((c) => c.sessionId === sessionId);
    const existing = this.sessions.get(`${tenantId}:${sessionId}`);
    if (existing) {
      return {
        ...existing,
        status: isClosed ? 'closed' : existing.status,
      };
    }
    return {
      sessionId,
      tenantId,
      status: isClosed ? ('closed' as const) : ('active' as const),
    };
  }

  async closeSession(
    tenantId: string,
    sessionId: string,
    requester: { userId: string; role: string }
  ): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Session service unavailable');
    }
    this.closedSessions.push({ tenantId, sessionId, requester });
    const existing = this.sessions.get(`${tenantId}:${sessionId}`);
    if (existing) {
      existing.status = 'closed';
    }
  }
}

