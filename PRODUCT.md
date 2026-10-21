# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personal del restaurante en servicio operativo (meseros, cocina, caja, administración) y comensales que acceden a la carta digital e interactúan directamente desde sus teléfonos móviles escaneando el código QR de su mesa.

## Product Purpose

Restaurante OS es una plataforma integral de gestión y operación gastronómica en tiempo real. Su propósito es coordinar sin fricción todo el ciclo de atención del restaurante: apertura y asociación de mesas, pedidos digitales directos o asistidos por mesero, despacho y semaforización en cocina mediante KDS, y cierre de cuenta con cobro en caja. El éxito se define por velocidad de rotación, cero pérdida de comandas y una experiencia clara y consistente para comensales y personal.

## Positioning

Sistema operativo unificado para restaurantes con sesiones ancladas a mesa física mediante QR (sin obligar a descargas de apps), monitor de cocina reactivo con cálculo dinámico de tiempos de preparación y retraso (SLA), soporte dual para modalidad híbrida y solo-meseros, y tratamiento contable exacto en pesos colombianos (COP entero sin decimales).

## Operating Context

- **Comensal (Client PWA)**: Dispositivos móviles (375px–390px viewport), escaneo de QR en mesa, navegación ágil de categorías, selección de modificadores, carrito de compra, llamado de mesero y solicitud de cuenta.
- **Cocina (KDS)**: Pantalla fija o tableta en área de producción; tarjetas de comandas semaforizadas por SLA (verde/amarillo/rojo), alertas sonoras de nuevos pedidos y despacho individual de ítems u órdenes completas.
- **Caja y Administración (Admin Dashboard)**: Terminales de escritorio o tabletas de salón (1024px–1440px viewport); plano visual interactivo de mesas y zonas, control de reservas, terminal de cobro (checkout con liberación inmediata de mesa), catálogo y ajustes de tenant (modo de operación, SLA objetivo).

## Capabilities and Constraints

- **Capacidades**:
  - Ciclo de vida estricto de sesión: `active` -> `billRequested` -> `closed`.
  - Terminal de meseros con apertura asistida de mesa (`staff-open`).
  - KDS en vivo con tiempos estimados (`estimatedPrepMinutes` + `delayMinutes`).
  - Checkout centralizado en caja con cobro en efectivo y liberación de mesa.
  - Multi-tenant con configuración aislada y rutas protegidas por roles.
- **Restricciones Técnicas y de Dominio**:
  - Formato monetario obligatorio: COP entero sin decimales (`formatCOP`).
  - Objetivos táctiles mínimos: 44px (`var(--bento-touch-target)`).
  - Cero valores hexadecimales huérfanos fuera del sistema de tokens Bento (`pnpm check:a4`).
  - Ninguna alteración a servicios de backend (`services/`) durante iteraciones de diseño.
  - Idioma: Español de Colombia (`es-CO`).

## Brand Commitments

- **Identidad Visual**: Línea "Suite" basada en neumorfismo pastel sobre fondos neutrales cálidos (`#d0d3d6` en Admin, `#f2f4f5` en PWA).
- **Arquitectura Admin**: `PanelShell` con rail lateral flotante oscuro (`#1d1f22`), panel interior de navegación con etiquetas textuales y tarjetas translúcidas con blur y bordes suaves.
- **Tipografía**: Bricolage Grotesque (titulares con peso light) y DM Sans (cuerpo de texto y controles).
- **Semáforo de Estados**: Libre (`#8fbf95`), Reservada/Aviso (`#dcc98a`), Ocupada (`#e0a6a6`).
- **Contraste**: Cumplimiento riguroso de WCAG 2.1 AA en todas las combinaciones de estado y texto.

## Evidence on Hand

- Documentación de arquitectura y ADRs en `01_Arquitectura/` y `brain/Decisiones/`.
- Especificación de tokens en `packages/ui-components/src/bento/`.
- Prototipo interactivo de referencia en `brain/Referencias/restaurante_os_interactive_suite.tsx`.
- Suites de pruebas automatizadas unitarias, de contrato y E2E en `brain/Equipo/Verificacion.md`.

## Product Principles

1. **Operación sin fricción**: Diseñado para el ritmo acelerado del servicio en restaurante, minimizando pasos y confirmaciones redundantes.
2. **Claridad sobre adorno**: Cada componente responde a una función operativa directa; la estética apoya la jerarquía de información sin distraer.
3. **Consistencia de tokens**: La línea Suite es la autoridad visual inmutable; no se permiten estilos ad-hoc ni variaciones arbitrarias.
4. **Resiliencia en sala**: Tolerancia a desconexiones transitorias y preservación garantizada del estado de las comandas y sesiones.

## Accessibility & Inclusion

- Contraste de texto y elementos interactivos conforme a WCAG 2.1 AA (≥4.5:1 texto regular, ≥3:1 texto grande).
- Áreas táctiles de al menos 44x44px en todos los botones e inputs interactivos en PWA y Admin.
- Soporte para lectores de pantalla con roles ARIA semánticos en KDS y alertas de servicio.
