import {
  Point,
  Polygon,
  BBox,
  EPS_M,
  bbox,
  polyArea,
  inPoly,
  polysCross,
  selfIntersects,
  strictlyInside,
  satOverlap,
  containedIn,
} from './geometry';
import {
  FloorTable,
  TableKind,
  shapePoly,
  TABLE_KINDS,
  MIN_TABLE_SIZE_M,
  seatCap,
} from './shapes';

export interface FloorSpace {
  id: string;
  name: string;
  polygon: Polygon;
  color?: string;
}

export interface FloorLimits {
  width: number;
  height: number;
  minAreaM2: number;
  minSideM: number;
  gridStepM: number;
}

/** Valores por defecto del demo en metros: W=1000/60 (~16.67m), H=640/60 (~10.67m), área mín 2 m², lado mín 1.5 m, paso 0.1 m (6/60). */
export const DEFAULT_FLOOR_LIMITS: Readonly<FloorLimits> = {
  width: 1000 / 60,
  height: 640 / 60,
  minAreaM2: 2,
  minSideM: 1.5,
  gridStepM: 0.1,
};

export type FloorRuleErrorCode =
  | 'TABLE_INVALID_INPUT'
  | 'TABLE_SIZE_OUT_OF_RANGE'
  | 'TABLE_SEATS_OUT_OF_RANGE'
  | 'TABLE_OUTSIDE_ANY_SPACE'
  | 'TABLE_EXCEEDS_SPACE'
  | 'TABLE_TOO_BIG_FOR_SPACE'
  | 'TABLE_OVERLAP'
  | 'SPACE_OUT_OF_BOUNDS'
  | 'SPACE_TOO_SMALL'
  | 'SPACE_SIDE_TOO_SHORT'
  | 'SPACE_SELF_INTERSECTS'
  | 'SPACE_OVERLAP'
  | 'SPACE_INVALID_POLYGON'
  | 'SPACE_CONTENT_OUTSIDE';

export type TableInvalidInputField =
  | 'kind'
  | 'x'
  | 'y'
  | 'width'
  | 'depth'
  | 'rotation'
  | 'seats';

export interface TableInvalidInputError {
  code: 'TABLE_INVALID_INPUT';
  tableId: string;
  tableLabel: string;
  field: TableInvalidInputField;
}

export interface TableSizeOutOfRangeError {
  code: 'TABLE_SIZE_OUT_OF_RANGE';
  tableId: string;
  tableLabel: string;
  tableKind: TableKind;
  width: number;
  depth: number;
  tableWidth: number;
  tableDepth: number;
  min: number;
  max: number;
}

export interface TableSeatsOutOfRangeError {
  code: 'TABLE_SEATS_OUT_OF_RANGE';
  tableId: string;
  tableLabel: string;
  seats: number;
  capacity: number;
}

export interface TableOutsideAnySpaceError {
  code: 'TABLE_OUTSIDE_ANY_SPACE';
  tableId: string;
  tableLabel: string;
}

export interface TableExceedsSpaceError {
  code: 'TABLE_EXCEEDS_SPACE';
  tableId: string;
  tableLabel: string;
  spaceId: string;
  spaceName: string;
  spaceWidth: number;
  spaceDepth: number;
  tableWidth: number;
  tableDepth: number;
}

export interface TableTooBigForSpaceError {
  code: 'TABLE_TOO_BIG_FOR_SPACE';
  tableId: string;
  tableLabel: string;
  tableKind: TableKind;
  tableWidth: number;
  tableDepth: number;
  spaceId: string;
  spaceName: string;
  spaceWidth: number;
  spaceDepth: number;
}

export interface TableOverlapError {
  code: 'TABLE_OVERLAP';
  tableId: string;
  tableLabel: string;
  otherTableId: string;
  otherTableLabel: string;
}

export interface SpaceOutOfBoundsError {
  code: 'SPACE_OUT_OF_BOUNDS';
  spaceId?: string | null;
  maxWidth: number;
  maxHeight: number;
  bbox: BBox;
}

