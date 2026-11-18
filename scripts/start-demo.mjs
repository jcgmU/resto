#!/usr/bin/env node

/**
 * start-demo.mjs - Arranque único para Restaurante OS en red local
 *
 * Flujo:
 * 1. Comprueba prerrequisitos (Docker y Docker Compose).
 * 2. Determina LAN_IP (variable LAN_IP o autodetección por interfaces de red).
 * 3. Inicia contenedores backend vía docker compose --profile services up -d con CORS y variables demo.
 * 4. Espera a que el gateway responda HTTP 200 en /health.
 * 5. Compila los paquetes compartidos (@packages/*).
 * 6. Hace merge de .env.local para admin-dashboard y client-pwa.
 * 7. Ejecuta seed-demo.mjs con reintentos.
 * 8. Levanta los servidores dev (admin-dashboard y client-pwa) con prefijos en logs.
 * 9. Imprime el banner con las URLs de acceso e instrucciones.
 */

import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ==========================================
// Paso 1: Comprobar prerrequisitos
// ==========================================
function checkPrerequisites() {
  console.log('[start-demo] Paso 1: Verificando prerrequisitos (Docker)...');
  try {
    const composeCheck = spawnSync('docker', ['compose', 'version'], {
      stdio: 'pipe',
      encoding: 'utf-8',
      shell: true,
    });
    if (composeCheck.status !== 0) {
      console.error('Error: "docker compose" no está disponible en este sistema.');
      console.error(composeCheck.stderr || composeCheck.stdout || '');
      process.exit(1);
    }

    const infoCheck = spawnSync('docker', ['info'], {
      stdio: 'pipe',
      encoding: 'utf-8',
      shell: true,
    });
    if (infoCheck.status !== 0) {
      console.error('Error: El daemon de Docker no está en ejecución. Por favor inicia Docker Desktop.');
      console.error(infoCheck.stderr || infoCheck.stdout || '');
      process.exit(1);
    }
    console.log('[start-demo] Docker y Docker Compose verificados correctamente.');
  } catch (err) {
    console.error('Error al verificar prerrequisitos de Docker:', err.message);
    process.exit(1);
  }
}

// ==========================================
// Paso 2: Determinar LAN_IP
// ==========================================
const IGNORED_INTERFACE_REGEX =
  /vethernet|virtualbox|vmware|hyper-v|wsl|docker|vpn|tailscale|loopback|tunnel|tap|bluetooth/i;
const VBOX_MAC_PREFIXES = ['0a:00:27', '08:00:27', '0a-00-27', '08-00-27'];

function isExcludedIpv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  // CGNAT (100.64.0.0/10: 100.64.0.0 - 100.127.255.255, ej. Tailscale)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // Link-local (169.254.0.0/16)
  if (a === 169 && b === 254) return true;
  // Loopback (127.0.0.0/8)
  if (a === 127) return true;
  // VirtualBox host-only default network (192.168.56.0/24)
  if (a === 192 && b === 168 && c === 56) return true;

  return false;
}

function getIpPriority(ip) {
  const [a, b] = ip.split('.').map(Number);
  // Prioridad 1: 192.168.0.0/16 (hogar / oficina Wi-Fi y Ethernet)
  if (a === 192 && b === 168) return 1;
  // Prioridad 2: 10.0.0.0/8
  if (a === 10) return 2;
  // Prioridad 3: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return 3;
  // Prioridad 4: Cualquier otra IPv4
  return 4;
}

function collectNetworkCandidates() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [name, netList] of Object.entries(nets)) {
    if (IGNORED_INTERFACE_REGEX.test(name)) continue;

    for (const net of netList || []) {
      const isIpv4 = net.family === 'IPv4' || net.family === 4;
      if (!isIpv4 || net.internal) continue;

      const mac = (net.mac || '').toLowerCase();
      if (VBOX_MAC_PREFIXES.some((prefix) => mac.startsWith(prefix))) continue;

      if (isExcludedIpv4(net.address)) continue;

      candidates.push({ ip: net.address, name });
    }
  }

  candidates.sort((c1, c2) => {
    const p1 = getIpPriority(c1.ip);
    const p2 = getIpPriority(c2.ip);
    if (p1 !== p2) return p1 - p2;
    return c1.name.localeCompare(c2.name);
  });

  return candidates;
}

let ipDeterminedInEval = false;

