import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { db } from "./db";
import type { LabPoint, DiagnosticEntry } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let client: SupabaseClient | null = null;

type SyncTable = 'labs' | 'diagnostics' | 'readiness' | 'risk' | 'fertility' | 'course' | 'nutrition_diary';
const SYNC_TABLES: SyncTable[] = ['labs', 'diagnostics', 'readiness', 'risk', 'fertility', 'course', 'nutrition_diary'];
const LOCAL_STORE_MAP: Record<SyncTable, string> = {
  labs: 'labs_log',
  diagnostics: 'diagnostics_log',
  readiness: 'readiness_log',
  risk: 'risk_log',
  fertility: 'fertility_log',
  course: 'course_log',
  nutrition_diary: 'food_diary'
};
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function getLastSyncTimestamp(table: SyncTable): string | null {
  return localStorage.getItem(`he_sync_ts_${table}`);
}

function setLastSyncTimestamp(table: SyncTable, ts: string): void {
  localStorage.setItem(`he_sync_ts_${table}`, ts);
}

function resolveConflict(localRecord: any, remoteRecord: any): any {
  const localTs = new Date(localRecord.lastUpdated || localRecord.updated_at || 0).getTime();
  const remoteTs = new Date(remoteRecord.lastUpdated || remoteRecord.updated_at || 0).getTime();
  return remoteTs >= localTs ? remoteRecord : localRecord;
}

async function retryWithBackoff<T>(fn: () => Promise<T>, attempt: number = 1): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (attempt >= MAX_RETRIES) throw err;
    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    await new Promise(r => setTimeout(r, delay));
    return retryWithBackoff(fn, attempt + 1);
  }
}

export function initCloudSync() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("вљ пёЏ Supabase credentials missing. Sync disabled.");
    return null;
  }
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export async function checkConnection(): Promise<boolean> {
  if (!client) return false;
  try {
    const { error } = await client.from('labs').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export function isCloudAvailable(): boolean {
  return !!client && navigator.onLine;
}

export async function syncLabsToCloud(labs: LabPoint[], userId: string): Promise<void> {
  await syncTableToCloud('labs', labs, userId);
}

export async function syncDiagnosticsToCloud(dx: DiagnosticEntry[], userId: string): Promise<void> {
  await syncTableToCloud('diagnostics', dx, userId);
}

export async function syncReadinessToCloud(records: any[], userId: string): Promise<void> {
  await syncTableToCloud('readiness', records, userId);
}

export async function syncRiskToCloud(records: any[], userId: string): Promise<void> {
  await syncTableToCloud('risk', records, userId);
}

export async function syncFertilityToCloud(records: any[], userId: string): Promise<void> {
  await syncTableToCloud('fertility', records, userId);
}

export async function syncCourseToCloud(records: any[], userId: string): Promise<void> {
  await syncTableToCloud('course', records, userId);
}

export async function syncNutritionDiaryToCloud(records: any[], userId: string): Promise<void> {
  await syncTableToCloud('nutrition_diary', records, userId);
}

async function syncTableToCloud(table: SyncTable, records: any[], userId: string): Promise<void> {
  const localStore = LOCAL_STORE_MAP[table];
  if (!client) return db.put(localStore, records);
  if (!await checkConnection()) return db.put(localStore, records);

  await retryWithBackoff(async () => {
    const payload = records.map(r => ({ ...r, user_id: userId }));
    const { error } = await client!.from(table).upsert(payload, { onConflict: 'id,user_id' });
    if (error) throw error;
  });

  setLastSyncTimestamp(table, new Date().toISOString());
}

export async function fetchCloudData(userId: string): Promise<{ labs: LabPoint[]; dx: DiagnosticEntry[] }> {
  if (!client) return { labs: [], dx: [] };
  const [{ data: labs }, { data: dx }] = await Promise.all([
    client.from("labs").select("*").eq("user_id", userId),
    client.from("diagnostics").select("*").eq("user_id", userId)
  ]);
  return { labs: labs || [], dx: dx || [] };
}

export async function fetchCloudTable<T>(table: SyncTable, userId: string): Promise<T[]> {
  if (!client) return [];
  if (!await checkConnection()) return [];

  const lastSync = getLastSyncTimestamp(table);
  let query = client.from(table).select("*").eq("user_id", userId);
  if (lastSync) {
    query = query.gte('updated_at', lastSync);
  }

  const { data, error } = await retryWithBackoff(async () => {
    const result = await query;
    if (result.error) throw result.error;
    return result;
  });

  if (error) return [];

  const remoteRecords: any[] = data || [];
  const localStore = LOCAL_STORE_MAP[table];
  const localRecords: any[] = await db.getAll(localStore) || [];

  const localMap = new Map(localRecords.map(r => [r.id, r]));
  const merged: any[] = [];

  for (const remote of remoteRecords) {
    const local = localMap.get(remote.id);
    if (local) {
      merged.push(resolveConflict(local, remote));
      localMap.delete(remote.id);
    } else {
      merged.push(remote);
    }
  }

  for (const [, local] of localMap) {
    merged.push(local);
  }

  if (merged.length > 0) {
    await db.put(localStore, merged);
  }

  setLastSyncTimestamp(table, new Date().toISOString());
  return merged as T[];
}

export async function incrementalSync(userId: string): Promise<void> {
  if (!client || !await checkConnection()) return;

  await Promise.all(SYNC_TABLES.map(table => fetchCloudTable(table, userId)));
}