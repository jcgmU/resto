export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CartEmptyError extends DomainError {
  constructor(message = 'El carrito está vacío') {
    super('CART_EMPTY', message);
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(message = 'Producto no encontrado en catálogo') {
    super('PRODUCT_NOT_FOUND', message);
  }
}

export class ProductUnavailableError extends DomainError {
  constructor(message = 'Producto no disponible') {
    super('PRODUCT_UNAVAILABLE', message);
  }
}

export class ModifierRequiredError extends DomainError {
  constructor(message = 'Grupo de modificador obligatorio sin selección suficiente') {
    super('MODIFIER_REQUIRED', message);
  }
}

export class ModifierInvalidError extends DomainError {
  constructor(message = 'Selección de modificadores inválida') {
    super('MODIFIER_INVALID', message);
  }
}

export class OrderNotFoundError extends DomainError {
  constructor(message = 'Orden no encontrada') {
    super('ORDER_NOT_FOUND', message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Acceso denegado a la orden') {
    super('FORBIDDEN', message);
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Datos de entrada inválidos') {
    super('VALIDATION_ERROR', message);
  }
}

export class SessionRequiredError extends DomainError {
  constructor(message = 'Sesión requerida') {
    super('SESSION_REQUIRED', message);
  }
}

export class CatalogUnreachableError extends DomainError {
  constructor(message = 'Catálogo interno no disponible') {
    super('CATALOG_UNREACHABLE', message);
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(message = 'Transición de estado de orden inválida') {
    super('INVALID_STATUS_TRANSITION', message);
  }
}

export class ServiceCallNotFoundError extends DomainError {
  constructor(message = 'Llamada de servicio no encontrada') {
    super('SERVICE_CALL_NOT_FOUND', message);
  }
}

export class BillNotFoundError extends DomainError {
  constructor(message = 'Cuenta no encontrada para esta sesión') {
    super('BILL_NOT_FOUND', message);
  }
}

export class BillEmptyError extends DomainError {
  constructor(message = 'No hay órdenes activas para cobrar en esta sesión') {
    super('BILL_EMPTY', message);
  }
}

export class SessionCloseFailedError extends DomainError {
  constructor(message = 'Error al cerrar la sesión en el servicio de sesiones') {
    super('SESSION_CLOSE_FAILED', message);
  }
}

export class SessionNotOrderableError extends DomainError {
  constructor(message = 'La sesión no admite pedidos en su estado actual') {
    super('SESSION_NOT_ORDERABLE', message);
  }
}

export class TableMismatchError extends DomainError {
  constructor(message = 'La mesa indicada no coincide con la mesa de la sesión') {
    super('TABLE_MISMATCH', message);
  }
}


