/**
 * ProfileNotesTab — заметки профиля (общие и по атлетам).
 *
 * Зачем отдельная вкладка: «колено не грузить», «пересдать ферритин», «клиент
 * боится приседа» — это контекст, который нельзя держать в дневниках замеров.
 * Заметки закрепляются (памятка на виду), ищутся по заголовку и тексту и могут
 * быть привязаны к атлету из режима тренера.
 *
 * Вложения (2026-11): к заметке можно приложить фото и аудио, записать голос,
 * надиктовать текст (речь → текст) и озвучить заметку (текст → речь).
 * Байты живут в IndexedDB (`note-media-store`), в localStorage — только
 * метаданные: иначе один снимок в base64 выжег бы квоту всех заметок.
 * Там же байты шифруются AES-GCM ключом устройства, а забрать файл наружу
 * можно кнопкой «Сохранить/Поделиться» (Documents + системный шаринг).
 *
 * Как выбирается голосовой движок (`note-speech`): сначала нативный мост APK
 * (системные SpeechRecognizer/TextToSpeech), затем web-API, иначе — честное
 * «недоступно» без кнопок-пустышек.
 *
 * Честно:
 *  • заметки не влияют на расчёты планов и не уходят в отчёты — это блокнот,
 *    а не медицинский документ;
 *  • микрофон работает только при разрешении RECORD_AUDIO (оно в манифесте,
 *    спрашивает сам Capacitor). Если система всё же отказала, UI прямо говорит
 *    «здесь недоступно» и предлагает рабочий путь: записать диктофоном и
 *    приложить файл;
 *  • расшифровка приложенного аудио не выдумывается: «голос в текст» работает
 *    только вживую во время диктовки;
 *  • файлы входят в резервную копию, пока влезают в её лимит; если нет — копия
 *    прямо говорит «вложения не вошли», а не делает вид, что их не было.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NativeIcon } from '../../native/NativeIcons';
import { colors, withAlpha } from './ui';
import { pickPhoto } from '../../../core/native-bridge';
import { readCoachState } from '../../../engines/coach/coach-mode.engine';
import {
  COACH_NOTE_ATTACHMENT_BYTES_MAX,
  COACH_NOTE_ATTACHMENTS_MAX,
  COACH_NOTE_BODY_MAX,
  COACH_NOTE_CHECKLIST_MAX,
  COACH_NOTE_CHECKLIST_TEXT_MAX,
  COACH_NOTE_TAG_MAX,
  COACH_NOTE_TAGS_MAX,
  COACH_NOTE_TITLE_MAX,
  COACH_NOTES_MAX,
  addCoachNote,
  collectCoachNoteTags,
  countLiveCoachNotes,
  filterCoachNotes,
  isCoachNoteDeleted,
  noteAttachmentIds,
  noteAttachments,
  noteChecklistProgress,
  noteTags,
  purgeCoachNote,
  purgeCoachTrash,
  readCoachNotes,
  restoreCoachNote,
  toggleCoachNotePin,
  toggleNoteChecklistItem,
  trashCoachNote,
  updateCoachNote,
  writeCoachNotes,
  type CoachNote,
  type CoachNoteAttachment,
  type CoachNoteAttachmentKind,
  type CoachNoteChecklistItem,
  type CoachNotesStore,
  type CoachNoteSort,
} from '../../../engines/coach/coach-notes.engine';
import {
  NOTE_AUDIO_MAX_MS,
  attachmentSummary,
  attachmentsBytes,
  compressPhotoDataUrl,
  dataUrlMime,
  dataUrlToBytes,
  ensurePersistentStorage,
  extensionForMime,
  formatBytes,
  formatDuration,
  hasRoomForBytes,
  isVoiceRecordingSupported,
  probeAudioDurationMs,
  recordingMime,
} from '../../../engines/note-media.engine';
import {
  openMicrophoneSettings,
  speakTextBest,
  speechSupport,
  speechSupportSync,
  startDictation,
  stopAllSpeech,
  stopSpeakingBest,
} from '../../../engines/note-speech';
import {
  cleanupNoteMedia,
  deleteAllNoteMedia,
  deleteNoteMedia,
  deleteNoteMediaForNote,
  getNoteMedia,
  noteMediaPayload,
  noteMediaTotalBytes,
  saveNoteMediaMany,
  type NoteMediaRecord,
} from '../../../engines/note-media-store';
import { saveBlobApk, shareOutcomeLabel } from '../../../core/apk-share';

const AMBER = '#f59e0b';

/**
 * Сколько ждём подтверждения «микрофон запущен». Нативное разрешение может
 * висеть (диалог не показался, мост не ответил) — без предела кнопка навсегда
 * оставалась бы «запускается» и не давала нажать себя снова.
 */
const DICTATION_START_TIMEOUT_MS = 30_000;

/**
 * Отказы, которые лечатся не повтором, а разрешением в настройках Android.
 * Для них показываем кнопку «Настройки микрофона» — иначе человек читает
 * «попробуйте снова» и упирается в то же самое.
 */
const MIC_PERMISSION_CODES = new Set([
  'no-permission',
  'permission-blocked',
  'permission-timeout',
  'permission-request-failed',
  'no-activity',
]);

const ls = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

/** Вложение в редакторе: метаданные + предпросмотр и «ещё не сохранено». */
interface DraftAttachment extends CoachNoteAttachment {
  /** dataUrl фото или blob:-URL аудио — только для предпросмотра. */
  previewUrl: string;
  /** Новый файл: в IndexedDB его ещё нет (пишем при сохранении заметки). */
  pending?: boolean;
  /** Аудио: байты до сохранения. */
  blob?: Blob;
  /** Фото: байты сжатого JPEG до сохранения (не base64-строка). */
  bytes?: ArrayBuffer;
}

interface EditorState {
  id: string | null;
  title: string;
  body: string;
  athleteId: string;
  pinned: boolean;
  tagsText: string;
  checklist: CoachNoteChecklistItem[];
  attachments: DraftAttachment[];
}

const EMPTY_EDITOR: EditorState = {
  id: null,
  title: '',
  body: '',
  athleteId: '',
  pinned: false,
  tagsText: '',
  checklist: [],
  attachments: [],
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

/**
 * Длинный текст в списке не разворачиваем целиком: заметка до 8000 символов
 * иначе занимает несколько экранов и прячет остальные. Превью — 6 строк.
 */
const BODY_PREVIEW_CHARS = 320;

/** Длинный чек-лист в списке показываем первыми пунктами, остальное — по кнопке. */
const CHECKLIST_PREVIEW_COUNT = 6;

/** Выбранная сортировка запоминается на устройстве — как в списках TickTick. */
const COACH_NOTES_SORT_KEY = 'he_coach_notes_sort';

const readStoredSort = (): CoachNoteSort => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(COACH_NOTES_SORT_KEY) : null;
    return raw === 'created' || raw === 'title' ? raw : 'updated';
  } catch {
    return 'updated';
  }
};

const writeStoredSort = (sort: CoachNoteSort): void => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(COACH_NOTES_SORT_KEY, sort);
  } catch {
    /* ignore */
  }
};

/**
 * Разбор строки тегов: запятая, опциональный `#`, без пустых. Дубликаты без
 * учёта регистра схлопываются, лишние сверх лимита отбрасываются. Движок
 * делает то же самое, но UI обязан показать, что именно сохранится.
 */
const parseTagsText = (raw: string): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const tag = part.trim().replace(/^#+/, '').trim().slice(0, COACH_NOTE_TAG_MAX);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= COACH_NOTE_TAGS_MAX) break;
  }
  return out;
};

