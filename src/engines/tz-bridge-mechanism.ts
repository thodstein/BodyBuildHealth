// ════════════════════════════════════════════════════════════════════════════
//  TZ-BRIDGE-MECHANISM — мост: 28 механизмов ТЗ → вещества поддержки
//
//  Автоматически агрегирует из SUPPLEMENTS_DB + PHARMACY_DB (support-db) :
//    для каждого из 28 ТЗ-mechId → список { substanceId, k, q, source, category }
//
//  Категории веществ (category):
//    'hepatoprotector' | 'cardioprotector' | 'nephroprotector' |
//    'neuroprotector' | 'hormonal'      | 'hematologic' |
//    'antioxidant'    | 'vitamin'       | 'mineral'      |
//    'amino'          | 'adaptogen'     | 'antiinflam'   |
//    'pharma'         | 'other'
//
//  CATEGORY_LIMITS — максимальное количество веществ каждой категории на уровне
//  GUARDRAILS — непроскакиваемые ограничения (T-бустеры на курсе, AI при E2<20 и т.д.)
//
//  Источник: src/data/support-db (только ТЗ-28 mechId)
// ════════════════════════════════════════════════════════════════════════════

import { SUPPLEMENTS_DB } from '../data/support-db/supplements';
import { PHARMACY_DB } from '../data/support-db/pharmacy-db';
import type { TzMechId, TzOrganId } from './tz-bridge-marker';
import { ALL_TZ_MECH_IDS, ALL_TZ_ORGANS } from './tz-bridge-marker';

// ════════════════════════════════════════════════════════════════════════════
//  CLASS_BLOCKLIST — generic class-level substance IDs, которые НЕ могут быть
//  рекомендованы TZ-mapper'ом. Это классы ("сартаны", "статины", "ББ"), а не
//  конкретные препараты. Каждый механизм имеет конкретные препараты в БД, так
//  что классовые абстракции исключаются во избежание дублей типа
//  "telmisartan + arb_drugs" в одном плане.
// ════════════════════════════════════════════════════════════════════════════
export const CLASS_BLOCKLIST: ReadonlySet<string> = new Set([
  // Кардио-препараты (классы) — есть конкретные: telmisartan, lisinopril,
  // enalapril, ramipril, atorvastatin, rosuvastatin, bisoprolol, metoprolol,
  // nebivolol, amlodipine, furosemide, spironolactone, aspirin, warfarin,
  // rivaroxaban, apixaban.
  'ace_inhibitor_drugs',
  'anticoagulant_drugs',
  'antiplatelet_drugs',
  'arb_drugs',
  'beta_blocker_drugs',
  'ccb_drugs',
  'diuretic_drugs',
  'statin_drugs',
  // ЦНС/прочие классы — нет конкретных препаратов в БД; классы не рекомендовать
  // (alg будет показывать gap для этих механизмов вместо выдуманного класса).
  'antibiotic_drugs',
  'anticonvulsant_drugs',
  'antidepressant_drugs',
  'antidiabetic_drugs',
  'antihistamine_drugs',
  'antipsychotic_drugs',
  'antithyroid_drugs',
  'anxiolytic_drugs',
  'corticosteroid_drugs',
  'immunosuppressant_drugs',
  'nsaid_drugs',
  'ppi_drugs',
  'thyroid_drugs',
]);

export function isClassLevel(id: string): boolean {
  return CLASS_BLOCKLIST.has(id);
}

export type TzCategory =
  | 'hepatoprotector' | 'cardioprotector' | 'nephroprotector'
  | 'neuroprotector'  | 'hormonal'        | 'hematologic'
  | 'antioxidant'     | 'vitamin'         | 'mineral'
  | 'amino'           | 'adaptogen'       | 'antiinflam'
  | 'pharma'          | 'other';

export interface TzMechSubstance {
  substanceId: string;
  k: number;            // 0..1, коэффициент снижения механизма
  q: 'A' | 'B' | 'C';   // уровень доказательности
  source: string;        // клиническое обоснование
  category: TzCategory;
  organId: TzOrganId;
}

