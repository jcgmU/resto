# UI/UX Guidelines — Frontends (`@apps/admin-dashboard`, `@apps/client-pwa`)

Vigente desde la Oleada 5 (actualización 2026-10-14, ronda 2). Aplica a todo módulo frontend del proyecto.

## Estética requerida: Línea "Suite" (pastel / neumorfismo)

Aprobada por el usuario según ADR `brain/Decisiones/2026-10-14-linea-grafica-suite.md` y suite interactiva de referencia `brain/Referencias/restaurante_os_interactive_suite.tsx`. Sustituye los valores de la línea Lima & Tinta (conservando el principio de tokens y cero hardcodeo).

- **Estructura y Geometría:** 
  - Layouts modulares tipo "Bento Box" con bordes translúcidos y sombras neumorfas.
  - Radios generosos: `--bento-card-radius: 2rem` (32px), `--bento-inner-radius: 1.5rem` (24px) y `--bento-pill-radius: 9999px`.
  - Sombras neumorfas suaves: `--bento-card-shadow: 4px 6px 30px rgba(150, 155, 160, 0.2), -4px -4px 20px rgba(255, 255, 255, 0.8)`.
  - Fondo glass translúcido con desenfoque: `--bento-card-bg: rgba(255, 255, 255, 0.65)` con `backdrop-filter: blur(8px)`.
  - Borde suave: `--bento-border: rgba(255, 255, 255, 0.6)`.

- **Paleta de Colores y Tokens Semánticos:**
  - **Fondo de página:** `--bento-page-bg: #d0d3d6` (Admin) / `--bento-page-bg-pwa: #f2f4f5` (PWA).
  - **Texto principal:** `--bento-text: #3a3c3e` (contraste AA verificado >= 4.5:1).
  - **Texto secundario:** `--bento-text-muted: #666666` (contraste AA verificado >= 4.5:1).
  - **Acciones primarias:** `--bento-primary: #5c6784` (hover `--bento-primary-hover: #4a536b`; contraste blanco >= 5.6:1).
  - **Rail flotante oscuro:** `--bento-rail-bg: #1d1f22`, activo `--bento-rail-active: #a5b9c6` (sobre píldora 20%), inactivo `--bento-rail-inactive: #6b7280`.
  - **Estados de mesa y servicio (pastel con texto oscuro asociado AA):**
    - **Ocupada:** `--bento-status-occupied: #e0a6a6` (texto asociado `--bento-status-occupied-text: #7a3030`).
    - **Reservada / Aviso:** `--bento-status-reserved: #dcc98a` (texto asociado `--bento-status-reserved-text: #8a6b32`).
    - **Libre / Disponible:** `--bento-status-available: #8fbf95` (texto asociado `--bento-status-available-text: #527a55`).
    - **Acento informativo:** `--bento-info: #a5b9c6`.
  - **Alias deprecados:** `--bento-lima: #a5b9c6`, `--bento-tinta: #1d1f22`, `--bento-hueso: #d0d3d6`, `--bento-papel: #ffffff` (conservados para compatibilidad transitoria).

- **Tipografía:**
  - Titulares: Bricolage Grotesque con peso `light` (`font-weight: 300`) y `letter-spacing: -0.02em`.
  - Cuerpo de texto: DM Sans (`font-weight: 400` a `600`).
  - Sin cargar fuentes adicionales en tiempo de ejecución.

- **Arquitectura Admin (`PanelShell`):**
  - Rail lateral oscuro flotante (`#1d1f22`) en píldora con iconos centrales y botón inferior de ajustes.
  - Contenedor principal glass neumorfo con panel interior (`w-[280px]` translúcido `bg-white/30`, borde `border-white/40`) que contiene:
    1. Tres puntos pastel de ventana (`#e0a6a6`, `#dcc98a`, `#8fbf95`).
    2. Perfil de usuario con avatar y rol.
    3. Nombres de sección visibles (N19):
       - Resumen y Mesas (`/dashboard`)
       - Monitor de Cocina (`/kds`)
       - Terminal de Meseros (`/meseros`)
       - Gestión del Menú (`/menu`)
       - Checkout (`/checkout`)
       - Ajustes (`/ajustes`)
    4. Indicador / selector de Modo de Operación en el pie ("Híbrido (QR + Meseros)").
  - Contenedor de contenido central (ancho completo en KDS, `1200px` en otras vistas) con `PageHeader`.

- **PWA:**
  - Mobile first (375px base).
  - Objetivos táctiles mínimos de 44px (`--bento-touch-target: 44px`).
  - Pie fijo respetando safe-area (`env(safe-area-inset-bottom)`).
  - `themeColor: #f2f4f5`.

- **Regla de Oro (A4):**
  - Cero colores hexadecimales hardcodeados en componentes (`apps/*/src/**/*.tsx` o `packages/*/src/**/*.tsx`).
  - Todos los estilos y colores se consumen estrictamente mediante `var(--bento-*)` o clases del kit.
