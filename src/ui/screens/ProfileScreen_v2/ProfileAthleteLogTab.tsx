/**
 * ProfileAthleteLogTab — журнал атлета (записи подходов и веса тела).
 *
 * Зачем: карточка без результатов — просто список имён. Здесь тренер фиксирует
 * «присед 3×5×120, RPE 8» и вес тела по датам.
 *
 * Что показываем и почему только это:
 *  • тоннаж = Σ(подходы × повторы × вес) за 30 дней — чистая арифметика по введённому;
 *  • «лучший подход» = максимальный вес среди записанных (а не «расчётный максимум»);
 *  • вес тела: последний и дельта за 30 дней, и только если записей ≥ 2 (иначе
 *    «мало данных» — выдумывать тренд по одной точке нельзя);
 *  • нормативов, % от ПМ и прогнозов нет: в приложении нет справочника для
 *    произвольных упражнений, а придумывать числа — враньё.
 */
import React, { useMemo, useState } from 'react';
import { NativeIcon } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';
import { localIsoDate } from '../../../core/local-date';
import { readCoachState } from '../../../engines/coach/coach-mode.engine';
import {
  COACH_LOG_MAX,
  addCoachLogEntry,
  bestSetFor,
  bodyweightTrend,
  entriesForAthlete,
  exercisesForAthlete,
  logSummaryFor,
  readCoachLog,
  removeCoachLogEntry,
  writeCoachLog,
  type CoachLogStore,
} from '../../../engines/coach/coach-athlete-log.engine';

const VIOLET = '#a78bfa';

const ls = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13.5,
  color: '#fff',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  outline: 'none',
  boxSizing: 'border-box',
  width: '100%',
};

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: 14,
};

const btn = (tone: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
  minHeight: 44,
  padding: '8px 14px',
  borderRadius: 12,
  fontSize: 12.5,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  border:
    tone === 'primary'
      ? '1px solid transparent'
      : `1px solid ${tone === 'danger' ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.14)'}`,
  color: tone === 'primary' ? '#1b1033' : tone === 'danger' ? '#fca5a5' : 'rgba(255,255,255,0.82)',
  background:
    tone === 'primary'
      ? `linear-gradient(135deg, ${VIOLET}, #8b5cf6)`
      : tone === 'danger'
        ? 'rgba(239,68,68,0.14)'
        : 'rgba(255,255,255,0.05)',
});

const label = (text: string): React.CSSProperties => ({
  display: 'block',
  fontSize: 11.5,
  fontWeight: 700,
  color: colors.textMuted,
  marginBottom: 5,
});

