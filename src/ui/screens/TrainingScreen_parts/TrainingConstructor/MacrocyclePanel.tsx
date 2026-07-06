import React, { useState, useCallback, useMemo } from 'react';
import { getSplitOptions, type SplitCandidate } from '../../../../engines/split-selector.engine';
import { BLOCK_SEQUENCES, getCurrentWeekPlan, generateMacrocycle, generateBlockPlan, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../../../engines/training-periodization.engine';
import { calcTraining, LEVEL_VOLUMES } from '../../../../engines/training.engine';
import type { TrainingOutput, TrainingInput } from '../../../../core/types';
import { computeConstraints } from '../../../../engines/training-constraints.engine';
import { getPhaseParams, type GoalType } from '../../../../engines/cycle-periodization.engine';
import { generateWarmup } from '../../../../engines/warmup.engine';
import { generateCooldown } from '../../../../engines/cooldown.engine';
import { selectSetScheme } from '../../../../engines/set-scheme.engine';
import { selectTempo } from '../../../../engines/tempo.engine';
import { RIR_MATRIX } from '../../../../engines/rir-matrix.engine';
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';
import { labTrainingAdjust } from '../lab-training-adjust';
import { WARMUP_LABELS, GOALS as SHARED_GOALS, LEVELS as SHARED_LEVELS, GROUP_LABELS, PHASE_LABELS, PHASE_HINTS } from '../shared';
import { GROUP_RU, ACCENT, DIM, getMrv } from './types';
import type { TrainingProfile } from '../training-profile';

interface Props {
  goal: string; level: string;
  daysPerWeek: number;
  recovery: number; fatigue: number;
  weakPoints: string[];
  bodyWeight: number;
  sleepHours: number; stressLevel: number;
  tprofile: TrainingProfile;
  labAnalysis: any;
  macrocycle: MacrocyclePlan | null;
  setMacrocycle: (m: MacrocyclePlan | null) => void;
  selectedWeek: number;
  setSelectedWeek: (w: number) => void;
  currentMicrocycle: Microcycle | null;
  setCurrentMicrocycle: (m: Microcycle | null) => void;
  onToRuntime: () => void;
}

export const MacrocyclePanel: React.FC<Props> = ({
  goal, level, daysPerWeek, recovery, fatigue, weakPoints, bodyWeight,
  sleepHours, stressLevel, tprofile, labAnalysis,
  macrocycle, setMacrocycle, selectedWeek, setSelectedWeek,
  currentMicrocycle, setCurrentMicrocycle, onToRuntime,
}) => {
  const [splitType, setSplitType] = useState('auto');
  const [splitCandidates, setSplitCandidates] = useState<SplitCandidate[]>([]);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [periodizationType, setPeriodizationType] = useState<'auto' | 'linear' | 'undulating' | 'block' | 'conjugate'>('auto');
  const [cycleType, setCycleType] = useState('auto');
  const [mesoLength, setMesoLength] = useState(12);
  const [showWarmup, setShowWarmup] = useState(false);
  const [showCooldown, setShowCooldown] = useState(false);
  const [trainingOutput, setTrainingOutput] = useState<TrainingOutput | null>(null);

  const generatePlan = useCallback((overrideSplitType?: string) => {
    try {
      const input: TrainingInput = {
        goal, level, daysPerWeek, recovery: Math.max(0, Math.min(100, recovery)),
        fatigue: Math.max(0, Math.min(100, fatigue)), nutrition: 8,
        weakPoints, sessionDuration: 60, exercises: [],
        splitType: overrideSplitType || splitType,
        periodizationType, cycleType,
      };
      const output = calcTraining(input);
      setTrainingOutput(output);

      const macroInput: MacrocycleInput = {
        goal: goal as MacrocycleInput['goal'],
        level: level as MacrocycleInput['level'],
        daysPerWeek,
        readinessScore: recovery / 10,
        isOnCourse: level === 'enhanced',
        weakPoints, injuries: [],
        experience: level as MacrocycleInput['experience'],
        currentWeek: 1,
        periodizationType, cycleType,
      };
      const macro = periodizationType === 'block' ? generateBlockPlan(macroInput) : generateMacrocycle(macroInput);
      setMacrocycle(macro);
      setSelectedWeek(1);
      setCurrentMicrocycle(getCurrentWeekPlan(macro, 1));
    } catch (e) { console.error('Macrocycle gen error:', e); }
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints, splitType, periodizationType, cycleType, setMacrocycle, setSelectedWeek, setCurrentMicrocycle]);

  const getRIRstr = (g: string, l: string, deload: boolean): string => {
    if (deload) return '3-5';
    try { const rir = RIR_MATRIX[g]?.[l]?.base ?? 2; return `${rir}-${rir + 2}`; } catch { return '2-3'; }
  };

  const formatSplitGroups = (output: TrainingOutput) => {
    if (!output.volumePerGroup) return '';
    return Object.entries(output.volumePerGroup)
      .filter(([, v]: [string, any]) => v > 0)
      .map(([g, v]) => `${GROUP_LABELS[g] || g}: ${v} подх`).join(' • ');
  };

  const applyMacroToRuntime = useCallback(() => {
    if (!currentMicrocycle) return;
    onToRuntime();
  }, [currentMicrocycle, onToRuntime]);

  const labAdj = labTrainingAdjust(labAnalysis);
  const mrv = getMrv(level, tprofile.onCourse, tprofile.courseIntensity, labAdj.mrvMultiplier);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="card" style={{ padding: '10px 12px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>⚙️ Параметры макроцикла</h3>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 10, color: DIM, marginBottom: 2, display: 'block' }}>Тип сплита</label>
          <button onClick={() => {
            setShowSplitPicker(!showSplitPicker);
            if (!splitCandidates.length) {
              const opts = getSplitOptions({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] });
              setSplitCandidates(opts.slice(0, 12));
            }
          }} style={{ width: '100%', padding: '6px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{splitType === 'auto' ? 'Авто-выбор сплита' : splitCandidates.find(c => c.id === splitType)?.name || splitType}</span>
            <span style={{ fontSize: 9, color: DIM }}>{showSplitPicker ? '▴' : '▾'}</span>
          </button>
          {showSplitPicker && (
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: 8, padding: '4px 6px', border: '1px solid var(--border)' }}>
              <div onClick={() => { setSplitType('auto'); setShowSplitPicker(false); setTimeout(() => generatePlan(), 50); }} style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, background: splitType === 'auto' ? 'rgba(0,230,138,0.1)' : 'transparent', border: splitType === 'auto' ? '1px solid var(--accent)' : '1px solid transparent' }}>
                <div style={{ fontWeight: 600 }}>🤖 Авто-выбор</div>
                <div style={{ fontSize: 9, color: DIM }}>Движок сам подберёт оптимальный сплит</div>
              </div>
              {splitCandidates.map(c => (
                <div key={c.id || c.name} onClick={() => { const nt = c.id || c.name; setSplitType(nt); setShowSplitPicker(false); setTimeout(() => generatePlan(nt), 50); }} style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, background: splitType === (c.id || c.name) ? 'rgba(0,230,138,0.1)' : 'transparent', border: splitType === (c.id || c.name) ? '1px solid var(--accent)' : '1px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,230,138,0.1)', color: ACCENT, fontWeight: 600 }}>{(c.score * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>{c.desc?.slice(0, 80)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 10, color: DIM, marginBottom: 2, display: 'block' }}>Тип периодизации</label>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {[
              { v: 'auto', l: 'Авто', desc: 'Автоматический выбор по уровню' },
              { v: 'linear', l: 'Линейная', desc: 'Объём ↓, интенсивность ↑' },
              { v: 'undulating', l: 'Волновая DUP', desc: 'Смена нагрузки внутри недели' },
              { v: 'block', l: 'Блочная', desc: 'Блоки по 3-6 нед с одной целью' },
            ].map(p => (
              <button key={p.v} onClick={() => { setPeriodizationType(p.v as 'auto' | 'linear' | 'undulating' | 'block' | 'conjugate'); setTimeout(generatePlan, 50); }} style={{ padding: '3px 7px', borderRadius: 6, fontSize: 9, fontWeight: periodizationType === p.v ? 700 : 400, cursor: 'pointer', border: periodizationType === p.v ? '1px solid var(--accent)' : '1px solid var(--border)', background: periodizationType === p.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)' }} title={p.desc}>{p.l}</button>
            ))}
          </div>
          {periodizationType === 'block' && (() => {
            const seq = BLOCK_SEQUENCES[level] || BLOCK_SEQUENCES.intermediate;
            const colors: Record<string,string> = { accumulation:'#22c55e', transmutation:'#3b82f6', realization:'#f97316', active_rest:'#eab308' };
            const labels: Record<string,string> = { accumulation:'Акк', transmutation:'Транс', realization:'Реал', active_rest:'Отдых' };
            return <div style={{ marginTop:4, display:'flex', gap:4, flexWrap:'wrap' }}>
              {seq.map((b: any, i: number) => <span key={b.id} style={{ fontSize:8, padding:'2px 6px', borderRadius:4, background:(colors[b.id]||'#888')+'22', color:colors[b.id]||'#888', fontWeight:600, whiteSpace:'nowrap' }}>{labels[b.id]||b.id} {b.weeks}н{i < seq.length-1 ? ' →' : ''}</span>)}
            </div>;
          })()}
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 10, color: DIM, marginBottom: 2, display: 'block' }}>Тип цикла</label>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {[
              { v: 'auto', l: 'Авто' }, { v: 'pl_strength', l: 'PL Сила' }, { v: 'pl_peaking', l: 'PL Пик' },
              { v: 'bb_mass', l: 'BB Масса' }, { v: 'bb_specialization', l: 'BB Спец' },
              { v: 'rehab', l: 'Реабилитация' }, { v: 'wl_tech', l: 'WL Техника' },
            ].map(c => (
              <button key={c.v} onClick={() => { setCycleType(c.v); setTimeout(generatePlan, 50); }} style={{ padding: '3px 7px', borderRadius: 6, fontSize: 9, fontWeight: cycleType === c.v ? 700 : 400, cursor: 'pointer', border: cycleType === c.v ? '1px solid var(--accent)' : '1px solid var(--border)', background: cycleType === c.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)' }}>{c.l}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 10, color: DIM, marginBottom: 2, display: 'block' }}>Длина цикла</label>
          <div style={{ display: 'flex', gap: 3 }}>
            {[4, 8, 12, 16, 20, 24].map(w => (
              <button key={w} onClick={() => setMesoLength(w)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: mesoLength === w ? 700 : 400, cursor: 'pointer', border: mesoLength === w ? '1px solid var(--accent)' : '1px solid var(--border)', background: mesoLength === w ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)' }}>{w} нед</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => generatePlan()} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, var(--accent), #00c853)', color: '#000', fontWeight: 700, fontSize: 13 }}>▶ Сгенерировать макроцикл</button>
          {currentMicrocycle && <button onClick={applyMacroToRuntime} title="Перенести неделю во выполнение" style={{ padding: 10, borderRadius: 8, border: '1px solid var(--accent)', cursor: 'pointer', background: 'rgba(0,230,138,0.08)', color: ACCENT, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>▶ К выполнению</button>}
        </div>
      </div>

      {trainingOutput && (
        <>
          {(() => {
            const constraints = computeConstraints({
              riskSnapshot: {}, fatigueLevel: fatigue / 10, recoveryLevel: recovery / 10,
              priScore: recovery / 10, jointFatigue: {},
              cumulativeLoad: { weekly: 0, patternLoad: {}, jointLoad: {}, overload: false },
              equipmentAvailable: ['barbell', 'dumbbell', 'bench'], goal,
            });
            if (constraints.recommendations.length === 0) return null;
            return (
              <div className="card" style={{ marginBottom: 8, padding: '6px 10px', background: 'rgba(249,115,22,0.06)', borderLeft: '3px solid #f97316' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#f97316' }}>⚠ Ограничения тренировки</div>
                {constraints.recommendations.map((r: string, i: number) => <div key={i} style={{ fontSize: 9, color: DIM, marginTop: 2 }}>• {r}</div>)}
              </div>
            );
          })()}

          {(() => {
            const tips: { icon: string; text: string; color: string }[] = [];
            if (recovery < 5) tips.push({ icon: '⚠️', text: 'Низкое восстановление: сократите объём на 10-20%.', color: '#ef4444' });
            if (sleepHours < 7) tips.push({ icon: '😴', text: `Сон ${sleepHours} ч: добавьте сон перед тяжёлыми днями.`, color: '#ff9100' });
            if (stressLevel > 7) tips.push({ icon: '🧠', text: 'Высокий стресс: избегайте отказных подходов.', color: '#ff9100' });
            if (currentMicrocycle?.mesocycleType === 'deload') tips.push({ icon: '🧊', text: 'Неделя разгрузки: восстановление, не рекорды.', color: '#3b82f6' });
            else if (currentMicrocycle?.mesocycleType === 'peaking') tips.push({ icon: '🎯', text: 'Пиковая фаза: техника стабильна, без лишнего объёма.', color: '#ef4444' });
            else if (currentMicrocycle?.mesocycleType === 'accumulation') tips.push({ icon: '📈', text: 'Фаза накопления: постепенный рост объёма.', color: '#22c55e' });
            if (weakPoints.length > 0) tips.push({ icon: '🔎', text: `Фокус на слабых зонах: ${weakPoints.map(w => GROUP_LABELS[w] || w).join(', ')}.`, color: '#8b5cf6' });
            if (tips.length === 0) tips.push({ icon: '✅', text: 'Параметры сбалансированы: выполняйте план без изменений.', color: ACCENT });
            return (
              <div className="card" style={{ padding: '10px 12px', border: '1px solid rgba(0,230,138,0.2)' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 12, color: ACCENT }}>💡 Рекомендации</h4>
                {tips.map((t, i) => <div key={i} style={{ fontSize: 10, color: DIM, padding: '2px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}><span>{t.icon}</span><span style={{ color: t.color }}>{t.text}</span></div>)}
              </div>
            );
          })()}

          <div className="card" style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: ACCENT }}>{trainingOutput.splitName}</span>
                <span style={{ fontSize: 10, color: DIM, marginLeft: 6 }}>RIR {getRIRstr(goal, level, trainingOutput.isDeload)}</span>
              </div>
              {trainingOutput.isDeload && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,145,0,0.15)', color: '#ff9100', fontWeight: 600 }}>РАЗГРУЗКА</span>}
            </div>
            <div style={{ fontSize: 11, color: DIM, marginBottom: 4 }}>{trainingOutput.splitDesc}</div>
            <div style={{ fontSize: 10, color: DIM }}>{formatSplitGroups(trainingOutput)}</div>
          </div>

          <div className="card" style={{ padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: DIM, whiteSpace: 'nowrap' }}>Нед {selectedWeek}</span>
              <input type="range" min={1} max={macrocycle?.totalWeeks || 12} value={selectedWeek}
                onChange={e => setSelectedWeek(parseFloat(e.target.value) || 0)}
                style={{ flex: 1, accentColor: ACCENT }} />
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button onClick={() => setShowWarmup(!showWarmup)} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 9, cursor: 'pointer', background: showWarmup ? 'rgba(255,145,0,0.15)' : 'var(--bg-secondary)', border: showWarmup ? '1px solid #ff9100' : '1px solid var(--border)', color: showWarmup ? '#ff9100' : DIM }}>🔥 Разминка</button>
              <button onClick={() => setShowCooldown(!showCooldown)} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 9, cursor: 'pointer', background: showCooldown ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)', border: showCooldown ? '1px solid #3b82f6' : '1px solid var(--border)', color: showCooldown ? '#3b82f6' : DIM }}>🧊 Заминка</button>
            </div>
          </div>

          {showWarmup && currentMicrocycle && currentMicrocycle.days.length > 0 && (() => {
            const warmup = generateWarmup({
              sessionFocus: currentMicrocycle.days[0]?.split || 'fullbody',
              primaryExercises: currentMicrocycle.days[0]?.exercises?.slice(0, 2).map((e: any) => e.name) || [],
              riskFlags: {}, techniqueIssues: [],
              fatigueLevel: fatigue / 10,
              equipmentAvailable: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
            });
            return (
              <div className="card" style={{ padding: '8px 10px', border: '1px solid rgba(255,145,0,0.2)' }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#ff9100', marginBottom: 4 }}>🔥 Разминка</div>
                {warmup.map((b: any, bi: number) => <div key={bi} style={{ fontSize: 10, marginBottom: 2, color: DIM }}>
                  <span style={{ fontWeight: 600, color: '#ff9100' }}>{b.type === 'general' ? 'Общая' : b.type === 'mobility' ? 'Мобилизация' : b.type === 'activation' ? 'Активация' : 'Разминка'} ({b.durationSec}с)</span>
                  {b.exercises?.map((ex: any, exi: number) => <span key={exi} style={{ marginLeft: 6, color: DIM }}>{WARMUP_LABELS[ex.exerciseId] || ex.exerciseId.replace(/_/g, ' ')} {ex.sets ? `×${ex.sets}` : ''}</span>)}
                </div>)}
              </div>
            );
          })()}

          {currentMicrocycle && (
            <div className="card" style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{PHASE_LABELS[currentMicrocycle.mesocycleType] || 'Рабочая фаза'} — Неделя {selectedWeek}</span>
                <span style={{ fontSize: 10, color: DIM }}>Объём ×{currentMicrocycle.volumeMultiplier} | RIR {currentMicrocycle.rirRange[0]}-{currentMicrocycle.rirRange[1]}</span>
              </div>
              <div style={{ padding: '6px 8px', background: 'rgba(0,230,138,0.04)', borderRadius: 6, fontSize: 10, color: ACCENT, marginBottom: 6, lineHeight: 1.4 }}>
                {PHASE_HINTS[currentMicrocycle.mesocycleType] || 'Рабочая неделя: сохраняйте заданный объём и RIR.'}
              </div>

              {(() => {
                const wk: Record<string, number> = {};
                currentMicrocycle.days.filter((d: any) => d.isTraining).forEach((d: any) => (d.exercises || []).forEach((e: any) => { wk[e.group] = (wk[e.group] || 0) + (e.sets || 0); }));
                const over = Object.entries(wk).filter(([, s]) => s > mrv);
                if (over.length === 0) return null;
                return <div style={{ padding: '6px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, fontSize: 10, color: '#ef4444', marginBottom: 6, lineHeight: 1.4, border: '1px solid rgba(239,68,68,0.2)' }}>⚠ Объём превышает MRV ({mrv.toFixed(0)} сетов/нед): {over.map(([g, s]) => `${GROUP_RU[g] || g} ${s}`).join(' · ')}</div>;
              })()}

              {currentMicrocycle.days.filter((d: any) => d.isTraining).map((day: any, di: number) => {
                const dayExCount = day.exercises?.length || 0;
                const dayCompounds = day.exercises?.filter((e: any) => e.isCompound).length || 0;
                const difficultyScore = Math.min(10, Math.round((dayCompounds * 2 + dayExCount) * (day.intensity === 'very_high' ? 1.4 : day.intensity === 'high' ? 1.2 : 1)));
                const diffLabel = difficultyScore <= 3 ? 'лёгко' : difficultyScore <= 5 ? 'умеренно' : difficultyScore <= 7 ? 'тяжело' : 'очень тяжело';
                const diffColor = difficultyScore <= 3 ? '#22c55e' : difficultyScore <= 5 ? '#84cc16' : difficultyScore <= 7 ? '#ff9100' : '#ef4444';
                return (
                  <div key={di} style={{ marginBottom: 6, background: 'var(--bg-secondary)', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 11 }}>{day.day}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${diffColor}22`, color: diffColor, fontWeight: 600 }}>{diffLabel} {difficultyScore}/10</span>
                        <span style={{ fontSize: 10, color: DIM }}>{day.duration} мин</span>
                      </div>
                    </div>
                    {day.exercises.map((ex: any, ei: number) => {
                      const scheme = selectSetScheme({ goal, movementPattern: 'squat' as any, difficultyLevel: level === 'beginner' ? 'low' : level === 'intermediate' ? 'medium' : 'high', techniqueIssues: [], riskFlags: {}, fatigueScore: fatigue / 10, repPattern: 'normal', isPrimaryLift: ei === 0 });
                      const exCat = EXERCISE_CATALOG.find((ec: any) => ec.id === ex.exerciseId || ec.name === ex.name);
                      const estMax = ex.weight ? Math.round(ex.weight * (1 + Number(ex.reps) / 30)) : 0;
                      const substitute = exCat?.canReplace?.[0] ? EXERCISE_CATALOG.find(e => e.id === exCat.canReplace![0]) : null;
                      const role = ei === 0 ? 'main' : ei <= 2 ? 'secondary' : 'accessory';
                      const roleColor = role === 'main' ? '#ef4444' : role === 'secondary' ? '#f97316' : '#6b7280';
                      const roleLabel = role === 'main' ? 'ОСН' : role === 'secondary' ? 'ДОП' : 'АКС';
                      const restSec = ei === 0 ? (goal === 'strength' ? 180 : 120) : ei <= 2 ? 90 : 60;
                      return (
                        <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 10, borderBottom: ei < day.exercises.length - 1 ? '1px solid var(--border)' : 'none', gap: 2 }}>
                          <span style={{ fontSize: 7, padding: '1px 3px', borderRadius: 2, background: `${roleColor}22`, color: roleColor, fontWeight: 700, minWidth: 22, textAlign: 'center', flexShrink: 0 }}>{roleLabel}</span>
                          <span style={{ flex: 1 }}>{ex.name}</span>
                          <span style={{ color: ACCENT, fontWeight: 600, minWidth: 55, textAlign: 'right' }}>{ex.sets}×{ex.reps}</span>
                          {estMax > 0 && <span style={{ fontSize: 8, color: '#00e68a', minWidth: 40, textAlign: 'right' }}>~{estMax}кг</span>}
                          <span style={{ fontSize: 8, color: DIM, minWidth: 25, textAlign: 'right' }}>RIR{ex.rir}</span>
                          <span style={{ fontSize: 6, padding: '1px 2px', borderRadius: 2, background: 'rgba(0,230,138,0.1)', color: '#00e68a', whiteSpace: 'nowrap' }}>{scheme?.schemeType?.slice(0, 6) || '—'}</span>
                          <span style={{ fontSize: 6, padding: '1px 2px', borderRadius: 2, background: 'rgba(249,115,22,0.1)', color: '#f97316', whiteSpace: 'nowrap' }}>⏱{restSec}с</span>
                          {substitute && <span style={{ fontSize: 6, color: DIM, maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↔{substitute.name.slice(0, 8)}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {currentMicrocycle && (() => {
                const days = currentMicrocycle.days.filter((d: any) => d.isTraining);
                const totalSets = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (e.sets || 0), 0) || 0), 0);
                const totalReps = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (parseInt(String(e.reps)) || 0) * (e.sets || 0), 0) || 0), 0);
                const totalTonnage = days.reduce((s: number, d: any) => s + (d.exercises?.reduce((ss: number, e: any) => ss + (e.sets || 0) * (parseInt(String(e.reps)) || 0) * (e.weight || 0), 0) || 0), 0);
                const totalMin = days.reduce((s: number, d: any) => s + (d.duration || 0), 0);
                const density = totalMin > 0 ? Math.round(totalTonnage / totalMin) : 0;
                return (
                  <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 4, fontSize: 10 }}>
                    <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}><div style={{ color: DIM }}>Дней</div><div style={{ fontWeight: 700, color: ACCENT }}>{days.length}</div></div>
                    <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}><div style={{ color: DIM }}>Подходов</div><div style={{ fontWeight: 700, color: ACCENT }}>{totalSets}</div></div>
                    <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}><div style={{ color: DIM }}>Повторов</div><div style={{ fontWeight: 700, color: ACCENT }}>{totalReps}</div></div>
                    <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}><div style={{ color: DIM }}>Тоннаж</div><div style={{ fontWeight: 700, color: ACCENT }}>{totalTonnage > 0 ? `${(totalTonnage / 1000).toFixed(1)}т` : '—'}</div></div>
                    <div style={{ textAlign: 'center', padding: '4px', background: 'rgba(0,230,138,0.05)', borderRadius: 4 }}><div style={{ color: DIM }}>Плотность</div><div style={{ fontWeight: 700, color: density > 50 ? '#22c55e' : density > 25 ? '#ff9100' : '#ef4444' }}>{density} кг/мин</div></div>
                  </div>
                );
              })()}

              {currentMicrocycle && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: ACCENT, marginBottom: 4 }}>📅 Календарь недели</div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((dayName, di) => {
                      const day = currentMicrocycle.days.find((d: any) => d.isTraining && d.day?.includes(dayName));
                      const isTraining = !!day;
                      return (
                        <div key={di} style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: 6, fontSize: 9, background: isTraining ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.02)', border: isTraining ? '1px solid rgba(0,230,138,0.2)' : '1px solid var(--border)', color: isTraining ? ACCENT : DIM, fontWeight: isTraining ? 600 : 400 }}>
                          <div>{dayName}</div>
                          {isTraining && <div style={{ fontSize: 7, marginTop: 1 }}>{day?.exercises?.length || 0} упр</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {showCooldown && currentMicrocycle && currentMicrocycle.days.length > 0 && (() => {
            const cooldown = generateCooldown({
              muscleGroupsUsed: currentMicrocycle.days[0]?.exercises?.map((e: any) => e.group).filter(Boolean) || [],
              fatigueScore: fatigue / 10, riskFlags: {},
              sessionDuration: currentMicrocycle.days[0]?.duration || 60,
            });
            return (
              <div className="card" style={{ padding: '8px 10px', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#3b82f6', marginBottom: 4 }}>🧊 Заминка</div>
                {cooldown.map((b: any, bi: number) => <div key={bi} style={{ fontSize: 10, marginBottom: 2, color: DIM }}>
                  <span style={{ fontWeight: 600, color: '#3b82f6' }}>{b.type === 'breathing' ? 'Дыхание' : b.type === 'stretch' ? 'Растяжка' : 'Заминка'} ({b.durationSec}с)</span>
                  {b.exercises?.map((ex: any, exi: number) => <span key={exi} style={{ marginLeft: 6, color: DIM }}>{WARMUP_LABELS[ex.exerciseId] || ex.exerciseId.replace(/_/g, ' ')}</span>)}
                </div>)}
              </div>
            );
          })()}

          {currentMicrocycle?.days && (() => {
            const reps = currentMicrocycle.days.filter((d: any) => d.isTraining).flatMap((d: any) => d.exercises?.map((e: any) => parseInt(String(e.reps)) || 8) || []) || [];
            const str = reps.filter((r: number) => r >= 1 && r <= 6).length;
            const hyp = reps.filter((r: number) => r >= 7 && r <= 12).length;
            const end = reps.filter((r: number) => r >= 13).length;
            const total = reps.length || 1;
            return (
              <div className="card" style={{ padding: '8px 10px' }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: ACCENT, marginBottom: 4 }}>📊 Зоны интенсивности</div>
                <div style={{ display: 'flex', gap: 2, height: 18, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ flex: str || 0.1, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: str > 0 ? 20 : 0 }}>{str > 0 ? `${Math.round((str/total)*100)}%` : ''}</div>
                  <div style={{ flex: hyp || 0.1, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: hyp > 0 ? 20 : 0 }}>{hyp > 0 ? `${Math.round((hyp/total)*100)}%` : ''}</div>
                  <div style={{ flex: end || 0.1, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 600, minWidth: end > 0 ? 20 : 0 }}>{end > 0 ? `${Math.round((end/total)*100)}%` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 9, color: DIM }}><span>🔴 Сила ({str})</span><span>🟢 Гипертрофия ({hyp})</span><span>🔵 Выносливость ({end})</span></div>
              </div>
            );
          })()}

          {trainingOutput.volumePerGroup && (
            <div className="card" style={{ padding: '10px 12px' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 12 }}>📊 Объём по группам</h4>
              {Object.entries(trainingOutput.volumePerGroup).map(([g, v]: [string, any]) => (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, minWidth: 50 }}>{GROUP_LABELS[g] || g}</span>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, v / 2)}%`, height: '100%', background: ACCENT, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 10, color: DIM, minWidth: 40, textAlign: 'right' }}>{v} подх</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

