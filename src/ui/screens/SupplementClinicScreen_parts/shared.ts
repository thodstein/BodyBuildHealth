// SupplementClinicScreen_parts/shared.ts — общие хелперы и стили для единого
// клинического инструмента (БАД + фарма + пептиды): взаимодействия,
// дозировка, время приёма, клинический контроль.
import { SUPPORT_CATALOG_DATA } from '../../../data/support-database';
import { DEFAULT_DOSAGES } from '../../../data/support-meta';
import {
  THERAPEUTIC_WINDOWS,
  CATEGORY_TIMING,
  TIMING_SLOTS,
  getCatalogFormBio,
} from '../SupportScreen_parts/SupportBioavailabilityData';
import type { MasterDB, SubstanceEntry, InteractionEntry } from '../../../core/types';
import { loadBioStackProfile } from '../../../engines/biostack-ai.engine';
import type { BioStackProfile } from '../../../engines/biostack-ai.engine';

// ── Styles ──
export const card: React.CSSProperties = {
  background: 'rgba(24,24,27,0.55)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
};
export const chip = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 11px',
  borderRadius: 11,
  fontSize: 13,
  border: '1px solid ' + (active ? 'var(--accent)' : 'rgba(255,255,255,0.12)'),
  background: active ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.04)',
  color: active ? 'var(--accent)' : 'var(--text-dim)',
  cursor: 'pointer',
});
export const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--text-dim)',
  margin: '4px 0 10px',
  fontWeight: 700,
};
export const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, var(--accent), #00b894)',
  color: '#021',
  border: 'none',
  borderRadius: 12,
  padding: '11px 16px',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  boxShadow: '0 6px 20px rgba(0,230,138,0.25)',
};
export const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--text)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '10px 14px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

