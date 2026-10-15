import http from 'http';
import https from 'https';
import { URL } from 'url';
import { IdentitySettingsPort, OperatingMode } from '@packages/shared-types';

interface CacheEntry {
  operatingMode: OperatingMode;
  expiresAt: number;
}

export class HttpIdentitySettingsAdapter implements IdentitySettingsPort {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private readonly identityBaseUrl: string = process.env.IDENTITY_INTERNAL_URL || process.env.IDENTITY_URL || 'http://localhost:4001',
    private readonly cacheTtlMs: number = 30000 // 30s <= 60s
  ) {}

  clearCache(): void {
    this.cache.clear();
  }

  setCachedMode(tenantId: string, operatingMode: OperatingMode, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.cacheTtlMs);
    this.cache.set(tenantId, { operatingMode, expiresAt });
  }

  async getOperatingMode(tenantId: string): Promise<OperatingMode> {
    const now = Date.now();
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > now) {
      return cached.operatingMode;
    }

    try {
      const mode = await this.fetchOperatingModeFromIdentity(tenantId);
      this.cache.set(tenantId, {
        operatingMode: mode,
        expiresAt: now + this.cacheTtlMs,
      });
      return mode;
    } catch {
      // Fallback seguro a hybrid ante fallos transitorios de red o servicios no levantados
      return 'hybrid';
    }
  }

  private fetchOperatingModeFromIdentity(tenantId: string): Promise<OperatingMode> {
    const fullUrl = `${this.identityBaseUrl.replace(/\/$/, '')}/tenant/settings`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    return new Promise<OperatingMode>((resolve, reject) => {
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
              try {
                const parsedBody = JSON.parse(data);
                const mode: OperatingMode = parsedBody.operatingMode === 'waiter_only' ? 'waiter_only' : 'hybrid';
                resolve(mode);
              } catch (parseErr) {
                reject(new Error(`Failed to parse settings JSON: ${(parseErr as Error).message}`));
              }
            } else {
              reject(new Error(`Identity settings responded with status ${res.statusCode}: ${data}`));
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(new Error(`Failed to call Identity settings: ${err.message}`));
      });

      req.end();
    });
  }
}
