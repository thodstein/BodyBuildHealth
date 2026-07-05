import React, { useState } from 'react';

// ── Types ──
export interface ReportData {
  profile: { name: string; age: number | string; sex: string; weight: number | string; height: number | string; bodyFat: number | string; bloodType: string; allergyNotes: string; emergencyName: string; emergencyPhone: string; };
  training: { experience: string; level: string; sport: string; goal: string; workoutsPerWeek: number | string; avgWorkoutMinutes: number | string; programName: string; currentSplit: string; lastWorkoutDate: string; weekVolume: string; lastWorkouts: string; };
  body: { bmi: string; ffmi: string; lbm: string; targetWeight: string; };
  course: { phase: string; medsList: string; suppsList: string; courseStartDate?: string; };
  risk: any;
  labs: { list: string; recentList: string; };
  nutrition: { dietType: string; mealsPerDay: string; avgKcal?: string; avgProtein?: string; avgFat?: string; avgCarbs?: string; };
  measurements: string;
  chronic: string;
  weightLogCount: number;
  workoutSummary: string;
  last3Meas: string;
  foodDiaryAvg: { avgKcal: number; avgProtein: number; avgFat: number; avgCarbs: number; } | null;
}

const RISK_SYSTEMS = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal'] as const;
const SYS_LABELS: Record<string, string> = {
  cardio: 'ССС', hepatic: 'Печень', renal: 'Почки', neuro: 'НС',
  endocrine: 'Эндокринная', hematologic: 'Кровь', reproductive: 'Репрод.', musculoskeletal: 'Опорно-дв.',
};
const SYS_FULL: Record<string, string> = {
  cardio: 'Сердечно-сосудистая', hepatic: 'Гепатобилиарная', renal: 'Мочевыделительная', neuro: 'Нервная',
  endocrine: 'Эндокринная', hematologic: 'Гематологическая', reproductive: 'Репродуктивная', musculoskeletal: 'Опорно-двигательная',
};
const SYS_COLORS: Record<string, string> = {
  cardio: '#ef4444', hepatic: '#f59e0b', renal: '#3b82f6', neuro: '#8b5cf6',
  endocrine: '#ec4899', hematologic: '#f97316', reproductive: '#06b6d4', musculoskeletal: '#22c55e',
};
const STATUS_COLORS = { low: '#22c55e', moderate: '#f59e0b', elevated: '#f97316', high: '#ef4444', critical: '#dc2626' };

function riskLevel(pct: number): { label: string; color: string; bg: string } {
  if (pct < 15) return { label: 'Низкий', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' };
  if (pct < 30) return { label: 'Умеренный', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' };
  if (pct < 50) return { label: 'Повышенный', color: '#f97316', bg: 'rgba(249,115,22,0.08)' };
  if (pct < 70) return { label: 'Высокий', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' };
  return { label: 'Критический', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' };
}

// ── Styled sub-components ──

const JournalPaper: React.FC<{ children: React.ReactNode; accentColor?: string; style?: React.CSSProperties }> = ({ children, accentColor, style }) => (
  <div style={{
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.06)',
    borderLeft: accentColor ? `4px solid ${accentColor}` : undefined,
    overflow: 'hidden',
    ...style,
  }}>
    {children}
  </div>
);

const ReportHeader: React.FC<{ icon: string; title: string; subtitle: string; color: string; }> = ({ icon, title, subtitle, color }) => (
  <div style={{
    padding: '18px 20px 14px',
    borderBottom: `1px solid ${color}20`,
    background: `${color}08`,
    display: 'flex', alignItems: 'flex-start', gap: 12,
  }}>
    <span style={{ fontSize: 28 }}>{icon}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color, letterSpacing: '-0.3px' }}>{title}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{subtitle}</div>
    </div>
    <div style={{
      padding: '4px 10px', borderRadius: 20, fontSize: 9, fontWeight: 700,
      background: `${color}15`, color,
    }}>{new Date().toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </div>
);

const SectionBlock: React.FC<{ title: string; icon?: string; color?: string; children: React.ReactNode; }> = ({ title, icon, color, children }) => (
  <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
    <div style={{
      fontSize: 11, fontWeight: 700, color: color || 'rgba(255,255,255,0.7)',
      marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 20px',
    }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.8px', fontSize: 10 }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)', marginLeft: 8 }} />
    </div>
    <div style={{ padding: '0 20px' }}>{children}</div>
  </div>
);

const DataRow: React.FC<{ label: string; value: string; color?: string; }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
    <span style={{ fontSize: 10, fontWeight: 600, color: color || 'rgba(255,255,255,0.9)', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
  </div>
);

const Badge: React.FC<{ text: string; color: string; bg: string; }> = ({ text, color, bg }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700,
    background: bg, color, whiteSpace: 'nowrap',
  }}>{text}</span>
);

const RiskBar: React.FC<{ pct: number; label: string; }> = ({ pct, label }) => {
  const rl = riskLevel(pct);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: rl.color }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 2, background: rl.color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; unit?: string; color?: string; sub?: string; }> = ({ label, value, unit, color, sub }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px',
    border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center',
  }}>
    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 800, color: color || '#fff', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
      {value}{unit && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 2, color: 'rgba(255,255,255,0.4)' }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{sub}</div>}
  </div>
);

// ── Generate formatted report text (for copy/share) ──

