// ── Score Engine v2 — TZ-ориентированный движок расчёта рисков/органов/систем/механизмов ──
// Risk_total = Σ(Risk_factor_i * Weight_i)

import { PHARMA_DB } from '../core/pharma-database';
import { SUPPORT_CATALOG_DATA } from '../data/support-catalog-data';
import { INTERACTIONS_DB } from '../data/support-interactions-db';
import { SYNERGY_NETWORK } from '../data/support-synergy-network';

// ─── Shared Module Interface (TZ Pipeline: модули → общий Output) ───

export interface ModuleSystemScore {
  id: string;
  label: string;
  icon: string;
  rawScore: number;
  weightedScore: number;
  level: 'low' | 'moderate' | 'high';
  coverage: number;
  afterSupport: number;
  reduction: number;
}

export interface ModuleResult {
  module: 'support' | 'labs' | 'nutrition' | 'training' | 'pharma';
  timestamp: string;
  profile: { weight: number; age: number; sex: string };
  systems: ModuleSystemScore[];
  overallRaw: number;
  overallAfterSupport: number;
  recommendations: string[];
  supportCount: number;
  details: Record<string, any>;
}

// ─── Types ───

export interface ScoreInput {
  course: Array<{ substanceId: string; dose: number; unit: string; weeks: number }>;
  weight: number;
  age: number;
  sex: 'male' | 'female';
  labs?: Record<string, number>;
  // Cross-module modifiers (TZ: данные из других модулей → коррекция рисков)
  nutritionQuality?: number;  // 0-100: качество питания (ниже → выше риск hepatic/metabolic/cardio)
  trainingLoad?: number;      // 0-100: нагрузка тренинга (выше → выше риск neuro/joint/recovery)
}

export interface SystemRisk {
  id: string;
  label: string;
  icon: string;
  rawScore: number;
  weightedScore: number;
  level: 'low' | 'moderate' | 'high';
  affectedOrgans: string[];
  activeMechanisms: string[];
  coverage: number;
  afterSupport: number;
  reduction: number;
}

export interface OrganImpact {
  id: string;
  name: string;
  stressLevel: number;
  fromSystems: string[];
  protectedBy: string[];
}

export interface MechanismStress {
  code: string;
  label: string;
  stressLevel: number;
  fromSubstances: string[];
  coveredBy: string[];
}

export interface SynergyCheck {
  pair: string;
  type: 'synergy' | 'conflict' | 'caution';
  description: string;
  severity: string;
}

export interface ScoreReport extends ModuleResult {
  module: 'support';
  courseSummary: Array<{ id: string; name: string; dose: string; weeks: number }>;
  systems: SystemRisk[];
  organs: OrganImpact[];
  mechanisms: MechanismStress[];
  synergies: SynergyCheck[];
}

// ─── Constants ───

const SYSTEM_CONFIG: Record<string, { label: string; icon: string; weight: number; organs: string[] }> = {
  cardio: { label: 'Сердечно-сосудистая', icon: '❤️', weight: 1.5, organs: ['heart', 'vessels', 'blood'] },
  hepatic: { label: 'Печень', icon: '🫁', weight: 1.4, organs: ['liver', 'gall_bladder'] },
  renal: { label: 'Почки', icon: '🫘', weight: 1.2, organs: ['kidneys', 'urinary_tract'] },
  neuro: { label: 'Нервная система', icon: '🧠', weight: 1.0, organs: ['brain', 'cns', 'peripheral_nerves'] },
  endocrine: { label: 'Эндокринная', icon: '⚧', weight: 1.3, organs: ['thyroid', 'adrenals', 'hypothalamus', 'pituitary'] },
  hematologic: { label: 'Гематология', icon: '🩸', weight: 1.1, organs: ['bone_marrow', 'blood', 'spleen'] },
  immunity: { label: 'Иммунитет', icon: '🛡️', weight: 1.0, organs: ['thymus', 'lymph_nodes', 'spleen', 'gut_associated_lymphoid'] },
  reproductive: { label: 'Репродуктивная', icon: '🔬', weight: 0.8, organs: ['testes', 'prostate', 'ovaries', 'uterus'] },
};

