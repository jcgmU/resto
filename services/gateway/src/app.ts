import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { notFoundHandler, errorHandler } from './middleware/errors';
import { createServiceProxy } from './proxy/httpProxy';
import { attachSocketGateway } from './proxy/socketProxy';
import { routeTable } from './routes/routeTable';

// Hook http.createServer to attach Socket.io gateway when our Express app is passed
if (!(http as any)._originalCreateServer) {
  (http as any)._originalCreateServer = http.createServer;
}
(http as any).createServer = function (this: any, ...args: any[]) {
  const server = (http as any)._originalCreateServer.apply(this, args as any);
  if (args[0] && (args[0] as any)._isGatewayApp && (args[0] as any)._attachSockets && !(server as any)._hasSocketGateway) {
    (server as any)._hasSocketGateway = true;
    (server as any)._socketGatewayIo = attachSocketGateway(server);
  }
  return server;
};

function checkServiceHealth(baseUrl: string, timeoutMs = 2000): Promise<'up' | 'down'> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: 'up' | 'down') => {
      if (!settled) {
        settled = true;
        resolve(status);
      }
    };

    try {
      const targetUrl = new URL('/health', baseUrl);
      const req = http.get(
        targetUrl,
        {
          timeout: timeoutMs,
          headers: config.internalSharedSecret
            ? { 'x-internal-token': config.internalSharedSecret }
            : undefined,
        },
        (res) => {
          res.resume();
          finish(res.statusCode === 200 ? 'up' : 'down');
        }
      );

      req.on('timeout', () => {
        req.destroy();
        finish('down');
      });

      req.on('error', () => {
        finish('down');
      });
    } catch {
      finish('down');
    }
  });
}

export function createApp(): express.Application {
  const app: express.Application = express();
  (app as any)._isGatewayApp = true;
  if (process.env.NODE_ENV !== 'test') {
    (app as any)._attachSockets = true;
  }

  // Middlewares globales
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  // Endpoints de salud: liveness y alias
  app.get(['/health', '/health/live'], (_req, res) => {
    res.status(200).json({ status: 'live' });
  });

  // Endpoint de salud: readiness con timeout de 2000ms sobre los 4 microservicios
  app.get('/health/ready', async (_req, res) => {
    const identityUrl = process.env.IDENTITY_SERVICE_URL || config.services.identity;
    const catalogUrl = process.env.CATALOG_SERVICE_URL || config.services.catalog;
    const sessionUrl = process.env.SESSION_SERVICE_URL || config.services.session;
    const orderingUrl = process.env.ORDERING_SERVICE_URL || config.services.ordering;

    const [identity, catalog, session, ordering] = await Promise.all([
      checkServiceHealth(identityUrl),
      checkServiceHealth(catalogUrl),
      checkServiceHealth(sessionUrl),
      checkServiceHealth(orderingUrl),
    ]);

    const services = {
      identity,
      catalog,
      session,
      ordering,
    };

    const isReady =
      identity === 'up' &&
      catalog === 'up' &&
      session === 'up' &&
      ordering === 'up';

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        services,
      });
    } else {
      res.status(503).json({
        status: 'unready',
        services,
      });
    }
  });

  // Registro declarativo de rutas según routeTable
  for (const route of routeTable) {
    const method = (route.method || 'ALL').toUpperCase();
    const handlers: express.RequestHandler[] = [];

    if (route.auth) {
      handlers.push(authMiddleware(route.requiredRoles));
    }

    handlers.push(createServiceProxy(config.services[route.targetService]) as any);

    switch (method) {
      case 'GET':
        app.get(route.path, ...handlers);
        break;
      case 'POST':
        app.post(route.path, ...handlers);
        break;
      case 'PATCH':
        app.patch(route.path, ...handlers);
        break;
      case 'PUT':
        app.put(route.path, ...handlers);
        break;
      case 'DELETE':
        app.delete(route.path, ...handlers);
        break;
      default:
        app.all(route.path, ...handlers);
        break;
    }
  }

  // Manejo de errores y 404
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app: express.Application = createApp();
