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
  latestFieldTestMetrics, kcalForCardio,
  type CardioCycle, type CardioCycleInput, type CardioGoal, type CardioCompetitionRef, type CardioLevel, type CardioEquipment, type CardioVariant, type CardioScenario, type CardioSession,
} from '../../../engines/lms/cardio.engine';
import { getCardioCycleTemplateById } from '../../../data/cardio-cycles/cardio-cycle-index';
import { buildCardioCycleFromTemplate, finishCardioCycle } from '../../../engines/lms/cardio-templates.engine';
import { consumeCardioTemplatePending, subscribeCardioTemplatePending } from '../../../engines/lms/cardio-cycle-bridge';
import { parsePaceText, formatPace } from '../../../engines/lms/cardio-personal-zones.engine';
import { extractCardioProgression, cardioProgressionAdvice } from '../../../engines/lms/cardio-meso-progression.engine';
import { getCardioIntervalPreset } from '../../../engines/lms/cardio-interval-presets.engine';
import { CARDIO_RED_FLAGS } from '../../../engines/lms/cardio-red-flags.engine';
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
import { CardioGoalHorizonSection, CardioAthleteSection, CardioLoadSection, CardioParamsPreviewHero, useCardioParamsPreview } from './CardioParamsStep';
import type { PhaseSplitState } from './CardioParamsStep';
import { BTN, BTN_GHOST, STEP_PILL } from './training-ui';
import { CardioCompsStep, type CompDraft } from './CardioCompsStep';
import { CardioPreviewStep } from './CardioPreviewStep';
import { CardioManageStep } from './CardioManageStep';
import { CardioDiaryStep } from './CardioDiaryStep';
import { CardioValidationCard, CardioMesoRow } from './CardioPlanExtras';
import { CardioHiitSection } from './CardioHiitSection';

/**
 * Кардио-конструктор в оболочке ББ-авто (модерн): 7 мелких шагов
 * params → athlete → load → comps → preview → manage → diary
 * с группами ПАРАМЕТРЫ/ПЛАН/ВЫДАЧА, пилюлями STEP_PILL и «Далее/Назад».
 * Движки/расчёты/строки 1-в-1 — перестроена только оболочка мастера.
 */
type CardioStep = 'params' | 'athlete' | 'load' | 'comps' | 'preview' | 'manage' | 'diary';

const STEPS: { id: CardioStep; label: string }[] = [
  { id: 'params', label: '1 Параметры' },
  { id: 'athlete', label: '2 Атлет' },
  { id: 'load', label: '3 Нагрузка' },
  { id: 'comps', label: '4 Старты' },
  { id: 'preview', label: '5 План' },
  { id: 'manage', label: '6 Библиотека' },
  { id: 'diary', label: '7 Дневник' },
];

const STEP_GROUPS: Record<string, CardioStep[]> = {
  'ПАРАМЕТРЫ': ['params', 'athlete', 'load', 'comps'],
  'ПЛАН': ['preview', 'manage'],
  'ВЫДАЧА': ['diary'],
};

/** Лёгкий haptic на навигации (guard — тишина вне устройства). */
function buzzStep(): void {
  try { (navigator as any)?.vibrate?.(8); } catch { /* no-op */ }
}

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

