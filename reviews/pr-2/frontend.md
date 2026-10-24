---
de: codex-frontend
para: codex
tipo: hallazgos
estado: hecho
hilo: pr2-review
ronda: 1
creado: 2026-10-23
criterios_de_aceptacion:
  - Hallazgos con archivo, línea, reproducción y recomendación.
  - Separar cambio PR2 y deuda previa.
referencias:
  - HEAD 65ffd61bbe7ca61da58791abfde75faaa37200b8
  - PR https://github.com/jcgmU/resto/pull/2
---

# Revisión frontend completa

## Alcance y resultado PR2

PR2 cambia únicamente `apps/client-pwa/src/app/t/[tenantId]/[tableId]/menu/page.tsx`: reutiliza `loadMenu()` en efecto inicial. Flujo y manejo de loading/error conservados. No encontré regresión bloqueante demostrable en diff.

Observación menor: efecto líneas 79–87 perdió cleanup `isMounted` presente en base. `loadMenu` líneas 66–75 puede finalizar tras desmontaje y no cancela requests. Mejor usar AbortController o generación de request para carga inicial y reintentos. No presentar como fuga entre tenants demostrada: Next puede remontar página cuando cambia segmento dinámico; no validé navegación real entre tenants. StrictMode puede ejecutar carga inicial dos veces, pero ya ocurría antes; diferencia nueva es aceptación de ambas respuestas.

Todos los hallazgos siguientes existen en base del PR.

## Hallazgos priorizados

### F1 — P1: checkout puede mostrar cuenta A y cobrar mesa B

- Archivo: `apps/admin-dashboard/src/app/(panel)/checkout/page.tsx:70` y `:86`.
- `handleSelectSession` actualiza selección inmediatamente y acepta respuesta sin correlacionar sessionId. Seleccionar A, luego B; resolver B primero, A después. Pantalla muestra cuenta A, pero `handleConfirmPayment` usa selectedSession B. Caja puede cobrar/liberar mesa equivocada con importe diferente al mostrado.
- Reproducción aislada: transpilé componente en memoria, hooks mínimos para conservar estados, ApiClient mock con promesas controladas. Sin red, sin archivos nuevos de código/tests. Resultado real de callbacks:

```json
{"shownBill":{"sessionId":"A","tableId":"table-A","total":10},"postedCheckout":{"sessionId":"B","tableId":"table-B","method":"CASH"}}
```

- Corregir: cancelar/ignorar respuesta anterior; exigir `bill.sessionId === selectedSession.sessionId`; bloquear confirmación mientras carga cuenta y durante cobro.

### F2 — P1: refresh simultáneo borra sesión renovada correctamente

- Archivo: `apps/admin-dashboard/src/lib/api.ts:79` (refresh por request), `:113` (clearAuth tras refresh fallido).
- Dashboard dispara cuatro requests paralelas; KDS dispara tres. Con access expirado, cada una inicia refresh independiente con mismo token. Backend `services/identity/src/application/RefreshSession.ts:34` revoca token previo. Una renovación puede pasar y otra fallar; segunda respuesta borra tokens nuevos y redirige login.
- Reproducción aislada de ApiClient transpilado en memoria: dos 401, primer refresh exitoso y segundo rechazado por token revocado. Resultado:

```json
{"refreshRequests":2,"results":["fulfilled","rejected"],"finalAccessToken":null,"finalRefreshToken":null}
```

- Corregir: compartir una promesa refresh entre requests concurrentes; limpiar sesión solo si renovación correspondiente sigue vigente.

### F3 — P1: KDS muestra tablero vacío cuando carga inicial falla

- Archivo: `apps/admin-dashboard/src/app/(panel)/kds/page.tsx:27`.
- `Promise.allSettled` devuelve rejected por request; ningún rejected se inspecciona. `catch` exterior no recibe fallos HTTP/red de esas promesas. ErrorState nunca aparece; cocina ve cero pedidos en vez de fallo de carga.
- Reproducción aislada de callback real transpilado en memoria con ApiClient mock rechazando tres requests:

```json
{"allRequestsRejected":true,"orders":[],"calls":[],"loading":false,"fetchError":null}
```