export interface SpaceTooSmallError {
  code: 'SPACE_TOO_SMALL';
  spaceId?: string | null;
  areaM2: number;
  minAreaM2: number;
}

export interface SpaceSideTooShortError {
  code: 'SPACE_SIDE_TOO_SHORT';
  spaceId?: string | null;
  width: number;
  depth: number;
  minSideM: number;
}

export interface SpaceSelfIntersectsError {
  code: 'SPACE_SELF_INTERSECTS';
  spaceId?: string | null;
}

export interface SpaceOverlapError {
  code: 'SPACE_OVERLAP';
  spaceId?: string | null;
  otherSpaceId: string;
  otherSpaceName: string;
}

export type SpaceInvalidPolygonReason = 'TOO_FEW_VERTICES' | 'NON_FINITE' | 'DEGENERATE';

export interface SpaceInvalidPolygonError {
  code: 'SPACE_INVALID_POLYGON';
  spaceId?: string | null;
  reason: SpaceInvalidPolygonReason;
}

export interface SpaceContentOutsideError {
  code: 'SPACE_CONTENT_OUTSIDE';
  spaceId?: string | null;
  tableId: string;
  tableLabel: string;
}

export type TableRuleError =
  | TableInvalidInputError
  | TableSizeOutOfRangeError
  | TableSeatsOutOfRangeError
  | TableOutsideAnySpaceError
  | TableExceedsSpaceError
  | TableTooBigForSpaceError
  | TableOverlapError;

export type SpaceRuleError =
  | SpaceOutOfBoundsError
  | SpaceTooSmallError
  | SpaceSideTooShortError
  | SpaceSelfIntersectsError
  | SpaceOverlapError
  | SpaceInvalidPolygonError;

export type SpaceContentError = SpaceContentOutsideError;

export type FloorRuleError =
  | TableRuleError
  | SpaceRuleError
  | SpaceContentError;

/**
 * Returns the space containing the table center point, or undefined if none.
 */
export function spaceOfTable(
  table: Pick<FloorTable, 'x' | 'y'>,
  spaces: readonly FloorSpace[],
): FloorSpace | undefined {
  if (
    !table ||
    typeof table.x !== 'number' ||
    typeof table.y !== 'number' ||
    !Number.isFinite(table.x) ||
    !Number.isFinite(table.y) ||
    !Array.isArray(spaces)
  ) {
    return undefined;
  }
  return spaces.find((s) => s?.polygon && inPoly(table.x, table.y, s.polygon));
}

/**
 * Checks whether table footprint fits inside the bounding box of spacePolygon,
 * testing both original orientation and 90-degree rotated orientation.
 */
export function footprintFits(
  table: Pick<FloorTable, 'width' | 'depth'>,
  spacePolygon: Polygon,
  eps: number = EPS_M,
): boolean {
  if (
    !table ||
    typeof table.width !== 'number' ||
    typeof table.depth !== 'number' ||
    !Number.isFinite(table.width) ||
    !Number.isFinite(table.depth) ||
    table.width <= 0 ||
    table.depth <= 0 ||
    !Array.isArray(spacePolygon) ||
    spacePolygon.length < 3
  ) {
    return false;
  }
  const b = bbox(spacePolygon);
  const d = [table.width, table.depth].sort((x, y) => x - y);
  const e = [b.w, b.h].sort((x, y) => x - y);
  return d[0] <= e[0] + eps && d[1] <= e[1] + eps;
}

/**
 * Validates table positioning and consistency:
 * 1. Must be inside a space.
 * 2. Must be completely contained in that space (distinguishing exceeds vs too big).
 * 3. Must not overlap any other table.
 */
