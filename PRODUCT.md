# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personal del restaurante en servicio operativo (meseros, cocina, bar, caja, encargados y administración) y comensales que acceden a la carta digital e interactúan directamente desde sus teléfonos móviles escaneando el código QR de su mesa (sin crear cuenta ni descargar aplicación).

- **Roles operativos (`apps/admin-dashboard`)**: `ADMIN` y `MANAGER` gestionan catálogo, mesas, zonas, reservas, ajustes y cobros con override; `STAFF` opera con alcance acotado; además existen terminales dedicadas por rol para `WAITER` (`/terminal-mesero`), `CASHIER` (`/terminal-caja`) y `MONITOR` de cocina o bar (`/monitor`).

## Product Purpose

Restaurante OS es una plataforma SaaS B2B2C multi-tenant de gestión y operación gastronómica en tiempo real para restaurantes y bares. Su propósito es coordinar sin fricción todo el ciclo de atención: apertura y asociación de mesas por zonas, pedidos digitales directos por QR o asistidos por mesero, despacho y semaforización en cocina/bar mediante monitores KDS, llamadas de servicio y cierre de cuenta con cobro en caja. El éxito se define por velocidad de rotación, cero pérdida de comandas y una experiencia clara y consistente para comensales y personal.

## Positioning

Sistema operativo unificado para restaurantes con sesiones ancladas a mesa física mediante QR (sin obligar a registro ni descargas), operación en vivo conectada en un solo panel (mesas, zonas, reservas, cocina/bar, llamadas y cobro), monitores de preparación reactivos con cálculo dinámico de tiempos y retraso (SLA), soporte dual para modalidad híbrida y solo-meseros, y tratamiento contable exacto en pesos colombianos (COP entero sin decimales).

## Operating Context

- **Comensal (Client PWA)**: Dispositivos móviles (375px–390px viewport), escaneo de QR en mesa, navegación ágil de categorías, selección de modificadores, carrito colaborativo con notas por ítem y generales, llamado de mesero y solicitud de cuenta.
- **Cocina y Bar (KDS / Monitores)**: Pantalla fija o tableta en área de producción; tarjetas de comandas semaforizadas por SLA (verde/amarillo/rojo), filtrado por destino de preparación (`kitchen` / `bar`), alertas de nuevos pedidos y avance de estados.
- **Meseros (`/terminal-mesero`)**: Terminal móvil/tableta con apertura asistida de mesa (`staff-open`), toma de pedidos y atención de llamadas de servicio filtradas por zona asignada.
- **Caja y Administración (Admin Dashboard)**: Terminales de escritorio o tabletas de salón (1024px–1440px viewport); resumen operativo y plano de mesas por zonas, control de reservas, gestión de mesas individual y por lotes, terminal de cobro (checkout en efectivo o tarjeta con liberación de mesa y manejo de órdenes pendientes), catálogo, gestión de equipo y ajustes de tenant (modo de operación, SLA objetivo, facturación).

## Capabilities and Constraints

- **Capacidades**:
  - Ciclo de vida estricto de sesión: `active` -> `billRequested` -> `closed` (con TTL de inactividad y cambio de mesa atómico).
  - Mesas y Zonas: creación, edición y baja lógica individual o por lotes (`POST/PATCH /v1/tables/batch`, `POST /v1/tables/batch/delete`) asociadas a zonas (`zoneId`) y capacidad (`capacity`), con rotación atómica de QR de 16 bytes al dar de baja y protección ante sesiones activas (`TABLE_HAS_ACTIVE_SESSION`) o reservas futuras (`TABLE_HAS_RESERVATIONS`).
  - Reservas por mesa y ventana horaria con bloqueo automático de QR y asiento asistido (`seat`).
  - Terminal de meseros con apertura asistida de mesa (`staff-open`) y modo de operación configurable por tenant (`hybrid` | `waiter_only`).
  - KDS y monitores en vivo con tiempos estimados (`estimatedPrepMinutes` + `delayMinutes`), barra/punto SLA (`SlaDot`) y destino por categoría (Cocina / Bar).
  - Checkout centralizado en `/checkout` y `/terminal-caja` con cobro en Efectivo o Tarjeta, bloqueo `409 ORDERS_NOT_DELIVERED` con override autorizado para `ADMIN`/`MANAGER`, y facturación simple o electrónica DIAN no bloqueante.
  - Gestión completa de equipo en `/ajustes`: invitación/alta con los 7 roles, edición de perfil/rol/zonas, activación/desactivación (`ACTIVE` / `DISABLED`), reinicio de contraseña por administrador y cambio de contraseña propio.
