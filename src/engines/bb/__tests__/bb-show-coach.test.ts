/**
 * bb-show-coach.test.ts — тренерский score ББ-шоу-пика (bb-show-coach.engine):
 * оценка подготовки/тапера/пик-недели/готовности тела/безопасности/прогресса веса.
 */
import { describe, expect, it } from 'vitest';
import { scoreBBShowPrep, recommendBBShowConfig } from '../bb-show-coach.engine';
import type { BBContestPrepPlan } from '../bb-contest-prep.engine';

const plan = (over: Partial<BBContestPrepPlan> = {}): BBContestPrepPlan => ({
  id: 'p1', version: 1, algorithmVersion: 1, status: 'built',
  createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z', source: 'bb_auto',
  showDate: '2026-09-20', category: 'mens_physique', sex: 'male',
  preparation: { startDate: '2026-07-01', weeks: 12, finalWeeks: 2, targetRatePctPerWeek: 0.5, startingWeightKg: 85, currentCalories: 2200, stepsPerDay: 10000, cardioMinutesPerWeek: 180, volumeMult: 1 },
  taper: { enabled: true, weeks: 2, volumeProfile: [0.85, 0.6], intensityProfile: [1, 1], rirProfile: [[2, 3], [3, 4]] },
  peakWeek: { enabled: true, strategy: 'moderate', waterMode: 'minimal', sodiumMode: 'constant', carbMode: 'moderate' },
  phases: [],
  safety: { contraindications: [], warnings: [], requiresReview: false, blockedProtocol: false },
  ...over,
});

describe('scoreBBShowPrep', () => {
  it('сбалансированный план → высокая готовность, без danger', () => {
    const v = scoreBBShowPrep({ plan: plan(), currentBodyFatPct: 7 });
    expect(v.score).toBeGreaterThanOrEqual(70);
    expect(v.notes.some(n => n.severity === 'danger')).toBe(false);
    expect(v.notes.some(n => n.icon === '✅')).toBe(true);
  });

  it('короткая подготовка + выключенный taper → низкий score', () => {
    const v = scoreBBShowPrep({ plan: plan({ preparation: { ...plan().preparation, weeks: 3 }, taper: { ...plan().taper, enabled: false } }) });
    expect(v.score).toBeLessThan(70);
    expect(v.notes.some(n => n.text.includes('Taper не включён'))).toBe(true);
    expect(v.notes.some(n => n.text.includes('Подготовка всего 3 нед'))).toBe(true);
  });

  it('высокий % жира → danger-заметка о преждевременности', () => {
    const v = scoreBBShowPrep({ plan: plan(), currentBodyFatPct: 18 });
    expect(v.notes.some(n => n.severity === 'danger' && n.text.includes('преждевременна'))).toBe(true);
    expect(v.score).toBeLessThan(60);
  });

  it('умерные моды пик-недели → warn', () => {
    const v = scoreBBShowPrep({ plan: plan({ peakWeek: { ...plan().peakWeek, waterMode: 'moderate', sodiumMode: 'moderate' } }) });
    expect(v.notes.some(n => n.severity === 'warn' && n.text.includes('Умеренные моды'))).toBe(true);
  });

  it('противопоказания → danger о мед. сопровождении', () => {
    const v = scoreBBShowPrep({ plan: plan({ safety: { contraindications: ['heart'], warnings: [], requiresReview: true, blockedProtocol: true } }) });
    expect(v.notes.some(n => n.severity === 'danger' && n.text.includes('мед. сопровождение'))).toBe(true);
    expect(v.notes.some(n => n.severity === 'danger' && n.text.includes('заблокирован'))).toBe(true);
  });

  it('прогресс веса: рост за 7 дней → warn, снижение → ok', () => {
    // 14 записей: 7 «предыдущих» (84) + 7 «последних» (85.5) — рост
    const mk = (start: number, delta: number) => Array.from({ length: 7 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, weight: start + i * delta }));
    const gain = scoreBBShowPrep({ plan: plan(), weightLog: [...mk(84, 0), ...mk(85, 0.1)] });
    expect(gain.notes.some(n => n.text.includes('Вес за последние 7 дней растёт'))).toBe(true);
    const loss = scoreBBShowPrep({ plan: plan(), weightLog: [...mk(85, 0), ...mk(84, -0.1)] });
    expect(loss.notes.some(n => n.text.includes('Вес снижается'))).toBe(true);
  });

  it('рекомендации: безопасные дефолты при требует-сопровождение', () => {
    const cfg = recommendBBShowConfig(plan({ safety: { contraindications: ['kidney'], warnings: [], requiresReview: true, blockedProtocol: true } }));
    expect(cfg.waterStrategy).toBe('minimal');
    expect(cfg.sodiumStrategy).toBe('constant');
  });
});
