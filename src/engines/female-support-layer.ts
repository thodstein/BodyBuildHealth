/**
 * female-support-layer.ts — женский слой подбора поддержки (этап «женский слой», B).
 *
 * Принципы:
 *  - Активируется ТОЛЬКО при ctx.sex === 'female' И активном курсе (ctx.onCourse).
 *  - УСИЛИВАЕТ мужской набор: добавляет женские позиции поверх, ничего не удаляя
 *    и не понижая. Дедуп по canonId — если позицию уже взяла мужская ветка, не дублируем.
 *  - Уважает TOTAL_LIMIT уровня (не раздувает план сверх лимита).
 *  - НИКОГДА не мутирует входной rec — кэш resolvePlan хранит базовую рекомендацию,
 *    поэтому возвращается новый объект (мужской путь возвращается тем же объектом).
 *
 * Источник позиций: docs/FEMALE_AAS_PROTOCOLS.md (§5 «Примерные протоколы поддержки»).
 */
import type { MapperCtx, SupportRecommendation, RecommendedSub } from './tz-mapper-engine';
import type { TzCategory } from './tz-bridge-mechanism';
import { TOTAL_LIMIT } from './tz-bridge-mechanism';
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

export interface FemaleLayerResult {
  /** Добавленные женским слоем позиции (id) */
  added: string[];
  /** Женские флаги риска (вирилизация/противопоказания) */
  flags: string[];
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

  const existing = new Set(rec.subs.map((s) => canonId(s.substanceId)));
  const subs: RecommendedSub[] = [...rec.subs];
  const added: string[] = [];

  for (const layer of FEMALE_LAYER_SUBS) {
    if (existing.has(canonId(layer.substanceId))) continue;
    if (subs.length >= TOTAL_LIMIT[ctx.level]) break;
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
    added.push(layer.substanceId);
  }

  const femaleFlags = rec.pedRisk?.femaleFlags || [];
  if (added.length === 0 && femaleFlags.length === 0) return rec;

  const warnings = [...(rec.protocolWarnings || [])];
  for (const f of femaleFlags) {
    if (!warnings.includes(f)) warnings.push(f);
  }

  const namesRu = FEMALE_LAYER_SUBS.filter((l) => added.includes(l.substanceId)).map((l) => l.nameRu);
  const rationale = added.length > 0
    ? `${rec.rationale}\n♀ Женский слой (усиление, мужской набор сохранён): +${namesRu.join(', ')}`
    : rec.rationale;

  const femaleLayer: FemaleLayerResult = { added, flags: femaleFlags };

  return {
    ...rec,
    subs,
    protocolWarnings: warnings.length > 0 ? warnings : rec.protocolWarnings,
    rationale,
    femaleLayer,
  };
}
