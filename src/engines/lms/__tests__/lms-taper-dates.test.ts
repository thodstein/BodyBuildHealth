/**
 * lms-taper-dates.test.ts — C1 (даты недель по календарю), A1 (окно в appendPLTaperWeeks),
 * B2 (защита от двойного тапера), B1 (авто-тапер сборки уважает модель).
 */
import { describe, expect, it } from 'vitest';
import { buildLMSPlan, appendPLTaperWeeks, type LMSBuildOutput } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const pmMap = { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 };

function buildBase(weeks = 8): LMSBuildOutput {
  return buildLMSPlan({ template: CYCLE_01 as never, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: weeks, faithful: true } as never);
}

describe('appendPLTaperWeeks: окно до старта (A1)', () => {
  it('окно 8 + глубокий тапер 2 + mock/meet/post → блок 9 нед (вход+тапер в блоге), а не только 2', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { windowWeeks: 8, mockMeet: true, meetWeek: true, postMeet: true });
    const added = next.weeks.length - plan.weeks.length;
    // окно 8 + пост 1 = 9
    expect(added).toBe(9);
    const tail = next.weeks.slice(plan.weeks.length);
    expect(tail.filter(w => w.taperWeek).length).toBeGreaterThanOrEqual(4); // вход+тапер
    expect(tail.some(w => w.mockMeet)).toBe(true);
    expect(tail.some(w => w.meetWeek)).toBe(true);
    expect(tail.some(w => w.postMeet)).toBe(true);
  });

  it('окно меньше глубокого тапера: тапер урезан, блок = окно', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 4, { windowWeeks: 4, meetWeek: true });
    const added = next.weeks.length - plan.weeks.length;
    // окно 4 = соревнования(1) + тапер(3)
    expect(added).toBe(4);
  });

  it('окно слишком мало для mock+соревнования+тапер: предупреждение о длине', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 4, { windowWeeks: 2, mockMeet: true, meetWeek: true });
    // mock+тапер+соревнования не влезают в 2 недели → предупреждение.
    expect(next.progressionRationale).toContain('длиннее окна');
  });

  it('mock meet стоит ПЕРЕД входом в пик (первая неделя блока)', () => {
    const plan = buildBase(6);
    const next = appendPLTaperWeeks(plan, 2, { windowWeeks: 6, mockMeet: true, meetWeek: true });
    const tail = next.weeks.slice(plan.weeks.length);
    expect(tail[0].mockMeet).toBe(true);
    expect(tail.some(w => w.meetWeek)).toBe(true);
    expect(tail[tail.length - 1].meetWeek).toBe(true);
  });
});

describe('appendPLTaperWeeks: календарные даты (C1)', () => {
  it('неделя соревнований заканчивается в день старта, предыдущие — по 7 дней назад', () => {
    const plan = buildBase(6);
    const ref = '2026-12-05';
    const next = appendPLTaperWeeks(plan, 2, { windowWeeks: 6, meetWeek: true, reference: ref });
    const tail = next.weeks.slice(plan.weeks.length);
    const meet = tail.find(w => w.meetWeek)!;
    expect(meet.weekEnd).toBe(ref);
    expect(meet.weekStart).toBe('2026-11-29');
    // Неделя перед meet заканчивается за 7 дней.
    const before = tail[tail.indexOf(meet) - 1];
    expect(before.weekEnd).toBe('2026-11-28');
  });

  it('с пост-старт неделей: пост заканчивается через 7 дней после старта', () => {
    const plan = buildBase(6);
    const ref = '2026-12-05';
    const next = appendPLTaperWeeks(plan, 2, { windowWeeks: 6, meetWeek: true, postMeet: true, reference: ref });
    const tail = next.weeks.slice(plan.weeks.length);
    const post = tail.find(w => w.postMeet)!;
    expect(post.weekEnd).toBe('2026-12-12');
    const meet = tail.find(w => w.meetWeek)!;
    expect(meet.weekEnd).toBe(ref);
  });
});

describe('appendPLTaperWeeks: защита от двойного тапера (B2)', () => {
  it('повторное применение не накладывает второй блок поверх — заменяет хвост', () => {
    const plan = buildBase(6);
    const once = appendPLTaperWeeks(plan, 2, { mockMeet: true, meetWeek: true, postMeet: true });
    const onceLen = once.weeks.length;
    // Повторное применение с другим окном — хвост должен замениться, а не удвоиться.
    const twice = appendPLTaperWeeks(once, 3, { windowWeeks: 6, mockMeet: true, meetWeek: true });
    const baseLen = plan.weeks.length; // базовые недели (до первого тапера)
    const expected = baseLen + 6; // окно 6
    expect(twice.weeks.length).toBe(expected);
    expect(twice.weeks.length).toBeLessThan(onceLen + 6);
    // В хвосте ровно один блок (нет двойных mock/meet).
    const tail = twice.weeks.slice(baseLen);
    expect(tail.filter(w => w.meetWeek).length).toBe(1);
    expect(tail.filter(w => w.mockMeet).length).toBe(1);
  });

  it('тапер, добавленный в сборке (taperWeek), тоже срезается повторным применением', () => {
    // faithful:true НЕ ставит авто-тапер в buildBase — построим авто-тапер вручную через non-faithful.
    const auto = buildLMSPlan({ template: CYCLE_01 as never, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 6 } as never);
    const hasAutoTaper = auto.weeks.some(w => w.taperWeek);
    expect(hasAutoTaper).toBe(true);
    const next = appendPLTaperWeeks(auto, 2, { meetWeek: true });
    // Базовые недели = недели без авто-тапера.
    const baseLen = auto.weeks.filter(w => !w.taperWeek).length;
    const tail = next.weeks.slice(baseLen);
    expect(tail.filter(w => w.meetWeek).length).toBe(1);
  });
});

describe('buildLMSPlan: авто-тапер уважает модель (B1)', () => {
  it('non-faithful без настроек — классика; с peakMode/tapWeeks — иная кривая', () => {
    const base = buildLMSPlan({ template: CYCLE_01 as never, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 8 } as never);
    expect(base.weeks.some(w => w.taperWeek)).toBe(true);
    const tuned = buildLMSPlan({ template: CYCLE_01 as never, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 8, peakMode: 'pl', taperWeeks: 3 } as never);
    const tunedTaper = tuned.weeks.filter(w => w.taperWeek);
    expect(tunedTaper.length).toBeGreaterThanOrEqual(2);
  });
});
