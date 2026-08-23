/** PeriodizationHub.tsx — унифицированный калькулятор с подвкладками.
 * Объединяет: Дизайнер, Прогрессия, Трекер, Микроциклы, Делод, Пик, Taper + Сплиты.
 * Структура как в Лаборатории упражнений (ExerciseLab). */
import React, { useState } from 'react';
import { PeriodizationDesignerTab } from './PeriodizationDesignerTab';
import { MesocycleProgressionCard } from './MesocycleProgressionCard';
import { MesocycleTrackerTab } from './MesocycleTrackerTab';
import { MicrocyclePlannerCard } from './MicrocyclePlannerCard';
import { DeloadSchedulerTab } from './DeloadSchedulerTab';
import { TaperPlannerTab } from './TaperPlannerTab';
import { SplitGenCard } from './SplitGenCard';
const ACCENT = '#00e68a';
const DIM = 'rgba(255,255,255,0.5)';
type PeriodizationHubMode = 'designer' | 'progression' | 'tracker' | 'micro' | 'deload' | 'taper' | 'splits';

const MODE_DEFS: Array<{ m: PeriodizationHubMode; label: string; icon: string; desc: string }> = [
  { m: 'designer', label: 'Дизайнер ★ Единый', icon: '🧠', desc: 'Единый инструмент: блоки + микро + делод + прогрессия + трекер (синхронизированы)' },
  { m: 'progression', label: 'Прогрессия', icon: '📈', desc: 'Отдельно: кривая объёма/интенсивности' },
  { m: 'tracker', label: 'Трекер', icon: '📊', desc: 'Отдельно: факт vs план' },
  { m: 'micro', label: 'Микроциклы', icon: '🗓️', desc: 'Отдельно: недельный план' },
  { m: 'deload', label: 'Делод', icon: '🧘', desc: 'Отдельно: делод-планировщик' },
  { m: 'taper', label: 'Тейпер/Пик', icon: '🔻', desc: 'PL 3 нед / BB 4 нед + шоу-пик' },
  { m: 'splits', label: 'Сплиты', icon: '🧩', desc: 'Отдельно: 9 сплитов' },
];

export const PeriodizationHub: React.FC<{ initialMode?: PeriodizationHubMode }> = ({ initialMode }) => {
  const [mode, setMode] = useState<PeriodizationHubMode>(initialMode ?? 'designer');

  return (
    <div style={{ padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🔄 Периодизация и тапер — единый инструмент</div>
      <div style={{ fontSize: 10, color: DIM, marginBottom: 8, lineHeight: 1.45 }}>
        <b style={{ color: ACCENT }}>Дизайнер ★ Единый</b> — один инструмент: макро-блоки + <b style={{ color: '#fff' }}>микро</b> (понедельно) + <b style={{ color: '#fff' }}>делод</b> (ACWR/HRV) + <b style={{ color: '#fff' }}>прогрессия</b> (кривая объёма) + <b style={{ color: '#fff' }}>трекер</b> (мезо 1→2→3) — всё на одних данных, без дублей. Остальные вкладки — отдельные legacy-виды для справки.
      </div>
      <div style={{ padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)', marginBottom: 10, fontSize: 10, color: DIM, lineHeight: 1.4 }}>
        <b style={{ color: '#fff' }}>Как пользоваться единым:</b> соберите дизайн (ПЛ/ББ) на таймлайне → внизу переключайте <b>🗓️ Микро</b> / <b>🧘 Делод</b> / <b>📈 Прогрессия</b> / <b>📊 Трекер</b> / <b>🔻 Тейпер</b> — всё на одних данных. Любая legacy-вкладка теперь открывает единый в нужном разделе — дублей нет.
      </div>

      <style>{`@media (max-width: 560px) { .ph-hub-nav { flex-wrap: nowrap !important; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; } .ph-hub-nav::-webkit-scrollbar { display: none; } .ph-hub-nav button { flex: 0 0 auto; } }`}</style>
      <div className="ph-hub-nav" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {MODE_DEFS.map(({ m, label, icon, desc }) => (
          <button key={m} onClick={() => setMode(m)} title={desc} style={{
            padding: '8px 16px', borderRadius: 8, minHeight: 44,
            border: mode === m ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
            background: mode === m ? 'rgba(0,230,138,0.1)' : 'rgba(0,0,0,0.3)',
            color: mode === m ? ACCENT : DIM, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {mode === 'designer' && <PeriodizationDesignerTab />}
      {mode === 'progression' && <PeriodizationDesignerTab initialUnifiedMode="progression" />}
      {mode === 'tracker' && <PeriodizationDesignerTab initialUnifiedMode="tracker" />}
      {mode === 'micro' && <PeriodizationDesignerTab initialUnifiedMode="micro" />}
      {mode === 'deload' && <PeriodizationDesignerTab initialUnifiedMode="deload" />}
      {mode === 'taper' && <PeriodizationDesignerTab initialUnifiedMode="taper" />}
      {mode === 'splits' && <PeriodizationDesignerTab initialActivePanel="splits" />}
    </div>
  );
};

/** Алиас для нового id — периодзационный тейпер-хаб (аналог VolumeHub) */
export const PeriodizationTaperHub = PeriodizationHub;

export default PeriodizationHub;
