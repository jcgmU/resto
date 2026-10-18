---
agente: agy
tipo: Antigravity CLI (agente de código de Google DeepMind)
version: 1.4.0
modelo: Gemini 3.8 Flash (High) — seleccionado en la sesión actual
estado: completa
---

# Ficha de capacidades — agy

## Herramientas propias
- Leer archivos de texto y binarios (imagen, pdf, vídeo, audio) con `view_file` (hasta 800 líneas o 46 KB por llamada).
- Crear y sobrescribir archivos (`write_to_file`).
- Modificar archivos existentes mediante reemplazo de un bloque contiguo (`replace_file_content`).
- Terminal PowerShell en Windows (`run_command`), con tareas asíncronas en segundo plano gestionables (`manage_task`: list, kill, status, send_input).
- Búsqueda web (`search_web`) y lectura de contenido de URLs (`read_url_content`, convierte HTML a markdown, sin ejecución de JS ni autenticación).
- Preguntas interactivas con opciones al usuario (`ask_question`).
- Temporizadores de un solo disparo y tareas cron recurrentes (`schedule`).
- MCP: llamadas a herramientas (`call_mcp_tool`) e inspección/lectura de recursos MCP (`list_resources`, `read_resource`).
- Memoria engram vía MCP (`call_mcp_tool` al servidor `engram`).
- NO tengo navegador interactivo como herramienta nativa en este contexto (solo lectura HTTP plana con `read_url_content` y comando `/browser` para recomendar al usuario).
- NO tengo herramienta de generación de imágenes directa en mis herramientas nativas; se delega al subagente `image-generator`.

## Subagentes y modo multi-agente
- Se invocan con la herramienta `invoke_subagent`. Recibe un array `Subagents`; cada entrada lleva `TypeName`, `Role`, `Prompt`, y opcionalmente `Model` y `Workspace`.
- Tipos disponibles predefinidos:
  - `self` (copia con mis mismas herramientas, prompt y configuración).
  - `research` (solo lectura: exploración de código, búsqueda web y lectura de archivos).
  - `image-generator` (genera o edita imágenes y reporta rutas resultantes).
- Se pueden definir tipos nuevos en caliente con `define_subagent` (especificando nombre, descripción, system prompt, y permisos: escritura, MCP, subagentes).
- Comunicación y ciclo: `send_message` con el `conversationId` devuelto. Gestión con `manage_subagents` (`list`, `kill`, `kill_all`). La notificación de finalización es reactiva (el sistema avisa automáticamente, no requiere sondeo).
- Paralelismo: múltiples entradas en un mismo `invoke_subagent` corren concurrentes en segundo plano. No hay un límite numérico documentado en el prompt.
- Asignación de modelo por subagente: parámetro `Model` de cada entrada, con valores `inherit` (por defecto, hereda mi modelo), `flash_lite`, `flash` o `pro`.
- `Workspace`: `inherit` (mismo workspace), `branch` (workspace clonado aislado) o `share` (comparte repositorio estilo worktree sin duplicar storage).

## Modelos disponibles y cómo elegirlos
Confirmados mediante el comando `agy models` (actualizado 2026-10-17, v1.4.0):
- `gemini-4-argon-high` / `gemini-4-argon-medium` / `gemini-4-argon-low` *(nuevos en 1.4.0)*
- `gemini-3.8-flash-high` / `gemini-3.8-flash-medium` / `gemini-3.8-flash-low`
- `claude-opus-5-5-high` / `claude-opus-5-5-medium` / `claude-opus-5-5-low`
- `claude-sonnet-5-5-high` / `claude-sonnet-5-5-medium` / `claude-sonnet-5-5-low`
- `gpt-oss-120b-medium`

En la sesión principal se seleccionan mediante la flag `--model <id>` en el CLI o a través del selector de modelo de la interfaz. Desde la versión 1.3.4, si no se especifica `--effort`, toma el nivel por defecto del modelo. **Nota 1.4.0:** el mapeo de los tiers de subagente (`pro`/`flash`/`flash_lite`/`inherit`) a modelos concretos no está reverificado en 1.4.0; si un tier falla, usa `inherit` con el modelo principal adecuado (p. ej. `claude-sonnet-5-5-high` para potente) y repórtalo en el handoff.

| Nivel | Modelo que usas | Cómo se selecciona (flag, comando o parámetro) |
|---|---|---|
| potente | `pro` para subagentes. En CLI principal: `claude-opus-5-5-high` o `claude-sonnet-5-5-high` | Subagentes: `Model: "pro"`. Sesión principal: flag `--model` o selector de UI |
| estándar | `inherit` para subagentes. En CLI principal: `claude-sonnet-5-5-medium` o `gemini-3.8-flash-high` (activo actual) | Subagentes: `Model: "inherit"` (por defecto). Sesión principal: flag `--model` o selector de UI |
| ligero | `flash` o `flash_lite` para subagentes. En CLI principal: `gemini-3.8-flash-low` o `gemini-3.8-flash-medium` | Subagentes: `Model: "flash"` o `"flash_lite"`. Sesión principal: flag `--model` |

