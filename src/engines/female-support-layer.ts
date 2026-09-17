/**
 * female-support-layer.ts — женский слой подбора поддержки (этап «женский слой», B).
 *
 * Принципы:
 *  - Активируется ТОЛЬКО при ctx.sex === 'female' И активном курсе (ctx.onCourse).
 *  - УСИЛИВАЕТ мужской набор: добавляет женские позиции поверх, ничего не удаляя
 *    и не понижая. Дедуп по canonId — если позицию уже взяла мужская ветка, не дублируем.
 *    ЕДИНСТВЕННОЕ исключение: жёсткий гейт HCT ≥48% вычищает ЖЕЛЕЗО (если lab-tier
 *    добавил его по низкому ферритину) — safety-правило плана FEMALE-ONCYCLE-PRO.
 *  - Уважает TOTAL_LIMIT и CATEGORY_LIMITS уровня (не раздувает план сверх лимита).
 *  - НИКОГДА не мутирует входной rec — кэш resolvePlan хранит базовую рекомендацию,
 *    поэтому возвращается новый объект (мужской путь возвращается тем же объектом).
 *  - Контур: общее усиление (vitex/инозитол) + BONE-набор (Ca/D3/K2/Mg, ACOG/Triad-2025)
 *    + лаб-гейтед позиции (железо — только ферритин <30 И HCT <48; без анализов тихо).
 *
 * Источник позиций: docs/FEMALE_AAS_PROTOCOLS.md (§5) + docs/FEMALE-ONCYCLE-PRO-PLAN.md
 * (железо: AAFP 2025 / Stoffel-Moretti / BJSM 2025; кости: Triad-2025 update, ACOG).
 */
import type { MapperCtx, SupportRecommendation, RecommendedSub } from './tz-mapper-engine';
import type { TzCategory } from './tz-bridge-mechanism';
import { TOTAL_LIMIT, CATEGORY_LIMITS } from './tz-bridge-mechanism';
import type { TzMechId } from './tz-bridge-marker';
import { canonId } from './support-plan/shared-constants';

export interface FemaleLayerSub {
  substanceId: string;
  nameRu: string;
  category: TzCategory;
  k: number;
  q: 'A' | 'B' | 'C';
  reason: string;
  mechsCovered: TzMechId[];
  priority: 1 | 2 | 3 | 4;
  /** Лаб-гейт условных позиций: без подтверждённого показания — тихо пропускается. */
  labGate?: (labs: Record<string, number> | undefined) => boolean;
}

/**
 * ГЕЙТ ЖЕЛЕЗА (жёсткий): железо добавляется ТОЛЬКО когда подтверждён дефицит
 * (ферритин <30 нг/мл) И нет риска гипервязкости (HCT <48%). Без анализов —
 * тихо ничего (мужской путь не затрагивается: слой активен только sex=female).
 * Источники: AAFP 2025 (ферритин <30 у атлеток), BJSM 2025 (в/в при <20),
 * плановый гейт курса — HCT ≥48% стоп (ААС стимулируют эритропоэз).
 */
export function femaleIronGate(labs: Record<string, number> | undefined): boolean {
  if (!labs || typeof labs !== 'object') return false;
  const ferritin = labs['FERRITIN'];
  const hct = labs['HEMATOCRIT'] ?? labs['HCT'];
  return (
    typeof ferritin === 'number' && Number.isFinite(ferritin) && ferritin > 0 && ferritin < 30 &&
    typeof hct === 'number' && Number.isFinite(hct) && hct > 0 && hct < 48
  );
}

/**
 * Женские усилители (OTC, не рецептурные): гормональный баланс и яичниковая функция.
 * Рецептурные женские позиции (спиронолактон/каберголин) НЕ добавляются автоматически —
 * остаются флагами «только врач» (см. femaleFlags протокола «Женщины и ААС»).
 */
export const FEMALE_LAYER_SUBS: FemaleLayerSub[] = [
  {
    substanceId: 'vitex',
    nameRu: 'Витекс (прутняк)',
    category: 'hormonal',
    k: 0.1,
    q: 'B',
    reason: '♀ Женский слой: гормональный баланс, D2-агонист (пролактин↓), поддержка цикла (усиление поверх мужского набора)',
    mechsCovered: ['cns4' as TzMechId],
    priority: 2,
  },
  {
    substanceId: 'inositol',
    nameRu: 'Инозитол (мио)',
    category: 'neuroprotector',
    k: 0.05,
    q: 'C',
    reason: '♀ Женский слой: яичниковая функция и чувствительность к инсулину (доказан при СПКЯ); успокоение ЦНС',
    mechsCovered: ['cns1' as TzMechId],
    priority: 3,
  },
];

