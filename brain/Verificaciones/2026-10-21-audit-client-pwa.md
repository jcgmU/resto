# Reporte Impeccable Audit Técnico: `apps/client-pwa/src`

**Fecha:** 2026-10-21  
**Target:** `apps/client-pwa/src` (Next.js 14 PWA de comensales)  
**Playbook:** `.agents/skills/impeccable/reference/audit.md` (v4.7.0)  
**Referencia de Diseño:** `apps/client-pwa/DESIGN.md` ("La Suite Neumorfa - Carta Digital") & `brain/Decisiones/2026-10-14-linea-grafica-suite.md`  

---

## 1. Audit Health Score

| # | Dimensión | Puntaje (0-4) | Hallazgo Clave |
|---|-----------|:-------------:|----------------|
| 1 | **Accessibility (A11y)** | **2 / 4** | Chip beneficio en landing con contraste 3.8:1 (<4.5:1 AA); tarjetas de producto sin soporte teclado (`tabIndex`/`role`); falta `viewportFit: 'cover'`. |
| 2 | **Performance** | **2 / 4** | Imágenes sin `loading="lazy"` ni dimensiones fijas (CLS); polling redundante (5s carrito + 5s órdenes en cascada); re-renders por queries en cascada. |
| 3 | **Theming** | **2 / 4** | Tokens fantasma (`--bento-card-border`, `--bento-destructive-subtle`); botones principales desalineados de DESIGN.md (`--bento-accent-strong` vs `--bento-primary`); CartFab omite COP. |
| 4 | **Responsive Design** | **2 / 4** | **H4 confirmado**: `call-waiter-note-input` mide ~31px vs 44px; **Colisión 375px**: CartFab (`bottom: 140px`) colisiona directamente sobre footer fijo (159px–193px). |
| 5 | **Implementation Integrity** | **3 / 4** | **PASS**. Experiencia de comensal fiel al flujo en mesa (QR, catálogo, modificadores, carrito, mesero, cuenta y tracking), con desvíos ergonómicos y de tokens puntuales. |
| **Total** | | **11 / 20** | **Acceptable (Significant work needed)** |

**Baremos de Clasificación:**
- 18–20: Excelente (pulido menor)
- 14–17: Bueno (atender dimensiones débiles)
- **10–13: Aceptable (trabajo significativo requerido)** ⬅ *Resultado actual (11/20)*
- 6–9: Pobre (revisión mayor)
- 0–5: Crítico (problemas fundamentales)

---

## 2. Implementation Integrity Verdict

**Veredicto: PASS (Aprobado con observaciones de refinamiento)**

El código en `apps/client-pwa/src` implementa con alta fidelidad técnica el flujo funcional del comensal en mesa bajo el modelo de Restaurante OS:
1. **Acceso y Conexión:** Onboarding vía código QR (`/t/[tenantId]/[tableId]?k=...`) validado por `GuestSessionGuard` y sesión persistida en `sessionStorage`.
2. **Carta Digital Bento:** Navegación por categorías con conteo reactivo (`TabsPill`), tarjetas de producto bento con fallback visual elegante y soporte para platos agotados.
3. **Personalización y Carrito:** Selector de modificadores con validación de obligatoriedad (`ModifierGroupPicker`), bottom sheets accesibles con focus trap (`ProductDetailSheet`, `CartSheet`), y persistencia en backend.
4. **Servicio en Mesa:** Llamado al mesero con nota personalizada (`call-waiter-note-input`), solicitud de cuenta con bloqueo defensivo de adiciones (`billRequested`), y seguimiento secuencial de pedidos (`OrderConfirmationCard`).

