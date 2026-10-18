import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { LiftMasterCard, BB_GRANULAR_GROUPS } from '../LiftMasterCard';
import { meetAttemptsFor, warmupToOpener } from '../../../../engines/lms/competition-attempts';
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';

afterEach(()=>{ cleanup(); localStorage.removeItem('he_lift_master_v1'); });

describe('LiftMasterCard — единый инструмент движения (универсальный)', () => {
  it('рендерится 8+ блоков заголовков', () => {
    const html = renderToStaticMarkup(<LiftMasterCard sessions={[]} />);
    expect(html).toContain('— единый инструмент');
    expect(html).toContain('1 · Слабые мышцы');
    expect(html).toContain('2 · Слабые точки');
    expect(html).toContain('3 · Мёртвые точки');
    expect(html).toContain('4 · Движение штанги');
    expect(html).toContain('5 · Геометрия техники');
    expect(html).toContain('6 · VBT');
    expect(html).toContain('7 · Срывы');
    expect(html).toContain('8 · RIR-калибровка');
    expect(html).toContain('10 · Остальные лимитирующие');
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

  it('секция 11 «День старта» рендерится: стратегии, попытки по ПМ, нормы', () => {
    const html = renderToStaticMarkup(<LiftMasterCard sessions={[]} profile={{ bodyWeight: 83, pmSquat: 180, pmBench: 120, pmDead: 200 } as any} />);
    expect(html).toContain('11 · День старта');
    expect(html).toContain('Консервативная 90/95.5/100%');
    expect(html).toContain('Сбалансированная 92/96/102%');
    expect(html).toContain('Агрессивная 93/97/105%');
    expect(html).toContain('Относительная сила');
    expect(html).toContain('DOTS');
  });

  it('секция 11: попытки считаются от введённых ПМ и округляются до 2.5 кг', () => {
    // Чистая логика движка попыток (UI-инпуты секции 11 ведут в эти функции)
    const a = meetAttemptsFor(100, 'balanced');
    expect(a.opener).toBe(92.5);
    expect(a.second).toBe(95);
    expect(a.third).toBe(102.5);
    const w = warmupToOpener(a.opener);
    expect(w[0].pct).toBe(0.4);
    expect(w[w.length - 1].pct).toBe(0.9);
  });

  it('BB-грануляр: 20 кнопок, все id существуют в EXERCISE_CATALOG (нет фейковых/сырых id)', () => {
    // Регрессия: агент добавил 8 кнопок с несуществующими id (bb_floor_press и т.д.)
    // и маппил bb_pause_bench на базовый «Жим штанги лёжа» вместо «Жим с паузой».
    expect(BB_GRANULAR_GROUPS).toHaveLength(20);
    expect(new Set(BB_GRANULAR_GROUPS.map(g => g.id)).size).toBe(20);
    const byId = new Map(EXERCISE_CATALOG.map(e => [e.id, e.name]));
    for (const g of BB_GRANULAR_GROUPS) {
      expect(byId.has(g.id), `id ${g.id} отсутствует в EXERCISE_CATALOG`).toBe(true);
      // Название для инъекции в план обязано быть каталогным (не сырой id).
      expect(byId.get(g.id), `имя ${g.id}`).toBeTruthy();
    }
    // Паузный жим — отдельное упражнение, а не базовый жим штанги.
    expect(byId.get('pl_bench_pause')).toBe('Жим с паузой');
  });

  it('рандерит все 20 кнопок BB-грануляра', () => {
    const html = renderToStaticMarkup(<LiftMasterCard sessions={[]} />);
    expect(html).toContain('Жим с пола (старт)');
    expect(html).toContain('Тяга с дефицитом (старт)');
    expect(html).toContain('Жим с паузой (старт)');
    expect(html).toContain('20 точечных упражнений');
  });
});
