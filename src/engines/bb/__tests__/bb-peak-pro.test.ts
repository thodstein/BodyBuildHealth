/**
 * bb-peak-pro.test.ts — PRO-4 Э2–Э6/Э8/Э9: монитор пик-недели, таймлайн дня,
 * экстренная карточка, серия шоу, женский контур, лабы-чекпоинт, post-show фидбэк.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildBBContestPrepPlan,
  buildContestPrepPrintHtml,
  isoAddDays,
  isoToday,
  type BBContestPrepConfig,
  type BBContestPrepPlan,
} from '../bb-contest-prep.engine';
import {
  PEAK_MONITOR_KEY, PEAK_MONITOR_CAP,
  sanitizePeakDayEntry, loadPeakWeekLog, savePeakWeekEntry, removePeakWeekEntry,
  peakWeekDaysForPlan, peakDayForDate, peakWeekAdherence, peakWeekWeightTrace, peakWeekTrendAdvice,
  buildPeakDayTimeline,
  SHOW_DAY_EMERGENCY, loadEmergencyContact, saveEmergencyContact, sanitizeEmergencyContact, emergencyLines,
  showSequencePlan,
  femalePeakGuidance, cyclePhaseForDay,
  prepLabCheckpoint, loadPrepLabsDate, savePrepLabsDate, PREP_LABS_KEY,
  postShowRecoveryProgress,
  type PeakDayEntry,
} from '../bb-peak-pro.engine';

function baseConfig(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 80,
    bodyFatPct: 7,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 2,
    showDate: isoAddDays(isoToday(), 30),
    weeksOut: 2,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'stable',
    sodiumStrategy: 'stable',
    ...over,
  };
}

function mkPlan(over: Partial<BBContestPrepConfig> = {}): BBContestPrepPlan {
  const p = buildBBContestPrepPlan(baseConfig(over));
  expect(p).toBeTruthy();
  return p;
}

function entry(date: string, over: Partial<PeakDayEntry> = {}): PeakDayEntry {
  return { date, at: new Date().toISOString(), ...over };
}

beforeEach(() => {
  try {
    localStorage.removeItem(PEAK_MONITOR_KEY);
    localStorage.removeItem('he_prep_emergency_v1');
    localStorage.removeItem(PREP_LABS_KEY);
  } catch { /* noop */ }
});

// ── 📓 Монитор: санитизация/CRUD ──
describe('PRO-4 Э2 — монитор: санитизация и CRUD', () => {
  it('мусор → null; поля клампятся', () => {
    expect(sanitizePeakDayEntry(null)).toBeNull();
    expect(sanitizePeakDayEntry({ date: 'not-a-date' })).toBeNull();
    const e = sanitizePeakDayEntry({
      date: '2026-06-01', weightKg: 300, waterLiters: 20, sodiumMg: -5, carbsG: 99999,
      visual: 'banana', wellbeing: 9, note: 'x'.repeat(500), at: 'y'.repeat(100),
    })!;
    expect(e.weightKg).toBeNull();
    expect(e.waterLiters).toBeNull();
    expect(e.sodiumMg).toBeNull();
    expect(e.carbsG).toBeNull();
    expect(e.visual).toBeNull();
    expect(e.wellbeing).toBeNull();
    expect(e.note!.length).toBe(200);
    expect(e.at.length).toBe(40);
  });

  it('save/load roundtrip, merge по дате, кап 14', () => {
    const pid = 'p1';
    expect(savePeakWeekEntry(pid, entry('2026-06-01', { weightKg: 80 }))).toBe(true);
    expect(savePeakWeekEntry(pid, entry('2026-06-01', { weightKg: 79.5 }))).toBe(true); // merge
    expect(savePeakWeekEntry(pid, entry('2026-06-02', { visual: 'ontrack' }))).toBe(true);
    const log = loadPeakWeekLog(pid);
    expect(log.length).toBe(2);
    expect(log[0].weightKg).toBe(79.5);
    // кап
    for (let i = 0; i < 20; i++) savePeakWeekEntry(pid, entry(isoAddDays('2026-06-01', i), { weightKg: 80 }));
    expect(loadPeakWeekLog(pid).length).toBe(PEAK_MONITOR_CAP);
  });

  it('битый стор → []; remove удаляет день', () => {
    localStorage.setItem(PEAK_MONITOR_KEY, 'not json');
    expect(loadPeakWeekLog('p1')).toEqual([]);
    localStorage.setItem(PEAK_MONITOR_KEY, JSON.stringify({ p1: [{ date: '2026-06-01', at: 'x' }] }));
    expect(removePeakWeekEntry('p1', '2026-06-01')).toBe(true);
    expect(loadPeakWeekLog('p1')).toEqual([]);
  });

  it('peakDayForDate: дни пик-недели плана D-6…шоу, вне окна → null', () => {
    const plan = mkPlan();
    const days = peakWeekDaysForPlan(plan);
    expect(days.length).toBe(7);
    expect(peakDayForDate(plan, days[0].date)!.label).toBe('D-6');
    expect(peakDayForDate(plan, plan.showDate)!.label).toBe('шоу-день');
    expect(peakDayForDate(plan, isoAddDays(plan.showDate, 3))).toBeNull();
  });
});

