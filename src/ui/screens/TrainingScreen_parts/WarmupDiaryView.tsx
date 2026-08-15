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
import React, { useMemo, useState } from 'react';
import { ACCENT, DIM, diaryCard } from './diary-tokens';
import { MiniLineChart } from './DiaryChart';
import { WarmupCheckinInline } from '../SRCBBScreen_parts/WarmupSessionPanel';
import {
  loadWarmupLog, warmupAdherence, warmupQualityTrend, buildWarmupInsights,
  exportWarmupCheckinsCSV,
} from '../../../engines/warmup.engine';

const CARD = diaryCard;
const WARMUP_COLOR = '#f97316';

export const WarmupDiaryView: React.FC = () => {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  const log = useMemo(() => loadWarmupLog(), [tick]);
  const adherence = useMemo(() => warmupAdherence(30), [tick]);
  const quality = useMemo(() => warmupQualityTrend(30), [tick]);
  const insights = useMemo(() => buildWarmupInsights(), [tick]);

  const skipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    log.slice(-30).forEach(e => { if (e.skippedReason) counts[e.skippedReason] = (counts[e.skippedReason] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [log]);

  const ghost: React.CSSProperties = { padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontSize: 10, minHeight: 36 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#fff' }}>
      {/* ── Заголовок ── */}
      <div style={{ ...CARD, border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: WARMUP_COLOR }}>🔥 Разминка</div>
          <span style={{ fontSize: 9, color: DIM }}>Приверженность и качество разминки — из дневника и сессий</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
          Разминочные пирамиды генерируются автоматически (единый канон: гриф 20кг×15 → 50%×10 → 70%×5 → 80%×3 → 90%×1).
          Здесь — только факт: выполнена ли разминка, качество 1-5, причины пропуска. Вкладка только отображает — план не меняется.
        </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-secondary)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: DIM }}>Записей</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: WARMUP_COLOR }}>{adherence.total}</div>
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
          <div key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, padding: '6px 8px', borderRadius: 8, background: 'rgba(249,115,22,0.04)', borderLeft: '2px solid rgba(249,115,22,0.4)', marginBottom: 4 }}>
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
