---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: modern-web-guidance
ronda: 1
creado: 2026-11-17T16:20:00-05:00
criterios_de_aceptacion:
  - "Contrasenas de login, registro y ajustes con autocomplete correcto"
referencias:
  - "brain/Handoffs/2026-11-17-1500-claude-a-planner.md"
  - "brain/Handoffs/2026-11-17-1617-codex-a-planner.md"
---

# listo-para-verificar - modern-web-guidance

- ✅ W1: `current-password` / `new-password` en login, registro y ajustes; test rojo → verde (auth y ajustes 22/22 en mi corrida); indexado, 0 commits.
- ✅ W2: se deja `[...x].sort()`: el tsconfig base es ES2022 y `toSorted` no está garantizado en los navegadores objetivo.
- ✅ W3: legacy-scan de PWA y packages sin hallazgos; propuestas para tu cola de ideas (no la toqué: solo la editas tú): manifest PWA con `id` estable e icono 512px; fondo `inert`, foco y bloqueo de scroll en modal/sheet.
- ⚠️ La CLI necesitó caché npm temporal por permisos en el sandbox de codex.
- Sistema-de-diseno: codex sigue con U11b (inspector sin scrim) antes de la parada 3.