function formatTrainerText(data: ReportData): string {
  const lines: string[] = [];
  lines.push('══════════════════════════════════════════');
  lines.push('  ОТЧЁТ ДЛЯ ТРЕНЕРА');
  lines.push('  BodyBuildHealth — Профессиональная аналитика');
  lines.push('══════════════════════════════════════════');
  lines.push('');
  lines.push('▎АТЛЕТ');
  lines.push(`  ${data.profile.name || '—'}`);
  lines.push(`  ${data.profile.age} лет · ${data.profile.sex === 'male' ? 'муж' : 'жен'}`);
  lines.push(`  Вес: ${data.profile.weight} кг · Рост: ${data.profile.height} см`);
  lines.push(`  BMI: ${data.body.bmi} · FFMI: ${data.body.ffmi} · BF: ${data.profile.bodyFat}%`);
  lines.push('');
  lines.push('▎ЦЕЛЬ И ОПЫТ');
  lines.push(`  Цель: ${data.training.goal}`);
  lines.push(`  Стаж: ${data.training.experience} лет · Уровень: ${data.training.level}`);
  lines.push(`  Спорт: ${data.training.sport}`);
  lines.push('');
  lines.push('▎ТРЕНИРОВОЧНЫЕ ПАРАМЕТРЫ');
  lines.push(`  Частота: ${data.training.workoutsPerWeek}×/нед · Длит.: ${data.training.avgWorkoutMinutes} мин`);
  lines.push(`  Объём/нед: ~${(Number(data.training.workoutsPerWeek) || 0) * (Number(data.training.avgWorkoutMinutes) || 0)} мин`);
  lines.push(`  Программа: ${data.training.programName}`);
  lines.push(`  Сплит: ${data.training.currentSplit}`);
  lines.push(`  Объём за нед: ${data.training.weekVolume}`);
  lines.push(`  Посл. трен.: ${data.training.lastWorkoutDate}`);
  lines.push('');
  lines.push('▎ПОСЛЕДНИЕ ТРЕНИРОВКИ');
  lines.push(data.training.lastWorkouts);
  lines.push('');
  lines.push('▎ФАЗА КУРСА');
  lines.push(`  ${data.course.phase}${data.course.courseStartDate ? ` (с ${data.course.courseStartDate})` : ''}`);
  if (data.course.medsList && data.course.medsList !== 'нет') lines.push(`  Препараты: ${data.course.medsList}`);
  lines.push('');
  lines.push('▎ПРОГРЕСС ВЕСА');
  lines.push(`  Тек: ${data.profile.weight} кг · Цель: ${data.body.targetWeight} кг`);
  lines.push(`  Записей: ${data.weightLogCount}`);
  lines.push('');
  lines.push('▎РЕКОМЕНДАЦИИ ТРЕНЕРА');
  lines.push('  (заполняется тренером)');
  lines.push('  ▸ Объём: ________________________________');
  lines.push('  ▸ Частота: ______________________________');
  lines.push('  ▸ Слабые группы: ________________________');
  lines.push('  ▸ Коррекция техники: ____________________');
  lines.push('  ▸ Примечания: ___________________________');
  lines.push('');
  lines.push(`  Дата: ${new Date().toLocaleDateString('ru')}`);
  lines.push('══════════════════════════════════════════');
  return lines.join('\n');
}

function formatDoctorText(data: ReportData): string {
  const lines: string[] = [];
  lines.push('══════════════════════════════════════════');
  lines.push('  МЕДИЦИНСКИЙ ОТЧЁТ');
  lines.push('  BodyBuildHealth — Клиническая оценка');
  lines.push('══════════════════════════════════════════');
  lines.push('');
  lines.push('▎ПАЦИЕНТ');
  lines.push(`  ${data.profile.name || '—'}`);
  lines.push(`  ${data.profile.age} лет · ${data.profile.sex === 'male' ? 'мужской' : 'женский'} пол`);
  lines.push(`  Группа крови: ${data.profile.bloodType || '—'}`);
  lines.push(`  Вес: ${data.profile.weight} кг · Рост: ${data.profile.height} см · BMI: ${data.body.bmi}`);
  lines.push(`  Аллергии: ${data.profile.allergyNotes || 'нет'}`);
  lines.push('');
  lines.push('▎ЛАБОРАТОРНЫЕ ДАННЫЕ');
  lines.push(`  ${data.labs.list || 'нет данных'}`);
  lines.push(`  Последние: ${data.labs.recentList || 'нет данных'}`);
  lines.push('');
  lines.push('▎СТРАТИФИКАЦИЯ РИСКОВ');
  if (data.risk?.systemBreakdown) {
    for (const sys of RISK_SYSTEMS) {
      const v = data.risk.systemBreakdown[sys];
      const pct = v?.net !== undefined ? `${v.net}%` : '—';
      const rl = riskLevel(v?.net || 0);
      lines.push(`  ${(SYS_FULL[sys] || sys).padEnd(20)} ${pct.padEnd(6)} ${rl.label}`);
    }
  } else {
    lines.push('  — нет данных');
  }
  lines.push(`  Общий риск: ${data.risk?.overallNet || '—'}%`);
  lines.push('');
  lines.push('▎ФАРМАКОТЕРАПИЯ');
  lines.push(`  Препараты: ${data.course.medsList || 'нет'}`);
  lines.push(`  БАДы: ${data.course.suppsList || 'нет'}`);
  if (data.risk?.systemSupport) {
    for (const sys of RISK_SYSTEMS) {
      if (data.risk.systemSupport[sys] !== undefined) {
        lines.push(`  ${(SYS_FULL[sys] || sys)}: покрытие ${Math.round(data.risk.systemSupport[sys])}%`);
      }
    }
  }
  lines.push(`  Общее покрытие: ${data.risk?.totalSupport ? Math.round(data.risk.totalSupport) + '%' : '—'}`);
  lines.push('');
  lines.push('▎ХРОНИЧЕСКИЕ ЗАБОЛЕВАНИЯ');
  lines.push(`  ${data.chronic || 'нет'}`);
  lines.push('');
  lines.push('▎КЛИНИЧЕСКИЕ РЕКОМЕНДАЦИИ');
  lines.push('  (заполняется врачом)');
  lines.push('  ▸ Лабораторный контроль: _________________');
  lines.push('  ▸ Коррекция терапии: ____________________');
  lines.push('  ▸ Доп. обследования: ____________________');
  lines.push('  ▸ Противопоказания: _____________________');
  lines.push('  ▸ Заключение: ___________________________');
  lines.push('');
  lines.push('▎ЭКСТРЕННЫЙ КОНТАКТ');
  lines.push(`  ${data.profile.emergencyName || '—'} / ${data.profile.emergencyPhone || '—'}`);
  lines.push('');
  lines.push(`  Дата: ${new Date().toLocaleDateString('ru')}`);
  lines.push('══════════════════════════════════════════');
  return lines.join('\n');
}

