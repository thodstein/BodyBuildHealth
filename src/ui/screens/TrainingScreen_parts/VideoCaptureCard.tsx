/**
 * VideoCaptureCard.tsx — CV-видео для Telegram Mini App / АПК.
 *
 * Карточка-гид по ракурсу + захват видео.
 *  - АПК: первична СИСТЕМНАЯ камера телефона (input capture) — без доп. кнопок в приложении;
 *    живое превью getUserMedia нативному WebView часто недоступно, поэтому скрыто.
 *  - Telegram/браузер: живая камера по клику + выбор файла.
 *  - Само видео открывается ПОЛНОЭКРАННЫМ окном (портал в body), а не мелким инлайн-превью.
 *
 * Разбор (CV/BlazePose-воркер) — отдельно; ошибки не бросаются наружу.
 */
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { Lift } from '../../../engines/lms/weakpoint-pl';
import { isNativeApp } from '../../../core/app-platform';
import { copyOrShareText, saveTextFileApk, shareOutcomeLabel } from '../../../core/apk-share';

const ACCENT = '#38bdf8';
const DIM = '#fff';

const LIFT_GUIDE: Record<Lift, { title: string; cam: string; dist: string; height: string; light: string; markers: string[]; bad: string[] }> = {
  bench: {
    title: 'Жим лёжа — боковой ракурс 45°',
    cam: 'Сбоку-сзади, 45° к скамье, на уровне грифа',
    dist: '2–3 м от скамьи, весь атлет + штанга в кадре',
    height: 'Высота груди/грифа (≈1.0–1.1 м), штатив или полка',
    light: 'Свет спереди-сбоку, без контрового окна за спиной',
    markers: ['Локти и запястья видны всегда', 'Гриф от касания до локаута в кадре', 'Стопы и мост видны (leg drive)'],
    bad: ['Снимать спереди — не видно разведения локтей', 'Слишком близко — обрезка траектории', 'Тёмный зал/засветка — BlazePose теряет точки'],
  },
  squat: {
    title: 'Присед — строго сбоку',
    cam: 'Строго сбоку, камера перпендикулярна штанге',
    dist: '2.5–3.5 м, весь атлет от головы до пят в кадре',
    height: 'Уровень таза (≈0.8–0.9 м)',
    light: 'Равномерный, без теней под штангой',
    markers: ['Колено и таз видны', 'Глубина (таз ниже колена) в кадре', 'Штанга от верха до ямы'],
    bad: ['Диагональ — искажает глубину', 'Снизу — завышает глубину'],
  },
  deadlift: {
    title: 'Тяга — сбоку, чуть спереди',
    cam: 'Сбоку 90°, чуть спереди (видно голень+гриф)',
    dist: '2–3 м, гриф + ноги полностью',
    height: 'Уровень колена (≈0.4 м)',
    light: 'Без бликов на блинах',
    markers: ['Гриф над серединой стопы в старте', 'Спина и таз видны', 'Хват виден'],
    bad: ['Сзади — не видно грифа', 'Сверху — теряется высота таза'],
  },
  sumo: {
    title: 'Сумо — спереди 30° + сбоку',
    cam: 'Спереди 30° для ширины, дубль сбоку для вертикали',
    dist: '2–3 м',
    height: 'Уровень колена',
    light: 'Равномерный',
    markers: ['Голени вертикальны в старте', 'Колени над носками'],
    bad: ['Только сзади — не видно клина'],
  },
  ohp: {
    title: 'Жим стоя — сбоку',
    cam: 'Сбоку, перпендикулярно',
    dist: '2 м',
    height: 'Уровень плеч',
    light: 'Без засветки',
    markers: ['Предплечья вертикальны в старте', 'Траектория над затылком видна'],
    bad: ['Спереди — не видно прогиба'],
  },
  row: { title: 'Тяга в наклоне — сбоку', cam: 'Сбоку', dist: '2 м', height: 'Уровень пояса', light: 'Равномерный', markers: ['Спина нейтральна', 'Лопатки видны'], bad: [] },
  pulldown: { title: 'Тяга блока — сбоку', cam: 'Сбоку', dist: '1.5–2 м', height: 'Уровень груди', light: 'Равномерный', markers: ['Локти к корпусу'], bad: [] },
  incline_press: { title: 'Наклонный жим — сбоку 45°', cam: 'Сбоку 45°', dist: '2 м', height: 'Уровень грифа', light: 'Без бликов', markers: ['Касание верха груди'], bad: [] },
  biceps: { title: 'Бицепс — сбоку', cam: 'Сбоку', dist: '1.5 м', height: 'Уровень локтя', light: 'Равномерный', markers: ['Локоть прижат'], bad: [] },
  triceps: { title: 'Трицепс — сбоку', cam: 'Сбоку', dist: '1.5 м', height: 'Уровень локтя', light: 'Равномерный', markers: ['Локоть прижат', 'Плечо неподвижно'], bad: [] },
  calf: { title: 'Икры — сбоку', cam: 'Сбоку', dist: '1.5 м', height: 'Уровень голени', light: 'Равномерный', markers: ['Пятка свободно', 'Полная амплитуда'], bad: [] },
  shrug: { title: 'Шраги — спереди', cam: 'Спереди', dist: '1.5 м', height: 'Уровень плеч', light: 'Равномерный', markers: ['Плечи к ушам', 'Без рывка корпусом'], bad: [] },
};

