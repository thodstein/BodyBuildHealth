/** PlannerToolsPanel.tsx — инструменты планирования, доступные прямо в зоне «Планировщик».
 * Переиспользует уже созданные карточки (одна реализация — без дубля кода) и встраивает их
 * inline через expandable-секции в зависимости от режима (ПЛ-авто / ББ-авто / Ручной сбор). */
import React, { useState } from 'react';
import { ExpandableCard } from '../SRCBBScreen_parts/TrainingPopups';
import { PlWeakpointsCard } from './PlWeakpointsCard';
import { PriRepPatternCard } from './PriRepPatternCard';
import { CompetitionCard } from './CompetitionCard';
import { StrengthAnalyticsCard } from './StrengthAnalyticsCard';
import { LoadSafetyCard } from './LoadSafetyCard';
import { BbToolsCard } from './BbToolsCard';
import { SplitGenCard } from './SplitGenCard';
import { SynergyMatrixCard } from './SynergyMatrixCard';
import { MixPresetsCard } from './MixPresetsCard';
import { GoalsHabitsCard } from './GoalsHabitsCard';

interface ToolDef { id: string; title: string; icon: string; short: string; render: () => React.ReactNode; }
const TOOLS: Record<'pl' | 'bb' | 'manual', ToolDef[]> = {
  pl: [
    { id: 'weak', title: 'Слабые точки ПЛ', icon: '🎯', short: 'Диагностика мёртвой точки движения → ассистентные упражнения и %ПМ.', render: () => <PlWeakpointsCard /> },
    { id: 'pri', title: 'PRI / схема повторений', icon: '🧠', short: 'Готовность к тренировке (PRI) + схема повторений по цели/паттерну.', render: () => <PriRepPatternCard /> },
    { id: 'comp', title: 'Соревнование', icon: '🏆', short: 'Весовая категория, стратегия подходов, таймлайн, восстановление.', render: () => <CompetitionCard /> },
    { id: 'str', title: 'Аналитика силы', icon: '💪', short: 'Процентиль, уровень, соотношения, объёмные ориентиры, прогноз.', render: () => <StrengthAnalyticsCard /> },
    { id: 'load', title: 'Нагрузка / авторегуляция', icon: '🫀', short: 'Кардио-план, ортопедические ограничения, распределение недели, RPE-авторег.', render: () => <LoadSafetyCard /> },
  ],
  bb: [
    { id: 'bb', title: 'ББ-инструменты', icon: '💪', short: 'Темп/отдых/TUT, техники интенсификации, слабые точки, демография.', render: () => <BbToolsCard /> },
    { id: 'split', title: 'Генератор сплитов', icon: '🧩', short: '9 типов сплитов под цель/дни/слабые группы.', render: () => <SplitGenCard /> },
    { id: 'syn', title: 'Синергия веществ', icon: '🧬', short: 'Парная синергия/конфликт БАД (подбор стека под цель).', render: () => <SynergyMatrixCard /> },
    { id: 'mix', title: 'Пресеты миксов', icon: '🧪', short: 'Готовые составы pre/intra/post (жир/суставы/ЖКТ/сон/гидратация/восст.).', render: () => <MixPresetsCard /> },
    { id: 'load', title: 'Нагрузка / авторегуляция', icon: '🫀', short: 'Кардио, ортопедия, распределение недели, RPE-авторегуляция.', render: () => <LoadSafetyCard /> },
  ],
  manual: [
    { id: 'split', title: 'Генератор сплитов', icon: '🧩', short: 'Подбор структуры сплита под цель/дни/слабые группы.', render: () => <SplitGenCard /> },
    { id: 'bb', title: 'ББ-инструменты', icon: '💪', short: 'Темп/отдых, техники интенсификации, слабые точки, демография.', render: () => <BbToolsCard /> },
    { id: 'pri', title: 'PRI / схема повторений', icon: '🧠', short: 'Готовность + схема повторений по цели/паттерну.', render: () => <PriRepPatternCard /> },
    { id: 'str', title: 'Аналитика силы', icon: '💪', short: 'Процентиль, уровень, соотношения, объёмные ориентиры.', render: () => <StrengthAnalyticsCard /> },
    { id: 'goals', title: 'Цели и привычки', icon: '🎯', short: 'Постановка целей с прогрессом + трекинг ежедневных привычек.', render: () => <GoalsHabitsCard /> },
  ],
};

const TITLE_RU: Record<'pl' | 'bb' | 'manual', string> = { pl: '🏆 ПЛ — инструменты планирования', bb: '💪 ББ — инструменты планирования', manual: '🛠 Ручной сбор — инструменты планирования' };

export const PlannerToolsPanel: React.FC<{ mode: 'pl' | 'bb' | 'manual' }> = ({ mode }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const tools = TOOLS[mode] || [];
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        🔧 Инструменты планирования (доступны здесь)
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>
        {TITLE_RU[mode]} — раскройте нужный инструмент, он откроется прямо здесь, без перехода в «Калькуляторы».
      </div>
      {tools.map(t => {
        const open = openId === t.id;
        return (
          <div key={t.id} style={{ background: 'rgba(24,24,27,0.5)', borderRadius: 10, border: '1px solid rgba(0,230,138,0.12)', margin: '6px 0', overflow: 'hidden' }}>
            <button onClick={() => setOpenId(open ? null : t.id)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', textAlign: 'left' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#00e68a' }}>{t.icon} {t.title}</span>
              <span style={{ fontSize: 10, color: '#00e68a' }}>{open ? '▲' : '▼'}</span>
            </button>
            {!open && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', padding: '0 12px 8px' }}>{t.short}</div>}
            {open && <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: 4 }}>{t.render()}</div>}
          </div>
        );
      })}
    </div>
  );
};
