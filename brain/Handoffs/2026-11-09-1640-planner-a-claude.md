---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: qa-main-hallazgos-flujo-completo
ronda: 2
creado: 2026-11-09T16:40:00
criterios_de_aceptacion:
  - "Cobro con ordenes PLACED/IN_KITCHEN/READY -> 409 ORDERS_NOT_DELIVERED con la lista; 'Cobrar igual y cerrar pedidos' solo para ADMIN/MANAGER (nunca en Terminal de Caja); las ordenes cerradas quedan en CANCELLED con cancelReason checkout, salen del KDS, monitores y Dashboard, suman en la cuenta y aparecen en el historial con reason checkout."
  - "H4: 'Cerrar sesion' en PanelShell y TerminalShell (helper compartido) borra los 3 tokens y lleva a /login."
  - "H1 y H3 resueltos en wip, comprobados en navegador."
  - "Menores: /pagos describe efectivo o tarjeta; el formulario de nuevo empleado vuelve a WAITER; STAFF aterriza en /kds y solo /menu y /ajustes le estan vedados."
  - "Bateria en verde, 0 commits, 0 push, demo limpia en waiter_only."
referencias:
  - "brain/Handoffs/2026-11-09-1449-claude-a-planner.md (objetivo ronda 2)"
  - "brain/Handoffs/2026-11-09-1550-agy-a-planner.md (ejecucion ronda 1)"
  - "brain/Handoffs/2026-11-09-1610-planner-a-agy.md (plan ronda 2, correcciones de la revision)"
  - "brain/Handoffs/2026-11-09-1628-agy-a-planner.md (ejecucion ronda 2)"
  - "brain/Decisiones/2026-11-09-cobro-con-ordenes-sin-entregar.md (ADR D2)"
  - "brain/Decisiones/2026-11-09-propuesta-integracion-main-wip.md (hilo aparte, solo propuesta)"
---

# listo-para-verificar - qa-main-hallazgos-flujo-completo - ronda 2

Todo esta sobre `wip/correcciones-qa-y-notas`, con HEAD `bdae92f` y el arbol sin commitear (0 commits, 0 push). El commit lo decide el usuario.

## Que se hizo

- **Plan ronda 1 (U0-U6):**
  - Cambio de stack de main a wip, con `stop` y sin `down -v`.
  - Backend D2: migracion `20261109150000_order_cancel_reason`, `cancelForCheckout` y 409/403.
  - UI del 409 con override y modal, retiro en vivo en KDS y Dashboard.
  - Logout compartido, menores de /pagos y /ajustes, test de recarga de la PWA y script `scripts/e2e-checkout-pending.mjs`.
- **Revision del planificador:** encontre 3 fallos.
  - STAFF quedaba encerrado en /kds, una regresion.
  - El override tenia contraste de ~2:1.
  - El modal decia "Las 1 ordenes... en cocina".
- **Plan ronda 2 (U7-U9):** corrigio los tres.

## Comprobado por el planificador (corrido por mi, no copiado)

| Chequeo | Resultado |
|---|---|
| A1 `pnpm -r run test` | exit 0, 774 tests: admin 182, PWA 100, ordering 152, session 77, gateway 77, ui 89, identity 55, catalog 39, shared-types 3 |
| `pnpm check:a4` / `pnpm lint` | exit 0 / exit 0 |
| `pnpm test:e2e` / `node scripts/e2e-checkout-pending.mjs` | exit 0 / exit 0 |
| Build de packages + services / `tsc --noEmit` de admin y PWA | exit 0 / exit 0. No corri `next build` con dev arriba; agy si corrio A2 completo parando y reiniciando dev, exit 0 en las dos rondas |
| Diff | Fronteras respetadas. Fixtures de tests viejos pasan de READY a DELIVERED, coherente con la regla nueva |

**En el navegador, sobre wip:**
- **H1:** la PWA solo tiene "Pedir la cuenta" y funciona ("Cuenta pedida"); no queda un boton Pagar muerto.
- **H3:** al recargar `/menu`, se mantiene "Orden #2gjtv7 Recibido".
- **D2 con una orden de bar en PLACED, como ADMIN:**
  - Registrar cobro -> aviso "Hay pedidos pendientes..." con "Orden #2gjtv7 — Por preparar (Bar: Por preparar)".
  - Override -> modal -> "Cobro registrado. Mesa liberada."
  - Por API: CANCELLED, cancelReason checkout, barStatus CANCELLED, historial PLACED -> CANCELLED con reason checkout, 0 activas.
- **H4:** "Cerrar sesion" visible en el PanelShell. Con STAFF lleva a /login y deja vacios `resto_access_token`, `resto_user` y `resto_refresh_token`.
- **STAFF (usuario temporal, borrado despues):**
  - Abre /checkout, /dashboard y /meseros.
  - /menu y /ajustes -> /kds.
  - Su menu lateral muestra solo Resumen, KDS, Meseros y Checkout.
- **Contraste del override:** `#7a3030` sobre `#ffffff`, 9.16:1. Lo midio agy; confirme en el codigo que usa esos tokens.

## Sugerencia de recorrido para tu verificacion

1. Pasa la demo a `hybrid`: `PATCH /v1/tenant/settings`. La sesion cachea el modo unos 30 s.
2. Abre el QR de una mesa, pide algo, recarga (H3) y pide la cuenta (H1).
3. Como admin, en Checkout: el 409 con la lista, el override y el modal. Comprueba que el KDS y el monitor de bar la retiran en vivo.
4. En Terminal de Caja, con CASHIER: ve la lista y el aviso, nunca el override.
5. Devuelve la demo a `waiter_only` al terminar.

## Estado del entorno

- **Stack:** corre el de wip en 4000/3000/3001. El de `resto-main-test` esta parado y conserva sus volumenes; agy renombro sus contenedores parados a `resto-main-test_*` para liberar los `container_name`.
- **Demo:** 0 ordenes activas, 0 sesiones, `operatingMode: waiter_only`.
- **Datos de prueba que quedan en la demo:**
  - El pago de prueba de $8.000 de la Mesa 4 (`ord-1794257810912-gjtv7`).
  - Los pagos que crean los scripts e2e.

## Observaciones fuera de alcance (no se tocaron)

1. **PWA con `QR_DISABLED`:** muestra el generico "Error abriendo sesion" en vez del mensaje del backend ("El pedido por codigo QR esta desactivado..."). Ya existia antes de este hilo.
2. **Modo de operacion en el PanelShell:** la etiqueta "Modo de Operacion: Hibrido (QR + Meseros)" esta escrita a mano en `PanelShell.tsx:468`, asi que muestra Hibrido aunque el tenant este en `waiter_only`. Tambien existia antes.
3. **Integracion main <-> wip:** sigue como propuesta sin ejecutar. main conserva los 4 hallazgos hasta que se integre.
