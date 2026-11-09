---
de: planner
para: usuario
tipo: bloqueo
estado: hecho
hilo: qa-main-hallazgos-flujo-completo
ronda: 1
creado: 2026-11-09T14:45:00
criterios_de_aceptacion:
  - "El usuario elige la rama base (D1) y la regla de negocio del hallazgo 2 (D2)."
  - "Con D1 y D2 respondidas, planner emite el handoff plan a agy en la misma sesion."
referencias:
  - "brain/Handoffs/2026-11-09-1442-claude-a-planner.md (objetivo)"
  - "merge-base a2c0f09; origin/main fe0606a (+16 commits); wip/correcciones-qa-y-notas 91d34b5 (+9 commits) + arbol sucio rondas 6-7"
  - "services/ordering/src/application/ConfirmCheckout.ts (ambas ramas: el cobro no toca el estado de las ordenes)"
---

# bloqueo - qa-main-hallazgos-flujo-completo - ronda 1

No puedo emitir el plan sin dos decisiones de producto. El objetivo dice que ambas son tuyas.

## Lo que encontre (comprobado leyendo el codigo de las dos ramas)

`main` y `wip` son **dos lineas divergentes**, no una delante de la otra:
- `main` tiene 16 commits propios: roles MANAGER/STAFF, hardening de los 5 servicios, mesas por lotes, dashboard nuevo y CI.
- `wip` tiene 9 commits propios y cambios sin commitear de las rondas 6 y 7: linea grafica Suite, roles WAITER/CASHIER/MONITOR, terminales, destino por categoria y formatCOP.
- Hay **76 archivos de codigo tocados en las dos ramas**, con dos modelos de roles distintos. Unirlas es un hilo de integracion propio, no un detalle.

| Hallazgo | en main | en wip |
|---|---|---|
| 1. Boton Pagar muerto | **Abierto** (`handleGuestCheckout` con `catch {}`; checkout solo para staff) | **Resuelto**: ya no hay boton Pagar; queda "Pedir la cuenta" con la preferencia Efectivo/Tarjeta |
| 2. Orden cobrada sigue en el KDS | **Abierto** | **Abierto** (`ConfirmCheckout` cobra y cierra la sesion pero no cambia el estado de las ordenes) |
| 3. Seguimiento perdido al recargar | **Abierto** | **Probablemente resuelto**: la carta carga `getOrders()` de la sesion al montar. Falta confirmarlo en el navegador |
| 4. Cerrar sesion en el panel | **Abierto** | **Parcial**: existe en `TerminalShell` (terminales) pero no en `PanelShell` |
| Menor: precios sin COP | Abierto (6 `toFixed(2)`) | Resuelto (formatCOP, 0 `toFixed(2)`) |
| Menor: /pagos dice "solo efectivo" | Abierto | Abierto (mismo texto) |
| Menor: 409 sin aviso en la PWA | Abierto | Probablemente resuelto (la carta maneja `SESSION_NOT_ORDERABLE`) |
| Menores: STAFF aterriza en /menu, rol del dialogo "Agregar miembro" | Abiertos | Por confirmar (en wip el gating por rol cambio) |

## D1 - Sobre que rama se implementa

- **A (recomendada) - wip, despues de commitear las rondas 6-7.** Quedan solo el hallazgo 2, el 4 (anadir logout al panel) y 1-2 menores: un plan corto de unas 5 unidades. La integracion con `main` se abre como hilo aparte.
  - Riesgo: los hallazgos de `main` se cierran en `wip`, y `main` sigue con el bug hasta la integracion.
- **B - main, en una rama nueva desde fe0606a.** Hay que corregir los 4 hallazgos y todos los menores (unas 9 unidades). Duplica trabajo que `wip` ya hizo y luego choca al integrar.
- **C - Integrar primero (merge de main en wip) y despues corregir.** Es lo mas limpio a largo plazo, pero es el mayor coste y riesgo: dos modelos de roles y 76 archivos en conflicto. Bloquea los hallazgos hasta que termine.

## D2 - Regla del hallazgo 2 (cobrar con ordenes sin entregar)

- **A (recomendada) - Bloquear y avisar.** Checkout responde 409 `ORDERS_NOT_DELIVERED` si hay ordenes en PLACED/IN_KITCHEN/READY, y la UI muestra que ordenes faltan. Se anade la opcion explicita "Cobrar igual y cerrar pedidos", que solo usan admin y manager: marca esas ordenes como CANCELLED, quedan fuera del KDS y del Dashboard, y queda registro en el historial.
  - Por que: no se pierde comida en marcha por error y el caso real ("el cliente se va y paga igual") tiene salida explicita.
- **B - Cerrar automaticamente al cobrar.** Las ordenes no entregadas pasan a CANCELLED (o a DELIVERED) en silencio. Es simple, pero cocina puede estar preparando algo que ya nadie espera.
- **C - Solo avisar.** Un aviso no bloqueante y, al cobrar, las ordenes pasan a DELIVERED. Es intermedio y falsea la metrica de entregas.

Nota: con B o C, ¿las ordenes salen como CANCELLED o como DELIVERED? Afecta a los informes. Mi recomendacion es CANCELLED con motivo `checkout`.

## Siguiente paso

Responde D1 y D2. Si es D1-A, confirma tambien que se commiteen las rondas 6-7 del arbol de wip antes de empezar. Con eso emito el plan a agy de inmediato.
