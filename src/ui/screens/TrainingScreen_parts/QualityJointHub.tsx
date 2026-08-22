/** QualityJointHub.tsx — единый хаб качества и суставов.
 * Объединяет: QualityDiagnosticsHub (оценка 0-100 + диагностика) + JointMasterCard (8-блочный мастер сустава).
 * Структура как в ToolsHub / MixHub / RirForecastHub — без дублей. */
import React, { useState } from 'react';
import { QualityDiagnosticsHub, type QualityDiagnosticsHubProps } from './QualityDiagnosticsHub';
import { JointMasterCard } from './JointMasterCard';

const ACCENT = '#a855f7';
const DIM = 'rgba(255,255,255,0.5)';
type QualityJointMode = 'quality' | 'joints';

const MODE_DEFS: Array<{ m: QualityJointMode; label: string; icon: string; desc: string }> = [
  { m: 'quality', label: 'Качество + Диагностика', icon: '🎯', desc: 'Оценка 0-100, MEV/MAV/MRV, мастер движения (9 лифтов)/срывы (дневник)' },
  { m: 'joints', label: 'Суставы + ортопедия', icon: '🦴', desc: 'JSI теплокарта, 8 блоков, FMS, прехаб — тот же движок что и в Безопасность→Суставы' },
];

export const QualityJointHub: React.FC<QualityDiagnosticsHubProps & { initialMode?: QualityJointMode }> = ({ initialMode, ...props }) => {
  const [mode, setMode] = useState<QualityJointMode>(initialMode ?? 'quality');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🎯 Качество и суставы — единый хаб</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        Без дублей: <b style={{ color: '#fff' }}>качество и диагностика</b> (0-100, объём, мастер движения 9 лифтов/срывы дневник) + <b style={{ color: '#fff' }}>суставы + ортопедия</b> (JSI, 8 блоков, FMS) — в одном месте. Суставы — тот же движок <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: 3 }}>joint-load-master + joint-jsi</code> что и в «Безопасность→Суставы» (без второго расчёта). Ранее разнесены в `quality_diagnostics` и `joint_health` с дублем теплокарты — теперь единый хаб.
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: 10, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#fff' }}>Как читать:</b> «Качество» — оценка плана 0-100 и диагностика объёма/техники. «Суставы» — 8 блоков на сустав (анатомия→нагрузка→геометрия→прехаб→FMS→замены). Все графики с пояснениями внутри. Источники: объём — Israetel MEV/MAV/MRV, Helms 2019; диагностика — lift-assistance, joint-load-master (Baechle & Earle 2008), FMS Cook 2010, JSI — без выдумок.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => (
          <button key={m} onClick={() => setMode(m)} title={desc} style={{
            padding: '8px 16px', borderRadius: 8,
            border: mode === m ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: mode === m ? 'rgba(168,85,247,0.12)' : 'rgba(0,0,0,0.3)',
            color: mode === m ? ACCENT : DIM, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {mode === 'quality' && <QualityDiagnosticsHub {...props} />}
      {mode === 'joints' && <JointMasterCard />}
    </div>
  );
};

export default QualityJointHub;
