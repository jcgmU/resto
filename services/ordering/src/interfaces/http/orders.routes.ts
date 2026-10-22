import { Router } from 'express';
import { OrderUseCases } from '../../application/OrderUseCases';

export function createOrdersRouter(orderUseCases: OrderUseCases): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const { tenantId, role, sessionId } = req.auth!;
      const isStaff = role && ['staff', 'manager', 'admin', 'monitor', 'waiter'].includes(role.toLowerCase());

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

  router.get('/:id/history', async (req, res, next) => {
    try {
      const { tenantId, role, sessionId } = req.auth!;
      const { id } = req.params;

      const history = await orderUseCases.getOrderHistory.execute({
        tenantId,
        orderId: id,
        requester: {
          role: role || 'guest',
          sessionId,
        },
      });

      res.json(history);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id/delay', async (req, res, next) => {
    try {
      const { tenantId, role } = req.auth!;
      const isStaff = role && ['staff', 'manager', 'admin', 'monitor', 'waiter'].includes(role.toLowerCase());

      if (!isStaff) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Solo personal autorizado puede asignar demora' },
        });
      }

      const { id } = req.params;
      const { delayMinutes } = req.body;

      if (
        delayMinutes === undefined ||
        typeof delayMinutes !== 'number' ||
        !Number.isInteger(delayMinutes) ||
        delayMinutes < 1 ||
        delayMinutes > 120
      ) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'delayMinutes debe ser un número entero entre 1 y 120',
          },
        });
      }

      const updated = await orderUseCases.updateOrderDelay.execute({
        tenantId,
        orderId: id,
        delayMinutes,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id/cancel', async (req, res, next) => {
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
  });

  router.patch('/:id/status', async (req, res, next) => {
    try {
      const { tenantId, role } = req.auth!;
      const isStaff = role && ['staff', 'manager', 'admin', 'monitor', 'waiter'].includes(role.toLowerCase());

      if (!isStaff) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Solo personal autorizado puede actualizar estado' },
        });
      }

      const { id } = req.params;
      const { status, destination } = req.body;

      if (!status) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'El estado es requerido' },
        });
      }

      const updated = await orderUseCases.updateOrderStatus.execute({
        tenantId,
        orderId: id,
        status,
        destination,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
