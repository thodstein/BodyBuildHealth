/**
 * pl-auto-ui-audit-2026-10.test.tsx — лок-тесты UI-раунда аудита PL-auto (Oct 2026).
 *
 *  P1-A PLPlanView: подпись тапера «0%/100% объёма» (округление ДЕЛЕНИЯ, не результата);
 *  P1-B PLPlanView: карточка «Попытки на соревнования» — канон MEET_STRATEGY_PCT
 *         (был competitionAttempts 87.5/92.5/100 при подписи стратегии 92/96/102);
 *  P1-C PLPlanView: правка сетов 2..N блока молча терялась (ключ per-set вместо
 *         block-start — контракт lms-effective-plan);
 *  P1-D PLPlanView: добавленные из каталога упражнения дублировались вне режима правки;
 *  P1-E SRCBBScreen: «Применить в план» Frequency Planner был тихим no-op;
 *  P2-A PLToolsCard: группы подписаны по-русски.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = 'src/ui/screens/SRCBBScreen_parts';
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const view = read(`${dir}/PLPlanView.tsx`);
const tools = read(`${dir}/PLToolsCard.tsx`);
const screen = read('src/ui/screens/SRCBBScreen.tsx');

describe('P1-A/P1-B: подписи и канон прикидов', () => {
  it('процент объёма тапера умножается ПОСЛЕ округления (не Math.round(ratio)*100)', () => {
    expect(view).not.toMatch(/Math\.round\([^)]*weekVolumeOf[^)]*\)\s*\*\s*100/);
    expect(view).toMatch(/Math\.round\(\(weekVolumeOf\(w\) \/ Math\.max\(1, weekVolumeOf\(W\[W\.length - taperWeeksToAdd - 1\] \?\? W\[0\]\)\)\) \* 100\)/);
  });

  it('карточка «Попытки на соревнования» считает через meetAttemptsFor (канон стратегии)', () => {
    expect(view).toContain('meetAttemptsFor(value, attemptStrategy)');
    expect(view).toContain('MEET_STRATEGY_PCT[attemptStrategy]');
    expect(view).not.toContain('competitionAttempts(value)');
  });
});

describe('P1-C: ключи правки сетов = block-start (контракт lms-effective-plan)', () => {
  it('в редакторе накапливается flatIdx, ключ блока — его стартовый индекс', () => {
    expect(view).toContain('let flatIdx = 0;');
    expect(view).toContain('const blockStart = flatIdx;');
    expect(view).toContain('const k = setKey(wk.week, di, ei, setIdx);');
    // все строки блока делят один ключ: правка сета 2..N доезжает до плана
    expect(view).toMatch(/allSets\.push\(\{ ws, blockIdx: bi, setIdx: blockStart, rowNum: allSets\.length \+ 1 \}\)/);
  });
});

describe('P1-D: добавленные упражнения не дублируются вне режима правки', () => {
  it('зелёные строки «＋ добавлено» рисуются только в editMode', () => {
    expect(view).toContain('{editMode && (srcAdditions[dk] || []).map(a => (');
  });
});

describe('P1-E: Frequency Planner «Применить в план» реально помечает группы слабыми', () => {
  it('SRCBBScreen мержит мышцы частоты в weakPoints (инъекция идёт по weakPoints)', () => {
    expect(screen).toContain("setWeakPoints(prev => Array.from(new Set([...prev, ...plans.map(p=>p.muscle)])));");
    expect(screen).toContain('PL_TOOL_GROUP_RU');
    expect(screen).toContain('группы помечены слабыми, пересоберите план');
  });
});

describe('P2-A: группы Frequency Planner подписаны по-русски', () => {
  it('PLToolsCard рендерит GRP_RU вместо сырых ключей', () => {
    expect(tools).toContain('const GRP_RU');
    expect(tools).toContain('{GRP_RU[f.muscle] ?? f.muscle} {f.totalSets}п/нед');
  });
});

describe('P2-B: полноэкранные диалоги плана доступны с клавиатуры', () => {
  it('пикер и экспорт: role=dialog + Escape через общий хук уровня компонента', () => {
    expect(view).toContain('useInlineDialogA11y(!!pickerDay, () => setPickerDay(null))');
    expect(view).toContain('useInlineDialogA11y(expOpen, () => setExpOpen(false))');
    expect(view).toContain('aria-modal="true"');
    // Оба диалога получили ref из уровня компонента (не условный хук внутри JSX —
    // иначе React падает «rendered more hooks»).
    expect(view).toContain('ref={pickerRef}');
    expect(view).toContain('ref={expRef}');
    expect(view).toContain('role="dialog"');
  });
});

describe('P2-C: сезонный календарь (.ics) + подсказка дня старта', () => {
  const compTab = readFileSync(resolve(process.cwd(), `${dir}/PLCompetitionTab.tsx`), 'utf8');

  it('у сезона есть выгрузка .ics из единого реестра стартов', () => {
    expect(compTab).toContain('buildPLSeasonIcs');
    expect(compTab).toContain('handleSeasonIcs');
    expect(compTab).toContain('📅 Календарь сезона (.ics)');
    // Честный no-data: без дат/окна — предупреждение, а не пустой файл
    expect(compTab).toContain('Нечего выгружать');
  });

  it('«9 попыток = 9 возможностей»: промах → повторить тот же вес', () => {
    expect(compTab).toContain('9 попыток = 9 возможностей');
    expect(compTab).toContain('Повторите ТОТ ЖЕ вес');
  });
});

describe('P2-D: карточка «План vs факт» питается дневником', () => {
  it('PLPlanView считает сверку/дрейф/интенсивность и получает дневник из SRCBBScreen', () => {
    expect(view).toContain('plWeeklyCompliance(displaySrc, historyWorkouts ?? []');
    expect(view).toContain('planFactDriftWarnings(historyWorkouts ?? [])');
    // Раунд 3: подсказка умеет считать по факту скоростей дневника.
    expect(view).toContain('plIntensityAdvisory(displaySrc, { sessions: historyWorkouts ?? [] })');
    expect(view).toContain('data-pl="fact-drift"');
    expect(view).toContain('data-pl="vl-advisory"');
    expect(screen).toContain('historyWorkouts, currentWeek: srcWeek,');
  });
});

describe('round-3 (5-bis): autoreg-offer, days, fact-VL, export, ICS sessions', () => {
  it('drift offers switching autoregulation itself (button, not only text)', () => {
    expect(view).toContain('data-pl="drift-autoreg"');
    expect(view).toContain("onClick={() => setAutoRegMode('auto')}");
    // Button only when the mode is off - otherwise it makes no sense.
    expect(view).toContain("{autoRegMode === 'off' && (");
  });

  it('intensity advisory can compute from FACT diary velocities', () => {
    expect(view).toContain('plIntensityAdvisory(displaySrc, { sessions: historyWorkouts ?? [] })');
    expect(view).toContain('data-pl="vl-source"');
  });

  it('day breakdown is computed by a separate engine and expands on click', () => {
    expect(view).toContain('plWeeklyComplianceByDays(displaySrc, historyWorkouts ?? []');
    expect(view).toContain('data-pl="fact-days-toggle"');
    expect(view).toContain('data-pl="fact-days"');
  });

  it('plan vs fact report exports to CSV and HTML', () => {
    expect(view).toContain('buildPLComplianceCsv(');
    expect(view).toContain('buildPLComplianceHtml(');
    expect(view).toContain('data-pl="fact-export-csv"');
    expect(view).toContain('data-pl="fact-export-html"');
  });

  it('season .ics supports events for all training sessions', () => {
    const compTab = readFileSync(resolve(process.cwd(), `${dir}/PLCompetitionTab.tsx`), 'utf8');
    expect(compTab).toContain('withTrainingSessions: seasonIcsWithSessions');
    expect(compTab).toContain('data-taper="ics-sessions"');
  });
});
