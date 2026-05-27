import { registerUser, loginUser, logoutUser, getCurrentProfile, updateUserRole, getAllProfiles } from '../core/auth-manager';
import type { UserProfile, UserRole } from '../core/types';

export async function renderAuthModule(container: HTMLElement, onLogin: (profile: UserProfile) => void) {
  const session = await getCurrentProfile();
  if (session) {
    onLogin(session);
    return;
  }

  container.innerHTML = `
    <div class="card" style="max-width:360px;margin:40px auto;">
      <h2 style="text-align:center;margin-bottom:16px;">🔐 Health Engine TZ</h2>
      <div class="tabs" id="auth-tabs">
        <div class="tab active" data-auth="login">Вход</div>
        <div class="tab" data-auth="register">Регистрация</div>
      </div>
      <form id="auth-form" style="margin-top:12px;">
        <input id="auth-email" type="email" placeholder="Email" required style="margin-bottom:6px;">
        <input id="auth-pass" type="password" placeholder="Пароль" required style="margin-bottom:6px;">
        <input id="auth-name" type="text" placeholder="Имя" style="display:none;margin-bottom:6px;">
        <select id="auth-role" style="display:none;margin-bottom:12px;">
          <option value="user">👤 Пользователь</option>
          <option value="coach">🏋️ Тренер</option>
          <option value="doctor">👨‍⚕️ Врач</option>
          <option value="admin">⚙️ Админ</option>
        </select>
        <button type="submit" class="btn" id="auth-btn">Войти</button>
        <div id="auth-error" style="color:var(--danger);font-size:13px;margin-top:8px;text-align:center;"></div>
      </form>
      <div style="font-size:11px;color:#666;margin-top:12px;text-align:center;">Данные хранятся локально. Для продакшена подключите Supabase Auth.</div>
    </div>
  `;

  const form = container.querySelector('#auth-form') as HTMLFormElement;
  const tabs = container.querySelectorAll('#auth-tabs .tab');
  const errEl = container.querySelector('#auth-error') as HTMLDivElement;
  const nameIn = container.querySelector('#auth-name') as HTMLInputElement;
  const roleSel = container.querySelector('#auth-role') as HTMLSelectElement;
  const btn = container.querySelector('#auth-btn') as HTMLButtonElement;
  let mode: 'login' | 'register' = 'login';

  tabs.forEach(t => {
    t.onclick = () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      mode = t.dataset.auth === 'login' ? 'login' : 'register';
      nameIn.style.display = mode === 'register' ? 'block' : 'none';
      roleSel.style.display = mode === 'register' ? 'block' : 'none';
      btn.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
      errEl.textContent = '';
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = (container.querySelector('#auth-email') as HTMLInputElement).value;
    const pass = (container.querySelector('#auth-pass') as HTMLInputElement).value;
    errEl.textContent = '';

    if (mode === 'login') {
      const res = await loginUser(email, pass);
      if (res.success && res.profile) onLogin(res.profile);
      else errEl.textContent = res.message;
    } else {
      const name = nameIn.value.trim();
      const role = roleSel.value as UserRole;
      if (!name) { errEl.textContent = 'Введите имя'; return; }
      const res = await registerUser(email, pass, name, role);
      if (res.success && res.userId) {
        const prof = await getCurrentProfile();
        if (prof) onLogin(prof);
      } else errEl.textContent = res.message;
    }
  };
}