import * as rulesModule from '../../src/floorplan/rules';
import {
  FloorSpace,
  FloorLimits,
  DEFAULT_FLOOR_LIMITS,
  FloorRuleErrorCode,
  TableRuleError,
  SpaceRuleError,
  SpaceContentError,
  FloorRuleError,
  SpaceInvalidPolygonReason,
  SpaceInvalidPolygonError,
  validateSpacePolygon,
  spaceOfTable,
  footprintFits,
  checkTable,
  checkSpace,
  checkSpaceMeasures,
  checkSpaceContent,
  resizeSpacePolygon,
  findSpot,
} from '../../src/floorplan/rules';
import { FloorTable, TableKind, TABLE_KINDS, MIN_TABLE_SIZE_M, seatCap } from '../../src/floorplan/shapes';
import { Polygon } from '../../src/floorplan/geometry';

describe('floorplan rules and consistency checks (in meters)', () => {
  describe('constants and default limits', () => {
    it('exports DEFAULT_FLOOR_LIMITS matching demo specifications and does not export deprecated aliases', () => {
      expect(DEFAULT_FLOOR_LIMITS.width).toBeCloseTo(1000 / 60, 4);
      expect(DEFAULT_FLOOR_LIMITS.height).toBeCloseTo(640 / 60, 4);
      expect(DEFAULT_FLOOR_LIMITS.minAreaM2).toBe(2);
      expect(DEFAULT_FLOOR_LIMITS.minSideM).toBe(1.5);
      expect(DEFAULT_FLOOR_LIMITS.gridStepM).toBe(0.1);
      expect((rulesModule as any).DEFAULT_FLOOR_BOUNDS).toBeUndefined();
      expect((rulesModule as any).DEFAULT_GRID_STEP_M).toBeUndefined();
    });
  });

  const sampleSpace1: FloorSpace = {
    id: 'sp-saloon',
    name: 'Salón Principal',
    polygon: [
      [1, 1],
      [7, 1],
      [7, 6],
      [1, 6],
    ],
  };

  const sampleSpace2: FloorSpace = {
    id: 'sp-terrace',
    name: 'Terraza',
    polygon: [
      [8, 1],
      [14, 1],
      [14, 6],
      [8, 6],
    ],
  };

  const sampleTable1: FloorTable = {
    id: 't-1',
    label: 'Mesa 1',
    kind: 'square',
    x: 3,
    y: 3,
    width: 0.8,
    depth: 0.8,
    rotation: 0,
    seats: 2,
  };

  describe('spaceOfTable', () => {
    it('finds the space containing table center', () => {
      expect(spaceOfTable({ x: 3, y: 3 }, [sampleSpace1, sampleSpace2])).toEqual(sampleSpace1);
      expect(spaceOfTable({ x: 10, y: 3 }, [sampleSpace1, sampleSpace2])).toEqual(sampleSpace2);
    });

    it('returns undefined if table center is outside all spaces', () => {
      expect(spaceOfTable({ x: 0.5, y: 0.5 }, [sampleSpace1, sampleSpace2])).toBeUndefined();
      expect(spaceOfTable({ x: 7.5, y: 3 }, [sampleSpace1, sampleSpace2])).toBeUndefined();
    });
  });

  describe('footprintFits', () => {
    const spacePoly: Polygon = [
      [0, 0],
      [2, 0],
      [2, 4],
      [0, 4],
    ]; // bbox w=2, h=4

    it('returns true when sorted dimensions fit space bbox dimensions', () => {
      // 1.0 x 1.0 fits in 2 x 4
      expect(footprintFits({ width: 1.0, depth: 1.0 }, spacePoly)).toBe(true);
      // Long bar 3.5 x 0.6 fits when rotated (0.6 <= 2, 3.5 <= 4)
      expect(footprintFits({ width: 3.5, depth: 0.6 }, spacePoly)).toBe(true);
      expect(footprintFits({ width: 0.6, depth: 3.5 }, spacePoly)).toBe(true);
    });

    it('returns false when table cannot fit even rotated', () => {
      // 5.0 x 0.6 cannot fit in 2 x 4
      expect(footprintFits({ width: 5.0, depth: 0.6 }, spacePoly)).toBe(false);
      // 2.5 x 2.5 cannot fit in 2 x 4 (2.5 > 2.0)
      expect(footprintFits({ width: 2.5, depth: 2.5 }, spacePoly)).toBe(false);
    });
  });

  describe('checkTable (table rule checks)', () => {
    it('returns null for a valid table correctly placed inside a space', () => {
      const err = checkTable(sampleTable1, [sampleSpace1]);
      expect(err).toBeNull();
    });

    it('produces TABLE_OUTSIDE_ANY_SPACE when table center is outside spaces', () => {
      const outsideTable: FloorTable = {
        ...sampleTable1,
        id: 't-out',
        label: 'Mesa Fuera',
        x: 0.5,
        y: 0.5,
      };
      const err = checkTable(outsideTable, [sampleSpace1]);
      expect(err).toEqual({
        code: 'TABLE_OUTSIDE_ANY_SPACE',
        tableId: 't-out',
        tableLabel: 'Mesa Fuera',
      });
    });

    it('produces TABLE_EXCEEDS_SPACE when table fits space bbox but exceeds boundaries at current position', () => {
      // sampleSpace1 is [1, 1] to [7, 6], w=6, h=5
      // Mesa 1 has width 0.8, depth 0.8. If center is at [1.2, 3], x spans [0.8, 1.6], so it crosses x=1
      const edgeTable: FloorTable = {
        ...sampleTable1,
        x: 1.2,
        y: 3.0,
      };
      const err = checkTable(edgeTable, [sampleSpace1]);
      expect(err).toEqual({
        code: 'TABLE_EXCEEDS_SPACE',
        tableId: edgeTable.id,
        tableLabel: edgeTable.label,
        spaceId: sampleSpace1.id,
        spaceName: sampleSpace1.name,
        spaceWidth: 6,
        spaceDepth: 5,
        tableWidth: 0.8,
        tableDepth: 0.8,
      });
    });

    it('handles elongated bar table (3.5 x 0.6) in space (2.0 x 4.0): TABLE_EXCEEDS_SPACE at 0° and null at 90°', () => {
      const barSpace: FloorSpace = {
        id: 'sp-bar',
        name: 'Zona Barra',
        polygon: [
          [0, 0],
          [2, 0],
          [2, 4],
          [0, 4],
        ],
      };
      const barTable0Deg: FloorTable = {
        id: 't-bar',
        label: 'Barra Larga',
        kind: 'bar',
        width: 3.5,
        depth: 0.6,
        x: 1.0,
        y: 2.0,
        rotation: 0,
        seats: 6,
      };

      // At 0°, width spans [-0.75, 2.75] which exceeds space width [0, 2], but footprintFits is true
      const err0 = checkTable(barTable0Deg, [barSpace]);
      expect(err0).toEqual({
        code: 'TABLE_EXCEEDS_SPACE',
        tableId: barTable0Deg.id,
        tableLabel: barTable0Deg.label,
        spaceId: barSpace.id,
        spaceName: barSpace.name,
        spaceWidth: 2,
        spaceDepth: 4,
        tableWidth: 3.5,
        tableDepth: 0.6,
      });

      // At 90°, width spans along Y [0.25, 3.75] and depth spans along X [0.7, 1.3], fitting inside [0, 2] x [0, 4]
      const barTable90Deg: FloorTable = {
        ...barTable0Deg,
        rotation: 90,
      };
      const err90 = checkTable(barTable90Deg, [barSpace]);
      expect(err90).toBeNull();
    });

    it('produces TABLE_TOO_BIG_FOR_SPACE when table dimensions exceed space bbox even if rotated', () => {
      const smallSpace: FloorSpace = {
        id: 'sp-small',
        name: 'Rincón',
        polygon: [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
        ],
      };
      const hugeTable: FloorTable = {
        id: 't-huge',
        label: 'Mesa Enorme',
        kind: 'rect',
        width: 3.0,
        depth: 1.0,
        x: 1.0,
        y: 1.0,
        rotation: 0,
        seats: 6,
      };

      const err = checkTable(hugeTable, [smallSpace]);
      expect(err).toEqual({
        code: 'TABLE_TOO_BIG_FOR_SPACE',
        tableId: hugeTable.id,
        tableLabel: hugeTable.label,
        tableKind: 'rect',
        tableWidth: 3.0,
        tableDepth: 1.0,
        spaceId: smallSpace.id,
        spaceName: smallSpace.name,
        spaceWidth: 2,
        spaceDepth: 2,
      });
    });

    it('produces TABLE_OVERLAP when two tables overlap, reporting conflicting table details', () => {
      const tableA: FloorTable = {
        ...sampleTable1,
        id: 't-a',
        label: 'Mesa Alfa',
        x: 3.0,
        y: 3.0,
      };
      const tableB: FloorTable = {
        ...sampleTable1,
        id: 't-b',
        label: 'Mesa Beta',
        x: 3.4, // centers 0.4 m apart, tables 0.8 m wide -> overlap
        y: 3.0,
      };

      const err = checkTable(tableA, [sampleSpace1], [tableA, tableB]);
      expect(err).toEqual({
        code: 'TABLE_OVERLAP',
        tableId: 't-a',
        tableLabel: 'Mesa Alfa',
        otherTableId: 't-b',
        otherTableLabel: 'Mesa Beta',
      });

      // No overlap when spaced apart
      const tableFar: FloorTable = {
        ...tableB,
        x: 5.0,
      };
      expect(checkTable(tableA, [sampleSpace1], [tableA, tableFar])).toBeNull();
    });
  });

  describe('checkSpace (space rule checks)', () => {
    it('returns null for a valid space within bounds', () => {
      const err = checkSpace(sampleSpace1, [sampleSpace1, sampleSpace2]);
      expect(err).toBeNull();
    });

    it('produces SPACE_OUT_OF_BOUNDS when space exceeds floor limits', () => {
      const outSpace: FloorSpace = {
        id: 'sp-out',
        name: 'Espacio Fuera',
        polygon: [
          [-1, 1],
          [5, 1],
          [5, 5],
          [-1, 5],
        ],
      };
      const err = checkSpace(outSpace);
      expect(err).toMatchObject({
        code: 'SPACE_OUT_OF_BOUNDS',
        spaceId: 'sp-out',
        maxWidth: DEFAULT_FLOOR_LIMITS.width,
        maxHeight: DEFAULT_FLOOR_LIMITS.height,
      });
    });

    it('allows drawn space with narrow side (< minSideM) when area >= minAreaM2 (e.g. 1.2 x 3.0 = 3.6 m²)', () => {
      const narrowPoly: Polygon = [
        [0, 0],
        [1.2, 0],
        [1.2, 3],
        [0, 3],
      ]; // w = 1.2 < 1.5, h = 3.0, area = 3.6 >= 2.0
      const err = checkSpace(narrowPoly);
      expect(err).toBeNull();
    });

    it('produces SPACE_TOO_SMALL when area is under minAreaM2 even if sides >= minSideM (e.g. triangle 2.0 x 1.8 = 1.8 m² < 2.0 m²)', () => {
      const trianglePoly: Polygon = [
        [0, 0],
        [2, 0],
        [0, 1.8],
      ]; // bbox: w=2.0 >= 1.5, h=1.8 >= 1.5, area = 2.0 * 1.8 / 2 = 1.8 m² < 2 m²
      const err = checkSpace(trianglePoly);
      expect(err).toEqual({
        code: 'SPACE_TOO_SMALL',
        spaceId: null,
        areaM2: 1.8,
        minAreaM2: 2.0,
      });
    });

    it('produces SPACE_SELF_INTERSECTS when polygon edges cross each other', () => {
      const selfIntersectingPoly: Polygon = [
        [1, 1],
        [6, 1],
        [6, 6],
        [2, 0.5], // crosses segment [1, 1]-[6, 1]
        [1, 6],
      ]; // area is ~11.25 m² > 2 m² and edges cross
      const err = checkSpace(selfIntersectingPoly, [], undefined, 'sp-bowtie');
      expect(err).toEqual({
        code: 'SPACE_SELF_INTERSECTS',
        spaceId: 'sp-bowtie',
      });
    });

    it('produces SPACE_OVERLAP when space overlaps with another space', () => {
      const overlappingSpace: FloorSpace = {
        id: 'sp-overlap',
        name: 'Solapado',
        polygon: [
          [5, 2],
          [9, 2],
          [9, 5],
          [5, 5],
        ], // overlaps sampleSpace1 (x spans 1..7) and sampleSpace2 (x spans 8..14)
      };
      const err = checkSpace(overlappingSpace, [sampleSpace1, sampleSpace2]);
      expect(err).toEqual({
        code: 'SPACE_OVERLAP',
        spaceId: 'sp-overlap',
        otherSpaceId: sampleSpace1.id,
        otherSpaceName: sampleSpace1.name,
      });
    });

    it('does not self-conflict when comparing space against itself by effectiveId', () => {
      expect(checkSpace(sampleSpace1, [sampleSpace1, sampleSpace2])).toBeNull();
    });
  });

  describe('checkSpaceContent', () => {
    it('returns null when all tables are strictly contained inside space polygon', () => {
      const err = checkSpaceContent(sampleSpace1.polygon, [sampleTable1], sampleSpace1.id);
      expect(err).toBeNull();
    });

    it('produces SPACE_CONTENT_OUTSIDE when a table is partially or fully outside the space polygon', () => {
      const outsideTable: FloorTable = {
        ...sampleTable1,
        id: 't-straddling',
        label: 'Mesa en el Borde',
        x: 1.1, // center at 1.1, edge crosses x=1 of sampleSpace1
        y: 3.0,
      };
      const err = checkSpaceContent(sampleSpace1.polygon, [outsideTable], sampleSpace1.id);
      expect(err).toEqual({
        code: 'SPACE_CONTENT_OUTSIDE',
        spaceId: sampleSpace1.id,
        tableId: 't-straddling',
        tableLabel: 'Mesa en el Borde',
      });
    });
  });

  describe('resizeSpacePolygon', () => {
    const spaceToResize: FloorSpace = {
      id: 'sp-resizable',
      name: 'Espacio Redimensionable',
      polygon: [
        [2, 2],
        [6, 2],
        [6, 6],
        [2, 6],
      ], // bbox: x0=2, y0=2, w=4, h=4
    };

    const tableInside: FloorTable = {
      id: 't-in',
      label: 'Mesa Interior',
      kind: 'square',
      x: 3.0,
      y: 3.0,
      width: 0.8,
      depth: 0.8,
      rotation: 0,
      seats: 2,
    };

    it('returns SPACE_SIDE_TOO_SHORT if requested dimensions are below minSideM', () => {
      const res = resizeSpacePolygon(spaceToResize, 1.2, 4.0);
      expect(res.polygon).toBeNull();
      expect(res.error).toEqual({
        code: 'SPACE_SIDE_TOO_SHORT',
        spaceId: spaceToResize.id,
        width: 1.2,
        depth: 4.0,
        minSideM: 1.5,
      });
    });

    it('returns SPACE_CONTENT_OUTSIDE and polygon null when shrinking leaves an existing table partially outside', () => {
      // tableInside is at [3.0, 3.0], with bounds [2.6, 3.4] along X and Y
      // If we resize from 4x4 down to 1.8x4 from corner (2,2), new X bounds become [2, 3.8] (table is at 2.6..3.4, still inside X)
      // But if we resize down to 1.5x1.5, new bounds become [2, 3.5] x [2, 3.5], wait: table upper corner is 3.4, which might still fit
      // If we resize width to 1.5, new X max is 2 + 1.5 = 3.5; if tableInside is at x=3.5, bounds are [3.1, 3.9] -> exceeds 3.5!
      const tableNearEdge: FloorTable = {
        ...tableInside,
        x: 4.0,
        y: 4.0,
      };
      // Shrinking to 2.5 x 2.5 makes new polygon [2, 2] to [4.5, 4.5]. Table at [4.0, 4.0] has corners up to 4.4, still inside.
      // Shrinking to 2.0 x 2.0 makes new polygon [2, 2] to [4.0, 4.0]. Table center is 4.0, corners extend to 4.4 -> outside!
      const res = resizeSpacePolygon(spaceToResize, 2.0, 2.0, {
        tables: [tableNearEdge],
      });
      expect(res.polygon).toBeNull();
      expect(res.error).toEqual({
        code: 'SPACE_CONTENT_OUTSIDE',
        spaceId: spaceToResize.id,
        tableId: tableNearEdge.id,
        tableLabel: tableNearEdge.label,
      });
    });

    it('scales polygon successfully from (b.x0, b.y0) when tables remain inside', () => {
      // Expand from 4x4 to 5x6
      const res = resizeSpacePolygon(spaceToResize, 5.0, 6.0, {
        tables: [tableInside],
      });
      expect(res.error).toBeNull();
      expect(res.polygon).toEqual([
        [2, 2],
        [7, 2],
        [7, 8],
        [2, 8],
      ]);
    });
  });

  describe('findSpot', () => {
    const spotSpace: FloorSpace = {
      id: 'sp-spot',
      name: 'Espacio Spot',
      polygon: [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ], // bbox center at (2, 2)
    };

    const standardTable: FloorTable = {
      id: 't-new',
      label: 'Mesa Nueva',
      kind: 'square',
      x: 0,
      y: 0,
      width: 0.8,
      depth: 0.8,
      rotation: 0,
      seats: 2,
    };

    it('returns null if table footprint does not fit in space', () => {
      const hugeTable: FloorTable = {
        ...standardTable,
        width: 5.0,
        depth: 5.0,
      };
      const res = findSpot(hugeTable, spotSpace, [spotSpace], []);
      expect(res).toBeNull();
    });

    it('finds spot at space center when space is empty', () => {
      const res = findSpot(standardTable, spotSpace, [spotSpace], []);
      expect(res).not.toBeNull();
      expect(res!.x).toBe(2.0);
      expect(res!.y).toBe(2.0);
      expect(checkTable(res!, [spotSpace], [])).toBeNull();
    });

    it('spirals around center when center is already occupied by another table', () => {
      const centerTable: FloorTable = {
        id: 't-center',
        label: 'Mesa Centro',
        kind: 'square',
        x: 2.0,
        y: 2.0,
        width: 0.8,
        depth: 0.8,
        rotation: 0,
        seats: 2,
      };

      const res = findSpot(standardTable, spotSpace, [spotSpace], [centerTable]);
      expect(res).not.toBeNull();
      // Should not be at (2.0, 2.0)
      expect(res!.x === 2.0 && res!.y === 2.0).toBe(false);
      // Valid coordinates snapped to grid
      expect(Number((res!.x / 0.1).toFixed(2)) % 1).toBeCloseTo(0, 4);
      expect(Number((res!.y / 0.1).toFixed(2)) % 1).toBeCloseTo(0, 4);
      // Must pass checkTable without conflicts
      expect(checkTable(res!, [spotSpace], [centerTable])).toBeNull();
    });

    it('returns null if space is completely packed with tables', () => {
      // Pack the 4x4 space with a grid of tables
      const tables: FloorTable[] = [];
      let idx = 1;
      for (let x = 0.5; x <= 3.5; x += 0.8) {
        for (let y = 0.5; y <= 3.5; y += 0.8) {
          tables.push({
            id: `t-pack-${idx++}`,
            label: `Mesa ${idx}`,
            kind: 'square',
            x: Number(x.toFixed(1)),
            y: Number(y.toFixed(1)),
            width: 0.8,
            depth: 0.8,
            rotation: 0,
            seats: 2,
          });
        }
      }
      const res = findSpot(standardTable, spotSpace, [spotSpace], tables);
      expect(res).toBeNull();
    });

    it('uses options.limits.gridStepM as default step when options.stepM is omitted', () => {
      const centerTable: FloorTable = {
        id: 't-center',
        label: 'Mesa Centro',
        kind: 'square',
        x: 2.0,
        y: 2.0,
        width: 0.8,
        depth: 0.8,
        rotation: 0,
        seats: 2,
      };
      const resStepped = findSpot(standardTable, spotSpace, [spotSpace], [centerTable], {
        limits: { gridStepM: 0.25 },
      });
      expect(resStepped).not.toBeNull();
      const dx = Math.abs(resStepped!.x - 2.0);
      const dy = Math.abs(resStepped!.y - 2.0);
      expect(Number((dx / 0.25).toFixed(4)) % 1).toBeCloseTo(0, 4);
      expect(Number((dy / 0.25).toFixed(4)) % 1).toBeCloseTo(0, 4);
    });

    it('allows options.stepM to override options.limits.gridStepM', () => {
      const centerTable: FloorTable = {
        id: 't-center',
        label: 'Mesa Centro',
        kind: 'square',
        x: 2.0,
        y: 2.0,
        width: 0.8,
        depth: 0.8,
        rotation: 0,
        seats: 2,
      };
      const res = findSpot(standardTable, spotSpace, [spotSpace], [centerTable], {
        stepM: 0.5,
        limits: { gridStepM: 0.25 },
      });
      expect(res).not.toBeNull();
      const dx = Math.abs(res!.x - 2.0);
      const dy = Math.abs(res!.y - 2.0);
      expect(Number((dx / 0.5).toFixed(4)) % 1).toBeCloseTo(0, 4);
      expect(Number((dy / 0.5).toFixed(4)) % 1).toBeCloseTo(0, 4);
    });

    it('returns null if resolved stepM is not a finite number or is <= 0', () => {
      expect(
        findSpot(standardTable, spotSpace, [spotSpace], [], {
          stepM: 0,
        }),
      ).toBeNull();
      expect(
        findSpot(standardTable, spotSpace, [spotSpace], [], {
          stepM: -0.1,
        }),
      ).toBeNull();
      expect(
        findSpot(standardTable, spotSpace, [spotSpace], [], {
          stepM: NaN,
        }),
      ).toBeNull();
      expect(
        findSpot(standardTable, spotSpace, [spotSpace], [], {
          limits: { gridStepM: 0 },
        }),
      ).toBeNull();
      expect(
        findSpot(standardTable, spotSpace, [spotSpace], [], {
          limits: { gridStepM: -1 },
        }),
      ).toBeNull();
      expect(
        findSpot(standardTable, spotSpace, [spotSpace], [], {
          limits: { gridStepM: NaN },
        }),
      ).toBeNull();
    });
  });

  describe('SPACE_INVALID_POLYGON validation (U5 / F1)', () => {
    const validSquare: FloorSpace = {
      id: 'sp-valid',
      name: 'Espacio Válido',
      polygon: [
        [2, 2],
        [6, 2],
        [6, 6],
        [2, 6],
      ],
    };

    it('F1a exact probe: checkSpace with NaN coordinate returns SPACE_INVALID_POLYGON (NON_FINITE)', () => {
      const err = checkSpace([[NaN, 1], [5, 1], [5, 5], [1, 5]] as any);
      expect(err).toEqual({
        code: 'SPACE_INVALID_POLYGON',
        spaceId: null,
        reason: 'NON_FINITE',
      });
    });

    it('F1b exact probe: resizeSpacePolygon on degenerate space returns SPACE_INVALID_POLYGON (DEGENERATE)', () => {
      const res = resizeSpacePolygon(
        { id: 'sp-deg', name: 'Degenerado', polygon: [[1, 1], [1, 1], [1, 1]] },
        2,
        2,
      );
      expect(res).toEqual({
        polygon: null,
        error: {
          code: 'SPACE_INVALID_POLYGON',
          spaceId: 'sp-deg',
          reason: 'DEGENERATE',
        },
      });
    });

    describe('checkSpace invalid polygon cases', () => {
      it('rejects polygon with fewer than 3 vertices (empty array)', () => {
        const err = checkSpace([] as any);
        expect(err).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: null,
          reason: 'TOO_FEW_VERTICES',
        });
      });

      it('rejects polygon with 2 vertices', () => {
        const err = checkSpace([[0, 0], [1, 1]] as any);
        expect(err).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: null,
          reason: 'TOO_FEW_VERTICES',
        });
      });

      it('rejects FloorSpace object with fewer than 3 vertices and preserves spaceId', () => {
        const err = checkSpace({
          id: 'sp-few',
          name: 'Pocos Vértices',
          polygon: [[0, 0]] as any,
        });
        expect(err).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: 'sp-few',
          reason: 'TOO_FEW_VERTICES',
        });
      });

      it('rejects polygon containing Infinity / -Infinity coordinates', () => {
        const errInf = checkSpace([[0, 0], [Infinity, 1], [1, 2]] as any);
        expect(errInf).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: null,
          reason: 'NON_FINITE',
        });

        const errNegInf = checkSpace(
          [[0, 0], [1, -Infinity], [1, 2]] as any,
          [],
          undefined,
          'sp-inf',
        );
        expect(errNegInf).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: 'sp-inf',
          reason: 'NON_FINITE',
        });
      });

      it('rejects degenerate polygon where all points are identical', () => {
        const err = checkSpace([[1, 1], [1, 1], [1, 1]]);
        expect(err).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: null,
          reason: 'DEGENERATE',
        });
      });

      it('rejects degenerate collinear polygon with zero area and zero height', () => {
        const err = checkSpace(
          [[0, 0], [2, 0], [4, 0]],
          [],
          undefined,
          'sp-collinear',
        );
        expect(err).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: 'sp-collinear',
          reason: 'DEGENERATE',
        });
      });
    });

    describe('resizeSpacePolygon invalid polygon and dimensions cases', () => {
      it('rejects resizeSpacePolygon with non-finite newWidth or newDepth', () => {
        const resNaN = resizeSpacePolygon(validSquare, NaN, 2.0);
        expect(resNaN).toEqual({
          polygon: null,
          error: {
            code: 'SPACE_INVALID_POLYGON',
            spaceId: validSquare.id,
            reason: 'NON_FINITE',
          },
        });

        const resInf = resizeSpacePolygon(validSquare, 2.0, Infinity);
        expect(resInf).toEqual({
          polygon: null,
          error: {
            code: 'SPACE_INVALID_POLYGON',
            spaceId: validSquare.id,
            reason: 'NON_FINITE',
          },
        });
      });

      it('rejects resizeSpacePolygon with non-positive newWidth or newDepth (0 or negative)', () => {
        const resZero = resizeSpacePolygon(validSquare, 0, 2.0);
        expect(resZero).toEqual({
          polygon: null,
          error: {
            code: 'SPACE_INVALID_POLYGON',
            spaceId: validSquare.id,
            reason: 'DEGENERATE',
          },
        });

        const resNeg = resizeSpacePolygon(validSquare, 2.0, -2);
        expect(resNeg).toEqual({
          polygon: null,
          error: {
            code: 'SPACE_INVALID_POLYGON',
            spaceId: validSquare.id,
            reason: 'DEGENERATE',
          },
        });
      });

      it('rejects resizeSpacePolygon when original polygon has fewer than 3 vertices', () => {
        const res = resizeSpacePolygon(
          { id: 'sp-bad', name: 'Malo', polygon: [] as any },
          2,
          2,
        );
        expect(res).toEqual({
          polygon: null,
          error: {
            code: 'SPACE_INVALID_POLYGON',
            spaceId: 'sp-bad',
            reason: 'TOO_FEW_VERTICES',
          },
        });
      });
    });
  });

  describe('TABLE validation rules (U6 / F2 & F3)', () => {
    const wideSpace: FloorSpace = {
      id: 'sp-wide',
      name: 'Espacio Amplio',
      polygon: [
        [0, 0],
        [15, 0],
        [15, 10],
        [0, 10],
      ],
    };

    describe('F2 and F3 exact probes from specification', () => {
      it('F2a: checkTable with width: -0.8 returns TABLE_SIZE_OUT_OF_RANGE', () => {
        const table: FloorTable = {
          ...sampleTable1,
          width: -0.8,
        };
        const err = checkTable(table, [sampleSpace1]);
        expect(err).toEqual({
          code: 'TABLE_SIZE_OUT_OF_RANGE',
          tableId: table.id,
          tableLabel: table.label,
          tableKind: 'square',
          width: -0.8,
          depth: 0.8,
          tableWidth: -0.8,
          tableDepth: 0.8,
          min: 0.4,
          max: 3,
        });
      });

      it('F2b: checkTable with width: 0, depth: 0 returns TABLE_SIZE_OUT_OF_RANGE', () => {
        const table: FloorTable = {
          ...sampleTable1,
          width: 0,
          depth: 0,
        };
        const err = checkTable(table, [sampleSpace1]);
        expect(err).toEqual({
          code: 'TABLE_SIZE_OUT_OF_RANGE',
          tableId: table.id,
          tableLabel: table.label,
          tableKind: 'square',
          width: 0,
          depth: 0,
          tableWidth: 0,
          tableDepth: 0,
          min: 0.4,
          max: 3,
        });
      });

      it('F2c: checkTable with seats: 99 in 0.8x0.8 square table returns TABLE_SEATS_OUT_OF_RANGE (capacity: 2)', () => {
        const table: FloorTable = {
          ...sampleTable1,
          seats: 99,
        };
        const err = checkTable(table, [sampleSpace1]);
        expect(err).toEqual({
          code: 'TABLE_SEATS_OUT_OF_RANGE',
          tableId: table.id,
          tableLabel: table.label,
          seats: 99,
          capacity: 2,
        });
      });

      it('F2d: checkTable with 3.9x3.9 square table in large space returns TABLE_SIZE_OUT_OF_RANGE', () => {
        const table: FloorTable = {
          id: 't-3.9',
          label: 'Mesa 3.9',
          kind: 'square',
          x: 4.0,
          y: 3.5,
          width: 3.9,
          depth: 3.9,
          rotation: 0,
          seats: 2,
        };
        const err = checkTable(table, [sampleSpace1]);
        expect(err).toEqual({
          code: 'TABLE_SIZE_OUT_OF_RANGE',
          tableId: table.id,
          tableLabel: table.label,
          tableKind: 'square',
          width: 3.9,
          depth: 3.9,
          tableWidth: 3.9,
          tableDepth: 3.9,
          min: 0.4,
          max: 3,
        });
      });

      it('F3a: checkTable with kind: "zzz" as any does NOT throw and returns TABLE_INVALID_INPUT for kind', () => {
        const table: any = {
          ...sampleTable1,
          kind: 'zzz',
        };
        expect(() => checkTable(table, [sampleSpace1])).not.toThrow();
        const err = checkTable(table, [sampleSpace1]);
        expect(err).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'kind',
        });
      });

      it('F3b: checkTable with rotation: NaN returns TABLE_INVALID_INPUT for rotation (not TABLE_EXCEEDS_SPACE)', () => {
        const table: FloorTable = {
          ...sampleTable1,
          rotation: NaN,
        };
        const err = checkTable(table, [sampleSpace1]);
        expect(err).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'rotation',
        });
      });
    });

    describe('TABLE_INVALID_INPUT field coverage', () => {
      it('rejects null table or missing object', () => {
        expect(checkTable(null as any, [sampleSpace1])).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: '',
          tableLabel: '',
          field: 'kind',
        });
      });

      it('rejects invalid or non-finite x', () => {
        expect(checkTable({ ...sampleTable1, x: NaN }, [sampleSpace1])).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'x',
        });
        expect(checkTable({ ...sampleTable1, x: Infinity }, [sampleSpace1])).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'x',
        });
      });

      it('rejects invalid or non-finite y', () => {
        expect(checkTable({ ...sampleTable1, y: NaN }, [sampleSpace1])).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'y',
        });
        expect(checkTable({ ...sampleTable1, y: -Infinity }, [sampleSpace1])).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'y',
        });
      });

      it('rejects invalid or non-finite width', () => {
        expect(checkTable({ ...sampleTable1, width: NaN }, [sampleSpace1])).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'width',
        });
      });

      it('rejects invalid or non-finite depth', () => {
        expect(checkTable({ ...sampleTable1, depth: NaN }, [sampleSpace1])).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'depth',
        });
      });

      it('rejects invalid or non-finite rotation', () => {
        expect(checkTable({ ...sampleTable1, rotation: Infinity }, [sampleSpace1])).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'rotation',
        });
      });

      it('rejects non-integer, NaN, or non-number seats', () => {
        expect(checkTable({ ...sampleTable1, seats: 2.5 }, [sampleSpace1])).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'seats',
        });
        expect(checkTable({ ...sampleTable1, seats: NaN }, [sampleSpace1])).toEqual({
          code: 'TABLE_INVALID_INPUT',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          field: 'seats',
        });
      });
    });

    describe('TABLE_SEATS_OUT_OF_RANGE coverage', () => {
      it('rejects seats: 0', () => {
        expect(checkTable({ ...sampleTable1, seats: 0 }, [sampleSpace1])).toEqual({
          code: 'TABLE_SEATS_OUT_OF_RANGE',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          seats: 0,
          capacity: 2,
        });
      });

      it('rejects seats: -1', () => {
        expect(checkTable({ ...sampleTable1, seats: -1 }, [sampleSpace1])).toEqual({
          code: 'TABLE_SEATS_OUT_OF_RANGE',
          tableId: sampleTable1.id,
          tableLabel: sampleTable1.label,
          seats: -1,
          capacity: 2,
        });
      });
    });

    describe('Parametric test across all 7 shapes', () => {
      const ALL_KINDS: TableKind[] = ['square', 'round', 'rect', 'oval', 'half', 'hex', 'bar'];

      it.each(ALL_KINDS)(
        'validates %s at exact minimum (0.4m x 0.4m, seats: 1) -> null',
        (kind) => {
          const table: FloorTable = {
            id: `t-min-${kind}`,
            label: `Mesa Min ${kind}`,
            kind,
            x: 7.5,
            y: 5.0,
            width: MIN_TABLE_SIZE_M,
            depth: MIN_TABLE_SIZE_M,
            rotation: 0,
            seats: 1,
          };
          expect(checkTable(table, [wideSpace])).toBeNull();
        },
      );

      it.each(ALL_KINDS)(
        'validates %s at exact maximum (maxSize x maxSize, seats: seatCap) -> null',
        (kind) => {
          const spec = TABLE_KINDS[kind];
          const capacity = seatCap({ kind, width: spec.maxSize, depth: spec.maxSize });
          const table: FloorTable = {
            id: `t-max-${kind}`,
            label: `Mesa Max ${kind}`,
            kind,
            x: 7.5,
            y: 5.0,
            width: spec.maxSize,
            depth: spec.maxSize,
            rotation: 0,
            seats: capacity,
          };
          expect(checkTable(table, [wideSpace])).toBeNull();
        },
      );

      it.each(ALL_KINDS)(
        'rejects %s below minimum (width: 0.39m) -> TABLE_SIZE_OUT_OF_RANGE',
        (kind) => {
          const spec = TABLE_KINDS[kind];
          const table: FloorTable = {
            id: `t-under-${kind}`,
            label: `Mesa Under ${kind}`,
            kind,
            x: 7.5,
            y: 5.0,
            width: 0.39,
            depth: spec.depth,
            rotation: 0,
            seats: 1,
          };
          expect(checkTable(table, [wideSpace])).toEqual({
            code: 'TABLE_SIZE_OUT_OF_RANGE',
            tableId: table.id,
            tableLabel: table.label,
            tableKind: kind,
            width: 0.39,
            depth: spec.depth,
            tableWidth: 0.39,
            tableDepth: spec.depth,
            min: MIN_TABLE_SIZE_M,
            max: spec.maxSize,
          });
        },
      );

      it.each(ALL_KINDS)(
        'rejects %s above maximum (width: maxSize + 0.1m) -> TABLE_SIZE_OUT_OF_RANGE',
        (kind) => {
          const spec = TABLE_KINDS[kind];
          const table: FloorTable = {
            id: `t-over-${kind}`,
            label: `Mesa Over ${kind}`,
            kind,
            x: 7.5,
            y: 5.0,
            width: Number((spec.maxSize + 0.1).toFixed(2)),
            depth: spec.depth,
            rotation: 0,
            seats: 1,
          };
          expect(checkTable(table, [wideSpace])).toEqual({
            code: 'TABLE_SIZE_OUT_OF_RANGE',
            tableId: table.id,
            tableLabel: table.label,
            tableKind: kind,
            width: Number((spec.maxSize + 0.1).toFixed(2)),
            depth: spec.depth,
            tableWidth: Number((spec.maxSize + 0.1).toFixed(2)),
            tableDepth: spec.depth,
            min: MIN_TABLE_SIZE_M,
            max: spec.maxSize,
          });
        },
      );
    });

    describe('findSpot rejection of invalid table inputs', () => {
      it('returns null when table has invalid kind "zzz"', () => {
        const table: any = { ...sampleTable1, kind: 'zzz' };
        expect(findSpot(table, sampleSpace1, [sampleSpace1], [])).toBeNull();
      });

      it('returns null when table has width: -0.8', () => {
        const table: FloorTable = { ...sampleTable1, width: -0.8 };
        expect(findSpot(table, sampleSpace1, [sampleSpace1], [])).toBeNull();
      });

      it('returns null when table has width: 99 (exceeds maxSize)', () => {
        const table: FloorTable = { ...sampleTable1, width: 99 };
        expect(findSpot(table, sampleSpace1, [sampleSpace1], [])).toBeNull();
      });

      it('returns null when table has seats: 99 (exceeds seatCap)', () => {
        const table: FloorTable = { ...sampleTable1, seats: 99 };
        expect(findSpot(table, sampleSpace1, [sampleSpace1], [])).toBeNull();
      });

      it('returns null when table has rotation: NaN', () => {
        const table: FloorTable = { ...sampleTable1, rotation: NaN };
        expect(findSpot(table, sampleSpace1, [sampleSpace1], [])).toBeNull();
      });

      it('returns null when table has x: NaN', () => {
        const table: FloorTable = { ...sampleTable1, x: NaN };
        expect(findSpot(table, sampleSpace1, [sampleSpace1], [])).toBeNull();
      });
    });
  });

  describe('checkSpace demo parity and checkSpaceMeasures (U7 / F4)', () => {
    const spaceToResize: FloorSpace = {
      id: 'sp-resizable',
      name: 'Espacio Redimensionable',
      polygon: [
        [2, 2],
        [6, 2],
        [6, 6],
        [2, 6],
      ],
    };

    it('F4 exact probe: drawn space of 1.2 x 3 m (3.6 m² >= 2 m²) returns null in checkSpace', () => {
      const drawnNarrow: Polygon = [
        [0, 0],
        [1.2, 0],
        [1.2, 3],
        [0, 3],
      ];
      expect(checkSpace(drawnNarrow)).toBeNull();
    });

    it('drawn space of 1 x 1 m (1 m² < 2 m²) returns SPACE_TOO_SMALL in checkSpace', () => {
      const drawnTiny: Polygon = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      expect(checkSpace(drawnTiny)).toEqual({
        code: 'SPACE_TOO_SMALL',
        spaceId: null,
        areaM2: 1,
        minAreaM2: 2,
      });
    });

    it('resizing a space to 1.2 m side with resizeSpacePolygon(spaceToResize, 1.2, 4.0) returns SPACE_SIDE_TOO_SHORT and polygon: null', () => {
      const res = resizeSpacePolygon(spaceToResize, 1.2, 4.0);
      expect(res.polygon).toBeNull();
      expect(res.error).toEqual({
        code: 'SPACE_SIDE_TOO_SHORT',
        spaceId: spaceToResize.id,
        width: 1.2,
        depth: 4.0,
        minSideM: 1.5,
      });
    });

    describe('checkSpaceMeasures(width, depth, limits, spaceId)', () => {
      it('returns SPACE_SIDE_TOO_SHORT for (1.2, 3.0) and (3.0, 1.2)', () => {
        expect(checkSpaceMeasures(1.2, 3.0)).toEqual({
          code: 'SPACE_SIDE_TOO_SHORT',
          spaceId: null,
          width: 1.2,
          depth: 3.0,
          minSideM: 1.5,
        });
        expect(checkSpaceMeasures(3.0, 1.2, undefined, 'sp-m1')).toEqual({
          code: 'SPACE_SIDE_TOO_SHORT',
          spaceId: 'sp-m1',
          width: 3.0,
          depth: 1.2,
          minSideM: 1.5,
        });
      });

      it('returns SPACE_OUT_OF_BOUNDS when width or depth exceeds limits.width or limits.height', () => {
        expect(checkSpaceMeasures(20, 4.0)).toEqual({
          code: 'SPACE_OUT_OF_BOUNDS',
          spaceId: null,
          maxWidth: DEFAULT_FLOOR_LIMITS.width,
          maxHeight: DEFAULT_FLOOR_LIMITS.height,
          bbox: { x0: 0, y0: 0, x1: 20, y1: 4.0, w: 20, h: 4.0 },
        });
        expect(checkSpaceMeasures(4.0, 12.0, undefined, 'sp-oob')).toEqual({
          code: 'SPACE_OUT_OF_BOUNDS',
          spaceId: 'sp-oob',
          maxWidth: DEFAULT_FLOOR_LIMITS.width,
          maxHeight: DEFAULT_FLOOR_LIMITS.height,
          bbox: { x0: 0, y0: 0, x1: 4.0, y1: 12.0, w: 4.0, h: 12.0 },
        });
      });

      it('returns SPACE_INVALID_POLYGON (NON_FINITE / DEGENERATE) for NaN, Infinity, 0, or negative values', () => {
        expect(checkSpaceMeasures(NaN, 3.0)).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: null,
          reason: 'NON_FINITE',
        });
        expect(checkSpaceMeasures(3.0, Infinity, undefined, 'sp-inf')).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: 'sp-inf',
          reason: 'NON_FINITE',
        });
        expect(checkSpaceMeasures(0, 3.0)).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: null,
          reason: 'DEGENERATE',
        });
        expect(checkSpaceMeasures(3.0, -2.0, undefined, 'sp-neg')).toEqual({
          code: 'SPACE_INVALID_POLYGON',
          spaceId: 'sp-neg',
          reason: 'DEGENERATE',
        });
      });

      it('returns SPACE_TOO_SMALL when width * depth < limits.minAreaM2 even if sides >= minSideM', () => {
        const res = checkSpaceMeasures(1.2, 1.2, { minSideM: 1.0, minAreaM2: 2.0 }, 'sp-small');
        expect(res).toEqual({
          code: 'SPACE_TOO_SMALL',
          spaceId: 'sp-small',
          areaM2: 1.2 * 1.2,
          minAreaM2: 2.0,
        });
      });

      it('returns null for valid measures like (3.0, 4.0) or (1.5, 1.5)', () => {
        expect(checkSpaceMeasures(3.0, 4.0)).toBeNull();
        expect(checkSpaceMeasures(1.5, 1.5)).toBeNull();
      });
    });
  });
});
