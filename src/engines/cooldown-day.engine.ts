/**
 * Cooldown Day Engine — заминка под целевые мышечные группы тренировочного дня.
 *
 * Для каждой группы (грудь/спина/квадрицепсы/бицепс бедра/ягодицы/плечи/
 * бицепс/трицепс/икры/кор) — статическая растяжка рабочих зон после тренировки
 * (2 подхода по 20-60 сек, мягкое натяжение). Композитные группы
 * (legs/upper/push/pull/fullbody/arms/lower) раскрываются в базовые через
 * общий нормализатор warmup-day.engine (canonicalizeGroups).
 *
 * collectGroupCooldown(groups) — мерж с дедупликацией и капом по объёму.
 * Используется generateCooldown (cooldown.engine) для упора на рабочие группы.
 *
 * @module cooldown-day-engine
 */

import { canonicalizeGroups, GROUP_LABELS, type CanonGroup } from './warmup-day.engine';

export interface CooldownPrepExercise {
  id: string;
  durationSec: number;
  note?: string;
}

export interface CooldownGroupPrep {
  stretch: CooldownPrepExercise[];
}

export const COOLDOWN_GROUP_PREP: Record<string, CooldownGroupPrep> = {
  chest: {
    stretch: [
      { id: 'chest_stretch', durationSec: 40, note: 'растяжка груди в дверном проёме, рука 90°' },
      { id: 'shoulder_stretch', durationSec: 30, note: 'перекрёстная растяжка плеча' },
    ],
  },
  back: {
    stretch: [
      { id: 'lat_stretch', durationSec: 40, note: 'растяжка широчайших: таз назад-вниз' },
      { id: 'child_pose', durationSec: 45, note: 'поза ребёнка, руки вперёд' },
    ],
  },
  quads: {
    stretch: [
      { id: 'quad_stretch', durationSec: 40, note: 'стоя, пятка к ягодице; колени вместе' },
    ],
  },
  hamstrings: {
    stretch: [
      { id: 'hamstring_stretch', durationSec: 40, note: 'лёжа/стоя, спина прямая' },
      { id: 'nerve_flossing', durationSec: 30, note: 'нейро-мобилизация, мягко' },
    ],
  },
  glutes: {
    stretch: [
      { id: 'glute_stretch', durationSec: 40, note: 'поза голубя: передняя нога 90°' },
    ],
  },
  shoulders: {
    stretch: [
      { id: 'shoulder_stretch', durationSec: 40, note: 'перекрёстная через грудь' },
      { id: 'chest_stretch', durationSec: 30 },
    ],
  },
  biceps: {
    stretch: [
      { id: 'bicep_stretch', durationSec: 30, note: 'рука назад, ладонь на стену' },
    ],
  },
  triceps: {
    stretch: [
      { id: 'triceps_stretch', durationSec: 30, note: 'локоть за голову, лёгкое надавливание' },
    ],
  },
  calves: {
    stretch: [
      { id: 'calf_stretch', durationSec: 40, note: 'стопа на стену, пятка на полу' },
    ],
  },
  core: {
    stretch: [
      { id: 'child_pose', durationSec: 45 },
      { id: 'cat_camel', durationSec: 30 },
      { id: 'side_bend', durationSec: 30, note: 'наклон в сторону, рука над головой' },
    ],
  },
  traps: {
    stretch: [
      { id: 'neck_cars', durationSec: 30, note: 'медленные круги головой' },
      { id: 'trap_stretch', durationSec: 30, note: 'наклон уха к плечу, лёгкое давление' },
    ],
  },
  forearms: {
    stretch: [
      { id: 'wrist_flex_ext', durationSec: 30, note: 'сгибание-разгибание кисти с паузой' },
    ],
  },
};

/** Заминка для набора групп дня: мерж с дедупликацией, кап ≤ 8 упражнений. */
export function collectGroupCooldown(groups: string[]): CooldownPrepExercise[] {
  const seen = new Set<string>();
  const out: CooldownPrepExercise[] = [];
  for (const g of groups) {
    for (const canon of canonicalizeGroups(g)) {
      const prep = COOLDOWN_GROUP_PREP[canon];
      if (!prep) continue;
      for (const ex of prep.stretch) {
        if (seen.has(ex.id)) continue;
        seen.add(ex.id);
        out.push(ex);
      }
    }
  }
  return out.slice(0, 8);
}

/** Русские подписи групп для заметки блока («рабочие зоны: грудь, спина»). */
export function prepGroupLabelsCooldown(groups: string[]): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const g of groups) {
    for (const canon of canonicalizeGroups(g)) {
      if (seen.has(canon)) continue;
      seen.add(canon);
      labels.push(GROUP_LABELS[canon] || canon);
    }
  }
  return labels.join(', ');
}

export { GROUP_LABELS, type CanonGroup };
