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
  buildCardioCycle, cardioPlanToCycle, buildCardioPlan,
  loadCardioCycles, saveCardioCycle, removeCardioCycle,
  loadActiveCardioCycle, setActiveCardioCycle,
  buildCardioIcs, buildCardioPrintHtml, compareCardioCycles, formatCardioComparison,
  cardioSessionsForDate, cardioWeekForDate, cardioEquipmentLabel,
  cardioPlanVariants, explainCardioChoice, saveCardioCycleVersion,
  loadCardioScenarios, saveCardioScenario, removeCardioScenario,
  bumpCardioZone2Volume,
  cardioProfileFactors, cardioNutritionNotes,
  type CardioCycle, type CardioCycleInput, type CardioGoal, type CardioCompetitionRef, type CardioLevel, type CardioEquipment, type CardioVariant, type CardioScenario,
} from '../../../engines/lms/cardio.engine';
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
import { CardioUserCard } from './CardioUserCard';
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
  padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: '#fff', minHeight: 44, whiteSpace: 'nowrap',
};
const NAV_BTN_PRIMARY: React.CSSProperties = {
  ...NAV_BTN, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.5)', color: '#00e68a',
};

/** Ключ сохранения параметров мастера (восстановление при перезаходе). */
const WIZARD_KEY = 'he_cardio_wizard_state';

interface WizardState {
  goal: CardioGoal;
  totalWeeks: number;
  daysAvailable: number;
  recoveryLow: boolean;
  bodyWeight: number;
  taperWeeks: number;
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
  const [phaseSplit, setPhaseSplit] = useState<PhaseSplitState>({
    auto: wizard.phaseAuto ?? true,
    base: wizard.phaseBase ?? 0,
    build: wizard.phaseBuild ?? 0,
    maintenance: wizard.phaseMaint ?? 0,
  });
  const [taperWeeks, setTaperWeeks] = useState(wizard.taperWeeks ?? 2);
  const [peakWeek, setPeakWeek] = useState(wizard.peakWeek ?? true);
  const [level, setLevel] = useState<CardioLevel>(wizard.level ?? 'intermediate');
  const [equipment, setEquipment] = useState<CardioEquipment[]>(wizard.equipment ?? []);
  const [lowImpact, setLowImpact] = useState(wizard.lowImpact ?? false);
  const [age, setAge] = useState(String(wizard.age ?? profileAge() ?? 30));
  const [sex, setSex] = useState<'male' | 'female'>(wizard.sex ?? profileSex() ?? 'male');
  const [restingHr, setRestingHr] = useState(String(wizard.restingHr ?? profileRestingHr() ?? ''));
  const [variant, setVariant] = useState<CardioVariant>('base');
  const [legDays, setLegDays] = useState<number[]>(wizard.legDays ?? []);
  const [comps, setComps] = useState<CardioCompetitionRef[]>([]);
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

  // Результат и библиотека
  const [cycle, setCycle] = useState<CardioCycle | null>(null);
  const [library, setLibrary] = useState<CardioCycle[]>([]);
  const [link, setLink] = useState(getCardioLink());
  const [macroLink, setMacroLink] = useState<{ kind: 'pl' | 'bb'; cycleId?: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [comparison, setComparison] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<CardioScenario[]>(() => loadCardioScenarios());

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
    const base: CardioCycleInput = {
      goal,
      totalWeeks,
      daysAvailable,
      bodyWeight,
      competitions: comps,
      taperWeeks,
      peakWeek,
      level,
      recoveryLow,
      equipment,
      lowImpact,
      age: Math.max(12, Math.min(90, Number(age) || 30)),
      restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
      sex,
      legDays,
      sleepHours: factorsOn.sleep ? pf.sleepHours : undefined,
      stressLevel: factorsOn.stress ? pf.stressLevel : undefined,
      hrvMs: factorsOn.hrv ? pf.hrvMs : undefined,
      enhanced: factorsOn.ped ? pf.enhanced : undefined,
      autoLowImpact: factorsOn.joints ? true : undefined,
      jointIssues: factorsOn.joints ? pf.jointIssues : undefined,
      phaseSplit: phaseSplit.auto ? undefined : { base: phaseSplit.base, build: phaseSplit.build, maintenance: phaseSplit.maintenance },
    };
    const vOpts = variant === 'gentle'
      ? { level: 'beginner' as CardioLevel, recoveryLow: true }
      : variant === 'intense'
        ? { level: 'advanced' as CardioLevel, recoveryLow: false }
        : { level, recoveryLow };
    const c = buildCardioCycle({ ...base, ...vOpts, config: base });
    saveCardioCycle(c);
    setActiveCardioCycle(c);
    setCycle(c);
    reload();
    flashMsg('✅ Кардио-цикл собран и сохранён в библиотеку');
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
    setStep('params');
    flashMsg('⚙️ Параметры загружены из цикла — измените и пересоберите');
  };

