import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { selectSplit } from '../../../../engines/split-selector.engine';
import { TRAINING_SPLITS, calcTraining, LEVEL_VOLUMES } from '../../../../engines/training.engine';
import { FULL_PROGRAM_LIBRARY } from '../../../../engines/complete-program-library.engine';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from '../programs-data';
import type { FullProgram, ProgramDay } from '../../../../engines/complete-program-library.engine';
import { labTrainingAdjust } from '../lab-training-adjust';
import { loadReadinessHistory } from '../readiness-history';
import { usePlanGeneration } from '../../../hooks/usePlanGeneration';
import { generateMacrocycle, getCurrentWeekPlan, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../../../engines/training-periodization.engine';
import { TrainingProfileCard } from '../TrainingProfileCard';
import type { TrainingProfile } from '../training-profile';
import { PCT_FOR_RIR, ACCENT, DIM, detectGroup, getMrv, type ManualResult, type ConstructorMode } from './types';
import { ConstructorProfile } from './ConstructorProfile';
import { ConfigPanel } from './ConfigPanel';
import { PlanDisplay } from './PlanDisplay';
import { ToolsPanel } from './ToolsPanel';
import { MacrocyclePanel } from './MacrocyclePanel';

interface Props {
  tprofile: TrainingProfile;
  updateTProfile: (p: Partial<TrainingProfile>) => void;
  goal: string; setGoal: (v: string) => void;
  level: string; setLevel: (v: string) => void;
  daysPerWeek: number; setDaysPerWeek: (v: number) => void;
  recovery: number; setRecovery: (v: number) => void;
  fatigue: number; setFatigue: (v: number) => void;
  weakPoints: string[]; setWeakPoints: (v: string[]) => void;
  bodyWeight: number; setBodyWeight: (v: number) => void;
  sleepHours: number; setSleepHours: (v: number) => void;
  stressLevel: number; setStressLevel: (v: number) => void;
  mesoLength: number; setMesoLength: (v: number) => void;
  labAnalysis: any;
  setTab: (t: any) => void;
}

export const TrainingConstructor: React.FC<Props> = ({
  tprofile, updateTProfile,
  goal, setGoal, level, setLevel,
  daysPerWeek, setDaysPerWeek,
  recovery, setRecovery, fatigue, setFatigue,
  weakPoints, setWeakPoints,
  bodyWeight, setBodyWeight,
  sleepHours, setSleepHours,
  stressLevel, setStressLevel,
  mesoLength, setMesoLength,
  labAnalysis, setTab,
}) => {
  const [mode, setMode] = useState<ConstructorMode>(() => {
    try { return localStorage.getItem('he_constructor_mode') as ConstructorMode || 'manual'; } catch { return 'manual'; }
  });
  useEffect(() => { try { localStorage.setItem('he_constructor_mode', mode); } catch {} }, [mode]);

  const [manualCfg, setManualCfg] = useState<Record<string, string>>({});
  const setManual = useCallback((k: string, v: string) => setManualCfg(p => ({ ...p, [k]: v })), []);
  const [manualWorkMax, setManualWorkMax] = useState<Record<string, number>>({
    chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60,
  });
  const [manualResult, setManualResult] = useState<ManualResult | null>(() => {
    try { return JSON.parse(localStorage.getItem('he_manual_session') || 'null'); } catch { return null; }
  });
  useEffect(() => { try { localStorage.setItem('he_manual_session', JSON.stringify(manualResult)); } catch {} }, [manualResult]);

  const [macrocycle, setMacrocycle] = useState<MacrocyclePlan | null>(() => {
    try { return JSON.parse(localStorage.getItem('he_macro_session') || 'null'); } catch { return null; }
  });
  useEffect(() => { try { localStorage.setItem('he_macro_session', JSON.stringify(macrocycle)); } catch {} }, [macrocycle]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [currentMicrocycle, setCurrentMicrocycle] = useState<Microcycle | null>(null);

  const buildPlan = usePlanGeneration({
    goal, level, mesoLength, weakPoints,
    equipment: tprofile.equipment, workMax: tprofile.workMax,
    manualWorkMax, injuries: tprofile.injuries || [], pctForRir: PCT_FOR_RIR,
  });

  const generateManualPlan = useCallback(() => {
    const corrections: string[] = [];
    const auto = selectSplit({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as any);
    const manualSp = manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null;
    const sp = manualSp ? { id: manualCfg.split!, name: manualSp.name, desc: manualSp.desc, groupsPerDay: manualSp.groupsPerDay, score: 100, rationale: ['Ручной выбор'] } as any : auto[0];
    if (!sp) { setManualResult(null); return; }
    if (manualSp) corrections.push(`Сплит выбран вручную: «${sp.name}».`); else corrections.push(`Сплит подобран автоматически: «${sp.name}».`);
    const cycle: string[][] = []; let gi = 0;
    while (cycle.length < daysPerWeek) { cycle.push(sp.groupsPerDay[gi % sp.groupsPerDay.length]); gi++; }
    const labAdj = labTrainingAdjust(labAnalysis);
    const mrv = getMrv(level, tprofile.onCourse, tprofile.courseIntensity, labAdj.mrvMultiplier);
    corrections.push(`Допустимый объём (MRV): ${Math.round(mrv)} сетов/нед на группу.`);
    if (tprofile.onCourse) corrections.push(`MRV повышен на курсе (интенсивность: ${tprofile.courseIntensity}).`);
    if (labAdj.mrvMultiplier < 1) corrections.push(`MRV снижен по лаборатории ×${labAdj.mrvMultiplier.toFixed(2)}: ${labAdj.warnings.join(' ')}`);
    if (weakPoints.length > 0) corrections.push(`Слабые группы (${weakPoints.join(', ')}): приоритет + RIR ↓.`);
    if (tprofile.equipment.length > 0) corrections.push(`Фильтр оборудования: только ${tprofile.equipment.join(', ')}.`);
    try { const rh = loadReadinessHistory(); if (rh.length) { const last = rh[rh.length - 1]; if ((last?.recovery ?? 100) < 60) { corrections.push(`🩺 Готовность ${Math.round(last.recovery)}% (<60) — объём снижен на 15%.`); } } } catch {}
    const built = buildPlan(cycle, mrv);
    corrections.push(...built.groupCorrections);
    const ws = built.weeklySets;
    Object.entries(ws).forEach(([g, s]: [string, any]) => { if (s < Math.max(4, mrv * 0.4) && s > 0) corrections.push(`Группа «${g}»: низкий объём (${s} сетов) — ниже зоны адаптации.`); });
    weakPoints.forEach(w => { if (!ws[w] || ws[w] === 0) corrections.push(`⚠ Слабая группа «${w}» не включена — добавьте специализированное упражнение.`); });
    setManualResult({ splitName: sp.name, corrections, days: built.days });
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints, manualCfg, tprofile, labAnalysis, buildPlan]);

  const loadProgramToConstructor = useCallback((programId: string) => {
    const lib: FullProgram[] = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS];
    const prog = lib.find(p => p.id === programId);
    if (!prog || !prog.weeks?.length) return;
    const wk = prog.weeks[0];
    const days = wk.days.map((d: ProgramDay, di: number) => ({
      day: di + 1,
      groups: Array.from(new Set((d.exercises || []).map((e: ProgramDay['exercises'][number]) => detectGroup(e.name)))),
      exercises: (d.exercises || []).map((e: ProgramDay['exercises'][number]) => {
        const g = detectGroup(e.name);
        const rir = e.rir ?? (e.rpe ? Math.max(0, 10 - e.rpe) : 2);
        const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, rir))] ?? 0.9;
        const weight = Math.round((tprofile.workMax[g] || 80) * pct);
        return { name: e.name, sets: e.sets, reps: String(e.reps), rir, rest: e.restSec || 120, group: g, weight };
      }),
    }));
    const corrections: string[] = [
      `Загружена программа «${prog.name}» (${prog.author || ''}, ${prog.goal}, ${prog.level}) — неделя 1, ${days.length} дн.`,
      'Программа доступна для редактирования, применения методик и выполнения.',
    ];
    if (prog.warnings?.length) corrections.push('Предупреждения: ' + prog.warnings.join('; '));
    setManualResult({ splitName: prog.name + ' (неделя 1)', corrections, days });
  }, [tprofile]);

  const manualToRuntime = useCallback(() => {
    if (!manualResult) return;
    const days = manualResult.days.map(d => ({
      label: 'Д' + d.day,
      exercises: d.exercises.map(e => ({
        name: e.name, muscleGroup: e.group,
        targetSets: Array.from({ length: e.sets }, () => ({ weight: e.weight, reps: parseInt(e.reps) || 10, rir: e.rir })),
      })),
    }));
    try { localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: manualResult.splitName, week: 1, track: 'manual' })); } catch {}
    setTab('runtime');
  }, [manualResult, setTab]);

  const macroToRuntime = useCallback(() => {
    if (!currentMicrocycle) return;
    const days = currentMicrocycle.days.filter((d: any) => d.isTraining).map((d: any, i: number) => ({
      label: 'Д' + (i + 1),
      exercises: (d.exercises || []).map((e: any) => ({
        name: e.name, muscleGroup: e.group,
        targetSets: Array.from({ length: e.sets || 3 }, () => ({
          weight: Math.round((e.weight || tprofile.workMax[e.group] || 80) * 0.8),
          reps: parseInt(e.reps) || 10, rir: e.rir ?? 2,
        })),
      })),
    }));
    try { localStorage.setItem('he_pl_runtime', JSON.stringify({ days, focus: 'Макроцикл ' + (currentMicrocycle.mesocycleType || ''), week: selectedWeek, track: 'macro' })); } catch {}
    setTab('runtime');
  }, [currentMicrocycle, selectedWeek, tprofile, setTab]);

  const labAdj = labTrainingAdjust(labAnalysis);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: ACCENT }}>
        🛠 Конструктор тренировок
      </h2>
      <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5, marginBottom: 4 }}>
        Единый инструмент для построения тренировочных программ. Выберите режим: автоматический макроцикл или ручная сборка.
        Доступны все сплиты, циклы, программы, методики, калькуляторы и инструменты качества.
      </div>

      <div style={{
        display: 'flex', gap: 4, marginBottom: 6,
        padding: 6, borderRadius: 12,
        background: 'rgba(24,24,27,0.15)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <button onClick={() => setMode('macro')} style={{
          flex: 1, padding: '10px 6px', borderRadius: 9,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          border: mode === 'macro' ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.06)',
          background: mode === 'macro' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)',
          color: mode === 'macro' ? ACCENT : DIM,
        }}>📅 Макроцикл</button>
        <button onClick={() => setMode('manual')} style={{
          flex: 1, padding: '10px 6px', borderRadius: 9,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          border: mode === 'manual' ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.06)',
          background: mode === 'manual' ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)',
          color: mode === 'manual' ? ACCENT : DIM,
        }}>🛠 Ручная сборка</button>
      </div>

      <ConstructorProfile
        tprofile={tprofile} updateTProfile={updateTProfile}
        goal={goal} setGoal={setGoal}
        level={level} setLevel={setLevel}
        daysPerWeek={daysPerWeek} setDaysPerWeek={setDaysPerWeek}
        mesoLength={mesoLength} setMesoLength={setMesoLength}
        recovery={recovery} setRecovery={setRecovery}
        fatigue={fatigue} setFatigue={setFatigue}
        weakPoints={weakPoints} setWeakPoints={setWeakPoints}
        bodyWeight={bodyWeight} setBodyWeight={setBodyWeight}
        sleepHours={sleepHours} setSleepHours={setSleepHours}
        stressLevel={stressLevel} setStressLevel={setStressLevel}
      />

      {labAdj.warnings.length > 0 && (
        <div style={{
          marginTop: 4, padding: 10, borderRadius: 10,
          background: labAdj.deloadRecommended ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)',
          border: '1px solid ' + (labAdj.deloadRecommended ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'),
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: labAdj.deloadRecommended ? '#ef4444' : '#f59e0b', marginBottom: 4 }}>
            🧪 Лабораторная коррекция (MRV ×{labAdj.mrvMultiplier.toFixed(2)})
          </div>
          {labAdj.warnings.map((w: string, i: number) => (
            <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, marginBottom: 2 }}>• {w}</div>
          ))}
          {labAdj.intensityNote && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{labAdj.intensityNote}</div>}
        </div>
      )}

      {mode === 'manual' && (
        <>
          <ConfigPanel manualCfg={manualCfg} setManual={setManual} onLoadProgram={loadProgramToConstructor} />

          <div style={{ marginTop: 4 }}>
            <button onClick={generateManualPlan} style={{
              width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13,
            }}>🔧 Собрать программу</button>
            <div style={{ fontSize: 9, color: DIM, marginTop: 4, textAlign: 'center' }}>
              Соберёт план из выбранного сплита (или авто) + цель/уровень/дни/недели.
            </div>
          </div>

          <PlanDisplay
            result={manualResult}
            manualWorkMax={manualWorkMax}
            tprofile={tprofile}
            goal={goal} level={level}
            mesoLength={mesoLength} daysPerWeek={daysPerWeek}
            setResult={setManualResult}
            onToRuntime={manualToRuntime}
          />

          <ToolsPanel
            result={manualResult}
            setResult={setManualResult}
            manualCfg={manualCfg}
            tprofile={tprofile}
            goal={goal} level={level}
            mesoLength={mesoLength} daysPerWeek={daysPerWeek}
            manualWorkMax={manualWorkMax}
            labAnalysis={labAnalysis}
            onToRuntime={manualToRuntime}
          />
        </>
      )}

      {mode === 'macro' && (
        <MacrocyclePanel
          goal={goal} level={level}
          daysPerWeek={daysPerWeek}
          recovery={recovery} fatigue={fatigue}
          weakPoints={weakPoints}
          bodyWeight={bodyWeight}
          sleepHours={sleepHours} stressLevel={stressLevel}
          tprofile={tprofile} labAnalysis={labAnalysis}
          macrocycle={macrocycle}
          setMacrocycle={setMacrocycle}
          selectedWeek={selectedWeek}
          setSelectedWeek={setSelectedWeek}
          currentMicrocycle={currentMicrocycle}
          setCurrentMicrocycle={setCurrentMicrocycle}
          onToRuntime={macroToRuntime}
        />
      )}
    </div>
  );
};
