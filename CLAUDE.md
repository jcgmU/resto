# RESTAURANTE-OS

SaaS B2B2C para restaurantes/bares. Arquitectura de microservicios, TDD estricto, monorepo.

## Stack confirmado (definido por el usuario el 2026-10-03)

- **Monorepo:** Turborepo/Nx
- **Identity Service:** Node.js, Express, PostgreSQL (`identity_db`) — inquilinos (multi-tenant SaaS), empleados
- **Catalog Service:** Node.js, GraphQL (Apollo), PostgreSQL (`catalog_db`) — menús, categorías, productos, modificadores
- **Session Service:** Node.js, Express, Redis — códigos QR, sesiones activas de mesa
- **Ordering & Fulfillment:** Node.js, Socket.io, PostgreSQL (`ordering_db`), Redis Pub/Sub — carritos colaborativos, KDS, llamados a meseros
- **API Gateway:** punto único de entrada
- **Paquetes compartidos:** `@packages/shared-types`, `@packages/ui-components`
- **Frontends:** Next.js/React — `@apps/client-pwa` (mesa), `@apps/admin-dashboard` (panel restaurante)
- **Comunicación:** síncrona HTTP/GraphQL para consultas; asíncrona vía eventos (Redis Streams/Pub-Sub) para mutaciones cross-dominio

## UI/UX

Ver `01_Arquitectura/UI_UX_Guidelines.md` (Bento Box, skill "uxui promax" obligatoria en Kimi al planificar frontend). Vigente desde Oleada 1.

## Modo de operación

Desde 2026-10-03: Orquestador en **autonomía absoluta** (bucle Planificación Roja → Ejecución Roja → Planificación Verde → Ejecución Verde → Cierre/Doc → siguiente oleada, sin pausar a pedir autorización humana). Fix Loop ante fallo de circuit breaker: Kimi recibe el log de error y entrega plan de corrección (sin código) a Agy; si el Fix Loop falla 3 veces seguidas, se emite alerta de "Bloqueo Irresoluble" para el humano.

## Reglas de equipo

- **Orquestador (Claude):** único con permisos de lectura/escritura sobre `01_Arquitectura/`, `02_Dominio/`, `03_Oleadas/`. Actualiza estos archivos al cierre de cada oleada. Ninguna oleada avanza si la documentación no refleja el código.
- **Kimi (Planificador, Arquitecto Hexagonal):** entrega manifiesto por microservicio antes de que Agy escriba una línea: contratos de API/eventos, puertos y adaptadores, casos de prueba exactos (Jest/Supertest).
- **Agy (Ejecutor TDD):** ciclo Red-Green-Refactor estricto. Prohibido escribir lógica de negocio/infraestructura sin test en rojo primero. Prohibido acoplar dominios entre microservicios. Circuit breaker: máximo 3 intentos por test; al 3er fallo se detiene y reporta al Orquestador.
- **Feature flags:** toda funcionalidad fuera de la oleada en curso se envuelve en `<FeatureGuard>` (basado en `featureFlags.ts`), que renderiza un placeholder "Próximamente" si el flag está en `false`. Prohibido dejar UI rota o a medias.

## Roadmap de oleadas

0. Setup de infraestructura: Monorepo, Docker Compose, API Gateway, `<FeatureGuard>`
1. Core SaaS y Catálogo: Identity & Catalog Services + Admin Dashboard básico
2. Experiencia de entrada: Session Service + PWA cliente (QR → menú)
3. Motor transaccional: Ordering Service + carrito colaborativo (Redis → Postgres)
4. Tiempo real: Socket.io + vistas KDS y notificaciones a meseros
5. Cierre y pagos: liquidación de sesión y liberación de mesa

No se inicia una oleada nueva hasta que la anterior tenga 100% de tests en verde.

<!-- team:begin -->
## Equipo de agentes

Este proyecto lo trabaja un equipo de agentes coordinado por Herdr. Antes de hacer cualquier cosa:

1. Lee `brain/Equipo/Protocolo.md` (reglas del ciclo y tu rol).
2. Lee las fichas de `brain/Equipo/Fichas/` (qué puede hacer cada agente).
3. Lee `brain/Estado/STATE.md` y tus handoffs abiertos en `brain/Handoffs/`.

El trabajo es **multi-agente**: usa tus subagentes y elige el modelo según el nivel de la tarea (potente / estándar / ligero), como indica el Protocolo.

Memoria engram: usa siempre el proyecto `resto`.
<!-- team:end -->

## Estilo de reportes (ahorro de tokens, orden del usuario)

Reportes al usuario y handoffs: una linea por tarea con ✅; si hay problema, una frase corta (⚠️). Sin rutas de archivos, sin tablas largas ni narrativa. Detalles solo en el handoff si el destinatario los necesita para actuar. Instrucciones entre agentes: breves, sin repetir contexto ya escrito.