const ORGANS_RU: Record<string, string> = {
  heart: 'Сердце', vessels: 'Сосуды', blood: 'Кровь',
  liver: 'Печень', gall_bladder: 'Желчный пузырь',
  kidneys: 'Почки', urinary_tract: 'Мочевыводящие пути',
  brain: 'Головной мозг', cns: 'ЦНС', peripheral_nerves: 'Периферические нервы',
  thyroid: 'Щитовидная железа', adrenals: 'Надпочечники', hypothalamus: 'Гипоталамус', pituitary: 'Гипофиз',
  bone_marrow: 'Костный мозг', spleen: 'Селезёнка', thymus: 'Тимус', lymph_nodes: 'Лимфоузлы',
  gut_associated_lymphoid: 'GALT (кишечник)',
  testes: 'Яички', prostate: 'Простата', ovaries: 'Яичники', uterus: 'Матка',
};

const MECHANISMS_RU: Record<string, string> = {
  AR_AGONISM: 'Агонизм андрогенных рецепторов',
  PROTEIN_SYNTHESIS: 'Синтез белка',
  ERYTHROPOIESIS: 'Эритропоэз',
  AROMATIZATION: 'Ароматизация в эстрадиол',
  five_alpha_reduction: '5α-редукция в DHT',
  HCT_IMPACT: 'Повышение гематокрита',
  LIPID_IMPACT: 'Нарушение липидного профиля',
  HEPATOTOXICITY: 'Гепатотоксичность',
  NEURO_TOXICITY: 'Нейротоксичность',
  PROGESTOGENIC: 'Прогестиновая активность',
  ANTIOXIDANT: 'Антиоксидантная защита',
  AMPK_ACTIVATION: 'Активация AMPK',
  NRF2_ACTIVATION: 'Активация Nrf2',
  GLUTATHIONE_SYNTHESIS: 'Синтез глутатиона',
  NMDA_BLOCK: 'NMDA-блокада',
  GABA_MOD: 'ГАМК-модуляция',
  NO_UP: 'Повышение NO',
  B1_BLOCKADE: 'β1-блокада',
  ARB_AGONISM: 'Блокада AT1-рецепторов',
  ELECTRON_TRANSPORT_CHAIN: 'Электрон-транспортная цепь',
  INSULIN_SENSITIVITY: 'Чувствительность к инсулину',
  DOPAMINE_MODULATION: 'Дофаминовая модуляция',
  SEROTONIN_MODULATION: 'Серотониновая модуляция',
  THYROID_STIMULATION: 'Стимуляция щитовидной железы',
  CORTISOL_REGULATION: 'Регуляция кортизола',
};

// Substance → risk factor → system mapping
const PD_TO_SYSTEM: Record<string, string[]> = {
  hepatotoxicity: ['hepatic'],
  lipid_impact: ['cardio'],
  hct_impact: ['hematologic', 'cardio'],
  aromatization: ['endocrine', 'reproductive'],
  neuro_toxicity: ['neuro'],
  progestogenic: ['endocrine', 'reproductive'],
};

const SUPPORT_COVERAGE: Record<string, { systems: string[]; mechanisms: string[]; reduction: number }> = {
  nac: { systems: ['hepatic'], mechanisms: ['GLUTATHIONE_SYNTHESIS', 'ANTIOXIDANT', 'NRF2_ACTIVATION'], reduction: 35 },
  tudca: { systems: ['hepatic'], mechanisms: ['ANTIOXIDANT'], reduction: 30 },
  milk_thistle: { systems: ['hepatic'], mechanisms: ['ANTIOXIDANT'], reduction: 25 },
  alpha_lipoic: { systems: ['hepatic', 'neuro'], mechanisms: ['NRF2_ACTIVATION', 'ANTIOXIDANT'], reduction: 20 },
  telmisartan: { systems: ['cardio', 'renal'], mechanisms: ['ARB_AGONISM'], reduction: 30 },
  nebivolol: { systems: ['cardio'], mechanisms: ['B1_BLOCKADE', 'NO_UP'], reduction: 25 },
  omega3: { systems: ['cardio', 'neuro', 'immunity'], mechanisms: ['ANTIOXIDANT'], reduction: 15 },
  coq10: { systems: ['cardio'], mechanisms: ['ELECTRON_TRANSPORT_CHAIN', 'ANTIOXIDANT'], reduction: 15 },
  magnesium: { systems: ['cardio', 'neuro'], mechanisms: ['NMDA_BLOCK', 'GABA_MOD'], reduction: 15 },
  aspirin_cardio: { systems: ['hematologic'], mechanisms: ['ANTIOXIDANT'], reduction: 20 },
  nattokinase: { systems: ['hematologic'], mechanisms: ['NO_UP'], reduction: 20 },
  anastrozole: { systems: ['endocrine'], mechanisms: ['AROMATIZATION'], reduction: 40 },
  astragalus: { systems: ['renal', 'immunity'], mechanisms: ['ANTIOXIDANT', 'NRF2_ACTIVATION'], reduction: 20 },
  vitamin_d3: { systems: ['immunity', 'endocrine'], mechanisms: [], reduction: 15 },
  zinc: { systems: ['immunity', 'reproductive', 'neuro'], mechanisms: ['ANTIOXIDANT'], reduction: 10 },
  hcg: { systems: ['reproductive'], mechanisms: [], reduction: 30 },
  tamoxifen: { systems: ['reproductive'], mechanisms: [], reduction: 25 },
  l_theanine: { systems: ['neuro'], mechanisms: ['GABA_MOD'], reduction: 15 },
  glycine: { systems: ['neuro'], mechanisms: ['GABA_MOD', 'NMDA_BLOCK'], reduction: 10 },
  vitamin_c: { systems: ['immunity'], mechanisms: ['ANTIOXIDANT'], reduction: 10 },
};

