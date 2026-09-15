/**
 * ArmliftingDiagnosticsHub.tsx — отдельный хаб армлифтинга (PRO-3 W-AL + PRO-4).
 * Раньше снаряды жили гостем в табе «Хват» арм-хаба — теперь свой дом:
 * замеры → %WR/вердикт → попытки → мост в Арм-конструктор (дисциплина «Армлифтинг»).
 * Старый хаб не тронут. Тот же визуальный язык (.ad-*, arm-design.css).
 * PRO-4: pinch кг+сек, Silver Bullet, L/R, новые снаряды, классы, чек-лист правил,
 * last-man-standing, тренд, рецепт.
 */
import React, { useMemo, useState } from 'react';
import {
  buildArmliftingReport,
  liftTrendFromLog,
  prescriptionForWeakest,
} from '../../../engines/arm/armlifting-diagnostics.engine';
import { buildArmliftingHtml, buildArmliftingCsv } from '../../../engines/arm/armlifting-diagnostics.engine';
import { downloadArmFile } from '../../../engines/arm/arm-diagnostics-export.engine';
import { loadPlatformLog } from '../../../engines/arm/arm-platform.engine';
import { failuresFor, faultsFor, movementFor, relevantTestsFor, diagImplementForReportWeakest, ARMLIFT_DIAG_IMPLEMENT_OPTS } from '../../../engines/arm/armlift-failure-modes.engine';
import { diagnoseArmlift } from '../../../engines/arm/armlift-diagnosis.engine';
import { diagnoseArmliftCause, countGripSessions, flexExtRatio } from '../../../engines/arm/armlift-cause.engine';
import { benchmarkPinchHold, benchmarkFarmerHold, benchmarkCoc, benchmarkSilverHold, overallGripLevel, ARMLIFT_LEVEL_RU } from '../../../engines/arm/armlift-benchmarks.engine';
import { saveDiagSnapshot, lastSnapshotFor, retestVerdict, weeksBetween, loadDiagHistory, clearDiagHistory } from '../../../engines/arm/armlift-history.engine';
import { assessArmliftMobility } from '../../../engines/arm/armlift-mobility.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { toDailyLoads, acuteChronicRatio } from '../../../engines/pro/training-load.engine';
import { rankArmliftCorrections, buildArmliftSpecBlock } from '../../../engines/arm/armlift-correction.engine';
import { correctionsToInjectionItems, intensityForCause } from '../../../engines/arm/armlift-injection.engine';
import { applyToPlanner } from './planner-bridge';
import { AdRoot, AdCard, AdSec, AdGrid, AdChip, AdBtn, AdBanner, AdCta, AdStat } from './arm-design-system';
import { haptics } from '../../../core/native-bridge';

/** PRO-визуал: уровень → цвет точки (строки/aria 1-в-1, только подача). */
const LIFT_LEVEL_COLOR: Record<string, string> = {
  elite: '#22c55e',
  comp: '#38bdf8',
  base: '#f59e0b',
  none: '#94a3b8',
};
const liftLevelColor = (level: string): string => LIFT_LEVEL_COLOR[level] ?? '#f59e0b';

/** PRO-визуал: карточка числового замера 48px (HubNum-стиль).
 *  Контракты 1-в-1: input с тем же aria-label/inputMode/placeholder/value/onChange. */
function LiftNum({ label, value, onChange, placeholder, aria }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; aria: string;
}) {
  return (
    <div className="lift-num">
      <span className="ad-fl">{label}</span>
      <div className="lift-num-row">
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={aria} />
        {value ? (
          <button type="button" className="lift-num-clear" aria-label="Очистить" title={`Очистить ${aria}`} onClick={() => onChange('')}>✕</button>
        ) : null}
      </div>
    </div>
  );
}

const STORAGE_KEY = 'he_armlifting_diag_v1';
/** PRO-5: диагностика движений — отдельный ключ, замеры не трогаем. */
const DIAG_KEY = 'he_armlifting_diag2_v1';
type DiagTab = 'pomost' | 'diag' | 'corr';
type DiagState = {
  implement: string; failurePoint: string; faultIds: string[];
  pinchHoldSec: string; farmerHoldSec: string; wristExtWeak: boolean;
  flexHoldSec: string; extHoldSec: string;
  thumbStiff: boolean; wristExtLimited: boolean; wristFlexLimited: boolean;
  wristExtDeg: string; wristFlexDeg: string; thumbOppOk: boolean;
  hipHingePoor: boolean; pain: boolean; elbowPain: boolean;
  skinTear: boolean; thumbWebPain: boolean;
  specWeeks: 4 | 6;
};
const DEFAULT_DIAG: DiagState = {
  implement: 'rolling_thunder', failurePoint: '', faultIds: [],
  pinchHoldSec: '', farmerHoldSec: '', wristExtWeak: false,
  flexHoldSec: '', extHoldSec: '',
  thumbStiff: false, wristExtLimited: false, wristFlexLimited: false,
  wristExtDeg: '', wristFlexDeg: '', thumbOppOk: true,
  hipHingePoor: false, pain: false, elbowPain: false,
  skinTear: false, thumbWebPain: false,
  specWeeks: 4,
};
function loadDiag(): DiagState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DIAG_KEY) : null;
    const j = raw ? JSON.parse(raw) : {};
    if (!j || typeof j !== 'object') return DEFAULT_DIAG;
    return {
      ...DEFAULT_DIAG, ...j,
      faultIds: Array.isArray((j as any).faultIds) ? (j as any).faultIds.filter((x: any) => typeof x === 'string') : [],
      specWeeks: (j as any).specWeeks === 6 ? 6 : 4,
    };
  } catch { return DEFAULT_DIAG; }
}

type LiftState = {
  rtKg: string; rtL: string; rtR: string;
  axleKg: string; axleImpl: string;
  pinchSec: string; pinchKg: string; pinchL: string; pinchR: string;
  cocLevel: string; silverSec: string; silverGripper: string;
  excalKg: string; hubKg: string; hubL: string; hubR: string;
  raptorKg: string; crushKg: string; clockKg: string; anvilKg: string; medleyKg: string;
  sex: string; bwKg: string;
};

const DEFAULT_STATE: LiftState = {
  rtKg: '', rtL: '', rtR: '', axleKg: '', axleImpl: 'saxon',
  pinchSec: '', pinchKg: '', pinchL: '', pinchR: '', cocLevel: '', silverSec: '', silverGripper: '3',
  excalKg: '', hubKg: '', hubL: '', hubR: '',
  raptorKg: '', crushKg: '', clockKg: '', anvilKg: '', medleyKg: '',
  sex: 'male', bwKg: '80',
};

