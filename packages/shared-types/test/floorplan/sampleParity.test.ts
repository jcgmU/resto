import { floorplan } from '../../src';
import * as root from '../../src';
import * as directFloorplan from '../../src/floorplan';
import {
  FloorSpace,
  FloorTable,
  TABLE_KINDS,
  polyArea,
  seatCap,
  spaceOfTable,
  checkSpace,
  checkSpaceContent,
  checkTable,
  resizeSpacePolygon,
  findSpot,
} from '../../src/floorplan';

const sampleSpaces: FloorSpace[] = [
  {
    id: 'e1',
    name: 'Salón',
    color: '#e8b86d',
    polygon: [
      [0.6, 0.6],
      [9, 0.6],
      [9, 6],
      [6.6, 6],
      [6.6, 9.6],
      [0.6, 9.6],
    ],
  },
  {
    id: 'e2',
    name: 'Terraza',
    color: '#8fb996',
    polygon: [
      [10.2, 0.6],
      [16, 0.6],
      [16, 6],
      [10.2, 6],
    ],
  },
];

const sampleTables: FloorTable[] = [
  {
    id: 'e3',
    label: 'Barra',
    kind: 'bar',
    x: 3,
    y: 1.5,
    width: TABLE_KINDS.bar.width,
    depth: TABLE_KINDS.bar.depth,
    rotation: 0,
    seats: TABLE_KINDS.bar.seats,
  },
  {
    id: 'e4',
    label: 'Mesa 1',
    kind: 'square',
    x: 1.8,
    y: 3.6,
    width: TABLE_KINDS.square.width,
    depth: TABLE_KINDS.square.depth,
    rotation: 0,
    seats: TABLE_KINDS.square.seats,
  },
  {
    id: 'e5',
    label: 'Mesa 2',
    kind: 'square',
    x: 3.6,
    y: 3.6,
    width: TABLE_KINDS.square.width,
    depth: TABLE_KINDS.square.depth,
    rotation: 0,
    seats: TABLE_KINDS.square.seats,
  },
  {
    id: 'e6',
    label: 'Mesa 3',
    kind: 'square',
    x: 5.4,
    y: 3.6,
    width: TABLE_KINDS.square.width,
    depth: TABLE_KINDS.square.depth,
    rotation: 0,
    seats: TABLE_KINDS.square.seats,
  },
  {
    id: 'e7',
    label: 'Mesa 4',
    kind: 'round',
    x: 7.8,
    y: 2.4,
    width: TABLE_KINDS.round.width,
    depth: TABLE_KINDS.round.depth,
    rotation: 0,
    seats: TABLE_KINDS.round.seats,
  },
  {
    id: 'e8',
    label: 'Mesa 5',
    kind: 'oval',
    x: 7.2,
    y: 4.5,
    width: TABLE_KINDS.oval.width,
    depth: TABLE_KINDS.oval.depth,
    rotation: 0,
    seats: TABLE_KINDS.oval.seats,
  },
  {
    id: 'e9',
    label: 'Mesa 6',
    kind: 'rect',
    x: 3,
    y: 7.8,
    width: TABLE_KINDS.rect.width,
    depth: TABLE_KINDS.rect.depth,
    rotation: 0,
    seats: TABLE_KINDS.rect.seats,
  },
  {
    id: 'e10',
    label: 'Mesa 7',
    kind: 'hex',
    x: 11.4,
    y: 2.4,
    width: TABLE_KINDS.hex.width,
    depth: TABLE_KINDS.hex.depth,
    rotation: 0,
    seats: TABLE_KINDS.hex.seats,
  },
  {
    id: 'e11',
    label: 'Mesa 8',
    kind: 'round',
    x: 13.8,
    y: 2.4,
    width: TABLE_KINDS.round.width,
    depth: TABLE_KINDS.round.depth,
    rotation: 0,
    seats: TABLE_KINDS.round.seats,
  },
  {
    id: 'e12',
    label: 'Mesa 9',
    kind: 'half',
    x: 11.4,
    y: 4.8,
    width: TABLE_KINDS.half.width,
    depth: TABLE_KINDS.half.depth,
    rotation: 0,
    seats: TABLE_KINDS.half.seats,
  },
  {
    id: 'e13',
    label: 'Mesa 10',
    kind: 'round',
    x: 13.8,
    y: 4.5,
    width: TABLE_KINDS.round.width,
    depth: TABLE_KINDS.round.depth,
    rotation: 0,
    seats: TABLE_KINDS.round.seats,
  },
];

