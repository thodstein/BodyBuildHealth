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
// Единый резолвер окна дозы: реестр UL → таблица окон → диапазоны → «нет данных».
import { doseWindowFor } from '../../../engines/support-hub-evidence.engine';
import type { DoseWindow } from '../../../engines/support-hub-evidence.engine';
import { DOSE_RANGES } from '../SupportScreen_parts/SupportEffectiveDose';

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
  /** Окно дозы из ЕДИНОГО резолвера (`doseWindowFor`): реестр UL приоритетнее
   *  таблицы окон, тип предела назван в `limitText`. Своей карты «вещество →
   *  чужое окно» здесь больше нет. */
  window: DoseWindow | null;
  bestForm: { name: string; bio: number } | null;
}

export function getDoseInfo(id: string): DoseInfo {
  const e = getEntry(id);
  const name = e?.nameRu || e?.name || id;
  const defaultDose = DEFAULT_DOSAGES[id] || DEFAULT_DOSAGES[id.toLowerCase()] || null;
  // БЫЛО: карта `WINDOW_BY_ID` подставляла ЧУЖОЕ окно — витамин E получал окно
  // витамина C (90–2000 мг), B6 и фолат — окно B12 (2.4–1000 мкг), медь — окно
  // цинка (15–50 мг), калий и ашваганда — окно магния. Отсюда «UL 40 мг» у меди
  // и «UL 2000» у B12, а сравнение дозы шло с чужим числом. Теперь — тот же
  // резолвер, что у «Биодоступности»/паспорта: реестр → окно → диапазон → нет.
  const win = doseWindowFor(id, THERAPEUTIC_WINDOWS as never, DOSE_RANGES as never);
  const window = win.ulKind === 'Unknown' && !win.hasData && win.ul == null ? null : win;
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
