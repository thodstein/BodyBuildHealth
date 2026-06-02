import { validateCourse } from '../engines/pharmacology.engine';
import { generatePCTPlan } from '../engines/pct-planner.engine';
import { checkDrugInteractions } from '../engines/pharma-interactions.engine';
import { renderStackAnalyzer } from './pharma-stack-analyzer';
import { SUBSTANCES_BY_CLASS } from '../core/pharma-database';
import type { CourseEntry } from '../core/types';

function interactionsToText(alerts: ReturnType<typeof checkDrugInteractions>): string {
  if (!alerts.length) return 'No critical interactions detected.';
  return alerts
    .map((a) => `[${a.type.toUpperCase()}] ${a.drugs.join(' + ')}: ${a.mechanism} | ${a.recommendation}`)
    .join('\n');
}

export function renderPharmaModule(container: HTMLElement, initialCourse: CourseEntry[] = []) {
  container.innerHTML = `
    <div class="card">
      <h3>Pharma Course Calculator</h3>
      <div class="row">
        <select id="pharma-class" style="flex:1;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
          ${Object.keys(SUBSTANCES_BY_CLASS).map((c) => `<option value="${c}">${c.toUpperCase()}</option>`).join('')}
        </select>
        <select id="pharma-sub" style="flex:2;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;"></select>
      </div>
      <div class="row" style="margin-top:8px;">
        <input id="pharma-dose" type="number" min="0" step="0.5" placeholder="Dose" style="flex:1;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
        <select id="pharma-unit" style="flex:1;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
          <option value="mg/wk">mg/week</option><option value="mg/day">mg/day</option><option value="IU/wk">IU/week</option><option value="IU/day">IU/day</option><option value="mcg/day">mcg/day</option>
        </select>
      </div>
      <div class="row" style="margin-top:8px;">
        <select id="pharma-freq" style="flex:1;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
          <option value="1x/wk">1x/week</option><option value="2x/wk" selected>2x/week</option><option value="3x/wk">3x/week</option><option value="eod">EOD</option><option value="daily">Daily</option>
        </select>
        <input id="pharma-start" type="number" value="0" min="0" placeholder="Start week" style="flex:1;margin-right:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
        <input id="pharma-end" type="number" value="12" min="0" placeholder="End week" style="flex:1;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;padding:8px;">
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="pharma-add" class="btn" style="flex:1;">Add</button>
        <button id="pharma-pct" class="btn" style="flex:1;background:var(--success);color:#000;">Build PCT</button>
        <button id="pharma-stack" class="btn" style="flex:1;background:#5856d6;color:#fff;">Analyze Stack</button>
      </div>
      <div id="pkpd-progress" style="margin-top:8px;display:none;">
        <div class="bar"><div id="pkpd-bar" class="fill" style="width:0%;background:var(--button);transition:width 0.2s;"></div></div>
        <div style="font-size:11px;color:#8e8e93;margin-top:2px;text-align:center;">Calculating PK/PD...</div>
      </div>
    </div>
    <div id="pharma-course-list" style="margin-top:12px;"></div>
    <div id="pharma-warnings" style="margin-top:12px;"></div>
    <div id="pharma-interactions" style="margin-top:12px;"></div>
    <div id="pharma-stack-output" style="margin-top:12px;"></div>
    <div id="pharma-pct-output" style="margin-top:12px;"></div>
    <div class="card" style="margin-top:12px;">
      <h3>Concentration & Effect</h3>
      <canvas id="pharma-chart" width="360" height="160" style="width:100%;border-radius:8px;"></canvas>
    </div>
  `;

  const classSel = container.querySelector('#pharma-class') as HTMLSelectElement;
  const subSel = container.querySelector('#pharma-sub') as HTMLSelectElement;
  const addBtn = container.querySelector('#pharma-add') as HTMLButtonElement;
  const pctBtn = container.querySelector('#pharma-pct') as HTMLButtonElement;
  const stackBtn = container.querySelector('#pharma-stack') as HTMLButtonElement;
  const listEl = container.querySelector('#pharma-course-list') as HTMLElement;
  const warnEl = container.querySelector('#pharma-warnings') as HTMLElement;
  const intEl = container.querySelector('#pharma-interactions') as HTMLElement;
  const stackOutEl = container.querySelector('#pharma-stack-output') as HTMLElement;
  const pctOut = container.querySelector('#pharma-pct-output') as HTMLElement;
  const chartCanvas = container.querySelector('#pharma-chart') as HTMLCanvasElement;
  const progBar = container.querySelector('#pkpd-bar') as HTMLDivElement;
  const progCont = container.querySelector('#pkpd-progress') as HTMLDivElement;

  let course: CourseEntry[] = [...initialCourse];
  let worker: Worker | null = null;

  function renderSubstances() {
    const selected = classSel.value;
    const subs = SUBSTANCES_BY_CLASS[selected] || [];
    subSel.innerHTML = subs.map((s) => `<option value="${s.id}">${s.name}${s.esters?.length ? ` (${s.esters[0]})` : ''}</option>`).join('');
  }
  classSel.onchange = renderSubstances;
  renderSubstances();

  function renderList() {
    if (!course.length) {
      listEl.innerHTML = '<div style="text-align:center;color:#8e8e93;padding:12px;">Course is empty.</div>';
      return;
    }
    listEl.innerHTML = course.map((c, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;background:#252527;padding:8px 12px;border-radius:8px;margin:6px 0;">
        <span style="font-size:13px;">${c.substanceId.replace('_', ' ')} | ${c.doseValue}${c.doseUnit} | week ${c.startWeek} -> ${c.endWeek}</span>
        <button class="btn" style="background:var(--danger);width:auto;padding:4px 8px;margin:0;font-size:12px;" data-idx="${i}">x</button>
      </div>
    `).join('');
    listEl.querySelectorAll('button[data-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number((btn as HTMLButtonElement).dataset.idx);
        course.splice(idx, 1);
        runCalc();
      });
    });
  }

  function runCalc() {
    const val = validateCourse(course);
    warnEl.innerHTML = val.warnings.length
      ? `<div class="cons">${val.warnings.map((w) => `Warning: ${w}`).join('<br>')}</div>`
      : '<div style="color:var(--success);font-size:13px;padding:4px 0;">Course valid</div>';

    const interactionResult = checkDrugInteractions(course);
    intEl.innerHTML = interactionsToText(interactionResult)
      .split('\n')
      .map((line) => `<div style="font-size:12px;padding:2px 0;">${line}</div>`)
      .join('');

    renderList();

    if (worker) worker.terminate();
    worker = new Worker(new URL('../workers/pkpd-async.worker.ts', import.meta.url), { type: 'module' });
    progCont.style.display = 'block';
    progBar.style.width = '0%';

    worker.postMessage({ type: 'CALCULATE_PKPD', id: 'calc_1', course, weeks: 24 });
    worker.onmessage = (e) => {
      if (e.data.type === 'PKPD_PROGRESS') progBar.style.width = `${e.data.progress}%`;
      if (e.data.type === 'PKPD_RESULT' && e.data.status === 'success') {
        progCont.style.display = 'none';
        drawChart(e.data.data);
      }
      if (e.data.type === 'PKPD_RESULT' && e.data.status === 'cancelled') {
        progCont.style.display = 'none';
      }
    };
  }

  pctBtn.onclick = () => {
    const lastWeek = Math.max(...course.map((c) => c.endWeek), 0);
    const plan = generatePCTPlan(course, lastWeek);
    pctOut.innerHTML = `
      <div class="card"><h3>PCT Plan</h3>
      <div class="row"><span class="label">PCT start</span><span class="value">Week ${plan.pctStartWeek} (${plan.startDate})</span></div>
      ${plan.warnings.map((w) => `<div class="cons">${w}</div>`).join('')}
      <h4 style="margin:8px 0 4px;">Protocol</h4>
      ${plan.pctProtocol.map((p) => `<div class="row"><span class="label">${p.drug}</span><span class="value">${p.dose} (${p.durationWeeks} w)</span></div>`).join('')}
      <h4 style="margin:8px 0 4px;">Support</h4>
      ${plan.supportStack.map((s) => `<div class="row"><span class="label">${s.name}</span><span class="value">${s.dose} (${s.durationWeeks} w)</span></div>`).join('')}
      </div>`;
  };

  stackBtn.onclick = () => {
    stackOutEl.innerHTML = '<div class="label">Loading stack analyzer...</div>';
    renderStackAnalyzer(stackOutEl, course);
  };

  addBtn.onclick = () => {
    const id = subSel.value;
    const dose = parseFloat((container.querySelector('#pharma-dose') as HTMLInputElement).value);
    const unit = (container.querySelector('#pharma-unit') as HTMLSelectElement).value as CourseEntry['doseUnit'];
    const freq = (container.querySelector('#pharma-freq') as HTMLSelectElement).value as CourseEntry['frequency'];
    const start = parseInt((container.querySelector('#pharma-start') as HTMLInputElement).value, 10);
    const end = parseInt((container.querySelector('#pharma-end') as HTMLInputElement).value, 10);
    if (!id || Number.isNaN(dose) || dose <= 0 || end < start) return;
    course.push({
      id: crypto.randomUUID(),
      substanceId: id,
      doseValue: dose,
      doseUnit: unit,
      frequency: freq,
      startWeek: start,
      endWeek: end
    });
    runCalc();
  };

  function drawChart(data: Array<{ cp: number; effect: number }>) {
    const ctx = chartCanvas.getContext('2d');
    if (!ctx || data.length === 0) return;

    const w = chartCanvas.width;
    const h = chartCanvas.height;
    const pad = { top: 20, right: 20, bottom: 30, left: 40 };
    const drawW = w - pad.left - pad.right;
    const drawH = h - pad.top - pad.bottom;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#2c2c2e';
    ctx.fillRect(0, 0, w, h);

    const maxCp = Math.max(...data.map((d) => d.cp), 10);
    const maxEff = Math.max(...data.map((d) => d.effect), 100);

    const line = (vals: number[], max: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      vals.forEach((v, i) => {
        const x = pad.left + (i / Math.max(1, vals.length - 1)) * drawW;
        const y = pad.top + drawH - (v / max) * drawH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    line(data.map((d) => d.cp), maxCp, '#ff9f0a');
    line(data.map((d) => d.effect), maxEff, '#30d158');
  }

  runCalc();
}

