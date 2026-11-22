/**
 * support-plan/mapper-ctx.ts — построение MapperCtx для resolvePlan.
 *
 * ЕДИНЫЙ источник правды для перехода CalculatorState → MapperCtx.
 * Используется и в CalcMapper (UI), и в calculateSupportTZ (движок),
 * чтобы оба контура строили ОДИН и тот же план поддержки.
 */

import type { CalculatorState, LabSlice } from './types';
import { readLabValue } from '../../core/constants';
import { tierLabView } from '../../data/lab-tier-ranges';
import { currentLabSlice } from './lab-slice';
import { labFieldNumber } from './lab-field-number';
import { LAB_PANEL_KEYS, labMarkerCanon } from './lab-marker-name';
import { egfrFromCreatinine } from '../lab-norms.engine';
import { bpSystolicOfStage } from './cardio-vitals';
import type { SupportLevel } from '../tz-bridge-mechanism';
import type { MapperCtx } from '../tz-mapper-engine';
import type { PhaseContext, PhaseKey } from '../tz-bridge-phase';
import type { BoosterTriggerCtx } from '../tz-bridge-boosters';
import { classifyPed } from '../../data/ped-potency-table';
import { resolvePedAlias } from '../../data/ped-alias-map';
import { assessPedRisk } from '../ped-risk-matrix';

/**
 * Плоская карта «маркер → число» для `MapperCtx`.
 *
 * Проход 135: единица бланка — часть данных (проход 106), и здесь она терялась.
 * Раньше число разбиралось сырой строкой, без учёта единицы, поэтому значение
 * приходило в мост механизмов и в ступени в той единице, которую человек выбрал
 * в форме: пролактин 300 мМЕ/л (это 14.2 нг/мл) читался как 300 нг/мл —
 * «экстренно» по `cns1` и по ступеням; кортизол 15 мкг/дл (414 нмоль/л, норма) —
 * как 15 нмоль/л, то есть «лечение»; витамин D 62 нмоль/л (24.8 нг/мл,
 * недостаточность) — как 62 нг/мл, «норма». Теперь число читает тот же читатель,
 * что и риск-модель (`readLabValue`): единица из бланка главнее, без единицы —
 * прежняя догадка по величине. У маркеров без выбора единицы число не меняется.
 * Имя маркера переводится одной таблицей (`labMarkerCanon`), проход 136.
 * Проход 139: у мочи свои имена — канон выбирается с панелью, иначе глюкоза
 * мочи затирала глюкозу крови (см. `lab-marker-name`).
 */
export function labSliceToValues(fp: LabSlice | null, sex?: 'male' | 'female'): Record<string, number> {
  if (!fp) return {};
  const out: Record<string, number> = {};
  const units = fp.units;
  for (const pk of LAB_PANEL_KEYS) {
    const panel = (fp as any)[pk] as Record<string, string> | undefined;
    if (!panel) continue;
    for (const [marker, val] of Object.entries(panel)) {
      if (!val) continue;
      const num = labFieldNumber(val);
      if (num === undefined) continue;
      out[labMarkerCanon(marker, pk)] = readLabValue(marker, num, units?.[pk]?.[marker], sex).value;
    }
  }
  return out;
}

/**
 * Карта анализов для движка риска и моста механизмов (проход 206).
 *
 * Проход 205 свёл имена в попапе доменов, но чисел в движке оставалось два
 * читателя: этот файл (канон формы) и приватный `extractLabValues` в
 * `support-plan/engine-helpers` со своим разбором панелей. Списки панелей
 * разошлись — новый анализ (ЩФ, цистатин C, инсулин) доходил до риска, только
 * если его допишут во второе место, а HOMA-IR жил только там.
 *
 * Теперь чтение одно: форма → канон (`labSliceToValues`) → мост написаний
 * (`tierLabView`). Затем только производные, которых в бланке нет, — они не
 * подменяют строку бланка и не печатаются как результат анализа:
 *  - HOMA-IR считается из глюкозы и инсулина (формула одна на приложение);
 *  - вчСРБ и СРБ — один белок, берётся худшее число, ни одно не теряется;
 *  - СКФ бланка главнее расчёта, расчёт — `egfrFromCreatinine` (правило 23).
 *
 * Мост применяется дважды: после первого прохода известны `GLU`/`INS`, из
 * которых считается HOMA, а второй проход даёт производным их написания
 * (`HOMA` → `HOMAIR`) из той же таблицы, без ручных синонимов.
 */
