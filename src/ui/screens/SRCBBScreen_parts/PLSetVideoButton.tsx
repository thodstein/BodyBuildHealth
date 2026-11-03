/**
 * PLSetVideoButton.tsx — 🎥 видео к подходу (Фаза 6, п.10).
 *
 * Одна мини-кнопка в строке подхода:
 *  • записать ролик техники (APK) и привязать к (дата, упражнение, подход);
 *  • посмотреть уже привязанный;
 *  • убрать ссылку (файл — лучшая попытка удалить).
 *
 * В браузере запись видео физически недоступна (`Camera.recordVideo` только
 * native). Поэтому кнопка не притворяется рабочей: нажатие честно говорит, что
 * запись — в приложении, а не «видео сохранено» куда-то в пустоту.
 */
import React from 'react';
import {
  findSetVideo,
  readSetVideoStore,
  removeSetVideo,
  upsertSetVideo,
  writeSetVideoStore,
  type PLSetVideoStore,
} from '../../../engines/lms/pl-set-video.engine';
import {
  deleteSetVideoFile,
  isVideoCaptureSupported,
  playSetVideo,
  recordSetVideo,
} from '../../../core/native-bridge';
import { hapticImpact } from '../../../core/telegram';

export interface PLSetVideoButtonProps {
  /** Дата тренировки (локальная, YYYY-MM-DD). */
  date: string;
  exercise: string;
  setNumber: number;
  /** Куда сообщать результат (плеер передаёт свою нотификацию). */
  onNote?: (msg: string) => void;
}

const getStorage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

export const PLSetVideoButton: React.FC<PLSetVideoButtonProps> = ({ date, exercise, setNumber, onNote }) => {
  const [store, setStore] = React.useState<PLSetVideoStore>(() => readSetVideoStore(getStorage()));
  const [busy, setBusy] = React.useState(false);
  const ref = findSetVideo(store, date, exercise, setNumber);

  const persist = (next: PLSetVideoStore) => {
    const { store: pruned, droppedUris } = writeSetVideoStore(getStorage(), next);
    setStore(pruned);
    // Файлы выброшенных ссылок — в мусор (best-effort, APK).
    for (const uri of droppedUris) void deleteSetVideoFile(uri);
    return pruned;
  };

  const onRecord = async () => {
    if (busy) return;
    if (!isVideoCaptureSupported()) {
      onNote?.('🎥 Запись видео доступна в приложении (APK). В браузере ролик не сохранится — откройте тренировку в приложении.');
      return;
    }
    setBusy(true);
    try {
      const res = await recordSetVideo();
      if (!res) { onNote?.('🎥 Запись видео отменена или камера недоступна.'); return; }
      const { store: next, replacedUri } = upsertSetVideo(store, {
        date, exercise, setNumber, uri: res.uri, source: 'recorded',
      });
      persist(next);
      if (replacedUri) void deleteSetVideoFile(replacedUri);
      hapticImpact('light');
      onNote?.(`🎥 Видео привязано к подходу ${setNumber} · ${exercise}. Ссылка хранится в приложении, в localStorage — только ссылка.`);
    } finally {
      setBusy(false);
    }
  };

  const onPlay = async () => {
    if (!ref) return;
    hapticImpact('light');
    const ok = await playSetVideo(ref.uri);
    if (!ok) onNote?.('🎥 Не удалось открыть видео: файл удалён или ссылка устарела. Запишите ролик заново.');
  };

  const onRemove = () => {
    const { store: next, removedUri } = removeSetVideo(store, date, exercise, setNumber);
    persist(next);
    if (removedUri) void deleteSetVideoFile(removedUri);
    onNote?.('🎥 Ссылка на видео снята.');
  };

  if (ref) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <button
          type="button"
          data-pl="set-video-play"
          onClick={onPlay}
          title={ref.source === 'gallery' ? 'Видео из галереи' : 'Записанное в приложении'}
          style={{ minHeight: 32, padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.10)', color: '#60a5fa', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
        >🎥 видео</button>
        <button
          type="button"
          data-pl="set-video-remove"
          onClick={onRemove}
          aria-label="Убрать видео подхода"
          style={{ minHeight: 32, width: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer' }}
        >✕</button>
      </span>
    );
  }

  return (
    <button
      type="button"
      data-pl="set-video-record"
      onClick={onRecord}
      disabled={busy}
      aria-label="Записать видео подхода"
      style={{ minHeight: 32, padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
    >{busy ? '…' : '🎥'}</button>
  );
};

export default PLSetVideoButton;
