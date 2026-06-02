export interface GamificationState {
  diaryFillRate: number; nutritionAdherence: number; labMatchRate: number; trainerFeedback: number;
  achievements: string[]; xp: number; challenges: Record<string, boolean>;
}

export interface TrustResult {
  score: number; level: 'conservative' | 'standard' | 'aggressive'; volumeMultiplier: number;
}

export function calcTrust(state: GamificationState): TrustResult {
  const raw = (state.diaryFillRate*20) + (state.nutritionAdherence*30) + (state.labMatchRate*30) + (state.trainerFeedback*20);
  const score = Math.min(100, Math.max(0, Math.round(raw)));
  let level: TrustResult['level'] = 'standard'; let vol = 1.0;
  if(score >= 80) { level='aggressive'; vol=1.15; }
  else if(score < 40) { level='conservative'; vol=0.8; }
  return { score, level, volumeMultiplier: vol };
}

export interface Achievement { id:string; name:string; icon:string; condition:(s:GamificationState)=>boolean; xp:number; }
export const ACHIEVEMENTS: Achievement[] = [
  { id:'first_recipe', name:'Первый рецепт', icon:'🏆', condition:s=>s.achievements.length>0||s.diaryFillRate>0||s.nutritionAdherence>0, xp:50 },
  { id:'stable_novice', name:'Стабильный новичок', icon:'📊', condition:s=>s.diaryFillRate>=0.7, xp:100 },
  { id:'stable_profi', name:'Стабильный профи', icon:'📈', condition:s=>s.diaryFillRate>=0.95, xp:500 },
  { id:'lab_genius', name:'Лабораторный гений', icon:'🔬', condition:s=>s.labMatchRate>=1.0, xp:300 },
  { id:'expert_reader', name:'Знаток', icon:'🧠', condition:s=>s.xp>=500, xp:100 },
  { id:'librarian', name:'Библиотекарь', icon:'📚', condition:s=>s.xp>=1500, xp:500 },
  { id:'cardio_savior', name:'Кардио-спаситель', icon:'❤️', condition:s=>s.labMatchRate>0.8&&s.diaryFillRate>0.9, xp:400 },
  { id:'donor', name:'Донор', icon:'🩸', condition:s=>s.labMatchRate>0.9, xp:150 },
  { id:'recovery', name:'Восстановление', icon:'🧘', condition:s=>s.trainerFeedback>=0.7&&s.diaryFillRate>=0.6, xp:100 },
  { id:'iron_athlete', name:'Железный атлет', icon:'🏅', condition:s=>s.trainerFeedback>=0.9, xp:300 },
  { id:'pct_master', name:'ПКТ-мастер', icon:'👑', condition:s=>s.nutritionAdherence>0.95&&s.diaryFillRate>0.8, xp:500 }
];

export function checkAchievements(state: GamificationState): Achievement[] {
  return ACHIEVEMENTS.filter(a=>a.condition(state));
}