import { CourseEntry } from '../core/types';
import { PHARMA_DB, SUPPORT_BASE_COVERAGE } from '../core/constants';

export interface StackLoad {
  hepatic: number; cardio: number; renal: number; neuro: number; lipid: number; endocrine: number;
}

export function calculateStackLoad(course: CourseEntry[]): StackLoad {
  const load: StackLoad = { hepatic: 0, cardio: 0, renal: 0, neuro: 0, lipid: 0, endocrine: 0 };
  course.forEach(c => {
    const pd = PHARMA_DB[c.substanceId]?.pd;
    if (!pd) return;
    const doseFactor = Math.min(2, c.doseValue / 100);
    load.hepatic += Math.min(100, pd.hepatotoxicity * doseFactor * 25);
    load.cardio += Math.min(100, (Math.abs(pd.lipid_impact) * 50) + (pd.hct_impact * 10));
    load.renal += Math.min(100, pd.hct_impact * 20);
    load.neuro += Math.min(100, pd.neuro_toxicity * doseFactor * 30);
    load.lipid += Math.min(100, Math.abs(pd.lipid_impact) * 60);
    load.endocrine += Math.min(100, (pd.aromatization + pd.progestogenic) * doseFactor * 40);
  });
  return {
    hepatic: Math.min(100, Math.round(load.hepatic)),
    cardio: Math.min(100, Math.round(load.cardio)),
    renal: Math.min(100, Math.round(load.renal)),
    neuro: Math.min(100, Math.round(load.neuro)),
    lipid: Math.min(100, Math.round(load.lipid)),
    endocrine: Math.min(100, Math.round(load.endocrine))
  };
}

export function renderStackAnalyzer(container: HTMLElement, course: CourseEntry[]) {
  // Clear container
  container.replaceChildren();

  const load = calculateStackLoad(course);
  const systems = [
    { key: 'hepatic', label: 'Liver', value: load.hepatic },
    { key: 'cardio', label: 'Cardio', value: load.cardio },
    { key: 'renal', label: 'Renal', value: load.renal },
    { key: 'neuro', label: 'Neuro', value: load.neuro },
    { key: 'lipid', label: 'Lipid', value: load.lipid },
    { key: 'endocrine', label: 'Endocrine', value: load.endocrine }
  ];

  // First card: Stack Load
  const stackCard = document.createElement('div');
  stackCard.className = 'card';
  const stackHeader = document.createElement('h3');
  stackHeader.textContent = 'Stack Load';
  stackCard.appendChild(stackHeader);

  systems.forEach(s => {
    const systemDiv = document.createElement('div');
    systemDiv.style.margin = '8px 0';

    const row = document.createElement('div');
    row.className = 'row';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = s.label;
    const valueSpan = document.createElement('span');
    valueSpan.className = 'value';
    valueSpan.textContent = s.value + '%';
    // Set color based on value
    if (s.value > 60) {
      valueSpan.style.color = 'var(--danger)';
    } else if (s.value > 35) {
      valueSpan.style.color = 'var(--warning)';
    } else {
      valueSpan.style.color = 'var(--success)';
    }
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    systemDiv.appendChild(row);

    const barDiv = document.createElement('div');
    barDiv.className = 'bar';
    const fillDiv = document.createElement('div');
    fillDiv.className = 'fill';
    fillDiv.style.width = s.value + '%';
    if (s.value > 60) {
      fillDiv.style.background = 'var(--danger)';
    } else if (s.value > 35) {
      fillDiv.style.background = 'var(--warning)';
    } else {
      fillDiv.style.background = 'var(--success)';
    }
    fillDiv.style.height = '6px';
    fillDiv.style.borderRadius = '3px';
    fillDiv.style.transition = 'width 0.3s';
    barDiv.appendChild(fillDiv);
    systemDiv.appendChild(barDiv);

    stackCard.appendChild(systemDiv);
  });

  // Add warning if any system load > 70
  if (Object.values(load).some(v => v > 70)) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'cons';
    warningDiv.style.marginTop = '12px';
    warningDiv.textContent = 'High load detected in one or more systems. Consider reducing dosage or adding support.';
    stackCard.appendChild(warningDiv);
  }

  container.appendChild(stackCard);

  // Second card: Course details and export
  const courseCard = document.createElement('div');
  courseCard.className = 'card';
  const courseHeader = document.createElement('h3');
  courseHeader.textContent = 'Course Details';
  courseCard.appendChild(courseHeader);

  course.forEach(c => {
    const sub = PHARMA_DB[c.substanceId];
    const row = document.createElement('div');
    row.className = 'row';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = sub?.name || c.substanceId;
    const valueSpan = document.createElement('span');
    valueSpan.className = 'value';
    valueSpan.textContent = c.doseValue + ' mg';
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    courseCard.appendChild(row);
  });

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn';
  exportBtn.style.marginTop = '12px';
  exportBtn.id = 'stack-export';
  exportBtn.textContent = 'Export (TXT)';
  courseCard.appendChild(exportBtn);

  container.appendChild(courseCard);

  // Export button event listener
  exportBtn.addEventListener('click', () => {
    const lines = [
      'HEALTH ENGINE STACK PROTOCOL',
      'Date: ' + new Date().toISOString(),
      '',
      'Course:',
      ...course.map(c => (PHARMA_DB[c.substanceId]?.name || c.substanceId) + ': ' + c.doseValue + ' mg'),
      '',
      'System Load:',
      ...Object.entries(load).map(([k, v]) => k + ': ' + v + '%')
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'stack-protocol.txt';
    a.click();
  });
}
