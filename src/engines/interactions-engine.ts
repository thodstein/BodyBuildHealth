import { MASTER_DB, DataRegistry } from '../core/data/registry';
import type { InteractionEntry } from '../core/types';

export interface InteractionResult {
  score: number; conflicts: InteractionEntry[]; synergies: InteractionEntry[];
  warnings: string[]; blocked: boolean;
}

export function analyzeInteractions(substanceIds: string[]): InteractionResult {
  const conflicts: InteractionEntry[] = [];
  const synergies: InteractionEntry[] = [];
  const warnings: string[] = [];
  let severitySum = 0;

  for (let i = 0; i < substanceIds.length; i++) {
    for (let j = i + 1; j < substanceIds.length; j++) {
      const a = substanceIds[i].trim();
      const b = substanceIds[j].trim();
      const match = DataRegistry.getInteraction(a, b);

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
        // Проверка матриц синергии/конфликтов
        const syn = MASTER_DB.synergyMatrix[a]?.[b] || MASTER_DB.synergyMatrix[b]?.[a];
        const conf = MASTER_DB.conflictMatrix[a]?.[b] || MASTER_DB.conflictMatrix[b]?.[a];
        if (syn && syn > 0) severitySum -= syn;
        if (conf && conf > 0) { severitySum += conf; warnings.push(`Matrix conflict: ${a} × ${b} (${conf})`); }
      }
    }
  }

  const hasFatal = conflicts.some(c => c.severity === 3 && c.type === 'danger');
  const score = Math.max(0, Math.min(100, 100 - severitySum));

  return { score, conflicts, synergies, warnings, blocked: hasFatal };
}