/**
 * CardioFieldTestLog.tsx — журнал полевых тестов (раунд 4).
 * Monthly AeT-контроль (drift+decoupling → responder), LTHR 30', FTP 20', talk-test.
 * Персистентность: he_cardio_field_tests_v1 (кап 24). Чистая UI-логика, без родителя.
 */
import React, { useMemo, useState } from 'react';
import {
  loadFieldTestLog, saveFieldTestLogEntry, removeFieldTestLogEntry, responderFromLog,
  type FieldTestLogEntry,
} from '../../../engines/lms/cardio.engine';
import { SectionCard, ROW, LABEL, BTN, BTN_PRIMARY, BTN_DANGER, Badge, EmptyState, NumberInput, HINT_SM } from './CardioUI';

type Kind = FieldTestLogEntry['kind'];

const KIND_META: Record<Kind, { label: string; hint: string }> = {
  aet60: { label: 'AeT 60\'', hint: 'Steady 60\' @~75%FTP: drift и decoupling %' },
  lthr30: { label: 'LTHR 30\'', hint: 'Friel: средняя ЧСС последних 20\'' },
  ftp20: { label: 'FTP 20\'', hint: 'Средняя мощность 20\' (FTP = ×0.95)' },
  talk: { label: 'Talk-test', hint: 'Потолок Z2 — ЧСС разговорного темпа' },
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const numOrUndef = (v: string): number | undefined => {
  if (v.trim() === '') return undefined;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

export const CardioFieldTestLog: React.FC = () => {
  const [log, setLog] = useState<FieldTestLogEntry[]>(() => {
    try { return loadFieldTestLog(); } catch { return []; }
  });
  const [kind, setKind] = useState<Kind>('aet60');
  const [date, setDate] = useState(todayIso());
  const [drift, setDrift] = useState('');
  const [decoupling, setDecoupling] = useState('');
  const [lthr, setLthr] = useState('');
  const [ftp, setFtp] = useState('');
  const [talk, setTalk] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const responder = useMemo(() => {
    try { return responderFromLog(log); } catch { return null; }
  }, [log]);

  const valid = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Дата — ГГГГ-ММ-ДД.';
    if (kind === 'aet60') {
      const dr = numOrUndef(drift);
      const dc = numOrUndef(decoupling);
      if (dr == null || dc == null) return 'AeT 60\': нужны drift и decoupling (%).';
    }
    if (kind === 'lthr30') {
      const v = numOrUndef(lthr);
      if (v == null || v < 80 || v > 220) return 'LTHR — 80-220 уд/мин.';
    }
    if (kind === 'ftp20') {
      const v = numOrUndef(ftp);
      if (v == null || v < 30 || v > 800) return 'FTP — 30-800 Вт.';
    }
    if (kind === 'talk') {
      const v = numOrUndef(talk);
      if (v == null || v < 80 || v > 200) return 'Talk-test — 80-200 уд/мин.';
    }
    return null;
  }, [date, kind, drift, decoupling, lthr, ftp, talk]);

  const save = () => {
    if (valid) { setErr(valid); return; }
    const entry: FieldTestLogEntry = { date, kind };
    if (kind === 'aet60') { entry.driftPct = numOrUndef(drift); entry.decouplingPct = numOrUndef(decoupling); }
    if (kind === 'lthr30') entry.lthr = Math.round(numOrUndef(lthr) as number);
    if (kind === 'ftp20') entry.ftpWatts = Math.round((numOrUndef(ftp) as number) * 0.95);
    if (kind === 'talk') entry.talkHr = Math.round(numOrUndef(talk) as number);
    try {
      setLog(saveFieldTestLogEntry(entry));
      setErr(null);
      setDrift(''); setDecoupling(''); setLthr(''); setFtp(''); setTalk('');
    } catch { setErr('Не удалось сохранить замер.'); }
  };

  const remove = (d: string, k: Kind) => {
    try { setLog(removeFieldTestLogEntry(d, k)); } catch { /* ignore */ }
  };

  const metricOf = (e: FieldTestLogEntry): string => {
    if (e.kind === 'aet60') return `drift ${e.driftPct ?? '—'}% · decoupling ${e.decouplingPct ?? '—'}%`;
    if (e.kind === 'lthr30') return `LTHR ${e.lthr ?? '—'} уд/мин`;
    if (e.kind === 'ftp20') return `FTP ${e.ftpWatts ?? '—'} Вт`;
    return `потолок Z2 ${e.talkHr ?? '—'} уд/мин`;
  };

  return (
    <SectionCard
      title="🔬 Контрольные замеры"
      right={responder && responder.responder != null
        ? <Badge bg={responder.responder ? 'rgba(0,230,138,0.12)' : 'rgba(245,158,11,0.12)'} border={responder.responder ? 'rgba(0,230,138,0.28)' : 'rgba(245,158,11,0.28)'} color={responder.responder ? '#4ade80' : '#fbbf24'}>{responder.responder ? 'Responder' : 'Non-responder'}</Badge>
        : undefined}
    >
      <div style={ROW}>
        {(Object.keys(KIND_META) as Kind[]).map(k => (
          <button
            key={k}
            onClick={() => { setKind(k); setErr(null); }}
            aria-label={`Замер: ${KIND_META[k].label}`}
            style={kind === k
              ? { ...BTN, borderColor: 'rgba(0,230,138,0.5)', color: '#00e68a', background: 'rgba(0,230,138,0.12)' }
              : BTN}
          >
            {KIND_META[k].label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{KIND_META[kind].hint}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 700 }}>
          Дата
          <input
            type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Дата замера"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, minHeight: 44 }}
          />
        </label>
        {kind === 'aet60' && (
          <>
            <NumberInput label="Drift %" value={drift} onChange={setDrift} min={-20} max={50} step={0.5} placeholder="5" ariaLabel="Drift" width={90} suffix="%" />
            <NumberInput label="Decoupling %" value={decoupling} onChange={setDecoupling} min={-20} max={50} step={0.5} placeholder="4" ariaLabel="Decoupling" width={90} suffix="%" />
          </>
        )}
        {kind === 'lthr30' && <NumberInput label="LTHR" value={lthr} onChange={setLthr} min={80} max={220} step={1} placeholder="165" ariaLabel="LTHR" width={100} suffix="уд/мин" />}
        {kind === 'ftp20' && <NumberInput label="Мощность 20'" value={ftp} onChange={setFtp} min={30} max={800} step={1} placeholder="250" ariaLabel="Мощность 20 минут" width={100} suffix="Вт" />}
        {kind === 'talk' && <NumberInput label="Потолок Z2" value={talk} onChange={setTalk} min={80} max={200} step={1} placeholder="145" ariaLabel="Talk-test" width={100} suffix="уд/мин" />}
        <button style={BTN_PRIMARY} onClick={save}>💾 Сохранить замер</button>
      </div>
      {err && <div style={{ fontSize: 11, color: '#f87171' }} role="alert">⚠ {err}</div>}
      {responder && responder.responder == null && log.length > 0 && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)' }}>{responder.note}</div>
      )}
      {responder && responder.responder != null && (
        <div style={{ fontSize: 11, color: responder.responder ? '#4ade80' : '#fbbf24' }}>{responder.note}</div>
      )}
      {log.length === 0 ? (
        <EmptyState icon="🔬" title="Замеров нет" desc="AeT 60' раз в месяц: drift + decoupling покажут responder/non-responder." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[...log].reverse().map(e => (
            <div key={`${e.date}|${e.kind}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.55)', minWidth: 86 }}>{e.date}</span>
              <Badge>{KIND_META[e.kind].label}</Badge>
              <span style={{ flex: 1, color: '#fff' }}>{metricOf(e)}</span>
              <button style={{ ...BTN_DANGER, minHeight: 32, padding: '4px 8px' }} onClick={() => remove(e.date, e.kind)} aria-label={`Удалить замер ${e.date} ${KIND_META[e.kind].label}`}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={HINT_SM}>Два AeT-замера с drift+decoupling → responder (оба улучшились) / non-responder. LTHR/FTP-значения подхватываются предпросмотром цикла при вводе в Параметрах.</div>
    </SectionCard>
  );
};
