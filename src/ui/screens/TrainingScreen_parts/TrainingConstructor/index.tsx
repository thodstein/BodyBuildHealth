import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { selectSplit } from '../../../../engines/split-selector.engine';
import { TRAINING_SPLITS, calcTraining, LEVEL_VOLUMES } from '../../../../engines/training.engine';
import { LMS_CYCLES } from '../../../../data/lms-cycles/lms-cycle-index';
import { FULL_PROGRAM_LIBRARY } from '../../../../engines/complete-program-library.engine';
import { WOMENS_PROGRAMS, CUSTOM_PROGRAMS } from '../programs-data';
import type { FullProgram, ProgramDay } from '../../../../engines/complete-program-library.engine';
import { labTrainingAdjust } from '../lab-training-adjust';
import { PopupSelect } from '../../SRCBBScreen_parts/TrainingPopups';
import { usePlanGeneration } from '../../../hooks/usePlanGeneration';
import { generateMacrocycle, getCurrentWeekPlan, type MacrocyclePlan, type Microcycle, type MacrocycleInput } from '../../../../engines/training-periodization.engine';
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';
import { TrainingProfileCard } from '../TrainingProfileCard';
import type { TrainingProfile } from '../training-profile';
import { PCT_FOR_RIR, ACCENT, DIM, detectGroup, getMrv, getPerMuscleMrvFromLevel, CONFIG_LABELS, DELOAD_OPTIONS, RIR_WAVE_PATTERNS, GROUP_RU, type ManualResult, type ManualDay, type ManualWeek, type ManualExercise } from './types';
import { buildPhasePlan, PHASE_CONFIGS, PHASE_LABELS, distributePhases, getRirForWeek, calcPhaseWeight, type BBPhase } from './phase-periodization';
const PHASE_LABELS_MAP: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка', gpp: 'GPP', spp: 'SPP' };
function phaseForCycleWeek(week: number, cycle: import('../../../../data/lms-cycles/lms-types').SRCycleTemplate): string {
  const ph = cycle.meta.phases;
  if (ph && ph.length > 0) {
    const p = ph.find(p => week >= p.weekStart && week <= p.weekEnd);
    if (p?.title) return p.title.toLowerCase().includes('накоп') ? 'accumulation' : p.title.toLowerCase().includes('интен') ? 'intensification' : p.title.toLowerCase().includes('пик') ? 'peaking' : p.title.toLowerCase().includes('загруз') ? 'intensification' : p.title.toLowerCase().includes('втяг') ? 'accumulation' : p.title.toLowerCase().includes('памп') ? 'peaking' : p.title?.toLowerCase().includes('разгр') ? 'deload' : 'intensification';
  }
  if (cycle.meta.deloadWeeks?.includes(week)) return 'deload';
  const total = cycle.meta.weeks;
  if (total <= 6) return week <= Math.ceil(total * 0.5) ? 'accumulation' : 'intensification';
  const prePeak = cycle.meta.deloadWeeks && cycle.meta.deloadWeeks.length > 0 ? Math.min(...cycle.meta.deloadWeeks) : Math.ceil(total * 0.7);
  return week < prePeak ? 'accumulation' : 'intensification';
}
import { ConstructorProfile } from './ConstructorProfile';
import { PlanDisplay } from './PlanDisplay';
import { ToolsPanel } from './ToolsPanel';
import { getMethodsByCategory, type TrainingMethod } from '../../../../engines/training-methodology.engine';
import { MacrocyclePanel } from './MacrocyclePanel';
import { subscribePlannerApply, getPlannerApply, clearPlannerApply, type PlannerApply } from '../planner-bridge';
import { SplitSelectorCards } from './SplitSelectorCards';
import { MethodSelector } from './MethodSelector';
import { WizardProgressBar } from './WizardProgressBar';
import { PlanPreviewStep5 } from './PlanPreviewStep5';
import { buildBBPlan, type BBPlan, type BBWeek } from '../../../../engines/bb/bb-builder.engine';
import { SPLIT_PATTERNS } from '../../../../engines/bb/bb-split-patterns';
import { calcBBPlanMetrics } from '../../../../engines/bb/bb-metrics.engine';
import { adaptForPEDs, type PED } from '../../../../engines/bb/bb-ped-adaptation.engine';
import { prescribeLoad, DELOAD_PROTOCOLS, applyDeloadToWeek, rirDrift, phaseExerciseMix, type LoadStrategy, type DeloadType } from '../../../../engines/bb/bb-autocoach.engine';
import { getAllVolumeLandmarks } from '../../../../engines/volume-landmarks.engine';
import { convertCycleToBBPlan } from '../../../../engines/bb/cycle-to-plan';
import { getCycleById } from '../../../../data/lms-cycles/lms-cycle-index';
import { acuteChronicRatio, toDailyLoads } from '../../../../engines/pro/training-load.engine';
import { loadSRPESessions } from '../../../../engines/pro/srpe-store';

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

