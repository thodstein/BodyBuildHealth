import { describe, expect, it, beforeEach } from 'vitest';
import {
  weeklyRollup, addDays, loadIntelHistory, saveIntelDecision, clearIntelHistory, decisionsForWeek,
  buildCoachReportHtml, buildCoachReportCsv, buildCoachDigestText, buildCoachChecklist, coachChecklistLines,
  COACH_SECTION_ORDER, type CoachSection, type IntelDecision, type CoachReportInput,
} from '../intelligence-coach-report.engine';
import { toDailyLoads, sessionLoad } from '../training-load.engine';
import { csvCell } from '../intelligence-export.engine';

const TODAY = '2026-09-28';
function back(n: number): string { return addDays(TODAY, -n); }

/** Сессии за 14 дней, чтобы у недели была и прошлая база. */
function sessions14() {
  return Array.from({ length: 14 }, (_, i) => ({ date: back(i), sRPE: 7, durationMin: 60 }));
}

beforeEach(() => { try { clearIntelHistory(); } catch { /* noop */ } });

describe('E8 weekly roll-up: неделя vs предыдущая', () => {
  it('нагрузка/объём/сессии считаются по ФАКТУ и дают дельту', () => {
    const sess = sessions14().map((s, i) => (i < 7 ? { ...s, sRPE: 8 } : s)); // неделя выше прошлой
    const r = weeklyRollup({ dailyLoads: toDailyLoads(sess), sessions: sess, referenceDate: TODAY });
    const load = r.rows.find(x => x.key === 'load')!;
    expect(load.current).toBe(7 * 8 * 60);
    expect(load.previous).toBe(7 * 7 * 60);
    expect(load.deltaPct).toBeCloseTo(14.3, 0);
    expect(r.rows.find(x => x.key === 'sessions')!.current).toBe(7);
    expect(r.rows.find(x => x.key === 'volume')!.current).toBe(7 * 60);
  });

  it('без данных строка = null + оговорка, а не «0» и не дельта', () => {
    const r = weeklyRollup({ dailyLoads: [], sessions: [], referenceDate: TODAY });
    const load = r.rows.find(x => x.key === 'load')!;
    expect(load.current).toBeNull();
    expect(load.deltaPct).toBeNull();
    expect(load.note).toContain('нет ни одной сессии');
    expect(r.rows.find(x => x.key === 'acwr')!.note).toContain('нет сессий');
  });

  it('монотонность: 1 сессия → null с оговоркой, 2+ → число', () => {
    const one = [{ date: TODAY, sRPE: 7, durationMin: 60 }];
    expect(weeklyRollup({ dailyLoads: toDailyLoads(one), sessions: one, referenceDate: TODAY }).rows.find(x => x.key === 'monotony')!.note)
      .toContain('нужно ≥2 сессии');
    const two = [{ date: back(1), sRPE: 5, durationMin: 60 }, { date: TODAY, sRPE: 9, durationMin: 60 }];
    const m = weeklyRollup({ dailyLoads: toDailyLoads(two), sessions: two, referenceDate: TODAY }).rows.find(x => x.key === 'monotony')!;
    expect(m.current).not.toBeNull();
  });

  it('ACWR: значение есть, сравнение с прошлой неделей честно не считается', () => {
    const sess = sessions14();
    const acwr = weeklyRollup({ dailyLoads: toDailyLoads(sess), sessions: sess, referenceDate: TODAY }).rows.find(x => x.key === 'acwr')!;
    expect(acwr.current).toBeGreaterThan(0);
    expect(acwr.previous).toBeNull();
    expect(acwr.note).toContain('нужна база 28д');
  });

  it('готовность/усталость — среднее по истории, при <3 точках с оговоркой', () => {
    const hist = [{ date: TODAY, recovery: 80, fatigue: 20 }];
    const r = weeklyRollup({ dailyLoads: [], sessions: [], readinessHistory: hist, referenceDate: TODAY });
    expect(r.rows.find(x => x.key === 'readiness')!.current).toBe(80);
    expect(r.rows.find(x => x.key === 'readiness')!.note).toContain('меньше 3 точек');
    expect(r.rows.find(x => x.key === 'fatigue')!.current).toBe(20);
  });

  it('CMJ/wellness попадают в roll-up с зоной и оговоркой «не диагноз/не тест готовности»', () => {
    const r = weeklyRollup({
      dailyLoads: [], sessions: [],
      cmj: [{ date: back(1), heightCm: 40 }, { date: TODAY, heightCm: 32 }],
      wellness: [{ date: TODAY, sleepQuality: 2, soreness: 4, mood: 2, energy: 2, stressLevel: 4 }],
      referenceDate: TODAY,
    });
    const cmjRow = r.rows.find(x => x.key === 'cmj')!;
    expect(cmjRow.current).toBe(32);
    expect(cmjRow.note).toContain('не тест готовности');
    const wl = r.rows.find(x => x.key === 'wellness')!;
    expect(wl.current).not.toBeNull();
    expect(wl.note).toContain('не диагноз');
  });

  it('даты окна — локальные (окно = 7 дней, неделя не «уезжает» в UTC)', () => {
    const r = weeklyRollup({ dailyLoads: [], sessions: [], referenceDate: TODAY });
    expect(r.to).toBe(TODAY);
    expect(r.from).toBe(back(6));
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('E8 журнал решений (применено/отклонено)', () => {
  it('roundtrip, дедуп и cap', () => {
    saveIntelDecision({ date: TODAY, kind: 'pri', applied: true, label: 'Объём ×1.0', detail: 'ACWR 1.2' });
    const after = saveIntelDecision({ date: TODAY, kind: 'pri', applied: true, label: 'Объём ×1.0', detail: 'ACWR 1.3' });
    expect(after).toHaveLength(1);
    expect(after[0].detail).toBe('ACWR 1.3');
    for (let i = 0; i < 80; i++) saveIntelDecision({ date: back(i), kind: 'note', applied: true, label: `n${i}` });
    expect(loadIntelHistory().length).toBeLessThanOrEqual(60);
  });

  it('мусорные записи не сохраняются (не «решение без даты» и не «решение без kind»)', () => {
    const before = loadIntelHistory().length;
    saveIntelDecision({ date: 'мусор', kind: 'pri', applied: true, label: 'x' });
    saveIntelDecision({ date: TODAY, kind: 'выдумка' as any, applied: true, label: 'y' });
    saveIntelDecision({ date: TODAY, kind: 'pri', applied: true, label: '  ' });
    expect(loadIntelHistory()).toHaveLength(before);
  });

  it('битый стор → пустая история', () => {
    localStorage.setItem('he_intelligence_history_v1', '{{');
    expect(loadIntelHistory()).toEqual([]);
  });

  it('неделя фильтруется по датам; offset=1 отдаёт прошлую', () => {
    const d: IntelDecision[] = [
      { date: TODAY, kind: 'pri', applied: true, label: 'сейчас' },
      { date: back(8), kind: 'deload', applied: true, label: 'прошлая' },
    ];
    expect(decisionsForWeek(d, TODAY, 0).map(x => x.label)).toEqual(['сейчас']);
    expect(decisionsForWeek(d, TODAY, 1).map(x => x.label)).toEqual(['прошлая']);
  });

  it('clear чистит журнал', () => {
    saveIntelDecision({ date: TODAY, kind: 'accepted', applied: true, label: 'ok' });
    clearIntelHistory();
    expect(loadIntelHistory()).toEqual([]);
  });
});

describe('E8 отчёт тренеру: все 5 секций + roll-up + чек-лист', () => {
  const sections: CoachSection[] = COACH_SECTION_ORDER.map(id => ({ id, title: `T:${id}`, lines: [{ label: `L-${id}`, value: `V-${id}` }] }));
  const base: CoachReportInput = {
    generatedAt: '28.09.2026 10:00',
    sections,
    rollup: weeklyRollup({ dailyLoads: [], sessions: [], decisions: [], referenceDate: TODAY }),
  };

  it('HTML содержит все 5 секций, обе таблицы с thead, @page и подпись', () => {
    const html = buildCoachReportHtml(base);
    for (const id of COACH_SECTION_ORDER) expect(html).toContain(`T:${id}`);
    expect(html).toContain('Неделя vs предыдущая');
    expect(html).toContain('Чек-лист решений тренера');
    expect(html).toContain('@page');
    expect(html).toContain('thead{display:table-header-group}');
    expect(html).toContain('28.09.2026 10:00');
    expect(html).toContain('ACWR — эвристика мониторинга');
  });

  it('отсутствующие секции перечислены честно, а не молча', () => {
    // остаются только load/recovery/autoreg → не хватает forecast и recommendations
    const html = buildCoachReportHtml({ ...base, sections: sections.slice(0, 3) });
    expect(html).toContain('Пустые секции: forecast, recommendations');
    expect(html).not.toContain('Пустые секции: autoreg');
  });

  it('XSS: пользовательские строки экранируются в HTML', () => {
    const html = buildCoachReportHtml({
      ...base,
      sections: [{ id: 'load', title: '<script>alert(1)</script>', lines: [{ label: '"><img src=x onerror=1>', value: 'ok' }] }],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;&gt;&lt;img');
  });

  it('CSV: BOM, все секции, чек-лист, защита от формул', () => {
    const csv = buildCoachReportCsv({
      ...base,
      rollup: weeklyRollup({ dailyLoads: [], sessions: [], decisions: [{ date: TODAY, kind: 'declined', applied: false, label: '=cmd|calc', detail: '@x' }], referenceDate: TODAY }),
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    for (const id of COACH_SECTION_ORDER) expect(csv).toContain(id);
    expect(csv).toContain('decisions');
    expect(csv).toContain("'=cmd|calc");   // формула в начале ячейки экранирована
    expect(csv).toContain('@x');           // @ внутри строки — не начало ячейки, не формула
    expect(csvCell('=A1')).toBe("'=A1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('CSV-рекомендации ББ попадают отдельным блоком; без них — честная пустота', () => {
    const withRec = buildCoachReportCsv({ ...base, bbRecommendations: ['=1+1', 'Восстановление сна'] });
    expect(withRec).toContain('bb_rec');
    expect(withRec).toContain("'=1+1");
    const html = buildCoachReportHtml({ ...base, bbRecommendations: [] });
    expect(html).toContain('не выдумываем');
  });

  it('чек-лист: применено/отклонено видно тренеру; без решений — честная строка', () => {
    const input: CoachReportInput = {
      ...base,
      rollup: weeklyRollup({ dailyLoads: [], sessions: [], decisions: [
        { date: TODAY, kind: 'pri', applied: true, label: 'Объём ×0.85', detail: 'ACWR 1.6' },
        { date: TODAY, kind: 'declined', applied: false, label: 'Deload отклонён', detail: 'соревнование через 3 дня' },
      ], referenceDate: TODAY }),
    };
    const lines = coachChecklistLines(input.rollup.decisions);
    expect(lines.some(l => /Применено/.test(l.label) && /0\.85/.test(l.value))).toBe(true);
    expect(lines.some(l => /Отклонено/.test(l.label) && /соревнование/.test(l.value))).toBe(true);
    expect(buildCoachChecklist(input).lines).toHaveLength(2);
    expect(buildCoachChecklist(base).lines[0].label).toBe('Решений за неделю нет');
    expect(buildCoachReportHtml(input)).toContain('соревнование через 3 дня');
  });

  it('дайджест для Share содержит неделю, строки и границы', () => {
    const text = buildCoachDigestText({ ...base, rollup: weeklyRollup({ dailyLoads: toDailyLoads(sessions14()), sessions: sessions14(), referenceDate: TODAY }) });
    expect(text).toContain(TODAY);
    expect(text).toContain('Нагрузка');
    expect(text).toContain('не диагноз');
  });
});
