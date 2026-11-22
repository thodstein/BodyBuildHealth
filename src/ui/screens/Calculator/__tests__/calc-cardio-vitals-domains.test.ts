/**
 * calc-cardio-vitals-domains.test.ts — проход 204: АД и ЧСС идут из карточки.
 *
 * Класс дефекта: домены «АД/объём» и «Ритм/ЧСС» решали по лабораторным ключам
 * `labs.BP_SYSTOLIC`, `labs.BP_DIASTOLIC` и `labs.HR`, которых бланк не
 * производит — давление и пульс живут в карточке `state.cardio`. Домены не
 * включались ни при каком вводе, а «контрольные маркеры» в попапе всегда
 * показывали «нет». Там же нашлась вторая половина: `buildMapperCtx.bpSystolic`
 * ждал стадию `'elevated'`, которой интерфейс не пишет (он пишет
 * `'prehypertension'`), поэтому прегипертония уезжала в 120 — норму.
 *
 * Проверяется:
 *  - одно правило «стадия → систола» (`bpSystolicOfStage`) и старые написания;
 *  - `buildMapperCtx` отдаёт в мост механизмов 130 для прегипертонии (было 120);
 *  - домен «АД/объём» включается по стадии, а не по лабораторному ключу;
 *  - домен «Ритм/ЧСС» читает пульс карточки и калий бланка;
 *  - пороги доменов читаются из лестницы ступеней (`LAB_TIERS`), а «Контрольные
 *    маркеры»/«Механизмы» попапа собираются из доменов, а не из рукописных списков;
 *  - низкий ЛПВП считается по полу (`HDL_LOW`), а не мужским литералом.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_STATE } from '../Calc.types';
import { SPECIALIZED_DOMAINS } from '../Calc.mapper';
import type { CalculatorState } from '../../../../engines/support-plan/types';
import { buildMapperCtx } from '../../../../engines/support-plan/mapper-ctx';
import {
  bpStageCanon, bpStageIsHigh, bpSystolicOfStage, heartRateOf, BP_STAGE_LABEL,
} from '../../../../engines/support-plan/cardio-vitals';

const trigger = (
  system: string,
  id: string,
  labs: Record<string, number>,
  cardio: { bpStage?: string; heartRate?: number } = {},
  sex: 'male' | 'female' = 'male',
) => {
  const d = (SPECIALIZED_DOMAINS as any)[system].find((x: any) => x.id === id);
  expect(d, `${system}/${id}`).toBeTruthy();
  return d.trigger({ ...labs }, { profile: { sex }, cardio } as never);
};

const mapperState = (cardio: Record<string, unknown>) => ({
  ...DEFAULT_STATE,
  cardio: { ...DEFAULT_STATE.cardio, ...cardio },
}) as CalculatorState;

describe('проход 204: стадия АД → систола — одно правило', () => {
  it('канон стадии: старое `elevated` — это прегипертония, незнакомое — норма', () => {
    expect(bpStageCanon('prehypertension')).toBe('prehypertension');
    expect(bpStageCanon('elevated')).toBe('prehypertension');
    expect(bpStageCanon(' hypertension2 ')).toBe('hypertension2');
    expect(bpStageCanon(undefined)).toBe('normal');
    expect(bpStageCanon('что-то')).toBe('normal');
    expect(BP_STAGE_LABEL[bpStageCanon('elevated')]).toBe('прегипертония');
  });

  it('систола полосы — из границ `LAB_TIERS.BP_SYSTOLIC`, не из литералов', () => {
    expect(bpSystolicOfStage('normal')).toBe(120);
    // 130 — верх нормы: прежний `mapper-ctx` отдавал сюда 120.
    expect(bpSystolicOfStage('prehypertension')).toBe(130);
    expect(bpSystolicOfStage('elevated')).toBe(130);
    expect(bpSystolicOfStage('hypertension1')).toBe(140);
    expect(bpSystolicOfStage('hypertension2')).toBe(160);
  });

  it('домен «АД/объём» включается по стадии выше нормы', () => {
    expect(bpStageIsHigh('prehypertension')).toBe(true);
    expect(bpStageIsHigh('hypertension1')).toBe(true);
    expect(bpStageIsHigh('normal')).toBe(false);
    expect(bpStageIsHigh(undefined)).toBe(false);
  });

  it('пульс карточки: нет числа — нет находки (а не ноль ударов)', () => {
    expect(heartRateOf({ heartRate: 72 })).toBe(72);
    expect(heartRateOf({ heartRate: 0 })).toBeUndefined();
    expect(heartRateOf({ heartRate: Number.NaN })).toBeUndefined();
    expect(heartRateOf(undefined)).toBeUndefined();
  });
});

describe('проход 204: прегипертония доходит до моста механизмов', () => {
  it('buildMapperCtx: прегипертония — 130, а не 120 (норма)', () => {
    expect(buildMapperCtx(mapperState({ bpStage: 'prehypertension' }), 'base').bpSystolic).toBe(130);
  });

  it('остальные стадии и старое написание читаются той же лестницей', () => {
    expect(buildMapperCtx(mapperState({ bpStage: 'normal' }), 'base').bpSystolic).toBe(120);
    expect(buildMapperCtx(mapperState({ bpStage: 'hypertension1' }), 'base').bpSystolic).toBe(140);
    expect(buildMapperCtx(mapperState({ bpStage: 'hypertension2' }), 'base').bpSystolic).toBe(160);
    expect(buildMapperCtx(mapperState({ bpStage: 'elevated' }), 'base').bpSystolic).toBe(130);
  });
});

describe('проход 204: кардио-домены решают по карточке', () => {
  it('АД: включается стадией карточки, лабораторный ключ не решает', () => {
    expect(trigger('cardio', 'bp', {}, { bpStage: 'prehypertension' })).toBe(true);
    expect(trigger('cardio', 'bp', {}, { bpStage: 'hypertension2' })).toBe(true);
    expect(trigger('cardio', 'bp', {}, { bpStage: 'normal' })).toBe(false);
    expect(trigger('cardio', 'bp', {}, {})).toBe(false);
    // Ключа `BP_SYSTOLIC` в бланке не бывает: даже подставленное число домен не включает.
    expect(trigger('cardio', 'bp', { BP_SYSTOLIC: 180, BP_DIASTOLIC: 110 }, { bpStage: 'normal' })).toBe(false);
  });

  it('ЧСС: пульс карточки 85 включает домен, 72 — нет', () => {
    expect(trigger('cardio', 'rhythm', {}, { heartRate: 85 })).toBe(true);
    expect(trigger('cardio', 'rhythm', {}, { heartRate: 72 })).toBe(false);
    // Лабораторный ключ `HR` бланк не производит — сам по себе он ничего не решает.
    expect(trigger('cardio', 'rhythm', { HR: 120 }, { heartRate: 72 })).toBe(false);
  });

  it('ЧСС: гипокалиемия бланка включает тот же домен', () => {
    expect(trigger('cardio', 'rhythm', { K: 3.2 }, { heartRate: 72 })).toBe(true);
    expect(trigger('cardio', 'rhythm', { K: 4.2 }, { heartRate: 72 })).toBe(false);
  });

  it('карточка без пульса — домен не включается и не «норма»', () => {
    expect(trigger('cardio', 'rhythm', {}, {})).toBe(false);
  });
});

describe('проход 204: пороги доменов — из лестницы ступеней', () => {
  it('липиды: 3.0 ммоль/л — ещё норма, 3.1 — домен', () => {
    expect(trigger('cardio', 'lipids', { LDL: 3.0 })).toBe(false);
    expect(trigger('cardio', 'lipids', { LDL: 3.1 })).toBe(true);
    expect(trigger('cardio', 'lipids', { TRIGLYCERIDES: 1.7 })).toBe(false);
    expect(trigger('cardio', 'lipids', { HDL: 1.0 })).toBe(false);
    expect(trigger('cardio', 'lipids', { HDL: 0.9 })).toBe(true);
  });

  it('низкий ЛПВП — по полу: ♀ 1.1 уже низко, ♂ 1.1 — норма', () => {
    expect(trigger('cardio', 'lipids', { HDL: 1.1 }, {}, 'female')).toBe(true);
    expect(trigger('cardio', 'lipids', { HDL: 1.1 }, {}, 'male')).toBe(false);
    expect(trigger('cardio', 'lipids', { HDL: 1.2 }, {}, 'female')).toBe(false);
    expect(trigger('metabolic', 'lipidmet', { HDL: 1.1 }, {}, 'female')).toBe(true);
    expect(trigger('metabolic', 'lipidmet', { HDL: 1.1 }, {}, 'male')).toBe(false);
  });

  it('электролиты: калий 5.0 — верх нормы, 5.1 — домен', () => {
    expect(trigger('renal', 'electrolytes', { K: 5.0 })).toBe(false);
    expect(trigger('renal', 'electrolytes', { K: 5.1 })).toBe(true);
    expect(trigger('renal', 'electrolytes', { K: 3.5 })).toBe(false);
    expect(trigger('renal', 'electrolytes', { K: 3.4 })).toBe(true);
  });

  it('пролактин: совет включается на верхней границе «грани» (25)', () => {
    expect(trigger('endocrine', 'prl', { PRL: 25 })).toBe(false);
    expect(trigger('endocrine', 'prl', { PRL: 25.1 })).toBe(true);
  });

  it('воспаление: СРБ 3 — норма, 3.1 — домен', () => {
    expect(trigger('musculoskeletal', 'inflammation', { CRP: 3 })).toBe(false);
    expect(trigger('musculoskeletal', 'inflammation', { CRP: 3.1 })).toBe(true);
  });
});

describe('проход 204: попап говорит о том, что решает', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/Calculator/Calc.mapper.tsx'), 'utf8');

  it('«Механизмы» — подписи доменов, а не рукописный список', () => {
    expect(src).not.toContain('cfg.domains');
    expect(src).toContain('domains.map(d => d.label)');
    // Обещанных механизмов без домена больше нет: поле `domains` ушло из конфигов.
    expect(src).not.toMatch(/domains:\s*\[/);
  });

  it('«Контрольные маркеры» — домены плюс добавка системы', () => {
    expect(src).toContain('domains.flatMap(d => d.markers)');
    expect(src).toContain('monitorMarkers.map');
    // АД и ЧСС больше не выдаются за анализы.
    expect(src).not.toContain(`markers:['BP_SYSTOLIC'`);
    expect(src).not.toContain(`'BP_SYSTOLIC','BP_DIASTOLIC','HR'`);
  });

  it('число в попапе печатается с единицей, как в чипах анализов', () => {
    expect(src).toContain('flatLabUnit');
    expect(src).toContain('labText(m)');
    expect(src).not.toContain('${m} ${labs[m]}');
  });
});
