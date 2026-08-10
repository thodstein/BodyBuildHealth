// ════════════════════════════════════════════════════════════════════════════
//  PED-RISK-MATRIX — оценка риска нейро/суставы по стеку PED
//
//  Источники данных:
//    - Статья «Нейротоксичность ААС» (ТЗ): тренболон = max нейротоксичность,
//      19-нор наиболее опасны для ЦНС, станозолол — tendinopathy.
//    - Суставы.txt (ТЗ): 6-недельный протокол BPC-157+TB-500+GHK-Cu.
//    - pharma-db pd.neuro_toxicity (0-0.6) и COMPOUND_RISK_MAP (tendinopathy).
//
//  Логика:
//    1. Для каждого PED — matching по substring-паттерну ID + pClass fallback
//       (trestolone/superdrol/proviron не распознаются classifyPed — нужны паттерны)
//    2. Дозовые пороги → risk per substance (трен 200мг ≠ трен 800мг)
//    3. Агрегация: max neuro risk, max joints risk
//    4. Компенсация: нандролон + станозолол → joints high→moderate (COLLAGEN_SYNTHESIS)
//    5. Эскалация: 2+ moderate neuro → high; 3+ PED → +1; 19-нор+19-нор → +1 neuro
//    6. riskToTier с учётом SupportLevel
//
//  Tier mapping:
//    high → 3 (LV1+LV2+LV3), moderate → 2 (LV1+LV2), low → 0 (или 1 на max), none → 0
//    protective joints → 0 (защита уже есть, не дублировать)
// ════════════════════════════════════════════════════════════════════════════

import type { PEDDose, PEDClass } from '../data/ped-potency-table';
import { classifyPed } from '../data/ped-potency-table';
import type { SupportLevel } from './tz-bridge-mechanism';
import { getNeuroBoosterSubstanceIds, getJointsBoosterSubstanceIds, getHematoBoosterSubstanceIds } from './tz-bridge-boosters';

export type PedRisk = 'none' | 'low' | 'moderate' | 'high' | 'protective';

export interface PedSubstanceRisk {
  substanceId: string;
  matchedBy: string;
  neuro: PedRisk;
  joints: PedRisk;
  hemato: PedRisk;
  neuroReason?: string;
  jointsReason?: string;
  hematoReason?: string;
  dose: number;
  doseUnit: string;
}

export interface PedRiskAssessment {
  neuroRisk: PedRisk;
  jointsRisk: PedRisk;
  hematoRisk: PedRisk;
  neuroBoosterTier: 0 | 1 | 2 | 3;
  jointsBoosterTier: 0 | 1 | 2 | 3;
  hematoBoosterTier: 0 | 1 | 2 | 3;
  triggeredBy: string[];
  perSubstance: PedSubstanceRisk[];
  // Residual risk fields (заполняются computeResidualRisk)
  grossNeuroTier?: 0 | 1 | 2 | 3;
  grossJointsTier?: 0 | 1 | 2 | 3;
  grossHematoTier?: 0 | 1 | 2 | 3;
  neuroCoverage?: number;
  neuroCovered?: number;
  neuroRecommended?: number;
  jointsCoverage?: number;
  jointsCovered?: number;
  jointsRecommended?: number;
  // Hemato: общий (тромбоз + эритропоэз) — для UI бейджа
  hematoCoverage?: number;
  hematoCovered?: number;
  hematoRecommended?: number;
  // Hemato: разделение на 2 поддомена
  // 1) Эритропоэз (Hct↑) — снижается ТОЛЬКО ↓дозой AAS / телмисартаном / эритроцитаферезом
  erythropoiesisCoverage?: number;
  erythropoiesisCovered?: number;
  erythropoiesisRecommended?: number;
  erythropoiesisTier?: 0 | 1 | 2 | 3;  // net tier для эритропоэза
  // 2) Тромбоз (следствие эритроцитоза) — снижается фибринолитиками/антиагрегантами
  thrombosisCoverage?: number;
  thrombosisCovered?: number;
  thrombosisRecommended?: number;
  thrombosisTier?: 0 | 1 | 2 | 3;  // net tier для тромбоза
}

