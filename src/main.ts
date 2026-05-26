// Минимальная точка входа — гарантированно работает
import { renderDashboard } from './ui/dashboard';

function bootstrap() {
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }
  renderDashboard();
  console.log('✅ Health Engine minimal loaded');
}

bootstrap();
