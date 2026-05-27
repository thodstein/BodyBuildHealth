import { db } from '../core/db';
import { getProfile, updateProfile } from '../core/profile-manager';
import { setRole } from '../core/profile-manager';
import type { UserProfile, LabPhaseType, UserRole } from '../core/types';

export async function renderSettingsModule(container: HTMLElement, profile: UserProfile, onProfileUpdate: (p: UserProfile) => void) {
  const p = profile.settings;
  container.innerHTML = `
    <div class="card"><h3>👤 Профиль & Цели</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <input id="set-name" type="text" value="${profile.name}" placeholder="Имя" style="margin:0;">
        <input id="set-email" type="email" value="${profile.email}" placeholder="Email" style="margin:0;" disabled>
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
        <input id="set-phase" type="text" value="${profile.phase||'course'}" placeholder="Фаза (course/pct/bridge)" style="margin:0;">
        <input id="set-start" type="date" value="${profile.courseStartDate||new Date().toISOString().slice(0,10)}" style="margin:0;">
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

  document.getElementById('save-profile')!.onclick = async () => {
    const ageEl = document.getElementById('set-age') as HTMLInputElement;
    const sexEl = document.getElementById('set-sex') as HTMLInputElement;
    const weightEl = document.getElementById('set-weight') as HTMLInputElement;
    const heightEl = document.getElementById('set-height') as HTMLInputElement;
    const bfEl = document.getElementById('set-bf') as HTMLInputElement;
    const goalEl = document.getElementById('set-goal') as HTMLInputElement;
    const nameEl = document.getElementById('set-name') as HTMLInputElement;
    
    const updates: Partial<UserProfile['settings']> = {
      age: parseInt(ageEl.value),
      sex: sexEl.value as 'male' | 'female',
      weight: parseFloat(weightEl.value),
      height: parseFloat(heightEl.value),
      bodyFat: parseFloat(bfEl.value) || undefined,
      goal: goalEl.value as string
    };
    const newProf: UserProfile = { ...profile, name: nameEl.value, settings: { ...p, ...updates } };
    onProfileUpdate(newProf);
    alert('✅ Профиль обновлён');
  };

  document.getElementById('save-phase')!.onclick = () => {
    const phaseEl = document.getElementById('set-phase') as HTMLInputElement;
    const startEl = document.getElementById('set-start') as HTMLInputElement;
    const roleEl = document.getElementById('set-role') as HTMLInputElement;
    
    updateProfile({
      phase: phaseEl.value as LabPhaseType,
      courseStartDate: startEl.value
    });
    setRole(roleEl.value as UserRole);
    onProfileUpdate(getProfile() as any);
    alert('🔄 Фаза и роль обновлены. Перезагрузите вкладку.');
  };

  document.getElementById('toggle-push')!.onclick = async () => {
    const perm = await Notification.requestPermission();
    alert(perm === 'granted' ? '🔔 Уведомления включены' : '🔕 Отключены');
  };
  document.getElementById('force-sync')!.onclick = async () => {
    import('../core/cloud-sync').then(m => m.processQueue().then(() => alert('☁️ Синхронизация запущена')));
  };
  document.getElementById('reset-data')!.onclick = () => {
    if (confirm('⚠️ Удалить ВСЕ локальные данные? Это действие необратимо.')) {
      indexedDB.deleteDatabase('HealthEngineDB_v2');
      localStorage.clear();
      window.location.reload();
    }
  };
}