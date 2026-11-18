import {
  SEAT_M,
  MIN_TABLE_SIZE_M,
  TABLE_KINDS,
  ellPerim,
  localPoly,
  shapePoly,
  seatCap,
  type TableKind,
  type FloorTable,
} from '../../src/floorplan/shapes';

describe('floorplan/shapes', () => {
  const ALL_KINDS: TableKind[] = ['square', 'round', 'rect', 'oval', 'half', 'hex', 'bar'];

  describe('constants & TABLE_KINDS catalog', () => {
    it('exports SEAT_M and MIN_TABLE_SIZE_M in meters', () => {
      expect(SEAT_M).toBe(0.55);
      expect(MIN_TABLE_SIZE_M).toBe(0.4);
    });

    it('contains all 7 table kinds with exact demo dimensions, seats, and bar single=true', () => {
      expect(Object.keys(TABLE_KINDS).sort()).toEqual([...ALL_KINDS].sort());

      expect(TABLE_KINDS.square).toEqual({
        kind: 'square',
        name: 'Cuadrada',
        shape: 'rect',
        width: 0.8,
        depth: 0.8,
        seats: 2,
        maxSize: 3,
      });

      expect(TABLE_KINDS.round).toEqual({
        kind: 'round',
        name: 'Redonda',
        shape: 'round',
        width: 1.0,
        depth: 1.0,
        seats: 4,
        maxSize: 3,
      });

      expect(TABLE_KINDS.rect).toEqual({
        kind: 'rect',
        name: 'Rectangular',
        shape: 'rect',
        width: 1.6,
        depth: 0.8,
        seats: 4,
        maxSize: 6,
      });

      expect(TABLE_KINDS.oval).toEqual({
        kind: 'oval',
        name: 'Ovalada',
        shape: 'oval',
        width: 1.6,
        depth: 0.9,
        seats: 4,
        maxSize: 6,
      });

      expect(TABLE_KINDS.half).toEqual({
        kind: 'half',
        name: 'Semicircular',
        shape: 'half',
        width: 1.2,
        depth: 0.6,
        seats: 3,
        maxSize: 4,
      });

      expect(TABLE_KINDS.hex).toEqual({
        kind: 'hex',
        name: 'Hexagonal',
        shape: 'hex',
        width: 1.2,
        depth: 1.0,
        seats: 4,
        maxSize: 3,
      });

      expect(TABLE_KINDS.bar).toEqual({
        kind: 'bar',
        name: 'Barra',
        shape: 'rect',
        width: 4.0,
        depth: 0.6,
        seats: 6,
        maxSize: 10,
        single: true,
      });
    });

    it('does not have alias properties w, h, or max on any entry of TABLE_KINDS', () => {
      for (const kind of ALL_KINDS) {
        const spec = TABLE_KINDS[kind];
        expect('w' in spec).toBe(false);
        expect('h' in spec).toBe(false);
        expect('max' in spec).toBe(false);
      }
    });
  });

  describe('ellPerim', () => {
    it('computes Ramanujan ellipse perimeter approximation accurately', () => {
      // Circle of radius r=0.5 has perimeter 2*pi*0.5 = pi
      expect(ellPerim(0.5, 0.5)).toBeCloseTo(Math.PI, 10);
    });
  });

  describe('localPoly & shapePoly bounding boxes', () => {
    it.each(ALL_KINDS)(
      'fits %s inside [-width/2, width/2] x [-depth/2, depth/2] and reaches width x depth',
      (kind) => {
        const spec = TABLE_KINDS[kind];
        const poly = localPoly({ kind, width: spec.width, depth: spec.depth });
        const worldPoly = shapePoly({
          kind,
          x: 0,
          y: 0,
          width: spec.width,
          depth: spec.depth,
          rotation: 0,
        });

        expect(poly.length).toBeGreaterThanOrEqual(4);
        expect(worldPoly).toEqual(poly);

        const xs = poly.map(([x]) => x);
        const ys = poly.map(([, y]) => y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const eps = 1e-9;
        expect(minX).toBeGreaterThanOrEqual(-spec.width / 2 - eps);
        expect(maxX).toBeLessThanOrEqual(spec.width / 2 + eps);
        expect(minY).toBeGreaterThanOrEqual(-spec.depth / 2 - eps);
        expect(maxY).toBeLessThanOrEqual(spec.depth / 2 + eps);

        // Bounding box reaches width and depth (28 vertices on round/oval reach exact extrema at i=0,7,14,21)
        expect(maxX - minX).toBeCloseTo(spec.width, 5);
        expect(maxY - minY).toBeCloseTo(spec.depth, 5);
      },
    );

    it('rotates 90 degrees in shapePoly, swapping bounding box width and depth and translating to (x, y)', () => {
      const table: Pick<FloorTable, 'kind' | 'x' | 'y' | 'width' | 'depth' | 'rotation'> = {
        kind: 'rect',
        x: 5.2,
        y: 3.4,
        width: 1.6,
        depth: 0.8,
        rotation: 90,
      };
      const poly = shapePoly(table);
      const xs = poly.map(([x]) => x);
      const ys = poly.map(([, y]) => y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      // Width and depth swapped after 90° rotation
      expect(maxX - minX).toBeCloseTo(table.depth, 6);
      expect(maxY - minY).toBeCloseTo(table.width, 6);

      // Centered at (x, y)
      expect((minX + maxX) / 2).toBeCloseTo(table.x, 6);
      expect((minY + maxY) / 2).toBeCloseTo(table.y, 6);
    });
  });

  describe('seatCap', () => {
    it.each<[TableKind, number]>([
      ['square', 2],
      ['round', 5],
      ['rect', 4],
      ['oval', 7],
      ['half', 3],
      ['hex', 6],
      ['bar', 7],
    ])('computes exact default seatCap for %s = %i', (kind, expectedCap) => {
      const spec = TABLE_KINDS[kind];
      expect(seatCap({ kind, width: spec.width, depth: spec.depth })).toBe(expectedCap);
    });

    it('returns at least 1 seat even for tiny tables', () => {
      expect(seatCap({ kind: 'square', width: 0.4, depth: 0.4 })).toBe(2);
      expect(seatCap({ kind: 'bar', width: 0.4, depth: 0.4 })).toBe(1);
      expect(seatCap({ kind: 'half', width: 0.4, depth: 0.4 })).toBeGreaterThanOrEqual(1);
      expect(seatCap({ kind: 'round', width: 0.4, depth: 0.4 })).toBeGreaterThanOrEqual(1);
    });
  });

  describe('safe handling of invalid inputs (U6 public functions do not throw)', () => {
    it('localPoly returns [] for invalid or non-finite inputs', () => {
      expect(localPoly(null as any)).toEqual([]);
      expect(localPoly({ kind: 'zzz' as any, width: 1, depth: 1 })).toEqual([]);
      expect(localPoly({ kind: 'square', width: NaN, depth: 1 })).toEqual([]);
      expect(localPoly({ kind: 'square', width: -1, depth: 1 })).toEqual([]);
      expect(localPoly({ kind: 'square', width: 0, depth: 1 })).toEqual([]);
    });

    it('shapePoly returns [] for invalid or non-finite inputs', () => {
      expect(shapePoly(null as any)).toEqual([]);
      expect(shapePoly({ kind: 'square', x: NaN, y: 1, width: 1, depth: 1, rotation: 0 })).toEqual([]);
      expect(shapePoly({ kind: 'square', x: 1, y: Infinity, width: 1, depth: 1, rotation: 0 })).toEqual([]);
      expect(shapePoly({ kind: 'square', x: 1, y: 1, width: 1, depth: 1, rotation: NaN })).toEqual([]);
    });

    it('seatCap returns 0 for invalid or non-finite inputs', () => {
      expect(seatCap(null as any)).toBe(0);
      expect(seatCap({ kind: 'zzz' as any, width: 1, depth: 1 })).toBe(0);
      expect(seatCap({ kind: 'square', width: NaN, depth: 1 })).toBe(0);
      expect(seatCap({ kind: 'square', width: -1, depth: 1 })).toBe(0);
      expect(seatCap({ kind: 'square', width: 0, depth: 1 })).toBe(0);
    });
  });
});
