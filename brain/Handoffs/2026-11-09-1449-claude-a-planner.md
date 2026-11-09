---
de: claude
para: planner
tipo: objetivo
estado: hecho
hilo: qa-main-hallazgos-flujo-completo
ronda: 2
creado: 2026-11-09T14:49:37
criterios_de_aceptacion:
  - "Plan a agy con tabla de unidades sobre la rama wip/correcciones-qa-y-notas (D1 = A)."
  - "Cobro con ordenes sin entregar: 409 ORDERS_NOT_DELIVERED con detalle de ordenes faltantes y opcion explicita 'Cobrar igual y cerrar pedidos' solo admin/manager (D2 = A)."
  - "Las ordenes cerradas por esa opcion pasan a CANCELLED con motivo checkout, salen del KDS y del Dashboard y quedan en historial."
  - "Logout en PanelShell (hallazgo 4) y confirmacion en navegador de los hallazgos 1 y 3 en wip antes de darlos por resueltos."
referencias:
  - "brain/Handoffs/2026-11-09-1445-planner-a-usuario.md (bloqueo, marcado hecho)"
  - "brain/Handoffs/2026-11-09-1442-claude-a-planner.md (objetivo ronda 1)"
---

# objetivo - qa-main-hallazgos-flujo-completo - ronda 2

El usuario respondio tu bloqueo:

- **D1 = A:** implementar sobre **wip/correcciones-qa-y-notas**. Las rondas 6 y 7 del arbol sucio ya estan commiteadas localmente (4812918 codigo, bdae92f docs; sin push). Quedan sin commitear solo .team/team.toml, STATE.md, los tsbuildinfo y los handoffs de este hilo.
- **D2 = A:** bloquear y avisar, con la opcion explicita "Cobrar igual y cerrar pedidos" solo para admin y manager (ordenes a CANCELLED, motivo checkout).

## Pedido

1. Emite el plan a agy (~5 unidades segun tu estimacion): hallazgo 2 con D2-A, hallazgo 4 (logout en PanelShell) y los menores que sigan abiertos en wip (/pagos dice solo efectivo; rol por defecto del dialogo Agregar miembro; STAFF aterriza en ruta sin permiso si aplica en wip).
2. Antes de cerrar los hallazgos 1 y 3 como resueltos en wip, comprobalos tu en navegador o pide a agy que lo evidencie; yo los reverifico al final.
3. Abre como hilo aparte (solo propuesta, sin ejecutar) la integracion main <-> wip: dos modelos de roles, 76 archivos tocados en ambas ramas. Incluye que main sigue con los 4 hallazgos hasta entonces.
4. Entrega el plan por handoff y avisame cuando haya listo-para-verificar.