- Corregir: tratar fallo de orders como error bloqueante con reintento; mostrar errores parciales de calls/tables sin destruir datos válidos.

### F4 — P1: KDS no recupera pedidos perdidos durante desconexión

- Archivo: `apps/admin-dashboard/src/app/(panel)/kds/page.tsx:76`.
- Carga HTTP corre una vez al montar. Listener `connect` solo cambia chip a En vivo. Si cocina pierde conexión, se crea pedido y vuelve conexión, ese pedido no se recarga; `order:status-changed` solo hace map sobre pedidos ya conocidos. Servidor socket no configura recuperación de estado de conexión (`services/ordering/src/infrastructure/realtime/SocketIoRealtimeEmitter.ts:17`).
- Reproducción manual pendiente de UI: desconectar socket cocina, crear orden desde otra sesión, reconectar. Código garantiza que handler connect no consulta snapshot.
- Corregir: recargar/reconciliar snapshot al conectar/reconectar y considerar cursor/event replay; mantener datos visibles mientras sincroniza.

### F5 — P2: productos PWA y mesas checkout inaccesibles con teclado

- Archivo: `packages/ui-components/src/bento/BentoCard.tsx:38`.
- `interactive` solo agrega cursor y data attribute. Elemento sigue siendo article onClick, sin tabIndex, rol ni teclas. `ProductListCard` usa directamente este comportamiento; `ActiveTablesGrid` también. Tab no alcanza producto/mesa y Enter/Espacio no activan acción.
- Corregir: controles nativos button/link donde corresponda; evitar botón anidado si card contiene otras acciones. Añadir pruebas de teclado de consumidor, no solo snapshots de CSS.

### F6 — P2: fallos HTTP/GraphQL menú aparecen como carta vacía

- Archivo: `apps/client-pwa/src/lib/api.ts:174`–`:179`.
- Solo comprueba 401. Un 500 JSON o GraphQL 200 con errors se transforma en arrays vacíos. `loadMenu` no entra en catch, ErrorState y reintento quedan inaccesibles. Mensaje visible dice No hay platos disponibles.
- Reproducción aislada con fetch mock status500/okfalse y errors:

```json
{"mockStatus":500,"resolvedInsteadOfRejected":{"authorized":true,"categories":[],"products":[]}}
```

- Corregir: comprobar res.ok y data.errors antes de normalizar; política explícita para datos parciales.

### F7 — P2: añadir producto falla silenciosamente y descarta selección

- Archivo: `apps/client-pwa/src/components/ProductDetailSheet.tsx:118` y `apps/client-pwa/src/app/t/[tenantId]/[tableId]/menu/page.tsx:143`.
- Callback tipado void dispara operación async y cierra sheet inmediatamente. Fallo de stock/red/validación solo guarda cartError. Error se renderiza en CartSheet, pero carrito sigue cerrado. Comensal cree que agregó producto; cantidad/modificadores se pierden al reabrir.
- Reproducción: abrir producto, seleccionar extras, devolver 500 a POST cart/items; detalle desaparece, contador no cambia, mensaje queda oculto hasta abrir carrito.
- Corregir: callback Promise, pending visible, await antes de cerrar; error junto al botón y preservar selección.

### F8 — P2: expiración guest no actualiza guard y mantiene polling sin token

- Archivo: `apps/client-pwa/src/components/GuestSessionGuard.tsx:15`; menú `:48` y `:90`; api `:95`.
- Guard lee token una vez. `checkAuthExpired` borra token y sesión pero no emite cambio reactivo. Si polling carrito recibe401 después de cargar menú, error se ignora, guard sigue autorizado y UI permite acciones. Intervalo mantiene requests sin Authorization cada5s.
- Corregir: store/context de sesión reactivo; transición común a pantalla de QR en401 y detener polling. Diferenciar error de sesión y fallo transitorio.

## Otros problemas concretos de menor prioridad

