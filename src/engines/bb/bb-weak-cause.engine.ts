/**
 * bb-weak-cause.engine.ts — диагностика ПРИЧИНЫ отставания (MAX PRO).
 * Отвечает не только "что отстаёт", а "почему": объём / активация / восстановление / техника / генетика.
 * Чистые функции, без мутаций плана. Источники: Schoenfeld 2017/2016, Israetel MEV/MAV/MRV,
 * Pareja-Blanco 2017 (VBT loss), Wolf 2023/2025 (lengthened), McCallum/Reeves пропорции.
 */
import { getVolumeLandmarks } from '../volume-landmarks.engine';

export type WeakCause = 'volume' | 'activation' | 'recovery' | 'technique' | 'genetics';

export interface WeakCauseInput {
  zone: string;
  /** факт сетов/нед за 4 недели (старые → новые), effective */
  factHistory?: number[];
  mev?: number | null;
  mav?: number | null;
  mrv?: number | null;
  /** e1RM тренд % за 28д (null = нет данных) */
  e1rmDeltaPct?: number | null;
  e1rmSessions?: number;
  /** ACWR зона мышцы */
  acwrZone?: string | null;
  sleepHours?: number | null;
  vbtLossPct?: number | null;
  /** аудит-флаги по мышце */
  hasLengthened?: boolean;
  singleAngle?: boolean;
  missingStrict?: boolean;
  tempoMismatch?: boolean;
  avgSfr?: number | null;
  /** дельта vs McCallum/Reeves идеала % (отриц = меньше идеала) */
  idealDeltaPct?: number | null;
  /** недель на ≥MAV с чистой техникой (для genetics) */
  weeksAtMavClean?: number;
}

export interface WeakCauseResult {
  cause: WeakCause;
  confidence: number; // 0-1
  evidence: string[];
  fix: string;
}

const CLAMP01 = (v: number): number => Math.max(0, Math.min(1, Math.round(v * 100) / 100));

