/**
 * bb-visual.test.ts — Фаза 4: наглядность/экспорт ББ-плана (чистые data-билдеры).
 */
import { describe, it, expect } from 'vitest';
import { buildBBMuscleHeatmap, buildBBTaperCurve, buildBBMesocycleTable, bbWeekDateRanges, buildBBPlanPrintHtml, buildBBPlanIcs, compareBBVariants, buildBBFitnessFatigue } from '../bb-visual.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { bbSessionTagLabel } from '../bb-session-tags';

describe('Фаза 4.19: heatmap мышца×неделя', () => {
  it('строит клетки по мышцам/неделям', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    const hm = buildBBMuscleHeatmap(plan);
    expect(hm.length).toBeGreaterThan(0);
    expect(hm[0]).toHaveProperty('week');
    expect(hm[0]).toHaveProperty('muscle');
    expect(hm[0]).toHaveProperty('sets');
  });

  it('цифра клетки = факт плана (weeklyVolume), а не сырые сеты по метке мышцы', () => {
    // Замер до правки (ppl_6): 4 из 28 клеток врали — `shoulders` 12 против
    // 3 прямых / 9.8 эффективных, `delt_rear` 6 против 12: упражнение с меткой
    // `shoulders` может быть задней дельтой, и aggregateBBVolume раскладывает его
    // по пучкам, а heatmap считал сырые сеты по полю `e.muscle`.
    for (const patternId of ['ppl_6', 'upper_lower_4', 'fullbody_3']) {
      const plan: any = buildBBPlan({ patternId, level: 'intermediate', goal: 'mass', weeks: 2 } as any);
      const hm = buildBBMuscleHeatmap(plan);
      expect(hm.length, `${patternId}: пустой heatmap`).toBeGreaterThan(0);
      for (const cell of hm) {
        const snap = plan.weeklyVolume?.[cell.week]?.[cell.muscle];
        expect(snap, `${patternId}: клетка ${cell.week}/${cell.muscle} без снимка факта`).toBeDefined();
        const expected = Math.round(Number(snap.effectiveSets ?? snap.directSets ?? 0));
        expect(cell.sets, `${patternId}: ${cell.week}/${cell.muscle}`).toBe(expected);
      }
    }
  });
});

describe('Фаза 4.21: кривая тапера', () => {
  it('возвращает массив (может быть пустым без taper-недель)', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4 } as any);
    expect(Array.isArray(buildBBTaperCurve(plan))).toBe(true);
  });
});

describe('Фаза 4.22: таблица мезоцикла', () => {
  it('содержит недели×дни×упражнения', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 3 } as any);
    const rows = buildBBMesocycleTable(plan);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].exercises.length).toBeGreaterThan(0);
    expect(rows[0].exercises[0]).toHaveProperty('weight');
  });

  it('итерация C: в строке есть правило прогрессии (бумажный лог, а не список)', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const exercises = buildBBMesocycleTable(plan).flatMap(r => r.exercises);
    expect(exercises.length).toBeGreaterThan(5);
    expect(exercises.every(e => typeof e.progression === 'string' && e.progression!.length > 20)).toBe(true);
  });
});

describe('Фаза 4.23: календарные диапазоны недель', () => {
  it('считает даты от старта', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const ranges = bbWeekDateRanges(plan, { startDate: '2026-01-05', referenceDate: '2026-01-09' });
    expect(ranges.length).toBe(2);
    expect(ranges[0].start).toBe('2026-01-05');
    expect(ranges[0].isCurrent).toBe(true);
    expect(ranges[1].start).toBe('2026-01-12');
  });
  it('без даты — пустые диапазоны', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const ranges = bbWeekDateRanges(plan);
    expect(ranges[0].start).toBe('');
  });
});

