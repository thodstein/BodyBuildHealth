/**
 * health-diary.engine.ts — Единый дневник здоровья.
 * Объединяет: боль в суставах, симптомы, нейросимптомы, акне, гематологию.
 * Без дублирования: одна запись на дату, внутри — все категории.
 */

import { PAIN_ZONE_LIST } from '../ui/screens/ProfileScreen_v2/diary-helpers';

const LEGACY_KEYS = [
  'he_pain_diary',
  'he_symptoms_diary',
  'he_neuro_diary',
  'he_acne_diary',
  'he_hemato_diary',
];

const UNIFIED_KEY = 'he_health_diary';
const MIGRATION_FLAG = 'he_health_diary_migrated_v1';

export interface UnifiedHealthEntry {
  id: string;
  date: string;
  pain: {
    zones: Record<string, number>;
    totalScore: number;
    timeOfDay?: string;
    painType?: string;
    triggers?: string[];
    relief?: string[];
    duration?: string;
    linkedExercise?: string;
  } | null;
  symptoms: Array<{
    id: string;
    name: string;
    severity: 1 | 2 | 3 | 4 | 5;
    duration?: string;
  }>;
  neuro: {
    symptoms: Record<string, boolean>;
    totalScore: number;
  } | null;
  acne: {
    areas: Record<string, number>;
    totalScore: number;
  } | null;
  hemato: {
    symptoms: Record<string, boolean>;
    totalScore: number;
  } | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface LegacyPainEntry {
  date: string;
  zones: Record<string, number>;
  totalScore: number;
  notes?: string;
  timeOfDay?: string;
  painType?: string;
  triggers?: string[];
  relief?: string[];
  duration?: string;
  linkedExercise?: string;
}

interface LegacySymptomEntry {
  date: string;
  name: string;
  severity: 1 | 2 | 3 | 4 | 5;
  duration?: string;
  notes?: string;
}

interface LegacyNeuroEntry {
  date: string;
  symptoms: Record<string, boolean>;
  totalScore: number;
  notes?: string;
}

interface LegacyAcneEntry {
  date: string;
  areas: Record<string, number>;
  totalScore: number;
  notes?: string;
}

interface LegacyHematoEntry {
  date: string;
  symptoms: Record<string, boolean>;
  totalScore: number;
  notes?: string;
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function safeParse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

function hasMigrated(): boolean {
  return localStorage.getItem(MIGRATION_FLAG) === '1';
}

function markMigrated() {
  try {
    localStorage.setItem(MIGRATION_FLAG, '1');
  } catch {}
}

function migrateLegacyEntries(): UnifiedHealthEntry[] {
  const entries: UnifiedHealthEntry[] = [];
  const byDate = new Map<string, UnifiedHealthEntry>();

  const pain: LegacyPainEntry[] = safeParse('he_pain_diary', []);
  const symptoms: LegacySymptomEntry[] = safeParse('he_symptoms_diary', []);
  const neuro: LegacyNeuroEntry[] = safeParse('he_neuro_diary', []);
  const acne: LegacyAcneEntry[] = safeParse('he_acne_diary', []);
  const hemato: LegacyHematoEntry[] = safeParse('he_hemato_diary', []);

  const upsert = (date: string, updater: (e: UnifiedHealthEntry) => void) => {
    let entry = byDate.get(date);
    if (!entry) {
      entry = {
        id: generateId(),
        date,
        pain: null,
        symptoms: [],
        neuro: null,
        acne: null,
        hemato: null,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      byDate.set(date, entry);
    }
    updater(entry);
    entry.updatedAt = new Date().toISOString();
  };

  for (const p of pain) {
    upsert(p.date, (e) => {
      e.pain = {
        zones: p.zones || {},
        totalScore: p.totalScore || 0,
        timeOfDay: p.timeOfDay,
        painType: p.painType,
        triggers: p.triggers,
        relief: p.relief,
        duration: p.duration,
        linkedExercise: p.linkedExercise,
      };
      if (p.notes && !e.notes) e.notes = p.notes;
    });
  }

  for (const s of symptoms) {
    upsert(s.date, (e) => {
      e.symptoms.push({
        id: generateId(),
        name: s.name,
        severity: s.severity,
        duration: s.duration,
      });
      if (s.notes && !e.notes) e.notes = s.notes;
    });
  }

  for (const n of neuro) {
    upsert(n.date, (e) => {
      e.neuro = {
        symptoms: n.symptoms || {},
        totalScore: n.totalScore || 0,
      };
      if (n.notes && !e.notes) e.notes = n.notes;
    });
  }

  for (const a of acne) {
    upsert(a.date, (e) => {
      e.acne = {
        areas: a.areas || {},
        totalScore: a.totalScore || 0,
      };
      if (a.notes && !e.notes) e.notes = a.notes;
    });
  }

  for (const h of hemato) {
    upsert(h.date, (e) => {
      e.hemato = {
        symptoms: h.symptoms || {},
        totalScore: h.totalScore || 0,
      };
      if (h.notes && !e.notes) e.notes = h.notes;
    });
  }

  entries.push(...byDate.values());
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

export function getUnifiedHealthEntries(): UnifiedHealthEntry[] {
  if (!hasMigrated()) {
    const migrated = migrateLegacyEntries();
    saveUnifiedHealthEntries(migrated);
    markMigrated();
    return migrated;
  }
  return safeParse(UNIFIED_KEY, []);
}

export function saveUnifiedHealthEntries(entries: UnifiedHealthEntry[]): void {
  try {
    localStorage.setItem(UNIFIED_KEY, JSON.stringify(entries.slice(-365)));
  } catch {}
}

export function addUnifiedHealthEntry(entry: Omit<UnifiedHealthEntry, 'id' | 'createdAt' | 'updatedAt'>): UnifiedHealthEntry[] {
  const entries = getUnifiedHealthEntries();
  const existingIdx = entries.findIndex(e => e.date === entry.date);
  const now = new Date().toISOString();
  
  const newEntry: UnifiedHealthEntry = {
    ...entry,
    id: existingIdx >= 0 ? entries[existingIdx].id : generateId(),
    createdAt: existingIdx >= 0 ? entries[existingIdx].createdAt : now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    entries[existingIdx] = newEntry;
  } else {
    entries.unshift(newEntry);
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  saveUnifiedHealthEntries(entries);
  return entries;
}

export function updateUnifiedHealthEntry(date: string, updater: (e: UnifiedHealthEntry) => void): UnifiedHealthEntry[] {
  const entries = getUnifiedHealthEntries();
  const idx = entries.findIndex(e => e.date === date);
  if (idx < 0) return entries;
  
  updater(entries[idx]);
  entries[idx].updatedAt = new Date().toISOString();
  saveUnifiedHealthEntries(entries);
  return entries;
}

export function deleteUnifiedHealthEntry(date: string): UnifiedHealthEntry[] {
  const entries = getUnifiedHealthEntries().filter(e => e.date !== date);
  saveUnifiedHealthEntries(entries);
  return entries;
}

export function getUnifiedEntryByDate(date: string): UnifiedHealthEntry | null {
  return getUnifiedHealthEntries().find(e => e.date === date) || null;
}

export function getTodayUnifiedEntry(): UnifiedHealthEntry | null {
  return getUnifiedEntryByDate(todayIso());
}

export function resetUnifiedHealthDiary(): void {
  try {
    localStorage.removeItem(UNIFIED_KEY);
    localStorage.removeItem(MIGRATION_FLAG);
  } catch {}
}

// ─── Stats helpers ──────────────────────────────────────────────────

export function getUnifiedPainStats(entries: UnifiedHealthEntry[]) {
  const painEntries = entries.filter(e => e.pain && e.pain.totalScore > 0);
  if (painEntries.length === 0) return null;
  
  const scores = painEntries.map(e => e.pain!.totalScore);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  const max = scores.length > 0 ? Math.max(...scores) : 0;
  
  const zoneValues: Record<string, number[]> = {};
  for (const z of PAIN_ZONE_LIST) zoneValues[z.id] = [];
  for (const e of painEntries) {
    for (const z of PAIN_ZONE_LIST) {
      const v = e.pain!.zones[z.id];
      if (Number.isFinite(v)) zoneValues[z.id].push(v);
    }
  }
  
  const zoneStats = PAIN_ZONE_LIST.map(z => {
    const vals = zoneValues[z.id];
    const last = vals.length > 0 ? vals[vals.length - 1] : 0;
    const prev = vals.length > 1 ? vals[vals.length - 2] : last;
    const trend: 'up' | 'down' | 'same' = last > prev + 0.3 ? 'up' : last < prev - 0.3 ? 'down' : 'same';
    const avgZ = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    return { zoneId: z.id, label: z.label, avg: avgZ, last, trend };
  });

  return {
    count: painEntries.length,
    avg: Math.round(avg * 10) / 10,
    max,
    zoneStats,
  };
}

export function getUnifiedSymptomsStats(entries: UnifiedHealthEntry[]) {
  const allSymptoms = entries.flatMap(e => e.symptoms);
  if (allSymptoms.length === 0) return null;
  
  const byName = new Map<string, { count: number; totalSeverity: number }>();
  for (const s of allSymptoms) {
    const existing = byName.get(s.name) || { count: 0, totalSeverity: 0 };
    byName.set(s.name, { count: existing.count + 1, totalSeverity: existing.totalSeverity + s.severity });
  }
  
  const top = Array.from(byName.entries())
    .map(([name, data]) => ({ name, count: data.count, avgSeverity: Math.round((data.totalSeverity / data.count) * 10) / 10 }))
    .sort((a, b) => b.count - a.count);
  
  return {
    total: allSymptoms.length,
    uniqueNames: byName.size,
    top: top.slice(0, 10),
  };
}

export function getUnifiedNeuroStats(entries: UnifiedHealthEntry[]) {
  const neuroEntries = entries.filter(e => e.neuro && e.neuro.totalScore > 0);
  if (neuroEntries.length === 0) return null;
  
  const scores = neuroEntries.map(e => e.neuro!.totalScore);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  
  return {
    count: neuroEntries.length,
    avg: Math.round(avg * 10) / 10,
    max: Math.max(...scores),
  };
}

export function getUnifiedAcneStats(entries: UnifiedHealthEntry[]) {
  const acneEntries = entries.filter(e => e.acne && e.acne.totalScore > 0);
  if (acneEntries.length === 0) return null;
  
  const scores = acneEntries.map(e => e.acne!.totalScore);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  
  return {
    count: acneEntries.length,
    avg: Math.round(avg * 10) / 10,
    max: Math.max(...scores),
  };
}

export function getUnifiedHematoStats(entries: UnifiedHealthEntry[]) {
  const hematoEntries = entries.filter(e => e.hemato && e.hemato.totalScore > 0);
  if (hematoEntries.length === 0) return null;
  
  const scores = hematoEntries.map(e => e.hemato!.totalScore);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  
  return {
    count: hematoEntries.length,
    avg: Math.round(avg * 10) / 10,
    max: Math.max(...scores),
  };
}

export function getUnifiedTodayStatus(entries: UnifiedHealthEntry[]): { status: 'ok' | 'watch' | 'alert'; message: string; color: string } | null {
  const today = todayIso();
  const todayEntry = entries.find(e => e.date === today);
  if (!todayEntry) return null;

  const issues: string[] = [];
  let maxSeverity: 'ok' | 'watch' | 'alert' = 'ok';

  if (todayEntry.pain) {
    const maxZone = Math.max(...Object.values(todayEntry.pain.zones).filter(v => Number.isFinite(v)));
    if (maxZone >= 7) { issues.push(`Боль ${maxZone}/10`); maxSeverity = 'alert'; }
    else if (maxZone >= 4) { issues.push(`Боль ${maxZone}/10`); maxSeverity = 'watch'; }
  }

  if (todayEntry.symptoms.length > 0) {
    const maxSym = Math.max(...todayEntry.symptoms.map(s => s.severity));
    if (maxSym >= 4) { issues.push(`Симптом ${maxSym}/5`); maxSeverity = maxSeverity === 'alert' ? 'alert' : 'watch'; }
  }

  if (todayEntry.neuro && todayEntry.neuro.totalScore >= 4) {
    issues.push(`Нейро ${todayEntry.neuro.totalScore}/10`);
    maxSeverity = maxSeverity === 'alert' ? 'alert' : 'watch';
  }

  if (todayEntry.acne && todayEntry.acne.totalScore >= 7) {
    issues.push(`Акне ${todayEntry.acne.totalScore}/12`);
    maxSeverity = maxSeverity === 'alert' ? 'alert' : 'watch';
  }

  if (todayEntry.hemato && todayEntry.hemato.totalScore >= 2) {
    issues.push(`Гемат ${todayEntry.hemato.totalScore}/8`);
    maxSeverity = maxSeverity === 'alert' ? 'alert' : 'watch';
  }

  if (issues.length === 0) return null;

  const colors = { ok: '#22c55e', watch: '#f59e0b', alert: '#ef4444' };
  return {
    status: maxSeverity,
    message: issues.join(' · '),
    color: colors[maxSeverity],
  };
}
