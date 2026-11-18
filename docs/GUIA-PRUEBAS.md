# Guía de Pruebas de Restaurante OS (End-to-End en Red Local y Móvil)

Esta guía explica cómo ejecutar y validar el ciclo de vida completo de **Restaurante OS** en tu máquina de desarrollo y desde dispositivos móviles (smartphones/tablets) conectados a la misma red local WiFi.

---

## 1. Arranque Rápido con `pnpm demo`

Restaurante OS incluye una utilidad de arranque automatizado en un solo comando:

```bash
pnpm demo
```

### ¿Qué hace `pnpm demo` entre bastidores?

El script de orquestación (`scripts/start-demo.mjs`):
1. **Comprueba los prerrequisitos:** Verifica que Docker y Docker Compose estén instalados y que el daemon de Docker Desktop esté activo.
2. **Detecta y prioriza la IP de red local (`LAN_IP`):** Inspecciona automáticamente todas las interfaces de red del host, excluye adaptadores virtuales o VPN (Tailscale, VirtualBox, VMware, Hyper-V, WSL, Docker, etc.) y rangos no alcanzables en la red física (como CGNAT `100.64.0.0/10`, link-local `169.254.0.0/16`, loopback `127.0.0.0/8` o `192.168.56.x` de VirtualBox). Selecciona la IPv4 más adecuada priorizando subredes locales estándar (`192.168.0.0/16` > `10.0.0.0/8` > `172.16.0.0/12` > otras) e imprime todas las candidatas detectadas tanto en el log de inicio (Paso 2) como en el banner final.
3. **Inicia el backend en Docker:** Levanta los contenedores mediante `docker compose --profile services up -d` inyectando automáticamente:
   - `CORS_ORIGINS`: Permite `localhost:3000`, `localhost:3001` y `http://<LAN_IP>:3000`, `http://<LAN_IP>:3001`.
   - `PWA_BASE_URL`: Configurada como `http://<LAN_IP>:3001` para que los códigos QR apunten a la IP alcanzable desde móviles.
   - `MIN_ADMIN_PASSWORD_LENGTH=4`: Habilita la contraseña corta de demo para el entorno local.
4. **Espera la disponibilidad del Gateway:** Sondea `http://localhost:4000/health` hasta confirmar HTTP 200.
5. **Compila los paquetes compartidos:** Ejecuta `pnpm --filter "@packages/*" run build` para asegurar que los contratos de `@packages/shared-types` y los estilos de `@packages/ui-components` estén disponibles para las apps.
6. **Configura `.env.local` en los frontends:** Actualiza `apps/admin-dashboard/.env.local` y `apps/client-pwa/.env.local` con `NEXT_PUBLIC_GATEWAY_URL=http://<LAN_IP>:4000` y `NEXT_PUBLIC_FEATURE_FLAGS=kitchen-display:true,payments:true` (realizando un merge que preserva configuraciones previas).
7. **Ejecuta el seed de datos demo:** Corre `scripts/seed-demo.mjs` con lógica idempotente y reintentos automáticos, asegurando que categorías, productos, modificadores, mesas y usuario administrador queden listos.
8. **Inicia los servidores de desarrollo:** Lanza concurrentemente el panel de administración (`:3000`) y la PWA de clientes (`:3001`), prefijando sus logs con `[admin]` y `[pwa]`.
9. **Muestra el banner de acceso:** Imprime las direcciones URL tanto locales como de red LAN y las instrucciones de control.

### Selección de Interfaz y Forzado de `LAN_IP`

Si el host dispone de múltiples interfaces de red activas (por ejemplo, Wi-Fi y Ethernet conectadas simultáneamente) o se desea forzar una dirección IP específica, es posible omitir la autodetección definiendo la variable de entorno `LAN_IP`:

- **En Bash / Linux / macOS:**
  ```bash
  LAN_IP=192.168.0.26 pnpm demo
  ```
- **En Windows PowerShell:**
  ```powershell
  $env:LAN_IP="192.168.0.26"; pnpm demo
  ```

Cuando `LAN_IP` está definida, `start-demo.mjs` utiliza dicha dirección con prioridad absoluta para el cálculo de CORS en el Gateway, las URLs de los códigos QR y las variables en `.env.local` de las aplicaciones frontend.

---

## 2. Prerrequisitos

Antes de iniciar la prueba, asegúrate de contar con:

