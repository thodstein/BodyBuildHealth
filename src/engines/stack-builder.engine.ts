import { MASTER_DB } from '../core/master-db';
import { analyzeInteractions } from './interaction-checker.engine';
import type { SubstanceEntry } from '../core/types';

export interface StackResult {
  substances: SubstanceEntry[]; score: number; synergy: number; coverage: number;
  warnings: string[]; errors: string[];
}

export function generateStack(goalEffects: string[], blacklist: string[] = []): StackResult {
  const db = MASTER_DB;
  const normalizedGoals = goalEffects.map(g => g.toLowerCase());
  const filtered = db.substances.filter(s => !blacklist.includes(s.id));

  const scored = filtered.map((sub) => {
    let score = 0;
    const effects = sub.effects ?? [];
    for (const effect of effects) {
      if (normalizedGoals.includes(effect.effect.toLowerCase())) {
        score += effect.strength || 1;
      }
    }
    if (score === 0 && normalizedGoals.length === 0) {
      score = 1;
    }
    return { ...sub, _score: score };
  }).filter((s) => s._score > 0)
    .sort((a, b) => b._score - a._score);

  const selected = scored.slice(0, 5);
  const interactionResult = analyzeInteractions(selected.map((s) => s.id));
  const warnings = interactionResult.conflicts.map(
    (c) => `${c.substanceA} + ${c.substanceB}: ${c.description}`
  );

  return {
    substances: selected,
    score: selected.length > 0 ? Math.min(100, selected.reduce((acc, s) => acc + s._score, 0) * 10) : 0,
    synergy: interactionResult.synergies.length,
    coverage: normalizedGoals.length > 0
      ? Math.round(
          (new Set(
            selected.flatMap((s) =>
              (s.effects ?? [])
                .map((e) => e.effect.toLowerCase())
                .filter((e) => normalizedGoals.includes(e))
            )
          ).size / normalizedGoals.length) * 100
        )
      : 0,
    warnings,
    errors: []
  };
}
export function resolveSubstancesForStack(goal: string, blacklist: string[] = []): Promise<SubstanceEntry[]> {
    // Stub implementation
    return Promise.resolve([]);
}


export function selectBestStack(goalId: string) {
  const goal = MASTER_DB.goals.find(g => g.id === goalId);
  if (!goal) {
    return {
      stack: {
        id: 'empty-stack',
        substances: [],
        synergy_score: 0
      },
      score: 0,
      reason: 'Цель не найдена'
    };
  }

  const db = MASTER_DB;
  const substances = db.substances;

  // Score each substance based on category match to preferred/avoid groups
  const scored = substances.map(sub => {
    let score = 0;
    const cat = sub.category?.toUpperCase() ?? '';
    if (goal.preferredGroups?.some(g => cat.includes(g.toUpperCase()))) {
      score += 2;
    }
    if (goal.avoidGroups?.some(g => cat.includes(g.toUpperCase()))) {
      score -= 2;
    }
    // Additional boost if tags match preferred groups (optional)
    // We'll skip for simplicity
    return { ...sub, score };
  })
  .filter(s => s.score > 0) // only keep positive matches
  .sort((a, b) => b.score - a.score);

  // Take up to 5 substances
  const stackSubs = scored.slice(0, 5);
  const ids = stackSubs.map(s => s.id);

  // Check interactions
  const interactionRes = analyzeInteractions(ids);
  let finalSubs = stackSubs;
  if (interactionRes.blocked) {
    // Remove substances involved in conflicts
    finalSubs = stackSubs.filter(s => 
      !interactionRes.conflicts.some(c => 
        c.substanceA === s.id || c.substanceB === s.id
      )
    );
  }

  // Compute a simple score (0-100) based on number of substances and average score
  const substanceScore = finalSubs.length > 0 
    ? Math.min(100, finalSubs.reduce((acc, s) => acc + s.score, 0) / finalSubs.length * 10) 
    : 0; // scale arbitrarily

  return {
    stack: {
      id: `${goalId}-stack`,
      substances: finalSubs,
      synergy_score: interactionRes.synergies.length
    },
    score: substanceScore,
    reason: `Selected ${finalSubs.length} substances based on category match`
  };
}
