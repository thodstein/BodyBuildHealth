/**
 * support-genetics-diet.test.ts — опции подбора поддержки (opt-in, выбор пользователя):
 *  🧬 генетика (MTHFR C677T → метилфолат/B2/гомоцистеин; HFE → железо исключено),
 *  🍽 учёт принятых добавок (перекрытие доз),
 *  📥 дневник анализов — UI-эффект (AutoCalculator), здесь не тестируется.
 * Контракт: опции ВЫКЛ = тот же объект (байт-в-байт), вход не мутируется.
 */
import { describe, expect, it } from 'vitest';
import {
  applyGeneticsToPlanSubs, applyGeneticsToRecSubs,
  applyDietAwareToPlanSubs, applyDietAwareToRecSubs,
} from '../support-genetics-diet.engine';
import { runSupportUnified } from '../support-plan';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';
import type { PlanSubstance, CalculatorState } from '../support-plan/types';

const ps = (id: string, name: string, doseMg: number): PlanSubstance => ({
  id, name, doseMg, doseDisplay: `${doseMg} мг`, timing: 'с едой', category: ['supplement'],
  tier: 'standard', targetSystems: [], comment: '', mechanismReason: '', kind: 'supplement',
} as PlanSubstance);

describe('🧬 генетика — PlanSubstance', () => {
  it('опции нет/пустая → ТОТ ЖЕ объект (байт-в-байт)', () => {
    const subs = [ps('nac', 'NAC', 1200), ps('folate', 'Фолат', 400)];
    expect(applyGeneticsToPlanSubs(subs, undefined).subs).toBe(subs);
    expect(applyGeneticsToPlanSubs(subs, {}).subs).toBe(subs);
    expect(applyGeneticsToPlanSubs(subs, { mthfr: 'normal', hfe: 'normal' }).notes).toEqual([]);
  });

  it('HFE C282Y → железо вычищено, честная заметка', () => {
    const subs = [ps('nac', 'NAC', 1200), ps('iron_bisglycinate', 'Железо', 30), ps('iron', 'Железо', 18)];
    const { subs: out, notes } = applyGeneticsToPlanSubs(subs, { hfe: 'c282y' });
    expect(out.map(s => s.id)).toEqual(['nac']);
    expect(notes.some(n => n.includes('Гемохроматоз') && n.includes('железо исключено'))).toBe(true);
  });

  it('HFE normal → железо остаётся', () => {
    const subs = [ps('iron', 'Железо', 18)];
    expect(applyGeneticsToPlanSubs(subs, { hfe: 'normal' }).subs).toHaveLength(1);
  });

  it('MTHFR C677T → заметка + фолат помечен «метилфолат», остальные не тронуты', () => {
    const subs = [ps('nac', 'NAC', 1200), ps('folate', 'Фолат', 400)];
    const { subs: out, notes } = applyGeneticsToPlanSubs(subs, { mthfr: 'c677t' });
    expect(notes.some(n => n.includes('MTHFR') && n.includes('метилфолат'))).toBe(true);
    expect(notes.some(n => n.includes('гомоцистеин'))).toBe(true);
    expect(out[0].mechanismReason).toBe('');
    expect(out[1].mechanismReason).toContain('метилфолат');
  });

  it('вход не мутируется (фолат-аннотация — копия)', () => {
    const fol = ps('folate', 'Фолат', 400);
    const subs = [fol];
    applyGeneticsToPlanSubs(subs, { mthfr: 'c677t' });
    expect(fol.mechanismReason).toBe('');
  });
});

describe('🍽 учёт принятых добавок — PlanSubstance', () => {
  it('нет принятых → тот же объект', () => {
    const subs = [ps('omega3', 'Омега-3', 2000)];
    expect(applyDietAwareToPlanSubs(subs, undefined).subs).toBe(subs);
    expect(applyDietAwareToPlanSubs(subs, []).subs).toBe(subs);
  });

  it('принятая доза ≥ плановой → исключено + заметка «перекрыто»', () => {
    const subs = [ps('omega3', 'Омега-3', 2000), ps('nac', 'NAC', 1200)];
    const { subs: out, notes } = applyDietAwareToPlanSubs(subs, [{ id: 'omega3', doseMg: 2000 }]);
    expect(out.map(s => s.id)).toEqual(['nac']);
    expect(notes[0]).toContain('перекрыто');
  });

  it('частичное перекрытие → остаётся + пометка', () => {
    const { subs: out, notes } = applyDietAwareToPlanSubs([ps('omega3', 'Омега-3', 2000)], [{ id: 'omega3', doseMg: 1000 }]);
    expect(out).toHaveLength(1);
    expect(notes[0]).toContain('частично');
    expect(notes[0]).toContain('1000 из 2000');
  });

  it('дубли принятых по канону → берётся максимум', () => {
    const { subs: out } = applyDietAwareToPlanSubs([ps('omega3', 'Омега-3', 2000)], [
      { id: 'omega3', doseMg: 500 }, { id: 'omega3', doseMg: 2500 },
    ]);
    expect(out).toHaveLength(0);
  });
});

