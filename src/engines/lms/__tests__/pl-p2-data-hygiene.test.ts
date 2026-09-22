/**
 * pl-p2-data-hygiene.test.ts — lock-тесты остатка P2 аудит-раунда ПЛ-авто (Sep 22 2026):
 *
 *  1. Резолвер каталога срезает нотацию источника (@RPE8 / T1-T4) — РАНЬШЕ такие имена
 *     циклов («Присед @RPE8», «Жим лежа T2») не находились: терялись снаряд/мышца/паттерн.
 *  2. `exercise-id-mapping.ts` без мёртвых ключей (id, вытесненные keep-first дедупом имён
 *     или никогда не существовавшие в EXERCISE_CATALOG) — было 57.
 *  3. `LMS_EXERCISES` — merge с каталогом по §3.0: шум xlsm удалён, у каждой записи
 *     реальный catalogId итогового каталога (выдуманных упражнений нет).
 *  4. Гард `pct > 1.1`: 15 проходок источника (>110%, макс 129.25%) не клампятся,
 *     мусор >130% отбрасывается валидатором.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { EXERCISE_ID_MAP } from '../../../data/exercise-id-mapping';
import { LMS_EXERCISES } from '../../../data/lms-cycles/lms-exercises';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { EXERCISE_ALIAS_MAP, stripCycleNotation } from '../../../data/lms-cycles/exercise-alias-map';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { findCatalogExerciseByLabel, buildLMSPlan } from '../lms-builder.engine';

describe('P2-данные: RPE/T-суффиксы имён в резолвере каталога', () => {
  it('имена циклов с @RPE/T-тиром резолвятся в канонический каталог (было — null)', () => {
    expect(findCatalogExerciseByLabel('Присед @RPE8')?.id).toBe('squat');
    expect(findCatalogExerciseByLabel('Жим лежа @RPE8')?.id).toBe('bench_bar');
    expect(findCatalogExerciseByLabel('Становая тяга @RPE8')?.id).toBe('deadlift');
    expect(findCatalogExerciseByLabel('Жим стоя T1')?.id).toBe('ohp');
    expect(findCatalogExerciseByLabel('Жим лежа T2')?.id).toBe('bench_bar');
    expect(findCatalogExerciseByLabel('Присед T1')?.id).toBe('squat');
    expect(findCatalogExerciseByLabel('Тяга в наклоне T3')?.id).toBe('row_bar');
    expect(findCatalogExerciseByLabel('Тяга с плинтов @RPE8')?.id).toBe('rack_pull');
    expect(findCatalogExerciseByLabel('Жим лежа с паузой @RPE8')?.id).toBe('pl_bench_pause');
  });

  it('обычные имена не ломаются, stripCycleNotation идемпотентна', () => {
    expect(findCatalogExerciseByLabel('Присед')?.id).toBe('squat');
    expect(findCatalogExerciseByLabel('Жим лежа')?.id).toBe('bench_bar');
    expect(stripCycleNotation('Присед @RPE8')).toBe('Присед');
    expect(stripCycleNotation(stripCycleNotation('Жим лежа T2'))).toBe('Жим лежа');
    expect(stripCycleNotation('Присед')).toBe('Присед');
  });

  it('все alias-значения указывают на существующие записи каталога', () => {
    const ids = new Set(EXERCISE_CATALOG.map(e => e.id));
    const missing = [...new Set(Object.values(EXERCISE_ALIAS_MAP).filter(id => !ids.has(id)))];
    expect(missing).toEqual([]);
  });
});

describe('P2-данные: exercise-id-mapping без мёртвых ключей', () => {
  it('каждый ключ EXERCISE_ID_MAP существует в итоговом каталоге (keep-first дедуп)', () => {
    const ids = new Set(EXERCISE_CATALOG.map(e => e.id));
    const dead = Object.keys(EXERCISE_ID_MAP).filter(k => !ids.has(k));
    // Было 57 мёртвых ключей (вытесненные дубли имён + никогда не существовавшие id).
    expect(dead).toEqual([]);
  });

  it('вытесненные дубли не вернулись в маппинг', () => {
    for (const k of ['ohp_bar', 'lateral_raise_v2', 'plank_v2', 'seated_leg_extension', 'glute_bridge_barbell', 'ohp_seated_db', 'leg_raise_hanging', 'reverse_curl_cable_v2']) {
      expect(EXERCISE_ID_MAP[k], k).toBeUndefined();
    }
  });
});

describe('P2-данные: LMS_EXERCISES merge с каталогом (§3.0)', () => {
  it('xlsm-шум удалён (псевдо-упражнения не считаются пулом)', () => {
    const names = LMS_EXERCISES.map(e => e.name);
    for (const noise of ['1050-68', 'ОФП', 'Тяжелая', 'Упражнение комплекса', 'Опциональная тяга']) {
      expect(names, noise).not.toContain(noise);
    }
  });

  it('каждая запись несёт реальный catalogId итогового каталога (без выдуманных)', () => {
    const ids = new Set(EXERCISE_CATALOG.map(e => e.id));
    expect(LMS_EXERCISES.length).toBeGreaterThanOrEqual(70);
    for (const e of LMS_EXERCISES) {
      expect(e.catalogId, e.name).toBeTruthy();
      expect(ids.has(e.catalogId as string), `${e.name} -> ${e.catalogId}`).toBe(true);
    }
  });

  it('имена пула резолвятся тем же контуром, что у билдера', () => {
    for (const e of LMS_EXERCISES) {
      expect(findCatalogExerciseByLabel(e.name), e.name).toBeTruthy();
    }
  });
});

describe('P2-данные: гард pct > 1.1 (проходки источника)', () => {
  function sourceSetsOver(limit: number): { cycle: string; name: string; pct: number }[] {
    const out: { cycle: string; name: string; pct: number }[] = [];
    for (const c of LMS_CYCLES) {
      const layouts = c.weeks && c.weeks.length > 0 ? c.weeks : [c.week1];
      layouts.forEach(days => days.forEach(d => d.exercises.forEach(ex => ex.sets.forEach(s => {
        if (s.pct > limit) out.push({ cycle: c.meta.id, name: ex.name, pct: s.pct });
      }))));
    }
    return out;
  }

  it('ровно 15 проходок >110% в источниках и ни одного набора >130%', () => {
    const over = sourceSetsOver(1.1);
    expect(over.length).toBe(15);
    expect(sourceSetsOver(1.3)).toEqual([]);
  });

  it('buildLMSPlan НЕ клампит проходки — >110% остаются в плане', () => {
    const c = LMS_CYCLES.find(x => x.meta.id === 'src2-sistemy-1i2');
    expect(c, 'цикл src2-sistemy-1i2').toBeTruthy();
    const plan = buildLMSPlan({ template: c as never, pmMap: {}, fallbackPm: 100, faithful: true });
    const maxPct = Math.max(...plan.weeks.flatMap(w => w.days.flatMap(d => d.exercises.flatMap(e => e.workSets.map(s => s.pct)))));
    expect(maxPct).toBeGreaterThan(1.1);
    expect(maxPct).toBeLessThanOrEqual(1.3);
  });

  it('мусорный pct >130% режется валидатором (throw, а не тихое исполнение)', () => {
    const base = LCM_CYCLE_01();
    base.week1[0].exercises[0].sets[0].pct = 1.35;
    expect(() => buildLMSPlan({ template: base, pmMap: {}, fallbackPm: 100 })).toThrow(/invalid pct/);
  });
});

/** Клон первого PL-цикла (deep-frozen реестр не мутируем — JSON-копия). */
function LCM_CYCLE_01(): SRCycleTemplate {
  const c = LMS_CYCLES.find(x => x.meta.id === 'cycle-01');
  expect(c, 'cycle-01').toBeTruthy();
  return JSON.parse(JSON.stringify(c)) as SRCycleTemplate;
}

