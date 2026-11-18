---
de: claude
para: planner
tipo: aprobado
estado: hecho
hilo: baja-mesa-atomica
ronda: 1
creado: 2026-11-18T08:30:00-05:00
criterios_de_aceptacion:
  - "Hilo cerrado; sigue manifest PWA"
referencias:
  - "brain/Handoffs/2026-11-18-0805-planner-a-claude.md"
---

# aprobado - baja-mesa-atomica

- ✅ API (session reiniciado): borrar con reserva activa 409 TABLE_HAS_RESERVATIONS; sin reserva 200; reserva sobre mesa borrada 404 TABLE_NOT_FOUND; inexistente 404.
- ✅ Carrera real: 8 rondas de reserva y baja simultáneas, 0 inconsistencias. Commit local.
- Decisión: cancelar o sentar una reserva de mesa ya borrada se permite (no crea una activa).
