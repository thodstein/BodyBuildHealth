// Diagnose Manual Constructor & PL/LMS/Library issue
const fs = require('fs');
const root = 'src/ui/screens/TrainingScreen_parts/ProgramManagerPanel.tsx';
const t = fs.readFileSync(root, 'utf8');

console.log('===== File size =====');
console.log('total lines:', t.split('\n').length, 'bytes:', t.length);

// 1. Find ALL branches that depend on dir==='pl'
console.log('\n===== PL render branches =====');
const lines = t.split('\n');
let plbranch = [];
for (let i = 0; i < lines.length; i++) {
  if (/dir\s*===\s*['"]pl['"]/.test(lines[i])) plbranch.push(i+1);
}
console.log('lines with dir===\'pl\':', plbranch.slice(0, 30));

// 2. Find ALL where program.pl is referenced
console.log('\n===== program.pl references =====');
const plrefs = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('program.pl')) plrefs.push(i+1);
}
console.log('program.pl lines:', plrefs.slice(0, 30));

// 3. Look for PL editor body
const idx = t.indexOf('PLContextPanel');
console.log('\n===== PLContextPanel =====');
if (idx !== -1) console.log('line:', t.substring(0, idx).split('\n').length, 'context:', t.substring(idx, idx + 200));

// 4. Find all onClick handlers within ProgramEditor (excluding finishWizard/startCreate)
console.log('\n===== onClick handlers in editor =====');
const onClicks = [];
for (let i = 0; i < lines.length; i++) {
  if (/onClick\s*=\s*\{/.test(lines[i])) onClicks.push([i+1, lines[i].trim().substring(0, 80)]);
}
console.log('first 20 onClick:', onClicks.slice(0, 20));
console.log('total onClick:', onClicks.length);

// 5. Find 'isClickable' or 'unclickable' patterns
const deadButtons = [];
for (let i = 0; i < lines.length; i++) {
  if (/disabled/.test(lines[i]) && /button/.test(lines[i-1]||'')) deadButtons.push(i+1);
}
console.log('disabled buttons:', deadButtons);

// 6. Find Picker open conditions
const pickerLines = [];
for (let i = 0; i < lines.length; i++) {
  if (/pickerOpen|setPickerOpen/.test(lines[i])) pickerLines.push(i+1);
}
console.log('pickerOpen refs:', pickerLines);

// 7. Look for any function that handles PL cycle click
console.log('\n===== cloneFromCycle usage =====');
const cloneC = [];
for (let i = 0; i < lines.length; i++) {
  if (/cloneFromCycle|startCloneCycle/.test(lines[i])) cloneC.push(i+1);
}
console.log('cloneFromCycle refs:', cloneC);

// 8. Look for any function that handles library click
console.log('\n===== library picker =====');
const libLines = [];
for (let i = 0; i < lines.length; i++) {
  if (/cloneFromLibrary|startCloneLibrary|BbProgramLibraryPicker|setPickerOpen\(['"]library/.test(lines[i])) libLines.push(i+1);
}
console.log('library lines:', libLines);

// 9. Look for NavigationCallback (does it actually navigate?)
console.log('\n===== navigate modes =====');
const navLines = [];
for (let i = 0; i < lines.length; i++) {
  if (/PlanningTrack|setPlanningTrack|setMode|goPlanner/.test(lines[i])) navLines.push(i+1);
}
console.log('nav lines:', navLines.slice(0, 15));
