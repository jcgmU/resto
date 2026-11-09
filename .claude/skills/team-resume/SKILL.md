---
name: team-resume
description: Retoma el trabajo del equipo de agentes de Resto (orquestador claude, planificador planner (Claude Code), ejecutor agy) al empezar una sesión o tras una compactación. Úsalo cuando el usuario escriba /team-resume o pida retomar, ponerse al día o ver en qué quedó el equipo.
---

# team-resume

Objetivo: dejar al orquestador al día con el estado real del equipo, sin fiarse de reportes, y proponer el siguiente paso. No modifica código.

## Pasos

1. **Reglas:** lee `brain/Equipo/Protocolo.md` y los nombres de rol en `.team/team.toml`.
2. **Estado declarado:** lee `brain/Estado/STATE.md` (fase, ronda, turno, siguiente paso) y las últimas notas.
3. **Handoffs abiertos:** lista `brain/Handoffs/` ordenado por nombre y abre los más recientes. Los que tengan `estado: pendiente`, `en-curso` o `no-entregado` están abiertos. Anota de quién a quién, hilo y ronda.
4. **Verificaciones:** lee la última de `brain/Verificaciones/` y sus chequeos no probados o en FALLA.
5. **Agentes vivos:** `herdr agent list` (solo si `HERDR_ENV=1`). Cruza estado (`idle`, `working`, `blocked`, `done`) con el turno declarado. Un agente `blocked` espera al usuario: léelo con `herdr agent read <pane> --source recent-unwrapped --lines 60` y no respondas por él. Si un agente no aparece por nombre, usa su ID de pane.
6. **Memoria:** consulta engram con proyecto `resto` (`mem_context`) para ver el último resumen de sesión.
7. **Estado real del código:** `git status --short` y `git log --oneline -5`. Distingue cambios sin commitear del trabajo ya registrado.
8. **Contraste:** si lo declarado (STATE, handoffs) no coincide con lo observado (agentes, git, tests), señálalo. No des por pasado nada que no hayas comprobado tú.

## Qué reportar al usuario (corto, en español)

- Dónde quedó el equipo: hilo, ronda, de quién es el turno.
- Handoffs abiertos y agentes bloqueados o ociosos.
- Discrepancias entre lo declarado y lo observado.
- Trabajo sin commitear que corre riesgo.
- El siguiente paso recomendado y qué necesita decidir el usuario.

Pregunta antes de enviar handoffs, arrancar agentes o cambiar `STATE.md`. Si el usuario confirma, sigue el ciclo del Protocolo.
