// ── Score Labs Engine — анализ лабораторных маркеров по ТЗ-логике ──
// Risk_total = Σ(Deviation_i * Weight_i)

import { LAB_PANELS, type LabPanelMarker } from '../data/labs-phase-panels';
import type { ModuleSystemScore, ModuleResult } from './score-engine';

// ─── Types ───

export interface LabInput {
  markers: Array<{ id: string; value: number }>;
  weight: number;
  age: number;
  sex: 'male' | 'female';
}

interface MarkerResult {
  id: string;
  label: string;
  value: number;
  refLow: number;
  refHigh: number;
  unit: string;
  deviation: number;
  status: 'low' | 'normal' | 'high';
  system: string;
}

// Marker → system mapping
const MARKER_SYSTEM: Record<string, string> = {
  // CBC → hematologic
  hgb: 'hematologic', hct: 'hematologic', rbc: 'hematologic', wbc: 'immunity', plt: 'hematologic',
  // Liver → hepatic
  alt: 'hepatic', ast: 'hepatic', ggt: 'hepatic', alp: 'hepatic', bilirubin_total: 'hepatic',
  bilirubin_direct: 'hepatic', ldg: 'hepatic',
  // Kidney → renal
  creatinine: 'renal', urea: 'renal', uric_acid: 'renal', gfr: 'renal',
  // Lipids → cardio
  total_cholesterol: 'cardio', ldl: 'cardio', hdl: 'cardio', triglycerides: 'cardio',
  // Hormones → endocrine / reproductive
  testosterone_total: 'endocrine', testosterone_free: 'endocrine', estradiol: 'endocrine',
  shbg: 'endocrine', lh: 'endocrine', fsh: 'endocrine', prolactin: 'reproductive',
  progesterone: 'endocrine', cortisol: 'endocrine',
  // Thyroid → endocrine
  tsh: 'endocrine', ft3: 'endocrine', ft4: 'endocrine',
  // Glucose → metabolic / endocrine
  glucose: 'endocrine', insulin: 'endocrine', hba1c: 'endocrine',
  // Electrolytes → cardio / renal
  sodium: 'cardio', potassium: 'cardio', calcium: 'cardio', magnesium: 'cardio',
  // Iron → hematologic
  ferritin: 'hematologic', iron: 'hematologic', transferrin: 'hematologic',
  // Vitamins → immunity / neuro
  vitamin_d: 'immunity', vitamin_b12: 'neuro', folate: 'neuro',
  // Prostate → reproductive
  psa: 'reproductive',
};

const SYSTEM_LABELS_RU: Record<string, { label: string; icon: string }> = {
  cardio: { label: 'Сердечно-сосудистая', icon: '❤️' },
  hepatic: { label: 'Печень', icon: '🫁' },
  renal: { label: 'Почки', icon: '🫘' },
  neuro: { label: 'Нервная система', icon: '🧠' },
  endocrine: { label: 'Эндокринная', icon: '⚧' },
  hematologic: { label: 'Гематология', icon: '🩸' },
  immunity: { label: 'Иммунитет', icon: '🛡️' },
  reproductive: { label: 'Репродуктивная', icon: '🔬' },
};

const SYSTEM_WEIGHTS: Record<string, number> = {
  hepatic: 1.5, cardio: 1.4, renal: 1.3, endocrine: 1.2,
  hematologic: 1.1, immunity: 1.0, reproductive: 1.0, neuro: 0.9,
};

function findRef(id: string): { refLow: number; refHigh: number; unit: string; label: string } | null {
  for (const panel of Object.values(LAB_PANELS)) {
    for (const m of panel.markers) {
      if (m.id === id) return { refLow: m.ref[0], refHigh: m.ref[1], unit: m.unit, label: m.label };
    }
  }
  return null;
}

