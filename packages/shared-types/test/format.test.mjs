import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCOP } from '../dist/index.js';

describe('formatCOP', () => {
  it('formats positive integers to COP without decimals', () => {
    const formatted = formatCOP(12500);
    assert.match(formatted, /12\.500/);
    assert.match(formatted, /\$/);
    assert.doesNotMatch(formatted, /,/);
  });

  it('formats 0 for null, undefined or NaN', () => {
    assert.match(formatCOP(0), /0/);
    assert.match(formatCOP(null), /0/);
    assert.match(formatCOP(undefined), /0/);
    assert.match(formatCOP('invalid'), /0/);
  });

  it('parses numeric string', () => {
    assert.match(formatCOP('35000'), /35\.000/);
  });
});
