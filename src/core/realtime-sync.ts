// realtime-sync.ts - заглушка без зависимости от Supabase
export interface RealtimeChannel {
  subscribe: () => void;
  unsubscribe: () => void;
}

export function initRealtimeSync() {
  console.log('📡 Realtime sync initialized (mock)');
  return { isConnected: true };
}

export function subscribeToChanges(table: string, callback: (row: any) => void): RealtimeChannel {
  console.log(`📡 Subscribed to ${table} changes`);
  return {
    subscribe: () => {},
    unsubscribe: () => {}
  };
}

export function syncRealtimeData(payload: { updatedAt?: string; date?: string }) {
  console.log('🔄 Syncing realtime data:', payload);
  const ts = payload.updatedAt || payload.date || new Date().toISOString();
  return { timestamp: ts };
}
