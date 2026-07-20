/** TrainingIntelligenceDashboard.tsx — визуальная сетка карточек инструментов.
 *  Категории с цветными заголовками, каждая карточка — иконка + название + описание.
 *  Без коллапсов и мелких текстов: всё видно сразу, читаемо на 320px+ */
import React from 'react';
import type { ManualResult } from './program-types';
import type { WorkoutLog } from '../../../core/types';
import type { TrainingTab } from './shared';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../../engines/pro/training-load.engine';

interface Props {
  manualResult: ManualResult | null;
  level: string;
  historyWorkouts: WorkoutLog[];
  tprofile: any;
  readinessRecovery: number;
  readinessFatigue: number;
  mesoLength: number;
  onBuildPlan: () => void;
  onOpenTool: (tab: TrainingTab) => void;
}

interface ToolCard {
  icon: string;
  label: string;
  desc: string;
  tab: TrainingTab;
  badge?: { text: string; color: string };
}

type Category = {
  icon: string;
  label: string;
  color: string;
  tools: ToolCard[];
};

export default function TrainingIntelligenceDashboard(p: Props) {
  const srpe = loadSRPESessions();
  const acwr = srpe.length >= 2 ? acuteChronicRatio(toDailyLoads(srpe)) : null;
  const acwrLabel = acwr ? (acwr.ratio > 1.5 ? 'опасно' : acwr.ratio > 1.3 ? 'осторожно' : acwr.ratio < 0.8 ? 'недотрен' : 'оптимум') : '—';
  const acwrColor = acwr ? (acwr.ratio > 1.5 ? '#ef4444' : acwr.ratio > 1.3 ? '#eab308' : acwr.ratio < 0.8 ? '#3b82f6' : '#22c55e') : '#888';

  const categories: Category[] = [
    {
      icon: '📊', label: 'Показатели', color: '#3b82f6',
      tools: [
        { icon: '🏋️', label: 'Сила', desc: '1RM, VBT, нормативы, относительная сила, аналитика', tab: 'strength_analysis',
          badge: acwr ? { text: `ACWR ${acwr.ratio.toFixed(1)}`, color: acwrColor } : undefined },
        { icon: '📈', label: 'Нагрузка', desc: 'sRPE, ACWR, монотонность, усталость, готовность', tab: 'load_management',
          badge: { text: `${p.readinessRecovery}%`, color: p.readinessRecovery >= 70 ? '#22c55e' : '#eab308' } },
      ],
    },
    {
      icon: '🎯', label: 'Качество и диагностика', color: '#a855f7',
      tools: [
        { icon: '⭐', label: 'Качество программы', desc: 'Оценка плана, MRV, рекомендации', tab: 'calc_quality' },
        { icon: '🔬', label: 'Диагностика', desc: 'Анализ плана, слабые места, погрешности', tab: 'diagnostics' },
      ],
    },
    {
      icon: '🛠', label: 'Инструменты сборки', color: '#22c55e',
      tools: [
        { icon: '🧩', label: 'Генератор сплитов', desc: '9 типов сплитов под цель и уровень', tab: 'split_gen' },
        { icon: '🏋️', label: 'Лаборатория упражнений', desc: 'Каталог, биомеханика, подбор по группе', tab: 'exercise_lab' },
        { icon: '⚖️', label: 'Тоннаж и КПШ', desc: 'Калькулятор нагрузки, УОИ, интенсивность', tab: 'tonnage' },
        { icon: '🔄', label: 'PRI и схема повторов', desc: 'Готовность, RIR, паттерн, сложность', tab: 'pri_reppat' },
        { icon: '🥞', label: 'Калькулятор блинов', desc: 'Гриф, блины, %1RM, разминка', tab: 'calc_plates' },
        { icon: '📐', label: 'Расчёт объёма', desc: 'MEV/MAV/MRV, оптимизация по группам', tab: 'volume' },
      ],
    },
    {
      icon: '⚕', label: 'Периодизация', color: '#f59e0b',
      tools: [
        { icon: '📅', label: 'Фазы и циклы', desc: 'Дизайнер периодизации, делод, прогрессия', tab: 'periodization_hub' },
        { icon: '🫀', label: 'Нагрузка и безопасность', desc: 'Кардио, ортопедия, распределение недели', tab: 'load_safety' },
      ],
    },
    {
      icon: '💊', label: 'Подготовка к тренировке', color: '#ec4899',
      tools: [
        { icon: '🧪', label: 'Тренировочные миксы', desc: 'Подбор пред-/интра-/пост-тренировочных стеков по цели и весу', tab: 'training_mix_hub' },
        { icon: '🛡️', label: 'Пресеты здоровья', desc: 'Жиросжигание, суставы, ЖКТ, сон, гидратация, противовоспал, иммунитет', tab: 'mix_presets' },
      ],
    },
  ];

  const isWide = false; // always 2-col on mobile, 1-col at <=360px handled by CSS

  return (
    <div style={{ padding: '2px 0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ padding: '0 4px', marginBottom: 2 }}>
        <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 800, color: '#fff' }}>
          ⚡ Интеллект тренировки
        </h3>
        <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.35 }}>
          Инструменты анализа, сборки и контроля качества тренировочного процесса
        </p>
      </div>

      {/* Categories */}
      {categories.map(cat => (
        <div key={cat.label} style={{
          borderRadius: 14, overflow: 'hidden',
          background: 'rgba(24,24,27,0.2)', border: '1px solid rgba(255,255,255,0.04)',
        }}>
          {/* Category header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 10px 6px',
          }}>
            <span style={{ fontSize: 13 }}>{cat.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: cat.color,
              textTransform: 'uppercase', letterSpacing: 0.4, flex: 1,
            }}>{cat.label}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{cat.tools.length}</span>
          </div>

          {/* Tool cards grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
            padding: '0 6px 6px',
          }}>
            {cat.tools.map(t => (
              <button key={t.tab} onClick={() => p.onOpenTool(t.tab)} style={{
                display: 'flex', flexDirection: 'column', gap: 3,
                padding: '10px 8px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer', textAlign: 'left', color: '#fff',
                transition: 'all 0.15s', minHeight: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                  <span style={{ fontSize: 15 }}>{t.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, lineHeight: 1.2 }}>
                    {t.label}
                  </span>
                  {t.badge && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                      color: t.badge.color, padding: '1px 5px', borderRadius: 4,
                      background: t.badge.color + '15',
                      whiteSpace: 'nowrap',
                    }}>
                      {t.badge.text}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
                  {t.desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Quick actions */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
        marginTop: 2,
      }}>
        {!p.manualResult && (
          <button onClick={p.onBuildPlan} style={{
            gridColumn: '1 / -1',
            padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
            border: '1px solid rgba(0,230,138,0.25)',
            background: 'rgba(0,230,138,0.06)',
            color: '#00e68a', fontWeight: 700, fontSize: 11,
            textAlign: 'center',
          }}>
            → Построить план тренировок
          </button>
        )}
      </div>
    </div>
  );
}
