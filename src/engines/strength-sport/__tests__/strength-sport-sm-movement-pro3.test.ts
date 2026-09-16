import { describe, it, expect } from 'vitest';
import { diagnoseStoneLap, diagnoseStoneRepFatigue } from '../strength-sport-sm-stone-fatigue.engine';
import { diagnoseCarryLocomotion, diagnoseCarryTurn, carrySpeedModel } from '../strength-sport-sm-carry-locomotion.engine';
import { diagnoseGripCarry } from '../strength-sport-sm-grip-carry.engine';
import { diagnoseLogWindow, logDipWindowFor, logLoadCorrectionPct } from '../strength-sport-sm-log-window.engine';
import { diagnoseTyreSecondPull, SM_TYRE_CORRECTIVES } from '../strength-sport-sm-tyre.engine';
import { diagnoseSuitcase } from '../strength-sport-sm-suitcase.engine';
import { diagnoseYBT, diagnoseSideHop, SM_SCREENING_DISCLAIMER } from '../strength-sport-sm-ybt.engine';

describe('SM movement P1: stone lap + fatigue', () => {
  it('zero-lap без lap — ok', () => {
    expect(diagnoseStoneLap({ zeroLap: true })?.verdict).toBe('ok');
  });
  it('lap 1.0 — ok, 2.5 — warn, 3.5 — critical', () => {
    expect(diagnoseStoneLap({ lapS: 1.0 })?.verdict).toBe('ok');
    expect(diagnoseStoneLap({ lapS: 2.5 })?.verdict).toBe('warn');
    expect(diagnoseStoneLap({ lapS: 3.5 })?.verdict).toBe('critical');
  });
  it('пусто — null', () => {
    expect(diagnoseStoneLap({})).toBeNull();
  });
  it('дрейф серии: +0.5 ok, +1.2 warn, +2.5 critical', () => {
    const r1 = { pull1S: 2, lapS: 1.2, pull2S: 2 };
    expect(diagnoseStoneRepFatigue(r1, { pull1S: 2.1, lapS: 1.3, pull2S: 2.3 })?.verdict).toBe('ok');
    expect(diagnoseStoneRepFatigue(r1, { pull1S: 2.4, lapS: 1.7, pull2S: 2.3 })?.verdict).toBe('warn');
    expect(diagnoseStoneRepFatigue(r1, { pull1S: 3, lapS: 2.2, pull2S: 2.5 })?.verdict).toBe('critical');
  });
  it('неполные повторы — null', () => {
    expect(diagnoseStoneRepFatigue({ pull1S: 2 }, { pull1S: 2, lapS: 1, pull2S: 2 })).toBeNull();
  });
});

describe('SM movement P2: carry locomotion + turn', () => {
  it('пусто — null', () => {
    expect(diagnoseCarryLocomotion({ kind: 'yoke' })).toBeNull();
  });
  it('топ-шаг йока — ok', () => {
    const r = diagnoseCarryLocomotion({ kind: 'yoke', strideLengthM: 1.2, strideRateHz: 1.7, stanceS: 0.4 });
    expect(r?.verdict).toBe('ok');
    expect(r?.speedModelMS).toBeGreaterThan(1);
  });
  it('короткий шаг + низкий темп — critical', () => {
    const r = diagnoseCarryLocomotion({ kind: 'farmers', strideLengthM: 1.0, strideRateHz: 1.4, stanceS: 0.5 });
    expect(r?.verdict).toBe('critical');
  });
  it('модель: нагрузка режет скорость', () => {
    const light = carrySpeedModel('yoke', 1.14, 1.62, 100, 100);
    const heavy = carrySpeedModel('yoke', 1.14, 1.62, 300, 100);
    expect(heavy).toBeLessThan(light);
  });
  it('факт ниже модели — хинт про развороты', () => {
    const r = diagnoseCarryLocomotion({ kind: 'yoke', strideLengthM: 1.14, strideRateHz: 1.62, split20mS: 20 });
    expect(r?.lines.some((l) => l.includes('разворот'))).toBe(true);
  });
  it('разворот: 1.5 ok, 5 warn, дроп critical', () => {
    expect(diagnoseCarryTurn(1.5)?.verdict).toBe('ok');
    expect(diagnoseCarryTurn(5)?.verdict).toBe('warn');
    expect(diagnoseCarryTurn(2, true)?.verdict).toBe('critical');
    expect(diagnoseCarryTurn()).toBeNull();
  });
});

