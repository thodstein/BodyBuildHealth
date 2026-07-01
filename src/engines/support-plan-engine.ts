import {
  type CalculatorState, type CalculatorResult, type RiskSystemId,
  type SystemRisk, type MechanismDetail, type ScheduleItem,
  type SynergyId, type PowerLevel, type LabSlice,
  SYNERGY_ID_SUBSTANCES, TITRATION_RULES, SYNERGY_ID_LABELS,
} from './support-calculator.types';
import { MECHANISM_TO_SUPPORT_SUBSTANCE } from '../data/mechanism-support-bridge';
import { BRIDGE_MECH_TO_CATALOG, findCatalogSubstancesForBridgeMech, findBridgeMechsForSubstance, countCoveredMechanisms, findBestSubstancesForBridgeMech } from '../data/mechanism-code-bridge';
import { SUPPORT_CATALOG_DATA } from '../data/support-catalog-data';
import { SYSTEM_MECHANISMS } from '../core/system-mechanisms';
import { LAB_MARKER_MAP, LAB_MARKER_MAP_BY_NAME, type LabMarkerMap } from '../data/lab-marker-map';
import { ALL_STACKS, type SupportStack } from '../data/support-stacks';
import { findBridgeMechsForStack, getStackSystemCoverage } from '../data/mechanism-code-bridge';
import { PHARMA_DB } from '../core/pharma-database';

// ═══════════════════════════════════════════════════════════════
//  SUPPORT PLAN ENGINE v4 — Professional
//  Риск → Система → Механизм → Вещество (через все мосты)
//  + Лаб-данные + Понедельное титрование + Непокрытые механизмы
//  + Синергии + Покрытие + Комментарии + Мониторинг + Динамика
// ═══════════════════════════════════════════════════════════════

// ─── ID нормализация: мост → каталог ───
const BRIDGE_TO_CATALOG: Record<string, string> = {
  zinc_sup: 'zinc', selenium_sup: 'selenium', iron_supplement: 'iron',
  copper_supplement: 'copper', potassium_sup: 'potassium',
  curcumin_sup: 'curcumin', collagen_ii: 'collagen',
  magnesium_l_threonate: 'magnesium', carnosine: 'beta_alanine',
  methylfolate: 'folate', p5p: 'vitamin_b6', tmg: 'betaine',
  niacin: 'vitamin_b3', d_mannose: 'd_mannose',
  l_arginine: 'arginine', l_carnitine: 'l_carnitine',
  l_theanine: 'theanine', l_dopa: 'l_dopa',
  red_yeast_rice: 'red_yeast_rice', probiotic: 'probiotics',
  vitex: 'vitex_agnus_castus', dim: 'dim_indole',
  indinol: 'indole_3_carbinol', enclomiphene: 'enclomiphene',
  clomi: 'clomiphene', tamoxifen: 'tamoxifen',
  mesterolone: 'mesterolone', shilajit: 'shilajit',
  tongkat_ali: 'tongkat_ali', fadogia: 'fadogia_agrestis',
  saw_palmetto: 'saw_palmetto', cardiotonic: 'coq10',
  citicoline: 'citicoline', fasoracetam: 'fasoracetam',
  bromantane: 'bromantane', serrapeptase: 'nattokinase',
  lumbrokinase: 'lumbrokinase', diosmin: 'diosmin',
  hesperidin: 'hesperidin', naringin: 'naringin',
  artichoke: 'artichoke', glutathione: 'glutathione',
  bile_acids: 'bile_acids', aspirin: 'aspirin',
  celery_extract: 'celery_extract', gaba: 'gaba',
  x5htp: 'x5htp', hyaluronic: 'hyaluronic_acid',
  bromelain: 'bromelain', chondroitin: 'chondroitin_sulfate',
  chromium: 'chromium', calcium: 'calcium',
  bergamot: 'bergamot', cordyceps: 'cordyceps',
  chaga: 'chaga', lions_mane: 'lions_mane',
  pycnogenol: 'pycnogenol', phosphatidylserine: 'phosphatidylserine',
  phosphatidylcholine: 'phosphatidylcholine',
  milk_thistle: 'milk_thistle', tudca: 'tudca', nac: 'nac',
  magnesium: 'magnesium', omega3: 'omega3', coq10: 'coq10',
  vitamin_d3: 'vitamin_d3', vitamin_k2: 'vitamin_k2',
  vitamin_c: 'vitamin_c', vitamin_e: 'vitamin_e',
  vitamin_b12: 'vitamin_b12', vitamin_b6: 'vitamin_b6',
  folate: 'folate', taurine: 'taurine', zinc: 'zinc',
  selenium: 'selenium', iron: 'iron', copper: 'copper',
  potassium: 'potassium', boron: 'boron',
  alpha_lipoic: 'alpha_lipoic', curcumin: 'curcumin',
  ashwagandha: 'ashwagandha', berberine: 'berberine',
  theanine: 'theanine', glycine: 'glycine', tyrosine: 'tyrosine',
  melatonin: 'melatonin', ginseng: 'ginseng', egcg: 'egcg',
  astragalus: 'astragalus', boswellia: 'boswellia',
  msm: 'msm', collagen: 'collagen', glucosamine: 'glucosamine',
  bpc157: 'bpc157', tb500: 'tb500', probiotics: 'probiotics',
  telmisartan: 'telmisartan', nebivolol: 'nebivolol',
  hcg: 'hcg', betaine: 'betaine',
};

function normalizeId(bridgeId: string): string {
  const low = bridgeId.toLowerCase();
  if (BRIDGE_TO_CATALOG[bridgeId]) return BRIDGE_TO_CATALOG[bridgeId];
  if (BRIDGE_TO_CATALOG[low]) return BRIDGE_TO_CATALOG[low];
  return low;
}

function getCatalogEntry(substanceId: string): any | null {
  const id = normalizeId(substanceId);
  let entry = SUPPORT_CATALOG_DATA[id];
  if (!entry) {
    const upper = id.toUpperCase();
    entry = SUPPORT_CATALOG_DATA[upper];
  }
  if (!entry) {
    for (const k of Object.keys(SUPPORT_CATALOG_DATA)) {
      if (k.toLowerCase() === id.toLowerCase()) { entry = SUPPORT_CATALOG_DATA[k]; break; }
    }
  }
  return entry || null;
}

function catalogExists(id: string): boolean {
  return getCatalogEntry(id) !== null;
}

// ─── Risk scoring (from support-calculator.engine.ts, extracted) ───
function sev(s: string): number {
  return s === 'severe' ? 30 : s === 'moderate' ? 15 : s === 'mild' ? 5 : 0;
}
function clamp(v: number, lo = 0, hi = 100): number { return Math.min(hi, Math.max(lo, v)); }

function rProfile(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const p = s.profile || {};
  const ageF = clamp((p.age || 30) / 40, 0.5, 1.5);
  r.cardio = (p.workoutsPerWeek < 2 ? 10 : p.workoutsPerWeek < 4 ? 5 : 0);
  r.cardio += (p.sleepHours < 6 ? 10 : p.sleepHours < 7 ? 5 : 0);
  r.cardio += ((p.stressLevel || 4) > 7 ? 10 : (p.stressLevel || 4) > 5 ? 5 : 0);
  r.cardio = Math.round(r.cardio * ageF);
  if (p.smoker) { r.cardio += 15; r.neuro = (r.neuro || 0) + 5; }
  if (p.alcohol === 'regular') r.hepatic = (r.hepatic || 0) + 20;
  else if (p.alcohol === 'sometimes') r.hepatic = (r.hepatic || 0) + 8;
  if ((p.caffeineMg || 0) > 400) { r.neuro = (r.neuro || 0) + 8; r.cardio += 5; }
  if (p.bodyfat > 25) { r.cardio += 8; r.hepatic = (r.hepatic || 0) + 5; }
  // Training load → joint/recovery stress
  const trainingVolume = (p.workoutsPerWeek || 3) * (p.avgWorkoutMinutes || 60);
  if (trainingVolume > 600) { r.musculoskeletal = (r.musculoskeletal || 0) + 10; r.neuro = (r.neuro || 0) + 5; }
  else if (trainingVolume > 400) r.musculoskeletal = (r.musculoskeletal || 0) + 5;
  if (p.sleepHours < 6 && trainingVolume > 400) r.neuro = (r.neuro || 0) + 8;
  return r;
}

function rNeuro(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const n = s.neuro || {};
  let score = (n.dopamineScore || 0) * 4 + (n.serotoninScore || 0) * 3 + (n.aggressionScore || 0) * 3;
  if (n.gabaBalance === 'overexcited') score += 10;
  else if (n.gabaBalance === 'inhibited') score += 5;
  if (n.memoryIssues) score += 5;
  if (n.focusIssues) score += 5;
  if (n.slowThinking) score += 5;
  if (n.coordinationIssues) score += 5;
  if (n.headaches) score += 5;
  r.neuro = clamp(score);
  if (n.sleepQuality === 'poor') r.neuro += 15;
  else if (n.sleepQuality === 'fair') r.neuro += 5;
  return r;
}

function rPharma(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const p = s.pharma || {}; const aas = p.aas || [];
  if (aas.length > 0) {
  const totalDose = aas.reduce((a: number, b: any) => a + (b.doseMgWeek || 0), 0);
  const trainingVolume = (p.workoutsPerWeek || 3) * (p.avgWorkoutMinutes || 60);
    const hasOral = aas.some((a: any) => ['methandienone','oxandrolone','stanozolol','dianabol','anadrol','winstrol','anavar','turinabol','superdrol','m1t','halodrol','halotestin','methyltestosterone'].some(n => a.id?.toLowerCase().includes(n)));
    const hasTren = aas.some((a: any) => a.id.includes('tren'));
    const hasNand = aas.some((a: any) => a.id.includes('nand') || a.id.includes('deca'));
    r.endocrine = clamp(totalDose * 0.02, 0, 50);
    r.reproductive = clamp(totalDose * 0.015, 0, 40);
    r.hepatic = hasOral ? 30 : 5;
    r.cardio = clamp(totalDose * 0.015, 0, 40);
    if (hasTren) { r.neuro = 35; r.cardio = (r.cardio || 0) + 10; }
    if (hasNand) r.reproductive = clamp((r.reproductive || 0) + 10, 0, 50);
    r.hematologic = clamp(totalDose * 0.01, 0, 35);
    if (totalDose > 1000) r.cardio = clamp((r.cardio || 0) + 10, 0, 50);

    // PHARMA_DB integration: per-drug linkedRisks + cvProfile + pd
    for (const ae of aas) {
      const ph = PHARMA_DB[ae.id];
      if (!ph) continue;
      if (ph.linkedRisks) {
        for (const lr of ph.linkedRisks) {
          const m: Record<string,string> = { cardio:'cardio', hepatic:'hepatic', renal:'renal', neuro:'neuro', neuro_toxicity:'neuro', endocrine:'endocrine', hematologic:'hematologic', reproductive:'reproductive', musculoskeletal:'musculoskeletal', prostate:'reproductive', skin:'musculoskeletal', metabolic:'cardio', vessels:'cardio', blood:'hematologic', immunity:'hematologic', ins_axis:'endocrine', ghigf:'endocrine', thyroid:'endocrine' };
          const sys = m[lr.system]; if (!sys) continue;
          if (lr.direction === 'up') r[sys] = clamp((r[sys]||0) + Math.round(lr.strength * 30), 0, 100);
          else r[sys] = Math.max(0, (r[sys]||0) - Math.round(lr.strength * 15));
        }
      }
      if (ph.cvProfile) {
        if (ph.cvProfile.bloodPressure === 'up') r.cardio = (r.cardio||0) + 8;
        if (ph.cvProfile.heartRate === 'up') r.cardio = (r.cardio||0) + 5;
        if (ph.cvProfile.thrombosisRisk === 'high') r.hematologic = (r.hematologic||0) + 12;
        if (ph.cvProfile.cnsLoad === 'high') r.neuro = (r.neuro||0) + 10;
      }
      if (ph.pd) {
        if (ph.pd.hepatotoxicity > 1) r.hepatic = (r.hepatic||0) + Math.round(ph.pd.hepatotoxicity * 10);
        if (ph.pd.neuro_toxicity > 0.3) r.neuro = (r.neuro||0) + Math.round(ph.pd.neuro_toxicity * 40);
        if (ph.pd.lipid_impact < -0.4) r.cardio = (r.cardio||0) + Math.round(Math.abs(ph.pd.lipid_impact) * 30);
        if (ph.pd.hct_impact > 3) r.hematologic = (r.hematologic||0) + Math.round(ph.pd.hct_impact * 4);
      }
    }
  }
  if (p.hasGH) { r.endocrine = (r.endocrine || 0) + 15; r.cardio = (r.cardio || 0) + 5; }
  if (p.hasIGF) r.endocrine = (r.endocrine || 0) + 8;
  if (p.hasInsulin) { r.cardio = (r.cardio || 0) + 10; r.neuro = (r.neuro || 0) + 5; }
  return r;
}

function rGoals(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const g = s.goals || {};
  if (g.trainingCycle === 'mass') { r.cardio = 5; r.hepatic = 5; }
  if (g.cycleWeeks > 16) { r.hepatic = (r.hepatic || 0) + 10; r.cardio = (r.cardio || 0) + 10; r.neuro = (r.neuro || 0) + 5; }
  else if (g.cycleWeeks > 12) { r.hepatic = (r.hepatic || 0) + 5; r.cardio = (r.cardio || 0) + 5; }
  if (g.previousCycles > 5) { r.endocrine = (r.endocrine || 0) + 10; r.reproductive = (r.reproductive || 0) + 10; }
  if (g.previousCycles > 10) { r.endocrine = (r.endocrine || 0) + 5; r.reproductive = (r.reproductive || 0) + 5; }
  if (g.timeSinceLastCycle === '<3mo' || g.timeSinceLastCycle === 'none') r.endocrine = (r.endocrine || 0) + 10;
  return r;
}

function rHepatic(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const h = s.hepatobiliary || {};
  r.hepatic = sev(h.altAstElevation) + sev(h.ggtElevation) + sev(h.bilirubinElevation);
  if (h.fattyLiver) r.hepatic += 20;
  if (h.cholecystitis) r.hepatic += 10;
  if (h.alcoholHistory === 'current') r.hepatic += 25;
  else if (h.alcoholHistory === 'past') r.hepatic += 5;
  return r;
}

function rRenal(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const u = s.urinary || {};
  r.renal = sev(u.creatinineElevation) + sev(u.ureaElevation);
  if (u.proteinuria) r.renal += 20;
  if (u.nephrotoxicDrugs) r.renal += 15;
  if (u.hypertension) r.renal += 15;
  if (u.diabetes) r.renal += 20;
  return r;
}

function rCardio(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const c = s.cardio || {};
  const bpMap: Record<string, number> = { normal: 0, prehypertension: 10, hypertension1: 25, hypertension2: 40 };
  r.cardio = (r.cardio || 0) + (bpMap[c.bpStage] || 0);
  if (c.heartRate > 90) r.cardio += 15;
  else if (c.heartRate > 80) r.cardio += 5;
  r.cardio += sev(c.ldlElevation);
  if (c.hdlLow) r.cardio += 10;
  if (c.triglycerides === 'elevated') r.cardio += 10;
  else if (c.triglycerides === 'high') r.cardio += 20;
  r.cardio += sev(c.hctElevation);
  if (c.previousCVD) r.cardio += 25;
  if (c.familyCVD) r.cardio += 10;
  return r;
}

function rODA(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const o = s.oda || {};
  r.musculoskeletal = sev(o.jointPain) + ((o.injuries || []).length * 5);
  if (o.ligamentIssues) r.musculoskeletal += 15;
  if (o.backPain) r.musculoskeletal += 10;
  return r;
}

function rContraind(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const c = s.contraindications || {};
  if (c.hasCVD) r.cardio = 20;
  if (c.hasThrombophilia) r.hematologic = 25;
  if (c.hasDiabetes) { r.cardio = (r.cardio || 0) + 10; r.renal = (r.renal || 0) + 10; }
  if (c.hasLiverDisease) r.hepatic = (r.hepatic || 0) + 20;
  if (c.hasKidneyDisease) r.renal = (r.renal || 0) + 20;
  if (c.hasEpilepsy) r.neuro = (r.neuro || 0) + 15;
  if (c.hasMentalIllness) r.neuro = (r.neuro || 0) + 10;
  return r;
}

function rEpicrisis(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const e = s.epicrisis || {};
  if (e.pastGyno) r.reproductive = (r.reproductive || 0) + 15;
  if (e.pastLibidoDrop) r.reproductive = (r.reproductive || 0) + 10;
  if (e.pastHctSpike) r.hematologic = (r.hematologic || 0) + 15;
  if (e.pastLiverIssues) r.hepatic = (r.hepatic || 0) + 15;
  if (e.pastKidneyIssues) r.renal = (r.renal || 0) + 15;
  return r;
}

function rToxic(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const t = s.toxicLoad || {};
  if (t.hazardousWork) { r.hepatic = (r.hepatic || 0) + 5; r.renal = (r.renal || 0) + 5; r.hematologic = (r.hematologic || 0) + 5; }
  if (t.regularNSAIDs) { r.hepatic = (r.hepatic || 0) + 10; r.renal = (r.renal || 0) + 10; }
  if (t.otherHeavyDrugs) { r.hepatic = (r.hepatic || 0) + 15; r.renal = (r.renal || 0) + 10; }
  return r;
}

function rGenetics(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const g = s.genetics || {};
  if (g.cyp19a1 === 'high') { r.endocrine = (r.endocrine || 0) + 10; r.reproductive = (r.reproductive || 0) + 5; }
  if (g.srd5a2 === 'hypersensitive') r.reproductive = (r.reproductive || 0) + 10;
  if (g.arSensitivity === 'high') { r.endocrine = (r.endocrine || 0) + 10; r.cardio = (r.cardio || 0) + 5; r.hematologic = (r.hematologic || 0) + 5; }
  if (g.mthfr === 'c677t') { r.neuro = (r.neuro || 0) + 5; r.cardio = (r.cardio || 0) + 5; r.hematologic = (r.hematologic || 0) + 5; }
  return r;
}

