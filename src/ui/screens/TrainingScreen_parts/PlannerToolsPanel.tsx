/** PlannerToolsPanel.tsx — инструменты планирования, доступные прямо в зоне «Планировщик».
 * Только инструменты, релевантные планированию — каждый подключён к planner-bridge.
 * Состав подобран под режим (ПЛ-авто / ББ-авто / Ручной сбор). */
import React, { useState } from 'react';

// Общие (сила/нагрузка/периодизация)
import { StrengthAnalysisHub } from './StrengthAnalysisHub';

// ББ-специфичные
import { SplitGenCard } from './SplitGenCard';
import { TempoTab } from './TempoTab';
import { VolumeOptimizerTab } from './VolumeOptimizerTab';

interface ToolDef { id: string; title: string; icon: string; short: string; render: () => React.ReactNode; }

const TOOLS: Record<'pl' | 'bb', ToolDef[]> = {
  // ═══ ПЛ-АВТО ═══
  pl: [
    // «🔬 Диагностика» убрана — полный калькулятор движения (PlDeadpointsBarPathCard)
    // живёт во вкладке «📋 План цикла» (с template + сессиями дневника); анализ срывов
    // по дневнику — в аналитике дневника (StickingPointAnalysisCard с реальными данными).
    // «🛡 Безопасность и нагрузка» (TrainingSafetyHub) удалён по ТЗ — не показывается в ПЛ-авто.
    { id: 'intelligence-strength', title: 'Анализ силы', icon: '🏋️', short: 'Интеллектуальный анализ силы: 1RM, VBT, относительная сила, нормативы и аналитика.', render: () => <StrengthAnalysisHub /> },
  ],

  // ═══ ББ-АВТО ═══
  bb: [
    { id: 'bb', title: 'ББ-инструменты', icon: '💪', short: 'Темп/отдых, техники, слабые группы, демография — теперь в лаборатории упражнений.', render: () => (
      <div style={{ padding: 12, fontSize: 11 }}>
        <div style={{ color:'rgba(255,255,255,0.9)', marginBottom: 8, lineHeight: 1.5 }}>
          ББ-инструменты объединены с Лабораторией упражнений в единый ПРОФ-калькулятор.
          Перейдите в зону «Калькуляторы» → «Лаборатория упражнений» → вкладка «ББ-инструменты».
        </div>
        <button onClick={() => { const ev = new CustomEvent('he_training_nav', { detail: { zone: 'calculators', tab: 'exercise_lab' } }); window.dispatchEvent(ev); }}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: '#00e68a', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>
          🧬 Открыть Лабораторию упражнений
        </button>
      </div>
    ) },
    { id: 'split', title: 'Генератор сплитов', icon: '🧩', short: '9 типов сплитов под цель/дни/слабые группы.', render: () => <SplitGenCard /> },
    { id: 'tempo', title: 'Темп повторений', icon: '⏱️', short: 'Эксцентрика/пауза/концентрика/пауза по цели.', render: () => <TempoTab /> },
    { id: 'volopt', title: 'Оптимизатор объёма', icon: '📐', short: 'Полный анализ объёма: per-muscle MEV/MAV/MRV, SFR, CNS.', render: () => <VolumeOptimizerTab /> },
  ],

  // ═══ РУЧНОЙ СБОР убран — давал убогие программы. ПЛ-авто и ББ-авто покрывают все сценарии. ═══
};

const TITLE_RU: Record<'pl' | 'bb', string> = {
  pl: '🏆 ПЛ — инструменты планирования',
  bb: '💪 ББ — инструменты планирования',
};

export const PlannerToolsPanel: React.FC<{ mode: 'pl' | 'bb' }> = ({ mode }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const tools = TOOLS[mode] || [];
  return (
    <div style={{ marginTop: 6, minWidth: 0, maxWidth: '100%' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', margin: '8px 0 4px', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        🔧 Инструменты планирования ({tools.length})
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.4 }}>
        {TITLE_RU[mode]} — раскройте нужный инструмент, он откроется прямо здесь. Каждый имеет кнопку «🛠 Применить к планировщику».
      </div>
      {tools.map(t => {
        const open = openId === t.id;
        return (
          <div key={t.id} style={{ background: 'rgba(24,24,27,0.5)', borderRadius: 10, border: '1px solid rgba(0,230,138,0.12)', margin: '6px 0', overflow: 'hidden', minWidth: 0, maxWidth: '100%' }}>
            <button onClick={() => setOpenId(open ? null : t.id)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', textAlign: 'left', minHeight: 38, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#00e68a', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{t.icon} {t.title}</span>
              <span style={{ fontSize: 10, color: '#00e68a', flexShrink: 0, marginLeft: 8 }}>{open ? '▲' : '▼'}</span>
            </button>
            {!open && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', padding: '0 12px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.short}</div>}
            {open && <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: 4, minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }}>{t.render()}</div>}
          </div>
        );
      })}
    </div>
  );
};
