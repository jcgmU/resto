import {
  AddCartItemUseCase,
  CartDTO,
  CartItemDTO,
  CartRepository,
  GetCartUseCase,
  OrderRepository,
  PaymentRepository,
  RemoveCartItemUseCase,
  UpdateCartItemQuantityUseCase,
} from '@packages/shared-types';
import { canMergeCartLines, canonicalModifierKey } from '../domain/merge';
import { CartBusyError, SessionNotActiveError, ValidationError } from '../domain/errors';
import { MAX_ITEM_QUANTITY, validateQuantity } from '../domain/validation';
import { assertSessionActive, OrderingSessionPort } from '../domain/sessionValidation';
import { config } from '../config';
import { isOperationInFlight } from './ports/CartReservationPort';
import { TransactionCoordinator } from './ports/TransactionCoordinator';

export class CartUseCases {
  constructor(
    private readonly cartRepo: CartRepository,
    private readonly paymentRepo?: PaymentRepository,
    private readonly sessionService?: OrderingSessionPort,
    private readonly orderRepo?: OrderRepository,
    private readonly txCoordinator?: TransactionCoordinator
  ) {}

  private async recoverOrphanReservationIfNeeded(tenantId: string, sessionId: string): Promise<void> {
    if (!('findReservation' in this.cartRepo) || typeof (this.cartRepo as any).findReservation !== 'function') {
      return;
    }
    const reservationRepo = this.cartRepo as any;
    const pending = await reservationRepo.findReservation(tenantId, sessionId);
    if (!pending) return;

    const isLeaseActive =
      typeof reservationRepo.isReservationLeaseActive === 'function'
        ? await reservationRepo.isReservationLeaseActive(tenantId, sessionId, pending.operationId)
        : isOperationInFlight(pending.operationId);

    if (isLeaseActive) {
      return;
    }

    const recoverWork = async (
      tx?: any
    ): Promise<{ action: 'ACK' | 'RESTORE' | 'NONE'; operationId?: string }> => {
      const currentPending = await reservationRepo.findReservation(tenantId, sessionId);
      if (!currentPending || currentPending.operationId !== pending.operationId) {
        return { action: 'NONE' };
      }
      if (typeof reservationRepo.isReservationLeaseActive === 'function') {
        const stillActive = await reservationRepo.isReservationLeaseActive(
          tenantId,
          sessionId,
          currentPending.operationId
        );
        if (stillActive) return { action: 'NONE' };
      }

      const fenceRepo = this.orderRepo as any;
      let fenceStatus: 'COMMITTED' | 'ABORTED' = 'ABORTED';
      if (fenceRepo && typeof fenceRepo.abortReservationFence === 'function') {
        fenceStatus = await fenceRepo.abortReservationFence(
          tenantId,
          sessionId,
          currentPending.operationId,
          currentPending.orderId,
          tx
        );
      } else if (this.orderRepo) {
        const existingOrder = await (this.orderRepo as any).findById(
          tenantId,
          currentPending.orderId,
          tx
        );
        if (existingOrder) {
          fenceStatus = 'COMMITTED';
        }
      }

      if (fenceStatus === 'COMMITTED') {
        return { action: 'ACK', operationId: currentPending.operationId };
      }

      return { action: 'RESTORE', operationId: currentPending.operationId };
    };

    const decision = this.txCoordinator
      ? await this.txCoordinator.runInSessionLock(tenantId, sessionId, recoverWork)
      : await recoverWork();

    if (decision?.action === 'ACK' && decision.operationId) {
      await reservationRepo.ackReservation(tenantId, sessionId, decision.operationId);
    } else if (decision?.action === 'RESTORE' && decision.operationId) {
      const restored = await reservationRepo.restoreReservation(
        tenantId,
        sessionId,
        decision.operationId,
        config.cartTtlSeconds,
        { requireExpiredLease: true }
      );
      if (restored && (restored.status === 'CONFLICT' || restored.status === 'ACTIVE')) {
        throw new CartBusyError();
      }
    }
  }

  private async assertItemNotReserved(tenantId: string, sessionId: string, cartItemId: string): Promise<void> {
    if (!('findReservation' in this.cartRepo) || typeof (this.cartRepo as any).findReservation !== 'function') {
      return;
    }
    const pending = await (this.cartRepo as any).findReservation(tenantId, sessionId);
    if (pending && (pending.items || []).some((i: CartItemDTO) => i.cartItemId === cartItemId)) {
      throw new CartBusyError();
    }
  }

