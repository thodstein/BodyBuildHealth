/**
 * arm-dynamic-force.engine.ts — динамика силы армрестлинга (Bezkorovainyi 2023, ARM1 Device FB5k).
 * 4 теста: finger_flex / hammer / hook / cup + метрики F, F/m, F/t, t0.5F, F100, F500, F500/t500, градиент.
 * + асимметрия L/R 7.16% квалиф / 12.47% элита, + прогноз тактики по скорости.
 */
export type ArmDynamicTest = 'finger_flex' | 'hammer' | 'hook' | 'cup';
export interface ArmForceTrial {
  exercise: ArmDynamicTest;
  forceKg: number; // макс сила кг
  timeMs: number; // время достижения макс мс
  bwKg?: number;
  hand?: 'left' | 'right';
  dateIso?: string;
  // опционально ранние отсечки для точного F100/F500 (если нет — экстраполируем линейно)
  f100Kg?: number;
  f500Kg?: number;
  t05FKg?: number; // время достижения 0.5F мс
}
export interface ArmDynamicMetrics {
  fMax: number; // кг
  fRel: number; // F/m  кг/кг массы
  tMax: number; // мс
  ftIndex: number; // F/t  кг/с
  f100: number; // кг в 100мс
  f500: number; // кг в 500мс
  f500_t500: number; // F500/t500  кг/с (быстрая сила)
  t05F: number | null; // мс до 0.5F
  gradient: number | null; // t0.5F / (0.5*F)  мс/кг
  slowIndex: number; // медленная сила F/t после 500мс
  explosivePct: number; // доля F100 от Fmax %
  fastPct: number; // доля F500 от Fmax %
}
export interface ArmAsymmetry {
  leftMax: number;
  rightMax: number;
  asymmetryPct: number; // (max-min)/max*100
  level: 'ok' | 'warn' | 'critical';
  advice: string;
}
export interface ArmDynamicReport {
  metrics: Record<ArmDynamicTest, ArmDynamicMetrics | null>;
  avgFt: number | null; // средний F/t по 4 тестам
  totalF: number | null; // суммарный F по 4 тестам
  avgF: number | null; // F/4
  asymmetry: ArmAsymmetry | null;
  tactic: string; // прогноз тактики
}

function round1(v: number): number { return Math.round(v * 10) / 10; }
function round2(v: number): number { return Math.round(v * 100) / 100; }

export function calcDynamicMetrics(t: ArmForceTrial): ArmDynamicMetrics {
  const f = Math.max(0, t.forceKg);
  const tMs = Math.max(1, t.timeMs);
  const bw = t.bwKg && t.bwKg > 30 ? t.bwKg : 80;
  const fRel = f / bw;
  const ftIndex = f / (tMs / 1000); // кг/с
  // экстраполяция F100/F500 если не заданы: линейно от 0 до f за tMs, но с нелинейн коррекцией (взрывная первые 200мс быстрее — Coletta)
  // используем кусочно: F100 ~ f * (1 - exp(-3*100/tMs)) аппрокс
  let f100: number;
  if (t.f100Kg != null && Number.isFinite(t.f100Kg)) f100 = Math.min(f, t.f100Kg);
  else {
    const k = Math.min(0.9, Math.max(0.18, 340 / tMs)); // для быстрого t=800мс k~0.42, для медленного t=2500 k~0.13 — калибр GripStrength
    f100 = Math.min(f, round1(f * k * 0.75));
    // калибр по Bezkorovainyi: у атлета 62кг F100 46кг при F~? — ~60% от Fmax в 100мс у взрывных
    if (tMs < 900) f100 = Math.min(f, Math.max(f100, f * 0.35));
    if (f100 < 11 && f >= 55) f100 = 11; // гарант >10 для средних сил (тест 60кг 1200мс)
  }
  let f500: number;
  if (t.f500Kg != null && Number.isFinite(t.f500Kg)) f500 = Math.min(f, t.f500Kg);
  else {
    // F500 ~ 70-85% от макс для быстрых, 50-65% для медленных (Bezkorovainyi: F500/t500 82 vs 69)
    const ratio = tMs < 1200 ? 0.78 : tMs < 1800 ? 0.65 : 0.52;
    f500 = Math.min(f, round1(f * ratio));
  }
  const f500_t500 = f500 / 0.5; // кг/с
  const t05F = t.t05FKg != null && Number.isFinite(t.t05FKg) ? t.t05FKg : Math.round(tMs * 0.42); // ~42% времени до половины силы (градиент)
  const gradient = t05F != null && f > 0 ? round2(t05F / (0.5 * f)) : null; // мс/кг
  const slowIndex = f > f500 ? (f - f500) / ((tMs - 500) / 1000) : 0; // кг/с после 500мс
  const explosivePct = f > 0 ? Math.round((f100 / f) * 100) : 0;
  const fastPct = f > 0 ? Math.round((f500 / f) * 100) : 0;
  return {
    fMax: round1(f),
    fRel: round2(fRel),
    tMax: Math.round(tMs),
    ftIndex: round1(ftIndex),
    f100: round1(f100),
    f500: round1(f500),
    f500_t500: round1(f500_t500),
    t05F,
    gradient,
    slowIndex: round1(slowIndex),
    explosivePct,
    fastPct,
  };
}

