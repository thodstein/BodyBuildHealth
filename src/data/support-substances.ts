import { resolveCanonicalId } from './support-meta';
import { INTERACTIONS_DB } from './support-interactions-db';

export interface SupportSubstance {
  id: string;
  name: string;
  nameRu?: string;
  nameEn?: string;
  type: SupportSubstanceType;
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
  { id:'ELEUTHERO', name:'Элеутерококк', type:'supplement', description:'Адаптоген — повышает работоспособность, снижает утомляемость', mechanisms:[], organs:[], categories:[], deficiency:'' },
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
  { id:'PIPERINE', name:'Piperine (Bioperine)', type:'supplement', description:'Алкалоид чёрного перца — усилитель биодоступности, ингибитор CYP3A4/P-gp', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BROMANTANE', name:'Bromantane', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'FASORACETAM', name:'Fasoracetam', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'AGMATINE', name:'Agmatine Sulfate', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'RUTIN', name:'Rutin (Rutoside)', type:'supplement', description:'Флавоноид — укрепление капилляров, венопротекция, антиоксидант', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TMG', name:'TMG (Trimethylglycine)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SAME', name:'SAM-e', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_B1', name:'Vitamin B1 (Thiamine)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HEPTRAL', name:'Heptral (Ademetionine)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LEGALON', name:'Legalon (Silymarin)', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'IBUDILAST', name:'Ibudilast', type:'supplement', description:'', mechanisms:[], organs:[], categories:[], deficiency:'' },
  // ─── Missing entries added by C4 audit ───
  { id:'ALANINE', name:'L-аланин', type:'amino', description:'Алифатическая аминокислота — источник энергии в мышцах, субстрат глюконеогенеза', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ASPARTATE', name:'L-аспартат', type:'amino', description:'Возбуждающий нейромедиатор, участник цикла мочевины и глюконеогенеза', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BCAA', name:'BCAA (разветвлённые аминокислоты)', type:'amino', description:'Лейцин, изолейцин, валин — стимуляция mTOR, антикатаболический эффект', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CARNOSINE', name:'L-карнозин', type:'amino', description:'Дипептид β-аланин+гистидин — буфер pH в мышцах, антигликация, антиоксидант', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CYSTEINE', name:'L-цистеин', type:'amino', description:'Серосодержащая аминокислота — синтез глутатиона, детоксикация, антиоксидант', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'EAA', name:'EAA (незаменимые аминокислоты)', type:'amino', description:'Комплекс 9 незаменимых аминокислот — полный анаболический стимул', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GLUTAMATE', name:'L-глутамат', type:'amino', description:'Основной возбуждающий нейромедиатор ЦНС, предшественник GABA', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HISTIDINE', name:'L-гистидин', type:'amino', description:'Незаменимая аминокислота — предшественник гистамина, буфер pH', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HMB', name:'HMB (β-гидрокси-β-метилбутират)', type:'amino', description:'Метаболит лейцина — антикатаболик, подавляет протеолиз, уменьшает распад мышц', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LYSINE', name:'L-лизин', type:'amino', description:'Незаменимая аминокислота — синтез коллагена, карнитина, кальциевый обмен', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'METHIONINE', name:'L-метионин', type:'amino', description:'Незаменимая серосодержащая аминокислота — донор метильных групп, синтез белка', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ORNITHINE', name:'L-орнитин', type:'amino', description:'Участник цикла мочевины, стимуляция секреции GH, детоксикация аммиака', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PHENYLALANINE', name:'L-фенилаланин', type:'amino', description:'Незаменимая аминокислота — предшественник тирозина, дофамина и норадреналина', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PROLINE', name:'L-пролин', type:'amino', description:'Иминокислота — ключевой компонент коллагена, синтез соединительной ткани', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SERINE', name:'L-серин', type:'amino', description:'Аминокислота — синтез фосфолипидов, сериновых протеаз, сфинголипидов', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'THREONINE', name:'L-треонин', type:'amino', description:'Незаменимая аминокислота — синтез коллагена, эластина, иммуноглобулинов', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_B_COMPLEX', name:'Витамины группы B (комплекс)', type:'vitamin', description:'Комплекс B1, B2, B3, B5, B6, B7, B9, B12 — энергетический метаболизм и ЦНС', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_B2', name:'Витамин B2 (рибофлавин)', type:'vitamin', description:'Кофермент FAD/FMN — окислительно-восстановительные реакции, энергетический обмен', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_B3', name:'Витамин B3 (ниацин)', type:'vitamin', description:'Кофермент NAD/NADP — энергообмен, детоксикация, улучшение липидного профиля', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VITAMIN_B5', name:'Витамин B5 (пантотеновая кислота)', type:'vitamin', description:'Предшественник кофермента A — синтез жирных кислот, стероидов, ацетилхолина', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MANGANESE', name:'Марганец', type:'mineral', description:'Кофактор супероксиддисмутазы, синтез коллагена, метаболизм углеводов', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MOLYBDENUM', name:'Молибден', type:'mineral', description:'Кофактор ксантиноксидазы и сульфитоксидазы — пуриновый обмен, детоксикация', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'STRONTIUM', name:'Стронций', type:'mineral', description:'Стимуляция остеобластов, увеличение минеральной плотности костей', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'COLLOIDAL_MINERALS', name:'Коллоидные минералы', type:'mineral', description:'Комплекс микроэлементов в коллоидной форме — восполнение минерального баланса', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CORDYCEPS', name:'Кордицепс', type:'herb', description:'Лекарственный гриб — повышение VO2max, AMPK-активация, иммуномодуляция', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BAICALIN', name:'Байкалин (шлемник байкальский)', type:'herb', description:'Флавоноид шлемника — противовоспалительное, NO-модуляция, гепатопротекция', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CISSUS', name:'Циссус (Cissus quadrangularis)', type:'herb', description:'Травяной анаболик — ускорение заживления костей, снижение воспаления', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GENTIAN', name:'Горечавка (Gentiana lutea)', type:'herb', description:'Горечь для стимуляции пищеварения, желчегонное, противовоспалительное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GOTU_KOLA', name:'Готу кола (Centella asiatica)', type:'herb', description:'Стимуляция синтеза коллагена, венопротектор, улучшение микроциркуляции', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HOLY_BASIL', name:'Туласи (священный базилик)', type:'herb', description:'Адаптоген — снижение кортизола, антиоксидант, противовоспалительное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LEMON_BALM', name:'Мелисса лекарственная', type:'herb', description:'Седативное, спазмолитическое, GABA-модуляция, противовирусное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LICORICE', name:'Солодка (Glycyrrhiza glabra)', type:'herb', description:'Противовоспалительное, повышение кортизола через ингибицию 11β-HSD', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MAGNOLIA', name:'Магнолия (кора)', type:'herb', description:'Магнолол и хонокиол — анксиолитик, ингибитор COMT, противовоспалительное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MANGOSTEEN', name:'Мангустин (Garcinia mangostana)', type:'herb', description:'Ксантоны — антиоксидант, противовоспалительное, антибактериальное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'OLIVE_EXTRACT', name:'Экстракт оливы', type:'herb', description:'Олеуропеин — антиоксидант, гипотензивное, противовоспалительное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'POMEGRANATE', name:'Гранат', type:'herb', description:'Пуникалагин, эллаговая кислота — антиоксидант, поддержка ССС и потенции', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ROSEMARY', name:'Розмарин лекарственный', type:'herb', description:'Розмариновая кислота — антиоксидант, улучшение когниции, противовоспалительное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SAFFRON', name:'Шафран', type:'herb', description:'Кроцин и сафраналь — антидепрессант, модуляция серотонина, антиоксидант', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SCHISANDRA', name:'Лимонник китайский', type:'herb', description:'Адаптоген, гепатопротектор, повышение физической выносливости', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'AHCC', name:'AHCC (экстракт шиитаке)', type:'supplement', description:'Активный гексозо-коррелированный компонент — иммуномодуляция, повышение NK-клеток', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CEREBROLYSIN', name:'Церебролизин', type:'peptide', description:'Нейропептидный комплекс — нейротрофический эффект, BDNF-миметик, восстановление ЦНС', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CJC1295', name:'CJC-1295 (GHRH аналог)', type:'peptide', description:'Аналог GHRH с пролонгированным действием — стимуляция пульсаций GH и IGF-1', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CORTEXIN', name:'Кортексин', type:'peptide', description:'Нейропептидный комплекс — ноотроп, нейропротекция, восстановление когнитивных функций', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'DSIP', name:'DSIP (дельта-сон-индуцирующий пептид)', type:'peptide', description:'Пептид сна — нормализация циркадных ритмов, снижение кортизола', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'FOLLISTATIN', name:'Фоллистатин', type:'peptide', description:'Ингибитор миостатина — увеличение мышечной массы, снижение фиброза', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GHK_CU', name:'GHK-Cu (медный пептид)', type:'peptide', description:'Медь-связывающий пептид — регенерация кожи, заживление ран, антиоксидант', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GHRP2', name:'GHRP-2 (пралморелин)', type:'peptide', description:'Синтетический грелин-миметик — стимуляция GH через рецептор грелина', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GHRP6', name:'GHRP-6', type:'peptide', description:'Секретагог GH — стимуляция аппетита, повышение GH и IGF-1', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GIP', name:'GIP (глюкозо-зависимый инсулинотропный полипептид)', type:'peptide', description:'Инкретиновый гормон — стимуляция секреции инсулина, метаболизм жиров', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GLP1', name:'GLP-1 (глюкагоноподобный пептид-1)', type:'peptide', description:'Инкретиновый гормон — стимуляция инсулина, подавление аппетита, нейропротекция', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GONADORELIN', name:'Гонадорелин (GnRH)', type:'peptide', description:'Гонадотропин-рилизинг гормон — стимуляция ЛГ и ФСГ, гипоталамус-гипофиз', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HUMANIN', name:'Хуманин', type:'peptide', description:'Митохондриальный пептид — антистарение, цитопротекция, снижение воспаления', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'IPAMORELIN', name:'Ипаморелин', type:'peptide', description:'Секретагог GH — стимуляция через грелиновый рецептор без чувства голода', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'KISSPEPTIN', name:'Кисспептин', type:'peptide', description:'Нейропептид — активация GnRH, пубертат, репродуктивная функция', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'KPV', name:'KPV (Lys-Pro-Val)', type:'peptide', description:'Трипептид — противовоспалительный, антагонист TNF-α, защита слизистой ЖКТ', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MELANOTAN1', name:'Меланотан-1', type:'peptide', description:'Аналог α-MSH — стимуляция меланина, фототерапия, противовоспалительное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MELANOTAN2', name:'Меланотан-2 (Bremelanotide)', type:'peptide', description:'Аналог α-MSH — загар без солнца, стимуляция либидо через MC4R', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MGF', name:'MGF (Mechano Growth Factor)', type:'peptide', description:'Сплайс-вариант IGF-1 — активация сателлитных клеток, регенерация мышц', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MOTS_C', name:'MOTS-c', type:'peptide', description:'Митохондриальный пептид — AMPK-активация, метаболический контроль, долголетие', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'OXYTOCIN', name:'Окситоцин', type:'peptide', description:'Нейропептид — социальное поведение, анальгезия, регенерация мышц', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'P21', name:'P21 (CJC-1295 без DAC)', type:'peptide', description:'Короткий GHRH аналог — стимуляция GH без DAC-пролонгации', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PT141', name:'PT-141 (Bremelanotide)', type:'peptide', description:'Аналог α-MSH — активация MC3R/MC4R, лечение сексуальной дисфункции', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SS31', name:'SS-31 (Elamipretide)', type:'peptide', description:'Митохондриально-направленный пептид — снижение ROS, улучшение биоэнергетики', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'THYMOSIN_ALPHA1', name:'Тимозин-α1', type:'peptide', description:'Иммуномодулятор — активация T-клеток, NK-клеток, дендритных клеток', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'VASOPRESSIN', name:'Вазопрессин', type:'peptide', description:'Антидиуретический гормон — регуляция водного баланса, социальное поведение', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANIRACETAM', name:'Анирацетам', type:'supplement', description:'Ноотроп из семейства рацетамов — улучшение памяти, модуляция AMPA-рецепторов', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'COLURACETAM', name:'Колурацетам', type:'supplement', description:'Ноотроп рацетамового ряда — улучшение когнитивных функций и нейропластичности', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MEMANTINE', name:'Мемантин', type:'pharma', description:'Антагонист NMDA-рецепторов — нейропротекция, когнитивный энхансер', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MODAFINIL', name:'Модафинил', type:'pharma', description:'Пробуждающий агент — ингибитор обратного захвата дофамина, когнитивное улучшение', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'OXIRACETAM', name:'Оксирацетам', type:'supplement', description:'Ноотроп рацетамового ряда — улучшение памяти, обучение, модуляция глутамата', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PHENIBUT', name:'Фенибут (β-фенил-GABA)', type:'supplement', description:'Анксиолитик — агонист GABAB-рецепторов, снижение тревоги, улучшение сна', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PRAMIRACETAM', name:'Прамирацетам', type:'supplement', description:'Ноотроп рацетамового ряда — улучшение концентрации, памяти, антидепрессивный', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SELEGILINE', name:'Селегилин', type:'pharma', description:'Ингибитор MAO-B — нейропротекция, повышение дофамина, антипаркинсонический', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'DICLOFENAC', name:'Диклофенак', type:'pharma', description:'НПВС — неселективный ингибитор ЦОГ-1/ЦОГ-2, противовоспалительное, анальгетик', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ESTRADIOL', name:'Эстрадиол', type:'pharma', description:'Основной эстроген — репродукция, костная плотность, липидный профиль', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GLUCAGON', name:'Глюкагон', type:'pharma', description:'Гипергликемический гормон поджелудочной — антагонист инсулина, липолиз', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'KETAMINE', name:'Кетамин', type:'pharma', description:'Антагонист NMDA — антидепрессант быстрого действия, анальгетик', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LEVOTHYROXINE', name:'Левотироксин (T4)', type:'pharma', description:'Синтетический тироксин — заместительная терапия гипотиреоза', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'MELOXICAM', name:'Мелоксикам', type:'pharma', description:'НПВС — селективный ингибитор ЦОГ-2, противовоспалительное, анальгетик', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PROGESTERONE', name:'Прогестерон', type:'pharma', description:'Стероидный гормон — регуляция цикла, нейропротекция, анаболический эффект', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SEMAGLUTIDE', name:'Семаглутид', type:'pharma', description:'Аналог GLP-1 — агонист GLP-1R, контроль глюкозы, снижение аппетита', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SPIRONOLACTONE', name:'Спиронолактон', type:'pharma', description:'Антагонист альдостерона — калийсберегающий диуретик, антиандроген', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TIANEPTINE', name:'Тианептин', type:'pharma', description:'Атипичный антидепрессант — модулятор глутамата, μ-опиоидный агонист', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CORTISOL', name:'Кортизол (гидрокортизон)', type:'pharma', description:'Глюкокортикоид — стресс-ответ, противовоспалительное, катаболическое действие', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTHOCYANINS', name:'Антоцианы', type:'supplement', description:'Флавоноидные пигменты — мощный антиоксидант, сосудистая защита', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'APIGENIN', name:'Апигенин', type:'supplement', description:'Флавоноид петрушки и ромашки — анксиолитик, модуляция GABA-рецепторов', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BILE_ACIDS', name:'Жёлчные кислоты', type:'supplement', description:'Эмульгация жиров, улучшение пищеварения, регуляция холестеринового обмена', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BUTYRATE', name:'Бутират (масляная кислота)', type:'supplement', description:'Короткоцепочечная жирная кислота — питание колоноцитов, противовоспалительное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'C60', name:'C60 (фуллерен)', type:'supplement', description:'Наночастица углерода — мощный антиоксидант, нейропротекция', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CERAMIDES', name:'Церамиды', type:'supplement', description:'Сфинголипиды — структурный компонент кожи, увлажнение, барьерная функция', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CLA', name:'CLA (конъюгированная линолевая кислота)', type:'supplement', description:'Жирная кислота — снижение жировой массы, модуляция PPAR-γ', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'COCOA_FLAVANOLS', name:'Какао-флаванолы', type:'supplement', description:'Флаванолы какао — NO-модуляция, снижение давления, нейропротекция', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'DHEA', name:'DHEA (дегидроэпиандростерон)', type:'supplement', description:'Предшественник стероидов — поддержка уровня тестостерона и эстрадиола', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'DIGESTIVE_ENZYMES', name:'Пищеварительные ферменты', type:'supplement', description:'Комплекс протеазы, амилазы, липазы — улучшение переваривания пищи', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ECDYSTERONE', name:'Экдистерон', type:'supplement', description:'Фитоэкдистероид — стимуляция синтеза белка без андрогенной активности', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ELASTIN', name:'Эластин', type:'supplement', description:'Структурный белок соединительной ткани — упругость кожи, сосудов, лёгких', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ELLAGIC_ACID', name:'Эллаговая кислота', type:'supplement', description:'Полифенол — антиоксидант, антипролиферативный, влияние на метаболизм эстрогенов', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ENDOCANNABINOID', name:'Эндоканнабиноиды', type:'supplement', description:'Комплекс липидных медиаторов — регуляция боли, настроения, аппетита', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ENDOCRINE_MARKER', name:'Эндокринные маркеры (референс)', type:'supplement', description:'Набор референсных значений для оценки гормонального профиля', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'FIBER', name:'Пищевые волокна (клетчатка)', type:'supplement', description:'Растворимая и нерастворимая клетчатка — микрофлора, холестерин, насыщение', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'FISETIN', name:'Физетин', type:'supplement', description:'Флавоноид — сенолитик, антиоксидант, нейропротекция, противовоспалительное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'FLAVONOIDS', name:'Флавоноиды (комплекс)', type:'supplement', description:'Группа растительных полифенолов — антиоксидантная защита, сосудистая поддержка', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'GRAPE_SEED_EXTRACT', name:'Экстракт виноградных косточек', type:'supplement', description:'Богат проантоцианидинами — антиоксидант, венопротектор, улучшение кожи', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'HMO_PREBIOTICS', name:'HMO (олигосахариды грудного молока)', type:'supplement', description:'Пребиотик — питание бифидобактерий, иммуномодуляция, защита ЖКТ', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'IMMUNE_SUPPORT', name:'Иммунная поддержка (комплекс)', type:'supplement', description:'Комплекс витаминов и растительных экстрактов для поддержки иммунитета', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'INOSITOL', name:'Инозитол', type:'supplement', description:'Витаминоподобное вещество — PCOS, инсулинорезистентность, серотониновая передача', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LACTATE', name:'Лактат', type:'supplement', description:'Соль молочной кислоты — энергетический субстрат, буфер, сигнальная молекула', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LUTEIN', name:'Лютеин', type:'supplement', description:'Каротиноид — защита зрения, антиоксидант, защита макулы от синего света', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NEUROSTEROID', name:'Нейростероиды (класс)', type:'supplement', description:'Класс стероидов — модуляция GABA-рецепторов, нейропротекция, когнитивные функции', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NOBILETIN', name:'Нобилетин', type:'supplement', description:'Полиметоксилированный флавоноид — противовоспалительное, нейропротекция, AMPK', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NRF2_ACTIVATOR', name:'Nrf2-активатор (комплекс)', type:'supplement', description:'Активация фактора Nrf2 — усиление антиоксидантной и детоксикационной защиты', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'OMEGA6', name:'Омега-6 жирные кислоты', type:'supplement', description:'Линолевая, γ-линоленовая — клеточные мембраны, медиаторы воспаления', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'OMEGA7', name:'Омега-7 (пальмитолеиновая кислота)', type:'supplement', description:'Мононенасыщенная жирная кислота — защита слизистых, противовоспалительное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'OMEGA9', name:'Омега-9 (олеиновая кислота)', type:'supplement', description:'Мононенасыщенная жирная кислота — ССС-защита, снижение воспаления', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PARAPROBIOTICS', name:'Парапробиотики', type:'supplement', description:'Инактивированные пробиотики — иммуномодуляция, защита ЖКТ', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PECTIN', name:'Пектин', type:'supplement', description:'Растворимое пищевое волокно — детоксикация, снижение холестерина, пребиотик', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'POSTBIOTICS', name:'Постбиотики', type:'supplement', description:'Метаболиты пробиотиков — модуляция иммунитета, целостность кишечного барьера', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PREGNENOLONE', name:'Прегненолон', type:'supplement', description:'Предшественник всех стероидов — улучшение памяти, энергии, нейропротекция', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PTEROSTILBENE', name:'Птеростильбен', type:'supplement', description:'Стильбеноид, аналог ресвератрола — антиоксидант, AMPK-активация, антиэйдж', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'RESISTANT_STARCH', name:'Резистентный крахмал', type:'supplement', description:'Неперевариваемый крахмал — пребиотик, улучшение инсулинорезистентности', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'S_ADENOSYL_METHIONINE', name:'S-аденозилметионин (SAM-e)', type:'supplement', description:'Донор метильных групп — поддержка печени, суставов, антидепрессивный эффект', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SOY_ISOFLAVONES', name:'Соевые изофлавоны', type:'supplement', description:'Фитоэстрогены — модуляция ER-рецепторов, костная плотность, менопауза', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SULFORAPHANE', name:'Сульфорафан', type:'supplement', description:'Активатор Nrf2 из брокколи — детоксикация, противовоспалительное, противораковое', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'TAXIFOLIN', name:'Таксифолин (дигидрокверцетин)', type:'supplement', description:'Флавоноид — капилляропротектор, антиоксидант, лимфодренаж', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'UROLITHIN_A', name:'Уролитин A', type:'supplement', description:'Постбиотик эллаготаннинов — митофагия, профилактика саркопении, долголетие', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'URSOLIC_ACID', name:'Урсоловая кислота', type:'supplement', description:'Тритерпеноид — активация IGF-1, рост мышц, снижение жира, противовоспалительное', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'X5HTP', name:'5-HTP (5-гидрокситриптофан)', type:'supplement', description:'Предшественник серотонина — регуляция настроения, аппетита, сна', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ZINC_CARNOSINE', name:'Цинк-карнозин', type:'supplement', description:'Хелатный комплекс — заживление слизистой ЖКТ, антиоксидант, гастропротекция', mechanisms:[], organs:[], categories:[], deficiency:'' },
  // ─── Drug category groups (for interaction mapping) ───
  { id:'ACE_INHIBITOR_DRUGS', name:'Ингибиторы АПФ (группа)', type:'complex', description:'Ингибиторы ангиотензин-превращающего фермента — гипотензивные препараты', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTACID', name:'Антациды (группа)', type:'complex', description:'Препараты для нейтрализации соляной кислоты в желудке', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTIBIOTIC_DRUGS', name:'Антибиотики (группа)', type:'complex', description:'Антибактериальные препараты системного действия — борьба с инфекциями', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTICOAGULANT_DRUGS', name:'Антикоагулянты (группа)', type:'complex', description:'Препараты для снижения свёртываемости крови — профилактика тромбозов', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTICONVULSANT_DRUGS', name:'Противосудорожные (группа)', type:'complex', description:'Препараты для лечения эпилепсии и нейропатической боли', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTIDEPRESSANT_DRUGS', name:'Антидепрессанты (группа)', type:'complex', description:'Психотропные препараты — коррекция депрессии, тревоги, ОКР', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTIDIABETIC_DRUGS', name:'Противодиабетические (группа)', type:'complex', description:'Сахароснижающие препараты — терапия сахарного диабета 2 типа', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTIHISTAMINE_DRUGS', name:'Антигистаминные (группа)', type:'complex', description:'Блокаторы H1-рецепторов — противоаллергические препараты', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTIPLATELET_DRUGS', name:'Антиагреганты (группа)', type:'complex', description:'Препараты для снижения агрегации тромбоцитов — профилактика тромбозов', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANTIPSYCHOTIC_DRUGS', name:'Антипсихотики (группа)', type:'complex', description:'Нейролептики — коррекция психотических расстройств', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ANXIOLYTIC_DRUGS', name:'Анксиолитики (группа)', type:'complex', description:'Противотревожные препараты — бензодиазепины и другие', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'ARB_DRUGS', name:'БРА (блокаторы рецепторов ангиотензина)', type:'complex', description:'Сартаны — гипотензивные, нефропротективные, метаболически нейтральные', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BETA_BLOCKER_DRUGS', name:'β-адреноблокаторы (группа)', type:'complex', description:'Блокаторы β-адренорецепторов — гипотензивные, антиаритмические', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CCB_DRUGS', name:'Блокаторы кальциевых каналов (группа)', type:'complex', description:'Антагонисты кальция — гипотензивные, антиангинальные препараты', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CORTICOSTEROID_DRUGS', name:'Кортикостероиды (группа)', type:'complex', description:'Стероидные противовоспалительные — глюкокортикоиды системного действия', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'DIURETIC_DRUGS', name:'Диуретики (группа)', type:'complex', description:'Мочегонные препараты — снижение АД, отёчного синдрома', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'IMMUNOSUPPRESSANT_DRUGS', name:'Иммуносупрессоры (группа)', type:'complex', description:'Препараты для подавления иммунитета — аутоиммунные заболевания, трансплантация', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NSAID_DRUGS', name:'НПВС (группа)', type:'complex', description:'Нестероидные противовоспалительные — анальгетик, жаропонижающее', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'PPI_DRUGS', name:'ИПП (ингибиторы протонной помпы)', type:'complex', description:'Препараты для снижения кислотности желудка — лечение ГЭРБ и язв', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'STATIN_DRUGS', name:'Статины (группа)', type:'complex', description:'Ингибиторы HMG-CoA редуктазы — снижение холестерина, гиполипидемические', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'THYROID_DRUGS', name:'Тиреоидные препараты (группа)', type:'complex', description:'Препараты гормонов щитовидной железы — терапия гипотиреоза', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'LACTOFERRIN', name:'Лактоферрин', type:'supplement', description:'Железосвязывающий гликопротеин — иммуномодулятор', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'L_HISTIDINE', name:'L-Гистидин', type:'amino', description:'Незаменимая аминокислота — предшественник гистамина', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'L_LYSINE', name:'L-Лизин', type:'amino', description:'Незаменимая аминокислота — компонент коллагена', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'BENFOTIAMINE', name:'Бенфотиамин', type:'supplement', description:'Жирорастворимая форма B1', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'NICOTINAMIDE_RIBOSIDE', name:'Никотинамид Рибозид (NR)', type:'supplement', description:'Предшественник NAD+', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'SPERMIDINE', name:'Спермидин', type:'supplement', description:'Индуктор аутофагии', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'URIDINE_MONOPHOSPHATE', name:'Уридин монофосфат', type:'supplement', description:'Нуклеотид для памяти и сна', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CHOLINE_BITARTRATE', name:'Холина битартрат', type:'supplement', description:'Соль холина — предшественник ацетилхолина', mechanisms:[], organs:[], categories:[], deficiency:'' },
  { id:'CHANTERELLE', name:'Лисички (грибы)', type:'supplement', description:'Природный источник витамина D, антипаразитарное', mechanisms:[], organs:[], categories:[], deficiency:'' },
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
