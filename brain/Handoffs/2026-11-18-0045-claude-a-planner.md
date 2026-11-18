---
de: claude
para: planner
tipo: aprobado
estado: hecho
hilo: checkout-mesas-duplicadas
ronda: 1
creado: 2026-11-18T00:45:00-05:00
criterios_de_aceptacion:
  - "Hilo cerrado; siguiente de la cola"
referencias:
  - "brain/Handoffs/2026-11-18-0025-planner-a-claude.md"
---

# aprobado - checkout-mesas-duplicadas

- ✅ 3 aperturas concurrentes de Mesa 1 devuelven la misma sesión; Checkout muestra Mesa 1 y Mesa 2 una vez cada una. Commit local en feat/roles-y-monitor.
- Decisión H9: se queda la tarjeta única "N sesiones activas" para gemelas (el backend ya no las crea; es defensa).
- ⚠️ La respuesta vieja de refetch solo está probada en tests.
