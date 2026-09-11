import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlateCalcTab, BAR_TYPES } from '../PlateCalcTab';

describe('PlateCalcTab — контексты отображения', () => {
  it('без onApply (интеллект тренировки) кнопка «Применить» НЕ рендерится', () => {
    const html = renderToStaticMarkup(<PlateCalcTab />);
    expect(html).toContain('Калькулятор блинов');
    expect(html).not.toContain('Применить к плану');
  });

  it('с exerciseOptions рендерит селектор упражнения текущей сессии', () => {
    const html = renderToStaticMarkup(
      <PlateCalcTab exerciseOptions={[{ id: '0', label: 'Жим штанги лёжа', weight: 80 }]} onApply={() => {}} />,
    );
    expect(html).toContain('Упражнение текущей сессии');
    expect(html).toContain('Применить к плану');
  });

  it('с onApply и кастомной меткой рендерит её', () => {
    const html = renderToStaticMarkup(
      <PlateCalcTab exerciseOptions={[{ id: '0', label: 'Приседания', weight: 100 }]} onApply={() => {}} applyLabel="✅ Применить к упражнению" />,
    );
    expect(html).toContain('✅ Применить к упражнению');
  });

  it('без exerciseOptions селектор упражнения отсутствует', () => {
    const html = renderToStaticMarkup(<PlateCalcTab onApply={() => {}} />);
    expect(html).not.toContain('Упражнение текущей сессии');
  });

  it('К2: метрика и империя — один набор из 8 грифов (паритет)', () => {
    const metric = BAR_TYPES.metric.map(b => b.id).sort();
    const imperial = BAR_TYPES.imperial.map(b => b.id).sort();
    expect(metric).toEqual(imperial);
    expect(metric).toHaveLength(8);
  });

  it('Ж2: локации из стора рендерятся чипами', () => {
    localStorage.setItem('he_plate_locations', JSON.stringify([
      { id: 'home', name: 'Дом', barWeight: 15, plates: '', collars: 0, inventoryText: '' },
    ]));
    try {
      const html = renderToStaticMarkup(<PlateCalcTab />);
      expect(html).toContain('Локация');
      expect(html).toContain('Дом');
    } finally {
      localStorage.removeItem('he_plate_locations');
    }
  });
});
