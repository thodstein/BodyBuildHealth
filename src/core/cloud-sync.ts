import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from './db';
import type { LabPoint, DiagnosticEntry } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

export function initCloudSync() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️ Supabase credentials missing. Sync disabled.');
    return null;
  }
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export async function syncLabsToCloud(labs: LabPoint[], userId: string): Promise<void> {
  if (!client) return db.put('labs_log', labs);
  const { error } = await client.from('labs').upsert(
    labs.map(l => ({ ...l, user_id: userId })),
    { onConflict: 'id,user_id' }
  );
  if (error) console.error('Cloud sync error:', error.message);
}

export async function syncDiagnosticsToCloud(dx: DiagnosticEntry[], userId: string): Promise<void> {
  if (!client) return db.put('diagnostics_log', dx);
  const { error } = await client.from('diagnostics').upsert(
    dx.map(d => ({ ...d, user_id: userId })),
    { onConflict: 'id,user_id' }
  );
  if (error) console.error('Cloud sync error:', error.message);
}

export async function fetchCloudData(userId: string): Promise<{ labs: LabPoint[]; dx: DiagnosticEntry[] }> {
  if (!client) return { labs: [], dx: [] };
  const [{ data: labs }, { data: dx }] = await Promise.all([
    client.from('labs').select('*').eq('user_id', userId),
    client.from('diagnostics').select('*').eq('user_id', userId)
  ]);
  return { labs: labs || [], dx: dx || [] };
}

export function isCloudAvailable(): boolean {
  return !!client && navigator.onLine;
}

// Re-export processQueue from sync-queue for main.ts compatibility
export { processQueue } from './sync-queue';