/**
 * ProfileCoachTab — «Режим тренера» в профиле (общий слой, не PL-only).
 *
 * Что здесь есть и почему именно так:
 *  • выключатель режима — в профиле, как просил пользователь;
 *  • разделы: реальные направления приложения (Тренировки, Питание, Анализы,
 *    Риски, Фарма, БАДы) — их можно выбрать все, по отдельности или снять все;
 *  • атлеты: до 20 карточек; при достижении лимита добавление блокируется и
 *    ПРИЧИНА написана текстом, а не «кнопка молча не работает»;
 *  • активный атлет — тот, с кем тренер работает сейчас; удаление активного
 *    корректно сбрасывает выбор (движок это гарантирует);
 *  • «Войти в его данные» — переключение приложения в пространство данных атлета
 *    (`core/data-space`): свои профиль/дневники/планы/анализы, своя база IndexedDB.
 *    Переключение всегда через перезагрузку: половинчатая подмена оставила бы в
 *    памяти чужие данные. Удаление карточки и удаление ЕГО данных — разные кнопки.
 */
import React, { useMemo, useState } from 'react';
import { NativeIcon } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';
import {
  COACH_MAX_ATHLETES,
  COACH_SECTIONS,
  addCoachAthlete,
  coachActiveAthlete,
  coachLimits,
  readCoachState,
  removeCoachAthlete,
  selectAllCoachSections,
  setActiveCoachAthlete,
  setCoachEnabled,
  toggleCoachSection,
  updateCoachAthlete,
  writeCoachState,
  type CoachAthlete,
  type CoachSectionId,
  type CoachSex,
  type CoachState,
} from '../../../engines/coach/coach-mode.engine';
import { countNotesForAthlete, readCoachNotes, type CoachNotesStore } from '../../../engines/coach/coach-notes.engine';
import { readCoachPlanner, type CoachPlannerStore } from '../../../engines/coach/coach-planner.engine';
import { readCoachLog, type CoachLogStore } from '../../../engines/coach/coach-athlete-log.engine';
import { deleteSpaceDatabases } from '../../../core/db';
import {
  MAX_DATA_SPACES,
  activateAthleteSpace,
  activateHomeSpace,
  activeSpaceRecord,
  athleteSpaceId,
  clearSpaceData,
  deviceRawOrFallback,
  readRegistryFromStorage,
  reloadToApplySpace,
  removeSpace,
  spaceUsage,
  writeRegistryToStorage,
} from '../../../core/data-space';

const ACCENT = '#22d3ee';

const ls = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

const SEX_LABEL: Record<CoachSex, string> = { male: 'муж', female: 'жен', unspecified: 'пол не указан' };

/** 2026-11-04 → 04.11.26 (компактно для строки карточки). */
const fmtShort = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
};

interface AthleteForm {
  name: string;
  sex: CoachSex;
  age: string;
  weightKg: string;
  heightCm: string;
  direction: string;
  goal: string;
  note: string;
}

const EMPTY_FORM: AthleteForm = {
  name: '',
  sex: 'unspecified',
  age: '',
  weightKg: '',
  heightCm: '',
  direction: '',
  goal: '',
  note: '',
};

const formFromAthlete = (a: CoachAthlete): AthleteForm => ({
  name: a.name,
  sex: a.sex,
  age: a.age === null ? '' : String(a.age),
  weightKg: a.weightKg === null ? '' : String(a.weightKg),
  heightCm: a.heightCm === null ? '' : String(a.heightCm),
  direction: a.direction,
  goal: a.goal,
  note: a.note,
});

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: 14,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13.5,
  color: '#fff',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.2,
  color: colors.textMuted,
  marginBottom: 5,
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
  color: tone === 'primary' ? '#04222a' : tone === 'danger' ? '#fca5a5' : 'rgba(255,255,255,0.82)',
  background:
    tone === 'primary'
      ? `linear-gradient(135deg, ${ACCENT}, #0ea5e9)`
      : tone === 'danger'
        ? 'rgba(239,68,68,0.14)'
        : 'rgba(255,255,255,0.05)',
});

