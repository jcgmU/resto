# Propuesta (sin ejecutar): integración main <-> wip

- **Fecha:** 2026-11-09
- **Estado:** Propuesto. Es un hilo aparte (`integracion-main-wip`), pendiente de que el usuario y el orquestador lo abran.
- **Origen:** hilo qa-main-hallazgos-flujo-completo, ronda 2, pedido 3.

## Situación

- Las ramas divergen desde `a2c0f09`:
  - `origin/main`: `fe0606a`, 16 commits propios (roles MANAGER/STAFF y gestión de equipo, hardening de los 5 servicios, mesas por lotes con rotación atómica de QR, dashboard nuevo con COP, CI y script de hardening).
  - `wip/correcciones-qa-y-notas`: `bdae92f`, 11 commits propios (línea gráfica Suite, roles WAITER/CASHIER/MONITOR, terminales, destino por categoría, TTL de sesión, DIAN, eventos de mesa, formatCOP).
- **76 archivos de código tocados en las dos ramas:** identity 21, ordering 18, session 10, admin-dashboard 10, catalog 8, shared-types 5, gateway 4.
- **Modelos de roles:** el enum de wip (ADMIN, MANAGER, STAFF, CUSTOMER, WAITER, MONITOR, CASHIER) es un superconjunto del de main (ADMIN, MANAGER, STAFF, CUSTOMER). El conflicto real está en los arrays de autorización del gateway y de ordering, y en la gestión de equipo: la UI de Equipo de main frente a la sección de empleados en /ajustes de wip.
- **Migraciones de identity incompatibles:** main tiene `init_identity` y `add_disabled_user_status`; wip tiene `tenant_settings` y `add_waiter_monitor_roles`/`add_cashier...` sobre otra historia. Hace falta una línea de migraciones reconciliada. Riesgo: las BDs existentes de cada rama no migran limpio a la otra.
- **Mientras no se integre, main conserva los 4 hallazgos** del recorrido QA (Pagar muerto, orden cobrada en el KDS, seguimiento perdido al recargar, sin logout) y los menores (precios sin COP, /pagos). El hilo `qa-main-hallazgos-flujo-completo` solo los cierra en wip.

## Opciones

1. **(Recomendada) Merge de main en wip, en una rama `integracion/main-wip`**, después de cerrar el hilo QA actual.
   - Se resuelven los conflictos por servicio, en oleadas: shared-types, luego identity (migraciones y roles), luego gateway y ordering y session y catalog, y por último los frontends.
   - El criterio es conservar los dos conjuntos de funcionalidades: hardening, lotes y equipo de main, más terminales, Suite y roles de wip.
   - Al final, A1 a A14 en verde y un PR a main.
2. **Rebase de wip sobre main.** Produce un historial lineal, pero los conflictos se resuelven commit a commit (11 veces). Es más caro y no gana nada funcional.
3. **Cherry-pick selectivo de main a wip** (hardening, lotes). Es menos riesgo inicial, pero deja main y wip divergentes indefinidamente. No recomendado.

## Primer paso si se aprueba

Objetivo nuevo del orquestador. El planificador lo convierte en un plan con un inventario de conflictos por archivo (`git merge --no-commit` en un worktree aislado) y una matriz de roles por ruta reconciliada, antes de que el ejecutor toque nada.