// ── 📓 Монитор: адгеренс/вес/тренд ──
describe('PRO-4 Э2 — адгеренс, вес-трейс, тренд-советы', () => {
  it('адгеренс: флаги under_water/over_sodium/under_carbs и проценты', () => {
    const plan = mkPlan();
    const days = peakWeekDaysForPlan(plan);
    const d1 = days[0]; // деплеция
    const d5 = days[4]; // load (по стратегии moderate: дни 4-5 load)
    const loadDay = days.find(d => d.phase.startsWith('load'))!;
    const entries = [
      entry(d1.date, { waterLiters: 0.5, sodiumMg: d1.sodiumMg * 2 }),
      entry(loadDay.date, { carbsG: 50, waterLiters: loadDay.waterLiters }),
    ];
    const res = peakWeekAdherence(plan, entries);
    expect(res.rows.length).toBe(7);
    expect(res.loggedDays).toBe(2);
    expect(res.flags).toContain('under_water');
    expect(res.flags).toContain('over_sodium');
    expect(res.flags).toContain('under_carbs');
    expect(res.waterPct).not.toBeNull();
    const row = res.rows.find(r => r.date === d1.date)!;
    expect(row.flags).toContain('under_water');
    void d5;
  });

  it('вес-трейс: дельты, просадка >1.5%/день → флаг', () => {
    const t = peakWeekWeightTrace([
      entry('2026-06-01', { weightKg: 80 }),
      entry('2026-06-02', { weightKg: 79.5 }),
      entry('2026-06-03', { weightKg: 78.2 }), // −1.64%
    ]);
    expect(t.points.length).toBe(3);
    expect(t.totalDeltaKg).toBe(-1.8);
    expect(t.maxDailyDropPct).toBeGreaterThan(1.5);
    expect(t.flags).toContain('drop_during_week');
    expect(t.expected).toMatch(/гликоген/);
    expect(peakWeekWeightTrace([]).flags).toContain('no_data');
  });

  it('тренд-советы: no_data / flat×2 (вода) / spill×2 / одиночная точка', () => {
    expect(peakWeekTrendAdvice([]).status).toBe('no_data');
    expect(peakWeekTrendAdvice([
      entry('2026-06-01', { visual: 'flat' }),
      entry('2026-06-02', { visual: 'flat' }),
    ]).status).toBe('flat');
    const flatAdvice = peakWeekTrendAdvice([
      entry('2026-06-01', { visual: 'flat' }),
      entry('2026-06-02', { visual: 'flat' }),
    ]).advice.join(' ');
    expect(flatAdvice).toMatch(/ВОДА/i);
    expect(peakWeekTrendAdvice([
      entry('2026-06-01', { visual: 'spill' }),
      entry('2026-06-02', { visual: 'spill' }),
    ]).status).toBe('spill');
    expect(peakWeekTrendAdvice([entry('2026-06-01', { visual: 'ontrack' })]).status).toBe('on_track');
    // Просадка без визуалов → weight_drop
    expect(peakWeekTrendAdvice([
      entry('2026-06-01', { weightKg: 80 }),
      entry('2026-06-02', { weightKg: 78.2 }),
    ]).status).toBe('weight_drop');
  });
});

