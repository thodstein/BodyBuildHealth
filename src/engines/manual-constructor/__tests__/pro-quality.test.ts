import { describe, it, expect } from 'vitest';
import { analyzeProQuality } from '../pro-quality-analysis.engine';

const mockBB: any = {
  meta:{ id:'1', title:'Test BB', direction:'bb', level:'intermediate', weeks:4, daysPerWeek:4, goal:'mass' },
  bb:{
    direction:'bb',
    weeks:[
      { week:1, phase:'accumulation', deload:false, sessions:[
        { id:'s1', name:'День 1', focus:'Chest', blocks:[
          { id:'b1', type:'compound', exerciseName:'Жим штанги лёжа', muscle:'chest', role:'primary', sets:[{reps:8,rir:2,weight:80}] },
          { id:'b2', type:'isolation', exerciseName:'Разводка гантелей лёжа', muscle:'chest', role:'accessory', sets:[{reps:12,rir:2}] },
          { id:'b3', type:'compound', exerciseName:'Тяга верхнего блока (прямой)', muscle:'back', role:'primary', sets:[{reps:8,rir:2}] },
        ]},
        { id:'s2', name:'День 2', focus:'Legs', blocks:[
          { id:'b4', type:'compound', exerciseName:'Приседания со штангой', muscle:'quads', role:'primary', sets:[{reps:8,rir:2}] },
          { id:'b5', type:'compound', exerciseName:'Румынская тяга', muscle:'hamstrings', role:'primary', sets:[{reps:8,rir:2}] },
        ]}
      ]}
    ],
    volumeBudget:{}, progression:{ loadStrategy:'double_progression', deloadProtocol:'pump', intensityTechniques:[] }, constraints:{ equipment:[] }, microcycleTemplate:{ daySlots:[] }
  }
};

describe('pro-quality', () => {
  it('analyzes patterns', () => {
    const res = analyzeProQuality(mockBB, 'bb', 'intermediate', 'mass', [{muscle:'chest', peakSets:8, mrv:20},{muscle:'back', peakSets:6,mrv:24}]);
    expect(res.patterns.length).toBeGreaterThan(0);
    expect(res.angles.length).toBeGreaterThan(0);
    expect(res.stretches.length).toBeGreaterThan(0);
    expect(res.technique).toBeDefined();
    expect(res.goalAlignment).toBeDefined();
  });
  it('pl branch — covers squat/bench/dead patterns', () => {
    const plMock: any = {
      meta:{ id:'2', title:'PL Test', direction:'pl', level:'intermediate', weeks:4, daysPerWeek:3, goal:'strength' },
      pl:{
        direction:'pl' as const,
        sourceCycleId:null,
        schedule:[], weakPoints:[], notes:'', workMax:{},
        customWeeks:[
          { week:1, phase:'accumulation', deload:false, days:[
            { name:'День 1', exercises:[{ name:'Приседания со штангой', lift:'squat', muscle:'quads', sets:[{ pct:0.75, reps:5, sets:5, rir:2 }] }]},
            { name:'День 2', exercises:[{ name:'Жим лёжа', lift:'bench', muscle:'chest', sets:[{ pct:0.8, reps:3, sets:6, rir:1 }] }]},
            { name:'День 3', exercises:[{ name:'Становая тяга', lift:'dead', muscle:'back', sets:[{ pct:0.8, reps:3, sets:4, rir:2 }] }]},
          ]}
        ]
      }
    };
    const res = analyzeProQuality(plMock, 'pl', 'intermediate', 'strength', [{muscle:'chest', peakSets:10,mrv:24},{muscle:'legs', peakSets:12,mrv:24}]);
    expect(res.division).toBe('pl');
    expect(res.goal).toBe('Сила');
    expect(res.patterns.some(p=>p.muscle==='legs')).toBe(true);
  });
  it('PED — raises technique tolerance', () => {
    const clone:any = JSON.parse(JSON.stringify(mockBB));
    clone.bb.weeks[0].sessions[0].blocks.push({ id:'b6', type:'isolation', exerciseName:'Подъём штанги на бицепс стоя', muscle:'biceps', role:'accessory', sets:[{reps:10,rir:1,weight:30}], technique:'myo_reps', techniques:['myo_reps'] });
    const resNat = analyzeProQuality(mockBB, 'bb', 'advanced', 'mass', [{muscle:'chest', peakSets:12,mrv:24}]);
    const resAdv = analyzeProQuality(clone, 'bb', 'enhanced', 'mass', [{muscle:'chest', peakSets:12,mrv:28}]);
    expect(resAdv.technique.pct).toBeGreaterThan(resNat.technique.pct);
  });
  it('goal binding — mass vs strength expectations differ', () => {
    const resMass = analyzeProQuality(mockBB, 'bb', 'intermediate', 'mass', [{muscle:'chest', peakSets:8,mrv:20}]);
    const resStrength = analyzeProQuality(mockBB, 'bb', 'intermediate', 'strength', [{muscle:'chest', peakSets:8,mrv:20}]);
    expect(resMass.goal).toBe('Масса');
    expect(resStrength.goal).toBe('Сила');
    expect(resMass.goalAlignment.volumePctAvg).toBe(resStrength.goalAlignment.volumePctAvg);
  });
  it('hybrid — bb/pl both analysable', () => {
    const hybrid:any = {
      meta:{ id:'3', title:'Hybrid', direction:'hybrid', level:'intermediate', weeks:4, daysPerWeek:4, goal:'recomp' },
      hybrid:{ plRef:{ sourceCycleId:'cycle-01', sessionIndices:[0] }, bbWeeks: mockBB.bb.weeks, notes:'', workMax:{}, level:'intermediate' },
      bb: mockBB.bb,
      pl: { direction:'pl', sourceCycleId:'cycle-01', schedule:[], weakPoints:[], notes:'', workMax:{}, customWeeks: [{ week:1, phase:'accumulation', deload:false, days:[{ name:'День 1', exercises:[{ name:'Жим лёжа', lift:'bench', muscle:'chest', sets:[{ pct:0.75, reps:5, sets:5, rir:2 }] }]}]}] },
    };
    const resBb = analyzeProQuality(hybrid, 'bb', 'intermediate', 'recomp', [{muscle:'chest', peakSets:8,mrv:20}]);
    const resPl = analyzeProQuality(hybrid, 'pl', 'intermediate', 'strength', [{muscle:'chest', peakSets:8,mrv:20}]);
    expect(resBb.division).toBe('bb');
    expect(resPl.division).toBe('pl');
  });
});
