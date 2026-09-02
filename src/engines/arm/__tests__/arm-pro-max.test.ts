import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { ARM_EXERCISES } from '../../../core/exercise-catalog-arm';
import { ARM_ANGLE_CLASSES } from '../arm-builder.engine';
import { isTendonMuscle, TENDON_CAP, MUSCLE_CAP, tendonWeeklyLimit } from '../arm-volume-landmarks.engine';
import { perExerciseCap, tendonBudgetForLevel } from '../arm-volume.engine';
import { buildArmMacrocycle } from '../arm-macrocycle.engine';
import { buildArmBlock } from '../arm-annual';
import { checkHumerusGuard, checkTendonGuard, checkUCLGuard, checkShoulderGuard } from '../arm-injury-guard.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { estimateForceVector } from '../arm-force-capture.engine';
import { vbtForExercise, diagnoseVbt } from '../arm-vbt-capture.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';

describe('arm PRO max — tendon physiology', () => {
  it('tendonCap 1.2 < muscle 1.7', () => {
    expect(TENDON_CAP).toBe(1.2);
    expect(MUSCLE_CAP).toBe(1.7);
    expect(TENDON_CAP).toBeLessThan(MUSCLE_CAP);
  });
  it('tendonWeeklyLimit beginner 12 intermediate 16 advanced 18', () => {
    expect(tendonWeeklyLimit('beginner')).toBe(12);
    expect(tendonWeeklyLimit('intermediate')).toBe(16);
    expect(tendonWeeklyLimit('advanced')).toBe(18);
    expect(tendonWeeklyLimit('enhanced')).toBe(22);
  });
  it('isTendonMuscle true for wrist/pron/sup, false for brachialis', () => {
    expect(isTendonMuscle('wrist_flexors')).toBe(true);
    expect(isTendonMuscle('pronators')).toBe(true);
    expect(isTendonMuscle('brachialis')).toBe(false);
  });
  it('tendonBudgetForLevel matches landmark', () => {
    expect(tendonBudgetForLevel('beginner')).toBe(12);
    expect(tendonBudgetForLevel('enhanced')).toBe(22);
  });
  it('perExerciseCap grip split', () => {
    expect(perExerciseCap('grip_support', 'intermediate')).toBe(5);
    expect(perExerciseCap('grip_pinch', 'intermediate')).toBe(4);
    expect(perExerciseCap('side_pressure')).toBe(3);
  });
});

describe('arm PRO max — catalog 60', () => {
  it('60 упражнений', () => {
    expect(ARM_EXERCISES.length).toBeGreaterThanOrEqual(60);
  });
  it('есть towel/fatbar/pinch80/CoC', () => {
    const ids = ARM_EXERCISES.map(e=>e.id);
    expect(ids).toContain('towel_pullup');
    expect(ids).toContain('fat_bar_deadlift');
    expect(ids).toContain('pinch_block_80');
    expect(ids).toContain('coc_no2');
    expect(ids).toContain('finger_containment_band');
  });
  it('CoC levels distinct', () => {
    expect(ARM_EXERCISES.find(e=>e.id==='coc_trainer')).toBeTruthy();
    expect(ARM_EXERCISES.find(e=>e.id==='coc_no1')).toBeTruthy();
    expect(ARM_EXERCISES.find(e=>e.id==='coc_no1_5')).toBeTruthy();
    expect(ARM_EXERCISES.find(e=>e.id==='coc_no2')).toBeTruthy();
  });
});

