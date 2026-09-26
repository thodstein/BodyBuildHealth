/**
 * CardioImportPanel.tsx — импорт факта из файлов часов/приложений.
 *
 * P1-аудит: панель знала только GPX/TCX (собственные локальные парсеры),
 * тогда как движок `parseCardioImport` умеет GPX/TCX/Apple Health XML/CSV/
 * JSON/FIT/ZIP. Пользователь в конструкторе не мог загрузить export.zip
 * с Apple Watch, хотя в дневнике профиля мог. Теперь — ОДИН вход
 * (`parseCardioImport` + async-ветка для ZIP), локальные парсеры удалены.
 *
 * ZIP разбирается через `parseCardioZipAsync` (fflate async — не блокирует
 * main thread на 50-Мегабайтном export.zip).
 */
import React, { useState } from 'react';
import { saveCardioLogEntry, importCardioEntries, estimateCardioEntryKcal, type CardioLogEntry } from '../../../engines/lms/cardio-diary.engine';
import { parseCardioImport, parseCardioZipAsync } from '../../../engines/cardio-import.engine';
import { todayLocalIso, toLocalIso } from '../../../engines/lms/cardio-date-utils.engine';
import { getWeightLog } from '../../../engines/profile-store';
import { CARD, ROW, LABEL, HINT_SM, BTN, BTN_CTA, BTN_SMALL, CHIP, CHIP_ACTIVE } from './CardioUI';
import type { CardioType } from '../../../engines/lms/cardio.engine';

/** Текстовые форматы: 5 МБ (защита от подвисания). ZIP (Apple export) — 60 МБ. */
const TEXT_MAX = 5 * 1024 * 1024;
const ZIP_MAX = 60 * 1024 * 1024;
const ACCEPT = '.gpx,.tcx,.xml,.csv,.json,.fit,.zip';

const FORMAT_LABEL: Record<string, string> = {
  gpx: 'GPX', tcx: 'TCX', apple_health: 'Apple Health XML',
  csv: 'CSV', json: 'JSON', fit: 'FIT', zip: 'ZIP', unknown: 'неизвестный',
};

function currentWeightKg(): number | undefined {
  try {
    const weights = getWeightLog();
    const sorted = Array.isArray(weights) ? [...weights].filter(e => Number.isFinite(e.weight)).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
    return sorted.length > 0 ? sorted[0].weight : undefined;
  } catch { return undefined; }
}