  addCartItem: AddCartItemUseCase = {
    execute: async (input) => {
      validateQuantity(input.quantity);

      // Chequeo previo con session service fuera del transaction lock para no bloquear conexiones
      if (this.sessionService) {
        await assertSessionActive(input.tenantId, input.sessionId, {
          sessionService: this.sessionService,
        });
      }

      await this.recoverOrphanReservationIfNeeded(input.tenantId, input.sessionId);

      const cartItemId = `ci-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const modifiers = input.modifiers.map((m) => {
        const foundName = (input.display.modifierNames || []).find(
          (dn) => dn.optionName
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
      const lineTotal = (input.display.unitPrice + lineDeltas) * input.quantity;

      const newItem: CartItemDTO = {
        cartItemId,
        productId: input.productId,
        productName: input.display.productName,
        unitPrice: input.display.unitPrice,
        modifiers,
        quantity: input.quantity,
        notes: input.notes,
        addedBy: input.addedBy,
        addedAt: new Date().toISOString(),
        lineTotal,
      };

      const persistItemWork = async (tx?: any): Promise<CartDTO> => {
        // Doble verificación dentro del lock de sesión: si ya fue pagada, rechazar antes de mutar Redis
        if (this.paymentRepo) {
          const existingPayment = await (this.paymentRepo as any).findBySession(
            input.tenantId,
            input.sessionId,
            tx
          );
          if (existingPayment) {
            throw new SessionNotActiveError('La sesión ya ha sido pagada');
          }
        }

        if ('addItemAtomic' in this.cartRepo && typeof (this.cartRepo as any).addItemAtomic === 'function') {
          const canonicalKey = `${input.productId}::${canonicalModifierKey(input.modifiers)}`;
          const res = await (this.cartRepo as any).addItemAtomic(
            input.tenantId,
            input.sessionId,
            canonicalKey,
            newItem,
            input.quantity,
            MAX_ITEM_QUANTITY,
            config.cartTtlSeconds
          );
          return res.cart;
        }

        // Fallback para repositorios sin soporte atómico
        const currentCart = await this.cartRepo.get(
          input.tenantId,
          input.sessionId,
          config.cartTtlSeconds
        );

        const existingItem = (currentCart.items || []).find((line) =>
          canMergeCartLines(
            line.productId,
            line.modifiers.map((m) => ({ groupId: m.groupId, optionId: m.optionId })),
            input.productId,
            input.modifiers
          )
        );

        if (existingItem) {
          const newQuantity = existingItem.quantity + input.quantity;
          if (newQuantity > MAX_ITEM_QUANTITY) {
            throw new ValidationError(
              `La cantidad acumulada (${newQuantity}) supera el límite máximo permitido de ${MAX_ITEM_QUANTITY} unidades`
            );
          }
          return this.cartRepo.setQuantity(
            input.tenantId,
            input.sessionId,
            existingItem.cartItemId,
            newQuantity,
            config.cartTtlSeconds
          );
        }

        return this.cartRepo.upsertItem(
          input.tenantId,
          input.sessionId,
          newItem,
          config.cartTtlSeconds
        );
      };

      return this.txCoordinator
        ? await this.txCoordinator.runInSessionLock(input.tenantId, input.sessionId, persistItemWork)
        : await persistItemWork();
    },
  };

  updateCartItemQuantity: UpdateCartItemQuantityUseCase = {
    execute: async (input) => {
      validateQuantity(input.quantity);

      if (this.sessionService) {
        await assertSessionActive(input.tenantId, input.sessionId, {
          sessionService: this.sessionService,
        });
      }

      await this.recoverOrphanReservationIfNeeded(input.tenantId, input.sessionId);

      const updateWork = async (tx?: any): Promise<CartDTO> => {
        if (this.paymentRepo) {
          const existingPayment = await (this.paymentRepo as any).findBySession(
            input.tenantId,
            input.sessionId,
            tx
          );
          if (existingPayment) {
            throw new SessionNotActiveError('La sesión ya ha sido pagada');
          }
        }

        await this.assertItemNotReserved(input.tenantId, input.sessionId, input.cartItemId);

        return this.cartRepo.setQuantity(
          input.tenantId,
          input.sessionId,
          input.cartItemId,
          input.quantity,
          config.cartTtlSeconds
        );
      };

      return this.txCoordinator
        ? await this.txCoordinator.runInSessionLock(input.tenantId, input.sessionId, updateWork)
        : await updateWork();
    },
  };

  removeCartItem: RemoveCartItemUseCase = {
    execute: async (input) => {
      if (this.sessionService) {
        await assertSessionActive(input.tenantId, input.sessionId, {
          sessionService: this.sessionService,
        });
      }

      await this.recoverOrphanReservationIfNeeded(input.tenantId, input.sessionId);

      const removeWork = async (tx?: any): Promise<CartDTO> => {
        if (this.paymentRepo) {
          const existingPayment = await (this.paymentRepo as any).findBySession(
            input.tenantId,
            input.sessionId,
            tx
          );
          if (existingPayment) {
            throw new SessionNotActiveError('La sesión ya ha sido pagada');
          }
        }

        await this.assertItemNotReserved(input.tenantId, input.sessionId, input.cartItemId);

        return this.cartRepo.removeItem(
          input.tenantId,
          input.sessionId,
          input.cartItemId,
          config.cartTtlSeconds
        );
      };

      return this.txCoordinator
        ? await this.txCoordinator.runInSessionLock(input.tenantId, input.sessionId, removeWork)
        : await removeWork();
    },
  };

  getCart: GetCartUseCase = {
    execute: async (input) => {
      return this.cartRepo.get(input.tenantId, input.sessionId, config.cartTtlSeconds);
    },
  };
}