function determineLanIp() {
  ipDeterminedInEval = true;
  console.log('[start-demo] Paso 2: Determinando dirección IP local (LAN_IP)...');

  const candidates = collectNetworkCandidates();
  const overrideIp = process.env.LAN_IP && process.env.LAN_IP.trim();

  let selectedIp;
  let selectedName = null;

  if (overrideIp) {
    selectedIp = overrideIp;
    console.log(`[start-demo] LAN_IP configurada por variable de entorno: ${selectedIp}`);
    if (candidates.length > 0) {
      console.log('[start-demo] Candidatas detectadas:');
      for (const c of candidates) {
        const isSelected = c.ip === selectedIp;
        console.log(`  ${isSelected ? '[x]' : '[ ]'} ${c.name}: ${c.ip}${isSelected ? ' (SELECCIONADA)' : ''}`);
      }
    }
  } else if (candidates.length > 0) {
    selectedIp = candidates[0].ip;
    selectedName = candidates[0].name;
    console.log('[start-demo] Candidatas detectadas:');
    for (const c of candidates) {
      const isSelected = c.ip === selectedIp;
      console.log(`  ${isSelected ? '[x]' : '[ ]'} ${c.name}: ${c.ip}${isSelected ? ' (SELECCIONADA)' : ''}`);
    }
    console.log(`[start-demo] LAN_IP seleccionada: ${selectedIp} (interfaz "${selectedName}")`);
  } else {
    selectedIp = '127.0.0.1';
    console.warn('[start-demo] ADVERTENCIA: No se detectaron interfaces de red local válidas.');
    console.warn('[start-demo] Usando fallback 127.0.0.1 (los dispositivos en la red local no podrán conectarse).');
  }

  console.log('[start-demo] Para usar otra interfaz: LAN_IP=<ip> pnpm demo (o en PowerShell: $env:LAN_IP="<ip>"; pnpm demo)');

  return {
    selectedIp,
    candidates,
    toString() {
      return this.selectedIp;
    },
    valueOf() {
      return this.selectedIp;
    },
  };
}

// ==========================================
// Paso 3: Iniciar contenedores backend
// ==========================================
function startBackendContainers(lanIp) {
  console.log('[start-demo] Paso 3: Levantando contenedores backend con Docker Compose...');
  const corsOrigins = `http://localhost:3000,http://localhost:3001,http://${lanIp}:3000,http://${lanIp}:3001`;
  const pwaBaseUrl = `http://${lanIp}:3001`;
  const minAdminPasswordLength = process.env.MIN_ADMIN_PASSWORD_LENGTH || '4';

  const env = {
    ...process.env,
    CORS_ORIGINS: corsOrigins,
    PWA_BASE_URL: pwaBaseUrl,
    MIN_ADMIN_PASSWORD_LENGTH: minAdminPasswordLength,
  };

  const composeArgs = ['compose', '--profile', 'services', 'up', '-d'];
  if (process.argv.includes('--build') || process.env.DEMO_BUILD === '1' || process.env.DEMO_BUILD === 'true') {
    composeArgs.push('--build');
  }

  console.log(`[start-demo] Ejecutando: docker ${composeArgs.join(' ')}`);
  console.log(`[start-demo] CORS_ORIGINS=${corsOrigins}`);
  console.log(`[start-demo] PWA_BASE_URL=${pwaBaseUrl}`);
  console.log(`[start-demo] MIN_ADMIN_PASSWORD_LENGTH=${minAdminPasswordLength}`);

  const res = spawnSync('docker', composeArgs, {
    cwd: ROOT_DIR,
    env,
    stdio: 'inherit',
    shell: true,
  });

  if (res.status !== 0) {
    console.error(`[start-demo] Error: Falló docker compose (código ${res.status}). Abortando.`);
    process.exit(1);
  }
  console.log('[start-demo] Contenedores backend iniciados.');
}

// ==========================================
// Paso 4: Esperar salud del gateway
// ==========================================
async function waitForGatewayHealth(gatewayUrl = 'http://localhost:4000/health', timeoutMs = 120000, intervalMs = 2000) {
  console.log(`[start-demo] Paso 4: Esperando disponibilidad del gateway en ${gatewayUrl}...`);
  const start = Date.now();
  let attempt = 1;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(gatewayUrl);
      if (res.status === 200) {
        console.log(`[start-demo] Gateway saludable (HTTP 200) tras ${((Date.now() - start) / 1000).toFixed(1)}s.`);
        return;
      }
    } catch {
      // Ignorar fallos de conexión durante el calentamiento
    }

    if (attempt % 5 === 0) {
      console.log(`[start-demo] Esperando respuesta del gateway (${((Date.now() - start) / 1000).toFixed(0)}s transcurridos)...`);
    }
    attempt++;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  console.error(`[start-demo] Error: El gateway no respondió HTTP 200 dentro de ${timeoutMs / 1000}s.`);
  process.exit(1);
}

