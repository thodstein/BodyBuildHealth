/**
 * activity-catalog.ts — PRO-каталог активности + смежные таблицы (Ainsworth 2024, BHI Maughan 2016, DIAAS FAO 2013)
 * Канон metabolic-hub: расширяет MET_CATALOG (18) до 60 без ломки backward compat.
 * Источники: Ainsworth Compendium 2011/2024 MET, FAO/WHO PAL 2001, Maughan BHI 2016,
 * FAO DIAAS 2013, Baker 2017 sweat Na, Periard 2015 acclimation.
 */

export interface ActivityCatalogEntry { met: number; label: string; group: 'strength' | 'cardio' | 'sport' | 'daily' | 'work'; }
export type ProfessionKind = 'sedentary' | 'standing' | 'physical';

export const PROFESSION_PAL: Record<ProfessionKind, number> = {
  sedentary: 1.40, // офис FAO sedentary 1.40-1.69
  standing: 1.55, // на ногах / торговля
  physical: 1.75, // стройка / курьер / производство
};

export const ACTIVITY_CATALOG_60: Record<string, ActivityCatalogEntry> = {
  strength: { met: 6.0, label: 'Силовая 6 MET', group: 'strength' },
  bodybuilding: { met: 6.0, label: 'ББ 6', group: 'strength' },
  powerlifting: { met: 6.5, label: 'Пауэрлифтинг 6.5', group: 'strength' },
  crossfit: { met: 8.0, label: 'Кроссфит 8', group: 'strength' },
  hiit: { met: 9.0, label: 'HIIT 9', group: 'strength' },
  calisthenics: { met: 7.0, label: 'Калистеника 7', group: 'strength' },
  kettlebell: { met: 7.5, label: 'Гири 7.5', group: 'strength' },
  trx: { met: 6.0, label: 'TRX 6', group: 'strength' },
  running_easy: { met: 8.5, label: 'Бег легко 8.5', group: 'cardio' },
  running_moderate: { met: 10.0, label: 'Бег средн. 10', group: 'cardio' },
  running_hard: { met: 12.5, label: 'Бег тяж. 12.5', group: 'cardio' },
  running_trail: { met: 9.5, label: 'Трейл 9.5', group: 'cardio' },
  cycling: { met: 7.5, label: 'Вело 7.5', group: 'cardio' },
  cycling_hard: { met: 10.0, label: 'Вело тяж. 10', group: 'cardio' },
  swimming: { met: 8.0, label: 'Плавание 8', group: 'cardio' },
  swimming_easy: { met: 6.0, label: 'Плавание легко 6', group: 'cardio' },
  rowing: { met: 7.0, label: 'Гребля 7', group: 'cardio' },
  elliptical: { met: 5.5, label: 'Эллипс 5.5', group: 'cardio' },
  stair: { met: 8.0, label: 'Степпер 8', group: 'cardio' },
  treadmill_walk: { met: 4.0, label: 'Дорожка ходьба 4', group: 'cardio' },
  skipping: { met: 10.0, label: 'Скакалка 10', group: 'cardio' },
  walking: { met: 3.8, label: 'Ходьба 3.8', group: 'cardio' },
  walking_brisk: { met: 4.3, label: 'Ходьба быстр. 4.3', group: 'cardio' },
  walking_hill: { met: 5.5, label: 'Ходьба в гору 5.5', group: 'cardio' },
  hiking: { met: 6.0, label: 'Хайкинг 6', group: 'cardio' },
  yoga: { met: 3.0, label: 'Йога 3', group: 'cardio' },
  pilates: { met: 4.0, label: 'Пилатес 4', group: 'cardio' },
  stretching: { met: 2.5, label: 'Растяжка 2.5', group: 'cardio' },
  dancing: { met: 5.0, label: 'Танцы 5', group: 'cardio' },
  football: { met: 7.0, label: 'Футбол 7', group: 'sport' },
  basketball: { met: 8.0, label: 'Баскетбол 8', group: 'sport' },
  volleyball: { met: 5.0, label: 'Волейбол 5', group: 'sport' },
  tennis: { met: 7.0, label: 'Теннис 7', group: 'sport' },
  boxing: { met: 9.0, label: 'Бокс 9', group: 'sport' },
  mma: { met: 10.0, label: 'MMA 10', group: 'sport' },
  wrestling: { met: 8.5, label: 'Борьба 8.5', group: 'sport' },
  armwrestling: { met: 5.0, label: 'Армрестлинг 5', group: 'sport' },
  skiing: { met: 8.0, label: 'Лыжи 8', group: 'sport' },
  snowboard: { met: 6.5, label: 'Сноуборд 6.5', group: 'sport' },
  skating: { met: 7.0, label: 'Коньки 7', group: 'sport' },
  hockey: { met: 8.5, label: 'Хоккей 8.5', group: 'sport' },
  rugby: { met: 8.0, label: 'Регби 8', group: 'sport' },
  handball: { met: 8.0, label: 'Гандбол 8', group: 'sport' },
  badminton: { met: 5.5, label: 'Бадминтон 5.5', group: 'sport' },
  table_tennis: { met: 4.0, label: 'Наст. теннис 4', group: 'sport' },
  golf: { met: 3.5, label: 'Гольф 3.5', group: 'sport' },
  climbing: { met: 8.0, label: 'Скалолазание 8', group: 'sport' },
  surfing: { met: 6.0, label: 'Сёрф 6', group: 'sport' },
  kayaking: { met: 6.5, label: 'Каякинг 6.5', group: 'sport' },
  horse_riding: { met: 4.5, label: 'Верховая 4.5', group: 'sport' },
  gardening: { met: 4.0, label: 'Сад/дача 4', group: 'daily' },
  cleaning: { met: 3.5, label: 'Уборка 3.5', group: 'daily' },
  cooking: { met: 2.5, label: 'Готовка 2.5', group: 'daily' },
  shopping: { met: 3.0, label: 'Покупки пешком 3', group: 'daily' },
  dog_walk: { met: 3.5, label: 'Собака 3.5', group: 'daily' },
  stairs_daily: { met: 5.0, label: 'Лестница быт 5', group: 'daily' },
  office_work: { met: 1.5, label: 'Офис 1.5', group: 'work' },
  standing_work: { met: 2.2, label: 'Работа стоя 2.2', group: 'work' },
  retail_work: { met: 3.0, label: 'Торговля 3', group: 'work' },
  construction: { met: 5.5, label: 'Стройка 5.5', group: 'work' },
  courier: { met: 5.0, label: 'Курьер 5', group: 'work' },
  warehouse: { met: 4.5, label: 'Склад 4.5', group: 'work' },
  farming: { met: 5.0, label: 'Ферма 5', group: 'work' },
  nursing: { met: 3.5, label: 'Медсестра 3.5', group: 'work' },
};

