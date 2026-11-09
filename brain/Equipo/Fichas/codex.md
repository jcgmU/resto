---
agente: codex
tipo: Codex CLI (OpenAI)
version: 0.164.0
modelo: gpt-6.1-sol (configuración local comprobada), reasoning effort high
estado: completa por codex — pendiente de verificación del orquestador
---

# Ficha de capacidades — codex

> **RETIRADO el 2026-10-27.** El usuario sustituyó a Codex por `planner` (sesión de Claude Code). Esta ficha se conserva solo como historial; ver `Fichas/planner.md`.

> Completada el 2026-10-26 mediante herramientas de esta sesión. La configuración local no demuestra por sí sola qué modelo atiende una petición; no tengo introspección independiente del modelo servidor. Se conserva debajo la evidencia previa de claude y se distinguen las comprobaciones actuales.

## Datos verificados por claude
- Binario: `/Users/jcgm/.local/bin/codex`, `codex-cli 0.164.0`, sesión iniciada con ChatGPT.
- Modelos en su caché local: gpt-6.1-sol (activo), gpt-6-astra, gpt-6.1-terra, gpt-6-sol, gpt-6-luna, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, codex-auto-review. Los nombres de cada nivel (potente/estándar/ligero) son **[por completar]**.
- Proyecto marcado como `trusted` en `~/.codex/config.toml`.
- Lee `AGENTS.md` del repo.
- MCP: `engram` registrado por claude (`engram mcp --tools=agent`, `ENGRAM_PROJECT=resto`). Verificar que carga.
- Skills compartidas: `~/.agents/skills/` (incluye `herdr`, `spec-writer` y skills de diseño). Corrección de onboarding: `graphify` no figura en el catálogo expuesto ni se encontró su `SKILL.md` en `~/.agents/skills/` o `~/.codex/skills/`; la inclusión inicial era un dato no confirmado.
- Permisos: se arranca con `-s workspace-write -a never` (sin pedir aprobación, pero con sandbox: solo escribe dentro del proyecto). El usuario descartó el bypass total por el riesgo de borrados. Regla adicional en `AGENTS.md`: confirmar con el usuario antes de cualquier acción destructiva.

## Herramientas propias
- Terminal zsh en macOS con `exec_command` y sesiones mediante `write_stdin`; lectura y búsqueda con comandos, edición mediante `apply_patch`.
- Orquestación de herramientas con `functions.exec` (JavaScript) y herramientas diferidas expuestas en `ALL_TOOLS`.
- Consulta web `web__run`, lectura de imágenes `view_image` y generación `image_gen__imagegen`. No se ha verificado un navegador interactivo para recorridos de UI.
- Preguntas de texto `request_user_input_async`; herramientas de hora y espera. `request_user_input` no se usa en el modo Default actual.
- Mi rol permite investigar, documentar y revisar; no escribir código de producción.

## Subagentes y modo multi-agente
- Sí: `collaboration.spawn_agent({task_name, message, fork_turns, model, reasoning_effort})`; administración con `send_message`, `followup_task`, `interrupt_agent`, `list_agents`, `wait_agent`.
- Capacidad expuesta: 4 agentes activos contando al coordinador, hasta 3 hijos simultáneos si no hay otros agentes activos. Todos comparten archivos: repartir rutas y evitar ediciones concurrentes.
- `fork_turns: "all"` hereda contexto, modelo y esfuerzo; no admite overrides. Con `fork_turns: "none"` el encargo debe ser autocontenido y admite `model` y `reasoning_effort`.
- Solo delego cuando lo autorizan el usuario o las instrucciones aplicables. Este proyecto lo exige. La selección por nivel se autoriza en el Protocolo.
- Prueba real de onboarding: subagente `auditoria_onboarding`, modelo solicitado `gpt-6-luna`, esfuerzo `low`, contexto propio; completó revisión documental de solo lectura.

## Modelos disponibles y cómo elegirlos

Los siguientes identificadores están expuestos por `collaboration.spawn_agent`; no se deducen de la caché ni garantizan acceso fuera de esta sesión.

| Nivel | Modelo propuesto para subagentes | Selección |
|---|---|---|
| potente | `gpt-6-astra` | `fork_turns: "none", model: "gpt-6-astra", reasoning_effort: "high"`; arquitectura y riesgos complejos |
| estándar | `gpt-6.1-sol` | `fork_turns: "none", model: "gpt-6.1-sol", reasoning_effort: "medium"`; investigación y revisión acotadas |
| ligero | `gpt-6-luna` | `fork_turns: "none", model: "gpt-6-luna", reasoning_effort: "low"`; búsquedas y documentación simple |

También se exponen `gpt-6.1-terra` y `gpt-6-sol`. El principal está configurado como `gpt-6.1-sol` con esfuerzo `high` (lectura de las dos claves en `~/.codex/config.toml`); no cambié la configuración. No afirmo que los modelos 5.6 de la caché sean seleccionables por estas herramientas.

## Comandos `/`
No tengo un inventario verificable de los comandos slash del TUI ni una herramienta para ejecutarlos. Las skills se aplican leyendo su `SKILL.md`; esto no demuestra que exista un comando slash de igual nombre. Para Herdr se verificaron `herdr --help`, `herdr agent`, `herdr --version` (0.8.0).

