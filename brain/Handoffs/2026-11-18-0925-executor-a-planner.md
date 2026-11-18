---
de: executor
para: planner
tipo: ejecucion
estado: hecho
hilo: prisma-fuera-vcs
ronda: 1
creado: 2026-11-18T09:25:00-05:00
criterios_de_aceptacion:
  - "generated/client fuera del indice y en .gitignore con archivos en disco; clon limpio funciona sin pasos manuales; Dockerfiles y CI generan antes de compilar; 0 commits; sin migraciones; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0846-planner-a-executor.md"
---

# ejecucion - prisma-fuera-vcs - ronda 1

- ✅ X1 (inventario): 40 archivos versionados (20 identity + 20 catalog, `src/generated/client`); importan el cliente `src/` (app.ts y repos Prisma), `test/contract/contract-helper.ts` y `test-real/*`; ordering usa el cliente por defecto de `@prisma/client`. Los Dockerfiles ya hacian `prisma generate` en la etapa build y copiaban `src/generated` a `dist/generated` en prod; `ci.yml` ya generaba los 3 clientes tras `pnpm install --frozen-lockfile`; `scripts/test-hardening.mjs` ya genera y copia a dist. El stage dev solo hace `pnpm install` (cubierto por el postinstall nuevo). `tsc` no copia el cliente a `dist`: ese era el tropiezo.
- ✅ X2: en identity, catalog y ordering: `postinstall` y `generate` = `prisma generate`; `build`, `test`, `test:real` y `dev` anteponen `prisma generate`; identity y catalog copian ademas `src/generated` a `dist/generated` tras `tsc` con `scripts/copy-generated-client.mjs` (nuevo). Dockerfiles y CI sin cambios: ya generaban antes de compilar y el postinstall se ejecuta en `pnpm install`.
- ✅ X3: `.gitignore` con `services/*/src/generated/` y `git rm -r --cached` de ambas rutas (40 borrados en el indice; los archivos siguen en disco). `git ls-files | grep generated/client` = 0.
- ✅ X4: clon limpio en el scratchpad (todo lo no ignorado del arbol, sin `generated/`): `pnpm install --frozen-lockfile` ok y el postinstall genero los 3 clientes solo; build de packages, identity, catalog y ordering ok (dist/generated presente en identity y catalog); tests: identity 117, catalog 122, ordering 289 (BD 5435, Redis 6381/3). En el repo real: tsc identity, catalog y ordering 0; diff-check limpio.
- ⚠️ Cambios sin commitear: el indice tiene 40 borrados (`git rm --cached`) y el arbol los scripts, `.gitignore` y el script nuevo; para que el commit quede coherente deben ir juntos.
- ⚠️ El clon temporal queda en el scratchpad de la sesion (el guard bloquea `rm` sin confirmacion del usuario); no esta en el repo.
- ⚠️ `pnpm test` de esos tres servicios ahora regenera el cliente en cada corrida (~1 s) y necesita las dependencias instaladas.
