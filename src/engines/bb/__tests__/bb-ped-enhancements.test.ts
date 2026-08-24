/**
 * bb-ped-enhancements.test.ts — проверка новых PED-методик / реп-схем / гард
 */
import { describe, it, expect } from 'vitest';
import { REP_SCHEMES, schemeFor } from '../bb-rep-schemes.engine';
import { recommendPEDMethodology } from '../bb-ped-methodology.engine';
import { jointGuardActive, jointGuardScorePenalty } from '../bb-joint-guard.engine';
import { insulinWindowActive } from '../bb-insulin-window.engine';
import { PRO_PRESETS } from '../bb-pro-presets.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { rankBBSplits } from '../bb-selector.engine';

describe('bb-rep-schemes', () => {
  it('12 схем в таблице', () => { expect(Object.keys(REP_SCHEMES).length).toBe(12); });
  it('GH+insulin памп → pump_15_20', () => {
    expect(schemeFor({ character: 'памп', pedProfile: { ghPlusInsulin: true } })).toBe('pump_15_20');
  });
  it('AAS heavy тяж intensification → dc_rp', () => {
    expect(schemeFor({ character: 'тяж', phase: 'intensification', level: 'advanced', pedProfile: { hasAAS: true } })).toBe('dc_rp');
  });
  it('MGF памп → myo_reps', () => {
    expect(schemeFor({ character: 'памп', pedProfile: { hasMGF: true } })).toBe('myo_reps');
  });
  it('GH solo памп → bfr', () => {
    expect(schemeFor({ character: 'памп', pedProfile: { hasGH: true } })).toBe('bfr');
  });
  it('тяж strength → strength_5x5', () => {
    expect(schemeFor({ character: 'тяж', focus: 'strength' })).toBe('strength_5x5');
  });
});

describe('bb-ped-methodology', () => {
  it('GH+insulin включает pump window', () => {
    const m = recommendPEDMethodology({ peds: ['GH','insulin'] as any, pedDoses: { GH: 4, insulin: 10 }, level: 'advanced' });
    expect(m.insulinPumpWindow).toBe(true);
    expect(m.bfrAllowed).toBe(true);
    expect(m.periWorkout.carbs).toBe('high');
  });
  it('GH solo → jointGuard', () => {
    const m = recommendPEDMethodology({ peds: ['GH'] as any, pedDoses: { GH: 4 }, level: 'intermediate' });
    expect(m.jointGuard).toBe(true);
    expect(m.failureAllowed).toBe(false);
  });
  it('AAS 1000 heavy → failureAllowed', () => {
    const m = recommendPEDMethodology({ peds: ['AAS'] as any, pedDoses: { AAS: 1000 }, level: 'advanced' });
    expect(m.failureAllowed).toBe(true);
  });
  it('insulin solo warning', () => {
    const m = recommendPEDMethodology({ peds: ['insulin'] as any, pedDoses: { insulin: 10 }, level: 'intermediate' });
    expect(m.periWorkout.warning).toBeDefined();
    expect(m.insulinPumpWindow).toBe(false);
  });
});

describe('bb-joint-guard', () => {
  it('GH 4 → active', () => { expect(jointGuardActive({ hasGH: true, ghDose: 4, hasAAS: false })).toBe(true); });
  it('натурал → не active', () => { expect(jointGuardActive({ hasGH: false, hasAAS: false })).toBe(false); });
  it('штраф axial при активе', () => {
    const pen = jointGuardScorePenalty({ equipment: 'barbell', jointStress: 'high', name: 'Приседания со штангой' }, { hasGH: true, ghDose: 4, hasAAS: false });
    expect(pen).toBeLessThan(0);
  });
  it('без актива — 0', () => {
    expect(jointGuardScorePenalty({ equipment: 'barbell', jointStress: 'high', name: 'Присед' }, { hasGH: false, hasAAS: false })).toBe(0);
  });
});

describe('bb-insulin-window', () => {
  it('GH+insulin → active', () => { expect(insulinWindowActive({ hasGH: true, ghDose: 4, hasInsulin: true, insulinDose: 10 })).toBe(true); });
  it('только инсулин → false', () => { expect(insulinWindowActive({ hasGH: false, hasInsulin: true, insulinDose: 10 })).toBe(false); });
  it('малые дозы → false', () => { expect(insulinWindowActive({ hasGH: true, ghDose: 1, hasInsulin: true, insulinDose: 4 })).toBe(false); });
});

describe('pro-presets', () => {
  it('3 пресета + none', () => { expect(Object.keys(PRO_PRESETS).length).toBe(4); });
});

