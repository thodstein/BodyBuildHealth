/**
 * armlift-cause.engine.ts — поиск ПРИЧИНЫ отставания снаряда армлифтинга (PRO-5, real).
 * Только армлифтинг-домен: снаряды/холды/журнал помоста. Армрестлинг (12 точек стола,
 * arm-weak-cause) не импортируется и не используется — хабы раздельные.
 * Скоринг причин с evidence: technique / max_strength / endurance / volume / mobility / fatigue.
 * Боль — жёсткий гейт (не причина для нагрузки).
 * Чистые функции.
 */

export type ArmliftCause = 'technique' | 'max_strength' | 'endurance' | 'volume' | 'mobility' | 'fatigue' | 'pain';

export interface ArmliftCauseInput {
  implement?: string;
  failurePoint?: string;
  faultIds?: string[];
  pinchHoldSec?: number | null;
  farmerHoldSec?: number | null;
  wristExtWeak?: boolean;
  /** Crush-тесты с помоста: уровень CoC (0–4) и Silver-hold (с). */
  cocLevel?: number | null;
  silverSec?: number | null;
  /** D18: гриппер Silver (№2/3/4) — контекст времени удержания. */
  silverGripper?: string | null;
  /** Журнал помоста: хват-сессий за 28д (по записям he_arm_platform_log). */
  gripSessions28d?: number | null;
  /** Тренд снаряда по журналу: +растёт / 0 стоит / -падает (процент). */
  trendDeltaPct?: number | null;
  asymmetryPct?: number | null;
  thumbStiff?: boolean;
  wristExtLimited?: boolean;
  wristFlexLimited?: boolean;
  /** D13: проваленные ROM-тесты (wrist_ext/wrist_flex/thumb_opp) — измерено, не toggles. */
  mobilityFails?: string[];
  hipHingePoor?: boolean;
  /** Хват-сессий в неделю сейчас (частота). */
  gripFreqPerWeek?: number | null;
  /** D14: зона ACWR из sRPE (undertrained/optimal/caution/dangerous; null — нет данных). */
  acwrZone?: string | null;
  /** D10 E3: баланс сгибатели/разгибатели — холды секунд (кулак vs раскрытие). */
  flexHoldSec?: number | null;
  extHoldSec?: number | null;
  elbowPain?: boolean;
  pain?: boolean;
  /** D10 E6: кожа — сорвана мозоль / болит перепонка большого (щит щипка первым). */
  skinTear?: boolean;
  thumbWebPain?: boolean;
  /** D21: щипок по рукам (кг) — если обе заполнены и есть асимметрия, evidence указывает слабую руку. */
  pinchL?: number | null;
  pinchR?: number | null;
}

/** D10 E3: ratio сгибатели/экстензоры. Норма 1.0–1.3, >1.5 — значимый дисбаланс. */
export function flexExtRatio(flexSec: number | null | undefined, extSec: number | null | undefined): number | null {
  if (flexSec == null || extSec == null) return null;
  if (!Number.isFinite(flexSec) || !Number.isFinite(extSec) || flexSec <= 0 || extSec <= 0) return null;
  return Math.round((flexSec / extSec) * 100) / 100;
}

export interface ArmliftCauseResult {
  cause: ArmliftCause;
  confidence: number;
  evidence: string[];
  fix: string;
}

const CLAMP01 = (v: number): number => Math.max(0, Math.min(1, Math.round(v * 100) / 100));

const FIX_TEXT: Record<ArmliftCause, string> = {
  technique: 'Техника первой: одна чистая сессия по правилам (протирка, мел, центр, параллель, 1с локаут) вместо макса',
  max_strength: 'Макс-сила: тяжёлые тройки/единички DOH 5×3 + холд 10с, шаг +2.5–5%/нед',
  endurance: 'Выносливость: холды 30–60с + carries 20–50м, отдых 90–120с между хватовыми',
  volume: 'Объём: хват 2–3×/нед (сейчас реже) — добавить сессию слабого звена первой в неделе',
  mobility: 'Мобильность: high-rep 12–20 без боли, RIR≥2, ретест через 2 нед',
  fatigue: 'Усталость: делод хвату 50% на неделю, экстензия без боли, возврат через безболевой холд 20с',
  pain: 'Стоп-нагрузка: сначала врач, тесты после ухода боли',
};

function num(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? (v as number) : null;
}

/**
 * Хват-сессии за 28д из журнала помоста. Без implement — все снаряды,
 * со снарядом — только он (честный объём под точку диагностики).
 */
export function countGripSessions(
  log: Array<{ date?: string; implement?: string }>,
  implement?: string,
  days = 28,
): number | null {
  try {
    if (!Array.isArray(log)) return null;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cut = cutoff.toISOString().slice(0, 10);
    const impl = String(implement || '');
    let n = 0;
    for (const e of log) {
      if (!e || String(e.date || '') < cut) continue;
      if (impl && String(e.implement || '') !== impl && String(e.implement || '') !== '') {
        // L/R-суффиксы (rolling_thunder_L) маппим на базу
        const base = String(e.implement || '').replace(/_[LR]$/, '');
        if (base !== impl) continue;
      }
      n++;
    }
    return n;
  } catch { return null; }
}

