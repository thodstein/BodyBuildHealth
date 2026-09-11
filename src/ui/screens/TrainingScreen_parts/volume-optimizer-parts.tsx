/**
 * volume-optimizer-parts.tsx — P7-распил god-компонента VolumeOptimizerTab.
 * Только подача: вся логика (строки/анализ/прогрессия/свапы/конвейер) остаётся в табе,
 * здесь — презентационные карточки с `data-v` хуками для native-слоя и tabular-цифрами.
 */
import React from 'react';
import type { MuscleVolumeProAnaly } from '../../../engines/volume-optimizer-pro.engine';
import {
  compareVolumeSnapshot,
  type VolumeSnapshot,
  type VolumeHubRow,
} from '../../../engines/volume-hub-conveyor.engine';

const ACCENT = '#00e68a';
const DIM_ = '#fff';

const GROUP_RU: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор', full: 'Общее',
};

const STATUS_COLOR: Record<string, string> = {
  below_mev: '#ef4444', optimal: '#22c55e', approaching_mrv: '#f59e0b', exceeding_mrv: '#ef4444',
};
const STATUS_LABEL: Record<string, string> = {
  below_mev: 'Ниже MEV', optimal: 'Оптимально', approaching_mrv: 'Близко к MRV', exceeding_mrv: 'Превышен MRV',
};

/** Тонкий вид канонического quality-мемо таба (структурный, без импорта внутренностей таба). */
export interface CanonicalQualityView {
  score: number;
  over: string[];
  weakCovered: string[];
  weakMissed: string[];
  monotonyNote: string;
  labWarnings: string[];
  mvGroups: Array<{ group: string; effectiveSets: number; mev: number }>;
  sessViol: Array<{ message: string }>;
  freqFlags: string[];
  rir: { verdict: { kind: string; message: string } };
  hard: { hardSets: number; totalSets: number; assumedSets: number };
}

export function qualityColorFor(score: number): string {
  return score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
}

export const VolBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  return (
    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 2 }}>
      <div style={{ width: pct + '%', height: '100%', borderRadius: 3, background: color, transition: 'width 0.3s' }} />
    </div>
  );
};

export const VolSectionHeader: React.FC<{ icon: string; title: string; open: boolean; onToggle: () => void }> = ({ icon, title, open, onToggle }) => (
  <button onClick={onToggle} aria-expanded={open}
    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)', minHeight: 44 }}>
    <span>{open ? '▼' : '▶'}</span>
    <span>{icon}</span>
    <span style={{ color: ACCENT }}>{title}</span>
  </button>
);

