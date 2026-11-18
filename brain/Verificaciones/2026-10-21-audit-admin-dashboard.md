# Impeccable Technical Audit Report — Resto Admin Dashboard & UI Components

- **Objetivo de Auditoría:** `apps/admin-dashboard/src` y `packages/ui-components/src`
- **Playbook:** `reference/audit.md` (Impeccable v4.7.0)
- **Fecha:** 2026-10-21
- **Auditor:** Impeccable Technical Audit Subagent

---

## 1. Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|:-----:|-------------|
| 1 | **Accessibility (A11y)** | **2/4** | Contraste crítico (2.07:1) en `--bento-destructive` sobre blanco, 16 inputs con `outline: none` sin foco visible y 2 inputs sin etiqueta. |
| 2 | **Performance** | **3/4** | Monolito de 2,687 líneas con 50 `useState` en DashboardPage; ausencia de `React.memo` en `KdsOrderCard` ante streams de WebSockets. |
| 3 | **Theming** | **3/4** | Adherencia estricta a tokens Bento (`pnpm check:a4` PASS, 0 hex huérfanos), pero ausencia absoluta de Dark Mode (`prefers-color-scheme`). |
| 4 | **Responsive Design** | **2/4** | **H5 Confirmado:** ausencia total de media queries de ancho en `PanelShell`/`SidebarRail`; ancho lateral fijo de ~424px rompe layouts a `<=1024px`. |
| 5 | **Implementation Integrity** | **3/4** | Alta fidelidad visual a la Suite y detector en exit 0 (0 errores primarios, 262 avisos de rampa tipográfica/radios). Deuda monolítica en páginas. |
| **Total** | | **13/20** | **Acceptable (significant work needed)** |

> **Rating Band:** **Acceptable (10-13)**. La base visual y técnica es coherente y funcional, pero requiere intervenciones prioritarias en accesibilidad de contraste/foco y en la adaptabilidad responsive del cascarón principal antes de escalar a producción comercial.

---

## 2. Implementation Integrity Verdict

**Start here. PASS CON OBSERVACIONES DE ARQUITECTURA.**

El código implementa con gran rigor la estética de la **Suite interactiva** (ADR 2026-10-14): rail lateral flotante en píldora oscura (`#1d1f22`), tarjetas translúcidas neumorfas con desenfoque de fondo (`backdropFilter: 'blur(8px)'`), tres puntos de ventana pastel e iconografía SVG con trazo unificado. La verificación automatizada `npx impeccable detect` arrojó **0 errores primarios** (`exit code 0`), registrando únicamente 262 advertencias de nivel asesor (`advisory`) centradas en ajustes menores de rampa tipográfica y radios de esquinas frente a `DESIGN.md`.

No obstante, se detectan atajos de implementación estructurales severos: páginas gigantescas con responsabilidades sobredimensionadas (`dashboard/page.tsx` de 2,687 líneas con 50 estados `useState`), omisión de `React.memo` en componentes reactivos de alta frecuencia (KDS), y una rigidez de layout en `PanelShell` que contradice los principios de adaptabilidad fluida de interfaces modernas.

---

## 3. Executive Summary

- **Audit Health Score:** **13/20** (Banda: *Acceptable*)
- **Total de Hallazgos:** **12** problemas documentados
  - **P0 (Bloqueantes):** 0
  - **P1 (Mayores / WCAG AA):** 4
  - **P2 (Menores / Robustez):** 5
  - **P3 (Pulido / Deuda leve):** 3
- **Top Hallazgos Críticos:**
  1. **H5 Responsive Lock:** Fijación estática de ~424px en la doble barra lateral de `PanelShell` que colapsa el espacio útil a `<=1024px` y quiebra el KDS.
  2. **Violación de Contraste:** Uso de `--bento-destructive` (`#e0a6a6`) como texto sobre blanco con ratio 2.07:1 (falla WCAG AA 4.5:1).
  3. **Foco Invisible:** Supresión explícita de outline (`outline: 'none'`) en 16 controles de formulario en `dashboard/page.tsx`.
  4. **Campos sin Etiqueta:** Inputs huérfanos de nombre accesible en el gestor de zonas.
  5. **Touch Targets Sub-44px:** Botones operativos en `KdsOrderCard`, `ProductCard` y `CategoryCard` entre 28px y 36px.