- Checkout errores iniciales/carga cuenta invisibles: `checkout/page.tsx:156` solo monta BillSummaryCard si bill existe; ese componente es único lugar que renderiza error. Con fallo sessions o GET bill, no aparece mensaje ni reintento.
- Temporizador KDS congelado: `components/kds/KdsOrderCard.tsx:31` usa Date.now() únicamente durante render. Si no llegan eventos, tiempo y alerta de retraso no avanzan. Usar reloj compartido con tick por minuto.
- Cantidad carrito no tiene pending por línea: respuestas concurrentes/polling pueden pisarse; valorar versión de carrito o cola de mutaciones y sincronización. No validado contra backend en esta revisión.
- Diálogos PWA `ProductDetailSheet.tsx:124`, `cart/CartSheet.tsx:88` carecen de aria-labelledby/aria-label; lector anuncia diálogo sin nombre.
- UI admin móvil: PanelShell reserva rail y48px padding; KDS agrega48px más, minWidth300 y panel320. Requiere confirmar overflow en navegador; root realiza revisión visual.
- Botón Pagar guest (`menu/page.tsx:176`) confirma CASH sin pending/resultado visible y silencia errores. Riesgo de política de pagos debe evaluarse con backend; no tratar como procesador de tarjetas funcional.
- Coordinación con revisión ordering: checkout resuelve service calls pero emite `session:checkout-completed`, no `service-call:resolved`. KDS solo escucha created/resolved de service call (`kds/page.tsx:107`), no checkout-completed; solicitud de cuenta queda visible después del cobro hasta recargar. Confirmado conjuntamente con agente ordering.

## Dirección de UI propuesta

Problema de código actual: misma gramática de tarjetas/KPI para gestión administrativa y elección de comida; `ProductListCard` muestra Precio como KPI, imágenes sin aspecto fijo y sin descripción; PWA no tiene encabezado restaurante/mesa ni búsqueda; CTA fijo Pedir la cuenta ocupa foco antes de elegir comida; carrito solo muestra contador. Navegación admin oculta todos los labels visuales (`SidebarRail.tsx:43`) y mantiene accesos a vistas placeholder.

Tres opciones concretas:

1. **Carta editorial para comensal, operación clara para admin — recomendada.** PWA con nombre restaurante y mesa, categorías sticky, búsqueda, filas con miniatura de aspecto fijo, nombre/descripción/precio y agregado claro; barra inferior Ver pedido · cantidad · total; cuenta como acción secundaria contextual. Admin con sidebar etiquetada, tabla/lista compacta para menú, mapa sala con estados y KDS de alto contraste en pantalla completa. Compartir tipografía/tokens básicos, adaptar densidad y jerarquía a cada tarea.
2. **Lima & Tinta refinado.** Conservar identidad actual: reducir radios24→12/16, menos sombras y cards contenedoras, grilla/espaciado uniforme, texto navegación visible, fotos de comida y botón primario único por pantalla. Menor costo de migración; resuelve sensación de prototipo sin reemplazar toda marca.
3. **Bistró cálido.** Fondo crema, tinta oscura, acento terracota/oliva, títulos con personalidad y fotografía; PWA cercana a carta física. Admin sobrio con mismos colores y estados semánticos. Mayor trabajo de imágenes/contenido y dirección de marca.

En todas: esconder navegación de funciones no disponibles o rotularlas claramente, locale/currency mediante Intl.NumberFormat, estados de carga/error/éxito junto a acción, restauración de pedido tras recarga. Priorizar corregir cobro/sesión/KDS antes de pulir temas visuales.

## Validación existente ejecutada

Desde cada paquete: `./node_modules/.bin/jest --runInBand --silent`. Dependencias locales enlazadas al checkout original, sin instalación ni red.

| Paquete | Suites | Tests | Resultado |
|---|---:|---:|---|
| client-pwa | 14 | 74 | PASA |
| admin-dashboard | 14 | 99 | PASA |
| ui-components | 5 | 82 | PASA |
| Total | 33 | 255 | PASA |

Suites actuales no cubren carreras de selección/refresh, rejected de allSettled, reconexión con pérdida de eventos ni apertura de cards por teclado. `pnpm` no está en PATH de esta terminal; por eso ejecuté binarios Jest existentes directamente. No creé ni modifiqué tests, código, commits ni comentarios GitHub. No hice requests HTTP.
