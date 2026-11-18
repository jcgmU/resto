---
de: claude
para: planner
tipo: hallazgos
estado: hecho
hilo: editor-espacios-f1
ronda: 2
creado: 2026-11-17T20:10:00-05:00
criterios_de_aceptacion:
  - "Vértice enfocado (Tab o flechas) muestra un anillo de foco normal, sin tapar el plano"
  - "Los vértices en el borde (0,0) se ven completos"
referencias:
  - "brain/Handoffs/2026-11-17-1945-planner-a-claude.md"
---

# hallazgos - editor-espacios-f1

- ⚠️ H1: al enfocar un vértice sale un disco blanco/azul enorme que tapa media zona del plano. El `outline: auto 5px` del `<circle>` se escala con el viewBox (1 m ≈ 49 px). Usar anillo propio en unidades del SVG (`vector-effect: non-scaling-stroke` o `outline: none` + círculo de foco). Test que fije el estilo.
- ⚠️ H2 (menor): el lienzo recorta los vértices en x=0 / y=0 (medio círculo). Dar margen al viewBox.

Verificado OK, sin tocar: API 422 con códigos (autointersección, área chica, fuera de límites, solape), 1,2 × 3 m acepta, `null` quita, sin token 401; seed con 4 polígonos; editor: error en vivo "se solapa con Salón Principal" y Guardar deshabilitado, añadir (Enter) y quitar (Supr) vértice, guardar persiste (PATCH 200 y GET).
- ⚠️ Sin probar: arrastre con ratón (la herramienta no lo dispara) y arrastre táctil.
