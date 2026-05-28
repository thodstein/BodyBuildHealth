import { db } from '../core/db';
import type { UserRole, LabPoint, RiskResult } from '../core/types';

interface PatientProfile { id: string; name: string; age: number; phase: string; lastLabDate: string; riskNet: number; alerts: string[]; }

export async function renderRoleDashboard(container: HTMLElement, role: UserRole, userId: string) {
  // В реальном приложении данные тянутся по Supabase. Здесь демо-срез из локальной БД + mock-профили
  const allLabs: LabPoint[] = await db.getAll('labs_log') || [];
  const risks: RiskResult = { systemBreakdown: { cardio:{raw:32,net:18}, hepatic:{raw:45,net:28} }, overallRaw: 38.5, overallNet: 23.1 };

  const mockPatients: PatientProfile[] = [
    { id:'p1', name:'Алексей К.', age:28, phase:'course', lastLabDate:'2024-02-15', riskNet: 22, alerts: ['HCT 53% (крит.)', 'ALT 65 U/L (рост)'] },
    { id:'p2', name:'Мария С.', age:34, phase:'pct', lastLabDate:'2024-02-10', riskNet: 15, alerts: [] },
    { id:'p3', name:'Дмитрий В.', age:41, phase:'bridge', lastLabDate:'2024-01-20', riskNet: 38, alerts: ['Просрочен чекап >7дн'] }
  ];

  const filtered = role === 'doctor' ? mockPatients : mockPatients.filter(p => p.riskNet < 30);

  container.innerHTML = `
    <div class="card"><h3>👨‍⚕️ Панель ${role === 'doctor' ? 'Врача' : 'Тренера'}</h3>
      <div class="row"><span class="label">Всего подопечных</span><span class="value">${mockPatients.length}</span></div>
      <div class="row"><span class="label">Требуют внимания</span><span class="value" style="color:${filtered.some(p=>p.alerts.length)?'var(--danger)':'var(--success)'}">${filtered.filter(p=>p.alerts.length).length}</span></div>
    </div>
    <h3 style="margin:16px 0 8px;">📋 Список пациентов</h3>
    ${filtered.map(p => `
      <div class="card" style="margin:8px 0;border-left:3px solid ${p.alerts.length?'var(--danger)':'var(--success)'};">
        <div class="row"><span class="label"><b>${p.name}</b> (${p.age} лет)</span><span class="value">${p.phase.toUpperCase()}</span></div>
        <div class="row"><span class="label">Последний анализ</span><span class="value">${p.lastLabDate}</span></div>
        <div class="row"><span class="label">Net Risk</span><span class="value" style="color:${p.riskNet>30?'var(--danger)':'var(--success)'}">${p.riskNet}%</span></div>
        ${p.alerts.length ? `<div style="margin-top:6px;font-size:12px;">${p.alerts.map(a=>`<div class="cons">${a}</div>`).join('')}</div>` : '<div style="margin-top:6px;font-size:12px;color:var(--success);">✅ Без алертов</div>'}
      </div>
    `).join('')}
    <button class="btn" style="margin-top:12px;background:var(--warning);color:#000;" onclick="alert('Экспорт списка в CSV')">📤 Экспорт реестра</button>
  `;
}