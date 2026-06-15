const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "..", "src", "ui", "screens", "SupportScreen.tsx");
let c = fs.readFileSync(filePath, "utf8");
let fixes = 0;

// 1. Fix supportLevel state type
const old1 = "const [supportLevel, setSupportLevel] = useState<'basic' | 'standard' | 'enhanced' | 'maximum'>('standard');";
const new1 = "const [supportLevel, setSupportLevel] = useState<'basic' | 'mid' | 'max' | 'boost'>('mid');";
if (c.includes(old1)) { c = c.replace(old1, new1); fixes++; console.log("1. supportLevel type fixed"); }

// 2. Fix autoLevel state type
const old2 = "const [autoLevel, setAutoLevel] = useState<'basic' | 'standard' | 'enhanced' | 'maximum'>('standard');";
const new2 = "const [autoLevel, setAutoLevel] = useState<'basic' | 'mid' | 'max' | 'boost'>('mid');";
if (c.includes(old2)) { c = c.replace(old2, new2); fixes++; console.log("2. autoLevel type fixed"); }

// 3. Replace SUPPORT_LEVELS - find block and replace
// The SUPPORT_LEVELS keys need to change from basic/standard/enhanced/maximum to basic/mid/max/boost
// Also update the content to match the new tier structure

// 3a. Replace basic tier content - add zinc and magnesium
const oldBasic = "basic: { label: '\u{1F7E2} \u0411\u0430\u0437\u0430', desc: '\u041c\u0438\u043d\u0438\u043c\u0443\u043c \u0434\u043b\u044f \u0437\u0434\u043e\u0440\u043e\u0432\u044c\u044f \u2014 3 \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0434\u043e\u0431\u0430\u0432\u043a\u0438', subs: ['nac', 'omega3', 'vitamin_d3'], dosages: { nac: { mg: 600, timing: '\u0443\u0442\u0440\u043e, \u043d\u0430\u0442\u043e\u0449\u0430\u043a' }, omega3: { mg: 2000, timing: '\u0441 \u0435\u0434\u043e\u0439, \u0437\u0430\u0432\u0442\u0440\u0430\u043a' }, vitamin_d3: { mg: 5000, timing: '\u0441 \u0435\u0434\u043e\u0439, \u0437\u0430\u0432\u0442\u0440\u0430\u043a (\u041c\u0415)' } } }";
const newBasic = "basic: { label: '\u0411\u0430\u0437\u0430', desc: '\u0411\u044e\u0434\u0436\u0435\u0442\u043d\u044b\u0439 \u043c\u0438\u043d\u0438\u043c\u0443\u043c \u2014 \u043a\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0440\u0438\u0441\u043a\u0438, \u0434\u0435\u0448\u0451\u0432\u044b\u0435 \u044d\u0444\u0444\u0435\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0434\u043e\u0431\u0430\u0432\u043a\u0438', subs: ['nac', 'omega3', 'vitamin_d3', 'zinc', 'magnesium'], dosages: { nac: { mg: 600, timing: '\u0443\u0442\u0440\u043e, \u043d\u0430\u0442\u043e\u0449\u0430\u043a' }, omega3: { mg: 1000, timing: '\u0441 \u0435\u0434\u043e\u0439, \u0437\u0430\u0432\u0442\u0440\u0430\u043a' }, vitamin_d3: { mg: 2000, timing: '\u0441 \u0435\u0434\u043e\u0439, \u0437\u0430\u0432\u0442\u0440\u0430\u043a (\u041c\u0415)' }, zinc: { mg: 15, timing: '\u043d\u0430 \u043d\u043e\u0447\u044c' }, magnesium: { mg: 200, timing: '\u043d\u0430 \u043d\u043e\u0447\u044c' } } }";
if (c.includes(oldBasic)) { c = c.replace(oldBasic, newBasic); fixes++; console.log("3a. basic tier updated"); }

// 3b. Rename standard -> mid
const oldStd = "standard: { label: '\u{1F7E1} \u0421\u0440\u0435\u0434\u043d\u0438\u0439'";
const newStd = "mid: { label: '\u0421\u0440\u0435\u0434\u043d\u0438\u0439'";
if (c.includes(oldStd)) { c = c.replace(oldStd, newStd); fixes++; console.log("3b. standard -> mid"); }

// 3c. Rename enhanced -> max
const oldEnh = "enhanced: { label: '\u{1F7E0} \u0423\u0441\u0438\u043b\u0435\u043d\u0438\u0435'";
const newEnh = "max: { label: '\u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c'";
if (c.includes(oldEnh)) { c = c.replace(oldEnh, newEnh); fixes++; console.log("3c. enhanced -> max"); }

