import { MocaInvoiceProvider } from '../../src/infrastructure/invoice/MocaInvoiceProvider';
import nock from 'nock';

describe('MocaInvoiceProvider - Adaptador DIAN via Moca', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test('1. Sin credenciales de entorno -> status: pending con aviso y ref provisional', async () => {
    const provider = new MocaInvoiceProvider('', '', '');
    const result = await provider.issue({
      tenantId: 't1',
      paymentId: 'pay-12345678',
      amount: 45000,
      customer: {
        type: 'final_consumer',
        taxId: '222222222222',
        legalName: 'Consumidor Final',
      },
    });

    expect(result.status).toBe('pending');
    expect(result.error).toContain('requiere credenciales');
    expect(result.ref).toBeDefined();
  });

  test('2. Con credenciales y respuesta exitosa del proveedor -> status: issued con ref oficial', async () => {
    const mockUrl = 'https://api.moca.mock';
    nock(mockUrl)
      .post('/invoices', (body) => {
        return body.paymentId === 'pay-123' && body.amount === 50000;
      })
      .reply(200, {
        invoiceId: 'MOCA-DIAN-98765',
        cufe: 'cufe-sha384-xyz',
      });

    const provider = new MocaInvoiceProvider(mockUrl, 'acc-tenant-1', 'moca-secret-key');
    const result = await provider.issue({
      tenantId: 't1',
      paymentId: 'pay-123',
      amount: 50000,
      items: [{ name: 'Hamburguesa', quantity: 1, unitPrice: 50000, total: 50000 }],
    });

    expect(result.status).toBe('issued');
    expect(result.ref).toBe('MOCA-DIAN-98765');
  });

  test('3. Con credenciales pero proveedor responde error 500 -> status: error no bloqueante', async () => {
    const mockUrl = 'https://api.moca.mock';
    nock(mockUrl)
      .post('/invoices')
      .reply(500, 'Internal DIAN Gateway Error');

    const provider = new MocaInvoiceProvider(mockUrl, 'acc-tenant-1', 'moca-secret-key');
    const result = await provider.issue({
      tenantId: 't1',
      paymentId: 'pay-123',
      amount: 50000,
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('HTTP 500');
  });
});
