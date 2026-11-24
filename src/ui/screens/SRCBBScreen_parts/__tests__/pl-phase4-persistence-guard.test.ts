/**
 * pl-phase4-persistence-guard.test.ts — аудит 2026-11-22, фаза 4.
 *
 * Настройки ПЛ, которые терялись при перезагрузке экрана или перетирались
 * каталогом/дефолтами:
 *  • P1-9  — сохранённая длина цикла не перетирается длиной каталога;
 *  • P1-10 — выбранные дни/упражнения карт (слабые группы, диагностика,
 *            лимитеры, ортопедия) персистятся в he_pl_session.plDayMaps
 *            и не стираются на первом маунте;
 *  • P2-16 — режим авто-прогрессии ПМ (`pedAuto`) переживает перезагрузку;
 *  • P2-17 — питание (профицит/белок) для MRV soft-cap переживает перезагрузку;
 *  • P2-18 — невалидный черновик тапера не затирается `null`;
 *  • P2-1  — настройки таймера отдыха читаются из he_timer_settings;
 *  • P2-5  — импорт протокола соревнования не сбрасывает ручную отметку «тяжело».
 *
 * Поведение отдельных обработчиков проверяется рядом:
 * `pl-season-builder.test.tsx` (P2-4), `peaking-panel-bb-coach.test.tsx` (P2-6).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('P1-9: длина цикла не перетирается каталогом', () => {
  const src = read('src/ui/screens/SRCBBScreen.tsx');

  it('каталог задаёт длину только когда сохранённой нет', () => {
    expect(src).toContain('cycleWeeksHydratedRef');
    expect(src).toContain('if (_plSaved?.cycleWeeks == null) setCycleWeeks(originalCycleWeeks(cycle));');
  });

  it('безусловной перезаписи длины при монтировании больше нет', () => {
    expect(src).not.toContain('if (cycle) setCycleWeeks(originalCycleWeeks(cycle));');
  });

  it('длина цикла сохраняется в he_pl_session', () => {
    const persistStart = src.indexOf('plPeakLayout: peakLayout,');
    expect(persistStart).toBeGreaterThan(0);
    const persistBlock = src.slice(src.lastIndexOf('JSON.stringify({', persistStart), persistStart);
    expect(persistBlock).toContain('cycleWeeks,');
  });
});

describe('P1-10: карты дней/упражнений переживают перезагрузку', () => {
  const src = read('src/ui/screens/SRCBBScreen.tsx');

  it('гидрация из he_pl_session.plDayMaps с привязкой к циклу', () => {
    expect(src).toContain('plDayMaps');
    expect(src).toContain('m.cycleId === selectedCycleId');
    expect(src).toContain('() => (_savedDayMaps.weakGroupDayMap as Record<string, number[]>) ?? {}');
    expect(src).toContain('() => (_savedDayMaps.diagnosticDayMap as Record<string, number[]>) ?? {}');
  });

  it('первый маунт не стирает загруженное; смена цикла — чистит', () => {
    expect(src).toContain('dayMapsCycleRef');
    expect(src).toContain('if (dayMapsCycleRef.current === null) {');
  });

  it('карты записываются в he_pl_session вместе с cycleId', () => {
    const start = src.indexOf('plDayMaps: {');
    expect(start).toBeGreaterThan(0);
    const block = src.slice(start, start + 700);
    expect(block).toContain('cycleId: selectedCycleId');
    expect(block).toContain('limiterProtocolMap');
    expect(block).toContain('orthopedicBlockedPatterns');
  });
});

describe('P2-16 / P2-17: пед-режим и питание MRV персистятся', () => {
  const src = read('src/ui/screens/SRCBBScreen.tsx');

  it('pedAuto читается из he_pl_session (миграция — из профиля)', () => {
    expect(src).toContain("typeof _plSaved?.plPedAuto === 'boolean'");
    expect(src).toContain('_profPL.onCourse');
  });

  it('профицит/белок читаются из he_pl_session с фолбэком на профиль', () => {
    expect(src).toContain('_plSaved?.plCalorieSurplus');
    expect(src).toContain('_plSaved?.plProteinPerKg');
  });

  it('все три значения пишутся merge-записью', () => {
    const fn = src.slice(src.indexOf('plPedAuto: pedAuto'));
    expect(fn).toContain('plCalorieSurplus,');
    expect(fn).toContain('plProteinPerKg,');
    // merge, а не перезапись всего объекта сессии
    expect(src).toContain("const base = cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : {}");
  });
});

describe('P2-18: битый черновик тапера не затирается null', () => {
  const src = read('src/ui/screens/SRCBBScreen.tsx');

  it('флаг «не читается» отличается от «пользователь очистил»', () => {
    expect(src).toContain('taperDraftUnreadableRef');
    expect(src).toContain('if (!taperDraftUnreadableRef.current) taperDraft.plTaperPlan = null;');
  });

  it('«Начать заново» снимает защиту — явная очистка сохраняется', () => {
    const fn = src.slice(src.indexOf('const resetBuild = ()'));
    expect(fn.indexOf('taperDraftUnreadableRef.current = false')).toBeLessThan(fn.indexOf('setTaperPlan(null)'));
  });
});

describe('P2-1: таймер отдыха читает сохранённые настройки', () => {
  const src = read('src/ui/screens/SRCBBScreen_parts/SessionPlayer.tsx');

  it('he_timer_settings разбирается и инициализирует preset/customRestSec/autoStart', () => {
    expect(src).toContain("localStorage.getItem('he_timer_settings')");
    expect(src).toContain('useState<number>(timerSettingsSaved.customRest)');
    // Prettier может перенести generic-вызов на новую строку — не завязываемся на одну.
    expect(src).toMatch(
      /useState<'compound' \| 'isolation' \| 'pump' \| 'custom'>\(\s*timerSettingsSaved\.preset,?\s*\)/,
    );
    expect(src).toContain('useState<boolean>(timerSettingsSaved.autoStart)');
  });

  it('мёртвое состояние (сеттер не вызывался) удалено', () => {
    expect(src).not.toContain('const [timerSettings, setTimerSettings]');
  });

  it('сохранение осталось согласованным с чтением', () => {
    // Ищем по ключу, а не по однострочному `setItem('…'`: после форматирования
    // аргументы переносятся, и прежний поиск давал пустую строку.
    const idx = src.lastIndexOf("'he_timer_settings'");
    expect(idx).toBeGreaterThan(-1);
    const fn = src.slice(idx, idx + 600);
    expect(fn).toContain('customRest: customRestSec');
    expect(fn).toContain('autoStart: autoStartRest');
  });
});

describe('P2-5: импорт протокола не сбрасывает ручную отметку «тяжело»', () => {
  const src = read('src/ui/screens/SRCBBScreen_parts/PLCompetitionTab.tsx');

  it('сохраняется прежний effort попытки', () => {
    expect(src).toContain('const prevEffort = meetResults(');
    expect(src).toContain("effort: prevEffort ?? 'normal'");
  });

  it('жёсткой перезаписи effort: normal в обработчике импорта нет', () => {
    const start = src.indexOf('data-pl="protocol-import-apply"');
    expect(start).toBeGreaterThan(0);
    const handler = src.slice(start, start + 2000);
    expect(handler).not.toContain("effort: 'normal',");
  });
});
