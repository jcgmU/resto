import React from 'react';
import { ModifierGroupDTO, formatCOP } from '@packages/shared-types';

export interface ModifierGroupPickerProps {
  group: ModifierGroupDTO;
  selectedOptions?: string[];
  onChange?: (selectedIds: string[]) => void;
}

export function ModifierGroupPicker({
  group,
  selectedOptions = [],
  onChange,
}: ModifierGroupPickerProps) {
  const handleToggle = (optId: string) => {
    const isSelected = selectedOptions.includes(optId);
    if (isSelected) {
      onChange?.(selectedOptions.filter((id) => id !== optId));
    } else {
      if (group.maxSelections && selectedOptions.length >= group.maxSelections) {
        return;
      }
      onChange?.([...selectedOptions, optId]);
    }
  };

  return (
    <fieldset
      style={{
        border: 'none',
        padding: 'var(--bento-spacing-sm) 0',
        margin: 0,
      }}
    >
      <legend
        style={{
          fontWeight: 600,
          color: 'var(--bento-text)',
          marginBottom: 'var(--bento-spacing-xs)',
        }}
      >
        {group.name}{' '}
        {group.isRequired && (
          <span style={{ color: 'var(--bento-destructive)', fontSize: '0.85em' }}>
            (Obligatorio)
          </span>
        )}
      </legend>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--bento-touch-gap)',
        }}
      >
        {(group.options || []).map((opt) => {
          const checked = selectedOptions.includes(opt.id);
          return (
            <label
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                minHeight: 'var(--bento-touch-target)',
                gap: 'var(--bento-spacing-sm)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                aria-label={opt.name}
                checked={checked}
                onChange={() => handleToggle(opt.id)}
              />
              <span style={{ color: 'var(--bento-text)' }}>{opt.name}</span>
              {opt.priceDelta > 0 && (
                <span style={{ color: 'var(--bento-text-muted)' }}>
                  (+{formatCOP(opt.priceDelta)})
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
