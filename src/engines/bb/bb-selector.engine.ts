/**
 * bb-selector.engine.ts — подбор BB-сплита по параметрам (Этап BB7).
 * Scoring + rationale по аналогии с lms-selector / split-selector.
 */
import { SPLIT_PATTERNS, type SplitPattern } from './bb-split-patterns';
import { normLevel } from '../volume-landmarks.engine';

export type BBGoal = 'mass' | 'cut' | 'recomp' | 'maintenance' | 'strength_mass';
export type BBLevel = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';

export interface BBSelectorInput {
  level: string;
  goal: BBGoal;
  daysPerWeek?: number;     // доступных дней (примерно, т.к. rolling-ротации не 7-дн)
  weakPoints?: string[];
  mode?: 'natural' | 'on_course' | 'pct';
}

export interface BBRankedPattern {
  pattern: SplitPattern;
  score: number;
  rationale: string[];
  warnings: string[];
}

export function rankBBSplits(input: BBSelectorInput): BBRankedPattern[] {
  const lvl = normLevel(input.level);
  const out: BBRankedPattern[] = [];
  for (const p of SPLIT_PATTERNS) {
    let score = 0; const rationale: string[] = []; const warnings: string[] = [];
    // уровень
    if (p.level.includes(lvl)) { score += 30; rationale.push(`уровень ${lvl} подходит`); }
    else { score -= 15; warnings.push(`уровень ${lvl} вне списка ${p.level.join('/')}`); }
    // доступные дни vs сессий в ротации
    if (input.daysPerWeek != null) {
      const eff = p.sessionsPerRotation * 7 / p.rotationDays; // сессий/нед
      if (eff <= input.daysPerWeek + 0.5) { score += 25; rationale.push(`~${eff.toFixed(1)} сессий/нед ≤ доступно ${input.daysPerWeek}`); }
      else { score -= 20; warnings.push(`~${eff.toFixed(1)} сессий/нед > доступно ${input.daysPerWeek}`); }
    }
    // цель: mass/strength_mass → больше объёма (ppl_6, rolling_3_1_3_1, tpt_o_ttp); cut/recomp → умеренно; maintenance → fullbody/upper_lower
    if ((input.goal === 'mass' || input.goal === 'strength_mass') && ['ppl_6', 'rolling_3_1_3_1', 'tpt_o_ttp', 'rolling_4_1'].includes(p.id)) {
      score += 20; rationale.push('высокий объём под массонабор');
    }
    if (input.goal === 'maintenance' && ['fullbody_3', 'upper_lower_4'].includes(p.id)) {
      score += 15; rationale.push('умеренная частота под поддержание');
    }
    if (input.goal === 'cut' && ['upper_lower_4', 'rolling_4_1'].includes(p.id)) {
      score += 12; rationale.push('умеренный объём под рельеф (сохранить мышцы)');
    }
    // enhanced → продвинутые паттерны
    if (lvl === 'enhanced' && ['ppl_6', 'rolling_3_1_3_1', 'tpt_o_ttp'].includes(p.id)) { score += 10; rationale.push('толерантность к объёму на курсе'); }
    out.push({ pattern: p, score, rationale, warnings });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function selectBestBBSplit(input: BBSelectorInput): BBRankedPattern | null {
  return rankBBSplits(input)[0] ?? null;
}

export function explainBBSelection(r: BBRankedPattern): string {
  return [`«${r.pattern.name}» — скоринг ${r.score}`, ...r.rationale.map(x => '✓ ' + x), ...r.warnings.map(x => '! ' + x)].join('\n');
}