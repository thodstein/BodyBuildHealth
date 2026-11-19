/**
 * risk-history-day.test.ts — проход 159: точка истории риска — календарный день
 * человека, и одна точка на день.
 *
 * Контекст. `RiskScreen` писал день как `toISOString().split('T')[0]` (UTC).
 * В UTC+3…+12 утром UTC-дата ещё вчерашняя, поэтому проверка «день уже записан?»
 * видела вчерашнюю точку и новый день не записывала вовсе — «Динамика» теряла
 * день до вечернего открытия экрана. Плюс первый снимок дня выигрывал навсегда:
 * удаление анализа или закрытие курса не меняло дневную точку.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadRiskHistory, saveRiskHistory, riskHistoryDate,
  RISK_HISTORY_KEY, MAX_RISK_HISTORY,
} from '../screens/RiskScreen_parts/risk-history';

beforeEach(() => localStorage.clear());

describe('проход 159: дата точки — местный календарь', () => {
  it('поздний вечер — сегодняшняя дата, а не UTC-срез', () => {
    const вечер = new Date(2026, 0, 2, 23, 30);
    expect(riskHistoryDate(вечер)).toBe('2026-01-02');
    // Не сравниваем с UTC (в UTC смещение 0 — тест был бы вакуумным); важно,
    // что день берётся из местных геттеров.
    expect(riskHistoryDate(new Date(2026, 0, 2, 0, 5))).toBe('2026-01-02');
  });
});

describe('проход 159: одна точка на день', () => {
  it('второй расчёт того же дня заменяет первый', () => {
    saveRiskHistory({ date: '2026-08-15', overallRaw: 40, overallNet: 32 });
    saveRiskHistory({ date: '2026-08-15', overallRaw: 55, overallNet: 44 });
    const hist = loadRiskHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0]).toMatchObject({ date: '2026-08-15', overallRaw: 55, overallNet: 44 });
  });

  it('разные дни идут по дате, хвост ограничен', () => {
    for (let i = 1; i <= MAX_RISK_HISTORY + 3; i++) {
      saveRiskHistory({ date: `2026-01-${String(i).padStart(2, '0')}`, overallRaw: i, overallNet: i });
    }
    const hist = loadRiskHistory();
    expect(hist).toHaveLength(MAX_RISK_HISTORY);
    expect(hist[0].date).toBe('2026-01-04');
    expect(hist[hist.length - 1].date).toBe('2026-01-15');
  });
});

describe('проход 159: повреждённая история не превращается в точку «0 %»', () => {
  it('не-массив и неполные записи не читаются', () => {
    localStorage.setItem(RISK_HISTORY_KEY, '{не json');
    expect(loadRiskHistory()).toEqual([]);
    localStorage.setItem(RISK_HISTORY_KEY, JSON.stringify({ date: '2026-01-01' }));
    expect(loadRiskHistory()).toEqual([]);
    localStorage.setItem(RISK_HISTORY_KEY, JSON.stringify([
      { date: '2026-01-01', overallRaw: 10, overallNet: 8 },
      { date: '2026-01-02', overallRaw: null, overallNet: 8 },
      { date: 'не дата', overallRaw: 10, overallNet: 8 },
    ]));
    expect(loadRiskHistory()).toEqual([{ date: '2026-01-01', overallRaw: 10, overallNet: 8 }]);
  });
});

describe('проход 159: экран не держит своего правила даты', () => {
  it('RiskScreen пишет день через riskHistoryDate', () => {
    const src = readFileSync(join(process.cwd(), 'src/ui/screens/RiskScreen.tsx'), 'utf8');
    const код = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(код).toContain('const today = riskHistoryDate();');
    expect(код).not.toMatch(/\.toISOString\(\)\s*\.split\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\]/);
  });
});