function rPsych(s: any): Record<string, number> {
  const r: Record<string, number> = {}; const p = s.psych || {};
  r.neuro = clamp((p.fearOfLoss || 0) * 3 + (p.mirrorObsession || 0) * 3 + (p.apathyOffCycle || 0) * 3);
  return r;
}

function calcAllRisks(state: any): Record<string, number> {
  const fns = [rProfile, rNeuro, rPharma, rGoals, rHepatic, rRenal, rCardio, rODA, rContraind, rEpicrisis, rToxic, rGenetics, rPsych];
  const scores: Record<string, number> = { cardio: 0, hepatic: 0, renal: 0, neuro: 0, endocrine: 0, hematologic: 0, reproductive: 0, musculoskeletal: 0 };
  for (const fn of fns) {
    const part = fn(state);
    for (const [k, v] of Object.entries(part)) {
      if (v !== undefined && v !== 0) scores[k] = (scores[k] || 0) + v;
    }
  }
  for (const k of Object.keys(scores)) scores[k] = clamp(scores[k]);
  return scores;
}

// ─── SYSTEM → MECHANISM mapping ───
const SYS_TO_MECH_KEYS: Record<string, string[]> = {
  cardio: ['cardio_1','cardio_2','cardio_3','cardio_4','cardio_5','cardio_6','cardio_7','cardio_8'],
  hepatic: ['hepatic_1','hepatic_2','hepatic_3','hepatic_4','hepatic_5','hepatic_6','hepatic_7','hepatic_8'],
  renal: ['renal_1','renal_2','renal_3','renal_4','renal_5','renal_6','renal_7'],
  neuro: ['neuro_1','neuro_2','neuro_3','neuro_4','neuro_5','neuro_6','neuro_7','neuro_8','neuro_tox_1','neuro_tox_2','neuro_tox_3','neuro_tox_4','neuro_tox_5','neuro_tox_6','neuro_tox_7','neuro_tox_8'],
  endocrine: ['endocrine_1','endocrine_2','endocrine_3','endocrine_4','endocrine_5','endocrine_6','endocrine_7','endocrine_8'],
  hematologic: ['hematologic_1','hematologic_2','hematologic_3','hematologic_4','hematologic_5','hematologic_6','hematologic_7'],
  reproductive: ['reproductive_1','reproductive_2','reproductive_3','reproductive_4','reproductive_5','reproductive_6','reproductive_7'],
  musculoskeletal: ['musculoskeletal_1','musculoskeletal_2','musculoskeletal_3','musculoskeletal_4','musculoskeletal_5','musculoskeletal_6','musculoskeletal_7'],
};

const SYS_LABELS: Record<string, string> = {
  cardio: 'Сердечно-сосудистая', hepatic: 'Печень', renal: 'Почки',
  neuro: 'Нервная система', endocrine: 'Эндокринная', hematologic: 'Кроветворная',
  reproductive: 'Репродуктивная', musculoskeletal: 'ОДА/Мышцы',
};

const MECH_LABELS: Record<string, string> = {
  cardio_1: 'Дислипидемия', cardio_2: 'Артериальная гипертензия', cardio_3: 'Гипертрофия ЛЖ',
  cardio_4: 'Тромбогенный потенциал', cardio_5: 'Окислительный стресс', cardio_6: 'Эндотелиальная дисфункция',
  cardio_7: 'Аритмогенность', cardio_8: 'Фиброз миокарда',
  hepatic_1: 'Холестаз', hepatic_2: 'Цитолиз', hepatic_3: 'Пелиозный гепатит',
  hepatic_4: 'Риск опухолей', hepatic_5: 'Стеатоз', hepatic_6: 'Синтетическая функция',
  hepatic_7: 'Метаболизм лекарств', hepatic_8: 'Фиброз/Цирроз',
  renal_1: 'Гиперфильтрация', renal_2: 'Тубулоинтерстициальный фиброз', renal_3: 'Острое повреждение',
  renal_4: 'Протеинурия', renal_5: 'Нефролитиаз', renal_6: 'Гиперкальциемия', renal_7: 'ХБП',
  neuro_1: 'Окислительный стресс ЦНС', neuro_2: 'ГАМК-дисрегуляция', neuro_3: 'Нейровоспаление',
  neuro_4: 'Демиелинизация', neuro_5: 'Митохондриальная дисфункция', neuro_6: 'Апоптоз нейронов',
  neuro_7: 'Снижение нейрогенеза', neuro_8: 'Экситотоксичность',
  neuro_tox_1: 'Дофаминовая токсичность', neuro_tox_2: 'Серотониновая дисрегуляция',
  neuro_tox_3: 'Нейростероидный дисбаланс', neuro_tox_4: 'Митохондрии ЦНС',
  neuro_tox_5: 'Агрессия/импульсивность', neuro_tox_6: 'Когнитивный дефицит',
  neuro_tox_7: 'Нарушение сна', neuro_tox_8: 'Мотонейронная токсичность',
  endocrine_1: 'Подавление ГГЯ', endocrine_2: 'Снижение тестостерона', endocrine_3: 'Дисфункция Лейдига',
  endocrine_4: 'Пролактиновый всплеск', endocrine_5: 'Эстрадиол', endocrine_6: 'Костная резорбция',
  endocrine_7: 'SHBG', endocrine_8: 'Восстановление ГГЯ',
  hematologic_1: 'Полицитемия', hematologic_2: 'Анемия', hematologic_3: 'Гипервязкость',
  hematologic_4: 'Иммуносупрессия', hematologic_5: 'Лейкопения', hematologic_6: 'Микротромбы',
  hematologic_7: 'Окислительный стресс',
  reproductive_1: 'Атрофия яичек', reproductive_2: 'Сперматогенез', reproductive_3: 'Фертильность',
  reproductive_4: 'Стероидогенез', reproductive_5: 'Либидо', reproductive_6: 'Простата',
  reproductive_7: 'Функция гонад',
  musculoskeletal_1: 'Сухожилия', musculoskeletal_2: 'Связки', musculoskeletal_3: 'Кости',
  musculoskeletal_4: 'Митохондрии мышц', musculoskeletal_5: 'Саркопения', musculoskeletal_6: 'Судороги',
  musculoskeletal_7: 'Воспаление',
};

// ─── Субстанции по умолчанию (дозировки из каталога) ───
interface SubstanceDose {
  id: string; name: string; doseMg: number; doseDisplay: string; timing: string;
  mechanism: string; category: string[]; tier: string; targetSystems: string[];
  comment: string;
}

function getSubDose(id: string): { mg: number; timing: string; name: string } {
  const entry = getCatalogEntry(id);
  if (entry && entry.dosage) {
    return { mg: entry.dosage.mg || 500, timing: entry.dosage.timing || 'с едой', name: entry.nameRu || entry.name || id };
  }
  const defaults: Record<string, { mg: number; timing: string; name: string }> = {
    nac: { mg: 1200, timing: 'утро/вечер, натощак', name: 'NAC (N-Ацетилцистеин)' },
    tudca: { mg: 1000, timing: 'перед едой', name: 'TUDCA' },
    magnesium: { mg: 400, timing: 'на ночь', name: 'Магний (бисглицинат)' },
    vitamin_d3: { mg: 5000, timing: 'с едой', name: 'Витамин D3' },
    vitamin_k2: { mg: 200, timing: 'с едой', name: 'Витамин K2 (MK-7)' },
    coq10: { mg: 200, timing: 'с едой', name: 'CoQ10 (Убихинол)' },
    omega3: { mg: 2000, timing: 'с едой', name: 'Омега-3 (EPA+DHA)' },
    zinc: { mg: 30, timing: 'на ночь', name: 'Цинк (пиколинат)' },
    selenium: { mg: 200, timing: 'с едой', name: 'Селен (метионин)' },
    milk_thistle: { mg: 600, timing: 'с едой', name: 'Силимарин' },
    curcumin: { mg: 1000, timing: 'с пиперином', name: 'Куркумин' },
    vitamin_c: { mg: 1000, timing: 'натощак', name: 'Витамин C' },
    taurine: { mg: 1500, timing: 'натощак', name: 'Таурин' },
    alpha_lipoic: { mg: 600, timing: 'натощак', name: 'Альфа-липоевая к-та (R-форма)' },
    berberine: { mg: 500, timing: 'с едой', name: 'Берберин' },
    vitamin_b12: { mg: 1000, timing: 'утро', name: 'Витамин B12 (метилкобаламин)' },
    vitamin_b6: { mg: 25, timing: 'утро', name: 'Витамин B6 (P5P)' },
    folate: { mg: 800, timing: 'с едой', name: 'Фолат (5-MTHF)' },
    ashwagandha: { mg: 600, timing: 'вечер', name: 'Ашваганда (KSM-66)' },
    probiotics: { mg: 20, timing: 'натощак', name: 'Пробиотики (млрд КОЕ)' },
    collagen: { mg: 15000, timing: 'с едой', name: 'Коллаген (гидролизат)' },
    vitamin_e: { mg: 400, timing: 'с едой', name: 'Витамин E (токоферолы)' },
    telmisartan: { mg: 40, timing: 'утро', name: 'Телмисартан' },
    nebivolol: { mg: 5, timing: 'утро', name: 'Небиволол' },
    glucosamine: { mg: 1500, timing: 'с едой', name: 'Глюкозамин' },
    boswellia: { mg: 500, timing: 'с едой', name: 'Босвеллия' },
    msm: { mg: 3000, timing: 'с едой', name: 'МСМ' },
    saw_palmetto: { mg: 640, timing: 'с едой', name: 'Пальма сереноа' },
    astragalus: { mg: 1500, timing: 'с едой', name: 'Астрагал' },
    melatonin: { mg: 5, timing: 'на ночь', name: 'Мелатонин' },
    ginseng: { mg: 400, timing: 'утро', name: 'Женьшень' },
    egcg: { mg: 400, timing: 'натощак', name: 'EGCG (зелёный чай)' },
    l_carnitine: { mg: 2000, timing: 'натощак', name: 'L-Карнитин' },
    bpc157: { mg: 500, timing: 'натощак', name: 'BPC-157' },
    tb500: { mg: 10, timing: 'натощак', name: 'TB-500' },
    iron: { mg: 18, timing: 'натощак', name: 'Железо (бисглицинат)' },
    copper: { mg: 2, timing: 'отдельно от цинка', name: 'Медь' },
    potassium: { mg: 200, timing: 'с едой', name: 'Калий' },
    boron: { mg: 6, timing: 'с едой', name: 'Бор' },
    chromium: { mg: 200, timing: 'с едой', name: 'Хром (пиколинат)' },
    hcg: { mg: 500, timing: '2x/нед, схема 3/1 (3 нед приема → 1 нед отдых)', name: 'ХГЧ' },
    theanine: { mg: 200, timing: 'вечер', name: 'L-Теанин' },
    glycine: { mg: 3000, timing: 'на ночь', name: 'Глицин' },
    tyrosine: { mg: 500, timing: 'утро, натощак', name: 'L-Тирозин' },
    phosphatidylcholine: { mg: 1200, timing: 'с едой', name: 'Фосфатидилхолин' },
    phosphatidylserine: { mg: 300, timing: 'вечер', name: 'Фосфатидилсерин' },
    betaine: { mg: 1500, timing: 'с едой', name: 'Бетаин (TMG)' },
    glutathione: { mg: 500, timing: 'натощак', name: 'Глутатион' },
    hyaluronic_acid: { mg: 200, timing: 'с едой', name: 'Гиалуроновая кислота' },
    chondroitin_sulfate: { mg: 1200, timing: 'с едой', name: 'Хондроитин' },
    bromelain: { mg: 500, timing: 'натощак', name: 'Бромелайн' },
    pycnogenol: { mg: 100, timing: 'с едой', name: 'Пикногенол' },
    calcium: { mg: 500, timing: 'вечер', name: 'Кальций (цитрат)' },
    l_dopa: { mg: 250, timing: 'утро', name: 'L-ДОФА (мукуна)' },
    x5htp: { mg: 100, timing: 'вечер', name: '5-HTP' },
    gaba: { mg: 500, timing: 'вечер', name: 'GABA' },
    lions_mane: { mg: 500, timing: 'утро', name: 'Ежовик гребенчатый' },
    cordyceps: { mg: 1000, timing: 'утро', name: 'Кордицепс' },
    chaga: { mg: 500, timing: 'утро', name: 'Чага' },
    bergamot: { mg: 500, timing: 'с едой', name: 'Бергамот' },
    artichoke: { mg: 500, timing: 'с едой', name: 'Артишок' },
    d_mannose: { mg: 1000, timing: 'натощак', name: 'D-Манноза' },
  };
  return defaults[id] || { mg: 500, timing: 'с едой', name: id };
}

// ─── CORE ENGINE: Level-based substance selection ───
export interface PlanSubstance {
  id: string; name: string; doseMg: number; doseDisplay: string; timing: string;
  category: string[]; tier: string; targetSystems: string[];
  comment: string; mechanismReason: string;
  fromJoint: boolean; fromBoost: boolean;
}

export interface PlanMechanism {
  mechKey: string; mechLabel: string; systemLabel: string;
  substances: string[]; riskBefore: number; riskAfter: number;
}

export interface PlanResult {
  substances: PlanSubstance[];
  dosages: Record<string, { mg: number; timing: string }>;
  schedule: Array<{ timeBlock: string; substances: Array<{ id: string; name: string; dose: string; instructions: string }> }>;
  systems: Record<string, { raw: number; net: number; mechanisms: string[] }>;
  mechanisms: PlanMechanism[];
  coveragePercent: number;
  synergyComment: string;
  monitoring: string[];
  specialInstructions: string[];
  riskDynamics: Array<{ system: string; before: number; after: number; mechanisms: PlanMechanism[] }>;
  overallRiskBefore: number;
  overallRiskAfter: number;
  labFindings: Array<{ marker: string; name: string; value: string; threshold: string; organ: string; suggestedSubs: string[] }>;
  uncoveredMechanisms: Array<{ mechKey: string; mechLabel: string; systemLabel: string; risk: number }>;
  coverageGaps: Array<{ system: string; label: string; raw: number; net: number; gapPercent: number }>;
  weekScale: number;
  /** Рекомендованные стеки, отсортированные по релевантности */
  stackRecommendations: StackRecommendation[];
  /** Конфликты между выбранными веществами */
  conflicts: Array<{ a: string; b: string; aName: string; bName: string; effect: string; severity: string }>;
  /** Расшифровка источников риска по системам */
  riskBreakdown: Record<string, string[]>;
}

// ─── Lab Data Analysis ───
interface LabReading { marker: string; value: number; unit: string; date?: string; }

function analyzeLabData(state: CalculatorState): LabReading[] {
  const readings: LabReading[] = [];
  const labs = state.labs;
  if (!labs) return readings;

  // Parse all lab panels from available slices
  const slices = [labs.preCourse, labs.midCourse, labs.postPCT, labs.fullPanel].filter(Boolean) as LabSlice[];
  if (slices.length === 0) return readings;

  // Use the most recent slice
  const slice = slices[slices.length - 1];
  const allPanels: Record<string, string>[] = [
    slice.panelBiochem || {}, slice.panelHematology || {},
    slice.panelLipid || {}, slice.panelIron || {}, slice.panelThyroid || {},
    slice.panelSex || {}, slice.panelVitamin || {}, slice.panelCardiac || {},
    slice.panelCoagulation || {}, slice.panelInflammatory || {},
    slice.panelAdrenal || {}, slice.panelMineral || {}, slice.panelTumor || {},
    slice.panelUrinalysis || {},
  ];

  for (const panel of allPanels) {
    for (const [marker, val] of Object.entries(panel)) {
      if (!val || val === 'N/A' || val === '') continue;
      const numVal = parseFloat(String(val).replace(/[^\d.\-]/g, ''));
      if (isNaN(numVal)) continue;
      readings.push({ marker, value: numVal, unit: '', date: slice.date });
    }
  }
  return readings;
}

function findAbnormalLabs(readings: LabReading[]): Array<{ marker: string; name: string; value: number; unit: string; threshold: number; higherIsWorse: boolean; correctionIds: string[]; organ: string; system: string; isAbnormal: boolean }> {
  const results: Array<{ marker: string; name: string; value: number; unit: string; threshold: number; higherIsWorse: boolean; correctionIds: string[]; organ: string; system: string; isAbnormal: boolean }> = [];

  for (const reading of readings) {
    // Try to find matching marker in LAB_MARKER_MAP
    let match: LabMarkerMap | undefined = LAB_MARKER_MAP_BY_NAME[reading.marker];
    if (!match) {
      // Try case-insensitive matching
      for (const [key, val] of Object.entries(LAB_MARKER_MAP_BY_NAME)) {
        if (key.toUpperCase() === reading.marker.toUpperCase()) { match = val; break; }
      }
    }
    if (!match) continue;

    const isAbnormal: boolean = match.higherIsWorse
      ? reading.value > match.defaultValue
      : reading.value < match.defaultValue;

    if (isAbnormal) {
      const normCorrectionIds = match.correctionIds.map(normalizeId).filter(id => catalogExists(id) || getSubDose(id).mg > 0);
      results.push({
        marker: match.marker,
        name: match.name,
        value: reading.value,
        unit: match.unit,
        threshold: match.defaultValue,
        higherIsWorse: match.higherIsWorse,
        correctionIds: normCorrectionIds,
        organ: match.organ,
        system: match.system,
        isAbnormal: true,
      });
    }
  }
  return results;
}

