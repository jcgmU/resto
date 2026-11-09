# Chequeos de verificación — resto

> Los mantiene el planificador cuando el stack está decidido. Los ejecuta el orquestador él mismo (ver Protocolo).
> Nota 2026-10-27: las menciones a Codex en este archivo son históricas; el planificador actual es `planner` (Claude Code).
> Base: 2026-10-11 por kimi (hilo frontend-lineagrafica, ronda 1). Corrección documental de A2: 2026-10-26 por codex durante onboarding; no implica reejecución ni aprobación de estos chequeos.

## Automáticos

| # | Chequeo | Comando (desde la raíz del proyecto) | Resultado esperado |
|---|---|---|---|
| A1 | Suite completa de tests (9 paquetes, Jest) | `pnpm -r run test` | exit 0. Base real previa al rediseño: **215/215** (38 suites). Tras el rediseño: todos en verde, incluidos los tests nuevos de UI. Nota: el handoff citaba 182/182; esa cifra está desactualizada (ver `03_Oleadas/Estado_MVP.md`: 213/213 tras ronda 7, +2 sin loguear). |
| A2 | Build completo (packages + apps + services) | `pnpm --filter "./packages/*" --filter "./apps/*" --filter "./services/*" -r run build` | exit 0. Los filtros van ANTES de `run build`; `pnpm run build` a secas solo compila `packages/*`. ts-jest no type-chequea todo: este build es obligatorio (precedente bug `OrderStatus`). Coordinar un `next dev` activo antes de compilar para evitar corromper `.next`; cualquier borrado requiere confirmación del usuario. |
| A3 | Tests del design system (tokens + bento + feature-guard) | `pnpm run test:ui` | exit 0. Los tests 39/40/44 de `packages/ui-components/test/bento.test.tsx` deben validar los valores **Lima & Tinta** (tinta `#0E100B`, lima `#D7F35C`, hueso `#ECEEE6`, papel `#FAFAF6`) y el contraste WCAG recalculado. |
| A4 | Sin clases Tailwind muertas ni hex fuera de tokens en el frontend | `grep -rnE "className=\"[^\"]*(p-|m-|grid|flex|bg-|text-)" apps/admin-dashboard/src apps/client-pwa/src --include="*.tsx"` y `grep -rnE "#[0-9a-fA-F]{6}" apps/admin-dashboard/src apps/client-pwa/src --include="*.tsx"` | Solo coincidencias justificadas: los 4 hex de la paleta en el archivo de tokens y ninguna clase de utilidad Tailwind (no hay toolchain Tailwind en el repo: esas clases son código muerto). |
| A5 | E2E HTTP de flujos reales (requiere stack Docker levantado: `docker compose -f docker-compose.dev.yml up -d` o equivalente) | `node e2e.mjs` | exit 0: register → login → menú → mesa/QR → sesión guest → carrito → confirmar pedido → KDS (IN_KITCHEN→READY→DELIVERED) → checkout CASH → cierre de sesión. Ningún flujo reemplazado por stubs. |
| A6 | ~~Smoke in-process de servicios~~ **RETIRADO (decision del planificador, 2026-10-11)** | `pnpm --filter @services/identity build && pnpm --filter @services/catalog build && node scripts/check-47-e2e.js` | Retirado: da 500 en register/login in-process por causa no atribuida a este hilo (`services/` y el script sin cambios; verificado por el orquestador en `brain/Verificaciones/2026-10-11-1905-verificacion.md`). A5 cubre el flujo real contra Docker. Si se repara el script en otro hilo, se reincorpora. |

## Manuales