export interface SubsByMech {
  mechId: TzMechId;
  organId: TzOrganId;
  count: number;
  substances: TzMechSubstance[]; // отсортированы по k (desc)
}

// ════════════════════════════════════════════════════════════════════════════
//  КАТЕГОРИЗАЦИЯ вещества по его id (эвристическая)
// ════════════════════════════════════════════════════════════════════════════
function classifySubstance(id: string, organId: TzOrganId, mechId: TzMechId): TzCategory {
  const s = id.toLowerCase();
  // ─── pharmaceutical ───
  const pharmaKeys = [
    'atorvastatin','rosuvastatin','simvastatin','pravastatin','pitavastatin',
    'lisinopril','enalapril','ramipril','perindopril','captopril',
    'losartan','valsartan','irbesartan','olmesartan','candesartan','telmisartan','telmi',
    'metoprolol','atenolol','bisoprolol','carvedilol','propranolol','nebivolol',
    'amlodipine','nifedipine','verapamil','diltiazem',
    'furosemide','hydrochlorothiazide','chlorthalidone','spironolactone',
    'warfarin','rivaroxaban','apixaban','dabigatran','aspirin','clopidogrel',
    'anastrozole','letrozole','exemestane','tamoxifen','clomiphene','enclomiphene',
    'cabergoline','bromocriptine','finasteride','dutasteride','tadalafil','sildenafil',
    'metformin','glp1','semaglutide','liraglutide','tirzepatide',
    'hcg','gonadorelin',
  ];
  if (pharmaKeys.some(p => s === p || s.startsWith(p))) return 'pharma';

  // ─── по органу ───
  if (organId === 'hepatic') return 'hepatoprotector';
  if (organId === 'cardio')  return 'cardioprotector';
  if (organId === 'renal')   return 'nephroprotector';
  if (organId === 'cns')     return 'neuroprotector';
  if (organId === 'reproductive') return 'hormonal';
  if (organId === 'hematologic')  return 'hematologic';

  // ─── по имени/окончанию ───
  if (/vitamin_|vitamina|vitaminb|vitaminc|vitamine|vitamink|d3|k2|b6|b12|folate|biotin|pqq|benfo/.test(s)) return 'vitamin';
  if (/magnesium|zinc|selenium|boron|copper|iron|chromium|molybdenum|potassium|calcium|strontium/.test(s)) return 'mineral';
  if (/ carnitine|taurine|theanine|glycine|leucine|glutamine|arginine|citrulline|ornithine|_gaba|gaba_/.test(s)) return 'amino';
  if (/ashwagandha|rhodiola|ginseng|eleuthero|holy_basil|schisandra|astragalus|cordyceps|reishi|chaga/.test(s)) return 'adaptogen';
  if (/nac|glutathione|alpha_lipoic|coq10|astaxanthin|resveratrol|curcumin|egcg|lycopene|quercetin|vitamin_c|vitamin_e|sulforaphane/.test(s)) return 'antioxidant';
  if (/boswellia|bromelain|serrapeptase|nattokinase|papain|msm|curcumin|turmeric/.test(s)) return 'antiinflam';

  return 'other';
}

