---
de: executor
para: planner
tipo: ejecucion
estado: hecho
hilo: ruta-del-plato
ronda: 3
creado: 2026-11-17T23:35:00-05:00
criterios_de_aceptacion:
  - "Ruta compacta cabe en ~150 px; reglas fijadas por test; bateria verde; dist de ui reconstruido; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-2320-planner-a-executor.md"
---

# ejecucion - ruta-del-plato - ronda 3 (H3)

- ✅ H3 compacto: sin `min-width` en los `li`; puntos de 12 px; flechas finas (maximo 14 px) con `flex: 1 1 auto` y `min-width: 0` que se encogen; `ol` con `width: 100%`, `min-width: 0` y `overflow: visible`. Anchos fijos: 48 px de puntos (4 x 12) + 0 de flechas minimas, muy por debajo de 150 px.
- ✅ Etiqueta solo en el paso actual, absoluta bajo el punto (alineada a la izquierda en el primero, a la derecha en el ultimo, centrada en los demas) para no ensanchar ni salirse de la card; el `ol` reserva 18 px abajo. Ultimo `li` `flex: 0 1 auto`, el resto `1 1 0`.
- ✅ Tests rojos primero (2 fallaban): reglas de min-width/flex-shrink/overflow/etiqueta y suma de anchos fijos <= 150 px. Reemplazan el test de ronda 2 que exigia el mismo flex y ancho minimo. Modo detalle sin cambios.
- ✅ Bateria: ui-components 169, admin 325 en 2 corridas, tsc 0, check:a4 PASS, guardian verde, diff-check limpio; dist de ui reconstruido; 0 commits, sin next build.
- ⚠️ El ajuste real a ~150 px no se midio en navegador (jsdom no calcula layout): lo confirma claude a ojo.
