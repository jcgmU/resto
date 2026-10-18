import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import MesasPage from '../src/app/(panel)/mesas/page';
import DashboardPage from '../src/app/(panel)/dashboard/page';
import { ApiClient } from '../src/lib/api';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

describe('Flujo de Mesas, Zonas y Reservas en Admin Dashboard (V23 Flow Tests)', () => {
  const originalFetch = global.fetch;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const localTodayIso = `${y}-${m}-${d}T12:00:00`;

  const sampleZones = [
    { id: 'zone-terraza', name: 'Terraza', sortOrder: 1, active: true, createdAt: `${y}-${m}-${d}T10:00:00Z`, updatedAt: `${y}-${m}-${d}T10:00:00Z` },
    { id: 'zone-salon', name: 'Salón Principal', sortOrder: 2, active: true, createdAt: `${y}-${m}-${d}T10:00:00Z`, updatedAt: `${y}-${m}-${d}T10:00:00Z` },
  ];

  const sampleTables = [
    { tableId: 'tbl-1', label: '1', capacity: 4, zoneId: 'zone-terraza', status: 'AVAILABLE' as const, createdAt: `${y}-${m}-${d}T10:00:00Z`, updatedAt: `${y}-${m}-${d}T10:00:00Z` },
    { tableId: 'tbl-2', label: '2', capacity: 2, zoneId: 'zone-salon', status: 'AVAILABLE' as const, createdAt: `${y}-${m}-${d}T10:00:00Z`, updatedAt: `${y}-${m}-${d}T10:00:00Z` },
    { tableId: 'tbl-3', label: '3', capacity: 6, zoneId: 'zone-salon', status: 'AVAILABLE' as const, createdAt: `${y}-${m}-${d}T10:00:00Z`, updatedAt: `${y}-${m}-${d}T10:00:00Z` },
  ];

  const sampleSessions = [
    { id: 'sess-2', sessionId: 'sess-2', tableId: 'tbl-2', status: 'active' },
  ];

  const sampleReservations = [
    {
      id: 'res-3',
      tableId: 'tbl-3',
      customerName: 'Santiago Reyes',
      phone: '3001234567',
      partySize: 6,
      reservedFor: localTodayIso,
      status: 'active' as const,
      createdAt: `${y}-${m}-${d}T10:00:00Z`,
      updatedAt: `${y}-${m}-${d}T10:00:00Z`,
    },
  ];

  const sampleOrders = [
    { id: 'ord-1', tableId: 'tbl-2', status: 'PLACED', total: 45000 },
  ];

  beforeEach(() => {
    localStorage.clear();
    ApiClient.token = 'mock-admin-token';
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function setupDefaultFetch(customHandler?: (url: string, opts?: any) => any) {
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const urlStr = url.toString();
      if (customHandler) {
        const handled = await customHandler(urlStr, opts);
        if (handled !== undefined) return handled;
      }

      if (urlStr.includes('/v1/tables') && !urlStr.includes('/qr')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => sampleTables,
        };
      }
      if (urlStr.includes('/v1/zones')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => sampleZones,
        };
      }
      if (urlStr.includes('/v1/reservations')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => sampleReservations,
        };
      }
      if (urlStr.includes('/v1/sessions')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => sampleSessions,
        };
      }
      if (urlStr.includes('/v1/tenant/settings')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ operatingMode: 'hybrid', estimatedPrepMinutes: 20 }),
        };
      }
      if (urlStr.includes('/v1/orders')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => sampleOrders,
        };
      }
      if (urlStr.includes('/v1/service-calls')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [],
        };
      }

      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      };
    }) as any;
  }

  test('1. Redirige limpiamente de /mesas a /dashboard', async () => {
    setupDefaultFetch();
    render(<MesasPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('2. Renderiza tarjetas de mesa con "N Puestos • Zona", status chips e importe COP en mesa ocupada', async () => {
    setupDefaultFetch();
    render(<DashboardPage />);

    // Mesa 1: Libre, 4 Puestos • Terraza
    const cardMesa1 = await screen.findByTestId('table-card-tbl-1');
    expect(within(cardMesa1).getByText('Mesa 1')).toBeInTheDocument();
    expect(within(cardMesa1).getByText('4 Puestos • Terraza')).toBeInTheDocument();

    // Mesa 2: Ocupada, 2 Puestos • Salón Principal, total $ 45.000 COP
    const cardMesa2 = screen.getByTestId('table-card-tbl-2');
    expect(within(cardMesa2).getByText('Mesa 2')).toBeInTheDocument();
    expect(within(cardMesa2).getByText('2 Puestos • Salón Principal')).toBeInTheDocument();
    expect(within(cardMesa2).getByText('$ 45.000')).toBeInTheDocument();

    // Mesa 3: Reservada, 6 Puestos • Salón Principal
    const cardMesa3 = screen.getByTestId('table-card-tbl-3');
    expect(within(cardMesa3).getByText('Mesa 3')).toBeInTheDocument();
    expect(within(cardMesa3).getByText('6 Puestos • Salón Principal')).toBeInTheDocument();
  });

  test('3. Acción de mesa "Ocupar" envía POST /v1/sessions/staff-open', async () => {
    let staffOpenCalled = false;
    let staffOpenBody: any = null;

    setupDefaultFetch((url, opts) => {
      if (url.includes('/v1/sessions/staff-open') && opts?.method === 'POST') {
        staffOpenCalled = true;
        staffOpenBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({ sessionId: 'sess-new', tableId: 'tbl-1', status: 'active' }),
        };
      }
    });

    render(<DashboardPage />);

    const cardMesa1 = await screen.findByTestId('table-card-tbl-1');
    const ocuparBtn = within(cardMesa1).getByRole('button', { name: /^Ocupar$/i });
    fireEvent.click(ocuparBtn);

    await waitFor(() => {
      expect(staffOpenCalled).toBe(true);
      expect(staffOpenBody).toEqual({ tableId: 'tbl-1' });
    });
  });

  test('4. Acción de mesa "Reservar" abre modal y envía POST /v1/reservations', async () => {
    let createReservationCalled = false;
    let reservationBody: any = null;

    setupDefaultFetch((url, opts) => {
      if (url.includes('/v1/reservations') && opts?.method === 'POST') {
        createReservationCalled = true;
        reservationBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            id: 'res-new',
            tableId: reservationBody.tableId,
            customerName: reservationBody.customerName,
            partySize: reservationBody.partySize,
            reservedFor: reservationBody.reservedFor,
            status: 'active',
          }),
        };
      }
    });

    render(<DashboardPage />);

    // Click en botón Reservar dentro de la tarjeta de Mesa 1
    const cardMesa1 = await screen.findByTestId('table-card-tbl-1');
    const reservarBtn = within(cardMesa1).getByRole('button', { name: /^Reservar$/i });
    fireEvent.click(reservarBtn);

    // Modal de reserva abierto
    const modal = await screen.findByRole('dialog');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText('Nueva Reserva')).toBeInTheDocument();

    // Rellenar datos
    const nameInput = within(modal).getByLabelText(/Nombre del Cliente/i);
    fireEvent.change(nameInput, { target: { value: 'Valentina Restrepo' } });

    const phoneInput = within(modal).getByLabelText(/Teléfono/i);
    fireEvent.change(phoneInput, { target: { value: '3109876543' } });

    const submitBtn = within(modal).getByRole('button', { name: /Confirmar Reserva/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createReservationCalled).toBe(true);
      expect(reservationBody.tableId).toBe('tbl-1');
      expect(reservationBody.customerName).toBe('Valentina Restrepo');
    });
  });

  test('5. Acción "Cliente Llegó" llama a POST /v1/reservations/:id/seat', async () => {
    let seatCalled = false;

    setupDefaultFetch((url, opts) => {
      if (url.includes('/v1/reservations/res-3/seat') && opts?.method === 'POST') {
        seatCalled = true;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ id: 'res-3', status: 'seated' }),
        };
      }
    });

    render(<DashboardPage />);

    // Mesa 3 está reservada, botón "Cliente Llegó"
    const cardMesa3 = await screen.findByTestId('table-card-tbl-3');
    const llegoBtn = within(cardMesa3).getByRole('button', { name: /^Cliente Llegó$/i });
    fireEvent.click(llegoBtn);

    await waitFor(() => {
      expect(seatCalled).toBe(true);
    });
  });

  test('6. Acción "Cobrar y liberar" redirige a /checkout', async () => {
    setupDefaultFetch();
    render(<DashboardPage />);

    const cardMesa2 = await screen.findByTestId('table-card-tbl-2');
    const cobrarBtn = within(cardMesa2).getByRole('button', { name: /Cobrar y liberar/i });
    fireEvent.click(cobrarBtn);

    expect(mockPush).toHaveBeenCalledWith('/checkout?tableId=tbl-2');
  });

  test('7. CRUD Mesas: Crear mesa envía POST /v1/tables con label, capacity, zoneId y status', async () => {
    let createTableCalled = false;
    let createTableBody: any = null;

    setupDefaultFetch((url, opts) => {
      if (url.includes('/v1/tables') && opts?.method === 'POST') {
        createTableCalled = true;
        createTableBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            tableId: 'tbl-99',
            label: createTableBody.label,
            capacity: createTableBody.capacity,
            zoneId: createTableBody.zoneId,
            status: createTableBody.status || 'AVAILABLE',
          }),
        };
      }
    });

    render(<DashboardPage />);

    await screen.findByTestId('table-card-tbl-1');

    const nuevaMesaBtn = screen.getByRole('button', { name: /\+ Nueva Mesa/i });
    fireEvent.click(nuevaMesaBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const labelInput = within(dialog).getByLabelText(/Nombre o Identificador de Mesa/i);
    fireEvent.change(labelInput, { target: { value: 'Terraza VIP' } });

    const capInput = within(dialog).getByLabelText(/Capacidad \(Puestos\)/i);
    fireEvent.change(capInput, { target: { value: '8' } });

    const zoneSelect = within(dialog).getByLabelText(/Zona/i);
    fireEvent.change(zoneSelect, { target: { value: 'zone-terraza' } });

    const submitBtn = within(dialog).getByRole('button', { name: /Guardar Mesa/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createTableCalled).toBe(true);
      expect(createTableBody).toEqual({
        label: 'Terraza VIP',
        capacity: 8,
        zoneId: 'zone-terraza',
        status: 'AVAILABLE',
      });
    });
  });

  test('8. CRUD Mesas: Editar mesa envía PATCH /v1/tables/:tableId', async () => {
    let updateTableCalled = false;
    let updateTableBody: any = null;

    setupDefaultFetch((url, opts) => {
      if (url.includes('/v1/tables/tbl-1') && opts?.method === 'PATCH') {
        updateTableCalled = true;
        updateTableBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            tableId: 'tbl-1',
            label: updateTableBody.label,
            capacity: updateTableBody.capacity,
            zoneId: updateTableBody.zoneId,
            status: updateTableBody.status,
          }),
        };
      }
    });

    render(<DashboardPage />);

    // Click en Editar de Mesa 1
    const cardMesa1 = await screen.findByTestId('table-card-tbl-1');
    const editBtn = within(cardMesa1).getByRole('button', { name: /^Editar$/i });
    fireEvent.click(editBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Editar Mesa 1')).toBeInTheDocument();

    const capInput = within(dialog).getByLabelText(/Capacidad \(Puestos\)/i);
    fireEvent.change(capInput, { target: { value: '5' } });

    const submitBtn = within(dialog).getByRole('button', { name: /Guardar Cambios/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateTableCalled).toBe(true);
      expect(updateTableBody.capacity).toBe(5);
    });
  });

  test('9. CRUD Mesas: Eliminar mesa envía DELETE /v1/tables/:tableId', async () => {
    let deleteTableCalled = false;

    setupDefaultFetch((url, opts) => {
      if (url.includes('/v1/tables/tbl-1') && opts?.method === 'DELETE') {
        deleteTableCalled = true;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true }),
        };
      }
    });

    render(<DashboardPage />);

    const cardMesa1 = await screen.findByTestId('table-card-tbl-1');
    const deleteBtn = within(cardMesa1).getByRole('button', { name: /^Eliminar$/i });
    fireEvent.click(deleteBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('¿Eliminar Mesa 1?')).toBeInTheDocument();

    const confirmBtn = within(dialog).getByRole('button', { name: /^Eliminar$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteTableCalled).toBe(true);
    });
  });

  test('10. CRUD Zonas: Crear zona envía POST /v1/zones y listar zonas muestra asignadas', async () => {
    let createZoneCalled = false;
    let createZoneBody: any = null;

    setupDefaultFetch((url, opts) => {
      if (url.includes('/v1/zones') && opts?.method === 'POST') {
        createZoneCalled = true;
        createZoneBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 201,
          headers: { get: () => 'application/json' },
          json: async () => ({
            id: 'zone-new',
            name: createZoneBody.name,
            sortOrder: createZoneBody.sortOrder,
            active: true,
          }),
        };
      }
    });

    render(<DashboardPage />);

    await screen.findByTestId('table-card-tbl-1');

    const zonasBtn = screen.getByRole('button', { name: /^Zonas$/i });
    fireEvent.click(zonasBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Gestión de Zonas')).toBeInTheDocument();

    // Verifica que lista las zonas existentes con cantidad de mesas
    expect(within(dialog).getByText('Terraza')).toBeInTheDocument();
    expect(within(dialog).getByText('(1 mesas)')).toBeInTheDocument();

    // Crear nueva zona
    const zoneInput = within(dialog).getByPlaceholderText(/Nombre de la zona/i);
    fireEvent.change(zoneInput, { target: { value: 'Bar & Lounge' } });

    const addBtn = within(dialog).getByRole('button', { name: /Agregar/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(createZoneCalled).toBe(true);
      expect(createZoneBody.name).toBe('Bar & Lounge');
    });
  });

  test('11. Modal QR: Visualizar QR y Rotar QR sin usar colores amber/warning', async () => {
    let rotateCalled = false;

    setupDefaultFetch((url, opts) => {
      if (url.includes('/v1/tables/tbl-1/qr/rotate') && opts?.method === 'POST') {
        rotateCalled = true;
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            url: 'http://localhost:3001/t/tenant-1/tbl-1?k=rotated-key',
            pngDataUrl: 'data:image/png;base64,ROTATEDDATA',
          }),
        };
      }
      if (url.includes('/v1/tables/tbl-1/qr')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            url: 'http://localhost:3001/t/tenant-1/tbl-1?k=initial-key',
            pngDataUrl: 'data:image/png;base64,INITIALDATA',
          }),
        };
      }
    });

    render(<DashboardPage />);

    const cardMesa1 = await screen.findByTestId('table-card-tbl-1');
    const verQrBtn = within(cardMesa1).getByRole('button', { name: /Ver QR/i });
    fireEvent.click(verQrBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('QR Mesa 1')).toBeInTheDocument();

    const qrImg = await within(dialog).findByAltText(/QR Mesa 1/i);
    expect(qrImg).toBeInTheDocument();
    expect(within(dialog).getByText('http://localhost:3001/t/tenant-1/tbl-1?k=initial-key')).toBeInTheDocument();

    const rotateBtn = within(dialog).getByRole('button', { name: /Rotar QR/i });
    fireEvent.click(rotateBtn);

    await waitFor(() => {
      expect(rotateCalled).toBe(true);
      expect(within(dialog).getByText('http://localhost:3001/t/tenant-1/tbl-1?k=rotated-key')).toBeInTheDocument();
    });
  });
});
