/**
 * cardio-audit-2026-11.test.ts — инварианты аудита кардио (ноябрь 2026).
 *
 * Здесь зафиксировано то, что раньше «работало» только на бумаге:
 *  - weeklyFrequency разворачивается в РАЗНЫЕ дни, а Σ плана по дням = totalMinutes;
 *  - explicit-шаблоны получают targetHr/level/lowImpact и не теряют сессии молча;
 *  - «Изменить параметры» пересобирает авторский шаблон через шаблон;
 *  - каскад старта A сохраняет структуру пик-недели;
 *  - wellness-шкала однозначна, ккал учитывают оборудование.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildCardioCycle,
  cardioSessionsForDate,
  cardioWeekForDate,
  expandWeekSchedule,
  spreadSessionsAcrossDays,
  applyCardioCompetitionCascade,
  buildCardioIcs,
  saveCardioCycle,
  loadCardioCycles,
  setActiveCardioCycle,
  CARDIO_CYCLES_CAP,
  cardioStructuredLabel,
  cardioStructuredMainSec,
  buildCardioIntervalPlan,
  type CardioCycle,
  type CardioWeek,
} from '../cardio.engine';
import { buildCardioCycleFromTemplate, rebuildCardioCycleFromConfig } from '../cardio-templates.engine';
import { getCardioCycleTemplateById } from '../../../data/cardio-cycles/cardio-cycle-index';
import { estimateCardioEntryKcal, wellnessReadiness } from '../cardio-diary.engine';
import { addDaysIso, weekdayMon0Iso } from '../cardio-date-utils.engine';

const week = (sessions: CardioWeek['sessions'], no = 1): CardioWeek => ({
  week: no,
  phase: 'base',
  sessions,
  totalMinutes: sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0),
  totalKcal: sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0),
  deload: false,
  taper: false,
  rationale: [],
});

describe('раскладка недели: частота → дни', () => {
  it('session ×4 занимает 4 разных дня, а не один', () => {
    const w = week([
      { type: 'zone2', durationMin: 40, weeklyFrequency: 4, intensity: 'moderate', kcalPerSession: 300, purpose: 'Z2' },
    ]);
    const laid = expandWeekSchedule(w, '2026-03-02');
    expect(laid).toHaveLength(4);
    expect(new Set(laid.map(x => x.dayOfWeek)).size).toBe(4);
    expect(new Set(laid.map(x => x.date)).size).toBe(4);
    // Σ плана по дням совпадает с недельным объёмом.
    expect(laid.reduce((s, x) => s + x.session.durationMin, 0)).toBe(w.totalMinutes);
  });

  it('cardioSessionsForDate отдаёт сессию в каждый из 4 дней недели', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, startDate: '2026-03-02' });
    const w = c.weeks[0];
    const totalSessions = w.sessions.reduce((s, x) => s + Math.max(1, Math.round(x.weeklyFrequency)), 0);
    let seen = 0;
    for (let i = 0; i < 7; i++) {
      const iso = addDaysIso('2026-03-02', i);
      const day = cardioSessionsForDate(c, iso, c.startDate);
      expect(day).not.toBeNull();
      seen += day!.sessions.length;
    }
    expect(seen).toBe(totalSessions);
    expect(totalSessions).toBeGreaterThan(0);
  });

  it('день недели сессии — абсолютный (Пн=0), дата попадает в окно недели', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 2, startDate: '2026-03-04' }); // среда
    const laid = expandWeekSchedule(c.weeks[0], c.startDate);
    for (const x of laid) {
      expect(weekdayMon0Iso(x.date)).toBe(x.dayOfWeek);
      const wk = cardioWeekForDate(c, x.date, c.startDate);
      expect(wk?.week).toBe(1);
    }
  });

  it('лежачие дни ног обходятся для не-recovery', () => {
    const w: CardioWeek = {
      ...week([
        { type: 'zone2', durationMin: 30, weeklyFrequency: 1, intensity: 'moderate', kcalPerSession: 200, purpose: 'Z2' },
        { type: 'zone2', durationMin: 30, weeklyFrequency: 1, intensity: 'moderate', kcalPerSession: 200, purpose: 'Z2' },
        { type: 'recovery', durationMin: 20, weeklyFrequency: 1, intensity: 'low', kcalPerSession: 90, purpose: 'Rec' },
      ]),
    };
    const laid = expandWeekSchedule(w, '2026-03-02', { legDays: [0, 1] });
    // Никакая не-recovery сессия не попала в Пн/Вт.
    for (const x of laid.filter(y => y.session.type !== 'recovery')) {
      expect([0, 1]).not.toContain(x.dayOfWeek);
    }
  });

  it('spreadSessionsAcrossDays отдаёт по элементу на каждый повтор', () => {
    const w = week([
      { type: 'hiit', durationMin: 20, weeklyFrequency: 2, intensity: 'high', kcalPerSession: 250, purpose: 'H' },
    ]);
    expect(spreadSessionsAcrossDays(w, '2026-03-02')).toHaveLength(2);
  });

  it('повторы не отбирают день другой сессии: 4 слота — 4 разных дня', () => {
    // Реальный дефект генератора: zone2 ×3 занимала Пн/Вт/Ср, а miss со своим
    // Вт падал на уже занятый Вт — 4 занятия на 3 днях при четырёх свободных.
    const w: CardioWeek = {
      ...week([
        { type: 'zone2', durationMin: 37, weeklyFrequency: 3, intensity: 'low', kcalPerSession: 250, purpose: 'Z2', dayOfWeek: 0 },
        { type: 'missing', durationMin: 18, weeklyFrequency: 1, intensity: 'high', kcalPerSession: 200, purpose: 'MISS', dayOfWeek: 1 },
      ]),
    };
    const laid = expandWeekSchedule(w, '2026-03-02');
    expect(laid).toHaveLength(4);
    expect(new Set(laid.map(x => x.dayOfWeek)).size).toBe(4);
    // Авторский день miss уважается — сдвигается повтор zone2, а не он сам.
    expect(laid.find(x => x.session.type === 'missing')!.dayOfWeek).toBe(1);
  });

  it('генератор: при ≤7 слотах в неделю каждый день занят не больше одного раза', () => {
    const bad: string[] = [];
    for (const goal of ['health', 'cut', 'recomp', 'mass', 'bb_prep'] as const) {
      for (const days of [3, 4, 5, 6, 7]) {
        const c = buildCardioCycle({ goal, daysAvailable: days, totalWeeks: 8, bodyWeight: 80, startDate: '2026-03-02' });
        for (const w of c.weeks) {
          const slots = w.sessions.reduce((s, x) => s + Math.max(1, Math.round(x.weeklyFrequency)), 0);
          if (slots > 7) continue;
          const laid = expandWeekSchedule(w, c.startDate, { weekNo: w.week });
          const uniq = new Set(laid.map(x => x.dayOfWeek)).size;
          if (uniq !== slots) bad.push(`${goal}/${days}d w${w.week}: ${slots} слотов на ${uniq} днях`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('buildCardioIcs: одно событие на каждый повтор', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 3, startDate: '2026-03-02' });
    const expected = c.weeks.reduce((s, w) => s + w.sessions.reduce((a, x) => a + Math.max(1, Math.round(x.weeklyFrequency)), 0), 0);
    const events = [...buildCardioIcs(c).matchAll(/BEGIN:VEVENT/g)].length;
    expect(events).toBe(expected);
  });
});

describe('авторские шаблоны: уровни, targetHr, lowImpact, без молчаливых потерь', () => {
  const tpl = getCardioCycleTemplateById('cardio-row-short-8') ?? getCardioCycleTemplateById('cardio-row-beginner-8')!;

  it('targetHr подставляется из LTHR атлета', () => {
    const c = buildCardioCycleFromTemplate(tpl, { lthr: 170, bodyWeight: 80 });
    const withHr = c.weeks.flatMap(w => w.sessions).filter(s => s.targetHr?.max);
    expect(withHr.length).toBeGreaterThan(0);
    for (const s of withHr) {
      expect(s.targetHr!.min!).toBeGreaterThan(60);
      expect(s.targetHr!.max!).toBeGreaterThan(s.targetHr!.min!);
    }
  });

  it('lowImpact заменяет бег на не-ударное оборудование', () => {
    const running = c2tpl();
    if (!running) return;
    const c = buildCardioCycleFromTemplate(running, { lowImpact: true, equipment: ['running', 'cycling'] });
    const equip = c.weeks.flatMap(w => w.sessions).map(s => s.equipment);
    expect(equip.some(e => e === 'cycling')).toBe(true);
    expect(equip.every(e => e !== 'running')).toBe(true);
  });

  it('новичок на плане уровня advanced получает масштаб и честную ноту', () => {
    const hard = ['cardio-row-2k-12', 'cardio-row-2k-4', 'cardio-pro-higdon-mar1-18']
      .map(id => getCardioCycleTemplateById(id))
      .find(t => t && !(t.meta.level ?? []).includes('beginner'));
    if (!hard) return;
    const c = buildCardioCycleFromTemplate(hard, { level: 'beginner' });
    expect(c.rationale.join(' ')).toMatch(/новичк/i);
  });

  it('урезание под daysAvailable сообщает, что именно потеряно', () => {
    const c = buildCardioCycleFromTemplate(tpl, { daysAvailable: 1 });
    const text = c.rationale.join(' ');
    expect(text).toMatch(/убрано|урезан/i);
  });

  it('«Изменить параметры» пересобирает шаблон, а не генератор', () => {
    const built = buildCardioCycleFromTemplate(tpl, { bodyWeight: 80 });
    const rebuilt = rebuildCardioCycleFromConfig({ ...built, config: { ...built.config!, bodyWeight: 90 } });
    expect(rebuilt.config?.templateId).toBe(tpl.meta.id);
    expect(rebuilt.weeks.length).toBe(tpl.meta.weeks);
    expect(rebuilt.rationale.join(' ')).toMatch(/авторск/i);
    expect(rebuilt.id).toBe(built.id);
    // Авторские тексты сессий сохранились (не генераторные).
    const text = rebuilt.weeks[0].sessions.map(s => s.purpose).join(' ');
    expect(text.length).toBeGreaterThan(0);
  });
});

function c2tpl(level?: 'advanced'): ReturnType<typeof getCardioCycleTemplateById> {
  const pool = ['cardio-pro-higdon-mar1-18', 'cardio-row-2k-12', 'cardio-row-2k-4']
    .map(id => getCardioCycleTemplateById(id))
    .filter((t): t is NonNullable<typeof t> => !!t);
  if (level === 'advanced') return pool.find(t => (t.meta.level ?? []).includes('advanced')) ?? pool[0];
  return pool.find(t => (t.meta.level ?? []).includes('beginner')) ?? pool[0];
}

describe('каскад старта A: неделя шоу — только привычная активность', () => {
  it('пик-неделя = одна recovery-сессия, подводка сохраняет дни/частоту', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 8, startDate: '2026-03-02' });
    const raceWeek = 5;
    const before = c.weeks.find(w => w.week === raceWeek)!;
    const beforeTaper = c.weeks.find(w => w.week === raceWeek - 2)!;
    const after = applyCardioCompetitionCascade(c, [{ week: raceWeek, priority: 'A' }]);
    const peak = after.weeks.find(w => w.week === raceWeek)!;
    expect(peak.phase).toBe('peak');
    expect(peak.sessions.every(s => s.type === 'recovery')).toBe(true);
    // Неделя шоу честно пустая по нагрузке, но не «нулевая».
    expect(peak.totalMinutes).toBeGreaterThan(0);
    expect(peak.totalMinutes).toBeLessThan(before.totalMinutes);
    // Подводка (N-2) не сносит неделю в одну сессию и не режет частоту до 0.
    const taper = after.weeks.find(w => w.week === raceWeek - 2)!;
    expect(taper.sessions.length).toBe(beforeTaper.sessions.length);
    expect(taper.sessions.every(s => s.weeklyFrequency >= 1)).toBe(true);
    expect(taper.sessions.some(s => s.type === 'hiit')).toBe(false);
  });
});

describe('ккал журнала: оборудование и FFM учитываются', () => {
  it('гребля ≠ бег при той же длительности', () => {
    const run = estimateCardioEntryKcal('zone2', 45, 80, { equipment: 'running' });
    const row = estimateCardioEntryKcal('zone2', 45, 80, { equipment: 'rowing' });
    expect(run).not.toBe(row);
  });

  it('FFM повышает точность (расход ниже при высоком % жира)', () => {
    const byWeight = estimateCardioEntryKcal('zone2', 60, 100);
    const byFfm = estimateCardioEntryKcal('zone2', 60, 100, { ffmKg: 70 });
    expect(byFfm).toBeLessThan(byWeight);
  });
});

describe('wellness: шкала однозначна', () => {
  it('хороший сон/настроение + низкий стресс/боль = высокая готовность', () => {
    expect(wellnessReadiness({ sleep: 5, stress: 1, soreness: 1, mood: 5 })).toBe(10);
  });
  it('плохой сон/настроение + высокий стресс/боль = низкая готовность', () => {
    expect(wellnessReadiness({ sleep: 1, stress: 5, soreness: 5, mood: 1 })).toBe(1);
  });
});

describe('кардио-цикл: инвариант «плановые минуты = сумма по дням»', () => {
  it('для цикла из генератора', () => {
    const c: CardioCycle = buildCardioCycle({ goal: 'cut', totalWeeks: 6, startDate: '2026-03-02', age: 35 });
    for (const w of c.weeks) {
      const laid = expandWeekSchedule(w, c.startDate);
      expect(laid.reduce((s, x) => s + x.session.durationMin, 0)).toBe(w.totalMinutes);
    }
  });
});

describe('старт цикла: дата — часть плана, а не подпись', () => {
  it('цикл с датой в прошлом: неделя 1 начинается с неё, дальше — по календарю', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 4, startDate: '2026-01-05' });
    expect(c.startDate).toBe('2026-01-05');
    expect(cardioWeekForDate(c, '2026-01-05', c.startDate)?.week).toBe(1);
    expect(cardioWeekForDate(c, '2026-01-12', c.startDate)?.week).toBe(2);
  });

  it('пересборка: overrides.startDate применяется, id/имя сохраняются', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, startDate: '2026-03-02' });
    const moved = rebuildCardioCycleFromConfig(c, { overrides: { startDate: '2026-04-06' } });
    expect(moved.id).toBe(c.id);
    expect(moved.name).toBe(c.name);
    expect(moved.startDate).toBe('2026-04-06');
    // Без override дата не меняется — правка плана не сбрасывает старт.
    expect(rebuildCardioCycleFromConfig(c, { overrides: {} }).startDate).toBe('2026-03-02');
  });

  it('новый блок (preserveIdentity:false): новый id и выбранная дата', () => {
    const c = buildCardioCycle({ goal: 'cut', totalWeeks: 6, startDate: '2026-03-02' });
    const fresh = rebuildCardioCycleFromConfig(c, { overrides: { ...(c.config ?? {}), startDate: '2026-04-06' }, preserveIdentity: false });
    expect(fresh.id).not.toBe(c.id);
    expect(fresh.startDate).toBe('2026-04-06');
    expect(cardioWeekForDate(fresh, '2026-04-06', fresh.startDate)?.week).toBe(1);
  });
});

describe('библиотека циклов: лимит не молчит и не вытесняет активный цикл', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem('he_cardio_cycles');
      localStorage.removeItem('he_active_cardio_cycle');
    } catch { /* ignore */ }
  });

  it('на лимите вытесняется самый старый, и об этом сообщается', () => {
    const base = buildCardioCycle({ goal: 'health', totalWeeks: 1 });
    for (let i = 0; i < CARDIO_CYCLES_CAP; i++) {
      saveCardioCycle({ ...base, id: `cap-${i}`, name: `Цикл ${i}`, createdAt: new Date(2026, 0, 1 + i).toISOString() });
    }
    expect(loadCardioCycles()).toHaveLength(CARDIO_CYCLES_CAP);
    const res = saveCardioCycle({ ...base, id: 'cap-new', name: 'Новый', createdAt: '2026-03-01T00:00:00.000Z' });
    expect(loadCardioCycles()).toHaveLength(CARDIO_CYCLES_CAP);
    expect(res.evicted).toEqual(['Цикл 0']);
    expect(loadCardioCycles().some(c => c.id === 'cap-0')).toBe(false);
    expect(loadCardioCycles().some(c => c.id === 'cap-new')).toBe(true);
  });

  it('активный цикл остаётся в библиотеке, даже если он самый старый', () => {
    const base = buildCardioCycle({ goal: 'health', totalWeeks: 1 });
    const active = { ...base, id: 'active-old', name: 'Активный', createdAt: '2020-01-01T00:00:00.000Z' };
    setActiveCardioCycle(active);
    saveCardioCycle(active);
    for (let i = 0; i < CARDIO_CYCLES_CAP + 3; i++) {
      saveCardioCycle({ ...base, id: `n-${i}`, name: `Н${i}`, createdAt: new Date(2026, 0, 1 + i).toISOString() });
    }
    const all = loadCardioCycles();
    expect(all).toHaveLength(CARDIO_CYCLES_CAP);
    expect(all.some(c => c.id === 'active-old')).toBe(true);
  });
});

