/**
 * CombatDiagnosticsHub — P7 шелл + P8 школа хаба диагностики единоборств (6 табов).
 * Отдельный эпик от планировщика: строится диагноз, план не меняется.
 * Мост — kind:'weakpoints' существующими полями (без правок shared-моста).
 * Стиль: белый текст #fff, тачи 44px+, хуки data-combat.
 */
import React from 'react';
import {
  COMBAT_STRIKE_LABELS, COMBAT_STRIKE_POINTS,
  diagnoseCombatStrikePoint,
  weakestCombatStrikePoint,
  type CombatStrikePoint,
} from '../../../engines/combat-diagnostics/combat-strike-biomech.engine';
import {
  COMBAT_TAKEDOWN_LABELS, COMBAT_TAKEDOWN_POINTS,
  diagnoseCombatTakedown,
  type CombatTakedownPoint,
} from '../../../engines/combat-diagnostics/combat-takedown.engine';
import { analyzeCombatStrikePath } from '../../../engines/combat-diagnostics/combat-strike-path.engine';
import { parseCombatTrackerCsv } from '../../../engines/combat-diagnostics/combat-tracker-import.engine';
import { screenCombatSafety } from '../../../engines/combat-diagnostics/combat-safety-screen.engine';
import { combatAcwrZone, combatAsymmetryVerdict } from '../../../engines/combat-diagnostics/combat-load-screen.engine';
import { scoreCombat } from '../../../engines/combat-diagnostics/combat-scoring.engine';
import {
  auditCombatCoverage, buildCombatSpecBlock, combatWeakCause, rankCombatCorrections, simulateCombatCorrection,
} from '../../../engines/combat-diagnostics/combat-correction.engine';
import {
  buildCombatBridgeData, COMBAT_HUB_KEY,
} from '../../../engines/combat-diagnostics/combat-diagnostics-injection.engine';
import {
  buildCombatDiagnosticsCsv, buildCombatDiagnosticsHtml, downloadCombatFile,
} from '../../../engines/combat-diagnostics/combat-diagnostics-export.engine';
import {
  COMBAT_SCHOOL_LABELS, COMBAT_SCHOOL_STRIKES, STRIKE_SCHOOL, schoolDrillFor,
  type CombatSchoolStrike,
} from '../../../engines/combat-diagnostics/combat-strike-school.engine';
import { applyToPlanner } from './planner-bridge';

export type CombatHubTab = 'strikes' | 'takedowns' | 'video' | 'safety' | 'recovery' | 'summary';

const TABS: Array<{ id: CombatHubTab; label: string }> = [
  { id: 'strikes', label: '🥊 Удары' },
  { id: 'takedowns', label: '🤼 Тейкдауны' },
  { id: 'video', label: '🎥 Видео' },
  { id: 'safety', label: '🛡 Безопасность' },
  { id: 'recovery', label: '📈 Нагрузка' },
  { id: 'summary', label: '📋 Итог' },
];

const WHITE = '#fff';
const BTN: React.CSSProperties = {
  minHeight: 48, padding: '12px 16px', borderRadius: 12, fontWeight: 700,
  background: 'rgba(236,72,153,0.16)', border: '1px solid rgba(236,72,153,0.5)', color: WHITE,
};
const NUM: React.CSSProperties = {
  minHeight: 44, fontSize: 16, padding: '8px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: WHITE, width: 110,
};
const LBL: React.CSSProperties = { color: WHITE, fontSize: 13, fontWeight: 700 };

function loadHub(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(COMBAT_HUB_KEY) || '{}'); } catch { return {}; }
}

