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
}
export interface TzSpecInput {
  drugClass: 'aas'|'gh'|'insulin'; drugName: string;
  dose: number; duration: number; form: 'inject'|'oral';
  combinations: number; labCoverage: number;
  labValues: Record<string, number>; supportSubstances: string[];
  drugs?: DrugInput[];  // множественный курс: переопределяет drugClass+dose+form
}
export interface TzSpecMechanismResult {
  id: string; name: string; weight: number; m_i: number;
  E_i: number; raw: number; afterSupport: number; k_used: number; q_label: string;
}
export interface TzSpecOrganResult {
  id: string; name: string; icon: string;
  rawScore: number; rawPercent: number; afterScore: number; afterPercent: number;
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

  const ldl=labValues['LDL'];const hct=labValues['HCT'];const alt=labValues['ALT'];const ast=labValues['AST'];const ggt=labValues['GGT'];
  const k=labValues['K'];const egfr=labValues['eGFR'];const creat=labValues['CREAT'];const uacr=labValues['UACR'];
  const lh=labValues['LH'];const tt=labValues['TT'];const e2=labValues['E2'];const glu=labValues['GLU'];const homa=labValues['HOMA'];
  switch(mechId){
    case'cv2':if(ldl!==undefined){if(ldl<2.6)return 0;if(ldl<3.4)return 1;if(ldl<4.9)return 2;return 3}break;
    case'cv4':if(hct!==undefined){if(hct<48)return 0;if(hct<51)return 1;if(hct<54)return 2;return 3}break;
    case'cv5':if(k!==undefined){if(k>=3.5)return 0;if(k>=3.0)return 1;if(k>=2.5)return 2;return 3}break;
    case'liv1':if(alt!==undefined){if(alt<40)return 0;if(alt<80)return 1;if(alt<200)return 2;return 3}break;
    case'liv2':if(ggt!==undefined){if(ggt<55)return 0;if(ggt<110)return 1;if(ggt<220)return 2;return 3}break;
    case'ren1':case'ren2':if(egfr!==undefined){if(egfr>=90)return 0;if(egfr>=60)return 1;if(egfr>=30)return 2;return 3}if(creat!==undefined){if(creat<90)return 0;if(creat<130)return 1;if(creat<200)return 2;return 3}break;
    case'ren3':if(uacr!==undefined){if(uacr<30)return 0;if(uacr<300)return 1;if(uacr<1000)return 2;return 3}break;
    case'rep1':if(lh!==undefined){if(lh>=2.0)return 0;if(lh>=1.0)return 1;if(lh>=0.5)return 2;return 3}break;
    case'rep2':if(tt!==undefined){if(tt>12)return 0;if(tt>8)return 1;if(tt>4)return 2;return 3}break;
    case'rep4':if(e2!==undefined){if(e2<160)return 0;if(e2<200)return 1;if(e2<300)return 2;return 3}break;
    case'cns5':case'hem3':if(glu!==undefined){if(glu>=3.9)return 0;if(glu>=3.3)return 1;if(glu>=2.8)return 2;return 3}break;
    case'hem2':if(glu!==undefined&&glu>=7.0)return 2;if(glu!==undefined&&glu>=5.6)return 1;if(homa!==undefined){if(homa<2.0)return 0;if(homa<3.0)return 1;if(homa<5.0)return 2;return 3}break;
  }
  // Если механизм целевой для препарата (weight>0) — минимум m_i=1
  const result = Math.max(defaults, (mechWeight && mechWeight > 0) ? 1 : 0);
  return Math.min(3, result);
}

// ── ГЛАВНАЯ ФУНКЦИЯ РАСЧЁТА ──
export function calculateTzSpecRisk(input: TzSpecInput): TzSpecResult {
  const{duration,combinations,labCoverage,labValues,supportSubstances}=input;
  const T_i=getDurationFactor(duration);const C_i=getCombinationFactor(combinations);
  const U_i=getPenaltyFactor(labCoverage);

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

      // Суммируем вклад КАЖДОГО препарата в этот механизм
      for(const drug of drugEntries){
        const drugEntry=DRUG_DB[drug.drugName.toLowerCase()]||DRUG_DB[drug.drugName];
        const mechWeight=drugEntry?.mechanismWeights?.[mech.id]||0;
        if(mechWeight===0) continue; // Drug doesn't target this mechanism — skip
        const D_i=getDoseFactor(drug.dose,drug.drugClass)*(drugEntry?.doseModifier||1.0);
        const m_i=getMiFromLab(mech.id,labValues,D_i,mechWeight);
        const F_mech=mech.requiresF?getFormFactor(drug.form,sys.id):1.0;
        const C_mech=mech.requiresC?C_i:1.0;
        // ТЗ п.10.5: rep5 = w × m × T (без D)
        const D_eff=mech.requiresD?D_i:1.0;
        const E_i=D_eff*T_i*F_mech*C_mech;
        // mechWeight/4 scales drug contribution: weight=4→1.0, weight=2→0.5, weight=1→0.25
        mechRaw+=mech.weight*(mechWeight/4)*m_i*E_i;
      }

      // Штраф за отсутствие анализов
      mechRaw*=U_i;

      // Π(1 - k*_ij) — поддержка применяется к сумме
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
      mechAfter=mechRaw*productK;

      totalBefore+=mechRaw;totalAfter+=mechAfter;
      const mechId=mech.id;
      mechResults.push({
        id:mechId,name:TZ_MECH_LABELS[mechId]||mechId,weight:mech.weight,
        m_i:Math.round(mechRaw/(mech.weight*U_i*T_i*C_i||1)), // обратная прикидка среднего m
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

