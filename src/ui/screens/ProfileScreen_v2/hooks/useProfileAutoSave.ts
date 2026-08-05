/**
 * useProfileAutoSave — хук для auto-save с debounce и snapshot/undo.
 */
import { useEffect, useRef, useCallback } from 'react';
import { updateSection, pushSnapshot, undoLastSnapshot } from '../../../../core/profile-manager';
import type { UnifiedSettings } from '../../../../core/types';

export function useProfileAutoSave<K extends keyof UnifiedSettings>(
  section: K,
  value: UnifiedSettings[K],
  options: { delay?: number; skipSnapshot?: boolean } = {}
) {
  const { delay = 500, skipSnapshot = false } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    // Skip first render to avoid saving unchanged initial value
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!skipSnapshot) {
        try { pushSnapshot(); } catch {}
      }
      try {
        updateSection(section, value);
      } catch (e) {
        console.error('[useProfileAutoSave] save failed:', e);
      }
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [section, value, delay, skipSnapshot]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (!skipSnapshot) {
          try { pushSnapshot(); } catch {}
        }
        try { updateSection(section, value); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undo = useCallback(() => {
    undoLastSnapshot();
  }, []);
  return { undo };
}
