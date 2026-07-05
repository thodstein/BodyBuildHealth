import React, { useState, useEffect } from 'react';

interface CustomUserReportProps {
  data: {
    profile: Record<string, any>;
    training: Record<string, any>;
    nutrition: Record<string, any>;
    labs: Record<string, any>;
    course: Record<string, any>;
    risk: Record<string, any>;
  };
  onCopy: (text: string) => void;
  onPrint: (text: string, title: string) => void;
  onSend: (text: string) => void;
  onSave: (type: string, text: string) => void;
}

interface SectionConfig {
  id: string;
  icon: string;
  label: string;
  color: string;
  fields: { key: string; label: string; defaultOn: boolean }[];
}

const SECTIONS: SectionConfig[] = [
  {
    id: 'profile', icon: '👤', label: 'Профиль', color: '#a78bfa',
    fields: [
      { key: 'name', label: 'Имя', defaultOn: true },
      { key: 'age', label: 'Возраст', defaultOn: true },
      { key: 'sex', label: 'Пол', defaultOn: true },
      { key: 'weight', label: 'Вес', defaultOn: true },
      { key: 'height', label: 'Рост', defaultOn: true },
      { key: 'bodyFat', label: '% жира', defaultOn: true },
      { key: 'bloodType', label: 'Группа крови', defaultOn: false },
      { key: 'bmi', label: 'BMI', defaultOn: true },
      { key: 'ffmi', label: 'FFMI', defaultOn: true },
      { key: 'lbm', label: 'Тощая масса', defaultOn: false },
      { key: 'targetWeight', label: 'Целевой вес', defaultOn: true },
      { key: 'allergy', label: 'Аллергии', defaultOn: false },
      { key: 'emergency', label: 'Экстренный контакт', defaultOn: false },
    ],
  },
  {
    id: 'training', icon: '🏋️', label: 'Тренировки', color: '#3b82f6',
    fields: [
      { key: 'sport', label: 'Вид спорта', defaultOn: true },
      { key: 'experience', label: 'Стаж', defaultOn: true },
      { key: 'level', label: 'Уровень', defaultOn: true },
      { key: 'goal', label: 'Цель', defaultOn: true },
      { key: 'frequency', label: 'Частота (дней/нед)', defaultOn: true },
      { key: 'duration', label: 'Длительность тренировки', defaultOn: true },
      { key: 'program', label: 'Программа', defaultOn: true },
      { key: 'split', label: 'Сплит', defaultOn: true },
      { key: 'weekVolume', label: 'Объём за неделю', defaultOn: true },
      { key: 'lastWorkouts', label: 'Последние тренировки', defaultOn: false },
      { key: 'lastDate', label: 'Дата последней', defaultOn: true },
    ],
  },
  {
    id: 'nutrition', icon: '🥗', label: 'Питание', color: '#22c55e',
    fields: [
      { key: 'dietType', label: 'Тип диеты', defaultOn: true },
      { key: 'mealsPerDay', label: 'Приёмов в день', defaultOn: true },
      { key: 'kcal', label: 'Калорийность (ср.)', defaultOn: true },
      { key: 'protein', label: 'Белки (ср.)', defaultOn: true },
      { key: 'fat', label: 'Жиры (ср.)', defaultOn: true },
      { key: 'carbs', label: 'Углеводы (ср.)', defaultOn: true },
      { key: 'qualityGrade', label: 'Оценка качества', defaultOn: true },
      { key: 'microDeficits', label: 'Дефициты микронутриентов', defaultOn: false },
      { key: 'weightDynamics', label: 'Динамика веса', defaultOn: true },
    ],
  },
  {
    id: 'labs', icon: '🩸', label: 'Анализы', color: '#ef4444',
    fields: [
      { key: 'markerList', label: 'Список маркеров', defaultOn: true },
      { key: 'recent', label: 'Последние маркеры', defaultOn: true },
      { key: 'abnormal', label: 'Отклонения', defaultOn: true },
      { key: 'liverStress', label: 'Печёночные маркеры', defaultOn: false },
      { key: 'kidneyStress', label: 'Почечные маркеры', defaultOn: false },
      { key: 'lipids', label: 'Липидный профиль', defaultOn: false },
      { key: 'hormones', label: 'Гормоны', defaultOn: false },
      { key: 'inflammation', label: 'Воспаление', defaultOn: false },
    ],
  },
  {
    id: 'course', icon: '💊', label: 'Курс / Фарма', color: '#ec4899',
    fields: [
      { key: 'phase', label: 'Фаза', defaultOn: true },
      { key: 'meds', label: 'Препараты', defaultOn: true },
      { key: 'supps', label: 'БАДы / Поддержка', defaultOn: true },
      { key: 'startDate', label: 'Дата начала', defaultOn: true },
      { key: 'supportCoverage', label: 'Покрытие поддержки', defaultOn: true },
      { key: 'supportReport', label: 'Отчёт поддержки', defaultOn: false },
    ],
  },
  {
    id: 'risk', icon: '⚠️', label: 'Риски', color: '#f97316',
    fields: [
      { key: 'overallNet', label: 'Общий риск (с подд.)', defaultOn: true },
      { key: 'overallRaw', label: 'Риск без поддержки', defaultOn: true },
      { key: 'systemBreakdown', label: 'По системам (детально)', defaultOn: true },
      { key: 'systemSupport', label: 'Покрытие по системам', defaultOn: true },
    ],
  },
  {
    id: 'bp', icon: '❤️', label: 'Давление', color: '#f43f5e',
    fields: [
      { key: 'lastReading', label: 'Последнее измерение', defaultOn: true },
      { key: 'avgSys', label: 'Среднее систолическое', defaultOn: true },
      { key: 'avgDia', label: 'Среднее диастолическое', defaultOn: true },
      { key: 'avgHr', label: 'Средний пульс', defaultOn: true },
      { key: 'trend', label: 'Тренд за неделю', defaultOn: false },
      { key: 'totalCount', label: 'Всего записей', defaultOn: true },
    ],
  },
  {
    id: 'sleep', icon: '🛌', label: 'Сон', color: '#8b5cf6',
    fields: [
      { key: 'avgHours', label: 'Средняя длительность', defaultOn: true },
      { key: 'avgQuality', label: 'Среднее качество', defaultOn: true },
      { key: 'trendHours', label: 'Тренд длительности', defaultOn: false },
      { key: 'totalCount', label: 'Всего записей', defaultOn: true },
    ],
  },
  {
    id: 'measurements', icon: '📏', label: 'Замеры', color: '#06b6d4',
    fields: [
      { key: 'last3', label: 'Последние 3 замера', defaultOn: true },
      { key: 'waist', label: 'Талия', defaultOn: true },
      { key: 'chest', label: 'Грудь', defaultOn: true },
      { key: 'bicep', label: 'Бицепс', defaultOn: true },
      { key: 'thigh', label: 'Бедро', defaultOn: true },
      { key: 'hip', label: 'Бёдра', defaultOn: false },
      { key: 'neck', label: 'Шея', defaultOn: false },
    ],
  },
  {
    id: 'health', icon: '🩺', label: 'Здоровье', color: '#14b8a6',
    fields: [
      { key: 'chronic', label: 'Хронические заболевания', defaultOn: true },
      { key: 'allergies', label: 'Аллергии', defaultOn: true },
      { key: 'emergencyContact', label: 'Экстренный контакт', defaultOn: false },
    ],
  },
  {
    id: 'genetics', icon: '🧬', label: 'Генетика', color: '#6366f1',
    fields: [
      { key: 'snps', label: 'SNP-маркеры', defaultOn: true },
      { key: 'features', label: 'Генетические особенности', defaultOn: true },
    ],
  },
  {
    id: 'support', icon: '🧪', label: 'Поддержка (БАДы)', color: '#06b6d4',
    fields: [
      { key: 'suppsList', label: 'Список БАДов', defaultOn: true },
      { key: 'level', label: 'Уровень поддержки', defaultOn: true },
      { key: 'interactions', label: 'Взаимодействия', defaultOn: false },
      { key: 'synergies', label: 'Синергии', defaultOn: false },
    ],
  },
];

