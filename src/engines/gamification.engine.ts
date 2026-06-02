import { GamificationState, TrustResult, Achievement } from '../core/types';
import { TRUST_WEIGHTS, TRUST_LEVELS } from '../core/constants';

export function calcTrust(state: GamificationState): TrustResult {
  const raw = (state.diaryFillRate * TRUST_WEIGHTS.diaryFillRate) +
              (state.nutritionAdherence * TRUST_WEIGHTS.nutritionAdherence) +
              (state.labMatchRate * TRUST_WEIGHTS.labMatchRate) +
              (state.trainerFeedback * TRUST_WEIGHTS.trainerFeedback);
  const score = Math.min(100, Math.max(0, Math.round(raw)));
  
  let level: TrustResult['level'] = 'standard';
  let vol = 1.0;
  if(score >= TRUST_LEVELS.aggressive.min) { level = 'aggressive'; vol = TRUST_LEVELS.aggressive.multiplier; }
  else if(score <= TRUST_LEVELS.conservative.max) { level = 'conservative'; vol = TRUST_LEVELS.conservative.multiplier; }

  return { score, level, volumeMultiplier: vol };
}

export const ACHIEVEMENTS: Achievement[] = [
  { id:'first_recipe', name:'Первый рецепт', icon:'🏆', condition:s=>(s.xp ?? 0)>0, xp:50 },
  { id:'stable_novice', name:'Стабильный новичок', icon:'📊', condition:s=>s.diaryFillRate>=0.7, xp:100 },
  { id:'cardio_savior', name:'Кардио-спаситель', icon:'❤️', condition:s=>s.labMatchRate>0.8 && s.diaryFillRate>0.9, xp:400 },
  { id:'donor', name:'Донор', icon:'🩸', condition:s=>s.labMatchRate>0.9, xp:150 },
  { id:'pct_master', name:'ПКТ-мастер', icon:'👑', condition:s=>s.nutritionAdherence>0.95 && s.diaryFillRate>0.8, xp:500 }
];

export function checkAchievements(state: GamificationState): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.condition(state));
}