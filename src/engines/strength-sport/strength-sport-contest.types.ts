/**
 * strength-sport-contest.types.ts — Contest Packet для стронгмена (PRO).
 * Описывает точный набор ивентов предстоящего старта → периодизация, отбор, taper под него.
 */

export type SMContestFormat = 'max' | 'reps_60s' | 'reps_75s' | 'ladder' | 'medley_distance' | 'medley_time' | 'loading_race' | 'hold' | 'carry';

export interface SMContestEvent {
  id: string; // event id из EVENT_META
  format: SMContestFormat;
  weight?: number; // вес снаряда на старте (кг)
  distanceM?: number; // дистанция carries / drag
  timeCapS?: number; // лимит времени
  heightCm?: number; // высота платформы для stones/logs
  turn?: boolean; // разворот 180° (farmers/yoke)
  implements?: string[]; // для medley: ['yoke_walk','farmers_walk_heavy','atlas_stone_load']
  ladderWeights?: number[]; // для ladder: [100,110,120,130,140]
  repsTarget?: number; // для reps: сколько требует регламент
}

export interface StrongmanContest {
  id?: string;
  name?: string;
  date?: string; // ISO
  events: SMContestEvent[];
  weightClass?: string; // <80, <90, <105, 105+, open
}

export const CONTEST_FORMAT_RU: Record<SMContestFormat, string> = {
  max: 'Макс',
  reps_60s: 'Reps 60с',
  reps_75s: 'Reps 75с',
  ladder: 'Лестница',
  medley_distance: 'Medley дистанция',
  medley_time: 'Medley время',
  loading_race: 'Загрузка',
  hold: 'Удержание',
  carry: 'Переноска',
};

export const CONTEST_PRESETS: Record<string, StrongmanContest> = {
  uss_105: {
    name: 'USS <105 — классика 5 ивентов',
    events: [
      { id: 'log_press', format: 'reps_60s', weight: 110, repsTarget: 8 },
      { id: 'yoke_walk', format: 'medley_distance', weight: 300, distanceM: 20, timeCapS: 60 },
      { id: 'farmers_walk_heavy', format: 'medley_distance', weight: 120, distanceM: 40, turn: true, timeCapS: 75 },
      { id: 'car_deadlift_18', format: 'reps_60s', weight: 250, repsTarget: 10 },
      { id: 'atlas_stone_load', format: 'ladder', ladderWeights: [100, 110, 120, 130, 140], heightCm: 140 },
    ],
    weightClass: '<105',
  },
  novice_3: {
    name: 'Новичок 3 ивента',
    events: [
      { id: 'log_press', format: 'max', weight: 80 },
      { id: 'farmers_walk_heavy', format: 'carry', weight: 100, distanceM: 40, timeCapS: 60 },
      { id: 'atlas_stone_load', format: 'loading_race', weight: 80, heightCm: 120 },
    ],
    weightClass: 'open',
  },
  osg_light: {
    name: 'OSG Light — 6 ивентов',
    events: [
      { id: 'axle_press', format: 'max', weight: 100 },
      { id: 'yoke_walk', format: 'medley_distance', weight: 280, distanceM: 20, timeCapS: 60 },
      { id: 'frame_carry', format: 'carry', weight: 220, distanceM: 20, timeCapS: 60 },
      { id: 'sandbag_over_bar', format: 'loading_race', weight: 100, heightCm: 140, timeCapS: 75 },
      { id: 'truck_pull', format: 'medley_distance', weight: 5000, distanceM: 20, timeCapS: 90 },
      { id: 'atlas_stone_over_bar', format: 'ladder', ladderWeights: [90, 100, 110, 120, 130] },
    ],
    weightClass: '<80',
  },
};

export function validateContest(c: StrongmanContest | null | undefined): string[] {
  const errs: string[] = [];
  if (!c || !Array.isArray(c.events) || c.events.length === 0) errs.push('Контест: добавьте хотя бы 1 ивент');
  if ((c?.events?.length || 0) > 8) errs.push('Контест: максимум 8 ивентов');
  for (const e of c?.events || []) {
    if (!e.id) errs.push('Ивент без id');
    if (e.format === 'ladder' && (!e.ladderWeights || e.ladderWeights.length < 3)) errs.push(`${e.id}: ladder требует ≥3 весов`);
  }
  return errs;
}
