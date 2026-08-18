/**
 * bb-specialization-registry.ts — реестр зон специализации ББ-авто.
 *
 * Единый источник для: выбора паттерна целевой зоны при переносе объёма
 * (donor-transfer), подсказок доноров в UI и валидации выбора зон.
 * Каноническая мышца для объёма/MRV остаётся в bb-specialization.engine
 * (WEAK_TO_MUSCLE): гранулярные зоны НЕ получают отдельный объёмный бюджет,
 * они управляют выбором паттернов и приоритетом упражнений.
 */

export interface SpecializationZoneSpec {
  /** Ключ зоны (как в WEAK_GROUPS UI). */
  key: string;
  /** Каноническая мышца для объёма/MRV. */
  canonical: string;
  /** RU-подпись. */
  label: string;
  /** Гранулярная зона (можно сочетать с другой зоной того же региона). */
  granular: boolean;
  /** Паттерны имён упражнений целевой зоны (для переноса и покрытия). */
  patterns: RegExp[];
  /** Рекомендуемые доноры (прямые мышцы, которые можно снизить). */
  donorRecommendations: string[];
}

const ZONES: SpecializationZoneSpec[] = [
  {
    key: 'chest', canonical: 'chest', label: 'Грудь', granular: false,
    patterns: [/жим.*лёж|жим.*л[её]ж|bench|жим.*гантел.*л[её]ж|сведен|развод|fly|crossover|кроссовер|бабоч/i],
    donorRecommendations: ['triceps', 'delt_front'],
  },
  {
    key: 'chest_upper', canonical: 'chest', label: 'Верх груди', granular: true,
    patterns: [/жим.*наклон|incline|наклонн.*жим|жим.*вверх.*угл/i],
    donorRecommendations: ['triceps', 'delt_front'],
  },
  {
    key: 'chest_lower', canonical: 'chest', label: 'Низ груди', granular: true,
    patterns: [/жим.*нижн|decline|брус|dip/i],
    donorRecommendations: ['triceps', 'delt_front'],
  },
  {
    key: 'back', canonical: 'back', label: 'Спина', granular: false,
    patterns: [/подтяг|тяга|pull.?up|pull.?down|row|наклон/i],
    donorRecommendations: ['biceps', 'forearms'],
  },
  {
    key: 'back_width', canonical: 'back', label: 'Ширина спины', granular: true,
    patterns: [/подтяг|верхн.*блок|lat.?pull|пуловер|прям.*рук/i],
    donorRecommendations: ['biceps', 'forearms'],
  },
  {
    key: 'back_thickness', canonical: 'back', label: 'Толщина спины', granular: true,
    patterns: [/тяга.*(штан|гантел|блок|наклон|горизонт|к.*груд|t.?бар)|row|горизонт.*тяга|тяга.*опор/i],
    donorRecommendations: ['biceps', 'forearms'],
  },
  {
    key: 'shoulders', canonical: 'shoulders', label: 'Плечи', granular: false,
    patterns: [/жим.*(стоя|сидя|плеч)|армейск|мах|развод.*гантел|lateral|raise|overhead|ohp/i],
    donorRecommendations: ['triceps', 'biceps', 'chest'],
  },
  {
    key: 'delt_front', canonical: 'shoulders', label: 'Передняя дельта', granular: true,
    patterns: [/жим.*(стоя|сидя)|армейск|перед.*собой|front.?raise|ohp|overhead/i],
    donorRecommendations: ['triceps', 'chest'],
  },
  {
    key: 'delt_mid', canonical: 'shoulders', label: 'Средняя дельта', granular: true,
    patterns: [/мах|развод.*(стоя|в.*сторон)|lateral.?raise|отведен.*рук|side.?raise/i],
    donorRecommendations: ['triceps', 'chest'],
  },
  {
    key: 'delt_rear', canonical: 'shoulders', label: 'Задняя дельта', granular: true,
    patterns: [/обратн|задн.*дельт|rear.?delt|лиц.*тяга|face.?pull|развод.*наклон/i],
    donorRecommendations: ['biceps', 'back'],
  },
  {
    key: 'biceps', canonical: 'biceps', label: 'Бицепс', granular: false,
    patterns: [/сгибан|curl|подъём.*бицепс|подъем.*бицепс|молот|hammer/i],
    donorRecommendations: ['triceps', 'delt_mid'],
  },
  {
    key: 'triceps', canonical: 'triceps', label: 'Трицепс', granular: false,
    patterns: [/разгибан|pushdown|француз|french|жим.*узк|close.?grip|overhead.*разгибан/i],
    donorRecommendations: ['biceps', 'chest'],
  },
  {
    key: 'forearms', canonical: 'forearms', label: 'Предплечья', granular: false,
    patterns: [/запяст|wrist|зоттман|zottman/i],
    donorRecommendations: [],
  },
  {
    key: 'quads', canonical: 'quads', label: 'Квадрицепс', granular: false,
    patterns: [/присед|squat|жим.*ног|leg.?press|разгибан.*ног|выпад|lunge|гакк|hack/i],
    donorRecommendations: ['hamstrings', 'glutes'],
  },
  {
    key: 'hamstrings', canonical: 'hamstrings', label: 'Бицепс бедра', granular: false,
    patterns: [/сгибан.*ног|leg.?curl|румын|rdl|гудморнинг|good.?morning/i],
    donorRecommendations: ['quads', 'glutes'],
  },
  {
    key: 'glutes', canonical: 'glutes', label: 'Ягодицы', granular: false,
    patterns: [/ягодичн|hip.?thrust|отведен.*бедр|abduction|kick.?back|мост|bridge/i],
    donorRecommendations: ['quads', 'hamstrings'],
  },
  {
    key: 'calves', canonical: 'calves', label: 'Икры', granular: false,
    patterns: [/носк|calf|икр/i],
    donorRecommendations: [],
  },
  {
    key: 'abs', canonical: 'abs', label: 'Пресс', granular: false,
    patterns: [/скручиван|crunch|подъём.*ног|подъем.*ног|планк|plank|ролик|roll.?out/i],
    donorRecommendations: [],
  },
  {
    key: 'traps', canonical: 'traps', label: 'Трапеции', granular: false,
    patterns: [/шраг|shrug|трапец/i],
    donorRecommendations: ['delt_rear', 'forearms'],
  },
];

const ZONE_BY_KEY = new Map(ZONES.map(z => [z.key, z]));

/** Спецификация зоны по ключу (fallback: канонический ключ). */
export function zoneSpec(key: string): SpecializationZoneSpec | null {
  return ZONE_BY_KEY.get(key) || null;
}

/** Все зоны реестра. */
export function allZoneSpecs(): SpecializationZoneSpec[] {
  return ZONES;
}

/** Паттерны имён упражнений для зоны (объединение всех выбранных зон). */
export function patternsForZones(zones: string[]): RegExp[] {
  const out: RegExp[] = [];
  for (const key of zones) {
    const spec = ZONE_BY_KEY.get(key);
    if (spec) out.push(...spec.patterns);
  }
  return out;
}

/** Рекомендуемые доноры для зоны (первые кандидаты в UI). */
export function donorsForZone(key: string): string[] {
  const spec = ZONE_BY_KEY.get(key);
  return spec ? spec.donorRecommendations : [];
}

/** Упражнение соответствует паттерну хотя бы одной зоны. */
export function matchesAnyZonePattern(exerciseName: string, zones: string[]): boolean {
  const n = (exerciseName || '').toLowerCase();
  return patternsForZones(zones).some(p => p.test(n));
}
