import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Button } from '../bento/Button';
import { BottomSheet } from './BottomSheet';
import { useModalLock } from './useModalLock';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryTone?: 'primary' | 'danger';
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryLoadingLabel?: string;
  cancelLabel?: string;
  /** Si se da, el contenido y las acciones van dentro de un <form> y la acción primaria es submit. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  /** Sobrescribe el ancho máximo de bento-modal__panel (560px por defecto). */
  maxWidth?: string;
  /** Reemplaza el pie por defecto (Cancelar + acción primaria). */
  footer?: React.ReactNode;
  /** Los inspectores de consulta pueden dejar interactuar con la pantalla. */
  scrim?: boolean;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const openDialogs: symbol[] = [];

export function Modal({
  open,
  title,
  onClose,
  children,
  primaryLabel,
  onPrimary,
  primaryTone = 'primary',
  primaryDisabled,
  primaryLoading,
  primaryLoadingLabel,
  cancelLabel = 'Cancelar',
  onSubmit,
  maxWidth,
  footer,
  scrim = true,
}: ModalProps) {
  const titleId = useId();
  const reducedMotion = useReducedMotion();
  const [isSheet, setIsSheet] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1024px) and (pointer: coarse)').matches);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const getBackdrop = useRef(() => backdropRef.current).current;
  const stackId = useRef(Symbol('modal'));
  onCloseRef.current = onClose;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(max-width: 1024px) and (pointer: coarse)');
    const update = () => setIsSheet(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (open) previousFocus.current = document.activeElement as HTMLElement | null;
  }, [open]);

  // Declarado antes del efecto de foco: su cleanup libera el inert antes de devolver el foco.
  useModalLock(open && scrim, getBackdrop);

  useEffect(() => {
    if (!open) return undefined;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialogRef.current)?.focus();
    return () => {
      previousFocus.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const id = stackId.current;
    openDialogs.push(id);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openDialogs[openDialogs.length - 1] === id) {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = openDialogs.indexOf(id);
      if (index >= 0) openDialogs.splice(index, 1);
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!scrim || e.key !== 'Tab') return;
    const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === firstNode || active === dialogRef.current)) {
      e.preventDefault();
      lastNode.focus();
    } else if (!e.shiftKey && active === lastNode) {
      e.preventDefault();
      firstNode.focus();
    }
  };

  const defaultFooter = (
    <>
      <Button variant="secondary" onClick={() => onCloseRef.current()}>
        {cancelLabel}
      </Button>
      {primaryLabel ? (
        <Button
          variant={primaryTone === 'danger' ? 'danger' : 'primary'}
          type={onSubmit ? 'submit' : 'button'}
          onClick={onSubmit ? undefined : onPrimary}
          disabled={primaryDisabled}
          loading={primaryLoading}
          loadingLabel={primaryLoadingLabel}
        >
          {primaryLabel}
        </Button>
      ) : null}
    </>
  );

  const content = (
    <>
      <h2 id={titleId} className="bento-modal__title">
        {title}
      </h2>
      {children ? <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>{children}</div> : null}
      <div className="bento-modal__footer">{footer ?? defaultFooter}</div>
    </>
  );

  const panelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' };

  const panelContent = onSubmit ? (
    <form onSubmit={onSubmit} style={panelStyle}>{content}</form>
  ) : (
    <div style={panelStyle}>{content}</div>
  );
  const panelProps = {
    role: 'dialog',
    'aria-modal': scrim,
    'aria-labelledby': titleId,
    'data-component': 'modal',
    className: 'bento-modal__panel',
    tabIndex: -1,
    onKeyDown: handleKeyDown,
    style: { maxWidth, pointerEvents: 'auto' as const },
  };

  return createPortal(
    <AnimatePresence>
    {open && <motion.div
      key="modal-backdrop"
      ref={backdropRef}
      initial={false}
      exit={isSheet && !reducedMotion ? { opacity: 0 } : undefined}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      data-testid="modal-backdrop"
      className={`bento-modal__backdrop${isSheet ? ' bento-modal__backdrop--sheet' : ''}${scrim ? '' : ' bento-modal__backdrop--nonmodal'}`}
      style={scrim ? undefined : { pointerEvents: 'none' }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if (scrim && e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      {isSheet ? (
          <BottomSheet {...panelProps} data-mode="sheet" ref={dialogRef} onDismiss={() => onCloseRef.current()}>{panelContent}</BottomSheet>
      ) : (
        <div {...panelProps} data-mode="modal" ref={dialogRef}>{panelContent}</div>
      )}
    </motion.div>}
    </AnimatePresence>,
    document.body,
  );
}
