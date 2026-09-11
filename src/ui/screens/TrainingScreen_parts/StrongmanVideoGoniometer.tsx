import React from 'react';
import { estimateAnglesFromLandmarks, type Landmark } from '../../../engines/strength-sport/strength-sport-pose.engine';
import { autotrackVideo } from '../../../engines/strength-sport/strength-sport-pose-autotrack.engine';

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';

/** Порядок тапов: покрывает и йок (таз/колено/голеностоп), и лог (плечо). */
const TAP_ORDER = [
  { id: 'hip', label: 'Таз' },
  { id: 'knee', label: 'Колено' },
  { id: 'ankle', label: 'Голеностоп' },
  { id: 'foot', label: 'Стопа (носок)' },
  { id: 'shoulder', label: 'Плечо' },
  { id: 'elbow', label: 'Локоть' },
] as const;

type TapId = (typeof TAP_ORDER)[number]['id'];

function drawMarkers(canvas: HTMLCanvasElement | null, taps: Partial<Record<TapId, Landmark>>, next: TapId | null): void {
  try {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width || 300;
    const h = canvas.height || 200;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(140,190,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo((w / 4) * i, 0); ctx.lineTo((w / 4) * i, h); ctx.stroke();
    }
    const pts = TAP_ORDER.map(t => taps[t.id]).filter(Boolean) as Landmark[];
    if (pts.length >= 2) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    TAP_ORDER.forEach((t, i) => {
      const p = taps[t.id];
      if (!p) return;
      ctx.fillStyle = t.id === next ? '#22c55e' : '#f59e0b';
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0f1e';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), p.x, p.y);
    });
  } catch { /* jsdom/без canvas — тапы всё равно считаются */ }
}

