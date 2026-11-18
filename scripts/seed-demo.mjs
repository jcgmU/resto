#!/usr/bin/env node

/**
 * seed-demo.mjs - Seed idempotente de datos demo para Restaurante OS
 * 
 * Requisitos:
 * - Pure Node 20 (global fetch, cero dependencias)
 * - Idempotente al 100% (segunda corrida reporta 0 creados)
 * - Variables de entorno: GATEWAY_URL (default: 'http://localhost:4000')
 *                         DEMO_ADMIN_PASSWORD (default: 'admin')
 */

import { deflateSync as zlibDeflate } from 'node:zlib';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'admin';

// Fotos de ejemplo: PNG liso de 96x96 generado en memoria (sin dependencias ni archivos binarios en el repo).
function solidPng(r, g, b, size = 96) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibDeflate(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const DEMO_AVATAR_COLORS = {
  'mesero@resto.com': [143, 191, 149],
  'monitor@resto.com': [224, 166, 166],
  'monitorbar@resto.com': [220, 201, 138],
  'cajero@resto.com': [92, 103, 132],
};

const DESIRED_CATEGORIES = [
  { name: 'Entradas', sortOrder: 1, destination: 'bar' },
  { name: 'Platos Fuertes', sortOrder: 2, destination: 'kitchen' },
  { name: 'Bebidas', sortOrder: 3, destination: 'bar' },
  { name: 'Postres', sortOrder: 4, destination: 'kitchen' },
  { name: 'Cócteles', sortOrder: 5, destination: 'bar' },
];

const DESIRED_MODIFIER_GROUPS = [
  {
    name: 'Termino de coccion',
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      { name: 'Termino medio', priceDelta: 0, isDefault: true },
      { name: 'Tres cuartos', priceDelta: 0, isDefault: false },
      { name: 'Bien cocido', priceDelta: 0, isDefault: false },
    ],
  },
  {
    name: 'Adiciones',
    isRequired: false,
    minSelections: 0,
    maxSelections: 3,
    options: [
      { name: 'Queso extra', priceDelta: 4000, isDefault: false },
      { name: 'Aguacate', priceDelta: 5000, isDefault: false },
      { name: 'Tocineta', priceDelta: 4500, isDefault: false },
    ],
  },
];

const DESIRED_PRODUCTS = [
  // Entradas (18000 a 35000 COP)
  {
    categoryName: 'Entradas',
    name: 'Bruschetta Clasica',
    description: 'Pan tostado con tomate fresco, albahaca y aceite de oliva virgen extra',
    price: 22000,
    prepTimeMinutes: 12,
    modifierGroupNames: [],
  },
  {
    categoryName: 'Entradas',
    name: 'Nachos con Guacamole',
    description: 'Totopos de maiz crujientes con guacamole artesanal y pico de gallo',
    price: 28000,
    prepTimeMinutes: 15,
    modifierGroupNames: [],
  },
  // Platos Fuertes (38000 a 65000 COP)
  {
    categoryName: 'Platos Fuertes',
    name: 'Hamburguesa Gourmet',
    description: 'Carne de res seleccionada 200g, queso cheddar fundido y vegetales frescos',
    price: 42000,
    prepTimeMinutes: 20,
    modifierGroupNames: ['Termino de coccion', 'Adiciones'],
  },
  {
    categoryName: 'Platos Fuertes',
    name: 'Bife de Chorizo',
    description: 'Corte premium de carne a la parrilla servido con papas rusticas',
    price: 58000,
    prepTimeMinutes: 25,
    modifierGroupNames: ['Termino de coccion', 'Adiciones'],
  },
  {
    categoryName: 'Platos Fuertes',
    name: 'Pasta Carbonara',
    description: 'Pasta fresca con receta clasica italiana de panceta, yema y parmesano',
    price: 45000,
    prepTimeMinutes: 18,
    modifierGroupNames: ['Adiciones'],
  },
  {
    categoryName: 'Platos Fuertes',
    name: 'Pizza Margarita',
    description: 'Masa madre horneada a la piedra con salsa pomodoro, mozzarella y albahaca',
    price: 39000,
    prepTimeMinutes: 22,
    modifierGroupNames: ['Adiciones'],
  },
  // Bebidas (8000 a 16000 COP)
  {
    categoryName: 'Bebidas',
    name: 'Limonada Natural',
    description: 'Refrescante limonada natural preparada al instante',
    price: 9000,
    prepTimeMinutes: 10,
    modifierGroupNames: [],
  },
  {
    categoryName: 'Bebidas',
    name: 'Cerveza Artesanal',
    description: 'Cerveza rubia de elaboracion local bien fria',
    price: 14000,
    prepTimeMinutes: 10,
    modifierGroupNames: [],
  },
  {
    categoryName: 'Bebidas',
    name: 'Agua Mineral',
    description: 'Agua mineral de manantial con o sin gas',
    price: 8000,
    prepTimeMinutes: 10,
    modifierGroupNames: [],
  },
  // Cócteles (bar)
  {
    categoryName: 'Cócteles',
    name: 'Mojito Clásico',
    description: 'Ron blanco, hierbabuena fresca, azúcar de caña y soda',
    price: 26000,
    prepTimeMinutes: 8,
    modifierGroupNames: [],
  },
  // Postres (14000 a 24000 COP)
  {
    categoryName: 'Postres',
    name: 'Tiramisu Artesanal',
    description: 'Postre italiano tradicional con capas de cafe, bizcocho y mascarpone',
    price: 18000,
    prepTimeMinutes: 15,
    modifierGroupNames: [],
  },
  {
    categoryName: 'Postres',
    name: 'Cheesecake de Frutos Rojos',
    description: 'Suave tarta horneada de queso con coulis de frutos del bosque',
    price: 21000,
    prepTimeMinutes: 15,
    modifierGroupNames: [],
  },
];

