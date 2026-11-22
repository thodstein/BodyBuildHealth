/**
 * pl-phase6-cleanup-guard.test.ts — аудит 2026-11-22, фаза 6 (уборка мёртвого кода
 * и честность плиток/превью).
 *
 *  • P2-7  — мёртвые карты федераций удалены (единый путь resolveNormsFederation);
 *  • P2-8  — мёртвая пара warmupQuality удалена;
 *  • P2-9  — плитки «Тоннаж/КПШ/УОИ» и объём считаются по отредактированному плану;
 *  • P2-11 — превью чек-ина подписано днём, к которому относится;
 *  • P2-12 — мёртвый setSummary и недостижимый список добавлений удалены;
 *  • P2-20 — PLPlanView больше не обещает пересборку плана (нет мёртвых props);
 *  • P3    — PL_VIDEO_NOTES / PeakTaperMode без потребителей удалены.
 *
 * Поведение проверяется в pl-effective-plan (P2-9) и pl-norms-bridge (P2-7).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('P2-9 / P2-10: плитки плана считаются по тому же плану, что и строки', () => {
  const src = read('src/ui/screens/SRCBBScreen_parts/PLPlanView.tsx');
  const screen = read('src/ui/screens/SRCBBScreen.tsx');

  it('итоги берутся из эффективного плана (один источник с плеером)', () => {
    expect(src).toContain('const metricsSrc = effectiveSrc ?? builtSrc;');
    // P2-10: второго (локального) оверлея правок нет — нечего дублировать.
    expect(src).not.toMatch(/applyPLEffectiveOverlay\(/);
    expect(src).toContain('metricsSrc.cycleMetrics.tonnage');
    expect(src).toContain('metricsSrc.cycleMetrics.kpsh');
  });

  it('исходные метрики больше не подписывают отредактированные строки', () => {
    expect(src).not.toContain('displaySrc.cycleMetrics');
  });

  it('объём vs MRV считается по тому же источнику', () => {
    expect(src).toContain('getPLVolumeBreakdown(metricsSrc.weeks)');
    expect(src).toContain('metricsSrc.plVolumeLandmarks');
  });

  it('число подходов в таблице считается единой функцией scaleSetCount', () => {
    expect(screen).toContain(
      "import { applyPLEffectiveOverlay, scaleSetCount } from '../../engines/lms/lms-effective-plan';",
    );
    const i = screen.indexOf('const effSet = (');
    expect(i).toBeGreaterThan(0);
    const body = screen.slice(i, screen.indexOf('return {', i));
    expect(body).toContain('scaleSetCount(');
    expect(body).toContain('volumeMultiplier: bridgeMult');
  });
});

describe('P2-11: превью чек-ина подписано днём', () => {
  const card = read('src/ui/screens/SRCBBScreen_parts/PLReadinessCard.tsx');
  const view = read('src/ui/screens/SRCBBScreen_parts/PLPlanView.tsx');

  it('карточка принимает и показывает название дня', () => {
    expect(card).toContain('previewDayLabel?: string | null');
    expect(card).toContain("previewDayLabel ? `«${previewDayLabel}»` : 'первом дне недели'");
    expect(card).toContain('Плеер применит это к тому дню, который открыт');
  });

  it('план передаёт день, с которого откроется плеер', () => {
    expect(view).toContain('previewDayLabel={playerDays?.[0]?.label ?? null}');
  });
});

describe('P2-12 / P2-20: мёртвый код PLPlanView убран', () => {
  const src = read('src/ui/screens/SRCBBScreen_parts/PLPlanView.tsx');
  const screen = read('src/ui/screens/SRCBBScreen.tsx');

  it('нет неиспользуемого setSummary и мёртвых меток дневника', () => {
    expect(src).not.toContain('const setSummary =');
    expect(src).not.toContain('adjustedMark');
  });

  it('второго (недостижимого) списка добавлений нет', () => {
    const maps = src.split('(srcAdditions[dk] || []).map(').length - 1;
    expect(maps).toBe(1);
  });

  it('PLPlanView не принимает setBuiltSrc/buildSrc', () => {
    expect(src).not.toMatch(/^\s+setBuiltSrc: \(p: LMSBuildOutput\) => void;$/m);
    expect(src).not.toMatch(/^\s+buildSrc: \(\) => void;$/m);
    const start = screen.indexOf('<PLPlanView');
    const end = screen.indexOf('/>', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const call = screen.slice(start, end);
    expect(call).not.toContain('setBuiltSrc');
    expect(call).not.toContain('buildSrc');
  });
});

describe('P2-7 / P2-8 / P3: мёртвые сущности удалены', () => {
  it('карты федераций больше не дублируются', () => {
    const engine = read('src/engines/lms/pl-norms-bridge.engine.ts');
    expect(engine).not.toContain('PL_FED_TO_NORMS');
    expect(engine).not.toContain('PL_FED_NORMS_LABEL');
    expect(engine).toContain('resolveNormsFederation');
  });

  it('мёртвая пара warmupQuality удалена из плеера', () => {
    expect(read('src/ui/screens/SRCBBScreen_parts/SessionPlayer.tsx')).not.toContain('warmupQuality');
  });

  it('мёртвые экспорты PL-слоя удалены', () => {
    expect(read('src/engines/lms/pl-set-video.engine.ts')).not.toContain('PL_VIDEO_NOTES');
    expect(read('src/engines/lms/pl-peak-cycle-taper.engine.ts')).not.toContain('PeakTaperMode');
  });

  it('const cyc в PLCompetitionTab остаётся — из него берутся поля цикла', () => {
    // Аудит P2-20 называл его мёртвым, но это ложное срабатывание: поля
    // читаются деструктуризацией `} = cyc;`.
    const tab = read('src/ui/screens/SRCBBScreen_parts/PLCompetitionTab.tsx');
    expect(tab).toContain('const cyc = api.cycle;');
    expect(tab).toContain('} = cyc;');
  });
});

describe('P3: скрытые мины PL/BB-слоя', () => {
  const screen = read('src/ui/screens/SRCBBScreen.tsx');

  it('he_bb_session пересохраняется при правке bbWorkMax', () => {
    const i = screen.indexOf('JSON.stringify({ bbLevel, bbGoal');
    expect(i).toBeGreaterThan(0);
    // Ключ he_bb_session пишется парой строк выше.
    expect(screen.slice(i - 80, i)).toContain("'he_bb_session'");
    const depsStart = screen.indexOf('}, [', i);
    const depsEnd = screen.indexOf(']);', depsStart);
    const deps = screen.slice(depsStart, depsEnd);
    expect(deps).toContain('bbWorkMax');
  });

  it('множитель топ-сета при faithful:false не применяется дважды', () => {
    const builder = read('src/engines/lms/lms-builder.engine.ts');
    expect(builder).toContain('baseWeight * (faithful ? arTopMult : 1) * dupWtMult');
  });
});
