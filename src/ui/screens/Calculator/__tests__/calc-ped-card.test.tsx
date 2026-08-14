/** calc-ped-card.test.tsx — UI-тест карточки «💊 Курс (PED)»:
 *  разворот/сворачивание, яркая кнопка «➕ Добавить препарат», попап добавления,
 *  баннер пустого курса, подсветка «Дополнительные PED». */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CalcPEDCard } from '../CalcPEDCard';

beforeEach(() => {
  localStorage.clear();
});

const state = (aas: any[] = [], extra: any = {}) => ({
  pharma: { phase: 'course', aas, ghIU: 0, insulinIU: 0, igfMcg: 0, clenMcg: 0, t3Mcg: 0, ...extra },
});

const renderCard = (s: any = state()) => {
  const onChange = (next: any) => { renderCard(next); };
  render(React.createElement(CalcPEDCard, { state: s, onStateChange: onChange } as any));
  return onChange;
};

describe('CalcPEDCard — карточка «Курс (PED)»', () => {
  it('свёрнута по умолчанию, разворачивается по клику на заголовок', () => {
    renderCard();
    expect(screen.queryByText('Добавить препарат')).toBeNull();
    fireEvent.click(screen.getByText(/Курс \(PED\)/));
    expect(screen.getByText('Добавить препарат')).toBeTruthy();
    // повторный клик сворачивает
    fireEvent.click(screen.getByText(/Курс \(PED\)/));
    expect(screen.queryByText('Добавить препарат')).toBeNull();
  });

  it('показывает бейдж «курс пуст» без препаратов и баннер-подсказку при развороте', () => {
    renderCard();
    expect(screen.getByText(/курс пуст/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Курс \(PED\)/));
    expect(screen.getByText(/Курс пуст — добавьте препараты/)).toBeTruthy();
  });

  it('кнопка «➕ Добавить препарат» открывает попап добавления', () => {
    renderCard();
    fireEvent.click(screen.getByText(/Курс \(PED\)/));
    fireEvent.click(screen.getByText('Добавить препарат'));
    expect(screen.getAllByText(/Добавить препарат/).length).toBeGreaterThan(1); // кнопка + заголовок попапа
  });

  it('показывает счётчик ААС и список препаратов курса', () => {
    renderCard(state([{ id: 'tren_acet', mgPerWeek: 500, weeks: 12 }]));
    expect(screen.getByText(/1 ААС/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Курс \(PED\)/));
    expect(screen.getByText('Тренболон ацетат')).toBeTruthy();
  });

  it('подсвечивает «Дополнительные PED» при наличии GH/инсулина', () => {
    renderCard(state([], { ghIU: 4, insulinIU: 10 }));
    fireEvent.click(screen.getByText(/Курс \(PED\)/));
    expect(screen.getByText(/Дополнительные PED/)).toBeTruthy();
    expect(screen.getByText(/GH 4 МЕ\/день/)).toBeTruthy();
    expect(screen.getByText(/Инсулин 10 МЕ\/день/)).toBeTruthy();
  });
});
