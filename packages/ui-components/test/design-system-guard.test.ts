import fs from 'fs';
import path from 'path';

/**
 * Guardián del sistema de diseño: las pantallas no dibujan sus propios modales, cards con
 * estado ni puntos de estado; usan Modal, StatusCard y demás de @packages/ui-components.
 *
 * PENDING_MIGRATION lista, por archivo, las reglas que aún incumple. Cada oleada de
 * migración la vacía: una entrada sin infracciones reales también hace fallar el test.
 */
type Rule = 'dialog' | 'state-border' | 'status-dot';

const PENDING_MIGRATION: Record<string, Rule[]> = {};

const repoRoot = path.resolve(__dirname, '../../..');

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === '.next' ? [] : listSourceFiles(full);
    return /\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

function violationsOf(source: string): Set<Rule> {
  const found = new Set<Rule>();
  const lines = source.split('\n');

  lines.forEach((line, i) => {
    if (/role=["']dialog["']|aria-modal/.test(line)) found.add('dialog');

    if (/border(Left|Right|InlineStart)\s*:\s*[`'"][^`'"]*(var\(--bento-|\$\{)/.test(line)) found.add('state-border');
    if (/borderTop\s*:\s*`[^`]*\$\{/.test(line)) found.add('state-border');

    if (/width:\s*['"]?(6|8|10|12)(px)?['"]?\s*,/.test(line)) {
      const windowText = lines.slice(Math.max(0, i - 4), i + 5).join('\n');
      const round = /borderRadius:\s*['"](50%|9999px)['"]/.test(windowText) || /borderRadius:\s*['"]var\(--bento-pill-radius\)['"]/.test(windowText);
      const statusColor = /(background|backgroundColor):\s*([^,\n]*var\(--bento-(status-|success|destructive|warning)|\w*[dD]ot\w*)/.test(windowText);
      if (round && statusColor) found.add('status-dot');
    }

    if (/width:\s*['"]?(4|6)(px)?['"]?\s*,/.test(line)) {
      const windowText = lines.slice(Math.max(0, i - 4), i + 5).join('\n');
      const fullHeight = /height:\s*['"]100%['"]/.test(windowText) && /position:\s*['"]absolute['"]/.test(windowText);
      const statusColor = /(background|backgroundColor):\s*[^,\n]*var\(--bento-(status-|success|destructive|warning)/.test(windowText);
      if (fullHeight && statusColor) found.add('state-border');
    }
  });
  return found;
}

describe('Sistema de diseño: una sola fuente de componentes', () => {
  const appsDir = path.join(repoRoot, 'apps');
  const files = fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => listSourceFiles(path.join(appsDir, e.name, 'src')));

  const actual: Record<string, Rule[]> = {};
  for (const file of files) {
    const rules = violationsOf(fs.readFileSync(file, 'utf8'));
    if (rules.size > 0) actual[path.relative(repoRoot, file).replace(/\\/g, '/')] = Array.from(rules).sort();
  }

  test('ninguna pantalla nueva define su propio modal, card con estado o punto de estado', () => {
    const unexpected = Object.entries(actual)
      .map(([file, rules]) => {
        const allowed = PENDING_MIGRATION[file] ?? [];
        const extra = rules.filter((r) => !allowed.includes(r));
        return extra.length ? `${file}: ${extra.join(', ')}` : null;
      })
      .filter(Boolean);
    expect(unexpected).toEqual([]);
  });

  test('la lista de pendientes no conserva archivos ya migrados', () => {
    const stale = Object.entries(PENDING_MIGRATION)
      .map(([file, rules]) => {
        const now = actual[file] ?? [];
        const done = rules.filter((r) => !now.includes(r));
        return done.length ? `${file}: ${done.join(', ')}` : null;
      })
      .filter(Boolean);
    expect(stale).toEqual([]);
  });
});
