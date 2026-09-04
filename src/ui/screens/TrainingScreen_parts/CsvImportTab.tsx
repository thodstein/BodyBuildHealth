import React, { useState } from 'react';
import { importSessionsFromCSV } from '../../../engines/workout-logger.engine';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color:'#fff', fontSize: 11, lineHeight: 1.4 };

type ImportFormat = 'csv' | 'hevy' | 'strong' | 'mesomorph';

const FORMATS: { id: ImportFormat; label: string }[] = [
  { id: 'csv', label: 'CSV' },
  { id: 'hevy', label: 'Hevy JSON' },
  { id: 'strong', label: 'Strong JSON' },
  { id: 'mesomorph', label: 'Mesomorph' },
];

const SAMPLES: Record<ImportFormat, string> = {
  csv: `date,exercise,set,weight,reps,rpe,rir
2026-06-01,Жим лёжа,1,80,5,7,2
2026-06-01,Жим лёжа,2,80,5,7,2
2026-06-01,Присед,1,100,5,8,2
2026-06-03,Тяга штанги,1,60,8,7,2`,
  hevy: `[
  {
    "title": "Push День",
    "start_time": "2026-06-01T10:00:00Z",
    "exercises": [
      {
        "title": "Bench Press",
        "sets": [
          { "index": 0, "weight_kg": 80, "reps": 5, "rpe": 7 }
        ]
      }
    ]
  }
]`,
  strong: `[
  {
    "Name": "My Workout",
    "Date": "2026-06-01",
    "Exercises": [
      {
        "Name": "Bench Press",
        "Sets": [
          { "WeightKg": 80, "Reps": 5, "RPE": 7 }
        ]
      }
    ]
  }
]`,
  mesomorph: `[
  {
    "date": "2026-06-01",
    "name": "Push День",
    "exercises": [
      {
        "name": "Bench Press",
        "sets": [
          { "weight": 80, "reps": 5, "rpe": 7 }
        ]
      }
    ]
  }
]`,
};

function parseHevy(json: string): string {
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) throw new Error('Hevy JSON должен быть массивом тренировок.');
    const lines: string[] = ['date,exercise,set,weight,reps,rpe,rir'];
    data.forEach((wo: any) => {
      const date = (wo.start_time || '').slice(0, 10);
      if (!date) return;
      (wo.exercises || []).forEach((ex: any) => {
        (ex.sets || []).forEach((s: any, si: number) => {
          lines.push([date, ex.title || ex.name || 'Упражнение', si + 1, s.weight_kg || s.weight, s.reps, s.rpe || '', ''].join(','));
        });
      });
    });
    return lines.join('\n');
  } catch (e: any) {
    throw new Error('Hevy JSON parse error: ' + e.message);
  }
}

function parseStrong(json: string): string {
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) throw new Error('Strong JSON должен быть массивом тренировок.');
    const lines: string[] = ['date,exercise,set,weight,reps,rpe,rir'];
    data.forEach((wo: any) => {
      const date = (wo.Date || wo.date || '').slice(0, 10);
      if (!date) return;
      (wo.Exercises || wo.exercises || []).forEach((ex: any) => {
        (ex.Sets || ex.sets || []).forEach((s: any, si: number) => {
          lines.push([date, ex.Name || ex.name || 'Упражнение', si + 1, s.WeightKg ?? s.weight ?? s.weight_kg, s.Reps ?? s.reps, String(s.RPE ?? s.rpe ?? ''), String(s.RIR ?? s.rir ?? '')].join(','));
        });
      });
    });
    return lines.join('\n');
  } catch (e: any) {
    throw new Error('Strong JSON parse error: ' + e.message);
  }
}

function parseMesomorph(json: string): string {
  try {
    const data = JSON.parse(json);
    const workouts = Array.isArray(data) ? data : (data.workouts || data.sessions || [data]);
    const lines: string[] = ['date,exercise,set,weight,reps,rpe,rir'];
    workouts.forEach((wo: any) => {
      const date = (wo.date || wo.Date || wo.start_time || '').slice(0, 10);
      if (!date) return;
      (wo.exercises || wo.Exercises || []).forEach((ex: any) => {
        (ex.sets || ex.Sets || []).forEach((s: any, si: number) => {
          lines.push([date, ex.name || ex.Name || ex.title || 'Упражнение', si + 1, s.weight || s.WeightKg || s.weight_kg || s.Weight, s.reps || s.Reps, s.rpe || s.RPE || '', s.rir || s.RIR || ''].join(','));
        });
      });
    });
    return lines.join('\n');
  } catch (e: any) {
    throw new Error('Mesomorph JSON parse error: ' + e.message);
  }
}

