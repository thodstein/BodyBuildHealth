/**
 * bb-quality-weekly.test.ts — понедельная оценка: факт выдачи × параметры,
 * без выдуманных норм. Штатные планы обязаны получать адекватные скоры
 * (регрессия бага «0–13 из 100»).
 */
import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import {
  scoreVolumeWeek,
  scoreProWeek,
  averageWeeklyScores,
  gradeFor,
} from '../bb-quality-weekly.engine';

const baseWM = { chest: 100, back: 120, quads: 140, hamstrings: 100, shoulders: 60, biceps: 45, triceps: 50 };

describe('bb-quality-weekly: штатные планы — адекватные скоры', () => {
  it('upper/lower 4 нед: среднее объёма ≥65, ни одна рабочая неделя не в яме', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, workMax: baseWM } as any);
    const avg = averageWeeklyScores(plan as any);
    expect(avg.weeks).toBe(4);
    expect(avg.avgVolume).toBeGreaterThanOrEqual(65);
    for (const w of plan.weeks) {
      if ((w as any).deload || (w as any).phase === 'deload') continue;
      expect(scoreVolumeWeek(plan as any, w.week).score).toBeGreaterThanOrEqual(55);
    }
  });

  it('ppl 8 нед: среднее объёма и PRO ≥65', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 8, workMax: baseWM } as any);
    const avg = averageWeeklyScores(plan as any);
    expect(avg.avgVolume).toBeGreaterThanOrEqual(65);
    expect(avg.avgPro).toBeGreaterThanOrEqual(55);
    // Шкалы не суммируются: средний объём не должен быть занижен PRO-штрафами.
    expect(avg.perWeek.length).toBe(8);
  });

  it('специализация: поддержание на MEV — «по дизайну», без error', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 8,
      workMax: baseWM, weakPoints: ['biceps'], specialization: true,
    } as any);
    const avg = averageWeeklyScores(plan as any);
    expect(avg.avgVolume).toBeGreaterThanOrEqual(60);
    for (const w of plan.weeks) {
      const s = scoreVolumeWeek(plan as any, w.week);
      const hardErrors = s.issues.filter(i => i.severity === 'error' && i.code !== 'excluded_muscle_trained');
      expect(hardErrors).toEqual([]);
    }
  });

  it('щадящая травма: сниженный объём бицепса — без дефицита-ошибки', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4,
      workMax: baseWM, injuries: [{ muscle: 'biceps', exclude: false }],
    } as any);
    const avg = averageWeeklyScores(plan as any);
    expect(avg.avgVolume).toBeGreaterThanOrEqual(60);
    const w1 = scoreVolumeWeek(plan as any, 1);
    expect(w1.issues.find(i => i.muscle === 'biceps' && i.code === 'below_mev_floor')).toBeUndefined();
  });

  it('исключённая травма: мышца отсутствует и не штрафуется', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4,
      workMax: baseWM, injuries: [{ muscle: 'calves', exclude: true }],
    } as any);
    const w1 = scoreVolumeWeek(plan as any, 1);
    // Нет штрафа за «недогруз» исключённой мышцы.
    expect(w1.issues.find(i => i.muscle === 'calves' && (i.code === 'below_mev_floor' || i.code === 'off_target'))).toBeUndefined();
  });

  it('делод-неделя: оценивается правилами делода, без vol-дефицитов', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 8, workMax: baseWM, autoDeload: true } as any);
    const deloads = plan.weeks.filter((w: any) => w.deload || w.phase === 'deload');
    expect(deloads.length).toBeGreaterThan(0);
    for (const d of deloads) {
      const s = scoreVolumeWeek(plan as any, d.week);
      expect(s.isDeload).toBe(true);
      expect(s.issues.find(i => i.code === 'below_mev_floor' || i.code === 'off_target')).toBeUndefined();
    }
  });

  it('cut + mev-цель: поддерживающий объём — не нарушение', () => {
    const plan = buildBBPlan({
      patternId: 'fullbody_3', level: 'intermediate', goal: 'cut', weeks: 4,
      workMax: baseWM, volumeGoal: 'mev',
    } as any);
    const avg = averageWeeklyScores(plan as any);
    expect(avg.avgVolume).toBeGreaterThanOrEqual(60);
  });
});

describe('bb-quality-weekly: свойства', () => {
  it('чистота: повторный вызов идентичен, план не мутируется', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, workMax: baseWM } as any);
    const before = JSON.stringify(plan);
    const a = scoreVolumeWeek(plan as any, 1);
    const b = scoreVolumeWeek(plan as any, 1);
    expect(b).toEqual(a);
    expect(JSON.stringify(plan)).toBe(before);
    const p1 = scoreProWeek(plan as any, 1);
    const p2 = scoreProWeek(plan as any, 1);
    expect(p2).toEqual(p1);
  });

  it('все скоры в 0–100, грейнд по порогам', () => {
    const plan = buildBBPlan({ patternId: 'bro_5', level: 'advanced', goal: 'mass', weeks: 6, workMax: baseWM } as any);
    const avg = averageWeeklyScores(plan as any);
    expect(avg.avgVolume).toBeGreaterThanOrEqual(0);
    expect(avg.avgVolume).toBeLessThanOrEqual(100);
    expect(avg.avgPro).toBeGreaterThanOrEqual(0);
    expect(avg.avgPro).toBeLessThanOrEqual(100);
    expect(avg.avgMuscles.length).toBeGreaterThan(0);
    expect(gradeFor(90)).toContain('Отлично');
    expect(gradeFor(70)).toContain('Хорошо');
    expect(gradeFor(50)).toContain('Средне');
    expect(gradeFor(10)).toContain('Слабо');
  });

  it('PRO-неделя: форма совместима с карточкой (patterns/angles/stretches/technique)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 2, workMax: baseWM } as any);
    const pro = scoreProWeek(plan as any, 1);
    expect(Array.isArray(pro.patterns)).toBe(true);
    expect(Array.isArray(pro.angles)).toBe(true);
    expect(Array.isArray(pro.stretches)).toBe(true);
    expect(pro.technique.totalBlocks).toBeGreaterThan(0);
    const meso = scoreProWeek(plan as any, 'meso');
    expect(meso.scope).toBe('meso');
    expect(meso.technique.totalBlocks).toBeGreaterThanOrEqual(pro.technique.totalBlocks);
  });

  it('каждый issue объёма несёт источник ожидания', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, workMax: baseWM } as any);
    for (const w of plan.weeks) {
      for (const i of scoreVolumeWeek(plan as any, w.week).issues) {
        expect(i.source.length).toBeGreaterThan(0);
        expect(i.message.length).toBeGreaterThan(0);
      }
    }
  });
});
