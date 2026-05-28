import type { ParsedLabResult } from './types';

export function parseLabText(text: string): ParsedLabResult[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const results: ParsedLabResult[] = [];

  for (const line of lines) {
    const parts = line.split(/[\s,;]+/).filter(Boolean);
    if (parts.length >= 3) {
      const marker = parts[0].toUpperCase();
      const value = parseFloat(parts[1]);
      const unit = parts.slice(2).join(' ').trim();
      if (!isNaN(value)) {
        results.push({ marker, value, unit });
      }
    }
  }
  return results;
}
