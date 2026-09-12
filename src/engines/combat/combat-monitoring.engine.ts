/**
 * combat-monitoring.engine.ts — ACWR / HRV / VBT для единоборств.
 * Изолировано. Не трогает bb/strength.
 */

export type ACWRZone = 'optimal' | 'caution' | 'dangerous' | 'undertrained';
export interface ACWRReport { acute: number; chronic: number; ratio: number; zone: ACWRZone; recommendation: string; }

export function combatACWR(acuteLoad: number, chronicLoad: number): ACWRReport {
  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : acuteLoad > 0 ? 2 : 1;
  let zone: ACWRZone = 'optimal';
  let rec = 'Нагрузка в оптимуме (0.8-1.3) — продолжайте.';
  if (ratio < 0.8) { zone = 'undertrained'; rec = 'Недогруз <0.8 — добавьте 10% объёма или 1 сессию.'; }
  else if (ratio > 1.5) { zone = 'dangerous'; rec = 'Перегруз >1.5 — делод 40% объёма, RIR+2, сон 8ч+.'; }
  else if (ratio > 1.3) { zone = 'caution'; rec = 'Погранично 1.3-1.5 — снизьте объём 15%, RIR+1.'; }
  return { acute: Math.round(acuteLoad), chronic: Math.round(chronicLoad), ratio: Math.round(ratio*100)/100, zone, recommendation: rec };
}

export function combatACWRFromLoads(dailyLoads: number[]): ACWRReport | null {
  if (!Array.isArray(dailyLoads) || dailyLoads.length < 7) return null;
  const acute = dailyLoads.slice(-7).reduce((a,b)=>a+b,0);
  const chronic = dailyLoads.slice(-28).reduce((a,b)=>a+b,0) /4; // 28д среднее ~ acute
  // если <28д — берём среднее имеющегося
  const chronicAvg = dailyLoads.length >= 28 ? chronic : dailyLoads.reduce((a,b)=>a+b,0) / Math.max(1, dailyLoads.length) *7;
  return combatACWR(acute, chronicAvg);
}

// ── P6 PRO: честный ACWR — EWMA-uncoupled дефолт (BMC meta 2025: EWMA чувствительнее
// на высоких; uncoupled чище — острая неделя не входит в хроническую).
// RA-coupled (выше) оставлен фолбэком при <14д истории. ──

