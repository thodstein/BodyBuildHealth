/**
 * SessionPlayer.tsx — экран выполнения плана ПЛ/ББ.
 * REUSE workout-logger.engine: startSession → addExerciseToSession → logSet → finishSession.
 * Mobile-first, dark theme. Принимает нормализованный план (дни → упражнения → целевые сеты).
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  startSession,
  addExerciseToSession,
  logSet,
  finishSession,
  getLastSession,
  getRecentPRs,
  type WorkoutSession,
  type CachedProgress,
  getExerciseProgress,
  cacheExerciseProgress,
  cacheSessionStats,
  getWorkoutStats,
  compareWithPrevious,
  getCachedProgressForExercise,
  localIsoDate,
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  archiveActiveSession,
  summarizeActiveSession,
  loadSessions,
  type ActiveSession,
  type ActiveSessionSummary,
} from '../../../engines/workout-logger.engine';
import {
  generateWarmup,
  upsertWarmupLog,
  warmupLabel,
  warmupSpecificLabel,
  WARMUP_SKIP_REASONS,
  type WarmupInput,
  type WarmupMode,
} from '../../../engines/warmup.engine';
import {
  generateCooldown,
  upsertCooldownLog,
  cooldownLabel,
  COOLDOWN_SKIP_REASONS,
  type CooldownInput,
} from '../../../engines/cooldown.engine';
import { type WarmupBlock, type CooldownBlock, type WorkoutLog } from '../../../core/types';
import { computeSessionMetrics } from './sessionMetrics';
import { hapticImpact, hapticNotify } from '../../../core/telegram';
import { useNativeWakeLock } from '../../native/useWakeLock';
import { velocityLoss, velocityLossZone, type VBTIntent } from '../../../engines/pro/vbt.engine';
import { calculatePlates } from '../../../engines/gym-competition.engine';
import { isBodyweightExercise } from '../../../engines/movement-pattern';
import { widgetTimerCommand } from '../../../core/widget-bridge';
import { saveSRPESession } from '../../../engines/pro/srpe-store';
import { StrengthDiary } from '../../../engines/strength-diary.engine';
import { useTrainingProfile } from '../TrainingScreen_parts/training-profile';
import {
  collectExerciseBests,
  setIntensity,
  normalizeExerciseName,
  type ExerciseBest,
} from '../../../engines/set-intensity.engine';
import { recommendTempo, formatTempo, TEMPO_PRESETS, type TempoPhase } from '../../../engines/rep-tempo.engine';
import { recordSessionRIR, getSessionRIRFeedback } from '../../../engines/rir-calibration.engine';
import { recordMMC } from '../../../engines/mmc-tracking.engine';
import { MindsetPreSessionCard, MindsetApproachHint, MindsetCheckinCard } from './MindsetSessionPanels';
import { MobilitySessionPanel, MobilityPostPanel } from './MobilitySessionPanel';
import { PlateCalcTab } from '../TrainingScreen_parts/PlateCalcTab';
import { techniqueLabel, techniqueChainParts } from '../TrainingScreen_parts/bb-technique-display';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { isNativeApp } from '../../../core/app-platform';
import {
  CARD as TRAIN_CARD,
  SMALL as TRAIN_SMALL,
  BTN as TRAIN_BTN,
  BTN_GHOST as TRAIN_BTN_GHOST,
  IN as TRAIN_IN,
} from '../TrainingScreen_parts/training-ui';
import { readPLCheckin, applyReadinessToDay, PL_CHECKIN_EVENT } from '../../../engines/lms/pl-readiness-adjust.engine';
import { adviseVBTNextSet, type VBTSetSample } from '../../../engines/lms/pl-vbt-loop.engine';
import { PLSetVideoButton } from './PLSetVideoButton';
import {
  WorkoutSummaryReport,
  PLAYER_REPORT_BLOCKS,
  readReportBlocks,
} from '../TrainingScreen_parts/WorkoutSummaryReport';
import {
  sessionToWorkoutLog,
  buildWorkoutSummary,
  buildWorkoutReportText,
  buildSetDetails,
  buildNextSessionPlan,
  compareWorkoutSummaries,
  comparePlanVsActual,
  MUSCLE_LABELS,
  VOLUME_STATUS_COLOR,
  VOLUME_STATUS_LABEL,
  type PlannedExerciseInput,
  type ReportBlockId,
} from '../../../engines/workout-summary.engine';
import { getVolumeLandmarks, checkVolumeStatus, MUSCLE_LABEL_RU } from '../../../engines/volume-landmarks.engine';
import { ruCount, RU_APPROACHES, RU_EXERCISES, RU_SETS } from '../../../engines/ru-plural';

// Фаза 3: карточки/кнопки/поля — из единого кита training-ui.
const CARD = TRAIN_CARD;
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

function isDumbbellExercise(name?: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('гантел') || n.includes('dumbbell');
}
function isKettlebellExercise(name?: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('гир');
}
function formatPlates(targetW: number, exerciseName?: string): string {
  if (targetW <= 0) return '';
  const isDB = isDumbbellExercise(exerciseName);
  const isKB = isKettlebellExercise(exerciseName);
  if (isKB) return `гиря ${targetW} кг`;
  if (isDB) {
    // вес гантели — за одну гантель; разборная рукоять ~2 кг
    const handle = 2;
    if (targetW <= handle) return `гантель ${targetW} кг`;
    const perSide = (targetW - handle) / 2;
    const r = calculatePlates(targetW, handle);
    if (r.platesPerSide.length === 0) return `2×${targetW} кг гантели`;
    const platesStr = r.platesPerSide.map((p) => `${p.count}×${p.plate}`).join(' + ');
    return `2×${targetW} кг → ${platesStr} на гантель ${handle}кг (по ${perSide.toFixed(1)}кг/сторона)`;
  }
  const r = calculatePlates(targetW);
  if (r.platesPerSide.length > 0) {
    return r.platesPerSide.map((p) => `${p.count * 2}x${p.plate}`).join(' + ') + ` на гриф ${r.barWeight} кг`;
  }
  return `гриф ${r.barWeight} кг`;
}
const BTN = TRAIN_BTN;
const BTN_GHOST = TRAIN_BTN_GHOST;

/** ⏭ Пропустить разминку/заминку с указанием причины (пишется в дневник). */
const SkipBar: React.FC<{ reasons: string[]; onSkip: (reason: string) => void; label: string }> = ({
  reasons,
  onSkip,
  label,
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0] || 'другое');
  return (
    <div style={{ marginTop: 8 }} data-session="skip-bar">
      <button
        type="button"
        style={{ ...BTN_GHOST, width: '100%', color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }}
        onClick={() => setOpen((v) => !v)}
        data-session="skip-trigger"
        aria-expanded={open}
      >
        ⏭ Пропустить {label} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-session="skip-reasons">
            {reasons.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setReason(r)}
                data-session="skip-reason"
                aria-pressed={reason === r}
                style={{
                  ...BTN_GHOST,
                  flex: '1 1 120px',
                  minHeight: 44,
                  fontSize: 11,
                  background: reason === r ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.04)',
                  borderColor: reason === r ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                  color: reason === r ? 'var(--accent)' : '#fff',
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            style={{ ...BTN, width: '100%', minHeight: 44 }}
            data-session="skip-confirm"
            onClick={() => {
              onSkip(reason);
              setOpen(false);
            }}
          >
            Пропустить: {reason}
          </button>
        </div>
      )}
    </div>
  );
};
const IN = TRAIN_IN;
const LABEL: React.CSSProperties = { color: '#fff', fontSize: 11, margin: '4px 0 2px' };
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL = TRAIN_SMALL;
const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 0',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

export interface PlayerSet {
  weight: number;
  reps: number;
  rir: number;
  tempo?: string | TempoPhase;
  technique?: string;
}
const tempoText = (tempo: PlayerSet['tempo']): string | undefined =>
  tempo ? (typeof tempo === 'string' ? tempo : formatTempo(tempo)) : undefined;
export interface PlayerExercise {
  name: string;
  muscleGroup: string;
  targetSets: PlayerSet[];
  restSec?: number; // целевой отдых между подходами (сек), из presc
  // Поля метрик (передаются из плана; иначе — эвристика).
  pm?: number; // предельный максимум упражнения (кг)
  coef?: number; // Коэф. тяжести (1.2 / 1.0 / 0.3)
  mnosz?: number; // Множ (множитель нагрузки)
  group?: string; // группа (ЖМ/ПР/ТГ/Ср)
  /** D-3 (итерация E): номер суперсет-группы из плана — бейдж A1/B1 в плеере.
   *  Не передано (микроцикл PL) — бейдж не показывается. */
  supersetGroup?: number;
  /** Позиция в паре: 0 = A, 1 = B. */
  supersetSlot?: 0 | 1;
  /** Упражнение без отягощения (турник/брусья/отжимания) — из каталога, не из планового веса. */
  isBodyweight?: boolean;
}
export interface PlayerDay {
  label: string;
  exercises: PlayerExercise[];
}

/**
 * Плановый вес 0 — это «свой вес», только если упражнение действительно без отягощения
 * (турник, брусья, отжимания). Если план молча отдал 0 для штанги, подход без введённого
 * веса должен упасть с видимой ошибкой, а не записаться как BW с тоннажем 0.
 */
const planIsBodyweight = (ex: PlayerExercise, planWeight: number): boolean =>
  ex.isBodyweight === true || (Number(planWeight) <= 0 && isBodyweightExercise({ name: ex.name }));

/** Значения подхода в редакторе плеера: вес/повторы/RPE/RIR/темп. */
export type SessionSetValue = { weight: number; reps: number; rpe: number; rir?: number; tempo?: string };

/**
 * Убрать из сессии подход с указанным `setNumber` (перед повторной записью того же сета).
 *
 * `logSet` всегда добавляет подход в конец, а кнопка «✓» в плеере в залогированном
 * состоянии означает ПРАВКУ (вес/повторы поменяли → записать заново). Без этой чистки
 * повторное нажатие удваивало подход: объём, e1RM и PR считались по двум записям.
 */
