import http from 'http';
import https from 'https';
import { URL } from 'url';
import { SessionServicePort, TableSessionDTO } from '@packages/shared-types';
import { SessionCloseFailedError, SessionUnreachableError } from '../../domain/errors';
import { OrderingSessionPort, SessionInfo } from '../../domain/sessionValidation';

export const SESSION_REQUEST_TIMEOUT_MS = 5000;

export class HttpSessionServiceAdapter implements SessionServicePort, OrderingSessionPort {
  constructor(
    private readonly sessionInternalUrl: string,
    private readonly timeoutMs: number = SESSION_REQUEST_TIMEOUT_MS
  ) {}

  async getSession(tenantId: string, sessionId: string): Promise<TableSessionDTO | null> {
    const fullUrl = `${this.sessionInternalUrl.replace(/\/$/, '')}/sessions/${encodeURIComponent(sessionId)}`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    return new Promise<TableSessionDTO | null>((resolve, reject) => {
      let timeoutTimer: NodeJS.Timeout | null = null;

      const req = transport.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': tenantId,
            'x-session-id': sessionId,
            'x-user-role': 'system',
            ...(process.env.INTERNAL_SHARED_SECRET
              ? { 'x-internal-token': process.env.INTERNAL_SHARED_SECRET }
              : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('error', (err) => {
            if (timeoutTimer) {
              clearTimeout(timeoutTimer);
              timeoutTimer = null;
            }
            reject(
              new SessionUnreachableError(
                `Fallo al leer respuesta de session service: ${err.message}`
              )
            );
          });
          res.on('end', () => {
            if (timeoutTimer) {
              clearTimeout(timeoutTimer);
              timeoutTimer = null;
            }
            if (res.statusCode === 200) {
              try {
                const parsedData = JSON.parse(data);
                resolve({
                  ...parsedData,
                  sessionId: parsedData.sessionId || parsedData.id,
                  tenantId: parsedData.tenantId,
                  tableId: parsedData.tableId,
                  status: parsedData.status,
                } as TableSessionDTO);
              } catch (parseErr: any) {
                reject(new SessionUnreachableError(`Respuesta inválida de sesión: ${parseErr.message}`));
              }
            } else if (res.statusCode === 404) {
              resolve(null);
            } else if (res.statusCode && res.statusCode >= 500) {
              reject(
                new SessionUnreachableError(
                  `Session service responded with status ${res.statusCode}: ${data}`
                )
              );
            } else {
              reject(
                new SessionUnreachableError(
                  `Session service responded with status ${res.statusCode}: ${data}`
                )
              );
            }
          });
        }
      );

      req.on('error', (err) => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        if (err instanceof SessionUnreachableError) {
          reject(err);
        } else {
          reject(
            new SessionUnreachableError(
              `Fallo de transporte al contactar session service: ${err.message}`
            )
          );
        }
      });

      req.setTimeout(this.timeoutMs, () => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        req.destroy(new SessionUnreachableError('Timeout de conexión con session service'));
      });

      timeoutTimer = setTimeout(() => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        req.destroy(new SessionUnreachableError('Timeout de petición con session service'));
      }, this.timeoutMs);

      req.end();
    });
  }

  async closeSession(
    tenantId: string,
    sessionId: string,
    requester: { userId: string; role: string }
  ): Promise<void> {
    const fullUrl = `${this.sessionInternalUrl.replace(/\/$/, '')}/sessions/${encodeURIComponent(sessionId)}/close`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    return new Promise<void>((resolve, reject) => {
      let timeoutTimer: NodeJS.Timeout | null = null;

      const req = transport.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            'x-tenant-id': tenantId,
            'x-user-id': requester.userId,
            'x-user-role': requester.role,
            ...(process.env.INTERNAL_SHARED_SECRET
              ? { 'x-internal-token': process.env.INTERNAL_SHARED_SECRET }
              : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('error', (err) => {
            if (timeoutTimer) {
              clearTimeout(timeoutTimer);
              timeoutTimer = null;
            }
            reject(
              new SessionUnreachableError(
                `SESSION_UNREACHABLE: Fallo al leer respuesta al cerrar sesión: ${err.message}`
              )
            );
          });
          res.on('end', () => {
            if (timeoutTimer) {
              clearTimeout(timeoutTimer);
              timeoutTimer = null;
            }
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(
                new SessionCloseFailedError(
                  `SESSION_CLOSE_FAILED: Session service responded with status ${res.statusCode}: ${data}`
                )
              );
            }
          });
        }
      );

      req.on('error', (err) => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        if (err.message && err.message.includes('Timeout')) {
          reject(
            new SessionUnreachableError(
              `SESSION_UNREACHABLE: Timeout al cerrar sesión: ${err.message}`
            )
          );
        } else {
          reject(
            new SessionCloseFailedError(
              `SESSION_CLOSE_FAILED: Failed to call session service: ${err.message}`
            )
          );
        }
      });

      req.setTimeout(this.timeoutMs, () => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        req.destroy(new SessionUnreachableError('Timeout al cerrar sesión'));
      });

      timeoutTimer = setTimeout(() => {
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        req.destroy(new SessionUnreachableError('Timeout al cerrar sesión'));
      }, this.timeoutMs);

      req.end();
    });
  }
}
