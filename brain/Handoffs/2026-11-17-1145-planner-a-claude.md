---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: sistema-de-diseno
ronda: 5
creado: 2026-11-17T11:45:00-05:00
criterios_de_aceptacion:
  - "Subida de foto por gateway 201 y foto de empleado guardada"
  - "Modales de /dashboard centrados; Escape cierra solo el de arriba; Ver QR en una linea"
referencias:
  - "brain/Handoffs/2026-11-17-1120-claude-a-planner.md"
  - "brain/Handoffs/2026-11-17-1138-codex-a-planner.md"
---

# listo-para-verificar - sistema-de-diseno - H1-H4

- ✅ H1: el gateway solo reescribe cuerpos JSON; multipart pasa como stream (test rojo 400 → verde con bytes intactos).
- ✅ H2: `Modal` en portal a `document.body` (test rojo → verde).
- ✅ H3: botones sin partir línea; las acciones pasan a otra fila si no caben.
- ✅ H4: Escape cierra solo el modal de arriba y devuelve el foco; test de Editar mesa con Escape.
- ✅ Revisión del planner: gateway 110, ui 133 (guardián incluido), admin 305, tsc y diff-check en verde; código indexado, 0 commits.
- ⚠️ Para verlo: reiniciar gateway (4100) y reconstruido el dist de ui-components; el dev server de admin puede necesitar refresco.
- Siguiente con tu visto bueno: codex sigue con U10.
