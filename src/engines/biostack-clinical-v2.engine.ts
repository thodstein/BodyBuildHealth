import { SUPPORT_CATALOG_DATA } from '../data/support-database';
import type { BioStackProfile } from './biostack-ai.engine';
import {
  optimizeTiming,
  getSafeStackRecommendations,
  checkStackToxicity,
  applyLabAdjustments,
  type LabAdjustment,
  type DrugSafetyExclusion,
  type DrugSafetyTitration,
} from './biostack-safety.engine';
import { normalizeMechanisms } from './biostack-mechanism-normalizer';
import { getCost } from './biostack-budget.engine';
import type { LabCompositeResult } from './lab-analysis.engine';
import { SUBSTANCE_ANALOGS, SUPPLEMENT_COMPOSITION, COMPONENT_TO_COMPLEX } from '../data/support-meta';

/* ─────────────────────────────────────────────────────────────────────────
   Clinical-grade improvements for BioStack (sports pharmacology audit)
   Covers: evidence grading, absolute contraindications (hard stop),
   antioxidant-pathway redundancy / hormesis, daily schedule, cycling/phase
   advice, ingredient-allergen check, fuzzy search, complex decomposition,
   and a unified selection gate (selectStack).
   ───────────────────────────────────────────────────────────────────────── */

interface CatEntry {
  nameRu?: string;
  name?: string;
  dosage?: { mg?: number; timing?: string };
  timingDosage?: string;
  contraindications?: string[];
  mechanisms?: string[];
  tier?: string;
}

const cat = (id: string): CatEntry | undefined => SUPPORT_CATALOG_DATA[id] as CatEntry | undefined;
const nameOf = (id: string): string => {
  const c = cat(id);
  return c?.nameRu || c?.name || id;
};

/* ════════════════════════════════════════════════════════════════
   1. EVIDENCE GRADE  (A=1.0, B=0.7, C=0.4)
   Curated from guideline / Cochrane / FDA-label / NIH-OBS references.
   ════════════════════════════════════════════════════════════════ */

export type EvidenceGrade = 'A' | 'B' | 'C';

export const EVIDENCE_GRADE: Record<string, EvidenceGrade> = {
  // A — strong clinical / guideline
  zinc: 'A', zinc_picolinate: 'A', zinc_carnosine: 'A',
  magnesium: 'A', magnesium_glycinate: 'A', magnesium_citrate: 'A', magnesium_l_threonate: 'A',
  vitamin_d3: 'A', vitamin_c: 'A', vitamin_b6: 'A', vitamin_b12: 'A',
  folate: 'A', iron: 'A', creatine: 'A', nac: 'A',
  omega3: 'A', fish_oil: 'A', krill_oil: 'A', coq10: 'A',
  vitamin_k2: 'A', calcium: 'A', selenium: 'A', iodine: 'A',
  milk_thistle: 'A', tudca: 'A', berberine: 'A', curcumin: 'A',
  ashwagandha: 'A', melatonin: 'A', l_carnitine: 'A', alpha_lipoic: 'A',
  citrulline: 'A', taurine: 'A',
  // B — moderate / plausible
  vitamin_e: 'B', vitamin_a: 'B', copper: 'B', manganese: 'B', boron: 'B',
  chromium: 'B', potassium: 'B', glycine: 'B', theanine: 'B', glutamine: 'B',
  agmatine: 'B', tongkat_ali: 'B', fadogia: 'B', dhea: 'B',
  rhodiola: 'B', bacopa: 'B', ginseng: 'B', cordyceps: 'B', reishi: 'B',
  chaga: 'B', turkey_tail: 'B', lion_mane: 'B', astaxanthin: 'B',
  resveratrol: 'B', pqq: 'B', tyrosine: 'B', '5htp': 'B', gaba: 'B', l_dopa: 'B',
  hesperidin: 'B', diosmin: 'B', bromelain: 'B', serrapeptase: 'B', natokinase: 'B',
  // C — mechanistic / traditional (everything else falls back to C)
};

export function getEvidenceGrade(id: string): EvidenceGrade {
  return EVIDENCE_GRADE[id] || 'C';
}

export function evidenceWeight(g: EvidenceGrade): number {
  return g === 'A' ? 1.0 : g === 'B' ? 0.7 : 0.4;
}

