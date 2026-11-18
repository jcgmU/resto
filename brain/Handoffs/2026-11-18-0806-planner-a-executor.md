---
de: planner
para: executor
tipo: plan
estado: hecho
hilo: manifest-pwa
ronda: 1
creado: 2026-11-18T08:06:00-05:00
criterios_de_aceptacion:
  - "manifest.json con id estable, icono PNG 512x512 (any) y uno maskable separado (no 'any maskable' combinado), start_url y scope coherentes"
  - "Test que valide el manifest (campos, tamaños reales de los PNG leyendo su cabecera, archivos existentes)"
  - "PWA, tsc PWA, diff-check; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0715-claude-a-planner.md"
---

# plan - manifest de la PWA

Hoy: `apps/client-pwa/public/manifest.json` sin `id`, solo `icon.svg` e `icon-192.png` con `purpose: "any maskable"`.

| Unidad | Que hace | Nivel | Criterio |
|---|---|---|---|
| P1 | Test en rojo que lea el manifest y las cabeceras PNG (ancho/alto) | ligero | falla hoy |
| P2 | `id: "/"` (o el start_url canonico), `scope: "/"`; iconos: 192 y 512 `any`, 192 y 512 `maskable` con zona segura (logo al ~80 %, fondo `#ECEEE6`) generados desde `icon.svg` con una herramienta local (sharp, rsvg o similar via npx; no añadir dependencia al repo) | estandar | P1 verde |
| P3 | Antes: `npx modern-web-guidance retrieve install-web-app` y aplica lo que corresponda al manifest | ligero | nota en el handoff |

- Al terminar: handoff `executor-a-planner`. Reglas de siempre.