function parseLabDataFromExternal(labArray: any[] | undefined): LabReading[] {
  const readings: LabReading[] = [];
  if (!labArray || !Array.isArray(labArray)) return readings;

  // Russian → English marker name mapping for LabPoint data
  const RU_TO_EN: Record<string, string> = {
    'АЛТ': 'ALT', 'АСТ': 'AST', 'ГГТ': 'GGT', 'Билирубин общий': 'Bilirubin',
    'Креатинин': 'Creatinine', 'Мочевина': 'Urea', 'Глюкоза': 'GLU',
    'ТТГ': 'TSH', 'Т3 свободный': 'FT3', 'Т4 свободный': 'FT4',
    'ЛПНП': 'LDL', 'ЛПВП': 'HDL', 'Триглицериды': 'Triglycerides',
    'Гематокрит': 'HCT', 'Гемоглобин': 'Hemoglobin', 'Эритроциты': 'RBC',
    'Тромбоциты': 'PLT', 'Лейкоциты': 'WBC', 'СОЭ': 'ESR',
    'Ферритин': 'FERRITIN', 'Железо': 'IRON', 'ОЖСС': 'TIBC',
    'Тестостерон общий': 'TT', 'Эстрадиол': 'E2', 'Пролактин': 'PRL',
    'ЛГ': 'LH', 'ФСГ': 'FSH', 'ГСПГ': 'SHBG', 'ДГТ': 'DHT',
    'Кортизол': 'CORTISOL', 'ДГЭА-С': 'DHEA_S', 'ПСА общий': 'PSA',
    'СРБ': 'CRP', 'Гомоцистеин': 'HOMOCYSTEINE', 'Витамин D 25-OH': 'VITD',
    'Витамин B12': 'B12', 'Фолат': 'FOL', 'Магний': 'MAGNESIUM',
    'Цинк': 'ZINC', 'Селен': 'SELENIUM', 'Калий': 'POTASSIUM', 'Натрий': 'SODIUM',
    'Кальций': 'CALCIUM', 'Фосфор': 'PHOSPHORUS', 'Медь': 'COPPER',
    'D-димер': 'D-dimer', 'Фибриноген': 'Fibrinogen', 'МНО': 'INR',
    'СКФ': 'EGFR', 'Мочевая кислота': 'URIC_ACID',
    'Гликированный Hb': 'HbA1c', 'Инсулин': 'INS',
  };

  for (const entry of labArray) {
    // LabPoint format: {code, name, value, unit, date}
    const rawCode = entry.code || entry.marker || entry.name || '';
    // Try English code first, then Russian name lookup
    let markerCode = rawCode;
    if (!markerCode.match(/^[A-Z]/)) {
      markerCode = RU_TO_EN[rawCode] || rawCode;
    }

    if (entry.value !== undefined) {
      const numVal = parseFloat(String(entry.value).replace(/[^\d.\-]/g, ''));
      if (!isNaN(numVal) && numVal > 0) {
        readings.push({ marker: markerCode, value: numVal, unit: entry.unit || '', date: entry.date });
      }
    }

    // Handle panel-style data
    const panels = ['panelBiochem', 'panelHematology', 'panelLipid', 'panelIron', 'panelThyroid',
      'panelSex', 'panelVitamin', 'panelCardiac', 'panelCoagulation', 'panelInflammatory',
      'panelAdrenal', 'panelMineral', 'panelTumor', 'panelUrinalysis'];
    for (const panelKey of panels) {
      if (entry[panelKey] && typeof entry[panelKey] === 'object') {
        for (const [marker, val] of Object.entries(entry[panelKey])) {
          if (typeof val === 'string' && val && val !== 'N/A') {
            const numVal = parseFloat(val.replace(/[^\d.\-]/g, ''));
            if (!isNaN(numVal)) {
              readings.push({ marker, value: numVal, unit: '', date: entry.date });
            }
          }
        }
      }
    }
  }
  return readings;
}

// ─── STACK RECOMMENDATION ENGINE ───
export interface StackRecommendation {
  stack: SupportStack;
  score: number;
  coveragePercent: number;
  coveredSystems: string[];
  coveredMechanisms: string[];
  synergyBonus: number;
  wasteSubstances: string[];
  reason: string;
}

export function recommendStacks(
  scores: Record<string, number>,
  selectedIds: Set<string>,
  level: PowerLevel,
): StackRecommendation[] {
  const levelMultiplier = level === 'basic' ? 1.5 : level === 'mid' ? 1.2 : level === 'max' ? 1.0 : 0.8;
  const recommendations: StackRecommendation[] = [];

  // Find highest-risk systems to prioritize relevant stacks
  const sortedSystems = Object.entries(scores)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);
  const topSystems = new Set(sortedSystems.slice(0, 4).map(([k]) => k));

  for (const stack of ALL_STACKS) {
    const mechCodes = stack.anatomicalMapping?.mechanismCodes || [];
    if (mechCodes.length === 0) continue;

    const bridgeKeys = findBridgeMechsForStack(mechCodes);
    if (bridgeKeys.length === 0) continue;

    let coveredMechs = 0;
    let totalCoveredMechs = 0;
    const coveredSystems = new Set<string>();
    let topSystemMatches = 0;
    const wasteSubs: string[] = [];

    for (const key of bridgeKeys) {
      const sysKey = key.split('_')[0];
      const sysScore = scores[sysKey] || 0;
      totalCoveredMechs++;
      if (sysScore > 0) {
        coveredMechs++;
        coveredSystems.add(sysKey);
        if (topSystems.has(sysKey)) topSystemMatches++;
      }
    }

    const stackSubs = stack.substances.map(s => s.id);
    for (const subId of stackSubs) {
      let useful = false;
      for (const key of bridgeKeys) {
        const sysKey = key.split('_')[0];
        if ((scores[sysKey] || 0) > 0) { useful = true; break; }
      }
      if (!useful && !selectedIds.has(subId)) wasteSubs.push(subId);
    }

    if (coveredMechs === 0) continue;

    // Score formula: prioritize covering highest-risk systems
    const coverageRatio = coveredMechs / Math.max(1, totalCoveredMechs);
    const synergyBonus = (stack.synergyScore / 100) * coverageRatio;
    const systemsBonus = Math.min(1, coveredSystems.size / 5);
    const topPriority = topSystemMatches / Math.max(1, topSystems.size || 1);
    const wastePenalty = (wasteSubs.length / Math.max(1, stackSubs.length)) * 0.3;

    const score = Math.round(
      (coverageRatio * 0.25 + synergyBonus * 0.3 + systemsBonus * 0.15 + topPriority * 0.3 - wastePenalty)
      * 100 * levelMultiplier
    );

    const topMatchesList = [...coveredSystems].filter(s => topSystems.has(s));
    const reason = coveredSystems.size >= 3
      ? `Покрывает ${coveredSystems.size} систем (${coveredMechs}/${totalCoveredMechs} мех.) · синергия ${stack.synergyScore}/100${topMatchesList.length > 0 ? ` · приоритет: ${topMatchesList.slice(0, 3).map(s => SYS_LABELS[s] || s).join(', ')}` : ''}`
      : coveredSystems.size >= 2
        ? `Покрывает ${coveredSystems.size} системы: ${[...coveredSystems].map(s => SYS_LABELS[s] || s).join(', ')}`
        : `Точечно: ${SYS_LABELS[[...coveredSystems][0]] || [...coveredSystems][0]}${topMatchesList.length > 0 ? ' (приоритет)' : ''}`;

    recommendations.push({
      stack,
      score,
      coveragePercent: Math.round(coverageRatio * 100),
      coveredSystems: [...coveredSystems],
      coveredMechanisms: bridgeKeys,
      synergyBonus: Math.round(synergyBonus * 100),
      wasteSubstances: wasteSubs,
      reason: `${reason}${wasteSubs.length > 0 ? ` · ${wasteSubs.length} лишних` : ''}`,
    });
  }

  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, 10);
}

