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
import { armliftClassFor, armliftClassLine } from '../../../engines/arm/armlift-weight-class.engine';
import { applyToPlanner } from './planner-bridge';
import { AdRoot, AdCard, AdSec, AdGrid, AdField, AdChip, AdBtn, AdBanner, AdCta } from './arm-design-system';
import { haptics } from '../../../core/native-bridge';

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

  return (
    <AdRoot rootClass="train-armdiag" maxWidth={860}>
      <AdCard>
        <AdSec title="🏋️ Армлифтинг — замеры снарядов" defaultOpen summary="RT · Axle · Pinch · CoC · Hub · Excalibur">
          <AdGrid cols="auto-sm">
            <AdField label="RT кг">
              <input inputMode="decimal" value={state.rtKg} onChange={(e) => set({ rtKg: e.target.value })} placeholder="60" aria-label="RT кг" />
            </AdField>
            <AdField label="RT левая кг">
              <input inputMode="decimal" value={state.rtL} onChange={(e) => set({ rtL: e.target.value })} placeholder="L" aria-label="RT левая кг" />
            </AdField>
            <AdField label="RT правая кг">
              <input inputMode="decimal" value={state.rtR} onChange={(e) => set({ rtR: e.target.value })} placeholder="R" aria-label="RT правая кг" />
            </AdField>
            <AdField label="Axle кг">
              <input inputMode="decimal" value={state.axleKg} onChange={(e) => set({ axleKg: e.target.value })} placeholder="100" aria-label="Axle кг" />
            </AdField>
            <AdField label="Pinch кг">
              <input inputMode="decimal" value={state.pinchKg} onChange={(e) => set({ pinchKg: e.target.value })} placeholder="макс кг" aria-label="Pinch кг" />
            </AdField>
            <AdField label="Pinch сек">
              <input inputMode="decimal" value={state.pinchSec} onChange={(e) => set({ pinchSec: e.target.value })} placeholder="15" aria-label="Pinch сек" />
            </AdField>
            <AdField label="CoC уровень">
              <input inputMode="decimal" value={state.cocLevel} onChange={(e) => set({ cocLevel: e.target.value })} placeholder="1.5" aria-label="CoC уровень" />
            </AdField>
            <AdField label="Silver сек">
              <input inputMode="decimal" value={state.silverSec} onChange={(e) => set({ silverSec: e.target.value })} placeholder="время" aria-label="Silver сек" />
            </AdField>
            <AdField label="Hub кг">
              <input inputMode="decimal" value={state.hubKg} onChange={(e) => set({ hubKg: e.target.value })} placeholder="30" aria-label="Hub кг" />
            </AdField>
            <AdField label="Hub L/R кг">
              <input inputMode="decimal" value={state.hubL} onChange={(e) => set({ hubL: e.target.value })} placeholder="L" aria-label="Hub левая кг" />
            </AdField>
            <AdField label="Hub R кг">
              <input inputMode="decimal" value={state.hubR} onChange={(e) => set({ hubR: e.target.value })} placeholder="R" aria-label="Hub правая кг" />
            </AdField>
            <AdField label="Excalibur кг">
              <input inputMode="decimal" value={state.excalKg} onChange={(e) => set({ excalKg: e.target.value })} placeholder="40" aria-label="Excalibur кг" />
            </AdField>
            <AdField label="Вес тела кг">
              <input inputMode="decimal" value={state.bwKg} onChange={(e) => set({ bwKg: e.target.value })} placeholder="80" aria-label="Вес тела кг" />
            </AdField>
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
            <AdField label="Raptor 1.75 кг">
              <input inputMode="decimal" value={state.raptorKg} onChange={(e) => set({ raptorKg: e.target.value })} placeholder="факт" aria-label="Raptor кг" />
            </AdField>
            <AdField label="Country Crush кг">
              <input inputMode="decimal" value={state.crushKg} onChange={(e) => set({ crushKg: e.target.value })} placeholder="факт" aria-label="Country Crush кг" />
            </AdField>
            <AdField label="Clock кг">
              <input inputMode="decimal" value={state.clockKg} onChange={(e) => set({ clockKg: e.target.value })} placeholder="факт" aria-label="Grandfather Clock кг" />
            </AdField>
            <AdField label="Anvil кг">
              <input inputMode="decimal" value={state.anvilKg} onChange={(e) => set({ anvilKg: e.target.value })} placeholder="факт" aria-label="Anvil кг" />
            </AdField>
            <AdField label="Saxon medley кг">
              <input inputMode="decimal" value={state.medleyKg} onChange={(e) => set({ medleyKg: e.target.value })} placeholder="факт" aria-label="Saxon medley кг" />
            </AdField>
          </AdGrid>
          <div className="ad-muted">Факт без %: разрядных таблиц нет, только живые лидерборды Armlifting USA</div>
        </AdSec>
      </AdCard>

      <AdCard>
        <AdSec title="📏 Замер по правилам" collapsible defaultOpen={false} summary="IronMind/AUSA чек-лист">
          <div className="ad-row">
            {RULE_LABELS.map((label, i) => (
              <AdChip key={label} active={state.rules[i]} onClick={() => toggleRule(i)} aria-label={`Правило ${i + 1}: ${label}`}>
                {state.rules[i] ? '✓ ' : ''}{label}
              </AdChip>
            ))}
          </div>
          <div className="ad-muted" data-arm="lift-rules">{rulesRes.note}</div>
        </AdSec>
      </AdCard>

      <AdCard>
        <AdSec title="📊 Вердикт по снарядам" defaultOpen summary={report.filled ? `${report.filled} сн.` : 'введи замеры'}>
          <div data-arm="lift-verdict"><b>{report.verdict}</b></div>
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
                  <span><b>{r.label}</b> {r.display}</span>
                  <span className="ad-muted">{r.scorePct != null ? `${r.scorePct}% ${r.internal ? '(ориентир)' : 'WR'}` : 'без %'} · {r.level === 'none' ? 'факт' : r.level === 'elite' ? 'элита' : r.level === 'comp' ? 'соревн.' : 'база'}</span>
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
            <AdField label="Вес попытки кг">
              <input inputMode="decimal" value={state.attTarget} onChange={(e) => set({ attTarget: e.target.value })} placeholder="вес" aria-label="Вес попытки кг" />
            </AdField>
            <AdChip active={state.attOk} tone={state.attOk ? 'green' : 'red'} onClick={() => set({ attOk: !state.attOk })}>{state.attOk ? '✓ взята' : '✗ сорвана'}</AdChip>
            <AdBtn variant="dark" onClick={logAttempt}>💾 Попытку</AdBtn>
          </div>
          {hist.length > 0 && <div className="ad-muted">Журнал: {hist.map((h: any) => `${h.implement} ${h.weightKg}${h.success ? '✓' : '✗'} ${h.wrPct}%`).join(' · ')}</div>}
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
