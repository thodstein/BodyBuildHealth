/**
 * bb-weak-cause.engine.ts — диагностика ПРИЧИНЫ отставания (MAX PRO).
 * Отвечает не только "что отстаёт", а "почему": объём / активация / восстановление / техника / генетика.
 * Чистые функции, без мутаций плана. Источники: Schoenfeld 2017/2016, Israetel MEV/MAV/MRV,
 * Pareja-Blanco 2017 (VBT loss), Wolf 2023/2025 (lengthened), McCallum/Reeves пропорции.
 */

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
