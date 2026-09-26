/**
 * combat-e2-dead-code.test.ts — гигиена мёртвых файлов единоборств (E2).
 *
 * Пункт E2 плана: `combat-day-types.ts` — либо подключить в финализатор, либо
 * удалить. Решение — удаление, и вот почему:
 *
 *   • 0 потребителей: ни движок, ни UI, ни один тест не импортировали файл;
 *   • 0 тестов: содержимое никогда не проверялось;
 *   • данные продублированы: `POOL_BY_TAG` в `combat-builder.engine.ts` —
 *     та же карта «сессия → что делаем», но на уровне упражнений и заметно
 *     богаче (конкретные id вместо названий мышц);
 *   • `combatNeedsLightLegs` указывал на правило, которое так и не было
 *     реализовано: лёгкие ноги на сгоне/в лагере в билдере не появились.
 *
 * Тест фиксирует решение: если файл вернут — он снова станет дублем, и это
 * надо будет осознанно перерешать, а не получать молча.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src/engines/combat');
const DEAD = join(SRC, 'combat-day-types.ts');

describe('E2.1 — мёртвый файл единоборств удалён', () => {
  it('combat-day-types.ts не существует', () => {
    expect(existsSync(DEAD)).toBe(false);
  });

  it('его символы не остались в других движках', () => {
    const files = ['combat-builder.engine.ts', 'combat-finalize.engine.ts', 'combat-selection.ts', 'combat-groups.ts'];
    for (const f of files) {
      const src = readFileSync(join(SRC, f), 'utf8');
      expect(src, f).not.toMatch(/COMBAT_TAG_MUSCLES|COMBAT_SESSION_FOCUS|COMBAT_MANDATORY_MUSCLES|combatNeedsLightLegs|combatTagMuscles/);
    }
  });
});

describe('E2.2 — канон приоритетов сессии жив в билдере', () => {
  it('POOL_BY_TAG остаётся единственным источником «что делаем в сессии»', () => {
    const src = readFileSync(join(SRC, 'combat-builder.engine.ts'), 'utf8');
    expect(src).toMatch(/const POOL_BY_TAG: Record<string, string\[\]>/);
    // все пять боевых типов сессий на месте
    for (const tag of ['upper_power', 'lower_power', 'full_power', 'full_conditioning', 'neck_grip']) {
      expect(src, tag).toMatch(new RegExp(`\\b${tag}:`));
    }
  });

  it('в пулах сессий есть шея и хват — приоритет единоборств не потерян', () => {
    const src = readFileSync(join(SRC, 'combat-builder.engine.ts'), 'utf8');
    const pools = src.slice(src.indexOf('const POOL_BY_TAG'), src.indexOf('function clampWeeks'));
    expect(pools).toMatch(/neck_/);
    expect(pools).toMatch(/grip|gi_grip|wrist_/);
  });
});
