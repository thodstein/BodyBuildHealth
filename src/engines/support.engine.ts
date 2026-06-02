import { 
  EffectEntry, 
  SubstanceEntry, 
  MechanismEntry, 
  OrganEntry, 
  SystemEntry, 
  RiskEntry, 
  RecommendationEntry,
  RiskResult
} from '../core/types';
import { 
  UCUM_MAP, 
  RISK_SYSTEMS,
  BASE_RISK,
  DRUG_THRESHOLDS,
  GENETIC_MULTIPLIERS,
  SUPPORT_BASE_COVERAGE
} from '../core/constants';
import { MASTER_DB } from '../core/master-db';

export interface SupportInput {
  userId?: string;
  substances: string[];
  goals?: string[];
  labs?: { code: string; value: number }[];
  demographics?: {
    age: number;
    weight: number;
    sex: 'male' | 'female';
  };
  genetics?: Record<string, string>;
  nutritionFactor?: number;
  trainingFactor?: number;
  drugDoses?: Record<string, number>;
  supportDoses?: Record<string, number>;
}

export interface SupportOutput {
  riskAssessment: RiskResult;
  recommendations: RecommendationEntry[];
  supportScore: number;
  riskBeforeSupport: number;
  riskAfterSupport: number;
  systemSupport: Record<string, number>;
  organSupport: Record<string, number>;
  metadata: {
    processedSubstances: SubstanceEntry[];
    effectiveMechanisms: MechanismEntry[];
    affectedOrgans: OrganEntry[];
    affectedSystems: SystemEntry[];
  };
}

const SYSTEM_RISK_WEIGHTS: Record<string, number> = {
  cardio: 1.5,
  hepatic: 1.4,
  renal: 1.2,
  neuro: 1.0,
  endocrine: 1.3,
  hematologic: 1.1,
  reproductive: 0.8,
  musculoskeletal: 0.6
};

const NUTRITION_SYSTEM_REDUCTION: Record<string, number> = {
  cardio: 0.25, hepatic: 0.40, renal: 0.30, neuro: 0.20,
  endocrine: 0.20, hematologic: 0.25, reproductive: 0.15, musculoskeletal: 0.10
};

const TRAINING_SYSTEM_REDUCTION: Record<string, number> = {
  cardio: 0.35, hepatic: 0.10, renal: 0.15, neuro: 0.15,
  endocrine: 0.10, hematologic: 0.20, reproductive: 0.10, musculoskeletal: 0.15
};

const GENETIC_SYSTEM_MAP: Record<string, string[]> = {
  COMT_Val158Met: ['neuro', 'endocrine'],
  MTHFR_C677T: ['cardio', 'hematologic'],
  AGTR1_A1166C: ['cardio'],
  CYP3A4_22: ['hepatic'],
  NOS3_G894T: ['cardio', 'renal']
};

const AAS_SYSTEM_PROFILE: Record<string, Record<string, number>> = {
  testosterone_enanthate: { cardio: 0.15, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.30, hematologic: 0.15, reproductive: 0.25 },
  testosterone_cypionate: { cardio: 0.15, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.30, hematologic: 0.15, reproductive: 0.25 },
  testosterone_propionate: { cardio: 0.15, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.30, hematologic: 0.15, reproductive: 0.25 },
  trenbolone_acetate: { cardio: 0.20, hepatic: 0.25, renal: 0.10, neuro: 0.20, endocrine: 0.15, hematologic: 0.05, reproductive: 0.05 },
  trenbolone_enanthate: { cardio: 0.20, hepatic: 0.25, renal: 0.10, neuro: 0.20, endocrine: 0.15, hematologic: 0.05, reproductive: 0.05 },
  nandrolone_decanoate: { cardio: 0.10, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.25, hematologic: 0.20, reproductive: 0.30 },
  nandrolone_phenylprop: { cardio: 0.10, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.25, hematologic: 0.20, reproductive: 0.30 },
  boldenone_undecylenate: { cardio: 0.15, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.30, hematologic: 0.15, reproductive: 0.25 },
  methenolone_enanthate: { cardio: 0.10, hepatic: 0.05, renal: 0.05, neuro: 0.05, endocrine: 0.35, hematologic: 0.15, reproductive: 0.25 },
  oxandrolone: { cardio: 0.10, hepatic: 0.40, renal: 0.05, neuro: 0.05, endocrine: 0.15, hematologic: 0.10, reproductive: 0.15 },
  methandienone: { cardio: 0.15, hepatic: 0.40, renal: 0.05, neuro: 0.05, endocrine: 0.20, hematologic: 0.05, reproductive: 0.10 },
  stanozolol: { cardio: 0.25, hepatic: 0.35, renal: 0.05, neuro: 0.05, endocrine: 0.10, hematologic: 0.10, reproductive: 0.10 },
  chlorodehydromethyltestosterone: { cardio: 0.15, hepatic: 0.40, renal: 0.05, neuro: 0.05, endocrine: 0.15, hematologic: 0.10, reproductive: 0.10 },
  ostarine_mk2866: { cardio: 0.05, hepatic: 0.15, renal: 0.05, neuro: 0.05, endocrine: 0.35, hematologic: 0.05, reproductive: 0.30 },
  ligandrol_lgd4033: { cardio: 0.05, hepatic: 0.20, renal: 0.05, neuro: 0.05, endocrine: 0.40, hematologic: 0.05, reproductive: 0.20 },
  rad140: { cardio: 0.05, hepatic: 0.20, renal: 0.05, neuro: 0.10, endocrine: 0.35, hematologic: 0.05, reproductive: 0.20 },
  gh_peptide: { cardio: 0.10, hepatic: 0.05, renal: 0.10, neuro: 0.10, endocrine: 0.35, hematologic: 0.10, reproductive: 0.20 }
};

