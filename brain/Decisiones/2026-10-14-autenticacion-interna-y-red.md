# ADR: Autenticación interna entre servicios y exposición de red

- **Fecha:** 2026-10-14
- **Estado:** Aceptado
- **Hilo:** correcciones-qa-y-notas (R08)
- **Contexto:** El gateway es el único verificador JWT; catalog/session/ordering/identity confían ciegamente en headers `x-user-id`/`x-tenant-id`/`x-user-role`, y docker-compose publica TODOS los puertos (servicios internos 4001-4004, postgres 5432, redis 6379) en 0.0.0.0. Cualquiera en la LAN puede impersonar roles llamando directo a un servicio interno (confirmado por QA: creó categoría sin JWT).
- **Decisión:**
  1. En `docker-compose.yml` solo el gateway (4000) queda publicado al host/LAN. Servicios internos, postgres y redis se ligan a loopback (`127.0.0.1:4001:4001`, `127.0.0.1:5432:5432`, `127.0.0.1:6379:6379`) para desarrollo y tests de contrato desde el host.
  2. Se introduce `INTERNAL_SHARED_SECRET` (env, sin default en código): el gateway lo inyecta como header `x-internal-token` en cada proxy; los 4 servicios internos lo exigen con un middleware (401 sin él; `/health` exento). Los adapters internos de ordering (a catalog y session) también lo envían.
  3. Redis queda protegido por loopback (sin `requirepass` en MVP); postgres igual.
- **Consecuencias:** El bypass directo deja de funcionar aun conociendo los puertos (falta el secreto). El secreto vive en env/compose, no en el repo. Para producción queda documentado que hace falta red privada real + rotación del secreto o mTLS/JWT de servicio. `pnpm demo`, seed y e2e no se afectan: solo hablan con el gateway.