export function checkTable(
  table: FloorTable,
  spaces: readonly FloorSpace[],
  tables: readonly FloorTable[] = [],
): TableRuleError | null {
  const tableId = typeof table?.id === 'string' ? table.id : '';
  const tableLabel = typeof table?.label === 'string' ? table.label : '';

  if (
    !table ||
    typeof table !== 'object' ||
    typeof table.kind !== 'string' ||
    !Object.prototype.hasOwnProperty.call(TABLE_KINDS, table.kind)
  ) {
    return {
      code: 'TABLE_INVALID_INPUT',
      tableId,
      tableLabel,
      field: 'kind',
    };
  }

  if (typeof table.x !== 'number' || !Number.isFinite(table.x)) {
    return {
      code: 'TABLE_INVALID_INPUT',
      tableId,
      tableLabel,
      field: 'x',
    };
  }

  if (typeof table.y !== 'number' || !Number.isFinite(table.y)) {
    return {
      code: 'TABLE_INVALID_INPUT',
      tableId,
      tableLabel,
      field: 'y',
    };
  }

  if (typeof table.width !== 'number' || !Number.isFinite(table.width)) {
    return {
      code: 'TABLE_INVALID_INPUT',
      tableId,
      tableLabel,
      field: 'width',
    };
  }

  if (typeof table.depth !== 'number' || !Number.isFinite(table.depth)) {
    return {
      code: 'TABLE_INVALID_INPUT',
      tableId,
      tableLabel,
      field: 'depth',
    };
  }

  if (typeof table.rotation !== 'number' || !Number.isFinite(table.rotation)) {
    return {
      code: 'TABLE_INVALID_INPUT',
      tableId,
      tableLabel,
      field: 'rotation',
    };
  }

  if (typeof table.seats !== 'number' || !Number.isInteger(table.seats)) {
    return {
      code: 'TABLE_INVALID_INPUT',
      tableId,
      tableLabel,
      field: 'seats',
    };
  }

  const spec = TABLE_KINDS[table.kind];
  if (
    table.width < MIN_TABLE_SIZE_M ||
    table.depth < MIN_TABLE_SIZE_M ||
    table.width > spec.maxSize ||
    table.depth > spec.maxSize
  ) {
    return {
      code: 'TABLE_SIZE_OUT_OF_RANGE',
      tableId,
      tableLabel,
      tableKind: table.kind,
      width: table.width,
      depth: table.depth,
      tableWidth: table.width,
      tableDepth: table.depth,
      min: MIN_TABLE_SIZE_M,
      max: spec.maxSize,
    };
  }

  const capacity = seatCap(table);
  if (table.seats < 1 || table.seats > capacity) {
    return {
      code: 'TABLE_SEATS_OUT_OF_RANGE',
      tableId,
      tableLabel,
      seats: table.seats,
      capacity,
    };
  }

  const sp = spaceOfTable(table, spaces);
  if (!sp) {
    return {
      code: 'TABLE_OUTSIDE_ANY_SPACE',
      tableId,
      tableLabel,
    };
  }

  const poly = shapePoly(table);
  if (!containedIn(poly, sp.polygon)) {
    const b = bbox(sp.polygon);
    if (footprintFits(table, sp.polygon)) {
      return {
        code: 'TABLE_EXCEEDS_SPACE',
        tableId,
        tableLabel,
        spaceId: sp.id,
        spaceName: sp.name,
        spaceWidth: b.w,
        spaceDepth: b.h,
        tableWidth: table.width,
        tableDepth: table.depth,
      };
    }
    return {
      code: 'TABLE_TOO_BIG_FOR_SPACE',
      tableId,
      tableLabel,
      tableKind: table.kind,
      tableWidth: table.width,
      tableDepth: table.depth,
      spaceId: sp.id,
      spaceName: sp.name,
      spaceWidth: b.w,
      spaceDepth: b.h,
    };
  }

  for (const other of tables) {
    if (other.id === table.id) continue;
    if (satOverlap(poly, shapePoly(other))) {
      return {
        code: 'TABLE_OVERLAP',
        tableId,
        tableLabel,
        otherTableId: other.id,
        otherTableLabel: other.label,
      };
    }
  }

  return null;
}

