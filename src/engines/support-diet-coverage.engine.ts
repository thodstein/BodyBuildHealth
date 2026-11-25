/**
 * support-diet-coverage.engine.ts — «рацион покрывает вещество» (чистый движок, без UI).
 *
 * Идея: сравнить фактическое/запланированное питание за день (DietIntake) с
 * референсными нормами (DIET_RDA) и пометить в плане поддержки те позиции,
 * которые рацион уже закрывает. Позиции НЕ удаляются — только получают
 * пометку «покрыто питанием»; решение остаётся за пользователем.
 *
 * Контракт: без side effects, вход не мутируется; пустой intake → прежний
 * результат байт-в-байт (важно для тумблера в runSupportUnified: выключенный
 * режим не должен менять план).
 *
 * Нормы — только там, где есть цитируемая числовая величина EFSA DRV для
 * взрослых. Белок намеренно отсутствует: норма белка задаётся в г/кг массы
 * тела, фиксированного числа граммов нет (EFSA DRV protein 2012 — PRI
 * 0.83 г/кг/сут), а вес в этот движок не передаётся. `proteinG` остаётся в
 * DietIntake для будущей проверки «г/кг» на стороне вызывающего кода.
 *
 * Маппинг «вещество → нутриент» использует ТОЛЬКО канонические id, которые уже
 * есть в репозитории: ключи SUPPLEMENTS_DB (src/data/support-db/supplements.ts)
 * и DEFAULT_DOSAGES (src/data/support-meta.ts) — magnesium, zinc, iron,
 * iron_bisglycinate, calcium, vitamin_d3, omega3, potassium, fiber.
 * Цинк в DIET_RDA не включён: подходящей числовой нормы в выбранном наборе
 * EFSA-величин не проверяли, а выдумывать значение нельзя.
 */
import { canonId } from './support-plan/shared-constants';

/** То, что реально съедено/запланировано за день (единицы — в имени поля). */
export interface DietIntake {
  proteinG?: number;
  fiberG?: number;
  epaDhaMg?: number;
  ironMg?: number;
  calciumMg?: number;
  vitaminDIu?: number;
  magnesiumMg?: number;
  potassiumMg?: number;
}

export interface NutrientRda {
  key: keyof DietIntake;
  label: string;
  rda: number;
  unit: string;
  source: string;
}

/**
 * Нормы для взрослых (EFSA Dietary Reference Values).
 *
 * Источники (проверены по аннотациям EFSA Journal):
 *  - Клетчатка: EFSA NDA Panel 2010, EFSA Journal 8(3):1462, AI 25 г/сут
 *    для взрослых (нормальная работа кишечника).
 *    doi:10.2903/j.efsa.2010.1462
 *  - EPA+DHA: EFSA NDA Panel 2010, EFSA Journal 8(3):1461, AI 250 мг/сут
 *    для взрослых (кардиоваскулярные основания).
 *    doi:10.2903/j.efsa.2010.1461
 *  - Железо: EFSA NDA Panel 2015, EFSA Journal 13(10):4254, PRI 11 мг/сут
 *    (мужчины и женщины в постменопаузе) и 16 мг/сут (женщины до менопаузы).
 *    В таблице — 16 мг: верхняя взрослая норма, чтобы не пометить добавку
 *    «покрытой» по мужскому порогу у женщины репродуктивного возраста.
 *    doi:10.2903/j.efsa.2015.4254
 *  - Кальций: EFSA NDA Panel 2015, EFSA Journal 13(5):4101, PRI 950 мг/сут
 *    для взрослых.
 *    doi:10.2903/j.efsa.2015.4101
 *  - Витамин D: EFSA NDA Panel 2016, EFSA Journal 14(10):4547, AI 15 мкг/сут
 *    для взрослых = 600 МЕ (1 мкг = 40 МЕ).
 *    doi:10.2903/j.efsa.2016.4547
 *  - Магний: EFSA NDA Panel 2015, EFSA Journal 13(7):4186, AI 350 мг/сут
 *    (мужчины) и 300 мг/сут (женщины). В таблице — 350 мг (верхняя взрослая).
 *    doi:10.2903/j.efsa.2015.4186
 *  - Калий: EFSA NDA Panel 2016, EFSA Journal 14(10):4592, AI 3500 мг/сут
 *    для взрослых мужчин и женщин.
 *    doi:10.2903/j.efsa.2016.4592
 */
