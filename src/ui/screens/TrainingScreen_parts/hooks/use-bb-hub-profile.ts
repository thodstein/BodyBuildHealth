/**
 * use-bb-hub-profile.ts — профильные источники ББ-диагностики.
 *
 * Первый срез волны 3 плана хабов: «Разбор»/«Слабые» читают уровень, оборудование,
 * рабочие максимумы, ограничения мобильности, пол/сон/возраст из `he_profile_v2`.
 * Раньше эти семь мемо жили в `BBDiagnosticsHub.tsx` между состоянием и обработчиками.
 *
 * Контракт прежний 1:1 (тела мемо перенесены без правок):
 *  - без профиля каждое поле возвращает «нет данных» (undefined/''/null), а не дефолт;
 *  - правка профиля видна без ремаунта: `profile-updated` и `storage` бампят `profileNonce`;
 *  - `teenGate` считается из возраста тем же движком (`teenLoadedGate`), что и в ББ-авто.
 * Хук ничего не пишет: запись ограничений мобильности остаётся в хабе (там тост).
 */
import { useEffect, useMemo, useState } from 'react';
import { teenLoadedGate } from '../../../../engines/bb/bb-movement-screen.engine';

export type BbHubProfileSex = '' | 'male' | 'female';

export type BbHubProfile = {
  /** Тик перечитывания профиля (бампится по `profile-updated`/`storage`). */
  profileNonce: number;
  level: string;
  profileEquipment?: string[];
  profileWorkMax?: Record<string, number>;
  profileMobility?: string[];
  profileSex: BbHubProfileSex;
  profileSleep: number | null;
  profileAge: number | null;
  teenGate: ReturnType<typeof teenLoadedGate>;
  /** Пол для движков: профиль приоритетнее замороженного легаси-поля состояния. */
  effSex: BbHubProfileSex;
};

/**
 * @param legacySex `state.sex` — легаси-фолбэк (UI-селекта больше нет); профиль приоритетнее.
 */
export function useBbHubProfile(legacySex: BbHubProfileSex): BbHubProfile {
  // PRO-5 Э2: профиль читают мемы — бампим тик по profile-updated/storage (правка профиля без ремаунта)
  const [profileNonce, setProfileNonce] = useState(0);
  useEffect(() => {
    const bump = () => setProfileNonce((t) => t + 1);
    try {
      window.addEventListener('profile-updated', bump as EventListener);
      window.addEventListener('storage', bump as EventListener);
    } catch { /* noop */ }
    return () => {
      try {
        window.removeEventListener('profile-updated', bump as EventListener);
        window.removeEventListener('storage', bump as EventListener);
      } catch { /* noop */ }
    };
  }, []);

  const level = useMemo(() => {
    try { const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}'); return p?.settings?.training?.level || p?.training?.level || 'intermediate'; } catch { return 'intermediate'; }
  }, [profileNonce]);

  // Оборудование зала из профиля — фильтр кандидатов (без него — весь каталог)
  const profileEquipment = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const eq = p?.settings?.training?.equipment ?? p?.training?.equipment;
      if (Array.isArray(eq)) {
        const clean = eq.map((s) => String(s)).filter(Boolean);
        return clean.length ? clean : undefined;
      }
      return undefined;
    } catch { return undefined; }
  }, [profileNonce]);

  // K3: рабочие максимумы профиля для веса коррекций (точный id упражнения → мышца).
  // Единый вход карточки и вставки («показано = вставится»); нет данных — движок честно без кг.
  const profileWorkMax = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const t = p?.settings?.training ?? p?.training;
      const byMuscle = (t?.workMax || {}) as Record<string, number>;
      const byEx = (t?.workMaxByExercise || {}) as Record<string, number>;
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(byEx)) { const n = Number(v); if (Number.isFinite(n) && n > 0) out[k] = n; }
      for (const [k, v] of Object.entries(byMuscle)) { const n = Number(v); if (Number.isFinite(n) && n > 0) out[k] = n; }
      return Object.keys(out).length ? out : undefined;
    } catch { return undefined; }
  }, [profileNonce]);

  // K4: ограничения мобильности профиля — гейт кандидатов инъекции (те же каноны, что у билдера).
  const profileMobility = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const m = p?.settings?.training?.mobilityRestrictions ?? p?.training?.mobilityRestrictions;
      if (Array.isArray(m)) {
        const clean = m.map((s) => String(s)).filter(Boolean);
        return clean.length ? clean : undefined;
      }
      return undefined;
    } catch { return undefined; }
  }, [profileNonce]);

  // Пол и сон — из профиля (единый источник; в хабе своих селектов нет, без дублей)
  const profileSex = useMemo<BbHubProfileSex>(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const s = p?.settings?.personal?.sex ?? p?.personal?.sex;
      return s === 'female' || s === 'male' ? (s as 'male' | 'female') : '';
    } catch { return ''; }
  }, [profileNonce]);
  const profileSleep = useMemo<number | null>(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const n = Number(p?.settings?.lifestyle?.sleepHours ?? p?.lifestyle?.sleepHours);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  }, [profileNonce]);
  // R6: возраст из профиля — гейт нагруженных проб для 14–15 (прецедент teenNotes ББ-авто)
  const profileAge = useMemo<number | null>(() => {
    try {
      const p = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
      const a = Number(p?.settings?.personal?.age ?? p?.personal?.age);
      return Number.isFinite(a) && a > 0 ? a : null;
    } catch { return null; }
  }, [profileNonce]);
  const teenGate = useMemo(() => teenLoadedGate(profileAge), [profileAge]);
  // state.sex — замороженный легаси-фолбэк (UI-селекта больше нет); профиль приоритетнее
  const effSex = ((profileSex || legacySex || '') as BbHubProfileSex);

  return { profileNonce, level, profileEquipment, profileWorkMax, profileMobility, profileSex, profileSleep, profileAge, teenGate, effSex };
}
