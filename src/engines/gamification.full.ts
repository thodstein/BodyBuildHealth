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
  { id:'first_recipe', name:'Первый рецепт', icon:'🏆', condition:s=>s.xp>0, xp:50 },
  { id:'stable_novice', name:'Стабильный новичок', icon:'📊', condition:s=>s.diaryFillRate>=0.7, xp:100 },
  { id:'cardio_savior', name:'Кардио-спаситель', icon:'❤️', condition:s=>s.labMatchRate>0.8 && s.diaryFillRate>0.9, xp:400 },
  { id:'donor', name:'Донор', icon:'🩸', condition:s=>s.labMatchRate>0.9, xp:150 },
  { id:'pct_master', name:'ПКТ-мастер', icon:'👑', condition:s=>s.nutritionAdherence>0.95 && s.diaryFillRate>0.8, xp:500 }
];

export function checkAchievements(state: GamificationState): Achievement[] {
  return ACHIEVEMENTS.filter(a=>a.condition(state));
}