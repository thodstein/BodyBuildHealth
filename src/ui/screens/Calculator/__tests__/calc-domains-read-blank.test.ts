/**
 * calc-domains-read-blank.test.ts — проход 205: домены читают бланк под тем
 * именем, под которым его отдаёт карта.
 *
 * Класс дефекта: попап собирал `labs = labSliceToValues(...)`, где анализ назван
 * каноном формы (`POTASSIUM`, `HEMATOCRIT`, `ESTRADIOL`, `PROLACTIN`, `GLUCOSE`),
 * а триггеры доменов сравнивали `l.K`, `l.HCT`, `l.E2`, `l.PRL`, `l.GLU`. Ключей
 * не было ни при каком вводе: калий 3.2 не включал «Ритм/ЧСС» и «Электролиты»,
 * HCT 55 — «Эндотелий/тромбоз», E2 60 — «Ароматизацию», пролактин 40 —
 * «Пролактин», глюкоза 7.0 — «Глюкозу/IR», низкий свободный T — «Андрогены».
 * Прежние гарды кормили триггер сразу кодом (`{ K: 3.2 }`) и поэтому дефект не
 * видели: проверялись пороги, а не путь от поля формы.
 *
 * Здесь значение идёт тем же путём, что в интерфейсе:
 * `LabSlice → labSliceToValues → tierLabView → trigger`. Тест без `tierLabView`
 * оставлен как доказательство, что дефект был именно в именах.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_STATE } from '../Calc.types';
import { FULL_PANELS } from '../Calc.lab';
import { SPECIALIZED_DOMAINS } from '../Calc.mapper';
import { labSliceToValues, labValuesForEngine } from '../../../../engines/support-plan/mapper-ctx';
import { tierLabView } from '../../../../data/lab-tier-ranges';
import type { CalculatorState } from '../../../../engines/support-plan/types';

const slice = (panel: string, markers: Record<string, string>, units?: Record<string, string>) =>
  ({ date: '', [panel]: markers, ...(units ? { units: { [panel]: units } } : {}) }) as never;

const state = (sex: 'male' | 'female' = 'male') =>
  ({ ...DEFAULT_STATE, profile: { ...DEFAULT_STATE.profile, sex } }) as CalculatorState;

/** Значение идёт путём интерфейса: бланк → плоская карта → карта написаний. */
const blankLabs = (
  panel: string,
  markers: Record<string, string>,
  sex: 'male' | 'female' = 'male',
  units?: Record<string, string>,
) => tierLabView(labSliceToValues(slice(panel, markers, units), sex));

/** Сырая карта без моста написаний — так домены видели бланк до прохода 205. */
const rawLabs = (panel: string, markers: Record<string, string>, sex: 'male' | 'female' = 'male') =>
  labSliceToValues(slice(panel, markers), sex);

const on = (system: string, id: string, labs: Record<string, number>, sex: 'male' | 'female' = 'male') => {
  const d = (SPECIALIZED_DOMAINS as any)[system].find((x: any) => x.id === id);
  expect(d, `${system}/${id}`).toBeTruthy();
  return d.trigger(labs, state(sex)) as boolean;
};

