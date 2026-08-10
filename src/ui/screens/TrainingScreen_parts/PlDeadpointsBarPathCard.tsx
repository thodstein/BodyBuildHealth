import React, { useMemo, useState } from 'react';
import { barPathAnalysis, diagnoseLift, stickingPhases, type BarPathIssue } from '../../../engines/pro/lift-diagnostics.engine';
import type { Lift, WeakPoint } from '../../../engines/lms/weakpoint-pl';
import { applyToPlanner } from './planner-bridge';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.55)';
const LIFT_RU: Record<string, string> = { squat: 'Присед', bench: 'Жим лёжа', deadlift: 'Становая тяга' };
const ISSUE_RU: Record<BarPathIssue, string> = {
  forward_drift: 'Уход штанги вперёд',
  hips_shoot_up: 'Таз выстреливает вверх',
  good_morning: 'Good-morning присед',
  bar_loops: 'Петлеобразная траектория',
  asymmetric: 'Асимметрия сторон',
};
const BAR_PATH_EXERCISES: Record<BarPathIssue, string[]> = {
  forward_drift: ['Румынская тяга', 'Наклоны'],
  hips_shoot_up: ['Присед на груди', 'Присед с паузой'],
  good_morning: ['Присед на груди', 'Болгарские сплит-приседы'],
  bar_loops: ['Скоростной жим', 'Присед с остановками'],
  asymmetric: ['Выпады', 'Болгарские сплит-приседы'],
};

const CARD: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: 'rgba(24,24,27,0.45)',
  border: '1px solid rgba(255,255,255,0.08)',
  marginTop: 8,
};

export const PlDeadpointsBarPathCard: React.FC<{ dayCount?: number }> = ({ dayCount = 7 }) => {
  const [lift, setLift] = useState<Lift>('squat');
  const [phase, setPhase] = useState('');
  const [issues, setIssues] = useState<BarPathIssue[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [days, setDays] = useState<Record<string, number[]>>({});
  const phases = useMemo(() => stickingPhases(lift), [lift]);
  const diagnosis = useMemo(() => phase ? diagnoseLift(lift, phase as WeakPoint) : null, [lift, phase]);
  const barPath = useMemo(() => issues.length ? barPathAnalysis(lift, issues) : null, [lift, issues]);

  const changeLift = (value: Lift) => {
    setLift(value);
    setPhase('');
    setIssues([]);
  };
  const toggleExercise = (key: string, name: string) => setSelected(current => {
    const values = new Set(current[key] || []);
    if (values.has(name)) values.delete(name); else values.add(name);
    return { ...current, [key]: [...values] };
  });
  const toggleDay = (key: string, day: number) => setDays(current => {
    const values = new Set(current[key] || []);
    if (values.has(day)) values.delete(day); else values.add(day);
    return { ...current, [key]: [...values].sort((a, b) => a - b) };
  });
  const setAutoDays = (key: string) => setDays(current => {
    if (!(key in current)) return current;
    const next = { ...current };
    delete next[key];
    return next;
  });
  const applySelected = () => applyToPlanner({
    kind: 'weakpoints',
    label: 'Мёртвые точки/bar-path: выбранные ассистенты',
    data: { diagnosticExerciseMap: selected, diagnosticDayMap: days },
  });

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>🎯 Мёртвые точки и bar-path</div>
      <div style={{ fontSize: 10, color: DIM, marginTop: 3, lineHeight: 1.45 }}>
        Тот же источник данных, что и в «Диагностика → Биомеханика+Bar-path». Выберите движение,
        фазу срыва и отклонения траектории, чтобы получить готовые коррекции для ПЛ-цикла.
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {(Object.keys(LIFT_RU) as Lift[]).map(item => (
          <button key={item} onClick={() => changeLift(item)} style={{ flex: 1, minHeight: 40, borderRadius: 8, cursor: 'pointer', border: lift === item ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.1)', background: lift === item ? 'rgba(0,230,138,0.12)' : 'transparent', color: lift === item ? ACCENT : DIM, fontWeight: 700, fontSize: 11 }}>
            {LIFT_RU[item]}
          </button>
        ))}
      </div>

      <div style={CARD}>
        <label style={{ display: 'block', fontSize: 10, color: DIM }}>
          Мёртвая точка / слабая фаза
          <select value={phase} onChange={event => setPhase(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 40, borderRadius: 7, padding: 8, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
            <option value="">Выберите фазу...</option>
            {phases.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {diagnosis && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, color: ACCENT, fontSize: 12 }}>{LIFT_RU[lift]} · {diagnosis.phaseLabel}</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 5 }}>📐 Угол: {diagnosis.angleRangeDeg[0]}°–{diagnosis.angleRangeDeg[1]}° · сустав: {diagnosis.keyJoint}</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>🧠 Биомеханика: {diagnosis.biomechanicalReason}</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>💪 Слабые мышцы: {diagnosis.weakMuscles.join(', ')}</div>
            <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, marginTop: 7 }}>Коррекции из диагностики:</div>
            {diagnosis.corrections.map((item, index) => <div key={index} style={{ fontSize: 10, color: DIM, marginTop: 2 }}>• {item}</div>)}
            <div style={{ fontSize: 10, color: '#60a5fa', marginTop: 7 }}>🏋️ Ассистенты: {diagnosis.assistance.join(', ') || 'нет данных'} · {Math.round(diagnosis.assistanceIntensityPct * 100)}% ПМ</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>💡 Load cue: {diagnosis.loadCues}</div>
            <DiagnosticExercisePicker label="Ассистенты мёртвой точки" exerciseKey={`${lift}|${phase}`} names={diagnosis.assistance} selected={selected} days={days} dayCount={dayCount} onExercise={toggleExercise} onDay={toggleDay} onAuto={setAutoDays} />
          </div>
        )}
      </div>

      <div style={CARD}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#a855f7' }}>📊 Bar-path отклонения</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
          {(Object.keys(ISSUE_RU) as BarPathIssue[]).map(issue => {
            const selected = issues.includes(issue);
            return <button key={issue} onClick={() => setIssues(current => selected ? current.filter(item => item !== issue) : [...current, issue])} style={{ minHeight: 36, padding: '5px 8px', borderRadius: 7, cursor: 'pointer', border: selected ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: selected ? 'rgba(168,85,247,0.14)' : 'transparent', color: selected ? '#c084fc' : DIM, fontSize: 10 }}>{ISSUE_RU[issue]}</button>;
          })}
        </div>
        {barPath && <div style={{ marginTop: 8 }}>{barPath.diagnoses.map(item => <div key={item.issue} style={{ fontSize: 10, color: DIM, marginTop: 5 }}><b style={{ color: '#c084fc' }}>{ISSUE_RU[item.issue]}:</b> {item.cause} <span style={{ color: ACCENT }}>→ {item.correction}</span></div>)}</div>}
        {issues.map(issue => <DiagnosticExercisePicker key={issue} label={`Ассистенты bar-path: ${ISSUE_RU[issue]}`} exerciseKey={`${lift}|barpath|${issue}`} names={BAR_PATH_EXERCISES[issue]} selected={selected} days={days} dayCount={dayCount} onExercise={toggleExercise} onDay={toggleDay} onAuto={setAutoDays} />)}
      </div>

      <button onClick={applySelected} style={{ width: '100%', minHeight: 44, marginTop: 8, border: 'none', borderRadius: 9, cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800 }}>
        🛠 Добавить выбранные упражнения в ПЛ-авто
      </button>

      <div style={{ marginTop: 8, padding: 9, borderRadius: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#fbbf24', fontSize: 10, lineHeight: 1.45 }}>
        Правило ПЛ-авто: исходные упражнения и процентовки цикла не меняются. Эти данные используются для выбора дополнительных ассистентов и корректирующих упражнений.
      </div>
    </div>
  );
};

