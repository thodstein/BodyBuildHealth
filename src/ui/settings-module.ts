import { db } from '../core/db';
import { getProfile, updateProfile } from '../core/profile-manager';
import { setRole } from '../core/profile-manager';
import type { UserProfile, LabPhaseType, UserRole, LabPoint } from '../core/types';

export async function renderSettingsModule(container: HTMLElement, profile: UserProfile, onProfileUpdate: (p: UserProfile) => void) {
  const p = profile.settings;
  container.innerHTML = `
    <div class="card"><h3>👤 Профиль & Цели</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <input id="set-name" type="text" value="${profile.name}" placeholder="Имя" style="margin:0;">
        <input id="set-email" type="email" value="${profile.settings.email || ''}" placeholder="Email" style="margin:0;" disabled>
        <input id="set-age" type="number" value="${p.age}" min="16" max="90" placeholder="Возраст" style="margin:0;">
        <select id="set-sex" style="margin:0;"><option value="male" ${p.sex==='male'?'selected':''}>Муж</option><option value="female" ${p.sex==='female'?'selected':''}>Жен</option></select>
        <input id="set-weight" type="number" step="0.1" value="${p.weight}" placeholder="Вес (кг)" style="margin:0;">
        <input id="set-height" type="number" value="${p.height}" placeholder="Рост (см)" style="margin:0;">
        <input id="set-bf" type="number" step="0.1" value="${p.bodyFat||''}" placeholder="% жира (опц.)" style="margin:0;">
        <select id="set-goal" style="margin:0;">
          <option value="cut" ${p.goal==='cut'?'selected':''}>Сушка</option><option value="bulk" ${p.goal==='bulk'?'selected':''}>Набор</option>
          <option value="maintenance" ${p.goal==='maintenance'?'selected':''}>Поддержание</option><option value="recomp" ${p.goal==='recomp'?'selected':''}>Рекомпозиция</option>
        </select>
      </div>
      <button class="btn" id="save-profile" style="margin-top:12px;">💾 Сохранить профиль</button>
    </div>

    <div class="card" style="margin-top:12px;"><h3>📅 Курс & Фаза</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <input id="set-phase" type="text" value="${profile.settings.phase||'course'}" placeholder="Фаза (course/pct/bridge)" style="margin:0;">
        <input id="set-start" type="date" value="${profile.settings.courseStartDate||new Date().toISOString().slice(0,10)}" style="margin:0;">
        <input id="set-duration" type="number" value="12" min="4" max="52" placeholder="Длительность (нед)" style="margin:0;">
        <select id="set-role" style="margin:0;">
          <option value="user" ${profile.role==='user'?'selected':''}>👤 Пользователь</option>
          <option value="coach" ${profile.role==='coach'?'selected':''}>🏋️ Тренер</option>
          <option value="doctor" ${profile.role==='doctor'?'selected':''}>👨‍⚕️ Врач</option>
        </select>
      </div>
      <button class="btn" id="save-phase" style="margin-top:12px;">🔄 Обновить фазу</button>
    </div>

    <div class="card" style="margin-top:12px;"><h3>⚙️ Система</h3>
      <div class="row" style="margin:8px 0;"><span class="label">🔔 Push-уведомления</span><button class="btn" style="width:auto;margin:0;padding:6px 12px;" id="toggle-push">Вкл/Выкл</button></div>
      <div class="row" style="margin:8px 0;"><span class="label">🔐 Шифрование данных</span><span class="value" style="color:var(--success);">AES-GCM ✅</span></div>
      <div class="row" style="margin:8px 0;"><span class="label">☁️ Облачная синхронизация</span><button class="btn" style="width:auto;margin:0;padding:6px 12px;" id="force-sync">Синхронизировать</button></div>
      <div class="row" style="margin:8px 0;"><span class="label">🗑️ Сбросить все данные</span><button class="btn" style="width:auto;margin:0;padding:6px 12px;background:var(--danger);color:#fff;" id="reset-data">Сброс</button></div>
    </div>
  `;

  const saveProfileBtn = container.querySelector('#save-profile') as HTMLButtonElement | null;
  const savePhaseBtn = container.querySelector('#save-phase') as HTMLButtonElement | null;
  const togglePushBtn = container.querySelector('#toggle-push') as HTMLButtonElement | null;
  const forceSyncBtn = container.querySelector('#force-sync') as HTMLButtonElement | null;
  const resetDataBtn = container.querySelector('#reset-data') as HTMLButtonElement | null;

  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', async () => {
      const nameInput = container.querySelector('#set-name') as HTMLInputElement | null;
      const ageInput = container.querySelector('#set-age') as HTMLInputElement | null;
      const sexSelect = container.querySelector('#set-sex') as HTMLSelectElement | null;
      const weightInput = container.querySelector('#set-weight') as HTMLInputElement | null;
      const heightInput = container.querySelector('#set-height') as HTMLInputElement | null;
      const bfInput = container.querySelector('#set-bf') as HTMLInputElement | null;
      const goalSelect = container.querySelector('#set-goal') as HTMLSelectElement | null;
      if (!nameInput || !ageInput || !sexSelect || !weightInput || !heightInput || !bfInput || !goalSelect) return;
      const updates: Partial<UserProfile['settings']> = {
        age: parseInt(ageInput.value),
        sex: sexSelect.value as 'male' | 'female',
        weight: parseFloat(weightInput.value),
        height: parseFloat(heightInput.value),
        bodyFat: bfInput.value ? parseFloat(bfInput.value) : undefined,
        goal: goalSelect.value as 'cut' | 'bulk' | 'maintenance' | 'recomp'
      };
      const newProf = updateProfile({ ...profile, name: nameInput.value, settings: { ...p, ...updates } });
      onProfileUpdate(newProf);
      alert('✅ Профиль обновлён');
    });
  }

  if (savePhaseBtn) {
    savePhaseBtn.addEventListener('click', () => {
      const phaseInput = container.querySelector('#set-phase') as HTMLInputElement | null;
      const startInput = container.querySelector('#set-start') as HTMLInputElement | null;
      const roleSelect = container.querySelector('#set-role') as HTMLSelectElement | null;
      if (!phaseInput || !startInput || !roleSelect) return;
      updateProfile({
        settings: {
          ...profile.settings,
          phase: phaseInput.value as LabPhaseType,
          courseStartDate: startInput.value
        }
      });
      setRole(roleSelect.value as UserRole);
      onProfileUpdate(getProfile() as any);
      alert('🔄 Фаза и роль обновлены. Перезагрузите вкладку.');
    });
  }

  if (togglePushBtn) {
    togglePushBtn.addEventListener('click', async () => {
      const perm = await Notification.requestPermission();
      alert(perm === 'granted' ? '🔔 Уведомления включены' : '🔕 Отключены');
    });
  }

  if (forceSyncBtn) {
    forceSyncBtn.addEventListener('click', async () => {
      import('../core/cloud-sync').then(async m => {
        const client = await m.initCloudSync();
        if (!client) {
          alert('⚠️ Облачная синхронизация недоступна. Supabase не настроен — проверьте переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.');
          return;
        }
        const labs = (await db.getAll('labs_log')) as LabPoint[];
        await m.syncLabsToCloud(labs, profile.id);
        alert('☁️ Синхронизация выполнена');
      });
    });
  }

  if (resetDataBtn) {
    resetDataBtn.addEventListener('click', () => {
      if (confirm('⚠️ Удалить ВСЕ локальные данные? Это действие необратимо.')) {
        indexedDB.deleteDatabase('HealthEngineDB_v3');
        localStorage.clear();
        window.location.reload();
      }
    });
  }
}
