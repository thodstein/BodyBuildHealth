/** QualityJointHub.tsx — единый хаб «Качество + Диагностика».
 * Суставы/ортопедия — в отдельной вкладке «Суставы и ортопедия» (joints_ortho), без дублей. */
import React from 'react';
import { QualityDiagnosticsHub, type QualityDiagnosticsHubProps } from './QualityDiagnosticsHub';

export const QualityJointHub: React.FC<QualityDiagnosticsHubProps> = (props) => {
  return <QualityDiagnosticsHub {...props} />;
};

export default QualityJointHub;
