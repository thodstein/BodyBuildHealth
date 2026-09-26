/**
 * labs-risk-date-canon.test.ts — лаборатория и риски считают дни по локальному канону.
 *
 * Контекст. `LabsScreen` и `RiskScreen` брали «сегодня» и границы окон как
 * `toISOString().slice(0, 10)` (UTC), тогда как даты анализов и записей журнала
 * пишутся по локальному канону (workout-logger / lab-diary → core/local-date).
 * Последствия: снимок/отчёт получал вчерашнюю дату при записи вечером, в имя
 * выгружаемого файла попадал вчерашний день, а стартовые даты окон комплаенса
 * («3 месяца назад», «N недель назад», «28 дней назад») сдвигались на сутки.
 *
 * Честно о силе этого лока. Здесь НЕТ поведенческой проверки рендера, и это
 * сознательно: экспорт идёт через нативный мост (`saveCsvApk` / `saveTextFileApk`
 * / `printHtmlApk`), а экраны LabsScreen/RiskScreen — тяжёлые god-компоненты,
 * требующие полного провайдера профиля; цена такой обвязки здесь выше ценности
 * этих мест (сдвиг окна на сутки и вчерашняя дата в имени файла не меняют
 * решение пользователя, в отличие от контура дневников, где расходились ключи
 * записей). Поэтому здесь source-guard, проверенный мутацией: возврат любого
 * date-only вызова в этих двух файлах роняет тест. Поведенческие локи на записи
 * дневников и окнах анализов живут в date-canon-census / report-date-canon /
 * training-calendar-local-dates / diary-date-canon.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ФАЙЛЫ = ['src/ui/screens/LabsScreen.tsx', 'src/ui/screens/RiskScreen.tsx'];
const КОД_ФАЙЛА = (rel: string) => {
  const src = readFileSync(join(process.cwd(), rel), 'utf8');
  // Комментарии не считаются: ценз их снимает, и гард должен вести себя так же.
  return { src, код: src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') };
};

describe('лаборатория и риски: канон дат', () => {
  it('в LabsScreen и RiskScreen нет date-only вызовов', () => {
    for (const rel of ФАЙЛЫ) {
      const { код } = КОД_ФАЙЛА(rel);
      const остатки = код.match(/\.toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/g) || [];
      expect(остатки, `${rel}: вернулись date-only вызовы`).toEqual([]);
    }
  });

  it('оба экрана берут даты из core/local-date', () => {
    for (const rel of ФАЙЛЫ) {
      const { src } = КОД_ФАЙЛА(rel);
      expect(src, `${rel}: нет импорта канона`).toMatch(/import\s*\{[^}]*localIsoDate[^}]*\}\s*from\s*'\.\.\/\.\.\/core\/local-date'/);
    }
  });

  it('стартовые даты окон комплаенса считаются по канону, а не по UTC', () => {
    const { код } = КОД_ФАЙЛА('src/ui/screens/RiskScreen.tsx');
    // Окна «3 месяца назад», «N недель назад», «28 дней назад» — три хвоста,
    // каждый обязан отдавать локальный день уже сдвинутой даты.
    const хвосты = код.match(/return localIsoDate\(d\);/g) || [];
    expect(хвосты.length, 'ожидались три start-даты окон на localIsoDate(d)').toBe(3);
    // Сдвиг самой календарной арифметики не трогаем — меняется только извлечение дня.
    expect(код, 'календарная арифметика окон должна остаться').toMatch(/d\.setMonth\(d\.getMonth\(\) - 3\)/);
    expect(код, 'календарная арифметика окон должна остаться').toMatch(/d\.setDate\(d\.getDate\(\) - 28\)/);
  });
});