const fmtKg = (n: number): string => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} кг`;

const fmtDate = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
};

const ERROR_TEXT: Record<string, string> = {
  athlete: 'Выберите атлета — запись без атлета бессмысленна.',
  date: 'Некорректная дата.',
  exercise: 'Укажите упражнение.',
  sets: 'Подходов должно быть от 1 до 50.',
  reps: 'Повторов должно быть от 1 до 100.',
  weight: 'Вес должен быть больше нуля (для веса тела — в пределах 0.5…600 кг).',
  limit: `Лимит ${COACH_LOG_MAX} записей. Удалите старые — журнал не стирает их сам.`,
};

export const ProfileAthleteLogTab: React.FC<{ initialAthleteId?: string }> = ({ initialAthleteId }) => {
  const athletes = useMemo(() => readCoachState(ls()).athletes, []);
  const [store, setStore] = useState<CoachLogStore>(() => readCoachLog(ls()));
  const [athleteId, setAthleteId] = useState<string>(() => {
    if (initialAthleteId && athletes.some(a => a.id === initialAthleteId)) return initialAthleteId;
    return athletes[0]?.id ?? '';
  });
  const [kind, setKind] = useState<'lift' | 'bodyweight'>('lift');
  const [date, setDate] = useState<string>(localIsoDate());
  const [exercise, setExercise] = useState('');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('5');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const apply = (next: CoachLogStore) => {
    writeCoachLog(ls(), next);
    setStore(next);
  };

  const entries = useMemo(
    () => (athleteId ? entriesForAthlete(store, athleteId) : []),
    [store, athleteId],
  );
  const exercises = useMemo(
    () => (athleteId ? exercisesForAthlete(store, athleteId) : []),
    [store, athleteId],
  );
  const summary = useMemo(
    () => (athleteId ? logSummaryFor(store, athleteId) : null),
    [store, athleteId],
  );
  const trend = useMemo(
    () => (athleteId ? bodyweightTrend(store, athleteId) : null),
    [store, athleteId],
  );

  // Лучший подход по упражнению, выбранному в форме (или по первому известному).
  const bestExercise = exercise.trim() || exercises[0] || '';
  const best = useMemo(
    () => (athleteId && bestExercise ? bestSetFor(store, athleteId, bestExercise) : null),
    [store, athleteId, bestExercise],
  );

  const save = () => {
    const res = kind === 'bodyweight'
      ? addCoachLogEntry(store, { athleteId, kind, date, weightKg: weight, note })
      : addCoachLogEntry(store, { athleteId, kind, date, exercise, sets, reps, weightKg: weight, rpe, note });
    if (res.error) {
      setError(ERROR_TEXT[res.error] ?? 'Не удалось сохранить запись.');
      return;
    }
    apply(res.store);
    setError(null);
    setNote('');
    if (kind === 'lift') {
      setWeight('');
      setRpe('');
    } else {
      setWeight('');
    }
  };

  const askDelete = (id: string) => {
    if (confirmDeleteId === id) {
      apply(removeCoachLogEntry(store, id));
      setConfirmDeleteId(null);
      return;
    }
    setConfirmDeleteId(id);
  };

  if (athletes.length === 0) {
    return (
      <div data-log="no-athletes" style={{ ...cardStyle, fontSize: 12.5, color: colors.textMuted, lineHeight: 1.55 }}>
        В режиме тренера пока нет атлетов. Добавьте карточку во вкладке «Тренер» — журнал ведётся по атлетам,
        а не «в воздух».
      </div>
    );
  }

  const athleteName = athletes.find(a => a.id === athleteId)?.name ?? '';

  return (
    <div className="pf-log" data-log="root" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Выбор атлета + сводка */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span aria-hidden="true" style={{ display: 'inline-flex', color: VIOLET }}>
            <NativeIcon name="activity" size={16} />
          </span>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Журнал атлета</div>
        </div>
        <label style={label('Атлет')} htmlFor="log-athlete">Атлет</label>
        <select
          id="log-athlete"
          value={athleteId}
          onChange={e => { setAthleteId(e.target.value); setConfirmDeleteId(null); setError(null); }}
          aria-label="Атлет журнала"
          data-log="athlete"
          style={inputStyle}
        >
          {athletes.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {summary && (
          <div
            data-log="summary"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginTop: 12 }}
          >
            {[
              { k: 'Записей', v: String(summary.entries) },
              { k: 'Тоннаж 30 дн.', v: summary.tonnage30 > 0 ? fmtKg(summary.tonnage30) : '—' },
              {
                k: 'Вес тела',
                v: trend ? `${trend.to.weightKg} кг · ${trend.deltaKg > 0 ? '+' : ''}${trend.deltaKg} кг` : 'мало данных',
              },
            ].map(cell => (
              <div
                key={cell.k}
                style={{
                  padding: '8px 10px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ fontSize: 10.5, color: colors.textSubtle, fontWeight: 700 }}>{cell.k}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                  {cell.v}
                </div>
              </div>
            ))}
          </div>
        )}
        {summary && summary.entries === 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: colors.textMuted }}>
            Записей у {athleteName || 'атлета'} пока нет — добавьте первый подход или вес тела.
          </div>
        )}
        {best && (
          <div data-log="best" style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
            Лучший записанный подход · {bestExercise}: <strong>{best.weightKg} кг</strong> ×{' '}
            {best.entry.reps} ({fmtDate(best.entry.date)}) — это максимум среди записей, не расчётный максимум.
          </div>
        )}
      </div>

      {/* Новая запись */}
      <div style={cardStyle} data-log="form">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['lift', 'bodyweight'] as const).map(k => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              data-log="kind"
              data-kind={k}
              onClick={() => { setKind(k); setError(null); }}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 12,
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 800,
                border: `1px solid ${kind === k ? withAlpha(VIOLET, '80') : 'rgba(255,255,255,0.12)'}`,
                background: kind === k ? withAlpha(VIOLET, '26') : 'rgba(255,255,255,0.04)',
                color: kind === k ? '#fff' : colors.textMuted,
              }}
            >
              {k === 'lift' ? 'Подход' : 'Вес тела'}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label('Дата')} htmlFor="log-date">Дата</label>
            <input
              id="log-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              data-log="date"
              style={inputStyle}
            />
          </div>

          {kind === 'lift' ? (
            <>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label('Упражнение')} htmlFor="log-exercise">Упражнение</label>
                <input
                  id="log-exercise"
                  value={exercise}
                  onChange={e => setExercise(e.target.value)}
                  list="log-exercises"
                  placeholder="Присед, жим лёжа, тяга…"
                  data-log="exercise"
                  style={inputStyle}
                />
                <datalist id="log-exercises">
                  {exercises.map(x => <option key={x} value={x} />)}
                </datalist>
              </div>
              <div>
                <label style={label('Подходы')} htmlFor="log-sets">Подходы</label>
                <input
                  id="log-sets"
                  inputMode="numeric"
                  value={sets}
                  onChange={e => setSets(e.target.value)}
                  data-log="sets"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={label('Повторы')} htmlFor="log-reps">Повторы</label>
                <input
                  id="log-reps"
                  inputMode="numeric"
                  value={reps}
                  onChange={e => setReps(e.target.value)}
                  data-log="reps"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={label('Вес, кг')} htmlFor="log-weight">Вес, кг</label>
                <input
                  id="log-weight"
                  inputMode="decimal"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="—"
                  data-log="weight"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={label('RPE')} htmlFor="log-rpe">RPE (1–10)</label>
                <input
                  id="log-rpe"
                  inputMode="decimal"
                  value={rpe}
                  onChange={e => setRpe(e.target.value)}
                  placeholder="—"
                  data-log="rpe"
                  style={inputStyle}
                />
              </div>
            </>
          ) : (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={label('Вес тела, кг')} htmlFor="log-bw">Вес тела, кг</label>
              <input
                id="log-bw"
                inputMode="decimal"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                placeholder="82.5"
                data-log="weight"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label('Заметка')} htmlFor="log-note">Заметка</label>
            <input
              id="log-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Самочувствие, техника, замечания"
              data-log="note"
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <div role="alert" data-log="error" style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button type="button" onClick={save} data-log="save" style={btn('primary')}>
            + Записать
          </button>
        </div>
      </div>

      {/* Записи */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.length === 0 && (
          <div data-log="empty" style={{ ...cardStyle, fontSize: 12.5, color: colors.textMuted }}>
            Записей нет. Первая запись — например, текущий вес тела или рабочий подход.
          </div>
        )}
        {entries.slice(0, 50).map(e => (
          <div
            key={e.id}
            data-log="item"
            data-entry-id={e.id}
            data-kind={e.kind}
            style={{ ...cardStyle, padding: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', wordBreak: 'break-word' }}>
                  {e.kind === 'bodyweight' ? 'Вес тела' : e.exercise}
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                  {e.kind === 'bodyweight'
                    ? `${e.weightKg} кг`
                    : `${e.sets}×${e.reps}${e.weightKg !== null ? ` × ${e.weightKg} кг` : ''}${e.rpe !== null ? ` · RPE ${e.rpe}` : ''}`}
                </div>
                {e.note && (
                  <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4 }}>{e.note}</div>
                )}
                <div style={{ fontSize: 10.5, color: colors.textSubtle, marginTop: 5 }}>{fmtDate(e.date)}</div>
              </div>
              <button
                type="button"
                onClick={() => askDelete(e.id)}
                aria-label="Удалить запись"
                data-log="delete"
                style={{
                  flexShrink: 0,
                  minHeight: 32,
                  padding: '4px 9px',
                  borderRadius: 9,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  border: `1px solid ${confirmDeleteId === e.id ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  background: confirmDeleteId === e.id ? 'rgba(239,68,68,0.2)' : 'transparent',
                  color: confirmDeleteId === e.id ? '#fecaca' : colors.textMuted,
                }}
              >
                {confirmDeleteId === e.id ? 'Точно?' : '✕'}
              </button>
            </div>
          </div>
        ))}
        {entries.length > 50 && (
          <div style={{ fontSize: 11.5, color: colors.textSubtle, textAlign: 'center' }}>
            Показаны 50 последних из {entries.length}. Старые записи не удалены — они участвуют в тоннаже.
          </div>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.55, padding: '0 4px' }}>
        Тоннаж = подходы × повторы × вес по вашим записям за 30 дней. Записи без веса в тоннаж не входят.
        Нормативов, процентов от максимума и прогнозов приложение не считает.
      </div>
    </div>
  );
};