describe('P2-данные: wave-2 имён циклов (§10.3)', () => {
  /**
   * Остаток после wave-2 — имена ДРУГОГО контура (arm/WL-каталоги), псевдо-строки
   * источника и честно неоднозначные варианты. Резолвер main-каталога их не должен
   * «угадывать»; список заморожен: и рост, и падение этого множества = сигнал.
   */
  const EXPECTED_UNRESOLVED = [
    // arm-циклы (целевой каталог — exercise-catalog-arm, не main):
    'Иммитация верха', 'Боковой нажим', 'Отведение СБ', 'Приведение к плечу', 'Кисть РР', 'Пронация СБ',
    // WL-цикл (ТА):
    'Присед ТА',
    // псевдо-строки источника (не упражнения):
    'Опциональная тяга (см. инстр)', 'Опциональная тяга', 'Тест: проходка до макс', 'Отдых', 'Тест: проходка',
    // неоднозначные без каталожного эквивалента:
    'Сгибания обратным хватом', 'Сгибание обратным хватом', 'Жим-разводка',
    // плиометрика без записи в каталоге:
    'Прыжки на box', 'Выпрыгивания',
  ];

  it('падежи/DE/BBB/разговорные имена резолвятся (было — null)', () => {
    expect(findCatalogExerciseByLabel('Фронт-присед')?.id).toBe('front_squat');
    expect(findCatalogExerciseByLabel('Тяга становая')?.id).toBe('deadlift');
    expect(findCatalogExerciseByLabel('Разводка лёжа')?.id).toBe('fly_db');
    expect(findCatalogExerciseByLabel('Разгибания ног сидя')?.id).toBe('leg_ext_v2');
    expect(findCatalogExerciseByLabel('Присед DE 50% + цепи')?.id).toBe('squat');
    expect(findCatalogExerciseByLabel('Присед до макс')?.id).toBe('squat');
    expect(findCatalogExerciseByLabel('Жим лежа BBB')?.id).toBe('bench_bar');
    expect(findCatalogExerciseByLabel('Становая тяга скоростная')?.id).toBe('deadlift');
    expect(findCatalogExerciseByLabel('Дожим с бруска 10см')?.id).toBe('bench_bar');
  });

  it('parenthetical-нотация: alias-фолбэк ядра (ME/примечания)', () => {
    expect(findCatalogExerciseByLabel('Жим лежа с паузой (ME Upper)')?.id).toBe('pl_bench_pause');
    expect(findCatalogExerciseByLabel('Дотяга (с плинтов)')?.id).toBe('rack_pull');
    expect(findCatalogExerciseByLabel('ЖЛШХ (жим широким хватом)')?.id).toBe('bench_bar');
  });

  it('полный остаток имён циклов = allowlist (ни больше, ни меньше)', () => {
    const names = new Set<string>();
    for (const c of LMS_CYCLES) {
      const layouts = c.weeks && c.weeks.length > 0 ? c.weeks : [c.week1];
      for (const days of layouts) for (const d of days) for (const ex of d.exercises) names.add(ex.name);
    }
    const unresolved = [...names].filter(n => !findCatalogExerciseByLabel(n)).sort();
    expect(unresolved).toEqual([...EXPECTED_UNRESOLVED].sort());
  });
});