export function diagnoseWeakCause(input: WeakCauseInput): WeakCauseResult {
  const ev: string[] = [];
  const scores: Record<WeakCause, number> = { volume: 0, activation: 0, recovery: 0, technique: 0, genetics: 0 };

  // ── VOLUME: факт < MEV или < 0.7×MAV стабильно ──
  const hist = Array.isArray(input.factHistory) ? input.factHistory.filter((n) => Number.isFinite(n)) : [];
  const last = hist.length ? hist[hist.length - 1] : null;
  if (input.mev != null && last != null && last < input.mev) {
    scores.volume += 0.55;
    ev.push(`Объём ${last} < MEV ${input.mev}`);
  }
  if (input.mav != null && last != null && last < input.mav * 0.7) {
    scores.volume += 0.35;
    ev.push(`Объём ${last} < 70% MAV ${input.mav}`);
  }
  if (hist.length >= 3 && input.mav != null) {
    const mav: number = input.mav;
    if (hist.slice(-3).every((v) => v < mav * 0.85)) {
      scores.volume += 0.15;
      ev.push('3 нед подряд ниже MAV');
    }
  }

  // ── RECOVERY: ACWR danger/caution + сон + VBT ──
  if (input.acwrZone === 'dangerous') {
    scores.recovery += 0.6;
    ev.push('ACWR danger — перегруз');
  } else if (input.acwrZone === 'caution') {
    scores.recovery += 0.3;
    ev.push('ACWR caution');
  }
  if (input.sleepHours != null && input.sleepHours < 6.5) {
    scores.recovery += 0.25;
    ev.push(`Сон ${input.sleepHours}ч < 6.5`);
  }
  if (input.vbtLossPct != null && input.vbtLossPct > 30) {
    scores.recovery += 0.25;
    ev.push(`VBT потеря ${input.vbtLossPct}% > 30`);
  }

  // ── TECHNIQUE: углы/строгие/темп ──
  if (input.singleAngle) {
    scores.technique += 0.35;
    ev.push('1 угол при ≥6 сетах');
  }
  if (input.missingStrict) {
    scores.technique += 0.25;
    ev.push('Вне строгой группы');
  }
  if (input.tempoMismatch) {
    scores.technique += 0.25;
    ev.push('Темп без паузы в растянутой');
  }
  if (input.hasLengthened === false) {
    scores.technique += 0.2;
    ev.push('Нет lengthened-позиции');
  }

  // ── ACTIVATION: объём есть, а роста нет ──
  const volOk = input.mav != null && last != null && last >= input.mav * 0.85;
  const plateau = input.e1rmDeltaPct != null && input.e1rmDeltaPct <= 1 && (input.e1rmSessions ?? 0) >= 2;
  const falling = input.e1rmDeltaPct != null && input.e1rmDeltaPct <= -5;
  if (volOk && (plateau || falling) && input.hasLengthened === false) {
    scores.activation += 0.55;
    ev.push(`Объём ${last} ≥ MAV, а e1RM ${input.e1rmDeltaPct}% — мышца не включается`);
  } else if (volOk && plateau) {
    scores.activation += 0.35;
    ev.push(`Плато e1RM ${input.e1rmDeltaPct}% при достаточном объёме`);
  }
  if (input.avgSfr != null && input.avgSfr <= 3 && volOk) {
    scores.activation += 0.2;
    ev.push(`Низкий SFR ${input.avgSfr} — стимул мимо цели`);
  }

  // ── GENETICS: долго на MAV чисто, а дельта vs идеала большая ──
  if ((input.weeksAtMavClean ?? 0) >= 12 && input.idealDeltaPct != null && input.idealDeltaPct <= -15) {
    scores.genetics += 0.7;
    ev.push(`12+ нед на MAV чисто, а vs идеала ${input.idealDeltaPct}% — рычаги/брюшко`);
  } else if (input.idealDeltaPct != null && input.idealDeltaPct <= -25 && volOk) {
    scores.genetics += 0.4;
    ev.push(`vs идеала ${input.idealDeltaPct}% при объёме ${last} — вероятно генетика`);
  }

  // ── Выбор победителя (приоритет recovery > volume при перегрузе) ──
  let cause: WeakCause = 'volume';
  let best = -1;
  const order: WeakCause[] = ['recovery', 'volume', 'technique', 'activation', 'genetics'];
  for (const k of order) {
    // recovery побеждает при явном перегрузе даже с небольшим счётом
    const v = scores[k];
    if (v > best) {
      best = v;
      cause = k;
    }
  }
  if (best <= 0) {
    cause = 'volume';
    best = 0.4;
    ev.push('Данных мало — старт с объёма (MEV→MAV лесенка)');
  }

  const fixes: Record<WeakCause, string> = {
    volume: 'Лесенка объёма: факт+4 сета → +2/нед до MAV-верха, частота 3-4× (режем >11 сетов/сессия)',
    activation: 'Не +объём: lengthened первым, PROF-техника (локти/лопатки/пауза 1с), mind-muscle, SFR≥4',
    recovery: 'Сначала восстановление: сон ≥7.5ч, делоад/−25% объёма, RIR+1, VBT-контроль; +объём запрещён',
    technique: 'Смена углов: второй угол + строгая группа + темп 3-1-1-0 с паузой, без +объёма',
    genetics: 'Длинная игра: unilateral + lengthened акцент + частота 4-5× малыми дозами, меряем 12 нед',
  };

  return { cause, confidence: CLAMP01(Math.min(0.95, Math.max(0.4, best + 0.25))), evidence: ev.slice(0, 6), fix: fixes[cause] };
}

/** Пакетная диагностика 1-2 зон (тонкая обёртка для хаба). */
export function diagnoseWeakCauses(
  zones: string[],
  byZone: Record<string, Omit<WeakCauseInput, 'zone'>>,
): Record<string, WeakCauseResult> {
  const out: Record<string, WeakCauseResult> = {};
  for (const z of zones.slice(0, 2)) {
    out[z] = diagnoseWeakCause({ zone: z, ...(byZone[z] || {}) });
  }
  return out;
}

export interface WeakCauseAuditFlags {
  lengthened: boolean;
  singleAngle: boolean;
  missingStrict: boolean;
  avgSfr: number | null;
}

