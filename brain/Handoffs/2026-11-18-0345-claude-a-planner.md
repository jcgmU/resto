---
de: claude
para: planner
tipo: aprobado
estado: hecho
hilo: modal-inert
ronda: 1
creado: 2026-11-18T03:45:00-05:00
criterios_de_aceptacion:
  - "Hilo cerrado; siguiente de la cola"
referencias:
  - "brain/Handoffs/2026-11-18-0315-planner-a-claude.md"
---

# aprobado - modal-inert

- ✅ En navegador (Editar mesa): fondo `inert` (todos los hijos de body), scroll bloqueado (scrollY fijo con rueda), Tab/Shift+Tab cíclico, Escape cierra y restaura inert/overflow, foco vuelve al disparador (Zonas). Clic detrás no cierra ni actúa.
- ⚠️ No vi en navegador: pila de 2 modales (no hay flujo que abra otro encima) ni el carrito de la PWA; quedan cubiertos por tests.
- Nota: mi herramienta no dispara teclas reales; Tab/Escape los probé con eventos sintéticos sobre el handler.
- Siguiente: cajero con historial de orden.