- **Node.js 20 o superior** (`node -v`)
- **pnpm 9** (`pnpm -v`, instalable mediante `npm install -g pnpm@9`)
- **Docker Desktop** (o Docker Engine con plugin Compose v2) iniciado y en ejecución
- **Conexión a la misma red WiFi:** Si vas a probar desde tu teléfono móvil o tablet, el dispositivo móvil y la computadora deben estar conectados a la misma red WiFi (sin aislamiento de clientes / AP isolation en el router).
- **Puertos libres en el host:** `3000` (Admin), `3001` (PWA), `4000` (Gateway), `4001` a `4004` (Microservicios), `5432` (Postgres) y `6379` (Redis).

### Configuración del Firewall de Windows y Perfil de Red

Para permitir que los dispositivos móviles (smartphones o tablets) de la red local puedan comunicarse con los servicios que se ejecutan en la máquina Windows host, se deben cumplir dos configuraciones esenciales:

1. **Perfil de red "Privada":**
   La red Wi-Fi en Windows debe estar configurada como red **Privada**. Si la conexión se encuentra configurada como "Pública", el firewall de Windows bloquea de manera predeterminada el tráfico entrante desde otros dispositivos de la red local:
   - Ve a **Configuración** → **Red e Internet** → **Wi-Fi** → Haz clic en el nombre de la red Wi-Fi activa (**Propiedades de red**).
   - En *Tipo de perfil de red*, selecciona **Privada**.

2. **Apertura de puertos de entrada en el Firewall de Windows (3000, 3001, 4000):**
   Debes habilitar los puertos TCP `3000` (Panel Administrador), `3001` (PWA Clientes) y `4000` (API Gateway) para el perfil Privado.
   - Abre una consola de **PowerShell como Administrador** (clic derecho en el botón de Inicio de Windows → *Terminal (Administrador)* o *Windows PowerShell (Administrador)*).
   - Ejecuta el siguiente comando exacto:
     ```powershell
     New-NetFirewallRule -DisplayName "Resto Demo" -Direction Inbound -Protocol TCP -LocalPort 3000,3001,4000 -Action Allow -Profile Private
     ```

### Comprobación de la Dirección IP con `ipconfig`

Aunque `start-demo.mjs` selecciona automáticamente la interfaz física prioritaria, puedes verificar tu dirección IP local o contrastarla ejecutando `ipconfig`:

1. Abre un terminal (PowerShell o CMD) y escribe:
   ```cmd
   ipconfig
   ```
2. Busca la sección correspondiente a tu adaptador de red físico activo:
   - **Adaptador de LAN inalámbrica Wi-Fi** (si estás conectado mediante Wi-Fi).
   - **Adaptador de Ethernet** (si estás conectado por cable de red).
3. Identifica la **Dirección IPv4** (habitualmente en rangos privados como `192.168.x.x` o `10.x.x.x`). Esta es la dirección que tus dispositivos móviles pueden alcanzar en la red local.

> [!WARNING]
> ### No utilizar adaptadores virtuales ni redes VPN
> Al verificar la IP o al forzar `LAN_IP`, **NO utilices** las direcciones asignadas a interfaces virtuales o servicios VPN como:
> - **Tailscale:** rango CGNAT `100.x.x.x` (`100.64.0.0/10`).
> - **VirtualBox:** adaptador Host-Only `192.168.56.x`.
> - **VMware:** adaptadores virtuales `VMnet`.
> - **vEthernet / Hyper-V / WSL:** adaptadores virtuales internos (generalmente en `172.x.x.x`).
> 
> Los teléfonos móviles o tablets conectados a la red Wi-Fi no tienen visibilidad ni enrutamiento hacia estos adaptadores internos o túneles VPN, por lo que no podrán cargar la carta digital ni conectarse al sistema.

---

## 3. URLs de Acceso y Credenciales

Al ejecutar `pnpm demo`, el sistema quedará disponible en las siguientes direcciones:

| Aplicación | Acceso Local (PC) | Acceso Red Local (Móvil en misma WiFi) |
|---|---|---|
| **Panel de Administración** (Admin / KDS / Checkout) | `http://localhost:3000` | `http://<LAN_IP>:3000` |
| **PWA de Clientes** (Carta / Carrito / Pedidos) | `http://localhost:3001` | `http://<LAN_IP>:3001` |
| **API Gateway** (HTTP / WebSocket) | `http://localhost:4000` | `http://<LAN_IP>:4000` |

