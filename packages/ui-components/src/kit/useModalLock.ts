import { useEffect } from 'react';

interface ScrimEntry {
  id: symbol;
  backdrop: () => HTMLElement | null;
}

interface SavedScroll {
  htmlOverflow: string;
  bodyOverflow: string;
  bodyPaddingRight: string;
}

const scrimStack: ScrimEntry[] = [];
const inertedByUs = new Set<Element>();
let savedScroll: SavedScroll | null = null;

function lockScroll() {
  if (savedScroll) return;
  const html = document.documentElement;
  const body = document.body;
  savedScroll = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
  };
  const scrollbar = Math.max(0, window.innerWidth - html.clientWidth);
  if (scrollbar > 0) {
    const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + scrollbar}px`;
  }
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
}

function restoreStyle(el: HTMLElement, property: string, value: string) {
  if (value) el.style.setProperty(property, value);
  else el.style.removeProperty(property);
}

function unlockScroll() {
  if (!savedScroll) return;
  restoreStyle(document.documentElement, 'overflow', savedScroll.htmlOverflow);
  restoreStyle(document.body, 'overflow', savedScroll.bodyOverflow);
  restoreStyle(document.body, 'padding-right', savedScroll.bodyPaddingRight);
  savedScroll = null;
}

/** Solo el modal con scrim más reciente queda interactivo; el resto de hijos de <body> se marca inert. */
function applyInert() {
  const top = scrimStack[scrimStack.length - 1]?.backdrop() ?? null;
  for (const child of Array.from(document.body.children)) {
    if (!top || child === top) {
      if (inertedByUs.has(child)) {
        child.removeAttribute('inert');
        inertedByUs.delete(child);
      }
    } else if (!child.hasAttribute('inert')) {
      child.setAttribute('inert', '');
      inertedByUs.add(child);
    }
  }
  if (!top) {
    for (const el of Array.from(inertedByUs)) {
      el.removeAttribute('inert');
      inertedByUs.delete(el);
    }
  }
}

/** React 18 no acepta `inert` como prop: se aplica por DOM, con pila para modales anidados. */
export function useModalLock(active: boolean, backdrop: () => HTMLElement | null) {
  useEffect(() => {
    if (!active) return undefined;
    const id = Symbol('modal-lock');
    scrimStack.push({ id, backdrop });
    lockScroll();
    applyInert();
    return () => {
      const index = scrimStack.findIndex((entry) => entry.id === id);
      if (index >= 0) scrimStack.splice(index, 1);
      applyInert();
      if (scrimStack.length === 0) unlockScroll();
    };
  }, [active, backdrop]);
}
