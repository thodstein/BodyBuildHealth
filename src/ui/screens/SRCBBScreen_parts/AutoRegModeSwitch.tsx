/**
 * AutoRegModeSwitch.tsx — единый селектор авторегуляции ПЛ (off/auto/diary).
 *
 * Фаза 2 дедупа: раньше сегмент был скопирован 4 раза (PLPlanView ×3,
 * PLCompetitionTab ×1) с разными метками/цветами. Канон меток и цветов — здесь;
 * логика режимов остаётся в родителях (они передают value/onChange).
 */
import React from 'react';
import type { AutoRegMode } from '../../../engines/pro/diary-autoreg.engine';

export const AUTOREG_MODE_LABELS: Record<AutoRegMode, string> = {
  off: 'ВЫКЛ',
  auto: '🤖 Авто',
  diary: '📓 Авто-дневник',
};

const MODE_TITLES: Record<AutoRegMode, string> = {
  auto: 'Формульная авторегуляция: вес × топ-сет множитель, объём, RIR',
  diary: 'Корректировка весов из последней сессии дневника',
  off: 'Плановые веса без корректировок',
};

const ACTIVE_COLOR: Record<AutoRegMode, string> = {
  off: '#71717a',
  auto: '#60a5fa',
  diary: '#22c55e',
};

export const AutoRegModeSwitch: React.FC<{
  value: AutoRegMode;
  onChange: (mode: AutoRegMode) => void;
  /** Порядок кнопок (по умолчанию дневник → авто → выкл, как в каноне). */
  order?: AutoRegMode[];
  size?: 'sm' | 'md';
  /** Подпись «Авторегуляция:» слева (для широких карточек). */
  showTitleLabel?: boolean;
  dataHook?: string;
}> = ({ value, onChange, order = ['diary', 'auto', 'off'], size = 'sm', showTitleLabel = false, dataHook }) => {
  const pad = size === 'md' ? '5px 10px' : '4px 8px';
  const fontSize = size === 'md' ? 11 : 10;
  return (
    <div data-pl={dataHook ?? 'autoreg-mode'} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {showTitleLabel && (
        <span style={{ fontSize: 10, fontWeight: 700, color: value === 'off' ? '#71717a' : ACTIVE_COLOR[value], marginRight: 4 }}>Авторегуляция:</span>
      )}
      {order.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={active}
            title={MODE_TITLES[m]}
            style={{
              padding: pad, borderRadius: 5, fontSize, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: active ? ACTIVE_COLOR[m] : 'rgba(255,255,255,0.08)',
              color: active ? '#000' : '#fff',
            }}
          >{AUTOREG_MODE_LABELS[m]}</button>
        );
      })}
    </div>
  );
};
