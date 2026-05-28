import { MASTER_DB } from '../core/master-db';
import { analyzeInteractions } from './interaction-checker.engine';
import type { SubstanceEntry } from '../core/types';

export interface StackResult {
  substances: SubstanceEntry[]; score: number; synergy: number; coverage: number;
  warnings: string[]; errors: string[];
}

export function generateStack(goalEffects: string[], blacklist: string[] = []): StackResult {
  const db = MASTER_DB;
  const filtered = db.substances.filter(s => !blacklist.includes(s.id));
  
  // Скоринг: сколько нужных эффектов даёт вещество
  const scored = filtered.map(sub => {
    let score = 0;
    sub.effects.forEach(ef => {
      if (goalEffects.includes(ef.effect)) score += ef.strength;
    });
    return { ...sub, score };
  }).sort((a, b) => b.score - a.score);

  // Берём топ-5
  let stack = scored.slice(0, 5);
  const ids = stack.map(s => s.id);

  // Проверка конфликтов
  const interactionRes = analyzeInteractions(ids);
  
  if (interactionRes.blocked) {
    stack = stack.filter(s => !interactionRes.conflicts.some(c => c.substanceA === s.id || c.substanceB === s.id));
  }

  const finalScore = Math.min(100, stack.reduce((acc, s) => acc + s.score, 0) / stack.length);

  return {
    substances: stack,
    score: finalScore,
    synergy: interactionRes.synergies.length,
    coverage: stack.length,
    warnings: interactionRes.warnings,
    errors: interactionRes.conflicts.map(c => `${c.substanceA} × ${c.substanceB} (${c.type})`)
  };
}