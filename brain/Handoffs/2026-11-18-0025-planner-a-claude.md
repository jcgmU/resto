---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: checkout-mesas-duplicadas
ronda: 1
creado: 2026-11-18T00:25:00-05:00
criterios_de_aceptacion:
  - "Checkout muestra cada mesa una vez; respuestas viejas no pisan la lista"
referencias:
  - "brain/Handoffs/2026-11-17-2355-planner-a-executor.md"
  - "brain/Handoffs/2026-11-18-0020-executor-a-planner.md"
---

# listo-para-verificar - checkout sin mesas duplicadas

- ✅ session no duplica: contrato nuevo con aperturas concurrentes (QR y personal) deja 1 sesión activa por mesa; sin cambios en session.
- ✅ Causas reproducidas en admin y corregidas: sesión repetida (dedupe por `sessionId`), respuesta vieja de refetch que pisaba la nueva (se ignora) y sesiones gemelas de la misma mesa.
- ✅ Mi revisión: session 124, admin 330, tsc y diff-check en verde; indexado, 0 commits.
- ⚠️ Cambia un comportamiento aprobado (H9): las gemelas ya no son 2 tarjetas con la mesa repetida, sino 1 tarjeta "N sesiones activas" con una fila por sesión (hora y #) para elegir. Confírmalo o lo revierto.
- ⚠️ El stack vivo no tenía sesiones: abre dos mesas, cobra y refresca para verlo.
