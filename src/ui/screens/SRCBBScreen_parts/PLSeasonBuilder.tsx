/**
 * PLSeasonBuilder.tsx — ПЛ-сезон по микроциклам (задачи 1+2 плана).
 *
 * Карточка в шаге «1 ⚙️ Настройки» ПЛ-авто:
 *  - режим «🎯 Одиночный цикл» / «🧩 Сезон по микроциклам» (сохраняется в he_pl_session);
 *  - 4 периода-слота (выносливость/сила/скорость/пик) с редактируемыми неделями;
 *  - АВТО: лучший подходящий цикл на каждый слот (candidateCyclesForSlot + fitCycleToWeeks);
 *  - РУЧНОЙ: выбор цикла из подходящих в базе на каждый слот;
 *  - «🏁 Циклы между соревнованиями»: авто/ручной выбор цикла на каждый пролёт + ужатие
 *    цикла под окно + пик/тапер у каждого старта (buildPLSeasonPeaks).
 *  - ЛЮБОЕ ИЗМЕНЕНИЕ РАСКЛАДКИ — ТОЛЬКО ПО СОГЛАСИЮ (needsConsent + consents).
 *
 * Чистый UI-слой: вся логика выбора/сборки — в движках lms-season / lms-comp-gap.
 */
import React, { useMemo, useState } from 'react';
import {
  buildDefaultSeasonSlots,
  createSeasonSlot,
  planSeason,
  assembleSeasonPlan,
  seasonSegmentSummary,
  clampSlotWeeks,
  candidateCyclesForSlot,
  fitCycleToWeeks,
  applyFitConsent,
  type PLSeasonSlot,
  type PLSeasonPeriod,
  type PLSeasonPlan,
} from '../../../engines/lms/lms-season.engine';
import {
  planBetweenCompetitions,
  type CompGapBuildOptions,
} from '../../../engines/lms/lms-comp-gap.engine';
import type { LMSRankedCycle, LMSSelectorInput } from '../../../engines/lms/lms-selector.engine';
import type { LMSBuildOutput, LMSPlanWeek } from '../../../engines/lms/lms-builder.engine';
import type { PLSeasonMeet, MacroTaperOpts } from '../../../engines/lms/lms-macro-taper.engine';
import { LMS_CYCLES, normalizeCycleDirection } from '../../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import { calcCycleMetrics, type SRExercise } from '../../../engines/lms/lms-metrics.engine';

const ALL_PL_CYCLES = LMS_CYCLES.filter(c => normalizeCycleDirection(c.meta.direction) !== 'bodybuilding');

/** Агрегированные метрики сезона (тот же расчёт, что в buildLMSPlan/PLCompetitionTab). */
function seasonCycleMetrics(weeks: LMSPlanWeek[]) {
  const exercises = weeks.flatMap(wk => wk.days.map(d => d.exercises.map(ex => ({
    name: ex.name, group: ex.group, coef: ex.coef, mnosz: ex.mnosz, pm: ex.pm,
    sets: ex.workSets.map(s => ({ weight: s.weight, reps: s.reps, sets: s.sets })),
  } as SRExercise))));
  return calcCycleMetrics(exercises);
}

export interface PLSeasonBuilderProps {
  selector: LMSSelectorInput;
  meets: PLSeasonMeet[];                     // соревнования сезона (meetList)
  taper: {
    mode?: MacroTaperOpts['mode'];
    weightGoal?: MacroTaperOpts['weightGoal'];
    strategy?: MacroTaperOpts['strategy'];
    mockMeet?: boolean;
    postMeet?: boolean;
    windowWeeks?: number;                    // weeksToMeet
  };
  buildOpts: Omit<CompGapBuildOptions, 'selector' | 'meets' | 'mode' | 'selections' | 'taper'>;
  /** Управляемый режим (из родителя SRCBBScreen — вкладка «План» скрывает каталог одиночного цикла). */
  mode?: 'single' | 'season';
  onModeChange?: (m: 'single' | 'season') => void;
  onBuilt: (out: LMSBuildOutput | null, notes: string[], segments: SeasonBuildInfo[]) => void;
  onNavigatePlan: () => void;
}