const SUPPORT_EC50: Record<string, number> = {
  telmisartan: 20,
  nebivolol: 5,
  nac: 600,
  tudca: 250,
  omega3: 1000,
  magnesium: 200,
  berberine: 500,
  coq10: 100,
  vitamin_d3: 2000,
  zinc: 15,
  hcg: 250,
  alpha_lipoic: 300,
  ashwagandha: 300,
  saw_palmetto: 320,
  celery_extract: 500,
  vitamin_k2: 45,
  selenium: 50,
  milk_thistle: 200,
  probiotics: 5,
  vitamin_b12: 50,
  vitamin_b6: 20,
  folate: 200,
  iron: 18,
  copper: 1,
  astragalus: 500,
  taurine: 500,
  melatonin: 1,
  ginseng: 200,
  egcg: 200,
  curcumin: 300,
  phosphatidylcholine: 500,
  l_carnitine: 500,
  glucosamine: 500,
  chondroitin: 400,
  msm: 500,
  collagen: 2500,
  hyaluronic: 50,
  boswellia: 200,
  vitamin_c: 250,
  bromelain: 200,
  bpc157: 250,
  tb500: 5,
  meloxicam: 7,
  diclofenac: 50,
};

const SUPPORT_DEFAULT_DOSE: Record<string, number> = {
  telmisartan: 40,
  nebivolol: 5,
  nac: 1200,
  tudca: 500,
  omega3: 2000,
  magnesium: 400,
  berberine: 1000,
  coq10: 200,
  vitamin_d3: 4000,
  zinc: 30,
  hcg: 500,
  alpha_lipoic: 600,
  ashwagandha: 600,
  saw_palmetto: 640,
  celery_extract: 1000,
  vitamin_k2: 200,
  selenium: 200,
  milk_thistle: 600,
  probiotics: 10,
  vitamin_b12: 1000,
  vitamin_b6: 50,
  folate: 800,
  iron: 27,
  copper: 2,
  astragalus: 1000,
  taurine: 3000,
  melatonin: 3,
  ginseng: 400,
  egcg: 400,
  curcumin: 1000,
  phosphatidylcholine: 1200,
  l_carnitine: 2000,
  glucosamine: 1500,
  chondroitin: 1200,
  msm: 3000,
  collagen: 10000,
  hyaluronic: 200,
  boswellia: 600,
  vitamin_c: 1000,
  bromelain: 500,
  bpc157: 500,
  tb500: 10,
  meloxicam: 15,
  diclofenac: 150,
};

