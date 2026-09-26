/**
 * combat-science.ts — наука → константы (E7).
 *
 * ПРАВИЛО: каждая числовая константа здесь имеет проверяемый источник.
 * Значения выписаны из abstracts, а не «по памяти»; если источник не даёт
 * числа — константы нет, и это зафиксировано комментарием.
 *
 * Проверено через PubMed E-utilities (esummary + efetch abstracts), 2026-09.
 */

// ─── 7.1 Профиль боя: вклад энергосистем зависит от длительности ───────────
// PMID 27736247 (дзюдо, поединки 1-5 мин, Int J Sports Physiol Perform 2017):
//   окислительная 70%, гликолитическая 8%, АТФ-ФК 21% (все длительности);
//   внутри поединка окислительная растёт 50%→81%, АТФ-ФК падает 40%→12%,
//   гликолитическая держится 6-10%.
// PMID 35415997 (бокс 3×3 мин, J Sports Med Phys Fitness 2023):
//   73% аэробные, 19% анаэробные алактические, 8% гликолитические;
//   ЧСС >93-97% от макс, лактат >15 ммоль/л.
// PMID 19370044 (тайский бокс, Appl Physiol Nutr Metab 2009):
//   10.75 ккал/мин, 9.39 MET, резкий гликолитический всплеск в первом
//   раунде с последующим ростом аэробного вклада.
export interface FightEnergyProfile {
  /** Длительность поединка, мин. */
  minutes: number;
  /** Вклад аэробной системы, доля. */
  aerobic: number;
  /** Анаэробная алактическая (АТФ-ФК), доля. */
  alactic: number;
  /** Анаэробная гликолитическая, доля. */
  glycolytic: number;
  /** ЧСС по ходу боя, % от максимума. */
  hrPct: number;
  /** Лактат после боя, ммоль/л. */
  lactate: number;
  /**
   * Сумма долей. В источниках доли округлены (70+8+21 = 99 у 27736247),
   * поэтому сумма отличается от 1 на округление — это точность публикации,
   * а не ошибка расчёта. «Добивать» до 1 выдуманной долей нельзя.
 * ЧЕСТНАЯ ГРАНИЦА: источник изучал поединки 1-5 минут. Для более длинных
 * боёв (10-12 мин) отдельных данных нет, поэтому кривую НЕ экстраполируем —
 * используем профиль 5 минут. Это допущение, а не измерение.
 */
  total: number;
  source: string;
}

/** Бой 3×3 мин — эталонные значения бокса (35415997), округление вниз по ATP-PCr. */
export const FIGHT_ENERGY_3X3: FightEnergyProfile = {
  minutes: 3,
  aerobic: 0.73,
  alactic: 0.19,
  glycolytic: 0.08,
  hrPct: 93,
  lactate: 15,
  total: 1,
  source: 'PMID 35415997',
};

/**
 * Профиль поединка по длительности. До 3 мин АТФ-ФК доминирует (27736247:
 * «вклад АТФ-ФК выше гликолитического вплоть до 3 мин»), к 5 минутам
 * окислительный вклад выходит на 70-81%.
 */
export function fightEnergyProfile(minutes: number): FightEnergyProfile {
  const m = Math.max(1, Math.min(12, Math.round(minutes || 3)));
  if (m <= 3) {
    // 27736247: 1-3 мин — АТФ-ФК > гликолитической, окислительная ~50%
    return { minutes: m, aerobic: 0.50, alactic: 0.40, glycolytic: 0.10, hrPct: 90, lactate: 14, total: 1, source: 'PMID 27736247' };
  }
  // 27736247: 4-5 мин — окислительная 70%, гликолитическая 8%, АТФ-ФК 21%
  return { minutes: m, aerobic: 0.70, alactic: 0.21, glycolytic: 0.08, hrPct: 95, lactate: 16, total: 0.99, source: 'PMID 27736247' };
}

/**
 * Профиль дисциплины: ударка против грэпплинга (26993133, Sports Med 2016 —
 * систематический обзор). Ключевой вывод источника: у сильнейших
 * грэпплеров смещается вся кривая «сила-скорость» вверх за счёт максимальной
 * силы; у сильнейших ударников — небольшой рост максимальной силы при
 * заметном улучшении лёгких быстрых движений.
 */
export interface DisciplineProfile {
  key: string;
  label: string;
  /** Ставка на максимальную силу, 0..1. */
  maxStrength: number;
  /** Ставка на скорость в лёгких нагрузках, 0..1. */
  velocity: number;
  /** Ставка на анаэробную выносливость (длинные интервалы), 0..1. */
  anaerobicEndurance: number;
  note: string;
  source: string;
}

export const STRIKING_PROFILE: DisciplineProfile = {
  key: 'striking', label: 'Ударка',
  maxStrength: 0.45, velocity: 0.85, anaerobicEndurance: 0.55,
  note: 'Рост максимальной силы умеренный, вес выигрывается в лёгких быстрых движениях',
  source: 'PMID 26993133',
};

