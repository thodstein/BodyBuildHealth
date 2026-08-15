/**
 * Тесты mood-лога, фазы мотивации и псих-инсайтов профиля (mindset-protocol.engine.ts).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  MINDSET_MOOD_KEY, MOOD_TAGS, MOOD_LABELS,
  sanitizeMood, loadMoods, upsertMood, latestMood, moodTrends,
  detectMotivationPhase, psychProfileInsights,
  MINDSET_CHECKS_KEY,
} from '../mindset-protocol.engine';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const mkWorkout = (date: string, weight: number, reps = 5) => ({
  date,
  exercises: [{ name: 'Жим лёжа', sets: [{ weight, reps }] }],
});

describe('Mood-лог', () => {
  beforeEach(() => localStorage.clear());

  it('upsertMood добавляет и заменяет запись по дате', () => {
    upsertMood({ date: daysAgo(1), mood: 4, tags: ['энергия'] });
    expect(loadMoods().length).toBe(1);
    upsertMood({ date: daysAgo(1), mood: 2, tags: ['апатия'], note: 'спал 4 часа' });
    const list = loadMoods();
    expect(list.length).toBe(1);
    expect(list[0].mood).toBe(2);
    expect(list[0].tags).toEqual(['апатия']);
    expect(latestMood()?.note).toBe('спал 4 часа');
  });

  it('клампит mood в 1-5 и фильтрует невалидные теги', () => {
    upsertMood({ date: daysAgo(1), mood: 99, tags: ['энергия', 'несуществующий'] as any });
    expect(latestMood()?.mood).toBe(5);
    expect(latestMood()?.tags).toEqual(['энергия']);
    upsertMood({ date: daysAgo(2), mood: -3 });
    expect(loadMoods()[0].mood).toBe(1);
  });

  it('sanitizeMood: невалидные даты/оценки отбрасываются', () => {
    expect(sanitizeMood(null)).toBeNull();
    expect(sanitizeMood({ date: 'вчера', mood: 4 })).toBeNull();
    expect(sanitizeMood({ date: '2026-01-01', mood: 0 })).toBeNull();
    const ok = sanitizeMood({ date: '2026-01-01T10:00:00', mood: 3, tags: ['энергия', 'мусор'] });
    expect(ok?.date).toBe('2026-01-01');
    expect(ok?.tags).toEqual(['энергия']);
  });

  it('устойчив к битому JSON', () => {
    localStorage.setItem(MINDSET_MOOD_KEY, '{"broken":');
    expect(loadMoods()).toEqual([]);
  });

  it('moodTrends: среднее, дельта, распределение', () => {
    upsertMood({ date: daysAgo(10), mood: 5 });
    upsertMood({ date: daysAgo(9), mood: 4 });
    upsertMood({ date: daysAgo(8), mood: 2 });
    upsertMood({ date: daysAgo(7), mood: 2 });
    const tr = moodTrends(14);
    expect(tr.count).toBe(4);
    expect(tr.avg).toBe(3.3); // (5+4+2+2)/4 = 3.25 → округление 1 знака
    expect(tr.distribution[2]).toBe(2);
    expect(tr.distribution[5]).toBe(1);
    // текущее окно 4 записи — предыдущее пустое → дельта = avg
    expect(tr.delta).toBe(3.3);
  });

  it('MOOD_LABELS и MOOD_TAGS полные', () => {
    expect(Object.keys(MOOD_LABELS).length).toBe(5);
    expect(MOOD_TAGS.length).toBeGreaterThanOrEqual(5);
  });
});

describe('Фаза мотивации', () => {
  beforeEach(() => localStorage.clear());

  it('без данных: grind с дефолтами', () => {
    const r = detectMotivationPhase([]);
    expect(r.phase).toBe('grind');
    expect(r.inputs.weeksInProgram).toBe(0);
    expect(r.inputs.motivationScore).toBe(3);
    expect(r.inputs.fatigueScore).toBe(0);
    expect(r.inputs.lastPRDaysAgo).toBe(999);
    expect(r.label).toBe('Рабочая рутина');
  });

  it('honeymoon: программа до 3 недель + высокая мотивация', () => {
    const first = new Date(); first.setDate(first.getDate() - 14);
    const checks = [{ date: daysAgo(1), confidence: 5, arousal: 4, focus: 5, protocolFollowed: true }];
    localStorage.setItem(MINDSET_CHECKS_KEY, JSON.stringify(checks));
    const r = detectMotivationPhase([mkWorkout(iso(first), 80)]);
    expect(r.phase).toBe('honeymoon');
    expect(r.inputs.weeksInProgram).toBe(2);
  });

  it('burnout: высокая усталость + низкая мотивация', () => {
    const first = new Date(); first.setDate(first.getDate() - 40);
    const workouts = [mkWorkout(iso(first), 80), mkWorkout(daysAgo(1), 85)];
    const checks = Array.from({ length: 6 }, () => ({ date: daysAgo(3), confidence: 2, arousal: 1, focus: 2, protocolFollowed: true }));
    localStorage.setItem(MINDSET_CHECKS_KEY, JSON.stringify(checks));
    const r = detectMotivationPhase(workouts);
    expect(r.phase).toBe('burnout');
  });

  it('plateau: недель > 6 и нет PR 21+ дней', () => {
    const first = new Date(); first.setDate(first.getDate() - 70);
    const oldBest = new Date(); oldBest.setDate(oldBest.getDate() - 30);
    const workouts = [mkWorkout(iso(first), 80), mkWorkout(iso(oldBest), 110, 5), mkWorkout(daysAgo(2), 100)];
    const r = detectMotivationPhase(workouts);
    expect(r.phase).toBe('plateau');
    expect(r.inputs.weeksInProgram).toBe(10);
  });

  it('breakthrough: PR за последние 7 дней + высокая мотивация', () => {
    const first = new Date(); first.setDate(first.getDate() - 40);
    const workouts = [mkWorkout(iso(first), 80), mkWorkout(daysAgo(1), 120, 5)];
    const checks = [{ date: daysAgo(1), confidence: 5, arousal: 4, focus: 5, protocolFollowed: true }];
    localStorage.setItem(MINDSET_CHECKS_KEY, JSON.stringify(checks));
    const r = detectMotivationPhase(workouts);
    expect(r.phase).toBe('breakthrough');
    expect(r.inputs.lastPRDaysAgo).toBeLessThan(7);
  });
});

describe('Псих-инсайты профиля', () => {
  beforeEach(() => localStorage.clear());

  it('пустой профиль → пусто', () => {
    expect(psychProfileInsights()).toEqual([]);
  });

  it('fearOfLoss 4 → инсайт про страх потери формы', () => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { health: { fearOfLoss: 4, mirrorObsession: 1, apathyOffCycle: 1 } } }));
    const out = psychProfileInsights();
    expect(out.some(s => s.includes('страх потери формы'))).toBe(true);
  });

  it('mirrorObsession и apathyOffCycle 5 → инсайты', () => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ settings: { health: { fearOfLoss: 1, mirrorObsession: 5, apathyOffCycle: 5 } } }));
    const out = psychProfileInsights();
    expect(out.some(s => s.includes('зеркале'))).toBe(true);
    expect(out.some(s => s.includes('апатия вне курса'))).toBe(true);
  });
});
