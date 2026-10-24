---
de: ordering
para: codex
tipo: hallazgos
estado: hecho
hilo: pr2-review
ronda: 1
creado: 2026-10-23T21:48:00-05:00
referencias:
  - HEAD 65ffd61bbe7ca61da58791abfde75faaa37200b8
---

# Review completo: ordering, carrito, pagos y realtime

## Alcance y atribución

Revisados todos los source files de `services/ordering`, contratos `packages/shared-types/src/ordering`, schema/migration y tests existentes; contrastados gateway auth/proxy/routes y session usecases para seguir flujos reales. **Todos los hallazgos siguientes son deuda preexistente: `git diff origin/main...HEAD -- services/ordering packages/shared-types` vacío. PR #2 cambia únicamente menu/page.tsx. No atribuir estos bugs al PR ni usarlos como comentarios sobre líneas modificadas del PR.**

Sin modificaciones source, sin peticiones producción, sin staging/commit/push ni publicación GitHub. Reproducciones efímeras en stdin, reutilizando dependencias locales y fakes existentes. Import de `@prisma/client` no funciona en checkout local por generación ausente; para HTTP se sustituyó únicamente import PrismaClient por constructor que lanza si se usa, y se inyectaron todos los repositorios. No se validó persistencia PostgreSQL/Redis real. Reproducciones de concurrencia ajustaron fake `get` para devolver copia profunda (semántica JSON real de Redis); fake original comparte referencias y oculta algunas carreras.

## Hallazgos priorizados

### O1 — P1 — Cantidad negativa produce órdenes y pagos negativos

- Ubicación principal: `services/ordering/src/interfaces/http/cart.routes.ts:31`; defensa ausente también `application/CartUseCases.ts:16` y `domain/pricing.ts:99`.
- `quantity || 1` acepta `-3`, strings y fracciones. `validateAndPriceCart` multiplica sin exigir entero positivo. PostgreSQL INTEGER tampoco tiene CHECK positivo; Decimal de pagos acepta negativo.
- Reproducción HTTP con fakes: POST /cart/items `{productId:p1,quantity:-3}` => 201; POST /cart/confirm => 201, quantity=-3,total=-30; POST /checkout/confirm => payment.amount=-30. Puede restar consumo legítimo de cuenta compartida. PATCH también carece validación; `quantity` ausente corrompe línea al serializar.
- Corrección: schema runtime en frontera + invariante dominio, `Number.isSafeInteger(quantity) && quantity > 0`, límites de cantidad; PATCH con cero como eliminación explícita si es contrato; CHECK DB para quantity>0 y totales no negativos.

### O2 — P1 — Pedidos permitidos después del checkout quedan sin cobrar

- Ubicación: `services/ordering/src/application/OrderUseCases.ts:63` y `services/ordering/src/application/ConfirmCheckout.ts:59`.
- Confirmar orden no consulta estado de sesión ni pago. Middleware exige solamente x-session-id; gateway valida firma/exp de JWT, sin comprobar cierre. Token guest dura 4h; cerrar sesión no revoca token. Payment único por (tenantId,sessionId) queda inmutable y checkout posterior reutiliza monto anterior.
- Reproducción secuencial: checkout pago20; mismo tenant/session agrega y confirma producto10; nuevo checkout => cuenta suma30, pago sigue20, un único payment. Es posible aunque primer cierre haya terminado correctamente. Ventana de carrera antes de cierre agrava problema; fallo de cierre mantiene sesión cobrando con importe congelado.
- Corrección: estado de cobro autoritativo en ordering (OPEN/CLOSING/PAID), bloquear nuevas órdenes y cancelaciones que alteren cuenta tras cobro, serializar creación/cancelación/checkout por sesión. Estado actual de sesión validado también para cart/service calls. No basta consultar una vez antes de guardar: operación debe coordinarse con checkout.

### O3 — P1 — Confirmación borra cambios concurrentes del carrito compartido

