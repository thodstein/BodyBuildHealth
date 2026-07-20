// ════════════════════════════════════════════════════════════════════════════
//  PROTOCOL VERSION REGISTRY — Единый аудит-след для всех протоколов
//  Импортировать: import { PROTOCOL_VERSIONS } from '../data/protocol-versions';
// ════════════════════════════════════════════════════════════════════════════

export interface ProtocolVersion {
  id: string;
  name: string;
  version: string;
  lastReviewed: string;
  evidenceBase: string[];
  authors: string[];
  reviewCycle: string;
  status: 'active' | 'draft' | 'deprecated';
  clinicalDomain: string[];
}

export const PROTOCOL_VERSIONS: ProtocolVersion[] = [
  {
    id: 'Cardio', name: 'Кардиопротекция (ССС)', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['ESC2023_Hypertension', 'ESC2023_HeartFailure', 'AHA2022_Cardiovascular_Risk', 'EAS2023_Dyslipidemia'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['cardio', 'renal', 'metabolic'],
  },
  {
    id: 'Hepatic', name: 'Гепатопротекция', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['AASLD2023_NAFLD', 'EASL2023_Cholestasis', 'KDIGO2024_CKD_Hepatic'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['hepatic', 'metabolic'],
  },
  {
    id: 'Renal', name: 'Нефропротекция', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['KDIGO2024_CKD', 'ERA2023_Renoprotection'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['renal', 'cardio', 'hematologic'],
  },
  {
    id: 'Neuro', name: 'Нейропротекция', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['AAN2023_Neuroprotection', 'APA2023_Psychopharmacology'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['neuro', 'endocrine', 'metabolic'],
  },
  {
    id: 'Hemato', name: 'Гематопротекция', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['ASH2023_Thrombosis', 'ISTH2023_Anticoagulation', 'WHO2023_Anemia'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['hematologic', 'cardio', 'renal'],
  },
  {
    id: 'E2', name: 'Контроль эстрадиола', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['EndocrineSociety2023_Estrogen', 'ASCO2023_EndocrineTherapy'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['endocrine', 'reproductive', 'cardio'],
  },
  {
    id: 'PostCycle', name: 'ПКТ / восстановление HPTA', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['EndocrineSociety2023_Testosterone', 'AUA2023_Hypogonadism', 'ESHRE2023_Ovulation'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['endocrine', 'reproductive', 'neuro'],
  },
  {
    id: 'Metabolic', name: 'Метаболический контроль', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['ADA2024_Diabetes', 'EASD2023_Insulin_Resistance', 'AACE2023_Obesity'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['metabolic', 'endocrine', 'cardio'],
  },
  {
    id: 'GH', name: 'GH/IGF-1 поддержка', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['EndocrineSociety2023_GH', 'PES2023_GrowthHormone'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['endocrine', 'metabolic', 'hematologic'],
  },
  {
    id: 'Joints', name: 'Суставы / ОДА', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['ACR2023_Osteoarthritis', 'OARSI2023_Joint_Health'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['musculoskeletal'],
  },
  {
    id: 'Thyroid', name: 'Щитовидная железа', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['ATA2023_Thyroid', 'ETA2023_Thyroid_Function'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['endocrine', 'metabolic', 'cardio'],
  },
  {
    id: 'Sleep', name: 'Сон / Циркадные ритмы', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['AASM2023_Sleep', 'SRBR2023_Chronobiology'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['neuro', 'endocrine'],
  },
  {
    id: 'Detox', name: 'Детоксикация', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['AASLD2023_Drug_Induced_Liver_Injury'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['hepatic', 'renal', 'hematologic'],
  },
  {
    id: 'GI', name: 'ЖКТ / Гастропротекция', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['AGA2023_Gastritis', 'WGO2023_Microbiome'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['hepatic', 'hematologic'],
  },
  {
    id: 'Immune', name: 'Иммуномодуляция', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['AAAAI2023_Immunomodulation', 'IUIS2023_Immune_Support'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['hematologic', 'hepatic'],
  },
  {
    id: 'Electrolytes', name: 'Электролитный баланс', version: '2024.07.19', lastReviewed: '2024-07-19',
    evidenceBase: ['KDIGO2024_CKD', 'ESC2023_Hypertension'],
    authors: ['Clinical Pharmacology Review'], reviewCycle: '6_months', status: 'active',
    clinicalDomain: ['renal', 'cardio', 'neuro'],
  },
];

export function getProtocolVersion(id: string): ProtocolVersion | undefined {
  return PROTOCOL_VERSIONS.find(p => p.id.toLowerCase() === id.toLowerCase());
}

export function getActiveProtocols(): ProtocolVersion[] {
  return PROTOCOL_VERSIONS.filter(p => p.status === 'active');
}

export function getProtocolsByDomain(domain: string): ProtocolVersion[] {
  return PROTOCOL_VERSIONS.filter(p => p.clinicalDomain.includes(domain));
}

export function formatProtocolCitation(pv: ProtocolVersion): string {
  return `v${pv.version} | Evidence: ${pv.evidenceBase.join('; ')} | Reviewed: ${pv.lastReviewed}`;
}