// ─── Core Functions ───

function getPdValue(entry: any, field: string): number {
  if (!entry?.pd) return 0;
  return entry.pd[field] ?? 0;
}

function getSystemRiskScore(substances: any[], system: string, age: number): { raw: number; organs: string[]; mechanisms: string[] } {
  const config = SYSTEM_CONFIG[system];
  if (!config) return { raw: 0, organs: [], mechanisms: [] };

  let raw = 0;
  const activeMechanisms = new Set<string>();

  for (const sub of substances) {
    const hep = getPdValue(sub, 'hepatotoxicity');
    const lip = getPdValue(sub, 'lipid_impact');
    const hct = getPdValue(sub, 'hct_impact');
    const arom = getPdValue(sub, 'aromatization');
    const neuro = getPdValue(sub, 'neuro_toxicity');
    const prog = getPdValue(sub, 'progestogenic');

    switch (system) {
      case 'hepatic': raw += hep * 25; if (hep > 0) activeMechanisms.add('HEPATOTOXICITY'); break;
      case 'cardio': {
        const cardRisk = hep * 0.3 + (lip < 0 ? Math.abs(lip) * 15 : 0) + (hct > 2 ? hct * 0.15 * 15 : 0);
        raw += cardRisk;
        if (lip < 0) activeMechanisms.add('LIPID_IMPACT');
        if (hct > 2) activeMechanisms.add('HCT_IMPACT');
        break;
      }
      case 'hematologic': raw += hct * 8; if (hct > 2) activeMechanisms.add('HCT_IMPACT'); break;
      case 'endocrine': {
        raw += arom * 15 + prog * 10;
        if (arom > 0.3) activeMechanisms.add('AROMATIZATION');
        if (prog > 0.3) activeMechanisms.add('PROGESTOGENIC');
        break;
      }
      case 'renal': if (hep > 0) raw += 30; break;
      case 'neuro': raw += neuro * 40; if (neuro > 0) activeMechanisms.add('NEURO_TOXICITY'); break;
      case 'immunity': raw += 20; break;
      case 'reproductive': {
        raw += prog * 20 + (1 - Math.min(arom, 1)) * 10;
        if (prog > 0.3) activeMechanisms.add('PROGESTOGENIC');
        break;
      }
    }
  }

  // Age adjustment for cardio
  if (system === 'cardio' && age > 40) raw *= 1 + (age - 40) * 0.02;

  const score = Math.min(100, Math.max(0, raw));

  return {
    raw: score,
    organs: config.organs,
    mechanisms: Array.from(activeMechanisms),
  };
}

function getLevel(score: number): 'low' | 'moderate' | 'high' {
  if (score >= 60) return 'high';
  if (score >= 30) return 'moderate';
  return 'low';
}