/* ════════════════════════════════════════════════════════════════
   2. ABSOLUTE CONTRAINDICATIONS  (HARD STOP)
   A substance is hard-excluded when its catalog `contraindications`
   string names the user's condition, current medication, allergy, or
   explicit avoid-list.
   ════════════════════════════════════════════════════════════════ */

export interface AbsoluteContraindication {
  substanceId: string;
  substanceName: string;
  reason: string;
  source: 'condition' | 'med' | 'allergy' | 'avoid';
}

const CONDITION_KEYWORDS: Record<string, string[]> = {
  liver: ['печен', 'гепат', 'цироз', 'желч', 'холе', 'билиарн'],
  kidney: ['почк', 'нефр', 'еГФР', 'хпн', 'клиренс', 'егфр'],
  heart: ['серд', 'карди', 'сердечн', 'клапан', 'миокард', 'кардиомиопат'],
  thyroid: ['щитов', 'тирео', 'гипертиреоз', 'гипотиреоз'],
  stomach: ['желуд', 'язв', 'жкт', 'жкб', 'гастр'],
  pressure_high: ['гипертенз', 'давлен выс', 'гипертони', 'гипертен'],
  pressure_low: ['гипотенз', 'давлен низ', 'гипотони'],
  diabetes: ['диабет', 'сахарн', 'гликем'],
  autoimmune: ['аутоим', 'иммуносупр', 'иммуносупресс'],
  pregnancy: ['беременн', 'лактац', 'кормлен', 'грудн', 'гестац'],
  bipolar: ['биполяр', 'маниакальн', 'мани', 'психоз', 'аффективн'],
  glaucoma: ['глауком', 'внутриглазн', 'офтальмотонус'],
  asthma: ['астм', 'бронхоспазм', 'бронхиальн', 'обструктивн'],
  epilepsy: ['эпилепс', 'судорог', 'припад', 'порог судорожн'],
};

function buildUserMedTokens(p: BioStackProfile): string[] {
  const meds = [...(p.currentMeds || []), ...(p.avoidMeds || [])];
  const tokens: string[] = [];
  for (const m of meds) {
    const lower = m.toLowerCase().trim();
    if (lower.length > 3) tokens.push(lower);
  }
  return tokens;
}

