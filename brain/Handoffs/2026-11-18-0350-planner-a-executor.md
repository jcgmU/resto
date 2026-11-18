---
de: planner
para: executor
tipo: plan
estado: hecho
hilo: cajero-historial
ronda: 1
creado: 2026-11-18T03:50:00-05:00
criterios_de_aceptacion:
  - "GET /v1/orders/:id/history: cajero 200 en su tenant; otro tenant 404; guest sigue limitado a su sesion"
  - "Terminal de caja (y checkout del panel) puede ver la ruta en detalle de cada orden de la cuenta con OrderRoute"
  - "Test en rojo primero; ordering (BD 5435), gateway, admin, tsc, A4; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0345-claude-a-planner.md"
---

# plan - cajero con historial de una orden (hoy 403)

Causa: `ORDER_HISTORY_ROLES` en ordering (`authzRoles.ts`) no incluye `cashier`; `OrderUseCases` lo usa en `getOrderHistory`. El gateway no filtra roles en esa ruta.

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| C1 | 1 | ordering: añadir `cashier` a `ORDER_HISTORY_ROLES`. Contrato: cajero 200, cajero de otro tenant 404, guest de otra sesion sigue 403/404 como hoy, mesero sin cambios | - | si | ligero | rojo→verde |
| C2 | 1 | gateway: test de `/v1/orders/:id/history` con token de cajero llega a ordering (sin cambios esperados en la tabla) | - | si (mismo) | ligero | test verde |
| C3 | 2 | admin: en la cuenta de checkout (componente compartido por panel y terminal de caja), boton "Ver ruta" por orden que abre `OrderRoute` en modo detalle con `fetchOrderHistory` (carga, error con reintento, cerrar); no carga nada hasta pulsar | C1 | si | estandar | tests rojo→verde en checkout y terminal-caja |
| C4 | 3 | Bateria (admin 2 corridas) y handoff; quitar la idea de "sin priorizar" lo hace claude | C1-C3 | no | ligero | numeros |
| **Parada** | - | Handoff `executor-a-planner` | C4 | - | - | - |

- Reglas de siempre: sin stash/reset/checkout --, sin migraciones, no tocar generated/client, sin next build, 0 commits.
