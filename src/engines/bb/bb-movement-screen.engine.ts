/**
 * bb-movement-screen.engine.ts — скрининг движений под бодибилдинг (чистые функции, без стора).
 * Канон: NASM OHSA + Brookbush (сегментный скоринг + re-test) + PoinT GO (подпятка дифференцирует
 * голеностоп vs верх цепи) + knee-to-wall норма ≥9–12 см.
 * Нормы КТС (McBride 2026, n=899: середина-50% до 50 лет 8–14 см М / 8.6–13.8 Ж; типично ~11):
 * <9 — ограничение, ≥12 — норма для приседающих; межсторонняя разница ≥2 см — клинически значима
 * (PoinT GO: >2 см чинить независимо от абсолюта; Lashien 2024: FPPA>10° = вальгус).
 * Нагрузка/восстановление/объём сюда НЕ входят — это чужие хабы (Интеллект/Объём).
 */

export interface OhsScreenInput {
  heelsFlat: boolean;
  kneeValgus: boolean; // true = колени сводятся (провал)
  hipBelowParallel: boolean;
  trunkUpright: boolean;
  armsOverMidfoot: boolean;
  lumbarNeutral: boolean;
  kneeToWallCm?: number | null; // legacy: одно значение (миграция → L/R)
  /** КТС левая/правая (см, носок-стена). Эффектив — худшая; разница ≥2 см — клинически значима. */
  kneeToWallL?: number | null;
  kneeToWallR?: number | null;
  /** Гонометр дорсифлексии (градусы). <35° — драйвер голеностоп даже без heel-retest (рабочий порог PoinT GO 35–38°). */
  ankleDeg?: number | null;
  /** re-test с подпяткой 2.5 см: 'better' | 'same' | null (не делали) */
  heelRetest?: 'better' | 'same' | null;
  /** руки на бёдрах чистят поясницу (тест на широчайшие): true = стало лучше */
  handsOnHipsBetter?: boolean | null;
  /** КТС с ПРЯМЫМ коленом (см) — гастрокнемиус (Tourillon 2025: WBLT + подтверждающие пробы). */
  ktwStraightL?: number | null;
  ktwStraightR?: number | null;
  /** ROM сгибания бедра (градусы; <110 — ограничение глубины, Kim 2015: предиктор приседа). */
  hipFlexionDeg?: number | null;
  /** Задний наклон таза в глубоком приседе («подворот») — глубина до нейтрали (PMC10987311 2024). */
  ppTilt?: boolean;
}

export type MovementDriver = 'ankle' | 'hip' | 'thoracic' | 'shoulder' | 'core' | 'none';

export interface MovementDriverResult {
  driver: MovementDriver;
  label: string;
  fix: string;
  confidence: number; // 0-1
}

