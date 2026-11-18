---
de: planner
para: codex
tipo: plan
estado: hecho
hilo: sistema-de-diseno
ronda: 3
creado: 2026-11-17T10:18:00
criterios_de_aceptacion:
  - "Test guardián de diseño en verde sin pendientes de admin"
  - "Admin migrado a StatusCard, Modal, Button, Avatar y AvailabilityToggle (puntos L1, L2, L3, L4, L5, L7, L8 y L9)"
  - "identity compila y pasa entero (test de login sin STAFF)"
  - "Batería de U9 con números de la salida; 0 commits"
referencias:
  - "brain/Handoffs/2026-11-16-2021-planner-a-executor.md (plan completo: unidades U8 a U12)"
  - "brain/Handoffs/2026-11-16-2019-claude-a-planner.md (lista L1 a L10 y capturas)"
  - "brain/Handoffs/2026-11-16-2200-executor-a-planner.md (lo que dejó hecho el ejecutor anterior)"
---

# plan - sistema-de-diseno - ronda 3 (codex continúa)

Bienvenido. Lee `brain/Equipo/Protocolo.md`, crea tu ficha en `brain/Equipo/Fichas/codex.md` desde `_plantilla-ficha.md` y luego los tres handoffs de referencias.

Worktree `/Users/jcgm/Developer/Resto-integracion`, rama `feat/roles-y-monitor`. Hay cambios sin commit del ejecutor anterior (U6, U7 y el inicio de U8): son tu base, no los descartes.

Revisé U6 y U7: ✅ bien.

| Unidad | Oleada | Qué hace | Depende de | Subagente / modo del ejecutor | Nivel de modelo | Criterio de aceptación |
|---|---|---|---|---|---|---|
| U8a | 1 | `services/identity/test/unit/login_status_atomic.test.ts` usa `'STAFF'` (líneas 24 y 61), que ya no es un rol: cámbialo a `'WAITER'` | — | `self` | ligero | identity entero verde |
| U8 | 1 | Terminar la migración del admin. Hecho ya: `ChangePasswordModal` usa `Modal`. Falta: modales de `ajustes`, `dashboard`, `menu`, `checkout` y los 6 de mesas; `StatusCard` en Mesas Ocupadas y en las cards de mesa (sin punto ni badge, sin información repetida); quitar los tres puntos de `PanelShell`; `AvailabilityToggle` en las cards de platos (sin badge «Disponible»); `Avatar` en Gestión de Zonas; botones de cards con `Button`; puntos de estado de `meseros` (el guardián no los detecta) | U8a | `self` | potente | Pendientes de admin fuera de la lista del guardián y guardián verde |
| U9 | 2 | Tablero de cocina y bar: tarjetas con `StatusCard` en variante de progreso; quitar tiempo repetido y «En vivo» | U8 | `self` | estándar | Tests del tablero verdes |
| Batería | 3 | Tests de ui-components, admin, pwa, identity (con `IDENTITY_DATABASE_URL=postgresql://postgres:postgres@localhost:5435/resto_identity_test?schema=public`); `tsc --noEmit` de admin; `pnpm check:a4`; `pnpm lint` | U9 | `self` | ligero | Números copiados de la salida |

## Reglas

- Rojo antes de verde. Rutas absolutas. Sin `stash`, `reset` ni `checkout --`.
- **Nunca `next build` de admin** (pisa el dev server de claude); usa `tsc --noEmit`.
- Docker: solo `resto-integ-test`; no toques `resto_postgres_data`, `resto_*` ni `devia-*`.
- Al terminar: `git add` por ruta de todo lo de esta tanda y lo del ejecutor anterior, salvo `tsconfig.tsbuildinfo` y lo de `generated/client`. 0 commits.
- **Parada 2** al terminar U9: handoff `ejecucion` breve (✅/⚠️) a `planner` y aviso por Herdr al pane `w3:pF`. Si te bloqueas o te quedas sin cuota, handoff parcial inmediato.
