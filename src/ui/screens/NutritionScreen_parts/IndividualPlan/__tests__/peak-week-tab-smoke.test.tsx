/**
 * peak-week-tab-smoke.test.tsx — smoke-тесты вкладки «🏁 Тапер ББ» (PeakWeekTab).
 *
 * Проверяем: вкладка рендерится в планировщике, кнопки «Применить тапер-план ББ»
 * и «Сохранить в профиль» присутствуют, выбор пола переключает список категорий.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const clickTab = (label: string) => {
  const tab = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes(label));
  if (!tab) throw new Error(`Tab not found: ${label}`);
  fireEvent.click(tab);
};

describe('PeakWeekTab smoke', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });

  it('вкладка «Тапер ББ» открывается и содержит кнопку применить', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickTab('Тапер ББ');
    expect(screen.getAllByText(/Применить тапер-план ББ/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Сохранить в профиль/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Сводка/).length).toBeGreaterThan(0);
  });

  it('«📋 Сводка» копирует протокол в буфер (fallback execCommand)', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickTab('Тапер ББ');
    let execCalled = false;
    const origExec = (document as any).execCommand;
    (document as any).execCommand = (() => { execCalled = true; return true; }) as any;
    const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Сводка'));
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    expect(execCalled).toBe(true);
    (document as any).execCommand = origExec;
  });

  it('вкладка показывает пик-неделю из движка (деплеция → загрузка → шоу)', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickTab('Тапер ББ');
    // Таблица пик-недели: фазы из PHASE_LABELS_RU
    expect(screen.getAllByText(/Деплеция 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Загрузка 3/).length).toBeGreaterThan(0);
  });

  it('смена пола переключает список категорий (bikini для женщин)', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    clickTab('Тапер ББ');
    // Открыть попап «Пол»
    const sexBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Пол'));
    expect(sexBtn).toBeTruthy();
    fireEvent.click(sexBtn!);
    fireEvent.click(screen.getByText('Женский'));
    // Попап «Категория» теперь содержит Bikini
    const catBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('Категория'));
    expect(catBtn).toBeTruthy();
    fireEvent.click(catBtn!);
    expect(screen.getAllByText('Bikini').length).toBeGreaterThan(0);
  });
});
