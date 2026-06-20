import React, { useState, useEffect } from 'react';
import { db } from '../../core/db';
import type { CourseEntry } from '../../core/types';
import { generatePCTPlan } from '../../engines/pct-planner.engine';
import type { PCTProtocolItem } from '../../engines/pct-planner.engine';
import { PHARMA_DB } from '../../core/pharma-database';

const CLASS_COLORS: Record<string, string> = {
  pct_serm: '#22c55e', pct_aromatase: '#ef4444', pct_dopamine: '#eab308',
  pct_gonadotropin: '#3b82f6',
};

const CLASS_LABELS: Record<string, string> = {
  pct_serm: 'СЕРМ', pct_aromatase: 'Ингибиторы ароматазы',
  pct_dopamine: 'Дофаминовые агонисты', pct_gonadotropin: 'Гонадотропины',
};

interface Props {
  onBack: () => void;
}

export const PctScreen: React.FC<Props> = ({ onBack }) => {
  const [course, setCourse] = useState<CourseEntry[]>([]);
  const [pctPlan, setPctPlan] = useState<ReturnType<typeof generatePCTPlan> | null>(null);

  useEffect(() => {
    db.init().then(() => db.getAll<CourseEntry>('course_log'))
      .then(data => setCourse(data))
      .catch(() => {});
  }, []);

  const buildPCT = () => {
    const plan = generatePCTPlan(course, Math.max(...course.map(c => c.endWeek)));
    setPctPlan(plan);
  };

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={onBack} style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text)',
        }}>← Назад</button>
        <h2 style={{ margin: 0, fontSize: 18 }}>🌱 ПКТ и Фертильность</h2>
      </div>

      {course.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💊</div>
          <div>Курс не найден</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Добавьте препараты во вкладке Фармакология {'>'} Курс</div>
        </div>
      )}

      {course.length > 0 && !pctPlan && (
        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
            Активных веществ в курсе: {course.length}
          </div>
          <button onClick={buildPCT} style={{
            padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: 'linear-gradient(135deg, #00e68a, #00c77a)', color: '#000', border: 'none',
          }}>
            🔄 Сгенерировать ПКТ
          </button>
        </div>
      )}

      {pctPlan && (
        <>
          <div className="card">
            <h3 style={{ margin: '0 0 8px' }}>📋 План ПКТ</h3>
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              Начало: <b>неделя {pctPlan.pctStartWeek}</b>
            </div>
            {pctPlan.warnings.length > 0 && (
              <div style={{ background: 'rgba(255,152,0,0.1)', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
                {pctPlan.warnings.map((w: string, i: number) => (
                  <div key={i} style={{ fontSize: 10, color: '#ff9800' }}>⚠ {w}</div>
                ))}
              </div>
            )}
            {pctPlan.pctProtocol.map((p: PCTProtocolItem, i: number) => (
              <div key={i} style={{
                background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', marginBottom: 6,
                borderLeft: `3px solid ${CLASS_COLORS[p.class] || '#666'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{PHARMA_DB[p.substanceId]?.name || p.substanceId}</span>
                    <span style={{
                      fontSize: 9, marginLeft: 6, padding: '2px 6px', borderRadius: 4,
                      background: `${CLASS_COLORS[p.class] || '#666'}22`, color: CLASS_COLORS[p.class] || '#666',
                    }}>{CLASS_LABELS[p.class] || p.class}</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{p.dose}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                  {p.timing} | Нед {p.startWeek}-{p.endWeek}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px' }}>🧬 Фертильность</h3>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
              Рекомендации для восстановления фертильности после курса
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: '📅', label: 'Длительность', desc: `${pctPlan.pctProtocol.reduce((max: number, p: any) => Math.max(max, p.endWeek || 0), 0) - pctPlan.pctStartWeek + 1} недель` },
                { icon: '💊', label: 'Препараты', desc: `${pctPlan.pctProtocol.length} препаратов в протоколе` },
                { icon: '📊', label: 'Мониторинг', desc: 'Контроль гормонов каждые 2-4 нед' },
                { icon: '🧬', label: 'Восстановление', desc: 'Цель: LH/ФСГ > 5, тестостерон > 15 нмоль/л' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
