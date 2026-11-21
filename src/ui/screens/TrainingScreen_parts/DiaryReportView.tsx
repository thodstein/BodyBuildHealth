/**
 * DiaryReportView.tsx — режим «Отчёт» дневника тренировок.
 *
 * Пользователь выбирает охват (одна тренировка / несколько / неделя / месяц /
 * всё время) и отмечает чекбоксами, какие блоки показать (или «Показать всё»).
 * Данные считает workout-summary.engine — тот же движок, что и «Итог» после
 * проведения тренировки, поэтому цифры совпадают везде.
 */
import React from 'react';
import { localIsoDate } from '../../../core/local-date';
import type { WorkoutLog } from '../../../core/types';
import {
  buildWorkoutSummary,
  buildWorkoutReportText,
  buildSetDetails,
  compareWeekPlanVsActual,
  compareWorkoutSummaries,
  filterWorkoutsByRange,
  monthRange,
  weekRangeFor,
  type WeekPlanDayInput,
} from '../../../engines/workout-summary.engine';
import { WorkoutSummaryReport } from './WorkoutSummaryReport';
import { EditorPopupSelect } from './EditorPopup';
import { diaryStyles as style, ACCENT } from './diary-tokens';
import type { DiaryHubCtx } from './diary-hub-context';

type Scope = 'session' | 'multi' | 'week' | 'month' | 'all';

const SCOPES: { id: Scope; label: string; hint: string }[] = [
  { id: 'session', label: '🧾 Тренировка', hint: 'одна сессия' },
  { id: 'multi', label: '☑️ Несколько', hint: 'выбрать вручную' },
  { id: 'week', label: '📅 Неделя', hint: 'пн–вс' },
  { id: 'month', label: '🗓 Месяц', hint: 'календарный' },
  { id: 'all', label: '♾ Всё время', hint: 'вся история' },
];

const fmtDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};
const fmtInt = (n: number) => Math.round(n || 0).toLocaleString('ru-RU');
const fmtTon = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)} т` : `${fmtInt(kg)} кг`);

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function workoutLabel(w: WorkoutLog): string {
  const exs = Array.isArray(w.exercises) ? w.exercises : [];
  return `${fmtDay(String(w.date || ''))} · ${w.split || 'Тренировка'} · ${fmtTon(exs.reduce((s, e) => s + (Number(e?.totalVolume) || 0), 0))}`;
}

export const DiaryReportView: React.FC<{ hub: DiaryHubCtx }> = ({ hub }) => {
  const workouts = React.useMemo<WorkoutLog[]>(
    () => (Array.isArray(hub.historyWorkouts) ? hub.historyWorkouts.slice() : [])
      .filter(Boolean)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [hub.historyWorkouts],
  );
  const today = localIsoDate();
  const [scope, setScope] = React.useState<Scope>('session');
  const [sessionId, setSessionId] = React.useState<string>(workouts[0]?.id || '');
  const [pickedIds, setPickedIds] = React.useState<string[]>([]);
  const [pickQuery, setPickQuery] = React.useState('');
  const [weekKey, setWeekKey] = React.useState<string>(() => weekRangeFor(today).from);
  const [monthKey, setMonthKey] = React.useState<string>(() => today.slice(0, 7));
  const [copyDone, setCopyDone] = React.useState(false);

  // Держим выбор сессии валидным при обновлении истории.
  React.useEffect(() => {
    if (workouts.length === 0) { setSessionId(''); return; }
    if (!workouts.some(w => w.id === sessionId)) setSessionId(workouts[0].id);
  }, [workouts, sessionId]);

  const weeks = React.useMemo(() => {
    const map = new Map<string, string>();
    map.set(weekRangeFor(today).from, weekRangeFor(today).label);
    for (const w of workouts) {
      const r = weekRangeFor(String(w.date || ''));
      if (r.from) map.set(r.from, r.label);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [workouts, today]);

  const months = React.useMemo(() => {
    const set = new Set<string>([today.slice(0, 7)]);
    for (const w of workouts) {
      const ym = String(w.date || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) set.add(ym);
    }
    return Array.from(set).sort().reverse();
  }, [workouts, today]);

  const range = React.useMemo(() => {
    if (scope === 'week') return weekRangeFor(weekKey || today);
    if (scope === 'month') return monthRange(monthKey);
    return { from: '', to: '', label: '' };
  }, [scope, weekKey, monthKey, today]);

  const selected = React.useMemo<WorkoutLog[]>(() => {
    switch (scope) {
      case 'session':
        return workouts.filter(w => w.id === sessionId);
      case 'multi':
        return workouts.filter(w => pickedIds.includes(w.id));
      case 'week':
      case 'month':
        return filterWorkoutsByRange(workouts, range.from, range.to);
      case 'all':
      default:
        return workouts;
    }
  }, [scope, workouts, sessionId, pickedIds, range]);

  const summary = React.useMemo(() => buildWorkoutSummary(selected), [selected]);

  /**
   * План микроцикла есть только для текущей недели — его генерирует экран ББ.
   * Для других недель сверять нечего, поэтому блок молчит, а не показывает
   * чужой план как «недобор».
   */
  const weekPlan = React.useMemo<WeekPlanDayInput[] | null>(() => {
    const plan = hub.trainingOutput?.plan;
    if (scope !== 'week' || !Array.isArray(plan) || plan.length === 0) return null;
    const thisWeek = weekRangeFor(today).from;
    if ((weekKey || thisWeek) !== thisWeek) return null;
    const days: WeekPlanDayInput[] = [];
    for (const d of plan) {
      if (!d) continue;
      const exercises = (Array.isArray(d.exercises) ? d.exercises : [])
        .map(e => ({
          name: e?.name,
          exerciseId: e?.id,
          muscleGroup: (e as any)?.targetMuscle || e?.group,
          targetSets: Math.max(0, Math.round(Number(e?.sets) || 0)),
        }))
        .filter(e => e.targetSets > 0);
      if (exercises.length > 0) days.push({ label: d.name, exercises });
    }
    return days.length > 0 ? days : null;
  }, [hub.trainingOutput, scope, weekKey, today]);

  const previousWorkouts = React.useMemo<WorkoutLog[]>(() => {
    if (selected.length === 0) return [];
    if (scope === 'session') {
      const idx = workouts.findIndex(w => w.id === selected[0]?.id);
      const prev = idx >= 0 ? workouts[idx + 1] : null;
      return prev ? [prev] : [];
    }
    if (scope === 'week' && range.from) {
      return filterWorkoutsByRange(workouts, shiftIso(range.from, -7), shiftIso(range.to, -7));
    }
    if (scope === 'month' && range.from) {
      const d = new Date(`${range.from}T00:00:00`);
      d.setMonth(d.getMonth() - 1);
      const prevYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const r = monthRange(prevYm);
      return filterWorkoutsByRange(workouts, r.from, r.to);
    }
    if (scope === 'multi' && pickedIds.length > 0) {
      // предыдущие N тренировок до самой ранней выбранной
      const dates = selected.map(w => String(w.date || '').slice(0, 10)).sort();
      const earliest = dates[0];
      return workouts
        .filter(w => String(w.date || '').slice(0, 10) < earliest)
        .slice(0, Math.max(1, selected.length));
    }
    return [];
  }, [scope, workouts, selected, pickedIds.length, range]);

  const previousLabel = scope === 'session'
    ? 'прошлой тренировкой'
    : scope === 'week'
      ? 'прошлой неделей'
      : scope === 'month'
        ? 'прошлым месяцем'
        : 'предыдущими тренировками';

  /**
   * База для рекордов — вся история старше периода. Без неё одиночная
   * тренировка не знает прошлых e1RM и блок «Рекорды» всегда пустой.
   */
  const baselineWorkouts = React.useMemo<WorkoutLog[]>(() => {
    if (selected.length === 0 || scope === 'all') return [];
    const dates = selected.map(w => String(w.date || '').slice(0, 10)).filter(Boolean).sort();
    if (dates.length === 0) return [];
    const earliest = dates[0];
    const ids = new Set(selected.map(w => w.id));
    return workouts.filter(w => !ids.has(w.id) && String(w.date || '').slice(0, 10) < earliest);
  }, [scope, workouts, selected]);

  const visiblePickerWorkouts = React.useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    const base = q
      ? workouts.filter(w => {
          const exs = Array.isArray(w.exercises) ? w.exercises : [];
          const hay = `${w.split || ''} ${w.date || ''} ${exs.map(e => e?.exerciseName || (e as any)?.name || '').join(' ')}`.toLowerCase();
          return hay.includes(q);
        })
      : workouts;
    return base.slice(0, 80);
  }, [workouts, pickQuery]);

  const copyReport = () => {
    // Сборка текста живёт в движке: дневник и «Итог» плеера копируют одно и то же.
    const cmp = previousWorkouts.length > 0
      ? compareWorkoutSummaries(summary, buildWorkoutSummary(previousWorkouts))
      : null;
    const text = buildWorkoutReportText(summary, {
      level: hub.level,
      comparison: cmp,
      comparisonLabel: previousLabel,
      details: summary.workouts <= 3 ? buildSetDetails(selected) : null,
      weekPlan: weekPlan ? compareWeekPlanVsActual(weekPlan, selected) : null,
    });
    void navigator.clipboard?.writeText(text).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 1800);
    }).catch(() => {});
  };

  const chip = (active: boolean): React.CSSProperties => ({
    flex: '1 1 90px', padding: '7px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 10, fontWeight: 800,
    border: active ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.08)',
    background: active ? 'rgba(34,211,238,0.16)' : 'rgba(255,255,255,0.04)',
    color: active ? '#22d3ee' : '#fff',
  });

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '9px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 11, boxSizing: 'border-box',
  };
  // Кнопка попап-селекта на всю ширину: длинные подписи тренировок обрезаем.
  const FULL_BTN: React.CSSProperties = {
    width: '100%', textAlign: 'left', justifyContent: 'flex-start',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };

  return (
    <div className="train-diaryreport" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => hub.setMode('record')} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff' }}>← В запись</button>
        <span style={{ fontSize: 10, color: '#fff' }}>Сводный отчёт: тренировка · несколько · неделя · месяц · всё</span>
        <button onClick={copyReport} disabled={summary.workouts === 0}
          style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 999, fontSize: 10, fontWeight: 800, cursor: summary.workouts ? 'pointer' : 'default', border: '1px solid rgba(0,230,138,0.35)', background: 'rgba(0,230,138,0.12)', color: ACCENT, opacity: summary.workouts ? 1 : 0.5 }}>
          {copyDone ? '✓ Скопировано' : '📋 Копировать отчёт'}
        </button>
      </div>

      {/* Охват */}
      <div style={{ ...style.card, padding: 10 }}>
        <div style={{ ...style.label, marginBottom: 6 }}>Охват отчёта</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {SCOPES.map(s => (
            <button key={s.id} onClick={() => setScope(s.id)} title={s.hint} style={chip(scope === s.id)}>
              {s.label}
            </button>
          ))}
        </div>

        {scope === 'session' && (
          workouts.length === 0
            ? <div style={{ fontSize: 11, color: '#fff', opacity: 0.8 }}>Тренировок пока нет — запишите первую.</div>
            : <EditorPopupSelect
                value={sessionId}
                onChange={setSessionId}
                title="Выберите тренировку"
                ariaLabel="Тренировка для отчёта"
                options={workouts.slice(0, 200).map(w => ({ id: w.id, label: workoutLabel(w) }))}
                buttonStyle={FULL_BTN}
              />
        )}

        {scope === 'multi' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={pickQuery} onChange={e => setPickQuery(e.target.value)} placeholder="Поиск по тренировке / упражнению"
                style={{ ...selectStyle, flex: '1 1 150px' }} />
              <button onClick={() => setPickedIds(visiblePickerWorkouts.map(w => w.id))} style={{ padding: '6px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>Все видимые</button>
              <button onClick={() => setPickedIds([])} style={{ padding: '6px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>Снять</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
              {visiblePickerWorkouts.map(w => {
                const on = pickedIds.includes(w.id);
                return (
                  <button key={w.id} onClick={() => setPickedIds(on ? pickedIds.filter(x => x !== w.id) : [...pickedIds, w.id])}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      border: on ? '1px solid rgba(0,230,138,0.45)' : '1px solid rgba(255,255,255,0.07)',
                      background: on ? 'rgba(0,230,138,0.10)' : 'rgba(255,255,255,0.02)', color: '#fff', fontSize: 10,
                    }}>
                    <span style={{ width: 13, height: 13, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: on ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.3)', background: on ? ACCENT : 'transparent', color: '#000', fontSize: 9 }}>{on ? '✓' : ''}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workoutLabel(w)}</span>
                  </button>
                );
              })}
              {visiblePickerWorkouts.length === 0 && <div style={{ fontSize: 10, color: '#fff', opacity: 0.7 }}>Ничего не найдено.</div>}
            </div>
            <div style={{ fontSize: 9, color: '#fff', opacity: 0.75 }}>Выбрано: {pickedIds.length}</div>
          </div>
        )}

        {scope === 'week' && (
          <EditorPopupSelect
            value={weekKey}
            onChange={setWeekKey}
            title="Неделя (пн–вс)"
            ariaLabel="Неделя для отчёта"
            options={weeks.map(([key, label]) => ({ id: key, label }))}
            buttonStyle={FULL_BTN}
          />
        )}

        {scope === 'month' && (
          <EditorPopupSelect
            value={monthKey}
            onChange={setMonthKey}
            title="Месяц"
            ariaLabel="Месяц для отчёта"
            options={months.map(ym => ({ id: ym, label: monthRange(ym).label }))}
            buttonStyle={FULL_BTN}
          />
        )}

        {scope === 'all' && (
          <div style={{ fontSize: 10, color: '#fff', opacity: 0.8 }}>
            Вся история: {workouts.length} тренировок
          </div>
        )}
      </div>

      <WorkoutSummaryReport
        workouts={selected}
        title="Сводный отчёт"
        storageKey="he_workout_report_blocks"
        level={hub.level}
        previousWorkouts={previousWorkouts}
        previousLabel={previousLabel}
        baselineWorkouts={baselineWorkouts}
        weekPlan={weekPlan}
      />
    </div>
  );
};

export default DiaryReportView;