// ── Catalog helpers ──
export function entryName(id: string): string {
  const e = (SUPPORT_CATALOG_DATA as any)[id];
  if (e) return e.nameRu || e.name || id;
  return id;
}
export function getEntry(id: string): any {
  return (SUPPORT_CATALOG_DATA as any)[id] || null;
}
export function allCatalogIds(): { id: string; name: string }[] {
  return Object.keys(SUPPORT_CATALOG_DATA)
    .map((k) => {
      const e = (SUPPORT_CATALOG_DATA as any)[k];
      return { id: e.id || k, name: e.nameRu || e.name || e.id || k };
    })
    .filter((x) => x.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── MasterDB для SynergyEngine (только по выбранному стеку) ──
export function buildMasterDB(ids: string[]): { db: MasterDB; subById: Record<string, SubstanceEntry> } {
  const subs: SubstanceEntry[] = [];
  const interactions: InteractionEntry[] = [];
  const subById: Record<string, SubstanceEntry> = {};
  const sevN = (s: string) => (s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : 1);
  for (const id of ids) {
    const e = getEntry(id);
    if (!e || !e.id) continue;
    const sub: SubstanceEntry = {
      id: e.id,
      name: e.nameRu || e.name || e.id,
      category: Array.isArray(e.category) ? e.category.join('/') : (e.category || ''),
      mechanisms: e.mechanisms || [],
      risks: [...(e.organs || []), ...(e.systems || [])],
    };
    subs.push(sub);
    subById[e.id] = sub;
    for (const s of (e.synergies || []))
      interactions.push({
        substanceA: e.id,
        substanceB: s.with,
        type: 'synergy',
        severity: sevN(s.severity),
        mechanisms: (s.mechanism || '').split(/[,;]/).map((x: string) => x.trim()).filter(Boolean),
        description: s.effect || '',
      });
    for (const c of (e.conflicts || []))
      interactions.push({
        substanceA: e.id,
        substanceB: c.with,
        type: c.severity === 'HIGH' ? 'danger' : 'conflict',
        severity: sevN(c.severity),
        mechanisms: (c.mechanism || '').split(/[,;]/).map((x: string) => x.trim()).filter(Boolean),
        description: c.effect || '',
      });
  }
  const db: MasterDB = {
    effects: [],
    substances: subs,
    interactions,
    goals: [],
    stackTemplates: [],
    stacks: [],
    analyses: [],
    organs: [],
    systems: [],
    mechanisms: [],
    axes: [],
    risks: [],
    recommendations: [],
    tags: [],
    bands: [],
    brands: [],
    aliases: {},
    substanceGroups: {},
    effectGroups: {},
    synergyMatrix: {},
    conflictMatrix: {},
  };
  return { db, subById };
}

// ── Dose helpers ──
export interface DoseInfo {
  id: string;
  name: string;
  defaultDose: { mg: number; timing: string } | null;
  window: { minMg: number; optMg: number; maxMg: number; ul: number; note: string } | null;
  bestForm: { name: string; bio: number } | null;
}
const WINDOW_BY_ID: Record<string, string> = {
  zinc: 'zn', magnesium: 'mg', iron: 'fe', calcium: 'ca', selenium: 'se',
  vitamin_d3: 'd3', vitamin_c: 'vitc', alpha_lipoic: 'ala', nac: 'nac',
  coq10: 'coq10', omega3: 'omega3', chromium: 'cr', vitamin_b12: 'b12',
  vitamin_e: 'vitc', vitamin_b6: 'b12', folate: 'b12',
  // Расширенные маппингы
  iodine: 'iodine', copper: 'zn', potassium: 'mg', iron_bisglycinate: 'fe',
  berberine: 'nac', curcumin: 'coq10', milk_thistle: 'nac', tudca: 'nac',
  ashwagandha: 'mg', glycine: 'mg', theanine: 'mg', taurine: 'nac',
  l_carnitine: 'nac', phosphatidylserine: 'coq10', phosphatidylcholine: 'coq10',
  quercetin: 'coq10', garlic: 'vitc', beetroot: 'vitc', bergamot: 'coq10',
  astaxanthin: 'coq10', pycnogenol: 'coq10', hesperidin: 'coq10',
  niacin: 'vitc', tmG: 'nac', agmatine: 'nac', citrulline: 'nac',
  collagen: 'd3', glucosamine: 'd3', chondroitin: 'd3', msm: 'd3',
  vitamin_k2: 'd3', vitamin_a: 'd3',
  serrapeptase: 'nac', nattokinase: 'nac', bromelain: 'nac',
  melatonin: 'mg', probiotics: 'nac', egcg: 'coq10',
  astragalus: 'nac', cordyceps: 'nac',
};
export function getDoseInfo(id: string): DoseInfo {
  const e = getEntry(id);
  const name = e?.nameRu || e?.name || id;
  const defaultDose = DEFAULT_DOSAGES[id] || DEFAULT_DOSAGES[id.toLowerCase()] || null;
  const base = id.split('_')[0];
  const winKey = WINDOW_BY_ID[id] || WINDOW_BY_ID[base] || THERAPEUTIC_WINDOWS[id] ? id : base;
  const window =
    THERAPEUTIC_WINDOWS[winKey] ||
    THERAPEUTIC_WINDOWS[id] ||
    THERAPEUTIC_WINDOWS[base] ||
    null;
  let bestForm: { name: string; bio: number } | null = null;
  if (e?.forms?.length) {
    for (const f of e.forms) {
      const bio = getCatalogFormBio(f);
      if (!bestForm || bio > bestForm.bio) bestForm = { name: f.name, bio };
    }
  }
  return { id, name, defaultDose, window, bestForm };
}

// ── Timing helpers ──
export function getTimingForId(id: string): { slot: string; reason: string } {
  const e = getEntry(id);
  const cats: string[] = e?.category || [];
  for (const c of cats) {
    if ((CATEGORY_TIMING as any)[c]) return (CATEGORY_TIMING as any)[c];
  }
  const base = cats[0] || id.split('_')[0];
  if ((CATEGORY_TIMING as any)[base]) return (CATEGORY_TIMING as any)[base];
  const map: Record<string, string> = {
    fat_soluble: 'morning_food', hepatoprotector: 'morning_food', liver: 'morning_food',
    bile: 'night_empty', choleretic: 'morning_food', cardioprotector: 'morning_food',
    cardio: 'morning_food', mineral: 'morning_empty', amino: 'morning_empty',
    antioxidant: 'morning_empty', vitamin: 'morning_food', neuro: 'morning_food',
    neuroprotector: 'morning_food', immune: 'morning_food', immunomodulator: 'morning_food',
    sleep: 'night_empty', hormonal: 'morning_empty', adaptogen: 'morning_food',
    joint: 'morning_food', renal: 'morning_food', renoprotector: 'morning_food',
    thyroid: 'morning_food', antiinflammatory: 'morning_food', gut: 'morning_empty',
    probiotic: 'morning_empty', peptide: 'morning_empty', pharma: 'morning_food',
    herb: 'morning_food', nootropic: 'morning_food', metabolic: 'morning_food',
    anabolic: 'morning_empty', antimicrobial: 'morning_empty', anxiolytic: 'night_empty',
    anti_aging: 'morning_food', mitochondrial: 'morning_food', anticoagulant: 'morning_food',
  };
  const slot = map[base] || 'morning_food';
  return { slot, reason: 'Категория по умолчанию — утро с едой.' };
}
export function timingSlotMeta(key: string) {
  return (TIMING_SLOTS as any).find((s: any) => s.key === key) || { key, label: key, time: '' };
}

// ── Profile ──
export function loadProfile(): BioStackProfile {
  try {
    return loadBioStackProfile ? loadBioStackProfile() : ({} as BioStackProfile);
  } catch {
    return {} as BioStackProfile;
  }
}
