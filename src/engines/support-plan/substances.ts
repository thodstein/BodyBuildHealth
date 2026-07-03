/**
 * support-plan/substances.ts — построение PlanSubstance[] и schedule.
 */

import { DEFAULT_DOSAGES } from '../../data/support-database';
import type { CalculatorResult } from '../support-calculator.types';
import type { PlanSubstance } from '../support-plan-engine';
import { catalogEntry } from './types';

/**
 * Преобразует список id веществ в PlanSubstance[] (с dedup).
 * Берёт display-инфо из каталога SUPPORT_CATALOG_DATA, дозировки из DEFAULT_DOSAGES.
 */
export function buildSubstances(ids: string[], _tzRes: CalculatorResult): PlanSubstance[] {
  const seen = new Set<string>();
  const out: PlanSubstance[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue; // dedup — BUG 8
    seen.add(id);
    const e = catalogEntry(id);
    const def = DEFAULT_DOSAGES[id];
    const doseMg = def?.mg ?? e?.dosage?.mg ?? 500;
    const doseDisplay = def
      ? (def.mg >= 1000 ? `${(def.mg / 1000).toFixed(1)} г` : `${def.mg} мг`)
      : (e?.dosage?.mg
          ? (e.dosage.mg >= 1000 ? `${(e.dosage.mg / 1000).toFixed(1)} г` : `${e.dosage.mg} мг`)
          : 'по инструкции');
    out.push({
      id,
      name: e?.nameRu || e?.name || id,
      doseMg,
      doseDisplay,
      timing: def?.timing || e?.dosageForms?.[0]?.dosage || 'с едой',
      category: e?.category || [],
      tier: e?.tier || 'standard',
      targetSystems: e?.targetSystems || e?.systems || [],
      comment: e?.description || '',
      mechanismReason: e?.mechanisms?.[0] || '',
      fromJoint: false,
      fromBoost: false,
    });
  }
  return out;
}

// ─── Schedule (morning/afternoon/evening) ───
const MORNING_GROUP = new Set([
  'vitamin_c','vitamin_d3','vitamin_e','coq10','alpha_lipoic','selenium','boron','zinc',
  'telmisartan','nebivolol','ashwagandha','calcium','vitamin_k2','probiotics',
  'anastrozole','cabergoline','hcg','curcumin','dhea','pregnenolone','collagen',
  'melatonin','l_citrulline','DIM','saw_palmetto','b12','folate','betaine',
]);
const AFTERNOON_GROUP = new Set([
  'berberine','bromelain','nattokinase','magnesium','potassium','artichoke','bile_acids',
  'omega3','glucosamine','msm','boswellia','chondroitin_sulfate','taurine','inositol',
  'piperine','reishi','maitake','shilajit','chaga','cordyceps','lions_mane',
]);
const EVENING_GROUP = new Set([
  'nac','tudca','milk_thistle','glycine','theanine','gaba','tyrosine','l_dopa',
  'x5htp','vitamin_b6','astragalus','celery_extract','glutathione','bergamot',
  'red_yeast','aspirin','tamoxifen','5htp','hyaluronic_acid','bpc157','tb500',
]);

function timeOf(id: string): 'morning' | 'afternoon' | 'evening' {
  if (MORNING_GROUP.has(id)) return 'morning';
  if (AFTERNOON_GROUP.has(id)) return 'afternoon';
  if (EVENING_GROUP.has(id)) return 'evening';
  return 'morning';
}

/**
 * Распределение веществ по времени приёма (утро/день/вечер).
 * Для каждого вещества: id, name, dose, instructions.
 */
export function buildSchedule(
  ids: string[]
): Array<{ timeBlock: string; substances: Array<{ id: string; name: string; dose: string; instructions: string }> }> {
  const blocks: Record<'morning' | 'afternoon' | 'evening', Array<{ id: string; name: string; dose: string; instructions: string }>> = {
    morning: [], afternoon: [], evening: [],
  };
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const e = catalogEntry(id);
    const def = DEFAULT_DOSAGES[id];
    const name = e?.nameRu || e?.name || id;
    const dose = def
      ? (def.mg >= 1000 ? `${(def.mg / 1000).toFixed(1)} г` : `${def.mg} мг`)
      : (e?.dosage?.mg ? `${e.dosage.mg} мг` : 'по инструкции');
    const block = timeOf(id);
    blocks[block].push({
      id, name, dose,
      instructions: block === 'morning' ? 'С завтраком' : block === 'afternoon' ? 'С обедом' : 'За 1-2 ч до сна',
    });
  }
  return (['morning', 'afternoon', 'evening'] as const).map(b => ({ timeBlock: b, substances: blocks[b] }));
}

// ─── Week scale (titration) ───
export function computeWeekScale(week: number | undefined): number {
  const w = week ?? 1;
  if (w <= 2) return 0.5;
  if (w <= 4) return 0.75;
  if (w <= 6) return 0.9;
  return 1.0;
}
