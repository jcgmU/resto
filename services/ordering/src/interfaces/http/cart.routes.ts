import { Router } from 'express';
import { CartUseCases } from '../../application/CartUseCases';
import { OrderUseCases } from '../../application/OrderUseCases';
import { parseCartItemQuantity, validateQuantity } from '../../domain/validation';
import { ValidationError } from '../../domain/errors';
import { CART_STAFF_ROLES, hasRole } from './authzRoles';

export function createCartRouter(
  cartUseCases: CartUseCases,
  orderUseCases: OrderUseCases
): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const { tenantId, sessionId } = req.auth!;
      const cart = await cartUseCases.getCart.execute({ tenantId, sessionId: sessionId! });
      res.json(cart);
    } catch (err) {
      next(err);
    }
  });

  router.post('/items', async (req, res, next) => {
    try {
      const { tenantId, sessionId, role } = req.auth!;
      const { productId, modifiers, quantity, notes, addedBy, display } = req.body || {};

      const parsedQuantity = parseCartItemQuantity(quantity);

      const cart = await cartUseCases.addCartItem.execute({
        tenantId,
        sessionId: sessionId!,
        productId,
        modifiers: modifiers || [],
        quantity: parsedQuantity,
        notes,
        addedBy,
        userRole: role,
        display: display || { productName: 'Producto', unitPrice: 0, modifierNames: [] },
      });

      res.status(201).json(cart);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/items/:cartItemId', async (req, res, next) => {
    try {
      const { tenantId, sessionId } = req.auth!;
      const { cartItemId } = req.params;
      const { quantity } = req.body || {};

      const parsedQuantity = validateQuantity(quantity);

      const cart = await cartUseCases.updateCartItemQuantity.execute({
        tenantId,
        sessionId: sessionId!,
        cartItemId,
        quantity: parsedQuantity,
      });

      res.json(cart);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/items/:cartItemId', async (req, res, next) => {
    try {
      const { tenantId, sessionId } = req.auth!;
      const { cartItemId } = req.params;

      const cart = await cartUseCases.removeCartItem.execute({
        tenantId,
        sessionId: sessionId!,
        cartItemId,
      });

      res.json(cart);
    } catch (err) {
      next(err);
    }
  });

  router.post('/confirm', async (req, res, next) => {
    try {
      const { tenantId, sessionId, role } = req.auth!;
      const { tableId, notes, estimatedMinutes } = req.body || {};

      if (notes !== undefined && notes !== null) {
        if (typeof notes !== 'string' || notes.length > 280) {
          throw new ValidationError('Las notas generales no pueden superar 280 caracteres');
        }
      }

      const isStaff = hasRole(role, CART_STAFF_ROLES);
      const effectiveEstimatedMinutes = isStaff ? estimatedMinutes : undefined;

      if (effectiveEstimatedMinutes !== undefined && effectiveEstimatedMinutes !== null) {
        if (typeof effectiveEstimatedMinutes !== 'number' || !Number.isInteger(effectiveEstimatedMinutes) || effectiveEstimatedMinutes <= 0) {
          throw new ValidationError('estimatedMinutes debe ser un entero positivo');
        }
      }

      const order = await orderUseCases.confirmOrder.execute({
        tenantId,
        sessionId: sessionId!,
        tableId,
        notes,
        estimatedMinutes: effectiveEstimatedMinutes,
        userRole: role,
      });

      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
