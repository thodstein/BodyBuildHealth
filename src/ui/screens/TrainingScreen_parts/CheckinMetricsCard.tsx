/** CheckinMetricsCard.tsx — ежедневный чек-ин метрик тела + статистика.
 * REUSE profile-settings.engine (ранее 0% использования в UI).
 * Вес/сон/HRV/вода/шаги/субъективные + тренд веса, серия дней.
 * СИНХРОНИЗАЦИЯ с дневниками Профиля: вес → he_weight_log, сон → he_sleep_diary,
 * пульс → he_bp_diary (при сохранении), и подтягивание оттуда при открытии. */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  getTodayMetric, quickCheckin, loadMetrics, getRollingAverages,
  weightTrend, getAllTimeStats, pullFromProfileDiaries, pushToProfileDiaries,
  type DailyMetrics,
} from '../../../engines/profile-settings.engine';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
const LABEL: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const btn: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 };

export const CheckinMetricsCard: React.FC = () => {
  const today = useMemo(() => getTodayMetric(), []);
  const [form, setForm] = useState<DailyMetrics>(today);
  const [saved, setSaved] = useState(false);
  const [synced, setSynced] = useState(false);
  const stats = useMemo(() => getAllTimeStats(), [saved]);
  const rolling = useMemo(() => getRollingAverages(), [saved]);
  const trend = useMemo(() => weightTrend(7), [saved]);
  const last7 = useMemo(() => loadMetrics().slice(-7).reverse(), [saved]);

  // Синхронизация: подтянуть сегодняшние вес/сон/пульс из дневников Профиля
  const pullDiaries = useCallback(() => {
    const pulled = pullFromProfileDiaries(getTodayMetric());
    setForm(pulled);
    const changed = pulled.weightKg !== getTodayMetric().weightKg || pulled.sleepHours !== getTodayMetric().sleepHours
      || pulled.sleepQuality !== getTodayMetric().sleepQuality || pulled.restingHR !== getTodayMetric().restingHR;
    if (changed) setSynced(true);
    return changed;
  }, []);
  useEffect(() => { pullDiaries(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(<K extends keyof DailyMetrics>(k: K, v: DailyMetrics[K]) => setForm(p => ({ ...p, [k]: v })), []);
  const submit = useCallback(() => {
    quickCheckin(form);
    const pushed = pushToProfileDiaries(form);
    if (pushed.weight || pushed.sleep || pushed.bp) setSynced(true);
    setSaved(s => !s);
  }, [form]);

  const trendColor = trend < 0 ? '#00e68a' : trend > 0 ? '#eab308' : DIM;
  const Metric = ({ label, value, unit, hint }: { label: string; value: number | string; unit?: string; hint?: string }) => (
    <div style={{ background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: DIM }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{value}{unit ? <span style={{ fontSize: 10, color: DIM }}> {unit}</span> : null}</div>
      {hint && <div style={{ fontSize: 10, color: DIM, marginTop: 1 }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>📋 Чек-ин метрик тела</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, color: DIM }}>
          Ежедневная фиксация веса, сна, HRV, воды, шагов и самочувствия. Данные хранятся локально и питают тренды и аналитику.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {synced && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '3px 8px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', color: ACCENT, border: '1px solid rgba(0,230,138,0.3)', whiteSpace: 'nowrap' }}>
              ↔ Синхронизировано с дневниками профиля
            </span>
          )}
          <button onClick={pullDiaries} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 10, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            📥 Из дневников профиля
          </button>
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>📝 Сегодняшний чек-ин</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><div style={LABEL}>Вес, кг</div><input type="number" step="0.1" style={IN} value={form.weightKg || ''} onChange={e => set('weightKg', parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Сон, ч</div><input type="number" step="0.1" style={IN} value={form.sleepHours || ''} onChange={e => set('sleepHours', parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Качество сна (1-5)</div><input type="number" min={1} max={5} style={IN} value={form.sleepQuality || ''} onChange={e => set('sleepQuality', parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>HRV, мс</div><input type="number" style={IN} value={form.hrvMs || ''} onChange={e => set('hrvMs', parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Пульс покоя</div><input type="number" style={IN} value={form.restingHR || ''} onChange={e => set('restingHR', parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Вода, л</div><input type="number" step="0.1" style={IN} value={form.waterLiters || ''} onChange={e => set('waterLiters', parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Шаги</div><input type="number" style={IN} value={form.steps || ''} onChange={e => set('steps', parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Энергия (1-5)</div><input type="number" min={1} max={5} style={IN} value={form.subjectiveEnergy || ''} onChange={e => set('subjectiveEnergy', parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Боль в мышцах (1-5)</div><input type="number" min={1} max={5} style={IN} value={form.subjectiveSoreness || ''} onChange={e => set('subjectiveSoreness', parseFloat(e.target.value) || 0)} /></div>
          <div><div style={LABEL}>Стресс (1-5)</div><input type="number" min={1} max={5} style={IN} value={form.subjectiveStress || ''} onChange={e => set('subjectiveStress', parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div style={LABEL}>Заметка</div>
        <input type="text" style={IN} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="самочувствие, комментарий" />
        <button style={{ ...btn, marginTop: 10 }} onClick={submit}>💾 Сохранить чек-ин</button>
        {saved && <div style={{ fontSize: 10, color: ACCENT, marginTop: 6, textAlign: 'center' }}>✓ Сохранено. Сегодня: {today.date} {synced ? '· вес/сон/пульс записаны в дневники профиля' : ''}</div>}
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🔗 Применить готовность (из чек-ина) к планировщику: сон {form.sleepHours || 0}ч, HRV {form.hrvMs || 0}, боль {form.subjectiveSoreness || 0}/5, стресс {form.subjectiveStress || 0}/5 → корректировка объёма.</div>
          <button onClick={() => { const e = form.subjectiveEnergy || 3; const s = form.subjectiveSoreness || 1; const st = form.subjectiveStress || 1; const mult = (s >= 4 || st >= 4 || e <= 2) ? 0.85 : (s >= 3 || st >= 3 || e <= 3) ? 0.93 : 1; const rsh = s >= 4 ? 1 : 0; applyToPlanner({ kind: 'pri', label: 'Чек-ин: готовность → объём ×' + mult + ', RIR +' + rsh, data: { volumeMult: mult, rirShift: rsh } }); }} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>🛠 Применить готовность к планировщику</button>
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>📊 Тренды (7-дневные средние)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <Metric label="Вес (ср.)" value={rolling.weight.toFixed(1)} unit="кг" />
          <Metric label="Тренд веса" value={(trend >= 0 ? '+' : '') + trend.toFixed(2)} unit="кг/нед" hint={trend < 0 ? '↓ снижение' : trend > 0 ? '↑ рост' : 'стабильно'} />
          <Metric label="Сон (ср.)" value={rolling.sleep.toFixed(1)} unit="ч" />
          <Metric label="HRV (ср.)" value={rolling.hrv.toFixed(0)} unit="мс" />
          <Metric label="Вода (ср.)" value={rolling.water.toFixed(1)} unit="л" />
        </div>
        <div style={{ fontSize: 10, color: trendColor, marginTop: 6 }}>Тренд веса: {(trend >= 0 ? '+' : '') + trend.toFixed(2)} кг/нед</div>
      </div>

      <div style={CARD}>
        <div style={H}>🏆 За всё время</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <Metric label="Дней записей" value={stats.totalDays} />
          <Metric label="Лучшая серия" value={stats.longestStreak} unit="дн" />
          <Metric label="Лучший сон" value={stats.bestSleep.toFixed(1)} unit="ч" />
          <Metric label="Лучший HRV" value={stats.bestHRV.toFixed(0)} unit="мс" />
          <Metric label="Мин. вес" value={stats.lowestWeight.toFixed(1)} unit="кг" />
          <Metric label="Макс. вес" value={stats.highestWeight.toFixed(1)} unit="кг" />
        </div>
      </div>

      {last7.length > 0 && (
        <div style={CARD}>
          <div style={H}>📅 Последние 7 записей</div>
          {last7.map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 10 }}>
              <span style={{ color: ACCENT, fontWeight: 600 }}>{m.date}</span>
              <span style={{ color: DIM }}>вес {m.weightKg || '—'} кг</span>
              <span style={{ color: DIM }}>сон {m.sleepHours || '—'} ч</span>
              <span style={{ color: DIM }}>HRV {m.hrvMs || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
