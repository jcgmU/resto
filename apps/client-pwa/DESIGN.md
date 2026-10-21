---
name: Restaurante OS - Client PWA
description: Menú digital y autoservicio en mesa para comensales con estética Suite pastel
colors:
  primary: "#5c6784"
  primary-hover: "#4a536b"
  page-bg: "#f2f4f5"
  card-bg: "rgba(255, 255, 255, 0.65)"
  card-bg-solid: "#ffffff"
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
typography:
  display:
    fontFamily: "var(--font-bricolage, 'Bricolage Grotesque', sans-serif)"
    fontSize: "clamp(1.75rem, 6vw, 2.25rem)"
    fontWeight: 300
    lineHeight: 1.15
  headline:
    fontFamily: "var(--font-bricolage, 'Bricolage Grotesque', sans-serif)"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.25
  title:
    fontFamily: "var(--font-bricolage, 'Bricolage Grotesque', sans-serif)"
    fontSize: "1.125rem"
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
  card-product:
    backgroundColor: "{colors.card-bg}"
    rounded: "{rounded.inner}"
    padding: "16px"
  chip-category:
    backgroundColor: "{colors.card-bg-solid}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
---

# Design System: Restaurante OS - Client PWA

## Overview

**Creative North Star: "La Suite Neumorfa - Carta Digital"**

La PWA para comensales de Restaurante OS traslada la línea gráfica "Suite" al entorno móvil de mesa. Ofrece una experiencia acogedora, limpia y de lectura inmediata optimizada para smartphones (viewports 375px a 430px) sobre un fondo claro sutil (`#f2f4f5`).

El comensal accede al escanear el QR físico de su mesa y encuentra una interfaz táctil rápida y agradable, con tarjetas de producto bento translúcidas, píldoras de navegación de categorías con scroll horizontal fluido, y un botón flotante de carrito (CartFab) ergonómico ubicado fuera de la zona de pulgar inferior.

**Key Characteristics:**
- Fondo general suave `#f2f4f5` que no deslumbra bajo iluminación tenue de restaurante.
- Tarjetas de producto bento con radio de 1.5rem (24px) y elevación neumorfa sutil.
- Altura táctil mínima de 44px (`var(--bento-touch-target)`) en todos los controles interactivos, chips y campos.
- Valores monetarios presentados de forma clara en COP entero sin decimales.

## Colors

### Primary
- **Slate Indigo** (`#5c6784`): Acción principal para agregar al carrito, confirmar pedido y solicitar cuenta.
- **Slate Indigo Deep** (`#4a536b`): Estado activo y feedback táctil.

### Neutral
- **Mobile Canvas Light** (`#f2f4f5`): Fondo de la página móvil.
- **Card Frost White** (`rgba(255, 255, 255, 0.65)`): Superficie de tarjetas de producto y hojas inferiores (bottom sheets).
- **Surface Solid White** (`#ffffff`): Fondo de inputs, chips de categoría y controles de cantidad.
- **Charcoal Text** (`#3a3c3e`): Título de platos y precios.
- **Muted Text** (`#666666`): Descripciones de ingredientes y notas.

### Status & Feedback
- **Pastel Sage** (`#8fbf95`) con texto `#527a55`: Notificaciones de pedido confirmado y llamado de mesero en curso.
- **Pastel Amber** (`#dcc98a`) con texto `#8a6b32`: Cuenta solicitada y mesa en proceso de cierre.

## Typography

**Display / Heading Font:** Bricolage Grotesque, sans-serif
**Body / Controls Font:** DM Sans, sans-serif

### Hierarchy
- **Display** (Light 300, 2rem): Encabezado de bienvenida con número de mesa.
- **Headline** (Regular 400, 1.5rem): Nombre de categorías y títulos de modal.
- **Title** (Medium 500, 1.125rem): Nombre de productos en la lista y totales de compra.
- **Body** (Regular 400, 0.9375rem): Descripción de platos, notas de cocina y confirmaciones.
- **Label** (Medium 500, 0.8125rem): Chips de categoría, variantes y etiquetas nutricionales.

## Layout

- Diseñado primariamente para una sola columna fluida en viewports móviles (375px–430px).
- Riel superior o carrusel horizontal con chips de categoría con soporte táctil.
- Espaciado lateral de 16px con respeto estricto a las áreas seguras (`env(safe-area-inset-bottom)`).
- Barra fija inferior para llamado de mesero y botón flotante de carrito espaciado para evitar bloqueos.

## Elevation & Depth

- Tarjetas con sombra suave neumorfa: `4px 6px 30px rgba(150, 155, 160, 0.2), -4px -4px 20px rgba(255, 255, 255, 0.8)`.
- Modales deslizables (bottom sheets) con elevación pronunciada `0 -8px 32px rgba(0,0,0,0.12)`.

## Shapes

- Tarjetas de producto: 1.5rem (24px, `--bento-inner-radius`).
- Hojas modales inferiores: 2rem (32px) en esquinas superiores.
- Chips de categoría y botones: 9999px (`--bento-pill-radius`).

## Components

### Buttons
- Píldora de 9999px con altura mínima garantizada de 44px.
- Contraste superior a 4.5:1.

### Inputs & Textarea
- Campo de notas al mesero y especificaciones de cocina con altura mínima de 44px.
- Fondo blanco sólido con borde sutil translúcido.

### CartFab
- Botón flotante accesible de acción rápida con contador de ítems y total formateado en COP.

## Do's and Don'ts

### Do:
- **Do** garantizar que todo elemento clickeable o táctil mida al menos 44px de alto.
- **Do** formatear todos los precios con `formatCOP` sin decimales (ej. `$ 28.000`).
- **Do** respetar el área segura inferior del dispositivo móvil.

### Don't:
- **Don't** diseñar tarjetas con textos diminutos menores a 12px.
- **Don't** usar contenedores de iconos cuadrados apilados artificialmente sobre los títulos.
- **Don't** aplicar contrastes inferiores a WCAG AA en ningún badge de estado.
