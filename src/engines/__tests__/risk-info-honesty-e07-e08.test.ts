/**
 * E0.7 + E0.8 — честность текста методики и видимость неопределённости.
 *
 * 26 сен 2026. Аудит нашёл в `RiskInfo.tsx` (справочник «Как считается риск»)
 * ФОРМУЛЫ, которых нет в коде, и наоборот — реальные формулы, описанные неверно:
 *
 *  1. `Risk_{organ} = Σ_{механизмы}(...)` — а движок агрегирует механизмы через
 *     RSS (√Σp²). Сумма завышала бы риск: 7+7+7 → 21% вместо 12.1%.
 *  2. `OverallRisk = среднее геометрическое` — а код считает среднее
 *     АРИФМЕТИЧЕСКОЕ по системам (line 832: reduce/n).
 *  3. `WeightedRisk = Σ(риск × w_organ) / Σ w_organ` — такого поля/расчёта в коде
 *     нет вообще. Формула выдумана.
 *  4. MDSS: «веса источников Фарма 40% + Анализы 25% + Тренировки 20% +
 *     Питание 15%» — в `mdss-engine.ts` таких весов нет. Геометрическое среднее
 *     реальное, но считается по Hill-очкам МАРКЕРОВ, а не «системных рисков».
 *  5. MDSS: «штраф ×1.5 при >12 недель без анализов» — реально
 *     `1 + 0.15×(недель−4)` с потолком ×3 (mdss-engine.ts:254-257), т.е. ×2.2 на 12-й.
 *
 * E0.8: надбавка неопределённости `U_i = 1 + 0.25·(1−d_cov)` реально
 * применялась к числу, но была видна только как множитель «×1.22» и как
 * отладочная строка — пользователь получал завышенный процент без единого
 * слова почему. План требует показывать величину рядом с меткой
 * «не верифицировано».
 *
 * Тест — SOURCE-GUARD: секция `SECTIONS` приватная, поэтому читаем исходник.
 * Мутационно: возврат любой из выдуманных формул роняет тест.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSrc = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
const readSrc2 = readSrc;
const info = readSrc('src/ui/screens/RiskScreen_parts/RiskInfo.tsx');
const specMethod = readSrc('src/ui/screens/RiskScreen_parts/RiskSpecMethod.tsx');
const engine = readSrc('src/engines/risk-engine-tz-spec.ts');
const mdss = readSrc('src/engines/mdss-engine.ts');
const v7 = readSrc('src/engines/risk-engine-v7-matrix.ts');

describe('E0.9 — тексты совпадают с кодом (счётчики не расходятся)', () => {
  const hub = readSrc2('src/ui/screens/Shared/MetabolicHub.tsx');
  const tools = readSrc2('src/ui/screens/TrainingScreen_parts/PlannerToolsPanel.tsx');
  const mhEngine = readSrc2('src/engines/metabolic-hub.engine.ts');

  it('число калькуляторов в hero выводится из MODE_DEFS, а не из литерала', () => {
    // Раньше стояло «17 калькуляторов» при фактических 16 режимах.
    // Теперь литерала нет вообще — число не может разъехаться с кодом.
    expect(hub).not.toMatch(/17\s*калькуляторов/);
    expect(hub).toMatch(/\{MODE_DEFS\.length\}\s*калькуляторов/);
  });

  it('MODE_DEFS действительно содержит 16 режимов (якорь для подписи)', () => {
    const defs = hub.slice(hub.indexOf('const MODE_DEFS'));
    const ids = [...defs.matchAll(/\{\s*m:\s*'([a-z_]+)'/g)].map(m => m[1]);
    expect(ids).toHaveLength(16);
  });

  it('нет подписи «5 в 1» — хаб отгружает 16 режимов (оба списка)', () => {
    // Дефект был продублирован в списках pl и bb.
    const fiveInOne = tools.match(/desc: '5 в 1:/g) || [];
    expect(fiveInOne).toHaveLength(0);
    expect((tools.match(/desc: '16 режимов:/g) || []).length).toBe(2);
  });

  it('нет прозвища исследования в пользовательской строке', () => {
    // «Biggest Loser» — прозвище работы Fothergill 2016, а не настройка и не ключ
    // хранилища; пользователю оно ничего не сообщает. Ссылка на источник сохранена.
    expect(mhEngine).not.toMatch(/\(Biggest Loser\)/);
    expect(mhEngine).toMatch(/Fothergill, 2016/);
  });

  it('нет «Hall adaptive v2» — в коде только v3', () => {
    expect(hub).not.toMatch(/Hall adaptive v2/);
  });
});

describe('E0.12 — write-only ключи хранения удалены', () => {
  // Канон: ключ, который никто не читает, — это не хранилище, а мусор.
  // Хуже того: cloud-kv перехватывает setItem, поэтому каждая такая запись
  // ещё и УЛЕТАЕТ В ОБЛАКО целиком, съедая квоту и трафик ради недостижимых данных.

  it('нет he_support_reports (дубль архива с другим кэшем)', () => {
    const f = readSrc2('src/ui/screens/SupportScreen_parts/SupportFavoritesView.tsx');
    expect(f).not.toMatch(/he_support_reports'/);
    expect(f).not.toMatch(/he_profile_support_reports/);
    // Канонический ключ архива остался — и он читается при следующей генерации.
    expect(f).toMatch(/he_support_reports_archive/);
  });

  it('нет he_pharma_course_pending (IndexedDB + буфер уже покрыты)', () => {
    const f = readSrc2('src/ui/screens/PharmaScreen_parts/DosageCalculatorTab.tsx');
    expect(f).not.toMatch(/he_pharma_course_pending/);
    // Реальные каналы доставки остались: IndexedDB и буфер обмена.
    expect(f).toMatch(/db\.put\('course_log'/);
    expect(f).toMatch(/clipboard/);
  });
});

describe('E0.7 — RiskInfo не содержит выдуманных формул', () => {
  it('нет суммы по механизмам (движок агрегирует RSS)', () => {
    expect(info).not.toMatch(/Risk_\{organ\}\s*=\s*Σ/);
    expect(info).not.toMatch(/Σ_\{механизмы\}/);
  });

  it('нет «среднего геометрического по системам» (код = арифметическое)', () => {
    expect(info).not.toMatch(/OverallRisk\s*=\s*среднее геометрическое/);
    expect(info).toMatch(/арифметическое/i);
  });

  it('нет выдуманного WeightedRisk — такого расчёта в движке нет', () => {
    expect(info).not.toMatch(/WeightedRisk/);
    expect(engine).not.toMatch(/WeightedRisk|weightedRisk/);
  });

  it('нет выдуманных весов источников MDSS (40/25/20/15)', () => {
    expect(info).not.toMatch(/Фарма\s*\(40%\)/);
    // Третья копия тех же весов стояла отдельным блоком «Веса источников риска».
    expect(info).not.toMatch(/Веса источников риска/);
    expect(info).not.toMatch(/Фарма:\s*40%/);
    expect(mdss).not.toMatch(/0\.4.*pharm|pharm.*0\.4/i);
  });

  it('нет фантомных «системных» синергий (реальные — пары механизмов)', () => {
    // Реально в коде SYNERGY_PAIRS = пары МЕХАНИЗМОВ (cv2+cv4, hem1+cv4 …) с s=0.2–0.25.
    // Порогов «система >50» и процентов вида +10/+8/+12/+15% в коде нет.
    // Ловушка: фантом был продублирован в ЧЕТЫРЁХ местах (в т.ч. как «ШАГ 8»
    // в описании V7), поэтому проверяем отсутствие во всём файле.
    expect(info).not.toMatch(/Синергии рисков \(Fuzzy Logic\)/);
    expect(info).not.toMatch(/общий риск \+10%/);
    expect(info).not.toMatch(/Эндокринный >50%/);
    expect(engine).toMatch(/SYNERGY_PAIRS/);
    // Честная замена обязана называть РЕАЛЬНЫЕ пары механизмов.
    expect(info).toMatch(/cv2 \+ cv4/);
  });

  it('V7 описан верно: геометрическое среднее, а не максимум', () => {
    // Реально в risk-engine-v7-matrix.ts:1143 — geomMean(allRaw).
    expect(info).not.toMatch(/overallRaw = max\(/);
    expect(info).not.toMatch(/Используется МАКСИМУМ \(не среднее!\)/);
    expect(v7).toMatch(/geomMean\(allRaw\)/);
  });

  it('нет выдуманного штрафа «×1.5 при >12 недель»', () => {
    expect(info).not.toMatch(/×1\.5\+/);
    // Реальная формула в коде — и она теперь в справке.
    expect(mdss).toMatch(/1\.0\s*\+\s*\(weeksSinceLab\s*-\s*4\)\s*\*\s*0\.15/);
  });
});

describe('E0.7 — RiskInfo описывает РЕАЛЬНЫЕ формулы', () => {
  it('RSS по механизмам и арифметическое среднее по системам', () => {
    expect(info).toMatch(/RSS/);
    expect(info).toMatch(/√\(Σ R/);
    // Числа-иллюстрации из мотивации (7+7+7 → 12.1) обязаны быть в тексте:
    // без них «RSS» — просто буква без объяснения пользователю.
    expect(info).toMatch(/12\.1/);
  });

  it('MDSS описан честно: геометрическое среднее по маркерам + 10k итераций', () => {
    expect(info).toMatch(/[Гг]ЕОМЕТРИЧЕСКОЕ/);
    expect(info).toMatch(/10 000|10000/);
    expect(mdss).toMatch(/Geometric mean of all Hill scores/);
  });
});

describe('E0.7 — explanation движка не противоречит сам себе', () => {
  it('различает Σ по препаратам и RSS по механизмам', () => {
    // Раньше строка формулы заканчивалась «суммирование по препаратам», а следом
    // шло «Агрегация: RSS» — читалось как «суммируем, но нелинейно».
    expect(engine).toMatch(/вклад каждого ПРЕПАРАТА суммируется|вклад ПРЕПАРАТОВ суммируется/i);
    expect(engine).toMatch(/Агрегация: RSS/);
  });

  it('надбавка неопределённости названа в explanation явно', () => {
    expect(engine).toMatch(/U_i = 1 \+ 0\.25/);
  });
});

describe('E0.8 — величина неопределённости видима в UI', () => {
  it('рядом с «не верифицировано» показан процент надбавки', () => {
    expect(specMethod).toMatch(/не верифицировано/);
    expect(specMethod).toMatch(/индекс \+\{/);
    expect(specMethod).toMatch(/result\.u_i - 1/);
  });

  it('множитель U показан в процентах, а не только «×1.22»', () => {
    expect(specMethod).toMatch(/U: ×\{result\.u_i\.toFixed\(2\)\}/);
    expect(specMethod).toMatch(/неопределённости/);
  });

  it('надбавка и маркер покрытия не смешаны в одну цифру', () => {
    // verification (доля систем с маркерами) и U_i (раздутие индекса) — разные
    // величины; смешивать их = новая ложь. Комментарий должен это фиксировать.
    expect(specMethod).toMatch(/НЕ то же самое, что `verification`/);
  });
});
