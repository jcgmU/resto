import http from 'http';
import https from 'https';
import { URL } from 'url';
import { IdentitySettingsPort, OperatingMode } from '@packages/shared-types';

interface SettingsCacheEntry {
  operatingMode: OperatingMode;
  estimatedPrepMinutes: number;
  expiresAt: number;
}

export class HttpIdentitySettingsAdapter implements IdentitySettingsPort {
  private cache = new Map<string, SettingsCacheEntry>();

  constructor(
    private readonly identityBaseUrl: string = process.env.IDENTITY_INTERNAL_URL || process.env.IDENTITY_URL || 'http://localhost:4001',
    private readonly cacheTtlMs: number = 30000 // 30s <= 60s
  ) {}

  clearCache(): void {
    this.cache.clear();
  }

  setCachedMode(tenantId: string, operatingMode: OperatingMode, ttlMs?: number): void {
    const existing = this.cache.get(tenantId);
    const expiresAt = Date.now() + (ttlMs ?? this.cacheTtlMs);
    this.cache.set(tenantId, {
      operatingMode,
      estimatedPrepMinutes: existing?.estimatedPrepMinutes ?? 18,
      expiresAt,
    });
  }

  setCachedSettings(tenantId: string, settings: { operatingMode?: OperatingMode; estimatedPrepMinutes?: number }, ttlMs?: number): void {
    const existing = this.cache.get(tenantId);
    const expiresAt = Date.now() + (ttlMs ?? this.cacheTtlMs);
    this.cache.set(tenantId, {
      operatingMode: settings.operatingMode ?? existing?.operatingMode ?? 'hybrid',
      estimatedPrepMinutes: settings.estimatedPrepMinutes ?? existing?.estimatedPrepMinutes ?? 18,
      expiresAt,
    });
  }

  async getOperatingMode(tenantId: string): Promise<OperatingMode> {
    const settings = await this.getSettings(tenantId);
    return settings.operatingMode;
  }

  async getEstimatedPrepMinutes(tenantId: string): Promise<number> {
    const settings = await this.getSettings(tenantId);
    return settings.estimatedPrepMinutes;
  }

  private async getSettings(tenantId: string): Promise<{ operatingMode: OperatingMode; estimatedPrepMinutes: number }> {
    const now = Date.now();
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > now) {
      return {
        operatingMode: cached.operatingMode,
        estimatedPrepMinutes: cached.estimatedPrepMinutes,
      };
    }

    try {
      const settings = await this.fetchSettingsFromIdentity(tenantId);
      this.cache.set(tenantId, {
        operatingMode: settings.operatingMode,
        estimatedPrepMinutes: settings.estimatedPrepMinutes,
        expiresAt: now + this.cacheTtlMs,
      });
      return settings;
    } catch (err: any) {
      console.warn(`[HttpIdentitySettingsAdapter] Fallo al consultar settings de Identity para tenant ${tenantId}. Fallback availability-first a 'hybrid' y 18m: ${err?.message || String(err)}`);
      return {
        operatingMode: 'hybrid',
        estimatedPrepMinutes: 18,
      };
    }
  }

  private fetchSettingsFromIdentity(tenantId: string): Promise<{ operatingMode: OperatingMode; estimatedPrepMinutes: number }> {
    const fullUrl = `${this.identityBaseUrl.replace(/\/$/, '')}/internal/tenant/${encodeURIComponent(tenantId)}/settings`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    return new Promise<{ operatingMode: OperatingMode; estimatedPrepMinutes: number }>((resolve, reject) => {
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
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsedBody = JSON.parse(data);
                const mode: OperatingMode = parsedBody.operatingMode === 'waiter_only' ? 'waiter_only' : 'hybrid';
                const prepMinutes: number = typeof parsedBody.estimatedPrepMinutes === 'number' ? parsedBody.estimatedPrepMinutes : 18;
                resolve({ operatingMode: mode, estimatedPrepMinutes: prepMinutes });
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

