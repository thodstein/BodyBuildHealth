/**
 * bb-granular-zone.engine.ts — упражнение плана → гранулярная зона специализации.
 *
 * Зачем: `bb-plan-exercise-audit` собирает покрытие по КАНОНИЧЕСКИМ мышцам
 * (`chest`, `back`, `shoulders`), а хаб диагностики мыслит гранулярными зонами
 * (`chest_upper`, `back_width`, `delt_mid`). Из-за этого lengthened / углы /
 * строгие группы / SFR для приоритетной зоны всегда выглядели пустыми.
 *
 * Здесь — единственный резолвер «упражнение → зона». Правила детерминированные
 * и консервативные: если голова не определяется однозначно, возвращается null
 * (тогда аудит честно считает сет в канонической мышце, а не выдумывает голову).
 *
 * Vocabulary = `GRANULAR_SPECIALIZATION_ZONES` (bb-specialization.engine) —
 * те же id, что приходят из `normalizeSpecializationTargets`.
 */

export const GRANULAR_ZONES = [
  'chest_upper',
  'chest_lower',
  'back_width',
  'back_thickness',
  'delt_front',
  'delt_mid',
  'delt_rear',
] as const;

export type GranularZone = (typeof GRANULAR_ZONES)[number];

const ZONE_SET: ReadonlySet<string> = new Set(GRANULAR_ZONES);

/** Является ли id «головкой» мышцы (а не самой мышцей). */
export function isGranularZone(zone: string | null | undefined): zone is GranularZone {
  return !!zone && ZONE_SET.has(zone);
}

export interface ZoneSource {
  id?: string | null;
  name?: string | null;
  exerciseName?: string | null;
  targetMuscle?: string | null;
  substitutionGroup?: string | null;
  /** Каноническая мышца упражнения (из каталога/плана). */
  muscle?: string | null;
}

/**
 * Синонимы зон, которые встречаются в старых данных/UI
 * (`delt_mid` в хабе, `shoulders_side` в specialization.engine, `back_lats`).
 * Возвращает канонический id зоны или null.
 */
export function normalizeZoneAlias(zone: string | null | undefined): GranularZone | null {
  if (!zone) return null;
  const z = String(zone).toLowerCase().trim();
  if (ZONE_SET.has(z)) return z as GranularZone;
  const alias: Record<string, GranularZone> = {
    chest_mid: 'chest_upper',
    chest_middle: 'chest_upper',
    upper_chest: 'chest_upper',
    lower_chest: 'chest_lower',
    back_lats: 'back_width',
    lats: 'back_width',
    back_mid: 'back_thickness',
    shoulders_front: 'delt_front',
    shoulders_side: 'delt_mid',
    shoulders_rear: 'delt_rear',
    front_delts: 'delt_front',
    side_delts: 'delt_mid',
    rear_delts: 'delt_rear',
  };
  return alias[z] || null;
}

/** Групповые коды каталога, которые однозначно задают головку. */
const SUB_GROUP_ZONE: Record<string, GranularZone> = {
  inc_push: 'chest_upper',
  chest_iso_upper: 'chest_upper',
  decline_push: 'chest_lower',
  decl_push: 'chest_lower',
  chest_iso_lower: 'chest_lower',
  dip_push: 'chest_lower',
  lat_delt_iso: 'delt_mid',
  rear_iso: 'delt_rear',
  rear_delt_iso: 'delt_rear',
  front_delt_iso: 'delt_front',
  vert_pull: 'back_width',
  lat_iso: 'back_width',
  hor_pull: 'back_thickness',
};

/** Текстовые правила: применяются в пределах канонической группы. */
const TEXT_RULES: Record<string, Array<{ zone: GranularZone; re: RegExp }>> = {
  chest: [
    { zone: 'chest_lower', re: /нижн|decline|брусья|dips?\b|сведение в кроссовере снизу|low.?fly/i },
    { zone: 'chest_upper', re: /наклон|incline|верхн|upper|гильотин|guillotine/i },
  ],
  back: [
    { zone: 'back_width', re: /широч|lat\b|lats\b|pulldown|pull-?down|подтяг|pull-?up|ширин|верхн(яя|ий) тяга|straight.?arm|пуловер|pullover/i },
    { zone: 'back_thickness', re: /тяга|row|толщ|thickness|шраги|shrug|t-?bar|гребн/i },
  ],
  shoulders: [
    { zone: 'delt_rear', re: /задн|rear|reverse|face.?pull|обратн(ая|ые) развод|reverse.?fly/i },
    { zone: 'delt_front', re: /передн|front|жим стоя|жим над головой|overhead press|\bohp\b|армейск|army|жим штанги стоя/i },
    { zone: 'delt_mid', re: /средн|lateral|махи|развод(ка)? в сторон|side.?raise|боков/i },
  ],
};

/**
 * Голова мышцы для упражнения. null — определить нельзя (тогда сет учитывается
 * в канонической мышце, но не в головке).
 */
export function granularZoneOf(src: ZoneSource, canonicalMuscle?: string | null): GranularZone | null {
  const sub = String(src.substitutionGroup || '').toLowerCase();
  const bySub = SUB_GROUP_ZONE[sub];
  const canonical = String(canonicalMuscle || src.muscle || '').toLowerCase();
  // Подгруппа надёжнее текста, но обязана принадлежать той же канонической мышце:
  // иначе «жим лёжа» с чужой подгруппой перепишет зону плеча.
  if (bySub && (!canonical || sameRegion(bySub, canonical))) return bySub;
  const text = [src.id, src.exerciseName, src.name, src.targetMuscle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!text) return null;
  for (const group of Object.keys(TEXT_RULES)) {
    if (canonical && !sameRegion(group, canonical)) continue;
    for (const rule of TEXT_RULES[group]) {
      if (rule.re.test(text)) return rule.zone;
    }
  }
  return null;
}

function sameRegion(zoneOrGroup: string, canonical: string): boolean {
  const c = String(canonical || '').toLowerCase();
  if (!c) return true;
  const zone = normalizeZoneAlias(zoneOrGroup);
  const group = zone ? ZONE_PARENT[zone] : zoneOrGroup;
  // Алиасы канонов: delts/deltoid/плечи → shoulders, lats/back → back.
  const norm = (g: string): string =>
    /^(delt|shoulder)/.test(g) ? 'shoulders' : /^(lat|back)/.test(g) ? 'back' : g;
  return norm(group) === norm(c);
}

const ZONE_PARENT: Record<GranularZone, string> = {
  chest_upper: 'chest',
  chest_lower: 'chest',
  back_width: 'back',
  back_thickness: 'back',
  delt_front: 'shoulders',
  delt_mid: 'shoulders',
  delt_rear: 'shoulders',
};

/** Каноническая мышца головки (chest_upper → chest). */
export function canonicalOfZone(zone: string): string {
  const z = normalizeZoneAlias(zone);
  return z ? ZONE_PARENT[z] : String(zone || '');
}
