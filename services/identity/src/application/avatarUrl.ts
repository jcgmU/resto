import { DomainError } from '@packages/shared-types';

const UPLOADED_PHOTO = /^\/(v1\/)?uploads\/[\w.-]+$/;
const REMOTE_PHOTO = /^https?:\/\/[^\s]+$/i;

/** undefined = sin cambio; null = quitar la foto. */
export function parseAvatarUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new DomainError('VALIDATION_ERROR', 'avatarUrl debe ser texto o null');
  }
  const trimmed = value.trim();
  if (!UPLOADED_PHOTO.test(trimmed) && !REMOTE_PHOTO.test(trimmed)) {
    throw new DomainError('VALIDATION_ERROR', 'avatarUrl debe ser una foto subida (/v1/uploads/...) o una URL http(s)');
  }
  return trimmed;
}
