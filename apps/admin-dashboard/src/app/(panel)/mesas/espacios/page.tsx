"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BentoCard, Button, FeatureGuard, Proximamente } from '@packages/ui-components';
import { ZoneDTO, zoneToFloorSpace, floorplan } from '@packages/shared-types';
import { fetchZones, updateZone } from '../../../../lib/api/tables';

type Polygon = floorplan.Polygon;

const LIMITS = floorplan.DEFAULT_FLOOR_LIMITS;
const STEP = LIMITS.gridStepM;
const MIN_VERTICES = 3;
const VERTEX_RADIUS_M = 0.16;
const FOCUS_RING_RADIUS_M = 0.26;
const VIEW_MARGIN_M = 0.3;
const VIEW_WIDTH_M = LIMITS.width + 2 * VIEW_MARGIN_M;
const VIEW_HEIGHT_M = LIMITS.height + 2 * VIEW_MARGIN_M;

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function snap(value: number): number {
  return Number((Math.round(value / STEP) * STEP).toFixed(4));
}

function sameShape(a: Polygon | undefined, b: Polygon | undefined): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);
}

function messageFor(code: string | undefined, fallback: string, otherName?: string): string {
  switch (code) {
    case 'SPACE_INVALID_POLYGON':
      return 'El espacio necesita al menos 3 vértices que formen un área.';
    case 'SPACE_OUT_OF_BOUNDS':
      return `El espacio queda fuera de los límites del local (${LIMITS.width.toFixed(1)} x ${LIMITS.height.toFixed(1)} m).`;
    case 'SPACE_TOO_SMALL':
      return `El espacio es demasiado pequeño: el área mínima es ${LIMITS.minAreaM2} m².`;
    case 'SPACE_SELF_INTERSECTS':
      return 'Los lados del espacio se cruzan entre sí.';
    case 'SPACE_OVERLAP':
      return otherName ? `El espacio se solapa con "${otherName}".` : 'El espacio se solapa con otro espacio.';
    case 'SPACE_CONTENT_OUTSIDE':
      return 'Hay mesas que quedarían fuera del espacio.';
    default:
      return fallback;
  }
}

