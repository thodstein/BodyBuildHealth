/**
 * bb-taper-pro3-e12b.test.ts — PRO-3 Э12-доводка: закрытие остатков аудита.
 *   estimatePrepCalories: женский пол-флор 1400 + кап дефицита ≤30% поддержания;
 *   addPrepWeeks/loadContestPrepConfig/addPeakPriming — оживлены в UI;
 *   applyAdaptiveTaper/buildPreTaperCascade/onContestPrepUpdated — удалены (0 потребителей).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  estimatePrepCalories,
  buildBBContestPrepPlan,
  type BBContestPrepConfig,
  isoAddDays,
  isoToday,
} from '../bb-contest-prep.engine';

const cfg = (over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig => ({
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
  showDate: isoAddDays(isoToday(), 10 * 7), weeksOut: 2, trainingProtocol: 'bb',
  carbLoadStrategy: 'moderate', waterStrategy: 'stable', sodiumStrategy: 'stable',
  ...over,
});

describe('PRO-3 Э12 — estimatePrepCalories (пол + кап дефицита)', () => {
  it('женский пол-флор 1400 (было 1200-1277 у лёгких атлеток)', () => {
    // 48 кг, 0.4%/нед: поддержание 1488, дефицит 211 → 1277 → флор 1400
    expect(estimatePrepCalories(48, 0.4, undefined, 'female')).toBe(1400);
    // без sex — прежний расчёт (1277 = 1488−211, флор 1200 не срабатывает): back-compat
    expect(estimatePrepCalories(48, 0.4)).toBe(1277);
    // мужской путь не тронут
    expect(estimatePrepCalories(80, 0.75, undefined, 'male')).toBe(estimatePrepCalories(80, 0.75));
  });

  it('кап дефицита ≤30% поддержания (защита от старых конфигов с темпом >1%/нед)', () => {
    const maint = Math.round(80 * 31);
    const fast = estimatePrepCalories(80, 1.5, undefined, 'male');
    expect(fast).toBe(maint - Math.round(maint * 0.30)); // 2480 − 744 = 1736
    expect(fast).toBeGreaterThan(1500);
  });

  it('план женской атлетки несёт пол 1400 уже в currentCalories', () => {
    const plan = buildBBContestPrepPlan(cfg({ sex: 'female', category: 'bikini', weightKg: 48, bodyFatPct: 16 }), { prepWeeks: 8, taperWeeks: 2 });
    expect(plan.preparation.currentCalories).toBeGreaterThanOrEqual(1400);
  });
});

describe('PRO-3 Э12 — оживление/удаление экспортов', () => {
  const engine = readFileSync(resolve(__dirname, '..', 'bb-contest-prep.engine.ts'), 'utf8');
  const sync = readFileSync(resolve(__dirname, '..', 'bb-contest-prep-sync.ts'), 'utf8');
  const DIR = resolve(__dirname, '..', '..', '..', 'ui', 'screens');
  const bb = readFileSync(resolve(DIR, 'TrainingScreen_parts', 'BbAutoConstructor.tsx'), 'utf8');
  const sec = readFileSync(resolve(DIR, 'TrainingScreen_parts', 'bb-contest-prep-sections.tsx'), 'utf8');
  const tab = readFileSync(resolve(DIR, 'NutritionScreen_parts', 'IndividualPlan', 'PeakWeekTab.tsx'), 'utf8');

  it('удалённые экспорты больше не существуют', () => {
    expect(engine).not.toMatch(/export function applyAdaptiveTaper/);
    expect(engine).not.toMatch(/export function buildPreTaperCascade|export interface PreTaperCascadeDay/);
    expect(sync).not.toMatch(/export function onContestPrepUpdated/);
  });

  it('addPrepWeeks / loadContestPrepConfig / addPeakPriming оживлены', () => {
    expect(bb).toMatch(/const replanned = addPrepWeeks\(prepPlan, delta\)/);
    expect(tab).toMatch(/loadContestPrepConfig\(\) \?\? bbPrepConfig/);
    expect(sec).toMatch(/data-bb="peak-prime"/);
    expect(sec).toMatch(/addPeakPriming\(builtPlan as any, bbWorkMax/);
    // идемпотентность кнопки прайминга: повторный клик не дублирует
    expect(sec).toMatch(/e\.priming/);
  });
});