describe('Фаза 4.24: print HTML + ics', () => {
  it('buildBBPlanPrintHtml — стилизованный HTML с таблицей и heatmap', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 3 } as any);
    const html = buildBBPlanPrintHtml(plan);
    expect(html).toMatch(/<html/i);
    expect(html).toMatch(/Таблица мезоцикла/);
    expect(html).toMatch(/Нед/i); // heatmap секция
  });

  it('итерация E: печать содержит технику, прогрессию и поле «факт»', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const html = buildBBPlanPrintHtml(plan);
    expect(html).toMatch(/<th>Техника<\/th>/);
    expect(html).toMatch(/<th>Прогрессия<\/th>/);
    expect(html).toMatch(/<th>Факт/);
    // Правило прогрессии реально доехало в печать, а не только в заголовок.
    expect(html).toMatch(/Двойная прогрессия/);
  });
  it('buildBBPlanIcs — валидный VCALENDAR', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const ics = buildBBPlanIcs(plan, { startDate: '2026-01-05' });
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('печать: подписи мышц и уровня по-русски, без сырых ключей', () => {
    // Замер до правки: 2507 из 2946 ячеек мышц в печати — сырые ключи
    // (`delt_mid`, `back`), 16/16 планов печатали английское `Level: advanced`.
    const RAW = ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'traps', 'forearms', 'shoulders', 'biceps', 'triceps', 'delt_front', 'delt_mid', 'delt_rear'];
    for (const patternId of ['ppl_6', 'upper_lower_4', 'fullbody_3']) {
      const plan: any = buildBBPlan({ patternId, level: 'advanced', goal: 'mass', weeks: 2 } as any);
      const html = buildBBPlanPrintHtml(plan);
      expect(html, `${patternId}: английский уровень`).not.toMatch(/Level:\s*(beginner|intermediate|advanced|enhanced)/);
      expect(html, `${patternId}: нет русского уровня`).toMatch(/Уровень:\s*Опытный/);
      for (const k of RAW) {
        expect(html, `${patternId}: сырой ключ мышцы '${k}' в печати`).not.toContain(`<td>${k}</td>`);
        expect(html, `${patternId}: сырой ключ мышцы '${k}' в heatmap`).not.toContain(`<tr><td>${k}</td>`);
      }
      // Русские подписи реально присутствуют (а не «всё пусто»).
      expect(html).toMatch(/Спина|Грудь|Квадрицепс|Квадры/);
    }
  });

  it('каждая сессия — событие в свой день; ничего нулевой длины', () => {
    // Замер до правки (ppl_6, 2 недели, старт 2026-11-04): 12 событий в ДВУХ
    // датах (все сессии недели получали дату начала недели), у всех
    // DTEND == DTSTART; сессии несут `day` (1..7) и `weekOffset`, т.е. данные
    // для раскладки по дням были и игнорировались.
    const plan: any = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const start = '2026-11-04';
    const ics = buildBBPlanIcs(plan, { startDate: start });
    const events = ics.split('BEGIN:VEVENT').length - 1;
    const sessions = plan.weeks.reduce((n: number, w: any) => n + (w.sessions || []).filter((s: any) => (s.exercises || []).length > 0).length, 0);
    expect(events).toBe(sessions);

    const pairs = [...ics.matchAll(/DTSTART:(\d{8})T(\d{6})Z\r\nDTEND:(\d{8})T(\d{6})Z\r\nUID:bb-(\d+)-/g)];
    expect(pairs.length).toBe(events);
    for (const p of pairs) {
      expect(p[3] > p[1] || (p[3] === p[1] && p[4] > p[2]), 'нулевая длительность события').toBe(true);
    }
    // Внутри недели даты разные (1..7 день недели), недели не наезжают друг на друга.
    const perWeekDates = new Map<number, string[]>();
    for (const p of pairs) {
      const weekNo = Number(p[5]);
      const list = perWeekDates.get(weekNo) || [];
      list.push(p[1]);
      perWeekDates.set(weekNo, list);
    }
    for (const [weekNo, dates] of perWeekDates) {
      expect(new Set(dates).size, `неделя ${weekNo}: события слиплись в один день`).toBe(dates.length);
    }
    // Первый день первой недели — ровно дата старта (day=1 → старт).
    expect(pairs[0][1]).toBe(start.replace(/-/g, ''));
    // Ни одно событие не уехало за пределы своей недели.
    const weekKeys = [...perWeekDates.keys()].sort((a, b) => a - b);
    for (let wi = 1; wi < weekKeys.length; wi++) {
      const prevMax = [...perWeekDates.get(weekKeys[wi - 1])!].sort().pop()!;
      const curMin = [...perWeekDates.get(weekKeys[wi])!].sort()[0];
      expect(curMin > prevMax, 'недели перекрываются').toBe(true);
    }
  });

  it('.ics: заголовок события читается человеком (RU день, без заглушек)', () => {
    // Замер до правки: SUMMARY прогонялся через uid() (замена всего не-ASCII на
    // `_`) — 12 из 12 событий имели искалеченный текст вида «1 нед · ___ · Push».
    const plan: any = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    const ics = buildBBPlanIcs(plan, { startDate: '2026-11-04' });
    const summaries = [...ics.matchAll(/SUMMARY:(.*)/g)].map((m) => m[1]);
    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) {
      expect(s, `заглушки вместо текста: ${s}`).not.toMatch(/_{2,}/);
      expect(s, `английский тег дня: ${s}`).not.toMatch(/\b(Push|Pull|Legs|Upper|Lower|FullBody)\b/);
      expect(s, `нет русской подписи дня: ${s}`).toMatch(/Неделя \d+/);
    }
    // День недели из словаря движка (тот же, что в UI): Pull → Спина/Бицепс.
    expect(summaries.join('\n')).toMatch(/Спина\/Бицепс|Грудь\/Плечи\/Трицепс|Ноги/);
  });

  it('.ics: строки не длиннее 75 октетов (RFC 5545) и складываются пробелом', () => {
    const plan: any = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', goal: 'mass', weeks: 2 } as any);
    // Самый длинный русский тег дня: «Ягодицы/Бицепс бедра» — заголовок выходит
    // за 75 октетов, и без складывания клиенты его обрезают.
    const session = plan.weeks[0].sessions.find((s: any) => (s.exercises || []).length > 0);
    expect(session, 'в первой неделе нет тренировочной сессии').toBeTruthy();
    session.sessionTag = 'GlutesHams';
    session.character = 'памп';
    const ics = buildBBPlanIcs(plan, { startDate: '2026-11-04' });
    const enc = new TextEncoder();
    const physical = ics.split('\r\n');
    for (const line of physical) {
      expect(enc.encode(line).length, `строка длиннее 75 октетов: ${line}`).toBeLessThanOrEqual(75);
    }
    // Складывание действительно произошло: продолжение — строка с ведущим пробелом.
    const folded = physical.some((l, i) => l.startsWith('SUMMARY:') && physical[i + 1]?.startsWith(' '));
    expect(folded, 'длинный заголовок не сложен').toBe(true);
    // И после разворота складывания заголовок читается целиком.
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toMatch(/SUMMARY:Неделя 1 · Ягодицы\/Бицепс бедра/);
  });
});

