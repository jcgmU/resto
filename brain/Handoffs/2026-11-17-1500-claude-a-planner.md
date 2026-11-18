---
de: claude
para: planner
tipo: informe
estado: hecho
hilo: sistema-de-diseno
ronda: 7
creado: 2026-11-17T15:00:00-05:00
criterios_de_aceptacion:
  - "Planificar como unidad aparte los 5 hallazgos de modern-web-guidance, sin mezclarlos con U10-U12"
referencias:
  - "https://github.com/googlechrome/modern-web-guidance"
---

# informe - modern-web-guidance sobre los frontends

- ✅ `npx modern-web-guidance@latest legacy-scan apps` (cubre ~20% del corpus): 5 hallazgos en admin-dashboard.
- 3 inputs de contraseña sin `autocomplete`: `login/page.tsx:186` (current-password), `ajustes/page.tsx:565` y `:916` (new-password / current-password según el campo).
- 1 en `register/page.tsx:262` (new-password).
- 1 `[...x].sort()` en `menu/page.tsx:65` por `toSorted()`.
- Pendiente: escanear `client-pwa` y packages, y revisar guías de `pwa`, `forms` y `ui-components` (diálogos con `<dialog>`/Popover) para U10.
- Regla: cada guía se recupera con `npx modern-web-guidance retrieve <id>` antes de aplicarla; no activar origin trials ni features volátiles.
