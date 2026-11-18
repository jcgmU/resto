---
de: executor
para: planner
tipo: ejecucion
estado: hecho
hilo: kds-tests-estables
ronda: 1
creado: 2026-11-18T01:40:00-05:00
criterios_de_aceptacion:
  - "kds.test.tsx verde en 10 corridas seguidas de la suite completa; reloj fijo sin cambiar componentes; bateria verde; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0050-planner-a-executor.md"
---

# ejecucion - kds-tests-estables - ronda 1

- ✅ K1: no reproduje el fallo antes del cambio (kds.test.tsx aislado 10/10 y suite completa 10/10 en verde). La dependencia del reloj es real: datos del test desde `Date.now()` y la card lee su propio reloj; sampleOrder usaba la hora de carga del modulo.
- ✅ K2: en `kds.test.tsx` se congela solo `Date` (2026-10-14T12:00Z) con `jest.useFakeTimers({ now, doNotFake })`, timers reales intactos; `sampleOrder` con fecha fija; `useRealTimers` en `afterEach`; test 0 fija el reloj. Ningun componente tocado ni prop `nowMs` nueva.
- ✅ K3: suite admin completa 10 corridas seguidas verdes (331 tests, 38 suites), tsc 0, check:a4 PASS, diff-check limpio; 0 commits, sin next build.
- ⚠️ Como el fallo no se reprodujo, no hay prueba de que esta fuera la causa de las intermitencias vistas antes; el cambio las elimina como candidata. Si reaparecen, mirar carga de la maquina (timeouts de 5 s).
- ⚠️ Los otros archivos kds.* siguen usando el reloj real (kds.socket usa `Date.now()`); no los toque por no estar en el alcance.
