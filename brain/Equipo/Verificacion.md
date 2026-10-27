# Chequeos de verificación — resto

> Los mantiene el planificador cuando el stack está decidido. Los ejecuta el orquestador él mismo (ver Protocolo).
> Base: 2026-10-11 por kimi (hilo frontend-lineagrafica, ronda 1). Corrección documental de A2: 2026-10-26 por codex durante onboarding; no implica reejecución ni aprobación de estos chequeos.

## Automáticos

| # | Chequeo | Comando (desde la raíz del proyecto) | Resultado esperado |
|---|---|---|---|
| A1 | Suite completa de tests (9 paquetes, Jest) | `pnpm -r run test` | exit 0. Base real previa al rediseño: **215/215** (38 suites). Tras el rediseño: todos en verde, incluidos los tests nuevos de UI. Nota: el handoff citaba 182/182; esa cifra está desactualizada (ver `03_Oleadas/Estado_MVP.md`: 213/213 tras ronda 7, +2 sin loguear). |
| A2 | Build completo (packages + apps + services) | `pnpm --filter "./packages/*" --filter "./apps/*" --filter "./services/*" -r run build` | exit 0. Los filtros van ANTES de `run build`; `pnpm run build` a secas solo compila `packages/*`. ts-jest no type-chequea todo: este build es obligatorio (precedente bug `OrderStatus`). Coordinar un `next dev` activo antes de compilar para evitar corromper `.next`; cualquier borrado requiere confirmación del usuario. |
| A3 | Tests del design system (tokens + bento + feature-guard) | `pnpm run test:ui` | exit 0. Los tests 39/40/44 de `packages/ui-components/test/bento.test.tsx` deben validar los valores **Lima & Tinta** (tinta `#0E100B`, lima `#D7F35C`, hueso `#ECEEE6`, papel `#FAFAF6`) y el contraste WCAG recalculado. |
| A4 | Sin clases Tailwind muertas ni hex fuera de tokens en el frontend | `grep -rnE "className=\"[^\"]*(p-|m-|grid|flex|bg-|text-)" apps/admin-dashboard/src apps/client-pwa/src --include="*.tsx"` y `grep -rnE "#[0-9a-fA-F]{6}" apps/admin-dashboard/src apps/client-pwa/src --include="*.tsx"` | Solo coincidencias justificadas: los 4 hex de la paleta en el archivo de tokens y ninguna clase de utilidad Tailwind (no hay toolchain Tailwind en el repo: esas clases son código muerto). |
| A5 | E2E HTTP de flujos reales (requiere stack Docker levantado: `docker compose -f docker-compose.dev.yml up -d` o equivalente) | `node e2e.mjs` | exit 0: register → login → menú → mesa/QR → sesión guest → carrito → confirmar pedido → KDS (IN_KITCHEN→READY→DELIVERED) → checkout CASH → cierre de sesión. Ningún flujo reemplazado por stubs. |
| A6 | ~~Smoke in-process de servicios~~ **RETIRADO (decision del planificador, 2026-10-11)** | `pnpm --filter @services/identity build && pnpm --filter @services/catalog build && node scripts/check-47-e2e.js` | Retirado: da 500 en register/login in-process por causa no atribuida a este hilo (`services/` y el script sin cambios; verificado por el orquestador en `brain/Verificaciones/2026-10-11-1905-verificacion.md`). A5 cubre el flujo real contra Docker. Si se repara el script en otro hilo, se reincorpora. |

## Manuales

| # | Chequeo | Cómo probarlo de verdad |
|---|---|---|
| M1 | Línea gráfica Lima & Tinta en las 17 vistas (9 Admin + 8 PWA) | Recorrer en Chrome cada vista de la lista confirmada en el plan (A1-A9, B1-B8). Todas usan tinta/lima/hueso/papel, Bricolage Grotesque + DM Sans, radios altos, sombras suaves; sin naranja `#EA580C`, ni rojo/dorado PWA viejo, ni azules `#2563eb` sueltos. Acentos solo en datos clave; cero elementos decorativos sin función (regla de `01_Arquitectura/UI_UX_Guidelines.md`). |
| M2 | Estados loading / empty / error / ok por vista | En cada vista: provocar carga lenta (throttling de red), lista vacía (tenant nuevo), error (gateway caído) y estado normal. Ninguna pantalla queda en blanco. |
| M3 | Breakpoints | Admin a 1440px y 1024px (sidebar colapsa); PWA a 375px y 390px landscape (targets táctiles ≥44px, safe-area respetada, sin scroll horizontal). |
| M4 | Flujo real admin de punta a punta | Con stack Docker: login → crear categoría/producto → crear mesa → ver QR → abrir KDS en otra pestaña → desde la PWA (M5) pedir → ver el pedido llegar al KDS en vivo (socket) → avanzar estados → pedir cuenta desde PWA → ver llamada de servicio en KDS → cobrar en `/checkout` con el modal de confirmación → mesa liberada. |
| M5 | Flujo real guest PWA | Escanear/abrir `/t/[tenantId]/[tableId]?k=...` → menú con categorías que filtran de verdad → detalle de producto con modificadores → carrito → confirmar pedido → vista de confirmación/seguimiento → pedir la cuenta. Verificar en consola que **no hay error de hidratación de React** (bug abierto de la ronda 6.1 que este hilo debe cerrar). |
| M6 | FeatureGuard / Próximamente | Con `NEXT_PUBLIC_FEATURE_FLAGS` sin `payments`/`analytics`/`kitchen-display`: las vistas fuera de alcance muestran `<Proximamente />` (no UI rota ni en blanco). Con los flags activos: las vistas funcionan. |
| M7 | Accesibilidad básica | Navegar cada vista solo con teclado (focus visible, orden lógico), contraste texto ≥4.5:1 (lima solo como fondo de chip con texto tinta), `prefers-reduced-motion` sin animaciones, una sola live region en KDS, modales con `role="dialog"` y foco gestionado. |
