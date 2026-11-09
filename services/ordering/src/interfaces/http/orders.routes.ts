import { Router } from 'express';
import { OrderUseCases } from '../../application/OrderUseCases';

export function createOrdersRouter(orderUseCases: OrderUseCases): Router {
  const router = Router();

  // POST /orders/confirm
  router.post('/confirm', async (req, res, next) => {
    try {
      const { tenantId, sessionId } = req.auth!;
      const tableId = req.body?.tableId || `table-from-${sessionId}`;

      const order = await orderUseCases.confirmOrder.execute({
        tenantId,
        sessionId: sessionId!,
        tableId,
      });

      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const { tenantId, role, sessionId } = req.auth!;
      const isStaff = role && ['staff', 'manager', 'admin'].includes(role.toLowerCase());

      if (!isStaff) {
        if (!sessionId) {
          return res.status(401).json({
            error: { code: 'SESSION_REQUIRED', message: 'Sesión requerida' },
          });
        }
        const orders = await orderUseCases.listSessionOrders.execute({
          tenantId,
          sessionId,
        });
        return res.json(orders);
      }

      const { status, tableId } = req.query;
      const orders = await orderUseCases.listTenantOrders.execute({
        tenantId,
        filter: {
          status: status as any,
          tableId: tableId as string,
        },
      });

      return res.json(orders);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const { tenantId, role, sessionId } = req.auth!;
      const { id } = req.params;

      const order = await orderUseCases.getOrder.execute({
        tenantId,
        orderId: id,
        requester: {
          role: role || 'guest',
          sessionId,
        },
      });

      res.json(order);
    } catch (err) {
      next(err);
    }
  });

  const handleCancelOrder = async (req: any, res: any, next: any) => {
    try {
      const { tenantId, role } = req.auth!;
      const isAuthorized = role && ['manager', 'admin'].includes(role.toLowerCase());

      if (!isAuthorized) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Solo manager o admin pueden cancelar órdenes' },
        });
      }

      const { id } = req.params;
      const cancelled = await orderUseCases.cancelOrder.execute({
        tenantId,
        orderId: id,
      });

      res.json(cancelled);
    } catch (err) {
      next(err);
    }
  };

  router.post('/:id/cancel', handleCancelOrder);
  router.patch('/:id/cancel', handleCancelOrder);

  router.patch('/:id/status', async (req, res, next) => {
    try {
      const { tenantId, role } = req.auth!;
      const normalizedRole = (role || '').toLowerCase();
      const isStaff = ['staff', 'manager', 'admin'].includes(normalizedRole);

      if (!isStaff) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Solo personal autorizado puede actualizar estado' },
        });
      }

      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'El estado es requerido' },
        });
      }

      // STAFF no puede cancelar pedidos eludiendo el endpoint /cancel
      if (status === 'CANCELLED' && normalizedRole === 'staff') {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Solo manager o admin pueden cancelar pedidos' },
        });
      }

      const updated = await orderUseCases.updateOrderStatus.execute({
        tenantId,
        orderId: id,
        status,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
