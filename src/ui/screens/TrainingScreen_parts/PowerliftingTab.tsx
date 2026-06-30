import React from "react";
import { SRCBBScreen } from "../SRCBBScreen";
import { POWERLIFTING_PROGRAMS } from "../../lib/training/data/programs";

export const PowerliftingTab: React.FC = () => {
  const program = POWERLIFTING_PROGRAMS[0]; // Use first program for simplicity

  const handleEdit = () => {
    // Save preset to localStorage for manual constructor to pick up
    const presetData = {
      ...program,
      // Convert to a format that the plan tab can understand
      // We'll store the whole program object
    };
    localStorage.setItem("he_training_preset_to_edit", JSON.stringify(presetData));
    
    // Switch to manual mode and plan tab
    localStorage.setItem("he_training_planning_track", "manual");
    localStorage.setItem("he_training_tab", "plan");
    // Trigger a change event so the parent can react
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: "0", fontSize: "20px" }}>{program.name}</h2>
        <button 
          onClick={handleEdit}
          style={{
            marginLeft: "12px",
            padding: "6px 12px",
            background: "rgba(0,230,138,0.2)",
            color: "#00e68a",
            border: "1px solid rgba(0,230,138,0.3)",
            borderRadius: "6px",
            fontSize: "14px",
            cursor: "pointer"
          }}
        >
          Редактировать
        </button>
      </div>
      
      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "12px" }}>
        <p style={{ margin: "0 0 8px 0", color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>
          {program.description}
        </p>
        
        <div style={{ marginBottom: "16px" }}>
          <strong style={{ color: "rgba(255,255,255,0.8)" }}>Недель:</strong>
          <span style={{ margin: "0 8px" }}>{program.daysPerWeek} тренировок/неделя</span>
          <span style={{ margin: "0 8px" }}>{program.level}</span>
          <span style={{ margin: "0 8px" }}>{program.goal}</span>
        </div>
        
        {program.weeklyTemplate.map((day, dayIndex) => (
          <div key={day.id} style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#fff" }}>{day.name}</h3>
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "10px" }}>
              {day.exercises.map((ex, exIndex) => (
                <div key={ex.id} style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
                  <span>
                    <strong>{ex.name}</strong>: {ex.sets} подходов × {ex.reps} 
                    {ex.weight > 0 && ` @ ${ex.weight} кг`}
                    {ex.rir > 0 && ` (RIR ${ex.rir})`}
                  </span>
                  {ex.notes && <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{ex.notes}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PowerliftingTab;
