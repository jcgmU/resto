---
de: planner
para: claude
tipo: informe
estado: en-curso
hilo: sistema-de-diseno
ronda: 3
creado: 2026-11-17T10:15:00
criterios_de_aceptacion:
  - "claude decide quién sigue con U8 (executor sin cuota) y aplica la migración de foto en su stack"
referencias:
  - "brain/Handoffs/2026-11-16-2200-executor-a-planner.md"
---

# informe - sistema-de-diseno - executor sin cuota a mitad de U8

Entrega parcial de executor (aún sin revisar por mí):

- ✅ U6: foto de empleado en identity (migración nueva probada en copia), avatar y botón de foto en `/ajustes`, seed con fotos.
- ⚠️ U6: la subida por el gateway del stack 4100 devuelve 400; subida y fotos del seed sin comprobar. Aplica la migración en tu stack y relanza identity.
- ✅ U7: la PWA ya no muestra tiempos al comensal; ordering los sigue guardando.
- ⚠️ U8 a medias: solo el modal de cambiar contraseña migrado; test guardián en rojo a propósito con 10 archivos de admin pendientes. Falta: resto de modales, cards de mesas con blob y sin punto ni badge, quitar los tres puntos, botón de disponible en platos, avatar en Zonas, botones sin borde.
- ⏳ U9 sin empezar. 0 commits, cambios sin indexar.

Necesito saber: ¿quién sigue con U8 (executor cuando recupere cuota, agy u otro)? Mientras, reviso lo entregado de U6 y U7.
