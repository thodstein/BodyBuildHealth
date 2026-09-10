/**
 * cardio-cycle-index.ts — реестр библиотеки именных кардио-циклов.
 * Аналог ss-cycle-index.ts / lms-cycle-index.ts для кардио.
 * 22 шаблона: бег (C25K/5K/10K/полумарафон/база/couch-half/80-20×3),
 * гребля (2K-12/2K-4/новичок-8), вело (1K-8), цели конструктора ×9.
 */
import type { CardioCycleTemplate } from './cardio-cycle-types';
import { CARDIO_RUN_C25K_9 } from './cardio-run-c25k-9';
import { CARDIO_RUN_5K_6 } from './cardio-run-5k-6';
import { CARDIO_RUN_10K_12 } from './cardio-run-10k-12';
import { CARDIO_RUN_HALF_14 } from './cardio-run-half-14';
import { CARDIO_RUN_BASE_12 } from './cardio-run-base-12';
import { CARDIO_RUN_COUCH_HALF_15 } from './cardio-run-couch-half-15';
import { CARDIO_8020_TEMPLATES } from './cardio-endurance-8020';
import { CARDIO_ROW_2K_12 } from './cardio-row-2k-12';
import { CARDIO_ROW_2K_4, CARDIO_ROW_BEGINNER_8 } from './cardio-row-short';
import { CARDIO_BIKE_1K_8 } from './cardio-bike-1k-8';
import { CARDIO_GOAL_TEMPLATES } from './cardio-goal-templates';

export const CARDIO_CYCLES: CardioCycleTemplate[] = [
  CARDIO_RUN_C25K_9,
  CARDIO_RUN_5K_6,
  CARDIO_RUN_BASE_12,
  CARDIO_RUN_10K_12,
  CARDIO_RUN_HALF_14,
  CARDIO_RUN_COUCH_HALF_15,
  ...CARDIO_8020_TEMPLATES,
  CARDIO_ROW_BEGINNER_8,
  CARDIO_ROW_2K_12,
  CARDIO_ROW_2K_4,
  CARDIO_BIKE_1K_8,
  ...CARDIO_GOAL_TEMPLATES,
];

export function getCardioCycleTemplateById(id: string): CardioCycleTemplate | undefined {
  return CARDIO_CYCLES.find(c => c.meta.id === id);
}

export function getCardioTemplatesBySport(sport: string): CardioCycleTemplate[] {
  if (sport === 'all') return CARDIO_CYCLES.slice();
  return CARDIO_CYCLES.filter(c => c.meta.sport === sport);
}
