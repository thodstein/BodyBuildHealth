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
  /** Человекочитаемый rationale. */
  rationale: string[];
}

export interface PEDMethodologyInput {
  peds: PED[];
  pedDoses: Record<string, number>;
  level: string;
  goal?: string;
  focus?: import('./bb-goal-types').BBTrainingFocus;
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

  // MGF/IGF1 локально — пометить целевые мышцы (если специализация задана — она и есть цель, иначе — все)
  if (hasMGF || hasIGF1) {
    // mgfTargetMuscles заполнит вызывающий (specialization), здесь заглушка
    rationale.push(`MGF ${MGF}мкг / IGF1 ${IGF1}мкг — локальный рост: цель получает +1 частоту, памп 15-20 + myo-reps`);
    if (hasMGF) mgfTargetMuscles.push('__mgf_target__');
    if (hasIGF1) mgfTargetMuscles.push('__igf_target__');
  }

  // Рекомендованные схемы (не форсируют, а подсказывают schemeFor)
  const pedProfile: SchemeForInput['pedProfile'] = {
    hasAAS, hasGH, hasInsulin: hasIns, hasMGF, hasIGF1, ghPlusInsulin,
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

  return { insulinPumpWindow, jointGuard, bfrAllowed, failureAllowed, recommendedScheme: { heavy, pump }, periWorkout, mgfTargetMuscles, rationale };
}

/**
 * Применяет PED-методику к плану БЕЗ ломки тяж/памп.
 * - insulinPumpWindow: только памп-дни получают pump_15_20 + intra note (тяж дни не трогает)
 * - jointGuard: фильтр пула уже применён при отборе (см bb-joint-guard), здесь только помечает rationale
 */
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
  // Insulin window: только памп-дни (лёг/памп) — подсказка, не переписывание reps
  if (meth.insulinPumpWindow) {
    for (const w of copy.weeks) {
      if ((w as any).deload || (w as any).phase === 'deload') continue;
      for (const s of w.sessions) {
        if (s.character !== 'памп' && s.character !== 'лёг') continue;
        for (const ex of s.exercises) {
          if (ex.role !== 'primary' && ex.role !== 'accessory') continue;
          const note = '💉 Insulin window: intra 30-60г + 10г EAA';
          if (!ex.comment?.includes('Insulin window')) ex.comment = `${ex.comment || ''} | ${note}`.trim().replace(/^\|\s*/, '');
        }
      }
    }
    copy.rationale.push('💉 GH+insulin pump window: памп-дни получили intra-carbs подсказку (тяж дни не тронуты)');
  }
  if (meth.jointGuard) copy.rationale.push('🛡 Joint guard: тяж-дни сохранены, но axial/high-stress заменены на машины/кабели (см. отбор)');
  if (meth.mgfTargetMuscles.length) copy.rationale.push('🧬 MGF/IGF1 локально: целевая мышца +1 частота, myo-reps/lengthened');
  if (meth.periWorkout.intraNote) copy.rationale.push(`🍚 Peri-WO: ${meth.periWorkout.intraNote}`);
  if (meth.periWorkout.warning) copy.rationale.push(`⚠ ${meth.periWorkout.warning}`);
  copy.rationale.push(...meth.rationale.map(r => `💊 ${r}`));
  return copy;
}
