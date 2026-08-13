import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { PlDeadpointsBarPathCard } from '../PlDeadpointsBarPathCard';
import { CYCLE_01 } from '../../../../data/lms-cycles/cycle-01';

describe('PlDeadpointsBarPathCard (единый калькулятор движения)', () => {
  it('рендерится без ошибок с 7 движениями и заголовком', () => {
    const html = renderToStaticMarkup(<PlDeadpointsBarPathCard dayCount={3} template={CYCLE_01} />);
    expect(html).toContain('Мёртвые точки');
    expect(html).toContain('Слабые точки');
    expect(html).toContain('Движение штанги');
    expect(html).toContain('Присед');
    expect(html).toContain('Жим лёжа');
  });

  it('рендерится без template (дефолтный протокол)', () => {
    const html = renderToStaticMarkup(<PlDeadpointsBarPathCard dayCount={3} />);
    expect(html).toContain('Мёртвые точки');
  });

  it('без выбранной фазы не показывает секцию упражнений', () => {
    const html = renderToStaticMarkup(<PlDeadpointsBarPathCard />);
    expect(html).not.toContain('Упражнения (из раскладки цикла');
  });

  it('содержит кнопки добавления в ПЛ-авто и фокус-группу', () => {
    const html = renderToStaticMarkup(<PlDeadpointsBarPathCard />);
    expect(html).toContain('Добавить выбранные упражнения в ПЛ-авто');
    expect(html).toContain('Сохранить фокус-группу');
  });
});
