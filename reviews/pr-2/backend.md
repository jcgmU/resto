---
de: codex-backend
para: codex
tipo: hallazgos
estado: hecho
hilo: pr2-review
ronda: 1
creado: 2026-10-23
referencias:
  - HEAD 65ffd61bbe7ca61da58791abfde75faaa37200b8
  - https://github.com/jcgmU/resto/pull/2
---

# Revisión backend completa

Alcance: gateway HTTP/Socket.IO, identity, catálogo GraphQL y adaptadores Prisma, sesiones/mesas/QR y adaptadores Redis, Dockerfiles, compose y contratos compartidos. Ordering revisado por agente independiente.

**Atribución:** `git diff origin/main...HEAD --name-only` contiene únicamente `apps/client-pwa/src/app/t/[tenantId]/[tableId]/menu/page.tsx`. Todos los hallazgos backend siguientes son **deuda preexistente**, no regresiones introducidas por PR #2. No atribuirlos al autor como problemas nuevos del diff.

## Hallazgos prioritarios

### B01 · P1 · Invitados QR pueden modificar/borrar catálogo completo

- Archivos: `services/gateway/src/routes/routeTable.ts:22`, `services/catalog/src/interfaces/graphql/resolvers.ts:81`, `services/catalog/src/interfaces/graphql/context.ts:10`.
- Flujo: abrir sesión QR emite JWT `role=guest`; gateway acepta cualquier JWT válido para `/v1/graphql`; contexto recoge rol pero ninguna mutation lo comprueba. Guest puede crear/borrar categorías, productos y modificadores o cambiar precios/disponibilidad del restaurante.
- Evidencia dinámica HTTP local: guest JWT -> gateway real -> catálogo real (repositories in-memory) -> `mutation { createCategory(input:{name:"Guest via gateway"}) { id name } }` devuelve HTTP 200 y categoría creada. Se reemplazó constructor Prisma sin uso en memoria para evitar inicialización del cliente Windows; auth/proxy/resolvers son fuente exacta del checkout.
- Corrección: autorización en cada mutation según rol; guest permitido únicamente en queries necesarias del menú. Proteger backend además de ocultar controles UI.

### B02 · P1 · Cambio de disponibilidad ignora tenant y modifica producto ajeno

- Archivo: `services/catalog/src/infrastructure/persistence/PrismaProductRepository.ts:150` (where línea 152), llamada desde `services/catalog/src/interfaces/graphql/resolvers.ts:131` y `services/catalog/src/application/ProductUseCases.ts` clase SetProductAvailability.
- Flujo: mutation autenticada incluye ID de producto B; use case no obtiene producto tenant A; adapter recibe tenantId pero ejecuta `prisma.product.update({where:{id}, ...})`. Escribe restaurante B y devuelve nombre/precio del producto B.
- Evidencia: llamada al adaptador real con Prisma capturado registra `callerTenant=tenant-A`, `where={id:"foreign-product"}`, `returnedTenant=tenant-B`. Sin DB real; omisión de scope comprobada por trazado y argumentos.
- Corrección: update/find por `{tenantId,id}` con resultado not found para tenant distinto. Mantener prueba con adaptador real; fake actual inventa producto cuando no existe y esconde fallo.

### B03 · P1 · Header de usuario manipulable permite leer perfil de otro restaurante

- Archivos: `services/gateway/src/proxy/httpProxy.ts:11`–16; `services/identity/src/app.ts:99`–115.
- Flujo: JWT guest legítimo no contiene userId/sub. Proxy solamente sobrescribe `x-user-id` si claim existe, conserva header suministrado por cliente. `/identity/me` requiere presencia de tenant pero busca usuario por ID global sin comprobar que `user.tenantId === tenantId`. Guest de A + `x-user-id: usuario-B` obtiene email, displayName, rol y tenant de B.
- Evidencia dinámica HTTP local: gateway real con JWT guest tenant-100 y header foreign-user devuelve HTTP 200, `email=foreign@example.invalid`, `tenantId=foreign-tenant`. Repositories in-memory, mismos handlers de producción.
- Corrección: borrar siempre headers de identidad entrantes antes de establecer claims verificados; impedir `/identity/me` para guest sin sujeto; comprobar tenant en repositorio/handler. Aplicar saneamiento también a `x-session-id` cuando staff JWT no trae sessionId.

### B04 · P1 · Compose expone servicios que confían ciegamente headers de gateway

- Archivos: `docker-compose.yml:43`, `:61`, `:79`, `:98`; `services/catalog/src/interfaces/graphql/context.ts:11`; `services/session/src/interfaces/http/middleware/requireStaffRole.ts:5`; `services/identity/src/app.ts:131`–156; ordering middleware revisado por agente correspondiente.
- Condición concreta: despliegue compose estándar en host alcanzable publica `4001:4001`–`4004:4004` en todas interfaces. No existe autenticación entre servicios. Solicitud directa a :4003 puede crear mesa con headers x-user-role=admin y x-tenant-id de víctima, sin JWT; catálogo acepta x-tenant-id sin bearer. Gateway deja de ser frontera de autorización.
- Corrección: publicar externamente gateway; servicios privados en red Docker, bind localhost en override de desarrollo. Alternativamente autenticar/verificar identidad de servicio y JWT en cada servicio.
- No se inspeccionó exposición de un servidor real ni se hizo request a producción. Riesgo deriva de configuración distribuida.