// ────────────────────────────────────────────────────────────────────────────
//  Дозозависимые правила
//  maxDose — верхняя граница (Infinity для последнего tier)
//  Дозы AAS — mg/week (с нормализацией: oral <100 → ×7, предполагаем дневную)
//  Дозы GH — IU/day, IGF/clen/T3 — mcg/day
// ────────────────────────────────────────────────────────────────────────────

interface DoseTier {
  maxDose: number;
  neuro: PedRisk;
  joints: PedRisk;
  hemato: PedRisk;
}

interface SubstanceRule {
  patterns: string[];
  pClasses?: PEDClass[];
  doseUnit: 'mgPerWeek' | 'iuPerDay' | 'mcgPerDay' | 'any';
  tiers: DoseTier[];
  neuroReason?: string;
  jointsReason?: string;
  hematoReason?: string;
}

const INF = Infinity;

// AAS — по substring-паттернам ID (надёжнее pClass, т.к. classifyPed
// не распознаёт trestolone/superdrol/proviron)
const AAS_RULES: SubstanceRule[] = [
  // ── Тренболон (19-нор, MAX нейротоксичность по статье) ──
  {
    patterns: ['tren', 'parabolan'],
    pClasses: ['aas_tren'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: 300,  neuro: 'moderate', joints: 'low',      hemato: 'moderate' },
      { maxDose: 600,  neuro: 'high',     joints: 'low',      hemato: 'moderate' },
      { maxDose: INF,  neuro: 'high',     joints: 'low',      hemato: 'high' },
    ],
    neuroReason: 'Тренболон — максимальная нейротоксичность (статья: рост нейритов ↓↓, 19-нор)',
    hematoReason: 'Тренболон ≥500 мг — стимуляция эритропоэза (HIF-1α)',
  },
  // ── Нандролон (19-нор, moderate нейро, PROTECTIVE суставы) ──
  {
    patterns: ['nandrolone', 'deca', 'npp'],
    pClasses: ['aas_nandrolone'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: 400,  neuro: 'low',       joints: 'protective', hemato: 'moderate' },
      { maxDose: INF,  neuro: 'moderate',  joints: 'protective', hemato: 'high' },
    ],
    neuroReason: 'Нандролон (19-нор) — moderate нейро при высоких дозах',
    jointsReason: '↑ COLLAGEN_SYNTHESIS, укрепление суставов/связок',
    hematoReason: 'Нандролон ≥300 мг — выраженный ЭПО-эффект (HIF-1α)',
  },
  // ── Трестолон / MENT (19-нор, progestogenic, classifyPed=other) ──
  {
    patterns: ['trest', 'ment'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: 300,  neuro: 'moderate', joints: 'low', hemato: 'moderate' },
      { maxDose: INF,  neuro: 'high',     joints: 'low', hemato: 'high' },
    ],
    neuroReason: 'Трестолон (MENT, 19-нор) — progestogenic, нейротоксичность',
    hematoReason: 'Трестолон — стимуляция эритропоэза (19-нор, progestogenic)',
  },
  // ── Станозолол (tendinopathy, дегенерация коллагена) ──
  {
    patterns: ['stan', 'winstrol', 'winny', 'stanozolol'],
    pClasses: ['aas_oral_winny'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: 210,  neuro: 'low',  joints: 'moderate', hemato: 'moderate' },
      { maxDose: INF,  neuro: 'low',  joints: 'high',     hemato: 'high' },
    ],
    neuroReason: undefined,
    jointsReason: 'Станозолол — tendinopathy, дегенерация коллагена сухожилий',
    hematoReason: 'Станозолол — стимуляция эритропоэза + ↑факторы свёртывания',
  },
  // ── Halotestin (neurotoxicity + tendinopathy) ──
  {
    patterns: ['halo', 'halotestin', 'fluoxymesterone'],
    pClasses: ['aas_oral_halo'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'moderate', joints: 'moderate', hemato: 'high' },
    ],
    neuroReason: 'Halotestin — neurotoxicity (COMPOUND_RISK_MAP)',
    jointsReason: 'Halotestin — tendinopathy (COMPOUND_RISK_MAP)',
    hematoReason: 'Halotestin — выраженный эритропоэз (17α-алкил, DHT-производный)',
  },
  // ── Мастерон / дростанолон (tendinopathy) ──
  {
    patterns: ['masteron', 'drostanolone', 'master'],
    pClasses: ['aas_dht_inject'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'low',  joints: 'moderate', hemato: 'low' },
    ],
    jointsReason: 'Мастерон — tendinopathy (COMPOUND_RISK_MAP pharmaTriggers)',
  },
  // ── Примоболан / метенолон (мягкий) ──
  {
    patterns: ['primobolan', 'methenolone', 'primo'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'low',  joints: 'low', hemato: 'low' },
    ],
  },
  // ── Тестостерон (базовый, дозозависимый) ──
  {
    patterns: ['test', 'testosterone', 'sustanon', 'sust', 'omnadren'],
    pClasses: ['aas_test'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: 500,  neuro: 'low',      joints: 'none', hemato: 'low' },
      { maxDose: 1000, neuro: 'moderate', joints: 'none', hemato: 'moderate' },
      { maxDose: INF,  neuro: 'moderate', joints: 'none', hemato: 'high' },
    ],
    neuroReason: 'Тестостерон ≥500 мг/нед — moderate нейронагрузка',
    hematoReason: 'Тестостерон ≥1000 мг/нед — выраженный эритропоэз (HIF-1α, EPO-независимый)',
  },
  // ── Болденон / DHB (базовый, ВЫРАЖЕННЫЙ ЭПО-эффект) ──
  {
    patterns: ['bold', 'equipoise', 'eq', 'dhb'],
    pClasses: ['aas_bold'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'low',  joints: 'none', hemato: 'high' },
    ],
    hematoReason: 'Болденон — наиболее выраженный ЭПО-эффект среди AAS (HIF-1α, прямой стимул эритропоэза)',
  },
  // ── Метандиенон / dbol (базовый оральный) ──
  {
    patterns: ['dbol', 'dianabol', 'methand', 'methandrostenolone', 'methandienone'],
    pClasses: ['aas_oral_dbol'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'low',  joints: 'none', hemato: 'moderate' },
    ],
    hematoReason: 'Метандиенон ≥30 мг/день — moderate эритропоэз',
  },
  // ── Оксиметолон / anadrol (базовый оральный, MAX эритропоэз) ──
  {
    patterns: ['anadrol', 'oxy', 'oxymeth', 'oxymetholone'],
    pClasses: ['aas_oral_oxy'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'low',  joints: 'none', hemato: 'high' },
    ],
    hematoReason: 'Оксиметолон — клинически применяется при анемии, мощнейший эритропоэз',
  },
  // ── Туранабол (базовый оральный) ──
  {
    patterns: ['tbol', 'turinabol', 'chlorodehydro'],
    pClasses: ['aas_oral_tbol'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'low',  joints: 'none', hemato: 'low' },
    ],
  },
  // ── Оксандролон / anavar (мягкий) ──
  {
    patterns: ['oxan', 'anavar', 'oxandrolone'],
    pClasses: ['aas_oral_anavar'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'low',  joints: 'low', hemato: 'low' },
    ],
  },
  // ── Superdrol / метилдростанолон (нет в potency-table, classifyPed=other) ──
  {
    patterns: ['superdrol', 'methyldrostanolone'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: 140,  neuro: 'moderate', joints: 'none', hemato: 'moderate' },
      { maxDose: INF,  neuro: 'high',     joints: 'none', hemato: 'high' },
    ],
    neuroReason: 'Superdrol — гепатотоксичность MAX 3.5, нейротоксичность',
    hematoReason: 'Superdrol — выраженный эритропоэз (17α-алкил)',
  },
  // ── Methyltestosterone ──
  {
    patterns: ['methyltestosterone'],
    pClasses: ['aas_oral_other'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'moderate', joints: 'none', hemato: 'moderate' },
    ],
  },
  // ── Mibolerone / cheque drops (крайне токсичный, potency 6.0) ──
  {
    patterns: ['mibolerone', 'cheque'],
    pClasses: ['aas_oral_other'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'high',  joints: 'moderate', hemato: 'high' },
    ],
    neuroReason: 'Mibolerone — potency 6.0, крайне токсичный',
    jointsReason: 'Mibolerone — tendinopathy',
    hematoReason: 'Mibolerone — крайне выраженный эритропоэз',
  },
  // ── Methyltrienolone (neurotoxicity в COMPOUND_RISK_MAP) ──
  {
    patterns: ['methyltrienolone', 'metribolone'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'high',  joints: 'low', hemato: 'high' },
    ],
    neuroReason: 'Methyltrienolone — neurotoxicity (COMPOUND_RISK_MAP)',
    hematoReason: 'Methyltrienolone — выраженный эритропоэз (19-нор)',
  },
  // ── Провирон / местеролон (не AAS по classifyPed, нейро=0) ──
  {
    patterns: ['proviron', 'mesterolone'],
    doseUnit: 'mgPerWeek',
    tiers: [
      { maxDose: INF,  neuro: 'none',  joints: 'none', hemato: 'none' },
    ],
  },
];