---

## 4. Detailed Findings by Severity

### [P1] Falta crítica de adaptabilidad responsive en PanelShell y SidebarRail (H5)
- **Ubicación:** `apps/admin-dashboard/src/app/(panel)/PanelShell.tsx:160-230`, `packages/ui-components/src/kit/SidebarRail.tsx:23-34`
- **Categoría:** Responsive Design
- **Impacto:** Ausencia total de media queries de ancho. `SidebarRail` fija un ancho de `4.5rem` (72px) con `flex-shrink: 0`. `panel-inner-sidebar` fija un ancho de `280px` con `flexShrink: 0`. Sumando paddings exteriores (`1.5rem` = 24px cada lado) y gaps (`1.5rem` = 24px), el sistema consume **424px inmutables** de ancho lateral.
  - A **1024px** (iPad landscape / laptop pequeña), el espacio libre para el contenido es de apenas **600px** (el KDS requiere 872px mínimo para sus 3 columnas, por lo que colapsa).
  - A **768px** (tablet vertical), el contenido se asfixia en **344px** (más del 55% de pantalla ocupada por barras).
  - A **<=420px** (móvil), la barra excede la pantalla generando scroll horizontal destructivo.
- **WCAG / Estándar:** WCAG 1.4.10 Reflow (Level AA).
- **Recomendación:** Incorporar media queries en `PanelShell` para colapsar `panel-inner-sidebar` a `<=1024px` (ocultándolo o replegándolo a modo drawer) y reducir los paddings a 12px/8px, dejando únicamente el `SidebarRail` visible en tablet.
- **Comando sugerido:** `/impeccable adapt`

### [P1] Contraste inaccesible en textos con token pastel `--bento-destructive`
- **Ubicación:** 
  - `packages/ui-components/src/kit/ModalConfirm.tsx:195`
  - `apps/admin-dashboard/src/components/ProductCard.tsx:191`
  - `apps/admin-dashboard/src/components/CategoryCard.tsx:132`
- **Categoría:** Accessibility
- **Impacto:** Se asigna `color: 'var(--bento-destructive)'` en botones de acción sobre fondos blancos o transparentes. `--bento-destructive` está definido como `#e0a6a6` (pastel rosado de fondo de chip). El ratio de contraste resultante frente a `#ffffff` es de **2.07:1**, violando severamente el umbral mínimo de 4.5:1 exigido para texto normal.
- **WCAG / Estándar:** WCAG 1.4.3 Contrast (Minimum) (Level AA).
- **Recomendación:** Sustituir la propiedad de texto destructivo por el token semántico de contraste adecuado: `var(--bento-status-occupied-text)` (`#7a3030`) o `var(--bento-danger-text)` (`#a05a5a`), reservando `--bento-destructive` exclusivamente para fondos de chip con borde.
- **Comando sugerido:** `/impeccable colorize`

### [P1] Supresión de indicador de foco accesible (`outline: none`) en 16 controles de formulario
- **Ubicación:** `apps/admin-dashboard/src/app/(panel)/dashboard/page.tsx:1164, 1766, 1789, 1810, 1926, 1949, 1970, 1998, 2306, 2321, 2517, 2547, 2571, 2594, 2617, 2640`
- **Categoría:** Accessibility
- **Impacto:** Los inputs y selectores en los modales de mesa, zona y reservas definen `outline: 'none'` inline sin proporcionar ninguna regla de reemplazo (`:focus-visible` o `box-shadow`). La navegación con teclado dentro de los modales es invidente para el usuario.
- **WCAG / Estándar:** WCAG 2.4.7 Focus Visible (Level AA).
- **Recomendación:** Remover `outline: 'none'` o mapear clases que asignen `outline: var(--bento-focus-ring); outline-offset: 2px` en `:focus-visible`.
- **Comando sugerido:** `/impeccable harden`