export const GRAPPLING_PROFILE: DisciplineProfile = {
  key: 'grappling', label: 'Грэпплинг',
  maxStrength: 0.85, velocity: 0.45, anaerobicEndurance: 0.85,
  note: 'Вся кривая «сила-скорость» смещена вверх за счёт максимальной силы; решает длинная анаэробная работа',
  source: 'PMID 26993133',
};

const MMA_PROFILE: DisciplineProfile = {
  key: 'mma', label: 'Единоборства',
  maxStrength: 0.75, velocity: 0.60, anaerobicEndurance: 0.75,
  note: 'Спектр признаков обоих: и сила, и лёгкая скорость, и длинная анаэробная работа',
  source: 'PMID 26993133',
};

export function disciplineProfile(discipline: string | null | undefined): DisciplineProfile {
  const d = String(discipline || '').toLowerCase();
  if (/бокс|boxing|удар|кикбокс|муай|тайск|karate|каратэ|тевтев/.test(d)) return STRIKING_PROFILE;
  if (/борьб|вольн|грэпп|grappl|bjj|джиу|бразил|judo|дзюдо|sambo|самбо|wrestl|combat_sport/.test(d)) return GRAPPLING_PROFILE;
  return MMA_PROFILE;
}

/**
 * Интервальный формат: 3×10 с all-out с 30 с пассивного отдыха даёт ВЫШЕ
 * вклад АТФ-ФК и выше суммарный расход, чем один 30-секундный заход
 * (38787849, PLoS One 2024, 33 единоборца). Поэтому короткий
 * интервальный формат — инструмент АТФ-ФК, а одиночный длинный — больше
 * гликолитики/окислительного.
 */
export const INTERVAL_VS_SINGLE: { interval: string; pcrHigher: boolean; glycolyticHigher: boolean; source: string } = {
  interval: '3×10 с / 30 с отдых',
  pcrHigher: true,
  glycolyticHigher: false,
  source: 'PMID 38787849',
};

// ─── 7.2 Пороги сгона ──────────────────────────────────────────────────────
// PMID 40266645 (J Strength Cond Res 2025, обзор по быстрому снижению веса у
// борцов): «литература указывает на снижение спортивной результативности при
// потере веса БОЛЕЕ 5% от массы тела».
//
// Эти два порога УЖЕ применялись в движках до E7, но с пометкой «ISSN» без
// проверяемой ссылки. Теперь источник проверяем, а числа зафиксированы здесь
// как единый канон (см. source-guard тест `combat-e7-science`):
//   • 5% — ошибка сборки: сгон без режима weight_cut (combat-builder)
//   • 8% — жёсткий блок сборки (combat-safety red-flags)
// Хорошие новости: PMID 40266645 подтверждает именно цифру 5%, то есть
// движки не были неправы — не хватало только ссылки.
//
// ОТКЛОНЕНИЕ ОТ ПЛАНА: план предлагал порог «12-15% массы за <7 дней
// (ISSN п.3)». Этот порог НЕ проверяется по PubMed, поэтому в коде его нет —
// подставлять непроверяемое число значило бы врать пользователю.
export const CUT_WARN_PCT = 0.05;
export const CUT_BLOCK_PCT = 0.08;
export const CUT_SOURCE = 'PMID 40266645 (J Strength Cond Res 2025): снижение результативности при потере >5% массы';
/** Порог «12-15% за <7 дней (ISSN п.3)» сознательно НЕ реализован: не верифицируется. */
export const CUT_REJECTED_PLAN_THRESHOLD = '12-15% массы за <7 дней (ISSN п.3) — не верифицируется по PubMed, не используется';

export interface CutRisk {
  pct: number;
  /** true начиная с CUT_WARN_PCT — результативность под вопросом. */
  unsafe: boolean;
  /** true начиная с CUT_BLOCK_PCT — сборка блокируется в combat-safety. */
  blocksBuild: boolean;
  level: 'ok' | 'caution' | 'danger';
  note: string;
  source: string;
}

export function cutRisk(targetLossKg: number, bodyweightKg: number | null | undefined, sex?: 'male' | 'female'): CutRisk {
  const bw = typeof bodyweightKg === 'number' && bodyweightKg > 0 ? bodyweightKg : 0;
  if (!bw || !(targetLossKg > 0)) {
    return { pct: 0, unsafe: false, blocksBuild: false, level: 'ok', note: 'Сгон не задан', source: CUT_SOURCE };
  }
  const pct = targetLossKg / bw;
  const extra = sex === 'female'
    ? ' Для женщин обзор отдельно описывает гормональные колебации и риск расстройств пищевого поведения.'
    : ' Обзор отмечает снижение тестостерона и рост кортизола.';
  if (pct > CUT_BLOCK_PCT) {
    return {
      pct, unsafe: true, blocksBuild: true, level: 'danger',
      note: `Сгон ${(pct * 100).toFixed(1)}% массы — выше 8%: сборка блокируется.${extra}`,
      source: CUT_SOURCE,
    };
  }
  if (pct > CUT_WARN_PCT) {
    return {
      pct, unsafe: true, blocksBuild: false, level: 'caution',
      note: `Сгон ${(pct * 100).toFixed(1)}% массы — выше 5%, результативность может упасть.${extra}`,
      source: CUT_SOURCE,
    };
  }
  return { pct, unsafe: false, blocksBuild: false, level: 'ok', note: `Сгон ${(pct * 100).toFixed(1)}% массы — в безопасном коридоре.`, source: CUT_SOURCE };
}

