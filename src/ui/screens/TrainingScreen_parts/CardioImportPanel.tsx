/**
 * CardioImportPanel.tsx — импорт факта из GPX/TCX (B4).
 * Клиентский парсинг без бэка: длительность, дистанция, средний HR.
 * Сохраняет в he_cardio_sessions как zone2/miss/hiit/recovery на выбор.
 */
import React, { useState } from 'react';
import { saveCardioLogEntry, estimateCardioEntryKcal } from '../../../engines/lms/cardio-diary.engine';
import { getWeightLog } from '../../../engines/profile-store';
import { CARD, ROW, LABEL, HINT_SM, BTN, BTN_PRIMARY, BTN_SMALL, CHIP, CHIP_ACTIVE } from './CardioUI';
import type { CardioType } from '../../../engines/lms/cardio.engine';

function parseGpx(text: string): { durationMin: number; distanceKm: number | null; avgHr: number | null; dateIso: string | null } | null {
  try {
    const timeMatches = [...text.matchAll(/<time>([^<]+)<\/time>/gi)].map(m => m[1]);
    if (timeMatches.length >= 2) {
      const start = new Date(timeMatches[0]);
      const end = new Date(timeMatches[timeMatches.length - 1]);
      const dur = Math.round((end.getTime() - start.getTime()) / 60000);
      if (dur > 0 && dur < 600) {
        // dist: sum haversine between trkpt (лимит точек — защита от OOM)
        const pts = [...text.matchAll(/lat="([^"]+)"\s+lon="([^"]+)"/gi)].map(m => ({ lat: parseFloat(m[1]), lon: parseFloat(m[2]) }));
        const MAX_PTS = 50000;
        const usePts = pts.length > MAX_PTS ? pts.filter((_, i) => i % Math.ceil(pts.length / MAX_PTS) === 0) : pts;
        let distM = 0;
        for (let i = 1; i < usePts.length; i++) {
          const R = 6371000;
          const dLat = (usePts[i].lat - usePts[i - 1].lat) * Math.PI / 180;
          const dLon = (usePts[i].lon - usePts[i - 1].lon) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(usePts[i - 1].lat * Math.PI / 180) * Math.cos(usePts[i].lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
          distM += 2 * R * Math.asin(Math.sqrt(a));
        }
        const hrMatches = [...text.matchAll(/<gpxtpx:hr>(\d+)<\/gpxtpx:hr>/gi)].map(m => parseInt(m[1], 10)).filter(n => n > 30 && n < 220);
        const avgHr = hrMatches.length > 0 ? Math.round(hrMatches.reduce((s, x) => s + x, 0) / hrMatches.length) : null;
        const dateIso = timeMatches[0].slice(0, 10);
        return { durationMin: dur, distanceKm: distM > 100 ? Math.round(distM / 100) / 10 : null, avgHr, dateIso };
      }
    }
  } catch { /* ignore */ }
  return null;
}

function parseTcx(text: string): { durationMin: number; distanceKm: number | null; avgHr: number | null; dateIso: string | null } | null {
  try {
    const laps = [...text.matchAll(/<Lap[^>]*>([\s\S]*?)<\/Lap>/gi)];
    let totalSec = 0;
    let totalDist = 0;
    const hrs: number[] = [];
    let dateIso: string | null = null;
    for (const lap of laps) {
      const secM = lap[1].match(/<TotalTimeSeconds>([^<]+)<\/TotalTimeSeconds>/i);
      if (secM) totalSec += parseFloat(secM[1]);
      const distM = lap[1].match(/<DistanceMeters>([^<]+)<\/DistanceMeters>/i);
      if (distM) totalDist += parseFloat(distM[1]);
      const hrMs = [...lap[1].matchAll(/<HeartRateBpm>[\s\S]*?<Value>(\d+)<\/Value>/gi)].map(m => parseInt(m[1], 10)).filter(n => n > 30 && n < 220);
      hrs.push(...hrMs);
      if (!dateIso) {
        const t = lap[1].match(/<Time>([^<]+)<\/Time>/i);
        if (t) dateIso = t[1].slice(0, 10);
      }
    }
    if (totalSec > 0) {
      return { durationMin: Math.max(1, Math.round(totalSec / 60)), distanceKm: totalDist > 100 ? Math.round(totalDist / 100) / 10 : null, avgHr: hrs.length > 0 ? Math.round(hrs.reduce((s, x) => s + x, 0) / hrs.length) : null, dateIso };
    }
  } catch { /* ignore */ }
  return null;
}

export const CardioImportPanel: React.FC<{ onImported?: () => void }> = ({ onImported }) => {
  const [type, setType] = useState<CardioType>('zone2');
  const [preview, setPreview] = useState<{ durationMin: number; distanceKm: number | null; avgHr: number | null; dateIso: string | null; fileName: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Лимит 5 МБ — защита от подвисания на битых/огромных файлах
    if (f.size > 5 * 1024 * 1024) {
      setFlash('⚠ Файл слишком большой (>5 МБ) — выберите файл до 5 МБ');
      window.setTimeout(() => setFlash(null), 3500);
      e.target.value = '';
      return;
    }
    if (f.size === 0) {
      setFlash('⚠ Пустой файл');
      window.setTimeout(() => setFlash(null), 3000);
      e.target.value = '';
      return;
    }
    let text: string;
    try {
      text = await f.text();
      // Снять BOM
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      if (text.length > 10_000_000) {
        setFlash('⚠ Файл слишком большой (>10М символов)');
        window.setTimeout(() => setFlash(null), 3000);
        e.target.value = '';
        return;
      }
    } catch {
      setFlash('⚠ Не удалось прочитать файл — проверьте кодировку (UTF-8)');
      window.setTimeout(() => setFlash(null), 3000);
      e.target.value = '';
      return;
    }
    const lower = f.name.toLowerCase();
    let parsed = null;
    if (lower.endsWith('.gpx')) parsed = parseGpx(text);
    else if (lower.endsWith('.tcx')) parsed = parseTcx(text);
    else {
      parsed = parseGpx(text) ?? parseTcx(text);
    }
    if (!parsed) {
      setFlash('⚠ Не удалось распарсить файл — проверьте формат GPX/TCX');
      window.setTimeout(() => setFlash(null), 3000);
      e.target.value = '';
      return;
    }
    // Дополнительная валидация распарсенных значений
    if (!Number.isFinite(parsed.durationMin) || parsed.durationMin <= 0) {
      setFlash('⚠ Некорректная длительность в файле');
      window.setTimeout(() => setFlash(null), 3000);
      e.target.value = '';
      return;
    }
    setPreview({ ...parsed, fileName: f.name });
    if (parsed.dateIso) setDate(parsed.dateIso);
    setFlash(`📥 ${f.name}: ${parsed.durationMin} мин${parsed.distanceKm ? ` · ${parsed.distanceKm} км` : ''}${parsed.avgHr ? ` · HR ${parsed.avgHr}` : ''}`);
    window.setTimeout(() => setFlash(null), 3500);
    e.target.value = '';
  };

  const save = () => {
    if (!preview) return;
    let weight: number | null = null;
    try {
      const weights = getWeightLog();
      const sorted = Array.isArray(weights) ? [...weights].filter(e => Number.isFinite(e.weight)).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
      if (sorted.length > 0) weight = sorted[0].weight;
    } catch { /* ignore */ }
    saveCardioLogEntry({
      id: 'c-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
      date,
      type,
      durationMin: preview.durationMin,
      completed: true,
      avgHr: preview.avgHr ?? undefined,
      calories: estimateCardioEntryKcal(type, preview.durationMin, weight ?? undefined),
      distanceKm: preview.distanceKm ?? undefined,
      notes: `импорт ${preview.fileName}`,
    });
    setFlash('💾 Импортированная сессия сохранена в дневник');
    onImported?.();
    window.setTimeout(() => setFlash(null), 3000);
  };

  const stravaSync = () => {
    setFlash('🔜 Strava/Garmin OAuth — скоро (supabase/functions/strava-sync по паттерну retail-search). Пока — файл GPX/TCX.');
    window.setTimeout(() => setFlash(null), 4000);
  };
  return (
    <div className="train-cardioimport" style={CARD}>
      <div style={ROW}>
        <span style={LABEL}>📥 Импорт GPX/TCX</span>
        <span style={HINT_SM}>часы / Strava → факт в дневник</span>
        <button style={BTN_SMALL} onClick={stravaSync} title="Скоро: OAuth Strava/Garmin">🔗 Strava sync (скоро)</button>
      </div>
      {flash && <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }} role="status">{flash}</div>}
      <div style={ROW}>
        <label style={{ ...BTN_SMALL, cursor: 'pointer' }}>
          📂 Выбрать файл
          <input type="file" accept=".gpx,.tcx,.xml" onChange={onFile} style={{ display: 'none' }} />
        </label>
        <span style={HINT_SM}>GPX (трэки) или TCX (Garmin). Парсинг локально, без сети.</span>
      </div>
      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.22)', borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 11, color: '#fff' }}>
            Предпросмотр: <b>{preview.durationMin} мин</b>{preview.distanceKm != null ? ` · ${preview.distanceKm} км` : ''}{preview.avgHr != null ? ` · HR ${preview.avgHr}` : ''} · {preview.fileName}
          </div>
          <div style={ROW}>
            <span style={LABEL}>Тип</span>
            {(['zone2', 'miss', 'hiit', 'recovery'] as CardioType[]).map(t => (
              <button key={t} style={type === t ? CHIP_ACTIVE : CHIP} onClick={() => setType(t)}>{t.toUpperCase()}</button>
            ))}
          </div>
          <div style={ROW}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 10px', color: '#fff', fontSize: 12 }} aria-label="Дата импорта" />
            <button style={BTN_PRIMARY} onClick={save}>💾 Сохранить как {type.toUpperCase()}</button>
          </div>
        </div>
      )}
      <div style={HINT_SM}>После импорта проверьте дневник — данные появятся и в графике план vs факт, и в профильном дневнике.</div>
    </div>
  );
};
