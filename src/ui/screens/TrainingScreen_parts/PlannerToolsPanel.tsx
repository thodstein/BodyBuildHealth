/** PlannerToolsPanel.tsx — инструменты планирования, доступные прямо в зоне «Планировщик».
 * Только инструменты, релевантные планированию — каждый подключён к planner-bridge.
 * Состав подобран под режим (ПЛ-авто / ББ-авто / Ручной сбор).
 * ПЛ-авто: все инструменты из «⚡ Интеллект тренировки» как отдельные красивые раскрывающиеся карточки. */
import React, { useState } from 'react';

// Интеллект — все хабы
import { UnifiedIntelligenceHub } from './UnifiedIntelligenceHub';
import { StrengthAnalysisHub } from './StrengthAnalysisHub';
import { QualityHub } from './QualityHub';
import { DiagnosticsHub } from './DiagnosticsHub';
import { JointMasterCard } from './JointMasterCard';
import { PeriodizationHub } from './PeriodizationHub';
import ExerciseLabMerged from './ExerciseLabMerged';
import { VolumeHub } from './VolumeHub';
import { MixHub } from './MixHub';
import { MetabolicHub } from '../Shared/MetabolicHub';
import { ToolsHub } from './ToolsHub';
import { RirForecastHub } from './RirForecastHub';
import { TrainingSafetyHub } from './TrainingSafetyHub';

// ББ-специфичные
import { SplitGenCard } from './SplitGenCard';
import { TempoTab } from './TempoTab';
import { VolumeOptimizerTab } from './VolumeOptimizerTab';

interface ToolDef { id: string; title: string; icon: string; short: string; accent: string; desc: string; render: () => React.ReactNode; }

const goManual = () => {
  const fn = (window as any).__navigateToTrainingTab;
  if (typeof fn === 'function') fn('programcalc');
};

// обёртки с пропсами-заглушками (берут данные из профиля/дневника внутри хабов где нужно)
const QualityWrap = () => <QualityHub onBuildPlan={goManual} />;
const DiagnosticsWrap = () => (
  <DiagnosticsHub
    sessions={[] as any}
    tprofile={{} as any}
    readinessRecovery={70}
    readinessFatigue={30}
    mesoWeeks={12}
    missedSessions={0}
    currentVolume={18}
    currentRir={2}
  />
);

