import { describe, expect, it, beforeEach } from 'vitest';
import {
  QUALITY_HISTORY_CAP,
  buildQualityExportCsv,
  buildQualityExportHtml,
  buildSplitFixText,
  buildSyntheticPlWeeks,
  combinedQualitySummary,
  compareQualitySnapshots,
  deriveV2InputFromProgram,
  escapeQualityHtml,
  loadQualityHistory,
  programForDivision,
  removeQualitySnapshot,
  saveQualitySnapshot,
  QUALITY_HISTORY_KEY,
  resolveWorkMax,
} from '../quality-hub-helpers';

beforeEach(() => {
  try { localStorage.removeItem(QUALITY_HISTORY_KEY); } catch { /* ignore */ }
});

describe('quality-hub-helpers: resolveWorkMax', () => {
  it('профиль приоритетнее фолбэка', () => {
    expect(resolveWorkMax({ chest: 100 }, 'chest')).toBe(100);
  });
  it('пусто/0/NaN → 60', () => {
    expect(resolveWorkMax(null, 'chest')).toBe(60);
    expect(resolveWorkMax({}, 'chest')).toBe(60);
    expect(resolveWorkMax({ chest: 0 }, 'chest')).toBe(60);
    expect(resolveWorkMax({ chest: NaN }, 'chest')).toBe(60);
  });
  it('алиасы legs→quads, arms→biceps', () => {
    expect(resolveWorkMax({ quads: 140 }, 'legs')).toBe(140);
    expect(resolveWorkMax({ biceps: 50 }, 'arms')).toBe(50);
    expect(resolveWorkMax({ shoulders: 60 }, 'delt_mid')).toBe(60);
  });
});

describe('quality-hub-helpers: buildSyntheticPlWeeks', () => {
  it('null → []', () => {
    expect(buildSyntheticPlWeeks(null)).toEqual([]);
    expect(buildSyntheticPlWeeks(undefined)).toEqual([]);
  });
  it('синтез из week1: недели/дни/RIR-дефолт/group-фолбэк', () => {
    const tpl: any = {
      week1: [{ exercises: [{ name: 'Жим', sets: [{ pct: 0.7, reps: 5, sets: 3 }] }] }],
    };
    const w = buildSyntheticPlWeeks(tpl);
    expect(w).toHaveLength(1);
    expect(w[0].week).toBe(1);
    expect(w[0].phase).toBe('accumulation');
    expect(w[0].days[0].name).toBe('День 1');
    expect(w[0].days[0].exercises[0].muscle).toBe('chest');
    expect(w[0].days[0].exercises[0].sets[0].rir).toBe(2);
  });
  it('weeks приоритетнее week1', () => {
    const tpl: any = {
      weeks: [
        [{ exercises: [{ name: 'A', group: 'back', sets: [{ pct: 0.7, reps: 5, sets: 3, rir: 1 }] }] }],
        [{ exercises: [{ name: 'B', sets: [{ pct: 0.7, reps: 5, sets: 3 }] }] }],
      ],
      week1: [{ exercises: [{ name: 'C', sets: [{ pct: 0.7, reps: 5, sets: 3 }] }] }],
    };
    const w = buildSyntheticPlWeeks(tpl);
    expect(w).toHaveLength(2);
    expect(w[0].days[0].exercises[0].sets[0].rir).toBe(1);
  });
});

describe('quality-hub-helpers: deriveV2InputFromProgram', () => {
  const BB: any = {
    meta: { id: 'p1', direction: 'bb' },
    bb: {
      weeks: [
        {
          week: 1, sessions: [
            { blocks: [{ muscle: 'chest', exerciseName: 'Жим лёжа', sets: [{ reps: 8, rir: 2 }, { reps: 8, rir: 1 }, { reps: 8, rir: 2 }] }] },
            { blocks: [{ muscle: 'chest', exerciseName: 'Разводка', sets: [{ reps: 12, rir: 2 }] }] },
          ],
        },
        { week: 2, deload: true, sessions: [{ blocks: [{ muscle: 'chest', exerciseName: 'Жим лёжа', sets: [{ reps: 8, rir: 4 }] }] }] },
      ],
    },
  };
  it('BB: sessionMax/RIR/делод/имена', () => {
    const v = deriveV2InputFromProgram(BB, 'bb', 'intermediate')!;
    expect(v).not.toBeNull();
    expect(v.sessionMaxByMuscle?.chest).toBe(3);
    expect(v.rir?.totalSets).toBe(5);
    expect(v.rir?.avgRir).toBeCloseTo(2.2, 1);
    expect(v.deload?.hasDeload).toBe(true);
    expect(v.namesByMuscle?.chest).toContain('Жим лёжа');
    expect(v.mev.chest).toBe(8);
  });
  it('пусто → null', () => {
    expect(deriveV2InputFromProgram(null, 'bb', 'intermediate')).toBeNull();
    expect(deriveV2InputFromProgram({ meta: {} }, 'bb', 'intermediate')).toBeNull();
  });
});

describe('quality-hub-helpers: история', () => {
  const snap = (score: number) => ({
    programId: 'p1', title: 'T', division: 'bb' as const,
    score, grade: 'g', v2Score: score,
    perMuscle: [{ muscle: 'chest', peakSets: score, status: 'ok' }],
  });
  it('save/load/remove + кап 10', () => {
    for (let i = 0; i < 12; i++) saveQualitySnapshot(snap(i));
    const h = loadQualityHistory();
    expect(h).toHaveLength(QUALITY_HISTORY_CAP);
    expect(h[0].score).toBe(11); // новейший первый
    const rest = removeQualitySnapshot(h[0].id);
    expect(rest).toHaveLength(QUALITY_HISTORY_CAP - 1);
  });
  it('битый стор → []', () => {
    localStorage.setItem(QUALITY_HISTORY_KEY, 'not-json{{{');
    expect(loadQualityHistory()).toEqual([]);
    localStorage.setItem(QUALITY_HISTORY_KEY, '{"a":1}');
    expect(loadQualityHistory()).toEqual([]);
  });
});