const newId = () => `c-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

export const CardioImportPanel: React.FC<{ onImported?: () => void }> = ({ onImported }) => {
  const [type, setType] = useState<CardioType>('zone2');
  const [preview, setPreview] = useState<{ entries: CardioLogEntry[]; warnings: string[]; format: string; fileName: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(() => todayLocalIso());

  const say = (m: string, ms = 3500) => { setFlash(m); window.setTimeout(() => setFlash(null), ms); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';
    const lower = f.name.toLowerCase();
    const isZip = lower.endsWith('.zip');
    const isBinary = isZip || lower.endsWith('.fit');
    if (f.size === 0) { say('⚠ Пустой файл', 3000); return; }
    if (f.size > (isZip ? ZIP_MAX : TEXT_MAX)) {
      say(`⚠ Файл слишком большой (>${isZip ? '60 МБ' : '5 МБ'}) — выберите файл поменьше`, 3500);
      return;
    }
    setBusy(true);
    try {
      const result = isZip
        ? await parseCardioZipAsync(await f.arrayBuffer())
        : isBinary
          ? parseCardioImport(f.name, await f.arrayBuffer())
          : parseCardioImport(f.name, await f.text());
      if (result.entries.length === 0) {
        setPreview({ entries: [], warnings: result.warnings, format: result.format, fileName: f.name });
        say(`⚠ Импорт не удался: ${result.warnings[0] ?? 'нет записей'}`, 4000);
        return;
      }
      setPreview({ ...result, fileName: f.name });
      const km = result.entries.reduce((s, x) => s + (x.distanceKm ?? 0), 0);
      say(`📥 ${f.name}: ${result.entries.length} тренировр${result.entries.length === 1 ? 'а' : 'ок(и)'} · ${FORMAT_LABEL[result.format] ?? result.format}${km > 0 ? ` · ${km.toFixed(1)} км` : ''} — проверьте превью`, 4000);
    } catch (err) {
      say(`⚠ Ошибка чтения файла: ${(err as Error).message}`, 4000);
    } finally {
      setBusy(false);
    }
  };

  /** Одна сессия — с выбором типа и даты (прежний UX сохранён). */
  const saveSingle = () => {
    if (!preview || preview.entries.length !== 1) return;
    const src = preview.entries[0];
    saveCardioLogEntry({
      id: newId(),
      date,
      type,
      durationMin: src.durationMin,
      completed: true,
      avgHr: src.avgHr ?? undefined,
      calories: estimateCardioEntryKcal(type, src.durationMin, currentWeightKg()),
      distanceKm: src.distanceKm ?? undefined,
      rpe: src.rpe ?? undefined,
      sport: src.sport,               // спринт 5: одиночная сессия тоже помнит дисциплину
      source: 'import',               // это импорт, даже если тип/дату выбрал пользователь
      notes: `импорт ${preview.fileName}`,
    });
    setPreview(null);
    say('💾 Импортированная сессия сохранена в дневник');
    onImported?.();
  };

  /** Несколько сессий — сохраняем как распознал движок (тип + ДИСЦИПЛИНА из активности).
   *  P2-аудит: был цикл `saveCardioLogEntry` — N полных перезаписей журнала, и
   *  `sport`/`source` терялись. Теперь один атомарный `importCardioEntries`. */
  const saveAll = () => {
    if (!preview || preview.entries.length < 2) return;
    const n = preview.entries.length;
    importCardioEntries(
      preview.entries.map(src => ({
        id: newId(),
        date: src.date,
        type: src.type,
        durationMin: src.durationMin,
        completed: src.completed !== false,
        avgHr: src.avgHr ?? undefined,
        calories: src.calories ?? estimateCardioEntryKcal(src.type, src.durationMin, currentWeightKg()),
        distanceKm: src.distanceKm ?? undefined,
        rpe: src.rpe ?? undefined,
        sport: src.sport,               // спринт 5: дисциплина из файла не теряется
        source: 'import',               // чип «Импорт» в журнале
        updatedAt: toLocalIso(new Date()),
        notes: `импорт ${preview.fileName}`,
      })),
    );
    say(`✅ Импортировано ${n} тренировок`, 3000);
    setPreview(null);
    onImported?.();
  };

  const stravaSync = () => {
    say('🔜 Strava/Garmin OAuth — скоро (supabase/functions/strava-sync по паттерну retail-search). Пока — файл GPX/TCX/CSV/ZIP.', 4000);
  };

  const single = preview?.entries.length === 1 ? preview.entries[0] : null;

  return (
    <div className="train-cardioimport" style={CARD}>
      <div style={ROW}>
        <span style={{ ...LABEL, fontSize: 12.5 }}>📥 Импорт GPX/TCX</span>
        <span style={HINT_SM}>GPX · TCX · Apple export.zip · CSV · JSON · FIT → факт в дневник</span>
        <button style={{ ...BTN_SMALL, marginLeft: 'auto' }} onClick={stravaSync} title="Скоро: OAuth Strava/Garmin">🔗 Strava sync (скоро)</button>
      </div>
      {flash && <div style={{ fontSize: 11.5, fontWeight: 750, color: '#4ade80', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.28)', borderLeft: '3px solid #00e68a', borderRadius: 10, padding: '8px 11px', lineHeight: 1.5 }} role="status">{flash}</div>}
      <div style={ROW}>
        <label style={{ ...BTN_SMALL, minHeight: 44, padding: '10px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
          📂 Выбрать файл
          <input type="file" accept={ACCEPT} onChange={onFile} style={{ display: 'none' }} aria-label="Выбрать файл тренировок" />
        </label>
        <span style={HINT_SM}>GPX · TCX · Apple export.zip · Apple XML · CSV · JSON · FIT. Парсинг локально, без сети.</span>
      </div>
      {busy && <div style={HINT_SM} role="status">⏳ Разбираем файл…</div>}
      {preview && preview.entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.26)', borderLeft: '3px solid #60a5fa', borderRadius: 11, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1.5 }}>
            Предпросмотр: <b>{preview.entries.length}</b> · {FORMAT_LABEL[preview.format] ?? preview.format} · {preview.fileName}
          </div>
          {preview.warnings.length > 0 && (
            <div style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1.5 }}>
              {preview.warnings.slice(0, 3).join(' · ')}
            </div>
          )}
          {single ? (
            <>
              <div style={{ fontSize: 12, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1.5 }}>
                <b>{single.durationMin} мин</b>{single.distanceKm != null ? ` · ${single.distanceKm} км` : ''}{single.avgHr != null ? ` · HR ${single.avgHr}` : ''}
              </div>
              <div style={ROW}>
                <span style={LABEL}>Тип</span>
                {(['zone2', 'miss', 'hiit', 'recovery'] as CardioType[]).map(t => (
                  <button key={t} style={type === t ? CHIP_ACTIVE : CHIP} onClick={() => setType(t)} aria-pressed={type === t}>{t.toUpperCase()}</button>
                ))}
              </div>
              <div style={ROW}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 11, padding: '11px 13px', color: '#fff', fontSize: 16, minHeight: 48, outline: 'none' }} aria-label="Дата импорта" />
                <button style={{ ...BTN_CTA, minHeight: 48 }} onClick={saveSingle}>💾 Сохранить как {type.toUpperCase()}</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {preview.entries.slice(0, 30).map((en, i) => (
                  <div key={en.id ?? i} style={{ fontSize: 11.5, color: '#fff', display: 'flex', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ opacity: 0.8, minWidth: 82 }}>{en.date}</span>
                    <span style={{ minWidth: 52 }}>{en.type.toUpperCase()}</span>
                    <span>{en.durationMin} мин</span>
                    {en.distanceKm != null ? <span>{en.distanceKm} км</span> : null}
                  </div>
                ))}
                {preview.entries.length > 30 && <div style={HINT_SM}>…и ещё {preview.entries.length - 30}</div>}
              </div>
              <div style={ROW}>
                <button style={{ ...BTN_CTA, minHeight: 48 }} onClick={saveAll}>💾 Импортировать {preview.entries.length} записей</button>
                <button style={BTN} onClick={() => setPreview(null)}>✕ Отмена</button>
              </div>
            </>
          )}
        </div>
      )}
      <div style={HINT_SM}>После импорта проверьте дневник — данные появятся и в графике план vs факт, и в профильном дневнике.</div>
    </div>
  );
};
