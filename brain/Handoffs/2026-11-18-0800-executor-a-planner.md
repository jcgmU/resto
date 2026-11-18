---
de: executor
para: planner
tipo: ejecucion
estado: hecho
hilo: baja-mesa-atomica
ronda: 1
creado: 2026-11-18T08:00:00-05:00
criterios_de_aceptacion:
  - "Baja atomica con comprobacion de reservas; reserva sobre mesa borrada falla; concurrencia en rojo primero; mismos codigos; bateria verde; 0 commits"
referencias:
  - "brain/Handoffs/2026-11-18-0720-planner-a-executor.md"
---

# ejecucion - baja-mesa-atomica - ronda 1

- ✅ B1: `table_delete_atomic.contract.test.ts` (Redis real 6381/2), rojo primero (3/3 fallaban): interleaving determinista (reserva que entra entre la comprobacion y el borrado), reserva sobre mesa ya borrada, y bucle de 60 bajas+reservas simultaneas con la invariante "mesa borrada nunca con reserva activa". Añadidos despues: paridad Lua/TS (13 casos de estado y formato de fecha) y DELETE individual.
- ✅ B2: el Lua de `softDeleteMany` recorre `table:<id>:reservations` y devuelve `TABLE_HAS_RESERVATIONS` sin borrar (orden: no encontrada → sesion activa → reservas); `ahora` y la ventana de 2 h entran por ARGV desde la constante `RESERVATION_ACTIVE_GRACE_MS`; regla unica en `domain/reservationRules.ts` (`isReservationActive`) usada por el Lua (via constante), el caso de uso y la ruta. La pre-comprobacion del caso de uso queda como atajo (no decide). La ruta `DELETE /tables/:id` ahora lee el resultado: 404 TABLE_NOT_FOUND, 409 TABLE_HAS_ACTIVE_SESSION o TABLE_HAS_RESERVATIONS (mismos codigos de hoy).
- ✅ B3: `RedisReservationRepository.save` es un Lua que falla con `TABLE_NOT_FOUND` (DomainError, mismo mensaje) si la mesa no existe, es de otro tenant o esta `deleted`; no guarda nada.
- ✅ B4: session 129 en 2 corridas (18 suites, runInBand, Redis 6381/2), test-real 13, tsc session 0, gateway 120, admin 342, diff-check limpio; 0 commits, sin migraciones ni next build.
- ⚠️ Decision mia: guardar una reserva que pasa a `cancelled`/`seated` se permite aunque la mesa este borrada (no crea una activa); crear o reactivar si falla. Sin esto no se podrian cancelar reservas viejas de mesas ya dadas de baja.
- ⚠️ El Lua parsea ISO (Z, offset, fraccion y fecha sola); un formato irreconocible cuenta como activa (bloquea la baja), igual que `NaN` en TS. Fecha sin zona se toma como UTC en Lua y hora local en TS, pero las reservas se guardan siempre normalizadas a ISO Z.
- ⚠️ La baja en memoria (fakes) no consulta reservas: sigue dependiendo del atajo del caso de uso, sin cambios.
