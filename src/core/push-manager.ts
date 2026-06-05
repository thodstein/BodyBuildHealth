export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

export function scheduleOverdueReminder(checkpointType: string, dueDate: string) {
  if (!('serviceWorker' in navigator)) return;
  const reminder = {
    type: 'lab_reminder',
    checkpoint: checkpointType,
    due: dueDate,
    id: `rem_${checkpointType}_${Date.now()}`
  };
  localStorage.setItem('pending_reminders', JSON.stringify([...getPendingReminders(), reminder]));
}

function getPendingReminders(): any[] {
  try { return JSON.parse(localStorage.getItem('pending_reminders') || '[]'); }
  catch { return []; }
}

export async function triggerLocalPush(title: string, body: string) {
  if (Notification.permission === 'granted') {
    await navigator.serviceWorker.ready;
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.showNotification(title, { body, icon: '/icon.png', tag: 'health-engine' });
  } else {
    console.warn('вљ пёЏ Push permission denied');
  }
}
