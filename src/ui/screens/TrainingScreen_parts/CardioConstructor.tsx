/**
 * CardioConstructor.tsx — полноценный пошаговый мастер кардио-цикла
 * (зона «Планировщик», режим «Кардио»). Шаги:
 *  1 Параметры → 2 Старты → 3 Предпросмотр → 4 Управление → 5 Дневник.
 * Создаёт CardioCycle, сохраняет в библиотеку, подключает к ПЛ/ББ/ручному
 * конструктору ссылкой, экспортирует в .ics. Спецификация:
 * docs/CARDIO-CYCLE-INTEGRATION-PLAN.md
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildCardioCycle, buildCardioCycleFromPrep, cardioPlanToCycle, buildCardioPlan,
  loadCardioCycles, saveCardioCycle, removeCardioCycle,
  loadActiveCardioCycle, setActiveCardioCycle,
  buildCardioIcs, buildCardioPrintHtml, compareCardioCycles, formatCardioComparison,
  cardioSessionsForDate, cardioWeekForDate, cardioEquipmentLabel, cardioCycleSummary,
  cardioPlanVariants, explainCardioChoice, saveCardioCycleVersion, restoreCardioCycleVersion, clearCardioCycleHistory,
  loadCardioScenarios, saveCardioScenario, removeCardioScenario,
  bumpCardioZone2Volume,
  cardioProfileFactors, cardioNutritionNotes, CARDIO_VARIANT_LABELS,
  type CardioCycle, type CardioCycleInput, type CardioGoal, type CardioCompetitionRef, type CardioLevel, type CardioEquipment, type CardioVariant, type CardioScenario,
} from '../../../engines/lms/cardio.engine';
import { planFromStored, type BBContestPrepPlan } from '../../../engines/bb/bb-contest-prep.engine';
import { buildAnnualCardioCycles, type AnnualCardioBuildOptions } from '../../../engines/annual-training/annual-training-cardio.engine';
import {
  loadAnnualTrainingPlan, saveAnnualCardioCycles, loadAnnualCardioCycles, removeAnnualCardioCycles,
} from '../../../engines/annual-training/annual-training-storage';
import {
  getCardioLink, setCardioLink, clearCardioLink, subscribeCardioLink,
  SPORT_LABELS, type CardioLinkSport,
} from '../../../engines/lms/cardio-bridge';
import {
  deserializeMacro, serializeMacro, deserializeBbMacro, serializeBbMacro,
  attachCardioToMacro, detachCardioFromMacro,
} from '../../../engines/lms/macrocycle.engine';
import { getProfile, updateSection } from '../../../core/profile-manager';
import { getLatestBp } from '../../../core/bp-hr-data';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';
import { loadSavedBBPlans } from './bb-plans-store';
import { legDaysFromBBPlan } from '../../../engines/lms/cardio.engine';
import { CardioParamsStep, type PhaseSplitState } from './CardioParamsStep';
import { CardioCompsStep, type CompDraft } from './CardioCompsStep';
import { CardioPreviewStep } from './CardioPreviewStep';
import { CardioManageStep } from './CardioManageStep';
import { CardioDiaryStep } from './CardioDiaryStep';

type CardioStep = 'params' | 'comps' | 'preview' | 'manage' | 'diary';

const STEPS: { id: CardioStep; icon: string; label: string }[] = [
  { id: 'params', icon: '⚙️', label: 'Параметры' },
  { id: 'comps', icon: '🏁', label: 'Старты' },
  { id: 'preview', icon: '📋', label: 'Предпросмотр' },
  { id: 'manage', icon: '🔗', label: 'Управление' },
  { id: 'diary', icon: '📓', label: 'Дневник' },
];

const NAV_BTN: React.CSSProperties = {
  padding: '11px 18px', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
  color: '#fff', minHeight: 44, whiteSpace: 'nowrap', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
};
const NAV_BTN_PRIMARY: React.CSSProperties = {
  ...NAV_BTN, background: 'linear-gradient(180deg, rgba(0,230,138,0.22), rgba(0,230,138,0.14))', border: '1px solid rgba(0,230,138,0.52)', color: '#00e68a', boxShadow: '0 4px 14px rgba(0,230,138,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
};

/** Ключ сохранения параметров мастера (восстановление при перезаходе). */
const WIZARD_KEY = 'he_cardio_wizard_state';

interface WizardState {
  [key: string]: any;
  goal: CardioGoal;
  totalWeeks: number;
  daysAvailable: number;
  recoveryLow: boolean;
  bodyWeight: number;
  taperWeeks: number;
  taperModel?: 'step' | 'exponential';
  taperEnabled: boolean;
  peakWeek: boolean;
  phaseAuto: boolean;
  phaseBase: number;
  phaseBuild: number;
  phaseMaint: number;
  level: CardioLevel;
  equipment: CardioEquipment[];
  lowImpact: boolean;
  age: number;
  sex: 'male' | 'female';
  restingHr: number;
  legDays: number[];
  factorSleep: boolean;
  factorStress: boolean;
  factorHrv: boolean;
  factorPed: boolean;
  factorJoints: boolean;
  variant: CardioVariant;
  comps: CardioCompetitionRef[];
  wizardMode?: 'simple' | 'pro';
  bodyFatPct?: number;
  periodizationModel?: 'linear' | 'polarized' | 'pyramidal' | 'pyramidal_polarized';
  maxHrFormula?: 'classic' | 'tanaka' | 'gulati';
}

function loadWizard(): Partial<WizardState> {
  try {
    const v = JSON.parse(localStorage.getItem(WIZARD_KEY) ?? 'null');
    if (!v || typeof v !== 'object') return {};
    // v2: параметры пользователя (возраст/пол/ЧСС покоя) теперь приоритетнее
    // устаревших дефолтов из старых wizard-сохранений — при старом формате
    // возвращаем пусто, чтобы значения подтянулись из профиля.
    if ((v as { version?: number }).version !== 2) return {};
    return v as Partial<WizardState>;
  } catch { return {}; }
}

/** Вес из профиля (personal.weight), если wizard-сохранение отсутствует. */
function profileWeight(): number | undefined {
  try {
    const p = getProfile();
    const w = p?.settings?.personal?.weight;
    return typeof w === 'number' && w > 0 ? w : undefined;
  } catch { return undefined; }
}
function profileBodyFat(): number | undefined {
  try {
    const p = getProfile();
    const bf = p?.settings?.personal?.bodyFat;
    return typeof bf === 'number' && bf >= 3 && bf <= 70 ? bf : undefined;
  } catch { return undefined; }
}

