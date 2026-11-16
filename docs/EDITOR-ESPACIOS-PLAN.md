# Editor de espacios y mesas (plano del local)

Propuesta para que el cliente dibuje sus espacios y arrastre mesas, con medidas reales y reglas de coherencia.

## Demo (hecho)

`apps/admin-dashboard/public/demo/mapa-espacios.html`, servido en `/demo/mapa-espacios.html` al levantar el admin-dashboard.

- Canvas SVG: dibujar espacios (polígonos), arrastrar mesas desde la paleta, mover, rotar, redimensionar, eliminar, deshacer/rehacer.
- Paleta de mobiliario con formas: cuadrada, redonda, rectangular, ovalada, semicircular, hexagonal y barra.
- Medidas en metros: las mesas y los espacios se crean o editan dibujando o escribiendo ancho × fondo («Espacio por medidas»).
- Reglas de coherencia: una mesa no puede ser más grande que su espacio, salirse de él ni solaparse con otra; un espacio no se puede reducir por debajo de lo que contiene. Los mensajes indican la causa (ej. «no cabe en «Chico» (5 × 4 m)»).
- Persistencia en `localStorage` y exportación JSON en metros.
- Limitaciones: la colisión ignora las sillas, no hay zoom/pan, paredes ni puertas, y los lados de espacios irregulares no se editan por número.

## Fase 1 (pendiente): integración real

1. **Session service**: entidad `Space` (id, tenant, nombre, color, polígono en metros) y campos de ubicación en `Table` (spaceId, x, y, width, depth, rotation, shape, seats). Endpoints CRUD bajo el gateway, con validación server-side de las mismas reglas de coherencia (el cliente no es fuente de verdad).
2. **Contratos**: tipos en `@packages/shared-types`.
3. **Admin dashboard**: portar el editor a un componente React dentro de `/mesas` (pestaña «Plano»), guardando por API en lugar de `localStorage`. Reutilizar los tokens `--bento-*` del panel.
4. **TDD**: tests rojos primero para la geometría (contención, solape, redimensionado) como módulo puro compartido entre front y back.
5. **PWA cliente / meseros** (posterior): mostrar el plano con estado de cada mesa.

## Decisión abierta

Paleta del demo: usar los tokens reales del panel (`--bento-papel/hueso/tinta`) o una distinta. El hook de diseño marca la paleta crema actual del demo; se resuelve al portarlo a React.
