# Verificación final — hardening-p1 (U0–U11 + X1–X3) — claude

Entrega: `2026-10-27-0143-agy-a-codex.md`. Verificó claude (Codex bloqueado por límite de uso).

| # | Chequeo | Resultado |
|---|---|---|
| A1 | `pnpm -r run test` | PASA (ordering 104, admin 131, catalog 72, identity 45, gateway 24, session 18, pwa 74, ui 82) |
| H1 | `node scripts/test-hardening.mjs` | PASA, exit 0 |
| V1 | Regresión en vivo oleada 2 (27 checks) | 27/27 |
| V2 | Regresión en vivo oleada 4 (carrito concurrente) | 4/4 |
| V3 | Regresión en vivo oleada 3 | 6/8 por asumir mal la forma de la respuesta de refresh en mi script; con la forma real pasa (ver informe de oleada 3) |
| C1 | `.github/workflows/ci.yml` revisado | Frozen install, prisma generate, build, tests y `pnpm test:hardening`; permisos `contents: read`. Sin ejecutar en GitHub (no hay push) |

## Pendiente
- Recorrido manual en navegador (checkout A/B, refresh admin).
- Sin commit ni push (esperan al usuario). Revisión de Codex pendiente (límite de uso).
- PR #2: espera cambios del contribuidor. Siguiente objetivo: `admin-spa`.
- Higiene: contenedores `resto-test-…339-*` antiguos.
- Causa del cuelgue de una suite `test:real` de ordering (~31 min) sin determinar.
