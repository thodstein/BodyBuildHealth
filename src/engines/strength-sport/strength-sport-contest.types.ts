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
  arnold_uk: {
    name: 'Arnold UK — 5 ивентов',
    events: [
      { id: 'axle_press', format: 'max', weight: 120 },
      { id: 'yoke_walk', format: 'medley_distance', weight: 320, distanceM: 20, timeCapS: 60 },
      { id: 'farmers_walk_heavy', format: 'carry', weight: 130, distanceM: 30, turn: true, timeCapS: 60 },
      { id: 'deadlift_max', format: 'max', weight: 280 },
      { id: 'atlas_stone_load', format: 'loading_race', weight: 140, heightCm: 150 },
    ],
    weightClass: '<105',
  },
  giants_light: {
    name: 'Giants Light — 4 ивента',
    events: [
      { id: 'log_press', format: 'reps_60s', weight: 100 },
      { id: 'yoke_walk', format: 'carry', weight: 250, distanceM: 20, timeCapS: 75 },
      { id: 'sandbag_load', format: 'loading_race', weight: 100, heightCm: 130 },
      { id: 'tire_flip', format: 'reps_60s', weight: 180, repsTarget: 6 },
    ],
    weightClass: '<90',
  },
  siberian_open: {
    name: 'Siberian Open — 6 ивентов',
    events: [
      { id: 'log_press', format: 'max', weight: 110 },
      { id: 'yoke_walk', format: 'medley_distance', weight: 300, distanceM: 20, timeCapS: 60 },
      { id: 'farmers_walk_heavy', format: 'medley_distance', weight: 125, distanceM: 40, timeCapS: 75 },
      { id: 'conan_wheel', format: 'max', weight: 180, distanceM: 30, timeCapS: 60 },
      { id: 'truck_pull', format: 'medley_distance', weight: 6000, distanceM: 20, timeCapS: 90 },
      { id: 'atlas_stone_over_bar', format: 'ladder', ladderWeights: [110, 120, 130, 140, 150], heightCm: 150 },
    ],
    weightClass: 'open',
  },
  europa_4: {
    name: 'Europa 4 — 4 ивента (скорость)',
    events: [
      { id: 'viking_press', format: 'reps_75s', weight: 120 },
      { id: 'farmers_walk_heavy', format: 'carry', weight: 110, distanceM: 40, timeCapS: 60 },
      { id: 'sandbag_over_bar', format: 'loading_race', weight: 90, heightCm: 140 },
      { id: 'arm_over_arm', format: 'medley_distance', weight: 200, distanceM: 20, timeCapS: 60 },
    ],
    weightClass: '<80',
  },
  masters_105: {
    name: 'Masters 105 — 5 ивентов',
    events: [
      { id: 'axle_press', format: 'reps_60s', weight: 90 },
      { id: 'frame_carry', format: 'carry', weight: 200, distanceM: 30, timeCapS: 60 },
      { id: 'car_deadlift_18', format: 'reps_60s', weight: 220 },
      { id: 'husafell_carry', format: 'carry', weight: 120, distanceM: 40, timeCapS: 75 },
      { id: 'natural_stone_shoulder', format: 'loading_race', weight: 110, heightCm: 130 },
    ],
    weightClass: '105+',
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