function ewmaLast(vals: number[], n: number): number | null {
  const clean = vals.filter(v => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  if (!clean.length) return null;
  const lambda = 2 / (n + 1);
  let ew = clean[0];
  for (let i = 1; i < clean.length; i++) ew = clean[i] * lambda + ew * (1 - lambda);
  return ew;
}

function zoneForRatio(ratio: number): { zone: ACWRZone; recommendation: string } {
  if (ratio < 0.8) return { zone: 'undertrained', recommendation: 'Недогруз <0.8 — добавьте 10% объёма или 1 сессию.' };
  if (ratio > 1.5) return { zone: 'dangerous', recommendation: 'Перегруз >1.5 — делод 40% объёма, RIR+2, сон 8ч+.' };
  if (ratio > 1.3) return { zone: 'caution', recommendation: 'Погранично 1.3-1.5 — снизьте объём 15%, RIR+1.' };
  return { zone: 'optimal', recommendation: 'Нагрузка в оптимуме (0.8-1.3) — продолжайте.' };
}

/**
 * EWMA-uncoupled ACWR по дневным нагрузкам (sRPE×мин, одна шкала).
 * Нужно ≥14 дневных точек; lowBase: хроника <100 AU/день → не выше caution
 * (хрупкая форма — резкие скачки опасны, даже при ratio 1.0).
 * Оговорка: в ударных видах травмы сидят и в sweet spot (тхэквондо-2025) — зона ориентир, не гарантия.
 */
export function combatACWRUncoupled(dailyLoads: number[]): (ACWRReport & { method: 'ewma_uncoupled'; lowBase: boolean }) | null {
  if (!Array.isArray(dailyLoads) || dailyLoads.length < 14) return null;
  const acuteVals = dailyLoads.slice(-7);
  const chronicVals = dailyLoads.slice(0, -7);
  const acute = ewmaLast(acuteVals, 7);
  const chronic = ewmaLast(chronicVals, 28);
  if (acute == null || chronic == null) return null;
  const ratio = chronic > 0 ? acute / chronic : acute > 0 ? 2 : 1;
  let { zone, recommendation } = zoneForRatio(ratio);
  let lowBase = false;
  if (chronic < 100 && zone === 'optimal') {
    zone = 'caution';
    lowBase = true;
    recommendation = 'База <100 AU/день — хрупкая форма: держите ratio 0.8–1.3 без скачков, EWMA-uncoupled.';
  }
  return {
    acute: Math.round(acute * 7), chronic: Math.round(chronic * 7),
    ratio: Math.round(ratio * 100) / 100, zone, recommendation, method: 'ewma_uncoupled', lowBase,
  };
}

/**
 * Честная точка входа: EWMA-uncoupled при ≥14д, иначе RA-coupled с пометкой.
 * Возвращает отчёт + метод + честное предупреждение о короткой истории.
 */
export function combatACWRHonest(dailyLoads: number[]): { report: ACWRReport | null; method: 'ewma_uncoupled' | 'ra_coupled'; shortHistory: boolean } {
  const ewma = combatACWRUncoupled(dailyLoads);
  if (ewma) return { report: ewma, method: 'ewma_uncoupled', shortHistory: false };
  const ra = combatACWRFromLoads(dailyLoads);
  return { report: ra, method: 'ra_coupled', shortHistory: true };
}

// VBT velocity zones (по %1RM) — Vitruve
const VBT_ZONES: Array<{ pct: [number, number]; velocity: [number, number]; quality: string }> = [
  { pct: [90, 100], velocity: [0.15, 0.35], quality: 'max_strength' },
  { pct: [80, 90], velocity: [0.35, 0.5], quality: 'strength' },
  { pct: [70, 80], velocity: [0.5, 0.75], quality: 'power' },
  { pct: [50, 70], velocity: [0.75, 1.0], quality: 'speed' },
  { pct: [0, 50], velocity: [1.0, 1.6], quality: 'speed_strength' },
];
export function vbtVelocityForPct(pct: number): { velocity: number; quality: string } | null {
  for (const z of VBT_ZONES) if (pct >= z.pct[0] && pct <= z.pct[1]) return { velocity: (z.velocity[0]+z.velocity[1])/2, quality: z.quality };
  return null;
}
export function vbtRecommendation(velocityLossPct: number): { action: string; rirAdd: number; volumeMult: number } {
  if (velocityLossPct > 30) return { action: 'Стоп сет: потеря >30% — техника ломается, завершить', rirAdd: 2, volumeMult: 0.6 };
  if (velocityLossPct > 25) return { action: 'Снизьте вес 5% и RIR+1, объём ×0.85', rirAdd: 1, volumeMult: 0.85 };
  if (velocityLossPct > 20) return { action: 'Контроль потери 20-25% — RIR+1', rirAdd: 1, volumeMult: 0.9 };
  if (velocityLossPct > 15) return { action: 'В пределах 15-20% — оптимально для силы', rirAdd: 0, volumeMult: 1 };
  return { action: 'Можно добавить 1 сет или +2.5кг', rirAdd: 0, volumeMult: 1.05 };
}

// HRV — простое правило: < mean-1SD → caution
export function hrvGrade(hrvMs: number, mean: number, sd: number): { grade: 'optimal'|'caution'|'dangerous'; note: string } {
  if (hrvMs < mean - sd) return { grade: 'dangerous', note: 'HRV < mean-1SD — недовосстановление, RIR+1, объём -15%' };
  if (hrvMs < mean - 0.5*sd) return { grade: 'caution', note: 'HRV снижен — мониторьте сон/стресс' };
  return { grade: 'optimal', note: 'HRV в норме' };
}

export function hrvFromHistory(history: number[]): { mean:number; sd:number; last:number } | null {
  if (!Array.isArray(history) || history.length < 7) return null;
  const vals = history.slice(-28).filter(v=> typeof v==='number' && v>10 && v<250);
  if (vals.length < 7) return null;
  const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
  const sd = Math.sqrt(vals.reduce((a,b)=> a + (b-mean)*(b-mean),0)/vals.length) || 8;
  const last = vals[vals.length-1];
  return { mean, sd, last };
}

export function loadHrvHistory(): number[] {
  try {
    for (const key of ['he_hrv_log','he_hrv_history','he_diary_hrv','he_hrv_log_v2','he_hrv_history_v2']) {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const nums = arr.map((x:any)=> typeof x==='number'? x : (x.hrvMs ?? x.hrv ?? x.value ?? x.ms)).filter((v:any)=> typeof v==='number');
          if (nums.length) return nums;
        }
      }
    }
    // cardio sessions содержат HRV точки (как в cardio-diary.engine)
    try {
      const csRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('he_cardio_sessions') : null;
      if (csRaw) {
        const cs = JSON.parse(csRaw);
        if (Array.isArray(cs)) {
          const nums = cs.map((x:any)=> x.hrv ?? x.hrvMs ?? x.HRV).filter((v:any)=> typeof v==='number' && v>10 && v<250);
          if (nums.length >= 7) return nums.slice(-28);
        }
      }
    } catch {}
    // srpe sessions тоже могут хранить hrv
    try {
      const srpeRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('he_srpe_sessions') : null;
      if (srpeRaw) {
        const sr = JSON.parse(srpeRaw);
        if (Array.isArray(sr)) {
          const nums = sr.map((x:any)=> x.hrvMs ?? x.hrv).filter((v:any)=> typeof v==='number' && v>10 && v<250);
          if (nums.length >= 7) return nums.slice(-28);
        }
      }
    } catch {}
    // fallback из профиля lifestyle — один замер → вернём его, EWMA сделает из него базу
    const pr = typeof localStorage !== 'undefined' ? localStorage.getItem('he_profile_v2') : null;
    if (pr) {
      const p = JSON.parse(pr);
      const v = p?.lifestyle?.morningHRV ?? p?.lifestyle?.hrvMs ?? p?.health?.hrvMs;
      if (typeof v==='number' && v>10 && v<250) return [v];
    }
  } catch {}
  return [];
}

