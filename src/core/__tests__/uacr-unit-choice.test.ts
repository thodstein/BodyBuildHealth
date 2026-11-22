// uacr-unit-choice.test.ts — UACR: две единицы одной величины и один фактор KDIGO.
//
// До прохода 207 в бланке не было выбора единицы для UACR, а панель «Белок/почки»
// считала запись без единицы как мг/ммоль. 5.65 мг/ммоль — это A2 (50 мг/г), но
// читалось как 5.65 мг/г, то есть норма: альбуминурия исчезала из находок.
// Фактор один на всех читателей — KDIGO 2024 (Kidney Int 105(4S):S117–S314,
// PMID 38490803, S127): мг/г × 0.113 = мг/ммоль.
import { describe, it, expect } from 'vitest';
import {
  LAB_UNIT_CHOICES,
  LAB_UNIT_READ,
  UCUM_MAP,
  readLabValue,
  UACR_MG_G_TO_MG_MMOL,
  UACR_MG_MMOL_TO_MG_G,
} from '../constants';

describe('UACR: единица бланка и канон', () => {
  it('фактор KDIGO один и обратимый', () => {
    expect(UACR_MG_G_TO_MG_MMOL).toBe(0.113);
    expect(UACR_MG_MMOL_TO_MG_G).toBeCloseTo(8.8496, 4);
    expect(50 * UACR_MG_G_TO_MG_MMOL * UACR_MG_MMOL_TO_MG_G).toBeCloseTo(50, 6);
  });

  it('в бланке выбор единицы есть, канон — мг/г', () => {
    expect(LAB_UNIT_CHOICES['UACR']).toEqual(['мг/г', 'мг/ммоль']);
    expect(LAB_UNIT_READ['UACR'].canon).toBe('мг/г');
    expect(UCUM_MAP['UACR'].prefUnit).toBe('mg/g');
  });

  it('запись в мг/ммоль читается как мг/г, а не как «норма»', () => {
    // 5.65 мг/ммоль = 50 мг/г (A2). Без записи в таблице это было бы 5.65 мг/г.
    expect(readLabValue('UACR', 5.65, 'мг/ммоль').value).toBeCloseTo(50, 1);
    // латинское написание из бланка сводится к канону
    expect(readLabValue('UACR', 5.65, 'mg/mmol').value).toBeCloseTo(50, 1);
    // канон не пересчитывается
    expect(readLabValue('UACR', 50, 'мг/г')).toEqual({ value: 50, guessed: false });
  });
});
