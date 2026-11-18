/**
 * lab-bound-note.test.tsx — проход 131: граница вместо числа.
 *
 * Бланки печатают «>1000» ферритина и «<0.5» СРБ. `parseFloat` на такой строке даёт
 * NaN, и анализ пропадал целиком: перегрузка железом не давала ни находки, ни вклада
 * в риск. Движок теперь читает границу как её число (иначе данные теряются), а экран
 * обязан сказать, что это граница, а не измерение — иначе «1000» выглядит точным.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { labBoundNotes } from '../Calc.lab';

describe('проход 131: баннер «граница вместо числа»', () => {
  it('называет поле, напечатанную границу и прочитанное число', () => {
    const notes = labBoundNotes({
      date: '2026-01-10',
      panelIron: { Ferritin: '>1000' },
      panelBiochem: { CRP: '<0,5' },
    } as never);
    expect(notes.map(n => n.text)).toEqual(['Ферритин «>1000» → 1000', 'СРБ «<0,5» → 0.5']);
  });

  it('обычные числа и пустые поля в баннер не попадают', () => {
    expect(labBoundNotes({
      date: '',
      panelBiochem: { CRP: '7', ALT: '' },
      panelSex: { E2: '35' },
    } as never)).toEqual([]);
    expect(labBoundNotes(null)).toEqual([]);
    expect(labBoundNotes(undefined)).toEqual([]);
  });

  it('границу без числа показывает без выдуманного значения', () => {
    const notes = labBoundNotes({ date: '', panelBiochem: { CRP: '>' } } as never);
    expect(notes.map(n => n.text)).toEqual(['СРБ «>»']);
  });

  it('экран риска печатает баннер и передаёт в него слайс анализов', () => {
    const src = readFileSync(resolve(__dirname, '..', 'AutoCalculator.tsx'), 'utf8');
    expect(src).toContain('data-lab-bound-note');
    expect(src).toContain('labBoundNotes(slice)');
  });
});
