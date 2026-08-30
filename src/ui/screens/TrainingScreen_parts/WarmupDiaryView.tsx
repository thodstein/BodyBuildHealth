/**
 * WarmupDiaryView.tsx — вкладка «🔥 Разминка» дневника тренировок.
 *
 * Дневник разминки (he_warmup_diary): чек-ин на сегодня, приверженность 30д,
 * тренд качества, частые причины пропуска, персональные инсайты, лог записей,
 * экспорт CSV. Факт разминки автоматически фиксируется в SessionPlayer
 * (переход к основной части) и вручную — в формах записи (WarmupCheckinInline).
 *
 * Отображение-онли: вкладка НЕ влияет на планирование/авторегуляцию.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ACCENT, DIM, diaryCard } from './diary-tokens';
import { MiniLineChart, MiniBarChart } from './DiaryChart';
import { WarmupCheckinInline } from '../SRCBBScreen_parts/WarmupSessionPanel';
import {
  loadWarmupLog, warmupAdherence, warmupQualityTrend, buildWarmupInsights,
  exportWarmupCheckinsCSV, warmupStreak, correlateWarmupWithPerformance, warmupWeeklyAdherence,
} from '../../../engines/warmup.engine';
import { sessionsBestE1RM } from '../../../engines/mindset-protocol.engine';
import { collectGroupPrep, groupsFromExercises, prepGroupLabels } from '../../../engines/warmup-day.engine';
import { collectJointPrep, jointPrepLabels } from '../../../engines/warmup-joints.engine';
import { warmupLabel } from '../../../engines/warmup.engine';
import { WarmupRampCard } from './diary-cards';
import type { WorkoutLog } from '../../../core/types';

const CARD = diaryCard;
const WARMUP_COLOR = '#f97316';

export const WarmupDiaryView: React.FC<{ historyWorkouts?: WorkoutLog[]; planDay?: { name?: string; exercises?: { name?: string; muscleGroup?: string }[] } | null }> = ({ historyWorkouts, planDay }) => {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  const log = useMemo(() => loadWarmupLog(), [tick]);
  const adherence = useMemo(() => warmupAdherence(30), [tick]);
  const quality = useMemo(() => warmupQualityTrend(30), [tick]);
  const streak = useMemo(() => warmupStreak(), [tick]);
  const weekly = useMemo(() => warmupWeeklyAdherence(8), [tick]);
  const perfs = useMemo(() => sessionsBestE1RM((historyWorkouts || []) as any[]), [historyWorkouts]);
  const insights = useMemo(() => buildWarmupInsights(perfs), [tick, perfs]);
  const link = useMemo(() => correlateWarmupWithPerformance(perfs), [tick, perfs]);

  const skipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    log.slice(-30).forEach(e => { if (e.skippedReason) counts[e.skippedReason] = (counts[e.skippedReason] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [log]);

  // ── Печатный отчёт ──
  const printReport = useCallback(() => {
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const rows = [...log].reverse().slice(0, 60).map(e => `
      <tr>
        <td>${esc(e.date)}</td><td>${e.done ? 'да' : 'нет'}</td>
        <td>${e.quality === null ? '—' : e.quality}</td>
        <td>${e.doneItems === undefined || e.totalItems === undefined ? '—' : `${e.doneItems}/${e.totalItems}`}</td>
        <td>${esc(e.skippedReason || '')}</td>
        <td>${esc(e.note || '')}</td>
      </tr>`).join('');
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Разминка — отчёт</title>
      <style>body{font-family:system-ui;padding:24px;color:#111}table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f5f5f5}h1{font-size:18px}h2{font-size:14px;margin-top:20px}
      .stats{display:flex;gap:20px;font-size:13px;margin:8px 0;flex-wrap:wrap}</style></head><body>
      <h1>🔥 Разминка — отчёт</h1>
      <div style="color:#555;font-size:12px">Сформировано: ${new Date().toLocaleString('ru-RU')}</div>
      <div class="stats">
        <span>Записей (30д): <b>${adherence.total}</b></span>
        <span>Приверженность: <b>${adherence.total > 0 ? adherence.pct + '%' : '—'}</b></span>
        <span>Выполнено дней: <b>${adherence.done}</b></span>
        <span>Ср. качество: <b>${quality.count > 0 ? quality.avg.toFixed(1) + '/5' : '—'}</b></span>
      </div>
      ${skipCounts.length > 0 ? `<h2>Причины пропуска</h2><ul>${skipCounts.map(([r, n]) => `<li>${esc(r)} — ${n}×</li>`).join('')}</ul>` : ''}
      <h2>Инсайты</h2>
      <ul>${insights.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <h2>Записи (последние 60)</h2>
      <table><thead><tr><th>Дата</th><th>Выполнено</th><th>Качество</th><th>Пункты</th><th>Причина</th><th>Заметка</th></tr></thead><tbody>${rows}</tbody></table>
      <script>window.print();</script></body></html>`;
    try {
      const win = window.open('', '_blank', 'width=900,height=700');
      if (win) { win.document.write(html); win.document.close(); }
    } catch { /* SSR/блокировка — игнор */ }
  }, [log, adherence, quality, insights, skipCounts]);

  const ghost: React.CSSProperties = { padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: 10, minHeight: 36 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#fff' }}>
      {/* ── Заголовок ── */}
      <div style={{ ...CARD, border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: WARMUP_COLOR }}>🔥 Разминка</div>
          <span style={{ fontSize: 9, color: DIM }}>Приверженность и качество разминки — из дневника и сессий</span>
        </div>
        <div style={{ fontSize: 10, color: '#fff', marginTop: 6, lineHeight: 1.5 }}>
          Разминочные пирамиды генерируются автоматически (единый канон: гриф 20кг×15 → 50%×10 → 70%×5 → 80%×3 → 90%×1).
          Здесь — только факт: выполнена ли разминка, качество 1-5, причины пропуска. Вкладка только отображает — план не меняется.
        </div>
      </div>

      {/* ── Предпросмотр: разминка по плану на сегодня — красивая и персональная ── */}
      <div style={{ ...CARD, background: 'linear-gradient(135deg, rgba(249,115,22,0.07), rgba(167,139,250,0.05))', border: '1px solid rgba(249,115,22,0.18)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -12, right: -12, width: 72, height: 72, borderRadius: 72, background: 'radial-gradient(circle, rgba(249,115,22,0.14), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 10, color: '#fff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontSize: 11 }}>🧭</span> Разминка по плану на сегодня
          <span style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>персональная</span>
        </div>
        {!planDay || !Array.isArray(planDay.exercises) || planDay.exercises.length === 0 ? (
          <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
            Нет плана на сегодня — разминка сгенерируется автоматически при старте любой сессии (по упражнениям и оборудованию). Каждая группа получит суставы + зоны + активацию.
          </div>
        ) : (() => {
          const groups = groupsFromExercises(planDay.exercises);
          if (groups.length === 0) {
            return <div style={{ fontSize: 10, color: DIM }}>Не удалось определить группы дня — разминка будет по упражнениям сессии.</div>;
          }
          const joints = collectJointPrep(groups, 'standard');
          const prep = collectGroupPrep(groups, true, 'standard');
          const totalMob = joints.length + prep.mobility.length;
          const totalAct = prep.activation.length;
          return (
            <div>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <span>🎯 <b style={{ color: '#fff' }}>{planDay.name || 'Тренировка'}</b></span>
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(167,139,250,0.12)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.22)' }}>зоны: {prepGroupLabels(groups)}</span>
                <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>{groups.join(', ')}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#f59e0b', alignSelf: 'center', marginRight: 2 }}>🤸 Суставы:</span>
                {joints.slice(0, 7).map(j => (
                  <span key={j.id} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.10)', color: '#fff', border: '1px solid rgba(245,158,11,0.22)' }}>
                    {warmupLabel(j.id)}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#f59e0b', alignSelf: 'center', marginRight: 2 }}>🧩 Зоны:</span>
                {prep.mobility.slice(0, 5).map(m => (
                  <span key={m.id} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(6,182,214,0.08)', color: '#fff', border: '1px solid rgba(6,182,214,0.18)' }}>
                    {warmupLabel(m.id)}
                  </span>
                ))}
              </div>
              {prep.activation.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#22c55e', alignSelf: 'center', marginRight: 2 }}>⚡ Активация:</span>
                  {prep.activation.slice(0, 5).map(a => (
                    <span key={a.id} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(34,197,94,0.10)', color: '#fff', border: '1px solid rgba(34,197,94,0.22)' }}>
                      {warmupLabel(a.id)}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 9 }}>
                <span style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.07)' }}>суставов {joints.length} · зон {prep.mobility.length} · активаций {totalAct}</span>
                <span style={{ padding: '2px 7px', borderRadius: 20, background: 'rgba(249,115,22,0.10)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.22)' }}>~{Math.round((joints.length*30 + prep.mobility.length*30 + prep.activation.length*35)/60*10)/10} мин</span>
              </div>
              <div style={{ fontSize: 8, color: 'var(--text-faint)', marginTop: 6, lineHeight: 1.3 }}>Полный план с чекбоксами, таймером 30с и режимами Быстро/Стандарт/Полная — при старте сессии (фаза «Разминка»). Без ленты — bodyweight-замены уже включены.</div>
            </div>
          );
        })()}
      </div>

      {/* ── Чек-ин на сегодня ── */}
      <div style={CARD}>
        <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
          Сегодня
        </div>
        <WarmupCheckinInline date={new Date().toISOString().slice(0, 10)} onSaved={refresh} />
      </div>

      {/* ── Сводка 30 дней ── */}
      <div style={CARD}>
        <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
          Сводка · 30 дней
        </div>
        {log.length === 0 ? (
          <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
            Пока нет записей. Отметьте разминку после тренировки (в форме записи или прямо здесь) — появятся приверженность и тренд качества.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 6 }}>
              <div style={{ padding: '8px 8px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(251,146,60,0.06))', border: '1px solid rgba(249,115,22,0.18)', textAlign: 'center' }}>
                <div style={{ fontSize: 11 }}>📝</div><div style={{ fontSize: 8, color: DIM, marginTop: 1 }}>Записей</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: WARMUP_COLOR, marginTop: 2 }}>{adherence.total}</div>
              </div>
              <div style={{ padding: '8px 8px', borderRadius: 12, background: adherence.pct >= 80 ? 'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(16,185,129,0.07))' : adherence.pct >= 50 ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,146,60,0.06))' : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.06))', border: `1px solid ${adherence.pct >= 80 ? 'rgba(34,197,94,0.20)' : adherence.pct >= 50 ? 'rgba(245,158,11,0.20)' : 'rgba(239,68,68,0.18)'}`, textAlign: 'center' }}>
                <div style={{ fontSize: 11 }}>🎯</div><div style={{ fontSize: 8, color: DIM, marginTop: 1 }}>Приверж.</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: adherence.pct >= 80 ? '#22c55e' : adherence.pct >= 50 ? '#f59e0b' : '#ef4444', marginTop: 2 }}>
                  {adherence.total > 0 ? `${adherence.pct}%` : '—'}
                </div>
              </div>
              <div style={{ padding: '8px 8px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(139,92,246,0.06))', border: '1px solid rgba(167,139,250,0.18)', textAlign: 'center' }}>
                <div style={{ fontSize: 11 }}>⭐</div><div style={{ fontSize: 8, color: DIM, marginTop: 1 }}>Качество</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#a78bfa', marginTop: 2 }}>{quality.count > 0 ? quality.avg.toFixed(1) : '—'}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)' }}>/5</div>
              </div>
              <div style={{ padding: '8px 8px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,230,138,0.12), rgba(16,185,129,0.06))', border: '1px solid rgba(0,230,138,0.18)', textAlign: 'center' }}>
                <div style={{ fontSize: 11 }}>✅</div><div style={{ fontSize: 8, color: DIM, marginTop: 1 }}>Выполнено</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#00e68a', marginTop: 2 }}>{adherence.done}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)' }}>дней</div>
              </div>
              <div style={{ padding: '8px 8px', borderRadius: 12, background: streak >= 3 ? 'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(16,185,129,0.07))' : streak > 0 ? 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(251,146,60,0.06))' : 'rgba(255,255,255,0.03)', border: `1px solid ${streak >= 3 ? 'rgba(34,197,94,0.20)' : streak > 0 ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.06)'}`, textAlign: 'center' }}>
                <div style={{ fontSize: 11 }}>🔥</div><div style={{ fontSize: 8, color: DIM, marginTop: 1 }}>Серия</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: streak >= 3 ? '#22c55e' : streak > 0 ? '#f59e0b' : '#fff', marginTop: 2 }}>{streak > 0 ? `${streak}` : '—'}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.45)' }}>{streak > 0 ? 'дн' : ''}</div>
              </div>
            </div>
            {quality.count >= 2 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Тренд качества разминки</div>
                <MiniLineChart
                  data={quality.series.map(s => s.quality)}
                  labels={quality.series.map(s => s.date.slice(5))}
                  color={WARMUP_COLOR}
                  height={50}
                  ySuffix="/5"
                />
              </div>
            )}
            {weekly.filter(p => p.total > 0).length >= 2 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Приверженность по неделям</div>
                <MiniBarChart
                  data={weekly.map(p => ({
                    value: p.pct,
                    label: p.label,
                    color: p.total === 0 ? 'rgba(255,255,255,0.08)' : p.pct >= 80 ? '#22c55e' : p.pct >= 50 ? '#f59e0b' : '#ef4444',
                  }))}
                  height={60}
                  valueSuffix="%"
                />
              </div>
            )}
            {/* Тепловая карта 56 дней */}
            {(() => {
              const doneByDate = new Map(log.map(e => [e.date, e.done]));
              const today = new Date();
              const cells: { date: string; done: boolean | null }[] = [];
              for (let i = 55; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const iso = d.toISOString().slice(0, 10);
                const v = doneByDate.get(iso);
                cells.push({ date: iso, done: v === undefined ? null : v });
              }
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Тепловая карта 56 дней</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 3 }}>
                    {cells.map(c => (
                      <div key={c.date} title={`${c.date}: ${c.done === null ? 'нет записи' : c.done ? 'выполнена' : 'пропущена'}`}
                        style={{
                          aspectRatio: '1', borderRadius: 4,
                          background: c.done === true ? 'linear-gradient(135deg,#22c55e,#16a34a)' : c.done === false ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${c.done === true ? 'rgba(34,197,94,0.3)' : c.done === false ? 'rgba(239,68,68,0.24)' : 'rgba(255,255,255,0.06)'}`,
                        }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', marginTop: 3, display: 'flex', gap: 6 }}><span>■ выполнена</span><span>■ пропущена</span><span>■ нет данных</span></div>
                </div>
              );
            })()}
            {link.n >= 3 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Связь качества разминки и e1RM сессии (n={link.n}):</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {link.buckets.map(b => (
                    <div key={b.level} style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: DIM }}>{b.range}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: b.n > 0 ? '#fff' : DIM }}>{b.n > 0 ? `${b.avgE1RM} кг` : '—'}</div>
                      <div style={{ fontSize: 8, color: DIM }}>{b.n} сессий</div>
                    </div>
                  ))}
                </div>
                {link.pearson !== null && Math.abs(link.pearson) >= 0.3 && (
                  <div style={{ fontSize: 9, color: '#a78bfa', marginTop: 4 }}>r = {link.pearson} — {link.pearson > 0 ? 'качество разминки связано с силой дня' : 'обратная связь (сон/стресс?)'}</div>
                )}
              </div>
            )}
            {skipCounts.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Причины пропуска:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {skipCounts.map(([reason, n]) => (
                    <span key={reason} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#fff', border: '1px solid rgba(239,68,68,0.25)' }}>
                      {reason} · {n}×
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Инсайты ── */}
      <div style={CARD}>
        <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
          💡 Персональные инсайты
        </div>
        {insights.map((s, i) => (
          <div key={i} style={{ fontSize: 10, color: '#fff', lineHeight: 1.5, padding: '6px 8px', borderRadius: 8, background: 'rgba(249,115,22,0.04)', borderLeft: '2px solid rgba(249,115,22,0.4)', marginBottom: 4 }}>
            {s}
          </div>
        ))}
      </div>

      {/* ── Последние записи ── */}
      {log.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
            Последние записи ({log.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...log].reverse().slice(0, 10).map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, padding: '5px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                <span style={{ color: DIM, minWidth: 64 }}>{e.date.slice(5).replace('-', '.')}</span>
                <span style={{ fontWeight: 700, color: e.done ? '#22c55e' : '#ef4444' }}>{e.done ? '✓ выполнена' : '✕ пропущена'}</span>
                {e.quality !== null && <span style={{ color: '#a78bfa' }}>качество {e.quality}/5</span>}
                {e.doneItems !== undefined && e.totalItems !== undefined && e.totalItems > 0 && (
                  <span style={{ color: DIM }}>{e.doneItems}/{e.totalItems} пунктов</span>
                )}
                {!e.done && e.skippedReason && <span style={{ color: DIM }}>· {e.skippedReason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Калькулятор разминочной рампы ── */}
      <WarmupRampCard />

      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2 }} onClick={refresh} aria-label="Обновить данные">🔄 Обновить данные</button>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2, border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }} onClick={printReport} aria-label="Печать отчёта разминки">🖨 Отчёт</button>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2, border: '1px solid rgba(249,115,22,0.3)', color: WARMUP_COLOR }} aria-label="Скачать CSV дневника разминки"
          onClick={() => {
            try {
              const csv = exportWarmupCheckinsCSV();
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `warmup_checks_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            } catch { /* ignore */ }
          }}>⬇ CSV</button>
      </div>
    </div>
  );
};

export default WarmupDiaryView;
