import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
});

/** Кнопка таба из ряда .ad-steps[data-arm="hub-tabs"] — по aria-label.
 * Нужен вместо getByText: подписи табов встречаются и в карточках контента. */
const tabBtn = (re: RegExp): HTMLButtonElement =>
  Array.from(document.querySelectorAll('[data-arm="hub-tabs"] button')).find((b) => re.test(b.textContent || ''))!;

describe('ArmDiagnosticsHub PRO', () => {
  it('рендерит заголовок и 4 подвкладки', () => {
    const { container } = render(<ArmDiagnosticsHub />);
    expect(container.textContent).toContain('Арм-диагностика');
    // use buttons to avoid duplicate text in description
    expect(screen.getByRole('button', { name: /Хват/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Кисть\/Ротация/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Давление/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Сухожилие/ })).toBeTruthy();
  });

  it('переключение вкладок', () => {
    render(<ArmDiagnosticsHub />);
    const wristBtn = screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON') || screen.getAllByText(/Кисть\/Ротация/)[0];
    fireEvent.click(wristBtn);
    expect(document.body.textContent).toContain('Локоть');
  });

  it('каркас 1-в-1 с ТА-хабом: герой → ряд табов+применить → итог → нижняя панель', () => {
    const { container } = render(<ArmDiagnosticsHub />);
    // 1 — герой с параметрами (свёрнуты в герое, не отдельной карточкой)
    expect(container.querySelector('[data-arm="hub-head"]')).toBeTruthy();
    expect(container.querySelector('[data-arm="hub-head"] [data-arm="hub-params"]')).toBeTruthy();
    expect(container.querySelector('[data-arm="hub-params-head"]')).toBeNull();
    // 2 — ряд табов с «Применить» РЯДОМ с пилюлями (не отдельной карточкой снизу)
    const tabbar = container.querySelector('[data-arm="hub-tabbar"]')!;
    expect(tabbar).toBeTruthy();
    expect(tabbar.querySelector('[data-arm="hub-tabs"]')).toBeTruthy();
    expect(tabbar.querySelector('[data-arm="hub-apply-top"]')).toBeTruthy();
    // 3 — в ТА НЕТ отдельного заголовка «Итог»: мост-превью идёт своей карточкой «📦 Что уедет»
    expect(container.querySelector('[data-arm="hub-result-head"]')).toBeNull();
    expect(container.querySelector('[data-arm="hub-bridge-preview"]')).toBeTruthy();
    // 4 — нижний ряд действий: применить + весь экспорт
    const bar = container.querySelector('[data-arm="hub-action-bar"]')!;
    expect(bar).toBeTruthy();
    expect(bar.querySelector('[data-arm="hub-apply-bottom"]')).toBeTruthy();
    for (const hook of ['export-html', 'export-print', 'export-csv', 'export-ics']) {
      expect(bar.querySelector(`[data-arm="${hook}"]`)).toBeTruthy();
    }
    // низ — последняя секция хаба (ниже только ничего лишнего)
    expect(bar.nextElementSibling).toBeNull();
  });

  it('визуальный язык ТА-хаба применён (surface #0a1629 / кромка #1f3a5f / синий актив / градиент «Применить»)', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'arm-design.css'),
      'utf-8',
    );
    const sec = css.slice(css.indexOf('§WL-VISUAL-PARITY'));
    expect(sec.length).toBeGreaterThan(500);
    // токены поверхности/кромки/акцента — из inline-стилей ТА-хаба
    expect(sec).toContain('--ad-bg: #0a1629');
    expect(sec).toContain('--ad-edge: #1f3a5f');
    expect(sec).toContain('--ad-acc: #3b82f6');
    // активная пилюля таба/чипа — синяя (TA), не зелёная/янтарная
    expect(sec).toMatch(/\.ad-step\[data-active='true'\][\s\S]{0,200}#3b82f6/);
    expect(sec).toMatch(/\.ad-chip\[data-active='true'\][\s\S]{0,200}#3b82f6/);
    // «Применить» (variant=amber) = градиент ТА 135° #3b82f6→#a855f7
    expect(sec).toMatch(/data-variant='amber'[\s\S]{0,160}linear-gradient\(135deg, #3b82f6, #a855f7\)/);
    // НИЗ = обычный flex-ряд без подложки (как в ТА): моя прежняя «панель действий» с кромкой — выдумка
    expect(sec).toMatch(/\[data-arm='hub-action-bar'\] \{[^}]*background: none;[^}]*border: 0/);
    expect(sec).toMatch(/:is\(\.train-armdiag\) \.ad-cta \{[^}]*position: static/);
    expect(sec).not.toMatch(/\[data-arm='hub-action-bar'\] \{[^}]*background: #0a1629/);
    // поля ввода — метрики ТА (r10 / p10 / 16px / 44px)
    expect(sec).toMatch(/input[\s\S]{0,400}border-radius: 10px[\s\S]{0,200}font-size: 16px[\s\S]{0,120}min-height: 44px/);
    // блок селекторов не утекает наружу арм-зон (правило 1 файла)
    for (const line of sec.split('\n')) {
      const l = line.trim();
      if (!l.endsWith('{') || l.startsWith('/*') || l.startsWith('@')) continue;
      expect(l.startsWith(':is(.train-arm')).toBe(true);
    }
  });

  it('выбор упражнений и коррекция — синий язык ТА, не янтарный', () => {
    const pick = fs.readFileSync(path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'arm-hub-pick.tsx'), 'utf-8');
    const corr = fs.readFileSync(path.join(process.cwd(), 'src', 'ui', 'screens', 'TrainingScreen_parts', 'arm-hub-correction-tab.tsx'), 'utf-8');
    for (const src of [pick, corr]) {
      expect(src).toContain('rgba(59,130,246,0.16)');
      expect(src).not.toContain('245,158,11');
    }
  });

  it('P1: таб Коррекция — пустое состояние + цепочка', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Коррекция/ }));
    expect(document.body.textContent).toContain('Коррекция движений');
  });

  it('P4: углы подсказывают точку в табе Коррекции', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    fireEvent.change(screen.getByPlaceholderText('90'), { target: { value: '140' } });
    fireEvent.click(screen.getByRole('button', { name: /Коррекция/ }));
    expect(document.body.textContent).toContain('Углы подсказывают');
    fireEvent.click(screen.getByRole('button', { name: '+ Pron lock' }));
    expect(document.body.textContent).toContain('Коррекция движений (1)');
  });

  it('P2: фаза срыва в табе Коррекции двигает ранжир', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    fireEvent.click(screen.getByText(/Side pin/));
    fireEvent.click(screen.getByRole('button', { name: /Коррекция/ }));
    expect(document.body.textContent).toContain('Где срыв');
    expect(document.body.textContent).toContain('Доза базы');
    fireEvent.click(screen.getByRole('button', { name: 'Дожитие' }));
    expect(document.body.textContent).toContain('чинит фазу срыва');
  });

  it('применить без слабых зон — тост', () => {
    const { container } = render(<ArmDiagnosticsHub />);
    const btn = screen.getAllByText(/Применить в Арм-конструктор/)[0];
    fireEvent.click(btn);
    expect(container.textContent).toContain('не выявлены');
  });

  it('выбор cup → слабые зоны', () => {
    render(<ArmDiagnosticsHub />);
    // switch to wrist tab
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    const cupBtn = screen.getByText(/Кисть открывается/);
    fireEvent.click(cupBtn);
    expect(document.body.textContent).toContain('wrist_flexors');
  });

  it('чип side_pin зажигает humerus-превью (mockGuard, без legacy)', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    fireEvent.click(screen.getByText(/Side pin/));
    const box = screen.getByText('Humerus (side)').parentElement!;
    expect(box.textContent).toContain('humerus risk');
  });

  it('APK: цифровые клавиатуры на числовых полях', () => {
    render(<ArmDiagnosticsHub />);
    expect(screen.getByPlaceholderText('60').getAttribute('inputmode')).toBe('decimal');
    expect(screen.getByPlaceholderText('15').getAttribute('inputmode')).toBe('decimal');
  });

  it('видео-контур удалён полностью: нет камеры, landmarks JSON, Kinovea и textarea', () => {
    render(<ArmDiagnosticsHub />);
    for (const re of [/Хват/, /Сила/, /Кисть\/Ротация/, /Давление/, /Сухожилие/, /Коррекция/]) {
      fireEvent.click(tabBtn(re));
      expect(document.querySelector('textarea')).toBeNull();
      expect(document.body.textContent).not.toContain('landmarks');
      expect(document.body.textContent).not.toContain('Kinovea');
      expect(document.body.textContent).not.toContain('Включить камеру');
      expect(document.body.textContent).not.toContain('Видео подсказывает');
      expect(document.body.textContent).not.toContain('xLoop');
    }
    // ручной ввод углов остался живым (таб «Сухожилие» → «Дополнительно»)
    fireEvent.click(tabBtn(/Сухожилие/));
    expect(document.body.textContent).toContain('Ввод углов: ручной');
  });

  it('legacy cup зеркалится в чипы 12 точек', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    const cupBtn = () => screen.getAllByText(/Кисть открывается/).find(el=> el.tagName==='BUTTON')!;
    fireEvent.click(cupBtn());
    expect(document.body.textContent).toContain('Выбрано: cup_start, cup_hold');
    // повторный клик снимает и чипы, и чекбокс
    fireEvent.click(cupBtn());
    expect(document.body.textContent).toContain('Выбрано: —');
  });

  it('кнопка применить отправляет в planner-bridge', async () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    fireEvent.click(screen.getByText(/Кисть открывается/));
    expect(document.body.textContent).toContain('wrist_flexors');
    // подождать обновления diag
    await new Promise(r => setTimeout(r, 50));
    const btns = screen.getAllByText(/Применить в Арм-конструктор/);
    fireEvent.click(btns[btns.length - 1]);
    expect(await screen.findByText(/Применено/)).toBeTruthy();
  });

  it('12 мёртвых точек — выбор pron_open и карточка биомеханики', async () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    // выбираем Pron откр (label с точкой ● — используем regex)
    const pronOpenBtn = screen.getByText(/Pron откр/);
    fireEvent.click(pronOpenBtn);
    expect(document.body.textContent).toContain('Пронация — вход');
    expect(document.body.textContent).toContain('Коррекции');
    expect(pronOpenBtn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByText(/Sup cup/));
    expect(screen.getByText(/Sup cup/).getAttribute('aria-pressed')).toBe('true');
    expect(document.body.textContent).toContain('Выбрано:');
  });

  it('давление — side_pin humerus guard', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    expect(document.body.textContent).toContain('Side pin');
    const sidePinBtn = screen.getByText(/Side pin/);
    fireEvent.click(sidePinBtn);
    expect(sidePinBtn.getAttribute('aria-pressed')).toBe('true');
    expect(document.body.textContent.toLowerCase()).toContain('humerus');
  });

  it('side/back угол н/п — честный бейдж вместо ложного ⚠', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    fireEvent.click(screen.getByText(/Side pin/));
    expect(document.body.textContent).toContain('угол н/п');
  });

  it('grip-чип: pinch<10с предлагает contain_fingers', () => {
    render(<ArmDiagnosticsHub />);
    const pinchInput = screen.getByPlaceholderText('15');
    fireEvent.change(pinchInput, { target: { value: '6' } });
    expect(document.body.textContent).toContain('Слабое звено хвата');
    const addBtn = screen.getByText(/Добавить contain_fingers/);
    fireEvent.click(addBtn);
    expect(addBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('авто-подсказка по углам предлагает точку', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    const wristInputs = screen.getAllByPlaceholderText('10');
    // wristDeg уже 10 по умолчанию; ставим forearm 140 → pron_lock
    const foreInput = screen.getByPlaceholderText('90');
    fireEvent.change(foreInput, { target: { value: '140' } });
    expect(document.body.textContent).toContain('Авто по углам');
  });

  it('P0: карточка план→инъекция рендерится без плана', () => {
    render(<ArmDiagnosticsHub />);
    expect(document.body.textContent).toContain('P0 PRO');
    expect(document.body.textContent).toContain('Нет плана арм');
  });

  it('P0: инъекция без точек — тост', () => {
    render(<ArmDiagnosticsHub />);
    const btns = screen.getAllByText(/Вставить коррекции в план/);
    fireEvent.click(btns[0]);
    expect(document.body.textContent).toContain('нечего вставлять');
  });

  it('P0: выбор точки показывает причину и топ-3', async () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    fireEvent.click(screen.getByText(/Pron откр/));
    expect(document.body.textContent).toContain('Топ-3');
  });

  it('P1 E9: пороги точки на VBT-карточке после выбора', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    fireEvent.click(screen.getByText(/Pron откр/));
    fireEvent.click(screen.getByRole('button', { name: /Хват/ }));
    expect(document.body.textContent).toContain('Пороги точки pron_open');
  });

  it('P1 E10+E11: мобильность и авторегуляция в Recovery', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect(document.body.textContent).toContain('Мобильность');
    expect(document.body.textContent).toContain('Авторегуляция');
    expect(document.body.textContent).toContain('Гварды плана');
  });

  it('P1 E12: bilateral в Strength при L/R', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByPlaceholderText('50'), { target: { value: '40' } });
    fireEvent.change(screen.getByPlaceholderText('55'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Сила/ }));
    expect(document.body.textContent).toContain('Bilateral:');
  });

  it('P2 E13: помост %WR при RT', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '68' } });
    expect(document.body.textContent).toContain('% WR');
    expect(document.body.textContent).toContain('Весогонка WAF');
  });

  it('P2 E14: кнопки экспорта рендерятся', () => {
    render(<ArmDiagnosticsHub />);
    expect(screen.getByText('🖨 HTML')).toBeTruthy();
    expect(screen.getByText('📥 CSV')).toBeTruthy();
    expect(screen.getByText('🖨 Печать')).toBeTruthy();
  });

  it('P2 E15: снапшот замеров копит историю', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '68' } });
    fireEvent.click(screen.getByText('📸 Снапшот замеров'));
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '70' } });
    fireEvent.click(screen.getByText('📸 Снапшот замеров'));
    expect(document.body.textContent).toContain('68 → 70');
  });

  it('P2 E12: сохранение L/R показывает историю', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByPlaceholderText('50'), { target: { value: '40' } });
    fireEvent.change(screen.getByPlaceholderText('55'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Сила/ }));
    fireEvent.click(screen.getByText('💾 Сохранить L/R замер'));
    expect(document.body.textContent).toContain('История:');
  });

  it('D1: боль локтя + sRPE → Side→изометрия', () => {
    localStorage.setItem('he_srpe_sessions', JSON.stringify([{ date: new Date().toISOString().slice(0, 10), sRPE: 5, durationMin: 60 }]));
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    fireEvent.change(screen.getByLabelText('Боль локоть 0-10'), { target: { value: '8' } });
    expect(document.body.textContent).toContain('Side → изометрия');
  });

  it('D4: P1-поля персистятся (remount)', () => {
    const first = render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    fireEvent.change(screen.getByLabelText('Боль локоть 0-10'), { target: { value: '5' } });
    first.unmount();
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect((screen.getByLabelText('Боль локоть 0-10') as HTMLInputElement).value).toBe('5');
  });

  it('D4: попытка помоста пишется в историю с %WR', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText('Попытка помост кг'), { target: { value: '68' } });
    fireEvent.click(screen.getByText('💾 Попытку'));
    expect(document.body.textContent).toContain('68✓ 52.1%');
  });

  it('R1: график RT рисуется после двух снапшотов', () => {
    const { container } = render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText('Попытка помост кг'), { target: { value: '60' } });
    fireEvent.click(screen.getByText('📸 Снапшот замеров'));
    fireEvent.change(screen.getByLabelText('Попытка помост кг'), { target: { value: '60' } });
    expect(container.querySelectorAll('[data-bar="rt"]').length).toBe(0);
    fireEvent.change(screen.getAllByPlaceholderText('60')[0], { target: { value: '68' } });
    fireEvent.click(screen.getByText('📸 Снапшот замеров'));
    fireEvent.change(screen.getAllByPlaceholderText('60')[0], { target: { value: '70' } });
    fireEvent.click(screen.getByText('📸 Снапшот замеров'));
    expect(container.querySelectorAll('[data-bar="rt"]').length).toBe(2);
  });

  it('P1: кнопка Следующий шаг ведёт по табам и не двоит имена', () => {
    render(<ArmDiagnosticsHub />);
    // ровно одна кнопка с именем таба — навигация Next имеет нейтральный aria-label
    expect(screen.getAllByRole('button', { name: /Давление/ }).length).toBe(1);
    const next = screen.getByRole('button', { name: 'Следующий шаг диагностики' });
    expect(next.textContent).toContain('Шаг 1 из 6');
    fireEvent.click(next);
    expect(screen.getByRole('button', { name: 'Следующий шаг диагностики' }).textContent).toContain('Шаг 2 из 6');
    expect(document.body.textContent).toContain('Bezkorovainyi');
  });

  it('P3: нормы ты-vs-мир в Grip + ROM-нормы в Recovery', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '68' } });
    expect(document.body.textContent).toContain('RT vs WR');
    expect(document.body.textContent).toContain('% WR');
    fireEvent.change(screen.getByPlaceholderText('15'), { target: { value: '6' } });
    expect(document.body.textContent).toContain('<10с — чинить');
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect(document.body.textContent).toContain('Нормы ROM');
  });

  it('P4: точка из вкладки Кисть попадает в Коррекцию (видео-подсказок нет)', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(tabBtn(/Кисть\/Ротация/));
    fireEvent.click(screen.getByText(/Pron откр/));
    fireEvent.click(tabBtn(/Коррекция/));
    expect(document.body.textContent).not.toContain('Видео подсказывает');
    // выбранная точка видна в коррекции — таб перешёл в режим карточек
    expect(document.body.textContent).toContain('Коррекция движений (1)');
    expect(document.body.textContent).toContain('Доза базы');
  });

  it('P5: red-flags стоп + press-гейт новичка', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByText('Острая боль'));
    expect(document.body.textContent).toContain('🔴 Стоп');
    expect(document.body.textContent).toContain('не диагноз');
    fireEvent.click(screen.getByText('Новичок'));
    fireEvent.click(screen.getByText('Пресс'));
    expect(document.body.textContent).toContain('Новичкам пресс опасен');
  });

  it('P6: сценарий замеров снимается и сравнивает', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '68' } });
    fireEvent.click(screen.getByText('📸 Снапшот текущего'));
    expect(document.body.textContent).toContain('Δ vs сейчас: без изменений');
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '70' } });
    expect(document.body.textContent).toContain('RT +2');
  });

  it('P7: превью моста — пусто честно, с точками по делу (ROUND-10: + data-arm-хук)', () => {
    render(<ArmDiagnosticsHub />);
    expect(document.body.querySelector('[data-arm="hub-bridge-preview"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Пока нечего отправлять');
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    fireEvent.click(screen.getByText(/Pron откр/));
    expect(document.body.textContent).toContain('Что уедет в конструктор');
    expect(document.body.textContent).toContain('Точки: pron_open');
    expect(document.body.querySelector('[data-arm="hub-bridge-preview"]')!.textContent).toMatch(/Точки: pron_open/);
  });

  it('ROUND-10: ICS арм-плана — без плана честно, с планом выгружает календарь', async () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmDiagnosticsHub />);
    const btn = document.body.querySelector('[data-arm="export-ics"]');
    expect(btn).not.toBeNull();
    fireEvent.click(btn!);
    await waitFor(() => expect(document.body.textContent).toContain('Нет арм-плана'));
    localStorage.setItem('he_arm_plan_saved', JSON.stringify({ plan: { weeks: [{ week: 1, sessions: [{ day: 1, sessionTag: 'GripHeavy', character: 'тяж', exercises: [{ name: 'RT', sets: 3, repsRange: [3, 3] }] }] }] } }));
    fireEvent(window, new Event('he-arm-plan-saved'));
    await waitFor(() => expect(btn).not.toBeNull());
    fireEvent.click(btn!);
    // Контракт изменён осознанно: выгрузка идёт через core/apk-share (saveTextFileApk),
    // поэтому тост — это честный ИТОГ операции (shareOutcomeLabel), а не обещание
    // «✓ Календарь .ics»: на АПК старый путь через <a download> файл вообще не писал.
    await waitFor(() => expect(document.body.textContent).toMatch(/Отправлено|Сохранено|Скопировано|Не удалось/));
  });

  it('ICS blocked-плана показывает safety-причину и не выгружает календарь', async () => {
    try { localStorage.clear(); } catch { /* noop */ }
    localStorage.setItem('he_arm_plan_saved', JSON.stringify({
      plan: {
        validation: { valid: true, errors: [], warnings: [], status: 'blocked', blocked: ['Ось humerus high'] },
        weeks: [{ week: 1, sessions: [{ day: 1, sessionTag: 'GripHeavy', character: 'тяж', exercises: [{ name: 'RT', sets: 3, repsRange: [3, 3] }] }] }],
      },
    }));
    render(<ArmDiagnosticsHub />);
    const btn = document.body.querySelector('[data-arm="export-ics"]');
    fireEvent.click(btn!);
    await waitFor(() => expect(document.body.textContent).toContain('Экспорт заблокирован'));
    expect(document.body.textContent).toContain('Ось humerus high');
    expect(document.body.textContent).not.toContain('Календарь .ics (недели/сессии плана)');
  });
  it('F1: селект снаряда Axle меняет норму 133 ↔ 237.5', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '200' } });
    expect(document.body.textContent).toContain('Axle vs Saxon-ориентир');
    expect(document.body.textContent).toContain('150%');
    fireEvent.click(screen.getByText(/Apollon \(М/));
    expect(document.body.textContent).toContain('Axle vs Apollon WR');
    expect(document.body.textContent).toContain('84%');
  });

  it('F2: teen-гейт 14–15 показывает MHE-баннер', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByText('Подросток 14–15'));
    expect(document.body.textContent).toContain('надмыщелка');
    expect(document.body.textContent).toContain('не диагноз');
  });

  it('F3: памятка фолов WAF в Давлении', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    expect(document.body.textContent).toContain('Фолы WAF');
    expect(document.body.textContent).toContain('Отрыв локтя');
    expect(document.body.textContent).toContain('back_drag');
  });

  it('R1: единый вердикт асимметрии из 3 источников', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByPlaceholderText('50'), { target: { value: '40' } });
    fireEvent.change(screen.getByPlaceholderText('55'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Сила/ }));
    expect(document.body.textContent).toContain('Вердикт: max');
    expect(document.body.textContent).toContain('Источники:');
  });

  it('R2: Recovery распилен на Нагрузка/Тело/Итог', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect(document.body.textContent).toContain('📊 Нагрузка');
    expect(document.body.textContent).toContain('🦿 Тело');
    expect(document.body.textContent).toContain('Мобильность');
    expect(document.body.textContent).toContain('Авторегуляция');
  });

  it('R3: Grip распилен на Замеры/Приборы', () => {
    render(<ArmDiagnosticsHub />);
    expect(document.body.textContent).toContain('✊ Замеры хвата');
    expect(document.body.textContent).toContain('📟 Приборы');
    expect(document.body.textContent).toContain('Force Vector');
  });

  it('R4: инъекция hero, экспорты ghost', () => {
    render(<ArmDiagnosticsHub />);
    const inject = screen.getByText(/Вставить коррекции в план/);
    expect(inject.classList.contains('ad-btn-hero')).toBe(true);
    expect(screen.getByText('🖨 HTML').getAttribute('data-variant')).toBe('ghost');
    expect(screen.getByText('📥 CSV').getAttribute('data-variant')).toBe('ghost');
  });

  it('R5: связка точек с матчапом', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    fireEvent.click(screen.getByText(/Pron откр/));
    fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
    expect(document.body.textContent).toContain('Связка: точки pron_open');
  });

  it('X1: Excalibur замер без выдуманного WR + CoC-ориентир', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.change(screen.getByPlaceholderText('40'), { target: { value: '45' } });
    expect(document.body.textContent).toContain('Excalibur 50мм');
    expect(document.body.textContent).toContain('SAR по своей весовой');
    expect(document.body.textContent).toContain('не калибровка');
  });

  it('D2: per-muscle danger виден в Recovery', () => {
    const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const mk = (date: string, n: number) => ({ date, exercises: [{ muscle: 'pronators', sets: Array.from({ length: n }, () => ({ weightKg: 30, reps: 8 })) }] });
    localStorage.setItem('he_workout_log_v1', JSON.stringify([mk(ago(1), 10), mk(ago(20), 2)]));
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect(document.body.textContent).toContain('pronators');
  });

  it('ROUND-10: dневник читается из ЖИВОГО ключа he_workout_log_v2 (v2-форма)', () => {
    const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const sess = (date: string, n: number, sessionId: string) => ({
      sessionId, date, focus: 'grip',
      exercises: [{ exerciseId: 'wrist_curl_db', exerciseName: 'Сгибание кисти', muscle: 'pronators', sets: Array.from({ length: n }, () => ({ weightKg: 30, reps: 8, rpe: 8 })) }],
    });
    localStorage.setItem('he_workout_log_v2', JSON.stringify([sess(ago(1), 10, 'a'), sess(ago(20), 2, 'b')]));
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect(document.body.textContent).toContain('pronators');
  });
});