function checkSynergies(supportIds: string[]): SynergyCheck[] {
  const results: SynergyCheck[] = [];
  const upperIds = supportIds.map(i => i.toUpperCase());
  const pairSet = new Set<string>();

  for (const interaction of INTERACTIONS_DB) {
    const a = interaction.substanceA.toUpperCase();
    const b = interaction.substanceB.toUpperCase();
    if (upperIds.includes(a) && upperIds.includes(b)) {
      const key = [a, b].sort().join('+');
      if (!pairSet.has(key)) {
        pairSet.add(key);
        results.push({
          pair: `${interaction.substanceA} + ${interaction.substanceB}`,
          type: interaction.type === 'synergy' ? 'synergy' : interaction.type === 'conflict' ? 'conflict' : 'caution',
          description: interaction.effect,
          severity: interaction.severity,
        });
      }
    }
  }

  for (const entry of SYNERGY_NETWORK) {
    const subs = entry.substances || [entry.a, entry.b, entry.c, entry.d, entry.e, entry.f, entry.g].filter(Boolean) as string[];
    const matchedHere = supportIds.filter(id => subs.map(s => s.toUpperCase()).includes(id.toUpperCase()));
    if (matchedHere.length >= 2) {
      const key = matchedHere.sort().join('+');
      if (!pairSet.has(key)) {
        pairSet.add(key);
        const type: 'synergy' | 'conflict' | 'caution' = entry.type === 'synergy' ? 'synergy' : entry.type === 'conflict' ? 'conflict' : 'caution';
        results.push({ pair: matchedHere.join(' + '), type, description: entry.effect, severity: entry.severity });
      }
    }
  }

  return results;
}

// ─── Main Entry Point ───

