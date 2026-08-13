/**
 * PlDeadpointsBarPathCard.tsx — ЕДИНЫЙ КАЛЬКУЛЯТОР ДИАГНОСТИКИ ДВИЖЕНИЯ:
 * Мёртвые точки → Слабые точки → Движение штанги (bar-path).
 *
 * Пользователь сам выбирает движение, фазу и отклонения. Для каждого параметра
 * выводится анализ оптимальности упражнений из PL-пула с протоколом из раскладки
 * цикла (rankPLAssistanceForIssue) + SVG-схема траектории. Добавление в ПЛ-авто —
 * одно на выбор / все рекомендуемые / все сразу.
 */
import React, { useMemo, useState } from 'react';
import {
  diagnoseMovement, barPathAnalysis, barPathIssuesForLift, BAR_PATH_ISSUES,
  type BarPathIssue,
} from '../../../engines/pro/lift-diagnostics.engine';
import { analyzePhaseAssistance, analyzeBarPathAssistance, type AssistanceAnalysis } from '../../../engines/pro/lift-assistance.engine';
import type { Lift, WeakPoint } from '../../../engines/lms/weakpoint-pl';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { applyToPlanner } from './planner-bridge';
import { loadTrainingProfile, saveTrainingProfile } from './training-profile';

const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.55)';

const LIFT_RU: Record<Lift, string> = {
  bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга',
  ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга верхнего блока', incline_press: 'Жим на наклонной',
};
const ISSUE_RU: Record<BarPathIssue, string> = {
  forward_drift: 'Уход штанги вперёд',
  hips_shoot_up: 'Таз выстреливает вверх',
  good_morning: 'Good-morning присед',
  bar_loops: 'Петлеобразная траектория',
  asymmetric: 'Асимметрия сторон',
};
/** Русские подписи фаз (слабых точек) — для селектора и схемы. */
const PHASE_RU: Record<string, string> = {
  off_chest: 'Сход со груди', mid: 'Средняя точка', lockout: 'Дожим', start: 'Старт',
  bottom: 'Низ (выход из ямы)', sticking_mid: 'Зависание в середине',
  ohp_start: 'Старт с плеч', ohp_mid: 'Середина', ohp_lockout: 'Дожим вверх',
  row_start: 'Старт (съём)', row_mid: 'Середина', row_squeeze: 'Сведение лопаток',
  pd_top: 'Верх (старт)', pd_mid: 'Середина', pd_squeeze: 'Сведение к груди',
  inc_off: 'Сход с груди (верх)', inc_mid: 'Середина', inc_lockout: 'Дожим',
};
/** Все фазы в порядке, типичном для каждого движения. */
const LIFT_PHASES: Record<Lift, WeakPoint[]> = {
  bench: ['off_chest', 'mid', 'lockout', 'start'],
  squat: ['bottom', 'mid', 'lockout'],
  deadlift: ['start', 'mid', 'lockout'],
  ohp: ['ohp_start', 'ohp_mid', 'ohp_lockout'],
  row: ['row_start', 'row_mid', 'row_squeeze'],
  pulldown: ['pd_top', 'pd_mid', 'pd_squeeze'],
  incline_press: ['inc_off', 'inc_mid', 'inc_lockout'],
};
const LIFT_TO_GROUP: Record<Lift, string> = { bench: 'chest', squat: 'legs', deadlift: 'back', ohp: 'shoulders', row: 'back', pulldown: 'back', incline_press: 'chest' };

const CARD: React.CSSProperties = {
  padding: 12, borderRadius: 10, background: 'rgba(24,24,27,0.45)',
  border: '1px solid rgba(255,255,255,0.08)', marginTop: 8,
};

/** Мини-схема траектории штанги: идеальная линия vs выбранные отклонения.
 *  Клик по зоне фазы выбирает фазу; клик по кривой отклонения — цикл по issues. */
