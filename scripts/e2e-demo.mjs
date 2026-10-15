#!/usr/bin/env node

/**
 * scripts/e2e-demo.mjs - Flujo E2E automatizado de verificación
 * 
 * Verifica el ciclo de vida completo del restaurante contra el stack Docker:
 * 1. Login admin
 * 2. Conexión WebSocket (Socket.io)
 * 3. Catálogo GraphQL
 * 4. Consulta de mesas y obtención de QR
 * 5. Apertura de sesión de comensal (guest)
 * 6. Carrito y confirmación de orden
 * 7. Verificación de recepción de evento en tiempo real vía Socket.io
 * 8. Transición de estados de comanda por cocina (IN_KITCHEN -> READY -> DELIVERED)
 * 9. Solicitud de llamada de servicio y resolución por staff
 * 10. Facturación y checkout con Efectivo (CASH)
 * 11. Verificación de liberación de mesa
 */

import { io } from 'socket.io-client';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'admin';

process.on('unhandledRejection', (reason) => {
  console.error('\n❌ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('\n❌ Uncaught Exception:', err);
  process.exit(1);
});

async function main() {
  console.log('====================================================');
  console.log(' 🚀 INICIANDO PRUEBA END-TO-END (E2E) RESTAURANTE-OS');
  console.log(` 🌐 Gateway URL: ${GATEWAY_URL}`);
  console.log('====================================================\n');

  let socket = null;
  let adminToken = null;
  let tenantId = null;
  let sessionId = null;
  let guestToken = null;
  let orderId = null;
  let orderStatus = null; // 'PLACED' | 'IN_KITCHEN' | 'READY' | 'DELIVERED' | 'CANCELLED'
  let isSessionClosed = false;
  // Estado de los pasos extendidos (Mesa 2)
  let table2Id = null;
  let session2Id = null;
  let guestToken2 = null;
  let isSession2Closed = true;
  let settingsMayBeChanged = false;
  const extraOrders = []; // { id, status }

  try {
    // -------------------------------------------------------------------------
    // Paso 1: Login de Administrador
    // -------------------------------------------------------------------------
    console.log('[Paso 1/12] 🔐 Autenticando usuario admin...');
    const loginRes = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin', password: DEMO_ADMIN_PASSWORD }),
    });

    if (!loginRes.ok) {
      const errorText = await loginRes.text();
      throw new Error(`Login admin falló (${loginRes.status}): ${errorText}`);
    }

    const loginData = await loginRes.json();
    adminToken = loginData.tokens?.accessToken;
    tenantId = loginData.user?.tenantId;

    if (!adminToken || !tenantId) {
      throw new Error('Respuesta de login inválida: faltan adminToken o tenantId');
    }
    console.log(`  ✓ Admin autenticado exitosamente. Tenant: ${tenantId}`);

    // -------------------------------------------------------------------------
    // Paso 2: Conectar Socket.io cliente a /orders con token admin
    // -------------------------------------------------------------------------
    console.log('[Paso 2/12] ⚡ Conectando Socket.io a /orders con adminToken...');
    const socketUrl = `${GATEWAY_URL}/orders`;
    socket = io(socketUrl, {
      auth: { token: adminToken },
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 5000,
    });

    const receivedEvents = [];
    socket.on('order:created', (data) => {
      receivedEvents.push({ event: 'order:created', data });
      console.log(`  📢 [Socket Event] 'order:created' recibido para orden: ${data?.order?.id || JSON.stringify(data)}`);
    });

    socket.on('order:status-changed', (data) => {
      receivedEvents.push({ event: 'order:status-changed', data });
      if (data?.orderId && data?.orderId === orderId && data?.status) {
        orderStatus = data.status;
      }
      console.log(`  📢 [Socket Event] 'order:status-changed' a ${data?.status} para orden: ${data?.orderId}`);
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout esperando conexión de Socket.io'));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timer);
        console.log(`  ✓ Socket.io conectado con ID: ${socket.id}`);
        resolve();
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Error de conexión Socket.io: ${err.message}`));
      });
    });

    // -------------------------------------------------------------------------
    // Paso 3: Consultar catálogo de productos vía GraphQL
    // -------------------------------------------------------------------------
    console.log('[Paso 3/12] 📋 Consultando catálogo de productos vía GraphQL...');
    const gqlRes = await fetch(`${GATEWAY_URL}/v1/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        query: `
          query {
            products {
              id
              name
              price
              category {
                id
              }
            }
          }
        `,
      }),
    });

    if (!gqlRes.ok) {
      throw new Error(`Consulta GraphQL falló (${gqlRes.status}): ${await gqlRes.text()}`);
    }

    const gqlData = await gqlRes.json();
    if (gqlData.errors && gqlData.errors.length > 0) {
      throw new Error(`Errores en respuesta GraphQL: ${JSON.stringify(gqlData.errors)}`);
    }

    const products = gqlData.data?.products || [];
    if (products.length === 0) {
      throw new Error('No se encontraron productos en el catálogo demo.');
    }

    const selectedProduct = products[0];
    console.log(`  ✓ Producto seleccionado: "${selectedProduct.name}" (ID: ${selectedProduct.id}, Precio: $${selectedProduct.price})`);

    // -------------------------------------------------------------------------
    // Paso 4: Consultar mesas y elegir 'Mesa 1'
    // -------------------------------------------------------------------------
    console.log('[Paso 4/12] 🪑 Consultando mesas registradas...');
    const tablesRes = await fetch(`${GATEWAY_URL}/v1/tables`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    if (!tablesRes.ok) {
      throw new Error(`Consulta de mesas falló (${tablesRes.status}): ${await tablesRes.text()}`);
    }

    const tables = await tablesRes.json();
    const mesa1 = tables.find((t) => t.label === 'Mesa 1');
    if (!mesa1) {
      throw new Error('No se encontró "Mesa 1" entre las mesas configuradas.');
    }
    const tableId = mesa1.tableId || mesa1.id;
    console.log(`  ✓ Mesa seleccionada: "Mesa 1" (ID: ${tableId})`);

    // -------------------------------------------------------------------------
    // Paso 5: Obtener QR de la mesa y extraer parámetro 'k'
    // -------------------------------------------------------------------------
    console.log(`[Paso 5/12] 📱 Obteniendo código QR para mesa ${tableId}...`);
    const qrRes = await fetch(`${GATEWAY_URL}/v1/tables/${tableId}/qr`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    if (!qrRes.ok) {
      throw new Error(`Obtención de QR falló (${qrRes.status}): ${await qrRes.text()}`);
    }

    const qrData = await qrRes.json();
    let qrKey = qrData.qrKey || qrData.key;
    if (!qrKey && qrData.url) {
      try {
        const parsedUrl = new URL(qrData.url);
        qrKey = parsedUrl.searchParams.get('k') || parsedUrl.searchParams.get('key');
      } catch (e) {
        // Ignorar error de parsing si ya tenemos qrKey
      }
    }

    if (!qrKey) {
      throw new Error(`No se pudo extraer la clave QR de la respuesta: ${JSON.stringify(qrData)}`);
    }
    console.log(`  ✓ Clave QR obtenida: ${qrKey}`);

    // -------------------------------------------------------------------------
    // Paso 6: Abrir sesión de comensal (Guest)
    // -------------------------------------------------------------------------
    console.log('[Paso 6/12] 🎟️ Abriendo sesión de comensal (Guest)...');
    const openRes = await fetch(`${GATEWAY_URL}/v1/sessions/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrKey, tenantId, tableId }),
    });

    if (!openRes.ok) {
      throw new Error(`Apertura de sesión falló (${openRes.status}): ${await openRes.text()}`);
    }

    const openData = await openRes.json();
    guestToken = openData.guestToken;
    sessionId = openData.session?.sessionId;
    isSessionClosed = false;

    if (!guestToken || !sessionId) {
      throw new Error(`Respuesta de sesión inválida: ${JSON.stringify(openData)}`);
    }
    console.log(`  ✓ Sesión abierta ID: ${sessionId}`);

    // -------------------------------------------------------------------------
    // Paso 7: Agregar producto al carrito
    // -------------------------------------------------------------------------
    console.log('[Paso 7/12] 🛒 Agregando producto al carrito...');
    const cartRes = await fetch(`${GATEWAY_URL}/v1/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${guestToken}`,
      },
      body: JSON.stringify({
        productId: selectedProduct.id,
        quantity: 1,
        addedBy: 'e2e-tester',
      }),
    });

    if (!cartRes.ok) {
      throw new Error(`Agregar al carrito falló (${cartRes.status}): ${await cartRes.text()}`);
    }
    console.log('  ✓ Producto agregado al carrito correctamente.');

    // -------------------------------------------------------------------------
    // Paso 8: Confirmar comanda y esperar evento en tiempo real vía Socket.io
    // -------------------------------------------------------------------------
    console.log('[Paso 8/12] 🍽️ Confirmando comanda y esperando evento Socket.io...');
    const confirmRes = await fetch(`${GATEWAY_URL}/v1/cart/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${guestToken}`,
      },
      body: JSON.stringify({ tableId }),
    });

    if (!confirmRes.ok) {
      throw new Error(`Confirmación de comanda falló (${confirmRes.status}): ${await confirmRes.text()}`);
    }

    const confirmData = await confirmRes.json();
    orderId = confirmData.id;
    orderStatus = 'PLACED';
    if (!orderId) {
      throw new Error(`Respuesta de confirmación sin orderId: ${JSON.stringify(confirmData)}`);
    }
    console.log(`  ✓ Comanda generada: ${orderId}`);

    // Simulación opcional de fallo tras creación de comanda para probar cleanup
    if (process.env.SIMULATE_FAILURE_AFTER_ORDER === '1' || process.env.SIMULATE_FAILURE_AFTER_ORDER === 'true') {
      throw new Error('Fallo simulado tras confirmación de comanda para probar el cleanup del finally');
    }

    // Await Socket event within 10 seconds
    console.log('  ⏳ Esperando evento "order:created" en Socket.io (máximo 10s)...');
    const startWait = Date.now();
    let orderCreatedEvent = null;

    while (Date.now() - startWait < 10000) {
      orderCreatedEvent = receivedEvents.find(
        (e) => e.event === 'order:created' && (e.data?.order?.id === orderId || !e.data?.order?.id)
      );
      if (orderCreatedEvent) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!orderCreatedEvent) {
      throw new Error(`Timeout: No se recibió el evento Socket 'order:created' para la orden ${orderId} en 10s.`);
    }
    console.log(`  ✓ Evento Socket.io 'order:created' verificado exitosamente (${Date.now() - startWait}ms).`);

    // -------------------------------------------------------------------------
    // Paso 9: Avanzar estado de la comanda como staff
    // -------------------------------------------------------------------------
    console.log('[Paso 9/12] 👨‍🍳 Avanzando estado de la comanda (IN_KITCHEN → READY → DELIVERED)...');
    const targetStatuses = ['IN_KITCHEN', 'READY', 'DELIVERED'];

    for (const status of targetStatuses) {
      const statusRes = await fetch(`${GATEWAY_URL}/v1/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!statusRes.ok) {
        throw new Error(`Actualización a ${status} falló (${statusRes.status}): ${await statusRes.text()}`);
      }
      orderStatus = status;
      console.log(`  ✓ Estado actualizado a: ${status}`);

      if (process.env.SIMULATE_FAILURE_AT_STATUS === status) {
        throw new Error(`Fallo simulado en estado ${status} para probar el cleanup del finally`);
      }
    }

    // -------------------------------------------------------------------------
    // Paso 10: Solicitud de servicio por el comensal y resolución por staff
    // -------------------------------------------------------------------------
    console.log('[Paso 10/12] 🛎️ Llamada de servicio por comensal y resolución por staff...');
    const serviceCallRes = await fetch(`${GATEWAY_URL}/v1/service-calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${guestToken}`,
      },
      body: JSON.stringify({
        sessionId,
        tableId,
        type: 'BILL',
        note: 'Solicitud de cuenta desde E2E',
      }),
    });

    if (!serviceCallRes.ok) {
      throw new Error(`Llamada de servicio falló (${serviceCallRes.status}): ${await serviceCallRes.text()}`);
    }

    const serviceCallData = await serviceCallRes.json();
    const callId = serviceCallData.callId || serviceCallData.id;
    console.log(`  ✓ Llamada de servicio creada: ${callId}`);

    const resolveCallRes = await fetch(`${GATEWAY_URL}/v1/service-calls/${callId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    if (!resolveCallRes.ok) {
      throw new Error(`Resolución de llamada falló (${resolveCallRes.status}): ${await resolveCallRes.text()}`);
    }
    console.log(`  ✓ Llamada de servicio ${callId} resuelta por staff.`);

    // -------------------------------------------------------------------------
    // Paso 11: Checkout y cobro como staff (CASH)
    // -------------------------------------------------------------------------
    console.log('[Paso 11/12] 💳 Proceso de cobro y checkout como staff (Efectivo / CASH)...');
    const checkoutGetRes = await fetch(`${GATEWAY_URL}/v1/checkout/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    if (!checkoutGetRes.ok) {
      throw new Error(`Consulta de checkout falló (${checkoutGetRes.status}): ${await checkoutGetRes.text()}`);
    }

    const bill = await checkoutGetRes.json();
    console.log(`  ✓ Cuenta consultada: ${bill.ordersCount || bill.orders?.length} órdenes, Total: $${bill.total}`);

    if (bill.total !== selectedProduct.price) {
      throw new Error(`Total de la cuenta ($${bill.total}) no coincide con el precio esperado ($${selectedProduct.price})`);
    }
    if (!Number.isInteger(bill.total) || bill.total <= 0) {
      throw new Error(`Total de la cuenta ($${bill.total}) debe ser un entero COP positivo.`);
    }

    const checkoutPostRes = await fetch(`${GATEWAY_URL}/v1/checkout/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        sessionId,
        tableId,
        method: 'CASH',
      }),
    });

    if (!checkoutPostRes.ok) {
      throw new Error(`Confirmación de checkout falló (${checkoutPostRes.status}): ${await checkoutPostRes.text()}`);
    }
    isSessionClosed = true;
    console.log('  ✓ Cobro en efectivo registrado y sesión cerrada.');

    // -------------------------------------------------------------------------
    // Paso 12: Verificar que la mesa ha sido liberada
    // -------------------------------------------------------------------------
    console.log('[Paso 12/12] 🏁 Verificando que la mesa ha quedado liberada...');
    const activeSessionsRes = await fetch(`${GATEWAY_URL}/v1/sessions?status=active`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    if (!activeSessionsRes.ok) {
      throw new Error(`Consulta de sesiones activas falló (${activeSessionsRes.status}): ${await activeSessionsRes.text()}`);
    }

    const activeSessions = await activeSessionsRes.json();
    const isSessionActive = activeSessions.some(
      (s) => s.sessionId === sessionId || s.tableId === tableId
    );

    if (isSessionActive) {
      throw new Error(`La mesa ${tableId} o sesión ${sessionId} aún figura como activa.`);
    }
    console.log(`  ✓ Confirmado: Mesa ${tableId} y sesión ${sessionId} ya no están activas.`);

    // =========================================================================
    // Pasos extendidos (13-17): flujo completo en Mesa 2 (notas, WAITER_CALL,
    // modo waiter_only, bloqueo por bill-request y cobro CASH)
    // =========================================================================
    const jsonHeaders = (token, extra = {}) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...extra,
    });
    const readErrCode = async (res) => {
      const txt = await res.text();
      try {
        const parsed = JSON.parse(txt);
        return { code: parsed?.error?.code || parsed?.code, text: txt };
      } catch {
        return { code: undefined, text: txt };
      }
    };

    // Paso 13: Pedido con nota por ítem y nota general
    console.log('[Paso 13/17] 📝 Pedido con nota por ítem y nota general (Mesa 2)...');
    const mesa2 = tables.find((t) => t.label === 'Mesa 2');
    if (!mesa2) {
      throw new Error('No se encontró "Mesa 2" entre las mesas configuradas (ejecuta node scripts/seed-demo.mjs).');
    }
    table2Id = mesa2.tableId || mesa2.id;

    const qr2Res = await fetch(`${GATEWAY_URL}/v1/tables/${table2Id}/qr`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!qr2Res.ok) {
      throw new Error(`Obtención de QR de Mesa 2 falló (${qr2Res.status}): ${await qr2Res.text()}`);
    }
    const qr2Data = await qr2Res.json();
    let qrKey2 = qr2Data.qrKey || qr2Data.key;
    if (!qrKey2 && qr2Data.url) {
      const u2 = new URL(qr2Data.url);
      qrKey2 = u2.searchParams.get('k') || u2.searchParams.get('key');
    }
    if (!qrKey2) {
      throw new Error(`No se pudo extraer la clave QR de Mesa 2: ${JSON.stringify(qr2Data)}`);
    }

    const open2Res = await fetch(`${GATEWAY_URL}/v1/sessions/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrKey: qrKey2, tenantId, tableId: table2Id }),
    });
    if (!open2Res.ok) {
      throw new Error(`Apertura de sesión en Mesa 2 falló (${open2Res.status}): ${await open2Res.text()}`);
    }
    const open2Data = await open2Res.json();
    guestToken2 = open2Data.guestToken;
    session2Id = open2Data.session?.sessionId;
    isSession2Closed = false;
    if (!guestToken2 || !session2Id) {
      throw new Error(`Respuesta de sesión inválida (Mesa 2): ${JSON.stringify(open2Data)}`);
    }
    console.log(`  ✓ Sesión Mesa 2 abierta: ${session2Id}`);

    const ITEM_NOTE = 'Sin cebolla, por favor';
    const ORDER_NOTE = 'Traer cubiertos extra';
    const cart2Res = await fetch(`${GATEWAY_URL}/v1/cart/items`, {
      method: 'POST',
      headers: jsonHeaders(guestToken2),
      body: JSON.stringify({
        productId: selectedProduct.id,
        quantity: 2,
        notes: ITEM_NOTE,
        addedBy: 'e2e-tester',
      }),
    });
    if (!cart2Res.ok) {
      throw new Error(`Agregar ítem con nota falló (${cart2Res.status}): ${await cart2Res.text()}`);
    }
    const confirm2Res = await fetch(`${GATEWAY_URL}/v1/cart/confirm`, {
      method: 'POST',
      headers: jsonHeaders(guestToken2),
      body: JSON.stringify({ tableId: table2Id, notes: ORDER_NOTE }),
    });
    if (!confirm2Res.ok) {
      throw new Error(`Confirmación de pedido con notas falló (${confirm2Res.status}): ${await confirm2Res.text()}`);
    }
    const confirm2Data = await confirm2Res.json();
    const order2Id = confirm2Data.id;
    if (!order2Id) {
      throw new Error(`Respuesta de confirmación sin id: ${JSON.stringify(confirm2Data)}`);
    }
    extraOrders.push({ id: order2Id, status: 'PLACED' });

    const order2Raw = JSON.stringify(confirm2Data);
    if (!order2Raw.includes(ITEM_NOTE) || !order2Raw.includes(ORDER_NOTE)) {
      throw new Error(`El pedido no conserva las notas (ítem y general): ${order2Raw}`);
    }
    console.log(`  ✓ Pedido ${order2Id} creado con nota de ítem y nota general.`);

    // Paso 14: WAITER_CALL + resolución por staff
    console.log('[Paso 14/17] 🙋 Llamada WAITER_CALL por comensal y resolución por staff...');
    const waiterCallRes = await fetch(`${GATEWAY_URL}/v1/service-calls`, {
      method: 'POST',
      headers: jsonHeaders(guestToken2),
      body: JSON.stringify({
        sessionId: session2Id,
        tableId: table2Id,
        type: 'WAITER_CALL',
        note: 'Llamar mesero desde E2E',
      }),
    });
    if (!waiterCallRes.ok) {
      throw new Error(`WAITER_CALL falló (${waiterCallRes.status}): ${await waiterCallRes.text()}`);
    }
    const waiterCall = await waiterCallRes.json();
    const waiterCallId = waiterCall.callId || waiterCall.id;
    if (!waiterCallId) {
      throw new Error(`WAITER_CALL sin id: ${JSON.stringify(waiterCall)}`);
    }
    const resolveWaiterRes = await fetch(`${GATEWAY_URL}/v1/service-calls/${waiterCallId}/resolve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!resolveWaiterRes.ok) {
      throw new Error(`Resolución de WAITER_CALL falló (${resolveWaiterRes.status}): ${await resolveWaiterRes.text()}`);
    }
    console.log(`  ✓ WAITER_CALL ${waiterCallId} creada y resuelta por staff.`);

    // Paso 15: modo waiter_only (QR deshabilitado) + staff-open + pedido con x-session-id
    console.log('[Paso 15/17] 🔒 Modo waiter_only: QR bloqueado, staff abre sesión y pide...');
    settingsMayBeChanged = true;
    const wo = await fetch(`${GATEWAY_URL}/v1/tenant/settings`, {
      method: 'PATCH',
      headers: jsonHeaders(adminToken),
      body: JSON.stringify({ operatingMode: 'waiter_only' }),
    });
    if (!wo.ok) {
      throw new Error(`PATCH settings waiter_only falló (${wo.status}): ${await wo.text()}`);
    }

    // El servicio session cachea operatingMode hasta 30s: se sondea hasta que se aplique.
    const probeOpen = (key) =>
      fetch(`${GATEWAY_URL}/v1/sessions/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrKey: key, tenantId, tableId: table2Id }),
      });
    let blockedOpen = await probeOpen(qrKey2);
    let blockedErr = await readErrCode(blockedOpen);
    const pollStart = Date.now();
    while (blockedErr.code !== 'QR_DISABLED' && Date.now() - pollStart < 40000) {
      await new Promise((r) => setTimeout(r, 2000));
      blockedOpen = await probeOpen(qrKey2);
      blockedErr = await readErrCode(blockedOpen);
    }
    if (blockedOpen.status !== 403 || blockedErr.code !== 'QR_DISABLED') {
      throw new Error(`Se esperaba 403 QR_DISABLED en /sessions/open, se obtuvo ${blockedOpen.status}: ${blockedErr.text}`);
    }
    console.log('  ✓ /v1/sessions/open → 403 QR_DISABLED en waiter_only.');

    const staffOpenRes = await fetch(`${GATEWAY_URL}/v1/sessions/staff-open`, {
      method: 'POST',
      headers: jsonHeaders(adminToken),
      body: JSON.stringify({ tableId: table2Id }),
    });
    if (!staffOpenRes.ok) {
      throw new Error(`staff-open falló (${staffOpenRes.status}): ${await staffOpenRes.text()}`);
    }
    const staffOpenData = await staffOpenRes.json();
    const staffSessionId = staffOpenData.session?.sessionId;
    if (!staffSessionId) {
      throw new Error(`staff-open sin sessionId: ${JSON.stringify(staffOpenData)}`);
    }
    console.log(`  ✓ staff-open devolvió sesión ${staffSessionId}.`);

    const staffCartRes = await fetch(`${GATEWAY_URL}/v1/cart/items`, {
      method: 'POST',
      headers: jsonHeaders(adminToken, { 'x-session-id': staffSessionId }),
      body: JSON.stringify({
        sessionId: staffSessionId,
        productId: selectedProduct.id,
        quantity: 1,
        addedBy: 'e2e-staff',
      }),
    });
    if (!staffCartRes.ok) {
      throw new Error(`Carrito staff con x-session-id falló (${staffCartRes.status}): ${await staffCartRes.text()}`);
    }
    const staffConfirmRes = await fetch(`${GATEWAY_URL}/v1/cart/confirm`, {
      method: 'POST',
      headers: jsonHeaders(adminToken, { 'x-session-id': staffSessionId }),
      body: JSON.stringify({ sessionId: staffSessionId, tableId: table2Id }),
    });
    if (!staffConfirmRes.ok) {
      throw new Error(`Confirmación staff falló (${staffConfirmRes.status}): ${await staffConfirmRes.text()}`);
    }
    const staffOrder = await staffConfirmRes.json();
    if (!staffOrder.id) {
      throw new Error(`Pedido staff sin id: ${JSON.stringify(staffOrder)}`);
    }
    extraOrders.push({ id: staffOrder.id, status: 'PLACED' });
    console.log(`  ✓ Pedido de mesero ${staffOrder.id} creado con x-session-id.`);

    const backHybrid = await fetch(`${GATEWAY_URL}/v1/tenant/settings`, {
      method: 'PATCH',
      headers: jsonHeaders(adminToken),
      body: JSON.stringify({ operatingMode: 'hybrid' }),
    });
    if (!backHybrid.ok) {
      throw new Error(`PATCH settings hybrid falló (${backHybrid.status}): ${await backHybrid.text()}`);
    }
    settingsMayBeChanged = false;
    console.log('  ✓ Modo restaurado a hybrid.');
    // Evitar dejar el QR bloqueado por el caché (30s) de session: sondeo con clave inválida (sin efectos).
    const hybridPollStart = Date.now();
    while (Date.now() - hybridPollStart < 40000) {
      const probe = await probeOpen('e2e-invalid-key');
      const probeErr = await readErrCode(probe);
      if (probeErr.code !== 'QR_DISABLED') break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Paso 16: bill-request bloquea nuevos pedidos guest
    console.log('[Paso 16/17] 🧾 bill-request y bloqueo de nuevos pedidos (SESSION_NOT_ORDERABLE)...');
    const billReqRes = await fetch(`${GATEWAY_URL}/v1/sessions/${session2Id}/bill-request`, {
      method: 'POST',
      headers: jsonHeaders(guestToken2),
      body: JSON.stringify({}),
    });
    if (!billReqRes.ok) {
      throw new Error(`bill-request falló (${billReqRes.status}): ${await billReqRes.text()}`);
    }

    let blockedStatus;
    let blockedCode;
    const blockedCart = await fetch(`${GATEWAY_URL}/v1/cart/items`, {
      method: 'POST',
      headers: jsonHeaders(guestToken2),
      body: JSON.stringify({ productId: selectedProduct.id, quantity: 1, addedBy: 'e2e-tester' }),
    });
    if (blockedCart.ok) {
      const blockedConfirm = await fetch(`${GATEWAY_URL}/v1/cart/confirm`, {
        method: 'POST',
        headers: jsonHeaders(guestToken2),
        body: JSON.stringify({ tableId: table2Id }),
      });
      const e = await readErrCode(blockedConfirm);
      blockedStatus = blockedConfirm.status;
      blockedCode = e.code;
      if (blockedConfirm.ok) {
        const created = JSON.parse(e.text);
        if (created?.id) extraOrders.push({ id: created.id, status: 'PLACED' });
      }
    } else {
      const e = await readErrCode(blockedCart);
      blockedStatus = blockedCart.status;
      blockedCode = e.code;
    }
    if (blockedStatus !== 409 || blockedCode !== 'SESSION_NOT_ORDERABLE') {
      throw new Error(`Se esperaba 409 SESSION_NOT_ORDERABLE tras bill-request, se obtuvo ${blockedStatus} ${blockedCode}`);
    }
    console.log('  ✓ Nuevo pedido guest → 409 SESSION_NOT_ORDERABLE.');

    // Paso 17: cobro CASH y mesa liberada
    console.log('[Paso 17/17] 💵 Entrega, cobro CASH y liberación de Mesa 2...');
    for (const o of extraOrders) {
      for (const status of ['IN_KITCHEN', 'READY', 'DELIVERED']) {
        const stRes = await fetch(`${GATEWAY_URL}/v1/orders/${o.id}/status`, {
          method: 'PATCH',
          headers: jsonHeaders(adminToken),
          body: JSON.stringify({ status }),
        });
        if (!stRes.ok) {
          throw new Error(`Orden ${o.id} → ${status} falló (${stRes.status}): ${await stRes.text()}`);
        }
        o.status = status;
      }
    }

    const bill2Res = await fetch(`${GATEWAY_URL}/v1/checkout/${session2Id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!bill2Res.ok) {
      throw new Error(`Consulta de checkout Mesa 2 falló (${bill2Res.status}): ${await bill2Res.text()}`);
    }
    const bill2 = await bill2Res.json();
    const expectedTotal = selectedProduct.price * 3; // 2 (con notas) + 1 (mesero)
    if (!Number.isInteger(bill2.total) || bill2.total <= 0) {
      throw new Error(`Total Mesa 2 ($${bill2.total}) debe ser un entero COP positivo.`);
    }
    if (bill2.total < expectedTotal) {
      throw new Error(`Total Mesa 2 ($${bill2.total}) menor al esperado ($${expectedTotal}).`);
    }

    const pay2Res = await fetch(`${GATEWAY_URL}/v1/checkout/confirm`, {
      method: 'POST',
      headers: jsonHeaders(adminToken),
      body: JSON.stringify({ sessionId: session2Id, tableId: table2Id, method: 'CASH' }),
    });
    if (!pay2Res.ok) {
      throw new Error(`Cobro CASH Mesa 2 falló (${pay2Res.status}): ${await pay2Res.text()}`);
    }
    isSession2Closed = true;
    console.log(`  ✓ Cobro CASH registrado (total $${bill2.total}).`);

    const active2Res = await fetch(`${GATEWAY_URL}/v1/sessions?status=active`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!active2Res.ok) {
      throw new Error(`Consulta de sesiones activas falló (${active2Res.status}): ${await active2Res.text()}`);
    }
    const active2 = await active2Res.json();
    if (active2.some((s) => s.sessionId === session2Id || s.tableId === table2Id)) {
      throw new Error(`La Mesa 2 (${table2Id}) o sesión ${session2Id} aún figura como activa.`);
    }
    console.log(`  ✓ Mesa 2 (${table2Id}) liberada.`);

    console.log('\n====================================================');
    console.log(' 🎉 ¡ÉXITO! FLUJO E2E COMPLETADO SATISFACTORIAMENTE');
    console.log('====================================================\n');
  } finally {
    if (socket) {
      try {
        socket.disconnect();
      } catch (err) {
        // Socket disconnect error ignorado
      }
    }

    // Best-effort cleanup (wrapped in try/catch so it NEVER masks or suppresses an error from the main flow)
    // SIEMPRE restaurar el modo de operación a hybrid, pase lo que pase.
    if (adminToken) {
      try {
        const restoreRes = await fetch(`${GATEWAY_URL}/v1/tenant/settings`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ operatingMode: 'hybrid' }),
        });
        if (restoreRes.ok) {
          if (settingsMayBeChanged) console.log('\n🧹 [Cleanup] Modo de operación restaurado a hybrid.');
        } else {
          console.warn(`  ⚠️ [Cleanup] No se pudo restaurar hybrid (${restoreRes.status}): ${await restoreRes.text()}`);
        }
      } catch (restoreErr) {
        console.warn(`  ⚠️ [Cleanup] Error al restaurar hybrid: ${restoreErr.message}`);
      }

      // Órdenes y sesión residuales de la Mesa 2 (pasos extendidos)
      for (const o of extraOrders) {
        if (['DELIVERED', 'CANCELLED'].includes(o.status)) continue;
        try {
          const cancelExtra = await fetch(`${GATEWAY_URL}/v1/orders/${o.id}/cancel`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}` },
          });
          if (cancelExtra.ok) {
            o.status = 'CANCELLED';
            console.log(`  ✓ [Cleanup] Orden extra ${o.id} cancelada.`);
          }
        } catch (extraErr) {
          console.warn(`  ⚠️ [Cleanup] Error cancelando orden extra ${o.id}: ${extraErr.message}`);
        }
      }
      if (session2Id && !isSession2Closed) {
        try {
          const close2 = await fetch(`${GATEWAY_URL}/v1/sessions/${session2Id}/close`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}` },
          });
          if (close2.ok) {
            isSession2Closed = true;
            console.log(`  ✓ [Cleanup] Sesión Mesa 2 ${session2Id} cerrada.`);
          } else {
            console.warn(`  ⚠️ [Cleanup] No se pudo cerrar sesión Mesa 2 (${close2.status}): ${await close2.text()}`);
          }
        } catch (close2Err) {
          console.warn(`  ⚠️ [Cleanup] Error cerrando sesión Mesa 2: ${close2Err.message}`);
        }
      }
    }

    try {
      const isTerminal = ['DELIVERED', 'CANCELLED'].includes(orderStatus);
      if (adminToken && orderId && !isTerminal) {
        console.log(`\n🧹 [Cleanup] Limpiando orden residual ${orderId} (estado actual: ${orderStatus || 'desconocido'})...`);
        let cleaned = false;
        try {
          const statusRes = await fetch(`${GATEWAY_URL}/v1/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ status: 'DELIVERED' }),
          });

          if (statusRes.ok) {
            orderStatus = 'DELIVERED';
            cleaned = true;
            console.log(`  ✓ [Cleanup] Orden ${orderId} actualizada a DELIVERED.`);
          } else {
            const errText = await statusRes.text();
            console.log(`  ℹ️ [Cleanup] PATCH status a DELIVERED devolvió ${statusRes.status} (${errText}). Intentando cancelar comanda...`);
          }
        } catch (statusErr) {
          console.warn(`  ⚠️ [Cleanup] Error al intentar PATCH status DELIVERED: ${statusErr.message}`);
        }

        if (!cleaned) {
          try {
            const cancelRes = await fetch(`${GATEWAY_URL}/v1/orders/${orderId}/cancel`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${adminToken}`,
              },
            });

            if (cancelRes.ok) {
              orderStatus = 'CANCELLED';
              console.log(`  ✓ [Cleanup] Orden ${orderId} cancelada exitosamente.`);
            } else {
              const cancelText = await cancelRes.text();
              console.warn(`  ⚠️ [Cleanup] No se pudo cancelar orden ${orderId} (${cancelRes.status}): ${cancelText}`);
            }
          } catch (cancelErr) {
            console.warn(`  ⚠️ [Cleanup] Error al intentar PATCH cancel: ${cancelErr.message}`);
          }
        }
      }

      if (adminToken && sessionId && !isSessionClosed) {
        console.log(`\n🧹 [Cleanup] Cerrando sesión residual ${sessionId}...`);
        try {
          const closeRes = await fetch(`${GATEWAY_URL}/v1/sessions/${sessionId}/close`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${adminToken}`,
            },
          });

          if (closeRes.ok) {
            isSessionClosed = true;
            console.log(`  ✓ [Cleanup] Sesión ${sessionId} cerrada exitosamente.`);
          } else {
            const closeText = await closeRes.text();
            console.warn(`  ⚠️ [Cleanup] No se pudo cerrar sesión ${sessionId} (${closeRes.status}): ${closeText}`);
          }
        } catch (closeErr) {
          console.warn(`  ⚠️ [Cleanup] Error al intentar cerrar sesión: ${closeErr.message}`);
        }
      }
    } catch (cleanupErr) {
      console.warn('⚠️ [Cleanup] Excepción inesperada durante cleanup best-effort:', cleanupErr.message || cleanupErr);
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ ERROR FATAL DURANTE EJECUCIÓN E2E:');
    console.error(err.message || err);
    process.exit(1);
  });