describe('SM movement P3: grip→carry', () => {
  it('пусто — null', () => {
    expect(diagnoseGripCarry({})).toBeNull();
  });
  it('холд с запасом — ok без лимита', () => {
    const r = diagnoseGripCarry({ farmersHoldSec: 60, runTimeSec: 40, dropsPerRun: 0, pickupMs: 800 });
    expect(r?.verdict).toBe('ok');
    expect(r?.gripLimitsCarry).toBe(false);
  });
  it('холд короче заступа — warn + лимит', () => {
    const r = diagnoseGripCarry({ farmersHoldSec: 25, runTimeSec: 45 });
    expect(r?.gripLimitsCarry).toBe(true);
    expect(r?.verdict).not.toBe('ok');
  });
  it('дропы + медленный съём — critical', () => {
    const r = diagnoseGripCarry({ dropsPerRun: 2, pickupMs: 2500 });
    expect(r?.verdict).toBe('critical');
  });
});

describe('SM movement P4: log window', () => {
  it('окна по диаметру', () => {
    expect(logDipWindowFor(24)).toEqual([9, 13]);
    expect(logDipWindowFor(28)).toEqual([8, 12]);
    expect(logDipWindowFor(33)).toEqual([7, 10]);
    expect(logDipWindowFor(null)).toBeNull();
  });
  it('поправка: большой −3, малый +2', () => {
    expect(logLoadCorrectionPct(33)).toBe(-3);
    expect(logLoadCorrectionPct(24)).toBe(2);
    expect(logLoadCorrectionPct(28)).toBe(0);
  });
  it('дип в окне — ok, вне — warn', () => {
    expect(diagnoseLogWindow(33, 8)?.verdict).toBe('ok');
    expect(diagnoseLogWindow(33, 12)?.verdict).toBe('warn');
    expect(diagnoseLogWindow(null)?.__proto__).toBe(undefined);
  });
});

describe('SM movement P5: tyre', () => {
  it('0.4 ok, 1.2 warn, 2.0 critical, пусто null', () => {
    expect(diagnoseTyreSecondPull({ secondPullS: 0.4 })?.verdict).toBe('ok');
    expect(diagnoseTyreSecondPull({ secondPullS: 1.2 })?.verdict).toBe('warn');
    expect(diagnoseTyreSecondPull({ secondPullS: 2.0 })?.verdict).toBe('critical');
    expect(diagnoseTyreSecondPull({})).toBeNull();
  });
  it('3 коррекции technique/strength/stability', () => {
    expect(SM_TYRE_CORRECTIVES.length).toBe(3);
    expect(SM_TYRE_CORRECTIVES.map((c) => c.kind).sort()).toEqual(['stability', 'strength', 'technique']);
  });
});

describe('SM movement P6: suitcase', () => {
  it('пусто — null, симметрия — ok', () => {
    expect(diagnoseSuitcase({})).toBeNull();
    expect(diagnoseSuitcase({ leftS: 30, rightS: 30 })?.verdict).toBe('ok');
  });
  it('пороги 7/12', () => {
    expect(diagnoseSuitcase({ leftS: 27, rightS: 30 })?.verdict).toBe('warn');
    expect(diagnoseSuitcase({ leftS: 25, rightS: 30 })?.verdict).toBe('critical');
    expect(diagnoseSuitcase({ leftS: 25, rightS: 30 })?.weakSide).toBe('left');
  });
});

describe('SM movement P7/P8: ybt + side-hop + честность', () => {
  it('пусто — null', () => {
    expect(diagnoseYBT({})).toBeNull();
  });
  it('anterior 2см ok, 5см warn, 7см critical', () => {
    expect(diagnoseYBT({ antLeftCm: 60, antRightCm: 62 })?.verdict).toBe('ok');
    expect(diagnoseYBT({ antLeftCm: 60, antRightCm: 65 })?.verdict).toBe('warn');
    expect(diagnoseYBT({ antLeftCm: 60, antRightCm: 67 })?.verdict).toBe('critical');
  });
  it('композит считается при всех направлениях + нога', () => {
    const r = diagnoseYBT({ antLeftCm: 60, antRightCm: 61, pmLeftCm: 95, pmRightCm: 96, plLeftCm: 90, plRightCm: 91, legLengthCm: 90 });
    expect(r?.compositePct).toBeGreaterThan(50);
  });
  it('side-hop: предиктор при ΔY≥4', () => {
    expect(diagnoseSideHop(20, 5)?.verdict).toBe('warn');
    expect(diagnoseSideHop(35, 5)?.verdict).toBe('ok');
    expect(diagnoseSideHop(null)).toBeNull();
  });
  it('дисклеймер честный', () => {
    expect(SM_SCREENING_DISCLAIMER).toContain('не диагноз');
  });
});
