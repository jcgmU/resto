#!/usr/bin/env node
// Verifica que seed:demo dejó órdenes activas visibles para los monitores de cocina y bar.
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';
const ACTIVE = new Set(['PLACED', 'IN_KITCHEN', 'READY']);

async function login(email, password) {
  const res = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login ${email} falló (${res.status})`);
  return (await res.json()).tokens.accessToken;
}

async function activeOrders(token) {
  const res = await fetch(`${GATEWAY_URL}/v1/orders`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET /v1/orders falló (${res.status})`);
  const body = await res.json();
  const list = Array.isArray(body) ? body : body.data || body.orders || [];
  return list.filter((o) => ACTIVE.has(o.status));
}

const failures = [];
const kitchen = await activeOrders(await login('monitor@resto.com', process.env.DEMO_MONITOR_PASSWORD || 'admin1234'));
const bar = await activeOrders(await login('monitorbar@resto.com', process.env.DEMO_MONITOR_BAR_PASSWORD || 'admin1234'));

const hasDest = (orders, dest) => orders.filter((o) => (o.items || []).some((i) => (i.destination || 'kitchen') === dest));
const kitchenOrders = hasDest(kitchen, 'kitchen');
const barOrders = hasDest(bar, 'bar');
const tables = new Set([...kitchenOrders, ...barOrders].map((o) => o.tableId));
const statuses = new Set([...kitchenOrders, ...barOrders].map((o) => o.status));

if (kitchenOrders.length < 2) failures.push(`cocina: ${kitchenOrders.length} órdenes activas (mínimo 2)`);
if (barOrders.length < 1) failures.push(`bar: ${barOrders.length} órdenes activas (mínimo 1)`);
if (tables.size < 3) failures.push(`mesas con órdenes: ${tables.size} (mínimo 3)`);
for (const s of ACTIVE) if (!statuses.has(s)) failures.push(`falta una orden en estado ${s}`);

if (failures.length) {
  console.error('[check-seed-orders] FALLA:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log(`[check-seed-orders] OK: cocina=${kitchenOrders.length}, bar=${barOrders.length}, mesas=${tables.size}, estados=${[...statuses].join('/')}`);