// ════════════════════════════════════════════════════════════════════════════
//  АГРЕГАЦИЯ: 28 mechId → упорядоченный список веществ
//  Выполняется при загрузке модуля (однократно)
// ════════════════════════════════════════════════════════════════════════════
function buildMechToSubs(): Record<TzMechId, SubsByMech> {
  const result = {} as Record<TzMechId, SubsByMech>;
  for (const mechId of ALL_TZ_MECH_IDS) {
    result[mechId] = { mechId, organId: mechOrgan(mechId), count: 0, substances: [] };
  }

  // ─── из SUPPLEMENTS_DB ───
  for (const [substanceId, entries] of Object.entries(SUPPLEMENTS_DB)) {
    if (!Array.isArray(entries)) continue;
    // ★ Исключаем generic классы ("arb_drugs", "statin_drugs", …) — они не
    //   могут быть назначены пользователю; конкретные препараты есть в БД.
    if (isClassLevel(substanceId)) continue;
    for (const e of entries) {
      const mechId = e.mechId as TzMechId;
      if (!ALL_TZ_MECH_IDS.includes(mechId)) continue;
      const organId = (e.organId as TzOrganId) || mechOrgan(mechId);
      if (!ALL_TZ_ORGANS.includes(organId)) continue;
      result[mechId].substances.push({
        substanceId, k: e.k, q: e.q, source: e.source,
        category: classifySubstance(substanceId, organId, mechId),
        organId,
      });
    }
  }
  // ─── из PHARMACY_DB ───
  for (const [substanceId, entries] of Object.entries(PHARMACY_DB)) {
    if (!Array.isArray(entries)) continue;
    if (isClassLevel(substanceId)) continue;
    for (const e of entries) {
      const mechId = e.mechId as TzMechId;
      if (!ALL_TZ_MECH_IDS.includes(mechId)) continue;
      const organId = (e.organId as TzOrganId) || mechOrgan(mechId);
      if (!ALL_TZ_ORGANS.includes(organId)) continue;
      result[mechId].substances.push({
        substanceId, k: e.k, q: e.q, source: e.source,
        category: 'pharma', organId,
      });
    }
  }
  // ─── сортировка по k (desc), q (A>B>C) ───
  const qRank = { A: 0, B: 1, C: 2 } as const;
  for (const mechId of ALL_TZ_MECH_IDS) {
    result[mechId].substances.sort((a, b) => {
      if (Math.abs(a.k - b.k) > 0.001) return b.k - a.k;
      return qRank[a.q] - qRank[b.q];
    });
    result[mechId].count = result[mechId].substances.length;
  }
  return result;
}

function mechOrgan(mechId: TzMechId): TzOrganId {
  if (mechId.startsWith('cv'))  return 'cardio';
  if (mechId.startsWith('liv')) return 'hepatic';
  if (mechId.startsWith('ren')) return 'renal';
  if (mechId.startsWith('cns')) return 'cns';
  if (mechId.startsWith('rep')) return 'reproductive';
  if (mechId.startsWith('hem')) return 'hematologic';
  return 'hematologic';
}

export const TZ_MECH_TO_SUBS: Record<TzMechId, SubsByMech> = buildMechToSubs();

// ════════════════════════════════════════════════════════════════════════════
//  Утилиты доступа
// ════════════════════════════════════════════════════════════════════════════

export function getSubsForMech(mechId: TzMechId, topK?: number): TzMechSubstance[] {
  const list = TZ_MECH_TO_SUBS[mechId]?.substances || [];
  return topK ? list.slice(0, topK) : list;
}

export function getBestSubsForMech(mechId: TzMechId, topN = 3): TzMechSubstance[] {
  return getSubsForMech(mechId, topN);
}

export function getSubsCoverage(substanceId: string): { mechId: TzMechId; k: number }[] {
  const result: { mechId: TzMechId; k: number }[] = [];
  for (const mechId of ALL_TZ_MECH_IDS) {
    for (const s of TZ_MECH_TO_SUBS[mechId].substances) {
      if (s.substanceId === substanceId) {
        result.push({ mechId, k: s.k });
        break;
      }
    }
  }
  return result;
}

// Сила покрытия: сколько механизмов покрывает вещество
export function getSubsBreadth(substanceId: string): number {
  return getSubsCoverage(substanceId).length;
}

// Топ-N substances по breadth (для broad-spectrum отбора)
export function topBreadthSubs(n = 10): { substanceId: string; breadth: number; totalK: number }[] {
  const acc = new Map<string, { breadth: number; totalK: number }>();
  for (const mechId of ALL_TZ_MECH_IDS) {
    for (const s of TZ_MECH_TO_SUBS[mechId].substances) {
      const cur = acc.get(s.substanceId) || { breadth: 0, totalK: 0 };
      cur.breadth += 1;
      cur.totalK += s.k;
      acc.set(s.substanceId, cur);
    }
  }
  return Array.from(acc.entries())
    .map(([substanceId, v]) => ({ substanceId, ...v }))
    .sort((a, b) => b.breadth - a.breadth || b.totalK - a.totalK)
    .slice(0, n);
}

