import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadWeighIns, addWeighIn, removeWeighIn, normalizeWeighIns, weighTrajectory, cutDeviation,
  COMBAT_WIGHINS_CAP, COMBAT_WIGHINS_KEY,
  loadSparring, addSparring, removeSparring, normalizeSparring, sparringSessionLoad, sparringSummary,
  sparringJournalToLoad, COMBAT_SPARRING_KEY,
  leaScreen, LEA_PELLET, LEA_RED, sleepVerdict, SLEEP_TARGET_H, heatProtocol, HEAT_STEPS,
} from '../combat-measurements.engine';
import { sparringToOutsideLoad } from '../combat-sparring.engine';

beforeEach(() => localStorage.clear());

describe('E8.1 — журнал веса: персист и честная форма', () => {
  it('roundtrip: запись переживает перезагрузку', () => {
    expect(addWeighIn('2026-03-01', 80.4)).toBe(true);
    expect(addWeighIn('2026-03-08', 79.6)).toBe(true);
    expect(loadWeighIns().length).toBe(2);
    expect(loadWeighIns()[0].weightKg).toBe(80.4);
  });

  it('битый стор не роняет чтение', () => {
    localStorage.setItem(COMBAT_WIGHINS_KEY, '{не json');
    expect(loadWeighIns()).toEqual([]);
  });

  it('мусорные записи отбрасываются, а не попадают в расчёт', () => {
    const rows = normalizeWeighIns([
      { date: '2026-03-01', weightKg: 80 },
      { date: 'позавчера', weightKg: 79 },
      { date: '2026-03-02', weightKg: NaN },
      { date: '2026-03-03', weightKg: 5 },
      { date: '2026-03-04', weightKg: 500 },
      null,
    ]);
    expect(rows.length).toBe(1);
    expect(rows[0].date).toBe('2026-03-01');
  });

  it('одна запись на дату: повторная правка заменяет', () => {
    addWeighIn('2026-03-01', 80);
    addWeighIn('2026-03-01', 79.5);
    const rows = loadWeighIns();
    expect(rows.length).toBe(1);
    expect(rows[0].weightKg).toBe(79.5);
  });

  it('кап 180 записей', () => {
    for (let i = 0; i < 200; i++) {
      const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
      addWeighIn(d, 80 - i * 0.01);
    }
    expect(loadWeighIns().length).toBe(COMBAT_WIGHINS_CAP);
  });

  it('удаление работает, кривая дата не ломает хранилище', () => {
    addWeighIn('2026-03-01', 80);
    expect(removeWeighIn('2026-03-01')).toBe(true);
    expect(loadWeighIns()).toEqual([]);
    expect(removeWeighIn('ерунда')).toBe(false);
  });
});

