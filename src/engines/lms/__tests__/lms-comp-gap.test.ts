/**
 * lms-comp-gap.test.ts — ПЛ-циклы между соревнованиями (Фаза 2): окна пролётов,
 * сжатие цикла без потери логики, taper/пик у каждого старта, авто/ручной выбор.
 * Обновлён под «любое изменение — только по согласию».
 */
import { describe, expect, it } from 'vitest';
import { planBetweenCompetitions, buildSeasonWithCompWindow } from '../lms-comp-gap.engine';
import { fitCycleToWeeks, applyFitConsent, buildDefaultSeasonSlots } from '../lms-season.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { CYCLE_03 } from '../../../data/lms-cycles/cycle-03';
import { CYCLE_15 } from '../../../data/lms-cycles/cycle-15';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

// Синтетический week1-цикл (без явных недель) для проверки пересчёта темпа прогрессии.
const WEEK1_ONLY: SRCycleTemplate = {
  meta: {
    id: 'test-w1',
    title: 'Тест week1',
    direction: 'powerlifting',
    level: 'II-KMS',
    period: 'strength',
    sessionsPerWeek: 3,
    weeks: 4,
    correctionPct: 0,
  },
  week1: [
    { exercises: [{ name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, sets: [{ pct: 0.5, reps: 5, sets: 3 }] }] },
  ],
};

const selector = {
  goal: 'strength',
  level: 'II-KMS',
  bodyWeight: 90,
  daysPerWeek: 4,
  direction: 'powerlifting',
  mode: 'natural',
} as const;
const pmMap = { Присед: 180, 'Жим лежа': 120, 'Становая тяга': 220 };

const opts = {
  selector: selector as never,
  taper: { mockMeet: true, meetWeek: true, postMeet: true, windowWeeks: 2 },
  pmMap,
  fallbackPm: 80,
};

