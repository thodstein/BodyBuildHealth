import { UserRole, UserProfile } from "./types";
import { useState, useEffect } from "react";

const STORAGE_KEY = "he_profile_v2";

type ProfileListener = () => void;
const listeners: Set<ProfileListener> = new Set();

export function onProfileChange(fn: ProfileListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function notifyAll() {
  listeners.forEach(fn => { try { fn(); } catch {} });
}

export function getProfile(): UserProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : getDefaultProfile();
  } catch { return getDefaultProfile(); }
}

export function updateProfile(ctx: Partial<UserProfile>): UserProfile {
  const current = getProfile();
  const updated = { ...current, ...ctx };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyAll();
  return updated;
}

export function setRole(role: UserRole): void {
  const current = getProfile();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, role }));
  notifyAll();
}

function getDefaultProfile(): UserProfile {
  return {
    name: "",
    id: "",
    role: "user",
    settings: {
      age: 30,
      sex: "male",
      weight: 70,
      height: 175,
      goal: "",
      phase: "course",
      courseStartDate: new Date().toISOString().slice(0, 10),
      baselineSleepQuality: 5,
      baselineStressLevel: 3,
      fatigueLevel: 3,
      dailySteps: 6000,
      dailyWaterLiters: 2,
      nightAwakenings: 1,
      chronotype: 'mixed',
      trainingLevel: 'intermediate',
      workoutsPerWeek: 3,
      avgWorkoutMinutes: 60,
      pharmaExperience: 'none',
      currentSupplements: [],
      currentMedications: [],
      injuries: [],
      weakPoints: []
    },
  };
}

export function useProfileRefresh(): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(getProfile());
  useEffect(() => {
    return onProfileChange(() => setProfile(getProfile()));
  }, []);
  return profile;
}
