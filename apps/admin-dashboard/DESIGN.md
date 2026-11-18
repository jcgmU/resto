---
name: Restaurante OS - Admin Dashboard
description: Sistema operativo de restaurante con estética Suite neumorfa pastel
colors:
  primary: "#5c6784"
  primary-hover: "#4a536b"
  page-bg: "#d0d3d6"
  card-bg: "rgba(255, 255, 255, 0.65)"
  card-bg-solid: "#ffffff"
  rail-bg: "#1d1f22"
  rail-active: "#a5b9c6"
  rail-inactive: "#6b7280"
  status-occupied: "#e0a6a6"
  status-occupied-text: "#7a3030"
  status-reserved: "#dcc98a"
  status-reserved-text: "#8a6b32"
  status-available: "#8fbf95"
  status-available-text: "#527a55"
  status-available-strong: "#163318"
  text: "#3a3c3e"
  text-muted: "#666666"
  border: "rgba(255, 255, 255, 0.6)"
  panel-bg: "rgba(224, 227, 229, 0.5)"
typography:
  display:
    fontFamily: "var(--font-bricolage, 'Bricolage Grotesque', sans-serif)"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 300
    lineHeight: 1.1
  headline:
    fontFamily: "var(--font-bricolage, 'Bricolage Grotesque', sans-serif)"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "var(--font-bricolage, 'Bricolage Grotesque', sans-serif)"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)"
    fontSize: "0.8125rem"
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  card: "2rem"
  inner: "1.5rem"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  touch-target: "44px"
  touch-gap: "8px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card-bg-solid}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  card-surface:
    backgroundColor: "{colors.card-bg}"
    rounded: "{rounded.card}"
    padding: "24px"
  chip-status-available:
    backgroundColor: "{colors.status-available}"
    textColor: "{colors.status-available-text}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  chip-status-occupied:
    backgroundColor: "{colors.status-occupied}"
    textColor: "{colors.status-occupied-text}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  chip-status-reserved:
    backgroundColor: "{colors.status-reserved}"
    textColor: "{colors.status-reserved-text}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
---

# Design System: Restaurante OS - Admin Dashboard

## Overview

**Creative North Star: "La Suite Neumorfa"**

La interfaz de administración de Restaurante OS implementa la línea "Suite", una identidad visual serena, táctil y de alta precisión diseñada para el ritmo operativo continuo de un restaurante. Se fundamenta en un contenedor neumorfo pastel sobre un lienzo neutral cálido (`#d0d3d6`), contrastado por un riel de navegación lateral flotante oscuro (`#1d1f22`) y tarjetas bento translúcidas con desenfoque de fondo (`backdrop-filter: blur(16px)`).

El sistema rechaza la saturación ruidosa de los paneles SaaS genéricos, los bordes duros de alto contraste y los fondos oscuros pesados en el área de trabajo principal. En su lugar, utiliza luces y sombras suaves combinadas para sugerir volumen suave, mientras que los estados de servicio se codifican mediante tonos pastel distintivos acompañados siempre de texto oscuro de alto contraste conforme a WCAG AA.

**Key Characteristics:**
- Riel lateral flotante oscuro en píldora con iconos de trazo refinado (1.75px) y panel interior textual desplegado.
- Contenedores principales con radio generoso (2rem / 32px), bordes translúcidos (`rgba(255, 255, 255, 0.6)`) y sombras neumorfas duales.
- Tipografía Bricolage Grotesque en titulares con peso ligero, balanceada con DM Sans para datos y controles.
- Semáforo pastel unificado para disponibilidad de mesas y estados de órdenes.

## Colors

Paleta calmada de baja saturación con acentos funcionales de alto contraste y sombras balanceadas en luz y penumbra.

### Primary
- **Slate Indigo** (`#5c6784`): Color de acción principal para botones confirmatorios, botones de acción primaria y estados activos de control.
- **Slate Indigo Deep** (`#4a536b`): Estado hover y activo de botones primarios.

### Secondary
- **Muted Cyan Ice** (`#a5b9c6`): Acento informativo, selección activa en el riel de navegación y elementos destacados no críticos.
- **Obsidian Rail** (`#1d1f22`): Fondo del riel lateral flotante de navegación; ancla la mirada en el lateral izquierdo.

### Neutral
- **Suite Canvas Neutral** (`#d0d3d6`): Fondo general de la aplicación en escritorio/tableta.
- **Bento Panel Translucent** (`rgba(224, 227, 229, 0.5)`): Superficie del contenedor principal con desenfoque.
- **Card Frost White** (`rgba(255, 255, 255, 0.65)`): Superficie de tarjetas bento individuales.
- **Charcoal Text** (`#3a3c3e`): Texto principal de lectura y encabezados.
- **Muted Slate Text** (`#666666`): Metadatos, etiquetas secundarias e indicadores auxiliares.
- **Translucent Border** (`rgba(255, 255, 255, 0.6)`): Delimitación sutil de contenedores y tarjetas.

### Semantic Status (Mesas y Órdenes)
- **Pastel Sage** (`#8fbf95`) con texto **Dark Forest** (`#527a55`): Mesa disponible / orden despachada.
- **Pastel Amber** (`#dcc98a`) con texto **Dark Ochre** (`#8a6b32`): Mesa reservada / llamada de servicio / orden en preparación.
- **Pastel Crimson** (`#e0a6a6`) con texto **Dark Maroon** (`#7a3030`): Mesa ocupada / orden retrasada / acción destructiva.

### Named Rules
**The Pastel-Dark Pairing Rule.** Todo chip o indicador con fondo pastel debe utilizar estrictamente su correspondiente color de texto oscuro asociado para garantizar un ratio de contraste de al menos 4.5:1 (WCAG AA). Nunca se usa texto blanco sobre fondos pastel.

