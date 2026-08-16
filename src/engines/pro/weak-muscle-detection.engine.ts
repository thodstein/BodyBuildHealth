/**
 * weak-muscle-detection.engine.ts — авто-детекция слабых групп мышц по дневнику.
 *
 * Per-group тренд e1RM (Epley) из двух 28-дневных окон: если лучший e1RM группы
 * в текущем окне ниже предыдущего более чем на dropPct — группа «слабеет»;
 * если не растёт (delta ≤ plateauPct) при достаточном числе сессий — «плато».
 * Сигналы — ПОДСКАЗКИ для карточки диагностики (не авто-выбор): клик добавляет
 * группу в «Слабые мышцы».
 */
import { epley1RM } from '../e1rm';

export interface WeakMuscleSession {
  date?: string;
  exercises?: Array<{
    exerciseName?: string;
    exerciseId?: string;
    sets?: Array<{ weightKg?: number; weight?: number; reps?: number }>;
  }>;
}

export interface WeakMuscleSignal {
  group: string;
  label: string;
  currentE1rm: number;
  priorE1rm: number;
  deltaPct: number;
  sessions: number;
  status: 'weak' | 'plateau' | 'ok';
}

export const WEAK_MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
};

/** Алиасы упражнений по группам (ПОРЯДОК ВАЖЕН: первые матчи приоритетнее).
 *  arms ПЕРЕД chest — «французский жим»/«жим узким хватом» не уходят в грудь. */
const GROUP_ALIASES: Array<{ group: string; re: RegExp }> = [
  { group: 'core', re: /пресс|скруч|планк|мёртв.*жук|dead.?bug|велосипед|подъем.*ног|подъём.*ног/i },
  { group: 'legs', re: /присед|squat|жим ног|leg.?press|выпад|lunge|разгибан.*ног|leg.?ext|сгибан.*ног|leg.?curl|ягоди|glute|мост|икр|calf|бедр|hamstring/ },
  { group: 'shoulders', re: /жим стоя|армейск|ohp|overhead|махи|дельт|delt|lateral|плеч|шраги|shrug|трапец/ },
  { group: 'arms', re: /бицепс|biceps|curl|молот|трицепс|tricep|француз|разгибан.*рук|разгибание рук|сгибан.*рук|брахи|brachialis/ },
  { group: 'chest', re: /жим|bench|отжиман|push.?up|брусь|dips|развод|fly|груд|pec/ },
  { group: 'back', re: /тяга|pull|row|подтяг|широч|lat|ромбов|становая|мёртв|deadlift|гиперэкстенз|наклон/ },
];

export function groupOfExerciseName(name: string): string | null {
  const n = name.toLowerCase().replace(/ё/g, 'е');
  if (!n.trim()) return null;
  for (const { group, re } of GROUP_ALIASES) {
    if (re.test(n)) return group;
  }
  return null;
}

export interface WeakMuscleDetectionOptions {
  /** Текущее окно, дней (по умолчанию 28). */
  windowDays?: number;
  /** Предыдущее окно (по умолчанию 28). */
  priorWindowDays?: number;
  /** Падение e1RM, % → статус weak (по умолчанию 5). */
  dropPct?: number;
  /** Рост e1RM ≤ этого % → plateau (по умолчанию 1). */
  plateauPct?: number;
  /** Минимум сессий в текущем окне для сигнала plateau (по умолчанию 2). */
  minSessions?: number;
}

/**
 * Сигналы слабых групп по e1RM-тренду. Возвращает только группы со статусом
 * weak/plateau (ok-группы отфильтрованы), отсортированные от худшей.
 */
export function detectWeakMusclesByE1rm(
  sessions: WeakMuscleSession[],
  opts: WeakMuscleDetectionOptions = {},
): WeakMuscleSignal[] {
  const windowDays = opts.windowDays ?? 28;
  const priorWindowDays = opts.priorWindowDays ?? 28;
  const dropPct = opts.dropPct ?? 5;
  const plateauPct = opts.plateauPct ?? 1;
  const minSessions = opts.minSessions ?? 2;

  const dated = sessions.filter(s => s && typeof s.date === 'string' && !Number.isNaN(Date.parse(s.date)));
  const maxDate = dated.length > 0
    ? dated.reduce((max, s) => (Date.parse(s.date!) > max ? Date.parse(s.date!) : max), 0)
    : 0;
  const ageDays = (s: WeakMuscleSession): number => {
    if (!s.date || maxDate === 0) return 0;
    const d = Date.parse(s.date);
    if (Number.isNaN(d)) return 0;
    return Math.max(0, Math.floor((maxDate - d) / 86400000));
  };

  interface Acc {
    currentBest: number;
    priorBest: number;
    sessionCount: number;
  }
  const acc: Record<string, Acc> = {};
  for (const s of sessions) {
    const age = ageDays(s);
    const isCurrent = age < windowDays;
    const isPrior = !isCurrent && age < windowDays + priorWindowDays;
    if (!isCurrent && !isPrior) continue;
    for (const e of (s.exercises ?? [])) {
      const group = groupOfExerciseName(e.exerciseName || e.exerciseId || '');
      if (!group) continue;
      let best = 0;
      for (const set of (e.sets ?? [])) {
        const weight = Number(set.weightKg ?? set.weight ?? 0);
        const reps = Number(set.reps ?? 0);
        if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps <= 0) continue;
        const e1rm = epley1RM(weight, reps);
        if (Number.isFinite(e1rm) && e1rm > best) best = e1rm;
      }
      if (best <= 0) continue;
      const row = acc[group] ?? (acc[group] = { currentBest: 0, priorBest: 0, sessionCount: 0 });
      if (isCurrent) {
        row.sessionCount += 1;
        if (best > row.currentBest) row.currentBest = best;
      } else if (best > row.priorBest) {
        row.priorBest = best;
      }
    }
  }

  const signals: WeakMuscleSignal[] = [];
  for (const [group, row] of Object.entries(acc)) {
    if (row.currentBest <= 0) continue;
    let status: WeakMuscleSignal['status'] = 'ok';
    let deltaPct = 0;
    if (row.priorBest > 0) {
      deltaPct = ((row.currentBest - row.priorBest) / row.priorBest) * 100;
      if (deltaPct <= -dropPct) status = 'weak';
      else if (deltaPct <= plateauPct && row.sessionCount >= minSessions) status = 'plateau';
    } else if (row.sessionCount >= minSessions) {
      status = 'plateau';
    }
    if (status === 'ok') continue;
    signals.push({
      group,
      label: WEAK_MUSCLE_GROUP_LABELS[group] ?? group,
      currentE1rm: Math.round(row.currentBest),
      priorE1rm: Math.round(row.priorBest),
      deltaPct: Math.round(deltaPct * 10) / 10,
      sessions: row.sessionCount,
      status,
    });
  }
  return signals.sort((a, b) => a.deltaPct - b.deltaPct);
}
