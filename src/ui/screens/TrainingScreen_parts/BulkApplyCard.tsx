/**
 * BulkApplyCard.tsx — P2-3 + PRO bulk (прогрессия, DUP, специализация, тапер, autoreg)
 *
 * Расширен для PRO: bulk прогрессия (double/linear/wave/rpe), DUP внутри недели,
 * специализация/tradeoff, taper/peak. Использует engines manual-progression/autoreg/periodization-pro.
 */
import React, { useState } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { INTENSITY_TECHNIQUES, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { tempoFor } from '../../../engines/bb/bb-tempo-rest';
import { ACCENT, CARD, DIM, BTN_GHOST } from './training-ui';
import { bulkProgressWeeks, type LoadStrategy } from '../../../engines/manual-constructor/manual-progression.engine';
import { applyDUPToProgram, type DupPreset, DUP_PRESETS, applySpecializationToProgram, applyTaperToProgram, inheritWeekBlocks } from '../../../engines/manual-constructor/manual-periodization-pro.engine';

interface Props {
  program: UserProgram;
  onChange: (p: UserProgram) => void;
  showToast: (m: string) => void;
}

export const BulkApplyCard: React.FC<Props> = ({ program, onChange, showToast }) => {
  const [weekRange, setWeekRange] = useState<'all' | 'range'>('all');
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(program.bb?.weeks?.length ?? 1);
  const [progStrategy, setProgStrategy] = useState<LoadStrategy>('double_progression');
  const [dupPreset, setDupPreset] = useState<DupPreset>('heavy_light');
  const [specTargets, setSpecTargets] = useState('');
  const [taperWeeks, setTaperWeeks] = useState(2);

  if (!program.bb || program.bb.weeks.length === 0) return null;

  const totalWeeks = program.bb.weeks.length;
  const curIntensity = (program.bb.progression?.intensityTechniques ?? ['none'])[0];

  const shouldApplyToWeek = (wi: number) => {
    if (weekRange === 'all') return true;
    return wi >= rangeStart - 1 && wi <= rangeEnd - 1;
  };

  const applyTechnique = (key: IntensityTechnique | 'none') => {
    const next: UserProgram = {
      ...program,
      bb: {
        ...program.bb!,
        weeks: program.bb!.weeks.map((w, wi) => shouldApplyToWeek(wi) ? ({
          ...w,
          sessions: w.sessions.map((s) => ({
            ...s,
            blocks: s.blocks.map((b) => ({
              ...b,
              sets: (b.sets ?? []).map((st) => ({ ...st, technique: key === 'none' ? undefined : key })),
            })),
          })),
        }) : w),
        progression: {
          ...(program.bb!.progression ?? { loadStrategy: 'double_progression', deloadProtocol: 'pump', intensityTechniques: ['none'] }),
          intensityTechniques: key === 'none' ? ['none'] : [key],
        },
      },
    };
    onChange(next);
    const scope = weekRange === 'all' ? 'всем неделям' : `неделям ${rangeStart}-${rangeEnd}`;
    showToast('🔧 Применено к ' + scope + ': ' + (key === 'none' ? 'без техники' : INTENSITY_TECHNIQUES[key as IntensityTechnique].label));
  };

  const applyCharacter = (char: 'тяж' | 'памп' | 'лёг') => {
    const restByChar = { тяж: 180, памп: 60, лёг: 90 } as const;
    const next: UserProgram = {
      ...program,
      bb: {
        ...program.bb!,
        weeks: program.bb!.weeks.map((w, wi) => {
          if (!shouldApplyToWeek(wi)) return w;
          const tempo = tempoFor(char, undefined, w.phase);
          return {
            ...w,
            sessions: w.sessions.map((s) => ({
              ...s,
              blocks: s.blocks.map((b) => ({
                ...b,
                sets: (b.sets ?? []).map((st, i) => i === 0
                  ? { ...st, restSec: restByChar[char], tempo: tempo.notation }
                  : { ...st, tempo: st.tempo || tempo.notation }),
              })),
            })),
          };
        }),
      },
    };
    onChange(next);
    const scope = weekRange === 'all' ? 'всем неделям' : `неделям ${rangeStart}-${rangeEnd}`;
    showToast('🏋 Характер ' + char + ' → ' + scope + ': отдых ' + restByChar[char] + 'с, темп по фазе');
  };

  const applyProgression = () => {
    const from = weekRange === 'all' ? 1 : rangeStart;
    const to = weekRange === 'all' ? totalWeeks : rangeEnd;
    const res = bulkProgressWeeks(program, from, to, { strategy: progStrategy, totalWeeks, skipDeload: true });
    onChange(res.program);
    showToast(`📈 Прогрессия ${progStrategy}: ${res.changedBlocks} блоков, делод пропущено ${res.deloadSkipped} (нед ${from}-${to})`);
  };

  const applyDup = () => {
    const from = weekRange === 'all' ? 1 : rangeStart;
    const to = weekRange === 'all' ? totalWeeks : rangeEnd;
    const next = applyDUPToProgram(program, dupPreset, from, to);
    onChange(next);
    showToast(`🔄 DUP ${DUP_PRESETS[dupPreset].label} → нед ${from}-${to}`);
  };

  const applySpec = () => {
    const targets = specTargets.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).slice(0,2);
    if (targets.length===0) { showToast('⚠ Укажите 1-2 мышцы (напр. chest, delt_mid)','error' as any); return; }
    const from = weekRange === 'all' ? 1 : rangeStart;
    const to = weekRange === 'all' ? totalWeeks : rangeEnd;
    const next = applySpecializationToProgram(program, { targets }, from, to, program.meta.level);
    onChange(next);
    showToast(`🎯 Специализация ${targets.join(',')} → нед ${from}-${to}`);
  };

  const applyTaper = () => {
    const next = applyTaperToProgram(program, { weeks: taperWeeks, mode: 'classic' });
    onChange(next);
    showToast(`📉 Taper ${taperWeeks} нед → финал`);
  };

  const applyInherit = () => {
    const from = 1;
    const toStart = weekRange === 'all' ? 2 : rangeStart;
    const toEnd = weekRange === 'all' ? totalWeeks : rangeEnd;
    const baseWeek = program.bb!.weeks.find(w=> w.week===from);
    if (!baseWeek) { showToast('⚠ Нет недели 1 для наследования'); return; }
    let nextWeeks = [...program.bb!.weeks];
    let inherited = 0;
    for (let wi = toStart; wi <= toEnd; wi++) {
      const idx = nextWeeks.findIndex(w=> w.week===wi);
      if (idx<0) continue;
      const target = nextWeeks[idx];
      const isEmpty = target.sessions.every(s=> s.blocks.length===0);
      if (!isEmpty) continue;
      const merged = inheritWeekBlocks(baseWeek, { week: wi, sessions: target.sessions } as any);
      // если target пустой — наследовать полностью базу, иначе мержить
      const finalWeek = isEmpty ? { ...baseWeek, week: wi, sessions: baseWeek.sessions.map(s=> ({ ...s, id: s.id + `_inh_${wi}` })) } as any : merged;
      nextWeeks[idx] = finalWeek;
      inherited++;
    }
    if (inherited===0) { showToast('ℹ Нет пустых недель в диапазоне'); return; }
    onChange({ ...program, bb: { ...program.bb!, weeks: nextWeeks } });
    showToast(`🧬 Наследование: неделя 1 → ${inherited} пустых недель`);
  };

  return (
    <div style={{ ...CARD, padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>
        🔧 Массовые операции PRO
        <span style={{ fontSize: 11, color: DIM, marginLeft: 6, fontWeight: 500 }}>(сейчас: {INTENSITY_TECHNIQUES[curIntensity as IntensityTechnique]?.label ?? curIntensity})</span>
      </div>

      {/* Диапазон */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: DIM }}>Диапазон:</span>
        <button onClick={() => setWeekRange('all')} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', border: weekRange === 'all' ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: weekRange === 'all' ? 'rgba(0,230,138,0.15)' : 'transparent', color: weekRange === 'all' ? '#00e68a' : DIM, fontWeight: 700, minHeight: 30 }}>Все недели</button>
        <button onClick={() => setWeekRange('range')} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer', border: weekRange === 'range' ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.08)', background: weekRange === 'range' ? 'rgba(0,230,138,0.15)' : 'transparent', color: weekRange === 'range' ? '#00e68a' : DIM, fontWeight: 700, minHeight: 30 }}>Выбрать</button>
        {weekRange === 'range' && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="number" style={{ width: 40, padding: '3px 4px', fontSize: 10, textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#fff', minHeight: 30 }} min={1} max={totalWeeks} value={rangeStart} onChange={e => setRangeStart(Math.max(1, Math.min(parseInt(e.target.value) || 1, rangeEnd)))} />
            <span style={{ fontSize: 10, color: DIM }}>—</span>
            <input type="number" style={{ width: 40, padding: '3px 4px', fontSize: 10, textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#fff', minHeight: 30 }} min={1} max={totalWeeks} value={rangeEnd} onChange={e => setRangeEnd(Math.max(rangeStart, Math.min(parseInt(e.target.value) || totalWeeks, totalWeeks)))} />
            <span style={{ fontSize: 10, color: DIM }}>из {totalWeeks}</span>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(167,139,250,0.7)', marginBottom: 4 }}>Интенсив-техника:</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {(Object.entries(INTENSITY_TECHNIQUES) as [IntensityTechnique, { label: string; description: string }][]).map(([key, meta]) => (
          <button key={key} title={meta.description} onClick={() => applyTechnique(key)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontWeight: 700, minHeight: 38 }}>{meta.label}</button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(34,197,94,0.7)', marginBottom: 4 }}>Характер дня (отдых + темп):</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {(['тяж', 'памп', 'лёг'] as const).map((char) => (
          <button key={char} title={`${char}-характер дня: темп адаптируется по фазе, отдых ${{тяж:180,памп:60,лёг:90}[char]}с`} onClick={() => applyCharacter(char)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', fontWeight: 700, minHeight: 38 }}>{char === 'тяж' ? 'Тяж. день → 180с/отдых' : char === 'памп' ? 'Памп день → 60с/отдых' : 'Лёгкий день → 90с/отдых'}</button>
        ))}
      </div>

      {/* PRO: прогрессия */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(96,165,250,0.9)', marginBottom: 4 }}>📈 Прогрессия (bulk +1 нед)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={progStrategy} onChange={e=> setProgStrategy(e.target.value as LoadStrategy)} style={{ fontSize: 11, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>
            <option value="double_progression">double</option><option value="linear">linear</option><option value="wave">wave</option><option value="rpe_based">rpe</option>
          </select>
          <button onClick={applyProgression} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa', fontWeight: 700 }}>▶ Прогрессировать</button>
          <span style={{ fontSize: 10, color: DIM }}>double: repCap изоляция15/12 compound12/8; deload skip</span>
        </div>
      </div>

      {/* PRO: DUP */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,158,11,0.9)', marginBottom: 4 }}>🔄 DUP внутри недели</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={dupPreset} onChange={e=> setDupPreset(e.target.value as DupPreset)} style={{ fontSize: 11, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>
            <option value="heavy_light">Тяж/Лёг</option><option value="strength_hypertrophy">Сила/Гипер</option><option value="full_dup">Full DUP</option>
          </select>
          <button onClick={applyDup} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontWeight: 700 }}>Применить DUP</button>
        </div>
      </div>

      {/* PRO: специализация */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(236,72,153,0.9)', marginBottom: 4 }}>🎯 Специализация (tradeoff)</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="цели: chest, delt_mid" value={specTargets} onChange={e=> setSpecTargets(e.target.value)} style={{ fontSize: 11, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', minWidth: 160 }} />
          <button onClick={applySpec} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.25)', color: '#ec4899', fontWeight: 700 }}>Применить</button>
        </div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 4 }}>1-2 мышцы, доноры срежутся до MEV, цели + объём</div>
      </div>

      {/* PRO: taper */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(139,92,246,0.9)', marginBottom: 4 }}>📉 Taper/Pick</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="number" min={1} max={3} value={taperWeeks} onChange={e=> setTaperWeeks(Math.max(1, Math.min(3, parseInt(e.target.value)||2)))} style={{ width: 50, fontSize: 11, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }} />
          <span style={{ fontSize: 11, color: DIM }}>нед</span>
          <button onClick={applyTaper} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', fontWeight: 700 }}>Применить taper</button>
        </div>
      </div>

      {/* PRO: наследование */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(16,185,129,0.9)', marginBottom: 4 }}>🧬 Наследование блоков (base → custom)</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={applyInherit} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontWeight: 700 }}>Наследовать из недели 1 → пустые</button>
          <span style={{ fontSize: 10, color: DIM }}>Копирует упражнения недели 1 в пустые недели диапазона</span>
        </div>
      </div>

      <div style={{ fontSize: 11, color: DIM, marginTop: 8, fontStyle: 'italic' }}>
        PRO bulk использует effective объём, per-head, deload skip, кап 5/8. Темп/RIR — из RIR_MATRIX[goal][level].
      </div>
    </div>
  );
};