// SARMs
const SARM_RULES: SubstanceRule[] = [
  {
    patterns: ['rad140', 'testolone'],
    pClasses: ['sarm'],
    doseUnit: 'any',
    tiers: [{ maxDose: INF, neuro: 'moderate', joints: 'none', hemato: 'none' }],
    neuroReason: 'RAD-140 — дофаминовый дисбаланс (DRUG_THRESHOLDS_V7 neuro{1:0.15})',
  },
  {
    patterns: ['s23'],
    doseUnit: 'any',
    tiers: [{ maxDose: INF, neuro: 'moderate', joints: 'none', hemato: 'none' }],
    neuroReason: 'S-23 — самый агрессивный SARM, нейротоксичность 0.08',
  },
  {
    patterns: ['lgd', 'ligandrol', 'lgd4033', 'lgd-4033'],
    doseUnit: 'any',
    tiers: [{ maxDose: INF, neuro: 'low', joints: 'none', hemato: 'none' }],
  },
  {
    patterns: ['ostarine', 'mk2866', 'enobosarm'],
    doseUnit: 'any',
    tiers: [{ maxDose: INF, neuro: 'low', joints: 'protective', hemato: 'none' }],
    jointsReason: 'Ostarine — терапевтически применяется для суставов/связок',
  },
  {
    patterns: ['andarine', 's4'],
    doseUnit: 'any',
    tiers: [{ maxDose: INF, neuro: 'low', joints: 'none', hemato: 'none' }],
  },
  {
    patterns: ['sr9009', 'stenabolic'],
    doseUnit: 'any',
    tiers: [{ maxDose: INF, neuro: 'none', joints: 'none', hemato: 'none' }],
  },
  {
    patterns: ['gw501516', 'cardarine'],
    doseUnit: 'any',
    tiers: [{ maxDose: INF, neuro: 'none', joints: 'none', hemato: 'none' }],
  },
];