- **Restricciones Técnicas y de Dominio**:
  - Formato monetario obligatorio: COP entero sin decimales (`formatCOP`).
  - Objetivos táctiles mínimos: 44px (`var(--bento-touch-target)`).
  - Cero valores hexadecimales huérfanos fuera del sistema de tokens Bento (`pnpm check:a4`).
  - La interfaz está en español (`es-CO`); nunca se exponen enums crudos (`IN_KITCHEN`, `CASH`) ni IDs internos al usuario.
  - Funcionalidad fuera de alcance permanece tras `<FeatureGuard>` con placeholder `<Proximamente />`.

## Brand Commitments

- **Identidad Visual**: Línea "Suite" basada en neumorfismo pastel sobre fondos neutrales cálidos (`#d0d3d6` en Admin, `#f2f4f5` en PWA).
- **Arquitectura Admin**: `PanelShell` con rail lateral flotante oscuro (`#1d1f22`), panel interior de navegación con etiquetas textuales (que colapsa a `<=1024px`) y tarjetas translúcidas con blur y bordes suaves.
- **Tipografía**: Bricolage Grotesque (titulares con peso light) y DM Sans (cuerpo de texto y controles).
- **Semáforo de Estados**: Libre (`#8fbf95`), Reservada/Aviso (`#dcc98a`), Ocupada (`#e0a6a6`).
- **Contraste**: Cumplimiento riguroso de WCAG 2.1 AA en todas las combinaciones de estado y texto.

## Evidence on Hand

- Documentación de arquitectura y ADRs en `01_Arquitectura/` y `brain/Decisiones/`.
- Especificación de tokens en `packages/ui-components/src/bento/`.
- Prototipo interactivo de referencia en `brain/Referencias/restaurante_os_interactive_suite.tsx`.
- Suites de pruebas automatizadas unitarias, de contrato (`test/contract/**`, `test-real/**`) y E2E en `brain/Equipo/Verificacion.md`.

## Product Principles

1. **Operación sin fricción y lo urgente primero**: Diseñado para el ritmo acelerado del servicio en restaurante; llamadas, cuentas y pedidos atrasados destacan antes que los totales.
2. **Claridad sobre adorno y datos reales**: Cada componente responde a una función operativa directa con datos reales del backend; lo que no existe no se inventa.
3. **Consistencia de tokens**: La línea Suite es la autoridad visual normativa; no se permiten estilos ad-hoc ni hexadecimales fuera de tokens.
4. **Resiliencia en sala**: Tolerancia a desconexiones transitorias, reconexión automática en tiempo real y preservación garantizada del estado de comandas, carritos y sesiones.
5. **Lenguaje de restaurante**: Mesas, zonas, cuenta, cocina, bar, turno; el comensal nunca necesita cuenta y el personal nunca necesita una explicación técnica.

## Accessibility & Inclusion

- Contraste de texto y elementos interactivos conforme a WCAG 2.1 AA (≥4.5:1 texto regular, ≥3:1 texto grande) y estado nunca comunicado solo por color.
- Áreas táctiles de al menos 44x44px en todos los botones e inputs interactivos en PWA y Admin.
- Soporte para lectores de pantalla y navegación por teclado con roles ARIA semánticos, modales con gestión de foco y regiones `aria-live` en KDS y alertas de servicio.