describe('builder PED overlay не ломает тяж/памп', () => {
  it('GH+insulin памп-дни остаются памп, тяж остаются тяж', () => {
    const base = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, pedDoses: { GH: 4, insulin: 10 }, trainingYears: 3 } as any);
    // план строится без падения
    expect(base.weeks.length).toBe(4);
    // rationale содержит pump window и адаптацию сплита
    const txt = base.rationale.join(' ');
    expect(txt).toMatch(/GH\+insulin|Адаптирован|памп/);
    // тяж-дни всё ещё есть
    const hasHeavy = base.weeks.some(w => w.sessions.some(s => s.character === 'тяж'));
    const hasPump = base.weeks.some(w => w.sessions.some(s => s.character === 'памп' || s.character === 'лёг'));
    expect(hasHeavy).toBe(true);
    expect(hasPump).toBe(true);
  });
  it('натурал — нет PED rationale', () => {
    const nat = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    expect(nat.weeks.length).toBe(4);
    expect(nat.rationale.join(' ')).toMatch(/Сплит.*адаптирован/);
  });
  it('все сплиты адаптируются (upper_lower_3 и bro_5 дают план с PED)', () => {
    const p1 = buildBBPlan({ patternId: 'upper_lower_3', level: 'enhanced', goal: 'mass', weeks: 4, pedDoses: { AAS: 1000, GH: 6 }, trainingYears: 6 } as any);
    const p2 = buildBBPlan({ patternId: 'bro_5', level: 'enhanced', goal: 'mass', weeks: 4, pedDoses: { AAS: 1000 }, trainingYears: 6 } as any);
    expect(p1.weeks.length).toBe(4);
    expect(p2.weeks.length).toBe(4);
    expect(p1.weeks[0].sessions.length).toBeGreaterThan(0);
    expect(p2.weeks[0].sessions.length).toBeGreaterThan(0);
  });
});

describe('selector PED мягкий бонус', () => {
  it('GH+insulin не форсирует один сплит, все в топе', () => {
    const ranked = rankBBSplits({ level: 'enhanced', goal: 'mass', daysPerWeek: 4, peds: ['GH','insulin'] as any, pedDoses: { GH: 4, insulin: 10 } });
    expect(ranked.length).toBeGreaterThan(5);
    expect(ranked[0].score - ranked[4].score).toBeLessThan(35); // разрыв не огромный
  });
});

describe('BFR mode', () => {
  it('BFR только памп изоляции, тяж не трогает', async () => {
    const { buildBBPlan: b } = await import('../bb-builder.engine');
    const plan = b({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2, bfrMode: true } as any);
    let bfrCount = 0, heavyBfr = 0;
    for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
      if (e.comment?.includes('BFR')) {
        bfrCount++;
        if (s.character === 'тяж' && e.role === 'primary') heavyBfr++;
      }
    }
    expect(bfrCount).toBeGreaterThan(0);
    expect(heavyBfr).toBe(0);
  });
});

describe('Blast/Cruise', () => {
  it('blast неделя объём > cruise', async () => {
    const { buildBBPlan: b } = await import('../bb-builder.engine');
    const plan = b({ patternId: 'upper_lower_4', level: 'enhanced', goal: 'mass', weeks: 12, trainingYears: 5, blastCruiseEnabled: true, blastWeeks: 8, cruiseWeeks: 4 } as any);
    const w1 = plan.weeks[0].sessions.flatMap(s=>s.exercises).reduce((a,e)=>a+e.sets,0);
    const w9 = plan.weeks[8].sessions.flatMap(s=>s.exercises).reduce((a,e)=>a+e.sets,0);
    expect(w1).toBeGreaterThan(w9);
    expect(plan.rationale.join(' ')).toMatch(/Blast\/Cruise/);
  });
});

describe('RIR drift PED', () => {
  it('enhanced быстрее к отказу, GH медленнее', async () => {
    const { bbRir } = await import('../bb-builder.engine');
    const rNat = bbRir('тяж', 'accumulation', 2, 'hypertrophy' as any, {}, 'intermediate');
    const rEnh = bbRir('тяж', 'accumulation', 2, 'hypertrophy' as any, { AAS: 800 } as any, 'enhanced');
    const rGh = bbRir('тяж', 'accumulation', 2, 'hypertrophy' as any, { GH: 4 } as any, 'intermediate');
    expect(rEnh).toBeLessThanOrEqual(rNat);
    expect(rGh).toBeGreaterThan(rEnh);
  });
});

describe('PED export в отчёт', () => {
  it('BFR и GH+insulin попадают в текст отчёта', async () => {
    const { buildBBPlan: b } = await import('../bb-builder.engine');
    const { buildBBPlanReportText } = await import('../bb-report.engine');
    const plan = b({ patternId: 'upper_lower_4', level: 'enhanced', goal: 'mass', weeks: 4, pedDoses: { GH: 4, insulin: 10 }, bfrMode: true, trainingYears: 3 } as any);
    const txt = buildBBPlanReportText(plan);
    expect(txt).toMatch(/BFR|PED-методика|GH\+insulin/);
  });
});
