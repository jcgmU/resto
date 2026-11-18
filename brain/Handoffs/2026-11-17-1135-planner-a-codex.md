---
de: planner
para: codex
tipo: plan
estado: hecho
hilo: sistema-de-diseno
ronda: 5
creado: 2026-11-17T11:35:00-05:00
criterios_de_aceptacion:
  - "Cada arreglo con test en rojo antes del cambio (anota el fallo en rojo en tu handoff)"
  - "POST /v1/uploads multipart por el gateway llega al catalogo con el archivo intacto (201)"
  - "Modales del admin centrados en el viewport aunque un ancestro tenga backdrop-filter"
  - "Escape cierra Editar mesa y no quedan dos dialogos abiertos"
  - "Ver QR en una sola linea en la card de mesa"
  - "Bateria verde: gateway, ui-components, admin, tsc admin, A4, guardian; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-17-1120-claude-a-planner.md"
---

# plan - sistema-de-diseno - hallazgos H1-H4 de la parada 2

| Unidad | Oleada | Que hace | Depende de | Subagente | Nivel | Criterio |
|---|---|---|---|---|---|---|
| C1 (H1) | 1 | Gateway: en `services/gateway/src/proxy/httpProxy.ts` reescribir el cuerpo solo si `content-type` es JSON; si no, dejar pasar el stream. Test en rojo: multipart por el gateway hacia un upstream de prueba que recibe el archivo con sus bytes | - | si | estandar | test rojo→verde; tests JSON existentes del proxy siguen verdes |
| C2 (H2) | 1 | `Modal` de ui-components se renderiza con `createPortal` a `document.body`. Test en rojo: renderizado dentro de un contenedor, el backdrop queda como hijo de `document.body` | - | si | estandar | test rojo→verde; reconstruir dist de ui-components |
| C3 (H4) | 2 | Escape en Editar mesa del dashboard: test en rojo que abre Editar mesa, pulsa Escape y espera 0 dialogos; arreglar (foco al abrir, onClose conectado). Con varios modales, Escape cierra solo el de arriba | C2 | si | estandar | test rojo→verde |
| C4 (H3) | 2 | Card de mesa: Ver QR, Editar y Eliminar sin partirse (`white-space: nowrap` en `Button` y acciones que envuelven a otra fila si no caben). Test de la clase/estilo | - | no | ligero | test rojo→verde |
| Bateria | 3 | gateway, ui-components, admin, PWA, tsc admin, `check:a4`, guardian, diff-check | C1-C4 | no | ligero | todo verde |

- Reglas de siempre: brain real en `/Users/jcgm/Developer/Resto/brain`; sin `stash`/`reset`/`checkout --`; sin migraciones ni `down -v`; no tocar `generated/client`; no correr `next build` de admin (claude tiene 3100 arriba).
- Si `git add` falla por el sandbox, dilo y lo indexo yo.
- Al terminar: handoff `codex-a-planner` con una linea por unidad (✅/⚠️) y el fallo en rojo de cada test.