export function runScoreAnalysis(input: ScoreInput): ScoreReport {
  const { course, weight, age, sex, nutritionQuality, trainingLoad } = input;

  const dbEntries = course.map(c => PHARMA_DB[c.substanceId] || null).filter(Boolean);

  const courseSummary = course.map(c => ({
    id: c.substanceId,
    name: PHARMA_DB[c.substanceId]?.name || c.substanceId,
    dose: `${c.dose}${c.unit}`,
    weeks: c.weeks,
  }));

  // Phase 1: Calculate risk per system (TZ: Risk_factor_i)
  const systemResults = Object.entries(SYSTEM_CONFIG).map(([id, config]) => {
    const { raw, organs, mechanisms } = getSystemRiskScore(dbEntries, id, age);
    // Apply cross-module modifiers (TZ: внешние факторы → коррекция риска)
    let adjustedRaw = raw;
    if (id === 'hepatic' && nutritionQuality !== undefined && nutritionQuality < 60) {
      adjustedRaw += (60 - nutritionQuality) * 0.3; // Плохое питание → нагрузка на печень
    }
    if (id === 'cardio' && nutritionQuality !== undefined && nutritionQuality < 50) {
      adjustedRaw += (50 - nutritionQuality) * 0.2; // Плохое питание → СС риск
    }
    if (id === 'neuro' && trainingLoad !== undefined && trainingLoad > 50) {
      adjustedRaw += (trainingLoad - 50) * 0.3; // Перетренированность → нейро-риск
    }
    const weightedScore = Math.min(100, adjustedRaw * config.weight);
    return {
      id,
      label: config.label,
      icon: config.icon,
      rawScore: Math.round(adjustedRaw),
      weightedScore: Math.round(weightedScore),
      level: getLevel(weightedScore) as 'low' | 'moderate' | 'high',
      affectedOrgans: organs,
      activeMechanisms: mechanisms,
      coverage: 0,
      afterSupport: Math.round(weightedScore),
      reduction: 0,
    } as SystemRisk;
  });

  // Overall risk (TZ: Risk_total = max of all systems)
  const overallRaw = Math.max(...systemResults.map(s => s.weightedScore), 0);

  // Phase 2: Auto-suggest support substances based on risk thresholds
  const suggestedSubs: string[] = [];
  for (const sys of systemResults) {
    const threshold = sys.id === 'renal' || sys.id === 'immunity' ? 30 : 40;
    if (sys.weightedScore >= threshold) {
      for (const [subId, coverage] of Object.entries(SUPPORT_COVERAGE)) {
        if (coverage.systems.includes(sys.id) && !suggestedSubs.includes(subId)) {
          suggestedSubs.push(subId);
        }
      }
    }
  }

  // Phase 3: Calculate coverage from support substances
  const totalReduction: Record<string, number> = {};
  const coveredMechanisms = new Set<string>();
  for (const subId of suggestedSubs) {
    const info = SUPPORT_COVERAGE[subId];
    if (!info) continue;
    for (const sysId of info.systems) {
      totalReduction[sysId] = (totalReduction[sysId] || 0) + info.reduction;
    }
    for (const mech of info.mechanisms) {
      coveredMechanisms.add(mech);
    }
  }

  // Apply coverage to each system (diminishing returns, max 70% reduction)
  for (const sys of systemResults) {
    const rawReduction = totalReduction[sys.id] || 0;
    const cappedReduction = Math.min(rawReduction * 0.65, 70);
    const after = Math.max(5, Math.round(sys.weightedScore * (1 - cappedReduction / 100)));
    sys.coverage = Math.round(Math.min(cappedReduction, 70));
    sys.afterSupport = after;
    sys.reduction = sys.weightedScore - after;
  }

  const overallAfterSupport = Math.max(...systemResults.map(s => s.afterSupport), 0);

  // Phase 4: Organ impact aggregation
  const organMap = new Map<string, OrganImpact>();
  for (const sys of systemResults) {
    if (sys.weightedScore < 20) continue;
    for (const organId of sys.affectedOrgans) {
      if (!organMap.has(organId)) {
        organMap.set(organId, {
          id: organId,
          name: ORGANS_RU[organId] || organId,
          stressLevel: 0,
          fromSystems: [],
          protectedBy: [],
        });
      }
      const o = organMap.get(organId)!;
      o.stressLevel = Math.max(o.stressLevel, sys.weightedScore);
      if (!o.fromSystems.includes(sys.label)) o.fromSystems.push(sys.label);
    }
  }

  // Phase 5: Mechanism stress
  const mechanismMap = new Map<string, MechanismStress>();
  for (const sub of dbEntries) {
    const pd = sub?.pd || {};
    for (const [key, val] of Object.entries(pd)) {
      if (typeof val === 'number' && val > 0) {
        const code = key.toUpperCase();
        if (!mechanismMap.has(code)) {
          mechanismMap.set(code, {
            code, label: MECHANISMS_RU[code] || code,
            stressLevel: 0, fromSubstances: [], coveredBy: [],
          });
        }
        const m = mechanismMap.get(code)!;
        m.stressLevel = Math.max(m.stressLevel, Math.min(100, val * 50));
        if (!m.fromSubstances.includes(sub?.name || '')) m.fromSubstances.push(sub?.name || '');
      }
    }
  }
  // Mark covered mechanisms
  for (const [code, m] of mechanismMap) {
    if (coveredMechanisms.has(code)) {
      m.coveredBy.push('Поддерживающая терапия');
    }
  }

  // Phase 6: Synergy check
  const synergies = checkSynergies(suggestedSubs);

  // Phase 7: Recommendations
  const recommendations: string[] = [];
  const highSystems = systemResults.filter(s => s.weightedScore >= 60);
  if (highSystems.length > 0) {
    recommendations.push(`⚠ Высокий риск в ${highSystems.length} системах: ${highSystems.map(s => s.label).join(', ')}. Рекомендована полная поддержка.`);
  }
  const moderateSystems = systemResults.filter(s => s.weightedScore >= 30 && s.weightedScore < 60);
  if (moderateSystems.length > 0) {
    recommendations.push(`⚡ Умеренный риск в ${moderateSystems.length} системах: ${moderateSystems.map(s => s.label).join(', ')}.`);
  }
  if (overallRaw < 30) {
    recommendations.push('✅ Риски минимальны. Базовая поддержка (омега-3, магний, витамин D) рекомендуется для профилактики.');
  }
  const conflicts = synergies.filter(s => s.type === 'conflict');
  if (conflicts.length > 0) {
    recommendations.push(`🔴 Обнаружено ${conflicts.length} конфликтов совместимости. Проверьте план.`);
  }

  return {
    module: 'support' as const,
    timestamp: new Date().toISOString(),
    profile: { weight, age, sex },
    courseSummary,
    systems: systemResults,
    organs: Array.from(organMap.values()),
    mechanisms: Array.from(mechanismMap.values()),
    synergies,
    overallRaw: Math.round(overallRaw),
    overallAfterSupport: Math.round(overallAfterSupport),
    supportCount: suggestedSubs.length,
    recommendations,
    details: { courseSummary, organsCount: organMap.size, mechanismsCount: mechanismMap.size, synergiesCount: synergies.length },
  };
}

