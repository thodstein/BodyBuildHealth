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
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';
import { TrainingProfileCard } from '../TrainingProfileCard';
import type { TrainingProfile } from '../training-profile';
import { PCT_FOR_RIR, ACCENT, DIM, detectGroup, getMrv, type ManualResult, type ManualDay, type ManualExercise } from './types';
const PHASE_LABELS_MAP: Record<string, string> = { accumulation: 'Накопление', intensification: 'Интенсификация', peaking: 'Пик', deload: 'Разгрузка', gpp: 'GPP', spp: 'SPP' };
import { ConstructorProfile } from './ConstructorProfile';
import { ConfigPanel } from './ConfigPanel';
import { PlanDisplay } from './PlanDisplay';
import { ToolsPanel } from './ToolsPanel';
import { PlannerToolsPanel } from '../PlannerToolsPanel';
import { getMethodsByCategory } from '../../../../engines/training-methodology.engine';
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

  const [readinessSlider, setReadinessSlider] = useState(tprofile.recovery || 70);
  const [targetTonnage, setTargetTonnage] = useState<Record<string, number>>({});

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

  // Применение выбранных методик к плану: каждая модифицирует сеты/RIR/темп/объём
  const applyMethodsToPlan = useCallback((days: ManualDay[], cfg: Record<string, string>, wm: Record<string, number>, gl: string, mrvVal: number) => {
    const log: string[] = [];
    let modified = days.map((d: ManualDay) => ({ ...d, exercises: d.exercises.map((e: ManualExercise) => ({ ...e })) }));

    // ─── Вспомогательные: определить первое compound-упражнение для каждой группы ───
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

      // ── Прогрессия ── (применяется выборочно: compounds → сила, изоляция → гипертрофия)
      if (cat === 'progression') {
        if (name.includes('Max Effort') || name.includes('Максимальных усилий')) {
          // Только первое compound каждой группы — силовой режим, остальное — гипертрофия добора
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

      // ── Интенсивность ── (только на 1-2 упражнения в день, не на всё)
      if (cat === 'intensity') {
        if (name.includes('Cluster') || name.includes('Кластер')) {
          // Только первое compound дня
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise, ei: number) =>
              ei === 0 ? { ...e, sets: 5, reps: '5 (2+2+1)', rir: 1, rest: 180 } : e
            ),
          }));
          log.push('Кластеры: первое упражнение дня → 5×5 (2+20с+2+20с+1), отдых 3 мин.');
        } else if (name.includes('Drop-Set') || name.includes('Дроп-сет')) {
          // Только последняя изоляция каждой группы
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
          // Первое compound каждой группы
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
          // Первая изоляция каждой группы
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
          // Первое compound каждой группы (безопасно)
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
          // Все изоляции — высокий объём, короткий отдых
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise) =>
              e.rest < 120 ? { ...e, sets: Math.max(3, e.sets), reps: '10-15', rir: 1, rest: 45 } : e
            ),
          }));
          log.push('Метаболический тренинг: изоляция → 3-4×10-15, отдых 45с.');
        } else if (name.includes('Форсированные') || name.includes('Forced Reps')) {
          // Только последний подход каждого compound
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

      // ── Техника ── (без изменений — задаёт глобальный темп)
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

      // ── Объём ── (меняет сеты выборочно: GVT→compounds, FST-7→последнее упр, Gironda→изоляция)
      if (cat === 'volume') {
        if (name.includes('GVT') || name.includes('German Volume') || name.includes('10×10')) {
          // Только compounds
          modified = modified.map((d: ManualDay) => ({
            ...d, exercises: d.exercises.map((e: ManualExercise) =>
              e.rest >= 150 ? { ...e, sets: 10, reps: '10', rir: 3, rest: 60 } : e
            ),
          }));
          log.push('GVT 10×10: compounds → 10×10 @60% 1ПМ, отдых 60с. Изоляция без изменений.');
        } else if (name.includes('FST-7') || name.includes('Fascia')) {
          // Последнее упражнение каждой группы
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
          // Только изоляция
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

      // ── Специализация ── (без изменений)
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
    return { days: modified, log };
  }, []);

  // ─── LIVE-GENERATION: План пересчитывается автоматически при изменении параметров ───
  const { days: generatedDays, weeklySets: generatedWeeklySets, groupCorrections: generatedCorrections, patternBalance: generatedBalance } = useMemo(() => {
    const auto = selectSplit({ goal, level, daysPerWeek, recovery, fatigue, nutrition: 7, weakPoints, sessionDuration: 60, exercises: [] } as any);
    const manualSp = manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null;
    const sp = manualSp ? { id: manualCfg.split!, name: manualSp.name, desc: manualSp.desc, groupsPerDay: manualSp.groupsPerDay, score: 100, rationale: ['Ручной выбор'] } as any : auto[0];
    
    if (!sp) return { days: [], weeklySets: {}, groupCorrections: ['Ошибка подбора сплита'], patternBalance: {} };
    
    const cycle: string[][] = []; let gi = 0;
    while (cycle.length < daysPerWeek) { cycle.push(sp.groupsPerDay[gi % sp.groupsPerDay.length]); gi++; }
    const labAdj = labTrainingAdjust(labAnalysis);
    const mrv = mrvOverride ?? getMrv(level, tprofile.onCourse, tprofile.courseIntensity, labAdj.mrvMultiplier);
    
    const built = buildPlan(cycle, mrv, { currentReadiness: readinessSlider, targetTonnage, sequenceStrategy: (manualCfg.sequence || 'classic') as 'classic' | 'preexhaust' | 'antagonist' });
    
    const methodResult = applyMethodsToPlan(built.days as ManualDay[], manualCfg, manualWorkMax, goal, mrv);
    
    const finalCorrections = [...built.groupCorrections, ...methodResult.log];
    
    // ─── Детектор конфликтов: Слишком много тяжёлых базовых в один день ───
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
  }, [goal, level, daysPerWeek, recovery, fatigue, weakPoints, manualCfg, tprofile, labAnalysis, buildPlan, mrvOverride, manualWorkMax, applyMethodsToPlan, readinessSlider, targetTonnage]);

  const generateManualPlan = useCallback(() => {
    const sp = manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null;
    const splitName = (manualCfg.split ? TRAINING_SPLITS[manualCfg.split] : null)?.name || 'Авто-сплит';
    
    setManualResult({ 
      splitName: splitName, 
      corrections: generatedCorrections, 
      days: generatedDays 
    });
    setConstTab('editor');
  }, [generatedDays, generatedCorrections, manualCfg]);

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
      const methodResult2 = applyMethodsToPlan(built.days as ManualDay[], manualCfg, manualWorkMax, goal, mrvBase);
      corrections.push(...methodResult2.log);
      setManualResult({ splitName: p.data.name || p.label || 'Сплит из калькулятора', corrections, days: methodResult2.days });
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
    setConstTab('editor');
  }, [buildPlan, level, tprofile, labAdj, manualResult, mrvOverride, manualCfg, manualWorkMax, goal, applyMethodsToPlan]);

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

  // ─── Превью перед сборкой ───
  const buildPreview = useMemo(() => {
    const selSplit = manualCfg.split || 'авто';
    const selDays = daysPerWeek + 'дн';
    const selGoal = goal === 'mass' ? 'масса' : goal === 'strength' ? 'сила' : goal === 'powerlifting' ? 'пауэрлифтинг' : goal;
    const selLevel = level === 'beginner' ? 'нов' : level === 'intermediate' ? 'сред' : level === 'advanced' ? 'про' : level;
    return `${selSplit} · ${selDays} · ${selGoal} · ${selLevel}${manualCfg.specialization ? ' · спец: ' + manualCfg.specialization.slice(0, 25) : ''}`;
  }, [manualCfg.split, manualCfg.specialization, daysPerWeek, goal, level]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* ─── ШАПКА ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: ACCENT }}>🛠 Конструктор тренировок</h2>
        {manualResult && (
          <button onClick={() => { setManualResult(null); setConstTab('params'); }}
            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
            ✕ Сбросить
          </button>
        )}
      </div>

      {/* ─── ПРЕВЬЮ ТЕКУЩЕЙ КОНФИГУРАЦИИ ─── */}
      <div style={{
        padding: '6px 10px', borderRadius: 8,
        background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)',
        fontSize: 10, color: '#93c5fd', fontWeight: 600, lineHeight: 1.5,
      }}>
        {macrocycle ? '🔗 Макроцикл (цель: ' + macrocycle.goal + ')' : '✏️ Ручной режим'}: {buildPreview}
      </div>

      {applyPayload && (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', border: '1px solid rgba(0,230,138,0.25)', fontSize: 11, color: ACCENT, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ {applyPayload.label}</span>
          <button onClick={() => { clearPlannerApply(); setApplyPayload(null); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: DIM, fontSize: 10, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ─── ТАБЫ ─── */}
      <div style={{
        display: 'flex', gap: 3, padding: 5, borderRadius: 11,
        background: 'rgba(24,24,27,0.15)', border: '1px solid rgba(255,255,255,0.04)',
      }}>
        {([
          ['params','📋 Параметры и сборка'],
          ['editor','✏️ Редактор упражнений'],
          ['tools','🛠 Инструменты тренера'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setConstTab(id)} style={{
            flex: 1, padding: '9px 4px', borderRadius: 8,
            fontSize: 11, fontWeight: 700, cursor: 'pointer', lineHeight: 1.2,
            border: constTab === id ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.06)',
            background: constTab === id ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.02)',
            color: constTab === id ? ACCENT : DIM,
            position: 'relative' as const,
          }}>{label}{id === 'editor' && manualResult && <span style={{ position: 'absolute', top: 3, right: 6, width: 6, height: 6, borderRadius: 3, background: ACCENT }} />}{id === 'params' && macrocycle && <span style={{ position: 'absolute', top: 3, right: 6, width: 6, height: 6, borderRadius: 3, background: '#60a5fa' }} />}</button>
        ))}
      </div>

      {/* ─── ВСЕГДА: ПРОФИЛЬ И ЛАБ. КОРРЕКЦИЯ ─── */}
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

      {/* ─── ВКЛАДКА EDITOR: конфиг + сборка + результат ─── */}
      {constTab === 'editor' && (
        <>
       <ConfigPanel 
         manualCfg={manualCfg} setManual={setManual} onLoadProgram={loadProgramToConstructor} 
         targetTonnage={targetTonnage} setTargetTonnage={(g: string, v: number) => setTargetTonnage(prev => ({ ...prev, [g]: v }))}
       />


          {/* Кнопка сборки с превью */}
          <div style={{
            background: 'rgba(0,230,138,0.04)', borderRadius: 10,
            border: '1px solid rgba(0,230,138,0.15)', padding: 10,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <button onClick={generateManualPlan} style={{
              width: '100%', padding: 12, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#00e68a,#00c853)', color: '#000', fontWeight: 800, fontSize: 13,
              boxShadow: '0 4px 16px rgba(0,230,138,0.25)',
              transition: 'transform 0.15s',
            }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}>
              🔧 Собрать программу
            </button>
            <div style={{ fontSize: 9, color: DIM, textAlign: 'center' }}>
              {buildPreview}. Будет построено ~{daysPerWeek} дней, MRV по профилю и лаборатории.
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
