/** DiaryAnalyticsView.tsx � ����� ���������� ���� �������� (������� �� TrainingDiaryHub). */
import React from 'react';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../../../core/exercise-catalog';
import { epley1RM } from '../../../engines/e1rm';
import { LEVEL_VOLUMES } from '../../../engines/training.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads, weeklyMonotony } from '../../../engines/pro/training-load.engine';
import { loadReadinessHistory } from './readiness-history';
import { Sparkline } from './Sparkline';
import { RIRCalibrationCard } from './RIRCalibrationCard';
import MesoCorrectionCard from './MesoCorrectionCard';
import { MuscleProgressCard } from './MuscleProgressCard';
import { VolumeTrendCard } from './VolumeTrendCard';
import { LoadRadarCard } from './LoadRadarCard';
import { WeekCompareCard } from './WeekCompareCard';
import { LiftHistoryCard } from './LiftHistoryCard';
import { AnalyticsTab } from './AnalyticsTab';
import { StructuredAnalyticsCard } from './StructuredAnalyticsCard';
import AllExercisesTrendCard from './AllExercisesTrendCard';
import StandardForecastCard from './StandardForecastCard';
import VolumeRecoveryCorrelationCard from './VolumeRecoveryCorrelationCard';
import StickingPointAnalysisCard from './StickingPointAnalysisCard';
import { ReadinessForecastCard } from './ReadinessForecastCard';
import { TrainingScoreCard } from '../../components/TrainingScoreCard';
import { MiniLineChart, MiniBarChart } from './DiaryChart';
import { WeeklyTargetsCard, SectionHeader, DiaryEmptyState } from './diary-cards';
import { diaryStyles as style, GRP_RU, GROUP_COLORS, ACCENT } from './diary-tokens';
import { useDiaryHub, type DiaryHubCtx } from './diary-hub-context';
import { PL_NORM_TABLES, classifyTotal, RANK_LABELS, getNormTable, type Discipline, type Sex } from '../../../engines/pl-norms.engine';
import { getProfile } from '../../../core/profile-manager';

