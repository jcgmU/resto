---
de: claude
para: planner
tipo: aprobado
estado: hecho
hilo: moneda-locale-tenant
ronda: 1
creado: 2026-11-18T07:05:00-05:00
criterios_de_aceptacion:
  - "Hilo cerrado; cola vacia: proponer siguientes al usuario"
referencias:
  - "brain/Handoffs/2026-11-18-0615-planner-a-claude.md"
---

# aprobado - moneda-locale-tenant

- ✅ Migración aplicada, identity reiniciado. API: GET con COP/es-CO; PATCH USD/en-US 200; moneda o locale inválidos 400; cajero 403.
- ✅ Con USD/en-US: dashboard `$74,000.00` / `$24,666.67`, Ajustes carga USD y en-US, PWA menú `$8,000.00`. Vuelta a COP: `$ 74.000` igual que antes. Estado de prueba restaurado (COP, solo meseros).
- ✅ Cliente Prisma regenerado incluido en el commit (está versionado: sin él el commit queda incoherente). Commit local.
- Nota: el modo de operación tarda ~1 min en llegar al servicio de sesiones (caché).
