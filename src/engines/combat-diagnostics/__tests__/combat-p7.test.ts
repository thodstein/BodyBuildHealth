import { describe, it, expect } from 'vitest';
import { scoreCombat } from '../../../engines/combat-diagnostics/combat-scoring.engine';
import {
  auditCombatCoverage, buildCombatSpecBlock, combatWeakCause, rankCombatCorrections, simulateCombatCorrection,
} from '../../../engines/combat-diagnostics/combat-correction.engine';
import {
  buildCombatBridgeData, rollbackCombatPlan, snapshotCombatPlan,
} from '../../../engines/combat-diagnostics/combat-diagnostics-injection.engine';
import {
  buildCombatDiagnosticsCsv, buildCombatDiagnosticsHtml,
} from '../../../engines/combat-diagnostics/combat-diagnostics-export.engine';

/** P7: RSS-свойства + floors + verification; топ-3; инъекция/откат; экспорт XSS/CSV. */
describe('combat scoring (P7 RSS)', () => {
  it('пусто — 100 минус мобильность, без капа', () => {
    const s = scoreCombat({ worstStrike: null, worstTakedown: null, path: null, asymPct: null, trackerPresent: false, videoPresent: false, mobilityPresent: true, safetyBlocked: false, neckWeak: false });
    expect(s.score).toBe(100);
    expect(s.capped).toBe(false);
  });

  it('субаддитивность: два варнинга < суммы', () => {
    const s = scoreCombat({ worstStrike: 'warn', worstTakedown: 'warn', path: null, asymPct: null, trackerPresent: false, videoPresent: false, mobilityPresent: true, safetyBlocked: false, neckWeak: false });
    expect(s.score).toBeGreaterThan(100 - 12 - 10);
    expect(s.score).toBeLessThan(100);
  });

  it('floors: redflag и асимметрия ≥12 режут до ≤49', () => {
    const blocked = scoreCombat({ worstStrike: null, worstTakedown: null, path: null, asymPct: null, trackerPresent: false, videoPresent: false, mobilityPresent: true, safetyBlocked: true, neckWeak: false });
    expect(blocked.score).toBeLessThanOrEqual(49);
    expect(blocked.capped).toBe(true);
    const asym = scoreCombat({ worstStrike: null, worstTakedown: null, path: null, asymPct: 15, trackerPresent: false, videoPresent: false, mobilityPresent: true, safetyBlocked: false, neckWeak: false });
    expect(asym.score).toBeLessThanOrEqual(49);
  });

  it('verification: видео .35 + трекер .30 + мобильность .35', () => {
    const s = scoreCombat({ worstStrike: null, worstTakedown: null, path: null, asymPct: null, trackerPresent: true, videoPresent: true, mobilityPresent: true, safetyBlocked: false, neckWeak: false });
    expect(s.verification).toBeCloseTo(1, 5);
    const n = scoreCombat({ worstStrike: null, worstTakedown: null, path: null, asymPct: null, trackerPresent: false, videoPresent: false, mobilityPresent: false, safetyBlocked: false, neckWeak: false });
    expect(n.verification).toBe(0);
  });
});

describe('combat correction chain (P7)', () => {
  it('топ-3: асимметрия первая, детерминированно', () => {
    const causes = [
      combatWeakCause('cross', { lowSpeed: true, lowMass: false, asymFix: false, acwrBad: false, mobilityMissing: false }),
      combatWeakCause('jab', { lowSpeed: false, lowMass: false, asymFix: true, acwrBad: false, mobilityMissing: false }),
    ];
    const top = rankCombatCorrections(causes);
    expect(top[0].point).toBe('jab');
    expect(top).toHaveLength(2);
  });

  it('симуляция — честный ориентир ≤20', () => {
    const top = rankCombatCorrections([combatWeakCause('cross', { lowSpeed: true, lowMass: true, asymFix: false, acwrBad: false, mobilityMissing: false })]);
    const sim = simulateCombatCorrection(60, top);
    expect(sim.delta).toBeLessThanOrEqual(20);
  });

  it('спец-блок 4–8 нед + аудит покрытия', () => {
    expect(buildCombatSpecBlock(['cross'], 2).weeks).toBe(4);
    expect(buildCombatSpecBlock(['cross'], 99).weeks).toBe(8);
    const a = auditCombatCoverage(['cross'], ['cross', 'double']);
    expect(a.uncovered).toEqual(['double']);
  });
});

describe('combat injection bridge (P7)', () => {
  it('мост несёт слабейшие + сторону + dayMap, сборка не меняется (только payload)', () => {
    const d = buildCombatBridgeData({ weakestStrike: 'cross', weakestTakedown: 'double', weakSide: 'left', barPath: null, neckLevel: 2, score: 70, specDayMap: { cross: [1, 3] }, blocked: false });
    expect(d.groups).toContain('strike:cross');
    expect(d.groups).toContain('takedown:double');
    expect(d.diagnosticWeakSide).toBe('left');
    expect(d.combatAsymmetry).toBe('left');
    expect((d.specBlock as { dayMap: Record<string, number[]> }).dayMap).toEqual({ cross: [1, 3] });
  });

  it('снапшот/откат по ключам', () => {
    const store = new Map<string, string>([['he_combat_plan_v1', '{"weeks":6}']]);
    expect(snapshotCombatPlan(k => store.get(k) ?? null, (k, v) => void store.set(k, v))).toBe(true);
    store.set('he_combat_plan_v1', '{"weeks":999}');
    expect(rollbackCombatPlan(k => store.get(k) ?? null, (k, v) => void store.set(k, v))).toBe(true);
    expect(store.get('he_combat_plan_v1')).toBe('{"weeks":6}');
    expect(rollbackCombatPlan(() => null, () => undefined)).toBe(false);
  });
});

describe('combat export (P7)', () => {
  it('HTML экранирует, CSV с BOM и антиформулой', () => {
    const html = buildCombatDiagnosticsHtml([{ block: 'Удары', point: '<script>', value: 'ok' }], 'Скор 70');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    const csv = buildCombatDiagnosticsCsv([{ block: 'Удары', point: 'кросс', value: '=cmd' }]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain("'=cmd");
  });
});
