/**
 * cardio-import.engine.ts — импорт кардио-сессий из популярных часов/приложений.
 * Поддерживает: Apple Watch (Health export.xml / export.zip / CSV / TCX / GPX), Huawei Health (CSV/TCX/GPX),
 * Samsung Health (CSV/TCX), Garmin/Polar/Suunto/Fitbit/Xiaomi (TCX/GPX/CSV/FIT), JSON.
 * CSV — авто-детект разделителя, заголовков (ru/en), форматов даты/длительности.
 * TCX/GPX/Apple XML — DOMParser.
 * FIT — парсинг через fit-file-parser, ZIP — через fflate.
 */
import type { CardioLogEntry } from './lms/cardio-diary.engine';
import { estimateCardioEntryKcal } from './lms/cardio-diary.engine';
import type { CardioType } from './lms/cardio.engine';
import { unzipSync, strFromU8 } from 'fflate';
import FitParser from 'fit-file-parser';

function genId(): string {
  return 'c-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '-' + Math.random().toString(36).slice(2, 6);
}
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ── Type mapping ──────────────────────────────────────────────────────────
const TYPE_MAP: { re: RegExp; type: CardioType }[] = [
  { re: /hiit|interval|интервал|табат|кроссфит|circuit/i, type: 'hiit' },
  { re: /recover|восстан|легк|recovery|cool\s*down|заминк/i, type: 'recovery' },
  { re: /tempo|threshold|порог|miss|средн|moderate|steady/i, type: 'miss' },
];
export function mapActivityToCardioType(raw?: string): CardioType {
  const s = String(raw || '').toLowerCase();
  for (const m of TYPE_MAP) if (m.re.test(s)) return m.type;
  // дефолт — zone2 (бег, ходьба, велик, плавание, эллипс)
  return 'zone2';
}

// ── Date flexible ─────────────────────────────────────────────────────────
export function parseDateFlexible(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  // уже ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // ISO с временем: 2024-08-20, 2024-08-20T14:30:00, 2024-08-20 14:30:00, 2024/08/20
  let m = s.match(/^(\d{4})[-/.\/](\d{1,2})[-/.\/](\d{1,2})/);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // EU: 20.08.2024, 20-08-2024, 20/08/2024 + время
  m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // US: 08/20/2024 2:30 PM, 08-20-2024
  m = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})/);
  if (m) {
    const mo = Number(m[1]), d = Number(m[2]), y = Number(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // Fallback: Date.parse (локально)
  const t = Date.parse(s);
  if (Number.isFinite(t)) return toIsoDate(new Date(t));
  return null;
}

// ── Duration flexible → minutes ──────────────────────────────────────────
export function parseDurationFlexible(raw: string | number): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // если > 500 — вероятно секунды, иначе минуты
    if (raw > 500) return Math.round(raw / 60);
    return Math.round(raw);
  }
  const s = String(raw || '').trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  // Bare number: 30 → 30 min, 1800 → 30 min (seconds)
  if (/^\d+(?:\.\d+)?$/.test(s)) {
    const v = Number(s);
    return Math.round(v > 500 ? v / 60 : v);
  }
  // "30", "30 min", "30 мин", "30m"
  let m = s.match(/^(\d+(?:\.\d+)?)\s*(?:min|m|мин)\.?\s*$/);
  if (m) return Math.round(Number(m[1]));
  // "00:30:00", "0:30:00", "30:00" (mm:ss), "1:30:00" (h:mm:ss)
  m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.\d+)?$/);
  if (m) {
    const h = Number(m[1] || 0), mm = Number(m[2]), ss = Number(m[3]);
    return Math.round(h * 60 + mm + ss / 60);
  }
  // "30:00" без часов
  m = s.match(/^(\d+):(\d{2})$/);
  if (m) return Math.round(Number(m[1]) + Number(m[2]) / 60);
  // "1800", "1800s", "1800 sec"
  m = s.match(/^(\d+(?:\.\d+)?)\s*(?:s|sec|сек)?\.?\s*$/);
  if (m) {
    const v = Number(m[1]);
    // > 500 → секунды
    if (v > 500) return Math.round(v / 60);
    return Math.round(v);
  }
  // "1.5h", "1.5 ч", "1h30m"
  m = s.match(/^(\d+(?:\.\d+)?)\s*h/);
  if (m) return Math.round(Number(m[1]) * 60);
  const n = Number(s);
  if (Number.isFinite(n)) return Math.round(n > 500 ? n / 60 : n);
  return null;
}

