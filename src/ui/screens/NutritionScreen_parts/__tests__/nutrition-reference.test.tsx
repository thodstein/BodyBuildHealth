/**
 * Справочник питания — guard-тесты P0-правок 2026.
 * Ловят откат к старым догмам (окно 60-90 мин, потолок 50 г, лейцин 3-4 г)
 * и проверяют гигиену (один поиск, динамические счётчики, дисклеймер).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  NUTRITION_RULES,
  INSULIN_GUIDE,
  INSULIN_DISCLAIMER,
  RECOMMENDED_FOODS,
  FOOD_SYNERGIES,
  RESTRICTED,
  RDA_ROWS,
  GI_ROWS,
  DIAAS_TIERS,
} from '../nutrition-reference-data';
import { NUTRI_ADVISOR_FAQ } from '../NutriAdvisor';
import { NutritionReference } from '../NutritionReference';

describe('nutrition-reference data P0', () => {
  it('правила: нет догмы узкого окна — есть окно 4–6 ч', () => {
    const win = NUTRITION_RULES.find(r => r.title.includes('окно'));
    expect(win).toBeDefined();
    expect(win!.body).toContain('4–6');
    // Старая формулировка «в первые 60-90 минут» как предписание должна отсутствовать
    const prescriptive = NUTRITION_RULES.filter(r => /в первые 60.90 минут/.test(r.body) && !/не существует/.test(r.body));
    expect(prescriptive).toHaveLength(0);
  });

  it('белок — формулой, а не потолком 50 г', () => {
    const prot = NUTRITION_RULES.find(r => r.title.includes('Белковая оптимизация'));
    expect(prot).toBeDefined();
    expect(prot!.body).toContain('1.6–2.2');
    expect(prot!.body).toContain('0.4–0.55');
    expect(prot!.dose).toBeDefined();
  });

  it('лейцин — 1.8–2.5 г, приоритет сумме', () => {
    const leu = NUTRITION_RULES.find(r => r.title.includes('Лейцин'));
    expect(leu).toBeDefined();
    expect(leu!.body).toContain('1.8–2.5');
    expect(leu!.body).not.toContain('3–4 г на приём — триггер');
  });

  it('клетчатка — EFSA/IOM, без потолка 50 г как токсина', () => {
    const fib = NUTRITION_RULES.find(r => r.title.includes('клетчатки'));
    expect(fib).toBeDefined();
    expect(fib!.body).toContain('25');
    expect(fib!.body).toContain('38');
    expect(fib!.dose).toContain('14 г/1000');
  });

  it('омега — честно про ratio и EPA/DHA', () => {
    const om = NUTRITION_RULES.find(r => r.title.includes('Омега'));
    expect(om).toBeDefined();
    expect(om!.body).toContain('EPA');
    expect(om!.source).toBeDefined();
  });

  it('креатин-протокол существует (моногидрат 3–5 г)', () => {
    const cr = NUTRITION_RULES.find(r => r.title.includes('Креатин'));
    expect(cr).toBeDefined();
    expect(cr!.dose).toContain('3–5');
  });

  it('инсулин — дисклеймер про врача существует', () => {
    expect(INSULIN_DISCLAIMER).toContain('врач');
    expect(INSULIN_GUIDE.length).toBeGreaterThanOrEqual(10);
  });

  it('inV2-бейджи честны: только K/Na-пара (прямой ratio в движке)', () => {
    const flagged = FOOD_SYNERGIES.filter(s => s.inV2).map(s => s.pair);
    expect(flagged).toEqual(['Натрий + Калий']);
  });

  it('правила с числами имеют источники', () => {
    const mustHaveSource = ['Гидратация', 'Натрий и электролиты', 'Термический эффект', 'Коллаген', 'голодание', 'Сон и питание', 'Антиоксиданты', 'Старение'];
    for (const key of mustHaveSource) {
      const rule = NUTRITION_RULES.find(r => r.title.includes(key));
      expect(rule, key).toBeDefined();
      expect(rule!.source, key).toBeDefined();
    }
  });
  it('синергии с числовыми клеймами имеют источники', () => {
    const numeric = FOOD_SYNERGIES.filter(s => /[0-9]/.test(s.effect));
    expect(numeric.length).toBeGreaterThan(0);
    for (const s of numeric) {
      expect(s.source, s.pair).toBeDefined();
    }
  });
  it('ограничения с числовыми клеймами имеют источники', () => {
    const keys = ['Трансжиры', 'Молочные продукты', 'добавленный сахар', 'Глютен', 'Обезжиренные', 'Газированные', 'Копчёности'];
    for (const key of keys) {
      const row = RESTRICTED.find(r => r.item.includes(key));
      expect(row, key).toBeDefined();
      expect(row!.source, key).toBeDefined();
    }
  });
  it('новые таблицы непустые', () => {
    expect(RDA_ROWS.length).toBeGreaterThanOrEqual(10);
    expect(GI_ROWS.length).toBeGreaterThanOrEqual(5);
    expect(DIAAS_TIERS.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(RECOMMENDED_FOODS).length).toBeGreaterThanOrEqual(10);
    expect(FOOD_SYNERGIES.length).toBeGreaterThanOrEqual(20);
  });
});

describe('nutrition-reference UI', () => {
  it('корень .nut-ref + один поиск + динамические счётчики', () => {
    const { container } = render(<NutritionReference />);
    expect(container.querySelector('.nut-ref')).not.toBeNull();
    const searchInputs = container.querySelectorAll('input[aria-label="Поиск по справочнику"]');
    expect(searchInputs).toHaveLength(1);
    // hero содержит живые числа из данных
    expect(container.textContent).toContain(String(NUTRITION_RULES.length));
    expect(container.textContent).toContain(String(FOOD_SYNERGIES.length));
  });

  it('калькулятор норм считает белок для 80 кг (128–176)', () => {
    const { container } = render(<NutritionReference />);
    fireEvent.click(screen.getByText(/Мои нормы/));
    expect(container.textContent).toContain('128–176');
  });

  it('инсулин-секция открывается с дисклеймером', () => {
    const { container } = render(<NutritionReference />);
    fireEvent.click(screen.getByText(/Инсулин: harm-reduction/));
    expect(container.textContent).toContain('рецептурный препарат');
  });

  it('поиск находит правило и показывает счётчик результатов', () => {
    const { container } = render(<NutritionReference />);
    const input = container.querySelector('input[aria-label="Поиск по справочнику"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'креатин' } });
    expect(container.textContent).toContain('Результатов:');
  });

  it('фильтр Сушка сужает список правил', () => {
    render(<NutritionReference />);
    const allCount = NUTRITION_RULES.length;
    fireEvent.click(screen.getByText('Сушка'));
    // Кнопка фильтра активна — проверяем через текст секции правил
    const rulesHeader = screen.getByText(new RegExp(`Правила питания \\(\\d+\\)`));
    const m = rulesHeader.textContent!.match(/\((\d+)\)/);
    expect(Number(m![1])).toBeLessThan(allCount);
  });

  it('FAQ нутрициолога: единый источник, секция открывается', () => {
    expect(NUTRI_ADVISOR_FAQ.length).toBeGreaterThanOrEqual(8);
    const { container } = render(<NutritionReference />);
    fireEvent.click(screen.getByText(new RegExp('Нутрициолог — частые вопросы')));
    expect(container.textContent).toContain('HOMA-IR');
  });

  it('поиск находит FAQ нутрициолога', () => {
    const { container } = render(<NutritionReference />);
    const input = container.querySelector('input[aria-label="Поиск по справочнику"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'HOMA-IR' } });
    expect(container.textContent).toContain('Результатов:');
    expect(container.textContent).toContain('инсулинорезистентность');
  });

  it('топ: правила открыты по умолчанию, тоглы несут aria-expanded', () => {
    const { container } = render(<NutritionReference />);
    // Заголовки правил видны без кликов
    expect(screen.getByText('Белковая оптимизация')).not.toBeNull();
    const toggles = container.querySelectorAll('[data-ref="section"] > button[aria-expanded]');
    expect(toggles.length).toBeGreaterThan(0);
    const rulesToggle = container.querySelector('[data-ref="section"] > button[aria-label*="Правила питания"]');
    expect(rulesToggle!.getAttribute('aria-expanded')).toBe('true');
  });

  it('топ: FAQ раскрывается по клику (ответ скрыт до клика)', () => {
    const { container } = render(<NutritionReference />);
    fireEvent.click(screen.getByText(new RegExp('Нутрициолог — частые вопросы')));
    expect(container.textContent).not.toContain('инсулинорезистентность');
    fireEvent.click(screen.getByText(/Почему у продукта низкий рейтинг/));
    expect(container.textContent).toContain('Overall Dietary Score');
  });

  it('топ: кнопка очистки поиска гасит результаты', () => {
    const { container } = render(<NutritionReference />);
    const input = container.querySelector('input[aria-label="Поиск по справочнику"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'креатин' } });
    expect(container.textContent).toContain('Результатов:');
    fireEvent.click(screen.getByText(/Очистить поиск/));
    expect(container.textContent).not.toContain('Результатов:');
  });
});
