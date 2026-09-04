/**
 * VideoCaptureCard.tsx — CV-видео для Telegram Mini App (MVP).
 *
 * Карточка-гид по ракурсу + захват видео (getUserMedia / file fallback).
 * Пока без тяжёлой ML — выдаёт демо-разбор (угол локтя, ширина хвата, скорость)
 * по мок-данным. Следующий прирост — WebWorker + BlazePose/MoveNet.
 *
 * Совместимость: Telegram WebView (Android Chromium, iOS WKWebView) — требует
 * HTTPS + жест клика для getUserMedia, fallback input capture всегда работает.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Lift } from '../../../engines/lms/weakpoint-pl';

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

export const VideoCaptureCard: React.FC<{ lift: Lift; onResult?: (r: VideoAnalysisResult) => void }> = ({ lift, onResult }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isTg, setIsTg] = useState(false);

  useEffect(()=>{
    try { setIsTg(!!(window as any).Telegram?.WebApp); } catch { setIsTg(false); }
    return ()=>{ stream?.getTracks().forEach(t=>t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startCam = async ()=>{
    setError(null);
    try{
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ ideal:640 }, height:{ ideal:480 } }, audio:false });
      setStream(s);
      if (videoRef.current){ videoRef.current.srcObject=s; await videoRef.current.play(); }
    }catch(e:any){
      setError(e?.message || 'Камера отклонена. Используйте «Выбрать файл» — надёжно в Telegram.');
    }
  };
  const stopCam = ()=>{
    stream?.getTracks().forEach(t=>t.stop());
    setStream(null);
    if(videoRef.current) videoRef.current.srcObject=null;
  };
  const [progress, setProgress] = useState<number>(0);
  const handleFile = async (f: File | null)=>{
    if(!f) return;
    setError(null);
    setAnalyzing(true);
    setProgress(5);
    const url = URL.createObjectURL(f);
    const vid = document.createElement('video');
    vid.src = url;
    vid.muted = true;
    vid.playsInline = true;
    vid.crossOrigin = 'anonymous';
    try{
      await new Promise<void>((res, rej)=>{
        vid.onloadedmetadata = ()=> res();
        vid.onerror = ()=> rej(new Error('Не удалось загрузить видео'));
        setTimeout(()=>rej(new Error('Таймаут загрузки видео')), 8000);
      });
      // пробуем реальный CV через воркер (не морозит UI)
      let out: VideoAnalysisResult | null = null;
      try{
        const { analyzeVideoWithWorker, analyzeVideoElement } = await import('../../../engines/cv/pose-engine');
        // воркер с прогрессом, фолбэк на главный поток
        let m: any = null;
        try {
          m = await analyzeVideoWithWorker(vid as any, lift, (p)=> setProgress(p));
        } catch (e) {
          console.warn('[video] worker failed, fallback', e);
          m = await analyzeVideoElement(vid as any, lift);
        }
        if (m && (m.elbowAvgDeg!=null || m.barVelocity!=null)) {
          out = {
            elbowAvgDeg: m.elbowAvgDeg ?? 0,
            gripRatio: m.gripRatio ?? 0,
            barVelocity: m.barVelocity ?? null,
            bridge: m.bridge ?? null,
            note: m.elbowAvgDeg!=null ? 'CV-анализ BlazePose (воркер, локально, блины — по запястьям; трекинг дисков — след. шаг).' : 'Поза не распознана — использован мок.',
          };
        }
      }catch(e){
        console.warn('[video] pose failed', e);
      }
      if (!out) out = mockAnalyze(lift);
      setResult(out);
      onResult?.(out);
      // сохранить отчёт локально для истории (не в облако — тяжёлый)
      try{
        const raw = JSON.parse(localStorage.getItem('he_cv_reports')||'[]');
        raw.unshift({ ts: Date.now(), lift, fileName: f.name, result: out });
        localStorage.setItem('he_cv_reports', JSON.stringify(raw.slice(0,20)));
      }catch{}
    }catch(e:any){
      setError(e?.message || 'Ошибка обработки видео');
      const r = mockAnalyze(lift);
      setResult(r);
      onResult?.(r);
    }finally{
      setAnalyzing(false);
      setProgress(0);
      URL.revokeObjectURL(url);
      vid.remove();
    }
  };

  const g = LIFT_GUIDE[lift] ?? LIFT_GUIDE.bench;

  return (
    <div className="train-videocap" style={{ padding:12, borderRadius:10, background:'rgba(24,24,27,0.45)', border:'1px dashed rgba(56,189,248,0.25)', marginTop:8 }}>
      <div style={{ fontSize:11, fontWeight:800, color:ACCENT }}>📹 Видео-анализ · {g.title}</div>
      <div style={{ fontSize:10, color:DIM, marginTop:2, lineHeight:1.4 }}>
        {isTg ? 'Telegram Mini App — камера по клику, HTTPS.' : 'Браузер — камера по клику.'} {g.cam}
      </div>

      {/* ГИД */}
      <div style={{ marginTop:8, padding:8, borderRadius:8, background:'rgba(56,189,248,0.06)', border:'1px solid rgba(56,189,248,0.18)' }}>
        <div style={{ fontSize:10, fontWeight:800, color:ACCENT }}>🎯 Как снимать — чек-лист ракурса</div>
        <div style={{ fontSize:10, color:DIM, marginTop:4, lineHeight:1.5 }}>
          <div>📷 <b style={{color:'#fff'}}>Ракурс:</b> {g.cam}</div>
          <div>📏 <b style={{color:'#fff'}}>Дистанция:</b> {g.dist}</div>
          <div>📐 <b style={{color:'#fff'}}>Высота:</b> {g.height}</div>
          <div>💡 <b style={{color:'#fff'}}>Свет:</b> {g.light}</div>
          <div style={{ marginTop:6, color:'#38bdf8', fontWeight:700 }}>✅ В кадре обязательно:</div>
          <ul style={{ margin:'2px 0 0 14px', padding:0 }}>{g.markers.map((m,i)=><li key={i} style={{ fontSize:10, color:DIM }}>{m}</li>)}</ul>
          {g.bad.length>0 && <><div style={{ marginTop:6, color:'#f87171', fontWeight:700 }}>❌ Частые ошибки:</div><ul style={{ margin:'2px 0 0 14px', padding:0 }}>{g.bad.map((m,i)=><li key={i} style={{ fontSize:10, color:DIM }}>{m}</li>)}</ul></>}
          <div style={{ marginTop:6, padding:'6px 8px', borderRadius:6, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', color:'#fbbf24', fontSize:10 }}>
            💡 Советы: штатив/полка {' > '} руки; 1 подход = 1 видео (5-8с); снимайте последний тяжёлый подход; боковая камера — главная для локтей/траектории; не обрезайте штангу/стопы.
          </div>
        </div>
      </div>

      {/* Кнопки */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
        {!stream ? <button disabled={analyzing} onClick={startCam} style={{ padding:'7px 12px', borderRadius:7, cursor: analyzing?'not-allowed':'pointer', background:'rgba(56,189,248,0.15)', color:ACCENT, border:'1px solid rgba(56,189,248,0.3)', fontWeight:700, fontSize:10, opacity: analyzing?0.6:1 }}>📹 Включить камеру</button>
          : <button onClick={stopCam} style={{ padding:'7px 12px', borderRadius:7, cursor:'pointer', background:'rgba(239,68,68,0.12)', color:'#f87171', border:'1px solid rgba(239,68,68,0.3)', fontWeight:700, fontSize:10 }}>⏹ Стоп</button>}
        <label style={{ padding:'7px 12px', borderRadius:7, border:'1px solid rgba(56,189,248,0.3)', background:'rgba(56,189,248,0.1)', color:ACCENT, fontSize:10, fontWeight:700, cursor: analyzing?'not-allowed':'pointer', opacity: analyzing?0.6:1 }}>
          📁 Выбрать файл (надёжно в Telegram)
          <input type="file" accept="video/*" capture="environment" style={{ display:'none' }} onChange={e=>handleFile(e.target.files?.[0] ?? null)} disabled={analyzing} />
        </label>
        <button disabled={analyzing} onClick={()=>{ const r=mockAnalyze(lift); setResult(r); onResult?.(r); }} style={{ padding:'7px 12px', borderRadius:7, cursor: analyzing?'not-allowed':'pointer', background:'rgba(0,230,138,0.12)', color:'#00e68a', border:'1px solid rgba(0,230,138,0.25)', fontWeight:700, fontSize:10, opacity: analyzing?0.6:1 }}>🧪 Демо-разбор</button>
      </div>
      {analyzing && <div style={{ marginTop:6, fontSize:10, color:ACCENT, background:'rgba(56,189,248,0.08)', border:'1px solid rgba(56,189,248,0.2)', padding:'6px 8px', borderRadius:6 }}>⏳ Анализ видео… {progress>0?`${progress}% — `:''}BlazePose воркер (не морозит UI) — первый раз качает WASM ~2-3с.</div>}
      {error && <div style={{ marginTop:6, fontSize:10, color:'#f87171', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', padding:'6px 8px', borderRadius:6 }}>{error}</div>}

      {/* Preview */}
      <div style={{ marginTop:8, borderRadius:8, overflow:'hidden', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', display: stream ? 'block':'none' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', maxHeight:240, display:'block', background:'#000' }} />
        <div style={{ fontSize:9, color:DIM, padding:'4px 6px' }}>Превью — держите телефон горизонтально, 45° к скамье, уровень грифа. Снимите 1 подход целиком.</div>
      </div>

      {/* Result */}
      {result && (
        <div style={{ marginTop:8, padding:8, borderRadius:8, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(0,230,138,0.15)' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#00e68a' }}>📊 Разбор (MVP мок):</div>
          <div style={{ fontSize:10, color:DIM, marginTop:4, lineHeight:1.4 }}>
            {result.elbowAvgDeg>0 && <div>Локти (средн.): <b style={{color:'#fff'}}>{result.elbowAvgDeg}°</b> {result.elbowAvgDeg<40?'— tucked':result.elbowAvgDeg>65?'— flared':'— moderate'}</div>}
            {result.gripRatio>0 && <div>Хват ratio: <b style={{color:'#fff'}}>{result.gripRatio.toFixed(2)}×</b> ширины плеч</div>}
            {result.barVelocity!=null && <div>Скорость (оценка): <b style={{color:'#fff'}}>{result.barVelocity.toFixed(2)} м/с</b></div>}
            {result.bridge!=null && <div>Мост: <b style={{color:'#fff'}}>{result.bridge?'есть':'нет'}</b></div>}
            <div style={{ marginTop:4, color:'#fbbf24' }}>{result.note}</div>
            <div style={{ marginTop:4, fontSize:9, color:'#fff' }}>След. шаг — воркер + BlazePose: автозамер локтей/хвата/скорости и подсветка коррекции в блоке 5 мастера.</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCaptureCard;
