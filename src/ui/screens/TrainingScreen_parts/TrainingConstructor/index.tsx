import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { PCT_FOR_RIR, ACCENT, DIM, detectGroup, getMrv, type ManualResult } from './types';
const PHASE_LABELS_MAP: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка', gpp: 'GPP', spp: 'SPP' };
import { ConstructorProfile } from './ConstructorProfile';
import { ConfigPanel } from './ConfigPanel';
import { PlanDisplay } from './PlanDisplay';
import { ToolsPanel } from './ToolsPanel';
import { PlannerToolsPanel } from '../PlannerToolsPanel';
import { MacrocyclePanel } from './MacrocyclePanel';
import { subscribePlannerApply, getPlannerApply, clearPlannerApply, type PlannerApply } from '../planner-bridge';

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
  const [constTab, setConstTab] = useState<'params' | 'editor' | 'tools'>(() => {
    try { return (localStorage.getItem('he_constructor_tab') as 'params' | 'editor' | 'tools') || 'params'; } catch { return 'params'; }
  });
  useEffect(() => { try { localStorage.setItem('he_constructor_tab', constTab); } catch {} }, [constTab]);

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

  // 🔗 Адаптер: конвертация микроцикла макроцикла → ManualResult для редактора PlanDisplay
  const microcycleToManualResult = useCallback((mc: Microcycle, weekNum: number): ManualResult => {
    const wm: Record<string, number> = { chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60, full: 80, ...tprofile.workMax, ...manualWorkMax };
    const days = mc.days.filter((d: any) => d.isTraining).map((d: any, di: number) => ({
      day: di + 1,
      groups: Array.from(new Set((d.exercises || []).map((e: any) => detectGroup(e.name)))) as string[],
      exercises: (d.exercises || []).map((e: any) => {
        const g = detectGroup(e.name);
        const rir = e.rir ?? (e.rpe ? Math.max(0, 10 - e.rpe) : 2);
        const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, rir))] ?? 0.85;
        return { name: e.name, sets: e.sets || 3, reps: String(e.reps || 10), rir, rest: e.restSeconds || 120, group: g, weight: Math.round((wm[g] || 80) * pct) };
      }),
    }));
    return { splitName: `${PHASE_LABELS_MAP[mc.mesocycleType] || mc.mesocycleType} — Неделя ${weekNum}`, corrections: [`🔗 Неделя ${weekNum} из макроцикла (${mc.mesocycleType}). Объём ×${mc.volumeMultiplier}, RIR ${mc.rirRange?.[0] ?? 2}.`], days };
  }, [tprofile.workMax, manualWorkMax]);

  // При смене недели макроцикла → конвертировать в ManualResult для редактора (только при смене недели, не при смене workMax)
  const lastSyncedWeekRef = useRef<number>(-1);
  useEffect(() => {
    if (currentMicrocycle && macrocycle && selectedWeek !== lastSyncedWeekRef.current) {
      lastSyncedWeekRef.current = selectedWeek;
      setManualResult(microcycleToManualResult(currentMicrocycle, selectedWeek));
      setConstTab('editor'); // показать неделю в редакторе
    }
  }, [currentMicrocycle, selectedWeek, macrocycle, microcycleToManualResult]);

  const buildPlan = usePlanGeneration({
    goal, level, mesoLength, weakPoints,
    equipment: tprofile.equipment, workMax: tprofile.workMax,
    manualWorkMax, injuries: tprofile.injuries || [], pctForRir: PCT_FOR_RIR,
  });

  const [tempoAdjust, setTempoAdjust] = useState<{ eccentric: number; bottomPause: number; concentric: number; topPause: number; label?: string } | null>(null);
  const [mrvOverride, setMrvOverride] = useState<number | null>(null);
  const globalTempoStr = tempoAdjust ? `${tempoAdjust.eccentric}-${tempoAdjust.bottomPause}-${tempoAdjust.concentric}-${tempoAdjust.topPause}` : undefined;

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

    const mrv = mrvOverride ?? getMrv(level, tprofile.onCourse, tprofile.courseIntensity, labAdj.mrvMultiplier);
    corrections.push(`Допустимый объём (MRV): ${Math.round(mrv)} сетов/нед на группу${mrvOverride ? ' (из калькулятора MRV)' : ''}.`);
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
    lastSyncedWeekRef.current = -1; // разрыв синхронизации с макроциклом
    setManualResult({ splitName: sp.name, corrections, days: built.days });
    setConstTab('editor'); // показать собранный план
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints, manualCfg, tprofile, labAnalysis, buildPlan, mrvOverride]);

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
    lastSyncedWeekRef.current = -1; // разрыв синхронизации с макроциклом
    setManualResult({ splitName: prog.name + ' (неделя 1)', corrections, days });
    setConstTab('editor'); // показать загруженную программу
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

  // 🔗 приём корректировок из калькуляторов (planner-bridge): сплит/PRI/слабые точки/ПМ.
  const [applyPayload, setApplyPayload] = useState<PlannerApply | null>(() => getPlannerApply());
  useEffect(() => subscribePlannerApply(p => setApplyPayload(p)), []);
  // Очистка stale bridge-данных — внутри mountedRef useEffect ниже
  // Авто-применение: см. после applyExternal (перемещено ниже для корректного порядка)
  const pendingApplyRef = useRef<PlannerApply | null>(null);
  const applyExternal = useCallback(() => {
    const p = getPlannerApply();
    if (!p) return;
    const mrvBase = getMrv(level, tprofile.onCourse, tprofile.courseIntensity, labAdj.mrvMultiplier);
    if (p.kind === 'split' && p.data?.cycle) {
      const cycle: string[][] = p.data.cycle;
      const built = buildPlan(cycle, mrvBase);
      const corrections: string[] = [
        `🔗 Сплит применён из калькулятора: «${p.data.name || p.label}» (${cycle.length} дн).`,
        `Структура дней: ${cycle.map((g, i) => 'Д' + (i + 1) + ':' + g.join('+')).join(' | ')}.`,
        `Допустимый объём (MRV): ${Math.round(mrvBase)} сетов/нед на группу.`,
        ...built.groupCorrections,
      ];
      setManualResult({ splitName: p.data.name || p.label || 'Сплит из калькулятора', corrections, days: built.days });
    } else if (p.kind === 'pri') {
      const mult = (p.data?.volumeMult ?? 1) as number;
      const rirShift = (p.data?.rirShift ?? 0) as number;
      const cycle: string[][] = manualResult ? manualResult.days.map(d => d.groups) : [['full']];
      const built = buildPlan(cycle, Math.max(4, mrvBase * mult));
      built.days.forEach(d => d.exercises.forEach(e => { e.rir = Math.max(0, e.rir + rirShift); }));
      const corrections: string[] = [
        `🔗 PRI применён: объём ×${mult}, RIR +${rirShift}. MRV: ${Math.round(mrvBase)} → ${Math.round(Math.max(4, mrvBase * mult))}.`,
        ...built.groupCorrections,
      ];
      setManualResult({ splitName: manualResult?.splitName || 'План с PRI', corrections, days: built.days });
    } else if (p.kind === 'weakpoints') {
      const groups: string[] = p.data?.groups || [];
      setWeakPoints(groups);
      pendingApplyRef.current = p;
    } else if (p.kind === 'pm') {
      const pm = p.data || {};
      if (pm.lift && pm.value) { setManualWorkMax(w => ({ ...w, legs: pm.lift === 'squat' ? pm.value : w.legs, chest: pm.lift === 'bench' ? pm.value : w.chest, back: pm.lift === 'dead' ? pm.value : w.back })); }
      else { setManualWorkMax(w => ({ ...w, legs: pm.squat || w.legs, chest: pm.bench || w.chest, back: pm.dead || w.back })); }
      pendingApplyRef.current = p;
    } else if (p.kind === 'tempo') {
      setTempoAdjust(p.data ? { ...p.data } : null);
      if (manualResult) setManualResult({ ...manualResult, corrections: [...manualResult.corrections, `🔗 Темп применён ко всем упражнениям: ${p.data?.label || ''}.`] });
    } else if (p.kind === 'rir') {
      const shift = (p.data?.rirShift ?? 0) as number;
      if (manualResult) {
        const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, rir: Math.max(0, e.rir + shift) })) }));
        setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `🔗 RIR-коррекция: все RIR ${shift >= 0 ? '+' : ''}${shift}.`] });
      }
    } else if (p.kind === 'deload') {
      const dmult = (p.data?.volumeMult ?? 0.5) as number;
      const dshift = (p.data?.rirShift ?? 3) as number;
      if (manualResult) {
        const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, sets: Math.max(1, Math.round(e.sets * dmult)), rir: Math.max(0, e.rir + dshift) })) }));
        setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `🔗 Делод применён: объём ×${dmult}, RIR +${dshift}, недели ${(p.data?.weeks || []).join(', ')}.`] });
      }
    } else if (p.kind === 'peak') {
      const pmult = (p.data?.volumeMult ?? 0.5) as number;
      const ptarget = (p.data?.rirTarget ?? 0) as number;
      if (manualResult) {
        const days = manualResult.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e, sets: Math.max(1, Math.round(e.sets * pmult)), rir: Math.max(0, ptarget) })) }));
        setManualResult({ ...manualResult, days, corrections: [...manualResult.corrections, `🔗 Пик применён: объём ×${pmult}, RIR→${ptarget}.`] });
      }
    } else if (p.kind === 'mrv') {
      setMrvOverride((p.data?.mrv ?? null) as number | null); pendingApplyRef.current = p;
    } else if (p.kind === 'volume') {
      const sets = (p.data?.sets || {}) as Record<string, number>;
      if (manualResult) setManualResult({ ...manualResult, corrections: [...manualResult.corrections, `🔗 Целевой объём по группам: ${Object.entries(sets).map(([g, s]) => g + '=' + s).join(', ')} сет/нед.`] });
    }
    clearPlannerApply(); setApplyPayload(null);
    setConstTab('editor'); // показать результат в редакторе
  }, [buildPlan, level, tprofile, labAdj, manualResult, mrvOverride]);

  // Авто-применение bridge: только НОВЫЕ события (не stale данные при монтировании)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; clearPlannerApply(); setApplyPayload(null); return; }
    if (applyPayload) applyExternal();
  }, [applyPayload]);

  // достроить план после того, как weakPoints/ManualWorkMax обновились (buildPlan пересоздастся)
  useEffect(() => {
    const p = pendingApplyRef.current;
    if (!p) return;
    if (!manualResult) { pendingApplyRef.current = null; return; }
    pendingApplyRef.current = null;
    const cycle: string[][] = manualResult.days.map(d => d.groups);
    const mrv = mrvOverride ?? getMrv(level, tprofile.onCourse, tprofile.courseIntensity, labAdj.mrvMultiplier);
    const built = buildPlan(cycle, mrv);
    const corrections: string[] = [
      p.kind === 'weakpoints'
        ? `🔗 Слабые группы применены: ${(p.data?.groups || []).join(', ')} — приоритет объёма и ↓RIR.`
        : `🔗 ПМ применён к рабочим максимумам: присед→ноги, жим→грудь, тяга→спина.`,
      ...built.groupCorrections,
    ];
    setManualResult({ splitName: manualResult.splitName, corrections, days: built.days });
  }, [buildPlan, manualResult, weakPoints, manualWorkMax, level, tprofile, labAdj, mrvOverride]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: ACCENT }}>
        🛠 Конструктор тренировок
      </h2>
      <div style={{ fontSize: 11, color: DIM, lineHeight: 1.5, marginBottom: 4 }}>
        Единый инструмент: параметры → построение → редактирование → инструменты. Источник (авто/LMS/шаблон/программа) → макроцикл → недели → редактор.
      </div>

      {applyPayload && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.25)', fontSize: 11, color: ACCENT, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ Применено: {applyPayload.label}</span>
          <button onClick={() => { clearPlannerApply(); setApplyPayload(null); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, fontSize: 10, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{
        display: 'flex', gap: 4, marginBottom: 6,
        padding: 6, borderRadius: 12,
        background: 'rgba(24,24,27,0.15)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        {([['params','📋 Параметры'],['editor','✏️ Редактор'],['tools','🛠 Инструменты']] as const).map(([id,label]) => (
          <button key={id} onClick={() => setConstTab(id)} style={{
            flex: 1, padding: '10px 6px', borderRadius: 9,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: constTab === id ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.06)',
            background: constTab === id ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)',
            color: constTab === id ? ACCENT : DIM,
            position: 'relative' as const,
          }}>{label}{id === 'editor' && manualResult && <span style={{ position: 'absolute', top: 4, right: 8, width: 6, height: 6, borderRadius: 3, background: ACCENT }} />}{id === 'params' && macrocycle && <span style={{ position: 'absolute', top: 4, right: 8, width: 6, height: 6, borderRadius: 3, background: '#60a5fa' }} />}</button>
        ))}
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

      {constTab === 'editor' && (
        <>
          {manualResult && lastSyncedWeekRef.current > 0 && macrocycle && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 6, fontSize: 10, color: '#60a5fa', fontWeight: 700 }}>
              🔗 Синхронизировано с макроциклом, неделя {lastSyncedWeekRef.current}. Смена недели в «Параметры» обновит этот план.
            </div>
          )}
          {manualResult && (lastSyncedWeekRef.current <= 0 || !macrocycle) && (
            <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', marginBottom: 6, fontSize: 10, color: ACCENT, fontWeight: 700 }}>
              ✏️ Самостоятельный план (не из макроцикла). Редактируйте и отправляйте в выполнение.
            </div>
          )}
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
            globalTempoStr={globalTempoStr}
          />
        </>
      )}

      {constTab === 'params' && (
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
          setTab={setTab}
        />
      )}

      {constTab === 'tools' && (
        <>
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
        <PlannerToolsPanel mode="manual" />
        </>
      )}
    </div>
  );
};