export const SUPPORT_RESEARCH: Record<string, { study: string; conclusion: string; year: number }[]> = {
  telmisartan:      [{ study: 'Fliser D. et al., Hypertension 2011', conclusion: 'Телмисартан — ARB с доказанным нефропротекторным и метаболическим эффектом. Снижает риск ДН и улучшает чувствительность к инсулину через PPAR-γ.', year: 2011 }],
  nebivolol:        [{ study: 'Vanhoutte PM. et al., J Hypertens 2013', conclusion: 'Небиволол — β1-селективный блокатор с NO-опосредованной вазодилатацией. Минимальное влияние на метаболизм и эректильную функцию.', year: 2013 }],
  nac:              [{ study: 'Samuni Y. et al., Curr Mol Pharmacol 2013', conclusion: 'NAC — предшественник глутатиона, гепатопротектор при ацетаминофеновой и ААС-индуцированной гепатотоксичности. Антиоксидант, нейропротектор.', year: 2013 }],
  tudca:            [{ study: 'Beuers U. et al., Dig Dis 2010', conclusion: 'TUDCA — урсодезоксихолевая кислота, доказанная эффективность при холестазе и ААС-индуцированной гепатотоксичности. Стимулирует bile flow.', year: 2010 }],
  omega3:           [{ study: 'Ramsden CE. et al., BMJ 2013; Manson JE. et al., NEJM 2018', conclusion: 'Омега-3 EPA/DHA — кардиопротекция при триглицеридемии >1.7 ммоль/л. Нейропротекция через противовоспалительный механизм.', year: 2018 }],
  magnesium:        [{ study: 'Grober U. et al., Nutrition 2015', conclusion: 'Магний бисглицинат — высокая биодоступность. Снижает возбудимость ЦНС, мышечные судороги, нормализует АД. Дефицит усиливает нейротоксичность.', year: 2015 }],
  berberine:        [{ study: 'Lan J. et al., J Ethnopharmacol 2015', conclusion: 'Берберин — активатор AMPK, сопоставим с метформином по снижению HOMA-IR. Гепатопротектор при НАЖБП.', year: 2015 }],
  coq10:            [{ study: 'Littarru GP. et al., Mol Syndromol 2011', conclusion: 'CoQ10 — ключевой компонент ETC. Кардиопротекция при статин-индуцированной миопатии. Нейропротекция при митохондриальной дисфункции.', year: 2011 }],
  vitamin_d3:       [{ study: 'Holick MF., NEJM 2007', conclusion: 'Витамин D3 — иммуномодулятор и гормон. Дефицит (<30 нг/мл) ассоциирован с аутоиммунными заболеваниями, депрессией и кардиоваскулярным риском.', year: 2007 }],
  zinc:             [{ study: 'Prasad AS., J Trace Elem Exp Med 1998', conclusion: 'Цинк — критичен для сперматогенеза и иммунитета. Дефицит → гипогонадизм, снижение тестостерона, иммунодефицит.', year: 1998 }],
  hcg:              [{ study: 'Liu PY. et al., J Clin Endocrinol Metab 2002', conclusion: 'ХГЧ — лютеинизирующий аналог, предотвращает атрофию яичек на курсе ААС и ускоряет восстановление HPTA в ПКТ.', year: 2002 }],
  alpha_lipoic:     [{ study: 'Packer L. et al., Free Radic Biol Med 1995', conclusion: 'α-Липоевая кислота — универсальный антиоксидант, восстанавливает витамины C/E. Нейропротектор при диабетической нейропатии.', year: 1995 }],
  ashwagandha:      [{ study: 'Chandrasekhar K. et al., Indian J Psychol Med 2012', conclusion: 'Ашваганда — адаптоген, снижает кортизол на 30%, повышает DHEA-S и тестостерон. Анксиолитический эффект через GABA-модуляцию.', year: 2012 }],
  milk_thistle:     [{ study: 'Fraschini F. et al., Phytother Res 2002', conclusion: 'Силимарин (расторопша) — гепатопротектор с антиоксидантным и антифибротическим действием. Доказан при ААС-индуцированном повреждении печени.', year: 2002 }],
  melatonin:        [{ study: 'Claustrat B. et al., Neuroendocrinol 2005', conclusion: 'Мелатонин — регулятор циркадных ритмов, нейропротектор, антиоксидант. Улучшает качество сна и снижает нейровоспаление.', year: 2005 }],
  curcumin:         [{ study: 'Gupta SC. et al., AAPS J 2013', conclusion: 'Куркумин — ингибитор NF-κB и COX-2, гепатопротектор и кардиопротектор. Низкая биодоступность решается пиперином или липосомами.', year: 2013 }],
  phosphatidylcholine: [{ study: 'Gundermann KJ. et al., Clin Rev Allergy Immunol 2012', conclusion: 'Фосфатидилхолин — существенный компонент мембран гепатоцитов. Восстанавливает целостность печени при токсическом повреждении.', year: 2012 }],
  l_carnitine:      [{ study: 'Ferrari R. et al., Ann N Y Acad Sci 2004', conclusion: 'L-карнитин — транспорт жирных кислот в митохондрии. Кардиопротектор, улучшает функцию эндотелия.', year: 2004 }],
  glucosamine:      [{ study: 'Towheed TE. et al., Cochrane Database 2005', conclusion: 'Глюкозамин — хондропротектор, замедляет деградацию хряща при остеоартрозе. Умеренный болеутоляющий эффект.', year: 2005 }],
  collagen:         [{ study: 'Shaw G. et al., Curr Med Res Opin 2017', conclusion: 'Коллагеновые пептиды — улучшают биомеханику хряща и сухожилий, снижают боль в суставах при нагрузке.', year: 2017 }],
  bpc157:          [{ study: 'Sikiric P. et al., Curr Pharm Des 2018', conclusion: 'BPC-157 — пентадекапептид с доказанной регенерацией сухожилий, связок, кишечника и нервной ткани. Стимулирует ангиогенез.', year: 2018 }],
  tb500:           [{ study: 'Smart N. et al., J Biol Chem 2007', conclusion: 'TB-500 (тимозин β4) — стимулирует миграцию клеток, ангиогенез и регенерацию тканей. Кардиопротектор и нейропротектор.', year: 2007 }],
  vitamin_c:       [{ study: 'Carr AC. et al., Nutrients 2017', conclusion: 'Витамин C — антиоксидант, кофактор коллаген-синтеза. Поддержка иммунитета при высоком окислительном стрессе.', year: 2017 }],
  vitamin_b12:      [{ study: 'Stabler SP., N Engl J Med 2013', conclusion: 'B12 — критичен для миелинизации нервов и эритропоэза. Дефицит → мегалобластная анемия, нейропатия.', year: 2013 }],
  folate:           [{ study: 'Crider KS. et al., Adv Nutr 2012', conclusion: 'Фолат — метиляция ДНК, гомоцистеин-снижение. Кардиопротекция через снижение гомоцистеина.', year: 2012 }],
  meloxicam:        [{ study: 'Noble S. et al., Drugs 1996', conclusion: 'Мелоксикам — селективный COX-2 ингибитор, НПВП. Риск почечной и гепатотоксичности при длительном применении.', year: 1996 }],
  diclofenac:       [{ study: 'Gan TJ., Am J Med 2009', conclusion: 'Диклофенак — НПВП с высоким риском кардиоваскулярных событий (FDA warning) и гепатотоксичности. Ограниченный курс ≤2 недель.', year: 2009 }],
  selenium:         [{ study: 'Rayman MP., Lancet 2012', conclusion: 'Селен — ключевой элемент глутатионпероксидазы. Щитовидная защита. Избыток → токсичность (хрупкость ногтей, алопеция).', year: 2012 }],
  taurine:          [{ study: 'Schaffer S. et al., Amino Acids 2014', conclusion: 'Таурин — нейромодулятор, кардиопротектор (антиаритмический), осмолит. Гепатопротектор при токсическом повреждении.', year: 2014 }],
  saw_palmetto:     [{ study: 'Barry M. et al., NEJM 2006', conclusion: 'Сереноа — ингибитор 5α-редуктазы, снижает ДГТ. Умеренный эффект при ДГПЖ. Не предотвращает ААС-индуцированную атрофию яичек.', year: 2006 }],
  egcg:             [{ study: 'Khan N. et al., Mol Nutr Food Res 2008', conclusion: 'EGCG — катехин зелёного чая, антиоксидант и ингибитор COMT. Гепатотоксичность при высоких дозах (>800 мг).', year: 2008 }],
  ginseng:          [{ study: 'Kim JH. et al., J Ginseng Res 2013', conclusion: 'Женьшень — адаптоген, повышает NO и IGF-1. Умеренный эргогенный эффект. Потенцирует антикоагулянты.', year: 2013 }],
  vitamin_k2:       [{ study: 'Vermeer C. et al., J Nutr 2004', conclusion: 'Витамин K2 (МК-7) — активатор остеокальцина и MGP. Кальцификация сосудов при дефиците. Кардиопротекция.', year: 2004 }],
  iron:             [{ study: 'Camaschella C., Lancet 2015', conclusion: 'Железо — эссенциален для эритропоэза. Перегрузка ( гемохроматоз) → гепатотоксичность, кардиомиопатия. Контролировать ферритин.', year: 2015 }],
  hyaluronic:       [{ study: 'Gao F. et al., Nutrients 2019', conclusion: 'Гиалуроновая кислота — компонент синовиальной жидкости и хряща. Пероральная форма улучшает увлажнение суставов.', year: 2019 }],
  msm:              [{ study: 'Usha PR. et al., Osteoarthr Cartil 2004', conclusion: 'MSM — источник серы, противовоспалительный. Умеренный эффект при остеоартрозе в комбинации с глюкозамином.', year: 2004 }],
  boswellia:        [{ study: 'Ammon HP., Phytomedicine 2006', conclusion: 'Босвеллия — ингибитор 5-липоксигеназы, противовоспалительный. Эффективен при артрите и КЗК. Мягкая нейропротекция.', year: 2006 }],
  bromelain:        [{ study: 'Maurer HR., Cell Mol Life Sci 2001', conclusion: 'Бромелайн — протеолитический фермент, фибринолитик. Противовоспалительный и противоотёчный эффект при травмах.', year: 2001 }],
  probiotics:       [{ study: 'Hill C. et al., Nat Rev Gastroenterol Hepatol 2014', conclusion: 'Пробиотики — модуляция микробиома, влияние на печёночный метаболизм (ось печень-кишечник). Иммуномодуляция.', year: 2014 }],
  copper:           [{ study: 'Uriu-Adams JY. et al., J Nutr 2005', conclusion: 'Медь — кофактор церулоплазмина и SOD. Критична для нейромиелинизации и эритропоэза. Избыток → гепатотоксичность.', year: 2005 }],
  astragalus:       [{ study: 'Auyeung KK. et al., Am J Chin Med 2016', conclusion: 'Астрагал — иммуномодулятор и нефропротектор. Активный компонент — астрагалозид IV. Снижает протеинурию.', year: 2016 }],
};