export const VolumeQualityCard: React.FC<{ quality: CanonicalQualityView; improving: boolean; onImprove: () => void }> = ({ quality, improving, onImprove }) => {
  const color = qualityColorFor(quality.score);
  return (
    <div data-v="quality-card" style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: `${color}10`, border: `1px solid ${color}30` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color }}>🎯 Качество программы</span>
        <span data-v="quality-score" style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{quality.score}/100</span>
      </div>
      <div style={{ fontSize: 10, color: '#fff', marginTop: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 4 }}>
          {quality.over.length > 0 && <div style={{ color: '#ef4444' }}>⚠ Превышение MRV: {quality.over.map(g => GROUP_RU[g] || g).join(', ')}</div>}
          {quality.weakMissed.length > 0 && <div style={{ color: '#f59e0b' }}>⚠ Слабые не покрыты: {quality.weakMissed.map(g => GROUP_RU[g] || g).join(', ')}</div>}
          {quality.weakCovered.length > 0 && <div style={{ color: ACCENT }}>✅ Слабые покрыты: {quality.weakCovered.map(g => GROUP_RU[g] || g).join(', ')}</div>}
        </div>
        {quality.monotonyNote && <div style={{ marginTop: 4 }}>{quality.monotonyNote}</div>}
        {quality.mvGroups.length > 0 && <div style={{ marginTop: 2, color: '#60a5fa' }}>🛡 Поддержание (MV, не штраф): {quality.mvGroups.map(g => `${GROUP_RU[g.group] || g.group} ${g.effectiveSets}/${g.mev}`).join(', ')}</div>}
        {quality.sessViol.slice(0, 3).map((v, i) => (
          <div key={'sv' + i} style={{ marginTop: 2, color: '#f59e0b' }}>⚠ {v.message}</div>
        ))}
        {quality.freqFlags.slice(0, 3).map((f: string, i: number) => (
          <div key={'fq' + i} style={{ marginTop: 2, color: '#f59e0b' }}>⚠ {f}</div>
        ))}
        <div style={{ marginTop: 2, color: quality.rir.verdict.kind === 'ok' ? '#22c55e' : quality.rir.verdict.kind === 'info' ? '#fff' : '#f59e0b' }}>
          {quality.rir.verdict.kind === 'ok' ? '✅' : quality.rir.verdict.kind === 'info' ? 'ℹ️' : '⚠'} RIR: {quality.rir.verdict.message} · hard-сеты {quality.hard.hardSets}/{quality.hard.totalSets}{quality.hard.assumedSets > 0 ? ` (RPE пуст: ${quality.hard.assumedSets} assumed)` : ''}
        </div>
        {quality.labWarnings.length > 0 && quality.labWarnings.map((w: string, i: number) => (
          <div key={i} style={{ marginTop: 2, color: '#f59e0b' }}>🧪 {w}</div>
        ))}
        {quality.over.length === 0 && quality.weakMissed.length === 0 && <div style={{ color: ACCENT, marginTop: 4 }}>✅ Объём в норме, слабые группы покрыты</div>}
      </div>
      {(quality.over.length > 0 || quality.weakMissed.length > 0) && (
        <button onClick={onImprove} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 8, border: '1px solid ' + ACCENT, background: 'rgba(0,230,138,0.08)', color: ACCENT, fontWeight: 700, fontSize: 11, cursor: 'pointer', minHeight: 44 }}>
          {improving ? '✓ Улучшено' : '🎯 Улучшить программу'}
        </button>
      )}
    </div>
  );
};

