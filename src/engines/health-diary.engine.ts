/**
 * health-diary.engine.ts — Единый дневник здоровья.
 * Объединяет: боль в суставах, симптомы, нейросимптомы, акне, гематологию.
 * Без дублирования: одна запись на дату, внутри — все категории.
 */

import { PAIN_ZONE_LIST } from '../ui/screens/ProfileScreen_v2/diary-helpers';
import { findSymptomById } from './symptom-solver.engine';

const LEGACY_KEYS = [
  'he_pain_diary',
  'he_symptoms_diary',
  'he_neuro_diary',
  'he_acne_diary',
  'he_hemato_diary',
  'he_symptom_diary',
];

const UNIFIED_KEY = 'he_health_diary';
const MIGRATION_FLAG = 'he_health_diary_migrated_v1';
const SYMPTOMS_MERGED_FLAG = 'he_health_diary_symptoms_merged_v1';

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

export { todayIso };

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

  // he_symptom_diary (SymptomDiaryDay[]: { date, entries: [{ symptomId, severity 0-10, note }] })
  const symptomDays: Array<{ date?: string; entries?: Array<{ symptomId?: string; severity?: number }> }> = safeParse('he_symptom_diary', []);
  for (const day of symptomDays) {
    if (!day || typeof day.date !== 'string' || !Array.isArray(day.entries)) continue;
    const syms = day.entries;
    upsert(day.date, (e) => {
      for (const s of syms) {
        if (!s || typeof s.symptomId !== 'string' || !(Number(s.severity) > 0)) continue;
        const sev = Math.max(1, Math.min(5, Math.round(Number(s.severity) / 2))) as 1 | 2 | 3 | 4 | 5;
        const name = findSymptomById(s.symptomId)?.symptom || s.symptomId;
        if (e.symptoms.some(x => x.name.toLowerCase() === name.toLowerCase())) continue;
        e.symptoms.push({ id: generateId(), name, severity: sev });
      }
    });
  }

  entries.push(...byDate.values());
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries;
}