const styles: Record<string, any> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 8 },
  tabRow: { display: 'flex', gap: 4 },
  tab: (active: boolean) => ({
    padding: '7px 16px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none',
    background: active ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
    color: active ? '#000' : 'rgba(255,255,255,0.8)',
  }),
  cardGrid: (cols: number) => ({
    display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6,
  }),
  card: (active: boolean, color: string) => ({
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
    padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
    background: active ? `${color}15` : 'rgba(255,255,255,0.04)',
    border: `1px solid ${active ? `${color}35` : 'rgba(255,255,255,0.06)'}`,
    transition: 'all 0.15s',
  }),
  cardIcon: { fontSize: 22 },
  cardLabel: { fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.8)', textAlign: 'center' as const, lineHeight: 1.2 },
  popupOverlay: { position: 'fixed' as const, inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: 20 },
  popupBox: { background: '#1a1a1e', borderRadius: 16, padding: 20, maxWidth: 360, width: '100%', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '80vh', overflowY: 'auto' as const },
  popupTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' },
  popupSub: { fontSize: 9, color: 'rgba(255,255,255,0.5)', margin: '4px 0 14px' },
  fieldRow: (on: boolean, color: string) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, marginBottom: 4,
    background: on ? `${color}10` : 'transparent',
    border: `1px solid ${on ? `${color}25` : 'rgba(255,255,255,0.04)'}`,
    cursor: 'pointer',
  }),
  fieldCheckbox: { width: 16, height: 16, margin: 0, cursor: 'pointer' },
  fieldLabel: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 500, flex: 1 },
  fieldBadge: (on: boolean, color: string) => ({
    fontSize: 8, padding: '2px 6px', borderRadius: 10, fontWeight: 600,
    background: on ? `${color}20` : 'rgba(255,255,255,0.04)',
    color: on ? color : 'rgba(255,255,255,0.3)',
  }),
  btnPrimary: {
    width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg,#00e68a,#00c8a0)', color: '#000', fontWeight: 700, fontSize: 12,
  },
  reportBlock: { background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12, marginBottom: 6, borderLeft: '3px solid' },
  actionRow: { display: 'flex', gap: 6, marginTop: 8 },
  btnSecondary: {
    flex: 1, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 600, textAlign: 'center' as const,
  },
  emptyState: { textAlign: 'center' as const, padding: 30, color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.8 },
};

