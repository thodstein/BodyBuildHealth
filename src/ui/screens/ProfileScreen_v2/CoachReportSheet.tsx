/**
 * CoachReportSheet — отчёт по атлету за период внутри профиля.
 *
 * Открывается по кнопке и НЕ читает базу заранее: тренер может годами не
 * открывать отчёты, а карточки должны рисоваться быстро. Здесь — ленивый
 * `loadDb()` и чтение только при открытии.
 *
 * Наружу (в файл/печать/буфер) уходит то же, что видно на экране: текст и HTML
 * из `coach-report.engine`. Никаких «красивых» оценок формы и прогнозов.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { NativeIcon } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';
import { loadDb } from '../../../core/lazy-db';
import { toPhysicalKey } from '../../../core/data-space';
import {
  buildCoachReport,
  buildCoachReportHtml,
  buildCoachReportText,
  readReportSessions,
  type ReportSession,
} from '../../../engines/coach/coach-report.engine';
import { localIsoDate, shiftIsoDate } from '../../../core/local-date';
import type { CoachAthlete } from '../../../engines/coach/coach-mode.engine';
import type { CoachNote } from '../../../engines/coach/coach-notes.engine';
import type { CoachLogEntry } from '../../../engines/coach/coach-athlete-log.engine';

const ACCENT = '#22d3ee';

type PeriodKind = 'week' | 'month';

interface CoachReportSheetProps {
  athlete: CoachAthlete;
  spaceId: string;
  notes: readonly CoachNote[];
  coachLog: readonly CoachLogEntry[];
  adherenceLine?: string | null;
  onClose: () => void;
}

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: 14,
};

const btn = (kind: 'primary' | 'ghost'): React.CSSProperties => ({
  appearance: 'none',
  border: kind === 'primary' ? 'none' : '1px solid rgba(255,255,255,0.14)',
  background: kind === 'primary' ? ACCENT : 'rgba(255,255,255,0.05)',
  color: kind === 'primary' ? '#04222a' : '#fff',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
});

function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readWeights(spaceId: string): { date: string; kg: number }[] {
  const storage = ls();
  if (!storage) return [];
  let raw: string | null = null;
  try {
    raw = storage.getItem(toPhysicalKey(spaceId, 'he_weight_log'));
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: { date: string; kg: number }[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const date = typeof r.date === 'string' ? r.date.slice(0, 10) : '';
      const kg = typeof r.weight === 'number' ? r.weight : Number(r.weight);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(kg) || kg <= 0) continue;
      out.push({ date, kg });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

function periodFor(kind: PeriodKind, today: string): { from: string; to: string; label: string } {
  if (kind === 'week') {
    const d = new Date(`${today}T00:00:00`);
    const offset = (d.getDay() + 6) % 7;
    const from = shiftIsoDate(today, -offset);
    const to = shiftIsoDate(from, 6);
    return {
      from,
      to,
      label: `неделя ${from.slice(8, 10)}.${from.slice(5, 7)}–${to.slice(8, 10)}.${to.slice(5, 7)}`,
    };
  }
  const from = shiftIsoDate(today, -29);
  return {
    from,
    to: today,
    label: `30 дней ${from.slice(8, 10)}.${from.slice(5, 7)}–${today.slice(8, 10)}.${today.slice(5, 7)}`,
  };
}

export function CoachReportSheet({
  athlete,
  spaceId,
  notes,
  coachLog,
  adherenceLine,
  onClose,
}: CoachReportSheetProps) {
  const [kind, setKind] = useState<PeriodKind>('week');
  const [sessions, setSessions] = useState<ReportSession[] | null>(null);
  const [weights, setWeights] = useState<{ date: string; kg: number }[]>([]);
  const [busy, setBusy] = useState(true);
  const [outcome, setOutcome] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void (async () => {
      let next: ReportSession[] = [];
      try {
        const mod = await loadDb();
        const stores = await mod.readSpaceStores(spaceId);
        next = readReportSessions(stores as Record<string, unknown[]>);
      } catch {
        next = [];
      }
      if (cancelled) return;
      setSessions(next);
      setWeights(readWeights(spaceId));
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const today = localIsoDate();
  const period = useMemo(() => periodFor(kind, today), [kind, today]);

  const report = useMemo(
    () =>
      buildCoachReport({
        athlete: {
          name: athlete.name,
          direction: athlete.direction,
          goal: athlete.goal,
          group: athlete.group,
          startedAt: athlete.startedAt,
        },
        period,
        sessions: sessions ?? [],
        weights,
        coachLog: coachLog as CoachLogEntry[],
        notes: notes.map(n => ({ createdAt: n.createdAt, title: n.title, body: n.body })),
        adherenceLine,
        generatedAt: today,
      }),
    [athlete, period, sessions, weights, coachLog, notes, adherenceLine, today],
  );

  const text = useMemo(() => buildCoachReportText(report), [report]);
  const html = useMemo(() => buildCoachReportHtml(report), [report]);
  const fileBase = `${athlete.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}_${period.from}_${period.to}`;

  const share = async (action: 'print' | 'save' | 'copy') => {
    setOutcome(null);
    try {
      const mod = await import('../../../core/apk-share');
      if (action === 'print') {
        const res = await mod.printHtmlApk(html, `${fileBase}.html`, text);
        setOutcome(mod.shareOutcomeLabel(res));
      } else if (action === 'save') {
        const res = await mod.saveTextFileApk(`${fileBase}.html`, html, 'text/html;charset=utf-8');
        setOutcome(mod.shareOutcomeLabel(res));
      } else {
        const res = await mod.copyOrShareText(text, `Отчёт: ${athlete.name}`);
        setOutcome(mod.shareOutcomeLabel(res));
      }
    } catch {
      setOutcome('Не удалось поделиться — текст отчёта остаётся на экране.');
    }
  };

  return (
    <div data-coach="report" style={{ ...cardStyle, marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true" style={{ display: 'inline-flex', color: ACCENT }}>
              <NativeIcon name="activity" size={14} />
            </span>
            Отчёт: {athlete.name}
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted }}>{period.label}</div>
        </div>
        <button type="button" data-coach="report-close" onClick={onClose} style={{ ...btn('ghost'), fontSize: 11.5 }}>
          Закрыть
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {(['week', 'month'] as const).map(k => (
          <button
            key={k}
            type="button"
            data-coach={`report-period-${k}`}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            style={{
              ...btn(kind === k ? 'primary' : 'ghost'),
              fontSize: 11.5,
              padding: '6px 10px',
            }}
          >
            {k === 'week' ? 'Неделя' : '30 дней'}
          </button>
        ))}
      </div>

      {busy ? (
        <div data-coach="report-loading" style={{ marginTop: 10, fontSize: 11.5, color: colors.textMuted }}>
          считаем по дневнику атлета…
        </div>
      ) : (
        <>
          <pre
            data-coach="report-text"
            style={{
              marginTop: 10,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 11,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.86)',
              background: 'rgba(0,0,0,0.22)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: 10,
              maxHeight: 260,
              overflow: 'auto',
              fontFamily: 'inherit',
            }}
          >
            {text}
          </pre>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" data-coach="report-print" onClick={() => void share('print')} style={{ ...btn('primary'), fontSize: 11.5 }}>
              Печать / PDF
            </button>
            <button type="button" data-coach="report-save" onClick={() => void share('save')} style={{ ...btn('ghost'), fontSize: 11.5 }}>
              Сохранить HTML
            </button>
            <button type="button" data-coach="report-copy" onClick={() => void share('copy')} style={{ ...btn('ghost'), fontSize: 11.5 }}>
              Копировать текст
            </button>
          </div>
          {outcome && (
            <div data-coach="report-outcome" style={{ marginTop: 6, fontSize: 11, color: colors.textMuted }}>
              {outcome}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 10.5, color: colors.textSubtle, lineHeight: 1.45 }}>
            Максимумы — по записям в дневнике на этом устройстве, а не «настоящий ПМ».
          </div>
        </>
      )}
      <div
        aria-hidden="true"
        style={{ height: 1, background: withAlpha(ACCENT, '22'), marginTop: 10 }}
      />
    </div>
  );
}