// ==========================================
// Paso 5: Compilar paquetes compartidos
// ==========================================
function buildSharedPackages() {
  console.log('[start-demo] Paso 5: Compilando paquetes compartidos (@packages/*)...');
  const res = spawnSync('pnpm', ['--filter', '@packages/*', 'run', 'build'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: true,
  });

  if (res.status !== 0) {
    console.error(`[start-demo] Error: La compilación de @packages/* falló con código ${res.status}`);
    process.exit(1);
  }
  console.log('[start-demo] Paquetes compartidos compilados correctamente.');
}

// ==========================================
// Paso 6: Merge de .env.local para frontends
// ==========================================
function mergeEnvFile(filePath, newVars) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
  }

  const lines = content.split(/\r?\n/);
  const updatedKeys = new Set();
  const resultLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) {
      resultLines.push(line);
      continue;
    }
    const eqIdx = line.indexOf('=');
    const key = line.slice(0, eqIdx).trim();
    if (Object.prototype.hasOwnProperty.call(newVars, key)) {
      resultLines.push(`${key}=${newVars[key]}`);
      updatedKeys.add(key);
    } else {
      resultLines.push(line);
    }
  }

  for (const [key, value] of Object.entries(newVars)) {
    if (!updatedKeys.has(key)) {
      resultLines.push(`${key}=${value}`);
    }
  }

  const newContent = resultLines.join('\n').trim() + '\n';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log(`[start-demo] Actualizado ${path.relative(ROOT_DIR, filePath)}`);
}

function updateFrontendEnvFiles(lanIp) {
  console.log('[start-demo] Paso 6: Configurando variables de entorno en .env.local para frontends...');
  const gatewayUrl = `http://${lanIp}:4000`;
  const featureFlags = 'kitchen-display:true,payments:true';

  const adminEnvPath = path.join(ROOT_DIR, 'apps/admin-dashboard/.env.local');
  const pwaEnvPath = path.join(ROOT_DIR, 'apps/client-pwa/.env.local');

  mergeEnvFile(adminEnvPath, {
    NEXT_PUBLIC_GATEWAY_URL: gatewayUrl,
    NEXT_PUBLIC_FEATURE_FLAGS: featureFlags,
  });

  mergeEnvFile(pwaEnvPath, {
    NEXT_PUBLIC_GATEWAY_URL: gatewayUrl,
    NEXT_PUBLIC_FEATURE_FLAGS: featureFlags,
  });
}

// ==========================================
// Paso 7: Ejecutar seed de datos demo
// ==========================================
async function runSeedWithRetry(maxWaitMs = 30000) {
  console.log('[start-demo] Paso 7: Ejecutando seed de datos demo...');
  const startTime = Date.now();
  let attempt = 1;

  while (Date.now() - startTime < maxWaitMs) {
    console.log(`[start-demo] Invocando scripts/seed-demo.mjs (intento ${attempt})...`);
    const seedResult = spawnSync('node', [path.join(ROOT_DIR, 'scripts/seed-demo.mjs')], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: process.env,
    });

    if (seedResult.status === 0) {
      console.log('[start-demo] Seed completado con éxito.');
      return;
    }

    console.warn(`[start-demo] Seed devolvió código ${seedResult.status}. Reintentando en 3s...`);
    attempt++;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.error('[start-demo] Error: El seed de datos demo falló tras múltiples intentos.');
  process.exit(1);
}

// ==========================================
// Paso 8: Levantar dev servers
// ==========================================
function pipeWithPrefix(readable, prefix, isError = false) {
  let remainder = '';
  readable.on('data', (chunk) => {
    remainder += chunk.toString();
    const lines = remainder.split(/\r?\n/);
    remainder = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) {
        if (isError) {
          console.error(`${prefix} ${line}`);
        } else {
          console.log(`${prefix} ${line}`);
        }
      }
    }
  });

  readable.on('end', () => {
    if (remainder.trim()) {
      if (isError) {
        console.error(`${prefix} ${remainder}`);
      } else {
        console.log(`${prefix} ${remainder}`);
      }
    }
  });
}

function killProcessTree(childProcess) {
  if (!childProcess || !childProcess.pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-childProcess.pid, 'SIGTERM');
    }
  } catch {
    // Si ya fue terminado, ignorar
  }
}