/**
 * Validates a candidate space polygon structure, coordinates, and geometric non-degeneracy.
 */
export function validateSpacePolygon(
  pts: unknown,
  spaceId?: string | null,
): SpaceInvalidPolygonError | null {
  if (!Array.isArray(pts) || pts.length < 3) {
    return {
      code: 'SPACE_INVALID_POLYGON',
      spaceId: spaceId ?? null,
      reason: 'TOO_FEW_VERTICES',
    };
  }

  for (const p of pts) {
    if (
      !Array.isArray(p) ||
      p.length < 2 ||
      typeof p[0] !== 'number' ||
      typeof p[1] !== 'number' ||
      !Number.isFinite(p[0]) ||
      !Number.isFinite(p[1])
    ) {
      return {
        code: 'SPACE_INVALID_POLYGON',
        spaceId: spaceId ?? null,
        reason: 'NON_FINITE',
      };
    }
  }

  const polygon = pts as Polygon;
  const b = bbox(polygon);
  const area = polyArea(polygon);

  if (!(b.w > 0) || !(b.h > 0) || !(area > 0)) {
    return {
      code: 'SPACE_INVALID_POLYGON',
      spaceId: spaceId ?? null,
      reason: 'DEGENERATE',
    };
  }

  return null;
}

/**
 * Validates floor space bounds, area, geometry, and non-overlapping with other spaces.
 */
export function checkSpace(
  spaceOrPolygon: FloorSpace | Polygon,
  spaces: readonly FloorSpace[] = [],
  limits?: Partial<FloorLimits>,
  selfId?: string | null,
): SpaceRuleError | null {
  const isSpace =
    typeof spaceOrPolygon === 'object' && spaceOrPolygon !== null && !Array.isArray(spaceOrPolygon);
  const pts = isSpace ? (spaceOrPolygon as FloorSpace).polygon : (spaceOrPolygon as Polygon);
  const effectiveId = selfId ?? (isSpace ? (spaceOrPolygon as FloorSpace).id ?? null : null);

  const polyErr = validateSpacePolygon(pts, effectiveId);
  if (polyErr) {
    return polyErr;
  }

  const lim: FloorLimits = {
    ...DEFAULT_FLOOR_LIMITS,
    ...limits,
  };

  const b = bbox(pts as Polygon);
  if (b.x0 < 0 || b.y0 < 0 || b.x1 > lim.width || b.y1 > lim.height) {
    return {
      code: 'SPACE_OUT_OF_BOUNDS',
      spaceId: effectiveId,
      maxWidth: lim.width,
      maxHeight: lim.height,
      bbox: b,
    };
  }

  const area = polyArea(pts as Polygon);
  if (area < lim.minAreaM2) {
    return {
      code: 'SPACE_TOO_SMALL',
      spaceId: effectiveId,
      areaM2: area,
      minAreaM2: lim.minAreaM2,
    };
  }

  if (selfIntersects(pts as Polygon)) {
    return {
      code: 'SPACE_SELF_INTERSECTS',
      spaceId: effectiveId,
    };
  }

  for (const other of spaces) {
    if (other.id === effectiveId) continue;
    if (
      polysCross(pts as Polygon, other.polygon) ||
      (pts as Polygon).some((v) => strictlyInside(v, other.polygon)) ||
      other.polygon.some((v) => strictlyInside(v, pts as Polygon))
    ) {
      return {
        code: 'SPACE_OVERLAP',
        spaceId: effectiveId,
        otherSpaceId: other.id,
        otherSpaceName: other.name,
      };
    }
  }

  return null;
}

/**
 * Validates target dimensions for creating a space by measures ("Espacio por medidas").
 */