// Пептиды / GH
const PEPTIDE_RULES: SubstanceRule[] = [
  // GH (somatropin) — tunnel_syndrome, дозозависимый
  {
    patterns: ['somatropin', 'hgh', 'gh_iu', 'ghiu'],
    pClasses: ['gh'],
    doseUnit: 'iuPerDay',
    tiers: [
      { maxDose: 4,  neuro: 'low',      joints: 'moderate', hemato: 'none' },
      { maxDose: 8,  neuro: 'low',      joints: 'high',     hemato: 'none' },
      { maxDose: INF, neuro: 'moderate', joints: 'high',     hemato: 'none' },
    ],
    jointsReason: 'GH — туннельный синдром (tunnel_syndrome, COMPOUND_RISK_MAP)',
    neuroReason: 'GH >8 IU — нейроэндокринная нагрузка',
  },
  // IGF-1
  {
    patterns: ['igf1', 'igf-1', 'igf1_lr3', 'igf1_des'],
    pClasses: ['igf'],
    doseUnit: 'mcgPerDay',
    tiers: [{ maxDose: INF, neuro: 'low', joints: 'moderate', hemato: 'none' }],
    jointsReason: 'IGF-1 — tunnel_syndrome (COMPOUND_RISK_MAP)',
  },
  // MGF
  {
    patterns: ['mgf'],
    pClasses: ['mgf'],
    doseUnit: 'mcgPerDay',
    tiers: [{ maxDose: INF, neuro: 'low', joints: 'moderate', hemato: 'none' }],
    jointsReason: 'MGF — аналог IGF-1, tunnel_syndrome',
  },
  // GHRP (ghrp6, ghrp2, ipamorelin) — neurotoxicity + tunnel
  {
    patterns: ['ghrp', 'ipamorelin'],
    doseUnit: 'any',
    tiers: [{ maxDose: INF, neuro: 'moderate', joints: 'moderate', hemato: 'none' }],
    neuroReason: 'GHRP — neurotoxicity (COMPOUND_RISK_MAP)',
    jointsReason: 'GHRP — tunnel_syndrome (COMPOUND_RISK_MAP)',
  },
  // GHRH (cjc1295)
  {
    patterns: ['cjc1295', 'cjc', 'ghrh'],
    doseUnit: 'any',
    tiers: [{ maxDose: INF, neuro: 'low', joints: 'moderate', hemato: 'none' }],
    jointsReason: 'GHRH — tunnel_syndrome (COMPOUND_RISK_MAP)',
  },
  // MK-677 (GHRP-аналог per os)
  {
    patterns: ['mk677', 'mk-677', 'ibutamoren'],
    doseUnit: 'any',
    tiers: [{ maxDose: INF, neuro: 'low', joints: 'moderate', hemato: 'none' }],
    jointsReason: 'MK-677 — GHRP-аналог, tunnel_syndrome',
  },
];

