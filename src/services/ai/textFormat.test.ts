import { describe, expect, it } from 'vitest';
import { sanitizeAssistantText } from './textFormat';

describe('sanitizeAssistantText', () => {
  it('strips heading hashes', () => {
    expect(sanitizeAssistantText('### Wochenplan')).toBe('Wochenplan');
  });

  it('strips bold and italic asterisks', () => {
    expect(sanitizeAssistantText('**Montag**: *Hähnchen* mit Reis')).toBe('Montag: Hähnchen mit Reis');
  });

  it('converts markdown bullets to a plain dot', () => {
    expect(sanitizeAssistantText('- Reis\n* Nudeln')).toBe('• Reis\n• Nudeln');
  });

  it('strips inline code backticks', () => {
    expect(sanitizeAssistantText('Nutze `reroll_day` dafür.')).toBe('Nutze reroll_day dafür.');
  });

  it('collapses excessive blank lines', () => {
    expect(sanitizeAssistantText('Zeile 1\n\n\n\nZeile 2')).toBe('Zeile 1\n\nZeile 2');
  });
});
