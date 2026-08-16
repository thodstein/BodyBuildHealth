/**
 * bb-auto-annual-ctx.test.ts — маппер контекста годового блока → шаг
 * «🏁 Contest prep» ББ-авто (annualBlockCtxToPrepPatch).
 */
import { describe, it, expect } from 'vitest';
import { annualBlockCtxToPrepPatch } from '../BbAutoConstructor';

describe('annualBlockCtxToPrepPatch', () => {
  it('без peakWeek → null (предзаполнение не нужно)', () => {
    expect(annualBlockCtxToPrepPatch({ peakWeek: false, weeks: 8, peakConfig: null })).toBeNull();
    expect(annualBlockCtxToPrepPatch({ weeks: 8 })).toBeNull();
  });

  it('peakConfig из профиля → все поля шага contest предзаполнены', () => {
    const patch = annualBlockCtxToPrepPatch({
      peakWeek: true,
      weeks: 12,
      peakConfig: {
        sex: 'male', category: 'classic_physique', weightKg: 80,
        experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
        showDate: '2026-09-01', weeksOut: 3,
        trainingProtocol: 'bb', carbLoadStrategy: 'moderate',
        waterStrategy: 'minimal', sodiumStrategy: 'constant',
        specialization: 'back_double',
      },
    });
    expect(patch).not.toBeNull();
    expect(patch!.peakWeekCategory).toBe('classic_physique');
    expect(patch!.peakSpec).toBe('back_double');
    expect(patch!.prepShowDate).toBe('2026-09-01');
    expect(patch!.prepTaperWeeks).toBe(3);
    expect(patch!.prepWeeks).toBe(12);
    expect(patch!.prepWaterMode).toBe('stable');   // minimal → стабильная вода
    expect(patch!.prepSodiumMode).toBe('stable');  // constant → стабильный натрий
    expect(patch!.prepCarbMode).toBe('moderate');  // moderate → moderate
    expect(patch!.prepConfirmedManip).toBe(false);
  });

  it('агрессивные моды → обратный маппинг с подтверждением', () => {
    const patch = annualBlockCtxToPrepPatch({
      peakWeek: true,
      weeks: 8,
      peakConfig: {
        category: 'bikini', weeksOut: 4, showDate: '2026-09-01',
        carbLoadStrategy: 'front', waterStrategy: 'moderate',
        sodiumStrategy: 'cut_2d', confirmedManipulation: true,
      },
    });
    expect(patch!.peakWeekCategory).toBe('bikini');
    expect(patch!.prepTaperWeeks).toBe(4);
    expect(patch!.prepWaterMode).toBe('moderate');
    expect(patch!.prepSodiumMode).toBe('moderate');
    expect(patch!.prepCarbMode).toBe('high');
    expect(patch!.prepConfirmedManip).toBe(true);
  });

  it('неизвестная категория → mens_physique (безопасный fallback)', () => {
    const patch = annualBlockCtxToPrepPatch({
      peakWeek: true,
      weeks: 6,
      peakConfig: { category: 'unknown_cat', weeksOut: 2, showDate: '2026-09-01', carbLoadStrategy: 'back' },
    });
    expect(patch!.peakWeekCategory).toBe('mens_physique');
    expect(patch!.prepCarbMode).toBe('conservative');
  });

  it('границы: weeksOut клампится 1..4, prepWeeks 1..52', () => {
    const patch = annualBlockCtxToPrepPatch({
      peakWeek: true,
      weeks: 200,
      peakConfig: { weeksOut: 99, showDate: '2026-09-01', carbLoadStrategy: 'moderate', waterStrategy: 'minimal', sodiumStrategy: 'constant' },
    });
    expect(patch!.prepTaperWeeks).toBe(4);
    expect(patch!.prepWeeks).toBe(52);
    const negative = annualBlockCtxToPrepPatch({
      peakWeek: true,
      weeks: -3,
      peakConfig: { weeksOut: 0, showDate: '2026-09-01', carbLoadStrategy: 'moderate', waterStrategy: 'minimal', sodiumStrategy: 'constant' },
    });
    expect(negative!.prepTaperWeeks).toBe(1);
    expect(negative!.prepWeeks).toBe(12);
  });
});