export function checkSpaceMeasures(
  width: number,
  depth: number,
  limits?: Partial<FloorLimits>,
  spaceId?: string | null,
): SpaceRuleError | null {
  const effectiveId = spaceId ?? null;

  if (
    typeof width !== 'number' ||
    typeof depth !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(depth)
  ) {
    return {
      code: 'SPACE_INVALID_POLYGON',
      spaceId: effectiveId,
      reason: 'NON_FINITE',
    };
  }

  if (width <= 0 || depth <= 0) {
    return {
      code: 'SPACE_INVALID_POLYGON',
      spaceId: effectiveId,
      reason: 'DEGENERATE',
    };
  }

  const lim: FloorLimits = {
    ...DEFAULT_FLOOR_LIMITS,
    ...limits,
  };

  if (width < lim.minSideM || depth < lim.minSideM) {
    return {
      code: 'SPACE_SIDE_TOO_SHORT',
      spaceId: effectiveId,
      width,
      depth,
      minSideM: lim.minSideM,
    };
  }

  if (width > lim.width || depth > lim.height) {
    return {
      code: 'SPACE_OUT_OF_BOUNDS',
      spaceId: effectiveId,
      maxWidth: lim.width,
      maxHeight: lim.height,
      bbox: { x0: 0, y0: 0, x1: width, y1: depth, w: width, h: depth },
    };
  }

  const area = width * depth;
  if (area < lim.minAreaM2) {
    return {
      code: 'SPACE_TOO_SMALL',
      spaceId: effectiveId,
      areaM2: area,
      minAreaM2: lim.minAreaM2,
    };
  }

  return null;
}

/**
 * Validates that all tables currently associated with a space remain completely contained in spacePolygon.
 */
export function checkSpaceContent(
  spacePolygon: Polygon,
  tablesInSpace: readonly FloorTable[],
  spaceId?: string | null,
): SpaceContentError | null {
  for (const it of tablesInSpace) {
    if (!containedIn(shapePoly(it), spacePolygon)) {
      return {
        code: 'SPACE_CONTENT_OUTSIDE',
        spaceId: spaceId ?? null,
        tableId: it.id,
        tableLabel: it.label,
      };
    }
  }
  return null;
}

/**
 * Scales a space polygon from its top-left bounding box corner (b.x0, b.y0)
 * to target dimensions newWidth and newDepth.
 * Validates minimum side dimensions, space validity, and contained table retention.
 */
export function resizeSpacePolygon(
  space: FloorSpace,
  newWidth: number,
  newDepth: number,
  options?: {
    spaces?: readonly FloorSpace[];
    tables?: readonly FloorTable[];
    limits?: Partial<FloorLimits>;
  },
): { polygon: Polygon | null; error: FloorRuleError | null } {
  const effectiveId = space?.id ?? null;

  const polyErr = validateSpacePolygon(space?.polygon, effectiveId);
  if (polyErr) {
    return { polygon: null, error: polyErr };
  }

  if (
    typeof newWidth !== 'number' ||
    typeof newDepth !== 'number' ||
    !Number.isFinite(newWidth) ||
    !Number.isFinite(newDepth)
  ) {
    return {
      polygon: null,
      error: {
        code: 'SPACE_INVALID_POLYGON',
        spaceId: effectiveId,
        reason: 'NON_FINITE',
      },
    };
  }

  if (newWidth <= 0 || newDepth <= 0) {
    return {
      polygon: null,
      error: {
        code: 'SPACE_INVALID_POLYGON',
        spaceId: effectiveId,
        reason: 'DEGENERATE',
      },
    };
  }

  const lim: FloorLimits = {
    ...DEFAULT_FLOOR_LIMITS,
    ...options?.limits,
  };

  if (newWidth < lim.minSideM || newDepth < lim.minSideM) {
    return {
      polygon: null,
      error: {
        code: 'SPACE_SIDE_TOO_SHORT',
        spaceId: effectiveId,
        width: newWidth,
        depth: newDepth,
        minSideM: lim.minSideM,
      },
    };
  }

  const b = bbox(space.polygon);
  const sx = newWidth / b.w;
  const sy = newDepth / b.h;
  const pts: Polygon = space.polygon.map(([x, y]) => [
    b.x0 + (x - b.x0) * sx,
    b.y0 + (y - b.y0) * sy,
  ]);

  const allSpaces = [space, ...(options?.spaces ?? [])];
  const insideTables = (options?.tables ?? []).filter(
    (t) => spaceOfTable(t, allSpaces)?.id === space.id,
  );

  const err =
    checkSpace({ ...space, polygon: pts }, options?.spaces ?? [], options?.limits, space.id) ||
    checkSpaceContent(pts, insideTables, space.id);

  if (err) {
    return { polygon: null, error: err };
  }

  return { polygon: pts, error: null };
}

