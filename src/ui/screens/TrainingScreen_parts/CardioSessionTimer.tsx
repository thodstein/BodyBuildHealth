/**
 * CardioSessionTimer.tsx — «рабочий» режим кардио: быстрый старт сессии
 * с таймером (пауза/завершение), ввод RPE/ЧСС и запись в дневник
 * (he_cardio_sessions) одним действием.
 *
 * Аудит 2026-11, ч.2: если у сессии есть машиночитаемая структура
 * (`structured`: работа/отдых/подходы), таймер ведёт по шагам — «Работа 3/8»,
 * обратный отсчёт шага, бип на смене, «Дальше» для пропуска шага и факт по
 * подходам в дневнике. Раньше был один отсчёт на всю сессию: текст обещал
 * «8×1 мин», а атлет считал подходы в голове. Без структуры — прежнее поведение.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  cardioSessionsForDate, cardioSessionProtocol, rescheduleCardioSession,
  buildCardioIntervalPlan, cardioIntervalStepAt, cardioIntervalDoneWork,
  cardioEquipmentLabel,
  type CardioCycle, type CardioType, type CardioEquipment, type CardioIntervalPlan, type CardioStructuredBlock,
} from '../../../engines/lms/cardio.engine';
import { saveCardioLogEntry, loadCardioLog, estimateCardioEntryKcal, cardioExpectedDistanceHint, validateCardioLogFields, CARDIO_SPORT_RU, type CardioSport, type CardioLogFieldWarnings } from '../../../engines/lms/cardio-diary.engine';
import { getWeightLog } from '../../../engines/profile-store';
import { getProfile } from '../../../core/profile-manager';
import { CARD, ROW, LABEL, HINT_SM, BTN, BTN_PRIMARY, BTN_CTA, BTN_DANGER, ProgressBar, TYPE_COLOR } from './CardioUI';

const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)',
  borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 14, width: 84, minHeight: 44,
  outline: 'none', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.20)',
};

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };

const STEP_COLOR: Record<'warmup' | 'work' | 'rest' | 'cooldown', string> = {
  warmup: '#60a5fa', work: '#f59e0b', rest: '#22c55e', cooldown: '#60a5fa',
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
/** Один общий AudioContext: в интервальном режиме сигналов много (смена шага),
 *  а создание контекста на каждый бип — лишняя работа и лимит WebView. */
let beepCtx: AudioContext | null = null;
function beep(freq = 880, ms = 180) {
  try {
    if (!beepCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      beepCtx = new Ctor();
    }
    const ctx = beepCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    o.start();
    o.stop(ctx.currentTime + ms / 1000);
  } catch { /* ignore */ }
}
function vibrate(pattern: number | number[]) {
  try { if ('vibrate' in navigator) (navigator as unknown as { vibrate: (p: number | number[]) => void }).vibrate(pattern); } catch { /* ignore */ }
}

interface ActiveSession {
  type: CardioType;
  durationMin: number;
  /** Полная длительность сессии в секундах: структура (если есть) или план. */
  totalSec: number;
  remainingSec: number;
  paused: boolean;
  targetHr?: { min?: number; max?: number };
  equipment?: CardioEquipment;
  plan: CardioIntervalPlan | null;
}

interface FinishedSession {
  type: CardioType;
  /** Плановая длительность (что было в плане). */
  plannedMin: number;
  /** Фактически отработано (остановка таймера/досрочное завершение). */
  actualMin: number;
  /** true — завершено досрочно (факт < план). */
  partial: boolean;
  equipment?: CardioEquipment;
  /** Интервалы: план/факт по подходам (только если была структура). */
  intervalsPlanned?: number;
  intervalsDone?: number;
  workSec?: number;
  restSec?: number;
  /** Длительность по структуре (может быть меньше durationMin, если структура короче). */
  structureMin?: number;
  /** Длительность сессии по плану (для честного «по структуре 55 из 65 мин»). */
  sessionMin?: number;
}

interface TodaySession {
  type: CardioType;
  durationMin: number;
  targetHr?: { min?: number; max?: number };
  equipment?: CardioEquipment;
  structured?: CardioStructuredBlock[];
}

const elapsedOf = (s: Pick<ActiveSession, 'totalSec' | 'remainingSec'>) => Math.max(0, s.totalSec - s.remainingSec);

// ─── Снимок сессии (пережить перезагрузку WebView) ───
//
// На Android WebView может быть убит в фоне, а `location.reload()` (и
// pull-to-refresh) уничтожает state. Раньше пропадали два разных состояния:
// идущая сессия (ни таймера, ни записи) и уже завершённая, но ещё не
// сохранённая — вместе с введёнными RPE/ЧСС/км и выбранной дисциплиной.
// Снимок хранит оба режима, поэтому после перезагрузки всё продолжается.
const ACTIVE_TIMER_KEY = 'he_cardio_timer_active';
const TIMER_SNAPSHOT_MAX_AGE_SEC = 8 * 3600;
const RESTORED_FLASH = '↻ Тренировка восстановлена после перезагрузки';
const RESTORED_FINISH_FLASH = '↻ Завершённая сессия восстановлена — сохраните в дневник';

