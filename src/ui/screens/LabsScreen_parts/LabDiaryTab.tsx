import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { LabPoint } from '../../../core/types';
import {
  getLabDiary, getLabDiaryStats, getMarkerChartData,
  getTopTestedMarkers, getRecentAbnormalMarkers,
  getLabDiarySummary, importLabsToDiary,
  addLabDiaryDay, removeLabDiaryDay,
  LabDiaryEntry, LabDiaryMarker,
} from '../../../engines/lab-diary.engine';
import { LABS_ACCENT, LABS_CARD, LABS_CARD_FLAT } from './LabsUI';
import { NativeIcon } from '../../native/NativeIcons';

const GLASS: React.CSSProperties = {
  ...LABS_CARD,
  background: 'rgba(20,22,30,0.42)', backdropFilter:'blur(10px)',
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
    <div className="labs-labdiary" style={{ display:'flex', flexDirection:'column', gap:10, paddingBottom:80 }}>
      {/* Header stats — premium */}
      <div style={{ ...GLASS, padding:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={{ width:36, height:36, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(var(--labs-accent-rgb, 0,230,138),0.14)', border:'1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.18)', color: LABS_ACCENT }}><NativeIcon name="notebook" size={17} /></div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>Дневник анализов</div>
            <div style={{ fontSize:10, color:'#fff', marginTop:1 }}>{stats.totalDays} дней • {stats.totalMarkers} маркеров • {abnormalMarkers.length} аномалий</div>
          </div>
          {stats.firstDate && <span style={{ fontSize:9, padding:'4px 8px', borderRadius:999, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff' }}>📅 {stats.firstDate} → {stats.lastDate}</span>}
        </div>
        <div className="labs-kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:8 }}>
          <MiniStat label="Дней" value={`${stats.totalDays}`} color="#3b82f6" />
          <MiniStat label="Маркеров" value={`${stats.totalMarkers}`} color={LABS_ACCENT} />
          <MiniStat label="Аномалий" value={`${abnormalMarkers.length}`} color={abnormalMarkers.length>0? '#ef4444': LABS_ACCENT} />
        </div>
      </div>

      {/* Mode pills — TOP APK: 44px, скролл-лента */}
      <div className="labs-filter-row" style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 2px 6px', scrollbarWidth:'none' }}>
        {[
          ['overview', '📊 Обзор'],
          ['chart', '📈 Графики'],
          ['abnormal', '⚠ Аномалии'],
          ['timeline', '📋 История'],
        ].map(([id, label]) => {
          const active = mode===id;
          return (
            <button key={id} onClick={() => setMode(id as any)} aria-pressed={active}
              style={{
                padding:'10px 16px', borderRadius:999, fontSize:12, fontWeight:800, whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', gap:6, minHeight:44,
                background: active? `linear-gradient(135deg, ${LABS_ACCENT}, var(--accent-2, ${LABS_ACCENT}))` : 'rgba(21,38,66,0.60)', color: active?'#0a1a08':'#fff', border: active?'1px solid transparent':'1px solid rgba(140,190,255,0.14)', boxShadow: active?'0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)':'none',
              }}>{label} {id==='abnormal' && abnormalMarkers.length>0 && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:999, background: active?'#000':'#ef4444', color:'#fff', fontWeight:800 }}>{abnormalMarkers.length}</span>}</button>
          );
        })}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {mode === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Top tested markers */}
          <div style={GLASS}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
              🔬 Чаще всего измеряемые
            </div>
            {topMarkers.length === 0 ? (
              <div style={{ fontSize: 10, color: '#fff', padding: 8, textAlign: 'center' }}>
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
                    <span style={{ fontSize: 9, color: '#fff', width: 18 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 10, fontWeight: 500, color: '#fff' }}>{m.name}</span>
                    <span style={{ fontSize: 9, color: '#3b82f6', fontWeight: 600 }}>{m.count}×</span>
                    <span style={{ fontSize: 8, color: '#fff' }}>→</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Abnormal pie-like summary */}
          {summary.length > 0 && (
            <div style={GLASS}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
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
                      <div style={{ fontSize: 6, color: '#fff', writingMode: 'vertical-lr' as any }}>
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
              border: '1px solid rgba(var(--labs-accent-rgb, 0,230,138),0.2)', background: 'rgba(var(--labs-accent-rgb, 0,230,138),0.06)', color: LABS_ACCENT,
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
            <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
              Выберите маркер
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
              {markerOptions.slice(0, 30).map(m => (
                <button key={m.code} onClick={() => setSelectedMarker(m.code)}
                  style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 9, cursor: 'pointer', fontFamily: 'inherit',
                    border: selectedMarker === m.code ? '1px solid var(--labs-accent, #00e68a)' : '1px solid rgba(255,255,255,0.06)',
                    background: selectedMarker === m.code ? 'rgba(var(--labs-accent-rgb, 0,230,138),0.1)' : 'rgba(255,255,255,0.03)',
                    color: selectedMarker === m.code ? LABS_ACCENT : '#fff',
                    fontWeight: selectedMarker === m.code ? 700 : 400,
                  }}>{m.name}</button>
              ))}
            </div>
            {markerOptions.length > 30 && (
              <div style={{ fontSize: 8, color: '#fff' }}>
                + ещё {markerOptions.length - 30} маркеров
              </div>
            )}
          </div>

          {/* Period selector — TOP APK 44px */}
          {selectedMarker && chartData && (
            <div className="labs-filter-row" style={{ display:'flex', gap:8, overflowX:'auto', padding:'2px 2px 4px', scrollbarWidth:'none' }}>
              {[7, 30, 90].map(d => {
                const active = chartDays === d;
                return (
                  <button key={d} onClick={() => setChartDays(d as any)} aria-pressed={active}
                    style={{
                      padding:'10px 16px', borderRadius:999, fontSize:12, cursor:'pointer', fontFamily:'inherit', minHeight:44, flexShrink:0,
                      border: active ? '1px solid transparent' : '1px solid rgba(140,190,255,0.14)',
                      background: active ? `linear-gradient(135deg, ${LABS_ACCENT}, var(--accent-2, ${LABS_ACCENT}))` : 'rgba(21,38,66,0.60)',
                      color: active ? '#0a1a08' : '#fff',
                      fontWeight:800,
                      boxShadow: active ? '0 6px 18px rgba(var(--labs-accent-rgb, 0,230,138),0.35)' : 'none',
                    }}>{d} дн.</button>
                );
              })}
            </div>
          )}

          {/* Chart */}
          {selectedMarker && chartData && chartData.values.length > 0 ? (
            <div style={GLASS}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                📈 {topMarkers.find(m => m.code === selectedMarker)?.name || selectedMarker}
                <span style={{ fontSize: 9, color: '#fff', marginLeft: 4 }}>
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
                      <div style={{ fontSize: 6, color: '#fff', writingMode: 'vertical-lr' as any }}>
                        {chartData.labels[i].slice(-5)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* ULN/LLN references */}
              {(chartData.uln || chartData.lln) && (
                <div style={{ fontSize: 8, color: '#fff', marginTop: 4, display: 'flex', gap: 12 }}>
                  {chartData.lln !== undefined && <span>▼ Низ: {chartData.lln}</span>}
                  {chartData.uln !== undefined && <span>▲ Верх: {chartData.uln}</span>}
                </div>
              )}
            </div>
          ) : selectedMarker ? (
            <div style={{ ...GLASS, textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 10, color: '#fff' }}>
                Нет данных для графика за выбранный период
              </div>
            </div>
          ) : (
            <div style={{ ...GLASS, textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 10, color: '#fff' }}>
                Выберите маркер для просмотра динамики
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ ABNORMAL — TOP APK 64px с кромкой ═══ */}
      {mode === 'abnormal' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {abnormalMarkers.length === 0 ? (
            <div style={{ ...GLASS, textAlign:'center', padding:24 }}>
              <div style={{ fontSize:28, marginBottom:6 }}>✅</div>
              <div style={{ fontSize:14, color:'#00e68a', fontWeight:800 }}>Нет аномальных маркеров</div>
              <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>Все показатели в пределах нормы</div>
            </div>
          ) : (
            abnormalMarkers.map((m, i) => {
              const isHigh = m.uln !== undefined && m.value > m.uln;
              const accent = isHigh ? '#ef4444' : '#f59e0b';
              return (
                <div key={`${m.date}-${m.code}`} style={{
                  padding:'12px 12px', borderRadius:14, minHeight:64,
                  background: normBg(m.value, m.lln, m.uln),
                  border: '1px solid ' + (isHigh ? 'rgba(239,68,68,0.30)' : 'rgba(245,158,11,0.30)'),
                  borderLeft: `3px solid ${accent}`,
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{m.name}</div>
                      <div style={{ fontSize:11, color:'#fff', marginTop:2 }}>
                        {m.date} · {timeAgo(m.date)}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:18, fontWeight:900, color: normColor(m.value, m.lln, m.uln), fontVariantNumeric:'tabular-nums' }}>
                        {m.value} <span style={{ fontSize:10, fontWeight:700 }}>{m.unit}</span>
                      </div>
                      <div style={{ fontSize:10, color:'#fff', marginTop:2 }}>
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

      {/* ═══ TIMELINE — TOP APK 52px ═══ */}
      {mode === 'timeline' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {diary.length === 0 ? (
            <div style={{ ...GLASS, textAlign:'center', padding:24 }}>
              <div style={{ fontSize:28, marginBottom:6 }}>📓</div>
              <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Дневник пуст</div>
              <div style={{ fontSize:12, color:'#fff', marginTop:4 }}>
                Импортируйте результаты анализов.
              </div>
            </div>
          ) : (
            [...diary].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map(day => (
              <div key={day.date} style={{
                padding:'12px 12px', borderRadius:14, minHeight:64,
                background:'linear-gradient(180deg, rgba(21,38,66,0.60), rgba(12,23,40,0.60))', border:'1px solid rgba(140,190,255,0.12)', borderLeft:`3px solid ${day.abnormalCount > 0 ? '#ef4444' : LABS_ACCENT}`,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ minWidth:0 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{day.date}</span>
                    <span style={{ fontSize:11, color:'#fff', marginLeft:8 }}>
                      {timeAgo(day.date)}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                    <span style={{ fontSize:11, color:'#fff', fontWeight:700 }}>
                      {day.totalMarkers} маркеров
                    </span>
                    {day.abnormalCount > 0 && (
                      <span style={{ fontSize:11, color:'#ef4444', fontWeight:800 }}>
                        ⚠ {day.abnormalCount}
                      </span>
                    )}
                    <button onClick={() => handleDeleteEntry(day.date)} aria-label={`Удалить ${day.date}`}
                      style={{ padding:'8px 10px', borderRadius:10, fontSize:11, cursor:'pointer', fontFamily:'inherit', border:'1px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.10)', color:'#ef4444', minHeight:40, fontWeight:800 }}>✕</button>
                  </div>
                </div>
                {/* Markers chips */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {day.markers.slice(0, 10).map(m => (
                    <span key={m.code} style={{
                      padding:'6px 10px', borderRadius:999, fontSize:11, fontWeight:700,
                      background: m.inRange ? 'rgba(0,230,138,0.08)' : 'rgba(239,68,68,0.10)',
                      color: m.inRange ? '#00e68a' : '#ef4444',
                      border:'1px solid ' + (m.inRange ? 'rgba(0,230,138,0.18)' : 'rgba(239,68,68,0.20)'),
                    }}>
                      {m.name} {m.value}{m.unit}
                    </span>
                  ))}
                  {day.markers.length > 10 && (
                    <span style={{ fontSize:11, color:'#fff', padding:'6px 8px', fontWeight:700 }}>
                      +{day.markers.length - 10}
                    </span>
                  )}
                </div>
                {day.note && (
                  <div style={{ fontSize:11, color:'#fff', marginTop:6, fontStyle:'italic', lineHeight:1.5 }}>
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
      background: color+'10', border:`1px solid ${color}18`, borderRadius:12, padding:'10px 6px', textAlign:'center', position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', top:-8, right:-8, width:28, height:28, borderRadius:'50%', background: color+'12' }} />
      <div style={{ fontSize:18, fontWeight:900, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:9, color, fontWeight:700, letterSpacing:0.3, marginTop:2 }}>{label}</div>
    </div>
  );
}
