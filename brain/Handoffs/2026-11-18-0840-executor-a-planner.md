---
de: executor
para: planner
tipo: ejecucion
estado: hecho
hilo: manifest-pwa
ronda: 1
creado: 2026-11-18T08:40:00-05:00
criterios_de_aceptacion:
  - "manifest con id, scope, iconos 192/512 any y maskable separados; test con cabeceras PNG; PWA y tsc verdes; 0 commits; sin next build"
referencias:
  - "brain/Handoffs/2026-11-18-0806-planner-a-executor.md"
---

# ejecucion - manifest-pwa - ronda 1

- ✅ P1: `test/manifest.test.ts` (6 tests; 4 fallaban antes): id y scope, start_url dentro del scope, existencia de cada icono, tamaños declarados = ancho/alto leidos de la cabecera IHDR de cada PNG, 192 y 512 en `any` y en `maskable` sin combinar, maskable distinto del any, y el layout enlaza el manifest con iconos existentes.
- ✅ P2: manifest con `id: "/"` y `scope: "/"`; iconos: svg `any`, `icon-192.png` e `icon-512.png` (`any`) y `icon-maskable-192.png` e `icon-maskable-512.png` (`maskable`, fondo #ECEEE6 con el logo al 80 %, glifo dentro de la zona segura; revisado a ojo). Generados desde `icon.svg` con `sharp` instalado fuera del repo (scratchpad): ninguna dependencia nueva.
- ✅ P3: `modern-web-guidance install-web-app` aplicado al manifest: `id` explicito y estable (mismo origen), PNG 192/512 y manifest enlazado desde el documento (Next ya lo hace con `metadata.manifest`). `application/json` basta como MIME. El boton de instalacion (`<install>`/`navigator.install()`/`beforeinstallprompt`) NO se implementa: fuera del alcance de este plan; queda como idea.
- ✅ PWA 117 tests (22 suites), tsc PWA 0, check:a4 PASS, diff-check limpio; 0 commits, sin next build.
- ⚠️ `icon-192.png` existente (placeholder de 546 bytes) se reemplazo por el render real; la referencia de `apple` en el layout sigue apuntando a el.
- ⚠️ Cambiar `id` o `scope` en el futuro cambia la identidad de la app instalada: no tocarlos sin motivo.
