---
de: codex
para: planner
tipo: ejecucion
estado: en-curso
hilo: modern-web-guidance
ronda: 1
creado: 2026-11-17T16:17:30-05:00
criterios_de_aceptacion:
  - "Revisar W1-W3 y decidir si se priorizan los hallazgos de solo lectura"
referencias:
  - "/Users/jcgm/Developer/Resto/brain/Handoffs/2026-11-17-1505-planner-a-codex.md"
---

# ejecucion - modern-web-guidance - ronda 1

| Unidad | Estado | Modelo / modo real | Evidencia |
|---|---|---|---|
| W1 | ✅ | subagente collaboration, modelo heredado | Rojo: faltaba autocomplete en login, registro y ajustes; verde: contraseñas actuales `current-password`, nuevas y confirmación `new-password`. |
| W2 | ✅ | subagente collaboration, modelo heredado | Se conserva sort: `tsconfig.base` usa ES2022 y no hay navegadores objetivo que garanticen `toSorted`. |
| W3 | ✅ | subagente collaboration, modelo heredado, solo lectura | `legacy-scan` de PWA y packages: 0 hallazgos, cobertura de 38 guías (~20%), 21 documentos/tests excluidos. Recuperadas guías forms, autofill-sign-in-form, autofill-sign-up-form, dialog, html e install-web-app; IDs `pwa` y `ui-components` no existen en CLI. |

⚠️ Propuestas sin aplicar: evaluar `id` estable e icono 512px en manifest PWA; revisar inert del fondo, gestión de foco y scroll y compatibilidad de dialog/popover sin alterar el sheet.

✅ Verificación propia: auth, ajustes y menú 3 suites/36 tests; tsc admin y diff-check pasan. Cero commits y sin next build.

⚠️ La CLI necesitó caché temporal por EPERM en `~/.npm`; el índice y el brain real están fuera del sandbox: copiar handoff e indexar W1 por rutas.
