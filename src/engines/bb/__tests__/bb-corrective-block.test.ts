import { describe, it, expect } from 'vitest';
import {
  correctiveSessionForBB,
  correctiveBlockForBB,
  correctiveWaveForWeeks,
  correctiveFocusForWeek,
  correctiveBlockExportLines,
  type BBCorrPickInput,
} from '../bb-corrective-block.engine';
import { BB_CORRECTIVES, rankCorrectives } from '../bb-corrective.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';

const CAT = new Set(EXERCISE_CATALOG.map((e) => e.id));
const pick = (zone: string): BBCorrPickInput => {
  const top = rankCorrectives({ zones: [zone] });
  return top.length ? { corr: top[0].corr, why: top[0].why } : { corr: BB_CORRECTIVES[0] };
};

describe('bb-corrective-block ROUND-10', () => {
  it('сессия: ≤6, порядок техника → сила → стабильность, без дублей, все id — каталог', () => {
    const picks: BBCorrPickInput[] = [
      pick('chest'), pick('back'), pick('quads'), pick('hamstrings'),
      pick('delt_mid'), pick('calves'), pick('abs'), pick('traps'),
    ];
    const ses = correctiveSessionForBB(picks);
    expect(ses.length).toBeGreaterThan(0);
    expect(ses.length).toBeLessThanOrEqual(6);
    const order = { technique: 0, strength: 1, stability: 2 } as Record<string, number>;
    for (let i = 1; i < ses.length; i++) expect(order[ses[i].phase]).toBeGreaterThanOrEqual(order[ses[i - 1].phase]);
    expect(new Set(ses.map((s) => s.corrId)).size).toBe(ses.length);
    for (const s of ses) expect(CAT.has(s.exerciseId), s.exerciseId).toBe(true);
  });

  it('волна: 8 нед — канон 3-3-4-4-4-4-3-3; короткие — та же логика', () => {
    expect(correctiveWaveForWeeks(8)).toEqual([3, 3, 4, 4, 4, 4, 3, 3]);
    expect(correctiveWaveForWeeks(6)).toEqual([3, 3, 4, 4, 3, 3]);
    expect(correctiveWaveForWeeks(4)).toEqual([3, 4, 4, 3]);
    // 2 нед — слишком коротко для разгрузки: втягивание → рабочая (без «пик/разгрузка»)
    expect(correctiveWaveForWeeks(2)).toEqual([3, 4]);
  });

  it('фокус недели: втягивание → прогрессия → пик → разгрузка', () => {
    expect(correctiveFocusForWeek(0, 8)).toBe('Втягивание');
    expect(correctiveFocusForWeek(3, 8)).toBe('Прогрессия');
    expect(correctiveFocusForWeek(5, 8)).toBe('Пик');
    expect(correctiveFocusForWeek(6, 8)).toBe('Разгрузка');
    expect(correctiveFocusForWeek(7, 8)).toBe('Разгрузка');
  });

  it('блок: недели/сеты по волне, разгрузка RIR+1 (кламп 4), все id — каталог', () => {
    const picks = [pick('chest'), pick('quads'), pick('calves')];
    const block = correctiveBlockForBB(picks, 8);
    expect(block.weeks.length).toBe(8);
    expect(block.weeks.map((w) => w.items[0].sets)).toEqual([3, 3, 4, 4, 4, 4, 3, 3]);
    const load = block.weeks[2].items[0];
    const deload = block.weeks[7].items[0];
    expect(deload.rir).toBe(Math.min(4, load.rir + 1));
    expect(block.summary).toContain('волна 3-3-4-4-4-4-3-3');
    for (const wk of block.weeks) for (const i of wk.items) expect(CAT.has(i.exerciseId), i.exerciseId).toBe(true);
  });

  it('пустой вход: честная сводка без коррекций, экспорт пуст', () => {
    const block = correctiveBlockForBB([], 6);
    expect(block.weeks.length).toBe(6);
    expect(block.weeks[0].items.length).toBe(0);
    expect(block.summary).toContain('нет коррекций');
    expect(correctiveBlockExportLines(block)).toEqual([]);
    expect(correctiveBlockExportLines(null)).toEqual([]);
  });

  it('экспорт: сводка + строка на неделю с дозой', () => {
    const block = correctiveBlockForBB([pick('chest'), pick('quads')], 6);
    const lines = correctiveBlockExportLines(block);
    expect(lines[0]).toContain('Блок коррекции');
    expect(lines.length).toBe(7);
    expect(lines[1]).toMatch(/^Нед 1 \(Втягивание\): .+ \d+×\d+–\d+ RIR\d/);
  });
});
