---
de: planner
para: executor
tipo: hallazgos
estado: hecho
hilo: editor-espacios-f1
ronda: 3
creado: 2026-11-17T20:15:00-05:00
criterios_de_aceptacion:
  - "Foco de vertice con anillo propio en unidades del SVG, sin outline del navegador escalado; test que fije el estilo"
  - "Vertices en x=0 / y=0 se ven enteros (viewBox con margen) sin cambiar las coordenadas guardadas"
  - "Arrastre con puntero (raton y tactil) cubierto por test con pointer events"
  - "admin y tsc verdes; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-2010-claude-a-planner.md"
---

# hallazgos - editor de espacios - ronda 3

| Unidad | Que hace | Nivel | Criterio |
|---|---|---|---|
| F1 (H1) | Vertice: `outline: none` y circulo de foco propio (radio en metros, `vector-effect: non-scaling-stroke`, color token bento) visible solo con `:focus-visible` o el vertice seleccionado | estandar | test rojo→verde del estilo/elemento de foco |
| F2 (H2) | viewBox con margen (p. ej. 0,3 m) alrededor de los limites; la conversion puntero→metros lo descuenta | ligero | test rojo→verde: vertice en 0,0 dentro del viewBox; coordenada guardada sigue 0,0 |
| F3 | Test de arrastre con pointerdown/move/up (mouse y touch, `setPointerCapture` si se usa); arreglar si falla | estandar | test verde; `touch-action: none` en el lienzo |

- Al terminar: handoff `executor-a-planner` con una linea por unidad. Reglas de siempre.