describe('planBetweenCompetitions', () => {
  it('8-нед цикл в 12-нед окне с тапером: цикл сжат (7 нед), пик/старт/пост на месте, нет пустых недель (с согласием)', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'Старт 1', weeksToStart: 8 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 20 },
      ],
      {
        ...opts,
        cycleForGap: (j) => (j === 1 ? CYCLE_01 : CYCLE_01),
        mode: 'auto',
        consents: { 0: true, 1: true },
      } as never,
    );
    // 20 нед до второго старта (неделя старта уже входит) + 1 пост = 21 неделя плана.
    // P2-14: «фантомной» недели после последнего старта больше нет.
    expect(res.totalPlanWeeks).toBe(21);
    expect(res.weeks.length).toBe(21);
    // Окно второго пролёта = 20-8-1-2-1 = 8 нед.
    const seg1 = res.segments[1];
    expect(seg1.availableWeeks).toBe(8);
    expect(seg1.cycleId).toBe('cycle-01');
    expect(seg1.fitMode).toBe('proposed_shrink');
    expect(seg1.fitWeeks).toBe(8);
    expect(seg1.needsConsent).toBe(false);
    expect(seg1.notes.some((n) => n.includes('сжат'))).toBe(true);
    // У обоих стартов есть неделя соревнований и пик-блок.
    const meets = res.weeks.filter((w) => w.meetWeek);
    expect(meets.length).toBe(2);
    expect(meets.some((m) => m.week === 8)).toBe(true);
    expect(meets.some((m) => m.week === 20)).toBe(true);
    // Ни одна неделя не пустая (у каждой есть дни или это служебная неделя).
    for (const w of res.weeks) {
      expect(Array.isArray(w.days)).toBe(true);
    }
  });

  it('без согласия: пролёт требует согласия — strict_skip', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'Старт 1', weeksToStart: 8 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 20 },
      ],
      { ...opts, cycleForGap: () => CYCLE_01, mode: 'auto' } as never,
    );
    const seg1 = res.segments[1];
    expect(seg1.fitMode).toBe('strict_skip');
    expect(seg1.fitWeeks).toBe(null);
    expect(seg1.needsConsent).toBe(true);
  });

  it('окно меньше минимального (4 нед): fitWeeks null, поддерживающий повтор, время не простаивает', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'Старт 1', weeksToStart: 4 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 8 },
      ],
      { ...opts, cycleForGap: () => CYCLE_01, mode: 'auto', consents: { 0: true, 1: true } } as never,
    );
    // Окно второго пролёта = 8-4-1-2-1 = 0 нед → skip.
    const seg1 = res.segments[1];
    expect(seg1.fitMode).toBe('skip');
    expect(seg1.fitWeeks).toBe(1); // минимальная стартовая неделя с прикидами
    expect(seg1.notes.some((n) => n.includes('слишком мало'))).toBe(true);
    // План всё равно покрывает горизонт: 8 недель (включая старт) + 1 пост = 9 недель.
    expect(res.totalPlanWeeks).toBe(9);
    expect(res.weeks.length).toBe(9);
  });

  // Аудит P1-6: при нулевом окне неделя старта раньше была ПУСТОЙ (days: [] без упражнений),
  // хотя заметка обещала прикиды. Теперь это собранная неделя цикла (pmRow есть → прикиды сверху).
  it('P1-6: нулевое окно — стартовая неделя не пустая (дни с упражнениями и pmRow)', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'Старт 1', weeksToStart: 4 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 8 },
      ],
      { ...opts, cycleForGap: () => CYCLE_01, mode: 'auto', consents: { 0: true, 1: true } } as never,
    );
    const meetWeekNo = res.segments[1].meetWeek;
    const meetWeek = res.weeks.find((w) => w.week === meetWeekNo);
    expect(meetWeek).toBeTruthy();
    expect(meetWeek!.days.length).toBeGreaterThan(0);
    expect(meetWeek!.days.some((d) => d.exercises.length > 0)).toBe(true);
    expect(Object.keys(meetWeek!.pmRow).length).toBeGreaterThan(0);
  });

  // P2-6: неделя без тренировочного блока должна быть ПОМЕЧЕНА, а не выглядеть планом.
  it('P2-6: без цикла недели помечаются emptyBlock + причина, счётчики честные', () => {
    // Старт через 2 недели при тапере mock+старт+пост: тренировочного окна нет →
    // сегмент пропущен, недели остаются в календаре, но помечены.
    const res = planBetweenCompetitions([{ id: 'm1', name: 'Старт', weeksToStart: 2 }], {
      ...opts,
      mode: 'auto',
    } as never);
    const empties = res.weeks.filter((w) => w.emptyBlock);
    expect(empties.length).toBeGreaterThan(0);
    expect(empties.every((w) => w.days.length === 0)).toBe(true);
    expect(empties.every((w) => typeof w.blockNote === 'string' && w.blockNote.length > 0)).toBe(true);
    expect(res.emptyWeeks).toEqual(empties.map((w) => w.week));
    expect(res.trainingWeeks).toBe(res.totalPlanWeeks - empties.length);
    expect(res.notes.some((n) => n.includes('Без тренировочного блока'))).toBe(true);
  });

  it('несколько стартов подряд: окна не накладываются, у каждого старта пик-блок (с согласием)', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'A', weeksToStart: 6 },
        { id: 'm2', name: 'B', weeksToStart: 12 },
        { id: 'm3', name: 'C', weeksToStart: 20 },
      ],
      {
        ...opts,
        cycleForGap: (j) => [CYCLE_01, CYCLE_03, CYCLE_15][j],
        mode: 'auto',
        consents: { 0: true, 1: true, 2: true },
      } as never,
    );
    expect(res.segments).toHaveLength(3);
    expect(res.segments[0].cycleId).toBe('cycle-01');
    expect(res.segments[1].cycleId).toBe('cycle-03');
    expect(res.segments[2].cycleId).toBe('cycle-15');
    const meets = res.weeks.filter((w) => w.meetWeek);
    expect(meets.length).toBe(3);
  });

  it('ручной выбор на каждый пролёт из подходящих в базе (с согласием)', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'Старт 1', weeksToStart: 8 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 20 },
      ],
      {
        ...opts,
        mode: 'manual',
        selections: { 0: 'cycle-01', 1: 'cycle-15' },
        consents: { 0: true, 1: true },
      } as never,
    );
    expect(res.segments[0].cycleId).toBe('cycle-01');
    expect(res.segments[1].cycleId).toBe('cycle-15');
    expect(res.segments[1].candidates.length).toBeGreaterThan(0);
    expect(res.segments[1].candidates.some((c) => c.cycle.meta.id === 'cycle-15')).toBe(true);
  });

  it('невалидный id в ручном режиме → fallback на авто + заметка', () => {
    const res = planBetweenCompetitions(
      [
        { id: 'm1', name: 'Старт 1', weeksToStart: 8 },
        { id: 'm2', name: 'Старт 2', weeksToStart: 20 },
      ],
      { ...opts, mode: 'manual', selections: { 1: 'not-a-cycle' }, consents: { 0: true, 1: true } } as never,
    );
    expect(res.notes.some((n) => n.includes('не подходит'))).toBe(true);
    expect(res.segments[1].cycleId).toBeTruthy();
  });

  it('buildSeasonWithCompWindow — обёртка возвращает и сегменты, и недели (с согласием)', () => {
    const res = buildSeasonWithCompWindow([{ id: 'm1', name: 'Старт', weeksToStart: 10 }], {
      ...opts,
      cycleForGap: () => CYCLE_01,
      mode: 'auto',
      consents: { 0: true },
    } as never);
    expect(res.segments.length).toBe(1);
    expect(res.weeks.length).toBeGreaterThan(0);
    expect(res.totalPlanWeeks).toBe(res.weeks.length);
  });

  it('сжатие через fitCycleToWeeks сохраняет темп прогрессии (4→3 для week1-цикла) и требует согласия', () => {
    const fit = fitCycleToWeeks(WEEK1_ONLY, 3, { minCycleFloor: 1 }); // оригинал 4 нед
    expect(fit.mode).toBe('proposed_shrink');
    expect(fit.weeks).toBe(3);
    expect(fit.needsConsent).toBe(true);
    expect(fit.correctionPctEff).toBeGreaterThan(0);
    const base = 0.005; // fallback для correctionPct=0
    const expected = Math.min(base * (4 / 3), base * 2);
    expect(fit.correctionPctEff).toBeCloseTo(expected, 5);
    const applied = applyFitConsent(fit, true);
    expect(applied.needsConsent).toBe(false);
    expect(applyFitConsent(fit, false).mode).toBe('strict_skip');
  });
});

