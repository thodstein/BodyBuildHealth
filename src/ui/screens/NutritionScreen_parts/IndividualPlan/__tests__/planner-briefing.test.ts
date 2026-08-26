/**
 * planner-briefing.test.ts — 🧭 брифинг дня: чистая логика.
 */
import { describe, it, expect } from 'vitest';
import { buildDayBriefing } from '../planner-briefing';

const base = {
  totals: { kcal: 3000, p: 180, f: 80, c: 380 },
  goals: { kcal: 3000, p: 180, f: 80, c: 380 },
  meals: [
    { label: 'Завтрак', time: '08:00', recipeApplied: 'Омлет-суфле' },
    { label: 'Обед', time: '13:00', recipeApplied: 'Курица терияки' },
    { label: 'Ужин', time: '19:30', recipeApplied: 'Омлет-суфле' },
  ],
  isTrainingDay: false,
  nowTime: '12:00',
};

describe('buildDayBriefing', () => {
  it('cookToday: уникальные рецепты в порядке приёмов', () => {
    const b = buildDayBriefing(base);
    expect(b.cookToday).toEqual(['Омлет-суфле', 'Курица терияки']);
  });

  it('nextMeal: первый приём с временем ≥ сейчас', () => {
    const b = buildDayBriefing(base);
    expect(b.nextMeal).toEqual({ label: 'Обед', time: '13:00' });
  });

  it('день завершён → nextMeal null', () => {
    const b = buildDayBriefing({ ...base, nowTime: '22:00' });
    expect(b.nextMeal).toBeNull();
  });

  it('ккал-дельта со знаком и добор белка', () => {
    const b = buildDayBriefing({
      ...base,
      totals: { kcal: 3180, p: 150, f: 80, c: 380 },
      goals: { kcal: 3000, p: 180, f: 80, c: 380 },
    });
    expect(b.kcalDeltaPct).toBe(6);
    expect(b.proteinLeftG).toBe(30);
    // перебор ≥6% + недобор белка → оба совета
    expect(b.tips.some(t => t.includes('выше цели'))).toBe(true);
    expect(b.tips.some(t => t.includes('белку осталось ~30 г'))).toBe(true);
  });

  it('углеводное окно: тренировка ≤90 мин назад', () => {
    const b = buildDayBriefing({ ...base, isTrainingDay: true, trainTime: '11:00', nowTime: '11:50' });
    expect(b.tips.some(t => t.includes('окно открыто'))).toBe(true);
    expect(b.dayTypeLabel).toContain('Тренировочный');
  });

  it('окно не советуется спустя 2 часа или в день отдыха', () => {
    const late = buildDayBriefing({ ...base, isTrainingDay: true, trainTime: '09:00', nowTime: '11:50' });
    expect(late.tips.some(t => t.includes('окно открыто'))).toBe(false);
    const rest = buildDayBriefing({ ...base, isTrainingDay: false, trainTime: '11:00', nowTime: '11:50' });
    expect(rest.tips.some(t => t.includes('окно открыто'))).toBe(false);
  });

  it('факт дневника: % от плана, остаток до цели, предупреждение перебора', () => {
    // факт 2400 из плана 3000 = 80%, до цели осталось 600
    const ok = buildDayBriefing({ ...base, fact: { kcal: 2400, p: 120 } });
    expect(ok.factVsPlanPct).toBe(80);
    expect(ok.remainingKcalToGoal).toBe(600);
    expect(ok.tips.some(t => t.includes('Факт уже'))).toBe(false);

    // факт 3600 = 120% плана → предупреждение (совет выше цели тоже сработает: 3180? нет — totals=3000)
    const over = buildDayBriefing({ ...base, fact: { kcal: 3600, p: 200 } });
    expect(over.factVsPlanPct).toBe(120);
    expect(over.remainingKcalToGoal).toBe(-600);
    expect(over.tips.some(t => t.includes('Факт уже 120%'))).toBe(true);
  });

  it('без факта поля null и советы не добавляются', () => {
    const b = buildDayBriefing(base);
    expect(b.factVsPlanPct).toBeNull();
    expect(b.remainingKcalToGoal).toBeNull();
  });
});
