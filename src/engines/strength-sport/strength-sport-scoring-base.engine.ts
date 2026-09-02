/**
 * strength-sport-scoring-base.engine.ts — общий RSS скорер для ТА и стронга (убирает дубль 40с)
 */

export type ScoreLevel = 'ok'|'warn'|'critical';
export interface BaseScoringInput { weakCount?: number; asymPct?: number | null; vbtLoss?: number | null; mobilityFails?: number | null; }
export interface BaseScoringResult { rss: number; score: number; level: ScoreLevel; penalties: number[]; verification: number; floors: string[]; findings: Array<{ level: ScoreLevel; text: string }>; }

export const PENALTY_BASE = { weak:12, asymWarn:14, asymCrit:28, vbtWarn:10, vbtCrit:20, mob:8 };

export function scoreBase(input: {
  weakCount?: number;
  asymmetryPct?: number | null;
  vbtLossPct?: number | null;
  mobilityFails?: number | null;
  extraPenalties?: number[]; // carrySway, grip, axial, imtp etc
  floors?: string[];
  findings?: Array<{ level: ScoreLevel; text: string }>;
  hasVideo?: boolean; hasVbt?: boolean; hasMobility?: boolean; hasGrip?: boolean;
  verificationWeights?: { video: number; vbt: number; mobility: number; grip: number };
}): BaseScoringResult {
  const penalties: number[] = [];
  const findings: Array<{ level: ScoreLevel; text: string }> = input.findings ? [...input.findings] : [];
  const floors: string[] = input.floors ? [...input.floors] : [];
  const wc = input.weakCount ?? 0;
  for (let i=0;i<wc;i++) penalties.push(PENALTY_BASE.weak);
  if (wc>0) findings.push({ level: wc>=3?'critical':'warn', text:`${wc} слабые` }); else findings.push({level:'ok', text:'Баланс'});
  if (input.asymmetryPct != null) {
    if (input.asymmetryPct >=12) { penalties.push(PENALTY_BASE.asymCrit); findings.push({level:'critical', text:`Асимметрия ${input.asymmetryPct}%`}); floors.push('Асимметрия ≥12%'); }
    else if (input.asymmetryPct >=7) { penalties.push(PENALTY_BASE.asymWarn); findings.push({level:'warn', text:`Асимметрия ${input.asymmetryPct}%`}); }
    else findings.push({level:'ok', text:`Асимметрия ${input.asymmetryPct}%`});
  }
  if (input.vbtLossPct != null) {
    if (input.vbtLossPct >=20) { penalties.push(PENALTY_BASE.vbtCrit); findings.push({level:'critical', text:`VBT ${input.vbtLossPct}%`}); floors.push('VBT ≥20%'); }
    else if (input.vbtLossPct >=10) { penalties.push(PENALTY_BASE.vbtWarn); findings.push({level:'warn', text:`VBT ${input.vbtLossPct}%`}); }
    else findings.push({level:'ok', text:`VBT ${input.vbtLossPct}%`});
  }
  if (input.mobilityFails != null && input.mobilityFails>0) {
    for (let i=0;i<input.mobilityFails;i++) penalties.push(PENALTY_BASE.mob);
    findings.push({level: input.mobilityFails>=3?'critical':'warn', text:`OHS ${input.mobilityFails}/6`});
  } else if (input.mobilityFails===0) findings.push({level:'ok', text:'OHS ok'});
  if (input.extraPenalties?.length) penalties.push(...input.extraPenalties);
  const rss = penalties.length ? Math.sqrt(penalties.reduce((s,p)=>s+p*p,0)) : 0;
  let score = Math.round(100 - rss);
  score = Math.max(0, Math.min(100, score));
  if (floors.length && score>49) score = 49;
  const level: ScoreLevel = score>=80?'ok': score>=50?'warn':'critical';
  const w = input.verificationWeights ?? { video:0.30, vbt:0.30, mobility:0.20, grip:0.20 };
  let verification = 0;
  if (input.hasVideo) verification+=w.video;
  if (input.hasVbt) verification+=w.vbt;
  if (input.hasMobility) verification+=w.mobility;
  if (input.hasGrip) verification+=w.grip;
  verification = Math.round(verification*100)/100;
  return { rss: Math.round(rss*10)/10, score, level, penalties, verification, floors, findings };
}

export function scoreColor(level: ScoreLevel): string { return level==='ok'?'#22c55e': level==='warn'?'#f59e0b':'#ef4444'; }
