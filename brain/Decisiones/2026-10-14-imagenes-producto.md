# ADR: Almacenamiento de imágenes de producto

- **Fecha:** 2026-10-14
- **Estado:** Aceptado
- **Hilo:** correcciones-qa-y-notas (N05)
- **Contexto:** N05 pide subir imagen al crear/editar producto y verla en carta cliente y admin. El modelo Product ya tiene `imageUrl`, pero no hay endpoint de subida ni almacenamiento. El stack es local/Docker sin object storage.
- **Decisión (mínima coherente con el stack):**
  1. El servicio catalog expone `POST /uploads` (admin/manager, multipart, máx 2 MB, tipos png/jpg/webp) que guarda el archivo con nombre aleatorio en `/data/uploads` (volumen Docker `catalog_uploads`) y devuelve la URL relativa `/uploads/<file>`.
  2. `GET /uploads/<file>` es público (lo necesita la carta guest) y se proxea por el gateway.
  3. Crear/editar producto acepta `imageUrl` con esa URL; admin muestra preview y la PWA la renderiza en tarjeta y detalle.
- **Consecuencias:** Sin dependencias nuevas pesadas ni servicios externos. Las imágenes no sobreviven a un reset del volumen (documentado). Para producción: migrar a object storage S3-compatible cambiando solo el adapter de storage (puerto `ImageStoragePort`), las URLs ya persistidas quedarían migrables.
