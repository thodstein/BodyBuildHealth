/**
 * supplement-compliance.engine.ts — audit tests
 *
 * P0-1: computeCompliance must read from he_support_diary (not he_symptom_assignments)
 * P1-1: adherence = 0 when there are 0 planSubs (not 100)
 * P1-1b: streak counts days with adherence >= 80 (not >= 100)
 */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { computeCompliance, getComplianceWeekLabel } from '../supplement-compliance.engine';

const DIARY_KEY = 'he_support_diary';

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => mockStorage[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { mockStorage[k] = v; }),
  removeItem: vi.fn((k: string) => { delete mockStorage[k]; }),
  clear: vi.fn(() => { for (const k in mockStorage) delete mockStorage[k]; }),
});

function makeEntry(date: string, subs: Record<string, { taken: boolean; dose?: string }>) {
  return { date, substances: subs, notes: '', complianceNotes: '', mood: 3 as const };
}

describe('supplement-compliance.engine', () => {
  beforeEach(() => {
    localStorage.removeItem(DIARY_KEY);
  });
  afterEach(() => {
    localStorage.removeItem(DIARY_KEY);
  });

  it('P0-1: computeCompliance reads from he_support_diary', () => {
    const entries = [
      makeEntry('2026-08-01', { agmatine: { taken: true }, nac: { taken: false } }),
      makeEntry('2026-08-02', { agmatine: { taken: true }, nac: { taken: true } }),
    ];
    localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
    const result = computeCompliance(7, ['agmatine', 'nac']);
    expect(result.today).toBeDefined();
    // 2026-08-02: 2/2 taken → adherence 100
    const day = result.weeks.flatMap(w => w.days).find(d => d.date === '2026-08-02');
    expect(day?.adherence).toBe(100);
    expect(day?.taken).toBe(2);
  });

  it('P1-1: adherence = 0 when planSubs is empty (not 100)', () => {
    const result = computeCompliance(7, []); // empty planSubs
    // When planSubs is empty, total = 0 → adherence = 0 (not 100)
    expect(result.today?.total).toBe(0);
    expect(result.today?.adherence).toBe(0);
    expect(result.overall7d).toBe(0);
    expect(result.overall30d).toBe(0);
  });

  it('P1-1b: streak counts days with adherence >= 80 (not >= 100)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const d1 = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10);
    const d2 = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const entries = [
      makeEntry(d2, { agmatine: { taken: true }, nac: { taken: true } }),     // 100%
      makeEntry(d1, { agmatine: { taken: true }, nac: { taken: false } }),    // 50%
      makeEntry(today, { agmatine: { taken: true }, nac: { taken: true } }),  // 100%
    ];
    localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
    // streak from today backwards: today (100>=80) ✓, d1 (50<80) ✗ → streak=1
    const result = computeCompliance(7, ['agmatine', 'nac']);
    expect(result.streak).toBe(1);
  });

  it('computeCompliance with no diary returns 0 adherence', () => {
    const result = computeCompliance(7, ['agmatine']);
    expect(result.today?.adherence).toBe(0);
    expect(result.overall7d).toBe(0);
  });

  it('getComplianceWeekLabel formats correctly', () => {
    const week = {
      startDate: '2026-08-01',
      endDate: '2026-08-07',
      days: [],
      overallAdherence: 85,
      totalAssigned: 14,
      totalTaken: 12,
      totalMissed: 2,
      bestDay: null,
      worstDay: null,
      streak: 3,
    } as any;
    const label = getComplianceWeekLabel(week);
    expect(label).toBe('1-7 авг');
  });

  it('per-substance adherence is computed from diary entries', () => {
    const today = new Date().toISOString().slice(0, 10);
    const d1 = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10);
    const d2 = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const entries = [
      makeEntry(d1, { agmatine: { taken: true } }),
      makeEntry(d2, { agmatine: { taken: true } }),
      makeEntry(today, { agmatine: { taken: false } }),
    ];
    localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
    const result = computeCompliance(7, ['agmatine']);
    expect(result.activeSubstances.length).toBe(1);
    expect(result.activeSubstances[0].id).toBe('agmatine');
    // 7 days in allDays, 2 taken → 29% (or 33% if 3 days)
    expect(result.activeSubstances[0].adherence7d).toBeGreaterThan(0);
    expect(result.activeSubstances[0].adherence7d).toBeLessThanOrEqual(100);
  });
});
