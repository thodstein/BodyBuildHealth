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
import type { BBPlan, BBWeek, BBSession, BBExercise, BBSet } from './bb-builder.engine';
import type { DayCharacter } from './bb-day-types';

export type DUPMode = 'none' | 'heavy_light' | 'strength_hypertrophy' | 'full_dup';

export interface DUPConfig {
  mode: DUPMode;
  /** Цикл ротации (3 = Пн/Ср/Пт, 5 = 5-дневный цикл). */
  cycleDays: number;
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

  // Глубокая копия плана — deep clone workSets объекты (fix P0: shallow copy мутировал оригинал)
  const newPlan: BBPlan = {
    ...plan,
    weeks: plan.weeks.map(w => ({
      ...w,
      sessions: w.sessions.map(s => ({ ...s, exercises: s.exercises.map(e => ({ ...e, workSets: e.workSets.map(ws => ({ ...ws })) })) })),
    })),
  };

  let dupDayCounter = 0;

  for (const w of newPlan.weeks) {
    if (w.phase === 'deload') continue;

    for (const s of w.sessions) {
      const dupDay = preset[dupDayCounter % preset.length];
      dupDayCounter++;

      // Применяем DUP только к primary упражнениям (accessory остаются как есть)
      for (const ex of s.exercises) {
        if (ex.role !== 'primary') continue;

        // Изменяем character
        ex.character = dupDay.character;

        // Изменяем reps для work sets
        const [repMin, repMax] = dupDay.repTarget;
        for (const ws of ex.workSets) {
          // Сохраняем прогрессию, но сдвигаем диапазон
          ws.reps = Math.max(repMin, Math.min(repMax, ws.reps));
          // Регулируем RIR
          ws.rir = dupDay.rirTarget;
        }

        // Обновляем repsRange
        ex.repsRange = [repMin, repMax];

        // Обновляем RIR упражнения
        ex.rir = dupDay.rirTarget;

        // Добавляем DUP-метку в комментарий
        const dupLabel = `[DUP: ${dupDay.label}]`;
        if (!ex.comment?.includes(dupLabel)) {
          ex.comment = `${dupLabel} ${ex.comment || ''}`.trim();
        }
      }

      // Обновляем character сессии
      s.character = dupDay.character;
    }
  }

  // Добавляем DUP rationale
  if (!newPlan.rationale.includes(`DUP: ${config.mode}`)) {
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