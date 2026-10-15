import { createProxyMiddleware } from 'http-proxy-middleware';
import { Response } from 'express';

export function createServiceProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path: string) => path.replace(/^\/v1/, ''),
    on: {
      proxyReq: (proxyReq: any, req: any) => {
        proxyReq.setHeader(
          'x-internal-token',
          process.env.INTERNAL_SHARED_SECRET || 'resto-internal-shared-secret-dev-2026'
        );

        const user = req.user;
        if (user) {
          if (user.userId) proxyReq.setHeader('x-user-id', String(user.userId));
          if (user.tenantId) proxyReq.setHeader('x-tenant-id', String(user.tenantId));
          if (user.role) proxyReq.setHeader('x-user-role', String(user.role));
          if (user.sessionId) proxyReq.setHeader('x-session-id', String(user.sessionId));
        }

        if (req.body && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
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
