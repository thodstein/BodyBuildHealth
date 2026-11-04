/**
 * cardio-nutrition-contract.test.ts — контракт «кардио → питание».
 *
 * Аудит 2026-11: TrainingScreen писал `he_cardio_kcal_note`, но читателя не было
 * (мёртвая запись), а питание выводило расход из типа тренировки. Здесь
 * фиксируем: запись публикуется с уверенностью, читается, и её можно выключить.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CARDIO_KCAL_NOTE_KEY, buildCardioKcalContract, cardioKcalPlannerNote, loadCardioKcalContract,
  publishCardioKcalContract, setCardioKcalInclude,
} from '../cardio-nutrition-contract.engine';
import { buildCardioCycle, cardioToNutritionPayload, type CardioCycle } from '../cardio.engine';
import { saveCardioLogEntry, replaceCardioLog } from '../cardio-diary.engine';
import { addDaysIso, todayLocalIso } from '../cardio-date-utils.engine';

const LOG_KEY = 'he_cardio_sessions';

const cycle = (): CardioCycle => buildCardioCycle({ goal: 'cut', totalWeeks: 6, startDate: '2026-03-02', bodyWeight: 80 });

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('контракт кардио → питание', () => {
  it('публикация: weeklyKcal из плана, уверенность низкая без журнала', () => {
    const c = cycle();
    const contract = publishCardioKcalContract(c, []);
    const payload = cardioToNutritionPayload(c, [], '2026-03-10');
    expect(contract.weeklyKcal).toBe(payload.avgKcalPerWeek);
    expect(contract.basis).toBe('plan');
    expect(contract.confidence).toBeLessThanOrEqual(0.35);
    expect(contract.include).toBe(true);
    expect(JSON.parse(localStorage.getItem(CARDIO_KCAL_NOTE_KEY)!).cycleId).toBe(c.id);
  });

  it('журнал за 14+ дней поднимает уверенность и переключает основу на факт', () => {
    const d = (back: number) => addDaysIso(todayLocalIso(), -back);
    replaceCardioLog([
      { id: 'a', date: d(24), type: 'zone2', durationMin: 40, completed: true, calories: 300 },
      { id: 'b', date: d(18), type: 'zone2', durationMin: 40, completed: true, calories: 300 },
      { id: 'c', date: d(9), type: 'hiit', durationMin: 25, completed: true, calories: 320 },
      { id: 'd', date: d(2), type: 'zone2', durationMin: 50, completed: true, calories: 380 },
    ]);
    const contract = publishCardioKcalContract(cycle());
    expect(contract.basis).toBe('log');
    expect(contract.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('readback сохраняет числа и переключатель «не учитывать»', () => {
    const c = cycle();
    publishCardioKcalContract(c, []);
    const off = setCardioKcalInclude(false);
    expect(off?.include).toBe(false);
    const loaded = loadCardioKcalContract();
    expect(loaded?.include).toBe(false);
    expect(loaded?.weeklyKcal).toBeGreaterThan(0);
    expect(loaded?.text).toContain('НЕ учитывается');
    setCardioKcalInclude(true);
    expect(loadCardioKcalContract()?.include).toBe(true);
  });

  it('сегодняшний факт попадает в todayKcal', () => {
    saveCardioLogEntry({ id: 'today', date: '2026-03-10', type: 'zone2', durationMin: 30, completed: true, calories: 240 });
    const contract = buildCardioKcalContract(cycle(), undefined, '2026-03-10');
    expect(contract.todayKcal).toBe(240);
    expect(contract.todayMinutes).toBe(30);
  });

  it('мусор в хранилище → null (без падения)', () => {
    localStorage.setItem(CARDIO_KCAL_NOTE_KEY, '{"weeklyKcal":"oops"}');
    expect(loadCardioKcalContract()).toBeNull();
    localStorage.setItem(CARDIO_KCAL_NOTE_KEY, 'not json');
    expect(loadCardioKcalContract()).toBeNull();
  });

  it('ключ журнала не перетирается контрактом', () => {
    publishCardioKcalContract(cycle(), []);
    expect(localStorage.getItem(LOG_KEY)).toBeNull();
  });

  it('легаси-запись (avgKcalPerWeek без weeklyKcal) читается, а не теряется', () => {
    // Так писала старая кнопка «🍽 В питание» — питание могло читать эти имена.
    localStorage.setItem(CARDIO_KCAL_NOTE_KEY, JSON.stringify({
      cycleId: 'legacy', avgKcalPerWeek: 1200, avgMinutesPerWeek: 180, updatedAt: new Date().toISOString(),
    }));
    const c = loadCardioKcalContract();
    expect(c?.cycleId).toBe('legacy');
    expect(c?.weeklyKcal).toBe(1200);
    expect(c?.weeklyMinutes).toBe(180);
  });

  it('новый контракт пишет легаси-алиасы (обратная совместимость)', () => {
    const contract = publishCardioKcalContract(cycle(), []);
    const raw = JSON.parse(localStorage.getItem(CARDIO_KCAL_NOTE_KEY)!);
    expect(raw.avgKcalPerWeek).toBe(contract.weeklyKcal);
    expect(raw.avgMinutesPerWeek).toBe(contract.weeklyMinutes);
  });

  it('планировщик питания: справочная строка, без второго добавления ккал', () => {
    const c = cycle();
    const contract = publishCardioKcalContract(c, []);
    const note = cardioKcalPlannerNote(contract)!;
    expect(note.headline).toContain('ккал/нед');
    expect(note.headline).toContain('уверенность');
    expect(note.lines.join(' ')).toContain('второй раз не добавляется');
    expect(note.tone).toBe('ok');
    expect(cardioKcalPlannerNote(null)).toBeNull();
  });

  it('планировщик питания: выключенный учёт отражается в тоне и тексте', () => {
    publishCardioKcalContract(cycle(), []);
    const off = setCardioKcalInclude(false)!;
    const note = cardioKcalPlannerNote(off)!;
    expect(note.tone).toBe('muted');
    expect(note.lines.join(' ')).toContain('выключен');
  });
});
