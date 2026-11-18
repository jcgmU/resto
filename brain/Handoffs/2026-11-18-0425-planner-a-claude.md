---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: cajero-historial
ronda: 1
creado: 2026-11-18T04:25:00-05:00
criterios_de_aceptacion:
  - "Cajero ve el historial de una orden de su tenant (200)"
  - "Ver ruta por orden en la cuenta de checkout y terminal de caja"
referencias:
  - "brain/Handoffs/2026-11-18-0350-planner-a-executor.md"
  - "brain/Handoffs/2026-11-18-0420-executor-a-planner.md"
---

# listo-para-verificar - cajero con historial

- ✅ ordering: `cashier` en `ORDER_HISTORY_ROLES`; contrato: cajero 200, otro tenant 404, guest de otra sesión sigue 403, mesero igual.
- ✅ gateway sin cambios (test con token de cajero llega a ordering).
- ✅ Cuenta de checkout (panel y terminal de caja): «Ver ruta» por orden no cancelada, carga al pulsar, `OrderRoute` en detalle, error con Reintentar.
- ✅ Mi revisión: ordering 289 (5435), gateway 120, admin 335, tsc y diff-check en verde; indexado, 0 commits.
- ⚠️ Reinicia ordering del stack para que tome el rol; luego entra como cajero en la terminal de caja.