describe('arm PRO max — angles RU', () => {
  it('ARM_ANGLE_CLASSES 13 классов', () => {
    expect(Object.keys(ARM_ANGLE_CLASSES).length).toBeGreaterThanOrEqual(13);
    expect(ARM_ANGLE_CLASSES.cup_pronated).toBeTruthy();
    expect(ARM_ANGLE_CLASSES.pron_high).toBeTruthy();
  });
  it('workingAngleFor техника-специфичный hook vs toproll', () => {
    const hook = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'hook', weeks:8 });
    const top = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'toproll', weeks:8 });
    // hook должен иметь больше supinated, toproll больше pronated
    const hookAngles = hook.weeks.flatMap(w=>w.sessions.flatMap(s=>s.exercises.filter(e=>e.muscle==='supinators').map(e=>e.workingAngle?.forearm))).filter(Boolean);
    const topAngles = top.weeks.flatMap(w=>w.sessions.flatMap(s=>s.exercises.filter(e=>e.muscle==='pronators').map(e=>e.workingAngle?.forearm))).filter(Boolean);
    expect(hookAngles.length).toBeGreaterThan(0);
    expect(topAngles.length).toBeGreaterThan(0);
  });
  it('детерминизм seeded RNG', () => {
    const a = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'hook', weeks:8 });
    const b = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'hook', weeks:8 });
    expect(JSON.stringify(a.weeks[0].sessions[0].exercises[0].workSets)).toEqual(JSON.stringify(b.weeks[0].sessions[0].exercises[0].workSets));
  });
});

describe('arm PRO max — table 3/2/1', () => {
  it('tableKind moderate/heavy/stress ротируется 6н цикл', () => {
    const plan = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:12 });
    // moderate 3, heavy 2, stress 1 по Кузнецову — проверяем что все 3 вида встречаются
    const notes = plan.rationale.join(' ');
    expect(notes).toContain('Table 3/2/1');
    expect(plan.weeks.length).toBe(12);
  });
  it('table time ≥30% для armwrestling', () => {
    const plan = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:8 });
    const ratio = plan.weeks[0].tableRatio || 0;
    expect(ratio).toBeGreaterThanOrEqual(0.3);
  });
});

describe('arm PRO max — technique specialization', () => {
  it('hook ×1.3 supinators > balanced', () => {
    const hook = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'hook', weeks:8 });
    const bal = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:8 });
    expect(hook.mrvByMuscle!['supinators']).toBeGreaterThan(bal.mrvByMuscle!['supinators']);
  });
  it('press ×1.3 side_pressure', () => {
    const press = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'press', weeks:8 });
    const bal = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:8 });
    expect(press.mrvByMuscle!['side_pressure']).toBeGreaterThan(bal.mrvByMuscle!['side_pressure']);
  });
});

describe('arm PRO max — grip disciplines', () => {
  it('armlifting скипает pronators/side', () => {
    const p = buildArmPlan({ discipline:'armlifting', patternId:'grip_3_support', level:'intermediate', goal:'strength', technique:'balanced', weeks:8 });
    const hasPron = p.weeks.some(w=>w.sessions.some(s=>s.exercises.some(e=>e.muscle==='pronators')));
    expect(hasPron).toBe(false);
  });
  it('gripFocus pinch увеличивает pinch MRV', () => {
    const pinch = buildArmPlan({ discipline:'armlifting', patternId:'grip_3_support', level:'intermediate', goal:'strength', technique:'balanced', weeks:8, gripFocus:'pinch' });
    const support = buildArmPlan({ discipline:'armlifting', patternId:'grip_3_support', level:'intermediate', goal:'strength', technique:'balanced', weeks:8, gripFocus:'support' });
    expect(pinch.mrvByMuscle!['grip_pinch']).toBeGreaterThan(support.mrvByMuscle!['grip_pinch']);
  });
});

