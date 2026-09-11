import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VolumeQualityCard, PerMuscleList, VolumeConveyorCard, qualityColorFor } from '../volume-optimizer-parts';

const quality = {
  score: 82,
  over: [] as string[],
  weakCovered: ['chest'],
  weakMissed: [] as string[],
  monotonyNote: '✅ Монотонность/strain в норме',
  labWarnings: [] as string[],
  mvGroups: [{ group: 'abs', effectiveSets: 4, mev: 6 }],
  sessViol: [] as Array<{ message: string }>,
  freqFlags: [] as string[],
  rir: { verdict: { kind: 'ok', message: 'RIR-профиль в норме' } },
  hard: { hardSets: 20, totalSets: 24, assumedSets: 0 },
};

describe('volume-optimizer-parts: QualityCard', () => {
  it('скор + data-v хуки + MV-плашка', () => {
    const html = renderToStaticMarkup(<VolumeQualityCard quality={quality} improving={false} onImprove={() => {}} />);
    expect(html).toContain('82/100');
    expect(html).toContain('data-v="quality-card"');
    expect(html).toContain('data-v="quality-score"');
    expect(html).toContain('Поддержание');
  });
  it('qualityColorFor: 85+ зелень, 65+ янтарь, ниже красень', () => {
    expect(qualityColorFor(90)).toBe('#22c55e');
    expect(qualityColorFor(70)).toBe('#f59e0b');
    expect(qualityColorFor(30)).toBe('#ef4444');
  });
});

describe('volume-optimizer-parts: PerMuscleList', () => {
  it('карточка с вердиктом частоты и hard-сетами', () => {
    const html = renderToStaticMarkup(<PerMuscleList items={[{
      muscle: 'chest', muscleRu: 'Грудь', currentSets: 18, hardSets: 18,
      mev: 8, mav: 14, mrv: 20, status: 'approaching_mrv',
      compoundSets: 12, isolationSets: 6, heavySets: 4,
      recoveryHoursEst: 100, optimalFreq: 2, currentFreq: 1,
      avgSFR: 1.2, efficiencyScore: 70,
      freqKind: 'warning', freqVerdict: 'Грудь: 18 > MAV 14 в 1 сессию — разбейте на ≥2',
      actionableTips: ['Разбейте'],
    }]} />);
    expect(html).toContain('data-v="per-muscle-card"');
    expect(html).toContain('разбейте');
    expect(html).toContain('hard 18/18');
  });
});

describe('volume-optimizer-parts: ConveyorCard', () => {
  it('кнопки + снапшот с Δ + data-v', () => {
    const html = renderToStaticMarkup(<VolumeConveyorCard
      flash="📥 Импорт: 3 строк"
      snapshots={[{ id: 1, at: Date.now(), level: 'intermediate', totalSets: 10, totalTonnage: 5000, byGroup: { chest: 10 }, rows: [] }]}
      compareWith={[{ exerciseId: 'bench_bar', day: 1, week: 1, weight: 80, reps: 8, sets: 12 }]}
      handlers={{ onDiaryImport: () => {}, onSnapshot: () => {}, onCsv: () => {}, onHtml: () => {}, onRemoveSnapshot: () => {} }}
    />);
    expect(html).toContain('data-v="conveyor"');
    expect(html).toContain('Из дневника');
    expect(html).toContain('Δ +2 подх');
  });
});
