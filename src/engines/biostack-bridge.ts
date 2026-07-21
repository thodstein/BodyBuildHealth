import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../data/support-database';
import { resolveInteractionId } from '../data/support-interactions-db';
import type { SupportCatalogEntry } from '../data/support-catalog-data';
import { SUPPLEMENTS_DB } from '../data/support-db/supplements';
import { TZ_MECH_LABELS, TZ_SYSTEM_LABELS } from '../data/support-db';

const BIO_STACK_KEY = 'he_biostack_active';
const BIO_FAV_KEY = 'he_biostack_favorites';

export const RISK_ORGANS: Record<string, string[]> = {
  hepatic: ['LIVER'],
  cardio: ['HEART', 'VESSELS'],
  renal: ['KIDNEYS'],
  neuro: ['BRAIN', 'NERVES'],
  endocrine: ['THYROID', 'ADRENALS', 'ENDOCRINE', 'PANCREAS'],
  hematologic: ['BLOOD'],
  reproductive: ['REPRODUCTIVE', 'PROSTATE', 'TESTES', 'BREAST'],
  musculoskeletal: ['MUSCLES', 'BONES', 'JOINTS'],
  immune: ['IMMUNE_SYSTEM'],
  gastrointestinal: ['GUT', 'INTESTINES', 'STOMACH'],
};

export const RISK_SYSTEM_LABELS: Record<string, string> = {
  hepatic: '🫁 Печень', cardio: '❤️ ССС', renal: '🫘 Почки', neuro: '🧠 Нервная',
  endocrine: '⚖️ Эндокринная', hematologic: '🩸 Кровь', reproductive: '🧬 Репродуктивная',
  musculoskeletal: '💪 Опорно-двиг.', immune: '🛡️ Иммунитет', gastrointestinal: '🫁 ЖКТ',
};

export function getBioStackStackIds(): string[] {
  try {
    const raw = localStorage.getItem(BIO_STACK_KEY);
    if (raw) return JSON.parse(raw);
    const saved = localStorage.getItem('he_finder_saved_stacks');
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
    }
  } catch {}
  return [];
}

export function getBioStackSubstances(): SupportCatalogEntry[] {
  const ids = getBioStackStackIds();
  return ids.map(id => SUPPORT_CATALOG_DATA[id]).filter(Boolean);
}

export function getStackRiskCoverage(): Record<string, { ids: string[]; names: string[] }> {
  const subs = getBioStackSubstances();
  const coverage: Record<string, { ids: string[]; names: string[] }> = {};
  for (const s of subs) {
    const organs = (s as any).organs || (s as any).targetOrgans || [];
    for (const [sys, sysOrgans] of Object.entries(RISK_ORGANS)) {
      const match = organs.some((o: string) => sysOrgans.includes(o));
      if (match) {
        if (!coverage[sys]) coverage[sys] = { ids: [], names: [] };
        if (!coverage[sys].ids.includes(s.id)) {
          coverage[sys].ids.push(s.id);
          coverage[sys].names.push(s.nameRu || s.name);
        }
      }
    }
  }
  return coverage;
}

export function getStackCoverageStats(): { totalSystems: number; coveredSystems: number; coveragePct: number; systemList: { system: string; label: string; count: number }[] } {
  const coverage = getStackRiskCoverage();
  const allSystems = Object.keys(RISK_ORGANS);
  const covered = allSystems.filter(sys => coverage[sys]);
  const systemList = covered.map(sys => ({
    system: sys,
    label: RISK_SYSTEM_LABELS[sys] || sys,
    count: coverage[sys]?.ids.length || 0,
  }));
  return {
    totalSystems: allSystems.length,
    coveredSystems: covered.length,
    coveragePct: Math.round(covered.length / allSystems.length * 100),
    systemList,
  };
}

type InteractionPair = {
  a: string; b: string; nameA: string; nameB: string;
  type: string; effect: string; severity: string; mechanisms: string[]; notes: string;
};

export function getStackInteractions(stackIds: string[]): {
  pairs: InteractionPair[];
  critical: InteractionPair[];
  moderate: InteractionPair[];
  safe: InteractionPair[];
} {
  const pairs: InteractionPair[] = [];
  for (let i = 0; i < stackIds.length; i++) {
    for (let j = i + 1; j < stackIds.length; j++) {
      const idA = stackIds[i], idB = stackIds[j];
      const direct = ALL_INTERACTIONS.filter(inx =>
        (resolveInteractionId(inx.substanceA) === resolveInteractionId(idA) && resolveInteractionId(inx.substanceB) === resolveInteractionId(idB)) ||
        (resolveInteractionId(inx.substanceA) === resolveInteractionId(idB) && resolveInteractionId(inx.substanceB) === resolveInteractionId(idA)));
      if (direct.length > 0) {
        direct.forEach(inx => {
          pairs.push({
            a: idA, b: idB,
            nameA: SUPPORT_CATALOG_DATA[idA]?.nameRu || SUPPORT_CATALOG_DATA[idA]?.name || idA,
            nameB: SUPPORT_CATALOG_DATA[idB]?.nameRu || SUPPORT_CATALOG_DATA[idB]?.name || idB,
            type: inx.type, effect: inx.effect, severity: inx.severity,
            mechanisms: inx.mechanisms || [], notes: inx.notes || '',
          });
        });
      } else {
        pairs.push({
          a: idA, b: idB,
          nameA: SUPPORT_CATALOG_DATA[idA]?.nameRu || SUPPORT_CATALOG_DATA[idA]?.name || idA,
          nameB: SUPPORT_CATALOG_DATA[idB]?.nameRu || SUPPORT_CATALOG_DATA[idB]?.name || idB,
          type: 'no_interaction', effect: 'Взаимодействий не найдено',
          severity: 'LOW', mechanisms: [], notes: '',
        });
      }
    }
  }
  const critical = pairs.filter(p => p.severity === 'HIGH' && (p.type === 'conflict' || p.type === 'caution'));
  const moderate = pairs.filter(p => p.severity === 'MEDIUM' && (p.type === 'conflict' || p.type === 'caution'));
  const safe = pairs.filter(p => (p.severity === 'LOW' || p.type === 'synergy' || p.type === 'no_interaction'));
  return { pairs, critical, moderate, safe };
}

