---
de: claude
para: planner
tipo: objetivo
estado: hecho
hilo: qa-main-hallazgos-flujo-completo
ronda: 1
creado: 2026-11-09T14:42:00
criterios_de_aceptacion:
  - "El boton Pagar de la PWA no queda como boton muerto: o se retira, o un invitado obtiene un camino de pago real; en ningun caso un 403 silencioso."
  - "Al cobrar una mesa, sus ordenes no entregadas salen del KDS y dejan de contar como pedidos activos en el Dashboard (o el cobro se bloquea/avisa mientras haya ordenes sin entregar; decidir y justificar)."
  - "Recargar la PWA con un pedido en curso vuelve a mostrar el seguimiento de ese pedido."
  - "El panel admin tiene una accion visible de cerrar sesion que limpia resto_access_token, resto_user y resto_refresh_token y lleva a /login."
  - "Cada correccion con test en rojo primero (TDD) y suites existentes en verde: pnpm test en el monorepo."
  - "Verificacion en navegador por el orquestador repitiendo el recorrido QR -> pedido -> KDS -> cobro."
referencias:
  - "apps/client-pwa/src/app/t/[tenantId]/[tableId]/menu/page.tsx (handleGuestCheckout ~L205, catch vacio; boton Pagar ~L480-502)"
  - "apps/client-pwa/src/lib/api.ts (PwaApiClient.checkout ~L318)"
  - "services/gateway/src/routes/routeTable.ts L63 (/v1/checkout/confirm solo staff/manager/admin)"
  - "apps/admin-dashboard/src/app/(panel)/checkout/page.tsx (cobro admin)"
  - "services/ordering/src/interfaces/http/checkout.routes.ts"
  - "C:\\Users\\jcgm1\\Projects\\resto-main-test (worktree de main, rama test/main-verification, HEAD fe0606a) con docker y frontends levantados"
---

# objetivo - qa-main-hallazgos-flujo-completo - ronda 1

## Contexto

El orquestador recorrio el flujo completo en el navegador contra el codigo de **origin/main** (no contra wip). Tests: 672/672 unitarios e integracion, hardening 71/72 (el fallo es portabilidad Windows del test `services/gateway/test-real/connection.test.ts`, no del producto). Lo que funciona: registro, mesas, QR, carta, carrito, pedido, KDS en vivo, estados, pedir cuenta, cobro en Checkout (efectivo y tarjeta), liberacion de mesa, rotar QR, edicion y lotes de mesas, permisos MANAGER/STAFF tanto en UI como en gateway (403), sesion cerrada tras cobro (409 al añadir al carrito).

## Hallazgos a corregir (4)

1. **Boton "Pagar" de la PWA muerto.** El flag `payments` esta activo y el boton se muestra, pero `POST /v1/checkout/confirm` exige rol staff/manager/admin; el token de invitado siempre recibe 403 y `handleGuestCheckout` lo traga con `catch {}`. Sin feedback.
2. **Orden cobrada sigue en cocina.** Mesa 2 se cobro (tarjeta) con su orden en "Por preparar". La mesa se libero, pero la orden sigue en el KDS y el Dashboard la cuenta en "pedidos activos". Relacionado: Checkout permite cobrar ordenes sin entregar.
3. **La PWA pierde el seguimiento del pedido al recargar.** El banner "Orden #xxx / Recibido..." solo existe en la sesion de la pagina; tras recargar la carta aparece sin estado aunque la orden siga viva en el KDS.
4. **Sin cerrar sesion en el panel admin.** No hay boton; el token vive en localStorage (`resto_access_token`, `resto_user`, `resto_refresh_token`).

## Menores (incluir si encajan en la misma oleada, a criterio del planificador)

- STAFF aterriza en `/menu` con "Sin permiso" tras login; deberia ir a una ruta permitida (Mesas/KDS/Checkout).
- `/pagos` dice que los cobros son solo efectivo (CASH), pero Checkout acepta Tarjeta y Otro.
- Añadir al carrito con la sesion cerrada (409) no muestra ningun aviso en la PWA.
- El dialogo "Agregar miembro" conserva el rol de la vez anterior en lugar de volver a STAFF.
- Precios sin separador de miles ni moneda (`$32000.00`, `$73000`); el commit del dashboard habla de COP.

## Restricciones

- **Base de codigo sin decidir:** los hallazgos son sobre `main`. La rama de trabajo actual `wip/correcciones-qa-y-notas` tiene cambios sin commitear y puede traer ya parte de esto (p. ej. destino de preparacion de categoria, filtros de KDS, opciones de pago). Antes de planificar, comprueba en wip cuales hallazgos ya estan resueltos o chocan, y propon sobre que rama se implementa. Esa decision es del usuario: si afecta al plan, devuelve un `bloqueo` con `para: usuario`.
- No tocar el arbol sucio de wip sin que el usuario lo decida; usa un worktree si necesitas probar.
- Para el fallo 2, la regla de negocio (¿se cancela la orden al cobrar? ¿se bloquea el cobro?) es decision de producto: presenta las opciones con recomendacion.
- El unico entorno de pruebas es local; no hay credenciales en este handoff.

## Que devolver

Un handoff `plan` al ejecutor (`agy`) con la tabla de unidades (oleadas, subagente/modo de su ficha, nivel de modelo, criterio por unidad) y copia al orquestador. Los hallazgos 1-4 pueden ir en oleadas paralelas si no comparten archivos; indica dependencias.
