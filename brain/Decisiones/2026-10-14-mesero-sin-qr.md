# ADR: Mesero sin QR (toma de pedido por personal) con flag por tenant

- **Fecha:** 2026-10-14
- **Estado:** Aceptado
- **Hilo:** correcciones-qa-y-notas (N02c)
- **Contexto:** N02c pide una vista donde el mesero tome el pedido y la mesa cuando NO se usa QR, activable/desactivable desde el Dashboard central por tenant. Hoy las rutas de carrito exigen `x-session-id` de un token guest; un token staff no tiene sesión.
- **Decisión:**
  1. Tenant gana settings en identity: `estimatedPrepMinutes` (int, default 15) y `waiterModeEnabled` (bool, default false), con `GET /tenant/settings` (staff+) y `PATCH /tenant/settings` (admin/manager).
  2. `POST /sessions/staff-open` (staff/manager/admin): abre o reutiliza la sesión activa de una mesa (misma atomicidad que el QR) y devuelve `sessionId`.
  3. Ordering acepta operaciones de carrito/confirm con rol staff+ usando un `x-session-id` explícito (guest solo puede usar el de su token). La mesa se deriva siempre de la sesión (ADR ciclo de sesión).
  4. Enforcement del flag en backend: ordering verifica `waiterModeEnabled` (consulta a identity con token interno, cache corto) antes de aceptar escrituras staff en carrito/confirm; el frontend además oculta la vista si el flag está off.
- **Consecuencias:** La vista de mesero reutiliza el flujo de pedido existente (carrito + confirm) con sesión abierta por staff; el flag queda enforceado en backend, no solo escondido en UI. Se documenta que el staff opera "en nombre de la mesa" y los pedidos quedan atribuidos a la sesión de la mesa como si fueran QR.