- Ubicación: `services/ordering/src/application/OrderUseCases.ts:96-99`.
- Se toma snapshot, se espera consulta catálogo/persistencia y finalmente DEL de carrito completo. Otro guest puede añadir p2 mientras se confirma p1; p2 no está en orden y desaparece de carrito.
- Reproducción con catálogo detenido mediante Promise: confirma snapshot p; agrega p2; libera catálogo; orden contiene [p], carrito queda[].
- Corrección: revisión/versionado y consumo atómico de snapshot (Lua/CAS o separación de carrito en edición y lote en confirmación). Tras error de Redis después de commit SQL, reintento debe recuperar orden anterior por idempotency key, no crear nueva.
- Matiz importante: **no afirmar duplicación de órdenes SQL por doble confirmación**: IDs OrderItem reutilizan cartItemId y PK global impide segundo insert de mismo snapshot. Fakes sí permiten duplicación, pero no representan constraint real. Sí queda fallo de reintento P2002 si SQL guardó y DEL falló.

### O4 — P1 — Staff evade restricción de cancelación usando endpoint de status

- Ubicación: `services/ordering/src/interfaces/http/orders.routes.ts:86` y `application/OrderUseCases.ts:39`.
- /cancel requiere manager/admin, pero /status acepta staff y status=CANCELLED. Máquina permite PLACED/IN_KITCHEN -> CANCELLED. Gateway aplica misma autorización permisiva en /status. Esta ruta además omite cancelledAt.
- Reproducción HTTP: role=staff PATCH /orders/order1/status `{status:CANCELLED}` =>200, orden CANCELLED sin cancelledAt.
- Corrección: transición a CANCELLED delegada a política/caso de cancelación, validación de actor también en capa application. No depender del endpoint elegido.

### O5 — P2 — Incrementos simultáneos pierden cantidades

- Ubicación: `services/ordering/src/application/CartUseCases.ts:35-40`; `infrastructure/persistence/RedisCartRepository.ts:71-81`.
- Dos guests leen cantidad1 y ambos escriben2. MULTI solo agrupa escritura/TTL, no lectura más cálculo más escritura.
- Reproducción con snapshots independientes como Redis: Promise.all de dos adds, esperado3, real2. Dos primeros adds concurrentes también pueden crear líneas distintas para misma combinación.
- Corrección: merge/incremento atómico con clave canónica y Lua o WATCH con reintentos; semántica explícita para update absoluto contra incrementos concurrentes.

### O6 — P2 — Carrera entre cambios de estado resucita orden cancelada

- Ubicación: `services/ordering/src/application/OrderUseCases.ts:34-48`; `infrastructure/persistence/PrismaOrderRepository.ts:173-177`.
- Validación de transición ocurre sobre lectura anterior; UPDATE SQL solo filtra id. Cancelación y actualización a IN_KITCHEN leen PLACED, ambas pasan; actualización tardía pisa CANCELLED.
- Reproducción determinista: lanzar transición a IN_KITCHEN y cancelación desde PLACED, demorar escritura de primera hasta cancelación => status IN_KITCHEN junto con cancelledAt definido.
- Corrección: compare-and-set `{tenantId,id,status:expectedStatus}` / columna version; conflicto =>409. Llevar tenantId al WHERE de todas las mutaciones aunque lectura previa esté aislada por tenant.

### O7 — P2 — tableId controlado por guest desvía órdenes a otra mesa

- Ubicación: `services/ordering/src/interfaces/http/cart.routes.ts:82`.
- tableId sale del body, sin contrastarlo con sesión autenticada. Ausente se inventa `table-from-${sessionId}`. Guest válido puede guardar órdenes en cualquier mesa textual; service calls repiten patrón (serviceCalls.routes.ts:24-39). Checkout acepta tableId libre también.
- Reproducción: sesión s confirma `{tableId:ANY-OTHER-TABLE}` => orden201 asignada a ANY-OTHER-TABLE.
- Corrección: obtener mesa desde sesión activa autoritativa, ignorar tableId aportado por guest; checkout comprobar coincidencia y usar mesa persistida.

