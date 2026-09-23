import { describe, it, expect } from 'vitest';
import { BB_CORRECTIVES } from '../bb-corrective.engine';
import { WEAK_TO_MUSCLE } from '../bb-builder.engine';

/**
 * K2 (BB-CORRECTIVE-HUB-PRO-PLAN): покрытие зон ≥2 записями.
 * Списки — канон поверхностей: GRANULAR_OPTS хаба (BBDiagnosticsHub.tsx) и
 * WEAK_GROUPS ББ-авто (bb-auto-constructor-shared.tsx) на момент K2.
 * Списки захардкожены осознанно (импорт UI-модулей в движковый тест тянет React);
 * при добавлении зоны в поверхность — добавить и сюда.
 */
const HUB_ZONES = ['delt_mid', 'delt_rear', 'delt_front', 'chest_upper', 'chest_lower', 'back_width', 'back_thickness', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves', 'traps', 'forearms'];
const BUILDER_ZONES = ['chest', 'chest_upper', 'chest_lower', 'back', 'back_width', 'back_thickness', 'shoulders', 'delt_front', 'delt_mid', 'delt_rear', 'quads', 'hamstrings', 'glutes', 'calves', 'biceps', 'triceps', 'forearms', 'abs', 'traps'];
const count = (zone: string) => BB_CORRECTIVES.filter((c) => c.targets.includes(zone)).length;

describe('bb-corrective K2: покрытие зон ≥2', () => {
  it('каждая зона чипов хаба имеет ≥4 записи (ROUND-10: было ≥3)', () => {
    const thin = HUB_ZONES.filter((z) => count(z) < 4).map((z) => `${z}:${count(z)}`);
    expect(thin).toEqual([]);
  });
  it('каждая зона слабых групп ББ-авто имеет ≥4 записи (ROUND-10: было ≥3)', () => {
    const thin = BUILDER_ZONES.filter((z) => count(z) < 4).map((z) => `${z}:${count(z)}`);
    expect(thin).toEqual([]);
  });
  it('ROUND-10: каждый скрининг-сигнал даёт ≥4 варианта', () => {
    const SIG = ['bench-fix', 'bench-watch', 'nhe-weak', 'add-weak', 'erir-low', 'ybt-asym', 'ktw-asym', 'hinge-fail', 'shoulder-fail', 'rot-gap', 'loaded-fail', 'pm-yellow'];
    const thin = SIG.filter((s) => count(s) < 4).map((s) => `${s}:${count(s)}`);
    expect(thin).toEqual([]);
  });
  it('ROUND-10: каждый драйвер движения (резолвер хаба) даёт ≥4 варианта', () => {
    // MovementDriver = ankle|hip|thoracic|shoulder|core|none ('flexibility' в типе нет — не выдумываем)
    const DRV = ['driver:ankle', 'driver:hip', 'driver:thoracic', 'driver:shoulder', 'driver:core'];
    const thin = DRV.filter((d) => count(d) < 4).map((d) => `${d}:${count(d)}`);
    expect(thin).toEqual([]);
  });
  it('ROUND-10: каждая объявленная причина в каждой фазе имеет ≥2 варианта', () => {
    const CAUSES = ['volume', 'activation', 'recovery', 'technique', 'genetics'];
    const PHASES = ['technique', 'strength', 'stability'];
    const thin: string[] = [];
    for (const cause of CAUSES) {
      for (const ph of PHASES) {
        const n = BB_CORRECTIVES.filter((c) => c.causes.includes(cause as never) && c.phase === ph).length;
        if (n > 0 && n < 2) thin.push(`${cause}/${ph}:${n}`);
      }
    }
    expect(thin).toEqual([]);
  });
  it('ранее пустые/тонкие зоны закрыты: traps/forearms/abs/biceps/adductor', () => {
    for (const z of ['traps', 'forearms', 'abs', 'biceps', 'adductor']) {
      expect(count(z), z).toBeGreaterThanOrEqual(2);
    }
  });
  it('adductor-записи ≥2 и маппинг в канон (учёт объёма не «мимо»)', () => {
    const add = BB_CORRECTIVES.filter((c) => c.targets.includes('adductor'));
    expect(add.length).toBeGreaterThanOrEqual(2);
    expect(WEAK_TO_MUSCLE['adductor']).toBeTruthy();
  });
});
