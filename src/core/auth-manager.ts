import { db } from './db';
import type { UserRole } from './types';

const SESSION_KEY = 'he_session_v2';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const ADMIN_SEEDED_KEY = 'he_admin_seeded_v1';

export interface LocalUserProfile {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  createdAt: string;
  lastLogin: string;
  settings: { age: number; weight: number; height: number; sex: 'male' | 'female'; goal: string };
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hash(password: string, salt: string): Promise<string> {
  const encoded = new TextEncoder().encode(password + salt);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i) | 0;
  return hash.toString(36);
}

export async function ensureAdmin(email: string, password: string, name: string, role: UserRole = 'admin'): Promise<void> {
  try {
    const users: LocalUserProfile[] = await db.getAll('users') || [];
    const existing = users.find(u => u.email === email.toLowerCase());
    if (existing) {
      if (!existing.salt || localStorage.getItem(ADMIN_SEEDED_KEY) !== 'v2') {
        existing.salt = generateSalt();
        existing.passwordHash = await sha256Hash(password, existing.salt);
        await db.put('users', existing);
        localStorage.setItem(ADMIN_SEEDED_KEY, 'v2');
      }
      return;
    }
    const salt = generateSalt();
    const passwordHash = await sha256Hash(password, salt);
    const user: LocalUserProfile = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      name,
      passwordHash,
      salt,
      role,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      settings: { age: 30, weight: 80, height: 180, sex: 'male', goal: 'bulk' }
    };
    await db.put('users', user);
    localStorage.setItem(ADMIN_SEEDED_KEY, 'v2');
  } catch (e) {
    console.warn('ensureAdmin failed:', e);
  }
}

export async function registerUser(email: string, password: string, name: string, role: UserRole = 'user'): Promise<{ success: boolean; message: string; userId?: string }> {
  if (password.length < 8) return { success: false, message: '\u041F\u0430\u0440\u043E\u043B\u044C \u043C\u0438\u043D\u0438\u043C\u0443\u043C 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432' };
  const users: LocalUserProfile[] = await db.getAll('users') || [];
  if (users.some(u => u.email === email.toLowerCase())) return { success: false, message: '\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442' };

  const salt = generateSalt();
  const passwordHash = await sha256Hash(password, salt);
  const user: LocalUserProfile = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name,
    passwordHash,
    salt,
    role,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    settings: { age: 30, weight: 80, height: 180, sex: 'male', goal: 'bulk' }
  };

  await db.put('users', user);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, email: user.email, ts: Date.now() }));
  return { success: true, message: '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F \u0443\u0441\u043F\u0435\u0448\u043D\u0430', userId: user.id };
}

export async function loginUser(email: string, password: string): Promise<{ success: boolean; message: string; profile?: LocalUserProfile }> {
  const users: LocalUserProfile[] = await db.getAll('users') || [];
  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) return { success: false, message: '\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 email \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C' };

  let match: boolean;
  if (user.salt) {
    const hash = await sha256Hash(password, user.salt);
    match = hash === user.passwordHash;
  } else {
    match = user.passwordHash === simpleHash(password);
    if (match) {
      user.salt = generateSalt();
      user.passwordHash = await sha256Hash(password, user.salt);
      await db.put('users', user);
    }
  }

  if (!match) return { success: false, message: '\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 email \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C' };

  user.lastLogin = new Date().toISOString();
  await db.put('users', user);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, email: user.email, ts: Date.now() }));
  return { success: true, message: '\u0412\u0445\u043E\u0434 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D', profile: user };
}

export async function logoutUser(): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
}

export async function getCurrentProfile(): Promise<LocalUserProfile | null> {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  try {
    const { id, ts } = JSON.parse(session);
    if (Date.now() - ts > SESSION_DURATION_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const users: LocalUserProfile[] = await db.getAll('users') || [];
    return users.find(u => u.id === id) || null;
  } catch { return null; }
}

export async function getCurrentUser(): Promise<LocalUserProfile | null> {
  return getCurrentProfile();
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<void> {
  const users: LocalUserProfile[] = await db.getAll('users') || [];
  const user = users.find(u => u.id === userId);
  if (user) {
    user.role = newRole;
    await db.put('users', user);
  }
}

export async function getAllProfiles(): Promise<LocalUserProfile[]> {
  return await db.getAll('users') || [];
}