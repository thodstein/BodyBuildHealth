/**
 * bb-hub-volume-tab.tsx — 6-й таб хаба «Объём · Recovery · Mobility» (BB-G-01/02/04).
 *
 * Чистая презентация: панель считает `bb-volume-recovery.engine`, эффект —
 * `bb-diag-effect.engine`. Здесь только разметка и переходы, поэтому таб можно
 * менять, не читая 3-тысячестрочный хаб.
 *
 * Контракты разметки (`data-bb="vr-*"`, `data-zone`, `data-bb="diag-effect*"`)
 * сохранены 1:1 — их держат jsdom-локи хаба и source-guard'ы аудита.
 */
import React from 'react';
import { vrZoneBg, vrZoneColor } from './bb-hub-zones';
import type { VolumeRecoveryPanel } from '../../../engines/bb/bb-volume-recovery.engine';
import type { CorrectionEffectView } from '../../../engines/bb/bb-diag-effect.engine';

export interface BbVolumeTabProps {
  panel: VolumeRecoveryPanel;
  effect: CorrectionEffectView;
  /** Уровень подготовки: по нему выбраны ориентиры MEV/MAV/MRV. */
  level: string;
  /** RU-подпись зоны (верх груди, квадрицепс…): берётся из хаба, чтобы не держать вторую копию словаря. */
  zoneLabel: (zone: string) => string;
  onGoScreen: (id: string) => void;
}

