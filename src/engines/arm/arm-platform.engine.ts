/**
 * arm-platform.engine.ts — армлифтинг-помост (эпик J PRO-плана).
 *
 * Правила ArmliftingUSA/IronMind: 1 минута на макс, промах = выбыл,
 * только DOH, без лямок. Симулятор: 3 попытки на снаряд, выбор веса,
 * итог + % от мирового рекорда.
 * Даты журнала — канон core/local-date (26.10.2026 было→стало: UTC-«сегодня»).
 */

import { localIsoDate } from '../../core/local-date';

export interface PlatformAttempt {
  attempt: number; // 1-3
  weightKg: number;
  success: boolean; // ввод факта
}

export interface PlatformResult {
  implement: string;
  bestKg: number;
  attemptsUsed: number;
  totalScore: number; // сумма лучших по снарядам (для многоборья считает вызывающий)
  worldRecordKg: number;
  wrPct: number; // best/WR*100
  note: string;
}

/** Мировые ориентиры. Сверено 14.10.2026 со страницами IronMind (© 2025) и Wikipedia:
 * RT 130.5 Тюкалов 30.06.2013 Visegrip Viking (V3; IronMind);
 *     Ж 80.0 — Hafsa Mason, West Coast Arm Sports «Hands of Doom II», 21.08.2024
 *     (Wikipedia, ред. 24.12.2025). Честная оговорка: страница IronMind на момент сверки
 *     всё ещё числит женский WR 77.2 (Гайдученко 22.09.2012) — 80.0 признан не всеми
 *     органами, поэтому подпись показывает оба факта.
 * Apollon 237.5 Carl Myerscough 16.12.2022 / Ж 137.9 Lyudmila Gaiduchenko 02.03.2019 (IronMind);
 * Hub 44.80 Harri Tolonen 10.02.2019 / Ж 28.51 Anzhela Kulagina 20.12.2021 (IronMind);
 * IronMind Block (щипковый блок) 51.40 Harri Tolonen 09.06.2018 /
 *     Ж 31.55 Rebecca Roberts 13.05.2017 (IronMind) — есть ДЕЙСТВУЮЩИЙ WR, поэтому
 *     «единого WR нет» было неверно: у блоков разная ширина/высота, но ориентир есть.
 * CoC-ступени — официальная poundage-таблица IronMind (No.3 = 280 lb = 127.0 кг =
 *     плоскость сертификации), гриппер в кг не меряется напрямую.
 * ВНУТРЕННИЕ ориентиры хаба (`platformIsInternal`, фиксированного WR нет):
 * Saxon 133 (классы APL/лидерборды AUSA; GripSport: Saxon 3"×4" 133.13 Helms 2025);
 * Grandfather Clock 90/50 и Anvil 30/16 (только лидерборды; лучший известный Country Crush 2"
 * ~198.04 кг Dingey 2021 GripSport — выше нашего числа, т.е. это точно не WR). */
