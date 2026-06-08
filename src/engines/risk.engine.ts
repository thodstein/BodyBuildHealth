// ============================================================
// Health Engine v9 — Risk Calculation Engine
// Integrates 105 specific mechanisms from SYSTEM_MECHANISMS
// with drug matching, lab marker adjustment, and PD factors
// ============================================================

import { GENETIC_MULTIPLIERS, DRUG_THRESHOLDS, RISK_SYSTEMS, BASE_RISK, MRR_FACTORS, HGI_FACTORS, RIR_FACTORS, SUPPORT_BASE_COVERAGE } from '../core/constants';
import { RiskInput, RiskResult, MechanismCell } from '../core/types';
import { PHARMA_DB } from '../core/pharma-database';
import { PD_SYSTEM_MAP, DRUG_MECH_WEIGHTS, getDrugMechWeight } from '../core/risk-shared';
import { SYSTEM_MECHANISMS } from '../core/system-mechanisms';

// Drug name matching: maps PHARMA_DB IDs to Russian display names for matching with SYSTEM_MECHANISMS drugs[]
const DRUG_NAME_MAP: Record<string, string[]> = {
  test_prop: ['Тестостерон пропионат', 'Тестостерон'],
  test_enan: ['Тестостерон энантат', 'Тестостерон'],
  test_cyp: ['Тестостерон ципионат', 'Тестостерон'],
  test_undec: ['Тестостерон ундеканоат', 'Тестостерон'],
  tren_acet: ['Тренболон ацетат', 'Тренболон'],
  tren_enan: ['Тренболон энантат', 'Тренболон'],
  tren_hex: ['Тренболон гексагидробензилкарбонат', 'Тренболон'],
  npp: ['Нандролон фенилпропионат', 'Нандролон'],
  deca: ['Нандролон деканоат', 'Нандролон'],
  bold_undec: ['Болденон ундеканоат', 'Болденон'],
  prim_enan: ['Метенолон энантат', 'Метенолон'],
  methand: ['Метандиенон', 'Метандиенон'],
  oxan: ['Оксандролон', 'Оксандролон'],
  stan: ['Станозолол', 'Станозолол'],
  trena: ['Тренболон ацетат', 'Тренболон'],
  halo: ['Флюоксиместерон', 'Халотестин', 'Галотестин'],
  anadrol: ['Оксиметолон', 'Анадрол'],
  superdrol: ['Супердрол', 'Метилдростанолон'],
  drostanolone_prop: ['Дростанолон пропионат', 'Мастерон'],
  drostanolone_enan: ['Дростанолон энантат', 'Мастерон'],
  mesterolone: ['Местеролон', 'Провирон'],
  ostarine: ['Остарин', 'MK-2866'],
  lgd: ['Лигандрол', 'LGD-4033'],
  rad140: ['RAD-140', 'Тестолон'],
  s23: ['S-23'],
  clomi: ['Кломид', 'Кломифен'],
  tamox: ['Тамоксифен', 'Нолвадекс'],
  anastro: ['Анастрозол', 'Аримидекс'],
  letrozole: ['Летрозол', 'Фемара'],
  caberg: ['Каберголин', 'Достинекс'],
  bromocriptine: ['Бромокриптин'],
  hcg: ['ХГЧ', 'Гонадотропин'],
  mk677: ['Ибутаморен', 'MK-677'],
  ghrp6: ['GHRP-6'],
  ghrp2: ['GHRP-2'],
  ipamorelin: ['Ипаморелин'],
  cjc1295: ['CJC-1295'],
  igf1_lr3: ['ИФР-1', 'IGF-1'],
  igf1_des: ['ИФР-1 Дез'],
  mgf: ['MGF'],
  ins_short: ['Инсулин короткий', 'Инсулин'],
  ins_long: ['Инсулин длинный', 'Инсулин'],
  ins_aspart: ['Инсулин аспарт', 'Инсулин'],
  ins_detemir: ['Инсулин детемир', 'Инсулин'],
  hgh_frag: ['Фрагмент ГР', 'HGH фрагмент'],
  sermorelin: ['Серморелин'],
  peg_mgf: ['PEG-MGF'],
  semax: ['Семакс'],
  selank: ['Селанк'],
  epitalon: ['Эпиталон'],
  gonadorelin: ['Гонадорелин'],
  bpc157: ['BPC-157'],
  tb500: ['TB-500', 'Тимозин β-4'],
  thymosin_a1: ['Тимозин α-1'],
  melatonin: ['Мелатонин'],
  vitamin_d3: ['Витамин D3', 'Витамин D'],
  vitamin_k2: ['Витамин K2', 'Витамин К2'],
  omega3: ['Омега-3'],
  nac: ['NAC', 'N-ацетилцистеин'],
  tudca: ['TUDCA', 'Урсодезоксихолевая кислота'],
  magnesium: ['Магний'],
  zinc_sup: ['Цинк'],
  selenium_sup: ['Селен'],
  coq10: ['Коэнзим Q10', 'CoQ10'],
  berberine: ['Берберин'],
  aspirin: ['Аспирин', 'Ацетилсалициловая кислота'],
  milk_thistle: ['Расторопша', 'Силимарин'],
  curcumin_sup: ['Куркумин'],
  alpha_lipoic: ['Альфа-липоевая кислота', 'АЛК'],
  ashwagandha: ['Ашваганда'],
  tongkat_ali: ['Тонгкат али'],
  fadogia: ['Фадогия'],
  probiotics_sup: ['Пробиотики'],
  taurine_sup: ['Таурин'],
  ghk_cu: ['GHK-Cu'],
  dsip: ['DSIP'],
  melanotan2: ['Меланотан 2'],
  aod9604: ['AOD-9604'],
  mots_c: ['MOTS-c'],
  ss31: ['SS-31'],
  foxo4_dri: ['FOXO4-DRI'],
  telmi: ['Телмисартан'],
  nebivolol: ['Небиволол'],
};

