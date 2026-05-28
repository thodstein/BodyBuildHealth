import { renderAuthModule } from './ui/auth-module';
import { renderDashboard } from './ui/dashboard';
import { db } from './core/db';
import { initPWA } from './core/pwa-manager';
import { initCloudSync, processQueue } from './core/cloud-sync';
import { initErrorHandler } from './core/error-handler';

async function bootstrap() {
  const app = document.getElementById('app');
  if (!app) { document.body.innerHTML = '<div style="color:#ff453a">⚠️ #app not found</div>'; return; }

  try { await db.init(); } catch(e) { console.warn('DB init:', e); }
  initCloudSync();
  initErrorHandler('app');

  const onLogin = (profile: any) => renderDashboard(profile);
  renderAuthModule(app, onLogin);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
else bootstrap();

window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') processQueue();
});
