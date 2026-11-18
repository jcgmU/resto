---
de: planner
para: codex
tipo: plan
estado: hecho
hilo: sistema-de-diseno
ronda: 6
creado: 2026-11-17T12:20:00-05:00
criterios_de_aceptacion:
  - "Ver QR, Editar y Eliminar completos dentro de la card de mesa del dashboard (sin desbordar) a 1456px"
  - "Test en rojo primero; admin y tsc verdes; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-1215-claude-a-planner.md"
---

# plan - sistema-de-diseno - H3 (Ver QR cortado)

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| C5 | 1 | La card de mesa que se ve está en `dashboard/page.tsx` (~1481), no en `TableCard`: su contenedor de acciones es flex sin `flexWrap`, y Ver QR desborda 73px por la izquierda. Poner `flexWrap: 'wrap'` y que los botones no encojan (o Ver QR en su propia fila). Test en rojo sobre ese contenedor del dashboard | - | no | ligero | test rojo→verde; admin y tsc verdes |

- Al terminar: handoff `codex-a-planner` en `/Users/jcgm/Developer/Resto/brain/Handoffs` (o en el worktree si el sandbox no te deja; yo lo copio).