// Map lab markers to UCUM_MAP keys for matching with SYSTEM_MECHANISMS markers[]
const MARKER_TO_LAB: Record<string, string[]> = {
  'ЛПНП': ['LDL'],
  'ЛПВП': ['HDL'],
  'Триглицериды': ['TG'],
  'Апо-В': ['ApoB'],
  'АД': ['BP'],
  'Натрий': ['NA'],
  'Калий': ['K'],
  'Мочевина': ['UREA'],
  'ЭХО-КГ ЛЖ': ['Echocardiography'],
  'ИММЛЖ': ['LV_Mass'],
  'Тропонин': ['Troponin'],
  'BNP': ['BNP'],
  'Гематокрит': ['HCT'],
  'D-димер': ['D_dimer'],
  'Фибриноген': ['Fibrinogen'],
  'МНО': ['INR'],
  'СРБ': ['CRP'],
  'Гомоцистеин': ['Homocysteine'],
  'ЩФ': ['ALP'],
  'ГГТ': ['GGT'],
  'Билирубин прямой': ['DBIL'],
  'АЛТ': ['ALT'],
  'АСТ': ['AST'],
  'Креатинин': ['CREATININE'],
  'Глюкоза': ['GLU'],
  'Инсулин': ['INS'],
  'HOMA-IR': ['HOMA'],
  'Гликированный Hb': ['HbA1c'],
  'ТТГ': ['TSH'],
  'Т3 свободный': ['FT3'],
  'Т4 свободный': ['FT4'],
  'Пролактин': ['PRL'],
  'Эстрадиол': ['E2'],
  'Тестостерон общий': ['TT'],
  'ЛГ': ['LH'],
  'ФСГ': ['FSH'],
  'Корттизол': ['CORTISOL'],
  'Ферритин': ['FERRITIN'],
  'Витамин D': ['VITD'],
  'ГСПГ': ['SHBG'],
  'Гемоглобин': ['HGB'],
  'Тромбоциты': ['PLT'],
  'Лейкоциты': ['WBC'],
  'Альбумин': ['ALB'],
  'Общий белок': ['TP'],
  'Мочевая к-та': ['UA'],
  'Кальций': ['CA'],
  'Фосфор': ['P'],
  'Магний': ['MG'],
  'ЭКГ (QTc)': ['ECG_QTc'],
  'ЧСС': ['HeartRate'],
  'Эндотелин-1': ['Endothelin1'],
  'NO': ['NO'],
  'ПСА': ['PSA'],
  'Ингибин Б': ['INHB'],
  'АМГ': ['AMH'],
  'ДГЭА-С': ['DHEA_S'],
  'ЛДГ': ['LDH'],
  'Гаптоглобин': ['Haptoglobin'],
  'АЧТВ': ['aPTT'],
  'Микроальбумин': ['Microalbumin'],
};

