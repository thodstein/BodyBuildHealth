/** DiaryToolsView.tsx — режим «Инструменты» хаба дневника (вынесен из TrainingDiaryHub). */
import React from 'react';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { loadMeasurements, saveMeasurement } from '../../../engines/log-analytics-progression.engine';
import { getWeightLog, saveWeightLog } from '../../../engines/profile-store';
import { findDuplicateWorkouts } from '../../../engines/workout-logger.engine';
import { CsvImportTab } from './CsvImportTab';
import { OneRmCalcTab } from './OneRmCalcTab';
import { PlateCalcTab } from './PlateCalcTab';
import { WorkoutComparisonCard, ExerciseSubstitutionCard, WarmupRampCard } from './diary-cards';
import { diaryStyles as style } from './diary-tokens';
import { useDiaryHub, type DiaryHubCtx } from './diary-hub-context';
import { exportMindsetCheckinsCSV, loadCheckins } from '../../../engines/mindset-protocol.engine';
import { exportMobilityCheckinsCSV, loadMobilityCheckins } from '../../../engines/mobility-protocol.engine';
import { exportWarmupCheckinsCSV, loadWarmupLog, warmupAdherence, warmupQualityTrend } from '../../../engines/warmup.engine';
import { restoreDiaryExtras } from '../../../engines/diary-backup.engine';

