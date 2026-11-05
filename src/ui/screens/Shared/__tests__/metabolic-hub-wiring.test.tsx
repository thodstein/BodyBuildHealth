/**
 * metabolic-hub-wiring.test.tsx — «ввод действительно доходит до расчёта».
 *
 * Зачем: главный дефект старого хаба был не в формулах, а в проводке — поля рисовались
 * (профессия, климат, пот, MET-ч), но их сеттеры не вызывались вообще, и значение уезжало
 * в никуда. Ни один тест чисел такое не ловит. Здесь мы дёргаем UI как пользователь и
 * требуем, чтобы итог МЕНЯЛСЯ в предсказуемую сторону.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { MetabolicHub } from '../MetabolicHub';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});
afterEach(() => { cleanup(); });

/** Кнопка-плитка сводки по префиксу aria-label. */
function tile(prefix: string): HTMLElement {
  const el = Array.from(document.querySelectorAll('button'))
    .find(b => (b.getAttribute('aria-label') || '').startsWith(prefix));
  if (!el) throw new Error(`нет плитки «${prefix}»`);
  return el as HTMLElement;
}
/** Крупное число плитки (второй div: label / value / sub). */
function tileValue(prefix: string): number {
  const el = tile(prefix);
  const raw = (el.children[1] as HTMLElement | undefined)?.textContent || '';
  const m = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) throw new Error(`в плитке «${prefix}» нет числа: "${raw}"`);
  return Number(m[0].replace(',', '.'));
}

/** Весь текст плитки (label / value / sub) — для проверки оговорок. */
function tileText(prefix: string): string {
  return (tile(prefix).textContent || '').replace(/\s+/g, ' ');
}

/** Ввести число в поле хаба (MhNum или PopupNumber) так, как это делает пользователь. */
function setNumber(label: string, value: number) {
  const btn = Array.from(document.querySelectorAll('button')).find(b => {
    if (b.closest('[role="dialog"]') || b.closest('.mh-popupoverlay') || b.closest('.pl-popupoverlay')) return false;
    return (b.textContent || '').trim().startsWith(label);
  });
  if (!btn) throw new Error(`нет поля «${label}»`);
  fireEvent.click(btn);

  const area = document.querySelector('.mh-popupoverlay, .pl-popupoverlay');
  if (!area) throw new Error(`попап «${label}» не открылся`);
  const input = area.querySelector('input[type="number"]') as HTMLInputElement;
  expect(input, `в попапе «${label}» нет input`).toBeTruthy();
  fireEvent.change(input, { target: { value: String(value) } });

  const ok = Array.from(area.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'OK');
  expect(ok, `в попапе «${label}» нет OK`).toBeTruthy();
  fireEvent.click(ok as HTMLElement);
}

/** Выбрать значение в PopupSelect (клик по карточке → клик по варианту). */
function setSelect(label: string, option: string) {
  const trigger = Array.from(document.querySelectorAll('button.pl-popupselect'))
    .find(b => (b.textContent || '').trim().startsWith(label));
  if (!trigger) throw new Error(`нет селекта «${label}»`);
  fireEvent.click(trigger);
  const area = document.querySelector('.pl-popupoverlay');
  if (!area) throw new Error(`попап «${label}» не открылся`);
  const opt = Array.from(area.querySelectorAll('button'))
    .find(b => (b.textContent || '').trim().startsWith(option));
  if (!opt) throw new Error(`в селекте «${label}» нет варианта «${option}»`);
  fireEvent.click(opt);
}

/** Значение поля по aria-label («HCT, %: 52 %» → «52 %»). */
function fieldValue(label: string): string {
  const el = Array.from(document.querySelectorAll('button'))
    .find(b => (b.getAttribute('aria-label') || '').startsWith(`${label}:`));
  if (!el) throw new Error(`нет поля «${label}»`);
  return (el.getAttribute('aria-label') || '').slice(label.length + 2);
}

