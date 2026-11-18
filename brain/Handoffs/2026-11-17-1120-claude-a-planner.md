---
de: claude
para: planner
tipo: hallazgos
estado: hecho
hilo: sistema-de-diseno
ronda: 3
creado: 2026-11-17T11:20:00
criterios_de_aceptacion:
  - "POST /v1/uploads por el gateway con multipart devuelve 201 y la foto de empleado se guarda"
referencias:
  - "brain/Handoffs/2026-11-17-1030-planner-a-claude.md"
---

# hallazgos - sistema-de-diseno - subida de fotos por gateway

- ⚠️ H1: `POST /v1/uploads` por el gateway devuelve 400 sin cuerpo; directo al catálogo funciona. Causa: en `services/gateway/src/proxy/httpProxy.ts`, `express.json()` deja `req.body = {}` en multipart y el proxy lo reescribe como JSON (`{}`) porque `content-length > 0`, descartando el archivo. Viene de `c814c04`/`d7c6547`, no de U6.
- Arreglo esperado: reescribir el cuerpo solo si `content-type` es JSON; en cualquier otro caso dejar pasar el stream. Test en rojo primero (multipart a través del gateway).
- ⚠️ H2: los modales de `/dashboard` (Editar mesa, Zonas) salen cortados por abajo: el `.bento-modal__backdrop` es `fixed; inset:0` pero mide 1968px (no el viewport) y centra el diálogo en y≈750 de 985. Hay un ancestro con `backdrop-filter` que hace de bloque contenedor del `fixed`. Arreglo: renderizar el modal en un portal a `document.body` o quitar el `backdrop-filter` del ancestro. Test que lo cubra.
- ⚠️ H3: en la card de mesa, "Ver QR" se parte en dos líneas y queda comprimido junto a Editar y Eliminar.
- ⚠️ H4: tras abrir Editar, Escape no cerró el modal (quedaron 2 diálogos al abrir Zonas encima); comprobar foco/cierre con teclado.
- ✅ Cards de mesa con blob y sin punto ni badge, sin tres puntos; Mesas Ocupadas y el resto del resumen bien.
- ✅ Platos con botón Disponible/No disponible y tablero de cocina y bar (cards con blob, columnas y llamadas) bien.
- ⏳ Sin revisar: avatar en Zonas (el modal sale cortado por H2), modales de menú y ajustes; se revisan cuando H2 esté corregido.
- ✅ Migración de foto aplicada y stack 4100-4104 + admin 3100 + PWA 3101 arriba con cliente Prisma sincronizado (el `dist` de identity no se regeneraba solo: `tsc` no copia el cliente; vale para el build/merge).
- ⏳ Mientras tanto reviso en navegador todo lo demás de la parada 2; la foto de empleado queda pendiente de este arreglo.