const TOOLS: Record<'pl' | 'bb', ToolDef[]> = {
  // ═══ ПЛ-АВТО — все инструменты Интеллекта ═══
  pl: [
    { id: 'intel', title: 'Интеллект тренировки', icon: '⚡', accent: '#00e68a', short: 'Единый пульт: нагрузка → восстановление → авторегуляция → прогноз', desc: 'ACWR/Banister/monotony · сон/HRV/готовность · PRI/RPE-вес · Хольт/what-if — один снапшот, без дублей', render: () => <UnifiedIntelligenceHub /> },
    { id: 'strength', title: 'Анализ силы', icon: '🏋️', accent: '#3b82f6', short: '1RM (7 формул), VBT, относительная сила, нормативы, аналитика', desc: 'Один снапшот пол/вес/присед/жим/тяга → 5 секций: 1RM · VBT · отн.сила · нормативы · аналитика', render: () => <StrengthAnalysisHub /> },
    { id: 'diagnostics', title: 'Диагностика движения', icon: '🔬', accent: '#60a5fa', short: '9 лифтов: углы, траектория штанги, скорость, видео', desc: 'Мастер 9 движений + мёртвые точки + лимитеры + VBT + видео — точечные коррекции в план', render: () => <DiagnosticsWrap /> },
    { id: 'joints', title: 'Суставы и ортопедия', icon: '🦴', accent: '#f43f5e', short: 'JSI теплокарта · анатомия · нагрузка · прехаб · видео', desc: '9 блоков в одном скролле: JSI → анатомия → нагрузка → геометрия → прехаб → недельный план → видео', render: () => <JointMasterCard /> },
    { id: 'volume', title: 'Объём-хаб', icon: '📐', accent: '#22c55e', short: 'MEV/MAV/MRV · тоннаж/КПШ · блины', desc: 'Один расчёт объёма: пер-мышца MEV/MAV/MRV · тоннаж/КПШ/УОИ · блины 8 грифов — без дублей', render: () => <VolumeHub /> },
    { id: 'tempo', title: 'Темп повторений', icon: '⏱️', accent: '#f59e0b', short: 'Эксцентрика/пауза/концентрика/пауза по цели — полный контроль TUT (дубль Интеллекта).', desc: 'Темп по цели тренировки: эксцентрика/паузы/концентрика — один источник (Интеллект → Темп)', render: () => <TempoTab /> },
    { id: 'lab', title: 'Лаборатория упражнений', icon: '🧬', accent: '#06b6d4', short: 'Подбор · техника · PRO+замена · сравнение', desc: '4 шага: подбор+нагрузка/блины/тоннаж/1RM/VBT + техника + force-векторы + сравнение — каталог drawer', render: () => <ExerciseLabMerged /> },
    { id: 'tools', title: 'PRI / схема повторов', icon: '🧠', accent: '#8b5cf6', short: 'PRI готовность → объём/RIR + схема повторов', desc: 'PRI-тест Masuda → целевой объём/RIR + схема повторов — источник Helms/RPE/RIR', render: () => <ToolsHub /> },
    { id: 'mixes', title: 'Миксы', icon: '🧪', accent: '#ec4899', short: 'Тренировочные + пресеты здоровья', desc: 'Тренировочные (памп/сила/фокус пред/интра/пост) + 7 пресетов здоровья — ISSN/Examine', render: () => <MixHub /> },
    { id: 'metabolic', title: 'Метаболика', icon: '⚖️', accent: '#38bdf8', short: 'Вода · шаги · КБЖУ · жир · кортизол', desc: '5 в 1: EFSA/Mifflin/Navy/HPA — один снапшот с/без ААС, переключатель натурал/ААС', render: () => <MetabolicHub /> },
  ],

  // ═══ ББ-АВТО — все инструменты Интеллекта + ББ-специфичные ═══
  bb: [
    { id: 'bb', title: 'ББ-инструменты', icon: '💪', accent: '#ec4899', short: 'Темп/отдых, техники, слабые группы, демография — теперь в лаборатории упражнений.', desc: 'Перейдите в зону «Калькуляторы» → «Лаборатория упражнений»', render: () => (
      <div style={{ padding: 12, fontSize: 11 }}>
        <div style={{ color:'#fff', marginBottom: 8, lineHeight: 1.5 }}>
          ББ-инструменты объединены с Лабораторией упражнений в единый ПРОФ-калькулятор.
          Перейдите в зону «Калькуляторы» → «Лаборатория упражнений» → вкладка «ББ-инструменты».
        </div>
        <button onClick={() => { const ev = new CustomEvent('he_training_nav', { detail: { zone: 'calculators', tab: 'exercise_lab' } }); window.dispatchEvent(ev); }}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(236,72,153,0.3)', background: 'rgba(236,72,153,0.08)', color: '#ec4899', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>
          🧬 Открыть Лабораторию упражнений
        </button>
      </div>
    ) },
    { id: 'split', title: 'Генератор сплитов', icon: '🧩', accent: '#22c55e', short: '9 типов сплитов под цель/дни/слабые группы.', desc: 'Автоподбор сплита под цель, дни, слабые группы — 9 шаблонов', render: () => <SplitGenCard /> },
    { id: 'tempo', title: 'Темп повторений', icon: '⏱️', accent: '#f59e0b', short: 'Эксцентрика/пауза/концентрика/пауза по цели — полный контроль TUT (дубль Интеллекта).', desc: 'Темп по цели тренировки: эксцентрика/паузы/концентрика — один источник (Интеллект → Темп)', render: () => <TempoTab /> },
    { id: 'volopt', title: 'Оптимизатор объёма', icon: '📐', accent: '#38bdf8', short: 'Полный анализ объёма: per-muscle MEV/MAV/MRV, SFR, CNS.', desc: 'MEV/MAV/MRV по мышцам + SFR + CNS — дозировка объёма', render: () => <VolumeOptimizerTab /> },
    // — Интеллект (без дублей: качество/безопасность/периодизация/RIR уже в dashboard Интеллекта) —
    { id: 'intel', title: 'Интеллект тренировки', icon: '⚡', accent: '#00e68a', short: 'Единый пульт: нагрузка → восстановление → авторегуляция → прогноз', desc: 'ACWR/Banister/monotony · сон/HRV/готовность · PRI/RPE-вес · Хольт/what-if — один снапшот, без дублей', render: () => <UnifiedIntelligenceHub /> },
    { id: 'strength', title: 'Анализ силы', icon: '🏋️', accent: '#3b82f6', short: '1RM (7 формул), VBT, относительная сила, нормативы, аналитика', desc: 'Один снапшот пол/вес/присед/жим/тяга → 5 секций: 1RM · VBT · отн.сила · нормативы · аналитика', render: () => <StrengthAnalysisHub /> },
    { id: 'diagnostics', title: 'Диагностика движения', icon: '🔬', accent: '#60a5fa', short: '9 лифтов: углы, траектория штанги, скорость, видео', desc: 'Мастер 9 движений + мёртвые точки + лимитеры + VBT + видео — точечные коррекции в план', render: () => <DiagnosticsWrap /> },
    { id: 'joints', title: 'Суставы и ортопедия', icon: '🦴', accent: '#f43f5e', short: 'JSI теплокарта · анатомия · нагрузка · прехаб · видео', desc: '9 блоков в одном скролле: JSI → анатомия → нагрузка → геометрия → прехаб → недельный план → видео', render: () => <JointMasterCard /> },
    { id: 'volume', title: 'Объём-хаб', icon: '📐', accent: '#22c55e', short: 'MEV/MAV/MRV · тоннаж/КПШ · блины', desc: 'Один расчёт объёма: пер-мышца MEV/MAV/MRV · тоннаж/КПШ/УОИ · блины 8 грифов — без дублей', render: () => <VolumeHub /> },
    { id: 'lab', title: 'Лаборатория упражнений', icon: '🧬', accent: '#06b6d4', short: 'Подбор · техника · PRO+замена · сравнение', desc: '4 шага: подбор+нагрузка/блины/тоннаж/1RM/VBT + техника + force-векторы + сравнение — каталог drawer', render: () => <ExerciseLabMerged /> },
    { id: 'tools', title: 'PRI / схема повторов', icon: '🧠', accent: '#8b5cf6', short: 'PRI готовность → объём/RIR + схема повторов', desc: 'PRI-тест Masuda → целевой объём/RIR + схема повторов — источник Helms/RPE/RIR', render: () => <ToolsHub /> },
    { id: 'mixes', title: 'Миксы', icon: '🧪', accent: '#ec4899', short: 'Тренировочные + пресеты здоровья', desc: 'Тренировочные (памп/сила/фокус пред/интра/пост) + 7 пресетов здоровья — ISSN/Examine', render: () => <MixHub /> },
    { id: 'metabolic', title: 'Метаболика', icon: '⚖️', accent: '#38bdf8', short: 'Вода · шаги · КБЖУ · жир · кортизол', desc: '5 в 1: EFSA/Mifflin/Navy/HPA — один снапшот с/без ААС, переключатель натурал/ААС', render: () => <MetabolicHub /> },
  ],
};

