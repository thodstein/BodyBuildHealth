import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';
import { rankCorrectives, BB_CORRECTIVES } from '../../../../engines/bb/bb-corrective.engine';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

/**
 * K5-контракт: `BBExercise` НЕ хранит `exerciseId` — билдер кладёт в `exerciseName`
 * ОТОБРАЖАЕМОЕ имя. Значит хаб передаёт в гейт ИМЕНА, и гейт обязан их понимать.
 * Раньше он сверял только id → отсечение «уже в плане» не срабатывало НИКОГДА, и карточка
 * предлагала упражнение, которое пользователь уже делает (а инъекция молча его пропускала).
 */
const catName = (id: string) => {
  const e = (EXERCISE_CATALOG as any[]).find((x) => String(x.id).toLowerCase() === id.toLowerCase());
  return String(e?.name || '');
};

/** План в том виде, в каком его реально пишет билдер: exerciseName = имя, id НЕТ. */
function planWithExercise(displayName: string) {
  return {
    pattern: { id: 'p', name: 'P', sessionsPerRotation: 4 },
    weeks: [{
      week: 1,
      sessions: [{
        day: 1, weekOffset: 0, character: 'heavy',
        exercises: [{ muscle: 'quads', name: displayName, exerciseName: displayName, sets: 3, repsRange: [8, 12], rir: 2, role: 'primary', character: 'heavy', workSets: [] }],
      }],
    }],
    rationale: [], level: 'intermediate',
  };
}

describe('K5: упражнение уже в плане (по имени, как реально пишет билдер)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('движок: имя из плана отсекает и запись библиотеки, и её альтернативу остаются', () => {
    const top = rankCorrectives({ zones: ['quads'] })[0].corr;
    const names = [catName(top.exerciseId), top.title];
    const r = rankCorrectives({ zones: ['quads'], inPlanIds: names });
    expect(r.map((x) => x.corr.exerciseId)).not.toContain(top.exerciseId);
    expect(r.length).toBeGreaterThan(0);
  });

  it('движок: id и имя каталога отсекают ВСЕ записи этого упражнения; title — запись с этим заголовком', () => {
    const top = rankCorrectives({ zones: ['quads'] })[0].corr;
    // Упражнение может делить несколько записей библиотеки (bulgarian_split_db), поэтому
    // сверка по «упражнению в плане» обязана убрать их все, а не только запись с этим title.
    const shared = BB_CORRECTIVES.filter((c: any) => c.exerciseId === top.exerciseId).map((c: any) => c.id);
    expect(shared.length).toBeGreaterThan(0);

    for (const form of [top.exerciseId, catName(top.exerciseId)]) {
      const r = rankCorrectives({ zones: ['quads'], inPlanIds: [form] });
      expect(r.map((x) => x.corr.exerciseId), `форма «${form}»`).not.toContain(top.exerciseId);
    }
    // title — идентичность записи библиотеки (в плане его не бывает, гейт остаётся защитным).
    const byTitle = rankCorrectives({ zones: ['quads'], inPlanIds: [top.title] });
    expect(byTitle.map((x) => x.corr.id)).not.toContain(top.id);
  });

  it('хаб: карточка не предлагает упражнение, которое уже в плане', () => {
    const top = rankCorrectives({ zones: ['glutes'] })[0].corr;
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['glutes'] }));
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: planWithExercise(catName(top.exerciseId)), date: '2026-01-01T00:00:00.000Z' }));
    render(<BBDiagnosticsHub />);
    const picks = Array.from(document.querySelectorAll('[data-bb="corrective-pick"]'));
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.map((p) => p.getAttribute('data-corr'))).not.toContain(top.id);
  });

  it('хаб: есть честная пометка, сколько вариантов скрыто как «уже в плане»', () => {
    const top = rankCorrectives({ zones: ['glutes'] })[0].corr;
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['glutes'] }));
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: planWithExercise(catName(top.exerciseId)), date: '2026-01-01T00:00:00.000Z' }));
    render(<BBDiagnosticsHub />);
    const note = document.querySelector('[data-bb="corrective-inplan-note"]');
    expect(note).toBeTruthy();
    expect(note!.textContent).toMatch(/уже есть в плане/);
    expect(note!.textContent).toMatch(/альтернатив/i);
  });

  it('хаб: без совпадений с планом пометки нет (не шумит)', () => {
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ weakManual: ['glutes'] }));
    render(<BBDiagnosticsHub />);
    expect(document.querySelector('[data-bb="corrective-inplan-note"]')).toBeFalsy();
  });

  it('хаб: ⭐-выбор, который уже в плане, не обещает «попадёт в инъекцию»', () => {
    // Регресс честности: выбранное упражнение после вставки прячется гейтом K5 (оно теперь
    // в плане), но prefCorr остаётся в состоянии → подпись обещала бы вставку, которой не будет.
    const top = rankCorrectives({ zones: ['glutes'] })[0].corr;
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({
      weakManual: ['glutes'], prefCorr: { glutes: top.id },
    }));
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan: planWithExercise(catName(top.exerciseId)), date: '2026-01-01T00:00:00.000Z' }));
    render(<BBDiagnosticsHub />);
    const note = document.querySelector('[data-bb="corrective-pick-note"]')!;
    expect(note.textContent).not.toMatch(/попадёт в инъекцию/);
    expect(note.textContent).toMatch(/Выбор снят|не выбрано/);
  });
});
