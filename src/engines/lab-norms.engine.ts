/**
 * lab-norms.engine.ts — Л8 (фаза 2 женского слоя): ЕДИНЫЙ резолвер лабораторных норм с учётом пола.
 *
 * Единый источник чисел (без дублирования таблиц):
 *  - базовые/мужские нормы — UCUM_MAP (core/constants) 1-в-1 (мужской путь байт-в-байт);
 *  - женские — LAB_REFERENCES_FEMALE (risk-engine-v7-matrix, §6.2) ×100 только для Hct:
 *    HCT 36–48, Hb 120–150, RBC 4.0–5.2, АЛТ/АСТ/ГГТ ULN 31, креатинин ≤97, ферритин ≤200.
 *
 * Правило проекта: без sex/male getLabNorm возвращает ровно пару UCUM_MAP (lln/uln).
 */
import { UCUM_MAP, E2_PG_TO_PMOL, PRL_NG_TO_MIU, PROG_NG_TO_NMOL } from '../core/constants';
import { LAB_REFERENCES_FEMALE } from './risk-engine-v7-matrix';

export interface LabNorm {
  lln: number;
  uln: number;
  unit: string;
  /** ♀ Норма взята из женского слоя (шейп строки «♀»). */
  female: boolean;
}

/** Достаёт запись UCUM_MAP без учёта регистра (как в LabsScreen). */
function ucumEntry(code: string): { prefUnit: string; uln: number; lln: number; name: string } | undefined {
  const raw = String(code || '').trim();
  if (!raw) return undefined;
  const map = UCUM_MAP as Record<string, any>;
  return map[raw.toUpperCase()] ?? map[raw] ?? map[raw.toLowerCase()] ??
    (Object.entries(map).find(([k]) => k.toLowerCase() === raw.toLowerCase())?.[1] as any);
}

/**
 * Женские границы отображения (единый источник — LAB_REFERENCES_FEMALE).
 * Hct в V7 хранится долей (0.36–0.48) — конвертируем ×100 в проценты UCUM.
 */
const FEMALE_SOURCE_CODES: Record<string, keyof typeof LAB_REFERENCES_FEMALE> = {
  HCT: 'Hct',
  HGB: 'Hb',
  RBC: 'RBC',
  ALT: 'ALT',
  AST: 'AST',
  GGT: 'GGT',
  CREATININE: 'Creatinine',
  FERRITIN: 'Ferritin',
};

export const FEMALE_LAB_BOUNDS: Record<string, { lln: number; uln: number }> = (() => {
  const out: Record<string, { lln: number; uln: number }> = {};
  for (const [code, src] of Object.entries(FEMALE_SOURCE_CODES)) {
    const ref = LAB_REFERENCES_FEMALE[src as string] as { uln?: number; lln?: number } | undefined;
    if (!ref || ref.uln === undefined) continue;
    const scale = code === 'HCT' ? 100 : 1;
    out[code] = {
      lln: Math.round(((ref.lln ?? 0) * scale) * 100) / 100,
      uln: Math.round((ref.uln * scale) * 100) / 100,
    };
  }
  return out;
})();

/**
 * Мочевая кислота: женская норма 150–350 мкмоль/л (женский протокол, блок
 * «Лабы» — `supportProtocolWomenData`, там же зелёная зона `<420`). В UCUM общий
 * верх 420 остаётся верхом нормы **мужчины**: у женщины 380 — это уже выше её
 * нормы, хотя «по общей таблице» выглядит нормально. Пара закреплена кросс-локом
 * `female-hormone-bands` (строка женского таба ↔ `FEMALE_LAB_BOUNDS.UA`).
 */
FEMALE_LAB_BOUNDS.UA = { lln: 150, uln: 350 };

/** Есть ли у кода женские границы (для бейджа «♀»). */
export function hasFemaleLabBound(code: string): boolean {
  return !!FEMALE_LAB_BOUNDS[String(code || '').trim().toUpperCase()];
}

/**
 * Единый резолвер норм: без sex/male — UCUM_MAP байт-в-байт; female — женские границы.
 * Возвращает null, если код неизвестен.
 */
