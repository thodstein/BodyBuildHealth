/**
 * bb-dup.engine.ts — Daily Undulating Periodization (DUP).
 *
 * Schoenfeld 2017, Rodriguez 2022: DUP — чередование тяж/гиперт/выносливость
 * в рамках одной недели. Пример: Пн (сила 5×5), Ср (гипертрофия 3×12), Пт (выносливость 4×20).
 *
 * Преимущества: разные моторные единицы стимулируются в каждой сессии,
 * снижение адаптации, лучший баланс силы/массы.
 *
 * Реализация: DUP overlay применяется поверх существующего сплита —
 * каждый тренировочный день получает target character (тяж/памп/лёг),
 * который переопределяет дефолтный character из сплит-паттерна.
 */
import type { BBPlan } from './bb-builder.engine';
import type { DayCharacter } from './bb-day-types';

export type DUPMode = 'none' | 'heavy_light' | 'strength_hypertrophy' | 'full_dup';

export interface DUPConfig {
  mode: DUPMode;
  /** Цикл ротации (3 = Пн/Ср/Пт, 5 = 5-дневный цикл). */
  cycleDays: number;
  /** P2 E: per-muscle DUP — применять DUP ТОЛЬКО к primary этих мышц.
   *  Пусто/не задано = DUP ко всем primary (поведение по умолчанию). */
  muscles?: string[];
}

export interface DUPDayCharacter {
  character: DayCharacter;
  repTarget: [number, number];
  rirTarget: number;
  label: string;
}

/**
 * DUP пресеты для разных режимов.
 */
export const DUP_PRESETS: Record<Exclude<DUPMode, 'none'>, DUPDayCharacter[]> = {
  // heavy_light: чередование тяж/лёг для каждой мышцы (разгрузка ЦНС)
  heavy_light: [
    { character: 'тяж', repTarget: [5, 8], rirTarget: 2, label: 'Тяжёлый день (сила)' },
    { character: 'лёг', repTarget: [15, 20], rirTarget: 3, label: 'Лёгкий день (восстановление)' },
  ],
  // strength_hypertrophy: сила + гипертрофия (RPE 8-9 + RPE 7-8)
  strength_hypertrophy: [
    { character: 'тяж', repTarget: [3, 5], rirTarget: 1, label: 'Силовой день (RPE 9)' },
    { character: 'памп', repTarget: [8, 12], rirTarget: 3, label: 'Гипертрофийный день (RPE 7)' },
  ],
  // full_dup: полный DUP — 3 разных дня (сила/гиперт/выносливость) — fix: гиперт день должен быть памп
  full_dup: [
    { character: 'тяж', repTarget: [3, 5], rirTarget: 1, label: 'Силовой день (5×5, RIR 1)' },
    { character: 'памп', repTarget: [8, 12], rirTarget: 2, label: 'Гипертрофийный день (3×10, RIR 2)' },
    { character: 'памп', repTarget: [15, 20], rirTarget: 3, label: 'Метаболический день (4×20, RIR 3)' },
  ],
};

/**
 * Применить DUP overlay к плану.
 * Изменяет character, reps и RIR для каждого тренировочного дня
 * в соответствии с DUP-циклом.
 */
