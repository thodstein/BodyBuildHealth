import { db } from './db';
import type { UserRole } from './types';

const SESSION_KEY = 'he_session_v2';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const ADMIN_PASSWORD_KEY = 'he_admin_seeded';

export async function ensureAdmin(email: string, password: string, name: string, role: UserRole = 'admin'): Promise<void> {
  const seeded = localStorage.getItem(ADMIN_PASSWORD_KEY);
  const users: UserProfile[] = await db.getAll('users') || [];
  const existing = users.find(u => u.email === email.toLowerCase());
  if (existing) {
    if (seeded !== 'v1') {
      existing.salt = existing.salt || generateSalt();
      existing.passwordHash = await sha256Hash(password, existing.salt);
      existing.lastLogin = existing.lastLogin;
      await db.put('users', existing);
      localStorage.setItem(ADMIN_PASSWORD_KEY, 'v1');
    }
    return;
  }
  const res = await registerUser(email, password, name, role);
  if (res.success) localStorage.setItem(ADMIN_PASSWORD_KEY, 'v1');
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  createdAt: string;
  lastLogin: string;
  settings: { age: number; weight: number; height: number; sex: 'male'|'female'; goal: string };
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hash(password: string, salt: string): Promise<string> {
  const encoded = new TextEncoder().encode(password + salt);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  const arr = new Uint8Array(buffer);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8) return { valid: false, message: 'Пароль должен содержать минимум 8 символов' };
  if (!/[A-ZА-Я]/.test(password)) return { valid: false, message: 'Пароль должен содержать хотя бы одну заглавную букву' };
  if (!/\d/.test(password)) return { valid: false, message: 'Пароль должен содержать хотя бы одну цифру' };
  return { valid: true, message: '' };
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i) | 0;
  return hash.toString(36);
}

export async function registerUser(email: string, password: string, name: string, role: UserRole = 'user'): Promise<{ success: boolean; message: string; userId?: string }> {
  const validation = validatePassword(password);
  if (!validation.valid) return { success: false, message: validation.message };

  const users: UserProfile[] = await db.getAll('users') || [];
  if (users.some(u => u.email === email.toLowerCase())) return { success: false, message: 'Пользователь уже существует' };

  const salt = generateSalt();
  const passwordHash = await sha256Hash(password, salt);

  const user: UserProfile = {
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
  return { success: true, message: 'Регистрация успешна', userId: user.id };
}

export async function loginUser(email: string, password: string): Promise<{ success: boolean; message: string; profile?: UserProfile }> {
  const users: UserProfile[] = await db.getAll('users') || [];
  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) return { success: false, message: 'Неверный email или пароль' };

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

  if (!match) return { success: false, message: 'Неверный email или пароль' };

  user.lastLogin = new Date().toISOString();
  await db.put('users', user);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, email: user.email, ts: Date.now() }));
  return { success: true, message: 'Вход выполнен', profile: user };
}

export async function logoutUser(): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  return getCurrentProfile();
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  try {
    const { id, ts } = JSON.parse(session);
    if (Date.now() - ts > SESSION_DURATION_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const users: UserProfile[] = await db.getAll('users') || [];
    return users.find(u => u.id === id) || null;
  } catch { return null; }
}

export async function telegramLogin(initData: string): Promise<{ success: boolean; message: string; profile?: UserProfile }> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { success: false, message: 'Неверные данные Telegram' };

  const telegramUserId = params.get('id') || '';
  const userName = params.get('first_name') || params.get('username') || 'Telegram User';
  const telegramEmail = `tg_${telegramUserId}@telegram.user`;

  const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '';
  if (!BOT_TOKEN) return { success: false, message: 'Telegram авторизация не настроена' };

  const checkString = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.digest('SHA-256', encoder.encode(BOT_TOKEN));
  const key = await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(checkString));
  const computedHash = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (computedHash !== hash) return { success: false, message: 'Ошибка проверки подписи Telegram' };

  const users: UserProfile[] = await db.getAll('users') || [];
  let user = users.find(u => u.email === telegramEmail);

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email: telegramEmail,
      name: userName,
      passwordHash: '',
      salt: '',
      role: 'user',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      settings: { age: 30, weight: 80, height: 180, sex: 'male', goal: 'bulk' }
    };
    await db.put('users', user);
  } else {
    user.lastLogin = new Date().toISOString();
    await db.put('users', user);
  }

  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, email: user.email, ts: Date.now() }));
  return { success: true, message: 'Вход через Telegram выполнен', profile: user };
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<void> {
  const users: UserProfile[] = await db.getAll('users') || [];
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

export async function getAllProfiles(): Promise<UserProfile[]> {
  return await db.getAll('users') || [];
}