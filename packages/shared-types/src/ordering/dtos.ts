export interface CartModifierInput {
  groupId: string;
  optionId: string;
}

export interface CartItemModifierDTO {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItemDTO {
  cartItemId: string;
  productId: string;
  productName: string;
  unitPrice: number;
  modifiers: CartItemModifierDTO[];
  quantity: number;
  notes?: string;
  destination?: 'kitchen' | 'bar';
  addedBy?: string;
  addedAt: string;
  lineTotal: number;
}

export interface CartDTO {
  tenantId: string;
  sessionId: string;
  items: CartItemDTO[];
  total: number;
}

export interface OrderModifierDTO {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface OrderItemDTO {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  destination?: 'kitchen' | 'bar';
  modifiers: OrderModifierDTO[];
}

export type OrderStatus = 'PLACED' | 'IN_KITCHEN' | 'READY' | 'DELIVERED' | 'CANCELLED';

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PLACED: ['IN_KITCHEN', 'CANCELLED'],
  IN_KITCHEN: ['READY', 'CANCELLED'],
  READY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export interface OrderHistoryEventDTO {
  id: string;
  orderId: string;
  fromStatus: string;
  toStatus: string;
  occurredAt: string;
}

export function computeEffectiveSlaMinutes(
  order: {
    estimatedMinutes?: number | null;
    delayMinutes?: number | null;
  },
  defaultSlaMinutes: number = 18
): number {
  const baseMinutes = order.estimatedMinutes ?? defaultSlaMinutes;
  return baseMinutes + (order.delayMinutes || 0);
}

export function computeOrderOverdue(
  order: {
    status: OrderStatus;
  kitchenStatus?: OrderStatus;
  barStatus?: OrderStatus;
  destinationStatus?: { kitchen?: OrderStatus; bar?: OrderStatus };
    createdAt: string | Date;
    estimatedMinutes?: number | null;
    delayMinutes?: number | null;
  },
  now: number = Date.now(),
  defaultSlaMinutes?: number
): boolean {
  const activeStatuses: OrderStatus[] = ['PLACED', 'IN_KITCHEN', 'READY'];
  if (!activeStatuses.includes(order.status)) {
    return false;
  }
  const baseMinutes = order.estimatedMinutes ?? defaultSlaMinutes;
  if (baseMinutes == null) {
    return false;
  }
  const createdTime =
    order.createdAt instanceof Date ? order.createdAt.getTime() : new Date(order.createdAt).getTime();
  const totalMinutes = baseMinutes + (order.delayMinutes || 0);
  const allowedMs = totalMinutes * 60000;
  return now - createdTime > allowedMs;
}

export interface OrderDTO {
  id: string;
  tenantId: string;
  sessionId: string;
  tableId: string;
  status: OrderStatus;
  kitchenStatus?: OrderStatus;
  barStatus?: OrderStatus;
  destinationStatus?: { kitchen?: OrderStatus; bar?: OrderStatus };
  total: number;
  items: OrderItemDTO[];
  notes?: string;
  destination?: 'kitchen' | 'bar';
  estimatedMinutes?: number;
  delayMinutes?: number;
  overdue?: boolean;
  createdAt: string;
  invoiceStatus?: InvoiceStatus;
  invoiceRef?: string;
  invoiceError?: string;
  cancelledAt?: string;
}

export type OrderEventType = 'order.created' | 'order.status-changed';
export interface OrderEvent {
  type: OrderEventType;
  order: OrderDTO;
  previousStatus?: OrderStatus;
  destination?: 'kitchen' | 'bar';
  occurredAt: string;
}

export type ServiceCallStatus = 'pending' | 'resolved';
export type ServiceCallType = 'WAITER_CALL' | 'BILL_REQUEST' | 'GENERIC';

export interface ServiceCallDTO {
  callId: string;
  tenantId: string;
  sessionId: string;
  tableId: string;
  type?: ServiceCallType;
  note?: string;
  status: ServiceCallStatus;
  createdAt: string;
  resolvedAt?: string;
}

export type ServiceCallEventType = 'service-call.created' | 'service-call.resolved';
export interface ServiceCallEvent {
  type: ServiceCallEventType;
  call: ServiceCallDTO;
  occurredAt: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'OTHER';

export type InvoiceStatus = 'none' | 'pending' | 'issued' | 'error';

export interface PaymentDTO {
  id: string;
  tenantId: string;
  sessionId: string;
  tableId: string;
  amount: number;
  method: PaymentMethod;
  ordersCount: number;
  recordedBy: string;
  createdAt: string;
  invoiceStatus?: InvoiceStatus;
  invoiceRef?: string;
  invoiceError?: string;
}

export interface BillDTO {
  sessionId: string;
  tableId: string;
  orders: OrderDTO[];
  ordersCount: number;
  total: number;
  payment: PaymentDTO | null;
}

export interface CheckoutCompletedEvent {
  type: 'session.checkout-completed';
  sessionId: string;
  tableId: string;
  payment: PaymentDTO;
  occurredAt: string;
}

