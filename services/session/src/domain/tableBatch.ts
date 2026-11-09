import { DomainError } from '@packages/shared-types';

export const MAX_BATCH_SIZE = 50;
export const MAX_TABLES_PER_TENANT = 500;
export const MAX_LABEL_LENGTH = 40;

const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F-\u009F]/;

export interface NormalizedTableLabel {
  label: string;
  labelKey: string;
}

export interface TableUpdateItem {
  tableId: string;
  label?: string;
  labelKey?: string;
  status?: 'active' | 'inactive';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeTableLabel(raw: unknown): NormalizedTableLabel {
  if (typeof raw !== 'string') {
    throw new DomainError('VALIDATION_ERROR', 'Table label must be a string');
  }

  if (CONTROL_CHAR_REGEX.test(raw)) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'Table label must not contain control characters'
    );
  }

  const label = raw.trim().normalize('NFC');

  if (label.length < 1 || label.length > MAX_LABEL_LENGTH) {
    throw new DomainError(
      'VALIDATION_ERROR',
      `Table label must be between 1 and ${MAX_LABEL_LENGTH} characters`
    );
  }

  if (CONTROL_CHAR_REGEX.test(label)) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'Table label must not contain control characters'
    );
  }

  return {
    label,
    labelKey: label.toLocaleLowerCase('es'),
  };
}

export function parseCreateBatchInput(body: unknown): {
  items: NormalizedTableLabel[];
  labels: string[];
} {
  if (!isPlainObject(body)) {
    throw new DomainError('VALIDATION_ERROR', 'Request body must be a JSON object');
  }

  const hasPrefixProps =
    body.prefix !== undefined || body.count !== undefined || body.start !== undefined;
  const hasLabelsProp = body.labels !== undefined;

  if ((hasPrefixProps && hasLabelsProp) || (!hasPrefixProps && !hasLabelsProp)) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'Provide either { prefix, count, start? } or { labels } (mutually exclusive)'
    );
  }

  let rawLabels: unknown[];

  if (hasPrefixProps) {
    if (typeof body.prefix !== 'string' || CONTROL_CHAR_REGEX.test(body.prefix)) {
      throw new DomainError('VALIDATION_ERROR', 'prefix must be a non-empty string without control characters');
    }
    const prefixTrimmed = body.prefix.trim().normalize('NFC');
    if (
      prefixTrimmed.length < 1 ||
      prefixTrimmed.length > MAX_LABEL_LENGTH ||
      CONTROL_CHAR_REGEX.test(prefixTrimmed)
    ) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `prefix must be between 1 and ${MAX_LABEL_LENGTH} characters without control characters`
      );
    }

    const count = body.count;
    if (
      typeof count !== 'number' ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > MAX_BATCH_SIZE
    ) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `count must be an integer between 1 and ${MAX_BATCH_SIZE}`
      );
    }

    let start = 1;
    if (body.start !== undefined) {
      if (
        typeof body.start !== 'number' ||
        !Number.isInteger(body.start) ||
        body.start < 0
      ) {
        throw new DomainError('VALIDATION_ERROR', 'start must be an integer >= 0');
      }
      start = body.start;
    }

    rawLabels = Array.from({ length: count }, (_, i) => `${prefixTrimmed} ${start + i}`);
  } else {
    if (
      !Array.isArray(body.labels) ||
      body.labels.length < 1 ||
      body.labels.length > MAX_BATCH_SIZE
    ) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `labels must be an array of between 1 and ${MAX_BATCH_SIZE} items`
      );
    }
    rawLabels = body.labels;
  }

  const items: NormalizedTableLabel[] = [];
  const seenKeys = new Set<string>();
  const conflictSet = new Set<string>();

  for (const raw of rawLabels) {
    const normalized = normalizeTableLabel(raw);
    if (seenKeys.has(normalized.labelKey)) {
      conflictSet.add(normalized.labelKey);
    } else {
      seenKeys.add(normalized.labelKey);
    }
    items.push(normalized);
  }

  if (conflictSet.size > 0) {
    throw new DomainError('VALIDATION_ERROR', 'Duplicate table labels in request', {
      conflicts: Array.from(conflictSet),
    });
  }

  return {
    items,
    labels: items.map((item) => item.label),
  };
}

export function parseUpdateBatchInput(body: unknown): { updates: TableUpdateItem[] } {
  if (!isPlainObject(body) || !Array.isArray(body.updates)) {
    throw new DomainError('VALIDATION_ERROR', 'updates must be a non-empty array');
  }

  if (body.updates.length < 1 || body.updates.length > MAX_BATCH_SIZE) {
    throw new DomainError(
      'VALIDATION_ERROR',
      `updates must contain between 1 and ${MAX_BATCH_SIZE} items`
    );
  }

  const updates: TableUpdateItem[] = [];
  const seenTableIds = new Set<string>();
  const seenLabelKeys = new Set<string>();
  const conflictLabelKeys = new Set<string>();

  for (const rawItem of body.updates) {
    if (!isPlainObject(rawItem)) {
      throw new DomainError('VALIDATION_ERROR', 'Each update item must be an object');
    }

    if (typeof rawItem.tableId !== 'string' || rawItem.tableId.trim().length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'Each update item requires a non-empty tableId');
    }
    const tableId = rawItem.tableId.trim();

    if (seenTableIds.has(tableId)) {
      throw new DomainError('VALIDATION_ERROR', `Duplicate tableId in request: ${tableId}`);
    }
    seenTableIds.add(tableId);

    const hasLabel = rawItem.label !== undefined;
    const hasStatus = rawItem.status !== undefined;

    if (!hasLabel && !hasStatus) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `Update for table ${tableId} must include label or status`
      );
    }

    const parsed: TableUpdateItem = { tableId };

    if (hasLabel) {
      const { label, labelKey } = normalizeTableLabel(rawItem.label);
      parsed.label = label;
      parsed.labelKey = labelKey;
      if (seenLabelKeys.has(labelKey)) {
        conflictLabelKeys.add(labelKey);
      } else {
        seenLabelKeys.add(labelKey);
      }
    }

    if (hasStatus) {
      if (rawItem.status !== 'active' && rawItem.status !== 'inactive') {
        throw new DomainError(
          'VALIDATION_ERROR',
          'status must be either "active" or "inactive"'
        );
      }
      parsed.status = rawItem.status;
    }

    updates.push(parsed);
  }

  if (conflictLabelKeys.size > 0) {
    throw new DomainError('VALIDATION_ERROR', 'Duplicate table labels in batch update', {
      conflicts: Array.from(conflictLabelKeys),
    });
  }

  return { updates };
}

export function parseDeleteBatchInput(body: unknown): { tableIds: string[] } {
  if (!isPlainObject(body) || !Array.isArray(body.tableIds)) {
    throw new DomainError('VALIDATION_ERROR', 'tableIds must be an array');
  }

  if (body.tableIds.length < 1 || body.tableIds.length > MAX_BATCH_SIZE) {
    throw new DomainError(
      'VALIDATION_ERROR',
      `tableIds must contain between 1 and ${MAX_BATCH_SIZE} items`
    );
  }

  const tableIds: string[] = [];
  const seen = new Set<string>();

  for (const rawId of body.tableIds) {
    if (typeof rawId !== 'string' || rawId.trim().length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'Each tableId must be a non-empty string');
    }
    const id = rawId.trim();
    if (seen.has(id)) {
      throw new DomainError('VALIDATION_ERROR', `Duplicate tableId in request: ${id}`);
    }
    seen.add(id);
    tableIds.push(id);
  }

  return { tableIds };
}