/**
 * BONE-набор (ACOG / Triad-2025): профилактика потери BMD при ААС + дефиците E2.
 * Добавляется всем женщинам на курсе (дедуп с мужским набором); решение — врач.
 */
export const FEMALE_BONE_SUBS: FemaleLayerSub[] = [
  {
    substanceId: 'calcium',
    nameRu: 'Кальций',
    category: 'mineral',
    k: 0.05,
    q: 'A',
    reason: '♀ Костная защита: Ca 1000–1500 мг/сут при ААС-дефиците E2/аменорее (с D3+K2, ≤500 мг за приём)',
    mechsCovered: ['hem5' as TzMechId],
    priority: 2,
  },
  {
    substanceId: 'vitamin_d3',
    nameRu: 'Витамин D3',
    category: 'vitamin',
    k: 0.1,
    q: 'A',
    reason: '♀ Костная защита: 25-OH D 30–50 нг/мл, всасывание кальция (титрация при дефиците — врач)',
    mechsCovered: ['ren2' as TzMechId],
    priority: 2,
  },
  {
    substanceId: 'vitamin_k2',
    nameRu: 'Витамин K2 (MK-7)',
    category: 'vitamin',
    k: 0.08,
    q: 'B',
    reason: '♀ Костная защита: γ-карбоксилирование остеокальцина — направляет Ca в кость, не в сосуды',
    mechsCovered: ['cv2' as TzMechId],
    priority: 3,
  },
  {
    substanceId: 'magnesium',
    nameRu: 'Магний (бисглицинат)',
    category: 'mineral',
    k: 0.35,
    q: 'A',
    reason: '♀ Костная защита: минерализация кости + сон/ГАМК при подготовке (кросс-кап 800 мг/сут)',
    mechsCovered: ['cv5' as TzMechId],
    priority: 2,
  },
];

/**
 * Лаб-гейтед позиции: добавляются ТОЛЬКО при подтверждённом анализе.
 * Железо — никогда при HCT ≥48% (риск гипервязкости на ААС-курсе).
 */
export const FEMALE_LAB_GATED_SUBS: FemaleLayerSub[] = [
  {
    substanceId: 'iron_bisglycinate',
    nameRu: 'Железо бисглицинат (по анализам)',
    category: 'hematologic',
    k: 0.1,
    q: 'B',
    reason: '♀ Железо по анализам: ферритин <30 и HCT <48 — дефицит подтверждён, гипервязкости нет. Без анализов не добавляется',
    mechsCovered: ['hem1' as TzMechId],
    priority: 3,
    labGate: femaleIronGate,
  },
];

/** Полный контур женского слоя (общее усиление + кости + лаб-гейтед) — единый источник для тестов. */
export const FEMALE_ALL_LAYER_SUBS: FemaleLayerSub[] = [
  ...FEMALE_LAYER_SUBS,
  ...FEMALE_BONE_SUBS,
  ...FEMALE_LAB_GATED_SUBS,
];

export interface FemaleLayerResult {
  /** Добавленные женским слоем позиции (id) */
  added: string[];
  /** Человекочитаемые имена добавленного (для баннера UI; fallback — added) */
  labels?: string[];
  /** Женские флаги риска (вирилизация/противопоказания) */
  flags: string[];
  /** Исключённые жёстким гейтом позиции (железо при HCT ≥48) — для честного UI */
  removed?: string[];
}

/** Семейство железа (все формы/алиасы lab-tier и скирм-путей). */
export const IRON_FAMILY_IDS = new Set<string>([
  'iron', 'iron_bisglycinate', 'iron_sulfate', 'iron_fumarate', 'iron_lipofer', 'iron_supplement',
]);

/** Подтверждённый HCT ≥48% (гейт курса: железо нельзя). */
export function hctAtOrAbove48(labs: Record<string, number> | undefined): boolean {
  if (!labs || typeof labs !== 'object') return false;
  const hct = labs['HEMATOCRIT'] ?? labs['HCT'];
  return typeof hct === 'number' && Number.isFinite(hct) && hct >= 48;
}