export function CombatDiagnosticsHub(): React.ReactElement {
  const [tab, setTab] = React.useState<CombatHubTab>('strikes');
  const [vals, setVals] = React.useState<Record<string, string>>(() => loadHub());
  const [csv, setCsv] = React.useState('');
  const [msg, setMsg] = React.useState('');

  React.useEffect(() => {
    try { localStorage.setItem(COMBAT_HUB_KEY, JSON.stringify(vals)); } catch { /* ignore */ }
  }, [vals]);

  const set = (k: string, v: string) => setVals(prev => ({ ...prev, [k]: v }));
  const num = (k: string): number | null => {
    const v = Number(String(vals[k] ?? '').replace(',', '.'));
    return Number.isFinite(v) && String(vals[k] ?? '').trim() !== '' ? v : null;
  };

  const strikeDiags = COMBAT_STRIKE_POINTS.map(p => diagnoseCombatStrikePoint(p, { handSpeedMs: num(`spd_${p}`), impulseNs: num(`imp_${p}`) }));
  const takedownDiags = COMBAT_TAKEDOWN_POINTS.map(p => diagnoseCombatTakedown(p, {
    entryTimeS: num(`td_time_${p}`), successRate: num(`td_rate_${p}`) != null ? (num(`td_rate_${p}`) as number) / 100 : null,
  }));
  const worstStrike = weakestCombatStrikePoint(Object.fromEntries(COMBAT_STRIKE_POINTS.map(p => [p, { handSpeedMs: num(`spd_${p}`), impulseNs: num(`imp_${p}`)}])));
  const worstTakedownPt = takedownDiags.find(d => d.level === 'critical')?.point
    ?? takedownDiags.find(d => d.level === 'warn')?.point ?? null;
  const path = csv.trim() ? analyzeCombatStrikePath(csv).verdict : null;
  const videoPresent = csv.trim().length > 10;
  const tracker = parseCombatTrackerCsv(vals.tracker_csv ?? '');
  const safety = screenCombatSafety({
    age: num('age'), concussionsLastYear: num('conc'),
    neckPain: vals.neck_pain === '1', numbness: vals.numb === '1', headacheAfterSparring: vals.headache === '1',
    neckExtensionKg: num('neck_kg'), bodyWeightKg: num('bw_kg'),
  });
  const asym = combatAsymmetryVerdict({ left: num('lr_l'), right: num('lr_r') });
  const acwr = combatAcwrZone(num('acwr'));
  const score = scoreCombat({
    worstStrike: strikeDiags.find(d => d.level === 'critical') ? 'critical' : strikeDiags.find(d => d.level === 'warn') ? 'warn' : strikeDiags.some(d => d.level === 'ok') ? 'ok' : null,
    worstTakedown: worstTakedownPt ? (takedownDiags.find(d => d.point === worstTakedownPt)?.level as 'warn' | 'critical') : null,
    path, asymPct: asym.asymPct,
    trackerPresent: tracker.total > 0, videoPresent,
    mobilityPresent: vals.mobility === '1',
    safetyBlocked: safety.blocked, neckWeak: (safety.neckNote ?? '').includes('слабее'),
  });
  const causes = [
    ...(worstStrike ? [combatWeakCause(worstStrike, { lowSpeed: true, lowMass: (strikeDiags.find(d => d.point === worstStrike)?.effectiveMassKg ?? 99) < 4, asymFix: asym.verdict === 'fix', acwrBad: acwr === 'danger', mobilityMissing: vals.mobility !== '1' })] : []),
    ...(worstTakedownPt ? [combatWeakCause(worstTakedownPt, { lowSpeed: true, lowMass: false, asymFix: false, acwrBad: acwr === 'danger', mobilityMissing: false })] : []),
  ];
  const top3 = rankCombatCorrections(causes);
  const sim = simulateCombatCorrection(score.score, top3);
  const measuredAll = [...COMBAT_STRIKE_POINTS.filter(p => num(`spd_${p}`) != null), ...COMBAT_TAKEDOWN_POINTS.filter(p => num(`td_time_${p}`) != null || num(`td_rate_${p}`) != null)];
  const coverage = auditCombatCoverage(measuredAll, [...COMBAT_STRIKE_POINTS, ...COMBAT_TAKEDOWN_POINTS]);
  const spec = buildCombatSpecBlock([...(worstStrike ? [worstStrike] : []), ...(worstTakedownPt ? [worstTakedownPt] : [])].length ? [...(worstStrike ? [worstStrike] : []), ...(worstTakedownPt ? [worstTakedownPt] : [])] : ['cross']);

  const applyBridge = () => {
    if (safety.blocked) { setMsg('🔴 Мост заблокирован: снимите red-флаги в табе безопасности'); return; }
    const data = buildCombatBridgeData({
      weakestStrike: worstStrike, weakestTakedown: worstTakedownPt,
      weakSide: asym.weakSide, barPath: null, neckLevel: num('neck_level'),
      score: score.score, specDayMap: spec.dayMap, blocked: safety.blocked,
    });
    applyToPlanner({ kind: 'weakpoints', label: 'Combat-диагностика', data, source: 'intellectual' });
    try { localStorage.setItem('he_training_planning_track', 'combat'); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'combat' }));
    setMsg('✅ Отправлено в конструктор единоборств');
  };

  const doExport = (fmt: 'html' | 'csv') => {
    const rows = [
      ...strikeDiags.map(d => ({ block: 'Удары', point: d.label, value: `${d.level}: ${d.findings[0] ?? ''}` })),
      ...takedownDiags.map(d => ({ block: 'Тейкдауны', point: d.label, value: `${d.level}: ${d.findings[0] ?? ''}` })),
    ];
    if (fmt === 'html') downloadCombatFile('combat-diagnostics.html', buildCombatDiagnosticsHtml(rows, score.text), 'text/html');
    else downloadCombatFile('combat-diagnostics.csv', buildCombatDiagnosticsCsv(rows), 'text/csv');
  };

  return (
    <div data-combat="hub-root" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      <div data-combat="hub-head" style={{ color: WHITE, fontSize: 17, fontWeight: 800 }}>
        🥋 Диагностика единоборств <span style={{ fontWeight: 400, fontSize: 13 }}>· {score.text}</span>
      </div>
      <div data-combat="hub-tabs" role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} data-combat={`hub-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            style={{ ...BTN, minHeight: 44, background: tab === t.id ? 'rgba(236,72,153,0.35)' : BTN.background }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'strikes' && (
        <div data-combat="tab-strikes" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {COMBAT_STRIKE_POINTS.map(p => (
            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...LBL, minWidth: 110 }}>{COMBAT_STRIKE_LABELS[p as CombatStrikePoint]}</span>
              <input aria-label={`Скорость ${COMBAT_STRIKE_LABELS[p as CombatStrikePoint]} м/с`} inputMode="decimal"
                placeholder="м/с" value={vals[`spd_${p}`] ?? ''} onChange={e => set(`spd_${p}`, e.target.value)} style={NUM} />
              <span style={{ color: WHITE, fontSize: 12 }}>{strikeDiags.find(d => d.point === p)?.findings[0] ?? ''}</span>
            </label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...LBL, minWidth: 110 }}>Импульс кросса (Нс)</span>
            <input aria-label="Импульс кросса Нс" inputMode="decimal" placeholder="Нс"
              value={vals.imp_cross ?? ''} onChange={e => set('imp_cross', e.target.value)} style={NUM} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...LBL, minWidth: 110 }}>Трекер CSV</span>
            <input aria-label="Трекер CSV" placeholder="type,speed …" value={vals.tracker_csv ?? ''} onChange={e => set('tracker_csv', e.target.value)} style={{ ...NUM, width: 220 }} />
            <span style={{ color: WHITE, fontSize: 12 }}>{tracker.total ? `Импорт: ${tracker.total} уд., средняя ${tracker.avgSpeedMs?.toFixed(1) ?? '—'} м/с` : ''}</span>
          </label>
          <div data-combat="strike-school" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <span style={{ ...LBL, fontSize: 14 }}>🥊 Как поставить удар — школа + подсобка</span>
            {COMBAT_SCHOOL_STRIKES.map(s => {
              const card = STRIKE_SCHOOL[s as CombatSchoolStrike];
              const gap = path === 'loop' ? 'path' : asym.verdict === 'fix' ? 'asym' : 'speed';
              const rx = schoolDrillFor(s as CombatSchoolStrike, gap as 'speed' | 'mass' | 'asym' | 'path');
              return (
                <details key={s}>
                  <summary style={{ color: WHITE, fontSize: 13, fontWeight: 700, minHeight: 44 }}>{COMBAT_SCHOOL_LABELS[s as CombatSchoolStrike]}: {card.chain}</summary>
                  <div style={{ color: WHITE, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>Стойка: {card.stance}</span>
                    <span>Ошибки: {card.errors.join('; ')}</span>
                    <span>Чек: {card.checkpoints.join('; ')}</span>
                    <span>Назначение: {rx.text}</span>
                    <span>Зал: {card.assistance.join(', ')}</span>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'takedowns' && (
        <div data-combat="tab-takedowns" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {COMBAT_TAKEDOWN_POINTS.map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ ...LBL, minWidth: 110 }}>{COMBAT_TAKEDOWN_LABELS[p as CombatTakedownPoint]}</span>
              <input aria-label={`Время входа ${COMBAT_TAKEDOWN_LABELS[p as CombatTakedownPoint]} с`} inputMode="decimal" placeholder="вход, с"
                value={vals[`td_time_${p}`] ?? ''} onChange={e => set(`td_time_${p}`, e.target.value)} style={NUM} />
              <input aria-label={`Успешность ${COMBAT_TAKEDOWN_LABELS[p as CombatTakedownPoint]} %`} inputMode="decimal" placeholder="успех, %"
                value={vals[`td_rate_${p}`] ?? ''} onChange={e => set(`td_rate_${p}`, e.target.value)} style={NUM} />
              <span style={{ color: WHITE, fontSize: 12 }}>{takedownDiags.find(d => d.point === p)?.findings[0] ?? ''}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'video' && (
        <div data-combat="tab-video" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={LBL}>Kinovea-CSV траектории кулака (t,x,y). Съёмка строго сбоку.</span>
          <textarea aria-label="Kinovea CSV" placeholder="t,x,y — по строкам" value={csv} onChange={e => setCsv(e.target.value)}
            style={{ minHeight: 96, fontSize: 16, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: WHITE }} />
          {csv.trim() && <span style={{ color: WHITE, fontSize: 13 }}>{analyzeCombatStrikePath(csv).text}</span>}
        </div>
      )}

      {tab === 'safety' && (
        <div data-combat="tab-safety" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ ...LBL, minWidth: 160 }}>Возраст</span>
            <input aria-label="Возраст" inputMode="numeric" value={vals.age ?? ''} onChange={e => set('age', e.target.value)} style={NUM} /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ ...LBL, minWidth: 160 }}>Сотрясения за год</span>
            <input aria-label="Сотрясения за год" inputMode="numeric" value={vals.conc ?? ''} onChange={e => set('conc', e.target.value)} style={NUM} /></label>
          {(['neck_pain:Боль в шее', 'numb:Онемение рук', 'headache:Головная боль после спарринга'] as const).map(([k, l]) => (
            <button key={k} aria-pressed={vals[k] === '1'} data-combat={`safety-${k}`} onClick={() => set(k, vals[k] === '1' ? '' : '1')} style={BTN}>{vals[k] === '1' ? '✅' : '⬜'} {l}</button>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ ...LBL, minWidth: 160 }}>Шея разгибание (кг)</span>
            <input aria-label="Шея разгибание кг" inputMode="decimal" value={vals.neck_kg ?? ''} onChange={e => set('neck_kg', e.target.value)} style={NUM} /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ ...LBL, minWidth: 160 }}>Вес тела (кг)</span>
            <input aria-label="Вес тела кг" inputMode="decimal" value={vals.bw_kg ?? ''} onChange={e => set('bw_kg', e.target.value)} style={NUM} /></label>
          <span style={{ color: WHITE, fontSize: 13 }}>{safety.text}{safety.neckNote ? ` · ${safety.neckNote}` : ''}</span>
        </div>
      )}

      {tab === 'recovery' && (
        <div data-combat="tab-recovery" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ ...LBL, minWidth: 160 }}>ACWR</span>
            <input aria-label="ACWR" inputMode="decimal" value={vals.acwr ?? ''} onChange={e => set('acwr', e.target.value)} style={NUM} />
            <span style={{ color: WHITE, fontSize: 12 }}>{acwr ? ({ low: 'Недогруз', ok: 'Зелёная зона', caution: 'Осторожно', danger: 'Опасно' } as Record<string, string>)[acwr] : ''}</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...LBL, minWidth: 160 }}>Удары L/R (м/с)</span>
            <input aria-label="Удар слева м/с" inputMode="decimal" placeholder="L" value={vals.lr_l ?? ''} onChange={e => set('lr_l', e.target.value)} style={NUM} />
            <input aria-label="Удар справа м/с" inputMode="decimal" placeholder="R" value={vals.lr_r ?? ''} onChange={e => set('lr_r', e.target.value)} style={NUM} />
            <span style={{ color: WHITE, fontSize: 12 }}>{asym.text}</span>
          </div>
          <button aria-pressed={vals.mobility === '1'} data-combat="mobility-ok" onClick={() => set('mobility', vals.mobility === '1' ? '' : '1')} style={BTN}>
            {vals.mobility === '1' ? '✅' : '⬜'} Мобильность проверена (плечо/ТЗС)
          </button>
        </div>
      )}

      {tab === 'summary' && (
        <div data-combat="tab-summary" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ color: WHITE, fontSize: 13 }}>Слабейший удар: {worstStrike ? COMBAT_STRIKE_LABELS[worstStrike] : '—'} · Тейкдаун: {worstTakedownPt ? COMBAT_TAKEDOWN_LABELS[worstTakedownPt] : '—'}</span>
          <span style={{ color: WHITE, fontSize: 13 }}>{coverage.text}</span>
          {top3.map(c => <span key={c.point} style={{ color: WHITE, fontSize: 13 }}>#{c.priority} {c.title} — {c.dose}</span>)}
          <span style={{ color: WHITE, fontSize: 13 }}>{sim.text} · {spec.rationale}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button data-combat="hub-apply" onClick={applyBridge} style={{ ...BTN, minHeight: 52 }}>→ Применить в конструктор</button>
            <button data-combat="hub-export-html" onClick={() => doExport('html')} style={BTN}>Печать (HTML)</button>
            <button data-combat="hub-export-csv" onClick={() => doExport('csv')} style={BTN}>Выгрузка (CSV)</button>
          </div>
          {msg && <span role="status" style={{ color: WHITE, fontSize: 13 }}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

export default CombatDiagnosticsHub;