### [P1] Controles de formulario sin etiqueta accesible (Name/Label ausente)
- **Ubicación:** `apps/admin-dashboard/src/app/(panel)/dashboard/page.tsx:2293, 2363`
- **Categoría:** Accessibility
- **Impacto:** El input para crear nueva zona (línea 2293) y el input para renombrar zona (línea 2363) carecen de elemento `<label>`, atributo `id`, `aria-label` o `aria-labelledby`. Tecnologías de asistencia leen únicamente el placeholder o un campo anónimo.
- **WCAG / Estándar:** WCAG 1.3.1 Info and Relationships / WCAG 4.1.2 Name, Role, Value (Level AA).
- **Recomendación:** Añadir `aria-label="Nombre de la nueva zona"` y `aria-label="Editar nombre de zona"` respectivamente.
- **Comando sugerido:** `/impeccable clarify`

---

### [P2] Touch targets inferiores a 44x44px en controles operativos
- **Ubicación:** 
  - `apps/admin-dashboard/src/components/kds/KdsOrderCard.tsx:290-291` (botones de demora rápida `+5m`, `+10m`, `+15m` a `minHeight: '28px'`, `minWidth: '36px'`)
  - `apps/admin-dashboard/src/components/ProductCard.tsx:176, 198` (botones Editar y Eliminar a `minHeight: '36px'`)
  - `apps/admin-dashboard/src/components/CategoryCard.tsx:60, 82, 117, 138` (botones Subir/Bajar a `minHeight: '32px'`, Editar/Eliminar a `minHeight: '34px'`)
  - `packages/ui-components/src/bento/AvailabilityToggle.tsx:19-37` (botón sin padding ni minHeight)
- **Categoría:** Responsive Design / Accessibility
- **Impacto:** En pantallas táctiles de cocina (KDS) o tablets de meseros/administradores, botones de 28px provocan toques accidentales y retrasan la operativa en momentos de alta demanda.
- **WCAG / Estándar:** WCAG 2.5.5 Target Size / WCAG 2.5.8 Target Size (Minimum) (Level AA).
- **Recomendación:** Elevar la altura mínima a `min-height: var(--bento-touch-target, 44px)` y asegurar padding horizontal adecuado.
- **Comando sugerido:** `/impeccable adapt`

### [P2] Contraste deficiente en AvailabilityToggle y textos secundarios
- **Ubicación:**
  - `packages/ui-components/src/bento/AvailabilityToggle.tsx:33` (`color: 'var(--bento-card-bg)'` = `rgba(255,255,255,0.65)` sobre verde pastel `#8fbf95` produce contraste de ~1.3:1)
  - `apps/admin-dashboard/src/app/(panel)/PanelShell.tsx:284, 293, 326, 356` (`color: 'var(--bento-text-muted)'` `#666666` sobre el panel translúcido da ~3.84:1 - 4.2:1)
- **Categoría:** Accessibility
- **Impacto:** Dificultad para leer el estado del interruptor de disponibilidad y las etiquetas de módulo en el panel lateral.
- **WCAG / Estándar:** WCAG 1.4.3 Contrast (Minimum).
- **Recomendación:** En `AvailabilityToggle`, usar texto oscuro de alta legibilidad (`var(--bento-status-available-text)` = `#527a55` o `#222222`). En `PanelShell`, ajustar el color de textos secundarios a `#4a4c4e`.
- **Comando sugerido:** `/impeccable colorize`

### [P2] Ausencia total de soporte o tokens para Dark Mode
- **Ubicación:** `packages/ui-components/src/bento/tokens.ts:1-83`, `packages/ui-components/src/bento/bento.css:1-50`
- **Categoría:** Theming
- **Impacto:** Todo el sistema Bento está hardcodeado a fondos claros pastel (`#d0d3d6`). No existe soporte para `prefers-color-scheme: dark` ni paleta nocturna, lo cual causa fatiga visual severa en cocinas poco iluminadas y turnos nocturnos.
- **WCAG / Estándar:** Theming Specification / Ergonomía.
- **Recomendación:** Definir un conjunto de tokens oscuros (`--bento-page-bg: #121417`, etc.) y una regla `@media (prefers-color-scheme: dark)` o atributo `[data-theme="dark"]`.
- **Comando sugerido:** `/impeccable colorize`

