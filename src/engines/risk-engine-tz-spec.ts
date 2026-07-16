// ── ПОЛНЫЙ ДВИЖОК РАСЧЁТА РИСКА (ТЗ разделы 5-19) ──
// R = Σ(w × m × E × U × Π(1−k*))
import { DRUG_DB, STACK_DB, TZ_MECH_LABELS, TZ_SYSTEM_LABELS, TZ_SYSTEM_ICONS, TzDrugEntry } from '../data/support-db';
import { SUPPLEMENTS_DB } from '../data/support-db/supplements';
import { PHARMACY_DB } from '../data/support-db/pharmacy-db';

const Q_MAP: Record<string, number> = { A: 1.0, B: 0.7, C: 0.4 };

// ── 6 систем с механизмами и maxRaw ──
// ТЗ п.10: каждый механизм имеет свою формулу с D/T/F/C
// rep5 — особый: только T (без D) — ТЗ п.10.5
interface MechDef { id: string; weight: number; defaultM: number; requiresD: boolean; requiresF: boolean; requiresC: boolean; }
interface SysDef { id: string; name: string; icon: string; mechanisms: MechDef[]; maxRaw: number; }
// maxRaw recalculated for extreme 2-drug course: test 1000 + tren 500, 16wk, 2 drugs, no labs
// Formula: Σ(mech.weight × (drugMechWeight/4) × m_i × D × T × [F] × [C]) × U for each drug, summed
// drugMechWeight/4 scales: weight=4 → 1.0 (full), weight=2 → 0.5 (half), weight=1 → 0.25 (weak)
const SYSTEMS: SysDef[] = [
  { id:'cardio', name:'Сердечно-сосудистая', icon:'❤️',
    mechanisms:[
      { id:'cv1', weight:4, defaultM:1, requiresD:true, requiresF:false, requiresC:true },
      { id:'cv2', weight:4, defaultM:1, requiresD:true, requiresF:true, requiresC:false },
      { id:'cv3', weight:2, defaultM:1, requiresD:true, requiresF:false, requiresC:false },
      { id:'cv4', weight:2, defaultM:1, requiresD:true, requiresF:false, requiresC:false },
      { id:'cv5', weight:4, defaultM:1, requiresD:true, requiresF:false, requiresC:true },
    ], maxRaw: 200 },
  { id:'hepatic', name:'Печень', icon:'🫁',
    mechanisms:[
      { id:'liv1', weight:4, defaultM:1, requiresD:true, requiresF:true, requiresC:false },
      { id:'liv2', weight:2, defaultM:1, requiresD:true, requiresF:true, requiresC:false },
      { id:'liv3', weight:2, defaultM:0, requiresD:true, requiresF:false, requiresC:false },
    ], maxRaw: 60 },
  { id:'renal', name:'Почки', icon:'🫘',
    mechanisms:[
      { id:'ren1', weight:2, defaultM:1, requiresD:true, requiresF:false, requiresC:false },
      { id:'ren2', weight:2, defaultM:1, requiresD:true, requiresF:false, requiresC:true },
      { id:'ren3', weight:3, defaultM:0, requiresD:true, requiresF:false, requiresC:false },
      { id:'ren4', weight:2, defaultM:1, requiresD:true, requiresF:false, requiresC:false },
    ], maxRaw: 25 },
  { id:'cns', name:'ЦНС', icon:'🧠',
    mechanisms:[
      { id:'cns1', weight:3, defaultM:1, requiresD:true, requiresF:false, requiresC:true },
      { id:'cns2', weight:3, defaultM:1, requiresD:true, requiresF:false, requiresC:false },
      { id:'cns3', weight:2, defaultM:0, requiresD:true, requiresF:false, requiresC:false },
      { id:'cns4', weight:2, defaultM:1, requiresD:true, requiresF:false, requiresC:false },
      { id:'cns5', weight:2, defaultM:0, requiresD:true, requiresF:false, requiresC:false },
      { id:'cns6', weight:2, defaultM:0, requiresD:true, requiresF:false, requiresC:false },
    ], maxRaw: 100 },
  { id:'reproductive', name:'Репродуктивная / HPG-ось', icon:'🧬',
    mechanisms:[
      { id:'rep1', weight:4, defaultM:2, requiresD:true, requiresF:false, requiresC:false },
      { id:'rep2', weight:4, defaultM:2, requiresD:true, requiresF:false, requiresC:false },
      { id:'rep3', weight:2, defaultM:1, requiresD:true, requiresF:false, requiresC:false },
      { id:'rep4', weight:2, defaultM:1, requiresD:true, requiresF:true, requiresC:false },
      { id:'rep5', weight:2, defaultM:1, requiresD:false, requiresF:false, requiresC:false },
    ], maxRaw: 165 },
  { id:'hematologic', name:'Гематолого-метаболический', icon:'🩸',
    mechanisms:[
      { id:'hem1', weight:3, defaultM:1, requiresD:true, requiresF:false, requiresC:false },
      { id:'hem2', weight:2, defaultM:0, requiresD:true, requiresF:false, requiresC:false },
      { id:'hem3', weight:3, defaultM:0, requiresD:true, requiresF:false, requiresC:false },
      { id:'hem4', weight:2, defaultM:0, requiresD:true, requiresF:false, requiresC:false },
      { id:'hem5', weight:2, defaultM:0, requiresD:true, requiresF:false, requiresC:false },
    ], maxRaw: 45 },
];

