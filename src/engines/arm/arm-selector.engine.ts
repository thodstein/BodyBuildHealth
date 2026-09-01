/**
 * arm-selector.engine.ts — подбор арм-сплита по параметрам.
 * Зеркало bb-selector.engine.ts / lms-selector.
 */
import { ARM_SPLIT_PATTERNS, type SplitPattern } from './arm-split-patterns';
import { TAG_MUSCLES_ARM } from './arm-day-types';
import { normLevel } from '../volume-landmarks.engine';

export type ArmGoal = 'strength' | 'peaking' | 'hypertrophy' | 'endurance' | 'maintenance';

export interface ArmSelectorInput {
  level: string;
  goal?: ArmGoal | string;
  technique?: string; // hook/toproll/press/balanced
  discipline?: string; // armwrestling/armlifting/hybrid
  daysPerWeek?: number;
  gripFocus?: string;
  weakPoints?: string[];
  equipment?: string[];
  injuries?: Array<{ muscle: string; exclude?: boolean }>;
  mobilityRestrictions?: string[];
  donorMuscles?: string[];
  specialization?: boolean;
}

export interface ArmRankedPattern {
  pattern: SplitPattern;
  score: number;
  rationale: string[];
  warnings: string[];
}

function muscleFreq(p: SplitPattern): Record<string, number> {
  const tagCounts: Record<string, number> = {};
  for (const d of p.schedule) {
    if (d.kind !== 'тренировка' || !d.sessionTag) continue;
    tagCounts[d.sessionTag] = (tagCounts[d.sessionTag] || 0) + 1;
  }
  const freq: Record<string, number> = {};
  for (const [tag, count] of Object.entries(tagCounts)) {
    const muscles = TAG_MUSCLES_ARM[tag] || [tag];
    for (const m of muscles) {
      freq[m] = (freq[m] || 0) + count * 7 / p.rotationDays;
    }
  }
  return freq;
}

