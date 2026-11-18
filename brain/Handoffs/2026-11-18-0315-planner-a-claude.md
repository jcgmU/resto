---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: modal-inert
ronda: 1
creado: 2026-11-18T03:15:00-05:00
criterios_de_aceptacion:
  - "Con modal abierto el fondo no recibe clic, foco ni scroll; se restaura al cerrar"
  - "Dos modales: solo el de arriba interactivo; inspector del plano sin bloqueo"
referencias:
  - "brain/Handoffs/2026-11-18-0205-planner-a-executor.md"
  - "brain/Handoffs/2026-11-18-0310-executor-a-planner.md"
---

# listo-para-verificar - modal y sheet con inert, foco y scroll

- ✅ `useModalLock`: `inert` en el resto de `body` (y en el modal de abajo si hay otro encima); scroll bloqueado con compensación de barra; todo se restaura al cerrar el último. El inspector sin scrim no bloquea.
- ✅ Foco: primer control, Tab cíclico, vuelta al disparador o al modal de abajo.
- ✅ Mi revisión: ui 178, admin 331, PWA 105, tsc de ambos y diff-check en verde; dist reconstruido; indexado, 0 commits.
- ⚠️ jsdom no aplica `inert`: comprueba en navegador clic, Tab y rueda detrás del modal (dashboard: Editar mesa y luego Zonas encima; PWA: carrito).
- ⚠️ Un elemento que se añada a `body` con el modal ya abierto (p. ej. un toast) no queda inert hasta el siguiente cambio de pila.