/** Приоритет distal→proximal: голеностоп первичен (PoinT GO), дальше ТБС/грудь/плечо/кор. */
export function resolveMovementDriver(input: OhsScreenInput): MovementDriverResult {
  const fin = (v: unknown): number | null => (v != null && Number.isFinite(v as number) ? (v as number) : null);
  const ktwL = fin(input.kneeToWallL) ?? fin(input.kneeToWallCm);
  const ktwR = fin(input.kneeToWallR) ?? fin(input.kneeToWallCm);
  const ktw = ktwL != null && ktwR != null ? Math.min(ktwL, ktwR) : (ktwL ?? ktwR);
  const ktwGap = ktwL != null && ktwR != null ? Math.abs(ktwL - ktwR) : null;
  // Гастрокнемиус — КТС с ПРЯМЫМ коленом (отдельный канал, Tourillon 2025: WBLT + подтверждающие пробы)
  const stL = fin(input.ktwStraightL);
  const stR = fin(input.ktwStraightR);
  const stWorst = stL != null && stR != null ? Math.min(stL, stR) : (stL ?? stR);
  const stGap = stL != null && stR != null ? Math.abs(stL - stR) : null;
  const gastrocBad = stWorst != null && stWorst < 9;
  const deg = input.ankleDeg;
  const goniBad = deg != null && Number.isFinite(deg) && (deg as number) < 35;
  const ankleBad = !input.heelsFlat || (ktw != null && ktw < 9) || gastrocBad || goniBad;
  const asymPart = (kind: string, a: number, b: number): string =>
    ` + асимметрия ${kind} ${a} vs ${b} см (≥2 см — клинически значимо): мобилизируй отстающую первой, цель — разница <1.5 см`;
  const ankleAsymNote =
    ktwGap != null && ktwGap >= 2 && ktwL != null && ktwR != null
      ? asymPart('КТС', ktwL, ktwR)
      : stGap != null && stGap >= 2 && stL != null && stR != null
        ? asymPart('КТС прям. колена', stL, stR)
        : '';
  // 1. Голеностоп: пятки рвутся ИЛИ худшая КТС <9 ИЛИ гастрокнемиус <9 ИЛИ гонометр <35° ИЛИ подпятка чинит паттерн
  if (input.heelRetest === 'better' || (ankleBad && (!input.hipBelowParallel || !input.trunkUpright || input.kneeValgus))) {
    let label = 'Голеностоп (дорсифлексия)';
    let fix = 'Мобилизация голеностопа ежедневно (колено к стене, MWM с лентой) + подъём пятки 2.5 см в приседе до нормы ≥12 см, перепроверка через 4–6 нед' + ankleAsymNote;
    if (gastrocBad && !(ktw != null && ktw < 9) && input.heelsFlat && !goniBad) {
      label = 'Голеностоп (гастрокнемиус)';
      fix = 'Гастрокнемиус (КТС прямым коленом <9): растяжка икры у стены 3×30–45 с + пятка-подпорка 2.5 см в приседе до нормы ≥12 см, перепроверка 4–6 нед' + ankleAsymNote;
    } else if (ktw != null && ktw < 9 && !gastrocBad && input.heelsFlat && !goniBad) {
      label = 'Голеностоп (камбаловидная/талус)';
      fix = 'Камбаловидная/талус (КТС согнутым коленом <9): мобилизация талуса + растяжка камбаловидной (колено согнуто) 3×30–45 с + пятка-подпорка, перепроверка 4–6 нед' + ankleAsymNote;
    } else if (gastrocBad && ktw != null && ktw < 9) {
      label = 'Голеностоп (гастрокнемиус + камбаловидная)';
    }
    return {
      driver: 'ankle',
      label,
      fix,
      confidence: input.heelRetest === 'better' ? 0.9 : 0.7,
    };
  }
  // 1b. Только асимметрия КТС при чистом паттерне: видимых компенсаций нет, но разрыв значим —
  // честный слабый драйвер (чинить отстающую, не весь паттерн).
  if (ankleAsymNote && input.heelsFlat && input.hipBelowParallel && input.trunkUpright && !input.kneeValgus) {
    return {
      driver: 'ankle',
      label: 'Голеностоп (асимметрия сторон)',
      fix: 'Паттерн чистый, но стороны разъехались' + ankleAsymNote,
      confidence: 0.55,
    };
  }
  // 2. ТБС: вальгус без голеностопа / нет глубины при плоских пятках / ROM сгибания бедра <110°.
  // Комплексно, не только ягодица: изолированная закачка средней ягодичной часто НЕ двигает
  // кинематику (Palmer 2015, Wilczyński 2021); работает связка проксимально+дистально 8 нед
  // (CCEP: отведения + наружная ротация бедра + голеностоп/стопа — BMC 2022; Razi 2023: изолированная
  // сила отводящих+ротаторов чинит вальгус на приземлении). Cue «раздвинь пол стопами».
  const hipFlex = fin(input.hipFlexionDeg);
  const hipFlexLow = hipFlex != null && hipFlex < 110;
  const ppNote = input.ppTilt ? ' + задний наклон таза («подворот») — глубина строго до нейтрали, без «добирания» поясницей (ФАИ-паттерн)' : '';
  if (input.kneeValgus || !input.hipBelowParallel || hipFlexLow) {
    if (hipFlexLow && !input.kneeValgus) {
      return {
        driver: 'hip',
        label: 'Тазобедренный (сгибание бедра)',
        fix: `Сгибание бедра ${hipFlex}° (<110) ограничивает глубину: kneeling hip-flexor stretch 2–3×30 с + выпады с темпом + мёртвый жук/гоблет с паузой, cue «глубина до нейтрали таза»; перепроверка SLS` + ppNote + ankleAsymNote,
        confidence: 0.65,
      };
    }
    return {
      driver: 'hip',
      label: 'Тазобедренный (отведение/глубина)',
      fix: 'Комплекс 3×/нед 8 нед: средняя ягодичная + наружные ротаторы бедра (отведения, кламшеллы, сплит-присед с темпом) + голеностоп/стопа дистально (икры, свод) + cue «раздвинь пол стопами»; перепроверка SLS' + ppNote,
      confidence: 0.7,
    };
  }
  // 2b. Только задний наклон таза при чистом паттерне — контроль таза в глубине (слабый драйвер, Kim 2015/PMC10987311)
  if (input.ppTilt) {
    return {
      driver: 'hip',
      label: 'ТБС (контроль таза в глубине)',
      fix: 'Паттерн чистый, но таз «подворачивается» внизу — глубина до нейтрали таза + мёртвый жук/гоблет с паузой 3 с; при боли в тазу — к врачу (ФАИ-паттерн, не диагноз)' + ankleAsymNote,
      confidence: 0.5,
    };
  }
  // 3. Грудной отдел / широчайшие: руки падают; руки на бёдрах чистят поясницу → широчайшие
  if (!input.armsOverMidfoot) {
    const lats = input.handsOnHipsBetter === true || !input.lumbarNeutral;
    return {
      driver: lats ? 'shoulder' : 'thoracic',
      label: lats ? 'Плечевой пояс (широчайшие)' : 'Грудной отдел (разгибание)',
      fix: lats
        ? 'Растяжка широчайших в удлинённой позиции у рамы 3×15–20 с + тяги с паузой в растянутой, без жимов над головой до чистого скрининга'
        : 'Разгибание грудного на ролле посегментно T4–T10 + thread-the-needle 2–3×/нед 4 нед, перепроверка',
      confidence: 0.65,
    };
  }
  // 4. Кор: поясница гуляет при чистых руках/ногах
  if (!input.lumbarNeutral || !input.trunkUpright) {
    return {
      driver: 'core',
      label: 'Кор (стабильность поясницы)',
      fix: 'Мёртвый жук/планка с дыханием + гоблет-присед с паузой 3 с внизу, без осевой нагрузки в отказ до стабильности',
      confidence: 0.6,
    };
  }
  return { driver: 'none', label: 'Драйвер не найден — паттерн чистый', fix: 'Поддерживающий объём + перепроверка через 6–8 нед', confidence: 1 };
}

