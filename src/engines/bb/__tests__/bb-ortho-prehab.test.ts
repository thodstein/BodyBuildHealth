/**
 * bb-ortho-prehab.test.ts — BB-D-19 (хвост): орто-скрининг → ББ-диагностика.
 *
 * Локи честности:
 *  - прехаб-строка НЕ притворяется слабой мышцей (зона = «сустав: … (прехаб)»),
 *    поэтому не может включить спец-блок по «больному» суставу;
 *  - `urgent` (стоп-флаг) → прехаба нет: тренировка на паузе, и строка «сделай face pull»
 *    здесь была бы ложью;
 *  - `doctor` → строка есть, но с пометкой «после допуска врача»;
 *  - режимные флаги (Beighton / жёлтые / teen) прехаба не дают — они едут гардами;
 *  - упражнения существуют в каталоге (id берутся из библиотеки коррекций, не выдуманы).
 */
import { describe, it, expect } from 'vitest';
import { bbOrthoPrehabRows, bbOrthoFlagsSummary, BB_ORTHO_JOINT_RU } from '../bb-ortho-prehab.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';

const flag = (over: Partial<{ id: string; joint: string; level: string; label: string }>) => ({
  id: 'knee_valgus_pos', joint: 'knee', level: 'watch', label: '🟡 Вальгус колена', ...over,
});

describe('орто-скрининг → прехаб (не слабые зоны)', () => {
  it('watch-флаг даёт щадящую строку с зоной «сустав: …», понятной дозой и источником', () => {
    const rows = bbOrthoPrehabRows([flag({})]);
    expect(rows.length).toBeGreaterThan(0);
    const r = rows[0];
    expect(r.joint).toBe('knee');
    expect(r.zone).toMatch(/^сустав: колено \(прехаб\)$/);
    // зона не может совпасть с канонической мышцей (иначе спец-блок «наказал» бы больное колено)
    expect(['quads', 'hamstrings', 'glutes', 'chest', 'back']).not.toContain(r.zone);
    expect(r.protocol).toMatch(/^\d+×\d+–\d+ RIR\d /);
    expect(r.source).toContain('орто J7');
    expect(r.doctorFirst).toBe(false);
    expect(r.cues.length).toBeGreaterThan(0);
  });

  it('все предложенные упражнения существуют в EXERCISE_CATALOG (нет выдуманных id)', () => {
    const ids = new Set((EXERCISE_CATALOG as any[]).map((e) => String(e.id)));
    const rows = bbOrthoPrehabRows([
      flag({ id: 'shoulder_cluster_pos', joint: 'shoulder', level: 'doctor' }),
      flag({}),
      flag({ id: 'hip_watch', joint: 'hip' }),
      flag({ id: 'achilles_watch', joint: 'ankle', level: 'doctor' }),
      flag({ id: 'spine_slr', joint: 'spine', level: 'doctor' }),
      flag({ id: 'elbow_valgus', joint: 'elbow' }),
    ], { cap: 6 });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(ids.has(r.exerciseId), r.exerciseId).toBe(true);
  });

  it('urgent-флаг отменяет прехаб целиком (тренировка на паузе)', () => {
    expect(bbOrthoPrehabRows([
      flag({ id: 'shoulder_urgent', joint: 'shoulder', level: 'urgent' }),
      flag({}),
    ])).toEqual([]);
  });

  it('doctor-флаг: строка есть, но с «после допуска врача» и флагом doctorFirst', () => {
    const rows = bbOrthoPrehabRows([flag({ id: 'shoulder_cluster_pos', joint: 'shoulder', level: 'doctor', label: 'Плечевой кластер+' })]);
    expect(rows[0].doctorFirst).toBe(true);
    expect(rows[0].why).toMatch(/^после допуска врача · /);
  });

  it('режимные флаги (Beighton / жёлтые / teen) прехаба не дают — это гарды, не зона', () => {
    expect(bbOrthoPrehabRows([
      flag({ id: 'beighton_pos', joint: 'general' }),
      flag({ id: 'yellow_flags', joint: 'general' }),
      flag({ id: 'teen_gate', joint: 'general' }),
    ])).toEqual([]);
  });

  it('один exerciseId не дублируется, даже если флагов два (колено + таз)', () => {
    const rows = bbOrthoPrehabRows([
      flag({ id: 'knee_valgus_pos', joint: 'knee' }),
      flag({ id: 'hip_watch', joint: 'hip' }),
    ], { cap: 6 });
    const ex = rows.map((r) => r.exerciseId);
    expect(new Set(ex).size).toBe(ex.length);
  });

  it('кап по умолчанию 3 и уважает явный cap', () => {
    const flags = [
      flag({ id: 'shoulder_cluster_pos', joint: 'shoulder', level: 'doctor' }),
      flag({}),
      flag({ id: 'hip_watch', joint: 'hip' }),
      flag({ id: 'achilles_watch', joint: 'ankle', level: 'doctor' }),
      flag({ id: 'spine_slr', joint: 'spine', level: 'doctor' }),
      flag({ id: 'elbow_valgus', joint: 'elbow' }),
    ];
    expect(bbOrthoPrehabRows(flags).length).toBeLessThanOrEqual(3);
    expect(bbOrthoPrehabRows(flags, { cap: 1 }).length).toBe(1);
  });

  it('мусор/пусто на входе — тихо (без исключений и выдуманных строк)', () => {
    for (const v of [null, undefined, [], 'x', 42, [null, {}, { joint: 'nope', level: 'watch' }]]) {
      expect(bbOrthoPrehabRows(v as any)).toEqual([]);
    }
    // ok-уровень — не флаг
    expect(bbOrthoPrehabRows([flag({ level: 'ok' })])).toEqual([]);
  });

  it('сводка считает уровни и не прячет urgent', () => {
    const s = bbOrthoFlagsSummary([
      flag({ id: 'shoulder_urgent', joint: 'shoulder', level: 'urgent' }),
      flag({ id: 'shoulder_cluster_pos', joint: 'shoulder', level: 'doctor' }),
      flag({}),
    ]);
    expect(s).toMatchObject({ total: 3, urgent: 1, doctor: 1, watch: 1 });
    expect(s.text).toContain('флагов 3');
    expect(s.text).toContain('🔴 1');
    expect(bbOrthoFlagsSummary([]).text).toBe('флагов нет');
  });

  it('русские подписи суставов — все ключи маппинга есть', () => {
    for (const j of ['shoulder', 'hip', 'knee', 'spine', 'ankle', 'elbow', 'hand'] as const) {
      expect(BB_ORTHO_JOINT_RU[j]).toBeTruthy();
    }
  });
});
