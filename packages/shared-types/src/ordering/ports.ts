import { UseCase } from '../common/UseCase';
import {
  CartDTO,
  CartItemDTO,
  CartModifierInput,
  BillDTO,
  CheckoutCompletedEvent,
  OrderDTO,
  OrderEvent,
  OrderHistoryEventDTO,
  OrderStatus,
  PaymentDTO,
  PaymentMethod,
  ServiceCallDTO,
  ServiceCallEvent,
  ServiceCallStatus,
  ServiceCallType,
} from './dtos';
import { TableSessionDTO } from '../session/dtos';

export interface CartRepository {
  get(tenantId: string, sessionId: string, ttlSeconds: number): Promise<CartDTO>;
  upsertItem(tenantId: string, sessionId: string, item: CartItemDTO, ttlSeconds: number): Promise<CartDTO>;
  addItem?(tenantId: string, sessionId: string, item: CartItemDTO, ttlSeconds: number): Promise<CartDTO>;
  setQuantity(tenantId: string, sessionId: string, cartItemId: string, quantity: number, ttlSeconds: number): Promise<CartDTO>;
  removeItem(tenantId: string, sessionId: string, cartItemId: string, ttlSeconds: number): Promise<CartDTO>;
  clear(tenantId: string, sessionId: string): Promise<void>;
  takeSnapshot?(tenantId: string, sessionId: string): Promise<CartDTO>;
  restoreCart?(tenantId: string, sessionId: string, cart: CartDTO, ttlSeconds: number): Promise<void>;
}

export interface OrderRepository {
  save(tenantId: string, order: OrderDTO): Promise<OrderDTO>;
  findById(tenantId: string, id: string): Promise<OrderDTO | null>;
  listByTenant(tenantId: string, filter?: { status?: OrderStatus; tableId?: string }): Promise<OrderDTO[]>;
  listBySession(tenantId: string, sessionId: string): Promise<OrderDTO[]>;
  cancel(tenantId: string, id: string, cancelledAt: Date): Promise<OrderDTO>;
  updateStatus(tenantId: string, id: string, status: OrderStatus, updatedAt: Date, destMeta?: { kitchenStatus?: OrderStatus; barStatus?: OrderStatus }): Promise<OrderDTO>;
  updateDelay?(tenantId: string, id: string, delayMinutes: number): Promise<OrderDTO>;
  getOrderHistory?(tenantId: string, orderId: string): Promise<OrderHistoryEventDTO[]>;
}

export interface TableStatusChangedEvent {
  event: 'table:status-changed';
  tenantId: string;
  tableId: string;
  sessionId: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED';
  action: 'session_opened' | 'session_closed' | 'bill_requested' | 'bill_reopened' | 'session_moved';
  sourceTableId?: string;
  targetTableId?: string;
  timestamp: string;
}

export interface EventPublisher {
  publishOrderEvent(tenantId: string, event: OrderEvent): Promise<void>;
  publishServiceCallEvent(tenantId: string, event: ServiceCallEvent): Promise<void>;
  publishCheckoutCompleted(tenantId: string, event: CheckoutCompletedEvent): Promise<void>;
}