/** Односторонний скрининг: сплит-присед + RDL на ноге (качество, не объём). */
export interface SingleLegScreen {
  splitSquatL: 'pass' | 'fail' | null; // колено гуляет / пятка рвётся / таз уходит
  splitSquatR: 'pass' | 'fail' | null;
  rdlL: 'pass' | 'fail' | null; // потеря баланса / скругление поясницы
  rdlR: 'pass' | 'fail' | null;
  /** Опциональный угломер FPPA (градусы фронтальной проекции колена, ручной замер с фото).
   * Рабочая норма: межсторонняя разница <10° (литература: MDD<19°, пороги task-specific;
   * 10° — рабочий watch-порог, не медицинский). Без угломера — только качественная оценка. */
  fppaL?: number | null;
  fppaR?: number | null;
}

export const FPPA_SIDE_GAP_DEG = 10;

export function singleLegVerdict(s: SingleLegScreen): { weakSide: 'left' | 'right' | null; text: string } {
  const failsL = [s.splitSquatL, s.rdlL].filter((v) => v === 'fail').length;
  const failsR = [s.splitSquatR, s.rdlR].filter((v) => v === 'fail').length;
  if (failsL === 0 && failsR === 0) {
    // Угломер как tiebreak: качественная оценка чистая, но угломер видит разрыв
    const fl = s.fppaL, fr = s.fppaR;
    if (fl != null && fr != null && Number.isFinite(fl) && Number.isFinite(fr) && Math.abs(fl - fr) >= FPPA_SIDE_GAP_DEG) {
      const weak = fl > fr ? 'left' : 'right';
      return {
        weakSide: weak as 'left' | 'right',
        text: `Односторонний: качественная оценка чистая, но угломер FPPA ${fl}° vs ${fr}° (разрыв ≥${FPPA_SIDE_GAP_DEG}°) — слабее ${weak === 'left' ? 'левая' : 'правая'}, перепроверь движением`,
      };
    }
    return { weakSide: null, text: 'Односторонний: обе стороны чистые' };
  }
  if (failsL === failsR) return { weakSide: null, text: `Односторонний: обе стороны с замечаниями (${failsL}/${failsR}) — чинить симметрично` };
  const weak = failsL > failsR ? 'left' : 'right';
  return {
    weakSide: weak as 'left' | 'right',
    text: `Односторонний: слабее ${weak === 'left' ? 'левая' : 'правая'} (${Math.max(failsL, failsR)} vs ${Math.min(failsL, failsR)}) — унилатеральная первой в сессии`,
  };
}

