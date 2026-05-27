import { EffectEntry, InteractionEntry } from '../core/stack-types';

export interface RiskResult {
  organLoad: Record<string, number>;
  systemLoad: Record<string, number>;
  totalRisk: number;
  flags: string[];
}

export function calculateRisk(
  stackSubstances: string[],
  effects: EffectEntry[],
  labs: Record<string, number> = {}
): RiskResult {
  const organLoad: Record<string, number> = {};
  const systemLoad: Record<string, number> = {};
  const flags: string[] = [];

  // Aggregate organ/system load from effects matrix
  effects.forEach(ef => {
    if (!stackSubstances.some(s => ef.effect.toUpperCase().includes(s.toUpperCase()))) return;
    
    ef.organs.forEach(org => {
      organLoad[org.name] = (organLoad[org.name] || 0) + (org.weight * ef.risk_score * 10);
    });
    Object.entries(ef.coverage).forEach(([sys, val]) => {
      systemLoad[sys] = (systemLoad[sys] || 0) + (val * ef.risk_score * 5);
    });
  });

  // Lab adjustments
  if (labs.ALT > 40) { organLoad.LIVER = (organLoad.LIVER || 0) + 25; flags.push('⚠️ ALT > ULN'); }
  if (labs.HCT > 52) { systemLoad.CARDIO = (systemLoad.CARDIO || 0) + 30; flags.push('⚠️ HCT повышен'); }
  if (labs.CREATININE > 110) { organLoad.KIDNEYS = (organLoad.KIDNEYS || 0) + 35; flags.push('⚠️ Креатинин > ULN'); }

  const totalRisk = Math.min(100, Math.round(
    Object.values(organLoad).reduce((a, b) => a + b, 0) * 0.6 +
    Object.values(systemLoad).reduce((a, b) => a + b, 0) * 0.4
  ));

  return { organLoad, systemLoad, totalRisk, flags };
}