const DESIRED_ZONES = [
  { name: 'Terraza', sortOrder: 1, polygon: [[0, 0], [6, 0], [6, 4], [0, 4]] },
  { name: 'Salón Principal', sortOrder: 2, polygon: [[7, 0], [14, 0], [14, 4], [7, 4]] },
  { name: 'Barra', sortOrder: 3, polygon: [[0, 5], [6, 5], [6, 7], [0, 7]] },
  { name: 'VIP', sortOrder: 4, polygon: [[7, 5], [11, 5], [11, 8], [7, 8]] },
];

const DESIRED_TABLES = [
  { label: 'Mesa 1', zoneName: 'Salón Principal', capacity: 4 },
  { label: 'Mesa 2', zoneName: 'Salón Principal', capacity: 4 },
  { label: 'Mesa 3', zoneName: 'Terraza', capacity: 6 },
  { label: 'Mesa 4', zoneName: 'Terraza', capacity: 6 },
  { label: 'Barra 1', zoneName: 'Barra', capacity: 4 },
  { label: 'Barra 2', zoneName: 'Barra', capacity: 4 },
  { label: 'VIP 1', zoneName: 'VIP', capacity: 8 },
];

const DEMO_ORDERS = [
  { tableLabel: 'Mesa 3', note: 'seed-demo: mixto nuevo', items: [['Tiramisu Artesanal', 2], ['Mojito Clásico', 1]], finalStatus: 'PLACED' },
  { tableLabel: 'Mesa 4', note: 'seed-demo: cocina en preparación', items: [['Cheesecake de Frutos Rojos', 1], ['Tiramisu Artesanal', 1]], finalStatus: 'IN_KITCHEN', destination: 'kitchen' },
  { tableLabel: 'Barra 1', note: 'seed-demo: bar listo', items: [['Agua Mineral', 2], ['Limonada Natural', 1]], finalStatus: 'READY', destination: 'bar' },
  { tableLabel: 'Barra 2', note: 'seed-demo: mixto con retraso (SLA de 5 min)', items: [['Cheesecake de Frutos Rojos', 1], ['Mojito Clásico', 2]], finalStatus: 'PLACED', estimatedMinutes: 5 },
];

const DEMO_RESERVATION = {
  customerName: 'Reserva Demo',
  phone: '3001234567',
  partySize: 6,
  tableLabel: 'VIP 1',
  notes: 'Reserva de demostración (seed)',
};