  const migrateFromPlan = () => {
    const plan = buildCardioPlan({ goal: goal === 'mass' ? 'mass' : goal === 'cut' ? 'cut' : goal === 'recovery' ? 'recovery' : 'maintenance' });
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
    removeCardioCycle(c.id);
    if (cycle?.id === c.id) { setActiveCardioCycle(null); setCycle(null); }
    reload();
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
        goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, taperWeeks, peakWeek,
        phaseAuto: phaseSplit.auto, phaseBase: phaseSplit.base, phaseBuild: phaseSplit.build, phaseMaint: phaseSplit.maintenance,
        level, equipment, lowImpact, age: Math.max(12, Math.min(90, Number(age) || 30)), sex, restingHr: Number(restingHr) > 0 ? Number(restingHr) : 0, legDays,
        factorSleep: factorsOn.sleep, factorStress: factorsOn.stress, factorHrv: factorsOn.hrv, factorPed: factorsOn.ped, factorJoints: factorsOn.joints,
      };
      localStorage.setItem(WIZARD_KEY, JSON.stringify({ ...s, version: 2 }));
    } catch { /* ignore */ }
  }, [goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, taperWeeks, peakWeek, phaseSplit, level, equipment, lowImpact, age, sex, restingHr, legDays, factorsOn]);

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
        competitions: comps, taperWeeks, peakWeek, level, equipment, lowImpact,
        age: Math.max(12, Math.min(90, Number(age) || 30)),
        restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
        sex,
        phaseSplit: phaseSplit.auto ? undefined : { base: phaseSplit.base, build: phaseSplit.build, maintenance: phaseSplit.maintenance },
      });
    } catch { return []; }
  }, [step, goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, comps, taperWeeks, peakWeek, level, equipment, lowImpact, age, restingHr, sex, phaseSplit]);

  const planExplanation = useMemo(() => {
    if (!cycle || step !== 'preview') return [];
    return explainCardioChoice({
      goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight,
      competitions: comps, taperWeeks, peakWeek, level, equipment, lowImpact,
      age: Math.max(12, Math.min(90, Number(age) || 30)),
      restingHr: Number(restingHr) > 0 ? Number(restingHr) : undefined,
      sex,
    }, cycle);
  }, [cycle, step, goal, totalWeeks, daysAvailable, recoveryLow, bodyWeight, comps, taperWeeks, peakWeek, level, equipment, lowImpact, age, restingHr, sex]);

  const resetParams = () => {
    setGoal('cut');
    setTotalWeeks(12);
    setDaysAvailable(5);
    setRecoveryLow(false);
    setBodyWeight(profileWeight() ?? 80);
    setPhaseSplit({ auto: true, base: 0, build: 0, maintenance: 0 });
    setTaperWeeks(2);
    setPeakWeek(true);
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
    if (w != null) setBodyWeight(w);
    if (a != null) setAge(String(a));
    if (s != null) setSex(s);
    if (r != null) setRestingHr(String(r));
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
    if (step === 'preview' && !cycle) { build(); return; }
    if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].id);
  };
  const goPrev = () => { if (stepIdx > 0) setStep(STEPS[stepIdx - 1].id); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0, maxWidth: '100%' }}>
      {/* Шапка мастера */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>❤️ Кардио-конструктор</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {autoModeOn && (
            <div style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 16, padding: '3px 10px' }} title="Авто-режим: подстройка по дневнику на шаге «Дневник»">
              🔄 авто-режим
            </div>
          )}
          {nextStartInfo && nextStartInfo.left > 0 && (
            <div style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: '3px 10px' }}>
              🏁 до старта: {nextStartInfo.left} нед
            </div>
          )}
          {todayCardio && todayCardio.sessions.length > 0 && (
            <button
              onClick={() => setStep('diary')}
              title="Перейти к дневнику и быстрому старту"
              style={{ fontSize: 10, color: '#4ade80', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.2)', borderRadius: 16, padding: '3px 10px', cursor: 'pointer' }}
            >
              🔔 Сегодня (нед {todayCardio.week.week}): {todayCardio.sessions.map(s => `${s.type.toUpperCase()} ${s.durationMin} мин${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${s.targetHr?.max ? ' · ЧСС ' + s.targetHr.min + '-' + s.targetHr.max : ''}`).join(' · ')} ▶️
            </button>
          )}
          {cycle && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.25)', borderRadius: 20, padding: '4px 10px' }}>⭐ {cycle.name}</div>}
        </div>
      </div>

      {/* Графа пользователя */}
      <CardioUserCard age={age} sex={sex} weight={bodyWeight} restingHr={restingHr} level={level} onFromProfile={fromProfile} onSaveProfile={saveToProfile} onFromDiaryHr={fromDiaryHr} />

      {/* Степпер */}
      <div style={{ display: 'flex', gap: 4, padding: 6, borderRadius: 12, background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const done = i < stepIdx;
          return (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              style={{
                flex: '1 0 auto', minWidth: 84, padding: '8px 6px', borderRadius: 9, cursor: 'pointer',
                border: active ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                background: active ? 'rgba(0,230,138,0.18)' : done ? 'rgba(0,230,138,0.06)' : 'rgba(255,255,255,0.02)',
                color: active ? '#fff' : 'var(--text-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 15 }}>{done ? '✅' : s.icon}</span>
              <span>{i + 1} {s.label}</span>
            </button>
          );
        })}
      </div>

      {flash && <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.25)', color: '#4ade80', fontSize: 12, fontWeight: 700 }} role="status">{flash}</div>}

      {/* Шаги */}
      {step === 'params' && (
        <CardioParamsStep
          goal={goal} setGoal={setGoal}
          totalWeeks={totalWeeks} setTotalWeeks={setTotalWeeks}
          daysAvailable={daysAvailable} setDaysAvailable={setDaysAvailable}
          recoveryLow={recoveryLow} setRecoveryLow={setRecoveryLow}
          phaseSplit={phaseSplit} setPhaseSplit={setPhaseSplit}
          comps={comps}
          bodyWeight={bodyWeight} setBodyWeight={setBodyWeight}
          taperWeeks={taperWeeks} peakWeek={peakWeek}
          level={level} setLevel={setLevel}
          equipment={equipment} setEquipment={setEquipment}
          lowImpact={lowImpact} setLowImpact={setLowImpact}
          age={age} setAge={setAge}
          sex={sex} setSex={setSex}
          restingHr={restingHr} setRestingHr={setRestingHr}
          legDays={legDays} setLegDays={setLegDays}
          factorsOn={factorsOn} onToggleFactor={onToggleFactor}
          factorsSummary={factorsSummary}
          onReset={resetParams}
        />
      )}
      {step === 'comps' && (
        <CardioCompsStep comps={comps} setComps={setComps} draft={compDraft} setDraft={setCompDraft} totalWeeks={totalWeeks}
          taperWeeks={taperWeeks} setTaperWeeks={setTaperWeeks} peakWeek={peakWeek} setPeakWeek={setPeakWeek} />
      )}
      {step === 'preview' && (
        <>
          <CardioPreviewStep
            cycle={cycle} onBuild={build} onRename={renameCycle} onEditConfig={editConfig}
            daysAvailable={daysAvailable} recoveryLow={recoveryLow}
            variant={variant} onVariant={setVariant}
            variants={planVariants} explanation={planExplanation}
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
          onLinkTo={linkTo} onUnlink={unlink} onAttachMacro={attachMacro} onDetachMacro={detachMacro}
          onExport={downloadIcs} onPrint={printCycle} onDuplicate={duplicate} onActivate={activate}
          onCompare={compareWith} onRemove={removeCycle} onChanged={refreshActive}
          onSaveScenario={saveScenario} onLoadScenario={loadScenario} onRemoveScenario={deleteScenario}
        />
      )}
      {step === 'diary' && (
        <CardioDiaryStep cycle={cycle} acwr={acwrValue} recoveryLow={recoveryLow} onChanged={refreshActive} onApplyWeightAdjust={applyWeightAdjust} />
      )}

      {/* Навигация */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button style={NAV_BTN} onClick={goPrev} disabled={stepIdx === 0} aria-label="Назад">← Назад</button>
        {stepIdx < STEPS.length - 1 && (
          <button style={NAV_BTN_PRIMARY} onClick={goNext} aria-label="Далее">
            {step === 'preview' && !cycle ? '🛠 Собрать и далее →' : 'Далее →'}
          </button>
        )}
      </div>
    </div>
  );
};
