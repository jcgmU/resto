/**
 * Floorplan 2D polygon geometry utilities in meters.
 * Pure mathematical functions without canvas/SVG/PPM dependencies.
 */

export type Point = [number, number];

export type Polygon = Point[];

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}

/** Tolerance in meters: 8 mm (~0.5 px at 60 px/m). */
export const EPS_M = 0.008;

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/**
 * Arithmetic mean centroid of polygon vertices in meters.
 */
export function centroid(pts: Polygon): Point {
  const n = pts.length;
  if (n === 0) return [0, 0];
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += pts[i][0];
    sumY += pts[i][1];
  }
  return [sumX / n, sumY / n];
}

/**
 * Axis-aligned bounding box of polygon vertices in meters.
 */
export function bbox(pts: Polygon): BBox {
  if (pts.length === 0) {
    return { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 };
  }
  let x0 = pts[0][0];
  let x1 = pts[0][0];
  let y0 = pts[0][1];
  let y1 = pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const x = pts[i][0];
    const y = pts[i][1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/**
 * Area of polygon in m² using the shoelace formula.
 */
export function polyArea(pts: Polygon): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(a / 2);
}

/**
 * Point-in-polygon ray casting algorithm.
 */
export function inPoly(x: number, y: number, pts: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Distance from point (px, py) to line segment a-b in meters.
 */
export function segDist(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

/**
 * Returns true if point (x, y) lies on polygon boundary within tolerance eps.
 */
export function onBoundary(x: number, y: number, pts: Polygon, eps: number = EPS_M): boolean {
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if (segDist(x, y, pts[j], pts[i]) <= eps) return true;
  }
  return false;
}

/**
 * Returns true if point (x, y) is inside or on the boundary of polygon.
 */
export function insideOrOn(x: number, y: number, pts: Polygon, eps: number = EPS_M): boolean {
  return onBoundary(x, y, pts, eps) || inPoly(x, y, pts);
}

/**
 * Returns true if point v is strictly inside polygon and not on boundary within eps.
 */
export function strictlyInside(v: Point, pts: Polygon, eps: number = EPS_M): boolean {
  return inPoly(v[0], v[1], pts) && !onBoundary(v[0], v[1], pts, eps);
}

/**
 * 2D cross-product orientation determinant of (q - p) x (r - p).
 * > 0 for CCW, < 0 for CW, 0 for collinear.
 */
export function orient(p: Point, q: Point, r: Point): number {
  return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
}

/**
 * Strict / proper intersection between segment a-b and c-d.
 */
export function segsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/**
 * Returns true if any edge of polygon A properly crosses any edge of polygon B.
 */
export function polysCross(A: Polygon, B: Polygon): boolean {
  for (let i = 0, j = A.length - 1; i < A.length; j = i++) {
    for (let k = 0, l = B.length - 1; k < B.length; l = k++) {
      if (segsCross(A[j], A[i], B[l], B[k])) return true;
    }
  }
  return false;
}

/**
 * Returns true if polygon self-intersects on non-adjacent edges.
 */
export function selfIntersects(pts: Polygon): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * Separating Axis Theorem (SAT) polygon overlap detection with tolerance eps in meters.
 */
export function satOverlap(A: Polygon, B: Polygon, eps: number = EPS_M): boolean {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const b = P[(i + 1) % P.length];
      const nx = b[1] - a[1];
      const ny = a[0] - b[0];
      const proj = (Q: Polygon): [number, number] => {
        let mn = Infinity;
        let mx = -Infinity;
        for (const q of Q) {
          const v = q[0] * nx + q[1] * ny;
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        return [mn, mx];
      };
      const [a0, a1] = proj(A);
      const [b0, b1] = proj(B);
      const tol = eps * Math.hypot(nx, ny);
      if (a1 <= b0 + tol || b1 <= a0 + tol) return false;
    }
  }
  return true;
}

/**
 * Tests if poly is completely contained inside spacePts:
 * 1. Every vertex of poly is inside or on boundary of spacePts.
 * 2. No edges of poly cross edges of spacePts.
 * 3. No reflex vertices of spacePts are strictly inside poly.
 */
export function containedIn(poly: Polygon, spacePts: Polygon, eps: number = EPS_M): boolean {
  return (
    poly.every((p) => insideOrOn(p[0], p[1], spacePts, eps)) &&
    !polysCross(poly, spacePts) &&
    !spacePts.some((v) => strictlyInside(v, poly, eps))
  );
}