export function analyzeLabs(input: LabInput): ModuleResult {
  const { markers, weight, age, sex } = input;

  // Phase 1: Calculate deviation for each marker (TZ: Risk_factor_i)
  const results: MarkerResult[] = [];
  for (const m of markers) {
    const ref = findRef(m.id);
    if (!ref) continue;
    let deviation = 0;
    let status: 'low' | 'normal' | 'high' = 'normal';
    if (m.value < ref.refLow) {
      deviation = ((ref.refLow - m.value) / ref.refLow) * 100;
      status = 'low';
    } else if (m.value > ref.refHigh) {
      deviation = ((m.value - ref.refHigh) / ref.refHigh) * 100;
      status = 'high';
    }
    results.push({
      id: m.id, label: ref.label, value: m.value,
      refLow: ref.refLow, refHigh: ref.refHigh,
      unit: ref.unit, deviation: Math.round(deviation), status, system: MARKER_SYSTEM[m.id] || 'hematologic',
    });
  }

  // Phase 2: Aggregate deviations per system (TZ: Σ(Risk_factor_i * Weight_i))
  const systemScores: Record<string, { totalDev: number; markers: MarkerResult[] }> = {};
  for (const r of results) {
    if (r.deviation === 0) continue;
    if (!systemScores[r.system]) systemScores[r.system] = { totalDev: 0, markers: [] };
    systemScores[r.system].totalDev += r.deviation;
    systemScores[r.system].markers.push(r);
  }

  // Phase 3: Build system results
  const systems: ModuleSystemScore[] = [];
  for (const [id, info] of Object.entries(systemScores)) {
    const sysInfo = SYSTEM_LABELS_RU[id] || { label: id, icon: '🔬' };
    const dev = Math.min(info.totalDev, 100);
    const weightFactor = SYSTEM_WEIGHTS[id] || 1;
    const weightedScore = Math.min(100, Math.round(dev * weightFactor));
    let level: 'low' | 'moderate' | 'high' = 'low';
    if (weightedScore >= 60) level = 'high';
    else if (weightedScore >= 30) level = 'moderate';
    systems.push({
      id, label: sysInfo.label, icon: sysInfo.icon,
      rawScore: Math.round(dev),
      weightedScore,
      level,
      coverage: 0, afterSupport: weightedScore, reduction: 0,
    });
  }

  systems.sort((a, b) => b.weightedScore - a.weightedScore);

  const overallRaw = systems.length > 0 ? Math.max(...systems.map(s => s.weightedScore)) : 0;

  // Phase 4: Recommendations
  const recommendations: string[] = [];
  const high = systems.filter(s => s.weightedScore >= 60);
  const moderate = systems.filter(s => s.weightedScore >= 30 && s.weightedScore < 60);
  if (high.length > 0) {
    recommendations.push(`⚠ Критические отклонения в ${high.length} системах: ${high.map(s => s.label).join(', ')}. Требуется коррекция.`);
  }
  if (moderate.length > 0) {
    recommendations.push(`⚡ Отклонения в ${moderate.length} системах: ${moderate.map(s => s.label).join(', ')}. Рекомендован контроль.`);
  }
  if (overallRaw < 30) {
    recommendations.push('✅ Все маркеры в пределах нормы. Регулярный мониторинг — 1 раз в 3 мес.');
  } else {
    recommendations.push(`📅 Следующий контроль — через 4 нед. Всего ${results.length} маркеров проанализировано.`);
  }

  return {
    module: 'labs',
    timestamp: new Date().toISOString(),
    profile: { weight, age, sex },
    systems,
    overallRaw,
    overallAfterSupport: overallRaw,
    recommendations,
    supportCount: 0,
    details: { markersDeviation: results.filter(r => r.deviation > 0).length, total: results.length, markers: results },
  };
}

export function generateLabsReport(result: ModuleResult): string {
  let text = `🧪 АНАЛИЗ ЛАБОРАТОРНЫХ ПОКАЗАТЕЛЕЙ\n`;
  text += `${'═'.repeat(40)}\n`;
  text += `📅 ${new Date(result.timestamp).toLocaleString('ru-RU')}\n`;
  text += `👤 ${result.profile.weight}кг · ${result.profile.age}лет · ${result.profile.sex === 'male' ? 'М' : 'Ж'}\n\n`;

  const details = result.details as any;
  const markers: MarkerResult[] = details?.markers || [];

  const deviated = markers.filter(m => m.deviation > 0);
  if (deviated.length > 0) {
    text += `⚠ ОТКЛОНЕНИЯ (${deviated.length}/${markers.length})\n`;
    for (const m of deviated) {
      const dir = m.status === 'high' ? '↑' : '↓';
      text += `  ${dir} ${m.label}: ${m.value} ${m.unit} [норма ${m.refLow}-${m.refHigh}] (${m.deviation}%)\n`;
    }
    text += '\n';
  }

  text += `📊 СИСТЕМЫ\n`;
  for (const s of result.systems) {
    const icon = s.level === 'high' ? '🔴' : s.level === 'moderate' ? '🟡' : '🟢';
    const sysMarkers = markers.filter(m => m.system === s.id && m.deviation > 0);
    text += `  ${icon} ${s.icon} ${s.label}: ${s.weightedScore}%\n`;
    for (const m of sysMarkers) {
      text += `    · ${m.label}: ${m.value} [${m.refLow}-${m.refHigh}] ${m.unit}\n`;
    }
  }
  text += '\n';

  text += `💡 РЕКОМЕНДАЦИИ\n`;
  for (const r of result.recommendations) text += `  • ${r}\n`;

  text += `\n${'═'.repeat(40)}\n✅ Score Labs Engine v2`;
  return text;
}