| # | Chequeo | Cómo probarlo de verdad |
|---|---|---|
| M1 | Línea gráfica Lima & Tinta en las 17 vistas (9 Admin + 8 PWA) | Recorrer en Chrome cada vista de la lista confirmada en el plan (A1-A9, B1-B8). Todas usan tinta/lima/hueso/papel, Bricolage Grotesque + DM Sans, radios altos, sombras suaves; sin naranja `#EA580C`, ni rojo/dorado PWA viejo, ni azules `#2563eb` sueltos. Acentos solo en datos clave; cero elementos decorativos sin función (regla de `01_Arquitectura/UI_UX_Guidelines.md`). |
| M2 | Estados loading / empty / error / ok por vista | En cada vista: provocar carga lenta (throttling de red), lista vacía (tenant nuevo), error (gateway caído) y estado normal. Ninguna pantalla queda en blanco. |
| M3 | Breakpoints | Admin a 1440px y 1024px (sidebar colapsa); PWA a 375px y 390px landscape (targets táctiles ≥44px, safe-area respetada, sin scroll horizontal). |
| M4 | Flujo real admin de punta a punta | Con stack Docker: login → crear categoría/producto → crear mesa → ver QR → abrir KDS en otra pestaña → desde la PWA (M5) pedir → ver el pedido llegar al KDS en vivo (socket) → avanzar estados → pedir cuenta desde PWA → ver llamada de servicio en KDS → cobrar en `/checkout` con el modal de confirmación → mesa liberada. |
| M5 | Flujo real guest PWA | Escanear/abrir `/t/[tenantId]/[tableId]?k=...` → menú con categorías que filtran de verdad → detalle de producto con modificadores → carrito → confirmar pedido → vista de confirmación/seguimiento → pedir la cuenta. Verificar en consola que **no hay error de hidratación de React** (bug abierto de la ronda 6.1 que este hilo debe cerrar). |
| M6 | FeatureGuard / Próximamente | Con `NEXT_PUBLIC_FEATURE_FLAGS` sin `payments`/`analytics`/`kitchen-display`: las vistas fuera de alcance muestran `<Proximamente />` (no UI rota ni en blanco). Con los flags activos: las vistas funcionan. |
| M7 | Accesibilidad básica | Navegar cada vista solo con teclado (focus visible, orden lógico), contraste texto ≥4.5:1 (lima solo como fondo de chip con texto tinta), `prefers-reduced-motion` sin animaciones, una sola live region en KDS, modales con `role="dialog"` y foco gestionado. |

## hardening-p1 — ronda 1, plan del 2026-10-26

Fuente: `brain/Handoffs/2026-10-26-2112-codex-a-agy.md`. Estos chequeos están definidos para la ejecución y revisión; **todavía no están aprobados ni ejecutados por Codex**. Los baselines parciales de los subagentes se distinguen en el plan. Mantener los chequeos anteriores para el hilo visual; no reabrir equipo-usuarios ni admin-spa.

El antiguo A5 no es ejecutable en este checkout: no existe `e2e.mjs`. H12 lo sustituye para este hilo con el harness que debe entregar agy. `docker-compose.dev.yml` es solo un override de gateway y no levanta por sí solo el stack completo; el stack habitual usa `docker compose --profile services`, y las regresiones nuevas usarán Compose de pruebas aislado.

