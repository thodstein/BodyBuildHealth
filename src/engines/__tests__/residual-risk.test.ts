import { describe, it, expect } from 'vitest';
import { assessPedRisk, computeResidualRisk, type PedRiskAssessment } from '../ped-risk-matrix';
import {
  getNeuroBoosterSubstanceIds,
  getJointsBoosterSubstanceIds,
  getHematoBoosterSubstanceIds,
} from '../tz-bridge-boosters';
import type { PEDDose } from '../../data/ped-potency-table';

function ped(id: string, mgPerWeek: number, form: 'oral' | 'inject' = 'inject'): PEDDose {
  return { id, pClass: undefined as any, mgPerWeek, form };
}

// ════════════════════════════════════════════════════════════════════════════
//  computeResidualRisk: базовая логика покрытия
// ════════════════════════════════════════════════════════════════════════════
describe('computeResidualRisk: базовая логика', () => {
  it('gross tier 0 → net tier 0 (нет риска)', () => {
    const gross = assessPedRisk([], 'medium');
    const net = computeResidualRisk(gross, []);
    expect(net.neuroBoosterTier).toBe(0);
    expect(net.jointsBoosterTier).toBe(0);
    expect(net.hematoBoosterTier).toBe(0);
  });

  it('gross tier > 0, пустой план → net = gross (нет покрытия)', () => {
    const gross = assessPedRisk([ped('trenbolone_enanthate', 700)], 'medium');  // neuro high, hemato high
    const net = computeResidualRisk(gross, []);
    expect(net.neuroBoosterTier).toBe(gross.neuroBoosterTier);
    expect(net.hematoBoosterTier).toBe(gross.hematoBoosterTier);
  });

  it('полный план защиты → net tier 0 (полное покрытие)', () => {
    const gross = assessPedRisk([ped('boldenone_undecylenate', 400)], 'medium');  // hemato high (tier 3)
    const recommended = getHematoBoosterSubstanceIds(gross.hematoBoosterTier);
    // Все рекомендованные вещества в плане → 100% coverage → tier 0
    const net = computeResidualRisk(gross, recommended);
    expect(net.hematoBoosterTier).toBe(0);
    expect(net.hematoCoverage).toBe(100);
  });

  it('частичный план → net tier снижается', () => {
    const gross = assessPedRisk([ped('boldenone_undecylenate', 400)], 'medium');  // hemato tier 3 → 17 веществ
    // 6 веществ из 17 → ~35% → -1 tier (3→2)
    const net = computeResidualRisk(gross, ['hydration','cardio_aerobic','electrolyte_balance','nattokinase','serrapeptase','bromelain']);
    expect(net.hematoBoosterTier).toBe(2);
    expect(net.hematoCoverage).toBeGreaterThanOrEqual(30);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Покрытие по границам (30/60/80%) для каждого домена
// ════════════════════════════════════════════════════════════════════════════
describe('computeResidualRisk: границы покрытия 30/60/80%', () => {
  describe('HEMATO домен', () => {
    it('30% покрытие → -1 tier (3→2)', () => {
      const gross = assessPedRisk([ped('boldenone_undecylenate', 400)], 'medium');
      // tier 3 → 17 веществ. 30% ≈ 6 вещества.
      const recommended = getHematoBoosterSubstanceIds(3);
      const plan = recommended.slice(0, 6);  // ~35%
      const net = computeResidualRisk(gross, plan);
      expect(net.hematoBoosterTier).toBe(2);
    });

    it('60% покрытие → -2 tier (3→1)', () => {
      const gross = assessPedRisk([ped('boldenone_undecylenate', 400)], 'medium');
      const recommended = getHematoBoosterSubstanceIds(3);
      const plan = recommended.slice(0, 11);  // ~65%
      const net = computeResidualRisk(gross, plan);
      expect(net.hematoBoosterTier).toBe(1);
    });

    it('80% покрытие → tier 0 (полное)', () => {
      const gross = assessPedRisk([ped('boldenone_undecylenate', 400)], 'medium');
      const recommended = getHematoBoosterSubstanceIds(3);
      const plan = recommended.slice(0, 14);  // ~82%
      const net = computeResidualRisk(gross, plan);
      expect(net.hematoBoosterTier).toBe(0);
    });
  });

  describe('NEURO домен', () => {
    it('тренболон → neuro tier 3, 0% покрытия → gross=net', () => {
      const gross = assessPedRisk([ped('trenbolone_enanthate', 700)], 'medium');
      const net = computeResidualRisk(gross, []);
      expect(net.neuroBoosterTier).toBe(3);
      expect(net.neuroCoverage).toBe(0);
    });

    it('80% покрытие → tier 0', () => {
      const gross = assessPedRisk([ped('trenbolone_enanthate', 700)], 'medium');
      const recommended = getNeuroBoosterSubstanceIds(3);
      const plan = recommended.slice(0, Math.ceil(recommended.length * 0.8));
      const net = computeResidualRisk(gross, plan);
      expect(net.neuroBoosterTier).toBe(0);
    });
  });

  describe('JOINTS домен', () => {
    it('станозолол → joints high, 30% покрытие → -1', () => {
      const gross = assessPedRisk([ped('stanozolol', 300, 'oral')], 'medium');
      const recommended = getJointsBoosterSubstanceIds(gross.jointsBoosterTier);
      const plan = recommended.slice(0, Math.ceil(recommended.length * 0.3));
      const net = computeResidualRisk(gross, plan);
      expect(net.jointsBoosterTier).toBeLessThan(gross.jointsBoosterTier);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Gross/net поля сохраняются
// ════════════════════════════════════════════════════════════════════════════
describe('computeResidualRisk: сохранение gross полей', () => {
  it('grossNeuroTier сохраняется после computeResidualRisk', () => {
    const gross = assessPedRisk([ped('trenbolone_enanthate', 700)], 'medium');
    const net = computeResidualRisk(gross, []);
    expect(net.grossNeuroTier).toBe(gross.neuroBoosterTier);
    expect(net.grossJointsTier).toBe(gross.jointsBoosterTier);
    expect(net.grossHematoTier).toBe(gross.hematoBoosterTier);
  });

  it('covered/recommended поля заполняются', () => {
    const gross = assessPedRisk([ped('boldenone_undecylenate', 400)], 'medium');
    const net = computeResidualRisk(gross, ['nattokinase']);
    expect(net.hematoCovered).toBe(1);
    expect(net.hematoRecommended).toBeGreaterThan(0);
    expect(net.hematoCoverage).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Мульти-домен: все три домена сразу
// ════════════════════════════════════════════════════════════════════════════
describe('computeResidualRisk: мульти-домен', () => {
  it('трен + стан → neuro+joints+hemato все >0', () => {
    const gross = assessPedRisk([
      ped('trenbolone_enanthate', 500),
      ped('stanozolol', 250, 'oral'),
    ], 'medium');
    expect(gross.neuroBoosterTier).toBeGreaterThan(0);
    expect(gross.jointsBoosterTier).toBeGreaterThan(0);
    expect(gross.hematoBoosterTier).toBeGreaterThan(0);
  });

  it('трен + стан, полный план защиты → все tier 0', () => {
    const gross = assessPedRisk([
      ped('trenbolone_enanthate', 500),
      ped('stanozolol', 250, 'oral'),
    ], 'medium');
    const neuroIds = getNeuroBoosterSubstanceIds(gross.neuroBoosterTier);
    const jointIds = getJointsBoosterSubstanceIds(gross.jointsBoosterTier);
    const hematoIds = getHematoBoosterSubstanceIds(gross.hematoBoosterTier);
    const fullPlan = [...neuroIds, ...jointIds, ...hematoIds];
    const net = computeResidualRisk(gross, fullPlan);
    expect(net.neuroBoosterTier).toBe(0);
    expect(net.jointsBoosterTier).toBe(0);
    expect(net.hematoBoosterTier).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Case-insensitive matching
// ════════════════════════════════════════════════════════════════════════════
describe('computeResidualRisk: case-insensitive', () => {
  it('вещества с разным регистром считаются покрытыми', () => {
    const gross = assessPedRisk([ped('boldenone_undecylenate', 400)], 'medium');
    const net = computeResidualRisk(gross, ['NATTOKINASE', 'Serrapeptase']);
    expect(net.hematoCovered).toBe(2);
  });
});