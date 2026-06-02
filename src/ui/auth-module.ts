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
      <h2 style="text-align:center;margin-bottom:16px;">рџ”ђ Health Engine TZ</h2>
      <div class="tabs" id="auth-tabs">
        <div class="tab active" data-auth="login">Р’С…РѕРґ</div>
        <div class="tab" data-auth="register">Р РµРіРёСЃС‚СЂР°С†РёСЏ</div>
      </div>
      <form id="auth-form" style="margin-top:12px;">
        <input id="auth-email" type="email" placeholder="Email" required style="margin-bottom:6px;">
        <input id="auth-pass" type="password" placeholder="РџР°СЂРѕР»СЊ" required style="margin-bottom:6px;">
        <input id="auth-name" type="text" placeholder="РРјСЏ" style="display:none;margin-bottom:6px;">
        <select id="auth-role" style="display:none;margin-bottom:12px;">
          <option value="user">рџ‘¤ РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ</option>
          <option value="coach">рџЏ‹пёЏ РўСЂРµРЅРµСЂ</option>
          <option value="doctor">рџ‘ЁвЂЌвљ•пёЏ Р’СЂР°С‡</option>
          <option value="admin">вљ™пёЏ РђРґРјРёРЅ</option>
        </select>
        <button type="submit" class="btn" id="auth-btn">Р’РѕР№С‚Рё</button>
        <div id="auth-error" style="color:var(--danger);font-size:13px;margin-top:8px;text-align:center;"></div>
      </form>
      <div style="font-size:11px;color:#666;margin-top:12px;text-align:center;">Р”Р°РЅРЅС‹Рµ С…СЂР°РЅСЏС‚СЃСЏ Р»РѕРєР°Р»СЊРЅРѕ. Р”Р»СЏ РїСЂРѕРґР°РєС€РµРЅР° РїСЂРґРєР»СЋС‡РёС‚Рµ Supabase Auth.</div>
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
      btn.textContent = mode === 'login' ? 'Р’РѕР№С‚Рё' : 'Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊСЃСЏ';
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
      if (!name) { errEl.textContent = 'Р’РІРµРґРёС‚Рµ РёРјСЏ'; return; }
      const role = roleSel.value as UserRole;
      const res = await registerUser(email, pass, name, role);
      if (res.success && res.userId) {
        const prof = await getCurrentProfile();
        if (prof) onLogin(mapAuthProfileToUserProfile(prof));
      } else errEl.textContent = res.message;
    }
  });
}