const DiagnosticExercisePicker: React.FC<{
  label: string; exerciseKey: string; names: string[]; selected: Record<string, string[]>;
  days: Record<string, number[]>; dayCount: number; onExercise: (key: string, name: string) => void;
  onDay: (key: string, day: number) => void; onAuto: (key: string) => void;
}> = ({ label, exerciseKey, names, selected, days, dayCount, onExercise, onDay, onAuto }) => (
  <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,.05)', border: '1px solid rgba(0,230,138,.15)' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>{label}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
      {names.map(name => <button key={name} onClick={() => onExercise(exerciseKey, name)} style={{ padding: '4px 7px', borderRadius: 7, cursor: 'pointer', fontSize: 10, border: selected[exerciseKey]?.includes(name) ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,.1)', background: selected[exerciseKey]?.includes(name) ? 'rgba(0,230,138,.15)' : 'transparent', color: selected[exerciseKey]?.includes(name) ? ACCENT : DIM }}>{name}{selected[exerciseKey]?.includes(name) ? ' ✓' : ''}</button>)}
    </div>
    <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: DIM }}>Дни (пусто = авто):</span>
      <button onClick={() => onAuto(exerciseKey)} style={{ padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: !days[exerciseKey]?.length ? '1px solid #a855f7' : '1px solid rgba(255,255,255,.1)', background: !days[exerciseKey]?.length ? 'rgba(168,85,247,.15)' : 'transparent', color: !days[exerciseKey]?.length ? '#c084fc' : DIM }}>Авто</button>
      {Array.from({ length: Math.max(1, dayCount) }, (_, index) => index + 1).map(day => <button key={day} onClick={() => onDay(exerciseKey, day)} style={{ padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: days[exerciseKey]?.includes(day) ? '1px solid #a855f7' : '1px solid rgba(255,255,255,.1)', background: days[exerciseKey]?.includes(day) ? 'rgba(168,85,247,.15)' : 'transparent', color: days[exerciseKey]?.includes(day) ? '#c084fc' : DIM }}>Д{day}</button>)}
    </div>
  </div>
);

export default PlDeadpointsBarPathCard;
