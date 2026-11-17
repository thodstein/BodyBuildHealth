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
 *
 * Честно:
 *  • заметки не влияют на расчёты планов и не уходят в отчёты — это блокнот,
 *    а не медицинский документ;
 *  • в Android WebView распознавания речи обычно нет вообще, а микрофон
 *    работает только при разрешении RECORD_AUDIO (оно в манифесте, спрашивает
 *    сам Capacitor). Если система всё же отказала, UI прямо говорит «здесь
 *    недоступно» и предлагает рабочий путь: записать диктофоном и приложить
 *    файл. Кнопок-пустышек, которые «ничего не делают», быть не должно;
 *  • расшифровка приложенного аудио не выдумывается: «голос в текст» работает
 *    только вживую во время диктовки.
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
  COACH_NOTE_CHECKLIST_TEXT_MAX,
  COACH_NOTE_TITLE_MAX,
  COACH_NOTES_MAX,
  addCoachNote,
  filterCoachNotes,
  noteAttachmentIds,
  noteAttachments,
  noteChecklistProgress,
  readCoachNotes,
  removeCoachNote,
  toggleCoachNotePin,
  toggleNoteChecklistItem,
  updateCoachNote,
  writeCoachNotes,
  type CoachNote,
  type CoachNoteAttachment,
  type CoachNoteAttachmentKind,
  type CoachNoteChecklistItem,
  type CoachNotesStore,
} from '../../../engines/coach/coach-notes.engine';
import {
  NOTE_AUDIO_MAX_MS,
  attachmentSummary,
  compressPhotoDataUrl,
  dataUrlBytes,
  formatBytes,
  formatDuration,
  isDictationSupported,
  isSpeechOutputSupported,
  isVoiceRecordingSupported,
  probeAudioDurationMs,
  readDictationChunk,
  recordingMime,
  speakText,
  speechRecognitionCtor,
  stopSpeaking,
  type SpeechRecognitionLike,
} from '../../../engines/note-media.engine';
import {
  cleanupNoteMedia,
  deleteNoteMedia,
  deleteNoteMediaForNote,
  getNoteMedia,
  saveNoteMediaMany,
  type NoteMediaRecord,
} from '../../../engines/note-media-store';

const AMBER = '#f59e0b';

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
  /** Фото: сжатый dataUrl до сохранения. */
  dataUrl?: string;
}

interface EditorState {
  id: string | null;
  title: string;
  body: string;
  athleteId: string;
  pinned: boolean;
  checklist: CoachNoteChecklistItem[];
  attachments: DraftAttachment[];
}

