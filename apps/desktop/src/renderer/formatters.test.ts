import { describe, expect, it } from 'vitest';
import { formatBloom, formatList, formatNumber, formatRange, formatSeasons } from './formatters';

describe('catalog display formatters', () => {
  it('displays a dash for empty values', () => {
    expect(formatRange(null, null)).toBe('-');
    expect(formatNumber(null)).toBe('-');
    expect(formatList([])).toBe('-');
    expect(formatSeasons([])).toBe('-');
  });

  it('formats compact values in French', () => {
    expect(formatRange(50, 80)).toBe('50–80');
    expect(formatBloom(6, 9)).toBe('Juin→Sep');
    expect(formatSeasons(['spring', 'autumn'])).toBe('Printemps, Automne');
  });
});

