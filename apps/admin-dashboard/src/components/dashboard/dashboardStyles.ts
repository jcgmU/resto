export const DASHBOARD_CSS = `
.dash {
  --d-ink: #1c1e18;
  --d-muted: #62665a;
  --d-line: rgba(28, 30, 24, 0.1);
  --d-glass: rgba(255, 255, 255, 0.58);
  --d-glass-edge: rgba(255, 255, 255, 0.75);
  --d-lima: #d3e57a;
  --d-lima-ink: #2d3a05;
  --d-amber: #e3a72f;
  --d-amber-soft: #f7ecd0;
  --d-amber-ink: #6a4a05;
  position: relative;
  isolation: isolate;
  border-radius: 32px;
  padding: 20px;
  color: var(--d-ink);
  background-color: #e7e8e1;
  background-image:
    radial-gradient(60% 50% at 8% 0%, rgba(150, 168, 140, 0.32), transparent 70%),
    radial-gradient(55% 45% at 100% 100%, rgba(212, 196, 164, 0.34), transparent 70%);
}
.dash-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.glass {
  min-width: 0;
  padding: 20px;
  border-radius: 24px;
  background: var(--d-glass);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  border: 1px solid var(--d-glass-edge);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 12px 28px -16px rgba(40, 46, 30, 0.22);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: rgba(250, 250, 246, 0.92); }
}
.glass h2 {
  margin: 0;
  font-family: var(--bento-font-heading);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.glass-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.span-2 { grid-column: span 2; }
.row-2 { grid-row: span 2; }
.tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  background: rgba(28, 30, 24, 0.07);
  color: var(--d-muted);
}
.tag-warn { background: var(--d-amber-soft); color: var(--d-amber-ink); }
.tag-lima { background: var(--d-lima); color: var(--d-lima-ink); }

.rev-figure {
  font-family: var(--bento-font-heading);
  font-weight: 700;
  font-size: clamp(28px, 3.4vw, 40px);
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.rev-meta { margin: 6px 0 0; font-size: 13px; color: var(--d-muted); }
.rev-chart { width: 100%; height: auto; display: block; margin-top: 16px; }
.rev-chart text { font-family: var(--bento-font-body); font-size: 11px; fill: var(--d-muted); }
.rev-chart .bar { fill: rgba(28, 30, 24, 0.16); }
.rev-chart .bar.today { fill: var(--d-ink); }
.rev-chart .grid { stroke: var(--d-line); stroke-width: 1; }

.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0 0 14px; padding: 0; list-style: none; font-size: 12px; color: var(--d-muted); }
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.swatch { width: 11px; height: 11px; border-radius: 4px; border: 1.5px solid var(--d-line); display: inline-block; }
.swatch.ocupada { background: var(--d-ink); border-color: var(--d-ink); }
.swatch.cuenta { background: var(--d-lima); border-color: var(--d-lima); }
.swatch.mesero { background: var(--d-amber); border-color: var(--d-amber); }

.floor { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
.tbl {
  display: flex; flex-direction: column; justify-content: space-between; gap: 10px;
  min-height: 84px; padding: 12px 14px; border-radius: 18px;
  border: 1.5px solid var(--d-line); background: rgba(255, 255, 255, 0.5);
  color: var(--d-ink);
}
.tbl b { font-family: var(--bento-font-heading); font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
.tbl small { font-size: 12px; font-weight: 500; color: var(--d-muted); }
.tbl.ocupada { background: var(--d-ink); border-color: var(--d-ink); color: #f1f2ea; }
.tbl.ocupada small { color: #c4c7b9; }
.tbl.cuenta { background: var(--d-lima); border-color: var(--d-lima); color: var(--d-lima-ink); }
.tbl.cuenta small { color: var(--d-lima-ink); }
.tbl.mesero { background: var(--d-amber-soft); border-color: var(--d-amber); color: var(--d-amber-ink); }
.tbl.mesero small { color: var(--d-amber-ink); }

.kpi-label { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--d-muted); }

.calls { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.calls li {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 14px; border-radius: 16px; background: rgba(255, 255, 255, 0.55);
}
.calls b { display: block; font-size: 14px; }
.calls span.note { display: block; font-size: 13px; color: var(--d-muted); }

.quick { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.quick-item {
  display: flex; flex-direction: column; gap: 4px; justify-content: center;
  min-height: 68px; padding: 12px 14px; border-radius: 16px;
  background: rgba(255, 255, 255, 0.55); border: 1px solid var(--d-line);
  color: var(--d-ink); text-decoration: none; font: inherit; text-align: left;
}
.quick-item b { font-size: 14px; font-weight: 600; }
.quick-item small { font-size: 12px; color: var(--d-muted); }
a.quick-item { cursor: pointer; }
a.quick-item:hover { background: rgba(255, 255, 255, 0.85); border-color: rgba(28, 30, 24, 0.22); }
.quick-item[aria-disabled="true"] { opacity: 0.6; cursor: not-allowed; }
.dash a:focus-visible, .dash button:focus-visible { outline: 2px solid var(--d-ink); outline-offset: 2px; }
.sample-note { margin: 12px 0 0; font-size: 12px; color: var(--d-muted); }
.dash [data-testid="proximamente"] { background: transparent !important; box-shadow: none !important; padding: 0 !important; border: none !important; }

@media (prefers-reduced-motion: no-preference) {
  .tbl, a.quick-item { transition: background-color 0.18s ease-out, border-color 0.18s ease-out; }
}
@media (max-width: 1024px) {
  .dash-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .dash { padding: 12px; border-radius: 24px; }
  .dash-grid { grid-template-columns: minmax(0, 1fr); }
  .span-2 { grid-column: auto; }
  .row-2 { grid-row: auto; }
  .quick { grid-template-columns: minmax(0, 1fr); }
}
`;
