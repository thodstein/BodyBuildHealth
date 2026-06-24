import { resolveCanonicalId } from './support-meta';
import { INTERACTIONS_DB } from './support-interactions-db';

export interface SupportSubstance {
  id: string;
  name: string;
  nameRu?: string;
  nameEn?: string;
  type: 'supplement' | 'pharma' | 'peptide' | 'vitamin' | 'mineral' | 'amino' | 'herb';
  description: string;
  mechanisms: string[];
  organs: string[];
  categories: string[];
  forms?: SubstanceForm[];
  recommendedForm?: string;
  dosage?: string;
  timing?: string;
  duration?: string;
  deficiency: string;
  contraindications?: string;
  sideEffects?: string;
  monitoring?: string;
}

export interface SubstanceForm {
  form: string;
  bioavailability: number;
  halfLife: string;
  dosageRange: string;
  notes?: string;
}

export interface SupportBrand {
  brandId: string;
  name: string;
  type: string;
  country: string;
  description: string;
}

export interface SupportCategory {
  catId: string;
  type: string;
  name: string;
  description: string;
}

export interface SupportTag {
  tagId: string;
  type: string;
  name: string;
}

export interface SupportInteraction {
  interactionId: string;
  substanceA: string;
  substanceB: string;
  type: 'synergy' | 'conflict' | 'caution';
  effect: string;
  mechanisms: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  notes: string;
}

export interface SupportRisk {
  riskId: string;
  name: string;
  system: string;
  organs: string[];
  symptoms: string[];
  levels: string;
  description: string;
}

export type SupportSubstanceType = 'supplement' | 'pharma' | 'peptide' | 'vitamin' | 'mineral' | 'amino' | 'herb' | 'complex';

