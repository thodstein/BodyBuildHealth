import { initDashboard } from './ui/dashboard';

function bootstrap() {
  if(window.Telegram?.WebApp) { window.Telegram.WebApp.ready(); window.Telegram.WebApp.expand(); }
  initDashboard();
}
bootstrap();