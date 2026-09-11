/**
 * ArmliftingDiagnosticsHub.tsx — отдельный хаб армлифтинга (PRO-3 W-AL).
 * Раньше снаряды жили гостем в табе «Хват» арм-хаба — теперь свой дом:
 * замеры → %WR/вердикт → попытки → мост в Арм-конструктор (дисциплина «Армлифтинг»).
 * Старый хаб не тронут. Тот же визуальный язык (.ad-*, arm-design.css).
 */
import React, { useMemo, useState } from 'react';
import { buildArmliftingReport } from '../../../engines/arm/armlifting-diagnostics.engine';
import { buildArmliftingHtml, buildArmliftingCsv } from '../../../engines/arm/armlifting-diagnostics.engine';
import { downloadArmFile } from '../../../engines/arm/arm-diagnostics-export.engine';
import { savePlatformLogEntry, loadPlatformLog } from '../../../engines/arm/arm-platform.engine';
import { applyToPlanner } from './planner-bridge';
import { AdRoot, AdCard, AdSec, AdGrid, AdField, AdChip, AdBtn, AdBanner, AdCta } from './arm-design-system';
import { haptics } from '../../../core/native-bridge';

const STORAGE_KEY = 'he_armlifting_diag_v1';

type LiftState = {
  rtKg: string; axleKg: string; axleImpl: string; pinchSec: string;
  cocLevel: string; excalKg: string; hubKg: string; sex: string; bwKg: string;
  attImplement: string; attTarget: string; attOk: boolean;
};

const DEFAULT_STATE: LiftState = {
  rtKg: '', axleKg: '', axleImpl: 'saxon', pinchSec: '', cocLevel: '',
  excalKg: '', hubKg: '', sex: 'male', bwKg: '80',
  attImplement: 'rolling_thunder', attTarget: '', attOk: true,
};

/** PRO-3 W6: сид из арм-хаба — замеры не дублируются вручную.
 *  Односторонний (сюда, не обратно — петель нет): только если своего ключа ещё нет. */
const ARM_HUB_KEY = 'he_arm_diagnostics_hub_v4';

function loadState(): LiftState {
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
    const s = (k: keyof LiftState): string => (typeof (j as any)[k] === 'string' ? (j as any)[k] : String(DEFAULT_STATE[k]));
    return { ...DEFAULT_STATE, rtKg: s('rtKg'), axleKg: s('axleKg'), axleImpl: s('axleImpl') === 'apollon' ? 'apollon' : 'saxon', pinchSec: s('pinchSec'), cocLevel: s('cocLevel'), excalKg: s('excalKg'), hubKg: s('hubKg'), sex: s('sex') === 'female' ? 'female' : 'male', bwKg: s('bwKg'), attImplement: s('attImplement'), attTarget: s('attTarget') };
  } catch {
    return DEFAULT_STATE;
  }
}

