import { SUPPORT_CATALOG_DATA } from '../data/support-database';
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

export function getStackNutritional(): SupportCatalogEntry[] {
  return getBioStackSubstances().filter(s => {
    const cats = (s as any).categories || (s as any).category || [];
    return cats.some((c: string) => ['vitamin', 'mineral', 'amino', 'fatty_acid', 'electrolyte'].includes(c));
  });
}
