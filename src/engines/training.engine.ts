import { TrainingInput, TrainingOutput, TrainingLevel, TrainingGoal } from '../core/types';

const MV_MR_V: Record<TrainingLevel, { mv: number; mev: number; mav: number; mrv: number }> = {
  beginner:    { mv: 4,  mev: 8,  mav: 12, mrv: 16 },
  intermediate:{ mv: 6,  mev: 10, mav: 16, mrv: 20 },
  advanced:    { mv: 8,  mev: 12, mav: 18, mrv: 24 },
  enhanced:    { mv: 10, mev: 14, mav: 22, mrv: 28 }
};

const SPLITS: Record<string, { name: string; days: number; desc: string; condition: (inp: TrainingInput) => boolean }> = {
  'recovery_3': { name:'Recovery Split 3x', days:3, desc:'50% объёма, RIR 4, безопасные движения', condition: i => i.recovery<50 || i.fatigue>70 || i.nutrition<50 },
  'fullbody_3': { name:'Full Body 3x', days:3, desc:'Все группы на каждой тренировке, базовые движения', condition: i => i.daysPerWeek===3 },
  'upperlower_4': { name:'Upper/Lower 4x', days:4, desc:'Верх/низ чередуются, универсальный баланс', condition: i => i.daysPerWeek===4 },
  'upperlower_5': { name:'Upper/Lower 5x', days:5, desc:'Высокая частота, 3 верх/2 низ или наоборот', condition: i => i.daysPerWeek===5 && i.level==='advanced' },
  'ppl_accent_5': { name:'PPL + Accent 5x', days:5, desc:'Push/Pull/Legs + 2 акцентных дня на слабые группы', condition: i => i.daysPerWeek===5 && i.weakPoints.length>0 },
  'ppl_2x_6': { name:'PPL 2x 6x', days:6, desc:'Push/Pull/Legs дважды в неделю, максимальный объём', condition: i => i.daysPerWeek>=6 && i.recovery>=70 },
  'arnold_6': { name:'Arnold Split 6x', days:6, desc:'Грудь+спина, плечи+руки, ноги – 2 цикла', condition: i => i.daysPerWeek===6 && i.goal!=='strength' },
  'bro_5': { name:'Bro Split 5x', days:5, desc:'Одна мышечная группа в день, высокая изоляция', condition: i => i.daysPerWeek===5 && i.level!=='beginner' },
  'strength_4': { name:'Strength Bias 4x', days:4, desc:'Compound фокус, RIR 2–3, низкая изоляция', condition: i => i.goal==='strength' },
  'hypertrophy_6': { name:'Hypertrophy Bias 6x', days:6, desc:'Высокий объём, ROM bias, акцент на памп', condition: i => i.daysPerWeek===6 && i.goal==='hypertrophy' },
  'torso_limbs_4': { name:'Torso/Limbs 4x', days:4, desc:'Торс отдельно, конечности отдельно', condition: i => i.daysPerWeek===4 && i.injuries?.includes('lower') },
  'ppl_hybrid_4': { name:'PPL Hybrid 4x', days:4, desc:'Push, Pull, Legs, Upper', condition: i => i.daysPerWeek===4 && i.level==='intermediate' },
  'spec_5': { name:'Specialization 5x', days:5, desc:'Частота и объём на 1–2 отстающих мышцах', condition: i => i.daysPerWeek===5 && i.weakPoints.length===1 },
  'pushpull_la_5': { name:'Push/Pull + Legs+Arms 5x', days:5, desc:'Компромисс между PPL и Bro', condition: i => i.daysPerWeek===5 },
  'cbs_da_5': { name:'Chest/Back/Legs/Delts/Arms 5x', days:5, desc:'Классический раздельный сплит', condition: i => i.daysPerWeek===5 && i.recovery>=65 }
};

export function calcTraining(inp: TrainingInput): TrainingOutput {
  const base = MV_MR_V[inp.level];
  let volume = base.mav;

  // Коррекция по состоянию (ТЗ §5.1)
  if (inp.recovery < 50) volume *= 0.8;
  if (inp.fatigue > 60) volume *= 0.9;
  if (inp.nutrition < 60) volume *= 0.85;

  // Weak points (ТЗ §5.1 п.4)
  const groups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
  const volMap: Record<string, number> = {};
  const wpFactor = 1.2; const nonWpFactor = 1.0 - (0.1 * inp.weakPoints.length);

  groups.forEach(g => {
    volMap[g] = inp.weakPoints.includes(g) ? volume * wpFactor : volume * nonWpFactor;
  });

  // Выбор сплита (ТЗ §6.1 дерево)
  let selected = Object.values(SPLITS).find(s => s.condition(inp)) || SPLITS['upperlower_4'];
  let splitName = selected.name; let splitDesc = selected.desc;

  // RIR (ТЗ §5.5)
  const rirMap: Record<string, string> = { strength:'2-3', hypertrophy:'1-2', endurance:'3-4', recovery:'4', maintenance:'2-3', bulk:'2-3', cut:'1-2', rehab:'3-4' };
  let rir = rirMap[inp.goal] || '2-3';

  // Deload (ТЗ §5.7)
  let isDeload = false, deloadReason = '';
  if (inp.recovery < 55) { isDeload=true; deloadReason='Recovery < 55'; rir='4'; Object.keys(volMap).forEach(k => volMap[k]*=0.5); }
  else if (inp.fatigue > 70) { isDeload=true; deloadReason='Fatigue > 70'; rir='4'; Object.keys(volMap).forEach(k => volMap[k]*=0.6); }
  else if (inp.nutrition < 55) { isDeload=true; deloadReason='Nutrition < 55'; Object.keys(vol