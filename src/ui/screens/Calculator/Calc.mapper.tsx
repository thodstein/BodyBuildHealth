import React, { useMemo, useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { buildTzInput } from '../../../engines/support-plan/engine-helpers';
import { calculateTzSpecRisk } from '../../../engines/risk-engine-tz-spec';
import { getAdministrationRules } from '../../../data/administration-rules-db';
import { PREANALYTIC_EFFECTS_DB, ASSAY_INTERFERENCE_DB } from '../../../data/assay-interference-db';
import { findSeparationRules } from '../../../data/separation-timing-db';
import { MINERAL_SEPARATION_HOURS } from '../../../engines/support-plan/types';
import { detectActivePedClasses } from '../../../data/ped-class-matrix';
import type { LabSlice } from '../../../engines/support-plan';
import type { CalculatorState } from '../../../engines/support-plan';
import { resolvePlan, isDoctorControlled, type SupportRisk } from '../../../engines/tz-mapper-engine';
import type { MapperCtx, SupportRecommendation } from '../../../engines/tz-mapper-engine';
import type { SupportLevel } from '../../../engines/tz-bridge-mechanism';
import type { PhaseContext, PhaseKey } from '../../../engines/tz-bridge-phase';
import type { BoosterTriggerCtx } from '../../../engines/tz-bridge-boosters';
import { PHASE_PROTOCOL } from '../../../engines/tz-bridge-phase';
import { STACK_BOOSTER_TRIGGERS, buildGapFillSuggestions, megaEnhance, type MegaEnhanceSuggestion, getNeuroBoosterSubstanceIds, getJointsBoosterSubstanceIds, getHematoBoosterSubstanceIds } from '../../../engines/tz-bridge-boosters';
import { computeResidualRisk, type PedRiskAssessment } from '../../../engines/ped-risk-matrix';
import { buildMapperCtx, labSliceToValues } from '../../../engines/support-plan/mapper-ctx';
import { SUPPORT_CATALOG_DATA } from '../../../data/support-catalog-data';
import { registerCatalogExtras } from '../../../data/support-catalog-extras';
registerCatalogExtras(SUPPORT_CATALOG_DATA);
import { SafetyGuardrails, SafetyAlerts, SafetyConflicts, SafetyProcedures, SafetyAssayWarnings, SafetyGaps, SafetyLabFindings, SafetyDepletion, SafetyCumulativeLoad, SafetyPillBurden, SafetyPedEscalation, SafetyPctTiming, SafetyInjections } from './CalcSafetyLayer';
import { CalcSystemPanel, SYSTEM_PANELS, SYSTEM_TO_PANEL, type SubRiskGroup } from './CalcSystemPanel';
import { DEFAULT_DOSAGES } from '../../../data/support-meta';
import { getSubstanceForm, type SubstanceForm } from '../../../data/substance-forms';
import { checkInteractions, type DrugInteraction } from '../../../data/drug-interactions';
import { SYNERGY_NETWORK } from '../../../data/support-synergy-network';
import { getTitrationProtocol, type TitrationProtocol } from '../../../data/titration-protocols';
import { CONTRAINDICATIONS, getContraindications, checkContraindications, type ContraindicationRule } from '../../../data/substance-contraindications';
import { GLASS, BADGE } from './Calc.types';
import { CalcSubstanceDetail, buildStackSynergyDescription } from './CalcSubstanceDetail';
import { CalcPEDCard } from './CalcPEDCard';
import { CalcProfileCard } from './CalcProfileCard';
import { CalcLabsCard } from './CalcLabsCard';
import { ALL_STACKS } from '../../../data/support-stacks';
import { MECH_TRANSLATIONS_RU, MECH_LABELS } from '../SupportScreen_parts/SupportScreenData';
import { CalcSubstanceManager } from './CalcSubstanceManager';
import { checkStackToxicity, type ToxWarning } from '../../../engines/biostack-safety.engine';
import { calculateReboundTrajectory, getReboundSummary, type ReboundInput } from '../../../engines/rebound-modeling.engine';
import { printProtocol, buildExportDataFromRec } from '../../../ui/components/ProtocolExport';
import { checkNotifications, type NotificationRule } from '../../../engines/notification-engine';
import { computeOverdueSystems, type SystemOverdue } from '../../../engines/labs-overdue';
import { LabsDueBanner } from './LabsDueBanner';

// ── Конфигурация суставного модуля ──────────────────────────────────────────
interface JointPreset {
  id: string; name: string; desc: string; color: string;
  subs: string[]; icon: string;
}
const JOINT_PRESETS: JointPreset[] = [
  { id:'core', name:'Ядро', desc:'Профилактика (база)', color:'#22c55e', icon:'🟢',
    subs:['collagen_uc2','vitamin_c','vitamin_d3','vitamin_k2','collagen'] },
  { id:'base', name:'База', desc:'Умеренный риск', color:'#f59e0b', icon:'🟡',
    subs:['glucosamine','chondroitin','msm','curcumin','manganese'] },
  { id:'enhanced', name:'Усиление', desc:'Высокий риск', color:'#f97316', icon:'🟠',
    subs:['hyaluronic_acid','curcumin','boswellia','silicon'] },
  { id:'max', name:'Максимум', desc:'Критический риск', color:'#ef4444', icon:'🔴',
    subs:['bpc157','tb500','calcium','boron'] },
];
const JOINT_CATALOG: { id: string; nameRu: string; dose: string; desc: string }[] = [
  { id: 'glucosamine', nameRu: 'Глюкозамин сульфат', dose: '1500 мг', desc: 'Субстрат ГАГ, ↑ синтез протеогликанов хряща' },
  { id: 'chondroitin', nameRu: 'Хондроитин сульфат', dose: '800 мг', desc: '↓ коллагеназу, ↓ IL-1β, ↑ гиалуроновую к-ту' },
  { id: 'collagen', nameRu: 'Коллаген гидролизат', dose: '10 г', desc: 'Субстрат Gly-Pro-Hyp для коллагена I/II типа' },
  { id: 'collagen_uc2', nameRu: 'Коллаген UC-II (неденатурир.)', dose: '40 мг', desc: 'Оральная толерантность, ↓ атаку на коллаген сустава' },
  { id: 'msm', nameRu: 'MSM (Метилсульфонилметан)', dose: '2000 мг', desc: 'Донатор серы, ↓ NF-κB, ↓ боль на 25-40%' },
  { id: 'vitamin_c', nameRu: 'Витамин C', dose: '1000 мг', desc: 'Кофактор пролил/лизил-гидроксилаз → тройная спираль' },
  { id: 'vitamin_d3', nameRu: 'Витамин D3', dose: '5000 МЕ', desc: 'VDR-активация, Ca²⁺ гомеостаз, минерализация' },
  { id: 'vitamin_k2', nameRu: 'Витамин K2', dose: '100 мкг', desc: 'Активация остеокальцина → Ca²⁺ в кости' },
  { id: 'omega3', nameRu: 'Омега-3 (очищенный ЭПК)', dose: '2-3 г', desc: 'Резолвины/протектины, ↓ воспаления в синовии (адъювант, слабее куркумина/босвеллии при ОА)' },
  { id: 'manganese', nameRu: 'Марганец', dose: '5-10 мг', desc: 'Кофактор гликозилтрансфераз → синтез ГАГ' },
  { id: 'hyaluronic_acid', nameRu: 'Гиалуроновая кислота', dose: '200 мг', desc: 'Синовиальная жидкость, вязкоэластичность' },
  { id: 'curcumin', nameRu: 'Куркумин + пиперин', dose: '500 мг', desc: '↓ COX-2, ↓ NF-κB, ↓ IL-1β' },
  { id: 'boswellia', nameRu: 'Босвеллия (AKBA ≥30%)', dose: '300 мг', desc: '↓ 5-LOX, ↓ лейкотриены, ↓ боль при ОА' },
  { id: 'silicon', nameRu: 'Кремний (монометанол-силанол)', dose: '10-20 мг', desc: 'Сшивка коллагена и эластина, стабилизация ГАГ' },
  { id: 'bpc157', nameRu: 'BPC-157 (пентадекапептид)', dose: '250-500 мкг', desc: '↑ VEGF → ангиогенез, заживление связок/сухожилий' },
  { id: 'tb500', nameRu: 'TB-500 (Thymosin β4)', dose: '2.5-5 мг', desc: 'Полимеризация G-актина, ↑ миграцию клеток' },
  { id: 'calcium', nameRu: 'Кальций', dose: '500 мг', desc: 'Минерализация костной ткани' },
  { id: 'boron', nameRu: 'Бор', dose: '3 мг', desc: '↑ t½ вит. D и E₂, ↓ боль в суставах' },
  // ── ЭТАП 3: новые вещества из Суставы.txt ──
  { id: 'ghk_cu', nameRu: 'GHK-Cu (медь-пептид)', dose: '1-2 мг', desc: '↑коллаген/эластин, анти-воспаление (Суставы.txt: 6-нед протокол)' },
  { id: 'havinson_a4', nameRu: 'Хавинсон A4 (хрящ)', dose: '1-2 капс', desc: 'Пептидный биорегулятор, ↑хондроцитов (Суставы.txt)' },
  { id: 'ligamentide', nameRu: 'LigamenTIDE PLUS', dose: '1-2 капс', desc: 'Пептид для связок/сухожилий (Суставы.txt: 6-нед курс)' },
  { id: 'artra', nameRu: 'Артра (глюкозамин+хондроитин)', dose: '500+500 мг 2р/день', desc: 'Комбинированный хондропротектор: глюкозамин 500 + хондроитин 500 (Суставы.txt: 1 таблетка 2 раза/день)' },
  { id: 'neovitin', nameRu: 'Неовитин (аргинин+витамины)', dose: '1-2 капсулы', desc: 'Сосуды и восстановление связок (Суставы.txt)' },
  { id: 'voltaren_gel', nameRu: 'Вольтарен гель (диклофенак местно)', dose: '2-3р/день', desc: '↓COX-2 локально (Суставы.txt)' },
];
const JOINT_RECOMMENDED_HIGH: Set<string> = new Set(['glucosamine','chondroitin','collagen','vitamin_c','msm']);
const JOINT_RECOMMENDED_MEDIUM: Set<string> = new Set(['omega3','hyaluronic_acid','curcumin','boswellia']);

type GenericEnhancementConfig = {
  label: string; icon: string; color: string; markers: string[]; domains: string[];
  core: string[]; lv2: string[]; lv3: string[]; notes: string;
  presets: { id: string; label: string; level: 1 | 2 | 3; ids: string[] }[];
};
type SpecializedDomain = { id: string; label: string; icon: string; markers: string[]; ids: string[]; trigger?: (labs: Record<string, number>, state: CalculatorState) => boolean };
const SPECIALIZED_DOMAINS: Record<string, SpecializedDomain[]> = {
  cardio: [
    { id:'bp', label:'АД/объём', icon:'🩺', markers:['BP_SYSTOLIC','BP_DIASTOLIC'], ids:['hydration','cardio_aerobic','electrolyte_balance','telmisartan'], trigger:(l)=> (l.BP_SYSTOLIC ?? 0)>130 || (l.BP_DIASTOLIC ?? 0)>85 },
    { id:'lipids', label:'Липиды', icon:'🫀', markers:['LDL','HDL','TRIGLYCERIDES','APOB'], ids:['omega3','bergamot','coq10'], trigger:(l)=> (l.LDL ?? 0)>3 || (l.TRIGLYCERIDES ?? 0)>1.7 || (l.HDL ?? 9)<1 },
    { id:'rhythm', label:'Ритм/ЧСС', icon:'💓', markers:['HR','K','MG'], ids:['magnesium','taurine','nebivolol'], trigger:(l)=> (l.HR ?? 0)>80 || (l.K ?? 9)<3.5 },
    { id:'endothelium', label:'Эндотелий/тромбоз', icon:'🩸', markers:['HCT','D_DIMER','FIBRINOGEN'], ids:['hydration','cardio_aerobic','nattokinase','serrapeptase','bromelain'], trigger:(l)=> (l.HCT ?? 0)>48 || (l.D_DIMER ?? 0)>.5 || (l.FIBRINOGEN ?? 0)>4 },
  ],
  hepatic: [
    { id:'cytolysis', label:'Цитолиз', icon:'🧫', markers:['ALT','AST'], ids:['nac','milk_thistle','alpha_lipoic'], trigger:(l)=>(l.ALT??0)>40||(l.AST??0)>40 },
    { id:'cholestasis', label:'Холестаз', icon:'🟡', markers:['GGT','ALP','BILIRUBIN'], ids:['tudca','udca','milk_thistle'], trigger:(l)=>(l.GGT??0)>55||(l.ALP??0)>120||(l.BILIRUBIN??0)>21 },
    { id:'oxidative', label:'Оксидативный стресс', icon:'🛡️', markers:['CRP','FERRITIN'], ids:['nac','glycine','selenium','alpha_lipoic'], trigger:(l)=>(l.CRP??0)>5||(l.FERRITIN??0)>300 },
  ],
  renal: [
    { id:'filtration', label:'Фильтрация', icon:'💧', markers:['CREATININE','eGFR','CYSTATIN_C'], ids:['hydration','nac','astragalus','cordyceps'], trigger:(l)=>(l.CREATININE??0)>105||(l.eGFR??200)<90||(l.CYSTATIN_C??0)>1 },
    { id:'proteinuria', label:'Протеинурия', icon:'🧪', markers:['UACR','PROTEIN_URINE'], ids:['astragalus','cordyceps','taurine','telmisartan'], trigger:(l)=>(l.UACR??0)>30||(l.PROTEIN_URINE??0)>.15 },
    { id:'electrolytes', label:'Электролиты', icon:'⚡', markers:['K','NA','MG'], ids:['electrolyte_balance','magnesium','taurine'], trigger:(l)=>(l.K??4)<3.5||(l.K??4)>5||(l.MG??1)<.75 },
  ],
  endocrine: [
    { id:'e2', label:'Ароматизация/E2', icon:'⚖️', markers:['E2','SHBG'], ids:['anastrozole','zinc','vitamin_d3'], trigger:(l)=>(l.E2??0)>40 },
    { id:'prl', label:'Пролактин', icon:'🧪', markers:['PRL'], ids:['agmatine','vitex','p5p','cabergoline'], trigger:(l)=>(l.PRL??0)>25 },
    { id:'hpta', label:'HPTA', icon:'🧬', markers:['LH','FSH','TT','FT'], ids:['hcg','enclomiphene','tamoxifen','clomiphene'], trigger:(l)=>(l.LH??9)<1.7||(l.FSH??9)<1.5 },
    { id:'stress', label:'Кортизол', icon:'🧠', markers:['CORTISOL'], ids:['magnesium_l_threonate','phosphatidylserine','ashwagandha','theanine'], trigger:(l)=>(l.CORTISOL??0)>535 },
  ],
  reproductive: [
    { id:'gonadotropins', label:'LH/FSH', icon:'🧬', markers:['LH','FSH'], ids:['hcg','enclomiphene','clomiphene'], trigger:(l)=>(l.LH??9)<1.7||(l.FSH??9)<1.5 },
    { id:'androgens', label:'TT/FT/SHBG', icon:'⚙️', markers:['TT','FT','SHBG'], ids:['zinc','boron','coq10'], trigger:(l)=>(l.FT??9)<8||(l.SHBG??0)>60 },
    { id:'fertility', label:'Сперматогенез', icon:'🔬', markers:['LH','FSH'], ids:['hcg','nac','zinc','folate','vitamin_b12'], trigger:(_l,s)=>String(s.pharma.phase)==='fertility' },
  ],
  musculoskeletal: [
    { id:'cartilage', label:'Хрящ', icon:'🦴', markers:['CRP'], ids:['collagen','glucosamine','chondroitin','msm'], trigger:(_l,s)=>s.oda.jointPain!=='none' },
    { id:'tendon', label:'Сухожилия/связки', icon:'🔗', markers:['CK','CRP'], ids:['collagen','vitamin_c','msm','bpc157','tb500'], trigger:(_l,s)=>s.oda.ligamentIssues||s.oda.injuries.length>0 },
    { id:'inflammation', label:'Воспаление', icon:'🔥', markers:['CRP','CK'], ids:['omega3','curcumin','boswellia'], trigger:(l)=>(l.CRP??0)>3 },
  ],
  metabolic: [
    { id:'glucose', label:'Глюкоза/IR', icon:'🍬', markers:['GLU','INS','HBA1C','HOMAIR'], ids:['berberine','alpha_lipoic','magnesium','cardio_aerobic'], trigger:(l)=>(l.GLU??0)>5.6||(l.HOMAIR??0)>2.5 },
    { id:'hypo', label:'Гипогликемия', icon:'⚠️', markers:['GLU','K','MG'], ids:['taurine','electrolyte_balance','magnesium'], trigger:(l)=>(l.GLU??9)<3.9 },
    { id:'lipidmet', label:'ТГ/липиды', icon:'🫀', markers:['TRIGLYCERIDES','HDL','LDL'], ids:['omega3','berberine','cardio_aerobic'], trigger:(l)=>(l.TRIGLYCERIDES??0)>1.7||(l.HDL??9)<1 },
  ],
};
const makePresets = (core: string[], lv2: string[], lv3: string[]) => [
  { id:'base', label:'База', level:1 as const, ids:core },
  { id:'enhanced', label:'Усиление', level:2 as const, ids:[...core, ...lv2] },
  { id:'max', label:'Максимум', level:3 as const, ids:[...core, ...lv2, ...lv3] },
];
const rawGenericConfigs: Record<string, Omit<GenericEnhancementConfig, 'presets'>> = {
  cardio: { label:'ССС', icon:'❤️', color:'#ef4444', markers:['BP_SYSTOLIC','BP_DIASTOLIC','HR','LDL','HDL','TRIGLYCERIDES','APOB','NT_PROBNP'], domains:['АД/объём','Липиды','Эндотелий/тромбоз','Ремоделирование','Ритм'], core:['hydration','cardio_aerobic','electrolyte_balance','omega3','coq10','magnesium','taurine'], lv2:['telmisartan','tadalafil','nebivolol','citrulline','pycnogenol','bergamot'], lv3:['atorvastatin','rosuvastatin'], notes:'Кардио-кандидаты выбираются по АД, ЧСС, липидам и фармакологии курса.' },
  hepatic: { label:'Печень', icon:'🫁', color:'#f59e0b', markers:['ALT','AST','GGT','ALP','BILIRUBIN'], domains:['Цитолиз','Холестаз','Желчеотток','Оксидативный стресс','Фиброзный риск'], core:['nac','milk_thistle','glycine','selenium'], lv2:['tudca','alpha_lipoic','phosphatidylcholine'], lv3:['udca','heptral'], notes:'Для оральных 17α-алкилов приоритет печени повышается независимо от наличия текущих анализов.' },
  renal: { label:'Почки', icon:'🫘', color:'#60a5fa', markers:['CREATININE','eGFR','CYSTATIN_C','UACR','UREA','K','NA','MG'], domains:['Гемодинамика','Гиперфильтрация','Протеинурия','Тубулярный стресс','Электролиты'], core:['hydration','electrolyte_balance','nac','astragalus','cordyceps','taurine'], lv2:['omega3','coq10','magnesium','telmisartan'], lv3:['potassium','celery_extract'], notes:'Калий и усиление ARB требуют K⁺/eGFR; при отсутствии анализа показывается warning, но базовая поддержка не исчезает.' },
  endocrine: { label:'Эндокринная', icon:'🧪', color:'#ec4899', markers:['E2','PRL','TT','FT','LH','FSH','SHBG','CORTISOL','TSH'], domains:['Ароматизация/E2','PRL','HPTA','Кортизол','Щитовидная ось'], core:['hcg','magnesium','vitamin_d3','zinc','agmatine'], lv2:['anastrozole','ashwagandha','phosphatidylserine','magnesium_l_threonate'], lv3:['cabergoline','tamoxifen','enclomiphene'], notes:'Анастрозол — контроль E2; каберголин — только подтверждённый PRL и назначение врача.' },
  reproductive: { label:'Репродуктивная', icon:'🧬', color:'#f472b6', markers:['TT','FT','LH','FSH','E2','PRL','SHBG'], domains:['LH/FSH','Интратестикулярный T','Сперматогенез','E2','ПКТ'], core:['hcg','zinc','magnesium','vitamin_d3','omega3'], lv2:['coq10','nac','ashwagandha','boron'], lv3:['tamoxifen','clomiphene','enclomiphene'], notes:'Состав зависит от course/bridge/pct/fertility; SERM и hCG не смешиваются без фазовой логики.' },
  musculoskeletal: { label:'ОДА', icon:'🦴', color:'#4ade80', markers:['CRP','CK','CALCIUM','VITD','MG'], domains:['Хрящ','Сухожилия/связки','Кость','Воспаление','Травма'], core:['collagen','vitamin_c','magnesium','omega3'], lv2:['glucosamine','chondroitin','msm','curcumin','boswellia','vitamin_d3'], lv3:['bpc157','tb500','ghk_cu'], notes:'LV3 и пептиды — только отдельный врачебный/исследовательский статус; не обычная база.' },
  metabolic: { label:'Метаболизм', icon:'🍬', color:'#fb923c', markers:['GLU','INS','HBA1C','HOMAIR','TRIGLYCERIDES','K','MG'], domains:['Глюкоза','Инсулинорезистентность','Гипогликемия','Липиды','Электролиты'], core:['cardio_aerobic','omega3','magnesium','taurine'], lv2:['berberine','alpha_lipoic','chromium'], lv3:['metformin'], notes:'При insulin/GH берберин/ALA/хром требуют отдельного контроля гипогликемии.' },
};
const GENERIC_ENHANCEMENT_CONFIG = Object.fromEntries(Object.entries(rawGenericConfigs).map(([id, cfg]) => [id, { ...cfg, presets: makePresets(cfg.core, cfg.lv2, cfg.lv3) }])) as Record<string, GenericEnhancementConfig>;

// ── Конфигурация нейропротекторного модуля ──────────────────────────────────
interface NeuroPreset {
  id: string; name: string; desc: string; color: string;
  subs: string[]; icon: string;
}
const NEURO_PRESETS: NeuroPreset[] = [
  { id:'sleep', name:'Сон', desc:'Восстановление сна', color:'#22c55e', icon:'🟢',
    subs:['magnesium_l_threonate','melatonin','theanine','glycine','gaba'] },
  { id:'stress', name:'Стресс', desc:'Антикортизол + адаптация', color:'#f59e0b', icon:'🟡',
    subs:['phosphatidylserine','ashwagandha','rhodiola','bacopa'] },
  { id:'cognitive', name:'Когнитив', desc:'Память, фокус, холин', color:'#f97316', icon:'🟠',
    subs:['citicoline','alpha_gpc','acetyl_l_carnitine','uridine_monophosphate'] },
  { id:'neurogenesis', name:'Нейрогенез', desc:'Рост новых нейронов', color:'#ef4444', icon:'🔴',
    subs:['lions_mane','theanine','curcumin','vitamin_d3','omega3'] },
];
const NEURO_CATALOG: { id: string; nameRu: string; dose: string; desc: string }[] = [
  { id: 'magnesium_l_threonate', nameRu: 'Магний L-треонат (через ГЭБ)', dose: '1440 мг', desc: '↑ Mg в мозге, блок NMDA, ↑ синаптическую пластичность (LTP)' },
  { id: 'melatonin', nameRu: 'Мелатонин', dose: '3 мг', desc: 'Циркадный ритм, ↓ латентность сна, антиоксидант в ЦНС' },
  { id: 'theanine', nameRu: 'L-Теанин', dose: '200 мг', desc: '↑ α-волны ЭЭГ, ↑ ГАМК через глутаматный шунт' },
  { id: 'glycine', nameRu: 'Глицин', dose: '3 г', desc: 'Тормозной нейромедиатор, ко-агонист NMDA, ↓ t° тела' },
  { id: 'gaba', nameRu: 'ГАМК', dose: '500 мг', desc: '↓ возбудимость ЦНС, ↑ качество и глубину сна' },
  { id: 'phosphatidylserine', nameRu: 'Фосфатидилсерин', dose: '300 мг', desc: 'Связывает кортизол, ↓ GR-активацию в гиппокампе' },
  { id: 'ashwagandha', nameRu: 'Ашваганда KSM-66', dose: '600 мг', desc: '↓ кортизол на 20-30%, ↑ ГАМК-А, ↑ T4→T3' },
  { id: 'rhodiola', nameRu: 'Родиола розовая', dose: '400 мг', desc: '↓ МАО-А, ↑ тирозин-гидроксилазу, ↑ дофамин' },
  { id: 'bacopa', nameRu: 'Бакопа монье', dose: '300 мг', desc: '↑ ацетилхолин, ↑ дендритное ветвление, антиоксидант' },
  { id: 'citicoline', nameRu: 'Цитиколин (CDP-холин)', dose: '500 мг', desc: 'Донатор холина для ACh, ↑ фосфатидилхолин мембран' },
  { id: 'alpha_gpc', nameRu: 'Альфа-GPC', dose: '300 мг', desc: '↑ ACh в мозге, ↑ ГР через соматотропы' },
  { id: 'acetyl_l_carnitine', nameRu: 'Ацетил-L-Карнитин (ALCAR)', dose: '500 мг', desc: '↑ митохондриальный ацетил-КоА, ↑ BDNF, антидепрессант' },
  { id: 'uridine_monophosphate', nameRu: 'Уридин монофосфат', dose: '300 мг', desc: '↑ фосфатидилхолин, ↑ CDP-холин, ↑ синаптические P2Y2' },
  { id: 'lions_mane', nameRu: 'Ежовик гребенчатый', dose: '1000 мг', desc: '↑ NGF через ERK1/2, ↑ миелинизацию аксонов' },
  { id: 'tryptophan', nameRu: 'L-Триптофан', dose: '500 мг', desc: 'Предшественник серотонина → мелатонин, ↑ настроение' },
  { id: 'x5htp', nameRu: '5-HTP', dose: '100 мг', desc: 'Прямой субстрат серотонина, ↓ тревожность, ↑ сон' },
  { id: 'curcumin', nameRu: 'Куркумин + пиперин', dose: '500 мг', desc: '↓ NF-κB, ↓ нейровоспаление, ↑ BDNF' },
  { id: 'omega3', nameRu: 'Омега-3 (DHA для мозга)', dose: '3 г', desc: 'DHA — структурный липид нейрональных мембран' },
  { id: 'vitamin_d3', nameRu: 'Витамин D3', dose: '5000 МЕ', desc: '↑ BDNF, ↓ нейровоспаление, VDR в гиппокампе' },
  { id: 'vitamin_b6', nameRu: 'B6 (P5P)', dose: '50 мг', desc: 'Кофактор синтеза ГАМК, серотонина, дофамина' },
  { id: 'vitamin_b12', nameRu: 'B12 (метилкобаламин)', dose: '1000 мкг', desc: 'Синтез миелина, кофактор метионин-синтазы' },
  { id: 'alpha_lipoic', nameRu: 'α-Липоевая кислота', dose: '600 мг', desc: 'Кофактор митохондрий, ↓ окислит. стресс, нейропатия' },
  { id: 'folate', nameRu: 'Фолат (5-MTHF)', dose: '400 мкг', desc: 'Метилирование, синтез SAME, обмен гомоцистеина' },
  { id: 'taurine', nameRu: 'Таурин', dose: '2 г', desc: '↑ ГАМК-А, ↓ глутаматную эксайтотоксичность' },
  { id: 'magnesium', nameRu: 'Магний (глицинат/цитрат)', dose: '400 мг', desc: '↓ NMDA-рецептор, ↑ ГАМК, ↓ кортизол, расслабление' },
  // ── ЭТАП 3: новые вещества из статьи «Нейротоксичность ААС» ──
  { id: 'agmatine', nameRu: 'Агматин', dose: '1-2 г', desc: '★ must have: неконкурентный антагонист NMDA, ↓глутамат' },
  { id: 'nac', nameRu: 'NAC (АЦЦ)', dose: '1200-2400 мг', desc: '★ Снижает глутамат через mGluR2/3, антиоксидант' },
  { id: 'apigenin', nameRu: 'Апигенин', dose: '50-100 мг', desc: 'ГАМК-модулятор, ↓тревоги (микродозинг)' },
  { id: 'magnolia', nameRu: 'Магнолия (ханиол/магнолол)', dose: '200-400 мг', desc: 'Анксиолитик, ГАМК-ергический' },
  { id: 'pregnenolone', nameRu: 'Прегненолон', dose: '10-30 мг', desc: 'Тормозный нейростероид, закрывает дырку на ААС' },
  { id: 'inositol', nameRu: 'Инозитол', dose: '500-2000 мг', desc: '↑чувствительность серотониновых рецепторов (ОКР/БДР)' },
  { id: 'astaxanthin', nameRu: 'Астаксантин', dose: '4-12 мг', desc: 'Встраивается в мембрану, блок окисления жиров' },
  // ── LV2-LV3 (статья: тяжёлая артиллерия) ──
  { id: 'grandaxine', nameRu: 'Грандаксин (тофизопам)', dose: '25-100 мг', desc: 'ФДЭ-4 ингибитор, ↑ГАМК без толерантности (LV2)' },
  { id: 'fasoracetam', nameRu: 'Фасорацетам', dose: '100-200 мг', desc: '↑ГАМК-Б рецепторы, контроль импульсов (LV3)' },
  { id: 'bromantane', nameRu: 'Бромантан', dose: '50-100 мг', desc: '↑тирозин-гидроксилаза → дофамин, для 19-нор (LV3)' },
  { id: 'noopept', nameRu: 'Ноопепт (омберацетам)', dose: '10-30 мг', desc: '↑NGF, ↑BDNF, ↑AMPA — нейрогенез (LV3)' },
  { id: 'dihexa', nameRu: 'Дигекса', dose: '5-20 мг', desc: 'c-met/HGF агонист, синаптогенез 10× BDNF (LV3)' },
  { id: 'tropoflavin', nameRu: 'Тропофлавин (7,8-DHF)', dose: '5-30 мг', desc: 'TrkB-агонист, ↑выживаемости нейронов (LV3)' },
  { id: 'phenylpiracetam', nameRu: 'Фенилпирацетам (Фенотропил)', dose: '100-300 мг', desc: '↑дофамин/норадреналин, ↑мотивация (LV3)' },
  { id: 'memantine', nameRu: 'Мемантин', dose: '5-20 мг', desc: 'NMDA-антагонист, ↓эксайтотоксичность (LV4)' },
  { id: 'lamotrigine', nameRu: 'Ламотриджин', dose: '25-200 мг', desc: 'Na-каналы, нормотимик (LV4, медленная титрация)' },
  { id: 'fluvoxamine', nameRu: 'Флувоксамин', dose: '50-300 мг', desc: 'СИОЗС + сигма-1, нейропротекция (LV3)' },
  { id: 'guanfacine', nameRu: 'Гуанфацин', dose: '0.5-4 мг', desc: 'α2 (постсинаптический), ↓импульсивности (LV4)' },
];
const NEURO_RECOMMENDED_HIGH: Set<string> = new Set(['citicoline','lions_mane','magnesium_l_threonate','phosphatidylserine']);
const NEURO_RECOMMENDED_MEDIUM: Set<string> = new Set(['ashwagandha','theanine','gaba','melatonin','acetyl_l_carnitine','bacopa','rhodiola']);

// ── Доменные карты симптомов (нейротоксичность / ОДА) ─────────────────────────
interface DomainSym { code: string; label: string; }
interface DomainCfg {
  id: string; label: string; icon: string; color: string;
  symptoms: DomainSym[]; substances: Set<string>;
}
const NEURO_DOMAINS: DomainCfg[] = [
  { id: 'gaba', label: 'ГАМК / эксайтотоксичность', icon: '⚡', color: '#ef4444',
    symptoms: [
      { code: 'aggression', label: 'Агрессия / раздражительность' },
      { code: 'anxiety', label: 'Тревожность' },
      { code: 'inner_tremor', label: 'Внутренняя дрожь / напряжение' },
      { code: 'insomnia_onset', label: 'Бессонница (трудно заснуть)' },
      { code: 'tremor', label: 'Тремор' },
    ],
    substances: new Set(['magnesium_l_threonate','theanine','taurine','glycine','gaba','magnesium']) },
  { id: 'serotonin', label: 'Серотонин / аффект', icon: '🌧️', color: '#a855f7',
    symptoms: [
      { code: 'low_mood', label: 'Подавленное настроение' },
      { code: 'anhedonia', label: 'Ангедония (утрата удовольствия)' },
      { code: 'mood_labile', label: 'Эмоциональная лабильность' },
    ],
    substances: new Set(['x5htp','tryptophan','vitamin_b6']) },
  { id: 'dopamine', label: 'Дофамин / когниция', icon: '🎯', color: '#f59e0b',
    symptoms: [
      { code: 'brain_fog', label: '«Туман в голове»' },
      { code: 'slow_thinking', label: 'Замедленное мышление' },
      { code: 'focus', label: 'Снижение концентрации' },
      { code: 'motivation', label: 'Снижение мотивации' },
      { code: 'memory', label: 'Проблемы с памятью' },
    ],
    substances: new Set(['citicoline','alpha_gpc','acetyl_l_carnitine','uridine_monophosphate','rhodiola']) },
  { id: 'sleep', label: 'Циркадный сон', icon: '🌙', color: '#3b82f6',
    symptoms: [
      { code: 'sleep_onset2', label: 'Долгое засыпание' },
      { code: 'night_awakenings', label: 'Ночные пробуждения' },
      { code: 'early_wake', label: 'Ранние пробуждения' },
      { code: 'nonrestorative', label: 'Сон не восстанавливает' },
    ],
    substances: new Set(['melatonin','glycine','magnesium_l_threonate','theanine','gaba']) },
  { id: 'hpa', label: 'Вегетатика / HPA-ось', icon: '🔥', color: '#ec4899',
    symptoms: [
      { code: 'stress', label: 'Высокий стресс / кортизол' },
      { code: 'sweating', label: 'Потливость' },
      { code: 'resting_tachy', label: 'Учащённое сердцебиение в покое' },
      { code: 'weather_dependent', label: 'Метеозависимость' },
    ],
    substances: new Set(['phosphatidylserine','ashwagandha','rhodiola']) },
  { id: 'neuropathy', label: 'Периферич. нейропатия', icon: '🦶', color: '#14b8a6',
    symptoms: [
      { code: 'paresthesia', label: 'Парестезии / «мурашки»' },
      { code: 'numbness', label: 'Онемение конечностей' },
      { code: 'cramps', label: 'Мышечные судороги' },
    ],
    substances: new Set(['vitamin_b12','folate','vitamin_b6','alpha_lipoic','magnesium']) },
  { id: 'neuroinflammation', label: 'Нейровоспаление', icon: '🧨', color: '#f97316',
    symptoms: [
      { code: 'headaches', label: 'Головные боли' },
      { code: 'neuro_inflammation', label: 'Системное воспаление (CRP↑)' },
    ],
    substances: new Set(['curcumin','omega3','vitamin_d3']) },
];
const JOINT_DOMAINS: DomainCfg[] = [
  { id: 'cartilage', label: 'Хрящ / остеоартроз', icon: '🦴', color: '#22c55e',
    symptoms: [
      { code: 'load_pain', label: 'Боль при нагрузке' },
      { code: 'crepitus', label: 'Хруст / крепитация' },
      { code: 'stiffness_lt30', label: 'Утренняя скованность <30 мин' },
      { code: 'rom_limit', label: 'Ограничение объёма движений' },
    ],
    substances: new Set(['glucosamine','chondroitin','collagen','collagen_uc2','hyaluronic_acid','silicon']) },
  { id: 'tendon', label: 'Сухожилия / энтезит', icon: '💪', color: '#f59e0b',
    symptoms: [
      { code: 'local_pain', label: 'Локальная боль в месте прикрепления' },
      { code: 'eccentric_pain', label: 'Боль при эксцентрике' },
      { code: 'joint_swelling', label: 'Локальный отёк' },
    ],
    substances: new Set(['collagen','vitamin_c','msm','manganese','bpc','tb500']) },
  { id: 'ligament', label: 'Связки / нестабильность', icon: '🔗', color: '#06b6d4',
    symptoms: [
      { code: 'instability', label: 'Нестабильность / «проворачивание»' },
      { code: 'hypermobility', label: 'Гипермобильность' },
    ],
    substances: new Set(['collagen','vitamin_c','silicon','boron']) },
  { id: 'bone', label: 'Кость / МПК', icon: '🦷', color: '#a855f7',
    symptoms: [
      { code: 'fracture_hx', label: 'Переломы в анамнезе' },
      { code: 'aas_bone', label: 'Длительная АС-терапия' },
    ],
    substances: new Set(['calcium','vitamin_d3','vitamin_k2','boron']) },
  { id: 'synovitis', label: 'Синовит / воспаление', icon: '🔥', color: '#ef4444',
    symptoms: [
      { code: 'joint_swelling2', label: 'Отёк / припухлость сустава' },
      { code: 'heat', label: 'Локальное тепло / покраснение' },
      { code: 'stiffness_gt60', label: 'Утренняя скованность >60 мин' },
      { code: 'crp_up', label: 'CRP ↑' },
    ],
    substances: new Set(['omega3','curcumin','boswellia']) },
  { id: 'posttrauma', label: 'Посттравма / заживление', icon: '🩹', color: '#f97316',
    symptoms: [
      { code: 'injury_hx', label: 'Травма / операция в анамнезе' },
    ],
    substances: new Set(['bpc','tb500','collagen']) },
];

// ── HEMATO CATALOG (🩸 Кровь — фибринолиз/антиагрегант/реология) ─────────────
const HEMATO_CATALOG: { id: string; nameRu: string; dose: string; desc: string }[] = [
  // ── LV1: ↑плазма + электролиты + фибринолитики + телмисартан ──
  { id: 'hydration', nameRu: '💧 Гидратация', dose: '40-45 мл/кг/день', desc: '★ ↑PV на 5-10% → Hct -3-5% (Fellmann 1992). Без электролитов вода уходит в ткани' },
  { id: 'cardio_aerobic', nameRu: '🏃 Кардио (аэроб)', dose: '30-45 мин 5×/нед', desc: '★ PV+5-20% за 4-6 нед (Convertino 1980). «Спортивная псевдоанемия»' },
  { id: 'electrolyte_balance', nameRu: '🧂 Электролиты (Na/K/Mg)', dose: 'Na 3-5г + K 3.5-4.7г + Mg 400мг', desc: '★ Удержание воды в сосудистом русле. Без них гидратация неэффективна' },
  { id: 'nattokinase', nameRu: 'Наттокиназа', dose: '100-200 мг натощак', desc: '★ Фибринолитик: ↓тромбоз-риск эритроцитоза (плазминоген→плазмин, ↓PAI-1)' },
  { id: 'serrapeptase', nameRu: 'Серрапептаза', dose: '20-30 мг ×2-3 натощак', desc: '★ ↓α2-макроглобулин, ↓фибрин, ↓вязкости на фоне эритроцитоза' },
  { id: 'bromelain', nameRu: 'Бромелайн', dose: '500-1000 мг натощак', desc: '★ ↓PAI-1, ↓COX-2/TXA2 (антиагрегант). ↓тромбоз при ↑Hct' },
  { id: 'telmisartan', nameRu: 'Телмисартан', dose: '40-80 мг/день', desc: '★ ARB: ↑PV + ↓EPO (Vlahakos 2003). Двойной эффект' },
  // ── LV2: реология + антиагрегант + антиоксидант RBC ──
  { id: 'omega3', nameRu: 'Омега-3 (EPA+DHA)', dose: '2-4 г с едой', desc: '↓агрегации, ↓вязкости, ↓фибриногена, ↑NO' },
  { id: 'garlic', nameRu: 'Чеснок (аллицин)', dose: '600-1200 мг 2×/д', desc: 'Аллицин — ↓агрегации, ↓фибриногена (Bordia 1998)' },
  { id: 'citrulline', nameRu: 'Л-Цитруллин', dose: '6-8 г/д', desc: 'NO-донор → ↑деформируемость RBC, ↓вязкости' },
  { id: 'nac', nameRu: 'NAC (АЦЦ)', dose: '600-1200 мг 2×/д', desc: '↑GSH в эритроцитах → ↑текучесть мембраны' },
  { id: 'aspirin', nameRu: 'Аспирин кардио', dose: '100 мг вечером', desc: 'COX-1 ингибитор → ↓TXA2. Антиагрегант при эритроцитозе. ≥2 фактора тромбориска + ИПП' },
  // ── LV3: усиленный фибринолиз + рецептурные ──
  { id: 'lumbrokinase', nameRu: 'Лумброкиназа', dose: '40-80 мг натощак', desc: 'Сильнейший прямой активатор плазминогена' },
  { id: 'pentoxifylline', nameRu: 'Пентоксифиллин 💊', dose: '400 мг 2×/д с едой', desc: 'Реологический: ↓вязкости, ↑деформируемость RBC (по назначению)' },
  { id: 'dipyridamole', nameRu: 'Дипиридамол 💊', dose: '75 мг 3×/д', desc: 'Антиагрегант (PDE-ингиб), вазодилататор (по назначению)' },
  { id: 'pycnogenol', nameRu: 'Пикногенол', dose: '100 мг 2×/д', desc: 'Эндотелий (NO), антиагрегант, ↓АД' },
  { id: 'ginkgo', nameRu: 'Гинкго Билоба', dose: '120 мг 2×/д', desc: 'PAF-антагонист (антиагрегант), микроциркуляция мозга' },
  // ── LV4: антикоагулянты (только по назначению при тромбозе) ──
  { id: 'enoxaparin', nameRu: 'Эноксапарин (НМГ) 💊', dose: '40 мг п/к 1×/д', desc: 'Антикоагулянт при D-димер>500. По назначению врача' },
  { id: 'warfarin', nameRu: 'Варфарин 💊', dose: '2.5-5 мг под контролем МНО', desc: 'Антикоагулянт (вит.K-антагонист) при тромбозе. Контроль МНО 2-3' },
  { id: 'sulodexide', nameRu: 'Сулодексид 💊', dose: '250 МЕ 2×/д', desc: 'Гепариноид: ↑фибринолиз + эндотелий (по назначению)' },
  { id: 'vitamin_e', nameRu: 'Витамин E', dose: '200-400 МЕ', desc: 'Антиагрегант (выс.доза, Steiner 1995). Осторожно >400 МЕ' },
];
const HEMATO_PRESETS: { id: string; name: string; desc: string; subs: string[] }[] = [
  { id: 'fibrinolytic_trio', name: 'База: плазма+фибринолиз (LV1)', desc: 'Гидратация+кардио+электролиты+натто+сера+бромелайн+телмисартан. ↓Hct через ↑плазма + ↓тромбоз', subs: ['hydration','cardio_aerobic','electrolyte_balance','nattokinase','serrapeptase','bromelain','telmisartan'] },
  { id: 'rheology', name: 'Реология + антиагрегант (LV2)', desc: 'База + омега + чеснок + цитруллин + NAC + аспирин. При Hct 48-52%', subs: ['hydration','cardio_aerobic','electrolyte_balance','nattokinase','serrapeptase','bromelain','telmisartan','omega3','garlic','citrulline','nac','aspirin'] },
  { id: 'therapy', name: 'Терапия (LV3)', desc: '+лумброкиназа+пентоксифиллин+дипиридамол+пикногенол+гинкго. При Hct 52-54%', subs: ['hydration','cardio_aerobic','electrolyte_balance','nattokinase','serrapeptase','bromelain','telmisartan','omega3','garlic','citrulline','nac','aspirin','lumbrokinase','pentoxifylline','dipyridamole','pycnogenol','ginkgo'] },
  { id: 'urgent', name: 'Ургент (LV4, по назначению)', desc: 'Антикоагулянты при тромбозе. Hct>54% — эритроцитаферез + STOP AAS', subs: ['enoxaparin','warfarin','sulodexide'] },
];
const HEMATO_DOMAINS: DomainCfg[] = [
  { id: 'fibrinolysis', label: 'Фибринолиз', icon: '🩸', color: '#14b8a6',
    symptoms: [
      { code: 'fibrinogen_up', label: 'Фибриноген >4 г/л' },
      { code: 'ddimer_up', label: 'D-димер >0.5 мг/L' },
    ],
    substances: new Set(['nattokinase','serrapeptase','bromelain','lumbrokinase']) },
  { id: 'antiplatelet', label: 'Антиагрегант', icon: '🚫', color: '#f59e0b',
    symptoms: [
      { code: 'plt_up', label: 'Тромбоциты >400×10⁹/L' },
    ],
    substances: new Set(['aspirin','garlic','ginkgo','pycnogenol','dipyridamole','omega3']) },
  { id: 'rheology', label: 'Реология / вязкость', icon: '💧', color: '#06b6d4',
    symptoms: [
      { code: 'hct_up', label: 'Гематокрит >48%' },
      { code: 'hct_high', label: 'Гематокрит >52%' },
      { code: 'hgb_up', label: 'Гемоглобин >175 г/л' },
    ],
    substances: new Set(['pentoxifylline','citrulline','omega3','nac','sulodexide']) },
  { id: 'hyperviscosity', label: 'Симптомы гипервязкости', icon: '⚠️', color: '#ef4444',
    symptoms: [
      { code: 'hyperviscosity_symptom', label: 'Головная боль / плетора / тиннитус' },
    ],
    substances: new Set(['nattokinase','serrapeptase','omega3','garlic']) },
  { id: 'anticoagulation', label: 'Антикоагуляция (под обязательным контролем врача)', icon: '💊', color: '#7c3aed',
    symptoms: [],
    substances: new Set(['enoxaparin','warfarin','sulodexide']) },
];

function buildNeuroSymptomsFromState(state: any): Set<string> {
  const s = new Set<string>();
  const n = state?.neuro || {};
  const p = state?.profile || {};
  const symptoms = (state?.symptoms as string[]) || [];
  const labs = labSliceToValues(state?.labs?.fullPanel);
  if ((n.aggressionScore || 0) >= 4) s.add('aggression');
  if (n.gabaBalance === 'overexcited') { s.add('anxiety'); s.add('inner_tremor'); }
  if (p.sleepHours != null && p.sleepHours < 6) s.add('sleep_onset2');
  if (n.sleepQuality === 'poor') s.add('nonrestorative');
  if ((p.stressLevel || 0) >= 7) s.add('stress');
  if ((n.serotoninScore || 0) <= 2) s.add('low_mood');
  if ((n.dopamineScore || 0) <= 2) { s.add('anhedonia'); s.add('brain_fog'); }
  if (n.memoryIssues) s.add('memory');
  if (n.focusIssues) s.add('focus');
  if (n.slowThinking) s.add('slow_thinking');
  if (n.headaches) s.add('headaches');
  if (n.weatherDependent) s.add('weather_dependent');
  if (symptoms.includes('insomnia')) s.add('insomnia_onset');
  if (symptoms.includes('anxiety')) s.add('anxiety');
  const crp = labs['CRP'] || labs['HSCRP'];
  if (crp != null && crp > 3) s.add('neuro_inflammation');
  return s;
}
function buildJointSymptomsFromState(state: any): Set<string> {
  const s = new Set<string>();
  const oda = state?.oda || {};
  const symptoms = (state?.symptoms as string[]) || [];
  const labs = labSliceToValues(state?.labs?.fullPanel);
  const jp = oda.jointPain;
  if (jp === 'mild') s.add('load_pain');
  if (jp === 'moderate') { s.add('load_pain'); s.add('crepitus'); }
  if (jp === 'severe') { s.add('load_pain'); s.add('crepitus'); s.add('joint_swelling'); }
  if (oda.ligamentIssues) s.add('instability');
  if (oda.backPain) s.add('load_pain');
  if ((oda.injuries || []).length > 0) s.add('injury_hx');
  if (symptoms.includes('joint_pain')) s.add('load_pain');
  const crp = labs['CRP'] || labs['HSCRP'];
  if (crp != null && crp > 3) s.add('crp_up');
  return s;
}
function buildHematoSymptomsFromState(state: any): Set<string> {
  const s = new Set<string>();
  const symptoms = (state?.symptoms as string[]) || [];
  const labs = labSliceToValues(state?.labs?.fullPanel);
  const hct = labs['HEMATOCRIT'] || labs['HCT'];
  const hgb = labs['HEMOGLOBIN'] || labs['HGB'];
  const plt = labs['PLT'];
  const fib = labs['FIBRINOGEN'];
  const dd = labs['D_DIMER'];
  if (hct != null && hct > 48) s.add('hct_up');
  if (hct != null && hct > 52) s.add('hct_high');
  if (hgb != null && hgb > 175) s.add('hgb_up');
  if (plt != null && plt > 400) s.add('plt_up');
  if (fib != null && fib > 4) s.add('fibrinogen_up');
  if (dd != null && dd > 0.5) s.add('ddimer_up');
  // Симптомы гипервязкости
  if (symptoms.some(sym => ['hyperviscosity','headache','plethora','tinnitus'].includes(sym))) s.add('hyperviscosity_symptom');
  return s;
}

// Доменная карта симптомов: чипы по клиническим доменам + профиль риска
function DomainSymptomMap({ domains, checked, onToggle }: { domains: DomainCfg[]; checked: Set<string>; onToggle: (code: string) => void }) {
  const scores = domains.map(d => ({ d, score: Math.min(10, d.symptoms.filter(sym => checked.has(sym.code)).length * 3) }));
  const active = scores.filter(x => x.score >= 6).sort((a, b) => b.score - a.score);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#ffffff', marginBottom: 5 }}>🩺 Карта симптомов (по клиническим доменам)</div>
      {domains.map(d => (
        <div key={d.id} style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ fontSize: 10 }}>{d.icon}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: d.color }}>{d.label}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {d.symptoms.map(sym => {
              const on = checked.has(sym.code);
              return (
                <button key={sym.code} onClick={() => onToggle(sym.code)}
                  style={{ fontSize: 7, padding: '3px 6px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                    background: on ? d.color + '22' : 'rgba(255,255,255,0.03)',
                    border: on ? `1px solid ${d.color}66` : '1px solid rgba(255,255,255,0.06)',
                    color: on ? d.color : 'rgba(255,255,255,0.5)' }}>
                  {on ? '✓ ' : ''}{sym.label}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>Профиль риска по доменам</div>
        {scores.map(({ d, score }) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <span style={{ fontSize: 7, width: 92, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{d.label}</span>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${score * 10}%`, height: '100%', background: score >= 8 ? '#ef4444' : score >= 6 ? '#f97316' : score >= 3 ? '#f59e0b' : '#22c55e' }} />
            </div>
            <span style={{ fontSize: 7, width: 14, textAlign: 'right', color: 'rgba(255,255,255,0.4)' }}>{score}</span>
          </div>
        ))}
      </div>
      {active.length > 0 && (
        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 1.3 }}>
          Приоритет: {active.map(x => x.d.label).join(' · ')}
        </div>
      )}
    </div>
  );
}

// ── Утилиты отображения вещества ─────────────────────────────────────────────
const SUB_NAME_CACHE: Record<string, string> = {};
const FALLBACK_NAMES: Record<string, string> = {
  hydration: 'Гидратация', cardio_aerobic: 'Кардио (аэробная)', electrolyte_balance: 'Электролиты Na/K/Mg',
  daily_steps: 'Бытовая активность 10 000+', no_smoking: 'Отказ от курения', no_alcohol: 'Отказ от алкоголя',
  niacin: 'Ниацин (B3)', phosphatidylserine: 'Фосфатидилсерин', glycine: 'Глицин',
  theanine: 'L-Теанин', quercetin: 'Кверцетин', garlic: 'Чеснок (экстракт)',
  beetroot: 'Beetroot (экстракт)', lecithin: 'Лецитин (ФХ)',
  iron_bisglycinate: 'Iron bisglycinate', tadalafil: 'Тадалафил',
  agmatine: 'Агматин', tmg: 'TMG (Бетаин)', pycnogenol: 'Пикногенол',
  citrulline: 'Цитруллин', bergamot: 'Бергамот', astaxanthin: 'Астаксантин',
  dandelion: 'Dandelion (Одуванчик)', hesperidin: 'Гесперидин+Диосмин',
  serrapeptase: 'Серрапептаза', nattokinase: 'Наттокиназа', bromelain: 'Бромелайн',
  anastrozole: 'Анастрозол', cabergoline: 'Каберголин', hcg: 'ХГЧ',
  telmisartan: 'Тельмисартан', tudca: 'TUDCA', nac: 'NAC',
  milk_thistle: 'Силимарин', omega3: 'Омега-3', coq10: 'CoQ10',
  taurine: 'Таурин', curcumin: 'Куркумин', piperine: 'Пиперин',
  berberine: 'Берберин', astragalus: 'Астрагал', cordyceps: 'Кордицепс',
  vitamin_d3: 'Витамин D3', vitamin_k2: 'Витамин K2', magnesium: 'Магний',
  vitamin_b6: 'B6 (P5P)', vitamin_b12: 'B12 (метил)', folate: 'Фолат (5-MTHF)',
  vitamin_c: 'Витамин C', vitamin_e: 'Витамин E', b_complex: 'B-Complex',
  nebivolol: 'Небиволол', chromium: 'Хром (пиколинат)', tamoxifen: 'Тамоксифен',
  spironolactone: 'Спиронолактон', hydrochlorothiazide: 'Гидрохлоротиазид', indapamide: 'Индапамид', melatonin: 'Мелатонин', calcium: 'Кальций',
  metformin: 'Метформин', potassium: 'Калий', leucine: 'Лейцин',
  saw_palmetto: 'Saw Palmetto (Пальма сереноа)',
  alpha_lipoic: 'α-Липоевая', l_carnitine: 'L-Карнитин',
  d_mannose: 'Д-манноза',
  glucosamine: 'Глюкозамин сульфат', chondroitin: 'Хондроитин сульфат',
  collagen: 'Коллаген гидролизат', collagen_uc2: 'Коллаген UC-II',
  msm: 'MSM', hyaluronic_acid: 'Гиалуроновая кислота',
  manganese: 'Марганец', silicon: 'Кремний', boron: 'Бор',
  bpc: 'BPC-157', bpc157: 'BPC-157', tb500: 'TB-500', boswellia: 'Босвеллия',
  // нейропротекция
  citicoline: 'Цитиколин', alpha_gpc: 'Альфа-GPC', uridine_monophosphate: 'Уридин UMP',
  magnesium_l_threonate: 'Магний L-треонат', acetyl_l_carnitine: 'Ацетил-L-Карнитин',
  gaba: 'ГАМК', x5htp: '5-HTP', tryptophan: 'L-Триптофан',
  ashwagandha: 'Ашваганда', rhodiola: 'Родиола', bacopa: 'Бакопа',
  lions_mane: 'Ежовик',
};
const NON_DRUG_IDS = new Set(['hydration', 'cardio_aerobic', 'electrolyte_balance', 'daily_steps', 'no_smoking', 'no_alcohol']);
function planItemKind(id: string): 'База' | 'Минерал' | 'БАД' | 'Препарат' {
  if (['hydration', 'cardio_aerobic', 'daily_steps', 'no_smoking', 'no_alcohol'].includes(id)) return 'База';
  if (id === 'electrolyte_balance') return 'Минерал';
  if (['telmisartan','tadalafil','nebivolol','anastrozole','hcg','aspirin','cabergoline','metformin'].includes(id)) return 'Препарат';
  return 'БАД';
}
function subNameRu(id: string): string {
  if (SUB_NAME_CACHE[id]) return SUB_NAME_CACHE[id];
  const e = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  const name = e?.nameRu || e?.name || FALLBACK_NAMES[id] || FALLBACK_NAMES[id?.toLowerCase()] || id;
  SUB_NAME_CACHE[id] = name;
  return name;
}
function subDosage(id: string): { mg: number; timing: string } | null {
  const e = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  if (e?.dosage) return e.dosage;
  return DEFAULT_DOSAGES[id] || DEFAULT_DOSAGES[id.toLowerCase()] || null;
}
function subTier(id: string): string {
  const e = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  return e?.tier || 'standard';
}

function mechToOrganLabel(mechId: string): string {
  const organId = mechId.startsWith('cv') ? 'cardio'
    : mechId.startsWith('liv') ? 'hepatic'
    : mechId.startsWith('ren') ? 'renal'
    : mechId.startsWith('cns') ? 'cns'
    : mechId.startsWith('rep') ? 'reproductive'
    : 'hematologic';
  return organId;
}

// ── Анализ контекста для доп. модулей (суставы/нейро/усиление) ──────────────────
interface StackModuleAnalysis {
  subId: string;
  subName: string;
  dose: string;
  mechanism: string;
  inPlan: boolean;
  contextReason: string;
  recommended: boolean;
}

function analyzeStackModule(
  stackId: string,
  state: CalculatorState,
  rec: SupportRecommendation | null,
): { analysis: StackModuleAnalysis[]; contextSummary: string } {
  const stack = ALL_STACKS.find(s => s.id === stackId);
  if (!stack) return { analysis: [], contextSummary: '' };

  const planIds = new Set((rec?.subs || []).map(s => canonIdLocal(s.substanceId)));
  const symptoms = state.symptoms || [];
  const labs = labSliceToValues(state.labs.fullPanel);
  const jointPain = state.oda.jointPain;
  const hasJointSymptom = symptoms.includes('joint_pain');
  const crp = labs['CRP'] || labs['HSCRP'];
  const hasNeuroSymptom = symptoms.includes('insomnia') || symptoms.includes('anxiety');
  const sleepHours = state.profile.sleepHours || 7;
  const stressLevel = state.profile.stressLevel || 5;
  const aggressionScore = state.neuro.aggressionScore || 0;
  const aasCount = state.pharma.aas.length;
  const pedCount = (state.pharma.ghIU ? 1 : 0) + (state.pharma.insulinIU ? 1 : 0) + aasCount;
  const hasOral17 = (state.pharma.aas || []).some((a: any) => a.form === 'oral');
  const altVal = labs['ALT'] || labs['AST'];
  const hctVal = labs['HEMATOCRIT'] || labs['HCT'];

  let contextSummary = '';
  if (stackId === 'articular_stack') {
    const triggers: string[] = [];
    if (hasJointSymptom) triggers.push('симптом: боль в суставах');
    if (jointPain === 'severe') triggers.push('сильная боль в суставах');
    if (jointPain === 'moderate') triggers.push('умеренная боль');
    if (crp && crp > 3) triggers.push(`CRP ↑ (${crp})`);
    contextSummary = triggers.length > 0
      ? 'Показания: ' + triggers.join(', ')
      : 'Профилактика суставов — нет активных показаний, но рекомендуется при интенсивных тренировках';
  } else if (stackId === 'neuroprotection_stack') {
    const triggers: string[] = [];
    if (symptoms.includes('insomnia')) triggers.push('бессонница');
    if (symptoms.includes('anxiety')) triggers.push('тревога');
    if (sleepHours < 7) triggers.push(`сон ${sleepHours}ч`);
    if (stressLevel > 7) triggers.push(`стресс ${stressLevel}/10`);
    if (aggressionScore > 6) triggers.push('раздражительность');
    contextSummary = triggers.length > 0
      ? 'Показания: ' + triggers.join(', ')
      : 'Профилактика ЦНС — нет активных показаний';
  } else if (stackId === 'mega_total_support_35') {
    const triggers: string[] = [];
    if (aasCount > 0) triggers.push(`${aasCount} ААС`);
    if (hasOral17) triggers.push('оральный 17α');
    if (state.pharma.ghIU) triggers.push('GH');
    if (state.pharma.insulinIU) triggers.push('инсулин');
    if (pedCount > 2) triggers.push('мульти-курс');
    const alt = altVal;
    if (alt && alt > 40) triggers.push(`АЛТ/АСТ ↑ (${alt})`);
    const hct = hctVal;
    if (hct && hct > 50) triggers.push(`HCT ↑ (${hct})`);
    contextSummary = triggers.length > 0
      ? 'Активные риски: ' + triggers.join(', ') + ' → максимальная защита показана'
      : 'Максимальная защита — для high-risk курсов (множество PED, оральные, лаб-отклонения)';
  }

  const analysis: StackModuleAnalysis[] = stack.substances.map(sub => {
    const inPlan = planIds.has(canonIdLocal(sub.id));
    let contextReason = '';
    let recommended = false;

    if (stackId === 'articular_stack') {
      if (sub.id === 'glucosamine') { contextReason = 'Субстрат ГАГ → синтез хряща'; recommended = hasJointSymptom || jointPain !== 'none'; }
      else if (sub.id === 'chondroitin') { contextReason = 'Защита хряща от деградации'; recommended = hasJointSymptom || jointPain !== 'none'; }
      else if (sub.id === 'collagen') { contextReason = 'Структурный белок хряща и связок'; recommended = true; }
      else if (sub.id === 'msm') { contextReason = 'Сера для коллагена, ↓боль'; recommended = crp != null && crp > 3; }
      else if (sub.id === 'vitamin_c') { contextReason = 'Кофактор синтеза коллагена'; recommended = true; }
      else contextReason = sub.mechanism;
    } else if (stackId === 'neuroprotection_stack') {
      if (sub.id === 'citicoline') { contextReason = 'Ацетилхолин + мембраны нейронов'; recommended = hasNeuroSymptom || aggressionScore > 6; }
      else if (sub.id === 'lions_mane') { contextReason = 'NGF — рост нейронов'; recommended = hasNeuroSymptom; }
      else if (sub.id === 'magnesium_l_threonate') { contextReason = 'Mg через ГЭБ — ↓NMDA, сон'; recommended = symptoms.includes('insomnia') || sleepHours < 7; }
      else if (sub.id === 'phosphatidylserine') { contextReason = '↓Кортизол — антистресс'; recommended = stressLevel > 7 || symptoms.includes('anxiety'); }
      else contextReason = sub.mechanism;
    } else if (stackId === 'mega_total_support_35') {
      contextReason = sub.mechanism.slice(0, 60);
      recommended = pedCount > 1 || hasOral17 || (altVal != null && altVal > 40) || (hctVal != null && hctVal > 50);
    } else {
      contextReason = sub.mechanism;
      recommended = true;
    }

    return {
      subId: sub.id,
      subName: subNameRu(sub.id),
      dose: sub.dose,
      mechanism: sub.mechanism,
      inPlan,
      contextReason,
      recommended,
    };
  });

  return { analysis, contextSummary };
}

export interface CalcMapperProps {
  state: CalculatorState;
  onStateChange?: (next: CalculatorState) => void;
  onApply?: (rec: SupportRecommendation) => void;
  onOpenManualPicker?: () => void;
  onOpenLabs?: () => void;
  planResult?: import('../../../engines/support-plan').PlanResult;
}

export const CalcMapperCard: React.FC<CalcMapperProps> = ({ state, onStateChange, onApply, onOpenManualPicker, onOpenLabs, planResult }) => {
  const [level, setLevel] = useState<SupportLevel>('medium');
  const [manualSubs, setManualSubs] = useState<string[]>([]);
  const [selectedStacks, setSelectedStacks] = useState<string[]>([]);
  const [showIntellPopup, setShowIntellPopup] = useState(false);
  const [showManualPopup, setShowManualPopup] = useState(false);
  const [manualTab, setManualTab] = useState<'stacks' | 'catalog' | 'saved' | 'favorites'>('stacks');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [savedSearch, setSavedSearch] = useState('');
  const [manualSubInput] = useState('');
  const [manualStackSearch, setManualStackSearch] = useState('');
  const [expandedManualStack, setExpandedManualStack] = useState<string | null>(null);
  const catalogSubsCount = useMemo(() => Object.keys(SUPPORT_CATALOG_DATA).length, []);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [showPrescription, setShowPrescription] = useState(true);
  const [showSynergy, setShowSynergy] = useState(true);
  const [showLifestyle, setShowLifestyle] = useState(true);
  const [showPreanalytics, setShowPreanalytics] = useState(true);
  const [showCourseWarnings, setShowCourseWarnings] = useState(true);
  const [showDosageControl, setShowDosageControl] = useState(true);
  const [showPedMatrix, setShowPedMatrix] = useState(true);
  const [removedSubs, setRemovedSubs] = useState<string[]>([]);
  const [addedSubs, setAddedSubs] = useState<string[]>([]);
  const [pendingBlockAdd, setPendingBlockAdd] = useState<{ ids: string[]; conflicts: { a: string; b: string; reason: string }[] } | null>(null);
  // Централизованное добавление с проверкой блок-конфликтов: при конфликте
  // запрашиваем согласие пользователя (движок исключит конфликтующий препарат).
  const requestAddSubs = (ids: string[]) => {
    const fresh = ids.filter(id => !(finalRec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(id)));
    if (fresh.length === 0) return;
    const allIds = [...(finalRec?.subs || []).map(s => s.substanceId), ...fresh];
    const blocks = checkInteractions(allIds).filter(i => i.severity === 'block' && fresh.some(f => f.toLowerCase() === i.a.toLowerCase() || f.toLowerCase() === i.b.toLowerCase()));
    if (blocks.length > 0) {
      setPendingBlockAdd({ ids: fresh, conflicts: blocks });
    } else {
      setAddedSubs(prev => [...new Set([...prev, ...fresh])]);
    }
  };
  const confirmBlockAdd = () => {
    if (!pendingBlockAdd) return;
    setAddedSubs(prev => [...new Set([...prev, ...pendingBlockAdd.ids])]);
    setPendingBlockAdd(null);
  };
  const [substanceManagerKey, setSubstanceManagerKey] = useState(0);
  const [stackModulePopup, setStackModulePopup] = useState<string | null>(null);
  const [articularPreset, setArticularPreset] = useState<string | null>(null);
  const [articularSelected, setArticularSelected] = useState<Set<string>>(new Set());
  const [articularConfirm, setArticularConfirm] = useState<boolean>(false);
  const [neuroPreset, setNeuroPreset] = useState<string | null>(null);
  const [neuroSelected, setNeuroSelected] = useState<Set<string>>(new Set());
  const [neuroConfirm, setNeuroConfirm] = useState<boolean>(false);
  const [neuroSymptoms, setNeuroSymptoms] = useState<Set<string>>(new Set());
  const [jointSymptoms, setJointSymptoms] = useState<Set<string>>(new Set());
  // ── Hemato (🩸 Кровь) ──
  const [hematoPreset, setHematoPreset] = useState<string | null>(null);
  const [hematoSelected, setHematoSelected] = useState<Set<string>>(new Set());
  const [hematoConfirm, setHematoConfirm] = useState<boolean>(false);
  const [hematoSymptoms, setHematoSymptoms] = useState<Set<string>>(new Set());
  const [applyFlash, setApplyFlash] = useState(false);
  const [showContraindications, setShowContraindications] = useState(false);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [showRebound, setShowRebound] = useState(false);
  const [showSymptoms, setShowSymptoms] = useState(true);
  const [showNutrition, setShowNutrition] = useState(false);
  const [showInteractions, setShowInteractions] = useState(false);
  const [showEnhancementPopup, setShowEnhancementPopup] = useState(false);
  const [enhancementSearch, setEnhancementSearch] = useState('');
  const [enhancementSystem, setEnhancementSystem] = useState<string>('all');
  const [genericEnhancementPopup, setGenericEnhancementPopup] = useState<string | null>(null);
  const [genericEnhancementSelected, setGenericEnhancementSelected] = useState<Set<string>>(new Set());
  const [showMegaPopup, setShowMegaPopup] = useState(false);
  const [megaSelected, setMegaSelected] = useState<Set<string>>(new Set());

  const ctx = useMemo(() => {
    const base = buildMapperCtx(state, level, {
      addSubs: Array.from(new Set([...manualSubs, ...addedSubs])),
      removeSubs: removedSubs,
    }, selectedStacks);
    if (symptoms.length > 0) base.symptoms = symptoms;
    base.libidoLow = symptoms.includes('low_libido');
    return base;
  }, [state, level, manualSubs, addedSubs, removedSubs, selectedStacks, symptoms]);

  const rec = useMemo(() => {
    try { return resolvePlan(ctx); }
    catch { return null; }
  }, [ctx]);

  const phaseInfo = rec ? PHASE_PROTOCOL[rec.phase] : null;

  // Движок уже применил добавления/удаления через manualChoices и пересчитал
  // риск/покрытие/таймлайн/синергии/мониторинг. Здесь — только лёгкая страховка
  // по конфликтам и противопоказаниям с учётом UI-условий (hasCVD и т.п.).
  const finalRec = useMemo(() => {
    if (!rec) return null;
    if (removedSubs.length === 0 && addedSubs.length === 0) return rec;
    const interactionIds = rec.subs.map(s => s.substanceId);
    const mappedConditions: string[] = [...(state.healthConditions || [])];
    if (state.contraindications.hasCVD || state.cardio.previousCVD) mappedConditions.push('ihd');
    if (state.contraindications.hasThrombophilia) mappedConditions.push('thrombophilia');
    if (state.contraindications.hasGI) mappedConditions.push('peptic_ulcer');
    if (state.contraindications.hasKidneyDisease) mappedConditions.push('ckd_stage3', 'ckd_stage4_5');
    return {
      ...rec,
      conflicts: checkInteractions(interactionIds).map(i => ({
        a: i.a, b: i.b, reason: `${i.reason} — ${i.action}`, level: i.severity === 'block' ? 'block' as const : 'warn' as const,
      })),
      contraindications: checkContraindications(interactionIds, mappedConditions),
      summary: `${rec.summary} После ручной корректировки: ${rec.subs.length} элементов.`,
    };
  }, [rec, removedSubs, addedSubs, state]);

  // ── RESIDUAL RISK — пересчёт риска с учётом выбранных веществ ──
  // Gross risk (из PED доз) → Net risk (после митигации). Показывает gross→net в баннере.
  const finalRecWithResidual = useMemo<SupportRecommendation | null>(() => {
    if (!finalRec || !finalRec.pedRisk) return finalRec;
    const planSubs = finalRec.subs.map(s => s.substanceId);
    const netRisk = computeResidualRisk(finalRec.pedRisk, planSubs);
    return { ...finalRec, pedRisk: netRisk };
  }, [finalRec]);

  // Автоподбор стеков под недокрытые механизмы ТЗ (режим «Усиление»)
  const gapFill = useMemo(() => buildGapFillSuggestions((finalRec?.gaps as any) || []), [finalRec]);

  const megaSuggestions = useMemo(() => {
    if (!finalRec) return [];
    const currentSubs = finalRec.subs.map(s => s.substanceId);
    const gapBased = megaEnhance(finalRec.gaps as any, currentSubs);
    if (gapBased.length > 0) return gapBased;
    // ── Fallback: если gaps пуст (нет лаб-данных), предлагаем по PED-risk ──
    const pedRisk = finalRec.pedRisk;
    if (pedRisk && (pedRisk.neuroBoosterTier > 0 || pedRisk.jointsBoosterTier > 0 || pedRisk.hematoBoosterTier > 0)) {
      const neuroIds = getNeuroBoosterSubstanceIds(pedRisk.neuroBoosterTier);
      const jointIds = getJointsBoosterSubstanceIds(pedRisk.jointsBoosterTier);
      const hematoIds = getHematoBoosterSubstanceIds(pedRisk.hematoBoosterTier);
      const allBoosterIds = [...neuroIds, ...jointIds, ...hematoIds];
      const existingSet = new Set(currentSubs.map(s => s.toLowerCase().replace(/[^a-z0-9]/g, '')));
      return allBoosterIds
        .filter(id => !existingSet.has(id.toLowerCase().replace(/[^a-z0-9]/g, '')))
        .map(id => ({
          substanceId: id,
          reason: pedRisk.triggeredBy.filter(r => r.includes('нейро') || r.includes('Нейро') || r.includes('сустав') || r.includes('Сустав') || r.includes('гемато') || r.includes('Гемато') || r.includes('эритропоэз') || r.includes('19-нор') || r.includes('стан') || r.includes('трен') || r.includes('Эскалация')).slice(0,1).join('; ') || 'PED-risk',
          mechsCovered: [] as any,
          synergyWith: [] as string[],
          breadth: 1,
          totalK: 0,
        }));
    }
    // ── Fallback 2: если есть PED, но без PED-risk tier — предлагаем ядро поддержки ──
    if (state.pharma.aas.length > 0) {
      const coreIds = ['nac','omega3','vitamin_d3','vitamin_k2','magnesium','vitamin_c','tudca','milk_thistle'];
      const existingSet = new Set(currentSubs.map(s => s.toLowerCase().replace(/[^a-z0-9]/g, '')));
      return coreIds
        .filter(id => !existingSet.has(id.toLowerCase().replace(/[^a-z0-9]/g, '')))
        .map(id => ({
          substanceId: id,
          reason: 'Ядро поддержки при курсе ААС',
          mechsCovered: [] as any,
          synergyWith: [] as string[],
          breadth: 1,
          totalK: 0,
        }));
    }
    return [];
  }, [finalRec]);

  // Токсикологический контроль дозировок (UL + титрация выше оптимума)
  const toxWarnings = useMemo<ToxWarning[]>(() => {
    if (!finalRec || finalRec.subs.length === 0) return [];
    try {
      return checkStackToxicity(finalRec.subs.map(s => s.substanceId));
    } catch {
      return [];
    }
  }, [finalRec]);

  const synergyDesc = finalRec ? buildStackSynergyDescription(finalRec) : [];

  // ══ ЕДИНЫЙ РАСЧЁТ РИСКА ПО МЕХАНИЗМ-МОДЕЛИ (ТЗ) ══
  // Пересчитывается по ФИНАЛЬНОМУ составу (с учётом попап-правок), чтобы
  // системные риски, попапы и safety-слой показывали ОДИН и тот же результат.
  const tzFinalRisk = useMemo(() => {
    if (!finalRec || finalRec.subs.length === 0) return null;
    try {
      const inp = buildTzInput(state, finalRec.subs.map(s => s.substanceId));
      if (!inp) return null;
      const result = calculateTzSpecRisk(inp);
      // Единый вход для вкладки «Риски» (механизм-модель): snapshot полного TzSpecInput,
      // чтобы цифры калькулятора и вкладки «Риски» были ИДЕНТИЧНЫ до механизма.
      try {
        localStorage.setItem('he_calc_tz_input', JSON.stringify({ input: inp, ts: Date.now() }));
        localStorage.setItem('he_support_risk', JSON.stringify({
          subs: finalRec.subs.map(s => s.substanceId),
          riskBeforeSupport: result.overallRaw,
          riskAfterSupport: result.overallAfter,
          timestamp: Date.now(),
        }));
      } catch {}
      return result;
    } catch {
      return null;
    }
  }, [finalRec, state]);
  const systemRiskOf = (sysId: string) => tzFinalRisk?.organs.find(o => o.id === sysId) || null;

  const pairSynergies = useMemo(() => {
    if (!finalRec || finalRec.subs.length <= 1) return [] as { a: string; b: string; effect: string; mechanism: string; severity: string; score: number }[];
    const idSet = new Set(finalRec.subs.map((s: any) => (s.substanceId || '').toLowerCase()));
    const synergies: { a: string; b: string; effect: string; mechanism: string; severity: string; score: number }[] = [];
    const seenSyn = new Set<string>();
    for (const entry of SYNERGY_NETWORK) {
      if (entry.type !== 'synergy') continue;
      const members = [entry.a, entry.b, entry.c, entry.d, entry.e, entry.f, entry.g]
        .filter(Boolean)
        .concat(entry.substances || [])
        .map(s => s!.toLowerCase());
      const inStack = members.filter(m => idSet.has(m));
      if (inStack.length >= 2) {
        for (let i = 0; i < inStack.length; i++) {
          for (let j = i + 1; j < inStack.length; j++) {
            const k = [inStack[i], inStack[j]].sort().join('|');
            if (seenSyn.has(k)) continue;
            seenSyn.add(k);
            synergies.push({
              a: inStack[i], b: inStack[j],
              effect: entry.effect, mechanism: entry.mechanism,
              severity: entry.severity, score: entry.score,
            });
          }
        }
      }
    }
    return synergies.sort((a, b) => b.score - a.score);
  }, [finalRec]);

  // РУЧНОЙ РЕЖИМ: план строится НАПРЯМУЮ из выбранных стеков (независимо от движка).
  // Это гарантирует, что выбранные стеки всегда видны, даже если resolvePlan упадёт.
  const manualResultSubs = useMemo(() => {
    if (level !== 'manual') return [];
    const map = new Map<string, { id: string; dose?: string; timing?: string; stack: string }>();
    for (const stId of selectedStacks) {
      const st = (ALL_STACKS as any[]).find(s => s.id === stId);
      if (!st) continue;
      for (const sd of (st.substances || [])) {
        if (!map.has(sd.id)) map.set(sd.id, { id: sd.id, dose: sd.dose, timing: sd.timing, stack: st.name || stId });
      }
    }
    return Array.from(map.values());
  }, [level, selectedStacks]);

  // Реактивная проверка уведомлений (логирует в he_notification_log; UI не здесь).
  // (Используется для реактивных алертов E2/HCT/ЛПНП/D-димер и т.п.,
  // отображается в других местах; баннер лаборатории — отдельный useMemo ниже)
  useEffect(() => {
    if (!finalRec) return;
    try {
      const notifLabs = labSliceToValues(state.labs?.fullPanel ?? null);
      const notifState: any = {
        labs: {
          lastLabDate: state.labs?.fullPanel?.date,
          alt: notifLabs['ALT'] ?? notifLabs['АЛТ'],
          ast: notifLabs['AST'] ?? notifLabs['АСТ'],
          e2: notifLabs['ESTRADIOL'] ?? notifLabs['ЭСТРАДИОЛ'],
          prl: notifLabs['PROLACTIN'] ?? notifLabs['ПРОЛАКТИН'],
          hct: notifLabs['HEMATOCRIT'] ?? notifLabs['ГЕМАТОКРИТ'],
          ldl: notifLabs['LDL'] ?? notifLabs['ЛПНП'],
          egfr: notifLabs['EGFR'] ?? notifLabs['СКФ'],
          dDimer: notifLabs['D_DIMER'] ?? notifLabs['D_ДИМЕР'],
        },
        fullPanel: state.labs?.fullPanel ?? null,
        pharma: {
          phase: rec?.phase || 'course',
          hasAI: rec?.subs?.some((s: any) => s.substanceId === 'anastrozole' || s.substanceId === 'anastro'),
          hasOral17: rec?.pedFlags?.hasOral17 || false,
        },
        goals: { cycleWeeks: state.goals?.cycleWeeks || 12 },
      };
      checkNotifications(notifState);
    } catch {}
  }, [finalRec, state.labs, rec?.phase]);

  // Sticky-баннер «Сдайте анализы»: группировка по системам, не перекрывает нижние кнопки.
  const overdueSystems: SystemOverdue[] = useMemo(() => {
    try {
      return computeOverdueSystems({
        fullPanel: state.labs?.fullPanel ?? null,
        phase: rec?.phase || 'course',
        lastLabDate: state.labs?.fullPanel?.date,
      });
    } catch { return []; }
  }, [state.labs?.fullPanel, rec?.phase]);

  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem('he_calc_labs_banner_dismissed') === '1'; }
    catch { return false; }
  });

  return (
    <React.Fragment>
      {/* Sticky-баннер «Сдайте анализы» — вверху карточки, не перекрывает нижние кнопки */}
      <LabsDueBanner
        systems={overdueSystems}
        onOpenLabs={onOpenLabs}
        onDismiss={() => {
          setBannerDismissed(true);
          try { localStorage.setItem('he_calc_labs_banner_dismissed', '1'); } catch {}
        }}
        dismissed={bannerDismissed}
      />

      <div style={{ ...GLASS, padding: 10, marginBottom: 8, border: '2px solid rgba(0,230,138,0.2)' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>
        🧬 Механизм-ориентированная модель (ТЗ-28)
      </div>

      {/* ===== ВЫБОР РЕЖИМА (2 кнопки рядом) ===== */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
        <div onClick={() => setShowIntellPopup(true)} style={{ borderRadius:14, background:'linear-gradient(135deg,rgba(0,230,138,0.06),rgba(0,200,83,0.03))', border:'1.5px solid rgba(0,230,138,0.15)', padding:'12px 12px 10px', cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:16 }}>🧠</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#00e68a' }}>Интеллектуальная</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                {level === 'base' && '🟢 База'}{level === 'medium' && '🟡 Средний'}{level === 'max' && '🔴 Максимум'}{level === 'manual' && '⚙️ Вручную'}
              </div>
            </div>
            <span style={{ fontSize:10, color:'#00e68a' }}>›</span>
          </div>
        </div>
        <div                         onClick={() => { setLevel('manual'); setShowManualPopup(true); }} style={{ borderRadius:14, background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(59,130,246,0.03))', border:'1.5px solid rgba(99,102,241,0.15)', padding:'12px 12px 10px', cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:16 }}>⚙️</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#818cf8' }}>Ручной режим</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                {manualSubs.length > 0 || selectedStacks.length > 0 ? `${selectedStacks.length} стек · ${manualSubs.length} пр.` : 'Каталог / стек / избранное'}
              </div>
            </div>
            <span style={{ fontSize:10, color:'#818cf8' }}>›</span>
          </div>
        </div>
      </div>

      {/* ── Попап интеллектуального выбора ── */}
      {showIntellPopup && ReactDOM.createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowIntellPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:320, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
            <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
            <div style={{ padding:'16px 14px 12px' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#00e68a', marginBottom:10 }}>🧠 Интеллектуальная поддержка</div>
              {([
                ['base','База','🟢','Только core: NAC, омега-3, Mg, D3. Бюджет'],
                ['medium','Средний','🟡','Core + standard. Оптимальный баланс'],
                ['max','Максимум','🔴','Все активные механизмы + advanced. Полная защита'],
              ] as const).map(([lv, label, icon, desc]) => (
                <div key={lv} onClick={() => { setLevel(lv as SupportLevel); setShowIntellPopup(false); }} style={{
                  padding:'10px 12px', borderRadius:10, marginBottom:5, cursor:'pointer',
                  background: level === lv ? 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(0,200,83,0.06))' : 'rgba(255,255,255,0.03)',
                  border: level === lv ? '1.5px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>{icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, fontWeight:700, color: level === lv ? '#00e68a' : '#ffffff' }}>{label} {level === lv && '✓'}</div>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Попап ручного режима (портал в body, экранирует backdrop-filter предка) ── */}
      {showManualPopup && ReactDOM.createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)', overflowY:'auto', padding:'20px 0' }} onClick={() => setShowManualPopup(false)}>
        <div style={{ width:'90%', maxWidth:420, margin:'0 auto', borderRadius:16, background:'#16161a', border:'1px solid rgba(255,255,255,0.12)', overflow:'hidden' }} onClick={e => e.stopPropagation()}>
          <div style={{ height:3, background:'linear-gradient(90deg,#818cf8,#6366f1)' }} />
          <div style={{ padding:'16px 14px 12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:800, color:'#818cf8' }}>⚙️ Ручной режим</span>
                <button onClick={() => setShowManualPopup(false)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:12, fontWeight:600 }}>✕</button>
              </div>
              {/* Tab bar */}
              <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', flexWrap:'wrap' }}>
                {['stacks','catalog','saved','favorites'].map((id) => (
                  <button key={id} onClick={() => { setManualTab(id as any); setCatalogSearch(''); setSavedSearch(''); setManualStackSearch(''); }}
                    style={{
                      padding:'6px 10px', borderRadius:8, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                      background: manualTab === id ? '#818cf8' : 'rgba(255,255,255,0.05)',
                      color: manualTab === id ? '#000' : 'rgba(255,255,255,0.6)',
                      border: '1px solid ' + (manualTab === id ? '#818cf8' : 'rgba(255,255,255,0.1)'),
                    }}>{id === 'stacks' ? '📦 Стеки' : id === 'catalog' ? '📋 Каталог' : id === 'saved' ? '💾 Сохранённые' : '⭐ Избранное'}</button>
                ))}
              </div>
              {manualTab === 'catalog' && (
                <>
                  <input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} placeholder="🔍 Поиск препарата (минимум 2 символа)..." style={{
                    width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:13, boxSizing:'border-box', marginBottom:6, outline:'none',
                  }} />
                  {!catalogSearch || catalogSearch.length < 2 ? (
                    <div style={{ padding:30, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:11 }}>
                      Введите минимум 2 символа для поиска по {Object.keys(SUPPORT_CATALOG_DATA).length} препаратам
                    </div>
                  ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'45vh', overflowY:'auto', marginBottom:10 }}>
                    {Object.entries(SUPPORT_CATALOG_DATA)
                      .filter(([id, entry]: [string, any]) => {
                        const q = catalogSearch.toLowerCase();
                        return (entry.nameRu||'').toLowerCase().includes(q) || (entry.name||'').toLowerCase().includes(q) || id.toLowerCase().includes(q);
                      })
                      .map(([id, entry]: [string, any]) => (
                        <CalcSubstanceDetail
                          key={id}
                          sub={{ substanceId: id, category: 'other' as const, k: 0, reason: 'Ручной выбор', mechsCovered: entry.mechanisms || [], q: 'B' }}
                          rec={{ subs: [], suppression: [], coverage: [], gaps: [], conflicts: [], guardrails: [], boosters: [], activatedMechs: [], summary: '', rationale: '', level: 'medium', phase: 'on', phaseLabel: 'На курсе' } as any}
                          subNameRu={(id: string) => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id}
                          subDosage={(id: string) => SUPPORT_CATALOG_DATA[id]?.dosage || { mg: 0, timing: '' }}
                          subTier={(id: string) => SUPPORT_CATALOG_DATA[id]?.tier || 'standard'}
                          canonIdLocal={(id: string) => id}
                        />
                      ))}
                  </div>
                  )}
                </>
              )}
              {manualTab === 'saved' && (
                <div style={{ padding:30, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:11 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>💾</div>
                  Здесь будут сохранённые планы и стеки.
                </div>
              )}
              {manualTab === 'favorites' && (
                <div style={{ padding:30, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:11 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>⭐</div>
                  Здесь будут избранные препараты.
                </div>
              )}
              {manualTab === 'stacks' && (
                <>
              {manualSubs.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.55)', marginBottom:4 }}>💊 Препараты из ручного ввода ({manualSubs.length}) — откройте каталог для выбора</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {manualSubs.map((sid, i) => (
                      <span key={sid+i} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontWeight:600, background:'rgba(99,102,241,0.12)', color:'#818cf8', display:'inline-flex', alignItems:'center', gap:4, margin:1 }}>
                        {sid}
                        <span onClick={() => setManualSubs(prev => prev.filter((_, j) => j !== i))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:13 }}>✕</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedStacks.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#c084fc', marginBottom:4 }}>📦 Выбранные стеки поддержки ({selectedStacks.length})</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {selectedStacks.map((stId) => {
                      const st = (ALL_STACKS as any[]).find(s => s.id === stId);
                      return (
                        <span key={stId} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontWeight:600, background:'rgba(168,85,247,0.12)', color:'#c084fc', display:'inline-flex', alignItems:'center', gap:4, margin:1 }}>
                          {st?.name || stId}
                          <span onClick={() => setSelectedStacks(prev => prev.filter(s => s !== stId))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.5)', fontSize:13 }}>✕</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ fontSize:13, fontWeight:700, color:'#ffffff', marginBottom:4, marginTop:4 }}>📦 Добавить стек из {ALL_STACKS.length} готовых</div>
              <input value={manualStackSearch} onChange={e => setManualStackSearch(e.target.value)} placeholder="🔍 Поиск стека..." style={{
                width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:13, boxSizing:'border-box', marginBottom:6, outline:'none',
              }} />
              <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'55vh', overflowY:'auto', marginBottom:10 }}>
                {(ALL_STACKS as any[])
                  .filter((st: any) => {
                    if (!manualStackSearch) return true;
                    const q = manualStackSearch.toLowerCase();
                    return (st.name||'').toLowerCase().includes(q) || (st.id||'').toLowerCase().includes(q) || (st.system||'').toLowerCase().includes(q) || (st.problem||'').toLowerCase().includes(q);
                  })
                  .map((st: any) => {
                    const active = selectedStacks.includes(st.id);
                    const subCount = (st.substances||[]).length;
                    const isExpanded = expandedManualStack === st.id;
                    return (
                      <div key={st.id}
                        style={{ borderRadius:7,
                          background: active ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)',
                          border: active ? '1px solid rgba(168,85,247,0.25)' : '1px solid rgba(255,255,255,0.04)' }}>
                        <div onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== st.id) : [...prev, st.id])}
                          style={{ padding:'8px 10px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:6 }}>
                          <span style={{ fontSize:13, minWidth:14, color: active ? '#c084fc' : 'rgba(255,255,255,0.4)', marginTop:1 }}>{active ? '✓' : '○'}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color: active ? '#c084fc' : 'rgba(255,255,255,0.9)', lineHeight:1.25 }}>{st.name || st.id.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')}</div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:2, lineHeight:1.35 }}>{st.system || ''} · {subCount} веществ{st.synergyScore ? ` · син: ${st.synergyScore}` : ''}</div>
                          </div>
                          <span onClick={(e) => { e.stopPropagation(); setExpandedManualStack(isExpanded ? null : st.id); }}
                            style={{ fontSize:13, color:'rgba(255,255,255,0.55)', cursor:'pointer', marginTop:1, padding:'0 2px', flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                        {isExpanded && (
                          <div style={{ padding:'0 8px 8px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                            {st.anatomicalMapping?.organMechanisms && (
                              <div style={{ fontSize:11, color:'rgba(240,240,245,0.9)', lineHeight:1.45, marginTop:6 }}>
                                <b style={{ color:'#a78bfa' }}>🧬 Механизм действия:</b> {st.anatomicalMapping.organMechanisms}
                              </div>
                            )}
                            {st.synergyPrinciple && (
                              <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                                <b>Принцип синергии:</b> {st.synergyPrinciple}
                              </div>
                            )}
                            {st.anatomicalMapping?.finalEffect && (
                              <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                                <b>Итоговый эффект:</b> {st.anatomicalMapping.finalEffect}
                              </div>
                            )}
                            {st.anatomicalMapping?.mechanismCodes?.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:4 }}>
                                {st.anatomicalMapping.mechanismCodes.map((m: string) => (
                                  <span key={m} style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.1)', color:'#c084fc' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g,' ')}</span>
                                ))}
                              </div>
                            )}
                            <div style={{ fontSize:12, fontWeight:700, color:'#00e68a', marginTop:8, marginBottom:3 }}>💊 Перечень препаратов ({subCount}):</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                              {(st.substances||[]).map((sd: any) => {
                                const cat = SUPPORT_CATALOG_DATA[sd.id];
                                return (
                                  <div key={sd.id} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.12)' }}>
                                    <span style={{ fontWeight:600, color:'rgba(240,240,245,0.9)' }}>{cat?.nameRu || cat?.name || sd.id}</span>
                                    {sd.dose && <span style={{ color:'#00e68a', marginLeft:4 }}>{sd.dose}</span>}
                                    {sd.timing && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:4 }}>{sd.timing}</span>}
                                    {sd.mechanism && <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', lineHeight:1.35, marginTop:2 }}>— {sd.mechanism}</div>}
                                  </div>
                                );
                              })}
                            </div>
                            {(st.contraindications || st.warnings) && (
                              <div style={{ marginTop:8 }}>
                                {st.contraindications && (
                                  <div style={{ fontSize:11, color:'#f87171', lineHeight:1.45 }}>
                                    <b>⛔ Противопоказания:</b> {st.contraindications}
                                  </div>
                                )}
                                {st.warnings && (
                                  <div style={{ fontSize:11, color:'#fbbf24', lineHeight:1.45, marginTop:3 }}>
                                    <b>⚠ Осторожности / предосторожности:</b> {st.warnings}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
                </>
              )}
              <button onClick={() => { setLevel('manual'); setShowManualPopup(false); }} style={{ width:'100%', padding:'10px', borderRadius:10, background:'linear-gradient(135deg,#818cf8,#6366f1)', border:'none', color:'#000', fontWeight:700, fontSize:11, cursor:'pointer' }}>
                ✅ Применить ручной выбор
              </button>
            </div>
           </div>
        </div>
      , document.body)}
      
      {/* ===== PED-RISK БАННЕР: авто-активация нейро/суставы/гемато по стеку PED (gross→net) ===== */}
      {finalRecWithResidual?.pedRisk && (finalRecWithResidual.pedRisk.grossNeuroTier !== undefined ? finalRecWithResidual.pedRisk.grossNeuroTier! > 0 : finalRecWithResidual.pedRisk.neuroBoosterTier > 0 || finalRecWithResidual.pedRisk.jointsBoosterTier > 0 || finalRecWithResidual.pedRisk.hematoBoosterTier > 0) && (
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:12, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#a5b4fc', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.3px' }}>
            ⚡ Авто-защита по стеку PED (gross→net)
          </div>
          {(() => {
            const pr = finalRecWithResidual.pedRisk!;
            const grossN = pr.grossNeuroTier ?? pr.neuroBoosterTier;
            const grossJ = pr.grossJointsTier ?? pr.jointsBoosterTier;
            const grossH = pr.grossHematoTier ?? pr.hematoBoosterTier;
            return (
              <>
                {grossN > 0 && (
                  <div style={{ fontSize:8, color: pr.neuroBoosterTier === 0 ? '#4ade80' : '#818cf8', lineHeight:1.4, marginBottom:3, display:'flex', alignItems:'flex-start', gap:4 }}>
                    <span style={{ fontSize:10 }}>🧠</span>
                    <div>
                      <b>Нейрозащита LV{grossN}{pr.neuroBoosterTier !== grossN ? ` → LV${pr.neuroBoosterTier}` : ''}</b>
                      {pr.neuroCoverage != null && pr.neuroRecommended ? <span style={{ color: pr.neuroBoosterTier === 0 ? '#4ade80' : 'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>{pr.neuroCovered}/{pr.neuroRecommended}{pr.neuroBoosterTier === 0 ? ' ✓ покрыто' : ''}</span> : null}
                      <span style={{ color:'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>— {pr.neuroRisk}</span>
                      {pr.triggeredBy.filter(r => r.includes('нейро') || r.includes('Нейро') || r.includes('19-нор') || r.includes('трен') || r.includes('Трен') || r.includes('Эскалация')).slice(0,1).map((r,i) => (
                        <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{r}</div>
                      ))}
                    </div>
                  </div>
                )}
                {grossJ > 0 && (
                  <div style={{ fontSize:8, color: pr.jointsBoosterTier === 0 ? '#4ade80' : '#4ade80', lineHeight:1.4, marginBottom:3, display:'flex', alignItems:'flex-start', gap:4 }}>
                    <span style={{ fontSize:10 }}>🦴</span>
                    <div>
                      <b>Суставы LV{grossJ}{pr.jointsBoosterTier !== grossJ ? ` → LV${pr.jointsBoosterTier}` : ''}</b>
                      {pr.jointsCoverage != null && pr.jointsRecommended ? <span style={{ color: pr.jointsBoosterTier === 0 ? '#4ade80' : 'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>{pr.jointsCovered}/{pr.jointsRecommended}{pr.jointsBoosterTier === 0 ? ' ✓ покрыто' : ''}</span> : null}
                      <span style={{ color:'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>— {pr.jointsRisk}</span>
                      {pr.triggeredBy.filter(r => r.includes('сустав') || r.includes('Сустав') || r.includes('стан') || r.includes('Стан') || r.includes('tendin') || r.includes('компенс') || r.includes('Эскалация')).slice(0,1).map((r,i) => (
                        <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{r}</div>
                      ))}
                    </div>
                  </div>
                )}
                {grossH > 0 && (
                  <div style={{ fontSize:8, color: pr.hematoBoosterTier === 0 ? '#4ade80' : '#14b8a6', lineHeight:1.4, marginBottom:3, display:'flex', alignItems:'flex-start', gap:4 }}>
                    <span style={{ fontSize:10 }}>🩸</span>
                    <div>
                      <b>Гемато LV{grossH}{pr.hematoBoosterTier !== grossH ? ` → LV${pr.hematoBoosterTier}` : ''}</b>
                      {pr.hematoCoverage != null && pr.hematoRecommended ? <span style={{ color: pr.hematoBoosterTier === 0 ? '#4ade80' : 'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>{pr.hematoCovered}/{pr.hematoRecommended}{pr.hematoBoosterTier === 0 ? ' ✓ покрыто' : ''}</span> : null}
                      <span style={{ color:'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>— {pr.hematoRisk}</span>
                      {pr.triggeredBy.filter(r => r.includes('гемато') || r.includes('Гемато') || r.includes('эритропоэз') || r.includes('Эритропоэз') || r.includes('HIF') || r.includes('ЭПО') || r.includes('болденон') || r.includes('Болденон') || r.includes('Эскалация')).slice(0,1).map((r,i) => (
                        <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{r}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ===== СИНХРОНИЗАЦИЯ С ПРОФИЛЕМ (neuro/oda/pharma/symptoms) ===== */}
      {onStateChange && (
        <div style={{ marginBottom:6, display:'flex', gap:4 }}>
          <button onClick={() => {
            try {
              const raw = localStorage.getItem('he_profile_v2');
              if (!raw) return;
              const p = JSON.parse(raw);
              const s = p?.settings || {};
              const personal = s.personal || {};
              const lifestyle = s.lifestyle || {};
              const health = s.health || {};
              const pharma = s.pharma || {};
              const phaseMap: Record<string, string> = { baseline: 'base', course: 'course', bridge: 'bridge', pct: 'pct', post_pct: 'pct', fertility: 'base' };
              const aas = Array.isArray(pharma.currentSubstances) ? pharma.currentSubstances.map((sub: any) => ({
                id: sub.id || sub.substanceId || '',
                mgPerWeek: sub.doseMgWeek || sub.weeklyDose || sub.doseMg || 0,
                weeks: sub.weeks || (sub.endWeek || 12) - (sub.startWeek || 0) || 12,
                form: sub.form || (sub.route === 'oral' ? 'oral' : 'inject'),
              })) : [];
              // Вывод PED-флагов и доз из currentSubstances
              const csIds = new Set((pharma.currentSubstances || []).map((s: any) => s.id));
              const csHasAI = ['anastrozole','anastro','letrozole','exemestane'].some(id => csIds.has(id));
              const csHasSERM = ['tamoxifen','clomiphene','enclomiphene'].some(id => csIds.has(id));
              const csHasCaber = csIds.has('caberg') || csIds.has('cabergoline');
              const csHasGH = csIds.has('somatropin') || csIds.has('hgh') || csIds.has('gh');
              const csHasIGF = csIds.has('igf1_lr3') || csIds.has('igf1_des');
              const csHasInsulin = ['ins_short','ins_long','ins_aspart','ins_detemir'].some(id => csIds.has(id));
              const csHasSARMs = ['ostarine','lgd','rad140','s23','andarine'].some(id => csIds.has(id));
              const csHasMGF = csIds.has('mgf');
              let csGhIU = 0, csInsulinIU = 0, csIgfMcg = 0, csClenMcg = 0, csT3Mcg = 0;
              for (const s of (pharma.currentSubstances || [])) {
                const dose = Number((s as any).doseMg || (s as any).doseValue || 0);
                const id = (s as any).id;
                if (id === 'somatropin' || id === 'hgh' || id === 'gh') csGhIU += dose;
                if (['ins_short','ins_long','ins_aspart','ins_detemir'].includes(id)) csInsulinIU += dose;
                if (id === 'igf1_lr3' || id === 'igf1_des') csIgfMcg += dose;
                if (id === 'clenbuterol' || id === 'clen') csClenMcg += dose;
                if (id === 't3' || id === 'liothyronine') csT3Mcg += dose;
              }
              onStateChange({
                ...state,
                profile: { ...state.profile, weight: personal.weight || state.profile.weight, age: personal.age || state.profile.age, sleepHours: lifestyle.sleepHours ?? state.profile.sleepHours, stressLevel: lifestyle.stressLevel ?? state.profile.stressLevel, height: personal.height ?? state.profile.height },
                neuro: { ...state.neuro, aggressionScore: (health.aggressionScore ?? 3) * 2, dopamineScore: health.dopamineScore ?? state.neuro.dopamineScore, serotoninScore: health.serotoninScore ?? state.neuro.serotoninScore, memoryIssues: health.memoryIssues ?? state.neuro.memoryIssues, focusIssues: health.focusIssues ?? state.neuro.focusIssues, slowThinking: health.slowThinking ?? state.neuro.slowThinking, headaches: health.headaches ?? state.neuro.headaches, gabaBalance: health.gabaBalance || state.neuro.gabaBalance, coordinationIssues: health.coordinationIssues ?? state.neuro.coordinationIssues },
                oda: { ...state.oda, jointPain: health.jointPainSeverity ?? (health.jointPain ? 'moderate' : state.oda.jointPain), ligamentIssues: health.ligamentIssues ?? state.oda.ligamentIssues, backPain: health.backPain ?? state.oda.backPain },
                pharma: {
                  ...state.pharma,
                  phase: (phaseMap[pharma.phase] || state.pharma.phase) as any,
                  aas: aas.length > 0 ? aas : state.pharma.aas,
                  hasHCG: pharma.hcgEnabled ?? state.pharma.hasHCG,
                  hasAI: csHasAI || pharma.aiEnabled || state.pharma.hasAI,
                  hasSERM: csHasSERM || state.pharma.hasSERM,
                  hasCaber: csHasCaber || pharma.hasCaber || state.pharma.hasCaber,
                  hasGH: csHasGH || pharma.hasGH || state.pharma.hasGH,
                  hasIGF: csHasIGF || pharma.hasIGF || state.pharma.hasIGF,
                  hasInsulin: csHasInsulin || pharma.hasInsulin || state.pharma.hasInsulin,
                  hasSARMs: csHasSARMs || pharma.hasSARMs || state.pharma.hasSARMs,
                  hasMGF: csHasMGF || pharma.hasMGF || state.pharma.hasMGF,
                  ghIU: csGhIU > 0 ? csGhIU : (pharma.ghIU ?? state.pharma.ghIU),
                  insulinIU: csInsulinIU > 0 ? csInsulinIU : (pharma.insulinIU ?? state.pharma.insulinIU),
                  igfMcg: csIgfMcg > 0 ? csIgfMcg : (pharma.igfMcg ?? state.pharma.igfMcg),
                  clenMcg: csClenMcg > 0 ? csClenMcg : (pharma.clenMcg ?? state.pharma.clenMcg),
                  t3Mcg: csT3Mcg > 0 ? csT3Mcg : (pharma.t3Mcg ?? state.pharma.t3Mcg),
                },
                healthConditions: Array.isArray(health.chronicConditions) ? health.chronicConditions : state.healthConditions,
              });
            } catch {}
          }} style={{ flex:1, fontSize:8, fontWeight:700, cursor:'pointer', padding:'5px 8px', borderRadius:6, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.15)', color:'#a5b4fc' }}>📋 Из профиля (neuro/oda/pharma)</button>
        </div>
      )}

      {/* ===== УСИЛЕНИЕ: все стеки каталога (видно во ВСЕХ режимах, включая ручной) ===== */}
      {(
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:12, background:'rgba(24,24,27,0.3)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
            <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.3px' }}>Усиление ({ALL_STACKS.length} стеков)</span>
            <button onClick={() => setShowEnhancementPopup(true)} style={{ fontSize:11, fontWeight:700, cursor:'pointer', padding:'5px 10px', borderRadius:6, background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)', color:'#f87171' }}>📋 Все стеки</button>
          </div>
           <button onClick={() => setShowEnhancementPopup(true)} style={{ width:'100%', padding:'10px 12px', borderRadius:9, fontSize:11, fontWeight:800, cursor:'pointer', background:'linear-gradient(135deg,rgba(248,113,113,0.16),rgba(99,102,241,0.12))', border:'1px solid rgba(248,113,113,0.28)', color:'#fff', textAlign:'left' }}>
             🚀 Усиление <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)', fontWeight:500 }}>— системы, нейро, кровь, суставы и дополнительные стеки</span>
           </button>
          {selectedStacks.filter(id => !['articular_stack','neuroprotection_stack','mega_total_support_35'].includes(id)).length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4 }}>
              {selectedStacks.filter(id => !['articular_stack','neuroprotection_stack','mega_total_support_35'].includes(id)).map(sid => (
                <span key={sid} style={{ fontSize:10, padding:'3px 7px', borderRadius:6, fontWeight:600, background:'rgba(168,85,247,0.12)', color:'#c084fc', display:'inline-flex', alignItems:'center', gap:4 }}>
                  {sid.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')}
                  <span onClick={() => setSelectedStacks(prev => prev.filter(s => s !== sid))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.6)', fontSize:12 }}>✕</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Попап полного каталога стеков (Усиление) — ВСЕ 55 стеков из ALL_STACKS ── */}
      {showEnhancementPopup && ReactDOM.createPortal(
         <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowEnhancementPopup(false)}>
           <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, borderRadius:18, overflowWrap:'anywhere', wordBreak:'break-word', background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
             <div style={{ height:3, background:'linear-gradient(90deg,#f87171,#ef4444)' }} />
             <div style={{ padding:'14px 14px 10px' }}>
               <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                 <span style={{ fontSize:13, fontWeight:800, color:'#f87171' }}>🚀 Усиление: все стеки ({ALL_STACKS.length})</span>
                <button onClick={() => setShowEnhancementPopup(false)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:12, fontWeight:600 }}>✕</button>
              </div>
             <input value={enhancementSearch} onChange={e => setEnhancementSearch(e.target.value)} placeholder="🔍 Поиск стека по названию, системе или проблеме..." style={{
                 width:'100%', padding:'9px 11px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'#26262b', color:'#ffffff', fontSize:13, boxSizing:'border-box', marginBottom:8,
               }} />
             <div style={{ fontSize:9, fontWeight:800, color:'#fff', margin:'4px 0' }}>Системы</div>
             <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:4, marginBottom:6 }}>
                {(['all', 'cardio', 'hepatic', 'renal', 'hematologic', 'neuro', 'endocrine', 'reproductive', 'musculoskeletal', 'metabolic'] as const).map(system => {
                 const meta: Record<string, [string, string]> = {
                   all: ['🧩 Все', '#f87171'], cardio: ['❤️ ССС', '#ef4444'], hepatic: ['🫁 Печень', '#f59e0b'],
                   renal: ['🫘 Почки', '#60a5fa'], hematologic: ['🩸 Кровь', '#14b8a6'], neuro: ['🧠 ЦНС', '#818cf8'],
                   endocrine: ['🧪 Эндокринная', '#ec4899'], reproductive: ['🧬 Репродукт.', '#f472b6'],
                   musculoskeletal: ['🦴 ОДА', '#4ade80'], metabolic: ['🍬 Метаболизм', '#fb923c'],
                 };
                 const [label, color] = meta[system];
                 const active = enhancementSystem === system;
                  return (
                    <button key={system} onClick={() => {
                      setEnhancementSystem(system);
                      if (system === 'hematologic') {
                        setStackModulePopup('hemato_stack');
                        setHematoPreset(null); setHematoSelected(new Set()); setHematoConfirm(false);
                        setHematoSymptoms(buildHematoSymptomsFromState(state));
                      } else if (system === 'neuro') {
                        setStackModulePopup('neuroprotection_stack');
                        setNeuroPreset(null); setNeuroSelected(new Set()); setNeuroConfirm(false);
                        setNeuroSymptoms(buildNeuroSymptomsFromState(state));
                      } else if (system !== 'all' && GENERIC_ENHANCEMENT_CONFIG[system]) {
                        setGenericEnhancementPopup(system);
                        setGenericEnhancementSelected(new Set());
                      }
                    }} style={{ padding:'7px 4px', borderRadius:7, border:`1px solid ${color}${active ? 'aa' : '55'}`, background:active ? `${color}28` : `${color}12`, color:'#fff', fontSize:8, fontWeight:700, cursor:'pointer', whiteSpace:'normal', lineHeight:1.2 }}>
                      {label}
                    </button>
                  );
               })}
             </div>
            </div>

            {/* ── Автоподбор под недостающие механизмы ТЗ ── */}
            {gapFill.length > 0 && (
              <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(239,68,68,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:'#f87171' }}>🎯 Автоподбор под недостающие механизмы ({gapFill.length})</span>
                  <button onClick={() => setSelectedStacks(prev => Array.from(new Set([...prev, ...gapFill.map(g => g.stackId)])))}
                    style={{ padding:'5px 11px', borderRadius:7, border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.12)', color:'#fca5a5', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                    ✅ Все рекомендованные
                  </button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {gapFill.map(g => {
                    const active = selectedStacks.includes(g.stackId);
                    return (
                      <div key={g.stackId} onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== g.stackId) : [...prev, g.stackId])}
                        style={{ padding:'7px 9px', borderRadius:8, cursor:'pointer',
                          background: active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
                          border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:11, minWidth:14, color: active ? '#c084fc' : 'rgba(255,255,255,0.55)' }}>{active ? '✓' : '○'}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:700, color: active ? '#c084fc' : 'rgba(240,240,245,0.9)', lineHeight:1.25 }}>{g.stackName}</div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', lineHeight:1.35, marginTop:2 }}>
                              {g.organLabels.join(', ')} · закрывает: {g.mechLabels.join(', ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:5, lineHeight:1.35 }}>
                  Стек покрывает механизмы, оставшиеся незакрытыми после текущего плана поддержки.
                </div>
              </div>
            )}

            <div style={{ flex:1, overflowY:'auto', padding:'0 14px 14px' }}>
              {(ALL_STACKS as any[])
                 .filter((st: any) => {
                   if (enhancementSystem !== 'all') {
                     const systems = [st.system, ...(st.anatomicalMapping?.organSystems || []), ...(st.systems || [])]
                       .filter(Boolean).map((x: any) => String(x).toLowerCase());
                     const text = JSON.stringify(st).toLowerCase();
                     const aliases: Record<string, string[]> = {
                       cardio: ['cardio','heart','ссс','серд'], hepatic: ['hepatic','liver','печен'], renal: ['renal','kidney','почек'],
                       hematologic: ['hemat','blood','кров'], neuro: ['neuro','cns','цнс'], endocrine: ['endocrine','гормон'],
                       reproductive: ['reproductive','hormonal','репродукт'], musculoskeletal: ['musculo','joint','bone','сустав','ода'], metabolic: ['metabolic','glycemic','метабол'],
                     };
                     const terms = aliases[enhancementSystem] || [enhancementSystem];
                     if (!terms.some(term => systems.some(s => s.includes(term)) || text.includes(term))) return false;
                   }
                   if (!enhancementSearch) return true;
                  const q = enhancementSearch.toLowerCase();
                  const name = (st.name||'').toLowerCase();
                  const sys = (st.system||'').toLowerCase();
                  const prob = (st.problem||'').toLowerCase();
                  const sid = (st.id||'').toLowerCase();
                  return name.includes(q) || sys.includes(q) || prob.includes(q) || sid.includes(q);
                 })
                .map((st: any) => {
                  const active = selectedStacks.includes(st.id);
                  const subCount = (st.substances||[]).length;
                  const trigger = STACK_BOOSTER_TRIGGERS.find(t => t.stackId === st.id);
                  const isExpanded = expandedManualStack === st.id;
                  return (
                    <div key={st.id}
                      style={{ borderRadius:8, marginBottom:4, overflow:'hidden',
                        background: active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.02)',
                        border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                      }}>
                      <div onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== st.id) : [...prev, st.id])}
                        style={{ padding:'9px 11px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:6 }}>
                        <span style={{ fontSize:13, minWidth:14, color: active ? '#c084fc' : 'rgba(255,255,255,0.4)', marginTop:1 }}>{active ? '✓' : '○'}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color: active ? '#c084fc' : 'rgba(255,255,255,0.9)', lineHeight:1.25 }}>{st.name || st.id.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')}</div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.35, marginTop:2 }}>{st.problem || st.system || ''}</div>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginTop:3, display:'flex', gap:5, flexWrap:'wrap' }}>
                            <span>{subCount} веществ</span>
                            {st.synergyScore ? <span>· синергия: {st.synergyScore}</span> : null}
                            {st.system ? <span>· {st.system}</span> : null}
                            {trigger ? <span style={{color:'#f87171',fontWeight:700}}>· авто-триггер</span> : null}
                          </div>
                        </div>
                        <span onClick={(e) => { e.stopPropagation(); setExpandedManualStack(isExpanded ? null : st.id); }}
                          style={{ fontSize:13, color:'rgba(255,255,255,0.55)', cursor:'pointer', marginTop:1, padding:'0 2px', flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                      {isExpanded && (
                        <div style={{ padding:'0 10px 10px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                          {st.anatomicalMapping?.organMechanisms && (
                            <div style={{ fontSize:11, color:'rgba(240,240,245,0.9)', lineHeight:1.45, marginTop:6 }}>
                              <b style={{ color:'#a78bfa' }}>🧬 Механизм действия:</b> {st.anatomicalMapping.organMechanisms}
                            </div>
                          )}
                          {st.synergyPrinciple && (
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                              <b>Принцип синергии:</b> {st.synergyPrinciple}
                            </div>
                          )}
                          {st.anatomicalMapping?.finalEffect && (
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                              <b>Итоговый эффект:</b> {st.anatomicalMapping.finalEffect}
                            </div>
                          )}
                          {st.anatomicalMapping?.mechanismCodes?.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:4 }}>
                              {st.anatomicalMapping.mechanismCodes.map((m: string) => (
                                <span key={m} style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.1)', color:'#c084fc' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g,' ')}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize:12, fontWeight:700, color:'#00e68a', marginTop:8, marginBottom:3 }}>💊 Перечень препаратов ({subCount}):</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                            {(st.substances||[]).map((sd: any) => {
                              const cat = SUPPORT_CATALOG_DATA[sd.id];
                              return (
                                <div key={sd.id} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.12)' }}>
                                  <span style={{ fontWeight:600, color:'rgba(240,240,245,0.9)' }}>{cat?.nameRu || cat?.name || sd.id}</span>
                                  {sd.dose && <span style={{ color:'#00e68a', marginLeft:4 }}>{sd.dose}</span>}
                                  {sd.timing && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:4 }}>{sd.timing}</span>}
                                  {sd.mechanism && <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', lineHeight:1.35, marginTop:2 }}>— {sd.mechanism}</div>}
                                </div>
                              );
                            })}
                          </div>
                          {(st.contraindications || st.warnings) && (
                            <div style={{ marginTop:8 }}>
                              {st.contraindications && (
                                <div style={{ fontSize:11, color:'#f87171', lineHeight:1.45 }}>
                                  <b>⛔ Противопоказания:</b> {st.contraindications}
                                </div>
                              )}
                              {st.warnings && (
                                <div style={{ fontSize:11, color:'#fbbf24', lineHeight:1.45, marginTop:3 }}>
                                  <b>⚠ Осторожности / предосторожности:</b> {st.warnings}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Попап Мега-усиления (умный подбор по gaps + синергии) ── */}
      {showMegaPopup && ReactDOM.createPortal(
         <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowMegaPopup(false)}>
            <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:400, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'88vh', display:'flex', flexDirection:'column', color:'#fff' }}>
             <div style={{ height:3, background:'linear-gradient(90deg,#f87171,#ef4444)' }} />
             <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
               <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                 <span style={{ fontSize:13, fontWeight:800, color:'#f87171' }}>🚀 Мега-усиление</span>
                <button onClick={() => setShowMegaPopup(false)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:10, fontWeight:600 }}>✕</button>
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:4, lineHeight:1.3 }}>
                Умный подбор по непокрытым механизмам ТЗ ({finalRec?.gaps?.length || 0} gaps) и синергии с текущими препаратами ({finalRec?.subs?.length || 0})
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'10px 14px 14px' }}>
              {megaSuggestions.length === 0 ? (
                <div style={{ padding:'20px 10px', textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:10, lineHeight:1.5 }}>
                  {state.pharma.aas.length === 0
                    ? '💡 Добавьте препараты курса (PED) или введите лаб-данные — Мега подберёт усиление по непокрытым механизмам.'
                    : '✅ Все доступные вещества уже в плане. Проверьте лаб-данные для активации дополнительных механизмов.'}
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'#f87171' }}>Найдено {megaSuggestions.length} веществ</span>
                    <button onClick={() => setMegaSelected(new Set(megaSuggestions.map(s => s.substanceId)))}
                    style={{ padding:'5px 11px', borderRadius:7, border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.12)', color:'#fca5a5', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                      ✅ Все
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {megaSuggestions.map(s => {
                      const active = megaSelected.has(s.substanceId);
                      return (
                        <div key={s.substanceId} onClick={() => setMegaSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(s.substanceId)) next.delete(s.substanceId);
                          else next.add(s.substanceId);
                          return next;
                        })}
                          style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer',
                            background: active ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)',
                            border: active ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                            <span style={{ fontSize:11, minWidth:14, color: active ? '#f87171' : 'rgba(255,255,255,0.4)', marginTop:1 }}>{active ? '✓' : '○'}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:10, fontWeight:700, color: active ? '#fca5a5' : 'rgba(240,240,245,0.9)', lineHeight:1.2 }}>
                                {subNameRu(s.substanceId)}
                              </div>
                              <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', lineHeight:1.3, marginTop:2 }}>
                                {s.reason}
                              </div>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', marginTop:3, display:'flex', gap:5, flexWrap:'wrap' }}>
                                <span>📊 {s.mechsCovered.length} мех.</span>
                                {s.synergyWith.length > 0 && (
                                  <span style={{ color:'#fbbf24', fontWeight:700 }}>⚡ синергия: {s.synergyWith.map(x => subNameRu(x)).join(', ')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {megaSuggestions.length > 0 && (
              <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => { setMegaSelected(new Set()); setShowMegaPopup(false); }}
                    style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
                    Отмена
                  </button>
                  <button onClick={() => {
                    const newSubs = Array.from(megaSelected).filter(sid =>
                      !(finalRec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid))
                    );
                    requestAddSubs(newSubs);
                    setShowMegaPopup(false);
                  }}
                    disabled={megaSelected.size === 0}
                    style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor: megaSelected.size > 0 ? 'pointer' : 'default', border:'none', color:'#000',
                      background: megaSelected.size > 0 ? 'linear-gradient(135deg,#f87171,#ef4444)' : 'rgba(255,255,255,0.06)' }}>
                    ✅ Добавить ({megaSelected.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      , document.body)}

      {/* ── Универсальные системные popup-ы: тот же каркас, что у Нейро/Кровь/Суставы ── */}
      {genericEnhancementPopup && GENERIC_ENHANCEMENT_CONFIG[genericEnhancementPopup] && ReactDOM.createPortal((() => {
        const cfg = GENERIC_ENHANCEMENT_CONFIG[genericEnhancementPopup];
        const labs = labSliceToValues(state.labs.fullPanel);
        const domains = SPECIALIZED_DOMAINS[genericEnhancementPopup] || [];
        const activeDomains = domains.filter(d => d.trigger?.(labs, state));
        const activeMarkers = cfg.markers.filter(m => labs[m] != null);
        const selected = genericEnhancementSelected;
        const activePreset = cfg.presets.find(p => p.ids.every(id => selected.has(id)))?.id || null;
        const autoIds = Array.from(new Set(activeDomains.flatMap(d => d.ids)));
        const systemWarnings: string[] = [];
        if (genericEnhancementPopup === 'cardio' && (selected.has('telmisartan') || selected.has('tadalafil') || selected.has('nebivolol'))) systemWarnings.push('Кардио-комбинации требуют контроля АД и ЧСС; при головокружении/брадикардии не повышать дозы.');
        if (genericEnhancementPopup === 'renal' && (selected.has('electrolyte_balance') || selected.has('potassium') || selected.has('telmisartan'))) systemWarnings.push('K⁺/eGFR/креатинин обязательны; не добавлять калий при гиперкалиемии или ХБП без врача.');
        if (genericEnhancementPopup === 'endocrine' && selected.has('cabergoline')) systemWarnings.push('Каберголин: только подтверждённый PRL, повторный анализ/макропролактин и обязательное назначение врача.');
        if (genericEnhancementPopup === 'metabolic' && (state.pharma.hasInsulin || state.pharma.hasGH) && (selected.has('berberine') || selected.has('alpha_lipoic') || selected.has('chromium'))) systemWarnings.push('GH/инсулин + метаболические усилители требуют контроля глюкозы и риска гипогликемии.');
        if (genericEnhancementPopup === 'musculoskeletal' && (selected.has('bpc157') || selected.has('tb500') || selected.has('ghk_cu'))) systemWarnings.push('Пептидный LV3-блок имеет исследовательский статус и не является обычной БАД-поддержкой.');
        const toggle = (id: string) => setGenericEnhancementSelected(prev => {
          const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
        });
        const renderGroup = (title: string, ids: string[], color: string) => (
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:9, fontWeight:800, color, marginBottom:4 }}>{title}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
              {ids.map(id => {
                const inPlan = (finalRec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(id));
                const checked = selected.has(id) || inPlan;
                return <button key={id} disabled={inPlan} onClick={() => toggle(id)} style={{ padding:'6px 7px', borderRadius:7, textAlign:'left', cursor:inPlan ? 'default' : 'pointer', background:checked ? `${color}20` : 'rgba(255,255,255,0.03)', border:`1px solid ${checked ? color+'66' : 'rgba(255,255,255,0.08)'}`, color:'#fff', opacity:inPlan ? 0.55 : 1, minWidth:0 }}>
                  <div style={{ fontSize:8, fontWeight:700, overflowWrap:'anywhere' }}>{checked ? '✓ ' : '○ '}{subNameRu(id)}</div>
                  <div style={{ fontSize:6, color:'rgba(255,255,255,0.55)', marginTop:2, lineHeight:1.3 }}>механизм: {cfg.domains.slice(0,2).join(', ')}</div>
                </button>;
              })}
            </div>
          </div>
        );
        return <div style={{ position:'fixed', inset:0, zIndex:310, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.82)', padding:12 }} onClick={() => setGenericEnhancementPopup(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'94%', maxWidth:420, maxHeight:'90vh', overflow:'hidden', overflowWrap:'anywhere', wordBreak:'break-word', display:'flex', flexDirection:'column', borderRadius:18, background:'#16161a', border:`1px solid ${cfg.color}55`, color:'#fff' }}>
            <div style={{ padding:'13px 14px 9px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><span style={{ fontSize:13, fontWeight:800, color:cfg.color }}>{cfg.icon} {cfg.label} — усиление</span><button onClick={() => setGenericEnhancementPopup(null)} style={{ color:'#fff', background:'transparent', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>✕</button></div>
              <div style={{ fontSize:8, color:'#fff', opacity:.7, lineHeight:1.4, marginTop:5, overflowWrap:'anywhere' }}>{cfg.notes}</div>
            </div>
            <div style={{ overflowY:'auto', padding:'10px 14px', minHeight:0 }}>
              <div style={{ padding:'7px 8px', marginBottom:8, borderRadius:8, background:`${cfg.color}12`, border:`1px solid ${cfg.color}30`, fontSize:8, lineHeight:1.5 }}>
                <b>Механизмы:</b> {cfg.domains.join(' · ')}<br/>
                <b>Анализы:</b> {activeMarkers.length ? activeMarkers.map(m => `${m} ${labs[m]}`).join(', ') : 'нет данных — поддержка по фармакологии курса, нужен контроль'}
              </div>
              <CalcSystemPanel
                risk={systemRiskOf(genericEnhancementPopup)}
                panel={SYSTEM_PANELS.find(p => p.id === SYSTEM_TO_PANEL[genericEnhancementPopup]) || null}
                contra={finalRec?.contraindications || []}
              />
              {activeDomains.length > 0 && <button onClick={() => setGenericEnhancementSelected(new Set(autoIds))} style={{ width:'100%', padding:'8px', marginBottom:8, borderRadius:8, border:`1px solid ${cfg.color}66`, background:`${cfg.color}18`, color:'#fff', fontSize:8, fontWeight:800, cursor:'pointer', textAlign:'left' }}>⚡ AUTO по данным: {activeDomains.map(d => d.label).join(' · ')} ({autoIds.length} кандидатов)</button>}
              <div style={{ fontSize:9, fontWeight:800, color:'#fff', marginBottom:5 }}>📊 Контрольные маркеры</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:9 }}>{cfg.markers.map(m => <span key={m} style={{ fontSize:7, padding:'2px 5px', borderRadius:4, background:labs[m] != null ? `${cfg.color}25` : 'rgba(255,255,255,0.05)', color:'#fff' }}>{m}{labs[m] != null ? `: ${labs[m]}` : ' · нет'}</span>)}</div>
              <div style={{ fontSize:9, fontWeight:800, color:'#fff', marginBottom:4 }}>⚡ Быстрые протоколы</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, marginBottom:9 }}>
                {cfg.presets.map(p => <button key={p.id} onClick={() => setGenericEnhancementSelected(new Set(p.ids))} style={{ padding:'7px 4px', borderRadius:7, border:`1px solid ${activePreset === p.id ? cfg.color+'aa' : 'rgba(255,255,255,0.12)'}`, background:activePreset === p.id ? `${cfg.color}25` : 'rgba(255,255,255,0.03)', color:'#fff', fontSize:8, fontWeight:700, cursor:'pointer' }}>LV{p.level} {p.label}</button>)}
              </div>
              <div style={{ fontSize:9, fontWeight:800, color:'#fff', marginBottom:4 }}>🧬 Специализированные домены системы</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:9 }}>
                {domains.map(d => {
                  const active = activeDomains.some(x => x.id === d.id);
                  return <button key={d.id} onClick={() => setGenericEnhancementSelected(prev => {
                    const next = new Set(prev); d.ids.forEach(id => next.add(id)); return next;
                  })} style={{ padding:'7px', borderRadius:7, textAlign:'left', cursor:'pointer', background:active ? `${cfg.color}20` : 'rgba(255,255,255,0.03)', border:`1px solid ${active ? cfg.color+'77' : 'rgba(255,255,255,0.1)'}`, color:'#fff', minWidth:0 }}>
                    <div style={{ fontSize:8, fontWeight:800 }}>{d.icon} {d.label}</div>
                    <div style={{ fontSize:6, color:'rgba(255,255,255,0.58)', marginTop:2, lineHeight:1.3 }}>{d.markers.map(m => `${m}${labs[m] != null ? `=${labs[m]}` : ''}`).join(' · ')}</div>
                    {active && <div style={{ fontSize:6, color:cfg.color, marginTop:2 }}>⚡ активен по данным</div>}
                  </button>;
                })}
              </div>
              {renderGroup('LV1 · базовая поддержка', cfg.core, cfg.color)}
              {renderGroup('LV2 · усиление по системе/симптомам', cfg.lv2, '#fbbf24')}
              {renderGroup('LV3 · только при показаниях/под контролем', cfg.lv3, '#f87171')}
              {systemWarnings.length > 0 && <div style={{ marginTop:8, padding:'7px 8px', borderRadius:7, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.26)', color:'#fff', fontSize:7, lineHeight:1.45, overflowWrap:'anywhere' }}>{systemWarnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}
              <div style={{ padding:'6px 8px', borderRadius:7, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#fff', fontSize:7, lineHeight:1.45, overflowWrap:'anywhere' }}>⚠ Выбранные элементы проходят дедупликацию, safety-проверку и лимит текущего уровня перед добавлением.</div>
            </div>
            <div style={{ display:'flex', gap:6, padding:'9px 14px', borderTop:'1px solid rgba(255,255,255,0.08)', background:'#16161a' }}>
              <button onClick={() => setGenericEnhancementPopup(null)} style={{ flex:1, padding:9, borderRadius:8, color:'#fff', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', cursor:'pointer' }}>Отмена</button>
              <button onClick={() => { const add = Array.from(selected).filter(id => !(finalRec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(id))); requestAddSubs(add); setGenericEnhancementPopup(null); }} style={{ flex:2, padding:9, borderRadius:8, color:'#000', background:cfg.color, border:'none', fontWeight:800, cursor:'pointer' }}>Добавить ({selected.size})</button>
            </div>
          </div>
        </div>;
      })(), document.body)}

      {/* ── Попап анализа доп. модуля (ПОРТАЛ — экранирует backdrop-filter предка) ── */}
      {stackModulePopup && ReactDOM.createPortal((() => {
        // Для articular_stack — новый попап с протоколами и выбором
        if (stackModulePopup === 'articular_stack') {
          const planIds = new Set((rec?.subs || []).map(s => canonIdLocal(s.substanceId)));
          const symptoms = state.symptoms || [];
          const labs = labSliceToValues(state.labs.fullPanel);
          const jointPain = state.oda.jointPain;
          const hasJointSymptom = symptoms.includes('joint_pain');
          const crp = labs['CRP'] || labs['HSCRP'];
          const pedJointsTier = finalRecWithResidual?.pedRisk?.jointsBoosterTier ?? 0;
          const pedJointsRisk = finalRecWithResidual?.pedRisk?.jointsRisk ?? 'none';
          const grossJointsTier = finalRecWithResidual?.pedRisk?.grossJointsTier ?? pedJointsTier;
          const jointsCoverage = finalRecWithResidual?.pedRisk?.jointsCoverage;
          const jointScore = (hasJointSymptom ? 20 : 0) + (jointPain === 'severe' ? 30 : jointPain === 'moderate' ? 15 : jointPain === 'mild' ? 5 : 0) + (crp && crp > 3 ? 15 : 0) + (pedJointsTier >= 2 ? 30 : pedJointsTier === 1 ? 10 : 0);
          const presetColor = jointScore < 20 ? '#22c55e' : jointScore < 40 ? '#f59e0b' : jointScore < 60 ? '#f97316' : '#ef4444';

          const toggleSub = (id: string) => {
            setArticularSelected(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          };
          const toggleJointSymptom = (code: string) => setJointSymptoms(prev => {
            const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next;
          });
          const jointDomainScores = JOINT_DOMAINS.map(d => ({ d, score: Math.min(10, d.symptoms.filter(s => jointSymptoms.has(s.code)).length * 3) }));
          const jointRecSet = new Set<string>();
          jointDomainScores.forEach(({ d, score }) => { if (score >= 6) d.substances.forEach(id => jointRecSet.add(id)); });
          JOINT_RECOMMENDED_HIGH.forEach(id => jointRecSet.add(id));
          JOINT_RECOMMENDED_MEDIUM.forEach(id => jointRecSet.add(id));
          const jointDomainOf = (id: string) => JOINT_DOMAINS.filter(d => d.substances.has(id));

          return (
            <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => { setStackModulePopup(null); setArticularConfirm(false); }}>
               <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, borderRadius:18, overflowWrap:'anywhere', wordBreak:'break-word', background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
                  <div style={{ height:3, background:'linear-gradient(90deg,#4ade80,#22c55e)' }} />
                 <div style={{ flex:'1 1 0%', minHeight:0, padding:'14px 14px 16px', overflowY:'auto' }}>
                  {/* Заголовок + контекст */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                   <span style={{ fontSize:13, fontWeight:800, color:'#4ade80' }}>🦴 Суставы/Связки — подбор поддержки</span>
                   <button onClick={() => { setStackModulePopup(null); setArticularConfirm(false); }} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', lineHeight:1.4, marginBottom:8, padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    {jointScore < 20 ? '🟢 Низкий риск — профилактика' : jointScore < 40 ? '🟡 Умеренный риск — базовая поддержка' : jointScore < 60 ? '🟠 Высокий риск — усиленная защита' : '🔴 Критический — максимальная защита'}
                    {hasJointSymptom ? ' · боль в суставах' : ''}{crp && crp > 3 ? ` · CRP ${crp}` : ''}
                    {pedJointsTier > 0 && <span style={{ color:'#4ade80', fontWeight:700 }}> · ⚡ PED AUTO LV{pedJointsTier} ({pedJointsRisk})</span>}
                  </div>

                  <DomainSymptomMap domains={JOINT_DOMAINS} checked={jointSymptoms} onToggle={toggleJointSymptom} />

                  {/* Пресеты-протоколы */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#4ade80', marginBottom:5 }}>📋 Быстрые протоколы</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
                    {JOINT_PRESETS.map(p => {
                      const active = articularPreset === p.id;
                      return (
                        <div key={p.id} onClick={() => {
                          if (articularPreset === p.id) {
                            setArticularPreset(null);
                            setArticularSelected(new Set());
                          } else {
                            setArticularPreset(p.id);
                            setArticularSelected(new Set(p.subs));
                          }
                        }} style={{
                          padding:'7px 8px', borderRadius:8, cursor:'pointer',
                          background: active ? `${p.color}18` : 'rgba(255,255,255,0.02)',
                          border: active ? `1.5px solid ${p.color}55` : '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ fontSize:14 }}>{p.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:9, fontWeight:700, color: active ? p.color : '#ffffff' }}>{p.name} {active && '✓'}</div>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{p.desc}</div>
                            </div>
                          </div>
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:3, display:'flex', flexWrap:'wrap', gap:2 }}>
                            {p.subs.map(sid => <span key={sid} style={{ background:'rgba(255,255,255,0.04)', padding:'1px 4px', borderRadius:3 }}>{subNameRu(sid).slice(0,10)}</span>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ⚡ PED-AUTO preset: авто-выбор по PED-risk tier */}
                  {pedJointsTier > 0 && (() => {
                    const pedAutoIds = getJointsBoosterSubstanceIds(pedJointsTier)
                      .filter(id => JOINT_CATALOG.some(c => c.id === id || canonIdLocal(c.id) === canonIdLocal(id)));
                    const pedAutoActive = pedAutoIds.length > 0 && pedAutoIds.every(id => articularSelected.has(id));
                    return (
                      <div onClick={() => {
                        if (pedAutoActive) {
                          setArticularPreset(null);
                          setArticularSelected(new Set());
                        } else {
                          setArticularPreset('ped_auto');
                          setArticularSelected(new Set(pedAutoIds));
                        }
                      }} style={{
                        padding:'7px 8px', borderRadius:8, cursor:'pointer', marginBottom:6,
                        background: pedAutoActive ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.06)',
                        border: pedAutoActive ? '1.5px solid #4ade8055' : '1.5px solid #4ade8030',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontSize:14 }}>⚡</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:9, fontWeight:700, color: pedAutoActive ? '#4ade80' : '#4ade80' }}>
                              PED AUTO — LV{grossJointsTier}{pedJointsTier !== grossJointsTier ? ` → LV${pedJointsTier}` : ''} ({pedJointsRisk}) {pedAutoActive && '✓'}
                            </div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                              Авто-выбор по стеку PED: {pedAutoIds.length} веществ
                            </div>
                          </div>
                        </div>
                        {pedAutoIds.length > 0 && (
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:3, display:'flex', flexWrap:'wrap', gap:2 }}>
                            {pedAutoIds.slice(0,6).map(sid => <span key={sid} style={{ background:'rgba(74,222,128,0.08)', padding:'1px 4px', borderRadius:3 }}>{subNameRu(sid).slice(0,12)}</span>)}
                            {pedAutoIds.length > 6 && <span style={{color:'rgba(255,255,255,0.2)'}}>+{pedAutoIds.length-6}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Рекомендация по пресету */}
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginBottom:6, padding:'4px 8px', borderRadius:6, background:presetColor+'10', border:`1px solid ${presetColor}22` }}>
                    🔍 Рекомендованный: <b style={{color:presetColor}}>
                      {jointScore < 20 ? 'Ядро' : jointScore < 40 ? 'Ядро + База' : jointScore < 60 ? 'Ядро + База + Усиление' : 'Полный протокол (все фазы)'}
                    </b>
                  </div>

                  <CalcSystemPanel
                    risk={null}
                    panel={SYSTEM_PANELS.find(p => p.id === 'oda') || null}
                    contra={finalRec?.contraindications || []}
                    note="ОДА (суставы/связки) не входит в 6 систем механизм-модели риска — контроль по маркерам и УЗИ, поддержка влияет на кардио/метаболический контур косвенно."
                  />

                  {/* Список веществ */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#ffffff', marginBottom:4 }}>💊 Выберите вещества ({articularSelected.size} из {JOINT_CATALOG.length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:8 }}>
                    {JOINT_CATALOG.map(item => {
                      const selected = articularSelected.has(item.id);
                      const inPlan = planIds.has(canonIdLocal(item.id));
                      const isRecommended = jointRecSet.has(item.id);
                      const itemDomains = jointDomainOf(item.id);
                      return (
                        <div key={item.id} onClick={() => { if (!inPlan) toggleSub(item.id); }}
                          style={{
                            display:'flex', alignItems:'flex-start', gap:6, padding:'6px 8px', borderRadius:7, cursor: inPlan ? 'default' : 'pointer',
                            background: inPlan ? 'rgba(0,230,138,0.04)' : selected ? 'rgba(129,140,248,0.06)' : 'rgba(255,255,255,0.02)',
                            border: inPlan ? '1px solid rgba(0,230,138,0.12)' : selected ? '1px solid rgba(129,140,248,0.15)' : '1px solid rgba(255,255,255,0.04)',
                            opacity: inPlan ? 0.5 : 1,
                          }}>
                          <div style={{ width:18, height:18, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
                            background: inPlan ? 'rgba(0,230,138,0.15)' : selected ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.05)',
                            fontSize:10, fontWeight:700, color: inPlan ? '#00e68a' : selected ? '#818cf8' : 'rgba(255,255,255,0.3)' }}>
                            {inPlan ? '✓' : selected ? '✓' : ''}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                              <span style={{ fontSize:9, fontWeight:600, color: inPlan ? 'rgba(255,255,255,0.4)' : '#ffffff' }}>{item.nameRu}</span>
                              <span style={{ fontSize:7, fontWeight:600, color:'rgba(255,255,255,0.4)', padding:'0px 3px', borderRadius:3, background:'rgba(255,255,255,0.04)' }}>{item.dose}</span>
                              {item.id === 'voltaren_gel' && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.18)', color:'#93c5fd', fontWeight:700 }}>🧴 местно · НЕ таблетка</span>}
                              {isRecommended && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', fontWeight:700 }}>рек.</span>}
                              {inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:700 }}>в плане</span>}
                            </div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:1 }}>{item.desc}</div>
                            {itemDomains.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                {itemDomains.map(d => (
                                  <span key={d.id} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:d.color+'18', color:d.color, fontWeight:600 }}>{d.label}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Кнопки действий */}
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setStackModulePopup(null); setArticularConfirm(false); }} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>Отмена</button>
               <button onClick={() => {
                       if (articularSelected.size === 0) return;
                       setArticularConfirm(true);
                       setStackModulePopup(null);
                     }} style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor:'pointer', border:'none', color:'#000',
                       background: articularSelected.size > 0 ? 'linear-gradient(135deg,#4ade80,#22c55e)' : 'rgba(255,255,255,0.06)',
                     }}>
                       ✅ Добавить ({articularSelected.size} веществ)
                     </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // ── Нейропротекция: пресеты + выбор ──
        if (stackModulePopup === 'neuroprotection_stack') {
          const planIds = new Set((rec?.subs || []).map(s => canonIdLocal(s.substanceId)));
          const symptoms = state.symptoms || [];
          const hasInsomnia = symptoms.includes('insomnia');
          const hasAnxiety = symptoms.includes('anxiety');
          const sleepHours = state.profile.sleepHours || 7;
          const stressLevel = state.profile.stressLevel || 5;
          const aggressionScore = state.neuro.aggressionScore || 0;
          const pedNeuroTier = finalRecWithResidual?.pedRisk?.neuroBoosterTier ?? 0;
          const pedNeuroRisk = finalRecWithResidual?.pedRisk?.neuroRisk ?? 'none';
          const grossNeuroTier = finalRecWithResidual?.pedRisk?.grossNeuroTier ?? pedNeuroTier;
          const neuroCoverage = finalRecWithResidual?.pedRisk?.neuroCoverage;
          const neuroScore = (hasInsomnia ? 20 : 0) + (hasAnxiety ? 15 : 0) + (sleepHours < 7 ? 15 : 0) + (stressLevel > 7 ? 20 : 0) + (aggressionScore > 6 ? 15 : 0) + (pedNeuroTier >= 2 ? 30 : pedNeuroTier === 1 ? 10 : 0);
          const presetColor = neuroScore < 20 ? '#22c55e' : neuroScore < 40 ? '#f59e0b' : neuroScore < 60 ? '#f97316' : '#ef4444';

          const toggleSub = (id: string) => { setNeuroSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
          const toggleNeuroSymptom = (code: string) => setNeuroSymptoms(prev => {
            const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next;
          });
          const neuroDomainScores = NEURO_DOMAINS.map(d => ({ d, score: Math.min(10, d.symptoms.filter(s => neuroSymptoms.has(s.code)).length * 3) }));
          const neuroRecSet = new Set<string>();
          neuroDomainScores.forEach(({ d, score }) => { if (score >= 6) d.substances.forEach(id => neuroRecSet.add(id)); });
          NEURO_RECOMMENDED_HIGH.forEach(id => neuroRecSet.add(id));
          NEURO_RECOMMENDED_MEDIUM.forEach(id => neuroRecSet.add(id));
          const neuroDomainOf = (id: string) => NEURO_DOMAINS.filter(d => d.substances.has(id));

          return (
            <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => { setStackModulePopup(null); setNeuroConfirm(false); }}>
               <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, borderRadius:18, overflowWrap:'anywhere', wordBreak:'break-word', background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
                  <div style={{ height:3, background:'linear-gradient(90deg,#818cf8,#6366f1)' }} />
                 <div style={{ flex:'1 1 0%', minHeight:0, padding:'14px 14px 16px', overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                   <span style={{ fontSize:13, fontWeight:800, color:'#818cf8' }}>🧠 Нейропротекция — подбор поддержки</span>
                   <button onClick={() => { setStackModulePopup(null); setNeuroConfirm(false); }} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', lineHeight:1.4, marginBottom:8, padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    {neuroScore < 20 ? '🟢 Низкий риск — профилактика' : neuroScore < 40 ? '🟡 Умеренный риск — базовая поддержка' : neuroScore < 60 ? '🟠 Высокий риск — усиленная защита' : '🔴 Критический — максимальная защита'}
                    {hasInsomnia ? ' · бессонница' : ''}{hasAnxiety ? ' · тревога' : ''}{sleepHours < 7 ? ` · сон ${sleepHours}ч` : ''}{stressLevel > 7 ? ` · стресс ${stressLevel}/10` : ''}
                    {pedNeuroTier > 0 && <span style={{ color:'#818cf8', fontWeight:700 }}> · ⚡ PED AUTO LV{pedNeuroTier} ({pedNeuroRisk})</span>}
                  </div>

                  <CalcSystemPanel risk={systemRiskOf('cns')} panel={SYSTEM_PANELS.find(p => p.id === 'cns') || null}
                    contra={finalRec?.contraindications || []} />

                  <DomainSymptomMap domains={NEURO_DOMAINS} checked={neuroSymptoms} onToggle={toggleNeuroSymptom} />

                  {/* Пресеты */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#818cf8', marginBottom:5 }}>📋 Быстрые протоколы</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
                    {NEURO_PRESETS.map(p => {
                      const active = neuroPreset === p.id;
                      return (
                        <div key={p.id} onClick={() => {
                          if (neuroPreset === p.id) { setNeuroPreset(null); setNeuroSelected(new Set()); }
                          else { setNeuroPreset(p.id); setNeuroSelected(new Set(p.subs)); }
                        }} style={{
                          padding:'7px 8px', borderRadius:8, cursor:'pointer',
                          background: active ? `${p.color}18` : 'rgba(255,255,255,0.02)',
                          border: active ? `1.5px solid ${p.color}55` : '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ fontSize:14 }}>{p.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:9, fontWeight:700, color: active ? p.color : '#ffffff' }}>{p.name} {active && '✓'}</div>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{p.desc}</div>
                            </div>
                          </div>
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:3, display:'flex', flexWrap:'wrap', gap:2 }}>
                            {p.subs.slice(0,3).map(sid => <span key={sid} style={{ background:'rgba(255,255,255,0.04)', padding:'1px 4px', borderRadius:3 }}>{subNameRu(sid).slice(0,12)}</span>)}
                            {p.subs.length > 3 && <span style={{ color:'rgba(255,255,255,0.2)' }}>+{p.subs.length-3}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 📜 Нейро-протокол (из протоколов поддержки) */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#818cf8', marginBottom:4 }}>📜 Нейро-протокол (фазы)</div>
                    {[
                      { label: 'Фаза 1 — профилактика', cond: 'любой курс ААС', color: '#22c55e', items: ['NAC 1200-2400 мг (утро+вечер)', 'Таурин 2-3 г (утро+вечер)', 'Глицин 3 г (на ночь)', 'Магний (цитрат/глицинат) 400 мг'] },
                      { label: 'Фаза 2 — усиление', cond: 'доза >500 мг/нед или >2 циклов', color: '#f59e0b', items: ['L-Теанин 200 мг', 'Ашваганда 300-600 мг (кортизол)', 'Агматин 1 г 2р/день (NMDA/NO)', 'Альфа-липоевая 300 мг (Nrf2)'] },
                      { label: 'Фаза 3 — 19-nor', cond: 'трен/нандролон/стимуляторы', color: '#f97316', items: ['Mg-L-треонат 2000 мг (сон/нейро)', 'Фосфатидилсерин 300-400 мг (HPA)', 'B12 метил 1000 мкг', 'Прегненолон 10-30 мг (осторожно с 19-nor)'] },
                      { label: 'Фаза 4 — врач', cond: 'нейролептики/высокий риск', color: '#ef4444', items: ['NMDA-альтернативы: мемантин ИЛИ ламотриджин ИЛИ амантадин — НЕ комбинировать', 'α2: гуанфацин/тизанидин — только психиатр', 'Ноопепт 10-30 мг (BDNF/NGF) — только врач'] },
                    ].map(ph => (
                      <div key={ph.label} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 4, background: ph.color + '0a', border: '1px solid ' + ph.color + '28' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 7, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: ph.color + '26', color: ph.color }}>{ph.label}</span>
                          <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.5)' }}>{ph.cond}</span>
                        </div>
                        <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginTop: 3, paddingLeft: 4 }}>
                          {ph.items.map((it, ii) => <div key={ii}>• {it}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ⚡ PED-AUTO preset: авто-выбор по PED-risk tier */}
                  {pedNeuroTier > 0 && (() => {
                    const pedAutoIds = getNeuroBoosterSubstanceIds(pedNeuroTier)
                      .filter(id => NEURO_CATALOG.some(c => c.id === id || canonIdLocal(c.id) === canonIdLocal(id)));
                    const pedAutoActive = pedAutoIds.length > 0 && pedAutoIds.every(id => neuroSelected.has(id));
                    return (
                      <div onClick={() => {
                        if (pedAutoActive) {
                          setNeuroPreset(null);
                          setNeuroSelected(new Set());
                        } else {
                          setNeuroPreset('ped_auto');
                          setNeuroSelected(new Set(pedAutoIds));
                        }
                      }} style={{
                        padding:'7px 8px', borderRadius:8, cursor:'pointer', marginBottom:6,
                        background: pedAutoActive ? 'rgba(129,140,248,0.15)' : 'rgba(129,140,248,0.06)',
                        border: pedAutoActive ? '1.5px solid #818cf855' : '1.5px solid #818cf830',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontSize:14 }}>⚡</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:9, fontWeight:700, color: pedAutoActive ? '#818cf8' : '#818cf8' }}>
                              PED AUTO — LV{grossNeuroTier}{pedNeuroTier !== grossNeuroTier ? ` → LV${pedNeuroTier}` : ''} ({pedNeuroRisk}) {pedAutoActive && '✓'}
                            </div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                              Авто-выбор по стеку PED: {pedAutoIds.length} веществ
                            </div>
                          </div>
                        </div>
                        {pedAutoIds.length > 0 && (
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:3, display:'flex', flexWrap:'wrap', gap:2 }}>
                            {pedAutoIds.slice(0,6).map(sid => <span key={sid} style={{ background:'rgba(129,140,248,0.08)', padding:'1px 4px', borderRadius:3 }}>{subNameRu(sid).slice(0,12)}</span>)}
                            {pedAutoIds.length > 6 && <span style={{color:'rgba(255,255,255,0.2)'}}>+{pedAutoIds.length-6}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginBottom:6, padding:'4px 8px', borderRadius:6, background:presetColor+'10', border:`1px solid ${presetColor}22` }}>
                    🔍 Рекомендованный: <b style={{color:presetColor}}>
                      {neuroScore < 20 ? 'Сон' : neuroScore < 40 ? 'Сон + Стресс' : neuroScore < 60 ? 'Сон + Стресс + Когнитив' : 'Полный протокол (все фазы)'}
                    </b>
                  </div>

                  {/* Вещества */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#ffffff', marginBottom:4 }}>💊 Выберите вещества ({neuroSelected.size} из {NEURO_CATALOG.length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:8 }}>
                    {NEURO_CATALOG.map(item => {
                      const selected = neuroSelected.has(item.id);
                      const inPlan = planIds.has(canonIdLocal(item.id));
                      const isRecommended = neuroRecSet.has(item.id);
                      const itemDomains = neuroDomainOf(item.id);
                      return (
                        <div key={item.id} onClick={() => { if (!inPlan) toggleSub(item.id); }}
                          style={{
                            display:'flex', alignItems:'flex-start', gap:6, padding:'6px 8px', borderRadius:7, cursor: inPlan ? 'default' : 'pointer',
                            background: inPlan ? 'rgba(0,230,138,0.04)' : selected ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
                            border: inPlan ? '1px solid rgba(0,230,138,0.12)' : selected ? '1px solid rgba(99,102,241,0.15)' : '1px solid rgba(255,255,255,0.04)',
                            opacity: inPlan ? 0.5 : 1,
                          }}>
                          <div style={{ width:18, height:18, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
                            background: inPlan ? 'rgba(0,230,138,0.15)' : selected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                            fontSize:10, fontWeight:700, color: inPlan ? '#00e68a' : selected ? '#818cf8' : 'rgba(255,255,255,0.3)' }}>
                            {inPlan ? '✓' : selected ? '✓' : ''}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                              <span style={{ fontSize:9, fontWeight:600, color: inPlan ? 'rgba(255,255,255,0.4)' : '#ffffff' }}>{item.nameRu}</span>
                              <span style={{ fontSize:7, fontWeight:600, color:'rgba(255,255,255,0.4)', padding:'0px 3px', borderRadius:3, background:'rgba(255,255,255,0.04)' }}>{item.dose}</span>
                              {item.id === 'voltaren_gel' && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.18)', color:'#93c5fd', fontWeight:700 }}>🧴 местно · НЕ таблетка</span>}
                              {isRecommended && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', fontWeight:700 }}>рек.</span>}
                              {inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:700 }}>в плане</span>}
                            </div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:1 }}>{item.desc}</div>
                            {itemDomains.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                {itemDomains.map(d => (
                                  <span key={d.id} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:d.color+'18', color:d.color, fontWeight:600 }}>{d.label}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Safety-флаг: серотонин + СИОЗС */}
                  <div style={{ fontSize:7, color:'rgba(168,85,247,0.7)', lineHeight:1.35, marginTop:6, padding:'5px 8px', borderRadius:6, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.18)' }}>
                    ⚠️ При приёме СИОЗС/СИОЗСН (антидепрессанты) избегайте 5-HTP и L-триптофан — риск серотонинового синдрома. Стимуляторы (амфетамины/модафинил): не добавляйте ночные дофаминергики.
                  </div>

                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setStackModulePopup(null); setNeuroConfirm(false); }} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>Отмена</button>
                     <button onClick={() => {
                       if (neuroSelected.size === 0) return;
                       setNeuroConfirm(true);
                       setStackModulePopup(null);
                     }} style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor:'pointer', border:'none', color:'#000',
                       background: neuroSelected.size > 0 ? 'linear-gradient(135deg,#818cf8,#6366f1)' : 'rgba(255,255,255,0.06)',
                     }}>
                        ✅ Добавить ({neuroSelected.size} веществ)
                      </button>
                   </div>
                 </div>
               </div>
             </div>
           );
        }

        // ── 🩸 HEMATO попап (по образцу Joints/Neuro) ──
        if (stackModulePopup === 'hemato_stack') {
          const pedHematoTier = finalRecWithResidual?.pedRisk?.hematoBoosterTier ?? 0;
          const pedHematoRisk = finalRecWithResidual?.pedRisk?.hematoRisk ?? 'none';
          const grossHematoTier = finalRecWithResidual?.pedRisk?.grossHematoTier ?? pedHematoTier;
          const hematoCoverage = finalRecWithResidual?.pedRisk?.hematoCoverage;
          const hematoCovered = finalRecWithResidual?.pedRisk?.hematoCovered ?? 0;
          const hematoRecommended = finalRecWithResidual?.pedRisk?.hematoRecommended ?? 0;
          const labs = labSliceToValues(state?.labs?.fullPanel);
          const hct = labs['HEMATOCRIT'] || labs['HCT'];
          const hgb = labs['HEMOGLOBIN'] || labs['HGB'];
          const plt = labs['PLT'];
          const fibrinogen = labs['FIBRINOGEN'];
          const ddimer = labs['D_DIMER'];
          // Risk score — ЕДИНЫЙ источник: механизм-модель (системный риск hematologic).
          // Локальная формула удалена (P0-2/C3): цвета/статус — от системного риска.
          const hemaSys = systemRiskOf('hematologic');
          const hematoScore = hemaSys ? Math.round(hemaSys.rawPercent) : 0;
          const riskColor = hematoScore >= 75 ? '#ef4444' : hematoScore >= 50 ? '#f97316' : hematoScore >= 25 ? '#f59e0b' : '#22c55e';
          const riskLabel = hematoScore >= 75 ? '🔴 Очень высокий' : hematoScore >= 50 ? '🔴 Высокий' : hematoScore >= 25 ? '🟠 Умеренный' : '🟢 Низкий';
          const toggleSub = (id: string) => { setHematoSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
          const toggleHematoSymptom = (code: string) => setHematoSymptoms(prev => { const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next; });
          const hematoRecSet = new Set((rec?.subs || []).map(s => canonIdLocal(s.substanceId)));
          // PED-AUTO ids
          const pedAutoIds = getHematoBoosterSubstanceIds(pedHematoTier)
            .filter(id => HEMATO_CATALOG.some(c => c.id === id || canonIdLocal(c.id) === canonIdLocal(id)));
          const pedAutoActive = pedAutoIds.length > 0 && pedAutoIds.every(id => hematoSelected.has(id));
          return ReactDOM.createPortal(
            <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setStackModulePopup(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:360, borderRadius:18, overflowWrap:'anywhere', wordBreak:'break-word', background:'#16161a', border:'1px solid rgba(20,184,166,0.2)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column', color:'#fff' }}>
                <div style={{ height:3, background:'linear-gradient(90deg,#14b8a6,#14b8a688)' }} />
                <div style={{ flex:'1 1 0%', minHeight:0, padding:'16px 14px 16px', overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'#14b8a6' }}>🩸 Кровь — гемато-защита</span>
                    <button onClick={() => setStackModulePopup(null)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                  </div>
                   <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, marginBottom:8, overflowWrap:'anywhere', wordBreak:'break-word' }}>Профилактика эритроцитоза, фибринолиз, антиагрегант, реология. Синергийные группы: натто+серра+бромелайн = 3 pathway фибринолиза.</div>

                  {/* Контекст / risk score */}
                  <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:8, background:`${riskColor}10`, border:`1px solid ${riskColor}22` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:riskColor }}>{riskLabel}</span>
                      <span style={{ fontSize:8, color:'rgba(255,255,255,0.5)' }}>Риск системы: {hematoScore}%</span>
                    </div>
                    <CalcSystemPanel
                      risk={systemRiskOf('hematologic')}
                      panel={SYSTEM_PANELS.find(p => p.id === 'hema') || null}
                      contra={finalRec?.contraindications || []}
                      groups={[
                        { label: 'эритроцитоз', icon: '🩸', color: '#14b8a6', mechs: ['hem1'] },
                        { label: 'метаболизм', icon: '🍬', color: '#f97316', mechs: ['hem2', 'hem3'] },
                        { label: 'электролиты', icon: '⚡', color: '#38bdf8', mechs: ['hem4', 'hem5'] },
                      ]}
                    />
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      {hct != null && <div>• Гематокрит: {hct}% {hct >= 57 ? '🔴 ургент' : hct >= 52 ? '🟠 терапия' : hct >= 48 ? '🟡 коррекция' : '🟢 норма'}</div>}
                      {hgb != null && <div>• Гемоглобин: {hgb} г/л {hgb > 175 ? '⚠️' : '✓'}</div>}
                      {plt != null && <div>• Тромбоциты: {plt} {plt > 400 ? '⚠️' : '✓'}</div>}
                      {fibrinogen != null && <div>• Фибриноген: {fibrinogen} г/л {fibrinogen > 4 ? '⚠️' : '✓'}</div>}
                      {ddimer != null && <div>• D-димер: {ddimer} мг/L {ddimer > 0.5 ? '⚠️' : '✓'}</div>}
                      {pedHematoTier > 0 && <div style={{ marginTop:2, color:'#14b8a6' }}>⚡ PED AUTO LV{grossHematoTier}{pedHematoTier !== grossHematoTier ? ` → LV${pedHematoTier}` : ''} ({pedHematoRisk}){hematoCoverage != null && hematoRecommended ? ` · ${hematoCovered}/${hematoRecommended}${pedHematoTier === 0 ? ' ✓' : ''}` : ''}</div>}
                    </div>
                  </div>

                  {/* Симптомы гипервязкости */}
                  <DomainSymptomMap domains={HEMATO_DOMAINS} checked={hematoSymptoms} onToggle={toggleHematoSymptom} />

                  {/* Quick protocols */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#ffffff', marginBottom:4 }}>⚡ Протоколы</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
                    {HEMATO_PRESETS.map(p => {
                      const active = hematoPreset === p.id;
                      return (
                        <button key={p.id} onClick={() => {
                          if (active) { setHematoPreset(null); setHematoSelected(new Set()); }
                          else { setHematoPreset(p.id); setHematoSelected(new Set(p.subs.filter(id => HEMATO_CATALOG.some(c => c.id === id)))); }
                        }} style={{ padding:'6px 8px', borderRadius:8, fontSize:8, fontWeight:600, cursor:'pointer', textAlign:'left',
                          background: active ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.03)',
                          border: active ? '1.5px solid #14b8a655' : '1px solid rgba(255,255,255,0.06)',
                          color: active ? '#14b8a6' : 'rgba(255,255,255,0.7)' }}>
                          <div style={{ fontWeight:700, marginBottom:1 }}>{p.name}</div>
                          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{p.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* PED-AUTO preset */}
                  {pedHematoTier > 0 && pedAutoIds.length > 0 && (
                    <div style={{ marginBottom:8 }}>
                      <button onClick={() => {
                        if (pedAutoActive) { setHematoPreset(null); setHematoSelected(new Set()); }
                        else { setHematoPreset('ped_auto'); setHematoSelected(new Set(pedAutoIds)); }
                      }} style={{ width:'100%', padding:'8px 10px', borderRadius:8, cursor:'pointer', textAlign:'left',
                        background: pedAutoActive ? 'rgba(20,184,166,0.15)' : 'rgba(20,184,166,0.06)',
                        border: pedAutoActive ? '1.5px solid #14b8a655' : '1.5px solid #14b8a630' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#14b8a6' }}>⚡ PED AUTO — LV{grossHematoTier}{pedHematoTier !== grossHematoTier ? ` → LV${pedHematoTier}` : ''} ({pedHematoRisk}) {pedAutoActive && '✓'}</div>
                        <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', marginTop:2 }}>Авто-выбор по стеку PED: {pedAutoIds.length} веществ</div>
                        {pedAutoIds.length > 0 && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4 }}>
                            {pedAutoIds.slice(0,6).map(sid => <span key={sid} style={{ background:'rgba(20,184,166,0.08)', padding:'1px 4px', borderRadius:3, fontSize:7 }}>{subNameRu(sid).slice(0,12)}</span>)}
                            {pedAutoIds.length > 6 && <span style={{color:'rgba(255,255,255,0.2)', fontSize:7}}>+{pedAutoIds.length-6}</span>}
                          </div>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Ургентный баннер при Hct>57% */}
                  {hct != null && hct > 57 && (
                    <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:8, background:'rgba(239,68,68,0.1)', border:'1.5px solid rgba(239,68,68,0.3)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#ef4444' }}>🚨 УРГЕНТ: Hct {hct}% &gt; 57%</div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.6)', marginTop:2, lineHeight:1.4 }}>
                        • <b>Эритроцитаферез</b> — первая линия (1 процедура = 3-4 кровопускания)<br/>
                        • Флеботомия 400-500 мл — fallback (если аферез недоступен)<br/>
                        • При D-димер&gt;500 или симптомах ТГВ/ТЭЛА — <b>срочная медицинская оценка</b>; антикоагулянт только по назначению врача<br/>
                        • <b>STOP AAS</b> — критично<br/>
                        • Срочная консультация гематолога
                      </div>
                    </div>
                  )}

                  {/* Substance list */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#ffffff', marginBottom:4 }}>💊 Выберите вещества ({hematoSelected.size} из {HEMATO_CATALOG.length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:10 }}>
                    {HEMATO_CATALOG.map(item => {
                      const inPlan = (rec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(item.id));
                      const checked = hematoSelected.has(item.id);
                      const isRec = hematoRecSet.has(canonIdLocal(item.id));
                      return (
                        <div key={item.id} onClick={() => { if (!inPlan) toggleSub(item.id); }}
                          style={{ padding:'6px 8px', borderRadius:6, cursor: inPlan ? 'default' : 'pointer', opacity: inPlan ? 0.5 : 1,
                            background: checked ? 'rgba(20,184,166,0.12)' : 'rgba(255,255,255,0.02)',
                            border: checked ? '1px solid rgba(20,184,166,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontSize:10, color: checked ? '#14b8a6' : 'rgba(255,255,255,0.3)' }}>{checked ? '✓' : '○'}</span>
                            <div style={{ flex:1 }}>
                              <span style={{ fontSize:9, fontWeight:600, color:'#ffffff' }}>{item.nameRu}</span>
                              <span style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginLeft:4 }}>{item.dose}</span>
                              {isRec && !inPlan && <span style={{ fontSize:6, color:'#0ea5e9', marginLeft:4, padding:'1px 3px', borderRadius:2, background:'rgba(14,165,233,0.1)' }}>рек.</span>}
                              {inPlan && <span style={{ fontSize:6, color:'#0ea5e9', marginLeft:4, padding:'1px 3px', borderRadius:2, background:'rgba(0,230,138,0.1)' }}>в плане</span>}
                            </div>
                          </div>
                          <div style={{ fontSize:7, color:'rgba(255,255,255,0.45)', marginTop:1, marginLeft:18 }}>{item.desc}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setStackModulePopup(null)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:11, fontWeight:600 }}>Отмена</button>
                    <button onClick={() => { if (hematoSelected.size > 0) { setHematoConfirm(true); setStackModulePopup(null); } }}
                      style={{ flex:2, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, color:'#000',
                        background: hematoSelected.size > 0 ? 'linear-gradient(135deg,#14b8a6,#0d9488)' : 'rgba(255,255,255,0.06)' }}>
                      ✅ Добавить ({hematoSelected.size} веществ)
                    </button>
                  </div>
                </div>
              </div>
            </div>, document.body);
        }

        // Старый попап для остальных модулей
        const { analysis, contextSummary } = analyzeStackModule(stackModulePopup, state, rec);
        const stackMeta = ALL_STACKS.find(s => s.id === stackModulePopup);
        const iconAndColor: Record<string, { icon: string; col: string }> = {
          mega_total_support_35: { icon: '🚀', col: '#f87171' },
        };
        const meta = iconAndColor[stackModulePopup] || { icon: '📦', col: '#818cf8' };
        const alreadyActive = selectedStacks.includes(stackModulePopup);
        const recommendedCount = analysis.filter(a => a.recommended && !a.inPlan).length;
        return (
           <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setStackModulePopup(null)}>
             <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:360, borderRadius:18, overflowWrap:'anywhere', wordBreak:'break-word', background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
                <div style={{ height:3, background:`linear-gradient(90deg,${meta.col},${meta.col}88)` }} />
               <div style={{ flex:'1 1 0%', minHeight:0, padding:'16px 14px 16px', overflowY:'auto' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                 <span style={{ fontSize:13, fontWeight:800, color:meta.col }}>{meta.icon} {stackMeta?.name || stackModulePopup}</span>
                 <button onClick={() => setStackModulePopup(null)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                </div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', lineHeight:1.5, marginBottom:8 }}>{stackMeta?.problem || ''}</div>
                <div style={{ fontSize:10, fontWeight:700, color:'#ffffff', marginBottom:4 }}>📊 Анализ контекста</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.5, marginBottom:10, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  {contextSummary || 'Нет активных показаний'}
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:'#ffffff', marginBottom:6 }}>💊 Вещества в модуле ({analysis.length})</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
                  {analysis.map((a, i) => (
                    <div key={i} style={{ padding:'6px 8px', borderRadius:8, fontSize:8, background: a.inPlan ? 'rgba(0,230,138,0.06)' : a.recommended ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', border:`1px solid ${a.inPlan ? 'rgba(0,230,138,0.15)' : a.recommended ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                        <span style={{ fontWeight:700, color:'#ffffff' }}>{a.subName} <span style={{ color:'rgba(255,255,255,0.4)', fontWeight:500 }}>{a.dose}</span></span>
                        <div style={{ display:'flex', gap:3 }}>
                          {a.inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:700 }}>в плане</span>}
                          {a.recommended && !a.inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', fontWeight:700 }}>рекоменд.</span>}
                          {!a.recommended && !a.inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.4)', fontWeight:700 }}>опц.</span>}
                        </div>
                      </div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>{a.contextReason}</div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:2 }}>{a.mechanism.slice(0, 80)}{a.mechanism.length > 80 ? '…' : ''}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => setStackModulePopup(null)} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>Отмена</button>
                  <button onClick={() => {
                    if (!alreadyActive) setSelectedStacks(prev => [...prev, stackModulePopup]);
                    setStackModulePopup(null);
                  }} style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor:'pointer', background: alreadyActive ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${meta.col},${meta.col}cc)`, border:'none', color: alreadyActive ? 'rgba(255,255,255,0.55)' : '#000' }}>
                    {alreadyActive ? '✓ Уже добавлен' : `Добавить модуль (${recommendedCount} рек.)`}
                  </button>
                </div>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginTop:6, textAlign:'center' }}>Модуль добавляется поверх пресета. Дубли с планом автоматически исключаются.</div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* ── Карточка подтверждения для суставного модуля ── */}
      {articularConfirm && !stackModulePopup && (
        <div style={{ marginBottom:8, padding:'10px', borderRadius:12, background:'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(22,163,74,0.04))', border:'2px solid rgba(34,197,94,0.25)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#22c55e', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
            🦴 Суставы/Связки — подтверждение
          </div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginBottom:5, lineHeight:1.3 }}>
            Выбрано <b style={{color:'#4ade80'}}>{articularSelected.size}</b> веществ:
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
            {Array.from(articularSelected).map(sid => (
              <span key={sid} style={{ fontSize:8, padding:'2px 6px', borderRadius:5, fontWeight:600, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.2)', color:'#4ade80' }}>
                {subNameRu(sid)}
              </span>
            ))}
          </div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.3 }}>
            Вещества будут добавлены в план поддержки. Дубли с уже назначенными автоматически исключаются.
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setArticularConfirm(false); setArticularPreset(null); setArticularSelected(new Set()); setStackModulePopup('articular_stack'); }}
              style={{ flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
              ✕ Отмена
            </button>
            <button onClick={() => {
              const newSubs = Array.from(articularSelected).filter(sid => !(rec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid)));
              requestAddSubs(newSubs);
              setArticularConfirm(false);
              setStackModulePopup(null);
              if (!selectedStacks.includes('articular_stack')) setSelectedStacks(prev => [...prev, 'articular_stack']);
            }} style={{ flex:2, padding:'8px', borderRadius:8, fontSize:9, fontWeight:800, cursor:'pointer', background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', color:'#000' }}>
              ✅ Подтвердить и добавить в план
            </button>
          </div>
        </div>
      )}

      {/* ── Карточка подтверждения для нейропротекторного модуля ── */}
      {neuroConfirm && !stackModulePopup && (
        <div style={{ marginBottom:8, padding:'10px', borderRadius:12, background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(79,70,229,0.04))', border:'2px solid rgba(99,102,241,0.25)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#818cf8', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
            🧠 Нейропротекция — подтверждение
          </div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginBottom:5, lineHeight:1.3 }}>
            Выбрано <b style={{color:'#a5b4fc'}}>{neuroSelected.size}</b> веществ:
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
            {Array.from(neuroSelected).map(sid => (
              <span key={sid} style={{ fontSize:8, padding:'2px 6px', borderRadius:5, fontWeight:600, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc' }}>
                {subNameRu(sid)}
              </span>
            ))}
          </div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.3 }}>
            Вещества будут добавлены в план поддержки. Дубли с уже назначенными автоматически исключаются.
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setNeuroConfirm(false); setNeuroPreset(null); setNeuroSelected(new Set()); setStackModulePopup('neuroprotection_stack'); }}
              style={{ flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
              ✕ Отмена
            </button>
            <button onClick={() => {
              const newSubs = Array.from(neuroSelected).filter(sid => !(rec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid)));
              requestAddSubs(newSubs);
              setNeuroConfirm(false);
              setStackModulePopup(null);
              if (!selectedStacks.includes('neuroprotection_stack')) setSelectedStacks(prev => [...prev, 'neuroprotection_stack']);
            }} style={{ flex:2, padding:'8px', borderRadius:8, fontSize:9, fontWeight:800, cursor:'pointer', background:'linear-gradient(135deg,#818cf8,#6366f1)', border:'none', color:'#000' }}>
              ✅ Подтвердить и добавить в план
            </button>
          </div>
        </div>
      )}

      {/* ── Карточка подтверждения для гемато-модуля ── */}
      {hematoConfirm && !stackModulePopup && (
        <div style={{ marginBottom:8, padding:'10px', borderRadius:12, background:'linear-gradient(135deg,rgba(20,184,166,0.08),rgba(13,148,136,0.04))', border:'2px solid rgba(20,184,166,0.25)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#14b8a6', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
            🩸 Кровь — подтверждение
          </div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginBottom:5, lineHeight:1.3 }}>
            Выбрано <b style={{color:'#14b8a6'}}>{hematoSelected.size}</b> веществ:
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
            {Array.from(hematoSelected).map(sid => (
              <span key={sid} style={{ fontSize:8, padding:'2px 6px', borderRadius:5, fontWeight:600, background:'rgba(20,184,166,0.12)', border:'1px solid rgba(20,184,166,0.2)', color:'#14b8a6' }}>
                {subNameRu(sid)}
              </span>
            ))}
          </div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.3 }}>
            Вещества будут добавлены в план поддержки. Дубли с уже назначенными автоматически исключаются.
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setHematoConfirm(false); setHematoPreset(null); setHematoSelected(new Set()); setStackModulePopup('hemato_stack'); }}
              style={{ flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
              ✕ Отмена
            </button>
            <button onClick={() => {
              const newSubs = Array.from(hematoSelected).filter(sid => !(rec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid)));
              requestAddSubs(newSubs);
              setHematoConfirm(false);
              setStackModulePopup(null);
              if (!selectedStacks.includes('hemato_stack')) setSelectedStacks(prev => [...prev, 'hemato_stack']);
            }} style={{ flex:2, padding:'8px', borderRadius:8, fontSize:9, fontWeight:800, cursor:'pointer', background:'linear-gradient(135deg,#14b8a6,#0d9488)', border:'none', color:'#000' }}>
              ✅ Подтвердить и добавить в план
            </button>
          </div>
        </div>
      )}

      {/* ===== КАРТОЧКА СИМПТОМОВ ===== */}
      <div style={{ margin:'6px 0', borderRadius:10, overflow:'hidden' }}>
        <div onClick={() => setShowSymptoms(!showSymptoms)} style={{ padding:'7px 9px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius: showSymptoms ? '10px 10px 0 0' : 10 }}>
          <span style={{ fontSize:9, fontWeight:700, color:'#818cf8' }}>
            🩺 Симптомы (отметьте актуальные) {symptoms.length > 0 ? `(${symptoms.length})` : ''}
          </span>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <button onClick={(e) => { e.stopPropagation(); try {
              // Маппинг ID симптомов → коды pill-кнопок калькулятора
              const symMap: Record<string,string> = {
                insomnia:'insomnia', anxiety:'anxiety', mood_swings:'mood_swings', mood_swings_mood:'mood_swings',
                joint_pain:'joint_pain', joint:'joint_pain', arthralgia:'joint_pain',
                headache:'headache', head:'headache', migraines:'headache',
                palpitations:'palpitations', tachycardia:'palpitations', heart_palpitations:'palpitations',
                acne:'acne', skin_acne:'acne',
                hair_loss:'hair_loss', alopecia:'hair_loss', hair_thinning:'hair_loss',
                gynecomastia:'gynecomastia', gyno:'gynecomastia',
                edema:'edema_severe', edema_severe:'edema_severe', swelling:'edema_severe', water_retention:'edema_severe',
                low_libido:'low_libido', libido_low:'low_libido', decreased_libido:'low_libido',
                prostate:'prostate_symptoms', prostate_symptoms:'prostate_symptoms', prostate_issues:'prostate_symptoms',
                irritability:'mood_swings', aggression:'mood_swings', anger:'mood_swings',
                sleep_problems:'insomnia', sleep_disturbance:'insomnia',
                fatigue:'mood_swings', depression:'mood_swings', low_mood:'mood_swings',
                brain_fog:'mood_swings', cognitive_issues:'mood_swings',
              };
              const active = new Set<string>();
              // Источник 1: he_profile_v2 → symptoms.recent
              try {
                const raw = localStorage.getItem('he_profile_v2');
                if (raw) { const p = JSON.parse(raw); const sym = p?.settings?.symptoms?.recent || {};
                  for (const [k, v] of Object.entries(sym)) {
                    if (v && typeof v === 'object' && (v as any).score > 0) {
                      const code = symMap[k] || symMap[k.toLowerCase()] || k;
                      active.add(code);
                    }
                  }
                }
              } catch {}
              // Источник 2: he_symptom_diary (последние 7 дней, severity > 0)
              try {
                const raw2 = localStorage.getItem('he_symptom_diary');
                if (raw2) {
                  const diary = JSON.parse(raw2); const arr = Array.isArray(diary) ? diary : [];
                  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
                  for (const day of arr) {
                    if (!day?.date) continue;
                    const d = new Date(day.date);
                    if (d < weekAgo) continue;
                    for (const e of (day.entries || [])) {
                      if (e.severity > 0 && e.symptomId) {
                        const code = symMap[e.symptomId] || symMap[e.symptomId.toLowerCase()] || e.symptomId;
                        active.add(code);
                      }
                    }
                  }
                }
              } catch {}
              setSymptoms(Array.from(active));
            } catch {} }} style={{ fontSize:7, fontWeight:700, cursor:'pointer', padding:'2px 6px', borderRadius:4, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc' }}>📋 Из профиля</button>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showSymptoms ? '▲ скрыть' : '▼ показать'}</span>
          </div>
        </div>
        {showSymptoms && (
          <div style={{ padding:'7px 9px', background:'rgba(99,102,241,0.03)', border:'1px solid rgba(99,102,241,0.1)', borderTop:'none', borderRadius:'0 0 10px 10px', display:'flex', flexWrap:'wrap', gap:3 }}>
            {([
              ['gynecomastia','Гино'],['edema_severe','Отёки'],['joint_pain','Суставы'],
              ['insomnia','Бессонница'],['anxiety','Тревога'],['low_libido','Либидо↓'],
              ['hair_loss','Выпадение волос'],['prostate_symptoms','Простата'],
              ['headache','Головная боль'],['palpitations','Сердцебиение'],
              ['acne','Акне'],['mood_swings','Настроение'],
              ] as const).map(([sym, label]) => {
              const active = symptoms.includes(sym);
              return (
                <button key={sym} onClick={() => setSymptoms(prev => active ? prev.filter(s => s !== sym) : [...prev, sym])}
                  style={{ padding:'3px 7px', borderRadius:6, fontSize:8, fontWeight:600, cursor:'pointer', border:`1px solid ${active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`, background: active ? 'rgba(99,102,241,0.15)' : 'transparent', color: active ? '#a5b4fc' : 'rgba(255,255,255,0.55)' }}>
                  {active ? '✓' : ''} {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== ФАЗА КУРСА (компактно) ===== */}
      {phaseInfo && (
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:12, background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))', border:'1px solid rgba(139,92,246,0.2)' }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#818cf8', marginBottom:2 }}>📋 Фаза: {phaseInfo.label}</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.4, marginBottom:5 }}>{phaseInfo.algorithm}</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:7, padding:'2px 6px', borderRadius:5, background:'rgba(99,102,241,0.12)', color:'#818cf8', fontWeight:600 }}>Мех: {phaseInfo.coreMechs.slice(0,3).join(', ')}</span>
            <span style={{ fontSize:7, padding:'2px 6px', borderRadius:5, background:'rgba(34,197,94,0.12)', color:'#22c55e', fontWeight:600 }}>Буст: {phaseInfo.allowBoosters ? 'да' : 'нет'}</span>
            <span style={{ fontSize:7, padding:'2px 6px', borderRadius:5, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontWeight:600 }}>Доза: ×{phaseInfo.doseTier}</span>
          </div>
        </div>
      )}

      {/* Summary */}
      {rec && (
        <div style={{ fontSize:8, fontWeight:500, color:'rgba(255,255,255,0.55)', marginBottom:6, lineHeight:1.4 }}>
          {rec.summary}
        </div>
      )}

      {/* PED-risk детали (если есть) */}
      {finalRecWithResidual?.pedRisk && (finalRecWithResidual.pedRisk.grossNeuroTier! > 0 || finalRecWithResidual.pedRisk.grossJointsTier! > 0 || finalRecWithResidual.pedRisk.grossHematoTier! > 0) && (
        <div style={{ marginBottom:6, padding:'6px 8px', borderRadius:8, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.1)' }}>
          <div style={{ fontSize:8, fontWeight:700, color:'#a5b4fc', marginBottom:3 }}>⚡ О подборе (PED-risk, gross→net)</div>
          {(() => { const pr = finalRecWithResidual.pedRisk!; const gN = pr.grossNeuroTier ?? pr.neuroBoosterTier; const gJ = pr.grossJointsTier ?? pr.jointsBoosterTier; const gH = pr.grossHematoTier ?? pr.hematoBoosterTier; return (
            <>
          {gN > 0 && (
            <div style={{ fontSize:7, color: pr.neuroBoosterTier === 0 ? '#4ade80' : '#818cf8', lineHeight:1.4, marginBottom:2 }}>
              🧠 <b>Нейрозащита LV{gN}{pr.neuroBoosterTier !== gN ? ` → LV${pr.neuroBoosterTier}` : ''}</b> — {pr.neuroRisk}
              {pr.perSubstance.filter(ps => ps.neuro === 'high' || ps.neuro === 'moderate').slice(0,3).map(ps => ` · ${ps.substanceId}`).join('')}
              {pr.neuroCoverage != null && pr.neuroRecommended && pr.neuroBoosterTier === 0 ? ` ✓ (${pr.neuroCovered}/${pr.neuroRecommended})` : pr.neuroCoverage != null && pr.neuroRecommended ? ` (${pr.neuroCovered}/${pr.neuroRecommended})` : ''}
            </div>
          )}
          {gJ > 0 && (
            <div style={{ fontSize:7, color: pr.jointsBoosterTier === 0 ? '#4ade80' : '#4ade80', lineHeight:1.4, marginBottom:2 }}>
              🦴 <b>Суставы LV{gJ}{pr.jointsBoosterTier !== gJ ? ` → LV${pr.jointsBoosterTier}` : ''}</b> — {pr.jointsRisk}
              {pr.perSubstance.filter(ps => ps.joints === 'high' || ps.joints === 'moderate').slice(0,3).map(ps => ` · ${ps.substanceId}`).join('')}
              {pr.jointsCoverage != null && pr.jointsRecommended && pr.jointsBoosterTier === 0 ? ` ✓ (${pr.jointsCovered}/${pr.jointsRecommended})` : pr.jointsCoverage != null && pr.jointsRecommended ? ` (${pr.jointsCovered}/${pr.jointsRecommended})` : ''}
            </div>
          )}
          {gH > 0 && (
            <div style={{ fontSize:7, color: pr.hematoBoosterTier === 0 ? '#4ade80' : '#14b8a6', lineHeight:1.4, marginBottom:2 }}>
              🩸 <b>Гемато LV{gH}{pr.hematoBoosterTier !== gH ? ` → LV${pr.hematoBoosterTier}` : ''}</b> — {pr.hematoRisk}
              {pr.perSubstance.filter(ps => ps.hemato === 'high' || ps.hemato === 'moderate').slice(0,3).map(ps => ` · ${ps.substanceId}`).join('')}
              {pr.hematoCoverage != null && pr.hematoRecommended && pr.hematoBoosterTier === 0 ? ` ✓ (${pr.hematoCovered}/${pr.hematoRecommended})` : pr.hematoCoverage != null && pr.hematoRecommended ? ` (${pr.hematoCovered}/${pr.hematoRecommended})` : ''}
            </div>
          )}
            </>
          ); })()}
          {finalRecWithResidual.pedRisk.triggeredBy.length > 0 && (
            <div style={{ fontSize:6, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:2 }}>
              {finalRecWithResidual.pedRisk.triggeredBy.slice(0,3).map((r,i) => <div key={i}>• {r}</div>)}
            </div>
          )}
        </div>
      )}

      {/* STOP COURSE banner (TIER 3) */}
      {rec && rec.stopCourse && (
        <div style={{ margin:'5px 0', padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.12)', border:'1.5px solid rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#ef4444', marginBottom:3 }}>⛔ ОСТАНОВИТЬ КУРС</div>
          {rec.alerts?.map((a, i) => <div key={i} style={{ fontSize:8, color:'#fca5a5', marginBottom:1, lineHeight:1.4 }}>{a.message}</div>)}
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', marginTop:3 }}>Рекомендации — для специалиста. Не заменяют консультацию врача.</div>
        </div>
      )}

      {/* TIER alerts (без stopCourse) */}
      {rec && !rec.stopCourse && rec.alerts && rec.alerts.length > 0 && (
        <div style={{ margin:'5px 0', padding:'7px 9px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)' }}>
          {rec.alerts.map((a, i) => <div key={i} style={{ fontSize:8, color:'#fbbf24', marginBottom:1, lineHeight:1.4 }}>⚠ {a.message}</div>)}
        </div>
      )}

      {/* ===== РУЧНОЙ РЕЖИМ: всегда видимый план из выбранных стеков ===== */}
      {level === 'manual' && manualResultSubs.length > 0 && (
        <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.22)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:12, fontWeight:800, color:'#c084fc' }}>📦 Ручной план: {manualResultSubs.length} препарат(ов) из {selectedStacks.length} стеков</span>
            <button onClick={() => setShowManualPopup(true)} style={{ fontSize:11, fontWeight:700, cursor:'pointer', padding:'4px 9px', borderRadius:6, background:'rgba(168,85,247,0.14)', border:'1px solid rgba(168,85,247,0.3)', color:'#c084fc' }}>⚙️ Изменить</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {manualResultSubs.map((ms) => {
              const cat = SUPPORT_CATALOG_DATA[ms.id];
              return (
                <div key={ms.id} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontWeight:600, color:'rgba(240,240,245,0.9)' }}>{cat?.nameRu || cat?.name || ms.id}</span>
                  {ms.dose && <span style={{ color:'#00e68a', marginLeft:4 }}>{ms.dose}</span>}
                  {ms.timing && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:4 }}>{ms.timing}</span>}
                  <span style={{ color:'rgba(255,255,255,0.3)', marginLeft:4, fontSize:10 }}>· {ms.stack}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== НАЗНАЧЕНИЕ (результат) ===== */}
      {finalRec && finalRec.subs.length > 0 && (
        <div>
          <div onClick={() => setShowPrescription(!showPrescription)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#ffffff', display:'flex', alignItems:'center', gap:4 }}>
              💊 План поддержки: {finalRec.subs.filter(s => !NON_DRUG_IDS.has(s.substanceId)).length} препаратов
              <span style={{ fontSize:7, color:'rgba(255,255,255,0.45)', fontWeight:500 }}>
                · база {finalRec.subs.filter(s => planItemKind(s.substanceId) === 'База').length}
                · минералы {finalRec.subs.filter(s => planItemKind(s.substanceId) === 'Минерал').length}
              </span>
              {finalRec.titrationFactors && finalRec.titrationFactors.size > 0 && (
                <span style={{ fontSize:8, fontWeight:600, color:'#f59e0b', padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.15)' }}>↑{finalRec.titrationFactors.size}</span>
              )}
            </span>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showPrescription ? '▲ скрыть' : '▼ показать'}</span>
          </div>

          {showPrescription && (
            <>
              {/* Краткий список препаратов (compact summary) — без базы курса */}
              <div style={{ marginBottom:6, padding:'6px 8px', borderRadius:8, background:'rgba(24,24,27,0.3)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.3px' }}>Список ({finalRec.subs.filter(s => !NON_DRUG_IDS.has(s.substanceId)).length}) · база курса — в карточке «Образ жизни»</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                  {finalRec.subs.filter(s => !NON_DRUG_IDS.has(s.substanceId)).map((s, i) => {
                    const doseInfo = subDosage(s.substanceId);
                    const titrF = finalRec.titrationFactors?.get(canonIdLocal(s.substanceId));
                    const mg = doseInfo ? (titrF && titrF > 1 ? Math.round(doseInfo.mg * titrF) : doseInfo.mg) : null;
                    const isTitr = !!titrF && titrF > 1;
                    return (
                      <span key={i} style={{
                        fontSize:7, padding:'2px 6px', borderRadius:5, fontWeight:600,
                        background: isTitr ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.08)',
                        border: isTitr ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(99,102,241,0.12)',
                        color: isTitr ? '#fbbf24' : '#a5b4fc',
                      }}>
                         {planItemKind(s.substanceId) === 'База' ? '🧭 ' : planItemKind(s.substanceId) === 'Минерал' ? '⚡ ' : ''}{subNameRu(s.substanceId)}{mg ? ` ${mg}мг` : ''}
                        {isDoctorControlled(s.substanceId) && <span style={{ marginLeft:3, fontSize:6, color:'#fca5a5', fontWeight:800 }}>👨⚕️</span>}
                        {isTitr && ` ↑${((titrF! - 1) * 100).toFixed(0)}%`}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* ══ МЕНЕДЖЕР ПРЕПАРАТОВ (добавить/удалить/заменить) ══ */}
              <CalcSubstanceManager
                key={substanceManagerKey}
                finalRec={finalRec}
                onApplyChanges={(newSubs) => {
                  // синхронизируем с состоянием добавления/удаления
                  const current = finalRec.subs.map(s => s.substanceId);
                  const toRemove = current.filter(id => !newSubs.includes(id));
                  const toAdd = newSubs.filter(id => !current.includes(id));
                  setRemovedSubs(toRemove);
                  requestAddSubs(toAdd);
                  setSubstanceManagerKey(prev => prev + 1);
                }}
              />

              {/* Таблеточная нагрузка — сводка плана */}
              <SafetyPillBurden planResult={planResult} />

              {/* Детальные карточки веществ — без базы курса */}
              {finalRec.subs.filter(s => !NON_DRUG_IDS.has(s.substanceId)).map((s, i) => (
                <CalcSubstanceDetail
                  key={s.substanceId + i}
                  sub={s}
                  rec={finalRecWithResidual ?? finalRec}
                  subNameRu={subNameRu}
                  subDosage={subDosage}
                  subTier={subTier}
                  titrationFactors={finalRec.titrationFactors}
                  canonIdLocal={canonIdLocal}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ===== ОБРАЗ ЖИЗНИ — база курса (не препараты) ===== */}
      {finalRec && finalRec.subs.some(s => NON_DRUG_IDS.has(s.substanceId)) && (() => {
        const lifestyleSubs = finalRec.subs.filter(s => NON_DRUG_IDS.has(s.substanceId));
        const impact = (id: string): string => {
          if (id === 'hydration') return '↓ HCT/HGB (гемодилюция), поддержка почек и АД';
          if (id === 'cardio_aerobic') return '↓ АД, липиды, гемоконцентрация; эндотелий';
          if (id === 'electrolyte_balance') return 'стабильный ритм, нервная проводимость';
          if (id === 'daily_steps') return 'NEAT: ↓ АД, липиды, реология';
          if (id === 'no_smoking') return '↓ CO-Hb, вязкость, атерогенный риск';
          if (id === 'no_alcohol') return '↓ ГГТ/ЩФ, ТГ, АД; печень и ЦНС';
          return '';
        };
        return (
          <div style={{ marginTop: 8 }}>
            <div onClick={() => setShowLifestyle(!showLifestyle)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '7px 9px', borderRadius: showLifestyle ? '8px 8px 0 0' : 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.16)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                🌿 Образ жизни — база курса
                <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(74,222,128,0.6)', padding: '1px 5px', borderRadius: 4, background: 'rgba(34,197,94,0.1)' }}>{lifestyleSubs.length} пунктов · не препараты</span>
              </span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{showLifestyle ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showLifestyle && (
              <div style={{ padding: '7px 10px', borderRadius: '0 0 8px 8px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)', borderTop: 'none' }}>
                {lifestyleSubs.map(s => {
                  const e = SUPPORT_CATALOG_DATA[s.substanceId] || SUPPORT_CATALOG_DATA[s.substanceId.toLowerCase()];
                  return (
                    <div key={s.substanceId} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{planItemKind(s.substanceId) === 'База' ? '🧭' : '⚡'} {subNameRu(s.substanceId)}</span>
                        <span style={{ fontSize: 8, color: '#4ade80', textAlign: 'right' }}>{e?.dosage?.timing || ''}</span>
                      </div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.65)', marginTop: 2, lineHeight: 1.45 }}>{e?.description || s.reason}</div>
                      <div style={{ fontSize: 7, color: '#4ade80', marginTop: 2 }}>Риск: {impact(s.substanceId)}</div>
                    </div>
                  );
                })}
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', marginTop: 5, lineHeight: 1.45 }}>
                  Участвуют в механизм-ориентированном расчёте риска (cv/ren/hem/liv) автоматически; не считаются таблетками и не увеличивают pill burden.
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== СИНЕРГИИ И ВЗАИМОДЕЙСТВИЯ ПЛАНА (объединено, единый стиль) ===== */}
      {finalRec && (() => {
        const hasSynergy = synergyDesc.length > 0 || pairSynergies.length > 0;
        const hasRisks = (finalRec.supportRisks || []).length > 0;
        const hasInteractions = (() => { try { return checkInteractions(finalRec.subs.map(s => s.substanceId)).length > 0; } catch { return false; } })();
        const hasGaps = (finalRec.gaps || []).length > 0;
        const hasConflicts = (() => {
          try {
            const pc = (planResult?.conflicts && planResult.conflicts.length > 0) ? planResult.conflicts : (finalRec.conflicts || []);
            return pc.some((c: any) => c.severity && c.severity !== 'LOW');
          } catch { return false; }
        })();
        const hasBleeding = (() => {
          const FIB = ['nattokinase', 'serrapeptase', 'bromelain', 'lumbrokinase', 'aspirin', 'dipyridamole', 'pentoxifylline', 'warfarin', 'enoxaparin', 'sulodexide', 'ginkgo', 'garlic'];
          const inPlan = new Set(finalRec.subs.map((s: any) => (s.substanceId || '').toLowerCase()));
          return FIB.filter(id => inPlan.has(id)).length >= 2;
        })();
        if (!hasSynergy && !hasRisks && !hasInteractions && !hasGaps && !hasConflicts && !hasBleeding) return null;
        // Единая палитра подсекций блока
        const sevRow = (color: string, bg: string, border: string): React.CSSProperties => ({ padding: '4px 7px', borderRadius: 5, marginBottom: 3, background: bg, border: `1px solid ${border}` });
        const subHeader: React.CSSProperties = { fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '0.3px' };
        const chip = (color: string): React.CSSProperties => ({ fontSize: 6, fontWeight: 800, color, padding: '1px 5px', borderRadius: 3, background: `${color}18` });
        return (
        <div style={{ marginTop:8 }}>
          <div onClick={() => setShowSynergy(!showSynergy)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showSynergy ? '8px 8px 0 0' : 8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.14)' }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#a78bfa', display:'flex', alignItems:'center', gap:5 }}>
              🧬 Синергии и взаимодействия плана
              {pairSynergies.length > 0 && <span style={{ fontSize:7, fontWeight:600, color:'rgba(167,139,250,0.6)', padding:'1px 5px', borderRadius:4, background:'rgba(168,85,247,0.1)' }}>{pairSynergies.length} пар</span>}
            </span>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showSynergy ? '▲ скрыть' : '▼ показать'}</span>
          </div>
          {showSynergy && (
            <div style={{ padding:'6px 10px', borderRadius:'0 0 8px 8px', background:'rgba(168,85,247,0.05)', border:'1px solid rgba(168,85,247,0.1)', borderTop:'none' }}>
              {(() => {
                const FIB = ['nattokinase', 'serrapeptase', 'bromelain', 'lumbrokinase', 'aspirin', 'dipyridamole', 'pentoxifylline', 'warfarin', 'enoxaparin', 'sulodexide', 'ginkgo', 'garlic'];
                const inPlan = new Set(finalRec.subs.map((s: any) => (s.substanceId || '').toLowerCase()));
                const hits = FIB.filter(id => inPlan.has(id));
                if (hits.length >= 2) {
                  const high = hits.length >= 3;
                  return (
                    <div style={sevRow(high ? '#f87171' : '#fbbf24', high ? 'rgba(239,68,68,0.09)' : 'rgba(245,158,11,0.07)', high ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.22)')}>
                      <b style={{ color: high ? '#f87171' : '#fbbf24' }}>🩸 Фибринолитическая/антиагрегантная нагрузка ({hits.map(id => subNameRu(id)).join(' + ')})</b>
                      <div style={{ color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>Синергия фибринолиза — да, но суммарный риск кровотечения {high ? 'ВЫСОКИЙ' : 'повышен'}: сообщить врачу перед операцией/инвазивными процедурами, не добавлять антикоагулянты самостоятельно.</div>
                    </div>
                  );
                }
                return null;
              })()}
              {(finalRec.supportRisks || []).length > 0 && (
                <div style={{ marginBottom: 5 }}>
                  <div style={subHeader}>Риски плана поддержки</div>
                  {(finalRec.supportRisks || []).map(r => (
                    <div key={r.id} style={sevRow(r.level === 'high' ? '#f87171' : r.level === 'medium' ? '#fbbf24' : '#60a5fa', r.level === 'high' ? 'rgba(239,68,68,0.09)' : r.level === 'medium' ? 'rgba(245,158,11,0.07)' : 'rgba(96,165,250,0.06)', r.level === 'high' ? 'rgba(239,68,68,0.28)' : r.level === 'medium' ? 'rgba(245,158,11,0.22)' : 'rgba(96,165,250,0.2)')}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: r.level === 'high' ? '#f87171' : r.level === 'medium' ? '#fbbf24' : '#60a5fa' }}>⚠ {r.label} {r.level === 'high' ? '(высокий)' : r.level === 'medium' ? '(повышенный)' : '(контроль)'}</div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginTop: 1 }}>{r.detail}</div>
                    </div>
                  ))}
                  <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, marginTop: 3 }}>
                    Препараты с пометкой <span style={{ color: '#fca5a5', fontWeight: 800 }}>👨‍⚕️</span> — рецептурные, принимать под обязательным контролем врача.
                  </div>
                </div>
              )}
              {synergyDesc.map((s, i) => <div key={`desc-${i}`} style={{ fontSize:8, color:'#c4b5fd', marginBottom:3, lineHeight:1.5 }}>{s}</div>)}
              {pairSynergies.length > 0 && (
                <>
                  <div style={{ fontSize:7, fontWeight:700, color:'#93c5fd', margin:'6px 0 4px', textTransform:'uppercase', letterSpacing:'0.3px' }}>Парные синергии ({pairSynergies.length})</div>
                  {pairSynergies.map((syn, i) => (
                    <div key={`pair-${i}`} style={{ padding:'4px 7px', borderRadius:5, marginBottom:3, background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.14)', width:'100%', boxSizing:'border-box' }}>
                      <div style={{ fontSize:8, color:'#bfdbfe', lineHeight:1.45 }}>
                        <b>{subNameRu(syn.a)}</b> + <b>{subNameRu(syn.b)}</b> — {syn.effect}{syn.score ? ` (+${syn.score})` : ''}
                      </div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.6)', lineHeight:1.4, marginTop:1 }}>{syn.mechanism}</div>
                    </div>
                  ))}
                </>
              )}
              {finalRec.subs.length > 1 && (() => {
                const interactions = checkInteractions(finalRec.subs.map(s => s.substanceId));
                if (interactions.length === 0) return null;
                function fmtSub(id: string): string {
                  if (id.startsWith('@')) {
                    const classLabels: Record<string, string> = {
                      '@statin': 'статины', '@raas': 'РААС-препараты (ACEi/ARB)',
                      '@antidiabetic': 'антидиабетические', '@macrolide': 'макролиды',
                      '@anticoagulant': 'антикоагулянты', '@cyp3a4_inhibitor': 'CYP3A4-ингибиторы',
                      '@cyp3a4_substrate': 'CYP3A4-субстраты', '@alpha_blocker': 'α-блокаторы',
                      '@d2_antagonist': 'D2-антагонисты', '@alcohol': 'алкоголь',
                      '@nsaid': 'НПВС', '@contrast': 'контрастные вещества',
                      '@ssri': 'СИОЗС', '@tetracycline': 'тетрациклины',
                      '@levothyroxine': 'L-тироксин',
                    };
                    return classLabels[id] || id;
                  }
                  return subNameRu(id);
                }
                const groups: Record<string, DrugInteraction[]> = { block: [], warn: [], monitor: [] };
                for (const intr of interactions) groups[intr.severity].push(intr);
                const hasBlock = groups.block.length > 0;
                const sevLabel: Record<string, string> = { block: '⛔ Запрещено', warn: '⚠ Осторожно', monitor: '🔬 Контроль' };
                const sevColor: Record<string, string> = { block: '#f87171', warn: '#fbbf24', monitor: '#60a5fa' };
                const sevBg: Record<string, string> = { block: 'rgba(239,68,68,0.09)', warn: 'rgba(245,158,11,0.07)', monitor: 'rgba(96,165,250,0.05)' };
                return (
                  <>
                    <div style={{ fontSize:7, fontWeight:700, color: hasBlock ? '#f87171' : 'rgba(255,255,255,0.5)', margin:'6px 0 4px', textTransform:'uppercase', letterSpacing:'0.3px' }}>
                      Взаимодействия ({interactions.length}){hasBlock ? ' · есть запрещённые' : ''}
                    </div>
                    {(['block', 'warn', 'monitor'] as const).map(sev => {
                      const items = groups[sev];
                      if (items.length === 0) return null;
                      return (
                        <div key={sev} style={{ padding:'4px 7px', borderRadius:5, background:sevBg[sev], border:`1px solid ${sevColor[sev]}18`, marginBottom:3 }}>
                          <div style={{ fontSize:7, fontWeight:800, color:sevColor[sev], marginBottom:2 }}>{sevLabel[sev]} ({items.length})</div>
                          {items.map((intr, i) => (
                            <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginBottom:3, lineHeight:1.4 }}>
                              <div style={{ fontWeight:700, marginBottom:1 }}>
                                <span style={{ fontSize:8, marginRight:2 }}>{sev === 'block' ? '⛔' : sev === 'warn' ? '⚠' : '🔬'}</span>
                                <span style={{ color:'#fff' }}>{fmtSub(intr.a)}</span>
                                <span style={{ opacity:0.5, margin:'0 3px' }}>+</span>
                                <span style={{ color:'#fff' }}>{fmtSub(intr.b)}</span>
                              </div>
                              <div style={{ opacity:0.75 }}><span style={{ fontWeight:600, opacity:0.6 }}>Механизм: </span>{intr.reason}</div>
                              <div style={{ fontSize:6, opacity:0.6 }}><span style={{ fontWeight:600 }}>Действие: </span>{intr.action}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
              <SafetyGaps rec={finalRecWithResidual ?? finalRec} />
              <SafetyConflicts rec={finalRecWithResidual ?? finalRec} planResult={planResult} />
            </div>
          )}
        </div>
        );
      })()}

      {/* ===== МОНИТОРИНГ АНАЛИЗОВ (врачебный протокол) ===== */}
      {finalRec && finalRec.subs.length > 0 && (() => {
        const subs = finalRec.subs;
        const hasHepatic = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('liv')));
        const hasCardio = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('cv')));
        const hasRenal = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('ren')));
        const hasHemat = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('hem')));
        const hasCns = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('cns')));
        const hasRepro = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('rep')));

        // ── Персональный список маркеров, привязанный к конкретным веществам плана ──
        const personalMarkers = (() => {
          const map: Record<string, { what: string; when: string; target: string; subs: string[] }> = {};
          for (const s of subs) {
            const cat = SUPPORT_CATALOG_DATA[s.substanceId];
            if (!cat?.monitoring) continue;
            for (const m of cat.monitoring) {
              const key = (m.what || '').trim().toLowerCase();
              if (!key) continue;
              if (!map[key]) map[key] = { what: m.what, when: m.when || '', target: m.targetRange || '', subs: [] };
              const nm = cat.nameRu || cat.name || s.substanceId;
              if (!map[key].subs.includes(nm)) map[key].subs.push(nm);
            }
          }
          return Object.values(map).sort((a, b) => b.subs.length - a.subs.length);
        })();

        // ── Ведущие вещества по каждой системе (привязка панелей к плану) ──
        const driversBySystem: Record<string, string[]> = {
          hep: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('liv'))).map(s => subNameRu(s.substanceId)),
          cardio: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('cv'))).map(s => subNameRu(s.substanceId)),
          renal: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('ren'))).map(s => subNameRu(s.substanceId)),
          hema: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('hem'))).map(s => subNameRu(s.substanceId)),
          horm: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('rep'))).map(s => subNameRu(s.substanceId)),
          meta: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('hem') || m.startsWith('cv'))).map(s => subNameRu(s.substanceId)),
          thy: subs.filter(s => ['selenium', 'iodine', 't3', 't4'].includes(s.substanceId)).map(s => subNameRu(s.substanceId)),
          vit: subs.map(s => subNameRu(s.substanceId)),
        };

        return (
          <div style={{ marginTop:6 }}>
            <div onClick={() => setShowMonitoring(!showMonitoring)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showMonitoring ? '8px 8px 0 0' : 8, background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)' }}>
              <span style={{ fontSize:10, fontWeight:700, color:'#60a5fa', display:'flex', alignItems:'center', gap:5 }}>
                🩻 Мониторинг анализов и показателей
                <span style={{ fontSize:7, fontWeight:600, color:'rgba(96,165,250,0.5)', padding:'1px 5px', borderRadius:4, background:'rgba(96,165,250,0.1)' }}>врачебный протокол</span>
              </span>
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showMonitoring ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showMonitoring && (
              <div style={{ padding:'8px 9px', background:'rgba(96,165,250,0.03)', border:'1px solid rgba(96,165,250,0.1)', borderTop:'none', borderRadius:'0 0 8px 8px' }}>
                {/* ── Витальные показатели (ежедневно) ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#93c5fd', marginBottom:3 }}>📊 Витальные показатели (ежедневно)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#f87171', marginBottom:1 }}>❤️ АД (утром, покой)</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>Цель: &lt;130/85 (идеал &lt;120/80)<br/>При ↑ &gt;140/90 — коррекция</div>
                    </div>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#fbbf24', marginBottom:1 }}>💓 ЧСС (утром, покой)</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>Цель: 60–80 уд/мин<br/>Тахикардия &gt;90 — ЭКГ, коррекция</div>
                    </div>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#4ade80', marginBottom:1 }}>⚖️ Вес (еженедельно)</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>Контроль задержки воды<br/>↑ &gt;2 кг/нед — отёки, Na⁺</div>
                    </div>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#a78bfa', marginBottom:1 }}>🌡️ Температура</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>При симптомах — инфекция<br/>↑ на фоне ААС — риск абсцесса</div>
                    </div>
                  </div>
                </div>

                {/* ── Лабораторный мониторинг ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#60a5fa', marginBottom:3 }}>🧪 Лабораторный мониторинг</div>

                  {/* Текущие показатели из анализов пользователя */}
                  {(() => {
                    const labsValues = labSliceToValues(state.labs.fullPanel);
                    const hasLabs = Object.keys(labsValues).length > 0;
                    if (hasLabs) {
                      return (
                        <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.12)', marginBottom:4 }}>
                          <div style={{ fontSize:7, fontWeight:700, color:'#93c5fd', marginBottom:2 }}>🔬 Текущие показатели ({Object.keys(labsValues).length})</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                            {Object.entries(labsValues).sort((a, b) => a[0].localeCompare(b[0])).map(([mk, val]) => (
                              <span key={mk} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.2)', color:'#fff' }}>{mk}: {val}</span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', marginBottom:4, fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.5 }}>
                        ⚠ Анализы не введены: график построен по фармакологии и фазе, но фактический уровень рисков не подтверждён. Введите анализы для персональной оценки.
                      </div>
                    );
                  })()}

                  {/* Полный структурированный график: до курса → ежедневно → 2/4/8 нед → после → экстренно */}
                  {(finalRec.monitoringSchedule || []).map(sec => (
                    <div key={sec.id} style={{ padding:'5px 7px', borderRadius:6, background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.1)', marginBottom:4 }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#93c5fd', marginBottom:2 }}>{sec.icon} {sec.label} <span style={{ color:'#60a5fa', fontWeight:600 }}>· {sec.period}</span></div>
                      {sec.items.map((it, i) => (
                        <div key={i} style={{ fontSize:6, color:'rgba(255,255,255,0.65)', lineHeight:1.55, paddingLeft:6, borderLeft:'2px solid rgba(96,165,250,0.25)', marginBottom:3 }}>
                          <b style={{ color:'#e2e8f0' }}>{it.marker}</b> — {it.reason}
                          {it.target && <span style={{ color:'#4ade80' }}> · 🎯 {it.target}</span>}
                          {it.drug && <span style={{ color:'rgba(255,255,255,0.5)' }}> · 💊 {subNameRu(it.drug)}</span>}
                          {it.escalation && <div style={{ color: '#fca5a5' }}>⚠ {it.escalation}</div>}
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Персональный список маркеров (привязка к веществам плана) */}
                  <div style={{ padding:'6px 7px', borderRadius:6, background:'rgba(96,165,250,0.10)', border:'1px solid rgba(96,165,250,0.18)', marginBottom:4 }}>
                    <div style={{ fontSize:7, fontWeight:700, color:'#93c5fd', marginBottom:3 }}>🎯 Персональные маркеры ({personalMarkers.length}) — по вашему плану из {subs.length} веществ</div>
                    {personalMarkers.length === 0 && (
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>Для назначенных веществ не заданы специфические маркеры мониторинга — см. базовые панели ниже.</div>
                    )}
                    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      {personalMarkers.map((m, mi) => (
                        <div key={mi} style={{ padding:'4px 6px', borderRadius:5, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize:7, fontWeight:700, color:'#bfdbfe', marginBottom:1 }}>{m.what}</div>
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.55)', lineHeight:1.4 }}>
                            <span style={{ color:'#94a3b8', fontWeight:600 }}>Когда:</span> {m.when || '—'}
                            {m.target ? <> · <span style={{ color:'#94a3b8', fontWeight:600 }}>Цель:</span> {m.target}</> : null}
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                            {m.subs.map((sn, si) => (
                              <span key={si} style={{ fontSize:6, color:'#e2e8f0', padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.14)', border:'1px solid rgba(96,165,250,0.22)' }}>{sn}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  </div>

                  {/* ── Панели по системам (с привязкой к веществам) ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#ffffff', marginBottom:4 }}>📋 Системные панели ({subs.length} веществ в плане)</div>

                  {SYSTEM_PANELS.map(panel => {
                    const drivers = driversBySystem[panel.id] || [];
                    const isActive = panel.id === 'hep' ? hasHepatic : panel.id === 'cardio' ? hasCardio : panel.id === 'renal' ? hasRenal : panel.id === 'hema' ? hasHemat : panel.id === 'horm' ? (hasRepro || subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('rep') || m.startsWith('hem')))) : panel.id === 'meta' ? (hasHemat || hasCardio) : panel.id === 'thy' ? subs.some(s => ['selenium', 'iodine', 't3', 't4'].includes(s.substanceId)) : panel.id === 'oda' ? subs.some(s => ['collagen', 'glucosamine', 'chondroitin', 'msm', 'bpc157', 'tb500', 'ghk_cu'].includes(s.substanceId)) : true;
                    return (
                    <div key={panel.id} style={{ padding:'5px 7px', borderRadius:6, marginBottom:3, background: isActive ? `${panel.color}08` : 'rgba(255,255,255,0.01)', border:`1px solid ${isActive ? panel.color+'18' : 'rgba(255,255,255,0.04)'}`, opacity: isActive ? 1 : 0.6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                        <span style={{ fontSize:11 }}>{panel.icon}</span>
                        <span style={{ fontSize:8, fontWeight:700, color: isActive ? panel.color : 'rgba(255,255,255,0.55)' }}>{panel.name}</span>
                        {!isActive && <span style={{ fontSize:6, color:'rgba(255,255,255,0.3)', padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.04)' }}>плановая</span>}
                      </div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.5, marginLeft:16 }}>
                        <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>Маркеры:</span> {panel.markers}<br/>
                        <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>Частота:</span> {panel.freq}<br/>
                        <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>Цели:</span> {panel.targets}
                        {isActive && <><br/><span style={{ fontWeight:600, color:panel.color }}>⚠ Тревога:</span> <span style={{ color:panel.color, opacity:0.85 }}>{panel.alert}</span></>}
                      </div>
                      {isActive && drivers.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:3, marginLeft:16 }}>
                          <span style={{ fontSize:6, color:'rgba(255,255,255,0.4)' }}>вещества плана: </span>
                          {drivers.map((dn, di) => (
                            <span key={di} style={{ fontSize:6, color:'#e2e8f0', padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>{dn}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* ── Инструментальный мониторинг ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#a78bfa', marginBottom:3 }}>🖥️ Инструментальный мониторинг</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>ЭКГ</span><br/>Исходно + каждые 6 мес<br/>QTc, гипертрофия ЛЖ
                    </div>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>ЭхоКГ</span><br/>Ежегодно (GH/ААС &gt;1 года)<br/>ГЛЖ, ФВ, клапаны
                    </div>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>УЗИ печени</span><br/>Каждые 6 мес<br/>Стеатоз, фиброз, размер
                    </div>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>УЗИ почек</span><br/>Ежегодно<br/>Размер, паренхима, ЧЛС
                    </div>
                  </div>
                </div>

                {/* ── Дневник самоконтроля ── */}
                <div style={{ marginBottom:4 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#fbbf24', marginBottom:3 }}>📝 Дневник самоконтроля (ежедневно)</div>
                  <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.1)' }}>
                    <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.8 }}>
                      {[
                         ['❤️', 'АД утром (сист/диаст) + пульс'],
                         ['😴', 'Качество сна (1–5) + часы'],
                         ['😤', 'Настроение/агрессия (1–5)'],
                         ['🔥', 'Либидо (1–5)'],
                         ['⚖️', 'Вес утром (еженедельно)'],
                         ['💪', 'Отёки голеней/лица (да/нет)'],
                         ['🩺', 'Гинекомастия (нет / чувств. / уплотнение)'],
                         ['🧠', 'Головные боли / шум в ушах'],
                         ['🩸', 'Покраснение лица/кожи (плетора — признак ↑Hct)'],
                         ['💧', 'Гидратация: мл выпито / цвет мочи (тёмная = дегидратация)'],
                       ].map(([icon, text], i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ width:16, textAlign:'center', flexShrink:0 }}>{icon}</span>
                          <span>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Экстренные показания ── */}
                <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ fontSize:7, fontWeight:700, color:'#fca5a5', marginBottom:2 }}>🚨 Немедленно обратиться к врачу:</div>
                  <div style={{ fontSize:6, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
                    • АД &gt;160/100 на фоне покоя<br/>
                    • ЧСС &gt;120 в покое / аритмия<br/>
                    • Боль в груди / одышка / кровохарканье (ТЭЛА!)<br/>
                    • Боль/отёк/покраснение одной ноги (ТГВ!)<br/>
                    • Желтуха (пожелтение кожи/склер)<br/>
                    • Отёки лица/голеней + олигурия (&lt;500 мл/сут)<br/>
                    • Сильная головная боль + нарушение зрения (Hct↑ → гипервязкость)<br/>
                    • Покраснение лица + головокружение + одышка (плетора — Hct возможно &gt;54%)<br/>
                    • Судороги / потеря сознания<br/>
                    • Температура &gt;38.5°C + боль в месте инъекции (абсцесс)
                  </div>
                </div>

                {/* Лабораторные находки + интерпретация + тревоги — единый блок анализов */}
                <SafetyLabFindings planResult={planResult} />
                <SafetyAssayWarnings rec={finalRecWithResidual ?? finalRec} />
                <SafetyAlerts rec={finalRecWithResidual ?? finalRec} />

                {/* ===== ПРЕАНАЛИТИКА, ПРИЁМ И РАЗНЕСЕНИЕ (полная карточка, сворачиваемая) ===== */}
      {finalRec && (() => {
        const planIds = finalRec.subs.map(s => s.substanceId);
        const idSet = new Set(planIds.map(id => id.toLowerCase()));
        const interferences = ASSAY_INTERFERENCE_DB.filter(e => idSet.has(e.substanceId));
        const adminRules = getAdministrationRules(planIds);
        const mineralPairs: string[] = [];
        for (const [pair, hours] of Object.entries(MINERAL_SEPARATION_HOURS)) {
          const [a, b] = pair.split('||');
          if (idSet.has(a) && idSet.has(b)) mineralPairs.push(`${subNameRu(a)} + ${subNameRu(b)} → разнести на ${hours} ч`);
        }
        const sepRules = findSeparationRules(planIds);
        const total = interferences.length + adminRules.length + mineralPairs.length + sepRules.length;
        if (total === 0) return null;
        const rowStyle: React.CSSProperties = { padding: '4px 7px', borderRadius: 5, marginBottom: 3, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.16)', fontSize: 7, lineHeight: 1.45, color: 'rgba(255,255,255,0.8)' };
        return (
          <div style={{ marginTop: 8 }}>
            <div onClick={() => setShowPreanalytics(!showPreanalytics)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '7px 9px', borderRadius: showPreanalytics ? '8px 8px 0 0' : 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.16)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 5 }}>
                🧪 Преаналитика, приём и разнесение
                <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(96,165,250,0.6)', padding: '1px 5px', borderRadius: 4, background: 'rgba(96,165,250,0.12)' }}>{total} пунктов</span>
              </span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{showPreanalytics ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showPreanalytics && (
              <div style={{ padding: '7px 10px', borderRadius: '0 0 8px 8px', background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.1)', borderTop: 'none' }}>
                <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '4px 0', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Преаналитические факторы (полный список)</div>
                {PREANALYTIC_EFFECTS_DB.map(f => (
                  <div key={f.factor} style={rowStyle}>
                    <b style={{ color: '#93c5fd' }}>{f.factor}</b> — {f.marker}: {f.effect}. <span style={{ color: '#bfdbfe' }}>{f.advice}</span>
                  </div>
                ))}
                {interferences.length > 0 && (
                  <>
                    <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Интерференции вашего плана</div>
                    {interferences.map((e, i) => (
                      <div key={`int-${i}`} style={rowStyle}>
                        <b style={{ color: '#fca5a5' }}>{e.substanceId}</b>: {e.marker} — {e.effect === 'distorts' ? 'искажает assay' : e.effect === 'increases' ? 'может повышать' : 'может снижать'} ({e.mechanism}). <span style={{ color: '#bfdbfe' }}>{e.advice}</span>
                      </div>
                    ))}
                  </>
                )}
                {adminRules.length > 0 && (
                  <>
                    <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>💊 Особые указания по приёму</div>
                    {adminRules.map((r, i) => (
                      <div key={`adm-${r.substanceId}-${i}`} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 4, background: r.critical ? 'rgba(248,113,113,0.07)' : 'rgba(34,197,94,0.04)', border: `1px solid ${r.critical ? 'rgba(248,113,113,0.24)' : 'rgba(34,197,94,0.14)'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <span style={{ fontSize: 8, fontWeight: 800, color: '#fff' }}>{subNameRu(r.substanceId)}</span>
                          {r.critical && <span style={{ fontSize: 6, fontWeight: 700, color: '#fca5a5', padding: '1px 4px', borderRadius: 3, background: 'rgba(248,113,113,0.18)' }}>критично</span>}
                        </div>
                        <div style={{ fontSize: 7, color: '#4ade80', fontWeight: 600, lineHeight: 1.4 }}>⏱ {r.timing}</div>
                        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45, marginTop: 1 }}>{r.reason}</div>
                      </div>
                    ))}
                  </>
                )}
                {(mineralPairs.length > 0 || sepRules.length > 0) && (
                  <>
                    <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>⏱ Разнесение приёма по времени (усвоение и конфликты)</div>
                    {mineralPairs.map((p, i) => (
                      <div key={`min-${i}`} style={{ ...rowStyle, color: '#fbbf24' }}>⏱ {p}</div>
                    ))}
                    {sepRules.map((r, i) => (
                      <div key={`sep-${i}`} style={{ ...rowStyle, color: '#fbbf24' }}>
                        ⏱ {subNameRu(r.a)} + {subNameRu(r.b)} → разнести на {r.gap} ({r.reason})
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Warnings: multi-oral, GH+insulin, winny+oxy */}
      {finalRec && (() => {
        const warnings: string[] = [];
        const flags = finalRec.pedFlags;
        if (flags) {
          if (flags.isMultiOral) warnings.push('⚠ Более 1 орального 17α — резко ↑ гепатотоксичность');
          if (flags.isGHPlusInsulin) warnings.push('⚠ GH + Инсулин — высокий риск гипогликемии');
          if (flags.isWinnyPlusOxy) warnings.push('🛑 WINSTROL + ANADROL — критическая комбинация (гепатотоксичность + ↓HDL до 50%). ОБЯЗАТЕЛЬНЫЙ протокол защиты включён. LFT каждые 2 нед, не дольше 4 нед');
          if (flags.has17AlphaAndGH) warnings.push('⚠ 17α-Орал + GH — синергичная гепатотоксичность');
        }
        if (warnings.length === 0) return null;
        return (
          <div style={{ marginTop: 8 }}>
            <div onClick={() => setShowCourseWarnings(!showCourseWarnings)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '7px 9px', borderRadius: showCourseWarnings ? '8px 8px 0 0' : 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.16)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', display: 'flex', alignItems: 'center', gap: 5 }}>
                ⚠️ Предупреждения о курсе
                <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(168,85,247,0.6)', padding: '1px 5px', borderRadius: 4, background: 'rgba(168,85,247,0.12)' }}>{warnings.length}</span>
              </span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{showCourseWarnings ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showCourseWarnings && (
              <div style={{ padding: '7px 10px', borderRadius: '0 0 8px 8px', background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)', borderTop: 'none' }}>
                {warnings.map((w, i) => <div key={i} style={{ fontSize: 8, color: '#c4b5fd', marginBottom: 1, lineHeight: 1.4 }}>{w}</div>)}
                <SafetyGuardrails rec={finalRecWithResidual ?? finalRec} />
                <SafetyPedEscalation rec={finalRecWithResidual ?? finalRec} />
              </div>
            )}
          </div>
        );
      })()}

      
{/* ===== ФАРМ-МАТРИЦА КУРСА (активные классы PED) ===== */}
      {(() => {
        const active = detectActivePedClasses(state);
        if (active.length === 0) return null;
        const rowStyle: React.CSSProperties = { padding: '5px 7px', borderRadius: 6, marginBottom: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 7, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' };
        const lbl = (t: string) => <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{t}: </span>;
        return (
          <div style={{ marginTop: 8 }}>
            <div onClick={() => setShowPedMatrix(!showPedMatrix)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '7px 9px', borderRadius: showPedMatrix ? '8px 8px 0 0' : 8, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.16)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
                🧪 Фарм-матрица курса
                <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(251,191,36,0.6)', padding: '1px 5px', borderRadius: 4, background: 'rgba(251,191,36,0.12)' }}>{active.length} классов</span>
              </span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{showPedMatrix ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showPedMatrix && (
              <div style={{ padding: '7px 10px', borderRadius: '0 0 8px 8px', background: 'rgba(251,191,36,0.03)', border: '1px solid rgba(251,191,36,0.1)', borderTop: 'none' }}>
                {active.map(cls => (
                  <div key={cls.id} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 8, fontWeight: 800, color: '#fbbf24', marginBottom: 3 }}>{cls.icon} {cls.name} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>· фаза: {cls.phase}</span></div>
                    <div style={rowStyle}>{lbl('Механизмы')}{cls.mechs.join(', ')}</div>
                    <div style={rowStyle}>{lbl('Анализы')}{cls.labs.join(', ')} <span style={{ color: 'rgba(255,255,255,0.45)' }}>({cls.freq})</span></div>
                    <div style={{ ...rowStyle, color: '#4ade80' }}>{lbl('Обязательная поддержка')}{cls.mandatory.join(', ')}</div>
                    {cls.conditional.length > 0 && <div style={{ ...rowStyle, color: '#fbbf24' }}>{lbl('Условная')}{cls.conditional.join(', ')}</div>}
                    {cls.doctorOnly.length > 0 && <div style={{ ...rowStyle, color: '#fca5a5' }}>{lbl('👨‍⚕️ Под контролем врача')}{cls.doctorOnly.join(', ')}</div>}
                    {cls.interactions.length > 0 && <div style={rowStyle}>{lbl('Взаимодействия')}{cls.interactions.join(' · ')}</div>}
                    {cls.assayWarnings.length > 0 && <div style={{ ...rowStyle, color: '#93c5fd' }}>{lbl('Анализы: внимание')}{cls.assayWarnings.join(' · ')}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      
{/* Нутри-корректировки по анализам */}
      {finalRec && finalRec.nutritionTips && finalRec.nutritionTips.length > 0 && (() => {
        const tipsByMarker: Record<string, { action: string; target: string; tier: number }[]> = {};
        for (const t of finalRec.nutritionTips!) {
          const m = (t as any).marker || 'общее';
          if (!tipsByMarker[m]) tipsByMarker[m] = [];
          tipsByMarker[m].push({ action: t.action, target: t.target, tier: (t as any).tier || 1 });
        }
        const markers = Object.keys(tipsByMarker);
        const total = finalRec.nutritionTips.length;
        const hasHigh = finalRec.nutritionTips.some((t: any) => t.tier >= 2);

        return (
        <div style={{ marginTop:6 }}>
          <div onClick={() => setShowNutrition(!showNutrition)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showNutrition ? '8px 8px 0 0' : 8, background: hasHigh ? 'rgba(245,158,11,0.06)' : 'rgba(0,230,138,0.04)', border:'1px solid ' + (hasHigh ? 'rgba(245,158,11,0.15)' : 'rgba(0,230,138,0.12)') }}>
            <span style={{ fontSize:10, fontWeight:700, color: hasHigh ? '#f59e0b' : '#22c55e', display:'flex', alignItems:'center', gap:5 }}>
              🥗 Питание по анализам ({total})
              {hasHigh && <span style={{ fontSize:7, fontWeight:600, color:'#f59e0b', padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.12)' }}>требует коррекции</span>}
            </span>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showNutrition ? '▲ скрыть' : '▼ показать'}</span>
          </div>
          {showNutrition && (
            <div style={{ padding:'6px 9px', background:'rgba(0,0,0,0.15)', border:'1px solid ' + (hasHigh ? 'rgba(245,158,11,0.1)' : 'rgba(0,230,138,0.08)'), borderTop:'none', borderRadius:'0 0 8px 8px' }}>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:5, lineHeight:1.4 }}>
                Рекомендации по питанию на основе отклонений лабораторных маркеров. Сгруппированы по показателю.
              </div>
              {markers.map(marker => {
                const tips = tipsByMarker[marker];
                const maxTier = Math.max(...tips.map(t => t.tier));
                const tierColor = maxTier >= 3 ? '#ef4444' : maxTier >= 2 ? '#f59e0b' : '#22c55e';
                const tierBg = maxTier >= 3 ? 'rgba(239,68,68,0.06)' : maxTier >= 2 ? 'rgba(245,158,11,0.05)' : 'rgba(34,197,94,0.04)';
                const tierBorder = maxTier >= 3 ? 'rgba(239,68,68,0.12)' : maxTier >= 2 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.08)';
                const tierLabel = maxTier >= 3 ? '⛔ Критично' : maxTier >= 2 ? '⚠ Требует внимания' : '🟢 Профилактика';
                return (
                  <div key={marker} style={{ marginBottom:5, padding:'5px 7px', borderRadius:6, background:tierBg, border:`1px solid ${tierBorder}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                      <span style={{ fontSize:8, fontWeight:700, color:'#ffffff' }}>{marker.toUpperCase()}</span>
                      <span style={{ fontSize:7, fontWeight:600, color:tierColor, padding:'1px 4px', borderRadius:3, background:`${tierColor}15` }}>{tierLabel}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      {tips.map((t, i) => (
                        <div key={i} style={{ fontSize:8, color:'rgba(240,240,245,0.9)', lineHeight:1.4, display:'flex', gap:4 }}>
                          <span style={{ color:tierColor, flexShrink:0, fontWeight:700 }}>{maxTier >= 2 ? '⚠' : '•'}</span>
                          <span>
                            <span style={{ fontWeight:600, color:'#ffffff' }}>{t.action}</span>
                            <span style={{ opacity:0.6, marginLeft:4 }}>→ {t.target}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
              })}
            </div>
          )}
        </div>
        );
      })()}

      {/* ===== МЕДИЦИНСКАЯ ЭСКАЛАЦИЯ (процедуры, только врач) ===== */}
      <SafetyProcedures rec={finalRecWithResidual ?? finalRec} />

      {/* ===== ИНЪЕКЦИИ: РОТАЦИЯ И ТЕХНИКА ===== */}
      <SafetyInjections rec={finalRecWithResidual ?? finalRec} />

      {/* ===== ОСОБЫЕ УКАЗАНИЯ БУСТЕРОВ (PED-risk + LV3) ===== */}
                {finalRec.boosters && finalRec.boosters.length > 0 && (() => {
                  const boosterInstructions: { booster: string; tier: number; instructions: string[] }[] = [];
                  for (const b of finalRec.boosters) {
                    if (b.key === 'neuro' && (b.tier ?? 0) >= 2) {
                      const instr: string[] = [];
                      if ((b.tier ?? 0) >= 3) {
                        instr.push('⚡ LV3: селективные NMDA-антагонисты (memantine ИЛИ lamotrigine ИЛИ amantadine — не комбинировать)');
                        instr.push('⚡ LV3: рецептурные препараты — под обязательным контролем врача (психиатр/невролог)');
                        instr.push('⚡ LV3: титрация — мемантин 5 мг/нед → 20 мг, ламотриджин 25 мг → +25 мг каждые 2 нед');
                      }
                      if ((b.tier ?? 0) >= 2) {
                        instr.push('LV2: прегненолон 10-30 мг — осторожно с прогестогенными ААС (нандролон)');
                      }
                      if (instr.length > 0) boosterInstructions.push({ booster: '🧠 Нейропротекция', tier: b.tier ?? 0, instructions: instr });
                    }
                    if (b.key === 'joints' && (b.tier ?? 0) >= 2) {
                      const instr: string[] = [];
                      if ((b.tier ?? 0) >= 3) {
                        instr.push('⚡ LV3: BPC-157+TB-500+GHK-Cu — 6-недельный протокол (Суставы.txt)');
                        instr.push('⚡ LV3: пептиды — исследовательские, только под ортопедом');
                        instr.push('⚡ LV3: стерильные шприцы/инсулинки, бактериостатическая вода');
                        instr.push('⚡ LV3: контроль УЗИ на 14-й и 28-й день');
                      }
                      if ((b.tier ?? 0) >= 2) {
                        instr.push('LV2: voltaren_gel — только местно, 2-3р/день, не на открытые раны');
                      }
                      if (instr.length > 0) boosterInstructions.push({ booster: '🦴 Суставы', tier: b.tier ?? 0, instructions: instr });
                    }
                  }
                  if (boosterInstructions.length === 0) return null;
                  return (
                    <div style={{ marginTop:6, padding:'6px 8px', borderRadius:8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
                      <div style={{ fontSize:8, fontWeight:700, color:'#c084fc', marginBottom:4 }}>📋 Особые указания бустеров</div>
                      {boosterInstructions.map((bi, i) => (
                        <div key={i} style={{ marginBottom:4 }}>
                          <div style={{ fontSize:7, fontWeight:700, color:'#a5b4fc' }}>{bi.booster} (LV{bi.tier})</div>
                          {bi.instructions.map((inst, j) => (
                            <div key={j} style={{ fontSize:6, color:'rgba(255,255,255,0.55)', lineHeight:1.4, marginLeft:8, marginBottom:1 }}>• {inst}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>
            )}
          </div>
        );
      })()}

      
{/* ===== ТОКСИКОЛОГИЧЕСКИЙ КОНТРОЛЬ ДОЗ (UL + титрация) ===== */}
      {finalRec && toxWarnings.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div onClick={() => setShowDosageControl(!showDosageControl)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '7px 9px', borderRadius: showDosageControl ? '8px 8px 0 0' : 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.16)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
              ⚠️ Контроль дозировок (UL + титрация)
              <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(245,158,11,0.6)', padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,0.12)' }}>{toxWarnings.length}</span>
            </span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{showDosageControl ? '▲ скрыть' : '▼ показать'}</span>
          </div>
          {showDosageControl && (
            <div style={{ padding: '7px 10px', borderRadius: '0 0 8px 8px', background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.1)', borderTop: 'none' }}>
          {toxWarnings.map((w, i) => {
            const isDanger = w.severity === 'danger';
            const isTitr = w.severity === 'titrate';
            const col = isDanger ? '#ef4444' : isTitr ? '#f59e0b' : '#fbbf24';
            const bg = isDanger ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)';
            const bd = isDanger ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.2)';
            const tag = isDanger ? 'ПРЕВЫШЕН UL' : isTitr ? 'ТИТРАЦИЯ' : 'ВНИМАНИЕ';
            return (
              <div key={i} style={{ margin:'3px 0', padding:'6px 8px', borderRadius:8, background:bg, border:`1px solid ${bd}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2 }}>
                  <span style={{ fontSize:7, fontWeight:800, color:col, padding:'1px 5px', borderRadius:4, background:bg, border:`1px solid ${bd}` }}>{tag}</span>
                  <span style={{ fontSize:9, fontWeight:700, color:'#ffffff' }}>{subNameRu(w.substanceId)}</span>
                </div>
                <div style={{ fontSize:8, color:col, lineHeight:1.4 }}>{w.message}</div>
                {w.percentUL > 0 && <div style={{ fontSize:7, color:'rgba(255,255,255,0.55)', marginTop:2, lineHeight:1.4 }}>→ {w.percentUL}% от {isTitr ? 'оптимума' : 'UL'} ({w.totalDose} / {w.ul} мг)</div>}
              </div>
            );
          })}
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:3 }}>UL — верхний допустимый предел (элементарное вещество). Титрация — доза выше клинического оптимума, рекомендуется циклирование.</div>
          <SafetyCumulativeLoad planResult={planResult} />
            </div>
          )}
        </div>
      )}

      


{/* Противопоказания — все (каталог + правила + условия) */}
      {finalRec && finalRec.subs.length > 0 && (() => {
        interface FlatContra { substanceId: string; label: string; severity: 'absolute' | 'relative'; source: 'catalog' | 'rule' | 'condition'; }
        const flat: FlatContra[] = [];

        // 1) из checkContraindications (по healthConditions)
        if (finalRec.contraindications) {
          for (const c of finalRec.contraindications) {
            flat.push({ substanceId: c.substanceId, label: c.message, severity: c.severity, source: 'condition' });
          }
        }

        // 2) из SUPPORT_CATALOG_DATA.contraindications
        for (const s of finalRec.subs) {
          const e = SUPPORT_CATALOG_DATA[s.substanceId] || SUPPORT_CATALOG_DATA[s.substanceId.toLowerCase()] || SUPPORT_CATALOG_DATA[s.substanceId.toUpperCase()];
          if (e?.contraindications?.length) {
            for (const c of e.contraindications) {
              flat.push({ substanceId: s.substanceId, label: c, severity: 'relative', source: 'catalog' });
            }
          }
        }

        // 3) из CONTRAINDICATIONS general rules (absolute + relative)
        for (const s of finalRec.subs) {
          const rule = getContraindications(s.substanceId);
          if (!rule) continue;
          for (const abs of rule.absolute) {
            flat.push({ substanceId: s.substanceId, label: abs, severity: 'absolute', source: 'rule' });
          }
          for (const rel of rule.relative) {
            flat.push({ substanceId: s.substanceId, label: rel, severity: 'relative', source: 'rule' });
          }
        }

        if (flat.length === 0) return null;

        // дедупликация по substanceId + label
        const deduped: FlatContra[] = [];
        const seen = new Set<string>();
        for (const f of flat) {
          const key = f.substanceId.toLowerCase() + '::' + f.label;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(f);
        }

        // группировка по веществу
        const grouped: Record<string, { abs: FlatContra[]; rel: FlatContra[] }> = {};
        for (const f of deduped) {
          const id = f.substanceId.toLowerCase();
          if (!grouped[id]) grouped[id] = { abs: [], rel: [] };
          if (f.severity === 'absolute') grouped[id].abs.push(f);
          else grouped[id].rel.push(f);
        }

        const hasAbs = deduped.some(f => f.severity === 'absolute');
        const total = deduped.length;

        return (
          <div style={{ marginTop:6 }}>
            <div onClick={() => setShowContraindications(!showContraindications)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showContraindications ? '8px 8px 0 0' : 8, background: hasAbs ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border:'1px solid ' + (hasAbs ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)') }}>
              <span style={{ fontSize:10, fontWeight:700, color: hasAbs ? '#ef4444' : '#f59e0b' }}>
                {hasAbs ? '⛔ Противопоказания' : '⚠ Противопоказания и осторожности'} ({total})
              </span>
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showContraindications ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showContraindications && (
              <div style={{ padding:'6px 9px 8px', background: hasAbs ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.03)', border:'1px solid ' + (hasAbs ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)'), borderTop:'none', borderRadius:'0 0 8px 8px' }}>
                {Object.entries(grouped).map(([id, g]) => {
                  const all = [...g.abs, ...g.rel];
                  return (
                    <div key={id} style={{ marginBottom: all.length > 0 ? 4 : 0 }}>
                      <div style={{ fontSize:8, fontWeight:700, color:'#ffffff', marginBottom:2, marginTop:1 }}>{subNameRu(id)}</div>
                      {g.abs.map((f, i) => (
                        <div key={i} style={{ fontSize:7, color:'#fca5a5', marginBottom:1, lineHeight:1.4, marginLeft:6 }}>
                          ⛔ {f.label}
                        </div>
                      ))}
                      {g.rel.map((f, i) => (
                        <div key={i} style={{ fontSize:7, color:'#fbbf24', marginBottom:1, lineHeight:1.4, marginLeft:6 }}>
                          ⚠ {f.label}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      
{/* Прогноз ребаунда гормонов после отмены */}
      {finalRec && (() => {
        // Build ReboundInput from context
        const peds = (ctx.pedDoses || ctx.aasIds?.map((id: string) => ({ id, pClass: 'aas_unknown' })) || []);
        if (!peds.length) return null;
        
        const cycleWeeks = state.goals?.cycleWeeks || 12;
        const pctProtocol = rec?.pedFlags?.hasTest ? 'hcg+clomid' : 'clomid+nolva';

        const fp: any = state.labs?.fullPanel || {};
        const reboundInput: any = {
          peds: peds.map((p: any) => ({ id: p.id, pClass: p.pClass, mgPerWeek: p.mgPerWeek, iuPerDay: p.iuPerDay, mcgPerDay: p.mcgPerDay })),
          cycleWeeks,
          pctProtocol,
          pctStartWeek: undefined,
          userProfile: {
            age: state.profile?.age || 30,
            baselineTT: fp.TESTOSTERONE || 650,
            baselineE2: fp.ESTRADIOL || 28,
            baselinePRL: fp.PROLACTIN || 14,
            baselineCortisol: fp.CORTISOL || 450,
            baselineSHBG: fp.SHBG || 30,
            baselineLH: fp.LH || 5,
            baselineFSH: fp.FSH || 4,
          },
        };
        
        try {
          const rebound = calculateReboundTrajectory(reboundInput) as any;
          const summary = getReboundSummary(rebound) as any;
          
          return (
            <div style={{ marginTop:6 }}>
              <div onClick={() => setShowRebound(!showRebound)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showRebound ? '8px 8px 0 0' : 8, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.18)' }}>
                <span style={{ fontSize:10, fontWeight:700, color:'#f59e0b', display:'flex', alignItems:'center', gap:5 }}>
                  📉 Прогноз ребаунда после отмены
                  <span style={{ fontSize:7, fontWeight:600, color:'rgba(245,158,11,0.5)', padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.1)' }}>по вашему курсу</span>
                </span>
                <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showRebound ? '▲ скрыть' : '▼ показать'}</span>
              </div>
              {showRebound && (
                <div style={{ padding:'8px 9px', background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.1)', borderTop:'none', borderRadius:'0 0 8px 8px' }}>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:5, lineHeight:1.4 }}>
                    Прогноз восстановления гормонов за 24 недели после курса. Основан на ПК-фармакокинетике, ПКТ и клинических базах.
                  </div>
                  
                  {/* Summary cards */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:6, marginBottom:8 }}>
                    <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#f59e0b' }}>Восстановление</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{rebound.overallRecoveryWeek || '?'} нед</div>
                    </div>
                    <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#22c55e' }}>HPTA (LH+FSH+TT)</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{rebound.hptaRecoveryWeek || '?'} нед</div>
                    </div>
                    <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#ef4444' }}>E2 ребаунд</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{rebound.e2.overshootWeek ? `пик нед ${rebound.e2.overshootWeek}` : 'нет'} / rec {rebound.e2.recoveredWeek || '?'} нед</div>
                    </div>
                  </div>
                  
                  {/* Per-marker mini cards */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {['tt','ft','e2','prl','lh','fsh','cortisol','shbg'].map(marker => {
                      const t = rebound[marker as keyof typeof rebound];
                      if (!t) return null;
                      const recColor = t.recoveredWeek && t.recoveredWeek <= 12 ? '#22c55e' : t.recoveredWeek && t.recoveredWeek <= 20 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={marker} style={{ padding:'5px 7px', borderRadius:5, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', minWidth:80 }}>
                          <div style={{ fontSize:7, fontWeight:700, color:marker === 'e2' ? '#f59e0b' : marker === 'prl' ? '#ec4899' : marker === 'cortisol' ? '#ef4444' : '#fff' }}>
                            {marker.toUpperCase()}
                          </div>
                          <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>
                            {t.recoveredWeek ? `${t.recoveredWeek} нед` : '—'}
                            {t.overshootWeek && <span style={{ color:'#f59e0b', marginLeft:2 }}>↑{t.overshootWeek}</span>}
                          </div>
                          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                            баз: {t.baseline.toFixed(1)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Risk flags */}
                  {rebound.riskFlags.length > 0 && (
                    <div style={{ marginTop:8, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#ef4444', marginBottom:3 }}>⚠ Риск-факторы</div>
                      {rebound.riskFlags.map((rf: string, i: number) => (
                        <div key={i} style={{ fontSize:8, color:'#fca5a5', marginBottom:2, lineHeight:1.4, paddingLeft:10, borderLeft:'2px solid rgba(239,68,68,0.3)' }}>{rf}</div>
                      ))}
                    </div>
                  )}
                  
                  {/* Clinical notes */}
                  <div style={{ marginTop:8, padding:'6px 8px', borderRadius:6, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.12)' }}>
                    <div style={{ fontSize:7, fontWeight:700, color:'#60a5fa', marginBottom:3 }}>📋 Клинические заметки</div>
                    {['tt','ft','e2','prl','lh','fsh','cortisol','shbg'].flatMap(marker => {
                      const t = rebound[marker as keyof typeof rebound];
                      return t?.clinicalNotes?.map((note: string, i: number) => (
                        <div key={`${marker}-${i}`} style={{ fontSize:8, color:'rgba(240,240,245,0.9)', marginBottom:1, lineHeight:1.4, paddingLeft:8, borderLeft:'2px solid rgba(96,165,250,0.3)' }}>{note}</div>
                      )) || [];
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        } catch {
          return null;
        }
      })()}

{/* ===== КНОПКА «ПРИМЕНИТЬ ПЛАН» ===== */}
      {finalRec && finalRec.subs.length > 0 && onApply && (
        <button onClick={() => { onApply(finalRec); setApplyFlash(true); setTimeout(() => setApplyFlash(false), 1800); }} style={{
          width:'100%', marginTop:10, padding:'12px', borderRadius:12, fontSize:11, fontWeight:800, cursor:'pointer',
          background: applyFlash ? 'rgba(0,230,138,0.2)' : 'linear-gradient(135deg,#00e68a,#00c853)',
          border: applyFlash ? '1.5px solid rgba(0,230,138,0.5)' : 'none',
          color: applyFlash ? '#00e68a' : '#000',
          boxShadow: applyFlash ? 'none' : '0 4px 20px rgba(0,230,138,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <span style={{fontSize:14}}>{applyFlash ? '✓' : '✅'}</span>
          <span>{applyFlash ? 'Готово' : `Применить план поддержки (${finalRec.subs.length} препаратов)`}</span>
        </button>
      )}

      {/* CalcActions (сохранить/копировать/врачу) */}
      {finalRecWithResidual && <CalcActions rec={finalRecWithResidual} level={level} state={state} />}

      
{/* Дисклеймер */}
      <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', fontSize: 7, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6 }}>
        <b style={{ color: '#fbbf24' }}>⚠️ Важно:</b> система носит справочно-информационный характер и <b>не является медицинским изделием, инструментом диагностики или лечебным приложением</b>. Она не ставит диагнозы, не назначает и не отменяет лечение и не заменяет консультацию врача. Все расчёты рисков, дозировки и рекомендации — ориентировочные и основаны на открытых данных и обобщённом опыте. Перед началом любого курса, приёмом любых препаратов и БАД, а также при изменении доз — обязательна очная консультация врача (терапевта, эндокринолога или кардиолога). Рецептурные препараты (помечены <span style={{ color: '#fca5a5', fontWeight: 800 }}>👨‍⚕️</span>) принимаются только по назначению врача и под контролем анализов. При появлении тревожных симптомов — боли в груди, одышки, тахикардии, желтухи, отёков, температуры — немедленно прекратите приём и обратитесь к врачу.
      </div>

{/* ===== ВЫБОР РЕЖИМА (2 кнопки рядом) ===== */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
        <div onClick={() => setShowIntellPopup(true)} style={{ borderRadius:14, background:'linear-gradient(135deg,rgba(0,230,138,0.06),rgba(0,200,83,0.03))', border:'1.5px solid rgba(0,230,138,0.15)', padding:'12px 12px 10px', cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:16 }}>🧠</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#00e68a' }}>Интеллектуальная</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                {level === 'base' && '🟢 База'}{level === 'medium' && '🟡 Средний'}{level === 'max' && '🔴 Максимум'}{level === 'manual' && '⚙️ Вручную'}
              </div>
            </div>
            <span style={{ fontSize:10, color:'#00e68a' }}>›</span>
          </div>
        </div>
        <div                         onClick={() => { setLevel('manual'); setShowManualPopup(true); }} style={{ borderRadius:14, background:'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(59,130,246,0.03))', border:'1.5px solid rgba(99,102,241,0.15)', padding:'12px 12px 10px', cursor:'pointer' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:16 }}>⚙️</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'#818cf8' }}>Ручной режим</div>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                {manualSubs.length > 0 || selectedStacks.length > 0 ? `${selectedStacks.length} стек · ${manualSubs.length} пр.` : 'Каталог / стек / избранное'}
              </div>
            </div>
            <span style={{ fontSize:10, color:'#818cf8' }}>›</span>
          </div>
        </div>
      </div>

      {/* ── Попап интеллектуального выбора ── */}
      {showIntellPopup && ReactDOM.createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowIntellPopup(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'88%', maxWidth:320, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden' }}>
            <div style={{ height:3, background:'linear-gradient(90deg,#00e68a,#00c853)' }} />
            <div style={{ padding:'16px 14px 12px' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#00e68a', marginBottom:10 }}>🧠 Интеллектуальная поддержка</div>
              {([
                ['base','База','🟢','Только core: NAC, омега-3, Mg, D3. Бюджет'],
                ['medium','Средний','🟡','Core + standard. Оптимальный баланс'],
                ['max','Максимум','🔴','Все активные механизмы + advanced. Полная защита'],
              ] as const).map(([lv, label, icon, desc]) => (
                <div key={lv} onClick={() => { setLevel(lv as SupportLevel); setShowIntellPopup(false); }} style={{
                  padding:'10px 12px', borderRadius:10, marginBottom:5, cursor:'pointer',
                  background: level === lv ? 'linear-gradient(135deg,rgba(0,230,138,0.12),rgba(0,200,83,0.06))' : 'rgba(255,255,255,0.03)',
                  border: level === lv ? '1.5px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>{icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, fontWeight:700, color: level === lv ? '#00e68a' : '#ffffff' }}>{label} {level === lv && '✓'}</div>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Попап ручного режима (портал в body, экранирует backdrop-filter предка) ── */}
      {showManualPopup && ReactDOM.createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)', overflowY:'auto', padding:'20px 0' }} onClick={() => setShowManualPopup(false)}>
        <div style={{ width:'90%', maxWidth:420, margin:'0 auto', borderRadius:16, background:'#16161a', border:'1px solid rgba(255,255,255,0.12)', overflow:'hidden' }} onClick={e => e.stopPropagation()}>
          <div style={{ height:3, background:'linear-gradient(90deg,#818cf8,#6366f1)' }} />
          <div style={{ padding:'16px 14px 12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:800, color:'#818cf8' }}>⚙️ Ручной режим</span>
                <button onClick={() => setShowManualPopup(false)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:12, fontWeight:600 }}>✕</button>
              </div>
              {/* Tab bar */}
              <div style={{ display:'flex', gap:4, marginBottom:8, overflowX:'auto', flexWrap:'wrap' }}>
                {['stacks','catalog','saved','favorites'].map((id) => (
                  <button key={id} onClick={() => { setManualTab(id as any); setCatalogSearch(''); setSavedSearch(''); setManualStackSearch(''); }}
                    style={{
                      padding:'6px 10px', borderRadius:8, fontSize:10, fontWeight:700, whiteSpace:'nowrap', cursor:'pointer',
                      background: manualTab === id ? '#818cf8' : 'rgba(255,255,255,0.05)',
                      color: manualTab === id ? '#000' : 'rgba(255,255,255,0.6)',
                      border: '1px solid ' + (manualTab === id ? '#818cf8' : 'rgba(255,255,255,0.1)'),
                    }}>{id === 'stacks' ? '📦 Стеки' : id === 'catalog' ? '📋 Каталог' : id === 'saved' ? '💾 Сохранённые' : '⭐ Избранное'}</button>
                ))}
              </div>
              {manualTab === 'catalog' && (
                <>
                  <input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} placeholder="🔍 Поиск препарата (минимум 2 символа)..." style={{
                    width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:13, boxSizing:'border-box', marginBottom:6, outline:'none',
                  }} />
                  {!catalogSearch || catalogSearch.length < 2 ? (
                    <div style={{ padding:30, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:11 }}>
                      Введите минимум 2 символа для поиска по {Object.keys(SUPPORT_CATALOG_DATA).length} препаратам
                    </div>
                  ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'45vh', overflowY:'auto', marginBottom:10 }}>
                    {Object.entries(SUPPORT_CATALOG_DATA)
                      .filter(([id, entry]: [string, any]) => {
                        const q = catalogSearch.toLowerCase();
                        return (entry.nameRu||'').toLowerCase().includes(q) || (entry.name||'').toLowerCase().includes(q) || id.toLowerCase().includes(q);
                      })
                      .map(([id, entry]: [string, any]) => (
                        <CalcSubstanceDetail
                          key={id}
                          sub={{ substanceId: id, category: 'other' as const, k: 0, reason: 'Ручной выбор', mechsCovered: entry.mechanisms || [], q: 'B' }}
                          rec={{ subs: [], suppression: [], coverage: [], gaps: [], conflicts: [], guardrails: [], boosters: [], activatedMechs: [], summary: '', rationale: '', level: 'medium', phase: 'on', phaseLabel: 'На курсе' } as any}
                          subNameRu={(id: string) => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id}
                          subDosage={(id: string) => SUPPORT_CATALOG_DATA[id]?.dosage || { mg: 0, timing: '' }}
                          subTier={(id: string) => SUPPORT_CATALOG_DATA[id]?.tier || 'standard'}
                          canonIdLocal={(id: string) => id}
                        />
                      ))}
                  </div>
                  )}
                </>
              )}
              {manualTab === 'saved' && (
                <div style={{ padding:30, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:11 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>💾</div>
                  Здесь будут сохранённые планы и стеки.
                </div>
              )}
              {manualTab === 'favorites' && (
                <div style={{ padding:30, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:11 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>⭐</div>
                  Здесь будут избранные препараты.
                </div>
              )}
              {manualTab === 'stacks' && (
                <>
              {manualSubs.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.55)', marginBottom:4 }}>💊 Препараты из ручного ввода ({manualSubs.length}) — откройте каталог для выбора</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {manualSubs.map((sid, i) => (
                      <span key={sid+i} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontWeight:600, background:'rgba(99,102,241,0.12)', color:'#818cf8', display:'inline-flex', alignItems:'center', gap:4, margin:1 }}>
                        {sid}
                        <span onClick={() => setManualSubs(prev => prev.filter((_, j) => j !== i))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:13 }}>✕</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedStacks.length > 0 && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#c084fc', marginBottom:4 }}>📦 Выбранные стеки поддержки ({selectedStacks.length})</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {selectedStacks.map((stId) => {
                      const st = (ALL_STACKS as any[]).find(s => s.id === stId);
                      return (
                        <span key={stId} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, fontWeight:600, background:'rgba(168,85,247,0.12)', color:'#c084fc', display:'inline-flex', alignItems:'center', gap:4, margin:1 }}>
                          {st?.name || stId}
                          <span onClick={() => setSelectedStacks(prev => prev.filter(s => s !== stId))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.5)', fontSize:13 }}>✕</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ fontSize:13, fontWeight:700, color:'#ffffff', marginBottom:4, marginTop:4 }}>📦 Добавить стек из {ALL_STACKS.length} готовых</div>
              <input value={manualStackSearch} onChange={e => setManualStackSearch(e.target.value)} placeholder="🔍 Поиск стека..." style={{
                width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(0,0,0,0.3)', color:'#fff', fontSize:13, boxSizing:'border-box', marginBottom:6, outline:'none',
              }} />
              <div style={{ display:'flex', flexDirection:'column', gap:3, maxHeight:'55vh', overflowY:'auto', marginBottom:10 }}>
                {(ALL_STACKS as any[])
                  .filter((st: any) => {
                    if (!manualStackSearch) return true;
                    const q = manualStackSearch.toLowerCase();
                    return (st.name||'').toLowerCase().includes(q) || (st.id||'').toLowerCase().includes(q) || (st.system||'').toLowerCase().includes(q) || (st.problem||'').toLowerCase().includes(q);
                  })
                  .map((st: any) => {
                    const active = selectedStacks.includes(st.id);
                    const subCount = (st.substances||[]).length;
                    const isExpanded = expandedManualStack === st.id;
                    return (
                      <div key={st.id}
                        style={{ borderRadius:7,
                          background: active ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)',
                          border: active ? '1px solid rgba(168,85,247,0.25)' : '1px solid rgba(255,255,255,0.04)' }}>
                        <div onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== st.id) : [...prev, st.id])}
                          style={{ padding:'8px 10px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:6 }}>
                          <span style={{ fontSize:13, minWidth:14, color: active ? '#c084fc' : 'rgba(255,255,255,0.4)', marginTop:1 }}>{active ? '✓' : '○'}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color: active ? '#c084fc' : 'rgba(255,255,255,0.9)', lineHeight:1.25 }}>{st.name || st.id.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')}</div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:2, lineHeight:1.35 }}>{st.system || ''} · {subCount} веществ{st.synergyScore ? ` · син: ${st.synergyScore}` : ''}</div>
                          </div>
                          <span onClick={(e) => { e.stopPropagation(); setExpandedManualStack(isExpanded ? null : st.id); }}
                            style={{ fontSize:13, color:'rgba(255,255,255,0.55)', cursor:'pointer', marginTop:1, padding:'0 2px', flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                        {isExpanded && (
                          <div style={{ padding:'0 8px 8px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                            {st.anatomicalMapping?.organMechanisms && (
                              <div style={{ fontSize:11, color:'rgba(240,240,245,0.9)', lineHeight:1.45, marginTop:6 }}>
                                <b style={{ color:'#a78bfa' }}>🧬 Механизм действия:</b> {st.anatomicalMapping.organMechanisms}
                              </div>
                            )}
                            {st.synergyPrinciple && (
                              <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                                <b>Принцип синергии:</b> {st.synergyPrinciple}
                              </div>
                            )}
                            {st.anatomicalMapping?.finalEffect && (
                              <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                                <b>Итоговый эффект:</b> {st.anatomicalMapping.finalEffect}
                              </div>
                            )}
                            {st.anatomicalMapping?.mechanismCodes?.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:4 }}>
                                {st.anatomicalMapping.mechanismCodes.map((m: string) => (
                                  <span key={m} style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.1)', color:'#c084fc' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g,' ')}</span>
                                ))}
                              </div>
                            )}
                            <div style={{ fontSize:12, fontWeight:700, color:'#00e68a', marginTop:8, marginBottom:3 }}>💊 Перечень препаратов ({subCount}):</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                              {(st.substances||[]).map((sd: any) => {
                                const cat = SUPPORT_CATALOG_DATA[sd.id];
                                return (
                                  <div key={sd.id} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.12)' }}>
                                    <span style={{ fontWeight:600, color:'rgba(240,240,245,0.9)' }}>{cat?.nameRu || cat?.name || sd.id}</span>
                                    {sd.dose && <span style={{ color:'#00e68a', marginLeft:4 }}>{sd.dose}</span>}
                                    {sd.timing && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:4 }}>{sd.timing}</span>}
                                    {sd.mechanism && <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', lineHeight:1.35, marginTop:2 }}>— {sd.mechanism}</div>}
                                  </div>
                                );
                              })}
                            </div>
                            {(st.contraindications || st.warnings) && (
                              <div style={{ marginTop:8 }}>
                                {st.contraindications && (
                                  <div style={{ fontSize:11, color:'#f87171', lineHeight:1.45 }}>
                                    <b>⛔ Противопоказания:</b> {st.contraindications}
                                  </div>
                                )}
                                {st.warnings && (
                                  <div style={{ fontSize:11, color:'#fbbf24', lineHeight:1.45, marginTop:3 }}>
                                    <b>⚠ Осторожности / предосторожности:</b> {st.warnings}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
                </>
              )}
              <button onClick={() => { setLevel('manual'); setShowManualPopup(false); }} style={{ width:'100%', padding:'10px', borderRadius:10, background:'linear-gradient(135deg,#818cf8,#6366f1)', border:'none', color:'#000', fontWeight:700, fontSize:11, cursor:'pointer' }}>
                ✅ Применить ручной выбор
              </button>
            </div>
           </div>
        </div>
      , document.body)}
      
      {/* ===== PED-RISK БАННЕР: авто-активация нейро/суставы/гемато по стеку PED (gross→net) ===== */}
      {finalRecWithResidual?.pedRisk && (finalRecWithResidual.pedRisk.grossNeuroTier !== undefined ? finalRecWithResidual.pedRisk.grossNeuroTier! > 0 : finalRecWithResidual.pedRisk.neuroBoosterTier > 0 || finalRecWithResidual.pedRisk.jointsBoosterTier > 0 || finalRecWithResidual.pedRisk.hematoBoosterTier > 0) && (
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:12, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize:9, fontWeight:800, color:'#a5b4fc', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.3px' }}>
            ⚡ Авто-защита по стеку PED (gross→net)
          </div>
          {(() => {
            const pr = finalRecWithResidual.pedRisk!;
            const grossN = pr.grossNeuroTier ?? pr.neuroBoosterTier;
            const grossJ = pr.grossJointsTier ?? pr.jointsBoosterTier;
            const grossH = pr.grossHematoTier ?? pr.hematoBoosterTier;
            return (
              <>
                {grossN > 0 && (
                  <div style={{ fontSize:8, color: pr.neuroBoosterTier === 0 ? '#4ade80' : '#818cf8', lineHeight:1.4, marginBottom:3, display:'flex', alignItems:'flex-start', gap:4 }}>
                    <span style={{ fontSize:10 }}>🧠</span>
                    <div>
                      <b>Нейрозащита LV{grossN}{pr.neuroBoosterTier !== grossN ? ` → LV${pr.neuroBoosterTier}` : ''}</b>
                      {pr.neuroCoverage != null && pr.neuroRecommended ? <span style={{ color: pr.neuroBoosterTier === 0 ? '#4ade80' : 'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>{pr.neuroCovered}/{pr.neuroRecommended}{pr.neuroBoosterTier === 0 ? ' ✓ покрыто' : ''}</span> : null}
                      <span style={{ color:'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>— {pr.neuroRisk}</span>
                      {pr.triggeredBy.filter(r => r.includes('нейро') || r.includes('Нейро') || r.includes('19-нор') || r.includes('трен') || r.includes('Трен') || r.includes('Эскалация')).slice(0,1).map((r,i) => (
                        <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{r}</div>
                      ))}
                    </div>
                  </div>
                )}
                {grossJ > 0 && (
                  <div style={{ fontSize:8, color: pr.jointsBoosterTier === 0 ? '#4ade80' : '#4ade80', lineHeight:1.4, marginBottom:3, display:'flex', alignItems:'flex-start', gap:4 }}>
                    <span style={{ fontSize:10 }}>🦴</span>
                    <div>
                      <b>Суставы LV{grossJ}{pr.jointsBoosterTier !== grossJ ? ` → LV${pr.jointsBoosterTier}` : ''}</b>
                      {pr.jointsCoverage != null && pr.jointsRecommended ? <span style={{ color: pr.jointsBoosterTier === 0 ? '#4ade80' : 'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>{pr.jointsCovered}/{pr.jointsRecommended}{pr.jointsBoosterTier === 0 ? ' ✓ покрыто' : ''}</span> : null}
                      <span style={{ color:'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>— {pr.jointsRisk}</span>
                      {pr.triggeredBy.filter(r => r.includes('сустав') || r.includes('Сустав') || r.includes('стан') || r.includes('Стан') || r.includes('tendin') || r.includes('компенс') || r.includes('Эскалация')).slice(0,1).map((r,i) => (
                        <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{r}</div>
                      ))}
                    </div>
                  </div>
                )}
                {grossH > 0 && (
                  <div style={{ fontSize:8, color: pr.hematoBoosterTier === 0 ? '#4ade80' : '#14b8a6', lineHeight:1.4, marginBottom:3, display:'flex', alignItems:'flex-start', gap:4 }}>
                    <span style={{ fontSize:10 }}>🩸</span>
                    <div>
                      <b>Гемато LV{grossH}{pr.hematoBoosterTier !== grossH ? ` → LV${pr.hematoBoosterTier}` : ''}</b>
                      {pr.hematoCoverage != null && pr.hematoRecommended ? <span style={{ color: pr.hematoBoosterTier === 0 ? '#4ade80' : 'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>{pr.hematoCovered}/{pr.hematoRecommended}{pr.hematoBoosterTier === 0 ? ' ✓ покрыто' : ''}</span> : null}
                      <span style={{ color:'rgba(255,255,255,0.5)', marginLeft:4, fontSize:7 }}>— {pr.hematoRisk}</span>
                      {pr.triggeredBy.filter(r => r.includes('гемато') || r.includes('Гемато') || r.includes('эритропоэз') || r.includes('Эритропоэз') || r.includes('HIF') || r.includes('ЭПО') || r.includes('болденон') || r.includes('Болденон') || r.includes('Эскалация')).slice(0,1).map((r,i) => (
                        <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:1 }}>{r}</div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ===== СИНХРОНИЗАЦИЯ С ПРОФИЛЕМ (neuro/oda/pharma/symptoms) ===== */}
      {onStateChange && (
        <div style={{ marginBottom:6, display:'flex', gap:4 }}>
          <button onClick={() => {
            try {
              const raw = localStorage.getItem('he_profile_v2');
              if (!raw) return;
              const p = JSON.parse(raw);
              const s = p?.settings || {};
              const personal = s.personal || {};
              const lifestyle = s.lifestyle || {};
              const health = s.health || {};
              const pharma = s.pharma || {};
              const phaseMap: Record<string, string> = { baseline: 'base', course: 'course', bridge: 'bridge', pct: 'pct', post_pct: 'pct', fertility: 'base' };
              const aas = Array.isArray(pharma.currentSubstances) ? pharma.currentSubstances.map((sub: any) => ({
                id: sub.id || sub.substanceId || '',
                mgPerWeek: sub.doseMgWeek || sub.weeklyDose || sub.doseMg || 0,
                weeks: sub.weeks || (sub.endWeek || 12) - (sub.startWeek || 0) || 12,
                form: sub.form || (sub.route === 'oral' ? 'oral' : 'inject'),
              })) : [];
              // Вывод PED-флагов и доз из currentSubstances
              const csIds = new Set((pharma.currentSubstances || []).map((s: any) => s.id));
              const csHasAI = ['anastrozole','anastro','letrozole','exemestane'].some(id => csIds.has(id));
              const csHasSERM = ['tamoxifen','clomiphene','enclomiphene'].some(id => csIds.has(id));
              const csHasCaber = csIds.has('caberg') || csIds.has('cabergoline');
              const csHasGH = csIds.has('somatropin') || csIds.has('hgh') || csIds.has('gh');
              const csHasIGF = csIds.has('igf1_lr3') || csIds.has('igf1_des');
              const csHasInsulin = ['ins_short','ins_long','ins_aspart','ins_detemir'].some(id => csIds.has(id));
              const csHasSARMs = ['ostarine','lgd','rad140','s23','andarine'].some(id => csIds.has(id));
              const csHasMGF = csIds.has('mgf');
              let csGhIU = 0, csInsulinIU = 0, csIgfMcg = 0, csClenMcg = 0, csT3Mcg = 0;
              for (const s of (pharma.currentSubstances || [])) {
                const dose = Number((s as any).doseMg || (s as any).doseValue || 0);
                const id = (s as any).id;
                if (id === 'somatropin' || id === 'hgh' || id === 'gh') csGhIU += dose;
                if (['ins_short','ins_long','ins_aspart','ins_detemir'].includes(id)) csInsulinIU += dose;
                if (id === 'igf1_lr3' || id === 'igf1_des') csIgfMcg += dose;
                if (id === 'clenbuterol' || id === 'clen') csClenMcg += dose;
                if (id === 't3' || id === 'liothyronine') csT3Mcg += dose;
              }
              onStateChange({
                ...state,
                profile: { ...state.profile, weight: personal.weight || state.profile.weight, age: personal.age || state.profile.age, sleepHours: lifestyle.sleepHours ?? state.profile.sleepHours, stressLevel: lifestyle.stressLevel ?? state.profile.stressLevel, height: personal.height ?? state.profile.height },
                neuro: { ...state.neuro, aggressionScore: (health.aggressionScore ?? 3) * 2, dopamineScore: health.dopamineScore ?? state.neuro.dopamineScore, serotoninScore: health.serotoninScore ?? state.neuro.serotoninScore, memoryIssues: health.memoryIssues ?? state.neuro.memoryIssues, focusIssues: health.focusIssues ?? state.neuro.focusIssues, slowThinking: health.slowThinking ?? state.neuro.slowThinking, headaches: health.headaches ?? state.neuro.headaches, gabaBalance: health.gabaBalance || state.neuro.gabaBalance, coordinationIssues: health.coordinationIssues ?? state.neuro.coordinationIssues },
                oda: { ...state.oda, jointPain: health.jointPainSeverity ?? (health.jointPain ? 'moderate' : state.oda.jointPain), ligamentIssues: health.ligamentIssues ?? state.oda.ligamentIssues, backPain: health.backPain ?? state.oda.backPain },
                pharma: {
                  ...state.pharma,
                  phase: (phaseMap[pharma.phase] || state.pharma.phase) as any,
                  aas: aas.length > 0 ? aas : state.pharma.aas,
                  hasHCG: pharma.hcgEnabled ?? state.pharma.hasHCG,
                  hasAI: csHasAI || pharma.aiEnabled || state.pharma.hasAI,
                  hasSERM: csHasSERM || state.pharma.hasSERM,
                  hasCaber: csHasCaber || pharma.hasCaber || state.pharma.hasCaber,
                  hasGH: csHasGH || pharma.hasGH || state.pharma.hasGH,
                  hasIGF: csHasIGF || pharma.hasIGF || state.pharma.hasIGF,
                  hasInsulin: csHasInsulin || pharma.hasInsulin || state.pharma.hasInsulin,
                  hasSARMs: csHasSARMs || pharma.hasSARMs || state.pharma.hasSARMs,
                  hasMGF: csHasMGF || pharma.hasMGF || state.pharma.hasMGF,
                  ghIU: csGhIU > 0 ? csGhIU : (pharma.ghIU ?? state.pharma.ghIU),
                  insulinIU: csInsulinIU > 0 ? csInsulinIU : (pharma.insulinIU ?? state.pharma.insulinIU),
                  igfMcg: csIgfMcg > 0 ? csIgfMcg : (pharma.igfMcg ?? state.pharma.igfMcg),
                  clenMcg: csClenMcg > 0 ? csClenMcg : (pharma.clenMcg ?? state.pharma.clenMcg),
                  t3Mcg: csT3Mcg > 0 ? csT3Mcg : (pharma.t3Mcg ?? state.pharma.t3Mcg),
                },
                healthConditions: Array.isArray(health.chronicConditions) ? health.chronicConditions : state.healthConditions,
              });
            } catch {}
          }} style={{ flex:1, fontSize:8, fontWeight:700, cursor:'pointer', padding:'5px 8px', borderRadius:6, background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.15)', color:'#a5b4fc' }}>📋 Из профиля (neuro/oda/pharma)</button>
        </div>
      )}

      {/* ===== УСИЛЕНИЕ: все стеки каталога (видно во ВСЕХ режимах, включая ручной) ===== */}
      {(
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:12, background:'rgba(24,24,27,0.3)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
            <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.3px' }}>Усиление ({ALL_STACKS.length} стеков)</span>
            <button onClick={() => setShowEnhancementPopup(true)} style={{ fontSize:11, fontWeight:700, cursor:'pointer', padding:'5px 10px', borderRadius:6, background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)', color:'#f87171' }}>📋 Все стеки</button>
          </div>
           <button onClick={() => setShowEnhancementPopup(true)} style={{ width:'100%', padding:'10px 12px', borderRadius:9, fontSize:11, fontWeight:800, cursor:'pointer', background:'linear-gradient(135deg,rgba(248,113,113,0.16),rgba(99,102,241,0.12))', border:'1px solid rgba(248,113,113,0.28)', color:'#fff', textAlign:'left' }}>
             🚀 Усиление <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)', fontWeight:500 }}>— системы, нейро, кровь, суставы и дополнительные стеки</span>
           </button>
          {selectedStacks.filter(id => !['articular_stack','neuroprotection_stack','mega_total_support_35'].includes(id)).length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4 }}>
              {selectedStacks.filter(id => !['articular_stack','neuroprotection_stack','mega_total_support_35'].includes(id)).map(sid => (
                <span key={sid} style={{ fontSize:10, padding:'3px 7px', borderRadius:6, fontWeight:600, background:'rgba(168,85,247,0.12)', color:'#c084fc', display:'inline-flex', alignItems:'center', gap:4 }}>
                  {sid.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')}
                  <span onClick={() => setSelectedStacks(prev => prev.filter(s => s !== sid))} style={{ cursor:'pointer', color:'rgba(255,255,255,0.6)', fontSize:12 }}>✕</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Попап полного каталога стеков (Усиление) — ВСЕ 55 стеков из ALL_STACKS ── */}
      {showEnhancementPopup && ReactDOM.createPortal(
         <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowEnhancementPopup(false)}>
           <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, borderRadius:18, overflowWrap:'anywhere', wordBreak:'break-word', background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
             <div style={{ height:3, background:'linear-gradient(90deg,#f87171,#ef4444)' }} />
             <div style={{ padding:'14px 14px 10px' }}>
               <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                 <span style={{ fontSize:13, fontWeight:800, color:'#f87171' }}>🚀 Усиление: все стеки ({ALL_STACKS.length})</span>
                <button onClick={() => setShowEnhancementPopup(false)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:12, fontWeight:600 }}>✕</button>
              </div>
             <input value={enhancementSearch} onChange={e => setEnhancementSearch(e.target.value)} placeholder="🔍 Поиск стека по названию, системе или проблеме..." style={{
                 width:'100%', padding:'9px 11px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', background:'#26262b', color:'#ffffff', fontSize:13, boxSizing:'border-box', marginBottom:8,
               }} />
             <div style={{ fontSize:9, fontWeight:800, color:'#fff', margin:'4px 0' }}>Системы</div>
             <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:4, marginBottom:6 }}>
                {(['all', 'cardio', 'hepatic', 'renal', 'hematologic', 'neuro', 'endocrine', 'reproductive', 'musculoskeletal', 'metabolic'] as const).map(system => {
                 const meta: Record<string, [string, string]> = {
                   all: ['🧩 Все', '#f87171'], cardio: ['❤️ ССС', '#ef4444'], hepatic: ['🫁 Печень', '#f59e0b'],
                   renal: ['🫘 Почки', '#60a5fa'], hematologic: ['🩸 Кровь', '#14b8a6'], neuro: ['🧠 ЦНС', '#818cf8'],
                   endocrine: ['🧪 Эндокринная', '#ec4899'], reproductive: ['🧬 Репродукт.', '#f472b6'],
                   musculoskeletal: ['🦴 ОДА', '#4ade80'], metabolic: ['🍬 Метаболизм', '#fb923c'],
                 };
                 const [label, color] = meta[system];
                 const active = enhancementSystem === system;
                  return (
                    <button key={system} onClick={() => {
                      setEnhancementSystem(system);
                      if (system === 'hematologic') {
                        setStackModulePopup('hemato_stack');
                        setHematoPreset(null); setHematoSelected(new Set()); setHematoConfirm(false);
                        setHematoSymptoms(buildHematoSymptomsFromState(state));
                      } else if (system === 'neuro') {
                        setStackModulePopup('neuroprotection_stack');
                        setNeuroPreset(null); setNeuroSelected(new Set()); setNeuroConfirm(false);
                        setNeuroSymptoms(buildNeuroSymptomsFromState(state));
                      } else if (system !== 'all' && GENERIC_ENHANCEMENT_CONFIG[system]) {
                        setGenericEnhancementPopup(system);
                        setGenericEnhancementSelected(new Set());
                      }
                    }} style={{ padding:'7px 4px', borderRadius:7, border:`1px solid ${color}${active ? 'aa' : '55'}`, background:active ? `${color}28` : `${color}12`, color:'#fff', fontSize:8, fontWeight:700, cursor:'pointer', whiteSpace:'normal', lineHeight:1.2 }}>
                      {label}
                    </button>
                  );
               })}
             </div>
            </div>

            {/* ── Автоподбор под недостающие механизмы ТЗ ── */}
            {gapFill.length > 0 && (
              <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(239,68,68,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:'#f87171' }}>🎯 Автоподбор под недостающие механизмы ({gapFill.length})</span>
                  <button onClick={() => setSelectedStacks(prev => Array.from(new Set([...prev, ...gapFill.map(g => g.stackId)])))}
                    style={{ padding:'5px 11px', borderRadius:7, border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.12)', color:'#fca5a5', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                    ✅ Все рекомендованные
                  </button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {gapFill.map(g => {
                    const active = selectedStacks.includes(g.stackId);
                    return (
                      <div key={g.stackId} onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== g.stackId) : [...prev, g.stackId])}
                        style={{ padding:'7px 9px', borderRadius:8, cursor:'pointer',
                          background: active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
                          border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:11, minWidth:14, color: active ? '#c084fc' : 'rgba(255,255,255,0.55)' }}>{active ? '✓' : '○'}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, fontWeight:700, color: active ? '#c084fc' : 'rgba(240,240,245,0.9)', lineHeight:1.25 }}>{g.stackName}</div>
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', lineHeight:1.35, marginTop:2 }}>
                              {g.organLabels.join(', ')} · закрывает: {g.mechLabels.join(', ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:5, lineHeight:1.35 }}>
                  Стек покрывает механизмы, оставшиеся незакрытыми после текущего плана поддержки.
                </div>
              </div>
            )}

            <div style={{ flex:1, overflowY:'auto', padding:'0 14px 14px' }}>
              {(ALL_STACKS as any[])
                 .filter((st: any) => {
                   if (enhancementSystem !== 'all') {
                     const systems = [st.system, ...(st.anatomicalMapping?.organSystems || []), ...(st.systems || [])]
                       .filter(Boolean).map((x: any) => String(x).toLowerCase());
                     const text = JSON.stringify(st).toLowerCase();
                     const aliases: Record<string, string[]> = {
                       cardio: ['cardio','heart','ссс','серд'], hepatic: ['hepatic','liver','печен'], renal: ['renal','kidney','почек'],
                       hematologic: ['hemat','blood','кров'], neuro: ['neuro','cns','цнс'], endocrine: ['endocrine','гормон'],
                       reproductive: ['reproductive','hormonal','репродукт'], musculoskeletal: ['musculo','joint','bone','сустав','ода'], metabolic: ['metabolic','glycemic','метабол'],
                     };
                     const terms = aliases[enhancementSystem] || [enhancementSystem];
                     if (!terms.some(term => systems.some(s => s.includes(term)) || text.includes(term))) return false;
                   }
                   if (!enhancementSearch) return true;
                  const q = enhancementSearch.toLowerCase();
                  const name = (st.name||'').toLowerCase();
                  const sys = (st.system||'').toLowerCase();
                  const prob = (st.problem||'').toLowerCase();
                  const sid = (st.id||'').toLowerCase();
                  return name.includes(q) || sys.includes(q) || prob.includes(q) || sid.includes(q);
                 })
                .map((st: any) => {
                  const active = selectedStacks.includes(st.id);
                  const subCount = (st.substances||[]).length;
                  const trigger = STACK_BOOSTER_TRIGGERS.find(t => t.stackId === st.id);
                  const isExpanded = expandedManualStack === st.id;
                  return (
                    <div key={st.id}
                      style={{ borderRadius:8, marginBottom:4, overflow:'hidden',
                        background: active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.02)',
                        border: active ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
                      }}>
                      <div onClick={() => setSelectedStacks(prev => active ? prev.filter(s => s !== st.id) : [...prev, st.id])}
                        style={{ padding:'9px 11px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:6 }}>
                        <span style={{ fontSize:13, minWidth:14, color: active ? '#c084fc' : 'rgba(255,255,255,0.4)', marginTop:1 }}>{active ? '✓' : '○'}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color: active ? '#c084fc' : 'rgba(255,255,255,0.9)', lineHeight:1.25 }}>{st.name || st.id.replace(/_stack|_support|_35/g,'').replace(/_/g,' ')}</div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.35, marginTop:2 }}>{st.problem || st.system || ''}</div>
                          <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginTop:3, display:'flex', gap:5, flexWrap:'wrap' }}>
                            <span>{subCount} веществ</span>
                            {st.synergyScore ? <span>· синергия: {st.synergyScore}</span> : null}
                            {st.system ? <span>· {st.system}</span> : null}
                            {trigger ? <span style={{color:'#f87171',fontWeight:700}}>· авто-триггер</span> : null}
                          </div>
                        </div>
                        <span onClick={(e) => { e.stopPropagation(); setExpandedManualStack(isExpanded ? null : st.id); }}
                          style={{ fontSize:13, color:'rgba(255,255,255,0.55)', cursor:'pointer', marginTop:1, padding:'0 2px', flexShrink:0 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                      {isExpanded && (
                        <div style={{ padding:'0 10px 10px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                          {st.anatomicalMapping?.organMechanisms && (
                            <div style={{ fontSize:11, color:'rgba(240,240,245,0.9)', lineHeight:1.45, marginTop:6 }}>
                              <b style={{ color:'#a78bfa' }}>🧬 Механизм действия:</b> {st.anatomicalMapping.organMechanisms}
                            </div>
                          )}
                          {st.synergyPrinciple && (
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                              <b>Принцип синергии:</b> {st.synergyPrinciple}
                            </div>
                          )}
                          {st.anatomicalMapping?.finalEffect && (
                            <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', lineHeight:1.45, marginTop:3 }}>
                              <b>Итоговый эффект:</b> {st.anatomicalMapping.finalEffect}
                            </div>
                          )}
                          {st.anatomicalMapping?.mechanismCodes?.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:4 }}>
                              {st.anatomicalMapping.mechanismCodes.map((m: string) => (
                                <span key={m} style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(168,85,247,0.1)', color:'#c084fc' }}>{MECH_TRANSLATIONS_RU[m] || MECH_LABELS[m] || m.replace(/_/g,' ')}</span>
                              ))}
                            </div>
                          )}
                          <div style={{ fontSize:12, fontWeight:700, color:'#00e68a', marginTop:8, marginBottom:3 }}>💊 Перечень препаратов ({subCount}):</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                            {(st.substances||[]).map((sd: any) => {
                              const cat = SUPPORT_CATALOG_DATA[sd.id];
                              return (
                                <div key={sd.id} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, background:'rgba(0,230,138,0.05)', border:'1px solid rgba(0,230,138,0.12)' }}>
                                  <span style={{ fontWeight:600, color:'rgba(240,240,245,0.9)' }}>{cat?.nameRu || cat?.name || sd.id}</span>
                                  {sd.dose && <span style={{ color:'#00e68a', marginLeft:4 }}>{sd.dose}</span>}
                                  {sd.timing && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:4 }}>{sd.timing}</span>}
                                  {sd.mechanism && <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', lineHeight:1.35, marginTop:2 }}>— {sd.mechanism}</div>}
                                </div>
                              );
                            })}
                          </div>
                          {(st.contraindications || st.warnings) && (
                            <div style={{ marginTop:8 }}>
                              {st.contraindications && (
                                <div style={{ fontSize:11, color:'#f87171', lineHeight:1.45 }}>
                                  <b>⛔ Противопоказания:</b> {st.contraindications}
                                </div>
                              )}
                              {st.warnings && (
                                <div style={{ fontSize:11, color:'#fbbf24', lineHeight:1.45, marginTop:3 }}>
                                  <b>⚠ Осторожности / предосторожности:</b> {st.warnings}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Попап Мега-усиления (умный подбор по gaps + синергии) ── */}
      {showMegaPopup && ReactDOM.createPortal(
         <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setShowMegaPopup(false)}>
            <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:400, borderRadius:18, background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'88vh', display:'flex', flexDirection:'column', color:'#fff' }}>
             <div style={{ height:3, background:'linear-gradient(90deg,#f87171,#ef4444)' }} />
             <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
               <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                 <span style={{ fontSize:13, fontWeight:800, color:'#f87171' }}>🚀 Мега-усиление</span>
                <button onClick={() => setShowMegaPopup(false)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:10, fontWeight:600 }}>✕</button>
              </div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:4, lineHeight:1.3 }}>
                Умный подбор по непокрытым механизмам ТЗ ({finalRec?.gaps?.length || 0} gaps) и синергии с текущими препаратами ({finalRec?.subs?.length || 0})
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'10px 14px 14px' }}>
              {megaSuggestions.length === 0 ? (
                <div style={{ padding:'20px 10px', textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:10, lineHeight:1.5 }}>
                  {state.pharma.aas.length === 0
                    ? '💡 Добавьте препараты курса (PED) или введите лаб-данные — Мега подберёт усиление по непокрытым механизмам.'
                    : '✅ Все доступные вещества уже в плане. Проверьте лаб-данные для активации дополнительных механизмов.'}
                </div>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:'#f87171' }}>Найдено {megaSuggestions.length} веществ</span>
                    <button onClick={() => setMegaSelected(new Set(megaSuggestions.map(s => s.substanceId)))}
                    style={{ padding:'5px 11px', borderRadius:7, border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.12)', color:'#fca5a5', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                      ✅ Все
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {megaSuggestions.map(s => {
                      const active = megaSelected.has(s.substanceId);
                      return (
                        <div key={s.substanceId} onClick={() => setMegaSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(s.substanceId)) next.delete(s.substanceId);
                          else next.add(s.substanceId);
                          return next;
                        })}
                          style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer',
                            background: active ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)',
                            border: active ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                            <span style={{ fontSize:11, minWidth:14, color: active ? '#f87171' : 'rgba(255,255,255,0.4)', marginTop:1 }}>{active ? '✓' : '○'}</span>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:10, fontWeight:700, color: active ? '#fca5a5' : 'rgba(240,240,245,0.9)', lineHeight:1.2 }}>
                                {subNameRu(s.substanceId)}
                              </div>
                              <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', lineHeight:1.3, marginTop:2 }}>
                                {s.reason}
                              </div>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', marginTop:3, display:'flex', gap:5, flexWrap:'wrap' }}>
                                <span>📊 {s.mechsCovered.length} мех.</span>
                                {s.synergyWith.length > 0 && (
                                  <span style={{ color:'#fbbf24', fontWeight:700 }}>⚡ синергия: {s.synergyWith.map(x => subNameRu(x)).join(', ')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            {megaSuggestions.length > 0 && (
              <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => { setMegaSelected(new Set()); setShowMegaPopup(false); }}
                    style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
                    Отмена
                  </button>
                  <button onClick={() => {
                    const newSubs = Array.from(megaSelected).filter(sid =>
                      !(finalRec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid))
                    );
                    requestAddSubs(newSubs);
                    setShowMegaPopup(false);
                  }}
                    disabled={megaSelected.size === 0}
                    style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor: megaSelected.size > 0 ? 'pointer' : 'default', border:'none', color:'#000',
                      background: megaSelected.size > 0 ? 'linear-gradient(135deg,#f87171,#ef4444)' : 'rgba(255,255,255,0.06)' }}>
                    ✅ Добавить ({megaSelected.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      , document.body)}

      {/* ── Универсальные системные popup-ы: тот же каркас, что у Нейро/Кровь/Суставы ── */}
      {genericEnhancementPopup && GENERIC_ENHANCEMENT_CONFIG[genericEnhancementPopup] && ReactDOM.createPortal((() => {
        const cfg = GENERIC_ENHANCEMENT_CONFIG[genericEnhancementPopup];
        const labs = labSliceToValues(state.labs.fullPanel);
        const domains = SPECIALIZED_DOMAINS[genericEnhancementPopup] || [];
        const activeDomains = domains.filter(d => d.trigger?.(labs, state));
        const activeMarkers = cfg.markers.filter(m => labs[m] != null);
        const selected = genericEnhancementSelected;
        const activePreset = cfg.presets.find(p => p.ids.every(id => selected.has(id)))?.id || null;
        const autoIds = Array.from(new Set(activeDomains.flatMap(d => d.ids)));
        const systemWarnings: string[] = [];
        if (genericEnhancementPopup === 'cardio' && (selected.has('telmisartan') || selected.has('tadalafil') || selected.has('nebivolol'))) systemWarnings.push('Кардио-комбинации требуют контроля АД и ЧСС; при головокружении/брадикардии не повышать дозы.');
        if (genericEnhancementPopup === 'renal' && (selected.has('electrolyte_balance') || selected.has('potassium') || selected.has('telmisartan'))) systemWarnings.push('K⁺/eGFR/креатинин обязательны; не добавлять калий при гиперкалиемии или ХБП без врача.');
        if (genericEnhancementPopup === 'endocrine' && selected.has('cabergoline')) systemWarnings.push('Каберголин: только подтверждённый PRL, повторный анализ/макропролактин и обязательное назначение врача.');
        if (genericEnhancementPopup === 'metabolic' && (state.pharma.hasInsulin || state.pharma.hasGH) && (selected.has('berberine') || selected.has('alpha_lipoic') || selected.has('chromium'))) systemWarnings.push('GH/инсулин + метаболические усилители требуют контроля глюкозы и риска гипогликемии.');
        if (genericEnhancementPopup === 'musculoskeletal' && (selected.has('bpc157') || selected.has('tb500') || selected.has('ghk_cu'))) systemWarnings.push('Пептидный LV3-блок имеет исследовательский статус и не является обычной БАД-поддержкой.');
        const toggle = (id: string) => setGenericEnhancementSelected(prev => {
          const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
        });
        const renderGroup = (title: string, ids: string[], color: string) => (
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:9, fontWeight:800, color, marginBottom:4 }}>{title}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
              {ids.map(id => {
                const inPlan = (finalRec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(id));
                const checked = selected.has(id) || inPlan;
                return <button key={id} disabled={inPlan} onClick={() => toggle(id)} style={{ padding:'6px 7px', borderRadius:7, textAlign:'left', cursor:inPlan ? 'default' : 'pointer', background:checked ? `${color}20` : 'rgba(255,255,255,0.03)', border:`1px solid ${checked ? color+'66' : 'rgba(255,255,255,0.08)'}`, color:'#fff', opacity:inPlan ? 0.55 : 1, minWidth:0 }}>
                  <div style={{ fontSize:8, fontWeight:700, overflowWrap:'anywhere' }}>{checked ? '✓ ' : '○ '}{subNameRu(id)}</div>
                  <div style={{ fontSize:6, color:'rgba(255,255,255,0.55)', marginTop:2, lineHeight:1.3 }}>механизм: {cfg.domains.slice(0,2).join(', ')}</div>
                </button>;
              })}
            </div>
          </div>
        );
        return <div style={{ position:'fixed', inset:0, zIndex:310, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.82)', padding:12 }} onClick={() => setGenericEnhancementPopup(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'94%', maxWidth:420, maxHeight:'90vh', overflow:'hidden', overflowWrap:'anywhere', wordBreak:'break-word', display:'flex', flexDirection:'column', borderRadius:18, background:'#16161a', border:`1px solid ${cfg.color}55`, color:'#fff' }}>
            <div style={{ padding:'13px 14px 9px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><span style={{ fontSize:13, fontWeight:800, color:cfg.color }}>{cfg.icon} {cfg.label} — усиление</span><button onClick={() => setGenericEnhancementPopup(null)} style={{ color:'#fff', background:'transparent', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>✕</button></div>
              <div style={{ fontSize:8, color:'#fff', opacity:.7, lineHeight:1.4, marginTop:5, overflowWrap:'anywhere' }}>{cfg.notes}</div>
            </div>
            <div style={{ overflowY:'auto', padding:'10px 14px', minHeight:0 }}>
              <div style={{ padding:'7px 8px', marginBottom:8, borderRadius:8, background:`${cfg.color}12`, border:`1px solid ${cfg.color}30`, fontSize:8, lineHeight:1.5 }}>
                <b>Механизмы:</b> {cfg.domains.join(' · ')}<br/>
                <b>Анализы:</b> {activeMarkers.length ? activeMarkers.map(m => `${m} ${labs[m]}`).join(', ') : 'нет данных — поддержка по фармакологии курса, нужен контроль'}
              </div>
              <CalcSystemPanel
                risk={systemRiskOf(genericEnhancementPopup)}
                panel={SYSTEM_PANELS.find(p => p.id === SYSTEM_TO_PANEL[genericEnhancementPopup]) || null}
                contra={finalRec?.contraindications || []}
              />
              {activeDomains.length > 0 && <button onClick={() => setGenericEnhancementSelected(new Set(autoIds))} style={{ width:'100%', padding:'8px', marginBottom:8, borderRadius:8, border:`1px solid ${cfg.color}66`, background:`${cfg.color}18`, color:'#fff', fontSize:8, fontWeight:800, cursor:'pointer', textAlign:'left' }}>⚡ AUTO по данным: {activeDomains.map(d => d.label).join(' · ')} ({autoIds.length} кандидатов)</button>}
              <div style={{ fontSize:9, fontWeight:800, color:'#fff', marginBottom:5 }}>📊 Контрольные маркеры</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:9 }}>{cfg.markers.map(m => <span key={m} style={{ fontSize:7, padding:'2px 5px', borderRadius:4, background:labs[m] != null ? `${cfg.color}25` : 'rgba(255,255,255,0.05)', color:'#fff' }}>{m}{labs[m] != null ? `: ${labs[m]}` : ' · нет'}</span>)}</div>
              <div style={{ fontSize:9, fontWeight:800, color:'#fff', marginBottom:4 }}>⚡ Быстрые протоколы</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, marginBottom:9 }}>
                {cfg.presets.map(p => <button key={p.id} onClick={() => setGenericEnhancementSelected(new Set(p.ids))} style={{ padding:'7px 4px', borderRadius:7, border:`1px solid ${activePreset === p.id ? cfg.color+'aa' : 'rgba(255,255,255,0.12)'}`, background:activePreset === p.id ? `${cfg.color}25` : 'rgba(255,255,255,0.03)', color:'#fff', fontSize:8, fontWeight:700, cursor:'pointer' }}>LV{p.level} {p.label}</button>)}
              </div>
              <div style={{ fontSize:9, fontWeight:800, color:'#fff', marginBottom:4 }}>🧬 Специализированные домены системы</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:9 }}>
                {domains.map(d => {
                  const active = activeDomains.some(x => x.id === d.id);
                  return <button key={d.id} onClick={() => setGenericEnhancementSelected(prev => {
                    const next = new Set(prev); d.ids.forEach(id => next.add(id)); return next;
                  })} style={{ padding:'7px', borderRadius:7, textAlign:'left', cursor:'pointer', background:active ? `${cfg.color}20` : 'rgba(255,255,255,0.03)', border:`1px solid ${active ? cfg.color+'77' : 'rgba(255,255,255,0.1)'}`, color:'#fff', minWidth:0 }}>
                    <div style={{ fontSize:8, fontWeight:800 }}>{d.icon} {d.label}</div>
                    <div style={{ fontSize:6, color:'rgba(255,255,255,0.58)', marginTop:2, lineHeight:1.3 }}>{d.markers.map(m => `${m}${labs[m] != null ? `=${labs[m]}` : ''}`).join(' · ')}</div>
                    {active && <div style={{ fontSize:6, color:cfg.color, marginTop:2 }}>⚡ активен по данным</div>}
                  </button>;
                })}
              </div>
              {renderGroup('LV1 · базовая поддержка', cfg.core, cfg.color)}
              {renderGroup('LV2 · усиление по системе/симптомам', cfg.lv2, '#fbbf24')}
              {renderGroup('LV3 · только при показаниях/под контролем', cfg.lv3, '#f87171')}
              {systemWarnings.length > 0 && <div style={{ marginTop:8, padding:'7px 8px', borderRadius:7, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.26)', color:'#fff', fontSize:7, lineHeight:1.45, overflowWrap:'anywhere' }}>{systemWarnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}
              <div style={{ padding:'6px 8px', borderRadius:7, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#fff', fontSize:7, lineHeight:1.45, overflowWrap:'anywhere' }}>⚠ Выбранные элементы проходят дедупликацию, safety-проверку и лимит текущего уровня перед добавлением.</div>
            </div>
            <div style={{ display:'flex', gap:6, padding:'9px 14px', borderTop:'1px solid rgba(255,255,255,0.08)', background:'#16161a' }}>
              <button onClick={() => setGenericEnhancementPopup(null)} style={{ flex:1, padding:9, borderRadius:8, color:'#fff', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', cursor:'pointer' }}>Отмена</button>
              <button onClick={() => { const add = Array.from(selected).filter(id => !(finalRec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(id))); requestAddSubs(add); setGenericEnhancementPopup(null); }} style={{ flex:2, padding:9, borderRadius:8, color:'#000', background:cfg.color, border:'none', fontWeight:800, cursor:'pointer' }}>Добавить ({selected.size})</button>
            </div>
          </div>
        </div>;
      })(), document.body)}

      {/* ── Попап анализа доп. модуля (ПОРТАЛ — экранирует backdrop-filter предка) ── */}
      {stackModulePopup && ReactDOM.createPortal((() => {
        // Для articular_stack — новый попап с протоколами и выбором
        if (stackModulePopup === 'articular_stack') {
          const planIds = new Set((rec?.subs || []).map(s => canonIdLocal(s.substanceId)));
          const symptoms = state.symptoms || [];
          const labs = labSliceToValues(state.labs.fullPanel);
          const jointPain = state.oda.jointPain;
          const hasJointSymptom = symptoms.includes('joint_pain');
          const crp = labs['CRP'] || labs['HSCRP'];
          const pedJointsTier = finalRecWithResidual?.pedRisk?.jointsBoosterTier ?? 0;
          const pedJointsRisk = finalRecWithResidual?.pedRisk?.jointsRisk ?? 'none';
          const grossJointsTier = finalRecWithResidual?.pedRisk?.grossJointsTier ?? pedJointsTier;
          const jointsCoverage = finalRecWithResidual?.pedRisk?.jointsCoverage;
          const jointScore = (hasJointSymptom ? 20 : 0) + (jointPain === 'severe' ? 30 : jointPain === 'moderate' ? 15 : jointPain === 'mild' ? 5 : 0) + (crp && crp > 3 ? 15 : 0) + (pedJointsTier >= 2 ? 30 : pedJointsTier === 1 ? 10 : 0);
          const presetColor = jointScore < 20 ? '#22c55e' : jointScore < 40 ? '#f59e0b' : jointScore < 60 ? '#f97316' : '#ef4444';

          const toggleSub = (id: string) => {
            setArticularSelected(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          };
          const toggleJointSymptom = (code: string) => setJointSymptoms(prev => {
            const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next;
          });
          const jointDomainScores = JOINT_DOMAINS.map(d => ({ d, score: Math.min(10, d.symptoms.filter(s => jointSymptoms.has(s.code)).length * 3) }));
          const jointRecSet = new Set<string>();
          jointDomainScores.forEach(({ d, score }) => { if (score >= 6) d.substances.forEach(id => jointRecSet.add(id)); });
          JOINT_RECOMMENDED_HIGH.forEach(id => jointRecSet.add(id));
          JOINT_RECOMMENDED_MEDIUM.forEach(id => jointRecSet.add(id));
          const jointDomainOf = (id: string) => JOINT_DOMAINS.filter(d => d.substances.has(id));

          return (
            <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => { setStackModulePopup(null); setArticularConfirm(false); }}>
               <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, borderRadius:18, overflowWrap:'anywhere', wordBreak:'break-word', background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
                  <div style={{ height:3, background:'linear-gradient(90deg,#4ade80,#22c55e)' }} />
                 <div style={{ flex:'1 1 0%', minHeight:0, padding:'14px 14px 16px', overflowY:'auto' }}>
                  {/* Заголовок + контекст */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                   <span style={{ fontSize:13, fontWeight:800, color:'#4ade80' }}>🦴 Суставы/Связки — подбор поддержки</span>
                   <button onClick={() => { setStackModulePopup(null); setArticularConfirm(false); }} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', lineHeight:1.4, marginBottom:8, padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    {jointScore < 20 ? '🟢 Низкий риск — профилактика' : jointScore < 40 ? '🟡 Умеренный риск — базовая поддержка' : jointScore < 60 ? '🟠 Высокий риск — усиленная защита' : '🔴 Критический — максимальная защита'}
                    {hasJointSymptom ? ' · боль в суставах' : ''}{crp && crp > 3 ? ` · CRP ${crp}` : ''}
                    {pedJointsTier > 0 && <span style={{ color:'#4ade80', fontWeight:700 }}> · ⚡ PED AUTO LV{pedJointsTier} ({pedJointsRisk})</span>}
                  </div>

                  <DomainSymptomMap domains={JOINT_DOMAINS} checked={jointSymptoms} onToggle={toggleJointSymptom} />

                  {/* Пресеты-протоколы */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#4ade80', marginBottom:5 }}>📋 Быстрые протоколы</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
                    {JOINT_PRESETS.map(p => {
                      const active = articularPreset === p.id;
                      return (
                        <div key={p.id} onClick={() => {
                          if (articularPreset === p.id) {
                            setArticularPreset(null);
                            setArticularSelected(new Set());
                          } else {
                            setArticularPreset(p.id);
                            setArticularSelected(new Set(p.subs));
                          }
                        }} style={{
                          padding:'7px 8px', borderRadius:8, cursor:'pointer',
                          background: active ? `${p.color}18` : 'rgba(255,255,255,0.02)',
                          border: active ? `1.5px solid ${p.color}55` : '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ fontSize:14 }}>{p.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:9, fontWeight:700, color: active ? p.color : '#ffffff' }}>{p.name} {active && '✓'}</div>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{p.desc}</div>
                            </div>
                          </div>
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:3, display:'flex', flexWrap:'wrap', gap:2 }}>
                            {p.subs.map(sid => <span key={sid} style={{ background:'rgba(255,255,255,0.04)', padding:'1px 4px', borderRadius:3 }}>{subNameRu(sid).slice(0,10)}</span>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ⚡ PED-AUTO preset: авто-выбор по PED-risk tier */}
                  {pedJointsTier > 0 && (() => {
                    const pedAutoIds = getJointsBoosterSubstanceIds(pedJointsTier)
                      .filter(id => JOINT_CATALOG.some(c => c.id === id || canonIdLocal(c.id) === canonIdLocal(id)));
                    const pedAutoActive = pedAutoIds.length > 0 && pedAutoIds.every(id => articularSelected.has(id));
                    return (
                      <div onClick={() => {
                        if (pedAutoActive) {
                          setArticularPreset(null);
                          setArticularSelected(new Set());
                        } else {
                          setArticularPreset('ped_auto');
                          setArticularSelected(new Set(pedAutoIds));
                        }
                      }} style={{
                        padding:'7px 8px', borderRadius:8, cursor:'pointer', marginBottom:6,
                        background: pedAutoActive ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.06)',
                        border: pedAutoActive ? '1.5px solid #4ade8055' : '1.5px solid #4ade8030',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontSize:14 }}>⚡</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:9, fontWeight:700, color: pedAutoActive ? '#4ade80' : '#4ade80' }}>
                              PED AUTO — LV{grossJointsTier}{pedJointsTier !== grossJointsTier ? ` → LV${pedJointsTier}` : ''} ({pedJointsRisk}) {pedAutoActive && '✓'}
                            </div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                              Авто-выбор по стеку PED: {pedAutoIds.length} веществ
                            </div>
                          </div>
                        </div>
                        {pedAutoIds.length > 0 && (
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:3, display:'flex', flexWrap:'wrap', gap:2 }}>
                            {pedAutoIds.slice(0,6).map(sid => <span key={sid} style={{ background:'rgba(74,222,128,0.08)', padding:'1px 4px', borderRadius:3 }}>{subNameRu(sid).slice(0,12)}</span>)}
                            {pedAutoIds.length > 6 && <span style={{color:'rgba(255,255,255,0.2)'}}>+{pedAutoIds.length-6}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Рекомендация по пресету */}
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginBottom:6, padding:'4px 8px', borderRadius:6, background:presetColor+'10', border:`1px solid ${presetColor}22` }}>
                    🔍 Рекомендованный: <b style={{color:presetColor}}>
                      {jointScore < 20 ? 'Ядро' : jointScore < 40 ? 'Ядро + База' : jointScore < 60 ? 'Ядро + База + Усиление' : 'Полный протокол (все фазы)'}
                    </b>
                  </div>

                  <CalcSystemPanel
                    risk={null}
                    panel={SYSTEM_PANELS.find(p => p.id === 'oda') || null}
                    contra={finalRec?.contraindications || []}
                    note="ОДА (суставы/связки) не входит в 6 систем механизм-модели риска — контроль по маркерам и УЗИ, поддержка влияет на кардио/метаболический контур косвенно."
                  />

                  {/* Список веществ */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#ffffff', marginBottom:4 }}>💊 Выберите вещества ({articularSelected.size} из {JOINT_CATALOG.length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:8 }}>
                    {JOINT_CATALOG.map(item => {
                      const selected = articularSelected.has(item.id);
                      const inPlan = planIds.has(canonIdLocal(item.id));
                      const isRecommended = jointRecSet.has(item.id);
                      const itemDomains = jointDomainOf(item.id);
                      return (
                        <div key={item.id} onClick={() => { if (!inPlan) toggleSub(item.id); }}
                          style={{
                            display:'flex', alignItems:'flex-start', gap:6, padding:'6px 8px', borderRadius:7, cursor: inPlan ? 'default' : 'pointer',
                            background: inPlan ? 'rgba(0,230,138,0.04)' : selected ? 'rgba(129,140,248,0.06)' : 'rgba(255,255,255,0.02)',
                            border: inPlan ? '1px solid rgba(0,230,138,0.12)' : selected ? '1px solid rgba(129,140,248,0.15)' : '1px solid rgba(255,255,255,0.04)',
                            opacity: inPlan ? 0.5 : 1,
                          }}>
                          <div style={{ width:18, height:18, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
                            background: inPlan ? 'rgba(0,230,138,0.15)' : selected ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.05)',
                            fontSize:10, fontWeight:700, color: inPlan ? '#00e68a' : selected ? '#818cf8' : 'rgba(255,255,255,0.3)' }}>
                            {inPlan ? '✓' : selected ? '✓' : ''}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                              <span style={{ fontSize:9, fontWeight:600, color: inPlan ? 'rgba(255,255,255,0.4)' : '#ffffff' }}>{item.nameRu}</span>
                              <span style={{ fontSize:7, fontWeight:600, color:'rgba(255,255,255,0.4)', padding:'0px 3px', borderRadius:3, background:'rgba(255,255,255,0.04)' }}>{item.dose}</span>
                              {item.id === 'voltaren_gel' && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.18)', color:'#93c5fd', fontWeight:700 }}>🧴 местно · НЕ таблетка</span>}
                              {isRecommended && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', fontWeight:700 }}>рек.</span>}
                              {inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:700 }}>в плане</span>}
                            </div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:1 }}>{item.desc}</div>
                            {itemDomains.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                {itemDomains.map(d => (
                                  <span key={d.id} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:d.color+'18', color:d.color, fontWeight:600 }}>{d.label}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Кнопки действий */}
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setStackModulePopup(null); setArticularConfirm(false); }} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>Отмена</button>
               <button onClick={() => {
                       if (articularSelected.size === 0) return;
                       setArticularConfirm(true);
                       setStackModulePopup(null);
                     }} style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor:'pointer', border:'none', color:'#000',
                       background: articularSelected.size > 0 ? 'linear-gradient(135deg,#4ade80,#22c55e)' : 'rgba(255,255,255,0.06)',
                     }}>
                       ✅ Добавить ({articularSelected.size} веществ)
                     </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // ── Нейропротекция: пресеты + выбор ──
        if (stackModulePopup === 'neuroprotection_stack') {
          const planIds = new Set((rec?.subs || []).map(s => canonIdLocal(s.substanceId)));
          const symptoms = state.symptoms || [];
          const hasInsomnia = symptoms.includes('insomnia');
          const hasAnxiety = symptoms.includes('anxiety');
          const sleepHours = state.profile.sleepHours || 7;
          const stressLevel = state.profile.stressLevel || 5;
          const aggressionScore = state.neuro.aggressionScore || 0;
          const pedNeuroTier = finalRecWithResidual?.pedRisk?.neuroBoosterTier ?? 0;
          const pedNeuroRisk = finalRecWithResidual?.pedRisk?.neuroRisk ?? 'none';
          const grossNeuroTier = finalRecWithResidual?.pedRisk?.grossNeuroTier ?? pedNeuroTier;
          const neuroCoverage = finalRecWithResidual?.pedRisk?.neuroCoverage;
          const neuroScore = (hasInsomnia ? 20 : 0) + (hasAnxiety ? 15 : 0) + (sleepHours < 7 ? 15 : 0) + (stressLevel > 7 ? 20 : 0) + (aggressionScore > 6 ? 15 : 0) + (pedNeuroTier >= 2 ? 30 : pedNeuroTier === 1 ? 10 : 0);
          const presetColor = neuroScore < 20 ? '#22c55e' : neuroScore < 40 ? '#f59e0b' : neuroScore < 60 ? '#f97316' : '#ef4444';

          const toggleSub = (id: string) => { setNeuroSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
          const toggleNeuroSymptom = (code: string) => setNeuroSymptoms(prev => {
            const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next;
          });
          const neuroDomainScores = NEURO_DOMAINS.map(d => ({ d, score: Math.min(10, d.symptoms.filter(s => neuroSymptoms.has(s.code)).length * 3) }));
          const neuroRecSet = new Set<string>();
          neuroDomainScores.forEach(({ d, score }) => { if (score >= 6) d.substances.forEach(id => neuroRecSet.add(id)); });
          NEURO_RECOMMENDED_HIGH.forEach(id => neuroRecSet.add(id));
          NEURO_RECOMMENDED_MEDIUM.forEach(id => neuroRecSet.add(id));
          const neuroDomainOf = (id: string) => NEURO_DOMAINS.filter(d => d.substances.has(id));

          return (
            <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => { setStackModulePopup(null); setNeuroConfirm(false); }}>
               <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:380, borderRadius:18, overflowWrap:'anywhere', wordBreak:'break-word', background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
                  <div style={{ height:3, background:'linear-gradient(90deg,#818cf8,#6366f1)' }} />
                 <div style={{ flex:'1 1 0%', minHeight:0, padding:'14px 14px 16px', overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                   <span style={{ fontSize:13, fontWeight:800, color:'#818cf8' }}>🧠 Нейропротекция — подбор поддержки</span>
                   <button onClick={() => { setStackModulePopup(null); setNeuroConfirm(false); }} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                  </div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', lineHeight:1.4, marginBottom:8, padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)' }}>
                    {neuroScore < 20 ? '🟢 Низкий риск — профилактика' : neuroScore < 40 ? '🟡 Умеренный риск — базовая поддержка' : neuroScore < 60 ? '🟠 Высокий риск — усиленная защита' : '🔴 Критический — максимальная защита'}
                    {hasInsomnia ? ' · бессонница' : ''}{hasAnxiety ? ' · тревога' : ''}{sleepHours < 7 ? ` · сон ${sleepHours}ч` : ''}{stressLevel > 7 ? ` · стресс ${stressLevel}/10` : ''}
                    {pedNeuroTier > 0 && <span style={{ color:'#818cf8', fontWeight:700 }}> · ⚡ PED AUTO LV{pedNeuroTier} ({pedNeuroRisk})</span>}
                  </div>

                  <CalcSystemPanel risk={systemRiskOf('cns')} panel={SYSTEM_PANELS.find(p => p.id === 'cns') || null}
                    contra={finalRec?.contraindications || []} />

                  <DomainSymptomMap domains={NEURO_DOMAINS} checked={neuroSymptoms} onToggle={toggleNeuroSymptom} />

                  {/* Пресеты */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#818cf8', marginBottom:5 }}>📋 Быстрые протоколы</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
                    {NEURO_PRESETS.map(p => {
                      const active = neuroPreset === p.id;
                      return (
                        <div key={p.id} onClick={() => {
                          if (neuroPreset === p.id) { setNeuroPreset(null); setNeuroSelected(new Set()); }
                          else { setNeuroPreset(p.id); setNeuroSelected(new Set(p.subs)); }
                        }} style={{
                          padding:'7px 8px', borderRadius:8, cursor:'pointer',
                          background: active ? `${p.color}18` : 'rgba(255,255,255,0.02)',
                          border: active ? `1.5px solid ${p.color}55` : '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ fontSize:14 }}>{p.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:9, fontWeight:700, color: active ? p.color : '#ffffff' }}>{p.name} {active && '✓'}</div>
                              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{p.desc}</div>
                            </div>
                          </div>
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:3, display:'flex', flexWrap:'wrap', gap:2 }}>
                            {p.subs.slice(0,3).map(sid => <span key={sid} style={{ background:'rgba(255,255,255,0.04)', padding:'1px 4px', borderRadius:3 }}>{subNameRu(sid).slice(0,12)}</span>)}
                            {p.subs.length > 3 && <span style={{ color:'rgba(255,255,255,0.2)' }}>+{p.subs.length-3}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 📜 Нейро-протокол (из протоколов поддержки) */}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'#818cf8', marginBottom:4 }}>📜 Нейро-протокол (фазы)</div>
                    {[
                      { label: 'Фаза 1 — профилактика', cond: 'любой курс ААС', color: '#22c55e', items: ['NAC 1200-2400 мг (утро+вечер)', 'Таурин 2-3 г (утро+вечер)', 'Глицин 3 г (на ночь)', 'Магний (цитрат/глицинат) 400 мг'] },
                      { label: 'Фаза 2 — усиление', cond: 'доза >500 мг/нед или >2 циклов', color: '#f59e0b', items: ['L-Теанин 200 мг', 'Ашваганда 300-600 мг (кортизол)', 'Агматин 1 г 2р/день (NMDA/NO)', 'Альфа-липоевая 300 мг (Nrf2)'] },
                      { label: 'Фаза 3 — 19-nor', cond: 'трен/нандролон/стимуляторы', color: '#f97316', items: ['Mg-L-треонат 2000 мг (сон/нейро)', 'Фосфатидилсерин 300-400 мг (HPA)', 'B12 метил 1000 мкг', 'Прегненолон 10-30 мг (осторожно с 19-nor)'] },
                      { label: 'Фаза 4 — врач', cond: 'нейролептики/высокий риск', color: '#ef4444', items: ['NMDA-альтернативы: мемантин ИЛИ ламотриджин ИЛИ амантадин — НЕ комбинировать', 'α2: гуанфацин/тизанидин — только психиатр', 'Ноопепт 10-30 мг (BDNF/NGF) — только врач'] },
                    ].map(ph => (
                      <div key={ph.label} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 4, background: ph.color + '0a', border: '1px solid ' + ph.color + '28' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 7, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: ph.color + '26', color: ph.color }}>{ph.label}</span>
                          <span style={{ fontSize: 6, color: 'rgba(255,255,255,0.5)' }}>{ph.cond}</span>
                        </div>
                        <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginTop: 3, paddingLeft: 4 }}>
                          {ph.items.map((it, ii) => <div key={ii}>• {it}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ⚡ PED-AUTO preset: авто-выбор по PED-risk tier */}
                  {pedNeuroTier > 0 && (() => {
                    const pedAutoIds = getNeuroBoosterSubstanceIds(pedNeuroTier)
                      .filter(id => NEURO_CATALOG.some(c => c.id === id || canonIdLocal(c.id) === canonIdLocal(id)));
                    const pedAutoActive = pedAutoIds.length > 0 && pedAutoIds.every(id => neuroSelected.has(id));
                    return (
                      <div onClick={() => {
                        if (pedAutoActive) {
                          setNeuroPreset(null);
                          setNeuroSelected(new Set());
                        } else {
                          setNeuroPreset('ped_auto');
                          setNeuroSelected(new Set(pedAutoIds));
                        }
                      }} style={{
                        padding:'7px 8px', borderRadius:8, cursor:'pointer', marginBottom:6,
                        background: pedAutoActive ? 'rgba(129,140,248,0.15)' : 'rgba(129,140,248,0.06)',
                        border: pedAutoActive ? '1.5px solid #818cf855' : '1.5px solid #818cf830',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontSize:14 }}>⚡</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:9, fontWeight:700, color: pedAutoActive ? '#818cf8' : '#818cf8' }}>
                              PED AUTO — LV{grossNeuroTier}{pedNeuroTier !== grossNeuroTier ? ` → LV${pedNeuroTier}` : ''} ({pedNeuroRisk}) {pedAutoActive && '✓'}
                            </div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                              Авто-выбор по стеку PED: {pedAutoIds.length} веществ
                            </div>
                          </div>
                        </div>
                        {pedAutoIds.length > 0 && (
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.3)', marginTop:3, display:'flex', flexWrap:'wrap', gap:2 }}>
                            {pedAutoIds.slice(0,6).map(sid => <span key={sid} style={{ background:'rgba(129,140,248,0.08)', padding:'1px 4px', borderRadius:3 }}>{subNameRu(sid).slice(0,12)}</span>)}
                            {pedAutoIds.length > 6 && <span style={{color:'rgba(255,255,255,0.2)'}}>+{pedAutoIds.length-6}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', marginBottom:6, padding:'4px 8px', borderRadius:6, background:presetColor+'10', border:`1px solid ${presetColor}22` }}>
                    🔍 Рекомендованный: <b style={{color:presetColor}}>
                      {neuroScore < 20 ? 'Сон' : neuroScore < 40 ? 'Сон + Стресс' : neuroScore < 60 ? 'Сон + Стресс + Когнитив' : 'Полный протокол (все фазы)'}
                    </b>
                  </div>

                  {/* Вещества */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#ffffff', marginBottom:4 }}>💊 Выберите вещества ({neuroSelected.size} из {NEURO_CATALOG.length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:8 }}>
                    {NEURO_CATALOG.map(item => {
                      const selected = neuroSelected.has(item.id);
                      const inPlan = planIds.has(canonIdLocal(item.id));
                      const isRecommended = neuroRecSet.has(item.id);
                      const itemDomains = neuroDomainOf(item.id);
                      return (
                        <div key={item.id} onClick={() => { if (!inPlan) toggleSub(item.id); }}
                          style={{
                            display:'flex', alignItems:'flex-start', gap:6, padding:'6px 8px', borderRadius:7, cursor: inPlan ? 'default' : 'pointer',
                            background: inPlan ? 'rgba(0,230,138,0.04)' : selected ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
                            border: inPlan ? '1px solid rgba(0,230,138,0.12)' : selected ? '1px solid rgba(99,102,241,0.15)' : '1px solid rgba(255,255,255,0.04)',
                            opacity: inPlan ? 0.5 : 1,
                          }}>
                          <div style={{ width:18, height:18, borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
                            background: inPlan ? 'rgba(0,230,138,0.15)' : selected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                            fontSize:10, fontWeight:700, color: inPlan ? '#00e68a' : selected ? '#818cf8' : 'rgba(255,255,255,0.3)' }}>
                            {inPlan ? '✓' : selected ? '✓' : ''}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                              <span style={{ fontSize:9, fontWeight:600, color: inPlan ? 'rgba(255,255,255,0.4)' : '#ffffff' }}>{item.nameRu}</span>
                              <span style={{ fontSize:7, fontWeight:600, color:'rgba(255,255,255,0.4)', padding:'0px 3px', borderRadius:3, background:'rgba(255,255,255,0.04)' }}>{item.dose}</span>
                              {item.id === 'voltaren_gel' && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.18)', color:'#93c5fd', fontWeight:700 }}>🧴 местно · НЕ таблетка</span>}
                              {isRecommended && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', fontWeight:700 }}>рек.</span>}
                              {inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:700 }}>в плане</span>}
                            </div>
                            <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:1 }}>{item.desc}</div>
                            {itemDomains.length > 0 && (
                              <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                                {itemDomains.map(d => (
                                  <span key={d.id} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:d.color+'18', color:d.color, fontWeight:600 }}>{d.label}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Safety-флаг: серотонин + СИОЗС */}
                  <div style={{ fontSize:7, color:'rgba(168,85,247,0.7)', lineHeight:1.35, marginTop:6, padding:'5px 8px', borderRadius:6, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.18)' }}>
                    ⚠️ При приёме СИОЗС/СИОЗСН (антидепрессанты) избегайте 5-HTP и L-триптофан — риск серотонинового синдрома. Стимуляторы (амфетамины/модафинил): не добавляйте ночные дофаминергики.
                  </div>

                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setStackModulePopup(null); setNeuroConfirm(false); }} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>Отмена</button>
                     <button onClick={() => {
                       if (neuroSelected.size === 0) return;
                       setNeuroConfirm(true);
                       setStackModulePopup(null);
                     }} style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor:'pointer', border:'none', color:'#000',
                       background: neuroSelected.size > 0 ? 'linear-gradient(135deg,#818cf8,#6366f1)' : 'rgba(255,255,255,0.06)',
                     }}>
                        ✅ Добавить ({neuroSelected.size} веществ)
                      </button>
                   </div>
                 </div>
               </div>
             </div>
           );
        }

        // ── 🩸 HEMATO попап (по образцу Joints/Neuro) ──
        if (stackModulePopup === 'hemato_stack') {
          const pedHematoTier = finalRecWithResidual?.pedRisk?.hematoBoosterTier ?? 0;
          const pedHematoRisk = finalRecWithResidual?.pedRisk?.hematoRisk ?? 'none';
          const grossHematoTier = finalRecWithResidual?.pedRisk?.grossHematoTier ?? pedHematoTier;
          const hematoCoverage = finalRecWithResidual?.pedRisk?.hematoCoverage;
          const hematoCovered = finalRecWithResidual?.pedRisk?.hematoCovered ?? 0;
          const hematoRecommended = finalRecWithResidual?.pedRisk?.hematoRecommended ?? 0;
          const labs = labSliceToValues(state?.labs?.fullPanel);
          const hct = labs['HEMATOCRIT'] || labs['HCT'];
          const hgb = labs['HEMOGLOBIN'] || labs['HGB'];
          const plt = labs['PLT'];
          const fibrinogen = labs['FIBRINOGEN'];
          const ddimer = labs['D_DIMER'];
          // Risk score — ЕДИНЫЙ источник: механизм-модель (системный риск hematologic).
          // Локальная формула удалена (P0-2/C3): цвета/статус — от системного риска.
          const hemaSys = systemRiskOf('hematologic');
          const hematoScore = hemaSys ? Math.round(hemaSys.rawPercent) : 0;
          const riskColor = hematoScore >= 75 ? '#ef4444' : hematoScore >= 50 ? '#f97316' : hematoScore >= 25 ? '#f59e0b' : '#22c55e';
          const riskLabel = hematoScore >= 75 ? '🔴 Очень высокий' : hematoScore >= 50 ? '🔴 Высокий' : hematoScore >= 25 ? '🟠 Умеренный' : '🟢 Низкий';
          const toggleSub = (id: string) => { setHematoSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
          const toggleHematoSymptom = (code: string) => setHematoSymptoms(prev => { const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next; });
          const hematoRecSet = new Set((rec?.subs || []).map(s => canonIdLocal(s.substanceId)));
          // PED-AUTO ids
          const pedAutoIds = getHematoBoosterSubstanceIds(pedHematoTier)
            .filter(id => HEMATO_CATALOG.some(c => c.id === id || canonIdLocal(c.id) === canonIdLocal(id)));
          const pedAutoActive = pedAutoIds.length > 0 && pedAutoIds.every(id => hematoSelected.has(id));
          return ReactDOM.createPortal(
            <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setStackModulePopup(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:360, borderRadius:18, overflowWrap:'anywhere', wordBreak:'break-word', background:'#16161a', border:'1px solid rgba(20,184,166,0.2)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column', color:'#fff' }}>
                <div style={{ height:3, background:'linear-gradient(90deg,#14b8a6,#14b8a688)' }} />
                <div style={{ flex:'1 1 0%', minHeight:0, padding:'16px 14px 16px', overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'#14b8a6' }}>🩸 Кровь — гемато-защита</span>
                    <button onClick={() => setStackModulePopup(null)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                  </div>
                   <div style={{ fontSize:9, color:'#fff', lineHeight:1.5, marginBottom:8, overflowWrap:'anywhere', wordBreak:'break-word' }}>Профилактика эритроцитоза, фибринолиз, антиагрегант, реология. Синергийные группы: натто+серра+бромелайн = 3 pathway фибринолиза.</div>

                  {/* Контекст / risk score */}
                  <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:8, background:`${riskColor}10`, border:`1px solid ${riskColor}22` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:riskColor }}>{riskLabel}</span>
                      <span style={{ fontSize:8, color:'rgba(255,255,255,0.5)' }}>Риск системы: {hematoScore}%</span>
                    </div>
                    <CalcSystemPanel
                      risk={systemRiskOf('hematologic')}
                      panel={SYSTEM_PANELS.find(p => p.id === 'hema') || null}
                      contra={finalRec?.contraindications || []}
                      groups={[
                        { label: 'эритроцитоз', icon: '🩸', color: '#14b8a6', mechs: ['hem1'] },
                        { label: 'метаболизм', icon: '🍬', color: '#f97316', mechs: ['hem2', 'hem3'] },
                        { label: 'электролиты', icon: '⚡', color: '#38bdf8', mechs: ['hem4', 'hem5'] },
                      ]}
                    />
                    <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      {hct != null && <div>• Гематокрит: {hct}% {hct >= 57 ? '🔴 ургент' : hct >= 52 ? '🟠 терапия' : hct >= 48 ? '🟡 коррекция' : '🟢 норма'}</div>}
                      {hgb != null && <div>• Гемоглобин: {hgb} г/л {hgb > 175 ? '⚠️' : '✓'}</div>}
                      {plt != null && <div>• Тромбоциты: {plt} {plt > 400 ? '⚠️' : '✓'}</div>}
                      {fibrinogen != null && <div>• Фибриноген: {fibrinogen} г/л {fibrinogen > 4 ? '⚠️' : '✓'}</div>}
                      {ddimer != null && <div>• D-димер: {ddimer} мг/L {ddimer > 0.5 ? '⚠️' : '✓'}</div>}
                      {pedHematoTier > 0 && <div style={{ marginTop:2, color:'#14b8a6' }}>⚡ PED AUTO LV{grossHematoTier}{pedHematoTier !== grossHematoTier ? ` → LV${pedHematoTier}` : ''} ({pedHematoRisk}){hematoCoverage != null && hematoRecommended ? ` · ${hematoCovered}/${hematoRecommended}${pedHematoTier === 0 ? ' ✓' : ''}` : ''}</div>}
                    </div>
                  </div>

                  {/* Симптомы гипервязкости */}
                  <DomainSymptomMap domains={HEMATO_DOMAINS} checked={hematoSymptoms} onToggle={toggleHematoSymptom} />

                  {/* Quick protocols */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#ffffff', marginBottom:4 }}>⚡ Протоколы</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginBottom:8 }}>
                    {HEMATO_PRESETS.map(p => {
                      const active = hematoPreset === p.id;
                      return (
                        <button key={p.id} onClick={() => {
                          if (active) { setHematoPreset(null); setHematoSelected(new Set()); }
                          else { setHematoPreset(p.id); setHematoSelected(new Set(p.subs.filter(id => HEMATO_CATALOG.some(c => c.id === id)))); }
                        }} style={{ padding:'6px 8px', borderRadius:8, fontSize:8, fontWeight:600, cursor:'pointer', textAlign:'left',
                          background: active ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.03)',
                          border: active ? '1.5px solid #14b8a655' : '1px solid rgba(255,255,255,0.06)',
                          color: active ? '#14b8a6' : 'rgba(255,255,255,0.7)' }}>
                          <div style={{ fontWeight:700, marginBottom:1 }}>{p.name}</div>
                          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>{p.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* PED-AUTO preset */}
                  {pedHematoTier > 0 && pedAutoIds.length > 0 && (
                    <div style={{ marginBottom:8 }}>
                      <button onClick={() => {
                        if (pedAutoActive) { setHematoPreset(null); setHematoSelected(new Set()); }
                        else { setHematoPreset('ped_auto'); setHematoSelected(new Set(pedAutoIds)); }
                      }} style={{ width:'100%', padding:'8px 10px', borderRadius:8, cursor:'pointer', textAlign:'left',
                        background: pedAutoActive ? 'rgba(20,184,166,0.15)' : 'rgba(20,184,166,0.06)',
                        border: pedAutoActive ? '1.5px solid #14b8a655' : '1.5px solid #14b8a630' }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'#14b8a6' }}>⚡ PED AUTO — LV{grossHematoTier}{pedHematoTier !== grossHematoTier ? ` → LV${pedHematoTier}` : ''} ({pedHematoRisk}) {pedAutoActive && '✓'}</div>
                        <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', marginTop:2 }}>Авто-выбор по стеку PED: {pedAutoIds.length} веществ</div>
                        {pedAutoIds.length > 0 && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4 }}>
                            {pedAutoIds.slice(0,6).map(sid => <span key={sid} style={{ background:'rgba(20,184,166,0.08)', padding:'1px 4px', borderRadius:3, fontSize:7 }}>{subNameRu(sid).slice(0,12)}</span>)}
                            {pedAutoIds.length > 6 && <span style={{color:'rgba(255,255,255,0.2)', fontSize:7}}>+{pedAutoIds.length-6}</span>}
                          </div>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Ургентный баннер при Hct>57% */}
                  {hct != null && hct > 57 && (
                    <div style={{ padding:'8px 10px', borderRadius:8, marginBottom:8, background:'rgba(239,68,68,0.1)', border:'1.5px solid rgba(239,68,68,0.3)' }}>
                      <div style={{ fontSize:9, fontWeight:700, color:'#ef4444' }}>🚨 УРГЕНТ: Hct {hct}% &gt; 57%</div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.6)', marginTop:2, lineHeight:1.4 }}>
                        • <b>Эритроцитаферез</b> — первая линия (1 процедура = 3-4 кровопускания)<br/>
                        • Флеботомия 400-500 мл — fallback (если аферез недоступен)<br/>
                        • При D-димер&gt;500 или симптомах ТГВ/ТЭЛА — <b>срочная медицинская оценка</b>; антикоагулянт только по назначению врача<br/>
                        • <b>STOP AAS</b> — критично<br/>
                        • Срочная консультация гематолога
                      </div>
                    </div>
                  )}

                  {/* Substance list */}
                  <div style={{ fontSize:9, fontWeight:700, color:'#ffffff', marginBottom:4 }}>💊 Выберите вещества ({hematoSelected.size} из {HEMATO_CATALOG.length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:10 }}>
                    {HEMATO_CATALOG.map(item => {
                      const inPlan = (rec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(item.id));
                      const checked = hematoSelected.has(item.id);
                      const isRec = hematoRecSet.has(canonIdLocal(item.id));
                      return (
                        <div key={item.id} onClick={() => { if (!inPlan) toggleSub(item.id); }}
                          style={{ padding:'6px 8px', borderRadius:6, cursor: inPlan ? 'default' : 'pointer', opacity: inPlan ? 0.5 : 1,
                            background: checked ? 'rgba(20,184,166,0.12)' : 'rgba(255,255,255,0.02)',
                            border: checked ? '1px solid rgba(20,184,166,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontSize:10, color: checked ? '#14b8a6' : 'rgba(255,255,255,0.3)' }}>{checked ? '✓' : '○'}</span>
                            <div style={{ flex:1 }}>
                              <span style={{ fontSize:9, fontWeight:600, color:'#ffffff' }}>{item.nameRu}</span>
                              <span style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginLeft:4 }}>{item.dose}</span>
                              {isRec && !inPlan && <span style={{ fontSize:6, color:'#0ea5e9', marginLeft:4, padding:'1px 3px', borderRadius:2, background:'rgba(14,165,233,0.1)' }}>рек.</span>}
                              {inPlan && <span style={{ fontSize:6, color:'#0ea5e9', marginLeft:4, padding:'1px 3px', borderRadius:2, background:'rgba(0,230,138,0.1)' }}>в плане</span>}
                            </div>
                          </div>
                          <div style={{ fontSize:7, color:'rgba(255,255,255,0.45)', marginTop:1, marginLeft:18 }}>{item.desc}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setStackModulePopup(null)} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:11, fontWeight:600 }}>Отмена</button>
                    <button onClick={() => { if (hematoSelected.size > 0) { setHematoConfirm(true); setStackModulePopup(null); } }}
                      style={{ flex:2, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, color:'#000',
                        background: hematoSelected.size > 0 ? 'linear-gradient(135deg,#14b8a6,#0d9488)' : 'rgba(255,255,255,0.06)' }}>
                      ✅ Добавить ({hematoSelected.size} веществ)
                    </button>
                  </div>
                </div>
              </div>
            </div>, document.body);
        }

        // Старый попап для остальных модулей
        const { analysis, contextSummary } = analyzeStackModule(stackModulePopup, state, rec);
        const stackMeta = ALL_STACKS.find(s => s.id === stackModulePopup);
        const iconAndColor: Record<string, { icon: string; col: string }> = {
          mega_total_support_35: { icon: '🚀', col: '#f87171' },
        };
        const meta = iconAndColor[stackModulePopup] || { icon: '📦', col: '#818cf8' };
        const alreadyActive = selectedStacks.includes(stackModulePopup);
        const recommendedCount = analysis.filter(a => a.recommended && !a.inPlan).length;
        return (
           <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)' }} onClick={() => setStackModulePopup(null)}>
             <div onClick={e => e.stopPropagation()} style={{ width:'92%', maxWidth:360, borderRadius:18, overflowWrap:'anywhere', wordBreak:'break-word', background:'#16161a', border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
                <div style={{ height:3, background:`linear-gradient(90deg,${meta.col},${meta.col}88)` }} />
               <div style={{ flex:'1 1 0%', minHeight:0, padding:'16px 14px 16px', overflowY:'auto' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                 <span style={{ fontSize:13, fontWeight:800, color:meta.col }}>{meta.icon} {stackMeta?.name || stackModulePopup}</span>
                 <button onClick={() => setStackModulePopup(null)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:11, fontWeight:600 }}>✕</button>
                </div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', lineHeight:1.5, marginBottom:8 }}>{stackMeta?.problem || ''}</div>
                <div style={{ fontSize:10, fontWeight:700, color:'#ffffff', marginBottom:4 }}>📊 Анализ контекста</div>
                <div style={{ fontSize:8, color:'rgba(255,255,255,0.7)', lineHeight:1.5, marginBottom:10, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                  {contextSummary || 'Нет активных показаний'}
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:'#ffffff', marginBottom:6 }}>💊 Вещества в модуле ({analysis.length})</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
                  {analysis.map((a, i) => (
                    <div key={i} style={{ padding:'6px 8px', borderRadius:8, fontSize:8, background: a.inPlan ? 'rgba(0,230,138,0.06)' : a.recommended ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', border:`1px solid ${a.inPlan ? 'rgba(0,230,138,0.15)' : a.recommended ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                        <span style={{ fontWeight:700, color:'#ffffff' }}>{a.subName} <span style={{ color:'rgba(255,255,255,0.4)', fontWeight:500 }}>{a.dose}</span></span>
                        <div style={{ display:'flex', gap:3 }}>
                          {a.inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(0,230,138,0.15)', color:'#00e68a', fontWeight:700 }}>в плане</span>}
                          {a.recommended && !a.inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', fontWeight:700 }}>рекоменд.</span>}
                          {!a.recommended && !a.inPlan && <span style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.4)', fontWeight:700 }}>опц.</span>}
                        </div>
                      </div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>{a.contextReason}</div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:2 }}>{a.mechanism.slice(0, 80)}{a.mechanism.length > 80 ? '…' : ''}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => setStackModulePopup(null)} style={{ flex:1, padding:'10px', borderRadius:10, fontSize:10, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>Отмена</button>
                  <button onClick={() => {
                    if (!alreadyActive) setSelectedStacks(prev => [...prev, stackModulePopup]);
                    setStackModulePopup(null);
                  }} style={{ flex:2, padding:'10px', borderRadius:10, fontSize:10, fontWeight:800, cursor:'pointer', background: alreadyActive ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${meta.col},${meta.col}cc)`, border:'none', color: alreadyActive ? 'rgba(255,255,255,0.55)' : '#000' }}>
                    {alreadyActive ? '✓ Уже добавлен' : `Добавить модуль (${recommendedCount} рек.)`}
                  </button>
                </div>
                <div style={{ fontSize:7, color:'rgba(255,255,255,0.3)', marginTop:6, textAlign:'center' }}>Модуль добавляется поверх пресета. Дубли с планом автоматически исключаются.</div>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* ── Карточка подтверждения для суставного модуля ── */}
      {articularConfirm && !stackModulePopup && (
        <div style={{ marginBottom:8, padding:'10px', borderRadius:12, background:'linear-gradient(135deg,rgba(34,197,94,0.08),rgba(22,163,74,0.04))', border:'2px solid rgba(34,197,94,0.25)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#22c55e', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
            🦴 Суставы/Связки — подтверждение
          </div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginBottom:5, lineHeight:1.3 }}>
            Выбрано <b style={{color:'#4ade80'}}>{articularSelected.size}</b> веществ:
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
            {Array.from(articularSelected).map(sid => (
              <span key={sid} style={{ fontSize:8, padding:'2px 6px', borderRadius:5, fontWeight:600, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.2)', color:'#4ade80' }}>
                {subNameRu(sid)}
              </span>
            ))}
          </div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.3 }}>
            Вещества будут добавлены в план поддержки. Дубли с уже назначенными автоматически исключаются.
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setArticularConfirm(false); setArticularPreset(null); setArticularSelected(new Set()); setStackModulePopup('articular_stack'); }}
              style={{ flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
              ✕ Отмена
            </button>
            <button onClick={() => {
              const newSubs = Array.from(articularSelected).filter(sid => !(rec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid)));
              requestAddSubs(newSubs);
              setArticularConfirm(false);
              setStackModulePopup(null);
              if (!selectedStacks.includes('articular_stack')) setSelectedStacks(prev => [...prev, 'articular_stack']);
            }} style={{ flex:2, padding:'8px', borderRadius:8, fontSize:9, fontWeight:800, cursor:'pointer', background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', color:'#000' }}>
              ✅ Подтвердить и добавить в план
            </button>
          </div>
        </div>
      )}

      {/* ── Карточка подтверждения для нейропротекторного модуля ── */}
      {neuroConfirm && !stackModulePopup && (
        <div style={{ marginBottom:8, padding:'10px', borderRadius:12, background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(79,70,229,0.04))', border:'2px solid rgba(99,102,241,0.25)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#818cf8', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
            🧠 Нейропротекция — подтверждение
          </div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginBottom:5, lineHeight:1.3 }}>
            Выбрано <b style={{color:'#a5b4fc'}}>{neuroSelected.size}</b> веществ:
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
            {Array.from(neuroSelected).map(sid => (
              <span key={sid} style={{ fontSize:8, padding:'2px 6px', borderRadius:5, fontWeight:600, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc' }}>
                {subNameRu(sid)}
              </span>
            ))}
          </div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.3 }}>
            Вещества будут добавлены в план поддержки. Дубли с уже назначенными автоматически исключаются.
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setNeuroConfirm(false); setNeuroPreset(null); setNeuroSelected(new Set()); setStackModulePopup('neuroprotection_stack'); }}
              style={{ flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
              ✕ Отмена
            </button>
            <button onClick={() => {
              const newSubs = Array.from(neuroSelected).filter(sid => !(rec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid)));
              requestAddSubs(newSubs);
              setNeuroConfirm(false);
              setStackModulePopup(null);
              if (!selectedStacks.includes('neuroprotection_stack')) setSelectedStacks(prev => [...prev, 'neuroprotection_stack']);
            }} style={{ flex:2, padding:'8px', borderRadius:8, fontSize:9, fontWeight:800, cursor:'pointer', background:'linear-gradient(135deg,#818cf8,#6366f1)', border:'none', color:'#000' }}>
              ✅ Подтвердить и добавить в план
            </button>
          </div>
        </div>
      )}

      {/* ── Карточка подтверждения для гемато-модуля ── */}
      {hematoConfirm && !stackModulePopup && (
        <div style={{ marginBottom:8, padding:'10px', borderRadius:12, background:'linear-gradient(135deg,rgba(20,184,166,0.08),rgba(13,148,136,0.04))', border:'2px solid rgba(20,184,166,0.25)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#14b8a6', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
            🩸 Кровь — подтверждение
          </div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.6)', marginBottom:5, lineHeight:1.3 }}>
            Выбрано <b style={{color:'#14b8a6'}}>{hematoSelected.size}</b> веществ:
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
            {Array.from(hematoSelected).map(sid => (
              <span key={sid} style={{ fontSize:8, padding:'2px 6px', borderRadius:5, fontWeight:600, background:'rgba(20,184,166,0.12)', border:'1px solid rgba(20,184,166,0.2)', color:'#14b8a6' }}>
                {subNameRu(sid)}
              </span>
            ))}
          </div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:8, lineHeight:1.3 }}>
            Вещества будут добавлены в план поддержки. Дубли с уже назначенными автоматически исключаются.
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => { setHematoConfirm(false); setHematoPreset(null); setHematoSelected(new Set()); setStackModulePopup('hemato_stack'); }}
              style={{ flex:1, padding:'8px', borderRadius:8, fontSize:9, fontWeight:600, cursor:'pointer', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#ffffff' }}>
              ✕ Отмена
            </button>
            <button onClick={() => {
              const newSubs = Array.from(hematoSelected).filter(sid => !(rec?.subs || []).some(s => canonIdLocal(s.substanceId) === canonIdLocal(sid)));
              requestAddSubs(newSubs);
              setHematoConfirm(false);
              setStackModulePopup(null);
              if (!selectedStacks.includes('hemato_stack')) setSelectedStacks(prev => [...prev, 'hemato_stack']);
            }} style={{ flex:2, padding:'8px', borderRadius:8, fontSize:9, fontWeight:800, cursor:'pointer', background:'linear-gradient(135deg,#14b8a6,#0d9488)', border:'none', color:'#000' }}>
              ✅ Подтвердить и добавить в план
            </button>
          </div>
        </div>
      )}

      {/* ===== КАРТОЧКА СИМПТОМОВ ===== */}
      <div style={{ margin:'6px 0', borderRadius:10, overflow:'hidden' }}>
        <div onClick={() => setShowSymptoms(!showSymptoms)} style={{ padding:'7px 9px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius: showSymptoms ? '10px 10px 0 0' : 10 }}>
          <span style={{ fontSize:9, fontWeight:700, color:'#818cf8' }}>
            🩺 Симптомы (отметьте актуальные) {symptoms.length > 0 ? `(${symptoms.length})` : ''}
          </span>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <button onClick={(e) => { e.stopPropagation(); try {
              // Маппинг ID симптомов → коды pill-кнопок калькулятора
              const symMap: Record<string,string> = {
                insomnia:'insomnia', anxiety:'anxiety', mood_swings:'mood_swings', mood_swings_mood:'mood_swings',
                joint_pain:'joint_pain', joint:'joint_pain', arthralgia:'joint_pain',
                headache:'headache', head:'headache', migraines:'headache',
                palpitations:'palpitations', tachycardia:'palpitations', heart_palpitations:'palpitations',
                acne:'acne', skin_acne:'acne',
                hair_loss:'hair_loss', alopecia:'hair_loss', hair_thinning:'hair_loss',
                gynecomastia:'gynecomastia', gyno:'gynecomastia',
                edema:'edema_severe', edema_severe:'edema_severe', swelling:'edema_severe', water_retention:'edema_severe',
                low_libido:'low_libido', libido_low:'low_libido', decreased_libido:'low_libido',
                prostate:'prostate_symptoms', prostate_symptoms:'prostate_symptoms', prostate_issues:'prostate_symptoms',
                irritability:'mood_swings', aggression:'mood_swings', anger:'mood_swings',
                sleep_problems:'insomnia', sleep_disturbance:'insomnia',
                fatigue:'mood_swings', depression:'mood_swings', low_mood:'mood_swings',
                brain_fog:'mood_swings', cognitive_issues:'mood_swings',
              };
              const active = new Set<string>();
              // Источник 1: he_profile_v2 → symptoms.recent
              try {
                const raw = localStorage.getItem('he_profile_v2');
                if (raw) { const p = JSON.parse(raw); const sym = p?.settings?.symptoms?.recent || {};
                  for (const [k, v] of Object.entries(sym)) {
                    if (v && typeof v === 'object' && (v as any).score > 0) {
                      const code = symMap[k] || symMap[k.toLowerCase()] || k;
                      active.add(code);
                    }
                  }
                }
              } catch {}
              // Источник 2: he_symptom_diary (последние 7 дней, severity > 0)
              try {
                const raw2 = localStorage.getItem('he_symptom_diary');
                if (raw2) {
                  const diary = JSON.parse(raw2); const arr = Array.isArray(diary) ? diary : [];
                  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
                  for (const day of arr) {
                    if (!day?.date) continue;
                    const d = new Date(day.date);
                    if (d < weekAgo) continue;
                    for (const e of (day.entries || [])) {
                      if (e.severity > 0 && e.symptomId) {
                        const code = symMap[e.symptomId] || symMap[e.symptomId.toLowerCase()] || e.symptomId;
                        active.add(code);
                      }
                    }
                  }
                }
              } catch {}
              setSymptoms(Array.from(active));
            } catch {} }} style={{ fontSize:7, fontWeight:700, cursor:'pointer', padding:'2px 6px', borderRadius:4, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc' }}>📋 Из профиля</button>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showSymptoms ? '▲ скрыть' : '▼ показать'}</span>
          </div>
        </div>
        {showSymptoms && (
          <div style={{ padding:'7px 9px', background:'rgba(99,102,241,0.03)', border:'1px solid rgba(99,102,241,0.1)', borderTop:'none', borderRadius:'0 0 10px 10px', display:'flex', flexWrap:'wrap', gap:3 }}>
            {([
              ['gynecomastia','Гино'],['edema_severe','Отёки'],['joint_pain','Суставы'],
              ['insomnia','Бессонница'],['anxiety','Тревога'],['low_libido','Либидо↓'],
              ['hair_loss','Выпадение волос'],['prostate_symptoms','Простата'],
              ['headache','Головная боль'],['palpitations','Сердцебиение'],
              ['acne','Акне'],['mood_swings','Настроение'],
              ] as const).map(([sym, label]) => {
              const active = symptoms.includes(sym);
              return (
                <button key={sym} onClick={() => setSymptoms(prev => active ? prev.filter(s => s !== sym) : [...prev, sym])}
                  style={{ padding:'3px 7px', borderRadius:6, fontSize:8, fontWeight:600, cursor:'pointer', border:`1px solid ${active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`, background: active ? 'rgba(99,102,241,0.15)' : 'transparent', color: active ? '#a5b4fc' : 'rgba(255,255,255,0.55)' }}>
                  {active ? '✓' : ''} {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== ФАЗА КУРСА (компактно) ===== */}
      {phaseInfo && (
        <div style={{ marginBottom:8, padding:'8px 10px', borderRadius:12, background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))', border:'1px solid rgba(139,92,246,0.2)' }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#818cf8', marginBottom:2 }}>📋 Фаза: {phaseInfo.label}</div>
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', lineHeight:1.4, marginBottom:5 }}>{phaseInfo.algorithm}</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:7, padding:'2px 6px', borderRadius:5, background:'rgba(99,102,241,0.12)', color:'#818cf8', fontWeight:600 }}>Мех: {phaseInfo.coreMechs.slice(0,3).join(', ')}</span>
            <span style={{ fontSize:7, padding:'2px 6px', borderRadius:5, background:'rgba(34,197,94,0.12)', color:'#22c55e', fontWeight:600 }}>Буст: {phaseInfo.allowBoosters ? 'да' : 'нет'}</span>
            <span style={{ fontSize:7, padding:'2px 6px', borderRadius:5, background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontWeight:600 }}>Доза: ×{phaseInfo.doseTier}</span>
          </div>
        </div>
      )}

      {/* Summary */}
      {rec && (
        <div style={{ fontSize:8, fontWeight:500, color:'rgba(255,255,255,0.55)', marginBottom:6, lineHeight:1.4 }}>
          {rec.summary}
        </div>
      )}

      {/* PED-risk детали (если есть) */}
      {finalRecWithResidual?.pedRisk && (finalRecWithResidual.pedRisk.grossNeuroTier! > 0 || finalRecWithResidual.pedRisk.grossJointsTier! > 0 || finalRecWithResidual.pedRisk.grossHematoTier! > 0) && (
        <div style={{ marginBottom:6, padding:'6px 8px', borderRadius:8, background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.1)' }}>
          <div style={{ fontSize:8, fontWeight:700, color:'#a5b4fc', marginBottom:3 }}>⚡ О подборе (PED-risk, gross→net)</div>
          {(() => { const pr = finalRecWithResidual.pedRisk!; const gN = pr.grossNeuroTier ?? pr.neuroBoosterTier; const gJ = pr.grossJointsTier ?? pr.jointsBoosterTier; const gH = pr.grossHematoTier ?? pr.hematoBoosterTier; return (
            <>
          {gN > 0 && (
            <div style={{ fontSize:7, color: pr.neuroBoosterTier === 0 ? '#4ade80' : '#818cf8', lineHeight:1.4, marginBottom:2 }}>
              🧠 <b>Нейрозащита LV{gN}{pr.neuroBoosterTier !== gN ? ` → LV${pr.neuroBoosterTier}` : ''}</b> — {pr.neuroRisk}
              {pr.perSubstance.filter(ps => ps.neuro === 'high' || ps.neuro === 'moderate').slice(0,3).map(ps => ` · ${ps.substanceId}`).join('')}
              {pr.neuroCoverage != null && pr.neuroRecommended && pr.neuroBoosterTier === 0 ? ` ✓ (${pr.neuroCovered}/${pr.neuroRecommended})` : pr.neuroCoverage != null && pr.neuroRecommended ? ` (${pr.neuroCovered}/${pr.neuroRecommended})` : ''}
            </div>
          )}
          {gJ > 0 && (
            <div style={{ fontSize:7, color: pr.jointsBoosterTier === 0 ? '#4ade80' : '#4ade80', lineHeight:1.4, marginBottom:2 }}>
              🦴 <b>Суставы LV{gJ}{pr.jointsBoosterTier !== gJ ? ` → LV${pr.jointsBoosterTier}` : ''}</b> — {pr.jointsRisk}
              {pr.perSubstance.filter(ps => ps.joints === 'high' || ps.joints === 'moderate').slice(0,3).map(ps => ` · ${ps.substanceId}`).join('')}
              {pr.jointsCoverage != null && pr.jointsRecommended && pr.jointsBoosterTier === 0 ? ` ✓ (${pr.jointsCovered}/${pr.jointsRecommended})` : pr.jointsCoverage != null && pr.jointsRecommended ? ` (${pr.jointsCovered}/${pr.jointsRecommended})` : ''}
            </div>
          )}
          {gH > 0 && (
            <div style={{ fontSize:7, color: pr.hematoBoosterTier === 0 ? '#4ade80' : '#14b8a6', lineHeight:1.4, marginBottom:2 }}>
              🩸 <b>Гемато LV{gH}{pr.hematoBoosterTier !== gH ? ` → LV${pr.hematoBoosterTier}` : ''}</b> — {pr.hematoRisk}
              {pr.perSubstance.filter(ps => ps.hemato === 'high' || ps.hemato === 'moderate').slice(0,3).map(ps => ` · ${ps.substanceId}`).join('')}
              {pr.hematoCoverage != null && pr.hematoRecommended && pr.hematoBoosterTier === 0 ? ` ✓ (${pr.hematoCovered}/${pr.hematoRecommended})` : pr.hematoCoverage != null && pr.hematoRecommended ? ` (${pr.hematoCovered}/${pr.hematoRecommended})` : ''}
            </div>
          )}
            </>
          ); })()}
          {finalRecWithResidual.pedRisk.triggeredBy.length > 0 && (
            <div style={{ fontSize:6, color:'rgba(255,255,255,0.35)', lineHeight:1.3, marginTop:2 }}>
              {finalRecWithResidual.pedRisk.triggeredBy.slice(0,3).map((r,i) => <div key={i}>• {r}</div>)}
            </div>
          )}
        </div>
      )}

      {/* STOP COURSE banner (TIER 3) */}
      {rec && rec.stopCourse && (
        <div style={{ margin:'5px 0', padding:'8px 10px', borderRadius:10, background:'rgba(239,68,68,0.12)', border:'1.5px solid rgba(239,68,68,0.3)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#ef4444', marginBottom:3 }}>⛔ ОСТАНОВИТЬ КУРС</div>
          {rec.alerts?.map((a, i) => <div key={i} style={{ fontSize:8, color:'#fca5a5', marginBottom:1, lineHeight:1.4 }}>{a.message}</div>)}
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.5)', marginTop:3 }}>Рекомендации — для специалиста. Не заменяют консультацию врача.</div>
        </div>
      )}

      {/* TIER alerts (без stopCourse) */}
      {rec && !rec.stopCourse && rec.alerts && rec.alerts.length > 0 && (
        <div style={{ margin:'5px 0', padding:'7px 9px', borderRadius:8, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)' }}>
          {rec.alerts.map((a, i) => <div key={i} style={{ fontSize:8, color:'#fbbf24', marginBottom:1, lineHeight:1.4 }}>⚠ {a.message}</div>)}
        </div>
      )}

      {/* ===== РУЧНОЙ РЕЖИМ: всегда видимый план из выбранных стеков ===== */}
      {level === 'manual' && manualResultSubs.length > 0 && (
        <div style={{ marginBottom:10, padding:'10px 12px', borderRadius:12, background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.22)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:12, fontWeight:800, color:'#c084fc' }}>📦 Ручной план: {manualResultSubs.length} препарат(ов) из {selectedStacks.length} стеков</span>
            <button onClick={() => setShowManualPopup(true)} style={{ fontSize:11, fontWeight:700, cursor:'pointer', padding:'4px 9px', borderRadius:6, background:'rgba(168,85,247,0.14)', border:'1px solid rgba(168,85,247,0.3)', color:'#c084fc' }}>⚙️ Изменить</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {manualResultSubs.map((ms) => {
              const cat = SUPPORT_CATALOG_DATA[ms.id];
              return (
                <div key={ms.id} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontWeight:600, color:'rgba(240,240,245,0.9)' }}>{cat?.nameRu || cat?.name || ms.id}</span>
                  {ms.dose && <span style={{ color:'#00e68a', marginLeft:4 }}>{ms.dose}</span>}
                  {ms.timing && <span style={{ color:'rgba(255,255,255,0.55)', marginLeft:4 }}>{ms.timing}</span>}
                  <span style={{ color:'rgba(255,255,255,0.3)', marginLeft:4, fontSize:10 }}>· {ms.stack}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== НАЗНАЧЕНИЕ (результат) ===== */}
      {finalRec && finalRec.subs.length > 0 && (
        <div>
          <div onClick={() => setShowPrescription(!showPrescription)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#ffffff', display:'flex', alignItems:'center', gap:4 }}>
              💊 План поддержки: {finalRec.subs.filter(s => !NON_DRUG_IDS.has(s.substanceId)).length} препаратов
              <span style={{ fontSize:7, color:'rgba(255,255,255,0.45)', fontWeight:500 }}>
                · база {finalRec.subs.filter(s => planItemKind(s.substanceId) === 'База').length}
                · минералы {finalRec.subs.filter(s => planItemKind(s.substanceId) === 'Минерал').length}
              </span>
              {finalRec.titrationFactors && finalRec.titrationFactors.size > 0 && (
                <span style={{ fontSize:8, fontWeight:600, color:'#f59e0b', padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.15)' }}>↑{finalRec.titrationFactors.size}</span>
              )}
            </span>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showPrescription ? '▲ скрыть' : '▼ показать'}</span>
          </div>

          {showPrescription && (
            <>
              {/* Краткий список препаратов (compact summary) — без базы курса */}
              <div style={{ marginBottom:6, padding:'6px 8px', borderRadius:8, background:'rgba(24,24,27,0.3)', border:'1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize:7, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.3px' }}>Список ({finalRec.subs.filter(s => !NON_DRUG_IDS.has(s.substanceId)).length}) · база курса — в карточке «Образ жизни»</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                  {finalRec.subs.filter(s => !NON_DRUG_IDS.has(s.substanceId)).map((s, i) => {
                    const doseInfo = subDosage(s.substanceId);
                    const titrF = finalRec.titrationFactors?.get(canonIdLocal(s.substanceId));
                    const mg = doseInfo ? (titrF && titrF > 1 ? Math.round(doseInfo.mg * titrF) : doseInfo.mg) : null;
                    const isTitr = !!titrF && titrF > 1;
                    return (
                      <span key={i} style={{
                        fontSize:7, padding:'2px 6px', borderRadius:5, fontWeight:600,
                        background: isTitr ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.08)',
                        border: isTitr ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(99,102,241,0.12)',
                        color: isTitr ? '#fbbf24' : '#a5b4fc',
                      }}>
                         {planItemKind(s.substanceId) === 'База' ? '🧭 ' : planItemKind(s.substanceId) === 'Минерал' ? '⚡ ' : ''}{subNameRu(s.substanceId)}{mg ? ` ${mg}мг` : ''}
                        {isDoctorControlled(s.substanceId) && <span style={{ marginLeft:3, fontSize:6, color:'#fca5a5', fontWeight:800 }}>👨⚕️</span>}
                        {isTitr && ` ↑${((titrF! - 1) * 100).toFixed(0)}%`}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* ══ МЕНЕДЖЕР ПРЕПАРАТОВ (добавить/удалить/заменить) ══ */}
              <CalcSubstanceManager
                key={substanceManagerKey}
                finalRec={finalRec}
                onApplyChanges={(newSubs) => {
                  // синхронизируем с состоянием добавления/удаления
                  const current = finalRec.subs.map(s => s.substanceId);
                  const toRemove = current.filter(id => !newSubs.includes(id));
                  const toAdd = newSubs.filter(id => !current.includes(id));
                  setRemovedSubs(toRemove);
                  requestAddSubs(toAdd);
                  setSubstanceManagerKey(prev => prev + 1);
                }}
              />

              {/* Таблеточная нагрузка — сводка плана */}
              <SafetyPillBurden planResult={planResult} />

              {/* Детальные карточки веществ — без базы курса */}
              {finalRec.subs.filter(s => !NON_DRUG_IDS.has(s.substanceId)).map((s, i) => (
                <CalcSubstanceDetail
                  key={s.substanceId + i}
                  sub={s}
                  rec={finalRecWithResidual ?? finalRec}
                  subNameRu={subNameRu}
                  subDosage={subDosage}
                  subTier={subTier}
                  titrationFactors={finalRec.titrationFactors}
                  canonIdLocal={canonIdLocal}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* ===== ОБРАЗ ЖИЗНИ — база курса (не препараты) ===== */}
      {finalRec && finalRec.subs.some(s => NON_DRUG_IDS.has(s.substanceId)) && (() => {
        const lifestyleSubs = finalRec.subs.filter(s => NON_DRUG_IDS.has(s.substanceId));
        const impact = (id: string): string => {
          if (id === 'hydration') return '↓ HCT/HGB (гемодилюция), поддержка почек и АД';
          if (id === 'cardio_aerobic') return '↓ АД, липиды, гемоконцентрация; эндотелий';
          if (id === 'electrolyte_balance') return 'стабильный ритм, нервная проводимость';
          if (id === 'daily_steps') return 'NEAT: ↓ АД, липиды, реология';
          if (id === 'no_smoking') return '↓ CO-Hb, вязкость, атерогенный риск';
          if (id === 'no_alcohol') return '↓ ГГТ/ЩФ, ТГ, АД; печень и ЦНС';
          return '';
        };
        return (
          <div style={{ marginTop: 8 }}>
            <div onClick={() => setShowLifestyle(!showLifestyle)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '7px 9px', borderRadius: showLifestyle ? '8px 8px 0 0' : 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.16)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                🌿 Образ жизни — база курса
                <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(74,222,128,0.6)', padding: '1px 5px', borderRadius: 4, background: 'rgba(34,197,94,0.1)' }}>{lifestyleSubs.length} пунктов · не препараты</span>
              </span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{showLifestyle ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showLifestyle && (
              <div style={{ padding: '7px 10px', borderRadius: '0 0 8px 8px', background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)', borderTop: 'none' }}>
                {lifestyleSubs.map(s => {
                  const e = SUPPORT_CATALOG_DATA[s.substanceId] || SUPPORT_CATALOG_DATA[s.substanceId.toLowerCase()];
                  return (
                    <div key={s.substanceId} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{planItemKind(s.substanceId) === 'База' ? '🧭' : '⚡'} {subNameRu(s.substanceId)}</span>
                        <span style={{ fontSize: 8, color: '#4ade80', textAlign: 'right' }}>{e?.dosage?.timing || ''}</span>
                      </div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.65)', marginTop: 2, lineHeight: 1.45 }}>{e?.description || s.reason}</div>
                      <div style={{ fontSize: 7, color: '#4ade80', marginTop: 2 }}>Риск: {impact(s.substanceId)}</div>
                    </div>
                  );
                })}
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)', marginTop: 5, lineHeight: 1.45 }}>
                  Участвуют в механизм-ориентированном расчёте риска (cv/ren/hem/liv) автоматически; не считаются таблетками и не увеличивают pill burden.
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== СИНЕРГИИ И ВЗАИМОДЕЙСТВИЯ ПЛАНА (объединено, единый стиль) ===== */}
      {finalRec && (() => {
        const hasSynergy = synergyDesc.length > 0 || pairSynergies.length > 0;
        const hasRisks = (finalRec.supportRisks || []).length > 0;
        const hasInteractions = (() => { try { return checkInteractions(finalRec.subs.map(s => s.substanceId)).length > 0; } catch { return false; } })();
        const hasGaps = (finalRec.gaps || []).length > 0;
        const hasConflicts = (() => {
          try {
            const pc = (planResult?.conflicts && planResult.conflicts.length > 0) ? planResult.conflicts : (finalRec.conflicts || []);
            return pc.some((c: any) => c.severity && c.severity !== 'LOW');
          } catch { return false; }
        })();
        const hasBleeding = (() => {
          const FIB = ['nattokinase', 'serrapeptase', 'bromelain', 'lumbrokinase', 'aspirin', 'dipyridamole', 'pentoxifylline', 'warfarin', 'enoxaparin', 'sulodexide', 'ginkgo', 'garlic'];
          const inPlan = new Set(finalRec.subs.map((s: any) => (s.substanceId || '').toLowerCase()));
          return FIB.filter(id => inPlan.has(id)).length >= 2;
        })();
        if (!hasSynergy && !hasRisks && !hasInteractions && !hasGaps && !hasConflicts && !hasBleeding) return null;
        // Единая палитра подсекций блока
        const sevRow = (color: string, bg: string, border: string): React.CSSProperties => ({ padding: '4px 7px', borderRadius: 5, marginBottom: 3, background: bg, border: `1px solid ${border}` });
        const subHeader: React.CSSProperties = { fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '0.3px' };
        const chip = (color: string): React.CSSProperties => ({ fontSize: 6, fontWeight: 800, color, padding: '1px 5px', borderRadius: 3, background: `${color}18` });
        return (
        <div style={{ marginTop:8 }}>
          <div onClick={() => setShowSynergy(!showSynergy)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showSynergy ? '8px 8px 0 0' : 8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.14)' }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#a78bfa', display:'flex', alignItems:'center', gap:5 }}>
              🧬 Синергии и взаимодействия плана
              {pairSynergies.length > 0 && <span style={{ fontSize:7, fontWeight:600, color:'rgba(167,139,250,0.6)', padding:'1px 5px', borderRadius:4, background:'rgba(168,85,247,0.1)' }}>{pairSynergies.length} пар</span>}
            </span>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showSynergy ? '▲ скрыть' : '▼ показать'}</span>
          </div>
          {showSynergy && (
            <div style={{ padding:'6px 10px', borderRadius:'0 0 8px 8px', background:'rgba(168,85,247,0.05)', border:'1px solid rgba(168,85,247,0.1)', borderTop:'none' }}>
              {(() => {
                const FIB = ['nattokinase', 'serrapeptase', 'bromelain', 'lumbrokinase', 'aspirin', 'dipyridamole', 'pentoxifylline', 'warfarin', 'enoxaparin', 'sulodexide', 'ginkgo', 'garlic'];
                const inPlan = new Set(finalRec.subs.map((s: any) => (s.substanceId || '').toLowerCase()));
                const hits = FIB.filter(id => inPlan.has(id));
                if (hits.length >= 2) {
                  const high = hits.length >= 3;
                  return (
                    <div style={sevRow(high ? '#f87171' : '#fbbf24', high ? 'rgba(239,68,68,0.09)' : 'rgba(245,158,11,0.07)', high ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.22)')}>
                      <b style={{ color: high ? '#f87171' : '#fbbf24' }}>🩸 Фибринолитическая/антиагрегантная нагрузка ({hits.map(id => subNameRu(id)).join(' + ')})</b>
                      <div style={{ color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>Синергия фибринолиза — да, но суммарный риск кровотечения {high ? 'ВЫСОКИЙ' : 'повышен'}: сообщить врачу перед операцией/инвазивными процедурами, не добавлять антикоагулянты самостоятельно.</div>
                    </div>
                  );
                }
                return null;
              })()}
              {(finalRec.supportRisks || []).length > 0 && (
                <div style={{ marginBottom: 5 }}>
                  <div style={subHeader}>Риски плана поддержки</div>
                  {(finalRec.supportRisks || []).map(r => (
                    <div key={r.id} style={sevRow(r.level === 'high' ? '#f87171' : r.level === 'medium' ? '#fbbf24' : '#60a5fa', r.level === 'high' ? 'rgba(239,68,68,0.09)' : r.level === 'medium' ? 'rgba(245,158,11,0.07)' : 'rgba(96,165,250,0.06)', r.level === 'high' ? 'rgba(239,68,68,0.28)' : r.level === 'medium' ? 'rgba(245,158,11,0.22)' : 'rgba(96,165,250,0.2)')}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: r.level === 'high' ? '#f87171' : r.level === 'medium' ? '#fbbf24' : '#60a5fa' }}>⚠ {r.label} {r.level === 'high' ? '(высокий)' : r.level === 'medium' ? '(повышенный)' : '(контроль)'}</div>
                      <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginTop: 1 }}>{r.detail}</div>
                    </div>
                  ))}
                  <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, marginTop: 3 }}>
                    Препараты с пометкой <span style={{ color: '#fca5a5', fontWeight: 800 }}>👨‍⚕️</span> — рецептурные, принимать под обязательным контролем врача.
                  </div>
                </div>
              )}
              {synergyDesc.map((s, i) => <div key={`desc-${i}`} style={{ fontSize:8, color:'#c4b5fd', marginBottom:3, lineHeight:1.5 }}>{s}</div>)}
              {pairSynergies.length > 0 && (
                <>
                  <div style={{ fontSize:7, fontWeight:700, color:'#93c5fd', margin:'6px 0 4px', textTransform:'uppercase', letterSpacing:'0.3px' }}>Парные синергии ({pairSynergies.length})</div>
                  {pairSynergies.map((syn, i) => (
                    <div key={`pair-${i}`} style={{ padding:'4px 7px', borderRadius:5, marginBottom:3, background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.14)', width:'100%', boxSizing:'border-box' }}>
                      <div style={{ fontSize:8, color:'#bfdbfe', lineHeight:1.45 }}>
                        <b>{subNameRu(syn.a)}</b> + <b>{subNameRu(syn.b)}</b> — {syn.effect}{syn.score ? ` (+${syn.score})` : ''}
                      </div>
                      <div style={{ fontSize:7, color:'rgba(255,255,255,0.6)', lineHeight:1.4, marginTop:1 }}>{syn.mechanism}</div>
                    </div>
                  ))}
                </>
              )}
              {finalRec.subs.length > 1 && (() => {
                const interactions = checkInteractions(finalRec.subs.map(s => s.substanceId));
                if (interactions.length === 0) return null;
                function fmtSub(id: string): string {
                  if (id.startsWith('@')) {
                    const classLabels: Record<string, string> = {
                      '@statin': 'статины', '@raas': 'РААС-препараты (ACEi/ARB)',
                      '@antidiabetic': 'антидиабетические', '@macrolide': 'макролиды',
                      '@anticoagulant': 'антикоагулянты', '@cyp3a4_inhibitor': 'CYP3A4-ингибиторы',
                      '@cyp3a4_substrate': 'CYP3A4-субстраты', '@alpha_blocker': 'α-блокаторы',
                      '@d2_antagonist': 'D2-антагонисты', '@alcohol': 'алкоголь',
                      '@nsaid': 'НПВС', '@contrast': 'контрастные вещества',
                      '@ssri': 'СИОЗС', '@tetracycline': 'тетрациклины',
                      '@levothyroxine': 'L-тироксин',
                    };
                    return classLabels[id] || id;
                  }
                  return subNameRu(id);
                }
                const groups: Record<string, DrugInteraction[]> = { block: [], warn: [], monitor: [] };
                for (const intr of interactions) groups[intr.severity].push(intr);
                const hasBlock = groups.block.length > 0;
                const sevLabel: Record<string, string> = { block: '⛔ Запрещено', warn: '⚠ Осторожно', monitor: '🔬 Контроль' };
                const sevColor: Record<string, string> = { block: '#f87171', warn: '#fbbf24', monitor: '#60a5fa' };
                const sevBg: Record<string, string> = { block: 'rgba(239,68,68,0.09)', warn: 'rgba(245,158,11,0.07)', monitor: 'rgba(96,165,250,0.05)' };
                return (
                  <>
                    <div style={{ fontSize:7, fontWeight:700, color: hasBlock ? '#f87171' : 'rgba(255,255,255,0.5)', margin:'6px 0 4px', textTransform:'uppercase', letterSpacing:'0.3px' }}>
                      Взаимодействия ({interactions.length}){hasBlock ? ' · есть запрещённые' : ''}
                    </div>
                    {(['block', 'warn', 'monitor'] as const).map(sev => {
                      const items = groups[sev];
                      if (items.length === 0) return null;
                      return (
                        <div key={sev} style={{ padding:'4px 7px', borderRadius:5, background:sevBg[sev], border:`1px solid ${sevColor[sev]}18`, marginBottom:3 }}>
                          <div style={{ fontSize:7, fontWeight:800, color:sevColor[sev], marginBottom:2 }}>{sevLabel[sev]} ({items.length})</div>
                          {items.map((intr, i) => (
                            <div key={i} style={{ fontSize:7, color:'rgba(255,255,255,0.75)', marginBottom:3, lineHeight:1.4 }}>
                              <div style={{ fontWeight:700, marginBottom:1 }}>
                                <span style={{ fontSize:8, marginRight:2 }}>{sev === 'block' ? '⛔' : sev === 'warn' ? '⚠' : '🔬'}</span>
                                <span style={{ color:'#fff' }}>{fmtSub(intr.a)}</span>
                                <span style={{ opacity:0.5, margin:'0 3px' }}>+</span>
                                <span style={{ color:'#fff' }}>{fmtSub(intr.b)}</span>
                              </div>
                              <div style={{ opacity:0.75 }}><span style={{ fontWeight:600, opacity:0.6 }}>Механизм: </span>{intr.reason}</div>
                              <div style={{ fontSize:6, opacity:0.6 }}><span style={{ fontWeight:600 }}>Действие: </span>{intr.action}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
              <SafetyGaps rec={finalRecWithResidual ?? finalRec} />
              <SafetyConflicts rec={finalRecWithResidual ?? finalRec} planResult={planResult} />
            </div>
          )}
        </div>
        );
      })()}

      {/* ===== МОНИТОРИНГ АНАЛИЗОВ (врачебный протокол) ===== */}
      {finalRec && finalRec.subs.length > 0 && (() => {
        const subs = finalRec.subs;
        const hasHepatic = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('liv')));
        const hasCardio = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('cv')));
        const hasRenal = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('ren')));
        const hasHemat = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('hem')));
        const hasCns = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('cns')));
        const hasRepro = subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('rep')));

        // ── Персональный список маркеров, привязанный к конкретным веществам плана ──
        const personalMarkers = (() => {
          const map: Record<string, { what: string; when: string; target: string; subs: string[] }> = {};
          for (const s of subs) {
            const cat = SUPPORT_CATALOG_DATA[s.substanceId];
            if (!cat?.monitoring) continue;
            for (const m of cat.monitoring) {
              const key = (m.what || '').trim().toLowerCase();
              if (!key) continue;
              if (!map[key]) map[key] = { what: m.what, when: m.when || '', target: m.targetRange || '', subs: [] };
              const nm = cat.nameRu || cat.name || s.substanceId;
              if (!map[key].subs.includes(nm)) map[key].subs.push(nm);
            }
          }
          return Object.values(map).sort((a, b) => b.subs.length - a.subs.length);
        })();

        // ── Ведущие вещества по каждой системе (привязка панелей к плану) ──
        const driversBySystem: Record<string, string[]> = {
          hep: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('liv'))).map(s => subNameRu(s.substanceId)),
          cardio: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('cv'))).map(s => subNameRu(s.substanceId)),
          renal: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('ren'))).map(s => subNameRu(s.substanceId)),
          hema: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('hem'))).map(s => subNameRu(s.substanceId)),
          horm: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('rep'))).map(s => subNameRu(s.substanceId)),
          meta: subs.filter(s => (s.mechsCovered || []).some(m => m.startsWith('hem') || m.startsWith('cv'))).map(s => subNameRu(s.substanceId)),
          thy: subs.filter(s => ['selenium', 'iodine', 't3', 't4'].includes(s.substanceId)).map(s => subNameRu(s.substanceId)),
          vit: subs.map(s => subNameRu(s.substanceId)),
        };

        return (
          <div style={{ marginTop:6 }}>
            <div onClick={() => setShowMonitoring(!showMonitoring)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showMonitoring ? '8px 8px 0 0' : 8, background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.2)' }}>
              <span style={{ fontSize:10, fontWeight:700, color:'#60a5fa', display:'flex', alignItems:'center', gap:5 }}>
                🩻 Мониторинг анализов и показателей
                <span style={{ fontSize:7, fontWeight:600, color:'rgba(96,165,250,0.5)', padding:'1px 5px', borderRadius:4, background:'rgba(96,165,250,0.1)' }}>врачебный протокол</span>
              </span>
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showMonitoring ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showMonitoring && (
              <div style={{ padding:'8px 9px', background:'rgba(96,165,250,0.03)', border:'1px solid rgba(96,165,250,0.1)', borderTop:'none', borderRadius:'0 0 8px 8px' }}>
                {/* ── Витальные показатели (ежедневно) ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#93c5fd', marginBottom:3 }}>📊 Витальные показатели (ежедневно)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#f87171', marginBottom:1 }}>❤️ АД (утром, покой)</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>Цель: &lt;130/85 (идеал &lt;120/80)<br/>При ↑ &gt;140/90 — коррекция</div>
                    </div>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#fbbf24', marginBottom:1 }}>💓 ЧСС (утром, покой)</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>Цель: 60–80 уд/мин<br/>Тахикардия &gt;90 — ЭКГ, коррекция</div>
                    </div>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#4ade80', marginBottom:1 }}>⚖️ Вес (еженедельно)</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>Контроль задержки воды<br/>↑ &gt;2 кг/нед — отёки, Na⁺</div>
                    </div>
                    <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#a78bfa', marginBottom:1 }}>🌡️ Температура</div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.3 }}>При симптомах — инфекция<br/>↑ на фоне ААС — риск абсцесса</div>
                    </div>
                  </div>
                </div>

                {/* ── Лабораторный мониторинг ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#60a5fa', marginBottom:3 }}>🧪 Лабораторный мониторинг</div>

                  {/* Текущие показатели из анализов пользователя */}
                  {(() => {
                    const labsValues = labSliceToValues(state.labs.fullPanel);
                    const hasLabs = Object.keys(labsValues).length > 0;
                    if (hasLabs) {
                      return (
                        <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.12)', marginBottom:4 }}>
                          <div style={{ fontSize:7, fontWeight:700, color:'#93c5fd', marginBottom:2 }}>🔬 Текущие показатели ({Object.keys(labsValues).length})</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                            {Object.entries(labsValues).sort((a, b) => a[0].localeCompare(b[0])).map(([mk, val]) => (
                              <span key={mk} style={{ fontSize:6, padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.2)', color:'#fff' }}>{mk}: {val}</span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', marginBottom:4, fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.5 }}>
                        ⚠ Анализы не введены: график построен по фармакологии и фазе, но фактический уровень рисков не подтверждён. Введите анализы для персональной оценки.
                      </div>
                    );
                  })()}

                  {/* Полный структурированный график: до курса → ежедневно → 2/4/8 нед → после → экстренно */}
                  {(finalRec.monitoringSchedule || []).map(sec => (
                    <div key={sec.id} style={{ padding:'5px 7px', borderRadius:6, background:'rgba(96,165,250,0.05)', border:'1px solid rgba(96,165,250,0.1)', marginBottom:4 }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#93c5fd', marginBottom:2 }}>{sec.icon} {sec.label} <span style={{ color:'#60a5fa', fontWeight:600 }}>· {sec.period}</span></div>
                      {sec.items.map((it, i) => (
                        <div key={i} style={{ fontSize:6, color:'rgba(255,255,255,0.65)', lineHeight:1.55, paddingLeft:6, borderLeft:'2px solid rgba(96,165,250,0.25)', marginBottom:3 }}>
                          <b style={{ color:'#e2e8f0' }}>{it.marker}</b> — {it.reason}
                          {it.target && <span style={{ color:'#4ade80' }}> · 🎯 {it.target}</span>}
                          {it.drug && <span style={{ color:'rgba(255,255,255,0.5)' }}> · 💊 {subNameRu(it.drug)}</span>}
                          {it.escalation && <div style={{ color: '#fca5a5' }}>⚠ {it.escalation}</div>}
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Персональный список маркеров (привязка к веществам плана) */}
                  <div style={{ padding:'6px 7px', borderRadius:6, background:'rgba(96,165,250,0.10)', border:'1px solid rgba(96,165,250,0.18)', marginBottom:4 }}>
                    <div style={{ fontSize:7, fontWeight:700, color:'#93c5fd', marginBottom:3 }}>🎯 Персональные маркеры ({personalMarkers.length}) — по вашему плану из {subs.length} веществ</div>
                    {personalMarkers.length === 0 && (
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>Для назначенных веществ не заданы специфические маркеры мониторинга — см. базовые панели ниже.</div>
                    )}
                    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      {personalMarkers.map((m, mi) => (
                        <div key={mi} style={{ padding:'4px 6px', borderRadius:5, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize:7, fontWeight:700, color:'#bfdbfe', marginBottom:1 }}>{m.what}</div>
                          <div style={{ fontSize:6, color:'rgba(255,255,255,0.55)', lineHeight:1.4 }}>
                            <span style={{ color:'#94a3b8', fontWeight:600 }}>Когда:</span> {m.when || '—'}
                            {m.target ? <> · <span style={{ color:'#94a3b8', fontWeight:600 }}>Цель:</span> {m.target}</> : null}
                          </div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:2 }}>
                            {m.subs.map((sn, si) => (
                              <span key={si} style={{ fontSize:6, color:'#e2e8f0', padding:'1px 4px', borderRadius:3, background:'rgba(96,165,250,0.14)', border:'1px solid rgba(96,165,250,0.22)' }}>{sn}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  </div>

                  {/* ── Панели по системам (с привязкой к веществам) ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#ffffff', marginBottom:4 }}>📋 Системные панели ({subs.length} веществ в плане)</div>

                  {SYSTEM_PANELS.map(panel => {
                    const drivers = driversBySystem[panel.id] || [];
                    const isActive = panel.id === 'hep' ? hasHepatic : panel.id === 'cardio' ? hasCardio : panel.id === 'renal' ? hasRenal : panel.id === 'hema' ? hasHemat : panel.id === 'horm' ? (hasRepro || subs.some(s => (s.mechsCovered || []).some(m => m.startsWith('rep') || m.startsWith('hem')))) : panel.id === 'meta' ? (hasHemat || hasCardio) : panel.id === 'thy' ? subs.some(s => ['selenium', 'iodine', 't3', 't4'].includes(s.substanceId)) : panel.id === 'oda' ? subs.some(s => ['collagen', 'glucosamine', 'chondroitin', 'msm', 'bpc157', 'tb500', 'ghk_cu'].includes(s.substanceId)) : true;
                    return (
                    <div key={panel.id} style={{ padding:'5px 7px', borderRadius:6, marginBottom:3, background: isActive ? `${panel.color}08` : 'rgba(255,255,255,0.01)', border:`1px solid ${isActive ? panel.color+'18' : 'rgba(255,255,255,0.04)'}`, opacity: isActive ? 1 : 0.6 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
                        <span style={{ fontSize:11 }}>{panel.icon}</span>
                        <span style={{ fontSize:8, fontWeight:700, color: isActive ? panel.color : 'rgba(255,255,255,0.55)' }}>{panel.name}</span>
                        {!isActive && <span style={{ fontSize:6, color:'rgba(255,255,255,0.3)', padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.04)' }}>плановая</span>}
                      </div>
                      <div style={{ fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.5, marginLeft:16 }}>
                        <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>Маркеры:</span> {panel.markers}<br/>
                        <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>Частота:</span> {panel.freq}<br/>
                        <span style={{ fontWeight:600, color:'rgba(255,255,255,0.6)' }}>Цели:</span> {panel.targets}
                        {isActive && <><br/><span style={{ fontWeight:600, color:panel.color }}>⚠ Тревога:</span> <span style={{ color:panel.color, opacity:0.85 }}>{panel.alert}</span></>}
                      </div>
                      {isActive && drivers.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:3, marginLeft:16 }}>
                          <span style={{ fontSize:6, color:'rgba(255,255,255,0.4)' }}>вещества плана: </span>
                          {drivers.map((dn, di) => (
                            <span key={di} style={{ fontSize:6, color:'#e2e8f0', padding:'1px 4px', borderRadius:3, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>{dn}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* ── Инструментальный мониторинг ── */}
                <div style={{ marginBottom:7 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#a78bfa', marginBottom:3 }}>🖥️ Инструментальный мониторинг</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>ЭКГ</span><br/>Исходно + каждые 6 мес<br/>QTc, гипертрофия ЛЖ
                    </div>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>ЭхоКГ</span><br/>Ежегодно (GH/ААС &gt;1 года)<br/>ГЛЖ, ФВ, клапаны
                    </div>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>УЗИ печени</span><br/>Каждые 6 мес<br/>Стеатоз, фиброз, размер
                    </div>
                    <div style={{ padding:'4px 6px', borderRadius:5, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.1)', fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.4 }}>
                      <span style={{ fontWeight:700, color:'#c4b5fd' }}>УЗИ почек</span><br/>Ежегодно<br/>Размер, паренхима, ЧЛС
                    </div>
                  </div>
                </div>

                {/* ── Дневник самоконтроля ── */}
                <div style={{ marginBottom:4 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:'#fbbf24', marginBottom:3 }}>📝 Дневник самоконтроля (ежедневно)</div>
                  <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.1)' }}>
                    <div style={{ fontSize:6, color:'rgba(255,255,255,0.6)', lineHeight:1.8 }}>
                      {[
                         ['❤️', 'АД утром (сист/диаст) + пульс'],
                         ['😴', 'Качество сна (1–5) + часы'],
                         ['😤', 'Настроение/агрессия (1–5)'],
                         ['🔥', 'Либидо (1–5)'],
                         ['⚖️', 'Вес утром (еженедельно)'],
                         ['💪', 'Отёки голеней/лица (да/нет)'],
                         ['🩺', 'Гинекомастия (нет / чувств. / уплотнение)'],
                         ['🧠', 'Головные боли / шум в ушах'],
                         ['🩸', 'Покраснение лица/кожи (плетора — признак ↑Hct)'],
                         ['💧', 'Гидратация: мл выпито / цвет мочи (тёмная = дегидратация)'],
                       ].map(([icon, text], i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ width:16, textAlign:'center', flexShrink:0 }}>{icon}</span>
                          <span>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Экстренные показания ── */}
                <div style={{ padding:'5px 7px', borderRadius:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ fontSize:7, fontWeight:700, color:'#fca5a5', marginBottom:2 }}>🚨 Немедленно обратиться к врачу:</div>
                  <div style={{ fontSize:6, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
                    • АД &gt;160/100 на фоне покоя<br/>
                    • ЧСС &gt;120 в покое / аритмия<br/>
                    • Боль в груди / одышка / кровохарканье (ТЭЛА!)<br/>
                    • Боль/отёк/покраснение одной ноги (ТГВ!)<br/>
                    • Желтуха (пожелтение кожи/склер)<br/>
                    • Отёки лица/голеней + олигурия (&lt;500 мл/сут)<br/>
                    • Сильная головная боль + нарушение зрения (Hct↑ → гипервязкость)<br/>
                    • Покраснение лица + головокружение + одышка (плетора — Hct возможно &gt;54%)<br/>
                    • Судороги / потеря сознания<br/>
                    • Температура &gt;38.5°C + боль в месте инъекции (абсцесс)
                  </div>
                </div>

                {/* Лабораторные находки + интерпретация + тревоги — единый блок анализов */}
                <SafetyLabFindings planResult={planResult} />
                <SafetyAssayWarnings rec={finalRecWithResidual ?? finalRec} />
                <SafetyAlerts rec={finalRecWithResidual ?? finalRec} />

                {/* ===== ПРЕАНАЛИТИКА, ПРИЁМ И РАЗНЕСЕНИЕ (полная карточка, сворачиваемая) ===== */}
      {finalRec && (() => {
        const planIds = finalRec.subs.map(s => s.substanceId);
        const idSet = new Set(planIds.map(id => id.toLowerCase()));
        const interferences = ASSAY_INTERFERENCE_DB.filter(e => idSet.has(e.substanceId));
        const adminRules = getAdministrationRules(planIds);
        const mineralPairs: string[] = [];
        for (const [pair, hours] of Object.entries(MINERAL_SEPARATION_HOURS)) {
          const [a, b] = pair.split('||');
          if (idSet.has(a) && idSet.has(b)) mineralPairs.push(`${subNameRu(a)} + ${subNameRu(b)} → разнести на ${hours} ч`);
        }
        const sepRules = findSeparationRules(planIds);
        const total = interferences.length + adminRules.length + mineralPairs.length + sepRules.length;
        if (total === 0) return null;
        const rowStyle: React.CSSProperties = { padding: '4px 7px', borderRadius: 5, marginBottom: 3, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.16)', fontSize: 7, lineHeight: 1.45, color: 'rgba(255,255,255,0.8)' };
        return (
          <div style={{ marginTop: 8 }}>
            <div onClick={() => setShowPreanalytics(!showPreanalytics)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '7px 9px', borderRadius: showPreanalytics ? '8px 8px 0 0' : 8, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.16)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 5 }}>
                🧪 Преаналитика, приём и разнесение
                <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(96,165,250,0.6)', padding: '1px 5px', borderRadius: 4, background: 'rgba(96,165,250,0.12)' }}>{total} пунктов</span>
              </span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{showPreanalytics ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showPreanalytics && (
              <div style={{ padding: '7px 10px', borderRadius: '0 0 8px 8px', background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.1)', borderTop: 'none' }}>
                <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '4px 0', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Преаналитические факторы (полный список)</div>
                {PREANALYTIC_EFFECTS_DB.map(f => (
                  <div key={f.factor} style={rowStyle}>
                    <b style={{ color: '#93c5fd' }}>{f.factor}</b> — {f.marker}: {f.effect}. <span style={{ color: '#bfdbfe' }}>{f.advice}</span>
                  </div>
                ))}
                {interferences.length > 0 && (
                  <>
                    <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Интерференции вашего плана</div>
                    {interferences.map((e, i) => (
                      <div key={`int-${i}`} style={rowStyle}>
                        <b style={{ color: '#fca5a5' }}>{e.substanceId}</b>: {e.marker} — {e.effect === 'distorts' ? 'искажает assay' : e.effect === 'increases' ? 'может повышать' : 'может снижать'} ({e.mechanism}). <span style={{ color: '#bfdbfe' }}>{e.advice}</span>
                      </div>
                    ))}
                  </>
                )}
                {adminRules.length > 0 && (
                  <>
                    <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>💊 Особые указания по приёму</div>
                    {adminRules.map((r, i) => (
                      <div key={`adm-${r.substanceId}-${i}`} style={{ padding: '5px 7px', borderRadius: 6, marginBottom: 4, background: r.critical ? 'rgba(248,113,113,0.07)' : 'rgba(34,197,94,0.04)', border: `1px solid ${r.critical ? 'rgba(248,113,113,0.24)' : 'rgba(34,197,94,0.14)'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <span style={{ fontSize: 8, fontWeight: 800, color: '#fff' }}>{subNameRu(r.substanceId)}</span>
                          {r.critical && <span style={{ fontSize: 6, fontWeight: 700, color: '#fca5a5', padding: '1px 4px', borderRadius: 3, background: 'rgba(248,113,113,0.18)' }}>критично</span>}
                        </div>
                        <div style={{ fontSize: 7, color: '#4ade80', fontWeight: 600, lineHeight: 1.4 }}>⏱ {r.timing}</div>
                        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45, marginTop: 1 }}>{r.reason}</div>
                      </div>
                    ))}
                  </>
                )}
                {(mineralPairs.length > 0 || sepRules.length > 0) && (
                  <>
                    <div style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>⏱ Разнесение приёма по времени (усвоение и конфликты)</div>
                    {mineralPairs.map((p, i) => (
                      <div key={`min-${i}`} style={{ ...rowStyle, color: '#fbbf24' }}>⏱ {p}</div>
                    ))}
                    {sepRules.map((r, i) => (
                      <div key={`sep-${i}`} style={{ ...rowStyle, color: '#fbbf24' }}>
                        ⏱ {subNameRu(r.a)} + {subNameRu(r.b)} → разнести на {r.gap} ({r.reason})
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Warnings: multi-oral, GH+insulin, winny+oxy */}
      {finalRec && (() => {
        const warnings: string[] = [];
        const flags = finalRec.pedFlags;
        if (flags) {
          if (flags.isMultiOral) warnings.push('⚠ Более 1 орального 17α — резко ↑ гепатотоксичность');
          if (flags.isGHPlusInsulin) warnings.push('⚠ GH + Инсулин — высокий риск гипогликемии');
          if (flags.isWinnyPlusOxy) warnings.push('🛑 WINSTROL + ANADROL — критическая комбинация (гепатотоксичность + ↓HDL до 50%). ОБЯЗАТЕЛЬНЫЙ протокол защиты включён. LFT каждые 2 нед, не дольше 4 нед');
          if (flags.has17AlphaAndGH) warnings.push('⚠ 17α-Орал + GH — синергичная гепатотоксичность');
        }
        if (warnings.length === 0) return null;
        return (
          <div style={{ marginTop: 8 }}>
            <div onClick={() => setShowCourseWarnings(!showCourseWarnings)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '7px 9px', borderRadius: showCourseWarnings ? '8px 8px 0 0' : 8, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.16)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', display: 'flex', alignItems: 'center', gap: 5 }}>
                ⚠️ Предупреждения о курсе
                <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(168,85,247,0.6)', padding: '1px 5px', borderRadius: 4, background: 'rgba(168,85,247,0.12)' }}>{warnings.length}</span>
              </span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{showCourseWarnings ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showCourseWarnings && (
              <div style={{ padding: '7px 10px', borderRadius: '0 0 8px 8px', background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)', borderTop: 'none' }}>
                {warnings.map((w, i) => <div key={i} style={{ fontSize: 8, color: '#c4b5fd', marginBottom: 1, lineHeight: 1.4 }}>{w}</div>)}
                <SafetyGuardrails rec={finalRecWithResidual ?? finalRec} />
                <SafetyPedEscalation rec={finalRecWithResidual ?? finalRec} />
              </div>
            )}
          </div>
        );
      })()}

      
{/* ===== ФАРМ-МАТРИЦА КУРСА (активные классы PED) ===== */}
      {(() => {
        const active = detectActivePedClasses(state);
        if (active.length === 0) return null;
        const rowStyle: React.CSSProperties = { padding: '5px 7px', borderRadius: 6, marginBottom: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 7, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' };
        const lbl = (t: string) => <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{t}: </span>;
        return (
          <div style={{ marginTop: 8 }}>
            <div onClick={() => setShowPedMatrix(!showPedMatrix)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '7px 9px', borderRadius: showPedMatrix ? '8px 8px 0 0' : 8, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.16)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
                🧪 Фарм-матрица курса
                <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(251,191,36,0.6)', padding: '1px 5px', borderRadius: 4, background: 'rgba(251,191,36,0.12)' }}>{active.length} классов</span>
              </span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{showPedMatrix ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showPedMatrix && (
              <div style={{ padding: '7px 10px', borderRadius: '0 0 8px 8px', background: 'rgba(251,191,36,0.03)', border: '1px solid rgba(251,191,36,0.1)', borderTop: 'none' }}>
                {active.map(cls => (
                  <div key={cls.id} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 8, fontWeight: 800, color: '#fbbf24', marginBottom: 3 }}>{cls.icon} {cls.name} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>· фаза: {cls.phase}</span></div>
                    <div style={rowStyle}>{lbl('Механизмы')}{cls.mechs.join(', ')}</div>
                    <div style={rowStyle}>{lbl('Анализы')}{cls.labs.join(', ')} <span style={{ color: 'rgba(255,255,255,0.45)' }}>({cls.freq})</span></div>
                    <div style={{ ...rowStyle, color: '#4ade80' }}>{lbl('Обязательная поддержка')}{cls.mandatory.join(', ')}</div>
                    {cls.conditional.length > 0 && <div style={{ ...rowStyle, color: '#fbbf24' }}>{lbl('Условная')}{cls.conditional.join(', ')}</div>}
                    {cls.doctorOnly.length > 0 && <div style={{ ...rowStyle, color: '#fca5a5' }}>{lbl('👨‍⚕️ Под контролем врача')}{cls.doctorOnly.join(', ')}</div>}
                    {cls.interactions.length > 0 && <div style={rowStyle}>{lbl('Взаимодействия')}{cls.interactions.join(' · ')}</div>}
                    {cls.assayWarnings.length > 0 && <div style={{ ...rowStyle, color: '#93c5fd' }}>{lbl('Анализы: внимание')}{cls.assayWarnings.join(' · ')}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      
{/* Нутри-корректировки по анализам */}
      {finalRec && finalRec.nutritionTips && finalRec.nutritionTips.length > 0 && (() => {
        const tipsByMarker: Record<string, { action: string; target: string; tier: number }[]> = {};
        for (const t of finalRec.nutritionTips!) {
          const m = (t as any).marker || 'общее';
          if (!tipsByMarker[m]) tipsByMarker[m] = [];
          tipsByMarker[m].push({ action: t.action, target: t.target, tier: (t as any).tier || 1 });
        }
        const markers = Object.keys(tipsByMarker);
        const total = finalRec.nutritionTips.length;
        const hasHigh = finalRec.nutritionTips.some((t: any) => t.tier >= 2);

        return (
        <div style={{ marginTop:6 }}>
          <div onClick={() => setShowNutrition(!showNutrition)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showNutrition ? '8px 8px 0 0' : 8, background: hasHigh ? 'rgba(245,158,11,0.06)' : 'rgba(0,230,138,0.04)', border:'1px solid ' + (hasHigh ? 'rgba(245,158,11,0.15)' : 'rgba(0,230,138,0.12)') }}>
            <span style={{ fontSize:10, fontWeight:700, color: hasHigh ? '#f59e0b' : '#22c55e', display:'flex', alignItems:'center', gap:5 }}>
              🥗 Питание по анализам ({total})
              {hasHigh && <span style={{ fontSize:7, fontWeight:600, color:'#f59e0b', padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.12)' }}>требует коррекции</span>}
            </span>
            <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showNutrition ? '▲ скрыть' : '▼ показать'}</span>
          </div>
          {showNutrition && (
            <div style={{ padding:'6px 9px', background:'rgba(0,0,0,0.15)', border:'1px solid ' + (hasHigh ? 'rgba(245,158,11,0.1)' : 'rgba(0,230,138,0.08)'), borderTop:'none', borderRadius:'0 0 8px 8px' }}>
              <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:5, lineHeight:1.4 }}>
                Рекомендации по питанию на основе отклонений лабораторных маркеров. Сгруппированы по показателю.
              </div>
              {markers.map(marker => {
                const tips = tipsByMarker[marker];
                const maxTier = Math.max(...tips.map(t => t.tier));
                const tierColor = maxTier >= 3 ? '#ef4444' : maxTier >= 2 ? '#f59e0b' : '#22c55e';
                const tierBg = maxTier >= 3 ? 'rgba(239,68,68,0.06)' : maxTier >= 2 ? 'rgba(245,158,11,0.05)' : 'rgba(34,197,94,0.04)';
                const tierBorder = maxTier >= 3 ? 'rgba(239,68,68,0.12)' : maxTier >= 2 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.08)';
                const tierLabel = maxTier >= 3 ? '⛔ Критично' : maxTier >= 2 ? '⚠ Требует внимания' : '🟢 Профилактика';
                return (
                  <div key={marker} style={{ marginBottom:5, padding:'5px 7px', borderRadius:6, background:tierBg, border:`1px solid ${tierBorder}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                      <span style={{ fontSize:8, fontWeight:700, color:'#ffffff' }}>{marker.toUpperCase()}</span>
                      <span style={{ fontSize:7, fontWeight:600, color:tierColor, padding:'1px 4px', borderRadius:3, background:`${tierColor}15` }}>{tierLabel}</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      {tips.map((t, i) => (
                        <div key={i} style={{ fontSize:8, color:'rgba(240,240,245,0.9)', lineHeight:1.4, display:'flex', gap:4 }}>
                          <span style={{ color:tierColor, flexShrink:0, fontWeight:700 }}>{maxTier >= 2 ? '⚠' : '•'}</span>
                          <span>
                            <span style={{ fontWeight:600, color:'#ffffff' }}>{t.action}</span>
                            <span style={{ opacity:0.6, marginLeft:4 }}>→ {t.target}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
              })}
            </div>
          )}
        </div>
        );
      })()}

      {/* ===== МЕДИЦИНСКАЯ ЭСКАЛАЦИЯ (процедуры, только врач) ===== */}
      <SafetyProcedures rec={finalRecWithResidual ?? finalRec} />

      {/* ===== ИНЪЕКЦИИ: РОТАЦИЯ И ТЕХНИКА ===== */}
      <SafetyInjections rec={finalRecWithResidual ?? finalRec} />

      {/* ===== ОСОБЫЕ УКАЗАНИЯ БУСТЕРОВ (PED-risk + LV3) ===== */}
                {finalRec.boosters && finalRec.boosters.length > 0 && (() => {
                  const boosterInstructions: { booster: string; tier: number; instructions: string[] }[] = [];
                  for (const b of finalRec.boosters) {
                    if (b.key === 'neuro' && (b.tier ?? 0) >= 2) {
                      const instr: string[] = [];
                      if ((b.tier ?? 0) >= 3) {
                        instr.push('⚡ LV3: селективные NMDA-антагонисты (memantine ИЛИ lamotrigine ИЛИ amantadine — не комбинировать)');
                        instr.push('⚡ LV3: рецептурные препараты — под обязательным контролем врача (психиатр/невролог)');
                        instr.push('⚡ LV3: титрация — мемантин 5 мг/нед → 20 мг, ламотриджин 25 мг → +25 мг каждые 2 нед');
                      }
                      if ((b.tier ?? 0) >= 2) {
                        instr.push('LV2: прегненолон 10-30 мг — осторожно с прогестогенными ААС (нандролон)');
                      }
                      if (instr.length > 0) boosterInstructions.push({ booster: '🧠 Нейропротекция', tier: b.tier ?? 0, instructions: instr });
                    }
                    if (b.key === 'joints' && (b.tier ?? 0) >= 2) {
                      const instr: string[] = [];
                      if ((b.tier ?? 0) >= 3) {
                        instr.push('⚡ LV3: BPC-157+TB-500+GHK-Cu — 6-недельный протокол (Суставы.txt)');
                        instr.push('⚡ LV3: пептиды — исследовательские, только под ортопедом');
                        instr.push('⚡ LV3: стерильные шприцы/инсулинки, бактериостатическая вода');
                        instr.push('⚡ LV3: контроль УЗИ на 14-й и 28-й день');
                      }
                      if ((b.tier ?? 0) >= 2) {
                        instr.push('LV2: voltaren_gel — только местно, 2-3р/день, не на открытые раны');
                      }
                      if (instr.length > 0) boosterInstructions.push({ booster: '🦴 Суставы', tier: b.tier ?? 0, instructions: instr });
                    }
                  }
                  if (boosterInstructions.length === 0) return null;
                  return (
                    <div style={{ marginTop:6, padding:'6px 8px', borderRadius:8, background:'rgba(168,85,247,0.06)', border:'1px solid rgba(168,85,247,0.15)' }}>
                      <div style={{ fontSize:8, fontWeight:700, color:'#c084fc', marginBottom:4 }}>📋 Особые указания бустеров</div>
                      {boosterInstructions.map((bi, i) => (
                        <div key={i} style={{ marginBottom:4 }}>
                          <div style={{ fontSize:7, fontWeight:700, color:'#a5b4fc' }}>{bi.booster} (LV{bi.tier})</div>
                          {bi.instructions.map((inst, j) => (
                            <div key={j} style={{ fontSize:6, color:'rgba(255,255,255,0.55)', lineHeight:1.4, marginLeft:8, marginBottom:1 }}>• {inst}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>
            )}
          </div>
        );
      })()}

      
{/* ===== ТОКСИКОЛОГИЧЕСКИЙ КОНТРОЛЬ ДОЗ (UL + титрация) ===== */}
      {finalRec && toxWarnings.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div onClick={() => setShowDosageControl(!showDosageControl)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '7px 9px', borderRadius: showDosageControl ? '8px 8px 0 0' : 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.16)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
              ⚠️ Контроль дозировок (UL + титрация)
              <span style={{ fontSize: 7, fontWeight: 600, color: 'rgba(245,158,11,0.6)', padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,0.12)' }}>{toxWarnings.length}</span>
            </span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)' }}>{showDosageControl ? '▲ скрыть' : '▼ показать'}</span>
          </div>
          {showDosageControl && (
            <div style={{ padding: '7px 10px', borderRadius: '0 0 8px 8px', background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.1)', borderTop: 'none' }}>
          {toxWarnings.map((w, i) => {
            const isDanger = w.severity === 'danger';
            const isTitr = w.severity === 'titrate';
            const col = isDanger ? '#ef4444' : isTitr ? '#f59e0b' : '#fbbf24';
            const bg = isDanger ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)';
            const bd = isDanger ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.2)';
            const tag = isDanger ? 'ПРЕВЫШЕН UL' : isTitr ? 'ТИТРАЦИЯ' : 'ВНИМАНИЕ';
            return (
              <div key={i} style={{ margin:'3px 0', padding:'6px 8px', borderRadius:8, background:bg, border:`1px solid ${bd}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2 }}>
                  <span style={{ fontSize:7, fontWeight:800, color:col, padding:'1px 5px', borderRadius:4, background:bg, border:`1px solid ${bd}` }}>{tag}</span>
                  <span style={{ fontSize:9, fontWeight:700, color:'#ffffff' }}>{subNameRu(w.substanceId)}</span>
                </div>
                <div style={{ fontSize:8, color:col, lineHeight:1.4 }}>{w.message}</div>
                {w.percentUL > 0 && <div style={{ fontSize:7, color:'rgba(255,255,255,0.55)', marginTop:2, lineHeight:1.4 }}>→ {w.percentUL}% от {isTitr ? 'оптимума' : 'UL'} ({w.totalDose} / {w.ul} мг)</div>}
              </div>
            );
          })}
          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginTop:3 }}>UL — верхний допустимый предел (элементарное вещество). Титрация — доза выше клинического оптимума, рекомендуется циклирование.</div>
          <SafetyCumulativeLoad planResult={planResult} />
            </div>
          )}
        </div>
      )}

      


{/* Противопоказания — все (каталог + правила + условия) */}
      {finalRec && finalRec.subs.length > 0 && (() => {
        interface FlatContra { substanceId: string; label: string; severity: 'absolute' | 'relative'; source: 'catalog' | 'rule' | 'condition'; }
        const flat: FlatContra[] = [];

        // 1) из checkContraindications (по healthConditions)
        if (finalRec.contraindications) {
          for (const c of finalRec.contraindications) {
            flat.push({ substanceId: c.substanceId, label: c.message, severity: c.severity, source: 'condition' });
          }
        }

        // 2) из SUPPORT_CATALOG_DATA.contraindications
        for (const s of finalRec.subs) {
          const e = SUPPORT_CATALOG_DATA[s.substanceId] || SUPPORT_CATALOG_DATA[s.substanceId.toLowerCase()] || SUPPORT_CATALOG_DATA[s.substanceId.toUpperCase()];
          if (e?.contraindications?.length) {
            for (const c of e.contraindications) {
              flat.push({ substanceId: s.substanceId, label: c, severity: 'relative', source: 'catalog' });
            }
          }
        }

        // 3) из CONTRAINDICATIONS general rules (absolute + relative)
        for (const s of finalRec.subs) {
          const rule = getContraindications(s.substanceId);
          if (!rule) continue;
          for (const abs of rule.absolute) {
            flat.push({ substanceId: s.substanceId, label: abs, severity: 'absolute', source: 'rule' });
          }
          for (const rel of rule.relative) {
            flat.push({ substanceId: s.substanceId, label: rel, severity: 'relative', source: 'rule' });
          }
        }

        if (flat.length === 0) return null;

        // дедупликация по substanceId + label
        const deduped: FlatContra[] = [];
        const seen = new Set<string>();
        for (const f of flat) {
          const key = f.substanceId.toLowerCase() + '::' + f.label;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(f);
        }

        // группировка по веществу
        const grouped: Record<string, { abs: FlatContra[]; rel: FlatContra[] }> = {};
        for (const f of deduped) {
          const id = f.substanceId.toLowerCase();
          if (!grouped[id]) grouped[id] = { abs: [], rel: [] };
          if (f.severity === 'absolute') grouped[id].abs.push(f);
          else grouped[id].rel.push(f);
        }

        const hasAbs = deduped.some(f => f.severity === 'absolute');
        const total = deduped.length;

        return (
          <div style={{ marginTop:6 }}>
            <div onClick={() => setShowContraindications(!showContraindications)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showContraindications ? '8px 8px 0 0' : 8, background: hasAbs ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)', border:'1px solid ' + (hasAbs ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)') }}>
              <span style={{ fontSize:10, fontWeight:700, color: hasAbs ? '#ef4444' : '#f59e0b' }}>
                {hasAbs ? '⛔ Противопоказания' : '⚠ Противопоказания и осторожности'} ({total})
              </span>
              <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showContraindications ? '▲ скрыть' : '▼ показать'}</span>
            </div>
            {showContraindications && (
              <div style={{ padding:'6px 9px 8px', background: hasAbs ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.03)', border:'1px solid ' + (hasAbs ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)'), borderTop:'none', borderRadius:'0 0 8px 8px' }}>
                {Object.entries(grouped).map(([id, g]) => {
                  const all = [...g.abs, ...g.rel];
                  return (
                    <div key={id} style={{ marginBottom: all.length > 0 ? 4 : 0 }}>
                      <div style={{ fontSize:8, fontWeight:700, color:'#ffffff', marginBottom:2, marginTop:1 }}>{subNameRu(id)}</div>
                      {g.abs.map((f, i) => (
                        <div key={i} style={{ fontSize:7, color:'#fca5a5', marginBottom:1, lineHeight:1.4, marginLeft:6 }}>
                          ⛔ {f.label}
                        </div>
                      ))}
                      {g.rel.map((f, i) => (
                        <div key={i} style={{ fontSize:7, color:'#fbbf24', marginBottom:1, lineHeight:1.4, marginLeft:6 }}>
                          ⚠ {f.label}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      
{/* Прогноз ребаунда гормонов после отмены */}
      {finalRec && (() => {
        // Build ReboundInput from context
        const peds = (ctx.pedDoses || ctx.aasIds?.map((id: string) => ({ id, pClass: 'aas_unknown' })) || []);
        if (!peds.length) return null;
        
        const cycleWeeks = state.goals?.cycleWeeks || 12;
        const pctProtocol = rec?.pedFlags?.hasTest ? 'hcg+clomid' : 'clomid+nolva';

        const fp: any = state.labs?.fullPanel || {};
        const reboundInput: any = {
          peds: peds.map((p: any) => ({ id: p.id, pClass: p.pClass, mgPerWeek: p.mgPerWeek, iuPerDay: p.iuPerDay, mcgPerDay: p.mcgPerDay })),
          cycleWeeks,
          pctProtocol,
          pctStartWeek: undefined,
          userProfile: {
            age: state.profile?.age || 30,
            baselineTT: fp.TESTOSTERONE || 650,
            baselineE2: fp.ESTRADIOL || 28,
            baselinePRL: fp.PROLACTIN || 14,
            baselineCortisol: fp.CORTISOL || 450,
            baselineSHBG: fp.SHBG || 30,
            baselineLH: fp.LH || 5,
            baselineFSH: fp.FSH || 4,
          },
        };
        
        try {
          const rebound = calculateReboundTrajectory(reboundInput) as any;
          const summary = getReboundSummary(rebound) as any;
          
          return (
            <div style={{ marginTop:6 }}>
              <div onClick={() => setShowRebound(!showRebound)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', padding:'7px 9px', borderRadius: showRebound ? '8px 8px 0 0' : 8, background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.18)' }}>
                <span style={{ fontSize:10, fontWeight:700, color:'#f59e0b', display:'flex', alignItems:'center', gap:5 }}>
                  📉 Прогноз ребаунда после отмены
                  <span style={{ fontSize:7, fontWeight:600, color:'rgba(245,158,11,0.5)', padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.1)' }}>по вашему курсу</span>
                </span>
                <span style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>{showRebound ? '▲ скрыть' : '▼ показать'}</span>
              </div>
              {showRebound && (
                <div style={{ padding:'8px 9px', background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.1)', borderTop:'none', borderRadius:'0 0 8px 8px' }}>
                  <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)', marginBottom:5, lineHeight:1.4 }}>
                    Прогноз восстановления гормонов за 24 недели после курса. Основан на ПК-фармакокинетике, ПКТ и клинических базах.
                  </div>
                  
                  {/* Summary cards */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:6, marginBottom:8 }}>
                    <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#f59e0b' }}>Восстановление</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{rebound.overallRecoveryWeek || '?'} нед</div>
                    </div>
                    <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#22c55e' }}>HPTA (LH+FSH+TT)</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{rebound.hptaRecoveryWeek || '?'} нед</div>
                    </div>
                    <div style={{ padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#ef4444' }}>E2 ребаунд</div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{rebound.e2.overshootWeek ? `пик нед ${rebound.e2.overshootWeek}` : 'нет'} / rec {rebound.e2.recoveredWeek || '?'} нед</div>
                    </div>
                  </div>
                  
                  {/* Per-marker mini cards */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {['tt','ft','e2','prl','lh','fsh','cortisol','shbg'].map(marker => {
                      const t = rebound[marker as keyof typeof rebound];
                      if (!t) return null;
                      const recColor = t.recoveredWeek && t.recoveredWeek <= 12 ? '#22c55e' : t.recoveredWeek && t.recoveredWeek <= 20 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={marker} style={{ padding:'5px 7px', borderRadius:5, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', minWidth:80 }}>
                          <div style={{ fontSize:7, fontWeight:700, color:marker === 'e2' ? '#f59e0b' : marker === 'prl' ? '#ec4899' : marker === 'cortisol' ? '#ef4444' : '#fff' }}>
                            {marker.toUpperCase()}
                          </div>
                          <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)' }}>
                            {t.recoveredWeek ? `${t.recoveredWeek} нед` : '—'}
                            {t.overshootWeek && <span style={{ color:'#f59e0b', marginLeft:2 }}>↑{t.overshootWeek}</span>}
                          </div>
                          <div style={{ fontSize:7, color:'rgba(255,255,255,0.4)' }}>
                            баз: {t.baseline.toFixed(1)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Risk flags */}
                  {rebound.riskFlags.length > 0 && (
                    <div style={{ marginTop:8, padding:'6px 8px', borderRadius:6, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ fontSize:7, fontWeight:700, color:'#ef4444', marginBottom:3 }}>⚠ Риск-факторы</div>
                      {rebound.riskFlags.map((rf: string, i: number) => (
                        <div key={i} style={{ fontSize:8, color:'#fca5a5', marginBottom:2, lineHeight:1.4, paddingLeft:10, borderLeft:'2px solid rgba(239,68,68,0.3)' }}>{rf}</div>
                      ))}
                    </div>
                  )}
                  
                  {/* Clinical notes */}
                  <div style={{ marginTop:8, padding:'6px 8px', borderRadius:6, background:'rgba(96,165,250,0.04)', border:'1px solid rgba(96,165,250,0.12)' }}>
                    <div style={{ fontSize:7, fontWeight:700, color:'#60a5fa', marginBottom:3 }}>📋 Клинические заметки</div>
                    {['tt','ft','e2','prl','lh','fsh','cortisol','shbg'].flatMap(marker => {
                      const t = rebound[marker as keyof typeof rebound];
                      return t?.clinicalNotes?.map((note: string, i: number) => (
                        <div key={`${marker}-${i}`} style={{ fontSize:8, color:'rgba(240,240,245,0.9)', marginBottom:1, lineHeight:1.4, paddingLeft:8, borderLeft:'2px solid rgba(96,165,250,0.3)' }}>{note}</div>
                      )) || [];
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        } catch {
          return null;
        }
      })()}

{/* ===== КНОПКА «ПРИМЕНИТЬ ПЛАН» ===== */}
      {finalRec && finalRec.subs.length > 0 && onApply && (
        <button onClick={() => { onApply(finalRec); setApplyFlash(true); setTimeout(() => setApplyFlash(false), 1800); }} style={{
          width:'100%', marginTop:10, padding:'12px', borderRadius:12, fontSize:11, fontWeight:800, cursor:'pointer',
          background: applyFlash ? 'rgba(0,230,138,0.2)' : 'linear-gradient(135deg,#00e68a,#00c853)',
          border: applyFlash ? '1.5px solid rgba(0,230,138,0.5)' : 'none',
          color: applyFlash ? '#00e68a' : '#000',
          boxShadow: applyFlash ? 'none' : '0 4px 20px rgba(0,230,138,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <span style={{fontSize:14}}>{applyFlash ? '✓' : '✅'}</span>
          <span>{applyFlash ? 'Готово' : `Применить план поддержки (${finalRec.subs.length} препаратов)`}</span>
        </button>
      )}

      {/* CalcActions (сохранить/копировать/врачу) */}
      {finalRecWithResidual && <CalcActions rec={finalRecWithResidual} level={level} state={state} />}

      {/* Дисклеймер */}
      <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', fontSize: 7, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6 }}>
        <b style={{ color: '#fbbf24' }}>⚠️ Важно:</b> система носит справочно-информационный характер и <b>не является медицинским изделием, инструментом диагностики или лечебным приложением</b>. Она не ставит диагнозы, не назначает и не отменяет лечение и не заменяет консультацию врача. Все расчёты рисков, дозировки и рекомендации — ориентировочные и основаны на открытых данных и обобщённом опыте. Перед началом любого курса, приёмом любых препаратов и БАД, а также при изменении доз — обязательна очная консультация врача (терапевта, эндокринолога или кардиолога). Рецептурные препараты (помечены <span style={{ color: '#fca5a5', fontWeight: 800 }}>👨‍⚕️</span>) принимаются только по назначению врача и под контролем анализов. При появлении тревожных симптомов — боли в груди, одышки, тахикардии, желтухи, отёков, температуры — немедленно прекратите приём и обратитесь к врачу.
      </div>

      {/* ⛔ Согласие на блок-конфликт при добавлении */}
      {pendingBlockAdd && ReactDOM.createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.82)', padding:14 }} onClick={() => setPendingBlockAdd(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:380, borderRadius:16, background:'#16161a', border:'1px solid rgba(239,68,68,0.4)', padding:14, color:'#fff' }}>
            <div style={{ fontSize:13, fontWeight:800, color:'#f87171', marginBottom:8 }}>⛔ Блок-конфликт при добавлении</div>
            {pendingBlockAdd.conflicts.map((c, i) => (
              <div key={i} style={{ padding:'6px 8px', borderRadius:7, marginBottom:6, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.24)', fontSize:8, lineHeight:1.45 }}>
                <b>{subNameRu(c.a)}</b> + <b>{subNameRu(c.b)}</b>: {c.reason}
              </div>
            ))}
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.75)', lineHeight:1.5, marginBottom:10 }}>
              {pendingBlockAdd.ids.map(id => subNameRu(id)).join(', ')} — конфликтующий препарат будет исключён из плана автоматически. Продолжить?
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setPendingBlockAdd(null)} style={{ flex:1, padding:9, borderRadius:8, color:'#fff', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', cursor:'pointer', fontSize:9, fontWeight:700 }}>Отмена</button>
              <button onClick={confirmBlockAdd} style={{ flex:2, padding:9, borderRadius:8, color:'#000', background:'#f87171', border:'none', fontWeight:800, cursor:'pointer', fontSize:9 }}>Добавить и исключить конфликт</button>
            </div>
          </div>
        </div>, document.body)}
    </div>
    </React.Fragment>
  );
};

function canonIdLocal(id: string): string {
  const map: Record<string, string> = {
    telmi: 'telmisartan', tmg: 'betaine', pharma_anastrozole: 'anastrozole',
    pharma_cabergoline: 'cabergoline', nac_sup: 'nac', silymarin: 'milk_thistle',
    coq10: 'coq10', '5_mthf': 'folate', l_carnitine: 'l_carnitine',
    agmatine_sulfate: 'agmatine',
  };
  return map[id?.toLowerCase()] || map[id] || (id?.toLowerCase() || id);
}

function buildPlanText(rec: SupportRecommendation): string {
  const lines: string[] = [];
  lines.push(`⎯⎯ ПЛАН ПОДДЕРЖКИ (ТЗ-28) ⎯⎯`);
  lines.push(`Уровень: ${rec.level}`);
  lines.push(`Фаза: ${rec.phaseLabel}`);
  lines.push(`Веществ: ${rec.subs.length}`);
  lines.push('');
  lines.push('НАЗНАЧЕНИЯ (по категориям):');
  const kindLabels: Array<['База' | 'Минералы' | 'БАДы' | 'Препараты', string]> = [
    ['База', 'БАЗА КУРСА (не препараты):'],
    ['Минералы', 'МИНЕРАЛЬНАЯ ПОДДЕРЖКА:'],
    ['Препараты', 'ПРЕПАРАТЫ:'],
    ['БАДы', 'БАДЫ И ДОБАВКИ:'],
  ];
  for (const [kind, label] of kindLabels) {
    const items = rec.subs.filter(s => planItemKind(s.substanceId) === kind);
    if (items.length === 0) continue;
    lines.push('');
    lines.push(label);
    for (const s of items) {
      const name = subNameRu(s.substanceId);
      const dose = subDosage(s.substanceId);
      const doseStr = dose && dose.mg > 0 ? ` · ${dose.mg} мг (${dose.timing})` : '';
      lines.push(`• ${name}${doseStr}${isDoctorControlled(s.substanceId) ? ' [под обязательным контролем врача]' : ''} — ${s.reason}`);
      if (s.mechsCovered.length > 0) lines.push(`  покрывает: ${s.mechsCovered.join(', ')}`);
      lines.push(`  k=${s.k.toFixed(2)} · док.уровень: ${s.q}`);
    }
  }
  if (rec.suppression.length > 0) {
    lines.push('');
    lines.push('ПОДАВЛЕНЫ:');
    for (const s of rec.suppression) lines.push(`• ${subNameRu(s.substanceId)} — ${s.reason}`);
  }
  if (rec.gaps.length > 0) {
    lines.push('');
    lines.push(`ПРОБЕЛЫ ПОКРЫТИЯ (${rec.gaps.length}):`);
    for (const g of rec.gaps) lines.push(`• ${g.organLabel} → ${g.mechLabel} (${g.mechId})`);
  }
  if (rec.conflicts.length > 0) {
    lines.push('');
    lines.push('КОНФЛИКТЫ:');
    for (const c of rec.conflicts) lines.push(`• ${subNameRu(c.a)} + ${subNameRu(c.b)}: ${c.reason}`);
  }
  if (rec.supportRisks && rec.supportRisks.length > 0) {
    lines.push('');
    lines.push('РИСКИ ПОДДЕРЖКИ:');
    for (const r of rec.supportRisks) lines.push(`• [${r.level.toUpperCase()}] ${r.label}: ${r.detail}`);
  }
  if (rec.monitoringSchedule && rec.monitoringSchedule.length > 0) {
    lines.push('');
    lines.push('МОНИТОРИНГ И АНАЛИЗЫ:');
    for (const sec of rec.monitoringSchedule) {
      lines.push(`• ${sec.label} (${sec.period}):`);
      for (const it of sec.items) lines.push(`    ${it.marker} — ${it.reason}${it.target ? ` (цель: ${it.target})` : ''}${it.escalation ? ` ⚠ ${it.escalation}` : ''}`);
    }
  }
  if (rec.guardrails.length > 0) {
    lines.push('');
    lines.push('GUARDRAILS:');
    for (const g of rec.guardrails) lines.push(`• [${g.level}] ${g.substanceId || 'Общее'}: ${g.reason}`);
  }
  if (rec.procedures && rec.procedures.length > 0) {
    lines.push('');
    lines.push('МЕДИЦИНСКАЯ ЭСКАЛАЦИЯ:');
    for (const p of rec.procedures) lines.push(`• ${p.label} — ${p.reason} (${p.trigger}). Только врач.`);
  }
  if (rec.assayWarnings && rec.assayWarnings.length > 0) {
    lines.push('');
    lines.push('ИНТЕРПРЕТАЦИЯ АНАЛИЗОВ:');
    for (const warning of rec.assayWarnings) lines.push(`• ${warning}`);
  }
  if (rec.boosters.length > 0) {
    lines.push('');
    lines.push('БУСТЕРЫ:');
    for (const b of rec.boosters) {
      lines.push(`• ${b.label}: ${b.rationale}`);
      for (const s of b.subs) lines.push(`  ↳ ${subNameRu(s.substanceId)} · ${s.reason}`);
    }
  }
  lines.push('');
  lines.push('СВОДКА:');
  lines.push(rec.summary);
  return lines.join('\n');
}

function buildDoctorReport(rec: SupportRecommendation, state: CalculatorState): string {
  const lines: string[] = [];
  lines.push('ОТЧЁТ ДЛЯ ВРАЧА — МЕХАНИЗМ-ОРИЕНТИРОВАННАЯ МОДЕЛЬ ТЗ-28');
  lines.push('Sources: tz-mapper-engine, tz-bridge-* (5 файлов). Все механизмы из 28 ТЗ.');
  lines.push('');
  lines.push(`Пациент: вес ${state.profile.weight} кг, возраст ${state.profile.age}, пол: ${state.profile.sex}`);
  lines.push(`Курс: ${state.pharma.aas.length} ААС, фаза: ${state.pharma.phase}, ХГЧ: ${state.pharma.hasHCG ? 'да' : 'нет'}, АИ: ${state.pharma.hasAI ? 'да' : 'нет'}`);
  lines.push('');
  lines.push(`Уровень поддержки: ${rec.level}`);
  lines.push(`Фаза определения: ${rec.phase} → ${rec.phaseLabel}`);
  lines.push('');
  lines.push('НАЗНАЧЕНИЯ (по категориям, с учётом фазы и guardrails):');
  const doctorKinds: Array<['База' | 'Минералы' | 'Препараты' | 'БАДы', string]> = [
    ['База', 'БАЗА КУРСА (не препараты):'],
    ['Минералы', 'МИНЕРАЛЬНАЯ ПОДДЕРЖКА:'],
    ['Препараты', 'ПРЕПАРАТЫ:'],
    ['БАДы', 'БАДЫ И ДОБАВКИ:'],
  ];
  for (const [kind, label] of doctorKinds) {
    const items = rec.subs.filter(s => planItemKind(s.substanceId) === kind);
    if (items.length === 0) continue;
    lines.push('');
    lines.push(label);
    for (const s of items) {
      const name = subNameRu(s.substanceId);
      const dose = subDosage(s.substanceId);
      const doseStr = dose && dose.mg > 0 ? `, ${dose.mg} мг (${dose.timing})` : '';
      lines.push(`- ${name}${doseStr}`);
      const organGuess = s.mechsCovered[0] ? mechToOrganLabel(s.mechsCovered[0]) : '—';
      lines.push(`  Категория: ${s.category}, система: ${organGuess}`);
      lines.push(`  Механизмы покрытия: ${s.mechsCovered.join(', ')}`);
      lines.push(`  Сила (k): ${s.k.toFixed(2)}, уровень доказательности: ${s.q}`);
      lines.push(`  Обоснование: ${s.reason}`);
    }
  }
  if (rec.suppression.length > 0) {
    lines.push('');
    lines.push('ИСКЛЮЧЕНЫ:');
    for (const s of rec.suppression) lines.push(`- ${subNameRu(s.substanceId)}: ${s.reason}`);
  }
  if (rec.guardrails.length > 0) {
    lines.push('');
    lines.push('GUARDRAILS (ограничения безопасности):');
    for (const g of rec.guardrails) lines.push(`- [${g.level.toUpperCase()}] ${g.substanceId || 'Общее'}: ${g.reason}`);
  }
  if (rec.procedures && rec.procedures.length > 0) {
    lines.push('');
    lines.push('МЕДИЦИНСКАЯ ЭСКАЛАЦИЯ:');
    for (const p of rec.procedures) lines.push(`- ${p.label} [только врач]: ${p.reason} Триггер: ${p.trigger}. Контроль: ${p.monitoring.join(', ')}`);
  }
  if (rec.assayWarnings && rec.assayWarnings.length > 0) {
    lines.push('');
    lines.push('ПРЕДУПРЕЖДЕНИЯ ПО ИНТЕРПРЕТАЦИИ АНАЛИЗОВ:');
    for (const warning of rec.assayWarnings) lines.push(`- ${warning}`);
  }
  if (rec.conflicts.length > 0) {
    lines.push('');
    lines.push('КОНФЛИКТЫ ПАР:');
    for (const c of rec.conflicts) lines.push(`- ${subNameRu(c.a)} + ${subNameRu(c.b)}: ${c.reason}`);
  }
  if (rec.boosters.length > 0) {
    lines.push('');
    lines.push('БУСТЕРЫ (триггеры фазы/состояния):');
    for (const b of rec.boosters) {
      lines.push(`- ${b.label}`);
      lines.push(`  Обоснование: ${b.rationale}`);
      lines.push(`  Добавки: ${b.subs.map(s => `${subNameRu(s.substanceId)} (${s.reason})`).join('; ')}`);
      lines.push(`  Механизмы: ${b.mechs.join(', ')}`);
      lines.push(`  Органы: ${b.organs.join(', ')}`);
    }
  }
  lines.push('');
  lines.push('ПОКРЫТИЕ СИСТЕМ:');
  for (const oc of rec.coverage) {
    lines.push(`- ${oc.organLabel}: ${oc.totalCovered}/${oc.totalMechs} (${oc.coveragePercent}%)`);
  }
  if (rec.gaps.length > 0) {
    lines.push('');
    lines.push(`НЕПОКРЫТЫЕ МЕХАНИЗМЫ (${rec.gaps.length}):`);
    for (const g of rec.gaps) lines.push(`- ${g.organLabel} → ${g.mechLabel} (${g.mechId})`);
  }
  if (rec.supportRisks && rec.supportRisks.length > 0) {
    lines.push('');
    lines.push('РИСКИ ПОДДЕРЖКИ:');
    for (const r of rec.supportRisks) lines.push(`- [${r.level.toUpperCase()}] ${r.label}: ${r.detail}`);
  }
  // Системные риски (механизм-модель, единый расчёт с калькулятором)
  try {
    const inp = buildTzInput(state, rec.subs.map(s => s.substanceId));
    if (inp) {
      const tz = calculateTzSpecRisk(inp);
      lines.push('');
      lines.push(`СИСТЕМНЫЕ РИСКИ (механизм-модель, 0-100%): общий ${tz.overallRaw}% → ${tz.overallAfter}%`);
      for (const o of tz.organs) {
        lines.push(`- ${o.name}: ${o.rawPercent}% → ${o.afterPercent}% (защита ${o.k_protect}%)`);
        for (const m of o.mechanisms) lines.push(`    ${m.name}: ${m.rawPercent}% → ${m.afterPercent}%`);
      }
    }
  } catch {}
  // Фарм-матрица активных классов
  try {
    const classes = detectActivePedClasses(state);
    if (classes.length > 0) {
      lines.push('');
      lines.push('ФАРМ-МАТРИЦА КУРСА (активные классы):');
      for (const c of classes) {
        lines.push(`- ${c.name}: механизмы [${c.mechs.join(', ')}]; анализы [${c.labs.join(', ')}] (${c.freq}); обязательная поддержка [${c.mandatory.join(', ')}]; врач [${c.doctorOnly.join(', ')}]; взаимодействия: ${c.interactions.join(' · ')}`);
      }
    }
  } catch {}
  // Мониторинг
  if (rec.monitoringSchedule && rec.monitoringSchedule.length > 0) {
    lines.push('');
    lines.push('МОНИТОРИНГ И АНАЛИЗЫ:');
    for (const sec of rec.monitoringSchedule) {
      lines.push(`- ${sec.label} (${sec.period}):`);
      for (const it of sec.items) lines.push(`    ${it.marker} — ${it.reason}${it.target ? ` (цель: ${it.target})` : ''}${it.escalation ? ` ⚠ ${it.escalation}` : ''}`);
    }
  }
  lines.push('');
  lines.push('СВОДКА ДВИЖКА:');
  lines.push(rec.summary);
  lines.push('');
  lines.push(`Обоснование алгоритма: ${rec.rationale}`);
  return lines.join('\n');
}

interface CalcActionsProps {
  rec: SupportRecommendation;
  level: SupportLevel;
  state: CalculatorState;
}

const CalcActions: React.FC<CalcActionsProps> = ({ rec, state }) => {
  const [savedFlash, setSavedFlash] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const [doctorFlash, setDoctorFlash] = useState(false);

  const saveToFavorites = useCallback(() => {
    try {
      const key = 'he_saved_calc_results';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      const id = `calc_${Date.now()}`;
      arr.push({ id, type: 'calc', timestamp: Date.now(), supportLevel: rec.level, subs: rec.subs.map(s => s.substanceId), tzRec: rec });
      localStorage.setItem(key, JSON.stringify(arr));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) { console.error('saveToFavorites failed', e); }
  }, [rec]);

  const copyPlan = useCallback(async () => {
    const text = buildPlanText(rec);
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {} document.body.removeChild(ta);
    }
    setCopiedFlash(true); setTimeout(() => setCopiedFlash(false), 1800);
  }, [rec]);

  const copyDoctor = useCallback(async () => {
    const text = buildDoctorReport(rec, state);
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {} document.body.removeChild(ta);
    }
    setDoctorFlash(true); setTimeout(() => setDoctorFlash(false), 1800);
  }, [rec, state]);

  const [pdfFlash, setPdfFlash] = useState(false);
  const exportPdf = useCallback(() => {
    if (!rec) return;
    const data = buildExportDataFromRec(
      rec,
      {
        name: state.profile?.name || 'Пациент',
        age: state.profile?.age || 30,
        weight: state.profile?.weight || 80,
        height: state.profile?.height || 178,
        sex: state.profile?.sex || 'male',
      },
      {
        drugs: rec?.phaseAssignedDrugs?.map((d: any) => d.substanceId) || [],
        peds: rec?.pedFlags?.pedIds || [],
        weeks: state.goals?.cycleWeeks || 12,
        phase: rec?.phase || 'course',
      }
    );
    printProtocol(data);
    setPdfFlash(true); setTimeout(() => setPdfFlash(false), 1800);
  }, [rec, state]);

  const btn = (label: string, onClick: () => void, flash: boolean, col: string, icon: string) => (
    <button onClick={onClick} style={{
      flex:1, padding:'6px 5px', borderRadius:8, fontSize:8, fontWeight:700, cursor:'pointer',
      background: flash ? 'rgba(0,230,138,0.2)' : 'rgba(255,255,255,0.04)',
      border: flash ? '1px solid rgba(0,230,138,0.4)' : `1px solid ${col}`, color: flash ? '#00e68a' : col, minWidth:0,
    }}>
      {flash ? '✓' : icon} {flash ? 'Готово' : label}
    </button>
  );

  return (
    <div style={{ display:'flex', gap:3, marginTop:6 }}>
      {btn('Сохранить', saveToFavorites, savedFlash, 'rgba(99,102,241,0.4)', '💾')}
      {btn('Копировать', copyPlan, copiedFlash, 'rgba(96,165,250,0.4)', '📋')}
      {btn('Врачу', copyDoctor, doctorFlash, 'rgba(168,85,247,0.4)', '📄')}
      {btn('PDF', exportPdf, pdfFlash, 'rgba(245,158,11,0.4)', '🖨')}
    </div>
  );
};

export default CalcMapperCard;