async function attemptLogin(gatewayUrl, password, maxRetries = 15, delayMs = 1500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${gatewayUrl}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin', password }),
      });
      if (res.status === 502 || res.status === 503) {
        if (attempt < maxRetries) {
          console.log(`[Auth] Gateway devolvio ${res.status} (servicios iniciando, intento ${attempt}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
      }
      return res;
    } catch (err) {
      if (attempt < maxRetries) {
        console.log(`[Auth] Esperando respuesta del gateway en ${gatewayUrl} (intento ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

async function graphqlRequest(gatewayUrl, token, query, variables = {}) {
  const res = await fetch(`${gatewayUrl}/v1/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GraphQL HTTP ${res.status}: ${text}`);
  }

  const result = await res.json();
  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

async function main() {
  console.log(`[Seed Demo] Conectando a ${GATEWAY_URL}...`);

  // 1. Auth Flow
  const loginRes = await attemptLogin(GATEWAY_URL, DEMO_ADMIN_PASSWORD);
  let accessToken = null;

  if (loginRes.status === 200) {
    const data = await loginRes.json();
    accessToken = data?.tokens?.accessToken;
    console.log('[Auth] Login exitoso con credenciales demo.');
  } else if (loginRes.status === 401) {
    console.log('[Auth] Usuario admin no autenticado (401). Registrando tenant demo...');
    const regRes = await fetch(`${GATEWAY_URL}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantName: 'Restaurante Demo',
        slug: 'demo',
        adminEmail: 'admin',
        adminPassword: DEMO_ADMIN_PASSWORD,
        adminDisplayName: 'Administrador',
      }),
    });

    if (regRes.status === 201 || regRes.status === 200) {
      const data = await regRes.json();
      accessToken = data?.tokens?.accessToken;
      console.log('[Auth] Tenant demo registrado exitosamente.');
    } else if (regRes.status === 409) {
      console.error(
        'Conflicto en registro del tenant demo. Las credenciales actuales no coinciden con los datos existentes. Para resetear el estado ejecuta: docker compose --profile services down -v y vuelve a arrancar.'
      );
      process.exit(1);
    } else {
      const errText = await regRes.text();
      console.error(`Error inesperado al registrar tenant (${regRes.status}): ${errText}`);
      process.exit(1);
    }
  } else {
    const errText = await loginRes.text();
    console.error(`Error inesperado en login (${loginRes.status}): ${errText}`);
    process.exit(1);
  }

  if (!accessToken) {
    console.error('No se pudo obtener el token de acceso para la sesion admin.');
    process.exit(1);
  }

  // 2. Reconciliacion de Categorias
  console.log('[Catalog] Reconciliando categorias...');
  const catQuery = `
    query GetCategories {
      categories {
        id
        name
        sortOrder
        destination
      }
    }
  `;
  const catData = await graphqlRequest(GATEWAY_URL, accessToken, catQuery);
  const existingCategories = catData.categories || [];

  let categoriesCreated = 0;
  let categoriesExisting = 0;
  const categoryMap = new Map();

  for (const cat of existingCategories) {
    categoryMap.set(cat.name, cat.id);
  }

  const createCatMutation = `
    mutation CreateCategory($input: CreateCategoryInput!) {
      createCategory(input: $input) {
        id
        name
        sortOrder
        destination
      }
    }
  `;
  const updateCatMutation = `
    mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
      updateCategory(id: $id, input: $input) {
        id
        destination
      }
    }
  `;

  for (const desired of DESIRED_CATEGORIES) {
    if (categoryMap.has(desired.name)) {
      categoriesExisting++;
      const existing = existingCategories.find((c) => c.name === desired.name);
      if (existing && existing.destination !== desired.destination) {
        await graphqlRequest(GATEWAY_URL, accessToken, updateCatMutation, {
          id: existing.id,
          input: { destination: desired.destination },
        });
      }
    } else {
      const res = await graphqlRequest(GATEWAY_URL, accessToken, createCatMutation, {
        input: {
          name: desired.name,
          sortOrder: desired.sortOrder,
          destination: desired.destination,
        },
      });
      const createdId = res.createCategory.id;
      categoryMap.set(desired.name, createdId);
      categoriesCreated++;
    }
  }

  // 3. Reconciliacion de Grupos de Modificadores y Opciones
  console.log('[Catalog] Reconciliando grupos de modificadores y opciones...');
  const modQuery = `
    query GetModifierGroups {
      modifierGroups {
        id
        name
        isRequired
        minSelections
        maxSelections
        options {
          id
          name
          priceDelta
          isDefault
        }
      }
    }
  `;
  const modData = await graphqlRequest(GATEWAY_URL, accessToken, modQuery);
  const existingModifierGroups = modData.modifierGroups || [];

  let modifierGroupsCreated = 0;
  let modifierGroupsExisting = 0;
  let optionsCreated = 0;
  let optionsExisting = 0;
  const modifierGroupMap = new Map();

  const createModGroupMutation = `
    mutation CreateModifierGroup($input: CreateModifierGroupInput!) {
      createModifierGroup(input: $input) {
        id
        name
        isRequired
        minSelections
        maxSelections
        options {
          id
          name
        }
      }
    }
  `;

  const addOptionMutation = `
    mutation AddModifierOption($groupId: ID!, $input: AddModifierOptionInput!) {
      addModifierOption(groupId: $groupId, input: $input) {
        id
        name
        priceDelta
        isDefault
      }
    }
  `;

  for (const desiredGroup of DESIRED_MODIFIER_GROUPS) {
    let group = existingModifierGroups.find((g) => g.name === desiredGroup.name);
    if (group) {
      modifierGroupsExisting++;
    } else {
      const res = await graphqlRequest(GATEWAY_URL, accessToken, createModGroupMutation, {
        input: {
          name: desiredGroup.name,
          isRequired: desiredGroup.isRequired,
          minSelections: desiredGroup.minSelections,
          maxSelections: desiredGroup.maxSelections,
        },
      });
      group = res.createModifierGroup;
      group.options = group.options || [];
      modifierGroupsCreated++;
    }
    modifierGroupMap.set(desiredGroup.name, group.id);

    // Opciones del grupo
    const existingOptions = group.options || [];
    for (const desiredOption of desiredGroup.options) {
      const optExists = existingOptions.some((o) => o.name === desiredOption.name);
      if (optExists) {
        optionsExisting++;
      } else {
        await graphqlRequest(GATEWAY_URL, accessToken, addOptionMutation, {
          groupId: group.id,
          input: {
            name: desiredOption.name,
            priceDelta: desiredOption.priceDelta,
            isDefault: desiredOption.isDefault,
          },
        });
        optionsCreated++;
      }
    }
  }

  // 4. Reconciliacion de Productos y Grupos Asociados
  console.log('[Catalog] Reconciliando productos y relaciones...');
  const prodQuery = `
    query GetProducts {
      products {
        id
        name
        price
        prepTimeMinutes
        category {
          id
          name
        }
        modifierGroups {
          id
          name
        }
      }
    }
  `;
  const prodData = await graphqlRequest(GATEWAY_URL, accessToken, prodQuery);
  const existingProducts = prodData.products || [];

  let productsCreated = 0;
  let productsExisting = 0;
  let relationsCreated = 0;
  let relationsExisting = 0;

  const createProdMutation = `
    mutation CreateProduct($input: CreateProductInput!) {
      createProduct(input: $input) {
        id
        name
        price
        prepTimeMinutes
        category {
          id
          name
        }
        modifierGroups {
          id
          name
        }
      }
    }
  `;

  const updateProdMutation = `
    mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
      updateProduct(id: $id, input: $input) {
        id
        name
        price
        prepTimeMinutes
      }
    }
  `;

  const attachGroupMutation = `
    mutation AttachModifierGroup($productId: ID!, $groupId: ID!) {
      attachModifierGroup(productId: $productId, groupId: $groupId) {
        id
      }
    }
  `;

  for (const desiredProduct of DESIRED_PRODUCTS) {
    let product = existingProducts.find((p) => p.name === desiredProduct.name);
    if (product) {
      productsExisting++;
      if (Number(product.price) !== desiredProduct.price || product.prepTimeMinutes !== desiredProduct.prepTimeMinutes) {
        await graphqlRequest(GATEWAY_URL, accessToken, updateProdMutation, {
          id: product.id,
          input: {
            price: desiredProduct.price,
            prepTimeMinutes: desiredProduct.prepTimeMinutes,
          },
        });
      }
    } else {
      const categoryId = categoryMap.get(desiredProduct.categoryName);
      if (!categoryId) {
        throw new Error(`Categoria ${desiredProduct.categoryName} no encontrada para producto ${desiredProduct.name}`);
      }

      const res = await graphqlRequest(GATEWAY_URL, accessToken, createProdMutation, {
        input: {
          categoryId,
          name: desiredProduct.name,
          description: desiredProduct.description,
          price: desiredProduct.price,
          prepTimeMinutes: desiredProduct.prepTimeMinutes,
        },
      });
      product = res.createProduct;
      product.modifierGroups = product.modifierGroups || [];
      productsCreated++;
    }

    // Grupos asociados
    const attachedGroupIds = new Set((product.modifierGroups || []).map((g) => g.id));
    const attachedGroupNames = new Set((product.modifierGroups || []).map((g) => g.name));

    for (const groupName of desiredProduct.modifierGroupNames) {
      const groupId = modifierGroupMap.get(groupName);
      if (!groupId) {
        throw new Error(`Grupo de modificador ${groupName} no encontrado para asociar a ${desiredProduct.name}`);
      }

      if (attachedGroupIds.has(groupId) || attachedGroupNames.has(groupName)) {
        relationsExisting++;
      } else {
        await graphqlRequest(GATEWAY_URL, accessToken, attachGroupMutation, {
          productId: product.id,
          groupId,
        });
        attachedGroupIds.add(groupId);
        attachedGroupNames.add(groupName);
        relationsCreated++;
      }
    }
  }

  // 5. Reconciliacion de Zonas
  console.log('[Zones] Reconciliando zonas...');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  const zonesRes = await fetch(`${GATEWAY_URL}/v1/zones`, { headers: authHeaders });
  if (!zonesRes.ok) {
    throw new Error(`GET /v1/zones fallo (${zonesRes.status}): ${await zonesRes.text()}`);
  }
  const existingZones = (await zonesRes.json()) || [];
  const zoneMap = new Map(existingZones.map((z) => [z.name, z.id || z.zoneId]));
  const existingByName = new Map(existingZones.map((z) => [z.name, z]));

  let zonesCreated = 0;
  let zonesExisting = 0;
  for (const desiredZone of DESIRED_ZONES) {
    if (zoneMap.has(desiredZone.name)) {
      zonesExisting++;
      if (!existingByName.get(desiredZone.name)?.polygon) {
        const patchRes = await fetch(`${GATEWAY_URL}/v1/zones/${zoneMap.get(desiredZone.name)}`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ polygon: desiredZone.polygon }),
        });
        if (!patchRes.ok) {
          throw new Error(`PATCH /v1/zones polygon fallo para "${desiredZone.name}" (${patchRes.status}): ${await patchRes.text()}`);
        }
      }
      continue;
    }
    const createZoneRes = await fetch(`${GATEWAY_URL}/v1/zones`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(desiredZone),
    });
    if (!createZoneRes.ok) {
      throw new Error(`POST /v1/zones fallo para "${desiredZone.name}" (${createZoneRes.status}): ${await createZoneRes.text()}`);
    }
    const createdZone = await createZoneRes.json();
    zoneMap.set(desiredZone.name, createdZone.id || createdZone.zoneId);
    zonesCreated++;
  }

  // 6. Reconciliacion de Mesas (zona + capacidad)
  console.log('[Tables] Reconciliando mesas...');
  const tablesRes = await fetch(`${GATEWAY_URL}/v1/tables`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!tablesRes.ok) {
    const errText = await tablesRes.text();
    throw new Error(`GET /v1/tables fallo (${tablesRes.status}): ${errText}`);
  }

  const existingTables = (await tablesRes.json()) || [];
  const tableByLabel = new Map(existingTables.map((t) => [t.label, t]));

  let tablesCreated = 0;
  let tablesExisting = 0;
  let tablesUpdated = 0;

  for (const desiredTable of DESIRED_TABLES) {
    const zoneId = zoneMap.get(desiredTable.zoneName);
    const existing = tableByLabel.get(desiredTable.label);
    if (existing) {
      tablesExisting++;
      if (existing.zoneId !== zoneId || existing.capacity !== desiredTable.capacity) {
        const tId = existing.tableId || existing.id;
        const patchRes = await fetch(`${GATEWAY_URL}/v1/tables/${tId}`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ zoneId, capacity: desiredTable.capacity }),
        });
        if (!patchRes.ok) {
          throw new Error(`PATCH /v1/tables/${tId} fallo (${patchRes.status}): ${await patchRes.text()}`);
        }
        tablesUpdated++;
      }
    } else {
      const createTableRes = await fetch(`${GATEWAY_URL}/v1/tables`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          label: desiredTable.label,
          zoneId,
          capacity: desiredTable.capacity,
          status: 'AVAILABLE',
        }),
      });

      if (!createTableRes.ok) {
        const errText = await createTableRes.text();
        throw new Error(`POST /v1/tables fallo para "${desiredTable.label}" (${createTableRes.status}): ${errText}`);
      }

      const createdTable = await createTableRes.json();
      tableByLabel.set(desiredTable.label, createdTable);
      tablesCreated++;
    }
  }

  // 7. Reserva demo para hoy (idempotente por nombre de cliente)
  console.log('[Reservations] Reconciliando reserva demo...');
  const resListRes = await fetch(`${GATEWAY_URL}/v1/reservations`, { headers: authHeaders });
  if (!resListRes.ok) {
    throw new Error(`GET /v1/reservations fallo (${resListRes.status}): ${await resListRes.text()}`);
  }
  const existingReservations = (await resListRes.json()) || [];
  let reservationsCreated = 0;
  let reservationsExisting = 0;
  const demoExists = existingReservations.some(
    (r) => r.customerName === DEMO_RESERVATION.customerName && r.status === 'active'
  );
  if (demoExists) {
    reservationsExisting++;
  } else {
    const resTable = tableByLabel.get(DEMO_RESERVATION.tableLabel);
    const resTableId = resTable && (resTable.tableId || resTable.id);
    if (!resTableId) {
      throw new Error(`Mesa ${DEMO_RESERVATION.tableLabel} no encontrada para la reserva demo`);
    }
    // Hoy a las 20:00 (hora local; si cae en otro dia UTC, se agenda en 5 min para seguir siendo "hoy")
    const reservedFor = new Date();
    reservedFor.setHours(20, 0, 0, 0);
    if (reservedFor.toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10)) {
      reservedFor.setTime(Date.now() + 5 * 60 * 1000);
    }
    const createResRes = await fetch(`${GATEWAY_URL}/v1/reservations`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tableId: resTableId,
        customerName: DEMO_RESERVATION.customerName,
        phone: DEMO_RESERVATION.phone,
        partySize: DEMO_RESERVATION.partySize,
        reservedFor: reservedFor.toISOString(),
        notes: DEMO_RESERVATION.notes,
      }),
    });
    if (!createResRes.ok) {
      throw new Error(`POST /v1/reservations fallo (${createResRes.status}): ${await createResRes.text()}`);
    }
    reservationsCreated++;
  }

  // 8. Reconciliacion de Empleados Demo (U4 R2)
  console.log('[Users] Reconciliando empleados demo...');
  const DESIRED_EMPLOYEES = [
    {
      displayName: 'Carlos Mesero',
      email: 'mesero@resto.com',
      role: 'WAITER',
      password: process.env.DEMO_WAITER_PASSWORD || 'admin1234',
    },
    {
      displayName: 'Monitor Cocina',
      email: 'monitor@resto.com',
      role: 'MONITOR',
      monitorKind: 'kitchen',
      password: process.env.DEMO_MONITOR_PASSWORD || 'admin1234',
    },
    {
      displayName: 'Monitor Bar',
      email: 'monitorbar@resto.com',
      role: 'MONITOR',
      monitorKind: 'bar',
      password: process.env.DEMO_MONITOR_BAR_PASSWORD || 'admin1234',
    },
    {
      displayName: 'Laura Caja',
      email: 'cajero@resto.com',
      role: 'CASHIER',
      password: process.env.DEMO_CASHIER_PASSWORD || 'admin1234',
    },
  ];

  const usersListRes = await fetch(`${GATEWAY_URL}/v1/identity/users`, { headers: authHeaders });
  if (!usersListRes.ok) {
    throw new Error(`GET /v1/identity/users fallo (${usersListRes.status}): ${await usersListRes.text()}`);
  }
  const existingUsers = (await usersListRes.json()) || [];
  const existingUserEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

  let employeesCreated = 0;
  let employeesExisting = 0;

  for (const emp of DESIRED_EMPLOYEES) {
    if (existingUserEmails.has(emp.email.toLowerCase())) {
      employeesExisting++;
    } else {
      const createEmpRes = await fetch(`${GATEWAY_URL}/v1/identity/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(emp),
      });
      if (!createEmpRes.ok) {
        throw new Error(`POST /v1/identity/users fallo para ${emp.email} (${createEmpRes.status}): ${await createEmpRes.text()}`);
      }
      employeesCreated++;
    }
  }

  // 9. Asignar Mesero Demo a Zona 'Terraza' (U7 R2)
  const allUsersRes = await fetch(`${GATEWAY_URL}/v1/identity/users`, { headers: authHeaders });
  const allUsers = (await allUsersRes.json()) || [];
  const waiterUser = allUsers.find((u) => u.email.toLowerCase() === 'mesero@resto.com');
  const terrazaId = zoneMap.get('Terraza');
  if (waiterUser && terrazaId) {
    const freshZonesRes = await fetch(`${GATEWAY_URL}/v1/zones`, { headers: authHeaders });
    const freshZones = (await freshZonesRes.json()) || [];
    const terrazaZone = freshZones.find((z) => (z.id || z.zoneId) === terrazaId);
    if (!terrazaZone?.staffIds?.includes(waiterUser.id)) {
      const nextStaffIds = [...(terrazaZone?.staffIds || []), waiterUser.id];
      await fetch(`${GATEWAY_URL}/v1/zones/${terrazaId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ staffIds: nextStaffIds }),
      });
      console.log(`[Zones] Asignado mesero demo (${waiterUser.email}) a zona Terraza.`);
    }
  }

  // 10. Órdenes activas de cocina y bar (idempotente: una mesa con sesión activa no se vuelve a sembrar)
  const loginAs = async (email, password) => {
    const res = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Login ${email} fallo (${res.status}): ${await res.text()}`);
    return (await res.json()).tokens.accessToken;
  };
  const waiterToken = await loginAs('mesero@resto.com', process.env.DEMO_WAITER_PASSWORD || 'admin1234');
  const waiterHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${waiterToken}` };

  const menuData = await graphqlRequest(GATEWAY_URL, accessToken, 'query { products { id name } }');
  const productIdByName = new Map((menuData.products || []).map((p) => [p.name, p.id]));

  const tablesForOrdersRes = await fetch(`${GATEWAY_URL}/v1/tables`, { headers: authHeaders });
  const tablesForOrdersRaw = await tablesForOrdersRes.json();
  const tablesForOrders = Array.isArray(tablesForOrdersRaw) ? tablesForOrdersRaw : tablesForOrdersRaw.data || tablesForOrdersRaw.tables || [];
  const tableIdByLabel = new Map(tablesForOrders.map((t) => [t.label, t.tableId || t.id]));

  // Marca de idempotencia: la nota "seed-demo: ..." de las ordenes ya sembradas que siguen activas
  const existingOrdersRes = await fetch(`${GATEWAY_URL}/v1/orders`, { headers: authHeaders });
  const existingOrdersRaw = existingOrdersRes.ok ? await existingOrdersRes.json() : [];
  const existingOrders = Array.isArray(existingOrdersRaw) ? existingOrdersRaw : existingOrdersRaw.data || existingOrdersRaw.orders || [];
  const seededNotes = new Set(
    existingOrders
      .filter((o) => ['PLACED', 'IN_KITCHEN', 'READY'].includes(o.status) && typeof o.notes === 'string' && o.notes.startsWith('seed-demo:'))
      .map((o) => o.notes),
  );

  let ordersCreated = 0;
  let ordersExisting = 0;

  for (const demo of DEMO_ORDERS) {
    const tableId = tableIdByLabel.get(demo.tableLabel);
    if (!tableId) throw new Error(`Seed de ordenes: no existe la mesa "${demo.tableLabel}"`);
    if (seededNotes.has(demo.note)) {
      ordersExisting++;
      continue;
    }

    const openRes = await fetch(`${GATEWAY_URL}/v1/sessions/staff-open`, {
      method: 'POST',
      headers: waiterHeaders,
      body: JSON.stringify({ tableId }),
    });
    if (!openRes.ok) throw new Error(`staff-open fallo en ${demo.tableLabel} (${openRes.status}): ${await openRes.text()}`);
    const openData = await openRes.json();
    const sessionId = openData.session?.sessionId || openData.sessionId;
    const sessionHeaders = { ...waiterHeaders, Authorization: `Bearer ${openData.session?.guestToken || openData.guestToken || waiterToken}`, 'x-session-id': sessionId };

    for (const [productName, quantity] of demo.items) {
      const productId = productIdByName.get(productName);
      if (!productId) throw new Error(`Seed de ordenes: producto "${productName}" no existe`);
      const addRes = await fetch(`${GATEWAY_URL}/v1/cart/items`, {
        method: 'POST',
        headers: sessionHeaders,
        body: JSON.stringify({ productId, quantity, modifiers: [] }),
      });
      if (!addRes.ok) throw new Error(`cart/items fallo (${addRes.status}): ${await addRes.text()}`);
    }

    const confirmRes = await fetch(`${GATEWAY_URL}/v1/cart/confirm`, {
      method: 'POST',
      headers: sessionHeaders,
      body: JSON.stringify({ notes: demo.note, ...(demo.estimatedMinutes ? { estimatedMinutes: demo.estimatedMinutes } : {}) }),
    });
    if (!confirmRes.ok) throw new Error(`cart/confirm fallo (${confirmRes.status}): ${await confirmRes.text()}`);
    const order = await confirmRes.json();

    const steps = demo.finalStatus === 'READY' ? ['IN_KITCHEN', 'READY'] : demo.finalStatus === 'IN_KITCHEN' ? ['IN_KITCHEN'] : [];
    for (const status of steps) {
      const statusRes = await fetch(`${GATEWAY_URL}/v1/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status, destination: demo.destination }),
      });
      if (!statusRes.ok) throw new Error(`PATCH status ${status} fallo (${statusRes.status}): ${await statusRes.text()}`);
    }
    ordersCreated++;
  }

  // 11. Fotos de perfil de ejemplo (idempotente: solo a quien aun no tiene avatarUrl)
  const usersForPhotosRes = await fetch(`${GATEWAY_URL}/v1/identity/users`, { headers: authHeaders });
  const usersForPhotos = usersForPhotosRes.ok ? (await usersForPhotosRes.json()) || [] : [];
  let photosCreated = 0;
  let photosExisting = 0;
  for (const user of usersForPhotos) {
    const color = DEMO_AVATAR_COLORS[(user.email || '').toLowerCase()];
    if (!color) continue;
    if (user.avatarUrl) {
      photosExisting++;
      continue;
    }
    const form = new FormData();
    form.append('file', new Blob([solidPng(...color)], { type: 'image/png' }), `${user.email.split('@')[0]}.png`);
    const uploadRes = await fetch(`${GATEWAY_URL}/v1/uploads`, {
      method: 'POST',
      headers: { Authorization: authHeaders.Authorization },
      body: form,
    });
    if (!uploadRes.ok) {
      console.warn(`[Fotos] POST /v1/uploads fallo para ${user.email} (${uploadRes.status}); se omite la foto de ejemplo.`);
      continue;
    }
    const { url } = await uploadRes.json();
    const patchRes = await fetch(`${GATEWAY_URL}/v1/identity/users/${user.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ avatarUrl: url }),
    });
    if (!patchRes.ok) {
      console.warn(`[Fotos] PATCH avatarUrl fallo para ${user.email} (${patchRes.status}); se omite la foto de ejemplo.`);
      continue;
    }
    photosCreated++;
  }

  const totalDesiredOptions = DESIRED_MODIFIER_GROUPS.reduce((acc, g) => acc + g.options.length, 0);
  const totalDesiredRelations = DESIRED_PRODUCTS.reduce((acc, p) => acc + p.modifierGroupNames.length, 0);

  // 6. Resumen de Salida
  console.log('\n=== Resumen de Seed Demo ===');
  console.log(`Categorías:         creadas ${categoriesCreated.toString().padStart(2)} / existentes ${categoriesExisting.toString().padStart(2)} (total ${DESIRED_CATEGORIES.length})`);
  console.log(`Grupos de Modif.:   creados ${modifierGroupsCreated.toString().padStart(2)} / existentes ${modifierGroupsExisting.toString().padStart(2)} (total ${DESIRED_MODIFIER_GROUPS.length})`);
  console.log(`Opciones de Modif.: creadas ${optionsCreated.toString().padStart(2)} / existentes ${optionsExisting.toString().padStart(2)} (total ${totalDesiredOptions})`);
  console.log(`Productos:          creados ${productsCreated.toString().padStart(2)} / existentes ${productsExisting.toString().padStart(2)} (total ${DESIRED_PRODUCTS.length})`);
  console.log(`Relaciones Modif.:  creadas ${relationsCreated.toString().padStart(2)} / existentes ${relationsExisting.toString().padStart(2)} (total ${totalDesiredRelations})`);
  console.log(`Zonas:              creadas ${zonesCreated.toString().padStart(2)} / existentes ${zonesExisting.toString().padStart(2)} (total ${DESIRED_ZONES.length})`);
  console.log(`Mesas:              creadas ${tablesCreated.toString().padStart(2)} / existentes ${tablesExisting.toString().padStart(2)} / actualizadas ${tablesUpdated} (total ${DESIRED_TABLES.length})`);
  console.log(`Reservas demo:      creadas ${reservationsCreated.toString().padStart(2)} / existentes ${reservationsExisting.toString().padStart(2)} (total 1)`);
  console.log(`Empleados demo:     creados ${employeesCreated.toString().padStart(2)} / existentes ${employeesExisting.toString().padStart(2)} (total ${DESIRED_EMPLOYEES.length})`);
  console.log(`Ordenes demo:       creadas ${ordersCreated.toString().padStart(2)} / existentes ${ordersExisting.toString().padStart(2)} (total ${DEMO_ORDERS.length})`);
  console.log(`Fotos de perfil:    creadas ${photosCreated.toString().padStart(2)} / existentes ${photosExisting.toString().padStart(2)}`);
  console.log('============================\n');
  console.log('Seed demo completado con éxito.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[Fallo Fatal en Seed Demo]:', err.message || err);
  process.exit(1);
});
