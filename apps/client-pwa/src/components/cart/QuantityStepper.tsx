import { Button } from '@packages/ui-components';
import React, { useState } from 'react';

export interface QuantityStepperProps {
  quantity: number;
  productName: string;
  onIncrease?: () => void;
  onDecrease?: () => void;
  onRemove?: () => void;
}

export function QuantityStepper({
  quantity,
  productName,
  onIncrease,
  onDecrease,
  onRemove,
}: QuantityStepperProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--bento-spacing-sm)',
        }}
      >
        <span
          style={{
            fontSize: '0.85rem',
            color: 'var(--bento-destructive)',
            fontWeight: 600,
          }}
        >
          ¿Eliminar?
        </span>
        <Button
          type="button"
          role="button"
          aria-label={`Confirmar eliminar ${productName}`}
          onClick={() => {
            setIsConfirming(false);
            if (onRemove) {
              onRemove();
            } else if (onDecrease) {
              onDecrease();
            }
          }}
          style={{
            minHeight: 'var(--bento-touch-target)',
            padding: '0 var(--bento-spacing-sm)',
            borderRadius: 'var(--bento-pill-radius)',
            border: '1px solid var(--bento-destructive)',
            backgroundColor: 'var(--bento-destructive)',
            color: 'var(--bento-card-bg)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Confirmar
        </Button>
        <Button
          type="button"
          role="button"
          aria-label={`Cancelar eliminar ${productName}`}
          onClick={() => setIsConfirming(false)}
          style={{
            minHeight: 'var(--bento-touch-target)',
            padding: '0 var(--bento-spacing-sm)',
            borderRadius: 'var(--bento-pill-radius)',
            border: '1px solid var(--bento-card-border, rgba(0, 0, 0, 0.1))',
            backgroundColor: 'transparent',
            color: 'var(--bento-text)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  const handleDecrease = () => {
    if (quantity <= 1 && onRemove) {
      setIsConfirming(true);
    } else {
      onDecrease?.();
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--bento-touch-gap)',
      }}
    >
      <Button
        type="button"
        role="button"
        aria-label={`Reducir cantidad de ${productName}`}
        onClick={handleDecrease}
        style={{
          minHeight: 'var(--bento-touch-target)',
          minWidth: 'var(--bento-touch-target)',
          borderRadius: 'var(--bento-card-radius)',
          border: '1px solid var(--bento-card-border, rgba(0, 0, 0, 0.1))',
          backgroundColor: 'var(--bento-card-bg)',
          color: 'var(--bento-text)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 700,
        }}
      >
        −
      </Button>

      <span
        style={{
          minWidth: 'var(--bento-spacing-md)',
          textAlign: 'center',
          fontWeight: 600,
          color: 'var(--bento-text)',
        }}
      >
        {quantity}
      </span>

      <Button
        type="button"
        role="button"
        aria-label={`Aumentar cantidad de ${productName}`}
        onClick={onIncrease}
        style={{
          minHeight: 'var(--bento-touch-target)',
          minWidth: 'var(--bento-touch-target)',
          borderRadius: 'var(--bento-card-radius)',
          border: '1px solid var(--bento-card-border, rgba(0, 0, 0, 0.1))',
          backgroundColor: 'var(--bento-card-bg)',
          color: 'var(--bento-text)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 700,
        }}
      >
        +
      </Button>
    </div>
  );
}
