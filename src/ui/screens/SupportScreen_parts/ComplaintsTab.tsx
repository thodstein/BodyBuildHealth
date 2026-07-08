import React, { useState, useMemo, useCallback } from 'react';
import { SYMPTOM_DB } from '../../../engines/symptom-solver.data';
import { findSymptomById } from '../../../engines/symptom-solver.engine';
import type { SymptomEntry } from '../../../engines/symptom-solver.types';
import { getSymptomDiaryStats, getSymptomChartData, getSymptomDiarySummary, updateSymptomToday, SymptomTrend, getSymptomDiary } from '../../../engines/symptom-diary.engine';
// ─── Локальные стили ───
const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(24,24,27,0.6)',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
};

const PILL_BTN: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 22,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  border: 'none',
  whiteSpace: 'nowrap',
};

const CATEGORY_LABELS: Record<string, string> = {
  hepatic: '🫁 Печень и ЖКТ',
  cardio: '❤️ Сердечно-сосудистая',
  renal: '💧 Почки и мочевыводящие',
  neuro: '🧠 Нервная система',
  endocrine: '🔬 Эндокринная',
  reproductive: '⚧ Репродуктивная',
  musculoskeletal: '🦴 Опорно-двигательная',
  hematologic: '🩸 Гематология',
  dermatologic: '🧴 Кожные',
  injection: '💉 Инъекции',
  other: '📋 Общие',
};

const TREND_ICONS: Record<SymptomTrend, string> = {
  improving: '📉',
  stable: '➡️',
  worsening: '📈',
  resolved: '✅',
};

const TREND_COLORS: Record<SymptomTrend, string> = {
  improving: '#4caf50',
  stable: '#ff9800',
  worsening: '#f44336',
  resolved: '#8bc34a',
};

