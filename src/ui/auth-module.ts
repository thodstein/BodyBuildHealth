import { db } from '../core/db';
import type { LocalUserProfile } from '../core/auth-manager';
import { ensureAdmin } from '../core/auth-manager';
import type { UserProfile, UserRole } from '../core/types';

function toAppProfile(p: LocalUserProfile): UserProfile {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    settings: {
      age: p.settings.age,
      sex: p.settings.sex,
      weight: p.settings.weight,
      goal: p.settings.goal,
      phase: 'baseline',
      courseStartDate: new Date().toISOString().slice(0, 10),
      height: p.settings.height,
    },
  };
}

export async function renderAuthModule(container: HTMLElement, onLogin: (profile: UserProfile) => void) {
  // Try Telegram WebApp auth first
  const tg = (window as any).Telegram?.WebApp;
  if (tg) {
    const tgUser = tg.initDataUnsafe?.user;
    if (tgUser) {
      // Telegram user detected — auto-login
      const userId = 'tg_' + tgUser.id;
      const userName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
      const userNameLower = tgUser.username || userName;

      // Create or find user in local DB
      const users: LocalUserProfile[] = await db.getAll('users') || [];
      let user = users.find(u => u.id === userId);

      if (!user) {
        user = {
          id: userId,
          email: (tgUser.username || userId) + '@telegram',
          name: userName,
          passwordHash: '',
          salt: '',
          role: 'user',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          settings: { age: 25, weight: 80, height: 180, sex: 'male', goal: 'bulk' },
        };
        await db.put('users', user);
      } else {
        user.lastLogin = new Date().toISOString();
        user.name = userName;
        await db.put('users', user);
      }

      localStorage.setItem('he_session_v2', JSON.stringify({ id: user.id, email: user.email, ts: Date.now() }));
      onLogin(toAppProfile(user));
      return;
    }
  }

  // Fallback: auto-login with local profile (no registration form)
  const users: LocalUserProfile[] = await db.getAll('users') || [];
  let user = users.find(u => u.role === 'admin') || users[0];

  if (!user) {
    // Create default user
    // Auto-create without password
    const defaultUser: LocalUserProfile = {
      id: crypto.randomUUID(),
      email: 'user@local',
      name: 'Пользователь',
      passwordHash: '',
      salt: '',
      role: 'user',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      settings: { age: 25, weight: 80, height: 180, sex: 'male', goal: 'bulk' },
    };
    await db.put('users', defaultUser);
    user = defaultUser;
  }

  user.lastLogin = new Date().toISOString();
  await db.put('users', user);
  localStorage.setItem('he_session_v2', JSON.stringify({ id: user.id, email: user.email, ts: Date.now() }));
  onLogin(toAppProfile(user));
}
