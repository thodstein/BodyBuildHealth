/**
 * bb-hub-pose-card.tsx — BB-G-05: видео-разбор позы в «Скрининге» (АПК-первый).
 *
 * Как работает в АПК (по образцу мастера движений — VideoCaptureCard):
 *  1) «📷 Снять видео» = системная камера телефона через `<input capture="environment">`.
 *     В WebView getUserMedia часто недоступен, поэтому съёмка — всегда системная.
 *  2) Видео открывается на весь экран (портал в body, как в мастере).
 *  3) «Разобрать» — кадры → BlazePose → метрики ракурса (движок bb-pose-metrics).
 * Выбор из галереи и живая камера (там, где getUserMedia есть) — дополнительный путь.
 *
 * Принципы:
 *  - Никаких моков: если модель не загрузилась или позы нет — прямое сообщение,
 *    а не «примерные» цифры. Черновой результат помечается.
 *  - «→ В скрининг» переносит ТОЛЬКО измеренные признаки (bbPoseScreeningPatch).
 *  - Состояние результата живёт в хабе (проп `saved`): переключение табов его не теряет.
 */
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { isNativeApp } from '../../../core/app-platform';
import {
  analyzeBbPoseFrames,
  analyzeBbPoseVideo,
  createBbPoseDetector,
  BB_POSE_STATUS_RU,
  BB_POSE_VIDEO_GUIDE,
  type BbPoseDetector,
} from '../../../engines/bb/bb-pose-capture.engine';
import {
  BB_POSE_2D_NOTE,
  BB_POSE_APPLY_NOTE,
  BB_POSE_QUALITY_RU,
  BB_POSE_VIEW_NOTE,
  bbPoseHasPatch,
  bbPoseLines,
  type BbPoseLandmark,
  type BbPoseSummary,
  type BbPoseView,
} from '../../../engines/bb/bb-pose-metrics.engine';

const ACCENT = '#00e68a';
const WARN = '#f59e0b';
const ERR = '#f87171';

const btn = (bg: string, border: string, color: string): React.CSSProperties => ({
  minHeight: 44, padding: '10px 14px', borderRadius: 12, background: bg,
  border: `1px solid ${border}`, color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
});

export interface BbPoseCardProps {
  view: BbPoseView;
  onView: (v: BbPoseView) => void;
  /** Сохранённый результат (живёт в состоянии хаба → переживает переключение табов и попадает в отчёт). */
  saved: BbPoseSummary | null;
  /** Результат уже перенесён в скрининг. */
  applied: boolean;
  onResult: (s: BbPoseSummary) => void;
  onApply: () => void;
  setToast?: (v: string) => void;
  /** DI для тестов: разбор видеоэлемента (в проде — analyzeBbPoseVideo). */
  analyzeVideo?: (video: HTMLVideoElement, view: BbPoseView, opts?: any) => Promise<BbPoseSummary | null>;
  /** DI для тестов/офлайна: создание детектора для живой камеры. */
  makeDetector?: () => Promise<BbPoseDetector | null>;
}

type Stage = 'file' | 'live' | null;