describe('floorplan barrel exports and loadSample() parity', () => {
  it('re-exports all public symbols of geometry, shapes, and rules from floorplan namespace and NOT on root index', () => {
    expect(root.floorplan).toBeDefined();
    expect(floorplan).toBe(root.floorplan);

    const expectedRuntimeSymbols = [
      // geometry
      'EPS_M',
      'centroid',
      'bbox',
      'polyArea',
      'inPoly',
      'segDist',
      'onBoundary',
      'insideOrOn',
      'strictlyInside',
      'orient',
      'segsCross',
      'polysCross',
      'selfIntersects',
      'satOverlap',
      'containedIn',
      // shapes
      'SEAT_M',
      'MIN_TABLE_SIZE_M',
      'TABLE_KINDS',
      'ellPerim',
      'localPoly',
      'shapePoly',
      'seatCap',
      // rules
      'DEFAULT_FLOOR_LIMITS',
      'spaceOfTable',
      'footprintFits',
      'checkTable',
      'validateSpacePolygon',
      'checkSpace',
      'checkSpaceMeasures',
      'checkSpaceContent',
      'resizeSpacePolygon',
      'findSpot',
    ] as const;

    for (const sym of expectedRuntimeSymbols) {
      expect((floorplan as any)?.[sym]).toBeDefined();
      expect((floorplan as any)?.[sym]).toBe((directFloorplan as any)[sym]);
      expect((root as any)[sym]).toBeUndefined();
    }

    expect((floorplan as any)?.DEFAULT_FLOOR_BOUNDS).toBeUndefined();
    expect((floorplan as any)?.DEFAULT_GRID_STEP_M).toBeUndefined();
    expect((directFloorplan as any).DEFAULT_FLOOR_BOUNDS).toBeUndefined();
    expect((directFloorplan as any).DEFAULT_GRID_STEP_M).toBeUndefined();
    expect((root as any).DEFAULT_FLOOR_BOUNDS).toBeUndefined();
    expect((root as any).DEFAULT_GRID_STEP_M).toBeUndefined();

    // Specific symbols required by prompt specification
    expect((root as any).bbox).toBeUndefined();
    expect((root as any).orient).toBeUndefined();
    expect((root as any).centroid).toBeUndefined();
    expect((root as any).polyArea).toBeUndefined();
    expect((root as any).inPoly).toBeUndefined();
    expect((root as any).checkSpace).toBeUndefined();
    expect((root as any).checkTable).toBeUndefined();
    expect((root as any).TABLE_KINDS).toBeUndefined();
  });

  it('validates both sample spaces (Salón L-shape and Terraza rectangle) and their exact areas in m²', () => {
    const [salon, terraza] = sampleSpaces;

    // Salón L-shape: (9 - 0.6) * (6 - 0.6) + (6.6 - 0.6) * (9.6 - 6) = 8.4 * 5.4 + 6.0 * 3.6 = 45.36 + 21.6 = 66.96 m²
    expect(polyArea(salon.polygon)).toBeCloseTo(66.96, 10);
    // Terraza rectangle: (16 - 10.2) * (6 - 0.6) = 5.8 * 5.4 = 31.32 m²
    expect(polyArea(terraza.polygon)).toBeCloseTo(31.32, 10);

    for (const sp of sampleSpaces) {
      expect(checkSpace(sp, sampleSpaces)).toBeNull();
      const tablesInSpace = sampleTables.filter((t) => spaceOfTable(t, sampleSpaces)?.id === sp.id);
      expect(checkSpaceContent(sp.polygon, tablesInSpace, sp.id)).toBeNull();
    }
  });

  it('locates all 11 sample tables in their expected space, within seatCap, and passing checkTable', () => {
    const salonExpectedIds = ['e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9'];
    const terrazaExpectedIds = ['e10', 'e11', 'e12', 'e13'];

    for (const table of sampleTables) {
      const sp = spaceOfTable(table, sampleSpaces);
      expect(sp).toBeDefined();
      if (salonExpectedIds.includes(table.id)) {
        expect(sp?.id).toBe('e1');
      } else if (terrazaExpectedIds.includes(table.id)) {
        expect(sp?.id).toBe('e2');
      }

      expect(table.seats).toBeLessThanOrEqual(seatCap(table));
      expect(checkTable(table, sampleSpaces, sampleTables)).toBeNull();
    }
  });

  it('flags SPACE_CONTENT_OUTSIDE when Salón is edited or resized to exclude contained tables (e9 Mesa 6 and e8 Mesa 5)', () => {
    const salon = sampleSpaces[0];
    const salonTables = sampleTables.filter((t) => spaceOfTable(t, sampleSpaces)?.id === salon.id);

    // Moving/cropping Salón bottom leg to y=6 so only Mesa 6 (e9 at y=7.8) falls outside
    const croppedPolygon: [number, number][] = [
      [0.6, 0.6],
      [9, 0.6],
      [9, 6],
      [0.6, 6],
    ];
    expect(checkSpaceContent(croppedPolygon, salonTables, salon.id)).toEqual({
      code: 'SPACE_CONTENT_OUTSIDE',
      spaceId: 'e1',
      tableId: 'e9',
      tableLabel: 'Mesa 6',
    });

    // Scaling Salón depth from 9.0 m to 7.5 m (sy = 5/6):
    // - right-wing notch y=6 moves to 0.6 + 5.4*(5/6) = 5.1 m, keeping Mesa 5 (e8, y in [4.05, 4.95]) inside;
    // - bottom edge y=9.6 moves to 0.6 + 7.5 = 8.1 m, leaving Mesa 6 (e9, y in [7.4, 8.2]) outside.
    const resizedExcludingE9 = resizeSpacePolygon(salon, 8.4, 7.5, {
      spaces: sampleSpaces,
      tables: sampleTables,
    });
    expect(resizedExcludingE9.polygon).toBeNull();
    expect(resizedExcludingE9.error).toEqual({
      code: 'SPACE_CONTENT_OUTSIDE',
      spaceId: 'e1',
      tableId: 'e9',
      tableLabel: 'Mesa 6',
    });

    // Scaling Salón depth from 9.0 m to 5.4 m (sy = 0.6):
    // - right-wing notch y=6 moves to 0.6 + 5.4*0.6 = 3.84 m, leaving Mesa 5 (e8 at x=7.2, y=4.5) outside first.
    const resizedExcludingE8 = resizeSpacePolygon(salon, 8.4, 5.4, {
      spaces: sampleSpaces,
      tables: sampleTables,
    });
    expect(resizedExcludingE8.polygon).toBeNull();
    expect(resizedExcludingE8.error).toEqual({
      code: 'SPACE_CONTENT_OUTSIDE',
      spaceId: 'e1',
      tableId: 'e8',
      tableLabel: 'Mesa 5',
    });
  });

  it('finds a valid spot for a new table in both Salón and Terraza respecting the 11 existing tables', () => {
    const [salon, terraza] = sampleSpaces;
    const newTableTemplate: FloorTable = {
      id: 'e14',
      label: 'Mesa 11',
      kind: 'square',
      x: 0,
      y: 0,
      width: TABLE_KINDS.square.width,
      depth: TABLE_KINDS.square.depth,
      rotation: 0,
      seats: TABLE_KINDS.square.seats,
    };

    const placedInSalon = findSpot(newTableTemplate, salon, sampleSpaces, sampleTables);
    expect(placedInSalon).not.toBeNull();
    expect(spaceOfTable(placedInSalon!, sampleSpaces)?.id).toBe('e1');
    expect(checkTable(placedInSalon!, sampleSpaces, sampleTables)).toBeNull();

    const placedInTerraza = findSpot(newTableTemplate, terraza, sampleSpaces, sampleTables);
    expect(placedInTerraza).not.toBeNull();
    expect(spaceOfTable(placedInTerraza!, sampleSpaces)?.id).toBe('e2');
    expect(checkTable(placedInTerraza!, sampleSpaces, sampleTables)).toBeNull();
  });
});