**Desviaciones de integridad detectadas:**
- **Deriva ergonómica en mobile (H4 y footer):** La barra de llamado al mesero y el botón CartFab se superponen en viewports estándar de smartphones (375px a 390px).
- **Deriva de tokens primarios:** Uso de `--bento-accent-strong` (#1d1f22) en vez de `--bento-primary` (#5c6784) en los botones de compra, contradiciendo el contrato visual de la Suite Neumorfa.
- **Tokens no definidos en CSS:** Presencia de variables como `--bento-card-border` que caen en fallbacks con valores hardcodeados `rgba(0,0,0,0.1)`.

---

## 3. Resumen Ejecutivo

- **Audit Health Score:** **11 / 20** (Aceptable)
- **Total de Hallazgos:** **14 hallazgos**
  - **P0 (Bloqueante):** 0
  - **P1 (Mayor / WCAG AA / Ergonomía Crítica):** 5
  - **P2 (Menor / Tokens / Performance):** 5
  - **P3 (Pulido / Tipografía / Nomenclatura):** 4
- **Top 4 Hallazgos Críticos:**
  1. **H4 confirmado:** Input `call-waiter-note-input` con altura ~31px frente a 44px reglamentario (`menu/page.tsx:721-739`).
  2. **Colisión Footer / CartFab:** Superposición física del botón flotante sobre el footer a 375px/390px (`CartFab.tsx:10-12` vs `menu/page.tsx:701-718`).
  3. **Contraste Landing 3.8:1:** Chip de beneficios viola WCAG AA 4.5:1 (`app/page.tsx:121-125`).
  4. **Navegación por Teclado:** Tarjetas de catálogo inaccesibles por teclado (`ProductListCard.tsx:14` / `BentoCard.tsx:38-48`).

---

## 4. Hallazgos Detallados por Severidad

### Severidad P1 (Mayor — WCAG AA / Ergonomía Móvil)

#### [P1-01] Touch Target Deficiente en Campo de Nota al Mesero (Hipótesis H4 Confirmada)
- **Ubicación:** `apps/client-pwa/src/app/t/[tenantId]/[tableId]/menu/page.tsx:721-739`
- **Componente:** `input[data-testid="call-waiter-note-input"]`
- **Categoría:** Responsive Design / Accessibility
- **Impacto:** El elemento posee únicamente `padding: 6px 12px` y `fontSize: 0.85rem` sin propiedad `minHeight`. Su altura calculada en el DOM es de aproximadamente **31px** (6px sup + 6px inf + ~17px línea + 2px borde). El botón contiguo (`call-waiter-btn`, línea 746) sí implementa `minHeight: var(--bento-touch-target, 44px)`. En una pantalla táctil de celular, un comensal tiene alta probabilidad de errar el toque o activar involuntariamente el botón inferior.
- **Norma:** WCAG 2.5.5 / 2.5.8 Target Size (Minimum); `DESIGN.md` spacing `touch-target: 44px`.
- **Recomendación:** Agregar `minHeight: 'var(--bento-touch-target, 44px)'` y alinear el padding a `padding: '10px 14px'`.
- **Comando Impeccable Sugerido:** `/impeccable adapt`

#### [P1-02] Colisión Física de CartFab con Footer Fijo en Viewports 375px / 390px
- **Ubicación:** 
  - `apps/client-pwa/src/components/cart/CartFab.tsx:10-12`
  - `apps/client-pwa/src/app/t/[tenantId]/[tableId]/menu/page.tsx:701-718`
- **Componente:** `CartFab` y `footer`
- **Categoría:** Responsive Design
- **Impacto:** 
  - El footer fijo inferior contiene: Input de nota (~31px) + gap 8px + Botón llamar mesero (44px) + gap 8px + Botón pedir cuenta (44px) + paddings (24px) = **159px de altura neta** (o **193px** al sumar `env(safe-area-inset-bottom)` de 34px en iOS).
  - El botón flotante `CartFab` está posicionado con `position: fixed`, `right: 16px`, `bottom: 140px` (sin soporte para safe-area).
  - Al estar fijado en `140px` desde el fondo, el CartFab (de 44px de alto) se sitúa entre los 140px y 184px del viewport inferior. Esto hace que se solape e intercepte directamente el input de notas al mesero y el botón de llamado.
  - Adicionalmente, el `<main>` de la página solo reserva `paddingBottom: calc(140px + env(safe-area-inset-bottom))`, provocando que los últimos 19px de la carta queden permanentemente ocultos tras el footer.
- **Norma:** Ergonomía móvil PWA y control de áreas de interacción (Fitts's Law).
- **Recomendación:** 
  1. Elevar la coordenada inferior de CartFab a `bottom: calc(176px + env(safe-area-inset-bottom, 0px))`.
  2. Ajustar `paddingBottom` de `<main>` en `menu/page.tsx:353` a `calc(176px + env(safe-area-inset-bottom, 0px))`.
- **Comando Impeccable Sugerido:** `/impeccable adapt`

#### [P1-03] Contraste Insuficiente en Chip de Beneficio en Landing (3.80:1 vs 4.5:1)
- **Ubicación:** `apps/client-pwa/src/app/page.tsx:121-125`
- **Componente:** Chip "Sin descargas ni registros previos"
- **Categoría:** Accessibility
- **Impacto:** El texto utiliza `color: var(--bento-status-available-strong)` (`#2d5a31`, luminancia relativa L=0.0819) sobre fondo `background: var(--bento-status-available)` (`#8fbf95`, luminancia L=0.4513).
  $$\text{Contraste} = \frac{0.4513 + 0.05}{0.0819 + 0.05} = \frac{0.5013}{0.1319} \approx 3.80:1$$
  Al tener un tamaño de fuente de `12px` (inferior a 18pt o 14pt bold), el estándar WCAG AA exige un ratio mínimo de **4.5:1**. Los usuarios en ambientes con deslumbramiento solar o baja visión experimentan dificultad de lectura.
- **Norma:** WCAG 1.4.3 Contrast (Minimum) (Level AA).
- **Recomendación:** Ajustar el color del texto a `#19381c` (ratio 5.7:1) o aplicar el patrón del design system con fondo claro y borde suave (`StatusChip`).
- **Comando Impeccable Sugerido:** `/impeccable colorize`

#### [P1-04] Barrera de Accesibilidad por Teclado en Tarjetas de Productos
- **Ubicación:** 
  - `apps/client-pwa/src/components/ProductListCard.tsx:14-21`
  - `packages/ui-components/src/bento/BentoCard.tsx:38-48`
- **Componente:** `ProductListCard` (`BentoCard`)
- **Categoría:** Accessibility
- **Impacto:** `BentoCard` renderiza un elemento `<article>`. Al tener `interactive={isAvailable}` y `onClick={onSelect}`, cambia el cursor a `pointer`, pero **no** asigna `role="button"`, **no** añade `tabIndex={0}`, y **no** escucha eventos de teclado (`onKeyDown` para Enter / Space). Un comensal que navega mediante teclado externo, lector de pantalla o switch accessibility no puede enfocar ni seleccionar ningún plato de la carta.
- **Norma:** WCAG 2.1.1 Keyboard (Level A); WCAG 4.1.2 Name, Role, Value.
- **Recomendación:** En `BentoCard` o `ProductListCard`, cuando sea interactivo, agregar `role="button"`, `tabIndex={0}`, y controlador `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}`.
- **Comando Impeccable Sugerido:** `/impeccable clarify`

#### [P1-05] Omisión de `viewportFit: 'cover'` en Configuración de Viewport PWA
- **Ubicación:** `apps/client-pwa/src/app/layout.tsx:29-32`
- **Componente:** `export const viewport: Viewport`
- **Categoría:** Responsive Design / Accessibility
- **Impacto:** El objeto de configuración de Next.js solo especifica `width: 'device-width'` e `initialScale: 1`. Sin `viewportFit: 'cover'`, los motores WebKit (Safari en iOS) en modo standalone PWA no habilitan los valores no-cero de `env(safe-area-inset-bottom)`. En consecuencia, los cálculos con safe-area se degradan a `0px`, provocando que el footer colisione con el Home Indicator de iPhone.
- **Norma:** PWA Display Mode Standard & Apple HIG Safe Areas.
- **Recomendación:** Declarar `viewportFit: 'cover'` en el export `viewport` de `layout.tsx`.
- **Comando Impeccable Sugerido:** `/impeccable adapt`

---

### Severidad P2 (Menor — Performance, Tokens y Semántica)

#### [P2-01] Falta de Optimización y Dimensiones en Imágenes de Catálogo
- **Ubicación:** 
  - `apps/client-pwa/src/components/ProductListCard.tsx:24-35`
  - `apps/client-pwa/src/components/ProductDetailSheet.tsx:195-206`
- **Componente:** Etiquetas `<img>` de producto
- **Categoría:** Performance
- **Impacto:** Las imágenes se cargan de forma ansiosa (eager) sin `loading="lazy"` ni `decoding="async"`. En una carta con decenas de platos, el navegador móvil descarga todos los recursos multimedia de forma simultánea, saturando la conexión Wi-Fi/4G del comensal. Además, al carecer de atributos intrínsecos `width` y `height`, provocan Cumulative Layout Shift (CLS) al finalizar la descarga.
- **Norma:** Core Web Vitals (LCP / CLS).
- **Recomendación:** Incorporar `loading="lazy"`, `decoding="async"` o migrar a `next/image`.
- **Comando Impeccable Sugerido:** `/impeccable optimize`

#### [P2-02] Polling Redundante y Re-renderizados en Cascada
- **Ubicación:** 
  - `apps/client-pwa/src/app/t/[tenantId]/[tableId]/menu/page.tsx:105-165`
  - `apps/client-pwa/src/components/cart/OrderConfirmationCard.tsx:89-109`
- **Componente:** Hooks de sincronización de estado
- **Impacto:** En el montaje se ejecutan 4 llamadas asíncronas no coordinadas (`fetchMenu`, `refreshCart`, `refreshOrders`, `getTenantSettings`) provocando múltiples renders consecutivos. A esto se suma un `setInterval` cada 5s en la página para el carrito y **otro `setInterval` independiente cada 5s por cada tarjeta de pedido activa** en `OrderConfirmationCard`. Si una mesa tiene 2 pedidos en curso, coexisten 3 timers en paralelo disparando consultas HTTP redundantes cada 5 segundos.
- **Norma:** React Performance Patterns & Efficient Network Polling.
- **Recomendación:** Centralizar el polling en un único loop de sincronización de mesa a nivel de página o contexto.
- **Comando Impeccable Sugerido:** `/impeccable optimize`

#### [P2-03] Tokens CSS No Declarados con Fallbacks Hardcodeados (Design Drift)
- **Ubicación:** 
  - `apps/client-pwa/src/components/cart/CartSheet.tsx:156, 195, 210`
  - `apps/client-pwa/src/components/cart/CartSummaryBar.tsx:26`
  - `apps/client-pwa/src/components/cart/QuantityStepper.tsx:73, 112, 146`
  - `apps/client-pwa/src/components/cart/AddedByBadge.tsx:18`
- **Componente:** Estilos en línea de bordes y fondos
- **Categoría:** Theming
- **Impacto:** Uso de tokens inexistentes en `bento.css`:
  - `var(--bento-card-border, rgba(0, 0, 0, 0.1))` (el token real es `--bento-border`).
  - `var(--bento-destructive-subtle, rgba(239, 68, 68, 0.1))` (el token real es `--bento-status-occupied-bg`).
  - `var(--bento-accent-subtle, rgba(0, 0, 0, 0.05))` (el token real es `--bento-subtle`).
  Esto genera dependencia de colores literales no rastreados por el design system.
- **Norma:** Design System Token Consistency (`DESIGN.md`).
- **Recomendación:** Reemplazar las variables fantasma por sus equivalentes oficiales en `bento.css`.
- **Comando Impeccable Sugerido:** `/impeccable polish`

#### [P2-04] Desvío de Identidad en Botones Principales de Compra
- **Ubicación:** 
  - `apps/client-pwa/src/components/cart/CartSummaryBar.tsx:44-46`
  - `apps/client-pwa/src/components/ProductDetailSheet.tsx:419-421`
- **Componente:** Botón "Enviar Pedido" y Botón "Añadir al carrito"
- **Categoría:** Theming
- **Impacto:** Ambos botones aplican `backgroundColor: 'var(--bento-accent-strong)'` (#1d1f22, carbón oscuro) en lugar de `var(--bento-primary)` (#5c6784, Slate Indigo). `DESIGN.md` establece expresamente:
  *"Slate Indigo (#5c6784): Acción principal para agregar al carrito, confirmar pedido y solicitar cuenta."*
  Esto rompe la armonía visual pastel establecida para la Suite de comensales.
- **Norma:** `DESIGN.md` Creative North Star ("La Suite Neumorfa").
- **Recomendación:** Utilizar `var(--bento-primary)` como fondo y `var(--bento-card-bg-solid)` para el texto.
- **Comando Impeccable Sugerido:** `/impeccable colorize`

#### [P2-05] Diálogos Modales sin Nombre Accesible Vinculado
- **Ubicación:** 
  - `apps/client-pwa/src/components/cart/CartSheet.tsx:93-97`
  - `apps/client-pwa/src/components/ProductDetailSheet.tsx:136-140`
- **Componente:** Contenedores modales con `role="dialog"`
- **Categoría:** Accessibility
- **Impacto:** Ambos modales definen `role="dialog"` y `aria-modal="true"`, pero carecen de `aria-labelledby` o `aria-label`. Las tecnologías asistivas anuncian la apertura de una ventana modal anónima sin indicar su propósito al usuario ciego.
- **Norma:** WCAG 4.1.2 Name, Role, Value (Level A).
- **Recomendación:** Añadir `aria-labelledby="cart-sheet-title"` y `aria-labelledby="product-sheet-title"` vinculados a sus respectivos `<h2>`.
- **Comando Impeccable Sugerido:** `/impeccable clarify`

---

### Severidad P3 (Pulido — Tipografía y Microinteracciones)

#### [P3-01] Omisión del Monto Total COP en el Botón Flotante CartFab
- **Ubicación:** `apps/client-pwa/src/components/cart/CartFab.tsx:52-62`
- **Componente:** `CartFab`
- **Categoría:** Implementation Integrity / Theming
- **Impacto:** `DESIGN.md` especifica para CartFab: *"Botón flotante accesible de acción rápida con contador de ítems y total formateado en COP"*. Actualmente el componente únicamente renderiza el icono SVG y el conteo de ítems (`{itemCount}`), omitiendo el valor monetario acumulado.
- **Norma:** `DESIGN.md` Components: CartFab.
- **Recomendación:** Aceptar prop opcional `total?: number` y mostrar `formatCOP(total)` cuando sea mayor a cero.
- **Comando Impeccable Sugerido:** `/impeccable polish`

#### [P3-02] Texto Translúcido sobre Fondos de Botón Sólidos
- **Ubicación:** 
  - `apps/client-pwa/src/components/cart/CartFab.tsx:18`
  - `apps/client-pwa/src/components/cart/CartSummaryBar.tsx:45`
  - `apps/client-pwa/src/components/ProductDetailSheet.tsx:420`
  - `apps/client-pwa/src/components/cart/QuantityStepper.tsx:56`
- **Componente:** Textos en botones oscuros o destructivos
- **Categoría:** Theming / Accessibility
- **Impacto:** Se utiliza `color: 'var(--bento-card-bg)'` (`rgba(255, 255, 255, 0.65)`). Usar blanco al 65% de opacidad para el texto sobre fondos oscuros o rojos reduce la nitidez tipográfica innecesariamente.
- **Recomendación:** Cambiar a `var(--bento-card-bg-solid)` (`#ffffff`).
- **Comando Impeccable Sugerido:** `/impeccable polish`

#### [P3-03] Dispersión de Tamaños de Fuente Literales Fuera de la Escala Tipográfica
- **Ubicación:** 
  - `apps/client-pwa/src/app/page.tsx:27, 91, 103, 123, 171, 203, 221`
  - `apps/client-pwa/src/app/t/[tenantId]/[tableId]/menu/page.tsx:366`
  - `apps/client-pwa/src/components/cart/QuantityStepper.tsx:59, 78, 119, 153`
- **Componente:** Estilos tipográficos en línea
- **Categoría:** Theming
- **Impacto:** Se emplean valores literales dispersos como `11px`, `26px`, `0.85rem`, `1.2rem` detectados por el detector Impeccable (`design-system-font-size`). La escala de `DESIGN.md` define 5 peldaños: display, headline, title, body, label.
- **Recomendación:** Homogeneizar los tamaños a los tokens y peldaños estándar de `DESIGN.md`.
- **Comando Impeccable Sugerido:** `/impeccable typeset`

#### [P3-04] Referencia Obsoleta a Tema Supersedido en Comentarios
- **Ubicación:** `apps/client-pwa/src/components/GuestSessionGuard.tsx:27`
- **Componente:** Comentario de hidratación
- **Categoría:** Implementation Integrity
- **Impacto:** El comentario alude a "tokens Lima & Tinta", concepto de la etapa previa que fue reemplazado por la Suite Neumorfa.
- **Recomendación:** Actualizar el comentario para reflejar los tokens de la Suite.
- **Comando Impeccable Sugerido:** `/impeccable polish`

---

## 5. Patrones y Problemas Sistémicos

1. **Patrón de Alturas Fijas vs `touch-target`:** Mientras los botones primarios usan consistentemente `var(--bento-touch-target, 44px)`, los inputs de texto secundarios (`call-waiter-note-input`) y steppers de confirmación se implementaron con padding compacto (~31px), vulnerando el principio de área táctil móvil.
2. **Patrón de Acumulación en Footer Fijo:** El diseño móvil fijó en la parte inferior tanto el input de notas, el botón de mesero y el botón de cuenta, totalizando más de 160px de chrome inferior continuo. Al superponerle un FAB en `bottom: 140px`, se creó una colisión visual y táctil inevitable en terminales con pantallas de 375px a 390px (iPhone 12/13/Mini).
3. **Contraste en Chips Pastel:** La Suite utiliza tonos pastel de fondo (`#8fbf95`, `#dcc98a`, `#e0a6a6`). Cuando se colocan textos medianamente oscuros (`#2d5a31` o `#527a55`) en tamaños pequeños (11–12px), el contraste ronda entre 2.3:1 y 3.8:1, quedando por debajo de WCAG AA (4.5:1).

---

## 6. Aspectos Positivos Destacados

- **Formateo COP Riguroso:** Implementación intachable de `formatCOP` sin decimales en todos los precios del catálogo, adicionales de modificadores, subtotales de ítems, barras de confirmación y chips de resumen.
- **Manejo Defensivo de Sesión:** `GuestSessionGuard` y `PwaApiClient` interceptan 401s limpiando tokens y notificando eventos limpios sin fugas de memoria.
- **Focus Trap y Tecla Escape:** Implementación robusta en modales `CartSheet` y `ProductDetailSheet` con restauración del foco al elemento anterior (`previousFocusRef`).
- **Estados de Servicio en Mesa Claros:** Banners informativos para `waiter_only`, `billRequested` y `callingWaiter` con feedback contextual inmediato al comensal.
- **Suite de Pruebas Automatizadas Verde:** 17 suites de prueba y 97 tests pasando exitosamente sin regresiones (`pnpm test`).

---

## 7. Plan de Acción Recomendado (Comandos Impeccable)

Ejecutar las correcciones en el siguiente orden de prioridad:

1. **[P1] `/impeccable adapt`**:
   - Ajustar `call-waiter-note-input` a `minHeight: var(--bento-touch-target, 44px)`.
   - Reubicar `CartFab` a `bottom: calc(176px + env(safe-area-inset-bottom, 0px))` y sincronizar el `paddingBottom` de `<main>`.
   - Incorporar `viewportFit: 'cover'` en `layout.tsx`.
2. **[P1] `/impeccable colorize`**:
   - Resolver el contraste del chip de landing (`page.tsx:121-125`) elevándolo a >= 4.5:1.
   - Restablecer `var(--bento-primary)` (#5c6784) en `CartSummaryBar` y `ProductDetailSheet`.
3. **[P1] `/impeccable clarify`**:
   - Agregar accesibilidad por teclado (`role="button"`, `tabIndex`, enter/space) en `ProductListCard` y `BentoCard`.
   - Añadir `aria-labelledby` en los modales `CartSheet` y `ProductDetailSheet`.
4. **[P2] `/impeccable optimize`**:
   - Incorporar `loading="lazy"` y `decoding="async"` en imágenes de producto.
   - Unificar los intervalos de polling de órdenes y carrito.
5. **[P2] `/impeccable typeset`**:
   - Normalizar tamaños de fuente dispersos a la escala de 5 niveles de `DESIGN.md`.
6. **[P3] `/impeccable polish`**:
   - Reemplazar tokens CSS no declarados (`--bento-card-border`, `--bento-destructive-subtle`).
   - Sustituir `color: var(--bento-card-bg)` por `var(--bento-card-bg-solid)` en botones.
   - Añadir valor COP formateado en `CartFab`.
