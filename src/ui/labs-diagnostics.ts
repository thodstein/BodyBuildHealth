import { db } from '../core/db';
import { enqueueSync, processQueue } from '../core/sync-queue';
import { processFile } from '../core/ocr-engine';
import { generateCheckpoints } from '../engines/labs-scheduler.engine';
import { calculateDynamicPenalty } from '../engines/labs-penalty.engine';
import { filterLabsByRole, generateRoleInsights, getDynamicRef } from '../engines/role-view.engine';
import { predictLab, isAbnormal } from '../engines/labs.engine';
import { calculateIndices } from '../engines/clinical-indices.engine';
import { drawLabTrend } from './charts-labs';
import { getProfile, setRole } from '../core/profile-manager';
import { requestPushPermission } from '../core/push-manager';
import type { LabPoint, DiagnosticEntry, LabCheckpoint, UserRole, ParsedLabResult, LabPhase } from '../core/types';

export async function renderLabsDiagnostics(container: HTMLElement) {
  const ctx = getProfile();
  const currentDate = new Date();
  const totalWeeks = 12;

  const allLabs: LabPoint[] = await db.getAll('labs_log') || [];
  const allDx: DiagnosticEntry[] = await db.getAll('diagnostics_log') || [];
  if (navigator.onLine) processQueue();

  // 1. Расчёт индексов
  const indices = calculateIndices(allLabs, ctx.sex, ctx.age);
  
  // 2. Чек-поинты & Пенальти
  const checkpoints = generateCheckpoints(ctx.phase, ctx.courseStartDate, totalWeeks, ctx);
  const penalty = calculateDynamicPenalty(checkpoints, allLabs, currentDate);
  const visibleLabs = filterLabsByRole(allLabs, ctx.role);
  
  // 3. Группировка
  const groupedLabs: Record<string, LabPoint[]> = {
    'Печень/ЖКТ': visibleLabs.filter(l => ['ALT','AST','GGT','TBIL','DBIL'].includes(l.code.toUpperCase())),
    'Кровь/Гематология': visibleLabs.filter(l => ['HCT','HGB','PLT','WBC','RBC','FERRITIN'].includes(l.code.toUpperCase())),
    'Гормоны/Эндокрин': visibleLabs.filter(l => ['TT','FT3','FT4','TSH','E2','PRL','LH','FSH','IGF1','SHBG'].includes(l.code.toUpperCase())),
    'Липиды/Метаболизм': visibleLabs.filter(l => ['GLU','INS','HOMA','LDL','HDL','TG','CRP','HbA1c','CREATININE'].includes(l.code.toUpperCase()))
  };

  const penaltyColor = penalty.score >= 50 ? 'var(--danger)' : penalty.score >= 25 ? 'var(--warning)' : 'var(--success)';
  const roleInsight = generateRoleInsights(ctx.role, { risks: { overallRaw: 30, overallNet: 15, systemBreakdown: {} } as any, labs: allLabs, phase: ctx.phase });

  container.innerHTML = `
    <div class="card" style="background:${penalty.score>0?penaltyColor+'22':'transparent'};border:1px solid ${penaltyColor};">
      <div class="row"><span class="label">🛡️ Штраф за просрочку анализов</span><span class="value" style="color:${penaltyColor}">${penalty.score}%</span></div>
      <div style="font-size:12px;color:#ccc;margin-top:4px;">${penalty.action || roleInsight}</div>
      ${penalty.missingLabs.length ? `<div style="font-size:12px;margin-top:4px;">⚠️ Просрочено: ${penalty.missingLabs.join(', ')}</div>` : ''}
    </div>

    <div class="card"><h3>🩸 Клинические индексы</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
        ${[
          { l: 'HOMA-IR', v: indices.homaIR.value, s: indices.homaIR.status, a: indices.homaIR.alert },
          { l: 'FAI', v: indices.fai.value, s: indices.fai.status, a: undefined },
          { l: 'Free T', v: indices.freeTestosterone.value, u: 'ng/dL', s: indices.freeTestosterone.status, a: undefined },
          { l: 'eGFR', v: indices.egfr.value, s: indices.egfr.status, a: indices.egfr.alert },
          { l: 'De Ritis', v: indices.deritis.value, s: indices.deritis.status, a: undefined },
          { l: 'TG/HDL', v: indices.tgHdlRatio.value, s: indices.tgHdlRatio.status, a: undefined }
        ].map(idx => `
          <div style="padding:8px;background:#252527;border-radius:8px;text-align:center;border:1px solid ${idx.s==='normal'||idx.s==='optimal'?'#30d158':'#ff9f0a'};">
            <div style="font-size:10px;color:#8e8e93;">${idx.l}</div>
            <div style="font-weight:600;margin:2px 0;">${idx.v} ${idx.u||''}</div>
            <div class="badge" style="background:${idx.s==='normal'||idx.s==='optimal'?'var(--success)':'var(--warning)'}22;color:${idx.s==='normal'||idx.s==='optimal'?'var(--success)':'var(--warning)'};font-size:9px;">${idx.s.toUpperCase()}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="row" style="margin-bottom:8px;flex-wrap:wrap;gap:8px;">
        <select id="role-switcher" style="width:auto;padding:6px 10px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;">
          <option value="user" ${ctx.role==='user'?'selected':''}>👤 Пользователь</option>
          <option value="coach" ${ctx.role==='coach'?'selected':''}>🏋️ Тренер</option>
          <option value="doctor" ${ctx.role==='doctor'?'selected':''}>👨‍⚕️ Врач</option>
        </select>
        <button id="btn-push-perm" class="btn" style="width:auto;margin:0;padding:6px 10px;font-size:12px;">🔔 Уведомления</button>
      </div>
      <h3 style="margin:10px 0 6px;">📅 Таймлайн чек-поинтов</h3>
      <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;">
        ${checkpoints.map(cp => {
          const sc = cp.status === 'completed' ? 'var(--success)' : cp.status === 'overdue' ? 'var(--danger)' : 'var(--warning)';
          return `<div style="min-width:100px;padding:8px;background:#252527;border-radius:8px;border:1px solid ${sc};text-align:center;">
            <div style="font-size:11px;color:#8e8e93;">Неделя ${cp.weekOffset}</div>
            <div style="font-size:12px;font-weight:600;margin:2px 0;">${cp.type.replace('_',' ')}</div>
            <div class="badge" style="background:${sc}22;color:${sc};font-size:10px;">${cp.status.toUpperCase()}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn" style="flex:1;" id="btn-add-manual">➕ Ввести вручную</button>
        <button class="btn" style="flex:1;background:var(--success);color:#000;" id="btn-upload-file">📷 Загрузить скан/PDF</button>
      </div>
    </div>

    <div class="tabs" id="labs-subtabs">
      <div class="tab active" data-sub="labs">🩸 Лаборатория</div>
      <div class="tab" data-sub="trends">📈 Тренды</div>
      <div class="tab" data-sub="dx">🔬 Диагностика</div>
      <div class="tab" data-sub="ocr-history">📜 История OCR</div>
    </div>

    <div id="sub-labs" class="sub-page active">
      ${Object.entries(groupedLabs).map(([t,items])=>`<div class="card"><h3>${t}</h3>${items.length?items.map(l=>{const r=getDynamicRef(l.code.toUpperCase(),ctx.age,ctx.sex,ctx.phase);const abn=isAbnormal(l.code,l.value,ctx.phase);return`<div class="row"><span class="label">${l.name} (${l.date}) ${abn?'<span style="color:var(--danger)">⚠️</span>':''}</span><span class="value">${l.value} ${l.unit} <span style="font-size:9px;color:#8e8e93;">[${r.lln}–${r.uln}]</span></span></div>`;}).join(''):'<div class="label">Нет данных</div>'}</div>`).join('')}
    </div>

    <div id="sub-trends" class="sub-page" style="display:none;">
      <div class="card"><h3>📈 Динамика маркеров</h3>
        <canvas id="lab-chart" style="width:100%;height:140px;border-radius:8px;background:#2c2c2e;"></canvas>
        <div class="label" style="margin-top:4px;">Красные точки = выход за фазовый референс. Линия = линейная регрессия.</div>
      </div>
    </div>

    <div id="sub-dx" class="sub-page" style="display:none;">
      ${allDx.length?allDx.map(dx=>`<div class="card"><h3>${dx.type.toUpperCase().replace('_', ' ')} (${dx.date})</h3><pre style="font-size:12px;margin:0;">${dx.findings || 'Заключение отсутствует'}</pre></div>`).join(''):'<div class="card"><div class="label">Нет данных диагностики</div></div>'}
    </div>

    <div id="sub-ocr-history" class="sub-page" style="display:none;"><div class="card"><h3>📜 История авто-распознавания</h3><div class="label">Данные сохраняются в очередь синхронизации. При подключении сети автоматически отправляются в облако.</div></div></div>

    <!-- Модалка ввода -->
    <div id="manual-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:100;align-items:center;justify-content:center;">
      <div class="card" style="max-width:90%;width:320px;max-height:90vh;overflow-y:auto;">
        <h3>➕ Ввести анализ</h3>
        <select id="lab-code" style="width:100%;margin:8px 0;padding:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;">
          <optgroup label="Печень"><option value="ALT">АЛТ</option><option value="AST">АСТ</option><option value="GGT">ГГТ</option></optgroup>
          <optgroup label="Кровь"><option value="HCT">Гематокрит</option><option value="HGB">Гемоглобин</option><option value="PLT">Тромбоциты</option></optgroup>
          <optgroup label="Гормоны"><option value="TT">Тестостерон</option><option value="E2">Эстрадиол</option><option value="PRL">Пролактин</option></optgroup>
          <option value="CUSTOM">Свой маркер</option>
        </select>
        <input id="lab-custom-code" type="text" placeholder="Код (если CUSTOM)" style="display:none;width:100%;margin:4px 0;padding:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;">
        <div style="display:flex;gap:8px;"><input id="lab-value" type="number" step="0.01" placeholder="Значение" style="flex:2;padding:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;"><input id="lab-unit" type="text" placeholder="Ед." style="flex:1;padding:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;"></div>
        <button class="btn" id="save-manual-btn">💾 Сохранить</button><button class="btn" style="background:#8e8e93" id="cancel-manual-btn">Отмена</button>
      </div>
    </div>

    <!-- Модалка OCR -->
    <div id="upload-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:100;align-items:center;justify-content:center;">
      <div class="card" style="max-width:90%;width:360px;max-height:90vh;overflow-y:auto;">
        <h3>📷 Автопарсинг бланков</h3>
        <input id="ocr-file" type="file" accept="image/*,.pdf,.txt" style="display:none;">
        <button class="btn" style="width:auto;margin:10px auto;display:block;" onclick="document.getElementById('ocr-file').click()">📤 Выбрать файл</button>
        <div id="ocr-status" style="text-align:center;margin:10px 0;font-size:13px;color:#8e8e93;"></div>
        <div id="ocr-preview" style="margin-top:8px;"></div>
        <button id="ocr-save-btn" class="btn" style="display:none;margin-top:12px;">✅ Подтвердить</button>
        <button class="btn" style="background:#8e8e93;margin-top:8px;" id="cancel-upload-btn">Отмена</button>
      </div>
    </div>
  `;

  let parsedResults: ParsedLabResult[] = [];

  // Табы
  container.querySelectorAll('#labs-subtabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('#labs-subtabs .tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.sub-page').forEach(p => (p as HTMLElement).style.display = 'none');
      tab.classList.add('active');
      (container.querySelector(`#sub-${(tab as HTMLElement).dataset.sub}`) as HTMLElement)!.style.display = 'block';
      if ((tab as HTMLElement).dataset.sub === 'trends') renderTrends();
    });
  });

  // Тренды
  function renderTrends() {
    const canvas = container.querySelector('#lab-chart') as HTMLCanvasElement;
    if (!canvas) return;
    const markers = ['ALT', 'HCT', 'TT', 'E2', 'LDL'];
    const data = markers.map(code => {
      const pts = allLabs.filter(l => l.code.toUpperCase() === code.toUpperCase()).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return pts.map((p, i) => ({ week: i, value: p.value, isAbnormal: isAbnormal(code, p.value, ctx.phase) }));
    }).flat();
    drawLabTrend(canvas, data.length ? data : [{week:0,value:0},{week:1,value:0}], 100, 10, 'ед.', 'Сводный тренд');
  }

  // Роли & Push
  (container.querySelector('#role-switcher') as HTMLSelectElement)!.addEventListener('change', (e) => { setRole((e.target as HTMLSelectElement).value as UserRole); renderLabsDiagnostics(container); });
  (container.querySelector('#btn-push-perm') as HTMLElement)!.addEventListener('click', async () => { const ok = await requestPushPermission(); alert(ok ? '✅ Уведомления включены' : '❌ Разрешение отклонено'); });

  // Ручной ввод
  const manualModal = container.querySelector('#manual-modal') as HTMLElement;
  if (!manualModal) return;
  (container.querySelector('#btn-add-manual') as HTMLElement)?.addEventListener('click', () => manualModal.style.display = 'flex');
  (container.querySelector('#cancel-manual-btn') as HTMLElement)?.addEventListener('click', () => manualModal.style.display = 'none');
  (container.querySelector('#lab-code') as HTMLSelectElement)?.addEventListener('change', (e) => { const customInput = container.querySelector('#lab-custom-code') as HTMLInputElement; if (customInput) customInput.style.display = (e.target as HTMLSelectElement).value === 'CUSTOM' ? 'block' : 'none'; });
  (container.querySelector('#save-manual-btn') as HTMLElement)?.addEventListener('click', async () => {
    const codeSelect = container.querySelector('#lab-code') as HTMLSelectElement;
    const customCodeInput = container.querySelector('#lab-custom-code') as HTMLInputElement;
    const valueInput = container.querySelector('#lab-value') as HTMLInputElement;
    const unitInput = container.querySelector('#lab-unit') as HTMLInputElement;
    if (!codeSelect || !valueInput || !unitInput) return;
    const code = codeSelect.value === 'CUSTOM' && customCodeInput ? customCodeInput.value.trim().toUpperCase() || 'CUSTOM' : codeSelect.value.toUpperCase();
    const val = parseFloat(valueInput.value);
    const unit = unitInput.value.trim() || 'ед.';
    if (isNaN(val) || val <= 0) return alert('⚠️ Введите значение > 0');
    const entry: LabPoint = { id: crypto.randomUUID(), code, name: code, value: val, unit, date: new Date().toISOString().slice(0,10), phase: ctx.phase as LabPhase };
    await db.put('labs_log', entry);
    await enqueueSync('labs', entry);
    manualModal.style.display = 'none'; renderLabsDiagnostics(container);
  });

  // OCR
  const uploadModal = container.querySelector('#upload-modal') as HTMLElement;
  if (!uploadModal) return;
  (container.querySelector('#btn-upload-file') as HTMLElement)?.addEventListener('click', () => uploadModal.style.display = 'flex');
  (container.querySelector('#cancel-upload-btn') as HTMLElement)?.addEventListener('click', () => uploadModal.style.display = 'none');
  const ocrFile = container.querySelector('#ocr-file') as HTMLInputElement;
  const ocrStatus = container.querySelector('#ocr-status') as HTMLElement;
  const ocrPreview = container.querySelector('#ocr-preview') as HTMLElement;
  const ocrSaveBtn = container.querySelector('#ocr-save-btn') as HTMLButtonElement;
  if (!ocrFile || !ocrStatus || !ocrPreview || !ocrSaveBtn) return;

  ocrFile.addEventListener('change', async () => {
    if (!ocrFile.files?.length) return;
    ocrStatus.textContent = '⏳ Распознавание...'; ocrPreview.innerHTML = ''; ocrSaveBtn.style.display = 'none'; parsedResults = [];
    try {
      const { text, labs, meals } = await processFile(ocrFile.files[0]);
      parsedResults = labs; 
      ocrSaveBtn.textContent = `✅ Подтвердить (${labs.length} лаб, ${meals.length} приёмов)`;
      if (!labs.length && !meals.length) { ocrStatus.innerHTML = '<div class="cons">⚠️ Данные не распознаны.</div>'; return; }
      ocrPreview.innerHTML = `
        <h4>🩸 Лаборатория (${labs.length})</h4>
        ${labs.map(p => `<div class="row"><span class="label"><b>${p.marker}</b></span><span class="value">${p.value} ${p.unit}</span></div>`).join('')}
        ${meals.length ? `<h4 style="margin-top:8px;">🥗 Питание (${meals.length})</h4>${meals.map(m => `<div style="font-size:12px;color:#8e8e93;">${m.mealType}: ${m.items.length} блюд</div>`).join('')}` : ''}
      `;
      ocrSaveBtn.style.display = 'block'; ocrStatus.textContent = '✅ Готово';
    } catch { ocrStatus.innerHTML = '<div class="cons">❌ Ошибка</div>'; }
  });

  ocrSaveBtn.addEventListener('click', async () => {
    if (!parsedResults.length) return;
    ocrStatus.textContent = '💾 Сохранение...';
    const entries: LabPoint[] = parsedResults.map(p => ({ id: crypto.randomUUID(), code: p.marker, name: p.marker, value: p.value, unit: p.unit, date: new Date().toISOString().slice(0,10), phase: ctx.phase as LabPhase }));
    for (const e of entries) await db.put('labs_log', e);
    for (const e of entries) await enqueueSync('labs', e);
    uploadModal.style.display = 'none'; renderLabsDiagnostics(container);
  });
}