/** PlannerToolsPanel.tsx — инструменты планирования, доступные прямо в зоне «Планировщик».
 * Только инструменты, релевантные планированию — каждый подключён к planner-bridge.
 * Состав подобран под режим (ПЛ-авто / ББ-авто / Ручной сбор). */
import React, { useState } from 'react';
import { ExpandableCard, CalcSection, PopupNumber, PopupSelect } from '../SRCBBScreen_parts/TrainingPopups';

// ПЛ-специфичные
import { PlWeakpointsCard } from './PlWeakpointsCard';
import { RelativeStrengthCalcTab } from './RelativeStrengthCalcTab';
import PeakingProtocolTab from './PeakingProtocolTab';
import { TaperPlannerTab } from './TaperPlannerTab';

// Общие (сила/нагрузка/периодизация)
import { PriRepPatternCard } from './PriRepPatternCard';
import { StrengthAnalyticsCard } from './StrengthAnalyticsCard';
import { OneRmCalcTab } from './OneRmCalcTab';
import { MRVEstimatorTab } from './MRVEstimatorTab';
import { FatigueIndexTab } from './FatigueIndexTab';
import { DeloadSchedulerTab } from './DeloadSchedulerTab';
import { LoadSafetyCard } from './LoadSafetyCard';
import { VBTCalcTab } from './VBTCalcTab';
import { PeriodizationDesignerTab } from './PeriodizationDesignerTab';
import { MesocycleProgressionCard } from './MesocycleProgressionCard';
import MesoCorrectionCard from './MesoCorrectionCard';
import { TrainingLoadCalculator } from './TrainingLoadCalculator';
import { WhatIfCard } from './WhatIfCard';
import StickingPointAnalysisCard from './StickingPointAnalysisCard';
import VolumeRecoveryCorrelationCard from './VolumeRecoveryCorrelationCard';
import { DEFAULT_PROFILE } from './training-profile';

// ББ-специфичные
import { SplitGenCard } from './SplitGenCard';
import { TempoTab } from './TempoTab';
import { VolumeOptimizerTab } from './VolumeOptimizerTab';

interface ToolDef { id: string; title: string; icon: string; short: string; render: () => React.ReactNode; }

