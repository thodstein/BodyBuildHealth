/**
 * bb-selector.engine.ts — подбор BB-сплита по параметрам (Этап BB7).
 * Scoring + rationale по аналогии с lms-selector / split-selector.
 */
import { SPLIT_PATTERNS, type SplitPattern } from './bb-split-patterns';
import { normLevel } from '../volume-landmarks.engine';
import { TAG_MUSCLES } from './bb-day-types';
import { WEAK_TO_MUSCLE } from './bb-builder.engine';

export type BBGoal = 'mass' | 'cut' | 'recomp' | 'maintenance' | 'strength_mass';
export type BBLevel = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';

export interface BBSelectorInput {
  level: string;
  goal: BBGoal;
  daysPerWeek?: number;
  weakPoints?: string[];
  mode?: 'natural' | 'on_course' | 'pct';
  /** D1: Female glute focus — даёт бонус female_glute_5 сплиту. */
  sex?: 'male' | 'female';
  /** D1: Focus group — даёт бонус сплитам с приоритетом этой мышцы. */
  focusGroup?: string;
  /** Доноры specialization tradeoff: leg-heavy/arms-heavy splits получают
   *  штраф, чтобы рекомендация не возвращала ресурс выбранного донора. */
  donorMuscles?: string[];
  /** Активна специализация: FullBody не является автоматическим default. */
  specialization?: boolean;
  /** PED для адаптации ранжирования (все сплиты адаптируются, выбор сохранён). */
  peds?: string[];
  pedDoses?: Record<string, number>;
  /** Выбранный пресет методики (DC/Fortitude/Meadows) — мягкая подсказка. */
  preset?: string;
  /** Оборудование — влияет на пригодность сплита (ограниченный инвентарь → FullBody/UpperLower предпочтительнее) */
  equipment?: string[];
  /** Травмы — сплиты с высокой частотой травмированной группы получают штраф */
  injuries?: Array<{ muscle: string; exclude?: boolean }>;
  /** Ограничения мобильности — аналогично травмам */
  mobilityRestrictions?: string[];
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
      const overage = eff - input.daysPerWeek;
      // FIX-B6: graduated penalty вместо бинарного +25/-20.
      // 0 дней сверх → +25, 1 день сверх → +10, 2 дня сверх → -5, 3+ → -15
      if (overage <= 0.5) {
        score += 25;
        rationale.push(`~${eff.toFixed(1)} сессий/нед — укладывается`);
      } else if (overage <= 1.5) {
        score += 10;
        rationale.push(`~${eff.toFixed(1)} сессий/нед — чуть больше ${input.daysPerWeek}, но допустимо`);
      } else if (overage <= 2.5) {
        score -= 5;
        warnings.push(`~${eff.toFixed(1)} сессий/нед > ${input.daysPerWeek} (превышение +${overage.toFixed(1)})`);
      } else {
        score -= 15;
        warnings.push(`~${eff.toFixed(1)} сессий/нед > ${input.daysPerWeek} (превышение +${overage.toFixed(1)})`);
      }
    }

    // частота: 2-3×/нед = оптимально для гипертрофии
    if (avgFreq >= 2 && avgFreq <= 3) { score += 18; rationale.push(`частота ${avgFreq.toFixed(1)}×/нед на группу — оптимум гипертрофии`); }
    else if (avgFreq > 3) { score += 8; rationale.push(`высокая частота ${avgFreq.toFixed(1)}×/нед`); }
    else { score += 3; rationale.push(`классическая частота ${avgFreq.toFixed(1)}×/нед`); }

    // массонабор: частота 2+×/нед + высокообъёмные сплиты.
    // Дифференцируем PPL-семейство, чтобы рекомендация была ОДНОЙ ясной PPL,
    // а не «пять почти одинаковых PPL-вариантов» (жалоба: tpt_o_ttp/arnold_6/
    // rolling_3_1_3_1 выглядели как одно и то же).
    if (input.goal === 'mass' || input.goal === 'strength_mass') {
      if (avgFreq >= 2) score += 12;
      if (p.id === 'ppl_6') score += 12;                    // канонический PPL — главная рекомендация
      else if (p.id === 'arnold_6') score += 8;             // Арнольд — альтернатива (акцент на плечи/руки)
      else if (['fullbody_4', 'tpt_o_ttp', 'rolling_3_1_3_1'].includes(p.id)) score += 4;
    }
    // P1-2: bro_5 penalty — низкая частота 1×/нед
    if (p.id === 'bro_5') {
      score -= 5;
      warnings.push('⚠ Низкая частота 1×/нед на группу; ≥2×/нед результативнее для натуралов (Schoenfeld 2018).');
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
      // P1-5 (audit 2026-08): маппим гранулярные слабые группы (chest_upper, back_width,
      // delt_mid) в канонические мышцы через WEAK_TO_MUSCLE — раньше freq['chest_upper']=0
      // и бонус слабых групп никогда не срабатывал для гранулярных ключей.
      const wpFreq = input.weakPoints.map(w => {
        const canonical = WEAK_TO_MUSCLE[w] || w;
        return freq[canonical] || freq[w] || 0;
      });
      const wpAvg = wpFreq.reduce((a,b)=>a+b,0)/wpFreq.length;
      if (wpAvg >= 2) score += 10;
    }

    // Донорская специализация влияет на ВЫБОР сплита, но не меняет
    // volume-landmarks. Донор legs не должен получать leg-heavy рекомендацию.
    const donorAtomic = new Set((input.donorMuscles || []).flatMap(d => {
      if (d === 'legs') return ['quads', 'hamstrings', 'glutes', 'calves'];
      if (d === 'arms') return ['biceps', 'triceps', 'forearms'];
      if (d === 'core') return ['abs'];
      return [WEAK_TO_MUSCLE[d] || d];
    }));
    const legDonor = ['quads', 'hamstrings', 'glutes', 'calves'].some(m => donorAtomic.has(m));
    const armDonor = ['biceps', 'triceps', 'forearms'].some(m => donorAtomic.has(m));
    const legSessions = p.schedule.filter(d => d.kind === 'тренировка' && /Legs|Lower/i.test(d.sessionTag || '')).length;
    const armSessions = p.schedule.filter(d => d.kind === 'тренировка' && /Arms/i.test(d.sessionTag || '')).length;
    if (legDonor && legSessions > 0) {
      score -= legSessions * 8;
      rationale.push(`доноры ног: снижена рекомендация leg-heavy (${legSessions} ножных сессий)`);
    }
    if (armDonor && armSessions > 0) {
      score -= armSessions * 5;
      rationale.push(`доноры рук: снижена рекомендация отдельного Arms-дня`);
    }
    if (input.specialization && /^fullbody_/i.test(p.id)) {
      score -= 10;
      rationale.push('специализация: FullBody не выбран автоматически, приоритет специализированным сессиям');
    }

    // D1: Female glute focus — бонус для female_glute_5 сплита.
    if (input.sex === 'female' && input.focusGroup === 'glutes') {
      if (p.id === 'female_glute_5') {
        score += 25;
        rationale.push('♀ Женский glute-фокус: 3 glute-сессии/нед (Schoenfeld 2016)');
      }
      if (p.id === 'glute_focus_4') {
        score += 15;
        rationale.push('♀ Glute focus 4×/нед — альтернатива для 4 дней');
      }
    }

    if (lvl === 'enhanced') {
      if (p.id === 'ppl_6') score += 8;
      else if (['arnold_6', 'fullbody_4'].includes(p.id)) score += 6;
      else if (['rolling_3_1_3_1', 'tpt_o_ttp'].includes(p.id)) score += 3;
    }

    // PED-адаптация ранжирования: все сплиты масштабируются, бонус мягкий (+3..+5), не навязывает.
    const hasAAS = (input.peds || []).some(x => String(x).toLowerCase().includes('aas') || String(x).toLowerCase().includes('тест')) || Number((input.pedDoses as any)?.['AAS'] || 0) >= 500;
    const hasGH = (input.peds || []).includes('GH' as any) || Number((input.pedDoses as any)?.['GH'] || 0) > 0;
    const hasIns = (input.peds || []).includes('insulin' as any) || Number((input.pedDoses as any)?.['insulin'] || 0) > 0;
    if (hasAAS && (p.id === 'arnold_6' || p.id === 'bro_5')) { score += 3; rationale.push('AAS: bro/Arnold допустим (длинный синтез)'); }
    if (hasGH && hasIns && (p.id === 'upper_lower_5' || p.id === 'fullbody_4')) { score += 3; rationale.push('GH+insulin: частый памп-сплит предпочтителен'); }
    if (!hasAAS && (p.id === 'bro_5')) { score -= 2; warnings.push('Натурал: bro 1×/нед — неоптимально, лучше 2×/нед'); }

    // Пресет-подсказка (мягко)
    if (input.preset === 'dc' && (p.id === 'upper_lower_4' || p.id === 'ppl_6')) { score += 4; rationale.push('DC пресет: Upper/Lower/PPL подходит'); }
    if (input.preset === 'fortitude' && (p.id === 'upper_lower_5' || p.id === 'fullbody_4')) { score += 4; rationale.push('Fortitude: частый сплит'); }
    if (input.preset === 'meadows' && (p.id === 'ppl_6' || p.id === 'arnold_6')) { score += 4; rationale.push('Meadows: PPL/Arnold для pre-exhaust'); }

    // Оборудование — ограниченный инвентарь (только bodyweight/гантели) → FullBody/UpperLower предпочтительнее, изолированные сплиты штрафуются
    if (input.equipment && input.equipment.length>0) {
      const hasBarbell = input.equipment.includes('barbell');
      const hasMachine = input.equipment.includes('machine');
      const hasCable = input.equipment.includes('cable');
      const limited = !hasBarbell && !hasMachine;
      if (limited) {
        if (['fullbody_2','fullbody_3','fullbody_4','upper_lower_3','upper_lower_4'].includes(p.id)) { score += 4; rationale.push('оборудование ограничено → FullBody/UpperLower предпочтителен'); }
        if (['bro_5','arnold_6','ppl_6'].includes(p.id) && !hasCable) { score -= 3; warnings.push('оборудование ограничено — PPL/Bro требует больше инвентаря'); }
      }
    }
    // Травмы и мобильность — сплиты с высокой частотой травмированной группы штрафуются
    const injuredMuscles = new Set<string>();
    for (const inj of (input.injuries || [])) {
      const m = String(inj.muscle || '').toLowerCase();
      const canon = (WEAK_TO_MUSCLE as any)[m] || m;
      injuredMuscles.add(canon);
      injuredMuscles.add(m);
    }
    for (const mr of (input.mobilityRestrictions || [])) {
      const m = String(mr || '').toLowerCase();
      const canon = (WEAK_TO_MUSCLE as any)[m] || m;
      injuredMuscles.add(canon);
    }
    if (injuredMuscles.size>0) {
      let injFreq = 0;
      for (const im of injuredMuscles) injFreq += freq[im] || 0;
      if (injFreq >= 2) {
        const penalty = Math.min(12, Math.round(injFreq*4));
        score -= penalty;
        warnings.push(`травмы/ограничения ${Array.from(injuredMuscles).slice(0,2).join(',')} — частота ${injFreq.toFixed(1)}×/нед → штраф −${penalty}`);
        rationale.push(`учтены травмы/ограничения: снижена частота травмированных групп`);
      }
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
