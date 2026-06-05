import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
import { securePut } from "./db-encryption";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const STORES = ["labs_log", "nutrition_log", "diagnostics_log"];

let client: ReturnType<typeof createClient> | null = null;
let subscriptions: Record<string, any> = {};

export function initRealtime(userId: string = "user_default") {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return console.warn("вљ пёЏ Supabase credentials missing for Realtime");
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  STORES.forEach(store => {
    const channel = `public:${store}`;
    subscriptions[store] = client!
      .channel(channel)
      .on("postgres_changes", { event: "*", schema: "public", table: store, filter: `user_id=eq.${userId}` }, async (payload) => {
        const record = (payload.new || payload.old) as any;
        if (!record) return;
        // Latest-write-wins: if local newer, skip
        const local = await db.get<any>(store, record.id);
        if (local && new Date(local.updatedAt || local.date) > new Date(record.updated_at || record.date)) return;
        try { await securePut(db, store, { id: record.id, ...record }); }
        catch { await db.put(store, { id: record.id, ...record }); }
      })
      .subscribe();
  });
}

export function stopRealtime() {
  Object.values(subscriptions).forEach(sub => sub?.unsubscribe());
  subscriptions = {};
}

