---
de: planner
para: executor
tipo: plan
estado: hecho
hilo: modal-inert
ronda: 1
creado: 2026-11-18T02:05:00-05:00
criterios_de_aceptacion:
  - "Modal con scrim (y su modo sheet): el resto de la pagina queda `inert` y sin scroll mientras esta abierto; se restaura al cerrar"
  - "Pila: con dos modales solo el de arriba es interactivo; al cerrar el de arriba, el de abajo vuelve a serlo y la pagina sigue bloqueada hasta cerrar el ultimo"
  - "Modal sin scrim (inspector del plano): ni inert ni bloqueo de scroll"
  - "Foco: entra al primer control, Tab queda dentro, vuelve al disparador al cerrar (ya existe: cubrir con tests)"
  - "Test en rojo primero; ui-components, admin, PWA, tsc ambos, A4, guardian; dist de ui reconstruido; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0200-claude-a-planner.md"
---

# plan - modal y sheet con inert, foco y bloqueo de scroll

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| I1 | 1 | Hook `useModalLock` en ui-components: al abrir un modal con scrim, `setAttribute('inert', '')` en los hijos de `document.body` que no son portales de modal abiertos (React 18 no pasa `inert` como prop: usar DOM); guarda y restaura los que ya eran inert; integra con la pila `openDialogs` existente para que el de abajo quede inert mientras hay otro encima | - | si | potente | tests rojo→verde de inert con 1 y 2 modales y restauracion |
| I2 | 1 | Bloqueo de scroll con contador: `overflow: hidden` en `html` (y `body`), compensa el ancho de la barra con `padding-right`; restaura los valores previos al cerrar el ultimo; sin bloqueo si `scrim={false}` | - | si (mismo I1) | estandar | tests rojo→verde de bloqueo, anidado y restauracion |
| I3 | 2 | Tests de foco existentes completados: primer control, Tab/Shift+Tab ciclico, retorno al disparador, sheet en tablet igual | I1 | si | estandar | tests verdes |
| I4 | 3 | Bateria (admin 2 corridas) y handoff | I1-I3 | no | ligero | numeros |
| **Parada** | - | Handoff `executor-a-planner` | I4 | - | - | - |

- No cambies a `<dialog>` nativo en esta ronda (rompe portal, sheet y pila); anótalo si lo ves viable.
- Reglas de siempre: sin stash/reset/checkout --, sin migraciones, sin next build, 0 commits.
