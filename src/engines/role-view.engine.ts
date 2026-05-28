import { UserRole, LabPoint, RiskResult, GamificationState, DynamicRefRange, LabPhaseType } from '../core/types';
import { ROLE_PERMISSIONS, DYNAMIC_REFS } from '../core/constants';

export function filterLabsByRole(labs: LabPoint[], role: UserRole): LabPoint[] {
  if (role === 'doctor') return labs;
  if (role === 'coach') return labs.map(l => ({ ...l, value: l.value, note: l.value > 50 ? '⚠️ Требует внимания врача' : undefined }));
  return labs;
}

export function generateRoleInsights(role: UserRole, data: { risks: RiskResult; labs: LabPoint[]; phase: LabPhaseType }): string {
  if (role === 'user') return `📊 Ваш профиль: риски в норме. Продолжайте вести дневник и сдавать анализы по чек-поинтам.`;
  if (role === 'coach') return `🏋️ Коуч: отслеживайте тренды утомления. При росте Net Risk >40% снизьте объём на 20%.`;
  if (role === 'doctor') return `👨‍⚕️ Врач: сырые данные доступны. При превышении ULN в динамике рассмотрите коррекцию доз.`;
  return '';
}

export function getDynamicRef(marker: string, userAge: number, userSex: 'male'|'female', phase: LabPhaseType): { uln: number; lln: number } {
  const ref = DYNAMIC_REFS[marker];
  if (!ref) return { uln: 100, lln: 0 };
  return {
    uln: Math.round(ref.baseULN * ref.ageFactor(userAge) * ref.sexFactor(userSex) * ref.phaseFactor(phase)),
    lln: Math.round(ref.baseLLN * ref.ageFactor(userAge) * ref.sexFactor(userSex) * ref.phaseFactor(phase))
  };
}