export interface EventSubscriber {
  onOrderEvent(handler: (event: OrderEvent) => void): void;
  onServiceCallEvent(handler: (event: ServiceCallEvent) => void): void;
  onTableStatusChanged?(handler: (event: TableStatusChangedEvent) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface RealtimeEmitter {
  emitToTenant(tenantId: string, event: string, payload: unknown): void;
  emitToSession(sessionId: string, event: string, payload: unknown): void;
}

export interface ServiceCallRepository {
  save(tenantId: string, call: ServiceCallDTO, ttlSeconds: number): Promise<ServiceCallDTO>;
  findById(tenantId: string, callId: string): Promise<ServiceCallDTO | null>;
  listByTenant(tenantId: string, filter?: { status?: ServiceCallStatus }): Promise<ServiceCallDTO[]>;
  resolve(tenantId: string, callId: string, resolvedAt: Date): Promise<ServiceCallDTO>;
}

export interface ValidatedModifierOption {
  optionId: string;
  name: string;
  priceDelta: number;
}

export interface ValidatedModifierGroup {
  groupId: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: ValidatedModifierOption[];
}

export interface ValidatedProduct {
  productId: string;
  name: string;
  price: number;
  isAvailable: boolean;
  destination?: 'kitchen' | 'bar';
  modifierGroups: ValidatedModifierGroup[];
}

export interface CatalogValidationPort {
  getOrderableProducts(tenantId: string, productIds: string[]): Promise<ValidatedProduct[]>;
}

export type GetCartUseCase = UseCase<{ tenantId: string; sessionId: string }, CartDTO>;

export type AddCartItemUseCase = UseCase<
  {
    tenantId: string;
    sessionId: string;
    productId: string;
    modifiers: CartModifierInput[];
    quantity: number;
    notes?: string;
    addedBy?: string;
    userRole?: string;
    display: {
      productName: string;
      unitPrice: number;
      modifierNames: {
        groupName: string;
        optionName: string;
        priceDelta: number;
      }[];
    };
  },
  CartDTO
>;

export type UpdateCartItemQuantityUseCase = UseCase<
  {
    tenantId: string;
    sessionId: string;
    cartItemId: string;
    quantity: number;
  },
  CartDTO
>;

export type RemoveCartItemUseCase = UseCase<
  {
    tenantId: string;
    sessionId: string;
    cartItemId: string;
  },
  CartDTO
>;

export type ConfirmOrderUseCase = UseCase<
  {
    tenantId: string;
    sessionId: string;
    tableId?: string;
    notes?: string;
    estimatedMinutes?: number;
    userRole?: string;
  },
  OrderDTO
>;

export type ListSessionOrdersUseCase = UseCase<
  {
    tenantId: string;
    sessionId: string;
  },
  OrderDTO[]
>;

export type ListTenantOrdersUseCase = UseCase<
  {
    tenantId: string;
    filter?: {
      status?: OrderStatus;
      tableId?: string;
    };
  },
  OrderDTO[]
>;

export type GetOrderUseCase = UseCase<
  {
    tenantId: string;
    orderId: string;
    requester: {
      role: string;
      sessionId?: string;
    };
  },
  OrderDTO
>;

export type GetOrderHistoryUseCase = UseCase<
  {
    tenantId: string;
    orderId: string;
    requester: {
      role: string;
      sessionId?: string;
    };
  },
  OrderHistoryEventDTO[]
>;

export type UpdateOrderDelayUseCase = UseCase<
  {
    tenantId: string;
    orderId: string;
    delayMinutes: number;
  },
  OrderDTO
>;

export type CancelOrderUseCase = UseCase<
  {
    tenantId: string;
    orderId: string;
  },
  OrderDTO
>;

export type UpdateOrderStatusUseCase = UseCase<
  {
    tenantId: string;
    orderId: string;
    status: OrderStatus;
    destination?: 'kitchen' | 'bar';
  },
  OrderDTO
>;

export type CreateServiceCallUseCase = UseCase<
  {
    tenantId: string;
    sessionId: string;
    tableId?: string;
    type?: ServiceCallType;
    note?: string;
  },
  ServiceCallDTO
>;

export type ResolveServiceCallUseCase = UseCase<
  {
    tenantId: string;
    callId: string;
  },
  ServiceCallDTO
>;

export type ListServiceCallsUseCase = UseCase<
  {
    tenantId: string;
    filter?: {
      status?: ServiceCallStatus;
    };
  },
  ServiceCallDTO[]
>;


export interface InvoiceIssueInput {
  tenantId: string;
  paymentId: string;
  amount: number;
  customer?: {
    type?: 'final_consumer' | 'business';
    taxId?: string;
    legalName?: string;
    email?: string;
  };
  items?: { name: string; quantity: number; unitPrice: number; total: number }[];
}

export interface InvoiceIssueResult {
  status: 'issued' | 'pending' | 'error';
  ref?: string;
  error?: string;
}

export interface InvoiceProvider {
  issue(input: InvoiceIssueInput): Promise<InvoiceIssueResult>;
}

export interface PaymentRepository {
  save(tenantId: string, payment: PaymentDTO): Promise<PaymentDTO>;
  findBySession(tenantId: string, sessionId: string): Promise<PaymentDTO | null>;
}

export interface SessionServicePort {
  closeSession(tenantId: string, sessionId: string, requester: { userId: string; role: string }): Promise<void>;
  getSession(tenantId: string, sessionId: string): Promise<TableSessionDTO | null>;
}

export type GetBillUseCase = UseCase<{ tenantId: string; sessionId: string }, BillDTO>;

export type ConfirmCheckoutUseCase = UseCase<
  { tenantId: string; sessionId: string; tableId?: string; method: PaymentMethod; recordedBy: string; invoiceMode?: 'simple' | 'dian'; invoiceCustomer?: { type?: 'final_consumer' | 'business'; taxId?: string; legalName?: string; email?: string } },
  { bill: BillDTO; payment: PaymentDTO }
>;