export const ALL_SUBSTANCES: SupportSubstance[] = [
  { id:'ACETYL_L_CARNITINE', name:'ACETYL L CARNITINE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ALPHA_GPC', name:'Alpha-GPC', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ALPHA_LIPOIC', name:'Альфа-липоевая кислота', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANDROGRAPHIS', name:'ANDROGRAPHIS', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTITHYROID_DRUGS', name:'ANTITHYROID DRUGS', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ARGININE', name:'ARGININE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ARTICHOKE', name:'Артишок', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ASHWAGANDHA', name:'Ашваганда', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ASTAXANTHIN', name:'Астаксантин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ASTRAGALUS', name:'Астрагал', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BACOPA', name:'Бакопа Monnieri', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BEETROOT', name:'BEETROOT', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BERBERINE', name:'Берберин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BETAINE', name:'Бетаин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BETA_ALANINE', name:'Бета-аланин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BETA_GLUCAN', name:'BETA GLUCAN', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BIOTIN', name:'Биотин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BORON', name:'Бор', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BOSWELLIA', name:'Босвеллия', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BPC157', name:'BPC-157', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BROMELAIN', name:'Бромелайн', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CABERGOLINE', name:'CABERGOLINE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CAFFEINE', name:'CAFFEINE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CALCIUM', name:'Кальций', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CARNITINE', name:'L-карнитин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CHAGA', name:'CHAGA', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CHONDROITIN', name:'Хондроитин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CHROMIUM', name:'Хром', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CINNAMON', name:'CINNAMON', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CITICOLINE', name:'Цитиколин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CITRULLINE', name:'CITRULLINE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PHARMA_CLOMIPHENE', name:'Кломифен (Clomiphene)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'COLLAGEN', name:'Коллаген', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'COLOSTRUM', name:'COLOSTRUM', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'COPPER', name:'Медь', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'COQ10', name:'Коэнзим Q10', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CRANBERRY', name:'CRANBERRY', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CREATINE', name:'Креатин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CURCUMIN', name:'Куркумин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'D_ASPARTIC_ACID', name:'D ASPARTIC ACID', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ECHINACEA', name:'ECHINACEA', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'EGCG', name:'EGCG (Эпигаллокатехин)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PHARMA_ENCLOMIPHENE', name:'Энкломифен (Enclomiphene)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'FADOGIA', name:'FADOGIA', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'FINASTERIDE', name:'FINASTERIDE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'FOLATE', name:'Фолат', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GABA', name:'ГАМК', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GARLIC', name:'GARLIC', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GINGER', name:'Имбирь', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GINKGO', name:'Гинкго Билоба', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GINSENG', name:'GINSENG', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GLUCOSAMINE', name:'Глюкозамин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GLUTAMINE', name:'Глутамин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GLUTATHIONE', name:'GLUTATHIONE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GLYCINE', name:'Глицин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HCG', name:'HCG', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HUPERZINE_A', name:'HUPERZINE A', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HYALURONIC', name:'Гиалуроновая кислота', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'IGF1', name:'IGF1', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'INSULIN', name:'INSULIN', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'IODINE', name:'Йод', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'IRON', name:'Железо', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'IMMUNE_LACTOFERRIN', name:'Лактоферрин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LECITHIN', name:'LECITHIN', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LIONS_MANE', name:'Грива льва (Ежовик гребенчатый)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LITHIUM', name:'LITHIUM', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LYCOPENE', name:'Ликопин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'L_CARNITINE', name:'L-карнитин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'L_DOPA', name:'L DOPA', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'L_THEANINE', name:'L-теанин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MACA', name:'MACA', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MAGNESIUM', name:'Магний', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MAGNESIUM_L_THREONATE', name:'MAGNESIUM L THREONATE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MCT', name:'MCT', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MELATONIN', name:'Мелатонин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'METFORMIN', name:'METFORMIN', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MILK_THISTLE', name:'Расторопша', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MSM', name:'MSM', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NAC', name:'NAC', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NEBIVOLOL', name:'NEBIVOLOL', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NMN', name:'Никотинамид мононуклеотид', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NOOPEPT', name:'Ноопепт', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'OMEGA3', name:'Омега-3', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PHOSPHATIDYLCHOLINE', name:'PHOSPHATIDYLCHOLINE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PHOSPHATIDYLSERINE', name:'Фосфатидилсерин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PIRACETAM', name:'PIRACETAM', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'POTASSIUM', name:'Калий', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PQQ', name:'PQQ', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PREBIOTICS', name:'Пребиотики', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PROBIOTICS', name:'Пробиотики', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PROPOLIS', name:'PROPOLIS', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PTEROSTILBENE', name:'Птеростильбен', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PYCNOGENOL', name:'Пикногенол', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PYGEUM', name:'PYGEUM', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'QUERCETIN', name:'Кверцетин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'REISHI', name:'REISHI', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'RESVERATROL', name:'Ресвератрол', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'RHODIOLA', name:'Родиола', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SAW_PALMETTO', name:'SAW PALMETTO', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SELANK', name:'SELANK', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SELENIUM', name:'Селен', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SEMAX', name:'SEMAX', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SHILAJIT', name:'SHILAJIT', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SILICON', name:'SILICON', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SODIUM', name:'SODIUM', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TAMOXIFEN', name:'TAMOXIFEN', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TAURINE', name:'Таурин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TB500', name:'TB-500', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TELMISARTAN', name:'Телмисартан', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TESTOSTERONE', name:'TESTOSTERONE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'THEANINE', name:'THEANINE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'pharma', name:'THYROID DRUGS', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TONGKAT_ALI', name:'Тонгкат Али', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TRIBULUS', name:'TRIBULUS', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TRYPTOPHAN', name:'Триптофан', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TUDCA', name:'TUDCA', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TYROSINE', name:'TYROSINE', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VANADIUM', name:'VANADIUM', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VINPOCETINE', name:'Винпоцетин', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_A', name:'VITAMIN A', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_B12', name:'VITAMIN B12', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_B6', name:'Витамин B6', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_C', name:'Витамин C', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_D3', name:'Витамин D3', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_E', name:'Витамин E', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_K2', name:'Витамин K2', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ZINC', name:'Цинк', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'DIOSMIN', name:'Diosmin', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BERGAMOT', name:'Bergamot Extract', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SERRAPEPTASE', name:'Serrapeptase', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PAPAIN', name:'Papain', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PHARMA_TADALAFIL', name:'Tadalafil', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LUMBROKINASE', name:'Lumbrokinase', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HORSE_CHESTNUT', name:'Horse Chestnut', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'INOSINE', name:'Inosine', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NARINGIN', name:'Naringin', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PHARMA_CABERGOLINE', name:'Cabergoline', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PHARMA_ANASTROZOLE', name:'Anastrozole (Arimidex)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PHARMA_LETROZOLE', name:'Letrozole (Femara)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NATTOKINASE', name:'Nattokinase', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HESPERIDIN', name:'Hesperidin', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CITRUS_BIOFLAVONOIDS', name:'Citrus Bioflavonoids', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BROMANTANE', name:'Bromantane', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'FASORACETAM', name:'Fasoracetam', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'AGMATINE', name:'Agmatine Sulfate', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TMG', name:'TMG (Trimethylglycine)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SAME', name:'SAM-e', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_B1', name:'Vitamin B1 (Thiamine)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HEPTRAL', name:'Heptral (Ademetionine)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LEGALON', name:'Legalon (Silymarin)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'IBUDILAST', name:'Ibudilast', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
];

export const SUPPORT_SUBSTANCE_MAP: Record<string, SupportSubstance> = {};
ALL_SUBSTANCES.forEach(s => { SUPPORT_SUBSTANCE_MAP[s.id] = s; });

export function getSubstancesByOrgan(organ: string): SupportSubstance[] {
  const upper = organ.toUpperCase();
  return ALL_SUBSTANCES.filter(s => s.organs.some(o => o.toUpperCase() === upper));
}

export function getSubstancesByCategory(category: string): SupportSubstance[] {
  return ALL_SUBSTANCES.filter(s => (s.categories||[]).includes(category));
}

export function getSubstancesByType(type: SupportSubstanceType): SupportSubstance[] {
  return ALL_SUBSTANCES.filter(s => s.type === type);
}

export function normalizeSubstanceId(id: string): string {
  return (id || '').replace(/['"\s_-]/g, '').toUpperCase();
}

export function searchSubstances(query: string): SupportSubstance[] {
  const lower = query.toLowerCase();
  return ALL_SUBSTANCES.filter(s => (s.name||'').toLowerCase().includes(lower) || (s.description||'').toLowerCase().includes(lower));
}

export function getSubstanceName(id: string): string {
  const s = SUPPORT_SUBSTANCE_MAP[id];
  if (s) return s.name;
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Canonical ID resolution
const CANONICAL_MAP: Record<string, string> = {};

export function registerCanonical(alias: string, canonical: string): void {
  CANONICAL_MAP[alias.toUpperCase()] = canonical;
}

export function resolveSubstanceId(id: string): string {
  if (!id) return '';
  const resolved = resolveCanonicalId(id);
  if (resolved) return resolved;
  if (SUPPORT_SUBSTANCE_MAP[id]) return id;
  const upper = id.toUpperCase();
  return CANONICAL_MAP[upper] || id;
}

const GHOST_IDS = new Set<string>(['DIOSMIN', 'BERGAMOT', 'SERRAPEPTASE', 'PAPAIN']);

export function isGhostId(id: string): boolean {
  return GHOST_IDS.has(id);
}

// Mapped from INTERACTIONS_DB (support-interactions-db.ts) — field `id` → `interactionId`
export const ALL_INTERACTIONS: SupportInteraction[] = INTERACTIONS_DB.map(i => ({
  interactionId: i.id,
  substanceA: i.substanceA,
  substanceB: i.substanceB,
  type: i.type,
  effect: i.effect,
  mechanisms: i.mechanisms,
  severity: i.severity,
  notes: i.notes,
}));
export const ALL_RISKS: SupportRisk[] = [];

// Aliases for backward compatibility
export function findSubstancesByOrgan(organ: string): SupportSubstance[] {
  return getSubstancesByOrgan(organ);
}
export function findSubstancesByCategory(category: string): SupportSubstance[] {
  return getSubstancesByCategory(category);
}
export function findInteractionsForSubstance(id: string): SupportInteraction[] {
  return ALL_INTERACTIONS.filter(i => i.substanceA === id || i.substanceB === id);
}
export function findSynergies(id: string): SupportInteraction[] {
  return ALL_INTERACTIONS.filter(i => (i.substanceA === id || i.substanceB === id) && i.type === 'synergy');
}
export function findConflicts(id: string): SupportInteraction[] {
  return ALL_INTERACTIONS.filter(i => (i.substanceA === id || i.substanceB === id) && i.type === 'conflict');
}
export function getSubstance(id: string): SupportSubstance | undefined {
  return SUPPORT_SUBSTANCE_MAP[id];
}
