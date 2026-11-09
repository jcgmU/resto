---
de: codex
para: usuario
tipo: bloqueo
estado: pendiente
hilo: hardening-p1
ronda: 7
creado: 2026-10-27T03:30:00-05:00
criterios_de_aceptacion:
  - "No se declara listo-para-verificar mientras un fallo del subscriber pueda perder permanentemente session.checkout-completed."
  - "La última ronda R7 no se prolonga sin una decisión explícita de alcance; no se abre R8 automáticamente."
referencias:
  - "brain/Handoffs/2026-10-27-0326-agy-a-codex.md"
  - "services/ordering/src/application/ConfirmCheckout.ts"
  - "services/ordering/src/infrastructure/events/RedisEventPublisher.ts"
  - "services/ordering/src/infrastructure/realtime/realtimeWiring.ts"
  - "services/ordering/src/infrastructure/persistence/RedisCartRepository.ts"
---

# bloqueo - hardening-p1 - ronda 7

## Motivo del bloqueo P1 (U4)

La entrega de `session.checkout-completed` no es durable de extremo a extremo. `RedisEventPublisher.publishCheckoutCompleted` resuelve cuando `PUBLISH` devuelve, incluso si Redis reporta cero suscriptores. `ConfirmCheckout` marca entonces el outbox `PUBLISHED`; un subscriber desconectado pierde permanentemente la notificación. Además, si el proceso cae después del publish pero antes de `markCheckoutCompleted`, el retry publica otra vez; el consumidor realtime puede emitir duplicados. `consumeCheckoutEventOnce(eventId)` está definido pero no se invoca desde el subscriber ni desde `realtimeWiring`.

La prueba R7 solo inyecta una falla antes de que el publisher acepte el evento y demuestra retry en ese caso. No prueba subscriber offline ni crash en la ventana entre aceptación y marca. El criterio de aceptación U4 exige explícitamente recuperación sin pérdida ni duplicados observables, así que este P1 impide listo-para-verificar.

## Validación independiente de Codex

| Chequeo | Resultado |
|---|---|
| `pnpm -r run test` | PASA, 88 suites / 577 tests |
| `pnpm test:hardening` | PASA, 13 suites reales / 68 tests + 6 bloques E2E Gateway; cleanup de proyecto aislado completado |
| Build completo de packages/apps/services | PASA, 9 proyectos en `/private/tmp/resto-r7-review-Ymf9iK`; el scratch inicial con symlink de `node_modules` falló por resolución de React y se repitió correctamente en clean-room |
| `git diff --check` | PASA |
| Revisión U4 del diff | FALLA: pérdida posible con cero subscribers y duplicación posible tras crash en publish/mark |

## Hallazgo de aislamiento del harness (U0)

También queda por resolver o aceptar explícitamente que `createHarnessController` exportado admite un `composeFile` arbitrario y un `projectName` controlable que se interpola sin escape en `docker compose ... down -v`. El CLI normal sí usa un nombre generado `resto-test-*` y compose fijo, pero la API de cleanup no garantiza por sí sola que una invocación externa no alcance otro proyecto o inyecte argumentos.

## Decisión necesaria

La decisión previa de claude definió R7 como última ronda y prohibió R8 automático. Pido que usuario/claude decida si abre un alcance correctivo adicional limitado a U4 (y U0 si se considera bloqueante), o si acepta explícitamente ese riesgo y redefine el criterio de cierre. Hasta entonces el hilo queda bloqueado y no se emite `listo-para-verificar`. HM1–HM3 permanecen manuales pendientes; no se planifica `admin-spa`.
