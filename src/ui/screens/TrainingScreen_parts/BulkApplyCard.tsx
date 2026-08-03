/**
 * BulkApplyCard.tsx — P2-3: Bulk-apply techniques/character with week-range selector.
 *
 * Extracted from ProgramEditorView.tsx. Allows applying intensity techniques and
 * day character (тяж/памп/лёг) to a selected week range instead of all weeks.
 */
import React, { useState } from 'react';
import type { UserProgram } from '../../../engines/user-program/user-program.types';
import { INTENSITY_TECHNIQUES, type IntensityTechnique } from '../../../engines/bb/bb-autocoach.engine';
import { tempoFor } from '../../../engines/bb/bb-tempo-rest';
import { ACCENT, CARD, DIM, BTN_GHOST } from './training-ui';

interface Props {
  program: UserProgram;
  onChange: (p: UserProgram) => void;
  showToast: (m: string) => void;
}

export const BulkApplyCard: React.FC<Props> = ({ program, onChange, showToast }) => {
  const [weekRange, setWeekRange] = useState<'all' | 'range'>('all');
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(program.bb?.weeks?.length ?? 1);

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

  return (
    <div style={{ ...CARD, padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 6 }}>
        🔧 Применить ко всем блокам
        <span style={{ fontSize: 11, color: DIM, marginLeft: 6, fontWeight: 500 }}>(сейчас: {INTENSITY_TECHNIQUES[curIntensity as IntensityTechnique]?.label ?? curIntensity})</span>
      </div>

      {/* P2-3: Week-range selector */}
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

      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(167,139,250,0.7)', marginBottom: 4 }}>
        Интенсив-техника:
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {(Object.entries(INTENSITY_TECHNIQUES) as [IntensityTechnique, { label: string; description: string }][]).map(([key, meta]) => (
          <button
            key={key}
            title={meta.description}
            onClick={() => applyTechnique(key)}
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', fontWeight: 700, minHeight: 38 }}
          >
            {meta.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(34,197,94,0.7)', marginBottom: 4 }}>
        Характер дня (отдых + темп):
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(['тяж', 'памп', 'лёг'] as const).map((char) => (
          <button
            key={char}
            title={`${char}-характер дня: темп адаптируется по фазе, отдых ${{тяж:180,памп:60,лёг:90}[char]}с`}
            onClick={() => applyCharacter(char)}
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', fontWeight: 700, minHeight: 38 }}
          >
            {char === 'тяж' ? 'Тяж. день → 180с/отдых' : char === 'памп' ? 'Памп день → 60с/отдых' : 'Лёгкий день → 90с/отдых'}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: DIM, marginTop: 4, fontStyle: 'italic' }}>
        {weekRange === 'all' ? 'Применяет ко всем Weeks→Sessions→Blocks.' : `Применяет к неделям ${rangeStart}-${rangeEnd} → Sessions → Blocks.`} Темп/RIR правила — из RIR_MATRIX[goal][level].
      </div>
    </div>
  );
};