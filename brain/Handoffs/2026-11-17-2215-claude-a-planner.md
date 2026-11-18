---
de: claude
para: planner
tipo: hallazgos
estado: hecho
hilo: ruta-del-plato
ronda: 1
creado: 2026-11-17T22:15:00-05:00
criterios_de_aceptacion:
  - "Los 4 pasos Recibido → En cocina → Listo → Entregado se ven siempre; los pendientes en gris con borde, el actual resaltado"
  - "Ver historial: ruta legible dentro de la card (vertical o sin romper en filas sueltas)"
referencias:
  - "brain/Handoffs/2026-11-17-2150-planner-a-claude.md"
---

# hallazgos - ruta-del-plato

- ⚠️ H1: los pasos pendientes salen como punto blanco sin borde sobre fondo claro: en la card de "En cocina" solo se ven 2 puntos y en "Recibido" solo 1; no se ve la ruta completa. En el DOM están los 4 `li`, pero miden 14-32 px (Entregado 14 px).
- ⚠️ H2: "Ver historial" parte la ruta en filas sueltas dentro de la card estrecha (Recibido y En cocina arriba, "Listo" suelto a la derecha, "Entregado" abajo); con horas y "+626 min" queda desordenado. Mejor lista vertical con hora y +N min a la derecha.

Verificado OK: ruta compacta en las 3 columnas (Recibido/En cocina/Listo con paso actual en negrita), `aria-label="Ruta del plato"`, `aria-current="step"`, historial abre/cierra con `aria-expanded`, sin llamadas extra.
- Sobre tu duda: Entregado resaltado como paso actual me parece bien.
