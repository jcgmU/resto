import fs from 'fs';
import path from 'path';
import { BENTO_TOKENS } from '../src/bento/tokens';

// Tokens heredados de `wip` no definidos en `bento.css` ni en `BENTO_TOKENS` que solo
// pasan porque llevan valor de respaldo `var(--bento-X, fallback)` (todos en `apps/client-pwa/src`):
//   - `--bento-card-border`, `--bento-destructive-subtle`, `--bento-accent-subtle`, `--bento-font-size-base`
// Las excepciones sin respaldo deben quedar vacías.
export const WIP_LEGACY_UNDEFINED_EXCEPTIONS = new Set<string>([
]);

function getDefinedBentoTokens(bentoCssPath: string): Set<string> {
  const cssContent = fs.readFileSync(bentoCssPath, 'utf8');
  const rootMatch = cssContent.match(/:root\s*\{([\s\S]*?)\}/);
  const rootBlock = rootMatch ? rootMatch[1] : cssContent;

  const defined = new Set<string>(Object.keys(BENTO_TOKENS));
  const tokenDefRegex = /(--bento-[a-z0-9-]+)\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = tokenDefRegex.exec(rootBlock)) !== null) {
    defined.add(match[1]);
  }
  return defined;
}

function collectSourceFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Bento Defined Tokens Guard (Ronda 3 - U1)', () => {
  test('Ningún archivo en apps/*/src usa var(--bento-X) sin valor de respaldo si --bento-X no está definido en bento.css o BENTO_TOKENS', () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    const bentoCssPath = path.resolve(__dirname, '../src/bento/bento.css');
    const appsDir = path.resolve(repoRoot, 'apps');

    const definedTokens = getDefinedBentoTokens(bentoCssPath);
    expect(definedTokens.size).toBeGreaterThan(0);

    const appEntries = fs.readdirSync(appsDir, { withFileTypes: true });
    const files: string[] = [];
    for (const appEntry of appEntries) {
      if (!appEntry.isDirectory()) continue;
      const srcDir = path.join(appsDir, appEntry.name, 'src');
      files.push(...collectSourceFiles(srcDir, ['.ts', '.tsx', '.css']));
    }

    const violations: string[] = [];
    // Detecta cada inicio de var(--bento-X...) y verifica si incluye fallback tras coma
    const varStartRegex = /var\(\s*(--bento-[a-z0-9-]+)\s*([,)])/g;

    for (const file of files) {
      const relPath = path.relative(repoRoot, file).replace(/\\/g, '/');
      const lines = fs.readFileSync(file, 'utf8').split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          continue;
        }

        const lineRegex = new RegExp(varStartRegex.source, 'g');
        let match: RegExpExecArray | null;
        while ((match = lineRegex.exec(line)) !== null) {
          const tokenName = match[1];
          const delimiter = match[2];
          let hasFallback = false;

          if (delimiter === ',') {
            // Extraer contenido del fallback respetando paréntesis balanceados (ej. rgba(...))
            let depth = 1;
            let cursor = match.index + match[0].length;
            let fallbackContent = '';
            while (cursor < line.length && depth > 0) {
              const ch = line[cursor];
              if (ch === '(') depth++;
              else if (ch === ')') depth--;
              if (depth > 0) fallbackContent += ch;
              cursor++;
            }
            hasFallback = fallbackContent.trim().length > 0;
          }

          if (
            !definedTokens.has(tokenName) &&
            !hasFallback &&
            !WIP_LEGACY_UNDEFINED_EXCEPTIONS.has(tokenName)
          ) {
            violations.push(`${relPath}:${i + 1} -> ${tokenName}`);
          }
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Se encontraron ${violations.length} usos de tokens --bento-* no definidos y sin valor de respaldo:\n` +
          violations.map((v) => `  ${v}`).join('\n')
      );
    }

    expect(violations).toEqual([]);
  });
});
