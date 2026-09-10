/**
 * BBContestPrepActiveCard.tsx — сводная карточка активного contest prep
 * в дневнике тренировок. Э0: тонкая обёртка над единой BBContestPrepCard
 * (compact) — один путь чтения плана и один формат статуса.
 * Без сохранённого плана возвращает null (не показывает «не настроен» в дневнике).
 */
import React, { useMemo } from 'react';
import { getProfile } from '../../../core/profile-manager';
import { planFromStored } from '../../../engines/bb/bb-contest-prep.engine';
import { BBContestPrepCard } from '../SRCBBScreen_parts/BBContestPrepCard';

export const BBContestPrepActiveCard: React.FC<{ onOpen?: () => void }> = ({ onOpen }) => {
  const hasPlan = useMemo(() => {
    try {
      const s = getProfile().settings as any;
      return !!planFromStored(s?.goals?.bbContestPrepPlan, s?.goals?.bbPeakConfig, s?.goals, s?.personal);
    } catch { return false; }
  }, []);
  if (!hasPlan) return null;
  return (
    <div
      className="train-contestactive"
      style={{ marginBottom: 8, cursor: onOpen ? 'pointer' : 'default' }}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
    >
      <BBContestPrepCard compact onOpenConfig={onOpen} />
    </div>
  );
};

export default BBContestPrepActiveCard;
