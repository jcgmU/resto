import React from 'react';
import { Button } from '../bento/Button';
import { Modal } from './Modal';

export interface ModalConfirmValue {
  label: string;
  value: string;
}

export interface ModalConfirmProps {
  open: boolean;
  title: string;
  current: ModalConfirmValue;
  proposed: ModalConfirmValue;
  impacts?: ModalConfirmValue[];
  onApprove: () => void;
  onReject: () => void;
  onReview?: () => void;
  /** Cierre por Esc / backdrop. Si no se da, se usa onReject. */
  onClose?: () => void;
  approveLabel?: string;
  rejectLabel?: string;
  reviewLabel?: string;
}

export function ModalConfirm({
  open,
  title,
  current,
  proposed,
  impacts = [],
  onApprove,
  onReject,
  onReview,
  onClose,
  approveLabel = 'Confirmar',
  rejectLabel = 'Cancelar',
  reviewLabel = 'Revisar',
}: ModalConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose ?? onReject}
      maxWidth="480px"
      footer={
        <>
          <Button variant="danger" onClick={onReject}>
            {rejectLabel}
          </Button>
          {onReview ? (
            <Button variant="secondary" onClick={onReview}>
              {reviewLabel}
            </Button>
          ) : null}
          <Button variant="primary" onClick={onApprove}>
            {approveLabel}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {[current, proposed].map((item, i) => (
          <div
            key={item.label}
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--bento-inner-radius)',
              border: '1px solid var(--bento-border)',
              background: i === 1 ? 'var(--bento-page-bg)' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--bento-text-muted)' }}>
              {item.label}
            </span>
            <span
              style={{
                fontFamily: 'var(--bento-font-heading)',
                fontWeight: 700,
                fontSize: '24px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
      {impacts.length > 0 ? (
        <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
          {impacts.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderTop: '1px solid var(--bento-border)',
                fontSize: '14px',
              }}
            >
              <dt style={{ color: 'var(--bento-text-muted)' }}>{row.label}</dt>
              <dd style={{ margin: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Modal>
  );
}
