import { ORGANS_DB } from '../core/clinical-databases';
import type { LabPoint } from '../core/types';

interface MechanismData {
  id: string;
  risk_weight: number;
  organs: string[];
}

interface RiskResult {
  organLoad: Record<string, number>;
  systemLoad: Record<string, number>;
  totalRisk: number;
  flags: string[];
}

export function calculateRiskFromMechanisms(mechList: MechanismData[]): RiskResult {
  const organLoad: Record<string, number> = {};
  const systemLoad: Record<string, number> = {};
  const flags: string[] = [];

  mechList.forEach(m => {
    const weight = m.risk_weight || 1;
    ORGANS_DB.forEach(org => {
      if (m.organs.includes(org.id)) {
        organLoad[org.id] = (organLoad[org.id] || 0) + weight;
      }
    });
    if (weight > 1.5) flags.push(`⚠️ Высокий риск: ${m.id} (вес ${weight})`);
  });

  const totalRisk = Object.values(organLoad).reduce((a, b) => a + b, 0) * 0.6 + 
                    Object.values(systemLoad).reduce((a, b) => a + b, 0) * 0.4;

  return { organLoad, systemLoad, totalRisk: Math.min(100, Math.round(totalRisk)), flags };
}

export function calculateRiskFromAnalyses(labs: LabPoint[]): Record<string, number> {
  const risks: Record<string, number> = {
    liver: 0, kidney: 0, glucose: 0, lipids: 0, hormones: 0
  };

  labs.forEach(l => {
    const v = l.value;
    const code = l.code.toUpperCase();
    if (['ALT','AST','GGT'].includes(code) && v > 40) risks.liver += 1;
    if (code === 'GFR' && v < 90) risks.kidney += (100 - v) / 20;
    if (code === 'GLUCOSE' && v > 5.5) risks.glucose += 2;
    if (code === 'LDL' && v > 3.0) risks.lipids += v / 50;
    if (code === 'PROLACTIN' && v > 400) risks.hormones += v / 100;
  });

  return {
    liver: Math.min(100, risks.liver * 10),
    kidney: Math.min(100, risks.kidney),
    glucose: Math.min(100, risks.glucose * 25),
    lipids: Math.min(100, risks.lipids),
    hormones: Math.min(100, risks.hormones)
  };
}