## Typography

**Display Font:** Bricolage Grotesque, sans-serif
**Body Font:** DM Sans, sans-serif
**Label Font:** DM Sans, sans-serif

**Character:** Contraste tipográfico entre el carácter editorial moderno y ligero de Bricolage Grotesque en titulares, y la neutralidad geométrica altamente legible de DM Sans para métricas, tablas y formularios.

### Hierarchy
- **Display** (Light 300, clamp(2rem, 5vw, 3rem), 1.1): Pantallas de bienvenida y titulares de vista principal.
- **Headline** (Regular 400, 1.75rem, 1.2): Títulos de sección en el panel interior y encabezados de tarjeta mayor.
- **Title** (Medium 500, 1.25rem, 1.3): Títulos de módulos bento, nombres de mesa y categorías.
- **Body** (Regular 400, 0.9375rem, 1.5): Texto estándar de lectura, descripciones y datos operativos.
- **Label** (Medium 500, 0.8125rem, letter-spacing 0.02em): Chips de estado, etiquetas de campo y botones.

## Layout

Estructura fija en dos niveles en resoluciones amplias:
1. **Sidebar Rail flotante**: ancho fijo de 4.5rem (72px) con píldora oscura centrada y espaciada.
2. **Panel interior de sección**: ancho de 280px con lista de módulos y controles de tenant.
3. **Área de trabajo Bento**: grid responsivo con tarjetas de aspecto limpio, espaciado uniforme de 16px (`--bento-grid-gap`) y márgenes exteriores de 24px.
4. **Comportamiento adaptativo**: en pantallas con ancho menor o igual a 1024px, el panel interior de 280px colapsa para preservar el área de trabajo y el rail permanece accesible.

## Elevation & Depth

La profundidad se expresa mediante neumorfismo translúcido suave. Cada tarjeta bento combina una sombra cálida difusa en la esquina inferior derecha con un reflejo de luz blanca suave en la esquina superior izquierda.

### Shadow Vocabulary
- **Neumorphic Card Shadow** (`4px 6px 30px rgba(150, 155, 160, 0.2), -4px -4px 20px rgba(255, 255, 255, 0.8)`): Aplicada a tarjetas y paneles flotantes principales.
- **Floating Rail Shadow** (`0 8px 32px rgba(0, 0, 0, 0.25)`): Sombra profunda que levanta el rail oscuro sobre el fondo claro.

### Named Rules
**The Soft-Depth Rule.** No se admiten sombras negras opacas con offset duro (`4px 4px 0 #000`) ni degradados estridentes. La profundidad surge de la interacción sutil entre la luz blanca superior y la sombra neutra inferior.

## Shapes

- **Contenedores y Tarjetas Principales**: Radio generoso de 2rem (32px, `--bento-card-radius`).
- **Submódulos y Paneles Internos**: Radio de 1.5rem (24px, `--bento-inner-radius`).
- **Botones, Chips y Pastillas**: Radio infinito de 9999px (`--bento-pill-radius`).
- **Bordes**: 1px continuo translúcido (`rgba(255, 255, 255, 0.6)`).

## Components

### Buttons
- **Shape:** Píldora redondeada (radius 9999px).
- **Primary:** Fondo `#5c6784`, texto `#ffffff`, padding 12px 24px, altura mínima 44px.
- **Hover / Focus:** Transición suave a `#4a536b`, anillo de foco exterior `2px solid #5c6784`.
- **Secondary / Ghost:** Fondo translúcido o transparente con borde 1px y texto `#3a3c3e`.

### Chips
- **Style:** Píldoras compactas (padding 6px 14px) en colores pastel semánticos (`#8fbf95`, `#dcc98a`, `#e0a6a6`).
- **State:** Texto de alto contraste asociado; variantes para disponibilidad de mesa, llamado de mesero y SLA de comanda.

### Cards / Containers
- **Corner Style:** 2rem (32px) en tarjetas exteriores, 1.5rem (24px) en modulares interiores.
- **Background:** `rgba(255, 255, 255, 0.65)` con `backdrop-filter: blur(16px)`.
- **Shadow Strategy:** Neumorphic dual shadow.
- **Internal Padding:** 24px estándar.

### Inputs / Fields
- **Style:** Fondo `#ffffff` con borde sutil `1px solid rgba(0,0,0,0.1)`, radio 12px, altura mínima de 44px (`var(--bento-touch-target)`).
- **Focus:** Borde acentuado con `#5c6784` y sombra difusa suave.

### Navigation
- **Riel Flotante:** Píldora vertical oscura `#1d1f22`, iconos SVG con trazo `strokeWidth={1.75}` y `fill="none"`.
- **Item Activo:** Fondo `#a5b9c6` al 20% con icono `#a5b9c6`.
- **Item Inactivo:** Icono `#6b7280` con transición a blanco en hover.

## Do's and Don'ts

### Do:
- **Do** respetar escrupulosamente los tokens CSS `--bento-*` en todo nuevo componente.
- **Do** mantener el tamaño mínimo táctil de 44px en botones, inputs y áreas clickeables.
- **Do** verificar que los chips de estado pastel siempre incluyan su color de texto oscuro asociado.
- **Do** usar formato entero sin decimales para toda cifra en COP (`formatCOP`).

### Don't:
- **Don't** escribir códigos hexadecimales directos en archivos `.tsx` o `.css` (evita violar `pnpm check:a4`).
- **Don't** usar texto blanco sobre fondos pastel.
- **Don't** aplicar sombras duras de bloque (`neobrutalismo`) o bordes de color grueso.
- **Don't** cargar familias tipográficas ajenas a Bricolage Grotesque y DM Sans.
- **Don't** modificar contratos ni servicios de backend para resolver necesidades cosméticas.
