import { MASTER_DB } from '../core/master-db';
import type { LabPoint, RiskEntry } from '../core/types';

export interface RiskScoreResult {
  organLoad: Record<string, number>; systemLoad: Record<string, number>;
  totalRisk: number; flags: string[]; score: number; risks: RiskEntry[];
}

export function calculateRiskScore(substanceIds: string[], labs: LabPoint[] = []): RiskScoreResult {
  const db = MASTER_DB;
  const organLoad: Record<string, number> = {};
  const systemLoad: Record<string, number> = {};
  const flags: string[] = [];
  const activeRisks: RiskEntry[] = [];

  // Нагрузка от веществ
  substanceIds.forEach(id => {
    const sub = db.substances.find(s => s.id === id);
    if (!sub) return;
    sub.risks?.forEach(r => { organLoad[r] = (organLoad[r] || 0) + 10; });
    // Можно добавить маппинг эффектов на органы, если он есть в базе
  });

  // Корректировка по анализам
  labs.forEach(lab => {
    const dbRisk = db.risks.find(r => r.id.toUpperCase() === lab.code.toUpperCase());
    if (dbRisk && lab.value > 100) { // Условная проверка выхода за норму
      flags.push(`${lab.code} ↑ (${lab.value})`);
      activeRisks.push(dbRisk);
    }
  });

  const totalRisk = Object.values(organLoad).reduce((a, b) => a + b, 0) + activeRisks.length * 10;
  const score = Math.min(100, Math.max(0, 100 - totalRisk));

  return { organLoad, systemLoad, totalRisk, flags, score, risks: activeRisks };
}