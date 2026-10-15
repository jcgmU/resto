# ADR: Reservas y zonas de mesas en el servicio session (Redis)

- **Fecha:** 2026-10-14
- **Estado:** Aceptado
- **Hilo:** correcciones-qa-y-notas (N03, N04, N08, N09)
- **Contexto:** Las mesas viven en el servicio session sobre Redis (no hay Postgres en session). No existen reservas ni zonas/áreas. N04 pide reservas (crear/ver/cancelar; mesa reservada se ve distinta y no abre sesión QR salvo política definida). N09 pide zonas con CRUD y filtro.
- **Decisión (actualizada en ronda 2 por la suite de referencia):**
  1. **Zonas** como entidad Redis propia (`zone:{id}` hash + set por tenant): `{id, tenantId, name, sortOrder}`. CRUD: lectura staff+, escritura admin/manager. `Table.zoneId` obligatorio; mesas existentes y seed migran a zonas de la referencia (Terraza, Salón Principal, Barra, VIP). No se puede eliminar una zona con mesas (reasignar primero).
  2. **Mesas ganan `capacity`** (int de puestos, default 4) — la referencia muestra "N Puestos • Zona" por mesa.
  3. **Reservas** como entidad Redis: `{id, tenantId, tableId, customerName, phone, partySize, reservedFor (ISO), status: active|seated|cancelled, notes?}`. CRUD + `POST /reservations/:id/seat` ("Cliente Llegó").
  4. **Estado visual reservada:** la mesa se muestra RESERVADA en cuanto tiene una reserva `active` para el día de hoy (la referencia la marca al crear la reserva), con color ámbar.
  5. **Política QR con reserva (definida, conservadora):** `POST /sessions/open` se rechaza con 409 `TABLE_RESERVED` si la mesa tiene una reserva `active` con `reservedFor` dentro de la ventana **[ahora-30min, ahora+2h]**. Fuera de la ventana el QR funciona normal. El personal salta la restricción con `seat`.
  6. **Colores/leyenda consistentes (N08) con la línea Suite** en todas las vistas (resumen/mesas, dashboard, checkout): Libre `#8fbf95`; Ocupada `#e0a6a6`; Reservada `#dcc98a`; Deshabilitada gris neutro. Solo tokens `--bento-*`.
- **Consecuencias:** Redis pierde durabilidad fuerte de reservas (aceptable MVP; un flush las borra — documentado como riesgo con migración futura a Postgres si el negocio lo exige). La ventana de bloqueo es fija en código (30min/2h) en MVP. Las acciones de mesa de la referencia (Ocupar / Reservar / Cliente Llegó / Cobrar y liberar) se implementan en la vista Resumen y Mesas.
