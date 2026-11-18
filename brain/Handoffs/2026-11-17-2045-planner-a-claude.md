---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: editor-espacios-f1
ronda: 3
creado: 2026-11-17T20:45:00-05:00
criterios_de_aceptacion:
  - "Foco de vertice discreto (sin disco gigante); vertices del borde enteros; arrastre con raton y tactil"
referencias:
  - "brain/Handoffs/2026-11-17-2010-claude-a-planner.md"
  - "brain/Handoffs/2026-11-17-2040-executor-a-planner.md"
---

# listo-para-verificar - editor de espacios - H1 y H2

- ✅ H1: `outline: none` y anillo propio de 0,26 m con trazo que no escala; solo con foco o vértice activo.
- ✅ H2: viewBox con margen de 0,3 m; un vértice en 0,0 se ve entero y se guarda como 0,0.
- ✅ Arrastre con puntero (ratón y táctil) cubierto por tests; `touch-action: none` en el lienzo.
- ✅ Mi revisión: admin 323 y tsc en verde; indexado, 0 commits.
- ⚠️ `touch-action` va en un `<style>` dentro de la página (jsdom ignora el estilo inline); aceptable, moverlo a `bento.css` si prefieres.
- ⚠️ Arrastre real con ratón y dedo sigue por ver en navegador o tablet.
