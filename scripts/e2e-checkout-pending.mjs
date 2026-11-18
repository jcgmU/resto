#!/usr/bin/env node

/**
 * scripts/e2e-checkout-pending.mjs - E2E para ADR D2 (Cobro con órdenes sin entregar)
 *
 * Verifica por HTTP real contra el gateway (http://localhost:4000):
 * a) Login admin y lectura de catálogo/mesas y settings actuales.
 * b) Autenticación de usuario CASHIER (cajero@resto.com del seed o creación temporal).
 * c) Apertura de sesión en mesa libre -> añadir producto al carrito -> confirmar pedido (PLACED).
 * d) POST /v1/checkout/confirm como admin SIN flag -> 409 ORDERS_NOT_DELIVERED con error.details.pendingOrders.
 * e) POST /v1/checkout/confirm como cashier CON closePendingOrders: true -> 403 FORBIDDEN.
 * f) POST /v1/checkout/confirm como admin CON closePendingOrders: true -> 201 Created.
 * g) GET /v1/orders/:id -> status === 'CANCELLED', cancelReason === 'checkout' y kitchenStatus/barStatus === 'CANCELLED'.
 * h) GET /v1/orders/:id/history -> incluye evento con toStatus === 'CANCELLED' y reason === 'checkout'.
 * i) GET /v1/orders (activas) -> NO incluye la orden cerrada.
 * j) Mesa liberada y sesión cerrada.
 * k) Cleanup completo en bloque finally.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'admin';
const DEMO_CASHIER_EMAIL = process.env.DEMO_CASHIER_EMAIL || 'cajero@resto.com';
const DEMO_CASHIER_PASSWORD = process.env.DEMO_CASHIER_PASSWORD || 'admin1234';

process.on('unhandledRejection', (reason) => {
  console.error('\n❌ Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('\n❌ Uncaught Exception:', err);
  process.exit(1);
});

async function login(email, password) {
  const res = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login ${email} falló (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return { token: data.tokens?.accessToken, user: data.user };
}

async function main() {
  console.log('================================================================');
  console.log(' 🚀 INICIANDO E2E ADR D2: COBRO CON ÓRDENES SIN ENTREGAR');
  console.log(` 🌐 Gateway URL: ${GATEWAY_URL}`);
  console.log('================================================================\n');

  let adminToken = null;
  let cashierToken = null;
  let originalSettings = null;
  let sessionId = null;
  let isSessionClosed = true;
  let orderId = null;
  let isOrderTerminal = true;

  try {
    // -------------------------------------------------------------------------
    // (a) Login admin y lectura de settings, menú y mesas
    // -------------------------------------------------------------------------
    console.log('[1/10] 🔐 Autenticando usuario admin y leyendo configuración actual...');
    const adminAuth = await login('admin', DEMO_ADMIN_PASSWORD);
    adminToken = adminAuth.token;
    if (!adminToken) {
      throw new Error('No se obtuvo accessToken para admin');
    }
    console.log(`  ✓ Admin autenticado (tenant: ${adminAuth.user?.tenantId})`);

    const settingsRes = await fetch(`${GATEWAY_URL}/v1/tenant/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (settingsRes.ok) {
      originalSettings = await settingsRes.json();
      console.log(
        `  ✓ Settings actuales leídos: operatingMode=${originalSettings.operatingMode}, estimatedPrepMinutes=${originalSettings.estimatedPrepMinutes}`
      );
    }

    // -------------------------------------------------------------------------
    // (b) Obtener o crear usuario CASHIER y autenticarlo
    // -------------------------------------------------------------------------
    console.log('\n[2/10] 💼 Autenticando usuario con rol CASHIER...');
    try {
      const cashierAuth = await login(DEMO_CASHIER_EMAIL, DEMO_CASHIER_PASSWORD);
      cashierToken = cashierAuth.token;
    } catch {
      console.log(`  ℹ️ Usuario ${DEMO_CASHIER_EMAIL} no disponible, creando cajero para la prueba...`);
      const createRes = await fetch(`${GATEWAY_URL}/v1/identity/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          displayName: 'Laura Caja',
          email: DEMO_CASHIER_EMAIL,
          role: 'CASHIER',
          password: DEMO_CASHIER_PASSWORD,
        }),
      });
      if (!createRes.ok && createRes.status !== 409) {
        throw new Error(`No se pudo crear usuario CASHIER (${createRes.status}): ${await createRes.text()}`);
      }
      const cashierAuth = await login(DEMO_CASHIER_EMAIL, DEMO_CASHIER_PASSWORD);
      cashierToken = cashierAuth.token;
    }
    if (!cashierToken) {
      throw new Error('No se obtuvo accessToken para CASHIER');
    }
    console.log(`  ✓ Usuario CASHIER autenticado (${DEMO_CASHIER_EMAIL})`);

    // -------------------------------------------------------------------------
    // (c) Abrir sesión en mesa libre -> añadir producto -> confirmar pedido
    // -------------------------------------------------------------------------
    console.log('\n[3/10] 🍽️ Seleccionando producto y abriendo sesión en mesa libre...');
    const gqlRes = await fetch(`${GATEWAY_URL}/v1/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
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
                name
                destination
              }
              modifierGroups {
                id
                isRequired
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
    const products = gqlData.data?.products || [];
    const selectedProduct =
      products.find(
        (p) =>
          (p.category?.destination || 'kitchen') === 'kitchen' &&
          (!p.modifierGroups || !p.modifierGroups.some((g) => g.isRequired))
      ) ||
      products.find((p) => !p.modifierGroups || !p.modifierGroups.some((g) => g.isRequired)) ||
      products[0];

    if (!selectedProduct) {
      throw new Error('No se encontraron productos disponibles en el catálogo');
    }
    const expectedDest = selectedProduct.category?.destination || 'kitchen';
    console.log(
      `  ✓ Producto seleccionado: "${selectedProduct.name}" (ID: ${selectedProduct.id}, Precio: $${selectedProduct.price}, Destino: ${expectedDest})`
    );

    const tablesRes = await fetch(`${GATEWAY_URL}/v1/tables`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!tablesRes.ok) {
      throw new Error(`GET /v1/tables falló (${tablesRes.status}): ${await tablesRes.text()}`);
    }
    const rawTables = await tablesRes.json();
    const tables = Array.isArray(rawTables) ? rawTables : rawTables.data || [];
    const targetTable =
      tables.find((t) => t.label === 'Mesa 3' && t.status === 'AVAILABLE') ||
      tables.find((t) => t.status === 'AVAILABLE') ||
      tables.find((t) => t.label === 'Mesa 3') ||
      tables[0];
    if (!targetTable) {
      throw new Error('No hay mesas configuradas en el tenant');
    }
    const tableId = targetTable.tableId || targetTable.id;

    // Limpiar sesión previa en esa mesa si existiera
    const sessionsRes = await fetch(`${GATEWAY_URL}/v1/sessions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const existingSessions = (await sessionsRes.json()) || [];
    for (const s of existingSessions) {
      if (s.tableId === tableId && s.status !== 'closed') {
        await fetch(`${GATEWAY_URL}/v1/sessions/${s.sessionId}/close`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      }
    }

    const openRes = await fetch(`${GATEWAY_URL}/v1/sessions/staff-open`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ tableId }),
    });
    if (!openRes.ok) {
      throw new Error(`POST /v1/sessions/staff-open falló (${openRes.status}): ${await openRes.text()}`);
    }
    const openData = await openRes.json();
    sessionId = openData.session?.sessionId || openData.sessionId;
    isSessionClosed = false;
    console.log(`  ✓ Sesión abierta en ${targetTable.label} (${tableId}): ${sessionId}`);

    const addCartRes = await fetch(`${GATEWAY_URL}/v1/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-session-id': sessionId,
      },
      body: JSON.stringify({
        sessionId,
        productId: selectedProduct.id,
        quantity: 2,
        notes: 'Prueba E2E D2 cobro con orden pendiente',
        modifiers: [],
      }),
    });
    if (!addCartRes.ok) {
      throw new Error(`POST /v1/cart/items falló (${addCartRes.status}): ${await addCartRes.text()}`);
    }

    const confirmOrderRes = await fetch(`${GATEWAY_URL}/v1/cart/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-session-id': sessionId,
      },
      body: JSON.stringify({
        sessionId,
        tableId,
        notes: 'Comanda pendiente para prueba D2',
      }),
    });
    if (!confirmOrderRes.ok) {
      throw new Error(`POST /v1/cart/confirm falló (${confirmOrderRes.status}): ${await confirmOrderRes.text()}`);
    }
    const createdOrder = await confirmOrderRes.json();
    orderId = createdOrder.id;
    isOrderTerminal = false;
    console.log(`  ✓ Orden creada en estado ${createdOrder.status}: ${orderId} (Total: $${createdOrder.total})`);

    // -------------------------------------------------------------------------
    // (d) Intentar POST /v1/checkout/confirm como admin SIN flag -> 409
    // -------------------------------------------------------------------------
    console.log('\n[4/10] 🛑 Probando POST /v1/checkout/confirm como admin SIN flag (espera 409)...');
    const noFlagRes = await fetch(`${GATEWAY_URL}/v1/checkout/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        sessionId,
        tableId,
        method: 'CASH',
      }),
    });

    const noFlagBody = await noFlagRes.json();
    if (noFlagRes.status !== 409) {
      throw new Error(`Se esperaba HTTP 409 sin flag, se obtuvo ${noFlagRes.status}: ${JSON.stringify(noFlagBody)}`);
    }
    if (noFlagBody?.error?.code !== 'ORDERS_NOT_DELIVERED') {
      throw new Error(`Se esperaba error.code === 'ORDERS_NOT_DELIVERED', se obtuvo: ${JSON.stringify(noFlagBody)}`);
    }
    const pendingList = noFlagBody?.error?.details?.pendingOrders;
    if (!Array.isArray(pendingList) || !pendingList.some((p) => p.orderId === orderId)) {
      throw new Error(
        `error.details.pendingOrders no incluye la orden ${orderId}: ${JSON.stringify(noFlagBody)}`
      );
    }
    console.log(
      `  ✓ Recibido HTTP 409 ORDERS_NOT_DELIVERED con pendingOrders (${pendingList.length} orden: ${orderId})`
    );

    // -------------------------------------------------------------------------
    // (e) Intentar POST /v1/checkout/confirm como CASHIER CON flag -> 403
    // -------------------------------------------------------------------------
    console.log('\n[5/10] 🔒 Probando POST /v1/checkout/confirm como CASHIER con closePendingOrders: true (espera 403)...');
    const cashierFlagRes = await fetch(`${GATEWAY_URL}/v1/checkout/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        sessionId,
        tableId,
        method: 'CASH',
        closePendingOrders: true,
      }),
    });

    const cashierFlagBody = await cashierFlagRes.json();
    if (cashierFlagRes.status !== 403) {
      throw new Error(
        `Se esperaba HTTP 403 para CASHIER con closePendingOrders: true, se obtuvo ${cashierFlagRes.status}: ${JSON.stringify(cashierFlagBody)}`
      );
    }
    console.log(`  ✓ Recibido HTTP 403 (${cashierFlagBody?.error?.code || 'FORBIDDEN'}) para rol CASHIER.`);

    // -------------------------------------------------------------------------
    // (f) Ejecutar POST /v1/checkout/confirm como ADMIN CON flag -> 201
    // -------------------------------------------------------------------------
    console.log('\n[6/10] ✅ Ejecutando POST /v1/checkout/confirm como ADMIN con closePendingOrders: true (espera 201)...');
    const adminFlagRes = await fetch(`${GATEWAY_URL}/v1/checkout/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        sessionId,
        tableId,
        method: 'CASH',
        closePendingOrders: true,
      }),
    });

    const adminFlagBody = await adminFlagRes.json();
    if (adminFlagRes.status !== 201) {
      throw new Error(
        `Se esperaba HTTP 201 para ADMIN con closePendingOrders: true, se obtuvo ${adminFlagRes.status}: ${JSON.stringify(adminFlagBody)}`
      );
    }
    isSessionClosed = true;
    isOrderTerminal = true;
    console.log(
      `  ✓ Recibido HTTP 201 Created. Pago registrado: ID=${adminFlagBody?.payment?.id}, Monto=$${adminFlagBody?.payment?.amount}`
    );

    // -------------------------------------------------------------------------
    // (g) Consultar GET /v1/orders/:id -> CANCELLED + cancelReason === 'checkout'
    // -------------------------------------------------------------------------
    console.log('\n[7/10] 🔎 Verificando estado de la orden cerrada en GET /v1/orders/:id...');
    const orderGetRes = await fetch(`${GATEWAY_URL}/v1/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!orderGetRes.ok) {
      throw new Error(`GET /v1/orders/${orderId} falló (${orderGetRes.status}): ${await orderGetRes.text()}`);
    }
    const closedOrder = await orderGetRes.json();
    if (closedOrder.status !== 'CANCELLED') {
      throw new Error(`Se esperaba status === 'CANCELLED', se obtuvo: ${closedOrder.status}`);
    }
    if (closedOrder.cancelReason !== 'checkout') {
      throw new Error(`Se esperaba cancelReason === 'checkout', se obtuvo: ${closedOrder.cancelReason}`);
    }
    if (expectedDest === 'kitchen' && closedOrder.kitchenStatus !== 'CANCELLED') {
      throw new Error(`Se esperaba kitchenStatus === 'CANCELLED', se obtuvo: ${closedOrder.kitchenStatus}`);
    }
    if (expectedDest === 'bar' && closedOrder.barStatus !== 'CANCELLED') {
      throw new Error(`Se esperaba barStatus === 'CANCELLED', se obtuvo: ${closedOrder.barStatus}`);
    }
    console.log(
      `  ✓ Orden ${orderId}: status=${closedOrder.status}, cancelReason=${closedOrder.cancelReason}, kitchenStatus=${closedOrder.kitchenStatus ?? 'null'}, barStatus=${closedOrder.barStatus ?? 'null'}`
    );

    // -------------------------------------------------------------------------
    // (h) Consultar GET /v1/orders/:id/history -> evento CANCELLED con reason 'checkout'
    // -------------------------------------------------------------------------
    console.log('\n[8/10] 📜 Verificando historial en GET /v1/orders/:id/history...');
    const historyRes = await fetch(`${GATEWAY_URL}/v1/orders/${orderId}/history`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!historyRes.ok) {
      throw new Error(`GET /v1/orders/${orderId}/history falló (${historyRes.status}): ${await historyRes.text()}`);
    }
    const history = await historyRes.json();
    const checkoutCancelEvent = Array.isArray(history)
      ? history.find((evt) => (evt.toStatus === 'CANCELLED' || evt.status === 'CANCELLED') && evt.reason === 'checkout')
      : null;
    if (!checkoutCancelEvent) {
      throw new Error(
        `El historial de la orden ${orderId} no incluye evento CANCELLED con reason='checkout': ${JSON.stringify(history)}`
      );
    }
    console.log(
      `  ✓ Evento de historial verificado: fromStatus=${checkoutCancelEvent.fromStatus} -> toStatus=${checkoutCancelEvent.toStatus}, reason=${checkoutCancelEvent.reason}`
    );

    // -------------------------------------------------------------------------
    // (i) Consultar órdenes activas -> NO incluye la orden cerrada
    // -------------------------------------------------------------------------
    console.log('\n[9/10] 📋 Verificando que la orden no figure entre las órdenes activas...');
    const allOrdersRes = await fetch(`${GATEWAY_URL}/v1/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!allOrdersRes.ok) {
      throw new Error(`GET /v1/orders falló (${allOrdersRes.status}): ${await allOrdersRes.text()}`);
    }
    const allOrders = await allOrdersRes.json();
    const activeOrders = (Array.isArray(allOrders) ? allOrders : []).filter((o) =>
      ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status)
    );
    if (activeOrders.some((o) => o.id === orderId)) {
      throw new Error(`La orden cerrada ${orderId} sigue apareciendo como activa`);
    }
    const placedOrdersRes = await fetch(`${GATEWAY_URL}/v1/orders?status=PLACED`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (placedOrdersRes.ok) {
      const placedOrders = await placedOrdersRes.json();
      if (Array.isArray(placedOrders) && placedOrders.some((o) => o.id === orderId)) {
        throw new Error(`La orden cerrada ${orderId} sigue apareciendo en ?status=PLACED`);
      }
    }
    console.log(`  ✓ Orden ${orderId} ausente del listado de órdenes activas (activas actuales: ${activeOrders.length}).`);

    // -------------------------------------------------------------------------
    // (j) Comprobar que la mesa quedó liberada (AVAILABLE y sin sesión activa)
    // -------------------------------------------------------------------------
    console.log('\n[10/10] 🪑 Verificando liberación de mesa y cierre de sesión...');
    const activeSessRes = await fetch(`${GATEWAY_URL}/v1/sessions?status=active`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!activeSessRes.ok) {
      throw new Error(`GET /v1/sessions?status=active falló (${activeSessRes.status}): ${await activeSessRes.text()}`);
    }
    const activeSessions = await activeSessRes.json();
    if (Array.isArray(activeSessions) && activeSessions.some((s) => s.sessionId === sessionId || s.tableId === tableId)) {
      throw new Error(`La sesión ${sessionId} o mesa ${tableId} sigue activa tras el checkout`);
    }

    const afterTablesRes = await fetch(`${GATEWAY_URL}/v1/tables`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!afterTablesRes.ok) {
      throw new Error(`GET /v1/tables falló (${afterTablesRes.status}): ${await afterTablesRes.text()}`);
    }
    const afterTables = await afterTablesRes.json();
    const updatedTable = (Array.isArray(afterTables) ? afterTables : []).find(
      (t) => (t.tableId || t.id) === tableId
    );
    if (!updatedTable || updatedTable.status !== 'AVAILABLE') {
      throw new Error(
        `Se esperaba mesa ${tableId} en estado AVAILABLE, se obtuvo: ${JSON.stringify(updatedTable)}`
      );
    }
    console.log(`  ✓ Mesa ${updatedTable.label} (${tableId}) en estado ${updatedTable.status} y sin sesión activa.`);

    console.log('\n================================================================');
    console.log(' 🎉 E2E ADR D2 (COBRO CON ÓRDENES PENDIENTES) COMPLETADO CON ÉXITO');
    console.log('================================================================\n');
  } finally {
    // -------------------------------------------------------------------------
    // (k) Cleanup best-effort en bloque finally
    // -------------------------------------------------------------------------
    if (adminToken) {
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      };

      // 1. Limpiar orden si quedó activa por fallo intermedio
      if (orderId && !isOrderTerminal) {
        try {
          const cancelRes = await fetch(`${GATEWAY_URL}/v1/orders/${orderId}/cancel`, {
            method: 'PATCH',
            headers: authHeaders,
          });
          if (!cancelRes.ok) {
            await fetch(`${GATEWAY_URL}/v1/orders/${orderId}/status`, {
              method: 'PATCH',
              headers: authHeaders,
              body: JSON.stringify({ status: 'DELIVERED' }),
            });
          }
          console.log(`  ✓ [Cleanup] Orden residual ${orderId} limpiada.`);
        } catch (err) {
          console.warn(`  ⚠️ [Cleanup] Error limpiando orden ${orderId}: ${err.message}`);
        }
      }

      // 2. Cerrar sesión si quedó abierta por fallo intermedio
      if (sessionId && !isSessionClosed) {
        try {
          await fetch(`${GATEWAY_URL}/v1/sessions/${sessionId}/close`, {
            method: 'PATCH',
            headers: authHeaders,
          });
          console.log(`  ✓ [Cleanup] Sesión residual ${sessionId} cerrada.`);
        } catch (err) {
          console.warn(`  ⚠️ [Cleanup] Error cerrando sesión ${sessionId}: ${err.message}`);
        }
      }

      // 3. Resolver llamadas de servicio pendientes de la sesión si existieran
      try {
        const callsRes = await fetch(`${GATEWAY_URL}/v1/service-calls`, { headers: authHeaders });
        if (callsRes.ok) {
          const calls = await callsRes.json();
          if (Array.isArray(calls)) {
            for (const c of calls.filter((call) => call.status === 'pending' && (!sessionId || call.sessionId === sessionId))) {
              const cId = c.callId || c.id;
              await fetch(`${GATEWAY_URL}/v1/service-calls/${cId}/resolve`, {
                method: 'PATCH',
                headers: authHeaders,
              });
            }
          }
        }
      } catch {}

      // 4. Restaurar settings originales del tenant
      if (originalSettings) {
        try {
          await fetch(`${GATEWAY_URL}/v1/tenant/settings`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({
              operatingMode: originalSettings.operatingMode || 'waiter_only',
              estimatedPrepMinutes: originalSettings.estimatedPrepMinutes ?? 22,
              invoiceMode: originalSettings.invoiceMode || 'simple',
            }),
          });
        } catch (err) {
          console.warn(`  ⚠️ [Cleanup] Error restaurando settings: ${err.message}`);
        }
      }
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ ERROR FATAL EN E2E CHECKOUT PENDING (D2):');
    console.error(err.message || err);
    process.exit(1);
  });
