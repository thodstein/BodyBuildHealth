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
    hepatic: Math.min(100, Math.round(load.hepatic)), cardio: Math.min(100, Math.round(load.cardio)),
    renal: Math.min(100, Math.round(load.renal)), neuro: Math.min(100, Math.round(load.neuro)),
    lipid: Math.min(100, Math.round(load.lipid)), endocrine: Math.min(100, Math.round(load.endocrine))
  };
}

export function renderStackAnalyzer(container: HTMLElement, course: CourseEntry[]) {
  const load = calculateStackLoad(course);
  const systems = [
    { k: 'hepatic', l: '🫁 Печень', c: load.hepatic }, { k: 'cardio', l: '❤️ Сердце/Сосуды', c: load.cardio },
    { k: 'renal', l: '🫘 Почки', c: load.renal }, { k: 'neuro', l: '🧠 ЦНС', c: load.neuro },
    { k: 'lipid', l: '🩸 Липиды', c: load.lipid }, { k: 'endocrine', l: '⚖️ Эндокрин', c: load.endocrine }
  ];

  container.innerHTML = `
    <div class="card"><h3>📊 Нагрузка по системам</h3>
      ${systems.map(s => `
        <div style="margin:8px 0;">
          <div class="row"><span class="label">${s.l}</span><span class="value" style="color:${s.c>60?'var(--danger)':s.c>35?'var(--warning)':'var(--success)'}">${s.c}%</span></div>
          <div class="bar"><div class="fill" style="width:${s.c}%;background:${s.c>60?'var(--danger)':s.c>35?'var(--warning)':'var(--success)'};height:6px;border-radius:3px;transition:width 0.3s;"></div></div>
        </div>
      `).join('')}
      ${Object.values(load).some(v => v > 70) ? `<div class="cons" style="margin-top:12px;">⚠️ Высокая нагрузка на системы. Рассмотрите снижение доз или усиление поддержки.</div>` : ''}
    </div>
    <div class="card"><h3>📋 Протокол курса</h3>
      ${course.map(c => {
        const sub = PHARMA_DB[c.substanceId];
        return `<div class="row"><span class="label">${sub?.name || c.substanceId}</span><span class="value">${c.doseValue} ${c.doseUnit} | ${c.frequency} | ${c.startWeek}-${c.endWeek} нед</span></div>`;
      }).join('')}
      <button class="btn" style="margin-top:12px;" id="stack-export">📤 Экспорт протокола (TXT)</button>
    </div>
  `;

  container.getElementById('stack-export')!.onclick = () => {
    const lines = ['HEALTH ENGINE STACK PROTOCOL', `Date: ${new Date().toISOString().slice(0,10)}`, '', 'Course:', ...course.map(c => `• ${PHARMA_DB[c.substanceId]?.name || c.substanceId}: ${c.doseValue}${c.doseUnit} (${c.frequency}) [Week ${c.startWeek}-${c.endWeek}]`), '', 'System Load:', ...Object.entries(load).map(([k,v]) => `• ${k}: ${v}%`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stack-protocol.txt'; a.click();
  };
}