import { describe, it, expect } from 'vitest';
import {
  applyBoosters,
  shouldActivateNeuro,
  shouldActivateJoints,
  NEURO_BOOST,
  JOINTS_BOOST,
  type BoosterTriggerCtx,
  type AppliedBooster,
} from '../tz-bridge-boosters';

function ctx(overrides: Partial<BoosterTriggerCtx> = {}): BoosterTriggerCtx {
  return {
    anxietyScore: 0,
    sleepHours: 7,
    stressScore: 3,
    cortisolHigh: false,
    irritability: false,
    jointPainScore: 0,
    acuteInjuryWeeks: undefined,
    crpLevel: undefined,
    triggeredStackIds: [],
    ...overrides,
  };
}

describe('shouldActivateNeuro: tier-based triggers', () => {
  it('pedNeuroTier=1 → true', () => {
    expect(shouldActivateNeuro(ctx({ pedNeuroTier: 1 }))).toBe(true);
  });
  it('pedNeuroTier=3 → true', () => {
    expect(shouldActivateNeuro(ctx({ pedNeuroTier: 3 }))).toBe(true);
  });
  it('forceNeuro=true → true', () => {
    expect(shouldActivateNeuro(ctx({ forceNeuro: true }))).toBe(true);
  });
  it('symptomNeuro=true → true', () => {
    expect(shouldActivateNeuro(ctx({ symptomNeuro: true }))).toBe(true);
  });
  it('без триггеров → false', () => {
    expect(shouldActivateNeuro(ctx())).toBe(false);
  });
  it('state-estimate: anxietyScore>6 → true', () => {
    expect(shouldActivateNeuro(ctx({ anxietyScore: 7 }))).toBe(true);
  });
});

describe('shouldActivateJoints: tier-based triggers', () => {
  it('pedJointsTier=2 → true', () => {
    expect(shouldActivateJoints(ctx({ pedJointsTier: 2 }))).toBe(true);
  });
  it('forceJoints=true → true', () => {
    expect(shouldActivateJoints(ctx({ forceJoints: true }))).toBe(true);
  });
  it('symptomJoints=true → true', () => {
    expect(shouldActivateJoints(ctx({ symptomJoints: true }))).toBe(true);
  });
  it('без триггеров → false', () => {
    expect(shouldActivateJoints(ctx())).toBe(false);
  });
  it('state-estimate: jointPainScore>4 → true', () => {
    expect(shouldActivateJoints(ctx({ jointPainScore: 5 }))).toBe(true);
  });
});

describe('applyBoosters: tier selection NEURO', () => {
  it('pedNeuroTier=1 → только LV1 вещества', () => {
    const result = applyBoosters([], ctx({ pedNeuroTier: 1 }));
    const neuro = result.find(b => b.key === 'neuro');
    expect(neuro).toBeDefined();
    expect(neuro!.tier).toBe(1);
    // LV1 содержит agmatine, nac, taurine
    const ids = neuro!.subs.map(s => s.substanceId);
    expect(ids).toContain('agmatine');
    expect(ids).toContain('nac');
    expect(ids).toContain('taurine');
    // LV2 НЕ содержит pregnenolone
    expect(ids).not.toContain('pregnenolone');
    // LV3 НЕ содержит memantine
    expect(ids).not.toContain('memantine');
  });

  it('symptomNeuro → tier 2 (LV1+LV2)', () => {
    const result = applyBoosters([], ctx({ symptomNeuro: true }));
    const neuro = result.find(b => b.key === 'neuro');
    expect(neuro).toBeDefined();
    expect(neuro!.tier).toBe(2);
    const ids = neuro!.subs.map(s => s.substanceId);
    expect(ids).toContain('agmatine'); // LV1
    expect(ids).toContain('pregnenolone'); // LV2
    expect(ids).not.toContain('memantine'); // no LV3
  });

  it('pedNeuroTier=3 → LV1+LV2+LV3 (вкл. memantine)', () => {
    const result = applyBoosters([], ctx({ pedNeuroTier: 3 }));
    const neuro = result.find(b => b.key === 'neuro');
    expect(neuro).toBeDefined();
    expect(neuro!.tier).toBe(3);
    const ids = neuro!.subs.map(s => s.substanceId);
    expect(ids).toContain('agmatine'); // LV1
    expect(ids).toContain('pregnenolone'); // LV2
    expect(ids).toContain('fasoracetam'); // LV3
    expect(ids).toContain('bromantane'); // LV3
    expect(ids).toContain('memantine'); // LV3 alternate (первый из пары)
    // lamotrigine НЕ должен быть — селективная пара (memantine ИЛИ lamotrigine)
    expect(ids).not.toContain('lamotrigine');
  });

  it('forceNeuro (max) → tier 1 (только LV1)', () => {
    const result = applyBoosters([], ctx({ forceNeuro: true }));
    const neuro = result.find(b => b.key === 'neuro');
    expect(neuro).toBeDefined();
    expect(neuro!.tier).toBe(1);
    const ids = neuro!.subs.map(s => s.substanceId);
    expect(ids).not.toContain('memantine');
  });

  it('pedNeuroTier=3 приоритет над forceNeuro → tier 3', () => {
    const result = applyBoosters([], ctx({ pedNeuroTier: 3, forceNeuro: true }));
    const neuro = result.find(b => b.key === 'neuro');
    expect(neuro!.tier).toBe(3);
  });

  it('reasons передаются в AppliedBooster', () => {
    const result = applyBoosters([], ctx({
      pedNeuroTier: 3,
      pedRiskReasons: ['Тренболон — максимальная нейротоксичность'],
    }));
    const neuro = result.find(b => b.key === 'neuro');
    expect(neuro!.reasons).toContain('Тренболон — максимальная нейротоксичность');
  });
});

