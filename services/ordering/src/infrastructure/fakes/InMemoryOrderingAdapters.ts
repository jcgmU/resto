import {
  CartDTO,
  CartItemDTO,
  CartRepository,
  CatalogValidationPort,
  CheckoutCompletedEvent,
  EventPublisher,
  OrderDTO,
  OrderEvent,
  OrderHistoryEventDTO,
  OrderRepository,
  OrderStatus,
  PaymentDTO,
  PaymentRepository,
  ServiceCallDTO,
  ServiceCallEvent,
  ServiceCallRepository,
  ServiceCallStatus,
  SessionServicePort,
  TableSessionDTO,
  ValidatedProduct,
  computeOrderOverdue,
  IdentitySettingsPort,
  OperatingMode,
} from '@packages/shared-types';
import { canMergeCartLines } from '../../domain/merge';
import { ValidationError } from '../../domain/errors';

export class InMemoryCartRepository implements CartRepository {
  public carts = new Map<string, CartItemDTO[]>();

  private getCartKey(tenantId: string, sessionId: string): string {
    return `${tenantId}:${sessionId}`;
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
      items: [...items],
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

    const existingIndex = items.findIndex((i) =>
      canMergeCartLines(
        i.productId,
        (i.modifiers || []).map((m) => ({ groupId: m.groupId, optionId: m.optionId })),
        item.productId,
        (item.modifiers || []).map((m) => ({ groupId: m.groupId, optionId: m.optionId }))
      )
    );

    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      const newQuantity = existing.quantity + item.quantity;
      if (newQuantity > 99) {
        throw new ValidationError('La cantidad total por ítem no puede exceder 99');
      }
      existing.quantity = newQuantity;
      if (item.notes) existing.notes = item.notes;
      const deltas = (existing.modifiers || []).reduce((sum, m) => sum + (m.priceDelta || 0), 0);
      existing.lineTotal = (existing.unitPrice + deltas) * newQuantity;
    } else {
      if (item.quantity > 99) {
        throw new ValidationError('La cantidad total por ítem no puede exceder 99');
      }
      items.push(item);
    }

    this.carts.set(key, items);
    return this.get(tenantId, sessionId, _ttlSeconds);
  }

  async addItem(
    tenantId: string,
    sessionId: string,
    item: CartItemDTO,
    ttlSeconds: number
  ): Promise<CartDTO> {
    return this.upsertItem(tenantId, sessionId, item, ttlSeconds);
  }

  async takeSnapshot(tenantId: string, sessionId: string): Promise<CartDTO> {
    const cart = await this.get(tenantId, sessionId, 0);
    await this.clear(tenantId, sessionId);
    return cart;
  }

  async restoreCart(
    tenantId: string,
    sessionId: string,
    cart: CartDTO,
    _ttlSeconds: number
  ): Promise<void> {
    const key = this.getCartKey(tenantId, sessionId);
    this.carts.set(key, [...(cart.items || [])]);
  }

  async setQuantity(
    tenantId: string,
    sessionId: string,
    cartItemId: string,
    quantity: number,
    _ttlSeconds: number
  ): Promise<CartDTO> {
    const key = this.getCartKey(tenantId, sessionId);
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
    const items = this.carts.get(key) || [];
    const filtered = items.filter((i) => i.cartItemId !== cartItemId);
    this.carts.set(key, filtered);
    return this.get(tenantId, sessionId, _ttlSeconds);
  }

  async clear(tenantId: string, sessionId: string): Promise<void> {
    const key = this.getCartKey(tenantId, sessionId);
    this.carts.delete(key);
  }
}

export class InMemoryOrderRepository implements OrderRepository {
  public orders: OrderDTO[] = [];
  public statusEvents: OrderHistoryEventDTO[] = [];

  private mapOrder(order: OrderDTO): OrderDTO {
    const copy: OrderDTO = JSON.parse(JSON.stringify(order));
    copy.delayMinutes = copy.delayMinutes ?? 0;
    copy.overdue = computeOrderOverdue(copy);
    return copy;
  }

  async save(tenantId: string, order: OrderDTO): Promise<OrderDTO> {
    const mapped = this.mapOrder(order);
    mapped.tenantId = tenantId;
    this.orders.push(mapped);
    return JSON.parse(JSON.stringify(mapped));
  }