export const DIET_RDA: NutrientRda[] = [
  {
    key: 'fiberG',
    label: 'Клетчатка',
    rda: 25,
    unit: 'г',
    source: 'EFSA DRV 2010;8(3):1462 (AI 25 г/сут, взрослые) · doi:10.2903/j.efsa.2010.1462',
  },
  {
    key: 'epaDhaMg',
    label: 'EPA+DHA',
    rda: 250,
    unit: 'мг',
    source: 'EFSA DRV 2010;8(3):1461 (AI 250 мг/сут, взрослые) · doi:10.2903/j.efsa.2010.1461',
  },
  {
    key: 'ironMg',
    label: 'Железо',
    rda: 16,
    unit: 'мг',
    source:
      'EFSA DRV 2015;13(10):4254 (PRI 16 мг/сут — женщины до менопаузы; мужчины 11) · doi:10.2903/j.efsa.2015.4254',
  },
  {
    key: 'calciumMg',
    label: 'Кальций',
    rda: 950,
    unit: 'мг',
    source: 'EFSA DRV 2015;13(5):4101 (PRI 950 мг/сут, взрослые) · doi:10.2903/j.efsa.2015.4101',
  },
  {
    key: 'vitaminDIu',
    label: 'Витамин D',
    rda: 600,
    unit: 'МЕ',
    source: 'EFSA DRV 2016;14(10):4547 (AI 15 мкг/сут = 600 МЕ, взрослые) · doi:10.2903/j.efsa.2016.4547',
  },
  {
    key: 'magnesiumMg',
    label: 'Магний',
    rda: 350,
    unit: 'мг',
    source: 'EFSA DRV 2015;13(7):4186 (AI 350 мг/сут — мужчины; женщины 300) · doi:10.2903/j.efsa.2015.4186',
  },
  {
    key: 'potassiumMg',
    label: 'Калий',
    rda: 3500,
    unit: 'мг',
    source: 'EFSA DRV 2016;14(10):4592 (AI 3500 мг/сут, взрослые) · doi:10.2903/j.efsa.2016.4592',
  },
];

export type CoverageState = 'covered' | 'partial' | 'insufficient' | 'unknown';

export interface NutrientCoverage {
  key: keyof DietIntake;
  label: string;
  intake: number | null;
  rda: number;
  unit: string;
  ratio: number | null;
  state: CoverageState;
  source: string;
}

/**
 * Канонические id веществ из плана, которые закрывает нутриент.
 * Только id, реально существующие в репозитории:
 *  - fiber, omega3, iron, iron_bisglycinate, calcium, vitamin_d3,
 *    magnesium, potassium (SUPPLEMENTS_DB / DEFAULT_DOSAGES).
 * Алиасы (magnesium_glycinate, fish_oil, vitamin_d, potassium_citrate…)
 * приводятся к канону через canonId.
 */
const NUTRIENT_SUBSTANCE_IDS: Record<string, readonly string[]> = {
  fiberG: ['fiber'],
  epaDhaMg: ['omega3'],
  ironMg: ['iron', 'iron_bisglycinate'],
  calciumMg: ['calcium'],
  vitaminDIu: ['vitamin_d3'],
  magnesiumMg: ['magnesium'],
  potassiumMg: ['potassium'],
};

/** Состояние покрытия по отношению intake/RDA (границы 0.5 и 1.0 включительно). */
function stateOf(ratio: number): CoverageState {
  if (ratio >= 1) return 'covered';
  if (ratio >= 0.5) return 'partial';
  return 'insufficient';
}

