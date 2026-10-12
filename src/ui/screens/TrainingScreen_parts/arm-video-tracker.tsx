/**
 * arm-video-tracker.tsx — ЖИВОЕ видео за столом (offline): файл → кадры → трек кисти.
 *
 * Контракт: никаких CDN/поз-моделей (прецедент 2026-09-27: MediaPipe-hands удалены
 * как нерабочие в офлайн-АПК). Кадры снимаются в canvas, движение считается
 * покадровой разностью (кисть — самый быстрый объект в статичном кадре), калибровка
 * drag'ом по известному размеру (как штативная шкала в Kinovea).
 *
 * Вся математика — в `arm-video-tracking.engine` (чистая, покрыта юнитами).
 */
import React, { useRef, useState } from 'react';
import { AdBtn, AdField, AdSec, AdGrid } from './arm-design-system';
import { buildTrackFromFrames, calibratePixelsPerCm, videoTrackLine, type FrameObservation } from '../../../engines/arm/arm-video-tracking.engine';
import { classifyArmTrajectory, suggestWeakPointsForTrack, type ArmTrajectoryType } from '../../../engines/arm/arm-video-analysis.engine';

const SAMPLE_W = 160;
const SAMPLE_H = 90;
const MAX_FRAMES = 150;
const DIFF_THRESHOLD = 25;
const MIN_AREA = 6;

function waitSeeked(v: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const on = () => { if (!done) { done = true; v.removeEventListener('seeked', on); resolve(); } };
    v.addEventListener('seeked', on);
    setTimeout(on, 1200);
  });
}

/** Покадровая разность → centroid движения (px) + площадь. */
function frameMotion(prev: Uint8ClampedArray | null, cur: Uint8ClampedArray): { cx: number; cy: number; area: number } | null {
  if (!prev) return null;
  let sx = 0, sy = 0, area = 0;
  for (let i = 0; i < cur.length; i += 4) {
    const d = Math.abs(cur[i] - prev[i]) + Math.abs(cur[i + 1] - prev[i + 1]) + Math.abs(cur[i + 2] - prev[i + 2]);
    if (d > DIFF_THRESHOLD) {
      const px = (i / 4) % SAMPLE_W;
      const py = Math.floor((i / 4) / SAMPLE_W);
      sx += px; sy += py; area++;
    }
  }
  if (area < MIN_AREA) return null;
  return { cx: Math.round((sx / area) * 10) / 10, cy: Math.round((sy / area) * 10) / 10, area };
}

