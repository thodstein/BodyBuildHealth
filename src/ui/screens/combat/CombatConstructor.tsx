/**
 * CombatConstructor.tsx — изолированный PRO-конструктор для единоборств.
 * Структура в стиле ББ-авто (модерн): 7 шагов params → athlete → outside →
 * split → plan → quality → export с группами ПАРАМЕТРЫ/ПЛАН/ВЫДАЧА,
 * «Далее/Назад», аккордеонами с саммари. Движки/строки/aria 1-в-1,
 * DOM-хуки .cb-* для APK-слоя (§92/§93) сохранены.
 */
import React from 'react';
import { buildCombatPlan, cbExerciseName, resolveCombatSwapMeta } from '../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan, buildCombatReport, isCombatPlanBlocked } from '../../../engines/combat/combat-finalize.engine';
import { COMBAT_PATTERNS, recommendCombatPattern } from '../../../engines/combat/combat-split-patterns';
import { COMBAT_CYCLE_LIBRARY, getCombatCycle } from '../../../engines/combat/combat-cycle-library';
import type { OutsideLoad } from '../../../engines/outside-load.engine';
import { saveCombatPlan, loadCombatPlans, removeCombatPlan, migrateAllCombatStorage } from '../../../engines/combat/combat-storage';
import { applyCombatMesocycle, combatMesocycleHash, shouldApplyCombatMesocycle } from '../../../engines/combat/combat-mesocycle';
import { buildAnnualATR, saveAnnualCB, loadAnnualCB, removeAnnualCB, buildAnnualPrintHtml, buildAnnualIcs, addCompetitionToAnnual, removeCompetitionFromAnnual, autoAnnualWithFightTaper } from '../../../engines/combat/combat-annual';
import { AnnualCard } from './combat-annual-card';
import { CbCampIntelCard } from './cb-camp-intel';
import { buildCombatPrintHtml, downloadCombatCsv, buildCombatPlanIcs } from '../../../engines/combat/combat-print.engine';
import { downloadCombatXlsx } from '../../../engines/combat/combat-xlsx.engine';
import { saveUserProgram } from '../../../engines/user-program/program-store';
import type { CombatInput, CombatPlan } from '../../../engines/combat/combat.types';
import { getCombat } from '../../../engines/combat/combat-volume';
import { buildWeightCutProtocol } from '../../../engines/combat/combat-weight-cut.engine';
import { weightClassesFor, weightClassLine, weightClassLimitValid, weightClassRulesetNote } from '../../../engines/combat/combat-weight-class.engine';
import { weightForCombatExerciseResolved } from '../../../engines/combat/combat-workmax';
import { tempoForCB, restForCB } from '../../../engines/combat/combat-loading';
import { validateSparringLoad, sparringWeeklyLoad, normalizeSparringLoad } from '../../../engines/combat/combat-sparring.engine';
import { screenCombatRedFlags } from '../../../engines/combat/combat-safety.engine';
import { combatToNutritionPayload, combatToCardioPayload, combatPlanToUserProgram } from '../../../engines/combat/combat-integration.engine';
import type { CombatNutritionPayload, CombatCardioPayload } from '../../../engines/combat/combat-integration.engine';
import { getPlannerApply, subscribePlannerApply } from '../TrainingScreen_parts/planner-bridge';
import { CB_STRICT_GROUPS, cbStrictGroupFor } from '../../../engines/combat/combat-selection';
import { getDiaryTrendCB, getDiaryTrendCBAsync } from '../../../engines/combat/combat-diary.engine';
import { loadHrvHistory, hrvEwma, hrvGrade, hrvFromHistory } from '../../../engines/combat/combat-monitoring.engine';
import { loadRtp, rtpIncomplete, loadSparring, sparringJournalToLoad } from '../../../engines/combat/combat-measurements.engine';
import { localIsoDate } from '../../../core/local-date';
import { useCombatWizard, type WizardStep } from './useCombatWizard';
import {
  CARD, CARD_ACCENT, CARD_HERO, ROW, COL, LABEL, HINT, HINT_SM, BTN, BTN_PRIMARY, BTN_SMALL, BTN_GHOST,
  INPUT, SELECT, CHIP, CHIP_ACTIVE, PHASE_COLOR, DISCIPLINE_COLOR, ACCENT, ACCENT_GRAD, GLASS_BORDER, TEXT_3,
  SectionCard, StatTile, Badge, InfoBanner, GroupHeading, SectionNav, ProgressBar, Stepper, ChipToggle, Field, Divider, CardHeader, Highlight, AccentText, CombatPopupSelect, CombatPopupNumber,
  EQUIP_RU, MOBILITY_RU, LEVEL_RU, PHASE_RU, ZONE_RU, PERIODIZATION_RU, SESSION_TAG_RU, ruLabel, CbSwitch,
} from './CombatUI';
import { CARD as T_CARD, BTN as T_BTN, BTN_GHOST as T_BTN_GHOST, H as T_H, SMALL as T_SMALL, IN as T_IN, PlannerStepNav, usePlannerStepScroll, PLANNER_HEAD_BAR, PLANNER_HEAD_TITLE, PLANNER_STEP_NAV_WRAP } from '../TrainingScreen_parts/training-ui';
import { CombatPlanView, CbQualityMap, CbMesoCard, CbDiaryCard } from './CombatPlanView';