export function labValuesForEngine(
  fp: LabSlice | null,
  sex?: 'male' | 'female',
  age?: number,
): Record<string, number> {
  const read = tierLabView(labSliceToValues(fp, sex));
  const derived: Record<string, number> = {};
  if (read['GLU'] !== undefined && read['INS'] !== undefined) {
    derived['HOMA'] = Math.round(((read['GLU'] * read['INS']) / 22.5) * 100) / 100;
  }
  // Мост уже даёт СРБ под вторым именем, поэтому интересен только случай, когда
  // введены ОБА числа и они расходятся: риск читает худшее (проход 130), ни одно
  // не теряется.
  if (read['CRP'] !== undefined && read['HSCRP'] !== undefined) {
    derived['CRP'] = Math.max(read['CRP'], read['HSCRP']);
  }
  if (read['EGFR'] === undefined) {
    const egfr = egfrFromCreatinine(read['CREATININE'], age, sex);
    if (egfr !== undefined) derived['EGFR'] = egfr;
  }
  return tierLabView({ ...read, ...derived });
}

export function buildMapperCtx(
  state: CalculatorState,
  level: SupportLevel,
  manualChoices?: { addSubs?: string[]; removeSubs?: string[]; explicitCategories?: any[] },
  stackTriggers?: string[],
): MapperCtx {
  // Фазы UI (AutoCalculator): course/bridge/pct/fertility/trt; 'base' — легаси-псевдоним TRT.
  // Было: fertility и trt проваливались в 'course' — пользователи получали курсовый
  // протокол (T-бустеры подавлены, hCG 500 МЕ) вместо фазовых протоколов движка.
  const phaseKey = (state.pharma.phase === 'bridge' ? 'bridge'
    : state.pharma.phase === 'pct' ? 'pct'
    : state.pharma.phase === 'fertility' ? 'fertility'
    : (state.pharma.phase === 'base' || state.pharma.phase === 'trt') ? 'trt'
    : 'course') as PhaseKey;
  const phaseCtx: PhaseContext = {
    usingAAS: state.pharma.aas.length > 0,
    usingBridgeAAS: state.pharma.aas.length > 0 && state.pharma.phase === 'bridge',
    explicitPhase: phaseKey,
    onPCTDrug: state.pharma.phase === 'pct',
    inFertilityProgram: state.pharma.phase === 'fertility',
  };
  // Пол нужен и чтению анализов (женский E2 без единицы читается как пг/мл), и
  // PED-риску. Профиль без пола идёт мужским путём — как во всей модели.
  const sex: 'male' | 'female' = state.profile?.sex === 'female' ? 'female' : 'male';
  // Проход 136: бланк выбирается тем же правилом, что в риск-модели и баннерах
  // формы (`currentLabSlice`): полный → середина курса → до курса.
  const labs = labSliceToValues(currentLabSlice(state.labs), sex);
  // Проход 203: СКФ плану поддержки. Креатинин есть, СКФ в бланке нет — считаем
  // тем же правилом, что риск-модель (`egfrFromCreatinine`): иначе у человека с
  // креатинином в бланке ренальный риск считается, а триггеры и ступени почки
  // видят пустую карту. Явная СКФ из бланка главнее расчёта. Нет креатинина —
  // ключа нет («нет записи» не значит «СКФ в норме»); в интерфейсе поле не подменяется.
  if (labs['EGFR'] === undefined) {
    const derivedEgfr = egfrFromCreatinine(labs['CREATININE'], state.profile?.age, sex);
    if (derivedEgfr !== undefined) labs['EGFR'] = derivedEgfr;
  }
  const pedDoses = (Array.isArray(state.pharma?.aas) ? state.pharma.aas : [])
    .filter((a: any) => a && a.id)
    .map((a: any) => ({
      // Канонический id pharma-db (trenbolone_acetate → tren_acet): DRUG_DB/пороги/potency
      // резолвятся только по канону.
      id: resolvePedAlias(a.id),
      pClass: classifyPed(a.id),
       mgPerWeek: Number(a.mgPerWeek ?? a.dosePerWeek ?? a.doseMgWeek ?? (a.dose ? Number(String(a.dose).replace(/\D/g,''))*7 : 500)) || 0,
      form: (a.form === 'oral' || a.route === 'oral' ? 'oral' : 'inject') as 'oral' | 'inject',
    }));
  const ghIU = state.pharma.ghIU || 0;
  if (ghIU > 0) pedDoses.push({ id: 'somatropin', pClass: 'gh', iuPerDay: ghIU, form: 'subq' } as any);
  const insulinIU = state.pharma.insulinIU || 0;
  if (insulinIU > 0) pedDoses.push({ id: 'insulin_rapid', pClass: 'insulin', iuPerDay: insulinIU, form: 'subq' } as any);
  const igfMcg = state.pharma.igfMcg || 0;
  if (igfMcg > 0) pedDoses.push({ id: 'igf1_lr3', pClass: 'igf', mcgPerDay: igfMcg, form: 'subq' } as any);
  const clenMcg = state.pharma.clenMcg || 0;
  if (clenMcg > 0) pedDoses.push({ id: 'clenbuterol', pClass: 'clenbut', mcgPerDay: clenMcg, form: 'oral' } as any);
  const t3Mcg = state.pharma.t3Mcg || 0;
  if (t3Mcg > 0) pedDoses.push({ id: 't3', pClass: 't3', mcgPerDay: t3Mcg, form: 'oral' } as any);

  // ── PED-risk assessment (Фаза 1: нейро/суставы по стеку PED) ──
  const pedRisk = assessPedRisk(pedDoses, level, sex);
  const symptomsList = state.symptoms || [];

  const boosterCtx: BoosterTriggerCtx = {
    anxietyScore: state.neuro.aggressionScore,
    sleepHours: state.profile.sleepHours,
    stressScore: state.profile.stressLevel,
    cortisolHigh: false,
    irritability: state.neuro.aggressionScore > 6,
    jointPainScore: state.oda.jointPain === 'severe' ? 8 : state.oda.jointPain === 'moderate' ? 5 : state.oda.jointPain === 'mild' ? 3 : 0,
    crpLevel: labs['CRP'] || labs['HSCRP'],
    // hemato labs (для computeHematoTier)
    hematocrit: labs['HEMATOCRIT'] || labs['HCT'],
    hemoglobin: labs['HEMOGLOBIN'] || labs['HGB'],
    plt: labs['PLT'],
    fibrinogen: labs['FIBRINOGEN'],
    dDimer: labs['D_DIMER'],
    triggeredStackIds: stackTriggers || [],
    // Фаза 1: symptom-кнопки + force на max + PED-risk tiers
    symptomJoints: symptomsList.includes('joint_pain'),
    symptomNeuro: symptomsList.some(s => ['insomnia','anxiety','mood_swings'].includes(s)),
    symptomHemato: symptomsList.some(s => ['hyperviscosity','headache','plethora','tinnitus'].includes(s)) || (labs['HEMATOCRIT'] != null && labs['HEMATOCRIT'] > 50),
    forceNeuro: level === 'max',
    forceJoints: level === 'max',
    forceHemato: level === 'max',
    pedNeuroTier: pedRisk.neuroBoosterTier,
    pedJointsTier: pedRisk.jointsBoosterTier,
    pedHematoTier: pedRisk.hematoBoosterTier,
    pedRiskReasons: pedRisk.triggeredBy,
  };
  return {
    labs, phaseCtx, boosterCtx, level, manualChoices,
     onCourse: (Array.isArray(state.pharma?.aas) ? state.pharma.aas.length : 0) > 0 || pedDoses.length > 0,
    e2Level: labs['ESTRADIOL'], hemoglobin: labs['HEMOGLOBIN'], hematocrit: labs['HEMATOCRIT'],
    hasHCG: state.pharma.hasHCG, hasAI: state.pharma.hasAI,
    hasCabergoline: state.pharma.hasCaber || false,
     aasIds: (Array.isArray(state.pharma?.aas) ? state.pharma.aas : []).map((a: any) => a.id || '').filter(Boolean),
    pedDoses, libidoLow: symptomsList.includes('low_libido'),
    // Проход 204: одно правило «стадия АД → систола» (`cardio-vitals`). Прежняя
    // лестница искала 'elevated', а интерфейс пишет 'prehypertension' — то есть
    // прегипертония уезжала в 120 (норма), и правило диуретиков («систола < 120»)
    // видело норму у человека с 135.
    bpSystolic: bpSystolicOfStage(state.cardio?.bpStage),
    lipidLdl: labs['LDL'],
    symptoms: symptomsList,
    healthConditions: state.healthConditions || [],
    pedRisk,
    // Пол ставим только для женщины: мужской ctx остаётся байт-в-байт прежним.
    ...(sex === 'female' ? { sex: 'female' as const } : {}),
  };
}
