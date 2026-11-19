/**
 * lab-urine-canon.test.ts — проход 139: у мочи свои имена анализов.
 *
 * `labSliceToValues` — единственный переход «бланк → MapperCtx» (мост механизмов,
 * ступени, синергии). Подпись поля там превращалась в канон механической заменой
 * пробелов, поэтому поля общего анализа мочи носили имена крови:
 *  - `Glucose` мочи 2.8 перезаписывала глюкозу крови (или подставлялась вместо неё)
 *    и давала ступень 3: «⛔ тяжёлая гипогликемия/кетоацидоз, ОТМЕНИТЬ GH и инсулин»
 *    из данных мочи — при том, что анализ мочи ни о гликемии, ни о кетоацидозе
 *    крови ничего не доказывает;
 *  - `Leukocytes` мочи 10 становились лейкоцитами крови;
 *  - белок мочи приходил как `PROTEIN`, а не его канон `PROTEIN_URINE`.
 *
 * Теперь канон выбирается с панелью (`labMarkerCanon(marker, panel)`), поэтому
 * анализ мочи больше не занимает место крови и не выдаёт чужих советов.
 */
import { describe, it, expect } from 'vitest';
import { labSliceToValues } from '../mapper-ctx';
import { labMarkerCanon } from '../lab-marker-name';
import { calcLabDeltas } from '../engine-helpers';
import { computeTierAdjustments } from '../../../data/lab-tier-recommendations';
import { deriveTier } from '../../../data/lab-tier-ranges';
import { DEFAULT_STATE } from '../../../ui/screens/Calculator/Calc.types';

const slice = (panels: Record<string, Record<string, string>>) =>
  ({ date: '2026-10-01', ...panels } as any);

describe('проход 139: анализ мочи не носит имя крови', () => {
  it('глюкоза мочи не затирает глюкозу крови', () => {
    const labs = labSliceToValues(slice({
      panelBiochem: { Glucose: '5.5' },
      panelUrinalysis: { Glucose: '2.8' },
    }));
    expect(labs.GLUCOSE).toBe(5.5);
    expect(labs.URINE_GLUCOSE).toBe(2.8);
  });

  it('глюкоза мочи без глюкозы крови не становится кровяной', () => {
    const labs = labSliceToValues(slice({ panelUrinalysis: { Glucose: '2.8' } }));
    expect(labs.GLUCOSE).toBeUndefined();
    // И ступеней у неё нет: шкалы мочи в `LAB_TIERS` нет, пороги не выдумываем.
    expect(computeTierAdjustments(labs, 'male').alerts).toHaveLength(0);
    expect(deriveTier('URINE_GLUCOSE', 2.8, 'male')).toBe(0);
  });

  it('остальные поля мочи получают свои ключи', () => {
    const labs = labSliceToValues(slice({
      panelUrinalysis: { pH: '6', Ketones: '2', Leukocytes: '10', Nitrite: '1' },
    }));
    expect(labs).toMatchObject({
      URINE_PH: 6, URINE_KETONES: 2, URINE_LEUKOCYTES: 10, URINE_NITRITE: 1,
    });
    for (const bad of ['PH', 'KETONES', 'LEUKOCYTES', 'NITRITE']) {
      expect(labs[bad]).toBeUndefined();
    }
  });

  it('белок мочи остаётся своим каноном PROTEIN_URINE и сохраняет ступень', () => {
    const labs = labSliceToValues(slice({ panelUrinalysis: { Protein: '1.5' } }));
    expect(labs.PROTEIN_URINE).toBe(1.5);
    expect(labs.PROTEIN).toBeUndefined();
    expect(deriveTier('PROTEIN_URINE', 1.5, 'male')).toBe(3);
    const adj = computeTierAdjustments(labs, 'male');
    expect(adj.alerts.some(a => a.marker === 'PROTEIN_URINE')).toBe(true);
  });

  it('канон без панели не изменился — моча отличается только по панели', () => {
    expect(labMarkerCanon('Glucose')).toBe('GLUCOSE');
    expect(labMarkerCanon('Glucose', 'panelUrinalysis')).toBe('URINE_GLUCOSE');
    expect(labMarkerCanon('Protein', 'panelUrinalysis')).toBe('PROTEIN_URINE');
    expect(labMarkerCanon('Total T')).toBe('TESTOSTERONE');
  });

  it('динамика: глюкоза крови и мочи — две разные строки', () => {
    const state = {
      ...DEFAULT_STATE,
      labs: {
        preCourse: slice({
          panelBiochem: { Glucose: '5.5' },
          panelUrinalysis: { Glucose: '2.8' },
        }),
        midCourse: slice({
          panelBiochem: { Glucose: '5.9' },
          panelUrinalysis: { Glucose: '3.1' },
        }),
        postPCT: null,
        fullPanel: null,
      },
    } as any;
    const d = calcLabDeltas(state);
    const blood = d.find(x => x.marker === 'Glucose' && x.panel === 'panelBiochem')!;
    const urine = d.find(x => x.marker === 'Glucose' && x.panel === 'panelUrinalysis')!;
    expect(blood.sliceValues.slice(0, 2)).toEqual(['5.5', '5.9']);
    expect(urine.sliceValues.slice(0, 2)).toEqual(['2.8', '3.1']);
  });
});

describe('проход 139: ApoB из формы доходит до своей лестницы', () => {
  it('APOB переводится в шкалу APO_B', () => {
    expect(deriveTier('APOB', 1.5, 'male')).toBe(deriveTier('APO_B', 1.5, 'male'));
    expect(deriveTier('APOB', 1.5, 'male')).toBeGreaterThan(0);
  });

  it('совет по ApoB не теряется и не задваивается', () => {
    const fromForm = computeTierAdjustments({ APOB: 1.5 }, 'male');
    const fromScale = computeTierAdjustments({ APO_B: 1.5 }, 'male');
    expect(fromForm.addSubs.map(s => s.id)).toEqual(fromScale.addSubs.map(s => s.id));
    expect(fromForm.alerts.map(a => a.message)).toEqual(fromScale.alerts.map(a => a.message));
    // 1.5 г/л — ступень 2: у правила есть добавки, значит совет виден.
    expect(fromForm.addSubs.length).toBeGreaterThan(0);
    // Псевдоним не должен давать вторую строку, когда пришли оба имени.
    const both = computeTierAdjustments({ APOB: 1.5, APO_B: 1.5 }, 'male');
    expect(both.tierSummary).toHaveLength(fromScale.tierSummary.length);
    expect(both.addSubs).toHaveLength(fromScale.addSubs.length);
  });
});
