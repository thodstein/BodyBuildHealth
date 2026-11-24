/**
 * training-runtime-day-default.test.ts — замок на «день проведения» по умолчанию.
 *
 * 1. `runtimeDay` (день микроцикла в зоне выполнения) — индекс 0-based. Дефолт 1
 *    молча открывал второй день недели, хотя в дне 0 (Пн) тоже могла быть тренировка.
 * 2. Плеер плана получает `initialDayIndex` — день считает ExecutionZone по якорю
 *    `he_pl_runtime.startDate`; без этого на длинном BB-цикле всегда открывался день 1.
 *
 * Проверка по исходникам: поведение обоих мест зависит от большого числа пропсов
 * (профиль, localStorage, календарь), и смок-рендер TrainingScreen проверяет не то.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const trainingScreen = readFileSync('src/ui/screens/TrainingScreen.tsx', 'utf8');
const executionZone = readFileSync('src/ui/screens/TrainingScreen_parts/ExecutionZone.tsx', 'utf8');

describe('день проведения по умолчанию', () => {
  it('runtimeDay стартует с 0 (Пн), а не с 1', () => {
    const line = trainingScreen
      .split(/\r?\n/)
      .find((l) => l.includes('const [runtimeDay, setRuntimeDay]') && l.includes('useState'));
    expect(line).toBeTruthy();
    expect(line).toContain("localStorage.getItem('he_runtime_day') || '0'");
    expect(line).not.toContain("|| '1'");
    expect(line).toContain('return 0;');
  });

  it('SessionPlayer получает день из якоря плана, а не всегда первый', () => {
    expect(executionZone).toContain('initialDayIndex={initialPlanDay}');
    expect(executionZone).toContain('startDate: plRuntime.startDate');
    expect(executionZone).toContain('pickPlanDayIndex(');
  });
});
