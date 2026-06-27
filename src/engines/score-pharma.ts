// ── Score Pharma Engine — PK/PD анализ фармакологии по ТЗ-логике ──
// Risk_total = Σ(PD_factor_i × Weight_i) + PK_profile

import type { ModuleSystemScore, ModuleResult } from './score-engine';
import { PHARMA_DB } from '../core/pharma-database';

// ─── Types ───

export interface PharmaInput {
  course: Array<{ substanceId: string; dose: number; unit: string; weeks: number; frequencyPerWeek?: number }>;
  weight: number;
  age: number;
  sex: 'male' | 'female';
  labs?: Record<string, number>;
}

interface PDSystemScore {
  id: string;
  label: string;
  icon: string;
  rawScore: number;
}

interface PkProfile {
  substanceId: string;
  name: string;
  halfLifeHours: number;
  bioavailability: number;
  Vd: number;
  steadyStateHours: number;
  eliminationRate: number;
  clearanceNote: string;
}

interface InteractionCheck {
  a: string;
  b: string;
  type: 'synergy' | 'conflict' | 'caution';
  effect: string;
  mechanism: string;
  severity: string;
}

// ─── Constants ───

const PD_SYSTEMS: Record<string, { label: string; icon: string; weight: number }> = {
  cardio: { label: 'Сердечно-сосудистая', icon: '❤️', weight: 1.5 },
  hepatic: { label: 'Печень', icon: '🫁', weight: 1.4 },
  renal: { label: 'Почки', icon: '🫘', weight: 1.2 },
  neuro: { label: 'Нервная система', icon: '🧠', weight: 1.1 },
  endocrine: { label: 'Эндокринная', icon: '⚧', weight: 1.3 },
  hematologic: { label: 'Гематология', icon: '🩸', weight: 1.2 },
  metabolic: { label: 'Метаболизм', icon: '⚡', weight: 1.0 },
  reproductive: { label: 'Репродуктивная', icon: '🔬', weight: 1.1 },
  immunity: { label: 'Иммунитет', icon: '🛡️', weight: 0.9 },
  ghigf: { label: 'GH/IGF-1 ось', icon: '📈', weight: 0.8 },
  ins_axis: { label: 'Инсулиновая ось', icon: '🩸', weight: 1.0 },
  musculoskeletal: { label: 'Костно-мышечная', icon: '💪', weight: 0.7 },
  vessels: { label: 'Сосуды', icon: '🫀', weight: 1.1 },
  blood: { label: 'Кровь', icon: '🩸', weight: 1.0 },
};

// PD field → system score mapping
const PD_FIELD_WEIGHTS: Record<string, { system: string; multiplier: number }> = {
  hepatotoxicity: { system: 'hepatic', multiplier: 25 },
  lipid_impact: { system: 'cardio', multiplier: 20 },
  hct_impact: { system: 'hematologic', multiplier: 8 },
  aromatization: { system: 'endocrine', multiplier: 15 },
  neuro_toxicity: { system: 'neuro', multiplier: 35 },
  progestogenic: { system: 'reproductive', multiplier: 20 },
};

function getPdField(sub: any, field: string): number {
  return sub?.pd?.[field] ?? 0;
}

function findInteractions(courseSubs: any[]): InteractionCheck[] {
  const results: InteractionCheck[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < courseSubs.length; i++) {
    for (let j = i + 1; j < courseSubs.length; j++) {
      const a = courseSubs[i];
      const b = courseSubs[j];
      if (!a || !b) continue;
      // Check conflicts from PHARMA_DB
      const aConflicts = a.conflicts || [];
      const bConflicts = b.conflicts || [];
      for (const c of aConflicts) {
        if (c.with === b.id || c.with === a.id) {
          const key = [a.id, b.id].sort().join('+');
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ a: a.name || a.id, b: b.name || b.id, type: 'conflict', effect: c.effect, mechanism: c.mechanism, severity: c.severity });
          }
        }
      }
      // Check synergies from linkedSubstances
      const aLinked = a.linkedSubstances || [];
      const bLinked = b.linkedSubstances || [];
      for (const ls of aLinked) {
        if (ls.id === b.id && ls.type === 'synergy') {
          const key = [a.id, b.id].sort().join('+');
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ a: a.name || a.id, b: b.name || b.id, type: 'synergy', effect: ls.mechanism, mechanism: ls.mechanism, severity: 'MEDIUM' });
          }
        }
      }
    }
  }
  return results;
}

function calculateSteadyState(halfLifeHours: number): number {
  return Math.round(halfLifeHours * 5); // 5 half-lives to steady state
}