function isKnownIntake(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Покрытие по всем нутриентам DIET_RDA.
 * undefined/NaN intake → 'unknown' (intake/ratio = null). proteinG в результат
 * не попадает: для белка нет фиксированной нормы в граммах (см. шапку файла).
 */
export function dietCoverage(intake: DietIntake | null | undefined): NutrientCoverage[] {
  return DIET_RDA.map((rda) => {
    const raw = intake ? (intake[rda.key] as unknown) : undefined;
    if (!isKnownIntake(raw)) {
      return {
        key: rda.key,
        label: rda.label,
        intake: null,
        rda: rda.rda,
        unit: rda.unit,
        ratio: null,
        state: 'unknown' as CoverageState,
        source: rda.source,
      };
    }
    const ratio = raw / rda.rda;
    return {
      key: rda.key,
      label: rda.label,
      intake: raw,
      rda: rda.rda,
      unit: rda.unit,
      ratio,
      state: stateOf(ratio),
      source: rda.source,
    };
  });
}

/** Вещества, которые рацион уже покрывает: id → {ratio, label}. Чистая функция. */
export function coveredByDiet(coverage: NutrientCoverage[]): Record<string, { ratio: number; label: string }> {
  const out: Record<string, { ratio: number; label: string }> = {};
  for (const c of coverage || []) {
    if (c.state !== 'covered' || c.ratio === null) continue;
    const ids = NUTRIENT_SUBSTANCE_IDS[c.key];
    if (!ids) continue;
    for (const id of ids) out[id] = { ratio: c.ratio, label: c.label };
  }
  return out;
}

/** Карта «канонический id вещества» → покрытие нутриента (только covered). */
function coveredBySubstanceId(coverage: NutrientCoverage[]): Map<string, NutrientCoverage> {
  const map = new Map<string, NutrientCoverage>();
  for (const c of coverage || []) {
    if (c.state !== 'covered' || c.ratio === null) continue;
    const ids = NUTRIENT_SUBSTANCE_IDS[c.key];
    if (!ids) continue;
    for (const id of ids) map.set(id, c);
  }
  return map;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Текст пометки: «🍽 Клетчатка — покрыто питанием (120% нормы: 30 г из 25 г)». */
function coverageMark(c: NutrientCoverage): string {
  const pct = Math.round((c.ratio as number) * 100);
  const intake = round1(c.intake as number);
  return `🍽 ${c.label} — покрыто питанием (${pct}% нормы: ${intake} ${c.unit} из ${c.rda} ${c.unit})`;
}

/**
 * Помечает позиции плана «покрыто питанием» и НЕ удаляет их.
 * Возвращает новые массивы + notes; пустой/неизвестный intake → вход без
 * изменений (тот же массив, notes = []).
 */
export function annotatePlanSubsByDiet<T extends { id: string; note?: string }>(
  subs: T[],
  coverage: NutrientCoverage[],
): { subs: T[]; notes: string[] } {
  const covered = coveredBySubstanceId(coverage);
  if (covered.size === 0 || !subs || subs.length === 0) return { subs, notes: [] };

  const notes: string[] = [];
  const out: T[] = [];
  for (const s of subs) {
    const c = covered.get(canonId(s.id));
    if (!c) {
      out.push(s);
      continue;
    }
    if (s.note?.includes('покрыто питанием')) {
      out.push(s);
      continue;
    }
    const mark = coverageMark(c);
    out.push({ ...s, note: s.note ? `${s.note} · ${mark}` : mark } as T);
    notes.push(mark);
  }
  return { subs: out, notes };
}

/**
 * То же для рекомендованных добавок (RecommendedSub): пометка идёт в `reason`.
 * Позиции не удаляются; вход не мутируется.
 */
export function annotateRecSubsByDiet<T extends { id: string; reason?: string }>(
  subs: T[],
  coverage: NutrientCoverage[],
): { subs: T[]; notes: string[] } {
  const covered = coveredBySubstanceId(coverage);
  if (covered.size === 0 || !subs || subs.length === 0) return { subs, notes: [] };

  const notes: string[] = [];
  const out: T[] = [];
  for (const s of subs) {
    const c = covered.get(canonId(s.id));
    if (!c) {
      out.push(s);
      continue;
    }
    if (s.reason?.includes('покрыто питанием')) {
      out.push(s);
      continue;
    }
    const mark = coverageMark(c);
    out.push({ ...s, reason: s.reason ? `${s.reason} · ${mark}` : mark } as T);
    notes.push(mark);
  }
  return { subs: out, notes };
}
