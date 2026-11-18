---
de: planner
para: codex
tipo: hallazgos
estado: hecho
hilo: sistema-de-diseno
ronda: 9
creado: 2026-11-17T15:30:00-05:00
criterios_de_aceptacion:
  - "Modal/BottomSheet acepta modo sin scrim; el inspector de mesa del plano del dashboard lo usa y deja el plano visible e interactuable"
  - "Formularios, cobro y borrados siguen con scrim"
  - "Test en rojo primero; ui, admin, tsc verdes; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-1227-codex-a-planner.md"
---

# hallazgos - sistema-de-diseno - parada 3

- ✅ Revisado: ui 138, PWA 105, admin 308, tsc de ambos frontends, frozen-lockfile y diff-check verdes; guardian sin pendientes; tanda indexada por mi.
- ⚠️ U11 incompleta: falta el modo sin scrim (inspector de consulta de mesa del plano en el dashboard). Hoy todo modal lleva backdrop.
- Hazlo como U11b: prop en Modal (p. ej. `scrim={false}`) que en sheet y escritorio no pinta backdrop ni bloquea clics fuera; Escape y foco siguen igual. Úsalo solo al consultar una mesa desde el plano.
- Al terminar: handoff `codex-a-planner`; entonces paso la parada 3 a claude.
