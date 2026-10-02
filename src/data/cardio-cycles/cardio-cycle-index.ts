/**
 * cardio-cycle-index.ts — реестр библиотеки именных кардио-циклов.
 * Аналог ss-cycle-index.ts / lms-cycle-index.ts для кардио.
 * 46 шаблонов: готовые PRO-циклы (Хигдон half×2/marathon, FIRST-finish,
 * BarryP, Daniels, MAF, Pete-full, Pete-beginner-24, SSB-LV, swim-base,
 * tri-sprint, bridge-10K) + профессиональные блоки PRO-2 (порог бегуна,
 * VO2max/5K, горки, FTP Builder, 100 км, гребля 5K, плавание 1500,
 * олимпийский триатлон, HYROX, боевое кардио, HIIT-периодизация) +
 * база (C25K/5K/10K/полумарафон/база/couch-half/80-20×3), гребля
 * (2K-12/2K-4/новичок-8), вело (1K-8), цели ×9.
 */
import type { CardioCycleTemplate } from './cardio-cycle-types';
import { CARDIO_PRO_HIGDON_HALF1_12 } from './cardio-pro-higdon-half1-12';
import { CARDIO_PRO_HIGDON_HALF2_12 } from './cardio-pro-higdon-half2-12';
import { CARDIO_PRO_HIGDON_MAR1_18 } from './cardio-pro-higdon-mar1-18';
import { CARDIO_PRO_FIRST_FINISH_16 } from './cardio-pro-first-finish-16';
import { CARDIO_PRO_BARRY_P_8 } from './cardio-pro-barryp-8';
import { CARDIO_PRO_DANIELS_5K_24 } from './cardio-pro-daniels-5k-24';
import { CARDIO_PRO_MAF_12 } from './cardio-pro-maf-12';
import { CARDIO_PRO_PETE_FULL_12 } from './cardio-pro-pete-full-12';
import { CARDIO_PRO_PETE_BEGINNER_24 } from './cardio-pro-petebeg-24';
import { CARDIO_PRO_SSB_LV_6 } from './cardio-pro-ssb-lv-6';
import { CARDIO_PRO_SWIM_BASE_4 } from './cardio-pro-swim-base-4';
import { CARDIO_PRO_TRI_SPRINT_8 } from './cardio-pro-tri-sprint-8';
import { CARDIO_PRO_TRI_OLYMPIC_12 } from './cardio-pro-tri-olympic-12';
import { CARDIO_PRO_BRIDGE10K_6 } from './cardio-pro-bridge10k-6';
import { CARDIO_RUN_THRESHOLD_8 } from './cardio-run-threshold-8';
import { CARDIO_RUN_VO2MAX_6 } from './cardio-run-vo2max-6';
import { CARDIO_RUN_HILLS_6 } from './cardio-run-hills-6';
import { CARDIO_BIKE_FTP_BUILDER_6 } from './cardio-bike-ftp-builder-6';
import { CARDIO_BIKE_CENTURY_10 } from './cardio-bike-century-10';
import { CARDIO_ROW_5K_8 } from './cardio-row-5k-8';
import { CARDIO_SWIM_1500_8 } from './cardio-swim-1500-8';
import { CARDIO_HYROX_12 } from './cardio-hyrox-12';
import { CARDIO_COMBAT_8 } from './cardio-combat-8';
import { CARDIO_HIIT_BLOCK_6 } from './cardio-hiit-block-6';
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

export const CARDIO_PRO_CYCLES: CardioCycleTemplate[] = [
  CARDIO_PRO_HIGDON_HALF1_12,
  CARDIO_PRO_HIGDON_HALF2_12,
  CARDIO_PRO_HIGDON_MAR1_18,
  CARDIO_PRO_FIRST_FINISH_16,
  CARDIO_PRO_BARRY_P_8,
  CARDIO_PRO_DANIELS_5K_24,
  CARDIO_PRO_MAF_12,
  CARDIO_PRO_PETE_FULL_12,
  CARDIO_PRO_PETE_BEGINNER_24,
  CARDIO_PRO_SSB_LV_6,
  CARDIO_PRO_SWIM_BASE_4,
  CARDIO_PRO_TRI_SPRINT_8,
  CARDIO_PRO_BRIDGE10K_6,
];

/**
 * PRO-2: профессиональные блоки модуля планирования (порог/VO2max/горки
 * бегуна, FTP/100 км вело, 5K гребля, 1500 м плавание, олимпийский
 * триатлон, HYROX, боевое кардио, HIIT-периодизация) — отдельный массив,
 * чтобы дайджесты «13 PRO» не смешивались с волной PRO-2.
 */
export const CARDIO_PRO2_CYCLES: CardioCycleTemplate[] = [
  CARDIO_RUN_THRESHOLD_8,
  CARDIO_RUN_VO2MAX_6,
  CARDIO_RUN_HILLS_6,
  CARDIO_BIKE_FTP_BUILDER_6,
  CARDIO_BIKE_CENTURY_10,
  CARDIO_ROW_5K_8,
  CARDIO_SWIM_1500_8,
  CARDIO_PRO_TRI_OLYMPIC_12,
  CARDIO_HYROX_12,
  CARDIO_COMBAT_8,
  CARDIO_HIIT_BLOCK_6,
];

export const CARDIO_CYCLES: CardioCycleTemplate[] = [
  ...CARDIO_PRO_CYCLES,
  ...CARDIO_PRO2_CYCLES,
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