  async findById(tenantId: string, id: string): Promise<OrderDTO | null> {
    const found = this.orders.find((o) => o.tenantId === tenantId && o.id === id);
    return found ? this.mapOrder(found) : null;
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
    return result.map((o) => this.mapOrder(o));
  }

  async listBySession(tenantId: string, sessionId: string): Promise<OrderDTO[]> {
    const result = this.orders.filter(
      (o) => o.tenantId === tenantId && o.sessionId === sessionId
    );
    return result.map((o) => this.mapOrder(o));
  }

  async cancel(tenantId: string, id: string, cancelledAt: Date): Promise<OrderDTO> {
    const order = this.orders.find((o) => o.tenantId === tenantId && o.id === id);
    if (!order) {
      throw new Error(`Order ${id} not found`);
    }
    const fromStatus = order.status;
    order.status = 'CANCELLED';
    order.cancelledAt = cancelledAt.toISOString();

    this.statusEvents.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderId: id,
      fromStatus,
      toStatus: 'CANCELLED',
      occurredAt: cancelledAt.toISOString(),
    });

    return this.mapOrder(order);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: OrderStatus,
    updatedAt: Date
  ): Promise<OrderDTO> {
    const order = this.orders.find((o) => o.tenantId === tenantId && o.id === id);
    if (!order) {
      throw new Error(`Order ${id} not found`);
    }
    const fromStatus = order.status;
    order.status = status;

    this.statusEvents.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderId: id,
      fromStatus,
      toStatus: status,
      occurredAt: updatedAt.toISOString(),
    });

    return this.mapOrder(order);
  }

  async updateDelay(tenantId: string, id: string, delayMinutes: number): Promise<OrderDTO> {
    const order = this.orders.find((o) => o.tenantId === tenantId && o.id === id);
    if (!order) {
      throw new Error(`Order ${id} not found`);
    }
    order.delayMinutes = delayMinutes;
    return this.mapOrder(order);
  }

  async getOrderHistory(tenantId: string, orderId: string): Promise<OrderHistoryEventDTO[]> {
    const order = this.orders.find((o) => o.tenantId === tenantId && o.id === orderId);
    if (!order) {
      return [];
    }
    return this.statusEvents.filter((e) => e.orderId === orderId);
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
  public sessions = new Map<string, TableSessionDTO>();
  public shouldFail = false;
  public autoCreateActive = true;
  public httpDelegate?: SessionServicePort;

  constructor(options?: { autoCreateActive?: boolean; httpDelegate?: SessionServicePort }) {
    if (options?.autoCreateActive !== undefined) {
      this.autoCreateActive = options.autoCreateActive;
    }
    this.httpDelegate = options?.httpDelegate;
  }

  setSession(session: TableSessionDTO): void {
    this.sessions.set(`${session.tenantId}:${session.sessionId}`, JSON.parse(JSON.stringify(session)));
  }

  async getSession(tenantId: string, sessionId: string): Promise<TableSessionDTO | null> {
    if (this.shouldFail) {
      throw new Error('Session service unavailable');
    }
    const key = `${tenantId}:${sessionId}`;
    if (this.sessions.has(key)) {
      return JSON.parse(JSON.stringify(this.sessions.get(key)!));
    }
    if (this.autoCreateActive) {
      return {
        tenantId,
        sessionId,
        tableId: '*',
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
    }
    return null;
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
    const key = `${tenantId}:${sessionId}`;
    const session = this.sessions.get(key);
    if (session) {
      session.status = 'closed';
      this.sessions.set(key, session);
    }
    if (this.httpDelegate) {
      await this.httpDelegate.closeSession(tenantId, sessionId, requester);
    }
  }
}

export class InMemoryIdentitySettingsAdapter implements IdentitySettingsPort {
  public modes = new Map<string, OperatingMode>();

  setOperatingMode(tenantId: string, mode: OperatingMode): void {
    this.modes.set(tenantId, mode);
  }

  async getOperatingMode(tenantId: string): Promise<OperatingMode> {
    return this.modes.get(tenantId) || 'hybrid';
  }
}


