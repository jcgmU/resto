import { OrderDTO } from '@packages/shared-types';

export interface CalculatedBill {
  orders: OrderDTO[];
  ordersCount: number;
  total: number;
}

export function calculateBill(orders: OrderDTO[]): CalculatedBill {
  const activeOrders = orders.filter(
    (o) => o.status !== 'CANCELLED' || o.cancelReason === 'checkout'
  );
  const totalCents = activeOrders.reduce((sum, o) => {
    return sum + Math.round(Number(o.total) * 100);
  }, 0);

  return {
    orders: activeOrders,
    ordersCount: activeOrders.length,
    total: totalCents / 100,
  };
}