> [!NOTE]
> `<LAN_IP>` corresponde a la dirección IPv4 seleccionada automáticamente por `start-demo.mjs` (o la provista mediante la variable `$env:LAN_IP`). El script lista todas las candidatas detectadas en la consola tanto en el paso 2 de arranque como en el banner final para verificar qué IP está activa.

### Credenciales Demo Precargadas

- **Usuario / Correo:** `admin` (también admite `admin` en el campo "Usuario o Correo")
- **Contraseña:** `admin` (configurable mediante la variable `DEMO_ADMIN_PASSWORD`)
- **Restaurante Demo:** `Restaurante Demo` (slug: `demo`)

---

## 4. Guion de Prueba Paso a Paso (Flujo de Servicio Completo)

Sigue este guion para comprobar el funcionamiento interactivo de punta a punta entre la PC y tu teléfono móvil:

### Paso 1: Iniciar sesión en el Panel de Administración
1. Abre tu navegador en la PC e ingresa a `http://localhost:3000/login` (o desde otro equipo en la red `http://<LAN_IP>:3000/login`).
2. En el campo **Usuario o Correo**, escribe `admin`.
3. En el campo **Contraseña**, escribe `admin`.
4. Pulsa **Iniciar Sesión**. Serás redirigido a la carta (`/menu`).

### Paso 2: Verificar la carta y modificadores en `/menu`
1. En la barra de navegación del panel, dirígete a **Menú** (`/menu`) (o confirma que ya te encuentras allí tras el inicio de sesión).
2. Verifica que las siguientes categorías estén precargadas por el seed:
   - **Entradas:** Bruschetta Clásica, Nachos con Guacamole.
   - **Platos Fuertes:** Hamburguesa Gourmet, Bife de Chorizo, Pasta Carbonara, Pizza Margarita.
   - **Bebidas:** Limonada Natural, Cerveza Artesanal, Agua Mineral.
   - **Postres:** Tiramisú Artesanal, Cheesecake de Frutos Rojos.
3. Observa que los Platos Fuertes cuentan con grupos de modificadores asociados:
   - *Término de cocción* (obligatorio: Término medio, Tres cuartos, Bien cocido).
   - *Adiciones* (opcional: Queso extra, Aguacate, Tocineta, con incrementos de precio).

### Paso 3: Consultar las mesas y abrir el código QR en `/mesas`
1. En el panel de administración, dirígete a **Mesas** (`/mesas`).
2. Observa las mesas creadas: **Mesa 1**, **Mesa 2**, **Mesa 3**, **Mesa 4**, **Barra 1** y **Barra 2**.
3. En la tarjeta de **Mesa 1**, haz clic en el botón **Ver QR**.
4. Se abrirá un modal mostrando el código QR generado dinámicamente y la URL correspondiente, la cual incluye la dirección IP de tu red local: `http://<LAN_IP>:3001/t/<tenantId>/<tableId>?k=<qrKey>`.

### Paso 4: Escanear el QR desde el teléfono móvil
1. Abre la aplicación de cámara o un lector de códigos QR en tu teléfono móvil (conectado a la misma red WiFi).
2. Apunta la cámara al código QR en la pantalla de la PC y abre el enlace detectado.  
   *(Alternativa si no deseas usar la cámara: copia el enlace mostrado en el modal y pégalo en el navegador móvil Chrome/Safari).*
3. La PWA se abrirá directamente en la carta de la **Mesa 1**, estableciendo una sesión de comensal automática sin necesidad de registrarse.

### Paso 5: Armar el pedido y confirmar la comanda en la PWA
1. En el móvil, navega por las categorías ("Platos Fuertes").
2. Toca sobre **Hamburguesa Gourmet**.
3. Selecciona el **Término de cocción** deseado (ej. *Término medio*) y marca una o más **Adiciones** (ej. *Queso extra* y *Tocineta*).
4. Pulsa **Añadir al carrito**.
5. Toca el botón flotante del carrito (**CartFab** ubicado en la esquina inferior derecha). Observa que su posición no se solapa con los botones inferiores.
6. Revisa los productos en el carrito y pulsa **Enviar pedido**.
7. Verás la pantalla de confirmación con el identificador de la orden y la barra de estado de preparación en tiempo real (*Recibido → En cocina → Listo → Entregado*).

