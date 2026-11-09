import { Router } from 'express';
import { CartUseCases } from '../../application/CartUseCases';
import { OrderUseCases } from '../../application/OrderUseCases';
import { parseCartItemQuantity, validateQuantity } from '../../domain/validation';

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
      const { tenantId, sessionId } = req.auth!;
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

  return router;
}
