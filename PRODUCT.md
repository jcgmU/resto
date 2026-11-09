# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dueños, gerentes y encargados de sala de restaurantes y bares comparten el panel admin (`apps/admin-dashboard`). Usan el dashboard (pantalla de inicio) tanto para revisar cómo va el turno como para atender lo urgente. Roles: ADMIN/MANAGER gestionan; STAFF ve con acciones limitadas. Dispositivo: laptop y tablet en el local.

Otras audiencias, fuera del dashboard: cocina y meseros (KDS en el mismo panel) y el cliente en la mesa (PWA mobile first por QR, sin crear cuenta).

## Product Purpose

SaaS B2B2C multi-tenant para restaurantes y bares. El cliente escanea un QR en la mesa, ve el menú, arma un pedido en carrito colaborativo y pide la cuenta. El restaurante gestiona carta, mesas, cocina (KDS), llamadas de mesa y cobro desde el panel, en tiempo real. Éxito: el restaurante opera el servicio sin papel ni intermediarios y el cliente pide sin fricción.

## Positioning

Dos cosas juntas que un competidor tendría que copiar a la vez: pedido por QR sin cuenta ni instalación para el cliente, y operación en vivo para el restaurante (mesa, cocina, llamadas y cobro conectados en un solo panel).

## Operating Context

Servicio de sala con mesas numeradas, cocina que avanza pedidos por estados, llamadas al mesero ("Pedir la cuenta") y cobro que cierra la sesión y libera la mesa. El panel se mira de reojo durante el turno. Los datos se actualizan por sondeo cada 5 s en dashboard y mesas; el KDS usa sockets.

## Capabilities and Constraints

- Mesas: crear, editar y eliminar en lote o una a una; baja lógica; QR por mesa; una mesa pasa a ocupada al escanear el QR.
- Pedidos y estados: PLACED, IN_KITCHEN, READY y siguientes; el dashboard cuenta pedidos activos y mesas con sesión activa.
- Llamadas de servicio pendientes se muestran como alertas.
- Ventas del día y ticket promedio no existen todavía (sin datos ni flag `analytics`); no deben fabricarse cifras.
- La interfaz está en español; no se muestran enums crudos (`IN_KITCHEN`, `CASH`) ni ids de mesa.
- Funcionalidad fuera de la oleada en curso va tras `<FeatureGuard>` con placeholder "Próximamente"; no se deja UI rota ni a medias.
- Decisión abierta: el usuario quiere un diseño de dashboard que "se adecue al sistema orientado a restaurantes"; no confirmó restricciones visuales duras.

## Brand Commitments

Nombre del producto: RESTAURANTE-OS. Interfaz en español. La línea visual actual (Lima & Tinta, Bento Box, documentada en `01_Arquitectura/UI_UX_Guidelines.md`) es el estado vigente, no una restricción confirmada para el rediseño del dashboard: al usuario no le gusta el dashboard actual.

## Evidence on Hand

- Documentación de producto en `README.md`, `CLAUDE.md` y `01_Arquitectura/`.
- Datos de demostración sembrados: restaurante "Demo Prueba" con catálogo, personal, mesas y pedidos de ejemplo (no son datos reales).
- Ausencias: no hay métricas de ventas, testimonios ni clientes reales; no inventarlos.

## Product Principles

1. Lo urgente primero: lo que requiere acción inmediata (llamadas, cuentas, pedidos atrasados) se ve antes que los totales.
2. Solo datos reales: lo que no existe se omite o va como "Próximamente".
3. Legible de reojo, de pie y a distancia, en laptop y tablet.
4. Lenguaje de restaurante: mesas, cuenta, cocina, turno; nunca vocabulario técnico.
5. El cliente nunca necesita una cuenta; el panel nunca necesita una explicación.

## Accessibility & Inclusion

Sin estándar formal confirmado. Contraste legible, estado nunca solo por color, objetivos táctiles cómodos en tablet.
