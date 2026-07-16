/**
 * bb-selector.engine.ts — подбор BB-сплита по параметрам (Этап BB7).
 * Scoring + rationale по аналогии с lms-selector / split-selector.
 */
import { SPLIT_PATTERNS, type SplitPattern } from './bb-split-patterns';
import { normLevel } from '../volume-landmarks.engine';
import { TAG_MUSCLES } from './bb-day-types';

export type BBGoal = 'mass' | 'cut' | 'recomp' | 'maintenance' | 'strength_mass';
export type BBLevel = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';

export interface BBSelectorInput {
  level: string;
  goal: BBGoal;
  daysPerWeek?: number;
  weakPoints?: string[];
  mode?: 'natural' | 'on_course' | 'pct';
}

export interface BBRankedPattern {
  pattern: SplitPattern;
  score: number;
  rationale: string[];
  warnings: string[];
}

// FIX-8: TAG_MUSCLES — единый источник в bb-day-types.ts (было дублировано без LegsBiceps)

function muscleFreq(p: SplitPattern): Record<string, number> {
  const tagCounts: Record<string, number> = {};
  for (const d of p.schedule) {
    if (d.kind !== 'тренировка' || !d.sessionTag) continue;
    tagCounts[d.sessionTag] = (tagCounts[d.sessionTag] || 0) + 1;
  }
  const freq: Record<string, number> = {};
  for (const [tag, count] of Object.entries(tagCounts)) {
    const muscles = TAG_MUSCLES[tag] || [tag];
    for (const m of muscles) {
      freq[m] = (freq[m] || 0) + count * 7 / p.rotationDays;
    }
  }
  return freq;
}

export function rankBBSplits(input: BBSelectorInput): BBRankedPattern[] {
  const lvl = normLevel(input.level);
  const out: BBRankedPattern[] = [];
  for (const p of SPLIT_PATTERNS) {
    let score = 0; const rationale: string[] = []; const warnings: string[] = [];
    const freq = muscleFreq(p);
    const allFreqs = Object.values(freq);
    const avgFreq = allFreqs.length > 0 ? allFreqs.reduce((a,b)=>a+b,0)/allFreqs.length : 1;

    if (p.level.includes(lvl)) { score += 30; rationale.push(`уровень ${lvl} подходит`); }
    else { score -= 15; warnings.push(`уровень ${lvl} вне списка ${p.level.join('/')}`); }

    if (input.daysPerWeek != null) {
      const eff = p.sessionsPerRotation * 7 / p.rotationDays;
      if (eff <= input.daysPerWeek + 0.5) { score += 25; rationale.push(`~${eff.toFixed(1)} сессий/нед — укладывается`); }
      else { score -= 20; warnings.push(`~${eff.toFixed(1)} сессий/нед > ${input.daysPerWeek} доступных`); }
    }

    // частота: 2-3×/нед = оптимально для гипертрофии
    if (avgFreq >= 2 && avgFreq <= 3) { score += 18; rationale.push(`частота ${avgFreq.toFixed(1)}×/нед на группу — оптимум гипертрофии`); }
    else if (avgFreq > 3) { score += 8; rationale.push(`высокая частота ${avgFreq.toFixed(1)}×/нед`); }
    else { score += 3; rationale.push(`классическая частота ${avgFreq.toFixed(1)}×/нед`); }

    // массонабор: частота 2+×/нед + высокообъёмные сплиты
    if (input.goal === 'mass' || input.goal === 'strength_mass') {
      if (avgFreq >= 2) score += 12;
      if (['ppl_6','rolling_3_1_3_1','arnold_6','fullbody_4','tpt_o_ttp','bro_5'].includes(p.id)) score += 10;
    }
    if (input.goal === 'maintenance') {
      if (avgFreq <= 2) score += 12;
      if (['fullbody_2','fullbody_3','upper_lower_4','push_pull_2'].includes(p.id)) score += 8;
    }
    if (input.goal === 'cut' || input.goal === 'recomp') {
      if (avgFreq <= 2) score += 10;
      if (['upper_lower_4','upper_lower_3','fullbody_3','fullbody_2','push_pull_2'].includes(p.id)) score += 10;
    }

    // слабые группы: частота 2+×/нед = бонус
    if (input.weakPoints && input.weakPoints.length > 0) {
      const wpFreq = input.weakPoints.map(w => freq[w] || 0);
      const wpAvg = wpFreq.reduce((a,b)=>a+b,0)/wpFreq.length;
      if (wpAvg >= 2) score += 10;
    }

    if (lvl === 'enhanced' && ['ppl_6','rolling_3_1_3_1','tpt_o_ttp','fullbody_4','arnold_6'].includes(p.id)) {
      score += 10;
    }

    out.push({ pattern: p, score, rationale, warnings });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function selectBestBBSplit(input: BBSelectorInput): BBRankedPattern | null {
  return rankBBSplits(input)[0] ?? null;
}

export function explainBBSelection(r: BBRankedPattern): string {
  return [`«${r.pattern.name}» — скор ${r.score}`, ...r.rationale.map(x => '✓ ' + x), ...r.warnings.map(x => '⚠ ' + x)].join('\n');
}

/** Частота мышечных групп (раз/нед) для отображения в карточке сплита. */
export function getMuscleFrequencies(p: SplitPattern): { tag: string; freq: number }[] {
  const tagCounts: Record<string, number> = {};
  for (const d of p.schedule) {
    if (d.kind !== 'тренировка' || !d.sessionTag) continue;
    tagCounts[d.sessionTag] = (tagCounts[d.sessionTag] || 0) + 1;
  }
  return Object.entries(tagCounts).map(([tag, count]) => ({
    tag, freq: Math.round(count * 7 / p.rotationDays * 10) / 10,
  }));
}