function geom(arr: number[]) {
   if (!arr.length) return 0;
   const l = arr.reduce((a, v) => a + Math.log(Math.max(0.0001, v)), 0);
   return Math.exp(l / arr.length) * 100;
}

function calculateMrrAdjustment(value: number, optimalMin: number, optimalMax: number): number {
   if (value >= optimalMin && value <= optimalMax) return 1.0;
   let deviation = 0;
   if (value < optimalMin) deviation = (optimalMin - value) / optimalMin;
   else if (value > optimalMax) deviation = (value - optimalMax) / optimalMax;
   return 1 + (deviation * 2);
}

function calculateHgiAdjustment(hgiMarkers: Record<string, number>): number {
   const vals = Object.values(hgiMarkers);
   if (!vals.length) return 1.0;
   const hgiScore = vals.reduce((sum, val) => sum + val, 0) / vals.length;
   return Math.max(0.5, Math.min(1.5, hgiScore));
}

function calculateRirAdjustment(interventionResponse: number): number {
   return 0.5 + (interventionResponse * 0.5);
}

// Check if an active drug matches a mechanism's drug list
function doesDrugMatchMechanism(drugId: string, mechanismDrugs: string[]): boolean {
   const drugNames = DRUG_NAME_MAP[drugId];
   if (!drugNames) return false;
   
   const pharmaEntry = (PHARMA_DB as any)[drugId];
   const drugClass = pharmaEntry?.class || '';
   
   for (const mechDrug of mechanismDrugs) {
     // Direct name match
     for (const name of drugNames) {
       if (mechDrug.toLowerCase().includes(name.toLowerCase()) || 
           name.toLowerCase().includes(mechDrug.toLowerCase())) {
         return true;
       }
     }
     // Class-based match for generic entries like "Все ААС", "17α-оральники"
     if (mechDrug.includes('ААС') || mechDrug.includes('AAC')) {
       const aasClasses = ['testosterone', 'trenbolone', 'nandrolone', 'boldenone', 'methenolone', 'dht_derivative', 'oral_aas'];
       if (aasClasses.some(c => drugClass.toLowerCase().includes(c))) return true;
       if (['test_enan','test_cyp','test_prop','test_undec','tren_acet','tren_enan','tren_hex','npp','deca','bold_undec','prim_enan','methand','oxan','stan','trena','halo','anadrol','superdrol','drostanolone_prop','drostanolone_enan','mesterolone'].includes(drugId)) return true;
     }
     if (mechDrug.includes('оральник') || mechDrug.toLowerCase().includes('oral')) {
       const oralClasses = ['oral_aas'];
       if (oralClasses.some(c => drugClass.toLowerCase().includes(c))) return true;
       if (['methand','oxan','stan','halo','anadrol','superdrol'].includes(drugId)) return true;
     }
   }
   return false;
}

// Check if lab markers match a mechanism's marker list
function doesMarkerMatchLabs(mechanismMarker: string, availableLabs: string[]): boolean {
   const labKeys = MARKER_TO_LAB[mechanismMarker];
   if (!labKeys) return false;
   return labKeys.some(lk => availableLabs.includes(lk));
}

