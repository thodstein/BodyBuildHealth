/**
 * ProfileNotesTab — заметки профиля (общие и по атлетам).
 *
 * Зачем отдельная вкладка: «колено не грузить», «пересдать ферритин», «клиент
 * боится приседа» — это контекст, который нельзя держать в дневниках замеров.
 * Заметки закрепляются (памятка на виду), ищутся по заголовку и тексту и могут
 * быть привязаны к атлету из режима тренера.
 *
 * Честно: заметки не влияют на расчёты планов и не уходят в отчёты — это
 * текстовый блокнот, а не медицинский документ.
 */
import React, { useMemo, useState } from 'react';
import { NativeIcon } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';
import { readCoachState } from '../../../engines/coach/coach-mode.engine';
import {
  COACH_NOTE_BODY_MAX,
  COACH_NOTE_TITLE_MAX,
  COACH_NOTES_MAX,
  addCoachNote,
  filterCoachNotes,
  readCoachNotes,
  removeCoachNote,
  toggleCoachNotePin,
  updateCoachNote,
  writeCoachNotes,
  type CoachNote,
  type CoachNotesStore,
} from '../../../engines/coach/coach-notes.engine';

const AMBER = '#f59e0b';

const ls = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

interface EditorState {
  id: string | null;
  title: string;
  body: string;
  athleteId: string;
  pinned: boolean;
}

