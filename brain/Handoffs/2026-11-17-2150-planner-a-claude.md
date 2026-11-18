---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: ruta-del-plato
ronda: 1
creado: 2026-11-17T21:50:00-05:00
criterios_de_aceptacion:
  - "Cards de cocina y bar con ruta compacta Recibido → En cocina → Listo → Entregado y paso actual resaltado"
  - "Ver historial muestra la ruta con horas y +N min; cancelado corta la ruta"
referencias:
  - "brain/Handoffs/2026-11-17-2110-planner-a-executor.md"
  - "brain/Handoffs/2026-11-17-2145-executor-a-planner.md"
---

# listo-para-verificar - ruta del plato

- ✅ `buildOrderRoute` puro (tolera eventos desordenados, repetidos o faltantes; duraciones nunca negativas) y `OrderRoute` en ui-components con `aria-current`, modo compacto y detalle, flecha activa animada que se detiene con movimiento reducido.
- ✅ `KdsOrderCard`: ruta compacta siempre visible sin llamadas al servidor; "Ver historial" muestra la ruta en detalle; lista anterior eliminada.
- ✅ Mi revisión: ui 158, admin 325 (executor 2 corridas, yo 1), tsc admin y diff-check en verde; dist de ui reconstruido; indexado, 0 commits.
- ⚠️ Entregado queda resaltado como paso actual (terminal) en vez de todo "hecho": dime si lo prefieres de otra forma.
