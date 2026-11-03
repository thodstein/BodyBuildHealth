/**
 * Замок проводки BB-Auto (аудит 2026-11, §5 п.4 плана).
 *
 * `bb-auto-audit-2026-11.test.ts` проверяет движок и чистые хелперы
 * (`bb-auto-injections.ts`), но не то, что компонент реально **вызывает** их
 * и пере-финализирует план. Между «хелпер правильный» и «хелпер подключён»
 * и жили дефекты BB-01/BB-02/BB-09: код был, вызова не было.
 *
 * Полный jsdom-рендер `BbAutoConstructor` виснет (god-component, все BB-тесты
 * идут через `renderToStaticMarkup`), поэтому проверяем исходник — тем же
 * приёмом, что `bb-hub-movement-intake.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '..', 'BbAutoConstructor.tsx'), 'utf8');

const count = (needle: string) => SRC.split(needle).length - 1;

/** Счётчик по регулярке (для коротких токенов, где literal ловит `localStorage,` и пр.). */
const countRe = (re: RegExp) => (SRC.match(new RegExp(re.source, 'g')) || []).length;

/** Срез от `from` до ближайшего `to` (исключая `to`). Бросает, если якоря нет. */
function between(from: string, to: string): string {
  const i = SRC.indexOf(from);
  if (i < 0) throw new Error(`якорь не найден: ${from}`);
  const j = SRC.indexOf(to, i + from.length);
  return SRC.slice(i, j < 0 ? SRC.length : j);
}

describe('BB-01: пост-инъекции пере-финализируются', () => {
  it('перед единственным setBuiltPlan план проходит revalidateEditedPlan', () => {
    const block = between('if (postPhaseInjected) {', 'setBuiltPlan({');
    expect(block).toContain('revalidateEditedPlan(plan)');
  });

  it('флаг ставится ровно один раз и только в блоке инъекций', () => {
    expect(count('let postPhaseInjected = false')).toBe(1);
    expect(count('postPhaseInjected = true')).toBe(1);
    const guard = between('if (exerciseSwaps.length > 0', 'postPhaseInjected = true');
    // Все четыре источника инъекций должны включать пере-финализацию.
    expect(guard).toContain('exerciseSwaps');
    expect(guard).toContain('preferredExerciseIds');
    expect(guard).toContain('executionCorrections');
    expect(guard).toContain('lrTopUp');
  });
});

describe('BB-02/BB-13: ручные правки не оставляют sets без workSets', () => {
  it('adjustVolume синхронизирует workSets и только потом пишет sets', () => {
    const body = between('const adjustVolume = (mult: number) => {', 'const adjustWeight =');
    expect(body).toContain('if (Array.isArray(e.workSets))');
    const syncIdx = body.indexOf('e.workSets.slice(0, next)');
    expect(syncIdx).toBeGreaterThan(-1);
    // Порядок важен: sets выставляется после правки workSets, иначе инвариант
    // sets === workSets.length нарушается на самом «горячем» пути.
    expect(syncIdx).toBeLessThan(body.indexOf('e.sets = next'));
  });

  it('adjustWeight пропускает упражнения без workSets вместо падения', () => {
    const i = SRC.indexOf('const adjustWeight = (mult: number) => {');
    expect(i).toBeGreaterThan(-1);
    expect(SRC.slice(i, i + 900)).toContain('if (!Array.isArray(e.workSets)) continue;');
  });

  it('инъекции строят workSets через единый хелпер', () => {
    expect(count('makeWorkSets(')).toBeGreaterThanOrEqual(3);
    expect(count('exerciseName: exerciseKeyOf(')).toBeGreaterThanOrEqual(1);
  });
});

describe('BB-03/BB-14: вес считается, а не копируется', () => {
  it('инъекции используют estimatedWeightFor и loadRatioBetween', () => {
    expect(count('estimatedWeightFor(')).toBeGreaterThanOrEqual(2);
    expect(count('loadRatioBetween(')).toBeGreaterThanOrEqual(1);
  });
});