function formatGeneralText(data: ReportData): string {
  const lines: string[] = [];
  lines.push('══════════════════════════════════════════');
  lines.push('  СВОДНЫЙ ОТЧЁТ');
  lines.push('  BodyBuildHealth — Комплексная оценка');
  lines.push('══════════════════════════════════════════');
  lines.push('');
  lines.push('▎ПРОФИЛЬ');
  lines.push(`  ${data.profile.name || '—'} · ${data.profile.age} лет · ${data.profile.sex === 'male' ? 'М' : 'Ж'}`);
  lines.push(`  Вес: ${data.profile.weight} кг · Рост: ${data.profile.height} см · BMI: ${data.body.bmi}`);
  lines.push(`  FFMI: ${data.body.ffmi} · BF: ${data.profile.bodyFat}%`);
  lines.push('');
  lines.push('▎ТРЕНИРОВКИ');
  lines.push(`  Спорт: ${data.training.sport} · Стаж: ${data.training.experience} лет`);
  lines.push(`  Уровень: ${data.training.level} · Цель: ${data.training.goal}`);
  lines.push(`  ${data.training.workoutsPerWeek}×/нед × ${data.training.avgWorkoutMinutes} мин · Программа: ${data.training.programName}`);
  lines.push(`  Объём за нед: ${data.training.weekVolume}`);
  lines.push('');
  lines.push('▎ПИТАНИЕ');
  lines.push(`  Тип: ${data.nutrition.dietType} · Приёмы: ${data.nutrition.mealsPerDay}/день`);
  if (data.nutrition.avgKcal) lines.push(`  Среднее: ${data.nutrition.avgKcal} ккал · Б:${data.nutrition.avgProtein}г · Ж:${data.nutrition.avgFat}г · У:${data.nutrition.avgCarbs}г`);
  const nRep = (() => { try { const r = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]')[0]; if (!r) return null; return r; } catch { return null; } })();
  if (nRep) lines.push(`  Оценка: ${nRep.overallGrade || '—'} · Качество: ${nRep.foodQualityScore || '—'}/10`);
  lines.push('');
  lines.push('▎ФАРМАКОЛОГИЯ');
  lines.push(`  Фаза: ${data.course.phase} · Препараты: ${data.course.medsList}`);
  lines.push(`  БАДы: ${data.course.suppsList}`);
  if (data.risk?.systemSupport) {
    for (const sys of RISK_SYSTEMS) {
      if (data.risk.systemSupport[sys] !== undefined) lines.push(`  ${SYS_LABELS[sys]}: покрытие ${Math.round(data.risk.systemSupport[sys])}%`);
    }
  }
  lines.push(`  Покрытие: ${data.risk?.totalSupport ? Math.round(data.risk.totalSupport) + '%' : '—'}`);
  lines.push('');
  lines.push('▎РИСКИ');
  lines.push(`  Общий: ${data.risk?.overallNet || '—'}%`);
  if (data.risk?.systemBreakdown) {
    for (const sys of RISK_SYSTEMS) {
      if (data.risk.systemBreakdown[sys]?.net > 0) lines.push(`  ${SYS_LABELS[sys]}: ${data.risk.systemBreakdown[sys].net}%`);
    }
  }
  lines.push('');
  lines.push('▎ЗАМЕРЫ');
  lines.push(data.last3Meas || 'нет данных');
  lines.push('');
  lines.push('▎ЗДОРОВЬЕ');
  lines.push(`  Кровь: ${data.profile.bloodType || '—'} · Хроника: ${data.chronic}`);
  lines.push(`  Экстренный: ${data.profile.emergencyName || '—'} / ${data.profile.emergencyPhone || '—'}`);
  lines.push('');
  lines.push(`  Дата: ${new Date().toLocaleDateString('ru')}`);
  lines.push('══════════════════════════════════════════');
  return lines.join('\n');
}

// ── Visual Report Components ──

const TrainerReportCard: React.FC<{ data: ReportData; onCopy: (t: string) => void; onSend: (t: string) => void; onPrint: (t: string, title: string) => void; }> = ({ data, onCopy, onSend, onPrint }) => {
  const text = formatTrainerText(data);
  return (
    <JournalPaper accentColor="#3b82f6">
      <ReportHeader icon="🏋️" title="Отчёт для тренера" subtitle="Атлетический профиль · Тренировочная аналитика · Рекомендации" color="#3b82f6" />

      <SectionBlock title="Атлет" icon="👤" color="#3b82f6">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          <DataRow label="Имя" value={data.profile.name || '—'} />
          <DataRow label="Возраст" value={`${data.profile.age} лет`} />
          <DataRow label="Пол" value={data.profile.sex === 'male' ? 'Мужской' : 'Женский'} />
          <DataRow label="Вес" value={`${data.profile.weight} кг`} />
          <DataRow label="Рост" value={`${data.profile.height} см`} />
          <DataRow label="Целевой вес" value={`${data.body.targetWeight} кг`} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
          <MetricCard label="BMI" value={data.body.bmi} color="#3b82f6" />
          <MetricCard label="FFMI" value={data.body.ffmi} color="#8b5cf6" sub="Индекс сухой массы" />
          <MetricCard label="BF%" value={`${data.profile.bodyFat}%`} color="#f59e0b" sub="Жировая масса" />
        </div>
      </SectionBlock>

      <SectionBlock title="Тренировочные параметры" icon="📊" color="#3b82f6">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          <DataRow label="Цель" value={data.training.goal} />
          <DataRow label="Спорт" value={data.training.sport} />
          <DataRow label="Стаж" value={`${data.training.experience} лет`} />
          <DataRow label="Уровень" value={data.training.level} />
          <DataRow label="Частота" value={`${data.training.workoutsPerWeek}×/нед`} />
          <DataRow label="Длительность" value={`${data.training.avgWorkoutMinutes} мин`} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
          <MetricCard label="Объём/нед" value={`${(Number(data.training.workoutsPerWeek) || 0) * (Number(data.training.avgWorkoutMinutes) || 0)}`} unit="мин" color="#3b82f6" />
          <MetricCard label="Программа" value={data.training.programName} color="rgba(255,255,255,0.8)" />
          <MetricCard label="Сплит" value={data.training.currentSplit} color="rgba(255,255,255,0.8)" />
        </div>
        {data.training.lastWorkouts && data.training.lastWorkouts !== '  — нет записей' && (
          <div style={{ marginTop: 10, fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {data.training.lastWorkouts}
          </div>
        )}
      </SectionBlock>

      <SectionBlock title="Фаза курса" icon="💊" color="#3b82f6">
        <DataRow label="Текущая фаза" value={data.course.phase} color="#3b82f6" />
        {data.course.courseStartDate && <DataRow label="Начало курса" value={data.course.courseStartDate} />}
        {data.course.medsList && data.course.medsList !== 'нет' && <DataRow label="Препараты" value={data.course.medsList} />}
      </SectionBlock>

      <SectionBlock title="Прогресс веса" icon="⚖️" color="#3b82f6">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <MetricCard label="Текущий" value={`${data.profile.weight}`} unit="кг" color="#3b82f6" />
          <MetricCard label="Целевой" value={`${data.body.targetWeight}`} unit="кг" color="rgba(255,255,255,0.6)" />
          <MetricCard label="Записей" value={`${data.weightLogCount}`} color="rgba(255,255,255,0.6)" />
        </div>
      </SectionBlock>

      <SectionBlock title="Рекомендации тренера" icon="📝" color="rgba(255,255,255,0.5)">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', lineHeight: 2 }}>
          ▸ Объём: ________________________________<br />
          ▸ Частота: ______________________________<br />
          ▸ Слабые группы: ________________________<br />
          ▸ Коррекция техники: ____________________<br />
          ▸ Примечания: ___________________________
        </div>
      </SectionBlock>

      <div style={{ padding: '12px 20px', display: 'flex', gap: 8 }}>
        <button onClick={() => onCopy(text)} style={btnSecondary}>📋 Копировать</button>
        <button onClick={() => onPrint(text, 'Отчёт для тренера')} style={btnSecondary}>🖨 Печать</button>
        <button onClick={() => onSend(text)} style={{ ...btnPrimary, background: '#3b82f6' }}>📤 Отправить</button>
      </div>
    </JournalPaper>
  );
};

const DoctorReportCard: React.FC<{ data: ReportData; onCopy: (t: string) => void; onSend: (t: string) => void; onPrint: (t: string, title: string) => void; }> = ({ data, onCopy, onSend, onPrint }) => {
  const text = formatDoctorText(data);
  return (
    <JournalPaper accentColor="#ef4444">
      <ReportHeader icon="🏥" title="Медицинский отчёт" subtitle="Клиническая оценка · Лабораторные данные · Стратификация рисков" color="#ef4444" />

      <SectionBlock title="Пациент" icon="👤" color="#ef4444">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          <DataRow label="Имя" value={data.profile.name || '—'} />
          <DataRow label="Возраст" value={`${data.profile.age} лет`} />
          <DataRow label="Пол" value={data.profile.sex === 'male' ? 'Мужской' : 'Женский'} />
          <DataRow label="Группа крови" value={data.profile.bloodType || '—'} color="#ef4444" />
          <DataRow label="Вес" value={`${data.profile.weight} кг`} />
          <DataRow label="Рост" value={`${data.profile.height} см`} />
          <DataRow label="BMI" value={data.body.bmi} />
          <DataRow label="Аллергии" value={data.profile.allergyNotes || 'Нет'} color={data.profile.allergyNotes ? '#f59e0b' : undefined} />
        </div>
      </SectionBlock>

      <SectionBlock title="Лабораторные данные" icon="🩸" color="#ef4444">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {data.labs.list || 'Нет данных'}
        </div>
        {data.labs.recentList && data.labs.recentList !== 'нет данных' && (
          <div style={{ marginTop: 8, fontSize: 8, color: 'rgba(255,255,255,0.45)' }}>
            Последние: {data.labs.recentList}
          </div>
        )}
      </SectionBlock>

      <SectionBlock title="Стратификация рисков" icon="⚠️" color="#ef4444">
        {data.risk?.overallNet !== undefined && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Общий риск</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: riskLevel(data.risk.overallNet).color }}>
                {Math.round(data.risk.overallNet)}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, data.risk.overallNet)}%`, borderRadius: 3, background: riskLevel(data.risk.overallNet).color }} />
            </div>
          </div>
        )}
        {data.risk?.systemBreakdown ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            {RISK_SYSTEMS.map(sys => {
              const v = data.risk.systemBreakdown[sys];
              const pct = v?.net ?? 0;
              const rl = riskLevel(pct);
              return (
                <div key={sys} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Badge text={SYS_LABELS[sys] || sys} color={SYS_COLORS[sys]} bg={`${SYS_COLORS[sys]}15`} />
                  <div style={{ flex: 1, height: 3, borderRadius: 1.5, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 1.5, background: rl.color }} />
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 700, color: rl.color, width: 24, textAlign: 'right' }}>{Math.round(pct)}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Нет данных о рисках</div>
        )}
      </SectionBlock>

      <SectionBlock title="Фармакотерапия" icon="💊" color="#ef4444">
        <DataRow label="Препараты" value={data.course.medsList || 'Нет'} />
        <DataRow label="БАДы и поддержка" value={data.course.suppsList || 'Нет'} />
        {data.risk?.systemSupport && (
          <div style={{ marginTop: 8 }}>
            {RISK_SYSTEMS.filter(sys => data.risk.systemSupport[sys] !== undefined).map(sys => (
              <RiskBar key={sys} pct={data.risk.systemSupport[sys]} label={`${SYS_FULL[sys] || sys} (покрытие)`} />
            ))}
          </div>
        )}
        <DataRow label="Общее покрытие" value={data.risk?.totalSupport ? `${Math.round(data.risk.totalSupport)}%` : '—'} color="#22c55e" />
      </SectionBlock>

      <SectionBlock title="Анамнез" icon="📋" color="#ef4444">
        <DataRow label="Хронические заболевания" value={data.chronic || 'Нет'} color={data.chronic && data.chronic !== 'нет' ? '#f59e0b' : undefined} />
        <DataRow label="Экстренный контакт" value={`${data.profile.emergencyName || '—'} / ${data.profile.emergencyPhone || '—'}`} />
      </SectionBlock>

      <SectionBlock title="Клинические рекомендации" icon="📝" color="rgba(255,255,255,0.5)">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', lineHeight: 2 }}>
          ▸ Лабораторный контроль: _________________<br />
          ▸ Коррекция терапии: ____________________<br />
          ▸ Доп. обследования: ____________________<br />
          ▸ Противопоказания: _____________________<br />
          ▸ Заключение: ___________________________
        </div>
      </SectionBlock>

      <div style={{ padding: '12px 20px', display: 'flex', gap: 8 }}>
        <button onClick={() => onCopy(text)} style={btnSecondary}>📋 Копировать</button>
        <button onClick={() => onPrint(text, 'Медицинский отчёт')} style={btnSecondary}>🖨 Печать</button>
        <button onClick={() => onSend(text)} style={{ ...btnPrimary, background: '#ef4444' }}>📤 Отправить</button>
      </div>
    </JournalPaper>
  );
};

const GeneralReportCard: React.FC<{ data: ReportData; onCopy: (t: string) => void; onSend: (t: string) => void; onPrint: (t: string, title: string) => void; }> = ({ data, onCopy, onSend, onPrint }) => {
  const text = formatGeneralText(data);
  return (
    <JournalPaper accentColor="#00e68a">
      <ReportHeader icon="📋" title="Сводный отчёт" subtitle="Комплексная оценка · Все системы · Рекомендации" color="#00e68a" />

      <SectionBlock title="Профиль" icon="👤" color="#00e68a">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <MetricCard label="Вес" value={`${data.profile.weight}`} unit="кг" color="#00e68a" />
          <MetricCard label="Рост" value={`${data.profile.height}`} unit="см" color="rgba(255,255,255,0.7)" />
          <MetricCard label="BF%" value={`${data.profile.bodyFat}%`} color="#f59e0b" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: 10 }}>
          <DataRow label="Имя" value={data.profile.name || '—'} />
          <DataRow label="Возраст / Пол" value={`${data.profile.age} лет / ${data.profile.sex === 'male' ? 'М' : 'Ж'}`} />
          <DataRow label="BMI" value={data.body.bmi} />
          <DataRow label="FFMI" value={data.body.ffmi} />
        </div>
      </SectionBlock>

      <SectionBlock title="Тренировки" icon="📊" color="#00e68a">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          <DataRow label="Спорт" value={data.training.sport} />
          <DataRow label="Цель" value={data.training.goal} />
          <DataRow label="Стаж / Уровень" value={`${data.training.experience} лет / ${data.training.level}`} />
          <DataRow label="Частота" value={`${data.training.workoutsPerWeek}×/нед × ${data.training.avgWorkoutMinutes} мин`} />
          <DataRow label="Программа" value={data.training.programName} />
          <DataRow label="Объём за нед" value={data.training.weekVolume} />
        </div>
      </SectionBlock>

      <SectionBlock title="Питание" icon="🥗" color="#00e68a">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          <DataRow label="Тип питания" value={data.nutrition.dietType} />
          <DataRow label="Приёмов/день" value={data.nutrition.mealsPerDay} />
        </div>
        {data.nutrition.avgKcal && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginTop: 8 }}>
            <MetricCard label="Ккал" value={data.nutrition.avgKcal} color="#f59e0b" />
            <MetricCard label="Белки" value={`${data.nutrition.avgProtein}г`} color="#3b82f6" />
            <MetricCard label="Жиры" value={`${data.nutrition.avgFat}г`} color="#ef4444" />
            <MetricCard label="Углеводы" value={`${data.nutrition.avgCarbs}г`} color="#22c55e" />
          </div>
        )}
        <NutritionSummaryCard />
      </SectionBlock>

      <SectionBlock title="Фармакология" icon="💊" color="#00e68a">
        <DataRow label="Фаза" value={data.course.phase} color="#00e68a" />
        <DataRow label="Препараты" value={data.course.medsList || 'Нет'} />
        <DataRow label="БАДы" value={data.course.suppsList || 'Нет'} />
        <DataRow label="Покрытие" value={data.risk?.totalSupport ? `${Math.round(data.risk.totalSupport)}%` : '—'} color="#22c55e" />
      </SectionBlock>

      <SectionBlock title="Риски" icon="⚠️" color="#00e68a">
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Общий риск</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: riskLevel(data.risk?.overallNet || 0).color }}>
              {data.risk?.overallNet ? `${Math.round(data.risk.overallNet)}%` : '—'}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, data.risk?.overallNet || 0)}%`, borderRadius: 3, background: riskLevel(data.risk?.overallNet || 0).color }} />
          </div>
        </div>
        {data.risk?.systemBreakdown && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {RISK_SYSTEMS.filter(sys => data.risk.systemBreakdown[sys]?.net > 0).map(sys => {
              const pct = data.risk.systemBreakdown[sys].net;
              const rl = riskLevel(pct);
              return <Badge key={sys} text={`${SYS_LABELS[sys]} ${Math.round(pct)}%`} color={rl.color} bg={rl.bg} />;
            })}
          </div>
        )}
      </SectionBlock>

      <SectionBlock title="Замеры" icon="📏" color="#00e68a">
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {data.last3Meas || 'Нет данных'}
        </div>
      </SectionBlock>

      <SectionBlock title="Здоровье" icon="❤️" color="#00e68a">
        <DataRow label="Группа крови" value={data.profile.bloodType || '—'} />
        <DataRow label="Хроника" value={data.chronic || 'Нет'} />
        <DataRow label="Экстренный" value={`${data.profile.emergencyName || '—'} / ${data.profile.emergencyPhone || '—'}`} />
      </SectionBlock>

      <div style={{ padding: '12px 20px', display: 'flex', gap: 8 }}>
        <button onClick={() => onCopy(text)} style={btnSecondary}>📋 Копировать</button>
        <button onClick={() => onPrint(text, 'Сводный отчёт')} style={btnSecondary}>🖨 Печать</button>
        <button onClick={() => onSend(text)} style={{ ...btnPrimary, background: '#00e68a', color: '#000' }}>📤 Отправить</button>
      </div>
    </JournalPaper>
  );
};

