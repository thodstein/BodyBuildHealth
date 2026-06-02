import { registry } from '../core/data/registry';
import type { InteractionEntry } from '../core/types';

export interface InteractionResult {
  score: number; conflicts: InteractionEntry[]; synergies: InteractionEntry[];
  warnings: string[]; blocked: boolean;
}

export function analyzeInteractions(substanceIds: string[]): InteractionResult {
  const db = registry.getDB();
  const conflicts: InteractionEntry[] = [];
  const synergies: InteractionEntry[] = [];
  const warnings: string[] = [];
  let severitySum = 0;

  for (let i = 0; i < substanceIds.length; i++) {
    for (let j = i + 1; j < substanceIds.length; j++) {
      const a = substanceIds[i].trim();
      const b = substanceIds[j].trim();
      const match = registry.getInteraction(a, b);

      if (match) {
        if (match.type === 'danger') {
          conflicts.push(match); severitySum += match.severity * 30;
        } else if (match.type === 'conflict') {
          conflicts.push(match); severitySum += match.severity * 15;
          warnings.push(`${match.substanceA} + ${match.substanceB}: ${match.description}`);
        } else if (match.type === 'synergy') {
          synergies.push(match); severitySum -= match.severity * 5;
        }
      } else {
        const syn = db.synergyMatrix[a]?.[b] || db.synergyMatrix[b]?.[a];
        const conf = db.conflictMatrix[a]?.[b] || db.conflictMatrix[b]?.[a];
        if (syn && syn > 0) severitySum -= syn;
        if (conf && conf > 0) { severitySum += conf; warnings.push(`Matrix conflict: ${a} x ${b} (${conf})`); }
      }
    }
  }

  const hasFatal = conflicts.some(c => c.severity === 3 && c.type === 'danger');
  return { score: Math.max(0, Math.min(100, 100 - severitySum)), conflicts, synergies, warnings, blocked: hasFatal };
}