export function getLabNorm(code: string, sex?: 'male' | 'female'): LabNorm | null {
  const entry = ucumEntry(code);
  if (!entry) return null;
  if (sex === 'female') {
    const fem = FEMALE_LAB_BOUNDS[String(code || '').trim().toUpperCase()];
    if (fem) return { lln: fem.lln, uln: fem.uln, unit: entry.prefUnit || '', female: true };
  }
  return { lln: entry.lln, uln: entry.uln, unit: entry.prefUnit || '', female: false };
}

/**
 * ♀ Производные пороги, которых нет в таблицах норм. Единая точка для всех
 * поверхностей (уведомления, PDF для врача), чтобы ULN+4 и 2.5×ULN не
 * расползались литералами по файлам.
 *  - HCT: ULN — «терапия», ULN+4 — «ургент» (градация приложения);
 *  - АЛТ: 2.5× ULN — порог гепатотоксичности.
 */
export const FEMALE_HCT_THERAPY = getLabNorm('HCT', 'female')?.uln ?? 48;
export const FEMALE_HCT_URGENT = FEMALE_HCT_THERAPY + 4;
export const FEMALE_ALT_2_5_ULN = Math.round((getLabNorm('ALT', 'female')?.uln ?? 31) * 2.5);

/**
 * Пороги гематокрита — ОДНА шкала на всё приложение (проход 39, перенесено
 * сюда в проходе 43: резолвер норм — самое лёгкое место, его уже тянут
 * уведомления и PDF без поддержко-каталога).
 *  - `erythrocytosis` — начало эритроцитоза (♂ 51, ♀ 48 — верх нормы WADA);
 *  - `block` — порог флеботомии/отмены (Endocrine Society: ♂ >54%, ♀ >52%).
 * Градация калькулятора (`hctCuts`), баннер, уведомления и PDF считают от
 * этих чисел, а не от литералов.
 *
 * ⚠ Не путать с `getLabNorm('HCT').uln` (♂ 52 / ♀ 48): это верх референсного
 * диапазона, он печатается как «норма <52%» (`labUlnText`). У мужчины порог
 * действия (51) НИЖЕ лабораторной нормы — так и задумано (WADA), поэтому
 * `getLabNorm` нельзя «выравнивать» по 51, а гейты — по 52. Пара закреплена
 * тестом `hct-thresholds-single-source` («два числа HCT — намеренно»).
 */
export const HCT_THRESHOLDS = {
  male: { erythrocytosis: 51, block: 54 },
  female: { erythrocytosis: FEMALE_HCT_THERAPY, block: FEMALE_HCT_URGENT },
} as const;

/**
 * Трёхступенчатый ряд HCT для поверхностей, которые печатают сами ступени
 * (проверочные маркеры, метаболический хаб): [эритроцитоз, блок, гипервязкость].
 * Третья ступень — `block + 4 п.п.` (то же правило, что «ургент» у женщины выше),
 * то есть ♂ 51/54/58, ♀ 48/52/56. Отдельных литералов 58/56 в приложении нет.
 */
export const HCT_STEPS: Record<'male' | 'female', [number, number, number]> = {
  male: [HCT_THRESHOLDS.male.erythrocytosis, HCT_THRESHOLDS.male.block, HCT_THRESHOLDS.male.block + 4],
  female: [HCT_THRESHOLDS.female.erythrocytosis, HCT_THRESHOLDS.female.block, HCT_THRESHOLDS.female.block + 4],
};

/**
 * Шаг «зоны внимания» HCT: 4 п.п. ниже верхней нормы (♂ 48, ♀ 44). Тот же шаг,
 * что в `hctCuts` калькулятора; вынесен сюда, чтобы метаболический хаб не заводил
 * пятую копию числа.
 */
export const HCT_CORRECTION_MARGIN = 4;

/**
 * Пороги гемоглобина (г/л) — пара к `HCT_THRESHOLDS`: тот же эритроцитоз, та же
 * шкала «верх нормы → флеботомия/отмена».
 *  - `upper` — верх нормы: из резолвера (♂ 170, ♀ 150), а не литерал;
 *  - `block` — порог вмешательства: ♂ 185 (Endocrine Society: HCT >54% ≈ Hb 18.5 г/дл),
 *    ♀ 165 (женский протокол: «>165 → флеботомия + отмена», `supportProtocolWomenData`).
 *
 * Зачем: таблицы мониторинга (`LAB_MONITOR_DB`) и протоколы печатали только
 * мужское «<170 г/л» — женщина читала порог, к ней не относящийся (её 150).
 */
