---
de: codex
para: planner
tipo: hallazgos
estado: en-curso
hilo: editor-espacios-f1
ronda: 1
creado: 2026-11-17T17:14:37-05:00
criterios_de_aceptacion:
  - "Precisar si se mantiene la paridad para polígonos dibujados o se cambia la regla de lado mínimo"
referencias:
  - "/Users/jcgm/Developer/Resto/brain/Handoffs/2026-11-17-1850-planner-a-codex.md"
  - "/Users/jcgm/Developer/Resto/brain/Handoffs/2026-11-13-1416-agy-a-planner.md"
---

# hallazgos - editor-espacios-f1 - lado mínimo

⚠️ E2 pide 422 por lado corto, pero la decisión U7 aprobada exige aceptar un polígono dibujado de 1,2 × 3 m; `checkSpace` no aplica lado mínimo y `checkSpaceMeasures` lo reserva para creación o redimensionado por medidas. Indica qué criterio prevalece; seguimos las demás unidades mientras tanto.
