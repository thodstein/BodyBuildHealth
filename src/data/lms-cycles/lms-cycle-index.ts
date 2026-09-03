/**
 * lms-cycle-index.ts — реестр всех СРЦ-циклов (Этап B2). Обезличено.
 * Единый реестр шаблонов (унификация с cycle.engine.CYCLE_TEMPLATES — Этап R).
 */
import type { SRCycleTemplate, SRDirection } from './lms-types';

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
import { CYCLE_BB_05 } from './cycle-bb-05';
import { CYCLE_BB_06 } from './cycle-bb-06';
import { CYCLE_BB_07 } from './cycle-bb-07';
import { CYCLE_BB_08 } from './cycle-bb-08';
import { CYCLE_BB_09 } from './cycle-bb-09';
import { CYCLE_BB_10 } from './cycle-bb-10';
import { CYCLE_BB_11 } from './cycle-bb-11';
import { CYCLE_BB_12 } from './cycle-bb-12';

// СРЦ2 (авторские программы) — начато Jul 12
import { SRC2_MURAVYOV_16 } from './src2/src2-muravyov-16';
import { SRC2_SOLOVYOV_BENCH_28 } from './src2/src2-solovyov-bench-28';
import { SRC2_PTBAZ_8 } from './src2/src2-ptbaz-8';
import { SRC2_PT12TA } from './src2/src2-pt12ta';
import { SRC2_PERSPEKTIVA } from './src2/src2-perspektiva';
import { SRC2_REKORD } from './src2/src2-rekord';
import { SRC2_SISTEMY_1I2 } from './src2/src2-sistemy-1i2';
import { SRC2_SHEIKO_13 } from './src2/src2-sheiko-13';
import { SRC2_GUSENITSA } from './src2/src2-gusenitsa';
import { SRC2_VOLNA } from './src2/src2-volna';
import { SRC2_DPSM } from './src2/src2-dpsm';
import { SRC2_BAZOVAYA } from './src2/src2-bazovaya';
import { SRC2_HATFIELD_12 } from './src2/src2-hatfield-12';
import { SRC2_WASHINGTON_5X5 } from './src2/src2-washington-5x5';
import { SRC2_COAN_BENCH } from './src2/src2-coan-bench';
import { SRC2_MCCULLOUGH_DL } from './src2/src2-mccullough-dl';
import { SRC2_VERKHOSHANSKY_PEAK } from './src2/src2-verkhoshansky-peak';
import { SRC2_MURAVJEV_BENCH } from './src2/src2-muravjev-bench';
import { SRC2_BUTENKO_BASE } from './src2/src2-butenko-base';
import { SRC2_BUTENKO_PEAK } from './src2/src2-butenko-peak';
import { SRC2_RUSSIAN_CYCLE } from './src2/src2-russian-cycle';
import { SRC2_SHEIKO_SHORT_16 } from './src2/src2-sheiko-short-16';
import { SRC2_SHEIKO_PREP } from './src2/src2-sheiko-prep';
import { SRC2_SHEIKO_COMP } from './src2/src2-sheiko-comp';
import { SRC2_COAN_PL } from './src2/src2-coan-pl';
import { SRC2_PETRUSHIN_SQUAT } from './src2/src2-petrushin-squat';