describe('applyBoosters: tier selection JOINTS', () => {
  it('pedJointsTier=3 → BPC-157+TB-500+GHK-Cu (протокол статьи)', () => {
    const result = applyBoosters([], ctx({ pedJointsTier: 3 }));
    const joints = result.find(b => b.key === 'joints');
    expect(joints).toBeDefined();
    expect(joints!.tier).toBe(3);
    const ids = joints!.subs.map(s => s.substanceId);
    expect(ids).toContain('collagen'); // LV1
    expect(ids).toContain('glucosamine'); // LV1
    expect(ids).toContain('collagen_uc2'); // LV2
    expect(ids).toContain('bpc157'); // LV3
    expect(ids).toContain('tb500'); // LV3
    expect(ids).toContain('ghk_cu'); // LV3
  });

  it('symptomJoints → tier 2 (LV1+LV2, без пептидов)', () => {
    const result = applyBoosters([], ctx({ symptomJoints: true }));
    const joints = result.find(b => b.key === 'joints');
    expect(joints).toBeDefined();
    expect(joints!.tier).toBe(2);
    const ids = joints!.subs.map(s => s.substanceId);
    expect(ids).toContain('collagen');
    expect(ids).toContain('silicon'); // LV2
    expect(ids).not.toContain('bpc157'); // no LV3
  });

  it('forceJoints (max) → tier 1 (только LV1)', () => {
    const result = applyBoosters([], ctx({ forceJoints: true }));
    const joints = result.find(b => b.key === 'joints');
    expect(joints).toBeDefined();
    expect(joints!.tier).toBe(1);
    const ids = joints!.subs.map(s => s.substanceId);
    expect(ids).not.toContain('bpc157');
  });
});

describe('applyBoosters: дедупликация', () => {
  it('вещества уже в плане — не дублируются', () => {
    const result = applyBoosters(['magnesium', 'agmatine'], ctx({ pedNeuroTier: 3 }));
    const neuro = result.find(b => b.key === 'neuro');
    const ids = neuro!.subs.map(s => s.substanceId);
    expect(ids).not.toContain('magnesium');
    expect(ids).not.toContain('agmatine');
    // но другие LV1 вещества остаются
    expect(ids).toContain('nac');
  });
});

describe('applyBoosters: max(pedTier, symptomTier, forceTier)', () => {
  it('pedNeuroTier=1 + symptomNeuro → tier 2 (max)', () => {
    const result = applyBoosters([], ctx({ pedNeuroTier: 1, symptomNeuro: true }));
    const neuro = result.find(b => b.key === 'neuro');
    expect(neuro!.tier).toBe(2);
  });
  it('forceNeuro + symptomNeuro → tier 2 (max)', () => {
    const result = applyBoosters([], ctx({ forceNeuro: true, symptomNeuro: true }));
    const neuro = result.find(b => b.key === 'neuro');
    expect(neuro!.tier).toBe(2);
  });
});

describe('applyBoosters: оба бустера одновременно', () => {
  it('pedNeuroTier=3 + pedJointsTier=3 → оба бустера активированы', () => {
    const result = applyBoosters([], ctx({ pedNeuroTier: 3, pedJointsTier: 3 }));
    const neuro = result.find(b => b.key === 'neuro');
    const joints = result.find(b => b.key === 'joints');
    expect(neuro).toBeDefined();
    expect(joints).toBeDefined();
    expect(neuro!.tier).toBe(3);
    expect(joints!.tier).toBe(3);
  });
});