const PopupFieldList: React.FC<{
  section: SectionConfig;
  selected: Set<string>;
  onToggle: (key: string) => void;
  onClose: () => void;
}> = ({ section, selected, onToggle, onClose }) => (
  <div style={styles.popupOverlay} onClick={onClose}>
    <div style={styles.popupBox} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 22 }}>{section.icon}</span>
        <h3 style={styles.popupTitle}>{section.label}</h3>
      </div>
      <p style={styles.popupSub}>Выберите какие сведения включить в отчёт</p>
      {section.fields.map(f => {
        const on = selected.has(f.key);
        return (
          <div key={f.key} style={styles.fieldRow(on, section.color)} onClick={() => onToggle(f.key)}>
            <input type="checkbox" checked={on} onChange={() => onToggle(f.key)} style={styles.fieldCheckbox} />
            <span style={styles.fieldLabel}>{f.label}</span>
            <span style={styles.fieldBadge(on, section.color)}>{on ? 'Вкл' : 'Выкл'}</span>
          </div>
        );
      })}
      <button onClick={onClose} style={{
        ...styles.btnPrimary,
        background: `${section.color}25`,
        color: section.color,
        marginTop: 8,
      }}>✓ Готово</button>
    </div>
  </div>
);

const loadSectionSelections = (): Record<string, Set<string>> => {
  try {
    const raw = localStorage.getItem('he_user_report_fields');
    if (!raw) return {};
    const obj = JSON.parse(raw);
    const res: Record<string, Set<string>> = {};
    for (const [sid, keys] of Object.entries(obj)) {
      res[sid] = new Set(keys as string[]);
    }
    return res;
  } catch { return {}; }
};

const saveSectionSelections = (selections: Record<string, Set<string>>) => {
  try {
    const obj: Record<string, string[]> = {};
    for (const [sid, keys] of Object.entries(selections)) {
      obj[sid] = Array.from(keys);
    }
    localStorage.setItem('he_user_report_fields', JSON.stringify(obj));
  } catch {}
};

