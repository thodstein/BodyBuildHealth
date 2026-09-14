/**
 * female-phase-lab-notes.test.tsx — §6.2/§6.4.5 аудита:
 *  - женские пометки K-карточек (support-phase-labs femaleNote) рендерятся только при sex=female;
 *  - vitex/inositol подхватываются паспортом вещества и расчётом доз (THERAPEUTIC_WINDOWS/DEFAULT_DOSAGES),
 *    без «по инструкции» (hasData=true).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { phaseCardsFor, PHASE_LAB_CARDS } from '../../../../engines/support-phase-labs.engine';
import { doseWindowFor } from '../../../../engines/support-hub-evidence.engine';
import { buildSubstancePassport } from '../../../../engines/support-hub-passport.engine';
import { THERAPEUTIC_WINDOWS } from '../../../screens/SupportScreen_parts/SupportBioavailabilityData';
import { DEFAULT_DOSAGES } from '../../../../data/support-meta';
import { CalcPhaseLabCards } from '../CalcPhaseLabCards';

describe('§6.2: женские пометки K-карточек', () => {
  it('K0/K2/K5/K7 несут femaleNote, K1 — нет (без выдумок)', () => {
    const byId = new Map(PHASE_LAB_CARDS.map(c => [c.id, c]));
    expect(byId.get('K0')!.femaleNote).toContain('♀');
    expect(byId.get('K2')!.femaleNote).toContain('♀');
    expect(byId.get('K5')!.femaleNote).toContain('♀');
    expect(byId.get('K7')!.femaleNote).toContain('♀');
    expect(byId.get('K1')!.femaleNote).toBeUndefined();
    // карточки для курса включают K0 с пометкой
    const cards = phaseCardsFor(null, 'course');
    expect(cards.find(c => c.id === 'K0')!.femaleNote).toBeTruthy();
  });

  it('CalcPhaseLabCards рендерит femaleNote только при sex=female', () => {
    const fem = renderToStaticMarkup(React.createElement(CalcPhaseLabCards, { phase: 'course' as never, sex: 'female' }));
    const male = renderToStaticMarkup(React.createElement(CalcPhaseLabCards, { phase: 'course' as never, sex: 'male' }));
    expect(fem).toContain('data-female-note="K0"');
    expect(fem).toContain('♀ Женщины');
    expect(male).not.toContain('data-female-note');
    expect(male).not.toContain('♀ Женщины');
  });
});

describe('§6.4.5: vitex/inositol — паспорт и расчёт доз', () => {
  it('doseWindowFor: окно из THERAPEUTIC_WINDOWS (не «по инструкции»)', () => {
    const v = doseWindowFor('vitex', THERAPEUTIC_WINDOWS as never, {});
    expect(v.hasData).toBe(true);
    expect(v.min).toBe(20);
    expect(v.max).toBe(40);
    const i = doseWindowFor('inositol', THERAPEUTIC_WINDOWS as never, {});
    expect(i.hasData).toBe(true);
    expect(i.min).toBe(2000);
    expect(i.max).toBe(4000);
    // ничего похожего на «по инструкции»
    expect(v.note).not.toMatch(/по инструкции/i);
    expect(i.note).not.toMatch(/по инструкции/i);
  });

  it('DEFAULT_DOSAGES: план поддержки получает реальные мг/тайминг', () => {
    expect(DEFAULT_DOSAGES['vitex']).toBeTruthy();
    expect(DEFAULT_DOSAGES['vitex'].mg).toBe(30);
    expect(DEFAULT_DOSAGES['inositol']).toBeTruthy();
    expect(DEFAULT_DOSAGES['inositol'].mg).toBe(3000);
  });

  it('паспорт vitex/inositol: hasData=true и диапазон из окна', () => {
    const pv = buildSubstancePassport({
      id: 'vitex', nameRu: 'Витекс (прутняк)', maxBio: 0.9, formKey: 'standard',
      therapeutic: THERAPEUTIC_WINDOWS as never, ranges: {}, category: ['herb'],
      person: { sex: 'female' },
    });
    expect(pv.dose.hasData).toBe(true);
    expect(pv.dose.min).toBe(20);
    expect(pv.dose.max).toBe(40);
    const pi = buildSubstancePassport({
      id: 'inositol', nameRu: 'Инозитол (мио)', maxBio: 0.9, formKey: 'standard',
      therapeutic: THERAPEUTIC_WINDOWS as never, ranges: {}, category: ['supplement'],
      person: { sex: 'female' },
    });
    expect(pi.dose.hasData).toBe(true);
    expect(pi.dose.min).toBe(2000);
    expect(pi.dose.note).not.toMatch(/по инструкции/i);
  });
});
