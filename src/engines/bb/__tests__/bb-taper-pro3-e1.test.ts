/**
 * bb-taper-pro3-e1.test.ts — PRO-3 Э1 «стабильность контура записи»:
 *   D1/D2 — перенос даты шоу и расширение подготовки персистятся (source-guard);
 *   D3 — saveContestPrepEverywhere не откатывает prepWeeks/дозу trial/id/trial-id/трек;
 *        preservePlan=true — сохранить план как есть; явные opts приоритетнее carry-over.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  saveContestPrepEverywhere,
  storeContestPrepPlan,
  loadContestPrepPlan,
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
const cfg = (over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig => ({
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
  showDate: addDaysIso(todayIso(), 140), weeksOut: 2, trainingProtocol: 'bb',
  carbLoadStrategy: 'moderate', waterStrategy: 'stable', sodiumStrategy: 'stable',
  ...over,
});

describe('PRO-3 Э1 — контур записи', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('D3: сохранение из питания не откатывает prepWeeks/дозу/id/trial-id/трек', () => {
    const long = buildBBContestPrepPlan(cfg(), {
      prepWeeks: 16, taperWeeks: 3, carbDoseGPerKg: 9, testPeakWeekId: 'trial_9', postShowTrack: 'reverse',
    });
    storeContestPrepPlan(long, cfg());
    // «питание/панель» сохраняют без opts — раньше план пересобирался дефолтными 12 нед
    const saved = saveContestPrepEverywhere(cfg());
    expect(saved).not.toBeNull();
    expect(saved!.id).toBe(long.id);
    expect(saved!.preparation.weeks).toBe(16);           // было 12 (дефолт)
    expect(saved!.taper.weeks).toBe(3);                  // было 2 (cfg.weeksOut)
    expect(saved!.peakWeek.carbDoseGPerKg).toBe(9);      // было undefined
    expect(saved!.testPeakWeekId).toBe('trial_9');       // было undefined
    expect(saved!.postShowTrack).toBe('reverse');        // было 'recovery'
    const loaded = loadContestPrepPlan()!;
    expect(loaded.preparation.weeks).toBe(16);
    expect(loaded.peakWeek.carbDoseGPerKg).toBe(9);
    expect(loaded.testPeakWeekId).toBe('trial_9');
  });

  it('D3: preservePlan=true сохраняет существующий план как есть', () => {
    const long = buildBBContestPrepPlan(cfg(), { prepWeeks: 20, taperWeeks: 2 });
    storeContestPrepPlan(long, cfg());
    const out = saveContestPrepEverywhere(cfg(), { preservePlan: true });
    expect(out!.id).toBe(long.id);
    expect(out!.preparation.weeks).toBe(20);
    expect(out!.updatedAt).toBe(long.updatedAt);
  });

  it('D3: явные opts приоритетнее carry-over (ручная правка не блокируется)', () => {
    const long = buildBBContestPrepPlan(cfg(), { prepWeeks: 16, taperWeeks: 2 });
    storeContestPrepPlan(long, cfg());
    const out = saveContestPrepEverywhere(cfg(), { prepWeeks: 10, taperWeeks: 1 })!;
    expect(out.preparation.weeks).toBe(10);
    expect(out.taper.weeks).toBe(1);
  });

  it('D1/D2: перенос даты и расширение подготовки персистятся (source-guard)', () => {
    const src = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'BbAutoConstructor.tsx'), 'utf8');
    // D1: пересборка и сохранение с ЯВНОЙ новой датой (state prepShowDate ещё stale)
    expect(src).toMatch(/const cfgShifted = \{ \.\.\.buildContestPrepConfig\(\), showDate: d \}/);
    expect(src).toMatch(/savePrepToProfile\(plan, cfgShifted\)/);
    // зов drive-степ остался на новой дате
    expect(src).toMatch(/applyContestPrepToBBPlan\(builtPlan, cfgShifted/);
    // D2: расширение подготовки сохраняется в профиль
    expect(src).toMatch(/savePrepToProfile\(replanned, cfg\)/);
  });
});
