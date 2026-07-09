import React from 'react';

interface MeasurementEntry {
  date: string; weightKg?: number | null; waistCm?: number | null; chestCm?: number | null;
  bicepCm?: number | null; thighCm?: number | null; hipCm?: number | null; bodyFat?: number | null;
  photos?: string[];
}

const MEASUREMENTS_LOG_KEY = 'he_measurements_log';

export const ProfileMeasurementsTab: React.FC = () => {
  const [measLog, setMeasLog] = React.useState<MeasurementEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(MEASUREMENTS_LOG_KEY) || '[]'); } catch { return []; }
  });
  const [weightKg, setWeightKg] = React.useState('');
  const [waist, setWaist] = React.useState('');
  const [chest, setChest] = React.useState('');
  const [bicep, setBicep] = React.useState('');
  const [thigh, setThigh] = React.useState('');
  const [hip, setHip] = React.useState('');
  const [bodyFat, setBodyFat] = React.useState('');
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [editIdx, setEditIdx] = React.useState<number | null>(null);
  const photoRef = React.useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setWeightKg(''); setWaist(''); setChest(''); setBicep(''); setThigh(''); setHip(''); setBodyFat(''); setPhotos([]); setEditIdx(null);
  };

  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl.length > 200000) return; // cap at ~200KB to avoid localStorage quota
      setPhotos(prev => [...prev, dataUrl].slice(-4));
      try {
        localStorage.setItem('he_meas_photos', JSON.stringify([
          ...(JSON.parse(localStorage.getItem('he_meas_photos') || '[]')),
          { date: new Date().toISOString().split('T')[0], photo: dataUrl }
        ].slice(-10)));
      } catch {}
    };
    reader.readAsDataURL(file);
  };

  const saveMeas = () => {
    if (!waist && !chest && !bicep && !weightKg) return;
    const entry: MeasurementEntry = {
      date: editIdx !== null ? measLog[editIdx].date : new Date().toISOString().split('T')[0],
      weightKg: weightKg ? parseFloat(weightKg) : null,
      waistCm: waist ? parseFloat(waist) : null, chestCm: chest ? parseFloat(chest) : null,
      bicepCm: bicep ? parseFloat(bicep) : null, thighCm: thigh ? parseFloat(thigh) : null,
      hipCm: hip ? parseFloat(hip) : null, bodyFat: bodyFat ? parseFloat(bodyFat) : null,
      photos: photos.length > 0 ? photos : undefined,
    };
    let updated: MeasurementEntry[];
    if (editIdx !== null) {
      updated = measLog.map((m, i) => i === editIdx ? entry : m);
    } else {
      updated = [...measLog, entry];
    }
    setMeasLog(updated);
    try { localStorage.setItem(MEASUREMENTS_LOG_KEY, JSON.stringify(updated)); } catch {}
    resetForm();
  };

  const deleteMeas = (idx: number) => {
    const updated = measLog.filter((_, i) => i !== idx);
    setMeasLog(updated);
    try { localStorage.setItem(MEASUREMENTS_LOG_KEY, JSON.stringify(updated)); } catch {}
    if (editIdx === idx) resetForm();
  };

  const startEdit = (idx: number) => {
    const m = measLog[idx];
    setWeightKg(m.weightKg ? String(m.weightKg) : '');
    setWaist(m.waistCm ? String(m.waistCm) : '');
    setChest(m.chestCm ? String(m.chestCm) : '');
    setBicep(m.bicepCm ? String(m.bicepCm) : '');
    setThigh(m.thighCm ? String(m.thighCm) : '');
    setHip(m.hipCm ? String(m.hipCm) : '');
    setBodyFat(m.bodyFat ? String(m.bodyFat) : '');
    setPhotos(m.photos || []);
    setEditIdx(idx);
  };

  return (
    <div style={{ padding:'0 0 80px' }}>
      <h3 style={{ margin:'0 0 4px', fontSize:15, fontWeight:800, color:'#fff' }}>📏 Дневник замеров</h3>
      <p style={{ fontSize:10, color:'rgba(255,255,255,0.7)', margin:'0 0 12px' }}>Вес, обхваты, жир, фото</p>
      <div style={{ borderRadius:12, padding:14, marginBottom:10, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
        {editIdx !== null && (
          <div style={{ fontSize:9, color:'#f59e0b', fontWeight:600, marginBottom:6 }}>
            ✏️ Редактирование записи от {measLog[editIdx]?.date}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
          {[
            { l:'Вес, кг', v: weightKg, s: setWeightKg }, { l:'Талия, см', v: waist, s: setWaist },
            { l:'Грудь, см', v: chest, s: setChest }, { l:'Бицепс, см', v: bicep, s: setBicep },
            { l:'Бедро, см', v: thigh, s: setThigh }, { l:'Ягодицы, см', v: hip, s: setHip },
            { l:'Жир, %', v: bodyFat, s: setBodyFat },
          ].map((f, i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <label style={{ fontSize:8, color:'rgba(255,255,255,0.5)' }}>{f.l}</label>
              <input type="number" value={f.v} onChange={e => f.s(e.target.value)} placeholder="—"
                style={{ padding:'8px 6px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', fontSize:12 }} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, marginTop:6 }}>
          <input ref={photoRef} type="file" accept="image/*" onChange={addPhoto} style={{ display:'none' }} />
          <button onClick={() => photoRef.current?.click()}
            style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', fontSize:10, cursor:'pointer' }}>📸 Фото</button>
          <button onClick={saveMeas}
            style={{ flex:1, padding:'8px', borderRadius:8, border:'none', background:'#00e68a', color:'#000', fontWeight:700, fontSize:12, cursor:'pointer' }}>{editIdx !== null ? '💾 Обновить' : '💾 Сохранить'}</button>
          {editIdx !== null && (
            <button onClick={resetForm}
              style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.7)', fontSize:10, cursor:'pointer' }}>✕ Отмена</button>
          )}
        </div>
        {photos.length > 0 && (
          <div style={{ display:'flex', gap:4, marginTop:4, overflowX:'auto' }}>
            {photos.map((p, i) => (
              <div key={i} style={{ width:48, height:48, borderRadius:6, overflow:'hidden', flexShrink:0, position:'relative' }}>
                <img src={p} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                <div onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ position:'absolute', top:0, right:0, width:14, height:14, background:'rgba(0,0,0,0.6)', borderRadius:'50%', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>✕</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {measLog.length > 0 && (
        <div style={{ borderRadius:12, padding:14, background:'rgba(24,24,27,0.15)', border:'1px solid rgba(255,255,255,0.04)' }}>
          <h4 style={{ margin:'0 0 8px', fontSize:11, fontWeight:700, color:'#fff' }}>История ({measLog.length})</h4>
          {[...measLog].reverse().map((m: any, i: number) => {
            const realIdx = measLog.length - 1 - i;
            return (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 8px', borderRadius:4, background: i%2===0 ? 'rgba(255,255,255,0.03)' : 'transparent', fontSize:9 }}>
                <span style={{ fontWeight:600, cursor:'pointer' }} onClick={() => startEdit(realIdx)}>{m.date}</span>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <span style={{ color:'rgba(255,255,255,0.6)' }}>
                    {m.weightKg ? `В:${m.weightKg}кг ` : ''}{m.waistCm ? `Т:${m.waistCm} ` : ''}
                    {m.chestCm ? `Г:${m.chestCm} ` : ''}{m.bodyFat ? `Ж:${m.bodyFat}%` : ''}
                    {m.photos?.length ? `📸${m.photos.length}` : ''}
                  </span>
                  <button onClick={() => deleteMeas(realIdx)}
                    style={{ padding:'1px 5px', borderRadius:4, fontSize:7, cursor:'pointer', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {measLog.length === 0 && (
        <div style={{ textAlign:'center', padding:30, fontSize:11, color:'rgba(255,255,255,0.5)' }}>Нет записей. Добавьте первый замер.</div>
      )}
    </div>
  );
};
