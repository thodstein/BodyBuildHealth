/** diary-cards.tsx — самодостаточные карточки дневника (вынесены из TrainingDiaryHub). */
import React, { useState } from 'react';
import type { WorkoutLog } from '../../../core/types';
import { epley1RM } from '../../../engines/e1rm';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { getISOWeekNumber, getISOWeekYear } from '../../../engines/workout-logger.engine';
import { loadCheckins } from '../../../engines/mindset-protocol.engine';
import { loadMobilityCheckins } from '../../../engines/mobility-protocol.engine';
import { MiniLineChart, MiniBarChart } from './DiaryChart';
import { diaryStyles as style, ACCENT, DIM } from './diary-tokens';

/* ─── WorkoutWeekCard — неделя с тренировками, дельты e1RM, edit/delete/copy ─── */

export const WorkoutWeekCard: React.FC<{
  weekLabel: string;
  workouts: WorkoutLog[];
  prevWorkouts?: WorkoutLog[];
  expanded: boolean;
  onToggle: () => void;
  onEdit?: (w: WorkoutLog) => void;
  onDelete?: (w: WorkoutLog) => void;
  confirmDeleteId?: string | null;
  onConfirmDelete?: (id: string) => void;
  onCancelDelete?: () => void;
  /** Тренд лучшего e1RM по последним сессиям (для спарклайна в шапке недели). */
  e1rmSeries?: number[];
}> = ({ weekLabel, workouts, prevWorkouts, expanded, onToggle, onEdit, onDelete, confirmDeleteId, onConfirmDelete, onCancelDelete, e1rmSeries }) => {
  const previousByExercise = new Map<string, number>();
  (prevWorkouts || []).forEach(workout => workout.exercises.forEach(exercise => {
    previousByExercise.set(exercise.exerciseId, Math.max(previousByExercise.get(exercise.exerciseId) || 0, exercise.estimated1RM || 0));
  }));
  const totalVol = workouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
  const totalSets = workouts.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.sets.length, 0), 0);
  const prevVol = (prevWorkouts || []).reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
  const isDeload = prevVol > 0 && totalVol > 0 && totalVol / prevVol < 0.55;
  // Бейджи психо-чек-инов и мобильности (ключ: sessionId (id записи) или дата)
  const mindBadge = new Map<string, number>();
  loadCheckins().forEach(c => { if (c.confidence > 0) mindBadge.set(c.sessionId || c.date, c.confidence); });
  const mobBadge = new Set<string>();
  loadMobilityCheckins().forEach(c => { if (c.done) mobBadge.add(c.sessionId || c.date); });
  return (
    <div style={{ ...style.card, borderLeft: isDeload ? '3px solid #f59e0b' : undefined }}>
      <div onClick={onToggle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded ? 6 : 0, cursor: 'pointer', padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          <strong style={{ color: ACCENT, fontSize: 12 }}>{weekLabel}</strong>
          {isDeload && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 700 }}>ДЕЛОУД</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#fff', alignItems: 'center' }}>
          <span>{workouts.length} трен.</span>
          <span>{totalSets} подходов</span>
          <span>{(totalVol / 1000).toFixed(1)}т кг</span>
          {e1rmSeries && e1rmSeries.length >= 2 && (
            <span title="Тренд лучшего e1RM по последним сессиям" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MiniLineChart data={e1rmSeries} width={72} height={20} showDots={false} color="#f59e0b" />
            </span>
          )}
        </div>
      </div>
      {expanded && workouts.map(workout => (
        <div key={workout.id} style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{new Date(workout.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })} · <span style={{ color: '#fff' }}>{workout.split || 'Тренировка'}</span>
              {(() => {
                const key = workout.id || workout.date;
                const m = mindBadge.get(key);
                const mb = mobBadge.has(key);
                if (!m && !mb) return null;
                return (
                  <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6, verticalAlign: 'middle' }}>
                    {m && <span title={`Психо-чек-ин: уверенность ${m}/5`} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 8, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontWeight: 700 }}>🧠 {m}/5</span>}
                    {mb && <span title="Мобильность: рутина/сессия выполнена" style={{ fontSize: 8, padding: '1px 5px', borderRadius: 8, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 700 }}>🧘 ✓</span>}
                  </span>
                );
              })()}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#fff' }}>{Math.round(workout.exercises.reduce((sum, e) => sum + e.totalVolume, 0)).toLocaleString()} кг</span>
              <button onClick={e => { e.stopPropagation(); onEdit?.(workout); }} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa', cursor: 'pointer', fontSize: 10, minWidth: 20 }} title="Редактировать">✏️</button>
              {confirmDeleteId === workout.id ? (
                <span style={{ display: 'flex', gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); onConfirmDelete?.(workout.id); }} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Удалить?</button>
                  <button onClick={e => { e.stopPropagation(); onCancelDelete?.(); }} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 10 }}>✕</button>
                </span>
              ) : (
                <button onClick={e => { e.stopPropagation(); onDelete?.(workout); }} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 10, minWidth: 20 }} title="Удалить">🗑</button>
              )}
              <button onClick={e => { e.stopPropagation(); const lines: string[] = [`${new Date(workout.date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })} — ${workout.split || 'Тренировка'}`, '']; workout.exercises.forEach(ex => { lines.push(ex.exerciseName); ex.sets.forEach((s, i) => { lines.push(`  ${i+1}. ${s.weight}кг × ${s.reps}${s.rir !== undefined ? ` RIR${s.rir}` : ''}`); }); lines.push(''); }); if (workout.overallRPE) lines.push(`RPE: ${workout.overallRPE}`); if (workout.duration) lines.push(`Длительность: ${workout.duration} мин`); if (workout.notes) lines.push(`Заметки: ${workout.notes}`); navigator.clipboard?.writeText(lines.join('\n')); }} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)', cursor: 'pointer', fontSize: 10, minWidth: 20 }} title="Копировать тренировку">📋</button>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
            {workout.exercises.map(exercise => {
              const previous = previousByExercise.get(exercise.exerciseId);
              const current = exercise.estimated1RM || 0;
              const delta = previous && current ? current - previous : null;
              const deltaPct = previous && current && previous > 0 ? Math.round((current - previous) / previous * 100) : null;
              const isPR = delta !== null && delta > 0;
              return (
                <div key={exercise.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                  <span style={{ flex: 1, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exercise.exerciseName}</span>
                  <span style={{ color: '#fff', minWidth: 40, textAlign: 'right' }}>{exercise.sets.length}сет</span>
                  <span style={{ color: '#fff', minWidth: 55, textAlign: 'right' }}>{current ? `${Math.round(current)}` : '—'}</span>
                  {deltaPct !== null && (
                    <span style={{
                      minWidth: 40, textAlign: 'right', fontWeight: 700,
                      color: isPR ? '#22c55e' : delta === 0 ? 'rgba(255,255,255,0.8)' : '#ef4444',
                      fontSize: 10,
                    }}>
                      {isPR ? '+' : ''}{deltaPct}%
                    </span>
                  )}
                  {isPR && <span style={{ fontSize: 8 }}>🏆</span>}
                </div>
              );
            })}
          </div>
          {(workout.overallRPE || workout.duration || workout.notes) && (
            <div style={{ marginTop: 6, padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, fontSize: 9, color: 'rgba(255,255,255,0.9)' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {workout.overallRPE && <span>RPE: <strong style={{ color: '#fff' }}>{workout.overallRPE}</strong></span>}
                {workout.duration && <span>{workout.duration} мин</span>}
                {workout.recoveryBefore && <span>Восст: {workout.recoveryBefore}/5</span>}
              </div>
              {workout.notes && (
                <div style={{ marginTop: 3, color: '#fff', fontStyle: 'italic', lineHeight: 1.3 }}>{workout.notes}</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/* ─── WeeklyTargetsCard — цели недели ─── */

export const WeeklyTargetsCard: React.FC<{ historyWorkouts: WorkoutLog[] }> = ({ historyWorkouts }) => {
  const [targets, setTargets] = useState<{ sessions: number; sets: number; tonnage: number }>(() => {
    try { return JSON.parse(localStorage.getItem('he_weekly_targets') || 'null') || { sessions: 4, sets: 80, tonnage: 5000 }; } catch { return { sessions: 4, sets: 80, tonnage: 5000 }; }
  });
  const today = new Date();
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - today.getDay() + 1); weekStart.setHours(0, 0, 0, 0);
  const thisWeek = historyWorkouts.filter(w => new Date(w.date) >= weekStart);
  const actualSessions = thisWeek.length;
  const actualSets = thisWeek.reduce((s: number, w: any) => s + w.exercises.reduce((sum: number, e: any) => sum + (e.sets?.length || 0), 0), 0);
  const actualTonnage = thisWeek.reduce((s: number, w: any) => s + w.exercises.reduce((sum: number, e: any) => sum + e.totalVolume, 0), 0);
  const pct = (cur: number, goal: number) => Math.min(100, Math.round((cur / Math.max(1, goal)) * 100));
  const saveTarget = (patch: Partial<typeof targets>) => {
    const next = { ...targets, ...patch };
    setTargets(next);
    try { localStorage.setItem('he_weekly_targets', JSON.stringify(next)); } catch {}
  };
  const items = [
    { label: 'Тренировки', actual: actualSessions, target: targets.sessions, unit: 'раз', color: '#00e68a', key: 'sessions' as const },
    { label: 'Сеты', actual: actualSets, target: targets.sets, unit: '', color: '#60a5fa', key: 'sets' as const },
    { label: 'Тоннаж', actual: actualTonnage, target: targets.tonnage, unit: 'кг', color: '#a855f7', key: 'tonnage' as const },
  ];
  return (
    <div style={style.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={style.label}>🎯 Цели недели</div>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Эта неделя</span>
      </div>
      {items.map(item => {
        const p = pct(item.actual, item.target);
        return (
          <div key={item.key} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{item.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: p >= 100 ? '#22c55e' : '#fff' }}>
                  {item.key === 'tonnage' ? (item.actual / 1000).toFixed(1) + 'т' : item.actual}
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}> / {item.key === 'tonnage' ? (item.target / 1000).toFixed(1) + 'т' : item.target}</span>
                </span>
                <input type="number" value={item.target} onChange={e => saveTarget({ [item.key]: Math.max(1, +e.target.value || 1) })}
                  style={{ width: 40, padding: '1px 3px', borderRadius: 3, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 9, textAlign: 'right' }} />
              </div>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p}%`, background: p >= 100 ? '#22c55e' : item.color, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ─── ProgressChartsCard — e1RM + тоннаж по ISO-неделям ─── */

export const ProgressChartsCard: React.FC<{ historyWorkouts: WorkoutLog[] }> = ({ historyWorkouts }) => {
  const byEx: Record<string, { date: string; e1rm: number }[]> = {};
  historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
    const best = (e.sets || []).reduce((m: number, s: any) => Math.max(m, epley1RM(s.weight || 0, s.reps || 0)), 0);
    if (best <= 0) return;
    const name = e.exerciseName || e.exerciseId || '—';
    (byEx[name] = byEx[name] || []).push({ date: w.date, e1rm: Math.round(best) });
  }));
  const top = Object.entries(byEx).map(([n, arr]) => ({ n, arr: arr.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => b.arr.length - a.arr.length).slice(0, 3).filter(x => x.arr.length >= 2);
  const wkMap = new Map<string, { label: string; vol: number }>();
  historyWorkouts.forEach((w: any) => {
    const wn = `${getISOWeekYear(w.date)}-W${getISOWeekNumber(w.date)}`;
    const vol = (w.exercises || []).reduce((s: number, e: any) => s + (e.totalVolume || (e.sets || []).reduce((ss: number, st: any) => ss + (st.weight || 0) * (st.reps || 0), 0)), 0);
    const prev = wkMap.get(wn) || { label: `W${getISOWeekNumber(w.date)}`, vol: 0 };
    prev.vol += vol;
    wkMap.set(wn, prev);
  });
  const wkArr = Array.from(wkMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const colors = ['#00e68a', '#60a5fa', '#a855f7'];
  return (
    <div className="card" style={{ padding: 10, marginTop: 8 }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 12 }}>📈 Прогресс из дневника</h4>
      {top.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Недостаточно данных (нужно ≥2 тренировок на упражнение с весами).</div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>ПМ (e1RM) по топ-упражнениям:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top.map((t, i) => (
              <div key={t.n}>
                <div style={{ fontSize: 10, color: colors[i % colors.length], marginBottom: 2 }}>● {t.n}</div>
                <MiniLineChart
                  data={t.arr.map(p => p.e1rm)}
                  labels={t.arr.map(p => p.date)}
                  color={colors[i % colors.length]}
                  width={300}
                  height={50}
                  ySuffix=" кг"
                />
              </div>
            ))}
          </div>
        </>
      )}
      {wkArr.length >= 2 && (
        <>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, marginBottom: 4 }}>Тоннаж по неделям:</div>
          <MiniBarChart
            data={wkArr.map(([wk, v]) => ({ value: v.vol, label: v.label, color: '#00e68a' }))}
            width={300}
            height={60}
            valueSuffix=" кг"
          />
        </>
      )}
    </div>
  );
};

/* ─── WorkoutComparisonCard — сравнение двух тренировок ─── */

export const WorkoutComparisonCard: React.FC<{ historyWorkouts: WorkoutLog[] }> = ({ historyWorkouts }) => {
  const [cmpA, setCmpA] = useState(0);
  const [cmpB, setCmpB] = useState(1);
  const wA = historyWorkouts[cmpA];
  const wB = historyWorkouts[cmpB];
  if (!wA || !wB) return null;
  const volA = wA.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0);
  const volB = wB.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0);
  const setsA = wA.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
  const setsB = wB.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
  const exA = new Set(wA.exercises.map((e: any) => e.exerciseName));
  const exB = new Set(wB.exercises.map((e: any) => e.exerciseName));
  const shared = [...exA].filter(n => exB.has(n));
  const onlyA = [...exA].filter(n => !exB.has(n));
  const onlyB = [...exB].filter(n => !exA.has(n));
  return (
    <div style={style.card}>
      <div style={style.label}>⚖️ Сравнение тренировок</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <select value={cmpA} onChange={e => setCmpA(+e.target.value)} style={{ ...style.input, flex: 1, fontSize: 10, padding: '4px' }}>
          {historyWorkouts.slice(0, 20).map((w: any, i: number) => <option key={i} value={i}>{(w.date || '').slice(0, 10)} ({w.split || '—'})</option>)}
        </select>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>vs</span>
        <select value={cmpB} onChange={e => setCmpB(+e.target.value)} style={{ ...style.input, flex: 1, fontSize: 10, padding: '4px' }}>
          {historyWorkouts.slice(0, 20).map((w: any, i: number) => <option key={i} value={i}>{(w.date || '').slice(0, 10)} ({w.split || '—'})</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4, fontSize: 10, marginBottom: 4 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#00e68a' }}>{(volA / 1000).toFixed(1)}т</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>объём</div>
        </div>
        <div style={{ color: volA > volB ? '#22c55e' : volA < volB ? '#ef4444' : 'rgba(255,255,255,0.3)', fontSize: 10 }}>
          {volA > volB ? '◀' : volA < volB ? '▶' : '='}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#60a5fa' }}>{(volB / 1000).toFixed(1)}т</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>объём</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#00e68a' }}>{setsA}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>сетов</div>
        </div>
        <div style={{ color: setsA > setsB ? '#22c55e' : setsA < setsB ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>
          {setsA > setsB ? '◀' : setsA < setsB ? '▶' : '='}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#60a5fa' }}>{setsB}</div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>сетов</div>
        </div>
      </div>
      {shared.length > 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>🔄 Совпадение: {shared.join(', ')}</div>}
      {onlyA.length > 0 && <div style={{ fontSize: 9, color: '#00e68a' }}>🟢 Только A: {onlyA.join(', ')}</div>}
      {onlyB.length > 0 && <div style={{ fontSize: 9, color: '#60a5fa' }}>🔵 Только B: {onlyB.join(', ')}</div>}
    </div>
  );
};

/* ─── ExerciseSubstitutionCard — подбор замены по группе ─── */

export const ExerciseSubstitutionCard: React.FC = () => {
  const muscleGroups: Record<string, string[]> = {
    'Грудь': ['Жим штанги лёжа', 'Жим гантелей', 'Разводка кабель', 'Жим в тренажёре', 'Сведение в бабочке', 'Жим на наклонной', 'Отжимания на брусьях'],
    'Спина': ['Тяга штанги в наклоне', 'Тяга верхнего блока', 'Тяга гантели', 'Подтягивания', 'Тяга нижнего блока', 'Гиперэкстензия', 'Тяга в ХМ-тренажёре'],
    'Ноги': ['Приседания со штангой', 'Жим ногами', 'Болгарские сплит-присед', 'Румынская тяга', 'Разгибание ног', 'Сгибание ног', 'Гакк-присед'],
    'Плечи': ['Жим стоя', 'Жим сидя гантелей', 'Разводка в стороны', 'Тяга к подбородку', 'Разведение кабеля', 'Армейский жим', 'Тяга штанги к груди'],
    'Руки': ['Подъём на бицепс', 'Молотки', 'Разгибание на трицепс', 'Французский жим', 'Концентрированный подъём', 'Отжимания на трицепс', 'Экстензия кабель'],
    'Ягодицы': ['Ягодичный мост', 'Гиперэкстензия', 'Отведение ноги', 'Болгарские сплит', 'Румынская тяга', 'Глубокий присед', 'Бедренная экстензия'],
    'Пресс': ['Скручивания', 'Планка', 'Велосипед', 'Подъём ног', 'Кранчи в тренажёре', 'Махи ногами', 'Дровосек'],
  };
  const [selGroup, setSelGroup] = useState('Грудь');
  const [selEx, setSelEx] = useState('');
  const alts = muscleGroups[selGroup] || [];
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {Object.keys(muscleGroups).map(g => (
          <button key={g} onClick={() => { setSelGroup(g); setSelEx(''); }} style={{ padding: '2px 8px', borderRadius: 10, background: selGroup === g ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${selGroup === g ? 'rgba(0,230,138,0.3)' : 'rgba(255,255,255,0.08)'}`, color: selGroup === g ? ACCENT : DIM, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>{g}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {alts.map(ex => (
          <div key={ex} onClick={() => setSelEx(selEx === ex ? '' : ex)} style={{ padding: '5px 8px', borderRadius: 6, background: selEx === ex ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selEx === ex ? 'rgba(0,230,138,0.25)' : 'rgba(255,255,255,0.06)'}`, cursor: 'pointer', fontSize: 10, color: selEx === ex ? ACCENT : 'rgba(255,255,255,0.7)' }}>{ex}</div>
        ))}
      </div>
    </div>
  );
};

/* ─── SectionHeader — разделитель секций ─── */

export const SectionHeader: React.FC<{ icon: string; title: string; hint?: string }> = ({ icon, title, hint }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 2px 6px' }}>
    <span style={{ fontSize: 13 }}>{icon}</span>
    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.2px' }}>{title}</span>
    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
    {hint && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{hint}</span>}
  </div>
);

/* ─── DiaryEmptyState — единое пустое состояние ─── */

export const DiaryEmptyState: React.FC<{
  icon: string;
  title: string;
  description: string;
  onRecord?: () => void;
  onRefresh?: () => void;
}> = ({ icon, title, description, onRecord, onRefresh }) => (
  <div style={{ ...style.card, textAlign: 'center', padding: 24 }}>
    <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12, lineHeight: 1.5 }}>{description}</div>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      {onRecord && (
        <button onClick={onRecord} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--accent)', background: 'rgba(0,230,138,0.1)', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          📝 Записать тренировку
        </button>
      )}
      {onRefresh && (
        <button onClick={onRefresh} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 10, cursor: 'pointer' }}>
          🔄 Обновить
        </button>
      )}
    </div>
  </div>
);

export const WarmupRampCard: React.FC = () => {
  const [wuWeight, setWuWeight] = useState(100);
  const ramp = wuWeight <= 40
    ? [{ pct: 0, w: 0, reps: 15, label: 'Разминка' }]
    : wuWeight <= 80
      ? [{ pct: 50, w: Math.round(wuWeight * 0.5 / 2.5) * 2.5, reps: 10 }, { pct: 70, w: Math.round(wuWeight * 0.7 / 2.5) * 2.5, reps: 6 }, { pct: 85, w: Math.round(wuWeight * 0.85 / 2.5) * 2.5, reps: 3 }]
      : wuWeight <= 140
        ? [{ pct: 40, w: Math.round(wuWeight * 0.4 / 5) * 5, reps: 12 }, { pct: 60, w: Math.round(wuWeight * 0.6 / 5) * 5, reps: 8 }, { pct: 75, w: Math.round(wuWeight * 0.75 / 5) * 5, reps: 5 }, { pct: 85, w: Math.round(wuWeight * 0.85 / 5) * 5, reps: 3 }]
        : [{ pct: 40, w: Math.round(wuWeight * 0.4 / 5) * 5, reps: 12 }, { pct: 55, w: Math.round(wuWeight * 0.55 / 5) * 5, reps: 8 }, { pct: 70, w: Math.round(wuWeight * 0.7 / 5) * 5, reps: 5 }, { pct: 80, w: Math.round(wuWeight * 0.8 / 5) * 5, reps: 3 }, { pct: 90, w: Math.round(wuWeight * 0.9 / 5) * 5, reps: 1 }];
  return (
    <div style={style.card}>
      <div style={style.label}>🔥 Разминочная рампа</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Автоподбор разминки по рабочему весу</div>
      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>Рабочий вес (кг)</label>
        <input type="number" value={wuWeight} onChange={e => setWuWeight(Math.max(0, +e.target.value || 0))} style={{ width: '100%', padding: '4px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'grid', gap: 2 }}>
        {ramp.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '2px 0' }}>
            <span style={{ minWidth: 30, color: i === ramp.length - 1 ? ACCENT : 'rgba(255,255,255,0.4)', fontWeight: i === ramp.length - 1 ? 700 : 400 }}>{r.pct}%</span>
            <span style={{ flex: 1, color: 'rgba(255,255,255,0.6)' }}>{r.w > 0 ? `${r.w}кг` : 'Пустой гриф'}</span>
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>{r.reps} повт</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '3px 0', fontWeight: 700 }}>
          <span style={{ minWidth: 30, color: ACCENT }}>100%</span>
          <span style={{ flex: 1, color: ACCENT }}>{wuWeight}кг × работа</span>
        </div>
      </div>
    </div>
  );
};
