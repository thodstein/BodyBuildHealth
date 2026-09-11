import { describe, expect, it } from 'vitest';
import { validatePlanQuality } from '../plan-quality.engine';

const BASE = {
  dayGroups: [['chest'], ['back']],
  weeklySets: { chest: 12, back: 14 },
  frequency: { chest: 2, back: 2 },
  level: 'intermediate',
};

describe('plan-quality S1: без V2-входов — байт-в-байт', () => {
  it('скоринг стабилен (регресс-лок)', () => {
    const r = validatePlanQuality({ ...BASE });
    expect(r.issues.some(i => i.id.startsWith('session_cap_'))).toBe(false);
    expect(r.issues.some(i => i.id.startsWith('freq_split_'))).toBe(false);
    expect(r.issues.some(i => i.id.startsWith('rir_'))).toBe(false);
    expect(r.issues.some(i => i.id.startsWith('shoulder_'))).toBe(false);
    expect(r.issues.some(i => i.id.startsWith('length_low_'))).toBe(false);
  });
});

describe('plan-quality S1+V2: MV-конверсия спец-блока', () => {
  it('не-цель на MEV-половине — info, штраф возвращён', () => {
    const plain = validatePlanQuality({
      ...BASE, weeklySets: { chest: 14, back: 5 }, frequency: { chest: 2, back: 1 },
    });
    const spec = validatePlanQuality({
      ...BASE, weeklySets: { chest: 14, back: 5 }, frequency: { chest: 2, back: 1 },
      specTargets: ['chest'],
    });
    expect(plain.issues.some(i => i.id === 'vol_low_back' && i.severity === 'warning')).toBe(true);
    const conv = spec.issues.find(i => i.id === 'vol_low_back')!;
    expect(conv.severity).toBe('info');
    expect(spec.score).toBeGreaterThan(plain.score);
  });
});

describe('plan-quality S1+V2: session-кап', () => {
  it('ловит >10 сетов в сессии', () => {
    const r = validatePlanQuality({ ...BASE, sessionMaxByMuscle: { chest: 14, back: 6 } });
    expect(r.issues.some(i => i.id === 'session_cap_chest' && i.severity === 'warning')).toBe(true);
    expect(r.issues.some(i => i.id === 'session_cap_back')).toBe(false);
    expect(r.recommendations.some(x => x.includes('Разбить объём chest'))).toBe(true);
  });
});

describe('plan-quality S1+V2: частота-от-объёма', () => {
  it('верх MAV в 1 сессию — warning разбить', () => {
    const r = validatePlanQuality({
      ...BASE, weeklySets: { chest: 20, back: 14 }, frequency: { chest: 1, back: 2 },
    });
    expect(r.issues.some(i => i.id === 'freq_split_chest' && i.severity === 'warning')).toBe(true);
  });
});

describe('plan-quality S1+V2: RIR', () => {
  it('новичок с отказом — critical', () => {
    const r = validatePlanQuality({
      ...BASE, level: 'beginner',
      rirStats: { avgRir: 1, fracRirLE2: 0.8, fracRir0: 0.2, totalSets: 20 },
    });
    expect(r.issues.some(i => i.id === 'rir_beginner_failure' && i.severity === 'critical')).toBe(true);
  });
  it('все RIR 4+ — мусорный объём', () => {
    const r = validatePlanQuality({
      ...BASE, rirStats: { avgRir: 4, fracRirLE2: 0.05, fracRir0: 0, totalSets: 20 },
    });
    expect(r.issues.some(i => i.id === 'rir_junk_volume')).toBe(true);
  });
});

describe('plan-quality S1+V2: делод-призрак и плечо/длина/нагрузка', () => {
  it('де lod-призрак ловится', () => {
    const r = validatePlanQuality({
      ...BASE, hasDeload: true, deloadWeeks: [4], totalWeeks: 8,
      deloadDepth: { depthVolume: 0.05, rirShift: 0, phaseTag: 'deload' },
    });
    expect(r.issues.some(i => i.id === 'deload_ghost')).toBe(true);
  });
  it('жим-доминация верха — warning (ноги не учтены)', () => {
    const r = validatePlanQuality({
      ...BASE,
      shoulder: { pressSets: 24, pullSets: 10, hasVerticalPull: true, hasHorizontalPull: true, hasFacePullOrER: true },
    });
    expect(r.issues.some(i => i.id === 'shoulder_press_dominant')).toBe(true);
  });
  it('длина 0% у груди — warning, у пресса — тишина', () => {
    const r = validatePlanQuality({
      ...BASE,
      lengthShare: { chest: { lengthSets: 0, totalSets: 12 }, abs: { lengthSets: 0, totalSets: 12 } },
    });
    expect(r.issues.some(i => i.id === 'length_low_chest')).toBe(true);
    expect(r.issues.some(i => i.muscle === 'abs' && i.id.startsWith('length_low_'))).toBe(false);
  });
  it('без дневника — 0 штрафа нагрузки', () => {
    const a = validatePlanQuality({ ...BASE });
    const b = validatePlanQuality({ ...BASE, loadData: { hasDiary: false } });
    expect(b.score).toBe(a.score);
  });
  it('ACWR danger — warning', () => {
    const r = validatePlanQuality({ ...BASE, loadData: { hasDiary: true, acwr: 1.8, monotony: 1.2 } });
    expect(r.issues.some(i => i.id === 'load_acwr_danger')).toBe(true);
  });
});