/** PRO-3 W6: сид из арм-хаба — замеры не дублируются вручную.
 *  Односторонний (сюда, не обратно — петель нет): только если своего ключа ещё нет. */
const ARM_HUB_KEY = 'he_arm_diagnostics_hub_v4';

function loadState(): LiftState {
  const pick = (j: any, k: string, fb: string): string =>
    j && typeof j[k] === 'string' ? (j as any)[k] : fb;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw == null) {
      try {
        const arm = typeof localStorage !== 'undefined' ? localStorage.getItem(ARM_HUB_KEY) : null;
        const a = arm ? JSON.parse(arm) : null;
        if (a && typeof a === 'object') {
          const g = (k: string): string => (typeof (a as any)[k] === 'string' ? (a as any)[k] : '');
          const seeded: LiftState = {
            ...DEFAULT_STATE,
            rtKg: g('rtKg'), axleKg: g('axleKg'),
            axleImpl: g('axleImpl') === 'apollon' ? 'apollon' : 'saxon',
            pinchSec: g('pinchSec'), excalKg: g('excalKg'),
            sex: g('sex') === 'female' ? 'female' : 'male',
            bwKg: g('bwKg') || '80',
          };
          if (seeded.rtKg || seeded.axleKg || seeded.pinchSec || seeded.excalKg) return seeded;
        }
      } catch { /* noop → дефолт ниже */ }
    }
    const j = raw ? JSON.parse(raw) : {};
    if (!j || typeof j !== 'object') return DEFAULT_STATE;
    return {
      ...DEFAULT_STATE,
      rtKg: pick(j, 'rtKg', ''), rtL: pick(j, 'rtL', ''), rtR: pick(j, 'rtR', ''),
      axleKg: pick(j, 'axleKg', ''), axleImpl: pick(j, 'axleImpl', 'saxon') === 'apollon' ? 'apollon' : 'saxon',
      pinchSec: pick(j, 'pinchSec', ''), pinchKg: pick(j, 'pinchKg', ''),
      pinchL: pick(j, 'pinchL', ''), pinchR: pick(j, 'pinchR', ''),
      cocLevel: pick(j, 'cocLevel', ''), silverSec: pick(j, 'silverSec', ''),
      silverGripper: ['2', '3', '4'].includes(pick(j, 'silverGripper', '3')) ? pick(j, 'silverGripper', '3') : '3',
      excalKg: pick(j, 'excalKg', ''), hubKg: pick(j, 'hubKg', ''),
      hubL: pick(j, 'hubL', ''), hubR: pick(j, 'hubR', ''),
      raptorKg: pick(j, 'raptorKg', ''), crushKg: pick(j, 'crushKg', ''),
      clockKg: pick(j, 'clockKg', ''), anvilKg: pick(j, 'anvilKg', ''), medleyKg: pick(j, 'medleyKg', ''),
      sex: pick(j, 'sex', 'male') === 'female' ? 'female' : 'male',
      bwKg: pick(j, 'bwKg', '80'),
    };
  } catch {
    return DEFAULT_STATE;
  }
}