// Западные и Smolov/Candito/Sheiko 29-32 (Sep 2026)
import { SMOLOV } from './smolov';
import { SMOLOV_JR } from './smolov-jr';
import { CANDITO_6 } from './candito-6';
import { SHEIKO_29 } from './sheiko-29';
import { SHEIKO_30 } from './sheiko-30';
import { SHEIKO_31 } from './sheiko-31';
import { SHEIKO_32 } from './sheiko-32';
import { GZCLP } from './gzclp';
import { JUGGERNAUT_2 } from './juggernaut-2';
import { TEXAS_METHOD } from './texas-method';
import { MADCOW } from './madcow';
import { WESTSIDE } from './westside';
import { KORTE_3X3 } from './korte';
import { GOLOVINSKY_8 } from './golovinsky-8';
import { SHEIKO_AML_20 } from './sheiko-aml-20';
import { CALGARY_16 } from './calgary-16';
import { RTS_9 } from './rts-9';
import { SHEIKO_CMS_MS } from './sheiko-cms-ms';
import { WENDLER_531 } from './wendler-531';
import { NSUNS } from './nsuns';
import { CUBE } from './cube';
import { SHEIKO_37 } from './sheiko-37';
import { CALGARY_8 } from './calgary-8';
import { HATCH } from './hatch';
import { WENDLER_BBB } from './wendler-bbb';
import { BULGARIAN } from './bulgarian';
import { LILLIEBRIDGE } from './lilliebridge';
import { RUSSIAN_SQUAT } from './russian-squat';
import { GZCL_UHF } from './gzcl-uhf';
import { COAN_DEADLIFT } from './coan-deadlift';
import { KIZEN_SHEIKO } from './kizen-sheiko';
import { TEN_TWENTY_LIFE } from './ten-twenty-life';
import { BASE_BUILDING } from './base-building';
import { TSA_9 } from './tsa-9';
import { BRIDGE } from './bridge';

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
  CYCLE_BB_05,
  CYCLE_BB_06,
  CYCLE_BB_07,
  CYCLE_BB_08,
  CYCLE_BB_09,
  CYCLE_BB_10,
  CYCLE_BB_11,
  CYCLE_BB_12,
   // СРЦ2
   SRC2_MURAVYOV_16,
   SRC2_SOLOVYOV_BENCH_28,
   SRC2_PTBAZ_8,
   SRC2_PT12TA,
   SRC2_PERSPEKTIVA,
   SRC2_REKORD,
   SRC2_SISTEMY_1I2,
   SRC2_SHEIKO_13,
   SRC2_GUSENITSA,
   SRC2_VOLNA,
   SRC2_DPSM,
   SRC2_BAZOVAYA,
   SRC2_HATFIELD_12,
   SRC2_WASHINGTON_5X5,
   SRC2_COAN_BENCH,
   SRC2_MCCULLOUGH_DL,
   SRC2_VERKHOSHANSKY_PEAK,
   SRC2_MURAVJEV_BENCH,
   SRC2_BUTENKO_BASE,
   SRC2_BUTENKO_PEAK,
   SRC2_RUSSIAN_CYCLE,
    SRC2_SHEIKO_SHORT_16,
    SRC2_SHEIKO_PREP,
    SRC2_SHEIKO_COMP,
    SRC2_COAN_PL,
    SRC2_PETRUSHIN_SQUAT,
    // Западные + Smolov/Sheiko 29-32 + МС+
    SMOLOV,
    SMOLOV_JR,
    CANDITO_6,
    SHEIKO_29,
    SHEIKO_30,
    SHEIKO_31,
    SHEIKO_32,
    GZCLP,
    JUGGERNAUT_2,
    TEXAS_METHOD,
    MADCOW,
    WESTSIDE,
    KORTE_3X3,
    GOLOVINSKY_8,
    SHEIKO_AML_20,
    CALGARY_16,
    RTS_9,
    SHEIKO_CMS_MS,
    WENDLER_531,
    NSUNS,
    CUBE,
    SHEIKO_37,
    CALGARY_8,
    HATCH,
    WENDLER_BBB,
    BULGARIAN,
    LILLIEBRIDGE,
    RUSSIAN_SQUAT,
    GZCL_UHF,
    COAN_DEADLIFT,
    KIZEN_SHEIKO,
    TEN_TWENTY_LIFE,
    BASE_BUILDING,
    TSA_9,
    BRIDGE,
];

export function getCycleById(id: string): SRCycleTemplate | undefined {
 return LMS_CYCLES.find(c => c.meta.id === id);
}
export function getCyclesByDirection(dir: SRDirection | string): SRCycleTemplate[] {
  return LMS_CYCLES.filter(c => c.meta.direction === dir);
}
export function getCyclesByLevel(level: string): SRCycleTemplate[] {
  return LMS_CYCLES.filter(c => c.meta.level === level);
}

/**
 * Normalise any SRDirection into 'strength' | 'bodybuilding' | 'both'.
 */
export type TrainingDirection = 'strength' | 'bodybuilding' | 'both';

export function normalizeCycleDirection(dir: SRDirection | string): TrainingDirection {
  const strengthDirs = new Set([
    'powerlifting', 'bench', 'deadlift_bench', 'squat_bench',
    'deadlift_squat', 'armwrestling', 'weightlifting',
    'peaking_pl', 'peaking_bench', 'peaking_deadlift',
    'competition',
  ]);
  const bodybuildingDirs = new Set([
    'bodybuilding', 'hypertrophy', 'peaking_bb', 'cutting', 'contest_prep',
  ]);
  if (strengthDirs.has(dir)) return 'strength';
  if (bodybuildingDirs.has(dir)) return 'bodybuilding';
  return 'both';
}

export function getCyclesByTrainingDirection(dir: 'strength' | 'bodybuilding' | 'both'): SRCycleTemplate[] {
  return LMS_CYCLES.filter(c => normalizeCycleDirection(c.meta.direction) === dir);
}