// 3d. Rename maximum -> boost
const oldMax = "maximum: { label: '\u{1F534} \u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c'";
const newMax = "boost: { label: '\u0423\u0441\u0438\u043b\u0435\u043d\u0438\u0435'";
if (c.includes(oldMax)) { c = c.replace(oldMax, newMax); fixes++; console.log("3d. maximum -> boost"); }

// 3e. Update descriptions for mid/max/boost
const oldMidDesc = "desc: '\u0421\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u043d\u0430\u044f \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430 \u043a\u0443\u0440\u0441\u0430 \u2014 11 \u0434\u043e\u0431\u0430\u0432\u043e\u043a'";
const newMidDesc = "desc: '\u041e\u043f\u0442\u0438\u043c\u0443\u043c \u0446\u0435\u043d\u0430/\u043a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u2014 \u043f\u043e\u043a\u0440\u044b\u0442\u0438\u0435 \u0432\u0441\u0435\u0445 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0445 \u0440\u0438\u0441\u043a\u043e\u0432'";
if (c.includes(oldMidDesc)) { c = c.replace(oldMidDesc, newMidDesc); fixes++; console.log("3e. mid desc updated"); }

const oldMaxDesc = "desc: '\u041f\u043e\u043b\u043d\u0430\u044f \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430 \u043a\u0443\u0440\u0441\u0430 \u2014 21 \u0434\u043e\u0431\u0430\u0432\u043a\u0430'";
const newMaxDesc = "desc: '\u041f\u043e\u043b\u043d\u0430\u044f \u043a\u043e\u043c\u043f\u043b\u0435\u043a\u0441\u043d\u0430\u044f \u0437\u0430\u0449\u0438\u0442\u0430 \u2014 \u043f\u0440\u0435\u043c\u0438\u0443\u043c \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u044b \u0438 \u0434\u043e\u0437\u044b'";
if (c.includes(oldMaxDesc)) { c = c.replace(oldMaxDesc, newMaxDesc); fixes++; console.log("3f. max desc updated"); }

const oldBoostDesc = "desc: '\u041c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u0430\u044f \u0437\u0430\u0449\u0438\u0442\u0430 \u0438 \u0440\u0435\u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f \u2014 41 \u0434\u043e\u0431\u0430\u0432\u043a\u0430'";
const newBoostDesc = "desc: '\u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c + \u0441\u0443\u043f\u0435\u0440\u0444\u0443\u0434\u044b, \u043f\u0435\u043f\u0442\u0438\u0434\u044b, \u0441\u043f\u0435\u0446\u0438\u0444\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f'";
if (c.includes(oldBoostDesc)) { c = c.replace(oldBoostDesc, newBoostDesc); fixes++; console.log("3g. boost desc updated"); }

// 4. Fix autoLevel logic
const oldAutoLevel = "let level: 'basic' | 'standard' | 'enhanced' | 'maximum' = 'basic';";
const newAutoLevel = "let level: 'basic' | 'mid' | 'max' | 'boost' = 'basic';";
if (c.includes(oldAutoLevel)) { c = c.replace(oldAutoLevel, newAutoLevel); fixes++; console.log("4. autoLevel var type fixed"); }

const oldLevelMax = "level = 'maximum';";
const newLevelBoost = "level = 'boost';";
if (c.includes(oldLevelMax)) { c = c.replace(oldLevelMax, newLevelBoost); fixes++; console.log("4a. level = 'maximum' -> 'boost'"); }

const oldLevelEnh = "level = 'enhanced';";
const newLevelMax = "level = 'max';";
if (c.includes(oldLevelEnh)) { c = c.replace(oldLevelEnh, newLevelMax); fixes++; console.log("4b. level = 'enhanced' -> 'max'"); }

const oldLevelStd = "level = 'standard';";
const newLevelMid = "level = 'mid';";
if (c.includes(oldLevelStd)) { c = c.replace(oldLevelStd, newLevelMid); fixes++; console.log("4c. level = 'standard' -> 'mid'"); }

// 5. Fix button array
const oldBtn = "(['basic', 'standard', 'enhanced', 'maximum'] as const).map(l =>";
const newBtn = "(['basic', 'mid', 'max', 'boost'] as const).map(l =>";
if (c.includes(oldBtn)) { c = c.replace(oldBtn, newBtn); fixes++; console.log("5. button array fixed"); }

// 6. Fix color mapping
const oldColors = "const colors: Record<string, string> = { basic: '#22c55e', standard: '#eab308', enhanced: '#f97316', maximum: '#ef4444' };";
const newColors = "const colors: Record<string, string> = { basic: '#22c55e', mid: '#eab308', max: '#ef4444', boost: '#a855f7' };";
if (c.includes(oldColors)) { c = c.replace(oldColors, newColors); fixes++; console.log("6. colors fixed"); }

fs.writeFileSync(filePath, c, "utf8");
console.log("Total fixes applied: " + fixes);