// Calculate risk using specific mechanisms from SYSTEM_MECHANISMS
export function calculateRisks(i: RiskInput): RiskResult {
   const brk: Record<string, { raw: number; net: number }> = {};
   const mechBrk: Record<string, number> = {};
   const mechDetail: Record<string, MechanismCell> = {};
   const oR: number[] = [];
   const oN: number[] = [];

   // Get available lab markers
   const availableLabKeys = Object.keys(i.biomarkerValues || {});

   for (const s of RISK_SYSTEMS) {
      const rM: number[] = [];
      const nM: number[] = [];
      
      // Get specific mechanisms for this system
      const specificMechs = SYSTEM_MECHANISMS[s];
      
      if (specificMechs && specificMechs.length > 0) {
        // Use specific mechanisms
        for (const mech of specificMechs) {
          const id = mech.id;
          const G = GENETIC_MULTIPLIERS[s]?.[i.genetics?.[s] || 'Val/Val'] || 1.0;
          const N = Math.max(0.5, Math.min(1.5, i.nutritionFactor ?? 1));
          const T = Math.max(1, Math.min(1.5, i.trainingFactor ?? 1));

          const mrrAdjustment = calculateMrrAdjustment(
            i.biomarkerValues?.[s] ?? 1.0,
            MRR_FACTORS[s]?.optimalMin || 0.8,
            MRR_FACTORS[s]?.optimalMax || 1.2
          );
          const hgiAdjustment = calculateHgiAdjustment(i.hgiMarkers || {});
          const rirAdjustment = calculateRirAdjustment(i.interventionResponse ?? 0.5);

          const pdMapping = PD_SYSTEM_MAP[s];

          let drugContribution = 0;
          const contributors: string[] = [];
          let pdFactor = 0;
          
          // Match active drugs against mechanism's drug list
          for (const [drug, d] of Object.entries(i.activeDrugs || {})) {
            const cfg = DRUG_THRESHOLDS[drug.replace(/[-\s]/g, '_').toLowerCase()] || DRUG_THRESHOLDS[drug];
            const mechWeight = getDrugMechWeight(drug, mech.num);
            const doseRatio = cfg ? Math.min(2, Math.pow((d.dosePerWeek || 0) / cfg.dosePerWeek, 1.2)) : mechWeight > 0 ? Math.min(1.5, (d.dosePerWeek || 0) / 300) : 0;
            
            // Check if this drug matches the mechanism's drug list
            const matchesMechanismDrugs = doesDrugMatchMechanism(drug, mech.drugs);
            // Also check if PD system maps this drug to this system
            const pharmaEntry = (PHARMA_DB as any)[drug];
            let pdMatchesSystem = false;
            if (pharmaEntry?.pd && pdMapping) {
              const pdVal = pharmaEntry.pd[pdMapping.pdKey] ?? 0;
              pdMatchesSystem = Math.abs(pdVal) > 0.01;
            }
            
            // Drug contributes if it matches mechanism's drug list OR has relevant PD weight
            const effectiveWeight = matchesMechanismDrugs ? 1.0 : (mechWeight > 0 ? mechWeight : 0);
            if ((matchesMechanismDrugs || mechWeight > 0 || pdMatchesSystem) && (doseRatio > 0.01 || effectiveWeight > 0)) {
              const drugRisk = Math.max(0, BASE_RISK * (doseRatio || 0.01) * G * N * T * (1 + effectiveWeight * 2));
              drugContribution += drugRisk;
              contributors.push(drug);
              
              // PD contribution
              if (pharmaEntry?.pd && pdMapping) {
                const pdVal = pharmaEntry.pd[pdMapping.pdKey] ?? 0;
                pdFactor += Math.abs(pdVal) * pdMapping.weight * ((d.dosePerWeek || 0) / (pharmaEntry.ec50 || 300));
              }
            }
          }

          // Lab marker adjustment
          let labAdjustment = 1.0;
          for (const marker of mech.markers) {
            if (doesMarkerMatchLabs(marker, availableLabKeys)) {
              // Marker is available - reduce uncertainty
              labAdjustment *= 0.95; // 5% reduction per available marker
            } else {
              // Marker missing - slight increase for uncertainty
              labAdjustment *= 1.02;
            }
          }

          const raw = Math.max(5, Math.min(100, (drugContribution * 100 + pdFactor * 15) * labAdjustment * mrrAdjustment * hgiAdjustment));
          const cellCov = (i.supportCoverage || {})[id] || 0;
          const net = Math.max(0, raw * (1 - cellCov) * (2 - rirAdjustment));

          mechBrk[id] = raw;
          mechDetail[id] = {
            raw,
            net,
            coverage: cellCov,
            contributors: [...new Set(contributors)],
            mitigations: Object.entries(i.supportCoverage || {})
              .filter(([k, v]) => k.startsWith(s) && v > 0)
              .map(([k, v]) => ({ substance: k.split('_').pop() || k, reduction: v })),
          };

          rM.push(raw / 100);
          nM.push(net / 100);
        }
      } else {
        // Fallback to general 7 mechanisms for systems without specific mechanisms
        for (let m = 1; m <= 7; m++) {
          const id = `${s}_${m}`;
          const G = GENETIC_MULTIPLIERS[s]?.[i.genetics?.[s] || 'Val/Val'] || 1.0;
          const N = Math.max(0.5, Math.min(1.5, i.nutritionFactor ?? 1));
          const T = Math.max(1, Math.min(1.5, i.trainingFactor ?? 1));

          const mrrAdjustment = calculateMrrAdjustment(
            i.biomarkerValues?.[s] ?? 1.0,
            MRR_FACTORS[s]?.optimalMin || 0.8,
            MRR_FACTORS[s]?.optimalMax || 1.2
          );
          const hgiAdjustment = calculateHgiAdjustment(i.hgiMarkers || {});
          const rirAdjustment = calculateRirAdjustment(i.interventionResponse ?? 0.5);

          const pdMapping = PD_SYSTEM_MAP[s];

          let prod = 1;
          let pdFactor = 0;
          const contributors: string[] = [];
          for (const [drug, d] of Object.entries(i.activeDrugs || {})) {
            const cfg = DRUG_THRESHOLDS[drug.replace(/[-\s]/g, '_').toLowerCase()] || DRUG_THRESHOLDS[drug];
            const mechWeight = getDrugMechWeight(drug, m);
            const doseRatio = cfg ? Math.min(2, Math.pow((d.dosePerWeek || 0) / cfg.dosePerWeek, 1.2)) : mechWeight > 0 ? Math.min(1.5, (d.dosePerWeek || 0) / 300) : 0;
            const drugPdFactor = pdMapping ? (Object.values(PHARMA_DB).find((p: any) => p.id === drug || drug.startsWith((p as any).id?.replace(/_/g, '_') ?? '')) as any) : null;
            if (drugPdFactor && pdMapping) {
              const pdVal = drugPdFactor.pd?.[pdMapping.pdKey] ?? 0;
              pdFactor += Math.abs(pdVal) * pdMapping.weight * ((d.dosePerWeek || 0) / (drugPdFactor.ec50 || 300));
            }
            if ((cfg && doseRatio > 0.01) || mechWeight > 0) {
              const mechContribution = Math.max(0, BASE_RISK * doseRatio * G * N * T * (1 + mechWeight * 3));
              contributors.push(drug);
              prod *= (1 - Math.min(0.99, BASE_RISK * (doseRatio || 0.01) * G * N * T));
            }
          }

          const raw = Math.max(7, Math.min(100, (1 - prod) * 100 + pdFactor * 15));
          const cellCov = (i.supportCoverage || {})[id] || 0;
          const net = Math.max(0, raw * (1 - cellCov));

          mechBrk[id] = raw;
          mechDetail[id] = {
            raw,
            net,
            coverage: cellCov,
            contributors: [...new Set(contributors)],
            mitigations: Object.entries(i.supportCoverage || {})
              .filter(([k, v]) => k.startsWith(s) && v > 0)
              .map(([k, v]) => ({ substance: k.split('_').pop() || k, reduction: v })),
          };

          rM.push(raw / 100);
          nM.push(net / 100);
        }
      }

      brk[s] = { raw: geom(rM), net: geom(nM) };
      oR.push(brk[s].raw / 100);
      oN.push(brk[s].net / 100);
   }

   const overallMrr = calculateMrrAdjustment(
      i.overallBiomarkerValue ?? 1.0,
      0.8, 1.2
   );
   const overallHgi = calculateHgiAdjustment(i.overallHgiMarkers || {});
   const overallRir = calculateRirAdjustment(i.overallInterventionResponse ?? 0.5);

   return {
      systemBreakdown: brk,
      mechanismBreakdown: mechBrk,
      mechanismDetail: mechDetail,
      overallRaw: Math.min(100, Math.max(0, geom(oR) * overallMrr * overallHgi * (2 - overallRir))),
      overallNet: Math.min(100, Math.max(0, geom(oN) * overallMrr * overallHgi * (2 - overallRir)))
   };
}