### [P2] Falta de memoización y re-renders excesivos en KdsOrderCard y KdsBoard
- **Ubicación:** `apps/admin-dashboard/src/components/kds/KdsOrderCard.tsx:1-450`, `apps/admin-dashboard/src/components/kds/KdsBoard.tsx:20-80`
- **Categoría:** Performance
- **Impacto:** Ni `KdsOrderCard` ni `KdsColumn` están envueltos en `React.memo`. Con 30 o 50 comandas activas, cada evento de WebSocket (`order:status-changed`, `order:created`) o tick de timer desencadena una reconciliación completa del DOM en todas las tarjetas de la pantalla.
- **WCAG / Estándar:** React Performance Best Practices.
- **Recomendación:** Envolver `KdsOrderCard` con `React.memo` con comparador de `order.id`, `order.status`, `order.delayMinutes` y `updatingOrderId`.
- **Comando sugerido:** `/impeccable optimize`

### [P2] Arquitectura monolítica masiva con 50 useState en DashboardPage
- **Ubicación:** `apps/admin-dashboard/src/app/(panel)/dashboard/page.tsx:1-2687`
- **Categoría:** Implementation Integrity / Performance
- **Impacto:** Archivo de 2,687 líneas que gestiona 50 estados independientes (zonas, filtros, reservas, mesas, SLA, métricas, modales de confirmación y QR). Cada tecla pulsada en un formulario o cambio de filtro re-evalúa miles de líneas de JSX.
- **WCAG / Estándar:** Code Quality & Maintainability.
- **Recomendación:** Desacoplar la vista en subcomponentes especializados (`ZonesModal.tsx`, `ReservationsModal.tsx`, `TableDetailsModal.tsx`, `DashboardKpis.tsx`, `FloorPlanGrid.tsx`) con estados locales aislados.
- **Comando sugerido:** `/impeccable distill`

---

### [P3] Estado transitorio incorrecto en KPI: "de 0 mesas configuradas" (H6)
- **Ubicación:** `apps/admin-dashboard/src/app/(panel)/dashboard/page.tsx:377, 890`
- **Categoría:** Implementation Integrity
- **Impacto:** Durante la carga inicial de datos, el cálculo de métricas renderiza "de 0 mesas configuradas" por una fracción de segundo antes de recibir el snapshot, o si el arreglo de mesas está vacío, desconcertando al usuario.
- **WCAG / Estándar:** UI State Management.
- **Recomendación:** Mostrar un skeleton o renderizar condicionalmente `metrics.totalCount !== null ? ... : 'cargando mesas...'`.
- **Comando sugerido:** `/impeccable polish`

### [P3] Inyección repetitiva de estilos inline `<style>{CSS}</style>` en el ciclo de render
- **Ubicación:** `packages/ui-components/src/kit/SidebarRail.tsx:39`, `packages/ui-components/src/kit/ModalConfirm.tsx:112`, `packages/ui-components/src/kit/Toast.tsx:42`, `packages/ui-components/src/kit/PageHeader.tsx:47`
- **Categoría:** Performance
- **Impacto:** En cada renderizado se evalúa e inserta un nodo `<style>` dentro del árbol de componentes, provocando re-cálculos de CSSOM innecesarios en el navegador.
- **WCAG / Estándar:** Web Performance.
- **Recomendación:** Centralizar estos estilos en `bento.css` o en hojas de estilo CSS Modules estáticas.
- **Comando sugerido:** `/impeccable optimize`

### [P3] 262 advertencias de escala tipográfica y radios fuera de DESIGN.md
- **Ubicación:** Múltiples componentes en `apps/admin-dashboard/src` y `packages/ui-components/src`
- **Categoría:** Implementation Integrity
- **Impacto:** El detector `npx impeccable detect` identifica 219 tamaños de fuente literales (como `0.6875rem`, `1.625rem`) y 39 radios literales (`10px`, `12px`, `8px`) que no coinciden exactamente con los pasos definidos en `DESIGN.md`.
- **WCAG / Estándar:** Design System Bento.
- **Recomendación:** Sincronizar la rampa tipográfica en `DESIGN.md` para formalizar estos valores intencionales o reemplazarlos por tokens semánticos Bento.
- **Comando sugerido:** `/impeccable typeset` / `/impeccable polish`

---

## 5. Patterns & Systemic Issues

