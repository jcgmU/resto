---
de: planner
para: codex
tipo: plan
estado: hecho
hilo: ventas-del-dia
ronda: 1
creado: 2026-11-17T17:50:00-05:00
criterios_de_aceptacion:
  - "GET /v1/reports/sales/today devuelve total, tickets y ticket promedio del dia del tenant (zona horaria del navegador) desde Payment; test en rojo primero"
  - "Solo ADMIN/MANAGER (o los roles de gestion de authzRoles); otro tenant no se ve; dia vacio = 0 sin dividir por cero"
  - "Dashboard muestra Ventas del Dia y Ticket Promedio reales con StatusCard; estados loading, vacio y error; flag analytics activo"
  - "Bateria: ordering (BD 5435), gateway, admin, tsc, A4, diff-check; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-1745-claude-a-planner.md"
---

# plan - ventas-del-dia

Rama: sigue en `feat/roles-y-monitor` encima de `46a1dad`.

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| V1 | 1 | ordering, dominio puro: `salesSummary(payments)` → `{ total, tickets, averageTicket }` con Decimal (2 decimales, sin flotantes); funcion de rango del dia `[inicio, fin)` para una zona IANA (valida la zona; invalida → 400) | - | si | estandar | unit tests rojo→verde: vacio, 1 pago, varios, redondeo, cambio de dia en zona distinta a UTC |
| V2 | 2 | ordering: caso de uso + puerto de lectura `sumPaymentsBetween(tenantId, from, to)` (usa indice `tenantId, createdAt`); ruta `GET /reports/sales/today?tz=` con authz de gestion | V1 | si | estandar | contrato Supertest: 200 con datos del seed, 0 en dia vacio, 403 mesero, 401 sin token, aislamiento de tenant |
| V3 | 2 | gateway: exponer `/v1/reports/*` hacia ordering en la tabla de rutas (roles de gestion) | - | si | ligero | test de gateway rojo→verde |
| V4 | 3 | admin: dos `StatusCard` en el dashboard (reemplazan los `Proximamente`), moneda con `Intl.NumberFormat` del tenant, `tz` de `Intl.DateTimeFormat().resolvedOptions().timeZone`; skeleton al cargar, "Sin ventas hoy" en vacio, error con reintento; refresco al volver a la pestaña. Activar `analytics` en el default de featureFlags | V2, V3 | si | estandar | tests rojo→verde de los tres estados y del formato |
| V5 | 4 | Bateria y nota corta del endpoint en la doc del servicio ordering | V4 | no | ligero | numeros de salida |
| **Parada** | - | Handoff `codex-a-planner`; reviso y paso a claude | V5 | - | - | - |

- Ticket = un `Payment` (una sesion cobrada). Sin acoplar dominios: nada de llamar a identity/catalog para calcular.
- Si cambias el schema: no hace falta (el indice ya existe). Sin migraciones, sin stash/reset/checkout --, no tocar generated/client.
- Si git add o el brain fallan por sandbox, lo hago yo.
