/**
 * Wave-0 Э0.5 — замок на честность RFD-метрик армрестлинга.
 *
 * Контекст дефекта: `F100`/`F500`/`t0.5F` у атлета почти всегда НЕ измерены напрямую
 * (прибор снимает «макс силы + время»). Движок реконструирует их формулой
 * (`arm-dynamic-force.engine.ts:60-68`), а `explosivePct` по этим данным выбирает тип
 * RFD-сессии и ДОЗУ в билдере (`ArmAutoConstructor.tsx` → `arm-rfd.engine`).
 *
 * Математика здесь не меняется (правило проекта: числа плана не трогаем без согласия) —
 * меняется МАРКИРОВКА: значение обязано объявлять себя оценкой, если отсечки не было.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// __tests__ → TrainingScreen_parts → screens → ui → src → engines/arm
import { calcDynamicMetrics, buildDynamicReport } from '../../../../engines/arm/arm-dynamic-force.engine';

const ENGINE = readFileSync(
  resolve(__dirname, '..', '..', '..', '..', 'engines', 'arm', 'arm-dynamic-force.engine.ts'),
  'utf8',
);
const HUB = readFileSync(resolve(__dirname, '..', 'ArmDiagnosticsHub.tsx'), 'utf8');
const CTOR = readFileSync(resolve(__dirname, '..', 'ArmAutoConstructor.tsx'), 'utf8');

const TRIAL_ONLY = { exercise: 'finger_flex' as const, forceKg: 60, timeMs: 1200, bwKg: 80, hand: 'left' as const };
const TRIAL_CUT = { exercise: 'finger_flex' as const, forceKg: 60, timeMs: 1200, bwKg: 80, hand: 'left' as const, f100Kg: 33, f500Kg: 47 };

describe('Э0.5: F100 реконструирован — помечаем оценкой', () => {
  it('без отсечки прибора f100Estimated=true, derivedFromSingleTrial=true', () => {
    const m = calcDynamicMetrics(TRIAL_ONLY);
    expect(m.f100Estimated).toBe(true);
    expect(m.f500Estimated).toBe(true);
    expect(m.derivedFromSingleTrial).toBe(true);
  });

  it('с измеренными отсечками оба флага false (значение доверяем)', () => {
    const m = calcDynamicMetrics(TRIAL_CUT);
    expect(m.f100Estimated).toBe(false);
    expect(m.f500Estimated).toBe(false);
    expect(m.derivedFromSingleTrial).toBe(false);
  });

  it('частичные данные: измерен только F100 → f500 остаётся оценкой', () => {
    const m = calcDynamicMetrics({ ...TRIAL_CUT, f500Kg: undefined });
    expect(m.f100Estimated).toBe(false);
    expect(m.f500Estimated).toBe(true);
    expect(m.derivedFromSingleTrial).toBe(true);
  });

  it('числа НЕ изменились (фикс — маркировка, не математика)', () => {
    // контрольные значения реконструкции: f=60, t=1200мс
    const m = calcDynamicMetrics(TRIAL_ONLY);
    expect(m.fMax).toBe(60);
    expect(m.f100).toBeGreaterThan(0);
    expect(m.explosivePct).toBe(Math.round((m.f100 / 60) * 100));
  });

  it('тактика прямо предупреждает, что F100 — оценка', () => {
    const rep = buildDynamicReport([TRIAL_ONLY]);
    expect(rep.tactic).toMatch(/оценка/i);
    // при измеренной отсечке предупреждения нет
    const repCut = buildDynamicReport([TRIAL_CUT]);
    expect(repCut.tactic).not.toMatch(/оценка/i);
  });
});

describe('Э0.5: флаг доезжает до конструктора (иначе разры�� цепи)', () => {
  it('хаб кладёт f100Estimated в payload рядом с числом', () => {
    expect(HUB).toContain('f100Estimated: estimated');
  });

  it('конструктор читает флаг и показывает честную плашку', () => {
    expect(CTOR).toContain('setRfdEstimated(ar.f100Estimated === true)');
    expect(CTOR).toContain('rfdEstimated && (');
    expect(CTOR).toMatch(/F100 здесь — <b>оценка<\/b>/);
  });
});

describe('Э0.5: контракт движка задокументирован', () => {
  it('поля флагов объявлены в интерфейсе', () => {
    expect(ENGINE).toContain('f100Estimated: boolean;');
    expect(ENGINE).toContain('f500Estimated: boolean;');
    expect(ENGINE).toContain('derivedFromSingleTrial: boolean;');
  });

  it('в коде нет «мёртвого» присваивания — флаг выводится из наличия отсечки', () => {
    expect(ENGINE).toContain('f100Estimated: !f100Measured');
    expect(ENGINE).toContain('f500Estimated: !f500Measured');
  });
});