describe('проход 205: домены читают бланк под его именем', () => {
  it('калий 3.2 включает «Ритм/ЧСС» и «Электролиты», а сырая карта — нет', () => {
    const raw = rawLabs('panelMineral', { Potassium: '3.2' });
    expect(raw['K']).toBeUndefined();
    expect(on('cardio', 'rhythm', raw)).toBe(false);
    expect(on('renal', 'electrolytes', raw)).toBe(false);

    const labs = blankLabs('panelMineral', { Potassium: '3.2' });
    expect(labs['K']).toBe(3.2);
    expect(on('cardio', 'rhythm', labs)).toBe(true);
    expect(on('renal', 'electrolytes', labs)).toBe(true);
  });

  it('HCT 55 включает «Эндотелий/тромбоз»', () => {
    expect(on('cardio', 'endothelium', rawLabs('panelHematology', { HCT: '55' }))).toBe(false);
    expect(on('cardio', 'endothelium', blankLabs('panelHematology', { HCT: '55' }))).toBe(true);
  });

  it('E2 60 у мужчины включает «Ароматизацию», у женщины — нет', () => {
    expect(on('endocrine', 'e2', rawLabs('panelSex', { E2: '60' }))).toBe(false);
    expect(on('endocrine', 'e2', blankLabs('panelSex', { E2: '60' }), 'male')).toBe(true);
    expect(on('endocrine', 'e2', blankLabs('panelSex', { E2: '60' }), 'female')).toBe(false);
  });

  it('пролактин 40 включает «Пролактин»', () => {
    expect(on('endocrine', 'prl', rawLabs('panelSex', { Prolactin: '40' }))).toBe(false);
    expect(on('endocrine', 'prl', blankLabs('panelSex', { Prolactin: '40' }))).toBe(true);
  });

  it('глюкоза 7.0 включает «Глюкозу/IR», 3.0 — «Гипогликемию»', () => {
    expect(on('metabolic', 'glucose', rawLabs('panelBiochem', { Glucose: '7' }))).toBe(false);
    expect(on('metabolic', 'glucose', blankLabs('panelBiochem', { Glucose: '7' }))).toBe(true);
    expect(on('metabolic', 'hypo', blankLabs('panelBiochem', { Glucose: '3' }))).toBe(true);
  });

  it('низкий свободный T включает «Андрогены»', () => {
    expect(on('reproductive', 'androgens', rawLabs('panelSex', { 'Free T': '5' }))).toBe(false);
    expect(on('reproductive', 'androgens', blankLabs('panelSex', { 'Free T': '5' }))).toBe(true);
  });

  it('пустой бланк не включает лабораторные домены (и не выдаёт «норму»)', () => {
    const empty = tierLabView({});
    expect(on('metabolic', 'glucose', empty)).toBe(false);
    expect(on('endocrine', 'e2', empty)).toBe(false);
    expect(on('endocrine', 'prl', empty)).toBe(false);
    expect(on('cardio', 'endothelium', empty)).toBe(false);
  });
});

describe('проход 205: ЩФ — поле бланка, а не мёртвая ветка', () => {
  it('ЩФ есть в форме и включает «Холестаз»', () => {
    expect(FULL_PANELS.flatMap((p) => p.markers)).toContain('ALP');
    expect(on('hepatic', 'cholestasis', blankLabs('panelBiochem', { ALP: '250' }))).toBe(true);
    expect(on('hepatic', 'cholestasis', blankLabs('panelBiochem', { ALP: '90' }))).toBe(false);
  });
});

describe('проход 206: производные доходят до доменов', () => {
  const engineLabs = (panel: string, markers: Record<string, string>, sex: 'male' | 'female' = 'male') =>
    labValuesForEngine(slice(panel, markers), sex, 30);

  it('глюкоза + инсулин включают «Глюкозу/IR» через HOMA-IR', () => {
    // 5.4 × 20 / 22.5 = 4.8 — выше верхней нормы HOMA-IR 2.5.
    expect(on('metabolic', 'glucose', engineLabs('panelBiochem', { Glucose: '5.4', Insulin: '20' }))).toBe(true);
    // Без инсулина HOMA-IR нет: сама глюкоза 5.4 в норме, находки быть не должно.
    expect(on('metabolic', 'glucose', engineLabs('panelBiochem', { Glucose: '5.4' }))).toBe(false);
  });

  it('ферритин судится по порогу своего пола', () => {
    // `SCREEN_TARGETS.FERRITIN`: ♀ 150, ♂ 300. Литерал 300 был мужским порогом,
    // поэтому женский ферритин 200 не включал «Оксидативный стресс».
    const labs = engineLabs('panelIron', { Ferritin: '200' });
    expect(on('hepatic', 'oxidative', labs, 'female')).toBe(true);
    expect(on('hepatic', 'oxidative', labs, 'male')).toBe(false);
  });
});

describe('проход 205: попап переводит карту до решения', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/Calculator/Calc.mapper.tsx'), 'utf8');

  // Проход 206: попап больше не собирает свою цепочку — он берёт карту движка
  // риска (`labValuesForEngine`), которая внутри и есть `tierLabView(
  // labSliceToValues(...))` плюс производные. Гард держит оба звена: попап
  // зовёт общий читатель, а общий читатель переводит написания.
  it('домены получают карту написаний, а не сырую карту формы', () => {
    expect(src).toContain('labValuesForEngine(currentLabSlice(state.labs)');
    const engineSrc = readFileSync(
      resolve(process.cwd(), 'src/engines/support-plan/mapper-ctx.ts'),
      'utf8',
    );
    expect(engineSrc).toContain('tierLabView(labSliceToValues(');
    expect(src).not.toMatch(
      /const labs = labSliceToValues\(currentLabSlice\(state\.labs\), state\.profile\.sex\);\s*\n\s*const domains = SPECIALIZED_DOMAINS/,
    );
  });

  it('домен PLT читается мостом, а не сырым ключом', () => {
    expect(src).not.toContain(`labs['PLT']`);
    expect(src).toContain(`labValueFrom(labs, 'PLT')`);
  });
});
