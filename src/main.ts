import { tgSDK } from './core/telegram';
import { db } from './core/db';
import { calcReadiness } from './engines/readiness.engine';
import { calculateRisks } from './engines/risk.engine';
import { calculateDose } from './engines/dosage.engine';
import { ReadinessInput, RiskInput, DoseRequest } from './core/types';
import './styles/global.css';

const app = document.getElementById('app')!;

function renderDashboard(
  readiness: ReturnType<typeof calcReadiness>,
  risks: ReturnType<typeof calculateRisks>,
  dose: ReturnType<typeof calculateDose>
) {
  const riskHtml = Object.entries(risks.systemBreakdown)
    .map(([sys, r]) => `
      <div class="row">
        <span class="label">${sys.toUpperCase()}</span>
        <span class="value" style="color: ${r.net < 30 ? 'var(--success)' : r.net < 60 ? 'var(--warning)' : 'var(--danger)'}">
          ${r.raw.toFixed(1)}% → ${r.net.toFixed(1)}%
        </span>
      </div>
    `).join('');

  app.innerHTML = `
    <div class="header"><h1>📊 Health Engine v1.1</h1></div>
    <div class="card">
      <h3 style="margin-bottom:10px; color:var(--success)">✅ Readiness</h3>
      <div class="row"><span class="label">Recovery</span><span class="value">${readiness.recovery}%</span></div>
      <div class="row"><span class="label">Nutrition</span><span class="value">${readiness.nutrition}%</span></div>
      <div class="row"><span class="label">Fatigue</span><span class="value">${readiness.fatigue}%</span></div>
      ${readiness.isConservative ? `<div style="color:var(--danger); margin:8px 0;">⚠️ Консервативный: ${readiness.conservativeReason}</div>` : ''}
    </div>
    <div class="card">
      <h3 style="margin-bottom:10px; color:${risks.overallNet < 40 ? 'var(--success)' : 'var(--warning)'}">⚖️ Risks (Raw → Net)</h3>
      ${riskHtml}
      <div class="row" style="margin-top:8px; border-top:1px solid var(--border); padding-top:8px;">
        <span class="label"><b>Overall</b></span>
        <span class="value"><b>${risks.overallRaw.toFixed(1)}% → ${risks.overallNet.toFixed(1)}%</b></span>
      </div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:10px;">💉 Dosage</h3>
      <div class="row"><span class="label">Volume</span><span class="value">${dose.volumeMl.toFixed(3)} ml</span></div>
      <div class="row"><span class="label">Divisions</span><span class="value">${dose.divisions}</span></div>
      <div class="row"><span class="label">Doses/Vial</span><span class="value">${dose.dosesPerVial}</span></div>
      ${dose.flags.length > 0 ? `<div style="color:var(--warning); margin-top:5px;">⚠️ ${dose.flags.join(', ')}</div>` : ''}
    </div>
    <div style="padding: 12px;">
      <button class="btn" id="recalc">Пересчитать (Demo)</button>
    </div>
  `;

  document.getElementById('recalc')!.onclick = runDemo;
  tgSDK.showMainButton('💾 Сохранить в IndexedDB', () => saveToDB());
}

async function runDemo() {
  const readinessInput: ReadinessInput = {
    sleepHours: 7.2, sleepQuality: 8, nightAwakenings: 1, hrvRatio: 1.05,
    doms: 6, stress: 4, subjFatigue: 5, hrIncrease: 0.5,
    trainingLoadRatio: 0.72, calRatio: 0.92, proteinRatio: 1.05,
    waterRatio: 0.85, fiberRatio: 0.75, omega3Flag: true,
    riskCoverageMap: { hepatic_2: 0.6, cardio_2: 0.5 }
  };

  const riskInput: RiskInput = {
    activeDrugs: { testosterone_enanthate: { dosePerWeek: 400 }, trenbolone_acetate: { dosePerWeek: 200 } },
    genetics: { COMT_Val158Met: 'Met/Met', AGTR1_A1166C: 'CC' },
    labs: [],
    nutritionFactor: 0.85,
    trainingFactor: 1.1,
    supportCoverage: { 'cardio_2': 0.4, 'hepatic_2': 0.5, 'neuro_1': 0.7 }
  };

  const doseInput: DoseRequest = {
    concentrationMgPerMl: 250,
    targetDoseMg: 150,
    syringeVolumeMl: 1,
    divisionsPerMl: 100,
    roundingStepMl: 0.01
  };

  renderDashboard(calcReadiness(readinessInput), calculateRisks(riskInput), calculateDose(doseInput));
}

async function saveToDB() {
  const readiness = calcReadiness({ sleepHours: 7.2, sleepQuality: 8, nightAwakenings: 1, hrvRatio: 1.05, doms: 6, stress: 4, subjFatigue: 5, hrIncrease: 0.5, trainingLoadRatio: 0.72, calRatio: 0.92, proteinRatio: 1.05, waterRatio: 0.85, fiberRatio: 0.75, omega3Flag: true, riskCoverageMap: {} });
  await db.put('calc_cache', { id: 'latest_readiness', ...readiness, timestamp: new Date().toISOString() });
  tgSDK.MainButton.setText('✅ Сохранено');
  setTimeout(() => tgSDK.MainButton.setText('💾 Сохранить в IndexedDB'), 1500);
}

async function bootstrap() {
  tgSDK.init();
  await db.init();
  runDemo();
  console.log('✅ Health Engine v1.1 | Risk & Dosage Engines Loaded');
}

bootstrap();