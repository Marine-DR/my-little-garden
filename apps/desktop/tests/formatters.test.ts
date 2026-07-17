import { describe, expect, it } from 'vitest';
import {
  colorEmoji,
  formatBloom,
  formatList,
  formatNumber,
  formatRange,
  formatSeasons,
} from '../src/renderer/pages/catalog/formatters';

describe('catalog display formatters', () => {
  it('displays a dash for empty values', () => {
    expect(formatRange(null, null)).toBe('-');
    expect(formatNumber(null)).toBe('-');
    expect(formatList([])).toBe('-');
    expect(formatSeasons([])).toBe('-');
  });

  it('formats compact values in French', () => {
    expect(formatRange(50, 80)).toBe('50–80');
    expect(formatRange(42, null)).toBe('42');
    expect(formatRange(null, 120)).toBe('120');
    expect(formatBloom(6, 9)).toBe('Juin→Sep');
    expect(formatSeasons(['spring', 'autumn'])).toBe('Printemps, Automne');
    expect(colorEmoji('Rosé')).toBe('🩷');
    expect(colorEmoji('Vert')).toBe('🟢');
    expect(colorEmoji('Inconnue')).toBeNull();
  });
});