/**
 * Searches in an outward square spiral for a valid position for table within space,
 * snapping coordinates to stepM and verifying all rules.
 */
export function findSpot(
  table: FloorTable,
  space: FloorSpace,
  spaces: readonly FloorSpace[],
  tables: readonly FloorTable[],
  options?: {
    x?: number;
    y?: number;
    stepM?: number;
    limits?: Partial<FloorLimits>;
  },
): FloorTable | null {
  if (!space || validateSpacePolygon(space.polygon, space.id) !== null) {
    return null;
  }
  if (!table || typeof table !== 'object') {
    return null;
  }
  if (
    typeof table.x !== 'number' ||
    !Number.isFinite(table.x) ||
    typeof table.y !== 'number' ||
    !Number.isFinite(table.y)
  ) {
    return null;
  }
  if (
    options?.x !== undefined &&
    (typeof options.x !== 'number' || !Number.isFinite(options.x))
  ) {
    return null;
  }
  if (
    options?.y !== undefined &&
    (typeof options.y !== 'number' || !Number.isFinite(options.y))
  ) {
    return null;
  }
  if (
    typeof table.kind !== 'string' ||
    !Object.prototype.hasOwnProperty.call(TABLE_KINDS, table.kind) ||
    typeof table.width !== 'number' ||
    !Number.isFinite(table.width) ||
    typeof table.depth !== 'number' ||
    !Number.isFinite(table.depth) ||
    typeof table.rotation !== 'number' ||
    !Number.isFinite(table.rotation) ||
    typeof table.seats !== 'number' ||
    !Number.isInteger(table.seats)
  ) {
    return null;
  }
  const spec = TABLE_KINDS[table.kind];
  if (
    table.width < MIN_TABLE_SIZE_M ||
    table.depth < MIN_TABLE_SIZE_M ||
    table.width > spec.maxSize ||
    table.depth > spec.maxSize
  ) {
    return null;
  }
  if (table.seats < 1 || table.seats > seatCap(table)) {
    return null;
  }

  if (!footprintFits(table, space.polygon)) {
    return null;
  }

  const stepM = options?.stepM ?? options?.limits?.gridStepM ?? DEFAULT_FLOOR_LIMITS.gridStepM;
  if (typeof stepM !== 'number' || !Number.isFinite(stepM) || stepM <= 0) {
    return null;
  }
  const snap = (v: number) => Number((Math.round(v / stepM) * stepM).toFixed(6));

  const b = bbox(space.polygon);
  let px = options?.x != null ? options.x : (b.x0 + b.x1) / 2;
  let py = options?.y != null ? options.y : (b.y0 + b.y1) / 2;
  px = snap(px);
  py = snap(py);

  const allSpaces = spaces.some((s) => s.id === space.id) ? spaces : [space, ...spaces];
  const maxR = Math.min(60, Math.ceil(Math.max(b.w, b.h) / stepM));

  for (let r = 0; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const candidate: FloorTable = {
          ...table,
          x: Number((px + dx * stepM).toFixed(6)),
          y: Number((py + dy * stepM).toFixed(6)),
        };
        if (
          spaceOfTable(candidate, allSpaces)?.id === space.id &&
          checkTable(candidate, allSpaces, tables) === null
        ) {
          return candidate;
        }
      }
    }
  }

  return null;
}
