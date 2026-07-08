import React from 'react';
import type { UserProfile, LabPoint, WorkoutLog } from '../../../core/types';
import { theme, glassCardStyle, sectionLabelStyle, HealthNumber, HealthBool } from './ProfileComponents';
import { ProfessionalReports, ReportData } from './ProfessionalReports';
import { PharmaBlockReports } from './PharmaBlockReports';

interface Props {
  settings: UserProfile['settings'];
  save: (partial: Partial<UserProfile['settings']>) => void;
  labs: LabPoint[];
  workoutLogs: WorkoutLog[];
  foodDiaryAvg?: { avgKcal: number; avgProtein: number; avgFat: number; avgCarbs: number } | null;
  profileName: string;
  onNavigate?: (screen: string) => void;
}

const SPORT_TYPES: { id: string; label: string }[] = [
  { id: 'bodybuilding', label: 'Бодибилдинг' }, { id: 'powerlifting', label: 'Пауэрлифтинг' },
  { id: 'crossfit', label: 'Кроссфит' }, { id: 'fitness', label: 'Фитнес' }, { id: 'other', label: 'Другое' },
];
const CHRONIC_CONDITIONS: { id: string; label: string }[] = [
  { id: 'hypertension', label: 'Гипертония' }, { id: 'diabetes', label: 'Диабет' },
  { id: 'asthma', label: 'Астма' }, { id: 'thyroid', label: 'Щитовидная железа' },
  { id: 'heart', label: 'Сердечно-сосудистые' }, { id: 'liver', label: 'Заболевания печени' },
  { id: 'kidney', label: 'Заболевания почек' }, { id: 'joints', label: 'Заболевания суставов' },
];
const GOALS: { id: string; label: string }[] = [
  { id: 'bulk', label: 'Масса' }, { id: 'cut', label: 'Сушка' },
  { id: 'maintenance', label: 'Поддержка' }, { id: 'strength', label: 'Сила' },
  { id: 'hypertrophy', label: 'Гипертрофия' }, { id: 'rehab', label: 'Реабилитация' },
  { id: 'recomposition', label: 'Рекомп' }, { id: 'health', label: 'Здоровье' },
];
const COURSE_PHASES: { id: string; label: string }[] = [
  { id: 'baseline', label: 'База' }, { id: 'course', label: 'Курс' },
  { id: 'bridge', label: 'Бридж' }, { id: 'pct', label: 'ПКТ' },
  { id: 'post_pct', label: 'После ПКТ' }, { id: 'fertility', label: 'Фертильность' },
];

