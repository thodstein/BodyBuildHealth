/**
 * support-dose-evidence.test.ts — этап E5: план отвечает «почему эта доза» и
 * «это назначение или расчёт».
 *
 * До прохода 211 `EVIDENCE_DOSAGES` (37 записей с `references`) читал только
 * UI-калькулятор дозировок, а `support-dosing` (90 записей с уровнями A/B/C) —
 * только «Унифицированный калькулятор». План показывал дозу без источника.
 *
 * Важно: уровень относится к дозировке в реестре, а не к показанию плана —
 * поэтому в подписи это сказано, а не выдаётся за «доказано для этого случая».
 */
import { describe, expect, it } from 'vitest';
import { buildSubstances } from '../support-plan/substances';
import type { CalculatorResult } from '../support-plan/types';

const fake = {} as CalculatorResult;
const byId = (id: string) => buildSubstances([id], fake)[0];

describe('доказательность дозы в карточке плана', () => {
  it('вещество с записью в реестре: уровень и ссылки есть', () => {
    const nac = byId('nac');
    expect(nac.evidence?.level).toBe('A');
    expect((nac.evidence?.refs || []).length).toBeGreaterThan(0);
    expect(nac.evidence!.refs!.join(' ')).toMatch(/FDA|NIH/);
  });

  it('нет записи — нет уровня и ссылок (не «A» по умолчанию)', () => {
    const unknown = byId('nonexistent_substance_xyz');
    expect(unknown.evidence).toBeUndefined();
  });

  it('ссылка, приложенная к дозе (DailyMed), показывается в карточке', () => {
    const tadalafil = byId('tadalafil');
    expect((tadalafil.evidence?.refs || []).join(' ')).toContain('DailyMed');
  });
});

describe('«расчёт, не назначение» у формульных доз', () => {
  it('телмисартан/небиволол/анастрозол/каберголин помечены', () => {
    for (const id of ['telmisartan', 'nebivolol', 'anastrozole', 'cabergoline']) {
      expect(byId(id).doseDisclaimer, id).toMatch(/не назначение/i);
    }
  });

  it('обычный нутриент без пометки', () => {
    expect(byId('magnesium').doseDisclaimer).toBeUndefined();
  });
});
