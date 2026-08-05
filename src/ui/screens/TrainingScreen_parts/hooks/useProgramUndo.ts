/**
 * useProgramUndo — хук для Undo/Redo истории изменений UserProgram.
 *
 * Извлечено из ProgramManagerPanel.tsx (F3.1) в отдельный хук, чтобы
 * ProgramEditorView тоже мог использовать ту же историю через onChange.
 * История хранится в localStorage('he_editor_history') с cap=50.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { UserProgram } from '../../../../engines/user-program/user-program.types';

const STORAGE_KEY = 'he_editor_history';
const MAX_HISTORY = 50;
const MAX_STORAGE_BYTES = 2_000_000;

interface HistoryState {
  past: string[];
  future: string[];
}

function loadHistory(): HistoryState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"past":[],"future":[]}');
    if (!parsed || !Array.isArray(parsed.past) || !Array.isArray(parsed.future)) {
      return { past: [], future: [] };
    }
    return parsed;
  } catch {
    return { past: [], future: [] };
  }
}

function saveHistory(hist: HistoryState): void {
  while (hist.past.length + hist.future.length > 0) {
    const serialized = JSON.stringify(hist);
    if (serialized.length <= MAX_STORAGE_BYTES) {
      try { localStorage.setItem(STORAGE_KEY, serialized); } catch {
        // QuotaExceededError: discard the oldest snapshots before retrying.
        if (hist.past.length > 0) hist.past.shift();
        else if (hist.future.length > 0) hist.future.shift();
        else break;
        continue;
      }
      return;
    }
    if (hist.past.length > 0) hist.past.shift();
    else if (hist.future.length > 0) hist.future.shift();
    else break;
  }
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * @param current — текущая программа (для snapshot перед изменением)
 * @param setCurrent — функция установки новой программы (setEditing)
 * @returns { pushSnapshot, undo, redo, canUndo, canRedo }
 */
export function useProgramUndo(
  current: UserProgram | null,
  setCurrent: (p: UserProgram | null) => void,
) {
  const currentRef = useRef(current);
  currentRef.current = current;

  const pushSnapshot = useCallback((next: UserProgram) => {
    const cur = currentRef.current;
    if (!cur) return;
    try {
      const curStr = JSON.stringify(cur);
      const nextStr = JSON.stringify(next);
      if (curStr === nextStr) return;
      const hist = loadHistory();
      hist.past.push(curStr);
      if (hist.past.length > MAX_HISTORY) hist.past.shift();
      hist.future = [];
      saveHistory(hist);
    } catch { /* ignore */ }
  }, []);

  const undo = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;
    try {
      const hist = loadHistory();
      if (hist.past.length === 0) return;
      const prev = hist.past.pop();
      hist.future.push(JSON.stringify(cur));
      saveHistory(hist);
      if (prev) {
        try { setCurrent(JSON.parse(prev)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, [setCurrent]);

  const redo = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;
    try {
      const hist = loadHistory();
      if (hist.future.length === 0) return;
      const next = hist.future.pop();
      hist.past.push(JSON.stringify(cur));
      saveHistory(hist);
      if (next) {
        try { setCurrent(JSON.parse(next)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, [setCurrent]);

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, undo, redo]);

  return { pushSnapshot, undo, redo };
}
