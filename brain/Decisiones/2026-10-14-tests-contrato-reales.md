# ADR: Tests de contrato contra Postgres/Redis reales

- **Fecha:** 2026-10-14
- **Estado:** Aceptado
- **Hilo:** correcciones-qa-y-notas (criterio de aceptación FASE A)
- **Contexto:** Los tests de "integración" de los servicios usan fakes in-memory aunque sus nombres dicen "Postgres/Redis real" — ocultaron bugs reales (R04 carrera de sesiones, R05 pérdida de añadidos, R07 mismatch de hash). QA exige tests de contrato con adaptadores reales.
- **Decisión:**
  1. Cada servicio con persistencia (identity, catalog, ordering, session) gana tests de contrato en `test/contract/` que corren contra el Postgres/Redis del Docker Compose, incluidos en la suite por defecto (`pnpm -r run test`). La suite requiere el stack Docker arriba (se documenta en README/GUIA-PRUEBAS; el error de conexión es explícito si falta).
  2. Bases aisladas: `resto_identity_test`, `resto_catalog_test`, `resto_ordering_test` (init SQL nuevo); Redis: db2 para session-test y db3 para ordering-test (flush por corrida). Migraciones con `prisma migrate deploy` en globalSetup.
  3. Los fakes in-memory quedan solo para tests unitarios puros de dominio. Los tests de integración con nombres que prometen infra real se renombran o migran a contrato.
- **Consecuencias:** A1 (suite completa) pasa a ejercitar adaptadores reales: permisos, concurrencia (8 aperturas QR = 1 sesión; 8 añadidos = cantidad 9), sesión cerrada y refresh quedan probados de verdad. La suite tarda algo más y exige Docker, lo cual ya es el flujo estándar del proyecto.