## Skills visibles

Catálogo expuesto en esta sesión (disponibilidad no implica lectura ni uso):

- En `~/.codex/skills/.system/`: `imagegen`, `openai-docs`, `skill-creator`, `skill-installer`.
- En `~/.agents/skills/`: `animation-vocabulary`, `apple-design`, `brandkit`, `captions-overlay`, `changelog-video`, `cut-the-curve`, `design-taste-frontend`, `design-taste-frontend-v1`, `embedded-captions`, `emil-design-eng`, `faceless-explainer`, `figma`, `find-animation-opportunities`, `find-skills`, `full-output-enforcement`, `general-video`, `gpt-taste`, `herdr`, `high-end-visual-design`, `hyperframes`, `hyperframes-animation`, `hyperframes-cli`, `hyperframes-core`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-registry`, `image-to-code`, `imagegen-frontend-mobile`, `imagegen-frontend-web`, `improve-animations`, `industrial-brutalist-ui`, `media-use`, `minimalist-ui`, `motion-doctrine`, `motion-graphics`, `music-to-video`, `oversized-cursor`, `pick-ui-library`, `pr-to-video`, `product-launch-video`, `redesign-existing-projects`, `remotion-to-hyperframes`, `review-animations`, `seam-craft`, `slideshow`, `spec-writer`, `stitch-design-taste`, `talking-head-recut`.
- Plugins en `~/.codex/plugins/cache/openai-curated-remote/`: `plugin-management:plugin-management` (0.1.0), `sites:sites`, `sites:sites-remix` (1.1.2), `work-pets:create-pet`, `work-pets:pets`, `work-pets:update-pet` (0.1.6).
- `herdr` leído y `spec-writer` localizado. `graphify` ausente del catálogo y de las dos raíces de skills revisadas; no instalado por mí.

## Plugins y MCP
- Engram sí, vía herramientas `mcp__engram__*`: `mem_capture_passive`, `mem_compare`, `mem_context`, `mem_current_project`, `mem_doctor`, `mem_get_observation`, `mem_judge`, `mem_pin`, `mem_review`, `mem_save`, `mem_save_prompt`, `mem_search`, `mem_session_end`, `mem_session_start`, `mem_session_summary`, `mem_suggest_topic_key`, `mem_unpin`, `mem_update`.
- `mem_context(project: "resto")` inicialmente devolvió `unknown_project`; `mem_current_project` detectó `resto` y `mem_session_start` con el directorio del repo creó la sesión `resto-codex-onboarding-2026-10-26`. Después `mem_save(project: "resto")` guardó la memoria de arranque ID 30, `judgment_required: false`. No consulté ni guardé contenido en otros proyectos.
- Hay herramientas de `mcp__codex_apps` y `mcp__codex_tui`; el catálogo incluye skills de Sites, Work Pets y gestión de plugins. No se ha comprobado autenticación o funcionamiento de esos servicios.

## Límites
- Sandbox `workspace-write`, aprobaciones `never`, red restringida; escritura permitida en el repo y temporales autorizados. No solicitar ni intentar elevación desde shell.
- `HERDR_ENV=1` comprobado, pero `herdr agent list` devuelve `PermissionDenied: Operation not permitted`. No se verificó detección de agentes ni se puede garantizar entrega desde aquí. No se elude el sandbox.
- No borro, muevo o sobrescribo trabajo existente; cambios documentales de este onboarding son los autorizados. Sin commit ni push.
- TDD rojo antes de lógica, máximo 3 intentos por test. Al revisar una ejecución correré personalmente tests y build; informes ajenos no equivalen a verificación propia.
- Build completo: `pnpm --filter "./packages/*" --filter "./apps/*" --filter "./services/*" -r run build`. Coordinar `next dev` antes; borrar `.next` requiere confirmación expresa por ser destructivo.
- Solo claude modifica `01_Arquitectura/`, `02_Dominio/` y `03_Oleadas/`.

## Cómo prefiero recibir trabajo
Archivo completo en `brain/Handoffs/`, frontmatter del Protocolo, hilo y ronda, objetivo, referencias, restricciones, criterios verificables y devolución esperada. Recibo `objetivo`/`hallazgos`; preparo `plan` para agy con unidades, dependencias, oleadas, modo exacto (`self` según su ficha) y nivel. Reviso `ejecucion` con diff/tests/build; envío nueva ronda si falla o `listo-para-verificar` a claude. Actualizo `Verificacion.md` y checkpoint; memoria siempre en `resto`. El tipo `ejecucion` hacia claude se usa aquí solo por la excepción explícita del onboarding.

## Verificación del orquestador

| Dato | Declarado | Verificado |
|---|---|---|
| Versión | 0.164.0 | ✅ `codex --version` |
| Detección en Herdr | codex | ⚠ pendiente por `Operation not permitted` en `herdr agent list` |
| Engram | herramientas listadas; memoria 30 guardada en resto | ⚠ comprobación propia de codex; falta verificación independiente de claude |
| Skills visibles | catálogo completo arriba; graphify no visible | ⚠ comprobación propia de codex; falta verificación independiente de claude |
| Subagentes | 4 plazas incluyendo coordinador; revisión ligera completada | ⚠ comprobación propia de codex; falta verificación independiente de claude |
