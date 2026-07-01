import React, { useState } from 'react';
import { importSessionsFromCSV } from '../../../engines/workout-logger.engine';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };

export const CsvImportTab: React.FC<{ onDone?: () => void }> = ({ onDone }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ importedSessions: number; importedSets: number; errors: string[] } | null>(null);

  const doImport = () => {
    const r = importSessionsFromCSV(text);
    setResult(r);
    if (r.importedSessions > 0 && onDone) onDone();
  };

  const sample = `date,exercise,set,weight,reps,rpe,rir
2026-06-01,Жим лёжа,1,80,5,7,2
2026-06-01,Жим лёжа,2,80,5,7,2
2026-06-01,Присед,1,100,5,8,2
2026-06-03,Тяга штанги,1,60,8,7,2`;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>📥 Импорт тренировок из CSV</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
        Формат (как экспорт): <b>date,exercise,set,weight,reps,rpe,rir</b> (rpe/rir optional). Дата YYYY-MM-DD. Строки группируются по дате в сессии. Дубли по дате не импортируются повторно.
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={sample} rows={10} style={{ width: '100%', boxSizing: 'border-box', background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 10, fontFamily: 'monospace', fontSize: 11 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={doImport} disabled={!text.trim()} style={{ flex: 1, padding: 11, borderRadius: 8, border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed', background: text.trim() ? 'linear-gradient(135deg,#00e68a,#00c853)' : 'rgba(255,255,255,0.05)', color: text.trim() ? '#000' : 'var(--text-dim)', fontWeight: 700, fontSize: 13 }}>📥 Импортировать</button>
        <button onClick={() => { setText(sample); setResult(null); }} style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11 }}>Пример</button>
      </div>

      {result && (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: result.importedSessions > 0 ? 'rgba(0,230,138,0.06)' : 'rgba(239,68,68,0.06)', border: '1px solid ' + (result.importedSessions > 0 ? 'rgba(0,230,138,0.25)' : 'rgba(239,68,68,0.25)') }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: result.importedSessions > 0 ? ACCENT : '#ef4444' }}>
            {result.importedSessions > 0 ? `✅ Импортировано: ${result.importedSessions} сессий, ${result.importedSets} сетов` : '⚠ Ничего не импортировано'}
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Ошибки/пропуски ({result.errors.length}):</div>
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