/** Снимок скрининга для дельты «было/стало» (Brookbush/NASM: re-screen 4–6 нед). */
export interface MovementSnapshot {
  date: string; // YYYY-MM-DD
  fails: string[]; // коды проваленных сегментов: heels/valgus/depth/trunk/arms/lumbar/ppt + D1–D5 (sh-/rot-/hinge-/sq-/ybt-) + R1–R6 (bench-/nhe-/add-/pm-/hip-/hng-/erir-)
  /** v:2 — D1–D5-трекинг; v:3 — плюс R1–R6 (жим/боль/NHE/аддукторы/бедро/шарнир-нагрузка/ER:IR);
   *  без поля — legacy (только OHS) — новые коды в дельте показаны «новым трекингом», не регрессом. */
  v?: number;
}

/** D1–D5 коды снимка (только провалы; пусто — тихо, чистый экран не шумит). */
export interface D1D5CodesInput {
  shoulder?: { pass: boolean; locus: string } | null;
  rotGap?: number | null;
  rotLow?: boolean;
  hinge?: { pass: boolean; locus: string } | null;
  loadedDegraded?: boolean;
  ybtAsymCm?: number | null;
  ybtCompositePct?: number | null;
  ybtTested?: boolean;
}

export function d1d5FailCodes(s: D1D5CodesInput | null | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  if (s.shoulder && !s.shoulder.pass) out.push(`sh-${s.shoulder.locus || 'fail'}`);
  if (s.rotGap != null && Number.isFinite(s.rotGap) && (s.rotGap as number) >= 10) out.push('rot-gap');
  else if (s.rotLow) out.push('rot-low');
  if (s.hinge && !s.hinge.pass && (s.hinge.locus === 'lumbar' || s.hinge.locus === 'neck' || s.hinge.locus === 'both')) {
    out.push(`hinge-${s.hinge.locus}`);
  }
  if (s.loadedDegraded) out.push('sq-degraded');
  if (s.ybtTested) {
    if (s.ybtAsymCm != null && Number.isFinite(s.ybtAsymCm) && (s.ybtAsymCm as number) > 4) out.push('ybt-asym');
    if (s.ybtCompositePct != null && Number.isFinite(s.ybtCompositePct) && (s.ybtCompositePct as number) < 94) out.push('ybt-comp');
  }
  return out;
}

/** Префиксы D1–D5: legacy-снимки (без v:2) их не трекали — это не регресс, а новый трекинг. */
const D1D5_PREFIX = /^(sh-|rot-|hinge-|sq-|ybt-)/;