describe('BB-08/BB-09: контекст доезжает до обоих путей сборки', () => {
  it('age и боль передаются в оба пути сборки', () => {
    // Программы/циклы идут через programToBBPlan, сплиты — через buildBBPlan.
    expect(count('programToBBPlan(')).toBeGreaterThanOrEqual(1);
    expect(count('buildBBPlan({')).toBeGreaterThanOrEqual(1);
    // ... и в каждом payload есть возраст и вердикт по боли.
    expect(countRe(/\bage:\s*Number\(/)).toBeGreaterThanOrEqual(2);
    expect(countRe(/\bpainLevel:/)).toBeGreaterThanOrEqual(2);
  });

  it('боль хранится из диагностики и переживает перезагрузку', () => {
    expect(SRC).toContain('bbPain');
    expect(SRC).toContain('he_bb_last_pain');
  });
});

describe('BB-11: пересборка остатка не подменяет чужой сплит', () => {
  it('обработчик отказывает вне канона сплита и до 2-й недели', () => {
    const i = SRC.indexOf('const handleReplanRemainder = () => {');
    expect(i).toBeGreaterThan(-1);
    const fn = SRC.slice(i, i + 2000);
    expect(fn).toContain('SPLIT_PATTERNS.some(p => p.id === pid)');
    expect(fn).toContain('wk < 2');
    expect(fn).toContain('replanBBMesoFromFact(');
    // Результат пересборки тоже проходит пере-финализацию (иначе объём/капы
    // проверялись бы по состоянию до правки).
    expect(fn).toContain('revalidateEditedPlan(');
  });

  it('в шаге плана есть точка входа (кнопка), а не только движок', () => {
    expect(SRC).toContain('data-bb="replan-remainder"');
    expect(SRC).toContain('data-bb="replan-remainder-btn"');
  });
});

describe('BB-12/BB-16: канон подписей', () => {
  it('в плеер уходит подпись мышцы, а не сырой ключ', () => {
    expect(SRC).toContain('muscleLabel(e.muscle)');
  });
});

describe('BB-19/BB-20/BB-21: дефолт целевого % жира и мёртвый код', () => {
  it('BB-19: targetBodyFat получает канон defaultTargetBodyFat, а не undefined', () => {
    const init = between('const [targetBodyFat, setTargetBodyFat] = useState', 'const [wearableTick');
    // Раньше здесь жил `const def = sex === 'female' ? 18 : 10`, который
    // вычислялся и выбрасывался → cut/recomp теряли поправку объёма.
    expect(init).toContain('defaultTargetBodyFat(');
    expect(init).not.toContain('const def =');
  });

  it('BB-20/BB-21: мёртвые расчёты удалены, а не оставлены «на будущее»', () => {
    // buildPeakConfig дублировал buildContestPrepConfig; regimeMrvMult нигде не
    // применялся (множитель берётся из плана/pedAdapt). Оба удалены.
    expect(SRC).not.toContain('buildPeakConfig');
    expect(SRC).not.toContain('regimeMrvMult');
    // В комментарии хелпер упомянут как объяснение — проверяем, что он не остался
    // в импортах (иначе мёртвая зависимость вернётся).
    expect(SRC).not.toMatch(/import[^\n]*computeRegimeMrvMult/);
  });
});

/**
 * Итерации M/P: снимки факта пересчитываются ПОСЛЕ последних изменений плана —
 * в том числе на пути ручных правок, где после `finalizeBBPlan` идут ещё
 * `prioritizeBackSessions` и финальная рампа (замер: expandedSummary расходился
 * в 9 из 12 планов, т.е. «Итого: N рабочих сетов/нед» и карточки качества
 * показывали цифры прежней версии плана).
 */
describe('BB-снимки: правки пересчитывают факт последним', () => {
  it('revalidateEditedPlan заканчивается refreshBBPlanSnapshots', () => {
    const body = between('const revalidateEditedPlan = (plan: BBPlan): BBPlan => {', 'const adjustVolume =');
    const refreshIdx = body.indexOf('refreshBBPlanSnapshots(out,');
    expect(refreshIdx).toBeGreaterThan(-1);
    // Порядок: после пере-финализации, топ-апа спины и рампа.
    expect(refreshIdx).toBeGreaterThan(body.indexOf('finalizeBBPlan('));
    expect(refreshIdx).toBeGreaterThan(body.indexOf('prioritizeBackSessions(out,'));
    expect(refreshIdx).toBeGreaterThan(body.indexOf('enforceRampWeeklyCap(week.sessions, caps)'));
    // И частота сверяется с фактом, иначе после правок обещание «N×/нед» врёт.
    expect(body.slice(refreshIdx)).toContain('refreshFrequency: true');
  });

  it('плитка «сетов/нед» не суммирует все недели мезоцикла', () => {
    const body = between('const handleSendToNutrition = () => {', 'const handleExportIcs =');
    // Раньше: reduce по всем неделям → 6-недельный план обещал в 6 раз больше,
    // а подпись была «сетов/нед».
    expect(body).toContain('totalWorkingSets');
    expect(body).toContain('weeksCount');
    expect(body).not.toMatch(/const weeklySets = \(plan\.weeks \|\| \[\]\)\.reduce/);
  });
});
