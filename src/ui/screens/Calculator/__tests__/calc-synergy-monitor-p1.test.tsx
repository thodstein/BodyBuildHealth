/**
 * calc-synergy-monitor-p1.test.tsx — P1-аудит калькулятора поддержки (docs/SUPPORT-CALC-FULL-AUDIT-PLAN.md §7):
 *
 * Д5: синергии — единый источник (SYNERGY_NETWORK): хардкод-строки показываются только для пар,
 *     не покрытых сетью (filterSynergiesCoveredByNetwork + synergyLinePairs).
 * Д6: взаимодействия — один блок с приоритетом checkInteractions (source-lock: SafetyConflicts
 *     вызывается только при пустой drug-DB или при ≤1 веществе в плане).
 * Д7: мониторинг — у всех 4 перечней есть явные подписи «источник».
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutoCalculator } from '../AutoCalculator';
import { synergyLinePairs, filterSynergiesCoveredByNetwork, buildStackSynergyDescription } from '../CalcSubstanceDetail';

beforeEach(() => {
  localStorage.clear();
});

describe('Д5: синергии — единый источник', () => {
  it('synergyLinePairs привязывает хардкод-строки к парам', () => {
    expect(synergyLinePairs('💡 D3 + K2 + Mg — полный кальциевый треугольник: ...')).toEqual([
      ['vitamin_d3', 'vitamin_k2', 'magnesium'],
    ]);
    expect(synergyLinePairs('💡 NAC + TUDCA — двойная гепатопротекция ...')).toEqual([['nac', 'tudca']]);
    const fib = synergyLinePairs('💡 Serra+Natto+Bromelain — 3 независимых пути фибринолиза: ...');
    expect(fib.length).toBe(3);
    // незнакомая строка — без пар (остаётся в выдаче)
    expect(synergyLinePairs('💡 Что-то новое')).toEqual([]);
  });

  it('строки с покрытой сетью парой скрываются, остальные остаются', () => {
    const lines = [
      '💡 NAC + TUDCA — двойная гепатопротекция через разные пути.',
      '💡 NAC + Glycine — два лимитирующих субстрата для GSH.',
      '💡 D3 + K2 — кальциевый гомеостаз.',
    ];
    // Сеть показала NAC+TUDCA → хардкод-строка убрана; NAC+Glycine в сети нет → остаётся
    const out = filterSynergiesCoveredByNetwork(lines, [['nac', 'tudca']]);
    expect(out).toHaveLength(2);
    expect(out.join(' ')).not.toContain('двойная гепатопротекция');
    expect(out.join(' ')).toContain('NAC + Glycine');
    expect(out.join(' ')).toContain('D3 + K2');
  });

  it('пустая сеть — все хардкод-строки как раньше (байт-в-байт поведение)', () => {
    const lines = ['💡 NAC + TUDCA — двойная гепатопротекция.', '💡 Zinc + Boron — синергия тестостерона.'];
    expect(filterSynergiesCoveredByNetwork(lines, [])).toEqual(lines);
  });

  it('buildStackSynergyDescription: NAC+TUDCA даёт строку для пары', () => {
    const rec = { subs: [{ substanceId: 'nac' }, { substanceId: 'tudca' }] } as never;
    const desc = buildStackSynergyDescription(rec);
    expect(desc.some(l => l.includes('NAC + TUDCA'))).toBe(true);
  });
});

describe('Д6: взаимодействия — один блок (source-lock)', () => {
  it('SafetyConflicts используется как fallback, а не отдельным блоком', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/ui/screens/Calculator/Calc.mapper.tsx'), 'utf8');
    // приоритет checkInteractions: пустая drug-DB → fallback
    expect(src).toContain('if (interactions.length === 0) return <SafetyConflicts');
    // отдельный вызов только для планов ≤1 вещества (где IIFE выше не выполняется)
    expect(src).toContain('{finalRec.subs.length <= 1 && <SafetyConflicts');
    // старого безусловного вызова в блоке больше нет
    expect(src).not.toContain('<SafetyConflicts rec={finalRecWithResidual ?? finalRec} planResult={planResult} />\n            </div>');
  });
});

describe('Д7: подписи источников мониторинга', () => {
  it('раскрытый мониторинг содержит 4 подписи-источника', async () => {
    localStorage.setItem(
      'he_autocalc_state',
      JSON.stringify({ labs: { fullPanel: { date: '2026-09-01', panelBiochem: { ALT: '60' } } } }),
    );
    render(
      React.createElement(AutoCalculator, {
        embedded: true,
        courseWeek: 4,
        courseLinked: [{ id: '1', substanceId: 'test_enan', doseValue: 250, doseUnit: 'mg', frequency: 1, startWeek: 1, endWeek: 12 }],
        onApply: () => {},
      } as any),
    );
    const header = await screen.findByText(/Мониторинг анализов и показателей/, {}, { timeout: 8000 });
    fireEvent.click(header);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/график фазы курса \(клинический протокол\)/).length).toBeGreaterThan(0);
      },
      { timeout: 8000 },
    );
    expect(screen.queryAllByText(/единый перечень K0–K10/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/приоритетный источник: привязка к веществам плана/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/свод по системам \(включает маркеры выше/).length).toBeGreaterThan(0);
  });
});
