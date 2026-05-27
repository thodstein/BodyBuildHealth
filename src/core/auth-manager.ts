import { db } from './db';
import type { UserRole, UserProfile as CoreUserProfile } from './types';

const SESSION_KEY = 'he_session_v2';

export type AuthUserProfile = Omit<CoreUserProfile, 'email'> & {
  email: string;
  passwordHash: string;
  createdAt: string;
  lastLogin: string;
  settings: { age: number; weight: number; height: number; sex: 'male'|'female'; goal: string };
};

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i) | 0;
  return hash.toString(36);
}

export async function registerUser(email: string, password: string, name: string, role: UserRole = 'user'): Promise<{ success: boolean; message: string; userId?: string }> {
  const users: AuthUserProfile[] = await db.getAll('users') || [];
  if (users.some(u => u.email === email.toLowerCase())) return { success: false, message: 'Пользователь уже существует' };
  
  const user: AuthUserProfile = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name,
    age: 30,
    sex: 'male' as const,
    role,
    passwordHash: simpleHash(password),
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    settings: { age: 30, weight: 80, height: 180, sex: 'male', goal: 'bulk' }
  };
  
  await db.put('users', user);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, email: user.email }));
  return { success: true, message: 'Регистрация успешна', userId: user.id };
}

export async function loginUser(email: string, password: string): Promise<{ success: boolean; message: string; profile?: CoreUserProfile }> {
  const users: AuthUserProfile[] = await db.getAll('users') || [];
  const user = users.find(u => u.email === email.toLowerCase() && u.passwordHash === simpleHash(password));
  if (!user) return { success: false, message: 'Неверный email или пароль' };
  
  user.lastLogin = new Date().toISOString();
  await db.put('users', user);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, email: user.email }));
  const { passwordHash, settings, ...profile } = user;
  return { success: true, message: 'Вход выполнен', profile };
}

export async function logoutUser(): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

export async function getCurrentProfile(): Promise<CoreUserProfile | null> {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  try {
    const { id } = JSON.parse(session);
    const users: AuthUserProfile[] = await db.getAll('users') || [];
    const user = users.find(u => u.id === id);
    if (!user) return null;
    const { passwordHash, settings, ...profile } = user;
    return profile;
  } catch { return null; }
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<void> {
  const users: AuthUserProfile[] = await db.getAll('users') || [];
  const user = users.find(u => u.id === userId);
  if (user) {
    user.role = newRole;
    await db.put('users', user);
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    if (session.id === userId) {
      const prof = await getCurrentProfile();
      if (prof) localStorage.setItem('he_profile', JSON.stringify(prof));
    }
  }
}

export async function getAllProfiles(): Promise<AuthUserProfile[]> {
  return await db.getAll('users') || [];
}