const f = (s: string): number | undefined => {
  const v = parseFloat(s);
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

export const ArmliftingDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<LiftState>(loadState);
  const [toast, setToast] = useState('');
  const [histTick, setHistTick] = useState(0);
  /** PRO-5 D7: 3 таба — Замеры + Диагностика движений + Коррекция. Соревы удалены из хаба. */
  const [tab, setTab] = useState<DiagTab>('pomost');
  const [diag, setDiag] = useState<DiagState>(loadDiag);
  const saveDiag = (d: DiagState) => {
    setDiag(d);
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(DIAG_KEY, JSON.stringify(d)); } catch { /* noop */ }
  };
  const setD = (patch: Partial<DiagState>) => saveDiag({ ...diag, ...patch });
  const toggleFault = (id: string) => {
    const has = diag.faultIds.includes(id);
    setD({ faultIds: has ? diag.faultIds.filter((x) => x !== id) : [...diag.faultIds, id] });
  };

  const save = (s: LiftState) => {
    setState(s);
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* noop */ }
  };
  const set = (patch: Partial<LiftState>) => save({ ...state, ...patch });

  const report = useMemo(() => buildArmliftingReport({
    rtKg: f(state.rtKg),
    rtL: f(state.rtL), rtR: f(state.rtR),
    axleKg: f(state.axleKg),
    axleImpl: state.axleImpl,
    pinchSec: f(state.pinchSec),
    pinchKg: f(state.pinchKg),
    pinchL: f(state.pinchL), pinchR: f(state.pinchR),
    cocLevel: state.cocLevel ? parseFloat(state.cocLevel) : undefined,
    silverSec: f(state.silverSec),
    silverGripper: state.silverGripper,
    excalKg: f(state.excalKg),
    hubKg: f(state.hubKg),
    hubL: f(state.hubL), hubR: f(state.hubR),
    raptorKg: f(state.raptorKg), crushKg: f(state.crushKg),
    clockKg: f(state.clockKg), anvilKg: f(state.anvilKg), saxonMedleyKg: f(state.medleyKg),
    sex: state.sex,
  }), [state.rtKg, state.rtL, state.rtR, state.axleKg, state.axleImpl, state.pinchSec, state.pinchKg, state.pinchL, state.pinchR, state.cocLevel, state.silverSec, state.silverGripper, state.excalKg, state.hubKg, state.hubL, state.hubR, state.raptorKg, state.crushKg, state.clockKg, state.anvilKg, state.medleyKg, state.sex]);

  const trend = useMemo(() => {
    try { return liftTrendFromLog(loadPlatformLog()); } catch { return []; }
  }, []);

  const prescription = report.prescription || prescriptionForWeakest(report.weakestWr || report.weakest);

  /** PRO-5: диагноз из замеров (макс. асимметрия RT/Hub/Pinch) + ручной диагностики. */
  const asymForDiag = (() => {
    const all = [report.rtAsymPct, report.hubAsymPct, report.pinchAsymPct].filter((v): v is number => v != null);
    return all.length ? Math.max(...all) : null;
  })();
  const diagnosis = useMemo(() => diagnoseArmlift({
    implement: diag.implement,
    failurePoint: diag.failurePoint || undefined,
    faultIds: diag.faultIds,
    pinchHoldSec: diag.pinchHoldSec ? parseFloat(diag.pinchHoldSec) : null,
    farmerHoldSec: diag.farmerHoldSec ? parseFloat(diag.farmerHoldSec) : null,
    wristExtWeak: diag.wristExtWeak,
    asymmetryPct: asymForDiag,
    thumbStiff: diag.thumbStiff,
    wristExtLimited: diag.wristExtLimited,
    wristFlexLimited: diag.wristFlexLimited,
    hipHingePoor: diag.hipHingePoor,
    pain: diag.pain,
  }), [diag, asymForDiag]);
  /** PRO-5 real: архив журнала (только чтение; пустой журнал — null, без ложных флагов объёма). */
  const logStats = useMemo(() => {
    let sessions28d: number | null = null;
    try {
      const log = loadPlatformLog();
      sessions28d = log.length ? countGripSessions(log, diag.implement) : null;
    } catch { sessions28d = null; }
    const tr = trend.find((t) => t.implement === diag.implement)
      || trend.find((t) => t.implement === `${diag.implement}_L`)
      || trend.find((t) => t.implement === `${diag.implement}_R`)
      || null;
    return {
      sessions28d,
      trendDeltaPct: tr ? tr.deltaPct : null,
      gripFreqPerWeek: sessions28d != null ? Math.round((sessions28d / 4) * 10) / 10 : null,
    };
  }, [trend, diag.implement]);
  /** D14: системная нагрузка из sRPE (пусто — null, без ложных флагов). */
  const acwr = useMemo(() => {
    try {
      const sess = loadSRPESessions();
      if (!sess.length) return null;
      return acuteChronicRatio(toDailyLoads(sess as any));
    } catch { return null; }
  }, []);
  /** D13: измеренная мобильность — до причины (TDZ-порядок). */
  const mobility = useMemo(() => assessArmliftMobility({
    wristExtDeg: diag.wristExtDeg ? parseFloat(diag.wristExtDeg) : null,
    wristFlexDeg: diag.wristFlexDeg ? parseFloat(diag.wristFlexDeg) : null,
    thumbOppOk: diag.thumbOppOk,
  }), [diag.wristExtDeg, diag.wristFlexDeg, diag.thumbOppOk]);
  /** PRO-5 real: причина со скорингом и evidence (свой движок, не стол). */
  const cause = useMemo(() => diagnoseArmliftCause({
    implement: diag.implement,
    failurePoint: diag.failurePoint || undefined,
    faultIds: diag.faultIds,
    pinchHoldSec: diag.pinchHoldSec ? parseFloat(diag.pinchHoldSec) : null,
    farmerHoldSec: diag.farmerHoldSec ? parseFloat(diag.farmerHoldSec) : null,
    wristExtWeak: diag.wristExtWeak,
    cocLevel: state.cocLevel ? parseFloat(state.cocLevel) : null,
    silverSec: state.silverSec ? parseFloat(state.silverSec) : null,
    gripSessions28d: logStats.sessions28d,
    trendDeltaPct: logStats.trendDeltaPct,
    asymmetryPct: asymForDiag,
    thumbStiff: diag.thumbStiff,
    wristExtLimited: diag.wristExtLimited,
    wristFlexLimited: diag.wristFlexLimited,
    hipHingePoor: diag.hipHingePoor,
    gripFreqPerWeek: logStats.gripFreqPerWeek,
    flexHoldSec: diag.flexHoldSec ? parseFloat(diag.flexHoldSec) : null,
    extHoldSec: diag.extHoldSec ? parseFloat(diag.extHoldSec) : null,
    mobilityFails: mobility.fails,
    acwrZone: acwr?.zone ?? null,
    elbowPain: diag.elbowPain,
    pain: diag.pain,
    skinTear: diag.skinTear,
    thumbWebPain: diag.thumbWebPain,
  }), [diag, asymForDiag, logStats, acwr, state.cocLevel, state.silverSec]);
  const extRatio = flexExtRatio(
    diag.flexHoldSec ? parseFloat(diag.flexHoldSec) : null,
    diag.extHoldSec ? parseFloat(diag.extHoldSec) : null,
  );
  const corrections = useMemo(() => rankArmliftCorrections(diagnosis.weakLink, diag.implement, {
    cause: cause.cause === 'pain' ? undefined : cause.cause,
    asymPct: asymForDiag,
    failurePoint: diag.failurePoint || undefined,
    extImbalance: extRatio != null && extRatio > 1.5,
    cocLevel: state.cocLevel ? parseFloat(state.cocLevel) : null,
  }), [diagnosis.weakLink, diag.implement, cause.cause, asymForDiag, diag.failurePoint, extRatio, state.cocLevel]);
  const specBlock = useMemo(
    () => buildArmliftSpecBlock(diagnosis.weakLink, diag.implement, corrections, diag.specWeeks),
    [diagnosis.weakLink, diag.implement, corrections, diag.specWeeks],
  );
  /** D10 E1: уровни тестов + итог по слабейшему. */
  const levels = useMemo(() => {
    const pinch = benchmarkPinchHold(diag.pinchHoldSec ? parseFloat(diag.pinchHoldSec) : null);
    const farmer = benchmarkFarmerHold(diag.farmerHoldSec ? parseFloat(diag.farmerHoldSec) : null);
    const coc = benchmarkCoc(state.cocLevel ? parseFloat(state.cocLevel) : null);
    const silver = benchmarkSilverHold(state.silverSec ? parseFloat(state.silverSec) : null);
    return { pinch, farmer, coc, silver, overall: overallGripLevel([pinch, farmer, coc, silver]) };
  }, [diag.pinchHoldSec, diag.farmerHoldSec, state.cocLevel, state.silverSec]);
  /** D15: история диагнозов списком (обновляется после моста). */
  const diagHistory = useMemo(() => {
    try { return loadDiagHistory(); } catch { return []; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histTick]);
  /** D11 E4 / D12 E7: перетест против прошлого снапшота + история. */
  const retests = useMemo(() => {
    const prev = lastSnapshotFor(diag.implement);
    if (!prev) return { prev: null as null | { date: string }, list: [] as Array<{ test: string; text: string }>, due: null as string | null };
    const weeks = weeksBetween(prev.date, new Date().toISOString().slice(0, 10));
    const num = (s: string): number | null => {
      const v = parseFloat(s);
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    const pairs: Array<[string, number | null | undefined, number | null]> = [
      ['Pinch', prev.pinchHoldSec, num(diag.pinchHoldSec)],
      ['Farmer', prev.farmerHoldSec, num(diag.farmerHoldSec)],
      ['CoC', prev.cocLevel, num(state.cocLevel)],
      ['Silver', prev.silverSec, num(state.silverSec)],
    ];
    const list = pairs
      .filter(([, p, c]) => p != null && c != null)
      .map(([t, p, c]) => ({ test: t, text: `${t}: ${retestVerdict(p, c, weeks).text}` }));
    return {
      prev: { date: prev.date },
      list,
      due: list.length === 0 && weeks >= 4 ? `Прошло ${weeks} нед с замера ${prev.date} — пора перетест` : null,
    };
  }, [diag.implement, diag.pinchHoldSec, diag.farmerHoldSec, state.cocLevel, state.silverSec]);
  const diagFaults = useMemo(() => faultsFor(diag.implement), [diag.implement]);
  const diagFailures = useMemo(() => failuresFor(diag.implement), [diag.implement]);
  const moveChain = useMemo(() => movementFor(diag.implement), [diag.implement]);

  const applyToConstructor = () => {
    if (!report.filled) {
      setToast('Нечего отправлять — введи хотя бы один снаряд');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    try { void haptics('light'); } catch { /* noop */ }
    const bw = parseFloat(state.bwKg);
    const rtBest = f(state.rtL) ?? f(state.rtR) ?? f(state.rtKg);
    const hubBest = f(state.hubL) ?? f(state.hubR) ?? f(state.hubKg);
    applyToPlanner({
      kind: 'weakpoints',
      label: `Армлифтинг-диагностика: ${report.verdict}`,
      data: {
        groups: [],
        armDiscipline: 'armlifting',
        armLiftingVerdict: report.verdict,
        armLifting: {
          weakest: report.weakest, weakestWr: report.weakestWr,
          avgPct: report.avgPct, avgWrPct: report.avgWrPct, avgInternalPct: report.avgInternalPct,
          totalKg: report.totalKg,
          prescription,
          rows: report.rows.map((r) => ({ implement: r.implement, display: r.display, scorePct: r.scorePct, level: r.level, internal: r.internal })),
          /** PRO-5: диагноз движений + коррекция (аддитивно, старые поля целы). */
          diagWeakLink: diagnosis.weakLink,
          diagCause: diagnosis.cause,
          diagConfidence: diagnosis.confidence,
          diagImplement: diag.implement,
          diagFailurePoint: diag.failurePoint || undefined,
          diagFaultIds: diag.faultIds,
          diagCues: diagnosis.cues,
          diagCorrections: corrections.map((c) => ({ id: c.id, title: c.title, protocol: c.protocol })),
          diagSpecBlock: specBlock,
          /** PRO-5 real: упражнения в план — только armlifting-ветка конструктора читает. */
          diagCauseDetail: { cause: cause.cause, confidence: cause.confidence, evidence: cause.evidence, fix: cause.fix },
          armliftExercises: correctionsToInjectionItems(corrections, 3, intensityForCause(cause.cause)),
          armliftSpec: specBlock.map((w) => ({ week: w.week, targetSets: w.targetSets, dayMap: w.dayMap })),
          armliftWeakArmNote: asymForDiag != null && asymForDiag > 15 ? 'слабой рукой первой' : undefined,
        },
        armProfile: {
          ...(Number.isFinite(bw) && bw > 0 ? { bwKg: bw } : {}),
          ...(rtBest != null ? { rtKg: rtBest } : {}),
          ...(f(state.pinchKg) != null ? { pinchKg: f(state.pinchKg) as number } : {}),
          ...(hubBest != null ? { hubKg: hubBest } : {}),
        },
      },
      source: 'intellectual',
    });
    try {
      saveDiagSnapshot({
        date: new Date().toISOString().slice(0, 10),
        implement: diag.implement,
        weakLink: diagnosis.weakLink,
        cause: cause.cause,
        pinchHoldSec: diag.pinchHoldSec ? parseFloat(diag.pinchHoldSec) : null,
        farmerHoldSec: diag.farmerHoldSec ? parseFloat(diag.farmerHoldSec) : null,
        cocLevel: state.cocLevel ? parseFloat(state.cocLevel) : null,
        silverSec: state.silverSec ? parseFloat(state.silverSec) : null,
      });
    } catch { /* noop */ }
    setHistTick((x) => x + 1);
    setToast(`✓ В Арм-конструктор (армлифтинг): ${report.verdict}`);
    setTimeout(() => setToast(''), 3000);
    try {
      window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'arm' } as any));
      localStorage.setItem('he_training_planning_track', 'arm');
    } catch { /* noop */ }
  };

  const exportData = () => ({
    date: new Date().toISOString().slice(0, 10),
    sex: state.sex === 'female' ? 'Ж' : 'М',
    report,
    /** PRO-5 добивка: диагноз + коррекция в экспорт (аддитивно). */
    diagTitle: `${diagnosis.title} · ${diagnosis.cause}/${diagnosis.confidence}`,
    diagCorrections: corrections.map((c) => `${c.title} — ${c.protocol}`),
    diagSpec: specBlock.map((w) => `Нед ${w.week}: ${w.focus}`),
  });

  const handleExportHtml = () => {
    try {
      downloadArmFile(`armlifting-${new Date().toISOString().slice(0, 10)}.html`, buildArmliftingHtml(exportData()), 'text/html');
      setToast('✓ HTML экспорт вердикта');
      setTimeout(() => setToast(''), 2500);
    } catch { /* noop */ }
  };

  const handleExportCsv = () => {
    try {
      downloadArmFile(`armlifting-${new Date().toISOString().slice(0, 10)}.csv`, buildArmliftingCsv(exportData()), 'text/csv');
      setToast('✓ CSV экспорт вердикта');
      setTimeout(() => setToast(''), 2500);
    } catch { /* noop */ }
  };

  const handlePrint = () => {
    try {
      const w = window.open('', '_blank');
      if (!w) {
        setToast('⚠ Всплывающие окна заблокированы — используй 🖨 HTML');
        setTimeout(() => setToast(''), 2500);
        return;
      }
      w.document.write(buildArmliftingHtml(exportData()));
      w.document.close();
      w.focus();
      w.print();
    } catch { /* noop */ }
  };

  const avgShown = report.avgWrPct != null
    ? report.avgWrPct
    : report.avgPct != null ? report.avgPct : null;
  const weakestLabel = report.rows.find((r) => r.implement === (report.weakestWr || report.weakest))?.label
    || report.weakestWr || report.weakest || '—';

  return (
    <AdRoot rootClass="train-armdiag" maxWidth={860}>
      <style>{`
        .train-armdiag [data-arm="lift-head"] { padding: 10px 12px; }
        .train-armdiag [data-arm="lift-head"] .ad-head { gap: 8px; }
        .train-armdiag [data-arm="lift-head"] .ad-head-tx { min-width: 0; }
        .train-armdiag .ad-card { padding: 12px; margin: 0 0 8px; }
        .train-armdiag .ad-sec { padding: 10px; margin-top: 8px; }
        .train-armdiag .ad-sec-t { margin: 0 0 6px; }
        .train-armdiag .ad-grid { gap: 8px; }
        .train-armdiag .ad-row { gap: 6px; }
        .train-armdiag .ad-muted { color: #fff; }
        .train-armdiag .ad-sec-sum { color: #fff; }
        .train-armdiag .ad-fl { color: #fff; }
        .train-armdiag [data-arm="lift-tiles"] { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 6px; margin: 8px 0; }
        .train-armdiag [data-arm="lift-tiles"] .ad-stat { border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 8px 6px; text-align: center; }
        .train-armdiag [data-arm="lift-tiles"] .ad-stat-v { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; color: #fff; }
        .train-armdiag [data-arm="lift-tiles"] .ad-stat-l { font-size: 10px; font-weight: 700; color: #fff; }
        .train-armdiag [data-arm="lift-table"] .ad-row { align-items: center; }
        .train-armdiag .lift-bar { height: 6px; border-radius: 4px; background: rgba(255,255,255,0.12); overflow: hidden; min-width: 64px; flex: 1 1 64px; }
        .train-armdiag .lift-bar > span { display: block; height: 100%; border-radius: 4px; }
        .train-armdiag .lift-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .train-armdiag .lift-row-main { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 2 1 160px; }
        .train-armdiag .lift-row-meta { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .train-armdiag .lift-num { display: flex; flex-direction: column; gap: 6px; min-width: 0; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 8px; background: rgba(255,255,255,0.03); }
        .train-armdiag .lift-num-row { display: flex; gap: 6px; align-items: center; }
        .train-armdiag .lift-num input { flex: 1 1 auto; min-width: 0; min-height: 48px; font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; color: #fff; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; padding: 0 10px; }
        .train-armdiag .lift-num input::placeholder { color: rgba(255,255,255,0.75); }
        .train-armdiag .lift-num-clear { min-width: 44px; min-height: 44px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; font-size: 14px; }
        .train-armdiag .lift-group { font-size: 11px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; color: #fff; margin: 8px 0 0; }
        .train-armdiag [id="lift-measures"], .train-armdiag [id="lift-verdict-sec"], .train-armdiag [id="lift-bridge"] { scroll-margin-top: 70px; }
        .train-armdiag [data-arm="lift-export"] .ad-btn { min-height: 48px; font-weight: 700; }
      `}</style>
      <AdCard>
        <div className="ad-head" data-arm="lift-head">
          <div className="ad-head-ic" aria-hidden>🏋️</div>
          <div className="ad-head-tx">
            <h2 className="ad-head-title">Армлифтинг — диагностика</h2>
            <p className="ad-head-sub">RT · Axle · Pinch · CoC · Hub · Excalibur · %WR · движения · коррекция</p>
          </div>
          <div className="ad-head-side">
            <div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>
              {report.filled ? `${report.filled} сн.` : '—'}
              {avgShown != null ? ` · ${avgShown}%` : ''}
            </div>
            <div className="ad-muted">слабейший: {report.filled ? weakestLabel : 'введи замеры'}</div>
          </div>
        </div>
        <div className="ad-row" data-arm="lift-tags">
          {report.rtAsymPct != null && <span className="ad-tag">RT-асимметрия {report.rtAsymPct}%</span>}
          {report.hubAsymPct != null && <span className="ad-tag">Hub-асимметрия {report.hubAsymPct}%</span>}
          {report.pinchAsymPct != null && <span className="ad-tag">Pinch-асимметрия {report.pinchAsymPct}%</span>}
        </div>
        <AdSec title="ℹ️ Как пользоваться" collapsible defaultOpen={false} summary="3 шага до коррекции">
          <div className="ad-muted"><b>1 Замеры</b> — вбей снаряды ниже · <b>2 Диагностика</b> — точка срыва, фолы, тесты, причина · <b>3 Коррекция</b> — упражнения волной в план через мост внизу.</div>
        </AdSec>
        {toast && <AdBanner tone="ok">{toast}</AdBanner>}
      </AdCard>

      <div className="ad-row" data-arm="lift-tabs" aria-label="Режим хаба">
        {([['pomost', '📏 Замеры'], ['diag', '🔍 Диагностика'], ['corr', '🔧 Коррекция']] as Array<[DiagTab, string]>).map(([id, label]) => (
          <AdChip key={id} active={tab === id} onClick={() => setTab(id)}>{label}</AdChip>
        ))}
      </div>
      <div className="ad-muted">📏 Замеры — вход диагностики (%WR, слабейший). 🔍 Диагностика — точка срыва + фолы + тесты + причина. 🔧 Коррекция — упражнения + спец-блок волной.</div>
      {tab === 'pomost' && (<>
      <AdCard>
        <div id="lift-measures" />
        <AdSec title="🏋️ Армлифтинг — замеры снарядов" defaultOpen summary="RT · Axle · Pinch · CoC · Hub · Excalibur">
          <div className="lift-group">✊ Основные</div>
          <AdGrid cols="auto-sm">
            <LiftNum label="RT кг" value={state.rtKg} onChange={(v) => set({ rtKg: v })} placeholder="60" aria="RT кг" />
            <LiftNum label="Axle кг" value={state.axleKg} onChange={(v) => set({ axleKg: v })} placeholder="100" aria="Axle кг" />
            <LiftNum label="Pinch кг" value={state.pinchKg} onChange={(v) => set({ pinchKg: v })} placeholder="макс кг" aria="Pinch кг" />
            <LiftNum label="Pinch сек" value={state.pinchSec} onChange={(v) => set({ pinchSec: v })} placeholder="15" aria="Pinch сек" />
            <LiftNum label="CoC уровень" value={state.cocLevel} onChange={(v) => set({ cocLevel: v })} placeholder="1.5" aria="CoC уровень" />
            <LiftNum label="Silver сек" value={state.silverSec} onChange={(v) => set({ silverSec: v })} placeholder="время" aria="Silver сек" />
            <LiftNum label="Hub кг" value={state.hubKg} onChange={(v) => set({ hubKg: v })} placeholder="30" aria="Hub кг" />
            <LiftNum label="Excalibur кг" value={state.excalKg} onChange={(v) => set({ excalKg: v })} placeholder="40" aria="Excalibur кг" />
          </AdGrid>
          <div className="lift-group">↔️ Асимметрия L/R</div>
          <AdGrid cols="auto-sm">
            <LiftNum label="RT левая кг" value={state.rtL} onChange={(v) => set({ rtL: v })} placeholder="L" aria="RT левая кг" />
            <LiftNum label="RT правая кг" value={state.rtR} onChange={(v) => set({ rtR: v })} placeholder="R" aria="RT правая кг" />
            <LiftNum label="Hub левая кг" value={state.hubL} onChange={(v) => set({ hubL: v })} placeholder="L" aria="Hub левая кг" />
            <LiftNum label="Hub правая кг" value={state.hubR} onChange={(v) => set({ hubR: v })} placeholder="R" aria="Hub правая кг" />
            <LiftNum label="Pinch левая кг" value={state.pinchL} onChange={(v) => set({ pinchL: v })} placeholder="L" aria="Pinch левая кг" />
            <LiftNum label="Pinch правая кг" value={state.pinchR} onChange={(v) => set({ pinchR: v })} placeholder="R" aria="Pinch правая кг" />
          </AdGrid>
          <div className="lift-group">⚖️ Вес тела (едет в конструктор)</div>
          <AdGrid cols="auto-sm">
            <LiftNum label="Вес тела кг" value={state.bwKg} onChange={(v) => set({ bwKg: v })} placeholder="80" aria="Вес тела кг" />
          </AdGrid>
          <div className="ad-row">
            <AdChip active={state.axleImpl !== 'apollon'} onClick={() => set({ axleImpl: 'saxon' })}>Saxon (ориентир)</AdChip>
            <AdChip active={state.axleImpl === 'apollon'} onClick={() => set({ axleImpl: 'apollon' })}>Apollon (WR)</AdChip>
            <AdChip active={state.sex !== 'female'} onClick={() => set({ sex: 'male' })}>М</AdChip>
            <AdChip active={state.sex === 'female'} onClick={() => set({ sex: 'female' })}>Ж</AdChip>
            {['2', '3', '4'].map((g) => (
              <AdChip key={g} active={state.silverGripper === g} onClick={() => set({ silverGripper: g })}>Silver №{g}</AdChip>
            ))}
          </div>
          <div className="ad-muted">CoC — ordinal (№1≈140 … №3≈280 фунтов, не калибровка) · Excalibur — факт без % (SAR по весовой) · Saxon — внутренний ориентир (лидерборд) · Apollon WR М237.5/Ж137.9 · Hub WR М44.8/Ж28.51</div>
          <div className="ad-muted">Замеры подтягиваются из арм-хаба при первом входе (свой ввод приоритетнее, обратно не пишем)</div>
        </AdSec>
      </AdCard>

      <AdCard>
        <AdSec title="🧲 Новые снаряды 2025–2026" collapsible defaultOpen={false} summary="Raptor · Crush · Clock · Anvil · Medley">
          <AdGrid cols="auto-sm">
            <LiftNum label="Raptor 1.75 кг" value={state.raptorKg} onChange={(v) => set({ raptorKg: v })} placeholder="факт" aria="Raptor кг" />
            <LiftNum label="Country Crush кг" value={state.crushKg} onChange={(v) => set({ crushKg: v })} placeholder="факт" aria="Country Crush кг" />
            <LiftNum label="Clock кг" value={state.clockKg} onChange={(v) => set({ clockKg: v })} placeholder="факт" aria="Grandfather Clock кг" />
            <LiftNum label="Anvil кг" value={state.anvilKg} onChange={(v) => set({ anvilKg: v })} placeholder="факт" aria="Anvil кг" />
            <LiftNum label="Saxon medley кг" value={state.medleyKg} onChange={(v) => set({ medleyKg: v })} placeholder="факт" aria="Saxon medley кг" />
          </AdGrid>
          <div className="ad-muted">Факт без %: разрядных таблиц нет, только живые лидерборды Armlifting USA</div>
        </AdSec>
      </AdCard>

      <AdCard>
        <div id="lift-verdict-sec" />
        <AdSec title="📊 Вердикт по снарядам" defaultOpen summary={report.filled ? `${report.filled} сн.` : 'введи замеры'}>
          <div data-arm="lift-verdict"><b>{report.verdict}</b></div>
          {!report.filled && (
            <AdBanner tone="info">Введи хотя бы один снаряд выше — %WR и слабейший снаряд появятся здесь, дальше иди в Диагностику.</AdBanner>
          )}
          <div data-arm="lift-tiles">
            <AdStat value={report.filled ? `${report.filled} сн.` : '—'} label="Замерено" />
            <AdStat value={avgShown != null ? `${avgShown}%` : '—'} label={report.avgWrPct != null ? 'Среднее %WR' : 'Среднее %'} />
            <AdStat value={report.filled ? weakestLabel : '—'} label="Слабейший" />
            <AdStat value={report.totalKg != null && report.totalKg > 0 ? `${report.totalKg}` : '—'} label="Тотал кг" />
          </div>
          {report.rtAsymPct != null && (
            <div className="ad-muted">RT-асимметрия L/R: {report.rtAsymPct}% (фон щипка 5–10%; &gt;15% — на осмотр)</div>
          )}
          {report.hubAsymPct != null && (
            <div className="ad-muted">Hub-асимметрия L/R: {report.hubAsymPct}%</div>
          )}
          {report.pinchAsymPct != null && (
            <div className="ad-muted">Pinch-асимметрия L/R: {report.pinchAsymPct}%</div>
          )}
          {prescription && <div className="ad-muted" data-arm="lift-recipe">Рецепт: {prescription}</div>}
          {(() => {
            const target = diagImplementForReportWeakest(report.weakestWr || report.weakest);
            if (!target) return null;
            return (
              <AdCta>
                <AdBtn
                  variant="amber" block hero
                  onClick={() => { setD({ implement: target, failurePoint: '', faultIds: [] }); setTab('diag'); }}
                >
                  → Диагностировать слабейший: {target}
                </AdBtn>
              </AdCta>
            );
          })()}
          {report.rows.length > 0 && (
            <div className="ad-list" data-arm="lift-table">
              {report.rows.map((r) => (
                <div key={r.implement} className="ad-row">
                  <span className="lift-row-main">
                    <span className="lift-dot" style={{ background: liftLevelColor(r.level) }} aria-hidden />
                    <span><b>{r.label}</b> {r.display}</span>
                  </span>
                  {r.scorePct != null && (
                    <span className="lift-bar" aria-hidden>
                      <span style={{ width: `${Math.max(0, Math.min(100, r.scorePct))}%`, background: liftLevelColor(r.level) }} />
                    </span>
                  )}
                  <span className="ad-muted lift-row-meta">{r.scorePct != null ? `${r.scorePct}% ${r.internal ? '(ориентир)' : 'WR'}` : 'без %'} · {r.level === 'none' ? 'факт' : r.level === 'elite' ? 'элита' : r.level === 'comp' ? 'соревн.' : 'база'}</span>
                  <span className="ad-muted">{r.note}</span>
                </div>
              ))}
            </div>
          )}
        </AdSec>
      </AdCard>

      </>)}
      {tab === 'diag' && (<>
      <AdCard>
        <AdSec title="🔍 Диагностика движений" defaultOpen summary="снаряд → срыв → фолы → тесты">
          <div className="lift-group">Снаряд</div>
          <div className="ad-row" aria-label="Диагностика: снаряд">
            {ARMLIFT_DIAG_IMPLEMENT_OPTS.map((o) => (
              <AdChip key={o.id} active={diag.implement === o.id} onClick={() => setD({ implement: o.id, failurePoint: '', faultIds: [] })}>{o.label}</AdChip>
            ))}
          </div>
          <div className="lift-group">Где срыв</div>
          <div className="ad-row" aria-label="Диагностика: точка срыва">
            {diagFailures.map((fp) => (
              <AdChip key={fp.id} active={diag.failurePoint === fp.id} onClick={() => setD({ failurePoint: fp.id })}>{fp.label}</AdChip>
            ))}
          </div>
          {diag.failurePoint && <div className="ad-muted">{diagFailures.find((x) => x.id === diag.failurePoint)?.hint}</div>}
          <div className="lift-group">Движение (где рвётся)</div>
          <div className="ad-row" data-arm="lift-chain" aria-label="Диагностика: цепочка движения">
            {moveChain.map((ph, idx) => {
              const failed = diag.failurePoint === ph.id;
              const phaseFaults = diagFaults.filter((fl) => ph.faultIds.includes(fl.id));
              const marked = phaseFaults.filter((fl) => diag.faultIds.includes(fl.id));
              return (
                <span key={ph.id} className="ad-tag" title={`${ph.good}${phaseFaults.length ? ` · Фолы: ${phaseFaults.map((fl) => fl.label).join(', ')}` : ''}`}>
                  {idx + 1}. {ph.label}{failed ? ' ✗' : ''}{marked.length ? ` (${marked.length})` : ''}
                </span>
              );
            })}
          </div>
          {diag.failurePoint && (
            <div className="ad-muted">
              {(() => {
                const ph = moveChain.find((x) => x.id === diag.failurePoint);
                if (!ph) return null;
                return (<>Фаза «{ph.label}»: норма — {ph.good}. Фолы фазы: {ph.faultIds.length ? ph.faultIds.map((fid) => diagFaults.find((fl) => fl.id === fid)?.label || fid).join(', ') : 'чистая сила, без фолов'}.</>);
              })()}
            </div>
          )}
          <div className="lift-group">Фолы техники (честно — с фолами замер тренировочный)</div>
          <div className="ad-row" aria-label="Диагностика: фолы">
            {diagFaults.map((fl) => (
              <AdChip key={fl.id} active={diag.faultIds.includes(fl.id)} onClick={() => toggleFault(fl.id)} aria-label={`Фол: ${fl.label}`}>{diag.faultIds.includes(fl.id) ? '✓ ' : ''}{fl.label}</AdChip>
            ))}
          </div>
          {diag.faultIds.length > 0 && (
            <div className="ad-muted">Кью: {diagFaults.filter((x) => diag.faultIds.includes(x.id)).map((x) => x.cue).join(' · ')}</div>
          )}
          <div className="lift-group">Тест-батарея (холды) · релевантны: {relevantTestsFor(diag.implement).join(' + ')}</div>
          <AdGrid cols="auto-sm">
            <LiftNum label="Pinch-hold сек" value={diag.pinchHoldSec} onChange={(v) => setD({ pinchHoldSec: v })} placeholder="20" aria="Pinch-hold сек" />
            <LiftNum label="Farmer-hold сек" value={diag.farmerHoldSec} onChange={(v) => setD({ farmerHoldSec: v })} placeholder="30" aria="Farmer-hold сек" />
            <LiftNum label="Сгибатели холд сек" value={diag.flexHoldSec} onChange={(v) => setD({ flexHoldSec: v })} placeholder="кулак" aria="Сгибатели холд сек" />
            <LiftNum label="Разгибатели холд сек" value={diag.extHoldSec} onChange={(v) => setD({ extHoldSec: v })} placeholder="раскрытие" aria="Разгибатели холд сек" />
          </AdGrid>
          <div className="ad-row" data-arm="lift-levels" aria-label="Диагностика: уровни тестов">
            {levels.pinch && <span className="ad-tag">Pinch: {ARMLIFT_LEVEL_RU[levels.pinch]}</span>}
            {levels.farmer && <span className="ad-tag">Farmer: {ARMLIFT_LEVEL_RU[levels.farmer]}</span>}
            {levels.coc && <span className="ad-tag">CoC: {ARMLIFT_LEVEL_RU[levels.coc]}</span>}
            {levels.silver && <span className="ad-tag">Silver: {ARMLIFT_LEVEL_RU[levels.silver]}</span>}
            {levels.overall && <span className="ad-tag">Итог (по слабейшему): {ARMLIFT_LEVEL_RU[levels.overall]}</span>}
            {extRatio != null && <span className="ad-tag">Сгиб/разгиб {extRatio}{extRatio > 1.5 ? ' — дисбаланс' : ''}</span>}
          </div>
          <div className="ad-row">
            <AdChip active={diag.wristExtWeak} onClick={() => setD({ wristExtWeak: !diag.wristExtWeak })}>Слабая экстензия запястья</AdChip>
            {asymForDiag != null && <span className="ad-tag">Асимметрия из замеров: {asymForDiag}%</span>}
          </div>
          {retests.prev && retests.list.length > 0 && (
            <div className="ad-muted" data-arm="lift-retest">
              Прошлый замер {retests.prev.date}: {retests.list.map((r) => r.text).join(' · ')}
            </div>
          )}
          {retests.due && (
            <div className="ad-muted" data-arm="lift-retest-due">{retests.due}</div>
          )}
          {diagHistory.length > 0 && (
            <div className="ad-list" data-arm="lift-history" aria-label="Диагностика: история диагнозов">
              {diagHistory.slice(-5).reverse().map((s, idx) => (
                <div key={`${s.date}-${s.implement}-${idx}`} className="ad-row">
                  <span>{s.date} · {s.implement}</span>
                  <span className="ad-muted">{s.weakLink} / {s.cause}</span>
                </div>
              ))}
              <AdBtn variant="ghost" onClick={() => { clearDiagHistory(); setHistTick((x) => x + 1); }}>✕ Очистить историю</AdBtn>
            </div>
          )}
          <div className="lift-group">Мобильность (градусы, норма разгиб 70 / сгиб 75)</div>
          <AdGrid cols="auto-sm">
            <LiftNum label="Разгибание запястья °" value={diag.wristExtDeg} onChange={(v) => setD({ wristExtDeg: v })} placeholder="70" aria="Разгибание запястья градусы" />
            <LiftNum label="Сгибание запястья °" value={diag.wristFlexDeg} onChange={(v) => setD({ wristFlexDeg: v })} placeholder="75" aria="Сгибание запястья градусы" />
          </AdGrid>
          <div className="ad-row" aria-label="Диагностика: мобильность">
            <AdChip active={diag.thumbOppOk} onClick={() => setD({ thumbOppOk: !diag.thumbOppOk })}>{diag.thumbOppOk ? '✓ Большой достаёт до мизинца' : 'Большой до мизинца: проверить'}</AdChip>
            <AdChip active={diag.hipHingePoor} onClick={() => setD({ hipHingePoor: !diag.hipHingePoor })}>Hip hinge слабый</AdChip>
            {mobility.fails.length > 0 && <span className="ad-tag">ROM-провал: {mobility.fails.join(', ')} · ретест через 2 нед</span>}
          </div>
          <div className="ad-row">
            <AdChip active={diag.pain} tone={diag.pain ? 'red' : undefined} onClick={() => setD({ pain: !diag.pain })}>{diag.pain ? '🔴 Боль есть — стоп' : 'Боли нет'}</AdChip>
            <AdChip active={diag.elbowPain} tone={diag.elbowPain ? 'red' : undefined} onClick={() => setD({ elbowPain: !diag.elbowPain })}>{diag.elbowPain ? '🔴 Локоть/запястье болит' : 'Локоть в норме'}</AdChip>
            <AdChip active={diag.skinTear} tone={diag.skinTear ? 'red' : undefined} onClick={() => setD({ skinTear: !diag.skinTear })}>{diag.skinTear ? '🔴 Сорвана кожа — щипок стоп' : 'Кожа цела'}</AdChip>
            <AdChip active={diag.thumbWebPain} tone={diag.thumbWebPain ? 'red' : undefined} onClick={() => setD({ thumbWebPain: !diag.thumbWebPain })}>{diag.thumbWebPain ? '🔴 Перепонка болит' : 'Перепонка в норме'}</AdChip>
            {logStats.sessions28d != null && <span className="ad-tag">Журнал: {logStats.sessions28d} хват-сессий/28д</span>}
            {acwr && <span className="ad-tag">ACWR {acwr.ratio} ({acwr.zone})</span>}
          </div>
          <div data-arm="lift-diag-result"><b>{diagnosis.title}</b> · {cause.cause} ({Math.round(cause.confidence * 100)}%)</div>
          <div className="ad-muted">Факты: {cause.evidence.join(' · ')}</div>
          <div className="ad-muted">Чинить: {cause.fix} · {diagnosis.cues.join(' · ')}</div>
          <div className="ad-muted">{diagnosis.ruleNote}</div>
          <AdCta>
            <AdBtn variant="amber" block hero onClick={() => setTab('corr')}>→ К коррекции ({corrections[0]?.title})</AdBtn>
          </AdCta>
        </AdSec>
      </AdCard>
      </>)}
      {tab === 'corr' && (<>
      <AdCard>
        <AdSec title="🔧 Коррекция" defaultOpen summary={`${diagnosis.weakLink} · топ-3`}>
          <div data-arm="lift-corr-result"><b>{diagnosis.title}</b> · причина {cause.cause} ({Math.round(cause.confidence * 100)}%)</div>
          <div className="ad-muted">Чинить: {cause.fix}</div>
          <div className="ad-list" data-arm="lift-corr-top">
            {corrections.map((c, idx) => (
              <div key={c.id} className="ad-row">
                <span><b>{idx + 1}. {c.title}</b> — {c.protocol}</span>
                <span className="ad-muted">{c.sets}×{c.holdSeconds != null ? `${c.holdSeconds}с холд` : `${c.reps[0]}–${c.reps[1]} повт`} · отдых {c.restSec}с · {c.freq} · {c.source} · день {c.dayTag} · чинит: {c.fixesPhase.map((fid) => diagFailures.find((fp) => fp.id === fid)?.label || fid).join(', ')}</span>
              </div>
            ))}
          </div>
          {corrections.some((c) => c.warmup) && (
            <div className="ad-muted" data-arm="lift-corr-warmup">
              Разминка: {corrections.filter((c) => c.warmup).map((c) => c.warmup).join(' · ')}
            </div>
          )}
          <div className="lift-group">Спец-блок волной</div>
          <div className="ad-row" aria-label="Длина спец-блока">
            <AdChip active={diag.specWeeks !== 6} onClick={() => setD({ specWeeks: 4 })}>4 нед</AdChip>
            <AdChip active={diag.specWeeks === 6} onClick={() => setD({ specWeeks: 6 })}>6 нед</AdChip>
          </div>
          <div className="ad-list" data-arm="lift-corr-spec">
            {specBlock.map((w) => (
              <div key={w.week} className="ad-row">
                <span><b>Нед {w.week}</b> — {w.focus}</span>
                <span className="ad-muted">{w.volume}</span>
              </div>
            ))}
          </div>
          <div className="ad-muted">Мост внизу несёт диагноз + топ-3 + спец-блок в Арм-конструктор (старые поля %WR целы). Боль = стоп, в план не едет нагрузка.</div>
          <AdCta>
            <AdBtn variant="dark" block hero onClick={() => setTab('pomost')}>→ Назад к замерам (мост внизу)</AdBtn>
          </AdCta>
        </AdSec>
      </AdCard>
      </>)}
      <AdCard>
        <div id="lift-bridge" />
        <AdSec title="📦 Что уедет в конструктор" collapsible defaultOpen={false} summary={report.filled ? 'армлифтинг' : 'пока пусто'}>
          <div className="ad-muted">Bridge: <code>weakpoints</code> + <code>armDiscipline: armlifting</code> → конструктор встанет в дисциплину «Армлифтинг». Слабейший снаряд, класс, рецепт, last-man-standing — в payload. Упражнения коррекции ({corrections.map((c) => c.exId).join(', ') || '—'}) встанут в недели плана при сборке в дисциплине «Армлифтинг».</div>
        </AdSec>
        <AdCta>
          <AdBtn variant="amber" block hero onClick={applyToConstructor}>→ В Арм-конструктор (армлифтинг)</AdBtn>
        </AdCta>
        <div className="ad-row" data-arm="lift-export">
          <AdBtn variant="ghost" onClick={handleExportHtml}>🖨 HTML</AdBtn>
          <AdBtn variant="ghost" onClick={handleExportCsv}>📥 CSV</AdBtn>
          <AdBtn variant="ghost" onClick={handlePrint}>🖨 Печать</AdBtn>
        </div>
        {toast && <AdBanner tone="ok">{toast}</AdBanner>}
      </AdCard>
    </AdRoot>
  );
};

export default ArmliftingDiagnosticsHub;