export const HGB_THRESHOLDS = {
  male: { upper: getLabNorm('HGB', 'male')?.uln ?? 170, block: 185 },
  female: { upper: getLabNorm('HGB', 'female')?.uln ?? 150, block: 165 },
} as const;

/**
 * Пороги печёночных трансаминаз (Ед/л) — пара к `HCT_THRESHOLDS`/`HGB_THRESHOLDS`:
 * у женщины ВГН ниже (31), а таблицы мониторинга и системные панели печатали
 * мужские «<40 Ед/л» как общий порог. Женщина с АЛТ 35 читала «норма», хотя её
 * ВГН — 31.
 *  - `male`/`female` — верх нормы из резолвера полов (`FEMALE_LAB_BOUNDS`);
 *  - кратные ступени (2×/3×/5×ВГН) считаются от своего пола, а не от литерала.
 */
export const LFT_ULN = {
  ALT: { male: getLabNorm('ALT', 'male')?.uln ?? 40, female: getLabNorm('ALT', 'female')?.uln ?? 31 },
  AST: { male: getLabNorm('AST', 'male')?.uln ?? 40, female: getLabNorm('AST', 'female')?.uln ?? 31 },
} as const;

/**
 * Ступени печёночной токсичности — ОДНА шкала действий на всё приложение.
 * Раньше на одно событие приходилось три разных числа: 2.5×ВГН (уведомление и
 * печать — «немедленная отмена ААС»), 3×ВГН (женский протокол, статин-баннер,
 * стоп-таблицы) и 5×ВГН (STOP-таблицы). Ступень называет действие, а не число:
 *  - `reduce`   2×ВГН — снизить/пересмотреть орал, повтор через 2–4 нед;
 *  - `stopOral` 3×ВГН — отмена оралов (17α), инъекции можно оставить;
 *  - `stopAll`  5×ВГН — отмена всего + гепатолог.
 * Числа считаются от ВГН своего пола (♂ 40 / ♀ 31), а не от литерала 200.
 * Отдельный сигнал `FEMALE_ALT_2_5_ULN` (78) — «гепатотоксичность, повторить»,
 * он не отменяет курс сам по себе.
 */
export const LFT_STAGES = { reduce: 2, stopOral: 3, stopAll: 5 } as const;

export const LFT_STAGE_ULN = {
  reduce: { male: LFT_ULN.ALT.male * LFT_STAGES.reduce, female: LFT_ULN.ALT.female * LFT_STAGES.reduce },
  stopOral: { male: LFT_ULN.ALT.male * LFT_STAGES.stopOral, female: LFT_ULN.ALT.female * LFT_STAGES.stopOral },
  stopAll: { male: LFT_ULN.ALT.male * LFT_STAGES.stopAll, female: LFT_ULN.ALT.female * LFT_STAGES.stopAll },
} as const;

/**
 * 2.5×ВГН — «сигнал гепатотоксичности»: повтор анализа + TUDCA, сам по себе курс
 * не отменяет (действия — ступени `LFT_STAGE_ULN`). ♂ 100 / ♀ 78.
 */
export const LFT_SIGNAL_ULN = {
  male: Math.round(LFT_ULN.ALT.male * 2.5),
  female: FEMALE_ALT_2_5_ULN,
} as const;

/**
 * ГГТ (Ед/л): ВГН ♂ 55 / ♀ 31 и кратные ступени 2×/3× — та же шкала действий,
 * что у трансаминаз. Раньше это число жило тремя способами: `risk-verification`
 * держал ♂ `[55,110,220]` (1×/2×/4×ВГН) и ♀ `[32,48,96]` (1.03×/1.5×/3×),
 * таблица тиров — `110/200`, а женский протокол считал от 31. Теперь одна пара
 * ВГН и одна лестница: ♂ 55/110/165, ♀ 31/62/93.
 */