// ── ⏱ Таймлайн дня ──
describe('PRO-4 Э3 — часовое расписание дня пик-недели', () => {
  it('обычный день: 6 приёмов, вода по приёмам, сортировка по времени', () => {
    const plan = mkPlan();
    const day = peakWeekDaysForPlan(plan)[0];
    const { items, note } = buildPeakDayTimeline(day);
    expect(items.length).toBeGreaterThanOrEqual(7);
    const times = items.map(i => i.time);
    expect([...times].sort()).toEqual(times);
    expect(items.some(i => /Приём 1\b/.test(i.action))).toBe(true);
    expect(items.filter(i => /Приём/.test(i.action)).length).toBe(6);
    expect(items.some(i => i.action === 'Подъём · взвешивание')).toBe(true);
    expect(items.some(i => /Последняя вода/.test(i.action))).toBe(true);
    expect(note).toMatch(/Клетчатка/);
    const perMealMl = Math.round((day.waterLiters * 1000) / 6 / 10) * 10;
    expect(items.some(i => i.action.includes(`${perMealMl} мл`))).toBe(true);
  });

  it('шоу-день → отсылка к таймлайну шоу; тренировка попадает при не-отдыхе', () => {
    const plan = mkPlan();
    const days = peakWeekDaysForPlan(plan);
    const show = days.find(d => d.phase === 'show')!;
    const showRes = buildPeakDayTimeline(show);
    expect(showRes.items).toEqual([]);
    expect(showRes.note).toMatch(/таймлайн шоу-дня/i);
    const deplete = days.find(d => d.phase.startsWith('deplete') && d.training.type !== 'Отдых');
    if (deplete) {
      expect(buildPeakDayTimeline(deplete).items.some(i => /Тренировка/.test(i.action))).toBe(true);
    }
    // Детерминизм
    expect(JSON.stringify(buildPeakDayTimeline(days[1]))).toBe(JSON.stringify(buildPeakDayTimeline(days[1])));
  });
});

// ── 🚑 Экстренная карточка ──
describe('PRO-4 Э4 — экстренная карточка шоу-дня', () => {
  it('6 сценариев с полным harm-reduction набором', () => {
    expect(SHOW_DAY_EMERGENCY.length).toBe(6);
    for (const s of SHOW_DAY_EMERGENCY) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.signs.length).toBeGreaterThanOrEqual(2);
      expect(s.do.length).toBeGreaterThanOrEqual(2);
      expect(s.dont.length).toBeGreaterThanOrEqual(1);
      expect(s.call.length).toBeGreaterThan(10);
    }
    expect(SHOW_DAY_EMERGENCY.map(s => s.id).join(',')).toContain('hyponatremia');
  });

  it('контакт: save/load, санитизация, пустое → удаление', () => {
    expect(loadEmergencyContact()).toBeNull();
    expect(saveEmergencyContact({ name: 'Тренер', phone: '+7 999 000-00-00' })).toBe(true);
    expect(loadEmergencyContact()!.name).toBe('Тренер');
    expect(sanitizeEmergencyContact({ name: '  ', phone: '' })).toBeNull();
    expect(sanitizeEmergencyContact({ name: 'A'.repeat(100), phone: 'P'.repeat(50) })!.name.length).toBe(60);
    saveEmergencyContact(null);
    expect(loadEmergencyContact()).toBeNull();
  });

  it('emergencyLines: контакт или честная подсказка + все сценарии', () => {
    const lines = emergencyLines();
    expect(lines[0]).toMatch(/Контакт не указан/);
    expect(lines.length).toBe(SHOW_DAY_EMERGENCY.length + 1);
    saveEmergencyContact({ name: 'Врач', phone: '112' });
    expect(emergencyLines()[0]).toMatch(/Врач · 112/);
  });
});