interface TimerInputs {
  rpe: string;
  hr: string;
  km: string;
  power: string;
}

interface TimerSnapshot {
  /** v1 — только идущая сессия; v2 — ещё и «завершено, но не сохранено». */
  v: 1 | 2;
  /** Дата старта: вчерашнюю сессию не воскрешаем. */
  date: string;
  savedAt: number;
  mode?: 'active' | 'finished';
  type: CardioType;
  durationMin: number;
  totalSec: number;
  remainingSec: number;
  paused: boolean;
  targetHr?: { min?: number; max?: number };
  equipment?: CardioEquipment;
  /** Дисциплина: без неё факт после перезагрузки ушёл бы как <другое>. */
  sport?: CardioSport;
  plan: CardioIntervalPlan | null;
  finished?: FinishedSession;
  inputs?: TimerInputs;
}

interface RestoredTimer {
  active: ActiveSession | null;
  finished: FinishedSession | null;
  sport?: CardioSport;
  inputs: TimerInputs;
}

const CARDIO_SPORTS: readonly CardioSport[] = ['run', 'bike', 'row', 'other'];
const EMPTY_INPUTS: TimerInputs = { rpe: '', hr: '', km: '', power: '' };

const asStr = (v: unknown): string => (typeof v === 'string' ? v : '');
const asNum = (v: unknown): number | undefined => (Number.isFinite(Number(v)) ? Number(v) : undefined);

function readRestoredFinished(raw: unknown): FinishedSession | null {
  const f = raw as Partial<FinishedSession> | null | undefined;
  if (!f || typeof f !== 'object') return null;
  const type = f.type;
  const plannedMin = asNum(f.plannedMin);
  const actualMin = asNum(f.actualMin);
  if (!type || plannedMin == null || actualMin == null || plannedMin < 0 || actualMin < 0) return null;
  return {
    type, plannedMin, actualMin, partial: !!f.partial,
    equipment: f.equipment,
    intervalsPlanned: asNum(f.intervalsPlanned),
    intervalsDone: asNum(f.intervalsDone),
    workSec: asNum(f.workSec),
    restSec: asNum(f.restSec),
    structureMin: asNum(f.structureMin),
    sessionMin: asNum(f.sessionMin),
  };
}

function readTimerSnapshot(): RestoredTimer | null {
  try {
    const raw = localStorage.getItem(ACTIVE_TIMER_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<TimerSnapshot> | null;
    if (!p || (p.v !== 1 && p.v !== 2) || p.date !== todayIso()) return null;
    const savedAt = asNum(p.savedAt);
    if (savedAt == null) return null;
    const ageSec = Math.round((Date.now() - savedAt) / 1000);
    if (ageSec < -60 || ageSec > TIMER_SNAPSHOT_MAX_AGE_SEC) return null;
    const inputs: TimerInputs = {
      rpe: asStr(p.inputs?.rpe), hr: asStr(p.inputs?.hr), km: asStr(p.inputs?.km), power: asStr(p.inputs?.power),
    };
    const sport = p.sport && CARDIO_SPORTS.includes(p.sport) ? p.sport : undefined;
    if (p.mode === 'finished') {
      const finished = readRestoredFinished(p.finished);
      return finished ? { active: null, finished, sport, inputs } : null;
    }
    const totalSec = Math.round(Number(p.totalSec));
    const savedRemaining = Math.round(Number(p.remainingSec));
    const durationMin = Math.round(Number(p.durationMin));
    if (!Number.isFinite(totalSec) || totalSec <= 0) return null;
    if (!Number.isFinite(savedRemaining) || !Number.isFinite(durationMin)) return null;
    // Пауза не «съедает» время простоя: на паузе остаток не уменьшаем.
    const remainingSec = p.paused ? savedRemaining : Math.max(0, savedRemaining - Math.max(0, ageSec));
    return {
      sport, inputs, finished: null,
      active: {
        type: (p.type ?? 'zone2') as CardioType,
        durationMin: Math.max(1, durationMin),
        totalSec,
        remainingSec: Math.min(totalSec, Math.max(0, remainingSec)),
        paused: !!p.paused,
        targetHr: p.targetHr,
        equipment: p.equipment,
        plan: (p.plan ?? null) as CardioIntervalPlan | null,
      },
    };
  } catch { return null; }
}

function writeTimerSnapshot(
  a: ActiveSession | null,
  opts: { sport?: CardioSport; finished?: FinishedSession | null; inputs?: TimerInputs } = {},
): void {
  try {
    const base = { date: todayIso(), savedAt: Date.now(), sport: opts.sport, inputs: opts.inputs };
    if (!a) {
      const f = opts.finished;
      if (!f) return;
      const snap: TimerSnapshot = {
        ...base, v: 2, mode: 'finished',
        type: f.type, durationMin: f.plannedMin, totalSec: 0, remainingSec: 0, paused: false,
        plan: null, finished: f,
      };
      localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(snap));
      return;
    }
    const snap: TimerSnapshot = {
      ...base, v: 2, mode: 'active',
      type: a.type, durationMin: a.durationMin, totalSec: a.totalSec, remainingSec: a.remainingSec,
      paused: a.paused, targetHr: a.targetHr, equipment: a.equipment, plan: a.plan,
    };
    localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(snap));
  } catch { /* ignore */ }
}

