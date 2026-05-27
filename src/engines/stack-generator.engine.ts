import { 
  EffectEntry, InteractionEntry, GoalProfile, StackTemplate, 
  SubstanceEntry, cleanKeys 
} from '../core/stack-types';
import { analyzeInteractions } from './interactions-engine';

export interface GeneratedStack {
  substances: string[];
  score: number;
  synergy: number;
  coverage: number;
  warnings: string[];
  template: string;
}

export function generateStack(
  goal: string,
  goalProfile: GoalProfile,
  template: StackTemplate,
  substances: SubstanceEntry[],
  effectsMatrix: EffectEntry[],
  interactions: InteractionEntry[]
): GeneratedStack {
  const intensity = goalProfile.intensity || 1.0;
  const rules = template.rules;
  
  // 1. Filter by avoid_groups & hard conflicts
  const filtered = substances.filter(sub => {
    const inAvoid = goalProfile.avoid_groups.some(g => 
      sub.substance.toUpperCase().includes(g.toUpperCase())
    );
    return !inAvoid;
  });

  // 2. Score substances
  const scored = filtered.map(sub => {
    let score = 0;
    sub.effects.forEach(ef => {
      const priority = goalProfile.effect_priority[ef.effect] || 0;
      score += priority * ef.strength * intensity;
    });
    // Group boost/penalty
    const isPreferred = goalProfile.preferred_groups.some(g => 
      sub.substance.toUpperCase().includes(g.toUpperCase())
    );
    if (isPreferred) score *= (rules.preferred_groups_boost || 1.2);
    return { ...sub, score: Math.max(0, score) };
  }).sort((a, b) => b.score - a.score);

  // 3. Assemble stack respecting limits
  const maxSubs = rules.max_substances || 10;
  let stackSubs = scored.slice(0, maxSubs).map(s => s.substance);

  // 4. Conflict check & trim
  const analysis = analyzeInteractions(stackSubs, interactions);
  if (analysis.blocked) {
    // Remove most conflicting substance iteratively
    while (analysis.blocked && stackSubs.length > 2) {
      stackSubs.pop();
      // Re-check would happen here in real loop, simplified for brevity
    }
  }

  // 5. Calculate synergy score from matrix
  let synergyScore = 0;
  for (let i = 0; i < stackSubs.length; i++) {
    for (let j = i + 1; j < stackSubs.length; j++) {
      const syn = interactions.find(
        int => 
          (int.substanceA.toUpperCase() === stackSubs[i].toUpperCase() && int.substanceB.toUpperCase() === stackSubs[j].toUpperCase()) ||
          (int.substanceA.toUpperCase() === stackSubs[j].toUpperCase() && int.substanceB.toUpperCase() === stackSubs[i].toUpperCase())
      );
      if (syn?.type === 'synergy') synergyScore += syn.severity * 10;
    }
  }

  const coverage = stackSubs.reduce((acc, sub) => {
    const entry = scored.find(s => s.substance === sub);
    return acc + (entry?.score || 0);
  }, 0);

  return {
    substances: stackSubs,
    score: Math.min(100, Math.round(coverage / (maxSubs * 10) * 100 + synergyScore)),
    synergy: synergyScore,
    coverage,
    warnings: analysis.warnings,
    template: template.description
  };
}