export const ProfileAnalyticsSection: React.FC<Props> = ({ settings, save, labs, workoutLogs, foodDiaryAvg, profileName, onNavigate }) => {
  const [analyticsSubTab, setAnalyticsSubTab] = React.useState<'reports' | 'pharma_reports'>('reports');
  const [reportTab, setReportTab] = React.useState<'current' | 'archive'>('current');
  const [showCustomReport, setShowCustomReport] = React.useState(false);

  const bmiVal = settings.weight && settings.height ? (settings.weight / Math.pow(settings.height / 100, 2)).toFixed(1) : '—';
  const lbmVal = settings.weight && settings.bodyFat ? (settings.weight * (1 - settings.bodyFat / 100)).toFixed(1) : '—';
  const ffmiVal = lbmVal !== '—' && settings.height ? (parseFloat(lbmVal) / Math.pow(settings.height / 100, 2) + 6.1 * (1.8 - settings.height / 100)).toFixed(1) : '—';

  const riskData = (() => { try { return JSON.parse(localStorage.getItem('he_last_risk') || 'null'); } catch { return null; } })();
  const suppsList = (settings.currentSupplements || []).map((x: any) => `${x.name || x.label}${x.doseMg ? ` ${x.doseMg}${x.doseUnit || 'mg'}` : ''}`).join(', ') || 'нет';
  const medsList = (settings.currentMedications || []).map((x: any) => `${x.name}${x.doseMg ? ` ${x.doseMg}${x.doseUnit || 'mg'} ${x.frequency || ''}` : ''}`).join(', ') || 'нет';
  const chronicList = (settings.chronicConditions || []).map(c => CHRONIC_CONDITIONS.find(cc => cc.id === c)?.label || c).join(', ') || 'нет';
  const goalLabelR = GOALS.find(g => g.id === (settings.primaryGoal || settings.goal))?.label || 'не указана';
  const labsList = labs.map(l => `${l.code}: ${l.value} ${l.unit}`).join('\n  ') || 'нет данных';
  const last3Workouts = workoutLogs.slice(0, 3);
  const workoutSummary = last3Workouts.length > 0
    ? last3Workouts.map(w => `  • ${w.date} | Сплит: ${w.split} | RPE: ${w.overallRPE} | Упр: ${(w.exercises ?? []).length} | Объём: ${(w.exercises ?? []).reduce((s, e) => s + (e.totalVolume ?? 0), 0).toFixed(0)} кг`).join('\n')
    : '  — нет записей';
  const programName = localStorage.getItem('he_current_program') || 'не задана';
  const measurements = (() => { try { return JSON.parse(localStorage.getItem('he_measurements_log') || '[]'); } catch { return []; } })();
  const last3Meas = measurements.slice(-3);
  const measSummary = last3Meas.length > 0
    ? last3Meas.map((m: any) => `  • ${m.date}: Тал:${m.waistCm || '—'} Гр:${m.chestCm || '—'} Биц:${m.bicepCm || '—'} Бед:${m.thighCm || '—'} Бёд:${m.hipCm || '—'} Жир:${m.bodyFat || '—'}%`).join('\n')
    : '  — нет записей';

  const weightLog = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('he_weight_log') || '[]'); } catch { return []; }
  }, [settings.weight]);

  const RISK_SYSTEMS = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal'];
  const RISK_LABELS_MAP: Record<string, string> = {
    cardio:'ССС', hepatic:'Печень', renal:'Почки', neuro:'НС', endocrine:'Эндокринная',
    hematologic:'Кровь', reproductive:'Репрод.', musculoskeletal:'Опорно-дв.',
  };

  const trainerReport = [
    `═`.repeat(40), `  Отчет для тренера`, `═`.repeat(40), '',
    `ОСНОВНАЯ ИНФОРМАЦИЯ`, `  Имя: ${profileName || '—'}`,
    `  Возраст: ${settings.age || '—'} лет | Пол: ${settings.sex === 'male' ? 'муж' : 'жен'}`,
    `  Вес: ${settings.weight || '—'} кг | Рост: ${settings.height || '—'} см`,
    `  BMI: ${bmiVal} | FFMI: ${ffmiVal} | BF%: ${settings.bodyFat || '—'}%`, '',
    `ЦЕЛЬ И ОПЫТ`, `  Цель: ${goalLabelR}`,
    `  Стаж тренировок: ${settings.trainingExperience || '—'} лет`,
    `  Уровень: ${settings.trainingLevel || '—'}`, `  Спорт: ${SPORT_TYPES.find(s => s.id === settings.sportType)?.label || '—'}`, '',
    `ТРЕНИРОВОЧНЫЕ ПАРАМЕТРЫ`, `  Частота: ${settings.workoutsPerWeek || '—'} тренировок/нед`,
    `  Длительность: ${settings.avgWorkoutMinutes || '—'} мин/тренировка`,
    `  Недельный объём: ~${(settings.workoutsPerWeek || 0) * (settings.avgWorkoutMinutes || 0)} мин/нед`,
    `  Программа: ${programName}`,
    `  Последняя тренировка: ${workoutLogs.length > 0 ? workoutLogs[0].date : 'нет записей'}`, '',
    `ПОСЛЕДНИЕ ТРЕНИРОВКИ (${last3Workouts.length})`, workoutSummary, '',
    `ФАЗА КУРСА`, `  ${COURSE_PHASES.find(p => p.id === settings.phase)?.label || 'База'}${settings.courseStartDate ? ` (с ${settings.courseStartDate})` : ''}`, '',
    `ПРОГРЕСС ВЕСА`, `  Текущий: ${settings.weight || '—'} кг | Целевой: ${settings.targetWeight || '—'} кг`,
    `  Изменений в логе: ${weightLog.length}`, '',
    `  Дата: ${new Date().toLocaleDateString('ru')}`, `═`.repeat(40),
  ].join('\n');

  const doctorReport = [
    `═`.repeat(40), `  Отчет для врача`, `═`.repeat(40), '',
    `ПАЦИЕНТ`, `  Имя: ${profileName || '—'}`,
    `  Возраст: ${settings.age || '—'} лет | Пол: ${settings.sex === 'male' ? 'мужской' : 'женский'}`,
    `  Группа крови: ${settings.bloodType || '—'}`,
    `  Вес: ${settings.weight || '—'} кг | Рост: ${settings.height || '—'} см | BMI: ${bmiVal}`,
    `  Аллергии: ${settings.allergyNotes || 'нет'}`, '',
    `ЛАБОРАТОРНЫЕ АНАЛИЗЫ`, `  ${labsList}`,
    `  Последние анализы: ${labs.length > 0 ? labs.sort((a: LabPoint, b: LabPoint) => b.date.localeCompare(a.date)).slice(0, 5).map(l => `${l.code} ${l.value}${l.unit} (${l.date})`).join(', ') : 'нет данных'}`,
    '', `РИСКИ ПО СИСТЕМАМ`,
    ...(riskData?.systemBreakdown
      ? RISK_SYSTEMS.map(sys => {
          const v = riskData.systemBreakdown[sys];
          const pct = v?.net !== undefined ? `${v.net}%` : '—';
          const status = v?.net < 20 ? 'OK' : v?.net < 40 ? 'ВНИМАНИЕ' : v?.net < 60 ? 'РИСК' : 'ОПАСНОСТЬ';
          return `  ${(RISK_LABELS_MAP[sys] || sys).padEnd(12)} ${pct.padEnd(6)} ${status}`;
        })
      : ['  — нет данных']), '',
    `МЕДИКАМЕНТОЗНАЯ ТЕРАПИЯ`, `  Препараты на курсе: ${medsList}`, `  БАДы и поддержка: ${suppsList}`,
    ...(riskData?.systemSupport ? RISK_SYSTEMS.filter(sys => riskData.systemSupport[sys] !== undefined).map(sys => `    ${(RISK_LABELS_MAP[sys] || sys).padEnd(20)} покрытие ${Math.round(riskData.systemSupport[sys])}%`) : []),
    `  Общее покрытие поддержки: ${riskData?.totalSupport ? Math.round(riskData.totalSupport) + '%' : '—'}`, '',
    `ХРОНИЧЕСКИЕ ЗАБОЛЕВАНИЯ`, `  ${chronicList}`, '',
    `ЭКСТРЕННЫЙ КОНТАКТ`, `  ${settings.emergencyName || '—'} / ${settings.emergencyPhone || '—'}`, '',
    `  Дата: ${new Date().toLocaleDateString('ru')}`, `═`.repeat(40),
  ].join('\n');

  const generalReport = [
    `═`.repeat(40), `  Общий отчет BodyBuildHealth`, `═`.repeat(40), '',
    `ПРОФИЛЬ`, `  ${profileName || '—'} | ${settings.age || '—'} лет | ${settings.sex === 'male' ? 'М' : 'Ж'}`,
    `  Вес: ${settings.weight || '—'} кг | Рост: ${settings.height || '—'} см`,
    `  BMI: ${bmiVal} | FFMI: ${ffmiVal} | BF%: ${settings.bodyFat || '—'}%`, '',
    `ТРЕНИРОВКИ`, `  Спорт: ${SPORT_TYPES.find(s => s.id === settings.sportType)?.label || '—'}`,
    `  Стаж: ${settings.trainingExperience || '—'} лет | Уровень: ${settings.trainingLevel || '—'}`,
    `  Цель: ${goalLabelR}`, `  ${settings.workoutsPerWeek || '—'} трен/нед × ${settings.avgWorkoutMinutes || '—'} мин`,
    `  Программа: ${programName}`, '',
    `ПИТАНИЕ`, `  Тип: ... | Приёмы: ${settings.mealsPerDay || '—'} в день`,
    ...(foodDiaryAvg ? [`  Среднее (7 дней): ${foodDiaryAvg.avgKcal} ккал | Б:${foodDiaryAvg.avgProtein}г Ж:${foodDiaryAvg.avgFat}г У:${foodDiaryAvg.avgCarbs}г`] : []),
    '', `ФАРМАКОЛОГИЯ И ПОДДЕРЖКА`,
    `  Фаза: ${COURSE_PHASES.find(p => p.id === settings.phase)?.label || 'База'}`,
    `  Препараты: ${medsList}`, `  БАДы: ${suppsList}`,
    ...(riskData?.systemSupport ? RISK_SYSTEMS.filter(sys => riskData.systemSupport[sys] !== undefined).map(sys => `    ${sys}: покрытие ${Math.round(riskData.systemSupport[sys])}%`) : []),
    `  Покрытие поддержки: ${riskData?.totalSupport ? Math.round(riskData.totalSupport) + '%' : '—'}`, '',
    `АНАЛИЗЫ`, `  ${labsList}`, '', `РИСК`,
    `  Общий: ${riskData?.overallNet || '—'}%`,
    ...(riskData?.systemBreakdown ? RISK_SYSTEMS.filter(sys => riskData.systemBreakdown[sys]?.net > 0).map(sys => `  ${sys}: ${riskData.systemBreakdown[sys].net}%`) : []),
    '', `ЗАМЕРЫ (последние 3)`, measSummary, '',
    `ЗДОРОВЬЕ`, `  Кровь: ${settings.bloodType || '—'} | Хроника: ${chronicList}`,
    `  Экстренный: ${settings.emergencyName || '—'} / ${settings.emergencyPhone || '—'}`, '',
    `  Дата: ${new Date().toLocaleDateString('ru')}`, `═`.repeat(40),
  ].join('\n');

  const copyReport = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.showPopup) tg.showPopup({ title: 'Скопировано', message: 'Отчёт скопирован в буфер обмена' });
    });
  };

  const reportData: ReportData = {
    profile: { name: profileName || '', age: settings.age || '', sex: settings.sex || 'male', weight: settings.weight || '', height: settings.height || '', bodyFat: settings.bodyFat || '', bloodType: settings.bloodType || '', allergyNotes: settings.allergyNotes || '', emergencyName: settings.emergencyName || '', emergencyPhone: settings.emergencyPhone || '' },
    training: { experience: String(settings.trainingExperience || ''), level: settings.trainingLevel || '', sport: SPORT_TYPES.find(s => s.id === settings.sportType)?.label || '', goal: goalLabelR, workoutsPerWeek: String(settings.workoutsPerWeek || ''), avgWorkoutMinutes: String(settings.avgWorkoutMinutes || ''), programName, currentSplit: workoutLogs.length > 0 ? (workoutLogs[0].split || 'не указан') : 'не указан', lastWorkoutDate: workoutLogs.length > 0 ? workoutLogs[0].date : 'нет записей', weekVolume: (() => { const last7 = new Date(Date.now() - 7*86400000).toISOString().split('T')[0]; const wkLogs = workoutLogs.filter(w => w.date >= last7); const wkVol = wkLogs.reduce((s, w) => s + (w.exercises??[]).reduce((ss, e) => ss + (e.totalVolume ?? 0), 0), 0); return wkVol > 0 ? `${wkVol.toFixed(0)} кг` : 'нет данных'; })(), lastWorkouts: workoutSummary },
    body: { bmi: String(bmiVal), ffmi: String(ffmiVal), lbm: String(lbmVal), targetWeight: String(settings.targetWeight || '') },
    course: { phase: COURSE_PHASES.find(p => p.id === settings.phase)?.label || 'База', medsList, suppsList, courseStartDate: settings.courseStartDate },
    risk: riskData,
    labs: { list: labsList, recentList: labs.length > 0 ? labs.sort((a: LabPoint, b: LabPoint) => b.date.localeCompare(a.date)).slice(0, 5).map(l => `${l.code} ${l.value}${l.unit} (${l.date})`).join(', ') : 'нет данных' },
    nutrition: { dietType: '', mealsPerDay: String(settings.mealsPerDay || ''), avgKcal: foodDiaryAvg?.avgKcal ? String(foodDiaryAvg.avgKcal) : undefined, avgProtein: foodDiaryAvg?.avgProtein ? String(foodDiaryAvg.avgProtein) : undefined, avgFat: foodDiaryAvg?.avgFat ? String(foodDiaryAvg.avgFat) : undefined, avgCarbs: foodDiaryAvg?.avgCarbs ? String(foodDiaryAvg.avgCarbs) : undefined },
    measurements: measSummary,
    chronic: chronicList,
    weightLogCount: weightLog.length,
    workoutSummary,
    last3Meas: measSummary,
    foodDiaryAvg: foodDiaryAvg || null,
  };

  const setReportTabAndSave = (tab: 'current' | 'archive') => setReportTab(tab);

  return (
    <div>
      <div style={{ display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none', marginBottom:10, paddingBottom:2 }}>
        {([
          { id: 'reports' as const, label: '📊 Сводные отчёты' },
          { id: 'pharma_reports' as const, label: '💊 Фарма-отчёты' },
        ]).map(t => (
          <button key={t.id} onClick={() => setAnalyticsSubTab(t.id)} style={{
            padding:'5px 12px', borderRadius:18, fontSize:10, fontWeight:600, whiteSpace:'nowrap',
            cursor:'pointer', flexShrink:0,
            background: analyticsSubTab === t.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)',
            border: analyticsSubTab === t.id ? '1px solid rgba(0,230,138,0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: analyticsSubTab === t.id ? '#00e68a' : 'rgba(255,255,255,0.6)',
            transition:'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      {analyticsSubTab === 'reports' && (
        <ProfessionalReports
          data={reportData}
          reportTab={reportTab}
          onTabChange={setReportTabAndSave}
          showCustomReport={showCustomReport}
          onCustomReportToggle={() => setShowCustomReport(!showCustomReport)}
          onSaveReport={(type, text) => {
            try {
              const rep = { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), type, text, timestamp: Date.now() };
              const archive = JSON.parse(localStorage.getItem('he_profile_reports') || '[]');
              archive.unshift(rep);
              localStorage.setItem('he_profile_reports', JSON.stringify(archive.slice(0, 30)));
            } catch {}
          }}
        />
      )}
      {analyticsSubTab === 'pharma_reports' && <PharmaBlockReports />}
    </div>
  );
};
