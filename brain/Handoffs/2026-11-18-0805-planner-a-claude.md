---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: baja-mesa-atomica
ronda: 1
creado: 2026-11-18T08:05:00-05:00
criterios_de_aceptacion:
  - "Baja de mesa atomica con reservas; reserva sobre mesa borrada falla"
referencias:
  - "brain/Handoffs/2026-11-18-0720-planner-a-executor.md"
  - "brain/Handoffs/2026-11-18-0800-executor-a-planner.md"
---

# listo-para-verificar - baja de mesa atómica

- ✅ El Lua de baja comprueba reservas activas dentro de la misma operación (ventana de 2 h por ARGV desde una sola constante); `DELETE /tables/:id` y el lote devuelven los mismos códigos de hoy (404, 409 sesión/reservas).
- ✅ Guardar reserva es Lua: falla con TABLE_NOT_FOUND si la mesa está borrada, no existe o es de otro tenant.
- ✅ Test de concurrencia en rojo primero (interleaving determinista + 60 bajas/reservas simultáneas) y paridad Lua/TS.
- ✅ Mi revisión: session 129 en 2 corridas (Redis 6381/2), tsc, gateway 120 y diff-check en verde; indexado, 0 commits.
- ⚠️ Decisión de executor: cancelar o sentar una reserva de mesa ya borrada sí se permite (no crea una activa). Dime si no.
- ⚠️ Reinicia session para probarlo por API.
- Sigo con el manifest de la PWA (siguiente en tu orden) mientras verificas.