const NutritionSummaryCard: React.FC = () => {
  try {
    const reports = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]');
    if (reports.length === 0) return null;
    const r = reports[0];
    const gradeColor = r.overallGrade === 'A' ? '#22c55e' : r.overallGrade === 'B' ? '#8b5cf6' : r.overallGrade === 'C' ? '#f59e0b' : '#ef4444';
    return (
      <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>📋</span>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Оценка питания</div>
          <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 800, color: gradeColor }}>{r.overallGrade || '—'}</span>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{r.overallGradeLabel || ''} · {r.generatedAt?.slice(0, 10) || ''}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
          {[{ l: 'Ккал', v: r.kbjuPct?.kcal }, { l: 'Белки', v: r.kbjuPct?.p }, { l: 'Жиры', v: r.kbjuPct?.f }, { l: 'Угл.', v: r.kbjuPct?.c }].map(s => {
            const pctVal = Number(s.v) || 0;
            const ok = pctVal >= 85 && pctVal <= 115;
            return (
              <div key={s.l} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 6, padding: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', marginBottom: 2 }}>{s.l}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: ok ? '#22c55e' : pctVal >= 70 ? '#f59e0b' : '#ef4444' }}>{s.v || '—'}%</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.1)', borderRadius: 6, padding: '6px' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>Динамика веса</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: r.weightDynamicsBasic?.direction === 'loss' ? '#22c55e' : r.weightDynamicsBasic?.direction === 'gain' ? '#f59e0b' : '#fff' }}>
              {r.weightDynamicsBasic?.direction === 'loss' ? '−' : r.weightDynamicsBasic?.direction === 'gain' ? '+' : '∼'}{r.weightDynamicsBasic?.weeklyKg || '0'} кг/нед
            </div>
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.1)', borderRadius: 6, padding: '6px' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>Качество еды</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: (r.foodQualityScore || 0) >= 7 ? '#22c55e' : '#f59e0b' }}>{r.foodQualityScore || '—'}/10</div>
          </div>
        </div>
        {(r.microDeficiencies || []).length > 0 && (
          <div style={{ fontSize: 8, color: '#f59e0b', marginTop: 6, background: 'rgba(245,158,11,0.08)', borderRadius: 4, padding: '4px 8px' }}>
            Дефициты: {r.microDeficiencies.slice(0, 4).join(' · ')}
          </div>
        )}
      </div>
    );
  } catch { return null; }
};

