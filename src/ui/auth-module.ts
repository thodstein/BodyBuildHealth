import type { UserProfile } from '../core/types';
export function renderAuthModule(container: HTMLElement, onLogin: (profile: UserProfile) => void) {
  container.innerHTML = `<div class="card"><h3>🔑 Auth</h3><button id="btn-login" class="btn">Login</button></div>`;
  document.getElementById('btn-login')!.onclick = () => {
    onLogin({ id: 'user_1', name: 'User', email: 'user@tz', role: 'user', phase: 'baseline', courseStartDate: new Date().toISOString(), settings: { age: 30, sex: 'male', weight: 80, goal: 'cut' } });
  };
}
