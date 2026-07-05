import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { LabPoint } from '../../../core/types';
import {
  getLabDiary, getLabDiaryStats, getMarkerChartData,
  getTopTestedMarkers, getRecentAbnormalMarkers,
  getLabDiarySummary, importLabsToDiary,
  addLabDiaryDay, removeLabDiaryDay,
  LabDiaryEntry, LabDiaryMarker,
} from '../../../engines/lab-diary.engine';

const GLASS: React.CSSProperties = {
  background: 'rgba(24,24,27,0.6)', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px',
};

const normColor = (v: number, lln?: number, uln?: number): string => {
  if (lln !== undefined && v < lln) return '#f59e0b';
  if (uln !== undefined && v > uln) return '#ef4444';
  return '#00e68a';
};

const normBg = (v: number, lln?: number, uln?: number): string => {
  if (lln !== undefined && v < lln) return 'rgba(245,158,11,0.08)';
  if (uln !== undefined && v > uln) return 'rgba(239,68,68,0.08)';
  return 'rgba(0,230,138,0.06)';
};

export const LabDiaryTab: React.FC<{ labs: LabPoint[] }> = ({ labs }) => {
  const [diary, setDiary] = useState<LabDiaryEntry[]>(getLabDiary);
  const [mode, setMode] = useState<'overview' | 'chart' | 'abnormal' | 'timeline'>('overview');
  const [selectedMarker, setSelectedMarker] = useState<string>('');
  const [chartDays, setChartDays] = useState<7 | 30 | 90>(90);

  const refresh = useCallback(() => setDiary(getLabDiary()), []);

  // auto-import on mount
  useEffect(() => {
    if (labs && labs.length > 0) {
      const markerNorms: Record<string, { uln?: number; lln?: number }> = {};
      for (const lab of labs) {
        const key = lab.code.toUpperCase();
        if (!markerNorms[key]) {
          markerNorms[key] = {};
        }
      }
      const prevLen = diary.length;
      importLabsToDiary(labs, markerNorms);
      const updated = getLabDiary();
      if (updated.length > prevLen) setDiary(updated);
    }
  }, []);

  const stats = useMemo(() => getLabDiaryStats(diary), [diary]);
  const topMarkers = useMemo(() => getTopTestedMarkers(diary, 20), [diary]);
  const abnormalMarkers = useMemo(() => getRecentAbnormalMarkers(diary, 365), [diary]);
  const summary = useMemo(() => getLabDiarySummary(diary, 90), [diary]);

  const chartData = useMemo(() => {
    if (!selectedMarker) return null;
    const data = getMarkerChartData(diary, selectedMarker);
    if (data.labels.length === 0) return null;
    // filter by days
    const cutoff = new Date(Date.now() - chartDays * 86400000).toISOString().slice(0, 10);
    const idx = data.labels.findIndex(l => l >= cutoff);
    const start = idx >= 0 ? idx : 0;
    return {
      labels: data.labels.slice(start),
      values: data.values.slice(start),
      unit: data.unit,
      lln: data.lln,
      uln: data.uln,
    };
  }, [selectedMarker, diary, chartDays]);

  const handleImportNow = () => {
    const markerNorms: Record<string, { uln?: number; lln?: number }> = {};
    importLabsToDiary(labs, markerNorms);
    refresh();
  };

  const handleDeleteEntry = (date: string) => {
    removeLabDiaryDay(date);
    refresh();
  };

  const markerOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { code: string; name: string }[] = [];
    for (const day of diary) {
      for (const m of day.markers) {
        if (!seen.has(m.code)) {
          seen.add(m.code);
          opts.push({ code: m.code, name: m.name });
        }
      }
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [diary]);

  const timeAgo = (dateStr: string): string => {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return 'сегодня';
    if (days === 1) return 'вчера';
    if (days < 7) return `${days} дн. назад`;
    if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
    return `${Math.floor(days / 30)} мес. назад`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 80 }}>
      {/* Header stats */}
      <div style={GLASS}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
          📓 Дневник анализов
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
          <MiniStat label="Дней с анализами" value={`${stats.totalDays}`} color="#3b82f6" />
          <MiniStat label="Уникальных маркеров" value={`${stats.totalMarkers}`} color="#00e68a" />
          <MiniStat label="Аномалий" value={`${abnormalMarkers.length}`} color={abnormalMarkers.length > 0 ? '#ef4444' : '#94a3b8'} />
        </div>
        {stats.firstDate && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
            📅 {stats.firstDate} — {stats.lastDate} · всего {stats.totalDays} записей
          </div>
        )}
      </div>

      {/* Mode pills */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {[
          ['overview', '📊 Обзор'],
          ['chart', '📈 Графики'],
          ['abnormal', '⚠ Аномалии'],
          ['timeline', '📋 История'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setMode(id as any)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
              cursor: 'pointer', flexShrink: 0,
              background: mode === id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
              color: mode === id ? '#00e68a' : 'rgba(255,255,255,0.5)',
              border: mode === id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
            }}>{label}</button>
        ))}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {mode === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Top tested markers */}
          <div style={GLASS}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
              🔬 Чаще всего измеряемые
            </div>
            {topMarkers.length === 0 ? (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: 8, textAlign: 'center' }}>
                Нет данных. Импортируйте результаты анализов.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {topMarkers.map((m, i) => (
                  <div key={m.code} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 6,
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    cursor: 'pointer',
                  }} onClick={() => { setSelectedMarker(m.code); setMode('chart'); }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', width: 18 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{m.name}</span>
                    <span style={{ fontSize: 9, color: '#3b82f6', fontWeight: 600 }}>{m.count}×</span>
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>→</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Abnormal pie-like summary */}
          {summary.length > 0 && (
            <div style={GLASS}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
                📊 Аномалии по дням
              </div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', minHeight: 40, padding: '4px 0' }}>
                {summary.slice(-30).map(d => {
                  const h = Math.max(2, d.pct);
                  return (
                    <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <div style={{
                        width: '100%', borderRadius: '2px 2px 0 0',
                        height: h, background: d.pct > 30 ? '#ef4444' : d.pct > 10 ? '#f59e0b' : '#00e68a',
                        opacity: 0.7,
                      }} />
                      <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.25)', writingMode: 'vertical-lr' as any }}>
                        {d.date.slice(5)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Import button */}
          {labs.length > 0 && (
            <button onClick={handleImportNow} style={{
              width: '100%', padding: '10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: '1px solid rgba(0,230,138,0.2)', background: 'rgba(0,230,138,0.06)', color: '#00e68a',
              fontWeight: 700, fontSize: 11,
            }}>
              🔄 Импортировать результаты из лаборатории ({labs.length} записей)
            </button>
          )}
        </div>
      )}

      {/* ═══ CHART ═══ */}
      {mode === 'chart' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Marker selector */}
          <div style={GLASS}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
              Выберите маркер
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
              {markerOptions.slice(0, 30).map(m => (
                <button key={m.code} onClick={() => setSelectedMarker(m.code)}
                  style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit',
                    border: selectedMarker === m.code ? '1px solid #00e68a' : '1px solid rgba(255,255,255,0.06)',
                    background: selectedMarker === m.code ? 'rgba(0,230,138,0.1)' : 'rgba(255,255,255,0.03)',
                    color: selectedMarker === m.code ? '#00e68a' : 'rgba(255,255,255,0.5)',
                    fontWeight: selectedMarker === m.code ? 700 : 400,
                  }}>{m.name}</button>
              ))}
            </div>
            {markerOptions.length > 30 && (
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                + ещё {markerOptions.length - 30} маркеров
              </div>
            )}
          </div>

          {/* Period selector */}
          {selectedMarker && chartData && (
            <div style={{ display: 'flex', gap: 4 }}>
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setChartDays(d as any)}
                  style={{
                    padding: '4px 12px', borderRadius: 12, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                    background: chartDays === d ? '#00e68a' : 'rgba(255,255,255,0.04)',
                    color: chartDays === d ? '#000' : 'rgba(255,255,255,0.5)',
                    fontWeight: 600,
                  }}>{d} дн.</button>
              ))}
            </div>
          )}

          {/* Chart */}
          {selectedMarker && chartData && chartData.values.length > 0 ? (
            <div style={GLASS}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                📈 {topMarkers.find(m => m.code === selectedMarker)?.name || selectedMarker}
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>
                  {chartData.unit}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, minHeight: 80, padding: '8px 0 4px' }}>
                {chartData.values.map((v, i) => {
                  const maxVal = Math.max(...chartData.values, chartData.uln || 0, chartData.lln || 0, 1);
                  const h = Math.max(3, (v / maxVal) * 72);
                  const inRange = (chartData.lln === undefined || v >= chartData.lln) && (chartData.uln === undefined || v <= chartData.uln);
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <div style={{
                        width: '100%', borderRadius: '3px 3px 0 0',
                        height: h,
                        background: inRange ? '#00e68a' : '#ef4444',
                        opacity: 0.7,
                        position: 'relative',
                      }}>
                        <span style={{
                          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                          fontSize: 7, color: inRange ? '#00e68a' : '#ef4444', fontWeight: 700, whiteSpace: 'nowrap',
                        }}>
                          {v}
                        </span>
                      </div>
                      <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.3)', writingMode: 'vertical-lr' as any }}>
                        {chartData.labels[i].slice(-5)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* ULN/LLN references */}
              {(chartData.uln || chartData.lln) && (
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 4, display: 'flex', gap: 12 }}>
                  {chartData.lln !== undefined && <span>▼ Низ: {chartData.lln}</span>}
                  {chartData.uln !== undefined && <span>▲ Верх: {chartData.uln}</span>}
                </div>
              )}
            </div>
          ) : selectedMarker ? (
            <div style={{ ...GLASS, textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                Нет данных для графика за выбранный период
              </div>
            </div>
          ) : (
            <div style={{ ...GLASS, textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                Выберите маркер для просмотра динамики
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ ABNORMAL ═══ */}
      {mode === 'abnormal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {abnormalMarkers.length === 0 ? (
            <div style={{ ...GLASS, textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>✅</div>
              <div style={{ fontSize: 11, color: '#00e68a', fontWeight: 600 }}>Нет аномальных маркеров</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>Все показатели в пределах нормы</div>
            </div>
          ) : (
            abnormalMarkers.map((m, i) => {
              const isHigh = m.uln !== undefined && m.value > m.uln;
              return (
                <div key={`${m.date}-${m.code}`} style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: normBg(m.value, m.lln, m.uln),
                  border: '1px solid ' + (isHigh ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'),
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{m.name}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                        {m.date} · {timeAgo(m.date)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: normColor(m.value, m.lln, m.uln) }}>
                        {m.value} <span style={{ fontSize: 9, fontWeight: 400 }}>{m.unit}</span>
                      </div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
                        {m.lln !== undefined ? `норма: ${m.lln}` : ''}{m.lln !== undefined && m.uln !== undefined ? '-' : ''}{m.uln !== undefined ? `${m.uln}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ TIMELINE ═══ */}
      {mode === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {diary.length === 0 ? (
            <div style={{ ...GLASS, textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>📓</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                Дневник пуст. Импортируйте результаты анализов.
              </div>
            </div>
          ) : (
            [...diary].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map(day => (
              <div key={day.date} style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{day.date}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>
                      {timeAgo(day.date)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                      {day.totalMarkers} маркеров
                    </span>
                    {day.abnormalCount > 0 && (
                      <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 600 }}>
                        ⚠ {day.abnormalCount}
                      </span>
                    )}
                    <button onClick={() => handleDeleteEntry(day.date)}
                      style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>✕</button>
                  </div>
                </div>
                {/* Markers chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {day.markers.slice(0, 10).map(m => (
                    <span key={m.code} style={{
                      padding: '2px 6px', borderRadius: 6, fontSize: 7,
                      background: m.inRange ? 'rgba(0,230,138,0.06)' : 'rgba(239,68,68,0.08)',
                      color: m.inRange ? '#00e68a' : '#ef4444',
                      border: '1px solid ' + (m.inRange ? 'rgba(0,230,138,0.12)' : 'rgba(239,68,68,0.15)'),
                    }}>
                      {m.name} {m.value}{m.unit}
                    </span>
                  ))}
                  {day.markers.length > 10 && (
                    <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', padding: '2px 4px' }}>
                      +{day.markers.length - 10}
                    </span>
                  )}
                </div>
                {day.note && (
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontStyle: 'italic' }}>
                    {day.note}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 4px', textAlign: 'center',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{label}</div>
    </div>
  );
}