const SupportSummaryCard: React.FC = () => {
  try {
    const reports = JSON.parse(localStorage.getItem('he_profile_support_reports') || '[]');
    if (reports.length === 0) return null;
    const r = reports[0];

    // Handle format: use what's available
    const date = r.date?.slice(0, 10) || r.timestamp ? new Date(r.timestamp).toISOString().slice(0, 10) : '—';
    const substanceCount = r.substanceCount ?? r.items?.length ?? '—';
    const interactionCount = r.interactionCount ?? '—';
    const level = r.level || '—';

    return (
      <div style={{ background: 'rgba(139,92,246,0.06)', borderRadius: 12, padding: 14, marginTop: 8, border: '1px solid rgba(139,92,246,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>🧩</span>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6' }}>Отчёт о поддержке</div>
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{date}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, background: 'rgba(139,92,246,0.06)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>Веществ</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#8b5cf6' }}>{substanceCount}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(0,230,138,0.06)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>Взаимодействий</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#00e68a' }}>{interactionCount}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>Уровень</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#3b82f6' }}>{level}</div>
          </div>
        </div>
      </div>
    );
  } catch { return null; }
};

// ── Archive View ──

const ArchiveView: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allArchives: any[] = [];
  try {
    const labReports = JSON.parse(localStorage.getItem('he_lab_reports') || '[]');
    const riskReports = JSON.parse(localStorage.getItem('he_risk_reports') || '[]');
    const courseReports = JSON.parse(localStorage.getItem('he_pharma_reports') || '[]');
    const trainingReports = JSON.parse(localStorage.getItem('he_training_reports') || '[]');
    const nutritionReports = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]');
    const profileReports = JSON.parse(localStorage.getItem('he_profile_reports') || '[]');
    allArchives.push(...labReports.map((r: any) => ({ ...r, block: 'Лаборатория', blockIcon: '🩸', blockColor: '#ef4444' })));
    allArchives.push(...riskReports.map((r: any) => ({ ...r, block: 'Риски', blockIcon: '⚠️', blockColor: '#f97316' })));
    allArchives.push(...courseReports.map((r: any) => ({ ...r, block: 'Курс', blockIcon: '💊', blockColor: '#ec4899' })));
    allArchives.push(...trainingReports.map((r: any) => ({ ...r, block: 'Тренировки', blockIcon: '🏋️', blockColor: '#3b82f6' })));
    allArchives.push(...nutritionReports.map((r: any) => ({ ...r, block: 'Питание', blockIcon: '🥗', blockColor: '#22c55e' })));
    allArchives.push(...profileReports.map((r: any) => ({ ...r, block: 'Профиль', blockIcon: '📄', blockColor: '#8b5cf6' })));
    allArchives.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch {}

  if (allArchives.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
        <div>Архив пуст</div>
        <div style={{ fontSize: 9, marginTop: 4 }}>Сгенерируйте отчёты в Лаборатории, Рисках, Курсе или Тренировках</div>
      </div>
    );
  }

  const renderArchiveDetail = (r: any) => {
    if (r.block === 'Лаборатория') {
      return (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          <div style={{ marginBottom: 4 }}>Маркеров: <b>{r.totalMarkers || 0}</b> · Отклонений: <b style={{ color: '#ef4444' }}>{r.abnormalCount || 0}</b></div>
          {(r.labs || []).slice(0, 10).map((l: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', minWidth: 60 }}>{l.code || l.name}</span>
              <span style={{ fontWeight: 600 }}>{l.value} {l.unit}</span>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 8 }}>{l.date}</span>
            </div>
          ))}
        </div>
      );
    }
    if (r.block === 'Риски') {
      return (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          <div>Общий риск: <b style={{ color: riskLevel(r.overallNet || 0).color }}>{Math.round(r.overallNet || 0)}%</b></div>
          <div>Без поддержки: <b>{Math.round(r.overallRaw || 0)}%</b></div>
          <div>Систем: {r.systems?.length || 0}</div>
          {(r.systems || []).slice(0, 8).map((s: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{SYS_LABELS[s.system] || s.system}</span>
              <span>raw: {Math.round(s.raw || 0)}%</span>
              <span style={{ color: '#22c55e' }}>net: {Math.round(s.net || 0)}%</span>
            </div>
          ))}
        </div>
      );
    }
    if (r.block === 'Курс') {
      return (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          <div>Препаратов: <b>{r.compoundCount || 0}</b> · Недель: <b>{r.totalWeeks || 0}</b></div>
          <div>Риск курса: <b style={{ color: riskLevel(r.risk || 0).color }}>{Math.round(r.risk || 0)}%</b></div>
          <div>ПКТ: {r.pctPlanned ? '✅ Запланирован' : '❌ Не запланирован'}</div>
          {(r.compounds || []).slice(0, 6).map((c: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 6, padding: '2px 0' }}>
              <span>{c.name || c.id}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{c.dose}{c.unit} · {c.freq}</span>
            </div>
          ))}
        </div>
      );
    }
    if (r.block === 'Тренировки') {
      return (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          <div>Цель: <b>{r.goal || '—'}</b> · Уровень: <b>{r.level || '—'}</b></div>
          <div>Дней/нед: <b>{r.daysPerWeek || '—'}</b> · Недель: <b>{r.planWeeks || '—'}</b></div>
          <div>Объём: <b>{r.totalVolume || '—'}</b> · Инт.: <b>{r.avgIntensity || '—'}</b></div>
          <div>Сплит: {r.splitType || '—'} · Периодизация: {r.periodizationType || '—'}</div>
        </div>
      );
    }
    if (r.block === 'Питание') {
      return (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          <div>Оценка: <b style={{ color: r.overallGrade === 'A' ? '#22c55e' : r.overallGrade === 'B' ? '#8b5cf6' : '#f59e0b' }}>{r.overallGrade || '—'}</b></div>
          <div>КБЖУ: {r.kbjuPct?.kcal || '—'}% / {r.kbjuPct?.p || '—'}% / {r.kbjuPct?.f || '—'}% / {r.kbjuPct?.c || '—'}%</div>
          <div>Качество: {r.foodQualityScore || '—'}/10</div>
          <div>Вес/нед: {r.weightDynamicsBasic?.weeklyKg || '—'} кг</div>
          {(r.microDeficiencies || []).length > 0 && <div style={{ color: '#f59e0b' }}>Дефициты: {r.microDeficiencies.slice(0, 4).join(' · ')}</div>}
        </div>
      );
    }
    if (r.block === 'Профиль') {
      return <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{String(r.text || '').slice(0, 1500)}</div>;
    }
    return <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap' }}>{JSON.stringify(r, null, 2).slice(0, 1000)}</div>;
  };

  const getSummary = (r: any): string => {
    if (r.overallNet !== undefined) return `${Math.round(r.overallNet)}%`;
    if (r.compoundCount) return `${r.compoundCount} преп.`;
    if (r.totalMarkers) return `${r.totalMarkers} марк.`;
    if (r.overallGrade) return r.overallGrade;
    if (r.exerciseCatalogCount) return `${r.totalVolume || '—'}`;
    if (r.text) return r.type || 'Отчёт';
    return '—';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {allArchives.slice(0, 80).map((r: any, i: number) => (
        <div key={r.id || i} onClick={() => setExpandedId(expandedId === r.id ? null : r.id)} style={{
          borderRadius: 10, padding: 10, cursor: 'pointer',
          background: expandedId === r.id ? 'rgba(0,230,138,0.04)' : 'rgba(24,24,27,0.1)',
          border: `1px solid ${expandedId === r.id ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.03)'}`,
          transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>{r.blockIcon || '📄'}</span>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: r.blockColor || '#00e68a' }}>{r.block}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>{r.date?.slice(0, 10) || '—'}</span>
              </div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: `${r.blockColor || '#00e68a'}12`, color: r.blockColor || '#00e68a' }}>
              {getSummary(r)}
            </span>
          </div>
          {expandedId === r.id && (
            <div style={{ marginTop: 8, padding: 10, background: 'rgba(0,0,0,0.15)', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
              {renderArchiveDetail(r)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Custom Report Popup ──

const CustomReportPopup: React.FC<{
  show: boolean;
  onClose: () => void;
  data: ReportData;
  onCopy: (t: string) => void;
}> = ({ show, onClose, data, onCopy }) => {
  const [blocks, setBlocks] = useState<Record<string, boolean>>({
    profile: true, training: true, nutrition: true, labs: true,
    pharma: true, risk: true, support: true, bp: true, sleep: true,
  });

  if (!show) return null;

  const blockOptions = [
    { key: 'profile', label: 'Профиль', icon: '👤', color: '#a78bfa' },
    { key: 'training', label: 'Тренировки', icon: '🏋️', color: '#3b82f6' },
    { key: 'nutrition', label: 'Питание', icon: '🥗', color: '#22c55e' },
    { key: 'labs', label: 'Анализы', icon: '🩸', color: '#ef4444' },
    { key: 'pharma', label: 'Курс', icon: '💊', color: '#ec4899' },
    { key: 'risk', label: 'Риски', icon: '⚠️', color: '#f97316' },
    { key: 'support', label: 'Поддержка', icon: '🧪', color: '#06b6d4' },
    { key: 'bp', label: 'Давление', icon: '❤️', color: '#f43f5e' },
    { key: 'sleep', label: 'Сон', icon: '🛌', color: '#8b5cf6' },
  ];

  const generateCustom = () => {
    const sections: string[] = [];
    if (blocks.profile) sections.push(`👤 Профиль:\n  Имя: ${data.profile.name || '—'} · ${data.profile.age} лет · ${data.profile.weight} кг · ${data.profile.height} см · BMI: ${data.body.bmi} · Цель: ${data.training.goal}`);
    if (blocks.training) sections.push(`🏋️ Тренировки:\n  Частота: ${data.training.workoutsPerWeek}/нед · Длит: ${data.training.avgWorkoutMinutes} мин · Программа: ${data.training.programName}\n${data.training.lastWorkouts}`);
    if (blocks.nutrition) sections.push(`🥗 Питание:\n  Ккал: ${data.nutrition.avgKcal || '—'} · Б: ${data.nutrition.avgProtein || '—'}г · Ж: ${data.nutrition.avgFat || '—'}г · У: ${data.nutrition.avgCarbs || '—'}г`);
    if (blocks.labs) sections.push(`🩸 Анализы:\n  ${data.labs.list || 'нет данных'}`);
    if (blocks.pharma) sections.push(`💊 Курс:\n  ${data.course.medsList || 'нет'}`);
    if (blocks.risk) sections.push(`⚠️ Риски:\n  Общий: ${data.risk?.overallNet || '—'}% · Без поддержки: ${data.risk?.overallRaw || '—'}%`);
    if (blocks.support) sections.push(`🧪 Поддержка:\n  ${data.course.suppsList || 'нет'}`);
    if (blocks.bp) {
      const bpd = (() => { try { return JSON.parse(localStorage.getItem('he_bp_diary') || '[]'); } catch { return []; } })();
      const lastBp = bpd[0];
      sections.push(`❤️ Давление:\n  ${lastBp ? `${lastBp.systolic}/${lastBp.diastolic} · Пульс: ${lastBp.hr} · ${lastBp.date}` : 'нет записей'} (всего: ${bpd.length} зап.)`);
    }
    if (blocks.sleep) {
      const sleepDiary = (() => { try { return JSON.parse(localStorage.getItem('he_sleep_diary') || '[]'); } catch { return []; } })();
      const avgHours = sleepDiary.length > 0 ? (sleepDiary.reduce((s: number, e: any) => s + e.hours, 0) / sleepDiary.length).toFixed(1) : '—';
      sections.push(`🛌 Сон:\n  Средняя длит: ${avgHours}ч · Записей: ${sleepDiary.length}`);
    }
    const text = sections.join('\n\n');
    const rep = { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), type: '🎨 Свой отчёт', text, timestamp: Date.now() };
    try {
      const archive = JSON.parse(localStorage.getItem('he_profile_reports') || '[]');
      archive.unshift(rep);
      localStorage.setItem('he_profile_reports', JSON.stringify(archive.slice(0, 30)));
    } catch {}
    onCopy(text);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#1a1a1e', borderRadius: 16, padding: 20, maxWidth: 380, width: '100%', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#fff' }}>🎨 Свой отчёт</h3>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', margin: '0 0 14px' }}>Выберите блоки для включения в отчёт</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
          {blockOptions.map(b => (
            <label key={b.key} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8,
              background: blocks[b.key] ? `${b.color}12` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${blocks[b.key] ? `${b.color}30` : 'rgba(255,255,255,0.06)'}`,
              cursor: 'pointer',
            }}>
              <input type="checkbox" checked={!!blocks[b.key]} onChange={() => setBlocks(prev => ({ ...prev, [b.key]: !prev[b.key] }))}
                style={{ width: 14, height: 14, accentColor: b.color, cursor: 'pointer', margin: 0 }} />
              <span style={{ fontSize: 12 }}>{b.icon}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{b.label}</span>
            </label>
          ))}
        </div>
        <button onClick={generateCustom} style={{
          width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, fontSize: 12,
        }}>📄 Сгенерировать отчёт</button>
      </div>
    </div>
  );
};

// ── Button Styles ──

const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 600, textAlign: 'center',
};

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
  border: 'none', color: '#fff', fontSize: 10, fontWeight: 600, textAlign: 'center',
};

// ── Main Export ──

export const ProfessionalReports: React.FC<{
  data: ReportData;
  reportTab: 'current' | 'archive';
  onTabChange: (t: 'current' | 'archive') => void;
  showCustomReport: boolean;
  onCustomReportToggle: (v: boolean) => void;
  onSaveReport: (type: string, text: string) => void;
}> = ({ data, reportTab, onTabChange, showCustomReport, onCustomReportToggle, onSaveReport }) => {
  const [activeReport, setActiveReport] = useState<'trainer' | 'doctor' | 'general' | null>(null);

  const copyReport = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.showPopup) tg.showPopup({ title: 'Скопировано', message: 'Отчёт скопирован в буфер обмена' });
    });
  };

  const sendReport = (text: string) => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.sendData) {
      tg.sendData(JSON.stringify({ type: 'share_report', report: text }));
    } else {
      copyReport(text);
    }
  };

  const printReport = (text: string, title: string) => {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px; line-height: 1.6; color: #111; padding: 20px; max-width: 700px; margin: 0 auto; }
        pre { white-space: pre-wrap; font-family: 'SF Mono', 'Consolas', monospace; font-size: 10px; }
        @media print { body { padding: 0; } }
      </style></head><body><pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`);
      w.document.close();
      setTimeout(() => w.print(), 300);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Sub-tab switches */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
        <button onClick={() => onTabChange('current')} style={{
          padding: '7px 16px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none',
          background: reportTab === 'current' ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
          color: reportTab === 'current' ? '#000' : 'rgba(255,255,255,0.8)',
        }}>📋 Текущие</button>
        <button onClick={() => onTabChange('archive')} style={{
          padding: '7px 16px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none',
          background: reportTab === 'archive' ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
          color: reportTab === 'archive' ? '#000' : 'rgba(255,255,255,0.8)',
        }}>📦 Архив</button>
      </div>

      {reportTab === 'archive' && <ArchiveView />}

      {reportTab === 'current' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Generate buttons — compact chips */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
            {[
              { label: '🏋️ Тренеру', color: '#3b82f6', key: 'trainer' as const },
              { label: '🏥 Врачу', color: '#ef4444', key: 'doctor' as const },
              { label: '📋 Общий', color: '#00e68a', key: 'general' as const },
              { label: '🎨 Свой', color: '#8b5cf6', key: 'custom' as const },
            ].map(btn => (
              <button key={btn.key} onClick={() => {
                if (btn.key === 'custom') { onCustomReportToggle(true); return; }
                setActiveReport(activeReport === btn.key ? null : btn.key);
                const text = btn.key === 'trainer' ? formatTrainerText(data)
                  : btn.key === 'doctor' ? formatDoctorText(data)
                  : formatGeneralText(data);
                onSaveReport(
                  btn.key === 'trainer' ? '🏋️ Тренеру' : btn.key === 'doctor' ? '🏥 Врачу' : '📋 Общий',
                  text
                );
              }} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 9, cursor: 'pointer', fontWeight: 600, border: 'none',
                background: activeReport === btn.key ? btn.color : `${btn.color}12`,
                color: btn.color, whiteSpace: 'nowrap',
              }}>{btn.key === 'custom' ? '🎨 Свой' : `📄 ${btn.label}`}</button>
            ))}
          </div>

          {/* Trainer Report */}
          {(!activeReport || activeReport === 'trainer') && (
            <TrainerReportCard data={data} onCopy={copyReport} onSend={sendReport} onPrint={printReport} />
          )}

          {/* Doctor Report */}
          {(!activeReport || activeReport === 'doctor') && (
            <DoctorReportCard data={data} onCopy={copyReport} onSend={sendReport} onPrint={printReport} />
          )}

          {/* General Report */}
          {(!activeReport || activeReport === 'general') && (
            <GeneralReportCard data={data} onCopy={copyReport} onSend={sendReport} onPrint={printReport} />
          )}

          {/* Nutrition card */}
          <NutritionSummaryCard />

          {/* Support card */}
          <SupportSummaryCard />

          {/* Custom report popup */}
          <CustomReportPopup show={showCustomReport} onClose={() => onCustomReportToggle(false)} data={data} onCopy={copyReport} />
        </div>
      )}
    </div>
  );
};

export default ProfessionalReports;
