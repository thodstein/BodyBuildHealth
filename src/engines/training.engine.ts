import { TrainingInput, TrainingOutput } from '../core/types';

const MV_MR_V: Record<string, { mv: number; mev: number; mav: number; mrv: number }> = {
  beginner:    { mv: 4,  mev: 8,  mav: 12, mrv: 16 },
  intermediate:{ mv: 6,  mev: 10, mav: 16, mrv: 20 },
  advanced:    { mv: 8,  mev: 12, mav: 18, mrv: 24 },
  enhanced:    { mv: 10, mev: 14, mav: 22, mrv: 28 }
};

const SPLITS: Record<string, { name: string; days: number; desc: string; condition: (i: TrainingInput) => boolean }> = {
  'recovery_3':   { name:'Recovery Split 3x', days:3, desc:'50% объёма, RIR 4', condition: i => i.recovery<50 || i.fatigue>70 || i.nutrition<50 },
  'fullbody_3':   { name:'Full Body 3x', days:3, desc:'Все группы, базовые', condition: i => i.daysPerWeek===3 },
  'upperlower_4': { name:'Upper/Lower 4x', days:4, desc:'Верх/низ, универсал', condition: i => i.daysPerWeek===4 },
  'ppl_accent_5': { name:'PPL + Accent 5x', days:5, desc:'Push/Pull/Legs + 2 акцентных', condition: i => i.daysPerWeek===5 },
  'ppl_2x_6':     { name:'PPL 2x 6x', days:6, desc:'Push/Pull/Legs дважды', condition: i => i.daysPerWeek>=6 && i.recovery>=70 },
  'arnold_6':     { name:'Arnold Split 6x', days:6, desc:'Грудь+спина, плечи+руки, ноги', condition: i => i.daysPerWeek===6 && i.goal!=='strength' },
  'strength_4':   { name:'Strength Bias 4x', days:4, desc:'Compound фокус', condition: i => i.goal==='strength' },
  'bro_5':        { name:'Bro Split 5x', days:5, desc:'Одна группа в день', condition: i => i.daysPerWeek===5 && i.level!=='beginner' }
};

export function calcTraining(i: TrainingInput): TrainingOutput {
  const base = MV_MR_V[i.level];
  let volume = base.mav;

  // Коррекция по состоянию (ТЗ §5.1)
  if (i.recovery < 50) volume *= 0.8;
  if (i.fatigue > 60) volume *= 0.9;
  if (i.nutrition < 60) volume *= 0.85;

  // Weak points (ТЗ §5.1 п.4)
  const groups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
  const volMap: Record<string, number> = {};
  const wpFactor = 1.2;
  const nonWpFactor = Math.max(0.7, 1.0 - (0.1 * i.weakPoints.length));

  groups.forEach(g => {
    volMap[g] = i.weakPoints.includes(g) ? volume * wpFactor : volume * nonWpFactor;
  });

  // Выбор сплита (ТЗ §6.1 дерево)
  let selected = Object.values(SPLITS).find(s => s.condition(i)) || SPLITS['upperlower_4'];
  let splitName = selected.name;
  let splitDesc = selected.desc;

  // RIR (ТЗ §5.5)
  const rirMap: Record<string, string> = {
    strength:'2-3', hypertrophy:'1-2', endurance:'3-4', recovery:'4',
    maintenance:'2-3', bulk:'2-3', cut:'1-2', rehab:'3-4'
  };
  let rir = rirMap[i.goal] || '2-3';

  // Deload logic (ТЗ §5.7)
  let isDeload = false;
  let deloadReason = '';

  if (i.recovery < 55) {
    isDeload = true;
    deloadReason = 'Recovery < 55';
    rir = '4';
    Object.keys(volMap).forEach(k => { volMap[k] *= 0.5; });
  } else if (i.fatigue > 70) {
    isDeload = true;
    deloadReason = 'Fatigue > 70';
    rir = '4';
    Object.keys(volMap).forEach(k => { volMap[k] *= 0.6; });
  } else if (i.nutrition < 55) {
    isDeload = true;
    deloadReason = 'Nutrition < 55';
    Object.keys(volMap).forEach(k => { volMap[k] *= 0.7; });
  }

  const roundedVol: Record<string, number> = {};
  Object.entries(volMap).forEach(([k, v]) => { roundedVol[k] = Math.round(v); });

  const weekPlan = isDeload
    ? 'НЕДЕЛЯ 1 (ДЕЛОД): 50% объёма, RIR 4, без отказов'
    : 'НЕДЕЛЯ 1 (ВХОД): 70% MAV, RIR 3, фокус на технику';

  return {
    splitName,
    splitDesc,
    volumePerGroup: roundedVol,
    rir,
    isDeload,
    deloadReason,
    weekPlan
  };
}
