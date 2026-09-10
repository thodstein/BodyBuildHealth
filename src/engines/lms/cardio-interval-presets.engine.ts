/**
 * cardio-interval-presets.engine.ts — именные HIIT-протоколы как
 * CardioStructuredBlock-сессии (P0-4 плана).
 *  - Norwegian 4×4 (Helgerud/NTNU 2007: 4×4 мин @85-95% HRmax / 3 мин
 *    @60-70%, +7-13% VO2max за 8 нед, ≤2-3×/нед);
 *  - Billat 30-30 (vVO2max 30с / jog 30с до отказа, 16-24 повтора,
 *    калибровка 6-мин тестом: дистанция/12 на 30 с);
 *  - Tabata (7-8×20с @170% VO2max / 10с, +7 мл/кг VO2max и +28%
 *    анаэробной ёмкости за 6 нед, Tabata 1996).
 * Калибровка — через параметры, без выдуманных темпов: если HRmax
 * неизвестен — зоны не ставятся, интенсивность задаётся текстом/RPE.
 */
import type { CardioEquipment, CardioStructuredBlock, CardioType } from './cardio.engine';

export interface CardioIntervalPreset {
  id: 'norwegian-4x4' | 'billat-30-30' | 'tabata';
  title: string;
  protocol: string;
  frequency: string;
  calibration: string;
  sessionType: CardioType;
  /** Построить structured-блок; hrMax/lthr — опционально (без них — без targetHr). */
  build: (opts?: { hrMax?: number; sixMinDistanceM?: number }) => CardioStructuredBlock;
  warmup: string;
  equipment: CardioEquipment[];
}

const clampHr = (v: number): number => Math.max(80, Math.min(220, Math.round(v)));

export const CARDIO_INTERVAL_PRESETS: CardioIntervalPreset[] = [
  {
    id: 'norwegian-4x4',
    title: 'Norwegian 4×4 (VO2max)',
    protocol: '4× (4 мин жёстко @85-95% HRmax / 3 мин легко @60-70%)',
    frequency: '2-3×/нед, не в дни тяжёлых ног',
    calibration: 'HRmax: 220-age (или Tanaka 208−0.7×age); говорить сложно, но можно',
    sessionType: 'hiit',
    build: (opts = {}) => {
      const hm = opts.hrMax != null && opts.hrMax >= 120 && opts.hrMax <= 220 ? clampHr(opts.hrMax) : undefined;
      return {
        workSec: 240, restSec: 180, reps: 4, target: 'hr',
        ...(hm ? { targetHr: { min: clampHr(hm * 0.85), max: clampHr(hm * 0.95) } } : {}),
        note: 'Norwegian 4×4: 4 мин жёстко / 3 мин легко ×4',
      };
    },
    warmup: 'Разминка 10 мин легко + 3-4 ускорения.',
    equipment: ['running', 'cycling', 'rowing'],
  },
  {
    id: 'billat-30-30',
    title: 'Billat 30-30 (время на VO2max)',
    protocol: '30 с на vVO2max / 30 с трусцой (~50%) до отказа (16-24 повтора)',
    frequency: '2×/нед в скоростном блоке',
    calibration: '6-мин тест: дистанция/12 = метры на 30 с жёсткого отрезка',
    sessionType: 'hiit',
    build: (opts = {}) => ({
      workSec: 30, restSec: 30, reps: 20, target: 'pace',
      note: opts.sixMinDistanceM != null && opts.sixMinDistanceM > 500
        ? `Billat 30-30: жёсткие по ${Math.round(opts.sixMinDistanceM / 12)} м (6-мин тест ${opts.sixMinDistanceM} м)`
        : 'Billat 30-30: жёсткие на vVO2max (сделайте 6-мин тест для калибровки)',
    }),
    warmup: 'Разминка 10 мин лёгкого бега.',
    equipment: ['running', 'cycling', 'rowing'],
  },
  {
    id: 'tabata',
    title: 'Tabata 20-10 (аэроб+анаэроб)',
    protocol: '7-8× (20 с @~170% VO2max / 10 с отдых) — до изнеможения',
    frequency: '1-2×/нед, только на вело/гребле/сани (не бег — травмоопасно)',
    calibration: 'All-out: максимум, который держится 20 с ×8',
    sessionType: 'hiit',
    build: () => ({
      workSec: 20, restSec: 10, reps: 8, target: 'rpe',
      note: 'Tabata: 20 с максимум / 10 с отдых ×8 (вело/гребля)',
    }),
    warmup: 'Разминка 10 мин + 3×20 с прогрессивно.',
    equipment: ['cycling', 'rowing'],
  },
];

export function getCardioIntervalPreset(id: string): CardioIntervalPreset | undefined {
  return CARDIO_INTERVAL_PRESETS.find(p => p.id === id);
}
