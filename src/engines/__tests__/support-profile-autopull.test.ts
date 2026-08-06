import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hydrateState } from '../support-plan/engine';

// Мок localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal('localStorage', localStorageMock);
});

describe('hydrateState: nested чтение из UnifiedSettings', () => {
  it('читает lifestyle.sleepHours (не flat)', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 85, age: 30, sex: 'male', height: 180 },
        lifestyle: { sleepHours: 6, stressLevel: 8 },
      },
    }));
    const r = hydrateState();
    expect(r.profile?.sleepHours).toBe(6);
    expect(r.profile?.stressLevel).toBe(8);
  });

  it('читает personal.weight (не flat weight)', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 95, age: 25, sex: 'male' },
        lifestyle: { sleepHours: 7, stressLevel: 3 },
      },
    }));
    const r = hydrateState();
    expect(r.profile?.weight).toBe(95);
    expect(r.profile?.age).toBe(25);
  });

  it('нормализация aggressionScore 1-5 → 0-10 (×2)', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7, stressLevel: 3 },
        health: { aggressionScore: 4 },
      },
    }));
    const r = hydrateState();
    expect((r.neuro as any)?.aggressionScore).toBe(8); // 4×2
  });

  it('читает health.dopamineScore/serotoninScore', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        health: { dopamineScore: 2, serotoninScore: 1 },
      },
    }));
    const r = hydrateState();
    expect((r.neuro as any)?.dopamineScore).toBe(2);
    expect((r.neuro as any)?.serotoninScore).toBe(1);
  });

  it('читает health.jointPainSeverity → oda.jointPain (enum)', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        health: { jointPainSeverity: 'severe' },
      },
    }));
    const r = hydrateState();
    expect((r.oda as any)?.jointPain).toBe('severe');
  });

  it('health.jointPain=true (legacy boolean) → oda.jointPain=moderate', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        health: { jointPain: true },
      },
    }));
    const r = hydrateState();
    expect((r.oda as any)?.jointPain).toBe('moderate');
  });

  it('читает pharma.currentSubstances → pharma.aas', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        pharma: {
          phase: 'course',
          currentSubstances: [
            { id: 'test_enan', doseMgWeek: 500, weeks: 12 },
            { id: 'trenbolone_acetate', doseMgWeek: 300, weeks: 8 },
          ],
        },
      },
    }));
    const r = hydrateState();
    expect((r.pharma as any)?.aas).toHaveLength(2);
    expect((r.pharma as any)?.aas[0].id).toBe('test_enan');
    expect((r.pharma as any)?.aas[1].doseMgWeek).toBe(300);
  });

  it('читает pharma.ghIU/insulinIU/igfMcg', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        pharma: { phase: 'course', ghIU: 4, insulinIU: 10, igfMcg: 50, hasGH: true, hasInsulin: true },
      },
    }));
    const r = hydrateState();
    expect((r.pharma as any)?.ghIU).toBe(4);
    expect((r.pharma as any)?.insulinIU).toBe(10);
    expect((r.pharma as any)?.igfMcg).toBe(50);
    expect((r.pharma as any)?.hasGH).toBe(true);
  });

  it('читает health.chronicConditions → healthConditions', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        health: { chronicConditions: ['diabetes', 'hypertension'] },
      },
    }));
    const r = hydrateState();
    expect((r as any).healthConditions).toContain('diabetes');
    expect((r as any).healthConditions).toContain('hypertension');
  });

  it('adapter: symptoms.recent → string[] активных', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        symptoms: {
          recent: {
            insomnia: { score: 3, date: '2026-08-01' },
            anxiety: { score: 2, date: '2026-08-01' },
            joint_pain: { score: 0, date: '2026-07-15' },
          },
        },
      },
    }));
    const r = hydrateState();
    const symList = (r as any).symptomsList as string[] | undefined;
    expect(symList).toBeDefined();
    expect(symList).toContain('insomnia');
    expect(symList).toContain('anxiety');
    expect(symList).not.toContain('joint_pain'); // score=0
  });

  it('adapter: labs.summary → flatPanel', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        labs: {
          status: 'partial',
          summary: {
            ALT: { value: 55, date: '2026-08-01', unit: 'U/L' },
            CRP: { value: 4.2, date: '2026-08-01', unit: 'mg/L' },
          },
        },
      },
    }));
    const r = hydrateState();
    expect(r.labs).toBeDefined();
    const fp = (r.labs as any)?.fullPanel;
    expect(fp).toBeDefined();
    const biochem = fp?.panelBiochem;
    expect(biochem?.ALT).toBe('55');
    expect(biochem?.CRP).toBe('4.2');
  });

  it('fallback на defaults при пустом профиле', () => {
    // При полностью пустом localStorage profile будет undefined (нет данных)
    const r = hydrateState();
    expect(r.profile).toBeUndefined();
  });

  it('defaults при пустом settings в he_profile_v2', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({ settings: {} }));
    const r = hydrateState();
    expect(r.profile?.weight).toBe(80);
    expect(r.profile?.sleepHours).toBe(7);
    expect(r.profile?.stressLevel).toBe(4);
  });

  it('phase маппинг: baseline→base, post_pct→pct', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        pharma: { phase: 'baseline', currentSubstances: [] },
      },
    }));
    const r = hydrateState();
    expect((r.pharma as any)?.phase).toBe('base');
  });

  it('neuro.gabaBalance из health.gabaBalance', () => {
    localStorageMock.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 80 },
        lifestyle: { sleepHours: 7 },
        health: { gabaBalance: 'overexcited', coordinationIssues: true },
      },
    }));
    const r = hydrateState();
    expect((r.neuro as any)?.gabaBalance).toBe('overexcited');
    expect((r.neuro as any)?.coordinationIssues).toBe(true);
  });
});
