export const FEATURE_FLAG_KEYS = [
  'online-ordering',
  'table-qr',
  'kitchen-display',
  'payments',
  'analytics',
  'multi-language',
  'dev-components',
] as const;

export type FeatureFlagKey = typeof FEATURE_FLAG_KEYS[number];
export type FeatureFlags = Readonly<Record<FeatureFlagKey, boolean>>;

// Valores por defecto (fail-closed: lo no lanzado, apagado)
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  'online-ordering': true,
  'table-qr': true,
  'kitchen-display': false,
  'payments': false,
  'analytics': false,
  'multi-language': false,
  'dev-components': false,
};

// Parsea "payments:true,analytics:false"; claves desconocidas se ignoran; valores inválidos -> false; nunca lanza.
export function parseFeatureFlags(raw: string | undefined): FeatureFlags {
  if (!raw || typeof raw !== 'string') {
    return { ...DEFAULT_FEATURE_FLAGS };
  }

  const result: Record<FeatureFlagKey, boolean> = { ...DEFAULT_FEATURE_FLAGS };
  const pairs = raw.split(',');

  for (const pair of pairs) {
    const [keyPart, valPart] = pair.split(':');
    if (!keyPart || !valPart) continue;

    const trimmedKey = keyPart.trim() as FeatureFlagKey;
    if (FEATURE_FLAG_KEYS.includes(trimmedKey)) {
      const trimmedVal = valPart.trim().toLowerCase();
      result[trimmedKey] = trimmedVal === 'true';
    }
  }

  return result;
}
