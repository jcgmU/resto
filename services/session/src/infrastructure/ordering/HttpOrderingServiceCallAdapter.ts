import http from 'http';
import https from 'https';
import { URL } from 'url';
import { ServiceCallDTO } from '@packages/shared-types';
import { OrderingServiceCallPort } from '../../domain/orderingPorts';

export class HttpOrderingServiceCallAdapter implements OrderingServiceCallPort {
  constructor(
    private readonly orderingBaseUrl: string = process.env.ORDERING_INTERNAL_URL || process.env.ORDERING_URL || 'http://localhost:4004'
  ) {}

  async createServiceCall(params: {
    tenantId: string;
    sessionId: string;
    tableId?: string;
    type: 'WAITER_CALL' | 'BILL_REQUEST' | 'GENERIC';
    note?: string;
  }): Promise<ServiceCallDTO> {
    const fullUrl = `${this.orderingBaseUrl.replace(/\/$/, '')}/service-calls`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const requestBody = JSON.stringify({
      type: params.type,
      tableId: params.tableId,
      note: params.note,
    });

    return new Promise<ServiceCallDTO>((resolve, reject) => {
      const req = transport.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(requestBody),
            'x-tenant-id': params.tenantId,
            'x-session-id': params.sessionId,
            'x-user-role': 'guest',
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
                resolve(parsedBody);
              } catch (parseErr) {
                reject(new Error(`Failed to parse ordering service-call response: ${(parseErr as Error).message}`));
              }
            } else {
              reject(new Error(`Ordering service-calls responded with status ${res.statusCode}: ${data}`));
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(new Error(`Failed to call ordering service-calls: ${err.message}`));
      });

      req.write(requestBody);
      req.end();
    });
  }
}