export function diagnoseArmliftCause(i: ArmliftCauseInput): ArmliftCauseResult {
  const ev: string[] = [];
  const scores: Record<Exclude<ArmliftCause, 'pain'>, number> = {
    technique: 0, max_strength: 0, endurance: 0, volume: 0, mobility: 0, fatigue: 0,
  };
  const faults = Array.isArray(i.faultIds) ? i.faultIds.filter(Boolean) : [];
  const fp = String(i.failurePoint || '');
  const pinch = num(i.pinchHoldSec);
  const farmer = num(i.farmerHoldSec);
  const sess28 = num(i.gripSessions28d);
  const trend = num(i.trendDeltaPct);
  const freq = num(i.gripFreqPerWeek);

  // PAIN — гейт, не скоринг.
  if (i.pain || i.elbowPain) {
    return {
      cause: 'pain', confidence: 0.95,
      evidence: [i.pain ? 'Боль отмечена в диагностике' : 'Боль в локте/запястье при хвате'],
      fix: FIX_TEXT.pain,
    };
  }
  // D10 E6: кожа — стоп щипка (support без боли — можно), не общий стоп.
  if (i.skinTear || i.thumbWebPain) {
    // D21: thumbWebPain без skinTear — щипок запрещён, но pinch-контекст в evidence.
    if (i.thumbWebPain && !i.skinTear) {
      return {
        cause: 'pain', confidence: 0.9,
        evidence: ['Болит перепонка большого — щипок запрещён (перепонка)'],
        fix: 'Перепонка: пауза щипка + тейп большого; support без боли — можно; экстензия лёгкая',
      };
    }
    return {
      cause: 'pain', confidence: 0.9,
      evidence: [i.skinTear ? 'Сорвана мозоль/кожа — щипок запрещён до заживления' : 'Болит перепонка большого — щипок запрещён'],
      fix: 'Кожа: пауза щипка до заживления + крем/тейп; support без боли — можно; экстензия лёгкая',
    };
  }

  // TECHNIQUE: фолы из чек-листа правил; срыв на локауте при силе = тоже техника.
  if (faults.length >= 2) { scores.technique += 0.6; ev.push(`Фолы техники: ${faults.length} (${faults.slice(0, 2).join(', ')})`); }
  else if (faults.length === 1) { scores.technique += 0.3; ev.push(`Фол техники: ${faults[0]}`); }
  if (fp === 'lockout' && pinch != null && pinch >= 15 && farmer != null && farmer >= 30) {
    scores.technique += 0.3; ev.push('Сила холдов есть, падает стойка 1с — техника локаута');
  }

  // MAX_STRENGTH: срыв внизу + короткие холды + слабый crush.
  if (fp === 'off_floor' || fp === 'close_fail') { scores.max_strength += 0.45; ev.push('Срыв внизу/не закрыл — пик силы'); }
  if (pinch != null && pinch < 10) { scores.max_strength += 0.35; ev.push(`Pinch-hold ${pinch}с < 10с`); }
  if (farmer != null && farmer < 15) { scores.max_strength += 0.25; ev.push(`Farmer-hold ${farmer}с < 15с`); }
  // D21: per-hand щипок в evidence — если обе руки заполнены, указываем слабую.
  const pinchL = num((i as any).pinchL);
  const pinchR = num((i as any).pinchR);
  const asym = num((i as any).asymmetryPct);
  if (pinchL != null && pinchR != null && asym != null && asym >= 10) {
    const weak = pinchL < pinchR ? `левая ${pinchL}кг слабее правой ${pinchR}кг` : `правая ${pinchR}кг слабее левой ${pinchL}кг`;
    // Техника/асимметрия — не сила, поэтому evidence, без очков (асимметрия уже скорит).
    ev.push(`Щипок по рукам: ${weak} (асимметрия ${asym}%)`);
  }
  const coc = num(i.cocLevel);
  if (coc != null && coc < 2) { scores.max_strength += 0.35; ev.push(`CoC №${coc} < №2 — crush-пик`); }
  const silv = num(i.silverSec);
  const grip = i.silverGripper ? ` (№${i.silverGripper})` : '';
  if (silv != null && silv < 20) { scores.endurance += 0.3; ev.push(`Silver-hold ${silv}с${grip} < 20с — crush-выносливость`); }
  else if (silv != null && silv >= 20 && silv < 45) { scores.endurance += 0.15; ev.push(`Silver-hold ${silv}с${grip} — середина`); }

  // ENDURANCE: срыв в удержании/середине при живом старте.
  if (fp === 'hold_long' || fp === 'mid') { scores.endurance += 0.45; ev.push('Держит старт, плывёт дальше — выносливость'); }
  if (fp === 'hold_short' && pinch != null && pinch >= 10) { scores.endurance += 0.25; ev.push('Пик есть, холд короткий — перевод в endurance'); }
  if (pinch != null && pinch >= 10 && pinch < 20) { scores.endurance += 0.2; ev.push(`Pinch-hold ${pinch}с — середина`); }
  if (farmer != null && farmer >= 15 && farmer < 30) { scores.endurance += 0.2; ev.push(`Farmer-hold ${farmer}с — середина`); }

  // VOLUME: редкие сессии + стоящий тренд при редкости.
  if (sess28 != null && sess28 <= 2) { scores.volume += 0.5; ev.push(`Хват-сессий за 28д: ${sess28} (норма 8–12)`); }
  else if (sess28 != null && sess28 <= 5) { scores.volume += 0.3; ev.push(`Хват-сессий за 28д: ${sess28} — ниже нормы`); }
  if (freq != null && freq < 2) { scores.volume += 0.3; ev.push(`Частота ${freq}×/нед < 2`); }
  if (trend != null && trend <= 1 && (sess28 == null || sess28 <= 5)) {
    scores.volume += 0.2; ev.push(`Тренд ${trend}% стоит при низком объёме`);
  }
  // Тренд стоит ПРИ объёме — это уже техника, не объём (классика PL/BB).
  if (trend != null && trend <= 1 && sess28 != null && sess28 >= 8) {
    scores.technique += 0.35; ev.push(`Тренд ${trend}% стоит при объёме — угол/техника`);
  }

  // D10 E3: баланс сгибатели/разгибатели (норма 1.0–1.3, >1.5 — значимо).
  const ratio = flexExtRatio(num(i.flexHoldSec), num(i.extHoldSec));
  if (ratio != null && ratio > 1.5) {
    scores.mobility += 0.45;
    ev.push(`Дисбаланс сгибатели/разгибатели ${ratio} (>1.5) — экстензоры первыми`);
  } else if (ratio != null && ratio > 1.3) {
    scores.mobility += 0.2;
    ev.push(`Крен в сгибатели ${ratio} — добавить экстензию`);
  }

  // MOBILITY: явные ограничения под снаряд.
  const pinchImpl = ['saxon_bar', 'hub', 'pinch_block', 'anvil', 'grandfather_clock'].includes(String(i.implement || ''));
  if (pinchImpl && i.thumbStiff) { scores.mobility += 0.55; ev.push('Большой жёсткий на щипковом снаряде'); }
  if (i.wristExtLimited || i.wristFlexLimited) { scores.mobility += 0.45; ev.push('Ограничение запястья режет позицию'); }
  // D13: измеренные ROM-провалы бьют сильнее toggles.
  const fails = Array.isArray(i.mobilityFails) ? i.mobilityFails.filter(Boolean) : [];
  if (fails.length) {
    scores.mobility += Math.min(0.7, 0.4 + 0.15 * fails.length);
    ev.push(`ROM-провал: ${fails.join(', ')} — ретест через 2 нед`);
  }
  if (i.wristExtWeak) { scores.max_strength += 0.25; ev.push('Слабая экстензия — теряет позицию под весом'); }

  // D14: системная нагрузка по sRPE (тот же движок, что у арм-хаба, свой вход).
  if (i.acwrZone === 'dangerous') { scores.fatigue += 0.4; ev.push('ACWR dangerous — системный перегруз'); }
  else if (i.acwrZone === 'caution') { scores.fatigue += 0.2; ev.push('ACWR caution'); }

  // FATIGUE: частота выше восстановления + падающий тренд при объёме.
  if (freq != null && freq >= 5) { scores.fatigue += 0.4; ev.push(`Частота ${freq}×/нед — сухожилия не успевают (8–12 нед адаптация)`); }
  if (trend != null && trend < -3 && sess28 != null && sess28 >= 8) {
    scores.fatigue += 0.4; ev.push(`Тренд ${trend}% падает при объёме — недовосстановление`);
  }
  if (i.hipHingePoor && fp === 'lockout') { scores.technique += 0.2; ev.push('Слабый hinge роняет локаут'); }

  let cause = 'volume' as Exclude<ArmliftCause, 'pain'>;
  let best = -1;
  for (const k of Object.keys(scores) as Array<Exclude<ArmliftCause, 'pain'>>) {
    if (scores[k] > best) { best = scores[k]; cause = k; }
  }
  const confidence = CLAMP01(best > 0 ? Math.min(0.9, 0.35 + best) : 0.35);
  if (ev.length === 0) ev.push('Данных мало — старт с объёма 2×/нед и чистой техники');
  return { cause, confidence, evidence: ev.slice(0, 4), fix: FIX_TEXT[cause] };
}
