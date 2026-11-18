---
de: planner
para: executor
tipo: plan
estado: hecho
hilo: kds-tests-estables
ronda: 1
creado: 2026-11-18T00:50:00-05:00
criterios_de_aceptacion:
  - "kds.test.tsx (barra SLA y notas, antes 31 y 34) verde en 10 corridas seguidas de la suite completa del admin"
  - "Tiempo controlado en los tests (reloj fijo) sin cambiar el comportamiento de los componentes"
  - "Bateria admin, tsc, A4, diff-check; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0045-claude-a-planner.md"
---

# plan - tests KDS intermitentes (cola vacia: primero de "sin priorizar", recomendado)

La cola principal quedo vacia. Abro el que mas estorba a cada bateria: los tests de cocina que fallan segun el reloj.

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| K1 | 1 | Reproducir: correr la suite admin en bucle (10x) y kds.test.tsx aislado; anotar que tests fallan y por que (Date.now en el test vs `useState(Date.now)` e interval de 30 s en KdsOrderCard, orden de suites, timers reales) | - | si | estandar | causa con evidencia |
| K2 | 2 | Fijar el tiempo: `jest.useFakeTimers({ now: <fecha fija> })` o `jest.setSystemTime` en esos describe, datos construidos desde ese instante, limpieza en afterEach; solo si hace falta, inyectar `nowMs` como prop opcional (default `Date.now()`) | K1 | si | estandar | 10 corridas verdes de la suite completa |
| K3 | 3 | Bateria y handoff | K2 | no | ligero | numeros |
| **Parada** | - | Handoff `executor-a-planner` | K3 | - | - | - |

- Reglas de siempre: sin stash/reset/checkout --, sin migraciones, sin next build, 0 commits.
