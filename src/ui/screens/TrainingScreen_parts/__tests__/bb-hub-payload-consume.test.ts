/**
 * 3.9 (план BB-AUTO-EXHAUSTIVE-PRO) — guard: хаб→ББ-авто payload↔потребитель 1:1.
 *
 * Полный jsdom-рендер BbAutoConstructor виснет (пред-существующее, god-component),
 * поэтому проверяем исходник: 18 write-only localStorage-ключей удалены, а 11
 * ранее неиспользуемых payload-полей реально потребляются (fallback групп +
 * строка «диагностика: …»). Транспорт моста закрыт отдельным bb-hub-bridge.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '..', 'BbAutoConstructor.tsx'),
  'utf8',
);

const WRITE_ONLY_KEYS = [
  'he_bb_last_lab_diagnosis', 'he_bb_last_spec_block', 'he_bb_last_weak_causes', 'he_bb_last_lr',
  'he_bb_last_readiness', 'he_bb_last_red_flags', 'he_bb_last_bar', 'he_bb_last_pose', 'he_bb_last_teen',
  'he_bb_ortho_guards', 'he_bb_ortho_flags', 'he_bb_last_lvp', 'he_bb_last_tendon', 'he_bb_last_return_to',
  'he_bb_diag_readiness_action', 'he_bb_lr_direction', 'he_bb_last_mmc', 'he_bb_last_working_range',
];

describe('3.9 хаб→ББ-авто: payload↔потребитель 1:1 (source-guard)', () => {
  it('18 write-only localStorage-ключей больше не упоминаются', () => {
    for (const k of WRITE_ONLY_KEYS) {
      expect(SRC.includes(k), k).toBe(false);
    }
  });

  it('read-ключи сохранены (lab_delta/lr_topup/return_action/preferred/swaps/corrections/weak_heads)', () => {
    for (const k of [
      'he_bb_last_lab_delta', 'he_bb_lr_topup', 'he_bb_return_action',
      'he_bb_preferred_exercises', 'he_bb_exercise_swaps', 'he_bb_execution_corrections',
      'he_bb_last_weak_heads', 'he_bb_ortho_mobility', 'he_bb_ortho_excluded',
    ]) {
      expect(SRC.includes(k), k).toBe(true);
    }
  });

  it('11 полей потребляются: fallback групп + строка «диагностика»', () => {
    // fallback: гранулярные → канонические → общие
    expect(SRC).toContain('bbDiag.weakMusclesCanonical ?? bbDiag.weakPoints ?? bbDiag.groups');
    // строка-потребитель
    expect(SRC).toContain('диагностика: ');
    for (const field of [
      'bbDiag.bbDiagScore', 'bbDiag.bbDiagLevel', 'bbDiag.verification',
      'bbDiag.symmetry', 'bbDiag.stimulus', 'bbDiag.perMuscleAcwr',
      'bbDiag.ohs', 'bbDiag.vbt', 'bbDiag.sleepHours', 'bbDiag.weakCauses',
    ]) {
      expect(SRC.includes(field), field).toBe(true);
    }
  });
});