/** Возраст из профиля. */
function profileAge(): number | undefined {
  try {
    const a = getProfile()?.settings?.personal?.age;
    return typeof a === 'number' && a > 0 ? a : undefined;
  } catch { return undefined; }
}

/** Пол из профиля. */
function profileSex(): 'male' | 'female' | undefined {
  try {
    const s = getProfile()?.settings?.personal?.sex;
    return s === 'female' || s === 'male' ? s : undefined;
  } catch { return undefined; }
}

/** ЧСС покоя из профиля (lifestyle.restingHR, fallback health.heartRate). */
function profileRestingHr(): number | undefined {
  try {
    const p = getProfile();
    const lr = p?.settings?.lifestyle?.restingHR;
    if (typeof lr === 'number' && lr > 0) return lr;
    const hr = p?.settings?.health?.heartRate;
    return typeof hr === 'number' && hr > 0 ? hr : undefined;
  } catch { return undefined; }
}

/** Профиль для кардио-питания: вес/пол и калорийность (manualTargets.kcal). */
function profileSettingsForNutrition(): { personal?: { weight?: number; sex?: 'male' | 'female' }; nutrition?: { manualTargets?: { kcal?: number } } } {
  try {
    const s = getProfile()?.settings;
    return {
      personal: s?.personal ? { weight: s.personal.weight, sex: s.personal.sex } : undefined,
      nutrition: s?.nutrition?.manualTargets ? { manualTargets: { kcal: s.nutrition.manualTargets.kcal } } : undefined,
    };
  } catch { return {}; }
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Определяет вариант нагрузки по фактическим опциям цикла (config → variant). */
function variantFromConfig(cfg: { level?: CardioLevel; recoveryLow?: boolean }): CardioVariant {
  if (cfg.level === 'beginner' && cfg.recoveryLow === true) return 'gentle';
  if (cfg.level === 'advanced' && cfg.recoveryLow === false) return 'intense';
  return 'base';
}

function downloadIcs(cycle: CardioCycle): void {
  try {
    const blob = new Blob([buildCardioIcs(cycle)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cycle.id}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch { /* ignore */ }
}

function printCycle(cycle: CardioCycle): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(buildCardioPrintHtml(cycle));
  w.document.close();
  w.print();
}

export const CardioConstructor: React.FC = () => {
  // Шаг 1-2: параметры (восстанавливаются из последней сессии)
  const wizard = useMemo(loadWizard, []);
  const [step, setStep] = useState<CardioStep>('params');
  const [goal, setGoal] = useState<CardioGoal>(wizard.goal ?? 'cut');
  const [totalWeeks, setTotalWeeks] = useState(wizard.totalWeeks ?? 12);
  const [daysAvailable, setDaysAvailable] = useState(wizard.daysAvailable ?? 5);
  const [recoveryLow, setRecoveryLow] = useState(wizard.recoveryLow ?? false);
  const [bodyWeight, setBodyWeight] = useState(wizard.bodyWeight ?? profileWeight() ?? 80);
  const [bodyFatPct, setBodyFatPct] = useState<string>(String((wizard as WizardState).bodyFatPct ?? profileBodyFat() ?? ''));
  const [phaseSplit, setPhaseSplit] = useState<PhaseSplitState>({
    auto: wizard.phaseAuto ?? true,
    base: wizard.phaseBase ?? 0,
    build: wizard.phaseBuild ?? 0,
    maintenance: wizard.phaseMaint ?? 0,
  });
  const [taperWeeks, setTaperWeeks] = useState(wizard.taperWeeks ?? 2);
  const [taperModel, setTaperModel] = useState<'step' | 'exponential'>((wizard as WizardState).taperModel ?? 'step');
  const [periodizationModel, setPeriodizationModel] = useState<'linear' | 'polarized' | 'pyramidal' | 'pyramidal_polarized'>((wizard as WizardState).periodizationModel ?? 'linear');
  const [maxHrFormula, setMaxHrFormula] = useState<'classic' | 'tanaka' | 'gulati'>((wizard as WizardState).maxHrFormula ?? 'classic');
  const [taperEnabled, setTaperEnabled] = useState(wizard.taperEnabled ?? true);
  const [peakWeek, setPeakWeek] = useState(wizard.peakWeek ?? true);
  const [level, setLevel] = useState<CardioLevel>(wizard.level ?? 'intermediate');
  const [equipment, setEquipment] = useState<CardioEquipment[]>(wizard.equipment ?? []);
  const [lowImpact, setLowImpact] = useState(wizard.lowImpact ?? false);
  const [age, setAge] = useState(String(wizard.age ?? profileAge() ?? 30));
  const [sex, setSex] = useState<'male' | 'female'>(wizard.sex ?? profileSex() ?? 'male');
  const [restingHr, setRestingHr] = useState(String(wizard.restingHr ?? profileRestingHr() ?? ''));
  const [variant, setVariant] = useState<CardioVariant>(wizard.variant ?? 'base');
  const [wizardMode, setWizardMode] = useState<'simple' | 'pro'>((wizard as WizardState).wizardMode ?? 'pro');
  const [legDays, setLegDays] = useState<number[]>(wizard.legDays ?? []);
  const [comps, setComps] = useState<CardioCompetitionRef[]>(wizard.comps ?? []);
  const [compDraft, setCompDraft] = useState<CompDraft>({ name: '', week: '' });
  const pf = useMemo(() => {
    try { return cardioProfileFactors(getProfile()?.settings ?? {}); } catch { return {}; }
  }, []);
  // Авто-детекция факторов (5A): найденные в профиле проблемы включены по
  // умолчанию (сохранённый выбор мастера приоритетнее).
  const [factorsOn, setFactorsOn] = useState<{ sleep: boolean; stress: boolean; hrv: boolean; ped: boolean; joints: boolean }>(() => {
    const auto = {
      sleep: !!(pf.sleepHours && pf.sleepHours < 6),
      stress: !!(pf.stressLevel && pf.stressLevel >= 7),
      hrv: !!(pf.hrvMs && pf.hrvMs > 0 && pf.hrvMs < 25),
      ped: !!pf.enhanced,
      joints: !!pf.jointIssues,
    };
    return {
      sleep: wizard.factorSleep ?? auto.sleep,
      stress: wizard.factorStress ?? auto.stress,
      hrv: wizard.factorHrv ?? auto.hrv,
      ped: wizard.factorPed ?? auto.ped,
      joints: wizard.factorJoints ?? auto.joints,
    };
  });
  const factorsSummary = useMemo(() => {
    const out: string[] = [];
    if (factorsOn.sleep) out.push(`Сон: ${pf.sleepHours ?? '—'} ч ${pf.sleepHours && pf.sleepHours < 6 ? '(низкий → объём ×0.9)' : ''}`);
    if (factorsOn.stress) out.push(`Стресс: ${pf.stressLevel ?? '—'}/10 ${pf.stressLevel && pf.stressLevel >= 7 ? '(высокий → HIIT убран, ×0.95)' : ''}`);
    if (factorsOn.hrv) out.push(`HRV: ${pf.hrvMs ? pf.hrvMs + ' мс' : '—'} ${pf.hrvMs && pf.hrvMs < 25 ? '(низкий → ×0.9)' : ''}`);
    if (factorsOn.ped) out.push(`PED-курс: ${pf.enhanced ? 'есть (→ ×1.05)' : 'не обнаружен'}`);
    if (factorsOn.joints) out.push(`Суставы: ${pf.jointIssues ? 'есть проблемы → низкоударный' : 'проблем не найдено'}`);
    return out;
  }, [factorsOn, pf]);
  const onToggleFactor = useCallback((key: keyof typeof factorsOn) => {
    setFactorsOn(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(WIZARD_KEY, JSON.stringify({ ...loadWizard(), version: 2, factorSleep: next.sleep, factorStress: next.stress, factorHrv: next.hrv, factorPed: next.ped, factorJoints: next.joints }));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Факторы профиля, применённые к сборке и предпросмотру шага 1 (единый источник).
  const previewFactors = useMemo(() => ({
    sleepHours: factorsOn.sleep ? pf.sleepHours : undefined,
    stressLevel: factorsOn.stress ? pf.stressLevel : undefined,
    hrvMs: factorsOn.hrv ? pf.hrvMs : undefined,
    enhanced: factorsOn.ped ? pf.enhanced : undefined,
    autoLowImpact: factorsOn.joints ? true : undefined,
    jointIssues: factorsOn.joints ? pf.jointIssues : undefined,
  }), [factorsOn, pf]);

  // Результат и библиотека
  const [cycle, setCycle] = useState<CardioCycle | null>(null);
  const [library, setLibrary] = useState<CardioCycle[]>([]);
  const [link, setLink] = useState(getCardioLink());
  const [macroLink, setMacroLink] = useState<{ kind: 'pl' | 'bb'; cycleId?: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<CardioScenario[]>(() => loadCardioScenarios());
  const [annualCardioMap, setAnnualCardioMap] = useState<Record<string, string>>(() => loadAnnualCardioCycles());

  const readMacroLink = useCallback(() => {
    try {
      const rawPL = localStorage.getItem('he_pl_macro');
      if (rawPL) {
        const m = deserializeMacro(rawPL);
        if (m) { setMacroLink({ kind: 'pl', cycleId: m.cardioCycleId }); return; }
      }
      const rawBB = localStorage.getItem('he_bb_macro');
      if (rawBB) {
        const m = deserializeBbMacro(rawBB);
        if (m) { setMacroLink({ kind: 'bb', cycleId: m.cardioCycleId }); return; }
      }
      setMacroLink(null);
    } catch { setMacroLink(null); }
  }, []);
  useEffect(() => { readMacroLink(); }, [readMacroLink]);

  const reload = useCallback(() => { setLibrary(loadCardioCycles()); }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    setCycle(loadActiveCardioCycle());
    const un = subscribeCardioLink(l => setLink(l));
    return un;
  }, []);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const refreshActive = () => { setCycle(loadActiveCardioCycle()); reload(); };

  const build = () => {
    const bf = Number(bodyFatPct) > 0 ? Math.max(3, Math.min(70, Number(bodyFatPct))) : undefined;
    const base: CardioCycleInput = {
      goal,
      totalWeeks,
      daysAvailable,
      bodyWeight,
      bodyFatPct: bf,
      competitions: comps,
      taperWeeks,
      taperModel,
      taper: taperEnabled,
      peakWeek,
      level,
      equipment,
      lowImpact,
      age: Math.max(12, Math.min(90, Number(age) || 30)),
      restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
      sex,
      legDays,
      ...previewFactors,
      phaseSplit: phaseSplit.auto ? undefined : { base: phaseSplit.base, build: phaseSplit.build, maintenance: phaseSplit.maintenance },
      periodizationModel,
      maxHrFormula,
    };
    const vOpts = variant === 'gentle'
      ? { level: 'beginner' as CardioLevel, recoveryLow: true }
      : variant === 'intense'
        ? { level: 'advanced' as CardioLevel, recoveryLow: false }
        : { level, recoveryLow };
    // config = фактические применённые опции (вариант запекается в конфиг),
    // иначе «⚙️ Изменить параметры» восстановит другой уровень и пересборка
    // даст иной цикл, чем показанный пользователю.
    const applied = { ...base, ...vOpts };
    const c = buildCardioCycle({ ...applied, config: applied });
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    setCycle(c);
    reload();
    flashMsg('✅ Кардио-цикл собран и сохранён в библиотеку');
  };

  /** Живой пересчёт при выборе варианта нагрузки: вариант применяется сразу. */
  const selectVariant = (v: CardioVariant) => {
    setVariant(v);
    const bf2 = Number(bodyFatPct) > 0 ? Math.max(3, Math.min(70, Number(bodyFatPct))) : undefined;
    const base: CardioCycleInput = {
      goal,
      totalWeeks,
      daysAvailable,
      bodyWeight,
      bodyFatPct: bf2,
      competitions: comps,
      taperWeeks,
      taperModel,
      taper: taperEnabled,
      peakWeek,
      level,
      recoveryLow,
      equipment,
      lowImpact,
      age: Math.max(12, Math.min(90, Number(age) || 30)),
      restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
      sex,
      legDays,
      ...previewFactors,
      phaseSplit: phaseSplit.auto ? undefined : { base: phaseSplit.base, build: phaseSplit.build, maintenance: phaseSplit.maintenance },
      periodizationModel,
      maxHrFormula,
    };
    const vOpts = v === 'gentle'
      ? { level: 'beginner' as CardioLevel, recoveryLow: true }
      : v === 'intense'
        ? { level: 'advanced' as CardioLevel, recoveryLow: false }
        : { level, recoveryLow };
    const applied = { ...base, ...vOpts };
    const c = buildCardioCycle({ ...applied, config: applied });
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    setCycle(c);
    reload();
    flashMsg(`⇄ Вариант «${CARDIO_VARIANT_LABELS[v]}» применён — цикл пересобран`);
  };

  const editConfig = () => {
    if (!cycle?.config) { flashMsg('⚠ Параметры сборки недоступны — пересоберите цикл'); return; }
    const cfg = cycle.config;
    setGoal(cfg.goal);
    setTotalWeeks(cfg.totalWeeks ?? totalWeeks);
    setDaysAvailable(cfg.daysAvailable ?? daysAvailable);
    setRecoveryLow(cfg.recoveryLow ?? recoveryLow);
    if (cfg.bodyWeight != null) setBodyWeight(cfg.bodyWeight);
    setComps(cfg.competitions ? cfg.competitions.map(c => ({ ...c })) : []);
    setTaperWeeks(cfg.taperWeeks ?? taperWeeks);
    if ((cfg as unknown as { taperModel?: 'step' | 'exponential' }).taperModel) setTaperModel((cfg as unknown as { taperModel?: 'step' | 'exponential' }).taperModel!);
    if ((cfg as unknown as { periodizationModel?: 'linear' | 'polarized' | 'pyramidal' | 'pyramidal_polarized' }).periodizationModel) setPeriodizationModel((cfg as unknown as { periodizationModel?: 'linear' | 'polarized' | 'pyramidal' | 'pyramidal_polarized' }).periodizationModel!);
    if ((cfg as unknown as { maxHrFormula?: 'classic' | 'tanaka' | 'gulati' }).maxHrFormula) setMaxHrFormula((cfg as unknown as { maxHrFormula?: 'classic' | 'tanaka' | 'gulati' }).maxHrFormula!);
    setTaperEnabled(cfg.taper ?? taperEnabled);
    setPeakWeek(cfg.peakWeek ?? peakWeek);
    setLevel(cfg.level ?? level);
    setEquipment(cfg.equipment ? [...cfg.equipment] : []);
    setLowImpact(cfg.lowImpact ?? lowImpact);
    if (cfg.age != null) setAge(String(cfg.age));
    if (cfg.restingHr != null && cfg.restingHr > 0) setRestingHr(String(cfg.restingHr));
    if (cfg.sex) setSex(cfg.sex);
    setLegDays(cfg.legDays ? [...cfg.legDays] : []);
    setFactorsOn({
      sleep: cfg.sleepHours != null && cfg.sleepHours < 6,
      stress: cfg.stressLevel != null && cfg.stressLevel >= 7,
      hrv: cfg.hrvMs != null && cfg.hrvMs > 0 && cfg.hrvMs < 25,
      ped: cfg.enhanced === true,
      joints: cfg.autoLowImpact === true,
    });
    setPhaseSplit(cfg.phaseSplit ? { auto: false, base: cfg.phaseSplit.base ?? 0, build: cfg.phaseSplit.build ?? 0, maintenance: cfg.phaseSplit.maintenance ?? 0 } : { auto: true, base: 0, build: 0, maintenance: 0 });
    setVariant(cfg.level != null ? variantFromConfig(cfg) : 'base');
    setStep('params');
    flashMsg('⚙️ Параметры загружены из цикла — измените и пересоберите');
  };

  const migrateFromPlan = () => {
    const plan = buildCardioPlan({ goal });
    const c = cardioPlanToCycle(plan, goal);
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    setCycle(c);
    reload();
    flashMsg('✅ Недельный план мигрирован в CardioCycle');
  };

  const duplicate = (c: CardioCycle) => {
    const copy: CardioCycle = { ...c, id: `cardio-${Date.now()}`, name: c.name + ' (копия)', createdAt: new Date().toISOString() };
    saveCardioCycle(copy);
    setActiveCardioCycle(copy);
    setCycle(copy);
    reload();
    flashMsg('⧉ Сценарий продублирован');
  };

  const activate = (c: CardioCycle) => { setActiveCardioCycle(c); setCycle(c); flashMsg('⭐ Активный цикл: ' + c.name); };

  const compareWith = (c: CardioCycle) => {
    if (!cycle) { flashMsg('⚠ Сначала соберите или выберите активный цикл'); return; }
    const cmp = compareCardioCycles(cycle, c);
    setComparison(`${cycle.name} ⇄ ${c.name}: ${formatCardioComparison(cmp)}`);
  };

  const linkTo = (sport: CardioLinkSport) => {
    if (!cycle) { flashMsg('⚠ Сначала соберите или выберите кардио-цикл'); return; }
    setCardioLink({ cycleId: cycle.id, sport, linkedAt: new Date().toISOString() });
    flashMsg(`🔗 Кардио подключено к ${SPORT_LABELS[sport]}`);
  };

  const unlink = () => { clearCardioLink(); flashMsg('🔓 Кардио отключено от силового плана'); };

  const attachMacro = (kind: 'pl' | 'bb') => {
    if (!cycle) { flashMsg('⚠ Сначала соберите или выберите кардио-цикл'); return; }
    const key = kind === 'pl' ? 'he_pl_macro' : 'he_bb_macro';
    try {
      const raw = localStorage.getItem(key);
      const m = kind === 'pl' ? (raw ? deserializeMacro(raw) : null) : (raw ? deserializeBbMacro(raw) : null);
      if (!m) { flashMsg(kind === 'pl' ? '⚠ Годовой план ПЛ не найден — постройте в ПЛ-авто' : '⚠ Годовой план ББ не найден — постройте в ББ-авто'); return; }
      const linked = attachCardioToMacro(m, cycle.id);
      localStorage.setItem(key, kind === 'pl' ? serializeMacro(linked as never) : serializeBbMacro(linked as never));
      setMacroLink({ kind, cycleId: cycle.id });
      flashMsg(`🗓 Кардио привязано к годовому плану (${kind === 'pl' ? 'ПЛ' : 'ББ'})`);
    } catch { flashMsg('⚠ Не удалось привязать кардио к годовому плану'); }
  };

  const detachMacro = () => {
    if (!macroLink) return;
    const key = macroLink.kind === 'pl' ? 'he_pl_macro' : 'he_bb_macro';
    try {
      const raw = localStorage.getItem(key);
      const m = macroLink.kind === 'pl' ? (raw ? deserializeMacro(raw) : null) : (raw ? deserializeBbMacro(raw) : null);
      if (m) localStorage.setItem(key, macroLink.kind === 'pl' ? serializeMacro(detachCardioFromMacro(m) as never) : serializeBbMacro(detachCardioFromMacro(m) as never));
      setMacroLink(null);
      flashMsg('🔓 Кардио отвязано от годового плана');
    } catch { flashMsg('⚠ Не удалось отвязать кардио'); }
  };

  const removeCycle = (c: CardioCycle) => {
    if (!window.confirm(`Удалить кардио-цикл «${c.name || 'без названия'}» (${c.totalWeeks} нед)? Это также очистит его историю версий.`)) return;
    removeCardioCycle(c.id);
    clearCardioCycleHistory(c.id);
    if (cycle?.id === c.id) { setActiveCardioCycle(null); setCycle(null); }
    reload();
  };

  /** ❤️ Кардио по блокам года: buildAnnualCardioCycles → библиотека + маппинг. */
  const buildAnnualCardio = () => {
    const plan = loadAnnualTrainingPlan();
    if (!plan) { flashMsg('⚠ Сначала постройте макроцикл (годовой план) в ПЛ/ББ-авто'); return; }
    const opts: AnnualCardioBuildOptions = {
      level,
      equipment,
      lowImpact,
      autoLowImpact: lowImpact,
      jointIssues: pf.jointIssues,
      age: Math.max(12, Math.min(90, Number(age) || 30)),
      restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
      sex,
      sleepHours: pf.sleepHours,
      stressLevel: pf.stressLevel,
      hrvMs: pf.hrvMs,
      enhanced: pf.enhanced,
      daysAvailable,
      recoveryLow,
      legDays,
      bodyWeight,
    };
    const outcome = buildAnnualCardioCycles(plan, opts);
    const map: Record<string, string> = {};
    for (const [blockKey, c] of Object.entries(outcome.cycles)) {
      saveCardioCycle(c);
      map[blockKey] = c.id;
    }
    saveAnnualCardioCycles(map);
    setAnnualCardioMap(map);
    reload();
    const blockCount = Object.keys(outcome.cycles).length;
    const warn = outcome.warnings.length > 0 ? ` · ${outcome.warnings[0]}` : '';
    flashMsg(blockCount > 0 ? `❤️ Кардио по блокам года: собрано ${blockCount} циклов${warn}` : `⚠ ${warn}`);
  };

  /** 🗑 Сбросить кардио-циклы года (маппинг + циклы из библиотеки). */
  const clearAnnualCardio = () => {
    const map = loadAnnualCardioCycles();
    for (const id of Object.values(map)) removeCardioCycle(id);
    removeAnnualCardioCycles();
    setAnnualCardioMap({});
    if (cycle && Object.values(map).includes(cycle.id)) { setActiveCardioCycle(null); setCycle(null); }
    reload();
    flashMsg('🗑 Кардио по блокам года сброшено');
  };

  const saveScenario = () => {
    if (!cycle) { flashMsg('⚠ Сначала соберите кардио-цикл'); return; }
    saveCardioScenario(cycle);
    setScenarios(loadCardioScenarios());
    flashMsg('📸 Сценарий сохранён');
  };

  const loadScenario = (sc: CardioScenario) => {
    saveCardioCycle(sc.cycle);
    setActiveCardioCycle(sc.cycle);
    setCycle(sc.cycle);
    reload();
    flashMsg(`📸 Загружен сценарий «${sc.name}»`);
  };

  const deleteScenario = (id: string) => {
    removeCardioScenario(id);
    setScenarios(loadCardioScenarios());
  };

  const acwrValue = useMemo(() => {
    try {
      const srpe = loadSRPESessions();
      return srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)).ratio : null;
    } catch { return null; }
  }, []);

  // Prep-план ББ из профиля (goals.bbContestPrepPlan → legacy bbPeakConfig → legacy поля).
  const prepPlan = useMemo<BBContestPrepPlan | null>(() => {
    try {
      const s = getProfile()?.settings ?? {};
      const goals = (s as { goals?: Record<string, unknown> }).goals ?? {};
      return planFromStored(
        typeof goals.bbContestPrepPlan === 'string' ? goals.bbContestPrepPlan : null,
        typeof goals.bbPeakConfig === 'string' ? goals.bbPeakConfig : null,
        goals as { peakWeek?: boolean; peakShowDay?: string; bbCategory?: string },
        s.personal ?? null,
      );
    } catch { return null; }
  }, []);

  // Пик-неделя активного кардио-цикла (неделя + диапазон дат от startDate).
  const peakWeekInfo = useMemo(() => {
    if (!cycle) return null;
    const pk = cycle.weeks.find(w => w.phase === 'peak');
    if (!pk || !cycle.startDate) return null;
    const start = new Date(cycle.startDate);
    start.setDate(start.getDate() + (pk.week - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const f = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    return { week: pk.week, range: `${f(start)}–${f(end)}` };
  }, [cycle]);

  // «⚙️ Из prep-плана»: кардио целиком из BB contest prep (объём — cardioMinutesPerWeek,
  // фазы prep → base/build → taper → пик → post-show).
  const fromPrepPlan = () => {
    if (!prepPlan) { flashMsg('⚠ Prep-план не найден — соберите «🏁 Contest prep» в ББ-авто'); return; }
    const c = buildCardioCycleFromPrep(prepPlan, {
      daysAvailable,
      level,
      equipment,
      lowImpact,
      legDays,
      age: Math.max(12, Math.min(90, Number(age) || 30)),
      restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
    });
    if (!c) { flashMsg('⚠ Не удалось собрать кардио из prep-плана'); return; }
    setGoal('bb_prep');
    setTotalWeeks(c.totalWeeks);
    setTaperEnabled(true);
    setTaperWeeks(prepPlan.taper?.weeks ?? 2);
    setPeakWeek(prepPlan.peakWeek?.enabled !== false);
    if (prepPlan.preparation.startingWeightKg > 0) setBodyWeight(prepPlan.preparation.startingWeightKg);
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    setCycle(c);
    reload();
    flashMsg('⚙️ Кардио построено из prep-плана ББ: ' + c.name);
  };

  // Авто-учёт дней ног из последнего сохранённого ББ-плана (5B).
  const autoLegDays = useMemo(() => {
    try {
      const saved = loadSavedBBPlans();
      return saved.length > 0 ? legDaysFromBBPlan(saved[0].plan) : 0;
    } catch { return 0; }
  }, []);

  // Сохранение параметров мастера
  useEffect(() => {
    try {
      const s: WizardState = {
        goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, taperWeeks, taperModel, periodizationModel, maxHrFormula, taperEnabled, peakWeek,
        phaseAuto: phaseSplit.auto, phaseBase: phaseSplit.base, phaseBuild: phaseSplit.build, phaseMaint: phaseSplit.maintenance,
        level, equipment, lowImpact, age: Math.max(12, Math.min(90, Number(age) || 30)), sex, restingHr: Number(restingHr) > 0 ? Number(restingHr) : 0, legDays,
        factorSleep: factorsOn.sleep, factorStress: factorsOn.stress, factorHrv: factorsOn.hrv, factorPed: factorsOn.ped, factorJoints: factorsOn.joints,
        variant, comps, wizardMode,
      };
      localStorage.setItem(WIZARD_KEY, JSON.stringify({ ...s, version: 2 }));
    } catch { /* ignore */ }
  }, [goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, taperWeeks, taperModel, periodizationModel, maxHrFormula, taperEnabled, peakWeek, phaseSplit, level, equipment, lowImpact, age, sex, restingHr, legDays, factorsOn, variant, comps, wizardMode]);

  const renameCycle = (name: string) => {
    if (!cycle) return;
    const next = { ...cycle, name };
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    setCycle(next);
    reload();
    flashMsg('✏️ Цикл переименован');
  };

  const applyImproved = (improved: CardioCycle) => {
    saveCardioCycleVersion(cycle ?? improved, '✨ авто-улучшение');
    saveCardioCycle(improved);
    setActiveCardioCycle(improved);
    setCycle(improved);
    reload();
    flashMsg('✨ Улучшения применены');
  };

  const applyWeightAdjust = () => {
    if (!cycle) return;
    saveCardioCycleVersion(cycle, '⚖️ коррекция по весу');
    const next = bumpCardioZone2Volume(cycle, 15);
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    setCycle(next);
    reload();
    flashMsg('⚖️ Zone 2 +15 мин применено (отмена — «↩ Вернуть версию»)');
  };

  const planVariants = useMemo(() => {
    if (step !== 'preview') return [];
    try {
      return cardioPlanVariants({
        goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight,
        competitions: comps, taperWeeks, taper: taperEnabled, peakWeek, level, equipment, lowImpact,
        age: Math.max(12, Math.min(90, Number(age) || 30)),
        restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
        sex,
        phaseSplit: phaseSplit.auto ? undefined : { base: phaseSplit.base, build: phaseSplit.build, maintenance: phaseSplit.maintenance },
      });
    } catch { return []; }
  }, [step, goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, comps, taperWeeks, taperEnabled, peakWeek, level, equipment, lowImpact, age, restingHr, sex, phaseSplit]);

  const planExplanation = useMemo(() => {
    if (!cycle || step !== 'preview') return [];
    return explainCardioChoice({
      goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight,
      competitions: comps, taperWeeks, taper: taperEnabled, peakWeek, level, equipment, lowImpact,
      age: Math.max(12, Math.min(90, Number(age) || 30)),
      restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
      sex,
    }, cycle);
  }, [cycle, step, goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, comps, taperWeeks, taperEnabled, peakWeek, level, equipment, lowImpact, age, restingHr, sex]);

  // Цикл устарел относительно текущих параметров мастера (для предпросмотра).
  const effLevel = variant === 'gentle' ? ('beginner' as CardioLevel) : variant === 'intense' ? ('advanced' as CardioLevel) : level;
  const effRecoveryLow = variant === 'gentle' ? true : variant === 'intense' ? false : recoveryLow;
  const paramsDirty = useMemo(() => {
    if (!cycle?.config) return false;
    const cfg = cycle.config;
    const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (cfg.goal !== goal) return true;
    if (cfg.totalWeeks != null && cfg.totalWeeks !== totalWeeks) return true;
    if (cfg.daysAvailable != null && cfg.daysAvailable !== daysAvailable) return true;
    if (!!cfg.recoveryLow !== effRecoveryLow) return true;
    if (cfg.bodyWeight != null && cfg.bodyWeight !== bodyWeight) return true;
    if (cfg.taperWeeks != null && cfg.taperWeeks !== taperWeeks) return true;
    if (!!cfg.taper !== taperEnabled) return true;
    if (!!cfg.peakWeek !== peakWeek) return true;
    if (cfg.level != null && cfg.level !== effLevel) return true;
    if (!same(cfg.equipment, equipment)) return true;
    if (!!cfg.lowImpact !== lowImpact) return true;
    if (cfg.age != null && cfg.age !== Math.max(12, Math.min(90, Number(age) || 30))) return true;
    if (!same(cfg.legDays, legDays)) return true;
    if (cfg.sex !== sex) return true;
    if (!same(cfg.restingHr, Number(restingHr) > 0 ? Number(restingHr) : undefined)) return true;
    if (!same(cfg.competitions, comps)) return true;
    if (!same(cfg.phaseSplit, phaseSplit.auto ? undefined : { base: phaseSplit.base, build: phaseSplit.build, maintenance: phaseSplit.maintenance })) return true;
    if (cfg.enhanced !== previewFactors.enhanced) return true;
    if (cfg.autoLowImpact !== previewFactors.autoLowImpact) return true;
    if (cfg.sleepHours !== previewFactors.sleepHours) return true;
    if (cfg.stressLevel !== previewFactors.stressLevel) return true;
    if (cfg.hrvMs !== previewFactors.hrvMs) return true;
    return false;
  }, [cycle, goal, totalWeeks, daysAvailable, effRecoveryLow, effLevel, bodyWeight, taperWeeks, taperEnabled, peakWeek, level, equipment, lowImpact, age, legDays, sex, restingHr, comps, phaseSplit, previewFactors]);

  const resetParams = () => {
    setGoal('cut');
    setTotalWeeks(12);
    setDaysAvailable(5);
    setRecoveryLow(false);
    setBodyWeight(profileWeight() ?? 80);
    setPhaseSplit({ auto: true, base: 0, build: 0, maintenance: 0 });
    setTaperWeeks(2);
    setTaperModel('step');
    setPeriodizationModel('linear');
    setMaxHrFormula('classic');
    setTaperEnabled(true);
    setPeakWeek(true);
    setVariant('base');
    setLevel('intermediate');
    setEquipment([]);
    setLowImpact(false);
    setAge(String(profileAge() ?? 30));
    setSex(profileSex() ?? 'male');
    setRestingHr(String(profileRestingHr() ?? ''));
    setLegDays([]);
    setComps([]);
    flashMsg('⟲ Параметры сброшены к значениям по умолчанию');
  };

  const fromProfile = () => {
    const w = profileWeight();
    const a = profileAge();
    const s = profileSex();
    const r = profileRestingHr();
    const bf = profileBodyFat();
    if (w != null) setBodyWeight(w);
    if (a != null) setAge(String(a));
    if (s != null) setSex(s);
    if (r != null) setRestingHr(String(r));
    if (bf != null) setBodyFatPct(String(bf));
    flashMsg('📋 Параметры пользователя загружены из профиля');
  };

  const fromDiaryHr = () => {
    try {
      const b = getLatestBp();
      if (b && b.hr > 0) {
        setRestingHr(String(b.hr));
        flashMsg(`❤️ ЧСС покоя из дневника АД: ${b.hr} уд/мин`);
      } else {
        flashMsg('⚠ В дневнике АД нет записей с пульсом');
      }
    } catch { flashMsg('⚠ Не удалось прочитать дневник АД'); }
  };

  const saveToProfile = () => {
    try {
      updateSection('personal', {
        weight: Math.max(30, Math.min(300, Number(bodyWeight) || 80)),
        age: Math.max(12, Math.min(90, Number(age) || 30)),
        sex,
        bodyFat: Number(bodyFatPct) > 0 ? Math.max(3, Math.min(70, Number(bodyFatPct))) : undefined,
      });
      const r = Number(restingHr) > 0 ? Number(restingHr) : 0;
      updateSection('lifestyle', { restingHR: r });
      flashMsg('💾 Параметры сохранены в профиль');
    } catch { flashMsg('⚠ Не удалось сохранить в профиль'); }
  };

  const autoModeOn = useMemo(() => {
    try { return localStorage.getItem('he_cardio_auto_tune') === '1'; } catch { return false; }
  }, [flash, cycle]);

  const todayCardio = useMemo(() => (cycle ? cardioSessionsForDate(cycle, todayIso(), cycle.startDate) : null), [cycle]);

  const nextStartInfo = useMemo(() => {
    if (!cycle) return null;
    const w = cardioWeekForDate(cycle, todayIso(), cycle.startDate);
    const current = w?.week ?? 1;
    const start = cycle.weeks.find(x => x.week >= current && (x.phase === 'taper' || x.phase === 'peak'));
    return start ? { week: start.week, left: Math.max(0, start.week - current) } : null;
  }, [cycle]);

  const stepIdx = STEPS.findIndex(s => s.id === step);
  const goNext = () => {
    if (step === 'preview' && !cycle) {
      build();
      // «Собрать и далее →»: собрать и сразу перейти на следующий шаг (Управление),
      // а не требовать второй клик после пересборки.
      if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].id);
      return;
    }
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].id);
  };
  const goPrev = () => { if (stepIdx > 0) setStep(STEPS[stepIdx - 1].id); };

  return (
    <div className="cardio-constructor" style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      {/* Шапка мастера v2 — чистая, без бейдж-шума */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 16, background: 'linear-gradient(135deg, rgba(0,230,138,0.10) 0%, rgba(16,185,129,0.06) 50%, rgba(6,182,212,0.04) 100%)', border: '1px solid rgba(0,230,138,0.22)', boxShadow: '0 8px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #00e68a, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 14px rgba(0,230,138,0.35)' }}>❤️</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: -0.2, lineHeight: 1 }}>Кардио-конструктор</div>
                <div style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Шаг {stepIdx + 1} из {STEPS.length} — <span style={{ color: '#00e68a' }}>{STEPS[stepIdx].label}</span></div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
            {cycle && (() => {
              const s = cardioCycleSummary(cycle);
              return (
                <>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#93c5fd', background: 'rgba(59,130,246,0.13)', border: '1px solid rgba(59,130,246,0.28)', borderRadius: 10, padding: '5px 11px', boxShadow: '0 1px 6px rgba(59,130,246,0.15)' }} title="Средняя нагрузка цикла">{s.avgMinutesPerWeek} мин/нед</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24', background: 'rgba(245,158,11,0.13)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 10, padding: '5px 11px' }} title="Средний расход цикла">{s.avgKcalPerWeek} ккал/нед</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '5px 11px' }} title="Длительность цикла">{cycle.totalWeeks} нед</span>
                </>
              );
            })()}
            {cycle && <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(0,230,138,0.10)', border: '1px solid rgba(0,230,138,0.22)', borderRadius: 20, padding: '5px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cycle.name}>⭐ {cycle.name}</div>}
          </div>
        </div>
        {/* Второй ряд — статусы, компактно */}
        {(autoModeOn || nextStartInfo || todayCardio || prepPlan || peakWeekInfo) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {autoModeOn && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', background: 'rgba(139,92,246,0.13)', border: '1px solid rgba(139,92,246,0.30)', borderRadius: 20, padding: '4px 10px' }}>🔄 авто-режим</span>
            )}
            {nextStartInfo && nextStartInfo.left > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 20, padding: '4px 10px' }}>🏁 до старта {nextStartInfo.left} нед</span>
            )}
            {todayCardio && todayCardio.sessions.length > 0 && (
              <button
                onClick={() => setStep('diary')}
                title="Перейти к дневнику и быстрому старту"
                style={{ fontSize: 11, fontWeight: 750, color: '#4ade80', background: 'rgba(0,230,138,0.10)', border: '1px solid rgba(0,230,138,0.24)', borderRadius: 20, padding: '5px 12px', cursor: 'pointer' }}
              >
                ▶ Сегодня: {todayCardio.sessions.map(s => `${s.type.toUpperCase()} ${s.durationMin}м`).join(' · ')} — в дневник
              </button>
            )}
            {prepPlan && (
              <button
                onClick={fromPrepPlan}
                title={`Собрать кардио из prep-плана ББ: шоу ${prepPlan.showDate}, подготовка ${prepPlan.preparation.weeks} нед`}
                aria-label="Собрать кардио из prep-плана"
                style={{ fontSize: 11, fontWeight: 800, color: '#ec4899', background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.32)', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                ⚙️ Из prep-плана ({prepPlan.preparation.weeks} нед)
              </button>
            )}
            {peakWeekInfo && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.28)', borderRadius: 20, padding: '4px 10px' }} title="Пик-неделя кардио: только лёгкая активность">🎭 Пик-неделя: нед {peakWeekInfo.week} ({peakWeekInfo.range})</span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.25)' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((stepIdx + 1) / STEPS.length) * 100)}>
            <div style={{ height: 8, borderRadius: 4, width: `${Math.round(((stepIdx + 1) / STEPS.length) * 100)}%`, background: 'linear-gradient(90deg, #00e68a 0%, #06b6d4 100%)', transition: 'width 0.4s ease', boxShadow: '0 0 10px rgba(0,230,138,0.45)' }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', minWidth: 34, textAlign: 'right' }}>{Math.round(((stepIdx + 1) / STEPS.length) * 100)}%</span>
        </div>
      </div>

      {/* Графа пользователя — внутри шага 1, не над степпером */}
      {/* Степпер v2 */}
      <div style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto', scrollbarWidth: 'none', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const done = i < stepIdx;
          return (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              style={{
                flex: '1 0 auto', minWidth: 92, padding: '10px 8px', borderRadius: 11, cursor: 'pointer',
                border: active ? '1px solid rgba(0,230,138,0.55)' : done ? '1px solid rgba(0,230,138,0.20)' : '1px solid rgba(255,255,255,0.06)',
                background: active ? 'linear-gradient(180deg, rgba(0,230,138,0.28), rgba(0,230,138,0.10))' : done ? 'rgba(0,230,138,0.07)' : 'rgba(255,255,255,0.025)',
                color: active ? '#fff' : done ? '#fff' : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                fontSize: 11, fontWeight: active ? 800 : 650, whiteSpace: 'nowrap',
                boxShadow: active ? '0 0 16px rgba(0,230,138,0.22), inset 0 1px 0 rgba(255,255,255,0.07)' : done ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
                opacity: !active && !done ? 0.85 : 1,
                transition: 'all 0.18s ease',
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>{done ? '✓' : s.icon}</span>
              <span style={{ fontSize: 11 }}>{i + 1} {s.label}</span>
            </button>
          );
        })}
      </div>

      {flash && <div style={{ padding: '10px 14px', borderRadius: 12, background: 'linear-gradient(180deg, rgba(0,230,138,0.12), rgba(0,230,138,0.06))', border: '1px solid rgba(0,230,138,0.28)', color: '#4ade80', fontSize: 12, fontWeight: 750, boxShadow: '0 4px 14px rgba(0,230,138,0.14)' }} role="status">{flash}</div>}

      {/* Переключатель простой/профи — только на шаге Параметры */}
      {step === 'params' && (
        <div style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 700, marginLeft: 6 }}>Режим:</span>
          <button onClick={() => setWizardMode('simple')} style={wizardMode === 'simple' ? { padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.18)', color: '#00e68a', fontSize: 12, fontWeight: 800 } : { padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 12 }}>✨ Простой</button>
          <button onClick={() => setWizardMode('pro')} style={wizardMode === 'pro' ? { padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(0,230,138,0.5)', background: 'rgba(0,230,138,0.18)', color: '#00e68a', fontSize: 12, fontWeight: 800 } : { padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 12 }}>🛠 Профи</button>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 6 }}>{wizardMode === 'simple' ? 'Только главное: цель, недели, дни, вес' : 'Все настройки: фазы, оборудование, факторы'}</span>
        </div>
      )}
      {step === 'params' && (
        <CardioParamsStep
          goal={goal} setGoal={setGoal}
          totalWeeks={totalWeeks} setTotalWeeks={setTotalWeeks}
          daysAvailable={daysAvailable} setDaysAvailable={setDaysAvailable}
          recoveryLow={recoveryLow} setRecoveryLow={setRecoveryLow}
          phaseSplit={phaseSplit} setPhaseSplit={setPhaseSplit}
          comps={comps}
          bodyWeight={bodyWeight} setBodyWeight={setBodyWeight}
          taperWeeks={taperWeeks} setTaperWeeks={setTaperWeeks} taperEnabled={taperEnabled} setTaperEnabled={setTaperEnabled} peakWeek={peakWeek} setPeakWeek={setPeakWeek}
          previewFactors={previewFactors}
          level={level} setLevel={setLevel}
          equipment={equipment} setEquipment={setEquipment}
          lowImpact={lowImpact} setLowImpact={setLowImpact}
          age={age} setAge={setAge}
          sex={sex} setSex={setSex}
          restingHr={restingHr} setRestingHr={setRestingHr}
          legDays={legDays} setLegDays={setLegDays}
          factorsOn={factorsOn} onToggleFactor={onToggleFactor}
          factorsSummary={factorsSummary}
          onFromProfile={fromProfile} onSaveProfile={saveToProfile} onFromDiaryHr={fromDiaryHr}
          onReset={resetParams}
          wizardMode={wizardMode}
          periodizationModel={periodizationModel} setPeriodizationModel={setPeriodizationModel}
          taperModel={taperModel} setTaperModel={setTaperModel}
          maxHrFormula={maxHrFormula} setMaxHrFormula={setMaxHrFormula}
        />
      )}
      {step === 'comps' && (
        <CardioCompsStep comps={comps} setComps={setComps} draft={compDraft} setDraft={setCompDraft} totalWeeks={totalWeeks}
          taperWeeks={taperWeeks} taperEnabled={taperEnabled} peakWeek={peakWeek} />
      )}
      {step === 'preview' && (
        <>
          <CardioPreviewStep
            cycle={cycle} onBuild={build} onRename={renameCycle} onEditConfig={editConfig}
            daysAvailable={daysAvailable} recoveryLow={recoveryLow}
            variant={variant} onVariant={selectVariant}
            variants={planVariants} explanation={planExplanation}
            paramsDirty={paramsDirty}
            onImproved={applyImproved}
            factorsSummary={factorsSummary}
            nutritionNotes={cycle ? cardioNutritionNotes(cycle, profileSettingsForNutrition()) : []}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={NAV_BTN} onClick={migrateFromPlan}>📦 Мигрировать недельный план</button>
          </div>
        </>
      )}
      {step === 'manage' && (
        <CardioManageStep
          cycle={cycle} library={library} link={link} macroLink={macroLink} comparison={comparison}
          scenarios={scenarios}
          annualCardioMap={annualCardioMap}
          onBuildAnnualCardio={buildAnnualCardio} onClearAnnualCardio={clearAnnualCardio}
          onLinkTo={linkTo} onUnlink={unlink} onAttachMacro={attachMacro} onDetachMacro={detachMacro}
          onExport={downloadIcs} onPrint={printCycle} onDuplicate={duplicate} onActivate={activate}
          onCompare={compareWith} onRemove={removeCycle} onChanged={refreshActive}
          onSaveScenario={saveScenario} onLoadScenario={loadScenario} onRemoveScenario={deleteScenario}
        />
      )}
      {step === 'diary' && (
        <CardioDiaryStep cycle={cycle} acwr={acwrValue} recoveryLow={recoveryLow} onChanged={refreshActive} onApplyWeightAdjust={applyWeightAdjust} />
      )}

      {/* Навигация v2 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 12, borderRadius: 14, background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
        <button style={{ ...NAV_BTN, minWidth: 110 }} onClick={goPrev} disabled={stepIdx === 0} aria-label="Назад">← Назад</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 600 }}>{stepIdx + 1} / {STEPS.length}</div>
        {stepIdx < STEPS.length - 1 && (
          <button style={{ ...NAV_BTN_PRIMARY, minWidth: 160, boxShadow: '0 4px 14px rgba(0,230,138,0.22)' }} onClick={goNext} aria-label="Далее">
            {step === 'preview' && !cycle ? '🛠 Собрать и далее →' : `Далее: ${STEPS[stepIdx + 1].label} →`}
          </button>
        )}
      </div>
    </div>
  );
};
