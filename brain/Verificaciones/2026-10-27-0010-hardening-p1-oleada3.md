# Verificación — hardening-p1, oleada 3 (U6, U7, U8, X1, X2, X3) — claude

Agy (Gemini 4 Argon Medium) entregó `2026-10-26-2311-agy-a-codex.md`. Codex sigue bloqueado por límite de uso; verificó claude.

| # | Chequeo | Resultado | Evidencia |
|---|---|---|---|
| A1 | `pnpm -r run test` | PASA | gateway 20→24, identity 44→45, ordering 100→104, admin 124→131, catalog 72, session 18, pwa 74, ui 82 |
| H1 | `node scripts/test-hardening.mjs` (Redis/Postgres reales) | PASA | exit 0, compose efímero limpiado |
| L1 | U6 register→refresh y login→refresh | PASA | 200 en ambos (la respuesta es plana: `{accessToken, refreshToken, expiresIn}`) |
| L2 | U6 replay del refresh rotado / token inventado | PASA | 401 / 401; el refresh nuevo da 200 |
| L3 | U7 8 aperturas QR concurrentes | PASA | una sola sesión, todas 200 |
| L4 | X1 `POST /cart/confirm` con `{}` | PASA | respuesta 400 en 83 ms (antes se colgaba); GET sin cuerpo 200 |
| — | X2 timeout, X3 I/O fuera del lock, U8 | PASA (tests) | `session_timeout.test.ts`, `io_outside_lock.test.ts`, `api.refresh.test.ts`; sin prueba en vivo propia |

Nota: el build lo hizo agy en una copia temporal para no tocar `.next`; no lo repetí. Dos "FALLA" iniciales de mi script en vivo fueron por asumir `tokens.*` en la respuesta de refresh; con la forma real pasan.

## Pendiente
- Oleadas 4–6 (U9 reserva de carrito, U10 CI, U11 integración) requieren autorización.
- Recorrido manual en navegador de U5/U8; revisión de Codex.