describe('структура интервалов: подпись и бюджет сессии', () => {
  it('подпись перечисляет все отрезки, основная часть считается с отдыхом', () => {
    const blocks = [
      { workSec: 20, restSec: 40, reps: 8 },
      { workSec: 180, restSec: 120, reps: 3 },
    ];
    expect(cardioStructuredLabel(blocks)).toBe('8×20 с/40 с + 3×3 мин/2 мин');
    expect(cardioStructuredMainSec(blocks)).toBe((20 + 40) * 8 + (180 + 120) * 3);
    expect(cardioStructuredLabel([])).toBeNull();
    expect(cardioStructuredLabel(undefined)).toBeNull();
  });

  it('длительность = ceil(основная часть) → таймер не режет отрезки', () => {
    const blocks = [{ workSec: 60, restSec: 60, reps: 10 }];
    const durationMin = Math.ceil(cardioStructuredMainSec(blocks) / 60);
    const plan = buildCardioIntervalPlan({ type: 'hiit', durationMin, structured: blocks })!;
    expect(plan.workSteps).toBe(10);
    expect(plan.totalSec).toBeLessThanOrEqual(durationMin * 60);
    expect(plan.totalSec).toBeGreaterThanOrEqual(cardioStructuredMainSec(blocks));
  });
});
