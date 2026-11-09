# Backlog P2/P3 — hardening-p1

Estos puntos no bloquean la última ronda correctiva R7 mientras no cambien la clasificación a seguridad, pérdida de datos/cobros o concurrencia económica.

| Severidad | Hallazgo | Evidencia / alcance | Seguimiento |
|---|---|---|---|
| P3 | Advertencias React `act(...)` en pruebas PWA | Aparecen en `pnpm -r run test`; las suites pasan. | Ajustar el control async de los tests si se vuelve a tocar ese flujo. |
| P3 | `Not implemented: navigation` de jsdom y deprecación `util._extend` | Salida de tests admin/gateway/catalog; exit 0. | Limpiar warnings cuando se trabaje en esas suites. |
| P3 | Deprecación `url.parse()` (`DEP0169`) en Node 22 al ejecutar `pnpm` | Aparece en stderr durante `pnpm install --frozen-lockfile`; no afecta lockfile ni resolución. | Se resuelve al actualizar `pnpm` en un hilo de mantenimiento de toolchain. |
| P2 | Consumo no atómico de refresh token en `RefreshSession` ante dos clientes distintos concurrentes | Documentado desde U6 (línea 146 del plan R1): `findByTokenHash` + `revoke` resuelve rotación secuencial y en `admin-dashboard` U8 coordina single-flight por generación, pero dos dispositivos distintos usando el mismo refresh token al mismo milisegundo no usan CAS en DB. | Evaluar `UPDATE ... WHERE revoked_at IS NULL RETURNING *` en un hilo futuro de `identity` si se habilitan múltiples sesiones por refresh token. |
| P2 | Workflow CI no ejecutado remotamente en GitHub Actions | No hay commit/push autorizado; los pasos fueron reproducidos localmente en clean-room. | Verificar en CI tras un push autorizado por claude/usuario. |

HM1–HM3 no se incluyen como defectos P2/P3: siguen siendo verificaciones manuales pendientes de claude según `brain/Equipo/Verificacion.md`.

## Añadido por claude (2026-10-27 03:55) — decisión sobre el bloqueo de R7
- **P2 — `session.checkout-completed` no durable:** hoy viaja por Redis Pub/Sub y su único consumidor es el push realtime al admin (`realtimeWiring.ts`). El estado real (pago, sesión cerrada) ya está en Postgres, así que perder o duplicar el push solo afecta a un cliente conectado, que se rehidrata al recargar. Pasarlo a Redis Streams con consumer groups y llamar a `consumeCheckoutEventOnce` desde el subscriber queda para el siguiente hilo.
- **P3 — `createHarnessController`:** acepta `composeFile`/`projectName` arbitrarios; el CLI usa nombre generado `resto-test-*`. Validar con regex `^resto-test-[0-9a-z-]+$` y no interpolar en shell.
- **P3 — puertos 4003 (session) y 4004 (ordering)** siguen publicados en el host; el catálogo ya no. Confirmar que ordering/session no confían en `x-user-role` sin gateway.

## mesas-lote (planner, 2026-10-27)
- P2: `RotateTableQrKeyUseCaseImpl` hace `findById` + `save` no atómico; una rotación concurrente con `softDeleteMany` puede resucitar la mesa (`save` sobrescribe `deleted`). Volver la rotación un script Lua condicionado a `status != deleted`.
- P2: "pedido abierto" se aproxima como "sesión activa" (session no consulta ordering). Una sesión expirada por TTL con pedido abierto permite borrar la mesa; el historial conserva `tableId` pero no se resuelve la etiqueta.
- P3: `TABLE_LABEL_TAKEN.details.conflicts` devuelve `labelKey` (minúsculas normalizadas), no el label original; la UI debe comparar en minúsculas.
- P3: fallback legacy de `labelKey` en Lua solo baja a minúsculas ASCII + tildes comunes; filas legacy con otros alfabetos pueden colisionar sin detectarse.
- P3: `pnpm -r run test` en paralelo con otras cargas puede agotar el timeout de 5 s de `client-pwa/serviceCalls.flow` (pasa aislado y en corrida limpia).
