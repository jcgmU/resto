import { routeTable } from '../src/routes/routeTable';

describe('Matriz de roles del gateway (5 roles)', () => {
  test('ninguna ruta lista el rol legado staff', () => {
    const withStaff = routeTable
      .filter((r) => (r.requiredRoles || []).map((x) => x.toLowerCase()).includes('staff'))
      .map((r) => `${r.method} ${r.path}`);
    expect(withStaff).toEqual([]);
  });

  test('monitor puede leer mesas (GET /v1/tables) pero no mutarlas', () => {
    const find = (method: string, path: string) => routeTable.find((r) => r.method === method && r.path === path);
    expect(find('GET', '/v1/tables')?.requiredRoles).toContain('monitor');
    for (const [m, p] of [['POST', '/v1/tables']] as const) {
      expect(find(m, p)?.requiredRoles).not.toContain('monitor');
    }
  });
});
