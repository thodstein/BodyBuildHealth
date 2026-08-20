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
 *
 * Чистый UI-слой: вся логика выбора/сборки — в движках lms-season / lms-comp-gap.
 */
import React, { useMemo, useState } from 'react';
import {
  buildDefaultSeasonSlots,
  planSeason,
  assembleSeasonPlan,
  seasonSegmentSummary,
  clampSlotWeeks,
  candidateCyclesForSlot,
  type PLSeasonSlot,
  type PLSeasonPlan,
} from '../../../engines/lms/lms-season.engine';
import {
  planBetweenCompetitions,
  type CompGapBuildOptions,
} from '../../../engines/lms/lms-comp-gap.engine';
import type { LMSRankedCycle, LMSSelectorInput } from '../../../engines/lms/lms-selector.engine';
import type { LMSBuildOutput } from '../../../engines/lms/lms-builder.engine';
import type { PLSeasonMeet, MacroTaperOpts } from '../../../engines/lms/lms-macro-taper.engine';
import { LMS_CYCLES, normalizeCycleDirection } from '../../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

const ALL_PL_CYCLES = LMS_CYCLES.filter(c => normalizeCycleDirection(c.meta.direction) !== 'bodybuilding');

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
  onBuilt: (out: LMSBuildOutput | null, notes: string[]) => void;
  onNavigatePlan: () => void;
}

const PERIOD_ICON: Record<string, string> = {
  endurance: '🏃', strength: '💪', speed: '⚡', peak: '🎯',
};