describe('P2-UI: мёртвый код SRCBBScreen + решение по панелям', () => {
  const screen = readFileSync(resolve(process.cwd(), 'src/ui/screens/SRCBBScreen.tsx'), 'utf8');

  it('write-only bridge-сеанс и локальные дубли удалены', () => {
    expect(screen).not.toContain('he_bridge_sessions');
    expect(screen).not.toContain('he_bridge_progress');
    expect(screen).not.toContain('bridgeSessions');
    expect(screen).not.toContain('bridgeAutoreg');
    expect(screen).not.toContain('PL_WP_OPTIONS');
    expect(screen).not.toContain('const WEAK_GROUPS');
    expect(screen).not.toContain('const toggleWeak');
    expect(screen).not.toContain('peakRirTarget');
    expect(screen).not.toContain('appliedMethods');
  });

  it('черновики тапера персистятся merge-записью he_pl_session (P2-1)', () => {
    expect(screen).toContain('plTaperAttemptOverride');
    expect(screen).toContain('plTaperPlan');
    expect(screen).toContain('TAPER_PLAN_PERSIST_MAX_CHARS');
    expect(screen).toMatch(/const prev = raw \? JSON\.parse\(raw\) : null/);
    expect(screen).toMatch(/\.\.\.base,/);
  });

  it('немонтируемые панели помечены @deprecated с причиной (решение аудита)', () => {
    const parts = 'src/ui/screens/SRCBBScreen_parts';
    const peaking = readFileSync(resolve(process.cwd(), `${parts}/PeakingPanel.tsx`), 'utf8');
    const prometrics = readFileSync(resolve(process.cwd(), `${parts}/ProMetricsPanel.tsx`), 'utf8');
    expect(peaking).toContain('@deprecated');
    expect(peaking).toContain('Не смонтирован');
    expect(prometrics).toContain('@deprecated');
    expect(prometrics).toContain('FFChart');
  });
});
