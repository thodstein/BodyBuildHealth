// ════════════════════════════════════════════════════════════════════════════
//  REBOUND MODELING ENGINE — Post-cycle recovery trajectories
//  Аналитическая модель восстановления гормонов после отмены ААС
// ════════════════════════════════════════════════════════════════════════════

import { derivePEDFlags } from './ped-potency-table';

export type ReboundMarker = 'TT' | 'FT' | 'E2' | 'PRL' | 'LH' | 'FSH' | 'CORTISOL' | 'SHBG';

export interface ReboundCurvePoint {
  week: number;
  value: number;
  baseline: number;
  isRecovered: boolean;
  phase: 'elimination' | 'rebound' | 'recovery' | 'overshoot' | 'stable';
}

export interface ReboundTrajectory {
  marker: ReboundMarker;
  baseline: number;           // pre-cycle value
  onCycle: number;            // typical on-cycle value
  nadir: number;              // lowest value (for suppressive markers)
  peak: number;               // peak value (for rebound markers)
  eliminationHalfLife: number; // weeks
  recoveryHalfLife: number;   // weeks
  overshootFactor: number;    // 1.0 = no overshoot, >1 = overshoot
  curve: ReboundCurvePoint[]; // 0..24 weeks
  recoveredWeek: number | null;
  overshootWeek: number | null;
  clinicalNotes: string[];
}

export interface ReboundProfile {
  tt: ReboundTrajectory;
  ft: ReboundTrajectory;
  e2: ReboundTrajectory;
  prl: ReboundTrajectory;
  lh: ReboundTrajectory;
  fsh: ReboundTrajectory;
  cortisol: ReboundTrajectory;
  shbg: ReboundTrajectory;
  overallRecoveryWeek: number;
  hptaRecoveryWeek: number;
  riskFlags: string[];
}

