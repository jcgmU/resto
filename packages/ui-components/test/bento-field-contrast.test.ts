import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');
const adminSrc = path.join(repoRoot, 'apps/admin-dashboard/src');

function targetFiles(): string[] {
  const mesasDir = path.join(adminSrc, 'components/mesas');
  const mesas = fs
    .readdirSync(mesasDir)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => path.join(mesasDir, f));
  return [path.join(adminSrc, 'app/(panel)/ajustes/page.tsx'), ...mesas];
}

function elementBlock(lines: string[], start: number): string {
  const chunk = lines.slice(start, start + 30).join('\n');
  const end = chunk.search(/\n\s*(\/>|<\/select>|<\/textarea>)/);
  return end === -1 ? chunk : chunk.slice(0, end);
}

function namedStyleBody(source: string, name: string): string {
  const match = source.match(new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};`));
  return match ? match[1] : '';
}

describe('Contraste de campos de formulario (Ronda 5)', () => {
  test('input, select y textarea usan --bento-field-bg y --bento-field-border', () => {
    const violations: string[] = [];

    for (const file of targetFiles()) {
      const source = fs.readFileSync(file, 'utf8');
      const lines = source.split('\n');
      const rel = path.relative(repoRoot, file);

      lines.forEach((line, i) => {
        if (!/<(input|select|textarea)\b/.test(line)) return;
        const block = elementBlock(lines, i);
        if (/type="(checkbox|radio)"/.test(block)) return;

        const named = block.match(/style=\{\s*(?:\{\s*\.\.\.)?(\w+)\s*[,}]/);
        const styleText = named ? `${block}\n${namedStyleBody(source, named[1])}` : block;

        const ok =
          styleText.includes('var(--bento-field-bg)') &&
          styleText.includes('var(--bento-field-border)');
        if (!ok) violations.push(`${rel}:${i + 1}`);
      });
    }

    expect(violations).toEqual([]);
  });

  test('los tokens de campo están definidos en bento.css y BENTO_TOKENS', () => {
    const css = fs.readFileSync(path.join(__dirname, '../src/bento/bento.css'), 'utf8');
    const tokens = fs.readFileSync(path.join(__dirname, '../src/bento/tokens.ts'), 'utf8');
    for (const t of ['--bento-field-bg', '--bento-field-border']) {
      expect(css).toContain(`${t}:`);
      expect(tokens).toContain(`'${t}'`);
    }
  });
});