export const GGT_ULN = {
  male: getLabNorm('GGT', 'male')?.uln ?? 55,
  female: getLabNorm('GGT', 'female')?.uln ?? 31,
} as const;

export const GGT_STAGE_ULN = {
  double: { male: GGT_ULN.male * LFT_STAGES.reduce, female: GGT_ULN.female * LFT_STAGES.reduce },
  triple: { male: GGT_ULN.male * LFT_STAGES.stopOral, female: GGT_ULN.female * LFT_STAGES.stopOral },
} as const;

/**
 * Креатинин (мкмоль/л): ВГН ♂ 110 / ♀ 97. В `risk-engine-tz-spec` мужская первая
 * ступень стояла на 90 — ниже собственной ВГН, то есть мужчина с креатинином 95
 * получал «почечный» балл при норме; женской ВГН 97 там же не было.
 */
export const CREATININE_ULN = {
  male: getLabNorm('CREATININE', 'male')?.uln ?? 110,
  female: FEMALE_LAB_BOUNDS.CREATININE?.uln ?? 97,
} as const;

/**
 * Мочевая кислота (мкмоль/л): ВГН ♂ 420 / ♀ 350. Общий верх 420 был единственным
 * числом во всех поверхностях, и женщина с 380 читала «норма» (её норма — до 350,
 * женский протокол). Мужские 420 не меняются.
 */
export const UA_ULN = {
  male: getLabNorm('UA', 'male')?.uln ?? 420,
  female: FEMALE_LAB_BOUNDS.UA?.uln ?? 350,
} as const;

/**
 * Ступени мочевой кислоты (мкмоль/л): ВГН · ×1.14 · ×1.29 — одна лестница на
 * главную модель (`risk-engine-tz-spec`) и верификацию (`risk-verification`).
 * Общий ряд 420/480/540 — гиперурикемия «7 мг/дл и выше»; женский выводится из
 * её ВГН 350 теми же множителями (350/400/450), поэтому 380 у женщины — уже
 * ступень внимания, а не «норма» (проход 77).
 */
const uaStage = (uln: number, k: number) => Math.round(uln * k);

export const UA_STAGE_ULN: { male: [number, number, number]; female: [number, number, number] } = {
  male: [UA_ULN.male, uaStage(UA_ULN.male, 480 / 420), uaStage(UA_ULN.male, 540 / 420)],
  female: [UA_ULN.female, uaStage(UA_ULN.female, 480 / 420), uaStage(UA_ULN.female, 540 / 420)],
};

/**
 * Эритроциты (10¹²/л): ВГН ♂ 5.8 / ♀ 5.2. В `risk-verification` мужской ряд
 * начинался с 5.5 — ниже собственной ВГН, то есть норма читалась как эритроцитоз;
 * женский (5.2/5.6/6.0) уже совпадал с резолвером. Ступени — ВГН, +0.4, +0.8.
 */
export const RBC_ULN = {
  male: getLabNorm('RBC', 'male')?.uln ?? 5.8,
  female: FEMALE_LAB_BOUNDS.RBC?.uln ?? 5.2,
} as const;

/**
 * ♀ Клинические зоны гормонов, которых НЕТ в резолвере: TT/E2/PRL/LH/FSH
 * намеренно не переопределяются в V7 (§6.2 — им нужна фазовая модель цикла).
 * Числа взяты из женского протокола (`supportProtocolWomenData`, блок «Лабы»),
 * но живут здесь, чтобы таблица мониторинга, печать для врача и женский таб
 * читали ОДНУ запись и не расходились при правке.
 *
 * Единицы: E2 — пг/мл (фазовая модель), PRL — мМЕ/л, TT — нмоль/л,
 * LH/FSH — МЕ/л. Мужская цель E2 на курсе (100–200 пмоль/л) женщине не
 * подходит: это подавление, а не норма; так же и мужские TT 10–35 нмоль/л,
 * LH 1.5–9.3 и FSH 1.4–18.1 — они не «общая норма».
 *
 * Числовые поля (`phases`, `range`) — те же числа, что в строках: их читают
 * движки, которым нужно сравнивать (отчёт, интерпретация), а не печатать.
 * Расхождение строк и чисел ловят `female-hormone-bands` и сводный отчёт.
 */