describe('quality-hub-helpers: сравнение', () => {
  it('дельта скора и мышц', () => {
    const c = compareQualitySnapshots(
      { score: 70, perMuscle: [{ muscle: 'chest', peakSets: 10, status: 'ok' }] },
      { score: 80, perMuscle: [{ muscle: 'chest', peakSets: 14, status: 'ok' }, { muscle: 'back', peakSets: 8, status: 'ok' }] },
    );
    expect(c.scoreDelta).toBe(10);
    expect(c.muscleDelta.find(m => m.muscle === 'chest')?.delta).toBe(4);
    expect(c.muscleDelta.find(m => m.muscle === 'back')?.delta).toBe(8);
  });
});

describe('quality-hub-helpers: programForDivision', () => {
  const tpl: any = { week1: [{ exercises: [{ name: 'Жим', sets: [{ pct: 0.7, reps: 5, sets: 3 }] }] }] };
  const getById = (id: string) => (id === 'c1' ? tpl : null);
  it('null → null', () => {
    expect(programForDivision(null, 'bb', getById)).toBeNull();
  });
  it('ПЛ-синтетика из шаблона', () => {
    const prog: any = { meta: { direction: 'pl' }, pl: { sourceCycleId: 'c1' } };
    const out = programForDivision(prog, 'pl', getById)!;
    expect(out.pl.customWeeks).toHaveLength(1);
    expect(prog.pl.customWeeks).toBeUndefined(); // вход не мутирован
  });
  it('hybrid bb-fallback', () => {
    const prog: any = { meta: { direction: 'hybrid' }, hybrid: { bbWeeks: [{ week: 1 }] } };
    const out = programForDivision(prog, 'bb', getById)!;
    expect((out.bb as any).weeks).toEqual([{ week: 1 }]);
  });
  it('без шаблона — как есть', () => {
    const prog: any = { meta: { direction: 'pl' }, pl: { sourceCycleId: 'nope' } };
    expect(programForDivision(prog, 'pl', getById)).toBe(prog);
  });
});

describe('quality-hub-helpers: combinedQualitySummary', () => {
  it('согласованные контуры — agreement true', () => {
    const c = combinedQualitySummary(80, 3, 82);
    expect(c.proTotal).toBe(83);
    expect(c.agreement).toBe(true);
    expect(c.text).toContain('согласны');
  });
  it('расходящиеся — agreement false', () => {
    const c = combinedQualitySummary(95, null, 40);
    expect(c.agreement).toBe(false);
    expect(c.text).toContain('расходятся');
  });
  it('без PRO и V2 — только база', () => {
    const c = combinedQualitySummary(70, null, null);
    expect(c.proTotal).toBeNull();
    expect(c.v2).toBeNull();
    expect(c.agreement).toBe(true);
  });
});

describe('quality-hub-helpers: split-текст', () => {
  it('половинит объём по дням', () => {
    const t = buildSplitFixText([{ muscle: 'chest', weeklySets: 18, frequency: 1 }]);
    expect(t).toContain('chest: 18 сетов в 1×/нед → разбить на 2× по ~9');
  });
});

describe('quality-hub-helpers: derive делод-глубина', () => {
  it('номера недель + срез объёма + RIR-сдвиг', () => {
    const prog: any = {
      meta: { direction: 'bb' },
      bb: {
        weeks: [
          { week: 1, sessions: [{ blocks: [{ muscle: 'chest', exerciseName: 'Жим', sets: [{ reps: 8, rir: 2 }, { reps: 8, rir: 2 }] }] }] },
          { week: 2, deload: true, sessions: [{ blocks: [{ muscle: 'chest', exerciseName: 'Жим', sets: [{ reps: 8, rir: 4 }] }] }] },
        ],
      },
    };
    const v = deriveV2InputFromProgram(prog, 'bb', 'intermediate')!;
    expect(v.deload?.hasDeload).toBe(true);
    expect(v.deload?.deloadWeeks).toEqual([2]);
    expect(v.deload?.depthVolume).toBeCloseTo(0.5, 1);
    expect(v.deload?.rirShift).toBeCloseTo(2, 1);
  });
});

describe('quality-hub-helpers: экспорт', () => {
  const input = {
    title: 'T<script>alert(1)</script>', division: 'bb' as const, level: 'intermediate', pedLabel: 'Натурал',
    score: 80, grade: 'g', v2Score: 82, v2Grade: '🟢 Профессионально',
    perMuscle: [{ muscle: 'chest', peakSets: 12, avgSets: 10, mev: 8, mav: 14, mrv: 20, status: 'ok' }],
    v2Issues: [{ id: 'x', severity: 'warning', message: 'тест' }],
  };
  it('HTML экранирует XSS', () => {
    const html = buildQualityExportHtml(input);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
  it('CSV защищает формулы и кавычки', () => {
    const csv = buildQualityExportCsv({ ...input, title: '=cmd|test' });
    expect(csv).toContain("'=cmd|test");
    expect(escapeQualityHtml('"a"')).toBe('&quot;a&quot;');
  });
});
