---
de: planner
para: codex
tipo: plan
estado: en-curso
hilo: editor-espacios-f1
ronda: 1
creado: 2026-11-17T18:50:00-05:00
criterios_de_aceptacion:
  - "Zona (espacio) con poligono opcional en metros: ZoneDTO, Create/UpdateZoneRequest; null lo quita; zonas sin poligono siguen funcionando"
  - "session valida con las reglas de shared-types/floorplan (validateSpacePolygon, checkSpace) y responde 422 con el codigo FloorRuleError; test en rojo primero"
  - "Editor de espacios en el admin: crear, mover vertices, anadir/quitar vertice, guardar; errores en vivo con las mismas reglas; teclado y movimiento reducido"
  - "Bateria: shared-types, session (Redis 6381/2), gateway, admin, tsc, A4, diff-check; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-1840-claude-a-planner.md"
---

# plan - editor de espacios fase 1

Alcance: solo espacios (poligonos de zona). Colocar mesas en el plano es fase 2: fuera.

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| E1 | 1 | shared-types: `ZoneDTO.polygon?: Polygon` (metros, tipo de `floorplan/geometry`); `CreateZoneRequest`/`UpdateZoneRequest` aceptan `polygon?: Polygon \| null`; helper `zoneToFloorSpace` | - | si | ligero | tests de tipos/helper rojo→verde; build shared-types |
| E2 | 2 | session: `ZoneUseCases` valida el poligono con `validateSpacePolygon` + `checkSpace` contra los demas espacios del tenant (`DEFAULT_FLOOR_LIMITS`); error de dominio → 422 `{ error: { code, details } }`; `RedisZoneRepository` guarda y lee el poligono (compatible con zonas antiguas). Redondeo al `gridStepM` en servidor | E1 | si | estandar | unit + contrato rojo→verde: valido 201/200, autointerseccion, solape, fuera de limites, lado corto, area chica → 422; null quita; zona antigua sin poligono sigue listando |
| E3 | 2 | gateway: confirmar que POST/PATCH `/v1/zones` pasan el poligono (cuerpo JSON) y que 422 llega intacto | E1 | si (mismo E2) | ligero | test de gateway |
| E4 | 3 | admin: pagina `/mesas/espacios` (enlace desde Zonas del dashboard) tras flag nuevo `space-editor` (default true al cerrar). SVG en metros con rejilla `gridStepM`, lista de espacios a la izquierda, rectangulo inicial al crear, arrastrar vertices (snap a rejilla), doble clic en arista añade vertice, Supr quita (min 3), flechas mueven el vertice seleccionado; validacion en vivo con `checkSpace` y mensaje en espanol por codigo; Guardar/Descartar con `Button`, errores del servidor (422) visibles; colores de zona con tokens bento | E2, E3 | si | potente | tests rojo→verde: crear, mover con teclado, añadir/quitar vertice, error de solape bloquea guardar, 422 se muestra, guardar envia PATCH con poligono |
| E5 | 4 | Seed: poligonos de ejemplo para las zonas demo (validos y sin solape). Bateria y nota corta en la doc de session | E4 | no | ligero | numeros de salida; seed idempotente |
| **Parada** | - | Handoff `codex-a-planner`; reviso y paso a claude | E5 | - | - | - |

- Sin acoplar dominios: la geometria vive en shared-types; session no llama a nadie para validar.
- Sin migraciones (session es Redis), sin stash/reset/checkout --, no tocar generated/client, sin next build. Si git add o el brain fallan, lo hago yo.