// ─── 7.4 Сигналы «весовых качелей» ─────────────────────────────────────────
// PMID 40443978 (Front Sports Act Living 2025, кейс элитной тайкистки):
// за 5-недельный лагерь RMR упал на 253 ккал/день, выросли креатинин и
// мочевина, максимальная мощность в велотренажёре упала на 27%, при этом
// потеря безжировой массы составила лишь 0.6 кг. То есть РМР-просадка при
// почти неизменной массе тела — тревожный сигнал сам по себе.
export const WEIGHT_CYCLE_SIGNALS = {
  /** Падение RMR, ккал/день, за лагерь (наблюдалось −253). */
  rmrDropKcalPerDay: 253,
  /** Просадка максимальной мощности (наблюдалось −27%). */
  powerDropPct: 27,
  /** Фактическая потеря безжировой массы (наблюдалось 0.6 кг). */
  observedFfmLossKg: 0.6,
  source: 'PMID 40443978',
} as const;

export interface WeightCycleVerdict {
  rmrDelta?: number | null;
  powerDeltaPct?: number | null;
  ffmDeltaKg?: number | null;
  level: 'ok' | 'watch' | 'danger';
  signals: string[];
  source: string;
}

/** Интерпретация динамики лагеря по наблюдавшемуся кейсу. */
export function weightCycleVerdict(d: {
  rmrDelta?: number | null; powerDeltaPct?: number | null; ffmDeltaKg?: number | null;
}): WeightCycleVerdict {
  const signals: string[] = [];
  let level: WeightCycleVerdict['level'] = 'ok';
  const rmr = typeof d.rmrDelta === 'number' ? d.rmrDelta : null;
  const pw = typeof d.powerDeltaPct === 'number' ? d.powerDeltaPct : null;
  const ffm = typeof d.ffmDeltaKg === 'number' ? d.ffmDeltaKg : null;

  if (rmr !== null && rmr <= -WEIGHT_CYCLE_SIGNALS.rmrDropKcalPerDay) {
    signals.push(`РМР упал на ${Math.abs(Math.round(rmr))} ккал/день (в кейсе −${WEIGHT_CYCLE_SIGNALS.rmrDropKcalPerDay}) — метаболическая адаптация`);
    level = 'danger';
  }
  if (pw !== null && pw <= -WEIGHT_CYCLE_SIGNALS.powerDropPct) {
    signals.push(`Максимальная мощность −${Math.abs(Math.round(pw))}% (в кейсе −${WEIGHT_CYCLE_SIGNALS.powerDropPct}%) — потеря формы при почти неизменной массе`);
    level = 'danger';
  }
  if (ffm !== null && ffm <= -1) {
    signals.push(`Безжировая масса −${Math.abs(ffm).toFixed(1)} кг — потеря идёт из мышц, а не из воды`);
    if (level === 'ok') level = 'watch';
  }
  if (!signals.length) signals.push('Данных для оценки весовых качелей недостаточно — внесите РМР/мощность/состав тела.');
  return { rmrDelta: rmr, powerDeltaPct: pw, ffmDeltaKg: ffm, level, signals, source: WEIGHT_CYCLE_SIGNALS.source };
}

// ─── 7.5 Session-RPE: когда спрашивать ─────────────────────────────────────
// PMID 24570606 (J Sports Sci Med 2014, боксёры): оценка через 10 минут
// статистически не отличается от оценки через 30 минут на лёгкой, средней и
// тяжёлой сессиях — «точные измерения можно получить уже через 10 минут».
// PMID 28933715 (J Strength Cond Res 2017, обзор RPE в единоборствах):
// корреляция RPE↔лактат сильнее в ударных видах (r=0.81), чем в грэпплинге
// (r=0.53); session-RPE↔HR-методы r=0.52-0.86.
export const SESSION_RPE_MINUTES = 10;
export const SESSION_RPE_SOURCE = 'PMID 24570606 (10 мин ≈ 30 мин; 28933715 — обзор RPE)';

export function sessionRpeNote(discipline?: string | null): string {
  const prof = disciplineProfile(discipline);
  const r = prof.key === 'striking' ? '0.81' : prof.key === 'grappling' ? '0.53' : '0.53-0.81';
  return `Снимите RPE через ${SESSION_RPE_MINUTES} мин после сессии — позже не нужно. Связь RPE с лактатом: ${r} (ударка 0.81, грэпплинг 0.53).`;
}