export const DiaryAnalyticsView: React.FC<{ hub: DiaryHubCtx }> = ({ hub }) => {
  const {
    analytics, setBarTooltip, barTooltip, measurements, historyWorkouts, diaryProgress, wsg, groups, totals,
    hubAnalyticsExpanded, setHubAnalyticsExpanded, expertAcwr, expertMono, expertExercises,
    expertRecentVol, expertRirStats, tprofile, mesoLength, level, linked, onRefresh,
    setMode, onGoRecord,
  } = hub;
  if (!analytics) {
    return (
      <div className="train-diaryanalytics" style={style.card}>
        <div style={style.label}>📊 Аналитика</div>
        <div style={{ fontSize: 11, color: '#fff', textAlign: 'center', padding: 20, lineHeight:1.5 }}>
          Нет данных для аналитики. Запишите хотя бы 2 тренировки — здесь появится объём, интенсивность, баланс мышц и прогресс.
        </div>
        <div style={{ marginTop:8, display:'flex', justifyContent:'center' }}>
          <button onClick={() => hub.setMode('record' as any)} style={{ padding:'7px 12px', borderRadius:999, fontSize:11, fontWeight:700, background:'var(--accent)', color:'#000', border:'none', cursor:'pointer' }}>← К записи</button>
        </div>
      </div>
    );
  }
  return (
        <div>
          {analytics ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <div style={style.card}>
                  <div style={{ fontSize: 10, color: '#fff' }}>Объём/нед</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{analytics.volume.weeklyVolumeKg.toLocaleString()} кг</div>
                  <div style={{ fontSize: 10, color: analytics.volume.volumeTrend >= 0 ? '#22c55e' : '#ef4444' }}>
                    {analytics.volume.volumeTrend >= 0 ? '↑' : '↓'} {Math.abs(analytics.volume.volumeTrend)}% vs пред.
                  </div>
                </div>
                <div style={style.card}>
                  <div style={{ fontSize: 10, color: '#fff' }}>Интенсивность</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{analytics.intensity.avgIntensity}%</div>
                  <div style={{ fontSize: 10, color: '#fff' }}>RPE avg: {analytics.intensity.avgRPE}</div>
                </div>
                <div style={style.card}>
                  <div style={{ fontSize: 10, color: '#fff' }}>Усталость</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: analytics.fatigue.weeklyFatigue > 0.7 ? '#ef4444' : analytics.fatigue.weeklyFatigue > 0.4 ? '#f59e0b' : '#22c55e' }}>
                    {Math.round(analytics.fatigue.weeklyFatigue * 100)}%
                  </div>
                </div>
                <div style={style.card}>
                  <div style={{ fontSize: 10, color: '#fff' }}>Готовность</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: analytics.recovery.readinessEstimate > 60 ? '#22c55e' : analytics.recovery.readinessEstimate > 40 ? '#f59e0b' : '#ef4444' }}>
                    {analytics.recovery.readinessEstimate}%
                  </div>
                </div>
              </div>
              {/* Bodyweight overlay on volume trend */}
              <SectionHeader icon="📊" title="Объём и нагрузка" hint="тоннаж · группы · баланс" />
              {measurements.length >= 2 && historyWorkouts.length >= 4 && (() => {
                const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const weeklyVol: { week: string; vol: number }[] = [];
                const weekMap = new Map<string, number>();
                sorted.forEach(w => {
                  const d = new Date(w.date);
                  const wkStart = new Date(d); wkStart.setDate(d.getDate() - d.getDay());
                  const key = wkStart.toISOString().slice(0, 10);
                  weekMap.set(key, (weekMap.get(key) || 0) + w.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0));
                });
                weekMap.forEach((vol, week) => weeklyVol.push({ week, vol }));
                const last12 = weeklyVol.slice(-12);
                const weights = measurements.slice(-12).map((m: any) => m.weightKg || 0).filter(Boolean);
                if (last12.length < 3 || weights.length < 2) return null;
                const volMax = Math.max(...last12.map(w => w.vol), 1);
                const wMin = Math.min(...weights) - 2;
                const wMax = Math.max(...weights) + 2;
                const ww = 300; const h = 50;
                return (
                  <div style={style.card}>
                    <div style={style.label}>⚖️ Объём + вес тела</div>
                    <svg width="100%" viewBox={`0 0 ${ww} ${h}`} style={{ display: 'block' }}>
                      {last12.map((w, i) => {
                        const bh = (w.vol / volMax) * (h - 4);
                        return <rect key={i} x={(i / last12.length) * ww + 2} y={h - bh - 2} width={Math.max(2, ww / last12.length - 4)} height={bh} rx={2} fill="rgba(0,230,138,0.25)" />;
                      })}
                      {weights.length >= 2 && <polyline points={weights.map((w, i) => `${((i / (weights.length - 1)) * ww)},${h - ((w - wMin) / (wMax - wMin)) * (h - 4) - 2}`).join(' ')} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeLinejoin="round" />}
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                      <span>🟢 объём (кг)</span><span>🟡 вес тела ({weights[0]}→{weights[weights.length - 1]}кг)</span>
                    </div>
                  </div>
                );
              })()}
              {/* Неделя-over-week comparison */}
              {historyWorkouts.length >= 2 && (() => {
                const sorted = [...historyWorkouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
                const thisWeek = sorted.filter(w => new Date(w.date) >= weekAgo);
                const lastWeek = sorted.filter(w => { const d = new Date(w.date); return d >= twoWeeksAgo && d < weekAgo; });
                if (thisWeek.length === 0 || lastWeek.length === 0) return null;
                const twVol = thisWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
                const lwVol = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
                const twSets = thisWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.sets.length, 0), 0);
                const lwSets = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.sets.length, 0), 0);
                const twWorkouts = thisWeek.length;
                const lwWorkouts = lastWeek.length;
                const volDelta = lwVol > 0 ? Math.round((twVol - lwVol) / lwVol * 100) : 0;
                const setsDelta = lwSets > 0 ? Math.round((twSets - lwSets) / lwSets * 100) : 0;
                return (
                  <div style={style.card}>
                    <div style={style.label}>📊 Неделя vs предыдущая</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#fff' }}>Тренировок</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{twWorkouts} <span style={{ fontSize: 10, color: '#fff' }}>vs {lwWorkouts}</span></div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#fff' }}>Тоннаж</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: volDelta >= 0 ? '#22c55e' : '#ef4444' }}>
                          {volDelta >= 0 ? '+' : ''}{volDelta}%
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#fff' }}>Подходы</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: setsDelta >= 0 ? '#22c55e' : '#ef4444' }}>
                          {setsDelta >= 0 ? '+' : ''}{setsDelta}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Intensity distribution */}
              <div style={style.card}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Распределение нагрузки</div>
                <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: `${analytics.intensity.intensityDistribution.strength}%`, background: '#ef4444' }} />
                  <div style={{ width: `${analytics.intensity.intensityDistribution.hypertrophy}%`, background: '#f59e0b' }} />
                  <div style={{ width: `${analytics.intensity.intensityDistribution.endurance}%`, background: '#22c55e' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#fff' }}>
                  <span>🔴 Сила {analytics.intensity.intensityDistribution.strength}%</span>
                  <span>🟠 Гипертрофия {analytics.intensity.intensityDistribution.hypertrophy}%</span>
                  <span>🟢 Выносливость {analytics.intensity.intensityDistribution.endurance}%</span>
                </div>
              </div>
              {/* Volume by group stacked bars — ACWR/MRV демотированы к хабам */}
              {totals.some(t => t > 0) && (
                <div style={style.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={style.label} >📊 Объём по неделям (сеты)</div>
                    <span style={{ fontSize:9, padding:'2px 8px', borderRadius:20, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.18)', color:'#3b82f6' }}>факт · история</span>
                  </div>
                  <div style={{ fontSize:9, color:'#fff', background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.14)', borderRadius:8, padding:'6px 8px', marginBottom:6, lineHeight:1.4 }}>
                    ACWR → <b>⚡ Интеллект → Нагрузка</b> · MRV/MEV → <b>📐 Объём-хаб</b> (канон)
                  </div>
                  <div style={{ position: 'relative', height: 100, marginBottom: 4 }}>

                    <div style={{ display: 'flex', gap: 2, height: '100%', alignItems: 'flex-end' }}>
                      {totals.map((t, wi) => (
                        <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', height: '100%', borderRadius: 3, overflow: 'visible', background: t > 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          {groups.map(g => {
                            const v = wsg[g]?.[wi] || 0;
                            if (v === 0) return null;
                            return <div key={g} style={{ flex: v, background: GROUP_COLORS[g] || '#888', minHeight: 2, borderRadius: 1, cursor: 'pointer', position: 'relative' }}
                              onMouseEnter={e => setBarTooltip({ group: g, sets: v, week: wi + 1, x: e.clientX, y: e.clientY })}
                              onMouseLeave={() => setBarTooltip(null)}
                            />;
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Неделя labels */}
                  <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                    {totals.map((_, wi) => <span key={wi} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: '#fff' }}>Н{wi + 1}</span>)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, color:'#fff' }}>
                    {groups.filter(g => (wsg[g]?.reduce((s: number, x: number) => s + x, 0) || 0) > 0).map(g => (
                      <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span style={{ width: 6, height: 6, borderRadius: 1, background: GROUP_COLORS[g] || '#888', display: 'inline-block' }} />{GRP_RU[g] || g}</span>
                    ))}
                  </div>
                  {/* Tooltip */}
                  {barTooltip && (
                    <div style={{ position: 'fixed', left: barTooltip.x + 8, top: barTooltip.y - 30, background: '#18181b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 8px', fontSize: 10, color: '#fff', zIndex: 9999, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                      <span style={{ color: GROUP_COLORS[barTooltip.group] || '#888', fontWeight: 700 }}>{GRP_RU[barTooltip.group] || barTooltip.group}</span>
                      <span style={{ marginLeft: 6, color:'#fff' }}>Н{barTooltip.week}: {barTooltip.sets} сетов</span>
                    </div>
                  )}
                </div>
              )}
              {/* Volume by group */}
              <div style={style.card}>
                <div style={style.label}>Объём по группам</div>
                {Object.entries(analytics.volume.volumeByGroup).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 8).map(([group, vol]) => {
                  const v = vol as number;
                  const maxVol3 = Math.max(...Object.values(analytics.volume.volumeByGroup).map(v2 => v2 as number), 1);
                  return (
                    <div key={group} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ width: 80, fontSize: 10, color: '#fff', textAlign: 'right' }}>{GRP_RU[group] || group}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${(v / maxVol3) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#fff', width: 50 }}>{Math.round(v).toLocaleString()} кг</span>
                    </div>
                  );
                })}
              </div>
              {/* Muscle balance */}
              {historyWorkouts.length >= 2 && (() => {
                const volByGroup: Record<string, number> = {};
                const recent = historyWorkouts.slice(-8);
                recent.forEach(w => w.exercises.forEach((e: any) => {
                  const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                  const group = cat?.group || 'other';
                  volByGroup[group] = (volByGroup[group] || 0) + (e.totalVolume || 0);
                }));
                const groups = Object.keys(volByGroup);
                if (groups.length < 3) return null;
                const maxVol4 = Math.max(...Object.values(volByGroup), 1);
                const avgVol = Object.values(volByGroup).reduce((s, v) => s + v, 0) / groups.length;
                return (
                  <div style={style.card}>
                    <div style={style.label}>⚖️ Баланс мышц</div>
                    <div style={{ fontSize: 9, color: '#fff', marginBottom: 4 }}>средний объём: {Math.round(avgVol).toLocaleString()} кг</div>
                    {groups.sort((a, b) => volByGroup[b] - volByGroup[a]).slice(0, 8).map(g => {
                      const v = volByGroup[g];
                      const ratio = v / avgVol;
                      const color = ratio > 1.3 ? '#ef4444' : ratio > 1.1 ? '#f59e0b' : ratio < 0.5 ? '#ef4444' : ratio < 0.7 ? '#f59e0b' : '#22c55e';
                      const label = ratio > 1.3 ? 'перегруз' : ratio > 1.1 ? 'выше нормы' : ratio < 0.5 ? 'недогруз' : ratio < 0.7 ? 'ниже нормы' : 'ok';
                      return (
                        <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ width: 70, fontSize: 10, color: '#fff', textAlign: 'right' }}>{GRP_RU[g] || g}</span>
                          <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.15)' }} />
                            <div style={{ width: `${Math.min((v / maxVol4) * 100, 100)}%`, height: '100%', background: color, borderRadius: 4, opacity: 0.8 }} />
                          </div>
                          <span style={{ fontSize: 9, color, width: 60, textAlign: 'right' }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {/* 1RM */}
              <SectionHeader icon="💪" title="Сила и рекорды" hint="1RM · PR · прогресс · плато" />
              {Object.keys(analytics.strength.estimated1RM).length > 0 && (() => {
                // Относительная сила: e1RM ÷ вес тела (из синхронизированного дневника веса)
                const bw = measurements.length > 0 ? (measurements[measurements.length - 1].weightKg || 0) : 0;
                return (
                  <div style={style.card}>
                    <div style={style.label}>🏆 Расчётный 1RM {bw > 0 && <span style={{ fontSize: 9, color: '#fff', fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>вес тела: {bw} кг</span>}</div>
                    {Object.entries(analytics.strength.estimated1RM).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5).map(([exId2, rm]) => {
                      const trend = analytics.strength.strengthTrend[exId2] || 0;
                      const ex = EXERCISE_CATALOG.find((e2: any) => e2.id === exId2);
                      const ratio = bw > 0 ? ((rm as number) / bw).toFixed(2) : null;
                      return (
                        <div key={exId2} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 11 }}>
                          <span style={{ color: '#fff' }}>{ex?.name || exId2}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {ratio && <span style={{ fontSize: 9, color: '#fff' }}>×{ratio} МТ</span>}
                            <span><strong style={{ color: ACCENT }}>{Math.round(rm as number)} кг</strong><span style={{ marginLeft: 6, fontSize: 10, color: trend >= 0 ? '#22c55e' : '#ef4444' }}>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span></span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {/* Нормативы ПЛ по основным движениям (e1RM из дневника) */}
              {(() => {
                const bw = measurements.length > 0 ? (measurements[measurements.length - 1].weightKg || 0) : 0;
                const discFor = (id: string): Discipline | null => {
                  const n = (id || '').toLowerCase();
                  if (/squat|присед/.test(n)) return 'squat';
                  if (/bench|жим.*л[её]жа|жим лежа|жим л[её]жа/.test(n)) return 'bench';
                  if (/deadlift|станов/.test(n) && !/румын|сумо/.test(n)) return 'deadlift';
                  return null;
                };
                const lifts = Object.entries(analytics.strength.estimated1RM)
                  .map(([id, rm]) => ({ id, rm: rm as number, disc: discFor(id) }))
                  .filter(x => x.disc && x.rm > 0)
                  .slice(0, 3);
                if (bw <= 0 || lifts.length === 0) return null;
                const sex: Sex = (() => { try { return (getProfile().settings as any)?.personal?.sex === 'female' ? 'female' : 'male'; } catch { return 'male'; } })();
                const fedForDiary: any = 'wrpf_untested';
                return (
                  <div style={style.card}>
                    <div style={style.label}>🏅 Нормативы ПЛ ({sex === 'female' ? '♀ WRPF, женщины' : 'WRPF, raw'} · {bw} кг · {sex === 'female' ? '43-84+ кат.' : '60-140+ кат.'})</div>
                    <div style={{ fontSize: 9, color: '#fff', marginBottom: 6, lineHeight: 1.4 }}>e1RM из дневника → разряд по ближайшей категории (WRPF без ДК). Пол берётся из профиля ({sex === 'female' ? 'женские пороги ~60% от мужских' : 'мужские'}). Для точного выбора федерации/категории — «Анализ силы → Единый».</div>
                    {lifts.map(({ id, rm, disc }) => {
                      const perTable = getNormTable(fedForDiary, disc as Discipline, sex);
                      if (!perTable) return null;
                      const cls = classifyTotal(perTable, bw, rm);
                      return (
                        <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, fontSize: 11 }}>
                          <span style={{ color: '#fff' }}>{EXERCISE_CATALOG.find(e => e.id === id)?.name || id}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: '#fff' }}>{Math.round(rm)} кг</span>
                            {cls.achievedRank ? (
                              <span style={{ fontSize: 10, fontWeight: 800, color: cls.achievedRank === 'kms' ? '#22c55e' : cls.achievedRank === 'ms' ? '#60a5fa' : '#f59e0b', padding: '1px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>{RANK_LABELS[cls.achievedRank as keyof typeof RANK_LABELS]}</span>
                            ) : (
                              <span style={{ fontSize: 9, color: '#fff' }}>до {RANK_LABELS[cls.nextRank as keyof typeof RANK_LABELS]}: {cls.kgToNext} кг</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {/* Оверлей e1RM по мезоциклам (если записи тегированы mesocycleId) */}
              {historyWorkouts.some(w => (w as any).mesocycleId) && (() => {
                const MESO_COLORS = ['#00e68a', '#60a5fa', '#a855f7', '#f59e0b', '#ec4899'];
                const byEx = new Map<string, { meso: string; date: string; e1rm: number }[]>();
                historyWorkouts.forEach((w: any) => {
                  const meso = w.mesocycleId;
                  if (!meso) return;
                  (w.exercises || []).forEach((e: any) => {
                    const best = (e.sets || []).reduce((m: number, s: any) => Math.max(m, epley1RM(s.weight || 0, s.reps || 0)), 0);
                    if (best <= 0) return;
                    const name = e.exerciseName || e.exerciseId;
                    if (!byEx.has(name)) byEx.set(name, []);
                    byEx.get(name)!.push({ meso, date: w.date, e1rm: Math.round(best) });
                  });
                });
                const exercises = [...byEx.entries()].map(([name, pts]) => {
                  const mesoMap = new Map<string, { name: string; color: string; pts: { date: string; e1rm: number }[] }>();
                  [...new Set(pts.map(p => p.meso))].forEach((meso, mi) => mesoMap.set(meso, { name: `Цикл ${mi + 1}`, color: MESO_COLORS[mi % MESO_COLORS.length], pts: [] }));
                  pts.forEach(p => mesoMap.get(p.meso)!.pts.push({ date: p.date, e1rm: p.e1rm }));
                  const mesos = [...mesoMap.values()]
                    .map(m => ({ ...m, pts: m.pts.sort((a, b) => a.date.localeCompare(b.date)) }))
                    .filter(m => m.pts.length >= 2);
                  return { name, mesos };
                }).filter(e => e.mesos.length >= 2).slice(0, 2);
                if (exercises.length === 0) return null;
                return (
                  <div style={style.card}>
                    <div style={style.label}>🔀 Прогресс по мезоциклам (e1RM)</div>
                    {exercises.map(ex => (
                      <div key={ex.name} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color:'#fff', marginBottom: 2 }}>{ex.name}</div>
                        <MiniLineChart
                          data={[]}
                          series={ex.mesos.map(m => ({ name: m.name, color: m.color, data: m.pts.map(p => p.e1rm), labels: m.pts.map(p => p.date) }))}
                          width={290}
                          height={50}
                          ySuffix=" кг"
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Слабые места → рекомендации (каталог + замены) */}
              {historyWorkouts.length >= 4 && (() => {
                const recent = historyWorkouts.slice(-12);
                const volByGroup: Record<string, number> = {};
                recent.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
                  const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                  const g = cat?.group || 'other';
                  volByGroup[g] = (volByGroup[g] || 0) + (e.totalVolume || 0);
                }));
                const groups = Object.keys(volByGroup).filter(g => g !== 'other');
                if (groups.length < 3) return null;
                const avgVol = Object.values(volByGroup).reduce((s, v) => s + v, 0) / groups.length;
                const weak = groups
                  .map(g => ({ group: g, vol: volByGroup[g], ratio: volByGroup[g] / avgVol }))
                  .filter(x => x.ratio < 0.7)
                  .sort((a, b) => a.ratio - b.ratio)
                  .slice(0, 3);
                // Слабые точки из профиля (каноническая группа по ключу)
                const profileWeak = (tprofile?.weakPoints || [])
                  .map((w: string) => {
                    const n = String(w).toLowerCase();
                    return Object.keys(GRP_RU).find(k => n.includes(k) || k.includes(n));
                  })
                  .filter(Boolean) as string[];
                const targets = [...new Set([...weak.map(w => w.group), ...profileWeak])].slice(0, 3);
                if (targets.length === 0) return null;
                return (
                  <div style={style.card}>
                    <div style={style.label}>🎯 Слабые места → рекомендации</div>
                    {targets.map(g => {
                      const weakInfo = weak.find(w => w.group === g);
                      const exs = getExercisesByGroup(g);
                      const picks = [...exs.filter(e => e.type === 'compound'), ...exs.filter(e => e.type !== 'compound')].slice(0, 3);
                      return (
                        <div key={g} style={{ marginBottom: 6, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{GRP_RU[g] || g}</span>
                            {weakInfo
                              ? <span style={{ fontSize: 9, color: '#f59e0b' }}>{Math.round(weakInfo.ratio * 100)}% от среднего объёма</span>
                              : <span style={{ fontSize: 9, color: '#60a5fa' }}>из профиля</span>}
                          </div>
                          {picks.length > 0 && (
                            <div style={{ fontSize: 10, color:'#fff', marginTop: 2 }}>
                              {picks.map((e, i) => `${i > 0 ? ' · ' : ''}${e.name}`)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 9, color: '#fff' }}>
                      Группы ниже 70% среднего объёма за последние 12 сессий + слабые точки из профиля; упражнения — из каталога.
                    </div>
                  </div>
                );
              })()}
              {/* PR history */}
              {historyWorkouts.length >= 2 && (() => {
                const prMap = new Map<string, { name: string; weight: number; reps: number; e1rm: number; date: string }>();
                const sorted = [...historyWorkouts].sort((a, b) => a.date.localeCompare(b.date));
                sorted.forEach(w => (w.exercises || []).forEach((e: any) => {
                  (e.sets || []).forEach((s: any) => {
                    const e1rm = epley1RM(s.weight || 0, s.reps || 0);
                    if (e1rm <= 0) return;
                    const name = e.exerciseName || e.exerciseId;
                    const prev = prMap.get(name);
                    if (!prev || e1rm > prev.e1rm) {
                      prMap.set(name, { name, weight: s.weight || 0, reps: s.reps || 0, e1rm: Math.round(e1rm), date: w.date });
                    }
                  });
                }));
                const prs = Array.from(prMap.values()).sort((a, b) => b.e1rm - a.e1rm).slice(0, 10);
                if (prs.length === 0) return null;
                return (
                  <div style={style.card}>
                    <div style={style.label}>🏆 Личные рекорды</div>
                    {prs.map((pr, i) => (
                      <div key={pr.name + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, fontSize: 10 }}>
                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#fff', marginRight: 4 }}>#{i + 1}</span>
                          <span style={{ color: '#fff' }}>{pr.name}</span>
                        </div>
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <strong style={{ color: ACCENT }}>{pr.weight}кг×{pr.reps}</strong>
                          <span style={{ marginLeft: 4, color: '#fff' }}>e1RM {pr.e1rm}</span>
                          <span style={{ marginLeft: 6, fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{pr.date.slice(5)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Fatigue metrics */}
              <SectionHeader icon="⚡" title="Усталость и восстановление" hint="монотонность · ЦНС · делод" />
              <div style={style.card}>
                <div style={style.label}>Метрики усталости</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 10 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ color: '#fff', fontSize: 10 }}>Монотонность</div>
                    <div style={{ fontWeight: 700, color: analytics.fatigue.monotony > 2 ? '#ef4444' : ACCENT }}>{analytics.fatigue.monotony.toFixed(1)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ color: '#fff', fontSize: 10 }}>Напряжение</div>
                    <div style={{ fontWeight: 700, color: analytics.fatigue.strain > 300 ? '#ef4444' : ACCENT }}>{Math.round(analytics.fatigue.strain)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ color: '#fff', fontSize: 10 }}>ЦНС</div>
                    <div style={{ fontWeight: 700, color: analytics.fatigue.cnsFatigue > 0.7 ? '#ef4444' : ACCENT }}>{Math.round(analytics.fatigue.cnsFatigue * 100)}%</div>
                  </div>
                </div>
              </div>
              {/* Overtraining risk */}
              {historyWorkouts.length >= 4 && (() => {
                const recent = historyWorkouts.slice(-8);
                const monotony = analytics.fatigue.monotony;
                const strain = analytics.fatigue.strain;
                const cns = analytics.fatigue.cnsFatigue;
                const weeklyFatigue = analytics.fatigue.weeklyFatigue;
                const risks: string[] = [];
                let level: 'low' | 'moderate' | 'high' = 'low';
                if (monotony > 2.0) { risks.push('Монотонность > 2.0 — высокий риск перетренированности (Stone 2007)'); level = 'high'; }
                if (monotony > 1.5 && monotony <= 2.0) { risks.push('Монотонность 1.5-2.0 — следите за восстановлением'); level = 'moderate'; }
                if (strain > 300) { risks.push('Напряжение > 300 — критическая нагрузка на ЦНС'); level = 'high'; }
                if (cns > 0.7) { risks.push('ЦНС усталость > 70% — рекомендуется разгрузка'); if (level !== 'high') level = 'moderate'; }
                if (weeklyFatigue > 0.7) { risks.push('Еженедельная усталость > 70% — снижьте интенсивность'); if (level !== 'high') level = 'moderate'; }
                const deloadWeeks = recent.filter(w => {
                  const vol = w.exercises.reduce((s, e) => s + e.sets.length, 0);
                  return vol < 20;
                }).length;
                if (deloadWeeks === 0 && recent.length >= 4) { risks.push('Нет разгрузочных недель за 8 недель'); if (level !== 'high') level = 'moderate'; }
                if (risks.length === 0) return null;
                return (
                  <div style={{ ...style.card, border: `1px solid ${level === 'high' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, background: level === 'high' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>{level === 'high' ? '🚨' : '⚠️'}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: level === 'high' ? '#ef4444' : '#f59e0b' }}>
                        Риск перетренированности: {level === 'high' ? 'высокий' : 'умеренный'}
                      </span>
                    </div>
                    {risks.map((r, i) => (
                      <div key={i} style={{ fontSize: 10, color:'#fff', marginBottom: 3, paddingLeft: 8, borderLeft: `2px solid ${level === 'high' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}` }}>• {r}</div>
                    ))}
                    {level === 'high' && (
                      <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', fontSize: 10, color: '#ef4444' }}>
                        Рекомендация: 3-5 дней активного восстановления, снижение объёма на 40-60%
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Deload recommendation */}
              {historyWorkouts.length >= 8 && (() => {
                const recent8 = historyWorkouts.slice(-8);
                const volumes = recent8.map(w => w.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0));
                const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
                const trend = volumes.slice(-3).reduce((s, v) => s + v, 0) / 3;
                const isRising = trend > avgVol * 1.15;
                const weeksSinceDeload = recent8.filter(w => {
                  const vol = w.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
                  return vol >= avgVol * 0.7;
                }).length;
                const needsDeload = weeksSinceDeload >= 4 && isRising;
                if (!needsDeload) return null;
                return (
                  <div style={{ ...style.card, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>📉</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>Рекомендация: разгрузочная неделя</span>
                    </div>
                    <div style={{ fontSize: 10, color:'#fff', lineHeight: 1.5 }}>
                      {weeksSinceDeload} недель подряд без снижения объёма. Тренд объёма растёт ({Math.round(trend)} → {Math.round(avgVol)} сетов). Рекомендуется неделя объёмом ~50% ({Math.round(avgVol * 0.5)} сетов) с RIR 3-4.
                    </div>
                    <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(96,165,250,0.08)', fontSize: 9, color: '#60a5fa' }}>
                      Пример: снизить веса на 10-15%, увеличить RIR до 3-4, убрать изолирующие упражнения
                    </div>
                  </div>
                );
              })()}
              {/* RPE trend */}
              {historyWorkouts.length >= 4 && (() => {
                const rpes = historyWorkouts.slice(-12).map(w => w.overallRPE || 0).filter(r => r > 0);
                if (rpes.length < 3) return null;
                const avgRPE = rpes.reduce((s, r) => s + r, 0) / rpes.length;
                const lastRPE = rpes[rpes.length - 1];
                const trend = lastRPE > avgRPE * 1.15 ? 'high' : lastRPE < avgRPE * 0.85 ? 'low' : 'normal';
                const trendLabel = trend === 'high' ? '⚠ выше нормы' : trend === 'low' ? '✓ ниже нормы' : 'в норме';
                const trendColor = trend === 'high' ? '#ef4444' : trend === 'low' ? '#22c55e' : '#fff';
                return (
                  <div style={style.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={style.label}>📊 RPE по сессиям</div>
                      <span style={{ fontSize: 9, color: trendColor }}>{trendLabel}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkline data={rpes} width={100} height={24} color={trend === 'high' ? '#ef4444' : '#f59e0b'} />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{avgRPE.toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: '#fff' }}>avg RPE</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* RPE distribution */}
              {historyWorkouts.length >= 4 && (() => {
                const allRPEs: number[] = [];
                historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => (e.sets || []).forEach((s: any) => {
                  if (s.rpe > 0) allRPEs.push(Math.round(s.rpe));
                })));
                if (allRPEs.length < 10) return null;
                const bins = [5, 6, 7, 8, 9, 10];
                const counts = bins.map(b => allRPEs.filter(r => r === b).length);
                const maxCount = Math.max(1, ...counts);
                const total = allRPEs.length;
                return (
                  <div style={style.card}>
                    <div style={style.label}>📊 Распределение RPE</div>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 50 }}>
                      {bins.map((b, i) => {
                        const h = Math.max(2, (counts[i] / maxCount) * 46);
                        const pct = Math.round((counts[i] / total) * 100);
                        const color = b <= 6 ? '#22c55e' : b <= 7 ? '#60a5fa' : b <= 8 ? '#f59e0b' : '#ef4444';
                        return (
                          <div key={b} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <div style={{ fontSize: 7, color: '#fff' }}>{pct}%</div>
                            <div style={{ width: '100%', height: h, background: color, borderRadius: 2 }} />
                            <div style={{ fontSize: 8, color: '#fff' }}>{b}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 9, color: '#fff', marginTop: 4, textAlign: 'center' }}>
                      Всего {total} замеров RPE
                    </div>
                  </div>
                );
              })()}
              {/* Exercise-specific e1RM progress */}
              {historyWorkouts.length >= 3 && (() => {
                const byEx = new Map<string, { dates: string[]; e1rms: number[] }>();
                historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((ex: any) => {
                  const name = ex.exerciseName || ex.exerciseId;
                  if (!name) return;
                  const best = (ex.sets || []).reduce((m: number, s: any) => Math.max(m, epley1RM(s.weight || 0, s.reps || 0)), 0);
                  if (best <= 0) return;
                  if (!byEx.has(name)) byEx.set(name, { dates: [], e1rms: [] });
                  const entry = byEx.get(name)!;
                  entry.dates.push(w.date);
                  entry.e1rms.push(Math.round(best));
                }));
                const exercises = [...byEx.entries()]
                  .map(([name, data]) => ({ name, count: data.dates.length, latest: data.e1rms[data.e1rms.length - 1], first: data.e1rms[0], delta: data.e1rms[data.e1rms.length - 1] - data.e1rms[0], data: data.e1rms }))
                  .filter(e => e.count >= 3)
                  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                  .slice(0, 6);
                if (exercises.length === 0) return null;
                return (
                  <div style={style.card}>
                    <div style={style.label}>🏋️ Прогресс по упражнениям</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {exercises.map(ex => (
                        <div key={ex.name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Sparkline data={ex.data} width={50} height={14} color={ex.delta > 0 ? '#22c55e' : '#ef4444'} showDots={false} />
                            <div style={{ fontSize: 9, textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: '#fff' }}>{ex.latest}кг</div>
                              <div style={{ color: ex.delta > 0 ? '#22c55e' : '#ef4444', fontSize: 8 }}>
                                {ex.delta > 0 ? '+' : ''}{ex.delta}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Plateau detection */}
              {historyWorkouts.length >= 6 && (() => {
                const byEx = new Map<string, { e1rms: number[]; sessions: number; latestDate: string }>();
                historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((ex: any) => {
                  const name = ex.exerciseName || ex.exerciseId;
                  if (!name) return;
                  const best = (ex.sets || []).reduce((m: number, s: any) => Math.max(m, epley1RM(s.weight || 0, s.reps || 0)), 0);
                  if (best <= 0) return;
                  if (!byEx.has(name)) byEx.set(name, { e1rms: [], sessions: 0, latestDate: w.date });
                  const entry = byEx.get(name)!;
                  entry.e1rms.push(Math.round(best));
                  entry.sessions++;
                  if (w.date > entry.latestDate) entry.latestDate = w.date;
                }));
                const plateaued = [...byEx.entries()]
                  .filter(([_, data]) => {
                    if (data.sessions < 4) return false;
                    const recent = data.e1rms.slice(-4);
                    const maxRecent = Math.max(...recent);
                    const minRecent = Math.min(...recent);
                    const range = maxRecent > 0 ? (maxRecent - minRecent) / maxRecent : 0;
                    return range < 0.03;
                  })
                  .map(([name, data]) => {
                    const recent = data.e1rms.slice(-4);
                    const best = Math.max(...recent);
                    const sessions = data.sessions;
                    return { name, best, sessions, date: data.latestDate };
                  })
                  .sort((a, b) => b.sessions - a.sessions)
                  .slice(0, 5);
                if (plateaued.length === 0) return null;
                return (
                  <div style={{ ...style.card, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>⚠️</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>Плато: {plateaued.length} упр.</span>
                    </div>
                    {plateaued.map(p => (
                      <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <div>
                          <span style={{ fontSize: 10, color: '#fff' }}>{p.name}</span>
                          <span style={{ fontSize: 9, color: '#fff', marginLeft: 4 }}>{p.sessions} сессий</span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>{p.best}кг</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 4, fontSize: 9, color: '#fff' }}>
                      💡 Попробуйте: изменить хват, темп, диапазон повторов или добавить assistance
                    </div>
                  </div>
                );
              })()}
              {/* Готовность и риск (перенесены из Инструментов ПЛ-авто) */}
              <ReadinessForecastCard />
              <TrainingScoreCard workoutsPerWeek={tprofile.daysPerWeek ?? 3} avgMinutes={75} intensity="moderate" goal={(tprofile.goal === 'strength' ? 'strength' : (tprofile.goal === 'mass' || tprofile.goal === 'hypertrophy') ? 'hypertrophy' : tprofile.goal === 'endurance' ? 'endurance' : 'recomposition') as 'strength' | 'hypertrophy' | 'endurance' | 'recomposition'} experience={(tprofile.level === 'novice' ? 'beginner' : tprofile.level === 'intermediate' ? 'intermediate' : 'advanced') as 'beginner' | 'intermediate' | 'advanced'} sleepHours={tprofile.sleepHours ?? 7} stressLevel={Math.round(tprofile.stressLevel ?? 3)} jointPain={[]} deloadWeeksAgo={99} weight={tprofile.bodyWeight || 80} age={30} sex={'male'} />
              {/* Training consistency */}
              <SectionHeader icon="📅" title="Регулярность и привычки" hint="серии · частота · плотность" />
              {historyWorkouts.length >= 4 && (() => {
                const weeks = 8;
                const today = new Date();
                const weekData: { label: string; count: number; target: number }[] = [];
                for (let w = weeks - 1; w >= 0; w--) {
                  const weekStart = new Date(today);
                  weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
                  const weekEnd = new Date(today);
                  weekEnd.setDate(weekEnd.getDate() - w * 7);
                  const count = historyWorkouts.filter(wo => {
                    const d = new Date(wo.date);
                    return d > weekStart && d <= weekEnd;
                  }).length;
                  weekData.push({ label: `Н${weeks - w}`, count, target: 4 });
                }
                const avgPerWeek = weekData.reduce((s, w) => s + w.count, 0) / weeks;
                const consistency = weekData.filter(w => w.count >= 3).length;
                const perfectWeeks = weekData.filter(w => w.count >= 4).length;
                return (
                  <div style={style.card}>
                    <div style={style.label}>📅 Регулярность</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{avgPerWeek.toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: '#fff' }}>трен/нед</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>{consistency}/{weeks}</div>
                        <div style={{ fontSize: 9, color: '#fff' }}>стабильных</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>{perfectWeeks}</div>
                        <div style={{ fontSize: 9, color: '#fff' }}>идеальных</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 32 }}>
                      {weekData.map((w, i) => {
                        const h = Math.min((w.count / 5) * 100, 100);
                        const color = w.count >= 4 ? '#22c55e' : w.count >= 3 ? '#f59e0b' : w.count >= 1 ? '#ef4444' : 'rgba(255,255,255,0.05)';
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <div style={{ fontSize: 8, color: '#fff' }}>{w.count}</div>
                            <div style={{ width: '100%', height: `${h}%`, minHeight: 2, background: color, borderRadius: 2 }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Weekly targets */}
              {historyWorkouts.length >= 1 && <WeeklyTargetsCard historyWorkouts={historyWorkouts} />}
              {/* Workout streaks */}
              {historyWorkouts.length >= 3 && (() => {
                const sorted = [...historyWorkouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const days = sorted.map(w => new Date(w.date).toISOString().slice(0, 10));
                const uniqueDays = [...new Set(days)];
                let currentStreak = 0;
                const today = new Date().toISOString().slice(0, 10);
                let checkDate = new Date();
                for (let i = 0; i < 30; i++) {
                  const ds = checkDate.toISOString().slice(0, 10);
                  if (uniqueDays.includes(ds)) { currentStreak++; } else if (ds !== today) break;
                  checkDate.setDate(checkDate.getDate() - 1);
                }
                let maxStreak = 0;
                let cur = 1;
                for (let i = 1; i < uniqueDays.length; i++) {
                  const prev = new Date(uniqueDays[i - 1]);
                  const curr = new Date(uniqueDays[i]);
                  const diffDays = Math.round((prev.getTime() - curr.getTime()) / (24 * 60 * 60 * 1000));
                  if (diffDays === 1) { cur++; } else { maxStreak = Math.max(maxStreak, cur); cur = 1; }
                }
                maxStreak = Math.max(maxStreak, cur);
                const recentPRs = sorted.filter(w => w.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).reduce((count: number, w: any) => {
                  return count + (w.exercises || []).filter((e: any) => (e.sets || []).some((s: any) => s.isPR)).length;
                }, 0);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <div style={{ ...style.card, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: currentStreak >= 3 ? '#22c55e' : ACCENT }}>{currentStreak}</div>
                      <div style={{ fontSize: 9, color: '#fff' }}>🔥 Серия дней</div>
                    </div>
                    <div style={{ ...style.card, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{maxStreak}</div>
                      <div style={{ fontSize: 9, color: '#fff' }}>🏆 Макс. серия</div>
                    </div>
                    <div style={{ ...style.card, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: recentPRs > 0 ? '#a855f7' : '#fff' }}>{recentPRs}</div>
                      <div style={{ fontSize: 9, color: '#fff' }}>⭐ PR за 7д</div>
                    </div>
                  </div>
                );
              })()}
              {/* Muscle group frequency per week — heatmap: интенсивность по подходам */}
              {historyWorkouts.length >= 4 && (() => {
                const weeks = 8;
                const today = new Date();
                const groupWeeks: Record<string, number[]> = {};
                for (let w = weeks - 1; w >= 0; w--) {
                  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
                  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() - w * 7);
                  const weekWorkouts = historyWorkouts.filter(wo => { const d = new Date(wo.date); return d > weekStart && d <= weekEnd; });
                  const groupSets: Record<string, number> = {};
                  weekWorkouts.forEach(wo => wo.exercises.forEach((e: any) => {
                    const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                    if (cat?.group) groupSets[cat.group] = (groupSets[cat.group] || 0) + (e.sets?.length || 0);
                  }));
                  Object.entries(groupSets).forEach(([g, sets]) => { if (!groupWeeks[g]) groupWeeks[g] = new Array(weeks).fill(0); groupWeeks[g][weeks - 1 - w] = sets; });
                }
                const groups = Object.entries(groupWeeks)
                  .map(([g, arr]) => ({ group: g, total: arr.reduce((s, v) => s + v, 0), data: arr }))
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 8);
                if (groups.length === 0) return null;
                const maxSets = Math.max(1, ...groups.flatMap(g => g.data));
                const heat = (v: number) => {
                  if (v === 0) return 'rgba(255,255,255,0.04)';
                  const t = v / maxSets;
                  if (t > 0.7) return 'rgba(239,68,68,0.65)';
                  if (t > 0.45) return 'rgba(245,158,11,0.55)';
                  if (t > 0.2) return 'rgba(0,230,138,0.4)';
                  return 'rgba(0,230,138,0.15)';
                };
                return (
                  <div style={style.card}>
                    <div style={style.label}>💪 Частота по группам (подходы/нед)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '86px repeat(8, 1fr)', gap: '2px 4px', alignItems: 'center' }}>
                      <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', textAlign: 'right' }}>Н-8…Н-1</span>
                      {Array.from({ length: weeks }, (_, i) => <span key={i} style={{ fontSize: 8, color: '#fff', textAlign: 'center' }}>{i + 1}</span>)}
                      {groups.map(({ group, total, data }) => (
                        <React.Fragment key={group}>
                          <span style={{ fontSize: 9, color: '#fff', textAlign: 'right' }}>{GRP_RU[group] || group}</span>
                          {data.map((v, wi) => (
                            <div key={wi} style={{ height: 12, borderRadius: 3, background: heat(v), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }} title={`${GRP_RU[group] || group}: ${v} подходов`}>
                              {v > 0 && <span style={{ fontSize: 7, color: '#fff' }}>{v}</span>}
                            </div>
                          ))}
                          <span style={{ fontSize: 9, color: '#fff', textAlign: 'right' }}>{total}</span>
                        </React.Fragment>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginTop: 6, fontSize: 8, color: '#fff' }}>
                      <span>меньше</span>
                      {[0.1, 0.3, 0.6, 1].map(t => <span key={t} style={{ width: 10, height: 10, borderRadius: 2, background: heat(maxSets * t) }} />)}
                      <span>больше</span>
                    </div>
                  </div>
                );
              })()}
              {/* День-of-week training heatmap */}
              {historyWorkouts.length >= 3 && (() => {
                const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
                const dayData = dayNames.map((name, idx) => {
                  const dayWorkouts = historyWorkouts.filter(w => new Date(w.date).getDay() === (idx + 1) % 7);
                  const totalSets = dayWorkouts.reduce((s, w) => s + w.exercises.reduce((sum: number, e: any) => sum + (e.sets?.length || 0), 0), 0);
                  const groups = new Map<string, number>();
                  dayWorkouts.forEach(w => w.exercises.forEach((e: any) => {
                    const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                    if (cat?.group) groups.set(cat.group, (groups.get(cat.group) || 0) + (e.sets?.length || 0));
                  }));
                  const topGroup = [...groups.entries()].sort((a, b) => b[1] - a[1])[0];
                  return { name, workouts: dayWorkouts.length, sets: totalSets, topGroup: topGroup ? GRP_RU[topGroup[0]] || topGroup[0] : '—' };
                });
                const maxSets = Math.max(1, ...dayData.map(d => d.sets));
                return (
                  <div style={style.card}>
                    <div style={style.label}>📅 Дни тренировок</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                      {dayData.map((d, i) => {
                        const intensity = d.sets / maxSets;
                        const bg = intensity > 0.7 ? 'rgba(0,230,138,0.2)' : intensity > 0.3 ? 'rgba(0,230,138,0.1)' : intensity > 0 ? 'rgba(0,230,138,0.05)' : 'rgba(255,255,255,0.02)';
                        return (
                          <div key={i} style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 6, background: bg }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: d.workouts > 0 ? '#00e68a' : 'rgba(255,255,255,0.2)' }}>{d.name}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: '2px 0' }}>{d.workouts}</div>
                            <div style={{ fontSize: 8, color: '#fff' }}>{d.sets} сетов</div>
                            {d.topGroup !== '—' && <div style={{ fontSize: 7, color: '#fff', marginTop: 1 }}>{d.topGroup}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Exercise frequency across all sessions */}
              {historyWorkouts.length >= 3 && (() => {
                const exFreq = new Map<string, { count: number; sets: number; group: string }>();
                historyWorkouts.forEach((w: any) => (w.exercises || []).forEach((e: any) => {
                  const name = e.exerciseName || e.exerciseId;
                  if (!name) return;
                  const cat = EXERCISE_CATALOG.find((c: any) => c.id === e.exerciseId);
                  const prev = exFreq.get(name);
                  if (prev) { prev.count++; prev.sets += e.sets?.length || 0; }
                  else exFreq.set(name, { count: 1, sets: e.sets?.length || 0, group: cat?.group || '' });
                }));
                const sorted = [...exFreq.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12);
                if (sorted.length === 0) return null;
                const maxCount = sorted[0][1].count;
                return (
                  <div style={style.card}>
                    <div style={style.label}>🔥 Частота упражнений</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {sorted.map(([name, data], i) => {
                        const pct = data.count / maxCount;
                        const color = data.group ? (GRP_RU[data.group] ? '#00e68a' : '#60a5fa') : '#a855f7';
                        return (
                          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ fontSize: 9, color: '#fff', width: 14, textAlign: 'right' }}>{i + 1}</div>
                            <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                              <div style={{ height: '100%', width: `${pct * 100}%`, background: `${color}33`, borderRadius: 3, transition: 'width 0.3s' }} />
                              <span style={{ position: 'absolute', left: 4, top: 1, fontSize: 8, color: '#fff', lineHeight: 12 }}>{name}</span>
                            </div>
                            <div style={{ fontSize: 9, color: '#fff', width: 30, textAlign: 'right' }}>{data.count}×</div>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', width: 24, textAlign: 'right' }}>{data.sets}с</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Time under tension */}
              {historyWorkouts.length > 0 && (() => {
                const lastWorkouts = historyWorkouts.slice(-8);
                let totalTUT = 0;
                let totalSessions = 0;
                lastWorkouts.forEach(w => {
                  w.exercises.forEach((e: any) => {
                    const sets = e.sets || [];
                    sets.forEach((s: any) => {
                      const reps = s.reps || 10;
                      const rest = s.restSec || 90;
                      const timePerSet = reps * 3 + rest;
                      totalTUT += timePerSet;
                    });
                  });
                  if (w.exercises.length > 0) totalSessions++;
                });
                const avgTUT = totalSessions > 0 ? Math.round(totalTUT / totalSessions) : 0;
                const totalMin = Math.round(totalTUT / 60);
                const avgMin = Math.round(avgTUT / 60);
                return (
                  <div style={style.card}>
                    <div style={style.label}>⏱ Время под нагрузкой</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{avgMin} мин</div>
                        <div style={{ fontSize: 10, color: '#fff' }}>Среднее за сессию</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>{totalMin} мин</div>
                        <div style={{ fontSize: 10, color: '#fff' }}>Всего (8 нед)</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Workout density */}
              {historyWorkouts.length >= 3 && (() => {
                const recent = historyWorkouts.slice(-8);
                const densities = recent.map(w => {
                  const dur = w.duration || 0;
                  const totalSets = w.exercises.reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
                  const totalVol = w.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0);
                  if (dur <= 0) return null;
                  return { setsPerMin: totalSets / dur, volPerMin: totalVol / dur, sets: totalSets, dur, date: w.date };
                }).filter(Boolean) as { setsPerMin: number; volPerMin: number; sets: number; dur: number; date: string }[];
                if (densities.length < 3) return null;
                const avgSetsPerMin = densities.reduce((s, d) => s + d.setsPerMin, 0) / densities.length;
                const avgVolPerMin = densities.reduce((s, d) => s + d.volPerMin, 0) / densities.length;
                const last = densities[densities.length - 1];
                const trend = last.setsPerMin > avgSetsPerMin * 1.1;
                return (
                  <div style={{ ...style.card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 9, color: '#fff', marginBottom: 2 }}>⚡ Плотность</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: trend ? '#f59e0b' : ACCENT }}>{avgSetsPerMin.toFixed(2)}</div>
                      <div style={{ fontSize: 9, color: '#fff' }}>сетов/мин (avg)</div>
                      <Sparkline data={densities.map(d => d.setsPerMin)} width={60} height={14} color={trend ? '#f59e0b' : '#00e68a'} showDots={false} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#fff', marginBottom: 2 }}>📊 Объём/мин</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{Math.round(avgVolPerMin)}</div>
                      <div style={{ fontSize: 9, color: '#fff' }}>кг/мин (avg)</div>
                      <Sparkline data={densities.map(d => d.volPerMin)} width={60} height={14} color="#60a5fa" showDots={false} />
                    </div>
                  </div>
                );
              })()}
              {/* Volume per session bar chart */}
              {historyWorkouts.length >= 3 && (() => {
                const recent = historyWorkouts.slice(-12);
                const vols = recent.map(w => w.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0));
                const maxVol = Math.max(1, ...vols);
                return (
                  <div style={style.card}>
                    <div style={style.label}>📊 Объём за сессию</div>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 50 }}>
                      {vols.map((v, i) => {
                        const h = Math.max(2, (v / maxVol) * 46);
                        const isMax = v === maxVol;
                        const isMin = v === Math.min(...vols.filter(x => x > 0));
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <div style={{ width: '100%', height: h, borderRadius: 2, background: isMax ? '#22c55e' : isMin ? '#ef4444' : '#00e68a', opacity: isMax ? 1 : 0.6 }} />
                            <div style={{ fontSize: 7, color: '#fff' }}>{(v / 1000).toFixed(1)}т</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* Trend sparklines */}
              {totals.filter(t => t > 0).length >= 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={style.card}>
                    <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Объём (сеты/нед)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkline data={totals} width={60} height={20} color="#00e68a" />
                      <span style={{ fontSize: 10, color: totals[7] > totals[0] ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                        {totals[7] > totals[0] ? '↑' : '↓'} {Math.abs(totals[7] - totals[0])} сетов
                      </span>
                    </div>
                  </div>
                  <div style={style.card}>
                    <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Напряжение</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkline data={[analytics.fatigue.monotony, analytics.fatigue.strain / 100, analytics.fatigue.cnsFatigue * 10, analytics.recovery.readinessEstimate / 10]} width={60} height={20} color="#a855f7" />
                      <span style={{ fontSize: 10, color: analytics.fatigue.weeklyFatigue > 0.7 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                        {Math.round(analytics.fatigue.weeklyFatigue * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {/* Fatigue trend by week */}
              {diaryProgress.length >= 3 && (
                <div style={style.card}>
                  <div style={style.label}>📉 Тренды по неделям</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 9, color: '#fff', marginBottom: 2 }}>Объём (кг/нед)</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkline data={diaryProgress.slice(-8).map(w => w.totalVolume / 1000)} width={70} height={20} color="#00e68a" />
                        {diaryProgress.length >= 2 && <span style={{ fontSize: 10, fontWeight: 600, color: diaryProgress[diaryProgress.length - 1].totalVolume > diaryProgress[0].totalVolume ? '#22c55e' : '#ef4444' }}>
                          {diaryProgress[diaryProgress.length - 1].totalVolume > diaryProgress[0].totalVolume ? '↑' : '↓'} {Math.abs(Math.round((diaryProgress[diaryProgress.length - 1].totalVolume - diaryProgress[0].totalVolume) / 1000))}т
                        </span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#fff', marginBottom: 2 }}>Тренировок/нед</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkline data={diaryProgress.slice(-8).map(w => w.workoutCount)} width={70} height={20} color="#60a5fa" />
                        {diaryProgress.length >= 2 && <span style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa' }}>
                          {diaryProgress[diaryProgress.length - 1].workoutCount} ×
                        </span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Recovery card */}
              {(() => {
                const rh = (() => { try { return loadReadinessHistory(); } catch { return []; } })();
                if (rh.length < 3) return null;
                const recent = rh.slice(-8);
                const avgRecovery = recent.reduce((s, r) => s + (r.recovery || 50), 0) / recent.length;
                const avgFatigue = recent.reduce((s, r) => s + (r.fatigue || 50), 0) / recent.length;
                const recTrend = recent[recent.length - 1]?.recovery > recent[0]?.recovery;
                const fatTrend = recent[recent.length - 1]?.fatigue < recent[0]?.fatigue;
                const readinessScore = Math.round(avgRecovery * 0.6 + (100 - avgFatigue) * 0.4);
                return (
                  <div style={style.card}>
                    <div style={style.label}>💚 Восстановление</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#fff' }}>Восстановление</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: avgRecovery >= 50 ? '#22c55e' : '#ef4444' }}>{Math.round(avgRecovery)}%</div>
                        <Sparkline data={recent.map(r => r.recovery)} width={50} height={12} color={recTrend ? '#22c55e' : '#ef4444'} showDots={false} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#fff' }}>Усталость</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: avgFatigue <= 50 ? '#22c55e' : '#f59e0b' }}>{Math.round(avgFatigue)}%</div>
                        <Sparkline data={recent.map(r => r.fatigue)} width={50} height={12} color={fatTrend ? '#22c55e' : '#f59e0b'} showDots={false} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#fff' }}>Readiness</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: readinessScore >= 50 ? '#22c55e' : '#ef4444' }}>{readinessScore}%</div>
                        <Sparkline data={recent.map(r => r.recovery * 0.6 + (100 - r.fatigue) * 0.4)} width={50} height={12} color={readinessScore >= 50 ? '#22c55e' : '#ef4444'} showDots={false} />
                      </div>
                    </div>
                  </div>
                );
              })()}
              {/* Weekly summary card */}
              {historyWorkouts.length > 0 && (() => {
                const lastWeek = historyWorkouts.filter(w => {
                  const d = new Date(w.date);
                  const now = new Date();
                  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  return d >= weekAgo;
                });
                if (lastWeek.length === 0) return null;
                const totalVol = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
                const totalSetsW = lastWeek.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.sets.length, 0), 0);
                const topEx = new Map<string, { vol: number; e1rm: number }>();
                lastWeek.forEach(w => w.exercises.forEach(ex => {
                  const prev = topEx.get(ex.exerciseName);
                  const vol = ex.totalVolume;
                  const e1rm = ex.estimated1RM || 0;
                  if (!prev || vol > prev.vol) topEx.set(ex.exerciseName, { vol, e1rm });
                }));
                const sorted = Array.from(topEx.entries()).sort((a, b) => b[1].vol - a[1].vol).slice(0, 3);
                const bestPR = lastWeek.flatMap(w => w.exercises.map(ex => ({ name: ex.exerciseName, e1rm: ex.estimated1RM || 0 }))).sort((a, b) => b.e1rm - a.e1rm)[0];
                return (
                  <div style={style.card}>
                    <div style={style.label}>📋 Итоги недели</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#fff' }}>Тренировок</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{lastWeek.length}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#fff' }}>Подходов</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{totalSetsW}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#fff' }}>Тоннаж</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#a855f7' }}>{(totalVol / 1000).toFixed(1)}т</div>
                      </div>
                    </div>
                    {sorted.length > 0 && (
                      <div style={{ fontSize: 10, color: '#fff' }}>
                        <span style={{ color: '#fff' }}>Топ: </span>
                        {sorted.map(([name, data], i) => (
                          <span key={i}>
                            {i > 0 && ' · '}
                            <span style={{ color: '#fff' }}>{name}</span>
                            <span style={{ color: '#fff' }}> ({Math.round(data.vol).toLocaleString()} кг)</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {bestPR && bestPR.e1rm > 0 && (
                      <div style={{ fontSize: 10, color: '#fff', marginTop: 2 }}>
                        🏆 Лучший e1RM: <span style={{ color: ACCENT, fontWeight: 700 }}>{bestPR.name}</span> {Math.round(bestPR.e1rm)} кг
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Expert analytics toggle */}
              <div style={style.card}>
                <button onClick={() => setHubAnalyticsExpanded(!hubAnalyticsExpanded)} style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(168,85,247,0.25)', cursor: 'pointer',
                  background: hubAnalyticsExpanded ? 'rgba(168,85,247,0.08)' : 'transparent', color: '#a855f7', fontWeight: 600, fontSize: 11,
                }}>
                  {hubAnalyticsExpanded ? '▾ Скрыть' : '▸'} 🔬 Экспертная аналитика (13 карт)
                </button>
                {hubAnalyticsExpanded && historyWorkouts.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <RIRCalibrationCard />
                    <MesoCorrectionCard
                      profile={tprofile} acwr={expertAcwr} monotony={expertMono}
                      avgReadiness={(() => { const r = linked.readiness; return r ? (r.recovery + (100 - r.fatigue)) / 2 : 70; })()}
                      mesoWeeks={mesoLength} missedSessions={0}
                      exercises={expertExercises}
                      currentVolume={expertRecentVol > 0 ? Math.round(expertRecentVol / Math.max(1, Math.floor(historyWorkouts.length / 14))) : 16}
                      currentRir={expertRirStats.bias >= 0 ? 2 : 1}
                    />
                    <MuscleProgressCard sessions={historyWorkouts} level={level} />
                    <VolumeTrendCard sessions={historyWorkouts} />
                    <LoadRadarCard sessions={historyWorkouts} level={level} />
                    <WeekCompareCard sessions={historyWorkouts} />
                    <LiftHistoryCard sessions={historyWorkouts} />
                    <AnalyticsTab sessions={historyWorkouts} onRefresh={onRefresh} />
                    <StructuredAnalyticsCard sessions={historyWorkouts} />
                    <AllExercisesTrendCard sessions={historyWorkouts} />
                    {/* Weekly volume bar chart */}
                    {historyWorkouts.length >= 3 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const weekMap = new Map<string, { vol: number; sets: number; count: number }>();
                      sorted.forEach(w => {
                        const d = new Date(w.date);
                        const wkStart = new Date(d); wkStart.setDate(d.getDate() - d.getDay());
                        const key = wkStart.toISOString().slice(0, 10);
                        const prev = weekMap.get(key) || { vol: 0, sets: 0, count: 0 };
                        prev.vol += w.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0);
                        prev.sets += w.exercises.reduce((s: number, e: any) => s + (e.sets || []).length, 0);
                        prev.count++;
                        weekMap.set(key, prev);
                      });
                      const weeks = [...weekMap.entries()].slice(-8);
                      if (weeks.length < 2) return null;
                      const volMax = Math.max(...weeks.map(([, w]) => w.vol), 1);
                      const h = 60; const ww = 300;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>📊 Объём по неделям (тоннаж, кг)</div>
                          <svg width="100%" viewBox={`0 0 ${ww} ${h}`} style={{ display: 'block' }}>
                            {weeks.map(([wk, data], i) => {
                              const bh = (data.vol / volMax) * (h - 12);
                              const x = (i / weeks.length) * ww + 4;
                              const bw = ww / weeks.length - 6;
                              return (
                                <g key={wk}>
                                  <rect x={x} y={h - bh - 8} width={bw} height={bh} rx={3} fill={data.vol >= volMax * 0.8 ? '#22c55e' : data.vol >= volMax * 0.5 ? '#60a5fa' : 'rgba(255,255,255,0.15)'} />
                                  <text x={x + bw / 2} y={h - bh - 10} textAnchor="middle" fill="#fff" fontSize={7}>{data.vol >= 1000 ? `${(data.vol / 1000).toFixed(1)}т` : data.vol}</text>
                                  <text x={x + bw / 2} y={h - 1} textAnchor="middle" fill="#fff" fontSize={6}>{wk.slice(5, 10)}</text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      );
                    })()}
                    {/* Monthly summary */}
                    {historyWorkouts.length >= 4 && (() => {
                      const now = new Date();
                      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                      const monthW = historyWorkouts.filter(w => new Date(w.date) >= monthStart);
                      if (monthW.length === 0) return null;
                      const totalVol = monthW.reduce((s: number, w: any) => s + w.exercises.reduce((ss: number, e: any) => ss + e.totalVolume, 0), 0);
                      const totalSets = monthW.reduce((s: number, w: any) => s + w.exercises.reduce((ss: number, e: any) => ss + (e.sets || []).length, 0), 0);
                      const totalEx = monthW.reduce((s: number, w: any) => s + w.exercises.length, 0);
                      const avgRPE = (() => { let c = 0, s = 0; monthW.forEach(w => w.exercises.forEach(e => e.sets.forEach((st: any) => { if (st.rpe) { s += st.rpe; c++; } }))); return c > 0 ? (s / c).toFixed(1) : '—'; })();
                      const prCount = monthW.reduce((cnt: number, w: any) => cnt + w.exercises.filter((e: any) => (e.sets || []).some((s: any) => s.isPR)).length, 0);
                      return (
                        <div style={style.card}>
                          <div style={style.label}>📅 {now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })} (итого)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
                            <div><div style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>{monthW.length}</div><div style={{ fontSize: 8, color: '#fff' }}>тренировок</div></div>
                            <div><div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>{(totalVol / 1000).toFixed(1)}т</div><div style={{ fontSize: 8, color: '#fff' }}>тоннаж</div></div>
                            <div><div style={{ fontSize: 14, fontWeight: 800, color: '#a855f7' }}>{totalSets}</div><div style={{ fontSize: 8, color: '#fff' }}>подходов</div></div>
                            <div><div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>{avgRPE}</div><div style={{ fontSize: 8, color: '#fff' }}>RPE avg</div></div>
                            <div><div style={{ fontSize: 14, fontWeight: 800, color: prCount > 0 ? '#22c55e' : '#fff' }}>{prCount}</div><div style={{ fontSize: 8, color: '#fff' }}>PR</div></div>
                          </div>
                        </div>
                      );
                    })()}
                    <StandardForecastCard sessions={historyWorkouts} />
                    {/* Volume Landmarks per muscle */}
                    {historyWorkouts.length >= 4 && (() => {
                      const MRV: Record<string, number> = { chest: 22, back: 26, quads: 20, hamstrings: 14, shoulders: 18, biceps: 14, triceps: 12, glutes: 16, calves: 12 };
                      const MEV: Record<string, number> = { chest: 8, back: 8, quads: 8, hamstrings: 6, shoulders: 8, biceps: 4, triceps: 4, glutes: 6, calves: 6 };
                      const recent = historyWorkouts.slice(-8);
                      const MUSCLES = ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'glutes', 'calves'];
                      const muscleSets: Record<string, number[]> = {};
                      MUSCLES.forEach(m => { muscleSets[m] = []; });
                      for (let w = 0; w < recent.length; w++) {
                        const wo = recent[w];
                        const weekSets: Record<string, number> = {};
                        MUSCLES.forEach(m => { weekSets[m] = 0; });
                        wo.exercises.forEach((ex: any) => {
                          const cat = EXERCISE_CATALOG.find((c: any) => c.id === ex.exerciseId);
                          const group = cat?.group || '';
                          if (weekSets[group] !== undefined) weekSets[group] += (ex.sets || []).length;
                        });
                        MUSCLES.forEach(m => muscleSets[m].push(weekSets[m]));
                      }
                      return (
                        <div style={style.card}>
                          <div style={style.label}>📊 Ландмарки объёма (средняя/нед, последние {recent.length})</div>
                          <div style={{ display: 'grid', gap: 3 }}>
                            {MUSCLES.map(m => {
                              const avg = muscleSets[m].length > 0 ? muscleSets[m].reduce((s: number, v: number) => s + v, 0) / muscleSets[m].length : 0;
                              const mev = MEV[m] || 8; const mrv = MRV[m] || 20;
                              const ratio = avg / mrv;
                              const color = avg < mev ? '#ef4444' : avg < mrv * 0.7 ? '#22c55e' : avg < mrv ? '#f59e0b' : '#ef4444';
                              const label = avg < mev ? 'Ниже MEV' : avg < mrv * 0.7 ? 'Оптимально' : avg < mrv ? 'Выше нормы' : 'Over MRV';
                              return (
                                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                                  <span style={{ width: 70, color: '#fff', textAlign: 'right' }}>{GRP_RU[m] || m}</span>
                                  <div style={{ flex: 1, height: 8, borderRadius: 3, background: 'rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, ratio * 100)}%`, background: color, borderRadius: 3 }} />
                                    <div style={{ position: 'absolute', left: `${(mev / mrv) * 100}%`, top: -1, width: 1, height: 10, background: '#fff' }} />
                                  </div>
                                  <span style={{ minWidth: 35, textAlign: 'right', fontWeight: 600, color }}>{Math.round(avg)}</span>
                                  <span style={{ fontSize: 8, color: '#fff', minWidth: 55 }}>/ {mrv} MRV</span>
                                  <span style={{ fontSize: 8, color }}>{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    <VolumeRecoveryCorrelationCard sessions={historyWorkouts} />
                    {/* Fatigue accumulation curve */}
                    {historyWorkouts.length >= 4 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const last12 = sorted.slice(-12);
                      const fatigueData: number[] = [];
                      const volumeData: number[] = [];
                      last12.forEach(w => {
                        let rpeSum = 0, rpeCount = 0;
                        w.exercises.forEach((e: any) => e.sets.forEach((st: any) => { if (st.rpe) { rpeSum += st.rpe; rpeCount++; } }));
                        fatigueData.push(rpeCount > 0 ? rpeSum / rpeCount : 7);
                        volumeData.push(w.exercises.reduce((s: number, e: any) => s + e.totalVolume, 0) / 1000);
                      });
                      const fMax = Math.max(...fatigueData, 1);
                      const vMax = Math.max(...volumeData, 1);
                      const h = 50; const ww = 280;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>⚡ Кривая усталости</div>
                          <div style={{ fontSize: 9, color: '#fff', marginBottom: 4 }}>RPE (синий) + объём (зелёный) по сессиям</div>
                          <svg width="100%" viewBox={`0 0 ${ww} ${h}`} style={{ display: 'block' }}>
                            <polyline points={fatigueData.map((v, i) => `${(i / Math.max(fatigueData.length - 1, 1)) * ww},${h - (v / fMax) * (h - 4) - 2}`).join(' ')} fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinejoin="round" />
                            <polyline points={volumeData.map((v, i) => `${(i / Math.max(volumeData.length - 1, 1)) * ww},${h - (v / vMax) * (h - 4) - 2}`).join(' ')} fill="none" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 2" strokeLinejoin="round" opacity={0.6} />
                            {fatigueData.map((v, i) => <circle key={i} cx={(i / Math.max(fatigueData.length - 1, 1)) * ww} cy={h - (v / fMax) * (h - 4) - 2} r={2} fill="#60a5fa" />)}
                          </svg>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{last12[0]?.date.slice(5, 10)}</span>
                            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{last12[last12.length - 1]?.date.slice(5, 10)}</span>
                          </div>
                          {(() => {
                            const last3 = fatigueData.slice(-3);
                            const avg = last3.length > 0 ? last3.reduce((s, v) => s + v, 0) / last3.length : 7;
                            return <div style={{ fontSize: 9, color: avg >= 8 ? '#ef4444' : avg >= 6.5 ? '#f59e0b' : '#22c55e', marginTop: 4 }}>Средний RPE (3 сессии): {avg.toFixed(1)}. {avg >= 8 ? '⚠ Высокая нагрузка — рассмотрите делоуд' : avg >= 6.5 ? 'Умеренная нагрузка' : 'Хорошее восстановление'}</div>;
                          })()}
                        </div>
                      );
                    })()}
                    {/* Training velocity per muscle */}
                    {historyWorkouts.length >= 6 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const MUSCLES = ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps'];
                      const velocities: { group: string; velocity: number; sessions: number; first: number; last: number }[] = [];
                      MUSCLES.forEach(m => {
                        const exBest = new Map<string, { e1rm: number; date: string }>();
                        sorted.forEach(w => w.exercises.forEach((ex: any) => {
                          const cat = EXERCISE_CATALOG.find((c: any) => c.id === ex.exerciseId);
                          if (cat?.group !== m) return;
                          (ex.sets || []).forEach((s: any) => {
                            const e1rm = s.reps > 0 ? Math.round(s.weight * (1 + s.reps / 30)) : 0;
                            const prev = exBest.get(ex.exerciseId);
                            if (!prev || e1rm > prev.e1rm) exBest.set(ex.exerciseId, { e1rm, date: w.date });
                          });
                        }));
                        if (exBest.size < 2) return;
                        const vals = [...exBest.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                        const first = vals[0].e1rm; const last = vals[vals.length - 1].e1rm;
                        const weeks = Math.max(1, (new Date(vals[vals.length - 1].date).getTime() - new Date(vals[0].date).getTime()) / (7 * 24 * 60 * 60 * 1000));
                        velocities.push({ group: m, velocity: +((last - first) / weeks).toFixed(1), sessions: vals.length, first, last });
                      });
                      velocities.sort((a, b) => b.velocity - a.velocity);
                      if (velocities.length === 0) return null;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>🚀 Скорость прогресса (кг/нед)</div>
                          <div style={{ fontSize: 9, color: '#fff', marginBottom: 4 }}>Изменение 1ПМ по мышечным группам</div>
                          <div style={{ display: 'grid', gap: 3 }}>
                            {velocities.map(v => (
                              <div key={v.group} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                                <span style={{ width: 70, color: '#fff', textAlign: 'right' }}>{GRP_RU[v.group] || v.group}</span>
                                <span style={{ fontWeight: 700, color: v.velocity > 0 ? '#22c55e' : v.velocity < 0 ? '#ef4444' : '#fff', minWidth: 40 }}>{v.velocity > 0 ? '+' : ''}{v.velocity}</span>
                                <span style={{ fontSize: 9, color: '#fff' }}>кг/нед ({v.first}→{v.last}кг, {v.sessions} упр.)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <StickingPointAnalysisCard sessions={historyWorkouts} />
                    {/* Training density trend */}
                    {historyWorkouts.length >= 4 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const last12 = sorted.slice(-12);
                      const densityData = last12.map(w => {
                        const totalSets = w.exercises.reduce((s: number, e: any) => s + (e.sets || []).length, 0);
                        const dur = w.duration || 60;
                        return { date: w.date.slice(5, 10), setsPerMin: +(totalSets / dur).toFixed(2), sets: totalSets, mins: dur };
                      });
                      const maxD = Math.max(...densityData.map(d => d.setsPerMin), 1);
                      const h = 40; const ww = 280;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>⏱ Плотность тренировок</div>
                          <div style={{ fontSize: 9, color: '#fff', marginBottom: 4 }}>Подходы/минуту по сессиям</div>
                          <svg width="100%" viewBox={`0 0 ${ww} ${h}`} style={{ display: 'block' }}>
                            {densityData.map((d, i) => {
                              const bh = (d.setsPerMin / maxD) * (h - 4);
                              const color = d.setsPerMin >= 0.25 ? '#22c55e' : d.setsPerMin >= 0.15 ? '#f59e0b' : '#ef4444';
                              return <rect key={i} x={(i / densityData.length) * ww + 2} y={h - bh - 2} width={Math.max(2, ww / densityData.length - 4)} height={bh} rx={2} fill={color} opacity={0.6} />;
                            })}
                          </svg>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                            <span>{densityData[0]?.date}</span>
                            <span>{densityData[densityData.length - 1]?.date}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9 }}>
                            <span style={{ color: '#22c55e' }}>🟢 ≥0.25 (высокая)</span>
                            <span style={{ color: '#f59e0b' }}>🟡 0.15-0.25</span>
                            <span style={{ color: '#ef4444' }}>🔴 &lt;0.15 (много отдыха)</span>
                          </div>
                          {densityData.length >= 2 && (() => {
                            const last = densityData[densityData.length - 1];
                            const first = densityData[0];
                            const trend = last.setsPerMin - first.setsPerMin;
                            return <div style={{ fontSize: 9, color: trend > 0 ? '#22c55e' : '#f59e0b', marginTop: 4 }}>Плотность: {last.setsPerMin} подход/мин ({trend >= 0 ? '+' : ''}{(trend).toFixed(2)} за период)</div>;
                          })()}
                        </div>
                      );
                    })()}
                    {/* Session duration forecast */}
                    {historyWorkouts.length >= 3 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const last10 = sorted.slice(-10);
                      const avgDuration = Math.round(last10.reduce((s: number, w: any) => s + (w.duration || 60), 0) / last10.length);
                      const avgExercises = Math.round(last10.reduce((s: number, w: any) => s + w.exercises.length, 0) / last10.length * 10) / 10;
                      const avgSets = Math.round(last10.reduce((s: number, w: any) => s + w.exercises.reduce((ss: number, e: any) => ss + (e.sets || []).length, 0), 0) / last10.length);
                      const predictByExercises = (n: number) => Math.round(avgDuration * n / avgExercises);
                      return (
                        <div style={style.card}>
                          <div style={style.label}>⏱ Прогноз времени</div>
                          <div style={{ fontSize: 9, color: '#fff', marginBottom: 4 }}>На основе последних {last10.length} тренировок (ср. {avgDuration} мин)</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, textAlign: 'center' }}>
                            {[4, 6, 8].map(n => (
                              <div key={n} style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.03)' }}>
                                <div style={{ fontSize: 9, color: '#fff' }}>{n} упр.</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{predictByExercises(n)}<span style={{ fontSize: 10, fontWeight: 400 }}> мин</span></div>
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize: 9, color: '#fff', marginTop: 4, textAlign: 'center' }}>Ср. {avgSets} подходов / {avgExercises} упр. / {avgDuration} мин</div>
                        </div>
                      );
                    })()}
                    {/* Session quality score trend */}
                    {historyWorkouts.length >= 4 && (() => {
                      const sorted = [...historyWorkouts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const last12 = sorted.slice(-12);
                      const scores = last12.map(w => {
                        const sets = w.exercises.reduce((s: number, e: any) => s + (e.sets || []).length, 0);
                        const dur = w.duration || 60;
                        const rpeArr: number[] = [];
                        w.exercises.forEach((e: any) => e.sets.forEach((st: any) => { if (st.rpe) rpeArr.push(st.rpe); }));
                        const avgRPE = rpeArr.length > 0 ? rpeArr.reduce((s, v) => s + v, 0) / rpeArr.length : 7;
                        const completion = dur > 0 ? Math.min(1, sets / dur * 1.5) : 0.5;
                        const quality = Math.round((completion * 40 + Math.min(avgRPE / 10, 1) * 30 + Math.min(sets / 30, 1) * 30) * 10);
                        return { date: w.date.slice(5, 10), score: Math.min(100, quality) };
                      });
                      const maxS = 100;
                      const h = 40; const ww = 280;
                      return (
                        <div style={style.card}>
                          <div style={style.label}>📊 Качество сессий</div>
                          <svg width="100%" viewBox={`0 0 ${ww} ${h}`} style={{ display: 'block' }}>
                            <polyline points={scores.map((s, i) => `${(i / Math.max(scores.length - 1, 1)) * ww},${h - (s.score / maxS) * (h - 6) - 3}`).join(' ')} fill="none" stroke="#a855f7" strokeWidth={2} strokeLinejoin="round" />
                            {scores.map((s, i) => <circle key={i} cx={(i / Math.max(scores.length - 1, 1)) * ww} cy={h - (s.score / maxS) * (h - 6) - 3} r={2} fill={s.score >= 70 ? '#22c55e' : s.score >= 50 ? '#f59e0b' : '#ef4444'} />)}
                          </svg>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                            <span>{scores[0]?.date}</span>
                            <span>{scores[scores.length - 1]?.date}</span>
                          </div>
                          {scores.length >= 2 && (() => {
                            const last = scores[scores.length - 1];
                            const first = scores[0];
                            const trend = last.score - first.score;
                            return <div style={{ fontSize: 9, color: last.score >= 70 ? '#22c55e' : last.score >= 50 ? '#f59e0b' : '#ef4444', marginTop: 4 }}>Последняя сессия: {last.score}/100 ({trend >= 0 ? '+' : ''}{trend} за период)</div>;
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>
          ) : (
            <DiaryEmptyState
              icon="📊"
              title={historyWorkouts.length === 0 ? 'Дневник пуст' : 'Недостаточно данных'}
              description={historyWorkouts.length === 0
                ? 'Запишите первую тренировку, чтобы увидеть объём, интенсивность и усталость.'
                : 'Нужно минимум 2 тренировки для расчёта аналитики.'}
              onRecord={historyWorkouts.length === 0 ? () => { setMode('record'); onGoRecord?.(); } : undefined}
              onRefresh={onRefresh}
            />
          )}
        </div>
  );
};
