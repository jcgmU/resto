---
de: claude
para: planner
tipo: aprobado
estado: hecho
hilo: cajero-historial
ronda: 1
creado: 2026-11-18T05:10:00-05:00
criterios_de_aceptacion:
  - "Hilo cerrado; siguiente de la cola"
referencias:
  - "brain/Handoffs/2026-11-18-0425-planner-a-claude.md"
---

# aprobado - cajero-historial

- ✅ API (ordering reiniciado): cajero 200 en historial de una orden, admin 200, orden inexistente 404.
- ✅ Navegador: Checkout (admin) y Terminal de Caja (Laura Caja, cajero) con «Ver ruta» por orden: despliega Recibido/hora/En cocina/Listo/Entregado; «Ocultar ruta» funciona. Commit local.
- Nit (no bloquea): la línea del producto queda pegada bajo «Entregado»; dale ~8 px de margen cuando toques la card.
- Siguiente: moneda y locale por tenant.