export function combatLoadStatus(acwr: ACWRReport | null, hrvGradeResult: string | null, velocityLoss?: number | null): string[] {
  const notes: string[] = [];
  if (acwr) notes.push(`ACWR ${acwr.ratio} (${acwr.zone}): ${acwr.recommendation}`);
  if (hrvGradeResult) notes.push(`HRV: ${hrvGradeResult}`);
  if (typeof velocityLoss === 'number') notes.push(`VBT потеря ${velocityLoss}%: ${vbtRecommendation(velocityLoss).action}`);
  return notes;
}

export function combatHrvReport(): { grade:'optimal'|'caution'|'dangerous'; note:string; mean:number; sd:number; last:number } | null {
  const hist = loadHrvHistory();
  const h = hrvFromHistory(hist);
  if (!h) return null;
  const g = hrvGrade(h.last, h.mean, h.sd);
  return { ...g, mean: Math.round(h.mean), sd: Math.round(h.sd), last: h.last };
}

/**
 * P6: честный HRV-отчёт с источником. Один замер → optimal условно с пометкой
 * «ведите 7+ дней» (раньше — молчаливый null, UI ничего не показывал).
 */
export function combatHrvReportWithSource(): {
  grade: 'optimal' | 'caution' | 'dangerous'; note: string; mean: number; sd: number; last: number;
  source: 'history' | 'single';
} | null {
  const hist = loadHrvHistory();
  const h = hrvFromHistory(hist);
  if (h) {
    const g = hrvGrade(h.last, h.mean, h.sd);
    return { ...g, mean: Math.round(h.mean), sd: Math.round(h.sd), last: h.last, source: 'history' };
  }
  if (hist.length === 1) {
    return {
      grade: 'optimal', note: 'HRV один замер — оптимально условно, ведите 7+ дней для тренда',
      mean: hist[0], sd: 8, last: hist[0], source: 'single',
    };
  }
  return null;
}

// P3: EWMA для HRV — устойчивее к выбросам (alpha 0.3)
export function hrvEwma(history: number[], alpha = 0.3): number | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const vals = history.filter(v=> typeof v==='number' && v>10 && v<250);
  if (vals.length===0) return null;
  let ewma = vals[0];
  for (let i=1;i<vals.length;i++) ewma = alpha*vals[i] + (1-alpha)*ewma;
  return Math.round(ewma);
}

export function combatHrvReportEwma(): { grade:'optimal'|'caution'|'dangerous'; note:string; mean:number; sd:number; last:number; ewma:number } | null {
  const hist = loadHrvHistory();
  if (hist.length < 7) return null;
  const h = hrvFromHistory(hist);
  if (!h) return null;
  const ew = hrvEwma(hist);
  if (ew==null) return null;
  const g = hrvGrade(h.last, ew, h.sd);
  return { ...g, mean: Math.round(h.mean), sd: Math.round(h.sd), last: h.last, ewma: ew };
}
