# ADR: Cobro con órdenes sin entregar

- **Fecha:** 2026-11-09
- **Estado:** Aceptado (D2 = A, decidido por el usuario)
- **Hilo:** qa-main-hallazgos-flujo-completo, hallazgo 2
- **Contexto:** En el recorrido QA, la Mesa 2 se cobró con una orden en "Por preparar". La mesa se liberó, pero la orden siguió en el KDS y el Dashboard la contaba como pedido activo. `ConfirmCheckout` cobra y cierra la sesión sin tocar el estado de las órdenes. Además, el cancelado actual (`PrismaOrderRepository.cancel`) solo cambia `status` y no `kitchenStatus`/`barStatus`, que son los campos que leen las vistas de monitor. La máquina de estados no permite `READY -> CANCELLED`.
- **Decisión:**
  1. `POST /v1/checkout/confirm` responde **409 `ORDERS_NOT_DELIVERED`** si la sesión tiene órdenes en PLACED, IN_KITCHEN o READY. El cuerpo incluye `error.details.pendingOrders` con orderId, tableId, status, kitchenStatus, barStatus, createdAt e itemsCount.
  2. Con `closePendingOrders: true` en el body, y **solo para admin o manager**, el cobro se registra y esas órdenes pasan a **CANCELLED con `cancelReason = 'checkout'`**. Con cualquier otro rol (staff, waiter, cashier) la respuesta es 403 `FORBIDDEN`.
  3. El cierre por checkout es un **camino propio** (`cancelForCheckout`): en una sola transacción pone `status` y los `kitchenStatus`/`barStatus` no nulos en CANCELLED, y registra un `OrderStatusEvent` con `reason = 'checkout'`. La máquina de estados general **no cambia**: READY sigue sin poder cancelarse por la vía normal.
  4. **Las órdenes cerradas por checkout se cobran.** `calculateBill` las sigue contando ("cobrar igual"), así que GetBill y los reintentos idempotentes dan el mismo total que el pago registrado.
  5. Se publica `order.status-changed` por cada orden cerrada: el KDS y los monitores las retiran en vivo y el Dashboard deja de contarlas como activas.
- **Por qué:** no se pierde comida en preparación por error. El caso real ("el cliente se va y paga igual") tiene una salida explícita y auditable, reservada a quien tiene autoridad. CANCELLED con motivo no falsea la métrica de entregas, a diferencia de DELIVERED.
- **Consecuencias:**
  - Migración en ordering: `Order.cancelReason String?` y `OrderStatusEvent.reason String?`.
  - La caja (CASHIER) ve el 409 con el detalle y debe acudir a admin o manager. Esto amplía el ADR `2026-10-21-perfil-caja-permisos.md` sin contradecirlo: la caja sigue sin poder cerrar órdenes.
  - Los reintentos con pago ya existente siguen siendo idempotentes (no se re-evalúa el 409).
