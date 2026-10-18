# ADR: Ciclo de vida de sesión, liquidación y política de cobro

- **Fecha:** 2026-10-14
- **Estado:** Aceptado
- **Hilo:** correcciones-qa-y-notas (R03, R04, R06, R10, U03, U04, N16, N18)
- **Contexto:** Sesión solo tiene `active|closed`; tras cobrar y cerrar, el token guest seguía pudiendo crear pedidos (incobrables); 8 aperturas concurrentes del QR creaban 5-8 sesiones; el tableId lo dicta el cliente; el guest tenía un botón "Pagar" que siempre falla con 403 silencioso.
- **Decisión:**
  1. **Sesión única compartida por mesa (MVP):** todos los comensales que escanean el mismo QR comparten la sesión activa. La apertura es atómica (Lua en Redis): get-or-create sobre el puntero `tenant:{t}:table:{tb}:session`. "Mesa liberada" = no existe sesión activa para esa mesa.
  2. **Estados:** `active → billRequested → closed` (con reversa staff `billRequested → active`). `POST /sessions/:id/bill-request` (guest, idempotente) es lo que dispara "Pedir la cuenta" desde la PWA; `POST /sessions/:id/bill-reopen` (staff) reabre.
  3. **Barrera de liquidación:** ordering consulta la sesión antes de cualquier escritura (carrito, confirmar pedido). En `billRequested` o `closed` se rechaza con 409 `SESSION_NOT_ORDERABLE` (ningún pedido aceptado puede quedar fuera del total cobrado).
     - **Enmienda formal (excepción de llamadas de servicio):** Las llamadas de servicio (`service-calls`) son la excepción explícita a la barrera de liquidación en estado `billRequested`. Están expresamente permitidas en `billRequested` para que el comensal solicite asistencia presencial (`WAITER_CALL`) o la cuenta (`BILL_REQUEST`) mientras se liquida. En estado `closed`, cualquier llamada es rechazada.
  4. **Mesa derivada de la sesión:** ordering deriva `tableId` de la sesión validada; un `tableId` de body que no coincida se rechaza (409). Aplica a pedidos, checkout y llamadas de servicio.
  5. **Cobro solo por personal:** el guest NO registra pagos; se elimina el botón "Pagar" de la PWA y queda "Pedir la cuenta". El cobro (CASH) lo registra staff desde checkout.
  6. **Cierre manual de mesa (N16):** desde checkout, staff puede cerrar una sesión SIN cobrar solo si no tiene pedidos activos sin pagar; si los hay, se bloquea mostrando el monto pendiente (conservador: protege ingresos).
- **Consecuencias:** Requiere migrar el modelo de sesión (campo status extendido), nuevo puerto `getSession` en ordering, y ajustar PWA/admin a los estados. Las sesiones duplicadas legadas se limpian con script (se conserva la sesión apuntada por la mesa).
- **Enmienda (2026-10-17 / N14):** Formalizada la excepción en el punto 3 para llamadas de servicio (`service-calls`) durante el estado `billRequested`.