const COVERAGE_ORGAN_MAP: Record<string, string[]> = {
  cardio: ['heart', 'vascular'],
  hepatic: ['liver'],
  renal: ['kidneys'],
  neuro: ['brain', 'nervous_system'],
  endocrine: ['thyroid', 'adrenals', 'gonads'],
  immune: ['bone_marrow', 'lymphatic'],
  repro: ['testes', 'prostate'],
  musculoskeletal: ['joints', 'ligaments', 'tendons', 'cartilage', 'bone']
};

function sigmoidEmax(emax: number, dose: number, ec50: number): number {
  if (ec50 <= 0) return emax;
  return emax * dose / (ec50 + dose);
}

function getCoverageSystem(key: string): string | undefined {
  const prefix = key.split('_')[0];
  if (prefix === 'repro') return 'reproductive';
  if (prefix === 'immune') return 'hematologic';
  if (prefix === 'gastro') return 'hepatic';
  if (RISK_SYSTEMS.includes(prefix as any)) return prefix;
  return undefined;
}

function getSubstanceById(id: string): SubstanceEntry | undefined {
  return MASTER_DB.substances.find(s => s.id === id || s.name.toLowerCase().includes(id.toLowerCase()));
}

function getMechanismById(id: string): MechanismEntry | undefined {
  return MASTER_DB.mechanisms.find(m => m.id === id);
}