const ALL_RULES: SubstanceRule[] = [...AAS_RULES, ...SARM_RULES, ...PEPTIDE_RULES];

// ────────────────────────────────────────────────────────────────────────────
//  Вспомогательные функции
// ────────────────────────────────────────────────────────────────────────────

/** Нормализация дозы: oral AAS при mgPerWeek<100 — скорее всего дневная доза → ×7 */
function normalizeDose(ped: PEDDose, rule: SubstanceRule): { dose: number; unit: string } {
  if (rule.doseUnit === 'iuPerDay') {
    return { dose: ped.iuPerDay ?? 0, unit: 'IU/день' };
  }
  if (rule.doseUnit === 'mcgPerDay') {
    return { dose: ped.mcgPerDay ?? 0, unit: 'мкг/день' };
  }
  if (rule.doseUnit === 'any') {
    return { dose: 0, unit: '—' };
  }
  // mgPerWeek
  let mg = ped.mgPerWeek ?? 0;
  if (ped.form === 'oral' && mg > 0 && mg < 100) {
    mg = mg * 7;
  }
  return { dose: mg, unit: 'мг/нед' };
}

/** Поиск правила по ID (substring) с fallback на pClass */
function findRule(ped: PEDDose): { rule: SubstanceRule; matchedBy: string } | null {
  const id = (ped.id || '').toLowerCase();
  // 1. По substring-паттернам
  for (const rule of ALL_RULES) {
    for (const pat of rule.patterns) {
      if (id.includes(pat)) {
        return { rule, matchedBy: `pattern:'${pat}'` };
      }
    }
  }
  // 2. Fallback по pClass
  if (ped.pClass) {
    for (const rule of ALL_RULES) {
      if (rule.pClasses?.includes(ped.pClass)) {
        return { rule, matchedBy: `pClass:'${ped.pClass}'` };
      }
    }
  }
  return null;
}

/** Применить дозовый tier */
function applyDoseTier(rule: SubstanceRule, dose: number): { neuro: PedRisk; joints: PedRisk; hemato: PedRisk } {
  for (const tier of rule.tiers) {
    if (dose <= tier.maxDose) {
      return { neuro: tier.neuro, joints: tier.joints, hemato: tier.hemato };
    }
  }
  // fallback — последний tier
  const last = rule.tiers[rule.tiers.length - 1];
  return { neuro: last.neuro, joints: last.joints, hemato: last.hemato };
}

const RISK_ORDER: Record<PedRisk, number> = {
  none: 0, low: 1, moderate: 2, high: 3, protective: 4,
};