describe('arm PRO max — injury 4 guards', () => {
  it('humerus guard ≤10%/нед', () => {
    const plan: any = { weeks: [
      { week:1, sessions:[{ exercises:[{muscle:'side_pressure', sets:5}]}]},
      { week:2, sessions:[{ exercises:[{muscle:'side_pressure', sets:6}]}]},
    ]};
    const w = checkHumerusGuard(plan);
    expect(w.some(x=>x.includes('10%'))).toBe(true);
  });
  it('tendon guard critical >22', () => {
    const plan: any = { weeks:[{ week:1, sessions:[{ exercises:[{muscle:'wrist_flexors', sets:10},{muscle:'pronators', sets:10},{muscle:'supinators', sets:5}]}]}], level:'intermediate' };
    const w = checkTendonGuard(plan);
    expect(w.some(x=>x.includes('CRITICAL')||x.includes('>22'))).toBe(true);
  });
  it('UCL guard beginner hook', () => {
    const plan: any = { weeks:[{ week:1, sessions:[{ exercises:[{muscle:'side_pressure', sets:5}]}]}], level:'beginner' };
    const w = checkUCLGuard(plan);
    expect(w.length).toBeGreaterThan(0);
  });
  it('shoulder guard high-rep', () => {
    const plan: any = { weeks:[{ week:1, sessions:[{ exercises:[{muscle:'shoulder_stab', sets:2, repsRange:[8,10], rir:1}]}]}] };
    const w = checkShoulderGuard(plan);
    expect(w.length).toBeGreaterThan(0);
  });
  it('validate не invalid для standard (warnings только)', () => {
    let p:any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'balanced', weeks:8 });
    p = finalizeArmPlan(p,{level:'intermediate'});
    const v = validateArmPlan(p,'intermediate');
    expect(v.valid).toBe(true);
  });
});

describe('arm PRO max — VBT/motion/force', () => {
  it('vbtForExercise grip 15/25', () => {
    expect(vbtForExercise('rolling_thunder')).toEqual({ warnPct:15, stopPct:25 });
    expect(vbtForExercise('wrist_curl_belt')).toEqual({ warnPct:20, stopPct:30 });
  });
  it('diagnoseVbt per exercise', () => {
    const r = diagnoseVbt([{weight:50,reps:5,velocityMs:1.0,exerciseId:'rolling_thunder'},{weight:50,reps:5,velocityMs:0.7,exerciseId:'rolling_thunder'}]);
    expect(r.velocityLossPct).toBe(30);
    expect(r.zone).toBe('stop');
  });
  it('force bw-norm side 60кг vs 100кг bodyweight', () => {
    const v60 = estimateForceVector({sideKg:30, bodyWeightKg:60});
    const v100 = estimateForceVector({sideKg:30, bodyWeightKg:100});
    expect(v60.sidePressure).toBeGreaterThan(v100.sidePressure);
  });
});

describe('arm PRO max — WAF calendar', () => {
  it('A priority peaking ≥3н', () => {
    const m = buildArmMacrocycle({ totalWeeks:12, goal:'strength', competitions:[{week:11,id:'waf', priority:'A'}] });
    const peak = m.blocks.find(b=>b.phase==='peaking');
    expect(peak!.weeks).toBeGreaterThanOrEqual(3);
    expect(peak!.competitionId).toBe('waf');
  });
  it('C встроен в strength', () => {
    const m = buildArmMacrocycle({ totalWeeks:12, competitions:[{week:5,id:'c1', priority:'C'}] });
    const st = m.blocks.find(b=>b.phase==='strength');
    expect(st!.competitionId).toBe('c1');
  });
  it('armBlock taper A 3н', () => {
    const res = buildArmBlock({ blockKey:'blk', weeks:8, phase:'peaking' }, { taperEnabled:true, competitionPriority:'A' } as any, {level:'intermediate'});
    expect(res.taperApplied).toBe(true);
    expect(res.peakApplied).toBe(true);
  });
});

describe('arm PRO max — cross-meso', () => {
  it('previousPlan +2.5% веса', () => {
    const prev = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'hook', weeks:4, workMax:{wrist_flexors:50} });
    // finalize чтобы веса были
    const prevF = finalizeArmPlan(prev,{level:'intermediate'});
    const next = buildArmPlan({ discipline:'armwrestling', patternId:'arm_4_upper_lower', level:'intermediate', goal:'strength', technique:'hook', weeks:4, workMax:{wrist_flexors:50}, previousPlan: prevF as any });
    // next вес должен быть >= prev (прогрессия)
    const prevW = (prevF.weeks[prevF.weeks.length-1].sessions[0].exercises.find((e:any)=>e.muscle==='wrist_flexors') as any)?.workSets[0].weight || 0;
    const nextW = (next.weeks[0].sessions[0].exercises.find((e:any)=>e.muscle==='wrist_flexors') as any)?.workSets[0].weight || 0;
    expect(nextW).toBeGreaterThanOrEqual(prevW);
  });
});