function getOrganById(id: string): OrganEntry | undefined {
  return MASTER_DB.organs.find(o => o.id === id);
}

function getSystemById(id: string): SystemEntry | undefined {
  return MASTER_DB.systems.find(s => s.id === id);
}

function getRiskById(id: string): RiskEntry | undefined {
  return MASTER_DB.risks.find(r => r.id === id);
}

function getRecommendationById(id: string): RecommendationEntry | undefined {
  return MASTER_DB.recommendations.find(r => r.recId === id);
}

function calculateBaseRisk(input: SupportInput): Record<string, number> {
  const systemRisks: Record<string, number> = {};

  for (const system of RISK_SYSTEMS) {
    const weight = SYSTEM_RISK_WEIGHTS[system] ?? 1.0;
    systemRisks[system] = BASE_RISK * 100 * weight;
  }

  if (input.genetics) {
    for (const [gene, variant] of Object.entries(input.genetics)) {
      const multipliers = GENETIC_MULTIPLIERS[gene];
      if (multipliers) {
        const multiplier = multipliers[variant] ?? 1.0;
        const affectedSystems = GENETIC_SYSTEM_MAP[gene];
        if (affectedSystems) {
          for (const system of affectedSystems) {
            if (systemRisks[system] !== undefined) {
              systemRisks[system] *= multiplier;
            }
          }
        } else {
          for (const system of RISK_SYSTEMS) {
            systemRisks[system] *= multiplier;
          }
        }
      }
    }
  }

  if (input.nutritionFactor !== undefined) {
    for (const system of RISK_SYSTEMS) {
      const reduction = NUTRITION_SYSTEM_REDUCTION[system] ?? 0.3;
      systemRisks[system] *= (1 - input.nutritionFactor * reduction);
    }
  }

  if (input.trainingFactor !== undefined) {
    for (const system of RISK_SYSTEMS) {
      const reduction = TRAINING_SYSTEM_REDUCTION[system] ?? 0.2;
      systemRisks[system] *= (1 - input.trainingFactor * reduction);
    }
  }

  for (const system of RISK_SYSTEMS) {
    systemRisks[system] = Math.min(100, Math.max(0, systemRisks[system]));
  }

  return systemRisks;
}