const BarPathSvg: React.FC<{
  lift: Lift;
  issues: BarPathIssue[];
  onIssue: (issue: BarPathIssue) => void;
  onPhase: (phase: WeakPoint) => void;
  activePhase: WeakPoint | '';
  phases: WeakPoint[];
}> = ({ lift, issues, onIssue, onPhase, activePhase, phases }) => {
  const W = 300, H = 170, PAD = 24;
  const cx = W / 2, topY = PAD, botY = H - PAD - 6;
  const path = (pts: [number, number][]): string => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
  const ideal: [number, number][] = lift === 'squat'
    ? [[cx, topY], [cx - 6, topY + (botY - topY) * 0.3], [cx + 5, topY + (botY - topY) * 0.62], [cx, botY]]
    : [[cx, topY], [cx, botY]];
  // Отклонения: смещение кривой по X в зависимости от issues
  const offset = issues.reduce((sum, issue) => {
    switch (issue) {
      case 'forward_drift': return sum + 14;
      case 'hips_shoot_up': return sum + 8;
      case 'good_morning': return sum + 6;
      case 'bar_loops': return sum + 10;
      case 'asymmetric': return sum - 8;
      default: return sum;
    }
  }, 0);
  const deviated = ideal.map((p, i) => {
    if (i === 0) return p;
    const bend = issues.includes('hips_shoot_up') && i === 1 ? -8 : 0;
    return [p[0] + offset + bend, p[1]] as [number, number];
  });
  const phaseZones = phases.length > 0;
  // Циклический выбор отклонения при клике на кривую
  const cycleIssue = () => {
    const all = barPathIssuesForLift(lift);
    if (all.length === 0) return;
    const current = all.findIndex(i => issues.includes(i));
    const next = all[(current + 1) % all.length];
    onIssue(next);
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 340, display: 'block', margin: '0 auto', cursor: 'pointer' }} role="img" aria-label="Схема траектории штанги — клик по зоне выбирает фазу, по кривой — отклонение" onClick={cycleIssue}>
      {/* ось движения */}
      <line x1={PAD} y1={botY} x2={W - PAD} y2={botY} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      <line x1={cx} y1={topY - 8} x2={cx} y2={botY} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4 4" />
      {/* зоны фаз (клик выбирает фазу) */}
      {phaseZones && phases.map((zone, zi) => {
        const y0 = topY + (botY - topY) * (zi / Math.max(1, phases.length));
        const y1 = topY + (botY - topY) * ((zi + 1) / Math.max(1, phases.length));
        const isActive = activePhase === zone;
        return <g key={zone} onClick={e => { e.stopPropagation(); onPhase(zone); }} style={{ cursor: 'pointer' }}>
          <rect x={PAD - 4} y={y0} width={W - 2 * PAD + 8} height={y1 - y0} fill={isActive ? 'rgba(0,230,138,0.12)' : 'rgba(0,230,138,0.03)'} stroke={isActive ? 'rgba(0,230,138,0.4)' : 'transparent'} strokeWidth={1} rx={3} />
          <text x={W - PAD - 2} y={(y0 + y1) / 2 + 3} fontSize={8} fill={isActive ? ACCENT : 'rgba(255,255,255,0.4)'} textAnchor="end">{PHASE_RU[zone] || zone}</text>
        </g>;
      })}
      {/* идеальная линия */}
      <path d={path(ideal)} fill="none" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 3" />
      {/* отклонение (клик — цикл) */}
      {issues.length > 0 && <path d={path(deviated)} fill="none" stroke="#ef4444" strokeWidth={2} />}
      {/* точки */}
      {ideal.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="#22c55e" />)}
      {issues.length > 0 && deviated.map((p, i) => <circle key={'d' + i} cx={p[0]} cy={p[1]} r={2.5} fill="#ef4444" />)}
      <text x={PAD} y={12} fontSize={8} fill="rgba(255,255,255,0.5)">кл.зона = фаза · кл.кривая = отклонение{issues.length ? ` (${issues.map(i => ISSUE_RU[i]).join(', ')})` : ''}</text>
    </svg>
  );
};

