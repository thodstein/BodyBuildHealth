import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROTEIN_G_PER_KG_RANGE, PROTEIN_G_PER_KG_RANGE_NOTE, PROTEIN_PRESETS } from '../types';

// ─── E1.7 (A15): диапазон белка 1.6–2.2 г/кг — это РЕШЕНИЕ, а не цитата ───
//
// Дефект: UI писал «Базовый диапазон белка: 1.6–2.2 г/кг массы» как факт, рядом в коде
// висели ссылки на Jager 2017 / Morton 2018 / Mountjoy-IOC 2023 — но НИ ОДИН из них не даёт
// ровно «1.6–2.2». Это выбранный для продукта коридор. Тот же класс, что E1.5 (потребность
// ≠ доза добавки) и E1.1 (Pontzer): пользователю показывают решение как цитату.
//
// Вторая половина эпика: не смешивать с сывороточными 30–35 г/сут (Li 2026). Там 30–35 —
// это ДОБАВЛЕННЫЙ сывороточный белок (плато отклика), а не общий суточный.
describe('E1.7 / A15: подпись под диапазоном белка — решение, а не источник', () => {
  it('подпись существует и непустая', () => {
    expect(PROTEIN_G_PER_KG_RANGE_NOTE.length).toBeGreaterThan(80);
  });

  it('прямо говорит, что это решение приложения, а не цитата', () => {
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).toContain('решение этого приложения');
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).toContain('а не цитата из одного источника');
  });

  it('называет источники как согласующиеся, но НЕ как цитату коридора', () => {
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).toContain('Morton 2018');
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).toContain('сходятся');
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).toContain('коридор выбран нами');
  });

  it('A15: 30–35 г/сут Li 2026 отнесены к ДОБАВЛЕННОМУ сывороточному, не к общему', () => {
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).toContain('30–35 г/сут');
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).toContain('ДОБАВЛЕННОМУ сывороточному');
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).toContain('не обосновано');
    // ключевая честность: число НЕ обосновывает верхнюю границу
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).toContain('верхней границей 2.2 г/кг оно не обосновано');
  });

  it('подпись не выдаёт себя за персональную норму «для вас»', () => {
    // подпись про источник диапазона, а не про конкретного человека
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).not.toContain('вам нужно');
    expect(PROTEIN_G_PER_KG_RANGE_NOTE).not.toMatch(/рекоменд(уем|аем)/i);
  });

  it('в UI подпись реально рендерится, а не лежит мёртвой константой', () => {
    const ui = readFileSync(join(__dirname, '..', 'IndividualPlanSettings.tsx'), 'utf8');
    // ВАЖНО: проверять `toContain('PROTEIN_G_PER_KG_RANGE_NOTE')` БЕССМЫСЛЕННО — это имя
    // есть и в импорте, и в комментарии, поэтому такая проверка зелёная даже если
    // подпись в разметке заменить своим текстом (проверено мутацией). Поэтому требуем
    // ИМЕННО узел рендера: отдельная строка, равная интерполяции.
    const lines = ui.split('\n');
    const renderSites = lines.filter(l => l.trim() === '{PROTEIN_G_PER_KG_RANGE_NOTE}');
    expect(renderSites.length).toBeGreaterThan(0);
    // и импортируется из types (единый источник), а не скопирован текстом
    expect(ui).toMatch(/import\s*\{[^}]*PROTEIN_G_PER_KG_RANGE_NOTE[^}]*\}\s*from\s*"\.\/types"/);
  });

  it('регрессия: пресеты белка не вылезают за коридор', () => {
    // кламп в buildDayTargets держит 1.6–2.2, значит и пресеты обязаны быть внутри
    for (const p of PROTEIN_PRESETS) {
      expect(p.gPerKg).toBeGreaterThanOrEqual(PROTEIN_G_PER_KG_RANGE.min);
      expect(p.gPerKg).toBeLessThanOrEqual(PROTEIN_G_PER_KG_RANGE.max);
    }
  });

  it('регрессия: сывороточные 30–35 г не выданы за цель по белку в UI', () => {
    const ui = readFileSync(join(__dirname, '..', 'IndividualPlanSettings.tsx'), 'utf8');
    // проверяем НАМЕРЕНИЕ, а не форматирование: 30–35 нельзя ставить рядом с целевым
    // языком («цель/нужно/норма/съедай»). Комментарии и подпись-оговорка не считаются:
    // там число как раз объясняется и отводится от роли цели.
    const lines = ui.split('\n');
    const asTarget = lines.filter(l =>
      /30[–-]35/.test(l) && /(цель|нужно|норма|съедай|добавка)/i.test(l));
    expect(asTarget).toEqual([]);
    // и подстраховка: число встречается в файле только внутри комментария-объяснения
    const mentions = lines.filter(l => /30[–-]35/.test(l));
    expect(mentions.length).toBeGreaterThan(0); // оговорка не потеряна
    expect(mentions.every(l => /Li 2026/.test(l))).toBe(true); // и она про то самое число
  });
});