export const FEMALE_HORMONE_BANDS = {
  E2: {
    unit: 'пг/мл',
    normal: '40–200 (фолл.) / 70–500 (лют.)',
    /** Фазовые коридоры числами: фолликулярная 40–200, лютеиновая 70–500 пг/мл. */
    phases: { follicular: { low: 40, high: 200 }, luteal: { low: 70, high: 500 } },
    green: '40–400',
    yellow: '400–800',
    red: '>800 или <30',
  },
  PRL: {
    unit: 'мМЕ/л',
    normal: '100–500',
    /** Норма числами — для отчёта и сравнений (та же единица, мМЕ/л). */
    range: { low: 100, high: 500 },
    green: '<800',
    yellow: '800–1500',
    red: '>1500',
  },
  /** Женский общий тестостерон: 0.3–2.5 нмоль/л, вирилизация с 6.0. */
  TT: {
    unit: 'нмоль/л',
    normal: '0.3–2.5',
    range: { low: 0.3, high: 2.5 },
    green: '<4.0',
    yellow: '4.0–6.0',
    red: '>6.0',
  },
  /** ЛГ: фолликулярная 2–10, лютеиновая 5–25 МЕ/л; подавление ниже 2. */
  LH: {
    unit: 'МЕ/л',
    normal: '2–10 (фолл.) / 5–25 (лют.)',
    phases: { follicular: { low: 2, high: 10 }, luteal: { low: 5, high: 25 } },
    green: '<2',
    yellow: '2–8',
    red: '>8',
  },
  /** ФСГ: фолликулярная 3–10, лютеиновая 1.5–8 МЕ/л; подавление ниже 2. */
  FSH: {
    unit: 'МЕ/л',
    normal: '3–10 (фолл.) / 1.5–8 (лют.)',
    phases: { follicular: { low: 3, high: 10 }, luteal: { low: 1.5, high: 8 } },
    green: '<2',
    yellow: '2–8',
    red: '>8',
  },
  /**
   * Прогестерон: фолликулярная 0.1–1.5, лютеиновая 5–20 нг/мл. Овуляция
   * подтверждается лютеиновой >5 (замер за 7 дней до менструации), меньше 10 в
   * середине лютеиновой — недостаточность лютеиновой фазы.
   *
   * Мужская строка (0.1–1.2 нг/мл, target «<0.8» из панели гинекомастии)
   * женщине не годится: её нормальная лютеиновая 12 читалась бы «выше».
   */
  PROG: {
    unit: 'нг/мл',
    normal: '0.1–1.5 (фолл.) / 5–20 (лют.)',
    phases: { follicular: { low: 0.1, high: 1.5 }, luteal: { low: 5, high: 20 } },
    green: '0.1–1.5 (фолл.) / 5–20 (лют.)',
    yellow: '1.5–5 — овуляции не было',
    red: '>30 или <1 в середине лютеиновой',
  },
} as const;

/**
 * Множители пересчёта гормонов — один дом: `core/constants` (рядом с
 * `normalizeLabValue`, который ими же и пользуется). Резолвер их ре-экспортирует,
 * чтобы клинические шкалы (`comprehensive-report`, `labs-mapping`, UI) читали
 * множитель из одного места: E2 1 пг/мл = 3.671 пмоль/л, PRL 1 нг/мл = 21.2 мМЕ/л,
 * прогестерон 1 нг/мл = 3.18 нмоль/л (проход 100).
 */
export { E2_PG_TO_PMOL, PRL_NG_TO_MIU, PROG_NG_TO_NMOL };

/**
 * Эстрадиол в пг/мл из значения бланка (проход 84).
 *
 * Эвристика `normalizeLabValue` («>300 — значит пмоль/л») отменяет сама себя на
 * женщинах: лютеиновая E2 450 пг/мл — норма, а эвристика прочитала бы её как 450
 * пмоль/л (122.6 пг/мл) и срезала сигнал втрое. Там, где единица известна из
 * бланка, гадать не нужно: пмоль/л переводим множителем, остальное — как есть.
 */