export interface WeakCauseAssembleDeps {
  level: string;
  factVolume?: Record<string, { effectiveSets?: number; directSets?: number } | number> | null;
  perMuscleAcwr?: Record<string, { zone: string }> | null;
  sleepHours?: number | null;
  vbtLossPct?: number | null;
  hist28?: Record<string, number[]>;
  e1rmTrend?: Record<string, { deltaPct: number; sessions: number }>;
  meas?: Record<string, unknown>;
  heightCm?: number | null;
  wristCm?: number | null;
  auditFor?: (zone: string) => WeakCauseAuditFlags | null;
  canonicalOf?: (zone: string) => string;
}

function factSetsOf(factVolume: WeakCauseAssembleDeps['factVolume'], zone: string): number | null {
  if (!factVolume) return null;
  const v: any = (factVolume as any)[zone];
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = v.effectiveSets ?? v.directSets ?? null;
  return n == null || !Number.isFinite(n) ? null : n;
}

/** Единая сборка входов причины на зону (хаб, мост и экспорт используют одно и то же). */
export function assembleWeakCauseInput(zone: string, deps: WeakCauseAssembleDeps): Omit<WeakCauseInput, 'zone'> {
  const z = zone;
  const canon = (() => { try { return deps.canonicalOf ? deps.canonicalOf(z) : z; } catch { return z; } })();
  const lm = (() => { try { return getVolumeLandmarks(deps.level || 'intermediate', z); } catch { return null; } })();
  const fact = factSetsOf(deps.factVolume, z);
  const acwrZ = (() => { try { return (deps.perMuscleAcwr as any)?.[z]?.zone ?? null; } catch { return null; } })();
  let hist: number[] = [];
  try { hist = (deps.hist28 as any)?.[z] || (deps.hist28 as any)?.[canon] || []; } catch { /* noop */ }
  if (!hist.length && fact != null) hist = [fact];
  let e1rmDelta: number | null = null;
  let e1rmSessions = 0;
  try {
    const t = (deps.e1rmTrend as any)?.[z] || (deps.e1rmTrend as any)?.[canon];
    if (t && Number.isFinite(t.deltaPct)) { e1rmDelta = t.deltaPct; e1rmSessions = t.sessions || 0; }
  } catch { /* noop */ }
  const aud = (() => { try { return deps.auditFor ? deps.auditFor(z) : null; } catch { return null; } })();
  const mavN = lm?.mav ?? null;
  const techClean = aud ? !aud.singleAngle && !aud.missingStrict : true;
  return {
    factHistory: hist,
    mev: lm?.mev ?? null, mav: mavN, mrv: lm?.mrv ?? null,
    e1rmDeltaPct: e1rmDelta, e1rmSessions,
    acwrZone: acwrZ,
    sleepHours: deps.sleepHours != null && Number.isFinite(deps.sleepHours) ? deps.sleepHours : null,
    vbtLossPct: deps.vbtLossPct ?? null,
    hasLengthened: aud ? aud.lengthened : undefined,
    singleAngle: aud ? aud.singleAngle : false,
    missingStrict: aud ? aud.missingStrict : false,
    tempoMismatch: false,
    avgSfr: aud?.avgSfr ?? null,
    idealDeltaPct: idealDeltaForZone(z, (deps.meas || {}) as any, deps.heightCm ?? null, deps.wristCm ?? null),
    weeksAtMavClean: techClean ? weeksAtMav(hist, mavN) : 0,
  };
}

