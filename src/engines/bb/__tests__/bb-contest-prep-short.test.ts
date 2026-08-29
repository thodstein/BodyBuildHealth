import { describe, it, expect } from 'vitest';
import { buildBBContestPrepPlan, spillRiskScore, isShortCycle, type BBContestPrepConfig } from '../bb-contest-prep.engine';
import { prepVolumePlan, type PrepCycleConfig } from '../bb-prep-cycle.engine';

function addDaysIso(iso:string, d:number){ const [y,m,day]=iso.split('-').map(Number); const dt=new Date(y,m-1,day+d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; }
function todayIso(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function base(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return { sex:'male', category:'mens_bb', weightKg:80, experienceLevel:'intermediate', enhanced:false, prepCount:1, showDate:addDaysIso(todayIso(),30), weeksOut:2, trainingProtocol:'bb', carbLoadStrategy:'front', waterStrategy:'stable', sodiumStrategy:'stable', ...over };
}

describe('shortCycle 4-6 нед linear', () => {
  it('isShortCycle true 4-6, false else', () => {
    expect(isShortCycle(4)).toBe(true);
    expect(isShortCycle(6)).toBe(true);
    expect(isShortCycle(7)).toBe(false);
    expect(isShortCycle(12)).toBe(false);
  });
  it('prepVolumePlan shortCycle 2 нед → single phase ×~0.95-1.0 (deficit)', () => {
    const cfg = { category:'mens_bb', sex:'male', accentMuscles:[], minimalMuscles:[], weeks:5, taperWeeks:1, showDate:todayIso(), level:'intermediate', weightKg:80, bodyFatPct:8, experienceLevel:'intermediate' } as unknown as PrepCycleConfig;
    const p = prepVolumePlan(cfg as any, 2);
    expect(p.phases.length).toBe(1);
    expect(p.phases[0].volumeMult).toBeGreaterThanOrEqual(0.94);
  });
  it('build plan shortCycle не режет final двойно', () => {
    const plan = buildBBContestPrepPlan(base(), { prepWeeks:2, taperWeeks:1 });
    expect(plan.preparation.finalWeeks).toBe(0);
  });
});

describe('spillRiskScore', () => {
  it('high при BF+3% + high budget + back', () => {
    const s = spillRiskScore(base({ bodyFatPct:9, category:'mens_bb', carbLoadStrategy:'back', waterStrategy:'stable' }));
    expect(s.level).toBe('high');
  });
  it('low при on_track', () => {
    const s = spillRiskScore(base({ bodyFatPct:5.5, category:'mens_bb', carbLoadStrategy:'moderate', waterStrategy:'stable' }));
    expect(s.level).toBe('low');
  });
});