| # | Chequeo | Comando o prueba concreta | Resultado esperado |
|---|---|---|---|
| H0 | Evidencia TDD por hipótesis | Leer tabla y logs del handoff ejecución, comparar diff con reproducción | RED por aserción pertinente anterior al arreglo y GREEN posterior; descartes con prueba real ya verde. Errores de infraestructura/import no cuentan como reproducción. Máximo 3 intentos por test. |
| H1 | Harness real aislado | `pnpm test:hardening` (comando a crear por U0) | Descubre puertos de Postgres16/Redis7 exclusivos, aplica migraciones, ejecuta suites reales y recorrido gateway; exit 0. Ausencia de infraestructura produce error explícito; sin skip/fallback a memoria, reset/flush ni cambios en datos del usuario. |
| H2 | Cantidades y dinero | Suite ordering real dentro de H1 + tests de dominio en A1 | Tope decidido por usuario: 99 por línea, 99 válido; 100/1000, negativos, cero, fracciones y tipos incorrectos → 400 VALIDATION_ERROR. Fusión >99 falla sin escribir/evento. Pricing rechaza snapshot Redis fuera de 1–99 y overflow Decimal/centavos. -3 no genera Order/Payment. DELETE elimina. |
| H3 | Roles GraphQL | Suite catálogo real dentro de H1; JWT reales por gateway | Las 14 mutations niegan guest/STAFF/rol ausente/desconocido con errors.extensions.code FORBIDDEN, sin escrituras. ADMIN/MANAGER permitidos; no confundir HTTP200 GraphQL con éxito. |
| H4 | Queries guest e integración catálogo | GetMenu PWA real y confirmación de pedido dentro de H1 | Guest accede a categories/products y relaciones necesarias; otras raíces guest denegadas. La consulta interna product usada por ordering continúa funcionando. Aliases/fragments no eluden autorización. |
| H5 | Aislamiento tenant Prisma | Suite catálogo real dentro de H1, comprobar filas y joins antes/después | Disponibilidad, reasignación de categoría y attach de grupo no cruzan A/B; NOT_FOUND sin escritura ni filtración. Mismo tenant e idempotencia funcionan; descartar variantes ya protegidas con evidencia. |
| H6 | Sesión pagada y carrera económica | Suite ordering real dentro de H1 con dos clientes/apps y barreras | JWT guest previo no añade/confirma tras pago, incluso si falla cierre; carrera pedido/cobro serializada: pedido incluido o rechazado, sin monto viejo con pedido nuevo. Retry checkout conserva Payment/importe y completa cierre. |
| H7 | Cancelación consistente | Suite ordering HTTP/real dentro de H1 | STAFF obtiene 403 tanto cancel como status=CANCELLED, sin evento ni cambio. Mantener cancelación ADMIN/MANAGER y transiciones operativas STAFF ya permitidas. Sin política nueva de reembolso/postpago. |
| H8 | Refresh real | Suite identity real y recorrido gateway dentro de H1 | Register→refresh y login→refresh 200 con issuer/SHA256/Prisma reales; token viejo replay/expirado/revocado/inactivo 401; token nuevo funciona. No guardar tokens crudos en evidencia. |
| H9 | QR concurrente real | Suite session real dentro de H1 | Dos instancias y lote concurrente devuelven una sesión activa/puntero y JWT ganador; TTL, cierre/reapertura y cierre antiguo no reviven ni borran sesión nueva. Redis real, sin mutex JS ni sleeps como barrera. |
| H10 | Carrito concurrente real | Suite ordering real dentro de H1 | Snapshot A crea una orden; B concurrente queda en carrito, incluso misma línea. Fallo PG restaura sin perder B; fallo postcommit/preack se recupera sin duplicado. Doble confirmación no duplica snapshot; PATCH/DELETE reservado retorna conflicto. |
| H11 | Admin asíncrono | `pnpm --filter @apps/admin-dashboard test --runInBand --runTestsByPath test/api.refresh.test.ts test/checkout.flow.test.tsx` y A1 | Cuenta/payload pertenecen a selección vigente con respuestas B→A; modal invalida cambio de mesa; doble click protegido. Refresh compartido, 401 tardío y login/logout concurrentes conservan autenticación correcta, máximo un retry. |
| H12 | Flujo real por gateway | Recorrido HTTP incorporado a `pnpm test:hardening` | Register/login→refresh→menú→QR→carrito→pedido→KDS→checkout→rechazo postpago con servicios/adaptadores reales; ninguna sesión especial que omita HTTP. Sin usar e2e.mjs inexistente. |
| H13 | CI reproducible | Revisar `.github/workflows/ci.yml`; ejecutar frozen install, los 3 prisma generate, A2, A1 y H1 en entorno temporal con estos cambios | Exit 0 con dependencias vacías; Node compatible con undici >=22.19.0, pnpm fijado/lock intacto, migraciones deploy aisladas. Sin secretos locales ni skip silencioso. Sin commit/push no afirmar ejecución remota de Actions. |
| H14 | Integración final y diff | A1 `pnpm -r run test`; A2 build completo; `git diff --check`; diff y manifiesto de archivos nuevos | Todo verde. Codex y después claude corren personalmente tests/build; no basta informe ajeno. Coordinar next dev o build en copia temporal sin alterar trabajo existente. Sin cambios SPA ni client-pwa no justificados. |

Comandos `test:real` propuestos de U0, ejecutados por el harness con URLs de pruebas explícitas: `pnpm --filter @services/identity test:real`, `pnpm --filter @services/catalog test:real`, `pnpm --filter @services/session test:real`, `pnpm --filter @services/ordering test:real`. No ejecutarlos contra bases/Redis predeterminados del usuario ni confundirlos con las suites actuales de memoria. Todos los clientes y procesos propios se cierran al terminar; los recursos conservados se listan en la ejecución.

