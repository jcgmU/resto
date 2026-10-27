---
agente: codex
tipo: Codex CLI (OpenAI)
version: 0.164.0
modelo: gpt-6.1-sol (model en ~/.codex/config.toml), reasoning effort high
estado: borrador — pendiente de completar por codex y verificar por claude
---

# Ficha de capacidades — codex

> Borrador escrito por claude con lo que se pudo comprobar desde fuera. Codex debe completar las secciones marcadas **[por completar]** con sus capacidades reales y no inventar ninguna. Claude verifica el resultado.

## Datos verificados por claude
- Binario: `/Users/jcgm/.local/bin/codex`, `codex-cli 0.164.0`, sesión iniciada con ChatGPT.
- Modelos en su caché local: gpt-6.1-sol (activo), gpt-6-astra, gpt-6.1-terra, gpt-6-sol, gpt-6-luna, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, codex-auto-review. Los nombres de cada nivel (potente/estándar/ligero) son **[por completar]**.
- Proyecto marcado como `trusted` en `~/.codex/config.toml`.
- Lee `AGENTS.md` del repo.
- MCP: `engram` registrado por claude (`engram mcp --tools=agent`, `ENGRAM_PROJECT=resto`). Verificar que carga.
- Skills compartidas: `~/.agents/skills/` (incluye `herdr`, `spec-writer`, `graphify`, skills de diseño). El proyecto no tiene `.agents/skills/` local en esta máquina.
- Permisos: se arranca con `-s workspace-write -a never` (sin pedir aprobación, pero con sandbox: solo escribe dentro del proyecto). El usuario descartó el bypass total por el riesgo de borrados. Regla adicional en `AGENTS.md`: confirmar con el usuario antes de cualquier acción destructiva.

## Por completar por codex
- **Herramientas propias:** [por completar]
- **Subagentes / modo multi-agente:** ¿puede lanzar subagentes en paralelo? ¿con qué herramienta o comando exacto, y puede asignar modelo a cada uno? [por completar — si no puede, decirlo; el planificador debe diseñar planes para el ejecutor, pero necesita saber si él mismo puede paralelizar la investigación]
- **Niveles de modelo:** tabla potente / estándar / ligero con cómo se selecciona cada uno (flag, comando o parámetro). [por completar]
- **Comandos `/`:** [por completar]
- **Límites:** [por completar]
- **Cómo prefiere recibir trabajo:** [por completar]

## Verificación del orquestador

| Dato | Declarado | Verificado |
|---|---|---|
| Versión | 0.164.0 | ✅ `codex --version` |
| Detección en Herdr | codex | [pendiente: `herdr agent list` tras arrancarlo] |
| Engram | MCP registrado | [pendiente: comprobar que lista las herramientas] |
| Skills visibles | `~/.agents/skills` | [pendiente: que codex las liste] |
