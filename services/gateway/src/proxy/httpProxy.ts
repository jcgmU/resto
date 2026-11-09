import { createProxyMiddleware } from 'http-proxy-middleware';
import { Response } from 'express';

export function createServiceProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path: string) => path.replace(/^\/v1/, ''),
    on: {
      proxyReq: (proxyReq: any, req: any) => {
        // Eliminar cabeceras de identidad que pudieran venir inyectadas por el cliente
        proxyReq.removeHeader('x-user-id');
        proxyReq.removeHeader('x-tenant-id');
        proxyReq.removeHeader('x-user-role');
        proxyReq.removeHeader('x-role');
        proxyReq.removeHeader('x-session-id');
        proxyReq.removeHeader('x-table-id');

        const user = req.user;
        if (user) {
          if (user.userId) proxyReq.setHeader('x-user-id', String(user.userId));
          if (user.tenantId) proxyReq.setHeader('x-tenant-id', String(user.tenantId));
          const role = user.role || (user.sessionId ? 'GUEST' : undefined);
          if (role) proxyReq.setHeader('x-user-role', String(role));
          if (user.sessionId) proxyReq.setHeader('x-session-id', String(user.sessionId));
          if (user.tableId) proxyReq.setHeader('x-table-id', String(user.tableId));
        }

        if (req.body !== undefined && req.body !== null) {
          const contentLength = req.headers?.['content-length'];
          const hasTransferEncoding = Boolean(req.headers?.['transfer-encoding']);
          const hasExplicitBody =
            (contentLength !== undefined && Number(contentLength) > 0) ||
            hasTransferEncoding ||
            Object.keys(req.body).length > 0;

          if (hasExplicitBody) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
          }
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