export const PlDeadpointsBarPathCard: React.FC<{ dayCount?: number; template?: SRCycleTemplate | null; sessions?: any[] }> = ({ dayCount = 7, template = null, sessions = [] }) => {
  const [lift, setLift] = useState<Lift>('squat');
  const [phase, setPhase] = useState<WeakPoint | ''>('');
  const [issues, setIssues] = useState<BarPathIssue[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [days, setDays] = useState<Record<string, number[]>>({});
  const [savedFocus, setSavedFocus] = useState(false);

  // Авто-пресет из дневника: частые тяжёлые подходы (RPE≥8) в фазе движения — подсказка (не авто-выбор).
  const diaryHint = useMemo(() => {
    if (!sessions.length) return null;
    const LIFT_ALIASES: Record<Lift, string[]> = {
      squat: ['squat', 'присед', 'приседания'],
      bench: ['bench', 'жим', 'жим лёжа', 'bench press'],
      deadlift: ['deadlift', 'тяга', 'становая тяга'],
      ohp: ['overhead press', 'жим стоя', 'ohp', 'military press'],
      row: ['barbell row', 'тяга в наклоне', 'bent over row', 'pendlay row'],
      pulldown: ['pulldown', 'тяга верхнего', 'lat pulldown', 'подтягивания'],
      incline_press: ['incline bench', 'жим на наклонной', 'incline press'],
    };
    const aliases = LIFT_ALIASES[lift] ?? [];
    const phaseCounts: Record<string, number> = {};
    let totalHard = 0;
    for (const w of sessions) {
      for (const e of (w.exercises || [])) {
        const en = (e.exerciseName || e.exerciseId || '').toLowerCase();
        if (!aliases.some(a => en.includes(a))) continue;
        for (const s of (e.sets || [])) {
          const weight = s.weightKg || 0;
          const reps = s.reps || 0;
          const rpe = (s.rpe && s.rpe > 0) ? s.rpe : (s.rir != null ? 10 - s.rir : 0);
          const isHard = rpe >= 8 && weight > 0 && reps > 0;
          if (!isHard) continue;
          totalHard += 1;
          // Фаза по повторениям (эвристика) — только для 3 классических движений
          const cand = reps <= 3 ? 'lockout' : reps <= 5 ? 'mid' : 'bottom';
          const phases = LIFT_PHASES[lift];
          if (phases.includes(cand as WeakPoint)) phaseCounts[cand] = (phaseCounts[cand] || 0) + 1;
        }
      }
    }
    if (totalHard === 0) return null;
    const top = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0];
    return top ? { phase: top[0] as WeakPoint, count: top[1], totalHard } : null;
  }, [sessions, lift]);

  const phases = useMemo(() => (LIFT_PHASES[lift] ?? []).filter(p => {
    const d = diagnoseMovement(lift, p);
    return d.weakPoint.assistance.length > 0 || d.sticking != null;
  }), [lift]);

  // Авто-выбор первой доступной фазы при смене движения — секция видна сразу.
  const effectivePhase = phase || phases[0] || '';

  const movement = useMemo(() => (effectivePhase ? diagnoseMovement(lift, effectivePhase as WeakPoint) : null), [lift, effectivePhase]);
  const applicableIssues = useMemo(() => barPathIssuesForLift(lift), [lift]);
  const barPath = useMemo(() => issues.length ? barPathAnalysis(lift, issues) : null, [lift, issues]);

  // Анализ оптимальности по каждому параметру
  const phaseAnalysis = useMemo<AssistanceAnalysis | null>(() => (effectivePhase ? analyzePhaseAssistance(lift, effectivePhase as WeakPoint, template ?? undefined) : null), [lift, effectivePhase, template]);
  const issueAnalyses = useMemo(() => Object.fromEntries(issues.map(i => [i, analyzeBarPathAssistance(lift, i, template ?? undefined)])), [lift, issues, template]);

  const changeLift = (value: Lift) => { setLift(value); setPhase(''); setIssues([]); setSelected({}); };
  const toggleIssue = (issue: BarPathIssue) => setIssues(cur => cur.includes(issue) ? cur.filter(i => i !== issue) : [...cur, issue]);

  const keyForPhase = `${lift}|${effectivePhase}`;
  const toggleExercise = (key: string, name: string) => setSelected(cur => {
    const values = new Set(cur[key] || []);
    if (values.has(name)) values.delete(name); else values.add(name);
    return { ...cur, [key]: [...values] };
  });
  const toggleDay = (key: string, day: number) => setDays(cur => {
    const values = new Set(cur[key] || []);
    if (values.has(day)) values.delete(day); else values.add(day);
    return { ...cur, [key]: [...values].sort((a, b) => a - b) };
  });
  const setAutoDays = (key: string) => setDays(cur => { const next = { ...cur }; delete next[key]; return next; });

  const addToPlan = (key: string, names: string[]) => {
    if (!names.length) return;
    setSelected(cur => ({ ...cur, [key]: [...new Set([...(cur[key] || []), ...names])] }));
  };
  const applySelected = () => applyToPlanner({
    kind: 'weakpoints',
    label: 'Диагностика движения: выбранные ассистенты',
    data: { diagnosticExerciseMap: selected, diagnosticDayMap: days },
  });
  const saveFocus = () => {
    const group = LIFT_TO_GROUP[lift];
    const p = loadTrainingProfile();
    if (group && !p.weakPoints.includes(group)) saveTrainingProfile({ ...p, weakPoints: [...p.weakPoints, group] });
    applyToPlanner({ kind: 'weakpoints', label: 'Слабая группа (ПЛ): ' + LIFT_RU[lift] + ' → ' + group, data: { groups: [group], lift } });
    setSavedFocus(true); setTimeout(() => setSavedFocus(false), 2000);
  };

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>🎯 Мёртвые точки → Слабые точки → Движение штанги</div>
      <div style={{ fontSize: 10, color: DIM, marginTop: 3, lineHeight: 1.45 }}>
        Выберите движение, фазу срыва и отклонения траектории. Для каждого параметра — упражнения из раскладки цикла и анализ, какое оптимально.
      </div>

      <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
        {(Object.keys(LIFT_RU) as Lift[]).map(item => (
          <button key={item} onClick={() => changeLift(item)} style={{ minHeight: 38, padding: '5px 9px', borderRadius: 8, cursor: 'pointer', border: lift === item ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.1)', background: lift === item ? 'rgba(0,230,138,0.12)' : 'transparent', color: lift === item ? ACCENT : DIM, fontWeight: 700, fontSize: 10 }}>
            {LIFT_RU[item]}
          </button>
        ))}
      </div>

      {/* ═══ 1. Слабые точки + 2. Мёртвые точки (единый якорь — фаза) ═══ */}
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>1 · Слабые точки и мёртвые точки</div>
        <label style={{ display: 'block', fontSize: 10, color: DIM, marginTop: 6 }}>
          Фаза (срыв / слабое место)
          <select value={effectivePhase} onChange={event => setPhase(event.target.value as WeakPoint)} style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 40, borderRadius: 7, padding: 8, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
            {phases.map(item => <option key={item} value={item}>{PHASE_RU[item] || item}</option>)}
          </select>
        </label>
        {diaryHint && (
          <div style={{ marginTop: 6, padding: 7, borderRadius: 8, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 10, color: '#fbbf24', lineHeight: 1.5 }}>
            📊 Дневник: {diaryHint.count} из {diaryHint.totalHard} тяжёлых подходов ({lift === 'squat' ? 'присед' : lift === 'bench' ? 'жим' : lift === 'deadlift' ? 'тяга' : LIFT_RU[lift]}) срываются в фазе «{PHASE_RU[diaryHint.phase]}». Присмотритесь к ней — подсказка, не авто-выбор.
          </div>
        )}
        {movement && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, color: '#ef4444', fontSize: 12 }}>⚠ {movement.weakPoint.label}</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{movement.weakPoint.description}</div>
            {movement.sticking && (
              <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                <div style={{ fontSize: 10, color: DIM }}>📐 Угол: {movement.sticking.angleRangeDeg[0]}°–{movement.sticking.angleRangeDeg[1]}° · сустав: {movement.sticking.keyJoint}</div>
                <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>🧠 {movement.sticking.biomechanicalReason}</div>
                <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>💪 Слабые мышцы: {movement.sticking.weakMuscles.join(', ')}</div>
                <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 3 }}>Коррекции: {movement.sticking.corrections.join(' · ')}</div>
                <div style={{ fontSize: 10, color: '#818cf8', marginTop: 3 }}>💡 Cue: {movement.sticking.loadCues}</div>
              </div>
            )}
            {movement.barPathRelated.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10, color: '#c084fc' }}>
                🔗 Связанные отклонения траектории: {movement.barPathRelated.map(i => ISSUE_RU[i]).join(', ')}
              </div>
            )}
            {/* Результат: упражнения с анализом оптимальности */}
            {phaseAnalysis && phaseAnalysis.items.length > 0 && (
              <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>🏋️ Упражнения (из раскладки цикла, %ПМ/повторы/подходы):</div>
                {phaseAnalysis.items.map((item, idx) => (
                  <ExerciseRow key={idx} item={item} selected={selected[keyForPhase]?.includes(item.exercise.name) ?? false}
                    onToggle={() => toggleExercise(keyForPhase, item.exercise.name)} onAdd={() => addToPlan(keyForPhase, [item.exercise.name])} />
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => addToPlan(keyForPhase, phaseAnalysis.items.filter(i => i.optimal).map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(0,230,138,0.15)', color: ACCENT, border: '1px solid rgba(0,230,138,0.3)' }}>➕ Рекомендуемые</button>
                  <button onClick={() => addToPlan(keyForPhase, phaseAnalysis.items.map(i => i.exercise.name))} style={{ ...btn, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>➕ Все</button>
                </div>
              </div>
            )}
          </div>
        )}
        <button onClick={saveFocus} style={{ width: '100%', minHeight: 40, marginTop: 10, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'rgba(168,85,247,0.15)', color: '#c084fc', fontWeight: 700, fontSize: 11 }}>
          {savedFocus ? '✓ Фокус-группа сохранена в профиль' : '💾 Сохранить фокус-группу в профиль'}
        </button>
      </div>

      {/* ═══ 3. Движение штанги (bar-path) ═══ */}
      {applicableIssues.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#a855f7' }}>3 · Движение штанги (bar-path)</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
            {applicableIssues.map(issue => {
              const on = issues.includes(issue);
              return <button key={issue} onClick={() => toggleIssue(issue)} style={{ minHeight: 34, padding: '5px 8px', borderRadius: 7, cursor: 'pointer', border: on ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: on ? 'rgba(168,85,247,0.14)' : 'transparent', color: on ? '#c084fc' : DIM, fontSize: 10 }}>{ISSUE_RU[issue]}</button>;
            })}
          </div>
          <BarPathSvg lift={lift} issues={issues} onIssue={toggleIssue} onPhase={p => setPhase(p)} activePhase={effectivePhase} phases={phases} />
          {barPath && barPath.diagnoses.map(item => (
            <div key={item.issue} style={{ marginTop: 6, padding: 7, borderRadius: 8, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#c084fc' }}>{ISSUE_RU[item.issue]}{item.relatedPhase ? ` · связана с фазой ${item.relatedPhase}` : ''}</div>
              <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{item.cause} <span style={{ color: ACCENT }}>→ {item.correction}</span></div>
              <div style={{ marginTop: 4 }}>
                {issueAnalyses[item.issue]?.items.map((a, idx) => (
                  <ExerciseRow key={idx} item={a} selected={selected[`${lift}|barpath|${item.issue}`]?.includes(a.exercise.name) ?? false}
                    onToggle={() => toggleExercise(`${lift}|barpath|${item.issue}`, a.exercise.name)} onAdd={() => addToPlan(`${lift}|barpath|${item.issue}`, [a.exercise.name])} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button onClick={() => addToPlan(`${lift}|barpath|${item.issue}`, issueAnalyses[item.issue]?.items.filter(i => i.optimal).map(i => i.exercise.name) ?? [])} style={{ ...btn, background: 'rgba(0,230,138,0.15)', color: ACCENT, border: '1px solid rgba(0,230,138,0.3)' }}>➕ Рекомендуемые</button>
                <button onClick={() => addToPlan(`${lift}|barpath|${item.issue}`, issueAnalyses[item.issue]?.items.map(i => i.exercise.name) ?? [])} style={{ ...btn, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>➕ Все</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Выбор дней для добавленных упражнений */}
      {Object.keys(selected).length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>📅 Выбранные упражнения — дни добавления</div>
          {Object.entries(selected).map(([key, names]) => names.length > 0 && (
            <div key={key} style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, color: DIM }}>{key}: {names.join(', ')}</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => setAutoDays(key)} style={{ padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: !days[key]?.length ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: !days[key]?.length ? 'rgba(168,85,247,.15)' : 'transparent', color: !days[key]?.length ? '#c084fc' : DIM }}>Авто</button>
                {Array.from({ length: Math.max(1, dayCount) }, (_, index) => index + 1).map(day => (
                  <button key={day} onClick={() => toggleDay(key, day)} style={{ padding: '3px 7px', borderRadius: 6, cursor: 'pointer', fontSize: 9, border: days[key]?.includes(day) ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)', background: days[key]?.includes(day) ? 'rgba(168,85,247,.15)' : 'transparent', color: days[key]?.includes(day) ? '#c084fc' : DIM }}>Д{day}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={applySelected} style={{ width: '100%', minHeight: 44, marginTop: 8, border: 'none', borderRadius: 9, cursor: 'pointer', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800 }}>
        🛠 Добавить выбранные упражнения в ПЛ-авто ({Object.values(selected).reduce((s, n) => s + n.length, 0)})
      </button>

      <div style={{ marginTop: 8, padding: 9, borderRadius: 8, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#fbbf24', fontSize: 10, lineHeight: 1.45 }}>
        Правило ПЛ-авто: исходные упражнения и процентовки цикла не меняются. Эти данные используются для выбора дополнительных ассистентов и корректирующих упражнений.
      </div>
    </div>
  );
};

const btn: React.CSSProperties = { padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700, minHeight: 32 };

const ExerciseRow: React.FC<{ item: any; selected: boolean; onToggle: () => void; onAdd: () => void }> = ({ item, selected, onToggle, onAdd }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', marginTop: 3, borderRadius: 6, background: selected ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)', border: selected ? '1px solid rgba(0,230,138,0.35)' : '1px solid rgba(255,255,255,0.05)' }}>
    <button onClick={onToggle} style={{ minWidth: 24, height: 24, borderRadius: 5, cursor: 'pointer', border: 'none', background: selected ? ACCENT : 'rgba(255,255,255,0.1)', color: selected ? '#000' : DIM, fontWeight: 800, fontSize: 12 }}>{selected ? '✓' : '＋'}</button>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
        {item.optimal ? '⭐ ' : ''}{item.exercise.name} <span style={{ color: ACCENT, fontWeight: 800 }}>{item.protocol.sets}×{item.protocol.reps} @{Math.round(item.protocol.pct * 100)}%</span>
      </div>
      <div style={{ fontSize: 9, color: DIM, lineHeight: 1.3, marginTop: 1 }}>{item.rationale}</div>
    </div>
    <button onClick={onAdd} style={{ ...btn, background: 'rgba(0,230,138,0.12)', color: ACCENT, border: '1px solid rgba(0,230,138,0.25)' }}>➕</button>
  </div>
);

export default PlDeadpointsBarPathCard;
