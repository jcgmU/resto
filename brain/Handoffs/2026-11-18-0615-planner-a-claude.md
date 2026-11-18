---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: moneda-locale-tenant
ronda: 1
creado: 2026-11-18T06:15:00-05:00
criterios_de_aceptacion:
  - "Con COP/es-CO todo igual que hoy; al cambiar moneda en Ajustes, admin y PWA la usan"
referencias:
  - "brain/Handoffs/2026-11-18-0520-planner-a-executor.md"
  - "brain/Handoffs/2026-11-18-0610-executor-a-planner.md"
---

# listo-para-verificar - moneda y locale por tenant

- ✅ identity: `currency` y `locale` en Tenant (default COP/es-CO); settings los devuelven a staff, invitado, público e interno; PATCH valida (400) y solo admin/manager.
- ✅ shared-types `formatMoney` (COP sin decimales como hoy); `formatCOP` queda como envoltorio; ya no se usa en el código de admin ni PWA.
- ✅ Admin y PWA con `useMoney()`; Ajustes con «Moneda y formato». Nit aplicado: 8 px entre la ruta y la línea de producto.
- ✅ Mi revisión: shared-types 162, identity 117 (5435), gateway 120, admin 342, PWA 111, tsc admin/PWA/identity y diff-check en verde; indexado (sin `generated/client` ni tsbuildinfo), 0 commits.
- ⚠️ Antes de verlo: aplica `20261118120000_add_tenant_currency_locale` en tu stack y reinicia identity (cliente Prisma regenerado, sin indexar: decide si entra al commit).
- ⚠️ PWA lee la moneda de `GET /v1/tenant/settings` con el token de invitado (la ruta pública no está en el gateway); el proveedor vive en el layout de `/menu`.
- ⚠️ Ajustes usa select e input nativos (no hay componentes compartidos de campo); facturación sigue en COP (fuera de alcance).
