/**
 * bb-posterior-readiness.engine.ts — готовность задней цепи под ББ: эксцентрик хамстрингов (NHE)
 * + приводящие (Copenhagen) — чистые функции, без стора.
 *
 * Канон:
 *  - Franke 2025 JSCR (мета, 42 исследования): NHE даёт эксцентрик ES 0.98; медиана дозы
 *    ~50 повторов/нед (2 сессии, 3–39 нед), жёсткой дозозависимости нет — решает регулярность;
 *  - van Dyk 2019 BJSM (8459 атлетов): NHE в программе снижает травмы хамстрингов ~наполовину
 *    (футбол; для ББ — экстраполяция, эксцентрик в длине полезен и для роста);
 *  - Quintana-Cepedal 2025 SJMSS: Copenhagen повышает силу аддукторов, но снижение паховых
 *    травм не доказано (RR 0.83, ДИ 0.41–1.68, very low); сила аддукторов — фактор риска
 *    (BJSM 2025) → делаем для силы/размера, без клейма «профилактика».
 */

export const NHE_DISCLAIMER =
  'Нордик снижает травмы хамстрингов в футболе (van Dyk 2019: −51%); у силовых — экстраполяция, но эксцентрик в длине полезен и для роста (Franke 2025)';

export const ADDUCTOR_HONESTY =
  'Сила приводящих — фактор риска паха (BJSM 2025); Copenhagen повышает силу (SJMSS 2025), но снижение травм не доказано (RR 0.83, very low) — делаем для силы/размера, не как «профилактику»';

export interface NheInput {
  repsL?: number | null;
  repsR?: number | null;
  /** Угол наклона корпуса (0° = вертикаль), на котором теряется контроль, градусы. Больше = сильнее. */
  breakAngleL?: number | null;
  breakAngleR?: number | null;
}

export type NheLevel = 'ok' | 'weak' | 'very_weak' | 'not_tested';

export interface NheVerdict {
  tested: boolean;
  level: NheLevel;
  asymReps: number | null;
  weakSide: 'left' | 'right' | null;
  text: string;
  /** Дозовая схема (null — не заполнено). */
  dose: { sets: number; reps: number; total: number; text: string } | null;
}

const fin = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Доза NHE: старт 2×3×(3–6), рост +1 повтор/нед до 8–10 → медиана РКИ ~50/нед. */
export function nheDose(reps?: number | null, sessions = 2): { sets: number; reps: number; total: number; text: string } {
  const r = Math.max(3, Math.min(10, Math.round(fin(reps) ?? 5)));
  const sets = 3;
  const s = Math.max(1, Math.min(3, Math.round(sessions)));
  const total = sets * r * s;
  const build = r >= 8 ? 'держи 8–10 и добавляй внешний вес' : `+1 повтор/нед до 8–10 (${total}→${sets * 10 * s}/нед)`;
  return {
    sets,
    reps: r,
    total,
    text: `NHE: ${s}×/нед, ${sets} подхода × ${r} повторов (${total} повторов/нед) — ${build}; делод −30%`,
  };
}

export function nheVerdict(s: NheInput): NheVerdict {
  const l = fin(s.repsL);
  const r = fin(s.repsR);
  const bl = fin(s.breakAngleL);
  const br = fin(s.breakAngleR);
  const tested = l != null || r != null || bl != null || br != null;
  if (!tested) {
    return { tested: false, level: 'not_tested', asymReps: null, weakSide: null, text: 'NHE-готовность: не замерялась', dose: null };
  }
  const minReps = l != null && r != null ? Math.min(l, r) : (l ?? r);
  const asymReps = l != null && r != null ? Math.abs(l - r) : null;
  const weakSide: 'left' | 'right' | null =
    asymReps != null && asymReps >= 2 ? ((l ?? 99) < (r ?? 99) ? 'left' : 'right') : null;
  const minAngle = bl != null && br != null ? Math.min(bl, br) : (bl ?? br);

  const bits: string[] = [];
  let level: NheLevel = 'ok';
  if (minReps != null) {
    if (minReps < 3) { level = 'very_weak'; bits.push(`контроль <3 повторов — эксцентрик слабый`); }
    else if (minReps < 5) { level = 'weak'; bits.push(`${minReps} контролируемых повторов (<5) — эксцентрик в работе`); }
  }
  if (minAngle != null) {
    if (minAngle < 30) { level = 'very_weak'; bits.push(`контроль теряется на ${minAngle}° (<30) — падаешь в первой трети`); }
    else if (minAngle < 60) { if (level !== 'very_weak') level = 'weak'; bits.push(`контроль до ${minAngle}° (30–59) — есть куда расти`); }
  }
  if (weakSide) {
    if (level === 'ok') level = 'weak';
    bits.push(`асимметрия ${asymReps} повторов (≥2) — слабее ${weakSide === 'left' ? 'левая' : 'правая'}, начинай с неё`);
  }

  const dose = nheDose(minReps, 2);
  if (!bits.length) {
    return { tested: true, level: 'ok', asymReps, weakSide, text: `NHE: эксцентрик в порядке (${minReps ?? '—'} повторов${minAngle != null ? `, контроль до ${minAngle}°` : ''})`, dose };
  }
  return {
    tested: true,
    level,
    asymReps,
    weakSide,
    text: `NHE: ${bits.join(' · ')} → ${dose.text}`,
    dose,
  };
}