/** Пакетная диагностика из живых входов (единая точка для хаба/моста/экспорта). */
export function diagnoseWeakCausesBatch(
  zones: string[],
  deps: WeakCauseAssembleDeps,
): Record<string, WeakCauseResult> {
  const list = zones.slice(0, 2);
  const byZone: Record<string, Omit<WeakCauseInput, 'zone'>> = {};
  for (const z of list) {
    try { byZone[z] = assembleWeakCauseInput(z, deps); } catch { /* noop */ }
  }
  return diagnoseWeakCauses(list, byZone);
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function avg(...vs: Array<unknown>): number | null {
  const xs = vs.map(num).filter((n): n is number => n != null);
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Дельта замера vs идеала McCallum (по запястью, приоритет) / Reeves (по росту) — % (отриц = меньше идеала).
 * meas: ключи окружностей (chest, bicepL/R, thighL/R, calfL/R, forearmL/R, neck, shoulderWidth, waist, hips).
 * abs → null (талия меньше ≠ отставание).
 */
export function idealDeltaForZone(
  zone: string,
  meas: Record<string, unknown>,
  heightCm?: number | null,
  wristCm?: number | null,
): number | null {
  const z = String(zone || '').toLowerCase().trim();
  if (!z || z === 'abs') return null;
  const h = num(heightCm);
  const w = num(wristCm);
  const scaleH = h ? h / 175 : 1;
  // [ключи замера, идеал Reeves при 175см, множитель McCallum от запястья]
  const table: Record<string, { keys: string[]; reeves: number; mcCallum?: number }> = {
    chest: { keys: ['chest'], reeves: 114, mcCallum: 6.5 },
    chest_upper: { keys: ['chest'], reeves: 114, mcCallum: 6.5 },
    chest_mid: { keys: ['chest'], reeves: 114, mcCallum: 6.5 },
    chest_lower: { keys: ['chest'], reeves: 114, mcCallum: 6.5 },
    back: { keys: ['chest'], reeves: 114, mcCallum: 6.5 },
    back_width: { keys: ['chest'], reeves: 114, mcCallum: 6.5 },
    back_thickness: { keys: ['chest'], reeves: 114, mcCallum: 6.5 },
    shoulders: { keys: ['shoulderWidth'], reeves: 50 },
    delt_mid: { keys: ['shoulderWidth'], reeves: 50 },
    delt_rear: { keys: ['shoulderWidth'], reeves: 50 },
    delt_front: { keys: ['shoulderWidth'], reeves: 50 },
    biceps: { keys: ['bicepL', 'bicepR', 'bicep'], reeves: 40, mcCallum: 2.5 },
    triceps: { keys: ['bicepL', 'bicepR', 'bicep'], reeves: 40, mcCallum: 2.5 },
    brachialis: { keys: ['forearmL', 'forearmR', 'forearm'], reeves: 32, mcCallum: 1.8 },
    forearms: { keys: ['forearmL', 'forearmR', 'forearm'], reeves: 32, mcCallum: 1.8 },
    quads: { keys: ['thighL', 'thighR', 'thigh'], reeves: 60, mcCallum: 3.0 },
    hamstrings: { keys: ['thighL', 'thighR', 'thigh'], reeves: 60, mcCallum: 3.0 },
    glutes: { keys: ['hips'], reeves: 96 },
    calves: { keys: ['calfL', 'calfR', 'calf'], reeves: 38, mcCallum: 2.0 },
    traps: { keys: ['neck'], reeves: 40, mcCallum: 2.5 },
  };
  const row = table[z];
  if (!row) return null;
  let fact: number | null = null;
  for (const k of row.keys) {
    const v = num((meas as Record<string, unknown>)[k]);
    if (v != null) { fact = fact == null ? v : Math.min(fact, v); }
  }
  // среднее L/R когда оба заданы — точнее минимума для парных
  if (row.keys.length > 1) {
    const m = avg(...row.keys.map((k) => (meas as Record<string, unknown>)[k]));
    if (m != null) fact = m;
  }
  if (fact == null) return null;
  const ideal = w && row.mcCallum ? w * row.mcCallum : row.reeves * scaleH;
  if (!ideal || ideal <= 0) return null;
  return Math.round(((fact - ideal) / ideal) * 1000) / 10;
}

/** Сколько недель истории на ≥85% MAV (для genetics-ветки). */
export function weeksAtMav(history: number[] | undefined, mav: number | null | undefined): number {
  if (!Array.isArray(history) || mav == null || mav <= 0) return 0;
  return history.filter((v) => Number.isFinite(v) && v >= mav * 0.85).length;
}
