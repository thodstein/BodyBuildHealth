import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { getSplitOptions, type SplitCandidate } from '../../../../engines/split-selector.engine';
import { BLOCK_SEQUENCES, BLOCK_TYPES, getCurrentWeekPlan, generateMacrocycle, generateBlockPlan, type MacrocyclePlan, type Microcycle, type MacrocycleInput, type PlannedExercise } from '../../../../engines/training-periodization.engine';
import { calcTraining, LEVEL_VOLUMES } from '../../../../engines/training.engine';
import type { TrainingOutput, TrainingInput } from '../../../../core/types';
import { computeConstraints } from '../../../../engines/training-constraints.engine';
import { getPhaseParams, type GoalType } from '../../../../engines/cycle-periodization.engine';
import { generateWarmup } from '../../../../engines/warmup.engine';
import { generateCooldown } from '../../../../engines/cooldown.engine';
import { selectSetScheme } from '../../../../engines/set-scheme.engine';
import { RIR_MATRIX } from '../../../../engines/rir-matrix.engine';
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';
import { labTrainingAdjust } from '../lab-training-adjust';
import { WARMUP_LABELS, GROUP_LABELS, PHASE_LABELS, PHASE_HINTS } from '../shared';

import { GROUP_RU, ACCENT, DIM, getMrv, SET_TEMPLATES, PCT_FOR_RIR } from './types';
import type { TrainingProfile } from '../training-profile';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';
import { CYCLE_TEMPLATES } from '../../../../engines/cycle.engine';
import { buildMacroFromLMS, buildMacroFromTemplate, buildMacroFromCycleType, buildMacroFromConjugate, buildMacroFromMesocycleProgression, buildMacroFromCompetition } from '../../../../engines/macrocycle-sources';
import type { AttemptStrategy } from '../../../../engines/pro/taper.engine';
import type { CycleType } from '../../../../engines/cycle-periodization.engine';

// Блок I: пост-обработка макроцикла под выбранную схему сетов (SET_TEMPLATES)
function applySetSchemeToMacro(macro: MacrocyclePlan, schemeKey: string, workMax: Record<string, number>): MacrocyclePlan {
  const tpl = SET_TEMPLATES[schemeKey];
  if (!tpl) return macro;
  const wm: Record<string, number> = { chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60, full: 80, ...workMax };
  const rir = Math.max(0, Math.min(5, tpl.rir));
  const pct = PCT_FOR_RIR[rir] ?? 0.85;
  const mapEx = (e: PlannedExercise): PlannedExercise => ({ ...e, sets: tpl.sets, reps: tpl.reps, rir, rpe: 10 - rir, restSeconds: tpl.rest, weight: Math.round((wm[e.group] || wm.full || 80) * pct) });
  return {
    ...macro,
    mesocycles: macro.mesocycles.map(m => ({ ...m, microcycles: m.microcycles.map(mc => ({ ...mc, days: mc.days.map(d => ({ ...d, exercises: (d.exercises || []).map(mapEx) })) })) })),
  };
}

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
  setTab: (t: any) => void;
}