// ── 🏁 Серия шоу ──
describe('PRO-4 Э5 — серия шоу', () => {
  const shows = [
    { id: 'a', name: 'Осенний кубок', date: '2026-10-10', priority: 'A' as const },
    { id: 'b', name: 'Локальный', date: '2026-10-31', priority: 'B' as const },
  ];

  it('окна сортированы, второе шоу в коротком окне → note + warning', () => {
    const seq = showSequencePlan(shows);
    expect(seq.windows.length).toBe(2);
    expect(seq.windows[0].showId).toBe('a');
    expect(seq.windows[0].taperWeeks).toBe(2);
    expect(seq.windows[1].taperWeeks).toBe(1);
    expect(seq.windows[1].note).toMatch(/trial/i);
    expect(seq.warnings.join(' ')).toMatch(/<4 нед|4 нед/);
    expect(seq.overreachDate).toBe(isoAddDays('2026-10-10', -28));
    expect(seq.overreachNote).toBeTruthy();
  });

  it('два A → warning; без дат → честный отказ', () => {
    const seq = showSequencePlan([
      { id: 'a', name: 'A1', date: '2026-10-10', priority: 'A' },
      { id: 'b', name: 'A2', date: '2026-11-20', priority: 'A' },
    ]);
    expect(seq.warnings.join(' ')).toMatch(/приоритета A/);
    const undated = showSequencePlan([{ id: 'x', name: 'Без даты' }]);
    expect(undated.windows).toEqual([]);
    expect(undated.warnings.length).toBeGreaterThan(0);
    expect(showSequencePlan([]).warnings.length).toBeGreaterThan(0);
  });

  it('далёкое второе шоу: полное окно и overreach сохранён', () => {
    const seq = showSequencePlan([
      { id: 'a', name: 'A', date: '2026-10-10', priority: 'A' },
      { id: 'b', name: 'B', date: '2026-12-10', priority: 'B' },
    ]);
    expect(seq.windows[1].taperWeeks).toBe(1); // 2−1 для после-первого шоу
    expect(seq.overreachNote).toMatch(/Overreach-неделя/);
  });
});

// ── 👩 Женский контур ──
describe('PRO-4 Э6 — женский пик-контур', () => {
  it('cyclePhaseForDay: границы фаз 28-дн модели', () => {
    expect(cyclePhaseForDay(1)).toBe('flow');
    expect(cyclePhaseForDay(5)).toBe('flow');
    expect(cyclePhaseForDay(8)).toBe('follicular');
    expect(cyclePhaseForDay(14)).toBe('ovulation');
    expect(cyclePhaseForDay(20)).toBe('luteal');
    expect(cyclePhaseForDay(25)).toBe('late_luteal');
    expect(cyclePhaseForDay(0)).toBeNull();
  });

  it('мужской план → пусто; женский без данных → info о цикле', () => {
    expect(femalePeakGuidance(mkPlan()).notes).toEqual([]);
    const fem = mkPlan({ sex: 'female', category: 'bikini' });
    const g = femalePeakGuidance(fem);
    expect(g.showCycleDay).toBeNull();
    expect(g.notes.some(n => /Нет данных цикла/.test(n.text))).toBe(true);
  });

  it('шоу в дни менструации → warn; в поздней лютеиновой → warn', () => {
    const fem = mkPlan({ sex: 'female', category: 'bikini' });
    const flow = femalePeakGuidance(fem, { lastPeriodStartIso: isoAddDays(fem.showDate, -28) });
    expect(flow.showCycleDay).toBe(1);
    expect(flow.showPhase).toBe('flow');
    expect(flow.notes.some(n => n.severity === 'warn' && /менструации/.test(n.text))).toBe(true);
    const late = femalePeakGuidance(fem, { lastPeriodStartIso: isoAddDays(fem.showDate, -24) });
    expect(late.showPhase).toBe('late_luteal');
    expect(late.notes.some(n => n.severity === 'warn')).toBe(true);
  });

  it('лютеал → info про +0.5–1 кг воды; всегда BIA-оговорка', () => {
    const fem = mkPlan({ sex: 'female', category: 'bikini' });
    const luteal = femalePeakGuidance(fem, { lastPeriodStartIso: isoAddDays(fem.showDate, -20) });
    expect(luteal.showPhase).toBe('luteal');
    expect(luteal.notes.some(n => /0\.5–1 кг воды/.test(n.text))).toBe(true);
    expect(luteal.notes.some(n => /BIA/.test(n.text))).toBe(true);
  });
});

