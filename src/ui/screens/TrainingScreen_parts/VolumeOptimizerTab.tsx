/**
 * VolumeOptimizerTab.tsx — подвкладка «Расчёт объёма и оптимизация».
 * Пользователь вводит свою программу (мышца + подходы), система сравнивает
 * с объёмными ориентирами MEV/MAV/MRV, выдаёт рекомендации и предлагает
 * замену/добавление упражнений из каталога.
 */
import React, { useMemo, useState } from 'react';
import { getVolumeReferences } from '../../../engines/training-methodology.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { PopupSelect, PopupNumber, ExpandableCard, MetricCard } from '../SRCBBScreen_parts/TrainingPopups';

const ACCENT = '#00e68a';
const CARD: React.CSSProperties = { background: 'rgba(24,24,27,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)', padding: 12, margin: '6px 0' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const H: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' };

interface Row { id: string; muscle: string; sets: number; }

const statusFor = (sets: number, lvl: { mev: number; mav: number; mrv: number }) => {
  if (sets === 0) return { label: 'Не тренируется', color: '#64748b', action: 'Добавить упражнения на эту группу — ниже дефицит объёма.' };
  if (sets < lvl.mev) return { label: 'Недостаточный объём', color: '#3b82f6', action: 'Ниже MEV — группа не получает стимула к росту. Увеличьте до MEV–MAV.' };
  if (sets <= lvl.mav) return { label: 'Оптимально (рост)', color: '#22c55e', action: 'Объём в зоне адаптации (MAV) — оптимально для прогресса.' };
  if (sets <= lvl.mrv) return { label: 'Высокий объём', color: '#eab308', action: 'В зоне между MAV и MRV — близко к пределу восстановления. Контролируйте усталость.' };
  return { label: 'Перегрузка (>MRV)', color: '#ef4444', action: 'Превышен MRV — риск перетренированности. Снизьте объём или сделайте разгрузку.' };
};

export const VolumeOptimizerTab: React.FC = () => {
  const refs = useMemo(() => getVolumeReferences(), []);
  const muscleNames = useMemo(() => refs.map(r => r.muscle), [refs]);
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [rows, setRows] = useState<Row[]>([
    { id: 'r1', muscle: 'Грудь', sets: 12 },
    { id: 'r2', muscle: 'Широчайшие / Спина', sets: 14 },
    { id: 'r3', muscle: 'Квадрицепсы', sets: 12 },
  ]);
  const [muscleToAdd, setMuscleToAdd] = useState(muscleNames[0]);
  const [setsToAdd, setSetsToAdd] = useState(10);

  const perMuscle = useMemo(() => {
    const totals: Record<string, number> = {};
    rows.forEach(r => { totals[r.muscle] = (totals[r.muscle] || 0) + r.sets; });
    return refs.map(r => {
      const sets = totals[r.muscle] || 0;
      const lvl = r[level];
      const st = statusFor(sets, lvl);
      return { ref: r, sets, lvl, ...st };
    });
  }, [rows, refs, level]);

  const issues = perMuscle.filter(p => p.sets === 0 || p.sets < p.lvl.mev || p.sets > p.lvl.mrv);
  const totalSets = rows.reduce((s, r) => s + r.sets, 0);
  const optimalCount = perMuscle.filter(p => p.sets >= p.lvl.mev && p.sets <= p.lvl.mav).length;

  const addRow = () => { setRows(prev => [...prev, { id: 'r' + Date.now(), muscle: muscleToAdd, sets: setsToAdd }]); };
  const updRow = (id: string, field: 'muscle' | 'sets', val: any) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const delRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const suggestionsFor = (muscle: string) => {
    const ref = refs.find(r => r.muscle === muscle);
    return ref?.bestExercises || [];
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>📐 Расчёт тренировочного объёма и оптимизация</div>
      <div style={{ ...SMALL, marginBottom: 10 }}>Введите свою программу — система сравнит объём по группам с ориентирами MEV/MAV/MRV и подскажет, что увеличить, снизить или заменить.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <PopupSelect label="Уровень спортсмена" value={level} onChange={v => setLevel(v as any)} options={[['beginner','Новичок'],['intermediate','Средний'],['advanced','Продвинутый']].map(([id,label]) => ({ id, label }))} />
      </div>

      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>📝 Ваша программа</div>
        {rows.map(r => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <select value={r.muscle} onChange={e => updRow(r.id, 'muscle', e.target.value)} style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box', fontSize: 11 }}>
              {muscleNames.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="number" min={0} max={50} value={r.sets} onChange={e => updRow(r.id, 'sets', +e.target.value)} style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box', fontSize: 11, textAlign: 'center' }} />
            <button onClick={() => delRow(r.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <select value={muscleToAdd} onChange={e => setMuscleToAdd(e.target.value)} style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box', fontSize: 11 }}>
            {muscleNames.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="number" min={0} max={50} value={setsToAdd} onChange={e => setSetsToAdd(+e.target.value)} style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box', fontSize: 11, textAlign: 'center' }} />
          <button onClick={addRow} style={{ background: ACCENT, color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>＋</button>
        </div>
      </div>

      <MetricCard title={`Анализ программы (${totalSets} подходов всего)`} icon="📊">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ ...SMALL }}>✅ Оптимально: <b style={{ color: '#22c55e' }}>{optimalCount}</b>/{refs.length}</span>
          <span style={{ ...SMALL }}>⚠️ Требует внимания: <b style={{ color: '#eab308' }}>{issues.length}</b></span>
        </div>
      </MetricCard>

      <div style={{ ...H, marginTop: 12 }}>📋 Рекомендации по группам</div>
      {perMuscle.map(p => (
        <ExpandableCard key={p.ref.muscle} title={p.ref.muscle} accent={p.color} short={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span><b style={{ color: p.color }}>{p.label}</b> · {p.sets} подх. (MEV {p.lvl.mev} · MAV {p.lvl.mav} · MRV {p.lvl.mrv})</span>
          </div>
        } full={
          <div>
            <div style={{ marginBottom: 8 }}>{p.action}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>📡 Частота: {p.lvl.frequency}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{p.ref.notes}</div>
            <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: ACCENT }}>🏋️ Рекомендованные упражнения:</div>
            <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
              {suggestionsFor(p.ref.muscle).map(ex => <li key={ex}>{ex}</li>)}
            </ul>
          </div>
        } />
      ))}

      {issues.length > 0 && (
        <MetricCard title="🔧 Оптимизация" icon="🛠️" accent="#f59e0b">
          {issues.map(p => (
            <div key={p.ref.muscle} style={{ ...SMALL, marginBottom: 6, padding: '6px 8px', background: 'rgba(245,158,11,0.06)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)' }}>
              <b style={{ color: '#f59e0b' }}>{p.ref.muscle}:</b> {p.sets === 0 ? 'нет подходов — добавьте ' : p.sets < p.lvl.mev ? `дефицит (+${p.lvl.mev - p.sets} подх. до MEV) — ` : `перегрузка (−${p.sets - p.lvl.mrv} подх. до MRV) — `}
              {p.ref.bestExercises.slice(0, 3).join(', ')}
            </div>
          ))}
        </MetricCard>
      )}

      <div style={{ ...SMALL, marginTop: 10, padding: 8, background: 'rgba(96,165,250,0.06)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.15)' }}>
        <b style={{ color: '#60a5fa' }}>Как читать:</b> MEV — минимальный эффективный объём (ниже — нет роста); MAV — объём адаптации (зона прогресса); MRV — максимальный восстанавливаемый объём (выше — перетренированность). Ориентиры — прямые подходы на группу в неделю.
      </div>
    </div>
  );
};

export default VolumeOptimizerTab;