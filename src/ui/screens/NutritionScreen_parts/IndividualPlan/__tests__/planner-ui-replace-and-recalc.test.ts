/**
 * planner-ui-replace-and-recalc.test.ts — B5, B9, B29, B30 (аудит 2026-10).
 *
 * B5: кнопка подсказки «заменить на X» вызывала `replaceFoodItem(..., -1, ...)`
 *     (индекс всегда −1) → замена не происходила никогда. Теперь жертва выбирается
 *     по типу проблемы (`pickReplaceIdxForIssue`).
 * B9: «🔄 Все» собирал итоги вручную, без клетчатки/лейцина и без синка недели.
 * B29/B30: мёртвые `peakWeekEnabled`/`peakWeekShowDay`/`replacingItem` удалены.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickReplaceIdxForIssue } from '../planner-issue-replace';

const read = (name: string) => readFileSync(join(__dirname, '..', name), 'utf8');

const items = [
  { id: 'oats_dry', name: 'Овсянка', role: 'carb_slow', amount: 60, p: 7.5, f: 4.2, c: 37, fiber: 6 },
  { id: 'olive_oil', name: 'Масло', role: 'fat', amount: 10, p: 0, f: 10, c: 0, fiber: 0 },
  { id: 'chicken_breast', name: 'Курица', role: 'protein', amount: 150, p: 34.5, f: 3, c: 0, fiber: 0 },
  { id: 'water', name: 'Вода', role: 'liquid', amount: 250, p: 0, f: 0, c: 0, fiber: 0 },
];

describe('B5: кнопка подсказки заменяет ПРАВИЛЬНУЮ позицию', () => {
  it('low_protein — позиция с наименьшим белком (жидкости пропускаются)', () => {
    expect(pickReplaceIdxForIssue(items, 'low_protein')).toBe(1); // масло (0 г белка)
  });

  it('high_fat — позиция с наибольшим жиром', () => {
    expect(pickReplaceIdxForIssue(items, 'high_fat')).toBe(1);
  });

  it('high_carb — позиция с наибольшими углеводами', () => {
    expect(pickReplaceIdxForIssue(items, 'high_carb')).toBe(0);
  });

  it('low_fiber — углеводная позиция с наименьшей клетчаткой', () => {
    // В этом приёме единственный углеводный носитель — овсянка.
    expect(pickReplaceIdxForIssue(items, 'low_fiber')).toBe(0);
  });

  it('неизвестный тип проблемы не заменяет ничего (индекс −1)', () => {
    expect(pickReplaceIdxForIssue(items, 'unknown_issue')).toBe(-1);
  });

  it('пустой список / мусор → −1, а не падение', () => {
    expect(pickReplaceIdxForIssue([], 'low_protein')).toBe(-1);
    expect(pickReplaceIdxForIssue(null as any, 'low_protein')).toBe(-1);
  });

  it('жидкости никогда не выбираются жертвой', () => {
    const onlyLiquid = [{ id: 'water', name: 'Вода', role: 'liquid', p: 0, f: 0, c: 0 }];
    expect(pickReplaceIdxForIssue(onlyLiquid, 'low_protein')).toBe(-1);
  });
});

describe('B9: «🔄 Все» пересчитывает клетчатку/лейцин и синкает итоги', () => {
  const src = read('IndividualPlanResults.tsx');

  it('заменённая позиция получает fiber и leucine_mg нового продукта', () => {
    expect(src).toMatch(/fiber: Math\.round\(\(targetFood\.fiber \|\| 0\) \* ratio \* 10\) \/ 10/);
    expect(src).toMatch(/leucine_mg: Math\.round\(leucinePer100\(targetFood\) \* ratio\)/);
  });

  it('итоги приёма и дня считаются едиными хелперами (не вручную)', () => {
    expect(src).toMatch(/const totals = sumMealTotals\(mealItems\)/);
    expect(src).toMatch(/totals: sumDayTotals\(newMeals\)/);
  });

  it('пустая правка не пишется в undo', () => {
    expect(src).toMatch(/if \(!changed\) return; \/\/ нечего менять/);
  });
});

describe('B6: анализ проблем не гейтится по plannerMode', () => {
  const stripComments = (s: string) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/[ \t]\/\/[^\n]*/g, '');

  it('в analyzePlanIssues нет раннего выхода для не-pro режимов', () => {
    const s = stripComments(read('IndividualPlanResults.tsx'));
    // Раньше: if (plannerMode !== 'pro') { setCorrectIssues([]); return; }
    expect(s).not.toMatch(/plannerMode\s*!==\s*'pro'/);
    expect(s).toMatch(/const analyzePlanIssues = \(\) => \{/);
  });
});

describe('B34: мёртвый CollapsibleSection удалён, ключ остался в очистке', () => {
  const stripComments = (s: string) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/[ \t]\/\/[^\n]*/g, '');

  it('настроек больше не содержат собственного аккордеона', () => {
    const s = stripComments(read('IndividualPlanSettings.tsx'));
    expect(s).not.toMatch(/CollapsibleSection/);
    expect(s).not.toMatch(/useCollapsedSections/);
    expect(s).not.toMatch(/SETTINGS_SECTIONS_KEY/);
  });

  it('ключ he_plan_settings_collapsed вычищается из стореджа как legacy', () => {
    expect(read('planner-storage.ts')).toMatch(/he_plan_settings_collapsed/);
  });
});

describe('B29/B30: мёртвое состояние удалено', () => {
  // Комментарии-«надгробия» намеренно упоминают удалённые имена — проверяем КОД.
  const stripComments = (s: string) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/[ \t]\/\/[^\n]*/g, '');
  const ctx = () => stripComments(read('IndividualPlanContext.tsx'));

  it('peakWeekEnabled / peakWeekShowDay исчезли из контекста', () => {
    const s = ctx();
    expect(s).not.toMatch(/peakWeekEnabled/);
    expect(s).not.toMatch(/peakWeekShowDay/);
  });

  it('replacingItem исчез из контекста и результатов', () => {
    expect(ctx()).not.toMatch(/replacingItem/);
    expect(stripComments(read('IndividualPlanResults.tsx'))).not.toMatch(/replacingItem/);
  });

  it('пик-неделя по-прежнему снимается через единый план (замена удалённому сеттеру)', () => {
    // Вместо мёртвого setPeakWeekEnabled(false) — прямая очистка prep-конфига
    // и перегенерация плана из PeakWeekTab.
    const s = stripComments(read('PeakWeekTab.tsx'));
    expect(s).toMatch(/setBBPrepConfig\(null\)/);
    expect(s).toMatch(/applyBBPeakToPlan\(null/);
  });
});
