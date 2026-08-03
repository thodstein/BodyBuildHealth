/**
 * Risk-driven supplement stack builder.
 *
 * This module deliberately does not prescribe medicines. It selects only
 * catalogued support substances, ranks them by the requested risk domain,
 * then applies the shared drug-interaction gate.
 */
import { SUPPORT_CATALOG_DATA } from '../data/support-database';
import { findSupplements } from './supplement-finder.engine';
import { getEvidenceGrade } from './biostack-clinical-v2.engine';
import { getSafeStackRecommendations, optimizeTiming, checkStackToxicity } from './biostack-safety.engine';
import { getCost } from './biostack-budget.engine';

export type SupplementCategory = 'liver' | 'kidney' | 'heart' | 'blood' | 'lipids' | 'bp' | 'cns' | 'joints' | 'prostate' | 'general' | 'sleep';

export interface SupplementRec {
  id: string;
  name: string;
  category: SupplementCategory;
  dosage: string;
  timing: string;
  priority: 'essential' | 'recommended' | 'optional';
  reason: string;
  evidence: string;
  risks: string;
}

export interface StackInput {
  compounds: string[];
  riskLevels: {
    hepatic: 'low' | 'medium' | 'high';
    renal: 'low' | 'medium' | 'high';
    cardiac: 'low' | 'medium' | 'high';
    lipids: 'low' | 'medium' | 'high';
    bp: 'low' | 'medium' | 'high';
    prostate: 'low' | 'medium' | 'high';
    cns: 'low' | 'medium' | 'high';
    blood: 'low' | 'medium' | 'high';
    joints: 'low' | 'medium' | 'high';
  };
  hasOrals: boolean;
  has19nor: boolean;
  hasTren: boolean;
  hasGH: boolean;
  hasInsulin: boolean;
  goal: 'bulk' | 'cut' | 'maintenance' | 'strength';
}

export interface StackOutput {
  essential: SupplementRec[];
  recommended: SupplementRec[];
  optional: SupplementRec[];
  totalMonthlyCost: string;
  summary: string;
}

type Domain = {
  category: SupplementCategory;
  risk: StackInput['riskLevels'][keyof StackInput['riskLevels']];
  organs: string[];
  categories: string[];
  reason: string;
};

const DOMAIN_CONFIG: Array<{ key: keyof StackInput['riskLevels']; category: SupplementCategory; organs: string[]; categories: string[]; reason: string }> = [
  { key: 'hepatic', category: 'liver', organs: ['LIVER', 'GALLBLADDER'], categories: ['hepatoprotector', 'bile_acid', 'antioxidant'], reason: 'Есть печёночный риск или оральные соединения.' },
  { key: 'renal', category: 'kidney', organs: ['KIDNEYS'], categories: ['renoprotector', 'antioxidant'], reason: 'Есть почечный риск или нагрузка от курса.' },
  { key: 'cardiac', category: 'heart', organs: ['HEART', 'VESSELS'], categories: ['cardioprotector', 'fatty_acid', 'antioxidant'], reason: 'Есть сердечно-сосудистый риск.' },
  { key: 'bp', category: 'bp', organs: ['HEART', 'VESSELS'], categories: ['cardioprotector', 'electrolyte'], reason: 'Есть риск повышения давления.' },
  { key: 'lipids', category: 'lipids', organs: ['HEART', 'VESSELS', 'LIVER'], categories: ['fatty_acid', 'lipid', 'cardioprotector'], reason: 'Нужна коррекция липидного профиля.' },
  { key: 'blood', category: 'blood', organs: ['BLOOD', 'VESSELS'], categories: ['hematologic', 'fatty_acid'], reason: 'Есть гематологический риск.' },
  { key: 'cns', category: 'cns', organs: ['BRAIN', 'NERVES'], categories: ['sleep', 'anxiolytic', 'neuroprotector'], reason: 'Есть нагрузка на ЦНС или нарушение сна.' },
  { key: 'joints', category: 'joints', organs: ['JOINTS', 'CARTILAGE', 'BONES'], categories: ['joint', 'anti_inflammatory', 'bone'], reason: 'Есть суставно-связочная нагрузка.' },
  { key: 'prostate', category: 'prostate', organs: ['PROSTATE', 'TESTES'], categories: ['urinary_protector', 'herb'], reason: 'Есть урогенитальный риск.' },
];

const EXCLUDED_CATEGORIES = new Set(['pharma', 'hormonal', 'peptide', 'anabolic', 'marker', 'pde_inhibitor', 'stimulant']);
const RISK_ORDER = { high: 3, medium: 2, low: 1 } as const;

function formatDose(id: string): string {
  const entry = SUPPORT_CATALOG_DATA[id];
  if (!entry?.dosage) return 'Дозировка по инструкции и анализам';
  return `${entry.dosage.mg} мг/сут`;
}

function buildReason(entry: typeof SUPPORT_CATALOG_DATA[string], domain: Domain): string {
  return entry.clinicalEffect || entry.mechanismOfAction || entry.description || domain.reason;
}