// ════════════════════════════════════════════════════════════════════════════
//  CATEGORY_LIMITS — макс. количество веществ из каждой категории на уровень
//  Base    — минимальный набор的小朋友
//  Medium  — умеренное расширение
//  Max     — максимальный стек
//  Ручной режим — без лимитов (только GUARDRAILS)
// ════════════════════════════════════════════════════════════════════════════
export type SupportLevel = 'base' | 'medium' | 'max' | 'manual';

export const CATEGORY_LIMITS: Record<SupportLevel, Record<TzCategory, number>> = {
  base: {
    hepatoprotector: 2, cardioprotector: 2, nephroprotector: 1,
    neuroprotector: 1, hormonal: 1, hematologic: 2,
    antioxidant: 2, vitamin: 3, mineral: 3,
    amino: 1, adaptogen: 1, antiinflam: 1,
    pharma: 1, other: 1,
  },
  medium: {
    hepatoprotector: 3, cardioprotector: 3, nephroprotector: 2,
    neuroprotector: 2, hormonal: 2, hematologic: 3,
    antioxidant: 3, vitamin: 4, mineral: 4,
    amino: 2, adaptogen: 2, antiinflam: 2,
    pharma: 2, other: 2,
  },
  max: {
    hepatoprotector: 5, cardioprotector: 5, nephroprotector: 3,
    neuroprotector: 3, hormonal: 3, hematologic: 5,
    antioxidant: 5, vitamin: 6, mineral: 6,
    amino: 3, adaptogen: 3, antiinflam: 3,
    pharma: 3, other: 3,
  },
  manual: {
    hepatoprotector: 99, cardioprotector: 99, nephroprotector: 99,
    neuroprotector: 99, hormonal: 99, hematologic: 99,
    antioxidant: 99, vitamin: 99, mineral: 99,
    amino: 99, adaptogen: 99, antiinflam: 99,
    pharma: 99, other: 99,
  },
};

// Общее максимальное число веществ на уровень
export const TOTAL_LIMIT: Record<SupportLevel, number> = {
  base: 12, medium: 20, max: 32, manual: 99,
};

// ════════════════════════════════════════════════════════════════════════════
//  GUARDRAILS — clinical guards (обязательны даже в manual режиме)
//  Возвращают 'block' (нельзя) или 'warn' (предупредить) + reason
// ════════════════════════════════════════════════════════════════════════════
export type GuardLevel = 'block' | 'warn';
export interface GuardrailResult {
  level: GuardLevel;
  reason: string;
  substanceId?: string;
}

export interface GuardrailContext {
  onCourse?: boolean;              // на ААС курсе
  inPCT?: boolean;                 // в ПКТ фазе
  e2Level?: number;                // эстрадиол
  e2Sensitivity?: number;         // эстрадиоловая чувствительность
  hemoglobin?: number;             // гемоглобин
  hematocrit?: number;            // гематокрит
  hasHCG?: boolean;                // есть ХГЧ
  hasAI?: boolean;                 // есть ингибитор ароматазы
  hasTBooster?: boolean;           // есть тест-бустер
  hasGrowthHormone?: boolean;      // GH/пептиды
  bpSystolic?: number;
  liverAlt?: number;
  libidoLow?: boolean;
  lipidLdl?: number;
}

// Классификатор тест-бустеров
const T_BOOSTERS = [
  'fadogia','tongkat_ali','macuna','boron','ashwagandha','turkesterone',
  'tongkat','maca','fenugreek','tribulus','testofen',
];

const AROMATASE_INHIBITORS = [
  'anastrozole','letrozole','exemestane','arimidex','anastro',
];

const SERMS = ['tamoxifen','clomiphene','enclomiphene','raloxifene'];

