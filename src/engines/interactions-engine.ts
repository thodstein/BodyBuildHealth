import { InteractionEntry, Severity, cleanKeys } from '../core/stack-types';

export interface InteractionResult {
  score: number; // 0-100 (чем ниже, тем опаснее)
  conflicts: InteractionEntry[];
  synergies: InteractionEntry[];
  warnings: string[];
  blocked: boolean;
}

export function analyzeInteractions(
  stack: string[],
  interactions: InteractionEntry[]
): InteractionResult {
  const conflicts: InteractionEntry[] = [];
  const synergies: InteractionEntry[] = [];
  const warnings: string[] = [];
  let severitySum = 0;

  for (let i = 0; i < stack.length; i++) {
    for (let j = i + 1; j < stack.length; j++) {
      const a = stack[i].toUpperCase().trim();
      const b = stack[j].toUpperCase().trim();
      
      const match = interactions.find(
        inter => 
          (inter.substanceA.toUpperCase().trim() === a && inter.substanceB.toUpperCase().trim() === b) ||
          (inter.substanceA.toUpperCase().trim() === b && inter.substanceB.toUpperCase().trim() === a)
      );

      if (match) {
        if (match.type === 'danger') {
          conflicts.push(match);
          severitySum += match.severity * 30;
        } else if (match.type === 'conflict') {
          conflicts.push(match);
          severitySum += match.severity * 15;
          warnings.push(`${match.substanceA} + ${match.substanceB}: ${match.description}`);
        } else if (match.type === 'synergy') {
          synergies.push(match);
          severitySum -= match.severity * 5;
        }
      }
    }
  }

  const hasFatal = conflicts.some(c => c.severity === 3 && c.type === 'danger');
  const rawScore = Math.max(0, Math.min(100, 100 - severitySum));

  return {
    score: rawScore,
    conflicts,
    synergies,
    warnings,
    blocked: hasFatal
  };
}

export function getInteractionText(result: InteractionResult): string {
  if (result.blocked) return `🛑 СТЕК ЗАБЛОКИРОВАН. Обнаружены критически опасные взаимодействия.`;
  if (result.conflicts.length === 0 && result.synergies.length === 0) return '✅ Взаимодействий не выявлено.';
  
  let txt = `📊 Анализ взаимодействий (Score: ${result.score}%):\n`;
  if (result.conflicts.length) txt += `⚠️ Конфликты: ${result.conflicts.map(c => `${c.substanceA}/${c.substanceB}`).join(', ')}\n`;
  if (result.synergies.length) txt += `✨ Синергия: ${result.synergies.map(s => `${s.substanceA}/${s.substanceB}`).join(', ')}\n`;
  if (result.warnings.length) txt += `📝 Предупреждения:\n${result.warnings.join('\n')}`;
  return txt;
}