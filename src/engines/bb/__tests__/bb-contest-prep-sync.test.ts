/**
 * bb-contest-prep-sync.test.ts — Э0: единая точка записи prep.
 * saveContestPrepEverywhere/storeContestPrepPlan пишут оба ключа + событие;
 * loadContestPrepConfig восстанавливает конфиг из версионированного плана.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveContestPrepEverywhere,
  storeContestPrepPlan,
  loadContestPrepPlan,
  loadContestPrepConfig,
  clearContestPrepEverywhere,
  CONTEST_PREP_UPDATED_EVENT,
} from '../bb-contest-prep-sync';
import { buildBBContestPrepPlan, type BBContestPrepConfig } from '../bb-contest-prep.engine';

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const cfg = (): BBContestPrepConfig => ({
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
  showDate: addDaysIso(todayIso(), 60), weeksOut: 2, trainingProtocol: 'bb',
  carbLoadStrategy: 'moderate', waterStrategy: 'stable', sodiumStrategy: 'stable',
});

function goals(): any {
  return JSON.parse(localStorage.getItem('he_profile_v2') || '{}')?.settings?.goals ?? {};
}

describe('Э0: единая запись prep', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('saveContestPrepEverywhere: оба ключа + событие', () => {
    let detail: any = null;
    const h = (e: Event) => { detail = (e as CustomEvent).detail; };
    window.addEventListener(CONTEST_PREP_UPDATED_EVENT, h);
    try {
      const plan = saveContestPrepEverywhere(cfg(), { source: 'planner', prepWeeks: 8, taperWeeks: 2 });
      expect(plan).not.toBeNull();
      const g = goals();
      expect(typeof g.bbContestPrepPlan).toBe('string');
      expect(typeof g.bbPeakConfig).toBe('string');
      expect(g.peakWeek).toBe(true);
      expect(g.peakShowDay).toBe(plan!.showDate);
      expect(detail?.prepPlanId).toBe(plan!.id);
      expect(detail?.source).toBe('planner');
      expect(loadContestPrepPlan()?.id).toBe(plan!.id);
    } finally {
      window.removeEventListener(CONTEST_PREP_UPDATED_EVENT, h);
    }
  });

  it('storeContestPrepPlan: сохраняет готовый план как есть (id/testPeakWeekId) + событие', () => {
    const base = buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2 });
    const plan = { ...base, testPeakWeekId: 'trial_1', updatedAt: '2026-01-01T00:00:00.000Z' };
    let detail: any = null;
    const h = (e: Event) => { detail = (e as CustomEvent).detail; };
    window.addEventListener(CONTEST_PREP_UPDATED_EVENT, h);
    try {
      storeContestPrepPlan(plan, cfg(), { source: 'bb_auto' });
      const loaded = loadContestPrepPlan()!;
      expect(loaded.id).toBe(plan.id);
      expect(loaded.testPeakWeekId).toBe('trial_1');
      expect(detail?.prepPlanId).toBe(plan.id);
    } finally {
      window.removeEventListener(CONTEST_PREP_UPDATED_EVENT, h);
    }
  });

  it('loadContestPrepConfig: конфиг из версионированного плана (было null)', () => {
    const plan = buildBBContestPrepPlan(cfg(), { prepWeeks: 8, taperWeeks: 2 });
    storeContestPrepPlan(plan, cfg());
    // Убираем сырой конфиг — остаётся только план
    const raw = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    delete raw.settings.goals.bbPeakConfig;
    localStorage.setItem('he_profile_v2', JSON.stringify(raw));
    const out = loadContestPrepConfig();
    expect(out).not.toBeNull();
    expect(out!.showDate).toBe(plan.showDate);
    expect(out!.category).toBe(plan.category);
  });

  it('clearContestPrepEverywhere: чистит оба ключа', () => {
    saveContestPrepEverywhere(cfg(), { source: 'planner' });
    clearContestPrepEverywhere();
    const g = goals();
    expect(g.bbContestPrepPlan).toBeUndefined();
    expect(g.bbPeakConfig).toBeUndefined();
    expect(loadContestPrepPlan()).toBeNull();
  });
});
