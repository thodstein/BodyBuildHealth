/**
 * TrainingLoadCalculator.tsx — полноценный калькулятор тренировочной нагрузки
 * (sRPE → острая/хроническая нагрузка, ACWR, монотонность/strain, Fitness-Fatigue Banister,
 * рекомендации). Источник данных — sRPE-дневник (localStorage), с возможностью ввода сессий.
 */
import React, { useMemo, useState } from 'react';
import { loadSRPESessions, saveSRPESession, clearSRPESessions, type SRPESession } from '../../../engines/pro/srpe-store';
import { trainingLoadReport, sessionLoad } from '../../../engines/pro/training-load.engine';
import { MetricCard, ExpandableCard, SaveButton, PopupNumber } from '../SRCBBScreen_parts/TrainingPopups';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.45 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const, fontSize: 12 };

const ZONE_META: Record<string, { label: string; color: string }> = {
  undertrained: { label: 'Недотренированность', color: '#3b82f6' },
  optimal: { label: 'Оптимальная зона', color: '#22c55e' },
  caution: { label: 'Осторожно', color: '#eab308' },
  dangerous: { label: 'Опасная зона', color: '#ef4444' },
};

export const TrainingLoadCalculator: React.FC = () => {
  const [sessions, setSessions] = useState<SRPESession[]>(() => loadSRPESessions());
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rpe, setRpe] = useState(7);
  const [dur, setDur] = useState(60);
  const [targetChronic, setTargetChronic] = useState(0);

  const reload = () => setSessions(loadSRPESessions());
  const addSession = () => { saveSRPESession({ date, sRPE: rpe, durationMin: dur }); reload(); };
  const clearAll = () => { clearSRPESessions(); reload(); };

  const report = useMemo(() => trainingLoadReport(sessions), [sessions]);
  const last7 = report.dailyLoads.slice(-7);
  const maxLoad = Math.max(1, ...last7.map(d => d.load));

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>📊 Калькулятор тренировочной нагрузки (sRPE / ACWR / Banister)</div>
      <div style={{ ...SMALL, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
        Нагрузка сессии = sRPE × длительность (AU). Острая — EWMA за 7 дней, хроническая — за 28 дней. ACWR — отношение острой к хронической. Монотонность — однообразие недели, strain — общий стресс.
      </div>

      {/* Ввод сессии */}
      <div style={{ background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>➕ Добавить тренировку</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8, alignItems: 'end' }}>
          <div><div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 3 }}>Дата</div><input type="date" value={date} onChange={e => setDate(e.target.value)} style={IN} /></div>
          <PopupNumber label="sRPE (1-10)" value={rpe} min={1} max={10} onChange={v => setRpe(v)} />
          <PopupNumber label="Длит., мин" value={dur} min={5} max={300} suffix=" мин" onChange={v => setDur(v)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SaveButton label="💾 Добавить" savedLabel="✓ Добавлено" onSave={addSession} />
          {sessions.length > 0 && <button onClick={clearAll} style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Очистить</button>}
        </div>
        <div style={{ ...SMALL, marginTop: 6, color: ACCENT }}>Нагрузка сессии: <b>{sessionLoad(rpe, dur)} AU</b></div>
      </div>

      {sessions.length === 0 ? (
        <div style={{ ...SMALL, textAlign: 'center', padding: 20 }}>Нет данных sRPE. Добавьте тренировки выше — система посчитает острую/хроническую нагрузку, ACWR, монотонность и Fitness-Fatigue.</div>
      ) : (
        <>
          {/* ACWR */}
          <MetricCard title="ACWR (острая / хроническая)" icon="⚖️" accent={ZONE_META[report.acwr.zone].color}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Острая (7д)</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{Math.round(report.acwr.acute)}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>AU</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Хроническая (28д)</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{Math.round(report.acwr.chronic)}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>AU</div>
              </div>
              <div style={{ background: ZONE_META[report.acwr.zone].color + '14', borderRadius: 8, padding: 8, textAlign: 'center', border: `1px solid ${ZONE_META[report.acwr.zone].color}44` }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>ACWR</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: ZONE_META[report.acwr.zone].color }}>{report.acwr.ratio.toFixed(2)}</div>
                <div style={{ fontSize: 10, color: ZONE_META[report.acwr.zone].color }}>{ZONE_META[report.acwr.zone].label}</div>
              </div>
            </div>
            {/* ACWR bar */}
            <div style={{ marginTop: 10, position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#3b82f6 0-20%, #22c55e 20-60%, #eab308 60-80%, #ef4444 80-100%)' }}>
              <div style={{ position: 'absolute', top: -3, width: 3, height: 14, background: '#fff', borderRadius: 2, left: `${Math.min(100, Math.max(0, (report.acwr.ratio / 2) * 100))}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}><span>0.0</span><span>0.8</span><span>1.3</span><span>1.5</span><span>2.0</span></div>
          </MetricCard>

          {/* Монотонность / Strain */}
          <MetricCard title="Монотонность и Strain" icon="📈" accent="#a855f7">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <div style={{ ...SMALL, background: 'rgba(168,85,247,0.06)', padding: 6, borderRadius: 8 }}>Нагрузка/нед: <b style={{ color: '#fff' }}>{Math.round(report.monotony.weeklyLoad)}</b></div>
              <div style={{ ...SMALL, background: 'rgba(168,85,247,0.06)', padding: 6, borderRadius: 8 }}>Среднедн.: <b style={{ color: '#fff' }}>{Math.round(report.monotony.meanDailyLoad)}</b></div>
              <div style={{ ...SMALL, background: 'rgba(168,85,247,0.06)', padding: 6, borderRadius: 8 }}>Монотонн.: <b style={{ color: report.monotony.monotony > 2 ? '#ef4444' : '#fff' }}>{report.monotony.monotony.toFixed(2)}</b></div>
              <div style={{ ...SMALL, background: 'rgba(168,85,247,0.06)', padding: 6, borderRadius: 8 }}>Strain: <b style={{ color: '#fff' }}>{Math.round(report.monotony.strain)}</b></div>
            </div>
          </MetricCard>

          {/* Fitness-Fatigue Banister */}
          {report.banister.current && (
            <MetricCard title="Fitness-Fatigue (Banister)" icon="🧬" accent="#60a5fa">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div style={{ background: 'rgba(96,165,250,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Fitness</div><div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>{Math.round(report.banister.current.fitness)}</div></div>
                <div style={{ background: 'rgba(96,165,250,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Fatigue</div><div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444' }}>{Math.round(report.banister.current.fatigue)}</div></div>
                <div style={{ background: 'rgba(96,165,250,0.06)', borderRadius: 8, padding: 8, textAlign: 'center' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Performance</div><div style={{ fontSize: 16, fontWeight: 800, color: report.banister.current.performance >= 0 ? ACCENT : '#ef4444' }}>{Math.round(report.banister.current.performance)}</div></div>
              </div>
              {report.banister.peakPerformanceIdx >= 0 && report.banister.series[report.banister.peakPerformanceIdx] && <div style={{ ...SMALL, marginTop: 6 }}>Пик производительности: {Math.round(report.banister.series[report.banister.peakPerformanceIdx].performance)} ({report.banister.series[report.banister.peakPerformanceIdx].date})</div>}
            </MetricCard>
          )}

          {/* График дневной нагрузки за 7 дней */}
          <MetricCard title="Дневная нагрузка (последние 7 дней)" icon="📊">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 70, padding: '4px 0' }}>
              {last7.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', maxWidth: 28, height: Math.max(2, (d.load / maxLoad) * 56), borderRadius: 4, background: d.load > 0 ? 'linear-gradient(180deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.06)' }} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </MetricCard>

          <div style={{ margin: '0 0 8px',  marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить нагрузку (ACWR {report.acwr.ratio.toFixed(2)} — {ZONE_META[report.acwr.zone].label}) к планировщику: при ACWR {">"}1.5 — объём ×0.8 (делод), {">"}1.3 — ×0.9, {"<"}0.8 — ×1.1.</div>
            <button onClick={() => { const r = report.acwr.ratio; const mult = r > 1.5 ? 0.8 : r > 1.3 ? 0.9 : r < 0.8 ? 1.1 : 1; const rsh = r > 1.5 ? 1 : 0; applyToPlanner({ kind: 'pri', label: 'Нагрузка ACWR ' + r.toFixed(2) + ' → объём ×' + mult, data: { volumeMult: mult, rirShift: rsh } }); }} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить ACWR к планировщику</button>
          </div>
          {/* Рекомендации */}
          <MetricCard title="Рекомендации" icon="🎯" accent="#f59e0b">
            {report.recommendations.map((r, i) => <div key={i} style={{ ...SMALL, marginBottom: 4, padding: '6px 8px', background: 'rgba(245,158,11,0.06)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)' }}>{r}</div>)}
          </MetricCard>

          {/* Тренд недельной нагрузки + целевая нагрузка */}
          {(() => {
            const weeks: { label: string; load: number }[] = [];
            const dl = report.dailyLoads;
            for (let w = 0; w < 4; w++) { const load = (w === 0 ? dl.slice(-7) : dl.slice(-7 - w * 7, -7 - (w - 1) * 7)).reduce((s, d) => s + d.load, 0); weeks.unshift({ label: String(w === 0 ? 'тек.' : '−' + w + 'н'), load: Math.round(load) }); }
            const maxW = Math.max(1, ...weeks.map(x => x.load));
            const target = targetChronic || (report.acwr.chronic || 0);
            const lo = target * 0.8, hi = target * 1.3;
            const inRange = report.acwr.acute >= lo && report.acwr.acute <= hi;
            return <>
              <MetricCard title="Тренд недельной нагрузки (4 нед)" icon="📅" accent="#60a5fa">
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 70, padding: '4px 0' }}>
                  {weeks.map((x, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', maxWidth: 36, height: Math.max(2, (x.load / maxW) * 56), borderRadius: 4, background: i === weeks.length - 1 ? 'linear-gradient(180deg,#00e68a,#00c853)' : 'rgba(96,165,250,0.5)' }} />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{x.label}</span>
                      <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{x.load}</span>
                    </div>
                  ))}
                </div>
              </MetricCard>
              <MetricCard title="Целевая хроническая нагрузка" icon="🎯" accent="#22c55e">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                  <PopupNumber label="Целевой хронич. (AU)" value={targetChronic} min={0} suffix=" AU" hint={'по умолч. ' + String(Math.round(report.acwr.chronic || 0))} onChange={v => setTargetChronic(v)} />
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Рекоменд. острая</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>{Math.round(lo)}–{Math.round(hi)} AU</div>
                  </div>
                </div>
                <div style={{ ...SMALL, padding: '6px 8px', borderRadius: 8, background: inRange ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: '1px solid ' + (inRange ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') }}>
                  {inRange ? '✅ Текущая острая нагрузка в целевом диапазоне.' : `⚠ Текущая острая ${Math.round(report.acwr.acute)} AU вне диапазона ${Math.round(lo)}–${Math.round(hi)}. ` + (report.acwr.acute > hi ? 'Снизить объём на ' + Math.round((1 - hi / report.acwr.acute) * 100) + '%.' : 'Плавно увеличить на ' + Math.round((lo / Math.max(1, report.acwr.acute) - 1) * 100) + '%.')}
                </div>
                {report.acwr.ratio > 1.5 && <div style={{ ...SMALL, marginTop: 6, color: '#ef4444' }}>🚨 ACWR &gt; 1.5 — рекомендуется разгрузочная неделя (объём −40%, RIR 4).</div>}
              </MetricCard>
            </>;
          })()}

          <ExpandableCard title={`Журнал sRPE-сессий (${sessions.length})`} icon="📝" short="Нажмите, чтобы развернуть список записанных тренировок." full={
            <div>
              {sessions.slice().reverse().map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr 0.6fr 0.6fr', gap: 4, fontSize: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.85)' }}>
                  <span>{s.date}</span><span>RPE {s.sRPE}</span><span>{s.durationMin} мин</span><span style={{ color: ACCENT, fontWeight: 700 }}>{sessionLoad(s.sRPE, s.durationMin)} AU</span>
                </div>
              ))}
            </div>
          } />
        </>
      )}
    </div>
  );
};

export default TrainingLoadCalculator;