### O8 — P2 — Todos los modificadores muestran nombre y precio de primera opción

- Ubicación: `services/ordering/src/application/CartUseCases.ts:47-56`; contrato `packages/shared-types/src/ordering/ports.ts:101` (modifierNames sin IDs).
- `.find(dn => dn.optionName)` siempre devuelve primer nombre no vacío, sin comparar group/option. Dos opciones +1 y +3 quedan ambas +1. Confirmación recalcula catálogo y termina cobrando14 cuando carrito muestra12.
- Reproducción HTTP: Cheese/Cheddar(+1), Sauce/Pesto(+3), producto10 => carrito ambos Cheese/Cheddar(+1),total12.
- Corrección: IDs groupId/optionId en snapshot y lookup exacto; preferir enriquecimiento y precio catálogo en servidor para coherencia.

### O9 — P2 — Merge elimina instrucciones de otra unidad

- Ubicación: `services/ordering/src/application/CartUseCases.ts:25-42`; `services/ordering/src/domain/merge.ts:18-25`.
- Criterio merge incluye producto+modificadores, omite notes. Añadir mismo producto con notas distintas suma cantidad sobre primera línea y descarta nuevas notas/addedBy. Ejemplo una unidad sin cebolla y otra con cebolla => quantity2, ambas con primera instrucción.
- Corrección: incluir instrucciones normalizadas en identidad de línea o conservar unidades con notas distintas; definir comportamiento de addedBy para carrito compartido.

### O10 — P2 — Rooms guest mezclan tenants cuando sessionId coincide

- Ubicación: `services/ordering/src/infrastructure/realtime/SocketIoRealtimeEmitter.ts:45-47` y `:62-63`; contrato RealtimeEmitter también omite tenantId.
- Room `session:${sessionId}` no contiene tenant. Identificadores de sesión son Date.now + random0..999 (no UUID global), así que igualdad entre tenants no está excluida.
- Reproducción Socket.IO real sobre 127.0.0.1: guest firmado para tenant-B/session same-session recibe order:created con payload tenant-A/session same-session emitido al room. No se necesitó falsificar token ni entrar a tenant room.
- Corrección: `tenant:${tenantId}:session:${sessionId}` tanto join como emit; tenantId obligatorio en contrato RealtimeEmitter. UUID evita colisiones pero no sustituye aislamiento explícito.

### O11 — P2 — Socket sigue recibiendo datos tras expiración del JWT

- Ubicación: `services/ordering/src/infrastructure/realtime/SocketIoRealtimeEmitter.ts:34`; gateway socketProxy.ts replica validación solamente al conectar.
- jwt.verify corre en handshake y conexión queda vigente indefinidamente. Cierre de sesión tampoco desconecta rooms guest.
- Reproducción Socket.IO real local: token expiresIn2s; tras2.2s jwt.verify rechaza expirado, socket sigue conectado y recibe evento privado adicional.
- Corrección: desconectar a exp, reautenticar/reconectar al renovar, y revocar/sacar conexiones al cerrar sesión o revocar permisos.

### O12 — P2 — Fallo publicando evento ocurre después del commit y vaciado del carrito

- Ubicación: `services/ordering/src/application/OrderUseCases.ts:96-107`; mismo patrón ServiceCallUseCases y ConfirmCheckout.
- SQL commit y DEL terminan antes de Redis publish. Si publish falla, HTTP devuelve error pese a orden persistida; carrito vacío impide reintento normal, KDS no recibe notificación. Redis Pub/Sub no conserva eventos cuando subscriber cae.
- Evidencia: secuencia source inequívoca; no se simuló caída de Redis real. Impacto recuperable mediante refetch, pero no hay entrega durable ni recuperación del resultado por idempotency key.
- Corrección: outbox transaccional SQL y worker reintento/ack; comando idempotente devuelve orden ya confirmada. Clientes deben reconciliar en reconnect con snapshot.

### O13 — P2 — Checkout deja llamadas de servicio obsoletas en KDS

