import type { UserProfile, UserContext, UserRole, LabPhaseType } from './types';

let currentProfile: UserProfile | null = null;

export function getCurrentUserContext(): UserContext | null {
  if (!currentProfile) return null;
  return {
    role: currentProfile.role,
    age: currentProfile.settings.age,
    sex: currentProfile.settings.sex,
    weight: currentProfile.settings.weight,
    goal: currentProfile.settings.goal,
    phase: currentProfile.phase,
    courseStartDate: currentProfile.courseStartDate
  };
}

export function setRole(role: UserRole) {
  if (currentProfile) {
    currentProfile.role = role;
  }
}

export function updateProfile(updates: Partial<UserProfile>) {
  if (currentProfile) {
    Object.assign(currentProfile, updates);
  }
}

// Заглушка для демо
export function initProfileManager() {
  console.log('👤 Profile manager initialized');
  return {
    getContext: getCurrentUserContext,
    setRole,
    updateProfile
  };
}
