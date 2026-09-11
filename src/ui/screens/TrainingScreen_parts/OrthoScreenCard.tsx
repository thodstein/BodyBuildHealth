import React, { useMemo, useState } from 'react';
import {
  screenOrtho, orthoGuardsForPlan, saveOrthoFlags, loadOrthoFlags,
  applyOrthoToProfile, rankJointSupport, buildOrthoCsv, buildOrthoHtml,
  orthoBridgePayload, hopLsiOverall, strengthLsiOverall,
  type OrthoScreenInput,
} from '../../../engines/pro/ortho-screen.engine';
import { applyToPlanner } from './planner-bridge';

/**
 * OrthoScreenCard — единый орто-скрининг J1–J7 (скрининг, не диагноз).
 * Используется во всех 4 хабах + TrainingSafetyHub. Стили — инлайн, белый текст.
 */
function Check(props: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }): React.ReactElement {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 11, color: '#fff', lineHeight: 1.35 }}>
      <input type="checkbox" checked={props.value} onChange={e => props.onChange(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: '#f59e0b' }} />
      <span><b style={{ color: '#fff' }}>{props.label}</b>{props.hint ? <span style={{ display: 'block', fontSize: 10, color: '#fff', opacity: 0.85 }}>{props.hint}</span> : null}</span>
    </label>
  );
}

