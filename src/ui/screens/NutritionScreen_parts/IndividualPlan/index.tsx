import React from "react";
import type { UserProfile } from "../../../../core/types";
import { IndividualPlanProvider } from "./IndividualPlanContext";
import { IndividualPlanSettings } from "./IndividualPlanSettings";
import { IndividualPlanResults } from "./IndividualPlanResults";

export const IndividualPlan: React.FC<{ profile: UserProfile | null; course?: any[] }> = ({ profile, course }) => {
  return (
    <IndividualPlanProvider profile={profile} course={course}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80, maxWidth: 540, margin: '0 auto' }}>
        <IndividualPlanSettings />
        <IndividualPlanResults />
      </div>
    </IndividualPlanProvider>
  );
};
