import { createClient } from '@supabase/supabase-js';
import { db } from './db';

const QUEUE_STORE = 'sync_queue';
const MAX_RETRIES = 5;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface QueueItem {
  id: string;
  table: string;
  data: any;
  createdAt: number;
  retries: number;
}

let client: ReturnType<typeof createClient> | null = null;
if (SUPABASE_URL && SUPABASE_ANON) {
  client = createClient(SUPABASE_URL, SUPABASE_ANON);
}

export async function enqueueSync(table: string, data: any): Promise<void> {
  const item: QueueItem = {
    id: crypto.randomUUID(),
    table,
    data,
    createdAt: Date.now(),
    retries: 0
  };
  await db.put(QUEUE_STORE, item);
  processQueue();
}

export async function processQueue(): Promise<void> {
  if (!client || !navigator.onLine) return;
  const items: QueueItem[] = await db.getAll(QUEUE_STORE) || [];
  if (!items.length) return;

  const byTable: Record<string, QueueItem[]> = {};
  items.forEach(i => {
    if (!byTable[i.table]) byTable[i.table] = [];
    byTable[i.table].push(i);
  });

  for (const [table, batch] of Object.entries(byTable)) {
    try {
      const { error } = await (client!.from(table) as any).upsert(
        batch.map(b => ({ ...b.data, id: b.data.id || b.id })),
        { onConflict: 'id' }
      );
      if (error) throw new Error(error.message);

      for (const b of batch) await db.delete(QUEUE_STORE, b.id);
    } catch (err) {
      console.warn('⚠️ Sync batch failed:', err);
      for (const b of batch) {
        b.retries++;
        if (b.retries > MAX_RETRIES) {
          b.data.sync_status = 'failed';
          await db.put(QUEUE_STORE, b);
        } else {
          await db.put(QUEUE_STORE, b);
        }
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', processQueue);
  setInterval(processQueue, 1000 * 60 * 5);
}