describe('E8.1 — траектория и отклонение от плана сгона', () => {
  const series = [
    { date: '2026-03-01', weightKg: 80 },
    { date: '2026-03-15', weightKg: 79.4 },
  ];

  it('траектория: по неделе в минус = идёт на сгон', () => {
    const t = weighTrajectory(series)!;
    expect(t.first).toBe(80);
    expect(t.last).toBe(79.4);
    expect(t.perWeek).toBeCloseTo(0.3, 1);
    expect(t.level).toBe('cutting');
  });

  it('одна точка — траектории нет (не выдумываем)', () => {
    expect(weighTrajectory([{ date: '2026-03-01', weightKg: 80 }])).toBeNull();
    expect(weighTrajectory([])).toBeNull();
  });

  it('плато не выглядит как сгон и наоборот', () => {
    expect(weighTrajectory([
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-03-15', weightKg: 80.1 },
    ])!.level).toBe('holding');
    expect(weighTrajectory([
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-03-15', weightKg: 81 },
    ])!.level).toBe('gaining');
  });

  it('отставание от графика сгона определяется', () => {
    const d = cutDeviation([
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-03-15', weightKg: 79.9 },
    ], { startKg: 80, targetKg: 76, weeks: 4, today: '2026-03-15' });
    expect(d.level).toBe('behind');
    expect(d.deltaKg).toBeGreaterThan(0);
    expect(d.note).toMatch(/Отстаёте/);
  });

  it('опережение не подаётся как «успех, ускоряйте»', () => {
    const d = cutDeviation([
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-03-15', weightKg: 76.5 },
    ], { startKg: 80, targetKg: 76, weeks: 4, today: '2026-03-15' });
    expect(d.level).toBe('ahead');
    expect(d.note).toMatch(/мышц/);
  });

  it('без старта/цели/срока — честное «нельзя посчитать»', () => {
    const rows = [{ date: '2026-03-01', weightKg: 80 }];
    expect(cutDeviation(rows, { targetKg: 76, weeks: 4 }).level).toBe('unknown');
    expect(cutDeviation(rows, { startKg: 80, weeks: 4 }).level).toBe('unknown');
    expect(cutDeviation(rows, { startKg: 80, targetKg: 76 }).level).toBe('unknown');
    // цель выше старта — это набор массы, а не сгон
    expect(cutDeviation(rows, { startKg: 76, targetKg: 80, weeks: 4 }).level).toBe('unknown');
  });

  it('ГЛАВНОЕ: середина срока = середина пути (ловит путаницу дней и недель)', () => {
    // 4 недели сгона 80→76, прошло ровно 2 недели → план 78
    const d = cutDeviation([
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-03-15', weightKg: 78 },
    ], { startKg: 80, targetKg: 76, weeks: 4, today: '2026-03-15' });
    expect(d.plannedKg).toBeCloseTo(78, 1);
    expect(d.level).toBe('on_track');
  });

  it('в конце срока плановый вес = вес категории', () => {
    const d = cutDeviation([
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-03-29', weightKg: 76 },
    ], { startKg: 80, targetKg: 76, weeks: 4, today: '2026-03-29' });
    expect(d.plannedKg).toBeCloseTo(76, 1);
    expect(d.level).toBe('on_track');
  });

  it('срок не может «уехать» дальше конца даже при очень поздней дате', () => {
    const d = cutDeviation([
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-06-01', weightKg: 76 },
    ], { startKg: 80, targetKg: 76, weeks: 4, today: '2026-06-01' });
    expect(d.plannedKg).toBeCloseTo(76, 1);
  });
});

