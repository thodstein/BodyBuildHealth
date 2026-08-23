/** MixHub.tsx — тренировочные миксы/пресеты здоровья.
 * Объединяет: TrainingMixTab (пред/интра/пост по цели тренировки) + MixPresetsCard (7 пресетов здоровья).
 * Структура как в VolumeHub / PeriodizationTaperHub — единый расчёт, без дублей. */
import React, { useState } from 'react';
import { TrainingMixTab } from './TrainingMixTab';
import { MixPresetsCard } from './MixPresetsCard';

const ACCENT = '#00e68a';
const DIM = '#fff';
type MixHubMode = 'training' | 'health';

const MODE_DEFS: Array<{ m: MixHubMode; label: string; icon: string; desc: string }> = [
  { m: 'training', label: 'Тренировочные', icon: '💪', desc: 'Цель: памп/выносливость/сила/фокус — пред/интра/пост, тип тренировки, время, опыт' },
  { m: 'health', label: 'Пресеты здоровья', icon: '🛡️', desc: 'Жиросжиг/суставы/ЖКТ/сон/гидра/противовоспал/иммунитет — pre/intra/post' },
];

export const MixHub: React.FC<{ initialMode?: MixHubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<MixHubMode>(initialMode ?? 'training');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2 }}>🧪 Миксы</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        Без дублей: <b style={{ color: '#fff' }}>тренировочные миксы</b> (цель тренировки → пред/интра/пост, скоринг, фарма) + <b style={{ color: '#fff' }}>пресеты здоровья</b> (7 готовых составов pre/intra/post по весу) — в одном месте. Ранее разнесены в `training_mix_hub` и `mix_presets` с дублем движка `training-mix-scoring` — теперь единый расчёт. Источники: составы по ISSN, Examine.com — без выдумок.
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#fff' }}>Как читать:</b> «Тренировочные» — подбор по цели тренировки (памп/сила/выносливость) + тип/время/опыт/фарма. «Пресеты» — 7 готовых стеков здоровья (жиросжигание, суставы, ЖКТ, сон, гидратация, противовоспалительный, иммунитет). Сохранение → дневник + избранное + план поддержки — единые мосты.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => (
          <button key={m} onClick={() => setMode(m)} title={desc} style={{
            padding: '8px 16px', borderRadius: 8,
            border: mode === m ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: mode === m ? 'rgba(0,230,138,0.1)' : 'rgba(0,0,0,0.3)',
            color: mode === m ? ACCENT : DIM, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {mode === 'training' && <TrainingMixTab />}
      {mode === 'health' && <MixPresetsCard />}
    </div>
  );
};

export default MixHub;