export function getStackNutritional(): SupportCatalogEntry[] {
  return getBioStackSubstances().filter(s => {
    const cats = (s as any).categories || (s as any).category || [];
    return cats.some((c: string) => ['vitamin', 'mineral', 'amino', 'fatty_acid', 'electrolyte', 'vitamin_like', 'omega', 'antioxidant'].includes(c));
  });
}

// ── TZ 28-механизмов: покрытие стека ──
const TZ_SYS_MECHS: Record<string, string[]> = {
  cardio: ['cv1','cv2','cv3','cv4','cv5'],
  hepatic: ['liv1','liv2','liv3'],
  renal: ['ren1','ren2','ren3','ren4'],
  cns: ['cns1','cns2','cns3','cns4','cns5','cns6'],
  reproductive: ['rep1','rep2','rep3','rep4','rep5'],
  hematologic: ['hem1','hem2','hem3','hem4','hem5'],
};

export interface TzCoverageResult {
  systems: Record<string, {
    label: string;
    totalMechs: number;
    coveredMechs: number;
    coveragePct: number;
    mechs: Array<{ mechId: string; label: string; covered: boolean; bestK: number; bestSub: string }>;
  }>;
  overallCoveragePct: number;
  totalCovered: number;
  totalMechs: number;
  gapMechs: Array<{ system: string; systemLabel: string; mechId: string; mechLabel: string; suggestions: Array<{ id: string; name: string; k: number; q: string }> }>;
}

export function getStackTzMechanismCoverage(stackIds: string[]): TzCoverageResult {
  const coveredMechs = new Map<string, { k: number; sub: string }>();
  for (const id of stackIds) {
    const entries = SUPPLEMENTS_DB[id];
    if (!entries) continue;
    for (const e of entries) {
      const key = `${e.organId}:${e.mechId}`;
      const existing = coveredMechs.get(key);
      if (!existing || e.k > existing.k) {
        coveredMechs.set(key, { k: e.k, sub: id });
      }
    }
  }

  const systems: TzCoverageResult['systems'] = {};
  let totalCovered = 0;
  let totalMechs = 0;
  const gapMechs: TzCoverageResult['gapMechs'] = [];

  for (const [sysId, mechIds] of Object.entries(TZ_SYS_MECHS)) {
    const sysLabel = TZ_SYSTEM_LABELS[sysId] || sysId;
    const mechs: TzCoverageResult['systems']['0']['mechs'] = [];
    let covered = 0;
    for (const mechId of mechIds) {
      const key = `${sysId}:${mechId}`;
      const c = coveredMechs.get(key);
      const isCovered = !!c;
      if (isCovered) covered++;
      mechs.push({ mechId, label: TZ_MECH_LABELS[mechId] || mechId, covered: isCovered, bestK: c?.k || 0, bestSub: c?.sub || '' });

      if (!isCovered) {
        const suggestions: TzCoverageResult['gapMechs'][0]['suggestions'] = [];
        for (const [subId, entries] of Object.entries(SUPPLEMENTS_DB) as [string, { organId: string; mechId: string; k: number; q: string; source: string }[]][]) {
          for (const e of entries) {
            if (e.organId === sysId && e.mechId === mechId) {
              const name = SUPPORT_CATALOG_DATA[subId]?.nameRu || SUPPORT_CATALOG_DATA[subId]?.name || subId;
              suggestions.push({ id: subId, name, k: e.k, q: e.q });
              break;
            }
          }
        }
        suggestions.sort((a, b) => b.k - a.k);
        gapMechs.push({ system: sysId, systemLabel: sysLabel, mechId, mechLabel: TZ_MECH_LABELS[mechId] || mechId, suggestions: suggestions.slice(0, 5) });
      }
    }
    systems[sysId] = { label: sysLabel, totalMechs: mechIds.length, coveredMechs: covered, coveragePct: Math.round(covered / mechIds.length * 100), mechs };
    totalCovered += covered;
    totalMechs += mechIds.length;
  }

  return {
    systems,
    overallCoveragePct: totalMechs > 0 ? Math.round(totalCovered / totalMechs * 100) : 0,
    totalCovered,
    totalMechs,
    gapMechs,
  };
}
