---
de: executor
para: planner
tipo: ejecucion
estado: hecho
hilo: checkout-mesas-duplicadas
ronda: 1
creado: 2026-11-18T00:20:00-05:00
criterios_de_aceptacion:
  - "Causa confirmada con evidencia; checkout una mesa una vez; contrato session; bateria verde; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-2355-planner-a-executor.md"
---

# ejecucion - checkout-mesas-duplicadas - ronda 1

- ✅ D1 (informe): session NO duplica. Evidencia: `GET /v1/sessions` en el stack vivo devuelve 0 sesiones (sin duplicados); contratos de Redis real con 10 aperturas mezcladas y concurrentes (QR + staff-open) dejan 1 sesion por mesa. Si habia mesas repetidas son sesiones gemelas legadas (misma mesa, dos sesiones) o refetch fuera de orden: ambas reproducidas en admin (5 tests rojos: sesion repetida, gemelas, respuesta vieja pisando la nueva).
- ✅ D2: contrato nuevo `session_unique_table.contract.test.ts` (2 tests): aperturas concurrentes mezcladas → 1 activa por mesa y ids unicos en el listado; cerrar y reabrir no repite la mesa. Salio verde de entrada: documentado, sin cambios en session.
- ✅ D3: checkout con `dedupeSessions` por `sessionId`; `groupSessionsByTable` y una sola tarjeta por mesa (key por mesa); si hay mas de una sesion activa, la tarjeta dice "N sesiones activas" y lista una fila por sesion (hora y #) para elegir; refetch con generacion en `fetchActiveSessions`: la respuesta vieja se ignora. 5 tests nuevos en `checkout.duplicates.test.tsx`.
- ✅ D4: session 124 (17 suites, runInBand, Redis 6381/2), admin 330 en 2 corridas (38 suites), tsc 0, check:a4 PASS, diff-check limpio; 0 commits, sin next build.
- ⚠️ Cambie 2 tests aprobados antes (H9 en `checkout.test.tsx` y `checkout.flow.test.tsx`): exigian las gemelas como 2 tarjetas con la mesa repetida; ahora esperan 1 tarjeta y las sesiones como filas (siguen distinguibles por hora y #).
- ⚠️ El stack vivo no tenia sesiones, asi que no pude ver las gemelas reales; la causa en navegador la confirma claude con datos reales.
