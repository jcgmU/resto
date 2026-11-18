import { calculateBill } from '../../src/domain/bill';
import { OrderDTO } from '@packages/shared-types';

describe('domain/bill - calculateBill con órdenes cerradas por checkout', () => {
  test('orden CANCELLED normal (sin cancelReason) queda excluida de la cuenta', () => {
    const orders: OrderDTO[] = [
      {
        id: 'ord-1',
        tenantId: 't-1',
        sessionId: 's-1',
        tableId: 'tb-1',
        status: 'CANCELLED',
        total: 50,
        items: [],
        createdAt: new Date().toISOString(),
      },
    ];

    const bill = calculateBill(orders);
    expect(bill.ordersCount).toBe(0);
    expect(bill.total).toBe(0);
  });

  test('orden CANCELLED con cancelReason === checkout sigue siendo facturable (cuenta en calculateBill)', () => {
    const orders: OrderDTO[] = [
      {
        id: 'ord-1',
        tenantId: 't-1',
        sessionId: 's-1',
        tableId: 'tb-1',
        status: 'CANCELLED',
        cancelReason: 'checkout',
        total: 45.5,
        items: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord-2',
        tenantId: 't-1',
        sessionId: 's-1',
        tableId: 'tb-1',
        status: 'DELIVERED',
        total: 20,
        items: [],
        createdAt: new Date().toISOString(),
      },
    ];

    const bill = calculateBill(orders);
    expect(bill.ordersCount).toBe(2);
    expect(bill.total).toBe(65.5);
    expect(bill.orders.map((o) => o.id)).toEqual(['ord-1', 'ord-2']);
  });
});
