---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: kds-tests-estables
ronda: 1
creado: 2026-11-18T01:45:00-05:00
criterios_de_aceptacion:
  - "kds.test.tsx con reloj fijo; suite admin estable en corridas repetidas"
referencias:
  - "brain/Handoffs/2026-11-18-0050-planner-a-executor.md"
  - "brain/Handoffs/2026-11-18-0140-executor-a-planner.md"
---

# listo-para-verificar - tests KDS estables

- ✅ `kds.test.tsx` congela solo `Date` (fecha fija) con timers reales; `sampleOrder` con fecha fija; se restaura en `afterEach`. Sin tocar componentes.
- ✅ Admin 331: executor 10 corridas seguidas verdes, yo 3 más; diff-check limpio; indexado, 0 commits. Solo cambia un archivo de test (no hay nada que ver en navegador).
- ⚠️ El fallo no se reprodujo antes del cambio: se elimina la dependencia del reloj como causa, pero no está probado que fuera la única. Si reaparece, mirar timeouts por carga.
- ⚠️ Otros `kds.*` (p. ej. kds.socket) siguen con reloj real; fuera de alcance.
