import {
  AddCartItemUseCase,
  CartDTO,
  CartItemDTO,
  CartRepository,
  CatalogValidationPort,
  GetCartUseCase,
  RemoveCartItemUseCase,
  SessionServicePort,
  UpdateCartItemQuantityUseCase,
  IdentitySettingsPort,
} from '@packages/shared-types';
import { canMergeCartLines } from '../domain/merge';
import { config } from '../config';
import { ValidationError, SessionNotOrderableError, ProductUnavailableError } from '../domain/errors';

export class CartUseCases {
  constructor(
    private readonly cartRepo: CartRepository,
    private readonly sessionService?: SessionServicePort,
    private readonly catalogValidation?: CatalogValidationPort,
    private readonly identitySettings?: IdentitySettingsPort
  ) {}

  private async assertSessionOrderable(tenantId: string, sessionId: string): Promise<void> {
    if (this.sessionService) {
      const session = await this.sessionService.getSession(tenantId, sessionId);
      if (!session || session.status !== 'active') {
        throw new SessionNotOrderableError('La sesión no admite pedidos en su estado actual');
      }
    }
  }

  addCartItem: AddCartItemUseCase = {
    execute: async (input) => {
      await this.assertSessionOrderable(input.tenantId, input.sessionId);

      if (this.identitySettings) {
        const isStaff = ['ADMIN', 'MANAGER', 'STAFF', 'WAITER'].includes((input.userRole || '').toUpperCase());
        if (!isStaff) {
          const mode = await this.identitySettings.getOperatingMode(input.tenantId);
          if (mode === 'waiter_only') {
            throw new SessionNotOrderableError('El autoservicio por QR está inactivo en modo solo meseros');
          }
        }
      }

      if (typeof input.quantity !== 'number' || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 99) {
        throw new ValidationError('La cantidad debe ser un entero entre 1 y 99');
      }

      if (this.catalogValidation) {
        const products = await this.catalogValidation.getOrderableProducts(input.tenantId, [input.productId]);
        const product = products.find((p) => p.productId === input.productId);
        if (product && product.isAvailable === false) {
          throw new ProductUnavailableError(`El producto '${product.name}' no está disponible`);
        }
      }

      // Preparar CartItemDTO para upsertItem atómico
      const cartItemId = `ci-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const modifiers = (input.modifiers || []).map((m) => {
        const foundName = (input.display?.modifierNames || []).find(
          (dn) => dn.optionName // fallback o match
        );
        return {
          groupId: m.groupId,
          groupName: foundName?.groupName || 'Modificador',
          optionId: m.optionId,
          optionName: foundName?.optionName || 'Opción',
          priceDelta: foundName?.priceDelta || 0,
        };
      });

      const lineDeltas = modifiers.reduce((acc, m) => acc + (m.priceDelta || 0), 0);
      const unitPrice = input.display?.unitPrice || 0;
      const lineTotal = (unitPrice + lineDeltas) * input.quantity;

      const newItem: CartItemDTO = {
        cartItemId,
        productId: input.productId,
        productName: input.display?.productName || 'Producto',
        unitPrice,
        modifiers,
        quantity: input.quantity,
        notes: input.notes,
        addedBy: input.addedBy,
        addedAt: new Date().toISOString(),
        lineTotal,
      };

      return this.cartRepo.upsertItem(
        input.tenantId,
        input.sessionId,
        newItem,
        config.cartTtlSeconds
      );
    },
  };

  updateCartItemQuantity: UpdateCartItemQuantityUseCase = {
    execute: async (input) => {
      await this.assertSessionOrderable(input.tenantId, input.sessionId);

      if (input.quantity <= 0) {
        return this.cartRepo.removeItem(
          input.tenantId,
          input.sessionId,
          input.cartItemId,
          config.cartTtlSeconds
        );
      }

      return this.cartRepo.setQuantity(
        input.tenantId,
        input.sessionId,
        input.cartItemId,
        input.quantity,
        config.cartTtlSeconds
      );
    },
  };

  removeCartItem: RemoveCartItemUseCase = {
    execute: async (input) => {
      await this.assertSessionOrderable(input.tenantId, input.sessionId);

      return this.cartRepo.removeItem(
        input.tenantId,
        input.sessionId,
        input.cartItemId,
        config.cartTtlSeconds
      );
    },
  };

  getCart: GetCartUseCase = {
    execute: async (input) => {
      return this.cartRepo.get(input.tenantId, input.sessionId, config.cartTtlSeconds);
    },
  };
}
