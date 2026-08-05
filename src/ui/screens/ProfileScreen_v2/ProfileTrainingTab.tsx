/**
 * ProfileTrainingTab — вкладка "Тренировки" с 3 секциями.
 */
import React from 'react';
import { TrainingProfileSection } from './sections/TrainingProfileSection';
import { TrainingPMSection } from './sections/TrainingPMSection';
import { TrainingWeakPointsSection } from './sections/TrainingWeakPointsSection';

export const ProfileTrainingTab: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <TrainingProfileSection />
    <TrainingPMSection />
    <TrainingWeakPointsSection />
  </div>
);
