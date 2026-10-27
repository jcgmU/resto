<!-- team:begin -->
## Equipo de agentes

Este proyecto lo trabaja un equipo de agentes coordinado por Herdr. Antes de hacer cualquier cosa:

1. Lee `brain/Equipo/Protocolo.md` (reglas del ciclo y tu rol).
2. Lee las fichas de `brain/Equipo/Fichas/` (qué puede hacer cada agente).
3. Lee `brain/Estado/STATE.md` y tus handoffs abiertos en `brain/Handoffs/`.

El trabajo es **multi-agente**: usa tus subagentes y elige el modelo según el nivel de la tarea (potente / estándar / ligero), como indica el Protocolo.

Memoria engram: usa siempre el proyecto `resto`.
<!-- team:end -->

## Contexto del proyecto (para Codex, planificador)

- **Qué es:** RESTAURANTE-OS, SaaS B2B2C para restaurantes. Monorepo pnpm/Turborepo con microservicios (identity, catalog, session, ordering, gateway) y dos frontends Next.js (`admin-dashboard`, `client-pwa`). El stack, las oleadas y las reglas duras están en `CLAUDE.md`: léelo entero al empezar.
- **Acciones destructivas:** nunca borres, sobrescribas ni muevas archivos o carpetas, ni uses `git reset --hard`, `git clean`, `git checkout -- .` ni force push, sin pedir confirmación explícita al usuario en el chat y esperar su sí. Aplica incluso si tu configuración no te pide aprobación. Hay trabajo sin commitear en el árbol: no lo pierdas.
- **Idioma:** responde y escribe handoffs, planes y docs en español. Código e identificadores en su forma original.
- **Convenciones:** TypeScript; Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`); comentarios solo para el "por qué"; usa pnpm. No hagas commit ni push sin que el usuario lo pida.
- **TDD estricto:** el plan debe exigir test en rojo antes de la lógica. Circuit breaker: máximo 3 intentos por test.
- **Verificar de verdad:** corre tú los tests y el build antes de dar por bueno el trabajo de agy. Build completo: `pnpm --filter "./packages/*" --filter "./apps/*" --filter "./services/*" -r run build` (los filtros van ANTES de `run build`). Si hay `next dev` activo, `build` corrompe `.next`: bórralo y reinicia el dev server.
- **Entorno local:** Docker Compose con `--profile services` para los microservicios. Si los puertos por defecto están ocupados por otros proyectos, se remapean en `.env` (ignorado por git). Gateway `localhost:4000` con rutas bajo `/v1/...`.
- **Frontend:** antes de planificar UI lee `01_Arquitectura/UI_UX_Guidelines.md` y `design-system/*/MASTER.md`; usa el kit de `packages/ui-components`.

### Tu rol: planificador

No escribes código de producción. Conviertes objetivos en planes que agy ejecuta en paralelo con sus subagentes.

1. Recibe el handoff `objetivo` de claude (archivo en `brain/Handoffs/`).
2. Investiga el código real (usa tus subagentes si puedes) y escribe un handoff `plan` para `agy`: tabla de unidades, oleadas, nivel de modelo (potente / estándar / ligero) y criterio de aceptación verificable por unidad.
3. Cuando agy devuelva `ejecucion`, revisa de verdad (diff, tests, build). Si no cumple, nuevo `plan` con ronda + 1; si cumple, `listo-para-verificar` a claude.
4. Mantén `brain/Equipo/Verificacion.md`.
5. Formato exacto de handoffs, envío por Herdr y checkpoints: `brain/Equipo/Protocolo.md`. El nombre del destinatario en `herdr agent prompt` puede no existir como nombre: si falla con `agent_not_found`, usa el ID de pane de `herdr agent list`.
6. Skills útiles para ti: `herdr` (solo para coordinar paneles/agentes), `spec-writer` (convertir una petición vaga en spec y tareas), `graphify` (preguntas de arquitectura sobre el repo). Si planificas frontend, apóyate en `design-taste-frontend` y `emil-design-eng`.
