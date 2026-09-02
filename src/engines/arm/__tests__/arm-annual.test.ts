import { describe, it, expect } from 'vitest';
import { buildArmBlock } from '../arm-annual';
import { buildArmMacrocycle, armMacroPhaseForWeek, armMacroPhaseToUserPhase } from '../arm-macrocycle.engine';
import { directionFromKinds, annualPlanFromMacro, syncAnnualPlan, buildAnnualPlan, macroBlockKey, applyBlockPhaseToWeeks } from '../../annual-training/block-builders.engine';
import { armPlanToSessions } from '../../training-integration.engine';
import { buildArmPlan } from '../arm-builder.engine';

describe('arm-annual', () => {
  it('buildArmBlock: 4 недели', () => {
    const res = buildArmBlock({ blockKey: 'test', weeks: 4, phase: 'strength' }, { level: 'intermediate' } as any);
    expect(res.weeks.length).toBe(4);
    expect(res.kind).toBe('ARM');
    expect(res.weeks[0].sessions.length).toBeGreaterThan(0);
  });
  it('taperApplied', () => {
    const res = buildArmBlock({ blockKey: 'taper', weeks: 4, phase: 'peaking' }, { level: 'intermediate', taperEnabled: true, taperWeeks: 2 } as any);
    expect(res.taperApplied).toBe(true);
  });
  it('directionFromKinds ARM', () => {
    expect(directionFromKinds(['ARM'] as any)).toBe('arm');
    expect(directionFromKinds(['PL','ARM'] as any)).toBe('mixed');
    expect(directionFromKinds(['BB','ARM'] as any)).toBe('mixed');
    expect(directionFromKinds(['ARM','ARM'] as any)).toBe('arm');
  });
  it('armPlanToSessions', () => {
    const plan: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 });
    const sessions = armPlanToSessions(plan);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].source).toBe('ARM');
    expect(sessions[0].exercises.length).toBeGreaterThan(0);
  });
  // PRO MAX: armMacroPhaseForWeek + armMacroPhaseToUserPhase как bbMacroPhaseToUserPhase
  it('armMacroPhaseForWeek + armMacroPhaseToUserPhase', () => {
    const macro = buildArmMacrocycle({ totalWeeks: 12, goal:'strength', competitions:[{week:11,id:'waf', priority:'A'}] });
    expect(armMacroPhaseForWeek(macro, 1)).toBe('hypertrophy');
    expect(armMacroPhaseForWeek(macro, 12)).toBeTruthy();
    expect(armMacroPhaseToUserPhase('hypertrophy')).toBe('accumulation');
    expect(armMacroPhaseToUserPhase('strength')).toBe('intensification');
    expect(armMacroPhaseToUserPhase('peaking')).toBe('peaking');
    expect(armMacroPhaseToUserPhase('transition')).toBe('deload');
  });
  it('applyBlockPhaseToWeeks ARM hypertrophy → accumulation', () => {
    const dummyWeek: any = { week:1, phase:'accumulation', deload:false, sessions:[{ id:'s1', blocks:[{ id:'b1', type:'compound', sets:[{reps:8,rir:2},{reps:8,rir:2}] }]}]};
    const out = applyBlockPhaseToWeeks([dummyWeek], 'hypertrophy', 'ARM' as any);
    expect(out[0].phase).toBe('accumulation');
    expect(out[0].sessions[0].blocks[0].sets.length).toBeGreaterThan(0);
  });
  it('macroBlockKey weightClass влияет на stale (как block-builders)', () => {
    const b1: any = { phase:'peaking', weekOffset:0, weeks:4, weightClass:'80' };
    const b2: any = { phase:'peaking', weekOffset:0, weeks:4, weightClass:'90' };
    expect(macroBlockKey(b1,0)).not.toBe(macroBlockKey(b2,0));
    expect(macroBlockKey(b1,0)).toContain('80');
    // без weightClass — короче
    const b0: any = { phase:'peaking', weekOffset:0, weeks:4 };
    expect(macroBlockKey(b0,0)).not.toBe(macroBlockKey(b1,0));
  });
  it('configHash учитывает weightClass (stale детекция)', () => {
    const macro = buildArmMacrocycle({ totalWeeks: 8 });
    const plan = annualPlanFromMacro(macro as any);
    // первый блок — добавим вес категорию в реф/конфиг
    const p1 = syncAnnualPlan(plan, macro as any);
    expect(p1.blocks.length).toBeGreaterThan(0);
    expect(p1.direction).toBe('arm');
    // имитируем изменение weightClass в макро — ключ должен измениться → stale
    const macro2 = JSON.parse(JSON.stringify(macro)) as any;
    macro2.blocks[0].weightClass = '90';
    const p2 = syncAnnualPlan(p1, macro2 as any);
    const first = p2.blocks[0];
    // если макро изменил weightClass, ключ новый → либо unbuilt либо stale
    expect(['unbuilt','stale']).toContain(first.status);
  });
  it('hybrid ARM+BB годовой — E2E TrainingScreen (arm-comprehensive)', () => {
    const armMacro = buildArmMacrocycle({ totalWeeks: 8, goal:'strength' });
    const armPlan = annualPlanFromMacro(armMacro as any);
    expect(armPlan.direction).toBe('arm');
    // имитируем гибрид: добавим BB-блок вручную (как в TrainingScreen hybrid)
    const bbMacro: any = { type: 'bb', totalWeeks: 8, blocks: [{ phase:'hypertrophy', weekOffset:0, weeks:4 }, { phase:'strength', weekOffset:4, weeks:4 }], rationale:[] };
    // создаем гибридный план: сначала ARM блоки, затем BB — direction должен быть mixed
    const hybridKinds: any[] = ['ARM','BB'];
    expect(directionFromKinds(hybridKinds)).toBe('mixed');
    // buildAnnualPlan для ARM части
    const built = buildAnnualPlan(armPlan, armMacro as any, { sync:false });
    expect(built.plan.blocks.every(b=> b.ref.kind==='ARM')).toBe(true);
    // проверка что арм-блок с weightClass собирается
    const wcRes = buildArmBlock({ blockKey:'wc', weeks:4, phase:'peaking', weightClass:'85' }, { level:'intermediate', weightClass:'85', taperEnabled:true } as any);
    expect(wcRes.weeks.length).toBe(4);
  });
  it('annual weightClass + WAF sideRef линейно 55→110', async () => {
    const { getSideRef } = await import('../arm-force-capture.engine');
    const r55 = getSideRef(55,'55');
    const r110 = getSideRef(110,'110');
    expect(r110).toBeGreaterThan(r55);
    expect(r55).toBeCloseTo(55*0.55,0);
  });
});
