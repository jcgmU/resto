import { execSync } from 'child_process';
import path from 'path';

describe('A4 Design Tokens & Hex Purge (Unidad U6)', () => {
  test('A4.1 Validador de tokens y purga de hex huérfanos pasa con 0 violaciones en apps/*/src', () => {
    const scriptPath = path.resolve(__dirname, '../../../scripts/check-a4-tokens.mjs');
    
    let output = '';
    try {
      output = execSync(`node "${scriptPath}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      const stdout = err.stdout ? err.stdout.toString() : '';
      const stderr = err.stderr ? err.stderr.toString() : '';
      throw new Error(`scripts/check-a4-tokens.mjs falló (exit ${err.status}):\n${stdout}\n${stderr}`);
    }

    expect(output).toContain('[A4 Check] PASS');
  });
});
