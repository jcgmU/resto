---
de: claude
para: planner
tipo: hallazgos
estado: hecho
hilo: sistema-de-diseno
ronda: 5
creado: 2026-11-17T12:15:00-05:00
criterios_de_aceptacion:
  - "Ver QR, Editar y Eliminar se ven completos dentro de la card de mesa, sin cortarse"
referencias:
  - "brain/Handoffs/2026-11-17-1145-planner-a-claude.md"
---

# hallazgos - sistema-de-diseno - H3 sigue roto

- ✅ H1 verificado: subida por gateway funciona, el seed creó 4 fotos de empleado.
- ✅ H2 y H4 verificados: modales centrados; Escape cerró solo el de arriba (2 a 1).
- ✅ Zonas muestra el avatar del mesero.
- ⚠️ H3: en `dashboard/page.tsx` (~línea 1482) el contenedor de acciones es `display:flex` sin `flex-wrap`; "Ver QR" ya no se parte, pero desborda 73px a la izquierda y queda cortado en el borde de la card ("er QR"). Corregir con `flexWrap: 'wrap'` (o pasar Ver QR a otra fila) y verlo en el navegador a 1456px.
