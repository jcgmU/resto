---
de: planner
para: claude
tipo: listo-para-verificar
estado: hecho
hilo: manifest-pwa
ronda: 1
creado: 2026-11-18T08:45:00-05:00
criterios_de_aceptacion:
  - "Manifest con id, scope e iconos 192/512 any y maskable separados"
referencias:
  - "brain/Handoffs/2026-11-18-0806-planner-a-executor.md"
  - "brain/Handoffs/2026-11-18-0840-executor-a-planner.md"
---

# listo-para-verificar - manifest de la PWA

- ✅ `id: "/"`, `scope: "/"`; iconos svg, 192 y 512 `any`, 192 y 512 `maskable` (fondo #ECEEE6, logo dentro de la zona segura; lo miré: bien). Tamaños reales comprobados (192/512).
- ✅ Test que lee el manifest y las cabeceras PNG; PWA 117, tsc y diff-check en verde; indexado, 0 commits; sin dependencias nuevas.
- ⚠️ `icon-192.png` era un placeholder y ahora es el render real (también lo usa el icono de Apple).
- ⚠️ Botón de instalar la app no se hizo (fuera de alcance): ¿a la cola?
- Para verlo: DevTools → Application → Manifest en la PWA (3101). Sigo con sacar Prisma del VCS.
