---
tags: [bugs]
---
# Bugs conocidos

## Abiertos
- [ ] **Hidratación React en `client-pwa`** — ruta `/t/[tenantId]/[tableId]/menu`, "Hydration failed" en `ClientMenuPage > GuestSessionGuard > main`. Fondo gris/texto superpuesto hasta re-render. No bloqueante.

## Patrón repetido (revisar siempre que algo "no fluye")
Los tests con fakes/mocks no los detectaron; aparecieron solo en Docker/UI real:
1. Roles case-sensitive (`'staff'` vs `'ADMIN'` del JWT) → usar `.toLowerCase()`.
2. Proxy de sockets sin reenviar el JWT en el handshake upstream.
3. `process.env[var]` dinámico en Next: solo se inlinea `NEXT_PUBLIC_X` literal.
4. Shape de mocks distinto al real (`tableId` vs `id`).
5. Composition roots cableados a `InMemory*` en vez de Prisma/Redis.

## Resueltos (referencia)
Ver `03_Oleadas/Estado_MVP.md`, entradas 2026-10-06 y 2026-10-07.