function initialRectangle(others: floorplan.FloorSpace[], selfId: string): Polygon {
  const w = 2;
  const h = 2;
  for (let y = 0; y + h <= LIMITS.height; y += 0.5) {
    for (let x = 0; x + w <= LIMITS.width; x += 0.5) {
      const rect: Polygon = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
      if (!floorplan.checkSpace(rect, others, undefined, selfId)) return rect;
    }
  }
  return [[0, 0], [w, 0], [w, h], [0, h]];
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

function SpaceEditor() {
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Polygon>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let active = true;
    fetchZones()
      .then((list) => {
        if (!active) return;
        setZones(list);
        setSelectedId((current) => current ?? list[0]?.id ?? null);
      })
      .catch((err: Error) => {
        if (active) setLoadError(err.message || 'No se pudieron cargar las zonas.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = zones.find((z) => z.id === selectedId) ?? null;
  const polygon: Polygon | null = selected ? drafts[selected.id] ?? selected.polygon ?? null : null;
  const dirty = !!selected && selected.id in drafts && !sameShape(drafts[selected.id], selected.polygon);

  const otherSpaces = useMemo(
    () =>
      zones
        .filter((z) => z.id !== selectedId)
        .map(zoneToFloorSpace)
        .filter((s): s is floorplan.FloorSpace => s !== null),
    [zones, selectedId],
  );

  const validationMessage = useMemo(() => {
    if (!selected || !polygon) return null;
    const err = floorplan.checkSpace(polygon, otherSpaces, undefined, selected.id);
    if (!err) return null;
    const otherName = err.code === 'SPACE_OVERLAP' ? err.otherSpaceName : undefined;
    return messageFor(err.code, 'El espacio no es válido.', otherName);
  }, [selected, polygon, otherSpaces]);

  const edit = useCallback(
    (fn: (current: Polygon) => Polygon) => {
      if (!selected) return;
      const id = selected.id;
      const base = selected.polygon;
      setServerError(null);
      setSavedNotice(null);
      setDrafts((prev) => {
        const current = prev[id] ?? base;
        return current ? { ...prev, [id]: fn(current) } : prev;
      });
    },
    [selected],
  );

  const moveVertex = (index: number, x: number, y: number) =>
    edit((poly) => poly.map((p, i) => (i === index ? [snap(x), snap(y)] : p)));

  const nudgeVertex = (index: number, dx: number, dy: number) =>
    edit((poly) => poly.map((p, i) => (i === index ? [snap(p[0] + dx * STEP), snap(p[1] + dy * STEP)] : p)));

  const insertAfter = (index: number) =>
    edit((poly) => {
      const a = poly[index];
      const b = poly[(index + 1) % poly.length];
      const mid: [number, number] = [snap((a[0] + b[0]) / 2), snap((a[1] + b[1]) / 2)];
      return [...poly.slice(0, index + 1), mid, ...poly.slice(index + 1)];
    });

  const removeVertex = (index: number) =>
    edit((poly) => (poly.length <= MIN_VERTICES ? poly : poly.filter((_, i) => i !== index)));

  const onVertexKeyDown = (index: number, e: React.KeyboardEvent) => {
    const delta = ARROW_DELTAS[e.key];
    if (delta) {
      e.preventDefault();
      nudgeVertex(index, delta[0], delta[1]);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeVertex(index);
    } else if (e.key === 'Enter' || e.key === 'Insert') {
      e.preventDefault();
      insertAfter(index);
    }
  };

  const pointerToMeters = (e: React.PointerEvent): [number, number] | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return [
      ((e.clientX - rect.left) / rect.width) * VIEW_WIDTH_M - VIEW_MARGIN_M,
      ((e.clientY - rect.top) / rect.height) * VIEW_HEIGHT_M - VIEW_MARGIN_M,
    ];
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIndex === null) return;
    const pos = pointerToMeters(e);
    if (pos) moveVertex(dragIndex, pos[0], pos[1]);
  };

  const createSpace = () => {
    if (!selected) return;
    const id = selected.id;
    setServerError(null);
    setDrafts((prev) => ({ ...prev, [id]: initialRectangle(otherSpaces, id) }));
  };

  const discard = () => {
    if (!selected) return;
    const id = selected.id;
    setServerError(null);
    setSavedNotice(null);
    setDrafts((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const save = async () => {
    if (!selected || !polygon || validationMessage) return;
    const id = selected.id;
    setSaving(true);
    setServerError(null);
    try {
      const updated = await updateZone(id, { polygon });
      setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...updated, polygon } : z)));
      setDrafts((prev) => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
      setSavedNotice('Espacio guardado.');
    } catch (err) {
      const e = err as { status?: number; code?: string; message?: string };
      setServerError(messageFor(e.code, e.message || 'No se pudo guardar el espacio.'));
    } finally {
      setSaving(false);
    }
  };

  const alertMessage = validationMessage ?? serverError;
  const transition = reducedMotion ? 'none' : 'fill 120ms ease-out, stroke 120ms ease-out';

  return (
    <div style={{ padding: 'var(--bento-card-padding)', display: 'flex', flexDirection: 'column', gap: 'var(--bento-grid-gap)' }}>
      <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 400, color: 'var(--bento-text)' }}>Espacios del local</h1>

      {loading && <p style={{ color: 'var(--bento-text-muted)' }}>Cargando zonas…</p>}
      {loadError && (
        <p role="alert" style={{ color: 'var(--bento-status-occupied-text)' }}>
          {loadError}
        </p>
      )}

      {!loading && !loadError && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) 1fr', gap: 'var(--bento-grid-gap)', alignItems: 'start' }}>
          <BentoCard>
            <nav aria-label="Zonas" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {zones.map((z) => (
                <Button
                  key={z.id}
                  variant={z.id === selectedId ? 'primary' : 'secondary'}
                  aria-pressed={z.id === selectedId}
                  onClick={() => {
                    setSelectedId(z.id);
                    setServerError(null);
                    setSavedNotice(null);
                  }}
                  style={{ justifyContent: 'flex-start' }}
                >
                  {z.name}
                </Button>
              ))}
              {zones.length === 0 && <p style={{ color: 'var(--bento-text-muted)', margin: 0 }}>No hay zonas creadas.</p>}
            </nav>
          </BentoCard>

          <BentoCard>
            {!selected && <p style={{ color: 'var(--bento-text-muted)', margin: 0 }}>Selecciona una zona.</p>}

            {selected && !polygon && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                <p style={{ margin: 0, color: 'var(--bento-text-muted)' }}>Esta zona todavía no tiene espacio en el plano.</p>
                <Button onClick={createSpace}>Crear espacio</Button>
              </div>
            )}

            {selected && polygon && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <style>{'.space-canvas { touch-action: none; }'}</style>
                <svg
                  ref={svgRef}
                  className="space-canvas"
                  role="group"
                  aria-label={`Plano del local, espacio ${selected.name}`}
                  viewBox={`${-VIEW_MARGIN_M} ${-VIEW_MARGIN_M} ${VIEW_WIDTH_M} ${VIEW_HEIGHT_M}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    background: 'var(--bento-card-bg-solid)',
                    borderRadius: 'var(--bento-inner-radius)',
                  }}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => setDragIndex(null)}
                  onPointerLeave={() => setDragIndex(null)}
                >
                  <defs>
                    <pattern id="grid-minor" width={STEP} height={STEP} patternUnits="userSpaceOnUse">
                      <path d={`M ${STEP} 0 L 0 0 0 ${STEP}`} fill="none" stroke="var(--bento-border)" strokeWidth={0.005} />
                    </pattern>
                    <pattern id="grid-major" width={1} height={1} patternUnits="userSpaceOnUse">
                      <rect width={1} height={1} fill="url(#grid-minor)" />
                      <path d="M 1 0 L 0 0 0 1" fill="none" stroke="var(--bento-text-muted)" strokeOpacity={0.35} strokeWidth={0.015} />
                    </pattern>
                  </defs>
                  <rect width={LIMITS.width} height={LIMITS.height} fill="url(#grid-major)" />

                  {otherSpaces.map((s) => (
                    <g key={s.id} aria-hidden="true">
                      <polygon
                        points={s.polygon.map((p) => p.join(',')).join(' ')}
                        fill="var(--bento-status-neutral-bg)"
                        stroke="var(--bento-text-muted)"
                        strokeWidth={0.04}
                      />
                      <text
                        x={floorplan.centroid(s.polygon)[0]}
                        y={floorplan.centroid(s.polygon)[1]}
                        textAnchor="middle"
                        fontSize={0.4}
                        fill="var(--bento-text-muted)"
                      >
                        {s.name}
                      </text>
                    </g>
                  ))}

                  <polygon
                    points={polygon.map((p) => p.join(',')).join(' ')}
                    fill={validationMessage ? 'var(--bento-status-occupied-bg)' : 'var(--bento-status-available-bg)'}
                    stroke={validationMessage ? 'var(--bento-status-occupied-text)' : 'var(--bento-primary)'}
                    strokeWidth={0.06}
                    style={{ transition }}
                  />

                  {polygon.map((a, i) => {
                    const b = polygon[(i + 1) % polygon.length];
                    return (
                      <line
                        key={`edge-${i}`}
                        data-testid="space-edge"
                        x1={a[0]}
                        y1={a[1]}
                        x2={b[0]}
                        y2={b[1]}
                        stroke="transparent"
                        strokeWidth={0.3}
                        style={{ cursor: 'copy' }}
                        onDoubleClick={() => insertAfter(i)}
                      />
                    );
                  })}

                  {polygon.map((p, i) => (
                    <React.Fragment key={`vertex-${i}`}>
                    {activeIndex === i && (
                      <circle
                        data-testid="space-vertex-focus"
                        cx={p[0]}
                        cy={p[1]}
                        r={FOCUS_RING_RADIUS_M}
                        fill="none"
                        stroke="var(--bento-primary)"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                      />
                    )}
                    <circle
                      data-testid="space-vertex"
                      data-x={String(p[0])}
                      data-y={String(p[1])}
                      role="button"
                      tabIndex={0}
                      aria-label={`Vértice ${i + 1}, x ${p[0]} m, y ${p[1]} m`}
                      cx={p[0]}
                      cy={p[1]}
                      r={VERTEX_RADIUS_M}
                      fill="var(--bento-card-bg-solid)"
                      stroke="var(--bento-primary)"
                      strokeWidth={0.05}
                      style={{ outline: 'none', cursor: dragIndex === i ? 'grabbing' : 'grab', transition: reducedMotion ? 'none' : 'stroke-width 120ms ease-out' }}
                      onFocus={() => setActiveIndex(i)}
                      onBlur={() => setActiveIndex((current) => (current === i ? null : current))}
                      onKeyDown={(e) => onVertexKeyDown(i, e)}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setDragIndex(i);
                        setActiveIndex(i);
                        (e.target as Element).setPointerCapture?.(e.pointerId);
                      }}
                    />
                    </React.Fragment>
                  ))}
                </svg>

                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--bento-text-muted)' }}>
                  Arrastra los vértices o usa las flechas (paso de {STEP} m). Doble clic en una arista o Enter añade un vértice; Supr lo quita (mínimo {MIN_VERTICES}).
                </p>

                {alertMessage && (
                  <div role="alert" style={{ color: 'var(--bento-status-occupied-text)', fontSize: '0.875rem' }}>
                    {alertMessage}
                  </div>
                )}
                {savedNotice && !alertMessage && (
                  <div role="status" style={{ color: 'var(--bento-status-available-text)', fontSize: '0.875rem' }}>
                    {savedNotice}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button onClick={save} disabled={!dirty || !!validationMessage || saving} loading={saving}>
                    Guardar
                  </Button>
                  <Button variant="secondary" onClick={discard} disabled={!dirty || saving}>
                    Descartar
                  </Button>
                </div>
              </div>
            )}
          </BentoCard>
        </div>
      )}
    </div>
  );
}

export default function EspaciosPage() {
  return (
    <FeatureGuard flag="space-editor" fallback={<Proximamente featureName="Editor de espacios" />}>
      <SpaceEditor />
    </FeatureGuard>
  );
}