export const PLATFORM_WR: Record<string, { maleKg: number; femaleKg: number; name: string; wrRef?: string }> = {
  rolling_thunder: { maleKg: 130.5, femaleKg: 80.0, name: 'Rolling Thunder', wrRef: 'Тюкалов 130.5, 30.06.2013 · Ж Hafsa Mason 80.0, 21.08.2024' },
  apollon_axle: { maleKg: 237.5, femaleKg: 137.9, name: 'Apollon Axle', wrRef: 'Майерско 237.5, 16.12.2022 · Ж Гайдученко 137.9, 02.03.2019' },
  saxon_bar: { maleKg: 133, femaleKg: 70, name: 'Saxon Bar (ориентир)' },
  hub: { maleKg: 44.8, femaleKg: 28.51, name: 'IronMind Hub', wrRef: 'Толонен 44.80, 10.02.2019 · Ж Кулагина 28.51, 20.12.2021' },
  // 80/45 — внутренний ориентир хаба для щипковых блоков РАЗНОЙ ширины/высоты
  // (к % не сводятся). Действующий WR канонического IronMind Block: М 51.40 / Ж 31.55.
  pinch_block: { maleKg: 80, femaleKg: 45, name: 'Pinch Block', wrRef: 'внутр. ориентир хаба · WR IronMind Block 51.40/31.55 (Толонен 2018 / Робертс 2017)' },
  // Гриппер в кг не меряется: знаменатель — официальная poundage-оценка No.3 (280 lb),
  // на которой стоит программа сертификации IronMind.
  coc_gripper: { maleKg: 127.0, femaleKg: 127.0, name: 'CoC (No.3 = 280 lb)', wrRef: 'IronMind poundage No.3 = 280 lb ≈ 127.0 кг (оценка, не замер)' },
  grandfather_clock: { maleKg: 90, femaleKg: 50, name: 'Grandfather Clock' },
  anvil: { maleKg: 30, femaleKg: 16, name: 'SSE Anvil' },
  country_crush: { maleKg: 100, femaleKg: 55, name: 'Country Crush' },
};

/**
 * Официальная poundage-лестница CoC (IronMind/Wikipedia): ступень → кг-эквивалент.
 * Рейтинги приблизительные (IronMind сам просит не злоупотреблять ими), но это
 * единственная опубликованная шкала — на ней строится ordinal-оценка.
 */
export const COC_ORDINAL_KG: Record<string, number> = {
  guide: 27.2, sport: 36.3, trainer: 45.4, '0.5': 54.4, 1: 63.5, '1.5': 76.0,
  2: 88.5, '2.5': 107.7, 3: 127.0, '3.5': 146.3, 4: 165.6,
};

/** Плоскость сертификации IronMind — No.3 (280 lb). */
export const COC_CERT_LEVEL = 3;

/** true → снаряд есть в таблице выше (иначе % не считается — без молчаливой подмены). */
export function platformWrKnown(implement: string): boolean {
  return !!PLATFORM_WR[String(implement || '')];
}

/**
 * WR/ориентир в кг. Неизвестный снаряд → 0 (вызывающие обязаны дать «нет %»):
 * раньше молча подставлялся Rolling Thunder, и % чужого снаряда выдавался за RT.
 */
export function platformWrFor(implement: string, sex: string): number {
  const rec = PLATFORM_WR[String(implement || '')];
  if (!rec) return 0;
  return (sex || '').toLowerCase() === 'female' ? rec.femaleKg : rec.maleKg;
}

/** Подпись источника знаменателя (для честных note-строк; пусто — внутренний). */
export function platformWrRef(implement: string): string {
  return PLATFORM_WR[String(implement || '')]?.wrRef || '';
}

/** PRO-4 добивка-3: какие знаменатели — внутренние ориентиры, а не WR (см. шапку). */
const PLATFORM_INTERNAL: Record<string, true> = {
  saxon_bar: true,
  pinch_block: true,
  coc_gripper: true,
  grandfather_clock: true,
  anvil: true,
  country_crush: true,
};

/** true → % считается от внутреннего ориентира хаба, не от мирового рекорда. */
export function platformIsInternal(implement: string): boolean {
  return !!PLATFORM_INTERNAL[String(implement || '')];
}

/**
 * Канон лесенницы попыток помоста: opener / вторая / третья в долях лучшего
 * результата. Один источник для хаба, конструктора и плана попыток — раньше
 * хаб считал 92/98/102, а строчки отчёта 90/96/102 (две цифры у одного спортсмена).
 */
export const ATTEMPT_LADDER_PCT = [0.9, 0.96, 1.02] as const;

/** План попыток: opener 90%, second 96%, third 102% от цели (лесенка для зала). */
export function planAttempts(targetKg: number): number[] {
  const t = Number(targetKg);
  if (!Number.isFinite(t) || t <= 0) return [];
  const r = (v: number) => Math.round(v * 2) / 2;
  return ATTEMPT_LADDER_PCT.map((p) => r(t * p));
}

