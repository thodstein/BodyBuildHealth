import type { SupportCatalogEntry, CatalogSubstanceForm } from '../../../data/support-database';
import { ALL_SUBSTANCES } from '../../../data/support-substances';
import { ROUTE_LABELS } from '../../../engines/peptide-calculator.engine';

// ─── Types ───
export interface FormWithBio extends CatalogSubstanceForm {
  bioavailability: number;
  bioLabel: string;
  effectiveDose: (doseMg: number) => number;
}

export interface EnrichedEntry {
  id: string;
  source: 'catalog' | 'pharma' | 'peptide';
  nameRu: string;
  nameEn: string;
  tier: string;
  category: string[];
  description: string;
  forms: FormWithBio[];
  maxBio: number;
  minBio: number;
  avgBio: number;
  bestForm: FormWithBio | null;
  enhancers: EnhancerInfo[];
  competitors: CompetitorInfo[];
  absorptionKey: string;
  halfLifeKey: string;
  foodKey: string;
  windowKey: string;
  costPerGram: number | null;
}

export interface EnhancerInfo {
  label: string;
  mult: number;
  desc: string;
}

export interface CompetitorInfo {
  withLabel: string;
  effect: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface StatsInfo {
  total: number; supp: number; pharma: number; peptides: number;
  avgBio: number; medianBio: number;
  highBio: number; midBio: number; lowBio: number; multiForm: number;
}

// ─── Bioavailability coefficients ───
export const FORM_BIOAVAIL: Record<string, number> = {
  ubiquinol: 0.90, ubiquinone: 0.20, mitoq: 0.95,
  d3_regular: 0.60, d3_liposomal: 0.95, d3_oil: 0.85,
  curcumin_std: 0.05, curcumin_piperine: 0.30, curcumin_meriva: 0.60,
  curcumin_theracurmin: 0.70, curcumin_liposomal: 0.80,
  silymarin_std: 0.15, silymarin_phospho: 0.60, silymarin_liposomal: 0.80,
  vitc_std: 0.45, vitc_liposomal: 0.90, vitc_buffered: 0.55, vitc_ascorbyl_palmitate: 0.75,
  ala_racemic: 0.30, ala_r_form: 0.90, ala_na: 0.60,
  mg_oxide: 0.04, mg_citrate: 0.30, mg_glycinate: 0.45, mg_bisglycinate: 0.50,
  mg_threonate: 0.55, mg_malate: 0.35, mg_taurate: 0.40, mg_chloride: 0.25, mg_orotate: 0.35,
  zn_oxide: 0.20, zn_picolinate: 0.60, zn_bisglycinate: 0.55, zn_acetate: 0.45,
  zn_citrate: 0.45, zn_sulfate: 0.35, zn_monomethionine: 0.55, zn_carnosine: 0.50,
  se_selenite: 0.50, se_selenomethionine: 0.90, se_methylselenocysteine: 0.70, se_yeast: 0.85,
  fe_sulfate: 0.15, fe_bisglycinate: 0.40, fe_fumarate: 0.20, fe_glycinate: 0.35,
  ca_carbonate: 0.25, ca_citrate: 0.40, ca_malate: 0.35, ca_lactate: 0.30, ca_mcha: 0.35,
  omega3_ee: 0.60, omega3_tg: 0.85, omega3_pl: 0.95, omega3_rTG: 0.90,
  b12_cyano: 0.02, b12_methyl: 0.55, b12_hydroxo: 0.40, b12_adeno: 0.50,
  folate_fa: 0.50, folate_mthf: 0.95, folate_folinic: 0.70,
  b6_pyridoxine: 0.60, b6_p5p: 0.95,
  b2_riboflavin: 0.55, b2_r5p: 0.90,
  b1_thiamine: 0.45, b1_benfotiamine: 0.85, b1_ttfd: 0.90,
  k2_mk4: 0.40, k2_mk7: 0.70, k2_mk7_trans: 0.85,
  creatine_monohydrate: 0.90, creatine_hcl: 0.80, creatine_ethyl: 0.25,
  nac_std: 0.60, nac_effervescent: 0.75,
  glutathione_lipo: 0.85, glutathione_reduced: 0.10, glutathione_acetyl: 0.50, glutathione_liposomal: 0.90,
  resveratrol_std: 0.05, resveratrol_piperine: 0.25, resveratrol_trans: 0.35,
  quercetin_std: 0.05, quercetin_phytosome: 0.60, quercetin_dihydro: 0.40,
  nmn_std: 0.10, nmn_liposomal: 0.60, nmn_sublingual: 0.80,
  iodine_ki: 0.90, iodine_kelp: 0.40, iodine_molecular: 0.70,
  cr_picolinate: 0.40, cr_chloride: 0.20, cr_polynicotinate: 0.50,
  boron_glycinate: 0.70, boron_citrate: 0.55, boron_fructoborate: 0.65,
  mn_glycinate: 0.55, mn_sulfate: 0.20, mn_gluconate: 0.35,
  collagen_hydrolyzed: 0.80, collagen_native: 0.15, collagen_peptides: 0.85,
  hyaluronic_oral: 0.10, hyaluronic_lipo: 0.65, hyaluronic_hmw: 0.05,
  molybdenum_glycinate: 0.60, molybdenum_sulfate: 0.30,
  silicon_orthosilicic: 0.40, silicon_bamboo: 0.15, silicon_choline: 0.60,
  standard: 0.40, liposomal: 0.85, chelated: 0.60, pharma_oral: 0.85, sublingual: 0.80,
};

export const MODIFIERS: Record<string, EnhancerInfo> = {
  with_fat: { label: 'С жирной пищей', mult: 1.4, desc: 'Жиры образуют мицеллы для жирорастворимых веществ (D3, A, E, K, CoQ10, куркумин)' },
  with_piperine: { label: 'С пиперином (Bioperine)', mult: 4.0, desc: 'Ингибирует глюкуронидацию и CYP3A4, ↑ биодоступность куркумина до 2000%' },
  liposomal_form: { label: 'Липосомальная форма', mult: 2.5, desc: 'Липосомы защищают от разрушения в ЖКТ, прямой транспорт через мембраны' },
  empty_stomach: { label: 'Натощак (за 30 мин до еды)', mult: 1.2, desc: 'Без конкуренции с пищей для аминокислот, NAC, пробиотиков' },
  with_vitamin_c: { label: 'С витамином C', mult: 1.5, desc: 'Восстанавливает Fe³⁺→Fe²⁺, ↑ абсорбцию Fe в 3-6×, Zn, Cr, Se' },
  sublingual: { label: 'Сублингвально / буккально', mult: 3.0, desc: 'Минует ЖКТ и first-pass метаболизм печени через слизистую рта' },
  phytosome: { label: 'Фитосомальная технология', mult: 2.2, desc: 'Связывание с фосфатидилхолином для трансмембранного транспорта' },
  nanoparticle: { label: 'Наночастицы / SoluMatrix', mult: 2.5, desc: 'Наноразмер (<200нм) увеличивает растворимость в 2-5×' },
  with_black_pepper: { label: 'С чёрным перцем', mult: 2.0, desc: 'Пиперин ингибирует CYP3A4 и P-гликопротеин' },
  chelated_mineral: { label: 'Хелатная форма (бисглицинат)', mult: 1.8, desc: 'Аминокислотный хелат защищает от фитатов и конкуренции за DMT1' },
  with_grapefruit: { label: 'С грейпфрутовым соком', mult: 1.6, desc: 'Нарингенин ингибирует CYP3A4 (осторожно с фармой!)' },
  after_meal: { label: 'После еды (через 30-60 мин)', mult: 1.1, desc: 'Снижает раздражение ЖКТ для кислотных форм' },
  timed_release: { label: 'Пролонгированное высвобождение', mult: 1.3, desc: 'Равномерная абсорбция 4–8ч' },
  effervescent: { label: 'Шипучая форма', mult: 1.4, desc: 'Ускоренное растворение, локальный pH-сдвиг' },
  with_mcts: { label: 'С MCT-маслом (C8/C10)', mult: 1.5, desc: 'Прямая доставка в портальную вену' },
};

export const COMPETITION_PAIRS: CompetitorInfo[] = [
  { withLabel: 'Кальций (Ca)', effect: 'Конкурирует с Mg, Fe, Zn за DMT1. Интервал ≥2ч.', severity: 'HIGH' },
  { withLabel: 'Цинк (Zn)', effect: 'Конкурирует с Fe, Cu за DMT1. >50 мг Zn индуцирует металлотионеин → связывание Cu.', severity: 'HIGH' },
  { withLabel: 'Железо (Fe)', effect: 'Конкурирует с Ca, Zn, Mg. Негемовое Fe чувствительно к танинам и фитатам.', severity: 'HIGH' },
  { withLabel: 'Магний (Mg)', effect: 'Конкурирует с Ca. Ca >1000 мг ↓ всасывание Mg на 20–30%.', severity: 'MEDIUM' },
  { withLabel: 'Медь (Cu)', effect: 'Zn >50 мг/сут → металлотионеин → связывание Cu → дефицит Cu.', severity: 'MEDIUM' },
  { withLabel: 'Танины (чай/кофе/вино)', effect: 'Связывают негемовое Fe, ↓ абсорбцию до 60%. Инт. ≥1ч.', severity: 'MEDIUM' },
  { withLabel: 'Антациды / ИПП', effect: '↑ pH → ↓ растворимость CaCO₃, Zn, Fe, Cr, Mg. Хронические ИПП → дефицит Mg, Ca, B12.', severity: 'HIGH' },
  { withLabel: 'Фитаты (злаки, бобовые)', effect: 'Хелатируют Zn, Ca, Mg, Fe. Замачивание/ферментация ↓ фитаты.', severity: 'MEDIUM' },
  { withLabel: 'Метформин', effect: '↓ B12 в подвздошной (Ca-зависимый механизм). Мониторинг B12, гомоцистеина.', severity: 'HIGH' },
  { withLabel: 'Колестирамин / секвестранты', effect: 'Связывают жирорастворимые A,D,E,K + CoQ10. Интервал ≥4ч.', severity: 'HIGH' },
  { withLabel: 'Тетрациклины / фторхинолоны', effect: 'Нерастворимые хелаты с Ca, Mg, Fe, Zn. Интервал ≥2ч до / 4-6ч после.', severity: 'HIGH' },
  { withLabel: 'Левотироксин (L-T4)', effect: 'Ca, Fe, Mg, соя ↓ абсорбцию L-T4 на 20–40%. L-T4 за 4ч до минералов.', severity: 'HIGH' },
];

export const COMPETITION_KEYWORDS: Record<string, string[]> = {
  zn: ['calcium', 'iron', 'copper', 'iron'],
  fe: ['calcium', 'zinc', 'tannins'],
  ca: ['magnesium', 'zinc', 'iron', 'ppis'],
  mg: ['calcium'],
  cu: ['zinc', 'molybdenum'],
  cr: ['antacids', 'pharma'],
};

// ─── Clinical tables ───
export const ABSORPTION_SITES: Record<string, { site: string; ph: string; note: string }> = {
  mineral: { site: 'Двенадцатиперстная + тощая кишка', ph: 'pH 6.0–7.0', note: 'DMT1, ZIP4, TRPM6 — активный транспорт' },
  fat_soluble: { site: 'Тощая кишка (мицеллы)', ph: 'pH 6.5–7.5', note: 'Желчные кислоты + липаза → мицеллы → пассивная диффузия' },
  amino: { site: 'Тощая + подвздошная кишка', ph: 'pH 6.5–7.5', note: 'PepT1, B0AT1 — Na⁺-зависимый котранспорт' },
  peptide: { site: 'Тощая кишка', ph: 'pH 6.0–7.0', note: 'PepT1-транспортёр ди-/трипептидов, насыщаемый' },
  probiotic: { site: 'Толстая кишка', ph: 'pH 5.5–7.0', note: '70–90% гибнут в желудке. С едой/энтеросолюбильные капсулы.' },
  flavonoid: { site: 'Толстая кишка (микробиота)', ph: 'pH 5.5–7.0', note: 'β-глюкуронидаза → реабсорбция. Без микробиоты био <5%.' },
  sublingual_area: { site: 'Слизистая полости рта', ph: 'pH 6.5–7.5', note: 'Прямо в системный кровоток, минуя ЖКТ и first-pass.' },
  stomach: { site: 'Желудок', ph: 'pH 1.5–3.5', note: 'Пассивная диффузия слабых кислот (аспирин, бетаин HCl).' },
  large_intestine: { site: 'Толстая кишка', ph: 'pH 5.5–7.0', note: 'Медленное всасывание, SCFA-продукция.' },
};

export const THERAPEUTIC_WINDOWS: Record<string, { minMg: number; optMg: number; maxMg: number; ul: number; note: string }> = {
  zn: { minMg: 15, optMg: 30, maxMg: 50, ul: 40, note: 'UL 40 мг. >50 мг → дефицит Cu через 4-8 нед.' },
  mg: { minMg: 200, optMg: 400, maxMg: 600, ul: 350, note: 'UL 350 мг из добавок. Диарея при >600 мг цитрата.' },
  fe: { minMg: 18, optMg: 30, maxMg: 60, ul: 45, note: 'UL 45 мг. Гемохроматоз — абс. противопоказание.' },
  ca: { minMg: 500, optMg: 800, maxMg: 1200, ul: 2500, note: 'Разовая доза ≤500 мг элемент. Ca.' },
  se: { minMg: 55, optMg: 100, maxMg: 200, ul: 300, note: 'UL 300 мкг. >400 мкг → селеноз (волосы, ногти).' },
  d3: { minMg: 400, optMg: 2000, maxMg: 4000, ul: 4000, note: 'Дозы в МЕ. UL 4000 МЕ/сут.' },
  b12: { minMg: 2.4, optMg: 100, maxMg: 1000, ul: 9999, note: 'Нет UL. Депо в печени 2-5 мг.' },
  vitc: { minMg: 90, optMg: 500, maxMg: 2000, ul: 2000, note: 'UL 2000 мг. >1000 мг → осмотическая диарея.' },
  ala: { minMg: 300, optMg: 600, maxMg: 1200, ul: 1800, note: 'R-форма эффективнее. >1200 мг → тошнота.' },
  nac: { minMg: 600, optMg: 1200, maxMg: 2400, ul: 3000, note: '>2400 мг/сут → головная боль. 2-3 приёма.' },
  coq10: { minMg: 100, optMg: 200, maxMg: 400, ul: 1200, note: 'Убихинол в 3× эффективнее убихинона.' },
  omega3: { minMg: 500, optMg: 1000, maxMg: 3000, ul: 5000, note: 'EPA+DHA. >3000 мг → риск кровотечения.' },
  cr: { minMg: 25, optMg: 200, maxMg: 1000, ul: 1000, note: 'Cr пиколинат 200-1000 мкг. UL 1000 мкг.' },
  iodine: { minMg: 150, optMg: 225, maxMg: 500, ul: 1100, note: 'Дозы в мкг. UL 1100 мкг/сут.' },
};

export const HALF_LIFE_INFO: Record<string, { t12h: number; freq: string; steadyState: string }> = {
  zn: { t12h: 12, freq: '1-2 р/день', steadyState: '2-3 дня' },
  mg: { t12h: 24, freq: '2-3 р/день', steadyState: '3-5 дней' },
  fe: { t12h: 48, freq: '1 р/день', steadyState: '7-10 дней' },
  d3: { t12h: 504, freq: '1 р/день', steadyState: '2-3 мес' },
  vitc: { t12h: 2, freq: '2-3 р/день', steadyState: '1-2 дня' },
  b12: { t12h: 144, freq: '1 р/день', steadyState: '2-4 нед' },
  se: { t12h: 48, freq: '1 р/день', steadyState: '5-7 дней' },
  ala: { t12h: 0.5, freq: '2-3 р/день', steadyState: '1 день' },
  nac: { t12h: 1.5, freq: '2-3 р/день', steadyState: '1 день' },
  coq10: { t12h: 33, freq: '1-2 р/день', steadyState: '4-5 дней' },
  omega3: { t12h: 48, freq: '1-2 р/день', steadyState: '2-4 нед' },
  creatine: { t12h: 3, freq: '1 р/день', steadyState: '4 нед' },
  curcumin: { t12h: 1.5, freq: '2-3 р/день', steadyState: '1 день' },
};

export const FOOD_TIMING: Record<string, { best: string; avoid: string; note: string }> = {
  mineral: { best: 'С едой, интервал между минералами ≥2ч.', avoid: 'Чай/кофе ±1ч, фитаты, Ca >500 мг одномоментно.', note: 'Zn/Fe натощак эффективнее, но могут раздражать ЖКТ.' },
  fat_soluble: { best: 'С приёмом пищи ≥10г жира (яйца, авокадо, масло).', avoid: 'Натощак (D3 ↓60%), обезжиренная пища, колестирамин.', note: 'D3 с главным приёмом пищи ↑ уровень на 50%.' },
  amino: { best: 'Натощак за 30 мин до или 2ч после еды.', avoid: 'С высокобелковой пищей, антацидами.', note: 'BCAA/глютамин: натощак. Глицин/таурин: с едой.' },
  probiotic: { best: 'За 30 мин до еды или с едой.', avoid: 'Горячая пища (>40°C), алкоголь, антибиотики ±2ч.', note: 'S. boulardii устойчив к pH желудка.' },
  antioxidant: { best: 'С едой (жирораств.), натощак (водораств.).', avoid: 'NAC + уголь, CoQ10 + антациды.', note: 'Убихинол с жирной едой, убихинон утром.' },
  herb: { best: 'Адаптогены утром, седативные вечером.', avoid: 'Стим. адаптогены вечером. Солодка при гипертонии.', note: 'Куркума/силимарин: с пиперином + жир.' },
};

export const PERSONAL_ADJUSTERS: Record<string, { label: string; mult: number; desc: string }> = {
  age_60plus: { label: 'Возраст >60 лет', mult: 0.75, desc: 'Атрофический гастрит у 30%. Особенно: B12, Ca, Fe, Mg.' },
  ppi_use: { label: 'Приём ИПП', mult: 0.60, desc: 'Гипохлоргидрия → ↓ CaCO₃, Mg, Fe³⁺, B12. Перейти на цитраты/бисглицинаты.' },
  metformin_use: { label: 'Метформин', mult: 0.70, desc: '↓ B12 в подвздошной. Мониторинг B12 и гомоцистеина.' },
  bariatric_surgery: { label: 'Бариатрия', mult: 0.50, desc: 'Пожизненная супплементация: Fe, Ca, B12, D3, Zn, Cu.' },
  ibd_active: { label: 'ВЗК (Крон/НЯК)', mult: 0.65, desc: 'Воспаление → ↓ транспортёры. Fe, B12, Ca, D3, Zn.' },
  sibo_positive: { label: 'СИБР', mult: 0.60, desc: 'Бактериальная конкуренция за B12, Fe, аминокислоты.' },
  coeliac: { label: 'Целиакия', mult: 0.55, desc: 'Атрофия ворсинок. Безглютеновая диета 6+ мес.' },
  low_stomach_acid: { label: 'Гипохлоргидрия', mult: 0.70, desc: 'pH>3 → ↓ пепсин. Бетаин HCl или яблочный уксус.' },
};

// ─── Cost per effective gram (₽/г эффективного вещества) ─── approximate market prices
export const COST_PER_GRAM: Record<string, number> = {
  mg_oxide: 2, mg_citrate: 15, mg_glycinate: 30, mg_bisglycinate: 35, mg_threonate: 120, mg_malate: 20,
  zn_oxide: 8, zn_picolinate: 35, zn_bisglycinate: 40, zn_citrate: 25,
  d3_regular: 150, d3_liposomal: 500, d3_oil: 200,
  omega3_ee: 15, omega3_tg: 25, omega3_rTG: 35, omega3_pl: 60,
  creatine_monohydrate: 5, creatine_hcl: 30, creatine_ethyl: 50,
  nac_std: 8, nac_effervescent: 25,
  ubiquinol: 120, ubiquinone: 40, mitoq: 800,
  curcumin_std: 20, curcumin_piperine: 30, curcumin_meriva: 80, curcumin_theracurmin: 100, curcumin_liposomal: 150,
  silymarin_std: 15, silymarin_phospho: 50, silymarin_liposomal: 90,
  b12_cyano: 50, b12_methyl: 200, b12_hydroxo: 150,
  folate_fa: 30, folate_mthf: 200,
  b6_pyridoxine: 20, b6_p5p: 100,
  k2_mk4: 200, k2_mk7: 100, k2_mk7_trans: 150,
  glutathione_reduced: 25, glutathione_liposomal: 180,
  collagen_hydrolyzed: 8, collagen_peptides: 15,
};

export const ROUTE_LABELS_MAP: Record<string, string> = ROUTE_LABELS;

// ─── Helper functions ───
export function detectFormBioKey(formName: string, formRu: string, notes?: string): string {
  const t = (formName + ' ' + formRu + ' ' + (notes || '')).toLowerCase();
  if (t.includes('ubiquinol') || t.includes('убихинол')) return 'ubiquinol';
  if (t.includes('mitoq')) return 'mitoq';
  if (t.includes('ubiquinone') || t.includes('убихинон')) return 'ubiquinone';
  if (t.includes('r-') || t.includes('r лип') || t.includes('r-лип')) return 'ala_r_form';
  if (t.includes('lipo') || t.includes('липосом')) return 'liposomal';
  if (t.includes('phytos') || t.includes('meriva') || t.includes('фитосом')) return 'phytosome';
  if (t.includes('nanoparticle') || t.includes('theracurmin') || t.includes('нано')) return 'nanoparticle';
  if (t.includes('picolinate') || t.includes('пиколинат')) return 'zn_picolinate';
  if (t.includes('glycinate') || t.includes('глицинат') || t.includes('bisglycinate') || t.includes('бисглицинат')) return 'mg_glycinate';
  if (t.includes('citrate') || t.includes('цитрат')) return 'mg_citrate';
  if (t.includes('oxide') || t.includes('оксид')) return 'mg_oxide';
  if (t.includes('threonate') || t.includes('треонат')) return 'mg_threonate';
  if (t.includes('malate') || t.includes('малат')) return 'mg_malate';
  if (t.includes('taurate') || t.includes('таурат')) return 'mg_taurate';
  if (t.includes('selenomethionine') || t.includes('селенометионин')) return 'se_selenomethionine';
  if (t.includes('methylselenocysteine') || t.includes('метилселеноцистеин')) return 'se_methylselenocysteine';
  if (t.includes('curcumin') || t.includes('куркумин')) {
    if (t.includes('theracurmin') || t.includes('теракурмин')) return 'curcumin_theracurmin';
    if (t.includes('meriva') || t.includes('фитосом')) return 'curcumin_meriva';
    return 'curcumin_piperine';
  }
  if (t.includes('silymarin') || t.includes('силимарин')) return t.includes('phospho') || t.includes('фосфолипид') ? 'silymarin_phospho' : 'silymarin_std';
  if (t.includes('sulfate') || t.includes('сульфат')) return 'zn_sulfate';
  if (t.includes('carbonate') || t.includes('карбонат')) return 'ca_carbonate';
  if (t.includes('tg') || t.includes('триглицерид')) return 'omega3_tg';
  if (t.includes('ee') || t.includes('этиловый') || t.includes('ethyl')) return 'omega3_ee';
  if (t.includes('phospholipid') || t.includes('крил') || t.includes('kril') || t.includes('криль')) return 'omega3_pl';
  if (t.includes('buffered') || t.includes('буферизированный')) return 'vitc_buffered';
  if (t.includes('methyl') || t.includes('метил') || t.includes('метилкобаламин')) return 'b12_methyl';
  if (t.includes('cyano') || t.includes('циан')) return 'b12_cyano';
  if (t.includes('hydroxo') || t.includes('гидроксо')) return 'b12_hydroxo';
  if (t.includes('mthf') || t.includes('метилфолат') || t.includes('метилтетрагидрофол')) return 'folate_mthf';
  if (t.includes('p5p') || t.includes('пиридоксаль-5')) return 'b6_p5p';
  if (t.includes('r5p') || t.includes('рибофлавин-5')) return 'b2_r5p';
  if (t.includes('benfotiamine') || t.includes('бенфотиамин')) return 'b1_benfotiamine';
  if (t.includes('ttfd') || t.includes('аллитиамин')) return 'b1_ttfd';
  if (t.includes('mk7') || t.includes('менахинон-7') || t.includes('мк-7')) return 'k2_mk7';
  if (t.includes('mk4') || t.includes('менахинон-4') || t.includes('мк-4')) return 'k2_mk4';
  if (t.includes('monohydrate') || t.includes('моногидрат')) return 'creatine_monohydrate';
  if (t.includes('monomethionine') || t.includes('монометионин')) return 'zn_monomethionine';
  if (t.includes('carnosine') || t.includes('карнозин')) return 'zn_carnosine';
  if (t.includes('acetate') || t.includes('ацетат')) return 'zn_acetate';
  if (t.includes('orotate') || t.includes('оротат')) return 'mg_orotate';
  if (t.includes('chloride') || t.includes('хлорид')) return 'mg_chloride';
  if (t.includes('lactate') || t.includes('лактат')) return 'ca_lactate';
  if (t.includes('fumarate') || t.includes('фумарат')) return 'fe_fumarate';
  if (t.includes('ascorbyl') || t.includes('аскорбил')) return 'vitc_ascorbyl_palmitate';
  if (t.includes('acetyl') || t.includes('ацетил')) return 'glutathione_acetyl';
  if (t.includes('trans-resveratrol') || t.includes('транс-ресверат')) return 'resveratrol_trans';
  if (t.includes('dihydro') || t.includes('дигидро')) return 'quercetin_dihydro';
  if (t.includes('hydrolyzed') || t.includes('гидролизованный') || t.includes('пептиды')) return 'collagen_peptides';
  if (t.includes('polynicotinate') || t.includes('полиникотинат')) return 'cr_polynicotinate';
  if (t.includes('kelp') || t.includes('ламинар')) return 'iodine_kelp';
  if (t.includes('molecular') || t.includes('молекулярный')) return 'iodine_molecular';
  if (t.includes('fructoborate') || t.includes('фруктоборат')) return 'boron_fructoborate';
  if (t.includes('gluconate') || t.includes('глюконат')) return 'mn_gluconate';
  if (t.includes('orthosilicic') || t.includes('ортокремниев')) return 'silicon_orthosilicic';
  if (t.includes('bamboo') || t.includes('бамбук')) return 'silicon_bamboo';
  if (t.includes('choline') || t.includes('холин') && !t.includes('choline_bitartrate')) return 'silicon_choline';
  if (t.includes('sublingual') || t.includes('сублингвально')) return 'sublingual';
  if (t.includes('chelate') || t.includes('хелат')) return 'chelated';
  return 'standard';
}

export function getCatalogFormBio(form: CatalogSubstanceForm): number {
  const canonicalId = form.id.toLowerCase();
  const sub = ALL_SUBSTANCES.find(s =>
    s.id.toLowerCase() === canonicalId || s.id.toLowerCase().replace(/_/g, '') === canonicalId);
  if (sub?.forms?.length) {
    const mf = sub.forms.find(f =>
      form.name.toLowerCase().includes(f.form.toLowerCase().slice(0, 6)) ||
      f.form.toLowerCase().includes(form.name.toLowerCase().slice(0, 6)));
    if (mf && mf.bioavailability > 0) return mf.bioavailability;
  }
  const key = detectFormBioKey(form.name, form.nameRu, form.notes);
  if (FORM_BIOAVAIL[key] !== undefined) return FORM_BIOAVAIL[key];
  if (form.notes?.includes('Лучшая') || form.notes?.includes('Максимальная')) return 0.80;
  if (form.notes?.includes('Менее биодоступен')) return 0.25;
  if (form.notes?.includes('более биодоступна')) return 0.70;
  return form.best ? 0.65 : 0.40;
}

export function detectEnhancers(entry: SupportCatalogEntry): EnhancerInfo[] {
  const res: EnhancerInfo[] = [];
  const nru = (entry.nameRu || '').toLowerCase();
  const cats = (entry.category || []).map(c => c.toLowerCase());
  const desc = (entry.description || '').toLowerCase();
  const si = (entry.specialInstructions || []).join(' ').toLowerCase();
  const allForms = (entry.forms || []).map(f => (f.name + f.nameRu + (f.notes || '')).toLowerCase()).join(' ');
  const add = (key: string) => { if (!res.some(e => e.label === MODIFIERS[key].label)) res.push(MODIFIERS[key]); };
  const isFatSol = cats.some(c => c.includes('fat') || c.includes('жирораствор')) || desc.includes('жирорастворим') ||
    ['витамин d', 'витамин a', 'витамин e', 'витамин k', 'коэнзим', 'коq10', 'coq10', 'омега', 'omega',
     'ликопин', 'лютеин', 'астаксант', 'куркум', 'ubiquin', 'убихин', 'ресвератрол', 'кверцет', 'токотриенол',
     'зеаксантин'].some(k => nru.includes(k) || allForms.includes(k));
  if (isFatSol || si.includes('жир') || si.includes('масл')) add('with_fat');
  if (nru.includes('куркум') || desc.includes('пиперин') || si.includes('пиперин') ||
      nru.includes('ресвератрол') || nru.includes('кверцет')) add('with_piperine');
  if (['витамин c', 'витамин с', 'аскорбин', 'vitamin c', 'iron', 'железо', 'феррум'].some(k => nru.includes(k))) add('with_vitamin_c');
  if (cats.some(c => c.includes('mineral') || c.includes('минерал')) && !res.some(e => e.label === MODIFIERS.with_vitamin_c.label)) add('with_vitamin_c');
  if (allForms.includes('lipo') || allForms.includes('липосом')) add('liposomal_form');
  if (allForms.includes('phytosom') || allForms.includes('фитосом') || allForms.includes('phospho')) add('phytosome');
  if (allForms.includes('nano') || allForms.includes('theracurmin') || allForms.includes('нано')) add('nanoparticle');
  if (allForms.includes('chelate') || allForms.includes('хелат')) add('chelated_mineral');
  if (allForms.includes('sublingual') || allForms.includes('сублингвально')) add('sublingual');
  if (allForms.includes('empty') || allForms.includes('натощак') || si.includes('натощак') ||
      (cats.includes('amino') || cats.includes('аминокислота'))) add('empty_stomach');
  if (allForms.includes('effervescent') || allForms.includes('шипуч') || si.includes('растворить')) add('effervescent');
  if (si.includes('пролонг') || si.includes('timed release') || si.includes('матрикс')) add('timed_release');
  if (allForms.includes('mct') || si.includes('mct') || si.includes('среднецепочеч')) add('with_mcts');
  return res;
}

const MINERAL_IDS = ['zinc', 'magnesium', 'calcium', 'iron', 'copper', 'chromium', 'manganese'];
export function detectCompetition(entry: SupportCatalogEntry, nameRu: string, category: string[]): CompetitorInfo[] {
  const res: CompetitorInfo[] = [];
  const n = nameRu.toLowerCase();
  const cats = category.map(c => c.toLowerCase());
  const isMineral = cats.some(c => c.includes('mineral')) || MINERAL_IDS.some(id => n.includes(id));
  const isB12 = n.includes('b12') || n.includes('b-12') || n.includes('кобаламин') || n.includes('cobalamin');
  const isT4 = n.includes('левотирокс') || n.includes('тироксин') || n.includes('levothyroxin');
  if (n.includes('цинк') || n.includes('zinc')) COMPETITION_PAIRS.filter(p => p.withLabel.includes('Цинк')).forEach(p => res.push(p));
  if (n.includes('кальц') || n.includes('calcium') || n.includes('ca_')) COMPETITION_PAIRS.filter(p => p.withLabel.includes('Кальций') || p.withLabel.includes('Ca')).forEach(p => { if (!res.find(r => r.withLabel === p.withLabel)) res.push(p); });
  if (n.includes('желез') || n.includes('iron') || n.includes('fe_') || n.includes('феррум')) COMPETITION_PAIRS.filter(p => p.withLabel.includes('Железо') || p.withLabel.includes('Fe') || p.withLabel.includes('Танины')).forEach(p => { if (!res.find(r => r.withLabel === p.withLabel)) res.push(p); });
  if (n.includes('магн') || n.includes('magnesium')) COMPETITION_PAIRS.filter(p => p.withLabel.includes('Магний') || p.withLabel.includes('Mg')).forEach(p => { if (!res.find(r => r.withLabel === p.withLabel)) res.push(p); });
  if (n.includes('мед') || n.includes('copper')) COMPETITION_PAIRS.filter(p => p.withLabel.includes('Медь')).forEach(p => res.push(p));
  if (isB12) COMPETITION_PAIRS.filter(p => p.withLabel.includes('Метформин') || p.withLabel.includes('Антациды/ИПП')).forEach(p => { if (!res.find(r => r.withLabel === p.withLabel)) res.push(p); });
  if (isT4) COMPETITION_PAIRS.filter(p => p.withLabel.includes('Левотироксин')).forEach(p => { if (!res.find(r => r.withLabel === p.withLabel)) res.push(p); });
  if (isMineral && res.length === 0) COMPETITION_PAIRS.forEach(p => { if (!res.find(r => r.withLabel === p.withLabel)) res.push(p); });
  return res.slice(0, 5);
}

export function classifySubstance(nru: string, cats: string[]): { abs: string; hl: string; food: string; win: string; cost: number | null } {
  const n = nru.toLowerCase(); const c = cats.join(' ').toLowerCase();
  if (c.includes('mineral') || c.includes('минерал') || n.match(/цинк|желез|магн|кальц|селени|хром|медь|zinc|magnesium|calcium|iron|selen/)) {
    const winK = n.includes('цинк') || n.includes('zinc') ? 'zn' : n.includes('желез') || n.includes('iron') ? 'fe' :
      n.includes('магн') || n.includes('magnesium') ? 'mg' : n.includes('кальц') || n.includes('calcium') ? 'ca' :
      n.includes('селен') || n.includes('selen') ? 'se' : n.match(/хром|chrom/) ? 'cr' : n.match(/йод|iodin/) ? 'iodine' : '';
    return { abs: 'mineral', hl: winK || '', food: 'mineral', win: winK, cost: null };
  }
  if (c.includes('fat') || c.includes('жирораствор') || n.match(/витамин [dake]|vitamin [dake]|коэнзи|coq10|омега|omega|куркум|curcumin|лютеин|lutein|астаксант|astaxanth|убихин|ubiquin/)) {
    const winK = n.includes('d3') || n.includes('витамин d') || n.includes('холекальц') ? 'd3' :
      n.includes('омега') || n.includes('omega') ? 'omega3' : n.includes('coq') || n.includes('убих') ? 'coq10' : '';
    return { abs: 'fat_soluble', hl: winK || '', food: 'fat_soluble', win: winK, cost: null };
  }
  if (c.includes('amino') || c.includes('аминокислот')) return { abs: 'amino', hl: '', food: 'amino', win: '', cost: null };
  if (c.includes('probiot') || c.includes('пробиот')) return { abs: 'probiotic', hl: '', food: 'probiotic', win: '', cost: null };
  if (c.includes('antiox') || c.includes('антиоксид') || n.match(/nac|n-ацетил|глутатион|glutathione|альфа-липо|alpha.lipo|r-лип/)) {
    const winK = n.match(/nac|n-ацетил/) ? 'nac' : n.match(/альфа-липо|alpha.lipo|r-лип/) ? 'ala' : '';
    return { abs: 'amino', hl: winK, food: 'antioxidant', win: winK, cost: null };
  }
  if (c.includes('flavonoid') || c.includes('флавоноид') || c.includes('herb') || c.includes('трав') || n.match(/силимарин|silymarin|расторопш|ashwagan|rhodiol/))
    return { abs: 'flavonoid', hl: '', food: 'herb', win: '', cost: null };
  if (n.match(/коллаген|collagen|гиалурон|hyaluronic|желатин|gelatin/)) return { abs: 'amino', hl: '', food: 'antioxidant', win: '', cost: null };
  if (c.includes('peptide') || n.match(/bpc|tb-500|ghk/)) return { abs: 'peptide', hl: '', food: 'antioxidant', win: '', cost: null };
  return { abs: '', hl: '', food: 'antioxidant', win: '', cost: null };
}

export function bioColor(bio: number): string { return bio >= 0.60 ? '#00e68a' : bio >= 0.35 ? '#ff9800' : '#f44336'; }

export function bioLabel(bio: number): string {
  if (bio >= 0.80) return 'Отличная';
  if (bio >= 0.60) return 'Высокая';
  if (bio >= 0.40) return 'Средняя';
  if (bio >= 0.20) return 'Низкая';
  return 'Очень низкая';
}

// ─── Timing slot types for daily planner ───
export type TimeSlot = 'morning_empty' | 'morning_food' | 'noon_food' | 'afternoon_empty' | 'evening_food' | 'night_empty';

export interface TimingSlot { key: TimeSlot; label: string; time: string; }
export const TIMING_SLOTS: TimingSlot[] = [
  { key: 'morning_empty', label: 'Утро натощак', time: '07:00–08:00' },
  { key: 'morning_food', label: 'Утро с едой', time: '08:00–09:00' },
  { key: 'noon_food', label: 'День с едой', time: '13:00–14:00' },
  { key: 'afternoon_empty', label: 'День натощак', time: '16:00–17:00' },
  { key: 'evening_food', label: 'Вечер с едой', time: '19:00–20:00' },
  { key: 'night_empty', label: 'Перед сном', time: '22:00–23:00' },
];

// ─── Timing assignment for substance categories ───
export interface SubstanceTiming { slot: TimeSlot; reason: string; }
export const CATEGORY_TIMING: Record<string, SubstanceTiming> = {
  // Жирорастворимые — с жирной пищей утром
  fat_soluble: { slot: 'morning_food', reason: 'Жирорастворимые: с завтраком для максимальной абсорбции с жирами.' },
  // Минералы — по специфике
  mineral_ca: { slot: 'evening_food', reason: 'Ca — вечером (пик костной резорбции ночью, не конкурирует с Mg/Zn).' },
  mineral_mg: { slot: 'night_empty', reason: 'Mg — перед сном (расслабление мышц, улучшение сна).' },
  mineral_zn: { slot: 'morning_empty', reason: 'Zn — натощак для максимальной абсорбции (нет конкуренции).' },
  mineral_fe: { slot: 'morning_empty', reason: 'Fe — натощак с витамином C за 30 мин до еды.' },
  mineral_se: { slot: 'morning_empty', reason: 'Se — утром, хорошо совместим с Zn.' },
  iron: { slot: 'morning_empty', reason: 'Железо — натощак с вит. C за 30 мин до еды (без чая/кофе/Ca).' },
  // Общий минерал — утром натощак
  mineral: { slot: 'morning_empty', reason: 'Минерал — утром натощак для максимальной абсорбции.' },
  electrolyte: { slot: 'morning_food', reason: 'Электролиты — с едой для равномерного усвоения.' },
  // Антиоксиданты
  antioxidant_am: { slot: 'morning_empty', reason: 'NAC, ALA — натощак для быстрой абсорбции.' },
  antioxidant_fat: { slot: 'morning_food', reason: 'CoQ10, куркума — с жирной пищей (повышает биодоступность).' },
  antioxidant: { slot: 'morning_empty', reason: 'Антиоксидант — утром натощак.' },
  // Аминокислоты и белок
  amino: { slot: 'morning_empty', reason: 'Аминокислоты — натощак за 30 мин до еды. Конкуренция за транспортёры.' },
  amino_acid: { slot: 'morning_empty', reason: 'Аминокислоты — натощак, до или после тренировки.' },
  protein: { slot: 'afternoon_empty', reason: 'Протеин — после тренировки или между приёмами пищи.' },
  anabolic: { slot: 'morning_empty', reason: 'Анаболические аминокислоты — натощак.' },
  // Витамины
  b_vitamins: { slot: 'morning_empty', reason: 'B-витамины — утром (энергетический эффект, не пить вечером).' },
  vitamin: { slot: 'morning_food', reason: 'Витамины — с завтраком для лучшего усвоения.' },
  // Сердечно-сосудистая система
  cardioprotector: { slot: 'morning_food', reason: 'Кардиопротектор — с завтраком (контроль АД на день).' },
  cardio: { slot: 'morning_food', reason: 'Сердечно-сосудистый препарат — с едой.' },
  bp: { slot: 'morning_food', reason: 'Препарат для АД — утром с едой (суточный контроль).' },
  heart_rate: { slot: 'morning_food', reason: 'Препарат для ЧСС — утром с завтраком.' },

  // Печень и желчеотток
  hepatoprotector: { slot: 'morning_food', reason: 'Гепатопротектор — с едой (поддержка печени в течение дня).' },
  liver: { slot: 'morning_food', reason: 'Препарат для печени — с едой.' },
  bile: { slot: 'morning_food', reason: 'Желчегонное — с едой, особенно с завтраком.' },
  choleretic: { slot: 'morning_food', reason: 'Желчегонное — с едой для стимуляции оттока желчи.' },
  bile_acid: { slot: 'night_empty', reason: 'TUDCA/УДХК — перед сном натощак (2+ ч после ужина). Жёлчные кислоты конкурируют с пищей, утром — всасывание ↓.' },
  detox: { slot: 'morning_empty', reason: 'Детокс — натощак для максимальной абсорбции.' },
  // Иммунитет
  immunomodulator: { slot: 'morning_food', reason: 'Иммуномодулятор — с завтраком.' },
  immune: { slot: 'morning_food', reason: 'Иммунная поддержка — с едой.' },
  // Нервная система и сон
  neuro: { slot: 'morning_food', reason: 'Нейропротектор — утром с едой.' },
  neuroprotector: { slot: 'morning_food', reason: 'Нейропротектор — с едой.' },
  sleep: { slot: 'night_empty', reason: 'Снотворное/релаксант — перед сном.' },
  anxiolytic: { slot: 'night_empty', reason: 'Анксиолитик — вечером для расслабления.' },
  // Эндокринная
  endocrine: { slot: 'morning_food', reason: 'Эндокринный модулятор — с едой.' },
  hormonal: { slot: 'morning_empty', reason: 'Гормональный регулятор — натощак.' },
  thyroid: { slot: 'morning_empty', reason: 'Препарат для щитовидной железы — натощак за 30 мин до еды.' },
  stress: { slot: 'morning_food', reason: 'Антистресс — с завтраком.' },
  adaptogen: { slot: 'morning_food', reason: 'Адаптоген — утром или днём с едой.' },
  herb_adaptogen: { slot: 'morning_empty', reason: 'Адаптогены — утром и днём. Не вечером (нарушение сна).' },
  herb_sedative: { slot: 'night_empty', reason: 'Ашваганда, валериана — перед сном.' },
  // ЖКТ
  probiotic: { slot: 'morning_empty', reason: 'Пробиотики — за 30 мин до завтрака натощак (выживаемость штаммов выше без конкуренции с пищей).' },
  gi: { slot: 'morning_empty', reason: 'Препарат для ЖКТ — натощак.' },
  gut: { slot: 'morning_empty', reason: 'Поддержка кишечника — натощак (клетчатка/глютамин/бутират не конкурируют с пищей).' },
  digestion: { slot: 'morning_food', reason: 'Пищеварение — с едой.' },
  // Почки и мочевыделение
  renal: { slot: 'morning_food', reason: 'Нефропротектор — с завтраком.' },
  nephroprotector: { slot: 'morning_food', reason: 'Нефропротектор — с едой.' },
  // Суставы, кости, кожа
  joint: { slot: 'morning_food', reason: 'Для суставов — с едой.' },
  bone: { slot: 'morning_food', reason: 'Для костей — с едой (жирорастворимые + Ca).' },
  collagen: { slot: 'morning_empty', reason: 'Коллаген — натощак или с вит. C для синтеза.' },
  skin: { slot: 'morning_food', reason: 'Для кожи — с едой.' },
  beauty: { slot: 'morning_food', reason: 'Красота — с едой.' },
  // Протеолитические и муколитические ферменты
  antiinflammatory: { slot: 'morning_food', reason: 'Противовоспалительное — с едой.' },
  anti_inflammatory: { slot: 'morning_food', reason: 'Противовоспалительное — с едой.' },
  enzyme: { slot: 'morning_empty', reason: 'Протеолитические ферменты (серрапептаза, бромелайн) — натощак за 30–40 мин до еды. С едой переваривают белки пищи, не всасываются системно.' },
  proteolytic: { slot: 'morning_empty', reason: 'Протеолитический фермент — натощак. При контакте с пищей переваривает её, теряя системный эффект.' },
  fibrinolytic: { slot: 'morning_empty', reason: 'Фибринолитик (наттокиназа, лумброкиназа) — натощак. Максимум фибринолитической активности утром. С едой → потеря эффекта.' },
  mucolytic: { slot: 'morning_empty', reason: 'Муколитик — натощак для разжижения слизи и системной абсорбции.' },
  hemorheologic: { slot: 'morning_empty', reason: 'Гемореологический — натощак (снижение вязкости крови, улучшение микроциркуляции).' },
  anticoagulant: { slot: 'morning_empty', reason: 'Антикоагулянт — натощак утром. Контроль МНО/PT при варфарине.' },
  antiagg: { slot: 'morning_food', reason: 'Антиагрегант — утром с едой (снижение риска тромбоза, защита ЖКТ).' },
  // Пептиды и аминокислоты
  peptide: { slot: 'morning_empty', reason: 'Пептиды — натощак за 30 мин до еды (гидролиз в ЖКТ конкурирует с пищей).' },
  gh_secretagogue: { slot: 'morning_empty', reason: 'Секретагог ГР (голодный грелин) — натощак за 30 мин до завтрака.' },
  gh_releasing: { slot: 'morning_food', reason: 'Рилизинг-пептиды — по инструкции, часто утром натощак.' },
  // Нейро/ноотропы
  dopamine: { slot: 'morning_empty', reason: 'Дофаминергический (L-DOPA, мукуна) — натощак. Аминокислоты из пищи конкурируют за L-аминотранспортёр.' },
  nootropic: { slot: 'morning_empty', reason: 'Ноотроп — утром натощак (стимуляция когниции). Не вечером — нарушение сна.' },
  serotonin: { slot: 'morning_food', reason: 'Серотонинергический (5-HTP) — с лёгкой едой для ↓ тошноты.' },
  // Метаболизм и энергия
  metabolic: { slot: 'morning_food', reason: 'Метаболический препарат — с завтраком.' },
  energy: { slot: 'morning_empty', reason: 'Энергетик — утром натощак.' },
  mitochondrial: { slot: 'morning_food', reason: 'Митохондриальная поддержка — с жирной пищей.' },
  methylation: { slot: 'morning_empty', reason: 'Метилирование — натощак.' },
  // Омега-3 и липиды
  omega: { slot: 'noon_food', reason: 'Омега-3 — с самым большим приёмом пищи для лучшей абсорбции.' },
  omega3: { slot: 'noon_food', reason: 'Омега-3 — с самым большим приёмом пищи.' },
  omega3_any: { slot: 'noon_food', reason: 'Омега-3 — с самым большим приёмом пищи для лучшей абсорбции.' },
  lipid_low: { slot: 'evening_food', reason: 'Липидснижающий — вечером с едой.' },
  cholesterol: { slot: 'evening_food', reason: 'Холестерин-контроль — вечером.' },
  // Флавоноиды/полифенолы
  flavonoid: { slot: 'morning_food', reason: 'Флавоноид — с жирной пищей (биодоступность +).' },
  polyphenol: { slot: 'morning_food', reason: 'Полифенол — с едой.' },
  venotonic: { slot: 'morning_food', reason: 'Венотоник — с завтраком.' },
  // Гормональные модуляторы
  aromatase_inhibitor: { slot: 'morning_food', reason: 'Ингибитор ароматазы — утром с едой (↓ тошноты, стабильный уровень).' },
  pharma: { slot: 'morning_food', reason: 'Фармацевтический препарат — с едой для ↓ раздражения ЖКТ, если не указано иное.' },
  androgen: { slot: 'morning_food', reason: 'Андрогенный — с едой (жир для абсорбции тестостерона эфиров).' },
  aas_derivative: { slot: 'morning_food', reason: 'Производное AAS — с едой (защита печени, ↑ биодоступность).' },
  // Сердечно-сосудистые препараты
  ace_inhibitor: { slot: 'morning_food', reason: 'иАПФ — утром с завтраком (контроль АД на день).' },
  antihypertensive: { slot: 'morning_food', reason: 'Антигипертензивный — утром с едой.' },
  hypocholesterolemic: { slot: 'evening_food', reason: 'Холестерин-снижающий — вечером с едой (пик синтеза холестерина ночью).' },
  // Прочие категории
  coagulation: { slot: 'morning_food', reason: 'Коагулянт/K2 — с жирной пищей (↑ абсорбции).' },
  vitamin_der: { slot: 'morning_food', reason: 'Производное витамина — с едой для ↓ раздражения ЖКТ.' },
  glucosinolate: { slot: 'morning_food', reason: 'Глюкозинолат (DIM/I3C) — с жирной пищей (↑ биодоступность).' },
  vitamin_a_d: { slot: 'morning_food', reason: 'Жирорастворимые витамины A/D — с жирным завтраком.' },
  herbal: { slot: 'morning_food', reason: 'Травяной экстракт — с едой. Уточнить по конкретному растению.' },
  herb: { slot: 'morning_food', reason: 'Растительный экстракт — с едой.' },
  // Прочее
  creatine: { slot: 'afternoon_empty', reason: 'Креатин — после тренировки или в любое время (главное — ежедневно).' },
  anti_aging: { slot: 'morning_food', reason: 'Антивозрастной — с завтраком.' },
  recovery: { slot: 'afternoon_empty', reason: 'Восстановление — после тренировки.' },
  // По умолчанию — разумный базовый вариант
  default: { slot: 'morning_food', reason: 'Принимать с завтраком для лучшего усвоения и защиты ЖКТ.' },
};

// ─── Lab markers to monitor per substance class ───
export interface LabMarker { marker: string; what: string; when: string; target: string; note: string; }
export const LAB_MARKERS: Record<string, LabMarker[]> = {
  zn: [
    { marker: 'Цинк сывороточный', what: 'Уровень Zn в сыворотке', when: 'Каждые 3 мес', target: '70–120 мкг/дл', note: 'Сывороточный Zn — не идеальный маркер (↓ при воспалении). Лучше: Zn в эритроцитах или волосах.' },
    { marker: 'Щелочная фосфатаза (ЩФ)', what: 'Zn-зависимый фермент', when: 'Каждые 3 мес', target: '40–130 Ед/л', note: '↓ ЩФ при дефиците Zn. Повышается при приёме Zn.' },
    { marker: 'Медь сывороточная', what: 'Антагонист Zn', when: 'Каждые 6 мес при Zn >50 мг/сут', target: '70–140 мкг/дл', note: 'Риск дефицита Cu при высокодозном Zn (>50 мг/сут).' },
  ],
  mg: [
    { marker: 'Mg в эритроцитах', what: 'Внутриклеточный Mg (точнее сывороточного)', when: 'Каждые 3 мес', target: '4.2–6.8 мг/дл', note: 'Сывороточный Mg — поздний маркер. Эритроцитарный отражает тканевые запасы.' },
    { marker: 'Mg сывороточный', what: 'Скрининг', when: 'Каждые 3 мес', target: '1.7–2.5 мг/дл', note: 'Гомеостатически регулируется. Норма не исключает дефицит.' },
  ],
  fe: [
    { marker: 'Ферритин', what: 'Запасы Fe в тканях', when: 'Каждые 3 мес', target: '50–150 нг/мл (♂)', note: '<30 = истощение запасов. >300 = перегрузка (исключить гемохроматоз).' },
    { marker: 'Сывороточное железо + ОЖСС', what: 'Транспортный пул Fe', when: 'Каждые 3 мес', target: 'Fe 60–170 мкг/дл; ОЖСС 250–450', note: 'Насыщение трансферрина <16% = дефицит.' },
    { marker: 'Гемоглобин, MCV, MCH', what: 'Функциональный статус Fe', when: 'Каждые 1–2 мес', target: 'Hb 13.5–17.5 г/дл (♂)', note: 'Микроцитоз (↓MCV) + гипохромия (↓MCH) = железодефицит.' },
  ],
  ca: [
    { marker: 'Ca ионизированный', what: 'Биологически активный Ca', when: 'Каждые 6 мес', target: '1.15–1.33 ммоль/л', note: 'Точнее общего Ca. Не зависит от альбумина.' },
    { marker: 'Ca общий + альбумин', what: 'Скрининг с коррекцией', when: 'Каждые 6 мес', target: '8.5–10.5 мг/дл', note: 'Коррекция: Ca скорр = Ca общ + 0.8 × (4 – альбумин).' },
    { marker: 'Паратгормон (ПТГ)', what: 'Регулятор Ca-гомеостаза', when: 'Каждые 6–12 мес', target: '15–65 пг/мл', note: '↑ ПТГ при дефиците Ca или D3.' },
  ],
  d3: [
    { marker: '25(OH)D', what: 'Основной маркер статуса D', when: 'Каждые 3–6 мес', target: '40–80 нг/мл', note: '<20 = дефицит; 20–30 = недостаточность; >100 = токсичность.' },
    { marker: 'Ca общий + Ca²⁺', what: 'Исключить гиперкальциемию', when: 'При дозах >4000 МЕ/сут', target: '<10.5 мг/дл', note: 'Гиперкальциемия — основной риск токсичности D3.' },
    { marker: 'ПТГ', what: 'Обратная связь', when: 'Каждые 6 мес', target: '15–65 пг/мл', note: '↓ ПТГ при адекватном статусе D.' },
  ],
  b12: [
    { marker: 'B12 сывороточный', what: 'Скрининг', when: 'Каждые 6 мес', target: '>400 пг/мл', note: '200–400 = серая зона. <200 = дефицит. Метилмалоновая кислота точнее.' },
    { marker: 'Гомоцистеин', what: 'Функциональный маркер B12/фолатов', when: 'Каждые 6 мес', target: '<12 мкмоль/л', note: '↑ гомоцистеин при дефиците B12, фолатов, B6.' },
    { marker: 'Метилмалоновая кислота (ММК)', what: 'Золотой стандарт дефицита B12', when: 'При подозрении', target: '<0.4 мкмоль/л', note: '↑ ММК = тканевой дефицит B12 даже при нормальном сывороточном.' },
  ],
  se: [
    { marker: 'Селен сывороточный', what: 'Уровень Se', when: 'Каждые 3–6 мес', target: '70–150 мкг/л', note: 'Оптимум для глутатионпероксидазы: 90–120 мкг/л.' },
    { marker: 'Глутатионпероксидаза (GPx)', what: 'Se-зависимый фермент', when: 'Каждые 6 мес', target: 'Зависит от лаборатории', note: 'Функциональный маркер. Плато при Se >90 мкг/л.' },
  ],
  omega3: [
    { marker: 'Омега-3 индекс (EPA+DHA в мембране эритроцита)', what: 'Золотой стандарт статуса омега-3', when: 'Каждые 3–6 мес', target: '8–12%', note: '<4% = высокий СС-риск; >8% = кардиопротекция.' },
    { marker: 'Триглицериды', what: 'Липидный профиль', when: 'Каждые 3 мес', target: '<150 мг/дл', note: 'Омега-3 ↓ ТГ на 15–30%.' },
  ],
  coq10: [
    { marker: 'CoQ10 плазмы', what: 'Уровень CoQ10', when: 'Каждые 3–6 мес', target: '>1.0 мг/л', note: '<0.6 = дефицит. Статины ↓ CoQ10 на 20–40%.' },
  ],
  liver: [
    { marker: 'АЛТ, АСТ', what: 'Цитолиз гепатоцитов', when: 'Каждые 1–3 мес', target: '<40 Ед/л', note: 'Контроль при приёме NAC, ALA, силимарина для оценки гепатопротекции.' },
    { marker: 'ГГТ, ЩФ', what: 'Холестаз', when: 'Каждые 1–3 мес', target: 'ГГТ <55, ЩФ <150 Ед/л', note: 'TUDCA + силимарин ↓ ГГТ и ЩФ.' },
  ],
  kidney: [
    { marker: 'СКФ (креатинин, цистатин C)', what: 'Функция почек', when: 'Каждые 3–6 мес', target: '>90 мл/мин/1.73м²', note: 'Контроль при высокодозном креатине, Mg, Ca.' },
    { marker: 'K⁺ сывороточный', what: 'Электролитный баланс', when: 'Каждые 1–3 мес', target: '3.5–5.1 ммоль/л', note: 'Риск гиперкалиемии: K⁺-содержащие добавки + ИАПФ/БРА.' },
  ],
};

// ─── Loading phase protocols ───
export interface LoadingProtocol { substance: string; loadingDose: string; loadingDays: number; maintDose: string; purpose: string; note: string; }
export const LOADING_PROTOCOLS: LoadingProtocol[] = [
  { substance: 'Креатин моногидрат', loadingDose: '20 г/сут (4 × 5 г)', loadingDays: 5, maintDose: '5 г/сут', purpose: 'Насыщение мышц за 5 дней вместо 4 нед.', note: 'Без загрузки: 5 г/сут 28 дней до насыщения. Загрузка ускоряет в 5×. У 30% — ЖКТ-дискомфорт при 20 г.' },
  { substance: 'D3 (холекальциферол)', loadingDose: '50 000 МЕ/нед', loadingDays: 56, maintDose: '2000–4000 МЕ/сут', purpose: 'Подъём 25(OH)D с 20 до 50 нг/мл за 8 нед.', note: 'Альтернатива: 6000 МЕ/сут 8 нед. Контроль Ca²⁺ и 25(OH)D через 8 нед.' },
  { substance: 'Омега-3 (EPA+DHA)', loadingDose: '3000 мг/сут', loadingDays: 30, maintDose: '1000 мг/сут', purpose: 'Подъём омега-3 индекса до 8% за 1 мес.', note: 'Загрузка значима при исходно низком индексе (<4%). Через 1 мес — анализ омега-3 индекса.' },
  { substance: 'Железо (бисглицинат)', loadingDose: '100–200 мг элемент. Fe/сут', loadingDays: 60, maintDose: '30 мг/сут', purpose: 'Восполнение дефицита Fe (ферритин <30).', note: 'Контроль ферритина каждые 4 нед. При нормализации — переход на поддержку.' },
  { substance: 'Mg (цитрат/глицинат)', loadingDose: '600 мг/сут', loadingDays: 30, maintDose: '300–400 мг/сут', purpose: 'Восполнение тканевого дефицита Mg.', note: 'Сывороточный Mg не показателен. Ориентир — клиника (судороги, сон, АД).' },
  { substance: 'B12 (метилкобаламин)', loadingDose: '1000–2000 мкг/сут', loadingDays: 30, maintDose: '100–500 мкг/сут', purpose: 'Восполнение дефицита B12.', note: 'Сублингвально ×3 эффективнее перорального. Контроль гомоцистеина и ММК.' },
  { substance: 'CoQ10 (убихинол)', loadingDose: '300 мг/сут', loadingDays: 14, maintDose: '100–200 мг/сут', purpose: 'Быстрое насыщение при приёме статинов.', note: 'Убихинол в 3× эффективнее убихинона. С жирной едой.' },
];

// ─── Smart form recommender (budget/goal-based) ───
export interface FormRecommendation { formKey: string; label: string; tier: 'budget' | 'standard' | 'premium'; goal: string; budget: string; }
export const FORM_RECOMMENDER: Record<string, FormRecommendation[]> = {
  mg: [
    { formKey: 'mg_oxide', label: 'Mg оксид', tier: 'budget', goal: 'Бюджетно: слабительный эффект', budget: '~150 ₽/мес' },
    { formKey: 'mg_citrate', label: 'Mg цитрат', tier: 'standard', goal: 'Оптимально: био 30%, мягкое усвоение', budget: '~500 ₽/мес' },
    { formKey: 'mg_glycinate', label: 'Mg бисглицинат', tier: 'premium', goal: 'Премиум: био 50%, лучшая переносимость', budget: '~1200 ₽/мес' },
  ],
  zn: [
    { formKey: 'zn_sulfate', label: 'Zn сульфат', tier: 'budget', goal: 'Бюджетно: био 35%, может раздражать ЖКТ', budget: '~100 ₽/мес' },
    { formKey: 'zn_picolinate', label: 'Zn пиколинат', tier: 'standard', goal: 'Оптимально: био 60%, хорошая абсорбция', budget: '~400 ₽/мес' },
    { formKey: 'zn_bisglycinate', label: 'Zn бисглицинат', tier: 'premium', goal: 'Премиум: био 55%, без раздражения ЖКТ', budget: '~600 ₽/мес' },
  ],
  d3: [
    { formKey: 'd3_regular', label: 'D3 в масле', tier: 'standard', goal: 'Стандарт: био 60% с жирной едой', budget: '~200 ₽/мес' },
    { formKey: 'd3_liposomal', label: 'D3 липосомальный', tier: 'premium', goal: 'Премиум: био 95%, не зависит от еды', budget: '~800 ₽/мес' },
  ],
  omega3: [
    { formKey: 'omega3_ee', label: 'Омега-3 этиловые эфиры', tier: 'budget', goal: 'Бюджетно: био 60%, стандарт', budget: '~400 ₽/мес' },
    { formKey: 'omega3_tg', label: 'Омега-3 триглицериды', tier: 'standard', goal: 'Оптимально: био 85%, естественная форма', budget: '~700 ₽/мес' },
    { formKey: 'omega3_rTG', label: 'Омега-3 rTG (реэтерифицированные)', tier: 'premium', goal: 'Премиум: био 90%, концентрированные', budget: '~1200 ₽/мес' },
  ],
  curcumin: [
    { formKey: 'curcumin_std', label: 'Куркумин стандарт', tier: 'budget', goal: 'Бюджетно: био 5% (нужен пиперин)', budget: '~200 ₽/мес' },
    { formKey: 'curcumin_piperine', label: 'Куркумин + пиперин', tier: 'standard', goal: 'Оптимально: био 30%', budget: '~400 ₽/мес' },
    { formKey: 'curcumin_meriva', label: 'Куркумин Meriva (фитосома)', tier: 'premium', goal: 'Премиум: био 60%, клинические данные', budget: '~1500 ₽/мес' },
  ],
  creatine: [
    { formKey: 'creatine_monohydrate', label: 'Моногидрат (Creapure)', tier: 'standard', goal: 'Золотой стандарт: био 90%, 1000+ исследований', budget: '~300 ₽/мес' },
    { formKey: 'creatine_hcl', label: 'Креатин HCl', tier: 'premium', goal: 'Премиум: растворимость ×40, но не доказано преимущество', budget: '~1000 ₽/мес' },
  ],
  fe: [
    { formKey: 'fe_sulfate', label: 'Fe сульфат', tier: 'budget', goal: 'Бюджетно: био 15%, раздражает ЖКТ', budget: '~80 ₽/мес' },
    { formKey: 'fe_bisglycinate', label: 'Fe бисглицинат', tier: 'premium', goal: 'Премиум: био 40%, без побочных эффектов', budget: '~600 ₽/мес' },
  ],
  b12: [
    { formKey: 'b12_cyano', label: 'Цианокобаламин', tier: 'budget', goal: 'Бюджетно: пассивная абсорбция 2%', budget: '~50 ₽/мес' },
    { formKey: 'b12_methyl', label: 'Метилкобаламин', tier: 'premium', goal: 'Премиум: активная форма, био 55%', budget: '~400 ₽/мес' },
  ],
  collagen: [
    { formKey: 'collagen_hydrolyzed', label: 'Гидролизованный коллаген', tier: 'standard', goal: 'Оптимально: био 80%, пептиды I и III типа', budget: '~800 ₽/мес' },
    { formKey: 'collagen_peptides', label: 'Коллагеновые пептиды (II тип)', tier: 'premium', goal: 'Премиум: био 85%, для суставов', budget: '~1500 ₽/мес' },
  ],
};