describe('🧬🍽 RecommendedSub (Calc.mapper finalRec)', () => {
  const rs = (id: string, reason = ''): any => ({ substanceId: id, category: 'supplement', k: 0.1, q: 'B', reason, mechsCovered: ['cv1'], priority: 2 });

  it('HFE → железо вычищено; MTHFR → фолат помечен', () => {
    const subs = [rs('iron_bisglycinate'), rs('folate'), rs('nac')];
    const { subs: out, notes } = applyGeneticsToRecSubs(subs, { hfe: 'h63d', mthfr: 'c677t' });
    expect(out.map((s: any) => s.substanceId)).toEqual(['folate', 'nac']);
    expect(out.find((s: any) => s.substanceId === 'folate').reason).toContain('метилфолат');
    expect(notes).toHaveLength(2);
  });

  it('dietAware через doseOf-callback: покрытое исключается', () => {
    const subs = [rs('omega3'), rs('nac')];
    const { subs: out, notes } = applyDietAwareToRecSubs(subs, [{ id: 'omega3', doseMg: 2000 }], (id) => (id === 'omega3' ? { mg: 2000 } : { mg: 1200 }));
    expect(out.map((s: any) => s.substanceId)).toEqual(['nac']);
    expect(notes[0]).toContain('omega3');
  });
});

describe('интеграция runSupportUnified: опции применяются, выкл = прежний план', () => {
  const state = (opts?: CalculatorState['options']): CalculatorState => ({
    ...DEFAULT_STATE,
    pharma: { ...DEFAULT_STATE.pharma, phase: 'course', aas: [{ id: 'test_enan', doseMgWeek: 500, weeks: 12 }] },
    genetics: { ...DEFAULT_STATE.genetics, hfe: 'c282y' } as any,
    nutrition: { ...DEFAULT_STATE.nutrition, takenSupplements: [{ id: 'omega3', doseMg: 2000 }] } as any,
    labs: {
      ...DEFAULT_STATE.labs,
      fullPanel: { date: '2026-01-01', panelIron: { Ferritin: '20' }, panelHematology: { HCT: '45' } } as any,
    },
    options: opts,
  } as CalculatorState);

  it('опции ВЫКЛ: железо в плане (lab-tier по ферритину), optionNotes нет', () => {
    const res = runSupportUnified(state());
    const ids = res.substances.map(s => s.id);
    expect(ids.some(id => id.includes('iron'))).toBe(true);
    expect(res.optionNotes).toBeUndefined();
  });

  it('генетика ON: железо исключено + optionNotes с «Гемохроматоз»', () => {
    const res = runSupportUnified(state({ geneticsOn: true }));
    const ids = res.substances.map(s => s.id);
    expect(ids.some(id => id.includes('iron'))).toBe(false);
    expect(res.optionNotes?.some(n => n.includes('Гемохроматоз'))).toBe(true);
    expect((res.protocolWarnings || []).some(w => w.includes('Гемохроматоз'))).toBe(true);
  });

  it('dietAware ON: омега-3 перекрыта приёмом → исключена с заметкой', () => {
    const s = state({ dietAware: true });
    // план omega3 = 4000 мг (DEFAULT 2×2000) — приём должен покрыть полную дозу
    (s.nutrition as any).takenSupplements = [{ id: 'omega3', doseMg: 4000 }];
    const res = runSupportUnified(s);
    expect(res.substances.some(s => s.id === 'omega3')).toBe(false);
    expect(res.optionNotes?.some(n => n.includes('Омега-3'))).toBe(true);
  });
});