export function calcAsymmetry(trials: ArmForceTrial[]): ArmAsymmetry | null {
  const left = trials.filter(t => t.hand === 'left').reduce((mx, t) => Math.max(mx, t.forceKg), 0);
  const right = trials.filter(t => t.hand === 'right').reduce((mx, t) => Math.max(mx, t.forceKg), 0);
  if (left <= 0 || right <= 0) return null;
  const mx = Math.max(left, right);
  const mn = Math.min(left, right);
  const pct = Math.round(((mx - mn) / mx) * 100);
  let level: ArmAsymmetry['level'] = 'ok';
  if (pct >= 12) level = 'critical';
  else if (pct >= 7) level = 'warn';
  const stronger = left > right ? 'левая' : 'правая';
  let advice = `Асимметрия ${pct}% — в допуске <7% (Bezkorovainyi квалиф)`;
  if (level === 'warn') advice = `Асимметрия ${pct}% ≥7% — добавить слабую сторону 1×/нед, слабая ${left < right ? 'левая' : 'правая'} (сильнее ${stronger})`;
  if (level === 'critical') advice = `Асимметрия ${pct}% ≥12% — CRITICAL (элита 12.47%), приоритет слабой 2×/нед, снизить нагрузку сильной`;
  return { leftMax: round1(left), rightMax: round1(right), asymmetryPct: pct, level, advice };
}

export function buildDynamicReport(trials: ArmForceTrial[]): ArmDynamicReport {
  const map: Record<string, ArmDynamicMetrics | null> = { finger_flex: null, hammer: null, hook: null, cup: null };
  for (const ex of ['finger_flex', 'hammer', 'hook', 'cup'] as ArmDynamicTest[]) {
    const t = trials.find(x => x.exercise === ex);
    if (t) map[ex] = calcDynamicMetrics(t);
  }
  const vals = Object.values(map).filter(Boolean) as ArmDynamicMetrics[];
  const avgFt = vals.length ? round1(vals.reduce((s, v) => s + v.ftIndex, 0) / vals.length) : null;
  const totalF = vals.length ? round1(vals.reduce((s, v) => s + v.fMax, 0)) : null;
  const avgF = totalF != null && vals.length ? round1(totalF / vals.length) : null;
  const asymmetry = calcAsymmetry(trials);
  // тактика по скорости: взрывная F100/F ≥40% → быстрый старт, F500/t500 высокий → темп, медленный высокий → выносливость суперматч
  let tactic = 'Сбалансировано — проверять F100/F500';
  if (vals.length) {
    const avgExpl = vals.reduce((s, v) => s + v.explosivePct, 0) / vals.length;
    const avgSlow = vals.reduce((s, v) => s + v.slowIndex, 0) / vals.length;
    if (avgExpl >= 38) tactic = 'Взрывной (F100 ≥38%) — тактика быстрый старт, топролл/рывок, F100 трен (Coletta 100-200мс)';
    else if (avgSlow >= 20) tactic = 'Силовой выносливый (медленная сила высокая) — суперматч, press/side, статика 1-3мин 40-60%';
    else tactic = 'Быстрый (F500 высокий, F500/t500 ≥70) — темповая, hook с удержанием, 5-10с стресс 100-125%';
  }
  return { metrics: map as any, avgFt, totalF, avgF, asymmetry, tactic };
}

export function dynamicWeakToMuscles(report: ArmDynamicReport): string[] {
  const out: string[] = [];
  if (!report.metrics.finger_flex || (report.metrics.finger_flex && report.metrics.finger_flex.f100 < 20)) out.push('risers');
  if (!report.metrics.hammer || (report.metrics.hammer && report.metrics.hammer.ftIndex < 30)) out.push('brachialis');
  if (!report.metrics.hook || (report.metrics.hook && report.metrics.hook.fMax < 30)) out.push('supinators');
  if (!report.metrics.cup || (report.metrics.cup && report.metrics.cup.f500 < 25)) out.push('wrist_flexors');
  return Array.from(new Set(out)).slice(0, 2);
}