export function applyDUPOverlay(plan: BBPlan, config: DUPConfig): BBPlan {
  if (config.mode === 'none') return plan;
  // BUG-FIX (audit 2026-08): DUP — проф-методика, новичку не нужна
  // (блочная периодизация накопление→интенсификация→разгрузка проще и
  // безопаснее; волновая периодизация — для intermediate+).
  if ((plan as any).level === 'beginner') return plan;

  const preset = DUP_PRESETS[config.mode];
  if (!preset) return plan;

  // P2 E: per-muscle DUP — если задан список мышц, DUP применяется только к ним.
  const dupMuscles: Set<string> | null = Array.isArray(config.muscles) && config.muscles.length > 0
    ? new Set(config.muscles)
    : null;

  // Глубокая копия плана — deep clone workSets и rationale (fix P0/P1-2: без мутации оригинала)
  const newPlan: BBPlan = {
    ...plan,
    rationale: Array.isArray(plan.rationale) ? [...plan.rationale] : [],
    weeks: plan.weeks.map(w => ({
      ...w,
      sessions: w.sessions.map(s => ({ ...s, exercises: s.exercises.map(e => ({ ...e, workSets: e.workSets.map(ws => ({ ...ws })) })) })),
    })),
  };

  // P1-2: per-muscle счётчик (раньше глобальный счётчик на Upper/Lower делал Upper всегда тяжёлым,
  // а Lower всегда лёгким — нулевая волна по мышце!).
  const dupCounterByMuscle: Record<string, number> = {};
  const workingWeeks = newPlan.weeks.filter(w => w.phase !== 'deload').length;
  let workingWeekIdx = 0;

  for (const w of newPlan.weeks) {
    if (w.phase === 'deload') continue;
    // Сохраняем недельную прогрессию RIR: к концу блока RIR плавно снижается (0 → -1).
    const rirProgressShift = workingWeeks >= 4 && workingWeekIdx >= Math.floor(workingWeeks / 2) ? -1 : 0;
    workingWeekIdx++;

    for (const s of w.sessions) {
      let sessionChar: DayCharacter | null = null;
      const seenMusclesInSession = new Set<string>();

      // Применяем DUP только к primary упражнениям (accessory остаются как есть)
      for (const ex of s.exercises) {
        if (ex.role !== 'primary') continue;
        // P2 E: per-muscle гейт — если заданы мышцы, применяем только к ним.
        if (dupMuscles && !dupMuscles.has(ex.muscle)) continue;

        const mKey = String(ex.muscle || 'other');
        const mIdx = dupCounterByMuscle[mKey] ?? 0;
        const dupDay = preset[mIdx % preset.length];
        if (!seenMusclesInSession.has(mKey)) {
          dupCounterByMuscle[mKey] = mIdx + 1;
          seenMusclesInSession.add(mKey);
        }
        if (!sessionChar) sessionChar = dupDay.character;

        // Изменяем character
        ex.character = dupDay.character;

        // Изменяем reps, RIR и ПЕРЕСЧИТЫВАЕМ вес по Brzycki/Epley e1RM (P1-2: иначе 100кг×6 превращались в 100кг×15)
        const [repMin, repMax] = dupDay.repTarget;
        const targetRir = Math.max(0, Math.min(5, dupDay.rirTarget + rirProgressShift));
        for (const ws of ex.workSets) {
          const oldReps = Math.max(1, Number(ws.reps) || 8);
          const oldRir = Math.max(0, Math.min(5, Number(ws.rir ?? ex.rir ?? 2)));
          const oldW = Number(ws.weight) || 0;
          const newReps = Math.max(repMin, Math.min(repMax, oldReps));
          if (oldW > 0 && (newReps !== oldReps || targetRir !== oldRir)) {
            const est1rm = oldW * (1 + (oldReps + oldRir) / 30);
            const scaled = est1rm / (1 + (newReps + targetRir) / 30);
            ws.weight = Math.max(2.5, Math.round(scaled * 10) / 10);
          }
          ws.reps = newReps;
          ws.rir = targetRir;
          if (dupDay.character === 'тяж' && (ws.restSeconds ?? 90) < 120) ws.restSeconds = 150;
          else if (dupDay.character === 'памп' && (ws.restSeconds ?? 90) > 120) ws.restSeconds = 75;
        }

        // Обновляем repsRange и RIR упражнения
        ex.repsRange = [repMin, repMax];
        ex.rir = targetRir;

        // Добавляем DUP-метку в комментарий (идемпотентно, заменяя прежнюю)
        const dupLabel = `[DUP: ${dupDay.label}]`;
        const cleaned = String(ex.comment || '').replace(/\[DUP:[^\]]*\]\s*/g, '').trim();
        ex.comment = `${dupLabel} ${cleaned}`.trim();
      }

      if (!dupMuscles && sessionChar) {
        s.character = sessionChar;
      }
    }
  }

  // Добавляем DUP rationale (идемпотентно: startsWith вместо exact includes)
  if (!newPlan.rationale.some(r => String(r).startsWith(`DUP: ${config.mode}`))) {
    newPlan.rationale.push(`DUP: ${config.mode} (cycle ${config.cycleDays}дн) — чередование тяж/лёг для каждой мышцы (Schoenfeld 2017).`);
  }

  return newPlan;
}

/**
 * Рекомендовать DUP-режим на основе цели и уровня.
 */
export function recommendDUPMode(
  goal: string,
  level: string,
  daysPerWeek: number,
): DUPConfig {
  if (daysPerWeek < 3) {
    return { mode: 'none', cycleDays: 0 };
  }

  if (goal === 'strength_mass') {
    return { mode: 'strength_hypertrophy', cycleDays: 2 };
  }

  if (goal === 'mass' && level === 'advanced') {
    return { mode: 'full_dup', cycleDays: 3 };
  }

  if (goal === 'mass' && daysPerWeek >= 4) {
    return { mode: 'heavy_light', cycleDays: 2 };
  }

  if (goal === 'recomp') {
    return { mode: 'heavy_light', cycleDays: 2 };
  }

  return { mode: 'none', cycleDays: 0 };
}