function estimateEliminationRate(halfLifeHours: number): number {
  if (halfLifeHours <= 0) return 0;
  return Math.round((0.693 / halfLifeHours) * 100) / 100;
}

// ─── Main ───

export function analyzePharma(input: PharmaInput): ModuleResult {
  const { course, weight, age, sex } = input;

  const dbEntries: any[] = course.map(c => {
    const entry = PHARMA_DB[c.substanceId];
    if (!entry) return null;
    return { ...entry, dose: c.dose, unit: c.unit, weeks: c.weeks, frequencyPerWeek: c.frequencyPerWeek };
  }).filter((x): x is any => x !== null);

  // Phase 1: PD risk per system (TZ: Risk_factor_i = Σ(PD_field × multiplier))
  const systemScores: Record<string, number> = {};
  for (const sub of dbEntries) {
    for (const [field, cfg] of Object.entries(PD_FIELD_WEIGHTS)) {
      const val = getPdField(sub, field);
      if (val > 0) {
        systemScores[cfg.system] = (systemScores[cfg.system] || 0) + val * cfg.multiplier;
      } else if (val < 0) {
        // Negative = protective (hepatotoxicity: -1 means liver protection)
        systemScores[cfg.system] = (systemScores[cfg.system] || 0) + val * cfg.multiplier * 0.5;
      }
    }
    // Add risks from linkedRisks
    const linkedRisks = sub.linkedRisks || [];
    for (const lr of linkedRisks) {
      if (lr.direction === 'up') {
        systemScores[lr.system] = (systemScores[lr.system] || 0) + lr.strength * 30;
      } else {
        systemScores[lr.system] = (systemScores[lr.system] || 0) - lr.strength * 20;
      }
    }
  }

  // Phase 2: CV profile aggregation
  let bpRisk = 0;
  let hrRisk = 0;
  let thrombRisk = 0;
  for (const sub of dbEntries) {
    const cv = sub.cvProfile;
    if (!cv) continue;
    if (cv.bloodPressure === 'up') bpRisk += 20;
    else if (cv.bloodPressure === 'down') bpRisk -= 10;
    if (cv.heartRate === 'up') hrRisk += 15;
    else if (cv.heartRate === 'down') hrRisk -= 10;
    if (cv.thrombosisRisk === 'high') thrombRisk += 30;
    else if (cv.thrombosisRisk === 'medium') thrombRisk += 15;
  }
  if (bpRisk > 0) systemScores['cardio'] = (systemScores['cardio'] || 0) + Math.min(bpRisk, 40);
  if (hrRisk > 0) systemScores['cardio'] = (systemScores['cardio'] || 0) + Math.min(hrRisk, 30);
  if (thrombRisk > 0) systemScores['hematologic'] = (systemScores['hematologic'] || 0) + Math.min(thrombRisk, 50);

  // Phase 3: Build systems
  const systems: ModuleSystemScore[] = [];
  for (const [id, score] of Object.entries(systemScores)) {
    const cfg = PD_SYSTEMS[id];
    if (!cfg) continue;
    const raw = Math.max(0, Math.min(100, Math.round(score)));
    const weighted = Math.min(100, Math.round(raw * cfg.weight));
    let level: 'low' | 'moderate' | 'high' = 'low';
    if (weighted >= 60) level = 'high';
    else if (weighted >= 30) level = 'moderate';
    systems.push({
      id, label: cfg.label, icon: cfg.icon,
      rawScore: raw, weightedScore: weighted, level,
      coverage: 0, afterSupport: weighted, reduction: 0,
    });
  }

  systems.sort((a, b) => b.weightedScore - a.weightedScore);
  const overallRaw = systems.length > 0 ? Math.max(...systems.map(s => s.weightedScore)) : 0;

  // Phase 4: PK profiles
  const pkProfiles: PkProfile[] = dbEntries.map(sub => ({
    substanceId: sub.id,
    name: sub.name || sub.id,
    halfLifeHours: sub.pk?.halfLifeHours || 0,
    bioavailability: sub.pk?.bioavailability || 0,
    Vd: sub.pk?.Vd || 0,
    steadyStateHours: calculateSteadyState(sub.pk?.halfLifeHours || 0),
    eliminationRate: estimateEliminationRate(sub.pk?.halfLifeHours || 0),
    clearanceNote: sub.pk?.halfLifeHours > 100 ? 'Длительное (накопление)' : sub.pk?.halfLifeHours > 24 ? 'Среднее' : 'Быстрое',
  }));

  // Phase 5: Drug interactions
  const interactions = findInteractions(dbEntries);

  // Phase 6: Recommendations
  const recommendations: string[] = [];
  const high = systems.filter(s => s.weightedScore >= 60);
  const moderate = systems.filter(s => s.weightedScore >= 30 && s.weightedScore < 60);
  if (high.length > 0) {
    recommendations.push(`⚠ Критические PD-риски: ${high.map(s => s.label).join(', ')}. Требуется коррекция курса или поддержка.`);
  }
  if (moderate.length > 0) {
    recommendations.push(`⚡ Умеренные PD-риски: ${moderate.map(s => s.label).join(', ')}. Рекомендован мониторинг + поддержка.`);
  }
  const conflicts = interactions.filter(i => i.type === 'conflict');
  if (conflicts.length > 0) {
    recommendations.push(`🔴 Обнаружено ${conflicts.length} конфликтов взаимодействия: ${conflicts.map(c => `${c.a}+${c.b}`).join(', ')}.`);
  }
  const synergies = interactions.filter(i => i.type === 'synergy');
  if (synergies.length > 0) {
    recommendations.push(`🟢 ${synergies.length} синергетических пар: ${synergies.map(s => `${s.a}+${s.b}`).join(', ')}.`);
  }
  // PK warnings
  const longHl = pkProfiles.filter(p => p.halfLifeHours > 100);
  if (longHl.length > 0) {
    recommendations.push(`⏱ ${longHl.map(p => p.name).join(', ')} — длинный T½ (>100ч), риск накопления. Увеличьте интервал между дозами.`);
  }
  if (overallRaw < 30) {
    recommendations.push('✅ PD-профиль курса в пределах нормы. Стандартный мониторинг 1 раз/мес.');
  }

  return {
    module: 'pharma' as any,
    timestamp: new Date().toISOString(),
    profile: { weight, age, sex },
    systems,
    overallRaw,
    overallAfterSupport: overallRaw,
    recommendations,
    supportCount: 0,
    details: {
      substancesCount: dbEntries.length,
      pkProfiles,
      interactions,
      courseSummary: course.map(c => ({
        id: c.substanceId, name: PHARMA_DB[c.substanceId]?.name || c.substanceId,
        dose: `${c.dose}${c.unit}`, weeks: c.weeks,
      })),
    },
  };
}