/* ─── Вспомогательные PopupSelect-обёртки ─── */
const Sel: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string; desc?: string }[]; hint?: string }> =
  ({ label, value, onChange, options, hint }) => (
    <PopupSelect label={label} value={value} onChange={onChange} options={options} hint={hint} />
  );



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
  const [wizardStep, setWizardStep] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem('he_manual_cfg') || '{}'); if (typeof s.wizardStep === 'number') return s.wizardStep; } catch {}
    return 1;
  });
  const [readinessSlider, setReadinessSlider] = useState((tprofile.recovery ?? 7) * 10);
  const [targetTonnage, setTargetTonnage] = useState<Record<string, number>>({});

  const [manualCfg, setManualCfg] = useState<Record<string, string>>(() => {
    try { const s = JSON.parse(localStorage.getItem('he_manual_cfg') || 'null'); if (s && s.manualCfg) return s.manualCfg; } catch {}
    return {};
  });
  const setManual = useCallback((k: string, v: string) => setManualCfg(p => ({ ...p, [k]: v })), []);
  const [manualWorkMax, setManualWorkMax] = useState<Record<string, number>>(() => ({
    chest: tprofile.workMax?.chest || 100, back: tprofile.workMax?.back || 110,
    legs: tprofile.workMax?.legs || 140, quads: tprofile.workMax?.quads || 130,
    hamstrings: tprofile.workMax?.hamstrings || 80, glutes: tprofile.workMax?.glutes || 80,
    calves: tprofile.workMax?.calves || 60, shoulders: tprofile.workMax?.shoulders || 60,
    arms: tprofile.workMax?.arms || 50, biceps: tprofile.workMax?.biceps || 40,
    triceps: tprofile.workMax?.triceps || 40, core: tprofile.workMax?.core || 60,
    abs: tprofile.workMax?.abs || 60, traps: tprofile.workMax?.traps || 50,
    forearms: tprofile.workMax?.forearms || 30,
  }));
  useEffect(() => { setManualWorkMax(w => ({ ...w, ...(tprofile.workMax || {}) })); }, [tprofile.workMax]);
  const [manualResult, setManualResult] = useState<ManualResult | null>(() => {
    try { return JSON.parse(localStorage.getItem('he_manual_session') || 'null'); } catch { return null; }
  });
  useEffect(() => { try { localStorage.setItem('he_manual_session', JSON.stringify(manualResult)); } catch {} }, [manualResult]);

  const [programData, setProgramData] = useState<FullProgram | null>(() => { try { const s = JSON.parse(localStorage.getItem('he_manual_cfg') || 'null'); if (s && s.programData) return s.programData; } catch {} return null; });
  const [programWeeks, setProgramWeeks] = useState<ManualWeek[] | null>(() => { try { const s = JSON.parse(localStorage.getItem('he_manual_cfg') || 'null'); if (s && s.programWeeks) return s.programWeeks; } catch {} return null; });

  const [macrocycle, setMacrocycle] = useState<MacrocyclePlan | null>(() => {
    try { return JSON.parse(localStorage.getItem('he_macro_session') || 'null'); } catch { return null; }
  });
  useEffect(() => { try { localStorage.setItem('he_macro_session', JSON.stringify(macrocycle)); } catch {} }, [macrocycle]);
  const [selectedWeek, setSelectedWeek] = useState<number>(() => { try { const s = JSON.parse(localStorage.getItem('he_manual_cfg') || '{}'); if (typeof s.selectedWeek === 'number') return s.selectedWeek; } catch {} return 1; });
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem('he_manual_cfg') || '{}'); localStorage.setItem('he_manual_cfg', JSON.stringify({ ...s, manualCfg, wizardStep, selectedWeek, programData, programWeeks })); } catch {}
  }, [manualCfg, wizardStep, selectedWeek, programData, programWeeks]);
  const [currentMicrocycle, setCurrentMicrocycle] = useState<Microcycle | null>(null);

  const microcycleToManualResult = useCallback((mc: Microcycle, weekNum: number): ManualResult => {
    const wm: Record<string, number> = { chest: 100, back: 110, legs: 140, quads: 130, hamstrings: 80, glutes: 80, calves: 60, shoulders: 60, arms: 50, biceps: 40, triceps: 40, core: 60, abs: 60, traps: 50, forearms: 30, full: 80, ...manualWorkMax, ...tprofile.workMax };
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

  const lastSyncedWeekRef = useRef<number>(-1);
  useEffect(() => {
    if (currentMicrocycle && macrocycle && selectedWeek !== lastSyncedWeekRef.current) {
      lastSyncedWeekRef.current = selectedWeek;
      setManualResult(microcycleToManualResult(currentMicrocycle, selectedWeek));
      setWizardStep(6);
    }
  }, [currentMicrocycle, selectedWeek, macrocycle, microcycleToManualResult]);

  const buildPlan = usePlanGeneration({
    goal, level, mesoLength, weakPoints,
    equipment: tprofile.equipment, workMax: tprofile.workMax,
    manualWorkMax, injuries: tprofile.injuries || [], pctForRir: PCT_FOR_RIR,
    courseIntensity: tprofile.onCourse ? (tprofile.courseIntensity || 'mild') : 'none',
  });

  const [tempoAdjust, setTempoAdjust] = useState<{ eccentric: number; bottomPause: number; concentric: number; topPause: number; label?: string } | null>(null);
  const [mrvOverride, setMrvOverride] = useState<number | null>(null);
  const globalTempoStr = tempoAdjust ? `${tempoAdjust.eccentric}-${tempoAdjust.bottomPause}-${tempoAdjust.concentric}-${tempoAdjust.topPause}` : undefined;

  const [sequenceStrategy, setSequenceStrategy] = useState<'classic' | 'preexhaust' | 'antagonist'>('classic');
  const [deloadFreq, setDeloadFreq] = useState(4);
  const [rirWave, setRirWave] = useState('standard');

  const applyMethodsToPlan = useCallback((days: ManualDay[], cfg: Record<string, string>, wm: Record<string, number>, gl: string, mrvVal: number) => {
    const log: string[] = [];
    let modified = days.map((d: ManualDay) => ({ ...d, exercises: d.exercises.map((e: ManualExercise) => ({ ...e })) }));

    const getFirstCompound = (exs: ManualExercise[], grp: string) => {
      const idx = exs.findIndex(e => e.group === grp);
      return idx >= 0 ? idx : -1;
    };
    const getLastIsolation = (exs: ManualExercise[], grp: string) => {
      let lastIdx = -1;
      exs.forEach((e, i) => { if (e.group === grp) lastIdx = i; });
      return lastIdx;
    };

    for (const [cat, name] of Object.entries(cfg)) {
      if (!name || cat === 'split' || cat === 'cycle' || cat === 'program') continue;
      const allM = getMethodsByCategory(cat);
      if (!allM.some((m: any) => m.name === name)) { log.push(`Метод «${name}» не найден в категории ${cat}.`); continue; }

      if (cat === 'progression') {
        if (name.includes('Max Effort') || name.includes('Максимальных усилий')) {
          modified = modified.map((d: ManualDay) => {
            const doneGroups = new Set<string>();
            return {
              ...d, exercises: d.exercises.map((e: ManualExercise) => {
                if (!doneGroups.has(e.group)) {
                  doneGroups.add(e.group);
                  return { ...e, sets: Math.min(3, e.sets), reps: '1-3', rir: 1, rest: 240 };
                }
                return { ...e, reps: '8-12', rir: 2, rest: 90 };
              }),
            };
          });
          log.push('Прогрессия Max Effort: первый compound каждой группы → 1-3П 90%+ RIR 1, остальные → 8-12 RIR 2.');
        } else if (name.includes('Dynamic Effort') || name.includes('Динамических усилий')) {
          modified = modified.map((d: ManualDay) => {
            const doneGrp = new Set<string>();
            return {
              ...d, exercises: d.exercises.map((e: ManualExercise) => {
                if (!doneGrp.has(e.group)) {
                  doneGrp.add(e.group);
                  return { ...e, sets: 8, reps: '2-3', rir: 3, rest: 45 };
                }
                return { ...e, reps: '8-12', rir: 2, rest: 90 };
              }),
            };
          });
          log.push('Прогрессия Dynamic Effort: первый compound → 8×2-3 @50-65% взрывные, добор → 8-12 RIR 2.');
        } else if (name.includes('Repeated Effort') || name.includes('Повторных усилий')) {
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise) => {
              const isCompound = e.rest >= 150;
              return { ...e, reps: isCompound ? '8-10' : '10-15', rir: 2, rest: isCompound ? 120 : 60 };
            }),
          }));
          log.push('Прогрессия Repeated Effort: 8-15П @65-80%, RIR 2 — все подходы рабочие, без отказа.');
        } else if (name.includes('Double Progression') || name.includes('Двойная прогрессия')) {
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise) => ({ ...e, reps: e.rest >= 150 ? '6-10' : '8-12', rir: 1, rest: e.rest >= 150 ? 120 : 75 })),
          }));
          log.push('Двойная прогрессия: compounds 6-10П, изоляция 8-12П. RIR=1, +вес когда верх диапазона.');
        } else if (name.includes('Triple Progression') || name.includes('Тройная прогрессия')) {
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise) => ({ ...e, reps: e.rest >= 150 ? '6-10' : '8-12', rir: 1, rest: e.rest >= 150 ? 120 : 75 })),
          }));
          log.push('Тройная прогрессия: повторы 6-12 → подходы +1 → +вес. RIR=1.');
        } else {
          log.push(`Прогрессия: «${name}» — применяется в долгосрочном планировании.`);
        }
      }

      if (cat === 'intensity') {
        if (name.includes('Cluster') || name.includes('Кластер')) {
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise, ei: number) =>
              ei === 0 ? { ...e, sets: 5, reps: '5 (2+2+1)', rir: 1, rest: 180 } : e
            ),
          }));
          log.push('Кластеры: первое упражнение дня → 5×5 (2+20с+2+20с+1), отдых 3 мин.');
        } else if (name.includes('Drop-Set') || name.includes('Дроп-сет')) {
          modified = modified.map((d: ManualDay) => {
            const lastIsoIdx: Record<string, number> = {};
            d.exercises.forEach((e, i) => { if (e.rest < 120) lastIsoIdx[e.group] = i; });
            return {
              ...d, exercises: d.exercises.map((e: ManualExercise, ei: number) =>
                Object.values(lastIsoIdx).includes(ei)
                  ? { ...e, sets: 3, reps: '8-10', rir: 0, rest: 90 }
                  : e
              ),
            };
          });
          log.push('Drop-Set: последняя изоляция каждой группы → 3×8-10, последний подход до отказа +2 дропа −20%.');
        } else if (name.includes('Rest-Pause') || name.includes('Rest Pause')) {
          modified = modified.map((d: ManualDay) => {
            const doneGrp = new Set<string>();
            return {
              ...d, exercises: d.exercises.map((e: ManualExercise) => {
                if (!doneGrp.has(e.group)) {
                  doneGrp.add(e.group);
                  return { ...e, sets: 1, reps: 'AMRAP', rir: 0, rest: 180 };
                }
                return e;
              }),
            };
          });
          log.push('Rest-Pause: первое упражнение каждой группы → 1 подход до отказа, 15с, 2-4П, 15с, 1-3П.');
        } else if (name.includes('Myo-Reps') || name.includes('Myo Reps')) {
          modified = modified.map((d: ManualDay) => {
            const visGrp = new Set<string>();
            return {
              ...d, exercises: d.exercises.map((e: ManualExercise, ei: number) => {
                if (e.rest < 120 && !visGrp.has(e.group)) {
                  visGrp.add(e.group);
                  return { ...e, sets: 1, reps: '15-20', rir: 1, rest: 120 };
                }
                return e;
              }),
            };
          });
          log.push('Myo-Reps: первая изоляция каждой группы → активация 15-20, мини-сеты 3-5 с 5 вдохами.');
        } else if (name.includes('Суперсет') || name.includes('Antagonist Superset')) {
          log.push('Суперсеты антагонистов: пары (грудь↔спина, бицепс↔трицепс) без отдыха. Отдых после пары.');
        } else if (name.includes('Негатив') || name.includes('Эксцентрический')) {
          modified = modified.map((d: ManualDay) => {
            const doneGrp = new Set<string>();
            return {
              ...d, exercises: d.exercises.map((e: ManualExercise) => {
                if (!doneGrp.has(e.group) && e.rest >= 150) {
                  doneGrp.add(e.group);
                  return { ...e, reps: '3-5', rir: 2, rest: 180 };
                }
                return e;
              }),
            };
          });
          log.push('Негативы: первое compound каждой группы → 3-5П, эксцентрика 4-6с, вес 105-120%.');
        } else if (name.includes('Метаболический') || name.includes('Giant')) {
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise) =>
              e.rest < 120 ? { ...e, sets: Math.max(3, e.sets), reps: '10-15', rir: 1, rest: 45 } : e
            ),
          }));
          log.push('Метаболический тренинг: изоляция → 3-4×10-15, отдых 45с.');
        } else if (name.includes('Форсированные') || name.includes('Forced Reps')) {
          log.push('Форсированные повторения: последний подход каждого compound — RIR 0, партнёр +2-3.');
        } else if (name.includes('Трисет') || name.includes('Гигантские')) {
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise) =>
              e.rest < 120 ? { ...e, rest: 30 } : { ...e, rest: 120 }
            ),
          }));
          log.push('Трисеты/Гигантские сеты: изоляция → 30с отдых, compounds → 2 мин. Выполнять подряд.');
        } else {
          log.push(`Интенсивность: «${name}» — примените через редактор.`);
        }
      }

      if (cat === 'technique') {
        if (name.includes('Tempo') || name.includes('Темповые')) {
          const t = name.includes('3-1-1-0') ? '3-1-1-0' : name.includes('гипертроф') ? '3-1-1-0' : '4-1-1-0';
          setTempoAdjust({ eccentric: parseInt(t[0]), bottomPause: parseInt(t[2]), concentric: parseInt(t[4]), topPause: parseInt(t[6]), label: t });
          log.push(`Темп ${t}: ${t[0]}с эксцентрика, ${t[2]}с пауза внизу, ${t[4]}с концентрика, ${t[6]}с пауза вверху.`);
        } else if (name.includes('Пауза') || name.includes('Bottom Pause') || name.includes('Paused')) {
          setTempoAdjust({ eccentric: 3, bottomPause: 2, concentric: 1, topPause: 0, label: '3-2-1-0' });
          log.push('Пауза 2с в нижней точке: убирает рефлекс растяжения, чистая концентрика.');
        } else if (name.includes('1.5') || name.includes('полтора')) {
          log.push('1.5 повторения: полное + половина + полное = 1 повтор. Растянутая позиция.');
        } else if (name.includes('Pre-Exhaust') || name.includes('Предварительное')) {
          log.push('Pre-Exhaust: изоляция → сразу compound. Отстающие группы — приоритет.');
        } else if (name.includes('BFR')) {
          log.push('BFR: 20-30% 1RM + манжеты, 30-15-15-15 повторов, 30с отдых. Гипертрофия без веса.');
        } else {
          log.push(`Техника: «${name}» — настройте темп в редакторе для каждого упражнения.`);
        }
      }

      if (cat === 'volume') {
        if (name.includes('GVT') || name.includes('German Volume') || name.includes('10×10')) {
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise) =>
              e.rest >= 150 ? { ...e, sets: 10, reps: '10', rir: 3, rest: 60 } : e
            ),
          }));
          log.push('GVT 10×10: compounds → 10×10 @60% 1ПМ, отдых 60с. Изоляция без изменений.');
        } else if (name.includes('FST-7') || name.includes('Fascia')) {
          modified = modified.map((d: ManualDay) => {
            const lastOfGroup: Record<string, number> = {};
            d.exercises.forEach((e, i) => { lastOfGroup[e.group] = i; });
            return {
              ...d, exercises: d.exercises.map((e: ManualExercise, ei: number) =>
                Object.values(lastOfGroup).includes(ei)
                  ? { ...e, sets: 7, reps: '8-12', rir: 1, rest: 30 }
                  : e
              ),
            };
          });
          log.push('FST-7: последнее упражнение каждой группы → 7×8-12, отдых 30-45с. Памп и фасция.');
        } else if (name.includes('Gironda') || name.includes('8×8')) {
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise) =>
              e.rest < 120 ? { ...e, sets: 8, reps: '8', rir: 2, rest: 15 } : e
            ),
          }));
          log.push('Gironda 8×8: изоляция → 8×8 @50-60%, отдых 15-30с. Compounds без изменений.');
        } else if (name.includes('Volume Progression RP') || name.includes('Volume Landmarks')) {
          log.push(`Volume Landmarks: объём ${Math.round(mrvVal * 0.7)}-${Math.round(mrvVal)} сетов/нед на группу. MEV→MAV→MRV.`);
        } else {
          log.push(`Объём: «${name}» — скорректируйте сетов в редакторе.`);
        }
      }

      if (cat === 'specialization') {
        const allRest = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
        const findSpec = (subs: string[], main: string, mt: number, rt: number, lb: string) => {
          if (subs.some(s => name.includes(s))) return { main, mt, rt, lb };
          return null;
        };
        const specRes =
          findSpec(['Жимовое троеборье','Bench-only'],'chest',1.35,0.70,'грудь/трицепс/плечи +35%, спина/ноги −30%') ||
          findSpec(['Приседательное','Squat-центричная'],'legs',1.35,0.70,'ноги +35%, верх −30%') ||
          findSpec(['Тяговое','Deadlift-центричная'],'back',1.30,0.75,'задняя цепь +30%, верх −25%') ||
          findSpec(['Массонабор груди','Грудная специализация'],'chest',1.40,0.60,'грудь +40%, остальные −40%') ||
          findSpec(['Массонабор спины','Спинная специализация'],'back',1.40,0.60,'спина +40%, остальные −40%') ||
          findSpec(['Массонабор ног','Ножная специализация'],'legs',1.40,0.60,'ноги +40%, верх −40%') ||
          findSpec(['Акцент на плечи','Дельтовидная специализация'],'shoulders',1.40,0.65,'дельты +40%, остальные −35%') ||
          findSpec(['Акцент на руки','Бицепс+Трицепс специализация'],'arms',1.45,0.65,'бицепс/трицепс +45%, остальные −35%') ||
          findSpec(['Кор и пресс','Core-специализация'],'core',1.50,0.80,'пресс +50%, остальные −20%') ||
          findSpec(['Верхняя грудь'],'chest',1.40,0.60,'верх груди +40%, остальные −40%') ||
          findSpec(['Средняя грудь'],'chest',1.40,0.60,'средняя грудь +40%, остальные −40%') ||
          findSpec(['Нижняя грудь'],'chest',1.35,0.65,'низ груди +35%, остальные −35%') ||
          findSpec(['Широчайшие','Ширина спины'],'back',1.40,0.60,'широчайшие +40%, остальные −40%') ||
          findSpec(['Толщина спины','Средняя часть спины'],'back',1.35,0.65,'толщина спины +35%, остальные −35%') ||
          findSpec(['Поясница','Разгибатели спины'],'back',1.20,0.85,'поясница +20%, остальные −15%') ||
          findSpec(['Квадрицепс'],'legs',1.40,0.65,'квадрицепс +40%, остальные −35%') ||
          findSpec(['Бицепс бедра'],'legs',1.35,0.70,'бицепс бедра +35%, остальные −30%') ||
          findSpec(['Ягодицы'],'legs',1.40,0.65,'ягодицы +40%, остальные −35%') ||
          findSpec(['Икры'],'legs',1.40,0.80,'икры +40%, остальные −20%') ||
          findSpec(['Средняя дельта','Ширина плеч'],'shoulders',1.40,0.70,'средняя дельта +40%, остальные −30%') ||
          findSpec(['Задняя дельта'],'shoulders',1.35,0.75,'задняя дельта +35%, остальные −25%') ||
          findSpec(['Бицепс'],'arms',1.40,0.70,'бицепс +40%, остальные −30%') ||
          findSpec(['Трицепс'],'arms',1.40,0.70,'трицепс +40%, остальные −30%');
        if (specRes) {
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise) => {
              const isTarget = e.group === specRes.main;
              const isRest = allRest.includes(e.group);
              return { ...e, sets: Math.round(e.sets * (isTarget ? specRes.mt : isRest ? specRes.rt : 1.0)) };
            }),
          }));
          log.push(`Специализация «${name}»: ${specRes.lb}.`);
        } else {
          log.push(`Специализация: «${name}» — скорректируйте объём в редакторе.`);
        }
      }
    }

    /* ─── Переупорядочивание по стратегии последовательности ─── */
    modified = modified.map(d => {
      const exs = [...d.exercises];
      const main = exs.filter(e => (e.role === 'main' || e.rest >= 150));
      const iso = exs.filter(e => e.role !== 'main' && e.rest < 150);
      if (sequenceStrategy === 'preexhaust') {
        return { ...d, exercises: [...iso, ...main] };
      }
      if (sequenceStrategy === 'antagonist') {
        const paired: ManualExercise[] = [];
        const used = new Set<number>();
        const groups = [...new Set(exs.map(e => e.group))];
        for (let i = 0; i < groups.length - 1; i += 2) {
          const a = exs.filter((e, idx) => e.group === groups[i] && !used.has(idx));
          const b = exs.filter((e, idx) => e.group === groups[i + 1] && !used.has(idx));
          const pairLen = Math.min(a.length, b.length);
          for (let p = 0; p < pairLen; p++) {
            paired.push(a[p]); used.add(exs.indexOf(a[p]));
            paired.push(b[p]); used.add(exs.indexOf(b[p]));
          }
        }
        exs.forEach((e, idx) => { if (!used.has(idx)) paired.push(e); });
        return { ...d, exercises: paired };
      }
      return d;
    });

    log.push(`Последовательность: ${sequenceStrategy === 'classic' ? 'compounds → изоляция' : sequenceStrategy === 'preexhaust' ? 'изоляция → compounds (pre-exhaust)' : 'антагонистические пары (суперсеты)'}.`);

    return { days: modified, log };
  }, [sequenceStrategy]);

  const { days: generatedDays, weeklySets: generatedWeeklySets, groupCorrections: generatedCorrections, patternBalance: generatedBalance } = useMemo(() => {
    // ─── Если загружена готовая программа — используем её дни ───
    if (programData && programWeeks && programWeeks.length > 0) {
      const w0 = programWeeks[0];
      const ws: Record<string, number> = {};
      w0.days.forEach(d => d.exercises.forEach(e => { ws[e.group] = (ws[e.group] || 0) + e.sets; }));
      return { days: w0.days, weeklySets: ws, groupCorrections: ['📥 Загружена программа: ' + programData.name], patternBalance: {} };
    }

    const auto = selectSplit({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as any);
    const manualSp = manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null;
    const sp = manualSp ? { id: manualCfg.split!, name: manualSp.name, desc: manualSp.desc, groupsPerDay: manualSp.groupsPerDay, score: 100, rationale: ['Ручной выбор'] } as any : auto[0];
    
    if (!sp) return { days: [], weeklySets: {}, groupCorrections: ['Ошибка подбора сплита'], patternBalance: {} };
    
    const cycle: string[][] = []; let gi = 0;
    while (cycle.length < daysPerWeek) { cycle.push(sp.groupsPerDay[gi % sp.groupsPerDay.length]); gi++; }
    const labAdj = labTrainingAdjust(labAnalysis);
    const mrv = mrvOverride ?? getMrv(level, tprofile.onCourse, tprofile.courseIntensity, labAdj.mrvMultiplier);
    
    const built = buildPlan(cycle, mrv, { currentReadiness: readinessSlider, targetTonnage, sequenceStrategy });
    
    const methodResult = applyMethodsToPlan(built.days as ManualDay[], manualCfg, manualWorkMax, goal, mrv);
    
    const finalCorrections = [...built.groupCorrections, ...methodResult.log];
    
    methodResult.days.forEach((d, di) => {
      const heavyCount = d.exercises.filter(e => {
        const cat = EXERCISE_CATALOG.find(c => c.name === e.name);
        return (cat?.fatigueCost || 0) >= 8;
      }).length;
      if (heavyCount >= 3) {
        finalCorrections.push(`⚠ День ${di + 1}: Критическая нагрузка! ${heavyCount} тяжёлых упражнений могут привести к переутомлению.`);
      }
    });

    return { 
      days: methodResult.days, 
      weeklySets: built.weeklySets, 
      groupCorrections: finalCorrections, 
      patternBalance: built.patternBalance 
    };
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints, manualCfg, tprofile, labAnalysis, buildPlan, mrvOverride, manualWorkMax, applyMethodsToPlan, readinessSlider, targetTonnage, sequenceStrategy, programData, programWeeks]);

  const generateManualPlan = useCallback(() => {
    const workMaxMerged = { chest: 100, back: 110, legs: 140, quads: 130, hamstrings: 80, glutes: 80, calves: 60, shoulders: 60, arms: 50, biceps: 40, triceps: 40, core: 60, abs: 60, traps: 50, forearms: 30, ...tprofile.workMax, ...manualWorkMax };

    // ─── BB-авто режим ───
    if (manualCfg.generator === 'bb' || manualCfg.generator === 'bb_split') {
      const bbSplitId = manualCfg.bbSplit || SPLIT_PATTERNS[0]?.id || 'upper_lower_4';
      const bbLoadStrategy = (manualCfg.bbLoad || 'double_progression') as LoadStrategy;
      const bbPeds: PED[] = (tprofile as any).bbPeds?.length ? (tprofile as any).bbPeds : (tprofile.onCourse ? ['AAS'] : []);
      const allLandmarks = getAllVolumeLandmarks(level);
      const pedAdapt = adaptForPEDs(bbPeds, Object.fromEntries(Object.entries(allLandmarks).map(([m, v]) => [m, v.mrv])));

      // Фокус-группа: отдельно от слабых групп (matched engine focusGroup)
      const bbFocusGroup = manualCfg.bbFocusGroup || '';
      const effectiveWeak = [...(tprofile.weakPoints || [])];

      // Авто-делод по ACWR (если включён)
      const bbAutoDeload = manualCfg.bbAutoDeload === 'on';
      let deloadWeeks = new Set<number>();
      if (bbAutoDeload) {
        try {
          const srpeSessions = loadSRPESessions();
          if (srpeSessions.length >= 4) {
            const acwr = acuteChronicRatio(toDailyLoads(srpeSessions));
            if (acwr && acwr.ratio > 1.3) {
              const deloadWeek = Math.max(1, mesoLength - 1);
              deloadWeeks = new Set([deloadWeek]);
            }
          }
        } catch { /* ignore */ }
      }

      const plan: BBPlan = buildBBPlan({
        patternId: bbSplitId, level, goal: (goal || 'mass') as any, weeks: mesoLength,
        workMax: workMaxMerged, weakPoints: effectiveWeak,
        focusGroup: bbFocusGroup || undefined,
        volumeGoal: (manualCfg.bbVolGoal || 'mav') as any,
        specialization: manualCfg.bbSpecialization === 'on',
        injuries: (tprofile.injuries || []) as any,
      }, pedAdapt);

      // Convert BBPlan → ManualResult (с сохранением BB-специфичных полей)
      const bbWeeks: ManualWeek[] = plan.weeks.map(w => {
        const phase = w.week <= Math.ceil(mesoLength * 0.6) ? 'accumulation' : w.week === mesoLength ? 'deload' : 'intensification';
        const phaseLabel = PHASE_LABELS_MAP[phase] || phase;
        const days: ManualDay[] = w.sessions.map((s, si) => ({
          day: si + 1,
          groups: [...new Set(s.exercises.map(e => e.muscle))],
          exercises: s.exercises.map(e => ({
            name: e.name, sets: e.sets, reps: String(e.workSets[0]?.reps || 10),
            rir: e.rir,
            rest: e.workSets[0]?.restSeconds || e.restSeconds || 90,
            weight: Math.round(e.workSets[0]?.weight || 80),
            group: e.muscle, role: e.role === 'primary' ? 'main' : 'accessory',
            pattern: e.workSets[0]?.technique || '',
            tempo: e.workSets[0]?.tempo || e.tempoSpec,
            restSeconds: e.workSets[0]?.restSeconds || e.restSeconds,
            character: e.character,
            muscleTarget: e.muscle,
            technique: e.workSets[0]?.technique,
          })),
          corrections: [s.character + ' · ' + (s.sessionTag || '')],
        }));
        const avgRir = days.length > 0 ? days.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + e.rir, 0) / d.exercises.length, 0) / days.length : 2;
        return { weekNumber: w.week, phase, phaseLabel, rir: Math.round(avgRir), days, corrections: [] };
      });

      const corrections = [
        '🤖 Сгенерировано BB-движком (bb-builder.engine)',
        `📐 Сплит: ${SPLIT_PATTERNS.find(p => p.id === bbSplitId)?.name || bbSplitId}`,
        `📈 Стратегия: ${bbLoadStrategy.replace(/_/g, ' ')}`,
        `📅 ${mesoLength} нед · ${effectiveWeak.length ? 'слабые: ' + effectiveWeak.join(', ') : 'без слабых групп'}`,
        ...(bbFocusGroup ? [`🎯 Фокус-группа: ${bbFocusGroup} (+20% MAV)`] : []),
        ...(manualCfg.bbSpecialization === 'on' ? ['🎯 Блок специализации: слабые на MAV+10%, остальные на MEV (поддержка)'] : []),
        ...(bbAutoDeload && deloadWeeks.size > 0 ? [`🔄 Авто-делод (${manualCfg.bbDeloadType || 'pump'}): нед ${[...deloadWeeks].join(', ')} по ACWR>1.3`] : []),
        ...(pedAdapt ? [`💉 PED-адаптация MRV×${pedAdapt.combinedMrvMultiplier.toFixed(2)}`] : []),
      ];

      const firstW = bbWeeks[0];
      setManualResult({
        splitName: plan.pattern.name,
        corrections,
        days: firstW?.days || [],
        weeks: bbWeeks,
        currentWeek: firstW?.weekNumber || 1,
        mesoLength,
        bbMeta: { generator: 'bb_split', bbPatternId: bbSplitId, bbLoadStrategy: bbLoadStrategy },
      });
      setWizardStep(6);
      return;
    }

    // ─── BB ПРОФ-цикл (готовые упражнения) ───
    if (manualCfg.generator === 'bb_cycle') {
      const bbCycleId = manualCfg.bbCycle || '';
      const cycle = getCycleById(bbCycleId);
      if (!cycle) { alert('BB-цикл не выбран'); return; }
      const bbLoadStrategy = (manualCfg.bbLoad || 'double_progression') as LoadStrategy;
      const bbPeds: PED[] = (tprofile as any).bbPeds?.length ? (tprofile as any).bbPeds : (tprofile.onCourse ? ['AAS'] : []);
      const cycleWeeks = cycle.meta.weeks;
      if (cycleWeeks !== mesoLength) setMesoLength(cycleWeeks);
      const plan = convertCycleToBBPlan({
        cycle,
        workMax: workMaxMerged,
        weakPoints: tprofile.weakPoints || [],
        peds: bbPeds,
        loadStrategy: bbLoadStrategy,
      });

// Convert Cycle → ManualResult (с сохранением BB-специфичных полей)
       const bbWeeks: ManualWeek[] = plan.weeks.map(w => {
        const phase = phaseForCycleWeek(w.week, cycle);
        const phaseLabel = PHASE_LABELS_MAP[phase] || phase;
        const days: ManualDay[] = w.sessions.map((s, si) => ({
          day: si + 1,
          groups: [...new Set(s.exercises.map(e => e.muscle))],
          exercises: s.exercises.map(e => ({
            name: e.name, sets: e.sets, reps: String(e.workSets[0]?.reps || 10),
            rir: e.rir,
            rest: e.workSets[0]?.restSeconds || e.restSeconds || 90,
            weight: Math.round(e.workSets[0]?.weight || 80),
            group: e.muscle, role: e.role === 'primary' ? 'main' : 'accessory',
            pattern: e.workSets[0]?.technique || '',
            tempo: e.workSets[0]?.tempo || e.tempoSpec,
            restSeconds: e.workSets[0]?.restSeconds || e.restSeconds,
            character: e.character,
            muscleTarget: e.muscle,
            technique: e.workSets[0]?.technique,
          })),
          corrections: [s.character + ' · ' + (s.sessionTag || '')],
        }));
        const avgRir = days.length > 0 ? days.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + e.rir, 0) / d.exercises.length, 0) / days.length : 2;
        return { weekNumber: w.week, phase, phaseLabel, rir: Math.round(avgRir), days, corrections: [] };
      });

      const corrections = [
        `📋 ПРОФ-цикл: ${cycle.meta.title}`,
        `🎯 Фокус: ${cycle.meta.targetFocus || '—'}`,
        `📐 Тип: BB-цикл с фиксированными упражнениями (${cycle.week1.reduce((s, d) => s + d.exercises.length, 0)} упр/день)`,
        `📈 Стратегия: ${bbLoadStrategy.replace(/_/g, ' ')}`,
        `📅 ${cycleWeeks} нед · ${tprofile.weakPoints?.length ? 'слабые: ' + tprofile.weakPoints.join(', ') : 'без слабых групп'}`,
        `🔥 RIR-прогрессия: ${cycle.meta.rirProgression ? cycle.meta.rirProgression.start + '→' + cycle.meta.rirProgression.end : 'по фазам'}`,
        ...(cycle.meta.deloadWeeks?.length ? [`🔄 Разгрузка: нед ${cycle.meta.deloadWeeks.join(', ')}`] : []),
        ...(bbPeds.length > 0 ? ['💉 PED-адаптация активна'] : []),
        ...plan.rationale.slice(0, 3),
      ];

      const firstW = bbWeeks[0];
      setManualResult({
        splitName: cycle.meta.title,
        corrections,
        days: firstW?.days || [],
        weeks: bbWeeks,
        currentWeek: firstW?.weekNumber || 1,
        mesoLength: cycleWeeks,
        bbMeta: { generator: 'bb_cycle', bbPatternId: manualCfg.cycle || '', bbLoadStrategy: bbLoadStrategy },
      });
      setWizardStep(6);
      return;
    }

    // ─── Загруженная готовая программа ───
    if (programData && programWeeks && programWeeks.length > 0) {
      const firstWeek = programWeeks[0];
      const corrections = [
        `📥 Программа: ${programData.name} (${programData.author || ''}) — ${programData.durationWeeks} нед, цели: ${programData.goal}, уровень: ${programData.level}.`,
        ...(programData.warnings?.length ? ['⚠ ' + programData.warnings.join('; ')] : []),
      ];
      setManualResult({
        splitName: programData.name,
        corrections,
        days: firstWeek.days,
        weeks: programWeeks,
        currentWeek: 1,
        mesoLength: programData.durationWeeks,
      });
      setWizardStep(6);
      return;
    }

    // ─── Ручной режим (штатный) ───
    const sp = manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null;
    const splitName = (manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null)?.name || 'Авто-сплит';
    const labAdj2 = labTrainingAdjust(labAnalysis);

    const weeks = buildPhasePlan(
      generatedDays,
      mesoLength,
      deloadFreq,
      goal,
      rirWave,
      level,
      tprofile.onCourse,
      tprofile.courseIntensity,
      labAdj2.mrvMultiplier,
      workMaxMerged,
      tprofile.weakPoints || [],
      globalTempoStr,
    );
    const firstWeek = weeks[0];

    // Валидация профиля — предупреждения о нереалистичных данных
    const profileWarnings: string[] = [];
    const bw = tprofile.bodyWeight || 75;
    const pmS = tprofile.pmSquat || 0;
    const pmB = tprofile.pmBench || 0;
    const pmD = tprofile.pmDead || 0;
    if (pmS > 0 && pmS / bw > 3.0) profileWarnings.push(`⚠ Присед ${pmS}кг при весе ${bw}кг — ${(pmS/bw).toFixed(1)}×BW. Элитный уровень, проверьте ввод.`);
    if (pmB > 0 && pmB / bw > 2.5) profileWarnings.push(`⚠ Жим ${pmB}кг при весе ${bw}кг — ${(pmB/bw).toFixed(1)}×BW. Элитный уровень, проверьте ввод.`);
    if (pmD > 0 && pmD / bw > 3.5) profileWarnings.push(`⚠ Тяга ${pmD}кг при весе ${bw}кг — ${(pmD/bw).toFixed(1)}×BW. Элитный уровень, проверьте ввод.`);
    if (tprofile.daysPerWeek > 6) profileWarnings.push(`⚠ ${tprofile.daysPerWeek} дн/нед — риск перетренированности. Рекомендуется ≤6.`);
    if (tprofile.level === 'beginner' && tprofile.daysPerWeek > 4) profileWarnings.push(`⚠ Новичок с ${tprofile.daysPerWeek} дн/нед — рекомендуем 3-4.`);

    const corrections = [
      ...generatedCorrections,
      ...profileWarnings,
      `📅 Мезоцикл ${mesoLength} нед: ${weeks.map(w => w.phaseLabel).filter((v, i, a) => a.indexOf(v) === i).join(' → ')}`,
      `🌊 Волна RIR: ${RIR_WAVE_PATTERNS[rirWave]?.label || 'стандартная'}`,
      `🔄 Делод: ${deloadFreq > 0 ? `каждые ${deloadFreq} нед (${weeks.filter(w => w.phase === 'deload').length} раз)` : 'нет'}`,
      ...firstWeek.corrections,
    ];
    setManualResult({
      splitName,
      corrections,
      days: firstWeek.days,
      weeks,
      currentWeek: firstWeek.weekNumber,
      mesoLength,
    });
    setWizardStep(6);
  }, [generatedDays, generatedCorrections, manualCfg, mesoLength, deloadFreq, goal, rirWave, level, tprofile, labAnalysis, manualWorkMax, programData, programWeeks]);

  const buildProgramWeeks = useCallback((prog: FullProgram): ManualWeek[] => {
    const wm: Record<string, number> = { chest: 100, back: 110, legs: 140, quads: 130, hamstrings: 80, glutes: 80, calves: 60, shoulders: 60, arms: 50, biceps: 40, triceps: 40, core: 60, abs: 60, traps: 50, forearms: 30, full: 80, ...manualWorkMax, ...tprofile.workMax };
    return prog.weeks.map((pw) => {
      const days: ManualDay[] = pw.days.map((d: ProgramDay, di: number) => ({
        day: di + 1,
        groups: Array.from(new Set((d.exercises || []).map((e: ProgramDay['exercises'][number]) => detectGroup(e.name)))),
        exercises: (d.exercises || []).map((e: ProgramDay['exercises'][number]) => {
          const g = detectGroup(e.name);
          const rir = e.rir ?? (e.rpe ? Math.max(0, 10 - e.rpe) : 2);
          const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, rir))] ?? 0.9;
          const weight = Math.round((wm[g] || 80) * pct);
          return { name: e.name, sets: e.sets, reps: String(e.reps), rir, rest: e.restSec || 120, group: g, weight };
        }),
      }));
      const allRirs = days.flatMap(d => d.exercises.map(e => e.rir));
      const avgRir = allRirs.length > 0 ? Math.round(allRirs.reduce((s, v) => s + v, 0) / allRirs.length * 10) / 10 : 2;
      const minRir = allRirs.length > 0 ? Math.min(...allRirs) : 2;
      const maxRir = allRirs.length > 0 ? Math.max(...allRirs) : 2;
      const weekTonnage = Math.round(days.reduce((sum, d) => sum + d.exercises.reduce((s, ex) => {
        const repAvg = ex.reps.includes('-') ? (parseInt(ex.reps) + parseInt(ex.reps.split('-')[1] || ex.reps)) / 2 : parseInt(ex.reps) || 10;
        return s + ex.sets * ex.weight * repAvg;
      }, 0), 0));
      const totalWeeklySets = days.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + e.sets, 0), 0);
      const phase = pw.deload ? 'deload' : pw.phase === 'peaking' ? 'peaking' : pw.phase === 'intensification' ? 'intensification' : 'accumulation';
      const corrections: string[] = [];
      corrections.push(`Неделя ${pw.week} — ${PHASE_LABELS_MAP[phase] || phase}: ${days.length} дн, ${totalWeeklySets} сетов, ~${(weekTonnage / 1000).toFixed(1)} т, RIR ${avgRir} (${minRir}-${maxRir})`);
      if (avgRir <= 1) corrections.push('⚠ Высокая интенсивность: RIR≤1 на большинстве подходов. Контролируй технику.');
      if (avgRir >= 3) corrections.push('Низкая интенсивность RIR 3+ — фаза накопления, без отказа.');
      if (minRir === 0) corrections.push('🔴 Есть подходы до отказа (RIR 0). Страховка обязательна.');
      if (phase === 'peaking') corrections.push('Пиковая фаза: основные движения, изоляция минимизирована. Цель — свежесть ЦНС.');
      if (phase === 'deload') corrections.push('Разгрузка: снизь объём и вес на 40-50%, сохрани частоту движений.');
      if (totalWeeklySets > 40) corrections.push('⚠ Объём >40 сетов/нед — высокий риск перетренированности.');
      if (pw.week === 1) corrections.push('Старт программы — адаптация к нагрузкам, не форсируй вес.');
      if (pw.week === prog.durationWeeks) corrections.push('Финальная неделя — оцени прогресс, запланируй разгрузку.');
      if (pw.week === Math.ceil(prog.durationWeeks / 2)) corrections.push('Экватор программы — подведи промежуточные итоги по ПМ и объёму.');
      return { weekNumber: pw.week, phase, phaseLabel: PHASE_LABELS_MAP[phase] || phase, rir: avgRir, days, corrections, totalTonnage: weekTonnage };
    });
  }, [tprofile, manualWorkMax]);

  const loadProgramToConstructor = useCallback((programId: string) => {
    const lib: FullProgram[] = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS];
    const prog = lib.find(p => p.id === programId);
    if (!prog || !prog.weeks?.length) return;
    const pWeeks = buildProgramWeeks(prog);
    setProgramData(prog);
    setProgramWeeks(pWeeks);
    const first = pWeeks[0];
    const corrections: string[] = [
      `Загружена программа «${prog.name}» (${prog.author || ''}, ${prog.goal}, ${prog.level}) — ${prog.durationWeeks} нед, ${prog.daysPerWeek} дн/нед.`,
      'Программа доступна для редактирования, применения методик и выполнения.',
    ];
    if (prog.warnings?.length) corrections.push('⚠ ' + prog.warnings.join('; '));
    lastSyncedWeekRef.current = -1;
    setManualResult({
      splitName: prog.name + ' (неделя 1)',
      corrections,
      days: first?.days || [],
      weeks: pWeeks,
      currentWeek: 1,
      mesoLength: prog.durationWeeks,
    });
    setWizardStep(6);
  }, [buildProgramWeeks]);

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

  const lastAppliedTs = useRef<number>(-1);
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const [applyPayload, setApplyPayload] = useState<PlannerApply | null>(() => {
    const p = getPlannerApply();
    return p && Date.now() - p.ts < 10 * 60 * 1000 ? p : null;
  });
  useEffect(() => subscribePlannerApply(p => {
    if (p && p.ts !== lastAppliedTs.current) setApplyPayload(p);
  }), []);
  const pendingApplyRef = useRef<PlannerApply | null>(null);
  const applyExternal = useCallback(() => {
    const p = getPlannerApply();
    if (!p) return;
    const mrvBase = getMrv(level, tprofile.onCourse, tprofile.courseIntensity, labAdj.mrvMultiplier);
    if (p.kind === 'split') {
      if (p.data?.cycle) {
        const cycle: string[][] = p.data.cycle;
        const built = buildPlan(cycle, mrvBase);
        const corrections: string[] = [
          `🔗 Сплит применён из калькулятора: «${p.data.name || p.label}» (${cycle.length} дн).`,
          `Структура дней: ${cycle.map((g, i) => 'Д' + (i + 1) + ':' + g.join('+')).join(' | ')}.`,
          `Допустимый объём (MRV): ${Math.round(mrvBase)} сетов/нед на группу.`,
          ...built.groupCorrections,
        ];
        const methodResult2 = applyMethodsToPlan(built.days as ManualDay[], manualCfg, manualWorkMax, goal, mrvBase);
        corrections.push(...methodResult2.log);
        setManualResult({ splitName: p.data.name || p.label || 'Сплит из калькулятора', corrections, days: methodResult2.days });
      } else if (Array.isArray(p.data)) {
        // Flat-список упражнений из «Мои планы» → распределяем по дням недели
        const exList = p.data as { name: string; sets: number; reps: number; rir: number }[];
        if (exList.length === 0) { clearPlannerApply(); setApplyPayload(null); return; }
        const perDay = Math.max(1, Math.ceil(exList.length / Math.max(1, daysPerWeek)));
        const days: ManualDay[] = Array.from({ length: Math.max(1, daysPerWeek) }, (_, di) => {
          const chunk = exList.slice(di * perDay, di * perDay + perDay);
          return {
            day: di + 1,
            groups: [...new Set(chunk.map(e => detectGroup(e.name)))],
            exercises: chunk.map(e => {
              const g = detectGroup(e.name);
              return {
                name: e.name,
                sets: e.sets || 3,
                reps: String(e.reps || 10),
                rir: e.rir ?? 2,
                rest: 120,
                group: g,
                weight: Math.round((manualWorkMax[g] || manualWorkMax['legs'] || 80) * 0.8),
                role: 'main' as const,
                tempo: '2-0-1-0',
              } as ManualExercise;
            }),
          };
        });
        const corrections: string[] = [
          `🔗 План «${p.label}» загружен из «Мои планы»: ${exList.length} упражнений → ${days.length} дн.`,
          `Допустимый объём (MRV): ${Math.round(mrvBase)} сетов/нед на группу.`,
        ];
        setManualResult({ splitName: p.label || 'План из «Мои планы»', corrections, days });
      }
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
      const methodResult3 = applyMethodsToPlan(built.days as ManualDay[], manualCfg, manualWorkMax, goal, Math.max(4, mrvBase * mult));
      corrections.push(...methodResult3.log);
      setManualResult({ splitName: manualResult?.splitName || 'План с PRI', corrections, days: methodResult3.days });
    } else if (p.kind === 'weakpoints') {
      const groups: string[] = p.data?.groups || [];
      setWeakPoints(groups);
      pendingApplyRef.current = p;
    } else if (p.kind === 'pm') {
      const d = p.data || {};
      const sq = (d.squat ?? (d.lift === 'squat' ? d.value : 0) ?? 0) as number;
      const bn = (d.bench ?? (d.lift === 'bench' ? d.value : 0) ?? 0) as number;
      const dl = (d.dead ?? (d.lift === 'dead' ? d.value : 0) ?? 0) as number;
      if (sq || bn || dl) {
        const base = { ...(tprofile.workMax || {}), ...manualWorkMax };
        const wm: Record<string, number> = {
          ...base,
          legs: sq || base.legs || 140,
          quads: Math.round((sq || base.legs || 140) * 0.95) || base.quads || 130,
          hamstrings: Math.round((dl || base.back || 110) * 0.65) || base.hamstrings || 80,
          glutes: Math.round((sq || base.legs || 140) * 0.6) || base.glutes || 80,
          chest: bn || base.chest || 100,
          back: dl || base.back || 110,
          traps: Math.round((dl || base.back || 110) * 0.4) || base.traps || 50,
          shoulders: Math.round((bn || base.chest || 100) * 0.6) || base.sholders || 60,
          arms: Math.round((bn || base.chest || 100) * 0.45) || base.arms || 50,
          biceps: Math.round((bn || base.chest || 100) * 0.4) || base.biceps || 40,
          triceps: Math.round((bn || base.chest || 100) * 0.4) || base.triceps || 40,
          core: Math.round((bn || base.chest || 100) * 0.6) || base.core || 60,
          abs: Math.round((bn || base.chest || 100) * 0.6) || base.abs || 60,
          calves: Math.round((sq || base.legs || 140) * 0.45) || base.calves || 60,
          forearms: Math.round((bn || base.chest || 100) * 0.3) || base.forearms || 30,
        };
        setManualWorkMax(wm);
        updateTProfile({ workMax: wm });
        const cycle = manualResult ? manualResult.days.map(dd => dd.groups) : [['full']];
        const built = buildPlan(cycle, mrvOverride ?? 24, { currentReadiness: readinessSlider, targetTonnage, sequenceStrategy, workMaxOverride: wm });
        setManualResult({ splitName: manualResult?.splitName || 'План с ПМ', corrections: [...(manualResult?.corrections || []), `🔗 ПМ применён: присед ${sq}→ноги/квад ${wm.quads}, жим ${bn}→грудь, тяга ${dl}→спина. Веса пересчитаны.`], days: built.days });
        pendingApplyRef.current = null;
      } else {
        pendingApplyRef.current = p;
      }
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
    setWizardStep(6);
  }, [buildPlan, level, tprofile, labAdj, manualResult, mrvOverride, manualCfg, manualWorkMax, goal, applyMethodsToPlan]);

  useEffect(() => {
    if (applyPayload && applyPayload.ts !== lastAppliedTs.current) {
      lastAppliedTs.current = applyPayload.ts;
      try {
        applyExternal();
        setApplyErr(null);
      } catch (e) {
        console.error('applyExternal error', e);
        setApplyErr(e instanceof Error ? e.message : String(e));
      }
    }
  }, [applyPayload]);

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

  const buildPreview = useMemo(() => {
    const selSplit = manualCfg.split || 'авто';
    const selDays = daysPerWeek + 'дн';
    const selGoal = goal === 'mass' ? 'масса' : goal === 'strength' ? 'сила' : goal === 'powerlifting' ? 'пауэрлифтинг' : goal;
    const selLevel = level === 'beginner' ? 'нов' : level === 'intermediate' ? 'сред' : level === 'advanced' ? 'про' : level;
    const bbTags = manualCfg.generator === 'bb' || manualCfg.generator === 'bb_split' || manualCfg.generator === 'bb_cycle'
      ? ` · BB[${manualCfg.bbSplit || manualCfg.bbCycle || ''}${manualCfg.bbVolGoal ? '/' + manualCfg.bbVolGoal : ''}${manualCfg.bbSpecialization === 'on' ? '/спец' : ''}]`
      : '';
    return `${selSplit} · ${selDays} · ${selGoal} · ${selLevel}${bbTags}`;
  }, [manualCfg.split, manualCfg.specialization, daysPerWeek, goal, level]);

  /* ─── Quality Score для step 5 (анализ) ─── */
  const analysisQuality = useMemo(() => {
    const MRV_MAP: Record<string, number> = { beginner: 15, intermediate: 20, advanced: 24, enhanced: 28 };
    const mrv = mrvOverride ?? MRV_MAP[level] ?? 20;
    const wk = generatedWeeklySets;
    let score = 100;
    const items: { label: string; ok: boolean; detail: string; group?: string }[] = [];
    for (const [g, sets] of Object.entries(wk)) {
      if (sets > mrv * 1.15) {
        score -= 8;
        items.push({ label: g, ok: false, detail: `${sets} сетов > MRV×1.15=${Math.round(mrv * 1.15)} ⚠ перегруз`, group: g });
      } else if (sets < mrv * 0.4) {
        score -= 6;
        items.push({ label: g, ok: false, detail: `${sets} сетов < MEV=${Math.round(mrv * 0.4)} — недотрен`, group: g });
      } else {
        items.push({ label: g, ok: true, detail: `${sets} сетов (MEV→MRV)`, group: g });
      }
    }
    const groupsPresent = Object.keys(wk).length;
    if (groupsPresent < 4) { score -= 10; items.push({ label: 'Охват', ok: false, detail: `Всего ${groupsPresent} групп (мин. 4)` }); }
    else { items.push({ label: 'Охват', ok: true, detail: `${groupsPresent} групп` }); }
    const totalEx = generatedDays.reduce((s: number, d: any) => s + d.exercises.length, 0);
    const avgEx = Math.round(totalEx / Math.max(1, generatedDays.length));
    if (avgEx < 3) { score -= 15; items.push({ label: 'Плотность', ok: false, detail: `${avgEx} упр/день — слишком мало` }); }
    else if (avgEx > 14) { score -= 5; items.push({ label: 'Плотность', ok: false, detail: `${avgEx} упр/день — слишком много` }); }
    else { items.push({ label: 'Плотность', ok: true, detail: `${avgEx} упр/день — оптимально` }); }
    const hasMain = generatedDays.some((d: any) => d.exercises.some((e: any) => e.role === 'main'));
    if (!hasMain) { score -= 20; items.push({ label: 'Базовые', ok: false, detail: 'Нет базовых упражнений' }); }
    else { items.push({ label: 'Базовые', ok: true, detail: 'Есть compound-упражнения' }); }
    score = Math.max(0, Math.min(100, score));
    const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
    return { score, color, items, wk, mrv };
  }, [generatedWeeklySets, generatedDays, level, mrvOverride]);

  /* ─── Группы для целевого тоннажа ─── */
  const tonnageGroups = [
    { id: 'chest', label: 'Грудь' }, { id: 'back', label: 'Спина' }, { id: 'legs', label: 'Ноги' },
    { id: 'shoulders', label: 'Плечи' }, { id: 'arms', label: 'Руки' }, { id: 'core', label: 'Кор' },
  ];
  const allPrograms = [...FULL_PROGRAM_LIBRARY, ...WOMENS_PROGRAMS, ...CUSTOM_PROGRAMS];
  const selectedList = Object.entries(manualCfg).filter(([, v]) => v);

  /* ─── Шаг 5: коррекция → переход ─── */
  const [correctionLog, setCorrectionLog] = useState<string[]>([]);

  const applyCorrection = useCallback((tag: string) => {
    const log: string[] = [];
    if (tag === 'mrv') { setWizardStep(4); log.push('↩ Переход к шагу 4: скорректируйте MRV.'); }
    else if (tag === 'weakpoints') { setWizardStep(1); log.push('↩ Переход к шагу 1: добавьте слабые группы.'); }
    else if (tag === 'split') { setWizardStep(2); log.push('↩ Переход к шагу 2: измените сплит.'); }
    else if (tag === 'methods') { setWizardStep(3); log.push('↩ Переход к шагу 3: измените методики.'); }
    setCorrectionLog(prev => [...prev, ...log]);
  }, []);

  const renderProgressBar = () => (
    <WizardProgressBar currentStep={wizardStep} onStepClick={setWizardStep} hasResult={!!manualResult} />
  );

  const renderStepNav = (nextLabel = 'Далее →', onNext?: () => void) => (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      {wizardStep > 1 && wizardStep < 6 && (
        <button onClick={() => setWizardStep(s => s - 1)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
          ← Назад
        </button>
      )}
      {wizardStep < 5 && (
        <button onClick={onNext || (() => setWizardStep(s => s + 1))}
          style={{ flex: 1, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: 11 }}>
          {nextLabel}
        </button>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {/* ─── ШАПКА ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: ACCENT }}>🛠 Конструктор тренировок</h2>
        {manualResult && (
          <button onClick={() => { setManualResult(null); setWizardStep(1); }}
            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
            ✕ Сбросить
          </button>
        )}
      </div>

      {renderProgressBar()}

      {/* ─── ПРЕВЬЮ ─── */}
      <div style={{
        padding: '6px 10px', borderRadius: 8,
        background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)',
        fontSize: 10, color: '#93c5fd', fontWeight: 600, lineHeight: 1.5,
      }}>
        {macrocycle ? '🔗 Макроцикл (цель: ' + macrocycle.goal + ')' : '✏️ Ручной режим'}: {buildPreview}
      </div>

      {applyErr && (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 11, color: '#f87171', fontWeight: 700 }}>
          ⚠ Ошибка применения: {applyErr}
        </div>
      )}

      {applyPayload && (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.25)', fontSize: 11, color: ACCENT, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ {applyPayload.label}</span>
          <button onClick={() => { clearPlannerApply(); setApplyPayload(null); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, fontSize: 10, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {correctionLog.length > 0 && (
        <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', fontSize: 9, color: '#f59e0b', lineHeight: 1.5 }}>
          {correctionLog.map((c, i) => <div key={i}>• {c}</div>)}
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* ШАГ 1: ПРОФИЛЬ */}
      {/* ════════════════════════════════════════════════ */}
      {wizardStep === 1 && (
        <div key="step1" style={{ animation: 'fadeSlideIn 0.3s ease' }}>
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
              padding: 8, borderRadius: 9,
              background: labAdj.deloadRecommended ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)',
              border: '1px solid ' + (labAdj.deloadRecommended ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'),
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: labAdj.deloadRecommended ? '#ef4444' : '#f59e0b', marginBottom: 3 }}>
                🧪 Лабораторная коррекция (MRV ×{labAdj.mrvMultiplier.toFixed(2)})
              </div>
              {labAdj.warnings.map((w: string, i: number) => (
                <div key={i} style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, marginBottom: 1 }}>• {w}</div>
              ))}
              {labAdj.intensityNote && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{labAdj.intensityNote}</div>}
            </div>
          )}

          {/* Частота делода — тренерское решение */}
          <div style={{ padding: '8px 10px', borderRadius: 10, marginTop: 4, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.12)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>🔄 ДЕЛОД — ЧАСТОТА РАЗГРУЗКИ</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {DELOAD_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setDeloadFreq(opt.value)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                    border: deloadFreq === opt.value ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
                    background: deloadFreq === opt.value ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)',
                    color: deloadFreq === opt.value ? ACCENT : DIM,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {deloadFreq > 0 && (
              <div style={{ fontSize: 9, color: '#93c5fd', marginTop: 4 }}>
                Делод {Math.ceil(mesoLength / deloadFreq)} раз(а) за {mesoLength} нед: нед {Array.from({ length: Math.floor(mesoLength / deloadFreq) }, (_, i) => (i + 1) * deloadFreq).join(', ')}
              </div>
            )}
            {deloadFreq === 0 && <div style={{ fontSize: 9, color: DIM, marginTop: 4 }}>Без делода — риск перетренированности выше. Рекомендуется хотя бы раз в 4-6 нед.</div>}
          </div>

          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 10, fontWeight: 600, color: DIM, cursor: 'pointer', padding: '4px 0' }}>
              🗓️ Макроцикл (расширенное планирование)
            </summary>
            <div style={{ marginTop: 6 }}>
              <MacrocyclePanel
                goal={goal} level={level} daysPerWeek={daysPerWeek}
                recovery={recovery} fatigue={fatigue} weakPoints={weakPoints}
                bodyWeight={bodyWeight} sleepHours={sleepHours} stressLevel={stressLevel}
                tprofile={tprofile} labAnalysis={labAnalysis}
                macrocycle={macrocycle} setMacrocycle={setMacrocycle}
                selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek}
                currentMicrocycle={currentMicrocycle} setCurrentMicrocycle={setCurrentMicrocycle}
                onToRuntime={macroToRuntime} setTab={setTab}
              />
            </div>
          </details>

          {renderStepNav('Далее: Сплит →')}
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* ШАГ 2: СПЛИТ */}
      {/* ════════════════════════════════════════════════ */}
      {wizardStep === 2 && (
        <>
          <div style={{ background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>🏗️ БАЗОВАЯ СТРУКТУРА</div>
            <div style={{ marginBottom: 6 }}>
              <SplitSelectorCards value={manualCfg.split || ''} onChange={v => setManual('split', v)} daysPerWeek={daysPerWeek} />
            </div>
              <Sel label="Тип цикла" value={manualCfg.cycle || ''} onChange={v => setManual('cycle', v)}
                options={LMS_CYCLES.map((c: any) => ({ id: c.meta.id, label: c.meta.title, desc: (c.meta.id.startsWith('block') ? 'Блок' : c.meta.id.startsWith('embed') ? 'Встроенная' : 'СРЦ') + ' · ' + c.meta.level }))}
                hint="Силовые циклы / блоки / встроенные" />
              <Sel label="Программа тренировок" value={manualCfg.program || ''} onChange={v => setManual('program', v)}
                options={allPrograms.map((p: any) => ({ id: p.id, label: p.name, desc: p.type + ' · ' + p.goal + ' · ' + p.level }))}
                hint="Готовые программы из библиотеки" />
              <MethodSelector label="Частота" value={manualCfg.frequency || ''} onChange={v => setManual('frequency', v)} category="frequency" />
            </div>
            {manualCfg.program && (
              <button onClick={() => { loadProgramToConstructor(manualCfg.program); }}
                style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)', color: '#a855f7', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                📥 Загрузить программу в конструктор
              </button>
            )}

          <div style={{ background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#00e68a', marginBottom: 6 }}>⚖️ ЦЕЛЕВОЙ ТОННАЖ (кг/нед)</div>
            {tonnageGroups.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: DIM, flex: 1 }}>{g.label}</span>
                <input 
                  type="number" value={targetTonnage[g.id] || ''} 
                  onChange={e => setTargetTonnage(prev => ({ ...prev, [g.id]: parseInt(e.target.value) || 0 }))}
                  style={{ width: 60, background: '#000', border: '1px solid rgba(255,255,255,0.1)', color: ACCENT, borderRadius: 4, fontSize: 10, textAlign: 'center', padding: '2px 0' }}
                />
              </div>
            ))}
          </div>

          {selectedList.filter(([k]) => k === 'split' || k === 'cycle' || k === 'program' || k === 'frequency').length > 0 && (
            <div style={{ marginTop: 4, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.12)', fontSize: 10, color: ACCENT, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {selectedList.filter(([k]) => k === 'split' || k === 'cycle' || k === 'program' || k === 'frequency').map(([k, v]) => (
                <span key={k} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', fontSize: 9 }}>
                  {(CONFIG_LABELS[k] || k)}: {v.length > 30 ? v.slice(0, 30) + '…' : v}
                </span>
              ))}
            </div>
          )}

          {renderStepNav('Далее: Методы →')}
        </>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* ШАГ 3: МЕТОДЫ */}
      {/* ════════════════════════════════════════════════ */}
      {wizardStep === 3 && (
        <div key="step3" style={{ animation: 'fadeSlideIn 0.3s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>📈 ПРОГРЕССИЯ</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <MethodSelector label="Периодизация" value={manualCfg.periodization || ''} onChange={v => setManual('periodization', v)} category="periodization" />
                <MethodSelector label="Прогрессия" value={manualCfg.progression || ''} onChange={v => setManual('progression', v)} category="progression" />
              </div>
            </div>
            <div style={{ background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>🎯 ИНТЕНСИВНОСТЬ</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <MethodSelector label="Интенсивность" value={manualCfg.intensity || ''} onChange={v => setManual('intensity', v)} category="intensity" />
                <MethodSelector label="Техника" value={manualCfg.technique || ''} onChange={v => setManual('technique', v)} category="technique" />
                <MethodSelector label="Объём" value={manualCfg.volume || ''} onChange={v => setManual('volume', v)} category="volume" />
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#ec4899', marginBottom: 6 }}>🎯 СПЕЦИАЛИЗАЦИЯ</div>
            <MethodSelector label="Метод специализации" value={manualCfg.specialization || ''} onChange={v => setManual('specialization', v)} category="specialization" />
          </div>

          {selectedList.filter(([k]) => !['split','cycle','program','frequency'].includes(k)).length > 0 && (
            <div style={{ marginTop: 4, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.12)', fontSize: 10, color: ACCENT, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {selectedList.filter(([k]) => !['split','cycle','program','frequency'].includes(k)).map(([k, v]) => (
                <span key={k} style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.1)', fontSize: 9 }}>
                  {(CONFIG_LABELS[k] || k)}: {v.length > 30 ? v.slice(0, 30) + '…' : v}
                </span>
              ))}
            </div>
          )}

          {renderStepNav('Далее: Настройка →')}
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* ШАГ 4: НАСТРОЙКА (темп, последовательность, MRV, готовность) */}
      {/* ════════════════════════════════════════════════ */}
      {wizardStep === 4 && (
        <div key="step4" style={{ animation: 'fadeSlideIn 0.3s ease' }}>
          <div style={{ background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', marginBottom: 6 }}>🎵 ГЛОБАЛЬНЫЙ ТЕМП</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
              {[
                { l: 'Стандарт 2-0-1-0', v: '2-0-1-0' },
                { l: 'Гипертрофия 3-1-1-0', v: '3-1-1-0' },
                { l: 'Сила 2-1-1-0', v: '2-1-1-0' },
                { l: 'Взрывной 1-0-0-0', v: '1-0-0-0' },
                { l: 'Технический 4-2-2-1', v: '4-2-2-1' },
                { l: 'Реабилитация 5-2-2-1', v: '5-2-2-1' },
                { l: 'TUL-max 4-2-1-1', v: '4-2-1-1' },
                { l: 'Изо-растяжка 2-3-1-0', v: '2-3-1-0' },
              ].map(t => {
                const active = `${tempoAdjust?.eccentric}-${tempoAdjust?.bottomPause}-${tempoAdjust?.concentric}-${tempoAdjust?.topPause}` === t.v;
                return (
                  <button key={t.v} onClick={() => {
                    const pts = t.v.split('-').map(Number);
                    setTempoAdjust(active ? null : { eccentric: pts[0], bottomPause: pts[1], concentric: pts[2], topPause: pts[3], label: t.l });
                  }} style={{
                    padding: '6px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                    border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
                    background: active ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)',
                    color: active ? ACCENT : DIM,
                  }}>{t.l}</button>
                );
              })}
            </div>
            {tempoAdjust && <div style={{ fontSize: 9, color: ACCENT, marginTop: 4 }}>Темп: {tempoAdjust.eccentric}с эксцентрика / {tempoAdjust.bottomPause}с пауза / {tempoAdjust.concentric}с концентрика / {tempoAdjust.topPause}с пауза</div>}
          </div>

          {/* RIR-волна по четвертям мезоцикла */}
          <div style={{ background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', marginBottom: 6 }}>🌊 ВОЛНА ИНТЕНСИВНОСТИ (RIR ПО НЕДЕЛЯМ)</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(RIR_WAVE_PATTERNS).map(([key, wave]) => (
                <button key={key} onClick={() => setRirWave(key)}
                  style={{
                    textAlign: 'left', flex: 1, minWidth: 100,
                    padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 700, lineHeight: 1.3,
                    border: rirWave === key ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
                    background: rirWave === key ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)',
                    color: rirWave === key ? ACCENT : DIM,
                  }}>
                  <div>{wave.label}</div>
                  <div style={{ fontSize: 8, fontWeight: 400, opacity: 0.6, marginTop: 2 }}>{wave.desc}</div>
                  <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
                    {wave.rirByQuarter.map((rir, qi) => (
                      <span key={qi} style={{
                        padding: '1px 4px', borderRadius: 3, fontSize: 7, fontWeight: 800,
                        background: rir <= 1 ? 'rgba(239,68,68,0.2)' : rir <= 2 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                        color: rir <= 1 ? '#ef4444' : rir <= 2 ? '#f59e0b' : '#22c55e',
                      }}>Q{qi + 1}:RIR{rir}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
            {rirWave && (
              <div style={{ fontSize: 9, color: '#93c5fd', marginTop: 4 }}>
                Прогрессия RIR: {RIR_WAVE_PATTERNS[rirWave].rirByQuarter.join(' → ')} по четвертям {mesoLength}-нед мезоцикла
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>🔀 СТРАТЕГИЯ ПОСЛЕДОВАТЕЛЬНОСТИ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {([
                { l: 'Классическая', v: 'classic' as const, d: 'Compounds → изоляция' },
                { l: 'Pre-Exhaust', v: 'preexhaust' as const, d: 'Изоляция → compounds' },
                { l: 'Антагонисты', v: 'antagonist' as const, d: 'Суперсеты пар' },
              ]).map(s => (
                <button key={s.v} onClick={() => setSequenceStrategy(s.v)} style={{
                  padding: '6px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 700, lineHeight: 1.3,
                  border: sequenceStrategy === s.v ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.08)',
                  background: sequenceStrategy === s.v ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)',
                  color: sequenceStrategy === s.v ? ACCENT : DIM,
                }}>{s.l}<div style={{ fontSize: 8, fontWeight: 400, opacity: 0.6 }}>{s.d}</div></button>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(24,24,27,0.12)', borderRadius: 10, padding: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>⚙️ ДОПОЛНИТЕЛЬНО</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 2 }}>MRV (переопределение)</div>
                <input type="number" value={mrvOverride ?? ''} onChange={e => setMrvOverride(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Авто" style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: '#000', border: '1px solid rgba(255,255,255,0.1)', color: '#f59e0b', fontSize: 11, fontWeight: 700 }} />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 2 }}>Готовность: {readinessSlider}%</div>
                <input type="range" min={0} max={100} value={readinessSlider} onChange={e => setReadinessSlider(+e.target.value)}
                  style={{ width: '100%' }} />
              </div>
            </div>
          </div>

          {renderStepNav('Далее: Анализ →')}
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* ШАГ 5: АНАЛИЗ */}
      {/* ════════════════════════════════════════════════ */}
      {wizardStep === 5 && (
        <div key="step5" style={{ animation: 'fadeSlideIn 0.3s ease' }}>
          <div style={{ padding: 10, borderRadius: 10, border: `1px solid ${analysisQuality.color}40`, background: `${analysisQuality.color}08` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: analysisQuality.color }}>📊 Предпросмотр качества</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: analysisQuality.color }}>{analysisQuality.score}<span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>/100</span></span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginBottom: 8 }}>
              <div style={{ height: '100%', width: analysisQuality.score + '%', borderRadius: 2, background: analysisQuality.color, transition: 'width 1s' }} />
            </div>
            {analysisQuality.items.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 10, color: b.ok ? 'rgba(255,255,255,0.7)' : analysisQuality.color }}>
                <span style={{ fontSize: 9 }}>{b.ok ? '✅' : '❌'}</span>
                <span style={{ fontWeight: 700, minWidth: 80 }}>{b.label}</span>
                <span style={{ opacity: 0.8, flex: 1 }}>{b.detail}</span>
              </div>
            ))}
          </div>

          <PlanPreviewStep5
            generatedDays={generatedDays}
            weeklySets={generatedWeeklySets}
            mrvOverride={mrvOverride}
            level={level}
            corrections={generatedCorrections}
          />

          {/* Анализ слабых групп — тренерская рекомендация */}
          {weakPoints.length > 0 && (
            <div style={{ padding: 10, borderRadius: 10, marginBottom: 8, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 6 }}>🎯 ФОКУС НА СЛАБЫЕ ГРУППЫ</div>
              {weakPoints.map(wp => {
                const wpExCount = generatedDays.reduce((s, d) => s + d.exercises.filter(e => e.group === wp).length, 0);
                const wpSets = generatedDays.reduce((s, d) => s + d.exercises.filter(e => e.group === wp).reduce((ss, e) => ss + e.sets, 0), 0);
                const WEAK_EX_SUGGESTIONS: Record<string, string[]> = {
                  chest: ['Жим гантелей на наклонной скамье', 'Сведение рук в кроссовере (верхние блоки)', 'Разведение гантелей лёжа'],
                  back: ['Тяга гантели одной рукой в наклоне', 'Тяга верхнего блока широким хватом', 'Шраги с гантелями'],
                  legs: ['Болгарские выпады', 'Жим ногами в тренажёре', 'Сгибание ног лёжа'],
                  shoulders: ['Махи гантелями в стороны', 'Тяга штанги к подбородку', 'Жим гантелей сидя'],
                  arms: ['Сгибание рук с гантелями (молот)', 'Разгибание рук на блоке (канат)', 'Сгибание рук со штангой стоя'],
                  core: ['Подъём ног в висе', 'Планка с отягощением', 'Косые скручивания на блоке'],
                };
                const suggestions = WEAK_EX_SUGGESTIONS[wp] || [];
                return (
                  <div key={wp} style={{ padding: '8px', marginBottom: 4, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>
                        {GROUP_RU[wp] || wp} — отстающая группа
                      </span>
                      <span style={{ fontSize: 9, color: DIM }}>{wpExCount} упр · {wpSets} сетов</span>
                    </div>
                    <div style={{ fontSize: 9, color: DIM, marginBottom: 2 }}>
                      Рекомендуемые упражнения (акцент + изоляция):
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {suggestions.map(s => (
                        <span key={s} style={{
                          fontSize: 8, padding: '2px 6px', borderRadius: 4,
                          background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                          border: '0.5px solid rgba(245,158,11,0.2)', fontWeight: 600,
                        }}>{s}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Волна RIR */}
          {rirWave && (
            <div style={{ padding: '8px 10px', borderRadius: 10, marginBottom: 8, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>🌊 Периодизация RIR по четвертям</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {RIR_WAVE_PATTERNS[rirWave].rirByQuarter.map((rir, qi) => {
                  const qLen = Math.ceil(mesoLength / 4);
                  const weeks = Array.from({ length: qLen }, (_, i) => qi * qLen + i + 1).filter(w => w <= mesoLength);
                  return (
                    <div key={qi} style={{
                      padding: '6px 10px', borderRadius: 6, flex: 1, minWidth: 60, textAlign: 'center',
                      background: rir <= 1 ? 'rgba(239,68,68,0.06)' : rir <= 2 ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
                      border: `1px solid ${rir <= 1 ? 'rgba(239,68,68,0.2)' : rir <= 2 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`,
                    }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: DIM }}>Нед {weeks[0]}–{weeks[weeks.length - 1]}</div>
                      <div style={{
                        fontSize: 14, fontWeight: 900,
                        color: rir <= 1 ? '#ef4444' : rir <= 2 ? '#f59e0b' : '#22c55e',
                      }}>RIR {rir}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ padding: 10, borderRadius: 10, background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>📋 Коррекции по анализу</div>
            {analysisQuality.items.filter(b => !b.ok).length === 0 && <div style={{ fontSize: 10, color: '#22c55e' }}>✅ План сбалансирован — все показатели в норме.</div>}
            {analysisQuality.items.filter(b => !b.ok).map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', marginBottom: 4, borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: 9, color: b.ok ? 'inherit' : '#f59e0b', flex: 1 }}>{b.detail}</span>
                {b.group && analysisQuality.wk[b.group] > analysisQuality.mrv && (
                  <button onClick={() => applyCorrection('mrv')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)', color: '#f59e0b', cursor: 'pointer', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    ↑ MRV
                  </button>
                )}
                {!b.ok && b.label === 'Охват' && (
                  <button onClick={() => applyCorrection('split')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.06)', color: '#60a5fa', cursor: 'pointer', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 4 }}>
                    Сплит
                  </button>
                )}
                {!b.ok && b.label === 'Базовые' && (
                  <button onClick={() => applyCorrection('methods')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)', color: '#a855f7', cursor: 'pointer', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 4 }}>
                    Методы
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 4, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.15)' }}>
            <div style={{ fontSize: 10, color: DIM, marginBottom: 6 }}>
              План будет автоматически сгенерирован с учётом вашего профиля, сплита, методик и настроек. После сборки вы сможете редактировать каждое упражнение.
            </div>
            <button onClick={generateManualPlan} style={{
              width: '100%', padding: 12, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13,
              boxShadow: '0 4px 16px rgba(0,230,138,0.25)',
            }}>
              🔧 Собрать программу
            </button>
          </div>

          {wizardStep > 1 && (
            <button onClick={() => setWizardStep(s => s - 1)}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              ← Назад
            </button>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* ШАГ 6: ПРОГРАММА */}
      {/* ════════════════════════════════════════════════ */}
      {wizardStep === 6 && (
        <div key="step6" style={{ animation: 'fadeSlideIn 0.3s ease' }}>
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

          {manualResult && (
            <ToolsPanel
              result={manualResult} setResult={setManualResult}
              manualCfg={manualCfg} tprofile={tprofile}
              goal={goal} level={level}
              mesoLength={mesoLength} daysPerWeek={daysPerWeek}
              manualWorkMax={manualWorkMax} labAnalysis={labAnalysis}
              onToRuntime={manualToRuntime}
            />
          )}

          <button onClick={() => setWizardStep(5)}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
            ← Назад к анализу
          </button>
        </div>
      )}
    </div>
  );
};
