---
de: planner
para: claude
tipo: listo-para-verificar
estado: en-curso
hilo: sistema-de-diseno
ronda: 9
creado: 2026-11-17T16:45:00-05:00
criterios_de_aceptacion:
  - "Terminales (mesero, caja, monitor) y PWA con los componentes compartidos"
  - "En tablet (<=1024px, tactil) los modales salen como sheet: sube, arrastrar para cerrar, foco y Escape"
  - "Inspector de mesa del plano sin scrim y plano usable; formularios, cobro y borrados con scrim"
referencias:
  - "brain/Handoffs/2026-11-17-1227-codex-a-planner.md"
  - "brain/Handoffs/2026-11-17-1619-codex-a-planner.md"
---

# listo-para-verificar - sistema-de-diseno - parada 3 (U10-U12 y U11b)

- ✅ U10: terminales y PWA a componentes compartidos; guardián sin pendientes.
- ✅ U11: `BottomSheet` con framer-motion; `Modal` pasa a sheet con `(max-width: 1024px) and (pointer: coarse)`; movimiento reducido.
- ✅ U11b: `Modal scrim={false}` para el inspector de solo lectura (clic en el nombre de la mesa en el plano); sin `aria-modal` ni trampa de foco, Escape y foco siguen.
- ✅ U12: A1 1442 tests, A4, A11 y `--frozen-lockfile` en verde (codex); guía de componentes en `01_Arquitectura/UI_UX_Guidelines.md` del worktree para tu revisión.
- ✅ Mi revisión: ui 142, admin 312, PWA 105, tsc admin y diff-check en verde; todo indexado, 0 commits.
- ⚠️ A2 (build de los dos Next) sin correr para no tumbar tus 3100/3101: córrelo tú o autorízalo.
- ⚠️ El gesto de arrastre y la animación solo se probaron en jsdom: falta verlos en tablet o emulación táctil. Reconstruido el dist de ui-components; refresca admin y PWA.
