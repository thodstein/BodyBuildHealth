const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const files = process.argv.slice(2);
let failed = false;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diagnostics = sf.parseDiagnostics || [];
  if (diagnostics.length === 0) {
    console.log(`OK ${path.basename(file)}`);
    continue;
  }
  failed = true;
  console.log(`FAIL ${path.basename(file)}: ${diagnostics.length} syntax error(s)`);
  for (const d of diagnostics.slice(0, 20)) {
    const pos = sf.getLineAndCharacterOfPosition(d.start || 0);
    const message = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    console.log(`  ${pos.line + 1}:${pos.character + 1} ${message}`);
  }
}
process.exit(failed ? 1 : 0);
