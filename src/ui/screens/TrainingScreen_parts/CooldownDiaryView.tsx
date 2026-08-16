/**
 * CooldownDiaryView.tsx — вкладка «❄️ Заминка» дневника тренировок.
 *
 * Дневник заминки (he_cooldown_diary): чек-ин на сегодня, приверженность 30д,
 * тренд качества, серия, причины пропуска, персональные инсайты, лог записей,
 * печатный отчёт и экспорт CSV. Факт заминки автоматически фиксируется в
 * SessionPlayer (завершение сессии) и вручную — в формах записи.
 *
 * Отображение-онли: вкладка НЕ влияет на планирование/авторегуляцию.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { DIM, diaryCard } from './diary-tokens';
import { MiniLineChart } from './DiaryChart';
import { CooldownCheckinInline } from '../SRCBBScreen_parts/CooldownSessionPanel';
import {
  loadCooldownLog, cooldownAdherence, cooldownQualityTrend, buildCooldownInsights,
  exportCooldownCheckinsCSV, cooldownStreak, correlateCooldownWithReadiness,
} from '../../../engines/cooldown.engine';
import { loadReadinessHistory } from './readiness-history';
import { collectGroupCooldown } from '../../../engines/cooldown-day.engine';
import { groupsFromExercises, prepGroupLabels } from '../../../engines/warmup-day.engine';
import { cooldownLabel } from '../../../engines/cooldown.engine';

const CARD = diaryCard;
const COOLDOWN_COLOR = '#38bdf8';

export const CooldownDiaryView: React.FC<{ planDay?: { name?: string; exercises?: { name?: string; muscleGroup?: string }[] } | null }> = ({ planDay }) => {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  const log = useMemo(() => loadCooldownLog(), [tick]);
  const adherence = useMemo(() => cooldownAdherence(30), [tick]);
  const quality = useMemo(() => cooldownQualityTrend(30), [tick]);
  const streak = useMemo(() => cooldownStreak(), [tick]);
  const insights = useMemo(() => buildCooldownInsights(), [tick]);

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
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Заминка — отчёт</title>
      <style>body{font-family:system-ui;padding:24px;color:#111}table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f5f5f5}h1{font-size:18px}h2{font-size:14px;margin-top:20px}
      .stats{display:flex;gap:20px;font-size:13px;margin:8px 0;flex-wrap:wrap}</style></head><body>
      <h1>❄️ Заминка — отчёт</h1>
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

  const ghost: React.CSSProperties = { padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontSize: 10, minHeight: 36 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#fff' }}>
      {/* ── Заголовок ── */}
      <div style={{ ...CARD, border: '1px solid rgba(56,189,248,0.2)', background: 'rgba(56,189,248,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: COOLDOWN_COLOR }}>❄️ Заминка</div>
          <span style={{ fontSize: 9, color: DIM }}>Приверженность и качество заминки — из дневника и сессий</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
          Заминка генерируется автоматически (дыхание + растяжка рабочих зон дня, + восстановление при усталости).
          Здесь — только факт: выполнена ли заминка, качество 1-5, причины пропуска. Вкладка только отображает — план не меняется.
        </div>
      </div>

      {/* ── Предпросмотр: заминка по плану на сегодня ── */}
      <div style={CARD}>
        <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
          🧭 Заминка по плану на сегодня
        </div>
        {!planDay || !Array.isArray(planDay.exercises) || planDay.exercises.length === 0 ? (
          <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
            Нет плана на сегодня — заминка сгенерируется автоматически при завершении сессии (дыхание + растяжка рабочих зон).
          </div>
        ) : (() => {
          const groups = groupsFromExercises(planDay.exercises);
          if (groups.length === 0) {
            return <div style={{ fontSize: 10, color: DIM }}>Не удалось определить группы дня — заминка будет по упражнениям сессии.</div>;
          }
          const stretch = collectGroupCooldown(groups);
          return (
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>
                🎯 {planDay.name || 'Тренировка'} · рабочие зоны: <b style={{ color: '#fff' }}>{prepGroupLabels(groups)}</b>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {stretch.slice(0, 6).map(s => (
                  <span key={s.id} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(56,189,248,0.1)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(56,189,248,0.25)' }}>
                    {cooldownLabel(s.id)}{s.note ? ` — ${s.note}` : ''}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 8, color: 'var(--text-faint)', marginTop: 4 }}>Полный план с чекбоксами — при завершении сессии (фаза «Заминка»).</div>
            </div>
          );
        })()}
      </div>

      {/* ── Чек-ин на сегодня ── */}
      <div style={CARD}>
        <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>
          Сегодня
        </div>
        <CooldownCheckinInline date={new Date().toISOString().slice(0, 10)} onSaved={refresh} />
      </div>

      {/* ── Сводка 30 дней ── */}
      <div style={CARD}>
        <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>
          Сводка · 30 дней
        </div>
        {log.length === 0 ? (
          <div style={{ fontSize: 10, color: DIM, lineHeight: 1.5 }}>
            Пока нет записей. Отметьте заминку после тренировки (в форме записи или прямо здесь) — появятся приверженность и тренд качества.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 6 }}>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: DIM }}>Записей</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: COOLDOWN_COLOR }}>{adherence.total}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: DIM }}>Приверженность</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: adherence.pct >= 80 ? '#22c55e' : adherence.pct >= 50 ? '#f59e0b' : '#ef4444' }}>
                  {adherence.total > 0 ? `${adherence.pct}%` : '—'}
                </div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: DIM }}>Ср. качество</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>{quality.count > 0 ? quality.avg.toFixed(1) : '—'}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: DIM }}>Выполнено дней</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#00e68a' }}>{adherence.done}</div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: DIM }}>Серия</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: streak >= 3 ? '#22c55e' : streak > 0 ? '#f59e0b' : 'var(--text-dim)' }}>{streak > 0 ? `${streak} дн` : '—'}</div>
              </div>
            </div>
            {quality.count >= 2 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Тренд качества заминки</div>
                <MiniLineChart
                  data={quality.series.map(s => s.quality)}
                  labels={quality.series.map(s => s.date.slice(5))}
                  color={COOLDOWN_COLOR}
                  height={50}
                  ySuffix="/5"
                />
              </div>
            )}
            {skipCounts.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: DIM, marginBottom: 4 }}>Причины пропуска:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {skipCounts.map(([reason, n]) => (
                    <span key={reason} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(239,68,68,0.25)' }}>
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
          <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, padding: '6px 8px', borderRadius: 8, background: 'rgba(56,189,248,0.04)', borderLeft: '2px solid rgba(56,189,248,0.4)', marginBottom: 4 }}>
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
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, padding: '5px 8px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
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

      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2 }} onClick={refresh} aria-label="Обновить данные">🔄 Обновить данные</button>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2, border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }} onClick={printReport} aria-label="Печать отчёта заминки">🖨 Отчёт</button>
        <button type="button" style={{ ...ghost, flex: 1, marginTop: 2, border: '1px solid rgba(56,189,248,0.3)', color: COOLDOWN_COLOR }} aria-label="Скачать CSV дневника заминки"
          onClick={() => {
            try {
              const csv = exportCooldownCheckinsCSV();
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `cooldown_checks_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            } catch { /* ignore */ }
          }}>⬇ CSV</button>
      </div>
    </div>
  );
};

export default CooldownDiaryView;
