/**
 * no-legacy-schedule.test.ts — второй сборщик расписания не вернулся.
 *
 * Аудит 2026-11 (проход 21): `buildSchedule(ids)` считал дозы из `DEFAULT_DOSAGES`
 * без веса и UL — вторая модель доз рядом с `resolvePlanDose`. Прод с прохода 17
 * строит расписание только из карточки плана (`buildScheduleFromPlan`), поэтому
 * старый сборщик удалён, а его юнит-тесты переведены на реальный путь.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('расписание: один сборщик', () => {
  it('substances.ts не экспортирует legacy buildSchedule', () => {
    const src = read('src/engines/support-plan/substances.ts');
    expect(src).not.toMatch(/export function buildSchedule\s*\(/);
    expect(src).toContain('export function buildScheduleFromPlan');
  });

  it('прод-путь собирает расписание из карточки плана', () => {
    const src = read('src/engines/support-plan/index.ts');
    expect(src).toContain('buildScheduleFromPlan');
    expect(src).not.toMatch(/buildSchedule\(/);
  });
});
