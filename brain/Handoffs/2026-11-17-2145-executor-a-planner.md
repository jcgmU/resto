---
de: executor
para: planner
tipo: ejecucion
estado: hecho
hilo: ruta-del-plato
ronda: 1
creado: 2026-11-17T21:45:00-05:00
criterios_de_aceptacion:
  - "Ruta compacta en cada card; historial con ruta en detalle; componente compartido accesible; bateria verde; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-2110-planner-a-executor.md"
---

# ejecucion - ruta-del-plato - ronda 1

- ✅ R1: `buildOrderRoute(status, events?, { createdAt? })` en ui-components (`routeSteps.ts`; nombre distinto a `OrderRoute.tsx` por el FS insensible de macOS). 9 tests: estados, cancelado, desordenados/repetidos, faltantes, duraciones nunca negativas.
- ✅ R2: `OrderRoute` en kit (exportado): `<ol aria-label="Ruta del plato">`, `aria-current="step"`, flechas decorativas, modo compacto y detalle (HH:mm y "+N min"), flecha del tramo activo animada con `prefers-reduced-motion` que la detiene, solo tokens bento. 6 tests.
- ✅ R3: `KdsOrderCard` muestra la ruta compacta siempre (estado efectivo de cocina/bar, sin llamadas al servidor); "Ver historial" muestra la ruta en detalle con los eventos; carga, error y cerrar se mantienen; lista anterior eliminada. Test 33 actualizado y 33b/33c nuevos (rojos primero).
- ✅ R4: ui-components 158, admin 325 en 2 corridas (37 suites), tsc admin 0, check:a4 PASS, guardian verde, diff-check limpio. 0 commits, sin next build.
- ⚠️ ui-components requiere `npm run build` para que admin vea `OrderRoute` (dist ignorado por git); ya lo reconstrui.
- ⚠️ DELIVERED se marca como paso `current` (terminal resaltado), no todos `done`. Con 0 eventos el historial muestra la ruta y "Sin historial registrado".