/** max risk (protective считается как moderate для neuro, но для joints — отдельная логика) */
function maxNeuroRisk(a: PedRisk, b: PedRisk): PedRisk {
  // protective для neuro не имеет смысла, трактуем как none
  const an = a === 'protective' ? 'none' : a;
  const bn = b === 'protective' ? 'none' : b;
  return RISK_ORDER[an] >= RISK_ORDER[bn] ? an : bn;
}

function maxJointsRisk(a: PedRisk, b: PedRisk): PedRisk {
  // protective > high по приоритету (защита сильнее риска),
  // но для aggregating joints risk мы хотим max "угрозы", не "защиты"
  // Поэтому: если хотя бы один high → high; если есть moderate и нет protective → moderate
  if (a === 'high' || b === 'high') return 'high';
  if (a === 'protective' && b === 'protective') return 'protective';
  if (a === 'protective' || b === 'protective') {
    // один protective, другой moderate/low/none → частичная защита
    const other = a === 'protective' ? b : a;
    if (other === 'moderate') return 'moderate';
    if (other === 'low') return 'low';
    return 'protective'; // protective + none → protective (защита есть, рисков нет)
  }
  const ao = a; const bo = b;
  return RISK_ORDER[ao] >= RISK_ORDER[bo] ? ao : bo;
}

/** max hemato risk (protective трактуем как none — для гемато нет protective веществ) */
function maxHematoRisk(a: PedRisk, b: PedRisk): PedRisk {
  const an = a === 'protective' ? 'none' : a;
  const bn = b === 'protective' ? 'none' : b;
  return RISK_ORDER[an] >= RISK_ORDER[bn] ? an : bn;
}

/** risk → tier с учётом SupportLevel */
function riskToTier(risk: PedRisk, level: SupportLevel, domain: 'neuro' | 'joints' | 'hemato'): 0 | 1 | 2 | 3 {
  if (risk === 'protective') return 0; // защита уже есть
  if (risk === 'high') return 3;
  if (risk === 'moderate') return 2;
  if (risk === 'low') {
    // на max — принудительная базовая защита
    if (level === 'max') return 1;
    return 0;
  }
  // none
  if (level === 'max') return 1;
  return 0;
}

// ────────────────────────────────────────────────────────────────────────────
//  Главная функция: assessPedRisk
// ────────────────────────────────────────────────────────────────────────────