export function calculateSupportPlan(
  state: CalculatorState,
  level: PowerLevel,
  existingSubs?: string[],
  externalLabs?: any[],
): PlanResult {
  const scores = calcAllRisks(state);
  const sysVals = Object.values(scores) as number[];
  const maxRisk = sysVals.length > 0 ? Math.max(...sysVals) : 30;
  const avgRisk = sysVals.length > 0 ? Math.round(sysVals.reduce((a, b) => a + b, 0) / sysVals.length) : 15;
  const overallRiskBefore = Math.round(maxRisk * 0.6 + avgRisk * 0.4);

  // ─── Proportional risk targets per level (as fraction of overallRiskBefore) ───
  const riskRatios: Record<string, number> = { basic: 0.65, mid: 0.50, max: 0.30, boost: 0.17 };
  const riskTarget = overallRiskBefore * (riskRatios[level] || 0.65);
  // Boost button: additional reduction (base→0.75, mid/max→0.60, boost→0.50)
  const boostRatio: Record<string, number> = { basic: 0.75, mid: 0.60, max: 0.60, boost: 0.50 };
  // will be checked later if boostEnabled is true from state

  // ─── RISK BREAKDOWN: explain sources of each system's risk ───
  const riskBreakdown: Record<string, string[]> = {};
  const p = state.profile || {};
  const ph = state.pharma || {};
  const aas = ph.aas || [];
  const totalDose = aas.reduce((a: number, b: any) => a + (b.doseMgWeek || 0), 0);
  const trainingVolume = (p.workoutsPerWeek || 3) * (p.avgWorkoutMinutes || 60);

  const brd = (sys: string, reason: string) => { if (!riskBreakdown[sys]) riskBreakdown[sys] = []; riskBreakdown[sys].push(reason); };

  // Cardio
  if ((scores.cardio || 0) > 0) {
    if (p.workoutsPerWeek < 2) brd('cardio', `Низкая активность: ${p.workoutsPerWeek || 0} тренировок/нед (+10%)`);
    if (p.sleepHours < 7) brd('cardio', `Недостаток сна: ${p.sleepHours || 0} ч (+5-10%)`);
    if ((p.stressLevel || 4) > 5) brd('cardio', `Стресс: уровень ${p.stressLevel || 4}/10 (+5-10%)`);
    if (p.smoker) brd('cardio', `Курение (+15%)`);
    if ((p.bodyfat || 0) > 25) brd('cardio', `% жира >25% (+8%)`);
    if (totalDose > 0) brd('cardio', `ААС: суммарная доза ${totalDose} мг/нед (+${Math.round(totalDose * 0.015)}%)`);
    if (aas.some((a: any) => a.id.includes('tren'))) brd('cardio', `Тренболон: дополнительная нагрузка (+10%)`);
    if (state.cardio?.bpStage === 'hypertension1') brd('cardio', `Гипертензия 1 ст. (+25%)`);
    else if (state.cardio?.bpStage === 'prehypertension') brd('cardio', `Предгипертензия (+10%)`);
    if (state.cardio?.ldlElevation !== 'none' && state.cardio?.ldlElevation) brd('cardio', `Повышен ЛПНП (+5-15%)`);
    if (state.cardio?.previousCVD) brd('cardio', `ССЗ в анамнезе (+25%)`);
    if (state.cardio?.familyCVD) brd('cardio', `Семейный анамнез ССЗ (+10%)`);
    if (state.contraindications?.hasCVD) brd('cardio', `Диагностированные ССЗ (+20%)`);
    if (state.contraindications?.hasDiabetes) brd('cardio', `Диабет (+10%)`);
    if (ph.hasGH) brd('cardio', `Гормон роста (+5%)`);
    if (ph.hasInsulin) brd('cardio', `Инсулин (+10%)`);
  }

  // Hepatic
  if ((scores.hepatic || 0) > 0) {
    if (p.alcohol === 'regular') brd('hepatic', `Алкоголь регулярно (+20%)`);
    else if (p.alcohol === 'sometimes') brd('hepatic', `Алкоголь иногда (+8%)`);
    if ((p.bodyfat || 0) > 25) brd('hepatic', `% жира >25% (+5%)`);
    if (totalDose > 0) {
      const hasOral = aas.some((a: any) => ['methandienone','oxandrolone','stanozolol','dianabol','anadrol','superdrol','turinabol'].some(n => a.id?.toLowerCase().includes(n)));
      if (hasOral) brd('hepatic', `Оральные ААС — высокая гепатотоксичность (+30%)`);
      else brd('hepatic', `Инъекционные ААС — умеренная нагрузка (+5%)`);
    }
    if (state.hepatobiliary?.fattyLiver) brd('hepatic', `Жировой гепатоз (+20%)`);
    if (state.contraindications?.hasLiverDisease) brd('hepatic', `Заболевания печени (+20%)`);
    if (state.epicrisis?.pastLiverIssues) brd('hepatic', `Проблемы печени в прошлом (+15%)`);
  }

  // Neuro
  if ((scores.neuro || 0) > 0) {
    if ((p.caffeineMg || 0) > 400) brd('neuro', `Кофеин >400 мг/д (+8%)`);
    if (aas.some((a: any) => a.id.includes('tren'))) brd('neuro', `Тренболон — нейротоксичность (+35%)`);
    if (state.neuro?.sleepQuality === 'poor') brd('neuro', `Плохой сон (+15%)`);
    else if (state.neuro?.sleepQuality === 'fair') brd('neuro', `Нестабильный сон (+5%)`);
    if (trainingVolume > 600) brd('neuro', `Высокий тренировочный объём: ${trainingVolume} мин/нед (+5%)`);
    if (ph.hasInsulin) brd('neuro', `Инсулин (+5%)`);
    if (state.contraindications?.hasEpilepsy) brd('neuro', `Эпилепсия (+15%)`);
    if (state.contraindications?.hasMentalIllness) brd('neuro', `Психиатрический диагноз (+10%)`);
  }

  // Renal
  if ((scores.renal || 0) > 0) {
    if (state.urinary?.proteinuria) brd('renal', `Протеинурия (+20%)`);
    if (state.urinary?.nephrotoxicDrugs) brd('renal', `Нефротоксичные препараты (+15%)`);
    if (state.urinary?.hypertension) brd('renal', `Гипертензия (+15%)`);
    if (state.urinary?.diabetes) brd('renal', `Диабет (+20%)`);
    if (state.contraindications?.hasKidneyDisease) brd('renal', `Заболевания почек (+20%)`);
    if (state.contraindications?.hasDiabetes) brd('renal', `Диабет (+10%)`);
    if (state.epicrisis?.pastKidneyIssues) brd('renal', `Проблемы почек в прошлом (+15%)`);
  }

  // Endocrine
  if ((scores.endocrine || 0) > 0) {
    if (totalDose > 0) brd('endocrine', `ААС подавляют ГГЯ (+${Math.round(totalDose * 0.02)}%)`);
    if (ph.hasGH) brd('endocrine', `Гормон роста (+15%)`);
    if (ph.hasIGF) brd('endocrine', `IGF-1 (+8%)`);
    if (state.goals?.previousCycles > 5) brd('endocrine', `${state.goals.previousCycles} циклов в истории (+10%)`);
  }

  // Hematologic
  if ((scores.hematologic || 0) > 0) {
    if (totalDose > 0) brd('hematologic', `ААС повышают гематокрит (+${Math.round(totalDose * 0.01)}%)`);
    if (state.contraindications?.hasThrombophilia) brd('hematologic', `Тромбофилия (+25%)`);
    if (state.epicrisis?.pastHctSpike) brd('hematologic', `Скачки гематокрита в прошлом (+15%)`);
    if (state.cardio?.hctElevation !== 'none' && state.cardio?.hctElevation) brd('hematologic', `Повышен гематокрит (+5-15%)`);
  }

  // Reproductive
  if ((scores.reproductive || 0) > 0) {
    if (totalDose > 0) brd('reproductive', `ААС подавляют сперматогенез (+${Math.round(totalDose * 0.015)}%)`);
    if (state.epicrisis?.pastGyno) brd('reproductive', `Гинекомастия в прошлом (+15%)`);
    if (state.epicrisis?.pastLibidoDrop) brd('reproductive', `Падение либидо в прошлом (+10%)`);
    if (state.goals?.previousCycles > 5) brd('reproductive', `${state.goals.previousCycles} циклов (+10%)`);
  }

  // Musculoskeletal
  if ((scores.musculoskeletal || 0) > 0) {
    if (trainingVolume > 600) brd('musculoskeletal', `Высокий объём тренировок: ${trainingVolume} мин/нед (+10%)`);
    else if (trainingVolume > 400) brd('musculoskeletal', `Умеренный объём: ${trainingVolume} мин/нед (+5%)`);
    if (state.oda?.jointPain === 'severe' || state.oda?.jointPain === 'moderate') brd('musculoskeletal', `Боль в суставах: ${state.oda.jointPain} (+15-30%)`);
    if (state.oda?.ligamentIssues) brd('musculoskeletal', `Проблемы со связками (+15%)`);
    if (state.oda?.backPain) brd('musculoskeletal', `Боли в спине (+10%)`);
    if ((state.oda?.injuries || []).length > 0) brd('musculoskeletal', `${state.oda.injuries.length} травм в истории (+${state.oda.injuries.length * 5}%)`);
  }
  const excludedSubs = new Set(state.journal?.negative?.map((n: any) => normalizeId(n.substanceId)) || []);

  // ─── CONTRAINDICATION FILTER: exclude substances that conflict with user health data ───
  const userCI = new Set<string>();
  const ci = state.contraindications || {};
  if (ci.hasCVD) userCI.add('сердечно-сосудистые').add('ССЗ').add('гипертония').add('CVD');
  if (ci.hasThrombophilia) userCI.add('тромбофилия').add('тромбоз').add('коагуляция');
  if (ci.hasLiverDisease) userCI.add('печен').add('гепатит').add('цирроз').add('печёночная');
  if (ci.hasKidneyDisease) userCI.add('почк').add('почечная').add('нефро').add('ХБП');
  if (ci.hasDiabetes) userCI.add('диабет').add('инсулин').add('гликемия');
  if (ci.hasEpilepsy) userCI.add('эпилепсия').add('судорог');
  if (ci.hasMentalIllness) userCI.add('психи').add('шизофрения').add('биполяр');
  if (ci.hasGI) userCI.add('язва').add('гастрит').add('ЖКТ');
  if (ci.allergies) userCI.add(ci.allergies.toLowerCase());

  function isContraindicated(subId: string): boolean {
    const entry = getCatalogEntry(subId);
    if (!entry?.contraindications) return false;
    for (const contra of entry.contraindications) {
      const low = contra.toLowerCase();
      for (const term of userCI) {
        if (low.includes(term)) return true;
      }
    }
    return false;
  }

  // Also exclude substances with conflicts to current pharma
  const pharmaSubs = new Set((state.pharma?.aas || []).map((a: any) => a.id?.toLowerCase()));
  // ...
  const cw = state.courseWeek ?? 1;

  // ─── WEEK-BASED DOSE SCALING ───
  const weekScale = cw <= 2 ? 0.6 : cw <= 4 ? 0.8 : cw <= 6 ? 0.9 : 1.0;

  // ─── ANALYZE LAB DATA ───
  const internalReadings = analyzeLabData(state);
  const externalReadings = parseLabDataFromExternal(externalLabs);
  const allReadings = [...internalReadings, ...externalReadings];
  const readingByMarker = new Map<string, LabReading>();
  for (const r of allReadings) readingByMarker.set(r.marker, r);
  const dedupedReadings = [...readingByMarker.values()];
  const abnormalLabs = findAbnormalLabs(dedupedReadings);

  // ─── Level thresholds (risk % needed to activate system mechanisms) ───
  const levelThresholds: Record<string, number> = {
    basic: 30, mid: 20, max: 12, boost: 6,
  };
  const threshold = levelThresholds[level] || 15;
  const includeAllSystems = level === 'boost';

  // ─── Select substances via mechanism bridge (breadth-of-coverage) ───
  const selectedIds = new Set<string>(existingSubs?.map(s => normalizeId(s)) || []);
  const substanceReasons: Record<string, { mechInfo: string; system: string }[]> = {};
  const systemMechanisms: Record<string, string[]> = {};
  const allMechanisms: PlanMechanism[] = [];
  const uncoveredMechanisms: Array<{ mechKey: string; mechLabel: string; systemLabel: string; risk: number }> = [];

  // Cache: substance → bridge keys (to avoid repeated full scans)
  const bridgeCache = new Map<string, string[]>();
  function getBridgeKeys(id: string): string[] {
    if (!bridgeCache.has(id)) bridgeCache.set(id, findBridgeMechsForSubstance(id));
    return bridgeCache.get(id)!;
  }

  // ─── Phase 1: Collect activated mechanisms & their candidates ───
  type Activation = { sysKey: string; sysScore: number; mechKey: string; candidates: string[] };
  const activations: Activation[] = [];
  for (const [sysKey, sysScore] of Object.entries(scores)) {
    const mechKeys = SYS_TO_MECH_KEYS[sysKey] || [];
    if (sysScore >= threshold || (includeAllSystems && sysScore >= 2)) {
      for (const mechKey of mechKeys) {
        const { curated, autoIndexed } = findBestSubstancesForBridgeMech(mechKey);
        const useCuratedOnly = level === 'basic' || level === 'mid';
        let subs = curated
          .map(normalizeId)
          .filter(id => !excludedSubs.has(id) && catalogExists(id) && !isContraindicated(id));
        if (subs.length === 0 && !useCuratedOnly) {
          subs = autoIndexed
            .map(normalizeId)
            .filter(id => !excludedSubs.has(id) && catalogExists(id) && !isContraindicated(id));
        }
        if (subs.length === 0) {
          uncoveredMechanisms.push({ mechKey, mechLabel: MECH_LABELS[mechKey] || mechKey, systemLabel: SYS_LABELS[sysKey] || sysKey, risk: sysScore });
          continue;
        }
        activations.push({ sysKey, sysScore, mechKey, candidates: subs });
        if (!systemMechanisms[sysKey]) systemMechanisms[sysKey] = [];
        systemMechanisms[sysKey].push(mechKey);
      }
    }
  }

  const activatedMechSet = new Set(activations.map(a => a.mechKey));
  const coveredMechsSet = new Set<string>();

  // Helper: synergy weight between a substance and the already-selected set
  function calcSynergyWeight(id: string): number {
    const entry = getCatalogEntry(id);
    if (!entry?.synergies) return 0;
    let w = 0;
    for (const syn of entry.synergies) {
      const synId = syn.with.toLowerCase();
      const sev = syn.severity || 'MEDIUM';
      const sv = sev === 'HIGH' ? 15 : sev === 'MEDIUM' ? 10 : 5;
      if (selectedIds.has(synId)) w += sv;
    }
    return w;
  }

  // ─── Phase 2: Score EVERY candidate by synergy + new coverage ───
  // score = synergyWeight × 50 (main driver: substances that work together)
  //       + newCovScore × 8  (how many NEW activated mechs this substance adds)
  //       + bestFormScore (preferred forms get +8)
  // Synergy is weighted 6× higher than breadth — the engine PREFERS synergistic pairs.
  const candidateMeta = new Map<string, {
    newCoverage: number; synergyWeight: number; bestFormScore: number;
    coveredMechs: string[]; coveredSys: string[];
  }>();

  for (const act of activations) {
    for (const id of act.candidates) {
      if (candidateMeta.has(id)) continue;
      const bridgeKeys = getBridgeKeys(id);
      const coveredMechs = bridgeKeys.filter(bk => activatedMechSet.has(bk));
      const coveredSys = [...new Set(activations.filter(a => coveredMechs.includes(a.mechKey)).map(a => a.sysKey))];
      const entry = getCatalogEntry(id);
      const bestFormScore = entry?.bestForCourse ? 8 : 0;
      const synergyWeight = calcSynergyWeight(id);
      // How many of the covered mechanisms are NOT yet covered by selected set
      const newCoverage = coveredMechs.filter(mk => !coveredMechsSet.has(mk)).length;
      candidateMeta.set(id, {
        newCoverage, synergyWeight, bestFormScore,
        coveredMechs, coveredSys,
      });
    }
  }

  // ─── Proportional risk target — determines when to stop adding ───
  const riskRatio = riskRatios[level] || 0.65;
  function isRiskMet(): boolean {
    if (selectedIds.size === 0) return false;
    // Compute exact same formula as final overallAfter
    let wSum = 0, aSys = 0;
    for (const [sys, score] of Object.entries(scores) as [string, number][]) {
      if (score > 0) {
        const mechKeys = SYS_TO_MECH_KEYS[sys] || [];
        const coverCount = [...selectedIds].filter(id => getBridgeKeys(id).some((bk: string) => mechKeys.includes(bk))).length;
        const factor = Math.pow(0.85, coverCount);
        const net = Math.round(score * factor);
        const ep = Math.min(0.85, (score - net) / score);
        wSum += ep;
        aSys++;
      }
    }
    const avgP = aSys > 0 ? wSum / aSys : 0;
    const estimatedAfter = Math.round(overallRiskBefore * (1 - Math.min(1, avgP)));
    return estimatedAfter <= riskTarget;
  }
  const canAdd = () => !isRiskMet();

  // ─── Phase 3: Iterative selection — re-score after each pick ───
  // Each iteration: pick the candidate with highest total score,
  // add it to selected set, re-score remaining (synergy changes).
  function scoreCandidate(id: string): number {
    const m = candidateMeta.get(id);
    if (!m) return -999;
    // Recalc synergy every time (selectedIds changed)
    const sw = calcSynergyWeight(id);
    m.synergyWeight = sw;
    // Recalc new coverage every time (coveredMechsSet changed)
    const nc = m.coveredMechs.filter(mk => !coveredMechsSet.has(mk)).length;
    m.newCoverage = nc;
    return sw * 50 + nc * 8 + m.bestFormScore;
  }

  // Prevent infinite loops
  const MAX_PICKS = 80;
  for (let iter = 0; iter < MAX_PICKS; iter++) {
    // Stop when risk target is met for this level
    if (isRiskMet()) break;
    let bestId = '';
    let bestScore = -1;
    for (const id of candidateMeta.keys()) {
      if (selectedIds.has(id)) continue;
      const s = scoreCandidate(id);
      if (s > bestScore) { bestScore = s; bestId = id; }
    }
    if (!bestId || bestScore <= 0) break;
    const best = candidateMeta.get(bestId)!;
    const addsNewMech = best.newCoverage > 0;
    const hasSynergy = best.synergyWeight > 0;
    if (!addsNewMech && !hasSynergy) break;
    selectedIds.add(bestId);
    best.coveredMechs.forEach(mk => coveredMechsSet.add(mk));
    for (const mk of best.coveredMechs) {
      const act = activations.find(a => a.mechKey === mk);
      if (!act) continue;
      if (!substanceReasons[bestId]) substanceReasons[bestId] = [];
      substanceReasons[bestId].push({
        mechInfo: `${SYS_LABELS[act.sysKey] || act.sysKey}: ${MECH_LABELS[mk] || mk}`,
        system: act.sysKey,
      });
    }
  }

  // ─── Phase 3b: Synergy-only picks ───
  // with already-selected set even if all mechs covered (synergy stack boost)
  for (let iter = 0; iter < 6; iter++) {
    let bestId = '';
    let bestScore = 0;
    for (const id of candidateMeta.keys()) {
      if (selectedIds.has(id)) continue;
      const sw = calcSynergyWeight(id);
      if (sw > bestScore) { bestScore = sw; bestId = id; }
    }
    if (!bestId || bestScore < 30) break; // need at least HIGH synergy
    if (!canAdd()) break;
    selectedIds.add(bestId);
  }

  // ─── Phase 4: Fill uncovered mechanisms with best specialist ───
  // Only for mechanisms with score >= threshold, max gap fills per level
  const uncoveredActs = activations.filter(a => ![...selectedIds].some(id => getBridgeKeys(id).includes(a.mechKey)));
  const sortedUncovered = uncoveredActs.sort((a, b) => b.sysScore - a.sysScore);
  const gapFillMax = level === 'boost' ? 8 : level === 'max' ? 6 : level === 'mid' ? 4 : 2;
  let gapFillCount = 0;
  for (const act of sortedUncovered) {
    if (gapFillCount >= gapFillMax) break;
    if (!canAdd()) break;
    const best = act.candidates
      .filter(id => !selectedIds.has(id) && !excludedSubs.has(id))
      .sort((a, b) => {
        const ea = getCatalogEntry(a);
        const eb = getCatalogEntry(b);
        return (eb?.bestForCourse ? 1 : 0) - (ea?.bestForCourse ? 1 : 0);
      });
    if (best.length === 0) continue;
    const pick = best[0];
    selectedIds.add(pick);
    if (!substanceReasons[pick]) substanceReasons[pick] = [];
    substanceReasons[pick].push({
      mechInfo: `${SYS_LABELS[act.sysKey] || act.sysKey}: ${MECH_LABELS[act.mechKey] || act.mechKey}`,
      system: act.sysKey,
    });
  }

  // ─── Phase 5: Build allMechanisms from final selection ───
  for (const act of activations) {
    const mechSubs = [...selectedIds].filter(id => getBridgeKeys(id).includes(act.mechKey));
    allMechanisms.push({
      mechKey: act.mechKey,
      mechLabel: MECH_LABELS[act.mechKey] || act.mechKey,
      systemLabel: SYS_LABELS[act.sysKey] || act.sysKey,
      substances: mechSubs,
      riskBefore: act.sysScore,
      riskAfter: Math.max(0, act.sysScore * (mechSubs.length > 0 ? 0.15 : 0.85)),
    });
  }

  // ─── LAB-BASED SUBSTANCE SELECTION ───
  const labFindings: PlanResult['labFindings'] = [];
  for (const abn of abnormalLabs) {
    const suggestedSubs = abn.correctionIds.filter(id => !selectedIds.has(id) && !excludedSubs.has(id) && !isContraindicated(id));
    const normSuggested = suggestedSubs.map(normalizeId).filter(id => catalogExists(id));
    labFindings.push({
      marker: abn.marker, name: abn.name, value: `${abn.value} ${abn.unit}`,
      threshold: `${abn.higherIsWorse ? '>' : '<'}${abn.threshold} ${abn.unit}`,
      organ: abn.organ, suggestedSubs: normSuggested,
    });
    // For mid+ levels, auto-add lab-indicated substances
    if ((level === 'mid' || level === 'max' || level === 'boost') && normSuggested.length > 0) {
      for (const subId of normSuggested.slice(0, 2)) {
        if (!selectedIds.has(subId)) {
          selectedIds.add(subId);
          if (!substanceReasons[subId]) substanceReasons[subId] = [];
          substanceReasons[subId].push({ mechInfo: `Лаб-индикация: ${abn.name} (${abn.marker}) отклонён от нормы`, system: abn.system });
        }
      }
    }
  }

  // ─── Mandatory course vitamins: D3 + C + E + taurine (always) ───
  const hasAAS = (state.pharma?.aas || []).length > 0;
  if (hasAAS) {
    for (const vid of ['vitamin_d3', 'vitamin_c', 'vitamin_e']) {
      if (!selectedIds.has(vid) && !isContraindicated(vid) && catalogExists(vid)) {
        selectedIds.add(vid);
        if (!substanceReasons[vid]) substanceReasons[vid] = [];
        const label: Record<string, string> = { vitamin_d3: 'D3 5000 МЕ — иммунитет, кальций, тестостерон', vitamin_c: 'C 1000 мг — антиоксидант, коллаген, иммунитет', vitamin_e: 'E 400 МЕ — мембраны, антиоксидант, простата' };
        substanceReasons[vid].push({ mechInfo: 'Курс: обязательно — ' + (label[vid] || vid), system: 'general' });
      }
    }
  }

  // ─── Cognitive support on course: alpha GPC/citicoline + NAC + nootropic (fasoracetam or lions_mane) ───
  if (hasAAS) {
    // Pick alpha GPC or citicoline (whichever not already selected)
    const cholinergic = ['alpha_gpc', 'citicoline'].find(id => !selectedIds.has(id) && !isContraindicated(id) && catalogExists(id) && canAdd());
    if (cholinergic) {
      selectedIds.add(cholinergic);
      if (!substanceReasons[cholinergic]) substanceReasons[cholinergic] = [];
      substanceReasons[cholinergic].push({ mechInfo: 'Когнитив: на курсе → ' + (cholinergic === 'alpha_gpc' ? 'альфа-ГФХ 300 мг — ацетилхолин, память' : 'цитиколин 500 мг — нейрометаболизм'), system: 'neuro' });
    }
    // Pick fasoracetam or lions_mane (whichever not already selected)
    const nootropic = ['fasoracetam', 'lions_mane'].find(id => !selectedIds.has(id) && !isContraindicated(id) && catalogExists(id) && canAdd());
    if (nootropic) {
      selectedIds.add(nootropic);
      if (!substanceReasons[nootropic]) substanceReasons[nootropic] = [];
      substanceReasons[nootropic].push({ mechInfo: 'Когнитив: на курсе → ' + (nootropic === 'fasoracetam' ? 'фасорацетам 50 мг — ГАМК-ергик, фокус' : 'ежовик 500 мг — BDNF, нейрогенез'), system: 'neuro' });
    }
  }

  // ─── Bromantane on cut (calorie deficit) ───
  const isCutting = (state.nutrition?.calories || 2500) < 2200;
  if (isCutting && !selectedIds.has('bromantane') && !isContraindicated('bromantane') && catalogExists('bromantane') && canAdd()) {
    selectedIds.add('bromantane');
    if (!substanceReasons['bromantane']) substanceReasons['bromantane'] = [];
    substanceReasons['bromantane'].push({ mechInfo: 'Сушка: бромантан 100 мг — адаптоген, энергия, жиросжигание', system: 'neuro' });
  }

  // ─── Taurine always in basic + course (morning) ───
  if (hasAAS && !selectedIds.has('taurine') && !isContraindicated('taurine') && catalogExists('taurine')) {
    selectedIds.add('taurine');
    if (!substanceReasons['taurine']) substanceReasons['taurine'] = [];
    substanceReasons['taurine'].push({ mechInfo: 'Сердце: таурин 1000 мг утром — кардиопротекция, электролиты', system: 'cardio' });
  }

  // ─── MSM + Boswellia — joint pair ───
  const hasJointIssues = (state.oda?.jointPain || 'none') !== 'none' || state.oda?.ligamentIssues || state.oda?.backPain;
  if (hasJointIssues || level === 'boost') {
    for (const jid of ['msm', 'boswellia']) {
      if (!selectedIds.has(jid) && !isContraindicated(jid) && catalogExists(jid) && canAdd()) {
        selectedIds.add(jid);
        if (!substanceReasons[jid]) substanceReasons[jid] = [];
        substanceReasons[jid].push({ mechInfo: 'Суставы: ' + (jid === 'msm' ? 'МСМ 1500 мг — сера для соединительной ткани' : 'босвеллия 500 мг — 5-LOX, противовоспалительное'), system: 'musculoskeletal' });
      }
    }
  }

  // ─── Goal-based support ───
  const goal = state.goals?.trainingCycle || 'maintenance';
  if (goal === 'mass') {
    for (const mid of ['creatine', 'glutamine', 'eaa']) {
      if (!selectedIds.has(mid) && !isContraindicated(mid) && catalogExists(mid) && canAdd()) {
        selectedIds.add(mid);
        if (!substanceReasons[mid]) substanceReasons[mid] = [];
        const note: Record<string, string> = { creatine: 'креатин 5 г — сила, объём, регенерация АТФ', glutamine: 'глютамин 5 г 2x/д — иммунитет, ЖКТ, азотный баланс', eaa: 'EAA 10 г — полный аминокислотный профиль' };
        substanceReasons[mid].push({ mechInfo: 'Масса: ' + (note[mid] || mid), system: 'musculoskeletal' });
      }
    }
  }
  if (goal === 'cut') {
    for (const cid of ['cla', 'l_carnitine']) {
      if (!selectedIds.has(cid) && !isContraindicated(cid) && catalogExists(cid) && canAdd()) {
        selectedIds.add(cid);
        if (!substanceReasons[cid]) substanceReasons[cid] = [];
        const note: Record<string, string> = { cla: 'CLA 3 г — жиросжигание, катаболизм', l_carnitine: 'L-карнитин 2 г — транспорт ЖК в митохондрии' };
        substanceReasons[cid].push({ mechInfo: 'Сушка: ' + (note[cid] || cid), system: 'metabolic' });
      }
    }
  }
  if (goal === 'endurance') {
    for (const eid of ['beta_alanine', 'citrulline', 'cordyceps']) {
      if (!selectedIds.has(eid) && !isContraindicated(eid) && catalogExists(eid) && canAdd()) {
        selectedIds.add(eid);
        if (!substanceReasons[eid]) substanceReasons[eid] = [];
        const note: Record<string, string> = { beta_alanine: 'бета-аланин 3.2 г — буфер усталости', citrulline: 'цитруллин 6 г — NO, кровоток', cordyceps: 'кордицепс 500 мг — аэробная мощность' };
        substanceReasons[eid].push({ mechInfo: 'Выносливость: ' + (note[eid] || eid), system: 'musculoskeletal' });
      }
    }
  }
  if (goal === 'maintenance') {
    for (const rid of ['glycine', 'gaba', 'melatonin', 'magnesium']) {
      if (!selectedIds.has(rid) && !isContraindicated(rid) && catalogExists(rid) && canAdd()) {
        selectedIds.add(rid);
        if (!substanceReasons[rid]) substanceReasons[rid] = [];
        const note: Record<string, string> = { glycine: 'глицин 3 г — ГАМК-ергик, сон', gaba: 'ГАМК 500 мг — расслабление', melatonin: 'мелатонин 3 мг — циркадный ритм', magnesium: 'магний 400 мг — нервно-мышечная' };
        substanceReasons[rid].push({ mechInfo: 'Восстановление: ' + (note[rid] || rid), system: 'neuro' });
      }
    }
  }

  // ─── Condition-based extras ───
  // Masteron/Primobolan → collagen + MSM (dry joints)
  const hasMasteronLike = (state.pharma?.aas || []).some((a: any) =>
    ['masteron','drostanolone','primobolan','methenolone'].some(n => a.id?.toLowerCase().includes(n))
  );
  if (hasMasteronLike) {
    for (const mid of ['collagen', 'msm']) {
      if (!selectedIds.has(mid) && !isContraindicated(mid) && catalogExists(mid) && canAdd()) {
        selectedIds.add(mid);
        if (!substanceReasons[mid]) substanceReasons[mid] = [];
        substanceReasons[mid].push({ mechInfo: 'Суставы: маст/примо → ' + (mid === 'collagen' ? 'коллаген 10 г — связки' : 'МСМ 1500 мг — сера'), system: 'musculoskeletal' });
      }
    }
  }
  // Frequent injections → quercetin + zinc + astragalus (healing)
  const hasFrequentInj = (state.injection?.glutes === 'pain' || state.injection?.quads === 'pain' || state.injection?.delts === 'pain' || (state.pharma?.aas || []).length > 2);
  if (hasFrequentInj) {
    for (const fid of ['quercetin', 'zinc']) {
      if (!selectedIds.has(fid) && !isContraindicated(fid) && catalogExists(fid) && canAdd()) {
        selectedIds.add(fid);
        if (!substanceReasons[fid]) substanceReasons[fid] = [];
        substanceReasons[fid].push({ mechInfo: 'Инъекции: ' + (fid === 'quercetin' ? 'кверцетин 500 мг — заживление, антигистамин' : 'цинк 30 мг — регенерация'), system: 'general' });
      }
    }
  }
  // GH in stack → TMG + folate + B12 (homocysteine protection)
  if (state.pharma?.hasGH) {
    for (const gid of ['betaine', 'folate', 'vitamin_b12']) {
      if (!selectedIds.has(gid) && !isContraindicated(gid) && catalogExists(gid) && canAdd()) {
        selectedIds.add(gid);
        if (!substanceReasons[gid]) substanceReasons[gid] = [];
        substanceReasons[gid].push({ mechInfo: 'GH: гормон роста → ' + (gid === 'betaine' ? 'TMG 3 г — метилирование' : gid === 'folate' ? '5-MTHF 800 мкг' : 'B12 1000 мкг'), system: 'hepatic' });
      }
    }
  }

  // ─── Add hepatoprotection if any hepatic risk ───
  const hepaticScore = scores.hepatic || 0;
  if (hepaticScore >= 10 && !selectedIds.has('nac') && !isContraindicated('nac') && canAdd()) {
    selectedIds.add('nac');
    if (!substanceReasons['nac']) substanceReasons['nac'] = [];
    substanceReasons['nac'].push({ mechInfo: 'Печень: цитолиз, окислительный стресс, детоксикация', system: 'hepatic' });
  }
  if (hepaticScore >= 15 && !selectedIds.has('tudca') && !isContraindicated('tudca') && canAdd()) {
    selectedIds.add('tudca');
    if (!substanceReasons['tudca']) substanceReasons['tudca'] = [];
    substanceReasons['tudca'].push({ mechInfo: 'Печень: холестаз, желчеотток, ER-стресс', system: 'hepatic' });
  }
  if (hepaticScore >= 20 && !selectedIds.has('milk_thistle') && !isContraindicated('milk_thistle') && canAdd() && (level === 'max' || level === 'boost')) {
    selectedIds.add('milk_thistle');
    if (!substanceReasons['milk_thistle']) substanceReasons['milk_thistle'] = [];
    substanceReasons['milk_thistle'].push({ mechInfo: 'Печень: стабилизация мембран гепатоцитов', system: 'hepatic' });
  }

  // ─── Add cardio protection (BP-based dosing) ───
  const bpSystolic = state.cardio?.bpStage === 'hypertension1' ? 135 : state.cardio?.bpStage === 'prehypertension' ? 128 : state.cardio?.bpStage === 'normal' ? 118 : 125;
  const hr = state.cardio?.heartRate || 72;
  // Check for nandrolone (adds nebivolol at lower BP)
  const hasNandrolone = (state.pharma?.aas || []).some((a: any) => a.id?.toLowerCase().includes('nandrolone') || a.id?.toLowerCase().includes('deca'));
  if (bpSystolic >= 123 && !selectedIds.has('telmisartan') && !isContraindicated('telmisartan') && canAdd()) {
    selectedIds.add('telmisartan');
    if (!substanceReasons['telmisartan']) substanceReasons['telmisartan'] = [];
    const dose = bpSystolic >= 128 ? '80 мг' : '40 мг';
    substanceReasons['telmisartan'].push({ mechInfo: `ССС: АД ${bpSystolic} → телмисартан ${dose}`, system: 'cardio' });
  }
  // Nebivolol: BP ≥129 OR nandrolone in stack OR (elevated HR and BP≥123)
  const needNebivolol = bpSystolic >= 129 || hasNandrolone || (hr >= 80 && bpSystolic >= 123);
  if (needNebivolol && !selectedIds.has('nebivolol') && !isContraindicated('nebivolol') && canAdd()) {
    selectedIds.add('nebivolol');
    if (!substanceReasons['nebivolol']) substanceReasons['nebivolol'] = [];
    substanceReasons['nebivolol'].push({ mechInfo: `ССС: ${hasNandrolone ? 'нандролон в стеке → ' : ''}небиволол 2.5 мг под контролем ЧСС и АД`, system: 'cardio' });
  }
  // Nandrolone → always agmatine (NO-boost + BP)
  if (hasNandrolone && !selectedIds.has('agmatine') && !isContraindicated('agmatine') && catalogExists('agmatine') && canAdd()) {
    selectedIds.add('agmatine');
    if (!substanceReasons['agmatine']) substanceReasons['agmatine'] = [];
    substanceReasons['agmatine'].push({ mechInfo: 'ССС: нандролон → агматин 1 г 2x/д — NO-буст, контроль АД, инсулин', system: 'cardio' });
  }

  // ─── Add neuroprotection for levels mid+ ───
  const neuroScore = scores.neuro || 0;
  if ((level === 'max' || level === 'boost') && neuroScore >= 10 && canAdd()) {
    const neuroExtras = ['lions_mane', 'phosphatidylserine', 'theanine', 'glycine'];
    for (const id of neuroExtras) {
      if (!selectedIds.has(id) && !excludedSubs.has(id) && catalogExists(id) && !isContraindicated(id)) {
        selectedIds.add(id);
        if (!substanceReasons[id]) substanceReasons[id] = [];
        substanceReasons[id].push({ mechInfo: 'Нейропротекция: когнитивная поддержка, нейрогенез', system: 'neuro' });
      }
    }
  }
  if (level === 'boost' && neuroScore >= 5 && canAdd()) {
    const boostNeuro = ['ashwagandha', 'melatonin', 'vitamin_b6'];
    for (const id of boostNeuro) {
      if (!selectedIds.has(id) && !excludedSubs.has(id) && catalogExists(id) && !isContraindicated(id)) {
        selectedIds.add(id);
        if (!substanceReasons[id]) substanceReasons[id] = [];
        substanceReasons[id].push({ mechInfo: 'Расширенная нейропротекция: адаптация, сон, нейромедиаторы', system: 'neuro' });
      }
    }
  }

  // ─── Add joint support if user reports joint pain ───
  const hasJointPain = (state.oda?.jointPain || 'none') !== 'none' && (state.oda?.jointPain || 'none') !== '';
  if (hasJointPain) {
    const jointSubs = [
      { id: 'collagen', reason: 'Коллаген UC-II: восстановление хрящевой ткани, сухожилий и связок' },
      { id: 'glucosamine', reason: 'Глюкозамин: строительный блок протеогликанов хряща' },
      { id: 'msm', reason: 'МСМ: органическая сера, противовоспалительное, регенерация соединительной ткани' },
      { id: 'boswellia', reason: 'Босвеллия: ингибирует 5-LOX, мощное противовоспалительное для суставов' },
      { id: 'chondroitin_sulfate', reason: 'Хондроитин: удержание воды в хряще, эластичность' },
      { id: 'hyaluronic_acid', reason: 'Гиалуроновая кислота: синовиальная жидкость, смазка суставов' },
      { id: 'bcp157', reason: 'BPC-157: пептид — регенерация сухожилий, связок, ангиогенез (профилактика 2-3x/нед)' },
      { id: 'tb500', reason: 'TB-500: пептид — актин-связывающий, миграция клеток, противовоспалительное (профилактика 2-3x/нед)' },
      { id: 'vitamin_c', reason: 'Витамин C: кофактор синтеза коллагена, антиоксидант для суставов' },
    ];
    const odaPain = (state.oda?.jointPain || 'none');
    const isSymptomatic = odaPain === 'moderate' || odaPain === 'severe';
    for (const js of jointSubs) {
      if (!selectedIds.has(js.id) && !excludedSubs.has(js.id) && catalogExists(js.id) && canAdd()) {
        selectedIds.add(js.id);
        if (!substanceReasons[js.id]) substanceReasons[js.id] = [];
        const note = js.id === 'bcp157' || js.id === 'tb500'
          ? (isSymptomatic ? `${js.reason} (усиленная доза при симптомах)` : `${js.reason} (профилактическая доза)`)
          : js.reason;
        substanceReasons[js.id].push({ mechInfo: `Суставы: ${note}`, system: 'musculoskeletal' });
      }
    }
  }

  // ─── Boost mode: add extra protection ───
  const isBoostEnabled = level === 'boost';
  if (isBoostEnabled) {
    const boostExtras = ['astragalus', 'melatonin', 'ginseng', 'egcg', 'l_carnitine', 'saw_palmetto', 'selenium', 'iron', 'copper', 'potassium'];
    for (const id of boostExtras) {
      if (!selectedIds.has(id) && !excludedSubs.has(id) && catalogExists(id) && !isContraindicated(id) && canAdd()) {
        selectedIds.add(id);
        if (!substanceReasons[id]) substanceReasons[id] = [];
        substanceReasons[id].push({ mechInfo: 'Буст-защита: дополнительная поддержка всех систем', system: 'general' });
      }
    }
  }

  // ─── HCG: auto-assign when AAS detected (all levels) ───
  if (hasAAS && !selectedIds.has('hcg') && !isContraindicated('hcg') && canAdd()) {
    selectedIds.add('hcg');
    if (!substanceReasons['hcg']) substanceReasons['hcg'] = [];
    substanceReasons['hcg'].push({ mechInfo: 'ГГЯ: поддержка яичек на курсе ААС, 500 МЕ 2р/нед, схема 3/1 (3 нед приема → 1 нед отдых)', system: 'endocrine' });
  }

  // ─── Anastrozole: AI day-of-injection if aromatizable AAS or high E2 ───
  const hasAromAAS = (state.pharma?.aas || []).some((a: any) =>
    !['nandrolone','trenbolone','primobolan','drostanolone','masteron'].some(n => a.id?.toLowerCase().includes(n))
  );
  const preE2 = parseFloat(state.labs?.preCourse?.panelSex?.['E2'] || '0');
  const midE2 = parseFloat(state.labs?.midCourse?.panelSex?.['E2'] || '0');
  const e2High = preE2 > 150 || midE2 > 120;
  if (hasAAS && hasAromAAS && !selectedIds.has('anastrozole') && !isContraindicated('anastrozole') && (level === 'max' || level === 'boost' || e2High)) {
    selectedIds.add('anastrozole');
    if (!substanceReasons['anastrozole']) substanceReasons['anastrozole'] = [];
    substanceReasons['anastrozole'].push({ mechInfo: 'Эндокринная: контроль эстрадиола в день укола, 0.5-1 мг', system: 'endocrine' });
  }

  // ─── Cabergoline: under prolactin control, no fixed dose ───
  const preProl = parseFloat(state.labs?.preCourse?.panelSex?.['Prolactin'] || '0');
  const midProl = parseFloat(state.labs?.midCourse?.panelSex?.['Prolactin'] || '0');
  const prolactinHigh = preProl > 30 || midProl > 25;
  const hasTren = (state.pharma?.aas || []).some((a: any) => a.id?.toLowerCase().includes('tren'));
  if ((hasTren || prolactinHigh) && !selectedIds.has('cabergoline') && !isContraindicated('cabergoline') && (level === 'max' || level === 'boost')) {
    selectedIds.add('cabergoline');
    if (!substanceReasons['cabergoline']) substanceReasons['cabergoline'] = [];
    substanceReasons['cabergoline'].push({ mechInfo: 'Эндокринная: контроль пролактина (под анализы), без фикс. дозы', system: 'endocrine' });
  }

  // ─── Tren / Oral AAS → ALWAYS NAC + TUDCA ───
  const hasOral = (state.pharma?.aas || []).some((a: any) =>
    ['methandienone','oxandrolone','stanozolol','dianabol','anadrol','superdrol','turinabol','halodrol','oxymetholone'].some(n => a.id?.toLowerCase().includes(n))
  );
  const hasTrenOrOral = hasTren || hasOral;
  if (hasTrenOrOral) {
    if (!selectedIds.has('nac') && !isContraindicated('nac')) {
      selectedIds.add('nac');
      if (!substanceReasons['nac']) substanceReasons['nac'] = [];
      substanceReasons['nac'].push({ mechInfo: 'Печень: обязательно при трен/оралках — глутатион, детоксикация', system: 'hepatic' });
    }
    if (!selectedIds.has('tudca') && !isContraindicated('tudca') && canAdd()) {
      selectedIds.add('tudca');
      if (!substanceReasons['tudca']) substanceReasons['tudca'] = [];
      substanceReasons['tudca'].push({ mechInfo: 'Печень: обязательно при трен/оралках — ER-стресс, желчеотток', system: 'hepatic' });
    }
  }

  // ─── Tren / Lipid-damaging → BERGAMOT ───
  const hasLipidDamaging = hasTren || (state.pharma?.aas || []).some((a: any) =>
    ['methandienone','oxandrolone','stanozolol','winstrol','anadrol','superdrol'].some(n => a.id?.toLowerCase().includes(n))
  );
  if (hasLipidDamaging && !selectedIds.has('bergamot') && !isContraindicated('bergamot') && catalogExists('bergamot') && canAdd()) {
    selectedIds.add('bergamot');
    if (!substanceReasons['bergamot']) substanceReasons['bergamot'] = [];
    substanceReasons['bergamot'].push({ mechInfo: 'Липиды: трен/оралки → бергамот 500 мг, защита ЛПВП', system: 'cardio' });
  }

  // ─── Kidney stress / Tren → ASTRAGALUS ───
  const hasRenalRisk = hasTren || (state.urinary?.creatinineElevation !== 'none' && state.urinary?.creatinineElevation !== '') || (state.urinary?.proteinuria) || (state.contraindications?.hasKidneyDisease) || (state.cardio?.bpStage !== 'normal');
  if (hasRenalRisk && !selectedIds.has('astragalus') && !isContraindicated('astragalus') && catalogExists('astragalus') && canAdd()) {
    selectedIds.add('astragalus');
    if (!substanceReasons['astragalus']) substanceReasons['astragalus'] = [];
    substanceReasons['astragalus'].push({ mechInfo: 'Почки: ренопротекция — астрагал 500 мг 2x/д', system: 'renal' });
  }

  // ─── BP / Vascular → serrapeptase + nattokinase + bromelain + tadalafil 5mg ───
  const bpSystolicVal = state.cardio?.bpStage === 'hypertension1' ? 135 : state.cardio?.bpStage === 'prehypertension' ? 128 : 0;
  if (bpSystolicVal >= 125) {
    if (!selectedIds.has('serrapeptase') && !isContraindicated('serrapeptase') && catalogExists('serrapeptase') && canAdd()) {
      selectedIds.add('serrapeptase');
      if (!substanceReasons['serrapeptase']) substanceReasons['serrapeptase'] = [];
      substanceReasons['serrapeptase'].push({ mechInfo: 'Сосуды: АД ' + bpSystolicVal + ' → серрапептаза 120 000 ЕД, фибринолиз', system: 'cardio' });
    }
    if (!selectedIds.has('nattokinase') && !isContraindicated('nattokinase') && canAdd()) {
      selectedIds.add('nattokinase');
      if (!substanceReasons['nattokinase']) substanceReasons['nattokinase'] = [];
      substanceReasons['nattokinase'].push({ mechInfo: 'Сосуды: АД ' + bpSystolicVal + ' → наттокиназа 2000 FU, реология', system: 'cardio' });
    }
    if (!selectedIds.has('bromelain') && !isContraindicated('bromelain') && canAdd()) {
      selectedIds.add('bromelain');
      if (!substanceReasons['bromelain']) substanceReasons['bromelain'] = [];
      substanceReasons['bromelain'].push({ mechInfo: 'Сосуды: АД ' + bpSystolicVal + ' → бромелайн 500 мг, протеолиз', system: 'cardio' });
    }
    // Tadalafil 5 mg for vascular + BP + NO
    if (!selectedIds.has('pharma_tadalafil') && !isContraindicated('pharma_tadalafil') && catalogExists('pharma_tadalafil') && canAdd()) {
      selectedIds.add('pharma_tadalafil');
      if (!substanceReasons['pharma_tadalafil']) substanceReasons['pharma_tadalafil'] = [];
      substanceReasons['pharma_tadalafil'].push({ mechInfo: 'Сосуды: АД ' + bpSystolicVal + ' → тадалафил 5 мг, NO-модуляция + эндотелий', system: 'cardio' });
    }
  }

  // ─── Homocysteine → TMG (betaine) + 5-MTHF (folate) ───
  const hcyPre = parseFloat(state.labs?.preCourse?.panelBiochem?.['Homocysteine'] || '0');
  const hcyMid = parseFloat(state.labs?.midCourse?.panelBiochem?.['Homocysteine'] || '0');
  const hcyMax = Math.max(hcyPre, hcyMid);
  if (hcyMax > 10) {
    if (!selectedIds.has('folate') && !isContraindicated('folate') && canAdd()) {
      selectedIds.add('folate');
      if (!substanceReasons['folate']) substanceReasons['folate'] = [];
      substanceReasons['folate'].push({ mechInfo: 'Метилирование: гомоцистеин ' + hcyMax + ' мкмоль/л → 5-MTHF 800 мкг', system: 'hepatic' });
    }
    if (hcyMax > 12 && !selectedIds.has('betaine') && !isContraindicated('betaine') && canAdd()) {
      selectedIds.add('betaine');
      if (!substanceReasons['betaine']) substanceReasons['betaine'] = [];
      substanceReasons['betaine'].push({ mechInfo: 'Метилирование: гомоцистеин ' + hcyMax + ' → TMG (бетаин) 3 г', system: 'hepatic' });
    }
    if (hcyMax > 15 && !selectedIds.has('vitamin_b12') && !isContraindicated('vitamin_b12') && canAdd()) {
      selectedIds.add('vitamin_b12');
      if (!substanceReasons['vitamin_b12']) substanceReasons['vitamin_b12'] = [];
      substanceReasons['vitamin_b12'].push({ mechInfo: 'Метилирование: гомоцистеин >15 → B12 1000 мкг', system: 'hepatic' });
    }
  }

  // ─── Creatinine >115 → Cordyceps ───
  const creatPre = parseFloat(state.labs?.preCourse?.panelBiochem?.['Creatinine'] || '0');
  const creatMid = parseFloat(state.labs?.midCourse?.panelBiochem?.['Creatinine'] || '0');
  const creatMax = Math.max(creatPre, creatMid);
  if (creatMax > 115 && !selectedIds.has('cordyceps') && !isContraindicated('cordyceps') && catalogExists('cordyceps') && canAdd()) {
    selectedIds.add('cordyceps');
    if (!substanceReasons['cordyceps']) substanceReasons['cordyceps'] = [];
    substanceReasons['cordyceps'].push({ mechInfo: 'Почки: креатинин ' + creatMax + ' → кордицепс 500 мг 2x/д', system: 'renal' });
  }

  // ─── Hematocrit >0.50 → serra + natto + bromelain + эритроцитаферез ───
  const hctPre = parseFloat(state.labs?.preCourse?.panelHematology?.['HCT'] || '0');
  const hctMid = parseFloat(state.labs?.midCourse?.panelHematology?.['HCT'] || '0');
  const hctMax = Math.max(hctPre, hctMid);
  if (hctMax > 0.50 || state.cardio?.hctElevation !== 'none') {
    for (const hid of ['serrapeptase', 'nattokinase', 'bromelain']) {
      if (!selectedIds.has(hid) && !isContraindicated(hid) && catalogExists(hid) && canAdd()) {
        selectedIds.add(hid);
        if (!substanceReasons[hid]) substanceReasons[hid] = [];
        substanceReasons[hid].push({ mechInfo: 'Гематокрит: ' + (hctMax || '?') + '% → ' + (hid === 'serrapeptase' ? 'серрапептаза 120 000 ЕД' : hid === 'nattokinase' ? 'наттокиназа 2000 FU' : 'бромелайн 500 мг') + ' + рекомендован эритроцитаферез (донорство как альтернатива)', system: 'hematologic' });
      }
    }
  }

  // ─── Expanded lab panels → targeted substances ───
  const gluPre = parseFloat(state.labs?.preCourse?.panelBiochem?.['Glucose'] || '0');
  const gluMid = parseFloat(state.labs?.midCourse?.panelBiochem?.['Glucose'] || '0');
  const gluMax = Math.max(gluPre, gluMid);
  if (gluMax > 5.6) {
    if (!selectedIds.has('berberine') && !isContraindicated('berberine') && canAdd()) selectedIds.add('berberine') && (substanceReasons['berberine'] = substanceReasons['berberine'] || []).push({ mechInfo: 'Метаболизм: глюкоза ' + gluMax + ' → берберин 500 мг 2x/д', system: 'endocrine' });
    if (!selectedIds.has('chromium') && !isContraindicated('chromium') && canAdd()) selectedIds.add('chromium') && (substanceReasons['chromium'] = substanceReasons['chromium'] || []).push({ mechInfo: 'Метаболизм: глюкоза ' + gluMax + ' → хром 200 мкг', system: 'endocrine' });
  }

  const crpPre = parseFloat(state.labs?.preCourse?.panelBiochem?.['CRP'] || '0');
  const crpMid = parseFloat(state.labs?.midCourse?.panelBiochem?.['CRP'] || '0');
  const crpMax = Math.max(crpPre, crpMid);
  if (crpMax > 5) {
    if (!selectedIds.has('curcumin') && !isContraindicated('curcumin') && canAdd()) selectedIds.add('curcumin') && (substanceReasons['curcumin'] = substanceReasons['curcumin'] || []).push({ mechInfo: 'Воспаление: СРБ ' + crpMax + ' → куркумин 1000 мг', system: 'hepatic' });
    if (!selectedIds.has('omega3') && !isContraindicated('omega3') && canAdd()) selectedIds.add('omega3') && (substanceReasons['omega3'] = substanceReasons['omega3'] || []).push({ mechInfo: 'Воспаление: СРБ ' + crpMax + ' → омега-3 2 г EPA+DHA', system: 'cardio' });
  }

  const ldlPre = parseFloat(state.labs?.preCourse?.panelLipid?.['LDL'] || '0');
  const ldlMid = parseFloat(state.labs?.midCourse?.panelLipid?.['LDL'] || '0');
  const ldlMax = Math.max(ldlPre, ldlMid);
  if (ldlMax > 3.0) {
    if (!selectedIds.has('omega3') && !isContraindicated('omega3') && canAdd()) selectedIds.add('omega3') && (substanceReasons['omega3'] = substanceReasons['omega3'] || []).push({ mechInfo: 'Липиды: ЛПНП ' + ldlMax + ' → омега-3 2 г', system: 'cardio' });
    if (!selectedIds.has('bergamot') && !isContraindicated('bergamot') && catalogExists('bergamot') && canAdd()) selectedIds.add('bergamot') && (substanceReasons['bergamot'] = substanceReasons['bergamot'] || []).push({ mechInfo: 'Липиды: ЛПНП ' + ldlMax + ' → бергамот 500 мг', system: 'cardio' });
  }

  const tgPre = parseFloat(state.labs?.preCourse?.panelLipid?.['Triglycerides'] || '0');
  const tgMid = parseFloat(state.labs?.midCourse?.panelLipid?.['Triglycerides'] || '0');
  const tgMax = Math.max(tgPre, tgMid);
  if (tgMax > 1.7) {
    if (!selectedIds.has('omega3') && !isContraindicated('omega3') && canAdd()) selectedIds.add('omega3') && (substanceReasons['omega3'] = substanceReasons['omega3'] || []).push({ mechInfo: 'Липиды: ТГ ' + tgMax + ' → омега-3 4 г', system: 'cardio' });
    if (!selectedIds.has('berberine') && !isContraindicated('berberine') && canAdd()) selectedIds.add('berberine') && (substanceReasons['berberine'] = substanceReasons['berberine'] || []).push({ mechInfo: 'Липиды: ТГ ' + tgMax + ' → берберин 500 мг', system: 'cardio' });
  }

  const fertPre = parseFloat(state.labs?.preCourse?.panelIron?.['Ferritin'] || '0');
  const fertMid = parseFloat(state.labs?.midCourse?.panelIron?.['Ferritin'] || '0');
  const fertMin = Math.min(fertPre || 999, fertMid || 999);
  if (fertMin > 0 && fertMin < 30) {
    if (!selectedIds.has('iron') && !isContraindicated('iron') && canAdd()) selectedIds.add('iron') && (substanceReasons['iron'] = substanceReasons['iron'] || []).push({ mechInfo: 'Кровь: ферритин ' + fertMin + ' → железо 18 мг + вит.C', system: 'hematologic' });
    if (!selectedIds.has('vitamin_c') && !isContraindicated('vitamin_c') && canAdd()) selectedIds.add('vitamin_c') && (substanceReasons['vitamin_c'] = substanceReasons['vitamin_c'] || []).push({ mechInfo: 'Кровь: ферритин ↓ → вит.C 1000 мг для абсорбции железа', system: 'hematologic' });
  }

  const tshPre = parseFloat(state.labs?.preCourse?.panelThyroid?.['TSH'] || '0');
  const tshMid = parseFloat(state.labs?.midCourse?.panelThyroid?.['TSH'] || '0');
  if ((tshPre > 4.0 || tshMid > 4.0)) {
    if (!selectedIds.has('selenium') && !isContraindicated('selenium') && canAdd()) selectedIds.add('selenium') && (substanceReasons['selenium'] = substanceReasons['selenium'] || []).push({ mechInfo: 'Щитовидная: ТТГ↑ → селен 200 мкг', system: 'endocrine' });
    if (!selectedIds.has('zinc') && !isContraindicated('zinc') && canAdd()) selectedIds.add('zinc') && (substanceReasons['zinc'] = substanceReasons['zinc'] || []).push({ mechInfo: 'Щитовидная: ТТГ↑ → цинк 30 мг', system: 'endocrine' });
  }

  const kPre = parseFloat(state.labs?.preCourse?.panelBiochem?.['Potassium'] || '0');
  const kMid = parseFloat(state.labs?.midCourse?.panelBiochem?.['Potassium'] || '0');
  const kMin = Math.min(kPre || 5, kMid || 5);
  if (kMin > 0 && kMin < 3.5) {
    if (!selectedIds.has('potassium') && !isContraindicated('potassium') && canAdd()) selectedIds.add('potassium') && (substanceReasons['potassium'] = substanceReasons['potassium'] || []).push({ mechInfo: 'Электролиты: K ' + kMin + ' → калий цитрат 300 мг', system: 'cardio' });
  }

  const testoPre = parseFloat(state.labs?.preCourse?.panelSex?.['Total T'] || '0');
  const testoMid = parseFloat(state.labs?.midCourse?.panelSex?.['Total T'] || '0');
  const testoMin = Math.min(testoPre || 20, testoMid || 20);
  if (testoMin > 0 && testoMin < 8) {
    if (!selectedIds.has('zinc') && !isContraindicated('zinc') && canAdd()) selectedIds.add('zinc') && (substanceReasons['zinc'] = substanceReasons['zinc'] || []).push({ mechInfo: 'Гормоны: TT ' + testoMin + ' → цинк 30 мг', system: 'endocrine' });
    if (!selectedIds.has('boron') && !isContraindicated('boron') && canAdd()) selectedIds.add('boron') && (substanceReasons['boron'] = substanceReasons['boron'] || []).push({ mechInfo: 'Гормоны: TT ↓ → бор 6 мг', system: 'endocrine' });
    if (!selectedIds.has('vitamin_d3') && !isContraindicated('vitamin_d3') && canAdd()) selectedIds.add('vitamin_d3') && (substanceReasons['vitamin_d3'] = substanceReasons['vitamin_d3'] || []).push({ mechInfo: 'Гормоны: TT ↓ → D3 5000 МЕ', system: 'endocrine' });
  }

  const mgPre = parseFloat(state.labs?.preCourse?.panelBiochem?.['Magnesium'] || '0');
  const mgMid = parseFloat(state.labs?.midCourse?.panelBiochem?.['Magnesium'] || '0');
  const mgMin = Math.min(mgPre || 1, mgMid || 1);
  if (mgMin > 0 && mgMin < 0.75) {
    if (!selectedIds.has('magnesium') && !isContraindicated('magnesium') && canAdd()) selectedIds.add('magnesium') && (substanceReasons['magnesium'] = substanceReasons['magnesium'] || []).push({ mechInfo: 'Электролиты: Mg ' + mgMin + ' → магний 400 мг', system: 'cardio' });
  }

  // ─── SUBSTANCE CAP REMOVED — unlimited coverage ───

  // B5: Auto-apply high-scoring stacks (score >70, covers ≥3 systems, synergy > 80)
  const autoStacks = recommendStacks(scores, selectedIds, level);
  for (const rec of autoStacks) {
    if (rec.score >= 70 && rec.coveredSystems.length >= 3 && rec.stack.synergyScore >= 85) {
      for (const sub of rec.stack.substances) {
        if (!canAdd()) break;
        const normId = normalizeId(sub.id);
        if (!selectedIds.has(normId) && !excludedSubs.has(normId) && catalogExists(normId) && !isContraindicated(normId) && !rec.wasteSubstances.includes(sub.id)) {
          selectedIds.add(normId);
          if (!substanceReasons[normId]) substanceReasons[normId] = [];
          substanceReasons[normId].push({ mechInfo: `Стек «${rec.stack.name}»: ${sub.mechanism || 'синергия стека'}`, system: rec.stack.system });
        }
      }
    }
  }

  // ─── SNP / GENETIC PERSONALIZATION ───
  if (state.genetics?.mthfr === 'c677t') {
    if (!selectedIds.has('folate') && !isContraindicated('folate')) {
      selectedIds.add('folate');
      substanceReasons['folate'] = substanceReasons['folate'] || [];
      substanceReasons['folate'].push({ mechInfo: 'Генетика MTHFR C677T: обязателен 5-MTHF (активный фолат)', system: 'general' });
    }
    if (!selectedIds.has('vitamin_b12') && !isContraindicated('vitamin_b12')) {
      selectedIds.add('vitamin_b12');
      substanceReasons['vitamin_b12'] = substanceReasons['vitamin_b12'] || [];
      substanceReasons['vitamin_b12'].push({ mechInfo: 'Генетика MTHFR: метилкобаламин для обхода дефекта метилирования', system: 'general' });
    }
    if (!selectedIds.has('vitamin_b6') && !isContraindicated('vitamin_b6')) {
      selectedIds.add('vitamin_b6');
      substanceReasons['vitamin_b6'] = substanceReasons['vitamin_b6'] || [];
      substanceReasons['vitamin_b6'].push({ mechInfo: 'Генетика MTHFR: P5P для транссульфурации гомоцистеина', system: 'general' });
    }
  }
  if (state.genetics?.cyp19a1 === 'high') {
    if (!selectedIds.has('dim') && !isContraindicated('dim')) { selectedIds.add('dim'); if (!substanceReasons['dim']) substanceReasons['dim'] = []; substanceReasons['dim'].push({ mechInfo: 'Генетика CYP19A1 ↑: контроль ароматизации', system: 'endocrine' }); }
  }
  if (state.genetics?.srd5a2 === 'hypersensitive') {
    if (!selectedIds.has('saw_palmetto') && !isContraindicated('saw_palmetto')) { selectedIds.add('saw_palmetto'); if (!substanceReasons['saw_palmetto']) substanceReasons['saw_palmetto'] = []; substanceReasons['saw_palmetto'].push({ mechInfo: 'Генетика SRD5A2 ↑: контроль ДГТ', system: 'reproductive' }); }
  }
  if (state.genetics?.arSensitivity === 'high') {
    if (!selectedIds.has('omega3') && !isContraindicated('omega3')) { selectedIds.add('omega3'); if (!substanceReasons['omega3']) substanceReasons['omega3'] = []; substanceReasons['omega3'].push({ mechInfo: 'Генетика AR ↑: кардиопротекция при высокой чувствительности', system: 'cardio' }); }
  }
  if (state.genetics?.arSensitivity === 'low') {
    if (!selectedIds.has('zinc') && !isContraindicated('zinc')) { selectedIds.add('zinc'); if (!substanceReasons['zinc']) substanceReasons['zinc'] = []; substanceReasons['zinc'].push({ mechInfo: 'Генетика AR ↓: повышение чувствительности рецепторов', system: 'endocrine' }); }
  }

  // ─── Expanded lab-to-substance mapping (remaining markers) ───
  const _l = state.labs;
  // HDL <1.0 → omega3 + bergamot
  const hdlPre = parseFloat(_l?.preCourse?.panelLipid?.['HDL'] || '0');
  const hdlMid = parseFloat(_l?.midCourse?.panelLipid?.['HDL'] || '0');
  if ((hdlPre > 0 && hdlPre < 1.0) || (hdlMid > 0 && hdlMid < 1.0)) {
    if (!selectedIds.has('omega3') && !isContraindicated('omega3') && canAdd()) selectedIds.add('omega3') && (substanceReasons['omega3'] = substanceReasons['omega3'] || []).push({ mechInfo: 'Липиды: ЛПВП↓ → омега-3 4 г', system: 'cardio' });
  }
  // Uric acid >420 → tart cherry + quercetin
  const uaPre = parseFloat(_l?.preCourse?.panelBiochem?.['Uric acid'] || '0');
  const uaMid = parseFloat(_l?.midCourse?.panelBiochem?.['Uric acid'] || '0');
  const uaMax = Math.max(uaPre, uaMid);
  if (uaMax > 420) {
    if (!selectedIds.has('quercetin') && !isContraindicated('quercetin') && catalogExists('quercetin') && canAdd()) selectedIds.add('quercetin') && (substanceReasons['quercetin'] = substanceReasons['quercetin'] || []).push({ mechInfo: 'Мочевая кислота: ' + uaMax + ' → кверцетин 500 мг', system: 'renal' });
    if (!selectedIds.has('vitamin_c') && !isContraindicated('vitamin_c') && canAdd()) selectedIds.add('vitamin_c') && (substanceReasons['vitamin_c'] = substanceReasons['vitamin_c'] || []).push({ mechInfo: 'Мочевая кислота: ↑ → вит.C 1000 мг', system: 'renal' });
  }
  // Cortisol >25 → ashwagandha + phosphatidylserine
  const cortPre = parseFloat(_l?.preCourse?.panelSex?.['Cortisol'] || '0');
  const cortMid = parseFloat(_l?.midCourse?.panelSex?.['Cortisol'] || '0');
  const cortMax = Math.max(cortPre, cortMid);
  if (cortMax > 25) {
    if (!selectedIds.has('ashwagandha') && !isContraindicated('ashwagandha') && canAdd()) selectedIds.add('ashwagandha') && (substanceReasons['ashwagandha'] = substanceReasons['ashwagandha'] || []).push({ mechInfo: 'Стресс: кортизол ' + cortMax + ' → ашваганда KSM-66 600 мг', system: 'neuro' });
    if (!selectedIds.has('phosphatidylserine') && !isContraindicated('phosphatidylserine') && canAdd()) selectedIds.add('phosphatidylserine') && (substanceReasons['phosphatidylserine'] = substanceReasons['phosphatidylserine'] || []).push({ mechInfo: 'Стресс: кортизол ↑ → фосфатидилсерин 300 мг', system: 'neuro' });
  }
  // SHBG >50 → boron + nettle
  const shbgPre = parseFloat(_l?.preCourse?.panelSex?.['SHBG'] || '0');
  const shbgMid = parseFloat(_l?.midCourse?.panelSex?.['SHBG'] || '0');
  if ((shbgPre > 50 || shbgMid > 50)) {
    if (!selectedIds.has('boron') && !isContraindicated('boron') && canAdd()) selectedIds.add('boron') && (substanceReasons['boron'] = substanceReasons['boron'] || []).push({ mechInfo: 'Гормоны: SHBG ' + (Math.max(shbgPre, shbgMid)) + ' → бор 6 мг', system: 'endocrine' });
  }
  // CK >200 → CoQ10 + magnesium
  const ckPre = parseFloat(_l?.preCourse?.panelCardiac?.['CK'] || '0');
  const ckMid = parseFloat(_l?.midCourse?.panelCardiac?.['CK'] || '0');
  const ckMax = Math.max(ckPre, ckMid);
  if (ckMax > 200) {
    if (!selectedIds.has('coq10') && !isContraindicated('coq10') && canAdd()) selectedIds.add('coq10') && (substanceReasons['coq10'] = substanceReasons['coq10'] || []).push({ mechInfo: 'Мышцы: КФК ' + ckMax + ' → CoQ10 200 мг', system: 'musculoskeletal' });
    if (!selectedIds.has('magnesium') && !isContraindicated('magnesium') && canAdd()) selectedIds.add('magnesium') && (substanceReasons['magnesium'] = substanceReasons['magnesium'] || []).push({ mechInfo: 'Мышцы: КФК ↑ → магний 400 мг', system: 'musculoskeletal' });
  }
  // HbA1c >5.7% → berberine + chromium + cinnamon
  const hba1cPre = parseFloat(_l?.preCourse?.panelBiochem?.['HbA1c'] || '0');
  const hba1cMid = parseFloat(_l?.midCourse?.panelBiochem?.['HbA1c'] || '0');
  if ((hba1cPre > 5.7 || hba1cMid > 5.7)) {
    if (!selectedIds.has('cinnamon') && !isContraindicated('cinnamon') && catalogExists('cinnamon') && canAdd()) selectedIds.add('cinnamon') && (substanceReasons['cinnamon'] = substanceReasons['cinnamon'] || []).push({ mechInfo: 'Метаболизм: HbA1c↑ → корица 500 мг', system: 'endocrine' });
  }
  // Hemoglobin >170 → hydration + nattokinase
  const hbPre = parseFloat(_l?.preCourse?.panelHematology?.['Hemoglobin'] || '0');
  const hbMid = parseFloat(_l?.midCourse?.panelHematology?.['Hemoglobin'] || '0');
  if ((hbPre > 170 || hbMid > 170)) {
    if (!selectedIds.has('nattokinase') && !isContraindicated('nattokinase') && canAdd()) selectedIds.add('nattokinase') && (substanceReasons['nattokinase'] = substanceReasons['nattokinase'] || []).push({ mechInfo: 'Кровь: Hb ' + (Math.max(hbPre, hbMid)) + ' → наттокиназа + рекомендована гидратация', system: 'hematologic' });
  }
  // WBC <4 → zinc + D3
  const wbcPre = parseFloat(_l?.preCourse?.panelHematology?.['WBC'] || '0');
  const wbcMid = parseFloat(_l?.midCourse?.panelHematology?.['WBC'] || '0');
  if ((wbcPre > 0 && wbcPre < 4) || (wbcMid > 0 && wbcMid < 4)) {
    if (!selectedIds.has('zinc') && !isContraindicated('zinc') && canAdd()) selectedIds.add('zinc') && (substanceReasons['zinc'] = substanceReasons['zinc'] || []).push({ mechInfo: 'Иммунитет: лейкоциты↓ → цинк 30 мг', system: 'hematologic' });
  }
  // GGT >55 → TUDCA + milk_thistle
  const ggtPre = parseFloat(_l?.preCourse?.panelBiochem?.['GGT'] || '0');
  const ggtMid = parseFloat(_l?.midCourse?.panelBiochem?.['GGT'] || '0');
  if ((ggtPre > 55 || ggtMid > 55)) {
    if (!selectedIds.has('tudca') && !isContraindicated('tudca') && canAdd()) selectedIds.add('tudca') && (substanceReasons['tudca'] = substanceReasons['tudca'] || []).push({ mechInfo: 'Печень: ГГТ↑ → TUDCA 500 мг — ER-стресс + желчеотток', system: 'hepatic' });
    if (!selectedIds.has('milk_thistle') && !isContraindicated('milk_thistle') && canAdd()) selectedIds.add('milk_thistle') && (substanceReasons['milk_thistle'] = substanceReasons['milk_thistle'] || []).push({ mechInfo: 'Печень: ГГТ↑ → расторопша 600 мг', system: 'hepatic' });
  }
  // DHEA-S <200 → DHEA + pregnenolone
  const dheaPre = parseFloat(_l?.preCourse?.panelSex?.['DHEA_S'] || '0');
  const dheaMid = parseFloat(_l?.midCourse?.panelSex?.['DHEA_S'] || '0');
  if ((dheaPre > 0 && dheaPre < 200) || (dheaMid > 0 && dheaMid < 200)) {
    if (!selectedIds.has('dhea') && !isContraindicated('dhea') && catalogExists('dhea') && canAdd()) selectedIds.add('dhea') && (substanceReasons['dhea'] = substanceReasons['dhea'] || []).push({ mechInfo: 'Гормоны: DHEA-S↓ → DHEA 25 мг', system: 'endocrine' });
    if (!selectedIds.has('pregnenolone') && !isContraindicated('pregnenolone') && catalogExists('pregnenolone') && canAdd()) selectedIds.add('pregnenolone') && (substanceReasons['pregnenolone'] = substanceReasons['pregnenolone'] || []).push({ mechInfo: 'Гормоны: DHEA-S↓ → прегненолон 50 мг', system: 'endocrine' });
  }
  // PSA >4 → saw palmetto + zinc
  const psaPre = parseFloat(_l?.preCourse?.panelSex?.['PSA'] || '0');
  const psaMid = parseFloat(_l?.midCourse?.panelSex?.['PSA'] || '0');
  if ((psaPre > 4 || psaMid > 4)) {
    if (!selectedIds.has('saw_palmetto') && !isContraindicated('saw_palmetto') && canAdd()) selectedIds.add('saw_palmetto') && (substanceReasons['saw_palmetto'] = substanceReasons['saw_palmetto'] || []).push({ mechInfo: 'Простата: ПСА↑ → пальметто 640 мг', system: 'reproductive' });
  }
  // IGF-1 <150 → arginine + ornithine + zinc
  const igfPre = parseFloat(_l?.preCourse?.panelSex?.['IGF-1'] || '0');
  const igfMid = parseFloat(_l?.midCourse?.panelSex?.['IGF-1'] || '0');
  if ((igfPre > 0 && igfPre < 150) || (igfMid > 0 && igfMid < 150)) {
    if (!selectedIds.has('zinc') && !isContraindicated('zinc') && canAdd()) selectedIds.add('zinc') && (substanceReasons['zinc'] = substanceReasons['zinc'] || []).push({ mechInfo: 'GH-ось: IGF-1↓ → цинк 30 мг', system: 'endocrine' });
  }
  // Lp(a) >75 → omega3 + niacin
  const lpaPre = parseFloat(_l?.preCourse?.panelLipid?.['Lp(a)'] || '0');
  const lpaMid = parseFloat(_l?.midCourse?.panelLipid?.['Lp(a)'] || '0');
  if ((lpaPre > 75 || lpaMid > 75)) {
    if (!selectedIds.has('vitamin_b3') && !isContraindicated('vitamin_b3') && catalogExists('vitamin_b3') && canAdd()) selectedIds.add('vitamin_b3') && (substanceReasons['vitamin_b3'] = substanceReasons['vitamin_b3'] || []).push({ mechInfo: 'Липиды: ЛП(а)↑ → ниацин B3 500 мг', system: 'cardio' });
  }
  // Free T <12 → boron + magnesium + zinc
  const freeTPre = parseFloat(_l?.preCourse?.panelSex?.['Free T'] || '0');
  const freeTMid = parseFloat(_l?.midCourse?.panelSex?.['Free T'] || '0');
  if ((freeTPre > 0 && freeTPre < 12) || (freeTMid > 0 && freeTMid < 12)) {
    if (!selectedIds.has('boron') && !isContraindicated('boron') && canAdd()) selectedIds.add('boron') && (substanceReasons['boron'] = substanceReasons['boron'] || []).push({ mechInfo: 'Гормоны: freeT↓ → бор 6 мг', system: 'endocrine' });
  }
  // Lymphocytes <1.0 → D3 + zinc + astragalus
  const lymphPre = parseFloat(_l?.preCourse?.panelHematology?.['Lymphocytes'] || '0');
  const lymphMid = parseFloat(_l?.midCourse?.panelHematology?.['Lymphocytes'] || '0');
  if ((lymphPre > 0 && lymphPre < 1.0) || (lymphMid > 0 && lymphMid < 1.0)) {
    if (!selectedIds.has('astragalus') && !isContraindicated('astragalus') && catalogExists('astragalus') && canAdd()) selectedIds.add('astragalus') && (substanceReasons['astragalus'] = substanceReasons['astragalus'] || []).push({ mechInfo: 'Иммунитет: лимфоциты↓ → астрагал 500 мг', system: 'hematologic' });
  }

  // ─── Build PlanSubstance list ───
  const substances: PlanSubstance[] = [];
  for (const id of selectedIds) {
    const dose = getSubDose(normalizeId(id));
    const entry = getCatalogEntry(id);
    const reasons = substanceReasons[id] || [];
    const mechReason = reasons.map(r => r.mechInfo).join('; ') || 'Общая поддержка';
    const systems = reasons.map(r => r.system).filter((v, i, a) => a.indexOf(v) === i);

    // Adjust doses based on level AND week scaling
    let doseMultiplier = 1;
    if (level === 'mid') doseMultiplier = 1.2;
    else if (level === 'max') doseMultiplier = 1.5;
    else if (level === 'boost') doseMultiplier = 1.8;
    doseMultiplier *= weekScale;
    // Pharma drugs: slower ramp-up
    const pharmaIds = ['telmisartan', 'nebivolol', 'anastrozole', 'cabergoline'];
    const pharmaWeekScale = cw <= 2 ? 0.5 : cw <= 4 ? 0.75 : 1.0;
    if (pharmaIds.includes(id)) doseMultiplier = pharmaWeekScale;

    // B3: mg/kg dosing for weight-dependent substances
    const bodyWeight = state.profile?.weight || 80;
    const perKgSubs: Record<string, number> = {
      nac: 15, tudca: 10, coq10: 2, omega3: 30, magnesium: 5,
      alpha_lipoic: 5, taurine: 20, vitamin_c: 10, milk_thistle: 5,
    };
    let adjustedDose: number;
    if (perKgSubs[id] && bodyWeight > 60) {
      const kgDose = Math.round(bodyWeight * perKgSubs[id] * doseMultiplier);
      // Blend with default: 70% mg/kg, 30% fixed
      adjustedDose = Math.round(kgDose * 0.7 + dose.mg * doseMultiplier * 0.3);
    } else {
      adjustedDose = Math.round(dose.mg * doseMultiplier);
    }
    let adjustedTiming = dose.timing;
    if (id === 'bcp157' && hasJointPain) {
      const isSymptomatic = (state.oda?.jointPain || 'none') === 'moderate' || (state.oda?.jointPain || 'none') === 'severe';
      adjustedDose = isSymptomatic ? 500 : 350;
      adjustedTiming = isSymptomatic ? 'ежедневно' : '2-3x/нед';
    }
    if (id === 'tb500' && hasJointPain) {
      const isSymptomatic = (state.oda?.jointPain || 'none') === 'moderate' || (state.oda?.jointPain || 'none') === 'severe';
      adjustedDose = isSymptomatic ? 10 : 5;
      adjustedTiming = isSymptomatic ? 'ежедневно' : '2-3x/нед';
    }

    const displayDose = adjustedDose >= 5000
      ? `${(adjustedDose / 1000).toFixed(1)} г`
      : adjustedDose >= 1000
        ? `${(adjustedDose / 1000).toFixed(1)} г (${adjustedDose} мг)`
        : `${Math.round(adjustedDose)} мг`;

    substances.push({
      id,
      name: dose.name,
      doseMg: Math.round(adjustedDose),
      doseDisplay: displayDose,
      timing: adjustedTiming,
      category: entry?.category || [],
      tier: entry?.tier || 'standard',
      targetSystems: systems.length > 0 ? systems : (entry?.systems || []),
      comment: mechReason,
      mechanismReason: mechReason,
      fromJoint: false,
      fromBoost: false,
    });
  }

  // ─── Build schedule ───
  const schedule = buildSchedule(substances);

  // ─── Build dosages record ───
  const dosages: Record<string, { mg: number; timing: string }> = {};
  for (const s of substances) {
    dosages[s.id] = { mg: s.doseMg, timing: s.timing };
  }

  // ─── Build systems map — multiplicative risk reduction (no baseline) ───
  const systemsResult: Record<string, { raw: number; net: number; mechanisms: string[] }> = {};
  for (const [sys, score] of Object.entries(scores)) {
    const mechs = systemMechanisms[sys] || [];
    // Count unique substances covering this system's mechanisms
    const coveringSubs = new Set<string>();
    for (const mechKey of mechs) {
      for (const s of substances) {
        if (getBridgeKeys(s.id).includes(mechKey)) coveringSubs.add(s.id);
      }
    }
    // Each substance on a system: ×0.85 multiplicative
    const factor = Math.pow(0.85, coveringSubs.size);
    systemsResult[sys] = {
      raw: score,
      net: Math.max(0, Math.round(score * factor)),
      mechanisms: mechs,
    };
  }

  // ─── Risk dynamics with substance-aware coverage ───
  const riskDynamics = Object.entries(scores).map(([sys, raw]) => {
    const mechs = systemMechanisms[sys] || [];
    const coveringSubs = new Set<string>();
    for (const mechKey of mechs) {
      for (const s of substances) {
        if (getBridgeKeys(s.id).includes(mechKey)) coveringSubs.add(s.id);
      }
    }
    const factor = Math.pow(0.85, coveringSubs.size);
    return { system: sys, before: raw, after: Math.max(0, Math.round(raw * factor)), mechanisms: allMechanisms.filter(m => SYS_TO_MECH_KEYS[sys]?.includes(m.mechKey)) };
  });

  // ─── Coverage percent ───
  const coveredSystems = Object.values(systemsResult).filter(s => s.mechanisms.length > 0).length;
  const coveragePercent = Math.round((coveredSystems / 8) * 100);

  // ─── Synergy comment ───
  const synergyComment = buildSynergyComment(substances);

  // ─── Monitoring ───
  const monitoring = buildMonitoring(substances, scores);

  // ─── Special instructions ───
  const specialInstructions = buildSpecialInstructions(substances);

  const systemScores = Object.values(scores);
  // Use same weighted formula as overallRiskBefore
  const brMax = systemScores.length > 0 ? Math.max(...systemScores) : 0;
  const brAvg = systemScores.length > 0 ? Math.round(systemScores.reduce((a: number, b: number) => a + b, 0) / systemScores.length) : 0;
  const overallRaw = Math.round(brMax * 0.6 + brAvg * 0.4);

  let weightedProtectionSum = 0;
  let activeSystems = 0;
  for (const [sys, score] of Object.entries(scores)) {
    if (score > 0) {
      const sysResult = systemsResult[sys];
      const ep = Math.max(0, Math.min(0.85, score > 0 ? (score - (sysResult?.net ?? score)) / score : 0));
      weightedProtectionSum += ep;
      activeSystems++;
    }
  }
  const avgProtection = activeSystems > 0 ? weightedProtectionSum / activeSystems : 0.3;
  const overallAfter = Math.round(overallRaw * (1 - Math.min(1, avgProtection)));

  // ─── Coverage gaps (systems where support reduced risk by <40%) ───
  const coverageGaps: PlanResult['coverageGaps'] = [];
  for (const [sys, score] of Object.entries(scores)) {
    if (score > 0) {
      const sysLabel = SYS_LABELS[sys] || sys;
      const sysResult = systemsResult[sys];
      const net = sysResult?.net ?? score;
      const reductionPercent = Math.round(((score - net) / Math.max(1, score)) * 100);
      // Show as gap when coverage is insufficient (reduction < 40%)
      if (reductionPercent < 40 && net > 20) {
        coverageGaps.push({ system: sys, label: sysLabel, raw: score, net, gapPercent: reductionPercent });
      }
    }
  }

  // ─── Stack recommendations ───
  const stackRecommendations = recommendStacks(scores, selectedIds, level);

  // ─── Conflict detection ───
  const conflicts: PlanResult['conflicts'] = [];
  const subList = Array.from(selectedIds);
  for (let i = 0; i < subList.length; i++) {
    for (let j = i + 1; j < subList.length; j++) {
      const a = subList[i]; const b = subList[j];
      const entryA = getCatalogEntry(a); const entryB = getCatalogEntry(b);
      if (!entryA?.conflicts || !entryB) continue;
      for (const c of entryA.conflicts) {
        if (c.with === b || normalizeId(c.with) === normalizeId(b) || c.with.toUpperCase() === b.toUpperCase()) {
          conflicts.push({
            a, b,
            aName: entryA.nameRu || entryA.name || a,
            bName: entryB.nameRu || entryB.name || b,
            effect: c.effect,
            severity: c.severity,
          });
        }
      }
    }
  }

  return {
    substances,
    dosages,
    schedule,
    systems: systemsResult,
    mechanisms: allMechanisms,
    coveragePercent,
    synergyComment,
    monitoring,
    specialInstructions,
    riskDynamics,
    overallRiskBefore: overallRaw,
    overallRiskAfter: overallAfter,
    labFindings,
    uncoveredMechanisms,
    coverageGaps,
    weekScale: weekScale,
    stackRecommendations,
    conflicts,
    riskBreakdown,
  };
}