### B05 · P1 condicional · Configuración production acepta secreto JWT público por defecto

- Archivos: `docker-compose.yml:49`, `:67`, `:85`, `:108`, `:126`; `services/gateway/src/config/index.ts:7`; `services/identity/src/infrastructure/security/JwtTokenIssuer.ts:6`.
- Condición: compose define NODE_ENV=production pero sustituye JWT_SECRET ausente por literal versionado y documentado. Cualquier persona puede firmar ADMIN con tenantId arbitrario si se arranca siguiendo defaults. Aplica incluso cerrando puertos internos.
- Corrección: fallo de arranque sin secreto externo en production; defaults inseguros únicamente en configuración local explícita. No se accedió ningún deployment para comprobar sus secretos.

### B06 · P1 · Tokens refresh reales nunca funcionan

- Archivos: `services/identity/src/application/RefreshSession.ts:27`; `services/identity/src/infrastructure/security/JwtTokenIssuer.ts:12`–15.
- Flujo: registro/login guardan SHA256(raw); refresh busca string `hash_${raw}`, formato exclusivo de FakeTokenIssuer. Ningún refresh emitido por issuer real encuentra registro. Frontend se desconecta al vencer access token (15 min).
- Evidencia dinámica: createIdentityApp real, repositories in-memory, hasher bcrypt e issuer JWT reales: registro HTTP 201; POST /auth/refresh con token recién emitido HTTP 401 `INVALID_CREDENTIALS`.
- Corrección: hash SHA256 compartido entre emisión y consulta, inyectado por puerto explícito; cubrir registro/login -> refresh con issuer real. Tras corregir hash, rotación find/revoke también requiere consumo atómico para impedir reutilización concurrente.

### B07 · P1 · Dos clientes QR simultáneos crean sesiones distintas para misma mesa

- Archivos: `services/session/src/application/SessionUseCases.ts:33`–54; `services/session/src/infrastructure/redis/RedisTableSessionRepository.ts:30`–46.
- Flujo: ambos requests leen ausencia de sesión, generan IDs distintos y guardan sin exclusión. Redis MULTI hace atómico cada save, no la secuencia find/create; segundo sobrescribe puntero de mesa, pero ambos guests conservan JWT válido con sus sesiones. Carritos/cuentas se dividen entre comensales de misma mesa.
- Evidencia dinámica: Promise.all de dos execute sobre misma mesa y QR produce dos IDs diferentes y `activeSessionCount=2`. Fake no introduce serialización; Redis real tampoco usa SET NX, WATCH ni Lua.
- Corrección: operación repositorio get-or-create atómica por tenant/mesa y retornar sesión ganadora; usar UUID para IDs. No tratar esto como mero problema de UI.

### B08 · P2 · Renombrar categoría falla o actualiza otra categoría

- Archivos: `services/catalog/src/interfaces/graphql/resolvers.ts:89`–94; `services/catalog/src/infrastructure/persistence/PrismaCategoryRepository.ts:39`–56; `services/catalog/prisma/schema.prisma:13`, `:22`.
- Flujo: updateCategory conserva id antiguo pero cambia name; repository upsert busca `{tenantId,name:nuevo}`. Si nombre nuevo no existe, create intenta reutilizar PK ya presente -> P2002; si nuevo nombre pertenece a otra categoría, actualiza sortOrder/isActive de esa otra categoría y devuelve su ID. Campo name tampoco aparece en bloque update.
- Evidencia: trazado determinista Prisma/schema; no ejecutado contra PostgreSQL. Fake usa id, por eso suite con fake no refleja defecto.
- Corrección: actualizar por ID y tenant e incluir name en update; traducir conflicto unique del nombre a error de dominio.

### B09 · P1 · Asociar modificador ajeno filtra datos entre restaurantes

- Archivo: `services/catalog/src/infrastructure/persistence/PrismaProductRepository.ts:170`–178; lectura en mismo archivo líneas 25–56/80–102.
- Flujo: attachModifierGroup valida tenant del producto, nunca tenant del groupId. FK comprueba existencia global del grupo; relación resultante incluye nombre/opciones/precios del grupo B al consultar producto A. Violación persiste aunque se añada chequeo de rol del hallazgo B01.
- Corrección: comprobar grupo y producto bajo tenantId; idealmente claves/relaciones compuestas que impidan asociaciones entre tenants. Revisar también updateProduct(categoryId), que acepta categoría ajena sin comprobar propiedad (`application/ProductUseCases.ts`, UpdateProductUseCaseImpl).
- Evidencia: trazado repository + esquema; sin reproducción DB real.

### B10 · P2 · Usuarios/restaurantes suspendidos siguen autenticándose

