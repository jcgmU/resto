import fs from 'fs';
import path from 'path';

function listTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'generated' ? [] : listTs(full);
    return e.name.endsWith('.ts') && !e.name.endsWith('.d.ts') ? [full] : [];
  });
}

describe('Rol legado STAFF fuera de la autorización', () => {
  test('el código fuente no autoriza ni etiqueta con el rol staff', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const offenders = listTs(srcDir).flatMap((file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => !line.trim().startsWith('//') && /['"](staff|STAFF)['"]/.test(line))
        .map(({ n }) => `${path.relative(srcDir, file)}:${n}`)
    );
    expect(offenders).toEqual([]);
  });
});
