---
de: planner
para: executor
tipo: plan
estado: hecho
hilo: checkout-mesas-duplicadas
ronda: 1
creado: 2026-11-17T23:55:00-05:00
criterios_de_aceptacion:
  - "Causa confirmada o descartada con evidencia (test o respuesta real del endpoint), no por lectura"
  - "Checkout muestra cada mesa una sola vez con sus sesiones activas; test en rojo primero si hay bug"
  - "session: una mesa no puede tener dos sesiones activas a la vez (contrato)"
  - "Bateria: session (Redis 6381/2), admin, tsc, A4, diff-check; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-2350-claude-a-planner.md"
---

# plan - checkout: mesas duplicadas (siguiente de la cola)

Pendiente de la cola: "comprobar que no salen mesas duplicadas" en checkout. Primero investigar, luego arreglar solo si hay causa.

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| D1 | 1 | Investigar: lista de sesiones activas en checkout (`checkout/page.tsx` + `components/checkout`). Posibles causas: dos sesiones activas en la misma mesa (session), la misma sesion repetida por polling/refetch concurrente, o `key` por `tableId`. Escribe tests que reproduzcan cada una | - | si (research) | estandar | informe con que test falla y cual no |
| D2 | 2 | session: contrato "abrir sesion en mesa con sesion activa devuelve la existente o 409" y "listado de activas sin dos de la misma mesa"; arreglar si falla | D1 | si | estandar | rojo→verde o verde documentado |
| D3 | 2 | admin checkout: dedupe por `sessionId`, `key` por `sessionId`, agrupar por mesa si hay mas de una sesion (legado) mostrando la mesa una vez; respuestas de refetch fuera de orden no pisan la lista (ignora la vieja) | D1 | si | estandar | tests rojo→verde |
| D4 | 3 | Bateria y handoff | D2, D3 | no | ligero | numeros |
| **Parada** | - | Handoff `executor-a-planner`; claude lo comprueba en navegador | D4 | - | - | - |

- Si D1 no encuentra causa en ninguna capa, para tras D1 y reporta (no cambies codigo por cambiar).
- Reglas de siempre: sin stash/reset/checkout --, sin migraciones, no tocar generated/client, sin next build, 0 commits.