export const DiaryToolsView: React.FC<{ hub: DiaryHubCtx }> = ({ hub }) => {
  const {
    diary, historyWorkouts, macrocycle, trainingOutput, goal, level, daysPerWeek, splitType,
    periodizationType, mesoLength, trainingArchive, setTrainingArchive,
    trainingReportGenerated, setTrainingReportGenerated,
    measurements, setMeasurements, dupes, setDupes, dupesBusy, setDupesBusy, onRefresh,
  } = hub;
  return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CsvImportTab onDone={onRefresh} />
          {/* CSV Export */}
          <div style={style.card}>
            <div style={style.label}>📥 Экспорт CSV</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Экспорт всех тренировок в CSV (совместим с импортом)</div>
            {historyWorkouts.length === 0 ? (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: 8 }}>Нет данных для экспорта</div>
            ) : (
              <button onClick={() => {
                const rows: string[] = ['date,exercise,set,weight,reps,rpe,rir,notes'];
                historyWorkouts.forEach((w: any) => {
                  (w.exercises || []).forEach((ex: any) => {
                    (ex.sets || []).forEach((s: any, i: number) => {
                      const weight = s.weight ?? '';
                      const reps = s.reps ?? '';
                      const rpe = s.rpe ?? '';
                      const rir = s.rir ?? '';
                      const notes = s.notes ?? '';
                      const safeWeight = typeof weight === 'string' ? `"${weight}"` : weight;
                      rows.push(`${(w.date || '').slice(0, 10)},"${(ex.exerciseName || '').replace(/"/g, '""')}",${i + 1},${safeWeight},${reps},${rpe},${rir},"${String(notes).replace(/"/g, '""')}"`);
                    });
                  });
                });
                const csv = rows.join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `diary_export_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ width: '100%', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                📥 Скачать CSV ({historyWorkouts.length} тренировок)
              </button>
            )}
          </div>
          {/* Mindset check-ins CSV export */}
          <div style={style.card}>
            <div style={style.label}>🧠 Психо-чек-ины CSV</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Экспорт чек-инов уверенности/активации/фокуса из вкладки «Психология» ({loadCheckins().length} записей)</div>
            <button onClick={() => {
              const csv = exportMindsetCheckinsCSV();
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `mindset_checks_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }} style={{ width: '100%', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', cursor: 'pointer' }}>
              🧠 Скачать психо-чек-ины CSV
            </button>
          </div>
          {/* Mobility check-ins CSV export */}
          <div style={style.card}>
            <div style={style.label}>🧘 Мобильность CSV</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Экспорт чек-инов мобильности (выполнено + ROM) из вкладки «Мобильность» ({loadMobilityCheckins().length} записей)</div>
            <button onClick={() => {
              const csv = exportMobilityCheckinsCSV();
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `mobility_checks_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }} style={{ width: '100%', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', cursor: 'pointer' }}>
              🧘 Скачать чек-ины мобильности CSV
            </button>
          </div>
          {/* Warmup diary CSV export */}
          <div style={style.card}>
            <div style={style.label}>🔥 Разминка CSV</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Экспорт дневника разминки (выполнена/качество/причина пропуска) — {loadWarmupLog().length} записей</div>
            <button onClick={() => {
              const csv = exportWarmupCheckinsCSV();
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `warmup_checks_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }} style={{ width: '100%', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)', cursor: 'pointer' }}>
              🔥 Скачать дневник разминки CSV
            </button>
          </div>
          {/* Workout templates from history */}
          {historyWorkouts.length > 0 && (() => {
            const recent = historyWorkouts.slice(-5).reverse();
            const templateMap = new Map<string, { exercises: string[]; sets: number; date: string }>();
            recent.forEach((w: any) => {
              const exNames = (w.exercises || []).map((e: any) => e.exerciseName || e.exerciseId).join(' + ');
              const totalSets = (w.exercises || []).reduce((s: number, e: any) => s + (e.sets?.length || 0), 0);
              if (exNames && !templateMap.has(exNames)) {
                templateMap.set(exNames, { exercises: exNames.split(' + '), sets: totalSets, date: (w.date || '').slice(0, 10) });
              }
            });
            const templates = [...templateMap.entries()].slice(0, 4);
            if (templates.length === 0) return null;
            return (
              <div style={style.card}>
                <div style={style.label}>📋 Шаблоны из дневника</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Повторить тренировку из прошлого</div>
                {templates.map(([key, t], i) => (
                  <div key={i} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{t.exercises.slice(0, 3).join(', ')}{t.exercises.length > 3 ? ` +${t.exercises.length - 3}` : ''}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{t.sets} сетов · {t.date}</div>
                    </div>
                    <button onClick={() => {
                      const wo = recent.find((w: any) => {
                        const names = (w.exercises || []).map((e: any) => e.exerciseName || e.exerciseId).join(' + ');
                        return names === key;
                      });
                      if (wo) try { localStorage.setItem('he_diary_template', JSON.stringify(wo)); window.dispatchEvent(new Event('diary-template-loaded')); } catch {}
                    }} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 9, background: 'rgba(0,230,138,0.15)', color: '#00e68a', border: 'none', cursor: 'pointer' }}>📋 Использовать</button>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={style.card}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>📄 Отчёты</div>
            <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => {
              const planWeeks = macrocycle?.totalWeeks ?? (trainingOutput?.plan?.length && daysPerWeek > 0 ? Math.ceil(trainingOutput.plan.length / daysPerWeek) : 0);
              const report = {
                id: 'report_' + Date.now(), date: new Date().toISOString(),
                exerciseCatalogCount: EXERCISE_CATALOG.length, planWeeks, exercisesPerWeek: daysPerWeek,
                totalVolume: trainingOutput?.weeklyVolume ?? 0,
                avgIntensity: trainingOutput?.estimatedProgress ? Math.round(50 + trainingOutput.estimatedProgress * 5) : 0,
                goal, level, daysPerWeek, splitType, periodizationType, mesoLength,
              };
              const updated = [report, ...trainingArchive].slice(0, 20);
              setTrainingArchive(updated);
              try { localStorage.setItem('he_training_reports', JSON.stringify(updated)); } catch {}
              try { localStorage.setItem('he_training_report_current', JSON.stringify(report)); } catch {}
              setTrainingReportGenerated(true);
            }} style={{ flex: 1, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
              Сгенерировать отчёт
            </button>
            <button onClick={() => {
              // Печатный отчёт за последние 30 дней
              const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
              const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
              const month = historyWorkouts.filter(w => new Date(w.date) >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
              const vol = month.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + e.totalVolume, 0), 0);
              const sets = month.reduce((s, w) => s + w.exercises.reduce((sum, e) => sum + (e.sets?.length || 0), 0), 0);
              const prs = month.flatMap(w => (w.exercises || []).flatMap(e => (e.sets || []).filter((x: any) => x.isPR).map(() => ({ ex: e.exerciseName, w: w.date }))));
              // Психо-чек-ины и мобильность за 30 дней
              const cutoffStr = cutoff.toISOString().slice(0, 10);
              const mind30 = loadCheckins().filter(c => c.date >= cutoffStr);
              const mob30 = loadMobilityCheckins().filter(c => c.date >= cutoffStr);
              const warm30 = loadWarmupLog().filter(e => e.date >= cutoffStr);
              const confAvg = mind30.length > 0 ? (mind30.reduce((s, c) => s + c.confidence, 0) / mind30.length).toFixed(1) : null;
              const mobDone30 = mob30.filter(c => c.done).length;
              const warmDone30 = warm30.filter(e => e.done).length;
              const warmQ = warmupQualityTrend(30);
              const romAvg = (() => { const scored = mob30.filter(c => c.romScore !== null); return scored.length > 0 ? (scored.reduce((s, c) => s + (c.romScore || 0), 0) / scored.length).toFixed(1) : null; })();
              const rows = month.map(w => `
                <tr>
                  <td>${esc(w.date)}</td><td>${esc(w.split || 'Тренировка')}</td>
                  <td>${w.exercises.length}</td><td>${w.exercises.reduce((s, e) => s + (e.sets?.length || 0), 0)}</td>
                  <td>${Math.round(w.exercises.reduce((s, e) => s + e.totalVolume, 0)).toLocaleString()}</td>
                  <td>${esc(w.notes || '')}</td>
                </tr>`).join('');
              const html = `<!doctype html><html><head><meta charset="utf-8"><title>Дневник — отчёт за 30 дней</title>
                <style>body{font-family:system-ui;padding:24px;color:#111}table{width:100%;border-collapse:collapse;font-size:12px}
                th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f5f5f5}h1{font-size:18px}h2{font-size:14px;margin-top:20px}
                .stats{display:flex;gap:24px;font-size:13px;margin:8px 0}</style></head><body>
                <h1>📊 Тренировочный дневник — 30 дней</h1>
                <div class="stats"><span>Тренировок: <b>${month.length}</b></span><span>Подходов: <b>${sets}</b></span><span>Тоннаж: <b>${(vol / 1000).toFixed(1)} т</b></span></div>
                ${mind30.length > 0 || mob30.length > 0 || warm30.length > 0 ? `
                  <h2>🧠 Психология, мобильность и разминка</h2>
                  <div class="stats">
                    ${mind30.length > 0 ? `<span>Психо-чек-инов: <b>${mind30.length}</b></span><span>Ср. уверенность: <b>${confAvg}/5</b></span>` : ''}
                    ${mob30.length > 0 ? `<span>Мобильность: <b>${mobDone30}/${mob30.length}</b> дней</span><span>Ср. ROM: <b>${romAvg !== null ? romAvg + '/5' : '—'}</b></span>` : ''}
                    ${warm30.length > 0 ? `<span>Разминка: <b>${warmDone30}/${warm30.length}</b> дней</span><span>Ср. качество: <b>${warmQ.count > 0 ? warmQ.avg.toFixed(1) + '/5' : '—'}</b></span>` : ''}
                  </div>` : ''}
                ${prs.length > 0 ? `<h2>🏆 PR за период</h2><ul>${prs.slice(0, 10).map(p => `<li>${esc(p.ex)} — ${esc(p.w)}</li>`).join('')}</ul>` : ''}
                <h2>📋 Сессии</h2>
                <table><thead><tr><th>Дата</th><th>Сплит</th><th>Упр.</th><th>Сеты</th><th>Объём</th><th>Заметки</th></tr></thead><tbody>${rows}</tbody></table>
                <script>window.print();</script></body></html>`;
              const win = window.open('', '_blank', 'width=900,height=700');
              if (win) { win.document.write(html); win.document.close(); }
            }} style={{ flex: 1, padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', cursor: 'pointer' }}>
              🖨 Отчёт месяца
            </button>
            </div>
            {trainingReportGenerated && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#22c55e' }}>✓ Отчёт сохранён</p>}
            {trainingArchive.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Архив ({trainingArchive.length})</span>
                  <button onClick={() => { setTrainingArchive([]); localStorage.removeItem('he_training_reports'); setTrainingReportGenerated(false); }}
                    style={{ padding: '3px 8px', borderRadius: 5, fontSize: 9, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>Очистить</button>
                </div>
                {[...trainingArchive].slice(0, 3).map((r: any) => (
                  <div key={r.id} style={{ fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--text-dim)' }}>
                    {new Date(r.date).toLocaleDateString('ru')} · {r.planWeeks} нед · {r.goal}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Workout Comparison */}
          {historyWorkouts.length >= 2 && <WorkoutComparisonCard historyWorkouts={historyWorkouts} />}
          {/* Exercise Substitution */}
          <div style={style.card}>
            <div style={style.label}>🔄 Подбор замены</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Альтернативы по мышечной группе</div>
            <ExerciseSubstitutionCard />
          </div>
          {/* 1RM Calculator — existing component */}
          <div style={style.card}>
            <OneRmCalcTab />
          </div>
          {/* Warm-up Ramp Calculator */}
          <WarmupRampCard />
          {/* Plate Calculator — existing component */}
          <div style={style.card}>
            <PlateCalcTab />
          </div>
          {/* Хранилище: диагностика дублей + импорт/экспорт веса (Google Fit мост) */}
          <div style={style.card}>
            <div style={style.label}>🧹 Хранилище: дубли и вес</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
              Поиск одинаковых тренировок (дата + контент) и синхронизация веса с внешними приложениями.
            </div>
            {dupes && dupes.length > 0 && (
              <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                Найдено дублей: {dupes.reduce((s, d) => s + d.dupes.length, 0)} (групп: {dupes.length}) — например, {dupes[0].dupes[0].date} · {dupes[0].keep.exercises[0]?.exerciseName || '—'}
              </div>
            )}
            {dupes && dupes.length === 0 && (
              <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, fontSize: 10, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>
                Дублей не найдено — хранилище чисто.
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setDupes(findDuplicateWorkouts(historyWorkouts))}
                style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', cursor: 'pointer' }}>
                🔍 Найти дубли
              </button>
              {dupes && dupes.length > 0 && (
                <button onClick={async () => {
                  setDupesBusy(true);
                  const toDelete = dupes.flatMap(d => d.dupes);
                  for (const d of toDelete) await diary.deleteWorkoutLog(d.id);
                  setDupes(findDuplicateWorkouts(await diary.getWorkoutLogs()));
                  setDupesBusy(false);
                  onRefresh();
                }} disabled={dupesBusy}
                  style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)', cursor: 'pointer' }}>
                  {dupesBusy ? 'Удаляю...' : `🗑 Удалить ${dupes.reduce((s, d) => s + d.dupes.length, 0)} дублей`}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={() => {
                // Экспорт веса для Google Fit / сторонних приложений
                const rows = getWeightLog().map(e => `${e.date},${e.weight}${e.bodyFat ? `,${e.bodyFat}` : ''}`);
                const csv = ['date,weight_kg,body_fat_pct', ...rows].join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `weight_export_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', cursor: 'pointer' }}>
                📤 Экспорт веса CSV (Google Fit)
              </button>
              <label style={{ flex: 1, minWidth: 120, padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', cursor: 'pointer', textAlign: 'center' }}>
                📥 Импорт веса CSV
                <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const text = String(reader.result || '');
                      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                      const entries: Array<{ date: string; weight: number; bodyFat?: number }> = [];
                      for (const l of lines) {
                        if (/^date/i.test(l)) continue;
                        const parts = l.split(/[;,]/).map(p => p.trim());
                        const date = parts[0];
                        const weight = parseFloat(parts[1]);
                        const bodyFat = parts[2] !== undefined ? parseFloat(parts[2]) : undefined;
                        if (!/^\d{4}-\d{2}-\d{2}/.test(date) || !Number.isFinite(weight) || weight <= 0) continue;
                        entries.push({ date, weight, bodyFat: Number.isFinite(bodyFat) && (bodyFat as number) > 0 ? bodyFat as number : undefined });
                      }
                      if (entries.length === 0) { alert('Нет валидных строк (формат: дата,вес[,жир%])'); return; }
                      const existing = getWeightLog();
                      const byDate = new Map(existing.map(e => [e.date, e]));
                      entries.forEach(entry => {
                        const prev = byDate.get(entry.date);
                        byDate.set(entry.date, { date: entry.date, weight: entry.weight, ...(entry.bodyFat != null ? { bodyFat: entry.bodyFat } : {}), ...(prev?.bodyFat != null && entry.bodyFat == null ? { bodyFat: prev.bodyFat } : {}) });
                      });
                      saveWeightLog([...byDate.values()]);
                      setMeasurements(loadMeasurements());
                      alert(`Импортировано: ${entries.length} записей веса`);
                      onRefresh();
                    } catch { alert('Ошибка чтения файла'); }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }} />
              </label>
            </div>
          </div>
          {/* JSON Full Backup */}
          <div style={style.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={style.label} >💾 Полный бэкап</div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(0,230,138,0.1)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)' }}>
                🔄 Синхронизировано: IDB ↔ localStorage ({historyWorkouts.length})
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Экспорт/импорт всех данных дневника (JSON)</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { void (async () => { await diary.getWorkoutLogs(); onRefresh(); })(); }} style={{ flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(0,230,138,0.08)', color: '#00e68a', border: '1px solid rgba(0,230,138,0.3)', cursor: 'pointer' }}>
                🔄 Синхронизировать
              </button>
              <button onClick={() => {
                const backup = {
                  version: 1,
                  date: new Date().toISOString(),
                  workouts: historyWorkouts,
                  measurements,
                  reports: trainingArchive,
                  rirCalibration: (() => { try { return JSON.parse(localStorage.getItem('he_rir_calibration') || 'null'); } catch { return null; } })(),
                  mmc: (() => { try { return JSON.parse(localStorage.getItem('he_mmc_data') || '[]'); } catch { return []; } })(),
                  warmupDiary: loadWarmupLog(),
                  mindsetChecks: loadCheckins(),
                  mobilityChecks: loadMobilityCheckins(),
                };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `diary_backup_${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }} style={{ flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer' }}>
                📥 Экспорт
              </button>
              <label style={{ flex: 1, padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
                📤 Импорт
                <input type="file" accept=".json" onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    (async () => {
                      try {
                        const data = JSON.parse(reader.result as string);
                        if (data.version !== 1 || !data.workouts) { alert('Неверный формат бэкапа'); return; }
                        const existing = historyWorkouts;
                        const existingIds = new Set(existing.map((w: any) => w.id || w.date));
                        const newWorkouts = data.workouts.filter((w: any) => !existingIds.has(w.id || w.date));
                        // Запись через единый слой: IDB + зеркало в localStorage (he_workout_log_v2)
                        for (const w of newWorkouts) {
                          await diary.saveWorkoutLog(w);
                        }
                        let addedMeasurements = 0;
                        if (data.measurements?.length) {
                          const existM = loadMeasurements();
                          const existDates = new Set(existM.map((m: any) => m.date));
                          const newM = data.measurements.filter((m: any) => !existDates.has(m.date));
                          if (newM.length) { try { newM.forEach((m: any) => saveMeasurement(m)); addedMeasurements = newM.length; } catch {} }
                        }
                        // Восстановление дневников разминки/психо/мобильности (мерж: добавляются только отсутствующие)
                        const extras = restoreDiaryExtras(data);
                        const totalAdded = newWorkouts.length + addedMeasurements + extras.warmup + extras.mind + extras.mob;
                        if (totalAdded === 0) { alert('Все данные уже есть в дневнике'); return; }
                        alert(`Импортировано: ${newWorkouts.length} тренировок, ${addedMeasurements} замеров, ${extras.warmup} записей разминки, ${extras.mind} психо-чек-инов, ${extras.mob} чек-инов мобильности`);
                        onRefresh();
                      } catch { alert('Ошибка чтения файла'); }
                    })();
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>
  );
};