### Paso 6: Observar la llegada en tiempo real en la pantalla de cocina (KDS)
1. En la PC, ve a la sección **KDS** (`/kds`) del panel de administración.
2. Sin recargar la página, verás aparecer la tarjeta de la orden en la columna **Por preparar**, acompañada del anuncio visual y auditivo que indica el nombre resuelto de la mesa (ej. *"Nueva orden de Mesa 1"*).
3. La tarjeta detalla la hamburguesa junto con el término de cocción y las adiciones seleccionadas.

### Paso 7: Avanzar el estado de la comanda en el KDS
1. En la tarjeta del KDS en la PC, haz clic en **Pasar a cocina** (el pedido pasa a la columna *En cocina*).
2. En el teléfono móvil, observa cómo la barra de progreso de la PWA avanza automáticamente a *En cocina*.
3. En el KDS, haz clic en **Marcar como listo** (pasa a la columna *Listas*).
4. Finalmente, haz clic en **Marcar entregado** (la tarjeta se retira del flujo activo de cocina).

### Paso 8: Solicitar la cuenta desde el móvil (Llamada de Servicio)
1. En la PWA en el celular, presiona el botón **Pedir la cuenta**.
2. En la PC, en la vista del KDS (`/kds`), observa el panel lateral de **Llamadas de servicio**: aparecerá inmediatamente una alerta con la llamada de la **Mesa 1**.
3. El mesero o staff puede marcar la llamada como **Resolver** una vez atendida.

### Paso 9: Realizar el cobro en caja (`/checkout`)
1. En el panel de administración en la PC, dirígete a **Cobro / Checkout** (`/checkout`).
2. Verás la tarjeta de la **Mesa 1** en estado ocupada con la sesión activa. Haz clic en ella.
3. Se mostrará el detalle completo del consumo: los productos ordenados, los modificadores y el total de la cuenta.
4. En el selector de método de pago se muestra únicamente **Efectivo** (la interfaz de cobro rápido está limitada a este método en el MVP; el backend sigue aceptando otros métodos). Selecciona **Efectivo**.
5. Haz clic en **Registrar cobro** y luego en **Confirmar cobro** en el modal de verificación.

### Paso 10: Confirmar liberación de la mesa y cierre de sesión
1. Al registrar el cobro:
   - La orden queda marcada como pagada.
   - La sesión de comensal en Session Service queda cerrada.
   - En `/mesas`, la **Mesa 1** vuelve al estado **Libre**, con su QR listo para el próximo comensal.
   - En la PWA del móvil, la sesión concluye de forma limpia.

---

## 4.1 Llamadas de Servicio (Asistencia, Cuenta y Auto-resolución)

El sistema centraliza las solicitudes de atención y cuenta entre las mesas y el personal mediante **Llamadas de Servicio**:

- **Tipos de llamadas:**
  - `WAITER_CALL`: Solicitud presencial de asistencia en mesa ("Llamar al mesero").
  - `BILL_REQUEST`: Solicitud de cuenta para liquidación y cobro.
  - `GENERIC`: Llamadas operativas o de asistencia genérica.
- **Quién las produce:**
  - El comensal desde la PWA móvil mediante el botón **Llamar al mesero**, el cual envía un `POST /v1/service-calls` de tipo `WAITER_CALL`.
  - El comensal al presionar **Pedir la cuenta**, lo que invoca `POST /v1/sessions/:id/bill-request`. El backend de Session Service transiciona la sesión al estado `billRequested` y genera automáticamente la llamada `BILL_REQUEST` hacia Ordering. En este estado la sesión deja de admitir nuevos pedidos de comida (`409 SESSION_NOT_ORDERABLE`), pero las llamadas de servicio siguen expresamente permitidas como excepción a la barrera de liquidación para que el cliente pueda seguir pidiendo asistencia.
- **Cómo se visualizan y resuelven en el KDS por el staff:**
  - Se visualizan en tiempo real en el panel lateral de **Llamadas de servicio** en el Monitor de Cocina (`/kds`) tras emitirse el evento WebSocket `service-call.created`.
  - La tarjeta de llamada detalla el nombre resuelto de la mesa, el tipo de llamada y la hora de emisión.
  - El staff (mesero o personal de cocina) atiende la solicitud y hace clic en el botón **Resolver** (`PATCH /v1/service-calls/:id/resolve`) para dar por atendida la alerta y retirarla de la interfaz.