/** Однократно слить legacy he_symptom_diary в существующий unified-дневник (для уже мигрировавших). */
function mergeSymptomDiary(entries: UnifiedHealthEntry[]): UnifiedHealthEntry[] {
  const symptomDays: Array<{ date?: string; entries?: Array<{ symptomId?: string; severity?: number }> }> = safeParse('he_symptom_diary', []);
  if (symptomDays.length === 0) return entries;
  const byDate = new Map<string, UnifiedHealthEntry>(entries.map(e => [e.date, e]));
  let changed = false;
  for (const day of symptomDays) {
    if (!day || typeof day.date !== 'string' || !Array.isArray(day.entries) || day.entries.length === 0) continue;
    let entry = byDate.get(day.date);
    if (!entry) {
      entry = {
        id: generateId(), date: day.date, pain: null, symptoms: [],
        neuro: null, acne: null, hemato: null, notes: '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      byDate.set(day.date, entry);
      changed = true;
    }
    for (const s of day.entries) {
      if (!s || typeof s.symptomId !== 'string' || !(Number(s.severity) > 0)) continue;
      const sev = Math.max(1, Math.min(5, Math.round(Number(s.severity) / 2))) as 1 | 2 | 3 | 4 | 5;
      const name = findSymptomById(s.symptomId)?.symptom || s.symptomId;
      if (entry.symptoms.some(x => x.name.toLowerCase() === name.toLowerCase())) continue;
      entry.symptoms.push({ id: generateId(), name, severity: sev });
      changed = true;
    }
  }
  if (!changed) return entries;
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function getUnifiedHealthEntries(): UnifiedHealthEntry[] {
  if (!hasMigrated()) {
    const existing = safeParse(UNIFIED_KEY, []);
    if (existing.length > 0) {
      markMigrated();
      return existing;
    }
    const migrated = migrateLegacyEntries();
    saveUnifiedHealthEntries(migrated);
    markMigrated();
    return migrated;
  }
  let entries: UnifiedHealthEntry[] = safeParse(UNIFIED_KEY, []);
  if (localStorage.getItem(SYMPTOMS_MERGED_FLAG) !== '1') {
    const before = JSON.stringify(entries);
    const merged = mergeSymptomDiary(entries);
    if (JSON.stringify(merged) !== before) {
      saveUnifiedHealthEntries(merged);
    }
    try { localStorage.setItem(SYMPTOMS_MERGED_FLAG, '1'); } catch {}
    entries = merged;
  }
  return entries;
}

export function saveUnifiedHealthEntries(entries: UnifiedHealthEntry[]): void {
  try {
    localStorage.setItem(UNIFIED_KEY, JSON.stringify(entries.slice(-365)));
  } catch {}
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeUnifiedHealthEntry(entry: Omit<UnifiedHealthEntry, 'id' | 'createdAt' | 'updatedAt'>): Omit<UnifiedHealthEntry, 'id' | 'createdAt' | 'updatedAt'> {
  const date = typeof entry.date === 'string' && DATE_RE.test(entry.date) ? entry.date : todayIso();
  const pain = entry.pain ? {
    ...entry.pain,
    totalScore: Math.max(0, Math.min(70, Number(entry.pain.totalScore) || 0)),
    zones: Object.fromEntries(
      Object.entries(entry.pain.zones || {}).map(([k, v]) => [k, Math.max(0, Math.min(10, Number(v) || 0))])
    ),
  } : null;
  const symptoms = Array.isArray(entry.symptoms)
    ? entry.symptoms
        .filter(s => s && typeof s.name === 'string' && s.name.trim().length > 0)
        .map(s => ({
          id: s.id || generateId(),
          name: s.name.trim(),
          severity: Math.max(1, Math.min(5, Number(s.severity) || 1)) as 1|2|3|4|5,
          duration: s.duration || undefined,
        }))
    : [];
  const neuro = entry.neuro ? {
    symptoms: Object.fromEntries(
      Object.entries(entry.neuro.symptoms || {}).map(([k, v]) => [k, !!v])
    ),
    totalScore: Math.max(0, Math.min(10, Number(entry.neuro.totalScore) || 0)),
  } : null;
  const acne = entry.acne ? {
    areas: Object.fromEntries(
      Object.entries(entry.acne.areas || {}).map(([k, v]) => [k, Math.max(0, Math.min(3, Number(v) || 0))])
    ),
    totalScore: Math.max(0, Math.min(12, Number(entry.acne.totalScore) || 0)),
  } : null;
  const hemato = entry.hemato ? {
    symptoms: Object.fromEntries(
      Object.entries(entry.hemato.symptoms || {}).map(([k, v]) => [k, !!v])
    ),
    totalScore: Math.max(0, Math.min(8, Number(entry.hemato.totalScore) || 0)),
  } : null;
  return { ...entry, date, pain, symptoms, neuro, acne, hemato };
}

export function addUnifiedHealthEntry(entry: Omit<UnifiedHealthEntry, 'id' | 'createdAt' | 'updatedAt'>): UnifiedHealthEntry[] {
  const clean = sanitizeUnifiedHealthEntry(entry);
  const entries = getUnifiedHealthEntries();
  const existingIdx = entries.findIndex(e => e.date === clean.date);
  const now = new Date().toISOString();
  
  const newEntry: UnifiedHealthEntry = {
    ...clean,
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
  const cleaned = sanitizeUnifiedHealthEntry(entries[idx]);
  Object.assign(entries[idx], cleaned, { updatedAt: new Date().toISOString() });
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
    localStorage.removeItem(SYMPTOMS_MERGED_FLAG);
  } catch {}
}

// ─── Stats helpers ──────────────────────────────────────────────────

export function getUnifiedPainStats(entries: UnifiedHealthEntry[]) {
  const painEntries = entries.filter(e => e.pain && e.pain.totalScore > 0);
  if (painEntries.length === 0) return null;
  // Нормализуем к возрастанию даты: "последнее" значение = самая свежая запись.
  const sorted = [...painEntries].sort((a, b) => a.date.localeCompare(b.date));

  const scores = sorted.map(e => e.pain!.totalScore);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  const max = scores.length > 0 ? Math.max(...scores) : 0;

  const zoneValues: Record<string, number[]> = {};
  for (const z of PAIN_ZONE_LIST) zoneValues[z.id] = [];
  for (const e of sorted) {
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
