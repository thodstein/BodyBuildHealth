/**
 * protein-kidney-panel.test.tsx — проводка вкладки «Белок/почки» и реакция UI на ввод.
 *
 * Зачем: формулы покрыты engine-тестом, но главный дефект подобных калькуляторов —
 * поле рисуется, а значение не доходит до расчёта. Здесь дёргаем UI как пользователь.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ProteinKidneyPanel, buildRetestIcs, mergeLatestLabs } from '../ProteinKidneyPanel';
import { NutritionScreen } from '../../NutritionScreen';
import { PROTEIN_KIDNEY_INPUT_KEY } from '../../../../engines/protein-kidney-tolerance.engine';
import { db } from '../../../../core/db';

/** Выбрать вариант в ScorePicker по подписи поля (например, «Белок в тест-полоске» → «отр»). */
function pickScore(label: string, option: string) {
  const labelEl = Array.from(document.querySelectorAll('span')).find((el) => el.textContent === label);
  const root = labelEl?.closest('div')?.parentElement;
  const btn = root ? Array.from(root.querySelectorAll('button')).find((b) => b.textContent === option) : null;
  if (!btn) throw new Error(`Не найден вариант «${option}» у поля «${label}»`);
  fireEvent.click(btn);
}

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => { cleanup(); });

/** Ввести число в MhNum так, как это делает пользователь (попап → число → OK). */
function setNumber(label: string, value: number) {
  const btn = Array.from(document.querySelectorAll('button')).find(b => {
    if (b.closest('[role="dialog"]') || b.closest('.mh-popupoverlay')) return false;
    return (b.textContent || '').trim().startsWith(label);
  });
  if (!btn) throw new Error(`нет поля «${label}»`);
  fireEvent.click(btn);

  const area = document.querySelector('.mh-popupoverlay');
  if (!area) throw new Error(`попап «${label}» не открылся`);
  const input = area.querySelector('input[type="number"]') as HTMLInputElement;
  expect(input, `в попапе «${label}» нет input`).toBeTruthy();
  fireEvent.change(input, { target: { value: String(value) } });

  const ok = Array.from(area.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'OK');
  expect(ok, `в попапе «${label}» нет OK`).toBeTruthy();
  fireEvent.click(ok as HTMLElement);
}

const bodyText = (): string => (document.body.textContent || '').replace(/\s+/g, ' ');