const EMPTY_EDITOR: EditorState = {
  id: null,
  title: '',
  body: '',
  athleteId: '',
  pinned: false,
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

type MediaView = { photo?: string; audioUrl?: string; missing?: boolean };

type DictationState = 'idle' | 'listening' | 'error';

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
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* ── Медиа, загруженное из IndexedDB (для списка) ─────────────────── */
  const [media, setMedia] = useState<Record<string, MediaView>>({});
  const [viewer, setViewer] = useState<{ url: string; kind: CoachNoteAttachmentKind } | null>(null);

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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const dictationSupported = useMemo(() => isDictationSupported(), []);
  const speechOutputSupported = useMemo(() => isSpeechOutputSupported(), []);

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

  /* ── Загрузка медиа для видимых заметок ──────────────────────────── */
  const mediaUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    const ids = store.items.flatMap(n => noteAttachmentIds(n));
    if (!ids.length) {
      for (const old of mediaUrlsRef.current) revokeBlobUrl(old);
      mediaUrlsRef.current = [];
      setMedia({});
      return () => undefined;
    }
    (async () => {
      const next: Record<string, MediaView> = {};
      for (const id of ids) {
        const rec = await getNoteMedia(id);
        if (!alive) {
          // Пока грузили, стейт сменился — созданные URL отзываем сразу.
          for (const url of urls) revokeBlobUrl(url);
          return;
        }
        if (!rec) {
          next[id] = { missing: true };
          continue;
        }
        if (rec.kind === 'photo' && rec.dataUrl) {
          next[id] = { photo: rec.dataUrl };
        } else if (rec.kind === 'audio' && rec.blob) {
          const url = createObjectUrl(rec.blob);
          if (url) urls.push(url);
          next[id] = url ? { audioUrl: url } : { missing: true };
        } else {
          next[id] = { missing: true };
        }
      }
      if (!alive) {
        for (const url of urls) revokeBlobUrl(url);
        return;
      }
      // Старые URL отзываем ПОСЛЕ подмены карты: иначе проигрыватель на миг
      // остаётся с уже мёртвой ссылкой.
      const stale = mediaUrlsRef.current;
      mediaUrlsRef.current = urls;
      setMedia(next);
      for (const url of stale) revokeBlobUrl(url);
    })();
    return () => {
      alive = false;
    };
  }, [store]);

  /* ── Освобождение blob-URL при размонтировании ───────────────────── */
  useEffect(
    () => () => {
      for (const url of mediaUrlsRef.current) revokeBlobUrl(url);
      mediaUrlsRef.current = [];
    },
    [],
  );

  /* ── Уборка осиротевших файлов (сбой сохранения/импорта) ─────────── */
  useEffect(() => {
    const keep = new Set(store.items.flatMap(n => noteAttachmentIds(n)));
    void cleanupNoteMedia(keep);
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
        recognitionRef.current?.abort?.();
      } catch {
        /* ignore */
      }
      stopSpeaking();
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    },
    [],
  );

  const openNew = () => {
    setEditor({ ...EMPTY_EDITOR, attachments: [] });
    setError(null);
    setVoiceError(null);
  };

  const openEdit = (n: CoachNote) => {
    const attachments: DraftAttachment[] = noteAttachments(n).map(a => {
      const view = media[a.id];
      return {
        ...a,
        previewUrl: view?.photo ?? view?.audioUrl ?? '',
        pending: false,
      };
    });
    setEditor({
      id: n.id,
      title: n.title,
      body: n.body,
      athleteId: n.athleteId ?? '',
      pinned: n.pinned,
      checklist: (n.checklist ?? []).map(c => ({ ...c })),
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
      recognitionRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setDictation('idle');
  };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
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
    setEditor(s => (s ? { ...s, attachments: [...s.attachments, draft] } : s));
  };

  const addAudioBlob = (blob: Blob, durationMs: number, name?: string) => {
    if (!blob || blob.size === 0) return;
    if (blob.size > COACH_NOTE_ATTACHMENT_BYTES_MAX) {
      setVoiceError(`Аудио больше ${formatBytes(COACH_NOTE_ATTACHMENT_BYTES_MAX)} — такое вложение не сохраняю.`);
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
      recorder.ondataavailable = ev => {
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
        addAudioBlob(blob, durationMs);
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
    addAudioBlob(file, durationMs, file.name);
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
      const size = dataUrlBytes(dataUrl);
      if (size > COACH_NOTE_ATTACHMENT_BYTES_MAX) {
        setVoiceError(`Фото больше ${formatBytes(COACH_NOTE_ATTACHMENT_BYTES_MAX)} даже после сжатия — не сохраняю.`);
        setVoiceBusy(false);
        return;
      }
      const mimeMatch = /^data:(image\/[a-z0-9.+-]+)/i.exec(dataUrl);
      addDraftAttachment(
        {
          id: newAttachmentId(),
          kind: 'photo',
          mime: (mimeMatch?.[1] ?? 'image/jpeg').toLowerCase(),
          size,
          createdAt: new Date().toISOString(),
          previewUrl: dataUrl,
          pending: true,
          dataUrl,
        },
        `К заметке можно приложить не больше ${COACH_NOTE_ATTACHMENTS_MAX} файлов.`,
      );
    } finally {
      setVoiceBusy(false);
    }
  };

  const removeDraftAttachment = (id: string) => {
    setEditor(s => {
      if (!s) return s;
      const target = s.attachments.find(a => a.id === id);
      if (target?.pending) revokeBlobUrl(target.previewUrl);
      return { ...s, attachments: s.attachments.filter(a => a.id !== id) };
    });
  };

  /* ── Речь в текст ─────────────────────────────────────────────────── */

  const toggleDictation = () => {
    setVoiceError(null);
    if (dictation === 'listening') {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setDictation('error');
      setVoiceError(
        'Речь в текст здесь недоступна: это WebView без распознавания речи. Голос всё равно можно записать и приложить к заметке.',
      );
      return;
    }
    try {
      const recognition = new Ctor();
      recognition.lang = 'ru-RU';
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = event => {
        const chunk = readDictationChunk(event);
        if (!chunk.text) return;
        setEditor(s => {
          if (!s) return s;
          const base = s.body.trimEnd();
          const body = base ? `${base} ${chunk.text}` : chunk.text;
          return { ...s, body: body.slice(0, COACH_NOTE_BODY_MAX) };
        });
      };
      recognition.onerror = () => {
        setDictation('error');
        setVoiceError(
          'Распознавание прервалось. Проверьте доступ к микрофону; распознавание идёт через сервис системы и в офлайне не работает.',
        );
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setDictation('idle');
      };
      recognitionRef.current = recognition;
      recognition.start();
      setDictation('listening');
    } catch {
      setDictation('error');
      setVoiceError('Не удалось начать диктовку — распознавание речи не запустилось.');
    }
  };

  /* ── Текст в речь ─────────────────────────────────────────────────── */

  const toggleSpeak = (note: CoachNote) => {
    if (speakingId === note.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    const text = [note.title, note.body].filter(Boolean).join('. ');
    const ok = speakText(text, {
      onEnd: () => setSpeakingId(current => (current === note.id ? null : current)),
    });
    if (!ok) {
      setVoiceError('Озвучка недоступна в этом приложении — голосового движка нет.');
      return;
    }
    setSpeakingId(note.id);
  };

  /* ── Сохранение ───────────────────────────────────────────────────── */

  const trimmedChecklist = (draft: EditorState): CoachNoteChecklistItem[] =>
    draft.checklist.map(c => ({ ...c, text: c.text.trim() })).filter(c => c.text.length > 0);

  const strippedAttachments = (draft: EditorState): CoachNoteAttachment[] =>
    draft.attachments.map(a => ({
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
    const pending = draft.attachments.filter(a => a.pending && (a.blob || a.dataUrl));

    const writeMedia = async (): Promise<boolean> => {
      const records: NoteMediaRecord[] = pending.map(a => ({
        id: a.id,
        noteId,
        kind: a.kind,
        mime: a.mime,
        size: a.size,
        ...(a.durationMs ? { durationMs: a.durationMs } : {}),
        ...(a.name ? { name: a.name } : {}),
        createdAt: Date.now(),
        ...(a.kind === 'photo' ? { dataUrl: a.dataUrl ?? a.previewUrl } : { blob: a.blob as Blob }),
      }));
      const ok = records.length ? await saveNoteMediaMany(records) : true;
      if (!ok) {
        setError(
          'Не хватило места в хранилище — вложение не сохранено. Удалите лишние фото/аудио и попробуйте снова.',
        );
        return false;
      }
      return true;
    };

    if (pending.length === 0) {
      commitSave(draft, noteId, attachments);
      return;
    }
    void (async () => {
      const ok = await writeMedia();
      if (!ok) return;
      const saved = commitSave(draft, noteId, attachments);
      if (!saved) {
        // Заметка не сохранилась (стала пустой) — только что записанные файлы
        // не должны остаться сиротами в квоте.
        void deleteNoteMedia(pending.map(a => a.id));
        return;
      }
      for (const a of draft.attachments) {
        if (a.pending) revokeBlobUrl(a.previewUrl);
      }
      const keep = new Set(
        // Заметку, которую только что сохранили, считаем по новому набору:
        // убранные вложения не должны попасть в «нужное» (иначе файл повиснет).
        store.items
          .filter(n => n.id !== noteId)
          .flatMap(n => noteAttachmentIds(n)),
      );
      for (const a of attachments) keep.add(a.id);
      void cleanupNoteMedia(keep);
    })();
  };

  const askDelete = (id: string) => {
    if (confirmDeleteId === id) {
      apply(removeCoachNote(store, id));
      void deleteNoteMediaForNote(id);
      setConfirmDeleteId(null);
      if (editor?.id === id) closeEditor();
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
            <button
              type="button"
              onClick={() => void addPhoto()}
              disabled={voiceBusy}
              data-notes="add-photo"
              style={{ ...btn('ghost'), fontSize: 12, opacity: voiceBusy ? 0.6 : 1 }}
            >
              Фото
            </button>
            <button
              type="button"
              onClick={toggleVoice}
              data-notes="add-voice"
              data-recording={recording}
              style={{
                ...btn('ghost'),
                fontSize: 12,
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
              data-notes="add-audio-file"
              style={{ ...btn('ghost'), fontSize: 12 }}
            >
              Аудиофайл
            </button>
            <button
              type="button"
              onClick={toggleDictation}
              data-notes="dictate"
              data-dictation={dictation}
              style={{ ...btn('ghost'), fontSize: 12, opacity: dictationSupported ? 1 : 0.55 }}
            >
              {dictation === 'listening' ? 'Стоп диктовку' : 'Голос в текст'}
            </button>
          </div>

          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            aria-label="Аудиофайл к заметке"
            data-notes="audio-input"
            style={{ display: 'none' }}
            onChange={e => {
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
            onChange={e => handleVoiceInput(e.currentTarget)}
          />

          {!dictationSupported && (
            <div data-notes="dictation-hint" style={{ marginTop: 8, fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.5 }}>
              Речь в текст здесь недоступна (WebView без распознавания). Голос можно записать и
              приложить к заметке — расшифровка останется за вами.
            </div>
          )}

          {editor.attachments.length > 0 && (
            <div
              data-notes="attach-list"
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}
            >
              {editor.attachments.map(a => (
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
                    a.previewUrl ? (
                      <img
                        src={a.previewUrl}
                        alt={a.name ?? 'Фото заметки'}
                        style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                      />
                    ) : (
                      <div style={{ fontSize: 11.5, color: colors.textSubtle }}>Фото загружается…</div>
                    )
                  ) : a.previewUrl ? (
                    <div>
                      <div style={{ fontSize: 11, color: colors.textSubtle, marginBottom: 4 }}>
                        Аудио {a.durationMs ? formatDuration(a.durationMs) : ''}
                      </div>
                      <audio src={a.previewUrl} controls preload="metadata" style={{ maxWidth: 190, height: 34 }} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: colors.textSubtle }}>Аудио {a.durationMs ? formatDuration(a.durationMs) : ''}</div>
                  )}
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

          {voiceError && (
            <div role="alert" data-notes="voice-error" style={{ marginTop: 8, fontSize: 12, color: colors.textMuted, lineHeight: 1.5 }}>
              {voiceError}
            </div>
          )}

          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: colors.textMuted, margin: '12px 0 5px' }}>
            Чек-лист
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-notes="checklist-edit">
            {editor.checklist.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  value={c.text}
                  maxLength={COACH_NOTE_CHECKLIST_TEXT_MAX}
                  onChange={e =>
                    setEditor(s =>
                      s
                        ? { ...s, checklist: s.checklist.map((x, xi) => (xi === i ? { ...x, text: e.target.value } : x)) }
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
                    setEditor(s => (s ? { ...s, checklist: s.checklist.filter((_, xi) => xi !== i) } : s))
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
              onClick={() =>
                setEditor(s =>
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
              style={{ ...btn('ghost'), alignSelf: 'flex-start', fontSize: 12 }}
            >
              + Пункт чек-листа
            </button>
          </div>
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
              onClick={closeEditor}
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
          const attachments = noteAttachments(n);
          const photos = attachments.filter(a => a.kind === 'photo');
          const audios = attachments.filter(a => a.kind === 'audio');
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
                    {n.title || n.body.split('\n')[0].slice(0, 80) || 'Заметка с вложением'}
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

                  {attachments.length > 0 && (
                    <div data-notes="attachments" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 10.5, color: colors.textSubtle }}>{attachmentSummary(attachments)}</div>
                      {photos.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {photos.map(a => {
                            const view = media[a.id];
                            return view?.photo ? (
                              <button
                                key={a.id}
                                type="button"
                                data-notes="photo"
                                aria-label={a.name ? `Открыть фото: ${a.name}` : 'Открыть фото заметки'}
                                onClick={() => setViewer({ url: view.photo as string, kind: 'photo' })}
                                style={{ padding: 0, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, background: 'transparent', cursor: 'pointer', overflow: 'hidden' }}
                              >
                                <img
                                  src={view.photo}
                                  alt={a.name ?? 'Фото заметки'}
                                  style={{ width: 88, height: 88, objectFit: 'cover', display: 'block' }}
                                />
                              </button>
                            ) : (
                              <div
                                key={a.id}
                                data-notes="media-missing"
                                style={{ fontSize: 11, color: colors.textSubtle, border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 10, padding: '10px 12px' }}
                              >
                                Фото не найдено в хранилище
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {audios.map(a => {
                        const view = media[a.id];
                        return view?.audioUrl ? (
                          <audio
                            key={a.id}
                            data-notes="audio-player"
                            src={view.audioUrl}
                            controls
                            preload="metadata"
                            style={{ width: '100%', maxWidth: 320, height: 36 }}
                          />
                        ) : (
                          <div
                            key={a.id}
                            data-notes="media-missing"
                            style={{ fontSize: 11, color: colors.textSubtle, border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 10, padding: '8px 12px' }}
                          >
                            Аудио не найдено в хранилище (файл удалён)
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(n.checklist?.length ?? 0) > 0 && (() => {
                    const prog = noteChecklistProgress(n);
                    return (
                      <div data-notes="checklist" style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10.5, color: colors.textSubtle, marginBottom: 5, fontVariantNumeric: 'tabular-nums' }}>
                          Чек-лист · {prog.done}/{prog.total}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(n.checklist ?? []).map(c => (
                            <button
                              key={c.id}
                              type="button"
                              data-notes="checklist-toggle"
                              data-checked={c.done}
                              onClick={() => apply(toggleNoteChecklistItem(store, n.id, c.id))}
                              aria-pressed={c.done}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left',
                                minHeight: 32, padding: '4px 6px', borderRadius: 8, cursor: 'pointer',
                                border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
                                color: c.done ? colors.textSubtle : '#fff', fontSize: 12,
                                textDecoration: c.done ? 'line-through' : undefined,
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  flexShrink: 0, width: 16, height: 16, marginTop: 1, borderRadius: 5,
                                  border: `1px solid ${c.done ? withAlpha(AMBER, '99') : 'rgba(255,255,255,0.25)'}`,
                                  background: c.done ? withAlpha(AMBER, '33') : 'transparent',
                                  color: AMBER, fontSize: 11, lineHeight: '14px', textAlign: 'center',
                                }}
                              >
                                {c.done ? '✓' : ''}
                              </span>
                              <span style={{ wordBreak: 'break-word' }}>{c.text}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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

      {viewer && (
        <div
          data-notes="viewer"
          role="dialog"
          aria-label="Просмотр вложения"
          onClick={() => setViewer(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.86)', cursor: 'zoom-out',
          }}
        >
          <img
            src={viewer.url}
            alt="Вложение заметки"
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, objectFit: 'contain' }}
          />
        </div>
      )}

      <div style={{ fontSize: 11.5, color: colors.textSubtle, lineHeight: 1.55, padding: '0 4px' }}>
        Заметки — это контекст, а не дневник: они не меняют расчёты планов и не попадают в отчёты
        автоматически. Фото и аудио хранятся только на этом устройстве (IndexedDB) и в резервную
        копию не входят.
      </div>
    </div>
  );
};