/** R1–R8 коды снимка (только провалы/правки; пусто — тихо). */
export interface ScreenV3CodesInput {
  /** Уровень вердикта жима: 'fix' | 'watch' | 'ok' | 'not_tested'. */
  benchLevel?: string | null;
  /** Асимметрия NHE в повторах (≥2 — значимо). */
  nheAsymReps?: number | null;
  /** Асимметрия аддукторов, % (≥10 — код). */
  addAsymPct?: number | null;
  /** Уровень боль-мониторинга: 'red' | 'yellow' | 'green' | 'not_tested'. */
  painLevel?: string | null;
  /** ROM сгибания бедра, ° (<110 — код). */
  hipFlexionDeg?: number | null;
  /** Задний наклон таза в глубине. */
  ppTilt?: boolean;
  /** Деградация шарнира под весом. */
  loadedHingeDegraded?: boolean;
  /** ER/IR-ratio (<0.75 — код). */
  erIrRatio?: number | null;
}

export function v3FailCodes(s: ScreenV3CodesInput | null | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  if (s.benchLevel === 'fix') out.push('bench-fix');
  else if (s.benchLevel === 'watch') out.push('bench-watch');
  if (s.nheAsymReps != null && Number.isFinite(s.nheAsymReps) && (s.nheAsymReps as number) >= 2) out.push('nhe-asym');
  if (s.addAsymPct != null && Number.isFinite(s.addAsymPct) && (s.addAsymPct as number) >= 10) out.push('add-asym');
  if (s.painLevel === 'red') out.push('pm-red');
  else if (s.painLevel === 'yellow') out.push('pm-yellow');
  if (s.hipFlexionDeg != null && Number.isFinite(s.hipFlexionDeg) && (s.hipFlexionDeg as number) < 110) out.push('hip-flex');
  if (s.ppTilt) out.push('ppt');
  if (s.loadedHingeDegraded) out.push('hng-degraded');
  if (s.erIrRatio != null && Number.isFinite(s.erIrRatio) && (s.erIrRatio as number) < 0.75) out.push('erir-low');
  return out;
}

/** Префиксы R1–R8: снимки v<3 их не трекали — «новый трекинг», не регресс. */
const V3_PREFIX = /^(bench-|nhe-|add-|pm-|hip-|ppt$|hng-|erir-)/;

export function ohsFailCodes(input: OhsScreenInput): string[] {
  const out: string[] = [];
  if (!input.heelsFlat) out.push('heels');
  if (input.kneeValgus) out.push('valgus');
  if (!input.hipBelowParallel) out.push('depth');
  if (!input.trunkUpright) out.push('trunk');
  if (!input.armsOverMidfoot) out.push('arms');
  if (!input.lumbarNeutral) out.push('lumbar');
  try {
    const fin = (v: unknown): number | null => (v != null && Number.isFinite(v as number) ? (v as number) : null);
    const l = fin(input.kneeToWallL) ?? fin(input.kneeToWallCm);
    const r = fin(input.kneeToWallR) ?? fin(input.kneeToWallCm);
    if (l != null && r != null && Math.abs(l - r) >= 2) out.push('ankle_asym');
  } catch { /* noop */ }
  // Задний наклон таза в глубине (PMC10987311 2024): глубина до нейтрали, ФАИ-паттерн — не диагноз.
  if (input.ppTilt) out.push('ppt');
  return out;
}

