/**
 * hydrate-cardio-card.test.ts — проход 204: ответ карточки «Здоровье» о ССС
 * доходит до калькулятора, а бланк остаётся главнее.
 *
 * Класс дефекта: `hydrateState` читал из профиля нейро, ОДА, фарму, противопоказания
 * и генетику, но не кардио. Своей карточки АД/ЧСС у калькулятора нет (домены и
 * `buildMapperCtx` читают `state.cardio`), поэтому `state.cardio` всегда оставался
 * дефолтом «норма, 70»: человек отвечал «прегипертония», «пульс 92», «ЛПНП очень
 * высокий» — и ни риск, ни домены этого не видели. Плюс словарь: селект ЛПНП
 * отвечает `low|normal|high|very_high`, а лестница калькулятора — `none…severe`;
 * `sev('high')` возвращал 0, то есть «высокий ЛПНП» не давал ни одного балла риска.
 *
 * Проверяется:
 *  - слова карточки → ступени (`cardioStateFromCard`), без ответа — без ключа;
 *  - `hydrateState` переносит ответ в `state.cardio` (АД, пульс, липиды, флаги);
 *  - числа бланка перекрывают слова карточки (бланк главнее), стадия АД остаётся;
 *  - пульс 0 и пустые строки не превращаются в «норму».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hydrateState } from '../index';
import { cardioStateFromCard } from '../cardio-vitals';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};

describe('проход 204: слова карточки ССС → ступени', () => {
  it('стадия АД читается каноном, старое `elevated` — прегипертония', () => {
    expect(cardioStateFromCard({ bpStage: 'prehypertension' }).bpStage).toBe('prehypertension');
    expect(cardioStateFromCard({ bpStage: 'elevated' }).bpStage).toBe('prehypertension');
    expect(cardioStateFromCard({ bpStage: ' hypertension2 ' }).bpStage).toBe('hypertension2');
  });

  it('ЛПНП: «высокий» — средняя ступень, «очень высокий» — тяжёлая, «низкий» — нет отклонения', () => {
    expect(cardioStateFromCard({ ldlElevation: 'low' }).ldlElevation).toBe('none');
    expect(cardioStateFromCard({ ldlElevation: 'normal' }).ldlElevation).toBe('none');
    expect(cardioStateFromCard({ ldlElevation: 'high' }).ldlElevation).toBe('moderate');
    expect(cardioStateFromCard({ ldlElevation: 'very_high' }).ldlElevation).toBe('severe');
    // Ступени бланка проходят как есть.
    expect(cardioStateFromCard({ ldlElevation: 'mild' }).ldlElevation).toBe('mild');
  });

  it('нет ответа — нет ключа (молчание карточки не «норма»)', () => {
    expect(cardioStateFromCard(undefined)).toEqual({});
    expect(cardioStateFromCard({})).toEqual({});
    expect(cardioStateFromCard({ bpStage: '', ldlElevation: 'что-то', heartRate: 0 })).toEqual({});
    expect(cardioStateFromCard({ heartRate: Number.NaN })).toEqual({});
    // Ложные флаги — это ответ, его не выбрасываем.
    expect(cardioStateFromCard({ hdlLow: false, previousCVD: false })).toEqual({ hdlLow: false, previousCVD: false });
  });

  it('ТГ и гематокрит — в своих словарях', () => {
    expect(cardioStateFromCard({ triglycerides: 'high' }).triglycerides).toBe('high');
    expect(cardioStateFromCard({ triglycerides: 'normal' }).triglycerides).toBe('normal');
    expect(cardioStateFromCard({ triglycerides: 'elevated' }).triglycerides).toBe('elevated');
    expect(cardioStateFromCard({ hctElevation: 'severe' }).hctElevation).toBe('severe');
  });
});

describe('проход 204: hydrateState читает карточку ССС', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal('localStorage', localStorageMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorageMock.clear();
  });

  const profile = (health: Record<string, unknown>) =>
    JSON.stringify({ settings: { health } });

  it('АД, пульс и липиды карточки попадают в state.cardio', () => {
    store['he_profile_v2'] = profile({
      bpStage: 'prehypertension', heartRate: 92,
      ldlElevation: 'very_high', hctElevation: 'mild',
      hdlLow: true, triglycerides: 'high', previousCVD: true,
    });
    const card = hydrateState().cardio!;
    expect(card.bpStage).toBe('prehypertension');
    expect(card.heartRate).toBe(92);
    expect(card.ldlElevation).toBe('severe');
    expect(card.hctElevation).toBe('mild');
    expect(card.hdlLow).toBe(true);
    expect(card.triglycerides).toBe('high');
    expect(card.previousCVD).toBe(true);
    expect(card.familyCVD).toBe(false); // не отвечено — дефолт, а не «норма» из карточки
  });

  it('бланк главнее слов карточки, а стадия АД остаётся', () => {
    store['he_profile_v2'] = profile({ bpStage: 'hypertension1', ldlElevation: 'very_high', hctElevation: 'severe' });
    store['he_labs_history'] = JSON.stringify([{
      date: '2026-11-01',
      panelLipid: { LDL: '2.5', HDL: '1.4', Triglycerides: '1.1' },
      panelHematology: { HCT: '45' },
    }]);
    const card = hydrateState().cardio!;
    // 2.5 ммоль/л — ниже первой ступени ЛПНП: бланк отменяет «очень высокий» карточки.
    expect(card.ldlElevation).toBe('none');
    expect(card.hctElevation).toBe('none');
    expect(card.hdlLow).toBe(false);
    // АД — не анализ: его никто не перекрывает.
    expect(card.bpStage).toBe('hypertension1');
  });

  it('карточка без кардио-ответов ничего не выдумывает', () => {
    store['he_profile_v2'] = profile({ dopamineScore: 3 });
    // Ни карточки, ни бланка — блока cardio нет вовсе (дефолты даёт потребитель),
    // то есть «норма» не подставляется молча.
    expect(hydrateState().cardio).toBeUndefined();
  });
});
