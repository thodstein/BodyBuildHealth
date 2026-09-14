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
  assessLiftRules,
  liftTrendFromLog,
  prescriptionForWeakest,
} from '../../../engines/arm/armlifting-diagnostics.engine';
import { buildArmliftingHtml, buildArmliftingCsv } from '../../../engines/arm/armlifting-diagnostics.engine';
import { downloadArmFile } from '../../../engines/arm/arm-diagnostics-export.engine';
import { savePlatformLogEntry, loadPlatformLog, planLastManStanding } from '../../../engines/arm/arm-platform.engine';
import { platformRuleFor, PLATFORM_RULES_2026, LMS_RULES_2026 } from '../../../engines/arm/arm-pro5-platform-rules.engine';
import { armliftClassFor, armliftClassLine } from '../../../engines/arm/armlift-weight-class.engine';
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

type LiftState = {
  rtKg: string; rtL: string; rtR: string;
  axleKg: string; axleImpl: string;
  pinchSec: string; pinchKg: string;
  cocLevel: string; silverSec: string; silverGripper: string;
  excalKg: string; hubKg: string; hubL: string; hubR: string;
  raptorKg: string; crushKg: string; clockKg: string; anvilKg: string; medleyKg: string;
  sex: string; bwKg: string;
  attImplement: string; attTarget: string; attOk: boolean;
  rules: boolean[];
};

const DEFAULT_STATE: LiftState = {
  rtKg: '', rtL: '', rtR: '', axleKg: '', axleImpl: 'saxon',
  pinchSec: '', pinchKg: '', cocLevel: '', silverSec: '', silverGripper: '3',
  excalKg: '', hubKg: '', hubL: '', hubR: '',
  raptorKg: '', crushKg: '', clockKg: '', anvilKg: '', medleyKg: '',
  sex: 'male', bwKg: '80',
  attImplement: 'rolling_thunder', attTarget: '', attOk: true,
  rules: [false, false, false, false, false],
};

/** PRO-3 W6: сид из арм-хаба — замеры не дублируются вручную.
 *  Односторонний (сюда, не обратно — петель нет): только если своего ключа ещё нет. */
const ARM_HUB_KEY = 'he_arm_diagnostics_hub_v4';

