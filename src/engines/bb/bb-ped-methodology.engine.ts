/**
 * bb-ped-methodology.engine.ts — PED-специфичная методика (не ломает тяж/памп дни).
 *
 * Дает РЕКОМЕНДАЦИИ по схеме/отбору/пери-WO, но не переписывает character дня.
 * Joint-guard работает на уровне пула (фильтр упражнений), insulin-window — только
 * на памп-дни внутри окна, pumped. Сохраняет инварианты builder.
 */
import type { RepSchemeId } from './bb-rep-schemes.engine';
import { schemeFor, type SchemeForInput } from './bb-rep-schemes.engine';
import type { BBPhase } from '../periodization';
import { resolvePedPhase, describePedPhase, insulinSafetyCheck, type PedPhase, type InsulinSafety } from './bb-ped-phasing.engine';
import type { SessionMethodology } from './bb-session-order.engine';

export type PED = 'AAS' | 'insulin' | 'MGF' | 'IGF1' | 'GH';

export interface PEDMethodology {
  /** Активен ли инсулиновый памп-окно (GH+insulin). */
  insulinPumpWindow: boolean;
  /** Нужен ли joint guard (GH solo или GH+AAS high). */
  jointGuard: boolean;
  /** Разрешен ли BFR (GH/insulin). */
  bfrAllowed: boolean;
  /** Разрешен ли отказ (RIR 0) на compounds (только AAS heavy). */
  failureAllowed: boolean;
  /** Рекомендованная схема для тяж/памп (не форсирует, а подсказывает). */
  recommendedScheme: { heavy: RepSchemeId; pump: RepSchemeId };
  /** Пери-WO углеводы. */
  periWorkout: { carbs: 'high' | 'moderate' | 'low'; intraNote?: string; warning?: string };
  /** Целевая мышца для MGF/IGF1 (локально). */
  mgfTargetMuscles: string[];
  /** Фаза пептидного сигнала на уровне плана (both = чередование по неделям). */
  pedPhase: PedPhase;
  /** По-недельная фаза (длина = недели плана) при both; иначе пусто. */
  pedPhaseByWeek: PedPhase[];
  /** Insulin harm-reduction (null без активного инсулина). */
  insulinSafety: InsulinSafety | null;
  /** Человекочитаемый rationale. */
  rationale: string[];
}

export interface PEDMethodologyInput {
  peds: PED[];
  pedDoses: Record<string, number>;
  level: string;
  goal?: string;
  focus?: import('./bb-goal-types').BBTrainingFocus;
  /**
   * Целевые мышцы для локального MGF/IGF1 (передаёт вызывающий из
   * специализации). Если пусто — локальная пометка не применяется.
   * Фаза 2.9: заменяет заглушки `__mgf_target__`/`__igf_target__`.
   */
  targetMuscles?: string[];
  /** Длина плана в неделях — для блочной фазировки MGF/IGF1 (≥8 = блоки). */
  totalWeeks?: number;
  /**
   * Ручной оверрайд фазы (UI-селектор): 'auto' (по стеку), 'proliferation'
   * (форсить MGF-режим все недели), 'differentiation' (форсить IGF1-режим).
   * Применяется к pedPhase и pedPhaseByWeek целиком.
   */
  phaseOverride?: 'auto' | 'proliferation' | 'differentiation';
}

