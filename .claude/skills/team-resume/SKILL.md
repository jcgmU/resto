---
name: team-resume
description: Retoma el trabajo del equipo de agentes de Resto (brain/ y .team/team.toml: orquestador claude, planificador planner/kimi, ejecutor agy) al empezar una sesión o tras una compactación - carga el contexto del vault de Obsidian y de engram, comprueba que los agentes sigan en Herdr, contrasta el estado real del código y reanuda el ciclo de trabajo. Úsalo cuando el usuario escriba /team-resume o pida retomar, ponerse al día o ver en qué quedó el equipo.
---

# team-resume

Eres el **orquestador** (siempre Claude). Retomas el trabajo del equipo sin que el usuario tenga que repetir instrucciones, dejando al orquestador al día con el estado real del equipo sin fiarse solo de reportes. No modifica código de producto.

Desde Git Bash, antepone `MSYS_NO_PATHCONV=1` a cualquier comando cuyo argumento empiece con `/`.

## 1. Precondiciones
- `test "$HERDR_ENV" = 1`. Si falla: explica que hay que abrir la sesión dentro de Herdr y **detente**.
- `<ruta>` es la que diga el usuario o la carpeta actual. Si no existe `<ruta>/.team/team.toml`: **detente** y sugiere `team-bootstrap`.

## 2. Cargar contexto y contrastar con el código real
- Lee completos:
  - `brain/00-Inicio.md`, `brain/Equipo/Protocolo.md`, `brain/Equipo/Comandos.md`, `brain/Equipo/Verificacion.md`;
  - las fichas de `brain/Equipo/Fichas/`;
  - `brain/Estado/STATE.md` (fase, ronda, turno, siguiente paso y últimas notas) y `.team/team.toml`.
- **Handoffs abiertos:** lista `brain/Handoffs/` ordenado por nombre y lee completos los que tienen `estado:` igual a `pendiente`, `en-curso` o `no-entregado` (anota de quién a quién, hilo y ronda).
- **Verificaciones y ADRs:** lee la nota más reciente de `brain/Verificaciones/` (y sus chequeos no probados o en FALLA) y los ADR recientes de `brain/Decisiones/`.
- **engram:** `mem_context` y `mem_search` (consulta = la fase y los hilos abiertos), siempre con `project` = `engram_project` de `team.toml` (`resto`).
- Si `STATE.md` tiene `engram_pendiente: si`: guarda ahora el resumen pendiente con `mem_save` y cambia el valor a `no`.
- **Estado real del código:** ejecuta `git status --short` y `git log --oneline -5`. Distingue cambios sin commitear del trabajo ya registrado. Si lo declarado (`STATE.md`, handoffs) no coincide con lo observado (agentes, git, tests), señálalo; no des por pasado nada que no hayas comprobado tú.

## 3. Comprobar el equipo
- `herdr agent list`. Busca al planificador y al ejecutor por el `agent_name` que figura en `team.toml`. Cruza su estado (`idle`, `working`, `blocked`, `done`) con el turno declarado. Un agente `blocked` espera al usuario: léelo con `herdr agent read <pane> --source recent-unwrapped --lines 60` y no respondas por él. Si un agente no aparece por nombre, usa su ID de pane.
- **Si no aparece con ese nombre pero hay un agente del mismo `kind`** (tras un reinicio los panes cambian): `herdr agent rename <pane> <agent_name>`.
- **Si no está:** pregúntale al usuario si lo lanzas o si prefiere asignar otro agente.
  - **Lanzar:** `herdr pane split --current --direction right --cwd "<ruta>" --no-focus` → anota `.result.pane.pane_id`. Si `team.toml` tiene `last_session_id`, ofrece reanudar esa sesión:
    - kimi: `herdr agent start <nombre> --kind kimi --pane <id> -- --session <last_session_id>`
    - agy: `herdr agent start <nombre> --kind agy --pane <id> -- --conversation <last_session_id>`
    - claude: `herdr agent start <nombre> --kind claude --pane <id> -- --resume <last_session_id>`
    - Otro tipo o sin sesión: `herdr agent start <nombre> --kind <kind> --pane <id>`. Si no conoces el flag para reanudar, pregúntale al usuario.
  - **Si el arranque queda `blocked`** (por ejemplo, "Trust this folder"): muéstraselo al usuario y pregúntale. Nunca lo apruebes tú.
  - **Asignar otro agente:** actualiza ese rol en `team.toml` y los nombres en `Protocolo.md` y `Comandos.md`, y pídele su ficha como en el paso 4 de `team-bootstrap`.
- **Versión:** `<kind> --version`. Si cambió respecto a `team.toml`, pídele a ese agente que regenere su ficha, haz tu verificación cruzada y actualiza la versión en `team.toml`.
- **Salud:** repite las comprobaciones del paso 3 de `team-bootstrap` (detección, integración de hooks, engram compartido) y muéstrale los problemas al usuario con su arreglo.

## 4. Poner al día a los agentes
- Pregunta antes de enviar handoffs, arrancar agentes o cambiar `STATE.md`. Si el usuario confirma:
- A cada agente:
  ```
  herdr agent prompt <n> "Retomamos el proyecto <nombre>. Lee <ruta>/brain/Equipo/Protocolo.md, <ruta>/brain/Estado/STATE.md y tus handoffs abiertos en <ruta>/brain/Handoffs (los que tienen para: <n> y estado pendiente, en-curso o no-entregado). Responde solo LISTO." --wait --timeout 300000
  ```
- Reenvía cada handoff que esté en `no-entregado` como indica el Protocolo (sección Handoffs, "Enviar").

## 5. Reportar y continuar (corto, en español)
- Reporte breve al usuario:
  - Dónde quedó el equipo: fase/hilo, ronda, de quién es el turno.
  - Handoffs abiertos y agentes bloqueados u ociosos.
  - Discrepancias entre lo declarado y lo observado, y problemas de salud encontrados.
  - Trabajo sin commitear que corre riesgo.
  - El siguiente paso recomendado y qué necesita decidir el usuario.
- Si el turno es tuyo, sigue el Protocolo. Si es de otro agente, espera su handoff.
- Cuando cambie el turno y antes de cerrar la sesión: haz el **checkpoint** del Protocolo.

## Reglas
- `team.toml` manda: no cambies roles sin que el usuario lo pida.
- Nunca cierres panes ni mates procesos que no creaste.