export interface VideoAnalysisResult {
  elbowAvgDeg: number;
  gripRatio: number;
  barVelocity: number | null;
  bridge: boolean | null;
  note: string;
}

function mockAnalyze(lift: Lift): VideoAnalysisResult {
  // MVP мок — следующий прирост заменит на BlazePose
  if (lift === 'bench') return { elbowAvgDeg: 52, gripRatio: 1.42, barVelocity: 0.48, bridge: true, note: 'Мок-разбор (след. шаг — BlazePose).' };
  if (lift === 'squat') return { elbowAvgDeg: 0, gripRatio: 0, barVelocity: 0.62, bridge: null, note: 'Мок: глубина и трекинг коленей.' };
  return { elbowAvgDeg: 0, gripRatio: 0, barVelocity: 0.55, bridge: null, note: 'Мок-разбор.' };
}

type Stage = { kind: 'live' } | { kind: 'file'; url: string; name: string } | null;

export const VideoCaptureCard: React.FC<{ lift: Lift; onResult?: (r: VideoAnalysisResult) => void }> = ({ lift, onResult }) => {
  const stageVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [stage, setStage] = useState<Stage>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [isTg, setIsTg] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    try { setIsTg(!!(window as any).Telegram?.WebApp); } catch { setIsTg(false); }
    try { setIsNative(isNativeApp()); } catch { setIsNative(false); }
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (fileUrlRef.current) { try { URL.revokeObjectURL(fileUrlRef.current); } catch {} }
    };
  }, []);

  // Подключение источника к полноэкранному видео
  useEffect(() => {
    const v = stageVideoRef.current;
    if (!v) return;
    if (stage?.kind === 'live') {
      v.srcObject = stream;
      v.muted = true;
      try { v.play().catch(() => {}); } catch {}
    } else if (stage?.kind === 'file') {
      v.srcObject = null;
      v.src = stage.url;
      v.muted = true; // гарантируем автозапуск; звук — с controls
      try { v.play().catch(() => {}); } catch {}
    }
  }, [stage, stream]);

  // Блокируем прокрутку фона при открытом полноэкранном окне
  useEffect(() => {
    if (!stage || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [stage]);

  const flashShare = (m: string) => { setShareMsg(m); setTimeout(() => setShareMsg(null), 2500); };

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStream(null);
  };

  const closeStage = () => {
    // Ссылку на записанное видео НЕ отзываем — иначе кнопка «Видео на весь экран» умрёт.
    // Blob освобождается при загрузке нового файла или размонтировании карточки.
    if (stage?.kind === 'live') stopTracks();
    setStage(null);
  };

  const startCam = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = s;
      setStream(s);
      setStage({ kind: 'live' });
    } catch (e: any) {
      setError(e?.message || 'Камера отклонена. Используйте кнопку камеры телефона — надёжно в АПК.');
    }
  };

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setError(null);
    setAnalyzing(true);
    setProgress(5);
    if (fileUrlRef.current) { try { URL.revokeObjectURL(fileUrlRef.current); } catch {} }
    const url = URL.createObjectURL(f);
    fileUrlRef.current = url;
    setStage({ kind: 'file', url, name: f.name });
    const vid = document.createElement('video');
    vid.src = url;
    vid.muted = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';
    try {
      await new Promise<void>((res, rej) => {
        vid.onloadedmetadata = () => res();
        vid.onerror = () => rej(new Error('Не удалось загрузить видео'));
        setTimeout(() => rej(new Error('Таймаут загрузки видео')), 8000);
      });
      // пробуем реальный CV через воркер (не морозит UI)
      let out: VideoAnalysisResult | null = null;
      try {
        const { analyzeVideoWithWorker, analyzeVideoElement } = await import('../../../engines/cv/pose-engine');
        // воркер с прогрессом, фолбэк на главный поток
        let m: any = null;
        try {
          m = await analyzeVideoWithWorker(vid as any, lift, (p) => setProgress(p));
        } catch (e) {
          console.warn('[video] worker failed, fallback', e);
          m = await analyzeVideoElement(vid as any, lift);
        }
        if (m && (m.elbowAvgDeg != null || m.barVelocity != null)) {
          out = {
            elbowAvgDeg: m.elbowAvgDeg ?? 0,
            gripRatio: m.gripRatio ?? 0,
            barVelocity: m.barVelocity ?? null,
            bridge: m.bridge ?? null,
            note: m.elbowAvgDeg != null ? 'CV-анализ BlazePose (воркер, локально, блины — по запястьям; трекинг дисков — след. шаг).' : 'Поза не распознана — использован мок.',
          };
        }
      } catch (e) {
        console.warn('[video] pose failed', e);
      }
      if (!out) out = { ...mockAnalyze(lift), note: 'Поза не распознана (возможно офлайн — WASM с CDN недоступен). Это оценка, не замер — повторите с сетью.' };
      setResult(out);
      onResult?.(out);
      // сохранить отчёт локально для истории (не в облако — тяжёлый)
      try {
        const raw = JSON.parse(localStorage.getItem('he_cv_reports') || '[]');
        raw.unshift({ ts: Date.now(), lift, fileName: f.name, result: out });
        localStorage.setItem('he_cv_reports', JSON.stringify(raw.slice(0, 20)));
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Ошибка обработки видео');
      const r = mockAnalyze(lift);
      setResult(r);
      onResult?.(r);
    } finally {
      setAnalyzing(false);
      setProgress(0);
      vid.remove();
    }
  };

  const g = LIFT_GUIDE[lift] ?? LIFT_GUIDE.bench;

  // Общие стили кнопок полноэкранного окна
  const stageGhost: React.CSSProperties = { width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 18, fontWeight: 800, cursor: 'pointer', lineHeight: 1 };
  const stagePrimary: React.CSSProperties = { minHeight: 52, padding: '14px 18px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(239,68,68,0.35)' };
  const labelBtn = (bg: string, border: string, color: string): React.CSSProperties => ({ minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 16px', borderRadius: 12, border: `1px solid ${border}`, background: bg, color, fontSize: 13, fontWeight: 800, cursor: analyzing ? 'not-allowed' : 'pointer', opacity: analyzing ? 0.6 : 1 });

  return (
    <div className="train-videocap" style={{ padding: 12, borderRadius: 10, background: 'rgba(24,24,27,0.45)', border: '1px dashed rgba(56,189,248,0.25)', marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>📹 Видео-анализ · {g.title}</div>
      <div style={{ fontSize: 10, color: DIM, marginTop: 2, lineHeight: 1.4 }}>
        {isNative ? 'АПК: съёмка идёт системной камерой телефона, видео откроется на весь экран.' : isTg ? 'Telegram Mini App — камера по клику, HTTPS.' : 'Браузер — камера по клику.'} {g.cam}
      </div>

      {/* ГИД */}
      <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.18)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT }}>🎯 Как снимать — чек-лист ракурса</div>
        <div style={{ fontSize: 10, color: DIM, marginTop: 4, lineHeight: 1.5 }}>
          <div>📷 <b style={{ color: '#fff' }}>Ракурс:</b> {g.cam}</div>
          <div>📏 <b style={{ color: '#fff' }}>Дистанция:</b> {g.dist}</div>
          <div>📐 <b style={{ color: '#fff' }}>Высота:</b> {g.height}</div>
          <div>💡 <b style={{ color: '#fff' }}>Свет:</b> {g.light}</div>
          <div style={{ marginTop: 6, color: '#38bdf8', fontWeight: 700 }}>✅ В кадре обязательно:</div>
          <ul style={{ margin: '2px 0 0 14px', padding: 0 }}>{g.markers.map((m, i) => <li key={i} style={{ fontSize: 10, color: DIM }}>{m}</li>)}</ul>
          {g.bad.length > 0 && <><div style={{ marginTop: 6, color: '#f87171', fontWeight: 700 }}>❌ Частые ошибки:</div><ul style={{ margin: '2px 0 0 14px', padding: 0 }}>{g.bad.map((m, i) => <li key={i} style={{ fontSize: 10, color: DIM }}>{m}</li>)}</ul></>}
          <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', fontSize: 10 }}>
            💡 Советы: штатив/полка {' > '} руки; 1 подход = 1 видео (5-8с); снимайте последний тяжёлый подход; боковая камера — главная для локтей/траектории; не обрезайте штангу/стопы.
          </div>
        </div>
      </div>

      {/* Кнопки захвата (АПК: системная камера первична) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {isNative ? (
          <>
            <label data-vc="camera" aria-label="Снять видео на камеру телефона" style={{ ...labelBtn('linear-gradient(135deg,#0ea5e9,#0284c7)', 'rgba(56,189,248,0.4)', '#fff'), flex: '1 1 200px' }}>
              🎥 Снять на камеру
              <input type="file" accept="video/*" capture="environment" aria-label="Видео с камеры телефона" style={{ display: 'none' }} onChange={e => { handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }} disabled={analyzing} />
            </label>
            <label data-vc="gallery" aria-label="Выбрать видео из галереи" style={{ ...labelBtn('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.14)', '#fff'), flex: '0 1 auto' }}>
              📁 Из галереи
              <input type="file" accept="video/*" aria-label="Видеофайл из галереи" style={{ display: 'none' }} onChange={e => { handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }} disabled={analyzing} />
            </label>
          </>
        ) : (
          <>
            {!stream
              ? <button data-vc="live" aria-label="Включить живую камеру" disabled={analyzing} onClick={startCam} style={labelBtn('rgba(56,189,248,0.15)', 'rgba(56,189,248,0.3)', ACCENT)}>📹 Включить камеру</button>
              : <button data-vc="stop" aria-label="Остановить камеру" onClick={closeStage} style={labelBtn('rgba(239,68,68,0.12)', 'rgba(239,68,68,0.3)', '#f87171')}>⏹ Стоп</button>}
            <label data-vc="file" aria-label="Выбрать видеофайл" style={labelBtn('rgba(56,189,248,0.1)', 'rgba(56,189,248,0.3)', ACCENT)}>
              📁 Выбрать файл (надёжно в Telegram)
              <input type="file" accept="video/*" capture="environment" aria-label="Видеофайл подхода" style={{ display: 'none' }} onChange={e => { handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }} disabled={analyzing} />
            </label>
          </>
        )}
        <button data-vc="demo" aria-label="Демо-разбор без видео" disabled={analyzing} onClick={() => { const r = { ...mockAnalyze(lift), note: 'Демо-оценка (не замер): введите реальное видео для CV-анализа.' }; setResult(r); onResult?.(r); }} style={labelBtn('rgba(0,230,138,0.12)', 'rgba(0,230,138,0.25)', '#00e68a')}>🧪 Демо-разбор</button>
      </div>
      {isNative && <div style={{ marginTop: 6, fontSize: 10, color: '#fff', lineHeight: 1.4 }}>Нажмите «Снять на камеру» — откроется камера телефона. После съёмки видео покажется на весь экран, а разбор появится под карточкой.</div>}

      {result && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          <button data-vc="play" aria-label="Открыть видео на весь экран" onClick={() => { if (fileUrlRef.current) setStage({ kind: 'file', url: fileUrlRef.current, name: 'Видео подхода' }); }} style={labelBtn('rgba(14,165,233,0.12)', 'rgba(14,165,233,0.3)', ACCENT)}>🔍 Видео на весь экран</button>
          <button data-vc="copy" aria-label="Копировать разбор видео" onClick={async () => {
            const t = `Видео-разбор (${lift}): локти ${result.elbowAvgDeg ?? '—'}° · хват ${result.gripRatio ?? '—'} · скорость ${result.barVelocity ?? '—'} м/с · ${result.note}`;
            const o = await copyOrShareText(t, 'Видео-разбор');
            flashShare(shareOutcomeLabel(o));
          }} style={labelBtn('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.12)', '#fff')}>📋 Копировать разбор</button>
          <button data-vc="save" aria-label="Сохранить отчёт видео" onClick={async () => {
            const json = JSON.stringify({ lift, ts: Date.now(), result }, null, 2);
            const o = await saveTextFileApk(`videocap-${lift}.json`, json, 'application/json;charset=utf-8');
            flashShare(shareOutcomeLabel(o));
          }} style={labelBtn('rgba(255,255,255,0.06)', 'rgba(255,255,255,0.12)', '#fff')}>💾 Отчёт (JSON)</button>
          {shareMsg && <span role="status" style={{ fontSize: 11, color: '#fff', alignSelf: 'center' }}>{shareMsg}</span>}
        </div>
      )}
      {analyzing && !stage && <div style={{ marginTop: 6, fontSize: 10, color: ACCENT, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', padding: '6px 8px', borderRadius: 6 }}>⏳ Анализ видео… {progress > 0 ? `${progress}% — ` : ''}BlazePose воркер (не морозит UI) — первый раз качает WASM ~2-3с.</div>}
      {error && <div style={{ marginTop: 6, fontSize: 10, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 8px', borderRadius: 6 }}>{error}</div>}

      {/* Result */}
      {result && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#00e68a' }}>📊 Разбор:</div>
          <div style={{ fontSize: 10, color: DIM, marginTop: 4, lineHeight: 1.4 }}>
            {result.elbowAvgDeg > 0 && <div>Локти (средн.): <b style={{ color: '#fff' }}>{result.elbowAvgDeg}°</b> {result.elbowAvgDeg < 40 ? '— tucked' : result.elbowAvgDeg > 65 ? '— flared' : '— moderate'}</div>}
            {result.gripRatio > 0 && <div>Хват ratio: <b style={{ color: '#fff' }}>{result.gripRatio.toFixed(2)}×</b> ширины плеч</div>}
            {result.barVelocity != null && <div>Скорость (оценка): <b style={{ color: '#fff' }}>{result.barVelocity.toFixed(2)} м/с</b></div>}
            {result.bridge != null && <div>Мост: <b style={{ color: '#fff' }}>{result.bridge ? 'есть' : 'нет'}</b></div>}
            <div style={{ marginTop: 4, color: '#fbbf24' }}>{result.note}</div>
            <div style={{ marginTop: 4, fontSize: 9, color: '#fff' }}>След. шаг — воркер + BlazePose: автозамер локтей/хвата/скорости и подсветка коррекции в блоке 5 мастера.</div>
          </div>
        </div>
      )}

      {/* ── Полноэкранное видео (портал в body) ── */}
      {stage && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div data-vc="stage" role="dialog" aria-modal="true" aria-label="Видео подхода"
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', paddingTop: 'max(12px, env(safe-area-inset-top))', background: 'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0))' }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {stage.kind === 'live' ? '📹 Камера — снимите подход' : `🎬 ${stage.name}`}
            </div>
            <button data-vc="stage-close" aria-label="Закрыть видео" onClick={closeStage} style={stageGhost}>✕</button>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video
              ref={stageVideoRef}
              autoPlay
              playsInline
              muted
              controls={stage.kind === 'file'}
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            />
          </div>

          <div style={{ padding: '12px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8, background: 'linear-gradient(0deg, rgba(0,0,0,0.92), rgba(0,0,0,0))' }}>
            {stage.kind === 'live' && (
              <button data-vc="stage-stop" aria-label="Остановить камеру и закрыть" onClick={closeStage} style={stagePrimary}>⏹ Остановить и закрыть</button>
            )}
            {stage.kind === 'file' && (analyzing
              ? <div role="status" style={{ fontSize: 13, color: ACCENT, fontWeight: 700, textAlign: 'center' }}>⏳ Анализ видео… {progress > 0 ? `${progress}%` : ''}</div>
              : <div role="status" style={{ fontSize: 13, color: '#4ade80', fontWeight: 700, textAlign: 'center' }}>✅ Разбор готов — закройте окно</div>
            )}
            <div style={{ fontSize: 10, color: '#fff', textAlign: 'center', lineHeight: 1.4 }}>{g.cam} · {g.dist}</div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default VideoCaptureCard;