/** Значение `.pl-popupnum` по подписи (второй div — значение; aria-label тоже есть, но он с подписью). */
function popupValue(label: string): string {
  const btn = Array.from(document.querySelectorAll('button.pl-popupnum'))
    .find(b => (b.textContent || '').trim().startsWith(label));
  if (!btn) throw new Error(`нет popup-поля «${label}»`);
  return (btn.children[1]?.textContent || '').trim();
}

/** Подготовить историю веса и дневник: `days` взвешиваний (ровный тренд −0.05 кг/д) и `logDays` дней еды. */
function seedWeightAndDiary(days: number, logDays: number) {
  const today = Date.parse('2026-11-04T00:00:00Z');
  const day = (i: number) => new Date(today - i * 86400000).toISOString().slice(0, 10);
  const weightHistory: Array<{ date: string; kg: number }> = [];
  for (let i = days - 1; i >= 0; i--) weightHistory.push({ date: day(i), kg: Math.round((83 - (days - 1 - i) * 0.05) * 100) / 100 });
  localStorage.setItem('he_nutrition_v2', JSON.stringify({ weightHistory }));
  const diary: Record<string, any> = {};
  for (let i = logDays - 1; i >= 0; i--) {
    diary[day(i)] = { meals: { breakfast: [{ name: 'тест', kcal: 2600, p: 150, f: 70, c: 300, qty: 1, micros: {} }] } };
  }
  // формат diary-storage-v2: плоский объект по датам + __version
  localStorage.setItem('nutrition_diary_v2', JSON.stringify({ ...diary, __version: 2 }));
}

/** Локальная дата YYYY-MM-DD (без сдвига часового пояса, в отличие от toISOString). */
function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Записать донацию `daysAgo` дней назад в журнал (he_donation_log_v1), вернуть её дату. */
function seedDonation(daysAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  const date = localDate(d);
  localStorage.setItem('he_donation_log_v1', JSON.stringify([{ date, hct: 56 }]));
  return date;
}

/** Открыть режим калькулятора (пилюля `.mh-mode`) и вернуть текст его результата. */
function openMode(label: string): string {
  const pill = Array.from(document.querySelectorAll('.mh-mode'))
    .find(p => (p.textContent || '').replace(/^[^\p{L}]+/u, '').trim().startsWith(label)) as HTMLElement | undefined;
  if (!pill) throw new Error(`нет режима «${label}»`);
  fireEvent.click(pill);
  const body = document.querySelector('#mh-mode-body') as HTMLElement | null;
  if (!body) throw new Error('нет #mh-mode-body');
  return (body.textContent || '').replace(/\s+/g, ' ');
}