export function ComplaintsTab({ onOpenSolver }: { onOpenSolver?: () => void }) {
  const [mode, setMode] = useState<'overview' | 'diary' | 'chart' | 'all'>('overview');
  const [diaryValues, setDiaryValues] = useState<Record<string, number>>({});

  const stats = useMemo(() => getSymptomDiaryStats(), []);
  const chartData = useMemo(() => {
    const d7 = getSymptomChartData(7);
    const d30 = getSymptomChartData(30);
    return { d7, d30 };
  }, []);
  const summary = useMemo(() => getSymptomDiarySummary(7), []);

  const categories = useMemo(() => {
    const map = new Map<string, SymptomEntry[]>();
    for (const sym of SYMPTOM_DB) {
      const cat = sym.category || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(sym);
    }
    return map;
  }, []);

  /** Подсветка тяжести */
  const sevColor = (s: number) => {
    if (s >= 7) return '#f44336';
    if (s >= 4) return '#ff9800';
    return '#4caf50';
  };

  /** Сохранить оценку в дневник */
  const handleRateSymptom = (symId: string, severity: number) => {
    updateSymptomToday(symId, severity);
    setDiaryValues((prev) => ({ ...prev, [symId]: severity }));
  };

  /** Сформировать отчёт для печати */
  const handlePrintReport = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) return;
    const printedDate = new Date().toLocaleDateString('ru-RU');
    w.document.write(`
      <html><head><title>Сводка жалоб</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; font-size: 12px; padding: 20px; color: #222; }
        h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 6px; }
        h2 { font-size: 14px; margin-top: 16px; color: #444; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { padding: 6px 8px; border: 1px solid #ddd; text-align: left; font-size: 11px; }
        th { background: #f5f5f5; font-weight: 700; }
        .sev-high { color: #f44336; font-weight: 700; }
        .sev-mid { color: #ff9800; font-weight: 600; }
        .sev-low { color: #4caf50; }
        .footer { margin-top: 20px; font-size: 10px; color: #999; }
      </style></head><body>
      <h1>📋 Сводка жалоб</h1>
      <p>Дата: ${printedDate} · Активных: ${stats.activeSymptoms} · Средняя тяжесть: ${stats.todayScore}/10</p>
      <p>Улучшаются: ${stats.improving} · Стабильны: ${stats.stable} · Ухудшаются: ${stats.worsening} · Решены: ${stats.resolved}</p>
      <h2>Детальная динамика за 7 дней</h2>
      <table><tr><th>Симптом</th><th>Категория</th><th>Тренд</th><th>Текущий</th><th>Средний</th></tr>
      ${summary.map(s => `<tr><td>${s.symptomName}</td><td>${s.category}</td><td>${s.trend}</td><td class="${s.currentSeverity >= 7 ? 'sev-high' : s.currentSeverity >= 4 ? 'sev-mid' : 'sev-low'}">${s.currentSeverity}/10</td><td>${s.avgSeverity}/10</td></tr>`).join('')}
      </table>
      <h2>График (7 дней)</h2>
      <p>${chartData.d7.labels.map((l, i) => `${l}: ${chartData.d7.values[i]}/10`).join(' → ')}</p>
      <div class="footer">Сгенерировано BodyBuildHealth · symptom-diary.engine.ts</div>
      </body></html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }, [stats, summary, chartData]);

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

        {/* ⚠ БАННЕР УХУДШЕНИЯ */}
        {stats.worsening > 0 && (
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.25)',
            fontSize: 11, color: '#f44336', fontWeight: 600,
          }}>
            ⚠ {stats.worsening} симптом{stats.worsening === 1 ? '' : 'ов'} ухудшается
            {summary.filter(s => s.trend === 'worsening').slice(0, 3).map(s => ` «${s.symptomName}»`).join(', ')}
            {summary.filter(s => s.trend === 'worsening').length > 3 ? '...' : ''}
          </div>
        )}

        {/* Быстрые pill-кнопки */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {(['overview', 'diary', 'chart'] as const).map((m) => (
            <button
              key={m}
              className="pill-btn"
              style={{
                ...PILL_BTN,
                background: mode === m ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                color: mode === m ? '#fff' : '#94a3b8',
                fontSize: 12,
                padding: '4px 12px',
              }}
              onClick={() => setMode(m)}
            >
              {m === 'overview' ? '📊 Обзор' : m === 'diary' ? '📝 Дневник' : '📈 График'}
            </button>
          ))}
        </div>
      </div>

      {/* Режим: обзор */}
      {mode === 'overview' && (
        <>
          {/* Статистика */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <MiniStatCard label="Улучшаются" value={stats.improving} color="#4caf50" />
            <MiniStatCard label="Стабильны" value={stats.stable} color="#ff9800" />
            <MiniStatCard label="Ухудшаются" value={stats.worsening} color="#f44336" />
            <MiniStatCard label="Решены" value={stats.resolved} color="#8bc34a" />
            <MiniStatCard label="Сегодня (ср)" value={`${stats.todayScore}/10`} color={sevColor(stats.todayScore)} />
            <MiniStatCard label="За 7 дней (ср)" value={`${stats.weekAvgScore}/10`} color={sevColor(stats.weekAvgScore)} />
          </div>

          {/* Сводка за 7 дней */}
          {summary.length > 0 && (
            <div style={{ ...GLASS_CARD, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                📋 Динамика за 7 дней
              </div>
              {summary.map((s) => (
                <div
                  key={s.symptomId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: 13,
                  }}
                >
                  <span>{TREND_ICONS[s.trend]}</span>
                  <span style={{ color: '#e2e8f0', flex: 1 }}>{s.symptomName}</span>
                  <span style={{ color: TREND_COLORS[s.trend], fontSize: 11 }}>
                    {s.trend === 'improving' ? 'лучше' : s.trend === 'worsening' ? 'хуже' : s.trend === 'resolved' ? 'решён' : 'стабильно'}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>
                    {s.currentSeverity}/{s.avgSeverity}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Категории симптомов */}
          <div style={{ ...GLASS_CARD, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
              🗂 Категории симптомов
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {Array.from(categories.entries()).map(([cat, symptoms]) => (
                <div key={cat} style={{
                  padding: 8, borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
                    {CATEGORY_LABELS[cat] || cat}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {symptoms.length} симптомов
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Режим: дневник */}
      {mode === 'diary' && (
        <>
          <div style={{ ...GLASS_CARD, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
              📝 Ежедневная оценка симптомов
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
              Оцените каждый симптом от 0 (нет) до 10 (максимум)
            </div>

            {Array.from(categories.entries()).map(([cat, symptoms]) => (
              <div key={cat} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                  {CATEGORY_LABELS[cat] || cat}
                </div>
                {symptoms.map((sym) => (
                  <SymptomRatingRow
                    key={sym.id}
                    symptom={sym}
                    onChange={(v) => handleRateSymptom(sym.id, v)}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
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
    </div>
  );
}

/** Мини-статистика */
function MiniStatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      ...GLASS_CARD, padding: 10, textAlign: 'center',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{label}</div>
    </div>
  );
}

/** Строка оценки симптома */
function SymptomRatingRow({ symptom, onChange }: { symptom: SymptomEntry; onChange: (v: number) => void }) {
  const [value, setValue] = useState(0);

  const handleChange = (v: number) => {
    setValue(v);
    onChange(v);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 0', fontSize: 13,
      borderBottom: '1px solid rgba(255,255,255,0.03)',
    }}>
      <span style={{ color: '#e2e8f0', flex: 1, fontSize: 12 }}>{symptom.symptom}</span>
      <div style={{ display: 'flex', gap: 3 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            className="pill-btn"
            style={{
              width: 22, height: 22, fontSize: 10, padding: 0,
              borderRadius: '50%',
              background: value === n ? sevColorBg(n) : 'rgba(255,255,255,0.06)',
              color: value === n ? '#fff' : '#94a3b8',
              border: value === n ? 'none' : '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
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

/** Простой SVG-бар график */
function SimpleBarChart({ data }: { data: { labels: string[]; values: number[] } }) {
  const max = Math.max(...data.values, 1);
  const barWidth = Math.max(20, Math.min(40, 400 / data.values.length));

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100, paddingTop: 8 }}>
      {data.values.map((v, i) => {
        const h = (v / 10) * 90;
        return (
          <div
            key={i}
            title={`${data.labels[i]}: ${v}/10`}
            style={{
              width: barWidth,
              height: Math.max(h, 1),
              background: sevColorBg(Math.round(v)),
              borderRadius: '3px 3px 0 0',
              transition: 'height 0.3s',
              position: 'relative',
            }}
          >
            <span style={{
              position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
              fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap',
            }}>
              {v > 0 ? v : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