function has(peds: PED[], k: PED): boolean { return peds.includes(k); }
function dose(doses: Record<string, number>, k: string): number {
  const raw = doses[k];
  if (typeof raw === 'number') return raw;
  if (raw != null) return parseFloat(String(raw).replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
  return 0;
}

export function recommendPEDMethodology(input: PEDMethodologyInput): PEDMethodology {

  const { peds, pedDoses, level } = input;
  const AAS = dose(pedDoses, 'AAS');
  const GH = dose(pedDoses, 'GH');
  const INS = dose(pedDoses, 'insulin');
  const MGF = dose(pedDoses, 'MGF');
  const IGF1 = dose(pedDoses, 'IGF1');
  const hasAAS = has(peds, 'AAS') && AAS > 0;
  const hasGH = has(peds, 'GH') && GH > 0;
  const hasIns = has(peds, 'insulin') && INS > 0;
  const hasMGF = has(peds, 'MGF') && MGF > 0;
  const hasIGF1 = has(peds, 'IGF1') && IGF1 > 0;

  const ghPlusInsulin = hasGH && hasIns && GH >= 2 && INS >= 5;
  const isHeavyAAS = hasAAS && AAS >= 750;
  const isAdv = level === 'advanced' || level === 'enhanced';

  const rationale: string[] = [];
  let insulinPumpWindow = false;
  let jointGuard = false;
  let bfrAllowed = false;
  let failureAllowed = false;
  const mgfTargetMuscles: string[] = [];

  // Joint guard: GH solo (любая доза) или GH+AAS (суставы не успевают)
  if (hasGH && GH >= 4) { jointGuard = true; rationale.push(`GH ${GH} МЕ/день — joint guard: приоритет машин/кабелей, темп 4-2-1-0`); }
  if (ghPlusInsulin && GH >= 4 && hasAAS) { jointGuard = true; rationale.push('GH+AAS — связки отстают от мышц — joint guard усилен'); }

  // BFR allowed при GH/insulin
  if (hasGH || hasIns) { bfrAllowed = true; rationale.push('BFR разрешён (GH/insulin — памп без осевой)'); }

  // Failure только при heavy AAS и продвинутом уровне
  if (isHeavyAAS && isAdv) { failureAllowed = true; rationale.push(`AAS ${AAS}мг — отказ (RIR 0) разрешён на compounds`); }
  else if (hasAAS) { rationale.push(`AAS ${AAS}мг — RIR 0 только на изоляциях, compounds RIR≥1`); }

  // Insulin pump window — только когда GH+insulin вместе (синергия IGF-1 печенью)
  if (ghPlusInsulin) {
    insulinPumpWindow = true;
    rationale.push(`GH+insulin синергия (GH ${GH}МЕ + инсулин ${INS}МЕ) — памп-окно активно: инсулин работает как шунт IGF-1`);
  } else if (hasIns && !hasGH) {
    rationale.push('⚠ Инсулин solo без GH/AAS — риск жира: углеводы вокруг тренировки должны быть точно дозированы, GH рекомендуется для синергии (PMC5723243)');
  }

  // MGF/IGF1 локально — целевая мышца (специализация) получает +1 частоту и
  // myo-reps/lengthened приоритет. Заполняется РЕАЛЬНОЙ целью (Фаза 2.9),
  // а не заглушкой `__mgf_target__`.
  if (hasMGF || hasIGF1) {
    const targets = (input.targetMuscles || []).filter(Boolean);
    if (targets.length > 0) {
      mgfTargetMuscles.push(...targets);
      rationale.push(`MGF ${MGF}мкг / IGF1 ${IGF1}мкг — локальный рост: ${targets.join(', ')} получает +1 частоту, памп 15-20 + myo-reps/lengthened`);
    } else {
      rationale.push(`MGF ${MGF}мкг / IGF1 ${IGF1}мкг — локальный рост: добавьте целевую мышцу специализации для +1 частоты и myo-reps/lengthened`);
    }
  }

  // Фазировка MGF/IGF1 (bb-ped-phasing): оба пептида сразу = чередование
  // по неделям (короткий план) или блоки (≥8 нед), не одновременно.
  // Ручной оверрайд из UI форсит фазу на все недели (оба пептида включительно).
  const totalWeeks = Math.max(1, Math.round(input.totalWeeks || 1));
  const bothPeptides = hasMGF && hasIGF1;
  const override = input.phaseOverride === 'proliferation' || input.phaseOverride === 'differentiation' ? input.phaseOverride : null;
  const pedPhase: PedPhase = override ?? (bothPeptides ? 'both' : hasMGF ? 'proliferation' : hasIGF1 ? 'differentiation' : 'none');
  const pedPhaseByWeek: PedPhase[] = override
    ? Array.from({ length: totalWeeks }, () => override)
    : bothPeptides
      ? Array.from({ length: totalWeeks }, (_, i) => resolvePedPhase({ peds, pedDoses, weekIdx: i + 1, totalWeeks }))
      : [];
  if (override) {
    rationale.push(`🧬 Фаза вручную: ${describePedPhase(override)} — все ${totalWeeks} нед (оверрайд авто-фазировки)`);
  } else if (bothPeptides) {
    const firstDiff = pedPhaseByWeek.findIndex(p => p === 'differentiation');
    rationale.push(totalWeeks >= 8 && firstDiff > 0
      ? `MGF+IGF1 блоками: нед 1–${firstDiff} пролиферация (MGF), нед ${firstDiff + 1}–${totalWeeks} дифференцировка (IGF1) — одновременно мешают друг другу (Matheny 2010)`
      : 'MGF+IGF1 чередованием: нечётные недели — пролиферация (MGF + повреждение/стретч), чётные — дифференцировка (IGF1 + углеводное окно)');
  } else if (hasMGF || hasIGF1) {
    rationale.push(`🧬 ${describePedPhase(pedPhase)}`);
  }

  // Insulin harm-reduction (только предупреждения, объём не меняем).
  const safety = insulinSafetyCheck(peds, pedDoses);
  for (const w of safety.warnings) rationale.push(`🛡 ${w}`);

  // Рекомендованные схемы (не форсируют, а подсказывают schemeFor)
  const pedProfile: SchemeForInput['pedProfile'] = {
    hasAAS, hasGH, hasInsulin: hasIns, hasMGF, hasIGF1, ghPlusInsulin,
    pedPhase: pedPhase === 'both' ? 'both' : pedPhase === 'none' ? undefined : pedPhase,
  };
  const heavy = schemeFor({ ...input, phase: 'accumulation' as BBPhase, character: 'тяж', pedProfile });
  const pump = schemeFor({ ...input, phase: 'accumulation' as BBPhase, character: 'памп', pedProfile });

  // Peri-workout
  let periWorkout: PEDMethodology['periWorkout'] = { carbs: 'moderate' };
  if (ghPlusInsulin) {
    periWorkout = { carbs: 'high', intraNote: 'Intra: 30-60г быстрых углеводов + 10г EAA, вода 500мл. Пост: 0.8-1.2г/кг углеводов в течение 60мин после GH+insulin.' };
  } else if (hasIns) {
    periWorkout = { carbs: 'high', intraNote: 'Инсулин solo: intra 40г декстрозы обязательно, контроль глюкозы. Без GH — риск жира.' };
    if (!hasAAS && !hasGH) periWorkout.warning = 'Инсулин без AAS/GH — мало мышц, много жира (Springer 2024)';
  } else if (hasGH) {
    periWorkout = { carbs: 'moderate', intraNote: 'GH: умеренные углеводы, акцент на коллаген/витамин C' };
  } else if (hasAAS) {
    periWorkout = { carbs: 'moderate' };
  }

  return { insulinPumpWindow, jointGuard, bfrAllowed, failureAllowed, recommendedScheme: { heavy, pump }, periWorkout, mgfTargetMuscles, pedPhase, pedPhaseByWeek, insulinSafety: safety.active ? safety : null, rationale };
}

/**
 * Применяет PED-методику к плану БЕЗ ломки тяж/памп.
 * - insulinPumpWindow: только памп-дни получают pump_15_20 + intra note (тяж дни не трогает)
 * - jointGuard: фильтр пула уже применён при отборе (см bb-joint-guard), здесь только помечает rationale
 */
/**
 * Авто-выбор методики порядка по PED-стеку (P1.6).
 * - GH+инсулин (окно: GH≥2 + INS≥5) → 'hyperemia' (памп-окно диктует структуру:
 *   кровь первее веса, intra-углеводы работают в пампе).
 * - MGF (любая доза) → 'mountain_dog' (нужны повреждение/эксцентрик/lengthened/
 *   стретч — фазы 1+4 Meadows; обычный pre_exhaust — противоположность).
 * - Конфликт (GH+INS+MGF): побеждает hyperemia — метаболическое окно
 *   определяет сессию, MGF-повреждение добирается эксцентриком внутри.
 * - FST-7/DC НЕ авто: gated manual options (enhanced+jointGuard=false /
 *   AAS-heavy+advanced) — см. гейты билдера.
 * - Иначе null (оставить выбор юзера). Чистая функция.
 */
export function suggestMethodologyForStack(input: { peds: PED[]; pedDoses?: Record<string, number> }): SessionMethodology | null {
  const doses = input.pedDoses || {};
  const peds = input.peds || [];
  const ghPlusInsulin = has(peds, 'GH') && has(peds, 'insulin') && dose(doses, 'GH') >= 2 && dose(doses, 'insulin') >= 5;
  if (ghPlusInsulin) return 'hyperemia';
  if (has(peds, 'MGF') && dose(doses, 'MGF') > 0) return 'mountain_dog';
  return null;
}

export function applyPEDMethodologyToPlan(plan: import('./bb-builder.engine').BBPlan, meth: PEDMethodology): import('./bb-builder.engine').BBPlan {
  if (!meth.insulinPumpWindow && !meth.jointGuard && !meth.mgfTargetMuscles.length) {
    // Даже без окна — добавить periWorkout rationale
    if (meth.periWorkout.intraNote || meth.periWorkout.warning) {
      const copy: import('./bb-builder.engine').BBPlan = { ...plan, rationale: [...plan.rationale] };
      if (meth.periWorkout.intraNote) copy.rationale.push(`🍚 Peri-WO: ${meth.periWorkout.intraNote}`);
      if (meth.periWorkout.warning) copy.rationale.push(`⚠ ${meth.periWorkout.warning}`);
      copy.rationale.push(...meth.rationale.map(r => `💊 ${r}`));
      return copy;
    }
    if (meth.rationale.length) {
      return { ...plan, rationale: [...plan.rationale, ...meth.rationale.map(r => `💊 ${r}`)] };
    }
    return plan;
  }
  const copy: import('./bb-builder.engine').BBPlan = {
    ...plan,
    weeks: plan.weeks.map(w => ({ ...w, sessions: w.sessions.map(s => ({ ...s, exercises: s.exercises.map(e => ({ ...e, workSets: [...e.workSets] })) })) })),
    rationale: [...plan.rationale],
  };
  // Insulin window: только памп-дни (лёг/памп) — ОДНА peri-WO пометка на
  // сессию (intra-углеводы системные, спам в каждое упражнение не нужен).
  if (meth.insulinPumpWindow) {
    const carbsNote = meth.insulinSafety && meth.insulinSafety.requiredCarbsG > 0
      ? `💉 Insulin window: intra 30-60г + 10г EAA (на дозу: ≥${meth.insulinSafety.requiredCarbsG} г быстрых У)`
      : '💉 Insulin window: intra 30-60г + 10г EAA';
    for (const w of copy.weeks) {
      if ((w as any).deload || (w as any).phase === 'deload') continue;
      for (const s of w.sessions) {
        if (s.character !== 'памп' && s.character !== 'лёг') continue;
        const first = s.exercises.find(ex => (ex.role === 'primary' || ex.role === 'accessory') && !ex.comment?.includes('Insulin window'));
        if (first) first.comment = `${first.comment || ''} | ${carbsNote}`.trim().replace(/^\|\s*/, '');
      }
    }
    copy.rationale.push('💉 GH+insulin pump window: памп-дни получили intra-carbs подсказку (тяж дни не тронуты)');
  }
  if (meth.jointGuard) copy.rationale.push('🛡 Joint guard: тяж-дни сохранены, но axial/high-stress заменены на машины/кабели (см. отбор)');
  // MGF/IGF1 локально: целевая мышца в памп-сессиях получает myo-reps/lengthened
  // приоритет (реальная пометка, не только rationale). Тяж-дни не тронуты.
  if (meth.mgfTargetMuscles.length) {
    const targetSet = new Set(meth.mgfTargetMuscles.map(m => m.toLowerCase()));
    const canon = (m: string) => (m || '').toLowerCase();
    const phaseByWeek = meth.pedPhaseByWeek || [];
    let marked = 0;
    let skippedDiff = 0;
    for (const w of copy.weeks) {
      if ((w as any).deload || (w as any).phase === 'deload') continue;
      // Both-фаза: в недели дифференцировки MGF-пометку не ставим —
      // там работает IGF1 (чередование, а не одновременность).
      const weekPhase = phaseByWeek[(w as any).week - 1];
      const isDiffWeek = meth.pedPhase === 'both' && weekPhase === 'differentiation';
      for (const s of w.sessions) {
        if (s.character !== 'памп' && s.character !== 'лёг') continue;
        for (const ex of s.exercises) {
          if (ex.role !== 'primary' && ex.role !== 'accessory') continue;
          const exMuscle = canon(String(ex.muscle || ''));
          if (!exMuscle || !targetSet.has(exMuscle)) continue;
          if (ex.comment?.includes('🧬 MGF/IGF1')) continue;
          if (isDiffWeek) { skippedDiff++; continue; }
          ex.comment = `${ex.comment || ''} | 🧬 MGF/IGF1 локально: myo-reps/lengthened приоритет`.trim().replace(/^\|\s*/, '');
          marked++;
        }
      }
    }
    copy.rationale.push(`🧬 MGF/IGF1 локально: ${meth.mgfTargetMuscles.join(', ')} — +1 частота, памп ${marked > 0 ? `помечен в ${marked} упражнениях` : '(цель вне памп-дней — только частота через параметры сборки)'}, myo-reps/lengthened${skippedDiff > 0 ? `; в недели дифференцировки MGF-пометка снята (${skippedDiff} упр. — там IGF1)` : ''}`);
  }
  if (meth.periWorkout.intraNote) copy.rationale.push(`🍚 Peri-WO: ${meth.periWorkout.intraNote}`);
  if (meth.periWorkout.warning) copy.rationale.push(`⚠ ${meth.periWorkout.warning}`);
  copy.rationale.push(...meth.rationale.map(r => `💊 ${r}`));
  return copy;
}
