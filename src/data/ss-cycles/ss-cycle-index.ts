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
import { SS_SM_PEAK_4 } from './ss-sm-peak-4';
import { SS_TA_PEAK_4 } from './ss-ta-peak-4';
import { SS_SM_PRESS_6 } from './ss-sm-press-6';
import { SS_TA_BASE_6 } from './ss-ta-base-6';
import { SS_HB_TRANSIT_2 } from './ss-hb-transit-2';
// PRO-волна (12 профессиональных циклов): соревновательные, техника, сила,
// русская школа, специализация, masters; статика, переноски, новичок, GPP,
// пик к соревнованию, загрузки.
import { SS_TA_TECHNIQUE_6 } from './ss-ta-technique-6';
import { SS_TA_STRENGTH_8 } from './ss-ta-strength-8';
import { SS_TA_RUSSIAN_12 } from './ss-ta-russian-12';
import { SS_TA_COMP_12 } from './ss-ta-comp-12';
import { SS_TA_SQUAT_SPEC_6 } from './ss-ta-squat-spec-6';
import { SS_TA_MASTERS_8 } from './ss-ta-masters-8';
import { SS_SM_STATIC_12 } from './ss-sm-static-12';
import { SS_SM_MOVING_8 } from './ss-sm-moving-8';
import { SS_SM_BEGINNER_8 } from './ss-sm-beginner-8';
import { SS_SM_GPP_10 } from './ss-sm-gpp-10';
import { SS_SM_PEAK_8 } from './ss-sm-peak-8';
import { SS_SM_LOADING_6 } from './ss-sm-loading-6';
import { SS_TA_TAPER_2 } from './ss-ta-taper-2';
import { SS_SM_TAPER_2 } from './ss-sm-taper-2';
import { SS_TA_GPP_8 } from './ss-ta-gpp-8';

export const SS_CYCLES: SSCycleTemplate[] = [
  // ——— ТА (14) · [0] оставлен general-8: на него завязаны UI-контракты каталога ———
  SS_TA_GENERAL_8,
  SS_TA_SOVIET_8,
  SS_TA_BULGARIAN,
  SS_TA_COMPLETE_12,
  SS_TA_GPP_8,
  SS_TA_TECHNIQUE_6,
  SS_TA_STRENGTH_8,
  SS_TA_SQUAT_SPEC_6,
  SS_TA_MASTERS_8,
  SS_TA_RUSSIAN_12,
  SS_TA_COMP_12,
  SS_TA_PEAK_4,
  SS_TA_BASE_6,
  SS_TA_TAPER_2,
  // ——— Стронг (14) ———
  SS_SM_START_12,
  SS_SM_TRIO_12,
  SS_SM_531_4,
  SS_SM_CUBE_12,
  SS_SM_BASE_12,
  SS_SM_BEGINNER_8,
  SS_SM_GPP_10,
  SS_SM_STATIC_12,
  SS_SM_MOVING_8,
  SS_SM_LOADING_6,
  SS_SM_PEAK_8,
  SS_SM_PRESS_6,
  SS_SM_PEAK_4,
  SS_SM_TAPER_2,
  // ——— Гибрид (2) ———
  SS_HB_MIX_8,
  SS_HB_TRANSIT_2,
];

export function getSSCycleById(id: string): SSCycleTemplate | undefined {
  return SS_CYCLES.find(c => c.meta.id === id);
}

export function getSSCyclesByMode(mode: string): SSCycleTemplate[] {
  if (mode === 'hybrid') return SS_CYCLES.slice();
  return SS_CYCLES.filter(c => c.meta.mode === mode);
}
