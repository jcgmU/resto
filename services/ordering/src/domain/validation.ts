import { ValidationError } from './errors';

export const MIN_ITEM_QUANTITY = 1;
export const MAX_ITEM_QUANTITY = 99;
export const MAX_DECIMAL_10_2 = 99999999.99;
export const MAX_DECIMAL_10_2_CENTS = 9999999999; // 9,999,999,999 cents = 99,999,999.99

export function validateQuantity(quantity: unknown, fieldName = 'quantity'): number {
  if (
    typeof quantity !== 'number' ||
    Number.isNaN(quantity) ||
    !Number.isFinite(quantity) ||
    !Number.isInteger(quantity)
  ) {
    throw new ValidationError(
      `El campo ${fieldName} debe ser un número entero entre ${MIN_ITEM_QUANTITY} y ${MAX_ITEM_QUANTITY}`
    );
  }

  if (quantity < MIN_ITEM_QUANTITY || quantity > MAX_ITEM_QUANTITY) {
    throw new ValidationError(
      `El campo ${fieldName} debe estar entre ${MIN_ITEM_QUANTITY} y ${MAX_ITEM_QUANTITY}`
    );
  }

  return quantity;
}

export function parseCartItemQuantity(quantity: unknown): number {
  if (quantity === undefined) {
    return 1;
  }
  return validateQuantity(quantity, 'quantity');
}