const EMPTY_EDITOR: EditorState = { id: null, title: '', body: '', athleteId: '', pinned: false };

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
  color: tone === 'primary' ? '#2a1a02' : tone === 'danger' ? '#fca5a5' : 'rgba(255,255,255,0.82)',
  background:
    tone === 'primary'
      ? `linear-gradient(135deg, ${AMBER}, #f97316)`
      : tone === 'danger'
        ? 'rgba(239,68,68,0.14)'
        : 'rgba(255,255,255,0.05)',
});

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export const ProfileNotesTab: React.FC<{ initialAthleteId?: string }> = ({ initialAthleteId }) => {
  const athletes = useMemo(() => readCoachState(ls()).athletes, []);
  const [store, setStore] = useState<CoachNotesStore>(() => readCoachNotes(ls()));
  const [query, setQuery] = useState('');
  // Фильтр по атлету, к которому пришли из режима тренера. Если карточку уже
  // удалили — не показываем пустой список «по несуществующему атлету».
  const [athleteFilter, setAthleteFilter] = useState<string>(() => {
    if (!initialAthleteId) return 'all';
    return athletes.some(a => a.id === initialAthleteId) ? initialAthleteId : 'all';
  });
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const nameOf = (id: string | null): string =>
    id ? (athletes.find(a => a.id === id)?.name ?? 'атлет удалён') : '';

  const apply = (next: CoachNotesStore) => {
    writeCoachNotes(ls(), next);
    setStore(next);
  };

  const visible = useMemo(
    () => filterCoachNotes(store, { query, athleteId: athleteFilter === 'all' ? null : athleteFilter }),
    [store, query, athleteFilter],
  );

  const openNew = () => {
    setEditor({ ...EMPTY_EDITOR });
    setError(null);
  };

  const openEdit = (n: CoachNote) => {
    setEditor({ id: n.id, title: n.title, body: n.body, athleteId: n.athleteId ?? '', pinned: n.pinned });
    setError(null);
    setConfirmDeleteId(null);
  };

  const save = () => {
    if (!editor) return;
    const payload = {
      title: editor.title,
      body: editor.body,
      athleteId: editor.athleteId || null,
      pinned: editor.pinned,
    };
    if (editor.id) {
      const next = updateCoachNote(store, editor.id, payload);
      if (next === store) {
        setError('Пустая заметка не сохраняется — заполните заголовок или текст.');
        return;
      }
      apply(next);
    } else {
      const res = addCoachNote(store, payload);
      if (res.error === 'empty') {
        setError('Пустая заметка не сохраняется — заполните заголовок или текст.');
        return;
      }
      if (res.error === 'limit') {
        setError(
          `Лимит ${COACH_NOTES_MAX} заметок. Удалите неактуальные — движок не стирает ваши заметки автоматически.`,
        );
        return;
      }
      apply(res.store);
    }
    setEditor(null);
    setError(null);
  };

  const askDelete = (id: string) => {
    if (confirmDeleteId === id) {
      apply(removeCoachNote(store, id));
      setConfirmDeleteId(null);
      if (editor?.id === id) setEditor(null);
      return;
    }
    setConfirmDeleteId(id);
  };

  return (
    <div className="pf-notes" data-notes="root" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true" style={{ display: 'inline-flex', color: AMBER }}>
              <NativeIcon name="file" size={16} />
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Заметки</div>
              <div style={{ fontSize: 11.5, color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
                {store.items.length} из {COACH_NOTES_MAX}
              </div>
            </div>
          </div>
          <button type="button" onClick={openNew} data-notes="new" style={btn('primary')}>
            + Новая заметка
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по заметкам"
            aria-label="Поиск по заметкам"
            data-notes="search"
            style={{ ...inputStyle, flex: '1 1 170px', width: 'auto' }}
          />
          {athletes.length > 0 && (
            <select
              value={athleteFilter}
              onChange={e => setAthleteFilter(e.target.value)}
              aria-label="Фильтр по атлету"
              data-notes="filter"
              style={{ ...inputStyle, width: 'auto', flex: '0 1 190px' }}
            >
              <option value="all">Все атлеты</option>
              <option value="none">Без атлета</option>
              {athletes.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {editor && (
        <div style={cardStyle} data-notes="editor">
          <div style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted, marginBottom: 10 }}>
            {editor.id ? 'Правка заметки' : 'Новая заметка'}
          </div>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: colors.textMuted, marginBottom: 5 }} htmlFor="note-title">
            Заголовок
          </label>
          <input
            id="note-title"
            value={editor.title}
            maxLength={COACH_NOTE_TITLE_MAX}
            onChange={e => setEditor(s => (s ? { ...s, title: e.target.value } : s))}
            placeholder="Коротко: о чём заметка"
            style={inputStyle}
            data-notes="title"
          />
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: colors.textMuted, margin: '10px 0 5px' }} htmlFor="note-body">
            Текст
          </label>
          <textarea
            id="note-body"
            value={editor.body}
            maxLength={COACH_NOTE_BODY_MAX}
            onChange={e => setEditor(s => (s ? { ...s, body: e.target.value } : s))}
            rows={5}
            placeholder="Контекст, ограничения, договорённости"
            style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
            data-notes="body"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {athletes.length > 0 && (
              <select
                value={editor.athleteId}
                onChange={e => setEditor(s => (s ? { ...s, athleteId: e.target.value } : s))}
                aria-label="Атлет заметки"
                data-notes="athlete"
                style={{ ...inputStyle, width: 'auto', flex: '1 1 160px' }}
              >
                <option value="">Без атлета (общая)</option>
                {athletes.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
            <label
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, cursor: 'pointer',
                fontSize: 12.5, color: colors.textMuted, padding: '0 4px',
              }}
            >
              <input
                type="checkbox"
                checked={editor.pinned}
                onChange={e => setEditor(s => (s ? { ...s, pinned: e.target.checked } : s))}
                data-notes="pinned"
                style={{ width: 18, height: 18, accentColor: AMBER }}
              />
              Закрепить сверху
            </label>
          </div>
          {error && (
            <div role="alert" data-notes="error" style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={save} data-notes="save" style={btn('primary')}>
              {editor.id ? 'Сохранить' : 'Добавить'}
            </button>
            <button
              type="button"
              onClick={() => { setEditor(null); setError(null); }}
              data-notes="cancel"
              style={btn('ghost')}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.length === 0 && (
          <div data-notes="empty" style={{ ...cardStyle, fontSize: 12.5, color: colors.textMuted, lineHeight: 1.5 }}>
            {store.items.length === 0
              ? 'Заметок пока нет. Сюда удобно писать то, что не влезает в дневники: травмы, ограничения, договорённости с атлетом.'
              : 'По запросу ничего не найдено.'}
          </div>
        )}
        {visible.map(n => {
          const athleteName = nameOf(n.athleteId);
          const isDeleting = confirmDeleteId === n.id;
          return (
            <div
              key={n.id}
              data-notes="item"
              data-note-id={n.id}
              data-pinned={n.pinned}
              style={{
                ...cardStyle,
                borderColor: n.pinned ? withAlpha(AMBER, '59') : 'rgba(255,255,255,0.10)',
                background: n.pinned
                  ? `linear-gradient(160deg, ${withAlpha(AMBER, '14')}, rgba(255,255,255,0.02))`
                  : cardStyle.background,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', lineHeight: 1.35, wordBreak: 'break-word' }}>
                    {n.title || n.body.split('\n')[0].slice(0, 80)}
                  </div>
                  {n.title && n.body && (
                    <div
                      style={{
                        fontSize: 12.5, color: 'rgba(255,255,255,0.72)', marginTop: 5, lineHeight: 1.5,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}
                    >
                      {n.body}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                    {athleteName && (
                      <span
                        style={{
                          fontSize: 10.5, padding: '3px 8px', borderRadius: 999,
                          color: AMBER, background: withAlpha(AMBER, '1f'), border: `1px solid ${withAlpha(AMBER, '40')}`,
                        }}
                      >
                        {athleteName}
                      </span>
                    )}
                    <span style={{ fontSize: 10.5, color: colors.textSubtle }}>{fmtDate(n.updatedAt)}</span>
                    {n.pinned && <span style={{ fontSize: 10.5, color: AMBER, fontWeight: 800 }}>закреплена</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-notes="pin"
                  onClick={() => apply(toggleCoachNotePin(store, n.id))}
                  style={{ ...btn('ghost'), fontSize: 12 }}
                >
                  {n.pinned ? 'Открепить' : 'Закрепить'}
                </button>
                <button type="button" data-notes="edit" onClick={() => openEdit(n)} style={{ ...btn('ghost'), fontSize: 12 }}>
                  Изменить
                </button>
                <button type="button" data-notes="delete" onClick={() => askDelete(n.id)} style={{ ...btn('danger'), fontSize: 12 }}>
                  {isDeleting ? 'Точно удалить' : 'Удалить'}
                </button>
                {isDeleting && (
                  <button
                    type="button"
                    data-notes="delete-cancel"
                    onClick={() => setConfirmDeleteId(null)}
                    style={{ ...btn('ghost'), fontSize: 12 }}
                  >
                    Оставить
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.55, padding: '0 4px' }}>
        Заметки — это контекст, а не дневник: они не меняют расчёты планов и не попадают в отчёты
        автоматически.
      </div>
    </div>
  );
};
