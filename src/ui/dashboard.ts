import { setRole } from '../core/profile-manager';
import { logoutUser } from '../core/auth-manager';
import type { UserProfile, LabPhaseType } from '../core/types';

export function renderDashboard(profile: UserProfile) {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="header"><h1>📊 Dashboard</h1><button id="btn-logout">🚪</button></div>
    <div class="tabs" id="main-tabs">
      <div class="tab active" data-tab="dash">📈 Ready</div>
      <div class="tab" data-tab="labs">🧪 Labs</div>
      <div class="tab" data-tab="pharma">💊 Pharma</div>
    </div>
    <div id="page-dash" class="page active"><div class="card"><h3>Welcome, ${profile.name}</h3></div></div>
    <div id="page-labs" class="page" style="display:none"><div id="labs-container"></div></div>
    <div id="page-pharma" class="page" style="display:none"><div id="pharma-container"></div></div>
  `;

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.onclick = () => logoutUser();

  document.querySelectorAll('#main-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#main-tabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => (p as HTMLElement).style.display = 'none');
      tab.classList.add('active');
      const tabId = (tab as HTMLElement).dataset.tab;
      const page = document.getElementById(`page-${tabId}`);
      if (page) (page as HTMLElement).style.display = 'block';
    });
  });
}
