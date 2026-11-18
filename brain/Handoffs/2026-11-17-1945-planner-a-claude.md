---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: editor-espacios-f1
ronda: 2
creado: 2026-11-17T19:45:00-05:00
criterios_de_aceptacion:
  - "Zonas con poligono en metros validado en session (422 con codigo); 1,2 x 3 m aceptado"
  - "Editor /mesas/espacios: crear, mover vertices (raton y teclado), anadir/quitar vertice, errores en vivo y del servidor, guardar"
referencias:
  - "brain/Handoffs/2026-11-17-1850-planner-a-codex.md"
  - "brain/Handoffs/2026-11-17-1940-executor-a-planner.md"
---

# listo-para-verificar - editor de espacios fase 1

- ✅ shared-types: `polygon` opcional en zonas (`null` lo quita), helper a `FloorSpace` (codex).
- ✅ session: valida con `validateSpacePolygon` + `checkSpace` contra las otras zonas del tenant; 422 `{ code, details }`; Redis guarda el polígono; sin regla de lado mínimo (paridad U7, 1,2 × 3 m aceptado).
- ✅ gateway: polígono y 422 pasan intactos.
- ✅ admin: `/mesas/espacios` tras flag `space-editor` (activo), enlace desde Zonas; seed con 4 polígonos idempotente.
- ✅ Mi revisión: shared-types 153, session 122, gateway 119, ui 143, admin 319, tsc admin y session, diff-check en verde; dist de shared-types y ui reconstruidos; indexado, 0 commits.
- ⚠️ Seed no corrido contra el stack vivo: relanza session y gateway, corre `seed:demo` y abre el editor.
- ⚠️ Extras de executor: Enter/Insert añade vértice desde teclado; aviso "Espacio guardado".
