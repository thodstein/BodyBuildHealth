import { 
  EffectEntry, InteractionEntry, GoalProfile, StackTemplate, 
  SubstanceEntry 
} from '../core/types';
import { analyzeInteractions } from './interactions.engine';

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
  
  const filtered = substances.filter(sub => {
    const inAvoid = goalProfile.avoidGroups.some(g => 
      sub.id.toUpperCase().includes(g.toUpperCase())
    );
    return !inAvoid;
  });

  const scored = filtered.map(sub => {
    let score = 0;
    sub.effects?.forEach(ef => {
      const priority = goalProfile.effectPriority[ef.effect] || 0;
      score += priority * ef.strength * intensity;
    });
    const isPreferred = goalProfile.preferredGroups.some(g => 
      sub.id.toUpperCase().includes(g.toUpperCase())
    );
    if (isPreferred) score *= (rules.preferred_groups_boost || 1.2);
    return { ...sub, score: Math.max(0, score) };
  }).sort((a, b) => b.score - a.score);

  const maxSubs = rules.maxSubstances || 10;
  let stackSubs = scored.slice(0, maxSubs).map(s => s.id);

  const analysis = analyzeInteractions(stackSubs);
  if (analysis.blocked) {
    while (analysis.blocked && stackSubs.length > 2) {
      stackSubs.pop();
    }
  }

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

  const coverage = stackSubs.reduce((acc, subId) => {
    const entry = scored.find(s => s.id === subId);
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
