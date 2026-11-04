/**
 * bb-session-tags.ts — русские подписи тренировочных дней ББ-авто.
 *
 * Единственный источник словаря «sessionTag (EN) → RU». Раньше карта жила в UI
 * (`TrainingScreen_parts/bb-labels.ts`), и движковые артефакты (экспорт
 * календаря) не могли её использовать — в `.ics` уезжал английский тег.
 */

export const SESSION_TAG_RU: Record<string, string> = {
  Push: 'Грудь/Плечи/Трицепс',
  Pull: 'Спина/Бицепс',
  Legs: 'Ноги',
  Upper: 'Верх',
  Lower: 'Низ',
  FullBody: 'Всё тело',
  Chest: 'Грудь',
  Back: 'Спина',
  Shoulders: 'Плечи',
  Arms: 'Руки',
  ChestBack: 'Грудь/Спина',
  ShouldersArms: 'Плечи/Руки',
  Torso: 'Торс',
  Limbs: 'Конечности',
  UpperPower: 'Верх (сила)',
  LowerPower: 'Низ (сила)',
  UpperHyp: 'Верх (гипертрофия)',
  LowerHyp: 'Низ (гипертрофия)',
  LegsBiceps: 'Ноги/Бицепс',
  Glutes: 'Ягодицы',
  GlutesHams: 'Ягодицы/Бицепс бедра',
};

/** Подпись дня: sessionTag → RU (fallback на исходный тег, а не на пустоту). */
export function bbSessionTagLabel(tag?: string): string {
  if (!tag) return '';
  return SESSION_TAG_RU[tag] || tag;
}
