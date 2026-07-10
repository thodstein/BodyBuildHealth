/** PriRepPatternCard.tsx — PRI-авторегуляция + выбор схемы повторений (ранее неиспользуемые).
 * REUSE autoregulation.engine (calculatePRI/getPRIThreshold/getAutoregulationRecommendation),
 * rep-pattern.engine (selectRepPattern). */
import React, { useState, useMemo } from 'react';
import { calculatePRI, getPRIThreshold, autoregulate, getAutoregulationRecommendation, type AutoregulationInput } from '../../../engines/autoregulation.engine';
import { selectRepPattern } from '../../../engines/rep-pattern.engine';
import { applyToPlanner } from './planner-bridge';
import type { ReadinessScores, MovementPattern } from '../../../core/types';
import type { CycleWeekPlan } from '../../../engines/cycle-types.engine';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };
const H: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: ACCENT, margin: '0 0 8px' };
const LABEL: React.CSSProperties = { fontSize: 10, color: DIM, margin: '6px 0 3px', fontWeight: 700 };
const IN: React.CSSProperties = { background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
const SEL = (e?: React.CSSProperties): React.CSSProperties => ({ ...IN, ...e });

const PATTERNS: MovementPattern[] = ['squat', 'hinge', 'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'lunge', 'carry'];
const PAT_RU: Record<string, string> = { squat: 'Присед', hinge: 'Тяга', horizontal_push: 'Жим г.', horizontal_pull: 'Тяга г.', vertical_push: 'Жим в.', vertical_pull: 'Тяга в.', lunge: 'Выпад', carry: 'Носка' };

export const PriRepPatternCard: React.FC = () => {
  const [recovery, setRecovery] = useState(70);
  const [fatigue, setFatigue] = useState(30);
  const [doms, setDoms] = useState(3);
  const [sleep, setSleep] = useState(7);
  const [stress, setStress] = useState(5);
  const [goal, setGoal] = useState('strength');
  const [pattern, setPattern] = useState<MovementPattern>('squat');
  const [diff, setDiff] = useState('medium');
  const [techIssues, setTechIssues] = useState('');

  const readiness: ReadinessScores = useMemo(() => ({ recovery, fatigue, nutrition: 80, support: 80, sleep, stress }), [recovery, fatigue, sleep, stress]);
  const pri = useMemo(() => calculatePRI(readiness, doms, sleep, stress), [readiness, doms, sleep, stress]);
  const thr = useMemo(() => getPRIThreshold(pri), [pri]);
  const [applied, setApplied] = useState(false);
  const applyPri = () => { applyToPlanner({ kind: 'pri', label: `PRI ×${thr.volumeMod} (${thr.label})`, data: { volumeMult: thr.volumeMod, rirShift: thr.rirAdd } }); setApplied(true); setTimeout(() => setApplied(false), 2500); };
  const auto = useMemo(() => {
    try {
      const plannedWeek: CycleWeekPlan = { week: 1, phase: 'accumulation', phaseWeek: 1, volumeMultiplier: 1, intensityMultiplier: 1, rirBase: 2, rirPhase: 'base', isDeload: false, progressionType: 'linear' };
      const input: AutoregulationInput = {
        readiness, trainingLoadRatio: 1, plannedWeek, plannedExercises: [], goal, level: 'intermediate', weakPoints: [], doms, sleepQuality: sleep, stress,
      };
      return autoregulate(input);
    } catch (e) { return null; }
  }, [readiness, goal, doms, sleep, stress]);
  const rec = useMemo(() => auto ? getAutoregulationRecommendation(auto) : '', [auto]);
  const repPat = useMemo(() => selectRepPattern(goal, pattern, diff, techIssues.split(',').map(s => s.trim()).filter(Boolean), {}), [goal, pattern, diff, techIssues]);

  const Slider = (label: string, val: number, set: (n: number) => void, min = 0, max = 10) => (
    <div><div style={LABEL}>{label}</div>
      <input type="range" min={min} max={max} value={val} onChange={e => set(parseFloat(e.target.value))} style={{ width: '100%', accentColor: ACCENT }} />
      <div style={{ textAlign: 'center', fontSize: 10, color: DIM }}>{val}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={H}>🧠 PRI-авторегуляция + схема повторений</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 10 }}>
        PRI (Physiological Readiness Index) — готовность к тренировке; схема повторений по цели/паттерну/сложности. Ранее autoregulation.engine/rep-pattern не использовались в UI.
      </div>

      <div style={CARD}>
        <div style={H}>⚙️ Ввод готовности</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8 }}>
          {Slider('Восст.', recovery, setRecovery, 0, 100)}
          {Slider('Усталость', fatigue, setFatigue, 0, 100)}
          {Slider('DOMS', doms, setDoms, 0, 10)}
          {Slider('Сон', sleep, setSleep, 0, 10)}
          {Slider('Стресс', stress, setStress, 0, 10)}
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>📊 PRI: {pri} — {thr.label}</div>
        <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: pri + '%', height: '100%', background: pri >= 70 ? '#22c55e' : pri >= 50 ? '#eab308' : '#ef4444' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
          <div><b style={{ color: ACCENT }}>Множитель объёма:</b> ×{thr.volumeMod}</div>
          <div><b style={{ color: ACCENT }}>Добавка RIR:</b> +{thr.rirAdd}</div>
          <div><b style={{ color: ACCENT }}>Пропуск тренировки:</b> {thr.skipTraining ? 'да' : 'нет'}</div>
          <div><b style={{ color: ACCENT }}>Режим:</b> {thr.desc}</div>
        </div>
        {rec && <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', fontSize: 10, color: '#60a5fa' }}><b>Рекомендация:</b> {rec}</div>}
        {auto && auto.recommendations.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {auto.recommendations.slice(0, 5).map((r, i) => <div key={i} style={{ fontSize: 9, color: DIM, marginTop: 2 }}>• {r}</div>)}
          </div>
        )}
      </div>

      <div style={CARD}>
        <div style={H}>🔢 Схема повторений</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><div style={LABEL}>Цель</div>
            <select style={SEL()} value={goal} onChange={e => setGoal(e.target.value)}>
              {['strength', 'hypertrophy', 'powerbuilding', 'rehab', 'conditioning', 'technique'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div><div style={LABEL}>Паттерн</div>
            <select style={SEL()} value={pattern} onChange={e => setPattern(e.target.value as MovementPattern)}>
              {PATTERNS.map(p => <option key={p} value={p}>{PAT_RU[p] || p}</option>)}
            </select>
          </div>
          <div><div style={LABEL}>Сложность</div>
            <select style={SEL()} value={diff} onChange={e => setDiff(e.target.value)}>
              {['easy', 'medium', 'hard', 'advanced'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div><div style={LABEL}>Технические проблемы (через запятую)</div><input style={IN} value={techIssues} onChange={e => setTechIssues(e.target.value)} placeholder="напр. rounding" /></div>
        <div style={{ marginTop: 10, background: 'rgba(0,230,138,0.05)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{repPat.pattern}</div>
          <div style={{ fontSize: 11, color: '#fff' }}>{repPat.minReps}–{repPat.maxReps} повторений{repPat.restBetweenRepsSec ? ` · пауза между повт ${repPat.restBetweenRepsSec}с` : ''}</div>
          {repPat.pauseSec ? <div style={{ fontSize: 10, color: DIM }}>пауза: {repPat.pauseSec}с{repPat.pausePosition ? ' (' + repPat.pausePosition + ')' : ''}</div> : null}
        </div>
      </div>

      <div style={{ marginTop: 6, padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.2)' }}>
        <div style={{ fontSize: 10, color: DIM, marginBottom: 8 }}>🔗 Применить PRI к активному планировщику (ПЛ/ББ/ручной): объём ×{thr.volumeMod}, RIR +{thr.rirAdd}. Планировщик покажет баннер и пересчитает план.</div>
        <button onClick={applyPri} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13, minHeight: 44 }}>{applied ? '✓ Отправлено в планировщик' : '🛠 Применить к планировщику'}</button>
      </div>
    </div>
  );
};