export function movementDelta(
  prev: MovementSnapshot | null,
  cur: string[],
): { fixed: string[]; regressed: string[]; tracked: string[]; text: string } {
  if (!prev) return { fixed: [], regressed: [], tracked: [], text: 'Первый снимок — дельта появится после перепроверки через 4–6 нед' };
  const prevSet = new Set(prev.fails || []);
  const curSet = new Set(cur);
  const fixed = Array.from(prevSet).filter((k) => !curSet.has(k));
  const rawRegressed = Array.from(curSet).filter((k) => !prevSet.has(k));
  // Миграция снимков: коды, которых в снимке не было (v<2 — D1–D5; v<3 — R1–R8), показываем
  // отдельной строкой «новый трекинг», а не «регрессом» (иначе каждый старый стор покраснеет).
  let regressed = rawRegressed;
  let tracked: string[] = [];
  const prevV = Number((prev as MovementSnapshot).v || 0);
  if (prevV !== 3) {
    tracked = rawRegressed.filter((k) => (prevV >= 2 ? V3_PREFIX.test(k) : D1D5_PREFIX.test(k) || V3_PREFIX.test(k)));
    regressed = rawRegressed.filter((k) => !tracked.includes(k));
  }
  if (!fixed.length && !regressed.length && !tracked.length) {
    return { fixed, regressed, tracked, text: `vs ${prev.date}: без изменений (${cur.length} замечаний)` };
  }
  const trackNote = tracked.length ? ` · новый трекинг: ${tracked.join(', ')}` : '';
  return {
    fixed,
    regressed,
    tracked,
    text: `vs ${prev.date}: исправлено ${fixed.length ? fixed.join(', ') : '—'} · новое ${regressed.length ? regressed.join(', ') : '—'}${trackNote}`,
  };
}

/** Гейт нагруженных проб для подростков 14–15 (прецедент teenNotes ББ-авто): техника налегке, без рабочих весов. */
export function teenLoadedGate(age: number | null | undefined): { blocked: boolean; note: string } {
  const a = typeof age === 'number' && Number.isFinite(age) ? age : null;
  if (a != null && a >= 14 && a <= 15) {
    return {
      blocked: true,
      note: '14–15 лет: нагруженные пробы (тяга с пола, рабочий жим) в хабе не проводим — техника налегке и контроль; гейты ББ-авто (teenNote) уже в сборке',
    };
  }
  return { blocked: false, note: '' };
}

export interface ScreenPriorityInput {
  painLevel?: 'green' | 'yellow' | 'red' | 'not_tested' | null;
  painText?: string | null;
  driver?: { driver: string; label: string; fix: string; confidence: number } | null;
  asymText?: string | null;
  tendon?: { level: string; text: string } | null;
  bench?: { level: string; text: string } | null;
  posterior?: { nhe?: string | null; adductor?: string | null } | null;
  loadedHinge?: { degraded: boolean; text: string } | null;
  erIr?: string | null;
}

/** Единый список «что чинить первым» (красная боль → драйвер → асимметрии → сухожилия → …). Max 5. */
export function screenPriorityList(s: ScreenPriorityInput | null | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  const push = (txt: string): void => { if (txt && out.length < 5) out.push(`${out.length + 1}. ${txt}`); };
  if (s.painLevel === 'red') push(`Боль (красный): ${s.painText || 'разгрузка по правилу ≤5/<5'} — снизить объём до ≤3/10`);
  else if (s.painLevel === 'yellow') push(`Боль (жёлтый): ${s.painText || 'удержать объём 3–7 дней, не повышать вес'}`);
  const d = s.driver;
  if (d && d.driver && d.driver !== 'none' && d.confidence >= 0.5) push(`${d.label}: ${d.fix}`);
  if (s.asymText && !/значимых нет/.test(s.asymText)) push(s.asymText);
  if (s.tendon && s.tendon.level === 'stop') push(`Сухожилия (стоп): ${s.tendon.text}`);
  if (s.loadedHinge?.degraded) push(`Шарнир под весом: ${s.loadedHinge.text}`);
  if (s.bench?.level === 'fix') push(`Жим: ${s.bench.text}`);
  if (s.posterior?.nhe && !/в порядке/.test(s.posterior.nhe)) push(s.posterior.nhe);
  if (s.posterior?.adductor && !/не замерялись|симметрично/.test(s.posterior.adductor)) push(s.posterior.adductor);
  if (s.erIr && /0\.\d+ \(<0\.75\)/.test(s.erIr)) push(`Плечо ER:IR: ${s.erIr}`);
  if (!out.length) return ['Приоритетов нет: паттерн чистый — поддерживающий объём и перепроверка 6–8 нед'];
  return out;
}
