---
de: planner
para: claude
tipo: listo-para-verificar
estado: en-curso
hilo: mesas-lote
ronda: 1
creado: 2026-10-27T11:30:00
criterios_de_aceptacion:
  - "Crear/editar/eliminar mesas en lote y editar una, atómico por tenant, con baja lógica y QR invalidado"
  - "Gateway y servicio: solo admin/manager mutan; STAFF 403; aislamiento por tenant"
  - "UI /mesas con selección múltiple, barra de lote, modales y resultado de borrado por mesa"
  - "tests, build y test-hardening en verde"
referencias:
  - "brain/Handoffs/2026-10-27-1015-planner-a-agy.md"
  - "brain/Handoffs/2026-10-27-1055-agy-a-planner.md"
  - "brain/Equipo/Verificacion.md"
  - "brain/Backlog/hardening-p1.md"
---

# listo-para-verificar - mesas-lote - ronda 1

Ronda única, sin correcciones. Revisé yo mismo (no solo el reporte de agy):

- `pnpm -r --no-bail run test`: todo en verde (ui 82, pwa 74, gateway 39, admin 177, catalog 95, session 52, identity 45, ordering 106). Una primera corrida en paralelo con otras cargas falló por timeout de 5 s en `client-pwa/serviceCalls.flow` (archivo no tocado); aislado pasa 2/2 y la corrida limpia pasa 14/14.
- `pnpm test:hardening`: exit 0; session `test:real` 3 suites/13 tests (carrera delete vs open, 20 creates concurrentes, swap, tope 500, legacy) y `[E2E 7/7]` por Gateway. 0 contenedores/volúmenes `resto-test-*`, 0 procesos jest.
- Build de 9 proyectos en copia aislada (`/private/tmp/resto-mesas-review-WkahoC`): exit 0, `/mesas` 13.2 kB. `git diff --check` limpio. `next dev` 3100/3101 intactos.
- Diff leído: Lua atómico en create/update/softDelete, `LUA_SAVE_ACTIVE` rechaza mesa no activa, rutas `/batch` antes de `/:tableId` en gateway y session, ids/claves con `crypto`, STAFF sin acciones en UI.

Contrato: `POST /v1/tables/batch`, `PATCH /v1/tables/batch`, `POST /v1/tables/batch/delete` (200 con `failed[]`, 409 `TABLES_NOT_DELETABLE` si ninguna se borra); baja lógica `status: deleted`.

Pendiente para ti: chequeos manuales MLM1–MLM4 en `brain/Equipo/Verificacion.md` (UI en navegador real). P2/P3 registrados en `brain/Backlog/hardening-p1.md` (sección mesas-lote). Sin commit/push ni GUARD_OK; el árbol sigue con ~110 archivos sin commitear.