// ── Типы ──
export interface DrugInput {
  drugClass: 'aas'|'gh'|'insulin'; drugName: string;
  dose: number; form: 'inject'|'oral';
  startWeek?: number;  // неделя начала (по умолчанию 1)
  endWeek?: number;    // неделя окончания (по умолчанию = duration)
  concFactor?: number; // 0..1 — масштабирование вклада препарата (для timeline: распад ↓)
  effDuration?: number; // эффективная длительность для этого препарата (для timeline)
}
export interface TzSpecInput {
  drugClass: 'aas'|'gh'|'insulin'; drugName: string;
  dose: number; duration: number; form: 'inject'|'oral';
  combinations: number; labCoverage: number;
  labValues: Record<string, number>; supportSubstances: string[];
  drugs?: DrugInput[];
  genetics?: { cyp19a1?: string; srd5a2?: string; mthfr?: string; ar?: string; esr1?: string; comt?: string; agtr1?: string; nos3?: string; };
  nutrition?: { proteinPerKg: number; fiberG: number; omega3G: number; sodiumG: number; potassiumG: number; waterL: number; calories: number; };
  training?: { hasHIIT: boolean; weeklyMinutes: number; volumeTonnes: number; lissMinutesPerWeek: number; };
  courseWeek?: number;
}
export interface TzSpecMechanismResult {
  id: string; name: string; weight: number; m_i: number;
  E_i: number; raw: number; afterSupport: number; k_used: number; q_label: string;
}
export interface TzSpecOrganResult {
  id: string; name: string; icon: string;
  rawScore: number; rawPercent: number; afterScore: number; afterPercent: number;
  maxRaw: number;
  category: 'low'|'moderate'|'high'|'very_high';
  mechanisms: TzSpecMechanismResult[]; k_protect: number;
}
export interface TzSpecResult {
  organs: TzSpecOrganResult[]; overallRaw: number; overallAfter: number;
  overallCategory: string; k_protect_overall: number;
  d_cov: number; u_i: number; supportCount: number; explanation: string;
}

// ── DRUG_CLASSES ──
export const DRUG_CLASSES: Record<string,{name:string;doseLabel:string;doseMin:number;doseMax:number;defaultDose:number;defaultDuration:number;icon:string}> = {
  aas:{name:'ААС',doseLabel:'мг/нед',doseMin:100,doseMax:3000,defaultDose:500,defaultDuration:12,icon:'💉'},
  gh:{name:'GH',doseLabel:'МЕ/сут',doseMin:1,doseMax:20,defaultDose:4,defaultDuration:16,icon:'📈'},
  insulin:{name:'Инсулин',doseLabel:'Ед/сут',doseMin:1,doseMax:50,defaultDose:10,defaultDuration:8,icon:'🍬'},
};

export function getCategoryLabel(cat:string):string {
  switch(cat) {
    case 'low': return 'Низкий'; case 'moderate': return 'Умеренный';
    case 'high': return 'Высокий'; case 'very_high': return 'Очень высокий';
    default: return '—';
  }
}

// ── Коэффициенты ──
function getDoseFactor(dose:number,drugClass:string):number {
  if(drugClass==='aas'){if(dose<=200)return 1.0;if(dose<=500)return 1.25;if(dose<=1000)return 1.5;return 2.0}
  if(drugClass==='gh'){if(dose<=4)return 1.0;if(dose<=8)return 1.25;if(dose<=12)return 1.5;return 2.0}
  if(dose<=10)return 1.0;if(dose<=20)return 1.25;if(dose<=30)return 1.5;return 2.0;
}
function getDurationFactor(weeks:number):number{if(weeks<=4)return 1.0;if(weeks<=8)return 1.2;if(weeks<=16)return 1.4;return 1.6}
function getFormFactor(form:string,organId:string):number{if(form==='inject')return 1.0;if(form==='oral'&&organId==='hepatic')return 1.5;if(form==='oral')return 1.3;return 1.0}
function getCombinationFactor(count:number):number{if(count<=1)return 1.0;if(count===2)return 1.2;return 1.5}
function getPenaltyFactor(d_cov:number):number{return 1+0.25*(1-d_cov)}

