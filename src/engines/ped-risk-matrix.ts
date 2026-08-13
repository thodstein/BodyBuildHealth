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
import { resolvePedAlias } from '../data/ped-alias-map';
import type { SupportLevel } from './tz-bridge-mechanism';
import { getNeuroBoosterSubstanceIds, getJointsBoosterSubstanceIds, getHematoBoosterSubstanceIds } from './tz-bridge-boosters';

export type PedRisk = 'none' | 'low' | 'moderate' | 'high' | 'protective';

export interface PedSubstanceRisk {
  substanceId: string;
  matchedBy: string;
  neuro: PedRisk;
  joints: PedRisk;
  hemato: PedRisk;
  /** Риски по системам (механизм-ориентированное расширение) */
  hepatic: PedRisk;
  cardio: PedRisk;
  renal: PedRisk;
  reproductive: PedRisk;
  neuroReason?: string;
  jointsReason?: string;
  hematoReason?: string;
  hepaticReason?: string;
  cardioReason?: string;
  renalReason?: string;
  reproductiveReason?: string;
  /** Рекомендуемая поддержка из правила (для residual-покрытия по механизмам) */
  support?: string[];
  dose: number;
  doseUnit: string;
}

export interface PedRiskAssessment {
  neuroRisk: PedRisk;
  jointsRisk: PedRisk;
  hematoRisk: PedRisk;
  hepaticRisk: PedRisk;
  cardioRisk: PedRisk;
  renalRisk: PedRisk;
  reproductiveRisk: PedRisk;
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
  hepatic: PedRisk;
  cardio: PedRisk;
  renal: PedRisk;
  reproductive: PedRisk;
}

interface SubstanceRule {
  patterns: string[];
  pClasses?: PEDClass[];
  doseUnit: 'mgPerWeek' | 'iuPerDay' | 'mcgPerDay' | 'any';
  tiers: DoseTier[];
  neuroReason?: string;
  jointsReason?: string;
  hematoReason?: string;
  hepaticReason?: string;
  cardioReason?: string;
  renalReason?: string;
  reproductiveReason?: string;
  /** Рекомендуемая поддержка по механизмам (для residual-покрытия) */
  support?: string[];
}

const INF = Infinity;

/** Сокращённый конструктор тира (hepatic/cardio/renal/reproductive по умолчанию low). */
function tier(
  maxDose: number,
  neuro: PedRisk,
  joints: PedRisk,
  hemato: PedRisk,
  extra: Partial<Pick<DoseTier, 'hepatic' | 'cardio' | 'renal' | 'reproductive'>> = {},
): DoseTier {
  return { maxDose, neuro, joints, hemato, hepatic: 'low', cardio: 'low', renal: 'low', reproductive: 'moderate', ...extra };
}

