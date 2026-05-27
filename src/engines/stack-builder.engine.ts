import { resolveSubstanceAlias } from '../core/clinical-databases';

interface Substance { name: string; effects: string[]; }
interface StackResult { stack: Substance[]; synergy_score: number; warnings: string[]; errors: string[]; }

const GOAL_PROFILES: Record<string, any> = {
  energy: { effect_priority: { energy: 1.0, focus: 0.9, mitochondria: 0.9 }, preferred_groups: ["stimulants","nootropics","mitochondrial_support"], avoid_groups: ["sleep_regulators"], intensity: 1.2 },
  fat_loss: { effect_priority: { fat_loss: 1.0, insulin_sensitivity: 0.9, mitochondria: 0.8 }, preferred_groups: ["fat_loss_agents","mitochondrial_support"], avoid_groups: ["sleep_regulators"], intensity: 1.3 },
  focus: { effect_priority: { focus: 1.0, memory: 0.9, energy: 0.7 }, preferred_groups: ["nootropics","stimulants","adaptogens"], avoid_groups: ["sleep_regulators"], intensity: 1.1 },
  sleep: { effect_priority: { sleep: 1.0, anti_stress: 0.9 }, preferred_groups: ["sleep_regulators","anti_stress"], avoid_groups: ["stimulants","nootropics"], intensity: 1.0 },
  recovery: { effect_priority: { recovery: 1.0, anti_inflammation: 0.9 }, preferred_groups: ["recovery_regeneration","sleep_regulators","anti_inflammation"], avoid_groups: ["stimulants"], intensity: 1.2 },
  muscle_growth: { effect_priority: { muscle_growth: 1.0, gh_igf_axis: 1.0 }, preferred_groups: ["muscle_growth","gh_igf_axis","recovery_regeneration"], avoid_groups: [], intensity: 1.3 },
  gi_healing: { effect_priority: { gi_healing: 1.0, liver_support: 0.9 }, preferred_groups: ["gi_healing","detox_liver","immune_support"], avoid_groups: ["stimulants"], intensity: 1.1 },
  immune_support: { effect_priority: { immune_boost: 1.0, anti_inflammation: 0.9 }, preferred_groups: ["immune_support","anti_inflammation","gi_healing"], avoid_groups: [], intensity: 1.0 },
  mitochondria: { effect_priority: { mitochondria: 1.0, energy: 0.9 }, preferred_groups: ["mitochondrial_support","fat_loss_agents"], avoid_groups: [], intensity: 1.2 },
  cardio_support: { effect_priority: { cardio_support: 1.0, anti_inflammation: 0.8 }, preferred_groups: ["cardio_support","anti_inflammation"], avoid_groups: [], intensity: 1.0 }
};

const EFFECT_WEIGHTS: Record<string, number> = { energy: 0.85, focus: 0.90, focus_boost: 0.95, memory: 0.85, mood: 0.75, anti_stress: 0.80, sleep: 0.90, fat_loss: 0.85, insulin_sensitivity: 0.90, thyroid_support: 0.80, mitochondria: 0.85, recovery: 0.90, muscle_growth: 0.95, gh_igf_axis: 0.95, cardio_support: 0.80, hydration: 0.60, bone_support: 0.55, immune_boost: 0.75, anti_inflammation: 0.90, detox: 0.70, liver_support: 0.85, gi_healing: 0.90, absorption: 0.65, hormone_balance: 0.75 };

