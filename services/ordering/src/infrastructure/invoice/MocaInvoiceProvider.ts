import http from 'http';
import https from 'https';
import { URL } from 'url';
import { InvoiceIssueInput, InvoiceIssueResult, InvoiceProvider } from '@packages/shared-types';

/**
 * MocaInvoiceProvider - Adaptador para facturación DIAN vía proveedor Moca.
 *
 * PENDIENTE DE DOCUMENTACIÓN DEL PROVEEDOR:
 * Configurado estrictamente vía variables de entorno (MOCA_API_URL, MOCA_ACCOUNT_ID, MOCA_API_KEY).
 * Si faltan las credenciales, devuelve estado 'pending' con aviso y nunca bloquea el cobro.
 */
export class MocaInvoiceProvider implements InvoiceProvider {
  constructor(
    private readonly apiUrl: string = process.env.MOCA_API_URL || '',
    private readonly accountId: string = process.env.MOCA_ACCOUNT_ID || '',
    private readonly apiKey: string = process.env.MOCA_API_KEY || ''
  ) {}

  async issue(input: InvoiceIssueInput): Promise<InvoiceIssueResult> {
    if (!this.apiUrl || !this.accountId || !this.apiKey) {
      return {
        status: 'pending',
        error: 'requiere credenciales configuradas',
        ref: `pending-${input.paymentId.substring(0, 8)}`,
      };
    }

    try {
      const parsed = new URL(`${this.apiUrl.replace(/\/+$/, '')}/invoices`);
      const isHttps = parsed.protocol === 'https:';
      const transport = isHttps ? https : http;

      const payload = JSON.stringify({
        paymentId: input.paymentId,
        amount: input.amount,
        currency: 'COP',
        customer: {
          identificationType: input.customer?.type === 'business' ? 'NIT' : 'CC',
          identificationNumber: input.customer?.taxId || '222222222222',
          legalName: input.customer?.legalName || 'Consumidor Final',
          email: input.customer?.email || 'factura@resto.com',
        },
        items: input.items || [],
        issuedAt: new Date().toISOString(),
      });

      return await new Promise<InvoiceIssueResult>((resolve) => {
        const req = transport.request(
          {
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
              'Authorization': `Bearer ${this.apiKey}`,
              'x-account-id': this.accountId,
            },
            timeout: 5000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                try {
                  const parsedJson = JSON.parse(data);
                  const ref = parsedJson.invoiceId || parsedJson.ref || parsedJson.cufe || `MOCA-${Date.now()}`;
                  resolve({ status: 'issued', ref });
                } catch {
                  resolve({ status: 'issued', ref: `MOCA-${Date.now()}` });
                }
              } else {
                resolve({
                  status: 'error',
                  error: `Error proveedor DIAN (HTTP ${res.statusCode}): ${data}`,
                });
              }
            });
          }
        );

        req.on('error', (err) => {
          resolve({
            status: 'error',
            error: err?.message || 'Fallo de conexión con proveedor DIAN',
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            status: 'error',
            error: 'Timeout al conectar con proveedor DIAN',
          });
        });

        req.write(payload);
        req.end();
      });
    } catch (err: any) {
      return {
        status: 'error',
        error: err?.message || 'Error al procesar emisión con proveedor DIAN',
      };
    }
  }
}
