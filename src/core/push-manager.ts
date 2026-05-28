export function initPushManager() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('✅ SW registered');
      (window as any).swRegistration = reg;
    }).catch(err => console.warn('⚠️ SW failed:', err));
  }
}