export const BbVolumeTab: React.FC<BbVolumeTabProps> = ({ panel: vrPanel, effect: corrEffect, level, zoneLabel: weakRu, onGoScreen }) => (
  <div data-bb="vr-panel">
    {/* BB-G-01: единый ответ «что ограничивает рост» — объём, острая нагрузка, восстановление. */}
    <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Объём · Recovery · Mobility — что ограничивает рост сейчас</div>
    <div style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 8px', marginBottom: 6 }}>
      Факт — <b>прямые</b> сеты за 7 дней из дневника (косвенная нагрузка не завышает картину). Ориентиры MEV/MAV/MRV — по уровню <b>{level}</b>.
    </div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }} data-bb="vr-chips">
      {vrPanel.chips.map((c) => (
        <span key={c.id} data-bb={`vr-chip-${c.id}`} data-zone={c.zone} style={{ padding: '6px 10px', borderRadius: 10, background: vrZoneBg(c.zone), border: `1px solid ${vrZoneColor(c.zone)}44`, color: vrZoneColor(c.zone), fontSize: 11, lineHeight: 1.35, maxWidth: '100%' }}>
          <b>{c.label}: {c.value}</b>
          <span style={{ display: 'block', color: '#fff', fontSize: 10, opacity: 0.85 }}>{c.detail}</span>
        </span>
      ))}
    </div>
    <div data-bb="vr-limiter" data-zone={vrPanel.limiter?.zone ?? 'green'} style={{ padding: '8px 10px', borderRadius: 10, background: vrZoneBg(vrPanel.limiter?.zone ?? 'green'), border: `1px solid ${vrZoneColor(vrPanel.limiter?.zone ?? 'green')}33`, marginBottom: 8, fontSize: 11, lineHeight: 1.5 }}>
      <b style={{ color: vrZoneColor(vrPanel.limiter?.zone ?? 'green') }}>Ограничитель: {vrPanel.limiter ? vrPanel.limiter.label : 'нет'}</b>
      <div style={{ color: '#fff' }}>{vrPanel.limiter ? vrPanel.limiter.detail : 'Ни один канал не ограничивает объём — можно держать MAV по приоритетам.'}</div>
    </div>
    {vrPanel.advice.length > 0 && (
      <div data-bb="vr-advice" style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.07)', border: '1px solid rgba(0,230,138,0.16)', marginBottom: 8, fontSize: 11, lineHeight: 1.55 }}>
        {vrPanel.advice.map((a, i) => <div key={i} style={{ color: '#fff' }}>• {a}</div>)}
      </div>
    )}
    {vrPanel.hasVolume ? (
      <div data-bb="vr-rows" style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
        {vrPanel.rows.map((r) => {
          const statusRu = r.status === 'exceeding_mrv' ? 'сверх MRV'
            : r.status === 'approaching_mrv' ? 'к MRV'
              : r.status === 'below_mev' ? 'ниже MEV' : 'оптимум';
          const col = r.status === 'exceeding_mrv' ? '#ef4444' : r.status === 'approaching_mrv' ? '#f59e0b' : r.status === 'below_mev' ? '#60a5fa' : '#22c55e';
          return (
            <div key={r.group} data-bb="vr-row" data-muscle={r.group} data-status={r.status} style={{ padding: '7px 9px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${col}33`, fontSize: 10, lineHeight: 1.5 }}>
              <b style={{ fontSize: 11, color: '#fff' }}>{r.label}</b>
              <span style={{ color: col, marginLeft: 6 }}>{r.sets} сет/нед · MEV {r.mev} · MAV {r.mav} · MRV {r.mrv} · {statusRu}</span>
              <div style={{ color: '#fff' }}>
                {r.headroom >= 0 ? `запас до MRV: ${r.headroom}` : `сверх MRV: ${-r.headroom}`}
                {r.acwrRatio != null ? ` · ACWR ×${r.acwrRatio} (${r.acwrZone === 'dangerous' ? 'опасно' : r.acwrZone === 'caution' ? 'осторожно' : r.acwrZone === 'undertrained' ? 'мало' : 'норма'})` : ''}
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div data-bb="vr-nodata" style={{ padding: '8px 10px', borderRadius: 8, background: '#0a1629', border: '1px solid #1f3a5f', fontSize: 10, color: '#fff', marginBottom: 8 }}>
        Нет тренировок за 7 дней — сравнивать факт с MEV/MAV/MRV нечем (это «нет данных», а не нули).
      </div>
    )}
    {/* BB-G-04: эффект вставки коррекций — до/после по зоне, честное «не срок». */}
    <div data-bb="diag-effect" data-status={corrEffect.status} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.16)', marginBottom: 8, fontSize: 10, lineHeight: 1.5 }}>
      <b style={{ fontSize: 11, color: '#fff' }}>⏱ Эффект коррекции (окно 4–6 нед)</b>
      <div style={{ color: corrEffect.status === 'no_injection' ? '#9ca3af' : corrEffect.status === 'too_early' ? '#f59e0b' : '#fff', marginTop: 2 }}>{corrEffect.text}</div>
      {corrEffect.rows.map((r) => {
        const vCol = r.verdict === 'improved' ? '#22c55e' : r.verdict === 'worse' ? '#ef4444' : r.verdict === 'flat' ? '#9ca3af' : '#f59e0b';
        const vRu = r.verdict === 'improved' ? 'рост объёма' : r.verdict === 'worse' ? 'объём упал' : r.verdict === 'flat' ? 'без изменений' : 'ждём окно оценки';
        return (
          <div key={r.zone} data-bb="diag-effect-row" data-verdict={r.verdict} style={{ color: '#fff', marginTop: 2 }}>
            <b>{weakRu(r.zone)}</b>: {r.setsBeforeWeekly ?? '—'} → {r.setsAfterWeekly ?? '—'} сет/нед
            {r.deltaPct != null ? ` (${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}%)` : ''} · <span style={{ color: vCol }}>{vRu}</span>
          </div>
        );
      })}
    </div>
    {/* BB-G-02: deep-links — из вердикта можно дойти до замера/профильного экрана. */}
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-bb="vr-links">
      {([
        ['volume_hub', '📐 Объём-хаб'],
        ['joints_ortho', '🦴 Ортопедия'],
        ['calc_vbt', '🎯 VBT · Анализ силы'],
        ['diary', '📝 Дневник'],
      ] as const).map(([target, label]) => (
        <button key={target} type="button" data-bb="vr-link" data-target={target} onClick={() => onGoScreen(target)} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
      ))}
    </div>
  </div>
);

export default BbVolumeTab;
