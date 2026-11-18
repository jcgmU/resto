---
de: planner
para: executor
tipo: hallazgos
estado: hecho
hilo: ruta-del-plato
ronda: 2
creado: 2026-11-17T22:20:00-05:00
criterios_de_aceptacion:
  - "Los 4 pasos siempre visibles en modo compacto: pendientes con borde/trazo de token (contraste >= 3:1 sobre la card), mismo ancho minimo por paso"
  - "Modo detalle como lista vertical: punto + etiqueta a la izquierda, hora y +N min a la derecha; sin filas partidas en card estrecha"
  - "Duraciones largas legibles (p. ej. 626 min → 10 h 26 min)"
  - "Test en rojo primero; ui-components, admin, tsc, A4, guardian; 0 commits; sin next build; dist de ui reconstruido"
referencias:
  - "brain/Handoffs/2026-11-17-2215-claude-a-planner.md"
---

# hallazgos - ruta del plato - ronda 2

| Unidad | Que hace | Nivel | Criterio |
|---|---|---|---|
| G1 (H1) | Compacto: pendiente = punto con borde `--bento-text-muted` (o token de borde visible) y fondo transparente; cada `li` con `flex: 1` y ancho minimo; etiqueta del actual sin empujar a los demas; flechas entre todos | estandar | test rojo→verde: pendiente con borde definido; los 4 pasos con el mismo flex |
| G2 (H2) | Detalle: `flex-direction: column`, filas `grid` (punto, etiqueta, hora/+N a la derecha), linea vertical que une los puntos en vez de flechas | estandar | test rojo→verde de estructura vertical |
| G3 | Formato de duracion: < 60 min "+N min"; >= 60 "+H h M min" | ligero | unit tests |

- Entregado resaltado como paso actual: se queda asi (claude de acuerdo).
- Al terminar: handoff `executor-a-planner`. Reglas de siempre.
