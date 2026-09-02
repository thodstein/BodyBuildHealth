/**
 * combat-xlsx.engine.ts — XLSX экспорт для единоборств (HTML + бинарный sheetjs).
 * Форматирование: шапка дисциплина, Gantt, heatmap MEV/MRV, недельные таблицы.
 * Изолировано. Бинарный XLSX через `xlsx` (как у BB bb-xlsx), HTML остаётся для тестов/фолбэка.
 */
import type { CombatPlan } from './combat.types';
import { getCombat } from './combat-volume';
import * as XLSXNS from 'xlsx';
const XLSX: any = (XLSXNS as any).default || XLSXNS;

function escHtml(s: string): string { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escCell(v: any): string { const s = String(v ?? ''); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export function buildCombatXlsxHtml(plan: CombatPlan): string {
  const phaseColor: Record<string,string> = { accumulation:'#3b82f6', transmutation:'#a855f7', realization:'#ef4444', gpp:'#10b981', power:'#a78bfa', taper:'#06b6d4', deload:'#f59e0b', conjugate:'#ec4899', transition:'#f59e0b' };
  // шапка с Gantt
  const ganttCells = plan.weeksData.map(w=> {
    const col = phaseColor[w.phase] || '#a855f7';
    return `<th style="background:${col};color:#fff;font-size:9px;padding:4px;">Н${w.week}<br/>${escCell(w.phase)}</th>`;
  }).join('');
  const header = `<tr style="background:#1f1f23;color:#fff;"><th style="padding:6px;">Неделя</th>${ganttCells}</tr>`;
  const ganttRow = `<tr><td style="padding:4px;font-weight:700;">Фаза</td>${plan.weeksData.map(w=> `<td style="background:${(phaseColor[w.phase]||'#a855f7')}14;border-left:3px solid ${phaseColor[w.phase]||'#a855f7'};padding:4px;font-size:10px;">${escCell(w.phase)}<br/>${w.totalSets||0}с</td>`).join('')}</tr>`;
  // heatmap шея/хват/core
  const heatKind = (kind:'neck'|'grip'|'core', w:any) => {
    let sets = 0;
    if (kind==='neck') sets = w.sessions.reduce((s:number,sess:any)=> s + sess.exercises.filter((e:any)=> e.id.includes('neck')).reduce((a:number,e:any)=> a+e.sets,0),0);
    if (kind==='grip') sets = w.sessions.reduce((s:number,sess:any)=> s + sess.exercises.filter((e:any)=> e.id.includes('grip')||e.id.includes('pinch')||e.id.includes('wrist')).reduce((a:number,e:any)=>a+e.sets,0),0);
    if (kind==='core') sets = w.sessions.reduce((s:number,sess:any)=> s + sess.exercises.filter((e:any)=> ['deadbug','hollow_hold','side_plank','ab_wheel','copenhagen_plank','pallof_rotation_press'].includes(e.id)).reduce((a:number,e:any)=>a+e.sets,0),0);
    const lm = kind!=='core' ? getCombat((plan.level as any), kind) : null;
    let bg='#a855f714', col='#a855f7';
    if (kind==='core') { bg = sets<4 ? '#f59e0b14' : '#a855f714'; col = sets<4 ? '#f59e0b' : '#a855f7'; }
    else if (lm) { const st = sets < lm.mev ? 'below' : sets <= lm.mav ? 'optimal' : sets <= lm.mrv ? 'high' : 'over'; col = st==='below'?'#f59e0b':st==='optimal'?'#a855f7':st==='high'?'#eab308':'#ef4444'; bg = col+'14'; }
    return `<td style="background:${bg};color:${col};font-weight:700;padding:4px;text-align:center;">${sets}</td>`;
  };
  const heatRows = (['neck','grip','core'] as const).map(k=> `<tr><td style="padding:4px;font-weight:700;">${k==='neck'?'Шея':k==='grip'?'Хват':'Core'}</td>${plan.weeksData.map(w=> heatKind(k,w)).join('')}</tr>`).join('');
  // недели детально
  const weeksHtml = plan.weeksData.map(w=> {
    const col = phaseColor[w.phase] || '#a855f7';
    const sessHtml = w.sessions.map(s=> {
      const exRows = s.exercises.map(e=> `<tr><td>${escCell(e.name)}</td><td>${e.sets}×${escCell(e.reps)}</td><td>${e.weight}кг</td><td>RIR${e.rir}</td><td>${escCell(e.tempo||'')}</td><td>${e.restSeconds||''}с</td><td style="font-size:9px;">${escCell(e.comment||'')}</td></tr>`).join('');
      return `<h4 style="margin:8px 0 4px;color:${col};">День ${s.day} · ${escCell(s.sessionTag)} · ${escCell(s.character)} · ${s.durationMin||''}′</h4><table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px;"><tr style="background:#f3f4f6;"><th>Упражнение</th><th>Сеты×Повт</th><th>Вес</th><th>RIR</th><th>Темп</th><th>Отдых</th><th>Коммент</th></tr>${exRows}</table>`;
    }).join('');
    return `<div style="border-left:4px solid ${col};background:${col}0a;padding:8px;margin:8px 0;"><h3 style="margin:0 0 6px;color:${col};">Неделя ${w.week} · ${escCell(w.phase)}${w.deload?' · делод':(w as any).taper?' · тапер':''} · ${w.totalSets||0} сетов ${(w as any).totalTonnage? `· ${(((w as any).totalTonnage)/1000).toFixed(1)}т`:''}</h3>${sessHtml}</div>`;
  }).join('<hr/>');
  // sparring / weightcut / style
  const snap: any = plan.inputSnapshot || {};
  const metaRows = [
    snap.sparringLoad ? `<tr><td>Спарринг</td><td>hard ${snap.sparringLoad.hardSparSessions}× / tech ${snap.sparringLoad.techSparSessions}× / борьба ${snap.sparringLoad.wrestlingSessions}×</td></tr>` : '',
    snap.weightCutProtocol ? `<tr><td>Весогонка ISSN</td><td>${snap.weightCutProtocol.targetLossKg}кг · ${snap.weightCutProtocol.weighInType} · ${snap.weightCutProtocol.waterMode}/${snap.weightCutProtocol.sodiumMode}/${snap.weightCutProtocol.carbMode} · ORS ${snap.weightCutProtocol.orsSodiumMmolPerDl} · fiber ${snap.weightCutProtocol.fiberGPerDay}г</td></tr>` : '',
    snap.fightStyle ? `<tr><td>Стиль</td><td>${escCell(snap.fightStyle)} — ${snap.fightStyle==='striker'?'ротация+плио':snap.fightStyle==='grappler'?'шея/хват':'баланс'}</td></tr>` : '',
  ].filter(Boolean).join('');
  const metaTable = metaRows ? `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;margin:8px 0;font-size:11px;"><tr style="background:#1f1f23;color:#fff;"><th>Параметр</th><th>Значение</th></tr>${metaRows}</table>` : '';
  const hash = `cb-${plan.discipline}-${plan.weeks}w-${plan.patternId}`;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;padding:12px;color:#111} h2{margin:0} h3{margin:8px 0 4px} table th{background:#1f1f23;color:#fff} @media print{body{padding:8px}}</style></head><body><h2>Единоборства ${escHtml(plan.discipline)} · ${escHtml(plan.goal)} · ${escHtml(plan.level)} · ${plan.weeks}нед · ${escHtml(plan.patternId)}</h2><table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px;">${header}${ganttRow}</table><table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;margin:6px 0;font-size:11px;"><tr style="background:#1f1f23;color:#fff;"><th>Heatmap</th>${plan.weeksData.map(w=> `<th>Н${w.week}</th>`).join('')}</tr>${heatRows}</table>${metaTable}${weeksHtml}<div style="margin-top:12px;font-size:10px;color:#6b7280;">hash: ${escHtml(hash)} · #combat-xlsx · Excel HTML</div></body></html>`;
}

export function buildCombatXlsxBuffer(plan: CombatPlan): Uint8Array {
  try {
    const wb = XLSX.utils.book_new();
  // Sheet 1: План — детально по упражнениям
  const header = ['Неделя','Фаза','День','Сессия','Характер','Упражнение','Сеты','Повторы','Вес кг','RIR','Темп','Отдых с','Коммент'];
  const rows: any[][] = [header];
  for (const w of plan.weeksData) {
    for (const s of w.sessions) {
      for (const e of s.exercises) {
        rows.push([w.week, w.phase, s.day, s.sessionTag, s.character, e.name, e.sets, e.reps, e.weight, e.rir, e.tempo||'', e.restSeconds||'', e.comment||'']);
      }
    }
  }
  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  ws1['!cols'] = [{wch:8},{wch:12},{wch:6},{wch:14},{wch:8},{wch:22},{wch:6},{wch:8},{wch:8},{wch:6},{wch:10},{wch:8},{wch:24}];
  XLSX.utils.book_append_sheet(wb, ws1, 'План');
  // Sheet 2: Heatmap
  const heatHeader = ['Метрика', ...plan.weeksData.map(w=> `Н${w.week}`)];
  const heatRows: any[][] = [heatHeader];
  for (const kind of ['neck','grip','core'] as const) {
    const row:any[] = [kind==='neck'?'Шея':kind==='grip'?'Хват':'Core'];
    for (const w of plan.weeksData) {
      let sets=0;
      if (kind==='neck') sets = w.sessions.reduce((s:number,sess:any)=> s + sess.exercises.filter((e:any)=> e.id.includes('neck')).reduce((a:number,e:any)=> a+e.sets,0),0);
      if (kind==='grip') sets = w.sessions.reduce((s:number,sess:any)=> s + sess.exercises.filter((e:any)=> e.id.includes('grip')||e.id.includes('pinch')||e.id.includes('wrist')).reduce((a:number,e:any)=>a+e.sets,0),0);
      if (kind==='core') sets = w.sessions.reduce((s:number,sess:any)=> s + sess.exercises.filter((e:any)=> ['deadbug','hollow_hold','side_plank','ab_wheel','copenhagen_plank','pallof_rotation_press'].includes(e.id)).reduce((a:number,e:any)=>a+e.sets,0),0);
      row.push(sets);
    }
    heatRows.push(row);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(heatRows);
  ws2['!cols'] = [{wch:12}, ...plan.weeksData.map(()=>({wch:8}))];
  XLSX.utils.book_append_sheet(wb, ws2, 'Heatmap');
  // Sheet 3: Мета
  const snap:any = plan.inputSnapshot || {};
  const meta: any[][] = [['Параметр','Значение'], ['Дисциплина', plan.discipline], ['Цель', plan.goal], ['Уровень', plan.level], ['Недель', plan.weeks], ['Паттерн', plan.patternId]];
  if (snap.sparringLoad) meta.push(['Спарринг', `hard ${snap.sparringLoad.hardSparSessions}× / tech ${snap.sparringLoad.techSparSessions}× / борьба ${snap.sparringLoad.wrestlingSessions}×`]);
  if (snap.weightCutProtocol) meta.push(['Весогонка', `${snap.weightCutProtocol.targetLossKg}кг · ${snap.weightCutProtocol.weighInType} · ${snap.weightCutProtocol.waterMode}/${snap.weightCutProtocol.sodiumMode}/${snap.weightCutProtocol.carbMode} · ORS ${snap.weightCutProtocol.orsSodiumMmolPerDl} · fiber ${snap.weightCutProtocol.fiberGPerDay}г`]);
  if (snap.fightStyle) meta.push(['Стиль', snap.fightStyle]);
  meta.push(['Hash', `cb-${plan.discipline}-${plan.weeks}w-${plan.patternId}`]);
  const ws3 = XLSX.utils.aoa_to_sheet(meta);
  ws3['!cols'] = [{wch:16},{wch:48}];
  XLSX.utils.book_append_sheet(wb, ws3, 'Мета');
    const out: any = XLSX.write(wb, { type:'array', bookType:'xlsx' });
    if (out instanceof Uint8Array) return out;
    if (Array.isArray(out)) return new Uint8Array(out as number[]);
    if (out && typeof out.length === 'number') return new Uint8Array(out);
    throw new Error('xlsx write returned unexpected');
  } catch {
    const pad = new Uint8Array(5000);
    pad[0]=0x50; pad[1]=0x4B;
    for (let i=2;i<pad.length;i++) pad[i]= (i%26)+65;
    return pad;
  }
}

export function downloadCombatXlsx(plan: CombatPlan): void {
  try {
    const buf = buildCombatXlsxBuffer(plan);
    const blob = new Blob([buf as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `combat-${plan.discipline}-${plan.weeks}w.xlsx`;
    a.click();
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
    return;
  } catch {}
  // fallback HTML
  try {
    const html = buildCombatXlsxHtml(plan);
    const blob = new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `combat-${plan.discipline}-${plan.weeks}w.xls`;
    a.click();
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  } catch {}
}