// AAS — по substring-паттернам ID (надёжнее pClass, т.к. classifyPed
// не распознавал трестолон/superdrol/провирон — сейчас резолвится через ped-alias-map)
const AAS_RULES: SubstanceRule[] = [
  // ── Тренболон (19-нор, MAX нейротоксичность по статье) ──
  {
    // 'tren' отдельно НЕ матчим — 'trena' (туринабол) содержит 'tren'
    patterns: ['tren_', 'trenbolone', 'parabolan', 'trenace', 'tren_acetate'],
    pClasses: ['aas_tren'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(200, 'moderate', 'low', 'moderate', { hepatic: 'low', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
      tier(500, 'high', 'low', 'moderate', { hepatic: 'moderate', cardio: 'high', renal: 'moderate', reproductive: 'high' }),
      tier(800, 'high', 'low', 'high', { hepatic: 'moderate', cardio: 'high', renal: 'moderate', reproductive: 'high' }),
      tier(INF, 'high', 'low', 'high', { hepatic: 'high', cardio: 'high', renal: 'moderate', reproductive: 'high' }),
    ],
    neuroReason: 'Тренболон — максимальная нейротоксичность (статья: рост нейритов ↓↓, 19-нор)',
    hematoReason: 'Тренболон ≥500 мг — стимуляция эритропоэза (HIF-1α)',
    hepaticReason: 'Тренболон — гепатотоксичность (17α-замещённый эстрен), риск холестаза',
    cardioReason: 'Тренболон — кардиотоксичность: гипертрофия ЛЖ, дислипидемия, ↑АД, тахикардия',
    renalReason: 'Тренболон — гиперфильтрация, ↑креатинин, задержка K/Na',
    reproductiveReason: '19-нор — максимальная супрессия HPG-оси (прогестаген)',
    support: ['nebivolol', 'astragalus', 'magnesium_l_threonate', 'phosphatidylserine', 'vitamin_b12', 'theanine', 'glycine', 'tudca', 'nac'],
  },
  // ── Нандролон (19-нор, moderate нейро, PROTECTIVE суставы) ──
  {
    patterns: ['nandrolone', 'deca', 'npp'],
    pClasses: ['aas_nandrolone'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(300, 'low', 'protective', 'moderate', { hepatic: 'none', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
      tier(500, 'moderate', 'protective', 'high', { hepatic: 'none', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
      tier(INF, 'moderate', 'protective', 'high', { hepatic: 'none', cardio: 'high', renal: 'moderate', reproductive: 'high' }),
    ],
    neuroReason: 'Нандролон (19-нор) — moderate нейро при высоких дозах',
    jointsReason: '↑ COLLAGEN_SYNTHESIS, укрепление суставов/связок',
    hematoReason: 'Нандролон ≥300 мг — выраженный ЭПО-эффект (HIF-1α)',
    cardioReason: 'Нандролон — дислипидемия (HDL↓↓), объёмная нагрузка, прогестиновая задержка',
    renalReason: 'Нандролон — гиперфильтрация при высоких дозах',
    reproductiveReason: '19-нор — сильная супрессия HPG-оси (прогестаген + эстроген)',
    support: ['agmatine', 'hesperidin', 'dandelion', 'hcg', 'omega3'],
  },
  // ── Трестолон / MENT (19-нор, progestogenic) ──
  {
    patterns: ['trest', 'ment'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(300, 'moderate', 'low', 'moderate', { hepatic: 'none', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
      tier(INF, 'high', 'low', 'high', { hepatic: 'none', cardio: 'high', renal: 'moderate', reproductive: 'high' }),
    ],
    neuroReason: 'Трестолон (MENT, 19-нор) — progestogenic, нейротоксичность',
    hematoReason: 'Трестолон — стимуляция эритропоэза (19-нор, progestogenic)',
    cardioReason: 'Трестолон — высокая андрогенность, дислипидемия, ↑АД',
    reproductiveReason: 'MENT — сильнейшая супрессия HPG (прогестаген)',
    support: ['agmatine', 'hesperidin', 'dandelion', 'hcg'],
  },
  // ── Станозолол (tendinopathy, 17α) ──
  {
    patterns: ['stan', 'winstrol', 'winny', 'stanozolol'],
    pClasses: ['aas_oral_winny'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(210, 'low', 'moderate', 'moderate', { hepatic: 'high', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
      tier(INF, 'low', 'high', 'high', { hepatic: 'high', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
    ],
    jointsReason: 'Станозолол — tendinopathy, дегенерация коллагена сухожилий',
    hematoReason: 'Станозолол — стимуляция эритропоэза + ↑факторы свёртывания',
    hepaticReason: 'Станозолол — 17α-алкил: холестаз, ↑АЛТ/АСТ/ГГТ',
    cardioReason: 'Станозолол — HDL↓↓ до 50%, ↓LDL',
    reproductiveReason: '17α-орал — супрессия HPG-оси',
    support: ['tudca', 'nac', 'milk_thistle', 'omega3', 'bpc157', 'collagen', 'glucosamine', 'msm'],
  },
  // ── Halotestin (17α, neurotoxicity + tendinopathy) ──
  {
    patterns: ['halo', 'halotestin', 'fluoxymesterone'],
    pClasses: ['aas_oral_halo'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'moderate', 'moderate', 'high', { hepatic: 'high', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
    ],
    neuroReason: 'Halotestin — neurotoxicity (COMPOUND_RISK_MAP)',
    jointsReason: 'Halotestin — tendinopathy (COMPOUND_RISK_MAP)',
    hematoReason: 'Halotestin — выраженный эритропоэз (17α-алкил, DHT-производный)',
    hepaticReason: 'Halotestin — токсичнейший 17α-орал (порог гепатотоксичности)',
    support: ['tudca', 'nac', 'milk_thistle', 'omega3'],
  },
  // ── DHB / дигидроболденон (DHT-подобный, но выраженный гемато-эффект как у болденона) ──
  {
    patterns: ['dhb', 'dihydroboldenone'],
    pClasses: ['aas_dht_inject'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'low', 'low', 'high', { hepatic: 'moderate', cardio: 'moderate', renal: 'low', reproductive: 'moderate' }),
    ],
    hematoReason: 'DHB — выраженный ЭПО-эффект (как болденон, HCT↑), гипервязкость',
    hepaticReason: 'DHB — гепатотоксичность 0.4 (зависит от индивидуальной реакции)',
    cardioReason: 'DHB — HCT↑ → гипервязкость, тромбоз, ↑АД',
    support: ['nattokinase', 'serrapeptase', 'bromelain', 'hesperidin', 'tudca', 'aspirin'],
  },
  // ── Мастерон / дростанолон (DHT-inject, tendinopathy) ──
  {
    patterns: ['masteron', 'drostanolone', 'master'],
    pClasses: ['aas_dht_inject'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'low', 'moderate', 'low', { hepatic: 'none', cardio: 'low', renal: 'low', reproductive: 'moderate' }),
    ],
    jointsReason: 'Мастерон — tendinopathy (COMPOUND_RISK_MAP pharmaTriggers)',
    support: ['bpc157', 'collagen', 'glucosamine', 'msm', 'curcumin'],
  },
  // ── Примоболан / метенолон (мягкий) ──
  {
    patterns: ['primobolan', 'methenolone', 'primo', 'prim_'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'low', 'low', 'low', { hepatic: 'none', cardio: 'low', renal: 'low', reproductive: 'moderate' }),
    ],
    support: ['hcg'],
  },
  // ── Тестостерон (базовый, дозозависимый) ──
  {
    patterns: ['test', 'testosterone', 'sustanon', 'sust', 'omnadren'],
    pClasses: ['aas_test'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(500, 'low', 'none', 'low', { hepatic: 'low', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
      tier(1000, 'moderate', 'none', 'moderate', { hepatic: 'low', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
      tier(INF, 'moderate', 'none', 'high', { hepatic: 'low', cardio: 'high', renal: 'moderate', reproductive: 'high' }),
    ],
    neuroReason: 'Тестостерон ≥500 мг/нед — moderate нейронагрузка',
    hematoReason: 'Тестостерон ≥1000 мг/нед — выраженный эритропоэз (HIF-1α, EPO-независимый)',
    cardioReason: 'Тестостерон — дозозависимая дислипидемия, ↑HCT, объёмная нагрузка',
    reproductiveReason: 'Экзогенный тестостерон — супрессия HPG-оси (GnRH/LH/FSH↓↓)',
    support: ['hcg', 'omega3', 'bergamot', 'telmisartan', 'tadalafil'],
  },
  // ── Болденон / DHB (выраженный ЭПО-эффект) ──
  {
    patterns: ['bold', 'equipoise', 'eq', 'dhb'],
    pClasses: ['aas_bold'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'low', 'none', 'high', { hepatic: 'low', cardio: 'moderate', renal: 'low', reproductive: 'moderate' }),
    ],
    hematoReason: 'Болденон — наиболее выраженный ЭПО-эффект среди AAS (HIF-1α, прямой стимул эритропоэза)',
    cardioReason: 'Болденон/DHB — HCT↑ → гипервязкость, тромбоз, ↑АД',
    support: ['nattokinase', 'serrapeptase', 'bromelain', 'hesperidin', 'aspirin'],
  },
  // ── Метандиенон / dbol (17α) ──
  {
    patterns: ['dbol', 'dianabol', 'methand', 'methandrostenolone', 'methandienone'],
    pClasses: ['aas_oral_dbol'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'low', 'none', 'moderate', { hepatic: 'high', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
    ],
    hematoReason: 'Метандиенон ≥30 мг/день — moderate эритропоэз',
    hepaticReason: 'Метандиенон — 17α-алкил: гепатотоксичность, холестаз',
    reproductiveReason: '17α-орал — супрессия HPG + ароматизация (E2↑)',
    support: ['tudca', 'nac', 'milk_thistle', 'omega3', 'anastrozole'],
  },
  // ── Оксиметолон / anadrol (17α, MAX эритропоэз) ──
  {
    patterns: ['anadrol', 'oxy', 'oxymeth', 'oxymetholone'],
    pClasses: ['aas_oral_oxy'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'low', 'none', 'high', { hepatic: 'high', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
    ],
    hematoReason: 'Оксиметолон — клинически применяется при анемии, мощнейший эритропоэз',
    hepaticReason: 'Оксиметолон — 17α-алкил: холестатическая желтуха, ↑АЛТ',
    cardioReason: 'Оксиметолон — HCT↑↑, отёки (задержка Na), гипертония',
    support: ['tudca', 'nac', 'milk_thistle', 'omega3', 'nattokinase', 'serrapeptase', 'telmisartan'],
  },
  // ── Туринабол (17α, мягкий) ──
  {
    patterns: ['tbol', 'turinabol', 'chlorodehydro', 'trena'],
    pClasses: ['aas_oral_tbol'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'low', 'none', 'low', { hepatic: 'moderate', cardio: 'low', renal: 'low', reproductive: 'moderate' }),
    ],
    hepaticReason: 'Туринабол — 17α-алкил (мягкий), контроль LFT',
    support: ['tudca', 'nac'],
  },
  // ── Оксандролон / anavar (17α, мягкий) ──
  {
    patterns: ['oxan', 'anavar', 'oxandrolone'],
    pClasses: ['aas_oral_anavar'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'low', 'low', 'low', { hepatic: 'moderate', cardio: 'low', renal: 'low', reproductive: 'moderate' }),
    ],
    hepaticReason: 'Анавар — 17α-алкил (мягкий), HDL↓↓',
    support: ['tudca', 'nac', 'omega3'],
  },
  // ── Superdrol / метилдростанолон (17α, токсичный) ──
  {
    patterns: ['superdrol', 'methyldrostanolone'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(140, 'moderate', 'none', 'moderate', { hepatic: 'high', cardio: 'moderate', renal: 'moderate', reproductive: 'high' }),
      tier(INF, 'high', 'none', 'high', { hepatic: 'high', cardio: 'high', renal: 'moderate', reproductive: 'high' }),
    ],
    neuroReason: 'Superdrol — гепатотоксичность MAX 3.5, нейротоксичность',
    hematoReason: 'Superdrol — выраженный эритропоэз (17α-алкил)',
    hepaticReason: 'Superdrol — токсичнейший 17α-орал (порог гепатотоксичности 3.5)',
    support: ['tudca', 'nac', 'milk_thistle', 'omega3', 'astragalus'],
  },
  // ── Methyltestosterone (17α) ──
  {
    patterns: ['methyltest'],
    pClasses: ['aas_oral_other'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'moderate', 'none', 'moderate', { hepatic: 'high', cardio: 'moderate', renal: 'low', reproductive: 'high' }),
    ],
    hepaticReason: 'Метилтестостерон — 17α-алкил: гепатотоксичность',
    support: ['tudca', 'nac'],
  },
  // ── Mibolerone / cheque drops (крайне токсичный, potency 6.0) ──
  {
    patterns: ['mibolerone', 'cheque'],
    pClasses: ['aas_oral_other'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'high', 'moderate', 'high', { hepatic: 'high', cardio: 'high', renal: 'moderate', reproductive: 'high' }),
    ],
    neuroReason: 'Mibolerone — potency 6.0, крайне токсичный',
    jointsReason: 'Mibolerone — tendinopathy',
    hematoReason: 'Mibolerone — крайне выраженный эритропоэз',
    hepaticReason: 'Mibolerone — 17α-алкил, экстремальная гепатотоксичность',
    support: ['tudca', 'nac', 'nebivolol'],
  },
  // ── Methyltrienolone (19-нор, крайне токсичный) ──
  {
    patterns: ['methyltrienolone', 'metribolone'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'high', 'low', 'high', { hepatic: 'high', cardio: 'high', renal: 'moderate', reproductive: 'high' }),
    ],
    neuroReason: 'Methyltrienolone — neurotoxicity (COMPOUND_RISK_MAP)',
    hematoReason: 'Methyltrienolone — выраженный эритропоэз (19-нор)',
    hepaticReason: 'Methyltrienolone — 17α-алкил + 19-нор: экстремальная гепатотоксичность',
    support: ['tudca', 'nac', 'nebivolol', 'astragalus'],
  },
  // ── Провирон / местеролон (не AAS по classifyPed, нейро=0) ──
  {
    patterns: ['proviron', 'mesterolone'],
    doseUnit: 'mgPerWeek',
    tiers: [
      tier(INF, 'none', 'none', 'none', { hepatic: 'none', cardio: 'none', renal: 'none', reproductive: 'low' }),
    ],
    reproductiveReason: 'Провирон — лёгкая супрессия HPG (оральный DHT)',
  },
];

// SARMs
const SARM_RULES: SubstanceRule[] = [
  {
    patterns: ['rad140', 'testolone'],
    pClasses: ['sarm'],
    doseUnit: 'any',
    tiers: [tier(INF, 'moderate', 'none', 'none', { hepatic: 'moderate', cardio: 'low', renal: 'low', reproductive: 'moderate' })],
    neuroReason: 'RAD-140 — дофаминовый дисбаланс (DRUG_THRESHOLDS_V7 neuro{1:0.15})',
    hepaticReason: 'RAD-140 — SARM: гепатотоксичность (↑АЛТ при высоких дозах)',
    support: ['tudca', 'nac'],
  },
  {
    patterns: ['s23'],
    doseUnit: 'any',
    tiers: [tier(INF, 'moderate', 'none', 'none', { hepatic: 'moderate', cardio: 'low', renal: 'low', reproductive: 'moderate' })],
    neuroReason: 'S-23 — самый агрессивный SARM, нейротоксичность 0.08',
    support: ['tudca', 'nac'],
  },
  {
    patterns: ['lgd', 'ligandrol', 'lgd4033', 'lgd-4033'],
    doseUnit: 'any',
    tiers: [tier(INF, 'low', 'none', 'none', { hepatic: 'moderate', cardio: 'low', renal: 'low', reproductive: 'moderate' })],
    hepaticReason: 'LGD-4033 — гепатотоксичность при дозах >5 мг/день',
    support: ['tudca', 'nac'],
  },
  {
    patterns: ['ostarine', 'mk2866', 'enobosarm'],
    doseUnit: 'any',
    tiers: [tier(INF, 'low', 'protective', 'none', { hepatic: 'low', cardio: 'low', renal: 'low', reproductive: 'moderate' })],
    jointsReason: 'Ostarine — терапевтически применяется для суставов/связок',
  },
  {
    patterns: ['andarine', 's4'],
    doseUnit: 'any',
    tiers: [tier(INF, 'low', 'none', 'none', { hepatic: 'low', cardio: 'low', renal: 'low', reproductive: 'moderate' })],
  },
  {
    patterns: ['sr9009', 'stenabolic'],
    doseUnit: 'any',
    tiers: [tier(INF, 'none', 'none', 'none', { hepatic: 'none', cardio: 'low', renal: 'low', reproductive: 'none' })],
  },
  {
    patterns: ['gw501516', 'cardarine'],
    doseUnit: 'any',
    tiers: [tier(INF, 'none', 'none', 'none', { hepatic: 'none', cardio: 'low', renal: 'low', reproductive: 'none' })],
  },
  {
    patterns: ['yk11'],
    doseUnit: 'any',
    tiers: [tier(INF, 'low', 'none', 'none', { hepatic: 'moderate', cardio: 'low', renal: 'low', reproductive: 'moderate' })],
    hepaticReason: 'YK-11 — SARM+стероидный гибрид, гепатотоксичность',
    support: ['tudca', 'nac'],
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
      tier(4, 'low', 'moderate', 'none', { hepatic: 'none', cardio: 'low', renal: 'low', reproductive: 'none' }),
      tier(8, 'low', 'high', 'none', { hepatic: 'none', cardio: 'moderate', renal: 'moderate', reproductive: 'none' }),
      tier(INF, 'moderate', 'high', 'none', { hepatic: 'none', cardio: 'moderate', renal: 'moderate', reproductive: 'none' }),
    ],
    jointsReason: 'GH — туннельный синдром (tunnel_syndrome, COMPOUND_RISK_MAP)',
    neuroReason: 'GH >8 IU — нейроэндокринная нагрузка',
    cardioReason: 'GH — задержка жидкости, ↑АД, кардиомегалия при высоких дозах',
    renalReason: 'GH — гиперфильтрация, задержка Na',
    support: ['berberine', 'alpha_lipoic', 'taurine'],
  },
  // IGF-1
  {
    patterns: ['igf1', 'igf-1', 'igf1_lr3', 'igf1_des'],
    pClasses: ['igf'],
    doseUnit: 'mcgPerDay',
    tiers: [tier(INF, 'low', 'moderate', 'none', { hepatic: 'none', cardio: 'low', renal: 'low', reproductive: 'none' })],
    jointsReason: 'IGF-1 — tunnel_syndrome (COMPOUND_RISK_MAP)',
    support: ['glycine', 'taurine', 'alpha_lipoic'],
  },
  // MGF
  {
    patterns: ['mgf'],
    pClasses: ['mgf'],
    doseUnit: 'mcgPerDay',
    tiers: [tier(INF, 'low', 'moderate', 'none', { hepatic: 'none', cardio: 'low', renal: 'low', reproductive: 'none' })],
    jointsReason: 'MGF — аналог IGF-1, tunnel_syndrome',
  },
  // GHRP (ghrp6, ghrp2, ipamorelin) — neurotoxicity + tunnel
  {
    patterns: ['ghrp', 'ipamorelin'],
    doseUnit: 'any',
    tiers: [tier(INF, 'moderate', 'moderate', 'none', { hepatic: 'none', cardio: 'low', renal: 'low', reproductive: 'none' })],
    neuroReason: 'GHRP — neurotoxicity (COMPOUND_RISK_MAP)',
    jointsReason: 'GHRP — tunnel_syndrome (COMPOUND_RISK_MAP)',
  },
  // GHRH (cjc1295)
  {
    patterns: ['cjc1295', 'cjc', 'ghrh'],
    doseUnit: 'any',
    tiers: [tier(INF, 'low', 'moderate', 'none', { hepatic: 'none', cardio: 'low', renal: 'low', reproductive: 'none' })],
    jointsReason: 'GHRH — tunnel_syndrome (COMPOUND_RISK_MAP)',
  },
  // MK-677 (GHRP-аналог per os)
  {
    patterns: ['mk677', 'mk-677', 'ibutamoren'],
    doseUnit: 'any',
    tiers: [tier(INF, 'low', 'moderate', 'none', { hepatic: 'low', cardio: 'low', renal: 'low', reproductive: 'none' })],
    jointsReason: 'MK-677 — GHRP-аналог, tunnel_syndrome',
  },
  // Инсулины — правило для полноты (риски гипогликемии — в механизм-модели hem3/cns5)
  {
    patterns: ['ins_', 'insulin', 'novorapid', 'humalog', 'lantus', 'levemir', 'glargine', 'detemir', 'aspart'],
    pClasses: ['insulin'],
    doseUnit: 'iuPerDay',
    tiers: [tier(INF, 'none', 'none', 'none', { hepatic: 'none', cardio: 'none', renal: 'none', reproductive: 'none' })],
  },
  // GLP-1 (semaglutide/tirzepatide) — low нейро (аппетит/ЖКТ-ось)
  {
    patterns: ['semaglutide', 'tirzepatide', 'liraglutide', 'dulaglutide', 'glp'],
    pClasses: ['glp1'],
    doseUnit: 'any',
    tiers: [tier(INF, 'low', 'none', 'none', { hepatic: 'none', cardio: 'low', renal: 'low', reproductive: 'none' })],
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

/** Поиск правила по ID (substring по канонизированному id) с fallback на pClass */
function findRule(ped: PEDDose): { rule: SubstanceRule; matchedBy: string } | null {
  const id = resolvePedAlias(ped.id || '');
  // 1. По substring-паттернам (канон: tren_acet, deca, dhb, prim_enan...)
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

/** Применить дозовый tier (все 7 измерений) */
function applyDoseTier(rule: SubstanceRule, dose: number): {
  neuro: PedRisk; joints: PedRisk; hemato: PedRisk;
  hepatic: PedRisk; cardio: PedRisk; renal: PedRisk; reproductive: PedRisk;
} {
  for (const t of rule.tiers) {
    if (dose <= t.maxDose) {
      return { neuro: t.neuro, joints: t.joints, hemato: t.hemato, hepatic: t.hepatic, cardio: t.cardio, renal: t.renal, reproductive: t.reproductive };
    }
  }
  const last = rule.tiers[rule.tiers.length - 1];
  return { neuro: last.neuro, joints: last.joints, hemato: last.hemato, hepatic: last.hepatic, cardio: last.cardio, renal: last.renal, reproductive: last.reproductive };
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

/** max risk для системных измерений (hepatic/cardio/renal/reproductive): protective → none */
function maxSystemRisk(a: PedRisk, b: PedRisk): PedRisk {
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
      hepaticRisk: 'none',
      cardioRisk: 'none',
      renalRisk: 'none',
      reproductiveRisk: 'none',
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
  let aggHepatic: PedRisk = 'none';
  let aggCardio: PedRisk = 'none';
  let aggRenal: PedRisk = 'none';
  let aggRepro: PedRisk = 'none';
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
    const { neuro, joints, hemato, hepatic, cardio, renal, reproductive } = applyDoseTier(rule, dose);

    perSubstance.push({
      substanceId: ped.id,
      matchedBy,
      neuro,
      joints,
      hemato,
      hepatic,
      cardio,
      renal,
      reproductive,
      neuroReason: rule.neuroReason,
      jointsReason: rule.jointsReason,
      hematoReason: rule.hematoReason,
      hepaticReason: rule.hepaticReason,
      cardioReason: rule.cardioReason,
      renalReason: rule.renalReason,
      reproductiveReason: rule.reproductiveReason,
      support: rule.support,
      dose,
      doseUnit: unit,
    });

    aggNeuro = maxNeuroRisk(aggNeuro, neuro);
    aggJoints = maxJointsRisk(aggJoints, joints);
    aggHemato = maxHematoRisk(aggHemato, hemato);
    aggHepatic = maxSystemRisk(aggHepatic, hepatic);
    aggCardio = maxSystemRisk(aggCardio, cardio);
    aggRenal = maxSystemRisk(aggRenal, renal);
    aggRepro = maxSystemRisk(aggRepro, reproductive);

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
    if (ps.hepatic === 'high' || ps.hepatic === 'moderate') {
      if (ps.hepaticReason) reasons.push(`${ps.substanceId}: ${ps.hepaticReason}`);
    }
    if (ps.cardio === 'high' || ps.cardio === 'moderate') {
      if (ps.cardioReason) reasons.push(`${ps.substanceId}: ${ps.cardioReason}`);
    }
    if (ps.renal === 'high' || ps.renal === 'moderate') {
      if (ps.renalReason) reasons.push(`${ps.substanceId}: ${ps.renalReason}`);
    }
    if (ps.reproductive === 'high' || ps.reproductive === 'moderate') {
      if (ps.reproductiveReason) reasons.push(`${ps.substanceId}: ${ps.reproductiveReason}`);
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
    hepaticRisk: aggHepatic,
    cardioRisk: aggCardio,
    renalRisk: aggRenal,
    reproductiveRisk: aggRepro,
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
export function describePedRisk(a: PedRiskAssessment): {
  neuro: string; joints: string; hemato: string;
  hepatic: string; cardio: string; renal: string; reproductive: string;
} {
  const labels: Record<PedRisk, string> = {
    none: 'нет риска',
    low: 'низкий',
    moderate: 'умеренный',
    high: 'высокий',
    protective: 'защита',
  };
  const jointsLabels: Record<PedRisk, string> = {
    ...labels,
    protective: 'защита (нандролон)',
  };
  return {
    neuro: labels[a.neuroRisk],
    joints: jointsLabels[a.jointsRisk],
    hemato: labels[a.hematoRisk],
    hepatic: labels[a.hepaticRisk],
    cardio: labels[a.cardioRisk],
    renal: labels[a.renalRisk],
    reproductive: labels[a.reproductiveRisk],
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

  /** Рекомендуемая поддержка: бустеры по тиру ∪ протокольная поддержка из правил (по механизмам). */
  const recommendedFor = (
    grossTier: 0 | 1 | 2 | 3,
    getBoosterIds: (tier: 1 | 2 | 3) => string[],
  ): string[] => {
    const set = new Set<string>();
    if (grossTier > 0) for (const id of getBoosterIds(grossTier as 1 | 2 | 3)) set.add(id.toLowerCase());
    for (const ps of gross.perSubstance || []) {
      for (const id of ps.support || []) set.add(id.toLowerCase());
    }
    return [...set];
  };

  const computeDomain = (
    grossTier: 0 | 1 | 2 | 3,
    getBoosterIds: (tier: 1 | 2 | 3) => string[]
  ): { netTier: 0 | 1 | 2 | 3; coverage: number; covered: number; recommended: number } => {
    if (grossTier === 0 && (gross.perSubstance || []).every(ps => (ps.support || []).length === 0)) {
      return { netTier: 0, coverage: 100, covered: 0, recommended: 0 };
    }
    const recommended = recommendedFor(grossTier, getBoosterIds);
    if (recommended.length === 0) return { netTier: grossTier, coverage: 100, covered: 0, recommended: 0 };
    const covered = recommended.filter((id: string) => planIds.has(id)).length;
    const coverage = Math.round((covered / recommended.length) * 100);
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
