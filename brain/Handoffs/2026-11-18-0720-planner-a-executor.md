---
de: planner
para: executor
tipo: plan
estado: hecho
hilo: baja-mesa-atomica
ronda: 1
creado: 2026-11-18T07:20:00-05:00
criterios_de_aceptacion:
  - "Baja de mesa (lote y una sola) comprueba reservas y borra en una sola operacion atomica de Redis; sin ventana entre comprobar y borrar"
  - "Crear reserva sobre una mesa dada de baja falla (atomico); no puede quedar reserva activa en mesa borrada"
  - "Test de concurrencia en rojo primero (Redis real 6381/2): baja y reserva simultaneas en bucle nunca dejan mesa borrada con reserva activa"
  - "Mismos codigos y respuestas que hoy (TABLE_HAS_RESERVATIONS, TABLE_HAS_ACTIVE_SESSION, TABLE_NOT_FOUND); session, gateway, admin, diff-check; 0 commits"
referencias:
  - "brain/Handoffs/2026-11-18-0715-claude-a-planner.md"
---

# plan - baja de mesa atomica

Hoy: `DeleteTablesBatchUseCaseImpl` lee `reservationRepo.listByTable` y despues llama a `softDeleteMany` (Lua). Entre ambos una reserva nueva puede colarse. La reserva se guarda con MULTI sin mirar si la mesa sigue viva.

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| B1 | 1 | Test de concurrencia (rojo): N iteraciones de baja + crear reserva futura en paralelo sobre la misma mesa; invariante: nunca mesa `deleted` con reserva activa | - | si | estandar | falla hoy |
| B2 | 2 | Lua de `softDeleteMany`: recorre `table:<id>:reservations`, lee status y `reservedFor` de cada `reservation:<id>`; si hay activa (no cancelled/seated y `reservedFor >= ahora-2h`, `ahora` como ARGV) → `failed TABLE_HAS_RESERVATIONS` sin borrar. El caso de uso deja de pre-comprobar (o lo mantiene solo como atajo, sin decidir). Mismo cambio para la baja de una sola mesa si tiene ruta propia | B1 | si | potente | B1 verde; contratos de baja actuales verdes |
| B3 | 2 | Crear/actualizar reserva con Lua: falla si la mesa no existe o esta `deleted` (codigo actual de mesa no encontrada) | B1 | si (mismo) | estandar | test rojo→verde |
| B4 | 3 | Bateria: session (runInBand, `REDIS_URL=redis://localhost:6381/2`, 2 corridas por el test de concurrencia), gateway, admin, diff-check | B2, B3 | no | ligero | numeros |
| **Parada** | - | Handoff `executor-a-planner` | B4 | - | - | - |

- La regla de "reserva activa" (2 h hacia atras) debe ser una sola fuente: constante compartida entre TS y el ARGV del Lua.
- Reglas de siempre: sin stash/reset/checkout --, sin migraciones, sin next build, 0 commits.
