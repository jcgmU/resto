#!/usr/bin/env node

/**
 * check-a4-tokens.mjs - Validador A4 de tokens de diseño Bento
 *
 * Requisitos Unidad U6:
 * - Parsea packages/ui-components/src/bento/tokens.ts para extraer tokens válidos (--bento-*) y paleta de colores (#hex).
 * - Escanea apps/admin-dashboard/src y apps/client-pwa/src (archivos .ts y .tsx).
 * - Detecta cualquier color hexadecimal (#xxx, #xxxxxx, #xxxxxxxx).
 * - Permite únicamente fallbacks en la forma `var(--token, #hex)` si:
 *     1. `--token` está definido en tokens.ts
 *     2. `#hex` pertenece a la paleta de tokens.ts
 * - Reporta cualquier hex huérfano o fallback inválido en formato `archivo:linea:valor` y termina con exit code 1.
 * - Si no hay violaciones, termina con exit code 0.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const TOKENS_PATH = path.resolve(ROOT_DIR, 'packages/ui-components/src/bento/tokens.ts');

function parseTokensAndPalette() {
  const content = fs.readFileSync(TOKENS_PATH, 'utf8');

  // Extraer bloque BENTO_TOKENS
  const tokenMatch = content.match(/export const BENTO_TOKENS: Record<string, string> = \{([\s\S]*?)\};/);
  if (!tokenMatch) {
    throw new Error('No se pudo encontrar BENTO_TOKENS en ' + TOKENS_PATH);
  }

  const tokenBlock = tokenMatch[1];
  const validTokens = new Set();
  const paletteHexes = new Set();

  const tokenLineRegex = /'(--bento-[a-z0-9-]+)'\s*:\s*([^,\n]+)/g;
  let match;
  while ((match = tokenLineRegex.exec(tokenBlock)) !== null) {
    const tokenName = match[1];
    const val = match[2];
    validTokens.add(tokenName);

    // Extraer hexes presentes en la definición de tokens
    const hexes = val.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (hexes) {
      for (const h of hexes) {
        paletteHexes.add(h.toLowerCase());
      }
    }
  }

  return { validTokens, paletteHexes };
}

function getFilesRecursively(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFilesRecursively(fullPath, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

export function checkA4Tokens() {
  const { validTokens, paletteHexes } = parseTokensAndPalette();
  const scanDirs = [
    path.resolve(ROOT_DIR, 'apps/admin-dashboard/src'),
    path.resolve(ROOT_DIR, 'apps/client-pwa/src'),
  ];

  const files = [];
  for (const dir of scanDirs) {
    files.push(...getFilesRecursively(dir, ['.ts', '.tsx']));
  }

  const violations = [];
  const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
  // Regex para capturar var(--token, #hex)
  const allowedFallbackRegex = /var\(\s*(--bento-[a-z0-9-]+)\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)/g;

  for (const file of files) {
    const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      // Ignorar comentarios de una línea
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      // Buscar todos los var(--token, #hex) permitidos en esta línea y reemplazarlos temporalmente
      let sanitizedLine = line;
      let varMatch;
      const lineVarRegex = new RegExp(allowedFallbackRegex.source, 'g');
      while ((varMatch = lineVarRegex.exec(line)) !== null) {
        const fullVar = varMatch[0];
        const tokenName = varMatch[1];
        const fallbackHex = varMatch[2].toLowerCase();

        if (validTokens.has(tokenName) && paletteHexes.has(fallbackHex)) {
          // Fallback válido: enmascarar para que no sea reportado como hex huérfano
          sanitizedLine = sanitizedLine.replace(fullVar, 'VAR_VALID_FALLBACK');
        } else {
          // Fallback inválido: token no existe o hex no está en la paleta
          violations.push({
            file: relativePath,
            line: lineNum,
            value: fullVar,
            reason: !validTokens.has(tokenName)
              ? `Token '${tokenName}' no existe en BENTO_TOKENS`
              : `Hex '${fallbackHex}' no pertenece a la paleta de tokens.ts`,
          });
        }
      }

      // Buscar hexes restantes en la línea enmascarada (estos son huérfanos o inválidos)
      let hexMatch;
      const lineHexRegex = new RegExp(hexRegex.source, 'g');
      while ((hexMatch = lineHexRegex.exec(sanitizedLine)) !== null) {
        violations.push({
          file: relativePath,
          line: lineNum,
          value: hexMatch[0],
          reason: 'Hex huérfano sin tokenización Bento',
        });
      }
    }
  }

  return {
    validTokensCount: validTokens.size,
    paletteHexesCount: paletteHexes.size,
    scannedFilesCount: files.length,
    violations,
  };
}

// Si se ejecuta directamente vía CLI
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    const result = checkA4Tokens();
    console.log(`[A4 Check] Escaneados ${result.scannedFilesCount} archivos con ${result.validTokensCount} tokens y ${result.paletteHexesCount} colores de paleta.`);

    if (result.violations.length > 0) {
      console.error(`\x1b[31m[A4 Check] ERROR: Se encontraron ${result.violations.length} violaciones de tokens/hex:\x1b[0m`);
      for (const v of result.violations) {
        console.error(`  ${v.file}:${v.line}:${v.value} -> ${v.reason}`);
      }
      process.exit(1);
    } else {
      console.log('\x1b[32m[A4 Check] PASS: Cero hex huérfanos. Todos los fallbacks cumplen la paleta Bento.\x1b[0m');
      process.exit(0);
    }
  } catch (err) {
    console.error('[A4 Check] Fallo en la ejecución:', err);
    process.exit(1);
  }
}
