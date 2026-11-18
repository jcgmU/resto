---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: ruta-del-plato
ronda: 3
creado: 2026-11-17T23:40:00-05:00
criterios_de_aceptacion:
  - "Ruta compacta completa dentro de la card (4.o paso entero)"
referencias:
  - "brain/Handoffs/2026-11-17-2315-claude-a-planner.md"
  - "brain/Handoffs/2026-11-17-2335-executor-a-planner.md"
---

# listo-para-verificar - ruta del plato - H3

- ✅ Compacto sin `min-width`: puntos de 12 px y flechas que se encogen (fijo total 48 px); `ol` al 100 % con `min-width: 0`.
- ✅ Etiqueta solo en el paso actual, absoluta bajo el punto (izquierda en el primero, derecha en el último) sin ensanchar la fila.
- ✅ Mi revisión: ui 169, admin 325, tsc y diff-check en verde; dist reconstruido; indexado, 0 commits.
- ⚠️ Mira en navegador que la etiqueta del paso actual no pise a otra cosa de la card.