function clearTimerSnapshot(): void {
  try { localStorage.removeItem(ACTIVE_TIMER_KEY); } catch { /* ignore */ }
}

export const CardioSessionTimer: React.FC<{ cycle: CardioCycle | null; onSaved?: () => void; onReschedule?: (next: CardioCycle) => void }> = ({ cycle, onSaved, onReschedule }) => {
  // Снимок читаем один раз при монтировании — до первого рендера.
  const [restored] = useState<RestoredTimer | null>(() => readTimerSnapshot());
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>(() => {
    if (!cycle) return [];
    const t = cardioSessionsForDate(cycle, todayIso(), cycle.startDate);
    return t ? t.sessions.map(s => ({ type: s.type, durationMin: s.durationMin, targetHr: s.targetHr, equipment: s.equipment, structured: s.structured })) : [];
  });
  const [active, setActive] = useState<ActiveSession | null>(() => restored?.active ?? null);
  const [finished, setFinished] = useState<FinishedSession | null>(() => restored?.finished ?? null);
  // PRO (аудит Oct 2026): мощность имеет смысл только на вело-сессии — поле
  // появляется, когда оборудование сессии/цикла = cycling (не шумим на беге).
  const isPowerRelevant = useMemo(() => {
    if (!finished) return false;
    const eq = todaySessions.find(s => s.type === finished.type)?.equipment ?? cycle?.config?.equipment?.[0];
    return eq === 'cycling';
  }, [finished, todaySessions, cycle]);
const [rpe, setRpe] = useState(() => restored?.inputs.rpe ?? '');
const [hr, setHr] = useState(() => restored?.inputs.hr ?? '');
const [km, setKm] = useState(() => restored?.inputs.km ?? '');
const [power, setPower] = useState(() => restored?.inputs.power ?? '');
  // Спринт 5.2 (аудит): дисциплина записывается в дневник. Раньше таймер вообще
  // не писал `sport` — ВСЕ сессии пользователя лежали как <other>, и пер-спортная
  // разбивка TID видела только импорт. По умолчанию <другое>: не выдумываем.
  const [sport, setSport] = useState<CardioSport>(() => restored?.sport ?? 'other');
  const [flash, setFlash] = useState<string | null>(() => (restored ? (restored.finished ? RESTORED_FINISH_FLASH : RESTORED_FLASH) : null));
  const [warnings, setWarnings] = useState<CardioLogFieldWarnings | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cycle) { setTodaySessions([]); return; }
    const t = cardioSessionsForDate(cycle, todayIso(), cycle.startDate);
    setTodaySessions(t ? t.sessions.map(s => ({ type: s.type, durationMin: s.durationMin, targetHr: s.targetHr, equipment: s.equipment, structured: s.structured })) : []);
  }, [cycle]);

  const deadlineRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number | null>(null);

  // Снимок сессии: пишем на старте/паузе/каждые 5 с, а также при уходе
  // приложения в фон (Android может убить WebView, не дав дотикать таймеру).
  const activeRef = useRef<ActiveSession | null>(active);
  activeRef.current = active;
  const finishedRef = useRef<FinishedSession | null>(finished);
  finishedRef.current = finished;
  const sportRef = useRef<CardioSport>(sport);
  sportRef.current = sport;
  const inputsRef = useRef<TimerInputs>({ rpe, hr, km, power });
  inputsRef.current = { rpe, hr, km, power };
  const lastSnapshotRef = useRef(0);
  useEffect(() => {
    if (!active) { lastSnapshotRef.current = 0; return; }
    const now = Date.now();
    if (active.paused || now - lastSnapshotRef.current > 5000) {
      lastSnapshotRef.current = now;
      writeTimerSnapshot(active, { sport, inputs: { rpe, hr, km, power } });
    }
  }, [active, sport, rpe, hr, km, power]);
  // «Завершено, но не сохранено»: пишем сразу на ввод (RPE/ЧСС/км/дисциплина),
  // иначе убийство приложения стирало панель оценки вместе с фактическими минутами.
  useEffect(() => {
    if (active) return;
    if (finished) writeTimerSnapshot(null, { sport, finished, inputs: { rpe, hr, km, power } });
    else { clearTimerSnapshot(); lastSnapshotRef.current = 0; }
  }, [active, finished, sport, rpe, hr, km, power]);
  useEffect(() => {
    const flush = () => {
      if (activeRef.current) {
        writeTimerSnapshot(activeRef.current, { sport: sportRef.current, inputs: inputsRef.current });
      } else if (finishedRef.current) {
        writeTimerSnapshot(null, { sport: sportRef.current, finished: finishedRef.current, inputs: inputsRef.current });
      }
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, []);
  useEffect(() => {
    if (!restored) return;
    const t = window.setTimeout(() => setFlash(f => (f === RESTORED_FLASH || f === RESTORED_FINISH_FLASH ? null : f)), 6000);
    return () => window.clearTimeout(t);
  }, [restored]);

  useEffect(() => {
    if (!active) { deadlineRef.current = null; pausedRemainingRef.current = null; return; }
    if (active.paused) {
      if (deadlineRef.current != null) {
        pausedRemainingRef.current = active.remainingSec;
        deadlineRef.current = null;
      }
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      return;
    }
    if (pausedRemainingRef.current != null) {
      deadlineRef.current = Date.now() + pausedRemainingRef.current * 1000;
      pausedRemainingRef.current = null;
    } else if (deadlineRef.current == null) {
      deadlineRef.current = Date.now() + active.remainingSec * 1000;
    }
    const tick = () => {
      if (deadlineRef.current == null) return;
      const remain = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setActive(prev => {
        if (!prev) return null;
        if (remain <= 0) return { ...prev, remainingSec: 0 };
        if (prev.remainingSec !== remain) return { ...prev, remainingSec: remain };
        return prev;
      });
    };
    timerRef.current = window.setInterval(tick, 1000);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active?.paused, active?.type, active?.durationMin, active]);

  // 3-2-1: один бип на каждое значение (раньше на 00:01 срабатывали и бип
  // завершения, и бип обратного отсчёта, а таймер замирал на 00:01).
  // Интервальный режим: сигнал на КАЖДОЙ смене шага (работа ↔ отдых) и
  // обратный отсчёт до конца шага, а не до конца сессии.
  const lastBeepSecRef = useRef<number | null>(null);
  const lastStepRef = useRef<number | null>(null);
  useEffect(() => {
    if (!active) { lastBeepSecRef.current = null; lastStepRef.current = null; return; }
    const finish = (intervalsDone?: number) => {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      deadlineRef.current = null;
      pausedRemainingRef.current = null;
      lastBeepSecRef.current = null;
      lastStepRef.current = null;
      beep(880, 300);
      vibrate([120, 80, 120]);
      const total = active.totalSec;
      const structureMin = Math.round(total / 60);
      // Факт = план структуры: таймер дошёл до нуля сам.
      setFinished({
        type: active.type, plannedMin: structureMin, actualMin: structureMin,
        partial: false, equipment: active.equipment,
        intervalsPlanned: active.plan?.workSteps,
        intervalsDone: active.plan ? (intervalsDone ?? active.plan.workSteps) : undefined,
        workSec: active.plan?.workSec,
        restSec: active.plan?.restSec,
        structureMin: active.plan ? structureMin : undefined,
        sessionMin: active.plan ? active.durationMin : undefined,
      });
      setActive(null);
    };
    if (active.remainingSec <= 0) {
      finish(active.plan ? active.plan.workSteps : undefined);
      return;
    }
    if (active.paused) return;

    const elapsed = elapsedOf(active);
    const plan = active.plan;
    if (plan) {
      const info = cardioIntervalStepAt(plan, elapsed);
      if (lastStepRef.current != null && lastStepRef.current !== info.index) {
        // Смена шага: короткий сигнал (работа — выше, отдых — ниже).
        beep(info.step.kind === 'work' ? 980 : 620, 200);
        vibrate(info.step.kind === 'work' ? [90, 60, 90] : 70);
      }
      lastStepRef.current = info.index;
      if (info.stepRemainingSec > 0 && info.stepRemainingSec <= 3 && lastBeepSecRef.current !== info.stepRemainingSec) {
        lastBeepSecRef.current = info.stepRemainingSec;
        beep(660, 120);
        if (info.stepRemainingSec === 1) vibrate(120);
      }
      return;
    }

    if (active.remainingSec <= 3 && lastBeepSecRef.current !== active.remainingSec) {
      lastBeepSecRef.current = active.remainingSec;
      beep(660, 120);
      if (active.remainingSec === 1) vibrate(120);
    }
  }, [active]);

  // Wake lock: экран гаснет → setInterval душится и «прошло» врёт. Держим
  // экран включённым, пока идёт активная (не на паузе) сессия.
  // АПК-важный нюанс: Android снимает wake lock при уходе приложения в фон
  // и НЕ возвращает его сам — экран гас уже через минуту после возврата.
  // Поэтому перезапрашиваем лок на каждый visibilitychange → visible.
  useEffect(() => {
    if (!active || active.paused) return;
    type WakeSentinel = { release?: () => Promise<void> | void };
    const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<WakeSentinel> } };
    if (!nav.wakeLock?.request) return;
    let sentinel: WakeSentinel | null = null;
    let cancelled = false;
    const acquire = () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      nav.wakeLock!.request('screen').then(s => {
        if (cancelled) { void s.release?.(); } else { sentinel = s; }
      }).catch(() => { /* политика браузера — не критично */ });
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      try { void sentinel?.release?.(); } catch { /* ignore */ }
    };
  }, [active?.paused, !!active]);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  const start = (s: TodaySession) => {
    deadlineRef.current = null;
    pausedRemainingRef.current = null;
    // Показатели предыдущей сессии не переносим: RPE/ЧСС/км относятся к ней.
    setRpe(''); setHr(''); setKm(''); setPower(''); setWarnings(null);
    const plan = buildCardioIntervalPlan({ type: s.type, durationMin: s.durationMin, structured: s.structured });
    const totalSec = plan ? plan.totalSec : s.durationMin * 60;
    setActive({ type: s.type, durationMin: s.durationMin, totalSec, remainingSec: totalSec, paused: false, targetHr: s.targetHr, equipment: s.equipment, plan });
    setFinished(null);
  };

  const finishNow = () => {
    if (!active) return;
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    deadlineRef.current = null;
    pausedRemainingRef.current = null;
    beep(880, 220);
    vibrate(140);
    // Аудит 2026-11: досрочное завершение записывалось как ПОЛНЫЙ план —
    // журнал «подтверждал» минуты, которых не было. Теперь факт = отработанное.
    const elapsedSec = elapsedOf(active);
    const actualMin = Math.max(0, Math.round(elapsedSec / 60));
    const plannedMin = Math.max(1, Math.round(active.totalSec / 60));
    setFinished({
      type: active.type,
      plannedMin,
      actualMin,
      partial: elapsedSec < active.totalSec,
      equipment: active.equipment,
      intervalsPlanned: active.plan?.workSteps,
      intervalsDone: active.plan ? cardioIntervalDoneWork(active.plan, elapsedSec) : undefined,
      workSec: active.plan?.workSec,
      restSec: active.plan?.restSec,
      structureMin: active.plan ? plannedMin : undefined,
      sessionMin: active.plan ? active.durationMin : undefined,
    });
    setActive(null);
  };

  /** Пропустить текущий шаг интервалов (отдых затянулся / отрезок не пошёл). */
  const skipStep = () => {
    if (!active?.plan) return;
    const info = cardioIntervalStepAt(active.plan, elapsedOf(active));
    const cut = Math.max(1, info.stepRemainingSec);
    beep(520, 90);
    if (active.paused) {
      pausedRemainingRef.current = Math.max(0, active.remainingSec - cut);
    } else if (deadlineRef.current != null) {
      deadlineRef.current -= cut * 1000;
    }
    const nextRemaining = Math.max(0, active.remainingSec - cut);
    // Снимок пишем сразу: троттлинг эффекта (раз в 5 с) иначе откатил бы
    // пропущенный шаг при перезагрузке.
    writeTimerSnapshot({ ...active, remainingSec: nextRemaining }, { sport: sportRef.current, inputs: inputsRef.current });
    setActive(prev => prev ? { ...prev, remainingSec: nextRemaining } : null);
  };

  const save = () => {
    if (!finished) return;
    const w = validateCardioLogFields({ rpe, hr, km, power });
    if (w.rpe || w.hr || w.km || w.power) {
      setWarnings(w);
      flashMsg('⚠ Проверьте значения: ' + [w.rpe, w.hr, w.km, w.power].filter(Boolean).join('; '));
      return;
    }
    setWarnings(null);
    let weight: number | null = null;
    try {
      const weights = getWeightLog();
      const sorted = Array.isArray(weights) ? [...weights].filter(e => Number.isFinite(e.weight)).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
      if (sorted.length > 0) weight = sorted[0].weight;
    } catch { /* ignore */ }
    // Ккал факта: пол и тощая масса (жир почти не тратит) + оборудование.
    // Раньше формула знала только вес и тип: 45 мин гребли = 45 мин бега.
    let sex: 'male' | 'female' = 'male';
    let ffmKg: number | undefined;
    try {
      const personal = getProfile()?.settings?.personal as { sex?: string; bodyFat?: number } | undefined;
      if (personal?.sex === 'female') sex = 'female';
      const bf = Number(personal?.bodyFat);
      if (weight && Number.isFinite(bf) && bf >= 3 && bf <= 70) {
        ffmKg = Math.round(weight * (1 - bf / 100) * 10) / 10;
      }
    } catch { /* ignore */ }
    const intervalNote = finished.intervalsPlanned
      ? `интервалы: ${finished.intervalsDone ?? 0} из ${finished.intervalsPlanned}`
      : null;
    saveCardioLogEntry({
      id: 'c-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
      date: todayIso(),
      type: finished.type,
      durationMin: Math.max(1, finished.actualMin),
      completed: true,
      sport,
      rpe: Number(rpe) > 0 ? Number(rpe) : undefined,
      avgHr: Number(hr) > 0 ? Number(hr) : undefined,
      calories: estimateCardioEntryKcal(finished.type, Math.max(1, finished.actualMin), weight ?? undefined, { equipment: finished.equipment, sex, ffmKg }),
      distanceKm: Number(km) > 0 ? Math.round(Number(km) * 10) / 10 : undefined,
      notes: [finished.partial ? `досрочно: ${finished.actualMin} из ${finished.plannedMin} мин` : null, intervalNote]
        .filter(Boolean).join(' · ') || undefined,
      // PRO (аудит Oct 2026): средняя мощность вело-сессии — TSS по мощности
      // в PMC (точнее пульсовой оценки на ровной работе).
      avgPowerWatts: isPowerRelevant && Number(power) > 0 ? Math.round(Number(power)) : undefined,
      intervalsPlanned: finished.intervalsPlanned,
      intervalsDone: finished.intervalsDone,
      workSec: finished.workSec,
      restSec: finished.restSec,
    });
    onSaved?.();
    setFinished(null);
    setRpe('');
    setHr('');
    setKm('');
    setPower('');
    flashMsg('💾 Сессия записана в дневник');
  };

  const skip = (type: CardioType, durationMin: number) => {
    // Не дублировать пропуск: если сегодня уже есть пропущенная сессия того же
    // типа — не пишем вторую запись (иначе рекомендации считают «2 пропуска»).
    let alreadySkipped = false;
    try {
      const log = loadCardioLog();
      alreadySkipped = log.some(e => e.date === todayIso() && e.type === type && e.completed === false);
    } catch { /* ignore */ }
    if (alreadySkipped) {
      flashMsg('⏭ Сессия уже отмечена пропущенной сегодня');
      return;
    }
    saveCardioLogEntry({
      id: 'c-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
      date: todayIso(),
      type,
      durationMin,
      completed: false,
      sport,            // спринт 5.2: пропуск тоже принадлежит дисциплине
      notes: 'пропущена',
    });
    if (active) {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      setActive(null);
    }
    onSaved?.();
    flashMsg('⏭ Сессия отмечена пропущенной (учитывается в рекомендациях)');
  };

  const reschedule = () => {
    if (!cycle) return;
    const r = rescheduleCardioSession(cycle, todayIso(), { referenceIso: cycle.startDate });
    if (r.changes.length === 0) { flashMsg('⚠ Сессию некуда перенести (нет свободного дня недели)'); return; }
    onReschedule?.(r.cycle);
    flashMsg(`↗ Сессия перенесена на ${r.changes[0].to} (нед ${r.changes[0].week})`);
  };

  // Что показывать крупно: в интервальном режиме — остаток ШАГА, иначе — сессии.
  const activeElapsed = active ? elapsedOf(active) : 0;
  const activeStep = active?.plan ? cardioIntervalStepAt(active.plan, activeElapsed) : null;

  return (
    <div className="train-cardiotimer" style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={LABEL}>⚡ Быстрый старт сессии</span>
        <span style={HINT_SM}>таймер · фазы · ЧСС-зона · аудио</span>
      </div>
      {flash && <div style={{ fontSize: 11.5, fontWeight: 750, color: '#4ade80', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.28)', borderLeft: '3px solid #00e68a', borderRadius: 10, padding: '8px 11px', lineHeight: 1.5 }} role="status">{flash}</div>}

      {active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'center', padding: '8px 0' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{TYPE_LABEL[active.type]} · {active.durationMin} мин</span>
            {active.targetHr?.max && <span style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(96,165,250,0.28)', borderRadius: 20, padding: '2px 8px' }}>🎯 ЧСС {active.targetHr.min}-{active.targetHr.max}</span>}
            {active.plan && (
              <span data-cardio="intervals" style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: '2px 8px' }}>
                🔁 {active.plan.workSteps}×{fmt(active.plan.workSec)}{active.plan.restSec > 0 ? `/${fmt(active.plan.restSec)}` : ''}
              </span>
            )}
          </div>

          {activeStep ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }} aria-live="polite">
                <span data-cardio="interval-step" style={{ fontSize: 12.5, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', color: STEP_COLOR[activeStep.step.kind] }}>
                  {activeStep.step.label}
                </span>
                {activeStep.step.note && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', textAlign: 'center', maxWidth: 320, lineHeight: 1.4 }}>{activeStep.step.note}</span>
                )}
              </div>
              <div role="timer" aria-live="polite" aria-atomic="true" aria-label={`Осталось в шаге: ${activeStep.step.label}`} style={{ fontSize: 54, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: activeStep.stepRemainingSec <= 10 ? STEP_COLOR[activeStep.step.kind] : '#fff', lineHeight: 1, letterSpacing: -1.5, textShadow: `0 0 24px ${STEP_COLOR[activeStep.step.kind]}55` }}>{fmt(activeStep.stepRemainingSec)}</div>
              <div style={{ width: '100%', maxWidth: 340 }} role="progressbar" aria-valuenow={activeStep.stepElapsedSec} aria-valuemin={0} aria-valuemax={activeStep.step.sec} aria-label={`Шаг: ${activeStep.step.label}`}>
                <ProgressBar value={activeStep.stepElapsedSec} max={Math.max(1, activeStep.step.sec)} color={STEP_COLOR[activeStep.step.kind]} height={8} />
                <div style={{ marginTop: 4 }}>
                  <ProgressBar value={activeElapsed} max={Math.max(1, active.totalSec)} color="rgba(255,255,255,0.35)" height={3} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#fff', marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
                  <span>всего {fmt(activeElapsed)}</span>
                  <span>{active.paused ? '⏸ пауза' : '▶ в процессе'}</span>
                  <span>из {fmt(active.totalSec)}</span>
                </div>
              </div>
              {/* Подходы точками: видно на бегу, сколько сделано, сколько впереди. */}
              {(() => {
                const plan = active.plan!;
                const works = plan.steps.filter(st => st.kind === 'work');
                if (works.length === 0 || works.length > 24) return null;
                // Считаем по индексу шага в таймлайне, а не по сумме секунд:
                // разминка и отдых тоже идут в общий elapsed, и «накопление
                // работы» засчитывало бы все подходы ещё на разминке.
                const doneCount = works.filter(st => st.index < activeStep.index).length;
                return (
                  <div data-cardio="interval-dots" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }} aria-label={`Подходы: ${doneCount} из ${works.length}`}>
                    {works.map((st, i) => {
                      const isCurrent = activeStep.step.kind === 'work' && activeStep.step.index === st.index;
                      const done = i < doneCount;
                      return (
                        <span
                          key={st.index}
                          aria-hidden="true"
                          style={{
                            width: 9, height: 9, borderRadius: 99,
                            background: done ? '#22c55e' : isCurrent ? STEP_COLOR.work : 'rgba(255,255,255,0.16)',
                            border: isCurrent ? '2px solid #fff' : 'none',
                            boxShadow: isCurrent ? '0 0 8px rgba(245,158,11,0.8)' : 'none',
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })()}
              {/* Что дальше: атлет готовится к следующему шагу заранее. */}
              {(() => {
                const next = active.plan!.steps[activeStep.index + 1];
                return (
                  <div data-cardio="interval-next" style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
                    {next ? `далее: ${next.label} · ${fmt(next.sec)}` : 'последний шаг'}
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <div role="timer" aria-live="polite" aria-atomic="true" style={{ fontSize: 54, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: active.remainingSec < 60 ? '#ef4444' : '#00e68a', lineHeight: 1, letterSpacing: -1.5, textShadow: active.remainingSec < 60 ? '0 0 24px rgba(239,68,68,0.45)' : '0 0 24px rgba(0,230,138,0.40)' }}>{fmt(active.remainingSec)}</div>
              <div style={{ width: '100%', maxWidth: 340 }} role="progressbar" aria-valuenow={activeElapsed} aria-valuemin={0} aria-valuemax={active.totalSec} aria-label="Прогресс сессии">
                <ProgressBar value={activeElapsed} max={active.totalSec} color={active.remainingSec < 60 ? '#ef4444' : '#00e68a'} height={8} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#fff', marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
                  <span>прошло {fmt(activeElapsed)}</span>
                  <span>{active.paused ? '⏸ пауза' : '▶ в процессе'}</span>
                  <span>осталось {fmt(active.remainingSec)}</span>
                </div>
              </div>
              {(() => {
                const protocol = cardioSessionProtocol({ type: active.type, durationMin: active.durationMin });
                const elapsed = activeElapsed;
                let acc = 0;
                const currentIdx = protocol.findIndex(p => { acc += p.minutes * 60; return elapsed < acc; });
                const activeIdx = currentIdx >= 0 ? currentIdx : protocol.length - 1;
                return (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {protocol.map((p, i) => (
                      <div key={p.name} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, border: i === activeIdx ? '1px solid rgba(0,230,138,0.5)' : '1px solid rgba(255,255,255,0.08)', background: i === activeIdx ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)', color: i === activeIdx ? '#4ade80' : '#fff' }}>
                        {i === activeIdx ? '▶ ' : ''}{p.name} {p.minutes}м
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          <div style={ROW}>
            <button style={BTN} onClick={() => setActive(prev => prev ? { ...prev, paused: !prev.paused } : null)} aria-label="Пауза">
              {active.paused ? '▶️ Продолжить' : '⏸ Пауза'}
            </button>
            {active.plan && (
              <button style={BTN} onClick={skipStep} aria-label="Следующий шаг">⏭ Дальше</button>
            )}
            <button style={BTN_DANGER} onClick={finishNow}>⏹ Завершить</button>
            <button style={BTN} onClick={() => skip(active.type, active.durationMin)} title="Отметить сессию пропущенной">⏭ Пропустить</button>
          </div>
        </div>
      )}

      {finished && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 11, color: '#fff' }}>
            {finished.partial ? '⏹' : '✅'} {TYPE_LABEL[finished.type]} {finished.partial
              ? `${finished.actualMin} из ${finished.plannedMin} мин (досрочно)`
              : `${finished.actualMin} мин`} завершена — оцените сессию:
          </div>
          {!!finished.intervalsPlanned && (
            <div data-cardio="intervals-result" style={{ fontSize: 10.5, color: finished.intervalsDone === finished.intervalsPlanned ? '#4ade80' : '#fbbf24', lineHeight: 1.45 }}>
              🔁 Интервалы: {finished.intervalsDone ?? 0} из {finished.intervalsPlanned} подходов
              {finished.workSec ? ` · ${fmt(finished.workSec)} работа` : ''}{finished.restSec ? ` / ${fmt(finished.restSec)} отдых` : ''}
              {/* Структура короче плана — говорим прямо, а не молчим: остаток
                  сессии идёт лёгким добеганием, и это видно атлету. */}
              {finished.sessionMin && finished.structureMin && finished.sessionMin > finished.structureMin
                ? ` · по структуре ${finished.structureMin} из ${finished.sessionMin} мин`
                : ''}
            </div>
          )}
          {/* Дисциплина: без неё запись ляжет в <другое> и не попадёт в разбивку TID. */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ ...LABEL, fontSize: 10 }}>дисциплина:</span>
            {(Object.keys(CARDIO_SPORT_RU) as CardioSport[]).map(s => (
              <button
                key={s}
                data-cardio="sport"
                data-sport={s}
                onClick={() => setSport(s)}
                aria-pressed={sport === s}
                aria-label={`Дисциплина: ${CARDIO_SPORT_RU[s]}`}
                style={{
                  ...BTN, minHeight: 44, padding: '0 12px', fontSize: 12,
                  border: sport === s ? '1px solid rgba(0,230,138,0.5)' : '1px solid rgba(255,255,255,0.13)',
                  background: sport === s ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
                  color: '#fff',
                }}
              >
                {sport === s ? '✓ ' : ''}{CARDIO_SPORT_RU[s]}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: 8 }}>
            <input value={rpe} onChange={e => setRpe(e.target.value)} placeholder="RPE 1-10" inputMode="numeric" style={{ ...INPUT, width: 'auto' }} aria-label="RPE" />
            <input value={hr} onChange={e => setHr(e.target.value)} placeholder="ЧСС ср." inputMode="numeric" style={{ ...INPUT, width: 'auto' }} aria-label="ЧСС" />
            <input value={km} onChange={e => setKm(e.target.value)} placeholder="км" inputMode="decimal" style={{ ...INPUT, width: 'auto' }} aria-label="Км" title="Дистанция (для бега/езды)" />
            {isPowerRelevant && (
              <input value={power} onChange={e => setPower(e.target.value)} placeholder="Вт ср." inputMode="numeric" style={{ ...INPUT, width: 'auto' }} aria-label="Мощность" title="Средняя мощность вело-сессии (для TSS по мощности)" />
            )}
            <button style={{ ...BTN_PRIMARY, minHeight: 44 }} onClick={save}>💾 Сохранить в дневник</button>
          </div>
          {warnings && (
            <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 8px' }} role="alert">
              ⚠ {[warnings.rpe, warnings.hr, warnings.km, warnings.power].filter(Boolean).join(' · ')}
            </div>
          )}
          {(() => {
            const hint = cardioExpectedDistanceHint(finished.type, Math.max(1, finished.actualMin));
            return hint ? (
              <div style={{ fontSize: 10, color: 'rgba(96,165,250,0.85)', lineHeight: 1.4 }}>💡 Ориентир: {hint} — темп покажется в журнале после сохранения.</div>
            ) : null;
          })()}
        </div>
      )}

      {!active && !finished && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {todaySessions.length === 0 && <div style={{ fontSize: 11, color: '#fff' }}>По плану на сегодня кардио нет.</div>}
          {todaySessions.map((s, i) => {
            const plan = buildCardioIntervalPlan({ type: s.type, durationMin: s.durationMin, structured: s.structured });
            return (
              <div key={i} style={{ ...ROW, flexWrap: 'nowrap', background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))', border: '1px solid rgba(255,255,255,0.08)', borderLeft: `3px solid ${TYPE_COLOR[s.type] ?? 'rgba(255,255,255,0.16)'}`, borderRadius: 12, padding: '9px 10px', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: 12.5, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 800 }}>{TYPE_LABEL[s.type]} · {s.durationMin} мин{s.equipment ? ` · ${cardioEquipmentLabel(s.equipment as CardioEquipment)}` : ''}</span>
                  {plan && (
                    <span data-cardio="interval-hint" style={{ fontSize: 10.5, color: '#fbbf24' }}>
                      🔁 {plan.workSteps}×{fmt(plan.workSec)}{plan.restSec > 0 ? ` / ${fmt(plan.restSec)}` : ''} — таймер ведёт по подходам
                    </span>
                  )}
                  {s.targetHr?.max && (
                    <span style={{ fontSize: 10.5, color: 'rgba(96,165,250,0.9)' }}>🎯 ЧСС {s.targetHr.min}-{s.targetHr.max} уд/мин</span>
                  )}
                </span>
                <button style={{ ...BTN_CTA, flexShrink: 0 }} onClick={() => start(s)} aria-label={`Старт ${TYPE_LABEL[s.type]}`}>▶️ Старт</button>
                <button style={{ ...BTN, flexShrink: 0, minWidth: 44 }} onClick={reschedule} aria-label="Перенести на другой день">↗</button>
                <button style={{ ...BTN, flexShrink: 0, minWidth: 44 }} onClick={() => skip(s.type, s.durationMin)} aria-label={`Пропустить ${TYPE_LABEL[s.type]}`}>⏭</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
