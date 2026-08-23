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
    console.log(JSON.stringify(res,null,2));
  });
});
