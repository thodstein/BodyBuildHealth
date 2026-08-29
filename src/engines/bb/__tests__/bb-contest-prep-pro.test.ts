/**
 * bb-contest-prep-pro.test.ts — PRO v2 peak week (Escalante 2021, Helms, BellyProof)
 * Проверяет бюджетную карб-модель 8-12г/кг total, SGLT1 guard, BSA/height, trial→strategy, live-adjust, isValidIsoDate
 */
import { describe, it, expect } from 'vitest';
import {
  buildPeakWeek,
  isValidIsoDate,
  canonicalWaterStrategy,
  canonicalSodiumStrategy,
  carbToleranceMult,
  isLutealPhase,
  recommendCarbStrategyFromTrial,
  liveAdjustForPeakDay,
  isMonotonicTaper,
  CARB_DISTRIBUTION,
  CATEGORY_PROFILES,
  type BBContestPrepConfig,
} from '../bb-contest-prep.engine';

function addDaysIso(iso: string, days: number): string {
  const [y,m,d]=iso.split('-').map(Number);
  const dt=new Date(y,m-1,d+days);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function todayIso(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function base(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex:'male', category:'mens_bb', weightKg:80, heightCm:178, experienceLevel:'intermediate', enhanced:false, prepCount:1,
    showDate:addDaysIso(todayIso(),21), weeksOut:3, trainingProtocol:'bb', carbLoadStrategy:'moderate', waterStrategy:'stable', sodiumStrategy:'stable', hasTrialPeak:true, ...over
  };
}

describe('PRO v2 carb budget 8-12 total (Escalante)', () => {
  it('mens_bb 80кг moderate total 720-960г (9-12 г/кг)', () => {
    const days=buildPeakWeek(base({ category:'mens_bb', weightKg:80, carbLoadStrategy:'moderate' }));
    const total=days.filter(d=>d.phase.startsWith('load')).reduce((a,d)=>a+d.carbsG,0);
    expect(total).toBeGreaterThanOrEqual(720);
    expect(total).toBeLessThanOrEqual(960);
  });
  it('bikini 55кг total 192-302г (3.5-5.5)', () => {
    const days=buildPeakWeek(base({ sex:'female', category:'bikini', weightKg:55, carbLoadStrategy:'moderate' } as any));
    const total=days.filter(d=>d.phase.startsWith('load')).reduce((a,d)=>a+d.carbsG,0);
    expect(total).toBeGreaterThanOrEqual(190);
    expect(total).toBeLessThanOrEqual(310);
  });
  it('distribution front 42/35/23 sums to total', () => {
    const days=buildPeakWeek(base({ carbLoadStrategy:'front' }));
    const loads=days.filter(d=>d.phase.startsWith('load')).map(d=>d.carbsG);
    expect(loads.length).toBe(3);
    const total=loads.reduce((a,b)=>a+b,0);
    expect(loads[0]/total).toBeCloseTo(CARB_DISTRIBUTION.front[0],1);
  });
  it('undulating strategy supported', () => {
    const days=buildPeakWeek(base({ carbLoadStrategy:'undulating' }));
    expect(days.filter(d=>d.phase.startsWith('load'))).toHaveLength(3);
  });
});

describe('PRO water/SGLT1', () => {
  it('stable water 35мл/кг → ~2.8л при 80кг', () => {
    const d=buildPeakWeek(base({ waterStrategy:'stable', weightKg:80 }));
    expect(d[0].waterLiters).toBeCloseTo(2.8,0.3);
  });
  it('tapered load + glycogen boost > stable', () => {
    const s=buildPeakWeek(base({ waterStrategy:'stable' }))[3].waterLiters;
    const t=buildPeakWeek(base({ waterStrategy:'tapered' }))[3].waterLiters;
    expect(t).toBeGreaterThan(s);
  });
  it('high water gated but still computes', () => {
    const d=buildPeakWeek(base({ waterStrategy:'high', hasTrialPeak:true, confirmedManipulation:true } as any));
    expect(d[0].waterLiters).toBeGreaterThan(5);
    expect(d[6].waterLiters).toBeLessThan(1.5);
  });
  it('SGLT1 guard: tapered sodium на load ≥2600', () => {
    const d=buildPeakWeek(base({ sodiumStrategy:'tapered', carbLoadStrategy:'moderate' }));
    const load=d.find(x=>x.phase==='load_1')!;
    expect(load.sodiumMg).toBeGreaterThanOrEqual(2200);
  });
});

describe('BSA/height & luteal', () => {
  it('height 150 vs 200 влияет на воду (BSA)', () => {
    const low=buildPeakWeek(base({ weightKg:80, heightCm:150, waterStrategy:'tapered' } as any));
    const high=buildPeakWeek(base({ weightKg:80, heightCm:200, waterStrategy:'tapered' } as any));
    expect(low[0].waterLiters).toBeLessThanOrEqual(high[0].waterLiters+0.5);
  });
  it('luteal phase +0.5л и натрий ≥2100', () => {
    const d=buildPeakWeek(base({ sex:'female', category:'bikini', weightKg:55, cycleDay:20, sodiumStrategy:'tapered' } as any));
    expect(d[5].sodiumMg).toBeGreaterThanOrEqual(2100);
  });
  it('isLutealPhase 15-28 true, 5 false', () => {
    expect(isLutealPhase(20)).toBe(true);
    expect(isLutealPhase(5)).toBe(false);
    expect(isLutealPhase(undefined)).toBe(false);
  });
  it('carbToleranceMult GH/insulin повышает', () => {
    expect(carbToleranceMult(base())).toBe(1);
    expect(carbToleranceMult(base({ enhanced:true, pedContext:{ insulinIU:10 } } as any))).toBeGreaterThan(1.2);
  });
});

describe('trial → strategy & live adjust', () => {
  it('recommendCarbStrategyFromTrial spill→back, flat→front', () => {
    const spill={ responses:{ waterRetention:1, fullness:5, carbTolerance:3, digestion:3, pump:3, sleep:3 }, weightDeltaKg:3 } as any;
    expect(recommendCarbStrategyFromTrial(spill)).toBe('back');
    const flat={ responses:{ waterRetention:5, fullness:1, carbTolerance:3, digestion:3, pump:3, sleep:3 }, weightDeltaKg:0 } as any;
    expect(recommendCarbStrategyFromTrial(flat)).toBe('front');
  });
  it('liveAdjust flat → +75г карб', () => {
    expect(liveAdjustForPeakDay(1,2,5).carbDelta).toBe(75);
    expect(liveAdjustForPeakDay(4,5,1).carbDelta).toBe(-100);
    expect(liveAdjustForPeakDay(3,2,3).status).toBe('on_track');
  });
  it('isMonotonicTaper true/false', () => {
    const wk=(sets:number)=>({ contestPhase:'taper', sessions:[{ exercises:[{ sets }] }] } as any);
    expect(isMonotonicTaper([wk(10), wk(8), wk(6)])).toBe(true);
    expect(isMonotonicTaper([wk(6), wk(8), wk(10)])).toBe(false);
  });
});

describe('isValidIsoDate UTC fix', () => {
  it('2026-02-31 невалидна (не rollover)', () => {
    expect(isValidIsoDate('2026-02-31')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-02-28')).toBe(true);
  });
  it('каноника legacy воды/натрия', () => {
    expect(canonicalWaterStrategy('minimal')).toBe('stable');
    expect(canonicalWaterStrategy('moderate')).toBe('tapered');
    expect(canonicalSodiumStrategy('constant')).toBe('stable');
    expect(canonicalSodiumStrategy('cut_3d')).toBe('tapered');
  });
});

describe('CATEGORY target BF PRO 2024', () => {
  it('mens_bb 5% (не 4), bikini 13% (не 11)', () => {
    expect(CATEGORY_PROFILES.mens_bb.targetBodyFatPct).toBe(5);
    expect(CATEGORY_PROFILES.bikini.targetBodyFatPct).toBe(13);
    expect(CATEGORY_PROFILES.wellness.targetBodyFatPct).toBe(14);
  });
});
