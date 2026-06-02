import { UserRole, UserProfile } from "./types";

const STORAGE_KEY = "he_profile_v2";

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
  return updated;
}

export function setRole(role: UserRole): void {
  const current = getProfile();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, role }));
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
      goal: "",
      phase: "course",
      courseStartDate: new Date().toISOString().slice(0, 10)
    }
  };
}
