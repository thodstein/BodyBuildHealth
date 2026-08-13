/**
 * useSectionState — обёртка над useProfileSection с локальным буфером для
 * немедленного отображения изменений (auto-save идёт в фоне).
 *
 * Логика:
 * 1. Локальный state (`localValue`) обновляется сразу при вводе — мгновенный UI.
 * 2. После 500мс бездействия — debounce-flush: локальное значение пишется в profile.
 * 3. Если `profileValue` изменился ВНЕШНЕ (другой таб, импорт) — синхронизируем локально,
 *    но только если нет pending локальных изменений (которые ещё не записаны).
 *
 * Реализация использует refs чтобы избежать stale closure в setTimeout.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useProfileSection, updateSection } from '../../../../core/profile-manager';
import type { UnifiedSettings } from '../../../../core/types';

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export function useSectionState<K extends keyof UnifiedSettings>(
  section: K,
  delay = 500
): [UnifiedSettings[K], (patch: Partial<UnifiedSettings[K]>) => void, UnifiedSettings[K]] {
  const [profileValue] = useProfileSection(section);
  const [localValue, setLocalValue] = useState<UnifiedSettings[K]>(profileValue);

  // Refs для отслеживания актуального состояния без зависимостей в useEffect
  const isDirtyRef = useRef(false);
  const lastWrittenRef = useRef<UnifiedSettings[K]>(profileValue);
  const localValueRef = useRef<UnifiedSettings[K]>(localValue);
  const profileValueRef = useRef<UnifiedSettings[K]>(profileValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => { localValueRef.current = localValue; }, [localValue]);
  useEffect(() => { profileValueRef.current = profileValue; }, [profileValue]);

  // Sync извне (другой таб, импорт, undo): если профиль изменился и локально нет pending —
  // обновляем local. Зависимость ТОЛЬКО от profileValue — не зацикливаемся на localValue.
  useEffect(() => {
    if (isDirtyRef.current) return;
    if (deepEqual(profileValue, localValueRef.current)) return;
    // Профиль изменился извне, локально нет pending изменений
    setLocalValue(profileValue);
    lastWrittenRef.current = profileValue;
  }, [profileValue]);

  // Auto-save с debounce. Зависимость ТОЛЬКО от localValue.
  useEffect(() => {
    if (deepEqual(localValue, lastWrittenRef.current)) {
      isDirtyRef.current = false;
      return;
    }
    // Анти-цикл: если локальное значение уже равно тому, что в профиле
    // (например, профиль перезаписан извне с тем же содержимым) — не пишем.
    if (deepEqual(localValue, profileValueRef.current)) {
      isDirtyRef.current = false;
      lastWrittenRef.current = localValue;
      return;
    }
    isDirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const lv = localValueRef.current;
        updateSection(section, lv);
        lastWrittenRef.current = lv;
        isDirtyRef.current = false;
        timerRef.current = null;
      } catch (e) {
        console.error('[useSectionState] save failed:', e);
        isDirtyRef.current = false;
        timerRef.current = null;
      }
    }, delay);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [localValue, section, delay]);

  const update = useCallback((patch: Partial<UnifiedSettings[K]>) => {
    isDirtyRef.current = true;
    setLocalValue(prev => ({ ...prev, ...patch }));
  }, []);

  return [localValue, update, profileValue];
}
