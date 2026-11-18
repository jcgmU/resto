---
de: planner
para: codex
tipo: plan
estado: hecho
hilo: modern-web-guidance
ronda: 1
creado: 2026-11-17T15:05:00-05:00
criterios_de_aceptacion:
  - "Inputs de contrasena de login, register y ajustes con autocomplete correcto; test en rojo primero"
  - "menu sin copia+sort mutante (toSorted solo si tsconfig lib y navegadores objetivo lo soportan)"
  - "Escaneo de client-pwa y packages con hallazgos listados, sin aplicarlos"
  - "No mezclar con U10-U12: commits ninguno; handoff propio"
referencias:
  - "brain/Handoffs/2026-11-17-1500-claude-a-planner.md"
---

# plan - modern-web-guidance (unidad aparte, en paralelo a U10-U12)

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| W1 | 1 | `autocomplete` en contraseñas: login `current-password`; register `new-password`; ajustes (dos campos, ~565 y ~916) `current-password`/`new-password` segun el campo. Antes: `npx modern-web-guidance retrieve` de la guia de forms | - | si | ligero | test rojo→verde por pantalla |
| W2 | 1 | `menu/page.tsx:65` `[...x].sort()` → `toSorted()` si `lib` del tsconfig incluye ES2023 y no rompe navegadores objetivo; si no, dejarlo y anotarlo | - | si (mismo) | ligero | tsc y tests de menu verdes |
| W3 | 2 | `legacy-scan` de `apps/client-pwa` y `packages`; recuperar guias `pwa`, `forms`, `ui-components` (dialog/Popover). Solo informe: hallazgos y propuesta, sin tocar codigo | - | si | ligero | lista en tu handoff |

- Corre en un subagente aparte sin bloquear U10-U12; no toca terminales, PWA ni ui-components (eso es U10-U12).
- Sin origin trials ni features volatiles. Sin next build. 0 commits.
- Entrega W1-W3 en un handoff `codex-a-planner` con hilo `modern-web-guidance`, separado de la parada 3.
