/**
 * SessionPlayer.tsx — экран выполнения плана ПЛ/ББ.
 * REUSE workout-logger.engine: startSession → addExerciseToSession → logSet → finishSession.
 * Mobile-first, dark theme. Принимает нормализованный план (дни → упражнения → целевые сеты).
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  startSession, addExerciseToSession, logSet, finishSession,
  getLastSession, getRecentPRs, type WorkoutSession, type CachedProgress,
  getExerciseProgress, cacheExerciseProgress, cacheSessionStats, getWorkoutStats,
  compareWithPrevious, getCachedProgressForExercise,
} from '../../../engines/workout-logger.engine';
import { generateWarmup, upsertWarmupLog, warmupLabel, warmupSpecificLabel, WARMUP_SKIP_REASONS, type WarmupInput, type WarmupMode } from '../../../engines/warmup.engine';
import { generateCooldown, upsertCooldownLog, cooldownLabel, COOLDOWN_SKIP_REASONS, type CooldownInput } from '../../../engines/cooldown.engine';
import { type WarmupBlock, type CooldownBlock } from '../../../core/types';
import { computeSessionMetrics } from './sessionMetrics';
import { hapticImpact, hapticNotify } from '../../../core/telegram';
import { velocityLoss, velocityLossZone, thresholdForIntent, type VBTIntent } from '../../../engines/pro/vbt.engine';
import { calculatePlates } from '../../../engines/gym-competition.engine';
import { saveSRPESession } from '../../../engines/pro/srpe-store';
import { useTrainingProfile } from '../TrainingScreen_parts/training-profile';
import { recommendTempo, formatTempo, TEMPO_PRESETS } from '../../../engines/rep-tempo.engine';
import { recordSessionRIR, getSessionRIRFeedback } from '../../../engines/rir-calibration.engine';
import { recordMMC } from '../../../engines/mmc-tracking.engine';
import { MindsetPreSessionCard, MindsetApproachHint, MindsetCheckinCard } from './MindsetSessionPanels';
import { MobilitySessionPanel, MobilityPostPanel } from './MobilitySessionPanel';
import { PlateCalcTab } from '../TrainingScreen_parts/PlateCalcTab';
import { techniqueLabel, techniqueChainParts } from '../TrainingScreen_parts/bb-technique-display';

  const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
  const ACCENT = '#00e68a';
  
  // CSS анимация для таймера
  const timerAnimationStyle = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes slideIn {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;

function formatPlates(targetW: number): string {
  if (targetW <= 0) return '';
  const r = calculatePlates(targetW);
  if (r.platesPerSide.length > 0) {
    return r.platesPerSide.map(p => `${p.count * 2}x${p.plate}`).join(' + ') + ` на гриф ${r.barWeight} кг`;
  }
  return `гриф ${r.barWeight} кг`;
}
const BTN: React.CSSProperties = { background: ACCENT, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '10px 14px', fontWeight: 600, fontSize: 14, minHeight: 44 };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: ACCENT, border: `1px solid ${ACCENT}` };

/** ⏭ Пропустить разминку/заминку с указанием причины (пишется в дневник). */
const SkipBar: React.FC<{ reasons: string[]; onSkip: (reason: string) => void; label: string }> = ({ reasons, onSkip, label }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0] || 'другое');
  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" style={{ ...BTN_GHOST, width: '100%', color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }} onClick={() => setOpen(v => !v)}>
        ⏭ Пропустить {label} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={reason} onChange={e => setReason(e.target.value)} aria-label={`Причина пропуска ${label}`}
            style={{ ...IN, flex: 1, minWidth: 160, minHeight: 40 }}>
            {reasons.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="button" style={{ ...BTN, flex: 1, minWidth: 120 }} onClick={() => { onSkip(reason); setOpen(false); }}>
            Пропустить
          </button>
        </div>
      )}
    </div>
  );
};
const IN: React.CSSProperties = { background: 'var(--input-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px', minHeight: 38, width: '100%', boxSizing: 'border-box' as const };
const LABEL: React.CSSProperties = { color: '#fff', fontSize: 11, margin: '4px 0 2px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: '#fff', fontSize: 12, lineHeight: 1.4 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' };

export interface PlayerSet { weight: number; reps: number; rir: number; technique?: string }
export interface PlayerExercise {
  name: string;
  muscleGroup: string;
  targetSets: PlayerSet[];
  restSec?: number; // целевой отдых между подходами (сек), из presc
  // Поля метрик (передаются из плана; иначе — эвристика).
  pm?: number;       // предельный максимум упражнения (кг)
  coef?: number;     // Коэф. тяжести (1.2 / 1.0 / 0.3)
  mnosz?: number;    // Множ (множитель нагрузки)
  group?: string;    // группа (ЖМ/ПР/ТГ/Ср)
}
export interface PlayerDay { label: string; exercises: PlayerExercise[] }

export interface SessionPlayerProps {
  days: PlayerDay[];
  weekNumber: number;
  focus: string;
  /** Вызывается после успешного сохранения сессии в дневник (обновление внешних данных). */
  onSaved?: () => void;
}

export const SessionPlayer: React.FC<SessionPlayerProps> = ({ days, weekNumber, focus, onSaved }) => {
  const [profile] = useTrainingProfile();
const [dayIdx, setDayIdx] = useState(0);
const [dayDetailsOpen, setDayDetailsOpen] = useState(true);
const [phase, setPhase] = useState<'ready' | 'warmup' | 'main' | 'cooldown' | 'done'>('ready');
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [done, setDone] = useState<WorkoutSession | null>(null);
  // Защита от двойного сохранения (finish вызывается из «Завершить» и из exitSession)
  const savedRef = useRef(false);
  const [warmupBlocks, setWarmupBlocks] = useState<WarmupBlock[]>([]);
  const [cooldownBlocks, setCooldownBlocks] = useState<CooldownBlock[]>([]);
  const [warmupDone, setWarmupDone] = useState<Record<string, boolean>>({});
  const [cooldownDone, setCooldownDone] = useState<Record<string, boolean>>({});
  const [warmupMode, setWarmupMode] = useState<WarmupMode>(() => {
    try { const v = localStorage.getItem('he_warmup_mode') as WarmupMode | null; return v === 'quick' || v === 'full' ? v : 'standard'; } catch { return 'standard'; }
  });
  const [warmupQuality, setWarmupQuality] = useState<number | null>(null);
  const [warmupTimer, setWarmupTimer] = useState<{ i: number; j: number; remaining: number; total: number } | null>(null);
  // Таймер растяжки в фазе заминки (обратный отсчёт и автопроверка)
  const [coolTimer, setCoolTimer] = useState<{ i: number; j: number; remaining: number; total: number } | null>(null);
  useEffect(() => {
    if (!coolTimer) return;
    const t = window.setInterval(() => {
      setCoolTimer(p => {
        if (!p) return p;
        if (p.remaining <= 1) {
          setCooldownDone(prev => ({ ...prev, [`c_${p.i}_${p.j}`]: true }));
          return null;
        }
        return { ...p, remaining: p.remaining - 1 };
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [coolTimer ? `${coolTimer.i}_${coolTimer.j}` : null]);
  useEffect(() => {
    if (!warmupTimer) return;
    const t = window.setInterval(() => {
      setWarmupTimer(p => {
        if (!p) return p;
        if (p.remaining <= 1) {
          setWarmupDone(prev => ({ ...prev, [`w_${p.i}_${p.j}`]: true }));
          return null;
        }
        return { ...p, remaining: p.remaining - 1 };
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [warmupTimer ? `${warmupTimer.i}_${warmupTimer.j}` : null]);
  // фактический ввод текущего подхода: [exerciseIndex][setIndex] -> {weight,reps}
  const [actual, setActual] = useState<Record<string, { weight: number; reps: number; rpe: number }>>({});
   const [exDone, setExDone] = useState<Record<string, boolean>>({});
   const [interExTimerSec, setInterExTimerSec] = useState<number>(0);
   const [interExTimerRunning, setInterExTimerRunning] = useState<boolean>(false);
    const interExTimerRef = useRef<number | null>(null);
    // Причина пропуска разминки/заминки (устанавливается кнопкой «⏭ Пропустить»)
    const skipWarmupReasonRef = useRef<string | null>(null);
    const skipCooldownReasonRef = useRef<string | null>(null);
   const [supersetMode, setSupersetMode] = useState<boolean>(false);
   const [circuitMode, setCircuitMode] = useState<boolean>(false);
    const [supersetExercises, setSupersetExercises] = useState<number[]>([]);
    // Подкладка «Калькулятор блинов»: доступный вес применяется к упражнению текущей сессии
    const [plateOpen, setPlateOpen] = useState<boolean>(false);
    const [autoStartRest, setAutoStartRest] = useState<boolean>(true);
    const [exerciseProgress, setExerciseProgress] = useState<Record<string, { completed: number; total: number }>>({});
    const [restHistory, setRestHistory] = useState<{ exercise: string; duration: number; timestamp: string }[]>([]);
   const [timerSettings, setTimerSettings] = useState<{
     preset: 'compound' | 'isolation' | 'pump' | 'custom';
     customRest: number;
     autoStart: boolean;
   }>(() => {
     try {
       const saved = localStorage.getItem('he_timer_settings');
       if (saved) return JSON.parse(saved);
     } catch {}
     return { preset: 'compound' as const, customRest: 90, autoStart: true };
   });

    // P11: VBT-ввод скорости штанги (м/с) на сет + авторегуляция по потере скорости
  const [vel, setVel] = useState<Record<string, number>>({});
  const [mmco, setMMCOpen] = useState<string>('');
  const [mmcVals, setMMCVals] = useState<Record<string, number>>({});
  const [vbtIntent, setVbtIntent] = useState<VBTIntent>('strength');
  const [sessionRPE, setSessionRPE] = useState<number>(7);
  const [sessionDur, setSessionDur] = useState<number>(60);
  // авто-таймер отдыха
   const [timerSec, setTimerSec] = useState<number>(0);
   const [timerRunning, setTimerRunning] = useState<boolean>(false);
   const [timerExIdx, setTimerExIdx] = useState<number>(-1);
   const [timerPreset, setTimerPreset] = useState<'compound' | 'isolation' | 'pump' | 'custom'>('compound');
   const [customRestSec, setCustomRestSec] = useState<number>(90);
   const timerRef = useRef<number | null>(null);
   const [sessionTimerSec, setSessionTimerSec] = useState<number>(0);
   const [sessionTimerRunning, setSessionTimerRunning] = useState<boolean>(false);
    const sessionTimerRef = useRef<number | null>(null);

   // Сохранение настроек таймера при изменении
   useEffect(() => {
     try {
       localStorage.setItem('he_timer_settings', JSON.stringify({
         preset: timerPreset,
         customRest: customRestSec,
         autoStart: autoStartRest
       }));
     } catch {}
   }, [timerPreset, customRestSec, autoStartRest]);
 
   const day = days[dayIdx] || days[0];
  const last = useMemo(() => getLastSession(), [done]);
  const prs = useMemo(() => getRecentPRs(3), [done]);

  const speakRestComplete = (exIdx: number) => {
     if (!('speechSynthesis' in window)) return;
     const exName = day?.exercises[exIdx]?.name || 'упражнение';
     const utterance = new SpeechSynthesisUtterance(`Отдых завершён. Можно приступать к следующему подходу: ${exName}`);
     utterance.lang = 'ru-RU';
     utterance.rate = 1.0;
     utterance.pitch = 1.0;
     utterance.volume = 0.8;
     window.speechSynthesis.speak(utterance);
   };

    const speakWarning = (secondsLeft: number) => {
      if (!('speechSynthesis' in window)) return;
      const utterance = new SpeechSynthesisUtterance(`${secondsLeft} секунд до конца отдыха`);
      utterance.lang = 'ru-RU';
      utterance.rate = 1.2;
      utterance.pitch = 1.0;
      utterance.volume = 0.6;
      window.speechSynthesis.speak(utterance);
    };

    const currentRestSec = useMemo(() => {
      if (timerExIdx >= 0 && day?.exercises[timerExIdx]?.restSec) return day.exercises[timerExIdx].restSec;
      if (timerPreset === 'custom') return customRestSec;
      return 90; // default
    }, [timerExIdx, day, timerPreset, customRestSec]);

   // авто-таймер: обратный отсчёт
   useEffect(() => {
     if (!timerRunning || timerSec <= 0) return;
     timerRef.current = window.setTimeout(() => {
       setTimerSec(prev => {
         if (prev <= 1) { 
           setTimerRunning(false); 
           // Уведомление при завершении таймера
           hapticNotify('success');
           // Вибрация: паттерн зависит от типа таймера
           if (navigator.vibrate) {
             if (timerExIdx >= 0) {
               navigator.vibrate([200, 100, 200]); // двойная вибрация для отдыха между подходами
             } else {
               navigator.vibrate([500, 200, 500]); // длинная вибрация для отдыха между упражнениями
             }
           }
           // Звук
           try {
             const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
             audio.play().catch(() => {});
           } catch { /* browser block */ }
           // Голосовое уведомление
           speakRestComplete(timerExIdx);
           // Запись в историю отдыха
           if (timerExIdx >= 0 && day?.exercises[timerExIdx]) {
             const ex = day.exercises[timerExIdx];
             const restDuration = day.exercises[timerExIdx]?.restSec || currentRestSec;
             setRestHistory(prev => [...prev, {
               exercise: ex.name,
               duration: restDuration,
               timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
             }]);
           }
         } else if (prev <= 5) {
           // Предупреждение за 5 секунд
           hapticImpact('light');
           // Голосовое предупреждение
           speakWarning(prev);
         }
         return prev - 1;
       });
     }, 1000);
     return () => { if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; } };
   }, [timerRunning, timerSec, timerExIdx, day, currentRestSec]);

   // таймер сессии
   useEffect(() => {
     if (!sessionTimerRunning) return;
     sessionTimerRef.current = window.setTimeout(() => {
       setSessionTimerSec(prev => prev + 1);
     }, 1000);
     return () => { if (sessionTimerRef.current !== null) { window.clearTimeout(sessionTimerRef.current); sessionTimerRef.current = null; } };
   }, [sessionTimerRunning, sessionTimerSec]);

   // таймер между упражнениями
   useEffect(() => {
     if (!interExTimerRunning || interExTimerSec <= 0) return;
     interExTimerRef.current = window.setTimeout(() => {
       setInterExTimerSec(prev => {
         if (prev <= 1) { 
           setInterExTimerRunning(false); 
           hapticNotify('success');
         }
         return prev - 1;
       });
     }, 1000);
     return () => { if (interExTimerRef.current !== null) { window.clearTimeout(interExTimerRef.current); interExTimerRef.current = null; } };
   }, [interExTimerRunning, interExTimerSec]);

  const getRestTime = useCallback((ei: number): number => {
     if (timerPreset === 'custom') return customRestSec;
     const ex = day?.exercises[ei];
     if (!ex) return 90;
     const isCompound = ['chest','back','quads','hamstrings','shoulders','legs'].includes(ex.muscleGroup?.toLowerCase() || '');
     if (timerPreset === 'compound') return isCompound ? 180 : 90;
     if (timerPreset === 'isolation') return isCompound ? 120 : 60;
     if (timerPreset === 'pump') return 45;
      return ex.restSec || 90;
    }, [day, timerPreset, customRestSec]);

    const getSupersetRestTime = useCallback((): number => {
      if (circuitMode) return 0; // no rest between exercises in circuit
      return 30; // short rest for supersets
    }, [circuitMode]);
 
    const startRestTimer = useCallback((ei: number) => {
     // В режиме суперсета или круга проверяем, нужно ли запускать таймер
     if (supersetMode || circuitMode) {
       const isInSuperset = supersetExercises.includes(ei);
       if (isInSuperset && supersetExercises.length > 1) {
         const currentIdx = supersetExercises.indexOf(ei);
         const isLastInSuperset = currentIdx === supersetExercises.length - 1;
         if (!isLastInSuperset) {
           // Ещё не все упражнения суперсета выполнены - короткий отдых или без отдыха
           const rest = circuitMode ? 0 : getSupersetRestTime();
           if (rest > 0) {
             setTimerExIdx(ei);
             setTimerSec(rest);
             setTimerRunning(true);
           }
           return;
         }
       }
     }
     const rest = getRestTime(ei);
     setTimerExIdx(ei);
     setTimerSec(rest);
     setTimerRunning(true);
   }, [day, getRestTime, supersetMode, circuitMode, supersetExercises, getSupersetRestTime]);

  const skipRestTimer = useCallback(() => {
     setTimerRunning(false);
     setTimerSec(0);
     setTimerExIdx(-1);
     if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
   }, []);

  const startInterExTimer = useCallback((restSec: number = 120) => {
    setInterExTimerSec(restSec);
    setInterExTimerRunning(true);
  }, []);

  const skipInterExTimer = useCallback(() => {
    setInterExTimerRunning(false);
    setInterExTimerSec(0);
    if (interExTimerRef.current !== null) { window.clearTimeout(interExTimerRef.current); interExTimerRef.current = null; }
  }, []);

  // Superset/circuit mode handlers
  const toggleSupersetMode = useCallback(() => {
    setSupersetMode(prev => !prev);
    if (circuitMode) setCircuitMode(false);
    if (!supersetMode) setSupersetExercises([]);
  }, [supersetMode, circuitMode]);

  const toggleCircuitMode = useCallback(() => {
    setCircuitMode(prev => !prev);
    if (supersetMode) setSupersetMode(false);
    if (!circuitMode) setSupersetExercises([]);
  }, [circuitMode, supersetMode]);

  const toggleExerciseInSuperset = useCallback((ei: number) => {
    setSupersetExercises(prev => {
      if (prev.includes(ei)) return prev.filter(x => x !== ei);
      return [...prev, ei].sort((a, b) => a - b);
     });
    }, []);

   const timerPct = timerRunning && timerSec > 0 && currentRestSec > 0
    ? ((currentRestSec - timerSec) / currentRestSec) * 100
    : 0;

  const begin = () => {
    if (!day || !Array.isArray(day.exercises)) return;
    
    const riskFlags: Record<string, string> = {};
    if (profile.injuries?.length) {
      profile.injuries.forEach(inj => {
        const m = inj.muscle?.toLowerCase() || '';
        if (m.includes('колен') || m.includes('knee')) riskFlags['knee'] = 'high';
        if (m.includes('плеч') || m.includes('shoulder')) riskFlags['shoulder'] = 'high';
        if (m.includes('спин') || m.includes('поясн') || m.includes('back') || m.includes('lumbar')) riskFlags['back'] = 'high';
      });
    }
    const techniqueIssues: string[] = profile.weakPoints?.length
      ? profile.weakPoints.map(w => {
          const wp = String(w).toLowerCase();
          if (wp.includes('back') || wp.includes('поясн') || wp === 'core') return 'rounding_back';
          if (wp.includes('knee') || wp.includes('колен')) return 'knee_valgus';
          if (wp.includes('shoulder') || wp.includes('плеч')) return 'tight_shoulders';
          if (wp.includes('hip') || wp.includes('бёдр') || wp.includes('таз')) return 'tight_hips';
          if (wp.includes('ankle') || wp.includes('голеност')) return 'tight_ankles';
          if (wp.includes('chest') || wp.includes('груд')) return 'tight_chest';
          return '';
        }).filter(Boolean)
      : [];
    const warmupInput: WarmupInput = {
      sessionFocus: focus,
      primaryExercises: day.exercises.map(ex => ex.name),
      primaryWeights: day.exercises.map(ex => (Array.isArray(ex.targetSets) && ex.targetSets[0]?.weight ? Number(ex.targetSets[0].weight) : null) as any),
      riskFlags,
      techniqueIssues,
      fatigueLevel: profile.fatigue / 10,
      equipmentAvailable: profile.equipment,
      targetGroups: Array.from(new Set(day.exercises.map(ex => ex.muscleGroup || '').filter(Boolean))),
      mode: warmupMode,
    };
    setWarmupBlocks(generateWarmup(warmupInput));
    setPhase('warmup');
    setWarmupDone({});
    try { localStorage.setItem('he_warmup_mode', warmupMode); } catch {}
  };

  const startMain = () => {
     if (!day || !Array.isArray(day.exercises)) return;
     // Фиксируем факт разминки в дневник (he_warmup_diary, одна запись на дату)
     try {
       const total = warmupBlocks.reduce((s, b) => s + b.exercises.length, 0);
       const doneCnt = Object.values(warmupDone).filter(Boolean).length;
       const pct = total > 0 ? doneCnt / total : 0;
       const skipped = skipWarmupReasonRef.current;
       upsertWarmupLog({
         date: new Date().toISOString().slice(0, 10),
         done: skipped ? false : doneCnt > 0,
         quality: skipped ? null : doneCnt > 0 ? (pct >= 0.8 ? 4 : pct >= 0.5 ? 3 : 2) : null,
         totalItems: total,
         doneItems: doneCnt,
         skippedReason: skipped || (doneCnt === 0 ? 'не отметил ни одного пункта' : undefined),
       });
       skipWarmupReasonRef.current = null;
     } catch { /* дневник разминки недоступен — не блокируем переход */ }
     let s = startSession(focus || day.label, weekNumber);
     day.exercises.forEach(ex => {
       s = addExerciseToSession(s, { id: ex.name, name: ex.name, pattern: ex.muscleGroup, muscleGroup: ex.muscleGroup });
     });
     setSession(s);
     setPhase('main');
     // авто-подтягивание весов из последней сессии (double progression)
     const prevSession = getLastSession();
     if (prevSession && prevSession.exercises.length > 0) {
       const prevMap: Record<string, { weightKg: number; reps: number }[]> = {};
       prevSession.exercises.forEach(ex => {
         if (ex.exerciseName && Array.isArray(ex.sets)) {
           prevMap[ex.exerciseName.toLowerCase()] = ex.sets.map(st => ({ weightKg: st.weightKg, reps: st.reps }));
         }
       });
       const prefilled: Record<string, { weight: number; reps: number; rpe: number }> = {};
       day.exercises.forEach((ex, ei) => {
         const prevSets = prevMap[ex.name.toLowerCase()];
         if (prevSets && prevSets.length > 0) {
           ex.targetSets.forEach((t, si) => {
             const prev = prevSets[si] || prevSets[prevSets.length - 1];
             if (prev && prev.weightKg > 0) {
               prefilled[`${ei}_${si}`] = { weight: prev.weightKg, reps: prev.reps, rpe: 0 };
             }
           });
         }
       });
       setActual(prefilled);
     } else {
       setActual({});
     }
      setExDone({});
      setRestHistory([]);
      savedRef.current = false;
      // старт таймера сессии
      setSessionTimerSec(0);
      setSessionTimerRunning(true);
    };

  const finish = () => {
    if (!session || !day || !Array.isArray(day.exercises)) return;
    hapticNotify('success');
    const finished = finishSession(session, `${focus} — ${day?.label}`);
    savedRef.current = true;
    try { onSaved?.(); } catch { /* ignore */ }

    const finishRiskFlags: Record<string, string> = {};
    if (profile.injuries?.length) {
      profile.injuries.forEach(inj => {
        const m = inj.muscle?.toLowerCase() || '';
        if (m.includes('колен') || m.includes('knee')) finishRiskFlags['knee'] = 'high';
        if (m.includes('плеч') || m.includes('shoulder')) finishRiskFlags['shoulder'] = 'high';
      });
    }
    const cooldownInput: CooldownInput = {
      muscleGroupsUsed: Array.from(new Set(day.exercises.map(ex => ex.muscleGroup))),
      fatigueScore: profile.fatigue / 10,
      riskFlags: finishRiskFlags,
      sessionDuration: (Math.max(finished.durationMin || 0, sessionDur)) * 60,
      targetGroups: Array.from(new Set(day.exercises.map(ex => ex.muscleGroup || '').filter(Boolean))),
    };
    setCooldownBlocks(generateCooldown(cooldownInput));
    setPhase('cooldown');
    setCooldownDone({});

    try { saveSRPESession({ date: finished.date, sRPE: sessionRPE, durationMin: Math.max(finished.durationMin || 0, sessionDur) }); } catch { /* ignore */ }
    // RIR-калибровка: записываем фактические RIR по подходам
    try { recordSessionRIR(finished, { exercises: day.exercises.map(ex => ({ name: ex.name, targetSets: ex.targetSets })) }); } catch { /* ignore */ }
    // MMC-трекинг
    try {
      const mmcEntries = Object.entries(mmcVals).filter(([,v]) => v > 0);
      if (mmcEntries.length > 0) {
        mmcEntries.forEach(([key, val]) => {
          const parts = key.split('_');
          const ei = parseInt(parts[0] || '0');
          const si = parseInt(parts[1] || '0');
          const field = parts[2] || '';
          const exName = day.exercises[ei]?.name || '';
          if (field === 'mmc' || field === 'pump' || field === 'joint' || field === 'energy') {
            recordMMC({ date: finished.date, exerciseId: exName, exerciseName: exName, setNumber: si, mmc: field === 'mmc' ? val : 5, pump: field === 'pump' ? val : 5, jointDiscomfort: field === 'joint' ? val : 0, energy: field === 'energy' ? val : 5 });
          }
        });
      }
    } catch { /* ignore */ }
    setDone(finished);
    setSession(null);

    // Автообновление кэша прогресса после завершённой сессии
    try {
      const stats = getWorkoutStats();
      cacheSessionStats({ totalSessions: stats.totalSessions, totalVolume: stats.totalVolume, totalSets: stats.totalSets, totalReps: stats.totalReps, prCount: stats.prCount, streak: stats.streak });
      const progressItems = finished.exercises.map(ex => {
        const prog = getExerciseProgress(ex.exerciseName, 20);
        if (!prog) return null;
        return { exerciseName: prog.exerciseName, bestWeight: prog.bestWeight, bestReps: prog.bestReps, bestE1RM: prog.bestE1RM, totalVolume: prog.totalVolume, totalSets: prog.totalSets, sessions: prog.sessions, lastDate: prog.lastDate, trend: prog.trend, weightDelta: prog.weightDelta, e1RMDelta: prog.e1RMDelta, cachedAt: Date.now() };
      }).filter(Boolean) as CachedProgress[];
      cacheExerciseProgress(progressItems);
    } catch {}
  };

  const exitSession = () => {
    // «Завершить и выйти» должно СОХРАНЯТЬ тренировку: если есть подходы и ещё не сохранено — сохраняем.
    if (session && session.exercises.some(e => (e.sets || []).length > 0) && !savedRef.current) {
      finish();
      return;
    }
    // Фиксируем факт заминки в дневник (he_cooldown_diary, одна запись на дату)
    if (cooldownBlocks.length > 0) {
      try {
        const total = cooldownBlocks.reduce((s, b) => s + b.exercises.length, 0);
        const doneCnt = Object.values(cooldownDone).filter(Boolean).length;
        const pct = total > 0 ? doneCnt / total : 0;
        const skipped = skipCooldownReasonRef.current;
        upsertCooldownLog({
          date: new Date().toISOString().slice(0, 10),
          done: skipped ? false : doneCnt > 0,
          quality: skipped ? null : doneCnt > 0 ? (pct >= 0.8 ? 4 : pct >= 0.5 ? 3 : 2) : null,
          totalItems: total,
          doneItems: doneCnt,
          skippedReason: skipped || (doneCnt === 0 ? 'не отметил ни одного пункта' : undefined),
        });
        skipCooldownReasonRef.current = null;
      } catch { /* дневник заминки недоступен — не блокируем выход */ }
    }
    setPhase('done');
  };

   // горячие клавиши для быстрого логирования
   useEffect(() => {
     if (phase !== 'main') return;
     const handler = (e: KeyboardEvent) => {
       if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
       if (e.key === ' ' || e.key === 'Enter') {
         e.preventDefault();
         // найти первый незалогированный сет и залогировать
         if (!day || !Array.isArray(day.exercises)) return;
         for (let ei = 0; ei < day.exercises.length; ei++) {
           for (let si = 0; si < day.exercises[ei].targetSets.length; si++) {
             if (!actual[keyFor(ei, si)]) {
               logOne(ei, si);
               return;
             }
           }
         }
       }
       if (e.key === 'r' || e.key === 'R') {
         e.preventDefault();
         if (timerRunning) skipRestTimer();
         else if (timerExIdx >= 0) startRestTimer(timerExIdx);
       }
     };
     window.addEventListener('keydown', handler);
     return () => window.removeEventListener('keydown', handler);
   }, [phase, day, actual, timerRunning, timerExIdx]);


  const toggleWarmup = (blockIdx: number, exIdx: number) => {
    const id = `w_${blockIdx}_${exIdx}`;
    setWarmupDone(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCooldown = (blockIdx: number, exIdx: number) => {
    const id = `c_${blockIdx}_${exIdx}`;
    setCooldownDone(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const keyFor = (ei: number, si: number) => `${ei}_${si}`;

  const logOne = (ei: number, si: number) => {
     if (!session || !day || !Array.isArray(day.exercises)) return;
     hapticImpact('light');
     const ex = day.exercises[ei];
     if (!ex) return;
     const ts = Array.isArray(ex.targetSets) ? ex.targetSets[si] : null;
     const t = ts || { weight: weightFor(ex) || 60, reps: repsFor(ex) || 10, rir: rirFor(ex) ?? 2 };
     const a = actual[keyFor(ei, si)] || { weight: t.weight, reps: t.reps, rpe: Math.max(1, 10 - t.rir) };
      let s = logSet(session, ei, { setNumber: si + 1, weightKg: a.weight, reps: a.reps, rpe: a.rpe || Math.max(1, 10 - t.rir), rir: t.rir, notes: '', plannedWeight: t.weight, plannedReps: t.reps, plannedRir: t.rir }).session;
     setSession(s);
     setActual(prev => ({ ...prev, [keyFor(ei, si)]: a }));
     // обновляем прогресс упражнения
      setExerciseProgress(prev => {
        const total = ex.targetSets.length;
        const completed = Object.keys(prev).filter(k => k.startsWith(`${ei}_`) && prev[k]).length;
        return { ...prev, [String(ei)]: { completed: Math.min(completed + 1, total), total } };
      });
     // авто-старт таймера отдыха после подхода
     if (autoStartRest) {
       startRestTimer(ei);
     }
   };

  // batch skip: залогировать все подходы упражнения плановыми весами
  const skipExercise = useCallback((ei: number) => {
    if (!session || !day || !Array.isArray(day.exercises)) return;
    const ex = day.exercises[ei];
    if (!ex || !Array.isArray(ex.targetSets)) return;
    hapticImpact('light');
    let s = session;
    const newActual: Record<string, { weight: number; reps: number; rpe: number }> = {};
    ex.targetSets.forEach((t, si) => {
      const a = { weight: t.weight, reps: t.reps, rpe: Math.max(1, 10 - t.rir) };
      s = logSet(s, ei, { setNumber: si + 1, weightKg: a.weight, reps: a.reps, rpe: a.rpe, rir: t.rir, notes: '', plannedWeight: t.weight, plannedReps: t.reps, plannedRir: t.rir }).session;
      newActual[keyFor(ei, si)] = a;
    });
    setSession(s);
    setActual(prev => ({ ...prev, ...newActual }));
  }, [session, day]);

  // Fallback helpers when targetSets is missing (legacy cache)
  const weightFor = (ex: any) => ex?.targetSets?.[0]?.weight ?? ex?.weight ?? 60;
  const repsFor = (ex: any) => ex?.targetSets?.[0]?.reps ?? ex?.reps ?? 10;
  const rirFor = (ex: any) => ex?.targetSets?.[0]?.rir ?? ex?.rir ?? 2;

  // «Калькулятор блинов» → применить доступный вес к выбранному упражнению
  // (вес подставляется только в НЕзалогированные сеты; выполненные не трогаются)
  const applyPlateWeight = useCallback((w: number, exId?: string) => {
    if (!day || !Array.isArray(day.exercises)) return;
    const ei = exId != null && exId !== '' ? Number(exId) : NaN;
    if (!Number.isFinite(ei) || !day.exercises[ei]) return;
    const ex = day.exercises[ei];
    setActual(prev => {
      const next = { ...prev };
      (Array.isArray(ex.targetSets) ? ex.targetSets : []).forEach((t, si) => {
        const k = keyFor(ei, si);
        const existing = next[k];
        if (existing && existing.rpe > 0) return; // сет уже залогирован
        next[k] = { weight: w, reps: existing?.reps ?? t.reps, rpe: 0 };
      });
      return next;
    });
  }, [day]);

  // Плановые метрики дня
  const planned = useMemo(() => {
    if (!day) return { sets: 0, volume: 0 };
    let sets = 0, vol = 0;
    day.exercises.forEach(ex => ex.targetSets.forEach(t => { sets++; vol += t.weight * t.reps; }));
    return { sets, volume: Math.round(vol) };
  }, [day]);

  // Фактические метрики сессии
  const factVol = useMemo(() => {
    const src = session || done;
    if (!src) return { volume: 0, sets: 0 };
    let v = 0, n = 0;
    src.exercises.forEach(ex => ex.sets.forEach(s => { v += s.weightKg * s.reps; n++; }));
    return { volume: Math.round(v), sets: n };
  }, [session, done]);

  // 1.4: оценка e1RM (Epley) по лучшему сету сессии
  const topE1RM = useMemo(() => {
    const src = done || session;
    if (!src) return { e1rm: 0, exercise: '', weight: 0, reps: 0 };
    let best = { e1rm: 0, exercise: '', weight: 0, reps: 0 };
    src.exercises.forEach(ex => ex.sets.forEach(s => { if (s.weightKg > 0 && s.reps > 0) { const e = Math.round(s.weightKg * (1 + s.reps / 30)); if (e > best.e1rm) best = { e1rm: e, exercise: ex.exerciseName, weight: s.weightKg, reps: s.reps }; } }));
    return best;
  }, [done, session]);

  // 1.5: сравнение с предыдущей сессией
  const sessionComparison = useMemo(() => {
    if (!done) return null;
    try { return compareWithPrevious(done); } catch { return null; }
  }, [done]);

  // 1.6: per-exercise delta vs best (из кэша)
  const exerciseBestDeltas = useMemo(() => {
    if (!done || !day) return [];
    return day.exercises.map((ex, ei) => {
      const cached = getCachedProgressForExercise(ex.name);
      const sesEx = done.exercises[ei];
      if (!sesEx || !sesEx.sets.length || !cached) return null;
      const bestE1RM = Math.max(...sesEx.sets.map(s => Math.round(s.weightKg * (1 + s.reps / 30))));
      const delta = bestE1RM - cached.bestE1RM;
      return { name: ex.name, currentBest: bestE1RM, prevBest: cached.bestE1RM, delta, sessions: cached.sessions, trend: cached.trend };
    }).filter(Boolean) as { name: string; currentBest: number; prevBest: number; delta: number; sessions: number; trend: string }[];
  }, [done, day]);

  // 2.1/2.2: двойная прогрессия + рекомендация делода по завершённой сессии
  const nextSuggestions = useMemo(() => {
    if (!done || !day) return [];
    return day.exercises.map((ex, ei) => {
      const sesEx = done.exercises[ei];
      if (!sesEx || sesEx.sets.length === 0) return null;
      const target = ex.targetSets[0];
      if (!target) return null;
      const sets = sesEx.sets;
      const avgReps = sets.reduce((s: number, x: any) => s + x.reps, 0) / sets.length;
      const maxRPE = Math.max(0, ...sets.map((x: any) => x.rpe || 0));
      const inc = target.weight >= 40 ? 2.5 : 1;
      const hitTarget = avgReps >= target.reps;
      let nextWeight = target.weight, nextReps = target.reps, note = '', deload = false;
      if (hitTarget) { nextWeight = target.weight + inc; note = `Прогрессия: +${inc}кг (цель ${target.reps}повт достигнута${maxRPE <= 8 ? ' при RPE≤8' : ''})`; }
      else if (avgReps < target.reps - 1) { note = `Удержать ${target.weight}кг — добрать повторы до ${target.reps}`; }
      else { note = 'Почти в цель — повторить вес, добавить 1 повтор'; nextReps = target.reps; }
      if (maxRPE >= 9 && sets.length >= 3) { deload = true; note = note + ' · высокий RPE — рассмотреть делод (−15-20% объём)'; }
      return { name: ex.name, nextWeight, nextReps, note, deload };
    }).filter(Boolean) as { name: string; nextWeight: number; nextReps: number; note: string; deload: boolean }[];
  }, [done, day]);

  const anyDeload = nextSuggestions.some(s => s.deload);

  // RIR-калибровка: фидбек по сессии
  const rirFeedback = useMemo(() => {
    if (!done || !day) return null;
    try { return getSessionRIRFeedback(done, { exercises: day.exercises.map(ex => ({ name: ex.name, targetSets: ex.targetSets })) }); } catch { return null; }
  }, [done, day]);

  // Метрики фактической сессии (Тоннаж/КПШ/Инт.отн/УОИ/Инт.Ф+Б) — считаются для done-состояния
  const lms = useMemo(() => computeSessionMetrics(done, day), [done, day]);

  if (days.length === 0) return <div style={SMALL}>Нет дней в плане.</div>;

  // ── Степпер фаз: безопасные переходы между этапами сессии ──
  const PHASES: { id: typeof phase; icon: string; label: string }[] = [
    { id: 'ready', icon: '▶️', label: 'Готов' },
    { id: 'warmup', icon: '🤸', label: 'Разминка' },
    { id: 'main', icon: '🏋️', label: 'Основная' },
    { id: 'cooldown', icon: '🧘', label: 'Заминка' },
    { id: 'done', icon: '✅', label: 'Итог' },
  ];
  const goPhase = (p: typeof phase) => {
    if (p === phase) return;
    if (p === 'ready') { if (!session) setPhase('ready'); return; }
    if (p === 'warmup') { if (warmupBlocks.length === 0) begin(); else setPhase('warmup'); return; }
    if (p === 'main') { if (phase === 'warmup') startMain(); else if (phase === 'main') { /* уже там */ } return; }
    if (p === 'cooldown') { if (session) finish(); else setPhase('cooldown'); return; }
    if (p === 'done') { exitSession(); return; }
  };

  return (
    <div>
      <style>{timerAnimationStyle}</style>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {days.map((d, i) => (
          <button key={i} disabled={phase !== 'ready' && phase !== 'done'}
            title={phase !== 'ready' && phase !== 'done' ? 'Завершите текущую тренировку, чтобы сменить день' : undefined}
            style={{ ...(i === dayIdx ? BTN : BTN_GHOST), opacity: phase !== 'ready' && phase !== 'done' && i !== dayIdx ? 0.35 : 1, cursor: phase !== 'ready' && phase !== 'done' && i !== dayIdx ? 'not-allowed' : 'pointer' }}
            onClick={() => setDayIdx(i)}>{d.label}</button>
        ))}
      </div>

      {/* Степпер фаз сессии */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }} role="tablist" aria-label="Фазы сессии">
        {PHASES.map((p, i) => {
          const cur = PHASES.findIndex(x => x.id === phase);
          const active = p.id === phase;
          const doneStep = i < cur;
          return (
            <button key={p.id} type="button" role="tab" aria-selected={active} aria-label={p.label}
              onClick={() => goPhase(p.id)}
              style={{
                flex: 1, minWidth: 56, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                background: active ? 'rgba(0,230,138,0.14)' : doneStep ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                color: active ? 'var(--accent)' : doneStep ? '#22c55e' : '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
              <span style={{ fontSize: 13 }}>{doneStep && !active ? '✓' : p.icon}</span>
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {phase === 'ready' && (
        <div style={{ marginTop: 8 }}>
          <button style={{ ...BTN, width: '100%' }} onClick={begin}>▶ Начать тренировку — {day.label} (нед {weekNumber})</button>
          {/* оценка длительности */}
          {day && Array.isArray(day.exercises) && day.exercises.length > 0 && (() => {
            const totalSets = day.exercises.reduce((s, ex) => s + ex.targetSets.length, 0);
            const avgRest = day.exercises.reduce((s, ex) => s + (ex.restSec || 90), 0) / day.exercises.length;
            const estMin = Math.round((totalSets * (45 + avgRest) + 300) / 60); // 45с на подход + отдых + 5 мин разминка
            return (
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: '#fff' }}>
                  📋 {day.exercises.length} упр. · {totalSets} сетов · ~{estMin} мин
                </span>
                {last && last.durationMin > 0 && (
                  <span style={{ fontSize: 10, color: estMin > last.durationMin ? '#f59e0b' : '#22c55e' }}>
                    (прошлая: {last.durationMin} мин)
                  </span>
                )}
              </div>
            );
          })()}
          {last && (
            <div style={{ ...CARD, marginTop: 8 }}>
              <div style={LABEL}>⏱ Последняя сессия</div>
              <div style={SMALL}>{last.date} {last.startTime}–{last.endTime} · {last.focus} · {last.exercises.length} упр.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 6 }}>
                <div style={{ padding: 4, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 9, color: '#fff' }}>Тоннаж</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{last.totalVolume.toLocaleString()} кг</div>
                </div>
                <div style={{ padding: 4, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 9, color: '#fff' }}>Подходы</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{last.totalSets}</div>
                </div>
                <div style={{ padding: 4, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 9, color: '#fff' }}>Длительность</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{last.durationMin} мин</div>
                </div>
              </div>
              {planned.volume > 0 && last.totalVolume > 0 && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#fff' }}>
                  План сегодня: {planned.volume.toLocaleString()} кг · {planned.sets} сетов
                  {last.totalVolume > 0 && (
                    <span style={{ color: planned.volume > last.totalVolume ? '#f59e0b' : '#22c55e', marginLeft: 4 }}>
                      ({planned.volume > last.totalVolume ? '+' : ''}{Math.round((planned.volume - last.totalVolume) / last.totalVolume * 100)}% к прошлой)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Детали дня: полный список упражнений (сеты/вес/RIR/отдых) ── */}
          {day && Array.isArray(day.exercises) && day.exercises.length > 0 && (() => {
            const totalSets = day.exercises.reduce((s, ex) => s + ex.targetSets.length, 0);
            const tonnage = day.exercises.reduce((s, ex) => s + ex.targetSets.reduce((ss, st) => ss + (st.weight || 0) * (st.reps || 0), 0), 0);
            const avgRest = Math.round(day.exercises.reduce((s, ex) => s + (ex.restSec || 90), 0) / day.exercises.length);
            return (
              <div style={{ ...CARD, marginTop: 8 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setDayDetailsOpen(v => !v)}
                  role="button"
                  aria-expanded={dayDetailsOpen}
                  aria-label={`Детали дня ${day.label}`}
                >
                  <div style={LABEL}>📋 Детали дня — {day.exercises.length} упр. · {totalSets} сетов · {tonnage.toLocaleString()} кг · ~{avgRest}с отдых</div>
                  <span style={{ color: '#fff', fontSize: 11 }}>{dayDetailsOpen ? '▲' : '▼'}</span>
                </div>
                {dayDetailsOpen && (
                  <div style={{ marginTop: 2 }}>
                    {day.exercises.map((ex, ei) => {
                      const setsStr = ex.targetSets.map((s, si) => (si === 0 ? '' : si === ex.targetSets.length - 1 ? ' × ' : ' · ') + `${s.reps}`).join('');
                      const firstW = ex.targetSets[0]?.weight;
                      const rirStr = ex.targetSets[0]?.rir;
                      const plates = firstW ? formatPlates(firstW) : '';
                      return (
                        <div key={ei} style={{ ...ROW, gap: 8, alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                              {ex.name}
                              {(() => {
                                const t = ex.targetSets[ex.targetSets.length - 1]?.technique;
                                const lbl = techniqueLabel(t);
                                return lbl ? (
                                  <span style={{ fontSize: 9, marginLeft: 6, color: '#f87171', fontWeight: 700 }} title={techniqueChainParts({ workSets: ex.targetSets.map(s => ({ reps: s.reps, weight: s.weight, rir: s.rir, technique: s.technique })) })?.parts.join(' → ') || lbl}>💥 {lbl}</span>
                                ) : null;
                              })()}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>
                              {ex.muscleGroup || ex.group || ''}{plates ? ` · ${plates}` : ''}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: ACCENT, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {ex.targetSets.length}×{setsStr}
                          </div>
                          <div style={{ fontSize: 10, color: '#fff', whiteSpace: 'nowrap' }}>
                            {firstW ? `${firstW} кг` : 'вес тела'}
                          </div>
                          <div style={{ fontSize: 10, color: '#fff', whiteSpace: 'nowrap' }}>
                            RIR {rirStr ?? '—'}
                          </div>
                          <div style={{ fontSize: 10, color: '#fff', whiteSpace: 'nowrap' }}>
                            ~{ex.restSec || 90}с
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Психология: протокол дня (до начала тренировки) */}
          <MindsetPreSessionCard focus={focus} dayLabel={day.label} />

          {/* Мобильность: ежедневная рутина + подготовка зон (до разминки) */}
          <MobilitySessionPanel />
        </div>
      )}

      {phase === 'warmup' && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* ── Красивая шапка разминки ── */}
          {(() => {
            const total = warmupBlocks.reduce((s, b) => s + b.exercises.length, 0);
            const done = Object.values(warmupDone).filter(Boolean).length;
            const pct = total > 0 ? Math.round(done / total * 100) : 0;
            const totalSec = warmupBlocks.reduce((s, b) => s + (b.durationSec || 0), 0);
            const mins = totalSec > 0 ? Math.round(totalSec / 60 * 10) / 10 : 0;
            const isDone = pct === 100;
            return (
              <div style={{
                position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '14px 14px 12px',
                background: isDone
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.16), rgba(16,185,129,0.08))'
                  : 'linear-gradient(135deg, rgba(249,115,22,0.14), rgba(251,146,60,0.07), rgba(167,139,250,0.07))',
                border: `1px solid ${isDone ? 'rgba(34,197,94,0.28)' : 'rgba(249,115,22,0.22)'}`,
                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                boxShadow: isDone ? '0 4px 20px rgba(34,197,94,0.18)' : '0 4px 20px rgba(249,115,22,0.12)',
              }}>
                <div style={{ position: 'absolute', top: -18, right: -18, width: 96, height: 96, borderRadius: 96, background: `radial-gradient(circle, ${isDone ? 'rgba(34,197,94,0.18)' : 'rgba(249,115,22,0.16)'}, transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, position: 'relative' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isDone ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#f97316,#ea580c)',
                        color: '#fff', fontSize: 16, fontWeight: 800, boxShadow: '0 2px 10px rgba(0,0,0,0.18)', flexShrink: 0,
                      }}>{isDone ? '✓' : '🔥'}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1 }}>Разминка · {day.label}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', marginTop: 1, lineHeight: 1.2 }}>
                          {warmupBlocks.length} блока · {total} пунктов · {mins} мин · группы дня учтены
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: isDone ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.07)', color: isDone ? '#22c55e' : '#fff', border: `1px solid ${isDone ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                        {done}/{total} пунктов
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: isDone ? '#22c55e' : 'linear-gradient(135deg,#f97316,#ea580c)', color: isDone ? '#000' : '#fff' }}>
                        {pct}%
                      </span>
                      <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.78)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        ⏱ ~{mins} мин
                      </span>
                      {warmupBlocks.some(b => b.notes?.includes('грудь') || b.notes?.includes('спина') || b.notes?.includes('ягодиц')) && (
                        <span style={{ fontSize: 8, padding: '3px 7px', borderRadius: 20, background: 'rgba(167,139,250,0.12)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.22)' }}>
                          🎯 по группам дня
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ width: 56, height: 56, borderRadius: 28, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 4, borderRadius: 24, background: `conic-gradient(${isDone ? '#22c55e' : '#f97316'} ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)`, mask: 'radial-gradient(circle 18px at center, transparent 18px, black 19px)', WebkitMask: 'radial-gradient(circle 18px at center, transparent 18px, black 19px)' }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: isDone ? '#22c55e' : '#fff' }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 10 }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: isDone ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#f97316,#fb923c)', transition: 'width 0.4s ease', boxShadow: isDone ? '0 0 8px rgba(34,197,94,0.45)' : '0 0 8px rgba(249,115,22,0.35)' }} />
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {(['quick','standard','full'] as WarmupMode[]).map(modeOpt => {
                    const active = warmupMode === modeOpt;
                    const cfg = modeOpt === 'quick' ? { label: '⚡ Быстро', sub: '5 мин', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)' } : modeOpt === 'standard' ? { label: '⚖️ Стандарт', sub: '9 мин', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.28)' } : { label: '🎯 Полная', sub: '14 мин', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.28)' };
                    return (
                      <button key={modeOpt} onClick={() => {
                        setWarmupMode(modeOpt);
                        try { localStorage.setItem('he_warmup_mode', modeOpt); } catch {}
                        if (phase !== 'warmup' || !day || !Array.isArray(day.exercises)) return;
                        const riskFlags2: Record<string,string> = {};
                        if (profile.injuries?.length) {
                          profile.injuries.forEach(inj => {
                            const mm = inj.muscle?.toLowerCase() || '';
                            if (mm.includes('колен') || mm.includes('knee')) riskFlags2['knee'] = 'high';
                            if (mm.includes('плеч') || mm.includes('shoulder')) riskFlags2['shoulder'] = 'high';
                            if (mm.includes('спин') || mm.includes('поясн') || mm.includes('back') || mm.includes('lumbar')) riskFlags2['back'] = 'high';
                          });
                        }
                        const techniqueIssues2: string[] = profile.weakPoints?.length
                          ? profile.weakPoints.map(w => {
                              const wp = String(w).toLowerCase();
                              if (wp.includes('back') || wp.includes('поясн') || wp === 'core') return 'rounding_back';
                              if (wp.includes('knee') || wp.includes('колен')) return 'knee_valgus';
                              if (wp.includes('shoulder') || wp.includes('плеч')) return 'tight_shoulders';
                              if (wp.includes('hip') || wp.includes('бёдр') || wp.includes('таз')) return 'tight_hips';
                              if (wp.includes('ankle') || wp.includes('голеност')) return 'tight_ankles';
                              if (wp.includes('chest') || wp.includes('груд')) return 'tight_chest';
                              return '';
                            }).filter(Boolean)
                          : [];
                        const inp: WarmupInput = {
                          sessionFocus: focus,
                          primaryExercises: day.exercises.map(ex => ex.name),
                          primaryWeights: day.exercises.map(ex => (Array.isArray(ex.targetSets) && ex.targetSets[0]?.weight ? Number(ex.targetSets[0].weight) : null) as any),
                          riskFlags: riskFlags2,
                          techniqueIssues: techniqueIssues2,
                          fatigueLevel: profile.fatigue / 10,
                          equipmentAvailable: profile.equipment,
                          targetGroups: Array.from(new Set(day.exercises.map(ex => ex.muscleGroup || '').filter(Boolean))),
                          mode: modeOpt,
                        };
                        setWarmupBlocks(generateWarmup(inp));
                        setWarmupDone({});
                        setWarmupTimer(null);
                      }} style={{
                        flex: 1, minWidth: 72, padding: '5px 6px', borderRadius: 9, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                        background: active ? cfg.bg : 'rgba(255,255,255,0.04)', color: active ? cfg.color : 'rgba(255,255,255,0.60)',
                        border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.08)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                      }}>
                        <span>{cfg.label}</span><span style={{ fontSize: 8, opacity: 0.85 }}>{cfg.sub}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.3 }}>
                  Отмечайте пункты по ходу · разминка пишется в дневник при переходе к основной части · {isDone ? 'отлично — все пункты отмечены!' : 'минимум: 50% для хорошей готовности'}
                </div>
              </div>
            );
          })()}

          {/* ── Блоки разминки — красивые карточки ── */}
          {warmupBlocks.map((b, i) => {
            const meta = b.type === 'general'
              ? { icon: '🏃', title: 'Общая разминка', color: '#06b6d4', bg: 'rgba(6,182,214,0.07)', border: 'rgba(6,182,214,0.24)', desc: 'Пульс + кровоток' }
              : b.type === 'mobility'
                ? { icon: '🤸', title: 'Суставы + зоны', color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.24)', desc: 'Подвижность целевых суставов и мышц' }
                : b.type === 'activation'
                  ? { icon: '⚡', title: 'Активация', color: '#22c55e', bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.24)', desc: 'Включение каждой рабочей группы' }
                  : { icon: '🏋️', title: 'Подводящие подходы', color: '#a78bfa', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.24)', desc: 'К рабочим весам · техника' };
            const total = b.exercises.length;
            const done = b.exercises.filter((_, j) => warmupDone[`w_${i}_${j}`]).length;
            const pct = total > 0 ? Math.round(done / total * 100) : 0;
            const allDone = done === total && total > 0;
            return (
              <div key={i} style={{
                position: 'relative', overflow: 'hidden', borderRadius: 14, padding: '10px 10px 8px',
                background: allDone ? 'rgba(34,197,94,0.06)' : 'var(--glass-bg)',
                border: `1px solid ${allDone ? 'rgba(34,197,94,0.22)' : meta.border}`,
                borderLeft: `3px solid ${allDone ? '#22c55e' : meta.color}`,
                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                boxShadow: allDone ? '0 2px 14px rgba(34,197,94,0.10)' : '0 2px 14px rgba(0,0,0,0.14)',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${meta.color}, transparent)`, opacity: allDone ? 0.9 : 0.65 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: allDone ? 'linear-gradient(135deg,#22c55e,#16a34a)' : `linear-gradient(135deg, ${meta.color}, ${meta.color}CC)`,
                      color: '#fff', fontSize: 14, flexShrink: 0, boxShadow: `0 2px 8px ${meta.color}33`,
                    }}>{allDone ? '✓' : meta.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: allDone ? '#22c55e' : meta.color, lineHeight: 1 }}>{meta.title}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.58)', lineHeight: 1.2 }}>{meta.desc} · {b.durationSec}с</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: allDone ? 'rgba(34,197,94,0.14)' : meta.bg, color: allDone ? '#22c55e' : meta.color, border: `1px solid ${allDone ? 'rgba(34,197,94,0.28)' : meta.border}` }}>
                      ⏱ {b.durationSec}с
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 20, background: allDone ? '#22c55e' : 'rgba(255,255,255,0.06)', color: allDone ? '#000' : '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {done}/{total}
                    </span>
                  </div>
                </div>
                {b.notes && (
                  <div style={{
                    fontSize: 9, color: 'rgba(255,255,255,0.72)', lineHeight: 1.35, marginBottom: 7, padding: '5px 8px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <span style={{ color: meta.color, fontWeight: 700 }}>ℹ </span>{b.notes}
                  </div>
                )}
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 7 }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: allDone ? '#22c55e' : meta.color, transition: 'width 0.3s ease' }} />
                </div>
                <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {b.exercises.map((ex, j) => {
                    const isDone = warmupDone[`w_${i}_${j}`];
                    const isSpecific = 'intensityPct' in ex && (ex as any).intensityPct;
                    return (
                      <li key={j} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 8px', borderRadius: 10,
                        background: isDone ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.035)',
                        border: `1px solid ${isDone ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)'}`,
                        opacity: isDone ? 0.85 : 1, transition: 'all 0.2s',
                      }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, flex: 1, cursor: 'pointer', minWidth: 0 }}>
                          <input type="checkbox" checked={isDone} onChange={() => toggleWarmup(i, j)}
                            style={{ marginTop: 2, width: 16, height: 16, accentColor: isDone ? '#22c55e' : meta.color, cursor: 'pointer', flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, color: isDone ? 'rgba(255,255,255,0.55)' : '#fff',
                              textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.3, display: 'block',
                            }}>
                              {isSpecific ? warmupSpecificLabel(ex.exerciseId) : warmupLabel(ex.exerciseId)}
                            </span>
                            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 3 }}>
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
                                background: isDone ? 'rgba(255,255,255,0.06)' : meta.bg, color: isDone ? 'rgba(255,255,255,0.5)' : meta.color,
                                border: `1px solid ${isDone ? 'rgba(255,255,255,0.08)' : meta.border}`,
                              }}>
                                {isSpecific ? `${(ex as any).intensityPct}% · ${ex.sets}×${ex.reps}` : `${ex.sets}×${ex.reps}`}
                              </span>
                              {'note' in ex && (ex as any).note && (
                                <span style={{ fontSize: 9, color: isDone ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.62)', wordBreak: 'break-word' }}>
                                  {(ex as any).note}
                                </span>
                              )}
                            </span>
                          </span>
                        </label>
                        {(() => {
                          if (isDone) return null;
                          const isActive = warmupTimer && warmupTimer.i === i && warmupTimer.j === j;
                          if (isActive) {
                            return <span style={{ minWidth: 44, padding: '3px 6px', borderRadius: 8, background: 'rgba(6,182,214,0.14)', color: '#06b6d4', border: '1px solid rgba(6,182,214,0.28)', fontSize: 10, fontWeight: 800, textAlign: 'center', flexShrink: 0, marginTop: 1 }}>{warmupTimer!.remaining}с</span>;
                          }
                          return <button type="button" disabled={isDone} onClick={() => setWarmupTimer({ i, j, remaining: 30, total: 30 })} style={{ padding: '3px 7px', borderRadius: 8, fontSize: 9, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', flexShrink: 0, marginTop: 1 }} aria-label="Таймер 30с">⏱ 30с</button>;
                        })()}
                        <span style={{
                          width: 22, height: 22, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                          background: isDone ? '#22c55e' : 'rgba(255,255,255,0.06)', color: isDone ? '#000' : 'rgba(255,255,255,0.35)',
                          border: `1px solid ${isDone ? '#22c55e' : 'rgba(255,255,255,0.08)'}`, fontSize: 10, fontWeight: 800,
                        }}>{isDone ? '✓' : '○'}</span>
                      </li>
                    );
                  })}
                </ul>
                {total > 1 && (
                  <button type="button" onClick={() => {
                    const all = b.exercises.every((_, j) => warmupDone[`w_${i}_${j}`]);
                    const next: Record<string, boolean> = { ...warmupDone };
                    b.exercises.forEach((_, j) => { next[`w_${i}_${j}`] = !all; });
                    setWarmupDone(next);
                  }} style={{
                    marginTop: 7, width: '100%', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                    background: done === total ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)', color: done === total ? '#22c55e' : 'rgba(255,255,255,0.65)',
                    border: `1px solid ${done === total ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                    {done === total ? '↩ Сбросить блок' : `✓ Отметить весь блок (${total})`}
                  </button>
                )}
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            <button style={{ ...BTN, flex: 1, background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', boxShadow: '0 4px 16px rgba(249,115,22,0.28)' }} onClick={startMain}>
              🚀 К основной части
            </button>
            <button type="button" onClick={() => {
              const next: Record<string, boolean> = {};
              warmupBlocks.forEach((b, i) => b.exercises.forEach((_, j) => { next[`w_${i}_${j}`] = true; }));
              setWarmupDone(next);
            }} style={{
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
              background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.22)',
            }}>
              ✓ Всё готово
            </button>
          </div>
          <SkipBar reasons={WARMUP_SKIP_REASONS} label="разминку" onSkip={reason => { skipWarmupReasonRef.current = reason; startMain(); }} />
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', textAlign: 'center', lineHeight: 1.3, marginTop: 2 }}>
            Активация подбирается под группы дня — каждая рабочая мышца получает мобильность и «включение» · без ленты — bodyweight-замены уже включены · подводящие — с весом в подсказке (~кг)
          </div>
        </div>
      )}

       {phase === 'main' && session && (
         <div style={CARD}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={H}>🏃 {day.label}</div>
             <button style={BTN} onClick={finish}>⏹ Завершить</button>
           </div>
           
           {/* таймер сессии */}
           <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
             <span style={{ fontSize: 10, color: '#fff' }}>Время сессии:</span>
             <span style={{ fontSize: 14, fontWeight: 600, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>
               {String(Math.floor(sessionTimerSec / 60)).padStart(2, '0')}:{String(sessionTimerSec % 60).padStart(2, '0')}
             </span>
             <button onClick={() => { setSessionTimerRunning(!sessionTimerRunning); if (!sessionTimerRunning) setSessionTimerSec(0); }} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: sessionTimerRunning ? 'rgba(239,68,68,0.12)' : 'rgba(0,230,138,0.12)', color: sessionTimerRunning ? '#ef4444' : '#00e68a' }}>
               {sessionTimerRunning ? '⏸ Пауза' : '▶ Старт'}
             </button>
           </div>

           {/* общий прогресс сессии — «цифра дня» */}
           {(() => {
             if (!day || !Array.isArray(day.exercises)) return null;
             const totalSets = day.exercises.reduce((s, ex) => s + ex.targetSets.length, 0);
             const doneSets = day.exercises.reduce((s, ex, ei) => s + ex.targetSets.filter((_, si) => !!actual[keyFor(ei, si)]).length, 0);
             const pct = totalSets > 0 ? Math.round(doneSets / totalSets * 100) : 0;
             const doneVol = day.exercises.reduce((s, ex, ei) => s + ex.targetSets.reduce((ss, t, si) => ss + (actual[keyFor(ei, si)] ? t.weight * t.reps : 0), 0), 0);
             return (
               <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.05)', border: '1px solid rgba(0,230,138,0.15)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                   <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                     <span style={{ fontSize: 26, fontWeight: 800, color: pct === 100 ? '#22c55e' : ACCENT, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                     <span style={{ fontSize: 11, color: '#fff' }}>{doneSets}/{totalSets} подходов</span>
                   </div>
                   <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#fff' }}>
                     <span>⚡ {doneVol.toLocaleString()} / {planned.volume.toLocaleString()} кг</span>
                     <span>⏱ <b style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{String(Math.floor(sessionTimerSec / 60)).padStart(2, '0')}:{String(sessionTimerSec % 60).padStart(2, '0')}</b></span>
                   </div>
                 </div>
                 <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 6 }}>
                   <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: pct === 100 ? '#22c55e' : 'var(--accent)', transition: 'width 0.3s ease' }} />
                 </div>
               </div>
             );
           })()}

           {/* режимы суперсета и круга */}
           <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
             <span style={{ fontSize: 9, color: '#fff', alignSelf: 'center' }}>Режим:</span>
             <button onClick={toggleSupersetMode} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: supersetMode?'1px solid #f59e0b':'1px solid rgba(255,255,255,0.08)', background: supersetMode?'rgba(245,158,11,0.12)':'rgba(255,255,255,0.04)', color: supersetMode?'#f59e0b':'#fff' }}>
               🔄 Суперсет
             </button>
             <button onClick={toggleCircuitMode} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: circuitMode?'1px solid #8b5cf6':'1px solid rgba(255,255,255,0.08)', background: circuitMode?'rgba(139,92,246,0.12)':'rgba(255,255,255,0.04)', color: circuitMode?'#8b5cf6':'#fff' }}>
               ⭕ Круг
             </button>
             <button onClick={() => setPlateOpen(v => !v)} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: plateOpen?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background: plateOpen?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.04)', color: plateOpen?'#00e68a':'#fff' }}>
               🧮 Блины
             </button>
             {(supersetMode || circuitMode) && (
               <span style={{ fontSize: 9, color: '#fff', alignSelf: 'center' }}>
                 {supersetMode ? 'Выберите 2+ упражнения' : 'Минимальный отдых между упражнениями'}
               </span>
             )}
            </div>

           {/* подсказки горячих клавиш */}
           <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
             {[
               { key: 'Space', label: 'залогировать подход' },
               { key: 'R', label: 'таймер отдыха' },
             ].map(h => (
               <span key={h.key} style={{ fontSize: 8, color: 'var(--text-faint)' }}>
                 <kbd style={{ padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 8, fontFamily: 'monospace' }}>{h.key}</kbd> {h.label}
               </span>
             ))}
           </div>

           <div style={{ ...SMALL, marginBottom: 6 }}>План: {planned.sets} сетов / {planned.volume} кг·пов · Факт: {factVol.sets} сетов / {factVol.volume} кг·пов</div>
          {/* P12: sRPE для мониторинга нагрузки (сохранится при завершении) */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#fff' }}>sRPE сессии:</span>
            {[6,7,8,9,10].map(r => <button key={r} onClick={() => setSessionRPE(r)} style={{ padding: '3px 9px', borderRadius: 6, fontSize: 10, cursor: 'pointer', border: sessionRPE===r?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background: sessionRPE===r?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.04)', color: sessionRPE===r?'#00e68a':'#fff' }}>{r}</button>)}
            <span style={{ fontSize: 10, color: '#fff' }}>· длительность, мин:</span>
            <input style={{ ...IN, width: 64 }} type="number" value={sessionDur} onChange={e => setSessionDur(+e.target.value)} aria-label="длительность мин" />
          </div>
          {/* 🧮 Калькулятор блинов: подкладка с выбором упражнения текущей сессии */}
          {plateOpen && (
            <div style={{ ...CARD, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>🧮 Калькулятор блинов</div>
                <button onClick={() => setPlateOpen(false)} style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 11, minHeight: 28 }} aria-label="Закрыть калькулятор блинов">✕</button>
              </div>
              <PlateCalcTab
                exerciseOptions={day.exercises.map((ex, ei) => ({ id: String(ei), label: ex.name, weight: ex.targetSets[0]?.weight || 0 }))}
                onApply={applyPlateWeight}
                applyLabel="✅ Применить к упражнению"
              />
            </div>
          )}
          {day.exercises.map((ex, ei) => (
               <div key={ei} style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.04)', 
                 background: supersetExercises.includes(ei) ? (supersetMode ? 'rgba(245,158,11,0.05)' : 'rgba(139,92,246,0.05)') : 'transparent',
                 borderRadius: supersetExercises.includes(ei) ? 8 : 0,
                 paddingLeft: supersetExercises.includes(ei) ? 8 : 0,
                 paddingRight: supersetExercises.includes(ei) ? 8 : 0,
               }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                   {(supersetMode || circuitMode) && (
                     <input type="checkbox" checked={supersetExercises.includes(ei)} onChange={() => toggleExerciseInSuperset(ei)} 
                       style={{ cursor: 'pointer', width: 16, height: 16 }} />
                   )}
                   <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, flex: 1 }}>
                     {ex.name} <span style={{ color: '#fff', fontWeight: 400 }}>({ex.muscleGroup})</span>
                     {(() => {
                       const t = ex.targetSets[ex.targetSets.length - 1]?.technique;
                       const lbl = techniqueLabel(t);
                       return lbl ? (
                         <span style={{ fontSize: 9, marginLeft: 6, color: '#f87171', fontWeight: 700 }} title="Техника на последнем подходе">💥 {lbl}</span>
                       ) : null;
                     })()}
                     {supersetExercises.includes(ei) && (
                       <span style={{ fontSize: 9, marginLeft: 6, color: supersetMode ? '#f59e0b' : '#8b5cf6' }}>
                         {supersetMode ? '🔄 Суперсет' : '⭕ Круг'}
                       </span>
                     )}
                     {(() => { const isCompound = ['chest','back','quads','hamstrings','shoulders','legs'].includes(ex.muscleGroup?.toLowerCase() || ''); const t = TEMPO_PRESETS[recommendTempo('hypertrophy', isCompound ? 'compound' : 'isolation')]; return <span style={{ fontSize:9, color:'var(--text-faint)', marginLeft:6 }} title={t?.nameRu}>⏱ {formatTempo(t?.tempo)}</span>; })()}
                   </div>
                 </div>
                 
                  {/* индикатор прогресса упражнения */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
                    {ex.targetSets.map((_, si) => (
                      <div key={si} style={{ 
                        width: 24, height: 8, borderRadius: 4,
                        background: actual[keyFor(ei, si)] ? '#00e68a' : 'rgba(255,255,255,0.1)',
                        transition: 'background 0.3s ease'
                      }} />
                    ))}
                     <span style={{ fontSize: 9, color: '#fff', marginLeft: 4 }}>
                       {Object.keys(actual).filter(k => k.startsWith(`${ei}_`)).length}/{ex.targetSets.length}
                     </span>
                    </div>
                   <MindsetApproachHint focus={focus} exerciseStarted={Object.keys(actual).some(k => k.startsWith(`${ei}_`))} />
                 {ex.targetSets.map((t, si) => {
                 const k = keyFor(ei, si);
                 const a = actual[k] || { weight: t.weight, reps: t.reps, rpe: 0 };
                 const logged = !!actual[k];
                 const targetRPE = 10 - t.rir;
                 const dW = a.weight - t.weight;
                 const dR = a.reps - t.reps;
                 const rpeDelta = a.rpe > 0 ? a.rpe - targetRPE : 0;
                 const nextW = a.rpe > 0 ? (rpeDelta > 0 ? Math.max(0, a.weight - 2.5) : rpeDelta < -1 ? a.weight + 2.5 : a.weight) : a.weight;
                 const nextR = a.rpe > 0 ? (rpeDelta > 1 ? Math.max(1, a.reps - 1) : a.reps) : a.reps;
                 return (
                   <div key={si} style={{ ...ROW, flexWrap: 'wrap', gap: 6 }}>
                     <span style={{ color: '#fff', fontSize: 11, width: 52 }}>Сет {si + 1}</span>
                     <span style={{ color: '#fff', fontSize: 11, width: 90 }}>цель {t.weight}кг×{t.reps}@RIR{t.rir}</span>
                     {t.technique && (
                       <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }} title={techniqueChainParts({ workSets: [{ reps: t.reps, weight: t.weight, rir: t.rir, technique: t.technique }] })?.parts.join(' → ') || ''}>💥 {techniqueLabel(t.technique)}</span>
                     )}
                     {t.weight > 0 && (
                       <span style={{ fontSize: 9, color: 'var(--text-faint)', width: '100%', paddingLeft: 52 }}>
                         🏋️ {formatPlates(t.weight)}
                       </span>
                     )}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input style={{ ...IN, width: 60 }} type="number" value={a.weight} onChange={e => setActual(p => ({ ...p, [k]: { weight: +e.target.value, reps: a.reps, rpe: a.rpe } }))} aria-label="вес" />
                        <input style={{ ...IN, width: 48 }} type="number" value={a.reps} onChange={e => setActual(p => ({ ...p, [k]: { weight: a.weight, reps: +e.target.value, rpe: a.rpe } }))} aria-label="повт" />
                         <input style={{ ...IN, width: 44 }} type="number" min={0} max={10} placeholder="RPE" value={a.rpe || ""} onChange={e => { const v = +e.target.value; setActual(p => ({ ...p, [k]: { weight: a.weight, reps: a.reps, rpe: Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0 } })) }} aria-label="RPE" />
                        <input style={{ ...IN, width: 48 }} type="number" step="0.01" placeholder="v" value={vel[k] ?? ""} onChange={e => setVel(p => ({ ...p, [k]: +e.target.value }))} aria-label="скорость м/с" />
                        <button style={logged ? BTN_GHOST : BTN} onClick={() => logOne(ei, si)}>{logged ? '✓' : 'OK'}</button>
                        {!logged && (
                          <button style={{ ...BTN_GHOST, fontSize: 10, padding: '4px 8px' }} onClick={() => {
                            setActual(p => ({ ...p, [k]: { weight: t.weight, reps: t.reps, rpe: Math.max(1, 10 - t.rir) } }));
                            logOne(ei, si);
                          }}>Быстро</button>
                        )}
                      </div>
                      {/* кнопка пропуска упражнения */}
                      {(() => {
                        const allLogged = ex.targetSets.every((_, si) => !!actual[keyFor(ei, si)]);
                        if (allLogged || ex.targetSets.length === 0) return null;
                        return (
                          <button style={{ width: '100%', marginTop: 4, padding: '4px 0', borderRadius: 6, border: '1px dashed rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-faint)', fontSize: 10, cursor: 'pointer' }} onClick={() => skipExercise(ei)}>
                            ⏭ Пропустить упражнение (залогировать планом)
                          </button>
                        );
                      })()}
                       {logged && (
                         <div style={{ width: '100%', fontSize: 10, color: '#fff', paddingLeft: 56, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                           <span style={{ color: '#fff' }}>🏋️ {formatPlates(a.weight)}</span>
                           <span>факт <b style={{ color: '#fff' }}>{a.weight}кг×{a.reps}</b>{a.rpe > 0 ? `@RPE${a.rpe}` : ''}</span>
                           <span style={{ color: dW === 0 ? '#fff' : dW > 0 ? '#22c55e' : '#f59e0b' }}>Δвес {dW > 0 ? '+' : ''}{dW}</span>
                           <span style={{ color: dR === 0 ? '#fff' : dR > 0 ? '#22c55e' : '#f59e0b' }}>Δповт {dR > 0 ? '+' : ''}{dR}</span>
                           {a.rpe > 0 && <span style={{ color: rpeDelta > 0 ? '#ef4444' : rpeDelta < -1 ? '#22c55e' : '#fff' }}>RPE vs цели({targetRPE}): {rpeDelta > 0 ? '+' : ''}{rpeDelta}</span>}
                           {a.rpe > 0 && (rpeDelta > 0 || rpeDelta < -1) && (
                             <span style={{ color: ACCENT, fontWeight: 700 }}>→ след. сет: {nextW}кг×{nextR}{rpeDelta > 0 ? ' (легче)' : ' (тяжелее)'}</span>
                           )}
                           {/* MMC-трекинг */}
                           <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', cursor: 'pointer', userSelect:'none', borderBottom:'1px dashed rgba(255,255,255,0.15)' }} onClick={() => setMMCOpen(mmco === k ? '' : k)}>
                             {mmco === k ? '🔼 скрыть MMC' : '🔽 MMC/Пампинг/Суставы'}
                           </span>
                           {mmco === k && <div style={{ width: '100%', display: 'flex', gap: 8, padding: '4px 0' }}>
                             {([['mmc','🧠 MMC',7],['pump','💪 Пампинг',6],['joint','🦵 Суставы',0],['energy','⚡ Энергия',7]] as any[]).map((item: any[]) => {
                               const f = item[0]; const label = item[1]; const def = item[2];
                               const valKey = k + '_' + f;
                               return <label key={f} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:'#fff' }}>
                                 <span style={{minWidth:42}}>{label}</span>
                                 <input style={{width:32,padding:'2px 4px',borderRadius:4,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:9,textAlign:'center'}}
                                   type="number" min={0} max={10} value={mmcVals[valKey] ?? def}
                                   onChange={e => setMMCVals(p => ({...p, [valKey]: +e.target.value}))} />
                               </label>
                             })}
                           </div>}
                         </div>
                       )}
 
                   </div>
                 );
               })}
              {/* P11: VBT-авторегуляция по потере скорости (если введены скорости) */}
              {(() => {
                const vels = ex.targetSets.map((t, si) => vel[keyFor(ei, si)]).filter(v => v && v > 0);
                if (vels.length < 2) return null;
                const thr = thresholdForIntent(vbtIntent);
                const vl = velocityLoss(vels, thr);
                if (!vl) return null;
                const zone = velocityLossZone(vl.lossPct);
                return <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, background: vl.exceeded ? 'rgba(239,68,68,0.1)' : 'rgba(0,230,138,0.08)', border: '1px solid ' + (vl.exceeded ? 'rgba(239,68,68,0.3)' : 'rgba(0,230,138,0.2)') }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: vl.exceeded ? '#ef4444' : ACCENT }}>⚡ VBT: потеря скорости {vl.lossPct}% ({vl.bestVelocity}→{vl.lastVelocity} м/с, порог {thr}%)</div>
                  <div style={{ fontSize: 10, color: '#fff' }}>{vl.exceeded ? '🔴 СТОП — порог превышен, заканчивайте сет' : '🟢 ещё ~' + vl.remainingReps + ' повторов до порога'} · {zone}</div>
                </div>;
              })()}
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: '#fff' }}>VBT-интент:</span>
                {(['strength','hypertrophy','power_heavy','speed'] as VBTIntent[]).map(it => (
                  <button key={it} onClick={() => setVbtIntent(it)} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: vbtIntent===it?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background: vbtIntent===it?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.04)', color: vbtIntent===it?'#00e68a':'#fff' }}>{it}</button>
                ))}
              </div>
               {/* таймер отдыха для этого упражнения */}
               {timerRunning && timerExIdx === ei && (
                 <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: 11, color: '#fff' }}>⏱ Отдых</span>
                     <span style={{ 
                       fontSize: 20, 
                       fontWeight: 700, 
                       color: timerSec <= 10 ? '#f59e0b' : ACCENT,
                       animation: timerSec <= 10 && timerSec > 0 ? 'pulse 1s ease-in-out infinite' : 'none',
                       transition: 'color 0.3s ease'
                     }}>
                       {String(Math.floor(timerSec / 60)).padStart(2, '0')}:{String(timerSec % 60).padStart(2, '0')}
                     </span>
                     <button onClick={skipRestTimer} style={{ fontSize: 10, padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: 'pointer', minHeight: 28 }}>Пропустить</button>
                   </div>
                   <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                     <div style={{ height: '100%', width: `${Math.min(100, timerPct)}%`, borderRadius: 2, background: timerSec <= 10 ? '#f59e0b' : ACCENT, transition: 'width 1s linear' }} />
                   </div>
                   {timerSec === 0 && <div style={{ marginTop: 4, fontSize: 10, color: ACCENT, fontWeight: 600 }}>✅ Отдых завершён — можно приступать к следующему подходу</div>}
                  </div>
                 )}
                
                {/* пресеты таймера отдыха */}
               <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                 <span style={{ fontSize: 9, color: '#fff', alignSelf: 'center' }}>Таймер:</span>
                 {(['compound','isolation','pump'] as const).map(p => (
                   <button key={p} onClick={() => setTimerPreset(p)} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: timerPreset===p?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background: timerPreset===p?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.04)', color: timerPreset===p?'#00e68a':'#fff' }}>
                     {p === 'compound' ? 'Силовой' : p === 'isolation' ? 'Изоляция' : 'Пампинг'}
                   </button>
                 ))}
                 <button onClick={() => { setTimerPreset('custom'); }} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: timerPreset==='custom'?'1px solid #00e68a':'1px solid rgba(255,255,255,0.08)', background: timerPreset==='custom'?'rgba(0,230,138,0.12)':'rgba(255,255,255,0.04)', color: timerPreset==='custom'?'#00e68a':'#fff' }}>
                   {customRestSec}с
                 </button>
                 {timerPreset === 'custom' && (
                   <input style={{ ...IN, width: 48, fontSize: 10, padding: '2px 4px' }} type="number" min={30} max={300} value={customRestSec} onChange={e => setCustomRestSec(Math.max(30, Math.min(300, +e.target.value)))} aria-label="свой таймер" />
                 )}
                 <button onClick={() => setAutoStartRest(!autoStartRest)} style={{ 
                   padding: '2px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', 
                   border: autoStartRest ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', 
                   background: autoStartRest ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)', 
                   color: autoStartRest ? '#00e68a' : '#fff' 
                 }}>
                   {autoStartRest ? '▶ Авто-старт' : '⏸ Ручной'}
                 </button>
                </div>
               
               {/* кнопка отдыха между упражнениями */}
               <div style={{ marginTop: 6 }}>
                 <button onClick={() => startInterExTimer(120)} style={{ ...BTN_GHOST, fontSize: 10, padding: '4px 10px' }}>
                   ⏱ Отдых между упражнениями (2 мин)
                 </button>
               </div>

               {/* индикация суперсета/круга */}
               {(supersetMode || circuitMode) && supersetExercises.length > 0 && (
                 <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, 
                   background: supersetMode ? 'rgba(245,158,11,0.08)' : 'rgba(139,92,246,0.08)',
                   border: `1px solid ${supersetMode ? 'rgba(245,158,11,0.3)' : 'rgba(139,92,246,0.3)'}` }}>
                   <div style={{ fontSize: 11, fontWeight: 600, color: supersetMode ? '#f59e0b' : '#8b5cf6', marginBottom: 6 }}>
                     {supersetMode ? '🔄 Суперсет:' : '⭕ Круг:'} {supersetExercises.length} упражнений
                   </div>
                   <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                     {supersetExercises.map((exIdx, order) => (
                       <span key={exIdx} style={{ 
                         fontSize: 10, padding: '2px 8px', borderRadius: 4,
                         background: 'rgba(255,255,255,0.08)', color: '#fff',
                       }}>
                         {order + 1}. {day?.exercises[exIdx]?.name || `Упр ${exIdx + 1}`}
                       </span>
                     ))}
                   </div>
                   <div style={{ fontSize: 9, color: '#fff', marginTop: 6 }}>
                     {supersetMode 
                       ? `Короткий отдых (${getSupersetRestTime()}с) между упражнениями, полный отдых после всех`
                       : 'Минимальный отдых между упражнениями, отдых после завершения круга'
                     }
                   </div>
                 </div>
               )}
               
               {/* таймер между упражнениями */}
               {interExTimerRunning && (
                 <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: 11, color: '#fff' }}>⏱ Переход к следующему</span>
                     <span style={{ fontSize: 20, fontWeight: 700, color: interExTimerSec <= 10 ? '#f59e0b' : '#60a5fa' }}>
                       {String(Math.floor(interExTimerSec / 60)).padStart(2, '0')}:{String(interExTimerSec % 60).padStart(2, '0')}
                     </span>
                     <button onClick={skipInterExTimer} style={{ fontSize: 10, padding: '2px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: 'pointer', minHeight: 28 }}>Пропустить</button>
                   </div>
                   <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                     <div style={{ height: '100%', width: `${Math.min(100, (120 - interExTimerSec) / 120 * 100)}%`, borderRadius: 2, background: interExTimerSec <= 10 ? '#f59e0b' : '#60a5fa', transition: 'width 1s linear' }} />
                   </div>
                 </div>
               )}
            </div>
          ))}
        </div>
      )}

      {phase === 'cooldown' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={H}>🧘 Заминка: {day.label}</div>
            {(() => {
              const total = cooldownBlocks.reduce((s, b) => s + b.exercises.length, 0);
              const done = Object.values(cooldownDone).filter(Boolean).length;
              const pct = total > 0 ? Math.round(done / total * 100) : 0;
              const totalSec = cooldownBlocks.reduce((s, b) => s + (b.durationSec || 0), 0);
              return (
                <span style={{ fontSize: 10, fontWeight: 600, color: pct === 100 ? '#22c55e' : ACCENT }}>
                  {done}/{total} · {pct}%{totalSec > 0 ? ` · ~${Math.round(totalSec / 60 * 10) / 10} мин` : ''}
                </span>
              );
            })()}
          </div>
          {(() => {
            const total = cooldownBlocks.reduce((s, b) => s + b.exercises.length, 0);
            const done = Object.values(cooldownDone).filter(Boolean).length;
            const pct = total > 0 ? Math.round(done / total * 100) : 0;
            return (
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: pct === 100 ? '#22c55e' : ACCENT, transition: 'width 0.3s ease' }} />
              </div>
            );
          })()}
          {cooldownBlocks.map((b, i) => (
            <div key={i} style={{ ...CARD, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT, marginBottom: 4 }}>
                {b.type === 'cardio' ? 'Лёгкое кардио' : b.type === 'stretch' ? 'Стретчинг' : b.type === 'breathing' ? 'Дыхание' : 'Восстановление'}
                <span style={{ fontWeight: 400, fontSize: 10, color: '#fff', marginLeft: 6 }}>{b.durationSec}с</span>
              </div>
              {b.notes && <div style={{ fontSize: 10, color: '#fff', marginBottom: 6 }}>{b.notes}</div>}
              <ul style={{ paddingLeft: 16, margin: '2px 0', listStyle: 'none' }}>
                {b.exercises.map((ex, j) => {
                  const isDone = cooldownDone[`c_${i}_${j}`];
                  const isTimer = coolTimer && coolTimer.i === i && coolTimer.j === j;
                  return (
                    <li key={j} style={{ fontSize: 11, color: isDone ? 'var(--text-faint)' : '#fff', textDecoration: isDone ? 'line-through' : 'none', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={isDone} onChange={() => toggleCooldown(i, j)} />
                      <span style={{ flex: 1 }}>
                        <span>
                          {cooldownLabel(ex.exerciseId)}
                          <span style={{ color: '#fff', fontSize: 10 }}> · {ex.durationSec}с</span>
                        </span>
                        {'note' in ex && ex.note ? <span style={{ display: 'block', fontSize: 9, color: 'var(--text-faint)', marginTop: 1 }}>{ex.note}</span> : null}
                      </span>
                      {isTimer ? (
                        <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: 12, minWidth: 34, textAlign: 'center' }}>{coolTimer!.remaining}с</span>
                      ) : (
                        <button type="button" disabled={isDone} onClick={() => setCoolTimer({ i, j, remaining: ex.durationSec, total: ex.durationSec })}
                          style={{ padding: '2px 8px', borderRadius: 6, fontSize: 9, cursor: 'pointer', border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.1)', color: isDone ? 'var(--text-faint)' : '#38bdf8', minHeight: 24 }}
                          aria-label={`Таймер ${cooldownLabel(ex.exerciseId)}`}>
                          {isDone ? '✓' : '⏱'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <button style={{ ...BTN, width: '100%', marginTop: 12 }} onClick={exitSession}>✓ Завершить и выйти</button>
          <SkipBar reasons={COOLDOWN_SKIP_REASONS} label="заминку" onSkip={reason => { skipCooldownReasonRef.current = reason; exitSession(); }} />
        </div>
      )}

      {phase === 'done' && (
        <div style={CARD}>
          <div style={H}>✅ Тренировка завершена</div>
          <div style={SMALL}>{done?.date} · {done?.startTime}–{done?.endTime} · фокус: {done?.focus}</div>
          <div style={ROW}><span>Сессий записано всего:</span><span style={{ color: ACCENT }}>{getLastSession() ? 'сохранено в дневник' : '—'}</span></div>

          {/* Психология: чек-ин сессии (уверенность/активация/фокус) */}
          <MindsetCheckinCard sessionId={done?.sessionId} />

          {/* Мобильность: растяжка после тренировки + чек-ин ROM */}
          <MobilityPostPanel sessionId={done?.sessionId} />

          <div style={ROW}><span>Объём факт vs план:</span><span style={{ color: ACCENT }}>{factVol.volume} / {planned.volume} кг·пов</span></div>
          <div style={ROW}><span>Сеты факт vs план:</span><span style={{ color: ACCENT }}>{factVol.sets} / {planned.sets}</span></div>
          <div style={{ ...SMALL, marginTop: 8 }}>Реализация объёма: {planned.volume > 0 ? Math.round(factVol.volume / planned.volume * 100) : 0}%</div>
          {topE1RM.e1rm > 0 && (
            <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>🎯 Оценка 1RM (Epley) по лучшему сету</div>
              <div style={{ ...SMALL, marginTop: 4 }}><b style={{ color: '#fff' }}>{topE1RM.exercise}</b>: {topE1RM.weight}кг×{topE1RM.reps} → e1RM ≈ <b style={{ color: '#60a5fa' }}>{topE1RM.e1rm} кг</b></div>
              <div style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>Обновите workMax для этой группы в профиле, если e1RM выше текущего — веса в плане пересчитаются.</div>
            </div>
          )}
          {nextSuggestions.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: anyDeload ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.05)', border: '1px solid ' + (anyDeload ? 'rgba(239,68,68,0.25)' : 'rgba(0,230,138,0.18)') }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: anyDeload ? '#ef4444' : ACCENT, marginBottom: 6 }}>{anyDeload ? '⚠ Прогрессия + сигнал делода' : '📈 Прогрессия к следующей сессии (double progression)'}</div>
              {anyDeload && <div style={{ fontSize: 10, color: '#fca5a5', marginBottom: 6 }}>Высокий RPE на нескольких сетах — рассмотрите делод-неделю (−15-20% объём, удержание интенсивности) перед следующей прогрессией.</div>}
              {nextSuggestions.map((s, i) => (
                <div key={i} style={{ fontSize: 10, color: '#fff', lineHeight: 1.5, marginBottom: 4, paddingLeft: 4, borderLeft: '2px solid ' + (s.deload ? '#ef4444' : 'rgba(0,230,138,0.4)') }}>
                  <b style={{ color: '#fff' }}>{s.name}</b> → след. {s.nextWeight}кг×{s.nextReps}. <span style={{ color: '#fff' }}>{s.note}</span>
                </div>
              ))}
            </div>
          )}
          {/* RIR-калибровка: фидбек по каждому упражнению */}
          {rirFeedback && rirFeedback.exerciseFeedbacks.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: rirFeedback.sessionQuality === 'отлично' ? 'rgba(0,230,138,0.06)' : rirFeedback.sessionQuality === 'плохо' ? 'rgba(239,68,68,0.06)' : 'rgba(234,179,8,0.06)', border: '1px solid ' + (rirFeedback.sessionQuality === 'отлично' ? 'rgba(0,230,138,0.2)' : rirFeedback.sessionQuality === 'плохо' ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.25)') }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: rirFeedback.sessionQuality === 'отлично' ? '#00e68a' : rirFeedback.sessionQuality === 'плохо' ? '#ef4444' : '#eab308', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🎯 RIR-калибровка: {rirFeedback.sessionQuality}</span>
                <span style={{ fontSize: 10, fontWeight: 400, color: '#fff' }}>bias {rirFeedback.overallBias > 0 ? '+' : ''}{rirFeedback.overallBias} RIR</span>
              </div>
              {rirFeedback.exerciseFeedbacks.map((f, i) => (
                <div key={i} style={{ fontSize: 10, color: '#fff', lineHeight: 1.5, marginBottom: 4, paddingLeft: 4, borderLeft: '2px solid ' + (Math.abs(f.bias) > 1 ? '#ef4444' : Math.abs(f.bias) > 0.3 ? '#eab308' : 'rgba(0,230,138,0.4)') }}>
                  <b style={{ color: '#fff' }}>{f.name}</b>
                  <span style={{ color: '#fff' }}> bias {f.bias > 0 ? '+' : ''}{f.bias} · согласованность {f.consistency}% — {f.recommendation}</span>
                </div>
              ))}
              <div style={{ fontSize: 9, color: '#fff', marginTop: 6 }}>
                RIR-калибровка накапливается: чем больше подходов с RPE, тем точнее рекомендации.
              </div>
            </div>
          )}
          {lms && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.18)' }}>
              <div style={{ ...LABEL, color: ACCENT }}>📊 Метрики сессии ({lms.exerciseCount} упр.)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
                <div style={SMALL}>Тоннаж: <b style={{ color: '#fff' }}>{Math.round(lms.metrics.tonnage)}</b> кг</div>
                <div style={SMALL}>КПШ: <b style={{ color: '#fff' }}>{lms.metrics.kpsh}</b></div>
                <div style={SMALL}>Инт.отн: <b style={{ color: '#fff' }}>{lms.metrics.relIntensity.toFixed(3)}</b></div>
                <div style={SMALL}>УОИ: <b style={{ color: '#fff' }}>{lms.metrics.uoi.toFixed(3)}</b></div>
                <div style={SMALL}>Инт.Ф+Б: <b style={{ color: '#fff' }}>{Math.round(lms.metrics.intFB)}</b></div>
                <div style={SMALL}>Ср.вес: <b style={{ color: '#fff' }}>{Math.round(lms.metrics.avgWeight)}</b> кг · {lms.minutes} мин</div>
              </div>
            </div>
          )}
           {prs.length > 0 && <div style={{ marginTop: 8 }}><div style={LABEL}>🏆 Последние PR:</div>{prs.map((p, i) => <div key={i} style={SMALL}>• {p.exercise}: {p.weight}кг×{p.reps} ({p.date})</div>)}</div>}
           
           {/* история отдыха */}
           {restHistory.length > 0 && (
             <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
               <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <span>⏱ История отдыха</span>
                 <button onClick={() => setRestHistory([])} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Очистить</button>
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
                 <div style={SMALL}>Всего отдыха: <b style={{ color: '#fff' }}>{Math.floor(restHistory.reduce((s, r) => s + r.duration, 0) / 60)}</b> мин</div>
                 <div style={SMALL}>Периодов: <b style={{ color: '#fff' }}>{restHistory.length}</b></div>
                 <div style={SMALL}>Средний: <b style={{ color: '#fff' }}>{Math.round(restHistory.reduce((s, r) => s + r.duration, 0) / restHistory.length)}</b> сек</div>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 120, overflowY: 'auto' }}>
                 {restHistory.map((r, i) => (
                   <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#fff', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                     <span style={{ flex: 1 }}>{r.exercise}</span>
                     <span style={{ color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{Math.floor(r.duration / 60)}:{String(r.duration % 60).padStart(2, '0')}</span>
                     <span style={{ color: '#fff', marginLeft: 8 }}>{r.timestamp}</span>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* сравнение с предыдущей сессией */}
           {sessionComparison && sessionComparison.older && (
             <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
               <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>📊 Сравнение с предыдущей сессией ({sessionComparison.older.date})</div>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
                 {([
                   { label: 'Тоннаж', cur: done?.totalVolume || 0, prev: sessionComparison.older.totalVolume, unit: 'кг', isKg: true },
                   { label: 'Подходы', cur: done?.totalSets || 0, prev: sessionComparison.older.totalSets, unit: '' },
                   { label: 'Повторы', cur: done?.totalReps || 0, prev: sessionComparison.older.totalReps, unit: '' },
                   { label: 'Интенсив.', cur: done?.avgIntensity || 0, prev: sessionComparison.older.avgIntensity, unit: '' },
                 ]).map(item => {
                   const delta = item.cur - item.prev;
                   const pct = item.prev > 0 ? Math.round(delta / item.prev * 100) : 0;
                   const positive = delta > 0;
                   return (
                     <div key={item.label} style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
                       <div style={{ fontSize: 9, color: '#fff' }}>{item.label}</div>
                       <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{Math.round(item.cur)}{item.unit}</div>
                       <div style={{ fontSize: 9, color: positive ? '#22c55e' : delta < 0 ? '#ef4444' : '#fff' }}>
                         {delta > 0 ? '+' : ''}{item.isKg ? Math.round(delta) : delta} ({pct > 0 ? '+' : ''}{pct}%)
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}

           {/* delta по упражнениям vs лучший результат */}
           {exerciseBestDeltas.length > 0 && (
             <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(0,230,138,0.04)', border: '1px solid rgba(0,230,138,0.15)' }}>
               <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>🏋️ Упражнения: текущий лучший vs предыдущий</div>
               {exerciseBestDeltas.map((d, i) => (
                 <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < exerciseBestDeltas.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                   <span style={{ fontSize: 10, color: 'var(--text)', flex: 1 }}>{d.name}</span>
                   <span style={{ fontSize: 10, color: '#fff', marginRight: 6 }}>{d.prevBest} → {d.currentBest}кг</span>
                   <span style={{ fontSize: 10, fontWeight: 700, color: d.delta > 0 ? '#22c55e' : d.delta < 0 ? '#ef4444' : '#fff', minWidth: 50, textAlign: 'right' }}>
                     {d.delta > 0 ? '+' : ''}{d.delta}кг
                   </span>
                 </div>
               ))}
             </div>
           )}
            
            <button style={{ ...BTN_GHOST, width: '100%', marginTop: 8 }} onClick={() => {
              if (!done) return;
              const lines: string[] = [];
              lines.push(`🏋️ Тренировка: ${done.focus} — ${done.date}`);
              lines.push(`⏱ ${done.startTime}–${done.endTime} (${done.durationMin} мин)`);
              lines.push(`📊 Тоннаж: ${done.totalVolume.toLocaleString()} кг · Подходы: ${done.totalSets} · Повторы: ${done.totalReps}`);
              if (topE1RM.e1rm > 0) lines.push(`🎯 Лучший 1RM: ${topE1RM.exercise} ${topE1RM.weight}кг×${topE1RM.reps} → ${topE1RM.e1rm}кг`);
              lines.push('');
              done.exercises.forEach(ex => {
                lines.push(`${ex.exerciseName} (${ex.muscleGroup})`);
                ex.sets.forEach(s => {
                  lines.push(`  #${s.setNumber} ${s.weightKg}кг×${s.reps} RPE${s.rpe} e1RM~${Math.round(s.weightKg * (1 + s.reps / 30))}кг${s.isPR ? ' 🏆 PR' : ''}`);
                });
                lines.push(`  Итого: ${ex.totalVolume}кг · лучший 1RM: ${ex.best1RM}кг`);
              });
              if (nextSuggestions.length > 0) {
                lines.push('');
                lines.push('📈 Следующая сессия:');
                nextSuggestions.forEach(s => lines.push(`  ${s.name} → ${s.nextWeight}кг×${s.nextReps} (${s.note})`));
              }
              const text = lines.join('\n');
              navigator.clipboard?.writeText(text).then(() => {
                hapticNotify('success');
              }).catch(() => {});
            }}>📋 Копировать сводку</button>
            <button style={{ ...BTN_GHOST, width: '100%', marginTop: 8 }} onClick={() => { setDone(null); setWarmupBlocks([]); setCooldownBlocks([]); setSession(null); savedRef.current = false; setPhase('ready'); }}>← Новая тренировка</button>
            {days.length > 1 && dayIdx < days.length - 1 && (
              <button style={{ ...BTN, width: '100%', marginTop: 8 }} onClick={() => {
                setDone(null); setWarmupBlocks([]); setCooldownBlocks([]); setSession(null); savedRef.current = false;
                setPhase('ready'); setDayIdx(dayIdx + 1);
              }}>
                ➡ Следующий день: {days[dayIdx + 1]?.label} ({dayIdx + 2}/{days.length})
              </button>
            )}
         </div>
       )}

    </div>
  );
};

export default SessionPlayer;