const RULE_LABELS = [
  'Оригинальный снаряд',
  'DOH, костяшки вперёд',
  'Без лямок/hook/thumbless',
  'Мел обычный + протирка',
  'Калиброванные диски',
];

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
    const rules = Array.isArray((j as any).rules)
      ? [0, 1, 2, 3, 4].map((i) => (j as any).rules[i] === true)
      : [...DEFAULT_STATE.rules];
    return {
      ...DEFAULT_STATE,
      rtKg: pick(j, 'rtKg', ''), rtL: pick(j, 'rtL', ''), rtR: pick(j, 'rtR', ''),
      axleKg: pick(j, 'axleKg', ''), axleImpl: pick(j, 'axleImpl', 'saxon') === 'apollon' ? 'apollon' : 'saxon',
      pinchSec: pick(j, 'pinchSec', ''), pinchKg: pick(j, 'pinchKg', ''),
      cocLevel: pick(j, 'cocLevel', ''), silverSec: pick(j, 'silverSec', ''),
      silverGripper: ['2', '3', '4'].includes(pick(j, 'silverGripper', '3')) ? pick(j, 'silverGripper', '3') : '3',
      excalKg: pick(j, 'excalKg', ''), hubKg: pick(j, 'hubKg', ''),
      hubL: pick(j, 'hubL', ''), hubR: pick(j, 'hubR', ''),
      raptorKg: pick(j, 'raptorKg', ''), crushKg: pick(j, 'crushKg', ''),
      clockKg: pick(j, 'clockKg', ''), anvilKg: pick(j, 'anvilKg', ''), medleyKg: pick(j, 'medleyKg', ''),
      sex: pick(j, 'sex', 'male') === 'female' ? 'female' : 'male',
      bwKg: pick(j, 'bwKg', '80'),
      attImplement: pick(j, 'attImplement', 'rolling_thunder'), attTarget: pick(j, 'attTarget', ''),
      rules,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

const IMPLEMENT_OPTS = [
  { id: 'rolling_thunder', label: 'RT' },
  { id: 'apollon_axle', label: 'Axle' },
  { id: 'hub', label: 'Hub' },
  { id: 'excalibur', label: 'Excal' },
  { id: 'raptor_175', label: 'Raptor' },
  { id: 'country_crush', label: 'Crush' },
  { id: 'grandfather_clock', label: 'Clock' },
  { id: 'anvil', label: 'Anvil' },
];

const f = (s: string): number | undefined => {
  const v = parseFloat(s);
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

export const ArmliftingDiagnosticsHub: React.FC = () => {
  const [state, setState] = useState<LiftState>(loadState);
  const [toast, setToast] = useState('');
  const [logTick, setLogTick] = useState(0);

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
    cocLevel: state.cocLevel ? parseFloat(state.cocLevel) : undefined,
    silverSec: f(state.silverSec),
    silverGripper: state.silverGripper,
    excalKg: f(state.excalKg),
    hubKg: f(state.hubKg),
    hubL: f(state.hubL), hubR: f(state.hubR),
    raptorKg: f(state.raptorKg), crushKg: f(state.crushKg),
    clockKg: f(state.clockKg), anvilKg: f(state.anvilKg), saxonMedleyKg: f(state.medleyKg),
    sex: state.sex,
  }), [state.rtKg, state.rtL, state.rtR, state.axleKg, state.axleImpl, state.pinchSec, state.pinchKg, state.cocLevel, state.silverSec, state.silverGripper, state.excalKg, state.hubKg, state.hubL, state.hubR, state.raptorKg, state.crushKg, state.clockKg, state.anvilKg, state.medleyKg, state.sex]);

  const rulesRes = useMemo(() => assessLiftRules(state.rules), [state.rules]);
  const classLine = useMemo(
    () => armliftClassLine(parseFloat(state.bwKg) || 0, state.sex),
    [state.bwKg, state.sex],
  );

  const hist = useMemo(() => {
    try { return loadPlatformLog().slice(-12).reverse(); } catch { return []; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logTick]);

  const trend = useMemo(() => {
    try { return liftTrendFromLog(loadPlatformLog()); } catch { return []; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logTick]);

  /** Лесенка last-man-standing по слабейшему кг-снаряду с попытками (A4). */
  const lms = useMemo(() => {
    const key = report.weakestWr || report.weakest;
    const row = report.rows.find((r) => r.implement === key);
    if (!row || !row.attempts.length) return { label: '', steps: [] as number[] };
    const last = row.attempts[row.attempts.length - 1];
    return { label: row.label, steps: planLastManStanding(last) };
  }, [report]);

  const prescription = report.prescription || prescriptionForWeakest(report.weakestWr || report.weakest);

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
    const cls = armliftClassFor(parseFloat(state.bwKg) || 0, state.sex);
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
          weightClass: cls.label,
          rulesNote: rulesRes.note,
          lms: lms.steps.length ? { label: lms.label, steps: lms.steps } : undefined,
          rows: report.rows.map((r) => ({ implement: r.implement, display: r.display, scorePct: r.scorePct, level: r.level, internal: r.internal })),
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
    lmsAttempts: lms.steps,
    lmsLabel: lms.label,
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

  const logAttempt = () => {
    const w = parseFloat(state.attTarget);
    if (!Number.isFinite(w) || w <= 0) {
      setToast('Введи вес попытки');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    try {
      savePlatformLogEntry({ implement: state.attImplement, sex: state.sex, weightKg: w, success: state.attOk });
      setLogTick((x) => x + 1);
      setToast(`✓ Попытка ${w}кг ${state.attOk ? 'взята' : 'сорвана'} — в журнале`);
      setTimeout(() => setToast(''), 2500);
    } catch { /* noop */ }
  };

  const toggleRule = (i: number) => {
    const next = state.rules.map((v, k) => (k === i ? !v : v));
    set({ rules: next });
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
        .train-armdiag [data-arm="lift-rules-checks"] .ad-chip { min-height: 44px; }
        .train-armdiag [data-arm="lift-rules-2026"] .ad-row { gap: 6px; align-items: baseline; }
        .train-armdiag .lift-rule-name { font-weight: 800; color: #fff; white-space: nowrap; }
        .train-armdiag .lift-rule-sub { font-size: 11px; }
        .train-armdiag .lift-hist-row { display: flex; align-items: center; gap: 6px; }
        .train-armdiag .lift-hist-bar { height: 6px; border-radius: 4px; background: rgba(255,255,255,0.12); overflow: hidden; flex: 1 1 48px; min-width: 48px; }
        .train-armdiag .lift-hist-bar > span { display: block; height: 100%; border-radius: 4px; background: #38bdf8; }
      `}</style>
      <AdCard>
        <div className="ad-head" data-arm="lift-head">
          <div className="ad-head-ic" aria-hidden>🏋️</div>
          <div className="ad-head-tx">
            <h2 className="ad-head-title">Армлифтинг — диагностика</h2>
            <p className="ad-head-sub">RT · Axle · Pinch · CoC · Hub · Excalibur · %WR · помост · мост</p>
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
          <span className="ad-tag">{classLine}</span>
          {report.rtAsymPct != null && <span className="ad-tag">RT-асимметрия {report.rtAsymPct}%</span>}
          {report.hubAsymPct != null && <span className="ad-tag">Hub-асимметрия {report.hubAsymPct}%</span>}
          {lms.steps.length > 0 && <span className="ad-tag">LMS: {lms.label}</span>}
        </div>
        <AdSec title="ℹ️ Как пользоваться" collapsible defaultOpen={false} summary="4 шага до помоста">
          <div className="ad-muted"><b>1 Замеры</b> — вбей снаряды ниже · <b>2 Вердикт</b> — %WR и слабейший снаряд · <b>3 Помост</b> — запиши попытки 90/96/102 · <b>4 Мост</b> — отправка в конструктор внизу.</div>
        </AdSec>
        {toast && <AdBanner tone="ok">{toast}</AdBanner>}
      </AdCard>

      <AdCard>
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
          </AdGrid>
          <div className="lift-group">⚖️ Класс</div>
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
          <div className="ad-muted" data-arm="lift-class">{classLine} (Armlifting USA 2026, без методики сгонки)</div>
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
        <AdSec title="📏 Замер по правилам" collapsible defaultOpen={false} summary="IronMind/AUSA чек-лист">
          <div className="ad-row" data-arm="lift-rules-checks">
            {RULE_LABELS.map((label, i) => (
              <AdChip key={label} active={state.rules[i]} onClick={() => toggleRule(i)} aria-label={`Правило ${i + 1}: ${label}`}>
                {state.rules[i] ? '✓ ' : ''}{label}
              </AdChip>
            ))}
          </div>
          <div className="ad-muted" data-arm="lift-rules">{rulesRes.note}</div>
          {(()=>{
            const map: Record<string, string> = { raptor_175: 'raptor_1h' };
            const rule = platformRuleFor(map[state.attImplement] || state.attImplement);
            return (<>
              {rule && (
                <div className="ad-muted" data-arm="lift-rule-2026">
                  <b>{rule.name} (2026):</b> {rule.grip} · {rule.timing} · {rule.attempts} · Фолы: {rule.fouls.join('; ')} · {rule.wrNote}
                </div>
              )}
              <div className="ad-muted" data-arm="lift-lms-rules">{LMS_RULES_2026}</div>
            </>);
          })()}
        </AdSec>
      </AdCard>

      <AdCard>
        <AdSec title="📜 Правила снарядов 2026" collapsible defaultOpen={false} summary="9 снарядов · IronMind/AUSA">
          <div className="ad-list" data-arm="lift-rules-2026">
            {PLATFORM_RULES_2026.map((r) => (
              <div key={r.implement} className="ad-row">
                <span className="lift-rule-name">{r.name}</span>
                <span className="ad-muted lift-rule-sub">{r.grip} · {r.timing} · {r.attempts} · Фолы: {r.fouls.join('; ')} · {r.wrNote}</span>
              </div>
            ))}
          </div>
        </AdSec>
      </AdCard>

      <AdCard>
        <AdSec title="📊 Вердикт по снарядам" defaultOpen summary={report.filled ? `${report.filled} сн.` : 'введи замеры'}>
          <div data-arm="lift-verdict"><b>{report.verdict}</b></div>
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
          {prescription && <div className="ad-muted" data-arm="lift-recipe">Рецепт: {prescription}</div>}
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
          {report.rows.some((r) => r.attempts.length) && (
            <div className="ad-muted">Попытки (90/96/102): {report.rows.filter((r) => r.attempts.length).map((r) => `${r.label} ${r.attempts.join('/')}`).join(' · ')}</div>
          )}
          {lms.steps.length > 0 && (
            <div className="ad-muted" data-arm="lift-lms">Last-man-standing ({lms.label}): {lms.steps.join(' → ')} (промах = выбыл, вниз нельзя — Armlifting USA 2026)</div>
          )}
        </AdSec>
      </AdCard>

      <AdCard>
        <AdSec title="🏟 Помост — факт попытки" collapsible defaultOpen={false} summary="журнал he_arm_platform_log">
          <div className="ad-row">
            {IMPLEMENT_OPTS.map((o) => (
              <AdChip key={o.id} active={state.attImplement === o.id} onClick={() => set({ attImplement: o.id })}>{o.label}</AdChip>
            ))}
          </div>
          <div className="ad-row">
            <LiftNum label="Вес попытки кг" value={state.attTarget} onChange={(v) => set({ attTarget: v })} placeholder="вес" aria="Вес попытки кг" />
            <AdChip active={state.attOk} tone={state.attOk ? 'green' : 'red'} onClick={() => set({ attOk: !state.attOk })}>{state.attOk ? '✓ взята' : '✗ сорвана'}</AdChip>
            <AdBtn variant="dark" onClick={logAttempt}>💾 Попытку</AdBtn>
          </div>
          {hist.length > 0 && (
            <div className="ad-list">
              {hist.slice(0, 6).map((h: any, i: number) => (
                <div key={`${h.implement}-${h.weightKg}-${i}`} className="ad-row lift-hist-row">
                  <span><b>{h.implement}</b> {h.weightKg}кг {h.success ? '✓' : '✗'}</span>
                  <span className="lift-hist-bar" aria-hidden>
                    <span style={{ width: `${Math.max(0, Math.min(100, Number(h.wrPct) || 0))}%` }} />
                  </span>
                  <span className="ad-muted lift-row-meta">{h.wrPct}%</span>
                </div>
              ))}
            </div>
          )}
          {trend.length > 0 && (
            <div className="ad-muted" data-arm="lift-trend">
              Тренд: {trend.map((t) => `${t.implement} ${t.deltaKg >= 0 ? '+' : ''}${t.deltaKg}кг (${t.deltaPct >= 0 ? '+' : ''}${t.deltaPct}%, n=${t.n})`).join(' · ')}
            </div>
          )}
        </AdSec>
      </AdCard>

      <AdCard>
        <AdSec title="📦 Что уедет в конструктор" collapsible defaultOpen={false} summary={report.filled ? 'армлифтинг' : 'пока пусто'}>
          <div className="ad-muted">Bridge: <code>weakpoints</code> + <code>armDiscipline: armlifting</code> → конструктор встанет в дисциплину «Армлифтинг». Слабейший снаряд, класс, рецепт и last-man-standing — в payload.</div>
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
