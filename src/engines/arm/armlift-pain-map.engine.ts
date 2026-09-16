/**
 * armlift-pain-map.engine.ts — карта боли (PRO-6 M8).
 * Бинарный pain-стоп глушит всё; клиника различает зоны: где болит →
 * что разгрузить, а что можно. Красные флаги (онемение/отёк/ночная боль) —
 * стоп как раньше. Скрининг, не диагноз. Чистые функции.
 */

export type ArmliftPainZone =
  | 'thumb'
  | 'web'
  | 'wrist'
  | 'elbow_lateral'
  | 'elbow_medial'
  | 'shoulder';

export const ARMLIFT_PAIN_ZONES: Array<{ id: ArmliftPainZone; label: string }> = [
  { id: 'thumb', label: 'Палец (большой)' },
  { id: 'web', label: 'Перепонка' },
  { id: 'wrist', label: 'Запястье' },
  { id: 'elbow_lateral', label: 'Локоть снаружи' },
  { id: 'elbow_medial', label: 'Локоть внутри' },
  { id: 'shoulder', label: 'Плечо' },
];

export interface ArmliftPainMapInput {
  zones?: ArmliftPainZone[];
  numbness?: boolean;
  swelling?: boolean;
  nightPain?: boolean;
}

export interface ArmliftPainMapResult {
  /** true → стоп всё, к врачу (красные флаги). */
  stop: boolean;
  stopNote: string | null;
  /** Точечная разгрузка по зонам (пусто — боли нет). */
  unload: string[];
  unloadNote: string;
}

const UNLOAD_BY_ZONE: Record<ArmliftPainZone, string> = {
  thumb: 'Большой болит: щипок стоп, support и crush можно',
  web: 'Перепонка болит: широкий щипок стоп, Hub и support можно',
  wrist: 'Запястье болит: толстый гриф стоп, лёгкие экстензоры и crush можно',
  elbow_lateral: 'Локоть снаружи: пронация и crush под вопросом, лёгкий support можно',
  elbow_medial: 'Локоть внутри: сгибатели и щипок стоп, экстензоры можно',
  shoulder: 'Плечо болит: тяги сверху стоп, низкие carries можно',
};

export function assessArmliftPainMap(i: ArmliftPainMapInput): ArmliftPainMapResult {
  const reds: string[] = [];
  if (i.numbness) reds.push('онемение');
  if (i.swelling) reds.push('отёк');
  if (i.nightPain) reds.push('ночная боль');
  if (reds.length) {
    return {
      stop: true,
      stopNote: `Стоп: ${reds.join(' + ')} — к врачу, хват не грузить`,
      unload: [],
      unloadNote: `Стоп: ${reds.join(' + ')} — к врачу, хват не грузить`,
    };
  }
  const zones = Array.isArray(i.zones) ? i.zones.filter(Boolean) : [];
  if (!zones.length) {
    return { stop: false, stopNote: null, unload: [], unloadNote: 'Зоны боли не отмечены' };
  }
  const unload = zones.map((z) => UNLOAD_BY_ZONE[z]).filter(Boolean);
  return { stop: false, stopNote: null, unload, unloadNote: unload.join(' · ') };
}
