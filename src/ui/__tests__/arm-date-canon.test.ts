/**
 * arm-date-canon.test.ts — хабы армрестлинга и армлифтинга считают дни по локальному канону.
 *
 * Контекст. Оба хаба брали «сегодня» как `toISOString().slice(0, 10)` (UTC), и в
 * вечерние часы при смещении UTC+3…+12 это давало вчерашний день:
 *  - снимок силы/попыток и снимок спец-блока получали вчерашнюю дату;
 *  - в имя выгружаемого файла попадал вчерашний день (`arm-diagnostics-*.html/csv`,
 *    `arm-plan-*.ics`, `armlifting-*.html/csv`, `armlift-spec-block-*.ics`);
 *  - `dateIso` новой силовой попытки писался под вчерашний ключ, т.е. попытка
 *    «сегодняшним числом» уходила в чужой день (тот же writer/reader раскол, что
 *    и в дневниках тренировок);
 *  - `weeksBetween(prev.date, …)` для «недель с прошлой попытки» сдвигалась на сутки.
 *
 * Про 13-е место (arm-hub-tabs2). `he_arm_humerus_checks.touchedAt` — это МОМЕНТ
 * ВО ВРЕМЕНИ, а не календарный день, поэтому его нельзя «перевести на канон» —
 * можно только перестать врать о форме. Ключ write-only (читателей в проекте нет),
 * поэтому поле стало честным UTC-таймстемпом без среза до дня. Это единственное
 * место батча, где канон применён «наоборот» — и это осознанно: контракт различает
 * календарную дату (только core/local-date) и событие (updatedAt/touchedAt — UTC).
 *
 * Честно о силе этого лока. Поведенческой проверки рендера здесь нет: экспорт идёт
 * через нативный мост (`downloadArmFile` / `saveCsvApk` / `printHtmlApk`), а оба хаба
 * — тяжёлые god-компоненты, требующие провайдера профиля. Поэтому здесь
 * source-guard, проверенный мутацией: возврат date-only вызова роняет тест, а
 * возврат среза к `touchedAt` — тоже. Поведенческие локи на записи дневников живут
 * в diary-date-canon / date-canon-census / report-date-canon.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ХАБЫ = [
  'src/ui/screens/TrainingScreen_parts/ArmDiagnosticsHub.tsx',
  'src/ui/screens/TrainingScreen_parts/ArmliftingDiagnosticsHub.tsx',
];
const CHECKLIST = 'src/ui/screens/TrainingScreen_parts/arm-hub-tabs2.tsx';

const КОД_ФАЙЛА = (rel: string) => {
  const src = readFileSync(join(process.cwd(), rel), 'utf8');
  // Комментарии не считаются: ценз их снимает, и гард должен вести себя так же.
  return { src, код: src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') };
};

describe('хабы арма: канон дат', () => {
  it('в хабах армрестлинга и армлифтинга нет date-only вызовов', () => {
    for (const rel of ХАБЫ) {
      const { код } = КОД_ФАЙЛА(rel);
      const остатки = код.match(/\.toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/g) || [];
      expect(остатки, `${rel}: вернулись date-only вызовы`).toEqual([]);
    }
  });

  it('оба хаба берут даты из core/local-date', () => {
    for (const rel of ХАБЫ) {
      const { src } = КОД_ФАЙЛА(rel);
      expect(src, `${rel}: нет импорта канона`)
        .toMatch(/import\s*\{[^}]*localIsoDate[^}]*\}\s*from\s*'\.\.\/\.\.\/\.\.\/core\/local-date'/);
    }
  });

  it('силовая попытка и снимок берут канон, а не UTC-день', () => {
    const { код } = КОД_ФАЙЛА(ХАБЫ[0]);
    // «dateIso» новой попытки — ключ записи, разрыв этого клюша и есть тот дефект.
    expect(код, 'dateIso попытки должен считаться по канону').toMatch(/dateIso:\s*localIsoDate\(\)/);
    // Имена выгрузок: 3 у армрестлинга + 3 у армлифтинга.
    const arm = КОД_ФАЙЛА(ХАБЫ[0]).код.match(/arm-(?:diagnostics|plan)-\$\{localIsoDate\(\)\}/g) || [];
    const lift = КОД_ФАЙЛА(ХАБЫ[1]).код.match(/armlift(?:ing)?[\w-]*-\$\{localIsoDate\(\)\}/g) || [];
    expect(arm.length, 'ожидались 3 имени выгрузки с каноном в армрестлинге').toBe(3);
    expect(lift.length, 'ожидались 3 имени выгрузки с каноном в армлифтинге').toBe(3);
  });

  it('touchedAt остаётся событием во времени, а не календарным днём', () => {
    const { код } = КОД_ФАЙЛА(CHECKLIST);
    expect(код, 'touchedAt не должен срезаться до дня').not.toMatch(/touchedAt:\s*new Date\(\)\.toISOString\(\)\s*\.slice\(/);
    expect(код, 'touchedAt должен быть полным UTC-таймстемпом').toMatch(/touchedAt:\s*new Date\(\)\.toISOString\(\)/);
    // Чек-лист не должен начать «считать дни» сам — у него нет календарной даты.
    expect(код, 'чек-лист не импортирует канон: у него нет календарных дат').not.toMatch(/core\/local-date/);
  });
});