## Comandos `/`
No puedo ejecutarlos directamente como herramientas (son shortcuts interactivos del usuario); mi rol es recomendarlos:
- `/compact`: compacta la conversación bajo demanda y libera ventana de contexto (`/compact` o `/compact <mensaje>`). *(Nuevo en 1.3.5)*
- `/goal`: tarea de ejecución autónoma prolongada sin detenerse hasta cumplir el objetivo.
- `/plan`: tareas complejas que requieren diseño y descomposición paso a paso antes de ejecutar.
- `/schedule`: instrucciones recurrentes o temporizadores.
- `/browser`: tareas que requieren navegación web, búsquedas o interacción con apps web.
- `/grill-me`: entrevista interactiva para alinear requisitos y cerrar decisiones de diseño.
- `/teamwork-preview`: coordinación y vista previa de equipos de agentes autónomos.
- `/learn`: persistir comportamientos o configuraciones aprendidas tras correcciones.
- `/boost`: proyectos de alta complejidad que demandan razonamiento profundo, perspectivas múltiples y verificación rigurosa.

## Skills
- Carpeta del proyecto: `C:\Users\jcgm1\OneDrive\Desktop\Resto\Resto\.agents\skills\` con `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling`, `ui-ux-pro-max`.
- Carpeta global de usuario: `C:\Users\jcgm1\.gemini\config\skills\` con `herdr`, `team-bootstrap`, `team-resume`.
- Integradas (built-in): `C:\Users\jcgm1\.gemini\antigravity-cli\builtin\skills\` con `agy-customizations`, `antigravity-guide`.
Cada skill es una carpeta con su archivo `SKILL.md` obligatorio de consultar antes de usarla.

## Plugins y MCP
- **Engram**: SÍ (servidor MCP `engram`, verificado con `agy mcp list`, stdio: `C:\Users\jcgm1\go\bin\engram.exe mcp --tools=agent`). Herramientas disponibles vía `call_mcp_tool`: `mem_capture_passive`, `mem_compare`, `mem_context`, `mem_current_project`, `mem_doctor`, `mem_get_observation`, `mem_judge`, `mem_list_projects`, `mem_pin`, `mem_review`, `mem_save`, `mem_save_prompt`, `mem_search`, `mem_session_end`, `mem_session_start`, `mem_session_summary`, `mem_suggest_topic_key`, `mem_unpin`, `mem_update`. Esquemas en `C:\Users\jcgm1\.gemini\antigravity-cli\mcp\engram\`.
- Herramientas nativas MCP: `call_mcp_tool`, `list_resources`, `read_resource`.
- Plugins: comando `agy plugins list` confirma que no hay plugins adicionales instalados.

## Límites
- Sin navegador interactivo nativo ni renderizado DOM interactivo (solo lectura HTTP plana con `read_url_content`).
- Sin generación directa de imágenes (delegada al subagente `image-generator`).
- Límite de lectura con `view_file`: hasta 800 líneas o 46 KB por llamada.
- La herramienta `replace_file_content` solo admite el reemplazo de un bloque contiguo por invocación.
- Los comandos slash `/` no se ejecutan directamente por el agente; se sugieren al usuario.
- `read_url_content` no ejecuta JavaScript ni gestiona sesiones/cookies/logins.

## Cómo prefiero recibir trabajo
Handoff en markdown en `brain\Handoffs\` con:
- Metadatos YAML: `de`, `para: agy`, `tipo`, `estado: pendiente`, `hilo`, `ronda`, `creado`, `criterios_de_aceptacion` y `referencias`.
- Si es de tipo `plan`: tabla con Unidad, Oleada, Qué hace, Depende de, Subagente / modo del ejecutor (`self` / `research` / `image-generator`), Nivel de modelo (`potente` / `estándar` / `ligero`) y Criterio de aceptación.
- Rutas de archivos absolutas o relativas exactas y comandos de verificación concretos.
- Indicación si se requiere registro en memoria engram.

## Verificación del orquestador

| Dato | Declarado | Verificado (✅ / ⚠ / ❌) |
|---|---|---|
| Versión | 1.4.0 | ✅ `agy --version` = 1.4.0 (2026-10-17); catálogo `agy models` incluye Gemini 4 Argon |
| Detección en Herdr | agy / Antigravity CLI | ✅ detectado como `agy` (pane w2:p1C); hooks `antigravity-cli` current (v2) |
| Engram | Sí (MCP `engram`) | ✅ `agy mcp list` activo (`engram.exe mcp --tools=agent`); ENGRAM_DATA_DIR en resto/engram |
| Rutas de skills | .agents/skills (7), builtin/skills (2), .gemini/config/skills (3) | ✅ confirmadas en entorno: proyecto, builtin y usuario existen |
| Modelos declarados | Gemini 3.8 Flash (High) activo; catálogo CLI confirmado con `agy models`; subagentes pro/flash/flash_lite/inherit | ✅ `agy models` lista catálogo real (Gemini 3.8 Flash, Claude Opus 5.5, Claude Sonnet 5.5, GPT-OSS 120B); subagentes usan tiers declarados |
