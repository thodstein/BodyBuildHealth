/**
 * strongman-audit-2026-10-ui.test.tsx — аудит UI-слоя планировщика ТА/стронга.
 * Продолжение strongman-audit-2026-10.test.ts (движки).
 *
 * Каждый дефект = тест. UI-компоненты тяжёлые (полный провайдер профиля) —
 * где это граница, проверяется source-guard + поведение движков, оно честнее
 * рендера, чем «зелёный тест на косынке».
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { TAPER_CESSATION_DAYS, cessationDaysFor, taperLengthDaysFor } from '../strength-sport-taper.engine';
import { SM_STRATEGY_PCT } from '../strength-sport-strongman-attempts.engine';

const read = (p: string) => readFileSync(p, 'utf8');
const SRC = 'src/ui/screens/strength-sport/';
const PLAN_VIEW = SRC + 'StrengthSportPlanView.tsx';
const WIZARD = SRC + 'useStrengthSportWizard.ts';

describe('P1: cessation в UI = cessation в плане (sex-adjusted)', () => {
  it('в PlanView показывается cessationDaysFor(id, sex), а не сырая таблица', () => {
    const src = read(PLAN_VIEW);
    // сырой доступ к TAPER_CESSATION_DAYS для показа cessation запрещён
    expect(src).not.toMatch(/cess \$\{\s*\(?TAPER_CESSATION_DAYS/);
    expect(src).not.toContain('cess ${(TAPER_CESSATION_DAYS');
    // «кат. <вес>» врало (подпись категории, значение веса) — заменено на «вес»
    expect(src).not.toContain('кат. ');
    // импорт есть
    expect(src).toContain('cessationDaysFor');
  });

  it('числа расходятся: raw 7 vs male 8 — доказывает, что сырой показ врал', () => {
    expect(TAPER_CESSATION_DAYS.yoke_walk).toBe(7);
    expect(cessationDaysFor('yoke_walk', 'male')).toBe(8);
    expect(cessationDaysFor('yoke_walk', 'female')).toBe(7);
    expect(cessationDaysFor('log_press', 'male')).toBe(6);
    expect(TAPER_CESSATION_DAYS.log_press).toBe(5);
  });
});

describe('P1: стратегия попыток в UI = таблице движка', () => {
  it('PlanView берёт проценты из SM_STRATEGY_PCT, а не хардкодом', () => {
    const src = read(PLAN_VIEW);
    expect(src).toContain('SM_STRATEGY_PCT');
    // жёсткая строка «85/92/98 vs 90/97/102» удалена: она врала для balanced
    expect(src).not.toContain('85/92/98 vs 90/97/102');
  });

  it('фактические проценты стратегий (баланс ≠ консерва)', () => {
    expect(SM_STRATEGY_PCT.balanced).toEqual({ opener: 0.88, second: 0.95, third: 1.0 });
    expect(SM_STRATEGY_PCT.conservative).toEqual({ opener: 0.85, second: 0.92, third: 0.98 });
    expect(SM_STRATEGY_PCT.aggressive).toEqual({ opener: 0.9, second: 0.97, third: 1.02 });
  });
});

describe('P1: длина тейпера в UI — по режиму/полу, не хардкод', () => {
  it('PlanView зовёт taperLengthDaysFor(mode, sex)', () => {
    const src = read(PLAN_VIEW);
    expect(src).toContain('taperLengthDaysFor(plan.mode, sex)');
    // хардкод «taper Winwood 8.6д» удалён: для ТА он 8.0±4.4, для Ж — другое
    expect(src).not.toContain('taper Winwood 8.6д');
  });

  it('длины по режиму/полу (measured Winwood)', () => {
    expect(taperLengthDaysFor('strongman', 'male')).toBe(8);
    expect(taperLengthDaysFor('strongman', 'female')).toBe(10);
    expect(taperLengthDaysFor('weightlifting', 'male')).toBe(8);
    expect(taperLengthDaysFor('weightlifting', 'female')).toBe(5);
  });
});

describe('P2: гигиена UI', () => {
  it('нет no-op `void buildStrengthCsv;` (мёртвый оператор)', () => {
    expect(read(PLAN_VIEW)).not.toContain('void buildStrengthCsv;');
  });

  it('нет бессмысленного слова «Stark» в подписи годового плана', () => {
    expect(read(PLAN_VIEW)).not.toContain('Stark');
  });

  it('Multi-peak: GPP/переход — живые инпуты, не readOnly-заглушки', () => {
    const src = read(PLAN_VIEW);
    expect(src).toContain('setSeasonGppWeeks');
    expect(src).toContain('setSeasonTransWeeks');
    // readOnly у этих двух полей больше нет
    const block = src.slice(src.indexOf('Сезон — Multi-peak'), src.indexOf('Сезон — Multi-peak') + 2000);
    expect(block).not.toContain('readOnly');
  });

  it('Multi-peak:InfoBanner не выдумывает «+8w» и «peak2 6w»', () => {
    const src = read(PLAN_VIEW);
    expect(src).not.toContain('annual.totalWeeks+8');
  });
});

describe('P1: wizard — персист согласия и хронология ACWR', () => {
  it('cycleConsent переживает перезагрузку (раньше утекал)', () => {
    const src = read(WIZARD);
    expect(src).toContain('he_ss_cycle_consent_v1');
    // useState(false) без чтения стора — дефект «согласие теряется»
    expect(src).not.toMatch(/\[cycleConsent, setCycleConsent\] = useState<boolean>\(false\)/);
  });

  it('пустой cycleId удаляет ключ, а не пишет пустую строку', () => {
    const src = read(WIZARD);
    // голый setItem без условия писал бы '' в стор (мусорный ключ навсегда)
    expect(src).not.toMatch(/try\s*\{\s*localStorage\.setItem\('he_ss_cycle_v1', cycleId\)/);
    expect(src).toMatch(/if \(cycleId\) localStorage\.setItem\('he_ss_cycle_v1', cycleId\); else localStorage\.removeItem/);
  });

  it('окно ACWR сортируется по дате (не по порядку вставки)', () => {
    const src = read(WIZARD);
    // Object.values(daily).slice без сортировки — дефект
    expect(src).not.toContain('Object.values(daily).slice(-28)');
    expect(src).toContain('Object.keys(daily).sort()');
  });
});

describe('P1: handleBuildSeason честен при отказе', () => {
  it('нет пустого catch — отказ виден пользователю', () => {
    const src = read(SRC + 'StrengthSportConstructor.tsx');
    // блок именно handleBuildSeason (до следующего handler'а), иначе цепляем чужой catch
    const start = src.indexOf('const handleBuildSeason');
    const end = src.indexOf('const handleBuildAnnualFromCycles');
    const block = src.slice(start, end > start ? end : start + 1400);
    // catch с пустым телом (молчаливый отказ) — проверяем ВНЕШНИЙ try,
    // вложенный `try { console.warn } catch {}` — законный guard для консоли
    const outerCatch = block.replace(/try \{ console\.warn\([^)]*\)[^;]*; \} catch \{\}/g, '');
    expect(outerCatch).not.toContain('catch {}');
    expect(outerCatch).toContain('setMsg(`⛔ Сезон не собран');
    // gpp/transition из состояния, не хардкод 4/2
    expect(block).toContain('gppWeeks: seasonGppWeeks');
    expect(block).toContain('transitionWeeks: seasonTransWeeks');
    // plan! убран: без плана сборка падала молча
    expect(block).not.toContain('[plan!, p2]');
    expect(block).toContain("if (!plan)");
  });
});
