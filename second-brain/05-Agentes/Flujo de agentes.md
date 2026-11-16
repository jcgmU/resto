---
tags: [agentes, herdr]
---
# Flujo de agentes

Se trabaja sobre Herdr (workspace `w3`). Roles definidos en `CLAUDE.md` del repo:
- **Claude (Orquestador):** verifica de forma independiente, actualiza docs.
- **Kimi (Planificador):** manifiestos y planes por oleada, sin código.
- **Agy (Ejecutor TDD):** rojo-verde, máx. 3 intentos por test.

## Comandos útiles
- `herdr agent list` — agentes vivos y estado
- `herdr agent prompt <pane> "..." --wait` — delegar (usar esto, no `pane run`: un prompt a un agente ocupado se perdió una vez)
- `herdr agent read <pane> --source recent-unwrapped --lines 80`

## Config
- Kimi: `~/.kimi-code/config.toml` (`api_key` de `moonshot-ai`). La key se rotó el 2026-10-10; no guardarla aquí.
