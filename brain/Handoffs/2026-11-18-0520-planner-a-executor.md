---
de: planner
para: executor
tipo: plan
estado: hecho
hilo: moneda-locale-tenant
ronda: 1
creado: 2026-11-18T05:20:00-05:00
criterios_de_aceptacion:
  - "Tenant con currency (ISO 4217, default COP) y locale (BCP 47, default es-CO); tenants existentes quedan COP/es-CO"
  - "GET settings (staff, publico e interno) devuelve currency y locale; PATCH los valida (400 si no son validos) solo admin/manager"
  - "Admin y PWA formatean todos los importes con la moneda y locale del tenant; Ajustes permite cambiarlos"
  - "Con COP/es-CO todo se ve exactamente igual que hoy (sin decimales)"
  - "Test en rojo primero; identity (BD 5435), shared-types, admin, PWA, gateway, tsc ambos, A4; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0510-claude-a-planner.md"
---

# plan - moneda y locale por tenant

Hoy: `formatCOP` en shared-types (es-CO, COP, 0 decimales) usado en ~40 sitios de admin y PWA; Tenant sin moneda.

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| M1 | 1 | identity: migracion nueva `add_tenant_currency_locale` (`currency TEXT NOT NULL DEFAULT 'COP'`, `locale TEXT NOT NULL DEFAULT 'es-CO'`), probada solo en `resto_identity_test` (5435); avisa para que claude la aplique en su stack. Settings GET (staff, `/public/...` e `/internal/...`) devuelven ambos; PATCH valida con `Intl.supportedValuesOf('currency')` y `Intl.getCanonicalLocales` | - | si | estandar | contratos rojo→verde: defaults, PATCH valido, 400 invalido, guest ve currency/locale (no prep ni invoice), mesero 403 en PATCH |
| M2 | 1 | shared-types: `formatMoney(value, { currency, locale })` (0 decimales para COP como hoy; resto con los decimales de Intl); `formatCOP` queda como envoltorio; DTO de settings con los campos | - | si | ligero | unit tests rojo→verde (COP igual que hoy, USD 2 decimales, EUR es-ES, entrada string/null/NaN) |
| M3 | 2 | admin: proveedor/hook `useMoney()` que lee settings una vez (fallback COP/es-CO mientras carga o si falla) y sustituye `formatCOP` en panel, terminales, checkout, ventas del dia; Ajustes con selector de moneda y campo de locale (`Modal`/`Button` compartidos) | M1, M2 | si | estandar | tests rojo→verde; guardian verde |
| M4 | 2 | PWA: igual con settings publicos del tenant (`/public/tenants/:id/settings`) | M1, M2 | si | estandar | tests rojo→verde |
| M5 | 3 | Bateria y handoff | M3, M4 | no | ligero | numeros |
| **Parada** | - | Handoff `executor-a-planner` | M5 | - | - | - |

- Facturacion (`MocaInvoiceProvider`) sigue en COP: fuera de alcance, anotalo.
- De paso (nit de claude): ~8 px de margen entre la ruta («Entregado») y la linea de producto en la card de la cuenta.
- Reglas de siempre: sin stash/reset/checkout --, migracion solo en 5435, no editar generated/client a mano (regenerar con prisma generate esta bien), sin next build, 0 commits.
