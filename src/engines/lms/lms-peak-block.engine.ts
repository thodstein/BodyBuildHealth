/**
 * lms-peak-block.engine.ts — ПИК-БЛОК ПЛ по окну «недель до старта».
 *
 * Закрывает gap (Aug 2026): раньше «Недель до старта» (weeksToMeet) было
 * ИНФОРМАЦИОННЫМ полем (сгонка веса, готовность, прогноз ПМ), а длину тапера
 * задавал отдельный «Тапер-недель к циклу» (taperWeeksToAdd). Пользователь ставил
 * 8 недель до старта, а получал 2-4 недели тапера + mock meet — блок не равнялся окну.
 *
 * Теперь weeksToMeet = окно пик-блока. Раскладка внутри окна (хронологически):
 *   ramp (вход в пик) → mock (за 10-14 дней) → taper (глубокая разгрузка) → meet (1) [→ post после окна]
 *
 * - ramp: плавный вход (объём ~1.0 → 0.85, интенсивность сохранена) — заполняет
 *   окно до глубокого тапера, если окно длиннее taper+mock+meet.
 * - taper: канон buildPLTaperCurve (taperWeeksToAdd, 1-4) под выбранную модель.
 * - mock/meet/post: как в appendPLTaperWeeks (прикиды-синглы / день старта / разгрузка).
 *
 * Если окно КОРОЧЕ taper+mock+meet — глубокий тапер клампится, предупреждение.
 * Итог: длина блока = окно (+пост после окна). «Недель до старта» реально работает.
 */
import {
  buildPLTaperCurve,
  isoAddDays,
  weightGoalVolumeMult,
  type TaperCurvePoint,
  type TaperMode,
  type TaperWeightGoal,
} from './lms-taper.engine';

export interface PLPeakBlockLayoutOpts {
  /** Окно до старта (weeksToMeet), 1-52. */
  windowWeeks: number;
  /** Запрошенные недели глубокого тапера (taperWeeksToAdd), 1-4. */
  taperWeeks: number;
  /** Раскладка тапера (канон): classic / pl / pro / wf. */
  mode?: TaperMode;
  /** Весовая цель тапера (влияет на объём). */
  weightGoal?: TaperWeightGoal;
  /** Ставить mock meet за 10-14 дней до старта. */
  mockMeet?: boolean;
  /** Неделя соревнований в конце. */
  meetWeek?: boolean;
  /** Пост-соревновательная неделя ПОСЛЕ окна. */
  postMeet?: boolean;
  /** Весь окно = непрерывный тапер (без отдельного «входа в пик»): глубокая
   *  плавная кривая разгрузки на все доступные недели окна. Для classic тянется
   *  до 12 нед; pl/pro/wf остаются в пределах своего протокола. */
  wholeWindowAsTaper?: boolean;
}

