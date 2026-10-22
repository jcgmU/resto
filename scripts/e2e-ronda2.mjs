#!/usr/bin/env node

/**
 * scripts/e2e-ronda2.mjs - E2E para Ronda 2 (Perfiles reales, Terminales, Cambio de Mesa, Cobro Tarjeta)
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';

async function main() {
  console.log('====================================================');
  console.log(' 🚀 INICIANDO E2E RONDA 2: PERFILES, TERMINALES, MOVIMIENTO Y COBRO');
  console.log('====================================================\n');

  // 1. Logins de los perfiles reales
  console.log('[1/6] 🔐 Verificando autenticación de los 4 perfiles reales...');

  // Waiter
  const waiterRes = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mesero@resto.com', password: 'admin1234' }),
  });
  if (!waiterRes.ok) throw new Error(`Login mesero falló: ${await waiterRes.text()}`);
  const waiterData = await waiterRes.json();
  const waiterToken = waiterData.tokens?.accessToken;
  const tenantId = waiterData.user?.tenantId;
  if (!waiterToken || waiterData.user?.role !== 'WAITER') {
    throw new Error(`Respuesta inválida mesero: ${JSON.stringify(waiterData.user)}`);
  }
  console.log(`  ✓ Mesero autenticado: ${waiterData.user.displayName} (Rol: ${waiterData.user.role})`);

  // Cashier
  const cashierRes = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'cajero@resto.com', password: 'admin1234' }),
  });
  if (!cashierRes.ok) throw new Error(`Login cajero falló: ${await cashierRes.text()}`);
  const cashierData = await cashierRes.json();
  const cashierToken = cashierData.tokens?.accessToken;
  if (!cashierToken || cashierData.user?.role !== 'CASHIER') {
    throw new Error(`Respuesta inválida cajero: ${JSON.stringify(cashierData.user)}`);
  }
  console.log(`  ✓ Cajero autenticado: ${cashierData.user.displayName} (Rol: ${cashierData.user.role})`);

  // Monitor Cocina
  const kitchenRes = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'monitor@resto.com', password: 'admin1234' }),
  });
  if (!kitchenRes.ok) throw new Error(`Login monitor cocina falló: ${await kitchenRes.text()}`);
  const kitchenData = await kitchenRes.json();
  const kitchenToken = kitchenData.tokens?.accessToken;
  if (kitchenData.user?.role !== 'MONITOR' || kitchenData.user?.monitorKind !== 'kitchen') {
    throw new Error(`Respuesta inválida monitor cocina: ${JSON.stringify(kitchenData.user)}`);
  }
  console.log(`  ✓ Monitor Cocina autenticado: ${kitchenData.user.displayName} (Kind: ${kitchenData.user.monitorKind})`);

  // Monitor Bar
  const barRes = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'monitorbar@resto.com', password: 'admin1234' }),
  });
  if (!barRes.ok) throw new Error(`Login monitor bar falló: ${await barRes.text()}`);
  const barData = await barRes.json();
  if (barData.user?.role !== 'MONITOR' || barData.user?.monitorKind !== 'bar') {
    throw new Error(`Respuesta inválida monitor bar: ${JSON.stringify(barData.user)}`);
  }
  console.log(`  ✓ Monitor Bar autenticado: ${barData.user.displayName} (Kind: ${barData.user.monitorKind})`);

  // 2. Consulta de mesas y zonas
  console.log('\n[2/6] 📋 Consultando mesas y zonas...');
  let table1 = null;
  let table3 = null;
  let sessionId = null;
  let orderId = null;

  try {
    const [tablesRes, activeSessionsRes] = await Promise.all([
    fetch(`${GATEWAY_URL}/v1/tables`, {
      headers: { 'Authorization': `Bearer ${waiterToken}` },
    }),
    fetch(`${GATEWAY_URL}/v1/sessions`, {
      headers: { 'Authorization': `Bearer ${waiterToken}` },
    }),
  ]);

  if (!tablesRes.ok) throw new Error(`GET /v1/tables fallo (${tablesRes.status}): ${await tablesRes.text()}`);
  const rawTables = await tablesRes.json();
  const tables = Array.isArray(rawTables) ? rawTables : rawTables.data || rawTables.tables || [];

  const rawActiveSessions = activeSessionsRes.ok ? await activeSessionsRes.json() : [];
  const activeSessions = Array.isArray(rawActiveSessions) ? rawActiveSessions : rawActiveSessions.data || [];
  const occupiedTableIds = new Set(activeSessions.map((s) => s.tableId));

  // Limpiar sesiones previas de prueba en Mesa 1 y Mesa 3 si quedaron abiertas
  for (const sess of activeSessions) {
    if (sess.status === 'active' || sess.status === 'billRequested') {
      await fetch(`${GATEWAY_URL}/v1/sessions/${sess.sessionId}/close`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${cashierToken}` },
      });
    }
  }

  table1 = tables.find((t) => t.label === 'Mesa 1') || tables[0];
  table3 = tables.find((t) => t.label === 'Mesa 3') || tables[1];
  if (!table1 || !table3) throw new Error('Se requieren al menos 2 mesas para la prueba');
  console.log(`  ✓ Mesa Origen: ${table1.label} (${table1.tableId || table1.id})`);
  console.log(`  ✓ Mesa Destino: ${table3.label} (${table3.tableId || table3.id})`);

  // 3. Mesero abre sesión en Mesa 1
  console.log('\n[3/6] 🎟️ Mesero abre sesión en Mesa 1 y toma comanda...');
  const openRes = await fetch(`${GATEWAY_URL}/v1/sessions/staff-open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${waiterToken}`,
    },
    body: JSON.stringify({ tableId: table1.tableId || table1.id }),
  });
  if (!openRes.ok) throw new Error(`staff-open falló: ${await openRes.text()}`);
  const openData = await openRes.json();
  sessionId = openData.session?.sessionId || openData.sessionId;
  console.log(`  ✓ Sesión abierta: ${sessionId} en mesa ${table1.label}`);

  // Mesero toma comanda en Mesa 1
  const gqlRes = await fetch(`${GATEWAY_URL}/v1/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${waiterToken}`,
    },
    body: JSON.stringify({
      query: `query { products { id name price } }`,
    }),
  });
  const gqlData = await gqlRes.json();
  const product = gqlData.data?.products?.[0];
  if (!product) throw new Error('No se encontraron productos en el menú');

  const addCartRes = await fetch(`${GATEWAY_URL}/v1/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${waiterToken}`,
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      sessionId,
      productId: product.id,
      quantity: 1,
      notes: 'Sin azúcar',
      addedBy: 'Carlos Mesero',
    }),
  });
  if (!addCartRes.ok) throw new Error(`Carrito mesero falló: ${await addCartRes.text()}`);

  const confirmCartRes = await fetch(`${GATEWAY_URL}/v1/cart/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${waiterToken}`,
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      notes: 'Comanda tomada desde terminal mesero',
    }),
  });
  if (!confirmCartRes.ok) throw new Error(`Confirmar comanda falló: ${await confirmCartRes.text()}`);
  const orderData = await confirmCartRes.json();
  console.log(`  ✓ Comanda tomada por mesero: ${orderData.order?.id || orderData.id} ($${product.price})`);

  // Monitor de cocina avanza estado de orden: IN_KITCHEN -> READY -> DELIVERED
  orderId = orderData.order?.id || orderData.id;
  for (const st of ['IN_KITCHEN', 'READY', 'DELIVERED']) {
    const stRes = await fetch(`${GATEWAY_URL}/v1/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kitchenToken}`,
      },
      body: JSON.stringify({ status: st }),
    });
    if (!stRes.ok) throw new Error(`Avanzar estado a ${st} falló: ${await stRes.text()}`);
  }
  console.log(`  ✓ Monitor de Cocina avanzó orden ${orderId} hasta DELIVERED`);

  // 4. Cambio atómico de mesa (R12)
  console.log('\n[4/6] 🔀 Trasladando comensales de Mesa 1 a Mesa 3 (R12 Cambiar Mesa)...');
  const moveRes = await fetch(`${GATEWAY_URL}/v1/sessions/${sessionId}/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${waiterToken}`,
    },
    body: JSON.stringify({ targetTableId: table3.tableId || table3.id }),
  });
  if (!moveRes.ok) throw new Error(`move-table falló (${moveRes.status}): ${await moveRes.text()}`);
  const moveData = await moveRes.json();
  if (moveData.tableId !== (table3.tableId || table3.id)) {
    throw new Error(`tableId después de move no coincide: ${JSON.stringify(moveData)}`);
  }
  console.log(`  ✓ Sesión ${sessionId} trasladada exitosamente a ${table3.label}`);

  // 5. Solicitud de cuenta con preferencia Tarjeta (R14)
  console.log('\n[5/6] 💳 Solicitando cuenta con preferencia Tarjeta...');
  const billRes = await fetch(`${GATEWAY_URL}/v1/sessions/${sessionId}/bill-request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${waiterToken}`,
    },
    body: JSON.stringify({
      paymentMethodPreference: 'CARD',
      invoiceType: 'simple',
    }),
  });
  if (!billRes.ok) throw new Error(`bill-request falló: ${await billRes.text()}`);
  console.log(`  ✓ Cuenta solicitada con estado billRequested`);

  // 6. Cobro y liberación por Cajero con Tarjeta (R15)
  console.log('\n[6/6] 💰 Cajero confirma cobro con método CARD y libera mesa...');
  const checkoutRes = await fetch(`${GATEWAY_URL}/v1/checkout/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cashierToken}`,
    },
    body: JSON.stringify({
      sessionId,
      method: 'CARD',
      notes: 'Cobro verificado datáfono terminal caja',
    }),
  });
  if (!checkoutRes.ok) throw new Error(`checkout confirm falló (${checkoutRes.status}): ${await checkoutRes.text()}`);
  const checkoutData = await checkoutRes.json();
  console.log(`  ✓ Cobro confirmado (Payment ID: ${checkoutData.id || checkoutData.paymentId}, Método: CARD)`);

  // Cerrar la sesión si no se cerró automáticamente
  await fetch(`${GATEWAY_URL}/v1/sessions/${sessionId}/close`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${cashierToken}` },
  });
  console.log(`  ✓ Mesa 3 liberada.`);

  console.log('\n====================================================');
  console.log(' 🎉 ¡E2E RONDA 2 COMPLETADO CON ÉXITO ROTUNDO!');
  console.log('====================================================\n');
  } finally {
    console.log('\n🧹 [Cleanup] Limpiando estado residual de e2e-ronda2...');
    if (orderId && kitchenToken) {
      try {
        for (const st of ['IN_KITCHEN', 'READY', 'DELIVERED']) {
          await fetch(`${GATEWAY_URL}/v1/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${kitchenToken}` },
            body: JSON.stringify({ status: st }),
          });
        }
      } catch {}
    }
    if (sessionId && cashierToken) {
      try {
        await fetch(`${GATEWAY_URL}/v1/sessions/${sessionId}/close`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${cashierToken}` },
        });
      } catch {}
    }
    if (cashierToken) {
      try {
        const callsRes = await fetch(`${GATEWAY_URL}/v1/service-calls`, {
          headers: { 'Authorization': `Bearer ${cashierToken}` },
        });
        const calls = await callsRes.json();
        if (Array.isArray(calls)) {
          const table1Id = table1?.tableId || table1?.id;
          const table3Id = table3?.tableId || table3?.id;
          for (const call of calls.filter((c) => c.status === 'pending' && (c.tableId === table1Id || c.tableId === table3Id))) {
            await fetch(`${GATEWAY_URL}/v1/service-calls/${call.callId}/resolve`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${cashierToken}` },
            });
          }
        }
      } catch {}
    }
  }
}

main().catch((err) => {
  console.error('\n❌ ERROR E2E RONDA 2:', err);
  process.exit(1);
});
