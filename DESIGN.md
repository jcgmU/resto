---
name: Restaurante OS - Design System
description: Sistema operativo de restaurante con estética Suite neumorfa pastel
colors:
  primary: "#5c6784"
  primary-hover: "#4a536b"
  page-bg-admin: "#d0d3d6"
  page-bg-pwa: "#f2f4f5"
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

# Design System: Restaurante OS

## Overview

**Creative North Star: "La Suite Neumorfa"**

Restaurante OS implementa la línea "Suite", un lenguaje visual unificado para la operación gastronómica en tiempo real. Combina una base neumorfa pastel serena sobre fondos neutrales cálidos (`#d0d3d6` en Admin, `#f2f4f5` en PWA), riel lateral flotante oscuro (`#1d1f22`) y tarjetas bento translúcidas con desenfoque (`backdrop-filter: blur(16px)`).

El sistema rechaza la saturación ruidosa de los paneles SaaS genéricos, los bordes duros de alto contraste y los fondos oscuros pesados en el área de trabajo principal. En su lugar, utiliza luces y sombras suaves combinadas para sugerir volumen suave, mientras que los estados de servicio se codifican mediante tonos pastel distintivos acompañados siempre de texto oscuro de alto contraste conforme a WCAG AA.

**Key Characteristics:**
- Riel lateral flotante oscuro en píldora con iconos de trazo refinado (1.75px) y panel interior textual desplegado en escritorio.
- Contenedores principales con radio generoso (2rem / 32px), bordes translúcidos (`rgba(255, 255, 255, 0.6)`) y sombras neumorfas duales.
- Tipografía Bricolage Grotesque en titulares con peso ligero, balanceada con DM Sans para datos y controles.
- Semáforo pastel unificado para disponibilidad de mesas y estados de órdenes.

## Colors

Paleta calmada de baja saturación con acentos funcionales de alto contraste y sombras balanceadas en luz y penumbra.

### Primary
- **Slate Indigo** (`#5c6784`): Acción principal y acento interactivo.
- **Slate Indigo Deep** (`#4a536b`): Estado hover y activo.

### Secondary
- **Muted Cyan Ice** (`#a5b9c6`): Acento informativo y selección activa en riel.
- **Obsidian Rail** (`#1d1f22`): Fondo del riel lateral flotante.

### Neutral
- **Suite Canvas Neutral** (`#d0d3d6`): Fondo en Admin Dashboard.
- **Mobile Canvas Light** (`#f2f4f5`): Fondo en Client PWA.
- **Card Frost White** (`rgba(255, 255, 255, 0.65)`): Superficie de tarjetas bento.
- **Charcoal Text** (`#3a3c3e`): Texto principal de lectura y encabezados.
- **Muted Slate Text** (`#666666`): Metadatos y etiquetas secundarias.
- **Translucent Border** (`rgba(255, 255, 255, 0.6)`): Delimitación sutil de contenedores y tarjetas.

### Semantic Status
- **Pastel Sage** (`#8fbf95`) con texto **Dark Forest** (`#527a55`): Libre / despachado.
- **Pastel Amber** (`#dcc98a`) con texto **Dark Ochre** (`#8a6b32`): Reservada / comanda en preparación.
- **Pastel Crimson** (`#e0a6a6`) con texto **Dark Maroon** (`#7a3030`): Ocupada / comanda demorada.

### Named Rules
**The Pastel-Dark Pairing Rule.** Todo chip o indicador con fondo pastel debe utilizar estrictamente su correspondiente color de texto oscuro asociado para garantizar un ratio de contraste de al menos 4.5:1 (WCAG AA).

## Typography

**Display Font:** Bricolage Grotesque, sans-serif
**Body Font:** DM Sans, sans-serif

### Hierarchy
- **Display** (Light 300, clamp(2rem, 5vw, 3rem), 1.1): Pantallas de bienvenida y titulares.
- **Headline** (Regular 400, 1.75rem, 1.2): Encabezados de sección.
- **Title** (Medium 500, 1.25rem, 1.3): Títulos de tarjetas y nombres de mesa.
- **Body** (Regular 400, 0.9375rem, 1.5): Texto estándar de lectura y datos.
- **Label** (Medium 500, 0.8125rem, letter-spacing 0.02em): Chips de estado y botones.

## Layout

- **Admin**: Riel lateral flotante 4.5rem, panel interior 280px (colapsa en <=1024px), grilla bento responsiva con espaciado 16px.
- **PWA**: Columna única móvil con carrusel de categorías superior, botón flotante CartFab y soporte táctil ergonómico.

## Elevation & Depth

Neumorfismo translúcido suave con reflejo superior y sombra inferior.
- **Neumorphic Card Shadow** (`4px 6px 30px rgba(150, 155, 160, 0.2), -4px -4px 20px rgba(255, 255, 255, 0.8)`).
- **Floating Rail Shadow** (`0 8px 32px rgba(0, 0, 0, 0.25)`).

## Shapes

- Contenedores exteriores: 2rem (32px, `--bento-card-radius`).
- Módulos interiores: 1.5rem (24px, `--bento-inner-radius`).
- Botones y pastillas: 9999px (`--bento-pill-radius`).

## Components

### Buttons
- Píldora redondeada (9999px), altura mínima 44px, contraste ≥4.5:1.

### Chips
- Fondo pastel semántico con texto oscuro asociado y padding 6px 14px.

### Cards
- Fondo `rgba(255, 255, 255, 0.65)` con desenfoque de 16px y borde translúcido de 1px.

### Inputs
- Fondo blanco sólido, altura mínima 44px (`var(--bento-touch-target)`).

## Do's and Don'ts

### Do:
- **Do** usar siempre los tokens CSS `--bento-*`.
- **Do** garantizar altura táctil mínima de 44px en todo control interactivo.
- **Do** formatear dinero en COP entero sin decimales (`formatCOP`).

### Don't:
- **Don't** escribir códigos hexadecimales directos en archivos de vista.
- **Don't** colocar texto blanco sobre fondos pastel.
- **Don't** usar sombras duras o bordes pesados.
