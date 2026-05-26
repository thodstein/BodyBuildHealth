import { RiskSystem, GENETIC_MULTIPLIERS, DRUG_THRESHOLDS, RISK_SYSTEMS } from '../core/constants';
import { LabResult } from '../core/types';

export interface RiskInput {
  activeDrugs: Record<string, { dosePerWeek: number }>;
  genetics: Record<string, string>;
  labs: LabResult[];
  nutritionFactor: number; // 0.5 (сильная защита) – 1.5 (отягощение)
  trainingFactor: number;  // 1.0 – 1.5
  supportCoverage: Record<string, number>; // mechId -> coverage 0-1
}

export interface RiskResult {
  systemBreakdown: Record<RiskSystem, { raw: number; net: number }>;
  overallRaw: number;
  overallNet: number;
}

function geometricMean(values: number[]): number {
  if (values.length === 0) return 0;
  const logSum = values.reduce((acc, v) => acc + Math.log(Math.max(0.0001, v)), 0);
  return Math.exp(logSum / values.length) * 100;
}

export function calculateRisks(input: RiskInput): RiskResult {
  const systemBreakdown: Record<RiskSystem, { raw: number; net: number }> = {} as any;
  const overallRawArr: number[] = [];
  const overallNetArr: number[] = [];

  for (const sys of RISK_SYSTEMS) {
    const rawMechs: number[] = [];
    const netMechs: number[] = [];

    for (let m = 1; m <= 7; m++) {
      const mechId = `${sys}_${m}`;
      const baseRisk = 0.12; // Базовый вклад механизма (конфигурируемо)
      
      // ТЗ §13.5: Генетический множитель
      const G = GENETIC_MULTIPLIERS[sys]?.[input.genetics[sys] || 'Val/Val'] || 1.0;
      
      // ТЗ §13.6: Лабораторный множитель (упрощённая нормализация для демо)
      const L = Math.max(1, (input.labs.find(l => l.normalizedValue > 0)?.normalizedValue / 100) || 1);
      
      const N = Math.max(0.5, Math.min(1.5, input.nutritionFactor));
      const T = Math.max(1.0, Math.min(1.5, input.trainingFactor));

      // ТЗ §13.2: Risk = 1 - ∏(1 - baseRisk_i × D_i × G × L × N × T)
      let product = 1;
      for (const [drug, data] of Object.entries(input.activeDrugs)) {
        const cfg = DRUG_THRESHOLDS[drug];
        if (!cfg) continue;
        const D = Math.min(2.0, Math.pow(data.dosePerWeek / cfg.dosePerWeek, 1.2));
        product *= (1 - Math.min(0.99, baseRisk * D * G * L * N * T));
      }

      const raw = Math.max(0, Math.min(100, (1 - product) * 100));
      const coverage = input.supportCoverage[mechId] || 0;
      const net = Math.max(0, raw * (1 - coverage));

      rawMechs.push(raw / 100);
      netMechs.push(net / 100);
    }

    systemBreakdown[sys] = {
      raw: geometricMean(rawMechs),
      net: geometricMean(netMechs)
    };
    overallRawArr.push(systemBreakdown[sys].raw / 100);
    overallNetArr.push(systemBreakdown[sys].net / 100);
  }

  return {
    systemBreakdown,
    overallRaw: geometricMean(overallRawArr),
    overallNet: geometricMean(overallNetArr)
  };
}