- **Auto-resolución de llamadas pendientes al confirmar el cobro en checkout:**
  - Al completar el cobro en la pantalla de **Checkout** (`POST /v1/checkout/confirm`), el caso de uso `ConfirmCheckout` consulta todas las llamadas de servicio con estado `pending` pertenecientes a la sesión y las marca automáticamente como resueltas antes de liberar la mesa. De esta manera, el KDS queda completamente limpio sin llamadas huérfanas de servicios ya finalizados.

---

## 5. Pruebas Automatizadas: `pnpm test:e2e`

Para validar todo el flujo anterior de manera automatizada y sin intervención manual en el navegador, dispones del script de verificación E2E oficial:

```bash
pnpm test:e2e
```

> [!NOTE]
> **Tests de Contrato con Adaptadores Reales (`pnpm test`):**
> La suite general (`pnpm test`) corre tests de contrato contra Postgres (`resto_*_test`) y Redis (`db2`/`db3`) reales en Docker. Si estás corriendo la suite de tests unitarios/contrato, asegúrate de tener el backend de Docker iniciado (`docker compose up -d`).

### ¿Qué verifica `pnpm test:e2e` (`scripts/e2e-demo.mjs`)?
- Autentica al usuario `admin` contra el Gateway.
- Establece una conexión WebSocket real (`Socket.io`) en el namespace `/orders` con el token JWT.
- Consulta el catálogo de productos mediante GraphQL.
- Obtiene las mesas, selecciona la *Mesa 1* y extrae su clave QR vigente.
- Abre una sesión de invitado (`guest`) en Session Service.
- Añade productos al carrito colaborativo y confirma el pedido.
- **Verifica la recepción del evento WebSocket** `order:created` en tiempo real (con timeout de 10 s).
- Realiza las transiciones de comanda de cocina (`IN_KITCHEN` → `READY` → `DELIVERED`).
- Envía una llamada de servicio ("Pedir la cuenta") y la resuelve con credenciales de staff.
- Obtiene el resumen de cuenta de la sesión en `/checkout` y registra el cobro en Efectivo (`CASH`).
- Comprueba que la mesa queda efectivamente liberada (`GET /v1/sessions?status=active` ya no lista la sesión).
- Devuelve código de salida `0` si todo fue exitoso o `1` ante cualquier fallo.

**Pasos extendidos (13-17), sobre la *Mesa 2* del seed** (requieren haber corrido `node scripts/seed-demo.mjs`, que `pnpm demo` ya ejecuta):
- Abre una sesión de invitado y confirma un pedido con **nota por ítem** y **nota general**, verificando que se conservan.
- Crea una llamada `WAITER_CALL` ("Llamar mesero") y la resuelve con credenciales de staff.
- Cambia el **modo de operación** a `waiter_only` (`PATCH /v1/tenant/settings`): `POST /v1/sessions/open` responde `403 QR_DISABLED`, mientras que `POST /v1/sessions/staff-open` más un pedido con `x-session-id` sí funcionan. Después vuelve a `hybrid`. El servicio de sesiones cachea el modo hasta 30 s, por lo que esta parte puede tardar hasta ~40 s.
- Pide la cuenta (`POST /v1/sessions/:id/bill-request`) y comprueba que un nuevo pedido del invitado responde `409 SESSION_NOT_ORDERABLE`.
- Entrega los pedidos, cobra en Efectivo (`CASH`) y verifica que la Mesa 2 queda liberada.
- En el bloque `finally` restaura siempre el modo `hybrid` y limpia pedidos/sesiones residuales aunque algún paso falle.

### Seed demo idempotente (`node scripts/seed-demo.mjs`)
Crea o reconcilia categorías, productos (precios COP enteros, descripción y tiempo de preparación de 10 a 25 min), modificadores, las zonas **Terraza**, **Salón Principal**, **Barra** y **VIP**, mesas con zona y capacidad (4 a 8) y una reserva demo para hoy (*Reserva Demo*, mesa *VIP 1*). Ejecutarlo varias veces seguidas termina siempre con código `0` y sin duplicados.

---

## 5.1 Vistas nuevas del panel para probar a mano

