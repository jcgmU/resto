const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';

async function main() {
  console.log('🧹 Iniciando limpieza completa de residuos del entorno demo...');

  // 1. Login admin
  const loginRes = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin', password: 'admin' }),
  });
  if (!loginRes.ok) throw new Error('Login admin falló');
  const { tokens } = await loginRes.json();
  const token = tokens.accessToken;
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2. Resolver todas las llamadas de servicio pendientes
  const callsRes = await fetch(`${GATEWAY_URL}/v1/service-calls`, { headers: authHeaders });
  const calls = await callsRes.json();
  if (Array.isArray(calls)) {
    for (const call of calls.filter((c) => c.status === 'pending')) {
      const cId = call.callId || call.id;
      await fetch(`${GATEWAY_URL}/v1/service-calls/${cId}/resolve`, {
        method: 'PATCH',
        headers: authHeaders,
      });
      console.log(`  ✓ Llamada de servicio resuelta: ${cId}`);
    }
  }

  // 3. Pasar órdenes no terminales a DELIVERED
  const ordersRes = await fetch(`${GATEWAY_URL}/v1/orders`, { headers: authHeaders });
  const orders = await ordersRes.json();
  if (Array.isArray(orders)) {
    for (const order of orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED')) {
      await fetch(`${GATEWAY_URL}/v1/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: 'DELIVERED' }),
      });
      console.log(`  ✓ Orden no terminal pasada a DELIVERED: ${order.id}`);
    }
  }

  // 4. Cerrar todas las sesiones activas
  const sessRes = await fetch(`${GATEWAY_URL}/v1/sessions`, { headers: authHeaders });
  const sessions = await sessRes.json();
  if (Array.isArray(sessions)) {
    for (const sess of sessions.filter((s) => s.status !== 'closed')) {
      await fetch(`${GATEWAY_URL}/v1/sessions/${sess.sessionId}/close`, {
        method: 'PATCH',
        headers: authHeaders,
      });
      console.log(`  ✓ Sesión cerrada: ${sess.sessionId}`);
    }
  }

  // 5. Limpiar categorías de prueba y sus productos vía GraphQL
  const gqlQuery = `query { categories { id name products { id name } } }`;
  const gqlRes = await fetch(`${GATEWAY_URL}/v1/graphql`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ query: gqlQuery }),
  });
  const gqlData = await gqlRes.json();
  const categories = gqlData.data?.categories || [];

  for (const cat of categories) {
    if (cat.name.startsWith('Snacks Bar') || cat.name === 'cocktails') {
      // Eliminar productos de la categoría primero
      for (const prod of cat.products || []) {
        await fetch(`${GATEWAY_URL}/v1/graphql`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ query: `mutation { deleteProduct(id: "${prod.id}") }` }),
        });
        console.log(`  ✓ Producto de prueba eliminado: ${prod.name} (${prod.id})`);
      }
      // Eliminar categoría
      await fetch(`${GATEWAY_URL}/v1/graphql`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ query: `mutation { deleteCategory(id: "${cat.id}") }` }),
      });
      console.log(`  ✓ Categoría de prueba eliminada: ${cat.name} (${cat.id})`);
    }
  }

  // 6. Limpiar mesas de prueba
  const tablesRes = await fetch(`${GATEWAY_URL}/v1/tables`, { headers: authHeaders });
  const rawTables = await tablesRes.json();
  const tables = Array.isArray(rawTables) ? rawTables : rawTables.data || [];
  for (const table of tables) {
    const tId = table.tableId || table.id;
    if (table.label === 'MesaRev' || tId === 'table-1792610690861-992' || (table.label === '1' && tId !== 'table-1791997479023-988')) {
      await fetch(`${GATEWAY_URL}/v1/tables/${tId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      console.log(`  ✓ Mesa de prueba eliminada: ${table.label} (${tId})`);
    }
  }

  // 7. Limpiar zonas de prueba y restaurar zonas oficiales
  const zonesRes = await fetch(`${GATEWAY_URL}/v1/zones`, { headers: authHeaders });
  const rawZones = await zonesRes.json();
  const zones = Array.isArray(rawZones) ? rawZones : rawZones.data || [];

  for (const zone of zones) {
    if (zone.name === 'Terraza Test' || zone.name === 'Zona Revisión') {
      await fetch(`${GATEWAY_URL}/v1/zones/${zone.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      console.log(`  ✓ Zona de prueba eliminada: ${zone.name} (${zone.id})`);
    }
  }

  // 8. Restaurar asignación de zona a mesas oficiales
  // Recargar zonas
  const freshZonesRes = await fetch(`${GATEWAY_URL}/v1/zones`, { headers: authHeaders });
  const freshZones = await freshZonesRes.json();
  const salonZone = freshZones.find((z) => z.name === 'Salón Principal');
  const terrazaZone = freshZones.find((z) => z.name === 'Terraza');
  const barraZone = freshZones.find((z) => z.name === 'Barra');
  const vipZone = freshZones.find((z) => z.name === 'VIP');

  const freshTablesRes = await fetch(`${GATEWAY_URL}/v1/tables`, { headers: authHeaders });
  const freshTables = await freshTablesRes.json();

  const zoneMap = {
    'Mesa 1': salonZone?.id,
    'Mesa 2': salonZone?.id,
    'Mesa 3': terrazaZone?.id,
    'Mesa 4': terrazaZone?.id,
    'Barra 1': barraZone?.id,
    'Barra 2': barraZone?.id,
    'VIP 1': vipZone?.id,
  };

  for (const table of freshTables) {
    const expectedZoneId = zoneMap[table.label];
    const tId = table.tableId || table.id;
    if (expectedZoneId && table.zoneId !== expectedZoneId) {
      await fetch(`${GATEWAY_URL}/v1/tables/${tId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ zoneId: expectedZoneId }),
      });
      console.log(`  ✓ Mesa ${table.label} reasignada a zona correcta (${expectedZoneId})`);
    }
  }

  // 9. Restaurar configuración del tenant: waiter_only / 22 min / simple
  const settingsRes = await fetch(`${GATEWAY_URL}/v1/tenant/settings`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      operatingMode: 'waiter_only',
      estimatedPrepMinutes: 22,
      invoiceMode: 'simple',
    }),
  });
  if (settingsRes.ok) {
    console.log('  ✓ Configuración de tenant restaurada a: waiter_only / 22 min / simple');
  }

  console.log('\n✨ Limpieza de demo completada al 100%.\n');
}

main().catch((err) => {
  console.error('Error en limpieza:', err);
  process.exit(1);
});
