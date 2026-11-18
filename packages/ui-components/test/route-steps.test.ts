import { buildOrderRoute, formatRouteDuration } from '../src/kit/routeSteps';

const ev = (fromStatus: string, toStatus: string, occurredAt: string, id = `${fromStatus}-${toStatus}-${occurredAt}`) => ({ id, fromStatus, toStatus, occurredAt });
const states = (steps: { state: string }[]) => steps.map((s) => s.state);

describe('buildOrderRoute', () => {
  test('sin eventos: pasos previos hechos, actual marcado y el resto pendiente', () => {
    const route = buildOrderRoute('IN_KITCHEN');
    expect(route.map((s) => s.status)).toEqual(['PLACED', 'IN_KITCHEN', 'READY', 'DELIVERED']);
    expect(route.map((s) => s.label)).toEqual(['Recibido', 'En cocina', 'Listo', 'Entregado']);
    expect(states(route)).toEqual(['done', 'current', 'pending', 'pending']);
    expect(route.every((s) => s.at === undefined && s.durationMs === undefined)).toBe(true);
  });

  test.each([
    ['PLACED', ['current', 'pending', 'pending', 'pending']],
    ['READY', ['done', 'done', 'current', 'pending']],
    ['DELIVERED', ['done', 'done', 'done', 'current']],
  ])('estado %s', (status, expected) => {
    expect(states(buildOrderRoute(status as never))).toEqual(expected);
  });

  test('con eventos: hora de cada paso y duración desde el paso anterior', () => {
    const route = buildOrderRoute(
      'READY',
      [ev('PLACED', 'IN_KITCHEN', '2026-10-14T12:05:00Z'), ev('IN_KITCHEN', 'READY', '2026-10-14T12:20:00Z')],
      { createdAt: '2026-10-14T12:00:00Z' },
    );
    expect(route[0].at).toBe('2026-10-14T12:00:00Z');
    expect(route[0].durationMs).toBeUndefined();
    expect(route[1]).toMatchObject({ at: '2026-10-14T12:05:00Z', durationMs: 5 * 60000 });
    expect(route[2]).toMatchObject({ at: '2026-10-14T12:20:00Z', durationMs: 15 * 60000 });
    expect(route[3].at).toBeUndefined();
  });

  test('tolera eventos desordenados y repetidos: gana la primera ocurrencia por paso', () => {
    const route = buildOrderRoute('READY', [
      ev('IN_KITCHEN', 'READY', '2026-10-14T12:20:00Z'),
      ev('PLACED', 'IN_KITCHEN', '2026-10-14T12:05:00Z'),
      ev('PLACED', 'IN_KITCHEN', '2026-10-14T12:09:00Z', 'dup'),
    ]);
    expect(route[1].at).toBe('2026-10-14T12:05:00Z');
    expect(route[2]).toMatchObject({ at: '2026-10-14T12:20:00Z', durationMs: 15 * 60000 });
  });

  test('eventos faltantes: sin duración si falta la hora del paso anterior; nunca negativa', () => {
    const missing = buildOrderRoute('READY', [ev('IN_KITCHEN', 'READY', '2026-10-14T12:20:00Z')]);
    expect(missing[2].at).toBe('2026-10-14T12:20:00Z');
    expect(missing[2].durationMs).toBeUndefined();
    const skewed = buildOrderRoute('IN_KITCHEN', [ev('PLACED', 'IN_KITCHEN', '2026-10-14T11:55:00Z')], { createdAt: '2026-10-14T12:00:00Z' });
    expect(skewed[1].durationMs).toBe(0);
  });

  test('cancelado corta la ruta en el paso donde ocurrió', () => {
    const route = buildOrderRoute('CANCELLED', [
      ev('PLACED', 'IN_KITCHEN', '2026-10-14T12:05:00Z'),
      ev('IN_KITCHEN', 'CANCELLED', '2026-10-14T12:08:00Z'),
    ]);
    expect(states(route)).toEqual(['done', 'cancelled', 'pending', 'pending']);
    expect(route[1].at).toBe('2026-10-14T12:08:00Z');
  });

  test('cancelado sin eventos: corta en el último paso conocido (el primero)', () => {
    expect(states(buildOrderRoute('CANCELLED'))).toEqual(['cancelled', 'pending', 'pending', 'pending']);
  });
});

describe('formatRouteDuration', () => {
  test.each([
    [20 * 1000, '<1 min'],
    [5 * 60000, '+5 min'],
    [59 * 60000, '+59 min'],
    [60 * 60000, '+1 h'],
    [75 * 60000, '+1 h 15 min'],
    [626 * 60000, '+10 h 26 min'],
  ])('%d ms → %s', (ms, expected) => {
    expect(formatRouteDuration(ms)).toBe(expected);
  });
});