describe('ProteinKidneyPanel: вкладка и ввод', () => {
  it('1. вкладка «Белок/почки» стоит рядом с «Метаболикой» в Анализе', () => {
    const { container } = render(<NutritionScreen />);
    fireEvent.click(container.querySelector('.nutrition-hero-card[data-section="analysis"]') as HTMLElement);
    const burger = container.querySelector('[aria-label="Меню питания"]') as HTMLElement | null;
    if (burger) fireEvent.click(burger);

    const chips = Array.from(container.querySelectorAll('.nutrition-chip')).map(c => (c.textContent || '').trim());
    const metabolic = chips.findIndex(c => c.includes('Метаболика'));
    const kidney = chips.findIndex(c => c.includes('Белок/почки'));
    expect(metabolic).toBeGreaterThanOrEqual(0);
    expect(kidney).toBe(metabolic + 1);

    fireEvent.click(Array.from(container.querySelectorAll('.nutrition-chip')).find(c => (c.textContent || '').includes('Белок/почки')) as HTMLElement);
    expect(bodyText()).toContain('Белок и почки');
    expect(bodyText()).toContain('Вердикт');
  });

  it('2. при 2 л воды прибавка на паузе, после 3 л — разрешена', () => {
    render(<ProteinKidneyPanel />);
    // Контекст по умолчанию: 80 кг, 160 г белка (2.0 г/кг), силовой тренинг.
    expect(bodyText()).toContain('В пределах пользы');
    // Профиль отдаёт 2 л воды при цели 2.8 л → сначала гидратация, потом прибавка.
    expect(bodyText()).toContain('пауза');
    setNumber('Вода (необяз.)', 3000);
    expect(bodyText()).toContain('Прибавка рекомендуется');
  });

  it('3. креатинин 195 мкмоль/л → СКФ G3b, потолок падает и прибавка запрещена', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Креатинин', 195);
    expect(bodyText()).toMatch(/G3b/);
    expect(bodyText()).toContain('Выше переносимости');
    // Потолок 0.8 г/кг × 80 кг = 64 г/сут, значит есть прямое указание снижения.
    expect(bodyText()).toMatch(/Снизьте до 64/);
    expect(bodyText()).toContain('нельзя');
  });

  it('4. введённые данные сохраняются в localStorage', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Мочевина', 9);
    const raw = localStorage.getItem(PROTEIN_KIDNEY_INPUT_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw || '{}').ureaMmolL).toBe(9);
  });

  it('5. мочевина 9 ммоль/л при нормальной СКФ ставит прибавку на паузу', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Мочевина', 9);
    expect(bodyText()).toContain('пауза');
    expect(bodyText()).toMatch(/Сначала вода|Сначала нормализуйте мочевину/);
  });

  it('6. 2.4 г/кг + чистые анализы: «переносится», шаги только по переносимости', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Белок сейчас', 192);
    setNumber('Вода (необяз.)', 3000);
    setNumber('Мочевина', 5);
    setNumber('Креатинин', 80);
    setNumber('Плотность (SG)', 1.015);
    pickScore('Белок в тест-полоске', 'отр');

    // Прямой ответ на вопрос пользователя — в отдельном блоке, а не только цифры.
    expect(bodyText()).toContain('Усваивается ли белок');
    expect(bodyText()).toContain('Переносится');
    expect(bodyText()).toContain('2.4');
    // 2.4 > 2.2: выше пользы, но в пределах переносимости до 3.0.
    expect(bodyText()).toContain('Выше пользы, но переносится');
    expect(bodyText()).toContain('только переносимость');
    // И обязательно говорит, когда пересдать после первого шага.
    expect(bodyText()).toContain('Через 14 дней после первого шага');
  });

  it('7. кнопка ААС + цистатин C расширяет переносимость до 3.2', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Белок сейчас', 240);
    setNumber('Вода (необяз.)', 3000);
    setNumber('Мочевина', 5);
    setNumber('Креатинин', 80);
    setNumber('Цистатин C', 0.8);
    setNumber('Плотность (SG)', 1.015);
    pickScore('Белок в тест-полоске', 'отр');

    const aas = document.querySelector('button[aria-label="Принимаю ААС"]') as HTMLElement | null;
    expect(aas).toBeTruthy();
    fireEvent.click(aas as HTMLElement);

    expect(bodyText()).toContain('3.2');
    expect(bodyText()).toContain('цистатин C');
    expect(bodyText()).toContain('ААС');
  });

  it('8. мочевина 13 → конкретная дата пересдачи через 2–3 дня', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Мочевина', 13);
    expect(bodyText()).toContain('Когда пересдать анализы');
    expect(bodyText()).toContain('Пересдать через 2–3 дня');
    expect(bodyText()).toContain('через 3 дн.');
    expect(bodyText()).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });

  it('9. мочевина 0 — это ошибка ввода, а не «чистые почки»', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Мочевина', 0);
    setNumber('Креатинин', 80);
    setNumber('Плотность (SG)', 1.015);
    pickScore('Белок в тест-полоске', 'отр');
    expect(bodyText()).toContain('Проверьте единицы');
    expect(bodyText()).toContain('Сначала проверьте данные');
  });

  it('10. ААС без цистатина C: 2.8, а не 3.2', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Белок сейчас', 240);
    setNumber('Вода (необяз.)', 3000);
    setNumber('Мочевина', 5);
    setNumber('Креатинин', 80);
    setNumber('Плотность (SG)', 1.015);
    pickScore('Белок в тест-полоске', 'отр');
    fireEvent.click(document.querySelector('button[aria-label="Принимаю ААС"]') as HTMLElement);
    expect(bodyText()).toContain('2.8');
    expect(bodyText()).toContain('без цистатина C');
  });

  it('11. сушка + % жира поднимает ориентир пользы по тощей массе', () => {
    render(<ProteinKidneyPanel />);
    fireEvent.click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Сушка') as HTMLElement);
    setNumber('% жира (необяз.)', 10);
    // 80 кг, 10% жира → 72 кг LBM × 3.0 = 216 г → 2.7 г/кг массы.
    expect(bodyText()).toContain('2.7');
  });

  it('12. что-если: если выше переносимости — так и пишет, без зелёного текста', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Мочевина', 9);
    setNumber('Планируемая прибавка', 20);
    expect(bodyText()).toContain('Выше потолка переносимости');
    expect(bodyText()).not.toContain('Влезает в потолок пользы');
  });

  it('13. .ics — корректное событие на дату пересдачи', () => {
    const ics = buildRetestIcs('2026-12-15', 'Пересдать: белок, почки', 'Сдать ОАМ; urea');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261215');
    expect(ics).toContain('DTEND;VALUE=DATE:20261216');
    expect(ics).toContain('SUMMARY:Пересдать: белок\\, почки');
    expect(ics).toContain('DESCRIPTION:Сдать ОАМ\\; urea');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('14. mergeLatestLabs: свежая дата побеждает, чужой patientId не смешивается', () => {
    const merged = mergeLatestLabs(
      {
        UREA: { value: 9, unit: 'ммоль/л', date: '2026-10-01' },
        CREATININE: { value: 80, unit: 'мкмоль/л', date: '2026-11-01' },
      },
      [
        { code: 'UREA', value: 6.5, unit: 'ммоль/л', date: '2026-11-05', patientId: 'current-user' },
        { code: 'CREATININE', value: 70, unit: 'мкмоль/л', date: '2026-10-01', patientId: 'current-user' },
        { code: 'CYSTATIN_C', value: 0.8, unit: 'мг/л', date: '2026-11-06', patientId: 'other' },
        { code: 'EGFR', value: 101, date: '2026-11-06' },
      ],
      'current-user',
    );
    expect(merged.UREA.value).toBe(6.5);
    expect(merged.CREATININE.value).toBe(80); // старая дата не перетирает свежую
    expect(merged.CYSTATIN_C).toBeUndefined(); // чужой пациент
    expect(merged.EGFR.value).toBe(101); // запись без patientId — своя
  });

  it('15. кнопка «Из анализов» тянет labs_log, а не только профиль', async () => {
    await db.clear('labs_log');
    await db.put('labs_log', {
      id: 'pk-urea', code: 'UREA', value: 7.4, unit: 'ммоль/л', date: '2026-11-10', patientId: 'current-user',
    });
    await db.put('labs_log', {
      id: 'pk-creat', code: 'CREATININE', value: 92, unit: 'мкмоль/л', date: '2026-11-10', patientId: 'current-user',
    });
    render(<ProteinKidneyPanel />);
    const btn = document.querySelector('button[aria-label="Подтянуть анализы из раздела Анализы"]') as HTMLElement | null;
    expect(btn).toBeTruthy();
    fireEvent.click(btn as HTMLElement);
    await waitFor(() => expect(bodyText()).toContain('Подтянуто из анализов: 2'));
    // Поля реально заполнены: значение ушло в расчёт, а не только в сообщение.
    expect(bodyText()).toContain('мочевина 7.4');
  });

  it('16. 4.5 г/кг: предел 5, «экстремальный режим», врач и контроль через 7 дней', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Белок сейчас', 360);
    setNumber('Вода (необяз.)', 4500);
    setNumber('Мочевина', 5);
    setNumber('Креатинин', 80);
    setNumber('Плотность (SG)', 1.015);
    pickScore('Белок в тест-полоске', 'отр');

    expect(bodyText()).toContain('Экстремальный режим');
    expect(bodyText()).toContain('5 г/кг — верхняя граница калькулятора');
    expect(bodyText()).toContain('врач');
    expect(bodyText()).toContain('каждые 7–14 дней');
    expect(bodyText()).toContain('Экстремальный белок: контроль через 7 дней');
    expect(bodyText()).toContain('через 7 дн.');
    expect(bodyText()).toContain('под контролем');
  });

  it('17. выше 5 г/кг — прямо говорит, что это вне предела калькулятора', () => {
    render(<ProteinKidneyPanel />);
    setNumber('Белок сейчас', 420); // 5.25 г/кг при 80 кг
    expect(bodyText()).toContain('выше предела калькулятора 5 г/кг');
    expect(bodyText()).toContain('Проверьте единицы');
  });
});
