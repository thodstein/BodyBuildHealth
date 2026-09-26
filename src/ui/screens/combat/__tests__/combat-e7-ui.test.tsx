/**
 * combat-e7-ui.test.tsx — наука доходит до экрана (E7).
 *
 * Ключевой контраст с движковым тестом: движок может считать константы
 * правильно, а пользователь их не увидит. Здесь проверяем РЕНДЕР на
 * настоящем плане — поведением, а не чтением исходника.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CbCampIntelCard } from '../cb-camp-intel';
import { buildCombatPlan } from '../../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan } from '../../../../engines/combat/combat-finalize.engine';
import { buildWeightCutProtocol } from '../../../../engines/combat/combat-weight-cut.engine';

beforeEach(() => localStorage.clear());

const mkPlan = (over: any = {}) =>
  finalizeCombatPlan(buildCombatPlan({
    discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 2, daysPerWeek: 3, bodyweight: 80, ...over,
  } as any));

describe('E7.1 — профиль поединка виден в карточке лагеря', () => {
  it('с заданной длительностью показывает доли энергосистем и источник', () => {
    render(<CbCampIntelCard plan={mkPlan()} fightMinutes={5} />);
    expect(screen.getByText(/Профиль поединка/)).toBeTruthy();
    // 5 мин → окислительная 70%
    expect(screen.getByText(/аэробная 70%/)).toBeTruthy();
    expect(screen.getByText(/АТФ-ФК 21%/)).toBeTruthy();
    expect(screen.getByText(/27736247/)).toBeTruthy();
  });

  it('без длительности честно просит внести её, а не выдумывает профиль', () => {
    render(<CbCampIntelCard plan={mkPlan()} />);
    expect(screen.getByText(/Длительность поединка не задана/)).toBeTruthy();
    // и НЕ показывает придуманные проценты
    expect(screen.queryByText(/аэробная \d+%/)).toBeNull();
  });

  it('короткий бой: АТФ-ФК доминирует над аэробной', () => {
    render(<CbCampIntelCard plan={mkPlan()} fightMinutes={2} />);
    expect(screen.getByText(/аэробная 50%/)).toBeTruthy();
    expect(screen.getByText(/АТФ-ФК 40%/)).toBeTruthy();
  });

  it('длиннее исследованного — профиль не «растёт» дальше 5 минут', () => {
    render(<CbCampIntelCard plan={mkPlan()} fightMinutes={10} />);
    expect(screen.getByText(/аэробная 70%/)).toBeTruthy();
  });
});

describe('E7.2 — профиль дисциплины доходит до карточки', () => {
  it('грэпплинг: в приоритете максимальная сила', () => {
    render(<CbCampIntelCard plan={mkPlan({ discipline: 'wrestling' })} fightMinutes={5} />);
    expect(screen.getByText(/Грэпплинг/)).toBeTruthy();
    expect(screen.getByText(/смещена вверх/)).toBeTruthy();
  });

  it('ударка: в приоритете лёгкие быстрые движения', () => {
    render(<CbCampIntelCard plan={mkPlan({ discipline: 'boxing' })} fightMinutes={5} />);
    expect(screen.getByText(/Ударка/)).toBeTruthy();
    expect(screen.getByText(/лёгких быстрых/)).toBeTruthy();
  });
});

describe('E7.3 — сгон показывает проверенный порог и источник', () => {
  it('опасный сgon помечен и ссылается на PMID', () => {
    const wc = buildWeightCutProtocol(7, { startWeightKg: 80 } as any);
    const plan = mkPlan({ weightCutKg: 7, weightCutProtocol: wc });
    render(<CbCampIntelCard plan={plan} />);
    expect(screen.getByText(/Сгон веса/)).toBeTruthy();
    expect(screen.getByText(/40266645/)).toBeTruthy();
  });

  it('умеренный сгон не пугает', () => {
    const wc = buildWeightCutProtocol(3, { startWeightKg: 80 } as any);
    const plan = mkPlan({ weightCutKg: 3, weightCutProtocol: wc });
    render(<CbCampIntelCard plan={plan} />);
    expect(screen.queryByText(/40266645/)).toBeNull();
  });
});

describe('E7.4 — тайминг RPE на экране', () => {
  it('карточка говорит «10 минут», а не «30 минут»', () => {
    render(<CbCampIntelCard plan={mkPlan()} />);
    expect(screen.getByText(/10 мин/)).toBeTruthy();
    expect(screen.queryByText(/30 мин/)).toBeNull();
  });
});
