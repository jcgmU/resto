import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { Response } from 'express';

export function createServiceProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path: string) => path.replace(/^\/v1/, ''),
    on: {
      proxyReq: (proxyReq: any, req: any) => {
        if (process.env.INTERNAL_SHARED_SECRET) {
          proxyReq.setHeader('x-internal-token', process.env.INTERNAL_SHARED_SECRET);
        }

        const user = req.user;
        if (user) {
          if (user.userId) proxyReq.setHeader('x-user-id', String(user.userId));
          if (user.tenantId) proxyReq.setHeader('x-tenant-id', String(user.tenantId));
          if (user.role) proxyReq.setHeader('x-user-role', String(user.role));
          if (user.sessionId) proxyReq.setHeader('x-session-id', String(user.sessionId));
        }

        fixRequestBody(proxyReq, req);
      },
      error: (err: any, req: any, res: any) => {
        console.error(`[Gateway Proxy Error] ${req?.method} ${req?.url}:`, err?.message || err);
        const expressRes = res as Response;
        if (typeof expressRes.status === 'function' && !expressRes.headersSent) {
          expressRes.status(502).json({
            error: {
              code: 'UPSTREAM_UNAVAILABLE',
              message: 'Servicio destino no disponible',
            },
          });
        }
      },
    },
  });
}