export function getSuggestedPlan(report: ScoreReport): Array<{ id: string; name: string; dose: string; timing: string }> {
  const suggested: Array<{ id: string; name: string; dose: string; timing: string }> = [];
  const added = new Set<string>();

  for (const sys of report.systems) {
    const threshold = sys.id === 'renal' || sys.id === 'immunity' ? 30 : 40;
    if (sys.weightedScore < threshold) continue;
    for (const [subId, info] of Object.entries(SUPPORT_COVERAGE)) {
      if (info.systems.includes(sys.id) && !added.has(subId)) {
        added.add(subId);
        const catalogEntry = (SUPPORT_CATALOG_DATA as any)?.[subId];
        const name = catalogEntry?.nameRu || PHARMA_DB[subId]?.name || subId;
        const dose = catalogEntry?.dosage?.mg ? `${catalogEntry.dosage.mg} мг` : '—';
        const timing = catalogEntry?.dosage?.timing || '—';
        suggested.push({ id: subId, name, dose, timing: getTimingRu(timing) });
      }
    }
  }

  return suggested;
}

function getTimingRu(t: string): string {
  const m: Record<string, string> = { morning: 'Утро', afternoon: 'День', evening: 'Вечер', night: 'Ночь', fasting: 'Натощак' };
  return m[t.toLowerCase()] || t;
}

export function generateScoreReportText(report: ScoreReport): string {
  let text = `🧬 ПОЛНЫЙ АНАЛИЗ РИСКОВ\n`;
  text += `${'═'.repeat(40)}\n`;
  text += `📅 ${new Date(report.timestamp).toLocaleString('ru-RU')}\n`;
  text += `👤 ${report.profile.weight}кг · ${report.profile.age}лет · ${report.profile.sex === 'male' ? 'М' : 'Ж'}\n\n`;

  text += `📋 КУРС (${report.courseSummary.length} веществ)\n`;
  for (const c of report.courseSummary) text += `  • ${c.name} — ${c.dose} (${c.weeks} нед)\n`;
  text += '\n';

  text += `📊 ОБЩИЙ РИСК: ${report.overallRaw}% → ${report.overallAfterSupport}% (-${report.overallRaw - report.overallAfterSupport > 0 ? report.overallRaw - report.overallAfterSupport : 0}%)\n\n`;

  text += `⚠ СИСТЕМЫ\n`;
  for (const s of report.systems) {
    if (s.weightedScore < 10) continue;
    const icon = s.level === 'high' ? '🔴' : s.level === 'moderate' ? '🟡' : '🟢';
    text += `  ${icon} ${s.icon} ${s.label}: ${s.weightedScore}% → ${s.afterSupport}% (покрытие ${s.coverage}%)\n`;
    if (s.activeMechanisms.length > 0) {
      text += `    · Механизмы: ${s.activeMechanisms.map(m => MECHANISMS_RU[m] || m).join(', ')}\n`;
    }
  }
  text += '\n';

  if (report.organs.length > 0) {
    text += `🔬 ОРГАНЫ ПОД НАГРУЗКОЙ\n`;
    for (const o of report.organs.sort((a, b) => b.stressLevel - a.stressLevel).slice(0, 5)) {
      text += `  • ${o.name} (нагрузка ${o.stressLevel}%, системы: ${o.fromSystems.join(', ')})\n`;
    }
    text += '\n';
  }

  if (report.mechanisms.length > 0) {
    text += `⚙ АКТИВНЫЕ МЕХАНИЗМЫ\n`;
    const stressed = report.mechanisms.filter(m => m.stressLevel > 20);
    for (const m of stressed.slice(0, 5)) {
      const coverage = m.coveredBy.length > 0 ? ' [покрыто]' : '';
      text += `  • ${m.label} (${m.stressLevel}%)${coverage}\n`;
    }
    text += '\n';
  }

  if (report.synergies.length > 0) {
    text += `🔗 СОВМЕСТИМОСТЬ (${report.synergies.length} пар)\n`;
    for (const s of report.synergies) {
      const icon = s.type === 'synergy' ? '🟢' : s.type === 'caution' ? '🟡' : '🔴';
      text += `  ${icon} ${s.pair}: ${s.description}\n`;
    }
    text += '\n';
  }

  text += `💊 ПОДДЕРЖКА: ${report.supportCount} веществ\n`;
  text += `📊 Risk: ${report.overallRaw}% → ${report.overallAfterSupport}%\n\n`;

  for (const rec of report.recommendations) text += `${rec}\n`;

  text += `\n${'═'.repeat(40)}\n`;
  text += `✅ Сгенерировано Score Engine v2`;
  return text;
}
