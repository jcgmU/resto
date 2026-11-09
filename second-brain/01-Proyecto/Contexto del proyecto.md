---
tags: [proyecto, contexto]
actualizado: 2026-10-10
---
# Contexto del proyecto

SaaS B2B2C multi-tenant para restaurantes/bares: dashboard de staff + PWA de cliente (QR en mesa → menú → carrito → pedido → cuenta). Monorepo pnpm + Turborepo, microservicios con arquitectura hexagonal.

Fuente completa: `CONTEXTO-RESTO.md` (Downloads) y `03_Oleadas/Estado_MVP.md` en el repo.

## Repo
- Local: `~/Developer/Resto` (rama `main`)
- Remoto: https://github.com/jcgmU/resto.git
- Último commit conocido: `c4188d5` (2026-10-10)

## Stack
Node + TypeScript, Prisma 5 (un schema por servicio), PostgreSQL 16, Redis 7, Socket.io (en `ordering`), Next.js (2 apps), Docker Compose.

## Servicios
| Servicio | Puerto | Store | Rol |
|---|---|---|---|
| gateway | 4000 | — | BFF declarativo, proxy HTTP+WS, JWT/roles |
| identity | 4001 | Postgres `resto_identity` | Tenants, usuarios, auth |
| catalog | 4002 | Postgres `resto_catalog` | Categorías/productos, GraphQL |
| session | 4003 | Redis | Mesas, sesiones, QR |
| ordering | 4004 | Postgres `resto_ordering` + Redis db1 | Carrito, pedidos, checkout, Socket.io |

Frontends: `admin-dashboard` :3000, `client-pwa` :3001.

## Reglas de diseño
- `tenantId` sale del JWT y viaja en `x-tenant-id`; se ignora el del body.
- Sin FK físicas entre bases de datos.
- Bento Box: tokens `--bento-*`, prohibido hardcodear hex/px.
- UI de oleadas futuras tras `<FeatureGuard>`.
- TDD rojo-verde, circuit breaker de 3 intentos.
- Un cambio no está verificado hasta probarlo contra Docker real y/o UI real (ver [[Bugs conocidos]]).

## Estado (2026-10-10)
Oleadas 0-5 cerradas, Ronda 7 (`/mesas`) cerrada, 213/213 tests según el log. Sin verificar de nuevo en esta máquina.

## Próximo trabajo sugerido
- Arreglar error de hidratación en `client-pwa`.
- Cualquier feature nueva es "oleada 6+": preguntar alcance antes.