export const PerMuscleList: React.FC<{ items: MuscleVolumeProAnaly[] }> = ({ items }) => (
  <div data-v="per-muscle">
    {items.map(m => {
      const color = STATUS_COLOR[m.status];
      return (
        <div key={m.muscle} data-v="per-muscle-card" style={{ marginBottom: 10, padding: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 8, borderLeft: '3px solid ' + color }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{m.muscleRu}</span>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#000', background: color, marginLeft: 6 }}>{STATUS_LABEL[m.status]}</span>
            </div>
            <div style={{ fontSize: 10, color: DIM_, fontVariantNumeric: 'tabular-nums' }}>
              SFR ср. {m.avgSFR.toFixed(2)} · Эфф. {m.efficiencyScore}%
            </div>
          </div>
          <div style={{ position: 'relative', height: 22, marginBottom: 6 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
            <div style={{ position: 'absolute', left: 0, width: (m.mev / m.mrv * 100) + '%', height: '100%', background: 'rgba(34,197,94,0.15)', borderRadius: '4px 0 0 4px' }} />
            <div style={{ position: 'absolute', left: (m.mev / m.mrv * 100) + '%', width: ((m.mav - m.mev) / m.mrv * 100) + '%', height: '100%', background: 'rgba(0,230,138,0.1)' }} />
            <div style={{ position: 'absolute', left: Math.min(98, (m.currentSets / m.mrv * 100)) + '%', top: -3, width: 4, height: 28, background: color, borderRadius: 2, transform: 'translateX(-50%)', zIndex: 2, boxShadow: '0 0 6px ' + color }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', zIndex: 1, fontSize: 10, color: DIM_, fontVariantNumeric: 'tabular-nums' }}>
              <span>MEV {m.mev}</span><span>MAV {m.mav}</span><span>MRV {m.mrv}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: DIM_, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
            <span>Подходов: <b style={{ color }}>{m.currentSets}</b></span>
            <span>База: {m.compoundSets} / Изол: {m.isolationSets}</span>
            <span>Тяж: {m.heavySets}</span>
            <span>Частота: {m.currentFreq}×/нед · hard {m.hardSets}/{m.currentSets}</span>
            <span>Восст: ~{m.recoveryHoursEst}ч</span>
          </div>
          <div style={{ fontSize: 10, marginTop: 2, color: m.freqKind === 'ok' ? '#22c55e' : m.freqKind === 'info' ? '#fff' : m.freqKind === 'warning' ? '#f59e0b' : '#ef4444' }}>
            {m.freqKind === 'ok' ? '✅' : m.freqKind === 'info' ? 'ℹ️' : '⚠'} {m.freqVerdict}
          </div>
          {m.actionableTips.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {m.actionableTips.map((t, i) => (
                <div key={i} style={{ fontSize: 10, color: '#f59e0b', marginBottom: 1 }}>💡 {t}</div>
              ))}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export interface ConveyorHandlers {
  onDiaryImport: () => void;
  onSnapshot: () => void;
  onCsv: () => void;
  onHtml: () => void;
  onRemoveSnapshot: (id: number) => void;
}

export const VolumeConveyorCard: React.FC<{
  flash: string;
  snapshots: VolumeSnapshot[];
  compareWith: VolumeHubRow[];
  handlers: ConveyorHandlers;
}> = ({ flash, snapshots, compareWith, handlers }) => (
  <div data-v="conveyor" style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)' }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', marginBottom: 8 }}>🔗 Конвейер: дневник · снапшоты · экспорт</div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button onClick={handlers.onDiaryImport} style={{ flex: '1 1 140px', padding: 10, borderRadius: 10, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa', fontWeight: 800, fontSize: 11, cursor: 'pointer', minHeight: 44 }}>
        📥 Из дневника (7д)
      </button>
      <button onClick={handlers.onSnapshot} style={{ flex: '1 1 140px', padding: 10, borderRadius: 10, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.06)', color: ACCENT, fontWeight: 800, fontSize: 11, cursor: 'pointer', minHeight: 44 }}>
        📸 Снапшот
      </button>
      <button onClick={handlers.onCsv} style={{ flex: '1 1 100px', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, fontSize: 11, cursor: 'pointer', minHeight: 44 }}>
        📄 CSV
      </button>
      <button onClick={handlers.onHtml} style={{ flex: '1 1 100px', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, fontSize: 11, cursor: 'pointer', minHeight: 44 }}>
        🖨 HTML
      </button>
    </div>
    {flash && <div role="status" style={{ marginTop: 8, fontSize: 11, color: '#fff' }}>{flash}</div>}
    {snapshots.length > 0 && (
      <div style={{ marginTop: 8 }}>
        {snapshots.slice(0, 5).map(s => {
          const cmp = compareVolumeSnapshot(s, compareWith);
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 4, fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: '#fff' }}>{new Date(s.at).toLocaleDateString('ru-RU')} · {s.level} · {s.totalSets} подх</span>
              <span style={{ color: cmp.setsDelta === 0 ? '#fff' : cmp.setsDelta > 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                Δ {cmp.setsDelta > 0 ? '+' : ''}{cmp.setsDelta} подх · {cmp.tonnageDelta > 0 ? '+' : ''}{cmp.tonnageDelta.toLocaleString('ru-RU')} кг·повт
              </span>
              <button onClick={() => handlers.onRemoveSnapshot(s.id)} aria-label="Удалить снапшот" style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 10, padding: '4px 8px', minHeight: 36, minWidth: 36 }}>✕</button>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
