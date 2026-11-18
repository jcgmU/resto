#!/usr/bin/env node

/**
 * scripts/e2e-mixed-order.mjs - E2E para Ronda 3 & 4 (Destinos de Categoría, Monitores Filtrados, Progresión y DIAN Moca)
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';

async function graphqlRequest(url, token, query, variables = {}) {
  const res = await fetch(`${url}/v1/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL request failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

async function main() {
  console.log('================================================================');
  console.log(' 🚀 INICIANDO E2E RONDA 3 & 4: DESTINOS POR CATEGORÍA, MONITORES Y COBRO');
  console.log('================================================================\n');

  // 1. Logins
  console.log('[1/7] 🔐 Autenticando usuarios (Admin, Mesero, Cajero, Monitor Cocina, Monitor Bar)...');
  const login = async (email, password) => {
    const res = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Login ${email} falló: ${await res.text()}`);
    const data = await res.json();
    return { token: data.tokens.accessToken, user: data.user };
  };

  const adminAuth = await login('admin', 'admin');
  const waiterAuth = await login('mesero@resto.com', 'admin1234');
  const cashierAuth = await login('cajero@resto.com', 'admin1234');
  const kitchenAuth = await login('monitor@resto.com', 'admin1234');
  const barAuth = await login('monitorbar@resto.com', 'admin1234');
  console.log('  ✓ Todos los perfiles autenticados correctamente.');

  let barCat = null;
  let barProd = null;
  let sessionId = null;
  let orderId = null;

  try {
    // 2. Admin crea categoría nueva con destino Bar y le asigna producto vía GraphQL
  console.log('\n[2/7] 🏷️ Admin crea categoría con destino "bar" y producto asociado vía GraphQL...');
  const catName = `Snacks Bar ${Date.now() % 10000}`;
  const createCatMutation = `
    mutation CreateCategory($input: CreateCategoryInput!) {
      createCategory(input: $input) {
        id
        name
        destination
      }
    }
  `;
  const catData = await graphqlRequest(GATEWAY_URL, adminAuth.token, createCatMutation, {
    input: {
      name: catName,
      sortOrder: 10,
      destination: 'bar',
    },
  });
  barCat = catData.createCategory;
  if (!barCat.id || barCat.destination !== 'bar') {
    throw new Error(`Categoría creada no tiene destino bar: ${JSON.stringify(barCat)}`);
  }
  console.log(`  ✓ Categoría creada: "${barCat.name}" (ID: ${barCat.id}, Destino: ${barCat.destination})`);

  // Crear producto bajo la categoría bar
  const prodName = `Nachos Suprema ${Date.now() % 10000}`;
  const createProdMutation = `
    mutation CreateProduct($input: CreateProductInput!) {
      createProduct(input: $input) {
        id
        name
        price
        category {
          id
          name
          destination
        }
      }
    }
  `;
  const prodData = await graphqlRequest(GATEWAY_URL, adminAuth.token, createProdMutation, {
    input: {
      name: prodName,
      price: 24000,
      categoryId: barCat.id,
      description: 'Totopos crujientes con queso fundido y jalapeños',
    },
  });
  barProd = prodData.createProduct;
  console.log(`  ✓ Producto Bar creado: "${barProd.name}" (ID: ${barProd.id}, Destino heredado: ${barProd.category?.destination})`);

  // Obtener producto de cocina existente (Postres o Platos Fuertes sin modificadores requeridos)
  const menuQuery = `
    query GetMenu {
      products {
        id
        name
        price
        category {
          id
          name
          destination
        }
        modifierGroups {
          id
          name
          isRequired
          options {
            id
            name
            priceDelta
          }
        }
      }
    }
  `;
  const menuData = await graphqlRequest(GATEWAY_URL, adminAuth.token, menuQuery);
  const kitchenProd = menuData.products.find(
    (p) => p.category?.destination === 'kitchen' && (!p.modifierGroups || p.modifierGroups.length === 0)
  ) || menuData.products.find((p) => p.name === 'Tiramisu Artesanal') || menuData.products.find((p) => p.category?.destination === 'kitchen');
  if (!kitchenProd) {
    throw new Error('No se encontró un producto existente con destino cocina');
  }
  console.log(`  ✓ Producto Cocina identificado: "${kitchenProd.name}" (ID: ${kitchenProd.id}, Destino: ${kitchenProd.category?.destination})`);

  // 3. Abrir mesa y sesión para comensal
  console.log('\n[3/7] 🍽️ Mesero abre sesión en Mesa 2 y crea pedido mixto...');
  const tablesRes = await fetch(`${GATEWAY_URL}/v1/tables`, {
    headers: { Authorization: `Bearer ${waiterAuth.token}` },
  });
  const rawTables = await tablesRes.json();
  const tables = Array.isArray(rawTables) ? rawTables : rawTables.data || rawTables.tables || [];
  const targetTable = tables.find((t) => t.label === 'Mesa 2') || tables[0];
  const tableId = targetTable.tableId || targetTable.id;

  // Limpiar sesión previa si existe
  const activeSessionsRes = await fetch(`${GATEWAY_URL}/v1/sessions`, {
    headers: { Authorization: `Bearer ${waiterAuth.token}` },
  });
  const activeSessions = (await activeSessionsRes.json()) || [];
  for (const sess of activeSessions) {
    if (sess.tableId === tableId && (sess.status === 'active' || sess.status === 'billRequested')) {
      await fetch(`${GATEWAY_URL}/v1/sessions/${sess.sessionId}/close`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${cashierAuth.token}` },
      });
    }
  }

  const openRes = await fetch(`${GATEWAY_URL}/v1/sessions/staff-open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${waiterAuth.token}`,
    },
    body: JSON.stringify({ tableId }),
  });
  if (!openRes.ok) throw new Error(`staff-open falló: ${await openRes.text()}`);
  const openData = await openRes.json();
  sessionId = openData.session?.sessionId || openData.sessionId;
  console.log(`  ✓ Sesión abierta en ${targetTable.label} (ID: ${sessionId})`);

  // 4. Agregar ítems al carrito (1 Bar + 1 Cocina) y confirmar comanda
  const guestToken = openData.session?.guestToken || openData.guestToken || waiterAuth.token;

  // Agregar producto Bar
  const addBarRes = await fetch(`${GATEWAY_URL}/v1/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${guestToken}`,
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      productId: barProd.id,
      quantity: 1,
      notes: 'Sin picante',
      modifiers: [],
    }),
  });
  if (!addBarRes.ok) throw new Error(`Error al agregar ítem bar al carrito: ${await addBarRes.text()}`);

  // Agregar producto Cocina
  const addKitchenRes = await fetch(`${GATEWAY_URL}/v1/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${guestToken}`,
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      productId: kitchenProd.id,
      quantity: 1,
      notes: 'Bien cocido',
      modifiers: [],
    }),
  });
  if (!addKitchenRes.ok) throw new Error(`Error al agregar ítem cocina al carrito: ${await addKitchenRes.text()}`);

  // Confirmar comanda
  const confirmOrderRes = await fetch(`${GATEWAY_URL}/v1/cart/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${guestToken}`,
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      notes: 'Pedido mixto de prueba E2E',
    }),
  });
  if (!confirmOrderRes.ok) throw new Error(`confirmOrder falló: ${await confirmOrderRes.text()}`);
  const order = await confirmOrderRes.json();
  orderId = order.id;
  console.log(`  ✓ Pedido mixto confirmado: ${orderId} (Total: $${order.total})`);

  const hasKitchen = order.items.some((i) => (i.destination || 'kitchen') === 'kitchen');
  const hasBar = order.items.some((i) => i.destination === 'bar');
  if (!hasKitchen || !hasBar) {
    throw new Error(`El pedido no denormalizó correctamente ambos destinos: ${JSON.stringify(order.items)}`);
  }
  console.log(`  ✓ Denormalización de destinos en ítems verificada (Cocina: sí, Bar: sí)`);
  console.log(`  ✓ Estados iniciales: Global=${order.status}, Cocina=${order.kitchenStatus}, Bar=${order.barStatus}`);

  // 5. Progresión de estados por destino
  console.log('\n[4/7] ⏱️ Verificando progresión secuencial e independencia de destinos...');

  // 5a. Bar marca IN_KITCHEN
  const barStep1Res = await fetch(`${GATEWAY_URL}/v1/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${barAuth.token}`,
    },
    body: JSON.stringify({ status: 'IN_KITCHEN', destination: 'bar' }),
  });
  if (!barStep1Res.ok) throw new Error(`Bar IN_KITCHEN falló: ${await barStep1Res.text()}`);
  const barStep1 = await barStep1Res.json();
  if (barStep1.barStatus !== 'IN_KITCHEN' || barStep1.status !== 'PLACED') {
    throw new Error(`Inconsistencia en paso 1 bar: ${JSON.stringify(barStep1)}`);
  }
  console.log(`  ✓ Bar avanza a IN_KITCHEN -> Bar=IN_KITCHEN, Cocina=PLACED, Global=PLACED (el menos avanzado manda)`);

  // 5b. Bar marca READY
  const barStep2Res = await fetch(`${GATEWAY_URL}/v1/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${barAuth.token}`,
    },
    body: JSON.stringify({ status: 'READY', destination: 'bar' }),
  });
  if (!barStep2Res.ok) throw new Error(`Bar READY falló: ${await barStep2Res.text()}`);
  const barStep2 = await barStep2Res.json();
  if (barStep2.barStatus !== 'READY' || barStep2.status !== 'PLACED') {
    throw new Error(`Inconsistencia en paso 2 bar: ${JSON.stringify(barStep2)}`);
  }
  console.log(`  ✓ Bar avanza a READY -> Bar=READY, Cocina=PLACED, Global=PLACED (Cocina aún pendiente)`);

  // 5c. Cocina marca IN_KITCHEN
  const kitchenStep1Res = await fetch(`${GATEWAY_URL}/v1/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${kitchenAuth.token}`,
    },
    body: JSON.stringify({ status: 'IN_KITCHEN', destination: 'kitchen' }),
  });
  if (!kitchenStep1Res.ok) throw new Error(`Cocina IN_KITCHEN falló: ${await kitchenStep1Res.text()}`);
  const kitchenStep1 = await kitchenStep1Res.json();
  if (kitchenStep1.kitchenStatus !== 'IN_KITCHEN' || kitchenStep1.status !== 'IN_KITCHEN') {
    throw new Error(`Inconsistencia en paso 1 cocina: ${JSON.stringify(kitchenStep1)}`);
  }
  console.log(`  ✓ Cocina avanza a IN_KITCHEN -> Bar=READY, Cocina=IN_KITCHEN, Global=IN_KITCHEN`);

  // 5d. Cocina marca READY -> ¡Ambos listos! Global pasa a READY
  const kitchenStep2Res = await fetch(`${GATEWAY_URL}/v1/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${kitchenAuth.token}`,
    },
    body: JSON.stringify({ status: 'READY', destination: 'kitchen' }),
  });
  if (!kitchenStep2Res.ok) throw new Error(`Cocina READY falló: ${await kitchenStep2Res.text()}`);
  const kitchenStep2 = await kitchenStep2Res.json();
  if (kitchenStep2.kitchenStatus !== 'READY' || kitchenStep2.barStatus !== 'READY' || kitchenStep2.status !== 'READY') {
    throw new Error(`Inconsistencia en paso 2 cocina: ${JSON.stringify(kitchenStep2)}`);
  }
  console.log(`  ✓ Cocina avanza a READY -> Bar=READY, Cocina=READY, Global=READY (¡Ambos destinos listos!)`);

  // 6. Mesero entrega orden completa (DELIVERED)
  console.log('\n[5/7] 🚀 Mesero entrega el pedido completo a la mesa...');
  const deliverRes = await fetch(`${GATEWAY_URL}/v1/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${waiterAuth.token}`,
    },
    body: JSON.stringify({ status: 'DELIVERED' }),
  });
  if (!deliverRes.ok) throw new Error(`DELIVERED falló: ${await deliverRes.text()}`);
  const delivered = await deliverRes.json();
  if (delivered.status !== 'DELIVERED') {
    throw new Error(`Estado global no es DELIVERED: ${JSON.stringify(delivered)}`);
  }
  console.log(`  ✓ Orden entregada con éxito: Status=DELIVERED`);

  // 7. Cobro en Terminal de Caja con método Tarjeta (CARD) y validación de Factura Moca
  console.log('\n[6/7] 💳 Cajero liquida y cobra la cuenta con método TARJETA (CARD)...');
  const billRes = await fetch(`${GATEWAY_URL}/v1/checkout/${sessionId}`, {
    headers: { Authorization: `Bearer ${cashierAuth.token}` },
  });
  if (!billRes.ok) throw new Error(`GET /v1/checkout falló: ${await billRes.text()}`);
  const billData = await billRes.json();
  const bill = billData.bill || billData;
  console.log(`  ✓ Detalle de cuenta obtenido: Total=$${bill.total}, Pedidos=${bill.orders?.length}`);

  const checkoutRes = await fetch(`${GATEWAY_URL}/v1/checkout/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cashierAuth.token}`,
    },
    body: JSON.stringify({
      sessionId,
      tableId,
      method: 'CARD',
      amount: bill.total,
    }),
  });
  if (!checkoutRes.ok) throw new Error(`confirm checkout falló: ${await checkoutRes.text()}`);
  const paymentResult = await checkoutRes.json();
  const payment = paymentResult.payment || paymentResult;
  console.log(`  ✓ Cobro registrado por Cajero: Método=${payment.method}, Monto=$${payment.amount}`);
  console.log(`  ✓ Estado de Factura Moca: invoiceStatus=${payment.invoiceStatus || 'pending/none'}`);

  // Probar endpoint de reintento de factura
  console.log('\n[7/7] 🧾 Probando endpoint de reintento de emisión de factura (Moca)...');
  const retryRes = await fetch(`${GATEWAY_URL}/v1/checkout/${sessionId}/retry-invoice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cashierAuth.token}`,
    },
  });
  if (!retryRes.ok) throw new Error(`retry-invoice falló (${retryRes.status}): ${await retryRes.text()}`);
  const retryData = await retryRes.json();
  console.log(`  ✓ Reintento de factura respondió 200 OK: Estado actual=${retryData.invoiceStatus || retryData.payment?.invoiceStatus}`);

  // Verificar que la mesa quedó liberada / sesión cerrada
  const sessionCheckRes = await fetch(`${GATEWAY_URL}/v1/sessions`, {
    headers: { Authorization: `Bearer ${cashierAuth.token}` },
  });
  const allSessions = (await sessionCheckRes.json()) || [];
  const mySession = allSessions.find((s) => s.sessionId === sessionId);
  if (mySession && mySession.status !== 'closed') {
    throw new Error(`La sesión sigue activa después del cobro (status=${mySession.status})`);
  }
  console.log(`  ✓ Mesa liberada y sesión cerrada correctamente (status=${mySession?.status || 'closed'}).`);

  console.log('\n================================================================');
  console.log(' 🎉 E2E RONDA 3 & 4 COMPLETADO CON 100% DE ÉXITO');
  console.log('================================================================\n');
  } finally {
    console.log('\n🧹 [Cleanup] Limpiando datos de prueba de e2e-mixed-order...');
    if (barProd?.id && adminAuth?.token) {
      try {
        await graphqlRequest(GATEWAY_URL, adminAuth.token, `mutation { deleteProduct(id: "${barProd.id}") }`);
        console.log(`  ✓ [Cleanup] Producto de prueba ${barProd.id} eliminado.`);
      } catch (e) {
        console.warn(`  ⚠️ [Cleanup] Error eliminando producto: ${e.message}`);
      }
    }
    if (barCat?.id && adminAuth?.token) {
      try {
        await graphqlRequest(GATEWAY_URL, adminAuth.token, `mutation { deleteCategory(id: "${barCat.id}") }`);
        console.log(`  ✓ [Cleanup] Categoría de prueba ${barCat.id} eliminada.`);
      } catch (e) {
        console.warn(`  ⚠️ [Cleanup] Error eliminando categoría: ${e.message}`);
      }
    }
    if (orderId && kitchenAuth?.token) {
      try {
        await fetch(`${GATEWAY_URL}/v1/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kitchenAuth.token}` },
          body: JSON.stringify({ status: 'DELIVERED' }),
        });
      } catch {}
    }
    if (sessionId && cashierAuth?.token) {
      try {
        await fetch(`${GATEWAY_URL}/v1/sessions/${sessionId}/close`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${cashierAuth.token}` },
        });
      } catch {}
    }
  }
}

main().catch((err) => {
  console.error('\n❌ ERROR EN E2E RONDA 3 & 4:', err);
  process.exit(1);
});