| Vista | Qué probar |
|---|---|
| `/dashboard` (**Resumen Operativo**) | Plano de mesas con filtro **Todas las Zonas** / por zona y por estado; sección **Reservas del día** (crear, cancelar, **Cliente llegó**); alertas de servicio; indicador de SLA; interruptor de **modo de operación** (`hybrid` / `waiter_only`) |
| `/meseros` (**Terminal de Meseros**) | Elegir mesa, armar comanda con nota de preparación por ítem y enviarla a cocina; en `waiter_only` es la única vía para pedir |
| `/mesas` | Asignar **zona** y **capacidad** a cada mesa; las mesas con reserva de hoy aparecen *Reservada* |
| `/kds` | **SLA** por pedido (tiempo estimado del restaurante frente al transcurrido, con marca de atraso) y botón para añadir demora; panel de llamadas de servicio (incluye "Llamar mesero") |

**Probar el modo de operación:** en `/dashboard` cambia a `waiter_only`, abre el enlace QR de una mesa en el móvil (la carta debe indicar que el pedido por QR está desactivado; recuerda el caché de hasta 30 s) y toma el pedido desde `/meseros`. Vuelve a `hybrid` al terminar.

---

## 6. Cómo Detener y Reiniciar el Entorno

### Detener los servicios
1. En la terminal donde se está ejecutando `pnpm demo`, presiona `Ctrl + C`. El script terminará ordenadamente los procesos de Next.js de Admin y PWA.
2. Detén los contenedores de backend ejecutando:
   ```bash
   docker compose --profile services down
   ```

### Reiniciar los datos desde cero (Reset)
Si deseas borrar todas las sesiones, comandas o modificaciones y volver a un estado inicial limpio:
```bash
# 1. Detener contenedores y destruir volúmenes de base de datos (Postgres y Redis)
docker compose --profile services down -v

# 2. Volver a arrancar con un comando (recreará las BD, migraciones y seed)
pnpm demo
```

---

## 7. Solución de Problemas de Conectividad

Si el teléfono móvil no puede cargar la PWA o no se conecta al Gateway tras escanear el código QR:

1. **Comprobar la red Wi-Fi:** Asegúrate de que el teléfono móvil y la computadora estén conectados exactamente a la misma red Wi-Fi y que el router no tenga activado el "Aislamiento de clientes" (*AP Isolation* o *Client Isolation*).
2. **Verificar el perfil de red en Windows:** Abre **Configuración** → **Red e Internet** → **Wi-Fi** → **Propiedades de red** y confirma que esté en **Privada**. Si está en "Pública", el firewall de Windows descartará las conexiones entrantes del móvil.
3. **Verificar la regla de Firewall:** En una consola de PowerShell como Administrador, reejecuta:
   ```powershell
   New-NetFirewallRule -DisplayName "Resto Demo" -Direction Inbound -Protocol TCP -LocalPort 3000,3001,4000 -Action Allow -Profile Private
   ```
4. **Comprobar la IP seleccionada:** Ejecuta `ipconfig` en Windows y confirma que `LAN_IP` corresponde a la IPv4 del adaptador Wi-Fi físico (`192.168.x.x` o `10.x.x.x`), y no a una IP virtual como Tailscale (`100.x.x.x`), VirtualBox (`192.168.56.x`) o vEthernet (`172.x.x.x`). Si es necesario, fuerza la IP correcta con `$env:LAN_IP="<ip>"; pnpm demo`.
5. **Prueba rápida desde el navegador móvil:** Abre en el navegador del teléfono la URL del Gateway: `http://<LAN_IP>:4000/health`. Si devuelve `{"status":"ok"}` o HTTP 200, la conectividad de red y las reglas de firewall están funcionando correctamente.

---

## 8. Advertencia de Seguridad

> [!WARNING]
> ### Entorno estrictamente para Demostración y Pruebas Locales
> - Las credenciales `admin` / `admin` y la configuración `MIN_ADMIN_PASSWORD_LENGTH=4` han sido diseñadas **exclusivamente para facilitar pruebas locales y evaluaciones en red de desarrollo**.
> - **NUNCA DEBEN UTILIZARSE EN ENTORNOS DE PRODUCCIÓN**.
> - En producción, la variable `MIN_ADMIN_PASSWORD_LENGTH` asume por defecto su valor seguro de `8` caracteres, las contraseñas deben cumplir políticas de alta entropía y secretos como `JWT_SECRET` y `POSTGRES_PASSWORD` deben generarse aleatoriamente mediante algoritmos criptográficos.
> - Si deseas personalizar la contraseña del usuario demo en pruebas locales, define la variable de entorno `DEMO_ADMIN_PASSWORD` antes de iniciar:
>   ```bash
>   DEMO_ADMIN_PASSWORD=MiContrasena123 pnpm demo
>   ```