function isTBooster(id: string): boolean { return T_BOOSTERS.some(t => id === t || id.startsWith(t)); }
function isAI(id: string): boolean { return AROMATASE_INHIBITORS.some(a => id === a || id.startsWith(a)); }
function isSERM(id: string): boolean { return SERMS.some(s => id === s || id.startsWith(s)); }

export function checkGuardrail(
  substanceId: string,
  ctx: GuardrailContext
): GuardrailResult | null {
  const id = substanceId.toLowerCase();
  const e2Low = (ctx.e2Level != null && ctx.e2Level < 20) ||
                  (ctx.e2Sensitivity != null && ctx.e2Sensitivity < 73);
  const e2High = (ctx.e2Level != null && ctx.e2Level > 60);

  // 1. T-бустеры на курсе ААС — блок
  if (ctx.onCourse && !ctx.inPCT && isTBooster(id)) {
    return { level: 'block', reason: `Тест-бустер ${id} на ААС-курсе не нужен — HPTA подавлена, экзогенный T уже высокий. Назначить в ПКТ.`, substanceId };
  }
  // 2. AI при низком эстрадиоле — блок
  if (isAI(id) && e2Low) {
    return { level: 'block', reason: `Ингибитор ароматазы ${id} при E2<20 pg/mL — риск гипоэстрадиолемии (либидо, суставы, липиды). Контроль E2 перед назначением.`, substanceId };
  }
  // 3. AI без показаний — warn
  if (isAI(id) && !e2High && !ctx.onCourse) {
    return { level: 'warn', reason: `Ингибитор ароматазы ${id} без показаний (E2<60 pg/mL и не на курсе). Назначается только при E2>60 pg/mL.`, substanceId };
  }
  // 4. ХГЧ если уже есть — warn (дубль)
  if (id === 'hcg' && ctx.hasHCG) {
    return { level: 'warn', reason: 'ХГЧ уже назначен в плане — дублирование не нужно.', substanceId };
  }
  // 5. T-бустер без ПКТ — warn
  if (isTBooster(id) && !ctx.inPCT && !ctx.onCourse && ctx.libidoLow) {
    return { level: 'warn', reason: `Тест-бустер ${id} при ноrmal-T и не на ПКТ — может подавлять HPTA. Контроль LH/FSH.`, substanceId };
  }
  // 6. Железо при нормальном гемоглобине — warn
  if (id === 'iron' && ctx.hemoglobin != null && ctx.hemoglobin > 150) {
    return { level: 'warn', reason: 'Железо при Hb>150 г/л может усиливать эритроцитоз и окислительный стресс на курсе.', substanceId };
  }
  if (id === 'iron_lipofer' && ctx.hemoglobin != null && ctx.hemoglobin > 150) {
    return { level: 'warn', reason: 'Железо при Hb>150 г/л может усиливать эритроцитоз и окислительный стресс на курсе.', substanceId };
  }
  // 7. Diuretics при нормальном АД — warn
  if ((id === 'furosemide' || id === 'hydrochlorothiazide' || id === 'chlorthalidone' || id === 'spironolactone') && ctx.bpSystolic != null && ctx.bpSystolic < 120) {
    return { level: 'warn', reason: `Диуретик ${id} при САД<120 мм рт.ст. — риск гипотонии. Назначается при АД>140/90.`, substanceId };
  }
  // 8. Сермоид (тамокс) без ПКТ и без гинекомастии — warn
  if ((id === 'tamoxifen' || id === 'clomiphene' || id === 'enclomiphene' || id === 'raloxifene') && !ctx.inPCT && !ctx.onCourse && !ctx.libidoLow) {
    return { level: 'warn', reason: `SERM ${id} без показаний (не ПКТ, не гипогонадизм). Назначается при ПКТ или вторичном гипогонадизме.`, substanceId };
  }
  // 9. Статины при нормальном LDL — warn (но не блок)
  if ((id === 'atorvastatin' || id === 'rosuvastatin' || id === 'simvastatin' || id === 'pravastatin' || id === 'pitavastatin') && ctx.lipidLdl != null && ctx.lipidLdl < 2.5) {
    return { level: 'warn', reason: `Статин ${id} при LDL<2.5 ммоль/л — риски перевешивают пользу. Рассмотреть берегеля/бергамот/омега-3.`, substanceId };
  }
  // 10. 17α-alkylated предупреждение — warn
  if (id === 'superdrol' || id === 'anadrol' || id === 'halotestin' || id === 'stan' || id === 'trena' || id === 'methand' || id === 'oxan') {
    return { level: 'warn', reason: `${id} — 17α-алкилированный орал. Гепатотоксичность, контроль АЛТ/АСТ/ГГТ каждые 2-4 нед.`, substanceId };
  }
  return null;
}

