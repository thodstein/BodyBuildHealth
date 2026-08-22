import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { LiftMasterCard } from '../LiftMasterCard';

afterEach(()=>{ cleanup(); localStorage.removeItem('he_lift_master_v1'); });

describe('LiftMasterCard — единый инструмент движения (универсальный)', () => {
  it('рендерится 8 блоков заголовков', () => {
    const html = renderToStaticMarkup(<LiftMasterCard sessions={[]} />);
    expect(html).toContain('— единый инструмент');
    expect(html).toContain('1 · Слабые мышцы');
    expect(html).toContain('2 · Слабые точки');
    expect(html).toContain('3 · Мёртвые точки');
    expect(html).toContain('4 · Движение штанги');
    expect(html).toContain('5 · Геометрия техники');
    expect(html).toContain('6 · VBT');
    expect(html).toContain('7 · Дневник');
  });
  it('геометрия показывает 8 параметров (разведение локтей и т.д.)', () => {
    const html = renderToStaticMarkup(<LiftMasterCard sessions={[]} />);
    expect(html).toContain('Узкий хват');
    expect(html).toContain('Широкий хват');
    expect(html).toContain('Локти прижаты');
    expect(html).toContain('Локти разведены');
    expect(html).toContain('Мост и лопатки');
    expect(html).toContain('Leg drive');
    expect(html).toContain('Кисть нейтраль');
    expect(html).toContain('Точка касания');
  });
  it('кнопка добавления в ПЛ-авто присутствует', () => {
    render(<LiftMasterCard sessions={[]} />);
    expect(screen.getByText(/Добавить в ПЛ-авто/)).toBeTruthy();
  });
});
