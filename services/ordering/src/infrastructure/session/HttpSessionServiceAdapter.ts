import http from 'http';
import https from 'https';
import { URL } from 'url';
import { SessionServicePort, TableSessionDTO } from '@packages/shared-types';
import { SessionCloseFailedError } from '../../domain/errors';

export class HttpSessionServiceAdapter implements SessionServicePort {
  constructor(private readonly sessionInternalUrl: string) {}

  async getSession(tenantId: string, sessionId: string): Promise<TableSessionDTO | null> {
    const fullUrl = `${this.sessionInternalUrl.replace(/\/$/, '')}/sessions/${encodeURIComponent(sessionId)}`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    return new Promise<TableSessionDTO | null>((resolve, reject) => {
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
            'x-internal-token': process.env.INTERNAL_SHARED_SECRET || 'resto-internal-shared-secret-dev-2026',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 404) {
              resolve(null);
            } else if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed);
              } catch (parseErr) {
                reject(new Error(`Failed to parse session data: ${(parseErr as Error).message}`));
              }
            } else {
              reject(
                new Error(
                  `Session service responded with status ${res.statusCode}: ${data}`
                )
              );
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(new Error(`Failed to call session service: ${err.message}`));
      });

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
            'x-internal-token': process.env.INTERNAL_SHARED_SECRET || 'resto-internal-shared-secret-dev-2026',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
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
        reject(
          new SessionCloseFailedError(
            `SESSION_CLOSE_FAILED: Failed to call session service: ${err.message}`
          )
        );
      });

      req.end();
    });
  }
}
