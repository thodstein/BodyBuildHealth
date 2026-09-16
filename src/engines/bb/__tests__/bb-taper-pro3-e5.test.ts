/**
 * bb-taper-pro3-e5.test.ts — PRO-3 Э5 «пик-неделя по науке 2024–2026»:
 *   стратегия 'direct' — загрузка без деплеции (Homer 2024: деплеция не обязательна);
 *   гейт новичка (Homer RCT), round-trip плана, заметки фронт-лоада/Na шоу-дня, UI-чип.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildPeakWeek,
  buildBBContestPrep,
  buildBBContestPrepPlan,
  configFromPlan,
  validateBBContestPrepConfig,
  CARB_DISTRIBUTION,
  PHASES_BY_STRATEGY,
  type BBContestPrepConfig,
  isoAddDays,
  isoToday,
} from '../bb-contest-prep.engine';

const cfg = (over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig => ({
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'advanced', enhanced: false, prepCount: 2,
  showDate: isoAddDays(isoToday(), 30), weeksOut: 2, trainingProtocol: 'bb',
  carbLoadStrategy: 'direct', waterStrategy: 'stable', sodiumStrategy: 'stable',
  ...over,
});

describe('PRO-3 Э5 — direct без деплеции', () => {
  it('фазы: 4 загрузки + 2 пика + шоу (без деплеции), бюджет делится 30/28/24/18', () => {
    expect(PHASES_BY_STRATEGY.direct).toEqual(['load_1', 'load_2', 'load_3', 'load_4', 'peak', 'peak_2', 'show']);
    expect(CARB_DISTRIBUTION.direct).toEqual([0.30, 0.28, 0.24, 0.18]);
    const days = buildPeakWeek(cfg());
    expect(days).toHaveLength(7);
    expect(days.some(d => d.phase.startsWith('deplete'))).toBe(false);
    expect(days.filter(d => d.phase.startsWith('load'))).toHaveLength(4);
    const loads = days.filter(d => d.phase.startsWith('load'));
    // бюджет распределён по убывающим долям (не «ровно» и не весь на последний день)
    for (let i = 1; i < loads.length; i++) expect(loads[i - 1].carbsG).toBeGreaterThan(loads[i].carbsG);
    const r = buildBBContestPrep(cfg());
    expect(r.rationale.join(' ')).toMatch(/деплеция 0 дн/);
  });

  it('round-trip: план хранит direct, configFromPlan возвращает direct', () => {
    const plan = buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2 });
    expect(plan.peakWeek.carbLoadStrategy).toBe('direct');
    expect(configFromPlan(plan).carbLoadStrategy).toBe('direct');
  });

  it('гейт новичка: beginner+direct → warning (Homer RCT); advanced — тихо', () => {
    const beginner = validateBBContestPrepConfig(cfg({ experienceLevel: 'beginner', prepCount: 0 }));
    expect(beginner.warnings.join(' ')).toMatch(/без деплеции/);
    const adv = validateBBContestPrepConfig(cfg());
    expect(adv.warnings.join(' ')).not.toMatch(/без деплеции/);
  });
});

describe('PRO-3 Э5 — заметки науки', () => {
  it('фронт-лоад/direct: заметка «гликоген держится до 5 дней» на load-днях', () => {
    const front = buildPeakWeek(cfg({ carbLoadStrategy: 'front' }));
    const loadFront = front.find(d => d.phase.startsWith('load'))!;
    expect(loadFront.mealNotes.join(' ')).toMatch(/до 5 дней/);
    const mod = buildPeakWeek(cfg({ carbLoadStrategy: 'moderate' }));
    const loadMod = mod.find(d => d.phase.startsWith('load'))!;
    expect(loadMod.mealNotes.join(' ')).not.toMatch(/до 5 дней/);
  });

  it('шоу-день: Na-advisory (спекулятивно, после trial)', () => {
    const days = buildPeakWeek(cfg({ carbLoadStrategy: 'moderate' }));
    const show = days.find(d => d.phase === 'show')!;
    expect(show.mealNotes.join(' ')).toMatch(/Na шоу-дня/);
    expect(show.mealNotes.join(' ')).toMatch(/Homer 2024/);
  });
});

describe('PRO-3 Э5 — UI source-guard', () => {
  it('чип «Без деплеции» в шаге contest', () => {
    const sec = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'bb-contest-prep-sections.tsx'), 'utf8');
    expect(sec).toMatch(/data-bb=\{`carb-\$\{m\}`\}/);
    expect(sec).toMatch(/'Без деплеции'/);
    expect(sec).toMatch(/Homer 2024: деплеция не обязательна/);
  });
});
