/**
 * ss-season-planner.test.ts — профессиональный планировщик сезона ТА/стронга.
 * Локи: маппинг фаз, пресеты, подбор цикла под фазу (уровень/период/длина/снаряды/
 * возраст/daily-max-гейт), раскладка фаз и масштабирование, сборка AnnualSS,
 * валидация методики (порядок фаз/тейпер/два пика/длина), таймлайн и локальные даты.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SEASON_PRESETS, getSeasonPreset, seasonPresetsFor, cycleSeasonPhase,
  rankCyclesForSeasonPhase, pickCycleForSeasonPhase, recommendSeasonPresetId,
  scalePresetPhases, recommendSeasonPlan, buildSeasonPlan, validateSeasonPeriodization,
  seasonTimeline, seasonSummaryLines, weeksUntilDate, SEASON_PHASE_META,
  seasonPlanWeekCells, buildSeasonSummaryText, buildSeasonPrintHtml, buildSeasonIcs,
  saveSeasonPlan, loadSeasonPlan, clearSeasonPlan, SS_SEASON_PLAN_KEY,
} from '../strength-sport-season-planner.engine';
import { SS_CYCLES, getSSCycleById } from '../../../data/ss-cycles/ss-cycle-index';

const WM = {
  snatch: 80, cleanJerk: 100, backSquat: 140, frontSquat: 120, deadlift: 180,
  overheadPress: 60, bench: 90, logPress: 80, yokeWalk: 220, farmersWalk: 150,
  atlasStone: 110, frameCarry: 180, axlePress: 70, axleDeadlift: 180,
} as any;

const baseInput = (over: any = {}) => ({
  mode: 'weightlifting', goal: 'strength', level: 'intermediate',
  weeks: 16, daysPerWeek: 5, workMax: WM, ...over,
}) as any;

describe('season-planner: фазы цикла', () => {
  it('cycleSeasonPhase: GPP/переход/периоды', () => {
    expect(cycleSeasonPhase(getSSCycleById('ss-sm-gpp-10')!)).toBe('gpp');
    expect(cycleSeasonPhase(getSSCycleById('ss-hb-transit-2')!)).toBe('transition');
    expect(cycleSeasonPhase(getSSCycleById('ss-ta-technique-6')!)).toBe('base');
    expect(cycleSeasonPhase(getSSCycleById('ss-ta-strength-8')!)).toBe('base');
    expect(cycleSeasonPhase(getSSCycleById('ss-sm-static-12')!)).toBe('build');
    expect(cycleSeasonPhase(getSSCycleById('ss-ta-comp-12')!)).toBe('peak');
    expect(cycleSeasonPhase(getSSCycleById('ss-sm-peak-8')!)).toBe('peak');
  });
  it('каждая фаза имеет мета (label/color)', () => {
    for (const ph of ['gpp', 'base', 'build', 'peak', 'taper', 'transition'] as const) {
      expect(SEASON_PHASE_META[ph].label.length).toBeGreaterThan(2);
      expect(SEASON_PHASE_META[ph].color).toMatch(/^#/);
    }
  });
});

describe('season-planner: пресеты', () => {
  it('пресеты валидны: фазы непусты, вес >0, id уникальны', () => {
    const ids = SEASON_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SEASON_PRESETS.length).toBeGreaterThanOrEqual(6);
    for (const p of SEASON_PRESETS) {
      expect(p.phases.length, p.id).toBeGreaterThan(0);
      for (const ph of p.phases) expect(ph.weight, `${p.id}/${ph.phase}`).toBeGreaterThan(0);
    }
  });
  it('seasonPresetsFor: event_specialization только стронг/гибрид', () => {
    const ta = seasonPresetsFor('weightlifting').map(p => p.id);
    const sm = seasonPresetsFor('strongman').map(p => p.id);
    expect(ta).not.toContain('event_specialization');
    expect(sm).toContain('event_specialization');
    expect(ta.length).toBeGreaterThanOrEqual(5);
  });
  it('recommendSeasonPresetId: по цели/уровню/дате', () => {
    expect(recommendSeasonPresetId({ mode: 'weightlifting', level: 'beginner', daysPerWeek: 4 })).toBe('beginner_year');
    expect(recommendSeasonPresetId({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, goal: 'peaking', competitionDate: '2026-12-01' })).toBe('single_peak');
    expect(recommendSeasonPresetId({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, goal: 'peaking' })).toBe('comp_prep');
    expect(recommendSeasonPresetId({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4 })).toBe('event_specialization');
    expect(recommendSeasonPresetId({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 5, presetId: 'double_peak' })).toBe('double_peak');
  });
  it('scalePresetPhases: сумма ≈ горизонт, тейпер ≤2, каждая фаза ≥1', () => {
    const p = getSeasonPreset('single_peak')!;
    const scaled = scalePresetPhases(p, 20);
    const sum = scaled.reduce((a, x) => a + x.targetWeeks, 0);
    expect(Math.abs(sum - 20)).toBeLessThanOrEqual(2);
    for (const s of scaled) {
      expect(s.targetWeeks, s.phase).toBeGreaterThanOrEqual(1);
      if (s.phase === 'taper') expect(s.targetWeeks).toBeLessThanOrEqual(2);
    }
  });
});

describe('season-planner: подбор цикла под фазу', () => {
  it('болгарский заблокирован без согласия (score -1000, blocked)', () => {
    const ranked = rankCyclesForSeasonPhase('weightlifting', 'peak', { level: 'advanced', targetWeeks: 8 });
    const bulg = ranked.find(r => r.cycle.meta.id === 'ss-ta-bulgarian');
    expect(bulg?.blocked).toMatch(/согласие/);
    const ok = rankCyclesForSeasonPhase('weightlifting', 'peak', { level: 'advanced', targetWeeks: 8, cycleConsent: true });
    expect(ok.find(r => r.cycle.meta.id === 'ss-ta-bulgarian')?.blocked).toBeFalsy();
  });
  it('peak-фаза у ТА выбирает соревновательный/пиковый цикл', () => {
    const pick = pickCycleForSeasonPhase('weightlifting', 'peak', { level: 'intermediate', targetWeeks: 12, daysPerWeek: 5 });
    expect(pick).toBeTruthy();
    expect(cycleSeasonPhase(pick!)).toBe('peak');
  });
  it('base-фаза у новичка — без daily-max и без advanced-only', () => {
    const pick = pickCycleForSeasonPhase('weightlifting', 'base', { level: 'beginner', targetWeeks: 6, daysPerWeek: 4 });
    expect(pick).toBeTruthy();
    expect(pick!.meta.level).toContain('beginner');
    expect(pick!.meta.bulgarian).toBeFalsy();
  });
  it('GPP-фаза у стронга выбирает GPP-цикл', () => {
    const pick = pickCycleForSeasonPhase('strongman', 'gpp', { level: 'intermediate', targetWeeks: 10, daysPerWeek: 4, equipment: ['barbell', 'other'] });
    expect(pick!.meta.id).toBe('ss-sm-gpp-10');
  });
  it('GPP-фаза у ТА выбирает ТА GPP-цикл (не силовой)', () => {
    const pick = pickCycleForSeasonPhase('weightlifting', 'gpp', { level: 'intermediate', targetWeeks: 8, daysPerWeek: 4 });
    expect(pick!.meta.id).toBe('ss-ta-gpp-8');
    expect(pick!.meta.tags || []).toContain('gpp');
  });
  it('тейпер-фаза выбирает 2-недельный тейпер-цикл своего режима', () => {
    const ta = pickCycleForSeasonPhase('weightlifting', 'taper', { level: 'advanced', targetWeeks: 2, daysPerWeek: 4 });
    const sm = pickCycleForSeasonPhase('strongman', 'taper', { level: 'advanced', targetWeeks: 2, daysPerWeek: 4 });
    expect(ta!.meta.id).toBe('ss-ta-taper-2');
    expect(sm!.meta.id).toBe('ss-sm-taper-2');
    expect(ta!.meta.weeks).toBe(2);
  });
  it('без спец-снарядов цикл с ивентами допустим, но со штрафом-пометкой', () => {
    const ranked = rankCyclesForSeasonPhase('strongman', 'build', { level: 'intermediate', targetWeeks: 12, equipment: ['barbell'] });
    const staticC = ranked.find(r => r.cycle.meta.id === 'ss-sm-static-12');
    expect(staticC).toBeTruthy();
    expect(staticC!.reasons.join(' ')).toMatch(/без снарядов/);
  });
});

describe('season-planner: рекомендация сезона', () => {
  it('ТА intermediate 16 нед без старта: фазы в правильном порядке, все циклы существуют', () => {
    const plan = recommendSeasonPlan({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, weeks: 16, goal: 'strength' });
    expect(plan.blocks.length).toBeGreaterThanOrEqual(3);
    expect(plan.totalWeeks).toBe(plan.blocks.reduce((a, b) => a + b.weeks, 0));
    const order = { gpp: 0, base: 1, build: 2, peak: 3, taper: 4, transition: 5 } as const;
    const seq = plan.blocks.map(b => order[b.phase]);
    for (let i = 1; i < seq.length - 1; i++) {
      // переход может идти в любом месте, остальные — по возрастанию
      if (plan.blocks[i].phase !== 'transition' && plan.blocks[i - 1].phase !== 'transition') {
        expect(seq[i], `блок ${i}`).toBeGreaterThanOrEqual(seq[i - 1]);
      }
    }
    for (const b of plan.blocks) expect(getSSCycleById(b.cycleId), b.cycleId).toBeTruthy();
    expect(plan.rationale.length).toBeGreaterThan(0);
  });

  it('новичок без старта → beginner_year; daily-max исключён', () => {
    const plan = recommendSeasonPlan({ mode: 'weightlifting', level: 'beginner', daysPerWeek: 4, weeks: 20 });
    expect(plan.presetId).toBe('beginner_year');
    for (const b of plan.blocks) {
      const c = getSSCycleById(b.cycleId)!;
      expect(c.meta.bulgarian, b.cycleId).toBeFalsy();
    }
    expect(plan.rationale.join(' ')).toMatch(/Новичок/);
  });

  it('стронг без спец-снарядов: честное предупреждение о фолбэке', () => {
    const plan = recommendSeasonPlan({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4, weeks: 20, equipment: ['barbell'] });
    expect(plan.warnings.join(' ')).toMatch(/спец-снаряд/i);
  });

  it('период старта: single_peak оканчивается тейпером (пик перед стартом)', () => {
    const plan = recommendSeasonPlan({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 5, weeks: 22, goal: 'peaking', competitionDate: '2026-12-01' });
    expect(plan.presetId).toBe('single_peak');
    expect(plan.blocks[plan.blocks.length - 1].phase).toBe('taper');
    const taperBlock = plan.blocks[plan.blocks.length - 1];
    expect(taperBlock.weeks).toBeLessThanOrEqual(2); // не 6-12 недель «тейпера»
    expect(taperBlock.cycleId).toMatch(/taper/);
  });

  it('тейпер-блок — 1-2 нед, переходный — ≤3 нед (гейты фаз-обёрток)', () => {
    const plan = recommendSeasonPlan({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4, weeks: 24, goal: 'peaking', competitionDate: '2026-12-01' });
    for (const b of plan.blocks) {
      if (b.phase === 'taper') { expect(b.weeks, b.title).toBeLessThanOrEqual(2); expect(b.cycleId).toMatch(/taper/); }
      if (b.phase === 'transition') { expect(b.weeks, b.title).toBeLessThanOrEqual(3); }
      // Ни один «тейпер» не должен быть 4+ недель
      if (b.phase === 'taper') expect(b.weeks, b.title).not.toBeGreaterThan(2);
    }
  });

  it('новичок: ни один блок не сложнее beginner-уровня', () => {
    for (const mode of ['weightlifting', 'strongman'] as const) {
      const plan = recommendSeasonPlan({ mode, level: 'beginner', daysPerWeek: 4, weeks: 20 });
      for (const b of plan.blocks) {
        const c = getSSCycleById(b.cycleId)!;
        expect(c.meta.level.includes('beginner'), `${mode}/${b.cycleId}`).toBe(true);
      }
    }
  });

  it('новичок: без пиков/тейперов, длинный горизонт добирается базой/GPP', () => {
    const plan = recommendSeasonPlan({ mode: 'weightlifting', level: 'beginner', daysPerWeek: 4, weeks: 52 });
    expect(plan.blocks.some(b => b.phase === 'peak' || b.phase === 'taper')).toBe(false);
    expect(plan.blocks.filter(b => b.phase === 'base' || b.phase === 'gpp').length).toBeGreaterThanOrEqual(3);
    expect(plan.totalWeeks).toBeGreaterThan(40); // новичок не «обрывается» на 20 неделях
  });

  it('сезон > 52 нед — предупреждение (горизонт и факт)', () => {
    const plan = recommendSeasonPlan({ mode: 'strongman', level: 'advanced', daysPerWeek: 4, weeks: 60 });
    // Итог — сумма длин подобранных циклов (честно), горизонт 60 > 52 → warning
    expect(plan.warnings.join(' ')).toMatch(/>\s?52/);
    expect(plan.totalWeeks).toBe(plan.blocks.reduce((a, b) => a + b.weeks, 0));
    expect(plan.totalWeeks).toBeLessThanOrEqual(52);
  });

  it('длинный горизонт без старта добирается мульти-пиком (2-3 пика)', () => {
    const plan = recommendSeasonPlan({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, weeks: 52, goal: 'strength' });
    const peaks = plan.blocks.filter(b => b.phase === 'peak').length;
    expect(peaks).toBeGreaterThanOrEqual(2);
    expect(peaks).toBeLessThanOrEqual(3);
    expect(plan.blocks.some(b => b.phase === 'transition')).toBe(true);
    expect(plan.rationale.join(' ')).toMatch(/Мульти-пик/);
    expect(plan.totalWeeks).toBeLessThanOrEqual(52);
    // Пики не подряд (между ними наращивание или переход)
    const phases = plan.blocks.map(b => b.phase);
    for (let i = 1; i < phases.length; i++) {
      if (phases[i] === 'peak' && phases[i - 1] === 'peak') throw new Error('пики подряд');
    }
    // validate не ругается на порядок
    expect(validateSeasonPeriodization(plan).warnings.join(' ')).not.toMatch(/два пика подряд/);
  });
});

describe('season-planner: сборка и валидация', () => {
  it('buildSeasonPlan: AnnualSS с блоками и построенными планами', () => {
    const season = recommendSeasonPlan({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, weeks: 12, goal: 'strength' });
    const input = baseInput({ weeks: season.totalWeeks });
    const annual = buildSeasonPlan(season, input, { cycleMode: 'faithful' });
    expect(annual.blocks.length).toBe(season.blocks.length);
    expect(annual.totalWeeks).toBe(season.totalWeeks);
    let start = 1;
    for (const b of annual.blocks) {
      expect(b.startWeek).toBe(start);
      expect(b.status).toBe('built');
      expect(b.plan, `блок ${b.id}`).toBeTruthy();
      expect(b.plan!.weeksData.length).toBe(b.weeks);
      start += b.weeks;
    }
    expect(Array.isArray(annual.rationale)).toBe(true);
  });

  it('buildSeasonPlan: пустой сезон бросает', () => {
    const empty = { ...recommendSeasonPlan({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4 }), blocks: [], totalWeeks: 0 };
    expect(() => buildSeasonPlan(empty as any, baseInput())).toThrow(/пуст/i);
  });

  it('validateSeasonPeriodization: два пика подряд без перехода — warning', () => {
    const season = recommendSeasonPlan({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 5, presetId: 'double_peak', weeks: 24 });
    // Искусственно делаем 5-й блок пиком (4-й уже пик — два подряд без перехода)
    const broken = { ...season, blocks: season.blocks.map((b, i) => (i === 4 ? { ...b, phase: 'peak' as const } : b)) };
    const v = validateSeasonPeriodization(broken as any);
    expect(v.warnings.join(' ')).toMatch(/два пика подряд/);
  });

  it('validateSeasonPeriodization: пик без базы/наращивания — warning', () => {
    const season = recommendSeasonPlan({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 5, presetId: 'comp_prep', weeks: 12 });
    // Пик первым блоком — до него нет ни базы, ни наращивания
    const broken = { ...season, blocks: [{ ...season.blocks[0], phase: 'peak' as const }] };
    const v = validateSeasonPeriodization(broken as any);
    expect(v.warnings.join(' ')).toMatch(/без базы\/наращивания/);
  });

  it('validateSeasonPeriodization: валидный сезон без errors', () => {
    const season = recommendSeasonPlan({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4, weeks: 20 });
    const v = validateSeasonPeriodization(season);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('validateSeasonPeriodization: длинный «тейпер»/«переход» и 4+ пиков — warnings', () => {
    const season = recommendSeasonPlan({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, weeks: 12 });
    const longTaper = { ...season, blocks: season.blocks.map((b, i) => (i === 1 ? { ...b, phase: 'taper' as const, weeks: 6 } : b)) };
    expect(validateSeasonPeriodization(longTaper as any).warnings.join(' ')).toMatch(/Тейпер 6 нед/);
    const longTransit = { ...season, blocks: season.blocks.map((b, i) => (i === 1 ? { ...b, phase: 'transition' as const, weeks: 8 } : b)) };
    expect(validateSeasonPeriodization(longTransit as any).warnings.join(' ')).toMatch(/Переход 8 нед/);
    const manyPeaks = { ...season, blocks: [0, 1, 2, 3].map(i => ({ ...season.blocks[0], phase: 'peak' as const })) };
    expect(validateSeasonPeriodization(manyPeaks as any).warnings.join(' ')).toMatch(/не более 3/);
  });

  it('seasonTimeline: строки по блокам, недели последовательны, фазы окрашены', () => {
    const season = recommendSeasonPlan({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, weeks: 12 });
    const annual = buildSeasonPlan(season, baseInput({ weeks: season.totalWeeks }));
    const rows = seasonTimeline(annual);
    expect(rows.length).toBe(annual.blocks.length);
    for (const r of rows) {
      expect(r.color).toMatch(/^#/);
      expect(SEASON_PHASE_META[r.phase]).toBeTruthy();
      expect(r.weeks).toBeGreaterThan(0);
    }
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].startWeek).toBe(rows[i - 1].startWeek + rows[i - 1].weeks);
    }
    const lines = seasonSummaryLines(season);
    expect(lines.length).toBe(season.blocks.length);
    expect(lines[0]).toMatch(/^Нед 1–/);
  });
});

describe('season-planner: локальная арифметика дат', () => {
  it('weeksUntilDate без UTC-сдвига дня', () => {
    expect(weeksUntilDate('2026-01-08', '2026-01-01')).toBe(1);
    expect(weeksUntilDate('2026-01-15', '2026-01-01')).toBe(2);
    expect(weeksUntilDate('2025-12-25', '2026-01-01')).toBe(-1);
    expect(weeksUntilDate('мусор', '2026-01-01')).toBeNull();
  });
});

describe('season-planner: гигиена реестра', () => {
  it('все 30 циклов классифицируются в фазу сезона', () => {
    for (const c of SS_CYCLES) {
      const ph = cycleSeasonPhase(c);
      expect(SEASON_PHASE_META[ph], c.meta.id).toBeTruthy();
    }
  });
});

describe('season-planner: таймлайн недель', () => {
  const plan = () => recommendSeasonPlan({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4, weeks: 24 });

  it('ячейка на каждую неделю, недели непрерывны, первая неделя блока помечена', () => {
    const p = plan();
    const cells = seasonPlanWeekCells(p);
    expect(cells.length).toBe(p.totalWeeks);
    cells.forEach((c, i) => expect(c.week, `cell ${i}`).toBe(i + 1));
    const starts = cells.filter(c => c.blockStart).map(c => c.week);
    expect(starts.length).toBe(p.blocks.length);
    expect(starts[0]).toBe(1);
    for (const c of cells) {
      expect(c.color).toMatch(/^#/);
      expect(c.short.length).toBeGreaterThan(0);
    }
    // старт каждого блока совпадает с суммой предыдущих
    let expected = 1;
    for (const b of p.blocks) {
      expect(starts).toContain(expected);
      expected += b.weeks;
    }
  });
});

describe('season-planner: текст и печать', () => {
  const plan = () => recommendSeasonPlan({ mode: 'weightlifting', level: 'advanced', daysPerWeek: 5, weeks: 28, goal: 'peaking', competitionDate: '2026-12-01' });

  it('buildSeasonSummaryText: пресет/блоки/старт/предупреждения', () => {
    const p = plan();
    const txt = buildSeasonSummaryText(p, { modeLabel: 'Тяжёлая атлетика', competitionDate: '2026-12-01' });
    expect(txt).toContain('СЕЗОН');
    expect(txt).toContain(p.presetLabel);
    expect(txt).toContain('Старт: 2026-12-01');
    expect(txt).toContain('БЛОКИ:');
    for (const l of seasonSummaryLines(p)) expect(txt).toContain(l);
    if (p.warnings.length) expect(txt).toContain('ПРЕДУПРЕЖДЕНИЯ:');
  });

  it('buildSeasonPrintHtml: таблица блоков, таймлайн, XSS-экранирование', () => {
    const p = plan();
    const html = buildSeasonPrintHtml(p, { modeLabel: 'Тяжёлая атлетика', competitionDate: '2026-12-01', startDate: '2026-06-01' });
    expect(html).toContain('<table>');
    expect(html).toContain(p.presetLabel);
    expect(html).toContain('2026-06-01');
    // таймлайн: столько ячеек, сколько недель
    expect((html.match(/title="Нед /g) || []).length).toBe(p.totalWeeks);
    // XSS: подменяем название блока на скрипт — должен быть escaped
    const evil = { ...p, blocks: p.blocks.map((b, i) => (i === 0 ? { ...b, title: '<script>alert(1)</script>' } : b)) };
    const html2 = buildSeasonPrintHtml(evil as any);
    expect(html2).not.toContain('<script>alert(1)</script>');
    expect(html2).toContain('&lt;script&gt;');
  });
});

describe('season-planner: персист сезона', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  it('save/load roundtrip и очистка', () => {
    const p = recommendSeasonPlan({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4, weeks: 20 });
    expect(saveSeasonPlan(p)).toBe(true);
    const loaded = loadSeasonPlan();
    expect(loaded).toBeTruthy();
    expect(loaded!.presetId).toBe(p.presetId);
    expect(loaded!.blocks.length).toBe(p.blocks.length);
    expect(loaded!.totalWeeks).toBe(p.totalWeeks);
    clearSeasonPlan();
    expect(loadSeasonPlan()).toBeNull();
  });

  it('битый стор и невалидная форма → null, save отказывает', () => {
    localStorage.setItem(SS_SEASON_PLAN_KEY, '{битый json');
    expect(loadSeasonPlan()).toBeNull();
    localStorage.setItem(SS_SEASON_PLAN_KEY, JSON.stringify({ presetId: 'x', mode: 'weightlifting', blocks: [{ cycleId: 'a', phase: 'bogus', weeks: 0 }], totalWeeks: 0 }));
    expect(loadSeasonPlan()).toBeNull();
    expect(saveSeasonPlan({ presetId: 'x' } as any)).toBe(false);
  });
});

describe('season-planner: пресет при дате старта', () => {
  it('дата + intermediate → single_peak; новичок с датой → beginner_year + warning', () => {
    expect(recommendSeasonPresetId({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, competitionDate: '2027-01-01' })).toBe('single_peak');
    const b = recommendSeasonPlan({ mode: 'weightlifting', level: 'beginner', daysPerWeek: 4, weeks: 20, competitionDate: '2027-01-01' });
    expect(b.presetId).toBe('beginner_year');
    expect(b.warnings.join(' ')).toMatch(/Новичку пик к дате/);
    expect(b.blocks.some(x => x.phase === 'peak' || x.phase === 'taper')).toBe(false);
  });
});

describe('season-planner: планирование от даты старта', () => {
  it('коридор 4-16 нед → comp_prep и горизонт = недели до старта', () => {
    const p = recommendSeasonPlan({
      mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, weeks: 22,
      goal: 'peaking', competitionDate: '2026-12-01', startDate: '2026-09-01',
    });
    expect(p.presetId).toBe('comp_prep');
    expect(p.requestedWeeks).toBe(13); // 01.09 → 01.12 = 13 недель
    expect(p.rationale.join(' ')).toMatch(/Горизонт от даты старта: 13 нед/);
  });

  it('длинный коридор (>16 нед) → single_peak с горизонтом от даты', () => {
    const p = recommendSeasonPlan({
      mode: 'strongman', level: 'intermediate', daysPerWeek: 4, weeks: 12,
      goal: 'peaking', competitionDate: '2026-07-01', startDate: '2026-01-01',
    });
    expect(p.presetId).toBe('single_peak');
    expect(p.requestedWeeks).toBeGreaterThan(16);
    expect(p.blocks[p.blocks.length - 1].phase).toBe('taper');
  });

  it('очень короткое окно (<8 нед) → честное предупреждение', () => {
    const p = recommendSeasonPlan({
      mode: 'weightlifting', level: 'advanced', daysPerWeek: 5, weeks: 20,
      goal: 'peaking', competitionDate: '2026-10-15', startDate: '2026-10-01',
    });
    expect(p.warnings.join(' ')).toMatch(/очень короткое окно/i);
  });

  it('без даты старта горизонт мастера уважается (дата — только якорь)', () => {
    const p = recommendSeasonPlan({ mode: 'weightlifting', level: 'intermediate', daysPerWeek: 5, weeks: 22, goal: 'peaking', competitionDate: '2026-12-01' });
    expect(p.requestedWeeks).toBe(22);
    expect(p.presetId).toBe('single_peak');
  });
});

describe('season-planner: календарь .ics', () => {
  const plan = () => recommendSeasonPlan({ mode: 'strongman', level: 'intermediate', daysPerWeek: 4, weeks: 20 });

  it('без даты старта — null; с датой — VCALENDAR + VEVENT на блок + соревнование', () => {
    expect(buildSeasonIcs(plan(), { startDate: '' })).toBeNull();
    expect(buildSeasonIcs(plan(), { startDate: 'мусор' })).toBeNull();
    const p = plan();
    const ics = buildSeasonIcs(p, { startDate: '2026-09-07', competitionDate: '2026-12-01', modeLabel: 'Силовой экстрим' });
    expect(ics).toBeTruthy();
    expect(ics!.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics!.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics!.split('\r\n').length).toBeGreaterThan(10);
    const events = (ics!.match(/BEGIN:VEVENT/g) || []).length;
    expect(events).toBe(p.blocks.length + 1); // блоки + соревнование
    expect(ics).toContain('DTSTART;VALUE=DATE:20260907');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261201');
    expect(ics).toContain('SUMMARY:🏁 Соревнование');
  });

  it('экранирование ICS-спецсимволов в названиях', () => {
    const p = plan();
    const evil = { ...p, blocks: p.blocks.map((b, i) => (i === 0 ? { ...b, title: 'A;B,C\\D\nE' } : b)) };
    const ics = buildSeasonIcs(evil as any, { startDate: '2026-09-07' })!;
    expect(ics).toContain('A\\;B\\,C\\\\D\\nE');
    expect(ics).not.toContain('A;B,C\\D\nE');
  });

  it('непрерывные блоки: DTEND предыдущего = DTSTART следующего', () => {
    const p = plan();
    const ics = buildSeasonIcs(p, { startDate: '2026-09-07' })!;
    const starts = [...ics.matchAll(/DTSTART;VALUE=DATE:(\d{8})/g)].map(m => m[1]);
    const ends = [...ics.matchAll(/DTEND;VALUE=DATE:(\d{8})/g)].map(m => m[1]);
    expect(starts.length).toBe(p.blocks.length);
    expect(ends.length).toBe(p.blocks.length);
    for (let i = 1; i < starts.length; i++) expect(starts[i], `блок ${i}`).toBe(ends[i - 1]);
  });
});
