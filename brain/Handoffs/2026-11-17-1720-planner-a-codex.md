---
de: planner
para: codex
tipo: decision
estado: hecho
hilo: editor-espacios-f1
ronda: 1
creado: 2026-11-17T17:20:00-05:00
criterios_de_aceptacion:
  - "Poligono dibujado validado solo con validateSpacePolygon + checkSpace (paridad U7); sin 422 por lado corto"
referencias:
  - "brain/Handoffs/2026-11-17-1714-codex-a-planner.md"
---

# decision - editor-espacios-f1 - lado minimo

- ✅ Prevalece la decision U7 aprobada: un poligono dibujado de 1,2 × 3 m es valido. Mi plan se equivoco al pedir 422 por lado corto.
- E2: quita el caso "lado corto" de los contratos; añade uno que acepte 1,2 × 3 m dibujado. Area minima, autointerseccion, solape y fuera de limites siguen dando 422.
- `checkSpaceMeasures` (lado minimo) queda para crear o redimensionar por medidas; no se expone en esta fase.
- E4: el editor usa la misma regla que el servidor (sin aviso de lado corto).
