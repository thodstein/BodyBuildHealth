/**
 * tz-monitor-sex-targets.test.ts — проход 59: `monitoringSchedule` в
 * `tz-mapper-engine` — структурная копия карточек K0–K10 (в UI и в печати не
 * выводится, из неё берётся только секция `daily`). В целях там стояли мужские
 * литералы как общие: `АЛТ<40`, `HCT<50%`, `HGB<170`, `PRL<25`,
 * `E2 20-40 пг/мл` — женщина читала чужие пороги, а ступени печени были 2×ВГН.
 *
 * Контракт: цели берутся из резолвера норм (`HCT_THRESHOLDS`, `HGB_THRESHOLDS`,
 * `lftUlnText`, `FEMALE_HORMONE_BANDS`), оба пола одной строкой; ступень
 * «отмена оралов» — 3×ВГН (`LFT_STAGE_ULN`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_STATE } from '../Calc.types';
import { buildMapperCtx } from '../../../../engines/support-plan/mapper-ctx';
import { resolvePlan } from '../../../../engines/tz-mapper-engine';
import { HCT_THRESHOLDS, HGB_THRESHOLDS, LFT_STAGE_ULN } from '../../../../engines/lab-norms.engine';

const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

function scheduleText() {
  const state: any = {
    ...DEFAULT_STATE,
    pharma: {
      ...DEFAULT_STATE.pharma,
      phase: 'course',
      aas: [
        { id: 'test_enan', doseMgWeek: 500, weeks: 12 },
        { id: 'oxandrolone', doseMgWeek: 350, weeks: 6 },
      ],
    },
  };
  const rec = resolvePlan(buildMapperCtx(state, 'medium'));
  const sched = rec.monitoringSchedule || [];
  return {
    sched,
    text: sched.map(s => s.items.map(i => `${i.marker} | ${i.target || ''} | ${i.escalation || ''}`).join('\n')).join('\n'),
  };
}

describe('monitoringSchedule: цели называют оба пола', () => {
  const { sched, text } = scheduleText();

  it('гематокрит и гемоглобин — из HCT/HGB_THRESHOLDS', () => {
    expect(text).toContain(`♂ <${HCT_THRESHOLDS.male.erythrocytosis}% / ♀ <${HCT_THRESHOLDS.female.erythrocytosis}%`);
    expect(text).toContain(`♂ <${HGB_THRESHOLDS.male.upper} / ♀ <${HGB_THRESHOLDS.female.upper} г/л`);
  });

  it('АЛТ/АСТ — «♂ <40 / ♀ <31», а не общий «АЛТ<40»', () => {
    expect(text).toContain('♂ <40 / ♀ <31');
    expect(text).not.toContain('АЛТ<40');
    expect(text).not.toContain('ALT<40');
  });

  it('E2/PRL — мужское окно рядом с женским', () => {
    expect(text).toContain('♀ по фазе');
    expect(text).toContain('♀ <800 мМЕ/л');
    expect(text).not.toContain('PRL<25');
  });

  it('ступень печени — 2×ВГН (снизить) с обоими полами, литералов «2×ULN» нет', () => {
    expect(text).toContain(`♂ >${LFT_STAGE_ULN.reduce.male} / ♀ >${LFT_STAGE_ULN.reduce.female}`);
    expect(text).not.toContain('ALT>2×ULN');
    expect(text).not.toContain('АЛТ>2×ULN');
  });

  it('секция `daily` на месте (её читает Calc.mapper)', () => {
    const daily = sched.find(s => s.id === 'daily');
    expect(daily).toBeTruthy();
    expect(daily!.items.length).toBeGreaterThan(0);
  });
});

describe('исходник: мужских литералов в целях расписания нет', () => {
  const tz = src('src/engines/tz-mapper-engine.ts');

  it('`target:` строки не содержат HCT<50% / HGB<170 / АЛТ<40 / PRL<25', () => {
    expect(tz).not.toMatch(/target:\s*'[^']*АЛТ<40/);
    expect(tz).not.toMatch(/target:\s*'[^']*HCT<50%/);
    expect(tz).not.toMatch(/target:\s*'[^']*HGB<170/);
    expect(tz).not.toMatch(/target:\s*'[^']*PRL<25/);
  });

  it('пороги расписания собраны из констант резолвера', () => {
    expect(tz).toContain('MON_HCT');
    expect(tz).toContain('MON_HGB');
    expect(tz).toContain('MON_LFT');
    expect(tz).toContain('MON_E2');
    expect(tz).toContain('MON_PRL');
    expect(tz).toContain('LFT_STAGE_ULN');
  });
});
