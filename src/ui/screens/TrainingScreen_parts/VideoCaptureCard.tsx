/**
 * VideoCaptureCard.tsx — CV-видео (BlazePose) всегда видно.
 * Стекло rgba(24,24,27,0.42) border 0.07 blur12 radius14, белый #fff, gradient активные кнопки, доп. движения.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Lift } from '../../../engines/lms/weakpoint-pl';

const ACCENT = '#38bdf8';
const GLASS: React.CSSProperties = { background:'rgba(24,24,27,0.42)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', borderRadius:14 } as any;

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
  biceps: { title: 'Подъём на бицепс — сбоку', cam: 'Сбоку', dist: '1.5 м', height: 'Уровень локтя', light: 'Равномерный', markers: ['Локоть прижат', 'Без читинга корпусом'], bad: [] },
};

export interface VideoAnalysisResult {
  elbowAvgDeg: number;
  gripRatio: number;
  barVelocity: number | null;
  bridge: boolean | null;
  note: string;
}

function mockAnalyze(lift: Lift): VideoAnalysisResult {
  if (lift === 'bench') return { elbowAvgDeg: 52, gripRatio: 1.42, barVelocity: 0.48, bridge: true, note: 'Мок-разбор (BlazePose — следующий прогон: реальные углы/скорость).' };
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
      setError(e?.message || 'Камера отклонена. Используй «Выбрать файл» — надёжно в Telegram.');
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
      let out: VideoAnalysisResult | null = null;
      try{
        const { analyzeVideoWithWorker, analyzeVideoElement } = await import('../../../engines/cv/pose-engine');
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
            note: m.elbowAvgDeg!=null ? 'CV-анализ BlazePose (воркер, локально, по запястьям; трекинг дисков — след. шаг).' : 'Поза не распознана — мок.',
          };
        }
      }catch(e){
        console.warn('[video] pose failed', e);
      }
      if (!out) out = mockAnalyze(lift);
      setResult(out);
      onResult?.(out);
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
    <div style={{ ...GLASS, padding:12, marginTop:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <div style={{ width:26, height:26, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#38bdf8,#0ea5e9)', color:'#000', fontWeight:900, fontSize:13, flexShrink:0 }}>📹</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:800, color:'#fff', lineHeight:1 }}>Видео-анализ · {g.title}</div>
          <div style={{ fontSize:10, color:'#fff', lineHeight:1.35, opacity:0.9, marginTop:2 }}>{isTg ? 'Telegram Mini App — камера по клику, HTTPS.' : 'Браузер — камера по клику.'} {g.cam}</div>
        </div>
      </div>
      {/* видео всегда видно — превью блок */}
      <div style={{ borderRadius:10, overflow:'hidden', background:'rgba(0,0,0,0.28)', border:'1px solid rgba(255,255,255,0.07)', display: stream ? 'block':'none', marginBottom:8 }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', maxHeight:240, display:'block', background:'#000' }} />
        <div style={{ fontSize:9, color:'#fff', padding:'5px 7px', opacity:0.85 }}>Превью — держи телефон горизонтально, 45° к скамье, уровень грифа. 1 подход = 1 видео (5-8с).</div>
      </div>
      {!stream && (
        <div style={{ borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', padding:'8px 10px', marginBottom:8, fontSize:10, color:'#fff', lineHeight:1.4 }}>
          <span style={{ color:'#fff', fontWeight:700 }}>Превью появится после включения камеры.</span> <span style={{ opacity:0.85 }}>Включи камеру или выбери файл — BlazePose считает углы и скорость локально.</span>
        </div>
      )}

      {/* гид — красиво отрендерен, без sticky */}
      <div style={{ padding:9, borderRadius:10, background:'rgba(56,189,248,0.06)', border:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize:10, fontWeight:800, color:'#fff' }}>🎯 Как снимать — чек-лист ракурса</div>
        <div style={{ fontSize:10, color:'#fff', marginTop:6, lineHeight:1.6 }}>
          <div>📷 <b style={{color:'#fff'}}>Ракурс:</b> {g.cam}</div>
          <div>📏 <b style={{color:'#fff'}}>Дистанция:</b> {g.dist}</div>
          <div>📐 <b style={{color:'#fff'}}>Высота:</b> {g.height}</div>
          <div>💡 <b style={{color:'#fff'}}>Свет:</b> {g.light}</div>
          <div style={{ marginTop:7, color:'#fff', fontWeight:800 }}>✅ В кадре обязательно:</div>
          <ul style={{ margin:'3px 0 0 16px', padding:0 }}>{g.markers.map((m,i)=><li key={i} style={{ fontSize:10, color:'#fff', opacity:0.92 }}>{m}</li>)}</ul>
          {g.bad.length>0 && <><div style={{ marginTop:7, color:'#fff', fontWeight:800 }}>❌ Частые ошибки:</div><ul style={{ margin:'3px 0 0 16px', padding:0 }}>{g.bad.map((m,i)=><li key={i} style={{ fontSize:10, color:'#fff', opacity:0.92 }}>{m}</li>)}</ul></>}
          <div style={{ marginTop:8, padding:'7px 9px', borderRadius:8, background:'rgba(251,191,36,0.07)', border:'1px solid rgba(255,255,255,0.07)', color:'#fff', fontSize:10, lineHeight:1.45 }}>
            💡 Штатив/полка &gt; руки · 1 подход = 1 видео (5-8с) · последний тяжёлый подход · боковая камера главная для локтей/траектории · штанга и стопы в кадре.
          </div>
        </div>
      </div>

      {/* кнопки — gradient активные */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
        {!stream ? <button disabled={analyzing} onClick={startCam} style={{ padding:'8px 13px', borderRadius:20, cursor: analyzing?'not-allowed':'pointer', background: analyzing?'rgba(255,255,255,0.06)':'linear-gradient(135deg,#38bdf8,#0ea5e9)', color: analyzing?'#fff':'#000', border:'1px solid rgba(255,255,255,0.07)', fontWeight:800, fontSize:10, opacity: analyzing?0.6:1 }}>📹 Включить камеру</button>
          : <button onClick={stopCam} style={{ padding:'8px 13px', borderRadius:20, cursor:'pointer', background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', border:'1px solid rgba(255,255,255,0.07)', fontWeight:800, fontSize:10 }}>⏹ Стоп</button>}
        <label style={{ padding:'8px 13px', borderRadius:20, border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:10, fontWeight:800, cursor: analyzing?'not-allowed':'pointer', opacity: analyzing?0.6:1, display:'inline-flex', alignItems:'center' }}>
          📁 Выбрать файл
          <input type="file" accept="video/*" capture="environment" style={{ display:'none' }} onChange={e=>handleFile(e.target.files?.[0] ?? null)} disabled={analyzing} />
        </label>
        <button disabled={analyzing} onClick={()=>{ const r=mockAnalyze(lift); setResult(r); onResult?.(r); }} style={{ padding:'8px 13px', borderRadius:20, cursor: analyzing?'not-allowed':'pointer', background:'rgba(0,230,138,0.14)', color:'#fff', border:'1px solid rgba(255,255,255,0.07)', fontWeight:800, fontSize:10, opacity: analyzing?0.6:1 }}>🧪 Демо-разбор</button>
      </div>
      {analyzing && <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(56,189,248,0.07)', border:'1px solid rgba(255,255,255,0.07)', padding:'7px 9px', borderRadius:8 }}>⏳ Анализ видео… {progress>0?`${progress}% — `:''}BlazePose воркер (не морозит UI) — первый прогон качает WASM 2-3с.</div>}
      {error && <div style={{ marginTop:8, fontSize:10, color:'#fff', background:'rgba(239,68,68,0.09)', border:'1px solid rgba(255,255,255,0.07)', padding:'7px 9px', borderRadius:8 }}>{error}</div>}

      {/* результат — белый текст */}
      {result && (
        <div style={{ marginTop:10, padding:9, borderRadius:10, background:'rgba(0,230,138,0.06)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#fff' }}>📊 Разбор:</div>
          <div style={{ fontSize:10, color:'#fff', marginTop:5, lineHeight:1.5 }}>
            {result.elbowAvgDeg>0 && <div>Локти (средн.): <b style={{color:'#fff'}}>{result.elbowAvgDeg}°</b> <span style={{opacity:0.85}}>{result.elbowAvgDeg<40?'— tucked':result.elbowAvgDeg>65?'— flared':'— moderate'}</span></div>}
            {result.gripRatio>0 && <div>Хват ratio: <b style={{color:'#fff'}}>{result.gripRatio.toFixed(2)}×</b> ширины плеч</div>}
            {result.barVelocity!=null && <div>Скорость (оценка): <b style={{color:'#fff'}}>{result.barVelocity.toFixed(2)} м/с</b></div>}
            {result.bridge!=null && <div>Мост: <b style={{color:'#fff'}}>{result.bridge?'есть':'нет'}</b></div>}
            <div style={{ marginTop:5, color:'#fff', opacity:0.9 }}>{result.note}</div>
            <div style={{ marginTop:4, fontSize:9, color:'#fff', opacity:0.7 }}>Воркер BlazePose: углы/хват/скорость и подсветка коррекций — локально, без отправки видео.</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCaptureCard;
