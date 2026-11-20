/**
 * coach-agenda.engine.test.ts — автоподтягивание контента приложения в планёр.
 *
 * Что важно проверить:
 *  • выбор источников хранится отдельно, битый JSON не ломает чтение;
 *  • каждый источник строится из СВОИХ данных, а не из догадок: нет плана —
 *    нет событий;
 *  • даты событий — локальный календарь и всегда внутри запрошенного диапазона;
 *  • кривые данные одного модуля не роняют весь календарь.
 */
import { describe, expect, it } from 'vitest';
import {
  AGENDA_SOURCES,
  AGENDA_SOURCES_KEY,
  AGENDA_TIME_KEY,
  collectAgenda,
  countAgendaByDate,
  countAgendaBySource,
  defaultAgendaSources,
  groupAgendaByDate,
  isLifestyleSupportId,
  readAgendaSources,
  readAgendaTimeOverrides,
  sanitizeAgendaSources,
  writeAgendaSources,
  writeAgendaTimeOverride,
} from '../coach-agenda.engine';
import { supportNameRu } from '../../../data/support-names';

const MON = '2026-11-02'; // понедельник
const THU = '2026-11-05';
const RANGE = { from: MON, to: '2026-11-15' };

/** Простое хранилище в памяти — тесты не должны зависеть от globalThis. */
function mem(pairs: Record<string, unknown> = {}) {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(pairs)) {
    if (v === undefined) continue; // «ключа нет», а не «null»
    map.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    raw: map,
  };
}

describe('выбор источников', () => {
  it('по умолчанию включены все источники', () => {
    expect(defaultAgendaSources()).toEqual(AGENDA_SOURCES.map(s => s.id));
    expect(readAgendaSources(null)).toEqual(defaultAgendaSources());
    expect(readAgendaSources(mem())).toEqual(defaultAgendaSources());
  });

  it('сохраняет и читает выбор, не пропуская мусор', () => {
    const storage = mem();
    const saved = writeAgendaSources(storage, ['labs', 'bogus' as never, 'training']);
    // Порядок — как в каталоге, а не как пришёл: чипы не прыгают.
    expect(saved).toEqual(['training', 'labs']);
    expect(readAgendaSources(storage)).toEqual(['training', 'labs']);
    expect(JSON.parse(storage.raw.get(AGENDA_SOURCES_KEY) as string)).toEqual({
      version: 1,
      enabled: ['training', 'labs'],
    });
  });

  it('битый JSON/чужая версия → все источники, а не пустой экран', () => {
    expect(readAgendaSources(mem({ [AGENDA_SOURCES_KEY]: 'не json' }))).toEqual(defaultAgendaSources());
    expect(readAgendaSources(mem({ [AGENDA_SOURCES_KEY]: '[1,2,3]' }))).toEqual(defaultAgendaSources());
    expect(readAgendaSources(mem({ [AGENDA_SOURCES_KEY]: { version: 99, enabled: ['labs'] } }))).toEqual(
      defaultAgendaSources(),
    );
  });

  it('sanitize отбрасывает повторы и неизвестные id', () => {
    expect(sanitizeAgendaSources(['labs', 'labs', 'nope', 42])).toEqual(['labs']);
    expect(sanitizeAgendaSources('что-то')).toEqual(defaultAgendaSources());
  });
});