describe('E8.2 — журнал спарринга → нагрузка → внешняя нагрузка', () => {
  it('roundtrip персиста', () => {
    expect(addSparring('2026-03-02', 'hard', 5, 5, 9)).toBe(true);
    expect(addSparring('2026-03-03', 'tech', 6, 5, 5)).toBe(true);
    const rows = loadSparring();
    expect(rows.length).toBe(2);
    expect(rows[0].type).toBe('hard');
  });

  it('битый стор не ломает чтение', () => {
    localStorage.setItem(COMBAT_SPARRING_KEY, '[[[');
    expect(loadSparring()).toEqual([]);
  });

  it('невалидные типы/раунды/минуты отбрасываются', () => {
    const rows = normalizeSparring([
      { date: '2026-03-01', type: 'hard', rounds: 5, roundMinutes: 5 },
      { date: '2026-03-01', type: 'нож', rounds: 5, roundMinutes: 5 },
      { date: '2026-03-01', type: 'hard', rounds: 0, roundMinutes: 5 },
      { date: '2026-03-01', type: 'hard', rounds: 5, roundMinutes: 30 },
      { date: 'вчера', type: 'hard', rounds: 3, roundMinutes: 3 },
    ]);
    expect(rows.length).toBe(1);
  });

  it('RPE в пределах 1-10; вне диапазона отбрасывается', () => {
    const rows = normalizeSparring([
      { date: '2026-03-01', type: 'tech', rounds: 5, roundMinutes: 5, rpe: 7 },
      { date: '2026-03-02', type: 'tech', rounds: 5, roundMinutes: 5, rpe: 25 },
      { date: '2026-03-03', type: 'tech', rounds: 5, roundMinutes: 5, rpe: 0 },
    ]);
    expect(rows[0].rpe).toBe(7);
    expect(rows[1].rpe).toBeUndefined();
    expect(rows[2].rpe).toBeUndefined();
  });

  it('нагрузка = RPE × минуты (session-RPE, PMID 28933715)', () => {
    expect(sparringSessionLoad({ date: '2026-03-01', type: 'hard', rounds: 5, roundMinutes: 5, rpe: 8 })).toBe(200);
  });

  it('без RPE нагрузка НЕ считается — нулевая была бы выдумкой', () => {
    expect(sparringSessionLoad({ date: '2026-03-01', type: 'hard', rounds: 5, roundMinutes: 5 })).toBeNull();
    const s = sparringSummary([{ date: '2026-03-01', type: 'hard', rounds: 5, roundMinutes: 5 }]);
    expect(s.load).toBe(0);
    expect(s.missingRpe).toBe(1);
    expect(s.notes.join(' ')).toMatch(/10 мин/);
  });

  it('журнал → агрегат → sparringToOutsideLoad (реальная связка, не мёртвый код)', () => {
    const rows = [
      { date: '2026-03-02', type: 'hard' as const, rounds: 5, roundMinutes: 5, rpe: 9 },
      { date: '2026-03-04', type: 'tech' as const, rounds: 6, roundMinutes: 5, rpe: 5 },
    ];
    const load = sparringJournalToLoad(rows, '2026-03-04');
    expect(load).not.toBeNull();
    expect(load!.hardSparSessions).toBe(1);
    expect(load!.techSparSessions).toBe(1);
    // агрегат реально скормили движку
    const out = sparringToOutsideLoad(load, 'boxing');
    expect(out).not.toBeNull();
  });

  it('старое окно не тащится в текущую неделю', () => {
    const rows = [{ date: '2026-01-01', type: 'hard' as const, rounds: 5, roundMinutes: 5, rpe: 9 }];
    expect(sparringJournalToLoad(rows, '2026-03-04')).toBeNull();
  });

  it('удаление по дате+типу', () => {
    addSparring('2026-03-02', 'hard', 5, 5, 9);
    addSparring('2026-03-02', 'tech', 5, 5, 5);
    expect(removeSparring('2026-03-02', 'hard')).toBe(true);
    expect(loadSparring().length).toBe(1);
    expect(loadSparring()[0].type).toBe('tech');
  });
});

describe('E8.4 — скрининг LEA/RED-S: без данных не выдумываем вердикт', () => {
  it('неполные данные → no_data с честным списком недостающего', () => {
    const s = leaScreen({ kcal: 3000 });
    expect(s.level).toBe('no_data');
    expect(s.ea).toBeNull();
    expect(s.reason).toMatch(/Не хватает данных/);
    expect(s.reason).toMatch(/тренировочный расход/);
    expect(s.reason).toMatch(/безжировая масса/);
    expect(s.advice).toMatch(/догадкой/);
  });

  it('совсем пусто — тоже no_data, а не «всё хорошо»', () => {
    expect(leaScreen({}).level).toBe('no_data');
    expect(leaScreen({ kcal: 2000, trainingKcal: 500, ffmKg: 0 }).level).toBe('no_data');
  });

  it('зоны: <30 reds, 30-45 caution, >=45 optimal', () => {
    // (3000-1000)/60 = 33.3 → caution
    expect(leaScreen({ kcal: 3000, trainingKcal: 1000, ffmKg: 60 }).level).toBe('caution');
    // (2500-1000)/60 = 25 → reds
    expect(leaScreen({ kcal: 2500, trainingKcal: 1000, ffmKg: 60 }).level).toBe('reds');
    // (4000-1000)/60 = 50 → optimal
    expect(leaScreen({ kcal: 4000, trainingKcal: 1000, ffmKg: 60 }).level).toBe('optimal');
  });

  it('числа сходятся с объявленными порогами', () => {
    const at = (ea: number) => leaScreen({ kcal: ea * 60, trainingKcal: 0, ffmKg: 60 });
    // ровно 30 — это граница: ниже 30 = REDs, на границе = жёлтая зона
    expect(at(LEA_RED).level).toBe('caution');
    expect(at(LEA_RED - 1).level).toBe('reds');
    expect(at(LEA_RED + 1).level).toBe('caution');
    expect(at(LEA_PELLET).level).toBe('optimal');
  });

  it('CAT2-симптомы важнее цифры — и ведут к врачу', () => {
    const s = leaScreen({ kcal: 4000, trainingKcal: 1000, ffmKg: 60, cat2Flags: 2 });
    expect(s.level).toBe('cat2');
    expect(s.advice).toMatch(/врач/);
  });

  it('каждый вердикт ссылается на источник', () => {
    expect(leaScreen({ kcal: 3000, trainingKcal: 1000, ffmKg: 60 }).source).toMatch(/29773536|40254934/);
    expect(leaScreen({}).source).toMatch(/29773536|40254934/);
  });
});