const formatUserReportText = (
  data: CustomUserReportProps['data'],
  selections: Record<string, Set<string>>,
  includeSections: Set<string>,
): string => {
  const lines: string[] = [];
  lines.push('══════════════════════════════════════════');
  lines.push('  ПОЛЬЗОВАТЕЛЬСКИЙ ОТЧЁТ');
  lines.push('  BodyBuildHealth — Персональная сводка');
  lines.push('══════════════════════════════════════════');
  lines.push('');

  const sel = (sid: string, key: string) => selections[sid]?.has(key) ?? false;
  const val = (obj: any, key: string) => obj?.[key] !== undefined && obj?.[key] !== '' ? String(obj[key]) : null;

  if (includeSections.has('profile') && selections.profile?.size) {
    const p = data.profile;
    const b = data.risk && typeof data.risk === 'object' ? data.risk : {};
    lines.push('▎ПРОФИЛЬ');
    if (sel('profile', 'name') && val(p, 'name')) lines.push(`  Имя: ${p.name}`);
    if (sel('profile', 'age') && val(p, 'age')) lines.push(`  Возраст: ${p.age} лет`);
    if (sel('profile', 'sex') && val(p, 'sex')) lines.push(`  Пол: ${p.sex === 'male' ? 'Мужской' : 'Женский'}`);
    if (sel('profile', 'weight') && val(p, 'weight')) lines.push(`  Вес: ${p.weight} кг`);
    if (sel('profile', 'height') && val(p, 'height')) lines.push(`  Рост: ${p.height} см`);
    if (sel('profile', 'bodyFat') && val(p, 'bodyFat')) lines.push(`  % жира: ${p.bodyFat}%`);
    if (sel('profile', 'bloodType') && val(p, 'bloodType')) lines.push(`  Группа крови: ${p.bloodType}`);
    if (sel('profile', 'bmi') && val(b, 'bmi')) lines.push(`  BMI: ${b.bmi}`);
    if (sel('profile', 'ffmi') && val(b, 'ffmi')) lines.push(`  FFMI: ${b.ffmi}`);
    if (sel('profile', 'lbm') && val(b, 'lbm')) lines.push(`  Тощая масса: ${b.lbm} кг`);
    if (sel('profile', 'targetWeight') && val(p, 'targetWeight')) lines.push(`  Целевой вес: ${p.targetWeight} кг`);
    if (sel('profile', 'allergy') && val(p, 'allergyNotes')) lines.push(`  Аллергии: ${p.allergyNotes}`);
    if (sel('profile', 'emergency') && (val(p, 'emergencyName') || val(p, 'emergencyPhone'))) lines.push(`  Экстренный контакт: ${p.emergencyName || '—'} / ${p.emergencyPhone || '—'}`);
    lines.push('');
  }

  if (includeSections.has('training') && selections.training?.size) {
    const t = data.training;
    lines.push('▎ТРЕНИРОВКИ');
    if (sel('training', 'sport') && val(t, 'sport')) lines.push(`  Вид спорта: ${t.sport}`);
    if (sel('training', 'experience') && val(t, 'experience')) lines.push(`  Стаж: ${t.experience} лет`);
    if (sel('training', 'level') && val(t, 'level')) lines.push(`  Уровень: ${t.level}`);
    if (sel('training', 'goal') && val(t, 'goal')) lines.push(`  Цель: ${t.goal}`);
    if (sel('training', 'frequency') && val(t, 'workoutsPerWeek')) lines.push(`  Частота: ${t.workoutsPerWeek}×/нед`);
    if (sel('training', 'duration') && val(t, 'avgWorkoutMinutes')) lines.push(`  Длительность: ${t.avgWorkoutMinutes} мин`);
    if (sel('training', 'program') && val(t, 'programName')) lines.push(`  Программа: ${t.programName}`);
    if (sel('training', 'split') && val(t, 'currentSplit')) lines.push(`  Сплит: ${t.currentSplit}`);
    if (sel('training', 'weekVolume') && val(t, 'weekVolume')) lines.push(`  Объём/нед: ${t.weekVolume}`);
    if (sel('training', 'lastDate') && val(t, 'lastWorkoutDate')) lines.push(`  Последняя тренировка: ${t.lastWorkoutDate}`);
    if (sel('training', 'lastWorkouts') && val(t, 'lastWorkouts') && t.lastWorkouts !== '  — нет записей') lines.push(`  Последние:\n${t.lastWorkouts}`);
    lines.push('');
  }

  if (includeSections.has('nutrition') && selections.nutrition?.size) {
    const n = data.nutrition;
    lines.push('▎ПИТАНИЕ');
    if (sel('nutrition', 'dietType') && val(n, 'dietType')) lines.push(`  Тип диеты: ${n.dietType}`);
    if (sel('nutrition', 'mealsPerDay') && val(n, 'mealsPerDay')) lines.push(`  Приёмов/день: ${n.mealsPerDay}`);
    if (sel('nutrition', 'kcal') && val(n, 'avgKcal')) lines.push(`  Средняя калорийность: ${n.avgKcal} ккал`);
    if (sel('nutrition', 'protein') && val(n, 'avgProtein')) lines.push(`  Белки: ${n.avgProtein} г`);
    if (sel('nutrition', 'fat') && val(n, 'avgFat')) lines.push(`  Жиры: ${n.avgFat} г`);
    if (sel('nutrition', 'carbs') && val(n, 'avgCarbs')) lines.push(`  Углеводы: ${n.avgCarbs} г`);
    if (sel('nutrition', 'qualityGrade')) {
      try {
        const rep = JSON.parse(localStorage.getItem('he_nutrition_report_archive') || '[]')[0];
        if (rep) {
          lines.push(`  Оценка качества: ${rep.overallGrade || '—'} · Качество еды: ${rep.foodQualityScore || '—'}/10`);
          if (sel('nutrition', 'microDeficits') && (rep.microDeficiencies?.length)) lines.push(`  Дефициты: ${rep.microDeficiencies.slice(0, 5).join(' · ')}`);
          if (sel('nutrition', 'weightDynamics') && rep.weightDynamicsBasic) lines.push(`  Динамика веса: ${rep.weightDynamicsBasic.direction === 'loss' ? '−' : rep.weightDynamicsBasic.direction === 'gain' ? '+' : '∼'}${rep.weightDynamicsBasic.weeklyKg || '0'} кг/нед`);
        }
      } catch {}
    }
    lines.push('');
  }

  if (includeSections.has('labs') && selections.labs?.size) {
    const l = data.labs;
    lines.push('▎АНАЛИЗЫ');
    if (sel('labs', 'markerList') && val(l, 'list')) lines.push(`  Маркеры: ${l.list}`);
    if (sel('labs', 'recent') && val(l, 'recentList')) lines.push(`  Последние: ${l.recentList}`);
    if (sel('labs', 'abnormal')) {
      try {
        const risk = data.risk;
        const abn: string[] = [];
        const labs = JSON.parse(localStorage.getItem('he_lab_analysis') || '[]');
        for (const lb of labs) { if (lb.status === 'high' || lb.status === 'low') abn.push(`${lb.code} ${lb.value}${lb.unit}`); }
        if (abn.length > 0) lines.push(`  Отклонения: ${abn.slice(0, 8).join(' · ')}`);
        else lines.push('  Отклонений не обнаружено');
      } catch { lines.push('  Отклонения: нет данных'); }
    }
    if (sel('labs', 'liverStress') && data.risk?.systemBreakdown?.hepatic) lines.push(`  Печёночный стресс: ${Math.round(data.risk.systemBreakdown.hepatic.net)}%`);
    if (sel('labs', 'kidneyStress') && data.risk?.systemBreakdown?.renal) lines.push(`  Почечный стресс: ${Math.round(data.risk.systemBreakdown.renal.net)}%`);
    if (sel('labs', 'lipids') || sel('labs', 'hormones')) {
      try {
        const labs = JSON.parse(localStorage.getItem('he_lab_analysis') || '[]');
        if (sel('labs', 'lipids')) {
          const lipidNames = ['HDL', 'LDL', 'Triglycerides', 'Холестерин', 'TC', 'TG', 'HDL-C', 'LDL-C'];
          const lipids = labs.filter((l: any) => lipidNames.some(n => (l.code||'').toUpperCase().includes(n)));
          if (lipids.length > 0) lines.push(`  Липиды: ${lipids.map((l: any) => `${l.code} ${l.value}${l.unit}`).slice(0, 4).join(' · ')}`);
        }
        if (sel('labs', 'hormones')) {
          const hormoneNames = ['Тестостерон', 'Estradiol', 'E2', 'T', 'SHBG', 'LH', 'FSH', 'Пролактин', 'Кортизол', 'TSH', 'T3', 'T4'];
          const h = labs.filter((l: any) => hormoneNames.some(n => (l.code||'').toUpperCase().includes(n)));
          if (h.length > 0) lines.push(`  Гормоны: ${h.map((l: any) => `${l.code} ${l.value}${l.unit}`).slice(0, 6).join(' · ')}`);
        }
      } catch {}
    }
    if (sel('labs', 'inflammation') && data.risk?.systemBreakdown?.neuro) lines.push(`  Воспалительный статус (нейро): ${Math.round(data.risk.systemBreakdown.neuro.net)}%`);
    lines.push('');
  }

  if (includeSections.has('course') && selections.course?.size) {
    const c = data.course;
    lines.push('▎КУРС / ФАРМА');
    if (sel('course', 'phase') && val(c, 'phase')) lines.push(`  Фаза: ${c.phase}`);
    if (sel('course', 'startDate') && val(c, 'courseStartDate')) lines.push(`  Начало курса: ${c.courseStartDate}`);
    if (sel('course', 'meds') && val(c, 'medsList')) lines.push(`  Препараты: ${c.medsList}`);
    if (sel('course', 'supps') && val(c, 'suppsList')) lines.push(`  БАДы/Поддержка: ${c.suppsList}`);
    if (sel('course', 'supportCoverage')) {
      const risk = data.risk;
      if (risk?.systemSupport) {
        const sysLabels: Record<string, string> = { cardio:'ССС', hepatic:'Печень', renal:'Почки', neuro:'НС', endocrine:'Эндокринная', hematologic:'Кровь', reproductive:'Репрод.', musculoskeletal:'ОДА' };
        for (const [sys, pct] of Object.entries(risk.systemSupport)) {
          if (pct !== undefined) lines.push(`  ${sysLabels[sys] || sys}: покрытие ${Math.round(Number(pct))}%`);
        }
      }
      if (risk?.totalSupport) lines.push(`  Общее покрытие: ${Math.round(risk.totalSupport)}%`);
    }
    if (sel('course', 'supportReport')) {
      try {
        const sr = JSON.parse(localStorage.getItem('he_profile_support_reports') || '[]')[0];
        if (sr) lines.push(`  Отчёт поддержки: ${sr.grade || '—'} · Риск ${sr.overallNet || '—'}/100 · ${sr.compoundsCount || '—'} соединений`);
      } catch {}
    }
    lines.push('');
  }

  if (includeSections.has('risk') && selections.risk?.size) {
    const risk = data.risk;
    const sysLabels: Record<string, string> = { cardio:'ССС', hepatic:'Печень', renal:'Почки', neuro:'НС', endocrine:'Эндокринная', hematologic:'Кровь', reproductive:'Репрод.', musculoskeletal:'ОДА' };
    lines.push('▎РИСКИ');
    if (sel('risk', 'overallNet') && risk?.overallNet !== undefined) lines.push(`  Общий риск (с поддержкой): ${Math.round(risk.overallNet)}%`);
    if (sel('risk', 'overallRaw') && risk?.overallRaw !== undefined) lines.push(`  Риск без поддержки: ${Math.round(risk.overallRaw)}%`);
    if (sel('risk', 'systemBreakdown') && risk?.systemBreakdown) {
      for (const sys of ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive', 'musculoskeletal']) {
        if (risk.systemBreakdown[sys]?.net > 0) lines.push(`  ${sysLabels[sys] || sys}: ${Math.round(risk.systemBreakdown[sys].net)}% (raw: ${Math.round(risk.systemBreakdown[sys].raw || 0)}%)`);
      }
    }
    if (sel('risk', 'systemSupport') && risk?.systemSupport) {
      for (const [sys, pct] of Object.entries(risk.systemSupport)) {
        if (pct !== undefined) lines.push(`  Покрытие ${sysLabels[sys] || sys}: ${Math.round(Number(pct))}%`);
      }
    }
    lines.push('');
  }

  if (includeSections.has('bp') && selections.bp?.size) {
    lines.push('▎ДАВЛЕНИЕ');
    try {
      const bpd = JSON.parse(localStorage.getItem('he_bp_diary') || '[]');
      if (bpd.length === 0) { lines.push('  Нет записей'); }
      else {
        const last = bpd[0];
        if (sel('bp', 'lastReading')) lines.push(`  Последнее: ${last.systolic}/${last.diastolic} мм рт.ст. · Пульс: ${last.hr || '—'} · ${last.date || '—'}`);
        if (sel('bp', 'avgSys') || sel('bp', 'avgDia') || sel('bp', 'avgHr')) {
          const avg = (arr: number[]) => arr.length > 0 ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : '—';
          const sysArr = bpd.map((b: any) => b.systolic).filter(Boolean);
          const diaArr = bpd.map((b: any) => b.diastolic).filter(Boolean);
          const hrArr = bpd.map((b: any) => b.hr).filter(Boolean);
          const parts: string[] = [];
          if (sel('bp', 'avgSys')) parts.push(`САД: ${avg(sysArr)} мм`);
          if (sel('bp', 'avgDia')) parts.push(`ДАД: ${avg(diaArr)} мм`);
          if (sel('bp', 'avgHr')) parts.push(`Пульс: ${avg(hrArr)} уд/мин`);
          if (parts.length) lines.push(`  Среднее: ${parts.join(' · ')}`);
        }
        if (sel('bp', 'trend') && bpd.length >= 3) {
          const recent = bpd.slice(0, 7);
          const sysStr = recent.map((b: any) => b.systolic).filter(Boolean).join(' → ');
          if (sysStr) lines.push(`  Тренд САД: ${sysStr}`);
        }
        if (sel('bp', 'totalCount')) lines.push(`  Всего записей: ${bpd.length}`);
      }
    } catch { lines.push('  Нет данных'); }
    lines.push('');
  }

  if (includeSections.has('sleep') && selections.sleep?.size) {
    lines.push('▎СОН');
    try {
      const sd = JSON.parse(localStorage.getItem('he_sleep_diary') || '[]');
      if (sd.length === 0) { lines.push('  Нет записей'); }
      else {
        const hoursArr = sd.map((e: any) => Number(e.hours)).filter((v: number) => v > 0);
        const qualArr = sd.map((e: any) => Number(e.quality)).filter((v: number) => v > 0);
        if (sel('sleep', 'avgHours') && hoursArr.length) lines.push(`  Средняя длительность: ${(hoursArr.reduce((s: number, v: number) => s + v, 0) / hoursArr.length).toFixed(1)} ч`);
        if (sel('sleep', 'avgQuality') && qualArr.length) lines.push(`  Среднее качество: ${(qualArr.reduce((s: number, v: number) => s + v, 0) / qualArr.length).toFixed(1)}/5`);
        if (sel('sleep', 'trendHours') && hoursArr.length >= 3) lines.push(`  Тренд (ч): ${hoursArr.slice(0, 7).join(' → ')}`);
        if (sel('sleep', 'totalCount')) lines.push(`  Всего записей: ${sd.length}`);
      }
    } catch { lines.push('  Нет данных'); }
    lines.push('');
  }

  if (includeSections.has('measurements') && selections.measurements?.size) {
    lines.push('▎ЗАМЕРЫ');
    try {
      const meas = JSON.parse(localStorage.getItem('he_measurements_log') || '[]');
      if (meas.length === 0) { lines.push('  Нет данных'); }
      else {
        const last = meas[meas.length - 1];
        if (sel('measurements', 'last3') && meas.length >= 3) {
          lines.push('  Последние 3:');
          for (let i = Math.max(0, meas.length - 3); i < meas.length; i++) {
            const m = meas[i];
            lines.push(`    ${m.date || '—'}: талия ${m.waistCm || '—'} см · грудь ${m.chestCm || '—'} см · бедро ${m.thighCm || '—'} см · бицепс ${m.bicepCm || '—'} см`);
          }
        }
        if (sel('measurements', 'waist') && last?.waistCm) lines.push(`  Талия: ${last.waistCm} см`);
        if (sel('measurements', 'chest') && last?.chestCm) lines.push(`  Грудь: ${last.chestCm} см`);
        if (sel('measurements', 'bicep') && last?.bicepCm) lines.push(`  Бицепс: ${last.bicepCm} см`);
        if (sel('measurements', 'thigh') && last?.thighCm) lines.push(`  Бедро: ${last.thighCm} см`);
        if (sel('measurements', 'hip') && last?.hipCm) lines.push(`  Бёдра: ${last.hipCm} см`);
        if (sel('measurements', 'neck') && last?.neckCm) lines.push(`  Шея: ${last.neckCm} см`);
      }
    } catch { lines.push('  Нет данных'); }
    lines.push('');
  }

  if (includeSections.has('health') && selections.health?.size) {
    const p = data.profile;
    lines.push('▎ЗДОРОВЬЕ');
    if (sel('health', 'chronic')) {
      try {
        const chronic = localStorage.getItem('he_chronic_list') || '—';
        lines.push(`  Хронические заболевания: ${chronic}`);
      } catch { lines.push('  Хронические заболевания: —'); }
    }
    if (sel('health', 'allergies') && val(p, 'allergyNotes')) lines.push(`  Аллергии: ${p.allergyNotes}`);
    if (sel('health', 'emergencyContact')) lines.push(`  Экстренный контакт: ${p.emergencyName || '—'} / ${p.emergencyPhone || '—'}`);
    lines.push('');
  }

  if (includeSections.has('genetics') && selections.genetics?.size) {
    lines.push('▎ГЕНЕТИКА');
    try {
      const gen = JSON.parse(localStorage.getItem('he_genetics_data') || '{}');
      if (sel('genetics', 'snps')) {
        const snpEntries = Object.entries(gen).filter(([k]) => k.startsWith('snp_')).map(([k, v]) => `${k.replace('snp_', '').toUpperCase()}: ${v}`);
        if (snpEntries.length > 0) lines.push(`  SNP: ${snpEntries.join(' · ')}`);
        else lines.push('  SNP: не заполнено');
      }
      if (sel('genetics', 'features')) {
        const feats: string[] = [];
        if (gen.lactose_intolerance) feats.push('Лактозная непереносимость');
        if (gen.gluten_sensitivity) feats.push('Чувствительность к глютену');
        if (gen.fast_metabolizer) feats.push('Быстрый метаболизатор');
        lines.push(feats.length > 0 ? `  Особенности: ${feats.join(' · ')}` : '  Особенности: не указаны');
      }
    } catch { lines.push('  Генетика: не заполнено'); }
    lines.push('');
  }

  if (includeSections.has('support') && selections.support?.size) {
    const c = data.course;
    lines.push('▎ПОДДЕРЖКА (БАДы)');
    if (sel('support', 'suppsList') && val(c, 'suppsList')) lines.push(`  БАДы: ${c.suppsList}`);
    if (sel('support', 'level')) {
      try {
        const sr = JSON.parse(localStorage.getItem('he_profile_support_reports') || '[]')[0];
        if (sr) lines.push(`  Уровень поддержки: ${sr.level || '—'}`);
      } catch {}
    }
    if (sel('support', 'interactions') || sel('support', 'synergies')) {
      try {
        const sr = JSON.parse(localStorage.getItem('he_profile_support_reports') || '[]')[0];
        if (sr) {
          if (sel('support', 'interactions') && sr.riskyCombos?.length) lines.push(`  Взаимодействия: ${sr.riskyCombos.length} рискованных комбинаций`);
          if (sel('support', 'synergies') && sr.synergiesCount) lines.push(`  Синергии: ${sr.synergiesCount}`);
        }
      } catch {}
    }
    lines.push('');
  }

  lines.push(`  Дата: ${new Date().toLocaleDateString('ru')}`);
  lines.push('══════════════════════════════════════════');
  return lines.join('\n');
};

