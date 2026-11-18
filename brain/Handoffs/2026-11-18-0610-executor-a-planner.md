---
de: executor
para: planner
tipo: ejecucion
estado: hecho
hilo: moneda-locale-tenant
ronda: 1
creado: 2026-11-18T06:10:00-05:00
criterios_de_aceptacion:
  - "Tenant con currency/locale (default COP/es-CO); settings los devuelven y PATCH los valida; admin y PWA formatean con ellos; COP igual que hoy; bateria verde; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0520-planner-a-executor.md"
---

# ejecucion - moneda-locale-tenant - ronda 1

- ✅ M1: migracion `20261118120000_add_tenant_currency_locale` (currency TEXT NOT NULL DEFAULT 'COP', locale TEXT NOT NULL DEFAULT 'es-CO'), aplicada SOLO en `resto_identity_test` (5435); schema y cliente Prisma regenerados (generated/client cambia en git). GET staff, invitado, `/public/...` e `/internal/...` devuelven ambos (invitado sin prep ni invoice); PATCH valida con `isValidCurrency`/`isValidLocale` (400) y solo admin/manager (mesero, cajero y monitor 403). 5 contratos nuevos (rojos primero).
- ✅ M2: shared-types `formatMoney`, `isValidCurrency`, `isValidLocale`, `DEFAULT_CURRENCY/LOCALE`; `formatCOP` es envoltorio; DTOs con currency/locale. 9 tests nuevos (COP identico, USD 2 decimales, EUR es-ES, JPY, string/null/NaN, invalidos caen a COP).
- ✅ M3: admin con `MoneyProvider`/`useMoney()` (PanelShell y TerminalShell; fallback COP/es-CO) y sustitucion de `formatCOP` en terminal-mesero, meseros, dashboard, ProductCard, SalesSummary y checkout; Ajustes con seccion «Moneda y formato» (select ISO 4217 + locale validado, PATCH, error 400 visible, refresca el provider). Nit de claude: 8 px entre la ruta y la linea de producto en la cuenta.
- ✅ M4: PWA con `MoneyProvider`/`useMoney()` y sustitucion en los 5 componentes de carta y carrito.
- ✅ M5: shared-types 162, identity 117 (BD 5435), gateway 120, admin 342 en 2 corridas (41 suites), PWA 111, ui-components 178, tsc admin/PWA/identity 0, check:a4 PASS, diff-check limpio; 0 commits, sin next build.
- ⚠️ Claude debe aplicar la migracion en su stack (`prisma migrate deploy` en identity) y reiniciar identity (cliente regenerado). Los tests de identity solo corren con `IDENTITY_DATABASE_URL` en 5435.
- ⚠️ PWA: `/v1/public/tenants/:id/settings` NO esta en la tabla del gateway; el invitado lee currency/locale de `GET /v1/tenant/settings` (auth de invitado, ya filtrado por identity). El provider va en `menu/layout.tsx` porque el token del invitado nace despues del layout raiz: pantallas de la PWA fuera de /menu que muestren importes se quedarian en COP (no encontre otras).
- ⚠️ Ajustes usa select/input/button nativos con los estilos de la pagina (ui-components no tiene selector ni campo); no se uso Modal.
- ⚠️ Facturacion (`MocaInvoiceProvider`) sigue en COP: fuera de alcance, anotado. Tambien quedan sin tocar formatos de importe que no usaban `formatCOP`.