export function rankArmSplits(input: ArmSelectorInput): ArmRankedPattern[] {
  const lvl = normLevel(input.level);
  const out: ArmRankedPattern[] = [];
  const goal = (input.goal || 'strength').toString().toLowerCase();
  const technique = (input.technique || 'balanced').toLowerCase();
  const discipline = (input.discipline || 'armwrestling').toLowerCase();

  for (const p of ARM_SPLIT_PATTERNS) {
    let score = 0;
    const rationale: string[] = [];
    const warnings: string[] = [];

    // level
    if (p.level.includes(lvl)) { score += 30; rationale.push(`уровень ${lvl} подходит`); }
    else if (p.level.some(l => l.toLowerCase() === lvl)) { score += 30; rationale.push(`уровень ${lvl} подходит`); }
    else { score -= 15; warnings.push(`уровень ${lvl} вне ${p.level.join('/')}`); }

    // daysPerWeek
    if (input.daysPerWeek != null) {
      const eff = p.sessionsPerRotation * 7 / p.rotationDays;
      const over = eff - input.daysPerWeek;
      const abs = Math.abs(over);
      if (abs < 0.6) { score += 25; rationale.push(`дней ${eff.toFixed(1)} ~ ${input.daysPerWeek}`); }
      else if (abs <= 1.2) { score += 10; rationale.push(`дней ${eff.toFixed(1)} близко к ${input.daysPerWeek}`); }
      else if (abs <= 2) { score -= 5; warnings.push(`дней ${eff.toFixed(1)} далеко от ${input.daysPerWeek}`); }
      else { score -= 15; warnings.push(`дней ${eff.toFixed(1)} сильно мимо ${input.daysPerWeek}`); }
    }

    // goal bias
    if (goal === 'strength' || goal === 'peaking') {
      if (p.id.includes('arm_5') || p.id.includes('arm_4')) { score += 10; rationale.push('тяж-дни для силы'); }
      if (p.id.includes('grip_')) {
        if (discipline === 'armlifting') { score += 12; rationale.push('хват-сплит для армлифтинга'); }
        else { score -= 5; warnings.push('хват-сплит при armwrestling'); }
      }
    } else if (goal === 'hypertrophy') {
      if (p.id.includes('arm_3') || p.id.includes('arm_4')) { score += 8; rationale.push('объём для массы'); }
    } else if (goal === 'endurance') {
      if (p.schedule.some(s => s.character === 'памп')) { score += 8; rationale.push('памп для выносливости'); }
    }

    // technique
    if (technique === 'hook') {
      if (['TableHeavy','Hammer','TableSupination'].some(t => p.schedule.some(s => s.sessionTag === t))) { score += 8; rationale.push('hook → молот/супинация есть'); }
    } else if (technique === 'toproll') {
      if (['TableHeavy','TablePronation','GripHeavy'].some(t => p.schedule.some(s => s.sessionTag === t))) { score += 8; rationale.push('toproll → пронация/хват есть'); }
    } else if (technique === 'press') {
      if (p.schedule.some(s => s.sessionTag === 'SidePress' || s.sessionTag === 'Support')) { score += 8; rationale.push('press → боковое есть'); }
    }

    // discipline
    if (discipline === 'armwrestling' && p.id.startsWith('grip_')) { score -= 10; warnings.push('grip-сплит не для армрестлинга'); }
    if (discipline === 'armlifting' && p.id.startsWith('arm_2')) { score -= 5; warnings.push('стол-сплит не для армлифтинга'); }
    if (discipline === 'hybrid' && p.id === 'hybrid_4_arm_pl') { score += 12; rationale.push('гибрид-сплит'); }

    // gripFocus
    if (input.gripFocus) {
      const gf = input.gripFocus.toLowerCase();
      if (gf === 'support' && p.id.includes('support')) { score += 8; rationale.push('support хват'); }
      if (gf === 'pinch' && p.id.includes('pinch')) { score += 8; rationale.push('pinch хват'); }
      if (gf === 'crush' && p.id.includes('crush')) { score += 8; rationale.push('crush хват'); }
    }

    // weakPoints boost (granular → canonical via lower)
    if (input.weakPoints && input.weakPoints.length > 0) {
      const freq = muscleFreq(p);
      for (const wp of input.weakPoints) {
        const key = wp.toLowerCase();
        if (freq[key] && freq[key] >= 1.5) { score += 6; rationale.push(`слабое ${wp} часто в сплите`); }
      }
    }

    // donor penalty
    if (input.donorMuscles && input.donorMuscles.length > 0) {
      const freq = muscleFreq(p);
      for (const d of input.donorMuscles) {
        const key = d.toLowerCase();
        if (freq[key] && freq[key] >= 2) { score -= 8; warnings.push(`донор ${d} часто встречается — штраф`); }
      }
    }

    // equipment
    if (input.equipment && input.equipment.length > 0) {
      const hasTable = input.equipment.some(e => /стол|table/i.test(e));
      const hasGrip = input.equipment.some(e => /grip|хват|hub|pinch/i.test(e));
      if (!hasTable && p.schedule.some(s => s.sessionTag?.toLowerCase().includes('table'))) {
        score -= 12; warnings.push('нет стола, но сплит требует стол');
      }
      if (!hasGrip && p.id.startsWith('grip_')) {
        score -= 12; warnings.push('нет хвата-оборудования');
      }
    }

    // injuries
    if (input.injuries && input.injuries.length > 0) {
      const injured = new Set(input.injuries.filter(i => i.exclude).map(i => i.muscle.toLowerCase()));
      const freq = muscleFreq(p);
      for (const im of injured) {
        if (freq[im] && freq[im] > 0) { score -= 20; warnings.push(`травма ${im} — сплит нагружает`); }
        if (im === 'side_pressure' && p.schedule.some(s => s.sessionTag === 'SidePress')) {
          score -= 25; warnings.push('side_pressure травма + side сплит');
        }
      }
    }

    // specialization: FullArm не дефолт
    if (input.specialization && p.id === 'arm_2_table_support') {
      score -= 6; warnings.push('специализация → 2× недостаточно');
    }

    out.push({ pattern: p, score, rationale, warnings });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

export function selectBestArmSplit(input: ArmSelectorInput): SplitPattern {
  const ranked = rankArmSplits(input);
  return ranked[0]?.pattern || ARM_SPLIT_PATTERNS[0];
}
