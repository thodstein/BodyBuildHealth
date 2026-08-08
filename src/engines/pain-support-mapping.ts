/**
 * pain-support-mapping.ts — Маппинг зон боли → протоколы поддержки.
 * Вещества берутся из существующего калькулятора поддержки (support-catalog-data.ts + support-dosing.ts).
 * Не дублирует дозировки — только зональные связки.
 */

export interface SupportRecommendation {
  substanceId: string;
  rationale: string;
  priority: 'core' | 'targeted' | 'topical';
}

export interface ZoneSupportMap {
  zoneId: string;
  zoneLabel: string;
  recommendations: SupportRecommendation[];
}

export const PAIN_ZONE_SUPPORT: ZoneSupportMap[] = [
  {
    zoneId: 'shoulders',
    zoneLabel: 'Плечи',
    recommendations: [
      { substanceId: 'collagen', rationale: 'Ядро протокола: суставная ткань и связки', priority: 'core' },
      { substanceId: 'vitamin_c', rationale: 'Кофактор синтеза коллагена (Фаза 1)', priority: 'core' },
      { substanceId: 'glucosamine', rationale: 'Стимуляция протеогликанов хондроцитами (Фаза 2)', priority: 'core' },
      { substanceId: 'msm', rationale: 'Дисульфидные мостики коллагена, противовоспалительное (Фаза 2)', priority: 'core' },
      { substanceId: 'curcumin', rationale: 'Ингибирование COX-2/NF-kB (Фаза 3)', priority: 'targeted' },
      { substanceId: 'boswellia', rationale: 'Ингибирование 5-LOX (Фаза 3)', priority: 'targeted' },
      { substanceId: 'voltaren_gel', rationale: 'Местное обезболивание (топical)', priority: 'topical' },
    ],
  },
  {
    zoneId: 'elbows',
    zoneLabel: 'Локти',
    recommendations: [
      { substanceId: 'collagen', rationale: 'Поддержка сухожилий и связок', priority: 'core' },
      { substanceId: 'vitamin_c', rationale: 'Синтез коллагена в связках', priority: 'core' },
      { substanceId: 'msm', rationale: 'Противовоспалительное для мягких тканей', priority: 'core' },
      { substanceId: 'curcumin', rationale: 'Снижение воспаления в области локтя', priority: 'targeted' },
      { substanceId: 'voltaren_gel', rationale: 'Местное обезболивание при теннисном локте', priority: 'topical' },
    ],
  },
  {
    zoneId: 'wrists',
    zoneLabel: 'Запястья',
    recommendations: [
      { substanceId: 'collagen', rationale: 'Поддержка связок запястья', priority: 'core' },
      { substanceId: 'vitamin_c', rationale: 'Синтез коллагена', priority: 'core' },
      { substanceId: 'msm', rationale: 'Противовоспалительное для суставов запястья', priority: 'core' },
      { substanceId: 'curcumin', rationale: 'Снижение воспаления при тендоварните', priority: 'targeted' },
      { substanceId: 'voltaren_gel', rationale: 'Местное обезболивание', priority: 'topical' },
    ],
  },
  {
    zoneId: 'lower_back',
    zoneLabel: 'Поясница',
    recommendations: [
      { substanceId: 'collagen', rationale: 'Поддержка межпозвонковых дисков и связок', priority: 'core' },
      { substanceId: 'vitamin_d3', rationale: 'Минерализация костей и мышечный тонус (Фаза 1)', priority: 'core' },
      { substanceId: 'magnesium', rationale: 'Расслабление мышц, предотвращение спазмов', priority: 'core' },
      { substanceId: 'msm', rationale: 'Противовоспалительное для связок и дисков', priority: 'core' },
      { substanceId: 'curcumin', rationale: 'Снижение воспаления в мягких тканях поясницы (Фаза 3)', priority: 'targeted' },
      { substanceId: 'boswellia', rationale: 'Противовоспалительное при хронической боли в спине (Фаза 3)', priority: 'targeted' },
      { substanceId: 'voltaren_gel', rationale: 'Местное обезболивание мышц поясницы', priority: 'topical' },
    ],
  },
  {
    zoneId: 'hips',
    zoneLabel: 'ТБС',
    recommendations: [
      { substanceId: 'collagen', rationale: 'Поддержка хряща тазобедренного сустава', priority: 'core' },
      { substanceId: 'glucosamine', rationale: 'Стимуляция регенерации хряща (Фаза 2)', priority: 'core' },
      { substanceId: 'hyaluronic_acid', rationale: 'Компонент синовиальной жидкости (Фаза 3)', priority: 'core' },
      { substanceId: 'curcumin', rationale: 'Противовоспалительное для глубоких суставов', priority: 'targeted' },
      { substanceId: 'boswellia', rationale: 'Противовоспалительное при артрозе ТБС (Фаза 3)', priority: 'targeted' },
    ],
  },
  {
    zoneId: 'knees',
    zoneLabel: 'Колени',
    recommendations: [
      { substanceId: 'collagen', rationale: 'Строительный блок хряща коленного сустава (UC-II, Фаза 1)', priority: 'core' },
      { substanceId: 'glucosamine', rationale: 'Стимуляция синовиальной жидкости (Фаза 2)', priority: 'core' },
      { substanceId: 'msm', rationale: 'Противовоспалительное для суставов (Фаза 2)', priority: 'core' },
      { substanceId: 'curcumin', rationale: 'Снижение воспаления при артрите (Фаза 3)', priority: 'targeted' },
      { substanceId: 'voltaren_gel', rationale: 'Местное обезболивание и отёк', priority: 'topical' },
    ],
  },
  {
    zoneId: 'ankles',
    zoneLabel: 'Голеностоп',
    recommendations: [
      { substanceId: 'collagen', rationale: 'Поддержка связок голеностопа', priority: 'core' },
      { substanceId: 'vitamin_c', rationale: 'Синтез коллагена в связках', priority: 'core' },
      { substanceId: 'msm', rationale: 'Противовоспалительное при растяжениях', priority: 'core' },
      { substanceId: 'curcumin', rationale: 'Снижение воспаления после травм', priority: 'targeted' },
      { substanceId: 'voltaren_gel', rationale: 'Местное обезболивание при травмах', priority: 'topical' },
    ],
  },
];

export function getSupportForZone(zoneId: string): SupportRecommendation[] {
  const entry = PAIN_ZONE_SUPPORT.find(z => z.zoneId === zoneId);
  return entry ? entry.recommendations : [];
}

export function getSupportForZones(zoneIds: string[]): SupportRecommendation[] {
  const map = new Map<string, SupportRecommendation>();
  for (const zid of zoneIds) {
    const recs = getSupportForZone(zid);
    for (const r of recs) {
      if (!map.has(r.substanceId)) map.set(r.substanceId, r);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const order = { core: 0, targeted: 1, topical: 2 };
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
  });
}

export function getSupportSummary(zoneIds: string[]): string {
  const recs = getSupportForZones(zoneIds);
  if (recs.length === 0) return '';
  const core = recs.filter(r => r.priority === 'core').map(r => r.substanceId).join(', ');
  const targeted = recs.filter(r => r.priority === 'targeted').map(r => r.substanceId).join(', ');
  const topical = recs.filter(r => r.priority === 'topical').map(r => r.substanceId).join(', ');
  const parts = [];
  if (core) parts.push(`Ядро: ${core}`);
  if (targeted) parts.push(`Целевое: ${targeted}`);
  if (topical) parts.push(`Местное: ${topical}`);
  return parts.join(' · ');
}
