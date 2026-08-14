/**
 * Тесты движка ментального протокола дневника тренировок.
 * Покрытие: библиотека ритуалов, пресеты, CRUD, санитизация, тип дня,
 * чек-ины, тренды, приверженность, корреляция с e1RM, инсайты, day progress.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  RITUAL_LIBRARY, KIND_ORDER, KIND_LABELS, DAYTYPE_LABELS, DIRECTION_LABELS,
  buildPresetProtocol, getRitualById, ritualToItem,
  detectDayType, itemsForDay,
  loadProtocols, saveProtocols, createProtocol, upsertProtocol, deleteProtocol, duplicateProtocol,
  loadActiveProtocol, setActiveProtocol,
  sanitizeProtocol, sanitizeItem, sanitizeCheckin,
  loadCheckins, upsertCheckin, latestCheckin, checkinForSession,
  mindsetTrends, protocolAdherence,
  sessionsBestE1RM, correlateConfidenceWithPerformance,
  buildMindsetInsights,
  loadDayProgress, saveDayProgress, exportMindsetCheckinsCSV,
  MINDSET_PROTOCOLS_KEY, MINDSET_ACTIVE_KEY, MINDSET_CHECKS_KEY, MINDSET_DAY_PROGRESS_KEY,
  type MindsetProtocol, type ProtocolItem, type MindsetCheckin,
} from '../mindset-protocol.engine';

const now = () => new Date().toISOString();

describe('Библиотека ритуалов', () => {
  it('содержит ритуалы всех трёх kind и упорядоченные KIND_ORDER', () => {
    expect(RITUAL_LIBRARY.length).toBeGreaterThanOrEqual(12);
    for (const r of RITUAL_LIBRARY) {
      expect(KIND_ORDER).toContain(r.kind);
      expect(r.title.trim().length).toBeGreaterThan(0);
      expect(r.script.trim().length).toBeGreaterThan(0);
      expect(r.durationMin).toBeGreaterThanOrEqual(0);
      expect(r.targetDays.length).toBeGreaterThan(0);
    }
  });
  it('имеет уникальные id', () => {
    const ids = RITUAL_LIBRARY.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('содержит ритуалы под каждый тип дня', () => {
    const days = new Set<string>();
    RITUAL_LIBRARY.forEach(r => r.targetDays.forEach(d => days.add(d)));
    for (const d of ['all', 'heavy', 'pump', 'competition', 'deload'] as const) {
      expect(days.has(d)).toBe(true);
    }
  });
  it('getRitualById находит и возвращает null для неизвестного', () => {
    expect(getRitualById('goal_today')?.kind).toBe('pre');
    expect(getRitualById('не_существует')).toBeNull();
  });
  it('ritualToItem создаёт копию с новым id и сохраняет поля', () => {
    const src = getRitualById('viz_approach')!;
    const item = ritualToItem(src);
    expect(item.id).not.toBe(src.id);
    expect(item.title).toBe(src.title);
    expect(item.script).toBe(src.script);
    expect(item.targetDays).toEqual(src.targetDays);
    expect(item.sourceMethod).toBe(src.sourceMethod);
    // мутация копии не трогает библиотеку
    item.targetDays.push('deload');
    expect(src.targetDays).not.toContain('deload');
  });
});

describe('Пресеты', () => {
  it('ПЛ-пресет содержит активацию/визуализацию/ритуалы и direction=pl', () => {
    const p = buildPresetProtocol('pl');
    expect(p.direction).toBe('pl');
    const titles = p.items.map(i => i.title);
    expect(titles).toContain('Активация перед тяжёлым весом');
    expect(titles).toContain('Визуализация подхода (90 сек)');
    expect(titles).toContain('Личный ритуал-якорь');
    expect(titles).toContain('Рефлексия: 3 вопроса');
  });
  it('ББ-пресет содержит MMC/образ и direction=bb', () => {
    const p = buildPresetProtocol('bb');
    expect(p.direction).toBe('bb');
    const titles = p.items.map(i => i.title);
    expect(titles).toContain('MMC-установка перед рабочим сетом');
    expect(titles).toContain('Позирование / ментальный образ');
    expect(titles).not.toContain('Соревновательная симуляция');
  });
  it('универсал содержит цели/дыхание/рефлексию без специфики', () => {
    const p = buildPresetProtocol('both');
    expect(p.direction).toBe('both');
    const titles = p.items.map(i => i.title);
    expect(titles).toContain('Цель на сегодня');
    expect(titles).toContain('Фиксация победы');
    expect(titles).not.toContain('Активация перед тяжёлым весом');
    expect(titles).not.toContain('Позирование / ментальный образ');
  });
  it('пресеты дают уникальные id на каждый вызов', () => {
    expect(buildPresetProtocol('pl').id).not.toBe(buildPresetProtocol('pl').id);
  });
});

describe('Определение типа дня', () => {
  it('competition по ключевым словам', () => {
    expect(detectDayType('Соревновательная проходка')).toBe('competition');
    expect(detectDayType('Competition day')).toBe('competition');
    expect(detectDayType('Пик недели')).toBe('competition');
  });
  it('deload по ключевым словам', () => {
    expect(detectDayType('Делод')).toBe('deload');
    expect(detectDayType('Разгрузка — восстановление')).toBe('deload');
  });
  it('pump по ключевым словам и track=bb', () => {
    expect(detectDayType('Памповый день')).toBe('pump');
    expect(detectDayType('Гипертрофия: объём')).toBe('pump');
    expect(detectDayType('Обычный день', 'bb')).toBe('pump');
  });
  it('heavy по ключевым словам и track=pl', () => {
    expect(detectDayType('Тяжёлый жим')).toBe('heavy');
    expect(detectDayType('Силовая: присед+тяга')).toBe('heavy');
    expect(detectDayType('Обычный день', 'pl')).toBe('heavy');
  });
  it('all как fallback', () => {
    expect(detectDayType('День 1')).toBe('all');
    expect(detectDayType('')).toBe('all');
  });
  it('competition имеет приоритет над deload', () => {
    expect(detectDayType('Пик — разгрузка перед соревнованием')).toBe('competition');
  });
});

describe('itemsForDay', () => {
  const mkItem = (kind: ProtocolItem['kind'], days: ProtocolItem['targetDays']): ProtocolItem => ({
    id: `t_${kind}_${days.join('')}`, kind, title: kind, script: 's', durationMin: 1, targetDays: days,
  });
  const proto: MindsetProtocol = {
    id: 'p1', name: 'тест', direction: 'both', createdAt: now(), updatedAt: now(),
    items: [
      mkItem('post', ['all']),
      mkItem('pre', ['all']),
      mkItem('approach', ['heavy']),
      mkItem('pre', ['pump']),
      mkItem('approach', ['competition', 'heavy']),
    ],
  };
  it('null-протокол → пусто', () => {
    expect(itemsForDay(null, 'heavy')).toEqual([]);
  });
  it('тяжёлый день: all + heavy, порядок pre→approach→post', () => {
    const res = itemsForDay(proto, 'heavy');
    expect(res.map(i => i.id)).toEqual(['t_pre_all', 't_approach_heavy', 't_approach_competitionheavy', 't_post_all']);
    const kinds = res.map(i => i.kind);
    expect(kinds).toEqual(['pre', 'approach', 'approach', 'post']);
  });
  it('памповый день: all + pump', () => {
    const res = itemsForDay(proto, 'pump');
    expect(res.map(i => i.id)).toEqual(['t_pre_all', 't_pre_pump', 't_post_all']);
  });
  it('день all показывает все шаги', () => {
    expect(itemsForDay(proto, 'all').length).toBe(5);
  });
  it('битые items отфильтровываются', () => {
    const broken = { ...proto, items: [null, mkItem('pre', ['all'])] as any };
    expect(itemsForDay(broken, 'heavy').length).toBe(1);
  });
});

describe('Санитизация', () => {
  it('sanitizeItem отбрасывает мусор и чинит targetDays', () => {
    expect(sanitizeItem(null)).toBeNull();
    expect(sanitizeItem({ title: '' })).toBeNull();
    const ok = sanitizeItem({ id: 'x', kind: 'bogus', title: 'Т', durationMin: -5, targetDays: ['heavy', 'bogus'] });
    expect(ok!.kind).toBe('pre');
    expect(ok!.targetDays).toEqual(['heavy']);
    expect(ok!.durationMin).toBe(1);
  });
  it('sanitizeProtocol чинит direction/items/даты', () => {
    expect(sanitizeProtocol({})).toBeNull();
    expect(sanitizeProtocol({ name: '' })).toBeNull();
    const p = sanitizeProtocol({ name: 'n', direction: 'nope', items: [{ title: 't' }] });
    expect(p!.direction).toBe('both');
    expect(p!.items.length).toBe(1);
    expect(p!.createdAt).toBeTruthy();
  });
  it('sanitizeCheckin валидирует дату и зажимает шкалы 1-5', () => {
    expect(sanitizeCheckin({ date: 'не дата' })).toBeNull();
    const c = sanitizeCheckin({ date: '2026-08-14T10:00:00', confidence: 99, arousal: -2, focus: 3.6, protocolFollowed: 'да' });
    expect(c!.date).toBe('2026-08-14');
    expect(c!.confidence).toBe(5);
    expect(c!.arousal).toBe(0);
    expect(c!.focus).toBe(4);
    expect(c!.protocolFollowed).toBeNull();
  });
  it('loadProtocols устойчив к битому JSON в хранилище', () => {
    localStorage.setItem(MINDSET_PROTOCOLS_KEY, '{"сломано":');
    expect(loadProtocols()).toEqual([]);
    localStorage.setItem(MINDSET_PROTOCOLS_KEY, '"не массив"');
    expect(loadProtocols()).toEqual([]);
    localStorage.removeItem(MINDSET_PROTOCOLS_KEY);
  });
});

describe('CRUD протоколов', () => {
  beforeEach(() => localStorage.clear());

  it('create → upsert → load round-trip', () => {
    const p = createProtocol('Мой', 'pl', []);
    expect(p.name).toBe('Мой');
    const list = upsertProtocol(p);
    expect(list.length).toBe(1);
    expect(loadProtocols()[0].id).toBe(p.id);
  });
  it('upsert обновляет существующий (не дублирует)', () => {
    const p = createProtocol('А', 'both');
    upsertProtocol(p);
    upsertProtocol({ ...p, name: 'Б', items: [{ id: 'i', kind: 'pre', title: 'т', script: '', durationMin: 1, targetDays: ['all'] }] });
    const list = loadProtocols();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Б');
    expect(list[0].items.length).toBe(1);
  });
  it('delete убирает протокол и сбрасывает active id', () => {
    const p = createProtocol('А', 'both');
    upsertProtocol(p);
    setActiveProtocol(p.id);
    deleteProtocol(p.id);
    expect(loadProtocols()).toEqual([]);
    expect(localStorage.getItem(MINDSET_ACTIVE_KEY)).toBeNull();
  });
  it('duplicate создаёт копию с новыми id и суффиксом', () => {
    const p = createProtocol('Оригинал', 'bb', [{ id: 'i1', kind: 'pre', title: 'т', script: '', durationMin: 1, targetDays: ['all'] }]);
    upsertProtocol(p);
    const list = duplicateProtocol(p.id);
    expect(list.length).toBe(2);
    const copy = list.find(x => x.id !== p.id)!;
    expect(copy.name).toBe('Оригинал (копия)');
    expect(copy.items[0].id).not.toBe('i1');
  });
  it('loadActiveProtocol: id → первый протокол → null; setActiveProtocol(null) чистит', () => {
    expect(loadActiveProtocol()).toBeNull();
    const a = createProtocol('А', 'both');
    const b = createProtocol('Б', 'both');
    saveProtocols([a, b]);
    expect(loadActiveProtocol()!.id).toBe(a.id);
    setActiveProtocol(b.id);
    expect(loadActiveProtocol()!.id).toBe(b.id);
    setActiveProtocol(null);
    expect(loadActiveProtocol()!.id).toBe(a.id);
  });
  it('loadActiveProtocol игнорирует битый active id', () => {
    saveProtocols([createProtocol('А', 'both')]);
    localStorage.setItem(MINDSET_ACTIVE_KEY, 'не_существует');
    expect(loadActiveProtocol()!.name).toBe('А');
  });
});

describe('Чек-ины', () => {
  beforeEach(() => localStorage.clear());

  const mk = (date: string, over: Partial<MindsetCheckin> = {}): MindsetCheckin => ({
    id: `c_${date}`, date, confidence: 4, arousal: 3, focus: 5, protocolFollowed: true, ...over,
  });

  it('upsertCheckin добавляет и сортирует по дате', () => {
    upsertCheckin(mk('2026-08-14'));
    upsertCheckin(mk('2026-08-12'));
    const list = loadCheckins();
    expect(list.map(c => c.date)).toEqual(['2026-08-12', '2026-08-14']);
  });
  it('upsertCheckin заменяет запись той же даты+sessionId', () => {
    upsertCheckin(mk('2026-08-14', { sessionId: 'w1', confidence: 2 }));
    upsertCheckin(mk('2026-08-14', { sessionId: 'w1', confidence: 5 }));
    const list = loadCheckins();
    expect(list.length).toBe(1);
    expect(list[0].confidence).toBe(5);
    expect(list[0].id).toBe('c_2026-08-14');
  });
  it('upsertCheckin не трогает другую сессию в тот же день', () => {
    upsertCheckin(mk('2026-08-14', { sessionId: 'w1', confidence: 2 }));
    upsertCheckin(mk('2026-08-14', { sessionId: 'w2', confidence: 5 }));
    const list = loadCheckins();
    expect(list.length).toBe(2);
    expect(list.find(c => c.sessionId === 'w1')!.confidence).toBe(2);
  });
  it('latestCheckin и checkinForSession', () => {
    upsertCheckin(mk('2026-08-10', { sessionId: 'w1' }));
    upsertCheckin(mk('2026-08-12'));
    expect(latestCheckin()!.date).toBe('2026-08-12');
    expect(checkinForSession('w1')!.date).toBe('2026-08-10');
    expect(checkinForSession('нет')).toBeNull();
  });
  it('loadCheckins отбрасывает мусор', () => {
    localStorage.setItem(MINDSET_CHECKS_KEY, JSON.stringify([{ date: 'bad' }, null, 'x']));
    expect(loadCheckins()).toEqual([]);
  });
});

describe('Тренды и приверженность', () => {
  beforeEach(() => localStorage.clear());

  it('mindsetTrends считает средние и дельты', () => {
    // 7 дней с фокусом 3, затем 7 дней с фокусом 5
    for (let i = 1; i <= 7; i++) upsertCheckin({ date: `2026-08-0${i}`, confidence: 4, arousal: 3, focus: 3, protocolFollowed: true });
    for (let i = 8; i <= 14; i++) upsertCheckin({ date: `2026-08-${String(i).padStart(2, '0')}`, confidence: 4, arousal: 3, focus: 5, protocolFollowed: true });
    const t = mindsetTrends(7);
    expect(t.count).toBe(7);
    expect(t.averages.focus).toBe(5);
    expect(t.deltas.focus).toBe(2);
    expect(t.series.length).toBe(7);
    expect(t.series[0].date).toBe('2026-08-08');
  });
  it('mindsetTrends на пустом хранилище → нули', () => {
    const t = mindsetTrends(14);
    expect(t.count).toBe(0);
    expect(t.averages.confidence).toBe(0);
    expect(t.deltas.focus).toBe(0);
  });
  it('protocolAdherence считает долю выполненных (только отмеченные)', () => {
    upsertCheckin({ date: new Date().toISOString().slice(0, 10), confidence: 4, arousal: 3, focus: 4, protocolFollowed: true });
    upsertCheckin({ date: '2020-01-01', confidence: 4, arousal: 3, focus: 4, protocolFollowed: false });
    const a = protocolAdherence(30);
    expect(a.total).toBe(1);
    expect(a.followed).toBe(1);
    expect(a.pct).toBe(100);
  });
  it('protocolAdherence игнорирует null-followed и старые записи', () => {
    upsertCheckin({ date: new Date().toISOString().slice(0, 10), confidence: 4, arousal: 3, focus: 4, protocolFollowed: null });
    upsertCheckin({ date: '2019-01-01', confidence: 4, arousal: 3, focus: 4, protocolFollowed: true });
    const a = protocolAdherence(30);
    expect(a.total).toBe(0);
    expect(a.pct).toBe(0);
  });
});

describe('Корреляция с производительностью', () => {
  it('sessionsBestE1RM берёт лучший e1RM за дату', () => {
    const sessions = sessionsBestE1RM([
      { date: '2026-08-10', exercises: [{ sets: [{ weight: 80, reps: 5 }, { weight: 90, reps: 3 }] }] },
      { date: '2026-08-11', exercises: [{ sets: [{ weight: 100, reps: 1 }] }] },
      { date: '2026-08-10', exercises: [{ sets: [{ weight: 70, reps: 10 }] }] },
    ]);
    expect(sessions).toEqual([
      { date: '2026-08-10', e1rm: Math.round(90 * (1 + 3 / 30)) },
      { date: '2026-08-11', e1rm: Math.round(100 * (1 + 1 / 30)) },
    ]);
  });
  it('sessionsBestE1RM устойчив к мусору', () => {
    expect(sessionsBestE1RM([{} as any, null as any, { date: '', exercises: [] }])).toEqual([]);
  });
  it('correlateConfidenceWithPerformance: положительная связь → r>0 и корзины растут', () => {
    const checks: MindsetCheckin[] = [];
    const sessions: { date: string; e1rm: number }[] = [];
    for (let i = 1; i <= 9; i++) {
      const conf = i <= 3 ? 1 : i <= 6 ? 3 : 5;
      checks.push({ id: `c${i}`, date: `2026-08-0${i}`, confidence: conf, arousal: 3, focus: 4, protocolFollowed: true });
      sessions.push({ date: `2026-08-0${i}`, e1rm: 80 + conf * 10 });
    }
    const link = correlateConfidenceWithPerformance(checks, sessions);
    expect(link.n).toBe(9);
    expect(link.pearson).toBeGreaterThan(0.9);
    expect(link.buckets.find(b => b.level === 'low')!.avgE1RM).toBe(90);
    expect(link.buckets.find(b => b.level === 'high')!.avgE1RM).toBe(130);
  });
  it('correlateConfidenceWithPerformance: <3 пар → pearson null', () => {
    const link = correlateConfidenceWithPerformance(
      [{ id: 'c', date: '2026-08-01', confidence: 4, arousal: 3, focus: 4, protocolFollowed: true }],
      [{ date: '2026-08-01', e1rm: 100 }],
    );
    expect(link.pearson).toBeNull();
    expect(link.n).toBe(1);
  });
  it('correlateConfidenceWithPerformance: чек-ины без совпадений дат не считаются', () => {
    const link = correlateConfidenceWithPerformance(
      [
        { id: 'a', date: '2026-08-01', confidence: 4, arousal: 3, focus: 4, protocolFollowed: true },
        { id: 'b', date: '2026-08-02', confidence: 4, arousal: 3, focus: 4, protocolFollowed: true },
        { id: 'c', date: '2026-08-03', confidence: 4, arousal: 3, focus: 4, protocolFollowed: true },
      ],
      [{ date: '2026-07-01', e1rm: 100 }],
    );
    expect(link.n).toBe(0);
  });
});

describe('Инсайты', () => {
  beforeEach(() => localStorage.clear());

  it('без протокола — подсказка собрать пресет', () => {
    const out = buildMindsetInsights(null, []);
    expect(out.length).toBe(1);
    expect(out[0]).toContain('пресет');
  });
  it('пустой протокол — подсказка добавить шаги', () => {
    const p = createProtocol('Пусто', 'both', []);
    const out = buildMindsetInsights(p, []);
    expect(out.some(s => s.includes('пуст'))).toBe(true);
  });
  it('низкий фокус за 14 дней → рекомендация MMC/вход', () => {
    const p = createProtocol('П', 'both', [{ id: 'i', kind: 'pre', title: 'т', script: '', durationMin: 1, targetDays: ['all'] }]);
    const day = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(day); d.setDate(day.getDate() - i);
      upsertCheckin({ date: d.toISOString().slice(0, 10), confidence: 4, arousal: 3, focus: 1, protocolFollowed: false });
    }
    const out = buildMindsetInsights(p, []);
    expect(out.some(s => s.includes('фокус') || s.includes('MMC'))).toBe(true);
  });
  it('высокая приверженность → поощрение', () => {
    const p = createProtocol('П', 'both', [{ id: 'i', kind: 'pre', title: 'т', script: '', durationMin: 1, targetDays: ['all'] }]);
    const day = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(day); d.setDate(day.getDate() - i);
      upsertCheckin({ date: d.toISOString().slice(0, 10), confidence: 4, arousal: 3, focus: 4, protocolFollowed: true });
    }
    const out = buildMindsetInsights(p, []);
    expect(out.some(s => s.includes('приверженность'))).toBe(true);
  });
  it('корреляция с e1RM попадает в инсайты при достаточных данных', () => {
    const p = createProtocol('П', 'both', [{ id: 'i', kind: 'pre', title: 'т', script: '', durationMin: 1, targetDays: ['all'] }]);
    const workouts: { date: string; exercises: any[] }[] = [];
    for (let i = 1; i <= 6; i++) {
      const conf = i <= 3 ? 1 : 5;
      upsertCheckin({ date: `2026-08-0${i}`, confidence: conf, arousal: 3, focus: 4, protocolFollowed: true });
      workouts.push({ date: `2026-08-0${i}`, exercises: [{ sets: [{ weight: 60 + conf * 8, reps: 5 }] }] });
    }
    const out = buildMindsetInsights(p, workouts);
    expect(out.some(s => s.includes('r ='))).toBe(true);
  });
});

describe('Day progress', () => {
  beforeEach(() => localStorage.clear());

  it('loadDayProgress: нет записи → пустой список на сегодня', () => {
    const p = loadDayProgress('2026-08-14');
    expect(p.date).toBe('2026-08-14');
    expect(p.doneItems).toEqual([]);
  });
  it('save/load round-trip для конкретной даты', () => {
    saveDayProgress({ date: '2026-08-14', doneItems: ['goal_today', 'viz_approach'] });
    expect(loadDayProgress('2026-08-14').doneItems).toEqual(['goal_today', 'viz_approach']);
  });
  it('прогресс другой даты не подтягивается', () => {
    saveDayProgress({ date: '2026-08-14', doneItems: ['x'] });
    expect(loadDayProgress('2026-08-15').doneItems).toEqual([]);
  });
  it('битый JSON в хранилище → пустой прогресс', () => {
    localStorage.setItem(MINDSET_DAY_PROGRESS_KEY, '{}');
    expect(loadDayProgress('2026-08-14').doneItems).toEqual([]);
    localStorage.setItem(MINDSET_DAY_PROGRESS_KEY, JSON.stringify({ date: '2026-08-14', doneItems: [1, 2] }));
    expect(loadDayProgress('2026-08-14').doneItems).toEqual([]);
  });
});

describe('Метки (полнота UI-контрактов)', () => {
  it('все kind/daytype/direction имеют русские метки', () => {
    for (const k of KIND_ORDER) expect(KIND_LABELS[k]).toBeTruthy();
    for (const d of ['all', 'heavy', 'pump', 'competition', 'deload'] as const) expect(DAYTYPE_LABELS[d]).toBeTruthy();
    for (const d of ['pl', 'bb', 'both'] as const) expect(DIRECTION_LABELS[d]).toBeTruthy();
  });
});

describe('Экспорт CSV', () => {
  beforeEach(() => localStorage.clear());

  it('пустое хранилище → только заголовок', () => {
    expect(exportMindsetCheckinsCSV()).toBe('date,session_id,confidence,arousal,focus,protocol_followed,note');
  });

  it('содержит все чек-ины с экранированием заметок и кавычек', () => {
    upsertCheckin({ date: '2026-08-10', sessionId: 'w_1', confidence: 4, arousal: 3, focus: 5, protocolFollowed: true, note: 'отлично "работал"' });
    upsertCheckin({ date: '2026-08-12', confidence: 2, arousal: 2, focus: 3, protocolFollowed: false, note: 'плохо' });
    upsertCheckin({ date: '2026-08-14', sessionId: 'w_3', confidence: 5, arousal: 4, focus: 5, protocolFollowed: null, note: 'не отмечал' });
    const csv = exportMindsetCheckinsCSV();
    const lines = csv.split('\n');
    expect(lines.length).toBe(4);
    expect(lines[0]).toBe('date,session_id,confidence,arousal,focus,protocol_followed,note');
    expect(lines[1]).toBe('2026-08-10,"w_1",4,3,5,1,"отлично ""работал"""');
    expect(lines[2]).toBe('2026-08-12,,2,2,3,0,"плохо"');
    expect(lines[3]).toBe('2026-08-14,"w_3",5,4,5,,"не отмечал"');
  });

  it('устойчив к битому JSON чек-инов', () => {
    localStorage.setItem(MINDSET_CHECKS_KEY, '{{{');
    expect(exportMindsetCheckinsCSV()).toBe('date,session_id,confidence,arousal,focus,protocol_followed,note');
  });
});