export const CustomUserReport: React.FC<CustomUserReportProps> = ({ data, onCopy, onPrint, onSend, onSave }) => {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [popupSection, setPopupSection] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, Set<string>>>(() => {
    const saved = loadSectionSelections();
    const initial: Record<string, Set<string>> = {};
    for (const s of SECTIONS) {
      initial[s.id] = saved[s.id] ? saved[s.id] : new Set(s.fields.filter(f => f.defaultOn).map(f => f.key));
    }
    return initial;
  });
  const [includeSections, setIncludeSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('he_user_report_sections');
      if (saved) return JSON.parse(saved);
    } catch {}
    const initial: Record<string, boolean> = {};
    SECTIONS.forEach(s => { initial[s.id] = true; });
    return initial;
  });

  useEffect(() => {
    saveSectionSelections(selections);
  }, [selections]);

  useEffect(() => {
    try { localStorage.setItem('he_user_report_sections', JSON.stringify(includeSections)); }
    catch {}
  }, [includeSections]);

  const toggleField = (sectionId: string, key: string) => {
    setSelections(prev => {
      const next = { ...prev };
      const set = new Set(next[sectionId]);
      if (set.has(key)) set.delete(key); else set.add(key);
      next[sectionId] = set;
      return next;
    });
  };

  const toggleSectionEnabled = (sectionId: string) => {
    setIncludeSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const activeSections = new Set(Object.entries(includeSections).filter(([, v]) => v).map(([k]) => k));

  const reportText = formatUserReportText(data, selections, activeSections);

  const handleGenerate = () => {
    onSave('👤 Пользовательский', reportText);
    setTab('preview');
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.tabRow}>
        <button onClick={() => setTab('edit')} style={styles.tab(tab === 'edit')}>📋 Настройка отчёта</button>
        <button onClick={() => setTab('preview')} style={styles.tab(tab === 'preview')}>📄 Готовый отчёт</button>
      </div>

      {tab === 'edit' && (
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 8, lineHeight: 1.5 }}>
            Выберите разделы и наполните их нужными сведениями через кнопки-карточки. Нажмите на карточку чтобы включить/выключить раздел, откройте попап чтобы выбрать конкретные поля.
          </div>
          <div style={styles.cardGrid(3)}>
            {SECTIONS.map(s => {
              const enabled = includeSections[s.id];
              const fieldCount = selections[s.id]?.size ?? 0;
              return (
                <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    style={styles.card(enabled, s.color)}
                    onClick={() => toggleSectionEnabled(s.id)}
                  >
                    <span style={{ ...styles.cardIcon, opacity: enabled ? 1 : 0.35 }}>{s.icon}</span>
                    <span style={{ ...styles.cardLabel, color: enabled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)' }}>{s.label}</span>
                    <span style={{
                      fontSize: 8, padding: '2px 6px', borderRadius: 8,
                      background: enabled ? `${s.color}20` : 'rgba(255,255,255,0.04)',
                      color: enabled ? s.color : 'rgba(255,255,255,0.3)',
                    }}>{fieldCount}/{s.fields.length}</span>
                  </div>
                  <button
                    onClick={() => setPopupSection(s.id)}
                    style={{
                      padding: '6px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.03)',
                      color: enabled ? s.color : 'rgba(255,255,255,0.3)',
                      fontSize: 9, fontWeight: 600, textAlign: 'center',
                    }}
                  >⚙️ Поля</button>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10 }}>
            <button onClick={handleGenerate} style={styles.btnPrimary}>
              📄 Сгенерировать отчёт
            </button>
          </div>

          {popupSection && (
            <PopupFieldList
              section={SECTIONS.find(s => s.id === popupSection)!}
              selected={selections[popupSection] || new Set()}
              onToggle={(key) => toggleField(popupSection, key)}
              onClose={() => setPopupSection(null)}
            />
          )}
        </div>
      )}

      {tab === 'preview' && (
        <div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, fontFamily: "'SF Mono', 'Consolas', monospace" }}>
              {reportText}
            </div>
          </div>

          <div style={styles.actionRow}>
            <button onClick={() => onCopy(reportText)} style={styles.btnSecondary}>📋 Копировать</button>
            <button onClick={() => onPrint(reportText, 'Пользовательский отчёт')} style={styles.btnSecondary}>🖨 Печать</button>
            <button onClick={() => onSend(reportText)} style={{
              ...styles.btnSecondary, background: 'var(--accent, #00e68a)', color: '#000', border: 'none',
            }}>📤 Отправить</button>
          </div>

          <button onClick={() => setTab('edit')} style={{
            width: '100%', padding: '8px', borderRadius: 10, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
            color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, marginTop: 4,
          }}>← Вернуться к настройке</button>
        </div>
      )}
    </div>
  );
};

export default CustomUserReport;
