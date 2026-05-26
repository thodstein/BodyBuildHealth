export interface GamificationInput {
  diaryFillRate: number;      // 0–1 (доля заполненных дней за 30 дн.)
  nutritionAdherence: number; // 0–1 (попадание в КБЖУ ±15%)
  labMatchRate: number;       // 0–1 (соответствие лаб. данных заявленным дозам)
  trainerFeedback: number;    // 0–1 (оценка тренера 0–1)
}

export interface TrustResult {
  score: number;
  level: 'conservative' | 'standard' | 'aggressive';
  maxVolumeMultiplier: number; // 0.8 / 1.0 / 1.2 для корректировки MV-MRV
}

export function calcTrust(i: GamificationInput): TrustResult {
  const raw = (i.diaryFillRate * 20) + (i.nutritionAdherence * 30) + (i.labMatchRate * 30) + (i.trainerFeedback * 20);
  const score = Math.min(100, Math.max(0, Math.round(raw)));
  
  let level: TrustResult['level'] = 'standard';
  let mult = 1.0;
  if (score >= 80) { level = 'aggressive'; mult = 1.15; }
  else if (score < 40) { level = 'conservative'; mult = 0.8; }

  return { score, level, maxVolumeMultiplier: mult };
}

export interface AchievementState { recipes: number; diaryDays: number; riskReduction: number; }
export interface Achievement { id: string; name: string; icon: string; condition: (s: AchievementState) => boolean; xp: number; }

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_recipe', name: 'Первый рецепт', icon: '🏆', condition: s => s.recipes >= 1, xp: 50 },
  { id: 'stable_novice', name: 'Стабильный новичок', icon: '📊', condition: s => s.diaryDays >= 7, xp: 100 },
  { id: 'cardio_savior', name: 'Кардио-спаситель', icon: '❤️', condition: s => s.riskReduction >= 20, xp: 400 },
  { id: 'donor', name: 'Донор', icon: '🩸', condition: s => s.riskReduction >= 15 && s.diaryDays >= 30, xp: 150 },
];

export function checkAchievements(state: AchievementState): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.condition(state));
}