export function checkAbsoluteContraindications(
  stackIds: string[],
  profile: BioStackProfile,
): AbsoluteContraindication[] {
  const out: AbsoluteContraindication[] = [];
  const medTokens = buildUserMedTokens(profile);
  const allergyKw = (profile.drugAllergies || []).map(a => a.toLowerCase().trim()).filter(a => a.length > 2);
  const avoidSet = new Set((profile.avoidIds || []).map(a => a.toLowerCase()));

  for (const id of stackIds) {
    const c = cat(id);
    if (!c) continue;
    const ci = c.contraindications || [];
    const idLower = id.toLowerCase();

    // explicit avoid
    if (avoidSet.has(idLower)) {
      out.push({ substanceId: id, substanceName: nameOf(id), reason: 'Исключён пользователем (чёрный список)', source: 'avoid' });
      continue;
    }

    let hit: AbsoluteContraindication | null = null;
    for (const line of ci) {
      const low = line.toLowerCase();
      // condition match (structured by HealthCondition code):
      // a catalog contraindication line maps to a condition code via the
      // same keyword families used for user profiling, so detection is
      // code-based rather than requiring a magic ABSOLUTE_MARKERS token.
      for (const code of (profile.healthConditions || []) as string[]) {
        const kws = CONDITION_KEYWORDS[code] || [];
        if (kws.some(kw => low.includes(kw))) {
          hit = { substanceId: id, substanceName: nameOf(id), reason: `Противопоказано при состоянии «${code}»: «${line}»`, source: 'condition' };
          break;
        }
      }
      if (hit) break;
      // med match
      for (const tok of medTokens) {
        if (low.includes(tok)) {
          hit = { substanceId: id, substanceName: nameOf(id), reason: `Конфликт с принимаемым препаратом: «${line}»`, source: 'med' };
          break;
        }
      }
      if (hit) break;
      // allergy match (substance-level)
      for (const a of allergyKw) {
        if (low.includes(a)) {
          hit = { substanceId: id, substanceName: nameOf(id), reason: `Возможная аллергия: «${line}»`, source: 'allergy' };
          break;
        }
      }
      if (hit) break;
    }
    if (hit) out.push(hit);
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════
   3. ANTIOXIDANT-PATHWAY REDUNDANCY / HORMESIS
   >2 substances on the same antioxidant pathway → diminishing
   returns + potential hormesis harm.
   ════════════════════════════════════════════════════════════════ */

const ANTIOXIDANT_PATHWAY: Record<string, string> = {
  nac: 'glutathione', glutathione: 'glutathione',
  vitamin_c: 'vitc_ascorbate',
  vitamin_e: 'lipid_peroxidation',
  alpha_lipoic: 'multisystem_redox',
  coq10: 'mito_etc',
  curcumin: 'nrf2',
  astaxanthin: 'lipid_peroxidation',
  resveratrol: 'nrf2',
  berberine: 'nrf2',
  selenium: 'selenoprotein',
  magnesium: 'nonspecific_os',
};

export interface PathwayRedundancy {
  pathway: string;
  ids: string[];
  names: string[];
  count: number;
  severity: 'ok' | 'warning';
  message: string;
}

export function checkPathwayRedundancy(stackIds: string[]): PathwayRedundancy[] {
  const byPath: Record<string, string[]> = {};
  for (const id of stackIds) {
    const p = ANTIOXIDANT_PATHWAY[id.toLowerCase()];
    if (!p) continue;
    if (!byPath[p]) byPath[p] = [];
    byPath[p].push(id);
  }
  const out: PathwayRedundancy[] = [];
  for (const [pathway, ids] of Object.entries(byPath)) {
    if (ids.length <= 2) continue;
    out.push({
      pathway,
      ids,
      names: ids.map(nameOf),
      count: ids.length,
      severity: 'warning',
      message: `Путь «${pathway}» перегружен (${ids.length} антиоксиданта). Риск гормезиса и снижения эндогенной антиоксидантной сети — оставьте ≤2.`,
    });
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════
   4. DAILY SCHEDULE  (concrete deliverable from optimizeTiming)
   ════════════════════════════════════════════════════════════════ */

export type DaySlot = 'morning' | 'afternoon' | 'evening' | 'night' | 'fasting';

export interface DailyScheduleSlot {
  time: DaySlot;
  ids: string[];
  names: string[];
}

export function buildDailySchedule(stackIds: string[]): DailyScheduleSlot[] {
  const recs = optimizeTiming(stackIds);
  const map = new Map<DaySlot, { ids: string[]; names: string[] }>();
  const push = (t: DaySlot, id: string) => {
    if (!map.has(t)) map.set(t, { ids: [], names: [] });
    const e = map.get(t)!;
    if (!e.ids.includes(id)) { e.ids.push(id); e.names.push(nameOf(id)); }
  };

  for (const r of recs) push(r.recommendedTiming, r.substanceId);

  // substances without a specific recommendation → use catalog timing
  for (const id of stackIds) {
    if (recs.some(r => r.substanceId === id)) continue;
    const c = cat(id);
    const raw = (c as any)?.timingDosage || c?.dosage?.timing || 'morning';
    const t: DaySlot = raw.toLowerCase().includes('веч') || raw.toLowerCase().includes('night') || raw.toLowerCase().includes('сон')
      ? 'evening'
      : raw.toLowerCase().includes('обед') || raw.toLowerCase().includes('день')
      ? 'afternoon'
      : 'morning';
    push(t, id);
  }

  const order: DaySlot[] = ['morning', 'afternoon', 'evening', 'night'];
  return order.filter(t => map.has(t)).map(t => ({ time: t, ...map.get(t)! }));
}

/* ════════════════════════════════════════════════════════════════
   5. CYCLING / DURATION / TRAINING-PHASE ADVICE
   ════════════════════════════════════════════════════════════════ */

export const STACK_DURATION: Record<string, number> = {
  nac: 8, tudca: 8, milk_thistle: 12, berberine: 16, curcumin: 12,
  ashwagandha: 8, rhodiola: 6, bacopa: 12, ginseng: 8,
  tongkat_ali: 8, fadogia: 8, dhea: 12, melatonin: 4,
  creatine: 52, magnesium: 52, vitamin_d3: 52, zinc: 16,
  omega3: 52, coq10: 52, alpha_lipoic: 12, citrulline: 16,
  agmatine: 10, theanine: 16, l_carnitine: 16, taurine: 52,
  glycogen_recompound: 8, yohimbine: 4, synephrine: 8, caffeine: 52,
};

export interface CyclingAdvice {
  substanceId: string;
  name: string;
  durationWeeks: number;
  cycleNote: string;
  phaseBind: string;
}

export function getStackCyclingAdvice(
  stackIds: string[],
  aasStatus: string,
): CyclingAdvice[] {
  const out: CyclingAdvice[] = [];
  const onCourse = aasStatus === 'course' || aasStatus === 'bridge' || aasStatus === 'trt';
  for (const id of stackIds) {
    const dur = STACK_DURATION[id.toLowerCase()] ?? 12;
    let cycleNote = `Курс ${dur} нед, затем перерыв 2–4 нед (wash-out).`;
    let phaseBind = 'Весь период';
    if (onCourse) {
      phaseBind = aasStatus === 'course' ? 'Совместно с ААС-курсом' : 'На поддержке / TRT';
    } else if (id.toLowerCase().includes('ashwagandha') || id.toLowerCase().includes('rhodiola')) {
      phaseBind = 'Фаза перетренированности / высокого стресса';
    } else if (id.toLowerCase().includes('creatine') || id.toLowerCase().includes('citrulline')) {
      phaseBind = 'Фаза объёма и силовых блоков';
    }
    out.push({ substanceId: id, name: nameOf(id), durationWeeks: dur, cycleNote, phaseBind });
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════
   6. INGREDIENT ALLERGEN CHECK  (from composition data)
   ════════════════════════════════════════════════════════════════ */

export interface AllergenHit {
  substanceId: string;
  substanceName: string;
  allergen: string;
  component: string;
}

export function checkIngredientAllergens(
  stackIds: string[],
  allergies: string[],
): AllergenHit[] {
  const out: AllergenHit[] = [];
  const al = (allergies || []).map(a => a.toLowerCase().trim()).filter(a => a.length > 2);
  if (!al.length) return out;

  for (const id of stackIds) {
    const comp: any = (SUPPLEMENT_COMPOSITION as any)?.[id];
    if (!comp) continue;
    const items: any[] = Array.isArray(comp) ? comp : (comp.components || []);
    for (const item of items) {
      const nm = (item?.name || item?.nameRu || String(item)).toLowerCase();
      for (const a of al) {
        if (nm.includes(a)) {
          out.push({ substanceId: id, substanceName: nameOf(id), allergen: a, component: item?.name || item?.nameRu || String(item) });
        }
      }
    }
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════
   7. FUZZY SEARCH  (subsequence + token overlap)
   ════════════════════════════════════════════════════════════════ */

function norm(s: string): string {
  return s.toLowerCase().replace(/[ё]/g, 'е').replace(/[^a-zа-я0-9]/g, '');
}

function subsequence(a: string, b: string): boolean {
  let i = 0;
  for (const ch of b) {
    if (a[i] === ch) i++;
    if (i === a.length) return true;
  }
  return i >= Math.ceil(a.length * 0.7);
}

export interface FuzzyHit { id: string; name: string; score: number; }

export function fuzzySearchSupplements(query: string, limit = 20): FuzzyHit[] {
  const q = norm(query);
  if (!q) return [];
  const hits: FuzzyHit[] = [];
  for (const [id, c] of Object.entries(SUPPORT_CATALOG_DATA)) {
    const entry = c as CatEntry;
    const name = norm(entry.nameRu || entry.name || id);
    let score = 0;
    if (name === q) score = 100;
    else if (name.includes(q)) score = 80;
    else if (subsequence(q, name)) score = 60;
    else if (subsequence(q, norm(id))) score = 50;
    if (score > 0) hits.push({ id, name: entry.nameRu || entry.name || id, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ════════════════════════════════════════════════════════════════
   8. COMPLEX DECOMPOSITION  (reverse index into components)
   ════════════════════════════════════════════════════════════════ */

export interface DecomposedComponent { componentId: string; componentName: string; }

export function decomposeComplex(id: string): DecomposedComponent[] {
  const out: DecomposedComponent[] = [];
  const comp: any = (SUPPLEMENT_COMPOSITION as any)?.[id];
  if (comp) {
    const items: any[] = Array.isArray(comp) ? comp : (comp.components || []);
    for (const item of items) {
      const cid = item?.id || item?.componentId || String(item);
      out.push({ componentId: cid, componentName: item?.name || item?.nameRu || cid });
    }
  }
  // also check complex→component reverse map
  const rev: any = (COMPONENT_TO_COMPLEX as any)?.[id];
  if (rev && Array.isArray(rev) && !out.length) {
    for (const r of rev) out.push({ componentId: r?.id || String(r), componentName: r?.name || r?.nameRu || String(r) });
  }
  return out;
}

/* ════════════════════════════════════════════════════════════════
   9. MEANINGFUL REPLACEMENT  (analog group + evidence + avoidance)
   Used by Build UI instead of finder's superficial findReplacement.
   ════════════════════════════════════════════════════════════════ */

export interface MeaningfulReplacement {
  originalId: string;
  replacementId: string;
  replacementName: string;
  reason: string;
  safetyNote: string;
  gradeUpgrade: boolean;
}

// Whole-catalog analog fallback: when a substance has no curated
// SUBSTANCE_ANALOGS entry, derive replacement candidates from any catalog
// substance sharing normalized mechanisms or the same category. This lifts
// analog coverage from the ~30 hand-curated entries to the entire catalog.
export function deriveAnalogsByMechanism(
  originalId: string,
  limit = 4,
): { id: string; name: string; group: string; note: string }[] {
  const orig = cat(originalId);
  if (!orig) return [];
  const origMech = new Set(normalizeMechanisms(orig.mechanisms || []));
  const origCats = new Set((orig as any).category || []);
  const results: { id: string; name: string; group: string; note: string; score: number }[] = [];
  for (const [id, entry] of Object.entries(SUPPORT_CATALOG_DATA)) {
    if (id.toLowerCase() === originalId.toLowerCase()) continue;
    const e = entry as CatEntry;
    const mech = normalizeMechanisms(e.mechanisms || []);
    let shared = 0;
    for (const m of mech) if (origMech.has(m)) shared++;
    const cats = new Set((e as any).category || []);
    let sharedCat = false;
    for (const c of cats) if (origCats.has(c)) { sharedCat = true; break; }
    if (shared === 0 && !sharedCat) continue;
    // не предлагать диагностические маркеры-заглушки и гормоны в качестве замен
    const candCats = ((e as any).category || []) as string[];
    if (candCats.includes('marker') || candCats.includes('hormonal')) continue;
    results.push({
      id,
      name: nameOf(id),
      group: sharedCat ? 'категория' : 'механизм',
      note: `сходный механизм (${shared})`,
      score: shared * 100 + (sharedCat ? 20 : 0),
    });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(({ id, name, group, note }) => ({ id, name, group, note }));
}

export function findMeaningfulReplacement(
  originalId: string,
  profile: BioStackProfile,
  excludedIds: string[] = [],
): MeaningfulReplacement | null {
  let analogs: any = (SUBSTANCE_ANALOGS as any)?.[originalId];
  if (!analogs || !Array.isArray(analogs) || !analogs.length) {
    analogs = deriveAnalogsByMechanism(originalId);
  }
  if (!analogs.length) return null;

  const condKw = new Set<string>();
  for (const code of (profile.healthConditions || []) as string[]) {
    for (const kw of (CONDITION_KEYWORDS[code] || [])) condKw.add(kw);
  }
  const medTokens = buildUserMedTokens(profile);
  const avoidSet = new Set([...(profile.avoidIds || []), ...excludedIds].map(a => a.toLowerCase()));

  let best: MeaningfulReplacement | null = null;
  let bestScore = -1;

  const origMechSet = new Set(normalizeMechanisms((cat(originalId)?.mechanisms) || []));
  const origCatsSet = new Set((cat(originalId) as any)?.category || []);
  for (const cand of analogs) {
    const cid = cand?.id || cand;
    if (!cid || cid.toLowerCase() === originalId.toLowerCase() || avoidSet.has(cid.toLowerCase())) continue;
    const c = cat(cid);
    if (!c) continue;
    // замена строго по терапевтическому классу: не предлагать маркеры/гормоны
    const candCats = ((c as any).category || []) as string[];
    if (candCats.includes('marker') || candCats.includes('hormonal')) continue;
    // reject if the candidate is itself absolutely contraindicated
    const ci = c.contraindications || [];
    let forbidden = false;
    for (const line of ci) {
      const low = line.toLowerCase();
      if (condKw.size && [...condKw].some(kw => low.includes(kw))) { forbidden = true; break; }
      if (medTokens.some(tok => low.includes(tok))) { forbidden = true; break; }
    }
    if (forbidden) continue;

    const cMech = normalizeMechanisms(c.mechanisms || []);
    let shared = 0;
    for (const m of cMech) if (origMechSet.has(m)) shared++;
    let sharedCat = false;
    for (const catName of candCats) if (origCatsSet.has(catName)) { sharedCat = true; break; }
    const gOrig = evidenceWeight(getEvidenceGrade(originalId));
    const gCand = evidenceWeight(getEvidenceGrade(cid));
    // приоритет — совпадение механизмов/класса с оригиналом, а не общая «накачанность» кандидата
    const score = shared * 100 + (sharedCat ? 20 : 0) + gCand;
    if (score > bestScore) {
      bestScore = score;
      best = {
        originalId,
        replacementId: cid,
        replacementName: nameOf(cid),
        reason: `Аналог по группе «${cand?.group || 'совместимый'}»: ${cand?.note || 'сходный механизм действия'}`,
        safetyNote: gCand >= gOrig ? 'Грейд доказательности не ниже оригинала.' : 'Грейд доказательности ниже — приоритет за клинически подтверждённым.',
        gradeUpgrade: gCand > gOrig,
      };
    }
  }
  return best;
}

/* ════════════════════════════════════════════════════════════════
   10. UNIFIED SELECTION GATE  (selectStack)
   Takes candidate ids (from recommender) and applies ALL safety gates:
   absolute hard-stop removal, drug-exclusion removal, UL warning,
   lab adjustment, daily schedule, redundancy, cycling advice.
   ════════════════════════════════════════════════════════════════ */

export type StackStrategy = 'comprehensive' | 'safe' | 'budget';

export interface SelectStackResult {
  ids: string[];
  hardStops: AbsoluteContraindication[];
  drugExclusions: DrugSafetyExclusion[];
  drugTitrations: DrugSafetyTitration[];
  ulWarnings: { substanceId: string; name: string; totalDose: number; ul: number; percentUL: number; severity: string; message: string }[];
  labAdjustments: LabAdjustment[];
  schedule: DailyScheduleSlot[];
  redundancy: PathwayRedundancy[];
  cycling: CyclingAdvice[];
  strategy: StackStrategy;
}

export function selectStack(
  candidateIds: string[],
  profile: BioStackProfile,
  strategy: StackStrategy,
  lab?: LabCompositeResult | null,
): SelectStackResult {
  // 1. absolute hard stops
  const hardStops = checkAbsoluteContraindications(candidateIds, profile);
  const hardStopIds = new Set(hardStops.map(h => h.substanceId));
  let ids = candidateIds.filter(id => !hardStopIds.has(id));

  // 2. drug–supplement exclusions (HIGH → exclude; MEDIUM → flag for titration)
  const recs = getSafeStackRecommendations(ids, profile.currentMeds || []);
  const drugExclusions: DrugSafetyExclusion[] = recs.excluded;
  const drugTitrations: DrugSafetyTitration[] = recs.titrations;
  const exIds = new Set(drugExclusions.map(e => e.substanceId));
  ids = ids.filter(id => !exIds.has(id));

  // 3. budget cap
  if (strategy === 'budget') {
    const max = 7000; // бюджетный лимит (поле budget удалено из профиля — фиксированный потолок)
    const costById: Record<string, number> = {};
    for (const id of ids) costById[id] = getCost(id) || 300;
    const sorted = [...ids].sort((a, b) => costById[a] - costById[b]);
    let remaining = max;
    const kept: string[] = [];
    for (const id of sorted) {
      const c = costById[id];
      if (remaining - c >= 0) { kept.push(id); remaining -= c; }
    }
    if (kept.length) ids = kept;
  }

  // 4. UL toxicity
  const ulWarnings = checkStackToxicity(ids);

  // 5. lab adjustments
  const labAdjustments: LabAdjustment[] = lab ? applyLabAdjustments(ids, lab) : [];

  // 6. schedule / redundancy / cycling
  const schedule = buildDailySchedule(ids);
  const redundancy = checkPathwayRedundancy(ids);
  const cycling = getStackCyclingAdvice(ids, 'none');

  return {
    ids,
    hardStops,
    drugExclusions,
    drugTitrations,
    ulWarnings,
    labAdjustments,
    schedule,
    redundancy,
    cycling,
    strategy,
  };
}