export type CphLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface AdductorInput {
  squeezeL?: number | null;
  squeezeR?: number | null;
  /** Уровень Copenhagen (L0 — изометрия … L3 — динамика). */
  cphLevel?: CphLevel | '' | null;
}

export type AdductorLevel = 'ok' | 'watch' | 'weak' | 'not_tested';

export interface AdductorVerdict {
  tested: boolean;
  asymPct: number | null;
  weakSide: 'left' | 'right' | null;
  level: AdductorLevel;
  text: string;
}

/** Асимметрия в % от сильнейшей стороны (null — нет пары). */
export function adductorAsymPct(l?: number | null, r?: number | null): number | null {
  const a = fin(l);
  const b = fin(r);
  if (a == null || b == null || (a <= 0 && b <= 0)) return null;
  const mx = Math.max(a, b);
  if (mx <= 0) return null;
  return Math.round((Math.abs(a - b) / mx) * 100);
}

export function copenhagenProgression(level?: CphLevel | '' | null): { steps: string[]; next: string } {
  const steps = [
    'L0 — изометрия: колено на опоре, сжатие без движения 2×15–20 с',
    'L1 — короткий рычаг: нижняя нога на скамье, верхняя в колене, 2–3×6–8',
    'L2 — полный уровень: корпус прямой, упор на локоть/стопу, 2–3×6–8',
    'L3 — динамика: подъём корпуса с полного уровня 2–3×5–6',
  ];
  const cur = level || 'L0';
  const idx = steps.findIndex((s) => s.startsWith(cur));
  const next = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : idx === steps.length - 1 ? 'держи L3 и добавляй объём/темп' : steps[0];
  return { steps, next };
}

export function adductorVerdict(s: AdductorInput): AdductorVerdict {
  const l = fin(s.squeezeL);
  const r = fin(s.squeezeR);
  const cph = s.cphLevel || '';
  const tested = l != null || r != null || !!cph;
  if (!tested) {
    return { tested: false, asymPct: null, weakSide: null, level: 'not_tested', text: 'Аддукторы: не замерялись' };
  }
  const asym = adductorAsymPct(l, r);
  const weakSide: 'left' | 'right' | null = asym != null && asym >= 10 ? ((l ?? 0) < (r ?? 0) ? 'left' : 'right') : null;
  const bits: string[] = [];
  let level: AdductorLevel = 'ok';
  if (asym != null && asym >= 15) { level = 'weak'; bits.push(`асимметрия ${asym}% (≥15) — слабее ${weakSide === 'left' ? 'левая' : 'правая'}`); }
  else if (asym != null && asym >= 10) { level = 'watch'; bits.push(`асимметрия ${asym}% (10–14) — следи за слабой стороной`); }
  if (cph) {
    const prog = copenhagenProgression(cph as CphLevel);
    if (cph === 'L0') { if (level === 'ok') level = 'weak'; bits.push(`Copenhagen L0 — начни с изометрии, шаг: ${prog.next}`); }
    else bits.push(`Copenhagen ${cph} — шаг: ${prog.next}`);
  }
  if (!bits.length) {
    return { tested: true, asymPct: asym, weakSide, level: 'ok', text: `Аддукторы: симметрично (${asym ?? 0}%) — Copenhagen не нужен как приоритет` };
  }
  return { tested: true, asymPct: asym, weakSide, level, text: `Аддукторы: ${bits.join(' · ')} — ${ADDUCTOR_HONESTY}` };
}
