# Cola de ideas y pendientes

> Una linea por idea. Se agrega diciendole a claude "agrega a la cola: ...". Al cerrar un hilo, claude propone los 3 primeros de la **Cola** y arranca el que el usuario elija. Orden = prioridad (arriba, primero).

## En curso
- [~] sistema-de-diseno — atomizar cards, modales y botones; card con blob de estado; foto de perfil del mesero; boton de disponibilidad; bottom sheet iPad con Framer Motion

## Cola (en orden)
- [x] Ventas del dia y ticket promedio (aprobado 2026-11-17)
- [ ] Editor de espacios Fase 1 — espacio = Zona con poligono en metros; geometria ya integrada en shared-types; falta DTO, validacion en session y editor en /mesas
- [ ] Flecha con la ruta del plato por los estados en el monitor (hoy solo "Ver historial")
- [ ] Checkout: comprobar en navegador que no salen mesas duplicadas

## Ideas sin priorizar
- [ ] Riel de tickets estilo video "Handi" para el monitor (quedo en el codigo sin uso)
- [ ] Pruebas de kds.test.tsx intermitentes (barra SLA y notas dependen del reloj)
- [ ] Cajero con acceso al historial de una orden (hoy 403)
- [ ] Baja de mesa con reservas futuras en una sola operacion atomica (hoy comprueba y luego borra)
- [ ] Sacar del control de versiones los clientes Prisma generados (dan conflictos falsos)
- [ ] Borrar contenedores y volumenes de prueba resto-integ-test cuando ya no hagan falta
- [ ] Quitar STAFF del enum de la BD (hoy queda sin asignarse)
- [ ] Test de contraste visual de campos y modales (los tokens indefinidos pasaron desapercibidos)
- [ ] Moneda y locale por tenant (hoy fijos COP/es-CO en ventas del dia)
- [ ] Manifest de la PWA con `id` estable e icono 512px (modern-web-guidance)
- [ ] Modal y sheet con fondo `inert`, foco atrapado y bloqueo de scroll (modern-web-guidance)
- [ ] Revisar `toSorted()` en menu/page.tsx cuando los navegadores objetivo lo garanticen


## Hecho
- [x] monitor-homologar (2026-11-16): monitor cocina y bar con las 3 columnas del admin; el riel de tickets quedo sin uso
- [x] roles-y-monitor (rama feat/roles-y-monitor, verificado 2026-11-16): Staff fusionado en Mesero, terminales aisladas, cambio de clave en terminales, monitor con nombre de mesa, seed con ordenes, riel de cocina
- [x] Integracion main <-> wip (commit c814c04): hardening, mesas por lote, equipo, geometria del editor, modales y campos con tokens validos
- [x] Notas del cliente ya cubiertas: notas del pedido, monitor de cocina con tiempos y demoras, terminal de mesero y modo de operacion, filtros de mesas, reservas, imagen de producto, precios COP, CRUD de mesas con zonas, colores por estado, categorias con orden, llamar al mesero, cobro efectivo o tarjeta, menu lateral con nombres
