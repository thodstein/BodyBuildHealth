/**
 * bb-taper-pro3-e4.test.ts — PRO-3 Э4 «trial → пик без потерь»:
 *   lossless carbLoadStrategy в плане (undulating/linear не вырождаются в moderate),
 *   configFromPlan приоритет стратегии из плана (back-compat через carbMode),
 *   Prep-цикл/сезон несут carbDoseGPerKg + testPeakWeekId,
 *   таб «Тапер ББ» (питание) не откатывает prepWeeks дефолтом 12 (source-guard).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildBBContestPrepPlan,
  configFromPlan,
  type BBContestPrepConfig,
  type BBContestPrepPlan,
} from '../bb-contest-prep.engine';
import { buildPrepCycle, buildPrepSeason, type PrepCycleConfig, type PrepSeasonConfig } from '../bb-prep-cycle.engine';
import { DEFAULT_WORKMAX } from '../bb-builder.engine';
import { storeContestPrepPlan, saveContestPrepEverywhere, loadContestPrepPlan } from '../bb-contest-prep-sync';
import { isoAddDays, isoToday } from '../bb-contest-prep.engine';

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
const cfg = (over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig => ({
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
  showDate: addDaysIso(isoToday(), 84), weeksOut: 2, trainingProtocol: 'bb',
  carbLoadStrategy: 'moderate', waterStrategy: 'stable', sodiumStrategy: 'stable',
  ...over,
});

const EQ = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
function pcBase(over: Partial<PrepCycleConfig> = {}): PrepCycleConfig {
  return {
    category: 'mens_physique', sex: 'male', accentMuscles: ['shoulders', 'back'],
    minimalMuscles: ['quads', 'arms'], weeks: 12, taperWeeks: 3,
    showDate: '2027-03-01', level: 'intermediate', trainingYears: 4,
    equipment: EQ, workMax: { ...DEFAULT_WORKMAX }, enhanced: false, weightKg: 82,
    experienceLevel: 'intermediate', ...over,
  } as PrepCycleConfig;
}

describe('PRO-3 Э4 — lossless carbLoadStrategy', () => {
  it('undulating и linear переживают план ↔ конфиг', () => {
    for (const strat of ['undulating', 'linear', 'front', 'back'] as const) {
      const plan = buildBBContestPrepPlan(cfg({ carbLoadStrategy: strat }), { prepWeeks: 10, taperWeeks: 2 });
      expect(plan.peakWeek.carbLoadStrategy).toBe(strat);
      expect(configFromPlan(plan).carbLoadStrategy).toBe(strat);
    }
  });

  it('back-compat: старый план без поля читается через carbMode', () => {
    const plan = buildBBContestPrepPlan(cfg({ carbLoadStrategy: 'front' }), { prepWeeks: 8, taperWeeks: 2 });
    const legacy: BBContestPrepPlan = JSON.parse(JSON.stringify(plan));
    delete legacy.peakWeek.carbLoadStrategy;
    expect(configFromPlan(legacy).carbLoadStrategy).toBe('front');
    legacy.peakWeek.carbMode = 'conservative';
    expect(configFromPlan(legacy).carbLoadStrategy).toBe('back');
  });

  it('сохранение из таба (без явных opts) не теряет id/дозу/стратегию', () => {
    const first = buildBBContestPrepPlan(cfg({ carbLoadStrategy: 'undulating' }), {
      prepWeeks: 14, taperWeeks: 3, carbDoseGPerKg: 8, testPeakWeekId: 'trial_8', postShowTrack: 'reverse',
    });
    storeContestPrepPlan(first, cfg({ carbLoadStrategy: 'undulating' }));
    const tabCfg = configFromPlan(loadContestPrepPlan()!);
    // как сохраняет таб: source + taperWeeks черновика, без prepWeeks
    const saved = saveContestPrepEverywhere({ ...tabCfg, weeksOut: 3 }, { source: 'planner', taperWeeks: 3 });
    expect(saved!.peakWeek.carbLoadStrategy).toBe('undulating');
    expect(saved!.peakWeek.carbDoseGPerKg).toBe(8);
    expect(saved!.testPeakWeekId).toBe('trial_8');
    expect(saved!.preparation.weeks).toBe(14);
  });
});

describe('PRO-3 Э4 — Prep-цикл/сезон несут trial', () => {
  it('buildPrepCycle(cfg, {доза, id}) → план с дозой и ссылкой', () => {
    const res = buildPrepCycle(pcBase({ carbLoadStrategy: 'undulating' }), { carbDoseGPerKg: 9, testPeakWeekId: 'trial_9' });
    expect(res.prepPlan.peakWeek.carbDoseGPerKg).toBe(9);
    expect(res.prepPlan.testPeakWeekId).toBe('trial_9');
    expect(res.prepPlan.peakWeek.carbLoadStrategy).toBe('undulating');
  });

  it('buildPrepSeason(cfg, opts) — каждый цикл сезона с trial-данными', () => {
    const seasonCfg = {
      ...pcBase(),
      prepWeeksPerComp: 10, taperWeeks: 2,
      competitions: [
        { id: 'c1', name: 'Кубок A', date: addDaysIso(isoToday(), 70), priority: 'A' },
        { id: 'c2', name: 'Кубок B', date: addDaysIso(isoToday(), 182), priority: 'B' },
      ],
    } as PrepSeasonConfig;
    const res = buildPrepSeason(seasonCfg, { carbDoseGPerKg: 7, testPeakWeekId: 'trial_7' });
    expect(res.cycles.length).toBe(2);
    for (const c of res.cycles) {
      expect(c.prepPlan.peakWeek.carbDoseGPerKg).toBe(7);
      expect(c.prepPlan.testPeakWeekId).toBe('trial_7');
    }
  });
});

describe('PRO-3 Э4 — питание не откатывает длину подготовки', () => {
  it('source-guard: таб/Context больше не передают prepWeeks: 12', () => {
    const tab = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'NutritionScreen_parts', 'IndividualPlan', 'PeakWeekTab.tsx'), 'utf8');
    const ctx = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'NutritionScreen_parts', 'IndividualPlan', 'IndividualPlanContext.tsx'), 'utf8');
    expect(tab).not.toMatch(/saveContestPrepEverywhere\(effDraft, \{ source: 'planner', prepWeeks: 12/);
    expect(tab).toMatch(/saveContestPrepEverywhere\(effDraft, \{ source: 'planner', taperWeeks: effDraft\.weeksOut \}\)/);
    expect(ctx).not.toMatch(/saveContestPrepEverywhere\(cfg, \{ source: 'planner', prepWeeks: 12/);
    expect(ctx).toMatch(/saveContestPrepEverywhere\(cfg, \{ source: 'planner', taperWeeks: cfg\.weeksOut \}\)/);
    // превью таба читает дозу из сохранённого плана
    expect(tab).toMatch(/const dose = existing\?\.peakWeek\.carbDoseGPerKg;/);
  });
});
