---
tags: [proyecto, entorno]
---
# Entorno local

```bash
cd ~/Developer/Resto
docker compose --profile services up -d --build   # 7 contenedores
pnpm install
pnpm -r run build
pnpm -r test
cd apps/admin-dashboard && pnpm dev   # :3000
cd apps/client-pwa && pnpm dev        # :3001
```

- Reconstruir imágenes Docker **con los dev servers apagados** y reiniciarlos después (si no, se corrompe `.next`).
- No versionar: `.env.local`, `**/generated/client/*.so.node`, `.agents/`, scripts `fix_*.js` sueltos.
- Originalmente desarrollado en Windows (`OneDrive\Desktop\Resto\Resto`); esta copia es el clon macOS.
