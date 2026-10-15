# ADR: Refresh token — hash único, rotación atómica y refresh coordinado en front

- **Fecha:** 2026-10-14
- **Estado:** Aceptado
- **Hilo:** correcciones-qa-y-notas (R07)
- **Contexto:** Emisión persiste `sha256(raw)` pero el lookup busca `hash_<raw>` (convención del fake) → todo refresh real devuelve 401; la sesión efectiva del admin son 15 min. Además el frontend dispara N refreshes concurrentes ante N 401 → logout inesperado.
- **Decisión:**
  1. Cálculo de hash centralizado en un único util (`hashRefreshToken`, sha256) usado por emisión y lookup en identity.
  2. Rotación atómica tipo compare-and-swap: `updateMany({ tokenHash, revokedAt: null, expiresAt: gt(now) }, { revokedAt: now })` debe afectar 1 fila; si afecta 0 → 401. Dos refreshes concurrentes con el mismo token: solo uno gana.
  3. Reuso de token revocado → 401 (sin revocación de familia en MVP; queda como riesgo documentado).
  4. Frontend admin: promesa de refresh compartida a nivel módulo en `lib/api.ts` — N requests con 401 esperan la misma renovación; solo si el refresh falla se hace logout. El socket del KDS obtiene token fresco al (re)conectar.
- **Consecuencias:** Tests de contrato con `PrismaRefreshTokenRepository` real: primer refresh funciona, reuso falla, doble refresh concurrente solo emite un par. El fake `hash_<raw>` desaparece o se alinea al mismo util.
