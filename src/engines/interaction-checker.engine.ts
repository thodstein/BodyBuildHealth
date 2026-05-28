import { MASTER_DB } from '../core/master-db';
import type { InteractionEntry, InteractionType } from '../core/types';

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
      const a = substanceIds[i].trim().toUpperCase();
      const b = substanceIds[j].trim().toUpperCase();
      
      const match = MASTER_DB.interactions.find(int =>
        (int.substanceA === a && int.substanceB === b) || (int.substanceA === b && int.substanceB === a)
      );

      if (match) {
        const level = match.severity === 'HIGH' ? 3 : match.severity === 'MEDIUM' ? 2 : 1;
        if (match.type === 'danger') {
          conflicts.push(match); severitySum += level * 30;
        } else if (match.type === 'conflict') {
          conflicts.push(match); severitySum += level * 15;
          warnings.push(`${match.substanceA} + ${match.substanceB}: ${match.description}`);
        } else if (match.type === 'synergy') {
          synergies.push(match); severitySum -= level * 5;
        }
      }
    }
  }

  const hasFatal = conflicts.some(c => c.severity === 'HIGH' && c.type === 'danger');
  const score = Math.max(0, Math.min(100, 100 - severitySum));

  return { score, conflicts, synergies, warnings, blocked: hasFatal };
}