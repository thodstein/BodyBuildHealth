/**
 * meet-adaptive-attempts.test.ts — Фаза 6, п.1: адаптивные попытки соревновательного дня.
 *
 * Проверяем не «красивые числа», а ПРАВИЛА и обещания:
 *  • вес попытки никогда не уменьшается относительно предыдущей (IPF);
 *  • провал попытки → повтор того же веса, а не «сброс»;
 *  • тяжёлая (grind) попытка ограничивает шаг вверх 3 %;
 *  • провал всех трёх → «баранка» и никаких дальнейших рекомендаций.
 */
import { describe, expect, it } from 'vitest';
import { adaptMeetAttempts, meetAttemptsFor, type MeetAttemptResult } from '../competition-attempts';

const planned = meetAttemptsFor(200, 'balanced'); // 185 / 192.5 / 205 (round 2.5)

describe('adaptMeetAttempts — адаптивные попытки', () => {
  it('без факта рекомендации совпадают со стратегией', () => {
    const a = adaptMeetAttempts(planned, []);
    expect(a.second).toBe(planned.second);
    expect(a.third).toBe(planned.third);
    expect(a.bombed).toBe(false);
    expect(a.notes.length).toBeGreaterThan(0);
  });

  it('опенер зачтён нормально → 2-я и 3-я по стратегии', () => {
    const a = adaptMeetAttempts(planned, [{ attempt: 1, weight: planned.opener, made: true, effort: 'normal' }]);
    expect(a.second).toBe(planned.second);
    expect(a.third).toBe(planned.third);
  });

  it('опенер провален → 2-я повторяет тот же вес (уменьшать нельзя)', () => {
    const a = adaptMeetAttempts(planned, [{ attempt: 1, weight: planned.opener, made: false }]);
    expect(a.second).toBe(planned.opener);
    expect(a.notes.join(' ')).toMatch(/не зачтена/);
    expect(a.notes.join(' ')).toMatch(/нельзя/);
  });

  it('опенер дался тяжело → шаг вверх ограничен 3 %, 3-я пересчитана', () => {
    const p = { opener: 180, second: 195, third: 205, target: 205 };
    const a = adaptMeetAttempts(p, [{ attempt: 1, weight: 180, made: true, effort: 'grind' }]);
    expect(a.second).toBe(185);            // 180 × 1.03 = 185.4 → 185
    expect(a.third).toBe(190);             // 185 × 1.03 = 190.55 → 190
    expect(a.notes.join(' ')).toMatch(/тяжело/);
  });

  it('2-я провалена → 3-я на том же весе', () => {
    const a = adaptMeetAttempts(planned, [
      { attempt: 1, weight: planned.opener, made: true, effort: 'normal' },
      { attempt: 2, weight: planned.second, made: false },
    ]);
    expect(a.second).toBeNull();
    expect(a.third).toBe(planned.second);
  });

  it('2-я тяжело → 3-я снижена (но не ниже 2-й)', () => {
    const a = adaptMeetAttempts(planned, [
      { attempt: 1, weight: planned.opener, made: true, effort: 'normal' },
      { attempt: 2, weight: planned.second, made: true, effort: 'grind' },
    ]);
    expect(a.third).toBe(197.5); // 192.5 × 1.03 = 198.3 → 197.5 (шаг 2.5)
    expect(a.third).toBeGreaterThanOrEqual(planned.second);
    expect(a.third).toBeLessThan(planned.third);
  });

  it('3-я провалена → баранка, рекомендаций нет', () => {
    const a = adaptMeetAttempts(planned, [
      { attempt: 1, weight: planned.opener, made: true },
      { attempt: 2, weight: planned.second, made: true },
      { attempt: 3, weight: planned.third, made: false },
    ]);
    expect(a.second).toBeNull();
    expect(a.third).toBeNull();
    expect(a.bombed).toBe(true);
    expect(a.notes.join(' ')).toMatch(/баранка/);
  });

  it('правило монотонности: 2-я из плана ниже опенера → приводится к опенеру', () => {
    const p = { opener: 185, second: 180, third: 205, target: 205 };
    const a = adaptMeetAttempts(p, [{ attempt: 1, weight: 185, made: true, effort: 'normal' }]);
    expect(a.second).toBe(185);
    expect(a.notes.join(' ')).toMatch(/уменьшать нельзя/);
    expect(a.third).toBeGreaterThanOrEqual(a.second!);
  });

  it('веса всегда целые шаги 2.5 кг и не убывают', () => {
    const p = meetAttemptsFor(180, 'aggressive');
    const seq: MeetAttemptResult[] = [
      { attempt: 1, weight: p.opener, made: true, effort: 'grind' },
    ];
    const step1 = adaptMeetAttempts(p, seq);
    expect(step1.second! % 2.5).toBe(0);
    expect(step1.third! % 2.5).toBe(0);
    expect(step1.second!).toBeGreaterThanOrEqual(p.opener);
    expect(step1.third!).toBeGreaterThanOrEqual(step1.second!);

    const step2 = adaptMeetAttempts(p, [...seq, { attempt: 2, weight: step1.second!, made: true, effort: 'grind' }]);
    expect(step2.third!).toBeGreaterThanOrEqual(step1.second!);
    expect(step2.third! % 2.5).toBe(0);
  });
});
