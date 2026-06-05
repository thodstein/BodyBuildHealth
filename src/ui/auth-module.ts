import { loginUser, registerUser } from '../core/auth-manager';
import type { LocalUserProfile } from '../core/auth-manager';
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
  let mode: 'login' | 'register' = 'login';

  const render = () => {
    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'max-width:380px;margin:32px auto;';
    card.innerHTML = `
      <h2 style="text-align:center;margin-bottom:20px;">Health Engine</h2>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button id="tab-login" class="btn secondary" style="flex:1;margin:0;${mode === 'login' ? 'background:var(--accent);color:#0a0a0f;' : ''}">\u0412\u0445\u043E\u0434</button>
        <button id="tab-register" class="btn secondary" style="flex:1;margin:0;${mode === 'register' ? 'background:var(--accent);color:#0a0a0f;' : ''}">\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F</button>
      </div>
      <form id="auth-form">
        <input id="auth-email" type="email" placeholder="Email" autocomplete="email" style="margin-bottom:8px;">
        <input id="auth-pass" type="password" placeholder="\u041F\u0430\u0440\u043E\u043B\u044C (\u043C\u0438\u043D\u0438\u043C\u0443\u043C 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432)" autocomplete="current-password" style="margin-bottom:8px;">
        <input id="auth-name" type="text" placeholder="\u0418\u043C\u044F" style="display:${mode === 'register' ? 'block' : 'none'};margin-bottom:8px;">
        <div id="auth-error" style="color:var(--danger);font-size:13px;text-align:center;min-height:20px;"></div>
        <button type="submit" class="btn" id="auth-submit">${mode === 'login' ? '\u0412\u043E\u0439\u0442\u0438' : '\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F'}</button>
      </form>
      <div style="font-size:11px;color:var(--text-dim);margin-top:16px;text-align:center;">\u0414\u0430\u043D\u043D\u044B\u0435 \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E \u043D\u0430 \u0432\u0430\u0448\u0435\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435<br>\u041F\u0440\u0438 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u043E\u043C Supabase \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u0432 \u043E\u0431\u043B\u0430\u043A\u043E</div>
    `;
    container.appendChild(card);

    const tabLogin = card.querySelector('#tab-login') as HTMLButtonElement;
    const tabRegister = card.querySelector('#tab-register') as HTMLButtonElement;
    const form = card.querySelector('#auth-form') as HTMLFormElement;
    const emailEl = card.querySelector('#auth-email') as HTMLInputElement;
    const passEl = card.querySelector('#auth-pass') as HTMLInputElement;
    const nameEl = card.querySelector('#auth-name') as HTMLInputElement;
    const errEl = card.querySelector('#auth-error') as HTMLDivElement;
    const submitBtn = card.querySelector('#auth-submit') as HTMLButtonElement;

    tabLogin.addEventListener('click', () => { mode = 'login'; render(); });
    tabRegister.addEventListener('click', () => { mode = 'register'; render(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailEl.value.trim();
      const pass = passEl.value;
      const name = nameEl.value.trim();
      errEl.textContent = '';

      if (!email || !pass) {
        errEl.textContent = '\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 email \u0438 \u043F\u0430\u0440\u043E\u043B\u044C';
        return;
      }

      if (pass.length < 8) {
        errEl.textContent = '\u041F\u0430\u0440\u043E\u043B\u044C \u043C\u0438\u043D\u0438\u043C\u0443\u043C 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...';

      try {
        if (mode === 'login') {
          const res = await loginUser(email, pass);
          if (res.success && res.profile) {
            onLogin(toAppProfile(res.profile));
          } else {
            errEl.textContent = res.message;
            submitBtn.disabled = false;
            submitBtn.textContent = '\u0412\u043E\u0439\u0442\u0438';
          }
        } else {
          if (!name) {
            errEl.textContent = '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043C\u044F';
            submitBtn.disabled = false;
            submitBtn.textContent = '\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F';
            return;
          }
          const res = await registerUser(email, pass, name, 'user');
          if (res.success && res.userId) {
            const { getCurrentProfile } = await import('../core/auth-manager');
            const prof = await getCurrentProfile();
            if (prof) onLogin(toAppProfile(prof));
          } else {
            errEl.textContent = res.message;
            submitBtn.disabled = false;
            submitBtn.textContent = '\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F';
          }
        }
      } catch (err) {
        errEl.textContent = '\u041E\u0448\u0438\u0431\u043A\u0430: ' + (err instanceof Error ? err.message : String(err));
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'login' ? '\u0412\u043E\u0439\u0442\u0438' : '\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F';
      }
    });
  };

  render();
}