/**
 * lms-cycle-index.ts — реестр всех СРЦ-циклов (Этап B2). Обезличено.
 * Единый реестр шаблонов (унификация с cycle.engine.CYCLE_TEMPLATES — Этап R).
 */
import type { SRCycleTemplate } from './lms-types';

import { CYCLE_01 } from './cycle-01';
import { CYCLE_02 } from './cycle-02';
import { CYCLE_03 } from './cycle-03';
import { CYCLE_04 } from './cycle-04';
import { CYCLE_05 } from './cycle-05';
import { CYCLE_06 } from './cycle-06';
import { CYCLE_07 } from './cycle-07';
import { CYCLE_08 } from './cycle-08';
import { CYCLE_09K } from './cycle-09k';
import { CYCLE_09S } from './cycle-09s';
import { CYCLE_10 } from './cycle-10';
import { CYCLE_11 } from './cycle-11';
import { CYCLE_12K } from './cycle-12k';
import { CYCLE_12S } from './cycle-12s';
import { CYCLE_13 } from './cycle-13';
import { CYCLE_14 } from './cycle-14';
import { CYCLE_15 } from './cycle-15';
import { CYCLE_16 } from './cycle-16';
import { BLOCK_BENCH_BEG } from './block-bench-beg';
import { BLOCK_BENCH_INT } from './block-bench-int';
import { BLOCK_BENCH_EXP } from './block-bench-exp';
import { BLOCK_LIFT_BEG } from './block-lift-beg';
import { BLOCK_LIFT_INT } from './block-lift-int';
import { BLOCK_LIFT_EXP } from './block-lift-exp';
import { EMBED_MP_BEG } from './embed-mp-beg';
import { EMBED_MP_INT } from './embed-mp-int';
import { EMBED_MP_EXP } from './embed-mp-exp';
import { EMBED_BIC_BEG } from './embed-bic-beg';
import { EMBED_BIC_INT } from './embed-bic-int';
import { EMBED_BIC_EXP } from './embed-bic-exp';
import { CYCLE_BB_01 } from './cycle-bb-01';
import { CYCLE_BB_02 } from './cycle-bb-02';
import { CYCLE_BB_03 } from './cycle-bb-03';
import { CYCLE_BB_04 } from './cycle-bb-04';

export const LMS_CYCLES: SRCycleTemplate[] = [
 CYCLE_01,
 CYCLE_02,
 CYCLE_03,
 CYCLE_04,
 CYCLE_05,
 CYCLE_06,
 CYCLE_07,
 CYCLE_08,
 CYCLE_09K,
 CYCLE_09S,
 CYCLE_10,
 CYCLE_11,
 CYCLE_12K,
 CYCLE_12S,
 CYCLE_13,
 CYCLE_14,
 CYCLE_15,
 CYCLE_16,
 BLOCK_BENCH_BEG,
 BLOCK_BENCH_INT,
 BLOCK_BENCH_EXP,
 BLOCK_LIFT_BEG,
 BLOCK_LIFT_INT,
 BLOCK_LIFT_EXP,
 EMBED_MP_BEG,
 EMBED_MP_INT,
 EMBED_MP_EXP,
  EMBED_BIC_BEG,
  EMBED_BIC_INT,
  EMBED_BIC_EXP,
  CYCLE_BB_01,
  CYCLE_BB_02,
  CYCLE_BB_03,
  CYCLE_BB_04,
];

export function getCycleById(id: string): SRCycleTemplate | undefined {
 return LMS_CYCLES.find(c => c.meta.id === id);
}
export function getCyclesByDirection(dir: string): SRCycleTemplate[] {
 return LMS_CYCLES.filter(c => c.meta.direction === dir);
}
export function getCyclesByLevel(level: string): SRCycleTemplate[] {
 return LMS_CYCLES.filter(c => c.meta.level === level);
}
