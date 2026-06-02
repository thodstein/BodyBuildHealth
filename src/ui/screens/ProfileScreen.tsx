import React, { useEffect, useRef, useState } from 'react';
import { renderSettingsModule } from '../settings-module';
import type { UserProfile, ReadinessInput } from '../../core/types';
import { getProfile, updateProfile } from '../../core/profile-manager';
import { formatDate, calculateAge } from '../../core/utils/date-utils';
import { db } from '../../core/db';
import type { LabPoint } from '../../core/types';
import { computeLabIndices, LabIndicesInterpretation, interpretLabIndices } from '../../engines/labs-indices.engine';
import { calcReadiness } from '../../engines/readiness.engine';
import { calculateIndices } from '../../engines/clinical-indices.engine';

export const ProfileScreen: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsHostRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [labs, setLabs] = useState<LabPoint[]>([]);
  const [labIndices, setLabIndices] = useState<{ inflammation: number; metabolism: number; thyroid: number; lipids: number } | null>(null);
  const [labIndexText, setLabIndexText] = useState<{ inflammation: string; metabolism: string; thyroid: string; lipids: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'metrics' | 'progress'>('overview');

  const readinessScores = profile ? calcReadiness({
    sleepHours: profile.settings.baselineSleepHours ?? 7,
    sleepQuality: profile.settings.baselineSleepQuality ?? 0.7,
    nightAwakenings: 1,
    hrvRatio: profile.settings.baselineHrvRatio ?? 1.0,
    doms: 2,
    stress: profile.settings.baselineStressLevel ?? 3,
    calRatio: profile.settings.nutritionFactor ?? 0.8,
    proteinRatio: 0.8,
    waterRatio: 0.7,
    fiberRatio: 0.6,
    omega3Flag: false,
    trainingLoadRatio: profile.settings.trainingFactor ?? 0.6,
    subjFatigue: 3,
    hrIncrease: 0.1,
  }) : null;

  const clinicalIndices = labs.length > 0 && profile ? calculateIndices(labs, profile.settings.sex === 'male' ? 'male' : 'female', profile.settings.age ?? 30) : null;

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const p = await getProfile();
        setProfile(p as UserProfile);
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (!settingsHostRef.current || !profile) return;
    renderSettingsModule(settingsHostRef.current, profile, (updated: any) => {
      setProfile(updated);
    });
  }, [profile]);

  useEffect(() => {
    const loadLabs = async () => {
      if (!profile) return;
      try {
        const patientId = profile.id || 'current-user';
        const labEntries = await db.getAll<LabPoint & { patientId?: string }>('labs_log');
        const userLabs = labEntries.filter((l) => l.patientId === patientId);
        setLabs(userLabs);
      } catch (e) {
        console.error('Failed to load labs for profile:', e);
      }
    };
    loadLabs();
  }, [profile]);

  useEffect(() => {
    if (labs.length > 0) {
      const indices = computeLabIndices(labs);
      setLabIndices(indices);
      setLabIndexText(interpretLabIndices(indices));
    } else {
      setLabIndices(null);
      setLabIndexText(null);
    }
  }, [labs]);

  const getProgressPercent = () => {
    if (!profile || !profile.settings) return 0;
    const { weight } = profile.settings;
    const goal = profile.settings.goal;
    let targetWeight = weight;
    if (goal === 'bulk') targetWeight = weight + 10;
    else if (goal === 'cut') targetWeight = weight - 10;
    else if (goal === 'recomposition') targetWeight = weight; // Maintain weight, change composition
    if (targetWeight === 0) return 0;
    return Math.min(100, Math.max(0, (weight / targetWeight) * 100));
  };

  if (loading) return <div className="screen profile">Загрузка профиля...</div>;

  if (!profile) return <div className="screen profile">Профиль не найден</div>;

  return (
    <div className="screen profile" ref={containerRef}>
      <div className="profile-header">
        <div className="profile-avatar">
          <div className="avatar-initials">
            {(profile.name ? profile.name.charAt(0) : '?').toUpperCase()}
          </div>
        </div>
        <div className="profile-info">
          <h2>{profile.name || 'Анонимный пользователь'}</h2>
          <p className="profile-role">
            {profile.role === 'admin' ? 'Администратор' :
             profile.role === 'coach' ? 'Тренер' :
             profile.role === 'doctor' ? 'Врач' :
             profile.role === 'editor' ? 'Редактор' :
             'Пользователь'}
          </p>
        </div>
      </div>

      <div className="profile-tabs">
        <button className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Обзор
        </button>
        <button className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          Настройки
        </button>
        <button className={`tab-button ${activeTab === 'metrics' ? 'active' : ''}`} onClick={() => setActiveTab('metrics')}>
          Метрики
        </button>
        <button className={`tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
          Прогресс
        </button>
      </div>

      <div className="profile-content">
        {/* Overview Tab - Default */}
        <div className="profile-section" style={{ display: activeTab === 'overview' ? undefined : 'none' }}>
          {readinessScores && (
            <div className="profile-card readiness-card" style={{ marginBottom: '1rem' }}>
              <h4>Оценка готовности</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: readinessScores.recovery >= 60 ? 'var(--success)' : readinessScores.recovery >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{readinessScores.recovery}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Восстановление</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: readinessScores.nutrition >= 60 ? 'var(--success)' : readinessScores.nutrition >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{readinessScores.nutrition}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Питание</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: readinessScores.support >= 60 ? 'var(--success)' : readinessScores.support >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{readinessScores.support}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Поддержка</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: readinessScores.fatigue <= 40 ? 'var(--success)' : readinessScores.fatigue <= 60 ? 'var(--warning)' : 'var(--danger)' }}>{readinessScores.fatigue}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Усталость</div>
                </div>
              </div>
              {readinessScores.isConservative && (
                <p style={{ color: 'var(--warning)', marginTop: '0.5rem', fontSize: '0.85rem' }}>⚠️ {readinessScores.conservativeReason}</p>
              )}
            </div>
          )}
          <div className="profile-grid">
            <div className="profile-card">
              <h4>Основная информация</h4>
              <div className="info-item">
                <span className="info-label">Возраст:</span>
                <span className="info-value">
                  {profile.settings.age !== undefined 
                    ? `${profile.settings.age} лет` 
                    : profile.settings.dateOfBirth
                      ? `${calculateAge(profile.settings.dateOfBirth)} лет`
                      : 'Не указано'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Пол:</span>
                <span className="info-value">
                  {profile.settings.sex === 'male' ? 'Мужской' : 'Женский'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Этническая принадлежность:</span>
                <span className="info-value">
                  {profile.settings.ethnicity || 'Не указано'}
                </span>
              </div>
            </div>

            <div className="profile-card">
              <h4>Физические параметры</h4>
              <div className="info-item">
                <span className="info-label">Рост:</span>
                <span className="info-value">
                  {profile.settings.height !== undefined 
                    ? `${profile.settings.height} см` 
                    : 'Не указано'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Вес:</span>
                <span className="info-value">
                  {profile.settings.weight} кг
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Процент жира:</span>
                <span className="info-value">
                  {profile.settings.bodyFat !== undefined 
                    ? `${profile.settings.bodyFat}%` 
                    : 'Не измерено'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Индекс массы тела (ИМТ):</span>
                <span className="info-value">
                  {profile.settings.height && profile.settings.weight
                    ? `${(profile.settings.weight / Math.pow(profile.settings.height / 100, 2)).toFixed(1)}`
                    : 'Не рассчитан'}
                </span>
              </div>
            </div>

            <div className="profile-card">
              <h4>Цели и предпочтения</h4>
              <div className="info-item">
                <span className="info-label">Основная цель:</span>
                <span className="info-value">
                  {profile.settings.primaryGoal || profile.settings.goal || 'Не указана'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Целевой вес:</span>
                <span className="info-value">
                  {profile.settings.targetWeight !== undefined 
                    ? `${profile.settings.targetWeight} кг` 
                    : 'Не установлен'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Целевой % жира:</span>
                <span className="info-value">
                  {profile.settings.targetBodyFat !== undefined 
                    ? `${profile.settings.targetBodyFat}%` 
                    : 'Не установлен'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Срок достижения цели:</span>
                <span className="info-value">
                  {profile.settings.goalTimelineWeeks !== undefined 
                    ? `${profile.settings.goalTimelineWeeks} недель` 
                    : 'Не указан'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Tab */}
        <div className="profile-section" style={{ display: activeTab === 'metrics' ? undefined : 'none' }} id="metrics-tab">
          <div className="profile-grid">
            <div className="profile-card">
              <h4>Показатели готовности</h4>
              <div className="metric-item">
                <span className="metric-label">Сон:</span>
                <div className="metric-value">
                  {profile.settings.baselineSleepHours !== undefined
                    ? `${profile.settings.baselineSleepHours} ч`
                    : 'Не указано'}
                </div>
              </div>
              <div className="metric-item">
                <span className="metric-label">Качество сна:</span>
                <div className="metric-value">
                  {profile.settings.baselineSleepQuality !== undefined
                    ? `${(profile.settings.baselineSleepQuality * 100).toFixed(0)}%`
                    : 'Не указано'}
                </div>
              </div>
              <div className="metric-item">
                <span className="metric-label">HRV ratio:</span>
                <div className="metric-value">
                  {profile.settings.baselineHrvRatio !== undefined
                    ? `${profile.settings.baselineHrvRatio.toFixed(2)}`
                    : 'Не указано'}
                </div>
              </div>
              <div className="metric-item">
                <span className="metric-label">Уровень стресса:</span>
                <div className="metric-value">
                  {profile.settings.baselineStressLevel !== undefined
                    ? `${profile.settings.baselineStressLevel}/10`
                    : 'Не указано'}
                </div>
              </div>
            </div>

            <div className="profile-card">
              <h4>Физическая подготовка</h4>
              <div className="metric-item">
                <span className="metric-label">Уровень тренировок:</span>
                <div className="metric-value">
                  {profile.settings.trainingFactor !== undefined
                    ? `${(profile.settings.trainingFactor * 50).toFixed(0)}%`
                    : 'Не указано'}
                </div>
              </div>
              <div className="metric-item">
                <span className="metric-label">Питание:</span>
                <div className="metric-value">
                  {profile.settings.nutritionFactor !== undefined
                    ? `${(profile.settings.nutritionFactor * 50).toFixed(0)}%`
                    : 'Не указано'}
                </div>
              </div>
            </div>

            <div className="profile-card">
              <h4>Клинические индексы</h4>
              {clinicalIndices ? (
                <div className="lab-indices-grid">
                  <div className="lab-index-item">
                    <h5>HOMA-IR</h5>
                    <div className="lab-index-value">{clinicalIndices.homaIR.value}</div>
                    <p className="lab-index-label">{clinicalIndices.homaIR.status === 'normal' ? 'Норма' : clinicalIndices.homaIR.status === 'ir' ? 'ИР' : 'Выраженная ИР'}</p>
                  </div>
                  <div className="lab-index-item">
                    <h5>eGFR</h5>
                    <div className="lab-index-value">{clinicalIndices.egfr.value}</div>
                    <p className="lab-index-label">{clinicalIndices.egfr.status === 'normal' ? 'Норма' : `Стадия ${clinicalIndices.egfr.status.toUpperCase()}`}</p>
                  </div>
                  <div className="lab-index-item">
                    <h5>LDL/HDL</h5>
                    <div className="lab-index-value">{clinicalIndices.ldlHdlRatio.value}</div>
                    <p className="lab-index-label">{clinicalIndices.ldlHdlRatio.status === 'optimal' ? 'Оптимально' : clinicalIndices.ldlHdlRatio.status === 'moderate' ? 'Умеренно' : 'Высокий'}</p>
                  </div>
                  <div className="lab-index-item">
                    <h5>De Ritis</h5>
                    <div className="lab-index-value">{clinicalIndices.deritis.value}</div>
                    <p className="lab-index-label">{clinicalIndices.deritis.status === 'normal' ? 'Норма' : clinicalIndices.deritis.status === 'alcohol' ? 'Алкогольная' : 'Вирусная'}</p>
                  </div>
                </div>
              ) : (
                <p className="empty-state">Нет данных лаборатории</p>
              )}
            </div>

            {/* Lab Indices Card */}
            <div className="profile-card">
              <h4>Индексы лабораторных исследований</h4>
              {labIndices && labIndexText ? (
                <>
                  <div className="lab-indices-grid">
                    <div className="lab-index-item">
                      <h5>Воспаление</h5>
                      <div className="lab-index-value" style={{ color: getLabIndexColor(labIndices.inflammation) }}>
                        {(labIndices.inflammation * 100).toFixed(0)}%
                      </div>
                      <p className="lab-index-label">{labIndexText.inflammation}</p>
                    </div>
                    <div className="lab-index-item">
                      <h5>Метаболизм</h5>
                      <div className="lab-index-value" style={{ color: getLabIndexColor(labIndices.metabolism) }}>
                        {(labIndices.metabolism * 100).toFixed(0)}%
                      </div>
                      <p className="lab-index-label">{labIndexText.metabolism}</p>
                    </div>
                    <div className="lab-index-item">
                      <h5>Щитовидная железа</h5>
                      <div className="lab-index-value" style={{ color: getLabIndexColor(labIndices.thyroid) }}>
                        {(labIndices.thyroid * 100).toFixed(0)}%
                      </div>
                      <p className="lab-index-label">{labIndexText.thyroid}</p>
                    </div>
                    <div className="lab-index-item">
                      <h5>Липидный профиль</h5>
                      <div className="lab-index-value" style={{ color: getLabIndexColor(labIndices.lipids) }}>
                        {(labIndices.lipids * 100).toFixed(0)}%
                      </div>
                      <p className="lab-index-label">{labIndexText.lipids}</p>
                    </div>
                  </div>
                  <div className="lab-indices-explanation">
                    <p>Индексы рассчитываются на основе последних результатов лабораторных анализов и показывают относительное отклонение от нормы (0% - идеально, 100% - критические отклонения).</p>
                  </div>
                </>
              ) : labs.length === 0 ? (
                <p className="empty-state">Добавьте результаты лабораторных анализов, чтобы увидеть индексы.</p>
              ) : (
                <p>Вычисление индексов...</p>
              )}
            </div>
          </div>
        </div>

        {/* Progress Tab */}
        <div className="profile-section" style={{ display: activeTab === 'progress' ? undefined : 'none' }} id="progress-tab">
          <div className="progress-section">
            <h4>Прогресс к цели</h4>
            <div className="progress-overview">
              <div className="progress-item">
                <h5>Вес</h5>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${getProgressPercent()}%` }}/>
                </div>
                <p className="progress-text">
                  {Math.round(getProgressPercent())}% целевого веса
                </p>
              </div>
            </div>
          </div>
          
          <div className="recommendations">
            <h4>Рекомендации</h4>
            <ul className="recommendation-list">
              {profile.settings.goal === 'bulk' ? (
                <>
                  <li className="recommendation-item">
                    Увеличьте калорийность рациона на 300-500 ккал выше уровня поддержки
                  </li>
                  <li className="recommendation-item">
                    Потребляйте 1.8-2.2 г белка на кг массы тела ежедневно
                  </li>
                  <li className="recommendation-item">
                    Сделайте приоритетом прогрессию нагрузок в базовых упражнениях
                  </li>
                </>
              ) : profile.settings.goal === 'cut' ? (
                <>
                  <li className="recommendation-item">
                    Снизьте калорийность на 300-500 ккал ниже уровня поддержки
                  </li>
                  <li className="recommendation-item">
                    Сохраните высокое потребление белка (2.0-2.4 г/кг) для защиты мышц
                  </li>
                  <li className="recommendation-item">
                    Добавьте кардио-нагрузки низкой интенсивности для ускорения жиросжигания
                  </li>
                </>
              ) : (
                <>
                  <li className="recommendation-item">
                    Поддерживайте текущий режим тренировок и питания
                  </li>
                  <li className="recommendation-item">
                    Рассмотрите увеличение потребления протеина на 10-20%
                  </li>
                  <li className="recommendation-item">
                    Оптимизируйте режим сна для лучшего восстановления
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Settings Tab - handled by settings-module */}
        <div className="profile-section" style={{ display: activeTab === 'settings' ? undefined : 'none' }} id="settings-tab">
          <div ref={settingsHostRef} />
        </div>
      </div>
    </div>
  );
};

// Helper function to get color for lab index value (0-1 scale)
function getLabIndexColor(value: number): string {
  if (value < 0.3) return 'var(--success)';
  if (value < 0.7) return 'var(--warning)';
  return 'var(--danger)';
}

// Helper function to calculate age from date of birth
function calculateAgeFromDob(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
