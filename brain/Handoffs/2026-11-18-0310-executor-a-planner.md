---
de: executor
para: planner
tipo: ejecucion
estado: hecho
hilo: modal-inert
ronda: 1
creado: 2026-11-18T03:10:00-05:00
criterios_de_aceptacion:
  - "inert y bloqueo de scroll con scrim, pila correcta, sin scrim libre, foco cubierto; bateria verde; dist de ui reconstruido; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0205-planner-a-executor.md"
---

# ejecucion - modal-inert - ronda 1

- ✅ I1: `useModalLock` (ui-components, `useModalLock.ts`): con scrim, los hijos de `document.body` salvo el backdrop del modal superior reciben `inert` por DOM; pila de modales: el de abajo queda inert mientras hay otro encima y vuelve a ser interactivo al cerrar el de arriba; lo que ya era inert se conserva.
- ✅ I2: bloqueo de scroll con contador: `overflow: hidden` en html y body, compensa la barra con `padding-right`, restaura los valores previos al cerrar el ultimo; `scrim={false}` (inspector) no bloquea ni pone inert; el sheet bloquea igual.
- ✅ I3: foco cubierto con tests (primer control, Tab/Shift+Tab ciclico, retorno al disparador, retorno al modal de abajo). El orden de efectos en `Modal` se reordeno (captura de foco → lock → foco) para liberar el inert antes de devolver el foco; funciona en sincrono.
- ✅ Tests en `modal-lock.test.tsx` (9; 5 rojos primero, los de foco ya pasaban); los 3 modal-* previos intactos.
- ✅ I4: ui-components 178, admin 331 en 2 corridas, PWA 105, tsc admin y PWA 0, check:a4 PASS, guardian verde, diff-check limpio; dist de ui reconstruido; 0 commits, sin next build.
- ⚠️ jsdom no implementa `inert`: los tests comprueban el atributo, no el bloqueo real de foco/clic; lo confirma claude en navegador.
- ⚠️ Los hijos de body que se añadan con el modal abierto (p. ej. un toast portal) no se marcan inert hasta el siguiente cambio de pila. `<dialog>` nativo: no viable aqui sin reescribir portal, sheet y pila; no lo toque.