export function withoutSetNumber(session: WorkoutSession, exerciseIndex: number, setNumber: number): WorkoutSession {
  if (!session || !Array.isArray(session.exercises)) return session;
  const exercises = session.exercises.map((e, i) => {
    if (i !== exerciseIndex) return e;
    const sets = (e.sets || []).filter((st) => st.setNumber !== setNumber);
    // Производные поля упражнения пересчитываем по остатку — иначе после правки
    // веса вниз «лучший 1ПМ сессии» и объём оставались завышенными.
    const best1RM = sets.reduce((m, st) => Math.max(m, st.weightKg * (1 + st.reps / 30)), 0);
    const totalVolume = sets.reduce((s, st) => s + st.weightKg * st.reps, 0);
    const avgRPE = sets.length ? Math.round((sets.reduce((s, st) => s + st.rpe, 0) / sets.length) * 10) / 10 : 0;
    return { ...e, sets, best1RM: Math.round(best1RM * 10) / 10, totalVolume, avgRPE };
  });
  return { ...session, exercises };
}

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
  // Аналитика объёма в основной части свёрнута: в зале она отодвигала подходы.
  const [volOpen, setVolOpen] = useState(false);
  // Записанные подходы свёрнуты; тут — какие пользователь раскрыл для правки.
  const [editSet, setEditSet] = useState<Record<string, boolean>>({});
  const [warmupOpen, setWarmupOpen] = useState<Record<number, boolean>>({});
  const [coolOpen, setCoolOpen] = useState<Record<number, boolean>>({});
  const [openSet, setOpenSet] = useState<Record<string, boolean>>({});
  const [exOpen, setExOpen] = useState<Record<number, boolean>>({});
  const [doneMoreOpen, setDoneMoreOpen] = useState(false);
  const [phase, setPhase] = useState<'ready' | 'warmup' | 'main' | 'cooldown' | 'done'>('ready');
  // Экран не гаснет mid-set. Внутри хука — гейт на APK; в TG/web no-op.
  useNativeWakeLock(phase === 'warmup' || phase === 'main' || phase === 'cooldown');
  const [session, setSession] = useState<WorkoutSession | null>(null);
  // Последняя ошибка логирования подхода (вес 0 / сверх лимита) — показываем,
  // когда движок отказал: раньше отказ проглатывался и подход «терялся» тихо.
  const [logError, setLogError] = useState<{ key: string; msg: string } | null>(null);
  const [done, setDone] = useState<WorkoutSession | null>(null);
  // Фидбек кнопки «Копировать сводку» — на 1.8 с меняется на «✓ Скопировано».
  const [copyDone, setCopyDone] = useState(false);
  // План завершённой тренировки — снимок на момент финиша. День в плеере
  // можно переключить, а «Итог» должен сравнивать с тем планом, что выполняли.
  const [donePlan, setDonePlan] = useState<PlannedExerciseInput[] | null>(null);
  // Выбор блоков «Итога» держит сам экран: так строки, которые уже вошли в
  // выбранные блоки отчёта, не дублируются под ним.
  const [doneBlocks, setDoneBlocks] = useState<ReportBlockId[]>(() =>
    readReportBlocks('he_workout_done_blocks', PLAYER_REPORT_BLOCKS),
  );
  // История до текущей сессии: нужна для сравнения «с прошлой» и честных
  // рекордов в «Итоге» — сама сессия из базы исключается.
  const doneHistory = useMemo<WorkoutLog[]>(() => {
    if (!done) return [];
    try {
      return loadSessions()
        .filter((s) => s.sessionId !== done.sessionId)
        .map(sessionToWorkoutLog);
    } catch {
      return [];
    }
  }, [done]);
  // Незавершённая сессия из автосейва — живёт между закрытиями приложения.
  const [resumeFrom, setResumeFrom] = useState<ActiveSession | null>(() => {
    try {
      return loadActiveSession();
    } catch {
      return null;
    }
  });
  // Защита от двойного сохранения (finish вызывается из «Завершить» и из exitSession)
  const savedRef = useRef(false);
  // Хоткеи Space/Enter объявлены выше logOne и подписаны один раз: держим
  // актуальную функцию в ref, иначе обработчик логирует вес из прошлого рендера.
  const logOneRef = useRef<(ei: number, si: number) => boolean>(() => false);
  // «+ Сет» из виджета, пришедший до старта сессии: undefined — ожидания нет.
  const pendingQuickRef = useRef<Event | null | undefined>(undefined);
  // Завершение из виджета, пока плеер открыт: завершить сессию целиком умеет только плеер
  // (длительность, sRPE, RIR-калибровка, заминка), поэтому виджет только просит его.
  const finishRef = useRef<() => boolean>(() => false);
  // Сессия синхронно, без ожидания рендера: подход из виджета и завершение могут прийти
  // в одном дренаже очереди — finish обязан видеть уже записанный подход.
  const liveSessionRef = useRef<ActiveSession | null>(null);
  // sRPE пишем только измеренной: запись создаётся лишь после явного выбора
  // пользователем (кнопка/виджет), а не из стартового значения 7.
  const srpeEditedRef = useRef(false);
  // Троттлинг пушей снапшота на homescreen-виджет (АПК).
  const widgetPushRef = useRef(0);
  const [warmupBlocks, setWarmupBlocks] = useState<WarmupBlock[]>([]);
  const [cooldownBlocks, setCooldownBlocks] = useState<CooldownBlock[]>([]);
  const [warmupDone, setWarmupDone] = useState<Record<string, boolean>>({});
  const [cooldownDone, setCooldownDone] = useState<Record<string, boolean>>({});
  const [warmupMode, setWarmupMode] = useState<WarmupMode>(() => {
    try {
      const v = localStorage.getItem('he_warmup_mode') as WarmupMode | null;
      return v === 'quick' || v === 'full' ? v : 'standard';
    } catch {
      return 'standard';
    }
  });
  const [warmupTimer, setWarmupTimer] = useState<{ i: number; j: number; remaining: number; total: number } | null>(
    null,
  );
  // Таймер растяжки в фазе заминки (обратный отсчёт и автопроверка)
  const [coolTimer, setCoolTimer] = useState<{ i: number; j: number; remaining: number; total: number } | null>(null);
  useEffect(() => {
    if (!coolTimer) return;
    const t = window.setInterval(() => {
      setCoolTimer((p) => {
        if (!p) return p;
        if (p.remaining <= 1) {
          setCooldownDone((prev) => ({ ...prev, [`c_${p.i}_${p.j}`]: true }));
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
      setWarmupTimer((p) => {
        if (!p) return p;
        if (p.remaining <= 1) {
          setWarmupDone((prev) => ({ ...prev, [`w_${p.i}_${p.j}`]: true }));
          return null;
        }
        return { ...p, remaining: p.remaining - 1 };
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [warmupTimer ? `${warmupTimer.i}_${warmupTimer.j}` : null]);
  // фактический ввод текущего подхода: [exerciseIndex][setIndex] -> {weight,reps}
  // «actual» — то, что пользователь ввёл/подтвердил сам.
  // «prefill» — ПОДСКАЗКА из прошлой сессии (вес/повторы), а не запись подхода (P0-2).
  const [actual, setActual] = useState<Record<string, SessionSetValue>>({});
  const [prefill, setPrefill] = useState<Record<string, SessionSetValue>>({});

  // «Подход записан» = он реально лежит в живой сессии с этим setNumber.
  // Раньше признаком было наличие ключа в actual, а туда же складывалось
  // предзаполнение весов из прошлой тренировки → весь день выглядел выполненным,
  // ни один подход не открывался, а «Все подходы записаны» закрывал сессию
  // без сохранения (P0-2). Теперь подсказка живёт в отдельном prefill.
  const loggedSet = useMemo(() => {
    const map: Record<string, true> = {};
    (session?.exercises || []).forEach((ex, ei) => {
      (ex.sets || []).forEach((st, i) => {
        const sn = Number(st.setNumber);
        const setNumber = Number.isFinite(sn) && sn > 0 ? sn : i + 1;
        map[ei + '_' + (setNumber - 1)] = true;
      });
    });
    return map;
  }, [session]);

  // Что показывать в редакторе подхода: введённое/подтверждённое поверх подсказки.
  const vals = useMemo(() => (Object.keys(prefill).length ? { ...prefill, ...actual } : actual), [prefill, actual]);
  const [exDone, setExDone] = useState<Record<string, boolean>>({});
  const [interExTimerSec, setInterExTimerSec] = useState<number>(0);
  // Сколько длится текущий переход между упражнениями — для прогресс-бара.
  const [interExTotalSec, setInterExTotalSec] = useState<number>(120);
  const [interExTimerRunning, setInterExTimerRunning] = useState<boolean>(false);
  const interExTimerRef = useRef<number | null>(null);
  // Причина пропуска разминки/заминки (устанавливается кнопкой «⏭ Пропустить»)
  const skipWarmupReasonRef = useRef<string | null>(null);
  const skipCooldownReasonRef = useRef<string | null>(null);
  const [supersetMode, setSupersetMode] = useState<boolean>(false);
  const [circuitMode, setCircuitMode] = useState<boolean>(false);
  const [supersetExercises, setSupersetExercises] = useState<number[]>([]);
  // §8.1 (полностью): какие группы суперсетов уже применены к текущему дню.
  // План размечает пары (`supersetGroup/supersetSlot`), плеер должен их
  // исполнять сам, а не ждать ручного выбора упражнений.
  const autoSupersetKeyRef = useRef<string>('');
  // Подкладка «Калькулятор блинов»: доступный вес применяется к упражнению текущей сессии
  const [plateOpen, setPlateOpen] = useState<boolean>(false);
  // Разворачиваемая техника упражнения (по имени упражнения)
  const [techOpen, setTechOpen] = useState<Record<string, boolean>>({});
  // P2-1: настройки таймера отдыха ЧИТАЮТСЯ из he_timer_settings (раньше писались
  // и никогда не читались: после перезапуска снова 90 с и авто-старт). Одна
  // валидирующая точка-парсер — битые/чужие значения не ломают плеер.
  const timerSettingsSaved: {
    preset: 'compound' | 'isolation' | 'pump' | 'custom';
    customRest: number;
    autoStart: boolean;
  } = (() => {
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem('he_timer_settings');
      const parsed = raw ? JSON.parse(raw) : null;
      const preset: 'compound' | 'isolation' | 'pump' | 'custom' =
        parsed?.preset === 'isolation' || parsed?.preset === 'pump' || parsed?.preset === 'custom'
          ? parsed.preset
          : 'compound';
      const n = Number(parsed?.customRest);
      const customRest = Number.isFinite(n) ? Math.max(30, Math.min(300, Math.round(n))) : 90;
      const autoStart = typeof parsed?.autoStart === 'boolean' ? parsed.autoStart : true;
      return { preset, customRest, autoStart };
    } catch {
      return { preset: 'compound' as const, customRest: 90, autoStart: true };
    }
  })();
  const [autoStartRest, setAutoStartRest] = useState<boolean>(timerSettingsSaved.autoStart);
  // Настройки уведомлений таймера (P2-1): звук/вибрация/голос. Хранятся в localStorage.
  const [timerSoundSettings, setTimerSoundSettings] = useState<{ sound: boolean; vibrate: boolean; voice: boolean }>(
    () => {
      try {
        const raw = localStorage.getItem('he_timer_sound_settings');
        if (raw) {
          const p = JSON.parse(raw);
          return { sound: p?.sound !== false, vibrate: p?.vibrate !== false, voice: p?.voice !== false };
        }
      } catch {
        /* ignore */
      }
      return { sound: true, vibrate: true, voice: true };
    },
  );
  useEffect(() => {
    try {
      localStorage.setItem('he_timer_sound_settings', JSON.stringify(timerSoundSettings));
    } catch {
      /* ignore */
    }
  }, [timerSoundSettings]);
  const [exerciseProgress, setExerciseProgress] = useState<Record<string, { completed: number; total: number }>>({});
  const [restHistory, setRestHistory] = useState<{ exercise: string; duration: number; timestamp: string }[]>([]);
  // P11: VBT-ввод скорости штанги (м/с) на сет + авторегуляция по потере скорости
  const [vel, setVel] = useState<Record<string, number>>({});
  /** Фаза 6, п.10: сообщение по видео подхода (показывается только у своего сета). */
  const [videoNote, setVideoNote] = useState<{ key: string; msg: string } | null>(null);
  const [mmco, setMMCOpen] = useState<string>('');
  const [mmcVals, setMMCVals] = useState<Record<string, number>>({});
  const [vbtIntent, setVbtIntent] = useState<VBTIntent>('strength');
  /** Фаза 6, п.7: вес, который VBT-пересчёт применил к сету (ключ `${ei}_${si}`).
   *  Хранится ОТДЕЛЬНО от `actual`: иначе сет выглядел бы уже записанным. */
  const [vbtOverride, setVbtOverride] = useState<Record<string, number>>({});
  const [sessionRPE, setSessionRPE] = useState<number>(7);
  // Подтверждение завершения — в стиле приложения: window.confirm блокирует WebView
  // и выпадает из тёмной темы.
  const [exitConfirm, setExitConfirm] = useState(false);
  // Подтверждение «Начать заново» своим диалогом (window.confirm не работает в WebView
  // без поддержки и блокирует поток).
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [sessionDur, setSessionDur] = useState<number>(60);
  // Пользователь ввёл минуты сам — не перетираем их таймером сессии.
  const durEditedRef = useRef(false);
  // авто-таймер отдыха
  const [timerSec, setTimerSec] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerExIdx, setTimerExIdx] = useState<number>(-1);
  const [timerPreset, setTimerPreset] = useState<'compound' | 'isolation' | 'pump' | 'custom'>(
    timerSettingsSaved.preset,
  );
  const [customRestSec, setCustomRestSec] = useState<number>(timerSettingsSaved.customRest);
  // Ручная добавка к отдыху («+15с» в зале) — план-цель не переписываем.
  const [restAddSec, setRestAddSec] = useState<number>(0);
  const timerRef = useRef<number | null>(null);
  const [sessionTimerSec, setSessionTimerSec] = useState<number>(0);
  const [sessionTimerRunning, setSessionTimerRunning] = useState<boolean>(false);
  const sessionTimerRef = useRef<number | null>(null);
  // Длительность для sRPE: пока не введена вручную — реальный таймер сессии.
  // Раньше всегда уходило 60 минут, и ACWR/нагрузка считались по выдуманной
  // длительности даже для 25-минутной тренировки.
  React.useEffect(() => {
    if (phase !== 'main' || durEditedRef.current) return;
    const m = Math.max(1, Math.round(sessionTimerSec / 60));
    setSessionDur((prev) => (prev === m ? prev : m));
  }, [phase, sessionTimerSec]);

  // Сохранение настроек таймера при изменении
  useEffect(() => {
    try {
      localStorage.setItem(
        'he_timer_settings',
        JSON.stringify({
          preset: timerPreset,
          customRest: customRestSec,
          autoStart: autoStartRest,
        }),
      );
    } catch {}
  }, [timerPreset, customRestSec, autoStartRest]);

  const plannedDay = days[dayIdx] || days[0];
  // 🌅 Фаза 6, п.6: утренний чек-ин меняет ТОЛЬКО сегодняшнюю сессию
  // (объём/RIR, в красной зоне — вес). Нет чек-ина на сегодня → план как есть.
  // Плеер не размонтируется между «свернул/развернул», поэтому чек-ин
  // перечитываем на событие сохранения (P1-6): иначе снимок остаётся от момента
  // монтирования и «скорректировано на сегодня» — неправда до перезагрузки.
  const readCheckin = () => {
    try {
      return typeof localStorage === 'undefined' ? null : readPLCheckin(localStorage);
    } catch {
      return null;
    }
  };
  const [readinessToday, setReadinessToday] = useState(() => readCheckin());
  useEffect(() => {
    const onUpdated = () => setReadinessToday(readCheckin());
    window.addEventListener(PL_CHECKIN_EVENT, onUpdated);
    return () => window.removeEventListener(PL_CHECKIN_EVENT, onUpdated);
  }, []);
  const day = useMemo(() => {
    if (!plannedDay) return plannedDay;
    if (!readinessToday || readinessToday.verdict.level === 'green') return plannedDay;
    return { ...plannedDay, exercises: applyReadinessToDay(plannedDay.exercises ?? [], readinessToday.verdict) };
  }, [plannedDay, readinessToday]);
  const [last, setLast] = useState<WorkoutSession | null>(() => getLastSession());
  const prs = useMemo(() => getRecentPRs(3), [done]);
  // Лучший e1RM по каждому упражнению из истории — база для «% от лучшего»
  // прямо в подходе. Историю читаем один раз, а не на каждый подход в рендере.
  const exerciseBests = useMemo(() => {
    try {
      return collectExerciseBests(loadSessions());
    } catch {
      return new Map<string, ExerciseBest>();
    }
  }, [done]);

  useEffect(() => {
    let active = true;
    new StrengthDiary()
      .getLastSession()
      .then((value) => {
        if (active) setLast(value);
      })
      .catch(() => {
        if (active) setLast(getLastSession());
      });
    return () => {
      active = false;
    };
  }, [done]);

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
    const base =
      timerExIdx >= 0 && day?.exercises[timerExIdx]?.restSec
        ? day.exercises[timerExIdx].restSec
        : timerPreset === 'custom'
          ? customRestSec
          : 90;
    return base + restAddSec;
  }, [timerExIdx, day, timerPreset, customRestSec, restAddSec]);

  // авто-таймер: обратный отсчёт
  useEffect(() => {
    if (!timerRunning || timerSec <= 0) return;
    timerRef.current = window.setTimeout(() => {
      setTimerSec((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          // Уведомление при завершении таймера
          if (timerSoundSettings.vibrate) hapticNotify('success');
          // Вибрация: паттерн зависит от типа таймера
          if (timerSoundSettings.vibrate && navigator.vibrate) {
            if (timerExIdx >= 0) {
              navigator.vibrate([200, 100, 200]); // двойная вибрация для отдыха между подходами
            } else {
              navigator.vibrate([500, 200, 500]); // длинная вибрация для отдыха между упражнениями
            }
          }
          // Звук
          if (timerSoundSettings.sound)
            try {
              const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
              if (Ctx) {
                const ctx = new Ctx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 880;
                gain.gain.value = 0.18;
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.18);
                osc.onended = () => {
                  try {
                    ctx.close();
                  } catch {}
                };
              }
            } catch {
              /* browser block */
            }
          // Голосовое уведомление
          if (timerSoundSettings.voice) if (timerSoundSettings.voice) speakRestComplete(timerExIdx);
          // Запись в историю отдыха
          if (timerExIdx >= 0 && day?.exercises[timerExIdx]) {
            const ex = day.exercises[timerExIdx];
            const restDuration = day.exercises[timerExIdx]?.restSec || currentRestSec;
            setRestHistory((prev) => [
              ...prev,
              {
                exercise: ex.name,
                duration: restDuration,
                timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
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
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerRunning, timerSec, timerExIdx, day, currentRestSec]);

  // таймер сессии
  useEffect(() => {
    if (!sessionTimerRunning) return;
    sessionTimerRef.current = window.setTimeout(() => {
      setSessionTimerSec((prev) => prev + 1);
    }, 1000);
    return () => {
      if (sessionTimerRef.current !== null) {
        window.clearTimeout(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, [sessionTimerRunning, sessionTimerSec]);

  // таймер между упражнениями
  useEffect(() => {
    if (!interExTimerRunning || interExTimerSec <= 0) return;
    interExTimerRef.current = window.setTimeout(() => {
      setInterExTimerSec((prev) => {
        if (prev <= 1) {
          setInterExTimerRunning(false);
          if (timerSoundSettings.vibrate) hapticNotify('success');
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (interExTimerRef.current !== null) {
        window.clearTimeout(interExTimerRef.current);
        interExTimerRef.current = null;
      }
    };
  }, [interExTimerRunning, interExTimerSec]);

  // Wake Lock для зала — экран не гаснет во время основной фазы тренировки
  useEffect(() => {
    let lock: any = null;
    const req = async () => {
      try {
        if (phase === 'main' && 'wakeLock' in navigator) {
          // @ts-ignore
          lock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };
    if (phase === 'main') req();
    const onVis = () => {
      if (document.visibilityState === 'visible' && phase === 'main' && !lock) req();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      try {
        lock?.release?.();
      } catch {}
    };
  }, [phase]);

  const getRestTime = useCallback(
    (ei: number): number => {
      if (timerPreset === 'custom') return customRestSec;
      const ex = day?.exercises[ei];
      if (!ex) return 90;
      const isCompound = ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'legs'].includes(
        ex.muscleGroup?.toLowerCase() || '',
      );
      if (timerPreset === 'compound') return isCompound ? 180 : 90;
      if (timerPreset === 'isolation') return isCompound ? 120 : 60;
      if (timerPreset === 'pump') return 45;
      return ex.restSec || 90;
    },
    [day, timerPreset, customRestSec],
  );

  const getSupersetRestTime = useCallback((): number => {
    if (circuitMode) return 0; // no rest between exercises in circuit
    // Практика: внутри пары A1→B1 отдыха нет — только переход к снаряду.
    // 30 с «мини-отдыха» делали суперсет обычным упражнением.
    return 15;
  }, [circuitMode]);

  const startRestTimer = useCallback(
    (ei: number) => {
      // В режиме суперсета или круга проверяем, нужно ли запускать таймер
      if (supersetMode || circuitMode) {
        const isInSuperset = supersetExercises.includes(ei);
        if (isInSuperset && supersetExercises.length > 1) {
          const currentIdx = supersetExercises.indexOf(ei);
          const isLastInSuperset = currentIdx === supersetExercises.length - 1;
          if (!isLastInSuperset) {
            setRestAddSec(0);
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
      setRestAddSec(0);
      setTimerSec(rest);
      setTimerRunning(true);
      // Синхронизация виджета таймера на домашнем экране (APK) с отдыхом сессии.
      try {
        void widgetTimerCommand('preset', rest);
      } catch {
        /* web/TG no-op */
      }
    },
    [day, getRestTime, supersetMode, circuitMode, supersetExercises, getSupersetRestTime],
  );

  const skipRestTimer = useCallback(() => {
    setTimerRunning(false);
    setTimerSec(0);
    setTimerExIdx(-1);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startInterExTimer = useCallback((restSec: number = 120) => {
    setInterExTimerSec(restSec);
    setInterExTotalSec(Math.max(1, restSec));
    setInterExTimerRunning(true);
  }, []);

  const skipInterExTimer = useCallback(() => {
    setInterExTimerRunning(false);
    setInterExTimerSec(0);
    if (interExTimerRef.current !== null) {
      window.clearTimeout(interExTimerRef.current);
      interExTimerRef.current = null;
    }
  }, []);

  // Superset/circuit mode handlers
  const toggleSupersetMode = useCallback(() => {
    setSupersetMode((prev) => !prev);
    if (circuitMode) setCircuitMode(false);
    if (!supersetMode) setSupersetExercises([]);
  }, [supersetMode, circuitMode]);

  const toggleCircuitMode = useCallback(() => {
    setCircuitMode((prev) => !prev);
    if (supersetMode) setSupersetMode(false);
    if (!circuitMode) setSupersetExercises([]);
  }, [circuitMode, supersetMode]);

  const toggleExerciseInSuperset = useCallback((ei: number) => {
    setSupersetExercises((prev) => {
      if (prev.includes(ei)) return prev.filter((x) => x !== ei);
      return [...prev, ei].sort((a, b) => a - b);
    });
  }, []);

  /**
   * §8.1: план уже знает пары суперсетов. На старте дня включаем режим и
   * отмечаем ВСЕ размеченные упражнения — иначе A1→B1 выполняются как два
   * отдельных упражнения с полным отдыхом, и суперсет остаётся картинкой.
   * Ручной выбор пользователя не перетираем: применяем только при смене дня
   * или явном старте сессии.
   */
  const applyPlanSupersets = useCallback(() => {
    const exs = day?.exercises || [];
    const idx = exs.map((e, i) => (e.supersetGroup != null ? i : -1)).filter((i) => i >= 0);
    if (idx.length >= 2) {
      setSupersetExercises(idx);
      setSupersetMode(true);
      setCircuitMode(false);
    }
  }, [day]);

  useEffect(() => {
    if (!day?.exercises?.length) return;
    const key = `plan-superset:${String((day as any).label || '')}:${day.exercises.length}`;
    if (autoSupersetKeyRef.current === key) return;
    autoSupersetKeyRef.current = key;
    applyPlanSupersets();
  }, [day, applyPlanSupersets]);

  const timerPct =
    timerRunning && timerSec > 0 && currentRestSec > 0 ? ((currentRestSec - timerSec) / currentRestSec) * 100 : 0;

  const begin = () => {
    if (!day || !Array.isArray(day.exercises)) return;
    // Старт — последний момент перечитать чек-ин (могли заполнить до входа в плеер).
    setReadinessToday(readCheckin());
    // Новая тренировка начинается с чистого листа: скорость, VBT-пересчёт, MMC,
    // прогресс прошлой сессии и таймеры не переезжают в неё (иначе VBT-панель
    // сразу показывала совет по вчерашним подходам).
    setVel({});
    setVbtOverride({});
    setMMCVals({});
    setExerciseProgress({});
    setExDone({});
    setRestHistory([]);
    setVideoNote(null);
    setLogError(null);
    setSessionRPE(7);
    setSessionDur(60);
    durEditedRef.current = false;
    srpeEditedRef.current = false;
    setRestAddSec(0);
    setTimerRunning(false);
    setTimerSec(0);
    setTimerExIdx(-1);
    setWarmupDone({});
    setWarmupTimer(null);
    setCooldownDone({});
    setCoolTimer(null);
    savedRef.current = false;
    // Новый старт сессии — заново применяем разметку суперсетов из плана
    // (пользователь мог выключить режим в прошлый раз).
    autoSupersetKeyRef.current = '';
    applyPlanSupersets();
    // Новая сессия — прошлые раскрытия/свёрнутости не переносим.
    setOpenSet({});
    setEditSet({});
    setDoneMoreOpen(false);
    setWarmupOpen({});
    setCoolOpen({});
    setExOpen({});

    const riskFlags: Record<string, string> = {};
    if (profile.injuries?.length) {
      profile.injuries.forEach((inj) => {
        const m = inj.muscle?.toLowerCase() || '';
        if (m.includes('колен') || m.includes('knee')) riskFlags['knee'] = 'high';
        if (m.includes('плеч') || m.includes('shoulder')) riskFlags['shoulder'] = 'high';
        if (m.includes('спин') || m.includes('поясн') || m.includes('back') || m.includes('lumbar'))
          riskFlags['back'] = 'high';
      });
    }
    const techniqueIssues: string[] = profile.weakPoints?.length
      ? profile.weakPoints
          .map((w) => {
            const wp = String(w).toLowerCase();
            if (wp.includes('back') || wp.includes('поясн') || wp === 'core') return 'rounding_back';
            if (wp.includes('knee') || wp.includes('колен')) return 'knee_valgus';
            if (wp.includes('shoulder') || wp.includes('плеч')) return 'tight_shoulders';
            if (wp.includes('hip') || wp.includes('бёдр') || wp.includes('таз')) return 'tight_hips';
            if (wp.includes('ankle') || wp.includes('голеност')) return 'tight_ankles';
            if (wp.includes('chest') || wp.includes('груд')) return 'tight_chest';
            return '';
          })
          .filter(Boolean)
      : [];
    const warmupInput: WarmupInput = {
      sessionFocus: focus,
      primaryExercises: day.exercises.map((ex) => ex.name),
      primaryWeights: day.exercises.map(
        (ex) =>
          (Array.isArray(ex.targetSets) && ex.targetSets[0]?.weight ? Number(ex.targetSets[0].weight) : null) as any,
      ),
      riskFlags,
      techniqueIssues,
      fatigueLevel: profile.fatigue / 10,
      equipmentAvailable: profile.equipment,
      targetGroups: Array.from(new Set(day.exercises.map((ex) => ex.muscleGroup || '').filter(Boolean))),
      mode: warmupMode,
    };
    setWarmupBlocks(generateWarmup(warmupInput));
    setPhase('warmup');
    setWarmupDone({});
    try {
      localStorage.setItem('he_warmup_mode', warmupMode);
    } catch {}
  };

  const startMain = (): boolean => {
    if (!day || !Array.isArray(day.exercises)) return false;
    // Фиксируем факт разминки в дневник (he_warmup_diary, одна запись на дату)
    try {
      const total = warmupBlocks.reduce((s, b) => s + b.exercises.length, 0);
      const doneCnt = Object.values(warmupDone).filter(Boolean).length;
      const pct = total > 0 ? doneCnt / total : 0;
      const skipped = skipWarmupReasonRef.current;
      upsertWarmupLog({
        date: localIsoDate(),
        done: skipped ? false : doneCnt > 0,
        quality: skipped ? null : doneCnt > 0 ? (pct >= 0.8 ? 4 : pct >= 0.5 ? 3 : 2) : null,
        totalItems: total,
        doneItems: doneCnt,
        skippedReason: skipped || (doneCnt === 0 ? 'не отметил ни одного пункта' : undefined),
      });
      skipWarmupReasonRef.current = null;
    } catch {
      /* дневник разминки недоступен — не блокируем переход */
    }
    // Новая сессия — чистый ввод; веса прошлой тренировки придут подсказкой (prefill).
    // Виджет мог записать подходы до старта (queued set_add при возврате в приложение), и может
    // быть незавершённая тренировка за сегодня. Подхватываем её: старт «с чистого листа»
    // затёр бы эти подходы автосейвом пустой сессии.
    try {
      const activeSession = loadActiveSession();
      // Только своя сессия: тот же день и тот же состав упражнений. Иначе подходы чужого дня
      // «приклеятся» к индексам текущей программы и попадут не в те упражнения.
      const sameDay = !!activeSession && activeSession.date === localIsoDate();
      const samePlan =
        sameDay &&
        (activeSession!.exercises || []).every(
          (ex, i) => !day.exercises[i] || ex.exerciseName === day.exercises[i].name,
        );
      if (samePlan && (activeSession!.exercises || []).some((ex) => (ex.sets || []).length > 0)) {
        resumeSavedSession(activeSession!);
        return true;
      }
    } catch {
      /* ignore */
    }
    // Живая сессия, которую не продолжаем: не затираем её автосейвом пустой новой, а
    // сохраняем в историю. Иначе подходы прошлого дня (или другого дня сегодня) исчезали
    // без следа в дневнике.
    try {
      archiveActiveSession();
    } catch {
      /* архив недоступен — новую тренировку всё равно стартуем */
    }
    setActual({});
    setPrefill({});
    let s = startSession(focus || day.label, weekNumber);
    day.exercises.forEach((ex) => {
      s = addExerciseToSession(s, { id: ex.name, name: ex.name, pattern: ex.muscleGroup, muscleGroup: ex.muscleGroup });
    });
    setSession(s);
    setPhase('main');
    // авто-подтягивание весов из последней сессии (double progression)
    const hydratePrevious = async () => {
      let prevSession: WorkoutSession | null = null;
      try {
        prevSession = await new StrengthDiary().getLastSession();
      } catch {
        prevSession = getLastSession();
      }
      if (!prevSession || prevSession.exercises.length === 0) {
        setPrefill({});
        return;
      }
      const prevMap: Record<string, { weightKg: number; reps: number; rir: number; tempo?: string }[]> = {};
      prevSession.exercises.forEach((ex) => {
        if (ex.exerciseName && Array.isArray(ex.sets)) {
          prevMap[ex.exerciseName.toLowerCase()] = ex.sets.map((st) => ({
            weightKg: st.weightKg,
            reps: st.reps,
            rir: st.rir,
            tempo: st.actualTempo || st.plannedTempo,
          }));
        }
      });
      const prefilled: Record<string, SessionSetValue> = {};
      day.exercises.forEach((ex, ei) => {
        const prevSets = prevMap[ex.name.toLowerCase()];
        if (prevSets && prevSets.length > 0) {
          ex.targetSets.forEach((t, si) => {
            const prev = prevSets[si] || prevSets[prevSets.length - 1];
            if (prev && prev.weightKg > 0) {
              prefilled[`${ei}_${si}`] = {
                weight: prev.weightKg,
                reps: prev.reps,
                rpe: 0,
                rir: prev.rir,
                tempo: prev.tempo,
              };
            }
          });
        }
      });
      setPrefill(prefilled);
    };
    void hydratePrevious();
    setExDone({});
    setRestHistory([]);
    savedRef.current = false;
    // старт таймера сессии
    setSessionTimerSec(0);
    setSessionTimerRunning(true);
    return true;
  };
  // Подписка на событие виджета живёт с узкими deps и иначе звала бы старт из
  // прошлого рендера (старый day/план). Ref всегда указывает на текущую версию.
  const startMainRef = useRef(startMain);
  startMainRef.current = startMain;

  const finish = (): boolean => {
    // Завершение гасит таймеры: иначе отдых/сессия тикают под «Итогом» и время
    // тренировки растёт уже после сохранения.
    try {
      setTimerRunning(false);
      setInterExTimerRunning(false);
      setSessionTimerRunning(false);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (interExTimerRef.current !== null) {
        window.clearTimeout(interExTimerRef.current);
        interExTimerRef.current = null;
      }
      if (sessionTimerRef.current !== null) {
        window.clearTimeout(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    } catch {
      /* таймеры не критичны для сохранения */
    }
    const sess = liveSessionRef.current ?? session;
    if (!sess || !day || !Array.isArray(day.exercises)) return false;
    // Пустую сессию в дневник не пишем: «Завершить» без единого подхода создавало
    // тренировку на 0 сетов и пустой «Итог» без объяснения.
    if (!sess.exercises.some((ex) => (ex.sets || []).length > 0)) {
      clearActiveSession();
      try {
        localStorage.removeItem('he_workout_rest_timer_v1');
      } catch {
        /* ignore */
      }
      setDone(null);
      setDonePlan(null);
      savedRef.current = false;
      setPhase('done');
      return false;
    }
    if (timerSoundSettings.vibrate) hapticNotify('success');
    // Для сессии, начатой сегодня, «стенные» часы точны (и включают паузы). Если её начали
    // вчера и вернулись утром — доверяем таймеру плеера, иначе в историю уедет ~10 часов.
    const sameDayStart = sess.date === localIsoDate();
    const finished = finishSession(sess, `${focus} — ${day?.label}`, sameDayStart ? undefined : sessionDur);
    savedRef.current = true;
    try {
      onSaved?.();
    } catch {
      /* ignore */
    }

    const finishRiskFlags: Record<string, string> = {};
    if (profile.injuries?.length) {
      profile.injuries.forEach((inj) => {
        const m = inj.muscle?.toLowerCase() || '';
        if (m.includes('колен') || m.includes('knee')) finishRiskFlags['knee'] = 'high';
        if (m.includes('плеч') || m.includes('shoulder')) finishRiskFlags['shoulder'] = 'high';
      });
    }
    const cooldownInput: CooldownInput = {
      muscleGroupsUsed: Array.from(new Set(day.exercises.map((ex) => ex.muscleGroup))),
      fatigueScore: profile.fatigue / 10,
      riskFlags: finishRiskFlags,
      sessionDuration: Math.max(finished.durationMin || 0, sessionDur) * 60,
      targetGroups: Array.from(new Set(day.exercises.map((ex) => ex.muscleGroup || '').filter(Boolean))),
    };
    setCooldownBlocks(generateCooldown(cooldownInput));
    setPhase('cooldown');
    setCooldownDone({});
    clearActiveSession();
    try {
      localStorage.removeItem('he_workout_rest_timer_v1');
    } catch {
      /* ignore */
    }
    // sRPE — измеренная нагрузка: пишем только после явного выбора пользователя.
    // Раньше без тапа уезжало стартовое 7/10, и в ACWR попадала выдуманная нагрузка.
    if (srpeEditedRef.current) {
      try {
        saveSRPESession({
          date: finished.date,
          sRPE: sessionRPE,
          durationMin: Math.max(finished.durationMin || 0, sessionDur),
        });
      } catch {
        /* ignore */
      }
    }
    // RIR-калибровка: записываем фактические RIR по подходам
    try {
      recordSessionRIR(finished, {
        exercises: day.exercises.map((ex) => ({ name: ex.name, targetSets: ex.targetSets })),
      });
    } catch {
      /* ignore */
    }
    // MMC-трекинг
    try {
      const mmcEntries = Object.entries(mmcVals).filter(([, v]) => v > 0);
      if (mmcEntries.length > 0) {
        mmcEntries.forEach(([key, val]) => {
          const parts = key.split('_');
          const ei = parseInt(parts[0] || '0');
          const si = parseInt(parts[1] || '0');
          const field = parts[2] || '';
          const exName = day.exercises[ei]?.name || '';
          if (field === 'mmc' || field === 'pump' || field === 'joint' || field === 'energy') {
            recordMMC({
              date: finished.date,
              exerciseId: exName,
              exerciseName: exName,
              setNumber: si,
              mmc: field === 'mmc' ? val : 5,
              pump: field === 'pump' ? val : 5,
              jointDiscomfort: field === 'joint' ? val : 0,
              energy: field === 'energy' ? val : 5,
            });
          }
        });
      }
    } catch {
      /* ignore */
    }
    setDonePlan(
      day.exercises.map((ex) => ({
        name: ex.name,
        sets: (Array.isArray(ex.targetSets) ? ex.targetSets : []).map((t) => ({ weight: t.weight, reps: t.reps })),
      })),
    );
    setDone(finished);
    liveSessionRef.current = null;
    setSession(null);

    // Автообновление кэша прогресса после завершённой сессии
    try {
      const stats = getWorkoutStats();
      cacheSessionStats({
        totalSessions: stats.totalSessions,
        totalVolume: stats.totalVolume,
        totalSets: stats.totalSets,
        totalReps: stats.totalReps,
        prCount: stats.prCount,
        streak: stats.streak,
      });
      const progressItems = finished.exercises
        .map((ex) => {
          const prog = getExerciseProgress(ex.exerciseName, 20);
          if (!prog) return null;
          return {
            exerciseName: prog.exerciseName,
            bestWeight: prog.bestWeight,
            bestReps: prog.bestReps,
            bestE1RM: prog.bestE1RM,
            totalVolume: prog.totalVolume,
            totalSets: prog.totalSets,
            sessions: prog.sessions,
            lastDate: prog.lastDate,
            trend: prog.trend,
            weightDelta: prog.weightDelta,
            e1RMDelta: prog.e1RMDelta,
            cachedAt: Date.now(),
          };
        })
        .filter(Boolean) as CachedProgress[];
      cacheExerciseProgress(progressItems);
    } catch {}
    return true;
  };

  // Подход из виджета пишется в ref синхронно (onWidgetSet), остальные пути — этим эффектом.
  React.useEffect(() => {
    liveSessionRef.current = session;
  }, [session]);
  // Событие из виджета читает finish текущего рендера (session/day не из прошлого).
  finishRef.current = finish;

  const exitSession = (confirmFirst = true) => {
    // Подтверждение, чтобы не потерять незаписанные подходы при случайном тапе.
    // Диалог рисуем сами: window.confirm блокирует WebView и не попадает в тему.
    // Явные кнопки («✓ Завершить тренировку», «✓ Все подходы записаны») подтверждения
    // не требуют — пользователь только что выразил намерение, — но сохраняют
    // подходы так же, как подтверждённый выход.
    const hasLiveSets = !!session && session.exercises.some((e) => (e.sets || []).length > 0);
    if (hasLiveSets && !savedRef.current) {
      if (confirmFirst) setExitConfirm(true);
      else finish();
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
          date: localIsoDate(),
          done: skipped ? false : doneCnt > 0,
          quality: skipped ? null : doneCnt > 0 ? (pct >= 0.8 ? 4 : pct >= 0.5 ? 3 : 2) : null,
          totalItems: total,
          doneItems: doneCnt,
          skippedReason: skipped || (doneCnt === 0 ? 'не отметил ни одного пункта' : undefined),
        });
        skipCooldownReasonRef.current = null;
      } catch {
        /* дневник заминки недоступен — не блокируем выход */
      }
    }
    try {
      localStorage.removeItem('he_workout_rest_timer_v1');
    } catch {
      /* ignore */
    }
    setPhase('done');
  };

  /** Подтверждение в собственном диалоге: сохранить подходы и завершить. */
  const confirmExitAndSave = () => {
    setExitConfirm(false);
    finish();
  };

  // горячие клавиши для быстрого логирования
  useEffect(() => {
    if (phase !== 'main') return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        // Space/Enter записывает подход ОТКРЫТОГО упражнения (если там ещё есть
        // неподтверждённые подходы), иначе первый по дню. Функцию берём из ref:
        // эффект подписан один раз и не должен держать прошлый ввод.
        if (!day || !Array.isArray(day.exercises)) return;
        const order: number[] = [];
        if (currentExIdx >= 0 && currentExIdx < day.exercises.length) order.push(currentExIdx);
        for (let i = 0; i < day.exercises.length; i++) if (i !== currentExIdx) order.push(i);
        for (const ei of order) {
          const sets = day.exercises[ei]?.targetSets || [];
          for (let si = 0; si < sets.length; si++) {
            if (!loggedSet[keyFor(ei, si)]) {
              logOneRef.current(ei, si);
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
  }, [phase, day, loggedSet, timerRunning, timerExIdx]);

  // Живая сессия: автосейв каждого подхода (переживает закрытие приложения).
  React.useEffect(() => {
    if (phase !== 'main' || !session) return;
    const plannedSets = (day?.exercises ?? []).reduce(
      (s, ex) => s + (Array.isArray(ex.targetSets) ? ex.targetSets.length : 0),
      0,
    );
    saveActiveSession(session, plannedSets, { plannedTotalMax: true });
    // Виджеты/пульт в этом же экране перечитывают живое состояние.
    try {
      window.dispatchEvent(new Event('he-workout-live-update'));
    } catch {
      /* noop */
    }
    // Живой прогресс на homescreen-виджет (АПК), троттлинг 5с.
    const now = Date.now();
    if (now - widgetPushRef.current > 5000) {
      widgetPushRef.current = now;
      void import('../../native/widget-sync')
        .then((m) => {
          void m.pushTrainingWidget();
          void m.pushWorkoutWidget();
        })
        .catch(() => {
          /* web/TG — виджетов нет */
        });
    }
  }, [phase, session]);

  // Автосейв таймера отдыха живой сессии (восстановление после сворачивания).
  React.useEffect(() => {
    if (phase !== 'main') return;
    try {
      localStorage.setItem(
        'he_workout_rest_timer_v1',
        JSON.stringify({
          remainingSec: timerSec,
          running: timerRunning,
          timerExIdx,
          restAddSec,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* ignore */
    }
  }, [phase, timerSec, timerRunning, timerExIdx, restAddSec]);

  // Завершение/сброс — живой сессии нет, пульт показывает последнюю тренировку.
  React.useEffect(() => {
    try {
      window.dispatchEvent(new Event('he-workout-live-update'));
    } catch {
      /* noop */
    }
  }, [phase]);

  const toggleWarmup = (blockIdx: number, exIdx: number) => {
    const id = `w_${blockIdx}_${exIdx}`;
    setWarmupDone((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCooldown = (blockIdx: number, exIdx: number) => {
    const id = `c_${blockIdx}_${exIdx}`;
    setCooldownDone((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const keyFor = (ei: number, si: number) => `${ei}_${si}`;

  // Какое упражнение идёт сейчас: первое, где остались незаписанные подходы.
  // Остальные в зале нужны шапкой — полный редактор у них держим свёрнутым.
  const currentExIdx = useMemo(() => {
    if (!day || !Array.isArray(day.exercises)) return -1;
    return day.exercises.findIndex((ex, ei) => (ex.targetSets || []).some((_, si) => !loggedSet[`${ei}_${si}`]));
  }, [day, loggedSet]);

  // В зале, закрыв последний подход упражнения, экран сам едет к следующему:
  // иначе оно остаётся ниже сгиба и его приходится искать прокруткой.
  const exHeadRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const prevExIdxRef = useRef<number>(-1);
  useEffect(() => {
    if (phase !== 'main' || currentExIdx < 0) {
      prevExIdxRef.current = currentExIdx;
      return;
    }
    const from = prevExIdxRef.current;
    prevExIdxRef.current = currentExIdx;
    // Вход в «Основную» и ручное раскрытие — не повод дёргать экран.
    if (from < 0 || from === currentExIdx) return;
    try {
      exHeadRefs.current[currentExIdx]?.scrollIntoView?.({ block: 'start', behavior: 'smooth' as ScrollBehavior });
    } catch {
      /* jsdom/SSR */
    }
  }, [currentExIdx, phase]);

  // Сколько подходов дня уже записано — для явного «всё закрыто, к заминке».
  const mainProgress = useMemo(() => {
    if (!day || !Array.isArray(day.exercises)) return { totalSets: 0, doneSets: 0 };
    let totalSets = 0;
    let doneSets = 0;
    day.exercises.forEach((ex, ei) => {
      const sets = ex.targetSets || [];
      totalSets += sets.length;
      doneSets += sets.filter((_, si) => !!loggedSet[keyFor(ei, si)]).length;
    });
    return { totalSets, doneSets };
  }, [day, loggedSet]);

  /**
   * Записать подход. `ov` — значения, которые ещё не успели попасть в state
   * (быстрый ввод, пульт): без него чтение `vals` вернёт прошлый рендер.
   */
  const logOne = (
    ei: number,
    si: number,
    ov?: { weight: number; reps: number; rpe?: number; rir?: number; tempo?: string },
  ): boolean => {
    if (!session || !day || !Array.isArray(day.exercises)) return false;
    hapticImpact('light');
    const ex = day.exercises[ei];
    if (!ex) return false;
    const ts = Array.isArray(ex.targetSets) ? ex.targetSets[si] : null;
    const t = ts || {
      weight: weightFor(ex) || 60,
      reps: repsFor(ex) || 10,
      rir: rirFor(ex) ?? 2,
      tempo: undefined as string | undefined,
    };
    const plannedTempo = tempoText(t.tempo);
    const a0 = ov
      ? { weight: ov.weight, reps: ov.reps, rpe: ov.rpe ?? 0, rir: ov.rir, tempo: ov.tempo }
      : vals[keyFor(ei, si)] || { weight: vbtOverride[keyFor(ei, si)] ?? t.weight, reps: t.reps, rpe: 0 };
    // RPE пишем только измеренный: явно введённый или пересчитанный из ВВЕДЁННОГО RIR.
    // За ввод считаем `actual` (или явный override), а не `vals`: там лежит ещё и
    // подсказка из прошлой тренировки, и плановый RIR — прескрипция, а не факт.
    const enteredRaw = ov ? { rpe: ov.rpe ?? 0, rir: ov.rir } : actual[keyFor(ei, si)];
    const enteredRpe = Number(enteredRaw?.rpe) || 0;
    const enteredRir = typeof enteredRaw?.rir === 'number' ? enteredRaw.rir : undefined;
    const measuredRpe =
      enteredRpe > 0 ? enteredRpe : enteredRir != null && enteredRir <= 10 ? Math.max(0, 10 - enteredRir) : 0;
    // В `actual` не наследуем плановый/прошлый RIR: иначе повторное «✓» прочитало бы
    // прескрипцию как измерение и записало RPE, которого пользователь не вводил.
    const a = { weight: a0.weight, reps: a0.reps, rpe: measuredRpe, rir: enteredRir, tempo: a0.tempo };
    const previousBestWeight = getCachedProgressForExercise(ex.name)?.bestWeight || undefined;
    // Повторное «✓» по тому же сету = ПРАВКА подхода, а не второй подход:
    // сначала убираем прежнюю запись с этим setNumber, потом пишем новую.
    // (logSet всегда append — без этого двойной тап удваивал подход и объём.)
    const alreadyLogged = !!loggedSet[keyFor(ei, si)];
    const base = alreadyLogged ? withoutSetNumber(session, ei, si + 1) : session;
    const res = logSet(
      base,
      ei,
      {
        setNumber: si + 1,
        weightKg: a.weight,
        bodyweight: planIsBodyweight(ex, t.weight) && !(Number(a.weight) > 0),
        reps: a.reps,
        rpe: measuredRpe,
        rir: enteredRir ?? 0,
        // VBT-факт: скорость штанги этого подхода (м/с) — пишется в дневник,
        // чтобы отчёты «план vs факт» считали потерю скорости ПО ФАКТУ.
        velocityMs: vel[keyFor(ei, si)],
        notes: '',
        plannedWeight: t.weight,
        plannedReps: t.reps,
        plannedRir: t.rir,
        plannedTempo,
        actualTempo: a.tempo?.trim() || undefined,
      },
      previousBestWeight,
    );
    // Валидация движка (вес 0, вес/повторы сверх лимитов) больше не глотается:
    // иначе подход выглядел записанным, а в сессию не попадал.
    if (!res.success) {
      setLogError({ key: keyFor(ei, si), msg: res.reason || 'Подход не записан' });
      return false;
    }
    setLogError(null);
    setSession(res.session);
    setActual((prev) => ({ ...prev, [keyFor(ei, si)]: a }));
    // Правка сохранена — подход снова сворачивается в одну строку.
    setEditSet((p) => {
      if (!p[keyFor(ei, si)]) return p;
      const n = { ...p };
      delete n[keyFor(ei, si)];
      return n;
    });
    // обновляем прогресс упражнения (только для ПЕРВОЙ записи сета)
    if (!alreadyLogged) {
      setExerciseProgress((prev) => {
        const total = ex.targetSets.length;
        const completed = Object.keys(prev).filter((k) => k.startsWith(`${ei}_`) && prev[k]).length;
        return { ...prev, [String(ei)]: { completed: Math.min(completed + 1, total), total } };
      });
    }
    // авто-старт таймера отдыха после подхода
    if (autoStartRest) {
      startRestTimer(ei);
    }
    return true;
  };

  // logOne объявлен ниже обработчика хоткеев — держим актуальную версию в ref.
  logOneRef.current = logOne;

  /** Продолжить автосохранённую тренировку: восстанавливаем подходы и таймер. */
  const resumeSavedSession = (saved: WorkoutSession) => {
    if (!day || !Array.isArray(day.exercises)) return;
    // Подходы привязываем ПО ИМЕНИ упражнения, а не по индексу: автосейв мог быть сделан
    // в другой день или в другую версию плана, и тогда подход «приклеивался» к чужому
    // упражнению по совпадению номера.
    const byName = new Map<string, WorkoutSession['exercises'][number]>();
    (saved.exercises || []).forEach((ex) => {
      const key = normalizeExerciseName(ex.exerciseName || '');
      if (key && !byName.has(key)) byName.set(key, ex);
    });
    // Сессию пересобираем в порядке текущего дня: движок пишет подход по индексу
    // упражнения дня, поэтому порядок обязан совпадать с планом.
    let rebuiltSession = startSession(saved.focus || focus || day.label, saved.weekNumber ?? weekNumber);
    day.exercises.forEach((ex) => {
      rebuiltSession = addExerciseToSession(rebuiltSession, {
        id: ex.name,
        name: ex.name,
        pattern: ex.muscleGroup,
        muscleGroup: ex.muscleGroup,
      });
    });
    const rebuilt: Record<string, { weight: number; reps: number; rpe: number; rir?: number; tempo?: string }> = {};
    const progress: Record<string, { completed: number; total: number }> = {};
    /** Подход из автосейва → пересобранная сессия: `ei` — упражнение дня, номер сета — свой. */
    const applySavedSet = (ei: number, st: WorkoutSession['exercises'][number]['sets'][number], i: number) => {
      const sn = Number(st.setNumber);
      const si = Number.isFinite(sn) && sn > 0 ? sn - 1 : i;
      // Ключ — по setNumber, а не по индексу массива: иначе после правки сета
      // (withoutSetNumber → порядок меняется) значения попадают к чужому подходу.
      const res = logSet(rebuiltSession, ei, {
        setNumber: si + 1,
        weightKg: st.weightKg,
        reps: st.reps,
        rpe: st.rpe,
        rir: st.rir,
        notes: st.notes || '',
        techniqueScore: st.techniqueScore,
        plannedWeight: st.plannedWeight,
        plannedReps: st.plannedReps,
        plannedRir: st.plannedRir,
        plannedTempo: st.plannedTempo,
        actualTempo: st.actualTempo,
        velocityMs: st.velocityMs,
        pause: st.pause,
        bodyweight: st.bodyweight,
      });
      if (!res.success) return;
      rebuiltSession = res.session;
      rebuilt[keyFor(ei, si)] = {
        weight: st.weightKg,
        reps: st.reps,
        rpe: st.rpe,
        rir: st.rir,
        tempo: st.actualTempo || st.plannedTempo,
      };
    };
    day.exercises.forEach((dex, ei) => {
      const source = byName.get(normalizeExerciseName(dex.name || ''));
      const sets = (source?.sets || []).slice().sort((a, b) => Number(a.setNumber) - Number(b.setNumber));
      sets.forEach((st, i) => applySavedSet(ei, st, i));
      const planned = dex.targetSets?.length ?? sets.length;
      progress[String(ei)] = { completed: Math.min(sets.length, planned), total: planned };
    });
    // Упражнений, которых в плане дня больше нет, не теряем: их подходы уже записаны,
    // а автосейв ниже перезапишет живую сессию. Дописываем их в конец сессии — в интерфейсе
    // текущего дня их нет, но в дневник они попадут.
    const dayNames = new Set(day.exercises.map((dex) => normalizeExerciseName(dex.name || '')).filter((n) => !!n));
    (saved.exercises || []).forEach((ex) => {
      const key = normalizeExerciseName(ex.exerciseName || '');
      const sets = (ex.sets || []).slice().sort((a, b) => Number(a.setNumber) - Number(b.setNumber));
      if (!key || dayNames.has(key) || sets.length === 0) return;
      const ei = rebuiltSession.exercises.length;
      rebuiltSession = addExerciseToSession(rebuiltSession, {
        id: ex.exerciseId || ex.exerciseName,
        name: ex.exerciseName,
        pattern: ex.pattern,
        muscleGroup: ex.muscleGroup,
      });
      sets.forEach((st, i) => applySavedSet(ei, st, i));
    });
    // Идентичность сессии — из автосейва: иначе продолжение вчерашней тренировки
    // получало новый sessionId и дублировало запись в дневнике.
    rebuiltSession = {
      ...rebuiltSession,
      sessionId: saved.sessionId,
      date: saved.date,
      startTime: saved.startTime,
      focus: saved.focus || rebuiltSession.focus,
    };
    setActual(rebuilt);
    setExerciseProgress(progress);
    setExDone({});
    setRestHistory([]);
    setWarmupDone({});
    savedRef.current = false;
    // Честное продолжение: таймер сессии на входе — время, прошедшее с startTime,
    // но только для СЕГОДНЯШНЕЙ сессии. Вчерашняя иначе «начисляла» часы сна
    // (14 часов в дневнике и в sRPE-нагрузке): её таймер стартует с 0.
    try {
      const sameDayStart = String(saved.date || '') === localIsoDate();
      const parts = String(saved.startTime || '')
        .split(':')
        .map(Number);
      if (sameDayStart && parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parts[0], parts[1], 0, 0).getTime();
        const elapsed = Math.max(0, Math.min(86400, Math.round((now.getTime() - start) / 1000)));
        if (elapsed > 0) setSessionTimerSec(elapsed);
      }
    } catch {
      /* startTime — сырая строка, не фатально */
    }
    setSessionTimerRunning(true);
    setSession(rebuiltSession);
    setResumeFrom(null);
    try {
      const raw = localStorage.getItem('he_workout_rest_timer_v1');
      if (raw) {
        const t = JSON.parse(raw);
        if (t && typeof t.remainingSec === 'number') {
          setTimerSec(Math.max(0, t.remainingSec));
          setTimerRunning(!!t.running);
          setTimerExIdx(typeof t.timerExIdx === 'number' ? t.timerExIdx : -1);
          setRestAddSec(typeof t.restAddSec === 'number' ? t.restAddSec : 0);
        }
      }
    } catch {
      /* ignore */
    }
    // План дня мог измениться: знаменатель прогресса берём от ТЕКУЩЕГО дня, иначе
    // 12/12 показывалось как 12/20 по старому плану. Право на max остаётся у автосейвов
    // виджета — здесь его нет осознанно.
    try {
      const dayPlanned = day.exercises.reduce((n, ex) => n + (ex.targetSets?.length ?? 0), 0);
      saveActiveSession(rebuiltSession, dayPlanned);
    } catch {
      /* автосейв не критичен */
    }
    setPhase('main');
  };

  // ── Быстрый сет из дока/виджета («+ Сет» без прокрутки к подходу) ──
  React.useEffect(() => {
    const onQuickSet = (ev?: Event) => {
      if (!day || !Array.isArray(day.exercises)) return;
      if (phase !== 'main') {
        // «＋ Сет» с нативного виджета может прийти в фазу ready (сессия ещё не
        // начата) — раньше запрос молча терялся. Стартуем основную часть и
        // доводим подход, когда сессия появится.
        if (phase === 'ready' && pendingQuickRef.current === undefined) {
          pendingQuickRef.current = ev ?? null;
          startMain();
        }
        return;
      }
      for (let ei = 0; ei < day.exercises.length; ei++) {
        for (let si = 0; si < day.exercises[ei].targetSets.length; si++) {
          if (!loggedSet[keyFor(ei, si)]) {
            // Пульту отвечаем только при реальной записи: отказ движка (лимит веса,
            // нулевой вес) раньше считался успехом и виджет показывал фантомный сет.
            const ok = logOne(ei, si);
            (ev as CustomEvent | undefined)?.detail?.handled?.(ok);
            return;
          }
        }
      }
      // Свободных подходов не осталось — отвечаем явным отказом, иначе виджет
      // считает, что запрос не дошёл, и открывает сессию повторно.
      (ev as CustomEvent | undefined)?.detail?.handled?.(false);
    };
    window.addEventListener('he-workout-quick-set', onQuickSet as EventListener);
    return () => window.removeEventListener('he-workout-quick-set', onQuickSet as EventListener);
  }, [phase, day, loggedSet, logOne]);

  // «Готово»/закрытие карточки: плеер не размонтируется (прячется display:none),
  // поэтому итог прошлой тренировки надо сбросить самим — иначе следующее
  // открытие показывало старый отчёт вместо кнопки старта.
  React.useEffect(() => {
    const onClose = () => {
      setPhase('ready');
      setDone(null);
      setDonePlan(null);
      setSession(null);
      pendingQuickRef.current = undefined;
      setActual({});
      setPrefill({});
      setVel({});
      setVbtOverride({});
      setMMCVals({});
      setExerciseProgress({});
      setExDone({});
      setRestHistory([]);
      setVideoNote(null);
      setLogError(null);
      setWarmupDone({});
      setCooldownDone({});
      setWarmupTimer(null);
      setCoolTimer(null);
      setSessionRPE(7);
      setSessionDur(60);
      durEditedRef.current = false;
      srpeEditedRef.current = false;
      setTimerRunning(false);
      setTimerSec(0);
      setTimerExIdx(-1);
      setRestAddSec(0);
      setSessionTimerRunning(false);
      setSessionTimerSec(0);
      savedRef.current = false;
      try {
        setResumeFrom(loadActiveSession());
      } catch {
        setResumeFrom(null);
      }
    };
    window.addEventListener('he-workout-close', onClose);
    return () => window.removeEventListener('he-workout-close', onClose);
  }, []);

  // Отложенный «+ Сет» (пришёл до старта сессии): записываем первый
  // незаписанный подход, как только сессия реально появилась, и только тогда
  // подтверждаем пульту, что запрос обработан.
  React.useEffect(() => {
    if (phase !== 'main' || !session || pendingQuickRef.current === undefined) return;
    const ev = pendingQuickRef.current;
    pendingQuickRef.current = undefined;
    if (!day || !Array.isArray(day.exercises)) return;
    for (let ei = 0; ei < day.exercises.length; ei++) {
      const sets = day.exercises[ei]?.targetSets || [];
      for (let si = 0; si < sets.length; si++) {
        if (!loggedSet[keyFor(ei, si)]) {
          const ok = logOne(ei, si);
          (ev as CustomEvent | undefined)?.detail?.handled?.(ok);
          return;
        }
      }
    }
    (ev as CustomEvent | undefined)?.detail?.handled?.(false);
  }, [phase, session, day, loggedSet, logOne]);

  // Подход из нативного виджета, пока плеер открыт: виджет не пишет в хранилище сам,
  // а просит плеер записать подход — иначе следующий автосейв плеера сотрёт его.
  React.useEffect(() => {
    const onWidgetSet = (ev: Event) => {
      const d = (ev as CustomEvent | undefined)?.detail as any;
      if (!d || !d.exerciseName) return;
      if (phase !== 'main' || !session || !day || !Array.isArray(day.exercises)) return;
      // Очередь виджета разбирается синхронно: два подхода в одном дренаже пришли бы
      // с одной и той же сессией из замыкания, и второй затёр бы первый. Живую версию
      // держит ref (обновляется прямо в обработчике).
      const live = liveSessionRef.current ?? session;
      const want = normalizeExerciseName(String(d.exerciseName));
      const ei = day.exercises.findIndex((ex) => normalizeExerciseName(ex.name) === want);
      if (ei < 0) return;
      const ex = day.exercises[ei];
      const prevSets = live.exercises[ei]?.sets || [];
      const nextNum = prevSets.reduce((m, s) => Math.max(m, Number(s.setNumber) || 0), 0) + 1;
      const weight = Math.max(0, Number(d.weight) || 0);
      const reps = Math.max(0, Math.round(Number(d.reps) || 0));
      const rirRaw = Number(d.rir);
      const rir = Number.isFinite(rirRaw) && rirRaw > 0 ? Math.min(20, rirRaw) : 0;
      const rpeRaw = Number(d.rpe);
      const rpe = Number.isFinite(rpeRaw) && rpeRaw > 0 ? Math.min(10, rpeRaw) : rir > 0 ? Math.max(0, 10 - rir) : 0;
      const techRaw = Number(d.technique);
      const techniqueScore = Number.isFinite(techRaw) && techRaw >= 3 && techRaw <= 5 ? Math.round(techRaw) : undefined;
      const planWeight = Number(ex.targetSets?.[0]?.weight) || 0;
      const res = logSet(live, ei, {
        setNumber: nextNum,
        weightKg: weight,
        bodyweight: planIsBodyweight(ex, planWeight) && weight <= 0,
        reps,
        rpe,
        rir,
        notes: String(d.notes ?? '').slice(0, 200),
        techniqueScore,
        pause: d.pause === true,
        plannedWeight: planWeight || undefined,
      });
      if (!res.success) return;
      liveSessionRef.current = res.session;
      // Пишем сразу: если приложение убьют до автосейва, подход не потеряется.
      const dayPlanned = (day?.exercises ?? []).reduce(
        (acc, e) => acc + (Array.isArray(e.targetSets) ? e.targetSets.length : 0),
        0,
      );
      let persisted = true;
      try {
        // План ДНЯ, а не подходы одного упражнения (раньше знаменатель прогресса
        // живой сессии был чужим), и без уменьшения уже записанного плана.
        persisted = saveActiveSession(res.session, dayPlanned, { plannedTotalMax: true });
      } catch {
        persisted = false;
      }
      if (!persisted) {
        // Квота/приватный режим: подход остался только в памяти. Молча рапортовать
        // виджету успех нельзя — при закрытии приложения он исчезнет без следа.
        setLogError({
          key: keyFor(ei, nextNum - 1),
          msg: 'Не хватило места в хранилище: подход только в памяти — завершите тренировку, чтобы сохранить',
        });
      }
      // Подход с пульта должен появиться в полях редактора: иначе повторный тап
      // отправил бы план вместо фактически записанного сета.
      setActual((prev) => ({
        ...prev,
        [keyFor(ei, nextNum - 1)]: { weight, reps, rpe, rir, tempo: undefined },
      }));
      setSession(res.session);
      setExerciseProgress((prev) => {
        const total = ex.targetSets?.length || prevSets.length + 1;
        const completed = Math.min(prevSets.length + 1, total);
        return { ...prev, [String(ei)]: { completed, total } };
      });
      d.handled = persisted;
    };
    window.addEventListener('he-workout-widget-set', onWidgetSet as EventListener);
    return () => window.removeEventListener('he-workout-widget-set', onWidgetSet as EventListener);
  }, [phase, session, day]);

  // Старт тренировки из виджета, пока плеер открыт: реле с detail.handled — ведём
  // сессию как «К основной части» (startMain подхватит незавершённую тренировку).
  React.useEffect(() => {
    const onWidgetStart = (ev: Event) => {
      const d = (ev as CustomEvent | undefined)?.detail as any;
      if (!d) return;
      // Плеер не размонтируется и после завершения (итог/заминка). Если принять старт
      // только в ready, виджет не получит handled и попробует сохранить сессию без
      // подходов — saveActiveSession вернёт false, и тап «Начать» пропадёт.
      if (phase === 'cooldown' || phase === 'done') {
        try {
          window.dispatchEvent(new Event('he-workout-close'));
        } catch {
          /* ignore */
        }
      }
      if (phase === 'main') {
        // Сессия уже идёт: подтверждаем, иначе виджет откатится на кнопку «Начать».
        d.handled = !!liveSessionRef.current || !!session;
        return;
      }
      // Отвечаем «обработано» только если плеер реально стартовал: иначе виджет
      // обязан поднять сессию сам, чтобы тап «Начать тренировку» не пропал.
      const started = startMainRef.current() === true;
      // Сброс выше шёл событием he-workout-close, а его слушают TrainingScreen и
      // ExecutionZone и сворачивают карточку плеера. Возвращаем карточку на экран,
      // иначе стартовавшая сессия идёт невидимой, а виджет при этом рапортует успех.
      if (started && (phase === 'cooldown' || phase === 'done')) {
        try {
          window.dispatchEvent(new Event('he-workout-open'));
        } catch {
          /* ignore */
        }
      }
      d.handled = started;
    };
    window.addEventListener('he-workout-widget-start', onWidgetStart as EventListener);
    return () => window.removeEventListener('he-workout-widget-start', onWidgetStart as EventListener);
  }, [phase, session]);

  // Завершение из виджета, пока плеер открыт: виджет не завершает сессию сам, иначе теряется
  // всё, что умеет только плеер — длительность, sRPE, RIR-калибровка, заминка.
  React.useEffect(() => {
    const onFinishRequest = (ev: Event) => {
      const d = (ev as CustomEvent | undefined)?.detail as any;
      if (!d) return;
      const live = liveSessionRef.current ?? session;
      if (!live || !live.exercises.some((ex) => (ex.sets || []).length > 0)) return;
      // handled — только по факту: finish() возвращает false, если завершить не смог,
      // и тогда виджет завершит сессию сам, а не останется в подвешенном состоянии.
      d.handled = finishRef.current?.() === true;
    };
    window.addEventListener('he-workout-finish-request', onFinishRequest as EventListener);
    return () => window.removeEventListener('he-workout-finish-request', onFinishRequest as EventListener);
  }, [session]);

  // Пока плеер смонтирован, он единственный писатель активной сессии (см. widget-sync).
  React.useEffect(() => {
    let mod: any = null;
    let alive = true;
    void import('../../native/widget-sync')
      .then((m) => {
        mod = m;
        if (alive) m.setWorkoutPlayerActive?.(true);
      })
      .catch(() => {
        /* web: моста нет */
      });
    return () => {
      alive = false;
      try {
        mod?.setWorkoutPlayerActive?.(false);
      } catch {
        /* ignore */
      }
    };
  }, []);

  // batch skip: залогировать планом ОСТАВШИЕСЯ подходы упражнения.
  // Раньше через logSet прогонялись ВСЕ targetSets, а logSet append-only →
  // уже записанные подходы дублировались (1,2,3,1,2) и завышали подходы,
  // тоннаж и 1ПМ (P0-3). Теперь записанный подход не трогаем, введённые
  // вес/повторы сохраняем, планом добиваем только пустые.
  const skipExercise = useCallback(
    (ei: number) => {
      if (!session || !day || !Array.isArray(day.exercises)) return;
      const ex = day.exercises[ei];
      if (!ex || !Array.isArray(ex.targetSets)) return;
      hapticImpact('light');
      let s = session;
      const newActual: Record<string, SessionSetValue> = {};
      ex.targetSets.forEach((t, si) => {
        const k = keyFor(ei, si);
        if (loggedSet[k]) return;
        const plannedTempo = tempoText(t.tempo);
        const entered = actual[k];
        const a = {
          weight: entered?.weight ?? t.weight,
          reps: entered?.reps ?? t.reps,
          // Пропуск упражнения RPE не измеряет: план (RIR) за факт не выдаём.
          rpe: entered?.rpe || 0,
          rir: entered?.rir,
          tempo: entered?.tempo ?? plannedTempo,
        };
        // Массовый пропуск тоже уважает валидацию движка: сет, который он отверг
        // (вес 0 / сверх лимита), не помечается выполненным.
        const r = logSet(s, ei, {
          setNumber: si + 1,
          weightKg: a.weight,
          bodyweight: planIsBodyweight(ex, t.weight) && !(Number(a.weight) > 0),
          reps: a.reps,
          rpe: entered?.rpe && entered.rpe > 0 ? entered.rpe : 0,
          rir: entered?.rir ?? 0,
          notes: '',
          plannedWeight: t.weight,
          plannedReps: t.reps,
          plannedRir: t.rir,
          plannedTempo,
          actualTempo: a.tempo,
        });
        if (!r.success) return;
        s = r.session;
        newActual[k] = a;
      });
      setSession(s);
      setActual((prev) => ({ ...prev, ...newActual }));
    },
    [session, day, loggedSet, actual],
  );

  // Fallback helpers when targetSets is missing (legacy cache)
  const weightFor = (ex: any) => ex?.targetSets?.[0]?.weight ?? ex?.weight ?? 60;
  const repsFor = (ex: any) => ex?.targetSets?.[0]?.reps ?? ex?.reps ?? 10;
  const rirFor = (ex: any) => ex?.targetSets?.[0]?.rir ?? ex?.rir ?? 2;

  // «Калькулятор блинов» → применить доступный вес к выбранному упражнению
  // (вес подставляется только в НЕзалогированные сеты; выполненные не трогаются)
  const applyPlateWeight = useCallback(
    (w: number, exId?: string) => {
      if (!day || !Array.isArray(day.exercises)) return;
      const ei = exId != null && exId !== '' ? Number(exId) : NaN;
      if (!Number.isFinite(ei) || !day.exercises[ei]) return;
      const ex = day.exercises[ei];
      setActual((prev) => {
        const next = { ...prev };
        (Array.isArray(ex.targetSets) ? ex.targetSets : []).forEach((t, si) => {
          const k = keyFor(ei, si);
          if (loggedSet[k]) return; // подход уже записан
          const existing = next[k] ?? prefill[k];
          next[k] = { weight: w, reps: existing?.reps ?? t.reps, rpe: 0 };
        });
        return next;
      });
    },
    [day, loggedSet, prefill],
  );

  // Плановые метрики дня
  const planned = useMemo(() => {
    if (!day) return { sets: 0, volume: 0 };
    let sets = 0,
      vol = 0;
    day.exercises.forEach((ex) =>
      ex.targetSets.forEach((t) => {
        sets++;
        vol += t.weight * t.reps;
      }),
    );
    return { sets, volume: Math.round(vol) };
  }, [day]);

  // Фактические метрики сессии
  const factVol = useMemo(() => {
    const src = session || done;
    if (!src) return { volume: 0, sets: 0 };
    let v = 0,
      n = 0;
    src.exercises.forEach((ex) =>
      ex.sets.forEach((s) => {
        v += s.weightKg * s.reps;
        n++;
      }),
    );
    return { volume: Math.round(v), sets: n };
  }, [session, done]);

  // 1.4: оценка e1RM (Epley) по лучшему сету сессии
  const topE1RM = useMemo(() => {
    const src = done || session;
    if (!src) return { e1rm: 0, exercise: '', weight: 0, reps: 0 };
    let best = { e1rm: 0, exercise: '', weight: 0, reps: 0 };
    src.exercises.forEach((ex) =>
      ex.sets.forEach((s) => {
        if (s.weightKg > 0 && s.reps > 0) {
          const e = Math.round(s.weightKg * (1 + s.reps / 30));
          if (e > best.e1rm) best = { e1rm: e, exercise: ex.exerciseName, weight: s.weightKg, reps: s.reps };
        }
      }),
    );
    return best;
  }, [done, session]);

  // 1.5: сравнение с предыдущей сессией
  const sessionComparison = useMemo(() => {
    if (!done) return null;
    try {
      return compareWithPrevious(done);
    } catch {
      return null;
    }
  }, [done]);

  // 1.6: per-exercise delta vs best (из кэша)
  const exerciseBestDeltas = useMemo(() => {
    if (!done || !day) return [];
    return day.exercises
      .map((ex, ei) => {
        const cached = getCachedProgressForExercise(ex.name);
        const sesEx = done.exercises[ei];
        if (!sesEx || !sesEx.sets.length || !cached) return null;
        const bestE1RM = Math.max(...sesEx.sets.map((s) => Math.round(s.weightKg * (1 + s.reps / 30))));
        const delta = bestE1RM - cached.bestE1RM;
        return {
          name: ex.name,
          currentBest: bestE1RM,
          prevBest: cached.bestE1RM,
          delta,
          sessions: cached.sessions,
          trend: cached.trend,
        };
      })
      .filter(Boolean) as {
      name: string;
      currentBest: number;
      prevBest: number;
      delta: number;
      sessions: number;
      trend: string;
    }[];
  }, [done, day]);

  // «Следующая сессия» считается движком отчёта, как в дневнике: совет строится
  // от фактического лучшего подхода, а не от targetSets плана — иначе «Итог»
  // и дневник советовали по одной тренировке разное.
  const nextPlan = useMemo(
    () => (done ? buildNextSessionPlan(buildWorkoutSummary([sessionToWorkoutLog(done)]), 8) : []),
    [done],
  );

  const anyDeload = nextPlan.some((s) => s.kind === 'deload');

  // RIR-калибровка: фидбек по сессии
  const rirFeedback = useMemo(() => {
    if (!done || !day) return null;
    try {
      return getSessionRIRFeedback(done, {
        exercises: day.exercises.map((ex) => ({ name: ex.name, targetSets: ex.targetSets })),
      });
    } catch {
      return null;
    }
  }, [done, day]);

  // Метрики фактической сессии (Тоннаж/КПШ/Инт.отн/УОИ/Инт.Ф+Б) — считаются для done-состояния
  const lms = useMemo(() => computeSessionMetrics(done, day), [done, day]);
  // «Итог»: подробности (RIR, метрики, PR, отдых, сравнение) — под одним тогглом,
  // и только если им действительно есть что показать.
  const hasDoneDetails =
    (rirFeedback?.exerciseFeedbacks.length ?? 0) > 0 ||
    !!lms ||
    prs.length > 0 ||
    restHistory.length > 0 ||
    !!sessionComparison?.older ||
    exerciseBestDeltas.length > 0;

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
    if (p === 'ready') {
      if (!session) setPhase('ready');
      return;
    }
    // Назад в разминку при живой сессии нельзя: «К основной части» тогда
    // стартовало бы сессию заново и стёрло записанные подходы.
    if (p === 'warmup') {
      if (session) return;
      if (warmupBlocks.length === 0) begin();
      else setPhase('warmup');
      return;
    }
    if (p === 'main') {
      if (phase === 'warmup') startMain();
      else if (phase === 'main') {
        /* уже там */
      }
      return;
    }
    // Пустую сессию (ни одного подхода) в дневник не пишем: раньше заминка из
    // «Итога» без данных сохраняла тренировку на 0 сетов.
    if (p === 'cooldown') {
      const hasSets = !!session && session.exercises.some((ex) => (ex.sets || []).length > 0);
      if (hasSets) finish();
      else if (phase === 'ready') return;
      else setPhase('cooldown');
      return;
    }
    if (p === 'done') {
      if (!session && !done) return;
      exitSession();
      return;
    }
  };

  return (
    <div className="session-player">
      <style>{timerAnimationStyle}</style>
      {/* Шапка недели — одной строкой. Сетка 7 дней была декором (никуда не
          ведёт) и съедала ~80px перед кнопкой старта; при одном дне в плане
          строка «выбор дня» ниже тоже не нужна. */}
      {(() => {
        const totalWeeklySets = days.reduce(
          (s: number, d: any) => s + d.exercises.reduce((ss: number, e: any) => ss + (e.targetSets?.length || 0), 0),
          0,
        );
        const totalWeeklyVol = days.reduce(
          (s: number, d: any) =>
            s +
            d.exercises.reduce(
              (ss: number, e: any) =>
                ss + e.targetSets.reduce((sss: number, t: any) => sss + (t.weight || 0) * (t.reps || 0), 0),
              0,
            ),
          0,
        );
        return (
          <div
            data-session="week"
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#00e68a',
                padding: '2px 7px',
                borderRadius: 20,
                background: 'rgba(0,230,138,0.10)',
                border: '1px solid rgba(0,230,138,0.20)',
              }}
            >
              Неделя {weekNumber}
              {focus ? ` · ${focus}` : ''}
            </span>
            <span style={{ fontSize: 10, color: '#fff' }}>
              {ruCount(totalWeeklySets, RU_SETS)} · {totalWeeklyVol.toLocaleString()} кг · {days[dayIdx]?.label || ''}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 20,
                background: 'rgba(0,230,138,0.10)',
                color: '#00e68a',
                border: '1px solid rgba(0,230,138,0.18)',
                whiteSpace: 'nowrap',
              }}
            >
              {phase === 'ready' || phase === 'done'
                ? 'выбор дня'
                : phase === 'warmup'
                  ? 'разминка'
                  : phase === 'main'
                    ? 'тренировка'
                    : 'заминка'}
            </span>
          </div>
        );
      })()}
      {/* Выбор дня — только когда есть из чего выбирать. */}
      {days.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            marginBottom: 10,
          }}
        >
          {days.map((d, i) => {
            const active = i === dayIdx;
            const locked = phase !== 'ready' && phase !== 'done';
            const exCnt = d.exercises?.length ?? 0;
            const totalSets = d.exercises?.reduce((s: number, e: any) => s + (e.targetSets?.length || 0), 0) ?? 0;
            return (
              <button
                key={i}
                disabled={locked && !active}
                title={locked && !active ? 'Завершите текущую тренировку, чтобы сменить день' : `Выбрать ${d.label}`}
                aria-pressed={active}
                aria-label={`Выбрать ${d.label}`}
                onClick={() => {
                  hapticImpact('light');
                  setDayIdx(i);
                }}
                style={{
                  minWidth: 122,
                  flex: '0 0 auto',
                  scrollSnapAlign: 'start',
                  textAlign: 'left',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '10px 12px',
                  borderRadius: 14,
                  cursor: locked && !active ? 'not-allowed' : 'pointer',
                  background: active
                    ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(16,185,129,0.08))'
                    : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(0,230,138,0.32)' : '1px solid rgba(255,255,255,0.08)',
                  borderLeft: `3px solid ${active ? '#00e68a' : 'rgba(255,255,255,0.12)'}`,
                  boxShadow: active
                    ? '0 6px 18px rgba(0,230,138,0.18), inset 0 1px 0 rgba(255,255,255,0.06)'
                    : '0 2px 10px rgba(0,0,0,0.12)',
                  opacity: locked && !active ? 0.42 : 1,
                  transition: 'all 0.22s ease',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: active
                      ? 'linear-gradient(90deg,#00e68a,#00c853)'
                      : 'linear-gradient(90deg, rgba(255,255,255,0.08), transparent)',
                    opacity: active ? 1 : 0.5,
                  }}
                />
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: active ? '#00e68a' : 'rgba(255,255,255,0.55)',
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: active ? '#00e68a' : 'rgba(255,255,255,0.08)',
                      color: active ? '#000' : 'rgba(255,255,255,0.65)',
                      fontSize: 9,
                      fontWeight: 800,
                    }}
                  >
                    {i + 1}
                  </span>
                  День {i + 1}
                  {active ? ' • выбран' : ''}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#fff',
                    lineHeight: 1.15,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {d.label}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 20,
                      background: active ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.06)',
                      color: active ? '#00e68a' : '#fff',
                      border: `1px solid ${active ? 'rgba(0,230,138,0.22)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {exCnt} упр.
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 20,
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {ruCount(totalSets, RU_SETS)}
                  </span>
                </div>
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 18,
                      height: 18,
                      borderRadius: 18,
                      background: '#00e68a',
                      color: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 800,
                      boxShadow: '0 2px 8px rgba(0,230,138,0.35)',
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Степпер фаз сессии */}
      <div
        style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}
        role="tablist"
        aria-label="Фазы сессии"
      >
        {PHASES.map((p, i) => {
          const cur = PHASES.findIndex((x) => x.id === phase);
          const active = p.id === phase;
          const doneStep = i < cur;
          // «Готов» во время сессии и «Итог» до старта — кнопки-пустышки:
          // переход молча игнорируется, поэтому честно гасим их.
          const disabled = (p.id === 'ready' && !!session) || (p.id === 'done' && !session && !done);
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={p.label}
              onClick={() => goPhase(p.id)}
              disabled={disabled}
              style={{
                flex: 1,
                minWidth: 56,
                padding: '6px 8px',
                borderRadius: 8,
                cursor: disabled ? 'default' : 'pointer',
                fontSize: 9,
                fontWeight: 700,
                opacity: disabled ? 0.45 : 1,
                border: active ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                background: active
                  ? 'rgba(0,230,138,0.14)'
                  : doneStep
                    ? 'rgba(34,197,94,0.08)'
                    : 'rgba(255,255,255,0.04)',
                color: active ? 'var(--accent)' : doneStep ? '#22c55e' : '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 13 }}>{doneStep && !active ? '✓' : p.icon}</span>
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {phase === 'ready' && (
        <div style={{ marginTop: 8 }}>
          {/* 🌅 Фаза 6, п.6: видимый след утреннего чек-ина — веса/объёмы ниже скорректированы */}
          {readinessToday && readinessToday.verdict.level !== 'green' && (
            <div
              data-session="readiness"
              style={{
                marginBottom: 8,
                padding: 10,
                borderRadius: 12,
                background: readinessToday.verdict.level === 'red' ? 'rgba(255,82,82,0.10)' : 'rgba(251,191,36,0.10)',
                border: `1px solid ${readinessToday.verdict.level === 'red' ? 'rgba(255,82,82,0.35)' : 'rgba(251,191,36,0.35)'}`,
              }}
            >
              <div
                style={{
                  color: readinessToday.verdict.level === 'red' ? '#ff5252' : '#fbbf24',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                🌅 Чек-ин: готовность {readinessToday.verdict.score}/100
              </div>
              <div style={{ color: '#fff', fontSize: 10, marginTop: 2, lineHeight: 1.45 }}>
                {readinessToday.verdict.summary} Изменения касаются только этой тренировки; план недели не изменён.
                {readinessToday.verdict.noFailure ? ' Работаем без отказа (RIR ≥ 1).' : ''}
              </div>
            </div>
          )}
          <button
            onClick={() => {
              hapticImpact('medium');
              if (resumeFrom) resumeSavedSession(resumeFrom);
              else begin();
            }}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'linear-gradient(135deg, #00e68a, #00c853)',
              color: '#000',
              fontWeight: 800,
              fontSize: 14,
              boxShadow: '0 6px 20px rgba(0,230,138,0.28)',
              transition: 'transform 0.15s, boxShadow 0.15s',
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              ▶
            </span>
            <span style={{ flex: 1, textAlign: 'left', lineHeight: 1.2 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>
                {resumeFrom ? 'Продолжить тренировку' : 'Начать тренировку'}
              </span>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 600, opacity: 0.75 }}>
                {resumeFrom
                  ? `${resumeFrom.focus || 'Тренировка'} · ${(resumeFrom.exercises || []).reduce((sum, e) => sum + (e.sets || []).length, 0)} подх. уже записано`
                  : `${day.label} · нед ${weekNumber} · ${day.exercises?.length ?? 0} упр.`}
              </span>
            </span>
            <span style={{ fontSize: 18, opacity: 0.7 }}>→</span>
          </button>
          {/* ── Продолжение автосохранённой тренировки (после закрытия приложения) ── */}
          {resumeFrom &&
            (() => {
              const sum = summarizeActiveSession(
                resumeFrom,
                (day?.exercises ?? []).reduce((s, ex) => s + ex.targetSets.length, 0),
              );
              if (!sum) return null;
              const sameDay =
                (resumeFrom.exercises || []).length === (day?.exercises ?? []).length &&
                (resumeFrom.exercises || []).every((ex, i) => (day?.exercises?.[i]?.name || '') === ex.exerciseName);
              return (
                <div
                  data-session="resume"
                  style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(0,230,138,0.10), rgba(59,130,246,0.07))',
                    border: '1px solid rgba(0,230,138,0.22)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>⏯ Незавершённая тренировка</div>
                    <span
                      style={{ fontSize: 10, fontWeight: 800, color: '#00e68a', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {sum.progressPct}%
                    </span>
                  </div>
                  <div style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>
                    {sum.focus} · {sum.date} · {ruCount(sum.setsDone, RU_APPROACHES)} · {sum.volumeKg.toLocaleString()}{' '}
                    кг
                  </div>
                  {sum.currentExercise && (
                    <div style={{ color: '#fff', fontSize: 10, marginTop: 2, opacity: 0.85 }}>
                      Последнее: {sum.currentExercise}
                    </div>
                  )}
                  {!sameDay && (
                    <div style={{ color: '#f59e0b', fontSize: 10, marginTop: 4 }}>
                      ⚠ План дня изменился — продолжить можно, но цель подходов будет от текущего дня.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      data-act="resume-go"
                      onClick={() => resumeSavedSession(resumeFrom)}
                      style={{ ...BTN, flex: 2, minHeight: 48 }}
                    >
                      ▶ Продолжить
                    </button>
                    <button
                      type="button"
                      data-act="resume-drop"
                      onClick={() => {
                        // Не выбрасываем записанные подходы: переносим их в дневник.
                        // Если запись не легла (квота), карточку не убираем — иначе
                        // создаётся впечатление, что подходы сохранены.
                        if (archiveActiveSession()) setResumeFrom(null);
                      }}
                      style={{ ...BTN_GHOST, flex: 1, minHeight: 48 }}
                    >
                      ⤓ В дневник
                    </button>
                  </div>
                  <button
                    type="button"
                    data-act="resume-restart"
                    onClick={() => setRestartConfirm(true)}
                    style={{ ...BTN_GHOST, width: '100%', marginTop: 6, minHeight: 40, fontSize: 10 }}
                  >
                    🔄 Начать заново
                  </button>
                  {/* Подтверждение своим диалогом: window.confirm блокирует WebView и в
                      вебвью без поддержки молча гасит кнопку. */}
                  {restartConfirm && (
                    <div
                      data-session="restart-confirm"
                      style={{
                        marginTop: 6,
                        padding: 8,
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                    >
                      <div style={{ color: '#fff', fontSize: 10, lineHeight: 1.4, marginBottom: 6 }}>
                        Начать новую тренировку? Незавершённая сохранится в дневник.
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          data-act="restart-confirm-go"
                          onClick={() => {
                            hapticImpact('medium');
                            // Явный старт новой тренировки: незавершённую не выбрасываем, а
                            // сохраняем в дневник (прежний clearActiveSession молча терял подходы).
                            if (!archiveActiveSession()) {
                              setRestartConfirm(false);
                              return;
                            }
                            setRestartConfirm(false);
                            setResumeFrom(null);
                            begin();
                          }}
                          style={{ ...BTN, flex: 1, minHeight: 44 }}
                        >
                          Начать заново
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestartConfirm(false)}
                          style={{ ...BTN_GHOST, flex: 1, minHeight: 44 }}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          {/* оценка длительности */}
          {day &&
            Array.isArray(day.exercises) &&
            day.exercises.length > 0 &&
            (() => {
              const totalSets = day.exercises.reduce((s, ex) => s + ex.targetSets.length, 0);
              // Оценка времени, а не факт: отдых без restSec — тот же дефолт 90 с, что и у
              // таймера отдыха, иначе подпись «~N мин» обещала бы не то, что покажет таймер.
              const avgRest = day.exercises.reduce((s, ex) => s + (ex.restSec || 90), 0) / day.exercises.length;
              const estMin = Math.round((totalSets * (45 + avgRest) + 300) / 60); // 45с на подход + отдых + 5 мин разминка
              return (
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: '#fff' }}>
                    📋 {day.exercises.length} упр. · {ruCount(totalSets, RU_SETS)} · ~{estMin} мин
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
              <div style={SMALL}>
                {last.date} {last.startTime}–{last.endTime} · {last.focus} · {last.exercises.length} упр.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginTop: 6 }}>
                <div style={{ padding: 4, borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
                  <div style={{ fontSize: 9, color: '#fff' }}>Тоннаж</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                    {last.totalVolume.toLocaleString()} кг
                  </div>
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
                  План сегодня: {planned.volume.toLocaleString()} кг · {ruCount(planned.sets, RU_SETS)}
                  {last.totalVolume > 0 && (
                    <span style={{ color: planned.volume > last.totalVolume ? '#f59e0b' : '#22c55e', marginLeft: 4 }}>
                      ({planned.volume > last.totalVolume ? '+' : ''}
                      {Math.round(((planned.volume - last.totalVolume) / last.totalVolume) * 100)}% к прошлой)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Детали дня: полный список упражнений (сеты/вес/RIR/отдых) ── */}
          {day &&
            Array.isArray(day.exercises) &&
            day.exercises.length > 0 &&
            (() => {
              const totalSets = day.exercises.reduce((s, ex) => s + ex.targetSets.length, 0);
              const tonnage = day.exercises.reduce(
                (s, ex) => s + ex.targetSets.reduce((ss, st) => ss + (st.weight || 0) * (st.reps || 0), 0),
                0,
              );
              const knownRest = day.exercises
                .map((ex) => Number(ex.restSec))
                .filter((n) => Number.isFinite(n) && n > 0);
              // План без restSec не получает «~90с»: незаданный отдых не выдумываем.
              const avgRest =
                knownRest.length > 0 ? Math.round(knownRest.reduce((a, b) => a + b, 0) / knownRest.length) : null;
              return (
                <div style={{ ...CARD, marginTop: 8 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => setDayDetailsOpen((v) => !v)}
                    role="button"
                    aria-expanded={dayDetailsOpen}
                    aria-label={`Детали дня ${day.label}`}
                  >
                    <div style={LABEL}>
                      📋 Детали дня — {day.exercises.length} упр. · {ruCount(totalSets, RU_SETS)} ·{' '}
                      {tonnage.toLocaleString()} кг · {avgRest != null ? `~${avgRest}с отдых` : 'отдых не задан'}
                    </div>
                    <span style={{ color: '#fff', fontSize: 11 }}>{dayDetailsOpen ? '▲' : '▼'}</span>
                  </div>
                  {dayDetailsOpen && (
                    <div style={{ marginTop: 2 }}>
                      {day.exercises.map((ex, ei) => {
                        const setsStr = ex.targetSets
                          .map(
                            (s, si) => (si === 0 ? '' : si === ex.targetSets.length - 1 ? ' × ' : ' · ') + `${s.reps}`,
                          )
                          .join('');
                        const firstW = ex.targetSets[0]?.weight;
                        const rirStr = ex.targetSets[0]?.rir;
                        const plates = firstW ? formatPlates(firstW, ex.name) : '';
                        return (
                          <div key={ei} style={{ ...ROW, gap: 8, alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                                {ex.name}
                                {ex.supersetGroup != null && (
                                  <span
                                    style={{
                                      fontSize: 9,
                                      marginLeft: 6,
                                      padding: '1px 5px',
                                      borderRadius: 4,
                                      background: 'rgba(168,85,247,0.18)',
                                      color: '#c084fc',
                                      fontWeight: 800,
                                    }}
                                    title="Суперсет: упражнения пары выполняются без отдыха между ними"
                                  >
                                    🔗 {ex.supersetSlot === 1 ? 'B' : 'A'}
                                    {ex.supersetGroup}
                                  </span>
                                )}
                                {(() => {
                                  const t = ex.targetSets[ex.targetSets.length - 1]?.technique;
                                  const lbl = techniqueLabel(t);
                                  return lbl ? (
                                    <span
                                      style={{ fontSize: 9, marginLeft: 6, color: '#f87171', fontWeight: 700 }}
                                      title={
                                        techniqueChainParts({
                                          workSets: ex.targetSets.map((s) => ({
                                            reps: s.reps,
                                            weight: s.weight,
                                            rir: s.rir,
                                            technique: s.technique,
                                          })),
                                        })?.parts.join(' → ') || lbl
                                      }
                                    >
                                      💥 {lbl}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--text-faint)' }}>
                                {ex.muscleGroup || ex.group || ''}
                                {plates ? ` · ${plates}` : ''}
                              </div>
                            </div>
                            <div style={{ fontSize: 10, color: ACCENT, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {ex.targetSets.length}×{setsStr}
                            </div>
                            <div style={{ fontSize: 10, color: '#fff', whiteSpace: 'nowrap' }}>
                              {firstW ? `${firstW} кг` : 'вес тела'}
                            </div>
                            <div style={{ fontSize: 10, color: '#fff', whiteSpace: 'nowrap' }}>RIR {rirStr ?? '—'}</div>
                            <div style={{ fontSize: 10, color: '#fff', whiteSpace: 'nowrap' }}>
                              {Number(ex.restSec) > 0 ? `~${ex.restSec}с` : 'отдых —'}
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
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const totalSec = warmupBlocks.reduce((s, b) => s + (b.durationSec || 0), 0);
            const mins = totalSec > 0 ? Math.round((totalSec / 60) * 10) / 10 : 0;
            const isDone = pct === 100;
            return (
              <div
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 16,
                  padding: '14px 14px 12px',
                  background: isDone
                    ? 'linear-gradient(135deg, rgba(34,197,94,0.16), rgba(16,185,129,0.08))'
                    : 'linear-gradient(135deg, rgba(249,115,22,0.14), rgba(251,146,60,0.07), rgba(167,139,250,0.07))',
                  border: `1px solid ${isDone ? 'rgba(34,197,94,0.28)' : 'rgba(249,115,22,0.22)'}`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  boxShadow: isDone ? '0 4px 20px rgba(34,197,94,0.18)' : '0 4px 20px rgba(249,115,22,0.12)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -18,
                    right: -18,
                    width: 96,
                    height: 96,
                    borderRadius: 96,
                    background: `radial-gradient(circle, ${isDone ? 'rgba(34,197,94,0.18)' : 'rgba(249,115,22,0.16)'}, transparent 70%)`,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                    position: 'relative',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isDone
                            ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                            : 'linear-gradient(135deg,#f97316,#ea580c)',
                          color: '#fff',
                          fontSize: 16,
                          fontWeight: 800,
                          boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                          flexShrink: 0,
                        }}
                      >
                        {isDone ? '✓' : '🔥'}
                      </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                          Разминка · {day.label}
                        </div>
                        <div style={{ fontSize: 10, color: '#fff', marginTop: 1, lineHeight: 1.2 }}>
                          {warmupBlocks.length} блока · {total} пунктов · {mins} мин · группы дня учтены
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 20,
                          background: isDone ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.07)',
                          color: isDone ? '#22c55e' : '#fff',
                          border: `1px solid ${isDone ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        }}
                      >
                        {done}/{total} пунктов
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 4,
                        borderRadius: 24,
                        background: `conic-gradient(${isDone ? '#22c55e' : '#f97316'} ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                        mask: 'radial-gradient(circle 18px at center, transparent 18px, black 19px)',
                        WebkitMask: 'radial-gradient(circle 18px at center, transparent 18px, black 19px)',
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 800, color: isDone ? '#22c55e' : '#fff' }}>{pct}%</span>
                  </div>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    marginTop: 10,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      borderRadius: 3,
                      background: isDone
                        ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                        : 'linear-gradient(90deg,#f97316,#fb923c)',
                      transition: 'width 0.4s ease',
                      boxShadow: isDone ? '0 0 8px rgba(34,197,94,0.45)' : '0 0 8px rgba(249,115,22,0.35)',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {(['quick', 'standard', 'full'] as WarmupMode[]).map((modeOpt) => {
                    const active = warmupMode === modeOpt;
                    const cfg =
                      modeOpt === 'quick'
                        ? {
                            label: '⚡ Быстро',
                            sub: '5 мин',
                            color: '#f59e0b',
                            bg: 'rgba(245,158,11,0.12)',
                            border: 'rgba(245,158,11,0.28)',
                          }
                        : modeOpt === 'standard'
                          ? {
                              label: '⚖️ Стандарт',
                              sub: '9 мин',
                              color: '#22c55e',
                              bg: 'rgba(34,197,94,0.12)',
                              border: 'rgba(34,197,94,0.28)',
                            }
                          : {
                              label: '🎯 Полная',
                              sub: '14 мин',
                              color: '#a78bfa',
                              bg: 'rgba(167,139,250,0.12)',
                              border: 'rgba(167,139,250,0.28)',
                            };
                    return (
                      <button
                        key={modeOpt}
                        onClick={() => {
                          setWarmupMode(modeOpt);
                          try {
                            localStorage.setItem('he_warmup_mode', modeOpt);
                          } catch {}
                          if (phase !== 'warmup' || !day || !Array.isArray(day.exercises)) return;
                          const riskFlags2: Record<string, string> = {};
                          if (profile.injuries?.length) {
                            profile.injuries.forEach((inj) => {
                              const mm = inj.muscle?.toLowerCase() || '';
                              if (mm.includes('колен') || mm.includes('knee')) riskFlags2['knee'] = 'high';
                              if (mm.includes('плеч') || mm.includes('shoulder')) riskFlags2['shoulder'] = 'high';
                              if (
                                mm.includes('спин') ||
                                mm.includes('поясн') ||
                                mm.includes('back') ||
                                mm.includes('lumbar')
                              )
                                riskFlags2['back'] = 'high';
                            });
                          }
                          const techniqueIssues2: string[] = profile.weakPoints?.length
                            ? profile.weakPoints
                                .map((w) => {
                                  const wp = String(w).toLowerCase();
                                  if (wp.includes('back') || wp.includes('поясн') || wp === 'core')
                                    return 'rounding_back';
                                  if (wp.includes('knee') || wp.includes('колен')) return 'knee_valgus';
                                  if (wp.includes('shoulder') || wp.includes('плеч')) return 'tight_shoulders';
                                  if (wp.includes('hip') || wp.includes('бёдр') || wp.includes('таз'))
                                    return 'tight_hips';
                                  if (wp.includes('ankle') || wp.includes('голеност')) return 'tight_ankles';
                                  if (wp.includes('chest') || wp.includes('груд')) return 'tight_chest';
                                  return '';
                                })
                                .filter(Boolean)
                            : [];
                          const inp: WarmupInput = {
                            sessionFocus: focus,
                            primaryExercises: day.exercises.map((ex) => ex.name),
                            primaryWeights: day.exercises.map(
                              (ex) =>
                                (Array.isArray(ex.targetSets) && ex.targetSets[0]?.weight
                                  ? Number(ex.targetSets[0].weight)
                                  : null) as any,
                            ),
                            riskFlags: riskFlags2,
                            techniqueIssues: techniqueIssues2,
                            fatigueLevel: profile.fatigue / 10,
                            equipmentAvailable: profile.equipment,
                            targetGroups: Array.from(
                              new Set(day.exercises.map((ex) => ex.muscleGroup || '').filter(Boolean)),
                            ),
                            mode: modeOpt,
                          };
                          setWarmupBlocks(generateWarmup(inp));
                          setWarmupDone({});
                          setWarmupTimer(null);
                        }}
                        style={{
                          flex: 1,
                          minWidth: 72,
                          padding: '5px 6px',
                          borderRadius: 9,
                          cursor: 'pointer',
                          fontSize: 9,
                          fontWeight: 700,
                          background: active ? cfg.bg : 'rgba(255,255,255,0.04)',
                          color: active ? cfg.color : 'rgba(255,255,255,0.60)',
                          border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.08)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <span>{cfg.label}</span>
                        <span style={{ fontSize: 8, opacity: 0.85 }}>{cfg.sub}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 9, color: '#fff', marginTop: 6, lineHeight: 1.3 }}>
                  Отмечайте пункты по ходу · разминка пишется в дневник при переходе к основной части ·{' '}
                  {isDone ? 'отлично — все пункты отмечены!' : 'минимум: 50% для хорошей готовности'}
                </div>
              </div>
            );
          })()}

          {/* ── Блоки разминки — красивые карточки ── */}
          {/* Разминка — по желанию: главный шаг — основная часть. Кнопка стояла
              в самом низу списка блоков, и до неё надо было листать всю разминку. */}
          <div data-pl="warmup-cta" style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              data-act="warmup-to-main"
              onClick={startMain}
              style={{
                ...BTN,
                flex: 1,
                background: 'linear-gradient(135deg,#f97316,#ea580c)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(249,115,22,0.28)',
              }}
            >
              🚀 К основной части
            </button>
            <button
              type="button"
              data-act="warmup-all-done"
              onClick={() => {
                const next: Record<string, boolean> = {};
                warmupBlocks.forEach((b, i) =>
                  b.exercises.forEach((_, j) => {
                    next[`w_${i}_${j}`] = true;
                  }),
                );
                setWarmupDone(next);
              }}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                background: 'rgba(34,197,94,0.12)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.22)',
              }}
            >
              ✓ Всё готово
            </button>
          </div>
          {warmupBlocks.map((b, i) => {
            const meta =
              b.type === 'general'
                ? {
                    icon: '🏃',
                    title: 'Общая разминка',
                    color: '#06b6d4',
                    bg: 'rgba(6,182,214,0.07)',
                    border: 'rgba(6,182,214,0.24)',
                    desc: 'Пульс + кровоток',
                  }
                : b.type === 'mobility'
                  ? {
                      icon: '🤸',
                      title: 'Суставы + зоны',
                      color: '#f59e0b',
                      bg: 'rgba(245,158,11,0.07)',
                      border: 'rgba(245,158,11,0.24)',
                      desc: 'Подвижность целевых суставов и мышц',
                    }
                  : b.type === 'activation'
                    ? {
                        icon: '⚡',
                        title: 'Активация',
                        color: '#22c55e',
                        bg: 'rgba(34,197,94,0.07)',
                        border: 'rgba(34,197,94,0.24)',
                        desc: 'Включение каждой рабочей группы',
                      }
                    : {
                        icon: '🏋️',
                        title: 'Подводящие подходы',
                        color: '#a78bfa',
                        bg: 'rgba(167,139,250,0.07)',
                        border: 'rgba(167,139,250,0.24)',
                        desc: 'К рабочим весам · техника',
                      };
            const total = b.exercises.length;
            const done = b.exercises.filter((_, j) => warmupDone[`w_${i}_${j}`]).length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const allDone = done === total && total > 0;
            const collapsed = allDone && !warmupOpen[i];
            return (
              <div
                key={i}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 14,
                  padding: '10px 10px 8px',
                  background: allDone ? 'rgba(34,197,94,0.06)' : 'var(--glass-bg)',
                  border: `1px solid ${allDone ? 'rgba(34,197,94,0.22)' : meta.border}`,
                  borderLeft: `3px solid ${allDone ? '#22c55e' : meta.color}`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  boxShadow: allDone ? '0 2px 14px rgba(34,197,94,0.10)' : '0 2px 14px rgba(0,0,0,0.14)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: `linear-gradient(90deg, ${meta.color}, transparent)`,
                    opacity: allDone ? 0.9 : 0.65,
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: allDone
                          ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                          : `linear-gradient(135deg, ${meta.color}, ${meta.color}CC)`,
                        color: '#fff',
                        fontSize: 14,
                        flexShrink: 0,
                        boxShadow: `0 2px 8px ${meta.color}33`,
                      }}
                    >
                      {allDone ? '✓' : meta.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: allDone ? '#22c55e' : meta.color,
                          lineHeight: 1,
                        }}
                      >
                        {meta.title}
                      </div>
                      <div style={{ fontSize: 9, color: '#fff', lineHeight: 1.2 }}>{meta.desc}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 20,
                        background: allDone ? 'rgba(34,197,94,0.14)' : meta.bg,
                        color: allDone ? '#22c55e' : meta.color,
                        border: `1px solid ${allDone ? 'rgba(34,197,94,0.28)' : meta.border}`,
                      }}
                    >
                      ⏱ {b.durationSec}с
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '3px 7px',
                        borderRadius: 20,
                        background: allDone ? '#22c55e' : 'rgba(255,255,255,0.06)',
                        color: allDone ? '#000' : '#fff',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {done}/{total}
                    </span>
                    {allDone && (
                      <button
                        type="button"
                        data-act="warmup-toggle"
                        aria-expanded={!collapsed}
                        onClick={() => setWarmupOpen((o) => ({ ...o, [i]: !o[i] }))}
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '3px 7px',
                          borderRadius: 20,
                          cursor: 'pointer',
                          background: 'rgba(255,255,255,0.07)',
                          color: '#fff',
                          border: '1px solid rgba(255,255,255,0.10)',
                        }}
                      >
                        {collapsed ? 'Развернуть' : 'Свернуть'}
                      </button>
                    )}
                  </div>
                </div>
                {!collapsed && (
                  <>
                    {b.notes && (
                      <div
                        style={{
                          fontSize: 9,
                          color: '#fff',
                          lineHeight: 1.35,
                          marginBottom: 7,
                          padding: '5px 8px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <span style={{ color: meta.color, fontWeight: 700 }}>ℹ </span>
                        {b.notes}
                      </div>
                    )}
                    <div
                      style={{
                        height: 3,
                        borderRadius: 2,
                        background: 'rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                        marginBottom: 7,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: 2,
                          background: allDone ? '#22c55e' : meta.color,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <ul
                      style={{
                        padding: 0,
                        margin: 0,
                        listStyle: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {b.exercises.map((ex, j) => {
                        const isDone = warmupDone[`w_${i}_${j}`];
                        const isSpecific = 'intensityPct' in ex && (ex as any).intensityPct;
                        const label = isSpecific ? warmupSpecificLabel(ex.exerciseId) : warmupLabel(ex.exerciseId);
                        const dose = isSpecific
                          ? `${(ex as any).intensityPct}% · ${ex.sets}×${ex.reps}`
                          : `${ex.sets}×${ex.reps}`;
                        return (
                          <li key={j} style={{ listStyle: 'none' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                              <button
                                type="button"
                                data-warmup-item={`${i}_${j}`}
                                aria-pressed={isDone}
                                aria-label={`${label} — ${isDone ? 'выполнено, нажать чтобы отменить' : 'отметить выполнение'}`}
                                onClick={() => {
                                  hapticImpact(isDone ? 'light' : 'medium');
                                  toggleWarmup(i, j);
                                }}
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 10,
                                  padding: '9px 10px',
                                  borderRadius: 12,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  minWidth: 0,
                                  background: isDone
                                    ? 'linear-gradient(135deg, rgba(34,197,94,0.13), rgba(16,185,129,0.07))'
                                    : 'rgba(255,255,255,0.035)',
                                  border: `1px solid ${isDone ? 'rgba(34,197,94,0.28)' : 'rgba(255,255,255,0.07)'}`,
                                  borderLeft: `3px solid ${isDone ? '#22c55e' : meta.color}`,
                                  boxShadow: isDone
                                    ? '0 3px 12px rgba(34,197,94,0.16), inset 0 1px 0 rgba(255,255,255,0.06)'
                                    : '0 1px 8px rgba(0,0,0,0.10)',
                                  opacity: isDone ? 0.92 : 1,
                                  transition: 'all 0.22s ease',
                                  position: 'relative',
                                  overflow: 'hidden',
                                }}
                              >
                                <span
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 9,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: 1,
                                    background: isDone
                                      ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                                      : `linear-gradient(135deg, ${meta.color}, ${meta.color}CC)`,
                                    color: '#fff',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    boxShadow: `0 2px 8px ${isDone ? 'rgba(34,197,94,0.28)' : meta.color + '33'}`,
                                  }}
                                >
                                  {isDone ? '✓' : j + 1}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span
                                    style={{
                                      fontSize: 11.5,
                                      fontWeight: isDone ? 600 : 700,
                                      color: isDone ? 'rgba(255,255,255,0.78)' : '#fff',
                                      textDecoration: isDone ? 'line-through' : 'none',
                                      lineHeight: 1.35,
                                      display: 'block',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {label}
                                  </span>
                                  <span
                                    style={{
                                      display: 'flex',
                                      gap: 6,
                                      flexWrap: 'wrap',
                                      alignItems: 'center',
                                      marginTop: 4,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 800,
                                        padding: '2px 7px',
                                        borderRadius: 20,
                                        background: isDone ? 'rgba(34,197,94,0.14)' : meta.bg,
                                        color: isDone ? '#86efac' : meta.color,
                                        border: `1px solid ${isDone ? 'rgba(34,197,94,0.22)' : meta.border}`,
                                      }}
                                    >
                                      {dose}
                                    </span>
                                    {'note' in ex && (ex as any).note && (
                                      <span
                                        style={{
                                          fontSize: 9,
                                          color: isDone ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.62)',
                                          wordBreak: 'break-word',
                                          lineHeight: 1.3,
                                        }}
                                      >
                                        {(ex as any).note}
                                      </span>
                                    )}
                                  </span>
                                </span>
                                <span
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 28,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: 1,
                                    background: isDone ? '#22c55e' : 'rgba(255,255,255,0.06)',
                                    color: isDone ? '#000' : 'rgba(255,255,255,0.38)',
                                    border: `1px solid ${isDone ? '#22c55e' : 'rgba(255,255,255,0.09)'}`,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    boxShadow: isDone ? '0 2px 8px rgba(34,197,94,0.28)' : 'none',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  {isDone ? '✓' : '○'}
                                </span>
                              </button>
                              {(() => {
                                if (isDone) return null;
                                const isActive = warmupTimer && warmupTimer.i === i && warmupTimer.j === j;
                                if (isActive) {
                                  return (
                                    <span
                                      style={{
                                        minWidth: 48,
                                        alignSelf: 'center',
                                        padding: '6px 8px',
                                        borderRadius: 10,
                                        background:
                                          'linear-gradient(135deg, rgba(6,182,214,0.16), rgba(14,165,233,0.10))',
                                        color: '#22d3ee',
                                        border: '1px solid rgba(6,182,214,0.28)',
                                        fontSize: 11,
                                        fontWeight: 800,
                                        textAlign: 'center',
                                        flexShrink: 0,
                                        boxShadow: '0 2px 10px rgba(6,182,214,0.18)',
                                      }}
                                    >
                                      {warmupTimer!.remaining}с
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      hapticImpact('light');
                                      setWarmupTimer({ i, j, remaining: 30, total: 30 });
                                    }}
                                    style={{
                                      alignSelf: 'center',
                                      padding: '7px 9px',
                                      borderRadius: 10,
                                      fontSize: 10,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      border: '1px solid rgba(255,255,255,0.10)',
                                      background: 'rgba(255,255,255,0.05)',
                                      color: '#fff',
                                      flexShrink: 0,
                                      backdropFilter: 'blur(8px)',
                                    }}
                                    aria-label={`Таймер 30с для ${label}`}
                                  >
                                    ⏱ 30с
                                  </button>
                                );
                              })()}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                {total > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const all = b.exercises.every((_, j) => warmupDone[`w_${i}_${j}`]);
                      const next: Record<string, boolean> = { ...warmupDone };
                      b.exercises.forEach((_, j) => {
                        next[`w_${i}_${j}`] = !all;
                      });
                      setWarmupDone(next);
                    }}
                    style={{
                      marginTop: 7,
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 9,
                      fontWeight: 700,
                      background: done === total ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                      color: done === total ? '#22c55e' : 'rgba(255,255,255,0.65)',
                      border: `1px solid ${done === total ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {done === total ? '↩ Сбросить блок' : `✓ Отметить весь блок (${total})`}
                  </button>
                )}
              </div>
            );
          })}

          <SkipBar
            reasons={WARMUP_SKIP_REASONS}
            label="разминку"
            onSkip={(reason) => {
              skipWarmupReasonRef.current = reason;
              startMain();
            }}
          />
          <div style={{ fontSize: 9, color: '#fff', textAlign: 'center', lineHeight: 1.3, marginTop: 2 }}>
            Активация подбирается под группы дня — каждая рабочая мышца получает мобильность и «включение» · без ленты —
            bodyweight-замены уже включены · подводящие — с весом в подсказке (~кг)
          </div>
        </div>
      )}

      {phase === 'main' && session && (
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={H}>🏃 {day.label}</div>
            <button style={BTN} onClick={finish}>
              ⏹ Завершить
            </button>
          </div>

          {/* общий прогресс сессии — «цифра дня» */}
          {(() => {
            if (!day || !Array.isArray(day.exercises)) return null;
            const totalSets = day.exercises.reduce((s, ex) => s + ex.targetSets.length, 0);
            const doneSets = day.exercises.reduce(
              (s, ex, ei) => s + ex.targetSets.filter((_, si) => !!loggedSet[keyFor(ei, si)]).length,
              0,
            );
            const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;
            const doneVol = day.exercises.reduce(
              (s, ex, ei) =>
                s + ex.targetSets.reduce((ss, t, si) => ss + (loggedSet[keyFor(ei, si)] ? t.weight * t.reps : 0), 0),
              0,
            );
            return (
              <div
                style={{
                  marginBottom: 8,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(0,230,138,0.05)',
                  border: '1px solid rgba(0,230,138,0.15)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 26,
                        fontWeight: 800,
                        color: pct === 100 ? '#22c55e' : ACCENT,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {pct}%
                    </span>
                    <span style={{ fontSize: 11, color: '#fff' }}>
                      {doneSets}/{totalSets} подходов
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#fff' }}>
                    <span>
                      ⚡ {doneVol.toLocaleString()} / {planned.volume.toLocaleString()} кг
                    </span>
                    <button
                      type="button"
                      data-act="session-timer"
                      onClick={() => setSessionTimerRunning((v) => !v)}
                      title={sessionTimerRunning ? 'Пауза' : 'Продолжить'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 20,
                        cursor: 'pointer',
                        background: 'transparent',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        border: sessionTimerRunning
                          ? '1px solid rgba(255,255,255,0.16)'
                          : '1px solid rgba(0,230,138,0.28)',
                      }}
                    >
                      {sessionTimerRunning ? '⏸' : '▶'}{' '}
                      <b style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {String(Math.floor(sessionTimerSec / 60)).padStart(2, '0')}:
                        {String(sessionTimerSec % 60).padStart(2, '0')}
                      </b>
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    marginTop: 6,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      borderRadius: 3,
                      background: pct === 100 ? '#22c55e' : 'var(--accent)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          })()}
          {/* Таймер отдыха уехал вместе с прошлым упражнением (мы прокрутили экран
                к следующему) — держим счётчик видимым строкой сверху. */}
          {timerRunning && timerExIdx >= 0 && timerExIdx !== currentExIdx && (
            <div
              data-session="rest-strip"
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
                padding: '8px 10px',
                borderRadius: 12,
                background: 'linear-gradient(180deg, rgba(14,18,20,0.98), rgba(14,18,20,0.94))',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${timerSec <= 10 ? 'rgba(245,158,11,0.45)' : 'rgba(0,230,138,0.28)'}`,
                boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
              }}
            >
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>⏱ Отдых</span>
              <b
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: timerSec <= 10 ? '#f59e0b' : ACCENT,
                  fontVariantNumeric: 'tabular-nums',
                  flex: 1,
                }}
              >
                {String(Math.floor(timerSec / 60)).padStart(2, '0')}:{String(timerSec % 60).padStart(2, '0')}
              </b>
              <button
                type="button"
                data-act="rest-strip-skip"
                onClick={skipRestTimer}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  minHeight: 34,
                }}
              >
                Пропустить
              </button>
            </div>
          )}
          {/* Всё закрыто — следующий шаг виден сразу, искать «Завершить» не нужно. */}
          {mainProgress.totalSets > 0 && mainProgress.doneSets === mainProgress.totalSets && (
            <button
              type="button"
              data-act="all-sets-done"
              onClick={() => {
                hapticImpact('medium');
                exitSession(false);
              }}
              style={{
                ...BTN,
                width: '100%',
                minHeight: 50,
                marginBottom: 8,
                fontSize: 13,
                background: 'linear-gradient(135deg,#00e68a,#00c853)',
                color: '#000',
                boxShadow: '0 6px 20px rgba(0,230,138,0.26)',
              }}
            >
              ✓ Все подходы записаны — к заминке
            </button>
          )}
          {/* Объём: план/факт за сессию + недельный ориентир из канонического движка.
                Свёрнут: в зале важнее первый подход, аналитика не должна отодвигать его. */}
          <button
            type="button"
            data-act="volume-toggle"
            aria-expanded={volOpen}
            onClick={() => setVolOpen((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 10,
              padding: '7px 10px',
              borderRadius: 10,
              cursor: 'pointer',
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.15)',
              color: '#a78bfa',
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            <span>📊 Объём: сессия и ориентир недели</span>
            <span style={{ opacity: 0.7 }}>{volOpen ? '▲' : '▼'}</span>
          </button>
          {volOpen &&
            (() => {
              const muscleSets: Record<string, { plan: number; done: number }> = {};
              day?.exercises?.forEach((ex, ei) => {
                const g = String(ex.muscleGroup || '').trim();
                if (!g) return;
                const acc = muscleSets[g] || { plan: 0, done: 0 };
                ex.targetSets.forEach((_, si) => {
                  acc.plan += 1;
                  if (loggedSet[keyFor(ei, si)]) acc.done += 1;
                });
                muscleSets[g] = acc;
              });
              const muscles = Object.keys(muscleSets);
              if (muscles.length === 0) {
                return (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      fontSize: 10,
                      color: '#fff',
                      opacity: 0.6,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    У упражнений дня не указаны группы мышц — считать объём не по чему.
                  </div>
                );
              }
              // Сколько тренировочных дней в неделю — чтобы честно оценить недельный объём.
              const trainingDays = Math.max(
                1,
                (Array.isArray(days) ? days : []).filter((d) => Array.isArray(d?.exercises) && d.exercises.length > 0)
                  .length,
              );
              return (
                <div
                  style={{
                    marginBottom: 8,
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgba(99,102,241,0.06)',
                    border: '1px solid rgba(99,102,241,0.15)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color: '#a78bfa',
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                      }}
                    >
                      Объём: сессия и ориентир недели
                    </span>
                    <span style={{ fontSize: 8.5, color: '#fff', opacity: 0.6 }}>
                      ≈{trainingDays} трен./нед · прогноз по плану сессии ·{' '}
                      {(
                        {
                          beginner: 'новичок',
                          intermediate: 'средний',
                          advanced: 'опытный',
                          enhanced: 'усиленный',
                        } as Record<string, string>
                      )[profile.level] || 'средний'}{' '}
                      уровень
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {muscles.map((m) => {
                      const { plan, done } = muscleSets[m];
                      const lm = getVolumeLandmarks(profile.level || 'intermediate', m);
                      const weekly = plan * trainingDays;
                      const status = lm ? checkVolumeStatus(weekly, lm) : null;
                      const color = status ? VOLUME_STATUS_COLOR[status] : '#60a5fa';
                      const label = MUSCLE_LABELS[m as keyof typeof MUSCLE_LABELS] || MUSCLE_LABEL_RU[m] || m;
                      return (
                        <span
                          key={m}
                          title={`Недельный объём — прогноз: ${plan} подх. за сессию × ${trainingDays} трен./нед. Факт за сессию: ${done}/${plan}.`}
                          style={{
                            fontSize: 9,
                            padding: '3px 8px',
                            borderRadius: 20,
                            background: `${color}18`,
                            color,
                            border: `1px solid ${color}40`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span style={{ fontWeight: 800 }}>{label}</span>
                          <span style={{ fontWeight: 700 }}>
                            {done}/{plan} подх.
                          </span>
                          {lm && status && (
                            <>
                              <span style={{ fontSize: 8, opacity: 0.8 }}>
                                ≈{weekly}/нед · {VOLUME_STATUS_LABEL[status]}
                              </span>
                              <span style={{ fontSize: 8, opacity: 0.6 }}>
                                MEV {lm.mev}·MAV {lm.mav}·MRV {lm.mrv}
                              </span>
                            </>
                          )}
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 6,
                              background: color,
                              boxShadow: `0 0 6px ${color}`,
                            }}
                          />
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          {/* режимы суперсета и круга — современные карточки-кнопки */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              style={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: 0.3, textTransform: 'uppercase' }}
            >
              Режим
            </span>
            <button
              type="button"
              aria-pressed={supersetMode}
              onClick={() => {
                hapticImpact('light');
                toggleSupersetMode();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 11px',
                borderRadius: 20,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                border: supersetMode ? '1px solid rgba(245,158,11,0.32)' : '1px solid rgba(255,255,255,0.09)',
                background: supersetMode
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(217,119,6,0.10))'
                  : 'rgba(255,255,255,0.04)',
                color: supersetMode ? '#f59e0b' : '#fff',
                boxShadow: supersetMode ? '0 3px 12px rgba(245,158,11,0.18)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: supersetMode ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                  color: supersetMode ? '#000' : 'rgba(255,255,255,0.6)',
                  fontSize: 10,
                }}
              >
                🔄
              </span>
              Суперсет {supersetMode ? '✓' : ''}
            </button>
            <button
              type="button"
              aria-pressed={circuitMode}
              onClick={() => {
                hapticImpact('light');
                toggleCircuitMode();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 11px',
                borderRadius: 20,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                border: circuitMode ? '1px solid rgba(139,92,246,0.32)' : '1px solid rgba(255,255,255,0.09)',
                background: circuitMode
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.16), rgba(99,102,241,0.10))'
                  : 'rgba(255,255,255,0.04)',
                color: circuitMode ? '#a78bfa' : '#fff',
                boxShadow: circuitMode ? '0 3px 12px rgba(139,92,246,0.18)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: circuitMode ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                  color: circuitMode ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontSize: 10,
                }}
              >
                ⭕
              </span>
              Круг {circuitMode ? '✓' : ''}
            </button>
            <button
              type="button"
              aria-pressed={plateOpen}
              onClick={() => {
                hapticImpact('light');
                setPlateOpen((v) => !v);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 11px',
                borderRadius: 20,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                border: plateOpen ? '1px solid rgba(0,230,138,0.32)' : '1px solid rgba(255,255,255,0.09)',
                background: plateOpen
                  ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(16,185,129,0.10))'
                  : 'rgba(255,255,255,0.04)',
                color: plateOpen ? '#00e68a' : '#fff',
                boxShadow: plateOpen ? '0 3px 12px rgba(0,230,138,0.18)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: plateOpen ? '#00e68a' : 'rgba(255,255,255,0.08)',
                  color: plateOpen ? '#000' : 'rgba(255,255,255,0.6)',
                  fontSize: 10,
                }}
              >
                🧮
              </span>
              Блины {plateOpen ? '✓' : ''}
            </button>
            {(supersetMode || circuitMode) && (
              <span
                style={{
                  fontSize: 9,
                  color: supersetMode ? '#f59e0b' : '#a78bfa',
                  fontWeight: 600,
                  background: supersetMode ? 'rgba(245,158,11,0.08)' : 'rgba(139,92,246,0.08)',
                  padding: '3px 8px',
                  borderRadius: 20,
                  border: `1px solid ${supersetMode ? 'rgba(245,158,11,0.18)' : 'rgba(139,92,246,0.18)'}`,
                }}
              >
                {supersetMode ? 'Выберите 2+ упражнения • короткий отдых' : 'Минимальный отдых между упражнениями'}
              </span>
            )}
          </div>

          {/* подсказки горячих клавиш */}
          {!isNativeApp() && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              {[
                { key: 'Space', label: 'залогировать подход' },
                { key: 'R', label: 'таймер отдыха' },
              ].map((h) => (
                <span key={h.key} style={{ fontSize: 8, color: 'var(--text-faint)' }}>
                  <kbd
                    style={{
                      padding: '1px 4px',
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontSize: 8,
                      fontFamily: 'monospace',
                    }}
                  >
                    {h.key}
                  </kbd>{' '}
                  {h.label}
                </span>
              ))}
            </div>
          )}

          {/* sRPE — под подходами: перед первым подходом он только мешал */}
          {/* 🧮 Калькулятор блинов: подкладка с выбором упражнения текущей сессии */}
          {plateOpen && (
            <div style={{ ...CARD, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>🧮 Калькулятор блинов</div>
                <button
                  onClick={() => setPlateOpen(false)}
                  style={{
                    padding: '2px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 11,
                    minHeight: 28,
                  }}
                  aria-label="Закрыть калькулятор блинов"
                >
                  ✕
                </button>
              </div>
              <PlateCalcTab
                exerciseOptions={day.exercises.map((ex, ei) => ({
                  id: String(ei),
                  label: ex.name,
                  weight: ex.targetSets[0]?.weight || 0,
                }))}
                onApply={applyPlateWeight}
                applyLabel="✅ Применить к упражнению"
              />
            </div>
          )}
          {day.exercises.map((ex, ei) => (
            <div
              key={ei}
              ref={(el) => {
                exHeadRefs.current[ei] = el;
              }}
              style={{
                marginTop: 8,
                padding: '8px 0',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                background: supersetExercises.includes(ei)
                  ? supersetMode
                    ? 'rgba(245,158,11,0.05)'
                    : 'rgba(139,92,246,0.05)'
                  : 'transparent',
                borderRadius: supersetExercises.includes(ei) ? 8 : 0,
                paddingLeft: supersetExercises.includes(ei) ? 8 : 0,
                paddingRight: supersetExercises.includes(ei) ? 8 : 0,
                // Автоскролл к следующему упражнению ставит шапку под липкую полосу фаз.
                scrollMarginTop: 56,
              }}
            >
              {supersetMode || circuitMode ? (
                <button
                  type="button"
                  aria-pressed={supersetExercises.includes(ei)}
                  aria-label={`${ex.name} — ${supersetExercises.includes(ei) ? 'убрать из' : 'добавить в'} ${supersetMode ? 'суперсет' : 'круг'}`}
                  onClick={() => {
                    hapticImpact('light');
                    toggleExerciseInSuperset(ei);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: supersetExercises.includes(ei)
                      ? supersetMode
                        ? 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(217,119,6,0.08))'
                        : 'linear-gradient(135deg, rgba(139,92,246,0.13), rgba(99,102,241,0.08))'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${supersetExercises.includes(ei) ? (supersetMode ? 'rgba(245,158,11,0.32)' : 'rgba(139,92,246,0.30)') : 'rgba(255,255,255,0.07)'}`,
                    borderLeft: `3px solid ${supersetExercises.includes(ei) ? (supersetMode ? '#f59e0b' : '#8b5cf6') : 'rgba(255,255,255,0.12)'}`,
                    boxShadow: supersetExercises.includes(ei)
                      ? supersetMode
                        ? '0 3px 12px rgba(245,158,11,0.18)'
                        : '0 3px 12px rgba(139,92,246,0.18)'
                      : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      background: supersetExercises.includes(ei)
                        ? supersetMode
                          ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                          : 'linear-gradient(135deg,#8b5cf6,#6366f1)'
                        : 'rgba(255,255,255,0.08)',
                      color: supersetExercises.includes(ei) ? '#fff' : 'rgba(255,255,255,0.45)',
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {supersetExercises.includes(ei) ? '✓' : ei + 1}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1.2, display: 'block' }}>
                      {ex.name} <span style={{ color: '#fff', fontWeight: 400, fontSize: 11 }}>({ex.muscleGroup})</span>
                    </span>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                      {(() => {
                        const t = ex.targetSets[ex.targetSets.length - 1]?.technique;
                        const lbl = techniqueLabel(t);
                        return lbl ? (
                          <span style={{ fontSize: 9, color: '#f87171', fontWeight: 700 }}>💥 {lbl}</span>
                        ) : null;
                      })()}
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 20,
                          background: supersetExercises.includes(ei)
                            ? supersetMode
                              ? 'rgba(245,158,11,0.16)'
                              : 'rgba(139,92,246,0.16)'
                            : 'rgba(255,255,255,0.06)',
                          color: supersetExercises.includes(ei)
                            ? supersetMode
                              ? '#f59e0b'
                              : '#a78bfa'
                            : 'rgba(255,255,255,0.5)',
                          border: `1px solid ${supersetExercises.includes(ei) ? (supersetMode ? 'rgba(245,158,11,0.22)' : 'rgba(139,92,246,0.22)') : 'rgba(255,255,255,0.06)'}`,
                        }}
                      >
                        {supersetExercises.includes(ei)
                          ? supersetMode
                            ? '🔄 в суперсете'
                            : '⭕ в круге'
                          : supersetMode
                            ? 'нажать чтобы добавить в суперсет'
                            : 'нажать чтобы добавить в круг'}
                      </span>
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: 20,
                      background: supersetExercises.includes(ei)
                        ? supersetMode
                          ? '#f59e0b'
                          : '#8b5cf6'
                        : 'rgba(255,255,255,0.06)',
                      color: supersetExercises.includes(ei) ? '#fff' : 'rgba(255,255,255,0.55)',
                      border: `1px solid ${supersetExercises.includes(ei) ? (supersetMode ? '#f59e0b' : '#8b5cf6') : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {supersetExercises.includes(ei) ? '✓ выбрано' : '+'}
                  </span>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, flex: 1 }}>
                    {ex.name} <span style={{ color: '#fff', fontWeight: 400 }}>({ex.muscleGroup})</span>
                    {(() => {
                      const t = ex.targetSets[ex.targetSets.length - 1]?.technique;
                      const lbl = techniqueLabel(t);
                      return lbl ? (
                        <span
                          style={{ fontSize: 9, marginLeft: 6, color: '#f87171', fontWeight: 700 }}
                          title="Техника на последнем подходе"
                        >
                          💥 {lbl}
                        </span>
                      ) : null;
                    })()}
                    {(() => {
                      const isCompound = ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'legs'].includes(
                        ex.muscleGroup?.toLowerCase() || '',
                      );
                      const t = TEMPO_PRESETS[recommendTempo('hypertrophy', isCompound ? 'compound' : 'isolation')];
                      return (
                        <span style={{ fontSize: 9, color: 'var(--text-faint)', marginLeft: 6 }} title={t?.nameRu}>
                          ⏱ {formatTempo(t?.tempo)}
                        </span>
                      );
                    })()}
                    <button
                      type="button"
                      aria-expanded={!!techOpen[ex.name]}
                      onClick={() => {
                        hapticImpact('light');
                        setTechOpen((p) => ({ ...p, [ex.name]: !p[ex.name] }));
                      }}
                      style={{
                        marginLeft: 6,
                        padding: '3px 8px',
                        borderRadius: 8,
                        fontSize: 9,
                        cursor: 'pointer',
                        border: techOpen[ex.name]
                          ? '1px solid rgba(0,230,138,0.30)'
                          : '1px solid rgba(255,255,255,0.10)',
                        background: techOpen[ex.name]
                          ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(16,185,129,0.08))'
                          : 'rgba(255,255,255,0.04)',
                        color: techOpen[ex.name] ? '#00e68a' : '#fff',
                        fontWeight: 600,
                      }}
                    >
                      📖 {techOpen[ex.name] ? 'Скрыть' : 'Техника'}
                    </button>
                    {techOpen[ex.name] &&
                      (() => {
                        const cat = EXERCISE_CATALOG.find(
                          (c) => (c.name || '').toLowerCase() === (ex.name || '').toLowerCase(),
                        );
                        const tech = cat?.technique;
                        if (!tech)
                          return (
                            <div
                              style={{
                                marginTop: 6,
                                padding: '6px 8px',
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                fontSize: 10,
                                color: '#fff',
                              }}
                            >
                              Нет данных по технике для «{ex.name}»
                            </div>
                          );
                        return (
                          <div
                            style={{
                              marginTop: 6,
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: 'rgba(0,230,138,0.05)',
                              border: '1px solid rgba(0,230,138,0.14)',
                              fontSize: 10,
                              color: '#fff',
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ color: '#00e68a', fontWeight: 700 }}>🎯 Техника:</span> {tech}
                          </div>
                        );
                      })()}
                  </div>
                  {!(ei === currentExIdx || !!exOpen[ei]) && (
                    <button
                      type="button"
                      data-act="open-exercise"
                      onClick={() => {
                        hapticImpact('light');
                        setExOpen((p) => ({ ...p, [ei]: true }));
                      }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                        minHeight: 34,
                      }}
                    >
                      ▶ Развернуть
                    </button>
                  )}
                </div>
              )}

              {/* индикатор прогресса упражнения */}
              <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
                {ex.targetSets.map((_, si) => (
                  <div
                    key={si}
                    style={{
                      width: 24,
                      height: 8,
                      borderRadius: 4,
                      background: loggedSet[keyFor(ei, si)] ? '#00e68a' : 'rgba(255,255,255,0.1)',
                      transition: 'background 0.3s ease',
                    }}
                  />
                ))}
                <span style={{ fontSize: 9, color: '#fff', marginLeft: 4 }}>
                  {ex.targetSets.filter((_, si) => loggedSet[keyFor(ei, si)]).length}/{ex.targetSets.length}
                </span>
              </div>
              {(ei === currentExIdx || !!exOpen[ei]) && (
                <MindsetApproachHint
                  focus={focus}
                  exerciseStarted={ex.targetSets.some((_, si) => !!loggedSet[keyFor(ei, si)])}
                />
              )}
              {/* Свёрнутое упражнение: вместо редакторов — цель одной строкой. */}
              {!(ei === currentExIdx || !!exOpen[ei]) &&
                (() => {
                  const t0 = ex.targetSets[0];
                  if (!t0) return null;
                  const tLast = ex.targetSets[ex.targetSets.length - 1];
                  const w = t0.weight === tLast.weight ? `${t0.weight}` : `${t0.weight}–${tLast.weight}`;
                  return (
                    <div data-pl="ex-summary" style={{ fontSize: 10, color: '#fff', opacity: 0.72, marginTop: 3 }}>
                      цель {ex.targetSets.length}×{t0.reps} · {w} кг
                    </div>
                  );
                })()}
              {/* Суперсет/круг — визуальная последовательность и отдых */}
              {(supersetMode || circuitMode) && supersetExercises.length > 1 && (
                <div
                  style={{
                    marginTop: 6,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: supersetMode ? 'rgba(245,158,11,0.08)' : 'rgba(139,92,246,0.08)',
                    border: `1px solid ${supersetMode ? 'rgba(245,158,11,0.22)' : 'rgba(139,92,246,0.22)'}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: supersetMode ? '#f59e0b' : '#8b5cf6',
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{supersetMode ? '🔄 Суперсет:' : '⭕ Круг:'}</span>
                    <span style={{ fontSize: 9, color: '#fff', opacity: 0.7 }}>
                      отдых {getSupersetRestTime()}с между упр.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {supersetExercises.map((exIdx, order) => (
                      <span
                        key={exIdx}
                        style={{
                          fontSize: 9,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: exIdx === ei ? (supersetMode ? '#f59e0b' : '#8b5cf6') : 'rgba(255,255,255,0.10)',
                          color: exIdx === ei ? '#000' : '#fff',
                          fontWeight: exIdx === ei ? 800 : 600,
                          border:
                            exIdx === ei
                              ? `1px solid ${supersetMode ? '#f59e0b' : '#8b5cf6'}`
                              : '1px solid rgba(255,255,255,0.12)',
                          boxShadow:
                            exIdx === ei
                              ? supersetMode
                                ? '0 0 8px rgba(245,158,11,0.4)'
                                : '0 0 8px rgba(139,92,246,0.4)'
                              : 'none',
                        }}
                      >
                        {order + 1}. {day?.exercises[exIdx]?.name || `Упр ${exIdx + 1}`}
                        {exIdx === ei && (
                          <span style={{ marginLeft: 4, color: supersetMode ? '#fff200' : '#fff' }}>← ТЫ</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ex.targetSets.map((t, si) => {
                const k = keyFor(ei, si);
                const a = vals[k] || {
                  weight: vbtOverride[k] ?? t.weight,
                  reps: t.reps,
                  rpe: 0,
                  rir: undefined,
                  tempo: undefined,
                };
                const plannedTempo = tempoText(t.tempo);
                const logged = !!loggedSet[k];
                // Текущий подход — первый незаписанный (или раскрытый пользователем);
                // остальные ждут строкой в очереди, а не полным редактором на весь экран.
                const firstUnlogged = ex.targetSets.findIndex((_, si2) => !loggedSet[keyFor(ei, si2)]);
                const isCurrent = (ei === currentExIdx || !!exOpen[ei]) && (si === firstUnlogged || !!openSet[k]);
                const targetRPE = 10 - t.rir;
                const dW = a.weight - t.weight;
                const dR = a.reps - t.reps;
                const rpeDelta = a.rpe > 0 ? a.rpe - targetRPE : 0;
                const nextW =
                  a.rpe > 0
                    ? rpeDelta > 0
                      ? Math.max(0, a.weight - 2.5)
                      : rpeDelta < -1
                        ? a.weight + 2.5
                        : a.weight
                    : a.weight;
                const nextR = a.rpe > 0 ? (rpeDelta > 1 ? Math.max(1, a.reps - 1) : a.reps) : a.reps;
                const bestForEx = exerciseBests.get(normalizeExerciseName(ex.name));
                const intensity = setIntensity(a.weight, a.reps, bestForEx);
                // Записанный подход — одной строкой: степперы уже сделанных подходов
                // в зале только удлиняют прокрутку до текущего сета.
                if (logged && !editSet[k]) {
                  return (
                    <div key={si} style={{ ...ROW, flexWrap: 'nowrap', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 800, width: 52 }}>✓ {si + 1}</span>
                      <span style={{ color: '#fff', fontSize: 11, flex: 1, minWidth: 0 }}>
                        {a.weight} кг × {a.reps}
                        {a.rir != null ? ` · RIR ${a.rir}` : ''}
                        {a.rpe ? ` · RPE ${a.rpe}` : ''}
                      </span>
                      <button
                        type="button"
                        data-act="edit-set"
                        onClick={() => setEditSet((p) => ({ ...p, [k]: true }))}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'rgba(255,255,255,0.04)',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        ✎ Изменить
                      </button>
                    </div>
                  );
                }
                return (
                  <div key={si} style={{ ...ROW, flexWrap: 'wrap', gap: 6, ...(isCurrent ? {} : { display: 'none' }) }}>
                    <span style={{ color: '#fff', fontSize: 11, width: 52 }}>Сет {si + 1}</span>
                    <span style={{ color: '#fff', fontSize: 11, width: 90 }}>
                      цель {t.weight}кг×{t.reps}@RIR{t.rir}
                    </span>
                    {t.technique && (
                      <span
                        style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}
                        title={
                          techniqueChainParts({
                            workSets: [{ reps: t.reps, weight: t.weight, rir: t.rir, technique: t.technique }],
                          })?.parts.join(' → ') || ''
                        }
                      >
                        💥 {techniqueLabel(t.technique)}
                      </span>
                    )}
                    {t.weight > 0 && (
                      <span style={{ fontSize: 9, color: 'var(--text-faint)', width: '100%', paddingLeft: 52 }}>
                        🏋️ {formatPlates(t.weight, ex.name)}
                      </span>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                      {/* Предыдущая сессия — инлайн сравнение */}
                      {(() => {
                        const prev = last;
                        if (!prev) return null;
                        const prevEx = prev.exercises.find(
                          (e) => e.exerciseName.toLowerCase() === ex.name.toLowerCase(),
                        );
                        if (!prevEx || !prevEx.sets.length) return null;
                        const lastSet = prevEx.sets[prevEx.sets.length - 1];
                        const prev1RM = Math.round(lastSet.weightKg * (1 + lastSet.reps / 30));
                        const target1RM = Math.round(t.weight * (1 + t.reps / 30));
                        const wDiff = lastSet.weightKg - t.weight;
                        const rDiff = lastSet.reps - t.reps;
                        return (
                          <div
                            style={{
                              padding: '6px 8px',
                              borderRadius: 8,
                              background: 'rgba(59,130,246,0.06)',
                              border: '1px solid rgba(59,130,246,0.15)',
                              fontSize: 10,
                            }}
                          >
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ color: '#60a5fa', fontWeight: 700 }}>
                                📅 {prev.date} · {prevEx.sets.length} подх.
                              </span>
                              <span style={{ color: wDiff === 0 ? '#fff' : wDiff > 0 ? '#22c55e' : '#f59e0b' }}>
                                вес {wDiff > 0 ? '+' : ''}
                                {wDiff}кг
                              </span>
                              <span style={{ color: rDiff === 0 ? '#fff' : rDiff > 0 ? '#22c55e' : '#f59e0b' }}>
                                повт {rDiff > 0 ? '+' : ''}
                                {rDiff}
                              </span>
                              <span style={{ color: '#fff' }}>RPE {lastSet.rpe}</span>
                              <span style={{ color: '#60a5fa', fontWeight: 600 }}>1RM {prev1RM}кг</span>
                              <span style={{ color: '#fff', opacity: 0.6 }}>цель {target1RM}кг</span>
                            </div>
                          </div>
                        );
                      })()}
                      {/* Вес + повторы — крупные степперы для зала */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 10,
                            padding: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              hapticImpact('light');
                              setActual((p) => ({
                                ...p,
                                [k]: { ...a, weight: Math.max(0, Math.round((a.weight - 2.5) * 10) / 10) },
                              }));
                            }}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 10,
                              border: '1px solid rgba(255,255,255,0.10)',
                              background: 'rgba(255,255,255,0.06)',
                              color: '#fff',
                              fontSize: 18,
                              fontWeight: 800,
                              flexShrink: 0,
                              cursor: 'pointer',
                            }}
                          >
                            −
                          </button>
                          <input
                            style={{
                              ...IN,
                              flex: 1,
                              minWidth: 0,
                              textAlign: 'center',
                              fontSize: 16,
                              fontWeight: 700,
                              padding: '6px 2px',
                            }}
                            type="number"
                            inputMode="decimal"
                            value={a.weight}
                            onChange={(e) => setActual((p) => ({ ...p, [k]: { ...a, weight: +e.target.value } }))}
                            aria-label="вес"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              hapticImpact('light');
                              setActual((p) => ({
                                ...p,
                                [k]: { ...a, weight: Math.round((a.weight + 2.5) * 10) / 10 },
                              }));
                            }}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 10,
                              border: '1px solid rgba(0,230,138,0.22)',
                              background: 'rgba(0,230,138,0.12)',
                              color: '#00e68a',
                              fontSize: 18,
                              fontWeight: 800,
                              flexShrink: 0,
                              cursor: 'pointer',
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 10,
                            padding: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              hapticImpact('light');
                              setActual((p) => ({ ...p, [k]: { ...a, reps: Math.max(1, a.reps - 1) } }));
                            }}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 10,
                              border: '1px solid rgba(255,255,255,0.10)',
                              background: 'rgba(255,255,255,0.06)',
                              color: '#fff',
                              fontSize: 18,
                              fontWeight: 800,
                              flexShrink: 0,
                              cursor: 'pointer',
                            }}
                          >
                            −
                          </button>
                          <input
                            style={{
                              ...IN,
                              flex: 1,
                              minWidth: 0,
                              textAlign: 'center',
                              fontSize: 16,
                              fontWeight: 700,
                              padding: '6px 2px',
                            }}
                            type="number"
                            inputMode="numeric"
                            value={a.reps}
                            onChange={(e) => setActual((p) => ({ ...p, [k]: { ...a, reps: +e.target.value } }))}
                            aria-label="повт"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              hapticImpact('light');
                              setActual((p) => ({ ...p, [k]: { ...a, reps: a.reps + 1 } }));
                            }}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 10,
                              border: '1px solid rgba(0,230,138,0.22)',
                              background: 'rgba(0,230,138,0.12)',
                              color: '#00e68a',
                              fontSize: 18,
                              fontWeight: 800,
                              flexShrink: 0,
                              cursor: 'pointer',
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {!loggedSet[k] && prefill[k] && prefill[k].weight !== t.weight && (
                        <div data-pl="set-prefill" style={{ fontSize: 10, color: '#60a5fa', paddingLeft: 2 }}>
                          ↺ из прошлой тренировки: {prefill[k].weight} кг × {prefill[k].reps} — подтвердите «OK»
                        </div>
                      )}
                      {/* Сколько это от личного лучшего: абсолютный вес без базы не читается */}
                      {intensity.pct !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 10 }}>
                          <span
                            data-pl-set-intensity={intensity.zone}
                            title={`e1RM подхода ${intensity.e1rm} кг · лучший ${intensity.bestE1RM} кг (${bestForEx?.weight}×${bestForEx?.reps}, ${bestForEx?.date})`}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontWeight: 800,
                              color: intensity.color,
                              background: `${intensity.color}18`,
                              border: `1px solid ${intensity.color}3a`,
                            }}
                          >
                            {intensity.isRecord ? '🏆' : '🎯'} {intensity.pct}% от лучшего
                          </span>
                          <span style={{ color: '#fff', opacity: 0.6 }}>
                            {intensity.label} · лучший {intensity.bestE1RM} кг
                          </span>
                          {intensity.isRecord && !logged && (
                            <span style={{ color: '#00e68a', fontWeight: 700 }}>рекорд, если запишете</span>
                          )}
                        </div>
                      )}
                      {/* RPE пилюли + VBT + кнопки */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                          {[6, 7, 8, 9, 10].map((v) => (
                            <button
                              key={v}
                              type="button"
                              aria-pressed={a.rpe === v}
                              onClick={() => {
                                hapticImpact('light');
                                setActual((p) => ({ ...p, [k]: { ...a, rpe: v } }));
                              }}
                              style={{
                                minWidth: 32,
                                height: 32,
                                borderRadius: 8,
                                border:
                                  a.rpe === v ? '1px solid rgba(0,230,138,0.30)' : '1px solid rgba(255,255,255,0.08)',
                                background:
                                  a.rpe === v
                                    ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(16,185,129,0.10))'
                                    : 'rgba(255,255,255,0.04)',
                                color: a.rpe === v ? '#00e68a' : 'rgba(255,255,255,0.70)',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {v}
                            </button>
                          ))}
                          <input
                            style={{ ...IN, width: 44, textAlign: 'center', padding: '6px 2px', fontSize: 11 }}
                            type="number"
                            min={0}
                            max={10}
                            placeholder="RPE"
                            value={a.rpe || ''}
                            onChange={(e) => {
                              const v = +e.target.value;
                              setActual((p) => ({
                                ...p,
                                [k]: { ...a, rpe: Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0 },
                              }));
                            }}
                            aria-label="RPE"
                          />
                          <input
                            style={{ ...IN, width: 48, textAlign: 'center', padding: '6px 2px', fontSize: 11 }}
                            type="number"
                            min={0}
                            max={20}
                            placeholder="RIR"
                            value={a.rir ?? ''}
                            onChange={(e) => {
                              const v = +e.target.value;
                              setActual((p) => ({
                                ...p,
                                [k]: { ...a, rir: Number.isFinite(v) ? Math.max(0, Math.min(20, v)) : undefined },
                              }));
                            }}
                            aria-label="RIR факт"
                          />
                          <input
                            style={{ ...IN, width: 74, textAlign: 'center', padding: '6px 4px', fontSize: 11 }}
                            type="text"
                            placeholder={plannedTempo ? `темп ${plannedTempo}` : 'темп факт'}
                            value={a.tempo ?? ''}
                            onChange={(e) => setActual((p) => ({ ...p, [k]: { ...a, tempo: e.target.value } }))}
                            aria-label="темп факт"
                          />
                        </div>
                        <input
                          style={{ ...IN, width: 56, textAlign: 'center', padding: '6px 4px', fontSize: 11 }}
                          type="number"
                          step="0.01"
                          placeholder="v м/с"
                          value={vel[k] ?? ''}
                          onChange={(e) => setVel((p) => ({ ...p, [k]: +e.target.value }))}
                          aria-label="скорость м/с"
                        />
                        <PLSetVideoButton
                          date={localIsoDate()}
                          exercise={ex.name}
                          setNumber={si + 1}
                          onNote={(msg) => setVideoNote({ key: k, msg })}
                        />
                        <button
                          style={{
                            ...(logged
                              ? BTN_GHOST
                              : {
                                  ...BTN,
                                  background: 'linear-gradient(135deg,#00e68a,#00c853)',
                                  boxShadow: '0 4px 14px rgba(0,230,138,0.28)',
                                  minHeight: 44,
                                  padding: '10px 14px',
                                  borderRadius: 12,
                                  fontSize: 14,
                                }),
                            flexShrink: 0,
                            minWidth: 68,
                          }}
                          onClick={() => logOne(ei, si)}
                        >
                          {logged ? '✓' : 'OK'}
                        </button>
                        {!logged && (
                          <button
                            style={{
                              ...BTN_GHOST,
                              fontSize: 11,
                              padding: '10px 10px',
                              borderRadius: 12,
                              minHeight: 44,
                            }}
                            onClick={() => {
                              hapticImpact('light');
                              // «Быстро» = сделал по плану, самооценки нет: RPE плана не
                              // выдаём за измеренный (иначе sRPE врёт). Вес — план, при
                              // нулевом плане — подсказка прошлой тренировки.
                              const quickWeight = t.weight > 0 ? t.weight : weightFor(ex);
                              setActual((p) => ({
                                ...p,
                                [k]: {
                                  weight: quickWeight,
                                  reps: t.reps,
                                  rpe: 0,
                                  // Плановый RIR не выдаём за введённый: иначе правка
                                  // сета посчитала бы из него измеренный RPE.
                                  rir: undefined,
                                  tempo: plannedTempo,
                                },
                              }));
                              // Явные значения: `setTimeout(logOne)` читал старый `vals`
                              // и записывал план предыдущего рендера.
                              logOne(ei, si, {
                                weight: quickWeight,
                                reps: t.reps,
                                rpe: 0,
                                rir: undefined,
                                tempo: plannedTempo,
                              });
                            }}
                          >
                            ⚡ Быстро
                          </button>
                        )}
                        {logError?.key === k && (
                          <div
                            role="alert"
                            data-pl="log-error"
                            style={{
                              width: '100%',
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#f87171',
                              background: 'rgba(248,113,113,0.10)',
                              border: '1px solid rgba(248,113,113,0.25)',
                              borderRadius: 8,
                              padding: '5px 8px',
                            }}
                          >
                            ⚠ {logError.msg}
                          </div>
                        )}
                        {videoNote?.key === k && (
                          <div
                            data-pl="set-video-note"
                            style={{
                              width: '100%',
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#60a5fa',
                              background: 'rgba(96,165,250,0.08)',
                              border: '1px solid rgba(96,165,250,0.22)',
                              borderRadius: 8,
                              padding: '5px 8px',
                            }}
                          >
                            {videoNote.msg}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* кнопка пропуска упражнения */}
                    {(() => {
                      const allLogged = ex.targetSets.every((_, si) => !!loggedSet[keyFor(ei, si)]);
                      if (allLogged || ex.targetSets.length === 0) return null;
                      return (
                        <button
                          style={{
                            width: '100%',
                            marginTop: 4,
                            minHeight: 40,
                            padding: '10px 0',
                            borderRadius: 10,
                            border: '1px dashed rgba(255,255,255,0.12)',
                            background: 'transparent',
                            color: 'var(--text-faint)',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                          onClick={() => skipExercise(ei)}
                        >
                          ⏭ Пропустить упражнение (залогировать планом)
                        </button>
                      );
                    })()}
                    {logged && (
                      <div
                        style={{
                          width: '100%',
                          fontSize: 10,
                          color: '#fff',
                          paddingLeft: 56,
                          display: 'flex',
                          gap: 10,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: '#fff' }}>🏋️ {formatPlates(a.weight, ex.name)}</span>
                        <span>
                          факт{' '}
                          <b style={{ color: '#fff' }}>
                            {a.weight}кг×{a.reps}
                          </b>
                          {a.rpe > 0 ? `@RPE${a.rpe}` : ''}
                        </span>
                        <span style={{ color: dW === 0 ? '#fff' : dW > 0 ? '#22c55e' : '#f59e0b' }}>
                          Δвес {dW > 0 ? '+' : ''}
                          {dW}
                        </span>
                        <span style={{ color: dR === 0 ? '#fff' : dR > 0 ? '#22c55e' : '#f59e0b' }}>
                          Δповт {dR > 0 ? '+' : ''}
                          {dR}
                        </span>
                        {a.rpe > 0 && (
                          <span style={{ color: rpeDelta > 0 ? '#ef4444' : rpeDelta < -1 ? '#22c55e' : '#fff' }}>
                            RPE vs цели({targetRPE}): {rpeDelta > 0 ? '+' : ''}
                            {rpeDelta}
                          </span>
                        )}
                        {a.rpe > 0 && (rpeDelta > 0 || rpeDelta < -1) && (
                          <span style={{ color: ACCENT, fontWeight: 700 }}>
                            → след. сет: {nextW}кг×{nextR}
                            {rpeDelta > 0 ? ' (легче)' : ' (тяжелее)'}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Авто-предложение прогрессии после залогированного сета */}
                    {logged && a.rpe > 0 && si === ex.targetSets.length - 1 && (
                      <div
                        style={{
                          width: '100%',
                          paddingLeft: 56,
                          marginTop: 4,
                          padding: '6px 8px',
                          borderRadius: 8,
                          background: 'rgba(245,158,11,0.08)',
                          border: '1px solid rgba(245,158,11,0.18)',
                          fontSize: 10,
                        }}
                      >
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>📈 Прогрессия: </span>
                        {(() => {
                          const inc = a.weight >= 40 ? 2.5 : 1;
                          if (a.rpe <= 7 && a.reps >= t.reps) {
                            return (
                              <span style={{ color: '#22c55e' }}>
                                ✅ цель достигнута легко → след. сет {a.weight + inc}кг×{t.reps} (или +1-2 повт)
                              </span>
                            );
                          }
                          if (a.rpe >= 9) {
                            return (
                              <span style={{ color: '#ef4444' }}>
                                ⚠ слишком тяжело → держи {a.weight}кг, добери повторы до {t.reps}
                              </span>
                            );
                          }
                          if (a.reps < t.reps) {
                            return (
                              <span style={{ color: '#f59e0b' }}>
                                🔄 недобор повт → повтори {a.weight}кг, цель {t.reps}
                              </span>
                            );
                          }
                          return (
                            <span style={{ color: '#fff' }}>
                              ➡ держи {a.weight}кг×{t.reps}, следующая неделя +{a.weight >= 40 ? 2.5 : 1}кг
                            </span>
                          );
                        })()}
                      </div>
                    )}
                    {/* MMC-трекинг */}
                    <span
                      style={{
                        fontSize: 8,
                        color: '#fff',
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderBottom: '1px dashed rgba(255,255,255,0.15)',
                      }}
                      onClick={() => setMMCOpen(mmco === k ? '' : k)}
                    >
                      {mmco === k ? '🔼 скрыть MMC' : '🔽 MMC/Пампинг/Суставы'}
                    </span>
                    {mmco === k && (
                      <div style={{ width: '100%', display: 'flex', gap: 8, padding: '4px 0' }}>
                        {(
                          [
                            ['mmc', '🧠 MMC', 7],
                            ['pump', '💪 Пампинг', 6],
                            ['joint', '🦵 Суставы', 0],
                            ['energy', '⚡ Энергия', 7],
                          ] as any[]
                        ).map((item: any[]) => {
                          const f = item[0];
                          const label = item[1];
                          const def = item[2];
                          const valKey = k + '_' + f;
                          return (
                            <label
                              key={f}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#fff' }}
                            >
                              <span style={{ minWidth: 42 }}>{label}</span>
                              <input
                                style={{
                                  width: 32,
                                  padding: '2px 4px',
                                  borderRadius: 4,
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  background: 'rgba(255,255,255,0.04)',
                                  color: '#fff',
                                  fontSize: 9,
                                  textAlign: 'center',
                                }}
                                type="number"
                                min={0}
                                max={10}
                                value={mmcVals[valKey] ?? def}
                                onChange={(e) => setMMCVals((p) => ({ ...p, [valKey]: +e.target.value }))}
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Подходы, до которых ещё не дошли: строка вместо полного редактора. */}
              {(() => {
                // У свёрнутого упражнения очередь не нужна — оно живёт одной шапкой.
                if (!(ei === currentExIdx || !!exOpen[ei])) return null;
                const firstUnlogged = ex.targetSets.findIndex((_, si) => !loggedSet[keyFor(ei, si)]);
                const queued = ex.targetSets
                  .map((t, si) => ({ t, si, k: keyFor(ei, si) }))
                  .filter(({ si, k }) => !loggedSet[k] && si !== firstUnlogged && !openSet[k]);
                if (queued.length === 0) return null;
                return (
                  <div data-pl="set-queue" style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                    {queued.map(({ t, si, k }) => (
                      <div key={k} style={{ ...ROW, gap: 8, alignItems: 'center', opacity: 0.82 }}>
                        <span style={{ color: 'var(--text-faint)', fontSize: 11, width: 52 }}>Сет {si + 1}</span>
                        <span style={{ color: '#fff', fontSize: 11, flex: 1, minWidth: 0 }}>
                          {t.weight} кг × {t.reps} · RIR {t.rir}
                        </span>
                        <button
                          type="button"
                          data-act="open-set"
                          onClick={() => {
                            hapticImpact('light');
                            setOpenSet((p) => ({ ...p, [k]: true }));
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.04)',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: 'pointer',
                            flexShrink: 0,
                            minHeight: 34,
                          }}
                        >
                          ▶ Открыть
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* P11 + Фаза 6, п.7: VBT-замкнутый контур — скорость уже сделанных подходов
                  пересчитывает СЛЕДУЮЩИЙ подход. Рекомендация не применяется молча:
                  пользователь видит причину и нажимает «Применить». */}
              {(() => {
                const samples: VBTSetSample[] = [];
                ex.targetSets.forEach((t, si) => {
                  const v = vel[keyFor(ei, si)];
                  if (!v || v <= 0) return;
                  const av = vals[keyFor(ei, si)];
                  samples.push({ weight: av?.weight ?? t.weight, reps: av?.reps ?? t.reps, velocity: v });
                });
                if (samples.length === 0) return null;
                const nextIdx = ex.targetSets.findIndex(
                  (_, si) => !loggedSet[keyFor(ei, si)] && !(vel[keyFor(ei, si)] > 0),
                );
                const plannedNext = nextIdx >= 0 ? ex.targetSets[nextIdx].weight : 0;
                const advice = adviseVBTNextSet({ samples, plannedNextWeight: plannedNext, intent: vbtIntent });
                const thr = advice.thresholdPct;
                const vl = velocityLoss(
                  samples.map((v2) => v2.velocity),
                  thr,
                );
                const over = !!vl?.exceeded;
                const k2 = nextIdx >= 0 ? keyFor(ei, nextIdx) : '';
                const applied = k2 ? vbtOverride[k2] : undefined;
                const canApply =
                  nextIdx >= 0 && advice.nextWeight != null && advice.deltaKg !== 0 && applied === undefined;
                return (
                  <div
                    data-pl="vbt-loop"
                    style={{
                      marginTop: 6,
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: over ? 'rgba(239,68,68,0.1)' : 'rgba(0,230,138,0.08)',
                      border: '1px solid ' + (over ? 'rgba(239,68,68,0.3)' : 'rgba(0,230,138,0.2)'),
                    }}
                  >
                    {vl && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: over ? '#ef4444' : ACCENT }}>
                        ⚡ VBT: потеря скорости {vl.lossPct}% ({vl.bestVelocity}→{vl.lastVelocity} м/с, порог {thr}%)
                      </div>
                    )}
                    {vl && (
                      <div style={{ fontSize: 10, color: '#fff' }}>
                        {over
                          ? '🔴 СТОП — порог превышен, заканчивайте подход'
                          : '🟢 ещё ~' + vl.remainingReps + ' повторов до порога'}{' '}
                        · {velocityLossZone(vl.lossPct)}
                      </div>
                    )}
                    <div data-pl="vbt-advice" style={{ fontSize: 10, color: '#fff', marginTop: 3, fontWeight: 700 }}>
                      {advice.action === 'decrease'
                        ? '⬇ '
                        : advice.action === 'increase'
                          ? '⬆ '
                          : advice.action === 'hold'
                            ? '➡ '
                            : '⚪ '}
                      {advice.reason}
                    </div>
                    {applied !== undefined && (
                      <div data-pl="vbt-applied" style={{ fontSize: 10, color: ACCENT, marginTop: 2 }}>
                        ✓ применено к сету {nextIdx + 1}: {applied} кг (план {plannedNext} кг)
                      </div>
                    )}
                    {canApply && (
                      <button
                        type="button"
                        data-pl="vbt-apply"
                        onClick={() => {
                          hapticImpact('light');
                          const w = advice.nextWeight as number;
                          setVbtOverride((p) => ({ ...p, [k2]: w }));
                        }}
                        style={{
                          marginTop: 4,
                          minHeight: 34,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid rgba(0,230,138,0.3)',
                          background: 'rgba(0,230,138,0.10)',
                          color: ACCENT,
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Применить к сету {nextIdx + 1}: {advice.nextWeight} кг (план {plannedNext})
                      </button>
                    )}
                    <div style={{ fontSize: 9, color: '#fff', opacity: 0.6, marginTop: 3, lineHeight: 1.4 }}>
                      {advice.notes[0]}
                    </div>
                  </div>
                );
              })()}
              <div
                style={{
                  display: 'flex',
                  gap: 5,
                  marginTop: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                  }}
                >
                  VBT
                </span>
                {(['strength', 'hypertrophy', 'power_heavy', 'speed'] as VBTIntent[]).map((it) => {
                  const active = vbtIntent === it;
                  const label =
                    it === 'strength'
                      ? '💪 Сила'
                      : it === 'hypertrophy'
                        ? '🏋️ Гипер'
                        : it === 'power_heavy'
                          ? '⚡ Мощь'
                          : '🚀 Скорость';
                  return (
                    <button
                      key={it}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        hapticImpact('light');
                        setVbtIntent(it);
                      }}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: active ? '1px solid rgba(0,230,138,0.30)' : '1px solid rgba(255,255,255,0.08)',
                        background: active
                          ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(16,185,129,0.08))'
                          : 'rgba(255,255,255,0.04)',
                        color: active ? '#00e68a' : 'rgba(255,255,255,0.75)',
                        boxShadow: active ? '0 2px 10px rgba(0,230,138,0.14)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {/* таймер отдыха для этого упражнения */}
              {timerRunning && timerExIdx === ei && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'rgba(0,230,138,0.06)',
                    border: '1px solid rgba(0,230,138,0.15)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#fff' }}>⏱ Отдых</span>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: timerSec <= 10 ? '#f59e0b' : ACCENT,
                        animation: timerSec <= 10 && timerSec > 0 ? 'pulse 1s ease-in-out infinite' : 'none',
                        transition: 'color 0.3s ease',
                      }}
                    >
                      {String(Math.floor(timerSec / 60)).padStart(2, '0')}:{String(timerSec % 60).padStart(2, '0')}
                    </span>
                    <button
                      onClick={skipRestTimer}
                      style={{
                        fontSize: 10,
                        padding: '2px 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'transparent',
                        color: '#fff',
                        cursor: 'pointer',
                        minHeight: 28,
                      }}
                    >
                      Пропустить
                    </button>
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      height: 4,
                      borderRadius: 2,
                      background: 'rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, timerPct)}%`,
                        borderRadius: 2,
                        background: timerSec <= 10 ? '#f59e0b' : ACCENT,
                        transition: 'width 1s linear',
                      }}
                    />
                  </div>
                  {timerSec === 0 && (
                    <div style={{ marginTop: 4, fontSize: 10, color: ACCENT, fontWeight: 600 }}>
                      ✅ Отдых завершён — можно приступать к следующему подходу
                    </div>
                  )}
                </div>
              )}

              {/* пресеты таймера отдыха — современные пилюли */}
              <div
                style={{
                  display: 'flex',
                  gap: 5,
                  marginTop: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                  }}
                >
                  Таймер
                </span>
                {(['compound', 'isolation', 'pump'] as const).map((p) => {
                  const active = timerPreset === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        hapticImpact('light');
                        setTimerPreset(p);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: active ? '1px solid rgba(0,230,138,0.30)' : '1px solid rgba(255,255,255,0.08)',
                        background: active
                          ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(16,185,129,0.08))'
                          : 'rgba(255,255,255,0.04)',
                        color: active ? '#00e68a' : '#fff',
                        boxShadow: active ? '0 2px 10px rgba(0,230,138,0.14)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      {p === 'compound' ? '🏋️ Силовой' : p === 'isolation' ? '🎯 Изоляция' : '⚡ Пампинг'}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={timerPreset === 'custom'}
                  onClick={() => {
                    hapticImpact('light');
                    setTimerPreset('custom');
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border:
                      timerPreset === 'custom' ? '1px solid rgba(0,230,138,0.30)' : '1px solid rgba(255,255,255,0.08)',
                    background:
                      timerPreset === 'custom'
                        ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(16,185,129,0.08))'
                        : 'rgba(255,255,255,0.04)',
                    color: timerPreset === 'custom' ? '#00e68a' : '#fff',
                    transition: 'all 0.2s',
                  }}
                >
                  ⏱ {customRestSec}с
                </button>
                {timerPreset === 'custom' && (
                  <input
                    style={{ ...IN, width: 52, fontSize: 10, padding: '4px 6px', borderRadius: 8 }}
                    type="number"
                    min={30}
                    max={300}
                    value={customRestSec}
                    onChange={(e) => setCustomRestSec(Math.max(30, Math.min(300, +e.target.value)))}
                    aria-label="свой таймер"
                  />
                )}
                <button
                  type="button"
                  aria-pressed={autoStartRest}
                  onClick={() => {
                    hapticImpact('light');
                    setAutoStartRest(!autoStartRest);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: autoStartRest ? '1px solid rgba(0,230,138,0.30)' : '1px solid rgba(255,255,255,0.08)',
                    background: autoStartRest
                      ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(16,185,129,0.08))'
                      : 'rgba(255,255,255,0.04)',
                    color: autoStartRest ? '#00e68a' : 'rgba(255,255,255,0.65)',
                    boxShadow: autoStartRest ? '0 2px 10px rgba(0,230,138,0.12)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {autoStartRest ? '▶ Авто' : '⏸ Ручной'}
                </button>
                <button
                  type="button"
                  aria-pressed={timerSoundSettings.sound}
                  onClick={() => {
                    hapticImpact('light');
                    setTimerSoundSettings((v) => ({ ...v, sound: !v.sound }));
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: timerSoundSettings.sound
                      ? '1px solid rgba(0,230,138,0.30)'
                      : '1px solid rgba(255,255,255,0.08)',
                    background: timerSoundSettings.sound
                      ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(16,185,129,0.08))'
                      : 'rgba(255,255,255,0.04)',
                    color: timerSoundSettings.sound ? '#00e68a' : 'rgba(255,255,255,0.65)',
                    transition: 'all 0.2s',
                  }}
                >
                  {timerSoundSettings.sound ? 'Звук on' : 'Звук off'}
                </button>
                <button
                  type="button"
                  aria-pressed={timerSoundSettings.vibrate}
                  onClick={() => {
                    hapticImpact('light');
                    setTimerSoundSettings((v) => ({ ...v, vibrate: !v.vibrate }));
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: timerSoundSettings.vibrate
                      ? '1px solid rgba(0,230,138,0.30)'
                      : '1px solid rgba(255,255,255,0.08)',
                    background: timerSoundSettings.vibrate
                      ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(16,185,129,0.08))'
                      : 'rgba(255,255,255,0.04)',
                    color: timerSoundSettings.vibrate ? '#00e68a' : 'rgba(255,255,255,0.65)',
                    transition: 'all 0.2s',
                  }}
                >
                  {timerSoundSettings.vibrate ? 'Вибро on' : 'Вибро off'}
                </button>
                <button
                  type="button"
                  aria-pressed={timerSoundSettings.voice}
                  onClick={() => {
                    hapticImpact('light');
                    setTimerSoundSettings((v) => ({ ...v, voice: !v.voice }));
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: timerSoundSettings.voice
                      ? '1px solid rgba(0,230,138,0.30)'
                      : '1px solid rgba(255,255,255,0.08)',
                    background: timerSoundSettings.voice
                      ? 'linear-gradient(135deg, rgba(0,230,138,0.14), rgba(16,185,129,0.08))'
                      : 'rgba(255,255,255,0.04)',
                    color: timerSoundSettings.voice ? '#00e68a' : 'rgba(255,255,255,0.65)',
                    transition: 'all 0.2s',
                  }}
                >
                  {timerSoundSettings.voice ? 'Голос on' : 'Голос off'}
                </button>
              </div>

              {/* кнопка отдыха между упражнениями */}
              <div style={{ marginTop: 6 }}>
                <button
                  onClick={() => startInterExTimer(120)}
                  style={{ ...BTN_GHOST, fontSize: 10, padding: '4px 10px' }}
                >
                  ⏱ Отдых между упражнениями (2 мин)
                </button>
              </div>

              {/* индикация суперсета/круга */}
              {(supersetMode || circuitMode) && supersetExercises.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: supersetMode ? 'rgba(245,158,11,0.08)' : 'rgba(139,92,246,0.08)',
                    border: `1px solid ${supersetMode ? 'rgba(245,158,11,0.3)' : 'rgba(139,92,246,0.3)'}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: supersetMode ? '#f59e0b' : '#8b5cf6',
                      marginBottom: 6,
                    }}
                  >
                    {supersetMode ? '🔄 Суперсет:' : '⭕ Круг:'} {ruCount(supersetExercises.length, RU_EXERCISES)}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {supersetExercises.map((exIdx, order) => (
                      <span
                        key={exIdx}
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                        }}
                      >
                        {order + 1}. {day?.exercises[exIdx]?.name || `Упр ${exIdx + 1}`}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: '#fff', marginTop: 6 }}>
                    {supersetMode
                      ? `Короткий отдых (${getSupersetRestTime()}с) между упражнениями, полный отдых после всех`
                      : 'Минимальный отдых между упражнениями, отдых после завершения круга'}
                  </div>
                </div>
              )}

              {/* таймер между упражнениями */}
              {interExTimerRunning && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.15)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#fff' }}>⏱ Переход к следующему</span>
                    <span
                      style={{ fontSize: 20, fontWeight: 700, color: interExTimerSec <= 10 ? '#f59e0b' : '#60a5fa' }}
                    >
                      {String(Math.floor(interExTimerSec / 60)).padStart(2, '0')}:
                      {String(interExTimerSec % 60).padStart(2, '0')}
                    </span>
                    <button
                      onClick={skipInterExTimer}
                      style={{
                        fontSize: 10,
                        padding: '2px 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'transparent',
                        color: '#fff',
                        cursor: 'pointer',
                        minHeight: 28,
                      }}
                    >
                      Пропустить
                    </button>
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      height: 4,
                      borderRadius: 2,
                      background: 'rgba(255,255,255,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, ((Math.max(1, interExTotalSec) - interExTimerSec) / Math.max(1, interExTotalSec)) * 100)}%`,
                        borderRadius: 2,
                        background: interExTimerSec <= 10 ? '#f59e0b' : '#60a5fa',
                        transition: 'width 1s linear',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          {/* P12: sRPE для мониторинга нагрузки (сохранится при завершении) */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              marginBottom: 8,
              flexWrap: 'wrap',
              padding: '6px 8px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span
              style={{ fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: 0.3, textTransform: 'uppercase' }}
            >
              sRPE
            </span>
            {[6, 7, 8, 9, 10].map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={sessionRPE === r}
                onClick={() => {
                  hapticImpact('light');
                  srpeEditedRef.current = true;
                  setSessionRPE(r);
                }}
                style={{
                  minWidth: 30,
                  padding: '5px 9px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: sessionRPE === r ? '1px solid rgba(0,230,138,0.32)' : '1px solid rgba(255,255,255,0.09)',
                  background:
                    sessionRPE === r
                      ? 'linear-gradient(135deg, rgba(0,230,138,0.16), rgba(16,185,129,0.10))'
                      : 'rgba(255,255,255,0.04)',
                  color: sessionRPE === r ? '#00e68a' : '#fff',
                  boxShadow: sessionRPE === r ? '0 2px 10px rgba(0,230,138,0.16)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {r}
              </button>
            ))}
            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', marginLeft: 2 }}>·</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>мин</span>
            <input
              style={{ ...IN, width: 58, padding: '4px 6px', borderRadius: 8, fontSize: 11, textAlign: 'center' }}
              type="number"
              value={sessionDur}
              onChange={(e) => {
                durEditedRef.current = true;
                setSessionDur(+e.target.value);
              }}
              aria-label="длительность мин"
            />
          </div>

          {/* Раньше из тренировки можно было выйти только тапом по табу фаз
              «Итог» — явной кнопки завершения на экране не было. */}
          <button
            type="button"
            data-act="finish-session"
            onClick={() => exitSession(false)}
            style={{ ...BTN_GHOST, width: '100%', minHeight: 48, marginTop: 12, fontSize: 12, fontWeight: 800 }}
          >
            ✓ Завершить тренировку
          </button>
        </div>
      )}

      {phase === 'cooldown' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={H}>🧘 Заминка: {day.label}</div>
            {(() => {
              const total = cooldownBlocks.reduce((s, b) => s + b.exercises.length, 0);
              const done = Object.values(cooldownDone).filter(Boolean).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const totalSec = cooldownBlocks.reduce((s, b) => s + (b.durationSec || 0), 0);
              return (
                <span style={{ fontSize: 10, fontWeight: 600, color: pct === 100 ? '#22c55e' : ACCENT }}>
                  {done}/{total} · {pct}%{totalSec > 0 ? ` · ~${Math.round((totalSec / 60) * 10) / 10} мин` : ''}
                </span>
              );
            })()}
          </div>
          {(() => {
            const total = cooldownBlocks.reduce((s, b) => s + b.exercises.length, 0);
            const done = Object.values(cooldownDone).filter(Boolean).length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    borderRadius: 2,
                    background: pct === 100 ? '#22c55e' : ACCENT,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            );
          })()}
          {/* Заминка необязательна: раньше кнопка «Завершить и выйти» была
              в самом низу списка блоков — до неё надо было прокрутить всю заминку. */}
          <button
            type="button"
            data-act="cooldown-to-done"
            onClick={() => exitSession()}
            style={{
              ...BTN_GHOST,
              width: '100%',
              minHeight: 44,
              marginBottom: 10,
              fontSize: 12,
              fontWeight: 800,
              color: '#00e68a',
              borderColor: 'rgba(0,230,138,0.30)',
            }}
          >
            ✓ К итогам тренировки
          </button>
          {cooldownBlocks.map((b, i) => {
            const cMeta =
              b.type === 'cardio'
                ? {
                    icon: '🏃',
                    title: 'Лёгкое кардио',
                    color: '#06b6d4',
                    bg: 'rgba(6,182,214,0.08)',
                    border: 'rgba(6,182,214,0.22)',
                  }
                : b.type === 'stretch'
                  ? {
                      icon: '🧘',
                      title: 'Стретчинг',
                      color: '#a78bfa',
                      bg: 'rgba(167,139,250,0.08)',
                      border: 'rgba(167,139,250,0.22)',
                    }
                  : b.type === 'breathing'
                    ? {
                        icon: '🌬️',
                        title: 'Дыхание',
                        color: '#38bdf8',
                        bg: 'rgba(56,189,248,0.08)',
                        border: 'rgba(56,189,248,0.22)',
                      }
                    : {
                        icon: '💆',
                        title: 'Восстановление',
                        color: '#22c55e',
                        bg: 'rgba(34,197,94,0.08)',
                        border: 'rgba(34,197,94,0.22)',
                      };
            const cTotal = b.exercises.length;
            const cDone = b.exercises.filter((_, j) => cooldownDone[`c_${i}_${j}`]).length;
            const cPct = cTotal > 0 ? Math.round((cDone / cTotal) * 100) : 0;
            const cAllDone = cDone === cTotal && cTotal > 0;
            const cCollapsed = cAllDone && !coolOpen[i];
            return (
              <div
                key={i}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 14,
                  padding: '10px 10px 8px',
                  marginBottom: 8,
                  background: cAllDone ? 'rgba(34,197,94,0.06)' : 'var(--glass-bg)',
                  border: `1px solid ${cAllDone ? 'rgba(34,197,94,0.22)' : cMeta.border}`,
                  borderLeft: `3px solid ${cAllDone ? '#22c55e' : cMeta.color}`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  boxShadow: cAllDone ? '0 2px 14px rgba(34,197,94,0.10)' : '0 2px 14px rgba(0,0,0,0.14)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: `linear-gradient(90deg, ${cMeta.color}, transparent)`,
                    opacity: cAllDone ? 0.9 : 0.65,
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: cAllDone
                          ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                          : `linear-gradient(135deg, ${cMeta.color}, ${cMeta.color}CC)`,
                        color: '#fff',
                        fontSize: 14,
                        boxShadow: `0 2px 8px ${cMeta.color}33`,
                      }}
                    >
                      {cAllDone ? '✓' : cMeta.icon}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: cAllDone ? '#22c55e' : cMeta.color,
                          lineHeight: 1,
                        }}
                      >
                        {cMeta.title}
                      </div>
                      <div style={{ fontSize: 9, color: '#fff', lineHeight: 1.2 }}>⏱ {b.durationSec}с</div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '3px 7px',
                      borderRadius: 20,
                      background: cAllDone ? '#22c55e' : cMeta.bg,
                      color: cAllDone ? '#000' : cMeta.color,
                      border: `1px solid ${cAllDone ? 'rgba(34,197,94,0.28)' : cMeta.border}`,
                    }}
                  >
                    {cDone}/{cTotal}
                  </span>
                  {cAllDone && (
                    <button
                      type="button"
                      data-act="cool-toggle"
                      aria-expanded={!cCollapsed}
                      onClick={() => setCoolOpen((o) => ({ ...o, [i]: !o[i] }))}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '3px 7px',
                        borderRadius: 20,
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.07)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                    >
                      {cCollapsed ? 'Развернуть' : 'Свернуть'}
                    </button>
                  )}
                </div>
                {!cCollapsed && (
                  <>
                    {b.notes && (
                      <div
                        style={{
                          fontSize: 9,
                          color: '#fff',
                          lineHeight: 1.35,
                          marginBottom: 7,
                          padding: '5px 8px',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <span style={{ color: cMeta.color, fontWeight: 700 }}>ℹ </span>
                        {b.notes}
                      </div>
                    )}
                    <div
                      style={{
                        height: 3,
                        borderRadius: 2,
                        background: 'rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                        marginBottom: 7,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${cPct}%`,
                          borderRadius: 2,
                          background: cAllDone ? '#22c55e' : cMeta.color,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <ul
                      style={{
                        padding: 0,
                        margin: 0,
                        listStyle: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {b.exercises.map((ex, j) => {
                        const isDone = cooldownDone[`c_${i}_${j}`];
                        const isTimer = coolTimer && coolTimer.i === i && coolTimer.j === j;
                        const clabel = cooldownLabel(ex.exerciseId);
                        return (
                          <li key={j} style={{ listStyle: 'none' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                              <button
                                type="button"
                                data-cool-item={`${i}_${j}`}
                                aria-pressed={isDone}
                                aria-label={`${clabel} — ${isDone ? 'выполнено' : 'отметить'}`}
                                onClick={() => {
                                  hapticImpact(isDone ? 'light' : 'medium');
                                  toggleCooldown(i, j);
                                }}
                                style={{
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 10,
                                  padding: '9px 10px',
                                  borderRadius: 12,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  minWidth: 0,
                                  background: isDone
                                    ? 'linear-gradient(135deg, rgba(34,197,94,0.13), rgba(16,185,129,0.07))'
                                    : 'rgba(255,255,255,0.035)',
                                  border: `1px solid ${isDone ? 'rgba(34,197,94,0.28)' : 'rgba(255,255,255,0.07)'}`,
                                  borderLeft: `3px solid ${isDone ? '#22c55e' : cMeta.color}`,
                                  boxShadow: isDone ? '0 3px 12px rgba(34,197,94,0.14)' : '0 1px 8px rgba(0,0,0,0.10)',
                                  opacity: isDone ? 0.92 : 1,
                                  transition: 'all 0.2s',
                                }}
                              >
                                <span
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 9,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: 1,
                                    background: isDone
                                      ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                                      : `linear-gradient(135deg, ${cMeta.color}, ${cMeta.color}CC)`,
                                    color: '#fff',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    boxShadow: `0 2px 8px ${isDone ? 'rgba(34,197,94,0.28)' : cMeta.color + '33'}`,
                                  }}
                                >
                                  {isDone ? '✓' : j + 1}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                  <span
                                    style={{
                                      fontSize: 11.5,
                                      fontWeight: isDone ? 600 : 700,
                                      color: isDone ? 'rgba(255,255,255,0.78)' : '#fff',
                                      textDecoration: isDone ? 'line-through' : 'none',
                                      lineHeight: 1.35,
                                      display: 'block',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {clabel}
                                  </span>
                                  <span
                                    style={{
                                      display: 'flex',
                                      gap: 6,
                                      flexWrap: 'wrap',
                                      alignItems: 'center',
                                      marginTop: 3,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 800,
                                        padding: '2px 7px',
                                        borderRadius: 20,
                                        background: isDone ? 'rgba(34,197,94,0.14)' : cMeta.bg,
                                        color: isDone ? '#86efac' : cMeta.color,
                                        border: `1px solid ${isDone ? 'rgba(34,197,94,0.22)' : cMeta.border}`,
                                      }}
                                    >
                                      ⏱ {ex.durationSec}с
                                    </span>
                                    {'note' in ex && (ex as any).note && (
                                      <span
                                        style={{
                                          fontSize: 9,
                                          color: isDone ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.62)',
                                          lineHeight: 1.3,
                                        }}
                                      >
                                        {(ex as any).note}
                                      </span>
                                    )}
                                  </span>
                                </span>
                                <span
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 28,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: 1,
                                    background: isDone ? '#22c55e' : 'rgba(255,255,255,0.06)',
                                    color: isDone ? '#000' : 'rgba(255,255,255,0.38)',
                                    border: `1px solid ${isDone ? '#22c55e' : 'rgba(255,255,255,0.09)'}`,
                                    fontSize: 11,
                                    fontWeight: 800,
                                  }}
                                >
                                  {isDone ? '✓' : '○'}
                                </span>
                              </button>
                              {isTimer ? (
                                <span
                                  style={{
                                    minWidth: 48,
                                    alignSelf: 'center',
                                    padding: '6px 8px',
                                    borderRadius: 10,
                                    background: 'linear-gradient(135deg, rgba(56,189,248,0.16), rgba(6,182,214,0.10))',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(56,189,248,0.28)',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    textAlign: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {coolTimer!.remaining}с
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isDone}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isDone) {
                                      hapticImpact('light');
                                      setCoolTimer({ i, j, remaining: ex.durationSec, total: ex.durationSec });
                                    }
                                  }}
                                  style={{
                                    alignSelf: 'center',
                                    padding: '7px 9px',
                                    borderRadius: 10,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    cursor: isDone ? 'not-allowed' : 'pointer',
                                    border: '1px solid rgba(56,189,248,0.22)',
                                    background: isDone ? 'rgba(255,255,255,0.03)' : 'rgba(56,189,248,0.10)',
                                    color: isDone ? 'rgba(255,255,255,0.32)' : '#38bdf8',
                                    flexShrink: 0,
                                    opacity: isDone ? 0.55 : 1,
                                  }}
                                  aria-label={`Таймер ${clabel}`}
                                >
                                  {isDone ? '✓' : '⏱'}
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
          <button style={{ ...BTN, width: '100%', marginTop: 12 }} onClick={() => exitSession()}>
            ✓ Завершить и выйти
          </button>
          <SkipBar
            reasons={COOLDOWN_SKIP_REASONS}
            label="заминку"
            onSkip={(reason) => {
              skipCooldownReasonRef.current = reason;
              exitSession();
            }}
          />
        </div>
      )}

      {phase === 'done' && (
        <div style={CARD}>
          {/* Визуальная шапка итога: кто/сколько/когда — сразу читается */}
          <div
            style={{
              margin: '-12px -12px 10px',
              padding: '12px 12px 10px',
              borderRadius: '14px 14px 0 0',
              background: 'linear-gradient(135deg, rgba(0,230,138,0.18), rgba(96,165,250,0.10))',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,230,138,0.18)',
                border: '1px solid rgba(0,230,138,0.30)',
                fontSize: 17,
                flexShrink: 0,
              }}
            >
              🏁
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>✅ Тренировка завершена</div>
              <div
                style={{
                  fontSize: 10,
                  color: '#fff',
                  opacity: 0.9,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {done?.date} · {done?.startTime}–{done?.endTime} · фокус: {done?.focus}
              </div>
            </div>
            {done && done.durationMin > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '4px 9px',
                  borderRadius: 999,
                  background: 'rgba(0,0,0,0.22)',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }}
              >
                {done.durationMin} мин
              </span>
            )}
          </div>

          {!done && (
            <div
              data-pl="done-empty"
              style={{
                marginBottom: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Подходы не записаны</div>
              <div style={{ fontSize: 10, color: '#fff', opacity: 0.85, lineHeight: 1.4, marginBottom: 8 }}>
                Тренировка закрыта без единого подхода — в дневник ничего не попало.
              </div>
              <button
                type="button"
                data-act="done-back-to-start"
                onClick={() => {
                  setPhase('ready');
                  setDone(null);
                }}
                style={{ ...BTN, width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                ← Вернуться к старту
              </button>
            </div>
          )}

          {/* Отчёт длинный, а сессия уже сохранена: выход — сразу под шапкой итога. */}
          <button
            type="button"
            data-act="session-done-close"
            onClick={() => {
              try {
                window.dispatchEvent(new Event('he-workout-close'));
              } catch {
                /* ignore */
              }
            }}
            style={{ ...BTN, width: '100%', marginBottom: 10 }}
          >
            ✓ Готово — к тренировкам
          </button>

          {/* Сводный отчёт по проведённой тренировке: общий + по упражнениям и мышцам.
              Блоки включаются чекбоксами, выбор запоминается. */}
          {done && (
            <div style={{ marginTop: 8 }}>
              <WorkoutSummaryReport
                workouts={[sessionToWorkoutLog(done)]}
                title="Сводка тренировки"
                subtitle={`${done.focus || 'Тренировка'}${done.durationMin ? ` · ${done.durationMin} мин` : ''}`}
                storageKey="he_workout_done_blocks"
                blocks={doneBlocks}
                onBlocksChange={setDoneBlocks}
                previousWorkouts={doneHistory.slice(0, 1)}
                previousLabel="прошлой тренировкой"
                baselineWorkouts={doneHistory}
                level={profile.level}
                plan={donePlan}
                hide={['next']}
              />
            </div>
          )}

          {/* Психология: чек-ин сессии (уверенность/активация/фокус) */}
          <MindsetCheckinCard sessionId={done?.sessionId} />

          {/* Мобильность: растяжка после тренировки + чек-ин ROM */}
          <MobilityPostPanel sessionId={done?.sessionId} />

          {/* План/факт и метрики дублировали блоки отчёта. Показываем их только
              если соответствующий блок в «Итоге» выключен — экран короче, а
              информация не теряется. */}
          {!doneBlocks.includes('plan') && (
            <>
              <div style={ROW}>
                <span>Объём факт vs план:</span>
                <span style={{ color: ACCENT }}>
                  {factVol.volume} / {planned.volume} кг·пов
                </span>
              </div>
              <div style={ROW}>
                <span>Сеты факт vs план:</span>
                <span style={{ color: ACCENT }}>
                  {factVol.sets} / {planned.sets}
                </span>
              </div>
              <div style={{ ...SMALL, marginTop: 8 }}>
                Реализация объёма: {planned.volume > 0 ? Math.round((factVol.volume / planned.volume) * 100) : 0}%
              </div>
            </>
          )}
          {topE1RM.e1rm > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 10,
                background: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>
                🎯 Оценка 1RM (Epley) по лучшему сету
              </div>
              <div style={{ ...SMALL, marginTop: 4 }}>
                <b style={{ color: '#fff' }}>{topE1RM.exercise}</b>: {topE1RM.weight}кг×{topE1RM.reps} → e1RM ≈{' '}
                <b style={{ color: '#60a5fa' }}>{topE1RM.e1rm} кг</b>
              </div>
              <div style={{ fontSize: 10, color: '#fff', marginTop: 4 }}>
                Обновите workMax для этой группы в профиле, если e1RM выше текущего — веса в плане пересчитаются.
              </div>
            </div>
          )}
          {nextPlan.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 10,
                background: anyDeload ? 'rgba(239,68,68,0.06)' : 'rgba(0,230,138,0.05)',
                border: '1px solid ' + (anyDeload ? 'rgba(239,68,68,0.25)' : 'rgba(0,230,138,0.18)'),
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: anyDeload ? '#ef4444' : ACCENT, marginBottom: 6 }}>
                {anyDeload ? '⚠ Прогрессия + сигнал делода' : '📈 Прогрессия к следующей сессии (double progression)'}
              </div>
              {anyDeload && (
                <div style={{ fontSize: 10, color: '#fca5a5', marginBottom: 6 }}>
                  Высокий RPE на нескольких сетах или плато — сделайте разгрузку: объём −15–20%, интенсивность
                  сохраните. Цель ниже уже с учётом 90%.
                </div>
              )}
              {nextPlan.map((s, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 10,
                    color: '#fff',
                    lineHeight: 1.5,
                    marginBottom: 4,
                    paddingLeft: 4,
                    borderLeft: '2px solid ' + (s.kind === 'deload' ? '#ef4444' : 'rgba(0,230,138,0.4)'),
                  }}
                >
                  <b style={{ color: '#fff' }}>{s.name}</b> {s.from} → <b style={{ color: '#fff' }}>{s.to}</b>.{' '}
                  <span style={{ color: '#fff' }}>{s.note}</span>
                </div>
              ))}
            </div>
          )}
          {/* Подробности сессии: RIR-калибровка, метрики, PR, отдых, сравнение.
              В зале они не нужны сразу — по умолчанию свёрнуты в одну строку. */}
          {hasDoneDetails && (
            <button
              type="button"
              data-act="done-more"
              aria-expanded={doneMoreOpen}
              onClick={() => {
                hapticImpact('light');
                setDoneMoreOpen((v) => !v);
              }}
              style={{
                marginTop: 10,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 10,
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <span>📋 Подробности: RIR-калибровка, метрики, отдых, сравнение</span>
              <span style={{ opacity: 0.7 }}>{doneMoreOpen ? '▲' : '▼'}</span>
            </button>
          )}
          {doneMoreOpen && hasDoneDetails && (
            <>
              {/* RIR-калибровка: фидбек по каждому упражнению */}
              {rirFeedback && rirFeedback.exerciseFeedbacks.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    background:
                      rirFeedback.sessionQuality === 'отлично'
                        ? 'rgba(0,230,138,0.06)'
                        : rirFeedback.sessionQuality === 'плохо'
                          ? 'rgba(239,68,68,0.06)'
                          : 'rgba(234,179,8,0.06)',
                    border:
                      '1px solid ' +
                      (rirFeedback.sessionQuality === 'отлично'
                        ? 'rgba(0,230,138,0.2)'
                        : rirFeedback.sessionQuality === 'плохо'
                          ? 'rgba(239,68,68,0.25)'
                          : 'rgba(234,179,8,0.25)'),
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color:
                        rirFeedback.sessionQuality === 'отлично'
                          ? '#00e68a'
                          : rirFeedback.sessionQuality === 'плохо'
                            ? '#ef4444'
                            : '#eab308',
                      marginBottom: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>🎯 RIR-калибровка: {rirFeedback.sessionQuality}</span>
                    <span style={{ fontSize: 10, fontWeight: 400, color: '#fff' }}>
                      bias {rirFeedback.overallBias > 0 ? '+' : ''}
                      {rirFeedback.overallBias} RIR
                    </span>
                  </div>
                  {rirFeedback.exerciseFeedbacks.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 10,
                        color: '#fff',
                        lineHeight: 1.5,
                        marginBottom: 4,
                        paddingLeft: 4,
                        borderLeft:
                          '2px solid ' +
                          (Math.abs(f.bias) > 1
                            ? '#ef4444'
                            : Math.abs(f.bias) > 0.3
                              ? '#eab308'
                              : 'rgba(0,230,138,0.4)'),
                      }}
                    >
                      <b style={{ color: '#fff' }}>{f.name}</b>
                      <span style={{ color: '#fff' }}>
                        {' '}
                        bias {f.bias > 0 ? '+' : ''}
                        {f.bias} · согласованность {f.consistency}% — {f.recommendation}
                      </span>
                    </div>
                  ))}
                  <div style={{ fontSize: 9, color: '#fff', marginTop: 6 }}>
                    RIR-калибровка накапливается: чем больше подходов с RPE, тем точнее рекомендации.
                  </div>
                </div>
              )}
              {lms && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    background: 'rgba(0,230,138,0.06)',
                    border: '1px solid rgba(0,230,138,0.18)',
                  }}
                >
                  <div style={{ ...LABEL, color: ACCENT }}>
                    {doneBlocks.includes('totals') ? '📊 Интенсивность сессии' : '📊 Метрики сессии'} (
                    {lms.exerciseCount} упр.)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
                    {!doneBlocks.includes('totals') && (
                      <>
                        <div style={SMALL}>
                          Тоннаж: <b style={{ color: '#fff' }}>{Math.round(lms.metrics.tonnage)}</b> кг
                        </div>
                        <div style={SMALL}>
                          КПШ: <b style={{ color: '#fff' }}>{lms.metrics.kpsh}</b>
                        </div>
                      </>
                    )}
                    <div style={SMALL}>
                      Инт.отн: <b style={{ color: '#fff' }}>{lms.metrics.relIntensity.toFixed(3)}</b>
                    </div>
                    <div style={SMALL}>
                      УОИ: <b style={{ color: '#fff' }}>{lms.metrics.uoi.toFixed(3)}</b>
                    </div>
                    <div style={SMALL}>
                      Инт.Ф+Б: <b style={{ color: '#fff' }}>{Math.round(lms.metrics.intFB)}</b>
                    </div>
                    <div style={SMALL}>
                      Ср.вес: <b style={{ color: '#fff' }}>{Math.round(lms.metrics.avgWeight)}</b> кг · {lms.minutes}{' '}
                      мин
                    </div>
                  </div>
                </div>
              )}
              {!doneBlocks.includes('prs') && prs.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={LABEL}>🏆 Последние PR:</div>
                  {prs.map((p, i) => (
                    <div key={i} style={SMALL}>
                      • {p.exercise}: {p.weight}кг×{p.reps} ({p.date})
                    </div>
                  ))}
                </div>
              )}

              {/* история отдыха */}
              {restHistory.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    background: 'rgba(245,158,11,0.06)',
                    border: '1px solid rgba(245,158,11,0.18)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#f59e0b',
                      marginBottom: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>⏱ История отдыха</span>
                    <button
                      onClick={() => setRestHistory([])}
                      style={{
                        fontSize: 9,
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'transparent',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Очистить
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
                    <div style={SMALL}>
                      Всего отдыха:{' '}
                      <b style={{ color: '#fff' }}>
                        {Math.floor(restHistory.reduce((s, r) => s + r.duration, 0) / 60)}
                      </b>{' '}
                      мин
                    </div>
                    <div style={SMALL}>
                      Периодов: <b style={{ color: '#fff' }}>{restHistory.length}</b>
                    </div>
                    <div style={SMALL}>
                      Средний:{' '}
                      <b style={{ color: '#fff' }}>
                        {Math.round(restHistory.reduce((s, r) => s + r.duration, 0) / restHistory.length)}
                      </b>{' '}
                      сек
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 120, overflowY: 'auto' }}>
                    {restHistory.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 9,
                          color: '#fff',
                          padding: '2px 4px',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <span style={{ flex: 1 }}>{r.exercise}</span>
                        <span style={{ color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>
                          {Math.floor(r.duration / 60)}:{String(r.duration % 60).padStart(2, '0')}
                        </span>
                        <span style={{ color: '#fff', marginLeft: 8 }}>{r.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* сравнение с предыдущей сессией */}
              {sessionComparison && sessionComparison.older && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.2)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 6 }}>
                    📊 Сравнение с предыдущей сессией ({sessionComparison.older.date})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
                    {[
                      {
                        label: 'Тоннаж',
                        cur: done?.totalVolume || 0,
                        prev: sessionComparison.older.totalVolume,
                        unit: 'кг',
                        isKg: true,
                      },
                      {
                        label: 'Подходы',
                        cur: done?.totalSets || 0,
                        prev: sessionComparison.older.totalSets,
                        unit: '',
                      },
                      {
                        label: 'Повторы',
                        cur: done?.totalReps || 0,
                        prev: sessionComparison.older.totalReps,
                        unit: '',
                      },
                      {
                        label: 'Интенсив.',
                        cur: done?.avgIntensity || 0,
                        prev: sessionComparison.older.avgIntensity,
                        unit: '',
                      },
                    ].map((item) => {
                      const delta = item.cur - item.prev;
                      const pct = item.prev > 0 ? Math.round((delta / item.prev) * 100) : 0;
                      const positive = delta > 0;
                      return (
                        <div
                          key={item.label}
                          style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}
                        >
                          <div style={{ fontSize: 9, color: '#fff' }}>{item.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                            {Math.round(item.cur)}
                            {item.unit}
                          </div>
                          <div style={{ fontSize: 9, color: positive ? '#22c55e' : delta < 0 ? '#ef4444' : '#fff' }}>
                            {delta > 0 ? '+' : ''}
                            {item.isKg ? Math.round(delta) : delta} ({pct > 0 ? '+' : ''}
                            {pct}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* delta по упражнениям vs лучший результат */}
              {exerciseBestDeltas.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    background: 'rgba(0,230,138,0.04)',
                    border: '1px solid rgba(0,230,138,0.15)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>
                    🏋️ Упражнения: текущий лучший vs предыдущий
                  </div>
                  {exerciseBestDeltas.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 0',
                        borderBottom: i < exerciseBestDeltas.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 10, color: 'var(--text)', flex: 1 }}>{d.name}</span>
                      <span style={{ fontSize: 10, color: '#fff', marginRight: 6 }}>
                        {d.prevBest} → {d.currentBest}кг
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: d.delta > 0 ? '#22c55e' : d.delta < 0 ? '#ef4444' : '#fff',
                          minWidth: 50,
                          textAlign: 'right',
                        }}
                      >
                        {d.delta > 0 ? '+' : ''}
                        {d.delta}кг
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <button
            style={{ ...BTN_GHOST, width: '100%', marginTop: 8 }}
            onClick={() => {
              if (!done) return;
              // Текст собирает движок: тот же отчёт, что в дневнике и на экране.
              const log = sessionToWorkoutLog(done);
              const summary = buildWorkoutSummary([log], doneHistory);
              const cmp =
                doneHistory.length > 0
                  ? compareWorkoutSummaries(summary, buildWorkoutSummary(doneHistory.slice(0, 1)))
                  : null;
              const planVs = donePlan && donePlan.length > 0 ? comparePlanVsActual(donePlan, summary) : null;
              const footer: string[] = [];
              if (nextPlan.length > 0) {
                footer.push('📈 Следующая сессия:');
                nextPlan.forEach((s) => footer.push(`  ${s.name}: ${s.from} → ${s.to} (${s.note})`));
              }
              const text = buildWorkoutReportText(summary, {
                level: profile.level,
                comparison: cmp,
                comparisonLabel: 'прошлой тренировкой',
                plan: planVs,
                details: buildSetDetails([log]),
                header: `🏋️ Тренировка: ${done.focus} — ${done.date}\n⏱ ${done.startTime}–${done.endTime} (${done.durationMin} мин)`,
                footer,
              });
              navigator.clipboard
                ?.writeText(text)
                .then(() => {
                  setCopyDone(true);
                  setTimeout(() => setCopyDone(false), 1800);
                  if (timerSoundSettings.vibrate) hapticNotify('success');
                })
                .catch(() => {});
            }}
          >
            {copyDone ? '✓ Скопировано' : '📋 Копировать сводку'}
          </button>
          <button
            type="button"
            data-act="session-done-close"
            style={{ ...BTN, width: '100%', marginTop: 8 }}
            onClick={() => {
              // Итог — конечный экран плеера: явный выход обратно в зону проведения.
              try {
                window.dispatchEvent(new Event('he-workout-close'));
              } catch {
                /* ignore */
              }
            }}
          >
            ✓ Готово — к тренировкам
          </button>
          <button
            style={{ ...BTN_GHOST, width: '100%', marginTop: 8 }}
            onClick={() => {
              setDone(null);
              setDoneMoreOpen(false);
              setOpenSet({});
              setExOpen({});
              setWarmupBlocks([]);
              setCooldownBlocks([]);
              setSession(null);
              savedRef.current = false;
              clearActiveSession();
              setPhase('ready');
            }}
          >
            ← Новая тренировка
          </button>
          {days.length > 1 && dayIdx < days.length - 1 && (
            <button
              style={{ ...BTN, width: '100%', marginTop: 8 }}
              onClick={() => {
                setDone(null);
                setDoneMoreOpen(false);
                setOpenSet({});
                setExOpen({});
                setWarmupBlocks([]);
                setCooldownBlocks([]);
                setSession(null);
                savedRef.current = false;
                setPhase('ready');
                setDayIdx(dayIdx + 1);
              }}
            >
              ➡ Следующий день: {days[dayIdx + 1]?.label} ({dayIdx + 2}/{days.length})
            </button>
          )}
        </div>
      )}

      {/* Липкий нижний таймер для зала (SessionPlayer) */}
      {phase === 'main' && timerRunning && timerSec > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'var(--tabbar-lift, calc(var(--nav-height) + 46px))',
            left: 12,
            right: 12,
            zIndex: 45,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 16,
            background:
              timerSec <= 10
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #00e68a, #00c853)',
            color: timerSec <= 10 ? '#fff' : '#000',
            boxShadow: '0 10px 28px rgba(0,0,0,0.32)',
            border: '1px solid rgba(255,255,255,0.18)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.14)',
              fontSize: 16,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            ⏱
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, lineHeight: 1 }}>
              Отдых · {timerSec <= 10 ? 'готовьтесь!' : 'восстановление'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {String(Math.floor(timerSec / 60)).padStart(2, '0')}:{String(timerSec % 60).padStart(2, '0')}
            </div>
            <div
              style={{ height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.15)', overflow: 'hidden', marginTop: 4 }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, ((currentRestSec - timerSec) / Math.max(1, currentRestSec)) * 100))}%`,
                  height: '100%',
                  background: timerSec <= 10 ? '#fff' : '#000',
                  transition: 'width 1s linear',
                }}
              />
            </div>
          </div>
          <button
            onClick={() => {
              hapticImpact('light');
              setTimerRunning(false);
              setTimerSec(0);
            }}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: timerSec <= 10 ? '#fff' : '#000',
              color: timerSec <= 10 ? '#ef4444' : '#fff',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              flexShrink: 0,
              minHeight: 44,
            }}
          >
            Пропустить
          </button>
          <button
            onClick={() => {
              hapticImpact('light');
              setRestAddSec((v) => v + 15);
              setTimerSec((v) => v + 15);
            }}
            aria-label="Плюс 15 секунд отдыха"
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'transparent',
              color: 'inherit',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
              flexShrink: 0,
              minHeight: 44,
            }}
          >
            +15
          </button>
        </div>
      )}
      {exitConfirm && (
        <div
          data-session="exit-confirm"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0,0,0,0.62)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#141821',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 16,
              padding: 14,
              boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Завершить тренировку?</div>
            <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.45, marginBottom: 12 }}>
              Записанные подходы сохранятся в дневник, незаполненные останутся в плане.
            </div>
            <button
              type="button"
              data-act="exit-save"
              onClick={() => {
                hapticImpact('medium');
                confirmExitAndSave();
              }}
              style={{ ...BTN, width: '100%', minHeight: 48 }}
            >
              Сохранить и завершить
            </button>
            <button
              type="button"
              onClick={() => setExitConfirm(false)}
              style={{ ...BTN_GHOST, width: '100%', minHeight: 48, marginTop: 8 }}
            >
              Остаться в тренировке
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionPlayer;
