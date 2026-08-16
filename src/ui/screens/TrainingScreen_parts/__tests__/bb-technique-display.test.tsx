/**
 * bb-technique-display.test.tsx — отображение «фишек» ББ-плана (UI-only).
 *
 * Хелперы: дроп-сет/rest-pause/myo-reps/21s/негативы, схемы объёма
 * (GVT/FST-7/8×8), суперсеты, DUP — метки и по-сетовые цепочки.
 * Важно: рендер-only — workSets/e.sets не меняются, учёт MRV не затрагивается.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionPlayer } from '../../SRCBBScreen_parts/SessionPlayer';
import {
  lastSetTechnique,
  techniqueLabel,
  volumeSchemeLabel,
  supersetLabel,
  techniqueChainParts,
  workSetsBreakdown,
  planSetsBreakdown,
  exerciseFeatureBadges,
} from '../bb-technique-display';
import type { BBExercise } from '../../../../engines/bb/bb-types';

const mkEx = (over: Partial<BBExercise> = {}): BBExercise => ({
  muscle: 'biceps',
  name: 'Сгибания на бицепс',
  role: 'accessory',
  character: 'памп',
  sets: 3,
  repsRange: [10, 15],
  rir: 2,
  workSets: [
    { reps: 10, rir: 2, weight: 20 },
    { reps: 10, rir: 2, weight: 20 },
    { reps: 10, rir: 2, weight: 20, technique: 'drop_set' },
  ],
  ...over,
});

describe('bb-technique-display: lastSetTechnique / techniqueLabel', () => {
  it('возвращает технику последнего сета', () => {
    expect(lastSetTechnique(mkEx())).toBe('drop_set');
    expect(lastSetTechnique(mkEx({ workSets: [{ reps: 10, rir: 2, weight: 20 }] }))).toBeNull();
    expect(lastSetTechnique(mkEx({ workSets: [] }))).toBeNull();
    expect(lastSetTechnique({ workSets: undefined } as any)).toBeNull();
  });

  it('маппит ключи в русские метки (обе системы имён)', () => {
    expect(techniqueLabel('drop_set')).toBe('Дроп-сет');
    expect(techniqueLabel('dropset')).toBe('Дроп-сет');
    expect(techniqueLabel('rest_pause')).toBe('Rest-pause');
    expect(techniqueLabel('myo_reps')).toBe('Myo-reps');
    expect(techniqueLabel('myo_rep')).toBe('Myo-reps');
    expect(techniqueLabel('twenty_ones')).toBe('21s (7-7-7)');
    expect(techniqueLabel('negative')).toBe('Негативы');
    expect(techniqueLabel(null)).toBeNull();
    expect(techniqueLabel('unknown_tech')).toBe('unknown tech');
  });
});

describe('bb-technique-display: volumeSchemeLabel / supersetLabel', () => {
  it('детектит схемы объёма из comment', () => {
    expect(volumeSchemeLabel({ comment: 'Разгибания + FST-7 (7×8-12, отдых 40с)' })).toBe('FST-7');
    expect(volumeSchemeLabel({ comment: 'GVT 10×10 (10×10-12, отдых 75с)' })).toBe('GVT 10×10');
    expect(volumeSchemeLabel({ comment: '8×8 Gironda (8×8-10, отдых 60с)' })).toBe('8×8 Gironda');
    expect(volumeSchemeLabel({ comment: 'обычный памп' })).toBeNull();
    expect(volumeSchemeLabel({ comment: undefined })).toBeNull();
  });

  it('возвращает имя партнёра суперсета', () => {
    expect(supersetLabel({ supersetWith: 'Жим лёжа' })).toBe('Жим лёжа');
    expect(supersetLabel({ supersetWith: undefined })).toBeNull();
  });
});

describe('bb-technique-display: techniqueChainParts (render-only)', () => {
  it('дроп-сет: веса ×0.8 и ×0.64 с округлением 0.1', () => {
    const ex = mkEx({ workSets: [{ reps: 10, rir: 2, weight: 100 }, { reps: 10, rir: 2, weight: 100 }, { reps: 10, rir: 2, weight: 100, technique: 'drop_set' }] });
    const ch = techniqueChainParts(ex)!;
    expect(ch.label).toBe('Дроп-сет (-20%×2)');
    expect(ch.parts).toEqual(['10×100', '6×80', '4×64']);
  });

  it('дроп-сет с отредактированным весом пользователя', () => {
    const ex = mkEx();
    const ch = techniqueChainParts(ex, 50)!;
    expect(ch.parts).toEqual(['10×50', '6×40', '4×32']);
  });

  it('rest-pause: мини-сеты через 15с', () => {
    const ex = mkEx({ workSets: [{ reps: 8, rir: 1, weight: 60 }, { reps: 8, rir: 1, weight: 60, technique: 'rest_pause' }] });
    const ch = techniqueChainParts(ex)!;
    expect(ch.label).toBe('Rest-pause');
    expect(ch.parts).toEqual(['8×60', '15с', '3-4×60', '15с', '3-4×60']);
  });

  it('myo-reps: активация + мини-сеты', () => {
    const ex = mkEx({ workSets: [{ reps: 15, rir: 2, weight: 30 }, { reps: 15, rir: 2, weight: 30, technique: 'myo_reps' }] });
    const ch = techniqueChainParts(ex)!;
    expect(ch.label).toBe('Myo-reps');
    expect(ch.parts.join(' ')).toContain('15×30');
    expect(ch.parts.join(' ')).toContain('4×4×30');
  });

  it('21s и негативы дают протоколы', () => {
    const t21 = techniqueChainParts(mkEx({ workSets: [{ reps: 21, rir: 2, weight: 20, technique: 'twenty_ones' }] }))!;
    expect(t21.label).toBe('21s (7-7-7)');
    expect(t21.parts[0]).toContain('21 повт');

    const neg = techniqueChainParts(mkEx({ workSets: [{ reps: 8, rir: 1, weight: 40, technique: 'negative' }] }))!;
    expect(neg.label).toBe('Негативы (3-4с)');
    expect(neg.parts.join(' ')).toContain('4-2-1-0');
  });

  it('без техники и с неизвестной техникой — null', () => {
    expect(techniqueChainParts(mkEx({ workSets: [{ reps: 10, rir: 2, weight: 20 }] }))).toBeNull();
    expect(techniqueChainParts(mkEx({ workSets: [{ reps: 10, rir: 2, weight: 20, technique: 'nope' }] }))).toBeNull();
    expect(techniqueChainParts({ workSets: [] } as any)).toBeNull();
  });
});

describe('bb-technique-display: workSetsBreakdown / planSetsBreakdown', () => {
  it('разбивает базовые подходы по-сетово', () => {
    const ex = mkEx({ workSets: [{ reps: 10, rir: 2, weight: 20 }, { reps: 10, rir: 2, weight: 22.5 }, { reps: 8, rir: 1, weight: 25 }] });
    expect(workSetsBreakdown(ex)).toEqual(['20×10 @RIR2', '22.5×10 @RIR2', '25×8 @RIR1']);
  });

  it('inline-правка пользователя пересчитывает разбивку', () => {
    const ex = mkEx();
    expect(workSetsBreakdown(ex, { sets: 2, reps: 12, weight: 30 })).toEqual(['30×12 @RIR2', '30×12 @RIR2']);
  });

  it('planSetsBreakdown отдаёт базовые подходы + цепочку', () => {
    const { lines, chain } = planSetsBreakdown(mkEx());
    expect(lines.length).toBe(3);
    expect(chain!.parts.join(' → ')).toContain('6×16');
  });
});

describe('bb-technique-display: exerciseFeatureBadges', () => {
  it('собирает бейджи техники + суперсета + схемы + DUP', () => {
    const ex = mkEx({
      supersetWith: 'Жим лёжа',
      comment: 'Добивка + FST-7 (7×8-12, отдых 40с)',
    });
    const badges = exerciseFeatureBadges(ex, 'heavy_light');
    expect(badges.map(b => b.label)).toEqual([
      'Дроп-сет',
      'Суперсет с «Жим лёжа»',
      'FST-7',
      'DUP',
    ]);
  });

  it('без фишек — пусто; DUP none не добавляется', () => {
    const ex = mkEx({ workSets: [{ reps: 10, rir: 2, weight: 20 }] });
    expect(exerciseFeatureBadges(ex, 'none')).toEqual([]);
    expect(exerciseFeatureBadges(ex, undefined)).toEqual([]);
  });

  it('полный DUP помечается явно', () => {
    const badges = exerciseFeatureBadges(mkEx({ workSets: [{ reps: 10, rir: 2, weight: 20 }] }), 'full_dup');
    expect(badges.map(b => b.label)).toEqual(['Полный DUP']);
  });
});

describe('SessionPlayer: техника видна в «Детали дня» (SSR-смок)', () => {
  beforeEach(() => localStorage.clear());

  it('показывает бейдж 💥 Дроп-сет у упражнения с техникой на последнем сете', () => {
    const html = renderToStaticMarkup(
      <SessionPlayer
        days={[{
          label: 'День 1',
          exercises: [{
            name: 'Разгибания на блоке',
            muscleGroup: 'triceps',
            targetSets: [
              { weight: 30, reps: 12, rir: 2 },
              { weight: 30, reps: 12, rir: 2 },
              { weight: 30, reps: 12, rir: 2, technique: 'drop_set' },
            ],
          }],
        }]}
        weekNumber={1}
        focus="X"
      />,
    );
    expect(html).toContain('💥 Дроп-сет');
    expect(html).toContain('Разгибания на блоке');
  });

  it('без техники бейдж не выводится', () => {
    const html = renderToStaticMarkup(
      <SessionPlayer
        days={[{
          label: 'День 1',
          exercises: [{ name: 'Жим лёжа', muscleGroup: 'chest', targetSets: [{ weight: 80, reps: 5, rir: 2 }] }],
        }]}
        weekNumber={1}
        focus="X"
      />,
    );
    expect(html).not.toContain('💥');
  });
});
