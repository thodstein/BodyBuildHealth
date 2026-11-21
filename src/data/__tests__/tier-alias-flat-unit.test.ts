/**
 * tier-alias-flat-unit.test.ts — проход 190: шкала и число в одной единице.
 *
 * `TIER_SAME_ANALYSIS` отдаёт второму написанию строку канонического анализа
 * вместе с её единицей. Это верно только тогда, когда анализ приходит в плоский
 * мир (риск-модель, ступени) в той же единице: пересчёт делает одно правило —
 * `flatLabUnit` (`readFlatLabs`, `labSliceToValues`, проход 182).
 *
 * Прогестерон — единственный анализ, где два написания живут в разных единицах:
 * `PROGESTERONE` в каталоге — нмоль/л, `PROG` — нг/мл, а шкала у них одна
 * (нг/мл). Без пересчёта нормальные 1.5 нмоль/л (0.47 нг/мл) читались бы как
 * «погранично» (1.5 нг/мл), а 3 нмоль/л — как «лечение». Гард держит это
 * равенство, чтобы следующее второе написание не попало в чужую единицу.
 *
 * Проверяются пары, у которых оба кода есть в каталоге: только там единица —
 * данные, а не догадка. Остальные вторые написания (`TOTAL_T`, `T3_FREE`, …)
 * в каталоге отсутствуют и приходят из формы уже в единице шкалы.
 */
import { describe, it, expect } from 'vitest';
import { LAB_TIERS, TIER_SAME_ANALYSIS } from '../lab-tier-ranges';
import { ucumInfo } from '../../core/constants';
import { flatLabUnit } from '../../engines/support-plan/engine-helpers';

describe('проход 190: второе написание несёт число в единице своей шкалы', () => {
  it('единица плоского мира совпадает с единицей строки порогов', () => {
    const checked: string[] = [];
    for (const [alias, { canon }] of Object.entries(TIER_SAME_ANALYSIS)) {
      if (!ucumInfo(alias)) continue;
      const row = LAB_TIERS[canon];
      expect(row, `нет строки ${canon}`).toBeTruthy();
      expect(flatLabUnit(alias), `${alias}: ${flatLabUnit(alias)} ≠ ${row.unit}`).toBe(row.unit);
      checked.push(alias);
    }
    // Прогестерон — доказательство, что проверка не пустая и пересчёт реально
    // нужен: каталог в нмоль/л, шкала в нг/мл.
    expect(checked).toContain('PROGESTERONE');
    expect(ucumInfo('PROGESTERONE')?.prefUnit).toBe('nmol/L');
    expect(LAB_TIERS.PROG.unit).toBe('ng/mL');
    expect(flatLabUnit('PROGESTERONE')).toBe('ng/mL');
  });
});
