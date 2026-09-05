import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmDiagnosticsHub } from '../ArmDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
});

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

  it('APK: офлайн-хинт про Hands-модель', () => {
    const nav = window.navigator as any;
    const prev = nav.onLine;
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    try {
      render(<ArmDiagnosticsHub />);
      fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
      expect(document.body.textContent).toContain('Офлайн (APK)');
    } finally {
      Object.defineProperty(window.navigator, 'onLine', { value: prev, configurable: true });
    }
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

  it('P1 E8: Kinovea CSV → метрики и тип', () => {
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Кисть\/Ротация/).find(el=> el.tagName==='BUTTON')!);
    const area = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 't,x,y\n0,0,0\n0.5,3,1\n1.0,8,2' } });
    expect(document.body.textContent).toContain('xLoop 8');
    expect(document.body.textContent).toContain('toproll наружу');
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

  it('D2: per-muscle danger виден в Recovery', () => {
    const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const mk = (date: string, n: number) => ({ date, exercises: [{ muscle: 'pronators', sets: Array.from({ length: n }, () => ({ weightKg: 30, reps: 8 })) }] });
    localStorage.setItem('he_workout_log_v1', JSON.stringify([mk(ago(1), 10), mk(ago(20), 2)]));
    render(<ArmDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Сухожилие/ }));
    expect(document.body.textContent).toContain('pronators');
  });
});
