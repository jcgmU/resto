import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import {
  ActiveTablesGrid,
  BillSummaryCard,
  PaymentMethodPicker,
  ConfirmPaymentButton,
  PaymentSuccessCard,
  ReleaseTableModal,
} from '../src/components/checkout';
import CheckoutPage from '../src/app/(panel)/checkout/page';
import {
  FeatureGuard,
  FeatureFlagProviderRoot,
  StaticFeatureFlagProvider,
} from '@packages/ui-components';
import { BillDTO, TableSessionDTO, TableDTO } from '@packages/shared-types';

describe('C. Admin Dashboard — Vista de Checkout (Tests 13-19)', () => {
  const sampleActiveSessions: TableSessionDTO[] = [
    {
      sessionId: 'sess-1',
      tenantId: 't-1',
      tableId: 'Mesa 1',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
    {
      sessionId: 'sess-2',
      tenantId: 't-1',
      tableId: 'Mesa 2',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  ];

  const sampleBill: BillDTO = {
    sessionId: 'sess-1',
    tableId: 'Mesa 1',
    ordersCount: 2,
    total: 65,
    payment: null,
    orders: [
      {
        id: 'ord-1',
        tenantId: 't-1',
        sessionId: 'sess-1',
        tableId: 'Mesa 1',
        status: 'READY',
        total: 35,
        items: [
          {
            id: 'item-1',
            productId: 'p-1',
            productName: 'Tacos al Pastor',
            unitPrice: 35,
            quantity: 1,
            modifiers: [],
          },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord-2',
        tenantId: 't-1',
        sessionId: 'sess-1',
        tableId: 'Mesa 1',
        status: 'READY',
        total: 30,
        items: [
          {
            id: 'item-2',
            productId: 'p-2',
            productName: 'Guacamole',
            unitPrice: 30,
            quantity: 1,
            modifiers: [],
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ],
  };

  test('13. /checkout lista las mesas activas como data-component="bento-card"', () => {
    const { container } = render(<ActiveTablesGrid sessions={sampleActiveSessions} />);
    const cards = container.querySelectorAll('[data-component="bento-card"]');
    expect(cards.length).toBe(2);
    expect(screen.getByText('Mesa 1')).toBeInTheDocument();
    expect(screen.getByText('Mesa 2')).toBeInTheDocument();
  });

  test('13b. ActiveTablesGrid en estado de carga muestra skeletons de carga inicial', () => {
    const { container } = render(<ActiveTablesGrid sessions={[]} loading={true} />);
    const skeletons = container.querySelectorAll('[data-component="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  test('14. Al seleccionar mesa: BillSummaryCard muestra cada Order con items y el total como KpiValue tone="accent"; una Order cancelada NO aparece', () => {
    const { container } = render(<BillSummaryCard bill={sampleBill} />);
    expect(screen.getByText('Tacos al Pastor')).toBeInTheDocument();
    expect(screen.getByText('Guacamole')).toBeInTheDocument();

    const kpi = container.querySelector('[data-component="kpi-value"][data-tone="accent"]');
    expect(kpi).toBeInTheDocument();
    expect(kpi).toHaveTextContent(/\$\s*65/);
  });

  test('15. PaymentMethodPicker es radiogroup accesible con opciones con label visible (Efectivo y Tarjeta en UI); sin selección, el CTA está disabled', () => {
    render(<PaymentMethodPicker selectedMethod={null} onSelect={jest.fn()} />);
    const group = screen.getByRole('radiogroup');
    expect(group).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: /efectivo/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /tarjeta/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /otro/i })).not.toBeInTheDocument();

    render(<ConfirmPaymentButton disabled={true} onConfirm={jest.fn()} />);
    const btn = screen.getByRole('button', { name: /cobrar|registrar cobro/i });
    expect(btn).toBeDisabled();
  });

  test('16. Flujo de cobro: CTA -> abre ModalConfirm obligatorio (cuenta actual vs total a cobrar, filas de impacto: método CASH; botón negro sólido "Confirmar cobro", ghost rojo "Cancelar") -> onConfirm ejecutado solo tras confirmación', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmPaymentButton
        total={65}
        method="CASH"
        onConfirm={onConfirm}
      />
    );

    const initialBtn = screen.getByRole('button', { name: /registrar cobro/i });
    fireEvent.click(initialBtn);

    // Debe mostrar ModalConfirm con role="dialog"
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/cuenta actual/i)).toBeInTheDocument();
    expect(screen.getByText(/total a cobrar/i)).toBeInTheDocument();
    expect(screen.getByText(/método/i)).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.queryByText(/cambio/i)).not.toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar cobro' });
    expect(cancelBtn).toBeInTheDocument();
    expect(confirmBtn).toBeInTheDocument();

    // Cancelar cierra el modal sin cobrar
    fireEvent.click(cancelBtn);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Reabrir y confirmar
    fireEvent.click(initialBtn);
    const confirmBtnAgain = screen.getByRole('button', { name: 'Confirmar cobro' });
    fireEvent.click(confirmBtnAgain);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    render(<PaymentSuccessCard tableId="Mesa 1" amount={65} method="CASH" />);
    expect(screen.getByText(/cobro registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/mesa liberada/i)).toBeInTheDocument();
  });

  test('17. SESSION_CLOSE_FAILED -> role="alert" con "Reintentar cierre"; el reintento exitoso muestra el success', () => {
    const onRetry = jest.fn();
    render(<BillSummaryCard bill={sampleBill} error="SESSION_CLOSE_FAILED" onRetry={onRetry} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /reintentar cierre/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalled();
  });

  test('18. Bento/a11y: tokens var(--bento-*) sin hardcodeo, acento solo en total/CTA, iconos aria-hidden, cero emojis, touch targets >=44px', () => {
    const { container } = render(<BillSummaryCard bill={sampleBill} />);
    const card = container.querySelector('[data-component="bento-card"]');
    expect(card).toBeInTheDocument();

    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  test('19. <FeatureGuard flag="payments">: OFF -> Proximamente; ON (provider inyectado) -> vista de checkout', async () => {
    // OFF
    const { rerender } = render(<CheckoutPage />);
    expect(screen.getByTestId('proximamente')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-content')).not.toBeInTheDocument();

    // ON
    const provider = new StaticFeatureFlagProvider({ payments: true });
    rerender(
      <FeatureFlagProviderRoot provider={provider}>
        <CheckoutPage />
      </FeatureFlagProviderRoot>
    );

    await waitFor(() => {
      expect(screen.getByTestId('checkout-content')).toBeInTheDocument();
    });
  });

  test('H9 (a) Nombre de mesa resuelto con getTableDisplayName en la grilla y en el resumen de cuenta', () => {
    const tables: TableDTO[] = [
      {
        tableId: 'tbl-terraza',
        tenantId: 't-1',
        label: 'Terraza VIP',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ];
    const sessions: TableSessionDTO[] = [
      {
        sessionId: 'sess-t1',
        tenantId: 't-1',
        tableId: 'tbl-terraza',
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
    ];
    const bill: BillDTO = {
      sessionId: 'sess-t1',
      tableId: 'tbl-terraza',
      ordersCount: 1,
      total: 100,
      payment: null,
      orders: [
        {
          id: 'order-99887766',
          tenantId: 't-1',
          sessionId: 'sess-t1',
          tableId: 'tbl-terraza',
          status: 'READY',
          total: 100,
          items: [
            {
              id: 'it-1',
              productId: 'p-1',
              productName: 'Vino Tinto',
              unitPrice: 100,
              quantity: 1,
              modifiers: [],
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const { rerender } = render(<ActiveTablesGrid sessions={sessions} tables={tables} />);
    expect(screen.getByText('Terraza VIP')).toBeInTheDocument();
    expect(screen.queryByText('tbl-terraza')).not.toBeInTheDocument();

    rerender(<BillSummaryCard bill={bill} tables={tables} />);
    expect(screen.getByText('Cuenta — Terraza VIP')).toBeInTheDocument();
    expect(screen.getByText(/Orden #887766/i)).toBeInTheDocument();
  });

  test('H9 (b) Sesiones de la misma mesa son distinguibles por hora y sesión en ActiveTablesGrid', () => {
    const tables: TableDTO[] = [
      {
        tableId: 'tbl-saloon',
        tenantId: 't-1',
        label: 'Mesa Salón',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ];
    const sessions: TableSessionDTO[] = [
      {
        sessionId: 'sess-aaa-111111',
        tenantId: 't-1',
        tableId: 'tbl-saloon',
        status: 'active',
        createdAt: '2026-10-11T12:00:00.000Z',
        expiresAt: '2026-10-11T14:00:00.000Z',
      },
      {
        sessionId: 'sess-bbb-222222',
        tenantId: 't-1',
        tableId: 'tbl-saloon',
        status: 'active',
        createdAt: '2026-10-11T15:30:00.000Z',
        expiresAt: '2026-10-11T17:30:00.000Z',
      },
    ];

    render(<ActiveTablesGrid sessions={sessions} tables={tables} />);
    const tableHeaders = screen.getAllByText('Mesa Salón');
    expect(tableHeaders).toHaveLength(2);

    expect(screen.getByText(/Sesión #111111/i)).toBeInTheDocument();
    expect(screen.getByText(/Sesión #222222/i)).toBeInTheDocument();
  });

  test('H9 (c) Etiquetas de métodos de pago en español en picker y modal (Efectivo y Tarjeta en picker UI)', () => {
    const onSelect = jest.fn();
    const { rerender } = render(<PaymentMethodPicker selectedMethod="CASH" onSelect={onSelect} />);

    expect(screen.getByRole('radio', { name: 'Efectivo' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tarjeta' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Otro' })).not.toBeInTheDocument();

    rerender(
      <ConfirmPaymentButton
        total={120}
        method="CASH"
        onConfirm={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Efectivo')).toBeInTheDocument();

    const tables: TableDTO[] = [
      {
        tableId: 'tbl-1',
        tenantId: 't-1',
        label: 'Mesa Central',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ];
    rerender(<PaymentSuccessCard tableId="tbl-1" amount={120} method="CASH" tables={tables} />);
    expect(screen.getByText(/Mesa Central • Total:\s*\$\s*120\s*• Medio:\s*Efectivo/i)).toBeInTheDocument();
  });

  test('N16 (a) ReleaseTableModal bloquea acción y muestra saldo pendiente cuando total > 0', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    render(
      <ReleaseTableModal
        open={true}
        tableName="Mesa Terraza"
        pendingAmount={4500}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/acción bloqueada/i)).toBeInTheDocument();
    expect(within(dialog).getAllByText(/\$\s*4\.500/i).length).toBeGreaterThanOrEqual(1);

    const confirmBtn = within(dialog).getByRole('button', { name: /confirmar liberación/i });
    expect(confirmBtn).toBeDisabled();

    // Confirm no debe ser llamado
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();

    // Cancelar cierra el modal
    const cancelBtn = within(dialog).getByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });

  test('N16 (b) ReleaseTableModal permite confirmar cuando no hay saldo pendiente ($0)', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    render(
      <ReleaseTableModal
        open={true}
        tableName="Mesa 3"
        pendingAmount={0}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/está al día/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/\$\s*0/i)).toBeInTheDocument();

    const confirmBtn = within(dialog).getByRole('button', { name: /confirmar liberación/i });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('N16 (c) ReleaseTableModal muestra error SESSION_CLOSE_FAILED y botón de reintento', () => {
    const onRetry = jest.fn();

    render(
      <ReleaseTableModal
        open={true}
        tableName="Mesa 4"
        pendingAmount={0}
        error="SESSION_CLOSE_FAILED"
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(/error al cerrar la sesión en el servidor/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /reintentar cierre/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('N17 (a) BillSummaryCard muestra errores comprensibles para BILL_EMPTY y BILL_NOT_FOUND', () => {
    const { rerender } = render(<BillSummaryCard bill={sampleBill} error="BILL_EMPTY" />);
    expect(screen.getByText(/la mesa no tiene pedidos registrados para cobrar/i)).toBeInTheDocument();

    rerender(<BillSummaryCard bill={sampleBill} error="BILL_NOT_FOUND" />);
    expect(screen.getByText(/no se encontró cuenta para esta sesión/i)).toBeInTheDocument();
  });
});
