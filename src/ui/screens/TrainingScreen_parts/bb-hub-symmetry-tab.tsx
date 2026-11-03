/**
 * bb-hub-symmetry-tab.tsx — таб «Пропорции» (волна 3 плана хабов: декомпозиция).
 *
 * Перенос разметки 1:1 из `BBDiagnosticsHub.tsx`. Границы знания прежние:
 *  - «Симметрия: нет замеров» вместо 100/«пропорции в норме» (BB-D-02);
 *  - коридор Маккаллума и триада показываются только при введённом запястье/замерах;
 *  - снимок замеров пишется локальной датой (BB-D-08), дельты — из движка симметрии.
 * Компонент без состояния: `state`/`setState` приходят пропсами.
 */
import React from 'react';
import { measureDeltas, type MeasureSnapshot } from '../../../engines/bb/bb-symmetry.engine';
import { BbNum } from './bb-hub-controls';
import type { BBState } from './BBDiagnosticsHub';

export interface BbSymmetryTabProps {
  state: Pick<BBState, 'circ' | 'wristCm'>;
  setState: React.Dispatch<React.SetStateAction<BBState>>;
  /** Симметрия из отчёта диагностики (tested = есть ≥2 обхвата). */
  symmetry: { tested: boolean; score: number; issues: string[]; ratios: Record<string, number | string> };
  /** Идеал Маккаллума по запястью; null — запястье не введено. */
  mcCallum: Record<string, number> | null;
  /** Триада шея = бицепс = голень, Δ% (null — данных мало). */
  triadDev: number | null;
  measureHist: MeasureSnapshot[];
  takeMeasureSnapshot: () => void;
  /** Замеры числами (только введённые) — источник дельт. */
  measNum: Record<string, number>;
  /** Русское название обхвата. */
  circRu: (k: string) => string;
}

export const BbSymmetryTab: React.FC<BbSymmetryTabProps> = ({
  state, setState, symmetry, mcCallum, triadDev, measureHist, takeMeasureSnapshot, measNum, circRu,
}) => (
  <div>
    <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Пропорции — замеры (см) + лево/право + идеал Маккаллума</div>
    <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 8px', marginBottom: 6 }}>Пол/возраст/цикл — в <b>профиле</b> (здесь только сантиметры и дельты, без дублей).</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="circ-main">
      {[{ k: 'heightCm', ru: 'Рост, см' }, { k: 'weightKg', ru: 'Вес, кг' }, { k: 'chest', ru: 'Грудь, см' }, { k: 'waist', ru: 'Талия, см' }, { k: 'hips', ru: 'Бёдра, см' }, { k: 'shoulderWidth', ru: 'Плечи (ширина), см' }, { k: 'neck', ru: 'Шея, см' }].map(({ k, ru }) => (
        <BbNum key={k} label={ru} value={state.circ[k] || ''} onChange={(v) => setState(s => ({ ...s, circ: { ...s.circ, [k]: v } }))} placeholder="—" step={0.5} />
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }} data-bb="circ-lr">
      {[{ k: 'bicepL', ru: 'Бицепс левый, см' }, { k: 'bicepR', ru: 'Бицепс правый, см' }, { k: 'thighL', ru: 'Бедро левое, см' }, { k: 'thighR', ru: 'Бедро правое, см' }, { k: 'calfL', ru: 'Голень левая, см' }, { k: 'calfR', ru: 'Голень правая, см' }, { k: 'forearmL', ru: 'Предплечье левое, см' }, { k: 'forearmR', ru: 'Предплечье правое, см' }].map(({ k, ru }) => (
        <BbNum key={k} label={ru} value={state.circ[k] || ''} onChange={(v) => setState(s => ({ ...s, circ: { ...s.circ, [k]: v } }))} placeholder="—" step={0.5} />
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
      <BbNum label="Запястье, см (Маккаллум)" value={state.wristCm} onChange={(v) => setState(s => ({ ...s, wristCm: v }))} placeholder="17,5" step={0.5} />
      <span style={{ alignSelf: 'end' }}>{mcCallum && <span style={{ fontSize: 10, color: '#60a5fa' }}>Маккаллум: грудь {mcCallum.chest} · биц {mcCallum.bicep} · икры {mcCallum.calf} · талия {mcCallum.waist}</span>}</span>
      {triadDev != null && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: triadDev >= 12 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(255,255,255,0.06)', color: triadDev >= 12 ? '#ef4444' : '#22c55e', alignSelf: 'end' }}>Триада шея=биц=икры Δ {triadDev}%</span>}
    </div>
    <div style={{ padding: '8px 10px', borderRadius: 8, background: !symmetry.tested ? 'rgba(148,163,184,0.08)' : symmetry.score < 70 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${!symmetry.tested ? 'rgba(148,163,184,0.22)' : symmetry.score < 70 ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)'}`, marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: !symmetry.tested ? '#94a3b8' : symmetry.score < 70 ? '#ef4444' : '#22c55e' }}>{symmetry.tested ? `Симметрия ${symmetry.score}/100` : 'Симметрия: нет замеров'}</div>
      <div style={{ fontSize: 10, color: '#fff' }}>{Object.entries(symmetry.ratios).map(([k, v]) => `${circRu(k)} ${typeof v === 'number' ? v.toFixed(2) : v}`).join(' · ') || '— замеры не введены'}</div>
      <div style={{ fontSize: 10, color: !symmetry.tested ? '#94a3b8' : symmetry.score < 70 ? '#ef4444' : '#fff', marginTop: 4 }}>{symmetry.issues.join(' · ') || (symmetry.tested ? 'Пропорции в норме' : 'Введи ≥2 обхвата — оценка пропорций появится после этого (сейчас 0 замеров, это не «норма»)')}</div>
    </div>
    <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 11, color: '#fff' }}>📸 Трекинг замеров</b>
        <button onClick={takeMeasureSnapshot} data-bb="snapshot" style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.22)', color: '#00e68a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Снимок сегодня</button>
        <span style={{ fontSize: 10, color: '#fff' }}>снимков: {measureHist.length} · перепроверка через ~4 нед</span>
      </div>
      {measureHist.length === 0 && <div style={{ fontSize: 10, color: '#fff' }}>Пока пусто — введи замеры и нажми «Снимок», дельты появятся здесь и в причинах (наследственность).</div>}
      {measureHist.length > 0 && (() => {
        const last = measureHist[measureHist.length - 1];
        const deltas = measureDeltas(last, measNum as any);
        const keys = Object.keys(deltas);
        if (!keys.length) return <div style={{ fontSize: 10, color: '#fff' }}>Снимок {last.date} — введи новые замеры для дельты.</div>;
        return (
          <div>
            <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>vs {last.date}:</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {keys.map((k) => {
                const d = deltas[k];
                const goodUp = k !== 'waist';
                const good = d.deltaPct === 0 ? null : (d.deltaPct > 0) === goodUp;
                const col = good == null ? '#fff' : good ? '#22c55e' : '#f59e0b';
                return <span key={k} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: col }}>{circRu(k)} {d.from}→{d.to} ({d.deltaPct > 0 ? '+' : ''}{d.deltaPct}%)</span>;
              })}
            </div>
          </div>
        );
      })()}
    </div>
  </div>
);

export default BbSymmetryTab;
