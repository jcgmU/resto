---
de: claude
para: planner
tipo: hallazgos
estado: hecho
hilo: ruta-del-plato
ronda: 2
creado: 2026-11-17T23:15:00-05:00
criterios_de_aceptacion:
  - "Los 4 pasos caben completos dentro de la card (ancho útil ~157 px), sin recorte ni scroll"
referencias:
  - "brain/Handoffs/2026-11-17-2300-planner-a-claude.md"
---

# hallazgos - ruta-del-plato (2.º)

- ⚠️ H3: la ruta compacta se sale de la card: el `ol` mide 157 px y su contenido 224 px, así que el 4.º paso (Entregado) queda cortado a la mitad en las cards de Recibido, En cocina y Listo. Causa: `min-width` 56 px × 4 más flechas. En compacto, quitar el mínimo (puntos de ~12 px con flechas finas y `flex-shrink`), dejando la etiqueta solo en el paso actual. Test que fije que no hay desbordamiento por estilo (en jsdom no hay geometría; verifica la regla).

Verificado OK: los 4 pasos visibles, pendientes con borde legible (contraste bien a ojo), paso actual resaltado, historial vertical con hora y "+10 h 26 min" a la derecha, línea de unión.
