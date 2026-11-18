/**
 * Аудит 2026-11, P3-7: строки валидации в rationale.
 *
 * Было: строки брались «первыми 20 в порядке выдачи валидатора» (`slice(0, 20)`
 * в четырёх местах). В плане с 52 предупреждениями (bro_5/mass) реальный дефицит
 * объёма до MEV в текст не попадал вовсе, хотя он важнее остальных замечаний, и
 * пользователь не видел ни дефицита, ни того, что что-то скрыто.
 *
 * Стало: `validationRationaleLines` — приоритет важности (дефицит → перегруз MRV →
 * потолки сессии → частота → прочее), предел 20 строк и честная строка
 * «…и ещё N предупреждений — полный список в панели валидации».
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import {
  ERROR_LINE_PREFIX,
  VALIDATION_LINE_PREFIX,
  orderValidationIssues,
  refreshBBPlanSnapshots,
  validationRationaleLines,
} from '../bb-plan-snapshot.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const warn = (code: string, message: string) => ({ level: 'warning' as const, code, message });
const err = (code: string, message: string) => ({ level: 'error' as const, code, message });

/** 25 предупреждений, дефицит объёма — ПОСЛЕДНИМ (как в реальном плане bro_5/mass). */
const manyWarnings = [
  ...Array.from({ length: 24 }, (_, i) => warn('session_duration', `Сессия ${i + 1}: расчётная длительность сессии около 95 мин.`)),
  warn('target_volume_deficit', 'Грудь: эффективных сетов 7.5 ниже минимума MEV 10 (75%); проверьте feeder/session cap.'),
];

describe('P3-7: строки валидации в rationale', () => {
  it('дефицит объёма стоит первым, даже если валидатор выдал его последним', () => {
    const ordered = orderValidationIssues(manyWarnings);
    expect(ordered[0].code).toBe('target_volume_deficit');
    // Внутри группы исходный порядок сохраняется (стабильная сортировка).
    expect(ordered[1].message).toBe(manyWarnings[0].message);
  });

  it('приоритет: дефицит → перегруз MRV → потолки сессии → частота → прочее', () => {
    const ordered = orderValidationIssues([
      warn('session_duration', 'прочее'),
      warn('low_training_frequency', 'частота'),
      warn('session_working_set_cap', 'потолок'),
      warn('effective_mrv_overflow', 'перегруз'),
      warn('target_volume_deficit', 'дефицит'),
    ]);
    expect(ordered.map((i: any) => i.code)).toEqual([
      'target_volume_deficit',
      'effective_mrv_overflow',
      'session_working_set_cap',
      'low_training_frequency',
      'session_duration',
    ]);
  });

  it('скрытое честно суммируется: 20 строк + «ещё 5»', () => {
    const lines = validationRationaleLines(manyWarnings, VALIDATION_LINE_PREFIX, { level: 'warning' });
    expect(lines).toHaveLength(21);
    expect(lines[0]).toBe(`${VALIDATION_LINE_PREFIX} ${manyWarnings[manyWarnings.length - 1].message}`);
    expect(lines[20]).toBe(`${VALIDATION_LINE_PREFIX} …и ещё 5 предупреждений — полный список в панели валидации.`);
  });

  it('когда всё влезает — никакой строки «ещё N»', () => {
    const lines = validationRationaleLines(manyWarnings.slice(0, 20), VALIDATION_LINE_PREFIX, { level: 'warning' });
    expect(lines).toHaveLength(20);
    expect(lines.join('\n')).not.toContain('…и ещё');
  });

  it('ошибки и предупреждения разделены и суммируются своими словами', () => {
    const issues = [...manyWarnings, ...Array.from({ length: 22 }, (_, i) => err('sets_mismatch', `Сет ${i}: sets=4, workSets=3.`))];
    const warns = validationRationaleLines(issues, VALIDATION_LINE_PREFIX, { level: 'warning' });
    const errs = validationRationaleLines(issues, ERROR_LINE_PREFIX, { level: 'error' });
    expect(warns).toHaveLength(21);
    expect(warns[20]).toContain('ещё 5 предупреждений');
    expect(errs).toHaveLength(21);
    expect(errs[0]).toContain('Сет 0');
    expect(errs[20]).toBe(`${ERROR_LINE_PREFIX} …и ещё 2 ошибки — полный список в панели валидации.`);
  });

  it('снимок плана: дефицит и «ещё N» попадают в rationale итогового плана', () => {
    const plan: any = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 1, workMax: WM });
    plan.validation = { valid: true, issues: manyWarnings };
    refreshBBPlanSnapshots(plan, { refreshValidationRationale: true });
    const lines = (plan.rationale as string[]).filter((line) => String(line).startsWith(VALIDATION_LINE_PREFIX));
    expect(lines).toHaveLength(21);
    expect(lines[0]).toContain('эффективных сетов 7.5 ниже минимума MEV 10');
    expect(lines[20]).toContain('…и ещё 5 предупреждений');
    // Фантомных строк от прежней валидации не осталось.
    expect(lines.filter((line) => line.includes('…и ещё')).length).toBe(1);
  });

  it('снимок плана: без синтетических issues строки соответствуют факту валидации', () => {
    const plan: any = buildBBPlan({ patternId: 'fullbody_3', level: 'advanced', goal: 'mass', weeks: 1, workMax: WM });
    refreshBBPlanSnapshots(plan, { refreshValidationRationale: true });
    const lines = (plan.rationale as string[]).filter((line) => String(line).startsWith(VALIDATION_LINE_PREFIX));
    const warnings = (plan.validation.issues || []).filter((issue: any) => issue.level === 'warning');
    // Каждая строка (кроме итоговой) — это чьё-то предупреждение, и все они идут по важности.
    const shown = lines.filter((line) => !line.includes('…и ещё'));
    for (const line of shown) {
      expect(warnings.some((issue: any) => line === `${VALIDATION_LINE_PREFIX} ${issue.message}`), line).toBe(true);
    }
    expect(shown.length).toBe(Math.min(20, warnings.length));
  });
});
