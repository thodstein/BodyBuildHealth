import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getInjectionDiary,
  addInjection,
  updateInjection,
  deleteInjection,
  clearInjectionDiary,
  computeInjectionStats,
  detectInjectionAnomalies,
  getRotationWarnings,
  getSuggestedZone,
  getDaysSinceLastInjection,
  type InjectionEntry,
  type InjectionStats,
  type InjectionAnomaly,
  type RotationWarning,
} from '../../engines/injection-diary.engine';
import { useProfileSection, getProfile } from '../../core/profile-manager';

export function useInjectionDiary() {
  const [entries, setEntries] = useState<InjectionEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEntries(getInjectionDiary());
    setLoaded(true);
  }, []);

  const stats = useMemo<InjectionStats | null>(() => {
    if (!loaded || entries.length === 0) return null;
    return computeInjectionStats(entries);
  }, [loaded, entries]);

  const anomalies = useMemo<InjectionAnomaly[]>(() => {
    if (!loaded || entries.length === 0) return [];
    return detectInjectionAnomalies(entries);
  }, [loaded, entries]);

  const rotationWarnings = useMemo<RotationWarning[]>(() => {
    if (!loaded || entries.length === 0) return [];
    return getRotationWarnings(entries);
  }, [loaded, entries]);

  const addEntry = useCallback((entry: Omit<InjectionEntry, 'id'>) => {
    const updated = addInjection(entry);
    setEntries(updated);
    return updated;
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<InjectionEntry>) => {
    const updated = updateInjection(id, patch);
    setEntries(updated);
    return updated;
  }, []);

  const removeEntry = useCallback((id: string) => {
    const updated = deleteInjection(id);
    setEntries(updated);
    return updated;
  }, []);

  const resetDiary = useCallback(() => {
    const updated = clearInjectionDiary();
    setEntries(updated);
    return updated;
  }, []);

  const refresh = useCallback(() => {
    setEntries(getInjectionDiary());
  }, []);

  // Injection preferences are not a standalone UnifiedSettings section yet.
  // Keep this hook compatible with the profile API without creating a generic diary section.
  const [injProfile, setInjProfile] = useProfileSection('pharma' as any) as [any, (value: any) => void];

  const syncFromProfile = useCallback(() => {
    const profile = getProfile();
    const inj = (profile as any)?.settings?.injection;
    if (inj) {
      setInjProfile(inj);
      if (typeof window !== 'undefined' && (window as any).showToast) {
        (window as any).showToast('📋 Настройки инъекций загружены из профиля');
      }
    }
  }, [setInjProfile]);

  const syncToProfile = useCallback(() => {
    setInjProfile(injProfile);
    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast('💾 Настройки инъекций сохранены в профиль');
    }
  }, [injProfile, setInjProfile]);

  return {
    entries,
    loaded,
    stats,
    anomalies,
    rotationWarnings,
    addEntry,
    updateEntry,
    removeEntry,
    resetDiary,
    refresh,
    syncFromProfile,
    syncToProfile,
    injProfile,
    setInjProfile,
  };
}
