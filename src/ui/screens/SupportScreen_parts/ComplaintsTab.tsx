import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SYMPTOM_DB } from '../../../engines/symptom-solver.data';
import { findSymptomById } from '../../../engines/symptom-solver.engine';
import type { SymptomEntry } from '../../../engines/symptom-solver.types';
import { getSymptomDiaryStats, getSymptomChartData, getSymptomDiarySummary, updateSymptomToday, getSymptomDiary } from '../../../engines/symptom-diary.engine';

// ── XSS escape helper ──
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ─── Локальные стили ───
const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(24,24,27,0.6)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
};

const PILL_BTN: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  minHeight: 36,
};

// ─── Категории ───
const CATEGORY_LABELS: Record<string, string> = {
  neuro: '🧠 Нейро',
  cardio: '❤️ Сердце',
  gi: '🍽 ЖКТ',
  psych: '😔 Психика',
  oda: '🦴 ОДА',
  skin: '🩹 Кожа',
  hormonal: '⚖️ Гормоны',
  other: '📋 Прочее',
};

// ─── Компонент ───
export const ComplaintsTab: React.FC<{
  onOpenSolver?: () => void;
}> = ({ onOpenSolver }) => {
  const [mode, setMode] = useState<'overview' | 'diary' | 'chart' | 'correlation' | 'all'>('overview');
  const [diaryValues, setDiaryValues] = useState<Record<string, number>>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [filterSymptom, setFilterSymptom] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => setMobile(window.innerWidth <= 480);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Симптомы по категориям
  const categories = useMemo(() => {
    const cats = new Map<string, SymptomEntry[]>();
    SYMPTOM_DB.forEach(s => {
      const cat = s.category || 'other';
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push(s);
    });
    return cats;
  }, []);

  // Все симптомы для дневника
  const allSymptomsForDiary = useMemo(() => {
    return Array.from(categories.values()).flat();
  }, [categories]);

  // Статистика дневника (пересчитывается при refreshTick)
  const stats = useMemo(() => getSymptomDiaryStats(), [refreshTick]);

  // Данные для графиков (7 и 30 дней)
  const chartData = useMemo(() => ({
    d7: getSymptomChartData(7),
    d30: getSymptomChartData(30),
  }), [refreshTick]);

  // Прогноз тренда (линейная регрессия)
  const trendForecast = useMemo(() => {
    const values = chartData.d7.values;
    if (values.length < 3) return null;
    
    // Простая линейная регрессия
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const forecast7 = Math.max(0, Math.min(10, values[n - 1] + slope * 7));
    
    return {
      slope,
      direction: slope > 0.1 ? 'up' : slope < -0.1 ? 'down' : 'stable',
      forecast7: Math.round(forecast7 * 10) / 10,
    };
  }, [chartData.d7.values]);

  // Прогресс оценки
  const totalSymptoms = allSymptomsForDiary.length;
  const diaryValuesCount = Object.keys(diaryValues).length;

  // Сохранение оценки
  const handleRateSymptom = useCallback((symId: string, severity: number) => {
    updateSymptomToday(symId, severity);
    setDiaryValues((prev) => ({ ...prev, [symId]: severity }));
    setRefreshTick(t => t + 1);
  }, []);

  // Экспорт дневника
  const handlePrintReport = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) return;
    const today = new Date().toLocaleDateString('ru-RU');
    const diaryEntries = getSymptomDiary();
    w.document.write(`
      <html><head><title>Дневник симптомов — ${today}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 20px; background: #0f172a; color: #e2e8f0; }
        h1 { color: #00e68a; border-bottom: 2px solid #00e68a; padding-bottom: 8px; }
        .meta { color: #94a3b8; margin-bottom: 16px; }
        .entry { margin: 12px 0; padding: 12px; border-left: 3px solid #00e68a; background: rgba(0,230,138,0.05); }
        .date { font-weight: 700; color: #fff; margin-bottom: 6px; }
        .symptom { margin: 4px 0; font-size: 13px; }
        .sev-0-3 { color: #4caf50; } .sev-4-6 { color: #ff9800; } .sev-7-10 { color: #f44336; }
      </style></head><body>
      <h1>📋 Дневник симптомов</h1>
      <div class="meta">Дата экспорта: ${today} · Всего записей: ${diaryEntries.length}</div>
      <hr style="border-color: rgba(255,255,255,0.1);" />
      ${diaryEntries.map(d => `
        <div class="entry">
          <div class="date">${d.date}</div>
          ${d.entries.map(v => {
            const cls = v.severity <= 3 ? 'sev-0-3' : v.severity <= 6 ? 'sev-4-6' : 'sev-7-10';
            return `<div class="symptom"><span class="${cls}">${v.severity}/10</span> — ${escapeHtml(v.symptomId)}</div>`;
          }).join('')}
        </div>
      `).join('')}
      <div style="margin-top: 20px; font-size: 11px; color: #64748b;">Сгенерировано BodyBuildHealth · symptom-diary.engine.ts</div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px' }}>
      {/* ЗАГОЛОВОК */}
      <div style={{ ...GLASS_CARD, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              📋 Сводка жалоб
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              Сегодня: {stats.activeSymptoms} симптомов · Средняя тяжесть: {stats.todayScore}/10
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {onOpenSolver && (
              <button className="pill-btn" style={{ ...PILL_BTN, background: '#3b82f6' }} onClick={onOpenSolver}>
                🔍 Решить симптом
              </button>
            )}
            <button className="pill-btn" style={{ ...PILL_BTN, background: '#ff9800' }} onClick={handlePrintReport}>
              🖨 Отчёт
            </button>
          </div>
        </div>
      </div>

      {/* РЕЖИМЫ */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['overview', 'diary', 'chart', 'correlation', 'all'] as const).map(m => (
          <button key={m} className="pill-btn" style={{
            ...PILL_BTN,
            background: mode === m ? '#00e68a' : undefined,
            color: mode === m ? '#000' : undefined,
          }} onClick={() => setMode(m)}>
            {m === 'overview' ? '📊 Обзор' : m === 'diary' ? '📝 Дневник' : m === 'chart' ? '📈 График' : m === 'correlation' ? '🔗 Корреляции' : '📋 Все'}
          </button>
        ))}
      </div>

      {/* Режим: обзор */}
      {mode === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...GLASS_CARD, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>📊 Статистика</div>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Активных', value: stats.activeSymptoms, color: '#f59e0b' },
                { label: 'Средняя', value: `${stats.todayScore}/10`, color: '#00e68a' },
                { label: 'Улучшаются', value: stats.improving, color: '#4caf50' },
                { label: 'Ухудшаются', value: stats.worsening, color: '#f44336' },
              ].map((item, i) => (
                <div key={i} style={{ ...GLASS_CARD, padding: 10, textAlign: 'center', borderLeft: `3px solid ${item.color}` }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Прогноз тренда */}
          {trendForecast && (
            <div style={{ ...GLASS_CARD, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>🔮 Прогноз на 7 дней</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: trendForecast.direction === 'down' ? 'rgba(76,175,80,0.15)' : 
                             trendForecast.direction === 'up' ? 'rgba(244,67,54,0.15)' : 
                             'rgba(255,152,0,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  {trendForecast.direction === 'down' ? '📉' : trendForecast.direction === 'up' ? '📈' : '➡️'}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
                    {trendForecast.direction === 'down' ? 'Тренд на улучшение' : 
                     trendForecast.direction === 'up' ? 'Тренд на ухудшение' : 
                     'Стабильное состояние'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    Прогноз через 7 дней: <span style={{ 
                      color: trendForecast.forecast7 <= 3 ? '#4caf50' : 
                             trendForecast.forecast7 <= 6 ? '#ff9800' : '#f44336',
                      fontWeight: 600,
                    }}>{trendForecast.forecast7}/10</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Режим: дневник */}
      {mode === 'diary' && (
        <div style={{ ...GLASS_CARD, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
            📝 Ежедневная оценка симптомов
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            Оцените каждый симптом от 0 (нет) до 10 (максимум)
          </div>

          {/* Поиск */}
          <input
            type="text"
            value={filterSymptom}
            onChange={e => setFilterSymptom(e.target.value)}
            placeholder="🔍 Поиск симптома…"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)',
              color: '#fff', fontSize: 12, boxSizing: 'border-box', fontFamily: 'inherit',
              marginBottom: 10,
            }}
          />

          {/* Прогресс */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: diaryValuesCount >= totalSymptoms ? '#00e68a' : '#f59e0b',
                width: `${totalSymptoms > 0 ? (diaryValuesCount / totalSymptoms) * 100 : 0}%`,
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              {diaryValuesCount}/{totalSymptoms}
            </span>
            <button onClick={() => { setDiaryValues({}); setRefreshTick(t => t + 1); }}
              style={{
                padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)',
                background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontWeight: 600, fontSize: 10,
                cursor: 'pointer', fontFamily: 'inherit', minHeight: 32,
              }}>Сбросить</button>
          </div>

          {Array.from(categories.entries()).map(([cat, symptoms]) => {
            const filtered = filterSymptom
              ? symptoms.filter(s => s.symptom.toLowerCase().includes(filterSymptom.toLowerCase()))
              : symptoms;
            if (filtered.length === 0) return null;
            return (
              <div key={cat} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                  {CATEGORY_LABELS[cat] || cat}
                  {filterSymptom ? ` (${filtered.length})` : ''}
                </div>
                {filtered.map((sym) => (
                  <SymptomRatingRow
                    key={sym.id}
                    symptom={sym}
                    onChange={(v) => handleRateSymptom(sym.id, v)}
                    mobile={mobile}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Режим: график */}
      {mode === 'chart' && (
        <>
          {chartData.d7.values.length === 0 ? (
            <div style={{ ...GLASS_CARD, padding: 24, textAlign: 'center', color: '#94a3b8' }}>
              Нет данных для графика. Начните оценивать симптомы в дневнике.
            </div>
          ) : (
            <>
              <div style={{ ...GLASS_CARD, padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                  📈 Динамика за 7 дней
                </div>
                <SimpleBarChart data={chartData.d7} />
              </div>
              {chartData.d30.values.length > 0 && (
                <div style={{ ...GLASS_CARD, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                    📈 Динамика за 30 дней
                  </div>
                  <SimpleBarChart data={chartData.d30} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Режим: корреляции (заглушка) */}
      {mode === 'correlation' && (
        <div style={{ ...GLASS_CARD, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
            🔗 Корреляции: симптомы vs вещества
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
            Анализ связи между приёмом веществ и изменением симптомов
          </div>
          <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
            Функция в разработке. Проверьте обновления.
          </div>
        </div>
      )}

    </div>
  );
}

/** Строка оценки симптома */
function SymptomRatingRow({ symptom, onChange, mobile }: {
  symptom: SymptomEntry;
  onChange: (v: number) => void;
  mobile?: boolean;
}) {
  const [value, setValue] = useState(0);

  const handleChange = (v: number) => {
    setValue(v);
    onChange(v);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: mobile ? 6 : 8,
      padding: mobile ? '10px 0' : '6px 0', fontSize: 13,
      borderBottom: '1px solid rgba(255,255,255,0.03)',
    }}>
      <span style={{
        color: '#e2e8f0', flex: 1, fontSize: mobile ? 14 : 12,
        cursor: 'default', lineHeight: 1.4,
      }}>{symptom.symptom}</span>
      <div style={{ display: 'flex', gap: mobile ? 4 : 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            aria-label={`${symptom.symptom}: ${n}/10`}
            style={{
              width: mobile ? 36 : 28,
              height: mobile ? 36 : 28,
              fontSize: mobile ? 13 : 11,
              padding: 0, borderRadius: '50%',
              background: value === n ? sevColorBg(n) : 'rgba(255,255,255,0.06)',
              color: value === n ? '#fff' : '#94a3b8',
              border: value === n ? 'none' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer', minWidth: mobile ? 36 : 28,
              touchAction: 'manipulation',
            }}
            onClick={() => handleChange(value === n ? 0 : n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function sevColorBg(s: number): string {
  if (s >= 7) return '#f44336';
  if (s >= 4) return '#ff9800';
  if (s > 0) return '#4caf50';
  return 'rgba(255,255,255,0.06)';
}

/** Простой бар график с анимацией */
function SimpleBarChart({ data }: { data: { labels: string[]; values: number[] } }) {
  const [mobile, setMobile] = useState(false);
  const [animated, setAnimated] = useState(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setMobile(window.innerWidth <= 480);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  
  useEffect(() => {
    setAnimated(false);
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, [data]);
  
  const barW = mobile ? 32 : Math.max(20, Math.min(40, 400 / data.values.length));

  return (
    <div>
      <div style={{
        overflowX: mobile ? 'auto' : 'visible',
        overflowY: 'hidden',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: mobile ? 3 : 2,
          height: 100, paddingTop: 8,
          minWidth: mobile ? data.values.length * (barW + 3) : undefined,
        }}>
          {data.values.map((v, i) => {
            const h = animated ? (v / 10) * 90 : 0;
            return (
              <div
                key={i}
                title={`${data.labels[i]}: ${v}/10`}
                style={{
                  width: barW,
                  height: Math.max(h, 1),
                  background: v >= 7 ? '#f44336' : v >= 4 ? '#ff9800' : v > 0 ? '#4caf50' : 'rgba(255,255,255,0.1)',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.5s ease-out',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  fontSize: mobile ? 10 : 9, color: '#94a3b8', whiteSpace: 'nowrap',
                  opacity: animated ? 1 : 0,
                  transition: 'opacity 0.3s 0.2s',
                }}>
                  {v}
                </span>
              </div>
            );
          })}
        </div>
        {/* X-axis labels */}
        <div style={{
          display: 'flex', gap: mobile ? 3 : 2,
          minWidth: mobile ? data.values.length * (barW + 3) : undefined,
        }}>
          {data.labels.map((l, i) => (
            <div key={i} style={{
              width: barW, textAlign: 'center', fontSize: mobile ? 10 : 9,
              color: '#64748b', flexShrink: 0,
            }}>{l}</div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: '#94a3b8' }}>
        <span><span style={{ color: '#4caf50' }}>●</span> 1-3 легко</span>
        <span><span style={{ color: '#ff9800' }}>●</span> 4-6 средне</span>
        <span><span style={{ color: '#f44336' }}>●</span> 7-10 тяжело</span>
      </div>
    </div>
  );
}