export function ArmVideoTracker() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [knownCm, setKnownCm] = useState('10');
  const [dragSpanPx, setDragSpanPx] = useState<number | null>(null);
  const dragRef = useRef<{ x0: number; x1: number } | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [trackType, setTrackType] = useState<ArmTrajectoryType | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [reason, setReason] = useState<string>('');

  const onPick = async (f: File | null | undefined) => {
    if (!f) return;
    const v = videoRef.current;
    if (!v) return;
    try {
      setBusy(true); setStatus('Готовим кадры…'); setSummary(''); setReason(''); setSuggestions([]); setNotes([]); setTrackType(null); setDragSpanPx(null);
      const url = URL.createObjectURL(f);
      v.src = url;
      v.muted = true;
      await new Promise<void>((res) => {
        let done = false;
        const on = () => { if (!done) { done = true; v.removeEventListener('loadeddata', on); res(); } };
        v.addEventListener('loadeddata', on);
        setTimeout(on, 2500);
      });
      const dur = Number.isFinite(v.duration) && v.duration > 0.3 ? v.duration : 1;
      setHasVideo(true);
      setStatus(`Видео ${dur.toFixed(1)}с · отметьте известный размер на кадре (drag), затем «Разобрать»`);
      // кадр-превью на canvas
      const cv = canvasRef.current;
      if (cv) {
        v.currentTime = Math.min(0.1, dur / 2);
        await waitSeeked(v);
        const ctx = cv.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
          const scale = Math.min(cv.width / (v.videoWidth || cv.width), cv.height / (v.videoHeight || cv.height));
          const w = (v.videoWidth || cv.width) * scale, h = (v.videoHeight || cv.height) * scale;
          ctx.drawImage(v, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
        }
      }
    } catch (e: any) {
      setStatus(`Не удалось открыть видео: ${e?.message || e}`);
    } finally { setBusy(false); }
  };

  const onDragStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    dragRef.current = { x0: e.clientX - r.left, x1: e.clientX - r.left };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    d.x1 = e.clientX - r.left;
  };
  const onDragEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const span = Math.round(Math.abs(d.x1 - d.x0) * 10) / 10;
    setDragSpanPx(span > 2 ? span : null);
    if (span <= 2) setStatus('Отрезок слишком короткий — проведите drag по известному размеру');
  };

  const onAnalyze = async () => {
    const v = videoRef.current;
    if (!v || !hasVideo) { setStatus('Сначала выберите видеофайл'); return; }
    const pxPerCm = calibratePixelsPerCm(parseFloat(knownCm), dragSpanPx || 0);
    if (!(pxPerCm > 0)) { setReason('нет калибровки — отметьте известный размер на кадре (drag) и укажите, сколько это см'); setSummary(''); return; }
    setBusy(true); setStatus('Считаем движение по кадрам…');
    try {
      const dur = Number.isFinite(v.duration) && v.duration > 0.3 ? v.duration : 1;
      const n = Math.min(MAX_FRAMES, Math.max(12, Math.floor(dur * 15)));
      const cv = document.createElement('canvas');
      cv.width = SAMPLE_W; cv.height = SAMPLE_H;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('canvas недоступен');
      const scaleFit = Math.min(cv.width / (v.videoWidth || cv.width), cv.height / (v.videoHeight || cv.height));
      const dw = (v.videoWidth || cv.width) * scaleFit, dh = (v.videoHeight || cv.height) * scaleFit;
      const dx = (cv.width - dw) / 2, dy = (cv.height - dh) / 2;
      const frames: FrameObservation[] = [];
      let prev: Uint8ClampedArray | null = null;
      for (let i = 0; i < n; i++) {
        const t = (dur * (i + 0.5)) / n;
        v.currentTime = Math.min(t, Math.max(0, dur - 0.05));
        await waitSeeked(v);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(v, dx, dy, dw, dh);
        const img = ctx.getImageData(0, 0, cv.width, cv.height);
        const m = frameMotion(prev, img.data);
        prev = img.data;
        if (m) frames.push({ tMs: Math.round(t * 1000), cx: m.cx, cy: m.cy, area: m.area });
        if (i % 10 === 0) setStatus(`Кадр ${i + 1}/${n}…`);
      }
      const res = buildTrackFromFrames(frames, { pixelsPerCm: pxPerCm });
      setSummary(videoTrackLine(res));
      setNotes(res.notes);
      if (!res.quality.ok) { setReason(res.quality.reason || 'трек не построен'); return; }
      setReason('');
      const type = classifyArmTrajectory(res.points);
      setTrackType(type);
      setSuggestions((suggestWeakPointsForTrack(type) || []).map((s) => s.point));
      setStatus('Готово — метрики ниже (единицы см по калибровке)');
    } catch (e: any) {
      setStatus(`Ошибка разбора: ${e?.message || e}`);
    } finally { setBusy(false); }
  };

  return (
    <AdSec title="📹 Разбор видео (трек кисти)" hint="оффлайн: файл → кадры → траектория. Без CDN/поз-моделей" hook="video-track">
      <div className="ad-row" style={{ flexWrap: 'wrap' }}>
        <input
          type="file"
          accept="video/*"
          aria-label="Видео файл схватки"
          onChange={(e) => onPick(e.target.files?.[0])}
          style={{ minHeight: 44, fontSize: 13 }}
        />
        <span className="ad-muted">Статичная камера, рука в кадре — 1–2 подхода</span>
      </div>
      <AdGrid cols="2">
        <AdField label="Известный размер в кадре, см">
          <input value={knownCm} onChange={(e) => setKnownCm(e.target.value)} inputMode="decimal" aria-label="Известный размер в кадре см" placeholder="10" style={{ minHeight: 44 }} />
        </AdField>
        <div>
          <div className="ad-fl">Отметка размера (drag по кадру)</div>
          <canvas
            ref={canvasRef}
            width={SAMPLE_W}
            height={SAMPLE_H}
            aria-label="Кадр для калибровки"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            style={{ width: '100%', maxWidth: 260, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, touchAction: 'none', background: '#000' }}
          />
          <div className="ad-muted" data-arm="video-cal">{dragSpanPx ? `Отрезок ${dragSpanPx}px` : 'Проведите drag по известному объекту'}</div>
        </div>
      </AdGrid>
      <div className="ad-row">
        <AdBtn variant="primary" disabled={busy || !hasVideo} onClick={onAnalyze} aria-label="Разобрать видео">{busy ? '⏳ …' : '▶ Разобрать'}</AdBtn>
        <span className="ad-muted" data-arm="video-status">{status}</span>
      </div>
      {summary && <div className="ad-muted" data-arm="video-summary">{summary}</div>}
      {reason && <div className="ad-finding" data-level="warn" data-arm="video-reason">⚠ {reason}</div>}
      {trackType && (
        <div className="ad-muted" data-arm="video-type">
          Тип траектории: {trackType === 'inside_hook' ? 'hook (внутрь)' : trackType === 'outside_toproll' ? 'toproll (наружу)' : 'press (прямо)'}
          {suggestions.length > 0 && <> · кандидаты в мёртвые точки: {suggestions.join(', ')} (подтвердите вручную)</>}
        </div>
      )}
      {notes.length > 0 && <div className="ad-muted" data-arm="video-notes">{notes.join(' · ')}</div>}
      <video ref={videoRef} playsInline style={{ display: 'none' }} />
    </AdSec>
  );
}
