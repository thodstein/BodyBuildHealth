/** GoalsHabitsCard.tsx — цели и привычки (ранее неиспользуемые periodization-designer).
 * REUSE: loadGoals/createGoal/addGoal/updateGoalProgress/getGoalStats,
 * loadHabits/toggleHabit/addCustomHabit/getHabitStats. */
import React, { useState, useMemo, useCallback } from 'react';
import {
  loadGoals, createGoal, addGoal, updateGoalProgress, getGoalStats,
  loadHabits, toggleHabit, addCustomHabit, getHabitStats,
  type TrainingGoal, type DailyHabit,
} from '../../../engines/periodization-designer.engine';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const LABEL: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };

const CAT_RU: Record<TrainingGoal['category'], string> = { strength: 'Сила', hypertrophy: 'Гипертрофия', body_comp: 'Состав тела', performance: 'Результат', health: 'Здоровье', habit: 'Привычка' };
const HC_RU: Record<DailyHabit['category'], string> = { nutrition: 'Питание', training: 'Тренировки', recovery: 'Восстановление', mindset: 'Мышление', health: 'Здоровье' };

export const GoalsHabitsCard: React.FC = () => {
  const [goals, setGoals] = useState<TrainingGoal[]>(() => loadGoals());
  const [habits, setHabits] = useState<DailyHabit[]>(() => loadHabits());
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => { setGoals(loadGoals()); setHabits(loadHabits()); setTick(t => t + 1); }, []);

  const [ntitle, setNtitle] = useState('');
  const [ncat, setNcat] = useState<TrainingGoal['category']>('strength');
  const [ntarget, setNtarget] = useState(100);
  const [nunit, setNunit] = useState('кг');
  const [ndate, setNdate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().slice(0, 10); });
  const [habitName, setHabitName] = useState('');
  const [habitCat, setHabitCat] = useState<DailyHabit['category']>('recovery');

  const gStats = useMemo(() => getGoalStats(), [tick]);
  const hStats = useMemo(() => getHabitStats(), [tick]);

  const addNewGoal = () => { if (!ntitle.trim()) return; addGoal(createGoal(ntitle, ncat, ntarget, nunit, ndate)); setNtitle(''); refresh(); };
  const updProgress = (id: string, v: number) => { updateGoalProgress(id, v); refresh(); };
  const toggle = (id: string) => { toggleHabit(id); refresh(); };
  const addHabit = () => { if (!habitName.trim()) return; addCustomHabit(habitName, habitCat, 'ежедневно'); setHabitName(''); refresh(); };

  const statusColor = (s: TrainingGoal['status']) => s === 'achieved' ? '#22c55e' : s === 'failed' || s === 'abandoned' ? '#ef4444' : s === 'in_progress' ? '#eab308' : DIM;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🎯 Цели и привычки</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        Постановка целей (сила/гипертрофия/состав/здоровье) с прогрессом и трекинг ежедневных привычек. Ранее подсистема целей/привычек periodization-designer не использовалась в UI.
      </div>

      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={H}>🎯 Цели</div>
          <div style={{ fontSize: 10, color: DIM }}>всего {gStats.total} · достигнуто {gStats.achieved} · в работе {gStats.inProgress}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
          <input style={IN} placeholder="название цели" value={ntitle} onChange={e => setNtitle(e.target.value)} />
          <select style={{ ...IN }} value={ncat} onChange={e => setNcat(e.target.value as any)}>
            {Object.entries(CAT_RU).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input type="number" style={IN} placeholder="цель" value={ntarget} onChange={e => setNtarget(parseFloat(e.target.value) || 0)} />
          <input style={IN} placeholder="ед." value={nunit} onChange={e => setNunit(e.target.value)} />
          <input type="date" style={IN} value={ndate} onChange={e => setNdate(e.target.value)} />
        </div>
        <button onClick={addNewGoal} style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 700, fontSize: 12, marginBottom: 10, cursor: 'pointer' }}>+ Добавить цель</button>
        {goals.length === 0
          ? <div style={{ fontSize: 10, color: DIM }}>Целей пока нет.</div>
          : goals.map(g => (
            <div key={g.id} style={{ padding: 10, marginBottom: 6, borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{g.title}</span>
                <span style={{ fontSize: 9, color: statusColor(g.status), fontWeight: 700 }}>{g.status}</span>
              </div>
              <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>{CAT_RU[g.category]} · цель {g.targetValue} {g.unit} до {g.targetDate}</div>
              <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ width: Math.min(100, g.progress) + '%', height: '100%', background: g.progress >= 100 ? '#22c55e' : '#00e68a' }} />
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: DIM }}>текущий:</span>
                <input type="number" style={{ ...IN, width: 90, padding: '4px 6px', fontSize: 11 }} value={g.currentValue} onChange={e => updProgress(g.id, parseFloat(e.target.value) || 0)} />
                <span style={{ fontSize: 9, color: DIM }}>{g.unit} ({g.progress}%)</span>
              </div>
            </div>
          ))}
      </div>

      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={H}>✅ Привычки</div>
          <div style={{ fontSize: 10, color: DIM }}>сегодня {hStats.todayCompleted}/{hStats.todayTotal} · нед. {hStats.weekCompletionRate}%</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 6, marginBottom: 10 }}>
          <input style={IN} placeholder="название привычки" value={habitName} onChange={e => setHabitName(e.target.value)} />
          <select style={{ ...IN }} value={habitCat} onChange={e => setHabitCat(e.target.value as any)}>
            {Object.entries(HC_RU).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <button onClick={addHabit} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, fontWeight: 700, fontSize: 12, marginBottom: 10, cursor: 'pointer' }}>+ Добавить привычку</button>
        {habits.map(h => {
          const todayDone = h.completions.some(c => c.date === new Date().toISOString().slice(0, 10) && c.done);
          return (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 4, borderRadius: 6, background: todayDone ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)' }}>
              <button onClick={() => toggle(h.id)} style={{ width: 28, height: 28, borderRadius: 8, border: todayDone ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.15)', background: todayDone ? '#22c55e' : 'transparent', color: todayDone ? '#000' : DIM, cursor: 'pointer', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{todayDone ? '✓' : ''}</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#fff' }}>{h.name}</div>
                <div style={{ fontSize: 9, color: DIM }}>{HC_RU[h.category]} · серия {h.streak} (лучшая {h.bestStreak}) · {h.completionRate}% за 30д</div>
              </div>
            </div>
          );
        })}
        {hStats.bestHabit && <div style={{ fontSize: 9, color: ACCENT, marginTop: 6 }}>Лучшая: {hStats.bestHabit.name} ({hStats.bestHabit.streak} дн.)</div>}
      </div>
    </div>
  );
};
