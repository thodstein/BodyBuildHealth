import { db } from '../core/db';
import { calculateLabPenalty, generatePhaseSchedule } from '../engines/labs-penalty.engine';
import { validateDiagnostics } from '../engines/diagnostics.engine';
import type { LabPoint, DiagnosticEntry, LabPhase, PenaltyResult } from '../core/types';

export async function renderLabsDiagnostics() {
  const container = document.getElementById('labs-container')!;
  
  // Загрузка данных
  const labs: LabPoint[] = await db.getAll('labs_log') || [];
  const diagnostics: DiagnosticEntry[] = validateDiagnostics(await db.getAll('diagnostics_log') || []);
  
  // Демо-фаза (в реальном приложении берётся из профиля/курса)
  const currentPhase: LabPhase = 'on_cycle';
  const phaseStart = '2024-01-15';
  const phaseDuration = 10; // недель
  
  const penalty: PenaltyResult = calculateLabPenalty(currentPhase, phaseDuration, labs, diagnostics);
  const schedule = generatePhaseSchedule(currentPhase, phaseStart, phaseDuration);
  
  // Группировка лаб
  const groupedLabs: Record<string, LabPoint[]> = {
    'Печень': labs.filter(l=>['ALT','AST','GGT','BIL'].includes(l.code.toUpperCase())),
    'Кровь/Гематология': labs.filter(l=>['HCT','HGB','PLT','WBC','FERRITIN'].includes(l.code.toUpperCase())),
    'Гормоны': labs.filter(l=>['TT','FT3','FT4','TSH','E2','PRL','LH','FSH','IGF1'].includes(l.code.toUpperCase())),
    'Метаболизм/Липиды': labs.filter(l=>['GLU','INS','HOMA','LDL','HDL','TG','CRP','HbA1c'].includes(l.code.toUpperCase()))
  };

  const penaltyColor = penalty.score >= 50 ? 'var(--danger)' : penalty.score >= 25 ? 'var(--warning)' : 'var(--success)';
  const penaltyBg = penalty.score >= 50 ? '#2a1b1b' : penalty.score >= 25 ? '#2a221b' : '#1b221b';

  container.innerHTML = `
    <div class="card" style="background:${penaltyBg};border:1px solid ${penaltyColor};">
      <div class="row"><span class="label">🛡️ Штраф за отсутствие анализов</span><span class="value" style="color:${penaltyColor}">${penalty.score}%</span></div>
      <div style="font-size:12px;color:#ccc;margin-top:4px;">${penalty.action || '✅ Анализы сданы вовремя'}</div>
      ${penalty.missingLabs.length ? `<div style="font-size:12px;margin-top:4px;">⚠️ Не сдано: ${penalty.missingLabs.join(', ')}</div>` : ''}
    </div>

    <div class="card">
      <h3>📅 Фаза: <span class="badge" style="background:var(--tab-active)">${currentPhase.toUpperCase()}</span></h3>
      <div class="row"><span class="label">Следующий чек-ап до</span><span class="value">${schedule.dueDate}</span></div>
      <div class="row"><span class="label">Обязательные лабы</span><span class="value">${schedule.nextLabs.length}</span></div>
      <button class="btn" style="margin-top:8px;font-size:13px;" onclick="document.getElementById('add-lab-modal').style.display='flex'">➕ Добавить результат</button>
    </div>

    <div class="tabs" style="margin:10px 0;">
      <div class="tab active" data-sub="labs">🩸 Лаборатория</div>
      <div class="tab" data-sub="dx">🔬 Диагностика</div>
      <div class="tab" data-sub="schedule">📋 Расписание</div>
    </div>

    <div id="sub-labs" class="sub-page active">
      ${Object.entries(groupedLabs).map(([title, items])=>`
        <div class="card"><h3>${title}</h3>
          ${items.length ? items.map(l=>`<div class="row"><span class="label">${l.name} (${l.date})</span><span class="value">${l.value} ${l.unit}</span></div>`).join('') : '<div class="label">Нет данных</div>'}
        </div>
      `).join('')}
    </div>

    <div id="sub-dx" class="sub-page">
      <div class="card"><h3>🫀 ЭхоКГ</h3><div class="label">Нет данных или требуется обновление</div></div>
      <div class="card"><h3>🦴 УЗИ суставов</h3><div class="label">Нет данных</div></div>
      <div class="card"><h3>📊 DEXA / Состав тела</h3><div class="label">Нет данных</div></div>
    </div>

    <div id="sub-schedule" class="sub-page">
      <div class="card"><h3>📋 Обязательный протокол</h3>
        ${schedule.nextLabs.map(c=>`<div class="row"><span class="label">${c}</span><span class="value">до ${schedule.dueDate}</span></div>`).join('')}
      </div>
    </div>

    <!-- Модалка добавления лабы -->
    <div id="add-lab-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:50;align-items:center;justify-content:center;">
      <div class="card" style="max-width:90%;width:320px;">
        <h3>➕ Добавить анализ</h3>
        <select id="lab-code" style="width:100%;margin:8px 0;padding:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;">
          <option value="ALT">АЛТ</option><option value="AST">АСТ</option><option value="TT">Тестостерон общий</option>
          <option value="E2">Эстрадиол</option><option value="HCT">Гематокрит</option><option value="CUSTOM">Свой маркер</option>
        </select>
        <input id="lab-value" type="number" placeholder="Значение" style="width:100%;margin:4px 0;padding:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;">
        <input id="lab-unit" type="text" placeholder="Ед. (U/L, ng/dL...)" style="width:100%;margin:4px 0;padding:8px;background:#252527;color:#fff;border:1px solid #3a3a3c;border-radius:8px;">
        <button class="btn" id="save-lab-btn">💾 Сохранить</button>
        <button class="btn" style="background:#8e8e93" onclick="document.getElementById('add-lab-modal').style.display='none'">Отмена</button>
      </div>
    </div>
  `;

  // Табы
  container.querySelectorAll('.tab').forEach(tab=>{
    tab.onclick=()=>{
      container.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      container.querySelectorAll('.sub-page').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      container.getElementById(`sub-${tab.dataset.sub}`)?.classList.add('active');
    };
  });

  // Сохранение лабы
  document.getElementById('save-lab-btn')!.onclick = async () => {
    const code = (document.getElementById('lab-code') as HTMLSelectElement).value;
    const value = parseFloat((document.getElementById('lab-value') as HTMLInputElement).value) || 0;
    const unit = (document.getElementById('lab-unit') as HTMLInputElement).value || 'ед.';
    const entry: LabPoint = {
      id: crypto.randomUUID(), code, name: code, value, unit, date: new Date().toISOString().slice(0,10), phase: currentPhase
    };
    await db.put('labs_log', entry);
    document.getElementById('add-lab-modal')!.style.display = 'none';
    renderLabsDiagnostics(); // ре-рендер
  };
}