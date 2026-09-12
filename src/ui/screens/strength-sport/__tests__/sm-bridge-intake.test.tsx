/**
 * sm-bridge-intake.test.ts — приём payload хаба в конструктор стронга.
 *
 * Покрывает реальные дыры моста (найдены аудитом хаб→конструктор):
 *  1. hub velocityHistory {liftId:[best,last]} раньше вливался в vbtMap под
 *     чужим форматом ключей — build() его отбрасывал, VBT хаба терялся;
 *  2. strategy хаба не читалась вовсе — попытки всегда 'balanced';
 *  3. swayCm хаба никуда не сохранялся.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { parseSmBridgePayload, collectSsVelocityHistory, buildSpecProtocols } from '../sm-bridge-intake';
import { buildStrengthSportPlan } from '../../../../engines/strength-sport/strength-sport-builder.engine';
import { StrengthSportConstructor } from '../StrengthSportConstructor';

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {}
});
afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {}
});

const smPayload = () => ({
  smWeakPoints: ['farmers_grip', 'farmers_grip', 'core_brace', 'conditioning', 'extra_zone'],
  groups: [],
  wlWeakPoints: [],
  weakPoints: [],
  contest: { name: 'Тест', events: [{ id: 'yoke_walk', format: 'max', weight: 200 }] },
  velocityLossPct: 18,
  velocityHistory: { yoke_walk: [1.5, 1.2], atlas_stone_load: [0.75, 0.6] },
  swayCm: 4.2,
  strategy: 'aggressive',
  level: 'warn',
});

describe('parseSmBridgePayload', () => {
  it('полный SM-payload: слабые/режим/контест/VBT/sway/strategy', () => {
    const p = parseSmBridgePayload(smPayload());
    expect(p.weakPoints).toEqual(['farmers_grip', 'core_brace', 'conditioning', 'extra_zone']);
    expect(p.mode).toBe('strongman');
    expect(p.contest?.name).toBe('Тест');
    expect(p.velocityLossPct).toBe(18);
    expect(p.hubVelocity).toEqual({ yoke_walk: [1.5, 1.2], atlas_stone_load: [0.75, 0.6] });
    expect(p.swayCm).toBe(4.2);
    expect(p.strategy).toBe('aggressive');
    expect(p.diagnosticLevel).toBe('warn');
  });

  it('WL-payload: режим weightlifting, без контеста', () => {
    const p = parseSmBridgePayload({ wlWeakPoints: ['snatch_pull'], groups: ['snatch_pull'] });
    expect(p.mode).toBe('weightlifting');
    expect(p.contest).toBeNull();
    expect(p.weakPoints).toEqual(['snatch_pull']);
  });

  it('spec opt-in: taSpecTargets из weeks[].targetSets + buildSpecProtocols', () => {
    const p = parseSmBridgePayload({
      wlWeakPoints: ['snatch_mid'],
      taSpecBlock: { totalWeeks: 3, weeks: [{ targetSets: 3 }, { targetSets: 4 }, { targetSets: 'x' }] },
      taPreferredCorr: { snatch_mid: 'pause_snatch' },
      taWeakCauses: { snatch_mid: 'technique' },
    });
    expect(p.taSpecTargets).toEqual([3, 4]);
    expect(p.taSpecWeeks).toBe(3);
    const protos = buildSpecProtocols(['snatch_mid'], p.taPreferredCorr, p.taWeakCauses, [], []);
    expect(protos.snatch_mid.sets).toBeGreaterThan(0);
    expect(protos.snatch_mid.reps).toBeGreaterThan(0);
    // Без слабых — пусто, без паники
    expect(buildSpecProtocols([], null, null)).toEqual({});
    expect(parseSmBridgePayload({}).taSpecTargets).toBeNull();
  });

  it('контест без events отклоняется, smContest — фолбэк', () => {
    expect(parseSmBridgePayload({ contest: { name: 'битый' } }).contest).toBeNull();
    const p = parseSmBridgePayload({
      contest: null,
      smContest: { name: 'Пресет', events: [{ id: 'log_press', format: 'max' }] },
    });
    expect(p.contest?.name).toBe('Пресет');
    expect(p.mode).toBe('strongman');
  });

  it('мусор в velocityHistory чистится', () => {
    const p = parseSmBridgePayload({
      velocityHistory: {
        yoke_walk: ['abc', null, 1.5, -2, 0],
        empty: [],
        broken: 'не массив',
      },
    });
    expect(p.hubVelocity).toEqual({ yoke_walk: [1.5] });
  });

  it('пустые массивы зон режим не переключают', () => {
    expect(parseSmBridgePayload({ smWeakPoints: [] }).mode).toBeNull();
    expect(parseSmBridgePayload({ wlWeakPoints: [] }).mode).toBeNull();
    expect(parseSmBridgePayload({ smWeakPoints: ['farmers_grip'] }).mode).toBe('strongman');
  });

  it('vbtLossPct — фолбэк при битом velocityLossPct; оба битые → null', () => {
    expect(parseSmBridgePayload({ velocityLossPct: 'мусор', vbtLossPct: 12 }).velocityLossPct).toBe(12);
    expect(parseSmBridgePayload({ velocityLossPct: 'мусор' }).velocityLossPct).toBeNull();
  });

  it('левая strategy и sway ≤0 отбрасываются', () => {
    const p = parseSmBridgePayload({ strategy: 'turbo', swayCm: -1 });
    expect(p.strategy).toBeNull();
    expect(p.swayCm).toBeNull();
  });

  it('diagnosticLevel — фолбэк, пустой вход — пустой патч', () => {
    expect(parseSmBridgePayload({ diagnosticLevel: 'critical' }).diagnosticLevel).toBe('critical');
    expect(parseSmBridgePayload({ level: 'warn', diagnosticLevel: 'critical' }).diagnosticLevel).toBe('warn');
    const p = parseSmBridgePayload(undefined);
    expect(p).toEqual({
      weakPoints: [],
      diagnosticLevel: null,
      mode: null,
      contest: null,
      velocityLossPct: null,
      hubVelocity: {},
      swayCm: null,
      strategy: null,
      taAttempts: null,
      taSinclair: null,
      taSpecWeeks: null,
      taPreferredCorr: null,
      taWeakCauses: null,
      taFvr: null,
      taAsymPct: null,
      taOhsFailed: null,
      taSpecTargets: null,
      orthoBlocked: [],
      orthoMobility: [],
      orthoYokeGate: false,
      orthoClosedChain: false,
      orthoTeen: false,
      orthoSummary: null,
    });
  });
});

describe('мост хаб→план: VBT хаба реально работает в билде', () => {
  // План ротирует carries (йока может не быть — берём фермера, он в плане всегда):
  // history-loss 20% (> порога carry 15%) даёт RIR+1 поверх скаляра.
  const base: any = {
    mode: 'strongman',
    goal: 'strength',
    level: 'intermediate',
    weeks: 2,
    daysPerWeek: 3,
    workMax: { yokeWalk: 300 },
    equipment: ['barbell', 'other'],
  };
  const farmRir = (plan: any) =>
    Math.max(
      0,
      ...plan.weeksData[0].sessions
        .flatMap((s: any) => s.exercises.filter((e: any) => e.id === 'farmers_walk_heavy'))
        .flatMap((e: any) => (e.workSets || []).map((w: any) => w.rir ?? 0)),
    );
  it('hubVelocity из парсера в velocityHistory билда поднимает RIR фермера', () => {
    const lossOnly = buildStrengthSportPlan({ ...base, velocityLossPct: 18 });
    const p = parseSmBridgePayload({
      smWeakPoints: ['farmers_grip'],
      velocityLossPct: 18,
      velocityHistory: { farmers_walk_heavy: [1.5, 1.2] },
    });
    const wired = buildStrengthSportPlan({
      ...base,
      velocityLossPct: p.velocityLossPct ?? undefined,
      velocityHistory: p.hubVelocity,
    });
    // Прямое доказательство провода: данные хаба лежат в inputSnapshot плана.
    expect((wired as any).inputSnapshot.velocityHistory).toEqual({ farmers_walk_heavy: [1.5, 1.2] });
    // Эффект: скаляр дал RIR+1, history сверху ещё +1 (база 2 → 3 → 4).
    expect(farmRir(wired)).toBeGreaterThan(farmRir(lossOnly));
  });
});

describe('мост хаб→конструктор: приём через localStorage', () => {
  it('VBT хаба виден в конструкторе строкой «Из хаба»', () => {
    localStorage.setItem(
      'he_planner_apply',
      JSON.stringify({
        kind: 'weakpoints',
        label: 'Стронг диагностика: farmers_grip',
        data: {
          smWeakPoints: ['farmers_grip'],
          velocityHistory: { yoke_walk: [1.5, 1.2] },
          velocityLossPct: 18,
          strategy: 'aggressive',
          swayCm: 4.2,
        },
      }),
    );
    const { container } = render(<StrengthSportConstructor />);
    expect(container.textContent).toContain('Из хаба: yoke_walk 2т');
  });
});

describe('collectSsVelocityHistory', () => {
  const emptyLift = { snatch: { best: 0, last: 0 }, clean: { best: 0, last: 0 }, squat: { best: 0, last: 0 } };
  it('группирует посетовые ключи week-day-ex-set по упражнению', () => {
    expect(
      collectSsVelocityHistory(
        { '1-5-yoke_walk-0': 1.5, '1-5-yoke_walk-1': 1.2, '2-3-farmers_walk_heavy-0': 1.1 },
        emptyLift,
        {},
      ),
    ).toEqual({ yoke_walk: [1.5, 1.2], farmers_walk_heavy: [1.1] });
  });
  it('нули/мусор/ключи без exId отбрасываются; пусто → undefined', () => {
    expect(collectSsVelocityHistory({ '1-5-yoke_walk-0': 0, badkey: 1.5, 'x': -1 } as any, emptyLift, {})).toBeUndefined();
    expect(collectSsVelocityHistory({}, emptyLift, {})).toBeUndefined();
  });
  it('per-lift и хаб мержатся поверх (кап 3 точки)', () => {
    expect(
      collectSsVelocityHistory(
        { '1-5-snatch-0': 1.5 },
        { ...emptyLift, snatch: { best: 1.6, last: 1.3 } },
        { yoke_walk: [1.5, 1.2] },
      ),
    ).toEqual({ snatch: [1.5, 1.6, 1.3], yoke_walk: [1.5, 1.2] });
  });
});

describe('D9 ТА-мост: заявки/Sinclair/FvR не теряются', () => {
  it('taAttempts + taSinclair + taFvr + asym/ohs парсятся позитивно', () => {
    const p = parseSmBridgePayload({
      taAttempts: { snatch: [90, 96, 102], cj: [110, 116, 122] },
      taSinclair: { total: 212, value: 301.5, cycle: '12w', q: 2 },
      fvr: { snatchTh: 105, pmax: 2400 },
      asymmetryPct: 9,
      ohs: { failed: 2 },
    });
    expect(p.taAttempts).toEqual({ snatch: [90, 96, 102], cj: [110, 116, 122] });
    expect(p.taSinclair?.value).toBe(301.5);
    expect(p.taFvr?.snatchTh).toBe(105);
    expect(p.taAsymPct).toBe(9);
    expect(p.taOhsFailed).toBe(2);
  });
  it('битые заявки/Sinclair → null, а не мусор', () => {
    const p = parseSmBridgePayload({ taAttempts: { snatch: 'x' }, taSinclair: { total: 0, value: -5 } });
    expect(p.taAttempts == null || (p.taAttempts.snatch.length === 0 && p.taAttempts.cj.length === 0)).toBe(true);
    expect(p.taSinclair).toBeNull();
  });
});
