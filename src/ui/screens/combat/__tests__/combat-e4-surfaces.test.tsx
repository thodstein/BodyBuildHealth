/**
 * combat-e4-surfaces.test.ts — локи E4 «поверхности движка».
 *
 * Проверяем, что функции, которые движок считал вхолостую, реально доходят до
 * экрана — поведением на настоящем плане, а не чтением исходника.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CbCampIntelCard } from '../cb-camp-intel';
import { buildCombatPlan } from '../../../../engines/combat/combat-builder.engine';
import { finalizeCombatPlan } from '../../../../engines/combat/combat-finalize.engine';
import { buildWeightCutProtocol, weightCutSafetyBanner } from '../../../../engines/combat/combat-weight-cut.engine';
import { coreVolumeCheck } from '../../../../engines/combat/combat-core.engine';
import { vbtRecommendationCombat } from '../../../../engines/combat/combat-vbt.engine';
import { getNeckMeta, ufcNeckMatrixCategory, NECK_IDS } from '../../../../engines/combat/combat-neck.engine';
import { vbtVelocityForPct } from '../../../../engines/combat/combat-monitoring.engine';

beforeEach(() => localStorage.clear());

const mkPlan = (over: any = {}) =>
  finalizeCombatPlan(buildCombatPlan({
    discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 2, daysPerWeek: 3, bodyweight: 80, ...over,
  } as any));

describe('E4.1 — карточка рендерится на реальном плане', () => {
  it('показывает оси кора и заголовок разведки', () => {
    const plan = mkPlan();
    render(<CbCampIntelCard plan={plan} />);
    expect(screen.getByText(/Разведка лагеря/)).toBeTruthy();
    expect(screen.getByText(/Кор по осям/)).toBeTruthy();
  });

  it('строка кора совпадает с прямым вызовом движка', () => {
    const plan = mkPlan();
    const ids = plan.weeksData.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => e.id)));
    const core = coreVolumeCheck(ids as string[]);
    render(<CbCampIntelCard plan={plan} />);
    expect(screen.getByText(new RegExp(`антиэкс-тензия ${core.antiExt}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`ротационная мощь ${core.rotPower}`))).toBeTruthy();
  });
});

describe('E4.2 — сгон веса: баннер движка на экране', () => {
  it('экстремальный сгон показывает баннер безопасности ИЗ ДВИЖКА', () => {
    // 8 кг при 80 кг = 10% BM — ISSN прямо запрещает
    const protocol = buildWeightCutProtocol(8, { startWeightKg: 80, weighInType: 'same_day_2h' } as any);
    const plan = mkPlan({ goal: 'weight_cut', weightCutKg: 8, weightCutProtocol: protocol, weightCut: 8 });
    render(<CbCampIntelCard plan={plan} />);
    expect(screen.getByText(/Сгон веса/)).toBeTruthy();
    // баннер существует у движка и совпадает с тем, что на экране
    const banner = weightCutSafetyBanner(protocol, 80, 'male');
    expect(banner).toBeTruthy();
    expect(screen.getByText(new RegExp(banner!.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeTruthy();
  });

  it('умеренный сгон не пугает пользователя', () => {
    const protocol = buildWeightCutProtocol(1, { startWeightKg: 80, weighInType: 'day_before_24h' } as any);
    expect(weightCutSafetyBanner(protocol, 80, 'male')).toBeNull();
  });
});

describe('E4.3 — VBT-рекомендация из движка', () => {
  it('потеря скорости >30% даёт стоп-тон и точный текст движка', () => {
    const plan = mkPlan();
    render(<CbCampIntelCard plan={plan} velocityLoss={35} />);
    const rec = vbtRecommendationCombat(35);
    expect(rec.action).toBeTruthy();
    expect(screen.getByText(new RegExp(`35% · ${rec.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).toBeTruthy();
    expect(screen.getByText(/стоп/)).toBeTruthy();
  });

  it('потеря <=20% не стращает', () => {
    render(<CbCampIntelCard plan={mkPlan()} velocityLoss={10} />);
    expect(screen.getByText(/норма/)).toBeTruthy();
    expect(screen.queryByText(/стоп/)).toBeNull();
  });

  it('без данных о VBT строки нет', () => {
    render(<CbCampIntelCard plan={mkPlan()} />);
    expect(screen.queryByText(/Потеря скорости/)).toBeNull();
  });
});

describe('E4.4 — шейная матрица UFC', () => {
  it('категория упражнения шеи берётся из движка, а не выдумана', () => {
    const id = NECK_IDS[0];
    expect(getNeckMeta(id)).toBeTruthy();
    expect(ufcNeckMatrixCategory(id)).toMatch(/UFC:/);
  });
});

describe('E4.5 — кондиционирование: стоимость бюджета', () => {
  it('бюджет кондиционирования показан, когда план несёт conditioning', () => {
    const plan = { ...mkPlan(), conditioning: { weeks: 2, sessions: [[{ id: 'c1', modality: 'alactic', durationMin: 90, description: 'x', exercises: [] }], []] } } as any;
    render(<CbCampIntelCard plan={plan} />);
    expect(screen.getByText(/Бюджет кондиционирования/)).toBeTruthy();
    // 90 мин × 0.08 = 7.2 → 7% бюджета
    expect(screen.getByText(/съедает 7% бюджета/)).toBeTruthy();
  });

  it('аэробная поддержка подсвечивается при ≥5 внешних сессий', () => {
    const plan = { ...mkPlan(), conditioning: { weeks: 2, sessions: [[{ id: 'c1', modality: 'alactic', durationMin: 30, description: 'x', exercises: [] }], []] } } as any;
    render(<CbCampIntelCard plan={plan} outsideSessions={6} />);
    expect(screen.getByText(/нужна аэробная поддержка/)).toBeTruthy();
  });
});

describe('E4.6 — нагрузка/HRV', () => {
  it('ACWR попадает в строку нагрузки', () => {
    render(<CbCampIntelCard plan={mkPlan()} acwr={{ ratio: 1.4, zone: 'caution' } as any} />);
    expect(screen.getByText(/Нагрузка и восстановление/)).toBeTruthy();
    expect(screen.getByText(/ACWR 1.4/)).toBeTruthy();
  });
});

describe('E4.7 — VBT-лестница скорости', () => {
  it('лестница %ПМ → м/с считается движком и видна на экране', () => {
    render(<CbCampIntelCard plan={mkPlan()} />);
    expect(screen.getByText(/Ориентир скорости по %ПМ/)).toBeTruthy();
    // 95% и 60% обязаны быть в лестнице движка
    expect(screen.getByText(new RegExp(`95% ≈ ${(vbtVelocityForPct(95)!.velocity).toFixed(2)}`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`60% ≈ ${(vbtVelocityForPct(60)!.velocity).toFixed(2)}`))).toBeTruthy();
  });
});