// ── CSV helpers ───────────────────────────────────────────────────────────
function detectDelimiter(sample: string): string {
  const lines = sample.split(/\r?\n/).slice(0, 5).join('\n');
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  // считаем вне кавычек
  let inQ = false;
  for (const ch of lines) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && counts[ch] !== undefined) counts[ch]++;
  }
  let best = ','; let max = -1;
  for (const [k, v] of Object.entries(counts)) if (v > max) { max = v; best = k; }
  // если все 0 → запятая
  return best;
}
function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delim && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim().replace(/^'?(.*?)'?$/, '$1').replace(/^"(.*)"$/, '$1'));
}
function normalizeHeader(h: string): string {
  return String(h || '').toLowerCase().trim()
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .replace(/\s/g, '_');
}
const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date','дата','start','start_time','starttime','begin','time','timestamp','exercise_date','activity_date','workout_date','workout_start','begintime','startdate','workoutdate','exercise_date','training_date','начало','время','workout_start_time','start_time_utc','activity_start'],
  duration: ['duration','durationmin','duration_min','длительность','время','minutes','мин','elapsed_time','moving_time','total_time','duration_minutes','duration_min','time_minutes','продолжительность','workout_duration','activity_duration','elapsed','moving','время_тренировки'],
  distance: ['distance','distancekm','distance_km','дистанция','км','distance_km','total_distance','distance_m','distance_meters','totaldistance','dist','dist_km','расстояние','distancekm'],
  hr: ['hr','pulse','avg_hr','avghr','avg_heart_rate','average_heart_rate','heart_rate','средний_пульс','пульс','avgheartrate','avg_hr_bpm','average_hr','hr_avg','avg_pulse','heartrate'],
  calories: ['calories','kcal','калории','energy','energy_burned','calories_burned','calories_kcal','energyburned','total_calories','totalcalories','ккал','cal','cal_burned'],
  type: ['type','activity','activity_type','exercise_type','тип','sport','workout_type','exercise','activitytype','workouttype','спорт','тип_тренировки','workoutactivitytype'],
  notes: ['notes','note','заметка','заметки','comment','comments','description','title','name','workout_notes'],
};

function findCol(header: string[], aliases: string[]): number {
  const norm = header.map(normalizeHeader);
  for (const a of aliases) {
    const idx = norm.indexOf(normalizeHeader(a));
    if (idx >= 0) return idx;
  }
  // подстрока
  for (let i = 0; i < norm.length; i++) {
    for (const a of aliases) if (norm[i].includes(normalizeHeader(a)) || normalizeHeader(a).includes(norm[i])) return i;
  }
  return -1;
}

