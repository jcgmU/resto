import {
  CartItemDTO,
  OrderItemDTO,
  OrderModifierDTO,
  ValidatedProduct,
} from '@packages/shared-types';
import {
  ModifierInvalidError,
  ModifierRequiredError,
  ProductNotFoundError,
  ProductUnavailableError,
  ValidationError,
} from './errors';
import {
  MAX_DECIMAL_10_2,
  MAX_DECIMAL_10_2_CENTS,
  validateQuantity,
} from './validation';

export interface RecalculatedOrder {
  total: number;
  items: OrderItemDTO[];
}

export function validateAndPriceCart(
  cartItems: CartItemDTO[],
  validatedProducts: ValidatedProduct[]
): RecalculatedOrder {
  const productMap = new Map<string, ValidatedProduct>();
  for (const p of validatedProducts) {
    productMap.set(p.productId, p);
  }

  let totalCents = 0;
  const orderItems: OrderItemDTO[] = [];

  for (const item of cartItems) {
    // 1. Validar cantidad en [1, 99]
    validateQuantity(item.quantity);

    const product = productMap.get(item.productId);
    if (!product) {
      throw new ProductNotFoundError(`Producto con id ${item.productId} no existe en catálogo`);
    }

    if (!product.isAvailable) {
      throw new ProductUnavailableError(`El producto ${product.name} no está disponible`);
    }

    if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0) {
      throw new ValidationError(`Precio del producto ${product.name} es inválido`);
    }

    // Validar modificadores por cada grupo del producto
    const selectionsByGroup = new Map<string, string[]>();
    for (const mod of item.modifiers || []) {
      const list = selectionsByGroup.get(mod.groupId) || [];
      list.push(mod.optionId);
      selectionsByGroup.set(mod.groupId, list);
    }

    // Verificar reglas de grupos
    for (const group of product.modifierGroups || []) {
      const selected = selectionsByGroup.get(group.groupId) || [];
      const count = selected.length;

      if ((group.isRequired || group.minSelections > 0) && count < Math.max(1, group.minSelections)) {
        throw new ModifierRequiredError(
          `El grupo de modificadores "${group.name}" es obligatorio y requiere al menos ${group.minSelections || 1} selección`
        );
      }

      if (group.maxSelections > 0 && count > group.maxSelections) {
        throw new ModifierInvalidError(
          `El grupo de modificadores "${group.name}" permite máximo ${group.maxSelections} opciones`
        );
      }
    }

    // Verificar que todas las opciones seleccionadas existan en el producto y capturar su snapshot
    const itemModifiers: OrderModifierDTO[] = [];
    let lineModifiersDeltaCents = 0;

    for (const mod of item.modifiers || []) {
      const group = (product.modifierGroups || []).find((g) => g.groupId === mod.groupId);
      if (!group) {
        throw new ModifierInvalidError(
          `Grupo de modificadores ${mod.groupId} no pertenece al producto ${product.name}`
        );
      }

      const option = (group.options || []).find((o) => o.optionId === mod.optionId);
      if (!option) {
        throw new ModifierInvalidError(
          `Opción de modificador ${mod.optionId} no existe en el grupo ${group.name}`
        );
      }

      if (typeof option.priceDelta !== 'number' || !Number.isFinite(option.priceDelta)) {
        throw new ValidationError(`Delta de precio de la opción ${option.name} es inválido`);
      }

      const priceDeltaCents = Math.round(option.priceDelta * 100);
      lineModifiersDeltaCents += priceDeltaCents;

      itemModifiers.push({
        groupId: group.groupId,
        groupName: group.name,
        optionId: option.optionId,
        optionName: option.name,
        priceDelta: option.priceDelta,
      });
    }

    const unitPriceCents = Math.round(product.price * 100);
    const lineUnitCents = unitPriceCents + lineModifiersDeltaCents;
    if (!Number.isSafeInteger(lineUnitCents) || lineUnitCents < 0) {
      throw new ValidationError(`Monto unitario inválido para el producto ${product.name}`);
    }

    const lineTotalCents = lineUnitCents * item.quantity;
    if (!Number.isSafeInteger(lineTotalCents) || lineTotalCents < 0) {
      throw new ValidationError(`Monto de línea desbordado para el producto ${product.name}`);
    }

    totalCents += lineTotalCents;
    if (!Number.isSafeInteger(totalCents) || totalCents > MAX_DECIMAL_10_2_CENTS) {
      throw new ValidationError(
        `El monto total de la orden supera el límite máximo permitido de ${MAX_DECIMAL_10_2}`
      );
    }

    orderItems.push({
      id: item.cartItemId,
      productId: product.productId,
      productName: product.name,
      unitPrice: product.price,
      quantity: item.quantity,
      notes: item.notes,
      modifiers: itemModifiers,
    });
  }

  return {
    total: totalCents / 100,
    items: orderItems,
  };
}