const SYNERGY_MATRIX: Record<string, Record<string, number>> = {
  energy: { energy:0, focus:1, mood:1, anti_stress:-1, sleep:-2, fat_loss:2, mitochondria:2, recovery:0, cardio_support:1, insulin_sensitivity:1, memory:1, focus_boost:1 },
  focus: { energy:1, focus:0, mood:1, anti_stress:1, sleep:-1, fat_loss:1, mitochondria:1, recovery:0, memory:2, focus_boost:2 },
  mood: { energy:1, focus:1, mood:0, anti_stress:2, sleep:1, fat_loss:0, recovery:1, hormone_balance:2 },
  anti_stress: { energy:-1, focus:1, mood:2, anti_stress:0, sleep:2, fat_loss:0, recovery:1, gi_healing:1 },
  sleep: { energy:-2, focus:-1, mood:1, anti_stress:2, sleep:0, fat_loss:0, recovery:2, hormone_balance:1 },
  fat_loss: { energy:2, focus:1, mood:0, anti_stress:0, sleep:0, fat_loss:0, mitochondria:2, recovery:0, cardio_support:1, insulin_sensitivity:2, thyroid_support:2 },
  mitochondria: { energy:2, focus:1, mood:0, anti_stress:0, sleep:-1, fat_loss:2, mitochondria:0, recovery:1, cardio_support:1, insulin_sensitivity:1 },
  recovery: { energy:0, focus:0, mood:1, anti_stress:1, sleep:2, fat_loss:0, mitochondria:1, recovery:0, cardio_support:1, anti_inflammation:2, gi_healing:2 },
  cardio_support: { energy:1, focus:0, mood:0, anti_stress:0, sleep:0, fat_loss:1, mitochondria:1, recovery:1, cardio_support:0, insulin_sensitivity:1, hydration:1 },
  insulin_sensitivity: { energy:1, focus:0, mood:0, anti_stress:0, sleep:0, fat_loss:2, mitochondria:1, recovery:0, cardio_support:1, insulin_sensitivity:0 },
  anti_inflammation: { energy:0, focus:0, mood:1, anti_stress:1, sleep:1, fat_loss:1, mitochondria:1, recovery:2, cardio_support:1, insulin_sensitivity:1, anti_inflammation:0, immune_boost:2, gi_healing:2, liver_support:2 },
  immune_boost: { energy:0, focus:0, mood:0, anti_stress:0, sleep:0, fat_loss:0, mitochondria:0, recovery:1, cardio_support:1, insulin_sensitivity:0, anti_inflammation:2, immune_boost:0, gi_healing:1, detox:1 },
  gi_healing: { energy:0, focus:0, mood:0, anti_stress:1, sleep:1, fat_loss:0, mitochondria:0, recovery:2, cardio_support:0, insulin_sensitivity:0, anti_inflammation:2, immune_boost:1, gi_healing:0, detox:2, liver_support:2, hydration:1, absorption:1 },
  detox: { energy:0, focus:0, mood:0, anti_stress:0, sleep:0, fat_loss:1, mitochondria:1, recovery:1, cardio_support:0, insulin_sensitivity:1, anti_inflammation:1, immune_boost:1, gi_healing:2, detox:0, liver_support:2, absorption:1 },
  liver_support: { energy:0, focus:0, mood:0, anti_stress:0, sleep:0, fat_loss:1, mitochondria:1, recovery:1, cardio_support:1, insulin_sensitivity:1, anti_inflammation:2, immune_boost:1, gi_healing:2, detox:2, liver_support:0, absorption:1 },
  hormone_balance: { energy:0, focus:0, mood:2, anti_stress:1, sleep:1, fat_loss:0, mitochondria:0, recovery:1, cardio_support:0, insulin_sensitivity:0, anti_inflammation:1, immune_boost:0, gi_healing:0, detox:0, liver_support:0, hormone_balance:0, bone_support:1, thyroid_support:1 },
  memory: { energy:1, focus:2, mood:1, anti_stress:0, sleep:0, fat_loss:0, mitochondria:1, recovery:0, memory:0, focus_boost:2 },
  focus_boost: { energy:1, focus:2, mood:1, anti_stress:0, sleep:-1, fat_loss:1, mitochondria:1, recovery:0, memory:2, focus_boost:0 },
  hydration: { energy:0, focus:0, mood:0, anti_stress:0, sleep:0, fat_loss:0, mitochondria:0, recovery:1, cardio_support:1, hydration:0, gi_healing:1 },
  absorption: { energy:0, focus:0, mood:0, anti_stress:0, sleep:0, fat_loss:0, mitochondria:0, recovery:0, cardio_support:0, insulin_sensitivity:0, gi_healing:1, detox:1, liver_support:1, absorption:0 },
  bone_support: { energy:0, focus:0, mood:0, anti_stress:0, sleep:0, fat_loss:0, mitochondria:0, recovery:0, cardio_support:0, insulin_sensitivity:0, anti_inflammation:1, hormone_balance:1, bone_support:0, thyroid_support:1 },
  thyroid_support: { energy:1, focus:1, mood:1, anti_stress:0, sleep:0, fat_loss:2, mitochondria:1, recovery:0, cardio_support:1, insulin_sensitivity:1, hormone_balance:1, bone_support:1, thyroid_support:0 },
  cardio_support: { energy:1, focus:0, mood:0, anti_stress:0, sleep:0, fat_loss:1, mitochondria:1, recovery:1, cardio_support:0, insulin_sensitivity:1, anti_inflammation:1, immune_boost:1, liver_support:1, hydration:1, thyroid_support:1 }
};