// ── m_i из лабораторных значений (таблица T4) + коррекция по дозе ──
function getMiFromLab(mechId:string,labValues:Record<string,number>,doseFactor?:number,mechWeight?:number):number{
  // Базовые defaults с учётом guaranteed эффектов ААС
  const baseDefaults:Record<string,number>={cv1:1,cv2:2,cv3:1,cv4:2,cv5:1,liv1:2,liv2:1,liv3:0,ren1:1,ren2:1,ren3:0,ren4:1,cns1:2,cns2:2,cns3:0,cns4:1,cns5:0,cns6:0,rep1:3,rep2:3,rep3:2,rep4:1,rep5:2,hem1:2,hem2:0,hem3:0,hem4:0,hem5:0};
  // Масштабируем по дозе: doseFactor 1.0-2.0 → умножаем m_i
  const mult = doseFactor && doseFactor > 1.0 ? Math.min(1.5, doseFactor) : 1.0;
  const raw = baseDefaults[mechId] ?? 0;
  const defaults = Math.min(3, Math.round(raw * mult));

  // Все доступные лабораторные маркеры
  const ldl=labValues['LDL'];const hdl=labValues['HDL'];const tg=labValues['TG'];const tc=labValues['TC'];
  const hct=labValues['HCT'];const hgb=labValues['HGB'];const plt=labValues['PLT'];
  const alt=labValues['ALT'];const ast=labValues['AST'];const ggt=labValues['GGT'];const bil=labValues['BIL'];
  const k=labValues['K'];const na=labValues['NA'];const egfr=labValues['eGFR'];const creat=labValues['CREAT'];const uacr=labValues['UACR'];
  const lh=labValues['LH'];const fsh=labValues['FSH'];const tt=labValues['TT'];const e2=labValues['E2'];const prl=labValues['PRL'];const shbg=labValues['SHBG'];
  const glu=labValues['GLU'];const homa=labValues['HOMA'];const crp=labValues['CRP'];const homoc=labValues['HOMOCYSTEINE'];
  const tsh=labValues['TSH'];const bnp=labValues['BNP'];const dDimer=labValues['D_DIMER'];const fib=labValues['FIBRINOGEN'];
  const psa=labValues['PSA'];
  const cortisol=labValues['CORTISOL'];
  const ferritin=labValues['FERRITIN'];const vitd=labValues['VITD'];const b12=labValues['B12'];const folate=labValues['FOLATE'];
  const dheas=labValues['DHEAS'];const mg=labValues['MG'];const ca=labValues['CA'];const phos=labValues['PHOS'];
  const ck=labValues['CK'];const il6=labValues['IL6'];const tnfa=labValues['TNFA'];
  const urea=labValues['UREA'];const uric=labValues['URIC'];const wbc=labValues['WBC'];const rbcVal=labValues['RBC'];
  const ft=labValues['FT'];const dht=labValues['DHT'];const prog=labValues['PROG'];
  const t3=labValues['T3'];const t4=labValues['T4'];const antiTpo=labValues['ANTI_TPO'];
  const psaFree=labValues['PSA_FREE'];const aldo=labValues['ALDO'];const pth=labValues['PTH'];

  // Хелпер: лабораторный m_i → max(default, labValue)
  const labMi = (val:number|undefined, thresholds:[number,number,number]):number|undefined => {
    if (val === undefined) return undefined;
    if (val < thresholds[0]) return 0;
    if (val < thresholds[1]) return 1;
    if (val < thresholds[2]) return 2;
    return 3;
  };
  // Для обратных маркеров (ниже нормы = хуже)
  const labMiInv = (val:number|undefined, thresholds:[number,number,number]):number|undefined => {
    if (val === undefined) return undefined;
    if (val > thresholds[0]) return 0;
    if (val > thresholds[1]) return 1;
    if (val > thresholds[2]) return 2;
    return 3;
  };

  let labResult: number | undefined;

  switch(mechId){
    // ── ССС ──
    case'cv1': { // ремоделирование: NT-proBNP (high = worse), CK (мышечное повреждение)
      const bnpMi = labMi(bnp,[125,300,900]);
      const ckMi = labMi(ck,[200,500,1000]);
      const vals = [bnpMi,ckMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'cv2': { // дислипидемия: LDL, HDL(inv), TG, TC
      const ldlMi = labMi(ldl,[2.6,3.4,4.9]);
      const hdlMi = labMiInv(hdl,[1.5,1.0,0.8]);
      const tgMi = labMi(tg,[1.7,2.3,5.6]);
      const tcMi = labMi(tc,[5.0,6.2,7.5]);
      // Берём худший
      const vals = [ldlMi,hdlMi,tgMi,tcMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'cv3': { // задержка Na/H₂O: натрий
      const naMi = labMi(na,[145,148,155]);
      if (naMi !== undefined) labResult = naMi;
      break;
    }
    case'cv4': { // протромботический: HCT, D-dimer, Fibrinogen, Platelets
      const hctMi = labMi(hct,[48,51,54]);
      const dMi = labMi(dDimer,[0.5,1.0,2.0]);
      const fibMi = labMi(fib,[4.0,5.0,6.0]);
      const pltMi = labMi(plt,[400,500,600]);
      const vals = [hctMi,dMi,fibMi,pltMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'cv5': { // аритмогенный: K (low), HCT (high = hyperviscosity)
      const kMi = labMiInv(k,[3.5,3.0,2.5]);
      const hctMi = labMi(hct,[50,54,58]);
      const vals = [kMi,hctMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    // ── Печень ──
    case'liv1': { // гепатоцеллюлярная: ALT, AST
      const altMi = labMi(alt,[40,80,200]);
      const astMi = labMi(ast,[40,80,200]);
      const vals = [altMi,astMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'liv2': { // холестаз: GGT, Bilirubin
      const ggtMi = labMi(ggt,[55,110,220]);
      const bilMi = labMi(bil,[21,50,100]);
      const vals = [ggtMi,bilMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'liv3': { // пренеопластический: AST/ALT ratio, GGT>2×ULN
      if (alt !== undefined && ast !== undefined) {
        const ratio = ast / alt;
        if (ratio > 2) labResult = 3;
        else if (ratio > 1.5) labResult = 2;
        else if (ratio > 1) labResult = 1;
        else labResult = 0;
      }
      break;
    }
    // ── Почки ──
    case'ren1': { // гемодинамическое: eGFR, creatinine, urea, uric acid
      const egfrMi = labMiInv(egfr,[90,60,30]);
      const crMi = labMi(creat,[90,130,200]);
      const ureaMi = labMi(urea,[8,12,20]);
      const uricMi = labMi(uric,[420,480,540]);
      const vals = [egfrMi,crMi,ureaMi,uricMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'ren2': { // гиперфильтрация: eGFR > 120 (early hyperfiltration)
      if (egfr !== undefined) {
        if (egfr > 130) labResult = 2;
        else if (egfr > 120) labResult = 1;
        else labResult = 0;
      }
      break;
    }
    case'ren3': { // протеинурия: UACR / proteinuria
      const uacrMi = labMi(uacr,[30,300,1000]);
      if (uacrMi !== undefined) labResult = uacrMi;
      break;
    }
    case'ren4': { // водно-электролитный: K, Na, Mg, Ca
      const kMi = labMiInv(k,[3.5,3.0,2.5]);
      const naMi = labMiInv(na,[135,130,125]);
      const mgMi = labMiInv(mg,[0.75,0.65,0.5]);
      const caMi = labMiInv(ca,[2.2,2.0,1.75]);
      const vals = [kMi,naMi,mgMi,caMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    // ── ЦНС ──
    case'cns1': { // нейромедиаторная: Prolactin (↑ = дофамин ↓)
      const prlMi = labMi(prl,[15,25,50]);
      if (prlMi !== undefined) labResult = prlMi;
      break;
    }
    case'cns2': { // окислительный стресс: CRP, Homocysteine, IL-6, TNF-alpha, Ferritin
      const crpMi = labMi(crp,[5,10,20]);
      const homocMi = labMi(homoc,[15,20,30]);
      const il6Mi = labMi(il6,[2,5,10]);
      const tnfaMi = labMi(tnfa,[3,5,10]);
      const ferMi = labMi(ferritin,[300,400,500]);
      const vals = [crpMi,homocMi,il6Mi,tnfaMi,ferMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'cns3': { // апоптоз: нет прямого маркера, используем Homocysteine как суррогат
      const homocMi = labMi(homoc,[15,20,30]);
      if (homocMi !== undefined) labResult = homocMi;
      break;
    }
    case'cns4': { // нейроэндокринная: TSH (high=hypothyroid), Cortisol (high=stress), T3(low), T4(low), DHEA-S(low)
      const tshMi = labMi(tsh,[4.0,6.0,10.0]);
      const cortMi = labMi(cortisol,[690,900,1380]);
      const t3Mi = labMiInv(t3,[4.5,3.5,2.5]);
      const t4Mi = labMiInv(t4,[12,9,6]);
      const dheasMi = labMiInv(dheas,[100,50,20]);
      const vals = [tshMi,cortMi,t3Mi,t4Mi,dheasMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'cns5': { // нейроглюкопения: Glucose
      const gluMi = labMiInv(glu,[3.9,3.3,2.8]);
      if (gluMi !== undefined) labResult = gluMi;
      break;
    }
    case'cns6': { // внутричерепная гипертензия: нет прямого маркера
      break;
    }
    // ── Репродуктивная ──
    case'rep1': { // супрессия GnRH/LH/FSH: LH, FSH
      const lhMi = labMiInv(lh,[2.0,1.0,0.5]);
      const fshMi = labMiInv(fsh,[2.0,1.0,0.5]);
      const vals = [lhMi,fshMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'rep2': { // ↓ интратестикулярного T: TT (низкий=плохо), FT (низкий=плохо), SHBG (высокий=↓free T)
      const ttMi = labMiInv(tt,[12,8,4]);
      const ftMi = labMiInv(ft,[250,150,50]);
      const shbgMi = labMi(shbg,[60,80,100]);
      const vals = [ttMi,ftMi,shbgMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'rep3': { // сперматогенез: FSH (low=suppressed), Inhibin B (не измеряем)
      const fshMi = labMiInv(fsh,[2.0,1.0,0.5]);
      if (fshMi !== undefined) labResult = fshMi;
      break;
    }
    case'rep4': { // эстрогенный сдвиг: E2 (нормализовано в pg/mL)
      const e2Mi = labMi(e2,[40,55,80]);
      if (e2Mi !== undefined) labResult = e2Mi;
      break;
    }
    case'rep5': { // постцикловая супрессия: LH+TT combined
      const lhMi = labMiInv(lh,[2.0,1.0,0.5]);
      const ttMi = labMiInv(tt,[12,8,4]);
      const vals = [lhMi,ttMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    // ── Гематолого-метаболический ──
    case'hem1': { // эритроцитоз: HCT, Hemoglobin, RBC, WBC
      const hctMi = labMi(hct,[48,51,54]);
      const hgbMi = labMi(hgb,[170,180,190]);
      const rbcMi = labMi(rbcVal,[5.5,6.0,6.5]);
      const wbcMi = labMi(wbc,[11,13,15]);
      const vals = [hctMi,hgbMi,rbcMi,wbcMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'hem2': { // инсулинорезистентность: Glucose, HOMA
      const gluMi = labMi(glu,[5.6,6.1,7.0]);
      const homaMi = labMi(homa,[2.0,3.0,5.0]);
      const vals = [gluMi,homaMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
    case'hem3': { // гипогликемия: Glucose (low = bad)
      const gluMi = labMiInv(glu,[3.9,3.3,2.8]);
      if (gluMi !== undefined) labResult = gluMi;
      break;
    }
    case'hem4': { // гипокалиемия: K (low = bad)
      const kMi = labMiInv(k,[3.5,3.0,2.5]);
      if (kMi !== undefined) labResult = kMi;
      break;
    }
    case'hem5': { // водно-электролитный сдвиг: K, Na, Mg, Ca
      const kMi = labMiInv(k,[3.5,3.0,2.5]);
      const naMi = labMiInv(na,[135,130,125]);
      const mgMi = labMiInv(mg,[0.75,0.65,0.5]);
      const caMi = labMiInv(ca,[2.2,2.0,1.75]);
      const vals = [kMi,naMi,mgMi,caMi].filter(v=>v!==undefined) as number[];
      if (vals.length > 0) labResult = Math.max(...vals);
      break;
    }
  }

  // Лабораторное значение имеет приоритет, но не ниже минимума от doseFactor
  if (labResult !== undefined) {
    return Math.max(labResult, defaults > 0 ? 1 : 0);
  }

  // Если механизм целевой для препарата (weight>0) — минимум m_i=1
  const result = Math.max(defaults, (mechWeight && mechWeight > 0) ? 1 : 0);
  return Math.min(3, result);
}

// ── PK-модель: накопление и распад препарата ──
// halfLifeWeeks — период полувыведения в неделях (из DRUG_DB или эвристика)
// Накопление: A(t) = 1 - e^(-k_acc × t) — стационар за ~5半life
// Распад:     A(t) = e^(-k_dec × (t - endWeek)) — затухание после отмены
// k = ln(2) / halfLife  ≈ 0.693 / halfLife
function getHalfLifeWeeks(drugName: string, form: string): number {
  const entry = DRUG_DB[drugName.toLowerCase()] || DRUG_DB[drugName];
  if (entry?.pk?.halfLifeHours) {
    return Math.max(0.5, entry.pk.halfLifeHours / 168); // 168ч = 1 неделя
  }
  // Эвристика по форме/классу
  if (form === 'oral') return 0.5;   // оралы — быстрые
  if (entry?.class === 'gh') return 1.0;
  if (entry?.class === 'insulin') return 0.3;
  // Инъекционные ААС: по эфиру
  const n = drugName.toLowerCase();
  if (n.includes('prop') || n.includes('acet')) return 1.0;
  if (n.includes('phen')) return 1.5;
  if (n.includes('enan') || n.includes('cyp')) return 2.0;
  if (n.includes('deca') || n.includes('nand')) return 2.5;
  if (n.includes('undec')) return 3.0;
  return 2.0; // дефолт для инъекций
}

// Концентрация препарата на неделе W (0..1)
// startWeek, endWeek — 1-indexed недели действия
// weeksAfter — сколько недель прошло после endWeek (для распада)
function getDrugConcentration(week: number, startWeek: number, endWeek: number, halfLifeWeeks: number): number {
  if (week < startWeek) return 0;          // ещё не начал
  if (week <= endWeek) {
    // Накопление: A = 1 - e^(-k×(week-startWeek+1))
    const k = 0.693 / halfLifeWeeks;
    return 1 - Math.exp(-k * (week - startWeek + 1));
  }
  // Распад: A = e^(-k×(week-endWeek))
  const k = 0.693 / halfLifeWeeks;
  return Math.exp(-k * (week - endWeek));
}

// ── Понедельная динамика риска ──
export interface TimelineWeekResult {
  week: number;
  activeDrugs: string[];     // имена активных препаратов
  drugConcentrations: Record<string, number>; // имя → 0..1
  organPercents: Record<string, number>;      // sysId → rawPercent
  organAfterPercents: Record<string, number>; // sysId → afterPercent
  overallRaw: number;
  overallAfter: number;
}

export function calculateTzSpecRiskTimeline(input: TzSpecInput, totalWeeks?: number): TimelineWeekResult[] {
  const drugEntries = input.drugs && input.drugs.length > 0 ? input.drugs
    : [{ drugClass: input.drugClass, drugName: input.drugName, dose: input.dose, form: input.form }];

  // Определяем общую длительность курса
  let maxEnd = input.duration || 12;
  for (const d of drugEntries) {
    const sw = d.startWeek || 1;
    const ew = d.endWeek || input.duration || 12;
    // Добавляем 3 полувыведения для распада (до ~12% остатка)
    const hl = getHalfLifeWeeks(d.drugName, d.form);
    const decayWeeks = Math.ceil(hl * 3);
    maxEnd = Math.max(maxEnd, ew + decayWeeks);
  }
  if (totalWeeks) maxEnd = Math.max(maxEnd, totalWeeks);

  const results: TimelineWeekResult[] = [];
  for (let w = 1; w <= maxEnd; w++) {
    // Фильтруем активные препараты (концентрация > 0.02)
    const activeDrugs: DrugInput[] = [];
    const concentrations: Record<string, number> = {};
    for (const d of drugEntries) {
      const sw = d.startWeek || 1;
      const ew = d.endWeek || input.duration || 12;
      const hl = getHalfLifeWeeks(d.drugName, d.form);
      const conc = getDrugConcentration(w, sw, ew, hl);
      if (conc > 0.02) {
        activeDrugs.push(d);
        concentrations[d.drugName] = Math.round(conc * 100) / 100;
      }
    }

    // Считаем риск для этой недели с активными препаратами
    if (activeDrugs.length === 0) {
      results.push({
        week: w, activeDrugs: [], drugConcentrations: {},
        organPercents: {}, organAfterPercents: {},
        overallRaw: 0, overallAfter: 0,
      });
      continue;
    }

    // Длительность для этой недели = сколько недель препарат уже принимается
    const effectiveDuration = Math.min(input.duration, w);
    // Комбинация: только препараты с conc > 0.5 (полноценные партнёры)
    const fullComboCount = activeDrugs.filter(d => (concentrations[d.drugName] || 1) > 0.5).length;
    // Передаём concFactor и effDuration per-drug
    const weekInput: TzSpecInput = {
      ...input,
      duration: effectiveDuration,
      combinations: Math.max(1, fullComboCount),
      drugs: activeDrugs.map(d => ({
        ...d,
        concFactor: concentrations[d.drugName] || 1,
        effDuration: Math.max(1, w - (d.startWeek || 1) + 1),
      })),
    };

    const weekResult = calculateTzSpecRisk(weekInput);

    // Риск уже отмасштабирован per-drug через concFactor — не усредняем
    const organPercents: Record<string, number> = {};
    const organAfterPercents: Record<string, number> = {};
    for (const o of weekResult.organs) {
      organPercents[o.id] = o.rawPercent;
      organAfterPercents[o.id] = o.afterPercent;
    }

    const overallRaw = Math.round(Object.values(organPercents).reduce((a, b) => a + b, 0) / (Object.keys(organPercents).length || 1));
    const overallAfter = Math.round(Object.values(organAfterPercents).reduce((a, b) => a + b, 0) / (Object.keys(organAfterPercents).length || 1));

    results.push({
      week: w,
      activeDrugs: activeDrugs.map(d => d.drugName),
      drugConcentrations: concentrations,
      organPercents,
      organAfterPercents,
      overallRaw,
      overallAfter,
    });
  }
  return results;
}

// ── ГЛАВНАЯ ФУНКЦИЯ РАСЧЁТА ──
export function calculateTzSpecRisk(input: TzSpecInput): TzSpecResult {
  const{duration,combinations,labCoverage,labValues,supportSubstances}=input;
  const T_i=getDurationFactor(duration);const C_i=getCombinationFactor(combinations);
  const U_i=getPenaltyFactor(labCoverage);
  const genetics=input.genetics||{};
  const nutrition=input.nutrition;
  const training=input.training;

  // Генетические множители: повышают m_i для конкретных механизмов
  const geneticBoost: Record<string, number> = {};
  if (genetics.mthfr === 'c677t') { geneticBoost['cns2'] = 1.3; geneticBoost['cns3'] = 1.2; } // гомоцистеин ↑ → окислительный стресс + апоптоз
  if (genetics.cyp19a1 === 'high') { geneticBoost['rep4'] = 1.3; } // ароматиза ↑ → эстрогенный сдвиг
  if (genetics.srd5a2 === 'hypersensitive') { geneticBoost['rep2'] = 1.15; } // 5α-редуктаза ↑ → DHT сдвиг (связан с репродуктивной)
  if (genetics.ar === 'high') { geneticBoost['rep1'] = 1.2; } // AR чувствительность → супрессия HPTA
  if (genetics.comt === 'slow') { geneticBoost['cns1'] = 1.2; } // COMT медленный → дофамин/катехоламины ↑
  if (genetics.agtr1 === 'high') { geneticBoost['cv3'] = 1.2; } // AGTR1 → задержка Na/H₂O
  if (genetics.nos3 === 'low') { geneticBoost['cv1'] = 1.2; geneticBoost['cv5'] = 1.15; } // NO ↓ → ремоделирование + аритмия
  if (genetics.esr1 === 'high') { geneticBoost['rep4'] = (geneticBoost['rep4']||1)*1.15; } // ESR1 ↑ → эстрогенный

  // Питание: плохое питание → выше риск (множитель 1.0-1.2)
  const nutritionMult = nutrition ? (() => {
    let m = 1.0;
    if (nutrition.proteinPerKg < 1.5) m += 0.05; // мало белка
    if (nutrition.fiberG < 20) m += 0.05;
    if (nutrition.omega3G < 1.0) m += 0.05;
    if (nutrition.sodiumG > 4) m += 0.03; // много соли → ССС
    if (nutrition.potassiumG < 2.5) m += 0.03;
    if (nutrition.waterL < 1.5) m += 0.04;
    return Math.min(1.25, m);
  })() : 1.0;

  // Тренировки: высокий объём → выше риск (множитель 1.0-1.15)
  const trainingMult = training ? (() => {
    let m = 1.0;
    const totalMin = training.weeklyMinutes || 0;
    if (totalMin > 360) m += 0.05;
    if (totalMin > 480) m += 0.05;
    if (training.hasHIIT) m += 0.03;
    if (training.volumeTonnes > 10000) m += 0.02;
    return Math.min(1.20, m);
  })() : 1.0;

  // Определяем список препаратов
  const drugEntries=input.drugs&&input.drugs.length>0?input.drugs
    :[{drugClass:input.drugClass,drugName:input.drugName,dose:input.dose,form:input.form}];

  // Собираем поддержку
  const supportLookup=new Map<string,Array<{organId:string;mechId:string;k:number;q:'A'|'B'|'C'}>>();
  for(const subId of supportSubstances){
    const entries=SUPPLEMENTS_DB[subId]||PHARMACY_DB[subId];
    if(entries)supportLookup.set(subId,entries);
  }

  const organResults:TzSpecOrganResult[]=[];
  let overallBefore=0,overallAfter=0;

  for(const sys of SYSTEMS){
    const mechResults:TzSpecMechanismResult[]=[];
    let totalBefore=0,totalAfter=0;

    for(const mech of sys.mechanisms){
      let mechRaw=0,mechAfter=0;let bestQ='';
      const C_mech=mech.requiresC?C_i:1.0;

      // Суммируем вклад КАЖДОГО препарата в этот механизм
      for(const drug of drugEntries){
        const drugEntry=DRUG_DB[drug.drugName.toLowerCase()]||DRUG_DB[drug.drugName];
        const mechWeight=drugEntry?.mechanismWeights?.[mech.id]||0;
        if(mechWeight===0) continue; // Drug doesn't target this mechanism — skip
        const D_i=getDoseFactor(drug.dose,drug.drugClass)*(drugEntry?.doseModifier||1.0);
        // Per-drug duration (timeline: drug B started week 6, now week 8 → 2 weeks, not 8)
        const drugDuration = drug.effDuration ?? duration;
        const T_drug=getDurationFactor(drugDuration);
        const m_i=getMiFromLab(mech.id,labValues,D_i,mechWeight);
        // Генетический множитель для этого механизма
        const gMult = geneticBoost[mech.id] || 1.0;
        const m_i_adj = m_i * gMult * nutritionMult * trainingMult;
        const F_mech=mech.requiresF?getFormFactor(drug.form,sys.id):1.0;
        // ТЗ п.10.5: rep5 = w × m × T (без D)
        const D_eff=mech.requiresD?D_i:1.0;
        const E_i=D_eff*T_drug*F_mech*C_mech;
        // mechWeight/4 scales drug contribution: weight=4→1.0, weight=2→0.5, weight=1→0.25
        // concFactor scales per-drug contribution (timeline: drug decaying → lower risk)
        const concMult = drug.concFactor ?? 1.0;
        mechRaw += mech.weight*(mechWeight/4)*m_i_adj*E_i*concMult;
      }

      // Штраф за отсутствие анализов
      mechRaw*=U_i;

      // Π(1 - k*_ij) — поддержка применяется к сумме
      // Кап: минимум 0.30 (не более 70% снижения риска) — ТЗ правило
      let productK=1.0;let maxK=0;
      for(const[,entries]of supportLookup){
        for(const entry of entries){
          if(entry.organId===sys.id&&entry.mechId===mech.id){
            const qVal=Q_MAP[entry.q]||0.7;
            productK*=(1-entry.k*qVal);
            if(entry.k>maxK){maxK=entry.k;bestQ=entry.q;}
          }
        }
      }
      productK=Math.max(0.30,productK);
      mechAfter=mechRaw*productK;

      totalBefore+=mechRaw;totalAfter+=mechAfter;
      const mechId=mech.id;
      mechResults.push({
        id:mechId,name:TZ_MECH_LABELS[mechId]||mechId,weight:mech.weight,
        m_i:Math.round(mechRaw/(mech.weight*U_i*(C_mech||1)||1)),
        E_i:Math.round(T_i*100)/100,raw:Math.round(mechRaw*10)/10,
        afterSupport:Math.round(mechAfter*10)/10,
        k_used:Math.round((1-productK)*100),q_label:bestQ,
      });
    }

    const rawPercent=sys.maxRaw>0?Math.min(100,Math.round((totalBefore/sys.maxRaw)*100)):0;
    const afterPercent=sys.maxRaw>0?Math.min(100,Math.round((totalAfter/sys.maxRaw)*100)):0;
    const k_protect=totalBefore>0?Math.round(((totalBefore-totalAfter)/totalBefore)*100):0;

    organResults.push({
      id:sys.id,name:sys.name,icon:sys.icon,
      rawScore:Math.round(totalBefore*10)/10,rawPercent,
      afterScore:Math.round(totalAfter*10)/10,afterPercent,
      maxRaw:sys.maxRaw,
      category:afterPercent<25?'low':afterPercent<50?'moderate':afterPercent<75?'high':'very_high',
      mechanisms:mechResults,k_protect,
    });
    overallBefore+=rawPercent;overallAfter+=afterPercent;
  }

  const n=organResults.length||1;
  const overallRaw=Math.round(overallBefore/n);
  const overallAfterAvg=Math.round(overallAfter/n);
  const overallK=overallRaw>0?Math.round(((overallRaw-overallAfterAvg)/overallRaw)*100):0;

  const highOrgans=organResults.filter(o=>o.afterPercent>=50);
  const suppIDs=[...supportLookup.keys()];
  const drugNames=drugEntries.map(d=>`${d.drugName} ${d.dose}${d.drugClass==='aas'?'мг':''}`).join(' + ');
  const explanation=[
    'Модель: механизм-ориентированный интегральный индекс риска (ТЗ).',
    `Курс: ${drugNames}, ${duration} нед.`,
    'Формула: R = Σ(w × m × E × U × Π(1−k*)), суммирование по препаратам.',
    suppIDs.length>0?`Поддержка (${suppIDs.length}): ${suppIDs.join(', ')}.`:'Поддержка не выбрана.',
    highOrgans.length>0?`Наибольший риск: ${highOrgans.map(o=>`${o.icon} ${o.name} (${o.afterPercent}%)`).join(', ')}.`:'Все системы в норме.',
  ].join('\n');

  return{
    organs:organResults,
    overallRaw,overallAfter:overallAfterAvg,
    overallCategory:getCategoryLabel(overallAfterAvg<25?'low':overallAfterAvg<50?'moderate':overallAfterAvg<75?'high':'very_high'),
    k_protect_overall:overallK,d_cov:labCoverage,u_i:U_i,
    supportCount:suppIDs.length,explanation,
  };
}

// ── ПОДБОР ПОДДЕРЖКИ ПО РИСКУ ──
export function pickSupport(riskResult: TzSpecResult, drugClass: string, form: string, level: string): string[] {
  const ids = new Set<string>();

  // 1. Обязательные
  if (drugClass === 'aas') {
    ids.add('hcg');
    if (form === 'oral') ids.add('anastrozole');
  }

  // 2. Broad coverage — препараты, покрывающие >1 механизма с риском
  const activeMechs = new Set<string>();
  for (const o of riskResult.organs)
    for (const m of o.mechanisms)
      if (m.afterSupport >= (level === 'boost' ? 0 : level === 'max' ? 15 : level === 'medium' ? 30 : 50))
        activeMechs.add(m.id);

  const allDb: Record<string, any[]> = { ...SUPPLEMENTS_DB, ...PHARMACY_DB };
  const scored: [string, number][] = [];
  for (const [id, entries] of Object.entries(allDb)) {
    if (ids.has(id)) continue;
    if (!entries.length) continue;
    let count = 0;
    for (const m of riskResult.organs)
      for (const me of m.mechanisms)
        if (activeMechs.has(me.id) && entries.some((e: any) => e.organId === m.id && e.mechId === me.id && e.k > 0))
          count++;
    if (count > 0) scored.push([id, count]);
  }

  // Топ широких
  scored.sort((a, b) => b[1] - a[1]);
  for (const [id] of scored.slice(0, level === 'boost' ? 10 : level === 'max' ? 8 : level === 'medium' ? 5 : 3))
    ids.add(id);

  // 3. Точечное усиление — для самых критических механизмов добавляем best k
  const used = new Set(ids);
  for (const o of riskResult.organs)
    for (const m of o.mechanisms)
      if (activeMechs.has(m.id) && m.afterSupport >= 50) {
        let best: string | null = null;
        let bestK = 0;
        for (const [id, entries] of Object.entries(allDb))
          if (!used.has(id))
            for (const e of entries)
              if (e.organId === o.id && e.mechId === m.id && e.k > bestK) { best = id; bestK = e.k; }
        if (best) { ids.add(best); used.add(best); }
      }

  return [...ids];
}

