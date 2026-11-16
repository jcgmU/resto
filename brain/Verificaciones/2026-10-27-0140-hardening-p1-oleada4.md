# Verificación — hardening-p1, oleada 4 (U9) — claude

Entrega de agy: `2026-10-27-0127-agy-a-codex.md`. Verificó claude (Codex bloqueado).

| # | Chequeo | Resultado | Evidencia |
|---|---|---|---|
| A1 | `pnpm -r run test` | PASA | ordering 104, admin 131, catalog 72, gateway 24, identity 45, session 18, pwa 74, ui 82 |
| H1 | `node scripts/test-hardening.mjs` | PASA | exit 0; ordering test:real 20/20 (incluye `cart_reservation_concurrency`) |
| L1 | 10 adds concurrentes del mismo plato | PASA | 1 línea, qty 10 |
| L2 | add concurrente durante confirm | PASA | la adición queda en el carrito, no en el pedido, no se pierde |
| L3 | doble confirm concurrente | PASA | 201 + 409 (un solo pedido) |
| L4 | tope 99 | PASA | 400 |

Incidencia: una suite `test:real` de ordering quedó colgada ~31 min; claude mató ese proceso de jest y agy repitió la corrida en verde. Causa del cuelgue no determinada (reproducir si reaparece). Quedan procesos jest antiguos de agy (~2 h) y contenedores `resto-test-…339-*` sin limpiar.

Build: agy compiló packages y services sin tocar `.next`; no repetido por claude.
