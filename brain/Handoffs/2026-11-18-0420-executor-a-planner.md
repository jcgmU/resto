---
de: executor
para: planner
tipo: ejecucion
estado: hecho
hilo: cajero-historial
ronda: 1
creado: 2026-11-18T04:20:00-05:00
criterios_de_aceptacion:
  - "Cajero ve historial (200) y otro tenant 404; ruta en detalle en checkout y terminal de caja; bateria verde; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0350-planner-a-executor.md"
---

# ejecucion - cajero-historial - ronda 1

- ✅ C1: `cashier` añadido a `ORDER_HISTORY_ROLES` en ordering. Contrato nuevo (rojo primero, el cajero daba 403): cajero 200 con el evento, cajero de otro tenant 404, mesero sin cambios; el test existente del guest de otra sesion (403) sigue verde.
- ✅ C2: test de gateway `/v1/orders/:id/history` con token CASHIER llega a ordering con su rol; verde de entrada, sin cambios en la tabla del gateway.
- ✅ C3: la cuenta de checkout (`BillSummaryCard`, compartida por el panel y `terminal-caja`) tiene «Ver ruta» por orden (sin canceladas): no carga hasta pulsar, abre `OrderRoute` en detalle con `fetchOrderHistory`, con carga, error con Reintentar y «Ocultar ruta». 4 tests nuevos (rojos primero): unidad, error/reintento y flujo completo en checkout del panel y en terminal-caja.
- ✅ C4: ordering 289 (BD 5435, Redis 6381/3, runInBand), gateway 120, admin 335 en 2 corridas (39 suites), tsc admin 0, check:a4 PASS, diff-check limpio; 0 commits, sin next build.
- ⚠️ Los tests de ordering solo corren contra la BD de integracion con `ORDERING_DATABASE_URL` (5435) y `REDIS_ORDERING_TEST_URL` (6381/3); el default apunta a 5432.
- ⚠️ El servicio ordering vivo del stack necesita reinicio para tomar el nuevo rol; no lo toque. En navegador lo comprueba claude.