export const CsvImportTab: React.FC<{ onDone?: () => void }> = ({ onDone }) => {
  const [text, setText] = useState('');
  const [format, setFormat] = useState<ImportFormat>('csv');
  const [result, setResult] = useState<{ importedSessions: number; importedSets: number; errors: string[] } | null>(null);

  const doImport = () => {
    try {
      let csvText = text;
      if (format === 'hevy') csvText = parseHevy(text);
      else if (format === 'strong') csvText = parseStrong(text);
      else if (format === 'mesomorph') csvText = parseMesomorph(text);
      const r = importSessionsFromCSV(csvText);
      setResult(r);
      if (r.importedSessions > 0 && onDone) onDone();
    } catch (e: any) {
      setResult({ importedSessions: 0, importedSets: 0, errors: [e.message || 'Ошибка парсинга.'] });
    }
  };

  const loadSample = () => { setText(SAMPLES[format]); setResult(null); };

  return (
    <div className="train-csvimport" style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>📥 Импорт тренировок</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {FORMATS.map(f => (
          <button key={f.id} onClick={() => { setFormat(f.id); setResult(null); }}
            style={{
              padding: '5px 12px', borderRadius: 8, border: format === f.id ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
              background: format === f.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
              color: format === f.id ? ACCENT : '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 700,
            }}
          >{f.label}</button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#fff', marginBottom: 10 }}>
        {format === 'csv' && <>Формат: <b>date,exercise,set,weight,reps,rpe,rir</b>. Дата YYYY-MM-DD. Строки группируются по дате в сессии.</>}
        {format === 'hevy' && <>Hevy JSON — массив тренировок с полями <b>title, start_time, exercises[].sets[]</b> (weight_kg, reps, rpe).</>}
        {format === 'strong' && <>Strong JSON — массив тренировок с полями <b>Name, Date, Exercises[].Sets[]</b> (WeightKg, Reps, RPE).</>}
        {format === 'mesomorph' && <>Mesomorph — массив/объект тренировок с полями <b>date, name, exercises[].sets[]</b> (weight, reps, rpe).</>}
      </div>

      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={SAMPLES[format]} rows={10}
        style={{ width: '100%', boxSizing: 'border-box', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 10, fontFamily: 'monospace', fontSize: 11 }} />

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={doImport} disabled={!text.trim()}
          style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed', background: text.trim() ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.05)', color: text.trim() ? '#000' : '#fff', fontWeight: 700, fontSize: 13 }}>
          📥 Импортировать ({FORMATS.find(f => f.id === format)?.label || format})
        </button>
        <button onClick={loadSample} style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 11 }}>Пример</button>
      </div>

      {result && (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: result.importedSessions > 0 ? 'rgba(0,230,138,0.06)' : 'rgba(239,68,68,0.06)', border: '1px solid ' + (result.importedSessions > 0 ? 'rgba(0,230,138,0.25)' : 'rgba(239,68,68,0.25)') }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: result.importedSessions > 0 ? ACCENT : '#ef4444' }}>
            {result.importedSessions > 0 ? `✅ Импортировано: ${result.importedSessions} сессий, ${result.importedSets} сетов` : '⚠ Ничего не импортировано'}
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>Ошибки/пропуски ({result.errors.length}):</div>
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {result.errors.slice(0, 30).map((e, i) => <div key={i} style={{ fontSize: 10, color: '#fca5a5', lineHeight: 1.4 }}>{e}</div>)}
              </div>
            </div>
          )}
          {result.importedSessions > 0 && <div style={{ ...SMALL, marginTop: 8 }}>Данные появятся в Дневнике и Аналитике после перезагрузки вкладки.</div>}
        </div>
      )}
    </div>
  );
};

export default React.memo(CsvImportTab);