type Step = WizardStep;
/** Подписи шагов — в формате ББ-авто: номер + текст, эмодзи у шага выдачи. */
const STEP_LABEL_RU: Record<Step, string> = {
  params: '1 Параметры',
  athlete: '2 Атлет',
  outside: '3 Вне зала',
  split: '4 Сплит',
  plan: '5 План',
  quality: '6 Качество',
  export: '📤 Экспорт',
};
/** Группы задают ТОЛЬКО разделители, как в ББ-авто (названия не рисуются). */
const STEP_GROUPS: Step[][] = [
  ['params', 'athlete', 'outside', 'split'],
  ['plan', 'quality'],
  ['export'],
];
const WM_LABEL_RU: Record<string, string> = { bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Тяга', chest: 'Грудь', back: 'Спина', quads: 'Квадрицепс', hamstrings: 'Бицепс бедра', shoulders: 'Плечи' };
/* RU-подписи для саммари/кнопок — те же строки, что в шитах выбора */
const DISC_RU: Record<string, string> = { boxing: 'Бокс', mma: 'ММА', wrestling: 'Борьба', kickboxing: 'Кикбоксинг', general: 'Общая' };
const GOAL_RU: Record<string, string> = { power: 'Взрывная сила', endurance: 'Выносливость', maintenance: 'Поддержание', camp: 'Кэмп к бою', weight_cut: 'Весогонка' };
const METHOD_RU: Record<string, string> = { compound_first: 'База первой', pre_exhaust: 'Предутомление', post_exhaust: 'Постутомление' };
const DUP_RU: Record<string, string> = { off: 'DUP выкл', power_endurance: 'Сила/выносливость', heavy_light: 'Тяж/лёгк', conjugate: 'Сопряжённая' };
const STYLE_RU: Record<string, string> = { striker: 'Ударник', grappler: 'Борец', hybrid: 'Гибрид' };

const rangeStyle: React.CSSProperties = {
  width: '100%', height: 6, borderRadius: 999, appearance: 'none' as any, WebkitAppearance: 'none' as any,
  background: 'rgba(255,255,255,0.08)', outline: 'none', cursor: 'pointer',
};

/* Лёгкий haptic на навигации (guard — тишина вне устройства) */
function buzzStep(): void {
  try { (navigator as any)?.vibrate?.(8); } catch { /* no-op */ }
}

/* №1: заблокированный план (errors) нельзя выгружать ни в каком виде — канон isCombatPlanBlocked из finalize */

/* ── BB-аккордеон: шапка-кнопка + саммари, контент — те же SectionCard 1-в-1 ── */
const CbSec: React.FC<{
  title: string;
  defaultOpen?: boolean;
  summary?: string;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, summary, children }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{ ...T_CARD, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); buzzStep(); }}
        aria-expanded={open}
        className="cb-sec-head"
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 12px', minHeight: 44, cursor: 'pointer', background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(236,72,153,0.03))',
          border: 'none', borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!open && summary && <span style={{ ...T_SMALL, color: '#fff' }}>{summary}</span>}
          <span style={{ fontSize: 11, color: '#fff', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
        </span>
      </button>
      <div data-collapsed={!open} style={open
        ? { display: 'flex', flexDirection: 'column', gap: 8 }
        : { display: 'grid', gridTemplateRows: '0fr', opacity: 0, transition: 'grid-template-rows 0.28s ease, opacity 0.2s ease', pointerEvents: 'none' }}>
        <div style={open ? undefined : { minHeight: 0, overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
};

export const CombatConstructor: React.FC = () => {
  const {
    step, setStep,
    discipline, setDiscipline, goal, setGoal, level, setLevel, weeks, setWeeks, days, setDays,
    weightCut, setWeightCut, waterMode, setWaterMode, sodiumMode, setSodiumMode, carbMode, setCarbMode, heatSessions, setHeatSessions, weighInType, setWeighInType, confirmedManipulation, setConfirmedManipulation, orsSodium, setOrsSodium,
    weightCutFiber, setWeightCutFiber, weightCutSteps, setWeightCutSteps,
    methodology, setMethodology, dupMode, setDupMode, intensityTech, setIntensityTech,
    periodizationModel, setPeriodizationModel, conditioningMode, setConditioningMode,
    outside, setOutside, outsideEnabled, setOutsideEnabled, sparringHard, setSparringHard, sparringTech, setSparringTech, sparringWrest, setSparringWrest, sparringEnabled, setSparringEnabled,
    sparringAvgDur, setSparringAvgDur,
    fightStyle, setFightStyle, avoidAxialLoad, setAvoidAxialLoad,
    equipment, setEquipment, mobility, setMobility, injuries, setInjuries, injInput, setInjInput, injExclude, setInjExclude,
    bodyweight, setBodyweight, sex, setSex, age, setAge,
    fightDate, setFightDate, taperWeeks, setTaperWeeks, startDate, setStartDate,
    fightMinutes, setFightMinutes,
    acwr, setAcwr, hrvLine, setHrvLine,
    patternId, setPatternId,
    workMax, setWorkMax, workMaxByExercise, setWorkMaxByExercise, showExactWM, setShowExactWM,
    plan, setPlan, history, setHistory, annual, setAnnual, diaryLoad, setDiaryLoad, msg, setMsg,
    annualWeeks, setAnnualWeeks, annualCycles, setAnnualCycles, competitionName, setCompetitionName, competitionDate, setCompetitionDate, competitionWeight, setCompetitionWeight, competitionPriority, setCompetitionPriority,
    concussionHistory, setConcussionHistory, neckExtensionKg, setNeckExtensionKg, neckFlexExtRatio, setNeckFlexExtRatio,
    neckLevelOverride, setNeckLevelOverride, weakSide, setWeakSide,
    weightClass, setWeightClass, weightClassLimitKg, setWeightClassLimitKg, weightClassRuleset, setWeightClassRuleset, travelMode, setTravelMode, lutealPhase, setLutealPhase,
    courseIntensity, setCourseIntensity,
    outsideMetrics,
  } = useCombatWizard();
  usePlannerStepScroll('combat', [step]);
  const [cycFilter, setCycFilter] = React.useState<string>('all');
  /** Э4.1: менеджер сохранённых планов (тик — перечитать список после удаления). */
  const [plansTick, setPlansTick] = React.useState(0);
  const savedPlansList = React.useMemo(() => { try { return loadCombatPlans(); } catch { return []; } }, [plansTick, plan]);

  const go = (s: Step) => { buzzStep(); setStep(s); };

  /* P2: приём моста combat_cycle (каталог/библиотека → конструктор) + weakpoints-combat (диагностика/орто).
   * Mount — pending из каталога; live — событие planner-apply. Невалидный id — честная ошибка, стейт не трогаем. */
  React.useEffect(() => {
    const applyCombatCycle = (cycleId: string): boolean => {
      const tpl = getCombatCycle(cycleId);
      if (!tpl) {
        setMsg(`⚠ Цикл «${cycleId}» не найден в библиотеке единоборств`);
        setTimeout(() => setMsg(''), 2600);
        return false;
      }
      setDiscipline(tpl.discipline); setGoal(tpl.goal); setLevel(tpl.level);
      setWeeks(tpl.weeks); setDays(tpl.daysPerWeek); setPatternId(tpl.patternId);
      setPeriodizationModel(tpl.periodizationModel);
      setStep('split');
      setMsg(`✦ Цикл «${tpl.name}» применён — проверьте сплит`);
      setTimeout(() => setMsg(''), 2600);
      return true;
    };
    const applyWeakpointsCombat = (data: any): void => {
      if (!data || typeof data !== 'object') return;
      const touched: string[] = [];
      if (typeof data.combatConcussion === 'number' && Number.isFinite(data.combatConcussion)) {
        setConcussionHistory(Math.max(0, Math.min(9, Math.round(data.combatConcussion))));
        touched.push('сотрясения');
      }
      if (typeof data.combatNeckLevel === 'number' && Number.isFinite(data.combatNeckLevel)) {
        // №4: уровень шеи реально переопределяет планирование (движок neckLevelOverride), а не только флеш
        setNeckLevelOverride(Math.max(1, Math.min(4, Math.round(data.combatNeckLevel))));
        touched.push('уровень шеи');
      }
      if (data.combatAsymmetry === 'left' || data.combatAsymmetry === 'right') {
        // №4: слабая сторона — состояние + след (движок пишет rationale + warning, приёмник хранит)
        setWeakSide(data.combatAsymmetry);
        touched.push(`слабая сторона ${data.combatAsymmetry === 'left' ? 'левая' : 'правая'}`);
      }
      if (typeof data.combatSparringCap === 'number' && Number.isFinite(data.combatSparringCap) && data.combatSparringCap >= 0) {
        const cap = Math.round(data.combatSparringCap);
        setSparringHard(h => Math.min(h, cap));
        touched.push('лимит спарринга');
      }
      if (Array.isArray(data.orthoFlags) && data.orthoFlags.length) {
        const mobAdd = data.orthoFlags.map((f: any) => f?.action).filter((a: any) => typeof a === 'string' && a);
        if (mobAdd.length) {
          setMobility(m => [...new Set([...m, ...mobAdd])]);
          touched.push('орто');
        }
      }
      if (touched.length) {
        setMsg(`📥 Из диагностики: ${touched.join(', ')}`);
        setTimeout(() => setMsg(''), 2600);
      }
    };
    const route = (payload: any): void => {
      if (!payload) return;
      if (payload.kind === 'combat_cycle' && payload?.data?.cycleId) applyCombatCycle(String(payload.data.cycleId));
      else if (payload.kind === 'weakpoints' && payload?.data) applyWeakpointsCombat(payload.data);
    };
    try { route(getPlannerApply()); } catch { /* no-op */ }
    const unsub = subscribePlannerApply(route);
    // P7: мёртвый migrateAllCombatStorage оживлён — прогон миграций персиста при входе
    try { migrateAllCombatStorage(); } catch { /* no-op */ }
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* P4-добивка: смена дисциплины/пола/свода сбрасывает чужой лимит категории (бокс 80кг ≠ MMA-лимит) */
  React.useEffect(() => {
    const key = weightClassRuleset || discipline;
    if (weightClassLimitKg && !weightClassLimitValid(key, sex, weightClassLimitKg)) {
      setWeightClass('');
      setWeightClassLimitKg(0);
      setMsg('Категория сброшена под дисциплину — выберите заново');
      setTimeout(() => setMsg(''), 2600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discipline, sex, weightClassRuleset]);

  /* Смена уровня/дней сбрасывает вручную выбранный сплит под новые условия —
   * иначе UI показывал бы combat_4, а движок молча строил бы на другом. */
  const changeLevel = (v: CombatInput['level']) => {
    setLevel(v);
    if (patternId) {
      const p = COMBAT_PATTERNS.find(p => p.id === patternId);
      if (p && !p.level.includes(v as string)) {
        setPatternId('');
        setMsg('Сплит сброшен под уровень — выберите заново'); setTimeout(() => setMsg(''), 2600);
      }
    }
  };
  const changeDays = (n: number) => {
    setDays(n);
    if (patternId) {
      const p = COMBAT_PATTERNS.find(p => p.id === patternId);
      if (p && p.sessionsPerRotation !== n) {
        setPatternId('');
        setMsg(`Сплит сброшен под ${n}×/нед — выберите заново`); setTimeout(() => setMsg(''), 2600);
      }
    }
  };

  const pullFromProfile = () => {
    try {
      const raw = localStorage.getItem('he_profile_v2');
      if (!raw) return;
      const p = JSON.parse(raw);
      const personal = p.personal || {};
      const training = p.training || p;
      const lifestyle = p.lifestyle || {};
      const health = p.health || {};
      if (training.level) setLevel(training.level);
      else if (personal.level) setLevel(personal.level);
      if (personal.sex) setSex(personal.sex === 'female' ? 'female' : 'male');
      if (typeof personal.weight === 'number') setBodyweight(personal.weight);
      else if (typeof personal.bodyweight === 'number') setBodyweight(personal.bodyweight);
      if (typeof personal.age === 'number') setAge(personal.age);
      const wm: Record<string, number> = {};
      if (training.workMax) Object.assign(wm, training.workMax);
      if (personal.workMax) Object.assign(wm, personal.workMax);
      if (Object.keys(wm).length) setWorkMax(s => ({ ...s, ...wm }));
      if (training.workMaxByExercise || personal.workMaxByExercise) {
        const exBy = training.workMaxByExercise || personal.workMaxByExercise;
        if (exBy && typeof exBy === 'object') {
          const direct: Record<string, number> = {};
          for (const [k, v] of Object.entries(exBy as Record<string, number>)) if (typeof v === 'number' && v > 0) direct[k] = v;
          if (Object.keys(direct).length) setWorkMaxByExercise(direct);
        }
        const map: Record<string, string> = { bench_bar: 'bench', squat: 'squat', front_squat: 'squat', row_bar: 'back', ohp: 'shoulders' };
        for (const [k, v] of Object.entries((training.workMaxByExercise || personal.workMaxByExercise) as Record<string, number>)) {
          const g = map[k];
          if (g && typeof v === 'number' && v > 0) wm[g] = v;
        }
        if (Object.keys(wm).length) setWorkMax(s => ({ ...s, ...wm }));
      }
      if (Array.isArray(health.injuries)) setInjuries(health.injuries);
      else if (Array.isArray(training.injuries)) setInjuries(training.injuries);
      if (Array.isArray(training.equipment)) setEquipment(training.equipment);
      else if (Array.isArray(personal.equipment)) setEquipment(personal.equipment);
      if (Array.isArray(health.mobilityRestrictions)) setMobility(health.mobilityRestrictions);
      else if (Array.isArray(training.mobilityRestrictions)) setMobility(training.mobilityRestrictions);
      else if (Array.isArray(p.health?.mobilityRestrictions)) setMobility(p.health.mobilityRestrictions);
      setMsg('✦ Профиль подтянут');
      setTimeout(() => setMsg(''), 2600);
    } catch {}
  };

  const build = async () => {
    let extra: any = {};
    try {
      const raw = localStorage.getItem('he_profile_v2');
      if (raw) {
        const p = JSON.parse(raw);
        const personal = p.personal || {};
        const lifestyle = p.lifestyle || {};
        const ph = p.pharma || {};
        extra.bodyFat = typeof personal.bodyFat === 'number' ? personal.bodyFat : undefined;
        extra.leanMass = typeof personal.bodyFat === 'number' && typeof personal.weight === 'number' ? Math.round(personal.weight * (1 - personal.bodyFat / 100)) : undefined;
        // HRV EWMA + grade — как cardio-diary: EWMA устойчивее выбросов, grade даёт 0.85/0.95/1.05 в recovery
        try {
          const hist = loadHrvHistory();
          if (hist.length >= 7) {
            const ew = hrvEwma(hist);
            if (ew) extra.hrvMs = ew;
            else extra.hrvMs = typeof lifestyle.morningHRV === 'number' ? lifestyle.morningHRV : typeof lifestyle.hrvMs === 'number' ? lifestyle.hrvMs : undefined;
            const h = hrvFromHistory(hist);
            if (h) {
              const g = hrvGrade(h.last, h.mean, h.sd);
              extra.hrvGrade = g.grade;
            }
          } else {
            extra.hrvMs = typeof lifestyle.morningHRV === 'number' ? lifestyle.morningHRV : typeof lifestyle.hrvMs === 'number' ? lifestyle.hrvMs : undefined;
          }
        } catch { extra.hrvMs = typeof lifestyle.morningHRV === 'number' ? lifestyle.morningHRV : typeof lifestyle.hrvMs === 'number' ? lifestyle.hrvMs : undefined; }
        extra.sleepHours = typeof lifestyle.sleepHours === 'number' ? lifestyle.sleepHours : undefined;
        extra.stressLevel = typeof lifestyle.stressLevel === 'number' ? lifestyle.stressLevel : undefined;
        extra.calorieSurplus = typeof p.nutrition?.calorieSurplus === 'number' ? p.nutrition.calorieSurplus : undefined;
        extra.proteinPerKg = typeof p.nutrition?.proteinPerKg === 'number' ? p.nutrition.proteinPerKg : undefined;
        // P0-7: currentSubstances — объекты PharmaSubstanceEntry[] (доза в doseMg),
        // а движок ждёт id[] + {id: доза}; раньше летели объекты → PED-адаптация
        // молча отключалась (всегда natural ×1.0)
        if (Array.isArray(ph.currentSubstances) && ph.currentSubstances.length) {
          const peds: string[] = [];
          const doses: Record<string, number> = {};
          for (const s of ph.currentSubstances) {
            const id = String(s?.id || s?.name || '').trim();
            if (!id) continue;
            peds.push(id);
            const d = Number(s?.doseMg);
            if (Number.isFinite(d) && d > 0) doses[id] = d;
          }
          if (peds.length) extra.peds = peds;
          if (Object.keys(doses).length) extra.pedDoses = doses;
        }
        if (!extra.pedDoses && p.pharma?.doses && typeof p.pharma.doses === 'object') extra.pedDoses = p.pharma.doses;
        // P1-29: предпочтения/исключения из профиля доезжают до отбора упражнений
        if (Array.isArray(p.training?.favoriteExercises) && p.training.favoriteExercises.length) extra.favoriteExercises = p.training.favoriteExercises;
        if (Array.isArray(p.training?.excludedExercises) && p.training.excludedExercises.length) extra.excludedExercises = p.training.excludedExercises;
        extra.labMrvMultiplier = typeof p.labs?.mrvMultiplier === 'number' ? p.labs.mrvMultiplier : undefined;
      }
    } catch {}
    // P1-27: RTP-гейт — если протокол возврата начат и не завершён, сборка ограничивает интенсивность
    try { const rtpFlag = rtpIncomplete(loadRtp()); if (rtpFlag) extra.rtpIncomplete = true; } catch {}
    const wcProtocol = weightCut > 0 ? buildWeightCutProtocol(weightCut, { startWeightKg: bodyweight, waterMode, sodiumMode, carbMode, heatSessions, weighInType: weighInType as any, confirmedManipulation, orsSodiumMmolPerDl: orsSodium, discipline, fiberGPerDay: weightCutFiber, dailyStepsTarget: weightCutSteps } as any) : null;
    // P1-12: спарринг учитывается только при включённом мастере «нагрузка вне зала»
    // Э1.1: avgDurationMin из журнала (кнопка «Из журнала») масштабирует нагрузку
    const sparringLoad = (sparringEnabled && outsideEnabled)
      ? { hardSparSessions: sparringHard, techSparSessions: sparringTech, wrestlingSessions: sparringWrest, ...(sparringAvgDur ? { avgDurationMin: sparringAvgDur } : {}) } as any
      : null;
    // VBT из UI и из снимка плана убран (решение 2026-09-27): новые планы больше
    // не несут velocityLossPct/vbtHistory/velocityLossPerLift. Движки и старые
    // планы их по-прежнему читают — обратная совместимость не сломана.
    let input: CombatInput = {
      discipline, goal, level, weeks, daysPerWeek: days,
      weightCutKg: weightCut, weightCutProtocol: wcProtocol as any, methodology, dupMode, intensityTech,
      periodizationModel: periodizationModel as any, conditioningMode: conditioningMode as any,
      fightDate: fightDate || null, taperWeeks: fightDate ? taperWeeks : undefined, startDate,
      fightMinutes: fightMinutes > 0 ? fightMinutes : undefined,
      bodyweight, sex, age,
      workMax: workMax as any,
      workMaxByExercise: Object.keys(workMaxByExercise).length ? workMaxByExercise as any : undefined,
      acwr: acwr as any,
      outsideLoad: outsideEnabled && !sparringEnabled ? outside : null,
      sparringLoad,
      fightStyle: fightStyle as any,
      avoidAxialLoad: avoidAxialLoad as any,
      equipment, injuries, mobilityRestrictions: mobility as any,
      patternId: patternId || undefined,
      // P2/P3 приёмник диагностики + безопасность (опционально, без значений — как раньше)
      concussionHistory: concussionHistory || undefined,
      neckExtensionKg: neckExtensionKg || undefined,
      neckFlexExtRatio: neckFlexExtRatio || undefined,
      // №4: override шеи + слабая сторона (опционально)
      neckLevelOverride: neckLevelOverride || undefined,
      weakSide: weakSide || undefined,
      // P4/P5 весовая категория + travel + лютеиновая (опционально)
      weightClass: weightClass || undefined,
      weightClassLimitKg: weightClassLimitKg || undefined,
      weightClassRuleset: weightClassRuleset || undefined,
      travelMode: travelMode !== 'off' ? travelMode : undefined,
      lutealPhase: lutealPhase || undefined,
      courseIntensity: courseIntensity !== 'auto' ? courseIntensity : undefined,
      ...extra,
    } as any;
    try {
      let trend: any = null;
      try { trend = await getDiaryTrendCBAsync(); } catch { trend = getDiaryTrendCB(); }
      if (!trend) try { trend = getDiaryTrendCB(); } catch {}
      if (trend && trend.length) (input as any).diaryTrendCB = trend;
    } catch {}
    // P6: per-exercise индекс (лучший e1RM 28д) — мезоцикл читает покрытие, веса не меняет
    try {
      const { combatLastResultIndex, loadDiaryLogsCBAsync } = await import('../../../engines/combat/combat-diary.engine');
      const logs = await loadDiaryLogsCBAsync();
      const idx = combatLastResultIndex(logs || []);
      if (idx && Object.keys(idx).length) (input as any).diaryLastResultIndex = idx;
    } catch {}
    // P0-6: кросс-мезо только для «нового» мезоцикла — повторная сборка с теми же
    // входами не бампает веса заново (было: 10 пересборов = +25 кг) и не смешивает дисциплины
    let mesoHash: string | null = null;
    try {
      const prev = loadCombatPlans()[0];
      if (prev) {
        mesoHash = combatMesocycleHash(input);
        let lastHash: string | null = null;
        try { lastHash = localStorage.getItem('he_combat_meso_hash_v1'); } catch {}
        if (shouldApplyCombatMesocycle(prev, input, lastHash)) {
          input = applyCombatMesocycle(prev, input) as any;
        }
      }
    } catch {}
    let p = buildCombatPlan(input);
    p = finalizeCombatPlan(p);
    setPlan(p);
    // №1 hard-block: при errors план показываем (красный блок), но не сохраняем,
    // не рассылаем в питание/кардио и не трогаем годовой — сначала исправления/врач
    if ((p.validation?.errors?.length || 0) > 0) {
      setMsg(`⛔ Сборка заблокирована: ошибок ${p.validation!.errors.length} — исправьте и соберите заново`);
      setTimeout(() => setMsg(''), 4000);
      setStep('plan');
      return;
    }
    saveCombatPlan(p);
    // P0-6: фиксируем хэш успешной сборки — повторный клик с теми же входами идемпотентен
    try { if (mesoHash) localStorage.setItem('he_combat_meso_hash_v1', mesoHash); } catch {}
    try {
      const nut: CombatNutritionPayload = { planId: p.id, ...combatToNutritionPayload(p), bodyweight, discipline, goal };
      localStorage.setItem('he_combat_nutrition_payload', JSON.stringify(nut));
      const cardio: CombatCardioPayload | null = (() => {
        const c = combatToCardioPayload(p);
        return c ? { planId: p.id, ...c } : null;
      })();
      if (cardio) localStorage.setItem('he_combat_cardio_payload', JSON.stringify(cardio));
      window.dispatchEvent(new CustomEvent('he-combat-updated', { detail: { planId: p.id, nutrition: nut, cardio } }));
    } catch {}
    try { const hist = loadCombatPlans().slice(0, 6); const ann = autoAnnualWithFightTaper(hist); saveAnnualCB(ann); setAnnual(ann); } catch {}
    setMsg('✦ План собран · ' + (periodizationModel || 'atr_10') + (fightDate ? ' · тапер к бою' : '') + (wcProtocol ? ' · весогонка ' + wcProtocol.targetLossKg + 'кг' : ''));
    setTimeout(() => setMsg(''), 3000);
    setStep('plan');
  };

  const pushHistory = (p: CombatPlan) => setHistory(h => [...h.slice(-9), JSON.parse(JSON.stringify(p))]);
  /** P1-11: агрегаты недели после правок — сводка/печать не врут (паритет с финализатором). */
  const recomputeWeekAgg = (w: any) => {
    if (!w) return;
    w.totalSets = (w.sessions || []).reduce((s: number, ss: any) => s + ss.exercises.reduce((a: number, e: any) => a + e.sets, 0), 0);
    w.totalTonnage = (w.sessions || []).reduce((s: number, ss: any) => s + ss.exercises.reduce((a: number, e: any) => a + (e.workSets || []).reduce((x: number, ws: any) => x + ws.weight * ws.reps, 0), 0), 0);
  };
  const undo = () => {
    setHistory(h => {
      if (h.length === 0) { setMsg('История пуста'); setTimeout(() => setMsg(''), 1800); return h; }
      const prev = h[h.length - 1];
      const rest = h.slice(0, -1);
      setPlan(prev);
      try { saveCombatPlan(prev); } catch {}
      setMsg('↩ Отменено'); setTimeout(() => setMsg(''), 1800);
      return rest;
    });
  };
  const updateEx = (wkIdx: number, day: number, exId: string, patch: Partial<{ weight: number; reps: string; rir: number }>) => {
    setPlan(prev => {
      if (!prev) return prev;
      pushHistory(prev);
      const copy: CombatPlan = JSON.parse(JSON.stringify(prev));
      const wk = copy.weeksData[wkIdx];
      if (!wk) return prev;
      const sess = wk.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const ex = sess.exercises.find(e => e.id === exId);
      if (!ex) return prev;
      if (patch.weight != null) { if (patch.weight < 0 || patch.weight > 500) { setMsg('Вес 0–500'); setTimeout(() => setMsg(''), 1800); return prev; } ex.weight = patch.weight; ex.workSets = ex.workSets.map(s => ({ ...s, weight: patch.weight! })); }
      if (patch.reps != null) {
        const raw = patch.reps.trim();
        ex.reps = raw;
        if (/с|c/i.test(raw)) {
        } else {
          const parts = raw.split('-').map(n => parseInt(n, 10));
          const a = parts[0]; const b = parts[1];
          const avg = Number.isFinite(a) && Number.isFinite(b) ? Math.round((a + b) / 2) : (Number.isFinite(a) ? a : 5);
          ex.workSets = ex.workSets.map(s => ({ ...s, reps: avg }));
        }
      }
      if (patch.rir != null) { if (patch.rir < 0 || patch.rir > 5) { setMsg('RIR 0–5'); setTimeout(() => setMsg(''), 1800); return prev; } ex.rir = patch.rir; ex.workSets = ex.workSets.map(s => ({ ...s, rir: patch.rir! })); }
      recomputeWeekAgg(wk);
      saveCombatPlan(copy);
      return copy;
    });
  };
  const moveEx = (wkIdx: number, day: number, exId: string, dir: -1 | 1) => {
    setPlan(prev => {
      if (!prev) return prev;
      pushHistory(prev);
      const copy: CombatPlan = JSON.parse(JSON.stringify(prev));
      const sess = copy.weeksData[wkIdx]?.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const idx = sess.exercises.findIndex(e => e.id === exId);
      if (idx < 0) return prev;
      const nIdx = idx + dir;
      if (nIdx < 0 || nIdx >= sess.exercises.length) return prev;
      const tmp = sess.exercises[idx];
      sess.exercises[idx] = sess.exercises[nIdx];
      sess.exercises[nIdx] = tmp;
      recomputeWeekAgg(copy.weeksData[wkIdx]);
      saveCombatPlan(copy);
      return copy;
    });
  };
  const swapEx = (wkIdx: number, day: number, exId: string, newId: string) => {
    setPlan(prev => {
      if (!prev) return prev;
      const metaMap: Record<string, { name: string; group: string; pattern: string }> = {
        bench_bar: { name: 'Жим лёжа', group: 'chest', pattern: 'horizontal_push' }, row_bar: { name: 'Тяга штанги', group: 'back', pattern: 'horizontal_pull' }, ohp: { name: 'Жим стоя', group: 'shoulders', pattern: 'vertical_push' }, pullup: { name: 'Подтягивания', group: 'back', pattern: 'vertical_pull' }, neck_harness_ext: { name: 'Шея с упряжью', group: 'neck', pattern: 'isolation' }, neck_lateral_flex: { name: 'Шея боковая', group: 'neck', pattern: 'isolation' }, neck_bridge_wrestler: { name: 'Борцовский мост', group: 'neck', pattern: 'isolation' }, neck_flexion: { name: 'Шея сгибание', group: 'neck', pattern: 'isolation' }, neck_rotation: { name: 'Шея ротация', group: 'neck', pattern: 'isolation' }, gi_grip_pullup: { name: 'Подтягивания на кимоно', group: 'back', pattern: 'vertical_pull' }, face_pull: { name: 'Тяга к лицу', group: 'shoulders', pattern: 'isolation' }, squat: { name: 'Присед', group: 'legs', pattern: 'squat' }, front_squat: { name: 'Фронт-присед', group: 'legs', pattern: 'squat' }, rdl: { name: 'Румынская тяга', group: 'legs', pattern: 'hinge' }, bulgarian_split_heavy: { name: 'Болгарский тяжёлый', group: 'legs', pattern: 'lunge' }, single_leg_rdl_combat: { name: 'Румынка на одной', group: 'legs', pattern: 'hinge' }, cossack_squat: { name: 'Казачий присед', group: 'legs', pattern: 'squat' }, calf_raise: { name: 'Подъёмы на носки', group: 'legs', pattern: 'isolation' }, plate_pinch: { name: 'Щипок блинов', group: 'grip', pattern: 'isolation' }, landmine_rotation: { name: 'Лэндмайн ротация', group: 'core', pattern: 'rotation' }, landmine_180: { name: 'Лэндмайн 180', group: 'core', pattern: 'rotation' }, pallof_rotation_press: { name: 'Паллоф+ротация', group: 'core', pattern: 'anti_rotation' }, suitcase_carry: { name: 'Чемодан', group: 'core', pattern: 'carry' }, med_ball_throw: { name: 'Медбол бросок', group: 'core', pattern: 'plyo' }, wrist_roller: { name: 'Валик', group: 'grip', pattern: 'isolation' }, hang_clean: { name: 'Взятие с виса', group: 'back', pattern: 'hinge' },
      };
      const curSess = prev.weeksData[wkIdx]?.sessions.find(s => s.day === day);
      const curEx = curSess?.exercises.find(e => e.id === exId);
      if (!curSess || !curEx) return prev;
      const meta = metaMap[newId] || resolveCombatSwapMeta(newId, { name: curEx.name, group: curEx.group, pattern: curEx.pattern });
      pushHistory(prev);
      const copy: CombatPlan = JSON.parse(JSON.stringify(prev));
      const sess = copy.weeksData[wkIdx]?.sessions.find(s => s.day === day);
      if (!sess) return prev;
      const ex = sess.exercises.find(e => e.id === exId);
      if (!ex) return prev;
      ex.id = newId;
      ex.name = meta.name;
      ex.group = meta.group;
      ex.pattern = meta.pattern;
      // P1-10: пересчёт веса/темпа/отдыха/комментария под НОВОЕ упражнение
      // (раньше оставался вес и комментарий прежнего — «показано ≠ факт»)
      try {
        const snapAny: any = copy.inputSnapshot || {};
        const w = weightForCombatExerciseResolved(newId, {
          workMaxByExercise: snapAny.workMaxByExercise ?? null,
          workMax: snapAny.workMax ?? null,
          bodyweight: snapAny.bodyweightKg ?? snapAny.bodyweight ?? null,
          goalMult: copy.goal === 'weight_cut' ? 0.92 : copy.goal === 'maintenance' ? 0.95 : 1,
        });
        ex.weight = w;
        ex.workSets = ex.workSets.map(st => ({ ...st, weight: w }));
        ex.tempo = tempoForCB(newId, ex.role === 'primary', ex.character as any);
        ex.restSeconds = restForCB(ex.role === 'primary', ex.character as any, newId);
        ex.comment = `↻ Замена: ${meta.name} — проверьте вес`;
      } catch {}
      recomputeWeekAgg(copy.weeksData[wkIdx]);
      saveCombatPlan(copy);
      setMsg(`↻ Заменено: ${newId}`); setTimeout(() => setMsg(''), 1800);
      return copy;
    });
  };

  const exportToUserProgram = () => {
    if (!plan) return;
    // Гейт внутри функции (оборона в глубину: кнопки disabled, но прямой вызов тоже блочится)
    if (isCombatPlanBlocked(plan)) { setMsg('⛔ Экспорт заблокирован — сначала исправьте ошибки'); setTimeout(() => setMsg(''), 2600); return; }
    // P0-5: полноценный UserProgram (direction:'combat' + недельная форма) —
    // раньше объект отбраковывался saveUserProgram, а тост врал
    const prog = combatPlanToUserProgram(plan);
    let savedOk = false;
    try {
      const all = saveUserProgram(prog);
      savedOk = Array.isArray(all) && all.some((p: any) => p?.meta?.id === plan.id);
    } catch { savedOk = false; }
    if (savedOk) setMsg('✦ Экспортировано в библиотеку (Мои программы)');
    else setMsg('⚠ Не удалось сохранить в библиотеку — проверьте хранилище');
    setTimeout(() => setMsg(''), 2400);
    try { localStorage.setItem('he_last_combat_program', JSON.stringify(prog)); } catch {}
    try { navigator.clipboard?.writeText(JSON.stringify(prog, null, 2)); } catch {}
  };

  const handleBuildATR = () => {
    const effCycles = Math.max(1, Math.min(4, Math.floor(annualWeeks / 8)));
    const ann = buildAnnualATR(discipline as any, annualWeeks, startDate || null, { cycles: annualCycles } as any);
    saveAnnualCB(ann); setAnnual(ann);
    setMsg(`✦ Годовой ATR ${annualWeeks} нед ×${Math.min(annualCycles, effCycles)} цикла построен${annualCycles > effCycles ? ` (лимит ${effCycles}: цикл ≥8 нед)` : ''}`);
    setTimeout(() => setMsg(''), 2600);
  };
  const handleAddCompetition = () => {
    if (!competitionName || !competitionDate) { setMsg('Укажите название и дату боя'); setTimeout(() => setMsg(''), 1800); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(competitionDate) || !Number.isFinite(new Date(competitionDate).getTime())) { setMsg('⚠ Некорректная дата боя — формат ГГГГ-ММ-ДД'); setTimeout(() => setMsg(''), 2200); return; }
    const ann = loadAnnualCB();
    if (!ann) { setMsg('⚠ Годовой план не построен — сначала соберите год'); setTimeout(() => setMsg(''), 2200); return; }
    const next = addCompetitionToAnnual(ann, { id: `comp_${Date.now()}`, name: competitionName, date: competitionDate, weightClass: competitionWeight || undefined, priority: competitionPriority } as any, startDate || null);
    if (next === ann) { setMsg('⚠ Бой не добавлен — проверьте дату'); setTimeout(() => setMsg(''), 2200); return; }
    saveAnnualCB(next); setAnnual(next); setMsg(`✦ Бой добавлен (${competitionPriority === 'secondary' ? 'мини-тапер 1нед' : 'тапер 2нед'})`); setTimeout(() => setMsg(''), 1800);
    setCompetitionName(''); setCompetitionDate(''); setCompetitionWeight('');
  };
  const handleRemoveCompetition = (id: string) => {
    if (!annual) return;
    const next = removeCompetitionFromAnnual(annual, id);
    saveAnnualCB(next); setAnnual(next);
    setMsg('✕ Бой удалён — тапер-блок снят, год пересобран'); setTimeout(() => setMsg(''), 1800);
  };
  const handleRemoveAnnual = () => {
    if (!annual) return;
    removeAnnualCB(); setAnnual(null);
    setMsg('🗑 Годовой ATR удалён'); setTimeout(() => setMsg(''), 1800);
  };
  const handlePrintAnnual = () => {
    if (!annual) return;
    try {
      const html = buildAnnualPrintHtml(annual);
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); } else { navigator.clipboard?.writeText(html); setMsg('HTML скопирован'); }
    } catch (e) { setMsg('⚠ Не удалось напечатать год — данные повреждены, пересоберите год'); setTimeout(() => setMsg(''), 2600); }
  };
  const handleDownloadIcs = () => {
    if (!annual) return;
    try {
      const ics = buildAnnualIcs(annual, startDate || null);
      const blob = new Blob([ics], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `combat-annual-${annual.totalWeeks}w.ics`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setMsg('⚠ Не удалось выгрузить календарь — проверьте даты боя'); setTimeout(() => setMsg(''), 2600); }
  };
  const doMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2200); };
  const mesoPrev = React.useMemo(() => {
    try { const h = loadCombatPlans(); return h.length > 1 ? h[1] : null; }
    catch { return null; }
  }, [plan]);
  const diaryTrends = React.useMemo(() => {
    try { return getDiaryTrendCB(); } catch { return null; }
  }, [plan]);
  const sparringLoad = normalizeSparringLoad({ hardSparSessions: sparringHard, techSparSessions: sparringTech, wrestlingSessions: sparringWrest });
  const sparringErrs = sparringEnabled && sparringLoad ? validateSparringLoad(sparringLoad) : [];
  const sparringLoadWeekly = sparringLoad ? sparringWeeklyLoad(sparringLoad) : 0;

  const stepList: Step[] = ['params', 'athlete', 'outside', 'split', 'plan', 'quality', 'export'];
  const stepIndex = stepList.indexOf(step) + 1;
  const needsPlan = (s: Step) => (s === 'plan' || s === 'quality') && !plan;
  const exportLocked = !plan && !annual;
  /** Причина блокировки шага — в шапке пилюли и во флеше, чтобы
   *  «не нажимается» не выглядело поломкой. */
  const stepLockReason = (s: string): string | null => {
    const st = s as Step;
    if (st === 'export' && exportLocked) return 'Сначала собери план или год';
    if (needsPlan(st)) return 'Сначала собери план';
    return null;
  };
  const stepDefs = stepList.map(id => ({ id, label: STEP_LABEL_RU[id] }));

  /* Лента шагов — общий компонент training-ui (тот же, что в ББ-авто и в
     арм/стронг-конструкторах). Класс .cb-steps и хук data-cb="step" перенесены
     в него через navAttrs/pillAttrs: APK-слой и a11y-контракт сохранены. */
  const renderStepNav = () => (
    <div style={PLANNER_STEP_NAV_WRAP}>
      <PlannerStepNav
        dataNav="combat"
        steps={stepDefs}
        groups={STEP_GROUPS}
        active={step}
        onSelect={id => go(id as Step)}
        lockReason={stepLockReason}
        flash={setMsg}
        navAttrs={{ className: 'cb-steps' }}
        pillAttrs={() => ({ 'data-cb': 'step' })}
      />
    </div>
  );

  const renderNavRow = (prev: Step | null, next: Step | null, nextLabel?: string) => (
    <div style={{ display: 'flex', gap: 8 }}>
      {prev && <button onClick={() => go(prev)} className="cb-next" style={{ ...T_BTN_GHOST, flex: 1 }}>← Назад</button>}
      {next && <button onClick={() => go(next)} className="cb-next" style={{ ...T_BTN, flex: 1.4 }}>{nextLabel || `Далее → ${STEP_LABEL_RU[next]}`}</button>}
    </div>
  );

  // modern select wrapper with chevron
  const SelectWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ position: 'relative' }}>
      {children}
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#fff', fontSize: 12 }}>▾</span>
    </div>
  );
  void SelectWrap;

  const athleteSummary = `${sex === 'male' ? 'М' : 'Ж'} · ${bodyweight}кг · ${age} лет`;
  const outsideSummary = (sparringEnabled && outsideEnabled) ? `спарринг ${sparringHard + sparringTech + sparringWrest}×` : outsideEnabled ? `вне зала ${outside?.sessionsPerWeek ?? 0}×` : 'выкл';
  const paramsSummary = `${ruLabel(PERIODIZATION_RU, periodizationModel ?? 'atr_10')} · ${weeks}нед · ${days}×`;

  return (
    /* Корень — 1-в-1 с ББ-авто: без своих отступов и maxWidth, их даёт
       хост окна конструктора (.tp-cbody). */
    <div className="combat-constructor" data-step={step} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      <style>{`input[type="range"]{ -webkit-appearance:none; appearance:none; height:6px; border-radius:999px; background:rgba(255,255,255,0.08); }
        input[type="range"]::-webkit-slider-thumb{ -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:linear-gradient(135deg,#a855f7,#ec4899); border:2px solid #fff; box-shadow:0 2px 10px rgba(168,85,247,0.42); cursor:pointer; }
        input[type="range"]::-moz-range-thumb{ width:18px; height:18px; border-radius:50%; background:linear-gradient(135deg,#a855f7,#ec4899); border:2px solid #fff; box-shadow:0 2px 10px rgba(168,85,247,0.42); cursor:pointer; }
        input[type="date"]{ color-scheme: dark; }
      `}</style>

      {/* Шапка и лента шагов — те же токены, что в ББ-авто. */}
      <div style={PLANNER_HEAD_BAR}>
        <span style={PLANNER_HEAD_TITLE}>🥊 Единоборства — PRO силовая</span>
        <span className="cb-hero-step"><Badge color="#fff" bg="linear-gradient(135deg, rgba(168,85,247,0.28), rgba(236,72,153,0.22))" border="rgba(255,255,255,0.14)">{stepIndex}/7 · {STEP_LABEL_RU[step]}</Badge></span>
      </div>
      {renderStepNav()}

      {/* HERO — статусная строка (прогресс + бейджи), карточка кита. */}
      <div className="cb-hero" style={CARD_HERO}>
        <div className="cb-hero-sub" style={{ fontSize: 11, color: '#fff', lineHeight: 1.35 }}>ATR 5/3/2 · кондиция 3 системы · тапер к дате · весогонка ISSN · спарринг · годовой</div>

        <div className="cb-progress"><ProgressBar value={stepIndex} max={7} color={ACCENT} height={8} /></div>

        <div className="cb-status" style={{ ...ROW, justifyContent: 'space-between', gap: 8 }}>
          <div style={ROW}>
            {plan && <Badge color="#fff" bg="rgba(168,85,247,0.16)" border="rgba(168,85,247,0.30)" icon="📋">План {plan.weeks}нед · {plan.patternId}</Badge>}
            {outsideMetrics && <Badge color="#c4b5fd" bg="rgba(168,85,247,0.10)" border="rgba(168,85,247,0.18)" icon="🥋">Вне зала ×{outsideMetrics.volumeMultiplier}</Badge>}
            {acwr && (
              <Badge
                color={acwr.zone === 'dangerous' ? '#fecaca' : acwr.zone === 'caution' ? '#fde68a' : '#d8b4fe'}
                bg={acwr.zone === 'dangerous' ? 'rgba(239,68,68,0.14)' : acwr.zone === 'caution' ? 'rgba(245,158,11,0.12)' : 'rgba(168,85,247,0.12)'}
                border={acwr.zone === 'dangerous' ? 'rgba(239,68,68,0.28)' : acwr.zone === 'caution' ? 'rgba(245,158,11,0.24)' : 'rgba(168,85,247,0.22)'}
              >
                ACWR {acwr.ratio} · {ruLabel(ZONE_RU, acwr.zone)}
              </Badge>
            )}
          </div>
          {msg && (
            <span className="cb-msg" role="status" aria-live="polite" style={{
              fontSize: 11.5, fontWeight: 750, color: '#fff', background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(236,72,153,0.14))',
              border: '1px solid rgba(255,255,255,0.10)', padding: '6px 12px', borderRadius: 20, backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)', animation: 'fadeInUp 0.22s ease',
            }}>{msg}</span>
          )}
        </div>
      </div>

      {step === 'params' && (
        <div className="cb-pane" data-pane="params" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CbSec title="🎯 Дисциплина и цель" defaultOpen summary={`${DISC_RU[discipline] || discipline} · ${GOAL_RU[goal] || goal} · ${weeks}нед`}>
            <SectionCard icon="🎯" title="Дисциплина и цель" subtitle="Подбирает акценты: шея/хват/ротация">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <CombatPopupSelect label="Дисциплина" value={discipline} onChange={v=> setDiscipline(v as any)} options={[
                  { id:'boxing', label:'🥊 Бокс', desc:'шея / кор / ротация' },
                  { id:'mma', label:'🥋 ММА', desc:'шея / хват / тяга' },
                  { id:'wrestling', label:'🤼 Борьба', desc:'шея / хват ×1.3' },
                  { id:'kickboxing', label:'🦵 Кикбоксинг', desc:'ноги / ротация' },
                  { id:'general', label:'🏋️ Общая', desc:'баланс' },
                ]} />
                <CombatPopupSelect label="Цель зала" value={goal} onChange={v=> setGoal(v as any)} options={[
                  { id:'power', label:'⚡ Взрывная сила', desc:'пик мощности, RIR 2-3' },
                  { id:'endurance', label:'🔥 Выносливость', desc:'RIR 3-4, объём' },
                  { id:'maintenance', label:'🛡️ Поддержание', desc:'RIR 4, минимум' },
                  { id:'camp', label:'🏕️ Кэмп к бою', desc:'спец. подготовка' },
                  { id:'weight_cut', label:'⚖️ Весогонка', desc:'ISSN, дефицит' },
                ]} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <CombatPopupSelect label="Уровень" value={level} onChange={v=> changeLevel(v as any)} options={[
                  { id:'beginner', label:'Новичок', desc:'RIR 3-4, техника' },
                  { id:'intermediate', label:'Средний', desc:'RIR 2-3' },
                  { id:'advanced', label:'Продвинутый', desc:'RIR 1-2, taper' },
                  { id:'enhanced', label:'💊 На курсе', desc:'+объём, PED' },
                ]} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                  <Field label={`Недель`} hint={`${weeks} нед — ATR блок`}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={2} max={12} value={weeks} onChange={e => setWeeks(Number(e.target.value))} style={{ flex:1 }} /><Highlight color="#a855f7">{weeks}</Highlight></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#fff', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}><span>2</span><span>12</span></div>
                  </Field>
                  <Field label={`Дней/нед`} hint={`${days}× — зал`}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={2} max={4} value={days} onChange={e => changeDays(Number(e.target.value))} style={{ flex:1 }} /><Highlight color="#a855f7">{days}×</Highlight></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#fff', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}><span>2</span><span>4</span></div>
                  </Field>
                </div>
                <div style={{ height:0.5, background:'rgba(84,84,88,0.36)', margin:'4px 0' }} />
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}><span style={{ fontSize:11, color:'#fff' }}>Акценты: <Highlight>шея</Highlight> · <Highlight>хват</Highlight> · <Highlight>ротация</Highlight> · <Highlight>кор</Highlight></span></div>
              </div>
            </SectionCard>
          </CbSec>

          <CbSec title="📊 Периодизация и кондиция" summary={paramsSummary}>
            <SectionCard icon="📊" title="Периодизация и кондиция" accent>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <CombatPopupSelect label="Модель" value={periodizationModel} onChange={v=> setPeriodizationModel(v as any)} options={[
                  { id:'atr_10', label:'ATR 5/3/2 — 10 нед', desc:'Issurin: 50% Accum 6-10/RIR2-3 → 30% Trans → 20% Real' },
                  { id:'linear_12', label:'Linear 12', desc:'линейный прогресс объёма' },
                  { id:'conjugate', label:'Conjugate', desc:'short-notice, волна' },
                ]} />
                <CombatPopupSelect label="Кондиция" value={conditioningMode} onChange={v=> setConditioningMode(v as any)} options={[
                  { id:'auto', label:'Авто', desc:'alactic+lactic+aerobic' },
                  { id:'off', label:'Выкл', desc:'только зал' },
                  { id:'aerobic', label:'Aerobic Zone2', desc:'40′ low' },
                ]} />
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:2 }}>
                <span style={{ fontSize:11, color:'#fff', background:'rgba(168,85,247,0.08)', padding:'6px 10px', borderRadius:8, border:'1px solid rgba(168,85,247,0.14)' }}><Highlight color="#a855f7">50% Accum</Highlight> 6-10/RIR2-3 → <Highlight>30% Trans</Highlight> 3-6/RIR1-2 → <Highlight>20% Real</Highlight> RIR4</span>
                <span style={{ fontSize:11, color:'#fff', background:'rgba(59,130,246,0.06)', padding:'6px 10px', borderRadius:8, border:'1px solid rgba(59,130,246,0.14)' }}><Highlight color="#3b82f6">Alactic 8×10с</Highlight> · <Highlight color="#3b82f6">Lactic 5×3мин</Highlight> · <Highlight color="#3b82f6">Aerobic 40′</Highlight></span>
              </div>
            </SectionCard>
          </CbSec>

          <CbSec title="🧠 Методика и интенсивность" summary={`${METHOD_RU[methodology ?? ''] || methodology} · ${DUP_RU[dupMode ?? ''] || dupMode}`}>
            <SectionCard icon="🧠" title="Методика и интенсивность" subtitle="Подсвечены зоны RIR/веса">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <CombatPopupSelect label="Порядок" value={methodology} onChange={v=> setMethodology(v as any)} options={[
                  { id:'compound_first', label:'База первой', desc:'классика RIR 2-3' },
                  { id:'pre_exhaust', label:'Предутомление', desc:'изоляция → база' },
                  { id:'post_exhaust', label:'Постутомление', desc:'база → изоляция' },
                ]} />
                <CombatPopupSelect label="DUP-волны" value={dupMode} onChange={v=> setDupMode(v as any)} options={[
                  { id:'off', label:'Выкл', desc:'одна зона' },
                  { id:'power_endurance', label:'Сила / выносливость', desc:'контраст' },
                  { id:'heavy_light', label:'Тяж / лёг', desc:'волна объёма' },
                  { id:'conjugate', label:'Сопряжённая', desc:'макс/динам/повтор' },
                ]} />
              </div>
              <CombatPopupSelect label="Техника" value={intensityTech} onChange={v=> setIntensityTech(v as any)} options={[
                { id:'none', label:'Нет', desc:'чистые сеты' },
                { id:'rest_pause', label:'Rest-pause', desc:'аксессуары' },
                { id:'myo_reps', label:'Myo-reps', desc:'хват' },
                { id:'cluster', label:'Cluster 3×3 / 20с', desc:'база' },
                { id:'contrast', label:'Contrast тяж+плио', desc:'power' },
              ]} />
            </SectionCard>
          </CbSec>

          {renderNavRow(null, 'athlete')}
        </div>
      )}

      {step === 'athlete' && (
        <div className="cb-pane" data-pane="athlete" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CbSec title="👤 Антропометрия" defaultOpen summary={athleteSummary}>
            <SectionCard icon="👤" title="Антропометрия" subtitle="Вес и возраст — % от ПМ и тонус">
              <div style={{ display: 'flex', gap:6, flexWrap:'wrap', background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', fontSize:11, color:'#fff' }}>Профиль: <Highlight color="#a855f7">{sex==='male'?'Мужской':'Женский'}</Highlight> · <Highlight>{bodyweight}кг</Highlight> · <Highlight>{age} лет</Highlight></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <CombatPopupSelect label="Пол" value={sex} onChange={v=> setSex(v as any)} options={[
                  { id:'male', label:'Мужской' },
                  { id:'female', label:'Женский' },
                ]} />
                <CombatPopupNumber label="Вес тела" value={bodyweight} min={40} max={140} suffix="кг" onChange={v=> setBodyweight(v)} />
                <CombatPopupNumber label="Возраст" value={age} min={14} max={65} onChange={v=> setAge(v)} />
                <CombatPopupNumber label="Сотрясения за 12 мес" value={concussionHistory} min={0} max={9} onChange={v=> setConcussionHistory(v)} />
              </div>
              {age <= 15 && (
                <InfoBanner tone="warn">Подросток 14–15: только изометрия шеи (мост/динамика/плио/сани убраны), hard spar запрещён, весогонка-манипуляции запрещены — только gradual под врачом</InfoBanner>
              )}
              {concussionHistory >= 2 && (
                <InfoBanner tone="warn">⛔ Сотрясения ×{concussionHistory} за 12 мес — сборка заблокирована до врача (return-протокол: покой → аэробка → тех-работа → спарринг)</InfoBanner>
              )}
              {concussionHistory === 1 && (
                <InfoBanner tone="warn">1 сотрясение за 12 мес — лимиты: hard spar ≤1×, шея ≥L2, flex/ext ≤0.74</InfoBanner>
              )}
              {(() => {
                // №1: живой скринер red-flags (мёртвый в проде — только тесты). Консолидирует teen/concussion/сгонку.
                try {
                  const scr = screenCombatRedFlags({
                    age, concussionHistory, weightCutKg: weightCut, bodyweightKg: bodyweight,
                    manipulation: waterMode === 'load_cut' || sodiumMode === 'moderate_cut' || carbMode === 'deplete_reload' || heatSessions,
                  });
                  if (!scr.flags.length) return null;
                  return (
                    <div className="cb-redflags" style={{ fontSize: 11, color: '#fff', background: scr.blocked ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', padding: '8px 10px', borderRadius: 10, border: scr.blocked ? '0.5px solid rgba(239,68,68,0.24)' : '0.5px solid rgba(245,158,11,0.18)' }}>
                      {scr.text}
                    </div>
                  );
                } catch { return null; }
              })()}
              <Field label="Интенсивность курса (PED)" hint="учитывается в PED-надбавке объёма; авто — без надбавки интенсивности">
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {([['auto', 'Авто'], ['mild', 'Лёгкая'], ['moderate', 'Средняя'], ['heavy', 'Тяжёлая']] as const).map(([id, label]) => (
                    <ChipToggle key={id} active={courseIntensity === id} onClick={() => setCourseIntensity(id as any)}>{label}</ChipToggle>
                  ))}
                </div>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <CombatPopupNumber label="Экстензия шеи" value={neckExtensionKg} min={0} max={120} suffix="кг" onChange={v=> setNeckExtensionKg(v)} />
                <CombatPopupNumber label="Шея flex/ext" value={neckFlexExtRatio} min={0} max={2} step={0.01} onChange={v=> setNeckFlexExtRatio(v)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <CombatPopupSelect label="Уровень шеи (диагностика)" value={neckLevelOverride ? String(neckLevelOverride) : ''} onChange={v => setNeckLevelOverride(v ? Number(v) : 0)} options={[
                  { id: '', label: 'Авто по уровню', desc: 'как раньше' },
                  { id: '1', label: 'L1 изометрия', desc: 'база 4 плоскости' },
                  { id: '2', label: 'L2 динамика', desc: '12–20 повт' },
                  { id: '3', label: 'L3 Iron Neck', desc: 'эксцентрика 3с' },
                  { id: '4', label: 'L4 мост', desc: 'только продвинутые' },
                ]} />
                <CombatPopupSelect label="Слабая сторона" value={weakSide || ''} onChange={v => setWeakSide((v as any) || '')} options={[
                  { id: '', label: 'Нет', desc: 'симметрия' },
                  { id: 'left', label: 'Левая слабее', desc: 'добивка слева' },
                  { id: 'right', label: 'Правая слабее', desc: 'добивка справа' },
                ]} />
              </div>
              <div style={{ fontSize: 10.5, color: '#fff' }}>Cutoff экстензии 3.71 N/кг (≈{(bodyweight * 0.378).toFixed(1)}кг при {bodyweight}кг) · flex/ext &gt;0.74 — риск ×3 (подростки регби 2024) · шея — модифицируемый фактор, не гарантия (JOSPT)</div>
              <CbSwitch checked={travelMode === 'hotel'} onChange={v => setTravelMode(v ? 'hotel' : 'off')} label="✈️ Отель / дорога" desc="только свой вес, объём ×0.9, верх ограничен" />
              {sex === 'female' && (
                <CbSwitch checked={lutealPhase} onChange={setLutealPhase} label="🌙 Лютеиновая фаза" desc="задержка воды +0.5–1кг — анализ по среднему 7д" />
              )}
              {acwr && (
                <InfoBanner tone={acwr.zone === 'dangerous' ? 'warn' : acwr.zone === 'caution' ? 'warn' : 'ok'}>
                   ACWR {acwr.ratio} · {ruLabel(ZONE_RU, acwr.zone)} {acwr.zone === 'dangerous' ? '— объём ×0.60, RIR+2' : acwr.zone === 'caution' ? '— ×0.85, RIR+1' : acwr.zone === 'undertrained' ? '— добавить объём' : '— оптимум'} · {(acwr as any).method === 'ewma_uncoupled' ? 'EWMA-uncoupled' : 'RA (мало данных)'} · дневник sRPE 28д
                </InfoBanner>
              )}
              {hrvLine && <InfoBanner tone={hrvLine.includes('dangerous') ? 'warn' : hrvLine.includes('caution') ? 'warn' : 'ok'}>{hrvLine}</InfoBanner>}
            </SectionCard>
          </CbSec>

          <CbSec title="🏋️ Рабочие максимумы" summary={`${Object.values(workMax).filter(v => v > 0).length} групп`}>
            <SectionCard icon="🏋️" title="Рабочие максимумы" subtitle="Группы → BW×коэфф. если пусто. Точные — ниже">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {(['bench', 'squat', 'deadlift', 'chest', 'back', 'shoulders', 'quads'] as const).map(k => (
                  <Field key={k} label={WM_LABEL_RU[k] || k}>
                    <input type="number" value={(workMax as any)[k] || ''} onChange={e => setWorkMax(s => ({ ...s, [k]: Number(e.target.value) || 0 }))} style={INPUT} placeholder="кг" />
                  </Field>
                ))}
              </div>
              <button onClick={() => setShowExactWM(v => !v)} style={{ ...BTN, background: showExactWM ? 'rgba(168,85,247,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showExactWM ? 'rgba(168,85,247,0.28)' : 'rgba(255,255,255,0.07)'}`, color: showExactWM ? '#d8b4fe' : '#fff', fontSize: 11 }}>
                {showExactWM ? '▲ Скрыть точные веса' : '▼ Точные веса по упражнениям'}
              </button>
              {showExactWM && (() => {
                const WM_GROUPS: Record<string, { label: string; ids: string[] }> = {
                  push: { label: 'Жим / плечи', ids: ['bench_bar', 'ohp', 'push_press', 'landmine_press'] },
                  pull: { label: 'Тяги', ids: ['row_bar', 'pullup', 'fat_bar_row', 'single_arm_row', 'high_pull', 'towel_pullup', 'rope_climb'] },
                  legs: { label: 'Ноги', ids: ['squat', 'front_squat', 'rdl', 'trap_bar_dead', 'zercher_squat', 'bulgarian_split_heavy', 'single_leg_rdl_combat', 'cossack_squat', 'step_up', 'hip_thrust'] },
                  neck: { label: 'Шея', ids: ['neck_harness_ext', 'neck_flexion', 'neck_lateral_flex', 'neck_rotation'] },
                  grip: { label: 'Хват', ids: ['plate_pinch', 'farmer_carry', 'wrist_roller', 'wrist_flexion'] },
                  core: { label: 'Кор / ротация', ids: ['deadbug', 'ab_wheel', 'copenhagen_plank', 'landmine_rotation', 'pallof_rotation_press', 'sled_push', 'sled_pull', 'band_external_rotation'] },
                };
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(0,0,0,0.18)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', maxHeight: 340, overflowY: 'auto' }}>
                    {Object.entries(WM_GROUPS).map(([key, grp]) => (
                      <div key={key}>
                        <div style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 800, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>{grp.label} · {grp.ids.length}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
                          {grp.ids.map(id => (
                            <label key={id} style={{ color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {cbExerciseName(id)}
                              <input type="number" value={workMaxByExercise[id] || ''} onChange={e => { const v = Number(e.target.value) || 0; setWorkMaxByExercise(s => { const n = { ...s }; if (v > 0) n[id] = v; else delete n[id]; return n; }); }} style={{ ...INPUT, padding: '10px 8px', fontSize: 13 }} placeholder="кг" aria-label={cbExerciseName(id)} />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </SectionCard>
          </CbSec>

          <CbSec title="🛡️ Оборудование и ограничения" summary={`${equipment.length ? equipment.length + ' снар.' : 'всё'}${injuries.length ? ` · ${injuries.length} тр.` : ''}`}>
            <SectionCard icon="🛡️" title="Оборудование и ограничения">
              <Field label="Доступное оборудование">
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {(['barbell', 'dumbbell', 'machine', 'cable', 'sled', 'other'] as const).map(eq => (
                    <ChipToggle key={eq} active={equipment.includes(eq)} onClick={() => setEquipment(s => s.includes(eq) ? s.filter(x => x !== eq) : [...s, eq])}>
                      {(EQUIP_RU as any)[eq] || eq}
                    </ChipToggle>
                  ))}
                </div>
                <div style={HINT_SM}>Пусто — доступно всё. Выбор фильтрует пул упражнений.</div>
              </Field>
              <Divider />
              <Field label="Травмы — щадящий режим" hint="Снижает вес ×0.6 и повышает RIR, фильтрует опасные движения">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input value={injInput} onChange={e => setInjInput(e.target.value)} placeholder="напр.: шея, колено, плечо, кисть" style={{ ...INPUT, flex: 1, minWidth: 180 }} />
                  <button onClick={() => {
                    const parts = injInput.split(',').map(s => s.trim()).filter(Boolean);
                    setInjuries(parts.map(p => ({ location: p, type: injExclude ? 'exclude' : 'joint', exclude: injExclude, mode: injExclude ? 'exclude' : 'graded', severity: injExclude ? 'high' : 'medium' } as any)));
                    setMsg(parts.length ? (injExclude ? '⛔ Исключены: ' : '⚡ Щадящий: ') + parts.join(', ') : 'Список очищен'); setTimeout(() => setMsg(''), 2000);
                  }} style={BTN_SMALL}>Применить</button>
                </div>
                <CbSwitch checked={injExclude} onChange={setInjExclude} label="⛔ Исключить" desc="Выкл — щадящий режим: вес ×0.6–0.7, RIR+1" tone="red" />
                {injuries.length > 0 && (
                  <InfoBanner tone={injExclude ? 'warn' : 'info'}>{injExclude ? '⛔ Исключены: ' : '⚡ Щадящий: '}{injuries.map((j: any) => j.location).join(', ')} — {injExclude ? 'убраны из пула' : 'вес ×0.6–0.7, RIR+1'}</InfoBanner>
                )}
              </Field>
              <Field label="Ограничения мобильности">
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {(['shoulder', 'hip', 'knee', 'ankle', 'wrist', 'neck', 'lower_back'] as const).map(m => (
                    <ChipToggle key={m} active={mobility.includes(m)} onClick={() => setMobility(s => s.includes(m) ? s.filter(x => x !== m) : [...s, m])}>{MOBILITY_RU[m]}</ChipToggle>
                  ))}
                </div>
              </Field>
            </SectionCard>
          </CbSec>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={pullFromProfile} className="cb-profile" style={{ ...T_BTN_GHOST, flex: 1 }}>⟡ Подтянуть из профиля</button>
          </div>
          {renderNavRow('params', 'outside')}
        </div>
      )}

      {step === 'outside' && (
        <div className="cb-pane" data-pane="outside" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CbSec title="🏁 Дата боя и тапер" defaultOpen summary={fightDate || 'без даты'}>
            <SectionCard icon="🏁" title="Дата боя и тапер" subtitle="Дата боя включает авто-тапер + сауну">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Field label="Дата боя">
                  <input type="date" value={fightDate} onChange={e => setFightDate(e.target.value)} style={INPUT} />
                </Field>
                {fightDate ? (
                  <CombatPopupSelect label="Тапер" value={String(taperWeeks)} onChange={v=> setTaperWeeks(Number(v))} options={[
                    { id:'1', label:'1 нед', desc:'объём −45%' },
                    { id:'2', label:'2 нед', desc:'−35% → −55%' },
                  ]} />
                ) : (
                  <Field label="Тапер" hint="сначала дата боя">
                    <div style={{ ...INPUT, opacity: 0.55, display: 'flex', alignItems: 'center', fontSize: 12 }}>недоступно без даты</div>
                  </Field>
                )}
                <Field label="Старт плана">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={INPUT} />
                </Field>
                </div>
                <Field label="Длительность поединка" hint="энергопрофиль боя в отчёте (1-12 мин)">
                  <CombatPopupNumber label="Длительность поединка" value={fightMinutes} min={0} max={15} suffix="мин" onChange={v => setFightMinutes(v)} />
                </Field>
                <InfoBanner tone="info">Тапер по Bosquet: объём 0.65 → 0.45, интенсивность 90-95%, спарринг ↓{age > 15 ? ', сауна 15-20′×3/нед' : ' (сауна исключена: teen-гейт)'}</InfoBanner>
            </SectionCard>
          </CbSec>

          <CbSec title="⚖️ Весогонка ISSN 2025" summary={weightCut > 0 ? `${weightCut} кг` : 'выкл'}>
            <div style={{ ...CARD, background: weightCut > 0 ? 'linear-gradient(180deg, rgba(239,68,68,0.08), rgba(18,16,28,0.62))' : CARD.background, borderColor: weightCut > 0 ? 'rgba(239,68,68,0.22)' : GLASS_BORDER }}>
              <CardHeader icon="⚖️" title="Весогонка ISSN 2025" subtitle={weightCut > 0 ? `Сгонка ${weightCut} кг — плавная, без экстремальных протоколов` : 'Выключена — стабильный режим'} />
              <Field label={`Сгонка · ${weightCut} кг`}>
                <input type="range" min={0} max={8} step={0.5} value={weightCut} onChange={e => { const v = Number(e.target.value); setWeightCut(v); if (v === 0) { setWaterMode('stable'); setSodiumMode('stable'); setCarbMode('stable'); setHeatSessions(false); return; } if (v >= 3) setHeatSessions(true); if (v >= 4) setWaterMode('load_cut'); if (v >= 3) setSodiumMode('moderate_cut'); if (v >= 5) setCarbMode('deplete_reload'); }} />
              </Field>
              {weightCut > 0 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    <CombatPopupSelect label="Взвешивание" value={weighInType} onChange={v=> setWeighInType(v as any)} options={[{id:'day_before_24h',label:'За 24ч (MMA/бокс)',desc:'8-12г/кг рефид'},{id:'same_day_2h',label:'В день (борьба)',desc:'≤3кг, без острой'}]} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    <CombatPopupSelect
                      label="Весовая категория"
                      value={weightClassLimitKg ? String(weightClassLimitKg) : ''}
                      onChange={v => {
                        if (!v) { setWeightClass(''); setWeightClassLimitKg(0); return; }
                        const row = weightClassesFor(weightClassRuleset || discipline, sex).find(r => String(r.limitKg) === v);
                        setWeightClassLimitKg(Number(v));
                        setWeightClass(row ? row.label : v);
                      }}
                      options={[
                        { id: '', label: 'Без категории', desc: 'кг в вакууме' },
                        ...weightClassesFor(weightClassRuleset || discipline, sex).map(r => ({ id: String(r.limitKg), label: r.label, desc: (weightClassRuleset || discipline) === 'kickboxing' ? 'типовые' : (weightClassRuleset || discipline) === 'bjj' ? 'IBJJF gi' : 'офиц. лимит' })),
                      ]}
                    />
                  </div>
                  {(discipline === 'wrestling' || discipline === 'general') && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                      <CombatPopupSelect
                        label="Свод правил"
                        value={weightClassRuleset}
                        onChange={v => { setWeightClassRuleset(v); setWeightClass(''); setWeightClassLimitKg(0); }}
                        options={[
                          { id: '', label: discipline === 'wrestling' ? 'Авто — борьба UWW' : 'Авто — без таблиц', desc: 'по дисциплине' },
                          { id: 'judo', label: 'Дзюдо — IJF', desc: 'М 60–100+ · Ж 48–78+' },
                          { id: 'sambo', label: 'Самбо — FIAS', desc: 'М 58–98+ · Ж 50–80+' },
                          { id: 'bjj', label: 'BJJ — IBJJF gi', desc: 'лимиты с кимоно' },
                        ]}
                      />
                    </div>
                  )}
                  {weightClassLimitKg > 30 && weightClassLine(bodyweight, weightCut, weightClassLimitKg, weightClass) && (
                    <InfoBanner tone={bodyweight - weightCut <= weightClassLimitKg ? 'ok' : 'warn'}>{weightClassLine(bodyweight, weightCut, weightClassLimitKg, weightClass)}</InfoBanner>
                  )}
                  {weightClassRulesetNote(weightClassRuleset || discipline) && (
                    <InfoBanner tone="info">{weightClassRulesetNote(weightClassRuleset || discipline)}</InfoBanner>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <CombatPopupSelect label="Вода" value={waterMode} onChange={v=> setWaterMode(v as any)} options={[{id:'stable',label:'Стабильно 35мл/кг'},{id:'load_cut',label:'Load 8л → 2л',desc:'пиковая неделя'}]} />
                    <CombatPopupSelect label="Натрий" value={sodiumMode} onChange={v=> setSodiumMode(v as any)} options={[{id:'stable',label:'Стабильно 5г'},{id:'moderate_cut',label:'5 → 3 → 1.5г',desc:'плавный срез'}]} />
                    <CombatPopupSelect label="Углеводы" value={carbMode} onChange={v=> setCarbMode(v as any)} options={[{id:'stable',label:'Стабильно 4-5г/кг'},{id:'deplete_reload',label:'1г → 8г рефид',desc:'загрузка'}]} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label={`ORS Na ${orsSodium} ммоль/дл`} hint="ISSN 50-90">
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={30} max={90} step={5} value={orsSodium} onChange={e => setOrsSodium(Number(e.target.value))} style={{ flex:1 }} /><Highlight color="#a855f7">{orsSodium}</Highlight></div>
                    </Field>
                    <Field label={`Клетчатка · ${weightCutFiber} г/день`} hint="ISSN <10 г ×4 дн = 1-2% BM; >15 г при сгоне >4 кг — ошибка">
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={5} max={30} step={1} value={weightCutFiber} onChange={e => setWeightCutFiber(Number(e.target.value))} style={{ flex:1 }} /><Highlight color="#a855f7">{weightCutFiber} г</Highlight></div>
                    </Field>
                    <Field label={`Шаги · ${(weightCutSteps/1000).toFixed(0)}к/день`} hint=" ISSN: ходьба в неделю боя поднимает окислительный расход">
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={4000} max={20000} step={1000} value={weightCutSteps} onChange={e => setWeightCutSteps(Number(e.target.value))} style={{ flex:1 }} /><Highlight color="#64d2ff">{(weightCutSteps/1000).toFixed(0)}к</Highlight></div>
                    </Field>
                  </div>
                  <CbSwitch checked={heatSessions} onChange={setHeatSessions} label="Сауна 15-20′ ×3/нед" desc="heat acclimation (≤4% BM/24ч)" />
                  <CbSwitch checked={confirmedManipulation} onChange={setConfirmedManipulation} label="Подтверждаю экстремальные манипуляции (load_cut/deplete)" desc="требуется при >5кг" tone="red" />
                  {weighInType==='same_day_2h' ? (
                    <InfoBanner tone="warn">Same-day 1-2ч: окно восстановления короткое — сгонка ≤3кг, упор на жир/lean mass, не на воду. После: 0.5-1л ORS + 30-40г углей, без тяжёлой еды.</InfoBanner>
                  ) : (
                    <InfoBanner tone="warn">Регидратация 24-36ч: ORS {orsSodium} mmol/дл 1-1.5л/ч первые 1-2ч → ≤60г/ч углей → 8-12г/кг за 24ч, волокно &lt;10г, жиры исключить 6ч. Цель +10% BM, моча светло-жёлтая. ({(weightCut * 1.25).toFixed(1)}–{(weightCut * 1.5).toFixed(1)} л)</InfoBanner>
                  )}
                  {sex==='female' && weightCut > 2 && <InfoBanner tone="info">Женщины: консервативно ≤5% BM, учёт цикла — лютеиновая задержка +0.5-1кг. RED-S floor 1400ккал.</InfoBanner>}
                </>
              )}
            </div>
          </CbSec>

          <CbSec title="🥋 Вне зала — спарринг" summary={outsideSummary}>
            <SectionCard icon="🥋" title="Вне зала — спарринг декомпозиция" subtitle="Hard RPE 8.5 · tech 5.5 · борьба 7.5. При ≥5× зал сохраняет 1× Zone2 30′ (77% aerobic — Boxing Science)" accent>
              <CbSwitch checked={outsideEnabled} onChange={setOutsideEnabled} label="Учитывать нагрузку вне зала (ринг / татами)" />

              {outsideEnabled && (
                <>
                  <Field label="Режим учёта">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setSparringEnabled(false)} style={sparringEnabled ? BTN : { ...BTN, background: ACCENT_GRAD, color: '#fff', border: 'none' } as any}>Общий учёт</button>
                      <button onClick={() => setSparringEnabled(true)} style={!sparringEnabled ? BTN : { ...BTN, background: ACCENT_GRAD, color: '#fff', border: 'none' } as any}>Декомпозиция спарринга</button>
                    </div>
                  </Field>

                  {!sparringEnabled && outside && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(0,0,0,0.14)', padding: 12, borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.06)' }}>
                      <Field label="Сессий вне зала" hint={`${outside.sessionsPerWeek}×/нед`}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={0} max={6} value={outside.sessionsPerWeek} onChange={e => setOutside(o => o ? { ...o, sessionsPerWeek: Number(e.target.value) } : o)} style={{ flex:1 }} /><Highlight color="#a855f7">{outside.sessionsPerWeek}×</Highlight></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: TEXT_3, fontVariantNumeric: 'tabular-nums' }}><span>0</span><span>6</span></div>
                      </Field>
                      <Field label="Длительность" hint={`${outside.avgDurationMin} мин`}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={30} max={180} step={10} value={outside.avgDurationMin} onChange={e => setOutside(o => o ? { ...o, avgDurationMin: Number(e.target.value) } : o)} style={{ flex:1 }} /><Highlight>{outside.avgDurationMin}′</Highlight></div>
                      </Field>
                      <Field label="RPE" hint={`RPE ${outside.avgSRPE}`}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={1} max={10} value={outside.avgSRPE} onChange={e => setOutside(o => o ? { ...o, avgSRPE: Number(e.target.value) } : o)} style={{ flex:1 }} /><Highlight color={outside.avgSRPE>=8?'#ff3b30': outside.avgSRPE>=6?'#ff9f0a':'#a855f7'}>RPE {outside.avgSRPE}</Highlight></div>
                      </Field>
                      <Field label="Высокие дни" hint="Тяжёлые ноги не ставим за день до высокого дня">
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[0, 1, 2, 3, 4, 5, 6].map(d => {
                            const active = (outside.highIntensityDays || []).includes(d);
                            const label = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][d];
                            return <ChipToggle key={d} active={active} onClick={() => setOutside(o => o ? { ...o, highIntensityDays: active ? (o.highIntensityDays || []).filter(x => x !== d) : [...(o.highIntensityDays || []), d].sort((a, b) => a - b) } : o)}>{label}</ChipToggle>;
                          })}
                        </div>
                      </Field>
                    </div>
                  )}

                  {sparringEnabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, background: 'rgba(0,0,0,0.14)', padding: 12, borderRadius: 12, border: '0.5px solid rgba(255,255,255,0.06)' }}>
                      {/* Э1.1: факт из журнала спарринга (7 дней) → счётчики и длительность */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <button data-cb="spar-journal" style={{ ...BTN, background: 'rgba(236,72,153,0.16)', color: '#fff', border: '1px solid rgba(236,72,153,0.3)' }}
                          onClick={() => {
                            try {
                              const jl = sparringJournalToLoad(loadSparring(), localIsoDate());
                              if (!jl) { doMsg('В журнале нет сессий за 7 дней'); return; }
                              setSparringHard(jl.hardSparSessions); setSparringTech(jl.techSparSessions); setSparringWrest(jl.wrestlingSessions);
                              setSparringAvgDur(jl.avgDurationMin ?? null);
                              doMsg(`Журнал: hard ${jl.hardSparSessions} · tech ${jl.techSparSessions} · борьба ${jl.wrestlingSessions}${jl.avgDurationMin ? ` · ${jl.avgDurationMin} мин` : ''}`);
                            } catch { doMsg('Журнал недоступен'); }
                          }}>⟡ Из журнала (7 дней)</button>
                      </div>
                      <Field label="Жёсткий спарринг" hint={`RPE 8.5 · 90мин`}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={0} max={4} value={sparringHard} onChange={e => setSparringHard(Number(e.target.value))} style={{ flex:1 }} /><Highlight color="#ff3b30">{sparringHard}×</Highlight></div>
                      </Field>
                      <Field label="Технический спарринг" hint={`RPE 5.5 · 60мин`}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={0} max={4} value={sparringTech} onChange={e => setSparringTech(Number(e.target.value))} style={{ flex:1 }} /><Highlight color="#64d2ff">{sparringTech}×</Highlight></div>
                      </Field>
                      <Field label="Борьба" hint={`RPE 7.5 · 75мин`}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="range" min={0} max={4} value={sparringWrest} onChange={e => setSparringWrest(Number(e.target.value))} style={{ flex:1 }} /><Highlight color="#a855f7">{sparringWrest}×</Highlight></div>
                      </Field>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <InfoBanner tone="accent"><Highlight>{sparringLoadWeekly} load</Highlight> → <Highlight>{sparringHard + sparringTech + sparringWrest}×/нед</Highlight> · декомпозиция</InfoBanner>
                      </div>
                      {sparringErrs.map((e, i) => (
                        <div key={i} style={{ gridColumn: '1 / -1' }}>
                          <InfoBanner tone="warn">{e}</InfoBanner>
                        </div>
                      ))}
                    </div>
                  )}

                  <InfoBanner tone={outsideMetrics?.interference === 'high' ? 'warn' : outsideMetrics?.interference === 'medium' ? 'info' : 'accent'}>
                    {outsideMetrics ? <span><Highlight color={outsideMetrics.interference==='high'?'#ff9f0a':'#a855f7'}>{outsideMetrics.weeklyLoad} load</Highlight> → объём зала <Highlight>×{outsideMetrics.volumeMultiplier}</Highlight> ({outsideMetrics.interference === 'high' ? 'высокая' : outsideMetrics.interference === 'medium' ? 'средняя' : outsideMetrics.interference === 'low' ? 'низкая' : outsideMetrics.interference} интерференция)</span> : 'Вне зала: нет данных — объём 100%'}
                  </InfoBanner>
                </>
              )}
            </SectionCard>
          </CbSec>

          <CbSec title="🥊 Стиль боя и осевая нагрузка" summary={STYLE_RU[fightStyle] || fightStyle}>
            <SectionCard icon="🥊" title="Стиль боя и осевая нагрузка" subtitle="Стиль меняет объём: ударник +ротация, борец +шея/хват">
              <Field label="Стиль боя">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <ChipToggle active={fightStyle === 'striker'} onClick={() => setFightStyle('striker')} icon="👊">Ударник</ChipToggle>
                  <ChipToggle active={fightStyle === 'grappler'} onClick={() => setFightStyle('grappler')} icon="🤼">Борец</ChipToggle>
                  <ChipToggle active={fightStyle === 'hybrid'} onClick={() => setFightStyle('hybrid')} icon="🥋">Гибрид</ChipToggle>
                </div>
              </Field>
              <CbSwitch checked={avoidAxialLoad} onChange={setAvoidAxialLoad} label="Избегать осевой нагрузки" desc="грыжа / перегруз позвоночника" tone="red" />
            </SectionCard>
          </CbSec>

          {renderNavRow('athlete', 'split')}
        </div>
      )}

      {step === 'split' && (
        <div className="cb-pane" data-pane="split" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...CARD, padding: 12, gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>Рекомендуем: <span style={{ color: '#d8b4fe' }}>{recommendCombatPattern(days, outside?.sessionsPerWeek || 0, level).name}</span></div>
                <div style={{ fontSize: 11, color: TEXT_3 }}>{patternId ? `Выбран: ${COMBAT_PATTERNS.find(p => p.id === patternId)?.name}` : 'Авто-подбор по дням и нагрузке'} · модель <b style={{ color: '#fff' }}>{ruLabel(PERIODIZATION_RU, periodizationModel ?? 'atr_10')}</b></div>
              </div>
            </div>
          </div>

          <div style={{ ...CARD, padding: 12, gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📚</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>Готовые циклы · {COMBAT_CYCLE_LIBRARY.length}</div>
                <div style={{ fontSize: 11, color: '#fff' }}>Одна кнопка — дисциплина, цель, недели, дни, модель и сплит</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Фильтр циклов по виду спорта">
              {([['all', 'Все'], ['boxing', '🥊 Бокс'], ['wrestling', '🤼 Борьба'], ['mma', '🥋 ММА'], ['kickboxing', '🦵 Кик'], ['general', '🏋️ Общая']] as const).map(([id, label]) => (
                <ChipToggle key={id} active={cycFilter === id} onClick={() => { setCycFilter(id); buzzStep(); }}>{label}</ChipToggle>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {COMBAT_CYCLE_LIBRARY.filter(c => cycFilter === 'all' || c.discipline === cycFilter).map(c => {
                const edge = DISCIPLINE_COLOR[c.discipline] || '#a855f7';
                return (
                <div
                  key={c.id}
                  className="cb-cycle-card"
                  style={{
                    textAlign: 'left', padding: 10, borderRadius: 14,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: `3px solid ${edge}`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.14)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{c.name}</span>
                    <span className="cb-cycle-meta" style={{ fontSize: 11, fontWeight: 800, color: '#d8b4fe', background: 'rgba(168,85,247,0.18)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(168,85,247,0.22)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{c.weeks}нед · {c.daysPerWeek}×</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <span className="cb-cycle-author" style={{ fontSize: 10, fontWeight: 800, color: edge, background: `${edge}1f`, padding: '3px 8px', borderRadius: 20, border: `1px solid ${edge}55` }}>✒ {c.author}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>{ruLabel(LEVEL_RU, c.level)}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>{GOAL_RU[c.goal] || c.goal}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', fontVariantNumeric: 'tabular-nums' }}>{ruLabel(PERIODIZATION_RU, c.periodizationModel ?? 'atr_10')}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#fff', marginTop: 4, lineHeight: 1.4 }}>{c.blurb}</div>
                  <button
                    onClick={() => {
                      setDiscipline(c.discipline); setGoal(c.goal); setLevel(c.level); setWeeks(c.weeks); setDays(c.daysPerWeek);
                      setPeriodizationModel(c.periodizationModel); setPatternId(c.patternId);
                      buzzStep(); setMsg(`✦ Цикл «${c.name}» применён — жмите «Собрать PRO-план»`); setTimeout(() => setMsg(''), 2600);
                    }}
                    className="cb-cycle-apply"
                    style={{ ...BTN_PRIMARY, width: '100%', marginTop: 6, padding: '10px 14px', fontSize: 12, borderRadius: 12 }}
                  >
                    ✦ Применить «{c.name}»
                  </button>
                </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COMBAT_PATTERNS.map(p => {
              const active = patternId ? patternId === p.id : p.id === recommendCombatPattern(days, outside?.sessionsPerWeek || 0, level).id;
              const preview = p.schedule.map(s => s.kind === 'тренировка' ? (s.sessionTag || 'тренировка').slice(0, 4) : 'отд').join(' · ');
              return (
                <button
                  key={p.id}
                  onClick={() => { setPatternId(p.id); buzzStep(); }}
                  className="cb-split-card"
                  data-active={active ? 'true' : 'false'}
                  style={{
                    textAlign: 'left', padding: 12, borderRadius: 14, cursor: 'pointer', transition: 'all 0.18s ease',
                    background: active ? 'linear-gradient(135deg, rgba(168,85,247,0.16), rgba(236,72,153,0.10))' : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                    border: active ? '1px solid rgba(168,85,247,0.36)' : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: active ? '0 6px 20px rgba(168,85,247,0.16), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 12px rgba(0,0,0,0.14)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: active ? '#fff' : '#fff' }}>{p.name}</span>
                    <span className="cb-split-freq" style={{ fontSize: 11, fontWeight: 800, color: active ? '#d8b4fe' : '#fff', background: active ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 20, border: `1px solid ${active ? 'rgba(168,85,247,0.22)' : 'rgba(255,255,255,0.06)'}` }}>{p.sessionsPerRotation}×/нед</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#fff', marginTop: 4, lineHeight: 1.4 }}>{p.description}</div>
                  <div className="cb-split-preview" style={{ fontSize: 11, color: '#fff', marginTop: 6, fontFamily: 'ui-monospace, monospace', background: 'rgba(0,0,0,0.18)', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>{preview}</div>
                  {active && <div className="cb-split-active" style={{ fontSize: 11, color: '#d8b4fe', fontWeight: 800, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 8px #a855f7' }} /> Выбран — предпросмотр: {p.schedule.filter(s => s.kind === 'тренировка').map(s => SESSION_TAG_RU[s.sessionTag || ''] || s.sessionTag).join(', ')}</div>}
                </button>
              );
            })}
          </div>

          <InfoBanner>ATR 5/3/2: 10 нед → 5 накопление 6-10/RIR2-3 → 3 трансформация 3-6/RIR1-2 → 2 реализация тапер. Conjugate — ротация макс/динам/повтор. Linear — ОФП/сила/тапер.</InfoBanner>

          <button onClick={build} className="cb-build" style={{ ...BTN_PRIMARY, width: '100%', padding: '14px 16px', fontSize: 13, borderRadius: 14 }}>
            ✦ Собрать PRO-план {patternId ? `· ${patternId}` : ''} · {ruLabel(PERIODIZATION_RU, periodizationModel ?? 'atr_10')}
          </button>
          {renderNavRow('outside', plan ? 'plan' : null, plan ? 'Далее → План' : undefined)}
        </div>
      )}

      {step === 'plan' && plan && (
        <CombatPlanView
          plan={plan}
          historyLen={history.length}
          onUndo={undo}
          onUpdateEx={updateEx}
          onMoveEx={moveEx}
          onSwapEx={swapEx}
          onBuildATR={handleBuildATR}
          onAddCompetition={handleAddCompetition}
          onRemoveCompetition={handleRemoveCompetition}
          onRemoveAnnual={handleRemoveAnnual}
          annualCyclesHint={annualCycles}
          onPrintAnnual={handlePrintAnnual}
          onDownloadIcs={handleDownloadIcs}
          onExportProgram={exportToUserProgram}
          annual={annual}
          annualWeeks={annualWeeks}
          setAnnualWeeks={setAnnualWeeks}
          annualCycles={annualCycles}
          setAnnualCycles={setAnnualCycles}
          competitionName={competitionName}
          setCompetitionName={setCompetitionName}
          competitionDate={competitionDate}
          setCompetitionDate={setCompetitionDate}
          competitionWeight={competitionWeight}
          setCompetitionWeight={setCompetitionWeight}
          competitionPriority={competitionPriority}
          setCompetitionPriority={setCompetitionPriority}
          startDate={startDate}
          outside={outside}
          outsideMetrics={outsideMetrics}
          diaryLoad={diaryLoad}
          acwr={acwr}
          msg={msg}
          setMsg={setMsg}
        />
      )}
      {step === 'plan' && !plan && (
        <div className="cb-empty" style={{ ...CARD, alignItems: 'center', padding: 28, textAlign: 'center' }}>
          <span style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📋</span>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>План ещё не собран</div>
          <div style={{ fontSize: 12, color: TEXT_3, maxWidth: 320 }}>Вернитесь к параметрам, выберите сплит и нажмите «Собрать PRO-план». Годовой ATR можно построить и без плана.</div>
          <button onClick={() => go('split')} style={BTN_GHOST}>← К сплиту</button>
        </div>
      )}
      {step === 'plan' && plan && renderNavRow('split', 'quality')}

      {step === 'quality' && plan && (
        <div className="cb-pane" data-pane="quality" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionCard icon="📋" title="Сводка плана" subtitle={`${plan.discipline} · ${plan.goal} · ${plan.level} · ${plan.weeks} нед`} accent>
            <div className="cb-plan-stats" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px,1fr))', gap:8 }}>
              <StatTile label="Недель" value={String(plan.weeks)} color="#a855f7" sub={plan.patternId} icon="📅" />
              <StatTile label="Сессий" value={String(plan.weeksData.reduce((a,w)=>a+w.sessions.length,0))} color="#a855f7" sub="за цикл" icon="🗓️" />
              <StatTile label="Сетов" value={String(plan.weeksData.reduce((a,w)=>a+(w.totalSets||0),0))} color="#a855f7" sub="за цикл" icon="📊" />
              <StatTile label="Тоннаж" value={`${Math.round(plan.weeksData.reduce((a,w)=>a+((w as any).totalTonnage||0),0)/1000)}т`} color="#a855f7" sub="за цикл" icon="⚖️" />
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Badge color="#a855f7" bg="rgba(168,85,247,0.12)" border="rgba(168,85,247,0.22)">{plan.discipline}</Badge>
              <Badge color="#a855f7" bg="rgba(168,85,247,0.12)" border="rgba(168,85,247,0.22)">{plan.goal}</Badge>
              <Badge>{plan.patternId}</Badge>
              {(plan.inputSnapshot as any)?.fightDate && <Badge color="#ef4444" bg="rgba(239,68,68,0.10)" border="rgba(239,68,68,0.18)">🏁 бой {(plan.inputSnapshot as any).fightDate}</Badge>}
            </div>
            <div className="cb-plan-weeks" style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {plan.weeksData.map(w=> (
                <span key={w.week} style={{ padding:'4px 8px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'0.5px solid rgba(255,255,255,0.06)', fontSize:11, color:'#fff', fontVariantNumeric:'tabular-nums' }}>Н{w.week} · <Highlight color={w.deload?'#f59e0b': (w as any).taper?'#60a5fa':'#a855f7'}>{w.totalSets}</Highlight> сетов</span>
              ))}
            </div>
            {plan.outsideMetrics && <InfoBanner tone={plan.outsideMetrics.interference==='high'?'warn':'info'}><Highlight color={plan.outsideMetrics.interference==='high'?'#ff9f0a':'#a855f7'}>{plan.outsideMetrics.weeklyLoad} load</Highlight> → объём <Highlight>×{plan.outsideMetrics.volumeMultiplier}</Highlight> · {plan.outsideMetrics.interference}</InfoBanner>}
            {diaryLoad != null && (
              <InfoBanner tone={diaryLoad > 30 ? 'warn' : 'info'}>
                Дневник: нагрузка 7д ≈ {diaryLoad} {diaryLoad > 30 ? '— высоко, рассмотрите лёгкую неделю' : '— норма'} {acwr ? `· ACWR ${acwr.ratio} · ${acwr.zone}` : ''}
              </InfoBanner>
            )}
          </SectionCard>
          {plan.validation?.errors?.length ? (
            <div className="cb-errors" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.24)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>⛔ Сборка заблокирована ({plan.validation.errors.length}) — до врача/исправления</div>
              {plan.validation.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: '#fff' }}>• {e}</div>
              ))}
            </div>
          ) : null}
          {plan.validation?.warnings.map((w, i) => (
            <InfoBanner key={i} tone="warn">{w}</InfoBanner>
          ))}
          <CbMesoCard prev={mesoPrev} nextInput={(plan.inputSnapshot as any) || {}} />
          <CbCampIntelCard
            plan={plan}
            acwr={acwr as any}
            outsideSessions={(() => {
              const snap: any = plan.inputSnapshot || {};
              if (snap.sparringLoad) return (snap.sparringLoad.hardSparSessions || 0) + (snap.sparringLoad.techSparSessions || 0) + (snap.sparringLoad.wrestlingSessions || 0);
              return snap.outsideLoad?.sessionsPerWeek ?? 0;
            })()}
            fightMinutes={fightMinutes > 0 ? fightMinutes : ((plan.inputSnapshot as any)?.fightMinutes ?? null)}
          />
          <CbDiaryCard trends={diaryTrends} />
          <CbQualityMap plan={plan} />
          {plan.rationale?.length ? (
            <CbSec title="📄 Подробный отчёт (текст)" summary={`${plan.rationale.length} строк`}>
              <div style={{ fontSize:11, color:'#fff', whiteSpace:'pre-wrap', lineHeight:1.5, padding: '10px 12px' }}>{buildCombatReport(plan)}</div>
            </CbSec>
          ) : null}
          {renderNavRow('plan', 'export')}
        </div>
      )}
      {step === 'quality' && !plan && (
        <div className="cb-empty" style={{ ...CARD, alignItems: 'center', padding: 28, textAlign: 'center' }}>
          <span style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✦</span>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>Сначала соберите план</div>
          <div style={{ fontSize: 12, color: TEXT_3, maxWidth: 320 }}>Качество считается по собранному плану: сеты/нед, MEV/MRV, ACWR, дневник.</div>
          <button onClick={() => go('split')} style={BTN_GHOST}>← К сплиту</button>
        </div>
      )}

      {step === 'export' && (
          <div className="cb-pane" data-pane="export" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Э4.1: сохранённые планы — загрузка/удаление (раньше список жил только в истории мезоцикла) */}
            <SectionCard icon="📂" title="Сохранённые планы" subtitle={`${savedPlansList.length} из 20 · загрузка и удаление`}>
              {savedPlansList.length === 0 ? (
                <InfoBanner tone="info">Пока нет сохранённых планов — соберите первый на шаге «План».</InfoBanner>
              ) : savedPlansList.slice(0, 8).map((sp: any) => (
                <div key={sp.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: 12, color: '#fff', flex: 1, minWidth: 140 }}>{sp.discipline} · {sp.weeks} нед · {sp.patternId} · {sp.validation?.ok ? '✅' : '⚠'}</span>
                  <button data-cb="plan-load" style={BTN} onClick={() => { setPlan(sp); go('plan'); doMsg('📂 План загружен — правьте и сохраняйте'); }}>📂 Загрузить</button>
                  <button data-cb="plan-del" style={BTN_GHOST} aria-label="Удалить план" onClick={() => {
                    try {
                      removeCombatPlan(sp.id);
                      setPlansTick(t => t + 1);
                      setPlan((prev: CombatPlan | null) => (prev?.id === sp.id ? null : prev));
                      doMsg('🗑 План удалён');
                    } catch { doMsg('Не удалось удалить план'); }
                  }}>🗑</button>
                </div>
              ))}
            </SectionCard>
            {annual ? (
            <AnnualCard
              annual={annual}
              onBuildATR={handleBuildATR}
              annualWeeks={annualWeeks}
              setAnnualWeeks={setAnnualWeeks}
              annualCycles={annualCycles}
              setAnnualCycles={setAnnualCycles}
              startDate={startDate}
              competitionName={competitionName}
              setCompetitionName={setCompetitionName}
              competitionDate={competitionDate}
              setCompetitionDate={setCompetitionDate}
              competitionWeight={competitionWeight}
              setCompetitionWeight={setCompetitionWeight}
              competitionPriority={competitionPriority}
              setCompetitionPriority={setCompetitionPriority}
              onAddCompetition={handleAddCompetition}
              onRemoveCompetition={handleRemoveCompetition}
              onRemoveAnnual={handleRemoveAnnual}
              annualCyclesHint={annualCycles}
              onPrintAnnual={handlePrintAnnual}
              onDownloadIcs={handleDownloadIcs}
            />
          ) : (
            <div className="cb-empty" style={{ ...CARD, alignItems: 'center', padding: 28, textAlign: 'center' }}>
              <span style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🗓️</span>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>Годовой ATR ещё не построен</div>
              <div style={{ fontSize: 12, color: TEXT_3, maxWidth: 320 }}>Соберите план — годовой ATR построится автоматически. Годовой ATR можно построить и без плана.</div>
              <button onClick={handleBuildATR} style={BTN_GHOST}>↻ Построить {annualWeeks} нед ×{annualCycles ?? 1} ц</button>
            </div>
          )}
          {plan && (
            <SectionCard icon="📤" title="Экспорт и шаринг" subtitle="Печать · CSV · ICS · в программу">
              {isCombatPlanBlocked(plan) && (
                <div className="cb-export-blocked" style={{ fontSize: 11, color: '#fff', background: 'rgba(239,68,68,0.08)', padding: '8px 10px', borderRadius: 10, border: '0.5px solid rgba(239,68,68,0.24)' }}>⛔ Экспорт заблокирован — сначала исправьте ошибки на шаге «План»</div>
              )}
              <GroupHeading icon="⎙" text="Копировать и печать" desc="Быстрый обмен" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8 }}>
                <button onClick={() => { const txt = buildCombatReport(plan); navigator.clipboard?.writeText(txt); doMsg('Скопировано'); }} style={{ ...BTN, ...(isCombatPlanBlocked(plan) ? { opacity: 0.4 } : {}) }} disabled={isCombatPlanBlocked(plan)} title={isCombatPlanBlocked(plan) ? 'Сначала исправьте ошибки' : undefined}>⎙ Копировать</button>
                <button onClick={() => { const html = buildCombatPrintHtml(plan); const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); } else { navigator.clipboard?.writeText(html); doMsg('HTML скопирован'); } }} style={{ ...BTN, ...(isCombatPlanBlocked(plan) ? { opacity: 0.4 } : {}) }} disabled={isCombatPlanBlocked(plan)} title={isCombatPlanBlocked(plan) ? 'Сначала исправьте ошибки' : undefined}>🖨 Печать</button>
                <button onClick={exportToUserProgram} style={{ ...BTN_PRIMARY, ...(isCombatPlanBlocked(plan) ? { opacity: 0.4 } : {}) }} disabled={isCombatPlanBlocked(plan)} title={isCombatPlanBlocked(plan) ? 'Сначала исправьте ошибки' : undefined}>✦ В программу</button>
              </div>
              <Divider />
              <GroupHeading icon="📊" text="Файлы" desc="CSV для Excel · ICS для календаря" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8 }}>
                <button onClick={() => { downloadCombatCsv(plan); doMsg('CSV скачан'); }} style={{ ...BTN, ...(isCombatPlanBlocked(plan) ? { opacity: 0.4 } : {}) }} disabled={isCombatPlanBlocked(plan)} title={isCombatPlanBlocked(plan) ? 'Сначала исправьте ошибки' : undefined}>📊 CSV</button>
                <button onClick={() => { downloadCombatXlsx(plan); doMsg('XLS скачан'); }} style={{ ...BTN, ...(isCombatPlanBlocked(plan) ? { opacity: 0.4 } : {}) }} disabled={isCombatPlanBlocked(plan)} title={isCombatPlanBlocked(plan) ? 'Сначала исправьте ошибки' : undefined}>📗 XLSX</button>
                <button onClick={() => { const ics = buildCombatPlanIcs(plan, startDate || null); const blob = new Blob([ics], { type: 'text/calendar' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `combat-plan-${plan.discipline}-${plan.weeks}w.ics`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); doMsg('ICS скачан'); }} style={{ ...BTN, ...(isCombatPlanBlocked(plan) ? { opacity: 0.4 } : {}) }} disabled={isCombatPlanBlocked(plan)} title={isCombatPlanBlocked(plan) ? 'Сначала исправьте ошибки' : undefined}>📅 План .ics</button>
              </div>
              <div style={{ fontSize:11, color:TEXT_3, background:'rgba(255,255,255,0.03)', padding:'8px 10px', borderRadius:10, border:'0.5px solid rgba(255,255,255,0.06)', display:'flex', gap:6, flexWrap:'wrap' }}><Highlight>Экспорт</Highlight> — библиотека программ · печать · ICS · CSV</div>
            </SectionCard>
          )}
          {renderNavRow(plan ? 'quality' : 'split', null)}
        </div>
      )}
    </div>
  );
};