const CONFLICT_MATRIX: Record<string, Record<string, number>> = {
  caffeine: { caffeine:0, modafinil:1, phenylpiracetam:1, amphetamine:2, melatonin:1, glycine:0.5, taurine:0.5, l_theanine:-1, rhodiola:-1 },
  modafinil: { caffeine:1, modafinil:0, phenylpiracetam:1, amphetamine:2, melatonin:1, glycine:0.5, taurine:0.5, l_theanine:-1, rhodiola:-1 },
  phenylpiracetam: { caffeine:1, modafinil:1, phenylpiracetam:0, amphetamine:2, melatonin:1, glycine:0.5, taurine:0.5, l_theanine:-1, rhodiola:-1 },
  melatonin: { caffeine:1, modafinil:1, phenylpiracetam:1, melatonin:0, glycine:-1, taurine:-1, apigenin:-1, ashwagandha:-1, rhodiola:1 },
  glycine: { caffeine:0.5, modafinil:0.5, phenylpiracetam:0.5, melatonin:-1, glycine:0, taurine:-1, apigenin:-1, ashwagandha:-1 },
  taurine: { caffeine:0.5, modafinil:0.5, phenylpiracetam:0.5, melatonin:-1, glycine:-1, taurine:0, apigenin:-1, ashwagandha:-1 }
};

export function generateStack(goal: string, substances: Substance[], blacklist: string[] = [], whitelist: string[] = [], maxSubs = 10): StackResult {
  const profile = GOAL_PROFILES[goal] || GOAL_PROFILES.energy;
  const intensity = profile.intensity || 1.0;
  const filtered = substances.filter(s => !blacklist.includes(resolveSubstanceAlias(s.name)));
  
  const scored = filtered.map(sub => {
    let score = 0;
    sub.effects.forEach(eff => { if (profile.effect_priority[eff]) score += profile.effect_priority[eff] * intensity; });
    profile.preferred_groups.forEach(g => { if (sub.name.includes(g)) score += 1.2; });
    profile.avoid_groups.forEach(g => { if (sub.name.includes(g)) score -= 1.0; });
    return { ...sub, goalScore: score };
  }).filter(s => s.goalScore > 0 || whitelist.includes(resolveSubstanceAlias(s.name)));

  const sorted = scored.sort((a, b) => (b.goalScore + b.effects.length) - (a.goalScore + a.effects.length));
  const stack = sorted.slice(0, maxSubs);

  let penalty = 0; let bonus = 0; const warnings: string[] = []; const errors: string[] = [];

  for (let i = 0; i < stack.length; i++) {
    for (let j = i + 1; j < stack.length; j++) {
      const a = resolveSubstanceAlias(stack[i].name);
      const b = resolveSubstanceAlias(stack[j].name);
      const conflict = CONFLICT_MATRIX[a]?.[b] || CONFLICT_MATRIX[b]?.[a];
      if (conflict === 2) { penalty -= 999; errors.push(`Hard conflict: ${a} + ${b}`); }
      else if (conflict === 1) { penalty -= 2; warnings.push(`Soft conflict: ${a} + ${b}`); }
      else if (conflict === 0.5) { penalty -= 1; warnings.push(`Caution: ${a} + ${b}`); }
      else {
        const syn = SYNERGY_MATRIX[stack[i].effects[0]]?.[stack[j].effects[0]];
        if (syn && syn > 0) bonus += syn;
      }
    }
  }

  const rawScore = stack.reduce((acc, s) => acc + s.goalScore, 0) + bonus + penalty;
  const synergy_score = Math.max(0, Math.min(100, Math.round(rawScore * 10)));

  return { stack, synergy_score, warnings, errors };
}

export function exportStackAsJson(stackResult: StackResult): string {
  return JSON.stringify(stackResult, null, 2);
}

export function exportStackAsText(stackResult: StackResult): string {
  const lines = [`Goal Protocol`, `Synergy Score: ${stackResult.synergy_score}%`, '', `Stack:`];
  stackResult.stack.forEach((s, i) => lines.push(`${i + 1}. ${s.name} — effects: ${s.effects.join(', ')}`));
  if (stackResult.warnings.length) lines.push('', `Warnings:`, ...stackResult.warnings.map(w => `• ${w}`));
  if (stackResult.errors.length) lines.push('', `Errors:`, ...stackResult.errors.map(e => `🛑 ${e}`));
  return lines.join('\n');
}