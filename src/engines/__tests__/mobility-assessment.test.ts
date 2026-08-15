/**
 * Тесты объективной оценки мобильности (mobility-assessment.engine.ts).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  MOBILITY_TESTS, getMobilityTestById, ASSESSMENT_KEY,
  loadAssessmentLog, saveAssessment, latestAssessment, previousAssessment,
  summarizeAssessment, assessmentTrend, weakestTests, correctivesForEntry,
  correctiveItemsForProtocol, assessmentCSV, sanitizeAssessment,
} from '../mobility-assessment.engine';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

describe('MOBILITY_TESTS', () => {
  beforeEach(() => localStorage.clear());

  it('6 тестов с уникальными id и полными полями', () => {
    expect(MOBILITY_TESTS.length).toBe(6);
    const ids = MOBILITY_TESTS.map(t => t.id);
    expect(new Set(ids).size).toBe(6);
    for (const t of MOBILITY_TESTS) {
      expect(t.title.trim().length).toBeGreaterThan(0);
      expect(t.instructions.trim().length).toBeGreaterThan(0);
      expect(t.passCriteria.trim().length).toBeGreaterThan(0);
      expect(t.failHint.trim().length).toBeGreaterThan(0);
      expect(t.corrective.length).toBeGreaterThan(0);
      expect(t.relatedExercises.length).toBeGreaterThan(0);
    }
  });

  it('getMobilityTestById находит и возвращает null', () => {
    expect(getMobilityTestById('deep_squat')?.area).toBeTruthy();
    expect(getMobilityTestById('нет')).toBeNull();
  });
});

describe('Хранение оценок', () => {
  beforeEach(() => localStorage.clear());

  it('saveAssessment добавляет новую запись', () => {
    const list = saveAssessment({ date: daysAgo(1), scores: { deep_squat: 2, thomas: 1 } });
    expect(list.length).toBe(1);
    expect(latestAssessment()?.date).toBe(daysAgo(1));
    expect(latestAssessment()?.scores.deep_squat).toBe(2);
  });

  it('upsert по дате заменяет запись, сохраняя id', () => {
    saveAssessment({ date: daysAgo(1), scores: { deep_squat: 2 } });
    const list = saveAssessment({ date: daysAgo(1), scores: { deep_squat: 0, thomas: 2 }, note: 'жёстко' });
    expect(list.length).toBe(1);
    const e = latestAssessment()!;
    expect(e.scores.deep_squat).toBe(0);
    expect(e.scores.thomas).toBe(2);
    expect(e.note).toBe('жёстко');
    expect(e.id).toBeTruthy();
  });

  it('лог сортируется ASC по дате, latest = последняя', () => {
    saveAssessment({ date: daysAgo(3), scores: { deep_squat: 1 } });
    saveAssessment({ date: daysAgo(1), scores: { deep_squat: 2 } });
    const list = loadAssessmentLog();
    expect(list.map(e => e.date)).toEqual([daysAgo(3), daysAgo(1)]);
    expect(latestAssessment()?.date).toBe(daysAgo(1));
    expect(previousAssessment()?.date).toBe(daysAgo(3));
  });

  it('кап 200: сохраняются новейшие', () => {
    for (let i = 0; i < 205; i++) {
      const d = new Date(2020, 0, 1 + i);
      saveAssessment({ date: iso(d), scores: { deep_squat: 2 } });
    }
    const list = loadAssessmentLog();
    expect(list.length).toBe(200);
    expect(list[0].date).toBe(iso(new Date(2020, 0, 6)));
    expect(list[list.length - 1].date).toBe(iso(new Date(2020, 0, 205)));
  });

  it('устойчив к битому JSON и мусору', () => {
    localStorage.setItem(ASSESSMENT_KEY, '{"broken":');
    expect(loadAssessmentLog()).toEqual([]);
    localStorage.setItem(ASSESSMENT_KEY, JSON.stringify([{ date: 'не дата', scores: {} }, { date: '2026-01-01', scores: { deep_squat: 7, thomas: 'x' } }]));
    const list = loadAssessmentLog();
    expect(list.length).toBe(1);
    expect(list[0].scores).toEqual({});
  });

  it('sanitizeAssessment отбрасывает невалидные даты и баллы', () => {
    expect(sanitizeAssessment(null)).toBeNull();
    expect(sanitizeAssessment({ date: 'вчера', scores: {} })).toBeNull();
    const ok = sanitizeAssessment({ id: 'a1', date: '2026-01-01T10:00:00', scores: { deep_squat: 1, bad: 5, str: '2' } });
    expect(ok?.scores).toEqual({ deep_squat: 1 });
  });
});

describe('Аналитика оценок', () => {
  beforeEach(() => localStorage.clear());

  it('summarizeAssessment: суммы, проценты и слабые зоны по порядку', () => {
    const e = saveAssessment({ date: daysAgo(1), scores: { deep_squat: 0, thomas: 1, shoulder_flexion: 2 } })[0];
    const sum = summarizeAssessment(e);
    expect(sum.total).toBe(3);
    expect(sum.max).toBe(12);
    expect(sum.counts.scored).toBe(3);
    expect(sum.counts).toEqual({ pass: 1, partial: 1, fail: 1, scored: 3 });
    expect(sum.weakest.length).toBe(2);
    expect(sum.weakest[0].test.id).toBe('deep_squat');
    expect(sum.weakest[0].score).toBe(0);
    expect(summarizeAssessment(null).total).toBe(0);
  });

  it('assessmentTrend: дельта итога и по тестам, история', () => {
    saveAssessment({ date: daysAgo(5), scores: { deep_squat: 1, thomas: 2 } });
    saveAssessment({ date: daysAgo(1), scores: { deep_squat: 2, thomas: 1, aslr: 0 } });
    const tr = assessmentTrend();
    expect(tr.deltaTotal).toBe(0); // 3 → 3
    const squat = tr.perTest.find(p => p.testId === 'deep_squat')!;
    expect(squat.delta).toBe(1);
    expect(tr.history.map(h => h.total)).toEqual([3, 3]);
  });

  it('weakestTests и correctivesForEntry только для баллов < 2', () => {
    saveAssessment({ date: daysAgo(1), scores: { deep_squat: 0, thomas: 1, shoulder_flexion: 2 } });
    const weak = weakestTests(latestAssessment());
    expect(weak.map(w => w.test.id).sort()).toEqual(['deep_squat', 'thomas']);
    const corr = correctivesForEntry(latestAssessment());
    expect(corr.length).toBe(2);
    expect(corr[0].exercises.length).toBeGreaterThan(0);
  });

  it('correctiveItemsForProtocol: блоки на слабые зоны, без дублей, слот daily', () => {
    saveAssessment({ date: daysAgo(1), scores: { deep_squat: 0, thomas: 1 } });
    const items = correctiveItemsForProtocol(latestAssessment(), [{ title: 'Коррекция: Thomas-тест (сгибатели бедра)' }]);
    expect(items.length).toBe(1);
    expect(items[0].slot).toBe('daily');
    expect(items[0].durationMin).toBe(5);
    expect(items[0].title).toContain('Присед');
    expect(items[0].script.length).toBeGreaterThan(20);
    const empty = correctiveItemsForProtocol(null, []);
    expect(empty.length).toBe(0);
    const dup = correctiveItemsForProtocol(latestAssessment(), [
      { title: 'Коррекция: Присед с руками над головой' },
      { title: 'Коррекция: Thomas-тест (сгибатели бедра)' },
    ]);
    expect(dup.length).toBe(0);
  });
});

describe('Экспорт', () => {
  beforeEach(() => localStorage.clear());

  it('assessmentCSV: шапка с тестами и строки', () => {
    saveAssessment({ date: daysAgo(1), scores: { deep_squat: 2 } });
    const csv = assessmentCSV();
    expect(csv.split('\n')[0]).toContain('deep_squat');
    expect(csv.split('\n')[0]).toContain('total');
    expect(csv.split('\n')[1]).toContain(daysAgo(1));
  });
});