export function generatePharmaReport(result: ModuleResult): string {
  let text = `💊 ФАРМАКОЛОГИЧЕСКИЙ АНАЛИЗ (PK/PD)\n`;
  text += `${'═'.repeat(40)}\n`;
  text += `📅 ${new Date(result.timestamp).toLocaleString('ru-RU')}\n`;
  text += `👤 ${result.profile.weight}кг · ${result.profile.age}лет · ${result.profile.sex === 'male' ? 'М' : 'Ж'}\n\n`;

  const d = result.details as any;
  const courseSummary = d?.courseSummary || [];
  const pkProfiles = d?.pkProfiles || [];
  const interactions = d?.interactions || [];

  if (courseSummary.length > 0) {
    text += `📋 КУРС (${courseSummary.length} веществ)\n`;
    for (const c of courseSummary) text += `  • ${c.name} — ${c.dose} (${c.weeks} нед)\n`;
    text += '\n';
  }

  if (pkProfiles.length > 0) {
    text += `⏱ PK-ПРОФИЛЬ\n`;
    for (const p of pkProfiles) {
      text += `  • ${p.name}: T½=${p.halfLifeHours}ч, F=${Math.round(p.bioavailability * 100)}%, Vd=${p.Vd}л, SS=${p.steadyStateHours}ч, выведение: ${p.clearanceNote}\n`;
    }
    text += '\n';
  }

  text += `📊 СИСТЕМЫ (PD)\n`;
  for (const s of result.systems) {
    const icon = s.level === 'high' ? '🔴' : s.level === 'moderate' ? '🟡' : '🟢';
    text += `  ${icon} ${s.icon} ${s.label}: ${s.weightedScore}%\n`;
  }
  text += '\n';

  if (interactions.length > 0) {
    text += `🔗 ВЗАИМОДЕЙСТВИЯ\n`;
    for (const ix of interactions) {
      const icon = ix.type === 'synergy' ? '🟢' : ix.type === 'conflict' ? '🔴' : '🟡';
      text += `  ${icon} ${ix.a} + ${ix.b}: ${ix.effect} [${ix.severity}]\n`;
    }
    text += '\n';
  }

  text += `💡 РЕКОМЕНДАЦИИ\n`;
  for (const r of result.recommendations) text += `  • ${r}\n`;

  text += `\n${'═'.repeat(40)}\n✅ Score Pharma Engine v2`;
  return text;
}
