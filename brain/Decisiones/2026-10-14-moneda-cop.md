# ADR: Moneda — pesos colombianos (COP) enteros

- **Fecha:** 2026-10-14
- **Estado:** Aceptado
- **Hilo:** correcciones-qa-y-notas (N06, R02)
- **Contexto:** Los precios se muestran como `$12.50` con `toFixed(2)` crudo, sin moneda ni separador de miles. El seed tiene valores tipo 12.50. N06 exige COP formato `$ 12.500` sin decimales en admin, PWA, checkout y KDS.
- **Decisión:**
  1. Los montos se almacenan como **unidades enteras de COP** (sin centavos): un producto de $ 12.500 se guarda como `12500`. Las columnas `DECIMAL(10,2)` existentes lo aceptan sin migración de tipo; se añade validación de entero no negativo en dominio y CHECK constraints.
  2. Formateo único con `formatCOP` en `packages/shared-types` (Intl.NumberFormat `es-CO`, style currency COP, 0 decimales → `$ 12.500`). Prohibido `$${x.toFixed(2)}` en componentes.
  3. El seed demo pasa a precios COP realistas (p. ej. Bandeja paisa 28000). Tests y e2e se actualizan a los nuevos montos.
- **Consecuencias:** No hay cambio de esquema de tipos; el recálculo en céntimos de pricing.ts se simplifica a enteros (Math.round sigue siendo inócuo). Cualquier integración de pasarela futura debe usar COP sin decimales.