| # | Manual pendiente para claude después de ejecución | Cómo verificar de verdad |
|---|---|---|
| HM1 | Checkout sin cruce de cuentas | Con dos mesas/importe distintos y red lenta, seleccionar A→B y confirmar B. Nombre, importe, método y modal corresponden a B; doble click no provoca doble pago y cambiar selección invalida cuenta/modal anterior. |
| HM2 | Sesión admin bajo refresh | Con access expirado y refresh válido, disparar dos consultas y comprobar en red una sola rotación y continuidad. Iniciar sesión distinta o logout durante refresh pendiente; la respuesta antigua no restaura ni borra la nueva sesión. |
| HM3 | PWA y postpago | Abrir QR, consultar menú, confirmar pedido y cobrar desde admin. Con la pestaña guest anterior, intentar otro pedido: error claro y ninguna Order nueva; KDS y cierre/liberación de mesa siguen funcionando. |

Si no hay navegador real disponible, HM1–HM3 quedan MANUAL pendiente y se declara en el handoff; jsdom no acredita recorrido visual. Engram siempre `resto`.

### Punto de control obligatorio — enmienda ronda 2 del usuario

Fuente vigente: `brain/Handoffs/2026-10-26-2330-claude-a-agy.md`. La ejecución se detiene tras las oleadas 0–2, únicamente **U0–U5**. Todavía no existe handoff de ejecución parcial ni aprobación de este punto de control. Codex debe comprobar lo siguiente sobre la entrega estable de agy:

| Alcance parcial | Criterio obligatorio antes de listo-para-verificar parcial |
|---|---|
| U0 | Harness aislado operativo para las regresiones de este punto de control, comandos reproducibles y recursos identificados. Separar explícitamente escenarios de unidades futuras sin ocultar fallos de U0–U5. |
| U1 / H2 | Ejecutar personalmente tests HTTP, caso de uso y pricing de 99 válido, 100/1000 inválidos y merge que supera 99 sin cambios persistidos; cantidad -3 y límites monetarios también cubiertos. Revisar RED anterior y GREEN posterior. |
| U2–U3 / H3–H5 | Roles y queries de catálogo, aislamiento de disponibilidad/categoría/grupos con Prisma real y datos A/B, incluidos descartes sustentados. |
| U4 / H6–H7 | Rechazo de pedidos/mutaciones postpago, retry con cierre fallido, carrera pedido-cobro bajo coordinación real y cancelación STAFF denegada por ambos endpoints. No atribuir la protección postpago a una oleada futura. |
| U5 / H11 parcial | Checkout A/B con respuestas/errores tardíos, modal invalidado y payload consistente. El subalcance refresh admin de H11 pertenece a U8 y sigue pendiente. HM1 continúa siendo prueba manual de claude. |
| Regresión y compilación | Codex ejecuta `pnpm -r run test` y `pnpm --filter "./packages/*" --filter "./apps/*" --filter "./services/*" -r run build`, revisa diff y archivos nuevos, y registra comandos/exit/logs en su informe parcial. Coordinar next dev o compilar en copia temporal con los cambios actuales. |
| Handoff | Tabla U0–U5, modelos reales y limitaciones, RED/GREEN por hipótesis y pendientes; si falla algún criterio, nuevo plan/corrección, sin listo-para-verificar automático. Si cumple, listo-para-verificar **parcial** a claude, sin aprobar el hilo completo. |

Permanecen pendientes y sin autorización de inicio las oleadas 3–6: U6 refresh identity (H8), U7 concurrencia QR (H9), U8 refresh admin (parte H11/HM2), U9 reservas y concurrencia carrito (H10), U10 CI (H13) y U11 integración final completa (H12/H14 completos). Un build/regresión de control no cierra U11. El flujo parcial no exige corregir el refresh conocido de U6 para verificar U0–U5. U9 conservará el tope 99 al restaurar. La oleada 3 requiere nueva indicación de claude; admin-spa no se planifica.

### Revisión de ejecución final — hardening-p1 ronda 5 (2026-10-27)