function calculateSubstanceRisk(substances: SubstanceEntry[], drugDoses?: Record<string, number>): Record<string, number> {
  const systemRisks: Record<string, number> = {};
  for (const system of RISK_SYSTEMS) {
    systemRisks[system] = 0;
  }

  for (const substance of substances) {
    const drugKey = Object.keys(DRUG_THRESHOLDS).find(k =>
      substance.id === k || substance.id.replace(/[_\-]/g, '_') === k || substance.name.toLowerCase().replace(/\s+/g, '_').includes(k)
    );

    if (drugKey) {
      const threshold = DRUG_THRESHOLDS[drugKey];
      const dose = drugDoses?.[drugKey] ?? drugDoses?.[substance.id] ?? threshold.dosePerWeek;
      const doseRatio = dose / threshold.dosePerWeek;
      const profile = AAS_SYSTEM_PROFILE[drugKey] ?? { cardio: 0.143, hepatic: 0.143, renal: 0.143, neuro: 0.143, endocrine: 0.143, hematologic: 0.143, reproductive: 0.143 };
      const quadraticDose = doseRatio * doseRatio;
      const androFactor = threshold.androgenicity;

      for (const system of RISK_SYSTEMS) {
        const systemWeight = profile[system] ?? 1 / RISK_SYSTEMS.length;
        systemRisks[system] += systemWeight * quadraticDose * androFactor * 30;
      }
    } else {
      if (substance.risks) {
        for (const riskName of substance.risks) {
          const riskEntry = getRiskById(riskName);
          if (riskEntry) {
            let riskValue = 0;
            switch (riskEntry.level) {
              case 'LOW': riskValue = 5; break;
              case 'MEDIUM': riskValue = 15; break;
              case 'HIGH': riskValue = 35; break;
              case 'CRITICAL': riskValue = 60; break;
            }
            const riskTitle = riskEntry.title.toLowerCase();
            for (const system of RISK_SYSTEMS) {
              if (riskTitle.includes(system) || riskTitle.includes(system.substring(0, 4))) {
                systemRisks[system] += riskValue;
                break;
              }
            }
            if (!RISK_SYSTEMS.some(s => riskTitle.includes(s) || riskTitle.includes(s.substring(0, 4)))) {
              systemRisks['hepatic'] += riskValue * 0.4;
              systemRisks['cardio'] += riskValue * 0.3;
              systemRisks['endocrine'] += riskValue * 0.2;
              systemRisks['renal'] += riskValue * 0.1;
            }
          }
        }
      }

      if (substance.effects) {
        for (const effect of substance.effects) {
          const effectEntry = MASTER_DB.effects.find(e => e.id === effect.effect);
          if (effectEntry && effectEntry.risks) {
            for (const rw of effectEntry.risks) {
              const riskObj = getRiskById(rw.name);
              if (riskObj) {
                let riskValue = 0;
                switch (riskObj.level) {
                  case 'LOW': riskValue = 2; break;
                  case 'MEDIUM': riskValue = 8; break;
                  case 'HIGH': riskValue = 18; break;
                  case 'CRITICAL': riskValue = 35; break;
                }
                const riskTitle = riskObj.title.toLowerCase();
                let assigned = false;
                for (const system of RISK_SYSTEMS) {
                  if (riskTitle.includes(system) || riskTitle.includes(system.substring(0, 4))) {
                    systemRisks[system] += riskValue * rw.weight;
                    assigned = true;
                    break;
                  }
                }
                if (!assigned) {
                  if (effectEntry.organs && effectEntry.organs.length > 0) {
                    for (const ow of effectEntry.organs) {
                      const organName = ow.name.toLowerCase();
                      for (const system of RISK_SYSTEMS) {
                        if (organName.includes(system)) {
                          systemRisks[system] += riskValue * rw.weight / effectEntry.organs.length;
                          break;
                        }
                      }
                    }
                  } else {
                    systemRisks['hepatic'] += riskValue * rw.weight * 0.3;
                    systemRisks['cardio'] += riskValue * rw.weight * 0.2;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  for (const system of RISK_SYSTEMS) {
    systemRisks[system] = Math.min(100, Math.max(0, systemRisks[system]));
  }

  return systemRisks;
}

function calculateSupportCoverage(
  substances: SubstanceEntry[],
  substanceIds: string[],
  supportDoses?: Record<string, number>
): { totalSupport: number; systemSupport: Record<string, number>; organSupport: Record<string, number> } {
  const systemSupport: Record<string, number> = {};
  const organSupport: Record<string, number> = {};
  let totalSupport = 0;

  for (const system of RISK_SYSTEMS) {
    systemSupport[system] = 0;
  }

  for (const [supKey, coverage] of Object.entries(SUPPORT_BASE_COVERAGE)) {
    const isInStack = substanceIds.some(sid =>
      sid === supKey || sid.toLowerCase().includes(supKey) || supKey.includes(sid.toLowerCase())
    );
    if (!isInStack) continue;

    const dose = supportDoses?.[supKey] ?? supportDoses?.[substanceIds.find(sid => sid === supKey || sid.toLowerCase().includes(supKey)) ?? ''] ?? SUPPORT_DEFAULT_DOSE[supKey] ?? 100;
    const ec50 = SUPPORT_EC50[supKey] ?? 100;

    for (const [coverageKey, emax] of Object.entries(coverage)) {
      const adjustedCoverage = sigmoidEmax(emax, dose, ec50);
      const system = getCoverageSystem(coverageKey);
      if (system) {
        systemSupport[system] = (systemSupport[system] ?? 0) + adjustedCoverage;
      }

      const organPrefix = coverageKey.split('_')[0];
      const organs = COVERAGE_ORGAN_MAP[organPrefix] ?? [];
      for (const organ of organs) {
        organSupport[organ] = (organSupport[organ] ?? 0) + adjustedCoverage;
      }
    }
  }

  if (substances.length > 0) {
    for (const substance of substances) {
      const supKey = Object.keys(SUPPORT_BASE_COVERAGE).find(k =>
        substance.id === k || substance.id.toLowerCase().includes(k) || k.includes(substance.id.toLowerCase())
      );
      if (!supKey) continue;
      const coverage = SUPPORT_BASE_COVERAGE[supKey];
      const dose = supportDoses?.[supKey] ?? supportDoses?.[substance.id] ?? SUPPORT_DEFAULT_DOSE[supKey] ?? 100;
      const ec50 = SUPPORT_EC50[supKey] ?? 100;
      let substanceTotal = 0;

      for (const [coverageKey, emax] of Object.entries(coverage)) {
        substanceTotal += sigmoidEmax(emax, dose, ec50);
      }
      totalSupport += substanceTotal;
    }
  }

  totalSupport += (substanceIds.filter(sid =>
    Object.keys(SUPPORT_BASE_COVERAGE).some(k => sid === k || sid.toLowerCase().includes(k) || k.includes(sid.toLowerCase()))
  ).length) * 5;

  for (const system of RISK_SYSTEMS) {
    systemSupport[system] = Math.min(100, systemSupport[system]);
  }
  for (const organ of Object.keys(organSupport)) {
    organSupport[organ] = Math.min(100, organSupport[organ]);
  }

  return { totalSupport: Math.min(35, totalSupport), systemSupport, organSupport };
}

function calculateSupportScore(
  input: SupportInput,
  substances: SubstanceEntry[],
  substanceIds: string[]
): { score: number; systemSupport: Record<string, number>; organSupport: Record<string, number> } {
  let lifestyleSupport = 0;

  if (input.nutritionFactor !== undefined) {
    lifestyleSupport += input.nutritionFactor * 20;
  }
  if (input.trainingFactor !== undefined) {
    lifestyleSupport += input.trainingFactor * 15;
  }

  const coverage = calculateSupportCoverage(substances, substanceIds, input.supportDoses);

  const totalScore = Math.min(100, Math.max(0, lifestyleSupport + coverage.totalSupport));

  return { score: totalScore, systemSupport: coverage.systemSupport, organSupport: coverage.organSupport };
}

function generateRecommendations(riskResult: RiskResult, input: SupportInput): RecommendationEntry[] {
  const recommendations: RecommendationEntry[] = [];

  for (const [system, riskData] of Object.entries(riskResult.systemBreakdown)) {
    if (riskData.net > 50) {
      const systemRecs = MASTER_DB.recommendations.filter(r => 
        r.riskId && MASTER_DB.risks.some(risk => 
          risk.id === r.riskId && 
          risk.title.toLowerCase().includes(system.toLowerCase())
        )
      );

      for (const rec of systemRecs.slice(0, 2)) {
        if (!recommendations.some(r => r.recId === rec.recId)) {
          recommendations.push(rec);
        }
      }
    }
  }

  if (recommendations.length === 0) {
    const generalRecs = MASTER_DB.recommendations.filter(r => 
      r.type === 'general' || r.type === 'lifestyle'
    );

    for (const rec of generalRecs.slice(0, 3)) {
      recommendations.push(rec);
    }
  }

  return recommendations;
}

export function calculateSupport(input: SupportInput): SupportOutput {
  const substances: SubstanceEntry[] = [];
  for (const id of input.substances) {
    const substance = getSubstanceById(id);
    if (substance) {
      substances.push(substance);
    }
  }

  const baseRiskBySystem = calculateBaseRisk(input);
  const substanceRiskBySystem = calculateSubstanceRisk(substances, input.drugDoses);

  const systemBreakdownRaw: Record<string, number> = {};
  const systemBreakdownNet: Record<string, number> = {};
  let totalRaw = 0;

  for (const system of RISK_SYSTEMS) {
    systemBreakdownRaw[system] = Math.min(100, (baseRiskBySystem[system] ?? 0) + (substanceRiskBySystem[system] ?? 0));
    totalRaw += systemBreakdownRaw[system];
  }

  const riskBeforeSupport = Math.min(100, totalRaw / RISK_SYSTEMS.length);

  const { score: supportScore, systemSupport, organSupport } = calculateSupportScore(input, substances, input.substances);

  for (const system of RISK_SYSTEMS) {
    const raw = systemBreakdownRaw[system];
    const protectionFraction = Math.min(1, (systemSupport[system] ?? 0) / 100);
    const lifestyleReduction = ((input.nutritionFactor ?? 0) * (NUTRITION_SYSTEM_REDUCTION[system] ?? 0.3) + (input.trainingFactor ?? 0) * (TRAINING_SYSTEM_REDUCTION[system] ?? 0.2));
    const netRisk = raw * (1 - protectionFraction) * (1 - Math.min(0.5, lifestyleReduction));
    systemBreakdownNet[system] = Math.min(100, Math.max(0, netRisk));
  }

  let totalNet = 0;
  for (const system of RISK_SYSTEMS) {
    totalNet += systemBreakdownNet[system];
  }
  const riskAfterSupport = Math.min(100, totalNet / RISK_SYSTEMS.length);

  const riskResult: RiskResult = {
    overallRaw: riskBeforeSupport,
    overallNet: riskAfterSupport,
    systemBreakdown: {},
    mechanismBreakdown: {}
  };

  for (const system of RISK_SYSTEMS) {
    riskResult.systemBreakdown[system] = {
      raw: systemBreakdownRaw[system],
      net: systemBreakdownNet[system]
    };
  }

  const recommendations = generateRecommendations(riskResult, input);

  const effectiveMechanisms: MechanismEntry[] = [];
  const affectedOrgans: OrganEntry[] = [];
  const affectedSystems: SystemEntry[] = [];

  for (const substance of substances) {
    if (substance.mechanisms) {
      for (const mechId of substance.mechanisms) {
        const mech = getMechanismById(mechId);
        if (mech && !effectiveMechanisms.some(m => m.id === mech.id)) {
          effectiveMechanisms.push(mech);
        }
      }
    }
  }

  for (const [organKey, coverage] of Object.entries(organSupport)) {
    const organEntry = getOrganById(organKey);
    if (organEntry && !affectedOrgans.some(o => o.id === organEntry.id)) {
      affectedOrgans.push(organEntry);
    }
  }

  const highRiskSystems = RISK_SYSTEMS.filter(s => (systemBreakdownNet[s] ?? 0) > 30);
  for (const sysId of highRiskSystems) {
    const sysEntry = getSystemById(sysId);
    if (sysEntry && !affectedSystems.some(s => s.id === sysEntry.id)) {
      affectedSystems.push(sysEntry);
    }
  }

  const metadata = {
    processedSubstances: substances,
    effectiveMechanisms,
    affectedOrgans,
    affectedSystems
  };

  return {
    riskAssessment: riskResult,
    recommendations,
    supportScore,
    riskBeforeSupport,
    riskAfterSupport,
    systemSupport,
    organSupport,
    metadata
  };
}

export function generateSupportStack(goal: string, blacklist: string[] = []): SubstanceEntry[] {
  const goalEntry = MASTER_DB.goals.find(g => g.id === goal);
  if (!goalEntry) {
    return [];
  }

  const supportingSubstances: SubstanceEntry[] = [];

  for (const substance of MASTER_DB.substances) {
    if (blacklist.includes(substance.id)) {
      continue;
    }

    let supportsGoal = false;
    for (const [effectId, priority] of Object.entries(goalEntry.effectPriority)) {
      if (priority > 0) {
        const hasEffect = substance.effects?.some(e => e.effect === effectId) || false;
        if (hasEffect) {
          supportsGoal = true;
          break;
        }
      }
    }

    if (supportsGoal) {
      supportingSubstances.push(substance);
    }
  }

  return supportingSubstances.slice(0, 5);
}