describe('NEURO_BOOST/JOINTS_BOOST: структура', () => {
  it('NEURO_BOOST имеет LV1 (subs), LV2 (subsLv2), LV3 (subsLv3 + alternates)', () => {
    expect(NEURO_BOOST.subs.length).toBeGreaterThanOrEqual(10);
    expect(NEURO_BOOST.subsLv2).toBeDefined();
    expect(NEURO_BOOST.subsLv2!.length).toBeGreaterThan(0);
    expect(NEURO_BOOST.subsLv3).toBeDefined();
    expect(NEURO_BOOST.subsLv3Alternates).toBeDefined();
    expect(NEURO_BOOST.subsLv3Alternates!.length).toBe(3); // NMDA, противотревожная, α2
  });
  it('NEURO_BOOST LV3 alternates: NMDA-группа (memantine, lamotrigine, amantadine)', () => {
    const nmdaGroup = NEURO_BOOST.subsLv3Alternates!.find(g => g.group.includes('NMDA'));
    expect(nmdaGroup).toBeDefined();
    const nmdaIds = nmdaGroup!.options.map(o => o.substanceId);
    expect(nmdaIds).toContain('memantine');
    expect(nmdaIds).toContain('lamotrigine');
    expect(nmdaIds).toContain('amantadine');
  });
  it('NEURO_BOOST LV3 alternates: противотревожная (fluvoxamine, naltrexone)', () => {
    const anxGroup = NEURO_BOOST.subsLv3Alternates!.find(g => g.group.includes('Противотревожный'));
    expect(anxGroup).toBeDefined();
    const anxIds = anxGroup!.options.map(o => o.substanceId);
    expect(anxIds).toContain('fluvoxamine');
    expect(anxIds).toContain('naltrexone');
  });
  it('NEURO_BOOST LV3 alternates: α2-адренорецептор (guanfacine, tizanidine)', () => {
    const a2Group = NEURO_BOOST.subsLv3Alternates!.find(g => g.group.includes('α2'));
    expect(a2Group).toBeDefined();
    const a2Ids = a2Group!.options.map(o => o.substanceId);
    expect(a2Ids).toContain('guanfacine');
    expect(a2Ids).toContain('tizanidine');
  });
  it('NEURO_BOOST LV3 содержит dihexa, tropoflavin, phenylpiracetam', () => {
    const lv3Ids = NEURO_BOOST.subsLv3!.map(s => s.substanceId);
    expect(lv3Ids).toContain('dihexa');
    expect(lv3Ids).toContain('tropoflavin');
    expect(lv3Ids).toContain('phenylpiracetam');
  });
  it('NEURO_BOOST LV2 содержит grandaxine', () => {
    const lv2Ids = NEURO_BOOST.subsLv2!.map(s => s.substanceId);
    expect(lv2Ids).toContain('grandaxine');
  });
  it('JOINTS_BOOST имеет LV3 (bpc157, tb500, ghk_cu)', () => {
    expect(JOINTS_BOOST.subsLv3).toBeDefined();
    const lv3Ids = JOINTS_BOOST.subsLv3!.map(s => s.substanceId);
    expect(lv3Ids).toContain('bpc157');
    expect(lv3Ids).toContain('tb500');
    expect(lv3Ids).toContain('ghk_cu');
  });
  it('JOINTS_BOOST LV2 содержит havinson_a4, ligamentide, voltaren_gel', () => {
    const lv2Ids = JOINTS_BOOST.subsLv2!.map(s => s.substanceId);
    expect(lv2Ids).toContain('havinson_a4');
    expect(lv2Ids).toContain('ligamentide');
    expect(lv2Ids).toContain('voltaren_gel');
  });
  it('bpc157 в JOINTS_BOOST только в LV3 (не в LV1)', () => {
    const lv1Ids = JOINTS_BOOST.subs.map(s => s.substanceId);
    expect(lv1Ids).not.toContain('bpc157');
  });
});

describe('applyBoosters: LV3 с новыми alternates', () => {
  it('pedNeuroTier=3 → первый из каждой alternate группы', () => {
    const result = applyBoosters([], ctx({ pedNeuroTier: 3 }));
    const neuro = result.find(b => b.key === 'neuro');
    const ids = neuro!.subs.map(s => s.substanceId);
    // NMDA-группа: memantine (первый)
    expect(ids).toContain('memantine');
    expect(ids).not.toContain('lamotrigine');
    expect(ids).not.toContain('amantadine');
    // Противотревожная: fluvoxamine (первый)
    expect(ids).toContain('fluvoxamine');
    expect(ids).not.toContain('naltrexone');
    // α2: guanfacine (первый)
    expect(ids).toContain('guanfacine');
    expect(ids).not.toContain('tizanidine');
    // LV3 основные: dihexa, tropoflavin, phenylpiracetam
    expect(ids).toContain('dihexa');
    expect(ids).toContain('tropoflavin');
    expect(ids).toContain('phenylpiracetam');
  });
  it('pedNeuroTier=3 + все 3 alternates активированы = +3 вещества', () => {
    const result = applyBoosters([], ctx({ pedNeuroTier: 3 }));
    const neuro = result.find(b => b.key === 'neuro');
    const ids = neuro!.subs.map(s => s.substanceId);
    // 3 alternates
    const altIds = ['memantine', 'fluvoxamine', 'guanfacine'];
    for (const id of altIds) {
      expect(ids).toContain(id);
    }
  });
});