/** Последние замеры из журнала полевых тестов (раунд 5: wizard > журнал > ''). */
function fieldTestDefaults(): { lthr?: number; ftpWatts?: number; talkHr?: number } {
  try {
    return latestFieldTestMetrics();
  } catch { return {}; }
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
  // PRO-калибровка (Эпик A) + среда (Эпик G): LTHR/FTP/talk-test, жара/высота.
  // Приоритет: wizard > журнал замеров (раунд 5) > пусто.
  const [lthr, setLthr] = useState(() => String((wizard as WizardState).lthr ?? fieldTestDefaults().lthr ?? ''));
  const [ftpWatts, setFtpWatts] = useState(() => String((wizard as WizardState).ftpWatts ?? fieldTestDefaults().ftpWatts ?? ''));
  const [talkHr, setTalkHr] = useState(() => String((wizard as WizardState).talkHr ?? fieldTestDefaults().talkHr ?? ''));
  const [tempC, setTempC] = useState(String((wizard as WizardState).tempC ?? ''));
  const [altitudeM, setAltitudeM] = useState(String((wizard as WizardState).altitudeM ?? ''));
  // Темпы VDOT Daniels (текст «M:SS») — дописываются в сессии при сборке.
  const [easyPace, setEasyPace] = useState(String((wizard as WizardState).easyPace ?? ''));
  const [tempoPace, setTempoPace] = useState(String((wizard as WizardState).tempoPace ?? ''));
  const [intervalPace, setIntervalPace] = useState(String((wizard as WizardState).intervalPace ?? ''));
  // Кросс-мезо: стартовать от прошлого цикла (выкл по умолчанию — сборка 1-в-1).
  const [mesoOn, setMesoOn] = useState((wizard as WizardState).mesoOn === true);
  // Строгая валидация (по умолчанию advisory для шаблонов).
  const [strictValidate, setStrictValidate] = useState((wizard as WizardState).strictValidate === true);
  // P4 PRO-2: красные флаги скрининга (мед-блок интенсива).
  const [redFlags, setRedFlags] = useState<string[]>((wizard as WizardState).redFlags ?? []);
  // P5 PRO-2: свитч второй половины на polarized (Filipas PYR→POL).
  const [tidSwitch, setTidSwitch] = useState((wizard as WizardState).tidSwitch === true);
  // P6 PRO-2: durability-сессия 1×/нед (длинная Z2, только недели ≥150 мин).
  const [durabilityOn, setDurabilityOn] = useState((wizard as WizardState).durabilityOn === true);
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
  const [combatCardio, setCombatCardio] = useState<any>(() => {
    try { const raw = localStorage.getItem('he_combat_cardio_payload'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

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
  // Combat/Strength → Cardio: слушаем he-combat-updated / he-strength-updated, показываем подсказку
  useEffect(() => {
    const onCombatCardio = () => {
      try {
        const raw = localStorage.getItem('he_combat_cardio_payload') || localStorage.getItem('he_strength_cardio_payload');
        if (raw) setCombatCardio(JSON.parse(raw));
        else setCombatCardio(null);
      } catch { setCombatCardio(null); }
    };
    onCombatCardio();
    window.addEventListener('he-combat-updated' as any, onCombatCardio);
    window.addEventListener('he-strength-updated' as any, onCombatCardio);
    return () => {
      window.removeEventListener('he-combat-updated' as any, onCombatCardio);
      window.removeEventListener('he-strength-updated' as any, onCombatCardio);
    };
  }, []);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  /** Пост-обработка собранного цикла (единый finish-хелпер движка). */
  const mesoMultFor = (): number => {
    if (!mesoOn) return 1;
    try {
      const prev = loadCardioCycles()
        .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0];
      return extractCardioProgression(prev)?.startMult ?? 1;
    } catch { return 1; }
  };
  const paceNums = () => ({
    easyPaceSec: parsePaceText(easyPace) ?? undefined,
    tempoPaceSec: parsePaceText(tempoPace) ?? undefined,
    intervalPaceSec: parsePaceText(intervalPace) ?? undefined,
    ftpWatts: Number(ftpWatts) >= 30 && Number(ftpWatts) <= 800 ? Math.round(Number(ftpWatts)) : undefined,
  });
  const finishCycle = (c: CardioCycle): CardioCycle => finishCardioCycle(c, {
    competitions: comps,
    taperEnabled,
    mesoMult: mesoMultFor(),
    ...paceNums(),
  });

  /** Кросс-мезо для UI: совет + множитель от свежего прошлого цикла библиотеки. */
  const mesoInfo = useMemo(() => {
    try {
      const prev = [...library]
        .filter(x => !cycle || x.id !== cycle.id)
        .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))[0];
      const p = extractCardioProgression(prev);
      return { advice: cardioProgressionAdvice(prev), mult: p?.startMult ?? 1 };
    } catch { return { advice: 'Прошлого цикла нет — старт с базового объёма уровня.', mult: 1 }; }
  }, [library, cycle]);

  /** Каталог → конструктор: собрать именной шаблон с параметрами атлета. */
  const applyTemplate = (templateId: string) => {
    const tpl = getCardioCycleTemplateById(templateId);
    if (!tpl) { flashMsg('⚠ Шаблон не найден'); return; }
    const bf = Number(bodyFatPct) > 0 ? Math.max(3, Math.min(70, Number(bodyFatPct))) : undefined;
    const c = finishCycle(buildCardioCycleFromTemplate(tpl, {
      bodyWeight,
      bodyFatPct: bf,
      age: Math.max(12, Math.min(90, Number(age) || 30)),
      restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
      sex, level, daysAvailable, equipment, lowImpact, legDays,
      redFlags: redFlags.length > 0 ? [...redFlags] : undefined,
      ...previewFactors,
    }));
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    setCycle(c);
    reload();
    if (redFlags.length > 0 && c.weeks.some(w => w.sessions.some(s => s.type === 'hiit' || s.type === 'miss'))) {
      flashMsg(`📚 «${tpl.meta.title}» — собрано, но в плане есть HIIT/MISS: при ваших флагах запрещены до врача`);
    } else {
      flashMsg(`📚 «${tpl.meta.title}» — собрано и активировано`);
    }
  };
  const applyTemplateRef = React.useRef(applyTemplate);
  applyTemplateRef.current = applyTemplate;
  // Мост каталога: заявка при монтировании + живые заявки без перемонтажа.
  useEffect(() => {
    const un = subscribeCardioTemplatePending(id => { if (id) applyTemplateRef.current(id); });
    const pending = consumeCardioTemplatePending();
    let t: ReturnType<typeof setTimeout> | undefined;
    if (pending) t = setTimeout(() => applyTemplateRef.current(pending), 0);
    return () => { un(); if (t) clearTimeout(t); };
  }, []);

  const refreshActive = () => { setCycle(loadActiveCardioCycle()); reload(); };

  /** HIIT-протокол → сессия в выбранную неделю активного цикла (снапшот для undo). */
  const addHiitToCycle = (presetId: string, opts: { hrMax?: number; sixMinDistanceM?: number }, week = 1) => {
    if (!cycle) { flashMsg('⚠ Сначала соберите цикл'); return; }
    const preset = getCardioIntervalPreset(presetId);
    if (!preset) { flashMsg('⚠ Протокол не найден'); return; }
    try { saveCardioCycleVersion(cycle, `До HIIT «${preset.title}»`); } catch { /* ignore */ }
    const block = preset.build(opts ?? {});
    const equip = (equipment.find(e => preset.equipment.includes(e)) ?? preset.equipment[0] ?? 'running') as CardioEquipment;
    const totalMin = Math.max(12, Math.round((block.workSec * block.reps + block.restSec * block.reps) / 60) + 12);
    const session: CardioSession = {
      type: 'hiit',
      durationMin: totalMin,
      weeklyFrequency: 1,
      intensity: 'high',
      kcalPerSession: kcalForCardio('hiit', totalMin, bodyWeight, equip, sex),
      purpose: `${preset.title}: ${preset.protocol}. Разминка 10-12 мин.`,
      equipment: equip,
      structured: [block],
    };
    const weeks = cycle.weeks.map(w => {
      if (w.week !== Math.max(1, Math.min(cycle.totalWeeks, Math.round(week)))) return w;
      const sessions = [...w.sessions, session];
      return {
        ...w,
        sessions,
        totalMinutes: sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0),
        totalKcal: sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0),
      };
    });
    const targetWeek = Math.max(1, Math.min(cycle.totalWeeks, Math.round(week)));
    const next: CardioCycle = {
      ...cycle,
      weeks,
      totalKcal: weeks.reduce((s, w) => s + w.totalKcal, 0),
      rationale: [...cycle.rationale, `⚡ HIIT «${preset.title}» добавлен в неделю ${targetWeek}.`],
    };
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    setCycle(next);
    reload();
    flashMsg(`⚡ «${preset.title}» — в неделю ${targetWeek} (отмена — «↩ Вернуть версию»)`);
  };

  const build = () => {
    const bf = Number(bodyFatPct) > 0 ? Math.max(3, Math.min(70, Number(bodyFatPct))) : undefined;
    const lthrNum = Number(lthr) >= 80 && Number(lthr) <= 220 ? Math.round(Number(lthr)) : undefined;
    const ftpNum = Number(ftpWatts) >= 30 && Number(ftpWatts) <= 800 ? Math.round(Number(ftpWatts)) : undefined;
    const talkNum = Number(talkHr) >= 80 && Number(talkHr) <= 200 ? Math.round(Number(talkHr)) : undefined;
    const tempNum = tempC !== '' && Number.isFinite(Number(tempC)) ? Number(tempC) : undefined;
    const altNum = altitudeM !== '' && Number.isFinite(Number(altitudeM)) ? Math.round(Number(altitudeM)) : undefined;
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
      lthr: lthrNum,
      ftpWatts: ftpNum,
      talkZone2Hr: talkNum,
      tempC: tempNum,
      altitudeM: altNum,
      redFlags: redFlags.length > 0 ? [...redFlags] : undefined,
      tidSwitchWeek: tidSwitch ? Math.max(2, Math.ceil(totalWeeks / 2)) : undefined,
      durabilitySession: durabilityOn || undefined,
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
    const c = finishCycle(buildCardioCycle({ ...applied, config: applied }));
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
    const lthrNum2 = Number(lthr) >= 80 && Number(lthr) <= 220 ? Math.round(Number(lthr)) : undefined;
    const ftpNum2 = Number(ftpWatts) >= 30 && Number(ftpWatts) <= 800 ? Math.round(Number(ftpWatts)) : undefined;
    const talkNum2 = Number(talkHr) >= 80 && Number(talkHr) <= 200 ? Math.round(Number(talkHr)) : undefined;
    const tempNum2 = tempC !== '' && Number.isFinite(Number(tempC)) ? Number(tempC) : undefined;
    const altNum2 = altitudeM !== '' && Number.isFinite(Number(altitudeM)) ? Math.round(Number(altitudeM)) : undefined;
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
      lthr: lthrNum2,
      ftpWatts: ftpNum2,
      talkZone2Hr: talkNum2,
      tempC: tempNum2,
      altitudeM: altNum2,
      redFlags: redFlags.length > 0 ? [...redFlags] : undefined,
      tidSwitchWeek: tidSwitch ? Math.max(2, Math.ceil(totalWeeks / 2)) : undefined,
      durabilitySession: durabilityOn || undefined,
    };
    const vOpts = v === 'gentle'
      ? { level: 'beginner' as CardioLevel, recoveryLow: true }
      : v === 'intense'
        ? { level: 'advanced' as CardioLevel, recoveryLow: false }
        : { level, recoveryLow };
    const applied = { ...base, ...vOpts };
    const c = finishCycle(buildCardioCycle({ ...applied, config: applied }));
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
    if (cfg.lthr != null) setLthr(String(cfg.lthr));
    if (cfg.ftpWatts != null) setFtpWatts(String(cfg.ftpWatts));
    if (cfg.talkZone2Hr != null) setTalkHr(String(cfg.talkZone2Hr));
    if (cfg.tempC != null) setTempC(String(cfg.tempC));
    if (cfg.altitudeM != null) setAltitudeM(String(cfg.altitudeM));
    if (Array.isArray((cfg as { redFlags?: unknown }).redFlags)) {
      setRedFlags(((cfg as { redFlags?: unknown }).redFlags as unknown[]).filter(x => typeof x === 'string') as string[]);
    }
    if ((cfg as { tidSwitchWeek?: unknown }).tidSwitchWeek != null) setTidSwitch(true);
    if ((cfg as { durabilitySession?: unknown }).durabilitySession === true) setDurabilityOn(true);
    // Пост-обработка из config-штампа finish-хелпера (темпы VDOT + мезо-флаг).
    const stamped = cfg as unknown as { paceEasySec?: number; paceTempoSec?: number; paceIntervalSec?: number; mesoOn?: boolean };
    if (stamped.paceEasySec != null) setEasyPace(formatPace(stamped.paceEasySec));
    if (stamped.paceTempoSec != null) setTempoPace(formatPace(stamped.paceTempoSec));
    if (stamped.paceIntervalSec != null) setIntervalPace(formatPace(stamped.paceIntervalSec));
    if (stamped.mesoOn === true) setMesoOn(true);
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
      lthr: Number(lthr) >= 80 && Number(lthr) <= 220 ? Math.round(Number(lthr)) : undefined,
      talkZone2Hr: Number(talkHr) >= 80 && Number(talkHr) <= 200 ? Math.round(Number(talkHr)) : undefined,
      tempC: tempC !== '' && Number.isFinite(Number(tempC)) ? Number(tempC) : undefined,
      altitudeM: altitudeM !== '' && Number.isFinite(Number(altitudeM)) ? Math.round(Number(altitudeM)) : undefined,
      redFlags: redFlags.length > 0 ? [...redFlags] : undefined,
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
        lthr, ftpWatts, talkHr, tempC, altitudeM,
        easyPace, tempoPace, intervalPace, mesoOn, strictValidate, redFlags, tidSwitch, durabilityOn,
      };
      localStorage.setItem(WIZARD_KEY, JSON.stringify({ ...s, version: 2 }));
    } catch { /* ignore */ }
  }, [goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, taperWeeks, taperModel, periodizationModel, maxHrFormula, taperEnabled, peakWeek, phaseSplit, level, equipment, lowImpact, age, sex, restingHr, legDays, factorsOn, variant, comps, wizardMode, lthr, ftpWatts, talkHr, tempC, altitudeM, easyPace, tempoPace, intervalPace, mesoOn, strictValidate, redFlags, tidSwitch, durabilityOn]);

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

  /** PRO taper-применение из вкладки «Тапер»: snapshot версии + save + flash (отмена — «↩ Вернуть версию»). */
  const applyTaper = (next: CardioCycle, reason: string) => {
    saveCardioCycleVersion(cycle ?? next, reason);
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    setCycle(next);
    reload();
    flashMsg(`📉 Taper применён (отмена — «↩ Вернуть версию»)`);
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
        lthr: Number(lthr) >= 80 && Number(lthr) <= 220 ? Math.round(Number(lthr)) : undefined,
        ftpWatts: Number(ftpWatts) >= 30 && Number(ftpWatts) <= 800 ? Math.round(Number(ftpWatts)) : undefined,
        talkZone2Hr: Number(talkHr) >= 80 && Number(talkHr) <= 200 ? Math.round(Number(talkHr)) : undefined,
        tempC: tempC !== '' && Number.isFinite(Number(tempC)) ? Number(tempC) : undefined,
        altitudeM: altitudeM !== '' && Number.isFinite(Number(altitudeM)) ? Math.round(Number(altitudeM)) : undefined,
      });
    } catch { return []; }
  }, [step, goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, comps, taperWeeks, taperEnabled, peakWeek, level, equipment, lowImpact, age, restingHr, sex, phaseSplit, lthr, ftpWatts, talkHr, tempC, altitudeM]);

  const planExplanation = useMemo(() => {
    if (!cycle || step !== 'preview') return [];
    return explainCardioChoice({
      goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight,
      competitions: comps, taperWeeks, taper: taperEnabled, peakWeek, level, equipment, lowImpact,
      age: Math.max(12, Math.min(90, Number(age) || 30)),
      restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
      sex,
      lthr: Number(lthr) >= 80 && Number(lthr) <= 220 ? Math.round(Number(lthr)) : undefined,
      ftpWatts: Number(ftpWatts) >= 30 && Number(ftpWatts) <= 800 ? Math.round(Number(ftpWatts)) : undefined,
      talkZone2Hr: Number(talkHr) >= 80 && Number(talkHr) <= 200 ? Math.round(Number(talkHr)) : undefined,
    }, cycle);
  }, [cycle, step, goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, comps, taperWeeks, taperEnabled, peakWeek, level, equipment, lowImpact, age, restingHr, sex, lthr, ftpWatts, talkHr]);

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
    if (!same(cfg.lthr, Number(lthr) >= 80 && Number(lthr) <= 220 ? Math.round(Number(lthr)) : undefined)) return true;
    if (!same(cfg.ftpWatts, Number(ftpWatts) >= 30 && Number(ftpWatts) <= 800 ? Math.round(Number(ftpWatts)) : undefined)) return true;
    if (!same(cfg.talkZone2Hr, Number(talkHr) >= 80 && Number(talkHr) <= 200 ? Math.round(Number(talkHr)) : undefined)) return true;
    if (!same(cfg.tempC, tempC !== '' && Number.isFinite(Number(tempC)) ? Number(tempC) : undefined)) return true;
    if (!same(cfg.altitudeM, altitudeM !== '' && Number.isFinite(Number(altitudeM)) ? Math.round(Number(altitudeM)) : undefined)) return true;
    // №4 PRO-2-добивка: новые флаги тоже пачкают параметры.
    if (!same((cfg as { redFlags?: string[] }).redFlags ?? [], redFlags)) return true;
    if (((cfg as { tidSwitchWeek?: number }).tidSwitchWeek != null) !== tidSwitch) return true;
    if (((cfg as { durabilitySession?: boolean }).durabilitySession === true) !== durabilityOn) return true;
    // Пост-обработка из config-штампа finish-хелпера (темпы VDOT + мезо-флаг).
    const stamped = cfg as unknown as { paceEasySec?: number; paceTempoSec?: number; paceIntervalSec?: number; mesoOn?: boolean };
    if (!same(stamped.paceEasySec, parsePaceText(easyPace) ?? undefined)) return true;
    if (!same(stamped.paceTempoSec, parsePaceText(tempoPace) ?? undefined)) return true;
    if (!same(stamped.paceIntervalSec, parsePaceText(intervalPace) ?? undefined)) return true;
    if ((stamped.mesoOn === true) !== mesoOn) return true;
    return false;
  }, [cycle, goal, totalWeeks, daysAvailable, effRecoveryLow, effLevel, bodyWeight, taperWeeks, taperEnabled, peakWeek, level, equipment, lowImpact, age, legDays, sex, restingHr, comps, phaseSplit, previewFactors, lthr, ftpWatts, talkHr, tempC, altitudeM, easyPace, tempoPace, intervalPace, mesoOn, redFlags, tidSwitch, durabilityOn]);

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
    setLthr('');
    setFtpWatts('');
    setTalkHr('');
    setTempC('');
    setAltitudeM('');
    setEasyPace('');
    setTempoPace('');
    setIntervalPace('');
    setMesoOn(false);
    setStrictValidate(false);
    setLegDays([]);
    setComps([]);
    // №3 PRO-2-добивки: сброс гасит и новые тоглы (иначе висят молча).
    setRedFlags([]);
    setTidSwitch(false);
    setDurabilityOn(false);
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

  /** Раунд 5: подтянуть LTHR/FTP/talk из журнала контрольных замеров. */
  const fromFieldTestLog = () => {
    try {
      const m = latestFieldTestMetrics();
      const parts: string[] = [];
      if (m.lthr != null) { setLthr(String(m.lthr)); parts.push(`LTHR ${m.lthr}`); }
      if (m.ftpWatts != null) { setFtpWatts(String(m.ftpWatts)); parts.push(`FTP ${m.ftpWatts} Вт`); }
      if (m.talkHr != null) { setTalkHr(String(m.talkHr)); parts.push(`talk ${m.talkHr}`); }
      flashMsg(parts.length > 0 ? `🔬 Из журнала замеров: ${parts.join(' · ')}` : '⚠ В журнале замеров нет LTHR/FTP/talk — добавьте в Дневнике → Журнал → 🔬');
    } catch { flashMsg('⚠ Не удалось прочитать журнал замеров'); }
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
    buzzStep();
    if (step === 'preview' && !cycle) {
      build();
      // «Собрать и далее →»: собрать и сразу перейти на следующий шаг (Управление),
      // а не требовать второй клик после пересборки.
      if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].id);
      return;
    }
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].id);
  };
  const goPrev = () => { buzzStep(); if (stepIdx > 0) setStep(STEPS[stepIdx - 1].id); };
  const goStep = (id: CardioStep) => { buzzStep(); setStep(id); };

  /** Живой итог параметров для hero на шагах 1-3 (тот же предпросмотр движка). */
  const paramsPreview = useCardioParamsPreview({
    goal, totalWeeks, daysAvailable, recoveryLow, phaseSplit, comps, bodyWeight,
    taperWeeks, taperModel, taperEnabled, peakWeek, previewFactors, level, equipment,
    lowImpact, age, sex, restingHr, legDays, periodizationModel, maxHrFormula,
    lthr, ftpWatts, talkHr, tempC, altitudeM,
    easyPace, tempoPace, intervalPace,
    mesoMult: mesoOn ? mesoInfo.mult : 1,
    redFlags,
    tidSwitchWeek: tidSwitch ? Math.max(2, Math.ceil(totalWeeks / 2)) : undefined,
    durabilitySession: durabilityOn || undefined,
  });

  const stepLabels: Record<CardioStep, string> = {
    params: '1 Параметры', athlete: '2 Атлет', load: '3 Нагрузка', comps: '4 Старты',
    preview: '5 План', manage: '6 Библиотека', diary: '7 Дневник',
  };
  const renderStepNav = () => {
    const groupEndKeys = new Set(Object.values(STEP_GROUPS).map(arr => arr[arr.length - 1]).filter(Boolean));
    return (
      <div className="ck-wiznav" style={{ background: 'rgba(24,24,27,0.60)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 13, padding: '6px', marginBottom: 8, display: 'flex', gap: 4, overflowX: 'auto' as const, scrollbarWidth: 'none' as const, WebkitOverflowScrolling: 'touch' as const, alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const done = i < stepIdx;
          return (
            <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 as const }}>
              <button onClick={() => goStep(s.id)} aria-current={active ? 'step' : undefined} data-active={active} className="ck-step-pill" style={{ ...STEP_PILL(active), flexShrink: 0 as const, opacity: !active && !done ? 0.88 : 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 9, background: active ? 'rgba(6,40,28,0.22)' : done ? 'rgba(0,230,138,0.18)' : 'rgba(255,255,255,0.08)', fontSize: 10, fontWeight: 850, marginRight: 6 }}>{done ? '✓' : (i + 1)}</span>
                {stepLabels[s.id].replace(/^\d+\s/, '')}
              </button>
              {groupEndKeys.has(s.id) && s.id !== STEPS[STEPS.length - 1].id && <span style={{ width: 1, height: 20, background: 'linear-gradient(to bottom, transparent, rgba(0,230,138,0.25), transparent)', flexShrink: 0 as const, margin: '0 3px', alignSelf: 'center' }} />}
            </span>
          );
        })}
      </div>
    );
  };
  const renderGroupHint = () => {
    const group = (Object.keys(STEP_GROUPS) as string[]).find(g => (STEP_GROUPS[g] as CardioStep[]).includes(step)) ?? 'ПАРАМЕТРЫ';
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: '#00e68a', background: 'rgba(0,230,138,0.10)', border: '1px solid rgba(0,230,138,0.25)', borderRadius: 20, padding: '3px 10px' }}>{group}</span>
      </div>
    );
  };

  return (
    <div className="cardio-constructor ck-wizard" data-step={step} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      {/* Шапка мастера TOP — стекло, glow-иконка, табличные чипы */}
      <div className="ck-hero" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '15px 16px', borderRadius: 18, background: 'linear-gradient(135deg, rgba(0,230,138,0.13) 0%, rgba(16,185,129,0.07) 50%, rgba(6,182,212,0.05) 100%)', border: '1px solid rgba(0,230,138,0.28)', boxShadow: '0 10px 32px rgba(0,0,0,0.26), 0 0 24px rgba(0,230,138,0.07), inset 0 1px 0 rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg, #00e68a, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, boxShadow: '0 4px 18px rgba(0,230,138,0.45), inset 0 1px 0 rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.18)' }}>❤️</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: -0.3, lineHeight: 1 }}>Кардио-конструктор</div>
                <div style={{ fontSize: 11.5, color: '#fff', fontWeight: 600 }}>Шаг {stepIdx + 1} из {STEPS.length} — <span style={{ color: '#00e68a', fontWeight: 800 }}>{STEPS[stepIdx].label}</span></div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
            {cycle && (() => {
              const s = cardioCycleSummary(cycle);
              const chip: React.CSSProperties = { fontSize: 12.5, fontWeight: 800, borderRadius: 11, padding: '6px 12px', fontVariantNumeric: 'tabular-nums', borderTopWidth: 2, borderTopStyle: 'solid' };
              return (
                <>
                  <span style={{ ...chip, color: '#93c5fd', background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.30)', borderTopColor: '#60a5fa', boxShadow: '0 2px 8px rgba(59,130,246,0.18)' }} title="Средняя нагрузка цикла">{s.avgMinutesPerWeek} мин/нед</span>
                  <span style={{ ...chip, color: '#fbbf24', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.30)', borderTopColor: '#f59e0b', boxShadow: '0 2px 8px rgba(245,158,11,0.16)' }} title="Средний расход цикла">{s.avgKcalPerWeek} ккал/нед</span>
                  <span style={{ ...chip, color: '#fff', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)', borderTopColor: 'rgba(255,255,255,0.35)' }} title="Длительность цикла">{cycle.totalWeeks} нед</span>
                </>
              );
            })()}
            {cycle && <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.28)', borderRadius: 20, padding: '6px 13px', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxShadow: '0 0 12px rgba(0,230,138,0.14)' }} title={cycle.name}>⭐ {cycle.name}</div>}
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
          <div style={{ flex: 1, height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.09)', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.28)', position: 'relative' }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((stepIdx + 1) / STEPS.length) * 100)}>
            <div style={{ height: 10, borderRadius: 6, width: `${Math.round(((stepIdx + 1) / STEPS.length) * 100)}%`, background: 'linear-gradient(90deg, #00e68a 0%, #06b6d4 100%)', transition: 'width 0.4s ease', boxShadow: '0 0 12px rgba(0,230,138,0.55)' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 850, color: '#fff', minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round(((stepIdx + 1) / STEPS.length) * 100)}%</span>
        </div>
      </div>

      {/* Пилюли шагов в стиле ББ-авто: группы ПАРАМЕТРЫ/ПЛАН/ВЫДАЧА */}
      {renderStepNav()}
      {renderGroupHint()}

      {flash && <div className="ck-flash" style={{ padding: '11px 14px', borderRadius: 13, background: 'linear-gradient(180deg, rgba(0,230,138,0.14), rgba(0,230,138,0.06))', border: '1px solid rgba(0,230,138,0.32)', borderLeft: '3px solid #00e68a', color: '#4ade80', fontSize: 12.5, fontWeight: 750, boxShadow: '0 4px 16px rgba(0,230,138,0.16)', lineHeight: 1.5 }} role="status">{flash}</div>}

      {/* Переключатель простой/профи — только на шаге Параметры */}
      {step === 'params' && (
        <div className="ck-mode" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 13, background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', alignItems: 'center' }}>
          <button onClick={() => setWizardMode('simple')} aria-pressed={wizardMode === 'simple'} style={wizardMode === 'simple' ? { flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.5)', background: 'linear-gradient(180deg, rgba(0,230,138,0.26), rgba(0,230,138,0.12))', color: '#fff', fontSize: 12.5, fontWeight: 800, boxShadow: '0 0 12px rgba(0,230,138,0.18)' } : { flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid transparent', background: 'transparent', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>✨ Простой</button>
          <button onClick={() => setWizardMode('pro')} aria-pressed={wizardMode === 'pro'} style={wizardMode === 'pro' ? { flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(0,230,138,0.5)', background: 'linear-gradient(180deg, rgba(0,230,138,0.26), rgba(0,230,138,0.12))', color: '#fff', fontSize: 12.5, fontWeight: 800, boxShadow: '0 0 12px rgba(0,230,138,0.18)' } : { flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid transparent', background: 'transparent', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>🛠 Профи</button>
        </div>
      )}
      {step === 'params' && combatCardio && (
        <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.22)', display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:12, fontWeight:800, color:'#c4b5fd' }}>🥊 Единоборства → Кардио:</span>
          <span style={{ fontSize:11, color:'#fff' }}>{combatCardio.zone2MinPerWeek ? `${combatCardio.zone2MinPerWeek} мин Zone2/нед` : ''} {combatCardio.hiitSessions ? `· ${combatCardio.hiitSessions} HIIT/нед` : ''} {combatCardio.totalConditioningMin ? `· всего ${combatCardio.totalConditioningMin} мин` : ''}</span>
          {combatCardio.needsAerobicMaintenance && <span style={{ fontSize:10, color:'#fde68a', background:'rgba(245,158,11,0.12)', padding:'2px 6px', borderRadius:6 }}>нужен 1× Zone2 (кэмп 5×)</span>}
          <button onClick={() => { setDaysAvailable(Math.max(2, Math.min(6, (combatCardio.zone2MinPerWeek ? 3 : daysAvailable)))) ; flashMsg('🥊 Zone2 из плана единоборств учтён — можно собрать'); }} style={{ marginLeft:'auto', padding:'6px 10px', borderRadius:8, background:'rgba(168,85,247,0.14)', color:'#d8b4fe', border:'1px solid rgba(168,85,247,0.28)', cursor:'pointer', fontSize:11, fontWeight:700 }}>Применить Zone2</button>
          <button onClick={() => setCombatCardio(null)} style={{ padding:'4px 8px', borderRadius:8, background:'transparent', border:'none', color:'rgba(255,255,255,0.45)', cursor:'pointer', fontSize:11 }}>✕</button>
        </div>
      )}
      {step === 'params' && (
        <>
          <CardioGoalHorizonSection
            goal={goal} setGoal={setGoal}
            totalWeeks={totalWeeks} setTotalWeeks={setTotalWeeks}
            daysAvailable={daysAvailable} setDaysAvailable={setDaysAvailable}
            recoveryLow={recoveryLow} setRecoveryLow={setRecoveryLow}
            phaseSplit={phaseSplit} setPhaseSplit={setPhaseSplit}
            comps={comps}
            taperWeeks={taperWeeks} setTaperWeeks={setTaperWeeks} taperEnabled={taperEnabled} setTaperEnabled={setTaperEnabled} peakWeek={peakWeek} setPeakWeek={setPeakWeek}
            previewFactors={previewFactors}
            periodizationModel={periodizationModel} setPeriodizationModel={setPeriodizationModel}
            taperModel={taperModel} setTaperModel={setTaperModel}
            maxHrFormula={maxHrFormula} setMaxHrFormula={setMaxHrFormula}
            wizardMode={wizardMode}
          />
          <CardioParamsPreviewHero
            preview={paramsPreview.preview} s={paramsPreview.s} tidPreview={paramsPreview.tidPreview}
            totalWeeks={totalWeeks} goal={goal} taperEnabled={taperEnabled} taperWeeks={taperWeeks} peakWeek={peakWeek}
            onReset={resetParams}
          />
        </>
      )}
      {step === 'athlete' && (
        <>
        <CardioAthleteSection
          age={age} setAge={setAge}
          bodyWeight={bodyWeight} setBodyWeight={setBodyWeight}
          restingHr={restingHr} setRestingHr={setRestingHr}
          sex={sex} setSex={setSex}
          level={level} setLevel={setLevel}
          recoveryLow={recoveryLow} setRecoveryLow={setRecoveryLow}
          lthr={lthr} setLthr={setLthr}
          ftpWatts={ftpWatts} setFtpWatts={setFtpWatts}
          talkHr={talkHr} setTalkHr={setTalkHr}
          tempC={tempC} setTempC={setTempC}
          altitudeM={altitudeM} setAltitudeM={setAltitudeM}
          easyPace={easyPace} setEasyPace={setEasyPace}
          tempoPace={tempoPace} setTempoPace={setTempoPace}
          intervalPace={intervalPace} setIntervalPace={setIntervalPace}
          onFromProfile={fromProfile} onSaveProfile={saveToProfile} onFromDiaryHr={fromDiaryHr} onFromLog={fromFieldTestLog}
          wizardMode={wizardMode}
        />
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🩺 Кардио-скрининг (честно, не диагноз)</div>
          <div style={{ color: '#fff', fontSize: 12, marginBottom: 8 }}>Любой пункт → только Z2/recovery до врача. До 16 лет — щадящий режим всегда.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CARDIO_RED_FLAGS.map(f => {
              const on = redFlags.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  data-cardio="red-flag"
                  data-on={on}
                  title={f.hint}
                  onClick={() => setRedFlags(prev => {
                    const next = prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id];
                    try {
                      localStorage.setItem(WIZARD_KEY, JSON.stringify({ ...loadWizard(), version: 2, redFlags: next }));
                    } catch { /* ignore */ }
                    return next;
                  })}
                  style={{
                    minHeight: 44, padding: '8px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff',
                    border: on ? '1px solid rgba(255,80,80,0.6)' : '1px solid rgba(255,255,255,0.14)',
                    background: on ? 'rgba(255,80,80,0.16)' : 'rgba(255,255,255,0.04)',
                  }}
                >
                  {on ? '🔴 ' : '⚪ '}{f.label}
                </button>
              );
            })}
          </div>
        </div>
        </>
      )}
      {step === 'load' && (
        <>
          <CardioLoadSection
            equipment={equipment} setEquipment={setEquipment}
            lowImpact={lowImpact} setLowImpact={setLowImpact}
            legDays={legDays} setLegDays={setLegDays}
            factorsOn={factorsOn} onToggleFactor={onToggleFactor}
            factorsSummary={factorsSummary}
            wizardMode={wizardMode}
          />
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>🔀 PYR→POL во 2-й половине</span>
              <button
                type="button"
                aria-pressed={tidSwitch}
                data-cardio="tid-switch"
                onClick={() => {
                  setTidSwitch(v => {
                    const next = !v;
                    try {
                      localStorage.setItem(WIZARD_KEY, JSON.stringify({ ...loadWizard(), version: 2, tidSwitch: next }));
                    } catch { /* ignore */ }
                    return next;
                  });
                }}
                style={{
                  minHeight: 44, padding: '8px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff',
                  border: tidSwitch ? '1px solid rgba(0,230,138,0.55)' : '1px solid rgba(255,255,255,0.14)',
                  background: tidSwitch ? 'rgba(0,230,138,0.16)' : 'rgba(255,255,255,0.04)',
                }}
              >
                {tidSwitch ? 'Вкл — поляризация со 2-й половины' : 'Выкл'}
              </button>
            </div>
            <div style={{ color: '#fff', fontSize: 12, marginTop: 6 }}>Filipas 2021: смена PYR→POL в финале +3% к VO2max. Любителю решает объём, не модель (Rivera-2025). Объём недель не меняется — меняется только смесь MISS/HIIT.</div>
          </div>
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>🏔 Durability-длинная 1×/нед</span>
              <button
                type="button"
                aria-pressed={durabilityOn}
                data-cardio="durability"
                onClick={() => {
                  setDurabilityOn(v => {
                    const next = !v;
                    try {
                      localStorage.setItem(WIZARD_KEY, JSON.stringify({ ...loadWizard(), version: 2, durabilityOn: next }));
                    } catch { /* ignore */ }
                    return next;
                  });
                }}
                style={{
                  minHeight: 44, padding: '8px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff',
                  border: durabilityOn ? '1px solid rgba(0,230,138,0.55)' : '1px solid rgba(255,255,255,0.14)',
                  background: durabilityOn ? 'rgba(0,230,138,0.16)' : 'rgba(255,255,255,0.04)',
                }}
              >
                {durabilityOn ? 'Вкл — длинная Z2 в недели ≥150 мин' : 'Выкл'}
              </button>
            </div>
            <div style={{ color: '#fff', fontSize: 12, marginTop: 6 }}>Длинная Z2 с целью decoupling &lt;5% (Smyth 82k / Hunter 2025). Вело 3 ч / бег 100 мин. В недели &lt;150 мин не вшивается — только совет.</div>
          </div>
          <CardioParamsPreviewHero
            preview={paramsPreview.preview} s={paramsPreview.s} tidPreview={paramsPreview.tidPreview}
            totalWeeks={totalWeeks} goal={goal} taperEnabled={taperEnabled} taperWeeks={taperWeeks} peakWeek={peakWeek}
            onReset={resetParams}
          />
        </>
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
            <button style={BTN_GHOST} onClick={migrateFromPlan}>📦 Мигрировать недельный план</button>
          </div>
          <CardioValidationCard cycle={cycle} beginner={level === 'beginner'} strict={strictValidate} onToggleStrict={() => setStrictValidate(v => !v)} onAddHiit={() => addHiitToCycle('sit-8x20', {}, 1)} />
          <CardioMesoRow advice={mesoInfo.advice} mult={mesoInfo.mult} on={mesoOn} onToggle={() => setMesoOn(v => !v)} />
          <CardioHiitSection onAdd={addHiitToCycle} totalWeeks={cycle?.totalWeeks} disabled={!cycle} />
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
          onApplyTaper={applyTaper}
          goal={goal} level={level} daysAvailable={daysAvailable} lowImpact={lowImpact}
          onApplyTemplate={applyTemplate}
        />
      )}
      {step === 'diary' && (
        <CardioDiaryStep cycle={cycle} acwr={acwrValue} recoveryLow={recoveryLow} onChanged={refreshActive} onApplyWeightAdjust={applyWeightAdjust} />
      )}

      {/* Навигация в стиле ББ-авто */}
      <div className="ck-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 12, borderRadius: 15, background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 6px 20px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <button style={{ ...BTN_GHOST, minWidth: 110 }} onClick={goPrev} disabled={stepIdx === 0} aria-label="Назад">← Назад</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: '#fff', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{stepIdx + 1} / {STEPS.length}</div>
        {stepIdx < STEPS.length - 1 && (
          <button style={{ ...BTN, minWidth: 170, background: 'linear-gradient(135deg,#00e68a 0%,#00c8a0 60%,#06b6d4 100%)', color: '#06281c', fontWeight: 850, border: 'none', boxShadow: '0 6px 20px rgba(0,230,138,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }} onClick={goNext} aria-label="Далее">
            {step === 'preview' && !cycle ? '🛠 Собрать и далее →' : `Далее: ${STEPS[stepIdx + 1].label} →`}
          </button>
        )}
      </div>
    </div>
  );
};
