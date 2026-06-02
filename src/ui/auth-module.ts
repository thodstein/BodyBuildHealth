import { registerUser, loginUser, logoutUser, getCurrentProfile, updateUserRole, getAllProfiles } from '../core/auth-manager';
import type { UserProfile, UserRole } from '../core/types';

function mapAuthProfileToUserProfile(authProfile: { id: string; name: string; role: UserRole; settings: { age: number; weight: number; height: number; sex: 'male' | 'female'; goal: string } }): UserProfile {
  return {
    id: authProfile.id,
    name: authProfile.name,
    role: authProfile.role,
    settings: {
      age: authProfile.settings.age,
      sex: authProfile.settings.sex,
      weight: authProfile.settings.weight,
      goal: authProfile.settings.goal,
      phase: 'baseline',
      courseStartDate: new Date().toISOString().slice(0, 10),
      height: authProfile.settings.height
    }
  };
}

export async function renderAuthModule(container: HTMLElement, onLogin: (profile: UserProfile) => void) {
  const session = await getCurrentProfile();
  if (session) {
    onLogin(mapAuthProfileToUserProfile(session));
    return;
  }

  container.innerHTML = `
    <div class="card" style="max-width:360px;margin:40px auto;">
      <h2 style="text-align:center;margin-bottom:16px;">\u{1F510} Health Engine</h2>
      <div class="tabs" id="auth-tabs">
        <div class="tab active" data-auth="login">\u{0412}\u{0445}\u{043E}\u{0434}</div>
        <div class="tab" data-auth="register">\u{0420}\u{0435}\u{0433}\u{0438}\u{0441}\u{0442}\u{0440}\u{0430}\u{0446}\u{0438}\u{044F}</div>
      </div>
      <form id="auth-form" style="margin-top:12px;">
        <input id="auth-email" type="email" placeholder="Email" required style="margin-bottom:6px;">
        <input id="auth-pass" type="password" placeholder="\u{041F}\u{0430}\u{0440}\u{043E}\u{043B}\u{044C}" required style="margin-bottom:6px;">
        <input id="auth-name" type="text" placeholder="\u{0418}\u{043C}\u{044F}" style="display:none;margin-bottom:6px;">
        <select id="auth-role" style="display:none;margin-bottom:12px;">
          <option value="user">\u{1F464} \u{0410}\u{0442}\u{043B}\u{0435}\u{0442}</option>
          <option value="coach">\u{1F3CB}\u{FE0F} \u{0422}\u{0440}\u{0435}\u{043D}\u{0435}\u{0440}</option>
          <option value="doctor">\u{1F468}\u{200D}\u{2695}\u{FE0F} \u{0412}\u{0440}\u{0430}\u{0447}</option>
          <option value="admin">\u{2699}\u{FE0F} \u{0410}\u{0434}\u{043C}\u{0438}\u{043D}</option>
        </select>
        <button type="submit" class="btn" id="auth-btn">\u{0412}\u{043E}\u{0439}\u{0442}\u{0438}</button>
        <div id="auth-error" style="color:var(--danger);font-size:13px;margin-top:8px;text-align:center;"></div>
      </form>
      <div style="font-size:11px;color:#666;margin-top:12px;text-align:center;">\u{0414}\u{0430}\u{043D}\u{043D}\u{044B}\u{0435} \u{0445}\u{0440}\u{0430}\u{043D}\u{044F}\u{0442}\u{0441}\u{044F} \u{043B}\u{043E}\u{043A}\u{0430}\u{043B}\u{044C}\u{043D}\u{043E}.</div>
    </div>
  `;

  const form = container.querySelector('#auth-form') as HTMLFormElement | null;
  const tabs = container.querySelectorAll('#auth-tabs .tab');
  const errEl = container.querySelector('#auth-error') as HTMLDivElement | null;
  const nameIn = container.querySelector('#auth-name') as HTMLInputElement | null;
  const roleSel = container.querySelector('#auth-role') as HTMLSelectElement | null;
  const btn = container.querySelector('#auth-btn') as HTMLButtonElement | null;
  if (!form || !errEl || !nameIn || !roleSel || !btn) return;
  let mode: 'login' | 'register' = 'login';

  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const authAttr = t.getAttribute('data-auth');
      mode = authAttr === 'login' ? 'login' : 'register';
      nameIn.style.display = mode === 'register' ? 'block' : 'none';
      roleSel.style.display = mode === 'register' ? 'block' : 'none';
      btn.textContent = mode === 'login' ? '\u0412\u043E\u0439\u0442\u0438' : '\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F';
      errEl.textContent = '';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailEl = container.querySelector('#auth-email') as HTMLInputElement | null;
    const passEl = container.querySelector('#auth-pass') as HTMLInputElement | null;
    if (!emailEl || !passEl) return;
    const email = emailEl.value;
    const pass = passEl.value;
    errEl.textContent = '';

    if (mode === 'login') {
      const res = await loginUser(email, pass);
      if (res.success && res.profile) onLogin(mapAuthProfileToUserProfile(res.profile));
      else errEl.textContent = res.message;
    } else {
      if (!nameIn) return;
      const name = nameIn.value.trim();
      if (!name) { errEl.textContent = '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043C\u044F'; return; }
      const role = roleSel.value as UserRole;
      const res = await registerUser(email, pass, name, role);
      if (res.success && res.userId) {
        const prof = await getCurrentProfile();
        if (prof) onLogin(mapAuthProfileToUserProfile(prof));
      } else errEl.textContent = res.message;
    }
  });
}