describe('E8.7 — сон: плохая ночь отменяет интенсивное (PMID 41824810)', () => {
  it('8 ч — норма', () => {
    const v = sleepVerdict(8);
    expect(v.level).toBe('ok');
    expect(v.blockHardSession).toBe(false);
  });

  it('6 ч — плохо, интенсивное не ставим', () => {
    const v = sleepVerdict(6);
    expect(v.level).toBe('short');
    expect(v.blockHardSession).toBe(true);
    expect(v.advice).toMatch(/интенсив/);
  });

  it('4 ч (условие исследования) — критично', () => {
    const v = sleepVerdict(4);
    expect(v.level).toBe('critical');
    expect(v.blockHardSession).toBe(true);
  });

  it('сон не внесён — предупреждение молчит, но и не врёт', () => {
    const v = sleepVerdict(null);
    expect(v.level).toBe('unknown');
    expect(v.blockHardSession).toBe(false);
    expect(v.advice).toMatch(/не внесён|Внесите/);
  });

  it('цель = 8 ч (условие эксперимента), минимум 7 ч (рекомендация)', () => {
    expect(SLEEP_TARGET_H).toBe(8);
    expect(sleepVerdict(7).level).toBe('ok');
    expect(sleepVerdict(6.9).level).toBe('short');
  });
});

describe('E8.8 — тепловой протокол: проверенное и честная экстраполяция', () => {
  it('базовый протокол = параметры исследования 35510889', () => {
    const p = heatProtocol({ sessionsDone: 0 });
    expect(p.sessionMin).toBe(60);
    expect(p.tempC).toBe(32);
    expect(p.humidityPct).toBe(70);
    expect(p.step).toBe(5);
    expect(p.verified).toBe(true);
  });

  it('ступени выше 5 помечены как непроверенные — честно', () => {
    expect(HEAT_STEPS.filter(s => s.sessions > 5).every(s => s.verified === false)).toBe(true);
    expect(heatProtocol({ sessionsDone: 10 }).verified).toBe(false);
    expect(heatProtocol({ sessionsDone: 12 }).label).toMatch(/экстраполяция/);
  });

  it('гейт: сгон и неделя боя блокируют протокол', () => {
    expect(heatProtocol({ inWeightCut: true }).gate.blocked).toBe(true);
    expect(heatProtocol({ fightWeek: true }).gate.blocked).toBe(true);
    expect(heatProtocol({ inWeightCut: true }).gate.reasons.join(' ')).toMatch(/Сгон/);
    expect(heatProtocol({}).gate.blocked).toBe(false);
  });

  it('гидратация: акклиматизация не отменяет питьё', () => {
    expect(heatProtocol({}).hydration).toMatch(/Пейте/);
  });

  it('каждый прогон ссылается на источник', () => {
    expect(heatProtocol({}).source).toContain('35510889');
  });
});
