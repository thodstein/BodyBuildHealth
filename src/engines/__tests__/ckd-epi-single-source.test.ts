/**
 * ckd-epi-single-source.test.ts — проход 133: СКФ считается одним кодом.
 *
 * CKD-EPI 2021 жила в двух местах. В риск-модели (`support-plan/engine-helpers`)
 * коэффициенты были верные, а в индексах здоровья (`clinical-indices.engine`) —
 * смешанные: константа 142, женский множитель 1.012 и `0.9938^возраст` из редакции
 * 2021, а показатели степени `−0.329/−0.411` из редакции 2009. Для креатинина ниже
 * каппа (женщины, низкая мышечная масса) это давало разные числа СКФ на одном бланке.
 *
 * Проход 166: третья копия нашлась в панели «Белок и почки»
 * (`protein-kidney-tolerance.engine`) — теперь она делегирует тому же расчёту.
 * Мёртвые контуры (`health-score.engine`, `clinical-indices.engine`) удалены:
 * первый никто не вызывал, второй подставлял «норму» 5.0/6.0/550 за отсутствующие
 * анализы и жил только ради этого гарда.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ckdEpi2021 } from '../lab-norms.engine';
import { ckdEpi2021 as pkCkdEpi2021 } from '../protein-kidney-tolerance.engine';

describe('проход 133: CKD-EPI 2021 — один расчёт', () => {
  it('числа редакции 2021: мужчина 40 лет, креатинин 80 → 110', () => {
    expect(ckdEpi2021(80, 40, 'male')).toBeCloseTo(110.0, 1);
    // Женщина при том же креатинине ниже — каппа 0.7 и множитель 1.012.
    expect(ckdEpi2021(80, 40, 'female')).toBeCloseTo(82.3, 1);
    expect(ckdEpi2021(80, 40, 'female')).toBeLessThan(ckdEpi2021(80, 40, 'male'));
    // Возраст снижает фильтрацию.
    expect(ckdEpi2021(120, 60, 'male')).toBeCloseTo(59.7, 1);
  });

  it('без пола — мужской путь, как во всей модели', () => {
    expect(ckdEpi2021(80, 40)).toBe(ckdEpi2021(80, 40, 'male'));
    expect(ckdEpi2021(80, 40, null)).toBe(ckdEpi2021(80, 40, 'male'));
  });

  it('непригодный вход не даёт числа', () => {
    expect(Number.isNaN(ckdEpi2021(0, 40, 'male'))).toBe(true);
    expect(Number.isNaN(ckdEpi2021(80, 0, 'male'))).toBe(true);
    expect(Number.isNaN(ckdEpi2021(NaN, 40, 'male'))).toBe(true);
  });

  it('панель «Белок и почки» считает СКФ той же функцией, а не своей копией', () => {
    expect(pkCkdEpi2021(200, 60, 'male')).toBe(ckdEpi2021(200, 60, 'male'));
    expect(pkCkdEpi2021(200, 60, 'female')).toBe(ckdEpi2021(200, 60, 'female'));
    expect(pkCkdEpi2021(200, 60, 'female')).toBeLessThan(pkCkdEpi2021(200, 60, 'male'));
    // Непригодный вход — то же правило, а не 0/Infinity.
    expect(Number.isNaN(pkCkdEpi2021(0, 60, 'male'))).toBe(true);
  });

  it('второй формулы СКФ в исходниках не осталось', () => {
    const root = resolve(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') continue;
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          files.push(full);
        }
      }
    };
    walk(root);
    const offenders = files.filter(f => {
      if (f.endsWith(join('engines', 'lab-norms.engine.ts'))) return false;
      const src = readFileSync(f, 'utf8');
      return /Math\.pow\(0\.9938/.test(src) || /-0\.329|-0\.411/.test(src);
    }).map(f => f.slice(root.length + 1));
    expect(offenders, `своя формула СКФ осталась в: ${offenders.join(', ')}`).toEqual([]);
  });
});