/** Компактная сводка выбранных циклов сезона (для вкладки «План» и печати). */
export interface SeasonBuildInfo {
  cycleTitle: string;
  weeks: number;       // фактическая длина в сезоне (после ужатия/растяжения)
  cycleWeeks: number;  // исходная длина выбранного цикла
  fitMode: 'exact' | 'proposed_extend' | 'proposed_shrink' | 'strict_skip' | 'extend' | 'shrink' | 'skip';
  periodLabel?: string; // метка периода/пролёта
  needsConsent?: boolean;
}

const PERIOD_ICON: Record<string, string> = {
  endurance: '🏃', strength: '💪', speed: '⚡', peak: '🎯',
};

const btnMini: React.CSSProperties = {
  padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 10,
  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: '#fff',
};
const segBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: 10,
  border: active ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
  background: active ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.03)',
  color: active ? '#c4b5fd' : '#fff',
});
const selStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, color: '#fff', padding: '4px 6px', fontSize: 11, minHeight: 32,
};
const consentBtnOk: React.CSSProperties = {
  padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 10,
  border: '1px solid #22c55e', background: 'rgba(34,197,94,0.15)', color: '#22c55e',
};
const consentBtnNo: React.CSSProperties = {
  padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 10,
  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff',
};

export const PLSeasonBuilder: React.FC<PLSeasonBuilderProps> = ({ selector, meets, taper, buildOpts, mode, onModeChange, onBuilt, onNavigatePlan }) => {
  const [localMode, setLocalMode] = useState<'single' | 'season'>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('he_pl_session') || '{}').season;
      return s && s.mode === 'season' ? 'season' : 'single';
    } catch { return 'single'; }
  });
  const seasonMode = mode ?? localMode;
  const setSeasonMode = (m: 'single' | 'season') => {
    if (mode != null) { onModeChange?.(m); }
    else { setLocalMode(m); }
    saveSeasonStateValue(m, undefined, undefined, undefined, undefined, undefined, undefined);
  };
  const [slots, setSlots] = useState<PLSeasonSlot[]>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('he_pl_session') || '{}').season;
      if (s && Array.isArray(s.slots) && s.slots.length > 0) {
        return buildDefaultSeasonSlots().map((d, i) => {
          const saved = s.slots[i];
          if (!saved) return d;
          return { ...d, weeks: clampSlotWeeks(d, saved.weeks), enabled: saved.enabled !== false };
        });
      }
    } catch { /* ignore */ }
    return buildDefaultSeasonSlots();
  });
  const [pickMode, setPickMode] = useState<'auto' | 'manual'>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('he_pl_session') || '{}').season;
      return s && s.pickMode === 'manual' ? 'manual' : 'auto';
    } catch { return 'auto'; }
  });
  const [selections, setSelections] = useState<Record<number, string>>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('he_pl_session') || '{}').season;
      return s && typeof s.selections === 'object' && s.selections ? { ...s.selections } : {};
    } catch { return {}; }
  });
  const [consents, setConsents] = useState<Record<number, boolean>>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('he_pl_session') || '{}').season;
      if (s && typeof s.consents === 'object' && s.consents) return { ...s.consents };
      // legacy: строгая совместимость — если нет consents, считаем все false (требует согласия)
      return {};
    } catch { return {}; }
  });
  const [compPickMode, setCompPickMode] = useState<'auto' | 'manual'>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('he_pl_session') || '{}').season;
      return s && s.compPickMode === 'manual' ? 'manual' : 'auto';
    } catch { return 'auto'; }
  });
  const [compSelections, setCompSelections] = useState<Record<number, string>>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('he_pl_session') || '{}').season;
      const v = s?.compSelections ?? s?.compGaps?.selections;
      return v && typeof v === 'object' ? { ...v } : {};
    } catch { return {}; }
  });
  const [compConsents, setCompConsents] = useState<Record<number, boolean>>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('he_pl_session') || '{}').season;
      const v = s?.compConsents ?? s?.compGaps?.consents;
      return v && typeof v === 'object' ? { ...v } : {};
    } catch { return {}; }
  });

  const enabledSlots = useMemo(() => slots.filter(s => s.enabled), [slots]);

  const slotCandidates = useMemo(() => enabledSlots.map(s => candidateCyclesForSlot(s, selector)), [enabledSlots, selector]);

  // Единая сборка taper-опций для buildPLSeasonPeaks (и пролёты, и одиночный старт).
  const taperOpts = useMemo<MacroTaperOpts>(() => ({
    mode: taper.mode,
    weightGoal: taper.weightGoal === 'auto' ? undefined : taper.weightGoal,
    strategy: taper.strategy,
    mockMeet: taper.mockMeet,
    postMeet: taper.postMeet,
    windowWeeks: taper.windowWeeks ?? 2,
  }), [taper.mode, taper.weightGoal, taper.strategy, taper.mockMeet, taper.postMeet, taper.windowWeeks]);

  const seasonPlan: PLSeasonPlan = useMemo(() => {
    if (seasonMode !== 'season' || enabledSlots.length === 0) {
      return { segments: [], totalWeeks: 0, notes: [], cycleIds: [] };
    }
    return planSeason({ slots: enabledSlots, selector, mode: pickMode, selections, consents });
  }, [seasonMode, enabledSlots, selector, pickMode, selections, consents]);

  const compGap = useMemo(() => {
    if (seasonMode !== 'season' || meets.length < 2) return null;
    try {
      return planBetweenCompetitions(meets, {
        ...buildOpts,
        selector,
        mode: compPickMode,
        selections: compSelections,
        consents: compConsents,
        taper: taperOpts,
      });
    } catch { return null; }
  }, [seasonMode, meets, compPickMode, compSelections, compConsents, selector, buildOpts, taperOpts]);

  const setSlotWeeks = (idx: number, weeks: number) => {
    setSlots(prev => prev.map((s, i) => (i === idx ? { ...s, weeks: clampSlotWeeks(s, weeks) } : s)));
  };

  const toggleSlot = (idx: number) => {
    setSlots(prev => prev.map((s, i) => (i === idx ? { ...s, enabled: !s.enabled } : s)));
  };

  const moveSlot = (idx: number, dir: -1 | 1) => {
    setSlots(prev => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx]; next[idx] = next[j]; next[j] = tmp;
      return next;
    });
  };

  const addSlot = (period: PLSeasonPeriod) => {
    const next = [...slots, createSeasonSlot(period)];
    setSlots(next);
    // сброс consents/selections чтобы не съехали индексы
    const clearedConsents: Record<number, boolean> = {};
    const clearedSelections: Record<number, string> = {};
    setConsents(clearedConsents);
    setSelections(clearedSelections);
    saveSeasonStateValue(seasonMode, next, undefined, clearedSelections, clearedConsents);
  };

  const removeSlot = (idx: number) => {
    if (slots.length <= 1) return;
    const next = slots.filter((_, i) => i !== idx);
    setSlots(next);
    setConsents({});
    setSelections({});
    saveSeasonStateValue(seasonMode, next, undefined, {}, {});
  };

  const saveSeasonStateValue = (
    m: 'single' | 'season' = seasonMode,
    slotsOverride?: PLSeasonSlot[],
    pickModeOverride?: 'auto' | 'manual',
    selectionsOverride?: Record<number, string>,
    consentsOverride?: Record<number, boolean>,
    compPickModeOverride?: 'auto' | 'manual',
    compSelectionsOverride?: Record<number, string>,
    compConsentsOverride?: Record<number, boolean>,
  ) => {
    try {
      const cur = JSON.parse(localStorage.getItem('he_pl_session') || '{}');
      const curSeason = cur.season ?? {};
      localStorage.setItem('he_pl_session', JSON.stringify({
        ...cur,
        season: {
          mode: m,
          slots: slotsOverride ?? slots,
          pickMode: pickModeOverride ?? pickMode,
          selections: selectionsOverride ?? selections,
          consents: consentsOverride ?? consents,
          compPickMode: compPickModeOverride ?? compPickMode,
          compSelections: compSelectionsOverride ?? compSelections,
          compConsents: compConsentsOverride ?? compConsents,
          // legacy duplicate for backward compat with older readers
          compGaps: {
            mode: compPickModeOverride ?? compPickMode,
            selections: compSelectionsOverride ?? compSelections,
            consents: compConsentsOverride ?? compConsents,
          },
        },
      }));
    } catch { /* ignore */ }
  };

  const saveSeasonState = () => saveSeasonStateValue(seasonMode);

  const hasBlockedSegments = seasonPlan.segments.some(s => s.fit.mode === 'strict_skip') || (compGap?.segments.some(s => s.fitMode === 'strict_skip' && s.needsConsent) ?? false);

  const buildSeason = () => {
    try {
      const useGaps = meets.length >= 2 && compGap && compGap.segments.length > 0;
      const notes: string[] = [];
      let out: LMSBuildOutput | null = null;
      const buildInfo: SeasonBuildInfo[] = [];
      if (useGaps) {
        // Если есть заблокированные пролёты — блокируем сборку
        const blockedGaps = compGap!.segments.filter(s => s.fitMode === 'strict_skip' && s.needsConsent);
        if (blockedGaps.length > 0) {
          onBuilt(null, [`⛔ Сборка заблокирована: ${blockedGaps.length} пролёт(ов) требуют согласия на изменение раскладки — подтвердите или выберите другой цикл.`], []);
          return;
        }
        // compGap.weeks уже включает пик-блоки (buildPLSeasonPeaks) — используем напрямую.
        notes.push(...compGap!.notes);
        const firstCycle = compGap!.segments[0]?.fittedCycle ?? compGap!.segments[0]?.candidates[0]?.cycle;
        if (!firstCycle) {
          onBuilt(null, ['⚠ Нет подходящих циклов для пролётов — проверьте выбор.'], []);
          return;
        }
        // Проверяем также сезонные слоты на блокировку
        const blockedSeason = seasonPlan.segments.filter(s => s.fit.mode === 'strict_skip');
        if (blockedSeason.length > 0) {
          onBuilt(null, [`⛔ Сборка заблокирована: ${blockedSeason.length} слот(ов) требуют согласия.`], []);
          return;
        }
        out = {
          template: firstCycle as LMSBuildOutput['template'],
          progressionRationale: notes.join('\n'),
          weeks: compGap!.weeks,
          cycleMetrics: seasonCycleMetrics(compGap!.weeks),
        };
        compGap!.segments.forEach(seg => {
          buildInfo.push({
            cycleTitle: seg.cycleTitle || 'Нет цикла',
            weeks: seg.fitWeeks ?? 0,
            cycleWeeks: seg.cycleWeeks,
            fitMode: seg.fitMode as SeasonBuildInfo['fitMode'],
            periodLabel: `Пролёт к «${seg.meetName}»`,
            needsConsent: seg.needsConsent,
          });
        });
      } else if (seasonPlan.segments.length > 0) {
        const blocked = seasonPlan.segments.filter(s => s.fit.mode === 'strict_skip');
        if (blocked.length > 0) {
          onBuilt(null, [`⛔ Сборка заблокирована: ${blocked.length} слот(ов) требуют согласия на изменение раскладки — подтвердите или выберите другой цикл.`], []);
          return;
        }
        out = assembleSeasonPlan(seasonPlan, {
          ...buildOpts,
          mode: (buildOpts as unknown as { progressionMode?: string }).progressionMode as unknown as typeof buildOpts.progressionMode ?? (buildOpts as unknown as { mode?: string }).mode as unknown as typeof buildOpts.progressionMode,
          meets: meets.length ? meets : undefined,
          taper: taperOpts,
        } as unknown as Parameters<typeof assembleSeasonPlan>[1]);
        notes.push(...seasonPlan.notes);
        out = { ...out, cycleMetrics: seasonCycleMetrics(out.weeks) };
        seasonPlan.segments.forEach(seg => {
          const orig = LMS_CYCLES.find(c => c.meta.id === seg.cycleId)?.meta.weeks ?? seg.weeks;
          buildInfo.push({
            cycleTitle: seg.cycleTitle,
            weeks: seg.weeks,
            cycleWeeks: orig,
            fitMode: seg.fit.mode as SeasonBuildInfo['fitMode'],
            periodLabel: seg.slot.label,
            needsConsent: seg.fit.needsConsent,
          });
        });
      }
      if (!out) {
        onBuilt(null, ['⚠ Сезон пуст — включите хотя бы один период или добавьте соревнования.'], []);
        return;
      }
      // Фильтруем заблокированные (weeks=0) из итоговых — они уже заблокировали выше, но на всякий случай
      onBuilt(out, notes, buildInfo);
      onNavigatePlan();
    } catch (e) {
      onBuilt(null, ['⚠ Ошибка сборки сезона: ' + (e as Error).message], []);
    }
  };

  const slotSummary = seasonSegmentSummary(seasonPlan.segments);

  const renderConsentForSlot = (slot: PLSeasonSlot, idx: number) => {
    const candidates = slotCandidates[idx] ?? [];
    const chosenId = pickMode === 'manual' ? (selections[idx] ?? '') : (seasonPlan.segments[idx]?.cycleId ?? '');
    const chosen = candidates.find(c => c.cycle.meta.id === chosenId) ?? candidates[0];
    if (!chosen || !slot.enabled) return null;
    const raw = fitCycleToWeeks(chosen.cycle, slot.weeks);
    if (!raw.needsConsent) return null;
    const consented = consents[idx] === true;
    const orig = raw.cycle.meta.weeks;
    // raw уже содержит предложение; показываем диалог только если needsConsent
    // seasonPlan уже применил consents, поэтому проверяем raw, а не seasonPlan
    return (
      <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: consented ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.08)', border: consented ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.3)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: consented ? '#22c55e' : '#ef4444', marginBottom: 4 }}>
          {consented ? `✓ Согласие дано: ${raw.mode === 'proposed_shrink' ? `сжать ${orig}→${slot.weeks}` : `растянуть ${orig}→${slot.weeks}`} по согласию` : `⚠️ Требуется согласие: цикл «${chosen.cycle.meta.title}» ${orig} нед не влезает в окно ${slot.weeks} нед`}
        </div>
        <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4, marginBottom: 6 }}>
          Предложение: {raw.notes.join(' · ')}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!consented ? (
            <>
              <button
                onClick={() => {
                  const next = { ...consents, [idx]: true };
                  setConsents(next);
                  saveSeasonStateValue(seasonMode, undefined, undefined, undefined, next);
                }}
                style={consentBtnOk}
              >✓ Согласен, применить {orig}→{slot.weeks}</button>
              <button
                onClick={() => {
                  const next = { ...consents, [idx]: false };
                  setConsents(next);
                  saveSeasonStateValue(seasonMode, undefined, undefined, undefined, next);
                }}
                style={consentBtnNo}
              >✕ Оставить как есть 1:1</button>
              <button
                onClick={() => {
                  setPickMode('manual');
                  saveSeasonStateValue(seasonMode, undefined, 'manual');
                }}
                style={consentBtnNo}
              >🔄 Выбрать другой цикл</button>
            </>
          ) : (
            <button
              onClick={() => {
                const next = { ...consents, [idx]: false };
                setConsents(next);
                saveSeasonStateValue(seasonMode, undefined, undefined, undefined, next);
              }}
              style={consentBtnNo}
            >↩ Отозвать согласие</button>
          )}
        </div>
      </div>
    );
  };

  const renderSlot = (slot: PLSeasonSlot, idx: number) => {
    const candidates = slotCandidates[idx] ?? [];
    const chosenId = pickMode === 'manual' ? (selections[idx] ?? '') : (seasonPlan.segments[idx]?.cycleId ?? '');
    const chosen = candidates.find(c => c.cycle.meta.id === chosenId) ?? candidates[0];
    const seg = seasonPlan.segments[idx];
    const isBlocked = seg?.fit.mode === 'strict_skip';
    return (
      <div key={idx} style={{ padding: 8, borderRadius: 10, background: isBlocked ? 'rgba(239,68,68,0.04)' : slot.enabled ? 'rgba(0,230,138,0.04)' : 'rgba(255,255,255,0.02)', border: isBlocked ? '1px solid rgba(239,68,68,0.3)' : slot.enabled ? '1px solid rgba(0,230,138,0.18)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12 }}>{PERIOD_ICON[slot.period]}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{slot.label}</span>
          <span style={{ fontSize: 10, color: '#fff' }}>({slot.weeksMin}–{slot.weeksMax} нед)</span>
          {isBlocked && <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: 6 }}>⛔ Требует согласия</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            <button onClick={() => moveSlot(idx, -1)} title="Переместить раньше" aria-label="Переместить слот раньше" style={{ ...btnMini }}>◀</button>
            <button onClick={() => moveSlot(idx, 1)} title="Переместить позже" aria-label="Переместить слот позже" style={{ ...btnMini }}>▶</button>
            <button onClick={() => toggleSlot(idx)} title={slot.enabled ? 'Отключить период' : 'Включить период'} aria-label={slot.enabled ? 'Отключить период' : 'Включить период'} style={{ ...btnMini, border: slot.enabled ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.2)', color: slot.enabled ? '#00e68a' : '#fff' }}>{slot.enabled ? '✓' : '○'}</button>
            {slots.length > 1 && <button onClick={() => removeSlot(idx)} title="Удалить слот" aria-label="Удалить слот" style={{ ...btnMini, color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>✕</button>}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'center' }}>
          <div style={{ fontSize: 10, color: '#fff' }}>Недель в периоде</div>
          <input
            type="number" min={slot.weeksMin} max={slot.weeksMax} value={slot.weeks} disabled={!slot.enabled}
            onChange={e => setSlotWeeks(idx, Number(e.target.value))}
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 12 }}
          />
        </div>
        {slot.enabled && pickMode === 'manual' && (
          <select
            value={chosenId}
            onChange={e => {
              const next = { ...selections, [idx]: e.target.value };
              setSelections(next);
              // сбрасываем согласие при смене цикла
              const nextConsents = { ...consents, [idx]: false };
              setConsents(nextConsents);
              saveSeasonStateValue(seasonMode, undefined, undefined, next, nextConsents);
            }}
            style={selStyle}
            aria-label={`Выбор цикла для периода «${slot.label}»`}
          >
            {candidates.length === 0 && <option value="">Нет подходящих циклов в базе</option>}
            {candidates.map(c => (
              <option key={c.cycle.meta.id} value={c.cycle.meta.id}>
                {c.cycle.meta.title} · {c.cycle.meta.level} · {c.cycle.meta.weeks} нед
              </option>
            ))}
          </select>
        )}
        {slot.enabled && chosen && (
          <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.5, color: '#fff' }}>
            {isBlocked ? <b style={{ color: '#ef4444' }}>⛔ Требует согласия: </b> : pickMode === 'auto' ? <b style={{ color: '#00e68a' }}>🏆 Рекомендован: </b> : <b style={{ color: '#60a5fa' }}>Выбран: </b>}
            {chosen.cycle.meta.title}
            <span style={{ display: 'block', color: '#fff' }}>
              {seg ? seg.fit.notes.join(' · ') : chosen.rationale.join(' · ')}
            </span>
            {seg && seg.fit.mode !== 'strict_skip' && seg.fit.mode !== 'exact' && !seg.fit.needsConsent && (
              <span style={{ display: 'block', color: '#22c55e', fontWeight: 700 }}>⬇ сжат по согласию {seg.fit.notes[0] ?? ''}</span>
            )}
          </div>
        )}
        {renderConsentForSlot(slot, idx)}
      </div>
    );
  };

  const renderCompGap = () => {
    if (seasonMode !== 'season' || meets.length < 2 || !compGap) return null;
    return (
      <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 6 }}>🏁 Циклы между соревнованиями</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <button onClick={() => { setCompPickMode('auto'); saveSeasonStateValue(seasonMode, undefined, undefined, undefined, undefined, 'auto'); }} style={segBtn(compPickMode === 'auto')}>🤖 Авто-подбор</button>
          <button onClick={() => { setCompPickMode('manual'); saveSeasonStateValue(seasonMode, undefined, undefined, undefined, undefined, 'manual'); }} style={segBtn(compPickMode === 'manual')}>👆 Выбрать вручную</button>
        </div>
        {compGap.segments.map((seg, i) => {
          const isBlocked = seg.fitMode === 'strict_skip' && seg.needsConsent;
          const rawChosen = seg.candidates.find(c => c.cycle.meta.id === seg.cycleId) ?? seg.candidates[0];
          const needsConsentRaw = rawChosen ? fitCycleToWeeks(rawChosen.cycle, seg.availableWeeks).needsConsent : false;
          return (
          <div key={i} style={{ padding: 8, marginBottom: 6, borderRadius: 8, background: isBlocked ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)', border: isBlocked ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: isBlocked ? '#ef4444' : '#fbbf24', marginBottom: 4 }}>
              {seg.meetName} (нед {seg.meetWeek}) · окно {seg.availableWeeks} нед · тапер {seg.taperWeeks} нед{taper.postMeet ? ' + пост' : ''} {isBlocked && <span style={{ background: 'rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: 6 }}>⛔ Требует согласия</span>}
            </div>
            {compPickMode === 'manual' && (
              <>
                <select
                  value={seg.cycleId}
                  onChange={e => {
                    const next = { ...compSelections, [i]: e.target.value };
                    setCompSelections(next);
                    const nextCons = { ...compConsents, [i]: false };
                    setCompConsents(nextCons);
                    saveSeasonStateValue(seasonMode, undefined, undefined, undefined, undefined, undefined, next, nextCons);
                  }}
                  style={selStyle}
                  aria-label={`Выбор цикла для пролёта к «${seg.meetName}»`}
                >
                  {seg.candidates.length === 0 && <option value="">Нет подходящих — выберите из каталога</option>}
                  {seg.candidates.map(c => (
                    <option key={c.cycle.meta.id} value={c.cycle.meta.id}>
                      {c.cycle.meta.title} · {c.cycle.meta.level} · {c.cycle.meta.weeks} нед
                    </option>
                  ))}
                </select>
                {seg.candidates.length === 0 && (
                  <select
                    value={seg.cycleId}
                    onChange={e => {
                      const next = { ...compSelections, [i]: e.target.value };
                      setCompSelections(next);
                      const nextCons = { ...compConsents, [i]: false };
                      setCompConsents(nextCons);
                      saveSeasonStateValue(seasonMode, undefined, undefined, undefined, undefined, undefined, next, nextCons);
                    }}
                    style={{ ...selStyle, marginTop: 4, borderColor: 'rgba(245,158,11,0.4)' }}
                    aria-label={`Любой цикл из каталога для пролёта к «${seg.meetName}»`}
                  >
                    <option value="">Любой цикл из каталога…</option>
                    {ALL_PL_CYCLES.map(c => (
                      <option key={c.meta.id} value={c.meta.id}>
                        {c.meta.title} · {c.meta.level} · {c.meta.weeks} нед
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
            <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.5 }}>
              {seg.cycleId
                ? <>Цикл: <b>{seg.cycleTitle}</b> ({seg.cycleWeeks} нед) → {seg.fitMode === 'skip' ? 'только старт' : seg.fitMode === 'strict_skip' ? <span style={{ color: '#ef4444', fontWeight: 700 }}>⛔ без согласия — пропущен</span> : `${seg.fitWeeks} нед`}
                  {seg.fitMode === 'proposed_shrink' && !seg.needsConsent && <span style={{ color: '#22c55e', fontWeight: 700 }}> · ⬇ сжат по согласию {seg.cycleWeeks}→{seg.fitWeeks}</span>}
                  {seg.fitMode === 'proposed_extend' && !seg.needsConsent && <span style={{ color: '#22c55e', fontWeight: 700 }}> · ⬆ растянут по согласию</span>}
                  {seg.needsConsent && seg.fitMode !== 'strict_skip' && <span style={{ color: '#f59e0b', fontWeight: 700 }}> · ⬇ предлагается сжать {seg.cycleWeeks}→{seg.fitWeeks}</span>}
                  {seg.fitMode === 'exact' && <span style={{ color: '#22c55e', fontWeight: 700 }}> · ✓ точно</span>}
                </>
                : 'Поддерживающий объём (последняя неделя цикла)'}
              {seg.notes.slice(1).map((n, ni) => <span key={ni} style={{ display: 'block', color: '#fff' }}>{n}</span>)}
            </div>
            {needsConsentRaw && seg.needsConsent && (
              <div style={{ marginTop: 6, padding: 8, borderRadius: 8, background: compConsents[i] === true ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.08)', border: compConsents[i] === true ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.3)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: compConsents[i] === true ? '#22c55e' : '#ef4444', marginBottom: 4 }}>
                  {compConsents[i] === true ? `✓ Согласие дано: ${seg.cycleWeeks}→${seg.availableWeeks} по согласию` : `⚠️ Требуется согласие: ${seg.cycleWeeks} нед не влезает в окно ${seg.availableWeeks} нед`}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {compConsents[i] !== true ? (
                    <>
                      <button
                        onClick={() => {
                          const next = { ...compConsents, [i]: true };
                          setCompConsents(next);
                          saveSeasonStateValue(seasonMode, undefined, undefined, undefined, undefined, undefined, undefined, next);
                        }}
                        style={consentBtnOk}
                      >✓ Согласен, применить {seg.cycleWeeks}→{seg.availableWeeks}</button>
                      <button
                        onClick={() => {
                          const next = { ...compConsents, [i]: false };
                          setCompConsents(next);
                          saveSeasonStateValue(seasonMode, undefined, undefined, undefined, undefined, undefined, undefined, next);
                        }}
                        style={consentBtnNo}
                      >✕ Оставить как есть</button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        const next = { ...compConsents, [i]: false };
                        setCompConsents(next);
                        saveSeasonStateValue(seasonMode, undefined, undefined, undefined, undefined, undefined, undefined, next);
                      }}
                      style={consentBtnNo}
                    >↩ Отозвать согласие</button>
                  )}
                </div>
              </div>
            )}
          </div>
        );})}
        <div style={{ fontSize: 10, color: '#fff' }}>Итого: {compGap.totalPlanWeeks} нед плана, у каждого старта пик-блок (вход в пик + mock + тапер + старт{taper.postMeet ? ' + пост' : ''}).</div>
      </div>
    );
  };

  return (
    <div className="pl-season" style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>🧩 Сезон по микроциклам</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => { setSeasonMode('single'); saveSeasonStateValue('single'); }} style={segBtn(seasonMode === 'single')}>🎯 Одиночный цикл</button>
          <button onClick={() => { setSeasonMode('season'); saveSeasonStateValue('season'); }} style={segBtn(seasonMode === 'season')}>🧩 Сезон</button>
        </div>
      </div>

      {seasonMode === 'season' && (
        <>
          <div style={{ fontSize: 10, color: '#fff', marginBottom: 6 }}>
            Периоды-микроциклы: выносливость 6–20 · сила 6–12 · скорость/координация 6–10 · пик 8–10 нед.
            Включите нужные, задайте недели, порядок. Авто-подбор подберёт лучший цикл под каждый период. <b style={{ color: '#f59e0b' }}>Любое изменение раскладки — только по вашему согласию.</b>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 8 }}>
            {slots.map((slot, idx) => renderSlot(slot, idx))}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: '#fff', alignSelf: 'center' }}>＋ Добавить период:</span>
            <button onClick={() => addSlot('endurance')} style={btnMini}>🏃 Выносливость</button>
            <button onClick={() => addSlot('strength')} style={btnMini}>💪 Сила</button>
            <button onClick={() => addSlot('speed')} style={btnMini}>⚡ Скорость</button>
            <button onClick={() => addSlot('peak')} style={btnMini}>🎯 Пик</button>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', alignSelf: 'center' }}>(дубль — напр. сила→скорость→сила)</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={() => { setPickMode('auto'); saveSeasonStateValue(seasonMode, undefined, 'auto'); }} style={segBtn(pickMode === 'auto')}>🤖 Авто-подбор циклов</button>
            <button onClick={() => { setPickMode('manual'); saveSeasonStateValue(seasonMode, undefined, 'manual'); }} style={segBtn(pickMode === 'manual')}>👆 Выбрать вручную</button>
          </div>
          {pickMode === 'manual' && seasonPlan.segments.length === 0 && (
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 6 }}>Включите хотя бы один период, чтобы выбрать для него цикл.</div>
          )}
          {slotSummary && <div style={{ fontSize: 10, color: '#fff', marginBottom: 8 }}>📅 Сезон: {slotSummary}</div>}
          {hasBlockedSegments && (
            <div style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
              ⛔ Сборка заблокирована: {seasonPlan.segments.filter(s => s.fit.mode === 'strict_skip').length + (compGap?.segments.filter(s => s.fitMode === 'strict_skip' && s.needsConsent).length ?? 0)} сегмент(ов) требуют согласия. Подтвердите изменения или выберите другой цикл.
            </div>
          )}
          {renderCompGap()}
          <button
            onClick={() => { saveSeasonState(); buildSeason(); }}
            disabled={hasBlockedSegments}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: hasBlockedSegments ? 'not-allowed' : 'pointer', background: hasBlockedSegments ? 'rgba(100,100,100,0.3)' : 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 12, minHeight: 44, opacity: hasBlockedSegments ? 0.6 : 1 }}
          >{hasBlockedSegments ? '⛔ Требуется согласие — подтвердите изменения' : '🧩 Собрать сезон и перейти к плану →'}</button>
        </>
      )}
    </div>
  );
};

export default PLSeasonBuilder;