function buildRisk(entry: typeof SUPPORT_CATALOG_DATA[string]): string {
  const warnings = [...(entry.contraindications || []), ...(entry.sideEffects || [])].slice(0, 2);
  return warnings.length ? warnings.join('; ') : 'Проверить противопоказания и взаимодействия перед началом.';
}

function selectDomainCandidates(domain: Domain, compounds: string[], used: Set<string>): SupplementRec[] {
  const matches = findSupplements({
    organs: domain.organs,
    categories: domain.categories,
    maxResults: 24,
    excludeIds: [...used],
  });
  const safe = getSafeStackRecommendations(matches.map(m => m.id), compounds).safe;
  const safeSet = new Set(safe.map(id => id.toLowerCase()));
  const timing = optimizeTiming(safe);
  const timingById = new Map(timing.map(item => [item.substanceId.toLowerCase(), item.recommendedTiming]));
  const candidates = matches
    .filter(match => safeSet.has(match.id.toLowerCase()))
    .map(match => {
      const entry = SUPPORT_CATALOG_DATA[match.id];
      if (!entry || entry.category.some(category => EXCLUDED_CATEGORIES.has(category))) return null;
      const grade = getEvidenceGrade(match.id);
      const score = (grade === 'A' ? 30 : grade === 'B' ? 20 : 8) + (entry.tier === 'core' ? 8 : entry.tier === 'standard' ? 4 : 0) + match.relevanceScore;
      return { match, entry, score, grade };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  return candidates.slice(0, 2).map(({ match, entry, grade }) => {
    used.add(match.id);
    return {
      id: match.id,
      name: entry.nameRu || entry.name || match.id,
      category: domain.category,
      dosage: formatDose(match.id),
      timing: timingById.get(match.id.toLowerCase()) || entry.dosage?.timing || 'по инструкции',
      priority: domain.risk === 'high' ? 'essential' : domain.risk === 'medium' ? 'recommended' : 'optional',
      reason: buildReason(entry, domain),
      evidence: `Уровень доказательности BioStack: ${grade}.`,
      risks: buildRisk(entry),
    };
  });
}

export function optimizeStack(input: StackInput): StackOutput {
  const domains: Domain[] = DOMAIN_CONFIG
    .map(config => ({ ...config, risk: input.riskLevels[config.key] }))
    .filter(domain => RISK_ORDER[domain.risk] > 1 || (domain.category === 'liver' && input.hasOrals) || (domain.category === 'cns' && input.hasTren) || (domain.category === 'kidney' && input.hasTren));

  const selected: SupplementRec[] = [];
  const used = new Set<string>();
  for (const domain of domains.sort((a, b) => RISK_ORDER[b.risk] - RISK_ORDER[a.risk])) {
    selected.push(...selectDomainCandidates(domain, input.compounds || [], used));
  }

  // Performance goals may add one non-stimulant recovery/performance candidate,
  // but never turn the plan into a generic catalogue dump.
  if (selected.length < 8 && ['bulk', 'strength'].includes(input.goal)) {
    const candidates = findSupplements({ goal: 'recovery', categories: ['amino', 'recovery', 'mitochondrial'], maxResults: 12, excludeIds: [...used] });
    const safe = getSafeStackRecommendations(candidates.map(c => c.id), input.compounds || []).safe;
    const candidate = candidates.find(c => safe.includes(c.id) && !used.has(c.id));
    const entry = candidate && SUPPORT_CATALOG_DATA[candidate.id];
    if (candidate && entry && !entry.category.some(category => EXCLUDED_CATEGORIES.has(category))) {
      used.add(candidate.id);
      selected.push({
        id: candidate.id, name: entry.nameRu || entry.name || candidate.id, category: 'general',
        dosage: formatDose(candidate.id), timing: entry.dosage?.timing || 'по инструкции', priority: 'optional',
        reason: 'Добавлено только как узкая поддержка восстановления под выбранную цель.',
        evidence: `Уровень доказательности BioStack: ${getEvidenceGrade(candidate.id)}.`, risks: buildRisk(entry),
      });
    }
  }

  const toxicity = checkStackToxicity(selected.map(item => item.id));
  const cost = selected.reduce((sum, item) => sum + getCost(item.id), 0);
  const essential = selected.filter(item => item.priority === 'essential');
  const recommended = selected.filter(item => item.priority === 'recommended');
  const optional = selected.filter(item => item.priority === 'optional');
  const warningSuffix = toxicity.length ? ` Есть ${toxicity.length} дозовых предупреждений.` : '';

  return {
    essential, recommended, optional,
    totalMonthlyCost: `~${Math.round(cost).toLocaleString('ru-RU')} ₽/мес`,
    summary: selected.length
      ? `Собрано ${selected.length} веществ по активным рискам; дубли и небезопасные комбинации исключены.${warningSuffix}`
      : 'По заданным параметрам клинически релевантные добавки не отобраны.',
  };
}