const TITLE_RU: Record<'pl' | 'bb', string> = {
  pl: '🏆 ПЛ — Интеллект тренировки',
  bb: '💪 ББ — инструменты планирования',
};

// — красивые раскрывающиеся карточки —
const cardStyle = (accent: string, open: boolean): React.CSSProperties => ({
  background: open ? `linear-gradient(135deg, ${accent}0F, rgba(24,24,27,0.50))` : 'rgba(24,24,27,0.42)',
  border: `1px solid ${open ? accent + '28' : 'rgba(255,255,255,0.07)'}`,
  borderLeft: `3px solid ${accent}`,
  borderRadius: 14,
  overflow: 'hidden',
  margin: '8px 0',
  backdropFilter: 'blur(12px)' as any,
  boxShadow: open ? `0 4px 16px ${accent}14, inset 0 1px 0 rgba(255,255,255,0.04)` : '0 2px 8px rgba(0,0,0,0.18)',
  transition: 'all 0.2s ease',
});
const headerBtnStyle = (accent: string, open: boolean): React.CSSProperties => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '11px 12px',
  cursor: 'pointer',
  border: 'none',
  textAlign: 'left' as const,
  background: open
    ? `linear-gradient(135deg, ${accent}16, rgba(255,255,255,0.02))`
    : `linear-gradient(135deg, ${accent}0C, transparent)`,
  borderBottom: open ? `1px solid ${accent}14` : 'none',
  transition: 'all 0.2s ease',
  minHeight: 0,
});

