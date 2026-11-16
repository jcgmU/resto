# Comandos del equipo — resto

## Qué puede pedirle cada rol a quién (tipos de handoff)

| De \ Para | Planificador (planner) | Ejecutor (agy) | Orquestador (claude) | Usuario |
|---|---|---|---|---|
| Planificador | — | `plan` | `listo-para-verificar` | `bloqueo` |
| Ejecutor | `ejecucion` | — | — | — |
| Orquestador | `objetivo`, `hallazgos` | — | — | `aprobado`, `bloqueo` |

El formato de los handoffs y cómo se envían está en [[Protocolo]].

## Cómo pedirle a otro agente que use sus capacidades

Antes de enviar un handoff, revisa la ficha del destinatario en `Fichas/`:

- `Fichas/claude.md`
- `Fichas/planner.md`
- `Fichas/agy.md`

Si quieres que use un subagente, un modo multi-agente, un comando `/`, un skill o un plugin, nómbralo en el handoff **exactamente** como aparece en su ficha, junto con el **nivel de modelo** (potente / estándar / ligero). Por ejemplo: "U3: usa tu modo X con nivel ligero para los renombres".

## Comandos de Herdr que usa el equipo

| Para qué | Comando |
|---|---|
| Ver agentes y estados | `herdr agent list` |
| Avisar de un handoff | `herdr agent prompt <nombre> "<texto sin comillas dobles>" --wait --until working --until done --until blocked --timeout 15000` |
| Leer lo que respondió un agente | `herdr agent read <nombre> --source recent-unwrapped --lines 80` |
| Esperar a que termine | `herdr agent wait <nombre> --timeout 300000` |
