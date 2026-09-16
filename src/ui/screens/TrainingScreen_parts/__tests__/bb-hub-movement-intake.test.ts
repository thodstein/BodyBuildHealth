/**
 * D1 (§9 плана BB-AUTO-EXHAUSTIVE-PRO) — source-guard приёмника движений ББ-диагностики.
 *
 * Полный jsdom-рендер BbAutoConstructor виснет (god-component — все BB-тесты идут через
 * renderToStaticMarkup, а intake слушает window-событие и pre-render payload не переигрывает),
 * поэтому проверяем исходник: helper вызывается, bits/persist/clean/LEGACY на месте,
 * сборка не тронута (`mobilityRestrictions`/`lrTopUp` из движений не пишутся), `vbtLossPct`
 * остаётся @deprecated-полем моста (не удалён — иначе красный tsc в чужом хабе).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '..', 'BbAutoConstructor.tsx'), 'utf8');
const BRIDGE = readFileSync(resolve(__dirname, '..', 'planner-bridge.ts'), 'utf8');

describe('D1 intake: helper + bits (source-guard)', () => {
  it('helper импортирован и вызывается с полями движения', () => {
    expect(SRC).toContain("import { resolveBbDiagIntakeExtras } from '../../../engines/bb/bb-diag-intake.engine';");
    expect(SRC).toContain('resolveBbDiagIntakeExtras({');
    for (const f of ['movementDriver: bbDiag.movementDriver', 'singleLeg: bbDiag.singleLeg', 'lrVerdicts: bbDiag.lrVerdicts', 'lrTopUp: bbDiag.lrTopUp']) {
      expect(SRC.includes(f), f).toBe(true);
    }
  });

  it('bits уходят в diagBits-тост «диагностика: …» (без дубль-строки)', () => {
    expect(SRC).toContain('const diagBits: string[] = [...diagExtras.bits];');
    expect(SRC).toContain('диагностика: ');
  });
});

describe('D1 intake: persist + rationale (source-guard)', () => {
  it('persist-ключи движения пишутся', () => {
    expect(SRC).toContain("localStorage.setItem('he_bb_last_movement_driver'");
    expect(SRC).toContain("localStorage.setItem('he_bb_last_single_leg'");
  });

  it('строка в rationale уже собранного плана: дедуп по строке (паттерн labDelta)', () => {
    expect(SRC).toContain('const movementLine = `🧭 Скрининг движений: ${diagExtras.bits.join(');
    expect(SRC).toContain('if (rat.some((r) => r === movementLine)) return prev;');
  });
});

describe('D1 intake: stale-чистка по маркеру lrVerdicts (source-guard)', () => {
  it('обе ветки чистки используют решение движка', () => {
    expect(SRC).toContain('if (diagExtras.clean.lrTopUp) {');
    expect(SRC).toContain('if (diagExtras.clean.returnAction) {');
    expect(SRC).toContain("localStorage.removeItem('he_bb_lr_topup')");
    expect(SRC).toContain("localStorage.removeItem('he_bb_return_action')");
  });

  it('старые ветки приёма помечены LEGACY', () => {
    expect(/LEGACY[\s\S]{0,500}if \(bbDiag\.lrTopUp/.test(SRC)).toBe(true);
    expect(/LEGACY[\s\S]{0,500}if \(bbDiag\.returnAction/.test(SRC)).toBe(true);
  });

  it('сборка не тронута: движения не пишут mobilityRestrictions/lrTopUp-применение', () => {
    expect(SRC).not.toContain('setMobilityRestrictions((prev) => Array.from(new Set([...prev, ...diagExtras');
    expect(SRC).not.toContain('setLrTopUp(diagExtras');
    expect(SRC).not.toContain('diagExtras.persist.movementDriver) && setMobility');
  });

  it('vbtLossPct конструктором не читается', () => {
    expect(SRC.includes('bbDiag.vbtLossPct')).toBe(false);
  });
});

describe('D1 planner-bridge: vbtLossPct @deprecated, не удалён (source-guard)', () => {
  it('поле на месте и помечено @deprecated', () => {
    expect(BRIDGE).toContain('vbtLossPct?: number | null;');
    expect(/@deprecated[\s\S]{0,400}vbtLossPct\?: number \| null;/.test(BRIDGE)).toBe(true);
  });
});