// ── 🧪 Лабы-чекпоинт ──
describe('PRO-4 Э9 — лабы-чекпоинт', () => {
  const show = '2026-10-10';

  it('без даты последних → no_data + честная сводка', () => {
    const res = prepLabCheckpoint(show, null, '2026-08-01');
    expect(res.rows.length).toBe(4);
    expect(res.rows.every(r => r.status === 'no_data')).toBe(true);
    expect(res.summary).toMatch(/не указана/);
  });

  it('свежие анализы закрывают базу/середину, финал ещё planned', () => {
    const res = prepLabCheckpoint(show, '2026-09-06', '2026-09-10');
    expect(res.rows.find(r => r.id === 'baseline')!.status).toBe('done');
    expect(res.rows.find(r => r.id === 'mid')!.status).toBe('done');
    expect(res.rows.find(r => r.id === 'final')!.status).toBe('planned');
  });

  it('устаревшая дата → overdue + сводка с просрочкой', () => {
    const res = prepLabCheckpoint(show, '2026-01-01', '2026-09-10');
    expect(res.rows.filter(r => r.status === 'overdue').length).toBeGreaterThanOrEqual(2);
    expect(res.summary).toMatch(/Просрочено/);
    // soon: дедлайн финала (10 дн до шоу = 2026-09-30) через ≤7 дней от 2026-09-25
    const soon = prepLabCheckpoint(show, '2026-08-05', '2026-09-25');
    expect(soon.rows.find(r => r.id === 'final')!.status).toBe('soon');
  });

  it('persist даты: per-planId, валидация', () => {
    expect(loadPrepLabsDate('p1')).toBeNull();
    expect(savePrepLabsDate('p1', '2026-08-05')).toBe(true);
    expect(loadPrepLabsDate('p1')).toBe('2026-08-05');
    expect(loadPrepLabsDate('p2')).toBeNull();
    savePrepLabsDate('p1', null);
    expect(loadPrepLabsDate('p1')).toBeNull();
    savePrepLabsDate('p1', 'not-a-date');
    expect(loadPrepLabsDate('p1')).toBeNull();
  });
});

// ── 🖨 Печать: extras монитора/emergency ──
describe('PRO-4 — печать prep-сводки с extras', () => {
  it('без extras — секций PRO-4 нет; с extras — обе секции + XSS-esc', () => {
    const plan = mkPlan();
    const base = buildContestPrepPrintHtml(plan);
    expect(base).not.toMatch(/Монитор пик-недели/);
    expect(base).not.toMatch(/Экстренная карточка/);
    const withExtras = buildContestPrepPrintHtml(plan, {
      monitor: ['2026-06-01: вес 80 кг', '<script>alert(1)</script>'],
      emergency: ['Контакт: Тренер · 112'],
    });
    expect(withExtras).toMatch(/Монитор пик-недели/);
    expect(withExtras).toMatch(/Экстренная карточка шоу-дня/);
    expect(withExtras).not.toMatch(/<script>alert\(1\)<\/script>/);
    expect(withExtras).toMatch(/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });
});

// ── 🔄 Пост-шоу фидбэк ──
describe('PRO-4 Э8 — пост-шоу фидбэк', () => {
  const showDate = isoAddDays(isoToday(), -28); // 4 недели назад
  const plan = { showDate, sex: 'male' } as unknown as BBContestPrepPlan;

  it('шоу впереди → not_started', () => {
    const res = postShowRecoveryProgress({ showDate: isoAddDays(isoToday(), 14), sex: 'female' } as any, []);
    expect(res.status).toBe('not_started');
  });

  it('нет записей веса → no_data с советом вести журнал', () => {
    const res = postShowRecoveryProgress(plan, []);
    expect(res.weeksElapsed).toBe(4);
    expect(res.status).toBe('no_data');
    expect(res.advice).toMatch(/вес/i);
  });

  it('on_track: +3% за 4 нед (0.75%/нед)', () => {
    const res = postShowRecoveryProgress(plan, [
      { date: showDate, weight: 80 },
      { date: isoAddDays(showDate, 21), weight: 82.4 },
    ]);
    expect(res.actualRegainPct).toBe(3);
    expect(res.targetRegainPct).toBe(4);
    expect(res.status).toBe('on_track');
  });

  it('faster (>1.6%/нед) и slower (<0.5%/нед) с советами', () => {
    const faster = postShowRecoveryProgress(plan, [
      { date: showDate, weight: 80 },
      { date: isoAddDays(showDate, 21), weight: 86 },
    ]);
    expect(faster.status).toBe('faster');
    expect(faster.advice).toMatch(/калории/i);
    const slower = postShowRecoveryProgress(plan, [
      { date: showDate, weight: 80 },
      { date: isoAddDays(showDate, 21), weight: 81 },
    ]);
    expect(slower.status).toBe('slower');
    expect(slower.advice).toMatch(/adherence|кривой/i);
  });
});
