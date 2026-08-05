/**
 * useSectionState — обёртка над useProfileSection с локальным буфером для
 * немедленного отображения изменений (auto-save идёт в фоне).
 *
 * Логика:
 * 1. Локальный state (`localValue`) обновляется сразу при вводе — мгновенный UI.
 * 2. После 500мс бездействия — debounce-flush: локальное значение пишется в profile.
 * 3. Если `profileValue` изменился ВНЕШНЕ (другой таб, импорт) — синхронизируем локально,
 *    но только если нет pending локальных изменений (которые ещё не записаны).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useProfileSection, updateSection } from '../../../../core/profile-manager';
import type { UnifiedSettings } from '../../../../core/types';

export function useSectionState<K extends keyof UnifiedSettings>(
  section: K,
  delay = 500
): [UnifiedSettings[K], (patch: Partial<UnifiedSettings[K]>) => void, UnifiedSettings[K]] {
  const [profileValue] = useProfileSection(section);
  const [localValue, setLocalValue] = useState<UnifiedSettings[K]>(profileValue);
  const isDirtyRef = useRef(false);
  const lastWrittenRef = useRef<UnifiedSettings[K]>(profileValue);
  const profileValueRef = useRef<UnifiedSettings[K]>(profileValue);
  const localValueRef = useRef<UnifiedSettings[K]>(localValue);

  // Keep refs in sync (для использования внутри useEffect без зависимостей)
  useEffect(() => { profileValueRef.current = profileValue; }, [profileValue]);
  useEffect(() => { localValueRef.current = localValue; }, [localValue]);

  // Эффект 1: sync извне → если профиль изменился и нет pending → обновляем локальное.
  // Зависимость только от profileValue, чтобы не зациклиться на localValue.
  useEffect(() => {
    if (isDirtyRef.current) return;
    if (JSON.stringify(profileValue) === JSON.stringify(localValue)) return;
    // Профиль изменился извне, локально нет pending — обновляем
    setLocalValue(profileValue);
    lastWrittenRef.current = profileValue;
  }, [profileValue]);

  // Эффект 2: auto-save — отслеживает только localValue (не profileValue, чтобы не зациклиться)
  useEffect(() => {
    if (JSON.stringify(localValue) === JSON.stringify(lastWrittenRef.current)) {
      isDirtyRef.current = false;
      return;
    }
    isDirtyRef.current = true;
    const t = setTimeout(() => {
      try {
        const lv = localValueRef.current;
        updateSection(section, lv);
        lastWrittenRef.current = lv;
        isDirtyRef.current = false;
      } catch (e) { console.error(e); }
    }, delay);
    return () => clearTimeout(t);
  }, [localValue, section, delay]);

  const update = useCallback((patch: Partial<UnifiedSettings[K]>) => {
    isDirtyRef.current = true;
    setLocalValue(prev => ({ ...prev, ...patch }));
  }, []);

  return [localValue, update, profileValue];
}