/**
 * PRO-4 A4: лесенка last-man-standing (Armlifting USA 2026):
 * только вверх шагом 2.5/5 кг до цели, вниз нельзя, промах = выбыл.
 */
export function planLastManStanding(targetKg: number): number[] {
  const t = Number(targetKg);
  if (!Number.isFinite(t) || t <= 0) return [];
  const step = t >= 100 ? 5 : 2.5;
  const out: number[] = [];
  let w = Math.round((t * 0.85) * 2) / 2;
  if (w < 2.5) w = 2.5;
  let guard = 0;
  while (w < t && guard < 12) {
    out.push(w);
    w = Math.round((w + step) * 2) / 2;
    guard++;
  }
  out.push(Math.round(t * 2) / 2);
  return out;
}

export function scorePlatform(input: {
  implement?: string;
  sex?: string;
  attempts: PlatformAttempt[];
}): PlatformResult {
  const implement = input.implement || 'rolling_thunder';
  const wr = platformWrFor(implement, input.sex || 'male');
  const ok = (input.attempts || []).filter((a) => a.success && Number.isFinite(Number(a.weightKg)));
  const bestKg = ok.length ? Math.max(...ok.map((a) => Number(a.weightKg))) : 0;
  const wrPct = wr > 0 ? Math.round((bestKg / wr) * 1000) / 10 : 0;
  const internal = platformIsInternal(implement);
  const suffix = internal ? ' (внутренний ориентир, не WR)' : '';
  return {
    implement,
    bestKg,
    attemptsUsed: (input.attempts || []).length,
    totalScore: bestKg,
    worldRecordKg: wr,
    wrPct,
    note:
      (ok.length === 0
        ? 'Все попытки сорваны — занизить opener до 85%.'
        : wrPct >= 90
          ? `Элита: ${wrPct}% WR.`
          : wrPct >= 70
            ? `Соревновательный уровень: ${wrPct}% WR.`
            : `База: ${wrPct}% WR — работать opener.`) + suffix,
  };
}

/** Ротация снарядов по неделям: support → pinch → crush (цикл 3). */
export function platformRotationForWeek(week: number): 'support' | 'pinch' | 'crush' {
  const pos = ((Math.max(1, Math.round(week)) - 1) % 3 + 3) % 3;
  return pos === 0 ? 'support' : pos === 1 ? 'pinch' : 'crush';
}

const PLATFORM_LOG_KEY = 'he_arm_platform_log';

export interface PlatformLogEntry {
  date: string;
  implement: string;
  weightKg: number;
  success: boolean;
  wrPct: number;
}

/** Журнал попыток помоста (D4): кап 52, устойчив к битому JSON. */
export function loadPlatformLog(): PlatformLogEntry[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PLATFORM_LOG_KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e: any) => e && typeof e.date === 'string' && Number.isFinite(Number(e.weightKg)))
      .slice(-52);
  } catch { return []; }
}

export function savePlatformLogEntry(input: { implement?: string; sex?: string; weightKg: number; success: boolean; dateIso?: string }): PlatformLogEntry[] {
  const w = Number(input.weightKg);
  if (!Number.isFinite(w) || w <= 0) return loadPlatformLog();
  const implement = input.implement || 'rolling_thunder';
  const wr = platformWrFor(implement, input.sex || 'male');
  const entry: PlatformLogEntry = {
    date: input.dateIso || localIsoDate(),
    implement,
    weightKg: Math.round(w * 10) / 10,
    success: !!input.success,
    wrPct: wr > 0 ? Math.round((w / wr) * 1000) / 10 : 0,
  };
  const next = [...loadPlatformLog(), entry].slice(-52);
  try { localStorage.setItem(PLATFORM_LOG_KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}
