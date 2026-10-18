# RESTAURANTE-OS

SaaS B2B2C de microservicios para restaurantes y bares. El cliente escanea un **QR en la mesa**, ve el menú, arma su pedido (carrito colaborativo) y puede pedir la cuenta; el restaurante gestiona **carta, mesas, cocina (KDS) y cobro** desde un panel de administración en tiempo real.

Construido con **TDD estricto** (Red-Green-Refactor), en **oleadas** incrementales y con una línea gráfica propia ("Lima & Tinta", estilo Bento Box).

- **Estado:** MVP completo (oleadas 0 a 5 + rediseño del frontend). **371 tests en verde**, build completo y flujo E2E real verificado.
- **Repositorio:** monorepo pnpm + Turborepo.

---

## Índice

1. [Qué hace y para quién](#1-qué-hace-y-para-quién)
2. [Puesta en marcha rápida (5 minutos)](#2-puesta-en-marcha-rápida-5-minutos)
3. [Guía de uso paso a paso](#3-guía-de-uso-paso-a-paso)
4. [Flujo de información](#4-flujo-de-información)
5. [Despliegue](#5-despliegue)
6. [Configuración (variables de entorno)](#6-configuración-variables-de-entorno)
7. [Arquitectura](#7-arquitectura)
8. [Contratos de API](#8-contratos-de-api)
9. [Desarrollo, tests y verificación](#9-desarrollo-tests-y-verificación)
10. [Solución de problemas](#10-solución-de-problemas)
11. [Alcance actual y limitaciones](#11-alcance-actual-y-limitaciones)
12. [Estructura del repositorio y documentación](#12-estructura-del-repositorio-y-documentación)

---

## 1. Qué hace y para quién

| Actor | Dónde | Qué hace |
|---|---|---|
| **Dueño / administrador del restaurante** | Panel admin (`:3000`) | Registra su restaurante, crea categorías y platos, crea mesas y QR, ve la cocina en vivo, cobra y libera mesas |
| **Cocina / meseros** | Panel admin, sección **KDS** (`:3000/kds`) | Ven los pedidos que llegan en vivo, los avanzan de estado y atienden las llamadas de mesa ("Pedir la cuenta") |
| **Cliente en la mesa** | PWA (`:3001`), por QR | Ve la carta, elige productos y cantidades, envía el pedido, sigue su estado y pide la cuenta. **No necesita crear cuenta** |

---

## 2. Puesta en marcha rápida (5 minutos)

### Requisitos

- **Node.js 20 o superior** y **pnpm 9** (`npm install -g pnpm@9`)
- **Docker Desktop** (o Docker Engine + plugin Compose) en ejecución
- Puertos libres: `3000`, `3001`, `4000` a `4004`, `5432`, `6379`

### Vía rápida recomendada: Un solo comando (`pnpm demo`)

La forma más rápida para probar el sistema completo con datos precargados y acceso desde el móvil en la misma red WiFi:

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/jcgmU/resto.git
cd resto
pnpm install

# 2. Iniciar todo el entorno demo en un solo comando
pnpm demo
```

Este comando automatiza todo el proceso:
1. Comprueba que Docker Desktop y Docker Compose estén en ejecución.
2. Detecta la dirección IP de tu red local (`LAN_IP`).
3. Levanta los contenedores del backend en Docker (`services`) con CORS y URLs configurados para tu IP local.
4. Espera a que el Gateway (`:4000`) esté disponible y compila los paquetes compartidos (`@packages/*`).
5. Configura `.env.local` en ambos frontends con `NEXT_PUBLIC_GATEWAY_URL` y las *feature flags* activas.
6. Ejecuta el seed idempotente (`node scripts/seed-demo.mjs`) con categorías, platos (precios COP enteros, descripción y tiempo de preparación), modificadores, 4 zonas (Terraza, Salón Principal, Barra, VIP), mesas con zona y capacidad, una reserva demo para hoy y el usuario administrador demo (`admin` / `admin`). Puede correrse varias veces sin duplicar datos.
7. Inicia los servidores de desarrollo de `@apps/admin-dashboard` (`:3000`) y `@apps/client-pwa` (`:3001`).

Al finalizar el arranque verás un banner con las URLs de acceso:
- **Panel Admin:** `http://localhost:3000` (o `http://<LAN_IP>:3000`) — Usuario: `admin` | Contraseña: `admin`
- **PWA Clientes:** `http://localhost:3001` (o `http://<LAN_IP>:3001`)

> Para ver el guion de prueba paso a paso con el móvil, consulta la **[Guía de Pruebas](docs/GUIA-PRUEBAS.md)**.  
> Para detener la demo: presiona `Ctrl+C` en la terminal y ejecuta `docker compose --profile services down`.  
> Para reiniciar los datos a cero: `docker compose --profile services down -v` y vuelve a correr `pnpm demo`.

---

### Vía manual paso a paso

Si prefieres levantar cada componente por separado o configurar un restaurante desde cero:

```bash
# 1. Clonar e instalar dependencias de todo el monorepo
git clone https://github.com/jcgmU/resto.git
cd resto
pnpm install

# 2. Levantar el backend completo (Postgres, Redis, Gateway e Identity/Catalog/Session/Ordering)
#    Las migraciones de base de datos se aplican solas al arrancar cada servicio.
docker compose --profile services up -d --build

# 3. Comprobar que todo está sano (debe decir "ok" en los 7 componentes)
curl http://localhost:4000/health

# 4. Construir los paquetes compartidos (los frontends los necesitan)
pnpm build

# 5. Configurar los frontends (flags de funcionalidad; ver sección 6)
cp apps/admin-dashboard/.env.example apps/admin-dashboard/.env.local
cp apps/client-pwa/.env.example      apps/client-pwa/.env.local

# 6. Levantar los dos frontends (cada uno en su terminal)
pnpm --filter @apps/admin-dashboard dev     # http://localhost:3000
pnpm --filter @apps/client-pwa dev          # http://localhost:3001
```

Abre **http://localhost:3000/register** para crear tu restaurante y continúa con la [guía de uso](#3-guía-de-uso-paso-a-paso).

> Si el backend no responde en `/health`, revisa [Solución de problemas](#10-solución-de-problemas). Para detener todo: `docker compose --profile services down` (agrega `-v` para borrar también los datos).

---

## 3. Guía de uso paso a paso

El flujo completo de un servicio, de punta a punta:

### A. Preparación (una sola vez, lo hace el administrador)

1. **Registrar el restaurante.** Entra a `http://localhost:3000/register`: nombre del restaurante, correo y contraseña del administrador (el *slug* es opcional). Se crea el restaurante (tenant) y el usuario ADMIN, y entras al panel.
   - Para volver a entrar después: `http://localhost:3000/login` con correo y contraseña. La sesión dura 15 minutos y se renueva sola; si caduca, el panel te lleva a `/login`.
2. **Crear la carta** en **Menu** (`/menu`):
   - **Nueva Categoría** (ej. "Platos fuertes", "Bebidas").
   - **Nuevo Producto**: nombre, precio, categoría y si está disponible para ordenar.
3. **Crear las mesas** en **Mesas** (`/mesas`):
   - **Nueva Mesa** (ej. "Mesa 1", "Barra 2", "Terraza 8").
   - **Ver QR** abre un modal con el **código QR** y el **enlace de la mesa**: `http://<pwa>/t/<restaurante>/<mesa>?k=<código>`. Imprime o muestra el QR en la mesa.
   - **Rotar QR** invalida el código anterior y genera uno nuevo (úsalo si el QR se filtró).
   - La vista tiene modo **Lista** y **Mapa**; una mesa pasa a *Ocupada* cuando tiene una sesión activa.

### B. Durante el servicio

4. **El cliente escanea el QR** (o abre el enlace). Se abre la PWA directamente en la carta de esa mesa y se crea una **sesión de invitado** automática, sin registro.
5. **El cliente pide:** filtra por categoría, abre un producto (cantidad y modificadores, si los hay), **Añadir al carrito**, abre el carrito (botón flotante), ajusta cantidades con `−`/`+` y pulsa **Enviar pedido**. Verá la confirmación con el número de orden y una barra de progreso: *Recibido → En cocina → Listo → Entregado* (se actualiza sola cada pocos segundos).
6. **La cocina ve el pedido en vivo** en `http://localhost:3000/kds` (columnas *Por preparar*, *En cocina*, *Listas*). Con el botón de cada tarjeta se avanza el estado: *En cocina → Listo → Entregado*. No hace falta recargar: el KDS recibe los pedidos por WebSocket.
7. **El cliente pide la cuenta** con **Pedir la cuenta**. Aparece una **llamada de servicio** en el panel derecho del KDS; el mesero la marca como **Resolver** cuando atiende la mesa.

### C. Cierre

8. **Cobrar** en **Checkout** (`/checkout`): selecciona la mesa activa (cada tarjeta muestra la mesa, la hora de apertura y un id corto de sesión), revisa la cuenta, elige el **método de pago** (Efectivo, Tarjeta u Otro) y pulsa **Registrar cobro**. Un modal pide confirmación ("Confirmar cobro"). Al confirmar: se registra el pago, la sesión se cierra y **la mesa queda liberada** para el siguiente cliente.

### Otras pantallas del panel

| Ruta | Para qué sirve |
|---|---|
| `/dashboard` | **Resumen Operativo**: indicadores (mesas activas, pedidos activos, SLA estimado), plano de mesas con filtro por **zona** y por estado, **reservas del día** (crear, cancelar y **Cliente llegó**, que abre la sesión de la mesa), brief de alertas de servicio y el interruptor de **modo de operación**. Ventas y ticket promedio aparecen como "Próximamente" |
| `/meseros` | **Terminal de Meseros**: atención guiada en mesa (selección de mesa, comanda con nota por ítem y despacho a cocina). Funciona en ambos modos de operación; es la vía principal en `waiter_only` |
| `/mesas` | Gestión de mesas con **zona** y **capacidad** asignables; las mesas con reserva activa de hoy se muestran como *Reservada* |
| `/kds` | Monitor de cocina con **SLA** por pedido (tiempo estimado del restaurante vs. tiempo transcurrido, con marca de atraso), posibilidad de **añadir demora** al pedido y panel de llamadas de servicio |
| `/pagos` | Historial de pagos (próximamente) |
| `/ajustes` | Configuración del restaurante (próximamente) |

**Modo de operación.** Se alterna desde `/dashboard` (o con `PATCH /v1/tenant/settings` `{ "operatingMode": "hybrid" | "waiter_only" }`, solo admin/manager):

- `hybrid` (por defecto): los comensales piden escaneando el QR y el personal también puede tomar pedidos.
- `waiter_only`: el QR deja de abrir sesiones (`POST /v1/sessions/open` responde `403 QR_DISABLED`); el mesero abre la sesión con `POST /v1/sessions/staff-open` y pide en nombre de la mesa enviando `x-session-id`. El servicio de sesiones cachea el modo hasta 30 s, por lo que el cambio puede tardar ese tiempo en aplicarse al QR.

Una vez que el comensal pide la cuenta (`POST /v1/sessions/:id/bill-request`), la sesión deja de aceptar pedidos nuevos (`409 SESSION_NOT_ORDERABLE`) hasta que el cobro la cierre o el staff la reabra.

### Llamadas de servicio (asistencia y cuenta)

El sistema centraliza las solicitudes de atención y cuenta entre los comensales y el personal mediante llamadas de servicio en tiempo real:

- **Tipos de llamadas:**
  - `WAITER_CALL`: Solicitud de asistencia presencial en mesa ("Llamar al mesero").
  - `BILL_REQUEST`: Solicitud de cuenta para liquidación y cobro.
  - `GENERIC`: Solicitudes operativas o de asistencia genérica.
- **Quién las produce:** El comensal las produce desde la PWA móvil al pulsar **Llamar al mesero** (`POST /v1/service-calls` con tipo `WAITER_CALL`). Por su parte, la acción de **Pedir la cuenta** genera automáticamente una llamada de tipo `BILL_REQUEST` desde el backend de Session Service (`POST /v1/sessions/:id/bill-request`), pasando la sesión a estado `billRequested` y bloqueando nuevos pedidos (`409 SESSION_NOT_ORDERABLE`), pero permitiendo continuar emitiendo llamadas de servicio como excepción explícita a la barrera de liquidación.
- **Visualización y resolución en KDS:** Todas las llamadas aparecen de inmediato en el panel lateral de **Llamadas de servicio** en el Monitor de Cocina (`/kds`), recibidas en tiempo real vía WebSocket. El personal de cocina o meseros atiende la solicitud y pulsa el botón **Resolver** (`PATCH /v1/service-calls/:id/resolve`) para retirarla del panel.
- **Auto-resolución en cobro:** Al confirmar el cobro en **Checkout** (`POST /v1/checkout/confirm`), el backend de Ordering resuelve automáticamente todas las llamadas de servicio pendientes asociadas a la sesión que se liquida, garantizando que el KDS quede libre de llamadas huérfanas al liberar la mesa.

Lo que está marcado "Próximamente" está protegido por *feature flags* y no es una pantalla rota: ver [sección 6](#6-configuración-variables-de-entorno).

---

## 4. Flujo de información

```
 Cliente (móvil)                  Administración / Cocina
 ┌─────────────┐                   ┌────────────────────┐
 │  PWA :3001  │                   │ Admin Panel :3000  │
 │  (QR → carta│                   │ carta·mesas·KDS·   │
 │  → pedido)  │                   │ checkout           │
 └──────┬──────┘                   └─────────┬──────────┘
        │  HTTP/JSON + token                 │  HTTP/JSON, GraphQL + WebSocket (token)
        └───────────────┬────────────────────┘
                        ▼
            ┌───────────────────────┐
            │  API Gateway  :4000   │  único punto de entrada
            │  · valida el JWT      │  · extrae tenantId/rol del token
            │  · CORS, enrutado     │  · lo propaga como x-tenant-id
            └──┬─────┬─────┬─────┬──┘  · proxy HTTP y WebSocket
               │     │     │     │
      ┌────────┘     │     │     └────────────┐
      ▼              ▼     ▼                  ▼
 ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐
 │ Identity │ │ Catalog  │ │ Session  │ │ Ordering & Fulfillment│
 │  :4001   │ │  :4002   │ │  :4003   │ │        :4004          │
 │ Postgres │ │ Postgres │ │  Redis   │ │ Postgres + Redis +    │
 │ identity │ │ catalog  │ │ sesiones │ │ Socket.io             │
 └──────────┘ └──────────┘ └──────────┘ └──────────┬───────────┘
   usuarios,    carta:       QR de mesa,            │ consulta carta y valida
   restaurantes categorías,  sesiones activas       │ sesión de forma síncrona
   y tokens     productos    de invitado            ▼
                                            Redis Pub/Sub → eventos en tiempo real → KDS
```

**Recorrido de los datos en un pedido típico**

1. **Alta del restaurante:** el panel llama a `POST /v1/auth/register` → Identity crea el tenant y el administrador, y devuelve `accessToken` + `refreshToken`.
2. **Carta y mesas:** el panel envía mutaciones GraphQL (`/v1/graphql`) a Catalog y peticiones de mesas/QR (`/v1/tables`, `/v1/sessions`) a Session. Todo queda ligado al `tenantId` del token.
3. **Entrada del cliente:** la PWA recibe `tenant`, `mesa` y `k` (código QR) en la URL y llama al endpoint público `POST /v1/sessions/open`; Session (Redis) valida el código, abre una **sesión de invitado** y devuelve un token que la PWA guarda en el navegador.
4. **Carta del cliente:** la PWA pide la carta a Catalog (GraphQL) con ese token.
5. **Pedido:** `POST /v1/cart/items` añade al carrito (Redis, ligado a la sesión; admite `PATCH`/`DELETE` por línea) y `POST /v1/cart/confirm` crea la **orden** en Ordering (Postgres). Ordering valida productos contra Catalog y la sesión contra Session.
6. **Tiempo real:** al cambiar una orden o crearse una llamada de servicio, Ordering publica un evento en **Redis Pub/Sub**; el emisor de **Socket.io** lo reenvía solo a las *rooms* del restaurante (`tenant:{id}`) y de la mesa (`session:{id}`). El KDS escucha esas rooms: un cliente de otra mesa **nunca** recibe eventos ajenos.
7. **Seguimiento del cliente:** la PWA consulta `GET /v1/orders/:id` cada pocos segundos (un invitado solo puede leer órdenes de su propia sesión).
8. **Cobro:** `GET /v1/checkout/:sessionId` resume la cuenta; `POST /v1/checkout/confirm` registra el pago (idempotente: no se puede cobrar dos veces la misma sesión) y Ordering ordena a Session cerrar la sesión y liberar la mesa.

**Reglas de seguridad y aislamiento**

- **Multi-tenant:** el `tenantId` sale **siempre del JWT**, nunca del cuerpo de la petición; cualquier `tenantId` enviado por el cliente se ignora.
- **Roles:** `admin`, `manager` y `staff` (panel) e invitado de mesa (PWA) tienen permisos distintos en el gateway; el invitado solo ve su propia sesión.
- **Comunicación entre servicios:** síncrona (HTTP/GraphQL) para consultas; asíncrona (Redis Pub/Sub/Streams) para efectos entre dominios.
- Cada servicio tiene **su propia base de datos** y sin claves foráneas entre servicios.

---

## 5. Despliegue

El backend está contenedorizado (un `Dockerfile` por servicio). Los frontends son apps Next.js que se ejecutan con Node (no tienen Dockerfile).

### Opción A: un solo servidor (VM / VPS) con Docker

1. **Preparar el servidor:** Docker + Compose, Node.js 20+ y pnpm 9. Abrir al exterior solo los puertos de los frontends (o de tu reverse proxy) y del **gateway (4000)**. Los puertos 4001-4004, 5432 y 6379 **no deben estar expuestos a internet** (quita las entradas `ports:` de esos servicios o ciérralos con firewall).
2. **Definir secretos y URLs** en un archivo `.env` en la raíz (Compose lo lee solo; ver [sección 6](#6-configuración-variables-de-entorno)). Como mínimo:

   ```env
   JWT_SECRET=<cadena larga y aleatoria, p. ej. openssl rand -hex 48>
   POSTGRES_PASSWORD=<contraseña fuerte>
   CORS_ORIGINS=https://admin.tudominio.com,https://carta.tudominio.com
   PWA_BASE_URL=https://carta.tudominio.com
   ```
3. **Levantar el backend:**

   ```bash
   docker compose --profile services up -d --build
   curl https://api.tudominio.com/health        # a través de tu proxy, o http://localhost:4000/health
   ```
4. **Construir y arrancar los frontends** con la URL pública del gateway. `NEXT_PUBLIC_*` se **incrusta en el build**, así que defínela antes de construir:

   ```bash
   pnpm install --frozen-lockfile
   pnpm build                                        # paquetes compartidos
   export NEXT_PUBLIC_GATEWAY_URL=https://api.tudominio.com
   export NEXT_PUBLIC_FEATURE_FLAGS=kitchen-display:true,payments:true
   pnpm --filter @apps/admin-dashboard build && pnpm --filter @apps/admin-dashboard start   # :3000
   pnpm --filter @apps/client-pwa build && pnpm --filter @apps/client-pwa start             # :3001
   ```
   Mantenlos vivos con un gestor de procesos (pm2, systemd) o conviértelos en contenedores propios.
5. **HTTPS y dominio:** coloca un reverse proxy (Caddy, Nginx, Traefik) con certificado TLS delante de los tres puntos de entrada (admin, PWA, gateway). **El gateway debe servir también WebSocket** (`/socket.io`) para el KDS. La PWA necesita HTTPS para poder instalarse como app en el móvil.
6. **Orden y datos:** Postgres y Redis guardan su estado en los volúmenes `postgres_data` y `redis_data`; respáldalos periódicamente (`pg_dump` de `resto_identity`, `resto_catalog`, `resto_ordering`).

### Opción B: frontends en una plataforma gestionada (p. ej. Vercel)

- Despliega `apps/admin-dashboard` y `apps/client-pwa` como dos proyectos (el *root directory* de cada uno es su carpeta; el monorepo usa pnpm).
- Variables de entorno de cada proyecto: `NEXT_PUBLIC_GATEWAY_URL` (URL pública del gateway) y `NEXT_PUBLIC_FEATURE_FLAGS`.
- El backend sigue desplegándose con Docker Compose (Opción A, pasos 1-3), con `CORS_ORIGINS` y `PWA_BASE_URL` apuntando a los dominios de esos proyectos.

### Lista de comprobación antes de salir a producción

- [ ] `JWT_SECRET` y `POSTGRES_PASSWORD` cambiados (los valores por defecto del repositorio son solo para desarrollo).
- [ ] `CORS_ORIGINS` contiene exactamente los orígenes públicos del admin y la PWA.
- [ ] `PWA_BASE_URL` es la URL pública de la PWA: es la base de los enlaces/QR de las mesas.
- [ ] `NEXT_PUBLIC_GATEWAY_URL` apunta al gateway público **antes** de ejecutar `build` de los frontends.
- [ ] Puertos internos (4001-4004, 5432, 6379) no accesibles desde internet.
- [ ] HTTPS activo y WebSocket permitido en el proxy.
- [ ] Respaldo de los volúmenes de Postgres configurado.
- [ ] `curl <gateway>/health` responde `ok` en los 7 componentes.
- [ ] Prueba humana de punta a punta (sección 3) hecha en el entorno desplegado.

---

## 6. Configuración (variables de entorno)

### Backend (Docker Compose / raíz `.env`)

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `JWT_SECRET` | `super-secret-jwt-key-oleada-0` | Firma de los tokens. **Cámbiala en producción** |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | `postgres` / `postgres` | Credenciales de Postgres. **Cambia la contraseña en producción** |
| `POSTGRES_PORT` / `REDIS_PORT` | `5432` / `6379` | Puertos publicados en el host |
| `GATEWAY_PORT` | `4000` | Puerto público del gateway |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Orígenes de los frontends permitidos por el gateway (el script demo añade automáticamente la IP local) |
| `PWA_BASE_URL` | `http://localhost:3001` | URL pública de la PWA; el Session Service la usa para construir el enlace/QR de cada mesa |
| `LAN_IP` | (autodetectada) | IP de red local del host para pruebas en WiFi desde móviles (usada por `pnpm demo`) |
| `MIN_ADMIN_PASSWORD_LENGTH` | `8` | Longitud mínima exigida para la contraseña de admin en Identity service (`4` para entorno demo local) |
| `DEMO_ADMIN_PASSWORD` | `admin` | Contraseña asignada a la cuenta `admin` por el seed demo (`scripts/seed-demo.mjs`) |

Las bases `resto_identity`, `resto_catalog` y `resto_ordering` se crean solas (`infra/postgres/init/`) y las **migraciones Prisma se ejecutan al arrancar** Identity, Catalog y Ordering.

### Frontends (`apps/*/.env.local` o variables del entorno de build)

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `NEXT_PUBLIC_GATEWAY_URL` | `http://localhost:4000` | URL pública del gateway (API y WebSocket). Se incrusta en el build (en `pnpm demo` se configura como `http://<LAN_IP>:4000`) |
| `NEXT_PUBLIC_FEATURE_FLAGS` | (ver `.env.example`) | Funcionalidades activas, formato `flag:true,flag:false` |

**Feature flags** (`kitchen-display`, `payments`, `analytics`, `multi-language`): si un flag no está en `true`, su pantalla muestra el aviso **"Próximamente"** en lugar de la funcionalidad. Para usar el KDS completo y el cobro, el panel necesita `kitchen-display:true,payments:true`. `analytics` y `multi-language` aún no tienen funcionalidad (solo el aviso).


---

## 7. Arquitectura

Microservicios independientes, cada uno con **arquitectura hexagonal** interna (puertos y adaptadores), en un monorepo (pnpm workspaces + Turborepo).

| Servicio | Stack | Datos | Responsabilidad |
|---|---|---|---|
| **Gateway** (`:4000`) | Node.js, Express | n/d | Único punto de entrada: enrutado declarativo, JWT, proxy HTTP/WebSocket, health agregado |
| **Identity** (`:4001`) | Node.js, Express, Prisma | PostgreSQL `resto_identity` | Multi-tenant SaaS, autenticación, empleados |
| **Catalog** (`:4002`) | Node.js, GraphQL (Apollo), Prisma | PostgreSQL `resto_catalog` | Categorías, productos, modificadores |
| **Session** (`:4003`) | Node.js, Express | Redis | Mesas, códigos QR, sesiones activas de invitado |
| **Ordering & Fulfillment** (`:4004`) | Node.js, Socket.io, Prisma | PostgreSQL `resto_ordering` + Redis Pub/Sub | Carrito, órdenes, KDS, llamadas de servicio, cobro |

| App | Stack | Audiencia |
|---|---|---|
| `@apps/admin-dashboard` (`:3000`) | Next.js 14 / React | Restaurante: panel + KDS + checkout |
| `@apps/client-pwa` (`:3001`) | Next.js 14 / React (PWA) | Cliente en la mesa |

Paquetes compartidos: `@packages/shared-types` (tipos y puertos) y `@packages/ui-components` (sistema de diseño Bento, kit de componentes Lima & Tinta, `<FeatureGuard>`).

Decisiones clave (ADRs en [`01_Arquitectura/ADR.md`](01_Arquitectura/ADR.md)): microservicios sobre monolito; multi-tenancy por `tenantId` del JWT; Prisma por servicio sin acoplamiento físico; feature flags obligatorios para lo que está fuera de alcance; TDD estricto con circuit breaker (máx. 3 intentos por test). Línea gráfica en [`01_Arquitectura/UI_UX_Guidelines.md`](01_Arquitectura/UI_UX_Guidelines.md).

---

## 8. Contratos de API

Todo entra por el gateway (`http://localhost:4000`). Errores en formato `{ "error": { "code", "message" } }`. Detalle completo en [`02_Dominio/Diccionario.md`](02_Dominio/Diccionario.md).

| Ruta | Auth | Destino |
|---|---|---|
| `POST /v1/auth/{register,login,refresh,logout}` | pública / token | Identity |
| `GET/PATCH /v1/identity/*` | token | Identity |
| `ANY /v1/graphql` | token | Catalog |
| `POST /v1/sessions/open` | **pública** (valida el código `k` del QR; entrada del invitado) | Session |
| `/v1/tables*` (crear, listar, editar, ver/rotar QR) | token; `admin`/`manager` (escritura), `staff` (lectura) | Session |
| `GET /v1/sessions*`, `PATCH /v1/sessions/:id/close` | token; personal | Session |
| `GET/POST/PATCH/DELETE /v1/cart*` | token (invitado de la mesa) | Ordering |
| `GET /v1/orders*` | token (el invitado solo lee lo de su sesión) | Ordering |
| `PATCH /v1/orders/:id/status` | token; `staff`/`manager`/`admin` | Ordering |
| `POST /v1/service-calls` (invitado), `GET`/`PATCH .../:id/resolve` (personal) | token | Ordering |
| `GET /v1/checkout/:sessionId`, `POST /v1/checkout/confirm` | token; `staff`/`manager`/`admin` | Ordering |
| `WS /socket.io` (namespace `/orders`) | token en el handshake | Ordering |
| `GET /health` | pública | Estado agregado de los 7 servicios/dependencias |

Estados de una orden: `PLACED → IN_KITCHEN → READY → DELIVERED` (o `CANCELLED`). Métodos de pago aceptados por el backend: `CASH`, `CARD`, `OTHER` (en el MVP solo se **registra** el cobro; no hay pasarela de pago real).

---

## 9. Desarrollo, tests y verificación

```bash
pnpm install                 # dependencias
pnpm build                   # build de los paquetes compartidos
pnpm test                    # TODOS los tests unitarios y de integración
pnpm test:ui                 # solo ui-components
pnpm test:gateway            # solo gateway
pnpm test:e2e                # E2E oficial versionado (HTTP + WebSocket contra stack Docker)
```

Build **completo** (paquetes + apps + servicios), que es el que valida los tipos reales:

```bash
pnpm --filter "./packages/*" --filter "./apps/*" --filter "./services/*" -r run build
```

> `pnpm build` a secas solo compila `packages/*`. Los filtros van **antes** de `run build`.

> [!IMPORTANT]
> **Requisito para tests de contrato (`pnpm test`):**
> La suite completa (`pnpm test`) incluye tests de contrato reales contra PostgreSQL y Redis (`test/contract/` en `identity`, `catalog`, `ordering` y `session` usando bases aisladas `resto_*_test` y Redis db2/db3). Requiere que los contenedores Postgres y Redis estén en ejecución (`docker compose up -d` o `pnpm demo`). Si el stack no está disponible, los tests de contrato fallan con un mensaje explícito.

El flujo de verificación del equipo (chequeos automáticos A1-A6 y manuales M1-M7) está en [`brain/Equipo/Verificacion.md`](brain/Equipo/Verificacion.md). Resultado de la última verificación: [`brain/Verificaciones/2026-10-11-2150-verificacion.md`](brain/Verificaciones/2026-10-11-2150-verificacion.md).

Metodología: oleadas con ciclo *Planificación Roja → Ejecución Roja → Planificación Verde → Ejecución Verde → Cierre/Documentación*. Ninguna oleada avanza sin el 100% de tests en verde y sin documentación al día. Los manifiestos están en [`docs/`](docs/) y el progreso en [`03_Oleadas/Estado_MVP.md`](03_Oleadas/Estado_MVP.md).

---

## 10. Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `curl :4000/health` no responde o muestra un servicio caído | Faltó el perfil de servicios o aún están arrancando | `docker compose --profile services up -d --build` y espera ~30 s; `docker compose logs <servicio>` |
| El panel muestra "Error en la petición" en todas las vistas | Token caducado o gateway caído | Vuelve a iniciar sesión; verifica `/health` |
| Los frontends dan 404/500 o `Cannot find module './NNN.js'` | Caché `.next` corrupta (ocurre si se ejecuta `build` con el servidor `dev` encendido) | Detén el servidor, borra `apps/<app>/.next` y arráncalo de nuevo. No hagas `build` con `dev` activo |
| El navegador bloquea las peticiones (CORS) | `CORS_ORIGINS` no incluye el origen del frontend | Ajusta `CORS_ORIGINS` y reinicia el gateway |
| El QR/enlace de la mesa apunta a `localhost` en producción | `PWA_BASE_URL` sin configurar | Define `PWA_BASE_URL` con la URL pública de la PWA y reinicia `session`; rota el QR de las mesas |
| El cliente ve "Escanea el QR de tu mesa" | Abrió la carta sin el código `?k=` o con un QR rotado | Abrir el enlace/QR vigente de la mesa (`Ver QR` en `/mesas`) |
| KDS/Checkout/Pagos muestran "Próximamente" | Flag desactivado | Activa `kitchen-display` y `payments` en `NEXT_PUBLIC_FEATURE_FLAGS` y vuelve a construir/arrancar el frontend |
| `pnpm build` no genera las apps | `pnpm build` solo compila `packages/*` | Usa el build completo de la sección 9 |
| Conflicto de puertos | Algo usa 3000/3001/4000-4004/5432/6379 | Libera el puerto o cambia `GATEWAY_PORT`, `POSTGRES_PORT`, `REDIS_PORT` |

---

## 11. Alcance actual y limitaciones

**Incluido:** registro de restaurantes, login con usuario o correo (`admin` / `admin`), carta (categorías, productos y modificadores), mesas con QR rotable y enlaces adaptados a red local, sesión de invitado sin registro, carrito con cantidades, pedidos, KDS en tiempo real con anuncios por nombre de mesa, llamadas de servicio ("Pedir la cuenta"), cobro con confirmación y liberación de mesa, suite completa de tests automatizados y flujo E2E con WebSockets.

**Política de pagos en UI:** la pantalla de Checkout (`/checkout`) ofrece en la interfaz exclusivamente cobro en **Efectivo (Cash)** para simplificar la operación en caja del MVP, mientras que el backend mantiene la flexibilidad de soportar `CASH`, `CARD` y `OTHER`.

**No incluido todavía** (aparece como "Próximamente"): analíticas y ventas, historial de pagos, ajustes del restaurante, multi-idioma, pasarela de pago electrónica real (en el MVP el cobro se registra en efectivo en UI), gestión de empleados desde el panel.

**Deuda técnica resuelta:** en la fase de preparación de pruebas se subsanó la deuda de accesibilidad y UI previa (el KDS ahora tiene un único `h1`, la carta PWA cuenta con encabezado `h1` "Carta", los chips de categoría cumplen el estándar táctil accesible de 44 px, el botón flotante del carrito `CartFab` se ubica a 140 px de la base evitando cualquier solape con las acciones inferiores, y el anuncio en vivo del KDS resuelve el nombre legible de la mesa).

**Pruebas End-to-End:** la verificación oficial versionada de todo el ciclo de vida se ejecuta con `pnpm test:e2e` (`scripts/e2e-demo.mjs`), que valida HTTP y eventos Socket.io en tiempo real contra el backend en ejecución. Incluye además notas por ítem y generales, llamada de mesero (`WAITER_CALL`), modo `waiter_only` (`QR_DISABLED` + `staff-open`), bloqueo de pedidos tras pedir la cuenta (`SESSION_NOT_ORDERABLE`) y cobro en efectivo; siempre restaura el modo `hybrid` al terminar. Detalle en [docs/GUIA-PRUEBAS.md](docs/GUIA-PRUEBAS.md).

---

## 12. Estructura del repositorio y documentación

```
.
├── apps/
│   ├── client-pwa/          # PWA del cliente (Next.js)
│   └── admin-dashboard/     # Panel del restaurante + KDS + checkout (Next.js)
├── services/
│   ├── gateway/  identity/  catalog/  session/  ordering/
├── packages/
│   ├── shared-types/        # Tipos e interfaces compartidas
│   └── ui-components/       # Sistema Bento, kit Lima & Tinta, <FeatureGuard>
├── infra/                   # Init de Postgres y config de Redis
├── design-system/           # MASTER.md de diseño por app
├── 01_Arquitectura/         # ADRs, system design, guía UI/UX
├── 02_Dominio/              # Diccionario de contratos API/eventos
├── 03_Oleadas/              # Registro de progreso por oleada
├── docs/                    # Manifiestos técnicos, guías de prueba y planes por oleada
├── scripts/                 # Utilidades de arranque demo, seed y verificación E2E
├── brain/                   # Vault del equipo de agentes (protocolo, handoffs, verificaciones)
├── docker-compose.yml       # Postgres, Redis, Gateway y (perfil "services") los 4 servicios
└── turbo.json
```

Para entender el proyecto a fondo, lee en este orden: `01_Arquitectura/System_Design.md` → `02_Dominio/Diccionario.md` → `03_Oleadas/Estado_MVP.md`. El trabajo con agentes (Claude, Kimi, Agy) está descrito en `CLAUDE.md`, `AGENTS.md` y `brain/Equipo/Protocolo.md`.