export function e2PgPerMl(value: number, unit?: string): number {
  if (!Number.isFinite(value)) return value;
  if (/pmol|пмол/i.test(unit || '')) return Math.round((value / E2_PG_TO_PMOL) * 10) / 10;
  return value;
}

/**
 * Те же женские гормональные границы числами — для движков, которые считают, а
 * не печатают (`interpretLabs`: статус маркера и штраф за отклонение).
 * Значения обязаны совпадать с `FEMALE_HORMONE_BANDS`: E2 «<30» низко, «>400»
 * внимание (жёлтый бэнд), «>800» красный; PRL «<800» норма, «>1500» красный;
 * прогестерон «>20» выше лютеинового коридора, «>30» красный; тестостерон
 * «>2.5» выше женской нормы, «>6» вирилизация.
 */
export const FEMALE_HORMONE_ULN = {
  E2: { low: 30, high: 400, criticalHigh: 800 },
  PRL: { high: 800, criticalHigh: 1500 },
  /**
   * Прогестерон: низ здесь не нормируется — в фолликулярную он и должен быть
   * низким, ановуляцию ловит фаза (проход 79). Учитываем только верх.
   */
  PROG: { high: 20, criticalHigh: 30 },
  /** Общий тестостерон: женская норма 0.3–2.5, вирилизация с 6.0 нмоль/л. */
  TT: { high: 2.5, criticalHigh: 6 },
} as const;

/**
 * Пороги флагов липидных и печёночных карточек, которые не совпадают с ВГН
 * (`UCUM_MAP`) и потому живут отдельным рядом: ступени ЛПНП и ТГ — это
 * 1×/1.3×/1.6×ВГН (3.0/4.0/5.0 и 1.7/2.3), билирубин — 1.2×/2.3×/3.5× от 17.1
 * (21/40/60), а «низкий ЛПВП» — кардио-цель, и у женщины она выше (1.2 против 1.0).
 * До прохода 102 эти числа стояли литералами в `support-plan/engine`, а пара
 * 1.0/1.2 ещё и второй раз — в `recommendation-engine`.
 */
export const LDL_FLAG_STEPS = { mild: 3.0, moderate: 4.0, severe: 5.0 } as const;
export const TG_FLAG_STEPS = { elevated: 1.7, high: 2.3 } as const;
export const BILIRUBIN_FLAG_STEPS = { mild: 21, moderate: 40, severe: 60 } as const;
export const HDL_LOW = { male: 1.0, female: 1.2 } as const;

/**
 * ВГН с обоими полами для любого кода резолвера: «♂ <110 / ♀ <97»; код без
 * женской границы — просто «<N». Одна формулировка для таблиц мониторинга,
 * карточек и протоколов (чтобы мужской порог не выдавался за общий).
 */
export function labUlnText(code: string): string {
  const male = getLabNorm(code, 'male')?.uln;
  if (male === undefined) return '—';
  const fem = FEMALE_LAB_BOUNDS[String(code || '').trim().toUpperCase()]?.uln;
  return fem === undefined ? `<${male}` : `♂ <${male} / ♀ <${fem}`;
}

/** ВГН трансаминазы с обоими полами: «♂ <40 / ♀ <31». Одна формулировка на всё приложение. */
export function lftUlnText(marker: 'ALT' | 'AST'): string {
  const t = LFT_ULN[marker];
  return `♂ <${t.male} / ♀ <${t.female}`;
}

/** Л9: общая легенда женских порогов (показывается только при sex=female). */
export const FEMALE_LABS_NOTE =
  '♀ Пороги по полу: HCT 36–48%, Hb 120–150 г/л, RBC 4.0–5.2, АЛТ/АСТ/ГГТ ≤31, креатинин ≤97, ферритин ≤200. ' +
  'Полные нормы — Поддержка → «Женщины и ААС» → Лабы.';

/** Л10: короткая строка-пометка для панелей/дневника (та же формулировка в 4 точках). */
export const FEMALE_LABS_TAB_NOTE =
  '♀ Женские пороги активны (профиль: женщина). Отклонения считаются по женским границам; полная таблица — Поддержка → «Женщины и ААС» → Лабы.';