1. **Uso de tokens de relleno pastel para textos interactivos:** Se confundieron tokens de fondo de chip pastel (`--bento-destructive: #e0a6a6`) con tokens de color tipográfico, destruyendo el contraste en tres componentes (`ModalConfirm`, `ProductCard`, `CategoryCard`).
2. **Supresión generalizada de outlines en modales:** En formularios de diálogo se aplicó `outline: 'none'` de forma sistemática para ocultar el borde nativo del navegador, olvidando inyectar `:focus-visible`.
3. **Monolitismo en vistas complejas:** La pantalla de Dashboard (`page.tsx` con 2,687 líneas y 50 `useState`) evidencia una tendencia a acumular lógica, interfaces y modales en un solo archivo en lugar de componentizar.
4. **Fijación estática de anchos en layouts principales:** `PanelShell` y `SidebarRail` carecen por completo de media queries de ancho, asumiendo un viewport de escritorio widescreen permanente.

---

## 6. Positive Findings

- **Fidelidad Estética de Alto Nivel:** La implementación traslada fielmente la atmósfera visual de la Suite aprobada por el usuario: micro-interacciones suaves, sombras neumorfas pulidas y paleta de colores distintiva.
- **Garantía Absoluta contra Hex Huérfanos:** El validador `pnpm check:a4` verifica 52 archivos y certifica **0 colores hexadecimales huérfanos**. Todos los colores pasan rigurosamente por tokens Bento o fallbacks autorizados.
- **Respeto a Motion Sensitivity:** Los componentes clave implementan directivas `@media (prefers-reduced-motion: reduce)` explícitas desactivando transiciones, escalados y animaciones de skeleton.
- **Robustez en Diálogos Modales:** `ModalConfirm` incluye trampa completa de foco con navegación circular por Tab/Shift+Tab, captura de tecla Escape, roles semánticos (`role="dialog"`, `aria-modal="true"`) y restauración de foco al elemento previo al desmontar.
- **Detector Limpio:** `npx impeccable detect` finaliza con código de salida **0**, sin antipatrones primarios ni malas prácticas bloqueantes.

---

## 7. Recommended Actions

Ordenadas por prioridad estricta:

1. **[P1] `/impeccable adapt`**: Implementar media queries fluidas en `PanelShell.tsx` para colapsar `panel-inner-sidebar` en viewports `<=1024px` (resolviendo definitivamente H5) y elevar los touch targets de `KdsOrderCard`, `ProductCard` y `CategoryCard` a 44x44px.
2. **[P1] `/impeccable colorize`**: Corregir los colores de texto destructivo en `ModalConfirm.tsx`, `ProductCard.tsx` y `CategoryCard.tsx` hacia `var(--bento-status-occupied-text)` o `var(--bento-danger-text)` para garantizar contraste WCAG AA >= 4.5:1.
3. **[P1] `/impeccable harden`**: Remover `outline: 'none'` en los 16 controles de formulario de `dashboard/page.tsx` y asegurar la presencia de `--bento-focus-ring` visible para navegación con teclado.
4. **[P1] `/impeccable clarify`**: Agregar etiquetas y `aria-label` descriptivos a los campos de texto de creación y edición de zonas en `dashboard/page.tsx`.
5. **[P2] `/impeccable distill`**: Descomponer el archivo monolítico `apps/admin-dashboard/src/app/(panel)/dashboard/page.tsx` extrayendo los modales de zonas, mesas y reservas en módulos independientes.
6. **[P2] `/impeccable optimize`**: Aplicar `React.memo` a `KdsOrderCard` y `KdsColumn` para amortiguar el impacto del flujo de WebSockets en cocina, y migrar los bloques `<style>` inline a hojas de estilo estáticas.
7. **[P3] `/impeccable typeset`**: Normalizar los 219 casos de fuentes y tamaños literales señalados por el detector con respecto a la rampa de `DESIGN.md`.
8. **[P3] `/impeccable polish`**: Subsanar el glitch transitorio H6 ("de 0 mesas configuradas") y realizar el pulido cosmético final.

---

> You can ask me to run these one at a time, all at once, or in any order you prefer.
>
> Re-run `/impeccable audit` after fixes to see your score improve.
