export type TableKind = 'square' | 'round' | 'rect' | 'oval' | 'half' | 'hex' | 'bar';
export type TableShape = 'rect' | 'round' | 'oval' | 'half' | 'hex';

export interface TableKindSpec {
  kind: TableKind;
  name: string;
  shape: TableShape;
  width: number;
  depth: number;
  seats: number;
  maxSize: number;
  single?: boolean;
}

export interface FloorTable {
  id: string;
  label: string;
  kind: TableKind;
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
  seats: number;
}

/** Metros de borde de mesa por puesto (`SEAT_M` del demo). */
export const SEAT_M = 0.55;

/** Lado o diámetro mínimo de mesa en metros (`MIN_T` del demo). */
export const MIN_TABLE_SIZE_M = 0.4;

export const TABLE_KINDS: Readonly<Record<TableKind, TableKindSpec>> = {
  square: {
    kind: 'square',
    name: 'Cuadrada',
    shape: 'rect',
    width: 0.8,
    depth: 0.8,
    seats: 2,
    maxSize: 3,
  },
  round: {
    kind: 'round',
    name: 'Redonda',
    shape: 'round',
    width: 1.0,
    depth: 1.0,
    seats: 4,
    maxSize: 3,
  },
  rect: {
    kind: 'rect',
    name: 'Rectangular',
    shape: 'rect',
    width: 1.6,
    depth: 0.8,
    seats: 4,
    maxSize: 6,
  },
  oval: {
    kind: 'oval',
    name: 'Ovalada',
    shape: 'oval',
    width: 1.6,
    depth: 0.9,
    seats: 4,
    maxSize: 6,
  },
  half: {
    kind: 'half',
    name: 'Semicircular',
    shape: 'half',
    width: 1.2,
    depth: 0.6,
    seats: 3,
    maxSize: 4,
  },
  hex: {
    kind: 'hex',
    name: 'Hexagonal',
    shape: 'hex',
    width: 1.2,
    depth: 1.0,
    seats: 4,
    maxSize: 3,
  },
  bar: {
    kind: 'bar',
    name: 'Barra',
    shape: 'rect',
    width: 4.0,
    depth: 0.6,
    seats: 6,
    maxSize: 10,
    single: true,
  },
};

export function ellPerim(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

export function localPoly(
  table: Pick<FloorTable, 'kind' | 'width' | 'depth'>,
): [number, number][] {
  if (
    !table ||
    typeof table.kind !== 'string' ||
    !Object.prototype.hasOwnProperty.call(TABLE_KINDS, table.kind) ||
    typeof table.width !== 'number' ||
    typeof table.depth !== 'number' ||
    !Number.isFinite(table.width) ||
    !Number.isFinite(table.depth) ||
    table.width <= 0 ||
    table.depth <= 0
  ) {
    return [];
  }
  const w = table.width;
  const h = table.depth;
  const sh = TABLE_KINDS[table.kind].shape;
  const out: [number, number][] = [];

  if (sh === 'rect') {
    return [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ];
  }
  if (sh === 'hex') {
    return [
      [-w / 4, -h / 2],
      [w / 4, -h / 2],
      [w / 2, 0],
      [w / 4, h / 2],
      [-w / 4, h / 2],
      [-w / 2, 0],
    ];
  }
  if (sh === 'half') {
    for (let i = 0; i <= 14; i++) {
      const t = Math.PI + (Math.PI * i) / 14;
      out.push([Math.cos(t) * (w / 2), h / 2 + Math.sin(t) * h]);
    }
    return out;
  }
  for (let i = 0; i < 28; i++) {
    const t = (2 * Math.PI * i) / 28;
    out.push([Math.cos(t) * (w / 2), Math.sin(t) * (h / 2)]);
  }
  return out;
}

export function shapePoly(
  table: Pick<FloorTable, 'kind' | 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
): [number, number][] {
  if (
    !table ||
    typeof table.x !== 'number' ||
    typeof table.y !== 'number' ||
    typeof table.rotation !== 'number' ||
    !Number.isFinite(table.x) ||
    !Number.isFinite(table.y) ||
    !Number.isFinite(table.rotation)
  ) {
    return [];
  }
  const local = localPoly(table);
  if (local.length === 0) {
    return [];
  }
  const a = (table.rotation * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return local.map(([x, y]) => [
    table.x + x * c - y * s,
    table.y + x * s + y * c,
  ]);
}

export function seatCap(
  table: Pick<FloorTable, 'kind' | 'width' | 'depth'>,
): number {
  if (
    !table ||
    typeof table.kind !== 'string' ||
    !Object.prototype.hasOwnProperty.call(TABLE_KINDS, table.kind) ||
    typeof table.width !== 'number' ||
    typeof table.depth !== 'number' ||
    !Number.isFinite(table.width) ||
    !Number.isFinite(table.depth) ||
    table.width <= 0 ||
    table.depth <= 0
  ) {
    return 0;
  }
  const t = TABLE_KINDS[table.kind];
  const w = table.width;
  const h = table.depth;
  if (t.shape === 'rect') {
    const row = Math.max(1, Math.floor(w / SEAT_M));
    return t.single ? row : row * 2;
  }
  if (t.shape === 'half') {
    return Math.max(1, Math.floor(ellPerim(w / 2, h) / 2 / SEAT_M));
  }
  return Math.max(1, Math.floor(ellPerim(w / 2, h / 2) / SEAT_M));
}
