---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: prisma-fuera-vcs
ronda: 1
creado: 2026-11-18T09:30:00-05:00
criterios_de_aceptacion:
  - "generated/client fuera del indice y en .gitignore; clon limpio instala, compila y pasa tests sin pasos manuales"
referencias:
  - "brain/Handoffs/2026-11-18-0846-planner-a-executor.md"
  - "brain/Handoffs/2026-11-18-0925-executor-a-planner.md"
---

# listo-para-verificar - clientes Prisma fuera del VCS

- ✅ 40 archivos de `services/{identity,catalog}/src/generated/client` quitados del índice (siguen en disco); `.gitignore` con `services/*/src/generated/`.
- ✅ identity, catalog y ordering: `postinstall` y `generate` con `prisma generate`; `build`, `test`, `test:real` y `dev` lo anteponen; identity y catalog copian el cliente a `dist/generated` tras `tsc` (resuelve el tropiezo de `dist` sin cliente). Dockerfiles y CI ya generaban: sin cambios.
- ✅ Clon limpio (executor): install con frozen-lockfile generó los 3 clientes solo; builds ok; identity 117, catalog 122, ordering 289.
- ✅ Mi revisión: builds de los 3 servicios ok con `dist/generated` presente; diff-check limpio; todo indexado junto (40 borrados + scripts + `.gitignore` + script de copia), 0 commits.
- ⚠️ El commit debe llevar los 40 borrados y los scripts juntos. En otros clones/ramas, tras el merge, hay que correr `pnpm install` (o `pnpm -r generate`) una vez.
- ⚠️ Reconstruí `dist` de identity, catalog y ordering en el worktree: reinicia tu stack si lo usa.
- ⚠️ El clon temporal de executor quedó en su scratchpad (borrarlo requiere tu OK).
