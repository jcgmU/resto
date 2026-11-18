import {
  Point,
  Polygon,
  EPS_M,
  centroid,
  bbox,
  polyArea,
  inPoly,
  segDist,
  onBoundary,
  insideOrOn,
  strictlyInside,
  orient,
  segsCross,
  polysCross,
  selfIntersects,
  satOverlap,
  containedIn,
} from '../../src/floorplan/geometry';

describe('floorplan geometry utilities (in meters)', () => {
  describe('constants', () => {
    it('defines EPS_M as 0.008 (8 mm tolerance)', () => {
      expect(EPS_M).toBe(0.008);
    });
  });

  describe('centroid', () => {
    it('calculates arithmetic mean of vertices in meters', () => {
      const rect: Polygon = [
        [1, 2],
        [5, 2],
        [5, 5],
        [1, 5],
      ];
      expect(centroid(rect)).toEqual([3, 3.5]);

      const triangle: Polygon = [
        [0, 0],
        [3, 0],
        [0, 6],
      ];
      expect(centroid(triangle)).toEqual([1, 2]);
    });

    it('returns [0, 0] for an empty polygon', () => {
      expect(centroid([])).toEqual([0, 0]);
    });
  });

  describe('bbox', () => {
    it('computes bounding box with coordinates and dimensions in meters', () => {
      const poly: Polygon = [
        [1, 2],
        [5, 2],
        [5, 5],
        [1, 5],
      ];
      expect(bbox(poly)).toEqual({
        x0: 1,
        y0: 2,
        x1: 5,
        y1: 5,
        w: 4,
        h: 3,
      });
    });

    it('handles empty polygon gracefully', () => {
      expect(bbox([])).toEqual({
        x0: 0,
        y0: 0,
        x1: 0,
        y1: 0,
        w: 0,
        h: 0,
      });
    });
  });

  describe('polyArea', () => {
    it('calculates polygon area in m² using shoelace formula', () => {
      const rect: Polygon = [
        [1, 2],
        [5, 2],
        [5, 5],
        [1, 5],
      ];
      expect(polyArea(rect)).toBeCloseTo(12, 6);

      const triangle: Polygon = [
        [0, 0],
        [4, 0],
        [0, 3],
      ];
      expect(polyArea(triangle)).toBeCloseTo(6, 6);
    });
  });

  describe('segDist', () => {
    const a: Point = [0, 0];
    const b: Point = [4, 0];

    it('measures distance to points projecting strictly inside segment', () => {
      expect(segDist(2, 3, a, b)).toBeCloseTo(3, 6);
      expect(segDist(2, 0, a, b)).toBeCloseTo(0, 6);
    });

    it('measures distance to endpoints when projection falls outside', () => {
      expect(segDist(-3, 4, a, b)).toBeCloseTo(5, 6); // dist to a(0,0) is hypot(-3, 4) = 5
      expect(segDist(7, 4, a, b)).toBeCloseTo(5, 6);  // dist to b(4,0) is hypot(3, 4) = 5
    });

    it('handles degenerate zero-length segments', () => {
      expect(segDist(3, 4, a, a)).toBeCloseTo(5, 6);
    });
  });

  describe('boundary and inclusion checks', () => {
    const space: Polygon = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];

    it('identifies points on boundary and vertices (within EPS_M)', () => {
      // Exactly on edge
      expect(onBoundary(0, 5, space)).toBe(true);
      expect(insideOrOn(0, 5, space)).toBe(true);
      expect(strictlyInside([0, 5], space)).toBe(false);

      // Exactly on vertex
      expect(onBoundary(0, 0, space)).toBe(true);
      expect(insideOrOn(0, 0, space)).toBe(true);
      expect(strictlyInside([0, 0], space)).toBe(false);

      // Near edge within tolerance (0.005 m <= 0.008 m)
      expect(onBoundary(-0.005, 5, space)).toBe(true);
      expect(insideOrOn(-0.005, 5, space)).toBe(true);

      // Outside edge beyond tolerance (0.01 m > 0.008 m)
      expect(onBoundary(-0.01, 5, space)).toBe(false);
      expect(insideOrOn(-0.01, 5, space)).toBe(false);
    });

    it('identifies points strictly inside', () => {
      expect(inPoly(5, 5, space)).toBe(true);
      expect(onBoundary(5, 5, space)).toBe(false);
      expect(insideOrOn(5, 5, space)).toBe(true);
      expect(strictlyInside([5, 5], space)).toBe(true);
    });

    it('identifies points clearly outside', () => {
      expect(inPoly(15, 5, space)).toBe(false);
      expect(onBoundary(15, 5, space)).toBe(false);
      expect(insideOrOn(15, 5, space)).toBe(false);
      expect(strictlyInside([15, 5], space)).toBe(false);
    });
  });

  describe('orientation and segment crossing', () => {
    it('computes orientation determinant', () => {
      const p: Point = [0, 0];
      const q: Point = [2, 0];
      const ccw: Point = [1, 1];
      const cw: Point = [1, -1];
      const col: Point = [4, 0];

      expect(orient(p, q, ccw)).toBeGreaterThan(0);
      expect(orient(p, q, cw)).toBeLessThan(0);
      expect(orient(p, q, col)).toBe(0);
    });

    it('detects proper segment intersections', () => {
      const a: Point = [0, 0];
      const b: Point = [4, 4];
      const c: Point = [0, 4];
      const d: Point = [4, 0];
      expect(segsCross(a, b, c, d)).toBe(true);

      // Parallel segments do not cross
      const cParallel: Point = [0, 1];
      const dParallel: Point = [4, 5];
      expect(segsCross(a, b, cParallel, dParallel)).toBe(false);

      // Collinear touching or overlapping does not strictly cross
      const colA: Point = [0, 0];
      const colB: Point = [2, 0];
      const colC: Point = [2, 0];
      const colD: Point = [4, 0];
      expect(segsCross(colA, colB, colC, colD)).toBe(false);
    });
  });

  describe('selfIntersects', () => {
    it('detects bowtie / self-intersecting polygon', () => {
      const bowtie: Polygon = [
        [0, 0],
        [2, 2],
        [2, 0],
        [0, 2],
      ];
      expect(selfIntersects(bowtie)).toBe(true);
    });

    it('returns false for simple non-intersecting polygons', () => {
      const rect: Polygon = [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ];
      expect(selfIntersects(rect)).toBe(false);

      const lShape: Polygon = [
        [0, 0],
        [10, 0],
        [10, 2],
        [2, 2],
        [2, 10],
        [0, 10],
      ];
      expect(selfIntersects(lShape)).toBe(false);
    });
  });

  describe('satOverlap', () => {
    const rectA: Polygon = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];

    it('returns false when two rectangles share an edge', () => {
      const rectTouching: Polygon = [
        [1, 0],
        [2, 0],
        [2, 1],
        [1, 1],
      ];
      expect(satOverlap(rectA, rectTouching)).toBe(false);
    });

    it('returns false when rectangles are separated by less than EPS_M (0.005 m)', () => {
      const rectClose: Polygon = [
        [1.005, 0],
        [2.005, 0],
        [2.005, 1],
        [1.005, 1],
      ];
      expect(satOverlap(rectA, rectClose)).toBe(false);
    });

    it('returns true when two rectangles overlap by 1 cm (0.01 m)', () => {
      const rectOverlap1cm: Polygon = [
        [0.99, 0],
        [1.99, 0],
        [1.99, 1],
        [0.99, 1],
      ];
      expect(satOverlap(rectA, rectOverlap1cm)).toBe(true);
    });

    it('returns true for deeply overlapping polygons', () => {
      const rectOverlapDeep: Polygon = [
        [0.5, 0.5],
        [1.5, 0.5],
        [1.5, 1.5],
        [0.5, 1.5],
      ];
      expect(satOverlap(rectA, rectOverlapDeep)).toBe(true);
    });
  });

  describe('containedIn', () => {
    it('returns true when a polygon is strictly inside the space', () => {
      const space: Polygon = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];
      const inner: Polygon = [
        [1, 1],
        [3, 1],
        [3, 3],
        [1, 3],
      ];
      expect(containedIn(inner, space)).toBe(true);
    });

    it('returns true when a polygon touches the space boundary', () => {
      const space: Polygon = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];
      const touching: Polygon = [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ];
      expect(containedIn(touching, space)).toBe(true);
    });

    it('returns false for an L-shaped space when a polygon crosses the concave notch despite all 4 vertices being inside', () => {
      // L-shape with bottom arm [0, 10] x [0, 2] and left arm [0, 2] x [0, 10]
      const lShape: Polygon = [
        [0, 0],
        [10, 0],
        [10, 2],
        [2, 2],
        [2, 10],
        [0, 10],
      ];

      // A polygon spanning across the notch:
      // Vertices [8, 0.5] and [8, 1.5] are inside bottom arm.
      // Vertices [1.5, 8] and [0.5, 8] are inside left arm.
      // Edges cross the notch boundary!
      const crossNotchPoly: Polygon = [
        [8, 0.5],
        [8, 1.5],
        [1.5, 8],
        [0.5, 8],
      ];

      expect(crossNotchPoly.every((p: Point) => insideOrOn(p[0], p[1], lShape))).toBe(true);
      expect(polysCross(crossNotchPoly, lShape)).toBe(true);
      expect(containedIn(crossNotchPoly, lShape)).toBe(false);

      // A polygon fully inside one arm of the L-shape is contained
      const validInsideBottomArm: Polygon = [
        [4, 0.5],
        [6, 0.5],
        [6, 1.5],
        [4, 1.5],
      ];
      expect(containedIn(validInsideBottomArm, lShape)).toBe(true);
    });

    it('returns false when a polygon encloses strictly a reflex vertex of a concave space without crossing edges', () => {
      // Space with a reflex/concave vertex at [5, 5]
      const concaveSpace: Polygon = [
        [0, 0],
        [10, 0],
        [10, 10],
        [5, 5],
        [0, 10],
      ];

      // Triangle whose vertices are on the boundary or inside the space:
      // [4, 6] is on boundary [0, 10] -> [5, 5]
      // [6, 6] is on boundary [5, 5] -> [10, 10]
      // [5, 4] is strictly inside the space
      const polyEnclosingReflex: Polygon = [
        [4, 6],
        [6, 6],
        [5, 4],
      ];

      // 1. All vertices are inside or on boundary
      expect(polyEnclosingReflex.every((p: Point) => insideOrOn(p[0], p[1], concaveSpace))).toBe(true);

      // 2. Edges do not properly cross because crossings occur at vertices (orient = 0)
      expect(polysCross(polyEnclosingReflex, concaveSpace)).toBe(false);

      // 3. The reflex vertex [5, 5] of the space is strictly inside the polygon
      expect(strictlyInside([5, 5], polyEnclosingReflex)).toBe(true);
      expect(concaveSpace.some((v: Point) => strictlyInside(v, polyEnclosingReflex))).toBe(true);

      // 4. Therefore, containedIn MUST return false
      expect(containedIn(polyEnclosingReflex, concaveSpace)).toBe(false);
    });
  });
});
