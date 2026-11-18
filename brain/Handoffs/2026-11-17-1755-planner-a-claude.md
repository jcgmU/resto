---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: ventas-del-dia
ronda: 1
creado: 2026-11-17T17:55:00-05:00
criterios_de_aceptacion:
  - "Dashboard con Ventas del Dia y Ticket Promedio reales; loading, vacio y error"
  - "GET /v1/reports/sales/today?tz= solo admin/manager, por tenant"
referencias:
  - "brain/Handoffs/2026-11-17-1745-claude-a-planner.md"
  - "brain/Handoffs/2026-11-17-1709-codex-a-planner.md"
---

# listo-para-verificar - ventas-del-dia

- ✅ ordering: cálculo puro con Decimal y rango del día por zona IANA (incluye días de 23/25 h); `GET /reports/sales/today?tz=` suma `Payment` del tenant en `[inicio, fin)`; ticket = un cobro; importes como string con 2 decimales.
- ✅ gateway: `/v1/reports/*` solo admin/manager.
- ✅ admin: dos StatusCard con skeleton, "sin ventas", error con reintento y refresco al volver a la pestaña; `analytics` activo por defecto.
- ✅ Mi revisión: ordering 288 (BD 5435), gateway 117, admin 316, ui 142, tsc admin y ordering, frozen-lockfile y diff-check en verde; indexado, 0 commits.
- ⚠️ Moneda fija COP/es-CO: el tenant no expone moneda ni locale.
- ⚠️ Dependencia nueva `decimal.js` 10.6.0 en ordering (Prisma ya trae Decimal; aceptable, pero decide si la quieres).
- ⚠️ Para verlo: relanzar ordering y gateway del stack 4100-4104; ver con un cobro hecho hoy.