/** Единая точка PAL PRO: профессия + MET-часы + шаги/стоя/fidget. Backward compat с computePalFromMet. */
export function computePalFromActivity(opts: {
  profession?: ProfessionKind;
  basePal?: number;
  metHoursPerWeek?: number;
  standingHours?: number;
  fidgetLevel?: 1 | 2 | 3;
  dailySteps?: number;
}): number {
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
  const base = opts.basePal ?? (opts.profession ? PROFESSION_PAL[opts.profession] : 1.55);
  const metAdd = clamp((opts.metHoursPerWeek ?? 0) * 0.0067, 0, 0.40);
  const standAdd = opts.standingHours && opts.standingHours > 4 ? (opts.standingHours - 4) * 0.008 : 0;
  const fidgetAdd = opts.fidgetLevel === 3 ? 0.02 : opts.fidgetLevel === 1 ? -0.015 : 0;
  const steps = opts.dailySteps ?? 0;
  const stepsAdd = steps >= 15000 ? 0.06 : steps >= 10000 ? 0.04 : steps >= 7500 ? 0.02 : 0;
  return clamp(base + metAdd + standAdd + fidgetAdd + stepsAdd, 1.25, 2.40);
}

/** Парсер расписания v2: RU+EN, мин/ч/км, мультипликатор 2×, дистанция бега. */
export function parseWeeklyScheduleTextV2(text: string): Array<{ key: string; hours: number }> | null {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  const out: Array<{ key: string; hours: number }> = [];
  const parseHours = (kw: string): number | null => {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mMin = lower.match(new RegExp(esc + '.*?([0-9]+[\\.,]?[0-9]*)\\s*(мин|м\\b|min)', 'i'));
    if (mMin) return Number(mMin[1].replace(',', '.')) / 60;
    const mKm = lower.match(new RegExp(esc + '.*?([0-9]+[\\.,]?[0-9]*)\\s*(км|km)', 'i'));
    if (mKm) {
      const km = Number(mKm[1].replace(',', '.'));
      if (kw.includes('бег') || kw.includes('run')) return km / 10; // 10 км/ч средний темп
      if (kw.includes('вело') || kw.includes('cycl')) return km / 22;
      if (kw.includes('ходьб') || kw.includes('walk')) return km / 4.5;
      return km / 10;
    }
    const mHour = lower.match(new RegExp(esc + '.*?([0-9]+[\\.,]?[0-9]*)\\s*(ч|час|h)', 'i'));
    if (mHour) return Number(mHour[1].replace(',', '.'));
    const mMult = lower.match(new RegExp('([0-9]+)\\s*[×x]\\s*' + esc, 'i'));
    if (mMult) return Number(mMult[1]) * 1;
    const mAny = lower.match(new RegExp(esc + '.*?([0-9]+[\\.,]?[0-9]*)', 'i'));
    if (mAny) {
      let h = Number(mAny[1].replace(',', '.'));
      if (h > 10) h /= 60;
      return h;
    }
    return 1;
  };
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
  const add = (kws: string[], key: string): void => {
    for (const k of kws) {
      if (lower.includes(k)) {
        const h = parseHours(k);
        if (h != null) { out.push({ key, hours: clamp(h, 0.25, 15) }); break; }
      }
    }
  };
  add(['силов', 'кач', 'жим', 'тяг', 'strength', 'lift', 'бб'], 'strength');
  add(['пауэр', 'powerlift'], 'powerlifting');
  add(['кроссфит', 'crossfit'], 'crossfit');
  add(['hiit', 'табата', 'табат'], 'hiit');
  add(['калистен', 'calisthen'], 'calisthenics');
  add(['гир', 'kettlebell'], 'kettlebell');
  add(['бег', 'run', 'пробеж'], 'running_moderate');
  add(['трейл', 'trail'], 'running_trail');
  add(['вело', 'cycl', 'байк', 'bike'], 'cycling');
  add(['плав', 'swim', 'бассейн'], 'swimming');
  add(['гребл', 'row'], 'rowing');
  add(['эллипс', 'ellipt'], 'elliptical');
  add(['степпер', 'stair'], 'stair');
  add(['скакалк', 'skipping', 'rope'], 'skipping');
  add(['ходьб', 'walk', 'шаг'], 'walking');
  add(['хайкинг', 'hiking', 'поход'], 'hiking');
  add(['йога', 'yoga'], 'yoga');
  add(['пилат', 'pilat'], 'pilates');
  add(['растяжк', 'stretch'], 'stretching');
  add(['танц', 'danc'], 'dancing');
  add(['футбол', 'football', 'soccer'], 'football');
  add(['баскет', 'basket'], 'basketball');
  add(['волейбол', 'volley'], 'volleyball');
  add(['теннис', 'tennis'], 'tennis');
  add(['бокс', 'box'], 'boxing');
  add(['mma', 'мма'], 'mma');
  add(['борьб', 'wrestl'], 'wrestling');
  add(['армрестл', 'armwrestl'], 'armwrestling');
  add(['лыж', 'ski'], 'skiing');
  add(['сноуборд', 'snowboard'], 'snowboard');
  add(['коньк', 'skat'], 'skating');
  add(['хоккей', 'hockey'], 'hockey');
  add(['регби', 'rugby'], 'rugby');
  add(['скалолаз', 'climb'], 'climbing');
  add(['сад', 'дач', 'garden'], 'gardening');
  add(['уборк', 'clean'], 'cleaning');
  return out.length ? out : null;
}