export interface PLPeakBlockLayout {
  windowWeeks: number;
  /** Фактические недели глубокого тапера (после клампа). */
  taperWeeks: number;
  /** Недели входа в пик (ramp) перед тапером. */
  rampWeeks: number;
  mockWeeks: number;
  meetWeeks: number;
  postWeeks: number;
  /** Итоговая длина блока = windowWeeks + postWeeks. */
  totalWeeks: number;
  /** Предупреждения (напр. «тапер длиннее окна»). */
  warnings: string[];
  /** Сводка для UI-предпросмотра. */
  summary: string;
  /** Кривая блока хронологически (ramp + taper); mock/meet/post добавляются отдельно. */
  curve: TaperCurvePoint[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Кривая входа в пик: плавное снижение объёма ~1.0 → 0.85, интенсивность сохранена. */
function buildRampCurve(rampWeeks: number, weightGoal: TaperWeightGoal | undefined): TaperCurvePoint[] {
  const mult = weightGoalVolumeMult(weightGoal);
  return Array.from({ length: rampWeeks }, (_, i) => {
    const t = rampWeeks === 1 ? 0 : i / (rampWeeks - 1);
    const volumePct = r2(Math.max(0.8, (1 - t * 0.15)) * mult);
    return {
      week: i + 1,
      volumePct,
      intensityPct: 1,
      intensityMode: 'preserve' as const,
      rirShift: 0,
      label: `Вход в пик ${i + 1} (объём ×${volumePct}, интенсивность сохранена)`,
      focus: 'Плавное вхождение в пик: объём слегка снижается, веса и RIR без изменений.',
    };
  });
}

/**
 * Раскладка пик-блока по окну до старта. Чистая функция — UI предпросмотр и
 * движок (appendPLTaperWeeks) строят блок из одного и того же layout.
 */
export function buildPLPeakBlockLayout(opts: PLPeakBlockLayoutOpts): PLPeakBlockLayout {
  const warnings: string[] = [];
  const windowWeeks = Math.max(1, Math.min(52, Math.round(opts.windowWeeks || 1)));
  const mockWeeks = opts.mockMeet ? 1 : 0;
  const meetWeeks = opts.meetWeek ? 1 : 0;
  const postWeeks = opts.postMeet ? 1 : 0;
  const mode: TaperMode = opts.mode ?? 'classic';
  const weightGoal = opts.weightGoal;

  // Сколько недель в окне доступно под кривую (ramp + taper): минус mock и meet.
  const available = Math.max(1, windowWeeks - mockWeeks - meetWeeks);
  let taperWeeks = Math.max(1, Math.min(4, Math.round(opts.taperWeeks || 2)));
  if (taperWeeks > available) {
    warnings.push(`Тапер (${taperWeeks} нед) длиннее окна до старта (${windowWeeks} нед) с учётом mock/соревнований — глубокий тапер урезан до ${available} нед.`);
    taperWeeks = available;
  }
  // P2-4: «весь окно = тапер» — без входа в пик, вся доступная длина — кривая тапера.
  let rampWeeks = available - taperWeeks;
  if (opts.wholeWindowAsTaper) {
    rampWeeks = 0;
    taperWeeks = available;
    // Для не-classic протоколов (pl/pro/wf) кривая не растягивается — оставляем
    // только протокол (финал), вход отключаем без предупреждения.
    if (mode !== 'classic' && taperWeeks > 4) {
      taperWeeks = 4;
      rampWeeks = Math.max(0, available - taperWeeks);
    }
  }

  const rampCurve = buildRampCurve(rampWeeks, weightGoal);
  const taperCurve = buildPLTaperCurve({ taperWeeks, mode, weightGoal });

  const parts: string[] = [];
  if (rampWeeks > 0) parts.push(`вход ${rampWeeks}`);
  if (mockWeeks > 0) parts.push('mock 1');
  parts.push(`тапер ${taperWeeks}`);
  if (meetWeeks > 0) parts.push('соревнования 1');
  if (postWeeks > 0) parts.push('пост 1');
  const summary = `Пик-блок на ${windowWeeks + postWeeks} нед (окно ${windowWeeks}): ${parts.join(' + ')}`;

  return {
    windowWeeks,
    taperWeeks,
    rampWeeks,
    mockWeeks,
    meetWeeks,
    postWeeks,
    totalWeeks: windowWeeks + postWeeks,
    warnings,
    summary,
    curve: [...rampCurve, ...taperCurve],
  };
}

export { buildPLTaperCurve, weightGoalVolumeMult, isoAddDays };

// ═══════════════════════════════════════════════════════════════════════════
// Календарная разметка недель пик-блока (P2-6) — единые хелперы для всех путей.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Даты недель ОТ даты старта НАЗАД (appendPLTaperWeeks):
 * последняя неделя блока заканчивается на meetIso (+7 если есть пост-неделя),
 * каждая предыдущая — на 7 дней раньше.
 */
export function dateWeeksBackward<T extends { weekStart?: string; weekEnd?: string }>(
  weeks: T[],
  meetIso: string,
  postOn?: boolean,
): T[] {
  if (!weeks || weeks.length === 0) return weeks;
  const lastEnd = postOn ? isoAddDays(meetIso, 7) : meetIso;
  const ends: (string | null)[] = new Array(weeks.length);
  ends[weeks.length - 1] = lastEnd;
  for (let i = weeks.length - 2; i >= 0; i--) {
    const next = ends[i + 1];
    ends[i] = next ? isoAddDays(next, -7) : null;
  }
  return weeks.map((w, i) => {
    const end = ends[i];
    if (!end) return w;
    const start = isoAddDays(end, -6);
    return start ? { ...w, weekStart: start, weekEnd: end } : w;
  });
}

/**
 * Даты недель ВПЕРЁД от начала сезона (buildPLSeasonPeaks): неделя i (1-based)
 * занимает [start+(i-1)*7, start+i*7-1].
 */
export function dateWeeksForward<T extends { week: number; weekStart?: string; weekEnd?: string }>(
  weeks: T[],
  startIso: string,
): T[] {
  if (!weeks || weeks.length === 0) return weeks;
  return weeks.map(w => {
    const start = isoAddDays(startIso, (w.week - 1) * 7);
    const end = isoAddDays(startIso, (w.week - 1) * 7 + 6);
    return start && end ? { ...w, weekStart: start, weekEnd: end } : w;
  });
}
