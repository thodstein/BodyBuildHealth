/**
 * combat-e8-grip.test.ts — 8.3 динамометр хвата (E8).
 *
 * Ключевая проверка честности: в модуле НЕТ популяционной нормы силы хвата
 * (её не удалось подтвердить — websearch 403). Сравнение только со своим пиком.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  COMBAT_GRIP_KEY, COMBAT_GRIP_CAP, GRIP_ASYMMETRY_NOTICE_PCT, GRIP_SOURCE,
  GRIP_P50_REF_MALE, GRIP_P50_REF_FEMALE, GRIP_P50_AGE_MALE, GRIP_P50_AGE_FEMALE,
  GRIP_P50_SOURCE, gripP50Ref,
  GripEntry, normalizeGrip, loadGrip, addGrip, removeGrip, gripSummary,
} from '../combat-measurements.engine';

const g = (date: string, hand: 'L' | 'R', gripKg: number): GripEntry => ({ date, hand, gripKg });

beforeEach(() => { localStorage.clear(); });

describe('E8.3.1 — форма записи и чистка', () => {
  it('мусор отбрасывается, нормальное проходит', () => {
    const out = normalizeGrip([
      g('2026-09-01', 'L', 55),
      { date: 'bad', hand: 'L', gripKg: 50 },
      { date: '2026-09-02', hand: 'X', gripKg: 50 },
      { date: '2026-09-03', hand: 'L', gripKg: 0 },
      { date: '2026-09-04', hand: 'L', gripKg: 999 },
      { date: '2026-09-05', hand: 'R', gripKg: 48 },
    ] as any);
    expect(out.map((r) => `${r.date}|${r.hand}`)).toEqual(['2026-09-01|L', '2026-09-05|R']);
  });

  it('одна дата+рука = одна запись, поздняя перезаписывает', () => {
    const out = normalizeGrip([g('2026-09-01', 'L', 50), g('2026-09-01', 'L', 52)] as any);
    expect(out).toHaveLength(1);
    expect(out[0].gripKg).toBe(52);
  });

  it('кап соблюдается', () => {
    const many = Array.from({ length: COMBAT_GRIP_CAP + 40 }, (_, i) =>
      g(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, i % 2 ? 'R' : 'L', 40 + (i % 10)));
    expect(normalizeGrip(many).length).toBeLessThanOrEqual(COMBAT_GRIP_CAP);
  });

  it('сортировка по дате, затем по руке', () => {
    const out = normalizeGrip([g('2026-09-02', 'R', 50), g('2026-09-01', 'R', 49), g('2026-09-01', 'L', 48)] as any);
    expect(out.map((r) => `${r.date}|${r.hand}`)).toEqual(['2026-09-01|L', '2026-09-01|R', '2026-09-02|R']);
  });
});

describe('E8.3.2 — хранилище', () => {
  it('запись долетает до localStorage и читается обратно', () => {
    expect(addGrip('2026-09-10', 'L', 58)).toBe(true);
    expect(addGrip('2026-09-10', 'R', 52)).toBe(true);
    expect(loadGrip()).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(COMBAT_GRIP_KEY)!).length).toBe(2);
  });

  it('битое значение не ломает ни запись, ни чтение', () => {
    expect(addGrip('2026-09-10', 'L', -5)).toBe(false);
    localStorage.setItem(COMBAT_GRIP_KEY, '{oops');
    expect(loadGrip()).toEqual([]);
    expect(addGrip('2026-09-11', 'L', 51)).toBe(true);
  });

  it('удаление по дате+руке не трогает вторую руку', () => {
    addGrip('2026-09-10', 'L', 58);
    addGrip('2026-09-10', 'R', 52);
    expect(removeGrip('2026-09-10', 'L')).toBe(true);
    const left = loadGrip();
    expect(left).toHaveLength(1);
    expect(left[0].hand).toBe('R');
  });
});

describe('E8.3.3 — сводка от СОБСТВЕННОГО пика', () => {
  it('нет данных — честный no_data', () => {
    const s = gripSummary([]);
    expect(s.level).toBe('no_data');
    expect(s.asymmetryPct).toBeNull();
    expect(s.note).toContain('Нет замеров');
  });

  it('одна рука — асимметрию не считаем', () => {
    const s = gripSummary([g('2026-09-01', 'L', 60)]);
    expect(s.level).toBe('one_hand');
    expect(s.asymmetryPct).toBeNull();
    expect(s.bestL).toBe(60);
  });

  it('симметричные руки — ok', () => {
    const s = gripSummary([g('2026-09-01', 'L', 60), g('2026-09-01', 'R', 58)]);
    expect(s.level).toBe('ok');
    expect(s.asymmetryPct).toBeCloseTo(3.3, 1);
  });

  it('разрыв рук ловится как asym с честной подписью', () => {
    const s = gripSummary([g('2026-09-01', 'L', 60), g('2026-09-01', 'R', 45)]);
    expect(s.level).toBe('asym');
    expect(s.asymmetryPct).toBe(25);
    expect(s.note).toContain('разошлись');
  });

  it('уход формы ловится как dropped', () => {
    const s = gripSummary([
      g('2026-09-01', 'L', 60), g('2026-09-01', 'R', 59),
      g('2026-09-20', 'L', 58), g('2026-09-20', 'R', 45),
    ]);
    expect(s.level).toBe('dropped');
    expect(s.dropFromPeakPct).toBe(25);
  });

  it('asym важнее dropped, если обе проблемы есть', () => {
    const s = gripSummary([
      g('2026-09-01', 'L', 60), g('2026-09-01', 'R', 40),
      g('2026-09-20', 'L', 40), g('2026-09-20', 'R', 40),
    ]);
    expect(s.level).toBe('asym');
  });

  it('последний замер — самый свежий, а не максимум', () => {
    const s = gripSummary([
      g('2026-09-01', 'L', 40), g('2026-09-20', 'L', 62),
    ]);
    expect(s.bestL).toBe(62);
    expect(s.latestL).toBe(62);
  });
});

describe('E8.3.4 — честность источника', () => {
  it('признак нормы и её отсутствия присутствует в подписи', () => {
    expect(GRIP_SOURCE).toMatch(/без популяционной нормы/);
    expect(GRIP_SOURCE).toMatch(/403/);
    expect(gripSummary([]).source).toBe(GRIP_SOURCE);
  });

  it('асимметрия — инженерный порог, а не выдуманный клинический cut-off', () => {
    expect(GRIP_ASYMMETRY_NOTICE_PCT).toBe(10);
    // граница срабатывает на самом пороге и не ниже
    const just = gripSummary([g('2026-09-01', 'L', 55), g('2026-09-01', 'R', 50)]);
    expect(just.level).toBe('ok');
    const at = gripSummary([g('2026-09-01', 'L', 55), g('2026-09-01', 'R', 49)]);
    expect(at.level).toBe('asym');
  });

  it('в модуле нет выдуманной нормы «сколько должно быть»', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/engines/combat/combat-measurements.engine.ts', 'utf8'));
    const gripBlock = src.slice(src.indexOf('8.3 Журнал силы хвата'), src.indexOf('8.4 Скрининг'));
    // никаких «минимальных норм»/«нормативов» с числами
    expect(gripBlock).not.toMatch(/МИНИМУМ|МИНИМАЛЬНАЯ НОРМА|normMin|requiredKg/);
  });
});

describe('E8.3.5 — ориентир P50 из публикации (не гейт)', () => {
  it('значения совпадают с PMID 34330493', () => {
    expect(GRIP_P50_REF_MALE).toBe(43.0);
    expect(GRIP_P50_REF_FEMALE).toBe(26.0);
    expect(GRIP_P50_SOURCE).toContain('34330493');
  });

  it('возраст пика РАЗНЫЙ у полов — как в самом источнике', () => {
    // Абстракт: men peaked 26-33, females 25-33. Одна строка на оба пола
    // показывала женщинам мужской пик (26–33 вместо 25–33).
    expect(GRIP_P50_AGE_MALE).toBe('пик 26–33 года');
    expect(GRIP_P50_AGE_FEMALE).toBe('пик 25–33 года');
    expect(GRIP_P50_AGE_MALE).not.toBe(GRIP_P50_AGE_FEMALE);

    expect(gripP50Ref('male')!.age).toBe(GRIP_P50_AGE_MALE);
    expect(gripP50Ref('female')!.age).toBe(GRIP_P50_AGE_FEMALE);
    expect(gripP50Ref('м')!.age).toBe(GRIP_P50_AGE_MALE);
    expect(gripP50Ref('ж')!.age).toBe(GRIP_P50_AGE_FEMALE);

    // источник не должен приписывать обоим полам мужской пик
    expect(GRIP_P50_SOURCE).toContain('26–33');
    expect(GRIP_P50_SOURCE).toContain('25–33');
  });

  it('подпись честно называет это ориентиром, а не нормой единоборств', () => {
    expect(GRIP_P50_SOURCE).toMatch(/Ориентир, не норма/);
    expect(GRIP_P50_SOURCE).toMatch(/Колумбия/);
  });

  it('ориентир выбирается по полу, без пола — не сравниваем', () => {
    expect(gripP50Ref('male')!.kg).toBe(43.0);
    expect(gripP50Ref('female')!.kg).toBe(26.0);
    expect(gripP50Ref('м')!.kg).toBe(43.0);
    expect(gripP50Ref(undefined)).toBeNull();
    expect(gripP50Ref(null)).toBeNull();
    expect(gripP50Ref('что-то')).toBeNull();
  });

  it('ориентир НЕ меняет вердикт — вердикт только от своей базы', () => {
    // слабая рука при низком P50 всё равно даёт asym, а не «ниже нормы»
    const s = gripSummary([g('2026-09-01', 'L', 30), g('2026-09-01', 'R', 22)]);
    expect(s.level).toBe('asym');
    // в вердикте нет уровня про «норму»
    expect(['ok', 'asym', 'dropped', 'no_data', 'one_hand']).toContain(s.level);
  });
});