export interface ReboundInput {
  peds: Array<{
    id: string;
    pClass: string;
    mgPerWeek?: number;
    iuPerDay?: number;
    mcgPerDay?: number;
  }>;
  cycleWeeks: number;
  pctProtocol?: 'clomid' | 'nolva' | 'clomid+nolva' | 'hcg+clomid' | 'hcg+nolva' | 'none';
  pctStartWeek?: number;     // when PCT starts after last pin (default: based on esters)
  userProfile: {
    age: number;
    baselineTT: number;
    baselineE2: number;
    baselinePRL: number;
    baselineCortisol: number;
    baselineSHBG: number;
    baselineLH: number;
    baselineFSH: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
//  CONSTANTS — Pharmacokinetic & Recovery parameters
// ──────────────────────────────────────────────────────────────────────────────

const ESTER_HALFLIFE: Record<string, number> = {
  // esters in days
  acetate: 1,
  propionate: 2,
  phenylpropionate: 3,
  enanthate: 7,
  cypionate: 8,
  decanoate: 10,
  undecanoate: 16,
  undecylenate: 10.5,
  tren_acetate: 1,
  tren_enanthate: 7,
  tren_hex: 10,
  bold_undecylenate: 10.5,
  npp: 3,
  deca: 10,
  ment_acetate: 1,
  test_no_ester: 0.5,
  test_suspension: 0.25,
};

// Suppression factors (relative to baseline) during active cycle
const SUPPRESSION_FACTOR: Record<string, number> = {
  TT: 0.05,     // total T suppressed to ~5% baseline
  FT: 0.1,      // free T
  E2: 1.5,      // E2 elevated due to aromatization
  PRL: 1.2,     // mild prolactin increase
  LH: 0.02,     // LH almost fully suppressed
  FSH: 0.02,    // FSH almost fully suppressed
  CORTISOL: 1.3, // cortisol elevated
  SHBG: 0.5,    // SHBG suppressed
};

// Recovery half-lives (weeks) after exogenous androgens cleared
const RECOVERY_HALFLIFE: Record<string, number> = {
  TT: 2,       // endogenous T recovery
  FT: 2,
  E2: 1.5,     // E2 normalizes faster (aromatase downregulation)
  PRL: 3,      // prolactin slow
  LH: 2.5,     // LH recovery
  FSH: 3,      // FSH slower than LH
  CORTISOL: 1, // cortisol fast
  SHBG: 2,     // SHBG recovery
};

// Overshoot factors (rebound above baseline)
const OVERSHOOT_FACTOR: Record<string, number> = {
  TT: 1.0,     // no overshoot typically
  FT: 1.0,
  E2: 1.5,     // estrogen rebound (aromatase upregulation)
  PRL: 1.3,    // prolactin rebound
  LH: 1.2,     // LH overshoot
  FSH: 1.2,    // FSH overshoot
  CORTISOL: 1.1,
  SHBG: 1.1,
};

// PCT enhancement factors (multiplier to recovery rate)
const PCT_ENHANCEMENT: Record<string, Record<string, number>> = {
  'clomid': { TT: 1.5, LH: 1.8, FSH: 1.6, E2: 0.8 },
  'nolva':  { TT: 1.3, LH: 1.5, FSH: 1.4, E2: 0.7 },
  'clomid+nolva': { TT: 1.8, LH: 2.0, FSH: 1.8, E2: 0.7 },
  'hcg+clomid': { TT: 2.0, LH: 1.5, FSH: 1.5, E2: 0.8 },
  'hcg+nolva': { TT: 1.8, LH: 1.3, FSH: 1.4, E2: 0.7 },
  'none': {},
};

// ──────────────────────────────────────────────────────────────────────────────
//  HELPER FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

function getLongestEsterHalfLife(peds: ReboundInput['peds']): number {
  let maxDays = 0;
  for (const p of peds) {
    const ester = p.id.split('_').pop() || '';
    const days = ESTER_HALFLIFE[ester] || 7;
    if (days > maxDays) maxDays = days;
  }
  return maxDays / 7; // convert to weeks
}

function computeEsterClearanceWeeks(peds: ReboundInput['peds']): number {
  // 5 half-lives for >96% clearance
  const maxHL = getLongestEsterHalfLife(peds);
  return maxHL * 5;
}

function exponentialDecay(initial: number, target: number, halfLife: number, time: number): number {
  if (halfLife <= 0) return target;
  const k = Math.log(2) / halfLife;
  return target + (initial - target) * Math.exp(-k * time);
}

function exponentialRecovery(nadir: number, baseline: number, halfLife: number, time: number, overshoot: number): number {
  if (halfLife <= 0) return baseline * overshoot;
  const k = Math.log(2) / halfLife;
  const recovered = baseline + (nadir - baseline) * Math.exp(-k * time);
  // Add overshoot component (peaks at ~2 half-lives, then decays)
  const overshootMagnitude = (baseline * overshoot - baseline) * Math.exp(-0.5 * k * time) * (1 - Math.exp(-k * time));
  return Math.min(recovered + overshootMagnitude, baseline * overshoot);
}

function applyPCTEnhancement(recoveryHL: number, pctProtocol: string): number {
  const enh = PCT_ENHANCEMENT[pctProtocol] || {};
  // Average enhancement across markers for this protocol
  const avg = Object.values(enh).reduce((a, b) => a + b, 0) / (Object.keys(enh).length || 1);
  return recoveryHL / Math.max(1, avg);
}

function getEsterClearanceStart(pctStartWeek?: number, esterClearanceWeeks?: number): number {
  // PCT typically starts after ester clearance
  return (pctStartWeek || 0) + (esterClearanceWeeks || 0);
}

// ──────────────────────────────────────────────────────────────────────────────
//  MAIN REBOUND CALCULATION
// ──────────────────────────────────────────────────────────────────────────────

export function calculateReboundTrajectory(input: ReboundInput): ReboundProfile {
  const { peds, cycleWeeks, pctProtocol = 'none', pctStartWeek, userProfile } = input;
  
  // Determine PCT start
  const esterClearance = computeEsterClearanceWeeks(peds);
  const actualPctStart = pctStartWeek || Math.ceil(cycleWeeks + esterClearance);
  const pctEnh = PCT_ENHANCEMENT[pctProtocol] || {};
  
  // Apply PCT enhancement to recovery half-lives
  const enhancedRecoveryHL: Record<string, number> = {};
  for (const [marker, baseHL] of Object.entries(RECOVERY_HALFLIFE)) {
    const enhFactor = pctEnh[marker] || 1.0;
    enhancedRecoveryHL[marker] = baseHL / enhFactor;
  }

  // Estrogen rebound specific: depends on AI use and aromatizable AAS
  const hasAromatizable = peds.some(p => 
    p.pClass.startsWith('aas_test') || 
    p.pClass === 'aas_nandrolone' || 
    p.pClass === 'aas_bold' ||
    p.pClass === 'aas_dht_inject'
  );
  
  // Prolactin specific: nandrolone/tren
  const hasPRLRisk = peds.some(p => 
    p.pClass === 'aas_nandrolone' || p.pClass === 'aas_tren'
  );
  
  // Cortisol: GH, tren, high dose AAS
  const hasCortisolRisk = peds.some(p => 
    p.pClass === 'gh' || p.pClass === 'aas_tren' || (p.mgPerWeek || 0) > 750
  );

  // ────────────────────────────────────────────────────────────────────────
  //  BUILD TRAJECTORIES FOR EACH MARKER
  // ────────────────────────────────────────────────────────────────────────
  
  const totalWeeks = 24; // 6 months follow-up
  
  function buildCurve(
    marker: ReboundMarker,
    baseline: number,
    onCycle: number,
    eliminationHL: number,     // weeks for exogenous clearance
    recoveryHL: number,        // weeks for endogenous recovery
    overshoot: number,
    isSuppressive: boolean,    // true = suppressed on cycle, false = elevated
    nadirFactor: number,       // how deep it goes (for suppressive)
    peakFactor: number,        // how high it peaks (for elevated)
    pctStartOffset: number = 0 // weeks after cycle end when PCT starts
  ): ReboundTrajectory {
    
    const curve: ReboundCurvePoint[] = [];
    let nadir = onCycle;
    let peak = onCycle;
    
    if (isSuppressive) {
      nadir = baseline * nadirFactor;
    } else {
      peak = baseline * peakFactor;
    }
    
    const pctStartWeek = actualPctStart + pctStartOffset;
    
    for (let w = 0; w <= totalWeeks; w++) {
      let value: number;
      let phase: ReboundCurvePoint['phase'];
      let isRecovered = false;
      
      if (w < cycleWeeks) {
        // ON CYCLE
        value = onCycle;
        phase = 'elimination';
      } else if (w < actualPctStart) {
        // POST-CYCLE, PRE-PCT: Exogenous elimination phase
        const t = w - cycleWeeks; // weeks since last injection
        if (isSuppressive) {
          value = exponentialDecay(nadir, baseline, eliminationHL, t);
          phase = value < baseline * 0.2 ? 'elimination' : 'recovery';
        } else {
          value = exponentialDecay(peak, baseline, eliminationHL, t);
          phase = value > baseline * 1.5 ? 'rebound' : 'recovery';
        }
} else {
        // PCT / RECOVERY PHASE
        const t = w - actualPctStart; // weeks since PCT start
        const enhHL = enhancedRecoveryHL[marker] || RECOVERY_HALFLIFE[marker] || 2;
        
        // Compute value at PCT start (end of pre-PCT exogenous elimination phase)
        const prePctDuration = actualPctStart - cycleWeeks;
        let pctStartValue: number;
        if (isSuppressive) {
          pctStartValue = exponentialDecay(nadir, baseline, eliminationHL, prePctDuration);
        } else {
          pctStartValue = exponentialDecay(peak, baseline, eliminationHL, prePctDuration);
        }
        
        if (isSuppressive) {
          // Suppressive markers: recover FROM pctStartValue TO baseline (with overshoot)
          value = exponentialRecovery(pctStartValue, baseline, enhHL, t, OVERSHOOT_FACTOR[marker]);
        } else {
          // Elevated markers: decay FROM pctStartValue TO baseline (no overshoot)
          value = exponentialDecay(pctStartValue, baseline, enhHL, t);
        }
        
        // Determine phase
        const diff = Math.abs(value - baseline);
        const threshold = baseline * 0.15;
        isRecovered = diff <= threshold && w >= actualPctStart + 2;
        
        if (isSuppressive) {
          if (value > baseline * 1.15 && OVERSHOOT_FACTOR[marker] > 1.05) phase = 'overshoot';
          else if (isRecovered) phase = 'stable';
          else if (w < actualPctStart + 4) phase = 'recovery';
          else phase = 'recovery';
        } else {
          // Elevated markers: no overshoot phase
          if (isRecovered) phase = 'stable';
          else if (value > baseline * 1.5) phase = 'rebound';
          else phase = 'recovery';
        }
      }
      
      curve.push({
        week: w,
        value: Math.max(0, Math.round(value * 100) / 100),
        baseline,
        isRecovered,
        phase,
      });
    }
    
    // Find recovery/overshoot weeks
    const recoveredPoint = curve.find(p => p.isRecovered);
    const overshootPoint = curve.find(p => p.phase === 'overshoot');
    
    return {
      marker,
      baseline,
      onCycle,
      nadir: isSuppressive ? baseline * (nadirFactor || 0.05) : baseline,
      peak: !isSuppressive ? baseline * (peakFactor || 1.5) : baseline,
      eliminationHalfLife: 1.5, // generic
      recoveryHalfLife: enhancedRecoveryHL[marker] || 2,
      overshootFactor: isSuppressive ? overshoot : 1.0,
      curve,
      recoveredWeek: recoveredPoint?.week || null,
      overshootWeek: isSuppressive ? (overshootPoint?.week || null) : null,
      clinicalNotes: generateClinicalNotes(marker, curve, baseline),
    };
  }
  
  // Build all trajectories
  const tt = buildCurve('TT', userProfile.baselineTT, 
    SUPPRESSION_FACTOR.TT * userProfile.baselineTT, 
    1.5, enhancedRecoveryHL.TT || RECOVERY_HALFLIFE.TT, OVERSHOOT_FACTOR.TT, true, 0.05, 1.0, 0);
    
  const ft = buildCurve('FT', userProfile.baselineTT * 0.02, 
    SUPPRESSION_FACTOR.FT * userProfile.baselineTT * 0.02, 
    1.5, enhancedRecoveryHL.FT || RECOVERY_HALFLIFE.FT, OVERSHOOT_FACTOR.FT, true, 0.1, 1.0, 0);
    
  const e2 = buildCurve('E2', userProfile.baselineE2, 
    userProfile.baselineE2 * (hasAromatizable ? 2.5 : 1.2), 
    1.5, enhancedRecoveryHL.E2 || RECOVERY_HALFLIFE.E2, OVERSHOOT_FACTOR.E2, false, 0, 2.5, 0);
    
  const prl = buildCurve('PRL', userProfile.baselinePRL, 
    userProfile.baselinePRL * (hasPRLRisk ? 1.8 : 1.1), 
    1.5, enhancedRecoveryHL.PRL || RECOVERY_HALFLIFE.PRL, OVERSHOOT_FACTOR.PRL, false, 0, 1.8, 0);
    
  const lh = buildCurve('LH', userProfile.baselineLH, 
    SUPPRESSION_FACTOR.LH * userProfile.baselineLH, 
    1.5, enhancedRecoveryHL.LH || RECOVERY_HALFLIFE.LH, OVERSHOOT_FACTOR.LH, true, 0.02, 1.0, 0);
    
  const fsh = buildCurve('FSH', userProfile.baselineFSH, 
    SUPPRESSION_FACTOR.FSH * userProfile.baselineFSH, 
    1.5, enhancedRecoveryHL.FSH || RECOVERY_HALFLIFE.FSH, OVERSHOOT_FACTOR.FSH, true, 0.02, 1.0, 0);
    
  const cortisol = buildCurve('CORTISOL', userProfile.baselineCortisol, 
    userProfile.baselineCortisol * (hasCortisolRisk ? 1.5 : 1.2), 
    1, enhancedRecoveryHL.CORTISOL || RECOVERY_HALFLIFE.CORTISOL, OVERSHOOT_FACTOR.CORTISOL, false, 0, 1.5, 0);
    
  const shbg = buildCurve('SHBG', userProfile.baselineSHBG, 
    SUPPRESSION_FACTOR.SHBG * userProfile.baselineSHBG, 
    1.5, enhancedRecoveryHL.SHBG || RECOVERY_HALFLIFE.SHBG, OVERSHOOT_FACTOR.SHBG, true, 0.5, 1.0, 0);

  // ────────────────────────────────────────────────────────────────────────
  //  SUMMARY METRICS
  // ────────────────────────────────────────────────────────────────────────
  
  const allRecoveredWeeks = [
    tt.recoveredWeek, ft.recoveredWeek, e2.recoveredWeek, prl.recoveredWeek,
    lh.recoveredWeek, fsh.recoveredWeek, cortisol.recoveredWeek, shbg.recoveredWeek
  ].filter(w => w !== null) as number[];
  
  const overallRecoveryWeek = allRecoveredWeeks.length ? Math.max(...allRecoveredWeeks) : null;
  
  // HPTA recovery = LH + FSH + TT recovered
  const hptaWeeks = [lh.recoveredWeek, fsh.recoveredWeek, tt.recoveredWeek].filter(w => w !== null) as number[];
  const hptaRecoveryWeek = hptaWeeks.length ? Math.max(...hptaWeeks) : null;
  
  const riskFlags = generateRiskFlags(input, { tt, e2, prl, lh, fsh, cortisol });
  
  return {
    tt, ft, e2, prl, lh, fsh, cortisol, shbg,
    overallRecoveryWeek,
    hptaRecoveryWeek,
    riskFlags,
  };
}

function generateClinicalNotes(marker: ReboundMarker, curve: ReboundCurvePoint[], baseline: number): string[] {
  const notes: string[] = [];
  const max = Math.max(...curve.map(c => c.value));
  const min = Math.min(...curve.map(c => c.value));
  const overshoot = curve.find(c => c.phase === 'overshoot');
  const recovered = curve.find(c => c.isRecovered);
  
  if (overshoot) {
    notes.push(`${marker}: overshoot до ${overshoot.value} (${Math.round(overshoot.value/baseline*100)}% от базового) на нед ${overshoot.week}`);
  }
  if (recovered) {
    notes.push(`${marker}: восстановление к базовому к нед ${recovered.week}`);
  }
  if (marker === 'E2' && max > baseline * 2) {
    notes.push('E2: высокий риск ребаунд-гинекомастии — рассмотреть AI титрацию в первые 4-6 нед ПКТ');
  }
  if (marker === 'PRL' && max > 25) {
    notes.push('PRL: пролактин выше 25 нг/мл — добавить каберголин/витекс/вит.B6');
  }
  if (marker === 'CORTISOL' && max > 700) {
    notes.push('Кортизол: риск катаболизма/гипертонии — добавить ашваганда/фосфатидилсерин/магний');
  }
  if (marker === 'TT' && recovered && recovered.week > 16) {
    notes.push('TT: затяжное восстановление (>16 нед) — оценить hCG-стимуляционный тест, TRT discussion');
  }
  return notes;
}

function generateRiskFlags(
  input: ReboundInput, 
  trajectories: { tt: any; e2: any; prl: any; lh: any; fsh: any; cortisol: any }
): string[] {
  const flags: string[] = [];
  const { peds, cycleWeeks, pctProtocol = 'none' } = input;
  
  // Multi-oral hepatotoxicity
  const oral17Count = peds.filter(p => p.pClass === 'aas_oral_17aa' || p.pClass.startsWith('aas_oral_')).length;
  if (oral17Count >= 2) flags.push('⚠ Multi-oral 17α: кумулятивная гепатотоксичность — добавить TUDCA+NAC+силимарин, LFT каждые 2 нед');
  
  // Long cycle
  if (cycleWeeks > 16) flags.push('⚠ Цикл >16 нед: риск затяжного HPTA shutdown — обязателен hCG в цикле + агрессивный ПКТ');
  
  // No PCT
  if (pctProtocol === 'none') flags.push('❌ ПКТ не назначен: риск постциклического краха, депрессии, потери мышц — настоятельно рекомендуется ПКТ');
  
  // High dose testosterone
  const testDose = peds.filter(p => p.pClass === 'aas_test').reduce((s, p) => s + (p.mgPerWeek || 0), 0);
  if (testDose >= 1000) flags.push('⚠ Высокая доза теста (>1000 мг/нед): риск полицитемии, липидного профиля, Э2 — агрессивный AI + флеботомия');
  
  // Trenbolone
  if (peds.some(p => p.pClass === 'aas_tren')) flags.push('⚠ Тренболон: нейротоксичность, пролактин, инсулинорезистентность — каберголин/витекс/B6 + берберин + магний');
  
  // Nandrolone + prolactin
  if (peds.some(p => p.pClass === 'aas_nandrolone')) flags.push('⚠ Нандролон: пролактин + дека-дик — каберголин/витекс/вит.B6 + контроль Э2');
  
  // High E2 risk
  const hasAromatizable = peds.some(p => 
    p.pClass.startsWith('aas_test') || p.pClass === 'aas_nandrolone' || p.pClass === 'aas_bold' || p.pClass === 'aas_dht_inject'
  );
  if (hasAromatizable && peds.some(p => p.pClass.startsWith('aas_test') && (p.mgPerWeek || 0) > 500)) {
    flags.push('⚠ Высокий риск Э2-ребаунда: агрессивная титрация AI (анастрозол 0.5-1 мг/ед, есть 2р/нед) в первые 4 нед ПКТ');
  }
  
  // GH + insulin
  if (peds.some(p => p.pClass === 'gh') && peds.some(p => p.pClass === 'insulin')) {
    flags.push('⚠ GH + Инсулин: тяжёлая ИР + гипогликемия — берберин 2г + метформин + α-липоевка + глюкометр');
  }
  
  return flags;
}

// ──────────────────────────────────────────────────────────────────────────────
//  PUBLIC API
// ──────────────────────────────────────────────────────────────────────────────

export function runReboundModel(input: ReboundInput): ReboundProfile {
  return calculateReboundTrajectory(input);
}

export function getReboundSummary(profile: ReboundProfile): string {
  const lines: string[] = [
    `=== REBOUND ANALYSIS ===`,
    `Overall recovery: ${profile.overallRecoveryWeek ? `${profile.overallRecoveryWeek} нед` : 'не восстановлен'}`,
    `HPTA recovery: ${profile.hptaRecoveryWeek ? `${profile.hptaRecoveryWeek} нед` : 'не восстановлен'}`,
    ``,
    `TT: nadir ${profile.tt.nadir.toFixed(1)} → rec ${profile.tt.recoveredWeek || '?'} нед`,
    `E2: peak ${profile.e2.peak.toFixed(1)} → rec ${profile.e2.recoveredWeek || '?'} нед ${profile.e2.overshootWeek ? `(overshoot нед ${profile.e2.overshootWeek})` : ''}`,
    `PRL: peak ${profile.prl.peak.toFixed(1)} → rec ${profile.prl.recoveredWeek || '?'} нед`,
    `LH: nadir ${profile.lh.nadir.toFixed(1)} → rec ${profile.lh.recoveredWeek || '?'} нед`,
    `CORT: peak ${profile.cortisol.peak.toFixed(1)} → rec ${profile.cortisol.recoveredWeek || '?'} нед`,
  ];
  if (profile.riskFlags.length) {
    lines.push(``, `RISK FLAGS:`, ...profile.riskFlags.map(f => `  ${f}`));
  }
  return lines.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
//  EXPORTS
// ──────────────────────────────────────────────────────────────────────────────

export type { ReboundInput, ReboundProfile, ReboundTrajectory, ReboundCurvePoint, ReboundMarker };