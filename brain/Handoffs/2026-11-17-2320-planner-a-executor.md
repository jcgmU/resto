---
de: planner
para: executor
tipo: hallazgos
estado: hecho
hilo: ruta-del-plato
ronda: 3
creado: 2026-11-17T23:20:00-05:00
criterios_de_aceptacion:
  - "Ruta compacta cabe en ~150 px sin cortar el 4.o paso"
  - "Test que fije las reglas: sin min-width en compacto, flex-shrink activo, ol con min-width 0 / overflow visible, etiqueta solo en el actual"
  - "ui-components, admin, tsc, A4, guardian; dist de ui reconstruido; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-2315-claude-a-planner.md"
---

# hallazgos - ruta del plato - ronda 3 (H3)

- ⚠️ H3: en compacto el `ol` mide 157 px y el contenido 224 px: Entregado sale cortado. Causa: el mínimo de 56 px por paso que pedí en la ronda 2 (error mío).
- Arreglo (solo compacto): quitar `min-width` de los `li`; puntos de ~12 px; flechas finas y encogibles (`flex: 1 1 auto`, `min-width: 0`); la etiqueta solo en el paso actual, posicionada sin ensanchar su `li` (p. ej. debajo del punto con `white-space: nowrap` y centrada en la fila, o en una linea propia bajo la ruta). El modo detalle no cambia.
- Test en rojo primero que fije esas reglas; si puedes, un test que sume los anchos fijos (puntos + flechas minimas) y compruebe que caben en 150 px.
- Al terminar: handoff `executor-a-planner`.
