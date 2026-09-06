/**
 * ss-cycle-index.ts — реестр интернет-циклов ТА / силового экстрима.
 * Аналог lms-cycle-index.ts для strength-sport. Обезличено.
 */
import type { SSCycleTemplate } from './ss-types';
import { SS_TA_GENERAL_8 } from './ss-ta-general-8';
import { SS_TA_SOVIET_8 } from './ss-ta-soviet-8';
import { SS_TA_BULGARIAN } from './ss-ta-bulgarian';
import { SS_TA_COMPLETE_12 } from './ss-ta-complete-12';
import { SS_SM_START_12 } from './ss-sm-start-12';
import { SS_SM_TRIO_12 } from './ss-sm-trio-12';
import { SS_SM_531_4 } from './ss-sm-531-4';
import { SS_SM_CUBE_12 } from './ss-sm-cube-12';
import { SS_SM_BASE_12 } from './ss-sm-base-12';
import { SS_HB_MIX_8 } from './ss-hb-mix-8';

export const SS_CYCLES: SSCycleTemplate[] = [
  SS_TA_GENERAL_8,
  SS_TA_SOVIET_8,
  SS_TA_BULGARIAN,
  SS_TA_COMPLETE_12,
  SS_SM_START_12,
  SS_SM_TRIO_12,
  SS_SM_531_4,
  SS_SM_CUBE_12,
  SS_SM_BASE_12,
  SS_HB_MIX_8,
];

export function getSSCycleById(id: string): SSCycleTemplate | undefined {
  return SS_CYCLES.find(c => c.meta.id === id);
}

export function getSSCyclesByMode(mode: string): SSCycleTemplate[] {
  if (mode === 'hybrid') return SS_CYCLES.slice();
  return SS_CYCLES.filter(c => c.meta.mode === mode);
}