/** Популяционная оценка sweat-rate без взвешивания (ACSM): 0.5–2.0 л/ч. */
export function estimateSweatRatePopulation(opts: {
  intensity: 'easy' | 'moderate' | 'hard';
  environment: 'cool' | 'temperate' | 'hot' | 'hot_humid';
  weightKg: number;
  acclimated?: boolean;
}): { rateLPerH: number; range: [number, number]; note: string } {
  const base = opts.intensity === 'easy' ? 0.7 : opts.intensity === 'moderate' ? 1.0 : 1.4;
  const envMult = opts.environment === 'cool' ? 0.75 : opts.environment === 'temperate' ? 1.0 : opts.environment === 'hot' ? 1.5 : 1.9;
  const wMult = Math.max(0.75, Math.min(1.35, opts.weightKg / 70));
  const accMult = opts.acclimated ? 1.15 : 1.0; // Periard: объём +10–20% при акклиматизации
  const rate = Math.round(base * envMult * wMult * accMult * 100) / 100;
  const clamped = Math.max(0.4, Math.min(2.4, rate));
  return {
    rateLPerH: clamped,
    range: [Math.round(clamped * 0.7 * 100) / 100, Math.round(clamped * 1.3 * 100) / 100],
    note: `Популяционная оценка ±30% (ACSM): ${clamped} л/ч [${(clamped * 0.7).toFixed(2)}–${(clamped * 1.3).toFixed(2)}] · точный — взвешивание до/после`,
  };
}

