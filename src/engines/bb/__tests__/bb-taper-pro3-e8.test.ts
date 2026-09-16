/**
 * bb-taper-pro3-e8.test.ts — PRO-3 Э8 «post-show v2» (Buechel 2026, Silva 2025, AUT 2026):
 *   кривая recovery 12 нед (кап +800), regain 10–15% / окно 1–6 мес, женский пол 1400,
 *   живые цели не замирают после 4-й недели, рендер трека (reverse/recovery), advisory.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildBBContestPrepPlan,
  postShowRecoveryDiet,
  postShowReverseDiet,
  activePostShowCurve,
  buildPostShowPlan,
  nutritionTargetsForPrepDate,
  prepPhaseForDate,
  type BBContestPrepConfig,
  isoAddDays,
  isoToday,
} from '../bb-contest-prep.engine';
import { postShowRecoveryMarkers } from '../bb-prep-post-show-log.engine';

const cfg = (over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig => ({
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
  showDate: isoAddDays(isoToday(), 63), weeksOut: 2, trainingProtocol: 'bb',
  carbLoadStrategy: 'moderate', waterStrategy: 'stable', sodiumStrategy: 'stable',
  ...over,
});
const baseNutrition = { kcal: 2600, proteinG: 170, fatG: 65, carbsG: 300, waterMl: 3000, sodiumMg: 2800 };

describe('PRO-3 Э8 — кривая восстановления', () => {
  it('12 нед, нед 1 = +300, кап +800, монотонна; женский пол 1400', () => {
    const plan = buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2 });
    const post = buildPostShowPlan(plan);
    const curve = postShowRecoveryDiet(plan);
    expect(curve).toHaveLength(12);
    expect(curve[0].kcal).toBe(post.kcal + 300);
    expect(curve[11].kcal).toBe(post.kcal + 800);
    for (let i = 1; i < curve.length; i++) expect(curve[i].kcal).toBeGreaterThanOrEqual(curve[i - 1].kcal);
    // женский пол
    const fPlan = buildBBContestPrepPlan(cfg({ sex: 'female', category: 'bikini', weightKg: 48, bodyFatPct: 16 }), { prepWeeks: 8, taperWeeks: 2 });
    for (const wk of postShowRecoveryDiet(fPlan)) expect(wk.kcal).toBeGreaterThanOrEqual(1400);
  });

  it('живые цели не замирают после 4-й недели (день show+60 = уровень нед 9)', () => {
    const plan = buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2 });
    const curve = postShowRecoveryDiet(plan);
    const d60 = isoAddDays(plan.showDate, 60);
    const t = nutritionTargetsForPrepDate(d60, plan, baseNutrition);
    const expectedWeek = Math.min(11, Math.floor(60 / 7)); // 0-based индекс
    expect(t.kcal).toBe(curve[expectedWeek].kcal);
    expect(t.kcal).toBeGreaterThan(curve[3].kcal); // раньше клэмпилось на 4-й неделе
    expect(t.note).toMatch(/1–6 мес/);
    expect(curve[0].note).toMatch(/10–15%/);
  });

  it('окно фазы post_show = 84 дня; advisory про новый преп и regain в плане', () => {
    const plan = buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2 });
    expect(prepPhaseForDate(plan, isoAddDays(plan.showDate, 60))?.key).toBe('post_show');
    expect(prepPhaseForDate(plan, isoAddDays(plan.showDate, 90))).toBeNull();
    const post = buildPostShowPlan(plan);
    expect(post.durationDays).toBe(84);
    expect(post.notes.join(' ')).toMatch(/10–15%/);
    expect(post.notes.join(' ')).toMatch(/1–6 мес/);
    expect(post.notes.join(' ')).toMatch(/новый преп/);
  });

  it('трек: activePostShowCurve отдаёт reverse-кривую при треке reverse', () => {
    const plan = buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2, postShowTrack: 'reverse' });
    expect(activePostShowCurve(plan)[0].kcal).toBe(postShowReverseDiet(plan)[0].kcal);
    const def = buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2 });
    expect(activePostShowCurve(def)[0].kcal).toBe(postShowRecoveryDiet(def)[0].kcal);
    // живые цели с opts.reverse по-прежнему приоритетнее плана
    const t = nutritionTargetsForPrepDate(isoAddDays(def.showDate, 3), plan, baseNutrition, { postShowTrack: 'reverse' });
    expect(t.note).toMatch(/\(reverse\)/);
  });

  it('маркеры: гейт +10% (Buechel), +9% — не восстановлен', () => {
    const ok = postShowRecoveryMarkers({ week: 4, dateIso: 'x', weightKg: 88.5, sleepH: 8, hunger1_5: 2, cycle: 'restored', strengthReturnPct: 97 }, 80);
    expect(ok.weightRegained).toBe(true);
    expect(ok.allRecovered).toBe(true);
    const nine = postShowRecoveryMarkers({ week: 4, dateIso: 'x', weightKg: 87.2, sleepH: 8, hunger1_5: 2, cycle: 'restored', strengthReturnPct: 97 }, 80);
    expect(nine.weightRegained).toBe(false);
  });

  it('UI source-guard: рендер по треку, 10–15%, advisory', () => {
    const sec = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'bb-contest-prep-sections.tsx'), 'utf8');
    expect(sec).toContain('activePostShowCurve(prepPlan)');
    expect(sec).not.toMatch(/const curve = postShowRecoveryDiet\(prepPlan\);/);
    expect(sec).toMatch(/regain-цель \+10–15%/);
    expect(sec).toMatch(/активная фаза 1–6 мес/);
  });
});
