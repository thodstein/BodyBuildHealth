/**
 * use-android-back.ts — закрытие оверлеев системной кнопкой «назад» (АПК).
 *
 * Проблема: в APK глобальный обработчик back сводит пользователя на главную
 * вкладку. Если открыт лист выбора, диалог подтверждения или шаг мастера —
 * ожидаемое поведение «закрыть текущий слой», а не «выбросить из экрана».
 *
 * Решение: хук регистрирует перехватчик в native-bridge, пока оверлей открыт;
 * последний зарегистрированный обрабатывает первым (LIFO). На web — no-op.
 */
import { useEffect, useRef } from 'react';
import { registerBackInterceptor } from './native-bridge';

export function useAndroidBackHandler(active: boolean, onBack: () => void): void {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    return registerBackInterceptor(() => {
      try { ref.current(); } catch { /* ignore */ }
      return true;
    });
  }, [active]);
}