/** BHI-рейтинг напитков (Maughan 2016): вода 1.0, изотоник 1.1–1.3, молоко 1.5, ORS 1.5. */
export interface BeverageRankV2 { name: string; bhi: number; sodiumMgPerL: number; bestFor: string; note: string; }
export const BEVERAGE_BHI_V2: BeverageRankV2[] = [
  { name: 'Вода', bhi: 1.0, sodiumMgPerL: 0, bestFor: '<60 мин, прохладно', note: 'BHI 1.0 — база, Na 0' },
  { name: 'Изотоник 500 мг/л', bhi: 1.1, sodiumMgPerL: 500, bestFor: '60–120 мин', note: 'BHI 1.1 — стандарт тренировки' },
  { name: 'Изотоник 700 мг/л', bhi: 1.3, sodiumMgPerL: 700, bestFor: 'жара / >90 мин', note: 'BHI 1.3 — жарко, heavy sweater' },
  { name: 'ORS 900 мг/л', bhi: 1.5, sodiumMgPerL: 900, bestFor: '>2 ч / восстановление', note: 'BHI 1.5 — восстановление, не залпом' },
  { name: 'Молоко', bhi: 1.5, sodiumMgPerL: 400, bestFor: 'post-workout', note: 'BHI 1.5 — казеин + Na + K' },
  { name: 'Кола / энергетики', bhi: 0.9, sodiumMgPerL: 50, bestFor: 'не для гидратации', note: 'BHI 0.9 — кофеин-диурез' },
];

export function rankBeveragesV2(lossL: number, durationH: number, sweatSodiumMgPerL: number): Array<BeverageRankV2 & { score: number }> {
  const heavy = lossL > 1.5 || durationH >= 2 || sweatSodiumMgPerL >= 1000;
  const medium = lossL > 1 || durationH >= 1;
  return BEVERAGE_BHI_V2.map((b) => {
    let score = b.bhi;
    if (heavy && b.sodiumMgPerL >= 700) score += 0.2;
    if (heavy && b.sodiumMgPerL < 200) score -= 0.2;
    if (!medium && b.sodiumMgPerL >= 900) score -= 0.15; // ORS избыточен на короткой
    return { ...b, score: Math.round(score * 100) / 100 };
  }).sort((a, b2) => b2.score - a.score);
}

/** DIAAS FAO 2013 (true ileal digestibility): whey 1.09, молоко 1.14, яйцо 1.13, говядина 1.10, соя 0.90, горох 0.58, рис 0.59, пшеница 0.45. */
export const DIAAS_TABLE: Record<string, { diaas: number; leucPerG: number; label: string }> = {
  whey: { diaas: 1.09, leucPerG: 0.11, label: 'Whey 1.09' },
  milk: { diaas: 1.14, leucPerG: 0.10, label: 'Молоко 1.14' },
  egg: { diaas: 1.13, leucPerG: 0.09, label: 'Яйцо 1.13' },
  beef: { diaas: 1.10, leucPerG: 0.08, label: 'Говядина 1.10' },
  chicken: { diaas: 1.08, leucPerG: 0.08, label: 'Курица 1.08' },
  fish: { diaas: 1.05, leucPerG: 0.08, label: 'Рыба 1.05' },
  casein: { diaas: 1.12, leucPerG: 0.09, label: 'Казеин 1.12' },
  soy: { diaas: 0.90, leucPerG: 0.08, label: 'Соя 0.90' },
  pea: { diaas: 0.58, leucPerG: 0.07, label: 'Горох 0.58' },
  rice: { diaas: 0.59, leucPerG: 0.07, label: 'Рис 0.59' },
  wheat: { diaas: 0.45, leucPerG: 0.06, label: 'Пшеница 0.45' },
  blend_plant: { diaas: 0.75, leucPerG: 0.075, label: 'Бленд растит. 0.75' },
  mixed: { diaas: 0.95, leucPerG: 0.09, label: 'Смешанный 0.95' },
};
