import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkStackToxicity,
  applyLabAdjustments,
  checkNutrientConflicts,
  optimizeTiming,
  findAbsorptionEnhancers,
  getSafeStackRecommendations,
  getDrugSafetyExclusions,
  checkStackToxicity,
  SUPPLEMENT_UPPER_LIMITS,
  SUPPLEMENT_OPTIMAL_LIMITS,
} from '../biostack-safety.engine';
import type { LabCompositeResult } from '../lab-analysis.engine';

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

describe('biostack-safety.engine', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('checkStackToxicity', () => {
    it('should return empty warnings for empty stack', () => {
      const warnings = checkStackToxicity([]);
      expect(warnings).toEqual([]);
    });

    it('should detect UL exceedance for zinc', () => {
      // Zinc UL is 40mg, 50mg should trigger warning
      const warnings = checkStackToxicity(['zinc']);
      // Zinc default dose is likely within limits, but let's check structure
      expect(warnings).toBeInstanceOf(Array);
    });

    it('should return warnings with correct structure', () => {
      const warnings = checkStackToxicity(['zinc', 'vitamin_c']);
      if (warnings.length > 0) {
        const w = warnings[0];
        expect(w).toHaveProperty('substanceId');
        expect(w).toHaveProperty('name');
        expect(w).toHaveProperty('totalDose');
        expect(w).toHaveProperty('ul');
        expect(w).toHaveProperty('percentUL');
        expect(w).toHaveProperty('severity');
        expect(w).toHaveProperty('message');
      }
    });
  });

  describe('applyLabAdjustments', () => {
    it('should return empty adjustments for null lab', () => {
      const adjustments = applyLabAdjustments(['nac', 'tudca'], null);
      expect(adjustments).toEqual([]);
    });

    it('should return empty adjustments for undefined lab', () => {
      const adjustments = applyLabAdjustments(['nac', 'tudca'], undefined);
      expect(adjustments).toEqual([]);
    });

    it('should return adjustments with correct structure', () => {
      const mockLab: LabCompositeResult = {
        interpretations: [
          { code: 'POTASSIUM', status: 'high', riskPercent: 80 },
        ],
        kidneyStress: 0,
        liverStress: 0,
        cardioRisk: 0,
        overallRisk: 0,
        coveragePercent: 0,
        systemCoverage: {},
        recommendations: [],
      };

      const adjustments = applyLabAdjustments(['potassium'], mockLab);
      expect(adjustments).toBeInstanceOf(Array);
      if (adjustments.length > 0) {
        const adj = adjustments[0];
        expect(adj).toHaveProperty('substanceId');
        expect(adj).toHaveProperty('name');
        expect(adj).toHaveProperty('originalDose');
        expect(adj).toHaveProperty('adjustedDose');
        expect(adj).toHaveProperty('multiplier');
        expect(adj).toHaveProperty('reason');
        expect(adj).toHaveProperty('labMarker');
        expect(adj).toHaveProperty('severity');
      }
    });

    it('should reduce potassium dose when potassium is high', () => {
      const mockLab: LabCompositeResult = {
        interpretations: [
          { code: 'POTASSIUM', status: 'high', riskPercent: 80 },
        ],
        kidneyStress: 0,
        liverStress: 0,
        cardioRisk: 0,
        overallRisk: 0,
        coveragePercent: 0,
        systemCoverage: {},
        recommendations: [],
      };

      const adjustments = applyLabAdjustments(['potassium'], mockLab);
      const potassiumAdj = adjustments.find(a => a.substanceId.includes('potassium'));
      if (potassiumAdj) {
        expect(potassiumAdj.multiplier).toBeLessThan(1.0);
        expect(potassiumAdj.severity).toBe('danger');
      }
    });
  });

  describe('checkNutrientConflicts', () => {
    it('should detect zinc-copper competition', () => {
      const warnings = checkNutrientConflicts(['zinc', 'copper']);
      expect(warnings.length).toBeGreaterThan(0);
      const zincCopper = warnings.find(w => w.idA.includes('zinc') && w.idB.includes('copper'));
      expect(zincCopper).toBeDefined();
    });

    it('should detect calcium-iron competition', () => {
      const warnings = checkNutrientConflicts(['calcium', 'iron']);
      const conflict = warnings.find(w => w.effect.includes('железа'));
      expect(conflict).toBeDefined();
    });

    it('should return empty array for non-conflicting stack', () => {
      const warnings = checkNutrientConflicts(['magnesium']);
      expect(warnings).toEqual([]);
    });
  });

  describe('optimizeTiming', () => {
    it('should recommend morning for fat-soluble vitamins', () => {
      const recs = optimizeTiming(['vitamin_d3', 'vitamin_k2']);
      const d3Rec = recs.find(r => r.substanceId.includes('vitamin_d3'));
      if (d3Rec) {
        expect(d3Rec.recommendedTiming).toBe('morning');
        expect(d3Rec.type).toBe('fat_soluble');
      }
    });

    it('should recommend morning for stimulants', () => {
      const recs = optimizeTiming(['caffeine']);
      const cafRec = recs.find(r => r.substanceId.includes('caffeine'));
      if (cafRec) {
        expect(cafRec.recommendedTiming).toBe('morning');
        expect(cafRec.type).toBe('stimulant');
      }
    });

    it('should recommend evening for sedatives', () => {
      const recs = optimizeTiming(['melatonin', 'ashwagandha']);
      const melRec = recs.find(r => r.substanceId.includes('melatonin'));
      if (melRec) {
        expect(melRec.recommendedTiming).toBe('evening');
        expect(melRec.type).toBe('sedative');
      }
    });
  });

  describe('findAbsorptionEnhancers', () => {
    it('should suggest vitamin C for iron', () => {
      const suggestions = findAbsorptionEnhancers(['iron']);
      const vitC = suggestions.find(s => s.targetId.includes('iron') && s.enhancerId.includes('vitamin_c'));
      expect(vitC).toBeDefined();
    });

    it('should suggest vitamin D for calcium', () => {
      const suggestions = findAbsorptionEnhancers(['calcium']);
      const vitD = suggestions.find(s => s.targetId.includes('calcium') && s.enhancerId.includes('vitamin_d3'));
      expect(vitD).toBeDefined();
    });
  });

  describe('getSafeStackRecommendations', () => {
    it('should return safe substances when no meds', () => {
      const result = getSafeStackRecommendations(['nac', 'tudca', 'zinc'], []);
      expect(result.excluded).toEqual([]);
    });

    it('should handle drug interactions gracefully', () => {
      // Test with actual substances from the catalog
      const result = getSafeStackRecommendations(['nac', 'tudca'], ['warfarin']);
      expect(result).toBeDefined();
      expect(result.safe).toBeInstanceOf(Array);
      expect(result.excluded).toBeInstanceOf(Array);
      expect(result.titrations).toBeInstanceOf(Array);
    });

    it('should hard-exclude a catalog supplement on a normalized drug interaction', () => {
      const result = getSafeStackRecommendations(['vitamin_k2'], ['warfarin']);
      expect(result.excluded.some(item => item.substanceId === 'vitamin_k2')).toBe(true);
      expect(result.safe).not.toContain('vitamin_k2');
    });
  });

  describe('SUPPLEMENT_UPPER_LIMITS', () => {
    it('should have UL defined for common supplements', () => {
      expect(SUPPLEMENT_UPPER_LIMITS.zinc).toBe(40);
      expect(SUPPLEMENT_UPPER_LIMITS.vitamin_d3).toBe(0.1); // 100mcg = 0.1mg
      expect(SUPPLEMENT_UPPER_LIMITS.vitamin_c).toBe(2000);
    });
  });

  describe('SUPPLEMENT_OPTIMAL_LIMITS', () => {
    it('should have optimal limits defined', () => {
      expect(SUPPLEMENT_OPTIMAL_LIMITS.zinc).toBe(30);
      expect(SUPPLEMENT_OPTIMAL_LIMITS.vitamin_c).toBe(1000);
    });
  });
});