/**
 * Применяет женский слой к рекомендации. Возвращает:
 *  - тот же объект rec, если слой не активен или нечего добавлять (мужской путь);
 *  - новый объект rec с дополнениями, если female + курс.
 */
export function applyFemaleSupport(rec: SupportRecommendation, ctx: MapperCtx): SupportRecommendation {
  if (!rec) return rec;
  if (ctx?.sex !== 'female') return rec;
  if (!ctx?.onCourse) return rec;

  // 0. ЖЁСТКИЙ ГЕЙТ КУРСА (female-only): при подтверждённом HCT ≥48% железо
  //    ИСКЛЮЧАЕТСЯ из плана, даже если lab-tier добавил его по низкому ферритину.
  //    ААС стимулируют эритропоэз, железо — субстрат: риск гипервязкости/тромбоза.
  //    Мужской путь не затрагивается (sex-проверка выше).
  const removed: string[] = [];
  let baseSubs: RecommendedSub[] = rec.subs;
  if (hctAtOrAbove48(ctx.labs)) {
    baseSubs = rec.subs.filter((s) => {
      const c = canonId(s.substanceId);
      if (!IRON_FAMILY_IDS.has(c)) return true;
      removed.push(c);
      return false;
    });
  }

  const existing = new Set(baseSubs.map((s) => canonId(s.substanceId)));
  const subs: RecommendedSub[] = [...baseSubs];
  const added: string[] = [];

  // Счётчик по категориям: женский слой не должен выбивать CATEGORY_LIMITS уровня.
  const categoryCount = new Map<string, number>();
  for (const s of baseSubs) categoryCount.set(s.category, (categoryCount.get(s.category) || 0) + 1);

  for (const layer of FEMALE_ALL_LAYER_SUBS) {
    // Условные позиции (железо): без подтверждённого анализа — тихо пропускаем.
    // Гейт ВНУТРИ слоя: мужской путь сюда не доходит (sex-проверка выше).
    if (layer.labGate && !layer.labGate(ctx.labs)) continue;
    if (existing.has(canonId(layer.substanceId))) continue;
    if (subs.length >= TOTAL_LIMIT[ctx.level]) break;
    const catLimit = CATEGORY_LIMITS[ctx.level]?.[layer.category] ?? 0;
    if ((categoryCount.get(layer.category) || 0) >= catLimit) continue;
    subs.push({
      substanceId: layer.substanceId,
      category: layer.category,
      k: layer.k,
      q: layer.q,
      reason: layer.reason,
      mechsCovered: [...layer.mechsCovered],
      priority: layer.priority,
    });
    existing.add(canonId(layer.substanceId));
    categoryCount.set(layer.category, (categoryCount.get(layer.category) || 0) + 1);
    added.push(layer.substanceId);
  }

  const femaleFlags = rec.pedRisk?.femaleFlags || [];
  if (added.length === 0 && removed.length === 0 && femaleFlags.length === 0) return rec;

  const warnings = [...(rec.protocolWarnings || [])];
  for (const f of femaleFlags) {
    if (!warnings.includes(f)) warnings.push(f);
  }
  if (removed.length > 0) {
    const w = '♀ ЖЁСТКИЙ ГЕЙТ: HCT ≥48% — железо исключено из плана (риск гипервязкости на курсе ААС). Сначала гематокрит-контроль (решение — врач).';
    if (!warnings.includes(w)) warnings.push(w);
  }

  const namesRu = FEMALE_ALL_LAYER_SUBS.filter((l) => added.includes(l.substanceId)).map((l) => l.nameRu);
  const rationaleParts: string[] = [];
  if (added.length > 0) rationaleParts.push(`♀ Женский слой (усиление, мужской набор сохранён): +${namesRu.join(', ')}`);
  if (removed.length > 0) rationaleParts.push(`♀ ЖЁСТКИЙ ГЕЙТ: HCT ≥48% — исключено железо (${removed.join(', ')})`);
  const rationale = rationaleParts.length > 0 ? `${rec.rationale}\n${rationaleParts.join('\n')}` : rec.rationale;

  const femaleLayer: FemaleLayerResult = { added, labels: namesRu, flags: femaleFlags, removed };

  return {
    ...rec,
    subs,
    protocolWarnings: warnings.length > 0 ? warnings : rec.protocolWarnings,
    rationale,
    femaleLayer,
  };
}