describe('MetabolicHub: ввод меняет расчёт (проводка полей)', () => {
  it('refeed: «нужны данные» пока недели дефицита не введены, и пол меняет порог', () => {
    render(<MetabolicHub />);
    let txt = openMode('Diet break');
    expect(txt).toContain('Нужны данные');
    expect(txt).not.toContain('Не нужен');
    setNumber('Жир, % (если измерен)', 12);
    setNumber('Недель в дефиците', 8);
    txt = openMode('Diet break');
    expect(txt).toContain('+25% углей');
    expect(txt).toContain('8 нед дефицита');
    expect(txt).toContain('<15%');
  });

  it('календарь diet break совпадает со сроком цели (раньше план был короче)', () => {
    render(<MetabolicHub />);
    // 5 кг — примерно полгода: брейки точно попадают в календарь
    setNumber('Цель вес, кг', 78);
    const txt = openMode('Diet break');
    const m = txt.match(/→ (\d+) нед дефицита \+ (\d+)×(\d+) нед брейка = (\d+) нед \(срок цели (\d+) нед\)/);
    expect(m, `нет раскладки календаря: ${txt.slice(0, 300)}`).toBeTruthy();
    const [defWeeks, breaks, breakWeeks, planWeeks, goalWeeks] = m!.slice(1).map(Number);
    expect(breaks).toBeGreaterThan(0);
    expect(planWeeks).toBe(defWeeks + breaks * breakWeeks);
    expect(goalWeeks).toBe(planWeeks);
  });

  it('срок цели не спорит с брейками: показывает, что проверено без них', () => {
    render(<MetabolicHub />);
    setNumber('Цель вес, кг', 78);
    setNumber('Целевых недель', 20);
    const txt = (document.body.textContent || '').replace(/\s+/g, ' ');
    expect(txt).toContain('без брейков');
    expect(txt).toContain('нед дефицита');
    expect(txt).toContain('нед maintenance');
    // и раскладка сходится: дефицит + брейки = срок
    const m = txt.match(/Календарь с брейками: (\d+) нед дефицита \+ (\d+)×(\d+) нед maintenance = (\d+) нед/);
    expect(m, 'нет раскладки календаря с брейками').toBeTruthy();
    const [def, br, bw, total] = m!.slice(1).map(Number);
    expect(def + br * bw).toBe(total);
  });

  it('ACWR без журнала sRPE — «нет данных», а не 1.00 optimal', () => {
    render(<MetabolicHub />);
    const txt = openMode('Stress');
    expect(txt).toContain('ACWR нет данных');
    expect(txt).not.toContain('1.00 · optimal');
    // в сводке тоже прочерк, а не выдуманная единица
    const summary = (document.body.textContent || '').replace(/\s+/g, ' ');
    expect(summary).toContain('ACWR —');
  });

  it('вес 83 → 110 поднимает TDEE и воду', () => {
    render(<MetabolicHub />);
    const tdee0 = tileValue('TDEE');
    const water0 = tileValue('Вода');
    setNumber('Вес, кг', 110);
    expect(tileValue('TDEE')).toBeGreaterThan(tdee0);
    expect(tileValue('Вода')).toBeGreaterThan(water0);
  });

  it('тренировки/нед 4 → 0 снижают воду (недельный пот уходит из суточной нормы)', () => {
    render(<MetabolicHub />);
    const water0 = tileValue('Вода');
    setNumber('Тренировок/нед', 0);
    expect(tileValue('Вода')).toBeLessThan(water0);
  });

  it('HCT из ОАК попадает в кровь и в воду под HCT', () => {
    render(<MetabolicHub />);
    expect(tile('Кровь').textContent).toContain('введи HCT');
    setNumber('HCT, %', 56);
    const blood = tile('Кровь').textContent || '';
    expect(blood).toContain('56%');
    expect(blood).not.toContain('введи HCT');
    expect(blood).toMatch(/мл/);
  });

  it('хроника алкоголя не врёт «низкая», когда дни не указаны', () => {
    render(<MetabolicHub />);
    setNumber('Алкоголь, г/сут', 80);
    let txt = openMode('Алко');
    expect(txt).toContain('Укажи');
    expect(txt).not.toContain('Алко-хроника низкая');
    setNumber('Дней/нед с алко', 3);
    txt = openMode('Алко');
    expect(txt).toContain('30 units/нед');
    expect(txt).toContain('240г за неделю');
    expect(txt).toContain('UK CMO 2016');
  });

  it('алкоголь подписан как приём сверх плана, а не «уже в TDEE»', () => {
    render(<MetabolicHub />);
    const txt0 = openMode('Алко');
    expect(txt0).not.toContain('уже включены');
    setNumber('Алкоголь, г/сут', 40);
    const txt = openMode('Алко');
    expect(txt).toContain('приём сверх плана');
    expect(txt).toContain('284 ккал спирта');
    expect(txt).toContain('убери ~71г углеводов');
    expect(txt).not.toContain('уже включены');
  });

  it('K — редактируемое поле и реально влияет на штраф питания', () => {
    render(<MetabolicHub />);
    setNumber('HCT, %', 46);
    const fieldText = (label: string) => (Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').trim().startsWith(label))?.textContent || '').replace(/\s+/g, ' ');
    // профиль предзаполняет Na/K (3.5/3.0 г) — но теперь это поля, а не «факт» без возможности правки
    expect(fieldText('Na, г/сут')).toContain('3');
    expect(fieldText('K, г/сут')).toContain('3');
    let txt = openMode('Кровь');
    expect(txt).toContain('питание × гематология ×1');
    // низкий K → +0.03 к множителю питания
    setNumber('K, г/сут', 2);
    expect(fieldText('K, г/сут')).toContain('2');
    txt = openMode('Кровь');
    expect(txt).toContain('×1.03');
    // Na выше 4 г/сут — второй штраф
    setNumber('Na, г/сут', 5);
    txt = openMode('Кровь');
    expect(txt).toContain('×1.06');
  });

  it('вода «факт» подписана источником, а не выдана за измерение', () => {
    render(<MetabolicHub />);
    setNumber('HCT, %', 52);
    // профиль отдаёт дефолтные 2 л — это не замер, поэтому подписано «(профиль)»
    expect(openMode('Кровь')).toContain('факт 2л (профиль)');
    setNumber('Вода факт, л/сут', 1.2);
    let txt = openMode('Кровь');
    expect(txt).toContain('факт 1.2л');
    expect(txt).not.toContain('(профиль)');
    expect(txt).toContain('⚠ гипервязкость');
    setNumber('Вода факт, л/сут', 2.5);
    txt = openMode('Кровь');
    expect(txt).toContain('вязкость OK');
  });

  it('поля попапов объявляются скринридеру: aria-label с подписью и значением', () => {
    render(<MetabolicHub />);
    const btns = Array.from(document.querySelectorAll('button.pl-popupnum')) as HTMLElement[];
    expect(btns.length).toBeGreaterThan(0);
    for (const b of btns) {
      const al = b.getAttribute('aria-label') || '';
      expect(al.length, `пустой aria-label у «${(b.textContent || '').trim()}»`).toBeGreaterThan(3);
      expect(b.getAttribute('aria-haspopup')).toBe('dialog');
    }
    // подпись и значение читаются вместе: «Вода факт, л/сут: не задано»
    const water = btns.find(b => (b.getAttribute('aria-label') || '').startsWith('Вода факт'));
    expect(water?.getAttribute('aria-label')).toMatch(/^Вода факт, л\/сут: (.+)$/);
  });

  it('алкоголь без ввода — «не указан», а не вердикт «Без алкоголя»', () => {
    render(<MetabolicHub />);
    let txt = openMode('Алко');
    expect(txt).toContain('алкоголь не указан');
    expect(txt).not.toContain('Без алкоголя');
    // вводим дозу — появляется расчёт, TEF и хроника
    setNumber('Алкоголь, г/сут', 40);
    txt = openMode('Алко');
    expect(txt).toContain('40г этанола');
    expect(txt).toContain('284'); // 40 г × 7.1 ккал/г
    expect(txt).toContain('Хроника');
    expect(txt).toContain('приём сверх плана');
  });

  it('кофеин без ввода — «не задан», кривая и cut-off не выдумываются', () => {
    render(<MetabolicHub />);
    let txt = openMode('Diet break');
    expect(txt).toContain('введи мг/сут');
    expect(txt).toContain('Введи кофеин');
    // ни кривой, ни конкретного cut-off без дозы
    expect(txt).not.toMatch(/cut-off \d+ч/);
    expect(txt).not.toMatch(/осталось \(peak/);
    setNumber('Кофеин, мг/сут', 300);
    txt = openMode('Diet break');
    expect(txt).toContain('cut-off 8ч');
    expect(txt).not.toContain('введи мг/сут');
  });

  it('AT без данных — «нет данных», а не «AT none · −0ккал»', () => {
    render(<MetabolicHub />);
    setNumber('Цель вес, кг', 78);
    const txt = openMode('AT');
    expect(txt).toContain('AT —');
    expect(txt).not.toContain('AT none');
    expect(txt).not.toContain('−0ккал');
    expect(txt).toContain('Нет данных');
    // а с введёнными неделями вердикт появляется по-русски
    setNumber('Недель в дефиците', 8);
    setNumber('Потеряно, кг', 4);
    const txt2 = openMode('AT');
    expect(txt2).not.toContain('AT —');
    expect(txt2).toMatch(/AT (Нет|Лёгкая|Умеренная|Выраженная)/);
  });

  it('Na-загрузка предупреждает персонально по АД и гематокриту', () => {
    render(<MetabolicHub />);
    let txt = openMode('Diet break');
    // оговорки видны, а не съедаются split('—')
    expect(txt).toContain('Пиковая неделя перед соревнованием');
    expect(txt).toContain('Проверь АД');
    expect(txt).not.toContain('всего 10г — ');
    // HCT >51 → личный красный флаг
    setNumber('HCT, %', 52);
    txt = openMode('Diet break');
    expect(txt).toContain('Na-загрузка добавляет риск тромбоза');
    // АД ≥140/90 → второй флаг
    setNumber('Сис. АД', 150);
    txt = openMode('Diet break');
    expect(txt).toContain('Na-загрузка не для тебя');
  });

  it('источник воды едет со снапшотом и не остаётся «профильным» после загрузки', () => {
    // снапшот со «своей» водой: подпись не должна врать «(профиль)»
    localStorage.setItem('he_metabolic_snapshot_v6', JSON.stringify({ weight: 83, waterL: 3.2, waterOrigin: 'user', hct: 52 }));
    render(<MetabolicHub />);
    let txt = openMode('Кровь');
    expect(txt).toContain('факт 3.2л');
    expect(txt).not.toContain('(профиль)');
    cleanup();
    // а вода из профиля в снапшоте остаётся подписанной
    localStorage.setItem('he_metabolic_snapshot_v6', JSON.stringify({ weight: 83, waterL: 1.6, waterOrigin: 'profile', hct: 52 }));
    render(<MetabolicHub />);
    txt = openMode('Кровь');
    expect(txt).toContain('факт 1.6л (профиль)');
  });

  it('поле «Железо, мг/сут» доходит до совета по крови', () => {
    render(<MetabolicHub />);
    setNumber('HCT, %', 52);
    expect(openMode('Кровь')).not.toContain('сейчас 20мг/сут');
    setNumber('Железо, мг/сут', 20);
    const txt = openMode('Кровь');
    expect(txt).toContain('сейчас 20мг/сут — отменить');
    expect(txt).toContain('добавка поддерживает эритроцитоз');
  });

  it('свежая донация в журнале блокирует повторную флеботомию', () => {
    const last = seedDonation(10);
    render(<MetabolicHub />);
    setNumber('HCT, %', 52);
    const txt = openMode('Кровь');
    expect(txt).toContain('Последняя донация');
    expect(txt).toContain(last);
    expect(txt).toContain('прошло 10 дн');
    expect(txt).toContain('не раньше');
    // дата «не раньше» = последняя донация + 56 дней
    const ready = new Date(Date.parse(`${last}T00:00:00`) + 56 * 86400000);
    expect(txt).toContain(localDate(ready));
  });

  it('EA подписывает источник приёма: дневник или план', () => {
    render(<MetabolicHub />);
    expect(openMode('EA')).toContain('— план');
    cleanup();
    seedWeightAndDiary(14, 12);
    render(<MetabolicHub />);
    const txt = openMode('EA');
    expect(txt).toContain('— дневник 2600ккал (7 дн)');
    expect(txt).not.toContain('— план');
  });

  it('finder TDEE не подставляет цель плана вместо факта еды', () => {
    seedWeightAndDiary(14, 0);
    render(<MetabolicHub />);
    const txt = openMode('Поиск нормы');
    expect(txt).toContain('Дневник пуст');
    expect(txt).not.toContain('intake ');
  });

  it('finder TDEE считает по факту дневника, когда он есть', () => {
    seedWeightAndDiary(14, 12);
    render(<MetabolicHub />);
    const txt = openMode('Поиск нормы');
    expect(txt).toContain('intake 2600');
    expect(txt).not.toContain('Дневник пуст');
  });

  it('прогноз после донации не считается измерением в истории HCT', () => {
    localStorage.setItem('he_hct_history_v1', JSON.stringify([
      { date: '2026-10-01', hct: 50 },
      { date: '2026-10-10', hct: 54 },
      { date: '2026-10-17', hct: 50, est: true },
    ]));
    render(<MetabolicHub />);
    const txt = openMode('Кровь');
    expect(txt).toContain('2 измерений');
    expect(txt).toContain('+ 1 прогноз');
    // Δ считается по лабораторным точкам (50 → 54), а не по прогнозной 50%
    expect(txt).toContain('Δ +4%');
    expect(document.querySelectorAll('[title*="прогноз"]').length).toBeGreaterThan(0);
  });

  it('донация 10 недель назад уже не блокирует совет', () => {
    seedDonation(70);
    render(<MetabolicHub />);
    setNumber('HCT, %', 52);
    const txt = openMode('Кровь');
    expect(txt).toMatch(/интервал 56 дн выдержан/i);
  });

  it('цель: сушка < поддержание < масса по ккал КБЖУ', () => {
    render(<MetabolicHub />);
    const pick = (name: string) => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => (b.textContent || '').trim() === name && b.className.includes('mh-goal'));
      if (!btn) throw new Error(`нет кнопки цели «${name}»`);
      fireEvent.click(btn);
      return tileValue('КБЖУ');
    };
    const cut = pick('Сушка');
    const maintain = pick('Поддержание');
    const bulk = pick('Масса');
    expect(cut).toBeLessThan(maintain);
    expect(maintain).toBeLessThan(bulk);
  });

  it('ААС-переключатель меняет воду и белок, но не вес', () => {
    render(<MetabolicHub />);
    const water0 = tileValue('Вода');
    const kbju0 = tileValue('КБЖУ');
    const weight0 = tileValue('Жир'); // % жира не должен зависеть от ААС

    fireEvent.click(Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('С ААС')) as HTMLElement);

    expect(tileValue('Вода')).toBeGreaterThan(water0);
    expect(tileValue('КБЖУ')).toBeGreaterThan(kbju0);
    expect(tileValue('Жир')).toBe(weight0);
  });

  it('«бытовая активность» реально работает, когда профессия не указана', () => {
    render(<MetabolicHub />);
    // было: профессия по умолчанию 'sedentary' всегда перекрывала бытовую — поле-пустышка
    setSelect('Профессия (FAO PAL)', 'Не указана');
    const tdee0 = tileValue('TDEE');
    setSelect('Бытовая', 'Высокая');
    const tdeeHigh = tileValue('TDEE');
    setSelect('Бытовая', 'Низкая');
    const tdeeLow = tileValue('TDEE');
    expect(tdeeHigh).toBeGreaterThan(tdee0);
    expect(tdeeLow).toBeLessThan(tdee0);
  });

  it('профессия перекрывает бытовую — и это сказано текстом, а не молча', () => {
    render(<MetabolicHub />);
    expect(document.body.textContent).toMatch(/профессия перекрывает «бытовую»/);
    const tdee0 = tileValue('TDEE');
    setSelect('Профессия (FAO PAL)', 'Физическая');
    const tdeePhysical = tileValue('TDEE');
    setSelect('Бытовая', 'Низкая');
    setSelect('Бытовая', 'Высокая');
    // пока профессия задана, «бытовая» на расчёт не влияет (один день нельзя посчитать дважды)
    expect(tileValue('TDEE')).toBe(tdeePhysical);
    expect(tdeePhysical).toBeGreaterThan(tdee0);
  });

  it('«Целевых недель» реально проверяет срок (раньше поле не считалось)', () => {
    render(<MetabolicHub />);
    setNumber('Цель вес, кг', 60);
    setNumber('Целевых недель', 3);
    // без цели «сушка» план = поддержание, и срок справедливо назван встречным
    expect(document.body.textContent || '').toMatch(/Переключи цель/);
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').trim() === 'Сушка' && b.className.includes('mh-goal')) as HTMLElement);
    expect(document.body.textContent || '').toMatch(/в срок не успеть/);
    setNumber('Целевых недель', 80);
    const loose = document.body.textContent || '';
    expect(loose).toMatch(/план быстрее срока/);
    expect(loose).not.toMatch(/в срок не успеть/);
  });

  it('калипер (JP3) меняет TDEE: измеренный % жира идёт в BMR, а не только в плитку', () => {
    render(<MetabolicHub />);
    const t0 = tileValue('TDEE');
    setNumber('JP3 сумма, мм', 100);
    const t1 = tileValue('TDEE');
    expect(t1).not.toBe(t0);
    // весит «жирнее» — Katch/LBM ниже, значит TDEE падает
    expect(t1).toBeLessThan(t0);
  });

  it('пресет задаёт % жира и не отдаёт его старому калиперу/BIA', () => {
    render(<MetabolicHub />);
    setNumber('JP3 сумма, мм', 100);
    expect(tileText('Жир')).toContain('замер');
    const preset = Array.from(document.querySelectorAll('.mh-preset'))
      .find(b => (b.textContent || '').includes('Бикини')) as HTMLElement;
    expect(preset).toBeTruthy();
    fireEvent.click(preset);
    expect(tileValue('Жир')).toBe(18);
    expect(tileText('Жир')).toContain('пресет');
    expect(tileText('Жир')).not.toContain('замер');
    // ручной ввод снова главнее пресета и честно подписан
    setNumber('Жир, % (если измерен)', 26);
    expect(tileValue('Жир')).toBe(26);
    expect(tileText('Жир')).toContain('ручной ввод');
  });

  it('adaptive TDEE не подменяет плитку, пока данных мало (2 дня дневника)', () => {
    seedWeightAndDiary(10, 2);
    render(<MetabolicHub />);
    expect(tileText('TDEE')).toMatch(/формула \(адаптив 2\/10 — мало\)/);
    expect(tileText('TDEE')).not.toMatch(/адаптив R²/);
    // сама оценка не исчезает — остаётся ориентиром в строке adaptive v3
    expect(document.body.textContent || '').toMatch(/Adaptive v3.*ориентир, в TDEE — формула/);
  });

  it('adaptive TDEE встаёт в плитку, когда данных достаточно (12 дней дневника)', () => {
    seedWeightAndDiary(14, 12);
    render(<MetabolicHub />);
    expect(tileText('TDEE')).toMatch(/адаптив R²/);
    expect(document.body.textContent || '').toMatch(/Adaptive v3.*в TDEE/);
  });

  it('«Применить к плану питания» пишет manualTargets + ручной режим в профиль', () => {
    render(<MetabolicHub />);
    const kcal = tileValue('КБЖУ');
    // кнопка живёт в блоке режима «КБЖУ»
    fireEvent.click(Array.from(document.querySelectorAll('.mh-mode'))
      .find(b => (b.textContent || '').includes('КБЖУ')) as HTMLElement);
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').includes('Применить к плану питания')) as HTMLElement);
    const prof = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    const nut = prof?.settings?.nutrition || {};
    // мост в планировщик — только через профиль (он читает эти два поля)
    expect(nut.kbjuMode).toBe('manual');
    expect(nut.manualTargets?.kcal).toBe(kcal);
    expect(nut.manualTargets?.protein).toBeGreaterThan(0);
    expect(nut.manualTargets?.fat).toBeGreaterThan(0);
    expect(nut.manualTargets?.carbs).toBeGreaterThan(0);
    expect(document.body.textContent || '').toMatch(/записано в профиль/);
  });

  it('беременность в UI поднимает TDEE ровно на 340, а не на 680', () => {
    render(<MetabolicHub />);
    // блок беременности виден только для ♀
    setSelect('Пол', '♀');
    const tdeeF = tileValue('TDEE');
    setSelect('Триместр', '2-й');
    // было: calcSteps уже добавлял 340, а buildOneAnswerPro добавлял ещё раз → +680
    expect(tileValue('TDEE') - tdeeF).toBe(340);
  });

  it('пот-тест подставляет текущий вес, пока его не трогали, и не перетирает введённый', () => {
    render(<MetabolicHub />);
    setNumber('Вес, кг', 95);
    expect(popupValue('Вес до, кг')).toBe('95');
    expect(popupValue('Вес после, кг')).toBe('95');
    // пользователь ввёл свой замер — вес тела больше не должен его двигать
    setNumber('Вес после, кг', 94.2);
    setNumber('Вес, кг', 96);
    expect(popupValue('Вес после, кг')).toBe('94.2');
  });

  it('сценарий хранит лабы и восстанавливает их (было 22 поля из ~90)', () => {
    render(<MetabolicHub />);
    setNumber('HCT, %', 52);
    setNumber('Ферритин, нг/мл', 15);
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').includes('Сохранить сценарий')) as HTMLElement);
    setNumber('HCT, %', 44);
    setNumber('Ферритин, нг/мл', 120);
    expect(fieldValue('HCT, %')).toBe('44 %');
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').includes('↺ Сценарий')) as HTMLElement);
    // сценарий раньше нёс только вес/рост/цель — лабы после загрузки пропадали
    expect(fieldValue('HCT, %')).toBe('52 %');
    expect(fieldValue('Ферритин, нг/мл')).toBe('15 нг/мл');
  });

  it('по умолчанию пот-тест не выдаёт выдуманное «измерение»', () => {
    render(<MetabolicHub />);
    // дефолты 83 → 82.2 кг + 0.5 л давали «измеренный 1.30 л/ч» без единого замера
    expect(document.body.textContent || '').not.toMatch(/измерено пот-тестом/);
    expect(document.body.textContent || '').toMatch(/Пока измерения нет/);
    expect(document.body.textContent || '').toMatch(/пот-тест: вес до\/после/);
  });

  it('«Сбросить весь ввод» чистит климат и пот, а не только лабы', () => {
    render(<MetabolicHub />);
    setSelect('Климат', 'Жара');
    setNumber('Пот, мл/ч', 1500);
    setNumber('Стресс', 9);
    expect(fieldValue('Пот, мл/ч')).toBe('1500 мл/ч');
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').includes('Сбросить весь ввод')) as HTMLElement);
    expect(fieldValue('Пот, мл/ч')).toBe('600 мл/ч');
    const climate = Array.from(document.querySelectorAll('button.pl-popupselect'))
      .find(b => (b.textContent || '').trim().startsWith('Климат'))!;
    expect(climate.textContent || '').toMatch(/Умеренный/);
  });

  it('сохранённый профиль пота применяется к расчёту (раньше только копился)', () => {
    render(<MetabolicHub />);
    setNumber('Вес до, кг', 83);
    setNumber('Вес после, кг', 82.2);
    setNumber('Выпито, л', 0.5);
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').trim().startsWith('💾 warm')) as HTMLElement);
    // в режиме «Взвешивание» ручное поле не работает — переключаемся на «Оценку»
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').includes('Оценка')) as HTMLElement);
    setNumber('Пот, мл/ч', 500);
    expect(fieldValue('Пот, мл/ч')).toBe('500 мл/ч');
    const water500 = tileValue('Вода');
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').trim().startsWith('warm ')) as HTMLElement);
    expect(fieldValue('Пот, мл/ч')).toBe('1300 мл/ч');
    expect(tileValue('Вода')).toBeGreaterThan(water500);
  });

  it('измеренный пот-тест попадает в воду, а не живёт только в карточке', () => {
    render(<MetabolicHub />);
    // без измерений «измеренный» не выдумывается: в воду идёт ручное 600 мл/ч
    expect(document.body.textContent || '').toMatch(/— ручное значение/);
    const waterManual = tileValue('Вода');
    setNumber('Вес до, кг', 83);
    setNumber('Вес после, кг', 82.2);
    setNumber('Выпито, л', 0.5);
    const waterMeasured = tileValue('Вода');
    expect(document.body.textContent || '').toMatch(/измерено пот-тестом/);
    expect(waterMeasured).toBeGreaterThan(waterManual);
    fireEvent.click(Array.from(document.querySelectorAll('button'))
      .find(b => (b.textContent || '').includes('Оценка')) as HTMLElement);
    expect(document.body.textContent || '').toMatch(/— ручное значение/);
    expect(tileValue('Вода')).toBe(waterManual);
  });
});