// ─── Apply joint/boost substances on top of existing plan ───
export function applyJointToPlan(plan: PlanResult, userCI?: Set<string>): PlanResult {
  const existing = new Set(plan.substances.map(s => s.id));
  const added: PlanSubstance[] = [];
  const seen = new Set<string>();

  function isCId(id: string): boolean {
    if (!userCI || userCI.size === 0) return false;
    const entry = getCatalogEntry(id);
    if (!entry?.contraindications) return false;
    for (const contra of entry.contraindications) {
      const low = contra.toLowerCase();
      for (const term of userCI) {
        if (low.includes(term)) return true;
      }
    }
    return false;
  }

  // Find substances targeting musculoskeletal mechanisms
  const muscKeys = Object.keys(BRIDGE_MECH_TO_CATALOG).filter(k => k.startsWith('musculoskeletal_'));
  for (const bk of muscKeys) {
    const { curated, autoIndexed } = findBestSubstancesForBridgeMech(bk);
    for (const rawId of [...curated, ...autoIndexed]) {
      const id = normalizeId(rawId);
      if (existing.has(id) || seen.has(id)) continue;
      seen.add(id);
      const entry = getCatalogEntry(id);
      if (!entry || isCId(id)) continue;
      // Only add joint-relevant substances (collagen, glucosamine, chondroitin, msm, vitamin_c, etc.)
      if (!id.includes('collagen') && !id.includes('glucosamine') && !id.includes('chondroitin')
        && !id.includes('msm') && !id.includes('hyaluronic') && !id.includes('boswellia')
        && !id.includes('bromelain') && !id.includes('bcp') && !id.includes('tb500')
        && !id.includes('vitamin_c') && !id.includes('vitamin_d3') && !id.includes('magnesium')
        && !id.includes('calcium') && !id.includes('curcumin') && !id.includes('omega3')) continue;
      added.push({
        id, name: entry?.nameRu || entry?.name || id,
        doseMg: entry?.dosage?.mg || 500,
        doseDisplay: (entry?.dosage?.mg || 500) >= 1000 ? `${((entry?.dosage?.mg || 500) / 1000).toFixed(1)} г` : `${entry?.dosage?.mg || 500} мг`,
        timing: entry?.dosage?.timing || 'с едой',
        category: entry?.category || [], tier: 'standard',
        targetSystems: ['musculoskeletal'],
        comment: 'Суставы/связки: поддержка опорно-двигательной системы',
        mechanismReason: 'Суставы/связки', fromJoint: true, fromBoost: false,
      });
    }
  }

  return { ...plan, substances: [...plan.substances, ...added] };
}

