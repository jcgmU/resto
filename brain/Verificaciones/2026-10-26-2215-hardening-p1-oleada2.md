# Verificación — hilo hardening-p1, oleadas 0–2 (claude, haciendo de planificador y orquestador)

Contexto: Codex quedó bloqueado por un aviso de límite de uso; por indicación del usuario claude revisó y verificó la entrega de agy (`2026-10-26-2215-agy-a-codex.md`). Modelo de agy en esta ronda: Gemini 3.8 Flash (Medium), referencia previa al cambio a Gemini 4 Argon.

## Chequeos

| # | Chequeo | Resultado | Evidencia |
|---|---|---|---|
| A1 | `pnpm -r run test` | PASA | exit 0. catalog 13→72, ordering 53→100, admin 117→124, identity 44, gateway 20, session 18, pwa 74, ui 82 |
| A2 | build packages+apps+services | PASA | exit 0, 0 errores TS/Next |
| H1 | `node scripts/test-hardening.mjs` (Redis/Postgres reales, proyecto compose efímero) | PASA | todas las suites `test-real` en verde; su `down -v` solo afecta al proyecto `resto-test-<ts>-<n>` |
| L1 | U2: guest y STAFF no mutan catalog; guest sí lee el menú; ADMIN sí | PASA | FORBIDDEN en guest/STAFF (crear categoría, borrar producto); `products` visible para guest |
| L2 | U3: A no cambia disponibilidad ni enlaza categoría de B | PASA | NOT_FOUND; producto de B sigue `isAvailable=true` |
| L3 | U1: cantidades -3, 0, 1.5, "2", 100, 1000, null | PASA | 400 `VALIDATION_ERROR` en todas |
| L4 | U1: 99 válido; fusión que supera 99 rechazada; carrito intacto | PASA | 201 / 400 / una línea con qty 99 |
| L5 | U4: STAFF no cancela por `/status` ni por `PATCH /cancel` | PASA | 403 / 403 |
| L6 | U4: tras el cobro, el invitado no agrega ni confirma | PASA | 409 `SESSION_NOT_ACTIVE` en ambos |
| L7 | U5: checkout admin A/B | PARCIAL | cubierto por test RTL con promesas controladas (`checkout.concurrency.test.tsx`, verde); recorrido manual en navegador PENDIENTE |
| — | U6 refresh (oleada 3, no ejecutada) | INFO | sigue dando 401, como se esperaba |

Prueba en vivo: script `live_wave2.mjs` contra el gateway real tras reconstruir los contenedores con el código nuevo: **27/27**.

## Hallazgos nuevos (no estaban en el plan)

1. **P2, gateway (anterior a esta ronda, commit c4188d5):** `httpProxy.ts` solo reenvía el cuerpo si `Object.keys(req.body).length > 0`. Un `{}` explícito con `Content-Length: 2` deja al upstream esperando bytes: la petición se cuelga sin error ni log. Reproducido con `POST /v1/cart/confirm` y cuerpo `{}`. La PWA manda `{tableId}` y no se ve afectada; cualquier cliente que envíe `{}` sí.
2. **P2, ordering (U4):** `HttpSessionServiceAdapter` no define timeout. Si el servicio de sesiones se cuelga, `confirm` se cuelga con él.
3. **P3, ordering (U4):** dentro de `runInSessionLock` se hace I/O externo (Redis del carrito y consulta HTTP a catalog) con el advisory lock y la conexión de Postgres abiertos, con `timeout: 15000`. Un catalog lento serializa y puede agotar la transacción de otras confirmaciones de la misma sesión.
4. **Higiene:** quedan 2 contenedores `resto-test-1793070899868-339-{postgres,redis}-1` de una corrida anterior de agy (no de esta verificación).
5. **Contrato:** el gateway solo expone `PATCH /v1/orders/:id/cancel`; `POST` devuelve 404. No es defecto, pero conviene documentarlo.

## Pendiente
- Recorrido manual de U5 (A/B) en navegador.
- Revisión de Codex (bloqueado por límite de uso hasta ~01:37).
- Decidir oleadas 3–6 y si se añaden los hallazgos 1–3 como unidades.
