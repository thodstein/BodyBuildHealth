import { readFileSync, writeFileSync } from 'fs';

const FILE = 'D:/BodyBuildHealth/src/core/exercise-catalog.ts';
let content = readFileSync(FILE, 'utf-8');

const NEW_EXERCISES = `
  // == PLIOMETRIYA ==
  { id:'wall_jump', name:'Pryzhok ot steny', group:'legs', type:'compound', equipment:'bodyweight', difficulty:'intermediate', jointStress:'med', fatigueCost:6, targetMuscle:'Kvadritsepsy, yagoditsy, vzryv', order:1, substitutionGroup:'plyo', canReplace:['box_jump'], cannotReplace:['leg_ext','leg_curl'], technique:'Nogi na shirine plech. Pryzhok vverkh kasayas steny na maksimalnoy vysote. Prizemlenie myagkoe na noski.' },

  // == CALISTHENICS ==
  { id:'handstand_pushup', name:'Otzimaniya v stoyke na rukakh (HSPU)', group:'shoulders', type:'compound', equipment:'bodyweight', difficulty:'advanced', jointStress:'high', fatigueCost:9, targetMuscle:'Delty, tritseps, verkh trapetsii', order:1, substitutionGroup:'vert_push', canReplace:['ohp','ohp_seated'], cannotReplace:['lateral_raise','rear_delt_fly'], technique:'Stoyka na rukakh u steny. Opuskanie golovoy do kasaniya pola/blinov. Moshchny zhim vverkh. Lokti pod 45 gradusov, ne razvodite.' },
`;

// First, just test the approach with a small set then expand

// Escape single quotes in all names for the JavaScript string
const allExercises = [
  // Plio
  { id:'wall_jump', name:'Pryzhok ot steny', group:'legs', type:'compound', equipment:'bodyweight', difficulty:'intermediate', jointStress:'med', fatigueCost:6, targetMuscle:'Kvadritsepsy, yagoditsy, vzryv', order:1, substitutionGroup:'plyo', canReplace:['box_jump'], cannotReplace:['leg_ext','leg_curl'], technique:'Nogi na shirine plech. Pryzhok vverkh kasayas steny na maksimalnoy vysote. Prizemlenie myagkoe na noski.' },
];

function stringifyEx(ex) {
  const canReplace = JSON.stringify(ex.canReplace);
  const cannotReplace = JSON.stringify(ex.cannotReplace);
  return `  { id:${JSON.stringify(ex.id)}, name:${JSON.stringify(ex.name)}, group:${JSON.stringify(ex.group)}, type:${JSON.stringify(ex.type)}, equipment:${JSON.stringify(ex.equipment)}, difficulty:${JSON.stringify(ex.difficulty)}, jointStress:${JSON.stringify(ex.jointStress)}, fatigueCost:${ex.fatigueCost}, targetMuscle:${JSON.stringify(ex.targetMuscle)}, order:${ex.order}, substitutionGroup:${JSON.stringify(ex.substitutionGroup)}, canReplace:${canReplace}, cannotReplace:${cannotReplace}, technique:${JSON.stringify(ex.technique)} }`;
}

console.log(stringifyEx(allExercises[0]));