describe('P1-4: выбор цикла и согласие привязаны к meetId, а не к позиции пролёта', () => {
  const meet = (id: string, weeksToStart: number) => ({ id, name: `Старт ${id}`, weeksToStart });

  it('выбор цикла остаётся у своего старта после добавления более раннего', () => {
    const run = (meets: ReturnType<typeof meet>[], selections: Record<string, string>) =>
      planBetweenCompetitions(meets, { ...opts, mode: 'manual', selections } as never);

    const base = [meet('m2', 20), meet('m3', 32)];
    const auto = run(base, {});
    const ids = auto.segments.find((s) => s.meetId === 'm3')!.candidates.map((c) => c.cycle.meta.id);
    expect(ids.length).toBeGreaterThan(1);
    const pick = ids[ids.length - 1]; // не первый кандидат — позиционный выбор дал бы другой цикл

    const chosen = run(base, { m3: pick });
    expect(chosen.segments.find((s) => s.meetId === 'm3')!.cycleId).toBe(pick);

    // Добавили старт раньше всех: m3 из второго пролёта стал третьим.
    const shifted = run([meet('m1', 10), ...base], { m3: pick });
    expect(shifted.segments.find((s) => s.meetId === 'm3')!.cycleId).toBe(pick);
    // Новый старт не получил чужой выбор.
    expect(shifted.segments.find((s) => s.meetId === 'm1')!.cycleId).not.toBe(pick);
  });

  it('meetId приоритетнее legacy-индекса; старые числовые ключи ещё работают', () => {
    const one = [meet('b', 20)];
    const auto = planBetweenCompetitions(one, { ...opts, mode: 'manual' } as never);
    const ids = auto.segments[0].candidates.map((c) => c.cycle.meta.id);
    expect(ids.length).toBeGreaterThan(1);
    const pick = ids[ids.length - 1];

    const byId = planBetweenCompetitions(one, {
      ...opts,
      mode: 'manual',
      selections: { b: pick, 0: ids[0] },
    } as never);
    expect(byId.segments[0].cycleId).toBe(pick);

    const legacy = planBetweenCompetitions(one, { ...opts, mode: 'manual', selections: { 0: pick } } as never);
    expect(legacy.segments[0].cycleId).toBe(pick);
  });

  it('согласие на сжатие относится к своему старту, а не к позиции', () => {
    const meets = [meet('m1', 8), meet('m2', 16)];
    const auto = planBetweenCompetitions(meets, { ...opts, mode: 'auto' } as never);
    // Предпосылка: второй пролёт не влезает в окно и ждёт согласия.
    expect(auto.segments.find((s) => s.meetId === 'm2')!.fitMode).toBe('strict_skip');

    const ok = planBetweenCompetitions(meets, { ...opts, mode: 'auto', consents: { m2: true } } as never);
    const m2 = ok.segments.find((s) => s.meetId === 'm2')!;
    expect(m2.fitMode).not.toBe('strict_skip');
    expect(m2.fitWeeks).not.toBeNull();
    // Первому старту согласие не досталось.
    expect(ok.segments.find((s) => s.meetId === 'm1')!.fitMode).toBe('strict_skip');

    // Legacy-ключ (индекс) продолжает работать.
    const legacy = planBetweenCompetitions(meets, { ...opts, mode: 'auto', consents: { 1: true } } as never);
    expect(legacy.segments.find((s) => s.meetId === 'm2')!.fitMode).not.toBe('strict_skip');
  });
});