export const StrongmanVideoGoniometer: React.FC<{
  lift: string;
  onAppend: (row: string) => void;
}> = ({ lift, onAppend }) => {
  const [videoUrl, setVideoUrl] = React.useState('');
  const [videoName, setVideoName] = React.useState('');
  const [duration, setDuration] = React.useState(0);
  const [curTime, setCurTime] = React.useState(0);
  const [taps, setTaps] = React.useState<Partial<Record<TapId, Landmark>>>({});
  const [frameKey, setFrameKey] = React.useState(0);
  const [note, setNote] = React.useState('');
  const [autoBusy, setAutoBusy] = React.useState(false);
  const [autoMsg, setAutoMsg] = React.useState('');
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const camRef = React.useRef<HTMLInputElement | null>(null);
  const galRef = React.useRef<HTMLInputElement | null>(null);

  const nextId: TapId | null = TAP_ORDER.map(t => t.id).find(id => !taps[id]) ?? null;
  const nextLabel = TAP_ORDER.find(t => t.id === nextId)?.label ?? '';

  React.useEffect(() => {
    drawMarkers(canvasRef.current, taps, nextId);
  }, [taps, nextId, frameKey]);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    try {
      const url = URL.createObjectURL(f);
      setVideoUrl(url);
      setVideoName(f.name || 'видео');
      setTaps({});
      setCurTime(0);
      setNote('');
    } catch {
      setNote('Не удалось открыть файл — выбери видео из галереи');
    }
  };

  const seekBy = (d: number) => {
    try {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration)) return;
      v.currentTime = Math.max(0, Math.min(v.duration, (v.currentTime || 0) + d));
    } catch { /* noop */ }
  };

  const grabFrame = () => {
    try {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c) return;
      const vw = (v as HTMLVideoElement).videoWidth || 0;
      const vh = (v as HTMLVideoElement).videoHeight || 0;
      if (vw > 0 && vh > 0) {
        const scale = Math.min(1, 480 / vw);
        c.width = Math.round(vw * scale);
        c.height = Math.round(vh * scale);
      }
      const ctx = c.getContext('2d');
      if (ctx && vw > 0) ctx.drawImage(v, 0, 0, c.width, c.height);
      setFrameKey(k => k + 1);
      try { setCurTime(v.currentTime || 0); } catch {}
    } catch { /* noop */ }
  };

  const onCanvasTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!nextId) return;
    try {
      const c = canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const sx = (c.width || 300) / Math.max(1, rect.width || 1);
      const sy = (c.height || 200) / Math.max(1, rect.height || 1);
      const x = Math.round(((e.clientX - rect.left) * sx + Number.EPSILON) * 10) / 10;
      const y = Math.round(((e.clientY - rect.top) * sy + Number.EPSILON) * 10) / 10;
      setTaps(s => ({ ...s, [nextId]: { x, y } }));
    } catch { /* noop */ }
  };

  const angles = React.useMemo(() => {
    const ids: TapId[] = ['hip', 'knee', 'ankle', 'shoulder', 'elbow', 'foot'];
    if (!ids.every(id => taps[id])) return null;
    try {
      return estimateAnglesFromLandmarks({ landmarks: taps as Record<string, Landmark>, t: curTime });
    } catch { return null; }
  }, [taps, curTime]);

  const appendRow = () => {
    if (!angles) return;
    const t = Math.round(curTime * 100) / 100;
    onAppend(`${t},${angles.hip},${angles.knee},${angles.ankle},${angles.shoulder}`);
    setTaps({});
    setNote(`✓ Замер t=${t}с добавлен в таблицу (${lift === 'log_press' ? 'смотри плечо' : 'смотри таз/колено'})`);
  };

  const runAutotrack = async () => {
    const v = videoRef.current;
    if (!v || !videoUrl) {
      setAutoMsg('Сначала сними или выбери видео — без него размечать нечего');
      return;
    }
    setAutoBusy(true);
    setAutoMsg('Грузим модель поз (CDN)…');
    try {
      const res = await autotrackVideo(v, {
        onProgress: (done, total) => setAutoMsg(`Размечаем… ${done}/${total}`),
      });
      if (!res.modelOk) {
        setAutoMsg('Модель не загрузилась (сеть/CDN) — разметка вручную тапами ниже');
      } else if (!res.rows.length) {
        setAutoMsg(`Модель ок, но позы не найдены (кадров ${res.sampled}, мимо ${res.failed}) — сними сбоку в полный рост`);
      } else {
        for (const r of res.rows) onAppend(`${r.t},${r.hip},${r.knee},${r.ankle},${r.shoulder}`);
        setAutoMsg(`✓ Авто-разметка: ${res.rows.length} замеров в таблице${res.failed ? ` (мимо ${res.failed})` : ''} — проверь «🦿 Разобрать углы»`);
      }
    } catch {
      setAutoMsg('Авто-разметка упала — разметка вручную тапами ниже');
    } finally {
      setAutoBusy(false);
    }
  };

  const btn: React.CSSProperties = {
    padding: '13px 16px', minHeight: 52, borderRadius: 14, cursor: 'pointer',
    background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.09)',
    color: '#fff', fontSize: 14, fontWeight: 800, fontFamily: SF,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: SF }}>
      <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.45 }}>
        Сними подход сбоку (телефон на штативе, весь рост в кадре) → листай кадры → отметь 6 точек → углы посчитаются и уйдут в таблицу ниже (та же проверка норм, что Кинова).
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => camRef.current?.click()} style={{ ...btn, flex: '1 1 160px', background: 'linear-gradient(135deg,#a855f7,#6366f1)', border: 'none' }}>📷 Снять камерой</button>
        <button type="button" onClick={() => galRef.current?.click()} style={{ ...btn, flex: '1 1 160px' }}>📁 Видео из галереи</button>
      </div>
      {videoUrl ? (
        <button type="button" onClick={runAutotrack} disabled={autoBusy} aria-label="Авто-разметка поз по видео" style={{ ...btn, width: '100%', background: autoBusy ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#0a84ff,#30d158)', border: 'none', opacity: autoBusy ? 0.7 : 1 }}>
          {autoBusy ? '⏳ Размечаем…' : '✨ Авто-разметка (ИИ по видео → таблица)'}
        </button>
      ) : null}
      {autoMsg ? <div style={{ fontSize: 12, color: autoMsg.startsWith('✓') ? '#22c55e' : '#fff' }}>{autoMsg}</div> : null}
      <input ref={camRef} type="file" accept="video/*" capture="environment" aria-label="Снять видео камерой" style={{ display: 'none' }} onChange={e => pickFile(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="video/*" aria-label="Выбрать видео из галереи" style={{ display: 'none' }} onChange={e => pickFile(e.target.files?.[0])} />
      {videoUrl ? (
        <>
          <video
            ref={videoRef} src={videoUrl} playsInline preload="metadata" muted
            aria-label={videoName || 'Видео подхода'}
            style={{ width: '100%', borderRadius: 14, background: '#000', maxHeight: 260 }}
            onLoadedMetadata={e => { try { setDuration(e.currentTarget.duration || 0); grabFrame(); } catch {} }}
            onSeeked={() => { try { setCurTime(videoRef.current?.currentTime || 0); grabFrame(); } catch {} }}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" onClick={() => seekBy(-1 / 30)} aria-label="Кадр назад" style={{ ...btn, flexShrink: 0, padding: '13px 14px' }}>‹</button>
            <input
              type="range" min={0} max={Number.isFinite(duration) && duration > 0 ? duration : 0} step={0.033} value={Math.min(curTime, duration || 0)}
              aria-label="Позиция видео"
              style={{ flex: 1, minWidth: 0, height: 26 }}
              onChange={e => { const t = parseFloat(e.target.value); try { if (videoRef.current) videoRef.current.currentTime = t; } catch {} setCurTime(t); }}
            />
            <button type="button" onClick={() => seekBy(1 / 30)} aria-label="Кадр вперёд" style={{ ...btn, flexShrink: 0, padding: '13px 14px' }}>›</button>
            <span style={{ fontSize: 12, color: '#fff', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{curTime.toFixed(2)}с</span>
          </div>
          <button type="button" onClick={grabFrame} style={{ ...btn, width: '100%' }}>🖼 Обновить кадр ({curTime.toFixed(2)}с)</button>
        </>
      ) : (
        <div style={{ padding: '12px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(140,190,255,0.25)', fontSize: 12, color: '#fff', textAlign: 'center' }}>
          Видео нет — можно тапать точки прямо на сетке ниже (углы считаются так же)
        </div>
      )}
      <canvas
        ref={canvasRef} width={300} height={200} onClick={onCanvasTap}
        role="button" aria-label={nextId ? `Отметить точку: ${nextLabel}` : 'Все точки отмечены'}
        style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(168,85,247,0.35)', touchAction: 'manipulation', cursor: 'crosshair' }}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#fff', flex: '1 1 140px' }}>
          {nextId ? <>Тапни: <b>{nextLabel}</b> ({Object.keys(taps).length + 1}/6)</> : 'Все 6 точек отмечены ✓'}
        </span>
        <button type="button" onClick={() => setTaps(s => { const ids = TAP_ORDER.map(t => t.id); const last = ids.filter(id => s[id] != null).pop(); if (!last) return s; const n = { ...s }; delete n[last]; return n; })} aria-label="Убрать последнюю точку" style={{ ...btn, padding: '10px 14px', minHeight: 44 }}>↩</button>
        <button type="button" onClick={() => setTaps({})} aria-label="Сбросить точки" style={{ ...btn, padding: '10px 14px', minHeight: 44 }}>Сброс</button>
      </div>
      {angles ? (
        <div style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.20)', fontSize: 13, color: '#fff' }}>
          Углы: таз {angles.hip}° · колено {angles.knee}° · голеностоп {angles.ankle}° · плечо {angles.shoulder}°
          <button type="button" onClick={appendRow} style={{ ...btn, width: '100%', marginTop: 8, background: 'linear-gradient(135deg,#16a34a,#30d158)', border: 'none' }}>＋ В таблицу углов</button>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#fff' }}>Отметь все 6 точек — углы появятся здесь и уйдут строкой «время,таз,колено,голеностоп,плечо» в таблицу.</div>
      )}
      {note ? <div style={{ fontSize: 12, color: '#22c55e' }}>{note}</div> : null}
    </div>
  );
};

export default StrongmanVideoGoniometer;
