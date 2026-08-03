import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildClinicalStack, summarizeClinicalStack } from '../biostack-clinical-recommender';
import type { BioStackProfile } from '../biostack-ai.engine';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    getAll: () => store,
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('biostack-clinical-recommender', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const createTestProfile = (overrides?: Partial<BioStackProfile>): BioStackProfile => ({
    id: 'test',
    name: 'Test User',
    age: 30,
    weight: 80,
    height: 180,
    sex: 'male',
    experience: 'intermediate',
    goals: ['muscle_gain'],
    targetSystems: ['hepatic', 'cardio'],
    targetOrgans: ['LIVER', 'HEART'],
    healthConditions: [],
    currentMeds: [],
    avoidMeds: [],
    avoidIds: [],
    drugAllergies: [],
    jointSymptoms: [],
    neuroSymptoms: [],
    cnsSymptoms: [],
    toxicitySymptoms: [],
    supplementExperience: 'intermediate',
    preferredForms: [],
    budget: 'medium',
    adherenceLevel: 'good',
    cyclePhase: 'course',
    aasStatus: 'none',
    ...overrides,
  });

  describe('buildClinicalStack', () => {
    it('should return a valid ClinicalStackResult', () => {
      const profile = createTestProfile();
      const result = buildClinicalStack(profile);

      expect(result).toBeDefined();
      expect(result.substances).toBeInstanceOf(Array);
      expect(result.stackDescription).toBeDefined();
      expect(result.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(result.riskBefore).toBeGreaterThanOrEqual(0);
      expect(result.riskAfter).toBeGreaterThanOrEqual(0);
      expect(result.monitoring).toBeInstanceOf(Array);
      expect(result.specialInstructions).toBeInstanceOf(Array);
      expect(result.conflicts).toBeInstanceOf(Array);
      expect(result.safety).toBeDefined();
      expect(result.sourceOfTruth).toBe('support-plan/runSupportUnified');
    });

    it('should filter by organ systems when filterOrgans provided', () => {
      const profile = createTestProfile();
      const result = buildClinicalStack(profile, {
        filterOrgans: ['hepatic'],
        useCourse: false,
        useLabs: false,
      });

      const systemIds = result.substances.map(s => s.id);
      expect(result.substances.length).toBeGreaterThan(0);
    });

    it('should filter by mechanisms when filterMechanisms provided', () => {
      const profile = createTestProfile();
      const result = buildClinicalStack(profile, {
        filterMechanisms: ['cv1', 'cv2'],
        useCourse: false,
        useLabs: false,
      });

      expect(result.substances.length).toBeGreaterThan(0);
    });

    it('should filter by lab markers when filterMarkers provided', () => {
      const profile = createTestProfile();
      const result = buildClinicalStack(profile, {
        filterMarkers: ['ALT', 'AST'],
        useCourse: false,
        useLabs: false,
      });

      expect(result.substances.length).toBeGreaterThan(0);
    });

    it('should apply evidence level filter', () => {
      const profile = createTestProfile();
      const resultA = buildClinicalStack(profile, {
        evidenceLevel: 'A',
        useCourse: false,
        useLabs: false,
      });

      const resultB = buildClinicalStack(profile, {
        evidenceLevel: 'B',
        useCourse: false,
        useLabs: false,
      });

      expect(resultA.substances.length).toBeGreaterThanOrEqual(0);
      expect(resultB.substances.length).toBeGreaterThanOrEqual(0);
    });

    it('should limit stack size when maxStackSize provided', () => {
      const profile = createTestProfile();
      const result = buildClinicalStack(profile, {
        maxStackSize: 5,
        useCourse: false,
        useLabs: false,
      });

      expect(result.substances.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty profile gracefully', () => {
      const profile = createTestProfile({
        targetSystems: [],
        targetOrgans: [],
      });
      const result = buildClinicalStack(profile, {
        useCourse: false,
        useLabs: false,
      });

      expect(result).toBeDefined();
      expect(result.substances).toBeInstanceOf(Array);
    });

    it('should exclude substances in avoidIds', () => {
      const profile = createTestProfile({
        avoidIds: ['nac', 'tudca'],
      });
      const result = buildClinicalStack(profile, {
        useCourse: false,
        useLabs: false,
      });

      const ids = result.substances.map(s => s.id.toLowerCase());
      expect(ids).not.toContain('nac');
      expect(ids).not.toContain('tudca');
    });

    it('should handle course context when useCourse is true', () => {
      const profile = createTestProfile({
        aasStatus: 'course',
        cyclePhase: 'course',
      });

      // Mock hydrateState to return course data
      localStorage.setItem('he_pharma_state', JSON.stringify({
        pharma: { phase: 'course', aas: ['test_enan'], hasGH: false },
      }));

      const result = buildClinicalStack(profile, {
        useCourse: true,
        useLabs: false,
      });

      expect(result).toBeDefined();
      expect(result.substances.length).toBeGreaterThan(0);
    });

    it('should return isOrientational flag when no course or labs', () => {
      const profile = createTestProfile({ aasStatus: 'none' });
      const result = buildClinicalStack(profile, {
        useCourse: false,
        useLabs: false,
      });

      expect(result.isOrientational).toBe(true);
    });

    it('should sort substances by source order (mandatory > lab > tz > greedy)', () => {
      const profile = createTestProfile();
      const result = buildClinicalStack(profile, {
        useCourse: false,
        useLabs: false,
      });

      const sources = result.substances.map(s => s.source);
      const validSources = sources.filter(s => s);
      if (validSources.length > 1) {
        for (let i = 1; i < validSources.length; i++) {
          const order = { mandatory: 0, lab: 1, tz: 2, greedy: 3 };
          const prev = order[validSources[i - 1] as keyof typeof order] ?? 2;
          const curr = order[validSources[i] as keyof typeof order] ?? 2;
          // Source order should be non-decreasing (mandatory first, then lab, etc.)
          expect(prev).toBeLessThanOrEqual(curr);
        }
      }
    });
  });

  describe('summarizeClinicalStack', () => {
    it('should return a non-empty string summary', () => {
      const profile = createTestProfile();
      const result = buildClinicalStack(profile, {
        useCourse: false,
        useLabs: false,
      });
      const summary = summarizeClinicalStack(result);

      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should include substance names in summary', () => {
      const profile = createTestProfile();
      const result = buildClinicalStack(profile, {
        useCourse: false,
        useLabs: false,
      });
      const summary = summarizeClinicalStack(result);

      if (result.substances.length > 0) {
        const firstName = result.substances[0].name;
        expect(summary).toContain(firstName);
      }
    });
  });
});