// ==========================================
// Paso 9: Banner de estado
// ==========================================
function printBanner(lanIp, candidates = []) {
  ipDeterminedInEval = true;
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'admin';
  console.log('\n============================================================');
  console.log('       RESTAURANTE OS — ENTORNO DEMO LISTO');
  console.log('============================================================');
  console.log('  Panel Administrador:');
  console.log(`    -> Red local:  http://${lanIp}:3000`);
  console.log(`    -> Localhost:  http://localhost:3000`);
  console.log('\n  PWA Clientes:');
  console.log(`    -> Red local:  http://${lanIp}:3001`);
  console.log(`    -> Localhost:  http://localhost:3001`);
  console.log('\n  Credenciales de acceso:');
  console.log('    -> Usuario:      admin');
  console.log(`    -> Contraseña:   ${adminPassword}`);
  if (candidates && candidates.length > 1) {
    console.log('\n  Interfaces de red candidatas:');
    for (const c of candidates) {
      const activeMarker = c.ip === lanIp ? ' (ACTIVA)' : '';
      console.log(`    -> ${c.name}: ${c.ip}${activeMarker}`);
    }
    console.log('    Nota: Para usar otra interfaz: LAN_IP=<ip> pnpm demo');
    console.log('          (en PowerShell: $env:LAN_IP="<ip>"; pnpm demo)');
  }
  console.log('\n  Instrucciones:');
  console.log('    -> Para detener la demo:   Presiona Ctrl+C en esta terminal');
  console.log('                               docker compose --profile services down');
  console.log('    -> Para reiniciar datos:   docker compose --profile services down -v');
  console.log('============================================================\n');
}

// ==========================================
// Orquestación principal
// ==========================================
async function main() {
  checkPrerequisites();
  const { selectedIp: lanIp, candidates } = determineLanIp();
  startBackendContainers(lanIp);
  await waitForGatewayHealth();
  buildSharedPackages();
  updateFrontendEnvFiles(lanIp);
  await runSeedWithRetry();

  console.log('[start-demo] Paso 8: Iniciando servidores de desarrollo...');

  const devEnv = {
    ...process.env,
    NEXT_PUBLIC_GATEWAY_URL: `http://${lanIp}:4000`,
    NEXT_PUBLIC_FEATURE_FLAGS: 'kitchen-display:true,payments:true',
  };

  const adminProcess = spawn('pnpm', ['--filter', '@apps/admin-dashboard', 'dev'], {
    cwd: ROOT_DIR,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    env: devEnv,
  });

  const pwaProcess = spawn('pnpm', ['--filter', '@apps/client-pwa', 'dev'], {
    cwd: ROOT_DIR,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    env: devEnv,
  });

  pipeWithPrefix(adminProcess.stdout, '[admin]');
  pipeWithPrefix(adminProcess.stderr, '[admin]', true);

  pipeWithPrefix(pwaProcess.stdout, '[pwa]');
  pipeWithPrefix(pwaProcess.stderr, '[pwa]', true);

  let cleaningUp = false;
  const shutdown = () => {
    if (cleaningUp) return;
    cleaningUp = true;
    console.log('\n[start-demo] Deteniendo servidores de desarrollo frontend...');
    killProcessTree(adminProcess);
    killProcessTree(pwaProcess);
    console.log('[start-demo] Servidores de desarrollo detenidos.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  adminProcess.on('exit', (code) => {
    if (!cleaningUp && code !== 0 && code !== null) {
      console.error(`[admin] Proceso terminó inesperadamente con código ${code}`);
    }
  });

  pwaProcess.on('exit', (code) => {
    if (!cleaningUp && code !== 0 && code !== null) {
      console.error(`[pwa] Proceso terminó inesperadamente con código ${code}`);
    }
  });

  // Imprimir banner final (Paso 9)
  printBanner(lanIp, candidates);
}

export {
  determineLanIp,
  collectNetworkCandidates,
  printBanner,
  checkPrerequisites,
  startBackendContainers,
};

const isDirectCli = Boolean(
  process.argv[1] &&
    (path.resolve(process.argv[1]) === path.resolve(__filename) ||
      process.argv[1].endsWith('start-demo.mjs'))
);

if (isDirectCli) {
  if (process.argv.includes('--determine-ip') || process.argv.includes('--test-ip')) {
    determineLanIp();
    process.exit(0);
  }
  main().catch((err) => {
    console.error('[start-demo] Error fatal:', err);
    process.exit(1);
  });
} else if (!process.argv[1] || process.argv[1] === '[eval]') {
  setTimeout(() => {
    if (!ipDeterminedInEval) {
      determineLanIp();
    }
  }, 10);
}