// Проверка списка substances на guardrails
export function screenGuardrails(
  substanceIds: string[],
  ctx: GuardrailContext
): GuardrailResult[] {
  const out: GuardrailResult[] = [];
  const seen = new Set<string>();
  for (const id of substanceIds) {
    const r = checkGuardrail(id, ctx);
    if (r && !seen.has(r.substanceId || '')) {
      out.push(r);
      seen.add(r.substanceId || '');
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  Конфликты между веществами (упрощённая версия)
//  Источник: SUPPORT_CATALOG_DATA conflicts (расширяется при наличии)
// ════════════════════════════════════════════════════════════════════════════
export interface ConflictPair {
  a: string;
  b: string;
  reason: string;
  level: 'block' | 'warn';
}

export const KNOWN_CONFLICTS: ConflictPair[] = [
  { a: 'alpha_lipoic', b: 'cisplatin', reason: 'АЛЬК хелатирует Pt → может снижать эффективность цисплатина (хелатация переходных металлов).', level: 'warn' },
  { a: 'spiramycin',   b: 'aspirin',    reason: 'Макролиды могут ↑ антикоагулянтный эффект аспирина.', level: 'warn' },
  { a: 'quinine',      b: 'warfarin',  reason: 'Хинин потенцирует антикоагулянтный эффект.', level: 'warn' },
  { a: 'melatonin',    b: 'warfarin',  reason: 'Мелатонин может взаимодействовать с антикоагулянтами, риск кровотечения.', level: 'warn' },
  { a: 'anastrozole',  b: 'tamoxifen', reason: 'Тамоксифен и AI вместе — конкурентная блокада эстрогеновых путей, доказано неэффективно/опасно (хотя в одной схеме иногда назначают).', level: 'block' },
  { a: 'clomiphene',   b: 'anastrozole',reason: 'Кломифен повышает E2 (риск), AI снижает — конфронтация. Назначать с интервалом.', level: 'warn' },
  { a: 'eucommia',     b: 'warfarin',  reason: 'Евкоммия потенцирует антикоагулянты.', level: 'warn' },
  { a: 'spironolactone',b:'eplerenone',reason: 'Двойная блокада альдостероновых рецепторов — высокий риск гиперкалиемии.', level: 'block' },
];

export function checkConflict(a: string, b: string): ConflictPair | null {
  const ai = a.toLowerCase(), bi = b.toLowerCase();
  for (const c of KNOWN_CONFLICTS) {
    if ((c.a === ai && c.b === bi) || (c.b === ai && c.a === bi)) return c;
  }
  return null;
}

export function screenPairConflicts(substanceIds: string[]): ConflictPair[] {
  const out: ConflictPair[] = [];
  for (let i = 0; i < substanceIds.length; i++) {
    for (let j = i + 1; j < substanceIds.length; j++) {
      const c = checkConflict(substanceIds[i], substanceIds[j]);
      if (c) out.push(c);
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  Статистика БД (для отладки/UI)
// ════════════════════════════════════════════════════════════════════════════
export function getMechStats(): { mechId: TzMechId; organId: TzOrganId; count: number; topK: number }[] {
  return ALL_TZ_MECH_IDS.map(mechId => {
    const s = TZ_MECH_TO_SUBS[mechId];
    return {
      mechId, organId: s.organId, count: s.count,
      topK: s.substances[0]?.k || 0,
    };
  });
}