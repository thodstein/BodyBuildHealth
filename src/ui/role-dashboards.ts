import { db } from '../core/db';
import type { UserRole, LabPoint, RiskResult } from '../core/types';

interface PatientProfile { id: string; name: string; age: number; phase: string; lastLabDate: string; riskNet: number; alerts: string[]; }

export async function renderRoleDashboard(container: HTMLElement, role: UserRole, userId: string) {
  // Clear container
  container.replaceChildren();

  const allLabs: LabPoint[] = await db.getAll('labs_log') || [];
  const risks: RiskResult = { systemBreakdown: { cardio:{raw:32,net:18}, hepatic:{raw:45,net:28} }, overallRaw: 38.5, overallNet: 23.1 };

  const mockPatients: PatientProfile[] = [
    { id:'p1', name:'John D.', age:28, phase:'cycle', lastLabDate:'2024-02-15', riskNet: 22, alerts: ['HCT 53% (high)', 'ALT 65 U/L (elevated)'] },
    { id:'p2', name:'Mike S.', age:34, phase:'pct', lastLabDate:'2024-02-10', riskNet: 15, alerts: [] },
    { id:'p3', name:'Alex K.', age:41, phase:'bridge', lastLabDate:'2024-01-20', riskNet: 38, alerts: ['LDL >7 mmol/L'] }
  ];

  const filtered = role === 'doctor' ? mockPatients : mockPatients.filter(p => p.riskNet < 30);

  // Main card
  const mainCard = document.createElement('div');
  mainCard.className = 'card';
  container.appendChild(mainCard);

  const header = document.createElement('div');
  header.innerHTML = `
    <h3>Patient Overview</h3>
    <div class="row"><span class="label">Total Patients</span><span class="value">${filtered.length}</span></div>
    <div class="row"><span class="label">Average Risk</span><span class="value" style="color:${filtered.reduce((sum,p)=>sum+p.riskNet,0)/filtered.length > 30 ? 'var(--warning)' : 'var(--success)'}">${(filtered.reduce((sum,p)=>sum+p.riskNet,0)/filtered.length).toFixed(1)}</span></div>
  `;
  mainCard.appendChild(header);

  // Patients list header
  const patientsHeader = document.createElement('h3');
  patientsHeader.style.margin = '16px 0 8px';
  patientsHeader.textContent = 'Patient List';
  container.appendChild(patientsHeader);

  // Patient cards
  filtered.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.margin = '8px 0';
    card.style.borderLeft = '3px solid var(--info)';

    const row1 = document.createElement('div');
    row1.className = 'row';
    row1.innerHTML = `<span class="label"><b>${p.name}</b> (${p.age})</span><span class="value">${p.phase}</span>`;
    card.appendChild(row1);

    const row2 = document.createElement('div');
    row2.className = 'row';
    row2.innerHTML = `<span class="label">Last Lab</span><span class="value">${p.lastLabDate}</span>`;
    card.appendChild(row2);

    const row3 = document.createElement('div');
    row3.className = 'row';
    row3.innerHTML = `<span class="label">Net Risk</span><span class="value" style="color:${p.riskNet>30?'var(--warning)':'var(--success)'}">${p.riskNet}%</span>`;
    card.appendChild(row3);

    if (p.alerts.length) {
      const alertsDiv = document.createElement('div');
      alertsDiv.style.marginTop = '6px';
      alertsDiv.style.fontSize = '12px';
      p.alerts.forEach(a => {
        const alertEl = document.createElement('div');
        alertEl.className = 'cons';
        alertEl.textContent = a;
        alertsDiv.appendChild(alertEl);
      });
      card.appendChild(alertsDiv);
    } else {
      const noAlerts = document.createElement('div');
      noAlerts.style.marginTop = '6px';
      noAlerts.style.fontSize = '12px';
      noAlerts.style.color = 'var(--success)';
      noAlerts.textContent = 'No alerts';
      card.appendChild(noAlerts);
    }

    container.appendChild(card);
  });

  // Export button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn';
  exportBtn.style.marginTop = '12px';
  exportBtn.style.background = 'var(--warning)';
  exportBtn.style.color = '#000';
  exportBtn.textContent = 'Export';
  exportBtn.addEventListener('click', () => {
    alert('Export to CSV not implemented');
  });
  container.appendChild(exportBtn);
}
