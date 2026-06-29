import { SUPPORT_CATALOG_DATA, ALL_INTERACTIONS } from '../data/support-database';
import type { SupportCatalogEntry } from '../data/support-catalog-data';

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
        (inx.substanceA === idA && inx.substanceB === idB) ||
        (inx.substanceA === idB && inx.substanceB === idA));
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