export const MacrocyclePanel: React.FC<Props> = ({
  goal, level, daysPerWeek, recovery, fatigue, weakPoints, bodyWeight,
  sleepHours, stressLevel, tprofile, labAnalysis,
  macrocycle, setMacrocycle, selectedWeek, setSelectedWeek,
  currentMicrocycle, setCurrentMicrocycle, onToRuntime,
  setTab,
}) => {
  const [splitType, setSplitType] = useState('auto');
  const [splitCandidates, setSplitCandidates] = useState<SplitCandidate[]>([]);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [periodizationType, setPeriodizationType] = useState<'auto' | 'linear' | 'undulating' | 'block' | 'conjugate'>('auto');
  const [cycleType, setCycleType] = useState('auto');
  const [mesoLength, setMesoLength] = useState(12);
  const [showWarmup, setShowWarmup] = useState(false);
  const [showCooldown, setShowCooldown] = useState(false);
  const [macroSource, setMacroSource] = useState<'auto' | 'lms' | 'template' | 'custom' | 'mesopro' | 'competition'>(() => {
    try { return (localStorage.getItem('he_macro_source') as 'auto' | 'lms' | 'template' | 'custom' | 'mesopro' | 'competition') || 'auto'; } catch { return 'auto'; }
  });
  useEffect(() => { try { localStorage.setItem('he_macro_source', macroSource); } catch {} }, [macroSource]);
  const [lmsCycleId, setLmsCycleId] = useState<string>(() => { try { return localStorage.getItem('he_macro_lms_id') || ''; } catch { return ''; } });
  useEffect(() => { try { localStorage.setItem('he_macro_lms_id', lmsCycleId); } catch {} }, [lmsCycleId]);
  const [templateId, setTemplateId] = useState<string>(() => { try { return localStorage.getItem('he_macro_tpl_id') || ''; } catch { return ''; } });
  useEffect(() => { try { localStorage.setItem('he_macro_tpl_id', templateId); } catch {} }, [templateId]);
  const [showLmsPicker, setShowLmsPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [lmsDirFilter, setLmsDirFilter] = useState<string>('all');
  const [mesoProCfg, setMesoProCfg] = useState<{ startVolumeSets: number; startIntensityPct: number; startRIR: number; mesoGoal: 'hypertrophy' | 'strength' | 'power' }>(() => {
    try { const v = JSON.parse(localStorage.getItem('he_macro_mesopro') || 'null'); if (v && typeof v.startVolumeSets === 'number') return v; } catch {}
    return { startVolumeSets: 16, startIntensityPct: 0.75, startRIR: 3, mesoGoal: 'hypertrophy' as const };
  });
  useEffect(() => { try { localStorage.setItem('he_macro_mesopro', JSON.stringify(mesoProCfg)); } catch {} }, [mesoProCfg]);
  const [mesoProFatigueText, setMesoProFatigueText] = useState<string>(() => { try { return localStorage.getItem('he_macro_mesopro_fat') || ''; } catch { return ''; } });
  useEffect(() => { try { localStorage.setItem('he_macro_mesopro_fat', mesoProFatigueText); } catch {} }, [mesoProFatigueText]);
  const [blockSeq, setBlockSeq] = useState<{ id: string; weeks: number }[]>(() => {
    try { const v = JSON.parse(localStorage.getItem('he_macro_blockseq') || 'null'); if (Array.isArray(v) && v.length) return v; } catch {}
    return (BLOCK_SEQUENCES[level] || BLOCK_SEQUENCES.intermediate) as { id: string; weeks: number }[];
  });
  useEffect(() => { try { localStorage.setItem('he_macro_blockseq', JSON.stringify(blockSeq)); } catch {} }, [blockSeq]);
  const [compCfg, setCompCfg] = useState<{ meetDate: string; strategy: AttemptStrategy; squat1RM: number; bench1RM: number; dead1RM: number }>(() => {
    try { const v = JSON.parse(localStorage.getItem('he_macro_comp') || 'null'); if (v && typeof v.meetDate === 'string') return v; } catch {}
    return { meetDate: '', strategy: 'balanced' as AttemptStrategy, squat1RM: tprofile.pmSquat || 120, bench1RM: tprofile.pmBench || 100, dead1RM: tprofile.pmDead || 140 };
  });
  useEffect(() => { try { localStorage.setItem('he_macro_comp', JSON.stringify(compCfg)); } catch {} }, [compCfg]);
  const [setSchemeOverride, setSetSchemeOverride] = useState<string>(() => { try { return localStorage.getItem('he_macro_setscheme') || ''; } catch { return ''; } });
  useEffect(() => { try { localStorage.setItem('he_macro_setscheme', setSchemeOverride); } catch {} }, [setSchemeOverride]);
  const [trainingOutput, setTrainingOutput] = useState<TrainingOutput | null>(null);

  const generatePlan = useCallback((overrideSplitType?: string) => {
    try {
      // Блок A: альтернативные источники макроцикла (LMS / шаблон)
      if (macroSource === 'lms' && lmsCycleId) {
        const cyc = LMS_CYCLES.find(cc => cc.meta.id === lmsCycleId);
        if (cyc) {
          const macroL = buildMacroFromLMS(cyc, { level, goal, workMax: tprofile.workMax, weeks: mesoLength, daysPerWeek });
          setMacrocycle(macroL); setSelectedWeek(1); setCurrentMicrocycle(getCurrentWeekPlan(macroL, 1));
          const outL = calcTraining({ goal, level, daysPerWeek, recovery: Math.max(0, Math.min(100, recovery)), fatigue: Math.max(0, Math.min(100, fatigue)), nutrition: 8, weakPoints, sessionDuration: 60, exercises: [], splitType, periodizationType, cycleType });
          setTrainingOutput(outL);
          return;
        }
      }
      if (macroSource === 'template' && templateId) {
        const tpl = CYCLE_TEMPLATES.find(tt => tt.id === templateId);
        if (tpl) {
          const macroT = buildMacroFromTemplate(tpl, { goal, level, weeks: mesoLength, recovery, daysPerWeek, weakPoints, injuries: (tprofile.injuries || []) as any });
          setMacrocycle(macroT); setSelectedWeek(1); setCurrentMicrocycle(getCurrentWeekPlan(macroT, 1));
          const outT = calcTraining({ goal, level, daysPerWeek, recovery: Math.max(0, Math.min(100, recovery)), fatigue: Math.max(0, Math.min(100, fatigue)), nutrition: 8, weakPoints, sessionDuration: 60, exercises: [], splitType, periodizationType, cycleType });
          setTrainingOutput(outT);
          return;
        }
      }
      if (macroSource === 'mesopro') {
        const fatArr = mesoProFatigueText.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n >= 0 && n <= 100);
        const macroM = buildMacroFromMesocycleProgression({ goal, level, weeks: mesoLength, daysPerWeek, weakPoints, injuries: (tprofile.injuries || []) as any, startVolumeSets: mesoProCfg.startVolumeSets, startIntensityPct: mesoProCfg.startIntensityPct, startRIR: mesoProCfg.startRIR, mesoGoal: mesoProCfg.mesoGoal, fatigueTrajectory: fatArr.length ? fatArr : undefined });
        setMacrocycle(macroM); setSelectedWeek(1); setCurrentMicrocycle(getCurrentWeekPlan(macroM, 1));
        const outM = calcTraining({ goal, level, daysPerWeek, recovery: Math.max(0, Math.min(100, recovery)), fatigue: Math.max(0, Math.min(100, fatigue)), nutrition: 8, weakPoints, sessionDuration: 60, exercises: [], splitType, periodizationType, cycleType });
        setTrainingOutput(outM);
        return;
      }
      if (macroSource === 'competition') {
        const macroComp = buildMacroFromCompetition({ goal, level, weeks: mesoLength, daysPerWeek, weakPoints, injuries: (tprofile.injuries || []) as any, workMax: tprofile.workMax, meetDate: compCfg.meetDate || new Date().toISOString().slice(0, 10), current1RM: { squat: compCfg.squat1RM, bench: compCfg.bench1RM, deadlift: compCfg.dead1RM }, fatigue, strategy: compCfg.strategy });
        setMacrocycle(macroComp); setSelectedWeek(1); setCurrentMicrocycle(getCurrentWeekPlan(macroComp, 1));
        const outComp = calcTraining({ goal, level, daysPerWeek, recovery: Math.max(0, Math.min(100, recovery)), fatigue: Math.max(0, Math.min(100, fatigue)), nutrition: 8, weakPoints, sessionDuration: 60, exercises: [], splitType, periodizationType, cycleType });
        setTrainingOutput(outComp);
        return;
      }
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
        isOnCourse: tprofile.onCourse,
        courseIntensity: tprofile.courseIntensity,
        weakPoints, injuries: (tprofile.injuries || []) as any,
        experience: level as MacrocycleInput['experience'],
        currentWeek: 1,
        periodizationType, cycleType,
        blockSequence: blockSeq.length ? (blockSeq as unknown as MacrocycleInput['blockSequence']) : undefined,
      };
      let macro: MacrocyclePlan;
      if (periodizationType === 'conjugate') {
        macro = buildMacroFromConjugate({ goal, level, weeks: mesoLength, daysPerWeek, workMax: tprofile.workMax });
      } else if (periodizationType === 'block') {
        macro = generateBlockPlan(macroInput);
      } else if (cycleType !== 'auto') {
        macro = buildMacroFromCycleType({ cycleType: cycleType as CycleType, goal, level, weeks: mesoLength, recovery, fatigue, daysPerWeek, weakPoints, injuries: (tprofile.injuries || []) as any });
      } else {
        macro = generateMacrocycle(macroInput);
      }
      if (setSchemeOverride) macro = applySetSchemeToMacro(macro, setSchemeOverride, tprofile.workMax);
      setMacrocycle(macro);
      setSelectedWeek(1);
      setCurrentMicrocycle(getCurrentWeekPlan(macro, 1));
    } catch (e) { console.error('Macrocycle gen error:', e); }
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints, splitType, periodizationType, cycleType, setMacrocycle, setSelectedWeek, setCurrentMicrocycle, macroSource, lmsCycleId, templateId, tprofile, mesoLength, mesoProCfg, mesoProFatigueText, blockSeq, compCfg, setSchemeOverride]);

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

        {(() => {
          const baseMrv = LEVEL_VOLUMES[level]?.mrv ?? 20;
          const courseMult = tprofile.onCourse ? (tprofile.courseIntensity === 'heavy' ? 1.3 : tprofile.courseIntensity === 'mild' ? 1.15 : 1.2) : 1;
          const effMrv = baseMrv * courseMult * labAdj.mrvMultiplier;
          return (
            <div style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.12)', fontSize: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: ACCENT }}>🎯 MRV: {effMrv.toFixed(0)} сетов/нед</span>
              <span style={{ color: DIM }}>база {baseMrv} × курс ×{courseMult.toFixed(2)}{tprofile.onCourse ? ' (' + tprofile.courseIntensity + ')' : ''} × лаб ×{labAdj.mrvMultiplier.toFixed(2)}</span>
              {tprofile.onCourse && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(168,85,247,0.15)', color: '#a855f7', fontWeight: 700 }}>⚡ на курсе</span>}
            </div>
          );
        })()}

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 10, color: DIM, marginBottom: 2, display: 'block' }}>Источник макроцикла</label>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {[
              { v: 'auto', l: '🤖 Авто', d: 'Движок сам строит макроцикл' },
              { v: 'lms', l: '📋 Силовой цикл (28)', d: 'Реальные раскладки с прогрессией ПМ' },
              { v: 'template', l: '📐 Шаблон фаз (12)', d: 'Шаблоны bulk/cut/strength/recomp/rehab' },
              { v: 'custom', l: '🛠 Свой', d: 'Полностью ручная конфигурация ниже' },
              { v: 'mesopro', l: '📈 PRO мезо', d: 'Проф. кривые V/I/RIR + усталость' },
              { v: 'competition', l: '🏆 Соревн.', d: 'Taper + прикиды + пиковая неделя' },
            ].map(s => (
              <button key={s.v} onClick={() => { setMacroSource(s.v as any); setTimeout(generatePlan, 60); }} title={s.d} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9, fontWeight: macroSource === s.v ? 700 : 400, cursor: 'pointer', border: macroSource === s.v ? '1px solid var(--accent)' : '1px solid var(--border)', background: macroSource === s.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)' }}>{s.l}</button>
            ))}
          </div>
        </div>

        {macroSource === 'lms' && (
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: DIM, marginBottom: 2, display: 'block' }}>Готовый силовой цикл (реальная раскладка × прогрессия ПМ)</label>
            <button onClick={() => { setShowLmsPicker(!showLmsPicker); }} style={{ width: '100%', padding: '6px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{lmsCycleId ? (LMS_CYCLES.find(cc => cc.meta.id === lmsCycleId)?.meta.title || lmsCycleId) : 'Выбрать цикл из 28...'}</span>
              <span style={{ fontSize: 9, color: DIM }}>{showLmsPicker ? '▴' : '▾'}</span>
            </button>
            {showLmsPicker && (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                  {[{v:'all',l:'Все'},{v:'powerlifting',l:'Троеборье'},{v:'bench',l:'Жим'},{v:'bodybuilding',l:'ББ'},{v:'weightlifting',l:'ТА'},{v:'deadlift_bench',l:'Тяга+Жим'},{v:'armwrestling',l:'Армрестлинг'}].map(df => (
                    <button key={df.v} onClick={() => setLmsDirFilter(df.v)} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, cursor: 'pointer', border: lmsDirFilter === df.v ? '1px solid var(--accent)' : '1px solid var(--border)', background: lmsDirFilter === df.v ? 'rgba(0,230,138,0.12)' : 'var(--bg-secondary)', color: lmsDirFilter === df.v ? ACCENT : DIM }}>{df.l}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 240, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: 8, padding: '4px 6px', border: '1px solid var(--border)' }}>
                  {LMS_CYCLES.filter(cc => lmsDirFilter === 'all' || cc.meta.direction === lmsDirFilter).map(cc => {
                    const active = lmsCycleId === cc.meta.id;
                    return (
                      <div key={cc.meta.id} onClick={() => { setLmsCycleId(cc.meta.id); setShowLmsPicker(false); setTimeout(() => generatePlan(), 60); }} style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, background: active ? 'rgba(0,230,138,0.12)' : 'transparent', border: active ? '1px solid var(--accent)' : '1px solid transparent' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600 }}>{cc.meta.title}</span>
                          <span style={{ fontSize: 8, color: DIM, whiteSpace: 'nowrap' }}>{cc.meta.weeks}н · {cc.meta.sessionsPerWeek}тр · {cc.meta.level}</span>
                        </div>
                        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>{cc.meta.period} · ПМ×{(1 + (cc.meta.correctionPct || 0)).toFixed(3)}/нед{cc.meta.minBodyWeight ? ' · ≥' + cc.meta.minBodyWeight + 'кг' : ''}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {macroSource === 'template' && (
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 10, color: DIM, marginBottom: 2, display: 'block' }}>Шаблон фаз (CYCLE_TEMPLATES)</label>
            <button onClick={() => { setShowTemplatePicker(!showTemplatePicker); }} style={{ width: '100%', padding: '6px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{templateId ? (CYCLE_TEMPLATES.find(tt => tt.id === templateId)?.name || templateId) : 'Выбрать шаблон из 12...'}</span>
              <span style={{ fontSize: 9, color: DIM }}>{showTemplatePicker ? '▴' : '▾'}</span>
            </button>
            {showTemplatePicker && (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 240, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: 8, padding: '4px 6px', border: '1px solid var(--border)' }}>
                {CYCLE_TEMPLATES.map(tt => {
                  const active = templateId === tt.id;
                  const fitGoal = tt.goals.includes(goal);
                  const fitLevel = tt.levels.includes(level);
                  return (
                    <div key={tt.id} onClick={() => { setTemplateId(tt.id); setShowTemplatePicker(false); setTimeout(() => generatePlan(), 60); }} style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, background: active ? 'rgba(0,230,138,0.12)' : 'transparent', border: active ? '1px solid var(--accent)' : '1px solid transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{tt.name}</span>
                        <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: (fitGoal && fitLevel) ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: (fitGoal && fitLevel) ? '#22c55e' : '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>{tt.minWeeks}-{tt.maxWeeks}н · {tt.intensityProfile}</span>
                      </div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>{tt.description}</div>
                      <div style={{ fontSize: 7, color: DIM, marginTop: 1 }}>цели: {tt.goals.join(', ')} · уровни: {tt.levels.join(', ')}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {macroSource === 'mesopro' && (() => {
          const setV = (n: number) => setMesoProCfg(p => ({ ...p, startVolumeSets: n }));
          const setI = (n: number) => setMesoProCfg(p => ({ ...p, startIntensityPct: n }));
          const setR = (n: number) => setMesoProCfg(p => ({ ...p, startRIR: n }));
          const setG = (g: 'hypertrophy' | 'strength' | 'power') => setMesoProCfg(p => ({ ...p, mesoGoal: g }));
          return (
            <div style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>📈 PRO кривая мезоцикла (V / I / RIR + усталость)</span><button onClick={() => setTab('meso_progression')} style={{ padding: '2px 6px', borderRadius: 5, fontSize: 8, cursor: 'pointer', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.06)', color: '#8b5cf6', fontWeight: 700 }}>полная во вкладке →</button></div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}><span>Стартовый объём, сетов/нед</span><span style={{ color: ACCENT, fontWeight: 700 }}>{Math.round(mesoProCfg.startVolumeSets)}</span></div>
                <input type='range' min={8} max={32} step={1} value={mesoProCfg.startVolumeSets} onChange={e => setV(parseFloat(e.target.value) || 16)} style={{ width: '100%', accentColor: '#8b5cf6' }} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}><span>Стартовая интенсивность, %1RM</span><span style={{ color: ACCENT, fontWeight: 700 }}>{Math.round(mesoProCfg.startIntensityPct * 100)}%</span></div>
                <input type='range' min={0.6} max={0.85} step={0.01} value={mesoProCfg.startIntensityPct} onChange={e => setI(parseFloat(e.target.value) || 0.75)} style={{ width: '100%', accentColor: '#8b5cf6' }} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}><span>Стартовый RIR</span><span style={{ color: ACCENT, fontWeight: 700 }}>{mesoProCfg.startRIR}</span></div>
                <input type='range' min={0} max={4} step={1} value={mesoProCfg.startRIR} onChange={e => setR(parseInt(e.target.value) || 3)} style={{ width: '100%', accentColor: '#8b5cf6' }} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, marginBottom: 2 }}>Цель мезоцикла</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {[{v:'hypertrophy',l:'Гипертрофия'},{v:'strength',l:'Сила'},{v:'power',l:'Мощность'}].map(g => (
                    <button key={g.v} onClick={() => setG(g.v as 'hypertrophy' | 'strength' | 'power')} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: mesoProCfg.mesoGoal === g.v ? '1px solid #8b5cf6' : '1px solid var(--border)', background: mesoProCfg.mesoGoal === g.v ? 'rgba(139,92,246,0.15)' : 'var(--bg-secondary)', color: mesoProCfg.mesoGoal === g.v ? '#8b5cf6' : DIM, fontWeight: mesoProCfg.mesoGoal === g.v ? 700 : 400 }}>{g.l}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 10, marginBottom: 2 }}>Траектория усталости по неделям (0-100, через запятую). &gt;70 → −10% объёма</div>
                <input type='text' value={mesoProFatigueText} onChange={e => setMesoProFatigueText(e.target.value)} placeholder='напр. 30,40,50,65,75,80,40,20' style={{ width: '100%', padding: '5px 7px', borderRadius: 6, background: '#18181b', color: '#fff', border: '1px solid var(--border)', fontSize: 10, boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ fontSize: 8, color: DIM }}>Кривая: объём растёт по фазам (base→build→peak), интенсивность ↑, RIR ↓. Неделя deload = 50% объёма.</div>
            </div>
          );
        })()}

        {macroSource === 'competition' && (() => {
          const setC = (k: 'meetDate' | 'strategy' | 'squat1RM' | 'bench1RM' | 'dead1RM', v: any) => setCompCfg(p => ({ ...p, [k]: v }));
          const taperW = Math.max(1, Math.min(3, compCfg.meetDate ? 3 : 2));
          return (
            <div style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>🏆 Соревновательный режим (taper + прикиды)</span><button onClick={() => setTab('calc_taper')} style={{ padding: '2px 6px', borderRadius: 5, fontSize: 8, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontWeight: 700 }}>taper-планер →</button></div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, marginBottom: 2 }}>Дата соревнований</div>
                <input type='date' value={compCfg.meetDate} onChange={e => setC('meetDate', e.target.value)} style={{ width: '100%', padding: '5px 7px', borderRadius: 6, background: '#18181b', color: '#fff', border: '1px solid var(--border)', fontSize: 10, boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, marginBottom: 2 }}>Стратегия прикидов</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {[{v:'conservative',l:'Консерв.'},{v:'balanced',l:'Баланс'},{v:'aggressive',l:'Агрессив.'}].map(s => (
                    <button key={s.v} onClick={() => setC('strategy', s.v as AttemptStrategy)} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: compCfg.strategy === s.v ? '1px solid #ef4444' : '1px solid var(--border)', background: compCfg.strategy === s.v ? 'rgba(239,68,68,0.15)' : 'var(--bg-secondary)', color: compCfg.strategy === s.v ? '#ef4444' : DIM, fontWeight: compCfg.strategy === s.v ? 700 : 400 }}>{s.l}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, marginBottom: 2 }}>Текущие 1ПМ (кг) — основа для taper и прикидов</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <label style={{ flex: 1, fontSize: 8, color: DIM }}>Присед<input type='number' value={compCfg.squat1RM} onChange={e => setC('squat1RM', parseFloat(e.target.value) || 120)} style={{ width: '100%', padding: '4px 6px', borderRadius: 5, background: '#18181b', color: '#fff', border: '1px solid var(--border)', fontSize: 10, boxSizing: 'border-box' as const }} /></label>
                  <label style={{ flex: 1, fontSize: 8, color: DIM }}>Жим<input type='number' value={compCfg.bench1RM} onChange={e => setC('bench1RM', parseFloat(e.target.value) || 100)} style={{ width: '100%', padding: '4px 6px', borderRadius: 5, background: '#18181b', color: '#fff', border: '1px solid var(--border)', fontSize: 10, boxSizing: 'border-box' as const }} /></label>
                  <label style={{ flex: 1, fontSize: 8, color: DIM }}>Тяга<input type='number' value={compCfg.dead1RM} onChange={e => setC('dead1RM', parseFloat(e.target.value) || 140)} style={{ width: '100%', padding: '4px 6px', borderRadius: 5, background: '#18181b', color: '#fff', border: '1px solid var(--border)', fontSize: 10, boxSizing: 'border-box' as const }} /></label>
                </div>
              </div>
              <div style={{ fontSize: 8, color: DIM }}>Taper: {taperW} нед (по усталости {fatigue}/10). Объём ↓, интенсивность удерживается. Последние тяжёлые: тяга −12д, присед −8д, жим −4д. Пик-неделя = прикиды + старт.</div>
            </div>
          );
        })()}

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
              { v: 'conjugate', l: 'Сопряжённая', desc: 'Westside: ME/DE/RE дни, ротация вариаций' },
            ].map(p => (
              <button key={p.v} onClick={() => { setPeriodizationType(p.v as 'auto' | 'linear' | 'undulating' | 'block' | 'conjugate'); setTimeout(generatePlan, 50); }} style={{ padding: '3px 7px', borderRadius: 6, fontSize: 9, fontWeight: periodizationType === p.v ? 700 : 400, cursor: 'pointer', border: periodizationType === p.v ? '1px solid var(--accent)' : '1px solid var(--border)', background: periodizationType === p.v ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: 'var(--text)' }} title={p.desc}>{p.l}</button>
            ))}
          </div>
          {periodizationType === 'block' && (() => {
            const colors: Record<string,string> = { accumulation:'#22c55e', transmutation:'#3b82f6', realization:'#f97316', active_rest:'#eab308' };
            const labels: Record<string,string> = { accumulation:'Аккумуляция', transmutation:'Трансмутация', realization:'Реализация', active_rest:'Активный отдых' };
            const short: Record<string,string> = { accumulation:'Акк', transmutation:'Транс', realization:'Реал', active_rest:'Отдых' };
            const bt = BLOCK_TYPES as any;
            const move = (idx: number, dir: -1 | 1) => { const ni = idx + dir; if (ni < 0 || ni >= blockSeq.length) return; const arr = [...blockSeq]; const [it] = arr.splice(idx, 1); arr.splice(ni, 0, it); setBlockSeq(arr); };
            const setWeeks = (idx: number, n: number) => setBlockSeq(prev => prev.map((b, i) => i === idx ? { ...b, weeks: Math.max(1, Math.min(6, n)) } : b));
            const removeB = (idx: number) => setBlockSeq(prev => prev.filter((_, i) => i !== idx));
            const addBlock = (id: string) => setBlockSeq(prev => [...prev, { id, weeks: id === 'realization' || id === 'active_rest' ? 1 : 3 }]);
            const totalW = blockSeq.reduce((s, b) => s + b.weeks, 0);
            return (
              <div style={{ marginTop: 4, padding: 8, borderRadius: 8, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>🧱 Редактор блоков (Issurin)</span>
                  <span style={{ fontSize: 9, color: DIM }}>Σ {totalW} нед · {blockSeq.length} блк</span>
                  <button onClick={() => setTab('periodization_designer')} style={{ padding: '2px 6px', borderRadius: 5, fontSize: 8, cursor: 'pointer', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)', color: '#22c55e', fontWeight: 700 }}>дизайнер →</button>
                </div>
                {blockSeq.length === 0 && <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Блоки не выбраны — добавьте ниже или сбросьте к уровню.</div>}
                {blockSeq.map((b, idx) => {
                  const info = bt[b.id] || bt.accumulation;
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, padding: '4px 6px', borderRadius: 6, background: (colors[b.id] || '#888') + '12', border: '1px solid ' + (colors[b.id] || '#888') + '30' }}>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: (colors[b.id] || '#888') + '22', color: colors[b.id] || '#888', fontWeight: 700, whiteSpace: 'nowrap' }}>{short[b.id] || b.id}</span>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', flex: 1 }}>{labels[b.id] || b.id}: V×{info.volumeMultiplier} · I×{info.intensityMultiplier} · RIR {info.rirTarget}</span>
                      <input type='number' min={1} max={6} value={b.weeks} onChange={e => setWeeks(idx, parseInt(e.target.value) || 1)} style={{ width: 38, padding: '2px 4px', borderRadius: 4, background: '#18181b', color: '#fff', border: '1px solid var(--border)', fontSize: 9, textAlign: 'center' }} />
                      <span style={{ fontSize: 8, color: DIM }}>нд</span>
                      <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ padding: '2px 5px', fontSize: 9, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3 }}>↑</button>
                      <button onClick={() => move(idx, 1)} disabled={idx === blockSeq.length - 1} style={{ padding: '2px 5px', fontSize: 9, cursor: idx === blockSeq.length - 1 ? 'default' : 'pointer', opacity: idx === blockSeq.length - 1 ? 0.3 : 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3 }}>↓</button>
                      <button onClick={() => removeB(idx)} style={{ padding: '2px 5px', fontSize: 9, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 3 }}>✕</button>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 8, color: DIM }}>+ доб:</span>
                  {(['accumulation','transmutation','realization','active_rest'] as const).map(id => (
                    <button key={id} onClick={() => addBlock(id)} style={{ padding: '2px 6px', fontSize: 8, cursor: 'pointer', border: '1px solid ' + (colors[id] || '#888') + '40', background: (colors[id] || '#888') + '14', color: colors[id] || '#888', borderRadius: 4 }}>{short[id]}</button>
                  ))}
                  <button onClick={() => setBlockSeq((BLOCK_SEQUENCES[level] || BLOCK_SEQUENCES.intermediate) as { id: string; weeks: number }[])} style={{ padding: '2px 6px', fontSize: 8, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: ACCENT, borderRadius: 4 }}>↺ Сброс к «{level}»</button>
                </div>
              </div>
            );
          })()}
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 10, color: DIM, marginBottom: 2, display: 'block' }}>Тип цикла</label>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {[
              { v: 'auto', l: 'Авто' },
              { v: 'pl_base', l: 'PL База' }, { v: 'pl_volume', l: 'PL Объём' }, { v: 'pl_intensity', l: 'PL Интенс' }, { v: 'pl_peaking', l: 'PL Пик' },
              { v: 'bb_mass', l: 'BB Масса' }, { v: 'bb_specialization', l: 'BB Спец' }, { v: 'bb_weakpoint', l: 'BB Слаб.зона' }, { v: 'bb_contest', l: 'BB Соревн.' },
              { v: 'wl_technique', l: 'WL Техника' }, { v: 'wl_strength', l: 'WL Сила' },
              { v: 'cf_conditioning', l: 'CF Кондиция' }, { v: 'cf_strength', l: 'CF Сила' },
              { v: 'rehab', l: 'Реаб.' },
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

        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 10, color: DIM, marginBottom: 2, display: 'block' }}>Схема сетов (переопределение)</label>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <button onClick={() => { setSetSchemeOverride(''); setTimeout(generatePlan, 50); }} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: setSchemeOverride === '' ? '1px solid var(--accent)' : '1px solid var(--border)', background: setSchemeOverride === '' ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: setSchemeOverride === '' ? ACCENT : DIM, fontWeight: setSchemeOverride === '' ? 700 : 400 }}>Авто</button>
            {Object.entries(SET_TEMPLATES).map(([k, t]: [string, any]) => (
              <button key={k} onClick={() => { setSetSchemeOverride(k); setTimeout(generatePlan, 50); }} title={`${t.sets}×${t.reps} · RIR ${t.rir} · отдых ${t.rest}с`} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: setSchemeOverride === k ? '1px solid var(--accent)' : '1px solid var(--border)', background: setSchemeOverride === k ? 'rgba(0,230,138,0.15)' : 'var(--bg-secondary)', color: setSchemeOverride === k ? ACCENT : DIM, fontWeight: setSchemeOverride === k ? 700 : 400 }}>{k}</button>
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
              riskFlags: (tprofile.injuries || []).reduce((acc: Record<string, string>, inj: any) => { if (inj.muscle) acc[inj.muscle] = 'injured'; return acc; }, {} as Record<string, string>),
              techniqueIssues: [],
              fatigueLevel: fatigue / 10,
              equipmentAvailable: (tprofile.equipment && tprofile.equipment.length) ? tprofile.equipment : ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
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
                {(() => {
                  const goalMap: Record<string, any> = { strength: 'strength', bulk: 'hypertrophy', cut: 'conditioning', recomp: 'hypertrophy', maintenance: 'hypertrophy', rehab: 'rehab' };
                  const phaseMap: Record<string, any> = { accumulation: 'accumulation', intensification: 'intensification', peaking: 'peaking', deload: 'deload', recovery: 'deload' };
                  const ph = phaseMap[currentMicrocycle.mesocycleType as string];
                  if (!ph) return null;
                  try {
                    const pp = getPhaseParams({ goal: goalMap[goal] || 'hypertrophy', phase: ph, analytics: { fatigue: fatigue / 10, recovery: recovery / 10, risk: 0 } });
                    const lvlRu: Record<string, string> = { very_low: 'оч.низк', low: 'низк', medium: 'сред', high: 'выс', very_high: 'оч.выс' };
                    const priRu: Record<string, string> = { volume: 'объём', intensity: 'интенс', peak: 'пик', recovery: 'восст', general: 'общ', specific: 'спец' };
                    return <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginLeft: 6 }}>· фаза: V={lvlRu[pp.volumeLevel]||pp.volumeLevel} I={lvlRu[pp.intensityLevel]||pp.intensityLevel} F={lvlRu[pp.frequencyLevel]||pp.frequencyLevel} · потолок уст. {Math.round(pp.fatigueCeiling*100)}% · приоритет {priRu[pp.priority]||pp.priority}</span>;
                  } catch { return null; }
                })()}
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
              fatigueScore: fatigue / 10, riskFlags: (tprofile.injuries || []).reduce((acc: Record<string, string>, inj: any) => { if (inj.muscle) acc[inj.muscle] = 'injured'; return acc; }, {} as Record<string, string>),
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

          {(() => {
            return (
              <div className="card" style={{ padding: '8px 10px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT }}>📐 Справочные инструменты (без дублирования):</span>
                <button onClick={() => setTab('volume')} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, fontWeight: 700 }}>📐 Volume Landmarks (MEV/MAV/MRV) →</button>
                <button onClick={() => setTab('methods')} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, fontWeight: 700 }}>📚 Методики →</button>
                <button onClick={() => setTab('meso_progression')} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.06)', color: '#8b5cf6', fontWeight: 700 }}>📈 Полная кривая мезо →</button>
                <button onClick={() => setTab('calc_taper')} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontWeight: 700 }}>🔻 Taper-планер →</button>
                <button onClick={() => setTab('periodization_designer')} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.06)', color: '#22c55e', fontWeight: 700 }}>🎨 Дизайнер периодизации →</button>
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

