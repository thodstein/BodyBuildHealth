import { validateCourse } from '../engines/pharmacology.engine';
import { generatePCTPlan } from '../engines/pct-planner.engine';
import { checkDrugInteractions, getInteractionText } from '../engines/interactions-engine';
import { calculateStackLoad, renderStackAnalyzer } from './pharma-stack-analyzer';
import { SUBSTANCES_BY_CLASS } from '../core/pharma-database';
import type { CourseEntry } from '../core/types';

export function renderPharmaModule(container: HTMLElement, initialCourse: CourseEntry[] = []) {
  container.innerHTML = `
    <div class="card">
      <h3>💊 Ввод курса</h3>
      <div class="row">
        <select id="pharma-class" style="flex:1;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
          ${Object.keys(SUBSTANCES_BY_CLASS).map(c => `<option value="${c}">${c.toUpperCase()}</option>`).join('')}
        </select>
        <select id="pharma-sub" style="flex:2;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;"></select>
      </div>
      <div class="row" style="margin-top:8px;">
        <input id="pharma-dose" type="number" min="0" step="0.5" placeholder="Доза" style="flex:1;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
        <select id="pharma-unit" style="flex:1;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
          <option value="mg/wk">мг/нед</option><option value="mg/day">мг/день</option><option value="IU/wk">МЕ/нед</option><option value="IU/day">МЕ/день</option><option value="mcg/day">мкг/день</option>
        </select>
      </div>
      <div class="row" style="margin-top:8px;">
        <select id="pharma-freq" style="flex:1;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
          <option value="1x/wk">1×/нед</option><option value="2x/wk" selected>2×/нед</option><option value="3x/wk">3×/нед</option><option value="eod">Через день</option><option value="daily">Ежедневно</option>
        </select>
        <input id="pharma-start" type="number" value="0" min="0" placeholder="Старт" style="flex:1;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
        <input id="pharma-end" type="number" value="12" min="0" placeholder="Финиш" style="flex:1;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="pharma-add" class="btn" style="flex:1;">➕ Добавить</button>
        <button id="pharma-pct" class="btn" style="flex:1;background:var(--success);color:#000;">📅 Сгенерировать ПКТ</button>
        <button id="pharma-stack" class="btn" style="flex:1;background:#5856d6;color:#fff;">📊 Анализ стека</button>
      </div>
      <div id="pkpd-progress" style="margin-top:8px;display:none;">
        <div class="bar"><div id="pkpd-bar" class="fill" style="width:0%;background:var(--button);transition:width 0.2s;"></div></div>
        <div style="font-size:11px;color:#8e8e93;margin-top:2px;text-align:center;">⏳ Расчёт концентраций...</div>
      </div>
    </div>
    <div id="pharma-course-list" style="margin-top:12px;"></div>
    <div id="pharma-warnings" style="margin-top:12px;"></div>
    <div id="pharma-interactions" style="margin-top:12px;"></div>
    <div id="pharma-stack-output" style="margin-top:12px;"></div>
    <div id="pharma-pct-output" style="margin-top:12px;"></div>
    <div class="card" style="margin-top:12px;">
      <h3>📈 Концентрация & Эффект (недели)</h3>
      <canvas id="pharma-chart" width="360" height="160" style="width:100%;border-radius:8px;"></canvas>
    </div>
  `;

  const classSel = container.querySelector('#pharma-class') as HTMLSelectElement;
  const subSel = container.querySelector('#pharma-sub') as HTMLSelectElement;
  const addBtn = container.querySelector('#pharma-add') as HTMLButtonElement;
  const pctBtn = container.querySelector('#pharma-pct') as HTMLButtonElement;
  const stackBtn = container.querySelector('#pharma-stack') as HTMLButtonElement;
  const listEl = container.querySelector('#pharma-course-list')!;
  const warnEl = container.querySelector('#pharma-warnings')!;
  const intEl = container.querySelector('#pharma-interactions')!;
  const stackOutEl = container.querySelector('#pharma-stack-output')!;
  const pctOut = container.querySelector('#pharma-pct-output')!;
  const chartCanvas = container.querySelector('#pharma-chart') as HTMLCanvasElement;
  const progBar = container.querySelector('#pkpd-bar') as HTMLDivElement;
  const progCont = container.querySelector('#pkpd-progress') as HTMLDivElement;

  let course: CourseEntry[] = [...initialCourse];
  let worker: Worker | null = null;

  function renderSubstances() {
    const selected = classSel.value;
    const subs = SUBSTANCES_BY_CLASS[selected] || [];
    subSel.innerHTML = subs.map(s => `<option value="${s.id}">${s.name}${s.esters?.length ? ` (${s.esters[0]})` : ''}</option>`).join('');
  }
  classSel.onchange = renderSubstances;
  renderSubstances();

  function renderList() {
    if (!course.length) { listEl.innerHTML = '<div style="text-align:center;color:#8e8e93;padding:12px;">Курс пуст.</div>'; return; }
    listEl.innerHTML = course.map((c, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;background:#252527;padding:8px 12px;border-radius:8px;margin:6px 0;">
        <span style="font-size:13px;">${c.substanceId.replace('_', ' ')} | ${c.doseValue}${c.doseUnit} | Нед ${c.startWeek}→${c.endWeek}</span>
        <button class="btn" style="background:var(--danger);width:auto;padding:4px 8px;margin:0;font-size:12px;" data-idx="${i}">✕</button>
      </div>
    `).join('');
    listEl.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.onclick = () => { course.splice(parseInt((btn as HTMLButtonElement).dataset.idx!, 10), 1); runCalc(); };
    });
  }

  function runCalc() {
    const val = validateCourse(course);
    warnEl.innerHTML = val.warnings.length ? `<div class="cons">${val.warnings.map(w => `⚠️ ${w}`).join('<br>')}</div>` : `<div style="color:var(--success);font-size:13px;padding:4px 0;">✅ Курс валиден</div>`;
    
    const interactionResult = checkDrugInteractions(course.map(c => c.substanceId));
    intEl.innerHTML = getInteractionText(interactionResult).split('\n').map(line => `<div style="font-size:12px;padding:2px 0;">${line}</div>`).join('');

    renderList();

    if (worker) worker.terminate();
    worker = new Worker(new URL('../workers/pkpd-async.worker.ts', import.meta.url), { type: 'module' });
    progCont.style.display = 'block'; progBar.style.width = '0%';

    worker.postMessage({ type: 'CALCULATE_PKPD', id: 'calc_1', course, weeks: 24 });
    worker.onmessage = (e) => {
      if (e.data.type === 'PKPD_PROGRESS') progBar.style.width = `${e.data.progress}%`;
      if (e.data.type === 'PKPD_RESULT' && e.data.status === 'success') { progCont.style.display = 'none'; drawChart(e.data.data); }
      if (e.data.type === 'PKPD_RESULT' && e.data.status === 'cancelled') progCont.style.display = 'none';
    };
  }

  pctBtn.onclick = () => {
    const lastWeek = Math.max(...course.map(c => c.endWeek), 0);
    const plan = generatePCTPlan(course, lastWeek);
    pctOut.innerHTML = `
      <div class="card"><h3>📅 План ПКТ & Схода</h3>
      <div class="row"><span class="label">Старт ПКТ</span><span class="value">Неделя ${plan.pctStartWeek} (${plan.startDate})</span></div>
      ${plan.warnings.map(w=>`<div class="cons">${w}</div>`).join('')}
      <h4 style="margin:8px 0 4px;">Протокол</h4>
      ${plan.pctProtocol.map(p=>`<div class="row"><span class="label">${p.drug}</span><span class="value">${p.dose} (${p.durationWeeks} нед)</span></div>`).join('')}
      <h4 style="margin:8px 0 4px;">Поддержка</h4>
      ${plan.supportStack.map(s=>`<div class="row"><span class="label">${s.name}</span><span class="value">${s.dose} (${s.durationWeeks} нед)</span></div>`).join('')}
      </div>`;
  };

  stackBtn.onclick = () => {
    stackOutEl.innerHTML = '<div class="label">Загрузка анализатора...</div>';
    renderStackAnalyzer(stackOutEl, course);
  };

  addBtn.onclick = () => {
    const id = subSel.value;
    const dose = parseFloat((container.querySelector('#pharma-dose') as HTMLInputElement).value);
    const unit = (container.querySelector('#pharma-unit') as HTMLSelectElement).value as any;
    const freq = (container.querySelector('#pharma-freq') as HTMLSelectElement).value as any;
    const start = parseInt((container.querySelector('#pharma-start') as HTMLInputElement).value);
    const end = parseInt((container.querySelector('#pharma-end') as HTMLInputElement).value);
    if (!id || isNaN(dose) || dose <= 0 || end < start) return;
    course.push({ id: crypto.randomUUID(), substanceId: id, doseValue: dose, doseUnit: unit, frequency: freq, startWeek: start, endWeek: end });
    runCalc();
  };

  function drawChart(data: any[]) {
    const ctx = chartCanvas.getContext('2d')!;
    const w = chartCanvas.width, h = chartCanvas.height;
    const pad = { top: 20, right: 20, bottom: 30, left: 40 };
    const drawW = w - pad.left - pad.right, drawH = h - pad.top - pad.bottom;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#2c2c2e'; ctx.fillRect(0, 0, w, h);
    const maxCp = Math.max(...data.map(d => d.cp), 10), maxEff = Math.max(...data.map(d => d.effect), 100);
    ctx.strokeStyle = '#3a3a3c'; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) { const y = pad.top + (drawH / 5) * i; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke(); }
    ctx.fillStyle = '#8e8e93'; ctx.font = '10px sans-serif';
    for (let i = 0; i <= 24; i += 4) { const x = pad.left + (i / 24) * drawW; ctx.fillText(`${i}`, x - 6, h - 10); }
    function line(vals: number[], max: number, color: string) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); vals.forEach((v, i) => { const x = pad.left + (i / (vals.length - 1)) * drawW; const y = pad.top + drawH - (v / max) * drawH; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); ctx.stroke(); }
    line(data.map(d => d.cp), maxCp, '#ff9f0a'); line(data.map(d => d.effect), maxEff, '#30d158');
    ctx.fillStyle = '#ff9f0a'; ctx.fillRect(w - 110, 10, 10, 3); ctx.fillText('Конц. (нг/мл)', w - 96, 14);
    ctx.fillStyle = '#30d158'; ctx.fillRect(w - 110, 22, 10, 3); ctx.fillText('Эффект (%)', w - 96, 26);
  }

  runCalc();
}