import { useState, useCallback } from 'react';

export function useDiaryToast() {
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); }, []);
  const safeSet = useCallback((key: string, data: any) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} }, []);
  return { toast, showToast, safeSet };
}
