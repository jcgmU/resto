---
de: planner
para: codex
tipo: plan
estado: hecho
hilo: sistema-de-diseno
ronda: 7
creado: 2026-11-17T12:45:00-05:00
criterios_de_aceptacion:
  - "Lista de pendientes del test guardian vacia (terminal-mesero, ProductDetailSheet, CartSheet y cualquier otro)"
  - "BottomSheet con framer-motion; Modal como sheet en tablet; tests de cambio de modo, cierre por arrastre y foco"
  - "pnpm install --frozen-lockfile verde con framer-motion"
  - "Bateria A1, A2, A4, A11 con numeros; 0 commits; sin next build de admin"
referencias:
  - "brain/Handoffs/2026-11-16-2021-planner-a-executor.md"
  - "brain/Handoffs/2026-11-17-1240-claude-a-planner.md"
---

# plan - sistema-de-diseno - U10 a U12 (parada 2 aprobada)

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| U10 | 4 | Terminales (mesero, caja, monitor) y PWA a los componentes compartidos (Modal, Button, StatusCard, AvailabilityToggle, Avatar); quitar sus excepciones del guardian | - | si (uno por app) | estandar | guardian sin pendientes; tests de terminales y PWA verdes |
| U11 | 5 | `BottomSheet` en ui-components con `framer-motion` (dependencia nueva aprobada; lockfile actualizado): `AnimatePresence`, `y` 100%→0, `cubic-bezier(0.19, 1, 0.22, 1)`, arrastrar para cerrar, `layout` para crecer; respeta movimiento reducido. `Modal` se muestra como sheet en tablet (ancho <= 1024 px y puntero tactil). Con scrim para formularios, cobro y borrados; inspector sin scrim solo para consultar mesa del plano. Sigue en portal y con la pila de Escape | U10 | si | potente | tests rojo→verde de cambio de modo, cierre por arrastre, foco y Escape |
| U12 | 6 | Bateria A1, A2, A4, A11 y `pnpm install --frozen-lockfile`; seccion de componentes del sistema de diseno en `01_Arquitectura/UI_UX_Guidelines.md` del worktree (claude la revisa) | U11 | no | estandar | numeros de la salida; 0 commits |
| **Parada 3** | - | Handoff `codex-a-planner`; reviso y claude verifica en navegador (terminales, PWA y tablet) | U12 | - | - | visto bueno |

- Test en rojo antes de cada cambio; anota el rojo en tu handoff.
- Reglas de siempre (sin stash/reset/checkout --, sin migraciones, no tocar generated/client, sin next build de admin). Si git add falla, lo indexo yo.
