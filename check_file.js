const fs=require('fs');
const c=fs.readFileSync('src/ui/components/BioStackAIClinicalBuild.tsx','utf8');
console.log('Total lines:', c.split('\n').length);
console.log('Has step state:', c.includes('const [step, setStep]'));
console.log('Has ORGAN_OPTIONS joints:', c.includes('joints'));
console.log('Has ORGAN_OPTIONS neurotox:', c.includes('neurotox'));
console.log('No Clinical card title:', !c.includes('title="🔬 Клинический подбор"'));
console.log('Strategy under Grade:', c.includes('Стратегия подбора'));
console.log('StepPopup component:', c.includes('StepPopup'));