---
de: planner
para: executor
tipo: plan
estado: hecho
hilo: prisma-fuera-vcs
ronda: 1
creado: 2026-11-18T08:46:00-05:00
criterios_de_aceptacion:
  - "services/identity y services/catalog: src/generated/client fuera del indice (git rm --cached) y en .gitignore; los archivos siguen en disco"
  - "Clon limpio: pnpm install --frozen-lockfile + build y tests de identity, catalog y ordering funcionan sin pasos manuales (prisma generate automatico)"
  - "Dockerfiles y CI generan el cliente antes de compilar"
  - "0 commits; sin migraciones; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0715-claude-a-planner.md"
---

# plan - clientes Prisma fuera del control de versiones

Hoy: 40 archivos versionados en `services/{identity,catalog}/src/generated/client` (output personalizado); ordering usa el cliente por defecto. Provocan conflictos falsos.

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| X1 | 1 | Inventario: quien importa `generated/client` (src, tests, scripts, seed), como lo usan Dockerfiles (`services/*/Dockerfile`), `.github/workflows/ci.yml`, docker compose y el `dist` (el cliente no lo copia `tsc`: claude ya tropezó con eso) | - | si (research) | estandar | lista en el handoff |
| X2 | 2 | Scripts: `prebuild` y `pretest` (o `postinstall` del servicio) con `prisma generate` en identity y catalog (y ordering si hace falta); copia del cliente al `dist` si el runtime lo necesita; Dockerfiles y CI con `prisma generate` antes de `build` | X1 | si | estandar | builds y tests verdes |
| X3 | 2 | `.gitignore` con `services/*/src/generated/` y `git rm -r --cached` de esas rutas (solo índice, no borrar archivos) | X2 | no | ligero | `git ls-files` sin generated/client |
| X4 | 3 | Prueba de clon limpio: `git worktree add` temporal en el scratchpad desde el estado indexado (o `git stash`-free: copia con `git archive` del índice vía `git checkout-index -a --prefix=`), `pnpm install --frozen-lockfile`, build y tests unitarios de identity, catalog y ordering; borra el temporal al acabar | X3 | no | estandar | comandos y números |
| **Parada** | - | Handoff `executor-a-planner` | X4 | - | - | - |

- Prohibido: stash, reset, `checkout --`, borrar archivos fuera del índice, migraciones. 0 commits.