export const ProfileCoachTab: React.FC<{
  onNavigate?: (screen: string) => void;
  /** Открыть заметки/задачи конкретного атлета (переход на вкладку с фильтром). */
  onOpenAthlete?: (athleteId: string, target: 'notes' | 'planner' | 'log') => void;
}> = ({ onNavigate, onOpenAthlete }) => {
  const [state, setState] = useState<CoachState>(() => readCoachState(ls()));
  const [form, setForm] = useState<AthleteForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Заметки/планер/журнал читаем один раз на состояние режима: сам экран их не меняет,
  // а пересчитывать JSON на каждый символ в форме атлета незачем.
  const { notes, planner, log } = useMemo<{
    notes: CoachNotesStore;
    planner: CoachPlannerStore;
    log: CoachLogStore;
  }>(
    () => ({ notes: readCoachNotes(ls()), planner: readCoachPlanner(ls()), log: readCoachLog(ls()) }),
    [state],
  );

  // Одна проходка по журналу вместо «на каждого атлета заново»: 20 карточек × 5000
  // записей — это 100k итераций на рендер, если считать в лоб.
  const logStats = useMemo(() => {
    const map = new Map<string, { count: number; last: string | null }>();
    for (const entry of log.items) {
      const cur = map.get(entry.athleteId) ?? { count: 0, last: null };
      cur.count += 1;
      if (!cur.last || entry.date > cur.last) cur.last = entry.date;
      map.set(entry.athleteId, cur);
    }
    return map;
  }, [log.items]);

  const apply = (next: CoachState) => {
    writeCoachState(ls(), next);
    setState(next);
  };

  // Пространство данных читаем один раз на рендер экрана (переключение всё равно
  // перезагружает приложение), а объём данных атлета — только для подтверждения удаления.
  const spaceActiveId = useMemo(() => activeSpaceRecord().id, []);
  const usageOf = (athleteId: string) => {
    const storage = ls();
    if (!storage) return { keys: 0, bytes: 0 };
    return spaceUsage(deviceRawOrFallback(storage), athleteSpaceId(athleteId));
  };

  const limits = coachLimits(state);
  const active = coachActiveAthlete(state);

  const toggleEnabled = () => {
    apply(setCoachEnabled(state, !state.enabled));
  };

  const toggleSection = (id: CoachSectionId) => {
    apply(toggleCoachSection(state, id));
  };

  const allSelected = state.sections.length === COACH_SECTIONS.length;

  const startEdit = (a: CoachAthlete) => {
    setEditingId(a.id);
    setForm(formFromAthlete(a));
    setFormError(null);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const save = () => {
    if (!form.name.trim()) {
      setFormError('Имя обязательно — по нему тренер находит атлета в списке.');
      return;
    }
    if (editingId) {
      apply(
        updateCoachAthlete(state, editingId, {
          name: form.name,
          sex: form.sex,
          age: form.age,
          weightKg: form.weightKg,
          heightCm: form.heightCm,
          direction: form.direction,
          goal: form.goal,
          note: form.note,
        }),
      );
      cancelEdit();
      return;
    }
    const res = addCoachAthlete(state, {
      name: form.name,
      sex: form.sex,
      age: form.age,
      weightKg: form.weightKg,
      heightCm: form.heightCm,
      direction: form.direction,
      goal: form.goal,
      note: form.note,
    });
    if (res.error === 'limit') {
      setFormError(`Лимит ${COACH_MAX_ATHLETES} атлетов достигнут. Удалите карточку, чтобы добавить нового.`);
      return;
    }
    if (res.error === 'name') {
      setFormError('Имя обязательно.');
      return;
    }
    apply(res.state);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const askDelete = (id: string) => {
    if (confirmDeleteId === id) {
      apply(removeCoachAthlete(state, id));
      setConfirmDeleteId(null);
      if (editingId === id) cancelEdit();
      return;
    }
    setConfirmDeleteId(id);
  };

  /** Удаление карточки вместе с данными атлета (профиль/дневники/анализы). */
  const deleteWithData = (a: CoachAthlete) => {
    const sid = athleteSpaceId(a.id);
    // Чистим по префиксу пространства, а не по наличию записи в реестре: «осиротевшие»
    // ключи (атлет входил, но реестр уже переписывали) тоже должны уйти.
    const storage = ls();
    if (storage) clearSpaceData(deviceRawOrFallback(storage), sid);
    writeRegistryToStorage(removeSpace(readRegistryFromStorage(), sid));
    void deleteSpaceDatabases([sid]);
    apply(removeCoachAthlete(state, a.id));
    setConfirmDeleteId(null);
    if (editingId === a.id) cancelEdit();
    if (spaceActiveId === sid) {
      activateHomeSpace();
      reloadToApplySpace();
    }
  };

  /** Войти в данные атлета: своё пространство профиля/дневников/планов. */
  const enterAthleteData = (a: CoachAthlete) => {
    // Переносим введённое в карточку в пустой профиль атлета: имя, пол, возраст,
    // рост и вес тренер уже заполнял здесь — второй раз спрашивать незачем.
    const seed = {
      name: a.name,
      ...(a.sex === 'male' || a.sex === 'female' ? { sex: a.sex } : {}),
      ...(a.age != null ? { age: a.age } : {}),
      ...(a.heightCm != null ? { height: a.heightCm } : {}),
      ...(a.weightKg != null ? { weight: a.weightKg } : {}),
    };
    const res = activateAthleteSpace(a.id, a.name, seed);
    if (res.error === 'limit') {
      setFormError(`Лимит ${MAX_DATA_SPACES} пространств данных. Удалите данные неактуального атлета.`);
      return;
    }
    if (res.error) {
      setFormError('Не удалось открыть данные атлета.');
      return;
    }
    reloadToApplySpace();
  };

  const visibleAthletes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.athletes;
    return state.athletes.filter(a =>
      `${a.name} ${a.direction} ${a.goal} ${a.note}`.toLowerCase().includes(q),
    );
  }, [state.athletes, query]);

  const sectionLabel = (id: CoachSectionId): string =>
    COACH_SECTIONS.find(s => s.id === id)?.label ?? id;

  return (
    <div className="pf-coach" data-coach="root" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Переключатель режима */}
      <div style={{ ...cardStyle, borderColor: withAlpha(ACCENT, state.enabled ? '66' : '1f') }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ display: 'inline-flex', color: ACCENT }}>
                <NativeIcon name="award" size={15} />
              </span>
              Режим тренера
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 1.45 }}>
              До {COACH_MAX_ATHLETES} атлетов, выбор нужных разделов, заметки и планер.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.enabled}
            aria-label="Режим тренера"
            data-coach="toggle"
            onClick={toggleEnabled}
            style={{
              flexShrink: 0,
              width: 62,
              height: 34,
              borderRadius: 999,
              cursor: 'pointer',
              border: `1px solid ${state.enabled ? withAlpha(ACCENT, '99') : 'rgba(255,255,255,0.14)'}`,
              background: state.enabled
                ? `linear-gradient(135deg, ${ACCENT}, #0ea5e9)`
                : 'rgba(255,255,255,0.08)',
              position: 'relative',
              transition: 'background 0.18s ease, border 0.18s ease',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 3,
                left: state.enabled ? 31 : 4,
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                transition: 'left 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          </button>
        </div>
        {state.enabled && active && (
          <div
            data-coach="active"
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 12,
              background: withAlpha(ACCENT, '18'),
              border: `1px solid ${withAlpha(ACCENT, '40')}`,
              fontSize: 12,
              color: '#fff',
            }}
          >
            <span aria-hidden="true" style={{ display: 'inline-flex', color: ACCENT }}>
              <NativeIcon name="target" size={13} />
            </span>
            Активный атлет: <strong style={{ fontWeight: 800 }}>{active.name}</strong>
          </div>
        )}
      </div>

      {!state.enabled ? (
        <div style={{ ...cardStyle, fontSize: 12.5, color: colors.textMuted, lineHeight: 1.55 }}>
          Включите режим, чтобы вести карточки атлетов и выбрать разделы, которые вы у них
          контролируете. Заметки и календарь-планер доступны отдельными вкладками профиля
          и работают независимо от режима.
        </div>
      ) : (
        <>
          {/* Разделы */}
          <div style={cardStyle} data-coach="sections">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Разделы</div>
              <div style={{ fontSize: 11.5, color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
                {state.sections.length} из {COACH_SECTIONS.length}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {COACH_SECTIONS.map(s => {
                const on = state.sections.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Раздел ${s.label}`}
                    data-coach="section"
                    data-section={s.id}
                    data-on={on}
                    onClick={() => toggleSection(s.id)}
                    style={{
                      minHeight: 44,
                      padding: '8px 13px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 700,
                      textAlign: 'left',
                      border: `1px solid ${on ? withAlpha(ACCENT, '70') : 'rgba(255,255,255,0.12)'}`,
                      background: on ? withAlpha(ACCENT, '1f') : 'rgba(255,255,255,0.04)',
                      color: on ? '#fff' : 'rgba(255,255,255,0.62)',
                    }}
                  >
                    {on ? '✓ ' : ''}
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                data-coach="select-all"
                onClick={() => apply(selectAllCoachSections(state))}
                disabled={allSelected}
                style={{ ...btn('ghost'), opacity: allSelected ? 0.55 : 1 }}
              >
                Выбрать все
              </button>
              <button
                type="button"
                data-coach="select-none"
                onClick={() => apply({ ...state, sections: [] })}
                disabled={state.sections.length === 0}
                style={{ ...btn('ghost'), opacity: state.sections.length === 0 ? 0.55 : 1 }}
              >
                Снять все
              </button>
            </div>
            {state.sections.length === 0 && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: colors.warning }}>
                Разделы не выбраны — тренеру нечего контролировать. Выберите хотя бы один.
              </div>
            )}
            {state.sections.length > 0 && (
              <>
                <div style={{ marginTop: 14, fontSize: 11.5, color: colors.textMuted, fontWeight: 700 }}>
                  Быстрый переход
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {state.sections.map(id => {
                    const def = COACH_SECTIONS.find(s => s.id === id);
                    if (!def) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        data-coach="section-link"
                        onClick={() => onNavigate?.(def.nav)}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                      >
                        {def.label} →
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Атлеты */}
          <div style={cardStyle} data-coach="athletes">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Атлеты</div>
                <div style={{ fontSize: 11.5, color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
                  {limits.count} / {limits.max}
                </div>
              </div>
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск атлета"
                aria-label="Поиск атлета"
                data-coach="search"
                style={{ ...inputStyle, width: 180, flex: '0 1 180px' }}
              />
            </div>

            {limits.canAdd ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px dashed rgba(255,255,255,0.14)',
                }}
                data-coach="form"
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted, marginBottom: 10 }}>
                  {editingId ? 'Правка карточки' : 'Новый атлет'}
                </div>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle} htmlFor="coach-name">Имя *</label>
                    <input
                      id="coach-name"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Как зовут атлета"
                      style={inputStyle}
                      data-coach="name"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-sex">Пол</label>
                    <select
                      id="coach-sex"
                      value={form.sex}
                      onChange={e => setForm(f => ({ ...f, sex: e.target.value as CoachSex }))}
                      style={inputStyle}
                      data-coach="sex"
                    >
                      <option value="unspecified">Не указан</option>
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-age">Возраст, лет</label>
                    <input
                      id="coach-age"
                      inputMode="numeric"
                      value={form.age}
                      onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                      placeholder="—"
                      style={inputStyle}
                      data-coach="age"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-weight">Вес, кг</label>
                    <input
                      id="coach-weight"
                      inputMode="decimal"
                      value={form.weightKg}
                      onChange={e => setForm(f => ({ ...f, weightKg: e.target.value }))}
                      placeholder="—"
                      style={inputStyle}
                      data-coach="weight"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-height">Рост, см</label>
                    <input
                      id="coach-height"
                      inputMode="numeric"
                      value={form.heightCm}
                      onChange={e => setForm(f => ({ ...f, heightCm: e.target.value }))}
                      placeholder="—"
                      style={inputStyle}
                      data-coach="height"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-direction">Направление</label>
                    <input
                      id="coach-direction"
                      value={form.direction}
                      onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}
                      placeholder="Пауэрлифтинг, ББ, армреслинг…"
                      style={inputStyle}
                      data-coach="direction"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="coach-goal">Цель</label>
                    <input
                      id="coach-goal"
                      value={form.goal}
                      onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                      placeholder="Присед 200, сушка до 82…"
                      style={inputStyle}
                      data-coach="goal"
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle} htmlFor="coach-note">Пометка тренера</label>
                    <textarea
                      id="coach-note"
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      rows={2}
                      placeholder="Травмы, ограничения, договорённости"
                      style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
                      data-coach="note"
                    />
                  </div>
                </div>
                {formError && (
                  <div role="alert" data-coach="error" style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
                    {formError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={save} data-coach="save" style={btn('primary')}>
                    {editingId ? 'Сохранить' : 'Добавить атлета'}
                  </button>
                  {editingId && (
                    <button type="button" onClick={cancelEdit} data-coach="cancel" style={btn('ghost')}>
                      Отмена
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                data-coach="limit"
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  fontSize: 12,
                  color: colors.warning,
                  background: colors.warningDim,
                  border: '1px solid rgba(245,158,11,0.35)',
                }}
              >
                Достигнут лимит — {COACH_MAX_ATHLETES} атлетов. Чтобы добавить нового, удалите карточку
                атлета, который больше не тренируется.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {visibleAthletes.length === 0 && (
                <div style={{ fontSize: 12, color: colors.textMuted }}>
                  {state.athletes.length === 0 ? 'Пока ни одного атлета — добавьте первого.' : 'По запросу никого не найдено.'}
                </div>
              )}
              {visibleAthletes.map(a => {
                const isActive = state.activeAthleteId === a.id;
                const noteCount = countNotesForAthlete(notes, a.id);
                const openTaskCount = planner.items.filter(t => t.athleteId === a.id && !t.done).length;
                const logStat = logStats.get(a.id);
                const meta = [
                  SEX_LABEL[a.sex],
                  a.age !== null ? `${a.age} лет` : null,
                  a.weightKg !== null ? `${a.weightKg} кг` : null,
                  a.heightCm !== null ? `${a.heightCm} см` : null,
                ].filter(Boolean) as string[];
                return (
                  <div
                    key={a.id}
                    data-coach="athlete"
                    data-athlete-id={a.id}
                    data-active={isActive}
                    style={{
                      borderRadius: 14,
                      padding: 12,
                      border: `1px solid ${isActive ? withAlpha(ACCENT, '66') : 'rgba(255,255,255,0.10)'}`,
                      background: isActive ? withAlpha(ACCENT, '12') : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>{a.name}</div>
                      {isActive && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 999,
                            color: '#04222a',
                            background: ACCENT,
                          }}
                        >
                          активный
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>{meta.join(' · ')}</div>
                    {(a.direction || a.goal) && (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 5, lineHeight: 1.45 }}>
                        {a.direction}
                        {a.direction && a.goal ? ' · ' : ''}
                        {a.goal}
                      </div>
                    )}
                    {a.note && (
                      <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 5, lineHeight: 1.45 }}>
                        {a.note}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                      {a.sections.map(id => (
                        <span
                          key={id}
                          style={{
                            fontSize: 10.5,
                            padding: '3px 8px',
                            borderRadius: 999,
                            color: 'rgba(255,255,255,0.7)',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {sectionLabel(id)}
                        </span>
                      ))}
                      {noteCount > 0 && (
                        <span style={{ fontSize: 10.5, color: colors.textMuted, alignSelf: 'center' }}>
                          заметок: {noteCount}
                        </span>
                      )}
                      {openTaskCount > 0 && (
                        <span style={{ fontSize: 10.5, color: colors.textMuted, alignSelf: 'center' }}>
                          незакрытых задач: {openTaskCount}
                        </span>
                      )}
                      {logStat && logStat.count > 0 && (
                        <span data-coach="log-count" style={{ fontSize: 10.5, color: colors.textMuted, alignSelf: 'center' }}>
                          записей: {logStat.count}
                          {logStat.last && ` · последняя ${fmtShort(logStat.last)}`}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {onOpenAthlete && (
                        <>
                          <button
                            type="button"
                            data-coach="open-log"
                            onClick={() => onOpenAthlete(a.id, 'log')}
                            style={{ ...btn('ghost'), fontSize: 12 }}
                          >
                            Журнал атлета
                          </button>
                          <button
                            type="button"
                            data-coach="open-notes"
                            onClick={() => onOpenAthlete(a.id, 'notes')}
                            style={{ ...btn('ghost'), fontSize: 12 }}
                          >
                            Заметки атлета
                          </button>
                          <button
                            type="button"
                            data-coach="open-planner"
                            onClick={() => onOpenAthlete(a.id, 'planner')}
                            style={{ ...btn('ghost'), fontSize: 12 }}
                          >
                            Задачи атлета
                          </button>
                        </>
                      )}
                      {!isActive && (
                        <button
                          type="button"
                          data-coach="activate"
                          onClick={() => apply(setActiveCoachAthlete(state, a.id))}
                          style={{ ...btn('ghost'), fontSize: 12 }}
                        >
                          Сделать активным
                        </button>
                      )}
                      {spaceActiveId === athleteSpaceId(a.id) ? (
                        <span
                          data-coach="space-active"
                          style={{
                            alignSelf: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '4px 9px',
                            borderRadius: 999,
                            color: '#1b1033',
                            background: '#a78bfa',
                          }}
                        >
                          Открыты его данные
                        </span>
                      ) : (
                        <button
                          type="button"
                          data-coach="enter-space"
                          onClick={() => enterAthleteData(a)}
                          style={{ ...btn('ghost'), fontSize: 12 }}
                          title="Открыть профиль, дневники и планы этого атлета"
                        >
                          Войти в его данные
                        </button>
                      )}
                      <button
                        type="button"
                        data-coach="edit"
                        onClick={() => (editingId === a.id ? cancelEdit() : startEdit(a))}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                      >
                        {editingId === a.id ? 'Свернуть' : 'Изменить'}
                      </button>
                      <button
                        type="button"
                        data-coach="delete"
                        onClick={() => askDelete(a.id)}
                        style={{ ...btn('danger'), fontSize: 12 }}
                      >
                        {confirmDeleteId === a.id ? 'Точно удалить' : 'Удалить'}
                      </button>
                      {confirmDeleteId === a.id && (
                        <button
                          type="button"
                          data-coach="delete-cancel"
                          onClick={() => setConfirmDeleteId(null)}
                          style={{ ...btn('ghost'), fontSize: 12 }}
                        >
                          Оставить
                        </button>
                      )}
                      {confirmDeleteId === a.id && usageOf(a.id).keys > 0 && (
                        <button
                          type="button"
                          data-coach="delete-with-data"
                          onClick={() => deleteWithData(a)}
                          style={{ ...btn('danger'), fontSize: 12 }}
                        >
                          Удалить и его данные ({usageOf(a.id).keys})
                        </button>
                      )}
                    </div>
                    {confirmDeleteId === a.id && (
                      <div
                        data-coach="delete-hint"
                        style={{ marginTop: 8, fontSize: 11.5, color: colors.textMuted, lineHeight: 1.45 }}
                      >
                        «Точно удалить» убирает только карточку: заметки, задачи и записи журнала этого
                        атлета останутся. Если атлет уже входил в приложение, у него есть собственные
                        профиль, дневники и планы — их удаляет отдельная кнопка «Удалить и его данные».
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Честная граница режима */}
          <div
            data-coach="boundary"
            style={{ fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.55, padding: '0 4px' }}
          >
            «Войти в его данные» переключает всё приложение в профиль этого атлета: у него свои
            профиль, дневники, планы и анализы — отдельное хранилище и отдельная база IndexedDB.
            Пока открыты данные атлета, сверху висит полоса с кнопкой возврата: это не украшение, а
            защита от правки чужого профиля по ошибке. Заметки, задачи и журнал тренера остаются
            общими для всех атлетов. Отдельных аккаунтов и доступа для самого атлета нет: данные
            живут на этом устройстве и в вашей синхронизации.
          </div>
        </>
      )}
    </div>
  );
};
