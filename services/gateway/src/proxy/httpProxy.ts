import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { Response } from 'express';

const SESSION_SELECTING_ROLES = new Set(['ADMIN', 'MANAGER', 'STAFF', 'WAITER']);

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

        const clientSessionId = req.headers?.['x-session-id'];

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
          if (user.sessionId) {
            proxyReq.setHeader('x-session-id', String(user.sessionId));
          } else if (
            typeof clientSessionId === 'string' &&
            clientSessionId &&
            SESSION_SELECTING_ROLES.has(String(user.role || '').toUpperCase())
          ) {
            // El personal opera sobre la sesión de la mesa que elige; un guest siempre queda atado a su token
            proxyReq.setHeader('x-session-id', clientSessionId);
          }
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
          } else {
            fixRequestBody(proxyReq, req);
          }
        } else {
          fixRequestBody(proxyReq, req);
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