export const PlannerToolsPanel: React.FC<{ mode: 'pl' | 'bb' }> = ({ mode }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const tools = TOOLS[mode] || [];
  return (
    <div style={{ marginTop: 6, minWidth: 0, maxWidth: '100%' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', margin: '8px 0 4px', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        🔧 Инструменты ({tools.length})
      </div>
      <div style={{ fontSize: 10, color: '#fff', marginBottom: 8, lineHeight: 1.4, padding: '6px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {TITLE_RU[mode]} — каждый инструмент — отдельная красивая карточка. Раскройте — он откроется прямо здесь с полным интерфейсом{mode === 'pl' ? ' · Интеллект теперь внутри ПЛ-авто' : ''}.
      </div>
      {tools.map(t => {
        const open = openId === t.id;
        return (
          <div key={t.id} style={cardStyle(t.accent, open)}>
            <button onClick={() => setOpenId(open ? null : t.id)} aria-expanded={open} style={headerBtnStyle(t.accent, open)}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: `linear-gradient(135deg, ${t.accent}, ${t.accent}CC)`, color: open ? '#000' : '#fff',
                fontSize: 15, fontWeight: 800, boxShadow: `0 2px 10px ${t.accent}35`, border: `1px solid ${t.accent}55`,
                transition: 'all 0.2s',
              }}>{t.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: open ? t.accent : '#fff', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.2 }}>
                  {t.title}
                  {open && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 20, background: `${t.accent}18`, border: `1px solid ${t.accent}28`, color: t.accent, fontWeight: 800, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>открыто</span>}
                </span>
                <span style={{ fontSize: 10, color: '#fff', opacity: 0.72, display: 'block', marginTop: 1, lineHeight: 1.3, whiteSpace: open ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {open ? t.desc : t.short}
                </span>
              </span>
              <span style={{
                width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: open ? `${t.accent}18` : 'rgba(255,255,255,0.06)', border: `1px solid ${open ? t.accent + '28' : 'rgba(255,255,255,0.08)'}`,
                color: open ? t.accent : 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 800,
                transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'all 0.2s',
              }}>{open ? '▼' : '▶'}</span>
            </button>
            {!open && null}
            {open && <div style={{ padding: 6, minWidth: 0, maxWidth: '100%', overflowX: 'hidden', background: 'rgba(0,0,0,0.10)' }}>{t.render()}</div>}
          </div>
        );
      })}
      {mode === 'pl' && (
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.14)', fontSize: 10, color: '#fff', lineHeight: 1.45, textAlign: 'center' }}>
          Все инструменты Интеллекта теперь внутри ПЛ-авто → <b style={{ color: '#00e68a' }}>Инструменты</b>. Дубли убраны — один снапшот питает всё.
        </div>
      )}
    </div>
  );
};
