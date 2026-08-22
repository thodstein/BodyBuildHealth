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
        { icon: '📈', label: 'Безопасность и нагрузка', desc: 'Безопасность, sRPE/ACWR, объём, авторегуляция, восстановление, кардио', tab: 'load_safety' as any,
          badge: { text: `${p.readinessRecovery}%`, color: p.readinessRecovery >= 70 ? '#22c55e' : '#eab308' } },
        { icon: '🎯', label: 'RIR + Прогноз', desc: 'Единый хаб: RIR bias/калибровка + Хольт-прогноз готовности — аналог Микс-хаба', tab: 'rir_forecast_hub' as any },
      ],
    },
    {
      icon: '🎯', label: 'Качество и диагностика', color: '#a855f7',
      tools: [
        { icon: '🎯', label: 'Качество+Диагностика', desc: 'Единый хаб: 0-100 + MEV/MAV/MRV и мастер жима/суставы/срывы', tab: 'quality_diagnostics' as any },
        { icon: '🦴', label: 'Суставы + AI', desc: 'JSI теплокарта, deadly combos, тюнинг, нутрицевтики', tab: 'joint_health' as any },
      ],
    },
    {
      icon: '🛠', label: 'Инструменты сборки', color: '#22c55e',
      tools: [
        { icon: '📐', label: 'Объём-хаб', desc: 'Единый: MEV/MAV/MRV + тоннаж/КПШ + 9 сплитов', tab: 'volume_hub' as any },
        { icon: '🏋️', label: 'Лаборатория упражнений', desc: 'Каталог, биомеханика, подбор по группе', tab: 'exercise_lab' },
        { icon: '🛠', label: 'Инструменты', desc: 'Единый хаб: PRI/паттерн + блины + основа ББ (5 пилларов)', tab: 'tools_hub' as any },
      ],
    },
    {
      icon: '⚕', label: 'Периодизация', color: '#f59e0b',
      tools: [
        { icon: '🔄', label: 'Периодизация + Тейпер', desc: 'Единый хаб: дизайнер/прогрессия/трекер/микро/делод + тейпер/пик (ПЛ/ББ циклы, возраст, пол) — аналог Объём-хаба', tab: 'periodization_taper_hub' as any },
      ],
    },
    {
      icon: '💊', label: 'Подготовка к тренировке', color: '#ec4899',
      tools: [
        { icon: '🧪', label: 'Миксы', desc: 'Единый хаб: тренировочные (пред/интра/пост по цели) + пресеты здоровья (7 составов) — аналог Объём-хаба', tab: 'mix_hub' as any },
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