- Ubicación: `services/ordering/src/application/ConfirmCheckout.ts:109-114`; consumidor `apps/admin-dashboard/src/app/(panel)/kds/page.tsx:105-112`.
- Checkout resuelve llamadas directamente en repositorio y publica únicamente session:checkout-completed. KDS carga llamadas al montar y solo elimina fila al recibir service-call:resolved; no escucha checkout. Tras pago sigue mostrando llamada ya resuelta hasta reload.
- Evidencia: cruce source entre checkout, realtimeWiring y KDS, confirmado también por reviewer frontend. Corrección: publicar service-call.resolved para cada llamada o reconciliar llamadas KDS al checkout/reconnect.

## Hallazgos menores y mejoras específicas

- `RedisServiceCallRepository.ts:68-99`: contrato ofrece status=resolved pero implementación siempre devuelve[] para ese filtro; fake devuelve llamadas resueltas, ocultando discrepancia. Resolver con índice/consulta que soporte contrato o quitar filtro no soportado.
- `pricing.ts:43-46`: opciones duplicadas cuentan como selecciones distintas; una misma opción repetida puede satisfacer minSelections2 y cobrar delta repetido. Validar unicidad de (groupId,optionId), salvo que producto modele multiplicidad explícita.
- `ConfirmCheckout.ts:109-114`: resuelve service calls directamente, sin publicar service-call:resolved; panel que escucha ese evento queda desactualizado. Frontend reviewer avisado para validar consumidores.
- `realtimeWiring.ts:27-35`: checkout solo se emite al tenant, nunca sesión guest; seguimiento guest no recibe final de sesión por este evento.
- `PrismaPaymentRepository.save`: absorbe P2002 y retorna pago existente; ConfirmCheckout no marca isExisting cuando carrera pasa por ese camino (responderá201 en lugar200). Unificar contrato de create-or-get y metadatos de creación.
- `GraphqlCatalogValidationAdapter.ts`: Promise.all hace N consultas por producto sin timeout; añadir query batch y timeout/cancelación con límites de tamaño carrito.
- `HttpSessionServiceAdapter.ts:14` y `app.ts:129 aprox`: hooks de pruebas s-smoke-e2e / session-catalog-down ejecutan comportamiento especial dentro de código productivo. Mover a fakes/fixtures.
- `HttpSessionServiceAdapter.ts`: request de cierre sin timeout puede dejar cobro colgado después de persistir pago.
- `OrderRepository.listByTenant` carga todas las órdenes con todos los items/modificadores sin paginación ni ventana temporal; KDS pierde rendimiento con historial. Añadir paginación y filtro estados activos en UI.
- Tipos compartidos EventSubscriber solo admiten OrderEvent; checkout se cuela con `as any` en realtimeWiring. Usar unión discriminada de eventos y contratos exhaustivos.
- Tests llamados "persiste en Postgres/Redis" (`test/integration/ordering.test.ts`) usan exclusivamente fakes mediante seededOrderingApp. No verifican constraints, transacciones, TTL, serialización ni entrega Pub/Sub; agregar suite integración real de adaptadores como trabajo posterior.

## Evidencia ejecutada

1. HTTP Supertest sobre exact source + fakes existentes: negativeQuantity add201/order201/-30/payment-30; staffCancellation status200/CANCELLED; modifierSnapshot total12 con dos Cheddar(+1).
2. Casos application con concurrencia controlada: concurrentAdds expected3/actual2; concurrentCartEdit ordered[p]/remaining[]; postCheckoutOrder ordersTotal30/payment20/payments1; statusRace status IN_KITCHEN + cancelledAt.
3. Socket.IO real localhost puerto efímero: crossTenantLeak payload tenant-A entregado a token tenant-B mismo sessionId; expiredToken expired=true,connected=true,event recibido.
4. No se instalaron dependencias, no se escribieron tests, no se contactaron servicios externos. No se afirma verificación end-to-end con PostgreSQL/Redis reales.