export const BbPoseCard: React.FC<BbPoseCardProps> = (props) => {
  const {
    view, onView, saved, applied, onResult, onApply, setToast,
    analyzeVideo = analyzeBbPoseVideo,
    makeDetector = createBbPoseDetector,
  } = props;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const liveFramesRef = useRef<BbPoseLandmark[][]>([]);

  const [stage, setStage] = useState<Stage>(null);
  /** Выбранное видео живёт отдельно от полноэкранного окна: закрыл стейдж — «Разобрать» осталась. */
  const [source, setSource] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [isNative, setIsNative] = useState(false);
  const [canLive, setCanLive] = useState(false);
  const [live, setLive] = useState(false);
  const [livePosed, setLivePosed] = useState(0);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const guide = BB_POSE_VIDEO_GUIDE[view];
  const result = saved;

  useEffect(() => {
    try { setIsNative(isNativeApp()); } catch { setIsNative(false); }
    let mounted = true;
    try {
      setCanLive(!!navigator?.mediaDevices?.getUserMedia);
    } catch { setCanLive(false); }
    return () => {
      mounted = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (fileUrlRef.current) { try { URL.revokeObjectURL(fileUrlRef.current); } catch {} }
      void mounted;
    };
  }, []);

  // Подключение источника к полноэкранному видео
  useEffect(() => {
    const v = stageVideoRef.current;
    if (!v || !stage) return;
    if (stage === 'live') {
      v.srcObject = streamRef.current;
      v.muted = true;
      try { void v.play().catch(() => {}); } catch {}
    } else if (source) {
      v.srcObject = null;
      v.src = source.url;
      v.muted = true;
      // Воспроизведение — атрибутом autoPlay на самом видео: ручной play() в WebView
      // иногда отклоняется политикой автоплея и только шумит в консоль.
    }
  }, [stage, source]);

  // Блокируем прокрутку фона при открытом полноэкранном окне
  useEffect(() => {
    if (!stage || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [stage]);

  const flash = (m: string) => {
    setShareMsg(m);
    window.setTimeout(() => setShareMsg(null), 2500);
  };

  const stopLive = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  };

  const closeStage = () => {
    if (stage === 'live') stopLive();
    setStage(null);
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    setStatus('');
    if (fileUrlRef.current) { try { URL.revokeObjectURL(fileUrlRef.current); } catch {} }
    const url = URL.createObjectURL(f);
    fileUrlRef.current = url;
    setSource({ url, name: f.name || 'Видео приседа' });
    setStage('file');
  };

  const runAnalysis = async () => {
    const v = videoRef.current;
    if (!v) return;
    setBusy(true);
    setProgress(0);
    setStatus(BB_POSE_STATUS_RU.busy);
    try {
      const s = await analyzeVideo(v, view, { onProgress: (p: number) => setProgress(Math.max(0, Math.min(100, Math.round(p)))) });
      if (!s) {
        setStatus(BB_POSE_STATUS_RU.noModel);
        setToast?.(BB_POSE_STATUS_RU.noModel);
      } else if (s.framesPosed === 0) {
        setStatus(BB_POSE_STATUS_RU.noPose);
        onResult(s);
      } else {
        onResult(s);
        setStatus(s.quality === 'low' ? BB_POSE_STATUS_RU.lowQuality : '');
        setToast?.(s.quality === 'low' ? BB_POSE_STATUS_RU.lowQuality : '✅ Видео разобрано — проверь результат');
      }
    } catch {
      setStatus(BB_POSE_STATUS_RU.badVideo);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const startLive = async () => {
    setStatus('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = s;
      setStage('live');
      liveFramesRef.current = [];
      setLivePosed(0);
      setLive(true);
      const det = await makeDetector();
      if (!det) {
        setStatus(BB_POSE_STATUS_RU.noModel);
        return;
      }
      timerRef.current = window.setInterval(() => {
        const v = stageVideoRef.current;
        if (!v || !det) return;
        const lm = det(v, performance.now());
        if (lm) {
          liveFramesRef.current.push(lm);
          setLivePosed(liveFramesRef.current.length);
        }
      }, 300);
    } catch {
      setStatus('Камера недоступна — снимите видео системной камерой (кнопка «📷 Снять видео»).');
    }
  };

  const stopLiveAndAnalyze = () => {
    const frames = liveFramesRef.current.slice();
    stopLive();
    if (!frames.length) {
      setStatus(BB_POSE_STATUS_RU.noPose);
      return;
    }
    const s = analyzeBbPoseFrames(frames, view);
    onResult(s);
    setStatus(s.quality === 'low' ? BB_POSE_STATUS_RU.lowQuality : '');
  };

  const lines = bbPoseLines(result);
  const canApply = bbPoseHasPatch(result);
  const color = result?.framesPosed === 0 ? ERR : result?.quality === 'low' ? WARN : ACCENT;

  return (
    <div data-bb="pose-capture" style={{ marginTop: 8, padding: '10px', borderRadius: 10, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.18)' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>🎥 Видео-разбор позы (OHS)</div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {(['front', 'side'] as BbPoseView[]).map((v) => (
            <button
              key={v}
              type="button"
              data-bb={v === 'front' ? 'pose-view-front' : 'pose-view-side'}
              aria-pressed={view === v}
              onClick={() => onView(v)}
              style={{
                ...btn(view === v ? 'rgba(0,230,138,0.16)' : 'rgba(255,255,255,0.05)',
                  view === v ? 'rgba(0,230,138,0.4)' : 'rgba(255,255,255,0.14)',
                  view === v ? ACCENT : '#fff'),
                minHeight: 40, padding: '8px 10px', fontSize: 11,
              }}
            >{v === 'front' ? 'Спереди' : 'Сбоку'}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.45, marginBottom: 6 }} data-bb="pose-view-note">
        {BB_POSE_VIEW_NOTE[view]} {BB_POSE_2D_NOTE}
      </div>

      <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.45, marginBottom: 6 }}>
        <b>{guide.title}.</b> {guide.cam} · {guide.dist} · {guide.height}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {/* АПК: системная камера телефона — надёжный путь в WebView */}
        <label data-bb="pose-camera" aria-label={isNative ? 'Снять видео на камеру телефона' : 'Снять видео на камеру'} style={{ ...btn('linear-gradient(135deg,#0ea5e9,#0284c7)', 'rgba(56,189,248,0.4)', '#fff'), flex: '1 1 170px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          📷 Снять видео
          <input
            type="file"
            accept="video/*"
            capture="environment"
            aria-label="Видео с камеры телефона"
            style={{ display: 'none' }}
            disabled={busy}
            onChange={(e) => { handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
          />
        </label>
        <label data-bb="pose-gallery" aria-label="Выбрать видео из галереи" style={{ ...btn('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.14)', '#fff'), flex: '0 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          🎬 Из галереи
          <input
            type="file"
            accept="video/*"
            aria-label="Видеофайл из галереи"
            style={{ display: 'none' }}
            disabled={busy}
            onChange={(e) => { handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
          />
        </label>
        {canLive && !isNative && (
          live
            ? <button type="button" data-bb="pose-stop" onClick={stopLiveAndAnalyze} style={btn('rgba(239,68,68,0.12)', 'rgba(239,68,68,0.3)', ERR)}>⏹ Стоп и разобрать ({livePosed})</button>
            : <button type="button" data-bb="pose-live" onClick={startLive} disabled={busy} style={btn('rgba(56,189,248,0.15)', 'rgba(56,189,248,0.3)', '#38bdf8')}>📹 Живая камера</button>
        )}
      </div>

      {isNative && (
        <div style={{ marginTop: 4, fontSize: 10, color: '#fff', opacity: 0.85, lineHeight: 1.4 }}>
          АПК: откроется системная камера телефона. Снимите 5 повторов в полный рост — видео покажется на весь экран, разбор появится ниже.
        </div>
      )}

      {/* Видео (в карточке — компактно; полный экран — кнопкой) */}
      {source && (
        <div style={{ marginTop: 6 }} data-bb="pose-video-wrap">
          <video ref={videoRef} src={source.url} data-bb="pose-video" playsInline muted controls style={{ width: '100%', maxHeight: 220, borderRadius: 8, background: '#000' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <button type="button" data-bb="pose-analyze" onClick={runAnalysis} disabled={busy} style={btn('rgba(0,230,138,0.14)', 'rgba(0,230,138,0.35)', ACCENT)}>
              {busy ? `🔍 Разбор… ${progress}%` : '🔍 Разобрать видео'}
            </button>
            <button type="button" data-bb="pose-stage-open" onClick={() => setStage('file')} style={btn('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.14)', '#fff')}>⛶ На весь экран</button>
          </div>
        </div>
      )}

      {busy && (
        <div role="status" data-bb="pose-progress" style={{ marginTop: 6, fontSize: 11, color: '#38bdf8' }}>
          ⏳ {BB_POSE_STATUS_RU.busy} {progress}%
        </div>
      )}
      {status && (
        <div role="status" data-bb="pose-status" style={{ marginTop: 6, fontSize: 11, color: ERR }}>
          {status}
        </div>
      )}

      {lines.length > 0 && (
        <div data-bb="pose-result" style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.05)', border: `1px solid ${color}33` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color }}>
            📊 {view === 'front' ? 'Фронтально' : 'Сбоку'} · качество: {BB_POSE_QUALITY_RU[result!.quality]}
          </div>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 11, color: '#fff', lineHeight: 1.5 }}>
            {lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 4, lineHeight: 1.45 }}>{BB_POSE_APPLY_NOTE}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <button
              type="button"
              data-bb="pose-apply"
              onClick={onApply}
              disabled={!canApply || applied}
              style={btn(applied ? 'rgba(255,255,255,0.04)' : 'rgba(0,230,138,0.14)', 'rgba(0,230,138,0.35)', applied ? '#94a3b8' : ACCENT)}
            >{applied ? '✓ Перенесено в скрининг' : '→ В скрининг'}</button>
            <button
              type="button"
              data-bb="pose-copy"
              onClick={async () => {
                try {
                  const text = `Видео-разбор (${view === 'front' ? 'фронтально' : 'сбоку'}): ${lines.join(' · ')}`;
                  if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(text);
                  flash('📋 Скопировано');
                } catch { flash('Не удалось скопировать'); }
              }}
              style={btn('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.12)', '#fff')}
            >📋 Копировать</button>
            {shareMsg && <span role="status" style={{ fontSize: 10, color: '#fff', alignSelf: 'center' }}>{shareMsg}</span>}
          </div>
        </div>
      )}

      {/* Полноэкранное видео (портал в body) */}
      {stage && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div data-bb="pose-stage" role="dialog" aria-modal="true" aria-label="Видео разбора позы"
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', paddingTop: 'max(12px, env(safe-area-inset-top))', background: 'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0))' }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {stage === 'live' ? `📹 Камера — кадров с позой: ${livePosed}` : `🎬 ${source?.name || 'Видео приседа'}`}
            </div>
            <button type="button" data-bb="pose-stage-close" aria-label="Закрыть видео" onClick={closeStage} style={btn('rgba(255,255,255,0.1)', 'rgba(255,255,255,0.2)', '#fff')}>✕</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video
              ref={stageVideoRef}
              autoPlay
              playsInline
              muted
              controls={stage === 'file'}
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            />
          </div>
          <div style={{ padding: 12, paddingBottom: 'max(16px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8, background: 'linear-gradient(0deg, rgba(0,0,0,0.92), rgba(0,0,0,0))' }}>
            {stage === 'live' && (
              <button type="button" data-bb="pose-stage-stop" onClick={stopLiveAndAnalyze} style={btn('rgba(239,68,68,0.2)', 'rgba(239,68,68,0.4)', '#fff')}>⏹ Стоп и разобрать</button>
            )}
            {stage === 'file' && (
              <button type="button" data-bb="pose-stage-analyze" onClick={runAnalysis} disabled={busy} style={btn('rgba(0,230,138,0.2)', 'rgba(0,230,138,0.45)', '#fff')}>
                {busy ? `⏳ Разбор… ${progress}%` : '🔍 Разобрать видео'}
              </button>
            )}
            <div style={{ fontSize: 10, color: '#fff', textAlign: 'center', lineHeight: 1.4 }}>{guide.cam} · {guide.dist}</div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default BbPoseCard;