export const OrthoScreenCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [s, setS] = useState({
    painfulArc: false, hawkinsPain: false, jobeWeak: false, dropArm: false, apprehension: false,
    faddirPain: false, faberPain: false, iropPain: false, romFlag: false,
    valgusSls: false, wobbleStepDown: false, ybt: '',
    lsiMeasured: false, lsiPass: false, months: '', graft: 'none' as string, fear: false, prevention: false,
    hopSL: '', hopSR: '', hopTL: '', hopTR: '',
    strQL: '', strQR: '', strHL: '', strHR: '',
    slrPain: false, stiffLong: false, popSound: false, cantHeel: false,
    fink: false, phalen: false, tinel: false, elbowV: false,
    pinkyL: false, pinkyR: false, thumbL: false, thumbR: false, elbowL: false, elbowR: false, kneeL: false, kneeR: false, trunk: false, age: '', pq: '',
    badSleep: false, highStress: false, fearMove: false, teen: false,
    msg: '',
  });
  const set = (k: string, v: boolean | string): void => setS(prev => ({ ...prev, [k]: v }));

  const input: OrthoScreenInput = useMemo(() => ({
    shoulder: { painfulArc: s.painfulArc, hawkinsPain: s.hawkinsPain, jobeWeak: s.jobeWeak, dropArm: s.dropArm, apprehension: s.apprehension },
    hip: { faddirPain: s.faddirPain, faberPain: s.faberPain, iropPain: s.iropPain, romFlag: s.romFlag },
    knee: { valgusSls: s.valgusSls, wobbleStepDown: s.wobbleStepDown, ybtAntDiffCm: s.ybt === '' ? undefined : Number(s.ybt) },
    rts: { lsiMeasured: s.lsiMeasured, lsiPass: s.lsiPass, monthsSinceOp: s.months === '' ? undefined : Number(s.months), graft: s.graft as 'btb' | 'hamstring' | 'other' | 'none', fear: s.fear, preventionProgram: s.prevention, hop: { singleL: s.hopSL === '' ? undefined : Number(s.hopSL), singleR: s.hopSR === '' ? undefined : Number(s.hopSR), tripleL: s.hopTL === '' ? undefined : Number(s.hopTL), tripleR: s.hopTR === '' ? undefined : Number(s.hopTR) }, strength: { quadL: s.strQL === '' ? undefined : Number(s.strQL), quadR: s.strQR === '' ? undefined : Number(s.strQR), hamL: s.strHL === '' ? undefined : Number(s.strHL), hamR: s.strHR === '' ? undefined : Number(s.strHR) } },
    spine: { slrPain: s.slrPain, morningStiffnessLong: s.stiffLong },
    achilles: { popSound: s.popSound, cantHeelRaise: s.cantHeel },
    hand: { finkelsteinPain: s.fink, phalenNumbness: s.phalen, tinelTingle: s.tinel },
    elbowValgusPain: s.elbowV,
    beighton: { pinkyL: s.pinkyL, pinkyR: s.pinkyR, thumbL: s.thumbL, thumbR: s.thumbR, elbowL: s.elbowL, elbowR: s.elbowR, kneeL: s.kneeL, kneeR: s.kneeR, trunk: s.trunk, age: s.age === '' ? undefined : Number(s.age), fivePQ: s.pq === '' ? undefined : Number(s.pq) },
    yellow: { badSleep: s.badSleep, highStress: s.highStress, fearOfMovement: s.fearMove },
    ageBand: s.teen ? 'teen_14_15' : undefined,
  }), [s]);

  const result = useMemo(() => screenOrtho(input), [input]);
  const guards = useMemo(() => orthoGuardsForPlan(result), [result]);
  const hopLsiLive = useMemo(() => hopLsiOverall(input.rts?.hop), [input]);
  const strLsiLive = useMemo(() => strengthLsiOverall(input.rts?.strength), [input]);
  const support = useMemo(() => rankJointSupport(), []);
  const evColor = (e: string): string => e === 'proven' ? '#22c55e' : e === 'moderate' ? '#f59e0b' : e === 'weak' ? '#71717a' : '#f43f5e';

  const save = (): void => {
    saveOrthoFlags(result.flags);
    const r = applyOrthoToProfile(result.flags);
    set('msg', `✅ Сохранено: флагов ${result.flags.length} · в профиль: ${r.mobilityAdd.join(', ') || '—'}`);
    try {
      (window as unknown as { showToast?: (m: string) => void }).showToast?.(`🦴 Орто-скрининг: ${result.flags.length} флагов`);
    } catch { /* noop */ }
  };

  const copyCsv = (): void => {
    try {
      const csv = buildOrthoCsv(result);
      if (navigator.clipboard) void navigator.clipboard.writeText(csv);
      set('msg', '📋 CSV скопирован (с BOM).');
    } catch { set('msg', '⚠ Не удалось скопировать.'); }
  };

  const copyHtml = (): void => {
    try {
      const html = buildOrthoHtml(result);
      if (navigator.clipboard) void navigator.clipboard.writeText(html);
      set('msg', '🖨 HTML сводка скопирована (для печати/тренера).');
    } catch { set('msg', '⚠ Не удалось скопировать.'); }
  };

  const printHtml = (): void => {
    try {
      const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Орто-скрининг J1–J7</title></head><body>${buildOrthoHtml(result)}</body></html>`;
      const w = window.open('', '_blank', 'width=800,height=600');
      if (!w) { copyHtml(); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      set('msg', '🖨 Печать открыта (окно).');
    } catch { copyHtml(); }
  };

  const sendToPlan = (): void => {
    try {
      const payload = orthoBridgePayload(result, guards) as unknown as import('./planner-bridge').WeakpointsPayload;
      applyToPlanner({ kind: 'weakpoints', label: 'Орто-скрининг J1–J7', data: payload, source: 'intellectual' });
      set('msg', '📦 Мост отправлен в конструктор (kind weakpoints + orthoGuards).');
    } catch { set('msg', '⚠ Мост не отправлен.'); }
  };

  return (
    <div data-ortho="screen-card" style={{ padding: 12, borderRadius: 12, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>🦴 Орто-скрининг J1–J7 <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>скрининг, не диагноз · боль = стоп</span></div>
      <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.4, padding: '6px 8px', borderRadius: 6, background: result.hasUrgent ? 'rgba(244,63,94,0.12)' : result.hasDoctor ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.10)' }}>{result.summary}</div>

      {!compact && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>J1 Плечо (кластер ≥2 → к врачу)</div>
          <Check label="Боль 60–120° при подъёме (painful arc)" value={s.painfulArc} onChange={v => set('painfulArc', v)} />
          <Check label="Боль при провокации Hawkins (врач/партнёр)" value={s.hawkinsPain} onChange={v => set('hawkinsPain', v)} />
          <Check label="Слабость empty-can (Jobe)" value={s.jobeWeak} onChange={v => set('jobeWeak', v)} />
          <Check label="Рука падает с 90° (drop-arm)" value={s.dropArm} onChange={v => set('dropArm', v)} />
          <Check label="Страх вывиха (apprehension)" value={s.apprehension} onChange={v => set('apprehension', v)} />

          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>J2 ТБС (FADDIR/FABER/IROP)</div>
          <Check label="Боль в паху при глубоком приседе/сидении (FADDIR)" value={s.faddirPain} onChange={v => set('faddirPain', v)} />
          <Check label="Боль в FABER-позе" value={s.faberPain} onChange={v => set('faberPain', v)} />
          <Check label="Боль при внутренней ротации под нагрузкой (IROP)" value={s.iropPain} onChange={v => set('iropPain', v)} />
          <Check label="IR <20° или асимметрия (ROM-флаг)" value={s.romFlag} onChange={v => set('romFlag', v)} />

          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>J3 Колено + YBT + RTS</div>
          <Check label="Вальгус в single-leg squat (колено внутрь от 2-го пальца)" value={s.valgusSls} onChange={v => set('valgusSls', v)} />
          <Check label="Шатание в step-down" value={s.wobbleStepDown} onChange={v => set('wobbleStepDown', v)} />
          <label style={{ fontSize: 11, color: '#fff' }}>YBT-ANT разница |L−R|, см (флаг &gt;4):
            <input value={s.ybt} onChange={e => set('ybt', e.target.value)} inputMode="decimal" placeholder="напр. 3.5" style={{ marginLeft: 6, width: 90, padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12 }} />
          </label>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>RTS: hop-замеры, см (LSI = худшая/лучшая × 100, порог 90%)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {([['hopSL', 'Single L'], ['hopSR', 'Single R'], ['hopTL', 'Triple L'], ['hopTR', 'Triple R']] as Array<[string, string]>).map(([k, label]) => (
              <label key={k} style={{ fontSize: 11, color: '#fff' }}>{label}:
                <input value={(s as unknown as Record<string, string>)[k]} onChange={e => set(k, e.target.value)} inputMode="decimal" placeholder="см" aria-label={`Hop ${label}, см`} style={{ marginLeft: 6, width: 80, padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12 }} />
              </label>
            ))}
          </div>
          {hopLsiLive.overall != null && (
            <div style={{ fontSize: 11, color: hopLsiLive.overall >= 90 ? '#22c55e' : '#f59e0b' }}>
              LSI: single {hopLsiLive.single}% · triple {hopLsiLive.triple ?? '—'}% → итог {hopLsiLive.overall}% {hopLsiLive.overall >= 90 ? '✓' : '< 90%'} (замер бьёт чекбоксы)
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>RTS: сила, кг (квадр/хамс L/R → LSI, порог 90%)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {([['strQL', 'Квадр L'], ['strQR', 'Квадр R'], ['strHL', 'Хамс L'], ['strHR', 'Хамс R']] as Array<[string, string]>).map(([k, label]) => (
              <label key={k} style={{ fontSize: 11, color: '#fff' }}>{label}:
                <input value={(s as unknown as Record<string, string>)[k]} onChange={e => set(k, e.target.value)} inputMode="decimal" placeholder="кг" aria-label={`Сила ${label}, кг`} style={{ marginLeft: 6, width: 80, padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12 }} />
              </label>
            ))}
          </div>
          {strLsiLive.overall != null && (
            <div style={{ fontSize: 11, color: strLsiLive.overall >= 90 ? '#22c55e' : '#f59e0b' }}>
              LSI силы: квадр {strLsiLive.quad}% · хамс {strLsiLive.ham ?? '—'}% → итог {strLsiLive.overall}% {strLsiLive.overall >= 90 ? '✓' : '< 90%'} (замер бьёт чекбоксы)
            </div>
          )}
          <Check label="LSI измерено (сила + hop)" value={s.lsiMeasured} onChange={v => set('lsiMeasured', v)} />
          {s.lsiMeasured && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
              <Check label="Все LSI ≥90%" value={s.lsiPass} onChange={v => set('lsiPass', v)} />
              <label style={{ fontSize: 11, color: '#fff' }}>Месяцев после операции:
                <input value={s.months} onChange={e => set('months', e.target.value)} inputMode="numeric" placeholder="9" style={{ marginLeft: 6, width: 70, padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12 }} />
              </label>
              <label style={{ fontSize: 11, color: '#fff' }}>Трансплантат:
                <select value={s.graft} onChange={e => set('graft', e.target.value)} style={{ marginLeft: 6, padding: 6, borderRadius: 6, background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12 }}>
                  <option value="none">—</option>
                  <option value="btb">BTB (≥6 мес)</option>
                  <option value="hamstring">Hamstring (≥7 мес)</option>
                  <option value="other">Другой</option>
                </select>
              </label>
              <Check label="Страх движения (не готов психологически)" value={s.fear} onChange={v => set('fear', v)} />
              <Check label="Есть prevention-программа" value={s.prevention} onChange={v => set('prevention', v)} />
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>J4 Минимум: позвоночник / ахилл / локоть / кисть</div>
          <Check label="Боль по задней ноге при подъёме прямой <60° (SLR)" value={s.slrPain} onChange={v => set('slrPain', v)} />
          <Check label="Скованность + утренняя >30мин" value={s.stiffLong} onChange={v => set('stiffLong', v)} />
          <Check label="Хлопок в икре (Thompson-подозрение)" value={s.popSound} onChange={v => set('popSound', v)} />
          <Check label="Не могу встать на носок больной ногой" value={s.cantHeel} onChange={v => set('cantHeel', v)} />
          <Check label="Боль со стороны большого пальца (Finkelstein)" value={s.fink} onChange={v => set('fink', v)} />
          <Check label="Онемение при согнутых запястьях (Phalen)" value={s.phalen} onChange={v => set('phalen', v)} />
          <Check label="Покалывание при постукивании (Tinel)" value={s.tinel} onChange={v => set('tinel', v)} />
          <Check label="Медиальная боль в локте при броске/жиме" value={s.elbowV} onChange={v => set('elbowV', v)} />

          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>J5 Beighton (пороги ≥6/≥5/≥4)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {([['pinkyL', 'Мизинец L'], ['pinkyR', 'Мизинец R'], ['thumbL', 'Палец L'], ['thumbR', 'Палец R'], ['elbowL', 'Локоть L'], ['elbowR', 'Локоть R'], ['kneeL', 'Колено L'], ['kneeR', 'Колено R'], ['trunk', 'Наклон']] as Array<[string, string]>).map(([k, label]) => (
              <button key={k} onClick={() => set(k, !(s as unknown as Record<string, boolean>)[k])} aria-pressed={Boolean((s as unknown as Record<string, boolean>)[k])} style={{ padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: (s as unknown as Record<string, boolean>)[k] ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.12)', background: (s as unknown as Record<string, boolean>)[k] ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)', color: '#fff' }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ fontSize: 11, color: '#fff' }}>Возраст:
              <input value={s.age} onChange={e => set('age', e.target.value)} inputMode="numeric" placeholder="30" style={{ marginLeft: 6, width: 70, padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12 }} />
            </label>
            <label style={{ fontSize: 11, color: '#fff' }}>5PQ (при пограничном):
              <input value={s.pq} onChange={e => set('pq', e.target.value)} inputMode="numeric" placeholder="0–5" style={{ marginLeft: 6, width: 70, padding: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12 }} />
            </label>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Жёлтые флаги + teen</div>
          <Check label="Плохой сон" value={s.badSleep} onChange={v => set('badSleep', v)} />
          <Check label="Высокий стресс" value={s.highStress} onChange={v => set('highStress', v)} />
          <Check label="Страх движения" value={s.fearMove} onChange={v => set('fearMove', v)} />
          <Check label="Подросток 14–15 (без отказа/максимумов)" value={s.teen} onChange={v => set('teen', v)} />
        </>
      )}

      {guards.rationale.length > 0 && (
        <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4, padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.25)' }}>
          <b>Гарды в план:</b> {guards.rationale.join(' ')}
          {guards.blockedPatterns.length > 0 && <span> Блок: {guards.blockedPatterns.join(', ')}.</span>}
        </div>
      )}

      {!compact && (
        <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.4 }}>
          <b>J6 поддержка (честно):</b>
          {support.map(x => (
            <span key={x.id} style={{ display: 'inline-block', margin: '2px 4px 2px 0', padding: '2px 8px', borderRadius: 10, border: `1px solid ${evColor(x.evidence)}55`, background: `${evColor(x.evidence)}14`, fontSize: 10, color: '#fff' }} title={x.note}>{x.label} · {x.evidence}</span>
          ))}
          <span style={{ display: 'block', opacity: 0.85, marginTop: 4 }}>Коллаген 15–30г+VitC — за 30–60мин ДО; UC-II 40мг — отдельно натощак; G+C — опция (weak); BPC/TB — investigational + WADA (TB-500).</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={save} style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.15)', color: '#fff' }}>💾 В профиль + историю</button>
        <button onClick={copyCsv} style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>📋 CSV</button>
        <button onClick={copyHtml} style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>🖨 HTML</button>
        <button onClick={printHtml} style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>🖨 Печать</button>
        <button onClick={sendToPlan} style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.12)', color: '#fff' }}>📦 В конструктор</button>
      </div>
      {s.msg && <div role="status" style={{ fontSize: 10, color: '#fff' }}>{s.msg}</div>}
      <div style={{ fontSize: 9, color: '#fff', opacity: 0.8 }}>История: {loadOrthoFlags().length > 0 ? `${loadOrthoFlags().length} флагов сохранено` : 'пусто'}. Прошлый скрининг подгружается из `he_ortho_screen_v1`.</div>
    </div>
  );
};
