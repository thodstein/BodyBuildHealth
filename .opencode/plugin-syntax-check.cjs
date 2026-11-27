const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function expandArgument(argument) {
  if (!/[?*]/.test(argument)) return [argument];

  // Windows shells commonly pass `*.ts` literally to Node. Keep the checker
  // shell-independent by expanding the simple file globs it documents itself.
  const slash = Math.max(argument.lastIndexOf('/'), argument.lastIndexOf('\\'));
  const directory = slash >= 0 ? argument.slice(0, slash) || '.' : '.';
  const pattern = slash >= 0 ? argument.slice(slash + 1) : argument;
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const matcher = new RegExp(`^${escaped}$`, 'i');

  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return [argument];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && matcher.test(entry.name))
    .map((entry) => path.join(directory, entry.name));
}

const files = process.argv.slice(2).flatMap(expandArgument);
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