- Archivo: `services/identity/src/application/Login.ts:35`–59; refresh también no evalúa estado (`RefreshSession.ts:36`–46).
- Flujo: Login verifica existencia + contraseña, ignora UserStatus y TenantStatus. SUSPENDED con contraseña válida recibe JWT nuevo; con tenantSlug omitido ni consulta tenant. Suspender cuenta no evita nuevos accesos.
- Evidencia dinámica use case: usuario seed status=SUSPENDED + contraseña válida -> issuedAccessToken=true. Repos fakes; algoritmo Login real.
- Corrección: exigir usuario y tenant ACTIVE antes de emitir/renovar tokens; decidir revocación de sesiones existentes.

### B11 · P2 · Logout publicado en gateway no existe en identity

- Archivos: `services/gateway/src/routes/routeTable.ts:16`; `services/identity/src/app.ts:70`–99 (se pasa directamente de refresh a identity routes).
- Flujo: POST /v1/auth/logout se proxya a /auth/logout inexistente. Logout cliente limpia storage, pero backend no revoca refresh ni deja cerrar sesión segura en servidor.
- Evidencia: POST /auth/logout en createIdentityApp real devuelve 404. No atribuir a regression PR. Impacto de refresh revocable se observa cuando B06 esté reparado.
- Corrección: endpoint logout revoca token/sesión en repository; handler idempotente.

### B12 · P2 · Health agregado devuelve servicios sanos aunque todos fallen

- Archivo: `services/gateway/src/app.ts:29`–42; healthcheck compose `docker-compose.yml:137`.
- Flujo: /health construye todos estados ok sin verificar ninguna dependencia. Con identity/catalog/session/ordering/DB/Redis caídos, gateway conserva HTTP 200 y compose sigue healthy; README lo presenta como agregación de salud.
- Corrección: separar liveness gateway y readiness con checks/timeout reales; estado degraded/unhealthy y HTTP apropiado para enrutamiento/monitorización.
- Evidencia: lectura directa, función no hace I/O ni consulta estado.

## Verificación y límites

- Checkout exacto PR HEAD. `git diff origin/main...HEAD` sólo modifica página PWA de menú.
- Sin source edits, staging, commit, push ni publicación GitHub.
- Requests de reproducción únicamente localhost y apps in-process con repositories fake; no endpoints externos/prod.
- Reproducciones de este reporte: refresh real fallido, guest mutation HTTP atravesando gateway, perfil ajeno HTTP atravesando gateway, dos sesiones concurrentes, logout 404, usuario suspendido login, captura de filtro Prisma availability.
- No se ejecutó suite completa aquí: orquestador coordina pruebas generales. No se añadieron archivos test.
- No se ejecutaron SQL/Redis reales para hallazgos de persistencia. Se explicita cuáles dependen de trazado estático y esquema.
- Intento catálogo con todos fakes falló por instancia Prisma incondicional en `services/catalog/src/app.ts:45`: generated client versionado sólo trae Windows, runtime actual darwin-arm64. Reproducción HTTP posterior reemplazó constructor Prisma sin uso **en memoria**, sin regenerar source. Dockerfiles generan cliente para runtime, por tanto no afirmar fallo universal del contenedor por este punto.
- Fakes difieren de adaptadores reales: disponibilidad crea registros faltantes, category.save busca ID mientras Prisma busca nombre, TTL in-memory no expira. Suite verde sobre fakes no certifica aislamiento de DB, persistencia o TTL.

## Harness visual solicitado por orquestador

Proceso `/tmp/resto-review-harness.cjs`, exec session 99719, servicios reales en localhost :4001–4004. Gateway del orquestador :4000. Prisma imports sin uso aislados; todos repositories in-memory; adapters ordering->catalog/session HTTP reales; emisor Socket.IO ordering conectado a eventos fake. No fuentes modificadas.

- Login `review@example.invalid` / `ReviewPass123`.
- Tenant `review-tenant`, slug `casa-lima`, nombre Casa Lima.
- QR `http://localhost:3001/t/review-tenant/review-table?k=review-key`.
- 8 mesas; 4 categorías; 8 productos con precios COP y extras.
- Datos desaparecen al terminar proceso. Este entorno sirve inspección UI y contratos HTTP; no certifica comportamiento Prisma/Redis.

### Corrección de límite del harness (seguimiento visual)

Root observó KDS sin recibir nuevo pedido mientras mostraba En vivo. Inspección identificó fallo **del harness**, no evidencia contra código productivo: wrapper local original reenviaba primer argumento `tenantId` como si fuera evento, pero firma real es `publishOrderEvent(tenantId,event)`. También nombre checkout local era incorrecto (`publishCheckoutCompletedEvent`, contrato real `publishCheckoutCompleted`). Fuente productiva RedisEventPublisher/RedisEventSubscriber conserva evento correctamente.

Script `/tmp/resto-review-harness.cjs` corregido en disco; prueba aislada wrapper corregido + wireRealtimeEvents emite `order:created` a tenant y sesión. **Proceso activo no reiniciado por pedido del orquestador** para preservar datos visuales, por tanto screenshot KDS requiere recargar y corrida visual no verifica entrega realtime. No reportar ausencia de evento observada como bug productivo. Fallo de recuperación tras reconexión puede revisarse de forma independiente desde frontend.
