/**
 * CardioPlanExtras.tsx — карточки «План»: валидация + кросс-мезо.
 * Своя кардио-зона: только подача поверх движков, логика не меняется.
 */
import React, { useMemo } from 'react';
import { validateCardioCycle } from '../../../engines/lms/cardio-plan-validate.engine';
import { needsMedicalBlock } from '../../../engines/lms/cardio.engine';
import type { CardioCycle } from '../../../engines/lms/cardio.engine';
import { CARD, ROW, LABEL, BTN_SMALL, Badge, ProgressBar, HINT_SM } from './CardioUI';

export const CardioValidationCard: React.FC<{
  cycle: CardioCycle | null;
  beginner: boolean;
  strict?: boolean;
  onToggleStrict?: () => void;
  /** №3 PRO-2: кнопка «+HIIT» при варнинге z2_without_hiit_low_volume. */
  onAddHiit?: () => void;
}> = ({ cycle, beginner, strict, onToggleStrict, onAddHiit }) => {
  const v = useMemo(() => {
    if (!cycle) return null;
    const cfg = cycle.config as unknown as { redFlags?: string[]; age?: number } | undefined;
    const medicalBlock = (() => {
      try { return needsMedicalBlock(cfg?.redFlags, cfg?.age); } catch { return false; }
    })();
    return validateCardioCycle(cycle, { beginner, strict, medicalBlock });
  }, [cycle, beginner, strict]);
  if (!cycle || !v) return null;
  const color = v.qualityScore >= 85 ? '#22c55e' : v.qualityScore >= 60 ? '#f59e0b' : '#ef4444';
  const bg = v.qualityScore >= 85 ? 'rgba(34,197,94,0.14)' : v.qualityScore >= 60 ? 'rgba(245,158,11,0.14)' : 'rgba(239,68,68,0.14)';
  return (
    <div style={CARD}>
      <div style={ROW}>
        <span style={LABEL}>🧪 Валидация плана</span>
        <Badge bg={bg} border={bg} color={color}>{v.qualityScore}/100 · {v.valid ? 'годен' : 'есть ошибки'}</Badge>
        {onToggleStrict && (
          <button style={strict ? { ...BTN_SMALL, background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' } : BTN_SMALL}
            onClick={onToggleStrict} aria-pressed={!!strict} aria-label="Строгий режим валидации"
            title="Строго: острые недели шаблона тоже считаются ошибками">
            {strict ? 'Строго ✓' : 'Строго'}
          </button>
        )}
      </div>
      <ProgressBar value={v.qualityScore} color={color} height={8} />
      {v.issues.slice(0, 8).map((i, k) => (
        <div key={k} style={{ fontSize: 12, lineHeight: 1.4, color: i.level === 'error' ? '#f87171' : i.level === 'warn' ? '#fbbf24' : 'rgba(255,255,255,0.72)' }}>
          {i.level === 'error' ? '⛔ ' : i.level === 'warn' ? '⚠ ' : '💡 '}{i.text}
        </div>
      ))}
      {v.issues.length > 8 && <div style={HINT_SM}>…и ещё {v.issues.length - 8}</div>}
      {onAddHiit && v.issues.some(i => i.code === 'z2_without_hiit_low_volume') && (
        <button style={{ ...BTN_SMALL, minHeight: 44 }} onClick={onAddHiit}
          aria-label="Добавить HIIT в неделю 1" data-cardio="add-hiit">
          ⚡ +HIIT в неделю 1 (SIT 8×20)
        </button>
      )}
    </div>
  );
};

export const CardioMesoRow: React.FC<{
  advice: string;
  mult: number;
  on: boolean;
  onToggle: () => void;
}> = ({ advice, mult, on, onToggle }) => (
  <div style={CARD}>
    <div style={ROW}>
      <span style={LABEL}>🔗 Кросс-мезо</span>
      <button style={on ? { ...BTN_SMALL, background: 'rgba(0,230,138,0.18)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' } : BTN_SMALL}
        onClick={onToggle} aria-pressed={on} aria-label="Стартовать от прошлого цикла">
        {on ? `Вкл ×${mult}` : 'Выкл'}
      </button>
    </div>
    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>{advice}</div>
    {on && mult <= 1 && <div style={HINT_SM}>Прошлый цикл без роста — множитель ×1, сборка не изменится.</div>}
  </div>
);