describe('bb-session-tags: единый словарь дней', () => {
  it('переводит теги и не теряет неизвестный', () => {
    expect(bbSessionTagLabel('Pull')).toBe('Спина/Бицепс');
    expect(bbSessionTagLabel('ChestBack')).toBe('Грудь/Спина');
    expect(bbSessionTagLabel('Legs')).toBe('Ноги');
    expect(bbSessionTagLabel('Unknown')).toBe('Unknown');
    expect(bbSessionTagLabel('')).toBe('');
  });
});

describe('Фаза 4.27: сравнение вариантов', () => {
  it('считает по-недельный дифф', () => {
    const a = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 3 } as any);
    const b = buildBBPlan({ patternId: 'upper_lower_4', level: 'advanced', goal: 'mass', weeks: 3 } as any);
    const diff = compareBBVariants(a, b);
    expect(diff.length).toBe(3);
    expect(diff.every(d => typeof d.changes === 'number')).toBe(true);
  });
  it('пустой план → []', () => {
    expect(compareBBVariants({ weeks: [] } as any, { weeks: [] } as any)).toEqual([]);
  });
});

describe('Фаза 4.20: fitness-fatigue (Banister)', () => {
  it('прогноз по неделям плана от даты старта', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 6 } as any);
    const ff = buildBBFitnessFatigue(plan, { startDate: '2026-01-05' });
    expect(ff.length).toBe(6);
    expect(ff[0].date).toBe('2026-01-05');
    expect(ff.every(p => typeof p.performance === 'number')).toBe(true);
  });
  it('пустой план → []', () => {
    expect(buildBBFitnessFatigue({ weeks: [] } as any)).toEqual([]);
  });
});