export function applyBoostToPlan(plan: PlanResult, userCI?: Set<string>): PlanResult {
  const existing = new Set(plan.substances.map(s => s.id));
  const added: PlanSubstance[] = [];
  const candidates: Array<{ id: string; score: number }> = [];

  function isCId(id: string): boolean {
    if (!userCI || userCI.size === 0) return false;
    const entry = getCatalogEntry(id);
    if (!entry?.contraindications) return false;
    for (const contra of entry.contraindications) {
      const low = contra.toLowerCase();
      for (const term of userCI) {
        if (low.includes(term)) return true;
      }
    }
    return false;
  }

  // Scan ALL bridge mechanisms, find high-priority candidates NOT in plan
  for (const [bridgeKey] of Object.entries(BRIDGE_MECH_TO_CATALOG)) {
    const { curated, autoIndexed } = findBestSubstancesForBridgeMech(bridgeKey);
    for (const rawId of [...curated, ...autoIndexed]) {
      const id = normalizeId(rawId);
      if (existing.has(id) || added.some(a => a.id === id) || isCId(id)) continue;
      const entry = getCatalogEntry(id);
      if (!entry) continue;
      // Score: synergy weight + best form bonus
      let synScore = 0;
      for (const sub of plan.substances) {
        if (entry.synergies?.some((syn: any) => syn.with.toLowerCase() === sub.id)) synScore += 15;
      }
      candidates.push({ id, score: synScore + (entry.bestForCourse ? 5 : 0) });
    }
  }

  // Deduplicate by keeping highest score per candidate
  const best = new Map<string, number>();
  for (const c of candidates) {
    best.set(c.id, Math.max(best.get(c.id) || 0, c.score));
  }

  // Pick top 6 by (synergy, tier) — NOT hardcoded
  const picked = [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  for (const [id] of picked) {
    const entry = getCatalogEntry(id);
    const dose = { mg: entry?.dosage?.mg || 500, timing: entry?.dosage?.timing || 'с едой' };
    added.push({
      id, name: entry?.nameRu || entry?.name || id, doseMg: dose.mg,
      doseDisplay: dose.mg >= 1000 ? `${(dose.mg / 1000).toFixed(1)} г (${dose.mg} мг)` : `${dose.mg} мг`,
      timing: dose.timing, category: entry?.category || [], tier: 'advanced',
      targetSystems: ['general'], comment: 'Усиление: закрытие пробелов покрытия по механизмам',
      mechanismReason: 'Усиление', fromJoint: false, fromBoost: true,
    });
  }

  return { ...plan, substances: [...plan.substances, ...added] };
}

function buildSchedule(substances: PlanSubstance[]): Array<{ timeBlock: string; substances: Array<{ id: string; name: string; dose: string; instructions: string }> }> {
  const morning = substances.filter(s =>
    ['утро', 'с едой', 'утро, натощак', 'утро/вечер', '2x/нед', 'ежедневно', '2-3x/нед'].some(t => s.timing.includes(t))
    && !s.timing.includes('вечер') && !s.timing.includes('на ночь')
  );
  const afternoon = substances.filter(s =>
    s.timing.includes('с едой') && !s.timing.includes('утро') && !s.timing.includes('вечер') && !s.timing.includes('на ночь')
  );
  const evening = substances.filter(s =>
    s.timing.includes('вечер') || s.timing.includes('на ночь') || s.timing.includes('перед сном')
  );
  const remaining = substances.filter(s => !morning.includes(s) && !afternoon.includes(s) && !evening.includes(s));

  const blocks: Array<{ timeBlock: string; substances: Array<{ id: string; name: string; dose: string; instructions: string }> }> = [];

  if (morning.length > 0) {
    blocks.push({
      timeBlock: 'Утро (07:00–09:00)',
      substances: morning.map(s => ({ id: s.id, name: s.name, dose: s.doseDisplay, instructions: s.timing.includes('натощак') ? 'Натощак, за 30 мин до еды' : 'С завтраком' })),
    });
  }
  if (afternoon.length > 0) {
    blocks.push({
      timeBlock: 'День (13:00–15:00)',
      substances: afternoon.map(s => ({ id: s.id, name: s.name, dose: s.doseDisplay, instructions: 'С обедом' })),
    });
  }
  if (evening.length > 0) {
    blocks.push({
      timeBlock: 'Вечер (19:00–22:00)',
      substances: evening.map(s => ({ id: s.id, name: s.name, dose: s.doseDisplay, instructions: s.timing.includes('на ночь') ? 'За 1 час до сна' : 'С ужином' })),
    });
  }
  if (remaining.length > 0) {
    blocks.push({
      timeBlock: 'По расписанию',
      substances: remaining.map(s => ({ id: s.id, name: s.name, dose: s.doseDisplay, instructions: s.timing })),
    });
  }

  return blocks;
}

function buildSynergyComment(substances: PlanSubstance[]): string {
  const ids = substances.map(s => s.id);
  const sysMap: Record<string, string[]> = {};
  for (const s of substances) {
    for (const sys of s.targetSystems) {
      if (!sysMap[sys]) sysMap[sys] = [];
      sysMap[sys].push(s.name);
    }
  }

  const lines: string[] = [];
  lines.push('Принцип синергии стека:');

  // NAC + TUDCA synergy
  if (ids.includes('nac') && ids.includes('tudca')) {
    lines.push('• NAC + TUDCA: двойная гепатопротекция — NAC восстанавливает глутатион (антиоксидантная защита), TUDCA снижает ER-стресс и улучшает желчеотток. Вместе обеспечивают полный охват путей токсического поражения печени.');
  }
  if (ids.includes('nac') && ids.includes('milk_thistle')) {
    lines.push('• NAC + Силимарин: NAC даёт субстрат для глутатиона, силимарин стабилизирует мембраны гепатоцитов — комплементарная защита печени.');
  }

  // Cardio synergies
  if (ids.includes('telmisartan') && ids.includes('nebivolol')) {
    lines.push('• Телмисартан + Небиволол: ARB + β1-блокатор с NO-модуляцией. Контроль АД (тельмисартан) + контроль ЧСС (небиволол) + вазодилатация (NO-эффект небиволола) — полная кардиопротекция.');
  }
  if (ids.includes('coq10') && ids.includes('omega3')) {
    lines.push('• CoQ10 + Омега-3: митохондриальная защита миокарда (CoQ10) + противовоспалительная и липид-снижающая (Омега-3) — кардиопротекция по двум независимым путям.');
  }

  // Vitamin D3 + K2 + Magnesium
  if (ids.includes('vitamin_d3') && ids.includes('vitamin_k2') && ids.includes('magnesium')) {
    lines.push('• D3 + K2 + Mg: кальциевый треугольник — D3 повышает абсорбцию Ca, K2 направляет Ca в кости (активация остеокальцина), Mg является кофактором метаболизма D3. Без Mg и K2 приём D3 может привести к кальцификации сосудов.');
  }

  // Methylation
  if (ids.includes('folate') && ids.includes('vitamin_b12') && ids.includes('vitamin_b6')) {
    lines.push('• 5-MTHF + B12 + B6: полный цикл метилирования. Фолат (5-MTHF) — активная форма, B12 — кофактор метионинсинтазы, B6 (P5P) — кофактор транссульфурации. Снижение гомоцистеина, синтез нейромедиаторов.');
  }

  // Joint synergies
  if (ids.includes('collagen') && ids.includes('vitamin_c')) {
    lines.push('• Коллаген + Витамин C: витамин C — необходимый кофактор для гидроксилирования пролина/лизина при синтезе коллагена. Без вит.C коллаген не формирует правильную тройную спираль.');
  }
  if (ids.includes('bcp157') && ids.includes('tb500')) {
    lines.push('• BPC-157 + TB-500: синергия пептидов для регенерации. BPC-157 — ангиогенез, заживление сухожилий; TB-500 — миграция клеток, противовоспалительное. Вместе ускоряют восстановление соединительной ткани.');
  }

  // NAC + Glycine for glutathione
  if (ids.includes('nac') && ids.includes('glycine')) {
    lines.push('• NAC + Глицин: два лимитирующих субстрата для синтеза глутатиона (γ-глутамилцистеин + глицин). Совместный приём повышает внутриклеточный GSH эффективнее, чем NAC отдельно.');
  }

  // Antioxidant network
  if (ids.includes('alpha_lipoic') && ids.includes('vitamin_c') && ids.includes('vitamin_e')) {
    lines.push('• АЛЬК + Вит.C + Вит.E: антиоксидантная сеть — АЛЬК регенерирует окисленные формы витаминов C и E, витамин C восстанавливает витамин E. Замкнутый цикл регенерации.');
  }

  // Coverage summary
  for (const [sys, subs] of Object.entries(sysMap)) {
    const sysLabel = SYS_LABELS[sys] || sys;
    if (sys !== 'general') {
      lines.push(`• ${sysLabel}: ${subs.slice(0, 4).join(', ')}${subs.length > 4 ? ` и ещё ${subs.length - 4}` : ''}`);
    }
  }

  return lines.join('\n');
}

function buildMonitoring(substances: PlanSubstance[], scores: Record<string, number>): string[] {
  const items: string[] = [];
  const collected = new Set<string>();

  // Collect monitoring from catalog entries
  for (const s of substances) {
    const entry = getCatalogEntry(s.id);
    if (entry?.monitoring) {
      for (const m of entry.monitoring) {
        const text = `• ${m.what} — ${m.when}${m.targetRange ? ` (цель: ${m.targetRange})` : ''}`;
        if (!collected.has(text)) {
          collected.add(text);
          items.push(text);
        }
      }
    }
  }

  // Add system-specific monitoring based on risks
  if (scores.hepatic > 15) {
    items.push('• АЛТ, АСТ, ГГТ, ЩФ, билирубин общий/прямой — каждые 4 нед (печёночный профиль)');
    items.push('• УЗИ печени — 1 раз в 3 мес при высоком риске');
  }
  if (scores.cardio > 15) {
    items.push('• АД и ЧСС — ежедневно утром (контроль гипертензии)');
    items.push('• Липидограмма (ЛПНП, ЛПВП, ТГ) — каждые 8 нед');
    items.push('• Гематокрит — каждые 4 нед (риск полицитемии)');
  }
  if (scores.renal > 10) {
    items.push('• Креатинин, мочевина, СКФ — каждые 8 нед (почечный профиль)');
    items.push('• Общий анализ мочи — каждые 8 нед');
  }
  if (scores.neuro > 10) {
    items.push('• Оценка сна (дневник), настроения — еженедельно');
  }
  if (scores.endocrine > 10) {
    items.push('• Гормональная панель (ТТ, ЛГ, ФСГ, Е2, пролактин, прогестерон) — каждые 8 нед');
  }

  // Essential for any stack
  items.push('• Общий анализ крови + СОЭ — каждые 8 нед');
  items.push('• Витамин D (25-OH) — каждые 12 нед');

  return items;
}

function buildSpecialInstructions(substances: PlanSubstance[]): string[] {
  const items: string[] = [];
  const ids = new Set(substances.map(s => s.id));

  if (ids.has('nac')) items.push('• NAC: принимать натощак, запивать большим количеством воды. Не сочетать с антибиотиками (интервал ≥2 ч).');
  if (ids.has('tudca')) items.push('• TUDCA: может послабить стул первые 2 недели — начать с 250 мг/сут и титровать. Противопоказан при полной обструкции желчевыводящих путей.');
  if (ids.has('telmisartan')) items.push('• Телмисартан: контроль АД! При САД <100 мм рт.ст. снизить дозу. Не сочетать с НПВС (снижение эффекта + нефротоксичность).');
  if (ids.has('nebivolol')) items.push('• Небиволол: контроль ЧСС! При ЧСС <55 уд/мин снизить дозу. Не отменять резко.');
  if (ids.has('vitamin_d3') && ids.has('vitamin_k2')) items.push('• D3 + K2: всегда принимать вместе для предотвращения кальцификации сосудов.');
  if (ids.has('zinc') && ids.has('copper')) items.push('• Цинк + Медь: принимать в разное время суток (цинк вечером, медь утром) — цинк снижает абсорбцию меди.');
  if (ids.has('iron') && ids.has('zinc')) items.push('• Железо + Цинк: принимать раздельно (интервал ≥4 ч) — конкуренция за абсорбцию.');
  if (ids.has('bcp157') || ids.has('tb500')) items.push('• Пептиды (BPC-157/TB-500): хранить в холодильнике (2-8°C). Разводить бактериостатической водой. Не смешивать в одном шприце.');
  if (ids.has('omega3')) items.push('• Омега-3: предпочтительно форма с высоким содержанием EPA+DHA (>60%). Хранить в защищённом от света месте.');
  if (ids.has('coq10')) items.push('• CoQ10: форма убихинол (восстановленная) лучше усваивается. Принимать с жирной пищей.');
  if (ids.has('berberine')) items.push('• Берберин: может вызывать гипогликемию при приёме с метформином. Контролировать глюкозу.');
  if (ids.has('ashwagandha')) items.push('• Ашваганда: не сочетать с седативными и тиреоидными препаратами. При передозировке — апатия.');

  return items;
}

// ─── Export utility ───
export { normalizeId, getCatalogEntry, catalogExists, getSubDose, calcAllRisks, SYS_LABELS, MECH_LABELS };
