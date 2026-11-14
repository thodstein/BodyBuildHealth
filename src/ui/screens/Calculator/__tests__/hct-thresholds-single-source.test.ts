/**
 * hct-thresholds-single-source.test.ts — проход 39: порог гематокрита один.
 *
 * Первичная модель (`risk-engine-tz-spec`, `HCT_THRESHOLDS`): эритроцитоз
 * ♂ ≥51 / ♀ ≥48, порог флеботомии ♂ ≥54 / ♀ ≥52. От него теперь считаются
 * ВСЕ три потребителя: подпись уровня, баннер и состояние лабораторий
 * (`hctCuts`) — 48/52/54 (♂) и 44/48/52 (♀).
 *
 * Дефект до прохода: на одном экране жили три шкалы (подпись 48/52/57,
 * состояние 52/56/60, баннер 57), а в текстах каталога тот же порог стоял
 * как 55 и 57. Читатель видел четыре разных числа для «флеботомии».
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { hctCuts, hctGradationLabel, deriveStateFromLabs } from '../Calc.labs-derived';
import { clinicalFloorsForLabs, HCT_THRESHOLDS } from '../../../../engines/risk-engine-tz-spec';
import { HCT_THRESHOLDS as HCT_THRESHOLDS_FROM_LAB_NORMS } from '../../../../engines/lab-norms.engine';
import { STOP_COURSE_TABLE } from '../../SupportScreen_parts/supportProtocolsShared';

const ROOT = resolve(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe('гематокрит: одна шкала на подпись, баннер и состояние', () => {
  it('hctCuts: ♂ 48/52/54, ♀ 44/48/52', () => {
    expect(hctCuts('male')).toEqual({ correction: 48, therapy: 52, urgent: 54 });
    expect(hctCuts('female')).toEqual({ correction: 44, therapy: 48, urgent: 52 });
    expect(hctCuts()).toEqual(hctCuts('male'));
  });

  it('ургент совпадает с порогом флеботомии первичной модели', () => {
    expect(hctCuts('male').urgent).toBe(HCT_THRESHOLDS.male.block);
    expect(hctCuts('female').urgent).toBe(HCT_THRESHOLDS.female.block);
  });

  it('женские производные пороги резолвера — та же шкала', async () => {
    const { FEMALE_HCT_THERAPY, FEMALE_HCT_URGENT } = await import('../../../../engines/lab-norms.engine');
    expect(HCT_THRESHOLDS.female.erythrocytosis).toBe(FEMALE_HCT_THERAPY);
    expect(HCT_THRESHOLDS.female.block).toBe(FEMALE_HCT_URGENT);
    expect(HCT_THRESHOLDS).toBe(HCT_THRESHOLDS_FROM_LAB_NORMS);
  });

  it('подпись и состояние не расходятся: 54 ♂ / 52 ♀ — ургент с двух сторон', () => {
    expect(hctGradationLabel(53, 'male')).toBe('🟠 терапия');
    expect(hctGradationLabel(54, 'male')).toBe('🔴 ургент');
    expect(hctGradationLabel(51, 'female')).toBe('🟠 терапия');
    expect(hctGradationLabel(52, 'female')).toBe('🔴 ургент');
    // Состояние: та же граница даёт «severe» (контраиндикация тромбофилии)
    expect(deriveStateFromLabs(hctSlice(53), 'male').cardio.hctElevation).not.toBe('severe');
    expect(deriveStateFromLabs(hctSlice(54), 'male').cardio.hctElevation).toBe('severe');
    expect(deriveStateFromLabs(hctSlice(51), 'female').cardio.hctElevation).not.toBe('severe');
    expect(deriveStateFromLabs(hctSlice(52), 'female').cardio.hctElevation).toBe('severe');
  });

  it('нижние ступени тоже из шкалы: 48 ♂ / 44 ♀ — уже коррекция', () => {
    expect(hctGradationLabel(47, 'male')).toBe('🟢 норма');
    expect(hctGradationLabel(48, 'male')).toBe('🟡 коррекция');
    expect(hctGradationLabel(43, 'female')).toBe('🟢 норма');
    expect(hctGradationLabel(44, 'female')).toBe('🟡 коррекция');
    expect(deriveStateFromLabs(hctSlice(48), 'male').cardio.hctElevation).toBe('mild');
    expect(deriveStateFromLabs(hctSlice(44), 'female').cardio.hctElevation).toBe('mild');
  });
});

describe('гематокрит: первичная модель', () => {
  it('clinicalFloorsForLabs: ♂ 51/54, ♀ 48/52', () => {
    const labels = (hct: number, sex: 'male' | 'female') =>
      clinicalFloorsForLabs({ HCT: hct }, sex)
        .filter(f => f.organId === 'hematologic')
        .map(f => `${f.level}:${f.label}`)
        .join(' | ');
    expect(labels(51, 'male')).toMatch(/эритроцитоз/i);
    expect(labels(54, 'male')).toMatch(/флеботоми/i);
    expect(labels(50, 'male')).not.toMatch(/флеботоми/i);
    expect(labels(48, 'female')).toMatch(/эритроцитоз/i);
    expect(labels(52, 'female')).toMatch(/флеботоми/i);
    expect(labels(50, 'female')).not.toMatch(/флеботоми/i);
  });
});

describe('гематокрит: тексты не вводят своих чисел', () => {
  it('нигде нет порога HCT 55–59 % (это дрейф между 54 и 60)', () => {
    // Ловим две формы, в которых дрейф реально жил: сравнение («HCT >55»,
    // «гематокрит ≥55 %») и диапазон («Hct 52-57%»). Старый шаблон знал только
    // литерал `HCT > 55`, из-за чего 55 в стеке и 52–57 в каталоге молчали.
    const CMP = /(?:[Hh][Cc][Tt]|гематокрит)[^%.;\n]{0,20}?(?:>|≥|>=)\s*=?\s*(5[5-9])\s*%/;
    const RANGE = /(?:[Hh][Cc][Tt]|гематокрит)[^%.;\n]{0,25}?\d{1,2}(?:[.,]\d+)?\s*[-–—]\s*(5[5-9])\s*%/;
    const bad: string[] = [];
    for (const p of walk(ROOT)) {
      readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (CMP.test(line) || RANGE.test(line)) {
          bad.push(`${relative(process.cwd(), p)}:${i + 1} — ${line.trim().slice(0, 100)}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it('в данных и движках действия с HCT называют женский порог', () => {
    const bad: string[] = [];
    const dirs = ['src/data', 'src/engines'].map(d => resolve(process.cwd(), d));
    for (const dir of dirs) {
      for (const p of walk(dir)) {
        // Специализированный женский блок («Женщины и ААС», правило 4): его
        // пороги женские по определению, мужской половины там нет.
        if (/supportProtocolWomen/.test(p)) continue;
        readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // комментарий, не текст для пользователя
          if (!/флеботом|эритроцитаферез|кровопускание|забор крови/i.test(line)) return;
          // Порог должен стоять РЯДОМ с HCT: иначе «%» из соседнего показателя
          // (HDL −40%, PLT 400) даёт ложное срабатывание на длинных строках.
          if (!/(?:[Hh][Cc][Tt]|[Гг]ематокрит)[^.;]{0,45}?\d{2}(?:[.,]\d+)?\s*%/.test(line)) return;
          if (/♀|женск/i.test(line)) return;
          bad.push(`${relative(process.cwd(), p)}:${i + 1} — ${line.trim().slice(0, 100)}`);
        });
      }
    }
    expect(bad).toEqual([]);
  });

  it('в UI действия с HCT называют женский порог', () => {
    // Та же проверка для `src/ui`, куда прежний гард не смотрел: «При Hct >54% —
    // флеботомия» в общей карточке читала женщина, у которой порог 52.
    // Исключение — файл с явной оговоркой, что лестница ниже мужская (Гематология).
    const root = resolve(process.cwd(), 'src/ui');
    const bad: string[] = [];
    let scanned = 0;
    for (const p of walk(root)) {
      // Специализированный женский блок — только женские пороги по замыслу.
      if (/supportProtocolWomen/.test(p)) continue;
      const src = readFileSync(p, 'utf8');
      if (/♀ Женщины|к женщинам не применяются/.test(src)) continue;
      scanned++;
      src.split(/\r?\n/).forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (!/флеботом|эритроцитаферез|кровопускание|забор крови/i.test(line)) return;
        if (!/(?:[Hh][Cc][Tt]|[Гг]ематокрит)[^.;]{0,45}?\d{2}(?:[.,]\d+)?\s*%/.test(line)) return;
        if (/♀|женск/i.test(line)) return;
        bad.push(`${relative(process.cwd(), p)}:${i + 1} — ${line.trim().slice(0, 100)}`);
      });
    }
    expect(scanned).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });

  it('канонические строки называют оба пола', () => {
    const rows = STOP_COURSE_TABLE.filter(r => /Hct/i.test(r.cond));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.cond).toMatch(/54/);
      expect(r.cond).toMatch(/♀\s*>?\s*52|52/);
    }
  });
});

/** Мини-срез лабораторий с одним HCT (панель гематологии). */
function hctSlice(v: number) {
  return { panelHematology: { HCT: String(v) } } as never;
}
