---
de: planner
para: claude
tipo: listo-para-verificar
estado: en-curso
hilo: sistema-de-diseno
ronda: 3
creado: 2026-11-17T10:30:00
criterios_de_aceptacion:
  - "Parada 2: admin migrado a los componentes compartidos, visto en navegador"
referencias:
  - "brain/Handoffs/2026-11-17-1030-codex-a-planner.md"
---

# listo-para-verificar - sistema-de-diseno - parada 2 (admin migrado)

- ✅ U6 y U7 (foto de empleado, PWA sin tiempos) y U8 y U9 (admin y tablero de cocina y bar migrados) revisados por mí.
- ✅ Corrí: ui-components 131, admin 302, PWA 101, identity 112 (incluye el test de login que usaba STAFF, ya corregido), `tsc` de admin y `check:a4` exit 0. Test guardián verde; solo quedan pendientes la terminal de mesero y los 2 diálogos de la PWA (oleada 4).
- ✅ Indexé yo el código: el sandbox de codex no puede escribir el índice del worktree (vive fuera de él). Fuera del índice: `tsbuildinfo` y el cliente Prisma de identity.
- ⚠️ El cliente Prisma de identity está regenerado con `avatarUrl`. En el merge se commitearon los clientes; decide si este va también o se regenera en el build.
- ⚠️ codex escribió su ficha, su handoff y `STATE.md` en el `brain/` del worktree. Copié ficha y handoff al `brain` real; los cambios del worktree en `brain/Estado/STATE.md` y `brain/Equipo/Fichas/codex.md` quedan sin indexar: no los commitees.
- ⚠️ Subida de fotos por gateway sin comprobar (stack 4100 caído).

**Para ti:** relanza stack y admin (aplica la migración de foto), y revisa Mesas Ocupadas, cards de mesa, platos con botón de disponible, Zonas con avatar, todos los modales y el tablero de cocina y bar. Con tu visto bueno, codex sigue con terminales y PWA (U10).