const TOOLS: Record<'pl' | 'bb', ToolDef[]> = {
  // ═══ ПЛ-АВТО ═══
  pl: [
    { id: 'str', title: 'Аналитика силы', icon: '💪', short: 'Процентиль, уровень, соотношения, объёмные ориентиры.', render: () => <StrengthAnalyticsCard /> },
    { id: '1rm', title: 'Калькулятор 1RM', icon: '🎯', short: 'Оценка максимума по весу и повторениям → ПМ планировщику.', render: () => <OneRmCalcTab /> },
    { id: 'weak', title: 'Слабые точки ПЛ', icon: '🎯', short: 'Диагностика мёртвой точки движения → ассистентные упражнения.', render: () => <PlWeakpointsCard /> },
    { id: 'relstr', title: 'Относительная сила', icon: '⚖️', short: 'Wilks/DOTS/GL — определение слабейшего движения.', render: () => <RelativeStrengthCalcTab /> },
    { id: 'sticking', title: 'Анализ срывов', icon: '🔬', short: 'По истории тренировок: где срыв и какие мышцы слабые.', render: () => <StickingPointAnalysisCard sessions={[]} /> },
    { id: 'pri', title: 'PRI / готовность', icon: '🧠', short: 'Готовность к тренировке (PRI) + RIR-корректировка.', render: () => <PriRepPatternCard /> },
    { id: 'fatigue', title: 'Индекс усталости', icon: '📉', short: 'ACWR, монотонность, strain → корректировка объёма.', render: () => <FatigueIndexTab /> },
    { id: 'load', title: 'Нагрузка / авторег', icon: '🫀', short: 'Кардио, ортопедия, распределение недели, RPE-авторегуляция.', render: () => <LoadSafetyCard /> },
    { id: 'mrv', title: 'MRV-оценщик', icon: '📊', short: 'Индивидуальный MRV из истории sRPE и готовности.', render: () => <MRVEstimatorTab /> },
    { id: 'volrec', title: 'Объём↔восстановление', icon: '🔄', short: 'Корреляция объёма и готовности → оценка MRV.', render: () => <VolumeRecoveryCorrelationCard sessions={[]} /> },
    { id: 'loadcalc', title: 'Калькулятор нагрузки', icon: '📊', short: 'sRPE/ACWR/Banister — острая/хроническая нагрузка.', render: () => <TrainingLoadCalculator /> },
    { id: 'meso', title: 'Прогрессия мезо', icon: '📈', short: 'Кривые V/I/RIR по неделям → стартовый объём планировщику.', render: () => <MesocycleProgressionCard weeks={12} startVolumeSets={18} startIntensityPct={0.75} startRIR={3} goal="hypertrophy" fatigueTrajectory={[]} /> },
    { id: 'mesocorr', title: 'Коррекция мезо', icon: '🔧', short: 'Авто-корректировка объёма/RIR/deload по данным.', render: () => {
      const emptyProfile = { ...DEFAULT_PROFILE, goal: 'strength' as const, workMax: {} };
      return <MesoCorrectionCard profile={emptyProfile} acwr={1} monotony={1} avgReadiness={80} mesoWeeks={12} missedSessions={0} exercises={[]} currentVolume={18} currentRir={2} />;
    } },
    { id: 'peak', title: 'Пик-протокол', icon: '⚡', short: 'Пиковая фаза: объём ↓, RIR→0, интенсивность ↑.', render: () => <PeakingProtocolTab /> },
    { id: 'taper', title: 'Taper-планер', icon: '🏁', short: 'Тейпер к соревнованию: объём ↓, прикиды, таймлайн.', render: () => <TaperPlannerTab /> },
    { id: 'deload', title: 'Планировщик делода', icon: '🧘', short: 'Авто-расписание разгрузочных недель.', render: () => <DeloadSchedulerTab /> },
    { id: 'period', title: 'Дизайнер периодизации', icon: '🔄', short: 'Блочный макроцикл: drag-and-drop фаз на таймлайн.', render: () => <PeriodizationDesignerTab /> },
    { id: 'whatif', title: 'What-if сценарий', icon: '🔮', short: 'Прогноз риск/готовность от калорий/сна/AAS.', render: () => <WhatIfCard baseRisk={20} baseReadiness={75} /> },
    { id: 'comp', title: 'Соревнование', icon: '🏆', short: 'Категория, стратегия подходов, таймлайн, восстановление.', render: () => <div style={{padding:12,fontSize:11,color:'var(--text-dim)'}}>🏋️ Соревнование перенесено в инструмент «Пиковая фаза» внутри ПЛ-авто (вкладка «Пик» → режим «Соревнование»).</div> },
  ],

  // ═══ ББ-АВТО ═══
  bb: [
    { id: 'bb', title: 'ББ-инструменты', icon: '💪', short: 'Темп/отдых, техники, слабые группы, демография — теперь в лаборатории упражнений.', render: () => (
      <div style={{ padding: 12, fontSize: 11 }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 8, lineHeight: 1.5 }}>
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
    { id: 'pri', title: 'PRI / готовность', icon: '🧠', short: 'Готовность к тренировке + RIR-корректировка.', render: () => <PriRepPatternCard /> },
    { id: 'fatigue', title: 'Индекс усталости', icon: '📉', short: 'ACWR, монотонность, strain → корректировка объёма.', render: () => <FatigueIndexTab /> },
    { id: 'load', title: 'Нагрузка / авторег', icon: '🫀', short: 'Кардио, ортопедия, распределение недели, RPE-авторегуляция.', render: () => <LoadSafetyCard /> },
    { id: 'mrv', title: 'MRV-оценщик', icon: '📊', short: 'Индивидуальный MRV из истории sRPE и готовности.', render: () => <MRVEstimatorTab /> },
    { id: 'volrec', title: 'Объём↔восстановление', icon: '🔄', short: 'Корреляция объёма и готовности → оценка MRV.', render: () => <VolumeRecoveryCorrelationCard sessions={[]} /> },
    { id: 'volopt', title: 'Оптимизатор объёма', icon: '📐', short: 'Полный анализ объёма: per-muscle MEV/MAV/MRV, SFR, CNS.', render: () => <VolumeOptimizerTab /> },
    { id: 'loadcalc', title: 'Калькулятор нагрузки', icon: '📊', short: 'sRPE/ACWR/Banister — острая/хроническая нагрузка.', render: () => <TrainingLoadCalculator /> },
    { id: 'sticking', title: 'Анализ срывов', icon: '🔬', short: 'Где «зависает» прогресс и какие мышцы отстают.', render: () => <StickingPointAnalysisCard sessions={[]} /> },
    { id: 'str', title: 'Аналитика силы', icon: '💪', short: 'Процентиль, уровень, соотношения, ориентиры.', render: () => <StrengthAnalyticsCard /> },
    { id: '1rm', title: 'Калькулятор 1RM', icon: '🎯', short: 'Оценка максимума → ПМ планировщику.', render: () => <OneRmCalcTab /> },
    { id: 'meso', title: 'Прогрессия мезо', icon: '📈', short: 'Кривые V/I/RIR по неделям → стартовый объём.', render: () => <MesocycleProgressionCard weeks={8} startVolumeSets={16} startIntensityPct={0.72} startRIR={3} goal="hypertrophy" fatigueTrajectory={[]} /> },
    { id: 'mesocorr', title: 'Коррекция мезо', icon: '🔧', short: 'Авто-корректировка объёма/RIR/deload.', render: () => {
      const emptyProfileBB = { ...DEFAULT_PROFILE, goal: 'hypertrophy' as const, bodyWeight: 75, pmSquat: 80, pmBench: 60, pmDead: 100, workMax: {} };
      return <MesoCorrectionCard profile={emptyProfileBB} acwr={1} monotony={1} avgReadiness={80} mesoWeeks={8} missedSessions={0} exercises={[]} currentVolume={16} currentRir={3} />;
    } },
    { id: 'deload', title: 'Планировщик делода', icon: '🧘', short: 'Авто-расписание разгрузочных недель.', render: () => <DeloadSchedulerTab /> },
    { id: 'period', title: 'Дизайнер периодизации', icon: '🔄', short: 'Блочный макроцикл: drag-and-drop фаз.', render: () => <PeriodizationDesignerTab /> },
    { id: 'whatif', title: 'What-if сценарий', icon: '🔮', short: 'Прогноз риск/готовность от калорий/сна/AAS.', render: () => <WhatIfCard baseRisk={20} baseReadiness={75} /> },
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
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', margin: '12px 0 6px', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        🔧 Инструменты планирования ({tools.length})
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>
        {TITLE_RU[mode]} — раскройте нужный инструмент, он откроется прямо здесь. Каждый имеет кнопку «🛠 Применить к планировщику».
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