// Агрегированный риск из всех источников (фарма, анализы, тренировки, питание, диагностика)
export interface AggregatedRisk {
  pharma: RiskResult;
  labs: { overallRaw: number; overallNet: number; systemBreakdown: Record<string, number> };
  training: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> };
  nutrition: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> };
  diagnostics: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> };
  overallRaw: number;
  overallNet: number;
  systemBreakdown: Record<string, { raw: number; net: number; sources?: Record<string, { raw: number; net: number }> }>;
}

export function calculateAggregatedRisks(
  pharmaResult: RiskResult,
  labResult: { systemContributions: Record<string, number> },
  trainingResult: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> },
  nutritionResult: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> },
  diagnosticsResult: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> }
): AggregatedRisk {
  const WEIGHTS = {
    pharma: 0.35,
    labs: 0.25,
    training: 0.20,
    nutrition: 0.15,
    diagnostics: 0.05
  };
  
  const TOTAL_WEIGHT = WEIGHTS.pharma + WEIGHTS.labs + WEIGHTS.training + WEIGHTS.nutrition + WEIGHTS.diagnostics;
  
  const aggregateSystem = (system: string): { raw: number; net: number; sources?: Record<string, { raw: number; net: number }> } => {
    const pharmaSys = pharmaResult.systemBreakdown?.[system];
    const labSys = labResult.systemContributions[system] ?? 0;
    const trainSys = trainingResult.systemBreakdown?.[system]?.net ?? trainingResult.systemBreakdown?.[system]?.raw ?? 0;
    const nutriSys = nutritionResult.systemBreakdown?.[system]?.net ?? nutritionResult.systemBreakdown?.[system]?.raw ?? 0;
    const diagSys = diagnosticsResult.systemBreakdown?.[system]?.net ?? diagnosticsResult.systemBreakdown?.[system]?.raw ?? 0;
    
    const raw = Math.max(pharmaSys?.raw ?? 0, labSys, trainSys, nutriSys, diagSys);
    
    let net = 0;
    net += (pharmaSys?.net ?? 0) * (WEIGHTS.pharma / TOTAL_WEIGHT);
    net += labSys * (WEIGHTS.labs / TOTAL_WEIGHT);
    net += trainSys * (WEIGHTS.training / TOTAL_WEIGHT);
    net += nutriSys * (WEIGHTS.nutrition / TOTAL_WEIGHT);
    net += diagSys * (WEIGHTS.diagnostics / TOTAL_WEIGHT);
    net = Math.min(100, net);
    
    return { 
      raw, 
      net, 
      sources: {
        pharma: { raw: pharmaSys?.raw ?? 0, net: pharmaSys?.net ?? 0 },
        labs: { raw: labSys, net: labSys },
        training: { raw: trainSys, net: trainSys },
        nutrition: { raw: nutriSys, net: nutriSys },
        diagnostics: { raw: diagSys, net: diagSys }
      }
    };
  };
  
  const systemBreakdown: Record<string, { raw: number; net: number; sources?: Record<string, { raw: number; net: number }> }> = {};
  for (const sys of RISK_SYSTEMS) {
    systemBreakdown[sys] = aggregateSystem(sys);
  }
  
  const allRaw = Object.values(systemBreakdown).map(s => s.raw);
  const allNet = Object.values(systemBreakdown).map(s => s.net);
  
  return {
    pharma: pharmaResult,
    labs: {
      overallRaw: labResult.systemContributions.overall ?? 0,
      overallNet: labResult.systemContributions.overall ?? 0,
      systemBreakdown: labResult.systemContributions
    },
    training: trainingResult,
    nutrition: nutritionResult,
    diagnostics: diagnosticsResult,
    overallRaw: Math.min(100, geom(allRaw)),
    overallNet: Math.min(100, geom(allNet)),
    systemBreakdown
  };
}


