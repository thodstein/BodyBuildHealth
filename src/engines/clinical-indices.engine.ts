import { LabPoint } from '../core/types';
import { UCUM_MAP } from '../core/constants';

export interface ClinicalIndices {
  homaIR: { value: number; status: 'normal'|'ir'|'severe_ir'; ref: [number, number]; alert?: string };
  fai: { value: number; status: 'normal'|'low'|'high'; ref: [number, number] };
  freeTestosterone: { value: number; unit: string; status: 'normal'|'low'|'high'; ref: [number, number] };
  egfr: { value: number; status: 'normal'|'g2'|'g3a'|'g3b'|'g4'|'g5'; ref: [number, number]; alert?: string };
  deritis: { value: number; status: 'normal'|'alcohol'|'viral'; ref: [number, number] };
  ldlHdlRatio: { value: number; status: 'optimal'|'moderate'|'high'; ref: [number, number] };
  tgHdlRatio: { value: number; status: 'optimal'|'ir'; ref: [number, number] };
}

function getLatest(labs: LabPoint[], code: string): number | undefined {
  const found = labs.filter(l => l.code.toUpperCase() === code).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return found.length ? found[0].value : undefined;
}

export function calculateIndices(labs: LabPoint[], sex: 'male'|'female' = 'male', age: number = 30): ClinicalIndices {
  const glu = getLatest(labs, 'GLU') || 5.0;
  const ins = getLatest(labs, 'INS') || 6.0;
  const tt = getLatest(labs, 'TT') || 550;
  const shbg = getLatest(labs, 'SHBG') || 35;
  const creat = getLatest(labs, 'CREATININE') || 88;
  const ast = getLatest(labs, 'AST') || 25;
  const alt = getLatest(labs, 'ALT') || 20;
  const ldl = getLatest(labs, 'LDL') || 3.0;
  const hdl = getLatest(labs, 'HDL') || 1.2;
  const tg = getLatest(labs, 'TG') || 1.0;
  const alb = getLatest(labs, 'ALB') || 45; // г/л

  // HOMA-IR = (Глюкоза ммоль/л * Инсулин мкЕд/мл) / 22.5
  const homaVal = (glu * ins) / 22.5;
  const homaIR: ClinicalIndices['homaIR'] = {
    value: parseFloat(homaVal.toFixed(2)),
    status: homaVal > 2.7 ? 'severe_ir' : homaVal > 2.0 ? 'ir' : 'normal',
    ref: [0.5, 2.7],
    alert: homaVal > 2.7 ? '⚠️ Инсулинорезистентность. Рассмотреть метформин/берберин.' : undefined
  };

  // FAI = (TT_nmL / SHBG) * 100, TT converted from ng/dL to nmol/L
  const faiVal = (tt * 0.0347 / shbg) * 100;
  const faiRef = sex === 'male' ? [35, 75] : [20, 55];
  const fai: ClinicalIndices['fai'] = {
    value: parseFloat(faiVal.toFixed(1)),
    status: faiVal < faiRef[0] ? 'low' : faiVal > faiRef[1] ? 'high' : 'normal',
    ref: faiRef as [number, number]
  };

  // Free Testosterone (Vermeulen approximation)
  // TT in nmol/L, SHBG in nmol/L, ALB in g/dL
  const tt_nmol_L = tt * 0.0347;
  const alb_g_dL = alb / 10;
  const ft4Val = tt_nmol_L / (1 + 0.81 * shbg + 0.026 * alb_g_dL);
  const ftRef = sex === 'male' ? [170, 450] : [50, 180];
  const freeTestosterone: ClinicalIndices['freeTestosterone'] = {
    value: parseFloat(ft4Val.toFixed(1)),
    unit: 'ng/dL',
    status: ft4Val < ftRef[0] ? 'low' : ft4Val > ftRef[1] ? 'high' : 'normal',
    ref: ftRef as [number, number]
  };

  // eGFR (CKD-EPI 2021) — convert creatinine from µmol/L to mg/dL
  const creat_mg_dL = creat / 88.42;
  const k = sex === 'female' ? 0.7 : 0.9;
  const a = sex === 'female' ? -0.329 : -0.411;
  const egfrVal = 142 * Math.pow(Math.min(creat_mg_dL/k, 1), a) * Math.pow(Math.max(creat_mg_dL/k, 1), -1.2) * 0.9938 ** age * (sex === 'female' ? 1.012 : 1);
  const egfrStatus = egfrVal >= 90 ? 'normal' : egfrVal >= 60 ? 'g2' : egfrVal >= 45 ? 'g3a' : egfrVal >= 30 ? 'g3b' : egfrVal >= 15 ? 'g4' : 'g5';
  const egfr: ClinicalIndices['egfr'] = {
    value: parseFloat(egfrVal.toFixed(1)),
    status: egfrStatus,
    ref: [90, 120],
    alert: egfrStatus !== 'normal' ? '⚠️ Снижение СКФ. Контроль гидратации, исключение НПВС.' : undefined
  };

  // De Ritis (AST/ALT)
  const derVal = ast / alt;
  const deritis: ClinicalIndices['deritis'] = {
    value: parseFloat(derVal.toFixed(2)),
    status: derVal > 2 ? 'alcohol' : derVal < 1 ? 'viral' : 'normal',
    ref: [0.8, 1.5]
  };

  // LDL/HDL & TG/HDL
  const ldlHdl: ClinicalIndices['ldlHdlRatio'] = {
    value: parseFloat((ldl/hdl).toFixed(2)),
    status: ldl/hdl < 2.5 ? 'optimal' : ldl/hdl < 4.0 ? 'moderate' : 'high',
    ref: [1.0, 3.5]
  };
  const tgHdl: ClinicalIndices['tgHdlRatio'] = {
    value: parseFloat((tg/hdl).toFixed(2)),
    status: tg/hdl < 1.5 ? 'optimal' : 'ir',
    ref: [0.5, 1.5]
  };

  return { homaIR, fai, freeTestosterone, egfr, deritis, ldlHdlRatio: ldlHdl, tgHdlRatio: tgHdl };
}