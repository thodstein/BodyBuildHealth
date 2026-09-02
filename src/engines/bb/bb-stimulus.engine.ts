/**
 * bb-stimulus.engine.ts — Качество стимула ББ (lengthened/pattern/compound/BFR).
 * Читает BBPlan.weeks -> analyzeBBBalance, не пересчитывает баланс заново.
 */
import type { BBPlan } from './bb-builder.engine';
import { analyzeBBBalance, type BBBalanceReport } from './bb-balance.engine';

export interface BBStimulusResult {
  byMuscle: Record<string, { lengthened: number; midRange: number; shortened: number; compound: number; isolation: number; patterns: Record<string, number> }>;
  global: { lengthened: number; midRange: number; shortened: number; compound: number; isolation: number; patterns: Record<string, number> };
  issues: string[];
  bfrEligible: string[]; // мышцы где применим BFR (памп-изо, RIR при ~≥3)
  scorePenalty: number; // 0-30 для RSS
}

export function analyzeBBStimulus(plan: BBPlan | null | undefined): BBStimulusResult {
  if (!plan || !Array.isArray((plan as any).weeks) || (plan as any).weeks.length === 0) {
    return { byMuscle: {}, global: { lengthened: 0, midRange: 0, shortened: 0, compound: 0, isolation: 0, patterns: {} }, issues: [], bfrEligible: [], scorePenalty: 0 };
  }
  let balance: BBBalanceReport;
  try {
    balance = analyzeBBBalance(plan as any);
  } catch {
    return { byMuscle: {}, global: { lengthened: 0, midRange: 0, shortened: 0, compound: 0, isolation: 0, patterns: {} }, issues: [], bfrEligible: [], scorePenalty: 0 };
  }
  const issues: string[] = [];
  let penalty = 0;

  // Глобальные флаги уже в balance.issues — используем как есть, но не дублируем дословно
  // Добавляем агрегированные
  if (balance.lengthened === 0 && balance.midRange > 0) { penalty += 12; }
  if (balance.shortened === 0 && balance.midRange > 0) { penalty += 6; }

  // Per-muscle
  for (const [muscle, cov] of Object.entries(balance.byMuscle)) {
    const total = cov.compound + cov.isolation;
    if (total >= 6 && cov.lengthened === 0) {
      issues.push(`${muscle}: нет растянутой позиции при ${total} сетов`);
      penalty += 6;
    }
    if (total >= 6 && Object.keys(cov.patterns).length === 1) {
      const pat = Object.keys(cov.patterns)[0];
      const cnt = Object.values(cov.patterns)[0] as number;
      if (cnt >= 4) {
        issues.push(`${muscle}: один паттерн «${pat}» ${cnt} сетов — добавьте угол`);
        penalty += 6;
      }
    }
    const isolationDominant = new Set(['biceps', 'triceps', 'forearms', 'calves', 'abs', 'shoulders', 'delt_front', 'delt_mid', 'delt_rear', 'traps', 'glutes']).has(muscle);
    if (!isolationDominant && total >= 6 && cov.compound < total * 0.4) {
      issues.push(`${muscle}: база ${cov.compound}/${total} <40%`);
      penalty += 8;
    }
  }

  // BFR eligibility: памп-мышцы где много изоляции и средний RIR ≥2.5
  const bfrEligible: string[] = [];
  // эвристика: икры/предплечья/биц/триц при изоляции ≥4 и lengthened+shortened есть
  for (const [m, cov] of Object.entries(balance.byMuscle)) {
    if (['calves', 'forearms', 'biceps', 'triceps'].includes(m) && cov.isolation >= 4) {
      bfrEligible.push(m);
    }
  }

  // Кап penalty
  penalty = Math.min(30, penalty);

  // Переиспользуем balance.byMuscle как byMuscle
  return {
    byMuscle: balance.byMuscle,
    global: { lengthened: balance.lengthened, midRange: balance.midRange, shortened: balance.shortened, compound: balance.compound, isolation: balance.isolation, patterns: balance.patterns },
    issues: [...new Set([...balance.issues.slice(0, 8), ...issues])].slice(0, 12),
    bfrEligible,
    scorePenalty: penalty,
  };
}
