# ADR: Permisos del perfil de caja (CASHIER)

- **Fecha:** 2026-10-21
- **Estado:** Aceptado
- **Hilo:** backlog-producto-qa-3 ronda 3 (el usuario delegó la decisión al planificador)
- **Contexto:** El usuario pidió un tercer perfil operativo, "caja", junto a mesero y monitor, y delegó al planificador la definición exacta de sus permisos ("a tu criterio, según el flujo del negocio"). Referencia: flujo real de un restaurante colombiano — la caja cobra, libera mesas y consulta qué hay pendiente de cobro; no edita menú ni ajustes.
- **Decisión:** El perfil **CAJA (CASHIER)** opera desde una **terminal exclusiva de cobro** (sin panel administrativo) y puede, solo puede:
  1. **Autenticarse** y entrar únicamente a su terminal (`/terminal-caja`); cualquier otra ruta del panel redirige/deniega.
  2. **Ver mesas y sesiones con consumo** (`GET /v1/tables`, `GET /v1/sessions`) y el detalle de cuenta de una sesión (`GET /v1/checkout/:sessionId`) — necesario para saber qué cobrar.
  3. **Registrar el cobro** (`POST /v1/checkout/confirm`) con los métodos habilitados (Efectivo y Tarjeta), lo que cierra la sesión y **libera la mesa**.
  4. **Cerrar sesiones sin consumo** (`PATCH /v1/sessions/:id/close`) — liberar una mesa abierta por error, bajo la misma política que checkout (bloqueado si hay consumo sin cobrar).
  5. **Ver y resolver llamadas de servicio** (`GET /v1/service-calls`, `PATCH /v1/service-calls/:id/resolve`) — al cobrar se auto-resuelven las de la sesión; la resolución manual le permite limpiar llamadas atendidas en persona.
- **NO puede (lista explícita):**
  - Editar catálogo/menú, zonas, mesas ni reservas.
  - Tocar ajustes del tenant (modo de operación, SLA, modo de facturación) ni gestionar empleados.
  - Reabrir la cuenta (`bill-reopen`): afecta dinero ya solicitado; queda para staff/manager/admin.
  - Operar el monitor de cocina (avanzar estados, marcar demoras) ni tomar pedidos (staff-open, carrito).
  - Ver el dashboard de Resumen ni el KDS (su terminal es exclusiva de cobro).
- **Razón:** refleja la caja registradora real (cobrar, liberar, saber qué falta por cobrar) y minimiza la superficie de riesgo: nada que altere catálogo, configuración o dinero ya liquidado. Todo lo que la caja hace queda registrado por los flujos existentes (pago con método, cierre de sesión, auto-resolución de llamadas).
- **Consecuencias:** `routeTable` del gateway y los arrays de roles de ordering (`checkout.routes`, `serviceCalls.routes`) incluyen `cashier` exactamente en las rutas listadas arriba y en ninguna más; `bill-reopen`, staff-open, cart, orders status/delay, tenant settings (PATCH), identity users y catalog quedan FUERA para cashier. El gating client-side (U6) limita al rol a `/terminal-caja`. La matriz de autorización (test de contrato en gateway/ordering) prueba permitidos y denegados por ruta.