const newAttachmentId = (): string => `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const isBlobUrl = (url: string): boolean => typeof url === 'string' && url.startsWith('blob:');

const revokeBlobUrl = (url: string): void => {
  if (!isBlobUrl(url)) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
};

const createObjectUrl = (blob: Blob): string => {
  try {
    return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : '';
  } catch {
    return '';
  }
};

/** Загруженный файл: blob:-URL (фото или аудио) либо «в хранилище нет». */
type MediaView = { src?: string; missing?: boolean };

type ViewerState = { attachmentId: string; url: string; kind: CoachNoteAttachmentKind };

type DictationState = 'idle' | 'starting' | 'listening' | 'error';

export const ProfileNotesTab: React.FC<{ initialAthleteId?: string }> = ({ initialAthleteId }) => {
  const athletes = useMemo(() => readCoachState(ls()).athletes, []);
  const [store, setStore] = useState<CoachNotesStore>(() => readCoachNotes(ls()));
  const [query, setQuery] = useState('');
  /** Развёрнутые длинные тексты — по id заметки, чтобы не трогать соседние. */
  const [expandedBodies, setExpandedBodies] = useState<Record<string, boolean>>({});
  /** Развёрнутые длинные чек-листы — тоже по id заметки. */
  const [expandedChecklists, setExpandedChecklists] = useState<Record<string, boolean>>({});
  // Фильтр по атлету, к которому пришли из режима тренера. Если карточку уже
  // удалили — не показываем пустой список «по несуществующему атлету».
  const [athleteFilter, setAthleteFilter] = useState<string>(() => {
    if (!initialAthleteId) return 'all';
    return athletes.some((a) => a.id === initialAthleteId) ? initialAthleteId : 'all';
  });
  const [editor, setEditor] = useState<EditorState | null>(null);
  /** Активные заметки или корзина — как два списка TickTick. */
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  /** Выбранный тег; 'all' — без фильтра. */
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<CoachNoteSort>(readStoredSort);
  const [error, setError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  /** Подтверждение окончательного удаления — отдельно от «в корзину». */
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);
  const [confirmPurgeTrash, setConfirmPurgeTrash] = useState(false);
  /** Короткое подтверждение действия («в корзине», «восстановлено»). */
  const [notice, setNotice] = useState<string | null>(null);
  /** Статус «поделиться/сохранить» для последнего вложения. */
  const [shareNote, setShareNote] = useState<string | null>(null);
  /** Сколько занимают файлы заметок — по нему видно, что квота не бесконечна. */
  const [mediaTotal, setMediaTotal] = useState(0);
  /** Второй тап по «удалить все вложения» — подтверждение (как у заметки). */
  const [confirmClearMedia, setConfirmClearMedia] = useState(false);

  /* ── Медиа, загруженное из IndexedDB (для списка) ─────────────────── */
  const [media, setMedia] = useState<Record<string, MediaView>>({});
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  /* ── Запись голоса ───────────────────────────────────────────────── */
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recStartedRef = useRef(0);
  /** Запись брошена (закрыли редактор/сохранили): её результат не прикладываем. */
  const discardRecordingRef = useRef(false);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recAutoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);

  /* ── Диктовка (речь → текст) и озвучка (текст → речь) ────────────── */
  const [dictation, setDictation] = useState<DictationState>('idle');
  /** Промежуточная гипотеза распознавания — показываем, что нас слышат. */
  const [interim, setInterim] = useState('');
  /** Отказ из-за разрешения: показываем кнопку «Настройки микрофона». */
  const [micSettingsNeeded, setMicSettingsNeeded] = useState(false);
  const dictationRef = useRef<{ stop: () => void } | null>(null);
  /** Старт диктовки асинхронный: двойной тап не должен поднять второй микрофон. */
  const dictationStartingRef = useRef(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  /** Номер текущей озвучки: поздний onEnd прошлой не должен гасить новую. */
  const speakSeqRef = useRef(0);

  // Первый рендер — по web-API, затем уточняем нативным мостом APK: в WebView
  // распознавания нет, но системный SpeechRecognizer есть. Так кнопка не
  // «мигает» и не обещает того, чего нет.
  const [speech, setSpeech] = useState(() => speechSupportSync());
  const dictationSupported = speech.dictation !== 'none';
  const speechOutputSupported = speech.speak !== 'none';

  const nameOf = (id: string | null): string => (id ? (athletes.find((a) => a.id === id)?.name ?? 'атлет удалён') : '');

  /**
   * Предпросмотр вложения в редакторе: для нового файла — свой dataUrl/blob:,
   * для уже сохранённого — из кэша (он мог догрузиться уже после открытия).
   */
  const draftPreview = (a: DraftAttachment): string => a.previewUrl || (a.pending ? '' : (media[a.id]?.src ?? ''));

  const apply = (next: CoachNotesStore) => {
    writeCoachNotes(ls(), next);
    setStore(next);
  };

  /** «Сколько занимают файлы» — считаем после каждой записи/удаления. */
  const refreshMediaTotal = () => {
    void noteMediaTotalBytes().then((n) => setMediaTotal(n));
  };

  /** Живые заметки — лимит и счётчик не должны включать корзину. */
  const liveCount = useMemo(() => countLiveCoachNotes(store), [store]);
  const trashCount = store.items.length - liveCount;
  /** Все теги живых заметок — для чипов фильтра. */
  const tagSummary = useMemo(() => collectCoachNoteTags(store), [store]);

  const visible = useMemo(
    () =>
      filterCoachNotes(store, {
        query,
        athleteId: athleteFilter === 'all' ? null : athleteFilter,
        tag: tagFilter === 'all' ? null : tagFilter,
        deleted: viewMode === 'trash',
        sort: sortBy,
      }),
    [store, query, athleteFilter, tagFilter, viewMode, sortBy],
  );
  /** Сколько заметок в текущем списке (живые или корзина) — база для «показано X из Y». */
  const viewTotal = viewMode === 'trash' ? trashCount : liveCount;

  /** Сколько заметок держат файлы: «занято X» — сумма именно по ним. */
  const notesWithMedia = useMemo(
    () => store.items.filter((n) => !n.deletedAt && noteAttachments(n).length > 0).length,
    [store],
  );

  /* ── Медиа из IndexedDB: кэш по id ───────────────────────────────── */
  // Кэш, а не «перечитать всё при каждом изменении заметок»: иначе сохранение
  // любой заметки пересоздавало бы blob-URL всех вложений и обрывало звук,
  // который сейчас играет.
  const mediaCacheRef = useRef<Map<string, MediaView>>(new Map());

  useEffect(() => {
    let alive = true;
    const ids = store.items.flatMap((n) => noteAttachmentIds(n));
    const wanted = new Set(ids);
    const cache = mediaCacheRef.current;

    // Вложений больше нет в заметках — снимаем с кэша и освобождаем URL.
    for (const [id, view] of [...cache]) {
      if (wanted.has(id)) continue;
      revokeBlobUrl(view.src ?? '');
      cache.delete(id);
    }

    const missing = ids.filter((id) => !cache.has(id));
    if (!missing.length) {
      setMedia(Object.fromEntries(cache));
      return () => {
        alive = false;
      };
    }

    void (async () => {
      const loaded = await Promise.all(missing.map(async (id) => ({ id, rec: await getNoteMedia(id) })));
      const fresh = new Map<string, MediaView>();
      for (const { id, rec } of loaded) {
        const blob = await noteMediaPayload(rec);
        if (!blob) {
          fresh.set(id, { missing: true });
          continue;
        }
        const src = createObjectUrl(blob);
        fresh.set(id, src ? { src } : { missing: true });
      }
      if (!alive) {
        // Список сменился, пока грузили: созданные URL никто не увидит.
        for (const view of fresh.values()) revokeBlobUrl(view.src ?? '');
        return;
      }
      for (const [id, view] of fresh) cache.set(id, view);
      setMedia(Object.fromEntries(cache));
    })();

    return () => {
      alive = false;
    };
  }, [store]);

  /* ── Освобождение blob-URL при размонтировании ───────────────────── */
  useEffect(
    () => () => {
      for (const view of mediaCacheRef.current.values()) revokeBlobUrl(view.src ?? '');
      mediaCacheRef.current.clear();
    },
    [],
  );

  /* ── «Удалить все файлы» подтверждается только в списке ──────────── */
  // В редакторе кнопки нет; но если подтверждение было «взведено» и открыть
  // заметку, оно не должно ждать там одним случайным тапом.
  useEffect(() => {
    if (editor) setConfirmClearMedia(false);
  }, [editor]);

  /* ── Смена фильтра снимает «взведённое» удаление ──────────────────── */
  // Иначе скрытая фильтром заметка остаётся с подтверждением, и после
  // сброса первый же тап по «Удалить» стирает её без второго шага.
  useEffect(() => {
    setConfirmDeleteId(null);
    setConfirmPurgeId(null);
    setConfirmPurgeTrash(false);
    setConfirmClearMedia(false);
  }, [query, athleteFilter, tagFilter, viewMode]);

  /* ── Esc закрывает просмотр фото (клавиатура/desktop) ─────────────── */
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer]);

  /* ── Уборка сирот, постоянное хранилище, нативные возможности ─────── */
  useEffect(() => {
    void cleanupNoteMedia(new Set(store.items.flatMap((n) => noteAttachmentIds(n))));
    // Без persist ОС вправе вычистить IndexedDB под давлением квоты — тогда
    // фото и голос исчезли бы «сами».
    void ensurePersistentStorage();
    void noteMediaTotalBytes().then((n) => setMediaTotal(n));
    let alive = true;
    void speechSupport().then((next) => {
      if (!alive) return;
      setSpeech((prev) => (prev.dictation === next.dictation && prev.speak === next.speak ? prev : next));
    });
    return () => {
      alive = false;
    };
    // Только на маунте: дальше чистим точечно после сохранения/удаления.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Остановка записи/диктовки/озвучки при уходе с вкладки ───────── */
  useEffect(
    () => () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (recAutoStopRef.current) clearTimeout(recAutoStopRef.current);
      discardRecordingRef.current = true;
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      try {
        dictationRef.current?.stop();
      } catch {
        /* ignore */
      }
      // Нативная диктовка/озвучка живут в системе — их тоже гасим, иначе
      // телефон продолжит слушать или говорить после закрытия вкладки.
      stopAllSpeech();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    [],
  );

  const openNew = () => {
    setEditor({ ...EMPTY_EDITOR, attachments: [] });
    // Подтверждение удаления, «взведённое» на другой заметке, не должно
    // переехать на новую форму и ждать там случайного тапа.
    setConfirmDeleteId(null);
    setError(null);
    setVoiceError(null);
  };

  const openEdit = (n: CoachNote) => {
    const attachments: DraftAttachment[] = noteAttachments(n).map((a) => {
      const view = media[a.id];
      return {
        ...a,
        previewUrl: view?.src ?? '',
        pending: false,
      };
    });
    setEditor({
      id: n.id,
      title: n.title,
      body: n.body,
      athleteId: n.athleteId ?? '',
      pinned: n.pinned,
      tagsText: noteTags(n).join(', '),
      checklist: (n.checklist ?? []).map((c) => ({ ...c })),
      attachments,
    });
    setError(null);
    setVoiceError(null);
    setConfirmDeleteId(null);
  };

  const closeEditor = () => {
    if (editor) {
      for (const a of editor.attachments) {
        if (a.pending) revokeBlobUrl(a.previewUrl);
      }
    }
    stopVoiceCapture();
    // Незавершённый старт диктовки не должен блокировать следующий редактор.
    dictationStartingRef.current = false;
    setEditor(null);
    setError(null);
    setVoiceError(null);
  };

  /* ── Запись голоса ────────────────────────────────────────────────── */

  const stopVoiceCapture = () => {
    discardRecordingRef.current = true;
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    try {
      dictationRef.current?.stop();
    } catch {
      /* ignore */
    }
    dictationRef.current = null;
    setInterim('');
    setDictation('idle');
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const clearRecTimers = () => {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (recAutoStopRef.current) {
      clearTimeout(recAutoStopRef.current);
      recAutoStopRef.current = null;
    }
  };

  const addDraftAttachment = (draft: DraftAttachment, limitMessage: string) => {
    if (!editor) {
      revokeBlobUrl(draft.previewUrl);
      return;
    }
    if (editor.attachments.length >= COACH_NOTE_ATTACHMENTS_MAX) {
      revokeBlobUrl(draft.previewUrl);
      setVoiceError(limitMessage);
      return;
    }
    setEditor((s) => (s ? { ...s, attachments: [...s.attachments, draft] } : s));
  };

  const addAudioBlob = async (blob: Blob, durationMs: number, name?: string) => {
    if (!blob || blob.size === 0) return;
    if (blob.size > COACH_NOTE_ATTACHMENT_BYTES_MAX) {
      setVoiceError(`Аудио больше ${formatBytes(COACH_NOTE_ATTACHMENT_BYTES_MAX)} — такое вложение не сохраняю.`);
      return;
    }
    // Место проверяем ДО записи: иначе файл молча не сохранится, а человек
    // узнает об этом только при следующем открытии заметки.
    if (!(await hasRoomForBytes(blob.size))) {
      setVoiceError(
        'В хранилище телефона не хватает места под это аудио. Удалите лишние фото/записи и попробуйте снова.',
      );
      return;
    }
    const mime = blob.type && blob.type.startsWith('audio/') ? blob.type : 'audio/webm';
    const previewUrl = createObjectUrl(blob);
    addDraftAttachment(
      {
        id: newAttachmentId(),
        kind: 'audio',
        mime,
        size: blob.size,
        ...(durationMs > 0 ? { durationMs: Math.min(Math.round(durationMs), NOTE_AUDIO_MAX_MS) } : {}),
        ...(name ? { name: name.slice(0, 120) } : {}),
        createdAt: new Date().toISOString(),
        previewUrl,
        pending: true,
        blob,
      },
      `К заметке можно приложить не больше ${COACH_NOTE_ATTACHMENTS_MAX} файлов.`,
    );
  };

  const startRecording = async () => {
    setVoiceError(null);
    if (!editor) return;
    if (!isVoiceRecordingSupported()) {
      setVoiceError(
        'Микрофон приложению здесь недоступен. Приложите аудиофайл (кнопка «Аудиофайл») — запись диктофона тоже подойдёт.',
      );
      voiceInputRef.current?.click();
      return;
    }
    setVoiceBusy(true);
    discardRecordingRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = recordingMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        clearRecTimers();
        stopTracks();
        recorderRef.current = null;
        const discarded = discardRecordingRef.current;
        discardRecordingRef.current = false;
        const durationMs = Math.min(Date.now() - recStartedRef.current, NOTE_AUDIO_MAX_MS);
        const type = recorder.mimeType || recordingMime() || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        setRecording(false);
        setRecordingMs(0);
        // Редактор закрыли/сохранили, пока шла запись — голос уже не к чему крепить.
        if (discarded) return;
        void addAudioBlob(blob, durationMs);
      };
      recStartedRef.current = Date.now();
      recorder.start(1000);
      setRecording(true);
      setRecordingMs(0);
      recTimerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - recStartedRef.current);
      }, 500);
      recAutoStopRef.current = setTimeout(() => {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }, NOTE_AUDIO_MAX_MS);
      setVoiceBusy(false);
    } catch {
      setVoiceBusy(false);
      stopTracks();
      setVoiceError(
        'Микрофон не открылся: система не дала доступ. Можно приложить аудиофайл системного диктофона — кнопка «Аудиофайл».',
      );
      voiceInputRef.current?.click();
    }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
  };

  const toggleVoice = () => {
    if (recording) {
      stopRecording();
      return;
    }
    void startRecording();
  };

  /* ── Аудиофайл / фото ─────────────────────────────────────────────── */

  const handleAudioFile = async (file: File | null) => {
    if (!file) return;
    setVoiceError(null);
    if (file.size > COACH_NOTE_ATTACHMENT_BYTES_MAX) {
      setVoiceError(`Файл больше ${formatBytes(COACH_NOTE_ATTACHMENT_BYTES_MAX)} — не сохраняю.`);
      return;
    }
    const durationMs = await probeAudioDurationMs(file);
    await addAudioBlob(file, durationMs, file.name);
  };

  const handleVoiceInput = (input: HTMLInputElement) => {
    const file = input.files?.[0] ?? null;
    if (file) void handleAudioFile(file);
    input.value = '';
  };

  const addPhoto = async () => {
    if (!editor) return;
    setVoiceError(null);
    setVoiceBusy(true);
    try {
      const picked = await pickPhoto();
      if (!picked || !picked.uri) {
        setVoiceBusy(false);
        return;
      }
      const compressed = await compressPhotoDataUrl(picked.uri);
      const dataUrl = compressed ?? picked.uri;
      if (!dataUrl.startsWith('data:image/')) {
        setVoiceError('Фото не удалось прочитать — попробуйте другое.');
        setVoiceBusy(false);
        return;
      }
      // Храним байты, а не base64-строку: строка в IndexedDB — это +33 %
      // объёма и лишняя мегабайтная копия в памяти WebView.
      const decoded = dataUrlToBytes(dataUrl);
      if (!decoded || decoded.length === 0) {
        setVoiceError('Фото не удалось прочитать — попробуйте другое.');
        setVoiceBusy(false);
        return;
      }
      const size = decoded.byteLength;
      if (size > COACH_NOTE_ATTACHMENT_BYTES_MAX) {
        setVoiceError(`Фото больше ${formatBytes(COACH_NOTE_ATTACHMENT_BYTES_MAX)} даже после сжатия — не сохраняю.`);
        setVoiceBusy(false);
        return;
      }
      if (!(await hasRoomForBytes(size))) {
        setVoiceError(
          'В хранилище телефона не хватает места под это фото. Удалите лишние вложения и попробуйте снова.',
        );
        setVoiceBusy(false);
        return;
      }
      addDraftAttachment(
        {
          id: newAttachmentId(),
          kind: 'photo',
          mime: dataUrlMime(dataUrl),
          size,
          createdAt: new Date().toISOString(),
          previewUrl: dataUrl,
          pending: true,
          bytes: decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength) as ArrayBuffer,
        },
        `К заметке можно приложить не больше ${COACH_NOTE_ATTACHMENTS_MAX} файлов.`,
      );
    } finally {
      setVoiceBusy(false);
    }
  };

  const removeDraftAttachment = (id: string) => {
    setEditor((s) => {
      if (!s) return s;
      const target = s.attachments.find((a) => a.id === id);
      if (target?.pending) revokeBlobUrl(target.previewUrl);
      return { ...s, attachments: s.attachments.filter((a) => a.id !== id) };
    });
  };

  /* ── Речь в текст ─────────────────────────────────────────────────── */

  const toggleDictation = () => {
    setVoiceError(null);
    setMicSettingsNeeded(false);
    if (dictation === 'listening') {
      // Гасим состояние сразу, а не ждём recognitionEnd: нативная остановка
      // может не прислать событие (мы снимаем подписки) — и «Слушаю» залипло бы.
      dictationRef.current?.stop();
      dictationRef.current = null;
      setInterim('');
      setDictation('idle');
      return;
    }
    if (dictationStartingRef.current) return;
    dictationStartingRef.current = true;
    // Видимая реакция на тап: раньше кнопка молчала, пока шёл асинхронный старт
    // (разрешение микрофона, запрос к движку), и «ничего не происходит» было
    // буквально правдой.
    setDictation('starting');

    let settled = false;
    const watchdog = setTimeout(() => {
      if (settled) return;
      settled = true;
      dictationStartingRef.current = false;
      setDictation('error');
      setMicSettingsNeeded(true);
      setVoiceError(
        'Распознавание не запустилось за 30 секунд: микрофон не подтвердил запуск. Проверьте разрешение и нажмите ещё раз.',
      );
    }, DICTATION_START_TIMEOUT_MS);

    void (async () => {
      // Причина отказа может прийти из движка ДО возврата null — тогда не
      // затираем её общим «не подключено».
      let reported = false;
      const session = await startDictation({
        lang: 'ru-RU',
        onText: (text, final) => {
          // Промежуточную гипотезу показываем отдельной строкой: писать её в
          // текст заметки нельзя — она меняется на лету и дублировалась бы.
          if (!final) {
            setInterim(text);
            return;
          }
          setInterim('');
          setEditor((s) => {
            if (!s) return s;
            const base = s.body.trimEnd();
            const body = base ? `${base} ${text}` : text;
            return { ...s, body: body.slice(0, COACH_NOTE_BODY_MAX) };
          });
        },
        onError: (message) => {
          reported = true;
          setDictation('error');
          setVoiceError(message);
        },
        onErrorCode: (code) => {
          // Разрешение выдаётся только в настройках Android — предлагаем путь.
          if (MIC_PERMISSION_CODES.has(code)) setMicSettingsNeeded(true);
        },
        onEnd: () => {
          dictationRef.current = null;
          setInterim('');
          setDictation('idle');
        },
      });
      clearTimeout(watchdog);
      dictationStartingRef.current = false;
      if (settled) {
        // Старт опоздал: watchdog уже сказал «не вышло» — микрофон не оставляем.
        session?.stop();
        return;
      }
      settled = true;
      if (!session) {
        if (!reported) {
          setDictation('error');
          setVoiceError(
            'Речь в текст здесь недоступна: распознавание речи не подключено — нет ни системного движка, ни поддержки в браузере. Голос можно записать и приложить к заметке.',
          );
        }
        return;
      }
      dictationRef.current = session;
      setDictation('listening');
    })();
  };

  /* ── Текст в речь ─────────────────────────────────────────────────── */

  const toggleSpeak = (note: CoachNote) => {
    if (speakingId === note.id) {
      // Номер меняем ДО остановки: поздний onEnd уже не должен ничего гасить.
      speakSeqRef.current += 1;
      stopSpeakingBest();
      setSpeakingId(null);
      return;
    }
    const text = [note.title, note.body].filter(Boolean).join('. ');
    const seq = (speakSeqRef.current += 1);
    // Ставим сразу, а не после ответа движка: иначе короткая фраза успевает
    // закончиться раньше, чем кнопка станет «Стоп», и залипает навсегда.
    setSpeakingId(note.id);
    void speakTextBest(text, {
      onEnd: () => {
        if (speakSeqRef.current === seq) setSpeakingId(null);
      },
    }).then((ok) => {
      if (ok || speakSeqRef.current !== seq) return;
      setSpeakingId(null);
      setVoiceError('Озвучка недоступна в этом приложении — голосового движка нет.');
    });
  };

  /* ── Сохранение ───────────────────────────────────────────────────── */

  const trimmedChecklist = (draft: EditorState): CoachNoteChecklistItem[] =>
    draft.checklist.map((c) => ({ ...c, text: c.text.trim() })).filter((c) => c.text.length > 0);

  const strippedAttachments = (draft: EditorState): CoachNoteAttachment[] =>
    draft.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      mime: a.mime,
      size: a.size,
      ...(a.durationMs ? { durationMs: a.durationMs } : {}),
      ...(a.name ? { name: a.name } : {}),
      createdAt: a.createdAt,
    }));

  const commitSave = (draft: EditorState, noteId: string, attachments: CoachNoteAttachment[]): boolean => {
    const payload = {
      title: draft.title,
      body: draft.body,
      athleteId: draft.athleteId || null,
      pinned: draft.pinned,
      checklist: trimmedChecklist(draft),
      attachments,
      // Теги разбираются тем же правилом, что и движок: `#`, дубли и хвосты
      // сверх лимита не должны доезжать до сохранения незаметно.
      tags: parseTagsText(draft.tagsText),
    };
    if (draft.id) {
      const next = updateCoachNote(store, draft.id, payload);
      if (next === store) {
        setError('Пустая заметка не сохраняется — заполните заголовок, текст или приложите фото/аудио.');
        return false;
      }
      apply(next);
    } else {
      const res = addCoachNote(store, payload, { id: noteId });
      if (res.error === 'empty') {
        setError('Пустая заметка не сохраняется — заполните заголовок, текст или приложите фото/аудио.');
        return false;
      }
      if (res.error === 'limit') {
        setError(
          `Лимит ${COACH_NOTES_MAX} заметок. Удалите неактуальные — движок не стирает ваши заметки автоматически.`,
        );
        return false;
      }
      apply(res.store);
    }
    setEditor(null);
    setError(null);
    setVoiceError(null);
    stopVoiceCapture();
    return true;
  };

  const save = () => {
    if (!editor) return;
    const draft = editor;
    const noteId = draft.id ?? `n_${Date.now().toString(36)}_${store.items.length + 1}`;
    const attachments = strippedAttachments(draft);
    const pending = draft.attachments.filter((a) => a.pending && (a.blob || a.bytes));

    const writeMedia = async (): Promise<boolean> => {
      const records: NoteMediaRecord[] = pending.map((a) => ({
        id: a.id,
        noteId,
        kind: a.kind,
        mime: a.mime,
        size: a.size,
        ...(a.durationMs ? { durationMs: a.durationMs } : {}),
        ...(a.name ? { name: a.name } : {}),
        createdAt: Date.now(),
        ...(a.bytes ? { bytes: a.bytes } : { blob: a.blob as Blob }),
      }));
      const ok = records.length ? await saveNoteMediaMany(records) : true;
      if (!ok) {
        setError('Не хватило места в хранилище — вложение не сохранено. Удалите лишние фото/аудио и попробуйте снова.');
        return false;
      }
      return true;
    };

    if (pending.length === 0) {
      if (commitSave(draft, noteId, attachments)) refreshMediaTotal();
      return;
    }
    void (async () => {
      // Место под всю пачку — до записи, а не «по факту не сохранилось».
      const need = pending.reduce((sum, a) => sum + (Number.isFinite(a.size) ? a.size : 0), 0);
      if (!(await hasRoomForBytes(need))) {
        setError(
          `В хранилище телефона не хватает места: нужно ${formatBytes(need)}. Удалите лишние вложения и попробуйте снова.`,
        );
        return;
      }
      const ok = await writeMedia();
      if (!ok) return;
      const saved = commitSave(draft, noteId, attachments);
      if (!saved) {
        // Заметка не сохранилась (стала пустой) — только что записанные файлы
        // не должны остаться сиротами в квоте.
        void deleteNoteMedia(pending.map((a) => a.id));
        refreshMediaTotal();
        return;
      }
      for (const a of draft.attachments) {
        if (a.pending) revokeBlobUrl(a.previewUrl);
      }
      const keep = new Set(
        // Заметку, которую только что сохранили, считаем по новому набору:
        // убранные вложения не должны попасть в «нужное» (иначе файл повиснет).
        store.items.filter((n) => n.id !== noteId).flatMap((n) => noteAttachmentIds(n)),
      );
      for (const a of attachments) keep.add(a.id);
      void cleanupNoteMedia(keep);
      refreshMediaTotal();
    })();
  };

  /**
   * Удаление — в корзину, а не навсегда: файлы и текст остаются, пока заметку
   * не удалят окончательно из корзины. Первый тап — подтверждение.
   */
  const askDelete = (id: string) => {
    if (confirmDeleteId === id) {
      apply(trashCoachNote(store, id));
      setConfirmDeleteId(null);
      setNotice('Заметка в корзине — её можно вернуть.');
      if (editor?.id === id) closeEditor();
      return;
    }
    setConfirmDeleteId(id);
  };

  /** Вернуть заметку из корзины — текст, теги и файлы на месте. */
  const restoreFromTrash = (id: string) => {
    const next = restoreCoachNote(store, id);
    if (next === store) {
      // Движок не даст превысить лимит живых заметок — говорим об этом прямо.
      setNotice(`Лимит ${COACH_NOTES_MAX} живых заметок: освободите место и попробуйте снова.`);
      return;
    }
    apply(next);
    setConfirmPurgeId(null);
    setNotice('Заметка восстановлена.');
  };

  /** Окончательное удаление одной заметки — здесь и только здесь файлы стираются. */
  const purgeOne = (id: string) => {
    if (confirmPurgeId !== id) {
      setConfirmPurgeId(id);
      return;
    }
    apply(purgeCoachNote(store, id));
    void deleteNoteMediaForNote(id).then(refreshMediaTotal);
    setConfirmPurgeId(null);
    setNotice('Заметка удалена навсегда.');
  };

  /** Очистить корзину: удаляются все её заметки и их файлы. */
  const purgeTrash = () => {
    if (!confirmPurgeTrash) {
      setConfirmPurgeTrash(true);
      return;
    }
    const ids = store.items.filter((n) => isCoachNoteDeleted(n)).map((n) => n.id);
    apply(purgeCoachTrash(store));
    setConfirmPurgeTrash(false);
    setConfirmPurgeId(null);
    setNotice('Корзина очищена.');
    void Promise.all(ids.map((id) => deleteNoteMediaForNote(id))).then(refreshMediaTotal);
  };

  /**
   * Стереть файлы ВСЕХ заметок: текст и сами заметки остаются. Действие необратимое
   * (корзины нет), поэтому подтверждение двумя шагами — как у удаления заметки.
   */
  const askClearMedia = () => {
    if (!confirmClearMedia) {
      setConfirmClearMedia(true);
      return;
    }
    setConfirmClearMedia(false);
    void (async () => {
      await deleteAllNoteMedia();
      const cleaned = store.items.map((n) => (noteAttachments(n).length > 0 ? { ...n, attachments: [] } : n));
      apply({ ...store, items: cleaned });
      // Кэш держал файлы в памяти и в blob-URL — отпускаем сразу, а не ждём mount.
      for (const view of mediaCacheRef.current.values()) revokeBlobUrl(view.src ?? '');
      mediaCacheRef.current.clear();
      setMedia({});
      setViewer(null);
      setShareNote(null);
      setMediaTotal(0);
      refreshMediaTotal();
    })();
  };

  /** Поделиться/сохранить вложение: сохраняется в «Документы» и в шаринг. */
  const shareAttachment = (att: CoachNoteAttachment) => {
    setVoiceError(null);
    setShareNote('Готовлю файл…');
    void (async () => {
      const rec = await getNoteMedia(att.id);
      const blob = await noteMediaPayload(rec);
      if (!blob) {
        setShareNote(null);
        setVoiceError('Файл не найден в хранилище — поделиться нечем.');
        return;
      }
      const base = (att.name ?? `note-${att.id}`).replace(/\.[^.]+$/, '').slice(0, 60) || 'note-file';
      const outcome = await saveBlobApk(`${base}.${extensionForMime(att.mime)}`, blob);
      setShareNote(shareOutcomeLabel(outcome));
    })();
  };

  // Поиск/фильтр — «честные»: видно, сколько скрыто, и есть чем вернуть всё.
  const queryText = query.trim();
  const filtersActive = queryText.length > 0 || athleteFilter !== 'all' || tagFilter !== 'all';
  // Пустые строки чек-листа не сохраняются, поэтому лимит считаем по заполненным:
  // иначе кнопка «+ Пункт» запрещала бы добавление из-за черновиков.
  const checklistUsed = editor ? editor.checklist.filter((c) => c.text.trim().length > 0).length : 0;
  const checklistFull = checklistUsed >= COACH_NOTE_CHECKLIST_MAX;
  const attachmentsFull = editor ? editor.attachments.length >= COACH_NOTE_ATTACHMENTS_MAX : false;
  const editorTags = editor ? parseTagsText(editor.tagsText) : [];
  const tagsFull = editorTags.length >= COACH_NOTE_TAGS_MAX;
  const notesAtLimit = liveCount >= COACH_NOTES_MAX;
  const resetFilters = () => {
    setQuery('');
    setAthleteFilter('all');
    setTagFilter('all');
  };
  const emptyHint = (): string => {
    if (viewMode === 'trash') {
      if (queryText) return `В корзине ничего не найдено по запросу «${queryText}».`;
      if (tagFilter !== 'all') return `В корзине нет заметок с тегом «${tagFilter}».`;
      return 'Корзина пуста. Удалённые заметки попадают сюда и хранятся, пока вы не очистите корзину.';
    }
    if (queryText && athleteFilter !== 'all') {
      return `Ничего не найдено по запросу «${queryText}» среди заметок выбранного фильтра.`;
    }
    if (queryText) {
      return `Ничего не найдено по запросу «${queryText}». Поиск идёт по заголовку, тексту, пунктам чек-листа и тегам.`;
    }
    if (tagFilter !== 'all') return `Заметок с тегом «${tagFilter}» нет.`;
    if (liveCount === 0 && trashCount > 0) {
      return 'Все заметки сейчас в корзине — откройте «Корзина» и восстановите нужные.';
    }
    if (athleteFilter === 'none') return 'Общих заметок без атлета пока нет.';
    if (athleteFilter !== 'all') return 'У выбранного атлета заметок пока нет.';
    return 'Заметок пока нет. Добавьте первую — она останется на этом устройстве.';
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
                {liveCount} из {COACH_NOTES_MAX}
                {trashCount > 0 ? ` · в корзине ${trashCount}` : ''}
                {mediaTotal > 0 ? ` · файлы ${formatBytes(mediaTotal)}` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={openNew}
            data-notes="new"
            disabled={notesAtLimit}
            aria-disabled={notesAtLimit}
            style={{
              ...btn('primary'),
              opacity: notesAtLimit ? 0.5 : 1,
              cursor: notesAtLimit ? 'not-allowed' : 'pointer',
            }}
          >
            + Новая заметка
          </button>
        </div>
        {notesAtLimit && (
          <div
            data-notes="limit-hint"
            role="status"
            style={{ marginTop: 8, fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.5 }}
          >
            Достигнут лимит {COACH_NOTES_MAX} заметок: новые не сохранятся, пока не освободите место. Удалённые заметки
            лежат в корзине и место не освобождают — очистите корзину, если они больше не нужны.
          </div>
        )}

        {mediaTotal > 0 && (
          <div
            data-notes="media-total"
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}
          >
            <span style={{ fontSize: 11.5, color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
              Файлы занимают {formatBytes(mediaTotal)} (заметок с файлами, кроме корзины: {notesWithMedia}).
            </span>
            {/* В редакторе файлы «в работе» — уборку там не предлагаем, чтобы не
                оставить в заметке ссылки на уже удалённое. */}
            {!editor && (
              <button
                type="button"
                onClick={askClearMedia}
                data-notes="clear-media"
                style={{ ...btn(confirmClearMedia ? 'danger' : 'ghost'), fontSize: 11.5 }}
              >
                {confirmClearMedia ? 'Точно удалить все файлы?' : 'Удалить все вложения'}
              </button>
            )}
            {!editor && confirmClearMedia && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmClearMedia(false)}
                  data-notes="clear-media-cancel"
                  style={{ ...btn('ghost'), fontSize: 11.5 }}
                >
                  Отмена
                </button>
                <span data-notes="clear-media-hint" style={{ fontSize: 11, color: colors.textSubtle }}>
                  Заметки и текст останутся, файлы удалятся навсегда.
                </span>
              </>
            )}
          </div>
        )}

        {/* Два списка, как в TickTick: живые заметки и корзина. */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setViewMode('active')}
            data-notes="view"
            data-view="active"
            aria-pressed={viewMode === 'active'}
            style={{ ...btn(viewMode === 'active' ? 'primary' : 'ghost'), fontSize: 12 }}
          >
            Заметки · {liveCount}
          </button>
          <button
            type="button"
            onClick={() => {
              // Теги живых заметок в корзине не фильтруют — иначе список
              // выглядел бы пустым без видимой причины.
              setTagFilter('all');
              setViewMode('trash');
            }}
            data-notes="view"
            data-view="trash"
            aria-pressed={viewMode === 'trash'}
            style={{ ...btn(viewMode === 'trash' ? 'primary' : 'ghost'), fontSize: 12 }}
          >
            Корзина · {trashCount}
          </button>
          <select
            value={sortBy}
            onChange={(e) => {
              const next = e.target.value as CoachNoteSort;
              setSortBy(next);
              writeStoredSort(next);
            }}
            aria-label="Сортировка заметок"
            data-notes="sort"
            style={{ ...inputStyle, width: 'auto', flex: '0 1 200px', marginLeft: 'auto' }}
          >
            <option value="updated">Сначала изменённые</option>
            <option value="created">Сначала новые</option>
            <option value="title">По заголовку (А–Я)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={viewMode === 'trash' ? 'Поиск по корзине' : 'Поиск по заметкам'}
            aria-label="Поиск по заметкам"
            data-notes="search"
            style={{ ...inputStyle, flex: '1 1 170px', width: 'auto' }}
          />
          {athletes.length > 0 && (
            <select
              value={athleteFilter}
              onChange={(e) => setAthleteFilter(e.target.value)}
              aria-label="Фильтр по атлету"
              data-notes="filter"
              style={{ ...inputStyle, width: 'auto', flex: '0 1 190px' }}
            >
              <option value="all">Все атлеты</option>
              <option value="none">Без атлета</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {tagSummary.length > 0 && viewMode === 'active' && (
          <div
            data-notes="tag-list"
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}
          >
            <span style={{ fontSize: 10.5, color: colors.textSubtle }}>Теги:</span>
            <button
              type="button"
              onClick={() => setTagFilter('all')}
              data-notes="tag-chip"
              data-tag="all"
              aria-pressed={tagFilter === 'all'}
              style={{
                minHeight: 44,
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                border: `1px solid ${tagFilter === 'all' ? withAlpha(AMBER, '88') : 'rgba(255,255,255,0.14)'}`,
                background: tagFilter === 'all' ? withAlpha(AMBER, '26') : 'rgba(255,255,255,0.05)',
                color: tagFilter === 'all' ? AMBER : 'rgba(255,255,255,0.82)',
              }}
            >
              Все
            </button>
            {tagSummary.map(({ tag, count }) => {
              const active = tagFilter.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(active ? 'all' : tag)}
                  data-notes="tag-chip"
                  data-tag={tag}
                  aria-pressed={active}
                  style={{
                    minHeight: 44,
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: `1px solid ${active ? withAlpha(AMBER, '88') : 'rgba(255,255,255,0.14)'}`,
                    background: active ? withAlpha(AMBER, '26') : 'rgba(255,255,255,0.05)',
                    color: active ? AMBER : 'rgba(255,255,255,0.82)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  #{tag}
                  {count > 1 ? ` · ${count}` : ''}
                </button>
              );
            })}
          </div>
        )}
        {filtersActive && (
          <div
            data-notes="filter-status"
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 8,
              fontSize: 11.5,
              color: colors.textSubtle,
            }}
          >
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              Показано {visible.length} из {viewTotal}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              data-notes="filter-reset"
              style={{ ...btn('ghost'), minHeight: 34, padding: '4px 10px', fontSize: 11.5 }}
            >
              Сбросить фильтры
            </button>
          </div>
        )}
        {viewMode === 'trash' && trashCount > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            <button
              type="button"
              onClick={purgeTrash}
              data-notes="purge-trash"
              style={{ ...btn(confirmPurgeTrash ? 'danger' : 'ghost'), fontSize: 11.5 }}
            >
              {confirmPurgeTrash ? 'Точно очистить корзину?' : `Очистить корзину (${trashCount})`}
            </button>
            {confirmPurgeTrash && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmPurgeTrash(false)}
                  data-notes="purge-cancel"
                  style={{ ...btn('ghost'), fontSize: 11.5 }}
                >
                  Отмена
                </button>
                <span data-notes="purge-hint" style={{ fontSize: 11, color: colors.textSubtle }}>
                  Все заметки из корзины и их файлы удалятся навсегда.
                </span>
              </>
            )}
          </div>
        )}
        {!filtersActive && (
          <div
            data-notes="search-scope"
            style={{ marginTop: 8, fontSize: 11, color: colors.textSubtle, lineHeight: 1.45 }}
          >
            {viewMode === 'trash'
              ? 'Здесь лежат удалённые заметки: их можно вернуть, текст и файлы сохраняются до окончательного удаления.'
              : 'Поиск идёт по заголовку, тексту, пунктам чек-листа и тегам; имена файлов не ищутся.'}
          </div>
        )}
      </div>

      {editor && (
        <div style={cardStyle} data-notes="editor">
          <div style={{ fontSize: 12, fontWeight: 800, color: colors.textMuted, marginBottom: 10 }}>
            {editor.id ? 'Правка заметки' : 'Новая заметка'}
          </div>
          <label
            style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: colors.textMuted, marginBottom: 5 }}
            htmlFor="note-title"
          >
            Заголовок
          </label>
          <input
            id="note-title"
            value={editor.title}
            maxLength={COACH_NOTE_TITLE_MAX}
            onChange={(e) => setEditor((s) => (s ? { ...s, title: e.target.value } : s))}
            placeholder="Коротко: о чём заметка"
            style={inputStyle}
            data-notes="title"
          />
          <div
            data-notes="title-count"
            style={{
              marginTop: 4,
              textAlign: 'right',
              fontSize: 10.5,
              color: editor.title.length >= COACH_NOTE_TITLE_MAX ? colors.danger : colors.textSubtle,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {editor.title.length}/{COACH_NOTE_TITLE_MAX}
          </div>
          <label
            style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: colors.textMuted, margin: '10px 0 5px' }}
            htmlFor="note-body"
          >
            Текст
          </label>
          <textarea
            id="note-body"
            value={editor.body}
            maxLength={COACH_NOTE_BODY_MAX}
            onChange={(e) => setEditor((s) => (s ? { ...s, body: e.target.value } : s))}
            rows={5}
            placeholder="Контекст, ограничения, договорённости"
            style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
            data-notes="body"
          />
          <div
            data-notes="body-count"
            style={{
              marginTop: 4,
              textAlign: 'right',
              fontSize: 10.5,
              color: editor.body.length >= COACH_NOTE_BODY_MAX ? colors.danger : colors.textSubtle,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {editor.body.length}/{COACH_NOTE_BODY_MAX}
          </div>

          <label
            style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: colors.textMuted, margin: '10px 0 5px' }}
            htmlFor="note-tags"
          >
            Теги{' '}
            <span
              data-notes="tags-count"
              style={{
                fontWeight: 600,
                color: tagsFull ? colors.danger : colors.textSubtle,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {editorTags.length}/{COACH_NOTE_TAGS_MAX}
            </span>
          </label>
          <input
            id="note-tags"
            value={editor.tagsText}
            onChange={(e) => setEditor((s) => (s ? { ...s, tagsText: e.target.value } : s))}
            placeholder="Через запятую: колено, ферритин"
            aria-label="Теги заметки через запятую"
            data-notes="editor-tags"
            style={inputStyle}
          />
          {editorTags.length > 0 && (
            <div
              data-notes="editor-tag-list"
              style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}
            >
              {editorTags.map((tag) => (
                <span
                  key={tag}
                  data-notes="note-tag"
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: `1px solid ${withAlpha(AMBER, '59')}`,
                    background: withAlpha(AMBER, '1f'),
                    color: AMBER,
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {tagsFull && (
            <div
              data-notes="tags-limit"
              style={{ marginTop: 6, fontSize: 11, color: colors.textSubtle, lineHeight: 1.45 }}
            >
              Больше {COACH_NOTE_TAGS_MAX} тегов не сохранится: лишние отбрасываются. Удалите ненужный тег, чтобы
              добавить новый.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => void addPhoto()}
              disabled={voiceBusy || attachmentsFull}
              aria-disabled={voiceBusy || attachmentsFull}
              data-notes="add-photo"
              style={{
                ...btn('ghost'),
                fontSize: 12,
                opacity: voiceBusy || attachmentsFull ? 0.5 : 1,
                cursor: voiceBusy || attachmentsFull ? 'not-allowed' : 'pointer',
              }}
            >
              Фото
            </button>
            <button
              type="button"
              onClick={toggleVoice}
              disabled={attachmentsFull && !recording}
              aria-disabled={attachmentsFull && !recording}
              data-notes="add-voice"
              data-recording={recording}
              style={{
                ...btn('ghost'),
                fontSize: 12,
                opacity: attachmentsFull && !recording ? 0.5 : 1,
                ...(recording
                  ? { borderColor: 'rgba(239,68,68,0.55)', color: '#fca5a5', background: 'rgba(239,68,68,0.14)' }
                  : {}),
              }}
            >
              {recording ? `Стоп · ${formatDuration(recordingMs)}` : 'Записать голос'}
            </button>
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              disabled={attachmentsFull}
              aria-disabled={attachmentsFull}
              data-notes="add-audio-file"
              style={{
                ...btn('ghost'),
                fontSize: 12,
                opacity: attachmentsFull ? 0.5 : 1,
                cursor: attachmentsFull ? 'not-allowed' : 'pointer',
              }}
            >
              Аудиофайл
            </button>
            <button
              type="button"
              onClick={toggleDictation}
              data-notes="dictate"
              data-dictation={dictation}
              style={{ ...btn('ghost'), fontSize: 12, opacity: dictationSupported ? 1 : 0.55 }}
              aria-busy={dictation === 'starting'}
            >
              {dictation === 'starting'
                ? 'Запускаю микрофон…'
                : dictation === 'listening'
                  ? 'Стоп диктовку'
                  : 'Голос в текст'}
            </button>
          </div>
          {attachmentsFull && (
            <div
              data-notes="attach-limit"
              style={{ marginTop: 8, fontSize: 11, color: colors.textSubtle, lineHeight: 1.45 }}
            >
              Достигнут лимит — {COACH_NOTE_ATTACHMENTS_MAX} файлов на заметку. Уберите один, чтобы добавить другой.
            </div>
          )}

          {/* Что именно услышит кнопка и слышит ли она сейчас — видно без логов.
              Нажатие сразу меняет эту строку: «ничего не происходит» больше
              невозможно, даже если ответ движка запаздывает. */}
          {dictationSupported && (
            <div
              data-notes="speech-source"
              style={{
                marginTop: 8,
                fontSize: 11.5,
                color: dictation === 'starting' ? AMBER : colors.textSubtle,
                lineHeight: 1.5,
              }}
            >
              {dictation === 'starting'
                ? 'Запрашиваю доступ к микрофону…'
                : `Распознавание: ${speech.dictation === 'native' ? 'системный движок телефона' : 'сервис браузера'}`}
            </div>
          )}

          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            aria-label="Аудиофайл к заметке"
            data-notes="audio-input"
            style={{ display: 'none' }}
            onChange={(e) => {
              void handleAudioFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          {/* APK: системный диктофон/Camera-UI. getUserMedia в WebView обычно
              заблокирован — это рабочий путь записи голоса. */}
          <input
            ref={voiceInputRef}
            type="file"
            accept="audio/*"
            capture
            aria-label="Записать голос диктофоном"
            data-notes="voice-record-input"
            style={{ display: 'none' }}
            onChange={(e) => handleVoiceInput(e.currentTarget)}
          />

          {!dictationSupported && (
            <div
              data-notes="dictation-hint"
              style={{ marginTop: 8, fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.5 }}
            >
              Речь в текст здесь недоступна. Голос можно записать и приложить к заметке — расшифровка останется за вами.
            </div>
          )}

          {interim && (
            <div data-notes="dictation-interim" style={{ marginTop: 8, fontSize: 11.5, color: AMBER, lineHeight: 1.5 }}>
              Слышу: {interim}
            </div>
          )}

          {editor.attachments.length > 0 && (
            <div data-notes="attach-list" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {editor.attachments.map((a) => (
                <div
                  key={a.id}
                  data-notes="attach-item"
                  data-kind={a.kind}
                  style={{
                    position: 'relative',
                    padding: 6,
                    paddingRight: 30,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    maxWidth: 240,
                  }}
                >
                  {a.kind === 'photo' ? (
                    draftPreview(a) ? (
                      <img
                        src={draftPreview(a)}
                        alt={a.name ?? 'Фото заметки'}
                        style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                      />
                    ) : (
                      <div style={{ fontSize: 11.5, color: colors.textSubtle }}>Фото загружается…</div>
                    )
                  ) : draftPreview(a) ? (
                    <div>
                      <div style={{ fontSize: 11, color: colors.textSubtle, marginBottom: 4 }}>
                        Аудио {a.durationMs ? formatDuration(a.durationMs) : ''}
                      </div>
                      <audio src={draftPreview(a)} controls preload="metadata" style={{ maxWidth: 190, height: 34 }} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: colors.textSubtle }}>
                      Аудио {a.durationMs ? formatDuration(a.durationMs) : ''}
                    </div>
                  )}
                  <div
                    data-notes="attach-meta"
                    style={{
                      marginTop: 4,
                      fontSize: 10.5,
                      color: colors.textSubtle,
                      fontVariantNumeric: 'tabular-nums',
                      wordBreak: 'break-word',
                    }}
                  >
                    {a.name ?? (a.kind === 'photo' ? 'Фото' : 'Запись')} · {formatBytes(a.size)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDraftAttachment(a.id)}
                    aria-label="Убрать вложение"
                    data-notes="attach-remove"
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.16)',
                      background: 'rgba(0,0,0,0.45)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Честная граница: расшифровки уже записанного звука нет — только живая диктовка. */}
          {editor.attachments.some((a) => a.kind === 'audio') && (
            <div
              data-notes="audio-no-transcript"
              style={{ marginTop: 8, fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.5 }}
            >
              Расшифровать готовую запись нельзя: текст надиктовывается только вживую кнопкой «Голос в текст».
            </div>
          )}

          {voiceError && (
            <div
              role="alert"
              data-notes="voice-error"
              style={{ marginTop: 8, fontSize: 12, color: colors.textMuted, lineHeight: 1.5 }}
            >
              {voiceError}
            </div>
          )}

          {/* Только APK: в браузере системных настроек приложения нет, и кнопка
              была бы пустышкой. */}
          {micSettingsNeeded && speech.dictation === 'native' && (
            <button
              type="button"
              data-notes="mic-settings"
              onClick={() => {
                void openMicrophoneSettings();
              }}
              style={{ ...btn('ghost'), fontSize: 12, marginTop: 8 }}
            >
              Настройки микрофона
            </button>
          )}

          <label
            style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: colors.textMuted, margin: '12px 0 5px' }}
          >
            Чек-лист{' '}
            <span
              data-notes="checklist-count"
              style={{
                fontWeight: 600,
                color: checklistFull ? colors.danger : colors.textSubtle,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {checklistUsed}/{COACH_NOTE_CHECKLIST_MAX}
            </span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-notes="checklist-edit">
            {editor.checklist.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  value={c.text}
                  maxLength={COACH_NOTE_CHECKLIST_TEXT_MAX}
                  onChange={(e) =>
                    setEditor((s) =>
                      s
                        ? {
                            ...s,
                            checklist: s.checklist.map((x, xi) => (xi === i ? { ...x, text: e.target.value } : x)),
                          }
                        : s,
                    )
                  }
                  placeholder={`Пункт ${i + 1}`}
                  aria-label={`Пункт чек-листа ${i + 1}`}
                  data-notes="checklist-input"
                  style={{ ...inputStyle, flex: 1, minHeight: 38, padding: '7px 10px', fontSize: 12.5 }}
                />
                <button
                  type="button"
                  aria-label="Удалить пункт"
                  data-notes="checklist-remove"
                  onClick={() =>
                    setEditor((s) => (s ? { ...s, checklist: s.checklist.filter((_, xi) => xi !== i) } : s))
                  }
                  style={{ ...btn('ghost'), minHeight: 38, padding: '4px 10px', fontSize: 12 }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              data-notes="checklist-add"
              disabled={checklistFull}
              aria-disabled={checklistFull}
              onClick={() =>
                setEditor((s) =>
                  s
                    ? {
                        ...s,
                        checklist: [
                          ...s.checklist,
                          { id: `c_${Date.now().toString(36)}_${s.checklist.length + 1}`, text: '', done: false },
                        ],
                      }
                    : s,
                )
              }
              style={{
                ...btn('ghost'),
                alignSelf: 'flex-start',
                fontSize: 12,
                opacity: checklistFull ? 0.5 : 1,
                cursor: checklistFull ? 'not-allowed' : 'pointer',
              }}
            >
              + Пункт чек-листа
            </button>
            {checklistFull && (
              <div data-notes="checklist-limit" style={{ fontSize: 11, color: colors.textSubtle, lineHeight: 1.45 }}>
                Достигнут лимит — {COACH_NOTE_CHECKLIST_MAX} пунктов. Сверх лимита пункты не сохранятся.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {athletes.length > 0 && (
              <select
                value={editor.athleteId}
                onChange={(e) => setEditor((s) => (s ? { ...s, athleteId: e.target.value } : s))}
                aria-label="Атлет заметки"
                data-notes="athlete"
                style={{ ...inputStyle, width: 'auto', flex: '1 1 160px' }}
              >
                <option value="">Без атлета (общая)</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                cursor: 'pointer',
                fontSize: 12.5,
                color: colors.textMuted,
                padding: '0 4px',
              }}
            >
              <input
                type="checkbox"
                checked={editor.pinned}
                onChange={(e) => setEditor((s) => (s ? { ...s, pinned: e.target.checked } : s))}
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
            <button type="button" onClick={closeEditor} data-notes="cancel" style={btn('ghost')}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Ошибки шаринга/озвучки случаются и без открытого редактора — раньше
          они молчали, потому что блок ошибок жил только внутри формы. */}
      {!editor && voiceError && (
        <div
          role="alert"
          data-notes="voice-error"
          style={{ ...cardStyle, fontSize: 12, color: colors.textMuted, lineHeight: 1.5 }}
        >
          {voiceError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.length === 0 && (
          <div data-notes="empty" style={{ ...cardStyle, fontSize: 12.5, color: colors.textMuted, lineHeight: 1.5 }}>
            {viewMode === 'trash' || store.items.length > 0
              ? emptyHint()
              : 'Заметок пока нет. Сюда удобно писать то, что не влезает в дневники: травмы, ограничения, договорённости с атлетом.'}
            {store.items.length > 0 && filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                data-notes="empty-reset"
                style={{ ...btn('ghost'), minHeight: 36, marginTop: 10, fontSize: 11.5 }}
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        )}
        {visible.map((n) => {
          const athleteName = nameOf(n.athleteId);
          const isDeleting = confirmDeleteId === n.id;
          const isPurging = confirmPurgeId === n.id;
          // Живых уже 500 — восстанавливать некуда: движок не даст превысить лимит.
          const restoreBlocked = notesAtLimit;
          const attachments = noteAttachments(n);
          const attachBytes = attachmentsBytes(attachments);
          const photos = attachments.filter((a) => a.kind === 'photo');
          const audios = attachments.filter((a) => a.kind === 'audio');
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: '#fff',
                        lineHeight: 1.35,
                        wordBreak: 'break-word',
                        minWidth: 0,
                      }}
                    >
                      {n.title || n.body.split('\n')[0].slice(0, 80) || 'Заметка с вложением'}
                    </div>
                    {attachments.length > 0 && (
                      <span
                        data-notes="attach-badge"
                        title={`Вложений: ${attachments.length}${attachBytes > 0 ? ` · ${formatBytes(attachBytes)}` : ''}`}
                        style={{
                          fontSize: 10.5,
                          padding: '2px 7px',
                          borderRadius: 999,
                          border: `1px solid ${withAlpha(AMBER, '59')}`,
                          background: withAlpha(AMBER, '24'),
                          color: AMBER,
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        📎 {attachments.length}
                        {attachBytes > 0 ? ` · ${formatBytes(attachBytes)}` : ''}
                      </span>
                    )}
                  </div>
                  {n.body &&
                    (n.title || n.body.length > 80) &&
                    (() => {
                      const long = n.body.length > BODY_PREVIEW_CHARS;
                      const open = !long || expandedBodies[n.id] === true;
                      return (
                        <div data-notes="body-preview" data-expanded={open}>
                          <div
                            style={{
                              fontSize: 12.5,
                              color: 'rgba(255,255,255,0.72)',
                              marginTop: 5,
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {open ? n.body : `${n.body.slice(0, BODY_PREVIEW_CHARS).trimEnd()}…`}
                          </div>
                          {long && (
                            <button
                              type="button"
                              data-notes="body-more"
                              aria-expanded={open}
                              onClick={() => setExpandedBodies((prev) => ({ ...prev, [n.id]: !open }))}
                              style={{
                                ...btn('ghost'),
                                minHeight: 34,
                                marginTop: 6,
                                padding: '4px 10px',
                                fontSize: 11.5,
                              }}
                            >
                              {open ? 'Свернуть' : `Показать полностью (${n.body.length} символов)`}
                            </button>
                          )}
                        </div>
                      );
                    })()}

                  {attachments.length > 0 && (
                    <div
                      data-notes="attachments"
                      style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
                    >
                      <div style={{ fontSize: 10.5, color: colors.textSubtle }}>{attachmentSummary(attachments)}</div>
                      {photos.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {photos.map((a) => {
                            const view = media[a.id];
                            return view?.src ? (
                              <div key={a.id} style={{ position: 'relative', width: 88, height: 88 }}>
                                <button
                                  type="button"
                                  data-notes="photo"
                                  aria-label={a.name ? `Открыть фото: ${a.name}` : 'Открыть фото заметки'}
                                  onClick={() =>
                                    setViewer({ attachmentId: a.id, url: view.src as string, kind: 'photo' })
                                  }
                                  style={{
                                    padding: 0,
                                    width: '100%',
                                    height: '100%',
                                    border: '1px solid rgba(255,255,255,0.14)',
                                    borderRadius: 12,
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <img
                                    src={view.src}
                                    alt={a.name ?? 'Фото заметки'}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  />
                                </button>
                                <button
                                  type="button"
                                  data-notes="share"
                                  aria-label="Поделиться фото"
                                  onClick={() => shareAttachment(a)}
                                  style={{
                                    position: 'absolute',
                                    right: 3,
                                    bottom: 3,
                                    width: 26,
                                    height: 26,
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.18)',
                                    background: 'rgba(0,0,0,0.55)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    lineHeight: 1,
                                  }}
                                >
                                  ⤓
                                </button>
                              </div>
                            ) : (
                              <div
                                key={a.id}
                                data-notes="media-missing"
                                style={{
                                  fontSize: 11,
                                  color: colors.textSubtle,
                                  border: '1px dashed rgba(255,255,255,0.18)',
                                  borderRadius: 10,
                                  padding: '10px 12px',
                                }}
                              >
                                Фото не найдено в хранилище
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {audios.map((a) => {
                        const view = media[a.id];
                        return view?.src ? (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <audio
                              data-notes="audio-player"
                              src={view.src}
                              controls
                              preload="metadata"
                              style={{ flex: '1 1 220px', maxWidth: 320, height: 36 }}
                            />
                            <button
                              type="button"
                              data-notes="share"
                              aria-label="Поделиться аудио"
                              onClick={() => shareAttachment(a)}
                              style={{ ...btn('ghost'), minHeight: 34, padding: '4px 10px', fontSize: 11.5 }}
                            >
                              ⤓ Сохранить
                            </button>
                          </div>
                        ) : (
                          <div
                            key={a.id}
                            data-notes="media-missing"
                            style={{
                              fontSize: 11,
                              color: colors.textSubtle,
                              border: '1px dashed rgba(255,255,255,0.18)',
                              borderRadius: 10,
                              padding: '8px 12px',
                            }}
                          >
                            Аудио не найдено в хранилище (файл удалён)
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(n.checklist?.length ?? 0) > 0 &&
                    (() => {
                      const all = n.checklist ?? [];
                      const prog = noteChecklistProgress(n);
                      const open = all.length <= CHECKLIST_PREVIEW_COUNT || expandedChecklists[n.id] === true;
                      const shown = open ? all : all.slice(0, CHECKLIST_PREVIEW_COUNT);
                      return (
                        <div data-notes="checklist" style={{ marginTop: 8 }}>
                          <div
                            style={{
                              fontSize: 10.5,
                              color: colors.textSubtle,
                              marginBottom: 5,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            Чек-лист · {prog.done}/{prog.total}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {shown.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                data-notes="checklist-toggle"
                                data-checked={c.done}
                                onClick={() => {
                                  if (viewMode === 'trash') return;
                                  apply(toggleNoteChecklistItem(store, n.id, c.id));
                                }}
                                disabled={viewMode === 'trash'}
                                aria-pressed={c.done}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 8,
                                  textAlign: 'left',
                                  minHeight: 32,
                                  padding: '4px 6px',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  background: 'transparent',
                                  color: c.done ? colors.textSubtle : '#fff',
                                  fontSize: 12,
                                  textDecoration: c.done ? 'line-through' : undefined,
                                }}
                              >
                                <span
                                  aria-hidden="true"
                                  style={{
                                    flexShrink: 0,
                                    width: 16,
                                    height: 16,
                                    marginTop: 1,
                                    borderRadius: 5,
                                    border: `1px solid ${c.done ? withAlpha(AMBER, '99') : 'rgba(255,255,255,0.25)'}`,
                                    background: c.done ? withAlpha(AMBER, '33') : 'transparent',
                                    color: AMBER,
                                    fontSize: 11,
                                    lineHeight: '14px',
                                    textAlign: 'center',
                                  }}
                                >
                                  {c.done ? '✓' : ''}
                                </span>
                                <span style={{ wordBreak: 'break-word' }}>{c.text}</span>
                              </button>
                            ))}
                          </div>
                          {all.length > CHECKLIST_PREVIEW_COUNT && (
                            <button
                              type="button"
                              data-notes="checklist-more"
                              aria-expanded={open}
                              onClick={() => setExpandedChecklists((prev) => ({ ...prev, [n.id]: !open }))}
                              style={{
                                ...btn('ghost'),
                                minHeight: 34,
                                marginTop: 6,
                                padding: '4px 10px',
                                fontSize: 11.5,
                              }}
                            >
                              {open ? 'Свернуть' : `Показать все (${all.length})`}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                    {noteTags(n).map((tag) => {
                      const active = tagFilter.toLowerCase() === tag.toLowerCase();
                      return (
                        <button
                          key={tag}
                          type="button"
                          data-notes="note-tag"
                          data-tag={tag}
                          aria-pressed={active}
                          onClick={() => {
                            setViewMode('active');
                            setTagFilter(active ? 'all' : tag);
                          }}
                          style={{
                            fontSize: 10.5,
                            minHeight: 44,
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 10px',
                            borderRadius: 999,
                            cursor: 'pointer',
                            color: AMBER,
                            background: withAlpha(AMBER, '1f'),
                            border: `1px solid ${withAlpha(AMBER, '40')}`,
                          }}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                    {athleteName && (
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: '3px 8px',
                          borderRadius: 999,
                          color: AMBER,
                          background: withAlpha(AMBER, '1f'),
                          border: `1px solid ${withAlpha(AMBER, '40')}`,
                        }}
                      >
                        {athleteName}
                      </span>
                    )}
                    <span style={{ fontSize: 10.5, color: colors.textSubtle }}>{fmtDate(n.updatedAt)}</span>
                    {n.pinned && <span style={{ fontSize: 10.5, color: AMBER, fontWeight: 800 }}>закреплена</span>}
                    {n.deletedAt && (
                      <span data-notes="trash-date" style={{ fontSize: 10.5, color: colors.textSubtle }}>
                        в корзине с {fmtDate(n.deletedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {viewMode === 'trash' ? (
                  <>
                    <button
                      type="button"
                      data-notes="restore"
                      onClick={() => restoreFromTrash(n.id)}
                      disabled={restoreBlocked}
                      aria-disabled={restoreBlocked}
                      style={{
                        ...btn('primary'),
                        fontSize: 12,
                        opacity: restoreBlocked ? 0.5 : 1,
                        cursor: restoreBlocked ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Восстановить
                    </button>
                    <button
                      type="button"
                      data-notes="purge"
                      onClick={() => purgeOne(n.id)}
                      style={{ ...btn('danger'), fontSize: 12 }}
                    >
                      {isPurging ? 'Точно удалить навсегда?' : 'Удалить навсегда'}
                    </button>
                    {isPurging && (
                      <button
                        type="button"
                        data-notes="purge-cancel"
                        onClick={() => setConfirmPurgeId(null)}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                      >
                        Оставить
                      </button>
                    )}
                    {restoreBlocked && (
                      <div
                        data-notes="restore-limit"
                        style={{ flexBasis: '100%', fontSize: 11, color: colors.textSubtle, lineHeight: 1.45 }}
                      >
                        Лимит {COACH_NOTES_MAX} живых заметок: сначала уберите одну живую заметку в корзину — место
                        освободится, и эту можно будет вернуть.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      data-notes="pin"
                      onClick={() => apply(toggleCoachNotePin(store, n.id))}
                      style={{ ...btn('ghost'), fontSize: 12 }}
                    >
                      {n.pinned ? 'Открепить' : 'Закрепить'}
                    </button>
                    <button
                      type="button"
                      data-notes="edit"
                      onClick={() => openEdit(n)}
                      style={{ ...btn('ghost'), fontSize: 12 }}
                    >
                      Изменить
                    </button>
                    {speechOutputSupported && (n.title || n.body) && (
                      <button
                        type="button"
                        data-notes="speak"
                        data-speaking={speakingId === n.id}
                        onClick={() => toggleSpeak(n)}
                        style={{ ...btn('ghost'), fontSize: 12 }}
                      >
                        {speakingId === n.id ? 'Стоп озвучку' : 'Озвучить'}
                      </button>
                    )}
                    <button
                      type="button"
                      data-notes="delete"
                      onClick={() => askDelete(n.id)}
                      style={{ ...btn('danger'), fontSize: 12 }}
                    >
                      {isDeleting ? 'Точно в корзину?' : 'В корзину'}
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
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {viewer && (
        <div
          data-notes="viewer"
          role="dialog"
          aria-label="Просмотр вложения"
          onClick={() => setViewer(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(0,0,0,0.86)',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={viewer.url}
            alt="Вложение заметки"
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, objectFit: 'contain' }}
          />
          <button
            type="button"
            data-notes="viewer-share"
            aria-label="Поделиться вложением"
            onClick={(e) => {
              e.stopPropagation();
              const att = store.items.flatMap((n) => noteAttachments(n)).find((a) => a.id === viewer.attachmentId);
              if (att) shareAttachment(att);
            }}
            style={{
              position: 'absolute',
              right: 20,
              bottom: 28,
              minHeight: 44,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ⤓ Сохранить / Поделиться
          </button>
        </div>
      )}

      {notice && (
        <div
          data-notes="notice"
          role="status"
          style={{
            ...cardStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: colors.textMuted,
            lineHeight: 1.5,
          }}
        >
          <span style={{ flex: 1 }}>{notice}</span>
          <button
            type="button"
            data-notes="notice-dismiss"
            onClick={() => setNotice(null)}
            aria-label="Скрыть сообщение"
            style={{ ...btn('ghost'), minHeight: 44, padding: '2px 10px', fontSize: 11.5 }}
          >
            ✕
          </button>
        </div>
      )}

      {shareNote && (
        <div
          data-notes="share-status"
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11.5,
            color: colors.textMuted,
            padding: '0 4px',
          }}
        >
          <span style={{ flex: 1 }}>{shareNote}</span>
          <button
            type="button"
            data-notes="share-dismiss"
            onClick={() => setShareNote(null)}
            aria-label="Скрыть статус сохранения"
            style={{ ...btn('ghost'), minHeight: 44, padding: '2px 10px', fontSize: 11.5 }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.55, padding: '0 4px' }}>
        Заметки — это контекст, а не дневник: они не меняют расчёты планов и не попадают в отчёты автоматически. Фото и
        аудио хранятся на этом устройстве (IndexedDB, шифруются ключом устройства) и входят в резервную копию, пока
        влезают в её лимит объёма.
      </div>
    </div>
  );
};