// ── CSV parser ────────────────────────────────────────────────────────────
export interface CardioImportResult {
  entries: CardioLogEntry[];
  warnings: string[];
  format: string;
}
export function parseCardioCsv(text: string, fileName = 'import.csv'): CardioImportResult {
  const warnings: string[] = [];
  const cleaned = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!cleaned) return { entries: [], warnings: ['Файл пуст'], format: 'csv' };
  const delim = detectDelimiter(cleaned);
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { entries: [], warnings: ['Нет данных (нужен заголовок + строки)'], format: 'csv' };
  const header = parseCsvLine(lines[0], delim);
  const lowerHeader = header.map(h => String(h).toLowerCase());
  // эвристика: если заголовок — цифры/даты, то заголовка нет
  const headerLooksLikeData = header.length > 0 && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(header[0]) || /^\d+(?:[.,]\d+)?$/.test(header[0]);
  let dataStart = 1;
  let hdr = header;
  if (headerLooksLikeData) {
    // без заголовка — пытаемся угадать порядок: date,duration,distance,hr,calories,type
    dataStart = 0;
    hdr = ['date','duration','distance','hr','calories','type'];
    warnings.push('Заголовок не найден — использован порядок date,duration,distance,hr,calories,type');
  }
  const colDate = findCol(hdr, HEADER_ALIASES.date);
  const colDur = findCol(hdr, HEADER_ALIASES.duration);
  const colDist = findCol(hdr, HEADER_ALIASES.distance);
  const colHr = findCol(hdr, HEADER_ALIASES.hr);
  const colCal = findCol(hdr, HEADER_ALIASES.calories);
  const colType = findCol(hdr, HEADER_ALIASES.type);
  const colNotes = findCol(hdr, HEADER_ALIASES.notes);

  if (colDate < 0) warnings.push('Колонка даты не найдена — ищем date/дата/start/begin/time');
  if (colDur < 0) warnings.push('Колонка длительности не найдена — будет 30 мин по умолчанию');

  const entries: CardioLogEntry[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delim);
    if (cols.length === 0 || cols.every(c => !c.trim())) continue;
    const rawDate = colDate >= 0 ? cols[colDate] : cols[0];
    const isoDate = parseDateFlexible(rawDate);
    if (!isoDate) { warnings.push(`Строка ${i + 1}: неверная дата "${rawDate}" — пропущена`); continue; }
    const rawDur = colDur >= 0 ? cols[colDur] : '';
    const mins = rawDur ? parseDurationFlexible(rawDur) : 30;
    if (!mins || mins < 1 || mins > 600) { warnings.push(`Строка ${i + 1}: длительность "${rawDur}" вне 1-600 — пропущена`); continue; }
    const rawDist = colDist >= 0 ? cols[colDist] : '';
    let dist: number | undefined;
    if (rawDist) {
      const v = Number(String(rawDist).replace(',', '.').replace(/[^0-9.]/g, ''));
      if (Number.isFinite(v) && v > 0) {
        // если в метрах (>= 1000) — конвертим
        dist = v >= 1000 ? Math.round((v / 1000) * 10) / 10 : Math.round(v * 10) / 10;
        if (dist > 200) { warnings.push(`Строка ${i + 1}: дистанция ${dist} км >200 — обрезана до 200`); dist = 200; }
      }
    }
    const rawHr = colHr >= 0 ? cols[colHr] : '';
    let hr: number | undefined;
    if (rawHr) {
      const v = Number(String(rawHr).replace(',', '.').replace(/[^0-9.]/g, ''));
      if (Number.isFinite(v) && v >= 20 && v <= 260) hr = Math.round(v);
    }
    const rawCal = colCal >= 0 ? cols[colCal] : '';
    let cal: number | undefined;
    if (rawCal) {
      const v = Number(String(rawCal).replace(',', '.').replace(/[^0-9.]/g, ''));
      if (Number.isFinite(v) && v > 0) cal = Math.round(v);
    }
    const rawType = colType >= 0 ? cols[colType] : '';
    const type = mapActivityToCardioType(rawType);
    const notes = colNotes >= 0 ? String(cols[colNotes] || '').trim().slice(0, 300) : undefined;

    const entry: CardioLogEntry = {
      id: genId(),
      date: isoDate,
      type,
      durationMin: clamp(mins, 1, 600),
      distanceKm: dist,
      avgHr: hr,
      calories: cal ?? estimateCardioEntryKcal(type, clamp(mins, 1, 600)),
      rpe: undefined,
      completed: true,
      notes: notes || undefined,
    };
    entries.push(entry);
  }
  if (entries.length === 0) warnings.push('Не удалось разобрать ни одной записи — проверьте формат CSV');
  // дедуп по дате+типу+длительности (часы могут дублировать выгрузку)
  const seen = new Set<string>();
  const deduped: CardioLogEntry[] = [];
  for (const e of entries) {
    const key = `${e.date}|${e.type}|${e.durationMin}|${e.distanceKm ?? ''}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(e); }
  }
  if (deduped.length < entries.length) warnings.push(`Удалено дублей: ${entries.length - deduped.length}`);
  return { entries: deduped, warnings, format: `csv (${header.join(', ')})` };
}

// ── TCX parser ────────────────────────────────────────────────────────────
export function parseCardioTcx(text: string): CardioImportResult {
  const warnings: string[] = [];
  const cleaned = String(text || '').trim();
  if (!cleaned) return { entries: [], warnings: ['Файл пуст'], format: 'tcx' };
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(cleaned, 'application/xml');
  } catch {
    return { entries: [], warnings: ['Неверный XML/TCX'], format: 'tcx' };
  }
  const activities = Array.from(doc.getElementsByTagName('Activity'));
  if (activities.length === 0) {
    // пробуем без namespace
    const all = cleaned.toLowerCase();
    if (!all.includes('<activity') && !all.includes('<lap')) return { entries: [], warnings: ['TCX: не найдено <Activity> / <Lap>'], format: 'tcx' };
  }
  const entries: CardioLogEntry[] = [];
  const laps = Array.from(doc.getElementsByTagName('Lap'));
  // если нет Lap, но есть Activity
  const sources: Element[] = laps.length ? laps : activities;
  for (const el of sources) {
    try {
      // StartTime атрибут у Lap, или Id у Activity
      let start: string | null = el.getAttribute('StartTime') || el.getAttribute('startTime');
      if (!start) {
        const idEl = el.getElementsByTagName('Id')[0] || el.getElementsByTagName('id')[0];
        if (idEl) start = idEl.textContent || '';
      }
      if (!start) continue;
      const isoDate = parseDateFlexible(start);
      if (!isoDate) continue;
      // длительность
      let dur: number | null = null;
      const tts = el.getElementsByTagName('TotalTimeSeconds')[0] || el.getElementsByTagName('totalTimeSeconds')[0];
      if (tts?.textContent) {
        const sec = Number(tts.textContent);
        if (Number.isFinite(sec)) dur = Math.round(sec / 60);
      }
      if (!dur || dur < 1) {
        const et = el.getElementsByTagName('ElapsedTime')[0];
        if (et?.textContent) dur = parseDurationFlexible(et.textContent) ?? null;
      }
      if (!dur || dur < 1 || dur > 600) continue;
      // дистанция
      let dist: number | undefined;
      const dm = el.getElementsByTagName('DistanceMeters')[0] || el.getElementsByTagName('distanceMeters')[0];
      if (dm?.textContent) {
        const m = Number(dm.textContent);
        if (Number.isFinite(m) && m > 0) dist = Math.round((m / 1000) * 10) / 10;
      }
      // пульс
      let hr: number | undefined;
      const hrEl = el.getElementsByTagName('AverageHeartRateBpm')[0] || el.getElementsByTagName('averageHeartRateBpm')[0];
      if (hrEl) {
        const v = hrEl.getElementsByTagName('Value')[0]?.textContent || hrEl.textContent;
        const n = Number(v);
        if (Number.isFinite(n) && n >= 20 && n <= 260) hr = Math.round(n);
      }
      // калории
      let cal: number | undefined;
      const calEl = el.getElementsByTagName('Calories')[0] || el.getElementsByTagName('calories')[0];
      if (calEl?.textContent) {
        const n = Number(calEl.textContent);
        if (Number.isFinite(n) && n > 0) cal = Math.round(n);
      }
      // тип из Sport
      const sport = (el.getAttribute('Sport') || (el.parentElement as Element)?.getAttribute?.('Sport') || '').toString();
      const type = mapActivityToCardioType(sport || el.tagName);
      entries.push({
        id: genId(),
        date: isoDate,
        type,
        durationMin: clamp(dur, 1, 600),
        distanceKm: dist,
        avgHr: hr,
        calories: cal ?? estimateCardioEntryKcal(type, clamp(dur, 1, 600)),
        completed: true,
      });
    } catch {
      // ignore one lap
    }
  }
  if (entries.length === 0) warnings.push('TCX: не найдено валидных <Lap> с датой/временем');
  return { entries, warnings, format: 'tcx' };
}

// ── GPX parser ────────────────────────────────────────────────────────────
export function parseCardioGpx(text: string): CardioImportResult {
  const warnings: string[] = [];
  const cleaned = String(text || '').trim();
  if (!cleaned) return { entries: [], warnings: ['Файл пуст'], format: 'gpx' };
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(cleaned, 'application/xml');
  } catch {
    return { entries: [], warnings: ['Неверный XML/GPX'], format: 'gpx' };
  }
  const trks = Array.from(doc.getElementsByTagName('trk'));
  if (trks.length === 0) return { entries: [], warnings: ['GPX: не найдено <trk>'], format: 'gpx' };
  const entries: CardioLogEntry[] = [];
  for (const trk of trks) {
    try {
      const name = trk.getElementsByTagName('name')[0]?.textContent || '';
      const type = trk.getElementsByTagName('type')[0]?.textContent || name;
      // время: первый и последний trkpt time
      const times = Array.from(trk.getElementsByTagName('time')).map(el => el.textContent || '').filter(Boolean);
      let dur: number | null = null;
      let isoDate: string | null = null;
      if (times.length >= 2) {
        const start = new Date(times[0]);
        const end = new Date(times[times.length - 1]);
        if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
          dur = Math.round((end.getTime() - start.getTime()) / 60000);
          isoDate = toIsoDate(start);
        }
      } else if (times.length === 1) {
        const d = new Date(times[0]);
        if (Number.isFinite(d.getTime())) {
          isoDate = toIsoDate(d);
          // попробуем взять <extensions><gpxtpx:hr>?
          dur = 30;
          warnings.push('GPX: только одна точка времени — длительность 30 мин по умолчанию');
        }
      }
      if (!isoDate) {
        const metaTime = doc.getElementsByTagName('metadata')[0]?.getElementsByTagName('time')[0]?.textContent;
        if (metaTime) isoDate = parseDateFlexible(metaTime);
      }
      if (!isoDate) continue;
      if (!dur || dur < 1) dur = 30;
      dur = clamp(dur, 1, 600);
      // дистанция: сумма haversine между точками, если есть lat/lon
      let dist: number | undefined;
      const pts = Array.from(trk.getElementsByTagName('trkpt'));
      if (pts.length >= 2) {
        let totalM = 0;
        for (let i = 1; i < pts.length; i++) {
          const lat1 = Number(pts[i - 1].getAttribute('lat'));
          const lon1 = Number(pts[i - 1].getAttribute('lon'));
          const lat2 = Number(pts[i].getAttribute('lat'));
          const lon2 = Number(pts[i].getAttribute('lon'));
          if ([lat1, lon1, lat2, lon2].every(Number.isFinite)) {
            const R = 6371000;
            const toRad = (x: number) => x * Math.PI / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            totalM += R * c;
          }
        }
        if (totalM > 0) dist = Math.round((totalM / 1000) * 10) / 10;
      }
      // пульс: ищем hr в extensions
      let hr: number | undefined;
      const hrCandidates = Array.from(trk.getElementsByTagName('hr')).map(e => Number(e.textContent)).filter(n => Number.isFinite(n) && n >= 20 && n <= 260);
      if (hrCandidates.length) hr = Math.round(hrCandidates.reduce((a, b) => a + b, 0) / hrCandidates.length);
      const mapped = mapActivityToCardioType(type || name);
      entries.push({
        id: genId(),
        date: isoDate,
        type: mapped,
        durationMin: dur,
        distanceKm: dist,
        avgHr: hr,
        calories: estimateCardioEntryKcal(mapped, dur),
        completed: true,
        notes: name ? name.slice(0, 300) : undefined,
      });
    } catch {
      // ignore
    }
  }
  if (entries.length === 0) warnings.push('GPX: не удалось извлечь треки с датой/временем');
  return { entries, warnings, format: 'gpx' };
}

// ── Apple Health export.xml ───────────────────────────────────────────────
export function parseAppleHealthXml(text: string): CardioImportResult {
  const warnings: string[] = [];
  const cleaned = String(text || '').trim();
  if (!cleaned) return { entries: [], warnings: ['Файл пуст'], format: 'apple_health' };
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(cleaned, 'application/xml');
  } catch {
    return { entries: [], warnings: ['Неверный Apple Health XML'], format: 'apple_health' };
  }
  const workouts = Array.from(doc.getElementsByTagName('Workout'));
  if (workouts.length === 0) return { entries: [], warnings: ['Apple Health: не найдено <Workout>'], format: 'apple_health' };
  const entries: CardioLogEntry[] = [];
  for (const w of workouts) {
    try {
      const typeRaw = w.getAttribute('workoutActivityType') || w.getAttribute('workoutActivityType') || '';
      // HKWorkoutActivityTypeRunning = 37, etc. Маппим по строке
      const durationStr = w.getAttribute('duration') || w.getAttribute('durationUnit') || '';
      const dur = parseDurationFlexible(durationStr) ?? (() => {
        const s = w.getAttribute('startDate') || '';
        const e = w.getAttribute('endDate') || '';
        if (s && e) {
          const sd = new Date(s), ed = new Date(e);
          if (Number.isFinite(sd.getTime()) && Number.isFinite(ed.getTime())) return Math.round((ed.getTime() - sd.getTime()) / 60000);
        }
        return null;
      })();
      if (!dur || dur < 1 || dur > 600) continue;
      const start = w.getAttribute('creationDate') || w.getAttribute('startDate') || '';
      const isoDate = parseDateFlexible(start);
      if (!isoDate) continue;
      let dist: number | undefined;
      // ищем WorkoutStatistics с type="HKQuantityTypeIdentifierDistanceWalkingRunning" или Running
      const stats = Array.from(w.getElementsByTagName('WorkoutStatistics'));
      for (const st of stats) {
        const t = st.getAttribute('type') || '';
        if (/distance/i.test(t)) {
          const sum = st.getAttribute('sum') || '';
          const n = Number(sum);
          if (Number.isFinite(n) && n > 0) {
            const unit = st.getAttribute('unit') || '';
            // миля → км, метр → км
            if (/mi/i.test(unit)) dist = Math.round((n * 1.60934) * 10) / 10;
            else if (/m/i.test(unit) && !/km/i.test(unit)) dist = Math.round((n / 1000) * 10) / 10;
            else dist = Math.round(n * 10) / 10;
            break;
          }
        }
      }
      let hr: number | undefined;
      // ищем HeartRate в WorkoutStatistics
      for (const st of stats) {
        const t = st.getAttribute('type') || '';
        if (/heart/i.test(t)) {
          const avg = st.getAttribute('average') || st.getAttribute('sum') || '';
          const n = Number(avg);
          if (Number.isFinite(n) && n >= 20 && n <= 260) { hr = Math.round(n); break; }
        }
      }
      let cal: number | undefined;
      for (const st of stats) {
        const t = st.getAttribute('type') || '';
        if (/energy/i.test(t) || /calorie/i.test(t)) {
          const sum = st.getAttribute('sum') || '';
          const n = Number(sum);
          if (Number.isFinite(n) && n > 0) { cal = Math.round(n); break; }
        }
      }
      const mapped = mapActivityToCardioType(typeRaw);
      entries.push({
        id: genId(),
        date: isoDate,
        type: mapped,
        durationMin: clamp(dur, 1, 600),
        distanceKm: dist,
        avgHr: hr,
        calories: cal ?? estimateCardioEntryKcal(mapped, clamp(dur, 1, 600)),
        completed: true,
      });
    } catch {
      // ignore
    }
  }
  if (entries.length === 0) warnings.push('Apple Health: не найдено валидных тренировок');
  return { entries, warnings, format: 'apple_health_xml' };
}

// ── JSON generic ──────────────────────────────────────────────────────────
export function parseCardioJson(text: string): CardioImportResult {
  const warnings: string[] = [];
  let data: any;
  try { data = JSON.parse(String(text || '')); } catch { return { entries: [], warnings: ['Неверный JSON'], format: 'json' }; }
  const arr = Array.isArray(data) ? data : Array.isArray(data?.workouts) ? data.workouts : Array.isArray(data?.activities) ? data.activities : Array.isArray(data?.data) ? data.data : [];
  if (!Array.isArray(arr) || arr.length === 0) return { entries: [], warnings: ['JSON: не найден массив тренировок'], format: 'json' };
  const entries: CardioLogEntry[] = [];
  for (const raw of arr) {
    try {
      const isoDate = parseDateFlexible(String(raw.date || raw.start || raw.startTime || raw.start_date || raw.workout_date || ''));
      if (!isoDate) continue;
      const dur = parseDurationFlexible(String(raw.durationMin ?? raw.duration ?? raw.minutes ?? raw.elapsed ?? '')) ?? 30;
      if (dur < 1 || dur > 600) continue;
      const distRaw = raw.distanceKm ?? raw.distance ?? raw.km ?? raw.totalDistance;
      let dist: number | undefined;
      if (distRaw !== undefined) {
        const v = Number(String(distRaw).replace(',', '.'));
        if (Number.isFinite(v) && v > 0) dist = v >= 1000 ? Math.round((v / 1000) * 10) / 10 : Math.round(v * 10) / 10;
      }
      const hrRaw = raw.avgHr ?? raw.hr ?? raw.heart_rate ?? raw.heartRate ?? raw.pulse;
      let hr: number | undefined;
      if (hrRaw !== undefined) {
        const v = Number(String(hrRaw).replace(',', '.'));
        if (Number.isFinite(v) && v >= 20 && v <= 260) hr = Math.round(v);
      }
      const typeRaw = String(raw.type || raw.activity || raw.sport || raw.workout_type || '');
      const type = mapActivityToCardioType(typeRaw);
      entries.push({
        id: genId(),
        date: isoDate,
        type,
        durationMin: clamp(dur, 1, 600),
        distanceKm: dist,
        avgHr: hr,
        calories: raw.calories ? Math.round(Number(raw.calories)) : estimateCardioEntryKcal(type, clamp(dur, 1, 600)),
        completed: true,
        notes: String(raw.notes || raw.title || '').slice(0, 300) || undefined,
      });
    } catch {
      // ignore
    }
  }
  if (entries.length === 0) warnings.push('JSON: не удалось разобрать записи');
  return { entries, warnings, format: 'json' };
}

// ── ZIP (Apple export.zip → export.xml + routes) — синхронный, для PRO async см. parseCardioZipAsync ──
export async function parseCardioZipAsync(buffer: ArrayBuffer): Promise<CardioImportResult> {
  // PRO: async unzip через fflate unzip (не блокирует main thread на 50Мб export.zip)
  const { unzip } = await import('fflate');
  return new Promise<CardioImportResult>(resolve => {
    unzip(new Uint8Array(buffer), (err, unzipped) => {
      if (err) {
        resolve({ entries: [], warnings: ['ZIP: ошибка распаковки — ' + (err as Error).message + ' — распакуйте вручную и загрузите export.xml'], format: 'zip' });
        return;
      }
      const warnings: string[] = [];
      const entries: CardioLogEntry[] = [];
      let found = false;
      for (const [name, data] of Object.entries(unzipped as Record<string, Uint8Array>)) {
        const lower = name.toLowerCase();
        const isXml = lower.endsWith('.xml') || lower.endsWith('export.xml');
        const isTcx = lower.endsWith('.tcx');
        const isGpx = lower.endsWith('.gpx');
        const isCsv = lower.endsWith('.csv');
        const isJson = lower.endsWith('.json');
        if (!isXml && !isTcx && !isGpx && !isCsv && !isJson) continue;
        found = true;
        try {
          const text = strFromU8(data as Uint8Array);
          let res: CardioImportResult | null = null;
          if (isXml && text.toLowerCase().includes('<healthdata')) res = parseAppleHealthXml(text);
          else if (isTcx) res = parseCardioTcx(text);
          else if (isGpx) res = parseCardioGpx(text);
          else if (isCsv) res = parseCardioCsv(text, name);
          else if (isJson) res = parseCardioJson(text);
          else if (isXml) res = parseAppleHealthXml(text);
          if (res) {
            entries.push(...res.entries);
            warnings.push(...res.warnings.map(w => `${name}: ${w}`));
          }
        } catch (e) {
          warnings.push(`${name}: ошибка — ${(e as Error).message}`);
        }
      }
      if (!found) warnings.push('ZIP: внутри не найдено export.xml / TCX / GPX / CSV / JSON');
      if (entries.length === 0 && warnings.length === 0) warnings.push('ZIP: не найдено тренировок');
      resolve({ entries, warnings, format: 'zip' });
    });
  });
}
export function parseCardioZip(buffer: ArrayBuffer): CardioImportResult {
  const warnings: string[] = [];
  const entries: CardioLogEntry[] = [];
  try {
    const unzipped = unzipSync(new Uint8Array(buffer));
    let found = false;
    for (const [name, data] of Object.entries(unzipped)) {
      const lower = name.toLowerCase();
      const isXml = lower.endsWith('.xml') || lower.endsWith('export.xml');
      const isTcx = lower.endsWith('.tcx');
      const isGpx = lower.endsWith('.gpx');
      const isCsv = lower.endsWith('.csv');
      const isJson = lower.endsWith('.json');
      if (!isXml && !isTcx && !isGpx && !isCsv && !isJson) continue;
      found = true;
      try {
        const text = strFromU8(data as Uint8Array);
        let res: CardioImportResult | null = null;
        if (isXml && text.toLowerCase().includes('<healthdata')) res = parseAppleHealthXml(text);
        else if (isTcx) res = parseCardioTcx(text);
        else if (isGpx) res = parseCardioGpx(text);
        else if (isCsv) res = parseCardioCsv(text, name);
        else if (isJson) res = parseCardioJson(text);
        else if (isXml) res = parseAppleHealthXml(text);
        if (res) {
          entries.push(...res.entries);
          warnings.push(...res.warnings.map(w => `${name}: ${w}`));
        }
      } catch (e) {
        warnings.push(`${name}: ошибка — ${(e as Error).message}`);
      }
    }
    if (!found) warnings.push('ZIP: внутри не найдено export.xml / TCX / GPX / CSV / JSON');
    if (entries.length === 0 && warnings.length === 0) warnings.push('ZIP: не найдено тренировок');
  } catch (e) {
    return { entries: [], warnings: ['ZIP: ошибка распаковки — ' + (e as Error).message + ' — распакуйте вручную и загрузите export.xml'], format: 'zip' };
  }
  return { entries, warnings, format: 'zip' };
}

// ── FIT (Garmin) — попытка парсинга через fit-file-parser, PRO async wrapper ──
export async function parseCardioFitAsync(buffer: ArrayBuffer): Promise<CardioImportResult> {
  await new Promise<void>(r => setTimeout(r, 0));
  return parseCardioFit(buffer);
}
export function parseCardioFit(buffer: ArrayBuffer): CardioImportResult {
  const warnings: string[] = [];
  // пробуем реальный парсинг, fallback — инструкция
  try {
    const Parser: any = (FitParser as any)?.default ? (FitParser as any).default : FitParser;
    if (Parser) {
      const parser = new Parser({ force: true, speedUnit: 'km/h', lengthUnit: 'km', temperatureUnit: 'celsius' });
      let out: any = null;
      let err: any = null;
      // fit-file-parser — синхронный колбэк
      parser.parse(new Uint8Array(buffer), (e: any, data: any) => { err = e; out = data; });
      if (err) throw err;
      if (out) {
        const sessions: any[] = out.sessions || out.activity?.sessions || out.activities?.[0]?.sessions || [];
        const laps: any[] = out.laps || [];
        const sources = sessions.length ? sessions : laps.length ? laps : [];
        // если структура другая — пробуем поля activity
        const candidates: any[] = sources.length ? sources : (Array.isArray(out) ? out : []);
        const parsed: CardioLogEntry[] = [];
        for (const s of candidates) {
          try {
            const start = s.start_time || s.startTime || s.timestamp || s.start_position || '';
            const isoDate = parseDateFlexible(String(start || '')) || toIsoDate(new Date());
            // длительность
            let dur: number | null = null;
            if (s.total_elapsed_time !== undefined) dur = Math.round(Number(s.total_elapsed_time) / 60);
            else if (s.total_timer_time !== undefined) dur = Math.round(Number(s.total_timer_time) / 60);
            else if (s.total_time !== undefined) dur = Math.round(Number(s.total_time) / 60);
            else if (s.duration !== undefined) dur = parseDurationFlexible(String(s.duration));
            if (!dur || dur < 1 || dur > 600) continue;
            let dist: number | undefined;
            const dRaw = s.total_distance ?? s.distance ?? s.totalDistance;
            if (dRaw !== undefined) {
              const v = Number(dRaw);
              if (Number.isFinite(v) && v > 0) dist = Math.round((v / 1000) * 10) / 10; // метры → км, если уже км — <200
              if (dist !== undefined && dist > 1000) dist = Math.round((dist / 1000) * 10) / 10;
              if (dist !== undefined && dist > 200) dist = 200;
            }
            let hr: number | undefined;
            const hrRaw = s.avg_heart_rate ?? s.average_heart_rate ?? s.avgHeartRate ?? s.heart_rate;
            if (hrRaw !== undefined) {
              const v = Number(hrRaw);
              if (Number.isFinite(v) && v >= 20 && v <= 260) hr = Math.round(v);
            }
            let cal: number | undefined;
            const calRaw = s.total_calories ?? s.calories ?? s.totalCalories;
            if (calRaw !== undefined) {
              const v = Number(calRaw);
              if (Number.isFinite(v) && v > 0) cal = Math.round(v);
            }
            const typeRaw = String(s.sport ?? s.activity ?? s.sport_type ?? s.sub_sport ?? '');
            const type = mapActivityToCardioType(typeRaw);
            parsed.push({
              id: genId(),
              date: isoDate,
              type,
              durationMin: clamp(dur, 1, 600),
              distanceKm: dist,
              avgHr: hr,
              calories: cal ?? estimateCardioEntryKcal(type, clamp(dur, 1, 600)),
              completed: true,
            });
          } catch {}
        }
        if (parsed.length > 0) return { entries: parsed, warnings, format: 'fit' };
        warnings.push('FIT: структура файла не распознана — попробуйте экспорт TCX из Garmin Connect');
      }
    }
  } catch (e) {
    warnings.push('FIT: ошибка парсинга — ' + (e as Error).message);
  }
  warnings.unshift(
    'FIT — бинарный формат Garmin. Если автоматический парсинг не сработал, экспортируйте тренировку как TCX/GPX из Garmin Connect, Huawei Health, Samsung Health, Apple Health (экспорт.xml) или скачайте CSV, затем импортируйте его.',
    'Подсказка: Huawei Health → Здоровье → Я → Конфиденциальность → Запросить данные → CSV; Samsung Health → Настройки → Скачать данные → CSV; Apple Watch → iPhone Здоровье → Профиль → Экспорт → export.zip → export.xml; Garmin Connect → Активность → Экспорт → TCX.',
  );
  return { entries: [], warnings, format: 'fit' };
}

// ── Auto-detect + unified parse ──────────────────────────────────────────
export function detectCardioFormat(fileName: string, content: string): 'csv' | 'tcx' | 'gpx' | 'apple_health' | 'json' | 'fit' | 'zip' | 'unknown' {
  const name = String(fileName || '').toLowerCase();
  const head = String(content || '').slice(0, 4000).toLowerCase();
  if (name.endsWith('.zip')) return 'zip';
  if (name.endsWith('.fit') || head.startsWith('') && content.length > 14 && content.slice(0, 12).includes('.FIT')) return 'fit';
  if (name.endsWith('.tcx') || head.includes('<trainingcenterdatabase') || head.includes('<activity') && head.includes('<lap')) return 'tcx';
  if (name.endsWith('.gpx') || head.includes('<gpx') || head.includes('<trk>')) return 'gpx';
  if (name.endsWith('.xml') && head.includes('<healthdata') && head.includes('<workout')) return 'apple_health';
  if (name.endsWith('.json') || (head.trim().startsWith('{') || head.trim().startsWith('['))) {
    try { const j = JSON.parse(content); if (Array.isArray(j) || Array.isArray(j?.workouts) || Array.isArray(j?.activities) || Array.isArray(j?.data)) return 'json'; } catch {}
  }
  // CSV fallback: содержит запятую/; и дату
  if (head.includes(',') || head.includes(';') || head.includes('\t')) return 'csv';
  return 'unknown';
}

export function parseCardioImport(fileName: string, content: string | ArrayBuffer): CardioImportResult {
  const name = String(fileName || '').toLowerCase();
  // ZIP / FIT — ArrayBuffer
  if (name.endsWith('.zip')) {
    const buf = content instanceof ArrayBuffer ? content : new TextEncoder().encode(String(content)).buffer;
    return parseCardioZip(buf);
  }
  if (name.endsWith('.fit') || content instanceof ArrayBuffer) {
    const buf = content instanceof ArrayBuffer ? content : new TextEncoder().encode(String(content)).buffer;
    return parseCardioFit(buf);
  }
  const text = String(content || '');
  const fmt = detectCardioFormat(fileName, text);
  if (fmt === 'tcx') return parseCardioTcx(text);
  if (fmt === 'gpx') return parseCardioGpx(text);
  if (fmt === 'apple_health') return parseAppleHealthXml(text);
  if (fmt === 'json') return parseCardioJson(text);
  if (fmt === 'csv') return parseCardioCsv(text, fileName);
  // эвристика: пробуем по содержимому
  const low = text.slice(0, 2000).toLowerCase();
  if (low.includes('<trainingcenterdatabase') || low.includes('<activity')) return parseCardioTcx(text);
  if (low.includes('<gpx')) return parseCardioGpx(text);
  if (low.includes('<healthdata')) return parseAppleHealthXml(text);
  try { JSON.parse(text); return parseCardioJson(text); } catch {}
  return parseCardioCsv(text, fileName);
}

// ── Инструкции по часам ──────────────────────────────────────────────────
export const CARDIO_IMPORT_INSTRUCTIONS: { brand: string; steps: string[]; formats: string[] }[] = [
  {
    brand: 'Apple Watch',
    formats: ['export.zip', 'export.xml', 'TCX', 'GPX', 'CSV'],
    steps: [
      'iPhone → Здоровье → Профиль (аватар) → Экспорт всех данных → export.zip — загрузите ZIP прямо сюда (внутри export.xml автоматически распознается).',
      'Или: Fitness → Тренировка → Поделиться → Экспорт GPX/TCX (через WorkOutDoors/Strava).',
      'Или: Скачайте CSV из QS Access / Health Auto Export.',
    ],
  },
  {
    brand: 'Huawei (Watch GT / Band)',
    formats: ['CSV', 'TCX', 'GPX'],
    steps: [
      'Huawei Health → Я → Конфиденциальность → Запросить данные → CSV (придёт на почту).',
      'Или: Huawei Health → Упражнение → История → Тренировка → Поделиться → GPX/TCX.',
      'Или: Health Sync → синхронизируйте в Strava → Strava Экспорт TCX.',
    ],
  },
  {
    brand: 'Samsung (Galaxy Watch)',
    formats: ['CSV', 'TCX', 'GPX'],
    steps: [
      'Samsung Health → Настройки → Скачать личные данные → CSV.',
      'Или: Samsung Health → Упражнения → История → Поделиться → GPX.',
      'Или: Health Sync → Google Fit → Экспорт TCX.',
    ],
  },
  {
    brand: 'Garmin',
    formats: ['TCX', 'GPX', 'FIT', 'CSV'],
    steps: [
      'Garmin Connect → Активность → шестерёнка → Экспорт в TCX/GPX (FIT — конвертируйте в TCX онлайн).',
      'Или: Экспорт CSV из Garmin Connect → Данные → Экспорт.',
    ],
  },
  {
    brand: 'Fitbit / Polar / Suunto / Xiaomi / Amazfit',
    formats: ['CSV', 'TCX', 'GPX', 'JSON'],
    steps: [
      'Fitbit → Экспорт данных → CSV/TCX; Polar Flow → Экспорт сессии → TCX; Suunto → Экспорт GPX.',
      'Xiaomi (Zepp Life/Mi Fit) → Профиль → Данные → Экспорт CSV или через Notify & Fitness → GPX.',
      'Amazfit → Zepp → Экспорт GPX/TCX.',
    ],
  },
];