export function assessPedRisk(
  pedDoses: PEDDose[],
  level: SupportLevel = 'medium'
): PedRiskAssessment {
  if (!pedDoses || pedDoses.length === 0) {
    return {
      neuroRisk: 'none',
      jointsRisk: 'none',
      hematoRisk: 'none',
      neuroBoosterTier: level === 'max' ? 1 : 0,
      jointsBoosterTier: level === 'max' ? 1 : 0,
      hematoBoosterTier: level === 'max' ? 1 : 0,
      triggeredBy: [],
      perSubstance: [],
    };
  }

  // 1. Оценка каждого PED
  const perSubstance: PedSubstanceRisk[] = [];
  let aggNeuro: PedRisk = 'none';
  let aggJoints: PedRisk = 'none';
  let aggHemato: PedRisk = 'none';
  let hasNandrolone = false;
  let hasWinny = false;
  let nineteenNorCount = 0; // трен + нандролон + трестолон
  let moderateNeuroCount = 0;
  let moderateHematoCount = 0;

  for (const ped of pedDoses) {
    const found = findRule(ped);
    if (!found) continue;
    const { rule, matchedBy } = found;
    const { dose, unit } = normalizeDose(ped, rule);
    const { neuro, joints, hemato } = applyDoseTier(rule, dose);

    perSubstance.push({
      substanceId: ped.id,
      matchedBy,
      neuro,
      joints,
      hemato,
      neuroReason: rule.neuroReason,
      jointsReason: rule.jointsReason,
      hematoReason: rule.hematoReason,
      dose,
      doseUnit: unit,
    });

    aggNeuro = maxNeuroRisk(aggNeuro, neuro);
    aggJoints = maxJointsRisk(aggJoints, joints);
    aggHemato = maxHematoRisk(aggHemato, hemato);

    // Маркеры для компенсации/эскалации
    if (rule.patterns.some(p => 'nandrolone'.includes(p) || p === 'deca' || p === 'npp' || p === 'nandrolone')) {
      if (joints === 'protective') hasNandrolone = true;
    }
    if (rule.patterns.some(p => p === 'stan' || p === 'winstrol' || p === 'winny' || p === 'stanozolol')) {
      if (joints === 'high' || joints === 'moderate') hasWinny = true;
    }
    // 19-нор: трен, нандролон, трестолон, methyltrienolone
    if (rule.patterns.some(p => ['tren','parabolan','nandrolone','deca','npp','trest','ment','methyltrienolone','metribolone'].includes(p))) {
      nineteenNorCount++;
    }
    if (neuro === 'moderate') moderateNeuroCount++;
    if (hemato === 'moderate' || hemato === 'high') moderateHematoCount++;
  }

  // 2. Компенсация: нандролон + станозолол → joints high→moderate
  const reasons: string[] = [];
  if (hasNandrolone && hasWinny && aggJoints === 'high') {
    aggJoints = 'moderate';
    reasons.push('Нандролон частично компенсирует суставной риск станозолола (COLLAGEN_SYNTHESIS): high→moderate');
  }

  // 3. Эскалации
  // 3a. 2+ moderate neuro PED → high
  if (moderateNeuroCount >= 2 && aggNeuro !== 'high') {
    aggNeuro = 'high';
    reasons.push('Эскалация: 2+ PED с moderate нейро-риском → high');
  }
  // 3b. 19-нор + 19-нор → +1 neuro уровень
  if (nineteenNorCount >= 2 && aggNeuro !== 'high') {
    aggNeuro = 'high';
    reasons.push('Эскалация: 2+ 19-нор в стеке → высокая нейротоксичность (статья)');
  }
  // 3c. 3+ PED любых → +1 уровень (стек-нагрузка)
  if (perSubstance.length >= 3) {
    if (aggNeuro === 'moderate') { aggNeuro = 'high'; reasons.push('Эскалация: 3+ PED в стеке → нейро moderate→high'); }
    else if (aggNeuro === 'low') { aggNeuro = 'moderate'; reasons.push('Эскалация: 3+ PED в стеке → нейро low→moderate'); }
    if (aggJoints === 'moderate') { aggJoints = 'high'; reasons.push('Эскалация: 3+ PED в стеке → суставы moderate→high'); }
    else if (aggJoints === 'low') { aggJoints = 'moderate'; reasons.push('Эскалация: 3+ PED в стеке → суставы low→moderate'); }
    if (aggHemato === 'moderate') { aggHemato = 'high'; reasons.push('Эскалация: 3+ PED в стеке → гемато moderate→high'); }
    else if (aggHemato === 'low') { aggHemato = 'moderate'; reasons.push('Эскалация: 3+ PED в стеке → гемато low→moderate'); }
  }
  // 3d. 2+ AAS с moderate+ hemato → +1 hemato уровень (синергия эритропоэза)
  if (moderateHematoCount >= 2 && aggHemato !== 'high') {
    aggHemato = 'high';
    reasons.push('Эскалация: 2+ AAS с эритропоэз-эффектом → синергия, гемато high');
  }

  // Per-substance reasons
  for (const ps of perSubstance) {
    if (ps.neuro === 'high' || ps.neuro === 'moderate') {
      if (ps.neuroReason) reasons.push(`${ps.substanceId}: ${ps.neuroReason}`);
    }
    if (ps.joints === 'high' || ps.joints === 'moderate') {
      if (ps.jointsReason) reasons.push(`${ps.substanceId}: ${ps.jointsReason}`);
    }
    if (ps.hemato === 'high' || ps.hemato === 'moderate') {
      if (ps.hematoReason) reasons.push(`${ps.substanceId}: ${ps.hematoReason}`);
    }
  }

  // 4. risk → tier
  const neuroTier = riskToTier(aggNeuro, level, 'neuro');
  const jointsTier = riskToTier(aggJoints, level, 'joints');
  const hematoTier = riskToTier(aggHemato, level, 'hemato');

  return {
    neuroRisk: aggNeuro,
    jointsRisk: aggJoints,
    hematoRisk: aggHemato,
    neuroBoosterTier: neuroTier,
    jointsBoosterTier: jointsTier,
    hematoBoosterTier: hematoTier,
    triggeredBy: Array.from(new Set(reasons)),
    perSubstance,
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  Утилиты для UI
// ────────────────────────────────────────────────────────────────────────────

/** Краткое описание риска для UI-баннера */
export function describePedRisk(a: PedRiskAssessment): { neuro: string; joints: string; hemato: string } {
  const neuroLabels: Record<PedRisk, string> = {
    none: 'нет риска',
    low: 'низкий',
    moderate: 'умеренный',
    high: 'высокий',
    protective: 'защита',
  };
  const jointsLabels: Record<PedRisk, string> = {
    none: 'нет риска',
    low: 'низкий',
    moderate: 'умеренный',
    high: 'высокий',
    protective: 'защита (нандролон)',
  };
  const hematoLabels: Record<PedRisk, string> = {
    none: 'нет риска',
    low: 'низкий',
    moderate: 'умеренный',
    high: 'высокий',
    protective: 'защита',
  };
  return {
    neuro: neuroLabels[a.neuroRisk],
    joints: jointsLabels[a.jointsRisk],
    hemato: hematoLabels[a.hematoRisk],
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  RESIDUAL RISK — остаточный риск после митигации выбранными веществами
//
//  Логика: для каждого домена (neuro/joints/hemato) проверяем, какие
//  рекомендованные бустер-вещества уже в плане. Coverage ratio определяет
//  насколько снижается tier:
//    ≥80% → tier 0 (полное покрытие)
//    ≥60% → -2 tier
//    ≥30% → -1 tier
//    <30% → без изменений (gross = net)
// ────────────────────────────────────────────────────────────────────────────

export function computeResidualRisk(
  gross: PedRiskAssessment,
  planSubstanceIds: string[]
): PedRiskAssessment {
  const planIds = new Set(planSubstanceIds.map(id => id.toLowerCase()));

  const computeDomain = (
    grossTier: 0 | 1 | 2 | 3,
    getBoosterIds: (tier: 1 | 2 | 3) => string[]
  ): { netTier: 0 | 1 | 2 | 3; coverage: number; covered: number; recommended: number } => {
    if (grossTier === 0) return { netTier: 0, coverage: 100, covered: 0, recommended: 0 };
    const recommended = getBoosterIds(grossTier as 1 | 2 | 3);
    const covered = recommended.filter((id: string) => planIds.has(id.toLowerCase())).length;
    const coverage = recommended.length > 0 ? Math.round((covered / recommended.length) * 100) : 100;
    let netTier: 0 | 1 | 2 | 3 = grossTier;
    if (coverage >= 80) netTier = 0;
    else if (coverage >= 60) netTier = Math.max(0, grossTier - 2) as 0 | 1 | 2 | 3;
    else if (coverage >= 30) netTier = Math.max(0, grossTier - 1) as 0 | 1 | 2 | 3;
    return { netTier, coverage, covered, recommended: recommended.length };
  };

  const neuro = computeDomain(gross.neuroBoosterTier, getNeuroBoosterSubstanceIds);
  const joints = computeDomain(gross.jointsBoosterTier, getJointsBoosterSubstanceIds);
  const hemato = computeDomain(gross.hematoBoosterTier, getHematoBoosterSubstanceIds);

  return {
    ...gross,
    neuroBoosterTier: neuro.netTier,
    jointsBoosterTier: joints.netTier,
    hematoBoosterTier: hemato.netTier,
    grossNeuroTier: gross.neuroBoosterTier,
    grossJointsTier: gross.jointsBoosterTier,
    grossHematoTier: gross.hematoBoosterTier,
    neuroCoverage: neuro.coverage,
    neuroCovered: neuro.covered,
    neuroRecommended: neuro.recommended,
    jointsCoverage: joints.coverage,
    jointsCovered: joints.covered,
    jointsRecommended: joints.recommended,
    hematoCoverage: hemato.coverage,
    hematoCovered: hemato.covered,
    hematoRecommended: hemato.recommended,
  };
}
