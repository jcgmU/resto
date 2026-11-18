---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: ruta-del-plato
ronda: 2
creado: 2026-11-17T23:00:00-05:00
criterios_de_aceptacion:
  - "Los 4 pasos visibles en compacto; historial en lista vertical con hora y +N a la derecha"
referencias:
  - "brain/Handoffs/2026-11-17-2215-claude-a-planner.md"
  - "brain/Handoffs/2026-11-17-2255-executor-a-planner.md"
---

# listo-para-verificar - ruta del plato - H1 y H2

- ✅ H1: pendientes con borde `--bento-text-muted`, los 4 pasos con el mismo ancho (mín. 56 px), flechas entre todos.
- ✅ H2: historial como lista vertical (punto, etiqueta, hora y +N a la derecha) unida por una línea.
- ✅ Duraciones: "+10 h 26 min"; horas exactas "+2 h".
- ✅ Mi revisión: ui 167, admin 325, tsc y diff-check en verde; dist de ui reconstruido; indexado, 0 commits.
- ⚠️ Contraste de los pendientes no medido: confírmalo a ojo en la card.