const btnMini: React.CSSProperties = {
  padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 10,
  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.7)',
};
const segBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontWeight: 700, fontSize: 10,
  border: active ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
  background: active ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.03)',
  color: active ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
});
const selStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, color: '#fff', padding: '4px 6px', fontSize: 11, minHeight: 32,
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
    saveSeasonStateValue(m);
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
  const [pickMode, setPickMode] = useState<'auto' | 'manual'>('auto');
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [compPickMode, setCompPickMode] = useState<'auto' | 'manual'>('auto');
  const [compSelections, setCompSelections] = useState<Record<number, string>>({});

  const enabledSlots = useMemo(() => slots.filter(s => s.enabled), [slots]);

  const slotCandidates = useMemo(() => enabledSlots.map(s => candidateCyclesForSlot(s, selector)), [enabledSlots, selector]);

  const seasonPlan: PLSeasonPlan = useMemo(() => {
    if (seasonMode !== 'season' || enabledSlots.length === 0) {
      return { segments: [], totalWeeks: 0, notes: [], cycleIds: [] };
    }
    return planSeason({ slots: enabledSlots, selector, mode: pickMode, selections });
  }, [seasonMode, enabledSlots, selector, pickMode, selections]);

  const compGap = useMemo(() => {
    if (seasonMode !== 'season' || meets.length < 2) return null;
    try {
      return planBetweenCompetitions(meets, {
        ...buildOpts,
        selector,
        mode: compPickMode,
        selections: compSelections,
        taper: {
          mode: taper.mode,
          weightGoal: taper.weightGoal === 'auto' ? undefined : taper.weightGoal,
          strategy: taper.strategy,
          mockMeet: taper.mockMeet,
          postMeet: taper.postMeet,
          windowWeeks: taper.windowWeeks ?? 2,
        },
      });
    } catch { return null; }
  }, [seasonMode, meets, compPickMode, compSelections, selector, buildOpts, taper]);

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

  const saveSeasonStateValue = (m: 'single' | 'season') => {
    try {
      const cur = JSON.parse(localStorage.getItem('he_pl_session') || '{}');
      localStorage.setItem('he_pl_session', JSON.stringify({
        ...cur,
        season: { mode: m, slots, pickMode, selections, compPickMode, compSelections },
      }));
    } catch { /* ignore */ }
  };

  const saveSeasonState = () => saveSeasonStateValue(seasonMode);

  const buildSeason = () => {
    try {
      const useGaps = meets.length >= 2 && compGap && compGap.segments.length > 0;
      const notes: string[] = [];
      let out: LMSBuildOutput | null = null;
      if (useGaps) {
        // compGap.weeks уже включает пик-блоки (buildPLSeasonPeaks) — используем напрямую.
        notes.push(...compGap!.notes);
        const firstCycle = compGap!.segments[0]?.fittedCycle ?? compGap!.segments[0]?.candidates[0]?.cycle;
        out = {
          template: firstCycle ?? ({} as LMSBuildOutput['template']),
          progressionRationale: notes.join('\n'),
          weeks: compGap!.weeks,
          cycleMetrics: {} as LMSBuildOutput['cycleMetrics'],
        };
      } else if (seasonPlan.segments.length > 0) {
        out = assembleSeasonPlan(seasonPlan, { ...buildOpts, mode: buildOpts.progressionMode });
        notes.push(...seasonPlan.notes);
      }
      if (!out) {
        onBuilt(null, ['⚠ Сезон пуст — включите хотя бы один период или добавьте соревнования.']);
        return;
      }
      onBuilt(out, notes);
      onNavigatePlan();
    } catch (e) {
      onBuilt(null, ['⚠ Ошибка сборки сезона: ' + (e as Error).message]);
    }
  };

  const slotSummary = seasonSegmentSummary(seasonPlan.segments);

  const renderSlot = (slot: PLSeasonSlot, idx: number) => {
    const candidates = slotCandidates[idx] ?? [];
    const chosenId = pickMode === 'manual' ? (selections[idx] ?? '') : (seasonPlan.segments[idx]?.cycleId ?? '');
    const chosen = candidates.find(c => c.cycle.meta.id === chosenId) ?? candidates[0];
    return (
      <div key={idx} style={{ padding: 8, borderRadius: 10, background: slot.enabled ? 'rgba(0,230,138,0.04)' : 'rgba(255,255,255,0.02)', border: slot.enabled ? '1px solid rgba(0,230,138,0.18)' : '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12 }}>{PERIOD_ICON[slot.period]}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{slot.label}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>({slot.weeksMin}–{slot.weeksMax} нед)</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            <button onClick={() => moveSlot(idx, -1)} title="Переместить раньше" aria-label="Переместить слот раньше" style={{ ...btnMini }}>◀</button>
            <button onClick={() => moveSlot(idx, 1)} title="Переместить позже" aria-label="Переместить слот позже" style={{ ...btnMini }}>▶</button>
            <button onClick={() => toggleSlot(idx)} title={slot.enabled ? 'Отключить период' : 'Включить период'} aria-label={slot.enabled ? 'Отключить период' : 'Включить период'} style={{ ...btnMini, border: slot.enabled ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.2)', color: slot.enabled ? '#00e68a' : 'rgba(255,255,255,0.4)' }}>{slot.enabled ? '✓' : '○'}</button>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'center' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Недель в периоде</div>
          <input
            type="number" min={slot.weeksMin} max={slot.weeksMax} value={slot.weeks} disabled={!slot.enabled}
            onChange={e => setSlotWeeks(idx, Number(e.target.value))}
            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 12 }}
          />
        </div>
        {slot.enabled && pickMode === 'manual' && (
          <select
            value={chosenId}
            onChange={e => setSelections(prev => ({ ...prev, [idx]: e.target.value }))}
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
          <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}>
            {pickMode === 'auto' ? <b style={{ color: '#00e68a' }}>🏆 Рекомендован: </b> : <b style={{ color: '#60a5fa' }}>Выбран: </b>}
            {chosen.cycle.meta.title}
            <span style={{ display: 'block', color: 'rgba(255,255,255,0.45)' }}>
              {seasonPlan.segments[idx]?.fit.notes.join(' · ') ?? chosen.rationale.join(' · ')}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderCompGap = () => {
    if (seasonMode !== 'season' || meets.length < 2 || !compGap) return null;
    return (
      <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginBottom: 6 }}>🏁 Циклы между соревнованиями</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <button onClick={() => setCompPickMode('auto')} style={segBtn(compPickMode === 'auto')}>🤖 Авто-подбор</button>
          <button onClick={() => setCompPickMode('manual')} style={segBtn(compPickMode === 'manual')}>👆 Выбрать вручную</button>
        </div>
        {compGap.segments.map((seg, i) => (
          <div key={i} style={{ padding: 8, marginBottom: 6, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
              {seg.meetName} (нед {seg.meetWeek}) · окно {seg.availableWeeks} нед · тапер {seg.taperWeeks} нед{taper.postMeet ? ' + пост' : ''}
            </div>
            {compPickMode === 'manual' && (
              <>
                <select
                  value={seg.cycleId}
                  onChange={e => setCompSelections(prev => ({ ...prev, [i]: e.target.value }))}
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
                    onChange={e => setCompSelections(prev => ({ ...prev, [i]: e.target.value }))}
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
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
              {seg.cycleId
                ? <>Цикл: <b>{seg.cycleTitle}</b> ({seg.cycleWeeks} нед) → {seg.fitMode === 'skip' ? 'только старт' : `${seg.fitWeeks} нед`}
                  {seg.fitMode === 'shrink' && <span style={{ color: '#fb923c', fontWeight: 700 }}> · ⬇ сжат {seg.cycleWeeks}→{seg.fitWeeks}</span>}
                  {seg.fitMode === 'extend' && <span style={{ color: '#60a5fa', fontWeight: 700 }}> · ⬆ растянут</span>}
                  {seg.fitMode === 'exact' && <span style={{ color: '#22c55e', fontWeight: 700 }}> · ✓ точно</span>}
                </>
                : 'Поддерживающий объём (последняя неделя цикла)'}
              {seg.notes.slice(1).map((n, ni) => <span key={ni} style={{ display: 'block', color: 'rgba(255,255,255,0.4)' }}>{n}</span>)}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Итого: {compGap.totalPlanWeeks} нед плана, у каждого старта пик-блок (вход в пик + mock + тапер + старт{taper.postMeet ? ' + пост' : ''}).</div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#a78bfa' }}>🧩 Сезон по микроциклам</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => { setSeasonMode('single'); saveSeasonState(); }} style={segBtn(seasonMode === 'single')}>🎯 Одиночный цикл</button>
          <button onClick={() => { setSeasonMode('season'); saveSeasonState(); }} style={segBtn(seasonMode === 'season')}>🧩 Сезон</button>
        </div>
      </div>

      {seasonMode === 'season' && (
        <>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
            Периоды-микроциклы: выносливость 6–20 · сила 6–12 · скорость/координация 6–10 · пик 8–10 нед.
            Включите нужные, задайте недели, порядок. Авто-подбор подберёт лучший цикл под каждый период.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 8 }}>
            {slots.map((slot, idx) => renderSlot(slot, idx))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={() => setPickMode('auto')} style={segBtn(pickMode === 'auto')}>🤖 Авто-подбор циклов</button>
            <button onClick={() => setPickMode('manual')} style={segBtn(pickMode === 'manual')}>👆 Выбрать вручную</button>
          </div>
          {pickMode === 'manual' && seasonPlan.segments.length === 0 && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Включите хотя бы один период, чтобы выбрать для него цикл.</div>
          )}
          {slotSummary && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>📅 Сезон: {slotSummary}</div>}
          {renderCompGap()}
          <button
            onClick={() => { saveSeasonState(); buildSeason(); }}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 12, minHeight: 44 }}
          >🧩 Собрать сезон и перейти к плану →</button>
        </>
      )}
    </div>
  );
};

export default PLSeasonBuilder;