Codex ejecutó A1 (`pnpm -r run test`: 87 suites / 550 tests, PASA), A2 (build completo en copia aislada: PASA), H1 (`pnpm test:hardening`: 13 suites reales / 49 tests + 6 bloques E2E Gateway, PASA) y `git diff --check` (PASA). **La ronda no queda aprobada**: hay hipótesis funcionales/de seguridad que no tienen cobertura y defectos observados en diff: evento omitido al reintentar checkout, adición de carrito que puede finalizar postpago, recuperación de reserva solo coordinada dentro de un proceso, bypass sintético `s-smoke-e2e`, error de checkout sin cuenta no visible, carrera A→B→A sin generación monotónica, y suites reales con fallback a URLs locales. Ver plan correctivo ronda 6 en `brain/Handoffs/2026-10-27-0205-codex-a-agy.md`. HM1–HM3 continúan manuales pendientes de claude.

### Revisión de ejecución correctiva — hardening-p1 ronda 6 (2026-10-27)

Codex ejecutó A1 (`pnpm -r run test`: 88 suites / 556 tests, PASA), A2 (build de los 9 proyectos en copia aislada, PASA), H1 (`pnpm test:hardening`: 13 suites reales / 61 tests + 6 bloques Gateway, PASA) y `git diff --check` (PASA). **No se emite listo-para-verificar**: catálogo continúa publicado en `4002:4002` con `x-user-role` confiado en acceso directo y parser JWT manual; `HARNESS_PROJECT_NAME`/`HARNESS_COMPOSE_FILE` pueden redirigir `down -v` y el marker fijo puede colisionar; el evento checkout se marca antes de publish; falta fencing al reanudar un lease vencido; pago admin tardío puede dejar bill stale. Hallazgos y plan final R7 en `brain/Handoffs/2026-10-27-0256-codex-a-agy.md`. Por decisión de claude, R7 es la última ronda: P0/P1 bloquean; hallazgos P2/P3 nuevos van al backlog `brain/Backlog/hardening-p1.md`; si persiste P0/P1 se emite bloqueo, sin R8. HM1–HM3 siguen manuales para claude.

### Revisión de ejecución final — hardening-p1 ronda 7 (2026-10-27)

Codex repitió A1 (`pnpm -r run test`: 88 suites / 577 tests, exit 0), H1 (`pnpm test:hardening`: 13 suites reales / 68 tests + 6 bloques E2E Gateway, exit 0 y cleanup completado), build completo A2 (9 proyectos en copia aislada, exit 0) y `git diff --check` (exit 0). No se emite `listo-para-verificar`: persiste P1 en U4. `RedisEventPublisher.publishCheckoutCompleted` utiliza Redis Pub/Sub; un retorno con cero suscriptores se trata como éxito y `ConfirmCheckout` marca PUBLISHED, por lo que el subscriber desconectado pierde la notificación. Si el proceso cae después del publish y antes de marcar, el retry puede duplicarla; el consumidor en `realtimeWiring` no usa `consumeCheckoutEventOnce`. El test R7 cubre falla previa a publish y retry, pero no subscriber offline ni caída en esa ventana. Dado que ronda 7 es la última, se emite bloqueo para usuario y no se abre R8. Hallazgo adicional U0: la API exportada `createHarnessController` permite `composeFile` arbitrario y `projectName` interpolado sin escape en shell `docker compose ... down -v`; el CLI sí usa project aleatorio y compose fijo, pero la garantía del controlador queda incompleta. Build inicial en scratch con symlink de `node_modules` falló por resolución React; el build limpio aislado posterior pasó. HM1–HM3 siguen manuales.

## mesas-lote
| ID | Chequeo | Esperado |
|---|---|---|
| ML1 | `pnpm -r --no-bail run test` | todas las suites en verde (admin-dashboard 21/177, session 5/52, gateway 2/39) |
| ML2 | `pnpm test:hardening` | verde, incluye `[E2E 7/7] Batch Table Management` y `session test:real` 3 suites/13 tests; 0 contenedores/volúmenes `resto-test-*` |
| ML3 | build de los 9 proyectos en copia aislada | exit 0, ruta `/mesas` compila |
| ML4 | `git diff --check` | limpio |
| MLM1 | Manual en /mesas (admin): "Crear varias" por prefijo y por lista, duplicado muestra conflicto sin crear nada | OK |
| MLM2 | Manual: seleccionar varias, editar en lote (renombrar + estado), editar una | OK |
| MLM3 | Manual: abrir sesión por QR en una mesa, eliminar varias incluyendo esa: resultado por mesa con motivo; el QR de la borrada da 404 | OK |
| MLM4 | Manual: login STAFF no ve acciones de creación/edición/borrado | OK |