describe('сбор событий', () => {
  const base = {
    he_profile_v2: {
      settings: {
        training: {
          daysPerWeek: 3,
          schedule: {
            enabled: true,
            scheduleType: 'weekly',
            weeklyDays: [true, false, false, true, false, false, false],
            startTime: '18:30',
          },
        },
        pharma: { courseStartDate: '2026-11-09', phase: 'baseline' },
        personal: { weight: 90, sex: 'male' },
      },
    },
    he_pl_runtime: {
      focus: 'Push',
      days: [
        { label: 'День A', exercises: [{ targetSets: [1, 2, 3] }] },
        { label: 'День B', exercises: [{ targetSets: [1] }] },
      ],
    },
    he_injection_schedule: [
      { id: 'inj1', substance: 'Test E', dose: '250', daysOfWeek: [0, 3], active: true },
      { id: 'inj2', substance: 'Старое', dose: '100', daysOfWeek: [0], active: false },
    ],
    he_injection_diary: [{ date: MON, substance: 'Test E' }],
    he_support_plan_result: ['creatine', 'hydration', 'daily_steps'],
    he_support_diary: [{
      date: '2026-11-03',
      substances: { creatine: { taken: true }, hydration: { taken: true } },
    }],
    he_active_cardio_cycle: {
      id: 'cardio1',
      name: 'Кардио-цикл',
      goal: 'health',
      totalWeeks: 2,
      totalKcal: 0,
      source: 'manual',
      version: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
      rationale: [],
      startDate: MON,
      weeks: [
        {
          week: 1, phase: 'base', deload: false, taper: false, rationale: [], totalMinutes: 80, totalKcal: 0,
          sessions: [{
            type: 'zone2', durationMin: 40, weeklyFrequency: 2, intensity: 'low',
            kcalPerSession: 0, purpose: 'Аэробная база',
          }],
        },
        {
          week: 2, phase: 'base', deload: false, taper: false, rationale: [], totalMinutes: 20, totalKcal: 0,
          sessions: [{
            type: 'hiit', durationMin: 20, weeklyFrequency: 1, intensity: 'high',
            kcalPerSession: 0, purpose: 'Интервалы',
          }],
        },
      ],
    },
    he_cardio_sessions: [{ date: MON, durationMin: 40 }],
    he_reminders_v1: { weigh: { enabled: true, time: '07:15' } },
    he_weight_log: [{ date: '2026-11-03', weight: 90 }],
    he_habits: [{
      id: 'water', name: 'Вода 3 л', target: '3 л',
      completions: [{ date: '2026-11-03', done: true, notes: '' }],
    }],
    he_nutrition_active_plan_v1: {
      date: MON,
      weekPlan: {
        days: [
          { meals: [{ type: 'breakfast', label: 'Завтрак', time: '08:00', items: [{ id: 'oats', name: 'Овсянка' }], totals: { kcal: 400 } }] },
          { meals: [{ type: 'lunch', label: 'Обед', time: '13:00', items: [{ id: 'rice', name: 'Рис' }], totals: { kcal: 600 } }] },
        ],
      },
      shoppingList: [
        { id: 'oats', name: 'Овсянка', amount: '1 кг' },
        { id: 'rice', name: 'Рис', amount: '2 кг' },
      ],
    },
    supportCart: [
      { id: 'whey', name: 'Whey', category: 'supplement' },
      { id: 'pharma_test', name: 'Тест', category: 'pharma' },
    ],
  };

  const events = () => collectAgenda(mem(base), { ...RANGE, today: '2026-11-06' });
  const bySource = (id: string) => events().filter(ev => ev.source === id);

  it('инъекции — по дням недели расписания, факт из дневника', () => {
    const rows = bySource('injections');
    expect(rows.map(r => r.date)).toEqual([MON, THU, '2026-11-09', '2026-11-12']);
    expect(rows[0].title).toContain('Test E');
    expect(rows[0].title).toContain('250');
    expect(rows[0].done).toBe(true); // отметка в дневнике инъекций
    expect(rows[1].done).toBe(false);
    // Неактивная схема не подтягивается.
    expect(rows.some(r => r.title.includes('Старое'))).toBe(false);
  });

  it('тренировки — по графику профиля, план дня по кругу', () => {
    const rows = bySource('training');
    expect(rows.map(r => r.date)).toEqual([MON, THU, '2026-11-09', '2026-11-12']);
    expect(rows.every(r => r.time === '18:30')).toBe(true);
    expect(rows[0].title).toContain('День A');
    expect(rows[0].title).toContain('Push');
    expect(rows[0].detail).toContain('3 подх.');
    expect(rows[1].title).toContain('День B');
  });

  it('без плана тренировок тренировочных событий нет (никаких догадок)', () => {
    const withProfileNoRuntime = { ...base, he_pl_runtime: undefined };
    const rows = collectAgenda(mem(withProfileNoRuntime), { ...RANGE, today: '2026-11-06' });
    expect(rows.some(r => r.source === 'training')).toBe(false);
  });

  it('приёмы пищи — по циклу рациона от даты плана', () => {
    const rows = bySource('meals');
    expect(rows.length).toBeGreaterThan(0);
    const mon = rows.filter(r => r.date === MON);
    expect(mon.map(r => r.title)).toContain('Завтрак');
    expect(mon[0].time).toBe('08:00');
    expect(mon[0].detail).toContain('Овсянка');
    expect(mon[0].detail).toContain('400 ккал');
    // 3 ноября — второй день цикла (обед), 4 ноября — снова первый.
    const tue = rows.filter(r => r.date === '2026-11-03');
    expect(tue.map(r => r.title)).toContain('Обед');
    expect(tue[0].time).toBe('13:00');
    const wed = rows.filter(r => r.date === '2026-11-04');
    expect(wed.map(r => r.title)).toContain('Завтрак');
  });

  it('приём БАДов — слоты по времени приёмов, отметка из дневника', () => {
    const rows = bySource('supplements');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].title).toContain('БАДы');
    expect(rows[0].time).toBe('08:00');
    const taken = rows.find(r => r.date === '2026-11-03');
    expect(taken?.done).toBe(true);
    const notTaken = rows.find(r => r.date === MON);
    expect(notTaken?.done).toBe(false);
  });

  it('закупка продуктов — на старте цикла рациона, а не каждый день', () => {
    const rows = bySource('food_shop');
    expect(rows.map(r => r.date)).toEqual([MON, '2026-11-09']);
    expect(rows[0].title).toContain('2 поз.');
    expect(rows[0].detail).toContain('Овсянка');
  });

  it('корзины БАДов и фармы — на ближайший понедельник, не раньше сегодня', () => {
    const supp = bySource('supp_shop');
    expect(supp.map(r => r.date)).toEqual(['2026-11-09']);
    expect(supp[0].title).toContain('1 поз.');
    const pharmaCart = bySource('pharma_shop').filter(r => r.id.includes(':cart'));
    expect(pharmaCart.map(r => r.date)).toEqual(['2026-11-09']);
  });

  it('старт курса и подготовка к нему — от даты старта из профиля', () => {
    const rows = bySource('pharma_shop');
    expect(rows.some(r => r.id.endsWith(':start') && r.date === '2026-11-09')).toBe(true);
    expect(rows.some(r => r.id.endsWith(':prep') && r.date === MON)).toBe(true);
  });

  it('анализы — контрольные точки от старта курса', () => {
    const rows = bySource('labs');
    expect(rows.map(r => r.date)).toContain('2026-11-09'); // неделя 0
    for (const row of rows) expect(row.title).toContain('Анализы');
  });

  it('образ жизни — отдельным источником, а не строкой БАДов', () => {
    expect(isLifestyleSupportId('hydration')).toBe(true);
    expect(isLifestyleSupportId('daily_steps')).toBe(true);
    // Электролиты — минерал, остаются в приёме БАДов.
    expect(isLifestyleSupportId('electrolyte_balance')).toBe(false);
    expect(isLifestyleSupportId('creatine')).toBe(false);

    const supp = bySource('supplements');
    expect(supp.every(r => r.title.startsWith('БАДы'))).toBe(true);
    expect(supp.some(r => r.detail.includes('Водный режим'))).toBe(false);

    const lifestyle = bySource('lifestyle');
    const mon = lifestyle.filter(r => r.date === MON);
    expect(mon.some(r => r.title === supportNameRu('hydration'))).toBe(true);
    expect(mon.some(r => r.title === supportNameRu('daily_steps'))).toBe(true);
    expect(
      lifestyle.find(r => r.date === '2026-11-03' && r.title === supportNameRu('hydration'))?.done,
    ).toBe(true);
    expect(
      lifestyle.find(r => r.date === MON && r.title === supportNameRu('hydration'))?.done,
    ).toBe(false);
  });

  it('кардио — из активного цикла, факт из кардио-журнала', () => {
    const rows = bySource('cardio');
    expect(rows.map(r => r.date)).toEqual([MON, '2026-11-03', '2026-11-09']);
    expect(rows[0].title).toContain('Zone 2');
    expect(rows[0].title).toContain('40 мин');
    expect(rows[0].detail).toContain('Аэробная база');
    expect(rows[0].done).toBe(true);
    expect(rows[1].done).toBe(false);
    expect(rows[2].title).toContain('HIIT');
  });

  it('взвешивание — только если напоминание включено, факт из дневника веса', () => {
    const rows = bySource('weigh');
    expect(rows).toHaveLength(14); // весь диапазон, каждый день
    expect(rows.every(r => r.time === '07:15')).toBe(true);
    expect(rows.find(r => r.date === '2026-11-03')?.done).toBe(true);
    expect(rows.find(r => r.date === MON)?.done).toBe(false);

    const off = { ...base, he_reminders_v1: { weigh: { enabled: false, time: '07:15' } } };
    expect(
      collectAgenda(mem(off), { ...RANGE, today: '2026-11-06', sources: ['weigh'] }),
    ).toEqual([]);
  });

  it('привычки — ежедневные пункты с фактом из completions', () => {
    const rows = bySource('habits');
    expect(rows).toHaveLength(14);
    expect(rows[0]).toMatchObject({ title: 'Вода 3 л', detail: '3 л' });
    expect(rows.find(r => r.date === '2026-11-03')?.done).toBe(true);
    expect(rows.find(r => r.date === MON)?.done).toBe(false);
  });

  it('все даты в диапазоне и в календарном формате', () => {
    for (const ev of events()) {
      expect(ev.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ev.date >= RANGE.from && ev.date <= RANGE.to).toBe(true);
    }
  });

  it('выключенный источник не подтягивается', () => {
    const rows = collectAgenda(mem(base), { ...RANGE, today: '2026-11-06', sources: ['injections'] });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.source === 'injections')).toBe(true);
    expect(collectAgenda(mem(base), { ...RANGE, today: '2026-11-06', sources: [] })).toEqual([]);
  });

  it('считает события по дням и источникам', () => {
    const rows = events();
    const byDate = countAgendaByDate(rows);
    const grouped = groupAgendaByDate(rows);
    expect(byDate[MON]).toBe(grouped[MON].length);
    expect(byDate[MON]).toBeGreaterThan(0);
    const bySrc = countAgendaBySource(rows);
    for (const src of AGENDA_SOURCES) expect(bySrc[src.id]).toBe(rows.filter(r => r.source === src.id).length);
  });

  it('битые/чужие данные не роняют календарь', () => {
    const broken = {
      he_profile_v2: '[]',
      he_pl_runtime: 'null',
      he_injection_schedule: { not: 'array' },
      he_injection_diary: '[null, 42]',
      he_support_plan_result: { id: 'x' },
      he_support_diary: 'not json',
      he_nutrition_active_plan_v1: '[]',
      supportCart: '[{"id":1}]',
    };
    let rows: ReturnType<typeof collectAgenda> = [];
    expect(() => {
      rows = collectAgenda(mem(broken), { ...RANGE, today: '2026-11-06' });
    }).not.toThrow();
    expect(rows).toEqual([]);
  });

  it('пустое хранилище — пустой календарь без ошибок', () => {
    expect(collectAgenda(mem(), { ...RANGE })).toEqual([]);
    expect(collectAgenda(null, { ...RANGE })).toEqual([]);
  });

  it('без активного плана берёт сохранённый рацион (старый ключ)', () => {
    const storage = mem({
      he_saved_nutrition_plans: [
        {
          id: 1,
          date: MON,
          dayPlan: {
            meals: [{ type: 'breakfast', label: 'Завтрак', time: '08:00', items: [{ id: 'eggs', name: 'Яйца' }] }],
          },
        },
      ],
    });
    const rows = collectAgenda(storage, { ...RANGE, today: '2026-11-06', sources: ['meals'] });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].title).toBe('Завтрак');
    expect(rows[0].detail).toContain('Яйца');
  });

  it('порядок событий: дата, затем время', () => {
    const rows = events();
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      const ka = `${a.date} ${a.time || '99:99'}`;
      const kb = `${b.date} ${b.time || '99:99'}`;
      expect(ka <= kb).toBe(true);
    }
  });

  describe('время авто-событий', () => {
    const withOverride = (time: string) =>
      mem({
        ...base,
        [AGENDA_TIME_KEY]: {
          version: 1,
          times: { [`agenda:training:${MON}`]: time },
        },
      });

    it('поправка применяется поверх источника и сортирует день', () => {
      const storage = mem({
        ...base,
        [AGENDA_TIME_KEY]: {
          version: 1,
          times: { [`agenda:injections:0:${MON}`]: '05:00' },
        },
      });
      const rows = collectAgenda(storage, { ...RANGE, today: '2026-11-06', sources: ['training', 'injections'] });
      const mon = rows.filter(r => r.date === MON);
      // Инъекция без времени была «на весь день» — после правки встала в 05:00.
      expect(mon[0].id).toBe(`agenda:injections:0:${MON}`);
      expect(mon[0].time).toBe('05:00');
      expect(mon[1].time).toBe('18:30');
    });

    it('сброс возвращает время источника', () => {
      const storage = withOverride('06:00');
      expect(readAgendaTimeOverrides(storage)['agenda:training:2026-11-02']).toBe('06:00');
      const left = writeAgendaTimeOverride(storage, `agenda:training:${MON}`, null);
      expect(left[`agenda:training:${MON}`]).toBeUndefined();
      const rows = collectAgenda(storage, { ...RANGE, today: '2026-11-06', sources: ['training'] });
      expect(rows.find(r => r.id === `agenda:training:${MON}`)?.time).toBe('18:30');
    });

    it('битое/чужое время поправкой не считается', () => {
      expect(readAgendaTimeOverrides(withOverride('99:99'))).toEqual({});
      expect(readAgendaTimeOverrides(mem({ [AGENDA_TIME_KEY]: '{не json' }))).toEqual({});
      const rows = collectAgenda(withOverride('99:99'), { ...RANGE, today: '2026-11-06', sources: ['training'] });
      expect(rows.find(r => r.id === `agenda:training:${MON}`)?.time).toBe('18:30');
    });

    it('пишет в хранилище формат v1 (id → время)', () => {
      const storage = mem();
      writeAgendaTimeOverride(storage, 'agenda:training:2026-11-02', '06:00');
      const saved = JSON.parse(storage.raw.get(AGENDA_TIME_KEY) as string);
      expect(saved).toEqual({ version: 1, times: { 'agenda:training:2026-11-02': '06:00' } });
    });
  });
});
