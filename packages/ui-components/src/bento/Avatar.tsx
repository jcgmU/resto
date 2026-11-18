import React, { useEffect, useState } from 'react';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length === 1 ? [parts[0][0]] : [parts[0][0], parts[parts.length - 1][0]];
  return letters.join('').toUpperCase();
}

export function Avatar({ name, src, size = 40, className, style }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bento-panel-bg)',
    color: 'var(--bento-text-strong)',
    fontFamily: 'var(--bento-font-heading)',
    fontWeight: 600,
    fontSize: Math.max(11, Math.round(size * 0.38)),
    ...style,
  };

  if (src && !failed) {
    return (
      <span data-component="avatar" className={className} style={box}>
        <img
          src={src}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </span>
    );
  }

  return (
    <span data-component="avatar" className={className} style={box} role="img" aria-label={name}>
      <span aria-hidden="true">{getInitials(name)}</span>
    </span>
  );
}
