/**
 * combat-e8-wiring.test.ts — source-guard проводки входов скринингов.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ. Оба блока 8.4/8.8 были мертвы в приложении: карточка
 * считала LEA и тепловой протокол по null, потому что CombatPlanView передавал
 * только plan и sleepHours. При этом ВСЕ тесты 8.4/8.8 были зелёные — они
 * сами передавали пропсы напрямую в карточку. То есть покрытие проверяло
 * движок, но не проводку, и регресс прошёл бы молча.
 *
 * Этот guard проверяет именно проводку: план-вью обязан брать калории из
 * канона combatToNutritionPayload и Безжировую массу из профиля.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

describe('E8.W — проводка входов LEA/тепла из план-вью', () => {
  const view = read('src/ui/screens/combat/CombatPlanView.tsx');

  it('план-вью вообще читает профиль (иначе FFM всегда null)', () => {
    expect(view).toMatch(/useProfileSection\('personal'\)/);
  });

  it('Безжировая масса считается каноном ffmFromProfile, а не формулой в UI', () => {
    expect(view).toMatch(/ffmFromProfile\(/);
    // и это именно из полей профиля
    expect(view).toMatch(/personal\?\.weight/);
    expect(view).toMatch(/personal\?\.bodyFat/);
  });

  it('калории берутся из проектного канона combatToNutritionPayload', () => {
    expect(view).toMatch(/combatToNutritionPayload\(/);
    // и результат реально идёт в карточку
    expect(view).toMatch(/kcal=\{autoKcal\}/);
  });

  it('в карточку передаются и калории, и Безжировая масса', () => {
    expect(view).toMatch(/kcal=\{autoKcal\}/);
    expect(view).toMatch(/ffmKg=\{autoFfm\}/);
  });

  it('источник калорий не дублируется: только канон, никаких своих констант', () => {
    // если появится Math.round(... kcal) в UI — это будет вторая правда
    expect(view).not.toMatch(/kcal\s*[:=]\s*Math\.(round|floor)\([^)]*\d{3,}/);
  });

  it('план-вью НЕ выдумывает тренировочный расход и признаки CAT2', () => {
    // они по определению субъективны: выводить их — значит выдумать коэффициент
    expect(view).not.toMatch(/trainingKcal=\{/);
    expect(view).not.toMatch(/cat2Flags=\{/);
    expect(view).not.toMatch(/heatSessions=\{/);
  });

  it('аварийный путь есть: движок не должен ронять рендер плана', () => {
    expect(view).toMatch(/try \{ return combatToNutritionPayload\(plan\)\.kcal \?\? null; \} catch \{ return null; \}/);
  });
});

describe('E8.W — в движке нет запасных значений вместо данных', () => {
  const engine = read('src/engines/combat/combat-measurements.engine.ts');
  const block = engine.slice(engine.indexOf('ffmFromProfile'), engine.indexOf('8.4 Скрининг'));

  it('ffmFromProfile возвращает null, а не дефолт, когда %жира нет', () => {
    expect(block).toMatch(/bodyFatPct < 3 \|\| bodyFatPct > 70\) return null/);
  });

  it('в блоке входов нет подстановки нуля или «типичных» констант', () => {
    expect(block).not.toMatch(/ffmKg:\s*0\b/);
    expect(block).not.toMatch(/ffmKg:\s*6[05]\b/);
    expect(block).not.toMatch(/trainingKcal:\s*0[,}]/);
  });
});
