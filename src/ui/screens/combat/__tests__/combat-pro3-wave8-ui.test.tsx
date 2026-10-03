/**
 * combat-pro3-wave8-ui.test.tsx — поверхности остатка PRO-3:
 * Э5.2 (кнопки сборки/печати/загрузки блоков года), Э5.7-LEA (авто-расход
 * из кардио-дневника на экране) и проводка женской фазы в конструкторе.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { AnnualCard } from '../combat-annual-card';
import { CbCampMeasurementsCard } from '../cb-camp-measurements';
import { buildCombatPlan } from '../../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan } from '../../../../engines/combat/combat-finalize.engine';
import { buildAnnualATR, buildAnnualPlans } from '../../../../engines/combat/combat-annual';
import { saveCardioLogEntry } from '../../../../engines/lms/cardio-diary.engine';
import { localIsoDate } from '../../../../core/local-date';

beforeEach(() => localStorage.clear());

const mkPlan = (over: any = {}) =>
  finalizeCombatPlan(buildCombatPlan({
    discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 2, daysPerWeek: 3, bodyweight: 80, ...over,
  } as any));

const builtAnnual = () => {
  const ann = buildAnnualATR('mma', 12, '2026-01-05', { cycles: 1 });
  return buildAnnualPlans(ann, { level: 'intermediate', daysPerWeek: 3, startDate: '2026-01-05' });
};

describe('Э5.2 UI — планы блоков на карточке года', () => {
  it('собранные блоки: строка плана, кнопки печати/загрузки зовут обработчики', () => {
    const annual = builtAnnual();
    const onPrint = vi.fn();
    const onLoad = vi.fn();
    const onBuild = vi.fn();
    render(<AnnualCard annual={annual} onBuildATR={() => {}} onBuildPlans={onBuild} onPrintBlock={onPrint} onLoadBlock={onLoad} />);
    expect(document.querySelector('[data-cb="annual-block-plans"]')).toBeTruthy();
    expect(document.querySelector('[data-cb="annual-block-plan"]')).toBeTruthy();
    fireEvent.click(screen.getByText('📦 Собрать планы блоков'));
    expect(onBuild).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByLabelText(/Печать блока/)[0]);
    expect(onPrint).toHaveBeenCalledWith(expect.objectContaining({ plan: expect.anything() }));
    fireEvent.click(screen.getAllByLabelText(/в конструкторе/)[0]);
    expect(onLoad).toHaveBeenCalledWith(expect.objectContaining({ plan: expect.anything() }));
  });

  it('без обработчиков кнопки блоков не мёртвые (их просто нет), но планы видны', () => {
    const annual = builtAnnual();
    render(<AnnualCard annual={annual} onBuildATR={() => {}} />);
    expect(document.querySelector('[data-cb="annual-block-plans"]')).toBeTruthy();
    expect(document.querySelector('[data-cb="annual-block-print"]')).toBeNull();
    expect(document.querySelector('[data-cb="annual-block-load"]')).toBeNull();
    expect(screen.queryByText('📦 Собрать планы блоков')).toBeNull();
  });

  it('без собранных планов секции нет (не пустая витрина)', () => {
    const annual = buildAnnualATR('mma', 12, null, { cycles: 1 });
    render(<AnnualCard annual={annual} onBuildATR={() => {}} onBuildPlans={() => {}} />);
    expect(document.querySelector('[data-cb="annual-block-plans"]')).toBeNull();
  });
});

describe('Э5.7 UI — тренировочный расход из дневника', () => {
  it('кардио-запись сегодня: LEA-поле помечено «из дневника» + честная строка', () => {
    saveCardioLogEntry({ id: 'c1', date: localIsoDate(), type: 'zone2', durationMin: 45, completed: true } as any);
    const { container } = render(<CbCampMeasurementsCard plan={mkPlan()} kcal={3000} ffmKg={70} />);
    expect(container.innerHTML).toMatch(/Трен\. расход, ккал · из дневника = /);
    expect(container.querySelector('[data-cb="lea-diary-note"]')).toBeTruthy();
    expect(container.innerHTML).toMatch(/кардио-часть/);
    // LEA оживает без ручного ввода расхода
    expect(container.innerHTML).not.toMatch(/Не хватает данных/);
  });

  it('ручной ввод расхода перекрывает авто из дневника', () => {
    saveCardioLogEntry({ id: 'c1', date: localIsoDate(), type: 'zone2', durationMin: 45, completed: true } as any);
    const { container } = render(<CbCampMeasurementsCard plan={mkPlan()} kcal={3000} ffmKg={70} />);
    fireEvent.change(container.querySelector('[data-cb="lea-in-trainingKcal"]') as HTMLElement, { target: { value: '700' } });
    expect(container.innerHTML).toMatch(/Трен\. расход, ккал · вручную = 700/);
  });

  it('пустой дневник — по-прежнему «нет данных» (не выдуманный ноль)', () => {
    const { container } = render(<CbCampMeasurementsCard plan={mkPlan()} kcal={3000} ffmKg={70} />);
    expect(container.innerHTML).toMatch(/Трен\. расход, ккал · нет данных/);
    expect(container.querySelector('[data-cb="lea-diary-note"]')).toBeNull();
  });
});

describe('wave8 — проводка конструктора (source-guard)', () => {
  const src = readFileSync('src/ui/screens/combat/CombatConstructor.tsx', 'utf8');

  it('конструктор читает фазу из he_cycle_log и передаёт её в план', () => {
    expect(src).toMatch(/autoCombatCyclePhase\(/);
    expect(src).toMatch(/cyclePhase:\s*cyclePhase\s*\|\|\s*undefined/);
  });

  it('кнопка сборки блоков года подключена к buildAnnualPlans', () => {
    expect(src).toMatch(/buildAnnualPlans\(annual/);
    expect(src).toMatch(/onBuildPlans=\{handleBuildAnnualPlans\}/);
    expect(src).toMatch(/onPrintBlock=\{handlePrintAnnualBlock\}/);
    expect(src).toMatch(/onLoadBlock=\{handleLoadAnnualBlock\}/);
  });
});