const IMPLEMENT_OPTS = [
  { id: 'rolling_thunder', label: 'RT' },
  { id: 'apollon_axle', label: 'Axle' },
  { id: 'hub', label: 'Hub' },
  { id: 'excalibur', label: 'Excal' },
];

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
    rtKg: parseFloat(state.rtKg) || undefined,
    axleKg: parseFloat(state.axleKg) || undefined,
    axleImpl: state.axleImpl,
    pinchSec: parseFloat(state.pinchSec) || undefined,
    cocLevel: state.cocLevel ? parseFloat(state.cocLevel) : undefined,
    excalKg: parseFloat(state.excalKg) || undefined,
    hubKg: parseFloat(state.hubKg) || undefined,
    sex: state.sex,
  }), [state.rtKg, state.axleKg, state.axleImpl, state.pinchSec, state.cocLevel, state.excalKg, state.hubKg, state.sex]);

  const hist = useMemo(() => {
    try { return loadPlatformLog().slice(-5).reverse(); } catch { return []; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logTick]);

  const applyToConstructor = () => {
    if (!report.filled) {
      setToast('Нечего отправлять — введи хотя бы один снаряд');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    try { void haptics('light'); } catch { /* noop */ }
    const bw = parseFloat(state.bwKg);
    const rt = parseFloat(state.rtKg);
    applyToPlanner({
      kind: 'weakpoints',
      label: `Армлифтинг-диагностика: ${report.verdict}`,
      data: {
        groups: [],
        armDiscipline: 'armlifting',
        armLiftingVerdict: report.verdict,
        armLifting: {
          weakest: report.weakest, avgPct: report.avgPct, totalKg: report.totalKg,
          rows: report.rows.map((r) => ({ implement: r.implement, display: r.display, scorePct: r.scorePct, level: r.level, internal: r.internal })),
        },
        armProfile: {
          ...(Number.isFinite(bw) && bw > 0 ? { bwKg: bw } : {}),
          ...(Number.isFinite(rt) && rt > 0 ? { rtKg: rt } : {}),
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

  return (
    <AdRoot rootClass="train-armdiag" maxWidth={860}>
      <AdCard>
        <AdSec title="🏋️ Армлифтинг — замеры снарядов" defaultOpen summary="RT · Axle · Pinch · CoC · Hub · Excalibur">
          <AdGrid cols="auto-sm">
            <AdField label="RT кг">
              <input inputMode="decimal" value={state.rtKg} onChange={(e) => set({ rtKg: e.target.value })} placeholder="60" aria-label="RT кг" />
            </AdField>
            <AdField label="Axle кг">
              <input inputMode="decimal" value={state.axleKg} onChange={(e) => set({ axleKg: e.target.value })} placeholder="100" aria-label="Axle кг" />
            </AdField>
            <AdField label="Pinch сек">
              <input inputMode="decimal" value={state.pinchSec} onChange={(e) => set({ pinchSec: e.target.value })} placeholder="15" aria-label="Pinch сек" />
            </AdField>
            <AdField label="CoC уровень">
              <input inputMode="decimal" value={state.cocLevel} onChange={(e) => set({ cocLevel: e.target.value })} placeholder="1.5" aria-label="CoC уровень" />
            </AdField>
            <AdField label="Hub кг">
              <input inputMode="decimal" value={state.hubKg} onChange={(e) => set({ hubKg: e.target.value })} placeholder="30" aria-label="Hub кг" />
            </AdField>
            <AdField label="Excalibur кг">
              <input inputMode="decimal" value={state.excalKg} onChange={(e) => set({ excalKg: e.target.value })} placeholder="40" aria-label="Excalibur кг" />
            </AdField>
          </AdGrid>
          <div className="ad-row">
            <AdChip active={state.axleImpl !== 'apollon'} onClick={() => set({ axleImpl: 'saxon' })}>Saxon (ориентир)</AdChip>
            <AdChip active={state.axleImpl === 'apollon'} onClick={() => set({ axleImpl: 'apollon' })}>Apollon (WR)</AdChip>
            <AdChip active={state.sex !== 'female'} onClick={() => set({ sex: 'male' })}>М</AdChip>
            <AdChip active={state.sex === 'female'} onClick={() => set({ sex: 'female' })}>Ж</AdChip>
          </div>
          <div className="ad-muted">CoC — ordinal (№1≈140 … №3≈280 фунтов, не калибровка) · Excalibur — факт без % (SAR по весовой)</div>
          <div className="ad-muted">Замеры подтягиваются из арм-хаба при первом входе (свой ввод приоритетнее, обратно не пишем)</div>
        </AdSec>
      </AdCard>

      <AdCard>
        <AdSec title="📊 Вердикт по снарядам" defaultOpen summary={report.filled ? `${report.filled} сн.` : 'введи замеры'}>
          <div data-arm="lift-verdict"><b>{report.verdict}</b></div>
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
        </AdSec>
      </AdCard>

      <AdCard>
        <AdSec title="📦 Что уедет в конструктор" collapsible defaultOpen={false} summary={report.filled ? 'армлифтинг' : 'пока пусто'}>
          <div className="ad-muted">Bridge: <code>weakpoints</code> + <code>armDiscipline: armlifting</code> → конструктор встанет в дисциплину «Армлифтинг». Слабейший снаряд и профиль — в payload.</div>
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
