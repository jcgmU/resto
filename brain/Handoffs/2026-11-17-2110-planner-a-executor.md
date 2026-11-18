---
de: planner
para: executor
tipo: plan
estado: hecho
hilo: ruta-del-plato
ronda: 1
creado: 2026-11-17T21:10:00-05:00
criterios_de_aceptacion:
  - "Cada card del monitor (cocina y bar) muestra la ruta Recibido → En cocina → Listo → Entregado con flechas y el paso actual resaltado, sin pedir nada al servidor"
  - "Ver historial despliega la misma ruta con hora de cada paso y duracion entre pasos (desde /orders/:id/history); cancelado corta la ruta"
  - "Componente compartido con tokens bento; movimiento reducido; accesible (lista ordenada con aria-current)"
  - "Test en rojo primero; ui-components, admin, tsc, A4, guardian; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-2100-claude-a-planner.md"
---

# plan - ruta del plato en el monitor (siguiente de la cola)

Hoy el monitor solo tiene "Ver historial" con una lista de eventos (`KdsOrderCard`).

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| R1 | 1 | Funcion pura `buildOrderRoute(status, events?)` → pasos `{ status, label, state: 'done'\|'current'\|'pending'\|'cancelled', at?, durationMs? }`; orden PLACED, IN_KITCHEN, READY, DELIVERED; CANCELLED marca el paso donde se corto; eventos desordenados o repetidos se toleran | - | si | estandar | unit tests rojo→verde (cada estado, cancelado, eventos faltantes, duraciones) |
| R2 | 1 | `OrderRoute` en ui-components (`kit`): `<ol>` horizontal con flechas entre pasos, actual con `aria-current="step"` y acento del estado (tokens), modo compacto (solo puntos/flechas y etiqueta del actual) y modo detalle (hora HH:mm y "+N min" entre pasos); flecha del tramo activo con animacion suave que respeta movimiento reducido | R1 | si | estandar | tests rojo→verde de render, aria y reduced-motion; guardian verde |
| R3 | 2 | `KdsOrderCard`: ruta compacta siempre visible; "Ver historial" muestra la ruta en detalle con los eventos (mantener carga, error y cerrar); quitar la lista anterior | R2 | si | estandar | tests de kds actualizados y nuevos verdes |
| R4 | 3 | Bateria: ui-components, admin (2 corridas por los KDS intermitentes), tsc admin, `check:a4`, diff-check | R3 | no | ligero | numeros de salida |
| **Parada** | - | Handoff `executor-a-planner` | R4 | - | - | - |

- R1 vive junto a `OrderRoute` (ui-components) o en shared-types si lo ves mejor; sin backend nuevo.
- Reglas de siempre: sin stash/reset/checkout --, sin migraciones, no tocar generated/client, sin next build, 0 commits.
