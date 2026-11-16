import { Request, Response, NextFunction } from 'express';
import { DomainError } from '@packages/shared-types';
import {
  MAX_BATCH_SIZE,
  MAX_TABLES_PER_TENANT,
  MAX_LABEL_LENGTH,
  normalizeTableLabel,
  parseCreateBatchInput,
  parseUpdateBatchInput,
  parseDeleteBatchInput,
} from '../../src/domain/tableBatch';
import { errorHandler } from '../../src/interfaces/http/middleware/errorHandler';

describe('tableBatch domain & errorHandler (U1)', () => {
  describe('exported constants', () => {
    it('exports MAX_BATCH_SIZE = 50, MAX_TABLES_PER_TENANT = 500, MAX_LABEL_LENGTH = 40', () => {
      expect(MAX_BATCH_SIZE).toBe(50);
      expect(MAX_TABLES_PER_TENANT).toBe(500);
      expect(MAX_LABEL_LENGTH).toBe(40);
    });
  });

  describe('normalizeTableLabel', () => {
    it('trims, normalizes NFC and computes Spanish lowercase labelKey', () => {
      const res = normalizeTableLabel('  Mesa 1  ');
      expect(res).toEqual({ label: 'Mesa 1', labelKey: 'mesa 1' });

      // NFD decomposed 'é' (e + combining acute accent \u0301) -> NFC 'é' (\u00e9)
      const nfd = 'Terraza Cafe\u0301 2';
      const normalized = normalizeTableLabel(nfd);
      expect(normalized.label).toBe('Terraza Café 2');
      expect(normalized.label.length).toBe(14);
      expect(normalized.labelKey).toBe('terraza café 2');
    });

    it('accepts label of length 1 and 40 (boundary)', () => {
      expect(normalizeTableLabel('A')).toEqual({ label: 'A', labelKey: 'a' });
      const label40 = 'M'.repeat(40);
      expect(normalizeTableLabel(label40)).toEqual({
        label: label40,
        labelKey: 'm'.repeat(40),
      });
    });

    it('rejects non-string, empty string, whitespace-only, and >40 chars with VALIDATION_ERROR', () => {
      for (const invalid of [null, undefined, 123, {}, [], '', '   ', 'M'.repeat(41)]) {
        expect(() => normalizeTableLabel(invalid)).toThrow(DomainError);
        try {
          normalizeTableLabel(invalid);
        } catch (err) {
          expect(err).toBeInstanceOf(DomainError);
          expect((err as DomainError).code).toBe('VALIDATION_ERROR');
        }
      }
    });

    it('rejects control characters (\\n, \\u0000, \\u001f, \\u007f, \\u0080)', () => {
      for (const bad of ['Mesa\n1', 'Mesa\u00001', 'Mesa\u001f1', 'Mesa\u007f1', 'Mesa\u00851']) {
        expect(() => normalizeTableLabel(bad)).toThrow(DomainError);
        try {
          normalizeTableLabel(bad);
        } catch (err) {
          expect((err as DomainError).code).toBe('VALIDATION_ERROR');
        }
      }
    });
  });

  describe('parseCreateBatchInput', () => {
    it('generates labels in prefix mode with default start = 1 and custom start >= 0', () => {
      const res1 = parseCreateBatchInput({ prefix: '  Mesa ', count: 3 });
      expect(res1.items).toEqual([
        { label: 'Mesa 1', labelKey: 'mesa 1' },
        { label: 'Mesa 2', labelKey: 'mesa 2' },
        { label: 'Mesa 3', labelKey: 'mesa 3' },
      ]);

      const res0 = parseCreateBatchInput({ prefix: 'Barra', count: 2, start: 0 });
      expect(res0.items).toEqual([
        { label: 'Barra 0', labelKey: 'barra 0' },
        { label: 'Barra 1', labelKey: 'barra 1' },
      ]);
    });

    it('enforces batch size limits 0, 1, 50, 51 in prefix mode', () => {
      expect(parseCreateBatchInput({ prefix: 'M', count: 1 }).items).toHaveLength(1);
      expect(parseCreateBatchInput({ prefix: 'M', count: 50 }).items).toHaveLength(50);

      for (const badCount of [0, -1, 51, 1.5, NaN, '5']) {
        expect(() => parseCreateBatchInput({ prefix: 'M', count: badCount })).toThrow(DomainError);
      }
    });

    it('rejects invalid prefix or start in prefix mode', () => {
      for (const badBody of [
        { prefix: '', count: 2 },
        { prefix: '   ', count: 2 },
        { prefix: 'Mesa\n', count: 2 },
        { prefix: 'M'.repeat(39), count: 10 }, // "M...M 10" -> 42 chars > 40
        { prefix: 'Mesa', count: 2, start: -1 },
        { prefix: 'Mesa', count: 2, start: 1.5 },
      ]) {
        expect(() => parseCreateBatchInput(badBody)).toThrow(DomainError);
      }
    });

    it('parses labels mode for 1 and 50 items and rejects 0 or 51 items', () => {
      const one = parseCreateBatchInput({ labels: ['  Terraza 1 '] });
      expect(one.items).toEqual([{ label: 'Terraza 1', labelKey: 'terraza 1' }]);

      const fiftyLabels = Array.from({ length: 50 }, (_, i) => `Mesa ${i + 1}`);
      expect(parseCreateBatchInput({ labels: fiftyLabels }).items).toHaveLength(50);

      expect(() => parseCreateBatchInput({ labels: [] })).toThrow(DomainError);
      const fiftyOneLabels = Array.from({ length: 51 }, (_, i) => `Mesa ${i + 1}`);
      expect(() => parseCreateBatchInput({ labels: fiftyOneLabels })).toThrow(DomainError);
    });

    it('rejects duplicate labels in the same request (case/whitespace insensitive) with details.conflicts', () => {
      try {
        parseCreateBatchInput({ labels: ['Mesa 1', ' mesa 1 ', 'Mesa 2'] });
        fail('Should have thrown DomainError');
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        const domErr = err as DomainError;
        expect(domErr.code).toBe('VALIDATION_ERROR');
        expect(domErr.details).toEqual({
          conflicts: expect.arrayContaining(['mesa 1']),
        });
      }
    });

    it('enforces mutual exclusion between { prefix, count } and { labels }', () => {
      expect(() =>
        parseCreateBatchInput({ prefix: 'Mesa', count: 2, labels: ['Mesa 1', 'Mesa 2'] })
      ).toThrow(DomainError);
      expect(() =>
        parseCreateBatchInput({ labels: ['Mesa 1'], start: 1 })
      ).toThrow(DomainError);
      expect(() =>
        parseCreateBatchInput({ labels: ['Mesa 1'], prefix: 'Mesa' })
      ).toThrow(DomainError);
      expect(() =>
        parseCreateBatchInput({ labels: ['Mesa 1'], count: 1 })
      ).toThrow(DomainError);
      expect(() => parseCreateBatchInput({})).toThrow(DomainError);
      expect(() => parseCreateBatchInput(null)).toThrow(DomainError);
    });
  });

  describe('parseUpdateBatchInput', () => {
    it('accepts 1..50 valid updates with label, status, or both', () => {
      const res = parseUpdateBatchInput({
        updates: [
          { tableId: ' t-1 ', label: '  VIP 1 ' },
          { tableId: 't-2', status: 'inactive' },
          { tableId: 't-3', label: 'VIP 3', status: 'active' },
        ],
      });
      expect(res.updates).toEqual([
        { tableId: 't-1', label: 'VIP 1', labelKey: 'vip 1' },
        { tableId: 't-2', status: 'inactive' },
        { tableId: 't-3', label: 'VIP 3', labelKey: 'vip 3', status: 'active' },
      ]);

      const fiftyUpdates = Array.from({ length: 50 }, (_, i) => ({
        tableId: `t-${i + 1}`,
        status: 'active' as const,
      }));
      expect(parseUpdateBatchInput({ updates: fiftyUpdates }).updates).toHaveLength(50);
    });

    it('rejects batch size 0 or 51', () => {
      expect(() => parseUpdateBatchInput({ updates: [] })).toThrow(DomainError);
      const fiftyOne = Array.from({ length: 51 }, (_, i) => ({
        tableId: `t-${i + 1}`,
        status: 'active',
      }));
      expect(() => parseUpdateBatchInput({ updates: fiftyOne })).toThrow(DomainError);
    });

    it('rejects status: "deleted" or invalid status with VALIDATION_ERROR', () => {
      for (const badStatus of ['deleted', 'closed', '', 123]) {
        expect(() =>
          parseUpdateBatchInput({
            updates: [{ tableId: 't-1', status: badStatus }],
          })
        ).toThrow(DomainError);
        try {
          parseUpdateBatchInput({
            updates: [{ tableId: 't-1', status: badStatus }],
          });
        } catch (err) {
          expect((err as DomainError).code).toBe('VALIDATION_ERROR');
        }
      }
    });

    it('rejects missing fields, empty tableId, duplicate tableIds, and duplicate new labelKeys', () => {
      // Neither label nor status
      expect(() =>
        parseUpdateBatchInput({ updates: [{ tableId: 't-1' }] })
      ).toThrow(DomainError);

      // Empty tableId
      expect(() =>
        parseUpdateBatchInput({ updates: [{ tableId: '   ', status: 'active' }] })
      ).toThrow(DomainError);

      // Duplicate tableId
      expect(() =>
        parseUpdateBatchInput({
          updates: [
            { tableId: 't-1', status: 'active' },
            { tableId: ' t-1 ', label: 'Mesa 2' },
          ],
        })
      ).toThrow(DomainError);

      // Duplicate labelKey in batch update
      try {
        parseUpdateBatchInput({
          updates: [
            { tableId: 't-1', label: 'Mesa 1' },
            { tableId: 't-2', label: ' mesa 1 ' },
          ],
        });
        fail('Should have thrown DomainError');
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        const domErr = err as DomainError;
        expect(domErr.code).toBe('VALIDATION_ERROR');
        expect(domErr.details).toEqual({
          conflicts: expect.arrayContaining(['mesa 1']),
        });
      }
    });
  });

  describe('parseDeleteBatchInput', () => {
    it('accepts 1..50 unique non-empty tableIds and trims them', () => {
      const res = parseDeleteBatchInput({ tableIds: [' t-1 ', 't-2'] });
      expect(res.tableIds).toEqual(['t-1', 't-2']);

      const fiftyIds = Array.from({ length: 50 }, (_, i) => `t-${i + 1}`);
      expect(parseDeleteBatchInput({ tableIds: fiftyIds }).tableIds).toHaveLength(50);
    });

    it('rejects 0, 51, empty tableId, or duplicate tableIds', () => {
      expect(() => parseDeleteBatchInput({ tableIds: [] })).toThrow(DomainError);
      const fiftyOne = Array.from({ length: 51 }, (_, i) => `t-${i + 1}`);
      expect(() => parseDeleteBatchInput({ tableIds: fiftyOne })).toThrow(DomainError);
      expect(() => parseDeleteBatchInput({ tableIds: ['t-1', '   '] })).toThrow(DomainError);
      expect(() => parseDeleteBatchInput({ tableIds: ['t-1', ' t-1 '] })).toThrow(DomainError);
    });
  });

  describe('errorHandler 409 mappings & error.details serialization', () => {
    const createMockRes = () => {
      const res: any = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res as Response & { status: jest.Mock; json: jest.Mock };
    };

    it.each([
      ['TABLE_LABEL_TAKEN', 409],
      ['TABLE_LIMIT_EXCEEDED', 409],
      ['TABLES_NOT_DELETABLE', 409],
      ['TABLE_HAS_ACTIVE_SESSION', 409],
      ['CONFLICT', 409],
    ] as const)('maps %s to HTTP %i and includes details when present', (code, expectedStatus) => {
      const res = createMockRes();
      const details = { conflicts: ['Mesa 1'] };
      const err = new (DomainError as any)(code, 'Conflict error', details);

      errorHandler(err, {} as Request, res, jest.fn() as NextFunction);

      expect(res.status).toHaveBeenCalledWith(expectedStatus);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code,
          message: 'Conflict error',
          details,
        },
      });
    });

    it('omits details property when DomainError is constructed with 2 arguments', () => {
      const res = createMockRes();
      const err = new DomainError('VALIDATION_ERROR', 'Bad input');

      errorHandler(err, {} as Request, res, jest.fn() as NextFunction);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Bad input',
        },
      });
      const payload = res.json.mock.calls[0][0];
      expect('details' in payload.error).toBe(false);
    });
  });
});
